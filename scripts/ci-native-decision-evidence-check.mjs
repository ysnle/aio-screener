import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRuntimeReaders, buildRuntimeObservationCatalog } from '../src/data/runtime-readers.js';
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';
import { computeNewsSentimentScore } from '../src/domain/news/scoring.js';

const ids = [
  ['vix-price', 'vix', 18], ['vvix-price', 'vvix', 95], ['dxy-dollar', 'dxy', 104],
  ['tnx-yield', 'tnx', 4.1], ['oil-price', 'oilPrice', 80], ['fg-sentiment', 'fg', 55],
  ['spx-price', 'spxPrice', 5000], ['breadth200-participation', 'breadth200', 60],
  ['pcr-putcall', 'pcr', 0.9], ['hy-spread-bp', 'hyBp', 320]
];

function rows(status) {
  const decision = status === 'verified_current';
  const quality = decision
    ? { status: 'CURRENT', stale: false, blocked: false, maxAgeMs: 6 * 60 * 60 * 1000 }
    : { status: 'SNAPSHOT', stale: true, blocked: true };
  return ids.map(([id, , value]) => ({
    id,
    value,
    source: decision ? 'fixture-live' : 'DATA_SNAPSHOT',
    sourceKind: decision ? 'T1_OFFICIAL' : 'T4_REFERENCE',
    status,
    decisionUse: 'trading',
    allowedUse: decision ? 'decision' : 'reference',
    allowedUseCeiling: decision ? 'decision' : 'reference',
    rightsId: decision ? 'FIXTURE-RIGHTS-V1' : 'FIXTURE-REFERENCE-V1',
    revisionId: decision ? 'fixture-revision-v1' : 'fixture-snapshot-v1',
    quality,
    freshnessMs: 6 * 60 * 60 * 1000,
    observedAt: '2026-07-30T00:00:00.000Z'
  }));
}

const base = {
  DATA_SNAPSHOT: { spx: 5000, vix: 18, vvix: 95, dxy: 104, tnx: 4.1, wti: 80, fg: 55, pcr: 0.9, hySpread: 320 },
  _liveData: {},
  _spxMA: { 50: 4900, 200: 4600 },
  _spxMATs: Date.parse('2026-07-30T00:00:00.000Z'),
  _spxMASource: 'fixture-live-ma',
  _spxMAEvidence: {
    spx50ma: {
      value: 4900,
      source: 'fixture-live-ma',
      sourceKind: 'T1_OFFICIAL',
      status: 'verified_current',
      allowedUse: 'decision',
      allowedUseCeiling: 'decision',
      rightsId: 'FIXTURE-RIGHTS-V1',
      revisionId: 'fixture-ma-revision-v1',
      quality: { status: 'CURRENT', stale: false, blocked: false, maxAgeMs: 6 * 60 * 60 * 1000 },
      freshnessMs: 6 * 60 * 60 * 1000,
      observedAt: '2026-07-30T00:00:00.000Z'
    },
    spx200ma: {
      value: 4600,
      source: 'fixture-live-ma',
      sourceKind: 'T1_OFFICIAL',
      status: 'verified_current',
      allowedUse: 'decision',
      allowedUseCeiling: 'decision',
      rightsId: 'FIXTURE-RIGHTS-V1',
      revisionId: 'fixture-ma-revision-v1',
      quality: { status: 'CURRENT', stale: false, blocked: false, maxAgeMs: 6 * 60 * 60 * 1000 },
      freshnessMs: 6 * 60 * 60 * 1000,
      observedAt: '2026-07-30T00:00:00.000Z'
    }
  },
  AIO: { getTradingDecisionInputEvidence: () => ({ rows: rows('snapshot_reference') }) }
};
const readers = createRuntimeReaders({ root: base, now: () => Date.parse('2026-07-30T00:00:00.000Z') });
const snapshotInput = readers.readAnalysis().tradingScoreInputs;
const blocked = computeTradingScoreModel(snapshotInput);
assert.equal(blocked.total, null, 'snapshot/reference values must block native score');
assert.equal(blocked.decisionBlocked, true, 'snapshot/reference values must set decisionBlocked');
assert.ok(Object.values(snapshotInput.decisionEvidence).some((row) => row.status === 'snapshot_reference' && row.allowedUse !== 'decision'));

const liveRoot = {
  ...base,
  AIO: { getTradingDecisionInputEvidence: () => ({ rows: rows('verified_current') }) },
  _liveData: {
    '^GSPC': { price: 5000, ts: '2026-07-30T00:00:00.000Z' },
    '^VIX': { price: 18, ts: '2026-07-30T00:00:00.000Z' },
    '^VVIX': { price: 95, ts: '2026-07-30T00:00:00.000Z' },
    'DX-Y.NYB': { price: 104, ts: '2026-07-30T00:00:00.000Z' },
    '^TNX': { price: 4.1, ts: '2026-07-30T00:00:00.000Z' },
    'CL=F': { price: 80, ts: '2026-07-30T00:00:00.000Z' }
  }
};
const liveInput = createRuntimeReaders({ root: liveRoot, now: () => Date.parse('2026-07-30T00:00:00.000Z') }).readAnalysis().tradingScoreInputs;
const liveScore = computeTradingScoreModel(liveInput);
assert.notEqual(liveScore.total, null, 'verified-current evidence should permit a complete score');
assert.equal(liveScore.decisionBlocked, false);
assert.equal(liveScore.componentMissing.length, 0);

const undatedNews = computeNewsSentimentScore({
  now: Date.parse('2026-07-30T00:00:00.000Z'),
  items: [{ title: 'stocks surge', desc: '', source: 'fixture-without-date' }]
});
assert.equal(undatedNews.total, 0, 'undated news must not enter freshness-scoped sentiment');
assert.equal(undatedNews.label, '데이터 부족');

const fallbackRoot = {
  AIO: { getCanonicalMetric: () => ({ value: null, source: 'empty-canonical', observedAt: '2026-08-31' }) },
  DATA_SNAPSHOT: { fg: 42, pcr: 0.8, _snapshotDate: '2026-08-01' },
  _lastPutCallPayload: { totalPutCall: null, source: 'empty-pcr', asOf: '2026-08-31' },
  _liveData: { '^VIX': { price: 20, source: 'snapshot:fixture', sourceKind: 'T4_REFERENCE', observedAt: '2026-08-01' } }
};
const fallbackReader = createRuntimeReaders({ root: fallbackRoot });
const sentimentFallback = fallbackReader.readSentiment();
assert.equal(sentimentFallback.fearGreed, 42);
assert.equal(sentimentFallback.fearGreedSource, 'DATA_SNAPSHOT:fear-greed');
assert.equal(sentimentFallback.fearGreedObservedAt, '2026-08-01');
assert.equal(sentimentFallback.putCall, 0.8);
assert.equal(sentimentFallback.putCallObservedAt, '2026-08-01');
assert.equal(fallbackReader.readEntity().options.vix.sourceKind, 'T4_REFERENCE');
assert.equal(fallbackReader.readObservationCatalog()['sentiment.fearGreed'].observedAt, '2026-08-01');
fallbackRoot._lastPutCallPayload = { totalPutCall: 0, source: 'current-pcr', asOf: '2026-08-31' };
fallbackRoot.AIO.getCanonicalMetric = () => ({ value: 0, source: 'current-fg', observedAt: '2026-08-31' });
assert.equal(fallbackReader.readSentiment().fearGreed, 0);
assert.equal(fallbackReader.readSentiment().fearGreedSource, 'current-fg');
assert.equal(fallbackReader.readEntity().options.pcr.value, 0);
assert.equal(fallbackReader.readEntity().options.pcr.source, 'current-pcr');
fallbackRoot.AIO.getCanonicalMetric = () => { throw new Error('fixture canonical reader failure'); };
assert.equal(fallbackReader.readSentiment().fearGreed, 42, 'optional canonical reader failure must preserve the snapshot fallback');

const coreSource = fs.readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
const coreContext = vm.createContext({
  window: { AIO_SOURCE_KIND: { LIVE: 'LIVE', DELAYED: 'DELAYED', SNAPSHOT: 'SNAPSHOT', REFERENCE: 'REFERENCE', UNAVAILABLE: 'UNAVAILABLE' } },
  Date, Number, Object, String, RegExp, Math, isFinite
});
const freshnessStart = coreSource.indexOf('var FRESHNESS_POLICY =');
const freshnessEnd = coreSource.indexOf('function makeMetric(', freshnessStart);
const decisionStart = coreSource.indexOf('function _aioStrictFinite(');
const decisionEnd = coreSource.indexOf('function _aioMergeSourceKind(', decisionStart);
assert.ok(freshnessStart >= 0 && freshnessEnd > freshnessStart && decisionStart >= 0 && decisionEnd > decisionStart);
vm.runInContext(coreSource.slice(freshnessStart, freshnessEnd), coreContext);
vm.runInContext(coreSource.slice(decisionStart, decisionEnd), coreContext);
const decisionNow = Date.now();
const evaluateLegacyEnvelope = (ts, allowedUse, sourceKind = 'live') => vm.runInContext(`_aioDecisionMetricEnvelope(18, ${JSON.stringify(sourceKind)}, 'fixture-provider', ${JSON.stringify(ts)}, { policyKey:'quote' }, ${JSON.stringify(allowedUse)})`, coreContext);
assert.equal(evaluateLegacyEnvelope(decisionNow, 'decision').allowedUse, true, 'current operational evidence with an explicit decision grant remains usable');
assert.equal(evaluateLegacyEnvelope(decisionNow, null).allowedUse, false, 'a recent raw number without an explicit decision grant must fail closed');
assert.equal(evaluateLegacyEnvelope(null, 'decision').allowedUse, false, 'an undated operational number must fail closed');
assert.equal(evaluateLegacyEnvelope(decisionNow - 60 * 60 * 1000, 'decision').allowedUse, false, 'a stale quote must fail closed even when a shallow quality object exists');
assert.equal(evaluateLegacyEnvelope(decisionNow, 'decision', 'snapshot').allowedUse, false, 'snapshot evidence cannot become a current decision input');
console.log(JSON.stringify({ ok: true, snapshotTotal: blocked.total, snapshotDecisionBlocked: blocked.decisionBlocked, liveTotal: liveScore.total, undatedNewsTotal: undatedNews.total, evidenceKeys: Object.keys(liveInput.decisionEvidence), atomicFallback: true }));

// Repeated snapshot timestamps should cost one parse per distinct timestamp,
// while freshness boundaries and duplicate-field precedence stay unchanged.
const coverageNow = Date.parse('2026-09-05T00:00:00Z');
const observed = '2026-09-03T00:00:00Z';
const field = (observedAt, value = 0) => ({ fieldId: 'news.latest', observedAt, fetchedAt: '2026-09-05T00:00:00Z', value });
const newsCoverage = (rows) => buildRuntimeObservationCatalog({ root: {}, state: { screener: { rows } }, now: coverageNow })['screener.newsCoverage'];
const parseDate = Date.parse;
let repeatedParses = 0;
try {
  Date.parse = (value) => { if (value === observed) repeatedParses++; return parseDate(value); };
  const result = newsCoverage(Array.from({ length: 1024 }, () => ({ fieldObservations: [field(observed)] })));
  assert.equal(result.value, 1);
  assert.equal(result.observedAt, '2026-09-03T00:00:00.000Z');
  assert.equal(result.fetchedAt, '2026-09-05T00:00:00.000Z');
  assert.ok(repeatedParses <= 2, 'repeated timestamps must not be reparsed for every field/row');
} finally { Date.parse = parseDate; }
const coverageEdges = newsCoverage([
  { fieldObservations: [field('2026-09-02T23:59:59.999Z')] },
  { fieldObservations: [field('2026-09-05T00:00:00.001Z')] },
  { fieldObservations: [field('invalid')] },
  { fieldObservations: [field(observed, null)] },
  { fieldObservations: [field('invalid'), field(observed)] }
]);
assert.deepEqual(coverageEdges.coverage, { current: 0.2, present: 0.6, expected: 5, currentCount: 1, observedCount: 3 });
assert.equal(newsCoverage([]).observedAt, null);
console.log('Screener observation coverage: freshness/duplicate parity and bounded timestamp parsing OK.');

// P1035: cached canonical rows must avoid rescans without concealing clock
// boundaries, rollback, newly published rows, or mutable legacy inputs.
let cacheClock = coverageNow;
let rowReads = 0;
const cacheRows = [{ get fieldObservations() { rowReads++; return [field(observed)]; } }];
const cacheState = { screener: { rows: cacheRows } };
const cachedReader = createRuntimeReaders({ root: {}, now: () => cacheClock });
const readCached = () => cachedReader.readObservationCatalog(cacheState)['screener.newsCoverage'];
assert.equal(readCached().value, 1);
const firstReads = rowReads;
assert.equal(readCached().value, 1);
assert.equal(rowReads, firstReads, 'unchanged canonical rows must not be scanned again');
cacheClock++;
assert.equal(readCached().value, 0, 'inclusive freshness boundary must expire on next millisecond');
cacheClock = coverageNow - 1;
assert.equal(readCached().value, 1, 'clock rollback must recompute');
cacheState.screener = { rows: [{ fieldObservations: [field(new Date(coverageNow + 1).toISOString())] }] };
cacheClock = coverageNow;
assert.equal(readCached().value, 0, 'future observation must not be current early');
cacheClock++;
assert.equal(readCached().value, 1, 'future observation must become current exactly on time');
cacheState.screener = { rows: [] };
assert.equal(readCached().coverage.expected, 0, 'replacement rows must invalidate cache');
const mutableRows = [{ fieldObservations: [field(observed)] }];
assert.equal(newsCoverage(mutableRows).value, 1);
mutableRows[0].fieldObservations = [];
assert.equal(newsCoverage(mutableRows).value, 0, 'standalone mutable input must remain uncached');
console.log('Canonical observation cache: no rescans, expiry/future/rollback/replacement parity OK.');
