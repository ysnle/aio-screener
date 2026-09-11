import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), 'aio-qa-runner-'));
const inputDir = mkdtempSync(join(root, '_artifacts', 'qa-input-fixture-'));
const inputPath = join(inputDir, 'value.txt');
const fixtureInput = relative(root, inputPath).replaceAll('\\', '/');
writeFileSync(inputPath, 'before');
const cacheDir = join(temp, 'cache');
const manifestPath = join(temp, 'manifest.json');
const marker = join(cacheDir, 'expensive-marker.txt');
const fixtureScript = 'scripts/fixtures/qa-gate-fixture.mjs';
const base = { schemaVersion: 'aio-qa-fixture.v1', cacheVersion: 1, impactRules: [], profiles: { test: ['fixture'] } };

const run = (...args) => spawnSync(process.execPath, ['scripts/qa-runner.mjs', ...args], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, CI: 'false', AIO_QA_MANIFEST_PATH: manifestPath, AIO_QA_CACHE_DIR: cacheDir }
});
const fail = (message, result = null) => {
  console.error(message);
  if (result) console.error(`${result.stdout || ''}\n${result.stderr || ''}`.trim());
  rmSync(temp, { recursive: true, force: true });
  rmSync(inputDir, { recursive: true, force: true });
  process.exit(1);
};

try {
  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: {
      fixture: {
        phase: 0,
        kind: 'static',
        inputs: ['scripts/fixtures/**', fixtureInput],
        gates: [
          { id: 'fixture-pass', script: fixtureScript, args: ['--mode', 'pass'] },
          { id: 'fixture-fail-a', script: fixtureScript, args: ['--mode', 'fail-a'] },
          { id: 'fixture-fail-b', script: fixtureScript, args: ['--mode', 'fail-b'] }
        ]
      },
      expensive: {
        phase: 1,
        kind: 'browser',
        inputs: ['scripts/fixtures/**', fixtureInput],
        gates: [{ id: 'fixture-expensive', script: fixtureScript, args: ['--mode', 'marker', '--path', '{cacheDir}/expensive-marker.txt'] }]
      }
    },
    profiles: { test: ['fixture', 'expensive'] }
  }, null, 2));
  const aggregate = run('test', '--no-cache', '--jobs', '3');
  if (aggregate.status !== 1) fail('runner fixture expected a failing exit', aggregate);
  const failedReport = JSON.parse(readFileSync(join(cacheDir, 'last-run.json'), 'utf8'));
  if (failedReport.counts?.FAIL !== 2 || failedReport.counts?.PASS !== 1 || failedReport.counts?.SKIP !== 1) fail('runner did not aggregate sibling failures and skip the expensive phase', aggregate);
  if (existsSync(marker)) fail('expensive phase executed after preflight failure', aggregate);
  const rerunList = run('rerun-failed', '--list');
  if (rerunList.status !== 0) fail('runner failed to list exact failed gates', rerunList);
  const rerunSelection = JSON.parse(rerunList.stdout);
  if (rerunSelection.gates.map((gate) => gate.id).sort().join(',') !== 'fixture-fail-a,fixture-fail-b') fail('rerun-failed selected passed siblings or skipped phases', rerunList);

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: {
      fixture: {
        phase: 0,
        kind: 'static',
        inputs: ['scripts/fixtures/**', fixtureInput],
        gates: [
          { id: 'fixture-pass-a', script: fixtureScript, args: ['--mode', 'pass-a'] },
          { id: 'fixture-pass-b', script: fixtureScript, args: ['--mode', 'pass-b'] }
        ]
      }
    }
  }, null, 2));
  const first = run('test');
  if (first.status !== 0) fail('runner cache fixture first pass failed', first);
  const cacheManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  cacheManifest.profiles.unrelated = ['fixture'];
  writeFileSync(manifestPath, JSON.stringify(cacheManifest, null, 2));
  const second = run('test');
  if (second.status !== 0) fail('runner cache fixture second pass failed', second);
  const cachedReport = JSON.parse(readFileSync(join(cacheDir, 'last-run.json'), 'utf8'));
  if (cachedReport.counts?.CACHED !== 2 || cachedReport.durationMs > 2_000) fail('runner did not reuse content-keyed successful gates', second);

  // Same-size content changes must invalidate both successes, not just mtime.
  writeFileSync(inputPath, 'after!');
  const changedInput = run('test');
  if (changedInput.status !== 0 || JSON.parse(readFileSync(join(cacheDir, 'last-run.json'), 'utf8')).counts?.PASS !== 2) fail('runner reused stale input content', changedInput);

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    impactRules: [{ patterns: ['scripts/fixtures/**'], groups: ['fixture'] }],
    groups: {
      preflight: { phase: 0, kind: 'static', inputs: ['scripts/fixtures/**', fixtureInput], gates: [{ id: 'fixture-preflight', script: fixtureScript, args: ['--mode', 'pass'] }] },
      fixture: { phase: 1, kind: 'static', inputs: ['scripts/fixtures/**', fixtureInput], gates: [{ id: 'fixture-affected', script: fixtureScript, args: ['--mode', 'pass'] }] }
    },
    profiles: { test: ['preflight', 'fixture'] }
  }, null, 2));
  const explicitAffected = run('affected', '--files', 'scripts/fixtures/qa-gate-fixture.mjs', '--list');
  if (explicitAffected.status !== 0) fail('runner explicit affected file selection failed', explicitAffected);
  const affectedSelection = JSON.parse(explicitAffected.stdout);
  if (affectedSelection.changeSource !== 'explicit-files' || affectedSelection.groups.join(',') !== 'preflight,fixture') fail('runner did not isolate affected selection to the explicit task file set', explicitAffected);
  const sessionStart = run('session-start', '--session', 'behavior-fixture');
  if (sessionStart.status !== 0 || !existsSync(join(cacheDir, 'sessions', 'behavior-fixture.json'))) fail('runner did not create a task-session baseline', sessionStart);

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    impactRules: [{ patterns: ['scripts/**', 'index.html'], groups: ['fixture'] }],
    groups: {
      preflight: { phase: 0, kind: 'static', inputs: ['scripts/fixtures/**'], gates: [{ id: 'preflight', script: fixtureScript }] },
      fixture: { phase: 1, kind: 'static', inputs: ['scripts/**'], gates: [
        { id: 'target', script: 'scripts/ci-domain-parity-check.mjs', dependsOn: ['dependency'] },
        { id: 'dependency', script: fixtureScript },
        { id: 'unrelated', script: 'scripts/generate-workspace-state.mjs' }
      ] },
      external: { phase: 2, kind: 'external', inputs: ['scripts/**'], gates: [
        { id: 'live-target', script: 'scripts/ci-domain-parity-check.mjs' }
      ] }
    }
  }, null, 2));
  const leaf = run('affected', '--files', 'scripts/ci-domain-parity-check.mjs', '--list');
  if (leaf.status !== 0 || JSON.parse(leaf.stdout).gates.map((gate) => gate.id).join(',') !== 'preflight,target,dependency') fail('test edit lost dependencies or selected unrelated siblings', leaf);
  for (const files of ['scripts/fetch-data.mjs', 'scripts/generate-workspace-state.mjs', 'scripts/ci-domain-parity-check.mjs,index.html']) {
    const broad = run('affected', '--files', files, '--list');
    if (broad.status !== 0 || JSON.parse(broad.stdout).gates.length !== 4) fail('producer or mixed edit lost conservative coverage', broad);
  }

  writeFileSync(manifestPath, JSON.stringify({
    ...base, profiles: { test: ['browser'] },
    groups: { browser: { phase: 0, kind: 'browser', inputs: ['scripts/fixtures/**'], gates: ['a', 'b', 'solo', 'c', 'd'].map((id) => ({
      id, script: fixtureScript, exclusive: id === 'solo',
      args: ['--mode', 'timed', '--record', '{cacheDir}/events.jsonl', '--label', id]
    })) } }
  }, null, 2));
  for (const jobs of [2, 1]) {
    writeFileSync(join(cacheDir, 'events.jsonl'), '');
    const result = run('test', '--no-cache', '--browser-jobs', String(jobs));
    if (result.status !== 0) fail('browser scheduling fixture failed', result);
    const events = readFileSync(join(cacheDir, 'events.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const active = new Set();
    let peak = 0;
    for (const { id, event } of events) {
      if (event === 'start') {
        if (active.has(id) || active.has('solo') || (id === 'solo' && active.size)) fail('exclusive gate overlapped another gate', result);
        active.add(id);
        peak = Math.max(peak, active.size);
      } else if (!active.delete(id)) fail('gate completion was not paired with a start', result);
    }
    if (events.length !== 10 || active.size || peak !== jobs) fail('browser concurrency cap or serial override failed', result);
  }
  console.log('QA runner behavior OK: phase barriers, failed-only retry, content cache invalidation, task scope, test dependencies, bounded concurrency and exclusive timing gates.');
} finally {
  rmSync(temp, { recursive: true, force: true });
  rmSync(inputDir, { recursive: true, force: true });
}
