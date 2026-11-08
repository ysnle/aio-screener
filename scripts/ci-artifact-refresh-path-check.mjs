#!/usr/bin/env node
// v59.70 (owner 2026-11-04: "is everything on every screen refreshed automatically?"): every public-data artifact a
// screen reads must have a refresh path — a registered producer and workflow that stages it (src/data/contracts/
// artifact-freshness.js ARTIFACT_FRESHNESS) or a hand-kept file dated by a named expiry gate (MANUAL_ARTIFACTS). Each
// producing workflow writes its freshness ledger before its validation gates, and the registry's stale bound is the
// lineage audit's bound. An exhaustive fixture pins the ledger writer's verdict for every written/unchanged combination.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACT_FRESHNESS, MANUAL_ARTIFACTS, freshnessLedgerPath, freshnessState, livenessState, sessionLagState, artifactContractDrift } from '../src/data/contracts/artifact-freshness.js';
import { workflowPublishes } from './lib/data-publish-sets.mjs';
import { buildLedger } from './write-freshness-ledger.mjs';
import { readArtifactFreshness } from '../src/data/freshness.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const errors = [];
const check = (label, ok, detail = '') => { if (!ok) errors.push(`${label}${detail ? `: ${detail}` : ''}`); };

// 1. Runtime readers: src/**, js/* (tests excluded), index.html, sw.js.
const runtimeFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.js')) runtimeFiles.push(rel);
  }
};
walk('src');
for (const name of readdirSync(join(root, 'js'))) if (name.endsWith('.js') && name !== 'aio-tests.js') runtimeFiles.push(`js/${name}`);
runtimeFiles.push('index.html', 'sw.js');
const readers = new Map();
for (const file of runtimeFiles) {
  for (const match of read(file).matchAll(/public-data\/([a-z0-9][a-z0-9-]*\.json)/g)) {
    if (!readers.has(match[1])) readers.set(match[1], new Set());
    readers.get(match[1]).add(file);
  }
}
check('v59.70 the runtime reader scan finds the core artifacts', ['data.json', 'history.json', 'screener.json', 'scenario-state.json'].every((name) => readers.has(name)), [...readers.keys()].join(' '));
for (const [name, files] of readers) {
  // A name the runtime builds but that is not a top-level artifact (masters/, knowledge/ families) never matches here.
  if (!existsSync(join(root, 'public-data', name))) continue;
  check(`v59.70 ${name} (read by ${[...files].slice(0, 2).join(', ')}) has a refresh path`, Boolean(ARTIFACT_FRESHNESS[name] || MANUAL_ARTIFACTS[name]), 'add it to ARTIFACT_FRESHNESS (producer + workflow) or MANUAL_ARTIFACTS (expiry gate)');
}

// 2. Each automatic artifact: the producer exists, its workflow stages the file, and the stale bound is the lineage audit's.
const lineage = read('scripts/ci-data-lineage-audit.mjs');
const lineageMaxHours = (name) => {
  const line = lineage.split('\n').find((row) => row.includes(`'${name}': {`));
  const expr = line?.match(/maxAgeHours:\s*([\d\s*]+)/)?.[1];
  return expr ? expr.split('*').reduce((product, part) => product * Number(part.trim()), 1) : null;
};
const workflowText = {};
for (const [name, spec] of Object.entries(ARTIFACT_FRESHNESS)) {
  check(`v59.70 ${name} producer exists`, existsSync(join(root, spec.producer)), spec.producer);
  const workflowPath = `.github/workflows/${spec.workflow}`;
  if (!existsSync(join(root, workflowPath))) { check(`v59.70 ${name} workflow exists`, false, workflowPath); continue; }
  const text = (workflowText[spec.workflow] ||= read(workflowPath));
  // v59.85: the publish set is the staged-path contract (scripts/lib/data-publish-sets.mjs), not the workflow text.
  check(`v59.70 ${spec.workflow} stages public-data/${name}`, workflowPublishes(spec.workflow, `public-data/${name}`), 'add it to the workflow\'s set in scripts/lib/data-publish-sets.mjs');
  const hours = lineageMaxHours(name);
  check(`v59.70 ${name} staleAfterMinutes equals the lineage audit bound`, hours != null && hours * 60 === spec.staleAfterMinutes, `registry=${spec.staleAfterMinutes}m lineage=${hours == null ? 'missing' : `${hours * 60}m`}`);
  check(`v59.70 ${name} cadence is shorter than its stale bound`, spec.expectedEveryMinutes > 0 && spec.expectedEveryMinutes < spec.staleAfterMinutes);
}
for (const [name, spec] of Object.entries(MANUAL_ARTIFACTS)) {
  check(`v59.70 hand-kept ${name} is dated by the lineage audit`, lineage.includes(`'${name}': {`), spec.expiryGate);
}

// 3. Each ledger workflow writes its ledger before it records the validated candidate, and stages it.
for (const workflow of new Set(Object.values(ARTIFACT_FRESHNESS).filter((spec) => spec.ledger !== false).map((spec) => spec.workflow))) {
  const text = workflowText[workflow] || read(`.github/workflows/${workflow}`);
  const ledgerAt = text.indexOf(`write-freshness-ledger.mjs --workflow ${workflow}`);
  const recordAt = text.indexOf('verify-refresh-candidate.mjs --record');
  const markAt = text.indexOf('AIO_RUN_STARTED_AT=');
  check(`v59.70 ${workflow} marks the run start before its producers`, markAt > 0 && markAt < ledgerAt);
  check(`v59.70 ${workflow} writes its freshness ledger before recording the validated candidate`, ledgerAt > 0 && recordAt > ledgerAt);
  check(`v59.70 ${workflow} stages its freshness ledger`, workflowPublishes(workflow, freshnessLedgerPath(workflow)));
}

// 4. Exhaustive ledger fixture: written x skipUnchanged x same-except-volatile.
for (const written of [true, false]) for (const skip of [true, false]) for (const same of [true, false]) {
  const file = skip ? 'scenario-state.json' : 'data.json';
  const ownClock = skip ? { generatedAt: '2026-11-04T00:30:00.000Z', v: same ? 1 : 2 } : { meta: { generatedAt: '2026-11-04T00:30:00.000Z' }, v: same ? 1 : 2 };
  const head = skip ? { generatedAt: '2026-11-03T00:00:00.000Z', v: 1 } : { meta: { generatedAt: '2026-11-03T00:00:00.000Z' }, v: 1 };
  const restored = [];
  const ledger = buildLedger({
    workflow: 'refresh-data.yml', runStartedMs: 0, nowIso: '2026-11-04T00:31:00.000Z',
    previous: { artifacts: { [file]: { checkedAt: '2026-11-03T23:00:00.000Z' } } },
    readArtifact: (name) => (name === file ? { payload: ownClock } : null),
    wasWritten: () => written,
    headArtifact: () => ({ bytes: Buffer.from(JSON.stringify(head)), payload: head }),
    writeArtifact: (name) => restored.push(name),
  });
  const row = ledger.artifacts[file];
  const expectStatus = !written ? 'not-written' : skip && same ? 'unchanged' : 'updated';
  const expectChecked = written ? '2026-11-04T00:31:00.000Z' : '2026-11-03T23:00:00.000Z';
  check(`v59.70 ledger fixture written=${written} skipUnchanged=${skip} same=${same}`,
    row.lastAttempt.status === expectStatus && row.checkedAt === expectChecked && (restored.length === 1) === (expectStatus === 'unchanged'),
    JSON.stringify({ status: row.lastAttempt.status, checkedAt: row.checkedAt, restored }));
}
const now = Date.parse('2026-11-04T12:00:00Z');
const grade = (minutesAgo, every = 30, staleAfter = 720) => freshnessState({ checkedAt: new Date(now - minutesAgo * 60000).toISOString(), expectedEveryMinutes: every, staleAfterMinutes: staleAfter }, now);
check('v59.70 freshnessState grades current, late, stale and unknown', grade(10) === 'current' && grade(90) === 'late' && grade(800) === 'stale' && freshnessState({}, now) === 'unknown');
// The screens' reader grades the same row the same way, and a missing secret reads as blocked, not stale.
const fakeRoot = {
  _aioFreshness_refresh_data_yml: { artifacts: { 'data.json': { checkedAt: new Date(now - 10 * 60000).toISOString(), expectedEveryMinutes: 30, staleAfterMinutes: 720 } } },
  _aioFreshness_refresh_screener_yml: { artifacts: { 'kr-fundamentals.json': { checkedAt: '2026-10-20T23:51:53.027Z', expectedEveryMinutes: 10080, staleAfterMinutes: 20160 } } },
};
check('v59.70 readArtifactFreshness reads the workflow ledger the watchdog reads',
  readArtifactFreshness('data.json', { root: fakeRoot, now }).state === 'current'
  && readArtifactFreshness('kr-fundamentals.json', { root: fakeRoot, now }).state === 'blocked'
  && readArtifactFreshness('kr-investor-flows.json', { root: fakeRoot, now }).blockedBy === null
  && readArtifactFreshness('event-briefs.json', { root: fakeRoot, now }).state === 'unknown'
  && readArtifactFreshness('not-registered.json', { root: fakeRoot, now }).state === 'unknown');

// 5. v59.85: content currency. The grade is the worse of liveness (checkedAt) and session lag (basisSession), so a file
// the pipeline rewrites every cycle with a two-sessions-old basis is not 'current'.
{
  const tue = Date.parse('2026-11-10T14:00:00Z'); // Tue 09:00 New York, US session 11/10 open; latest completed US 11/09
  const row = (basis, minutesAgo = 5) => ({ checkedAt: new Date(tue - minutesAgo * 60000).toISOString(), expectedEveryMinutes: 360, staleAfterMinutes: 2880, basisSession: basis });
  check('v59.85 session lag 0 is current', freshnessState(row({ US: '2026-11-09' }), tue) === 'current');
  check('v59.85 session lag 1 inside 12 h of the latest close is current', freshnessState(row({ US: '2026-11-06' }), Date.parse('2026-11-10T02:00:00Z')) === 'current');
  check('v59.85 session lag 1 past the 12 h grace is late even when just checked', freshnessState(row({ US: '2026-11-06' }), tue) === 'late' && livenessState(row({ US: '2026-11-06' }), tue) === 'current');
  check('v59.85 session lag 2 is stale even when just checked', freshnessState(row({ US: '2026-11-05' }), tue) === 'stale' && sessionLagState(row({ US: '2026-11-05' }), tue).lagByMarket.US === 2);
  check('v59.85 the worse market decides', freshnessState(row({ US: '2026-11-09', KR: '2026-11-05' }), tue) === 'stale');
  check('v59.85 a weekend does not age a Friday basis', freshnessState(row({ US: '2026-11-06', KR: '2026-11-06' }), Date.parse('2026-11-08T14:00:00Z')) === 'current');
  check('v59.85 an undatable row stays unknown', freshnessState({ basisSession: { US: '2026-11-09' } }, tue) === 'unknown');
  check('v59.85 contract drift names an unresolved clock and basis', JSON.stringify(artifactContractDrift('history.json', { rows: [{ date: '2026-11-08' }] })) === JSON.stringify(['basis:US', 'basis:KR'])
    && JSON.stringify(artifactContractDrift('history.json', [{ date: '2026-11-08' }])) === JSON.stringify(['clock', 'basis:US', 'basis:KR']));
}

if (errors.length) {
  console.error('Artifact refresh path check failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Artifact refresh path OK: ${readers.size} runtime-read artifact names, ${Object.keys(ARTIFACT_FRESHNESS).length} automatic and ${Object.keys(MANUAL_ARTIFACTS).length} hand-kept registered; ledgers written before each candidate record.`);
