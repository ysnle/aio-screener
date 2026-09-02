import assert from 'node:assert/strict';
import { createRuntimeReaders } from '../src/data/runtime-readers.js';
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';
import { computeNewsSentimentScore } from '../src/domain/news/scoring.js';

const ids = [
  ['vix-price', 'vix', 18], ['vvix-price', 'vvix', 95], ['dxy-dollar', 'dxy', 104],
  ['tnx-yield', 'tnx', 4.1], ['oil-price', 'oilPrice', 80], ['fg-sentiment', 'fg', 55],
  ['spx-price', 'spxPrice', 5000], ['breadth200-participation', 'breadth200', 60],
  ['pcr-putcall', 'pcr', 0.9], ['hy-spread-bp', 'hyBp', 320]
];

function rows(status) {
  return ids.map(([id, , value]) => ({ id, value, source: status === 'verified_current' ? 'fixture-live' : 'DATA_SNAPSHOT', status, decisionUse: 'trading', observedAt: '2026-07-30T00:00:00.000Z' }));
}

const base = {
  DATA_SNAPSHOT: { spx: 5000, vix: 18, vvix: 95, dxy: 104, tnx: 4.1, wti: 80, fg: 55, pcr: 0.9, hySpread: 320 },
  _liveData: {},
  _spxMA: { 50: 4900, 200: 4600 },
  _spxMATs: Date.parse('2026-07-30T00:00:00.000Z'),
  _spxMASource: 'fixture-live-ma',
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
  _liveData: { '^VIX': { price: 20, source: 'snapshot:fixture', observedAt: '2026-08-01' } }
};
const fallbackReader = createRuntimeReaders({ root: fallbackRoot });
const sentimentFallback = fallbackReader.readSentiment();
assert.equal(sentimentFallback.fearGreed, 42);
assert.equal(sentimentFallback.fearGreedSource, 'DATA_SNAPSHOT:fear-greed');
assert.equal(sentimentFallback.fearGreedObservedAt, '2026-08-01');
assert.equal(sentimentFallback.putCall, 0.8);
assert.equal(sentimentFallback.putCallObservedAt, '2026-08-01');
assert.equal(fallbackReader.readEntity().options.vix.sourceKind, 'snapshot');
assert.equal(fallbackReader.readObservationCatalog()['sentiment.fearGreed'].observedAt, '2026-08-01');
fallbackRoot._lastPutCallPayload = { totalPutCall: 0, source: 'current-pcr', asOf: '2026-08-31' };
fallbackRoot.AIO.getCanonicalMetric = () => ({ value: 0, source: 'current-fg', observedAt: '2026-08-31' });
assert.equal(fallbackReader.readSentiment().fearGreed, 0);
assert.equal(fallbackReader.readSentiment().fearGreedSource, 'current-fg');
assert.equal(fallbackReader.readEntity().options.pcr.value, 0);
assert.equal(fallbackReader.readEntity().options.pcr.source, 'current-pcr');
fallbackRoot.AIO.getCanonicalMetric = () => { throw new Error('fixture canonical reader failure'); };
assert.equal(fallbackReader.readSentiment().fearGreed, 42, 'optional canonical reader failure must preserve the snapshot fallback');
console.log(JSON.stringify({ ok: true, snapshotTotal: blocked.total, snapshotDecisionBlocked: blocked.decisionBlocked, liveTotal: liveScore.total, undatedNewsTotal: undatedNews.total, evidenceKeys: Object.keys(liveInput.decisionEvidence), atomicFallback: true }));
