// Per-plane collection receipts (P1256, split out of fetch-data.mjs main in the pipeline redesign, 2026-10-19).
// An exit code or generatedAt is not a successful collection: whether this batch refreshed a domain and whether the
// previous eligible value is still published are separate axes, and build-operations-status turns that distinction
// into reader language. Freshness comes from the source plane registry (planeFresh), not from local status lists.
import { buildDomainReceipt } from '../lib/domain-receipt.mjs';
import { NEWS_FEEDS } from '../lib/news-selection.mjs';
import { planeFresh } from './source-planes.mjs';

export function buildDomainReceipts({ previousMeta, attemptedAt, generatedAt, symbolCount, quotes, failed, news, previousNews,
  fredSeriesIds, fredFetchedKeys, fredFailedSeries, planes }) {
  const { bls, bea, treasury, aaii, putCall } = planes;
  const priorReceipts = (previousMeta && previousMeta.domainReceipts) || {};
  const receiptRunId = `fetch-data:${attemptedAt}`;
  const planeReceipt = (domain, { eligible, attempted, updated, stored, failures = [], note }) => buildDomainReceipt({
    domain,
    runId: receiptRunId,
    attemptedAt,
    sourceRevision: null,
    inputWatermarks: { generatedAt },
    eligible,
    attempted,
    updated,
    stored,
    failures,
    priorReceipt: priorReceipts[domain] || null,
    basisNote: note || 'per-plane independent collection; retained eligible values stay published while a failed refresh keeps the previous artifact'
  });
  const failure = (symbol) => [{ symbol, status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }];
  const newsFellBack = Array.isArray(previousNews) && news === previousNews;
  const blsSeriesIds = Object.keys((bls && bls.series) || {});
  const blsMetricFailures = bls && Array.isArray(bls.failures) ? bls.failures.filter((row) => row && row.metricId && row.metricId !== 'batch').length : 0;
  const blsFresh = planeFresh('bls', bls);
  const beaFresh = planeFresh('bea', bea);
  const treasuryFresh = planeFresh('treasury', treasury);
  const aaiiFresh = planeFresh('aaii', aaii);
  const putCallFresh = planeFresh('putCall', putCall);
  return {
    'market-quotes': planeReceipt('market-quotes', {
      eligible: symbolCount, attempted: symbolCount, updated: quotes.length, stored: quotes.length,
      failures: failed.map((symbol) => ({ symbol, status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    news: planeReceipt('news', {
      eligible: NEWS_FEEDS.length, attempted: NEWS_FEEDS.length,
      updated: newsFellBack ? 0 : (Array.isArray(news) ? news.length - (news.carriedCount || 0) : 0),
      stored: Array.isArray(news) ? news.length : 0,
      failures: newsFellBack ? failure('news-plane') : []
    }),
    'macro-fred': planeReceipt('macro-fred', {
      eligible: fredSeriesIds.length, attempted: fredSeriesIds.length,
      updated: fredFetchedKeys.length, stored: fredSeriesIds.length,
      failures: fredFailedSeries.map((id) => ({ symbol: id, status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    'macro-bls': planeReceipt('macro-bls', {
      eligible: blsSeriesIds.length + blsMetricFailures,
      attempted: blsSeriesIds.length + blsMetricFailures,
      updated: blsFresh ? blsSeriesIds.length : 0,
      stored: blsSeriesIds.length,
      failures: (bls && Array.isArray(bls.failures) ? bls.failures : []).map((row) => ({ symbol: row.metricId || 'batch', status: 'TRANSIENT_PROVIDER_FAILURE', attemptedAt }))
    }),
    'macro-bea': planeReceipt('macro-bea', {
      eligible: 1, attempted: 1, updated: beaFresh ? 1 : 0,
      stored: (beaFresh || (bea && bea.status === 'last-known-good')) ? 1 : 0,
      failures: beaFresh ? [] : failure('bea-pce')
    }),
    'treasury-curve': planeReceipt('treasury-curve', {
      eligible: 1, attempted: 1, updated: treasuryFresh ? 1 : 0,
      stored: (treasuryFresh || (treasury && treasury.status === 'stale')) ? 1 : 0,
      failures: treasuryFresh ? [] : failure('treasury-yield-curve')
    }),
    'surveys-aaii': planeReceipt('surveys-aaii', {
      eligible: 1, attempted: 1, updated: aaiiFresh ? 1 : 0,
      stored: (aaiiFresh || (aaii && aaii.observedAt)) ? 1 : 0,
      failures: aaiiFresh ? [] : failure('aaii-sentiment')
    }),
    'options-put-call': planeReceipt('options-put-call', {
      eligible: 1, attempted: 1, updated: putCallFresh ? 1 : 0,
      stored: (putCallFresh || (putCall && Number.isFinite(Number(putCall.totalPutCall)))) ? 1 : 0,
      failures: putCallFresh ? [] : failure('cboe-put-call')
    })
  };
}
