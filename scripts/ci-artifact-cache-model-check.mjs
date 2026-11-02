// v59.59 (formal inventory C3, 2026-11-02): bounded exhaustive model check of the browser artifact loader's forced
// refresh (src/data/artifact-cache.js loadJsonArtifact / clearArtifactCache). Every sequence of up to DEPTH events is
// replayed against a fresh fetch identity with a fake server whose file version the model can bump.
//
// Events: 읽기 (loadJsonArtifact, held copies allowed), 강제 읽기 (force: true, as company-profiles, shared-artifacts and
// us-listings call it), 수동 새로고침 (clearArtifactCache(fetch, { abortInFlight: false }) — bootstrap.js on aio:refresh:done
// with forceRefresh), 새 파일 게시 (the server's version goes up), 응답 (the oldest outstanding request is answered with
// the version that was current when it left).
// Invariant:
//   F1 fresh after refresh — a read that starts after a manual refresh never returns a copy that left the server before
//      that refresh (bootstrap.js v57.79: "a remounted tab reads the newly published files instead of the pre-refresh
//      copies"). `force` is not held to "left after the read started": its callers (company-profiles, shared-artifacts,
//      us-listings, atlas retry) use it to skip held copies, and joining a request already in flight is the documented
//      sharing (store.shared), not a promise the code makes.
//   F2 forced skips held copies — a forced read that finds no request in flight returns the version current at its start.
//
// KNOWN pins findings on the current code that are not fixed yet, by scene; the gate fails on any other violation and on
// a KNOWN entry that no longer occurs. Self-check: each VARIANT removes one guard and must produce a violation outside
// KNOWN. When covered code changes: re-read this header against it, update the events and variants, run, then `--sync`
// (commit the covered change first).
// Out of scope: integrity/maxBytes decoding, stall and timeout paths, LRU eviction, consumer abort, real network.
import { importVariant, verifyCoverage } from './lib/model-check-kit.mjs';
import * as cacheModule from '../src/data/artifact-cache.js';

const GATE = 'artifact-cache-model';
const MODULE = 'src/data/artifact-cache.js';
const DEPTH = Number(process.env.AIO_ARTIFACT_DEPTH || 6);
const URL = './public-data/screener-validation.json';
const EVENTS = ['읽기', '강제 읽기', '수동 새로고침', '새 파일 게시', '응답'];
const fail = (message) => { throw new Error(`[${GATE}] ${message}`); };
const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve)); };

// Finding 2026-11-02: clearArtifactCache({ abortInFlight: false }) empties the held copies but keeps requests already in
// flight; a read after the refresh joins such a request (store.inFlight is shared before `force` is looked at), and when
// it lands it is stored again for maxAgeMs. Low harm: the request left at most timeoutMs (15 s) before the refresh, so a
// stale copy needs a deploy inside that window.
const KNOWN = [{ invariant: 'F1', scene: 'request-in-flight-at-refresh' }];
const knownKey = (row) => `${row.invariant}|${row.scene}`;

const VARIANTS = [
  { label: '수동 새로고침이 보관 사본을 비우지 않음', replacements: [['if (!abortInFlight) { store?.resolved?.clear?.(); return; }', 'if (!abortInFlight) { return; }']] },
  { label: '강제 읽기가 보관 사본을 사용', replacements: [['if (!force && cached && Date.now() - cached.storedAt <= maxAgeMs) {', 'if (cached && Date.now() - cached.storedAt <= maxAgeMs) {']] }
];

async function replay(mod, trail) {
  let version = 1;
  const outstanding = [];
  const fetchFn = (url, { signal } = {}) => new Promise((resolve, reject) => {
    const departed = version;
    outstanding.push(() => resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ version: departed }) }));
    signal?.addEventListener?.('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
  let lastRefreshVersion = 0;
  let inFlightAtRefresh = false;
  const reads = [];
  for (const event of trail) {
    if (event === '읽기' || event === '강제 읽기') {
      const idle = mod.artifactCacheSnapshot(fetchFn).inFlight === 0;
      const read = { floor: lastRefreshVersion, forcedFloor: event === '강제 읽기' && idle ? version : 0, scene: inFlightAtRefresh ? 'request-in-flight-at-refresh' : 'other', value: null };
      reads.push(read);
      mod.loadJsonArtifact(fetchFn, URL, { maxAgeMs: 6 * 3600_000, timeoutMs: 3_600_000, force: event === '강제 읽기' }).then((value) => { read.value = value; }, () => {});
    } else if (event === '수동 새로고침') {
      inFlightAtRefresh = mod.artifactCacheSnapshot(fetchFn).inFlight > 0;
      lastRefreshVersion = version;
      mod.clearArtifactCache(fetchFn, { abortInFlight: false });
    } else if (event === '새 파일 게시') {
      version += 1;
    } else {
      const answer = outstanding.shift();
      if (answer) answer();
    }
    await flush();
  }
  // Answer whatever is left so every read settles, then judge each read.
  while (outstanding.length) { outstanding.shift()(); await flush(); }
  for (const read of reads) {
    if (!read.value) continue;
    if (read.value.version < read.floor) return { invariant: 'F1', scene: read.scene };
    if (read.value.version < read.forcedFloor) return { invariant: 'F2', scene: 'other' };
  }
  mod.clearArtifactCache(fetchFn);
  return null;
}

async function explore(mod) {
  const found = new Map();
  let sequences = 0;
  const walk = async (trail) => {
    if (trail.length) {
      sequences += 1;
      const result = await replay(mod, trail);
      if (result) {
        const key = knownKey(result);
        if (!found.has(key) || found.get(key).trail.length > trail.length) found.set(key, { ...result, trail: trail.slice() });
        return;
      }
    }
    if (trail.length >= DEPTH) return;
    for (const event of EVENTS) await walk([...trail, event]);
  };
  await walk([]);
  return { sequences, found };
}

const known = new Set(KNOWN.map(knownKey));
const current = await explore(cacheModule);
const unexpected = [...current.found.values()].filter((row) => !known.has(knownKey(row)));
if (unexpected.length) fail(`violations (shortest trail each):\n  ${unexpected.map((row) => `${row.invariant}/${row.scene}: ${row.trail.join(' → ')}`).join('\n  ')}`);
const gone = KNOWN.filter((row) => !current.found.has(knownKey(row)));
if (gone.length) fail(`KNOWN finding no longer occurs — delete it from KNOWN: ${gone.map(knownKey).join(', ')}`);

const variants = [];
for (const variant of VARIANTS) {
  const mod = await importVariant(MODULE, variant.replacements, variant.label);
  const result = await explore(mod);
  const broke = [...result.found.values()].filter((row) => !known.has(knownKey(row)));
  if (!broke.length) fail(`variant "${variant.label}" broke nothing: the model lost the power to fail`);
  variants.push({ label: variant.label, broke: broke.map((row) => row.trail.join(' → ')) });
}

const drift = verifyCoverage(GATE, [
  { module: MODULE, name: 'loadJsonArtifact', fn: cacheModule.loadJsonArtifact },
  { module: MODULE, name: 'clearArtifactCache', fn: cacheModule.clearArtifactCache }
], { sync: process.argv.includes('--sync') });
if (drift.length) fail(`covered code changed — re-read the model in this file's header against it, update it, then rerun with --sync:\n  ${drift.join('\n  ')}`);

console.log(JSON.stringify({ ok: true, gate: GATE, depth: DEPTH, sequences: current.sequences, known: [...current.found.values()].map((row) => ({ invariant: row.invariant, trail: row.trail.join(' → ') })), variants }));
