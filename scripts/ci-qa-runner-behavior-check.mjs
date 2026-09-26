import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), 'aio-qa-runner-'));
const fixtureInputBefore = 'scripts/fixtures/qa-input-before.txt';
const fixtureInputAfter = 'scripts/fixtures/qa-input-after.txt';
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
  process.exit(1);
};

try {
  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: {
      fixture: {
        phase: 0,
        kind: 'static',
        inputs: [fixtureScript, fixtureInputBefore],
        gates: [
          { id: 'fixture-pass', script: fixtureScript, args: ['--mode', 'pass'] },
          { id: 'fixture-fail-a', script: fixtureScript, args: ['--mode', 'fail-a'] },
          { id: 'fixture-fail-b', script: fixtureScript, args: ['--mode', 'fail-b'] }
        ]
      },
      expensive: {
        phase: 1,
        kind: 'browser',
        inputs: [fixtureScript, fixtureInputBefore],
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
        inputs: [fixtureScript, fixtureInputBefore],
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

  // Same-size content differences must invalidate both successes. Swapping
  // immutable tracked fixtures avoids mutating the checkout during the gate.
  const changedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  changedManifest.groups.fixture.inputs = [fixtureScript, fixtureInputAfter];
  writeFileSync(manifestPath, JSON.stringify(changedManifest, null, 2));
  const changedInput = run('test');
  if (changedInput.status !== 0 || JSON.parse(readFileSync(join(cacheDir, 'last-run.json'), 'utf8')).counts?.PASS !== 2) fail('runner reused stale input content', changedInput);

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    impactRules: [{ patterns: ['scripts/fixtures/**'], groups: ['fixture'] }],
    groups: {
      preflight: { phase: 0, kind: 'static', inputs: [fixtureScript, fixtureInputBefore], gates: [{ id: 'fixture-preflight', script: fixtureScript, args: ['--mode', 'pass'] }] },
      fixture: { phase: 1, kind: 'static', inputs: [fixtureScript, fixtureInputBefore], gates: [{ id: 'fixture-affected', script: fixtureScript, args: ['--mode', 'pass'] }] }
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

  // ── P1265/E2-C6 P0: run identity — failed-batch preservation, exact rerun selection,
  // corrupt cache/report causes, concurrent runner isolation, commit-candidate binding ──
  const runAsync = (...args) => new Promise((resolvePromise) => {
    const child = spawn(process.execPath, ['scripts/qa-runner.mjs', ...args], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, CI: 'false', AIO_QA_MANIFEST_PATH: manifestPath, AIO_QA_CACHE_DIR: cacheDir }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolvePromise({ status, stdout, stderr }));
  });

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: {
      fixture: { phase: 0, kind: 'static', inputs: [fixtureScript], gates: [
        { id: 'batch-fail', script: fixtureScript, args: ['--mode', 'fail-a'] },
        { id: 'batch-pass', script: fixtureScript, args: ['--mode', 'pass'] }
      ] },
      unrelated: { phase: 0, kind: 'static', inputs: [fixtureScript], gates: [
        { id: 'unrelated-pass', script: fixtureScript, args: ['--mode', 'pass'] }
      ] }
    },
    profiles: { test: ['fixture'], unrelated: ['unrelated'] }
  }, null, 2));
  const batchRun = run('test', '--no-cache');
  if (batchRun.status !== 1) fail('failed-batch fixture expected a failing run', batchRun);
  const unrelatedRun = run('unrelated', '--no-cache');
  if (unrelatedRun.status !== 0) fail('unrelated fixture run failed', unrelatedRun);
  const rerunAfterUnrelated = run('rerun-failed', '--list');
  if (rerunAfterUnrelated.status !== 0) fail('rerun-failed lost the failed batch after an unrelated successful run', rerunAfterUnrelated);
  const rerunIds = JSON.parse(rerunAfterUnrelated.stdout).gates.map((gate) => gate.id).sort();
  if (rerunIds.join(',') !== 'batch-fail') fail(`rerun-failed did not select the exact preserved batch, got ${rerunIds.join(',') || 'none'}`, rerunAfterUnrelated);
  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: { fixture: { phase: 0, kind: 'static', inputs: [fixtureScript], gates: [
      { id: 'batch-fail', script: fixtureScript, args: ['--mode', 'pass'] }
    ] } },
    profiles: { test: ['fixture'] }
  }, null, 2));
  const resolvedRun = run('test', '--no-cache');
  if (resolvedRun.status !== 0) fail('batch-resolving run failed', resolvedRun);
  if (existsSync(join(cacheDir, 'failed-batch.json'))) fail('failed batch was not cleared after a run covered and passed every batch gate', resolvedRun);
  const emptyRerun = run('rerun-failed');
  if (emptyRerun.status !== 2 || !/FAIL gate가 없습니다/.test(emptyRerun.stderr)) fail('rerun-failed did not refuse an empty failure batch with an explicit cause', emptyRerun);

  writeFileSync(join(cacheDir, 'success-cache.json'), '{corrupt-json');
  const corruptCacheRun = run('test');
  if (corruptCacheRun.status !== 0) fail('run under a corrupt success cache failed', corruptCacheRun);
  const corruptCacheReport = JSON.parse(readFileSync(join(cacheDir, 'last-run.json'), 'utf8'));
  if (corruptCacheReport.counts?.CACHED) fail('a corrupt success cache produced cache hits instead of re-running', corruptCacheRun);
  if (!/unreadable/.test(corruptCacheRun.stderr)) fail('a corrupt success cache was not reported with its cause', corruptCacheRun);

  writeFileSync(join(cacheDir, 'failed-batch.json'), 'not-json-at-all');
  const corruptBatchRun = run('rerun-failed');
  if (corruptBatchRun.status !== 2 || !/unreadable/.test(corruptBatchRun.stderr)) fail('a corrupt failed batch was not rejected with its cause', corruptBatchRun);

  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    groups: {
      concFail: { phase: 0, kind: 'static', inputs: [fixtureScript], gates: [{ id: 'conc-fail', script: fixtureScript, args: ['--mode', 'fail-a'] }] },
      concPass: { phase: 0, kind: 'static', inputs: [fixtureScript], gates: [{ id: 'conc-pass', script: fixtureScript, args: ['--mode', 'pass'] }] }
    },
    profiles: { concfail: ['concFail'], concpass: ['concPass'] }
  }, null, 2));
  const [concFailRun, concPassRun] = await Promise.all([runAsync('concfail', '--no-cache'), runAsync('concpass', '--no-cache')]);
  if (concFailRun.status !== 1 || concPassRun.status !== 0) fail('concurrent runners produced the wrong exit codes', concFailRun);
  const concBatch = JSON.parse(readFileSync(join(cacheDir, 'failed-batch.json'), 'utf8'));
  if ((concBatch.gateIds || []).join(',') !== 'conc-fail') fail(`concurrent run contaminated the failed batch: ${JSON.stringify(concBatch.gateIds)}`, concFailRun);
  const runReports = readdirSync(join(cacheDir, 'runs')).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(join(cacheDir, 'runs', name), 'utf8')));
  const sawConcFail = runReports.some((report) => (report.results || []).some((item) => item.id === 'conc-fail' && item.status === 'FAIL'));
  const sawConcPass = runReports.some((report) => (report.results || []).some((item) => item.id === 'conc-pass' && item.status === 'PASS'));
  if (!sawConcFail || !sawConcPass) fail('per-run reports did not preserve both concurrent results independently', concFailRun);

  const candidateRepo = join(temp, 'candidate-repo');
  mkdirSync(candidateRepo, { recursive: true });
  const git = (...args) => spawnSync('git', args, { cwd: candidateRepo, encoding: 'utf8' });
  const runCandidate = (...args) => spawnSync(process.execPath, ['scripts/qa-runner.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: 'false', AIO_QA_MANIFEST_PATH: manifestPath, AIO_QA_CACHE_DIR: cacheDir, AIO_QA_CANDIDATE_REPO: candidateRepo }
  });
  git('init');
  git('config', 'user.email', 'fixture@aio.test');
  git('config', 'user.name', 'fixture');
  writeFileSync(join(candidateRepo, 'task.txt'), 'v1\n');
  git('add', 'task.txt');
  const initCommit = git('commit', '-m', 'init');
  if (initCommit.status !== 0) fail('candidate fixture could not create its isolated repo', initCommit);
  const digest = (content) => createHash('sha256').update(content).digest('hex');
  const writeVerifiedTree = (runLabel, files) => writeFileSync(join(cacheDir, 'verified-tree.json'), JSON.stringify({
    schemaVersion: 'aio-qa-verified-tree.v1', runId: runLabel, files, taskFiles: files
  }, null, 2));
  writeVerifiedTree('fixture-verify-1', { 'task.txt': digest('v2\n') });
  writeFileSync(join(candidateRepo, 'task.txt'), 'v2\n');
  git('add', 'task.txt');
  writeFileSync(join(candidateRepo, 'task.txt'), 'v3\n');
  const partialStage = runCandidate('candidate', '--files', 'task.txt');
  if (partialStage.status !== 1 || !/staged-differs-from-worktree/.test(partialStage.stderr)) fail('candidate accepted a partially staged tree', partialStage);
  git('add', 'task.txt');
  const postQaDrift = runCandidate('candidate', '--files', 'task.txt');
  if (postQaDrift.status !== 1 || !/changed-after-qa-verification/.test(postQaDrift.stderr)) fail('candidate accepted a tree changed after QA verification', postQaDrift);
  writeVerifiedTree('fixture-verify-2', { 'task.txt': digest('v3\n') });
  writeFileSync(join(candidateRepo, 'extra.txt'), 'x\n');
  git('add', 'extra.txt');
  const unverifiedFile = runCandidate('candidate', '--files', 'task.txt');
  if (unverifiedFile.status !== 1 || !/staged-file-not-verified/.test(unverifiedFile.stderr)) fail('candidate accepted an unverified staged file', unverifiedFile);
  git('rm', '--cached', 'extra.txt');
  const cleanCandidate = runCandidate('candidate', '--files', 'task.txt');
  if (cleanCandidate.status !== 0) fail('candidate rejected a staged tree identical to the QA-verified tree', cleanCandidate);

  // P1265/E2-C6 P1: gate-level impact entries add exactly the named gate without
  // widening to the whole group (single-owner dedup compensation).
  writeFileSync(manifestPath, JSON.stringify({
    ...base,
    impactRules: [
      { patterns: ['worker/**'], groups: ['cloudflare'], gates: ['data-plane'] },
      { patterns: ['public-data/**'], groups: ['data'] }
    ],
    groups: {
      preflight: { phase: 0, kind: 'static', inputs: ['scripts/fixtures/**'], gates: [{ id: 'preflight', script: fixtureScript }] },
      cloudflare: { phase: 1, kind: 'static', inputs: ['scripts/fixtures/**'], gates: [{ id: 'cf-gate', script: fixtureScript }] },
      data: { phase: 1, kind: 'static', inputs: ['scripts/fixtures/**'], gates: [
        { id: 'data-plane', script: fixtureScript },
        { id: 'data-other', script: fixtureScript }
      ] }
    },
    profiles: { test: ['preflight'] }
  }, null, 2));
  const workerEdit = run('affected', '--files', 'worker/data-plane.js', '--list');
  if (workerEdit.status !== 0) fail('gate-level impact affected selection failed', workerEdit);
  const workerGates = JSON.parse(workerEdit.stdout).gates.map((gate) => gate.id).sort();
  if (workerGates.join(',') !== 'cf-gate,data-plane,preflight') fail(`gate-level impact must add exactly the named gate, got ${workerGates.join(',')}`, workerEdit);
  const dataEdit = run('affected', '--files', 'public-data/data.json', '--list');
  if (dataEdit.status !== 0) fail('group-level impact affected selection failed', dataEdit);
  const dataGates = JSON.parse(dataEdit.stdout).gates.map((gate) => gate.id).sort();
  if (dataGates.join(',') !== 'data-other,data-plane,preflight') fail(`group impact must keep its own gates, got ${dataGates.join(',')}`, dataEdit);

  console.log('QA runner behavior OK: phase barriers, failed-only retry, content cache invalidation, task scope, test dependencies, bounded concurrency, exclusive timing gates, failed-batch preservation, corrupt cache/report causes, concurrent run isolation and commit-candidate binding.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
