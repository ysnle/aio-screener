#!/usr/bin/env node
// v59.70 (I8, coverage audit top item; actions-reliability ledger class B): CI failed on what the live data and the
// calendar said, not on the code. 35 refresh-origin CI runs failed 10-28..11-04 and every later data commit stayed
// UNATTESTED; on 11-04 the source push that fixed the data plane (432ac3eb) failed only because data.json was 13.6 h old
// and CODE-MAP had turned 46 days, so no release on top of it could attest (deadlock). Owner 2026-11-04 (this session):
// every ci.yml contract shard runs with AIO_QA_ORIGIN=ci; there a `liveData: "content"` gate reports (ADVISORY) and the
// knowledge-lint date ratchet warns, while producers, local runs and the watchdog twins still fail on them. Source
// defects declare nothing and keep blocking. The replays run the real qa-runner and the real knowledge-lint.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CI_ORIGIN, LIVE_DATA_KINDS, clockJudgementBlocks, failureBlocks, qaOrigin } from './lib/qa-live-data.mjs';

if (process.argv.includes('--fixture-fail')) { console.error('fixture: assertion failed'); process.exit(1); }

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const manifest = JSON.parse(read('architecture/qa-pipeline.json'));
const errors = [];
const check = (label, ok, detail = '') => { if (!ok) errors.push(`${label}${detail ? `: ${detail}` : ''}`); };
const CONTRACT_GROUPS = ['core', 'data', 'knowledge'];

// 1. Exhaustive: every gate x origin. Only contract-group gates may declare liveData, with a known kind and a watchdog twin.
const gates = Object.entries(manifest.groups).flatMap(([group, spec]) => (spec.gates || []).map((gate) => ({ ...gate, group })));
const watchdogScripts = new Set((manifest.groups['watchdog-local']?.gates || []).map((gate) => gate.script));
for (const gate of gates) {
  if (gate.liveData !== undefined) {
    check(`v59.70 ${gate.id} liveData kind is known`, LIVE_DATA_KINDS.includes(gate.liveData), String(gate.liveData));
    check(`v59.70 ${gate.id} declares liveData only in a contract group`, CONTRACT_GROUPS.includes(gate.group), gate.group);
    check(`v59.70 ${gate.id} (liveData) has a watchdog-local twin running ${gate.script}`, watchdogScripts.has(gate.script));
  }
  for (const origin of ['source', CI_ORIGIN]) {
    const expected = !(origin === CI_ORIGIN && gate.liveData === 'content');
    check(`v59.70 ${gate.id} on ${origin} ${expected ? 'blocks' : 'reports'}`, failureBlocks(gate, origin) === expected);
  }
}
check('v59.70 only AIO_QA_ORIGIN=ci selects the CI origin', qaOrigin({ AIO_QA_ORIGIN: 'ci' }) === CI_ORIGIN
  && qaOrigin({}) === 'source' && qaOrigin({ AIO_QA_ORIGIN: 'CI' }) === 'source' && qaOrigin({ AIO_QA_ORIGIN: 'refresh' }) === 'source');
check('v59.70 a wall-clock date judgement blocks everywhere except a CI contract shard', clockJudgementBlocks({}) === true && clockJudgementBlocks({ AIO_QA_ORIGIN: 'ci' }) === false);
// Safety: the source-defect gates never declare liveData, so a control character, bad YAML or syntax still blocks CI.
for (const id of ['workflow-yaml', 'syntax', 'generated-state', 'qa-pipeline-contract', 'workspace-contract', 'knowledge-lint']) {
  const gate = gates.find((item) => item.id === id);
  check(`v59.70 source-defect gate ${id} stays blocking in CI`, gate && failureBlocks(gate, CI_ORIGIN) === true, gate ? '' : 'missing');
}
check('v59.70 knowledge-lint has a watchdog twin (its date ratchet blocks there)', watchdogScripts.has('scripts/ci-knowledge-lint-check.mjs'));

// 2. The failure ledger (gh run list/view). Every row resolved.
const byId = new Map(gates.map((gate) => [gate.id, gate]));
const LEDGER = [
  // refresh-origin CI, ci.yml workflow_dispatch, 10-28..11-04: 35 runs, 49 gate failures
  { gate: 'esm-core', runs: 10, cause: 'news audit aged rows on the wall clock (10-29/10-30 21-23Z)', resolution: 'fixed-clock', proof: ['scripts/ci-esm-core-unit-check.mjs', 'for (const fixedNow of ['] },
  { gate: 'runtime', runs: 9, cause: 'LIVE3-03 20SMA breadth fixture on the wall clock (11-03 05-09Z)', resolution: 'fixed-clock', proof: ['scripts/ci-runtime-contract-check.mjs', 'readScreenerBreadth(breadthFixture({}), BREADTH_FIXTURE_NOW)'] },
  { gate: 'data-pipeline', runs: 9, cause: 'screener breadth 97 h row on the wall clock (11-03 05-09Z)', resolution: 'fixed-clock', proof: ['scripts/ci-data-pipeline-contract-check.mjs', 'readScreenerBreadth(us({ observedAt: new Date(now - 97 * 3600000).toISOString() }), now)'] },
  { gate: 'scenario-guidance-fixture', runs: 6, cause: 'P1743 "the live state has at least one staged theme" (live scenario-state)', resolution: 'liveData' },
  { gate: 'data-refresh', runs: 6, cause: 'reference rows and data age on screener/event-briefs commits', resolution: 'liveData' },
  { gate: 'data-lineage', runs: 2, cause: 'data.json 12 h SLA on screener commits while refresh-data was failing', resolution: 'liveData' },
  { gate: 'workflow-yaml', runs: 3, cause: 'reaction-read.js U+0008 in source (v59.69)', resolution: 'source-defect' },
  { gate: 'browser-secondary-text-budget', runs: 2, cause: 'home text budget on event-brief text', resolution: 'browser-scope' },
  { gate: 'screener-extended', runs: 2, cause: 'not retrievable (10-30 logs carry no failing line)', resolution: 'unresolved-blocking' },
];
const SOURCE_PUSH_LEDGER = [
  // 432ac3eb push CI 41761300575 (11-04 02:31Z): the deadlock
  { gate: 'data-lineage', cause: 'data.json 13.6 h old > 12 h SLA (the data plane had been stopped)', resolution: 'liveData' },
  { gate: 'data-refresh', cause: 'the same data age', resolution: 'liveData' },
  { gate: 'knowledge-lint', cause: 'P1125: CODE-MAP last_verified 46 d > 45 d', resolution: 'clock-judgement' },
];
// 35 failed runs carried 49 gate failures (runtime + data-pipeline together 9 times, data-refresh with data-lineage 2
// and with scenario-guidance 4).
check('v59.70 the ledger holds all 49 gate failures of the 35 refresh-origin CI runs', LEDGER.reduce((sum, row) => sum + row.runs, 0) === 49);
const ci = read('.github/workflows/ci.yml');
for (const row of [...LEDGER, ...SOURCE_PUSH_LEDGER]) {
  const gate = byId.get(row.gate);
  if (!gate) { check(`v59.70 ledger gate ${row.gate} exists`, false); continue; }
  if (row.resolution === 'liveData') {
    // Old configuration: the gate as it was, without the declaration, fails a CI shard. New: it reports there.
    const old = { ...gate }; delete old.liveData;
    check(`v59.70 ${row.gate}: old config red in CI, new config green in CI, still red locally/watchdog`,
      failureBlocks(old, CI_ORIGIN) === true && failureBlocks(gate, CI_ORIGIN) === false && failureBlocks(gate, 'source') === true, row.cause);
  } else if (row.resolution === 'fixed-clock') {
    check(`v59.70 ${row.gate}: the clock-bound fixture runs on a fixed clock`, read(row.proof[0]).includes(row.proof[1]), row.proof.join(' :: '));
    check(`v59.70 ${row.gate} stays a blocking code contract`, gate.liveData === undefined);
  } else if (row.resolution === 'clock-judgement') {
    check(`v59.70 ${row.gate}: the gate stays blocking; only its date judgement warns in CI`, gate.liveData === undefined
      && read('scripts/ci-knowledge-lint-check.mjs').includes('(clockJudgementBlocks() ? check : warn)(`P1125'));
  } else if (row.resolution === 'source-defect') {
    check(`v59.70 ${row.gate}: a source defect still blocks CI`, failureBlocks(gate, CI_ORIGIN) === true);
  } else if (row.resolution === 'browser-scope') {
    check(`v59.70 ${row.gate}: browser shards do not run on a refresh origin`, gate.group.startsWith('browser') && ci.includes("if: needs.preflight.outputs.reduced_scope != 'true'"));
  } else {
    check(`v59.70 ${row.gate}: an unexplained failure stays blocking`, failureBlocks(gate, CI_ORIGIN) === true);
  }
}
// The breadth fixture really was clock-bound: on the 11-03 06:00Z wall clock the old 97 h assertion failed.
{
  const { readScreenerBreadth } = await import('../src/domain/market/screener-breadth.js');
  const us = (now, extra) => ({ schemaVersion: '1.0', source: 'fixture', segments: { us: { above5: 40, above20: 35, above50: 36, above200: 52, advanceRatio: 0.6, coveragePct: 97, eligible: 700, observedAt: new Date(now - 3600000).toISOString(), ...extra } } });
  const oldAt = (now) => readScreenerBreadth(us(now, { observedAt: new Date(now - 97 * 3600000).toISOString() }), now).us === null;
  const fixedNow = Date.parse('2026-10-14T23:00:00Z');
  check('v59.70 the old breadth assertion fails on the 11-03 06:00Z clock and the fixed clock passes', !oldAt(Date.parse('2026-11-03T06:00:00Z')) && oldAt(fixedNow));
}

// 3. Wiring: every CI contract shard passes the origin; producers and the watchdog never do (they must still fail closed).
check('v59.70 ci.yml contract shards run with AIO_QA_ORIGIN=ci (source pushes included)', /\n\s+AIO_QA_ORIGIN: ci\n\s+run: node scripts\/qa-runner\.mjs --group \$\{\{ matrix\.group \}\} --no-cache/.test(ci)
  && (ci.match(/AIO_QA_ORIGIN/g) || []).length === 1);
for (const workflow of ['refresh-data.yml', 'refresh-screener.yml', 'event-briefs.yml', 'data-watchdog.yml', 'pages-deploy.yml']) {
  check(`v59.70 ${workflow} does not set AIO_QA_ORIGIN`, !read(`.github/workflows/${workflow}`).includes('AIO_QA_ORIGIN'));
}

// 4. Replay through the real runner: a live-content gate and a source-defect gate, old and new configuration.
const replay = (gate, origin) => {
  const dir = mkdtempSync(join(tmpdir(), 'aio-live-data-'));
  try {
    const path = join(dir, 'manifest.json');
    writeFileSync(path, JSON.stringify({ schemaVersion: manifest.schemaVersion, cacheVersion: manifest.cacheVersion, profiles: { full: ['data'] },
      impactRules: [], groups: { data: { phase: 1, kind: 'static', cache: false, inputs: [], gates: [gate] } } }));
    const env = { ...process.env, AIO_QA_MANIFEST_PATH: path, AIO_QA_CACHE_DIR: join(dir, 'cache'), GITHUB_ACTIONS: '' };
    delete env.AIO_QA_ORIGIN;
    if (origin) env.AIO_QA_ORIGIN = origin;
    const run = spawnSync(process.execPath, ['scripts/qa-runner.mjs', '--group', 'data', '--no-cache'], { cwd: root, env, encoding: 'utf8' });
    return { status: run.status, out: `${run.stdout}\n${run.stderr}` };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const failing = { id: 'live-content-fixture', script: 'scripts/ci-refresh-origin-live-data-check.mjs', args: ['--fixture-fail'] };
const oldCi = replay(failing, CI_ORIGIN);
const newCi = replay({ ...failing, liveData: 'content' }, CI_ORIGIN);
const newLocal = replay({ ...failing, liveData: 'content' }, null);
const defectCi = replay({ ...failing, id: 'source-defect-fixture' }, CI_ORIGIN);
check('v59.70 replay: old config fails the CI shard', oldCi.status === 1 && /\[qa\] FAIL live-content-fixture/.test(oldCi.out), oldCi.out.slice(-400));
check('v59.70 replay: new config passes the CI shard and reports ADVISORY', newCi.status === 0 && /\[qa\] ADVISORY live-content-fixture/.test(newCi.out) && /advisory=1/.test(newCi.out), newCi.out.slice(-400));
check('v59.70 replay: new config still fails locally (producer pre-push, watchdog)', newLocal.status === 1 && /\[qa\] FAIL live-content-fixture/.test(newLocal.out), newLocal.out.slice(-400));
check('v59.70 replay: a source-defect gate still fails the CI shard', defectCi.status === 1 && /\[qa\] FAIL source-defect-fixture/.test(defectCi.out), defectCi.out.slice(-400));

// 5. The calendar deadlock through the real knowledge-lint: a clock 300 days on makes documents stale. Old behaviour (any
// origin but CI) fails on P1125; in a CI contract shard the same tree passes with the ratchet as a warning.
const lint = (origin) => {
  const env = { ...process.env, AIO_KNOWLEDGE_LINT_NOW: new Date(Date.now() + 300 * 86400000).toISOString() };
  delete env.AIO_QA_ORIGIN;
  if (origin) env.AIO_QA_ORIGIN = origin;
  const run = spawnSync(process.execPath, ['scripts/ci-knowledge-lint-check.mjs'], { cwd: root, env, encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}\n${run.stderr}` };
};
const lintSource = lint(null);
const lintCi = lint(CI_ORIGIN);
check('v59.70 calendar replay: knowledge-lint fails on P1125 outside CI (watchdog twin, local)', lintSource.status === 1 && /Knowledge lint check failed:[\s\S]*P1125 stale document set does not grow/.test(lintSource.out), lintSource.out.slice(-400));
check('v59.70 calendar replay: the same tree passes in a CI shard with P1125 as a warning', lintCi.status === 0 && /Knowledge lint warnings:[\s\S]*P1125 stale document set does not grow/.test(lintCi.out), lintCi.out.slice(-400));

if (errors.length) {
  console.error('CI live-data check failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
const declared = gates.filter((gate) => gate.liveData).map((gate) => gate.id);
console.log(`CI live-data OK: ${gates.length} gates x 2 origins; ${declared.length} live-content gates report in CI (${declared.join(', ')}) with watchdog twins; knowledge-lint date ratchet warns in CI and blocks in its twin; ${LEDGER.length + SOURCE_PUSH_LEDGER.length} ledger causes resolved; replays: live old=red new=green local=red, source defect=red, calendar source=red ci=green.`);
