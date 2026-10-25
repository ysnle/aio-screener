// Source plane registry (pipeline redesign, 2026-10-19). Every independently collected source of data.json is declared
// once here: how it is collected, what the run publishes when that collection throws, and which provider statuses
// count as a fresh collection. fetch-data.mjs used to read twelve Promise.allSettled results by array position, and
// each consumer (the receipts, the meta block) restated its own status list, so a reader that changed its success
// status (AAII 'current-reference', 10/19) was reported as a failed collection on every run. Consumers now ask
// planeFresh() instead of listing statuses.
import { FRED_SERIES, fetchAaiiSentiment, fetchBeaPce, fetchBlsSeries, fetchCboePutCall, fetchFearGreed, fetchFredDexkousPublic, fetchFredHyOasPublic, fetchTreasuryYieldCurve } from '../lib/macro-sources.mjs';
import { fetchNews } from '../lib/news-selection.mjs';
import { SYMBOLS, fetchQuote, mapLimit, fetchCoinGeckoCrossCheck } from './quotes.mjs';
import { fetchFred } from './fred.mjs';

// Provider statuses that mean "this run collected the value" (not a carried last-known-good copy).
export const FRESH_STATUSES = Object.freeze({
  bls: Object.freeze(['ok', 'cached-fresh', 'partial']),
  bea: Object.freeze(['ok', 'cached-fresh']),
  treasury: Object.freeze(['ok', 'cached-fresh']),
  fredHyOas: Object.freeze(['ok', 'cached-fresh']),
  // 2026-10-19: the AAII reader's success status is current-reference.
  aaii: Object.freeze(['ok', 'cached-fresh', 'current-reference'])
});

export function planeFresh(id, value) {
  // v58.77 (pass-2 P2-DATA-06): a retained Cboe value keeps its old fetchedAt and carries failureReason; it is not this
  // run's collection, so the receipt must not count it as updated.
  if (id === 'putCall') return !!(value && !value.error && !value.failureReason && value.fetchedAt);
  const statuses = FRESH_STATUSES[id];
  return !!(statuses && value && statuses.includes(value.status));
}

// The previous published data.json is the last-known-good store for every plane that keeps one.
export function readPreviousPlanes(previous) {
  const macro = previous && previous.macro || null;
  return {
    meta: previous && previous.meta || null,
    macro,
    bls: macro && macro._bls || null,
    bea: macro && macro._bea || null,
    treasury: macro && macro._treasury || null,
    fredHyOas: macro && macro._fredHyOas || null,
    // P1246: the FX cross-check record keeps the official source record verbatim, so the next run reuses it as
    // `previous` for the 12-hour cache (lineage continues without a separate artifact).
    fredDexkous: previous && previous.providerCrossChecks && previous.providerCrossChecks.fx && previous.providerCrossChecks.fx.official || null,
    marketSurveys: previous && previous.marketSurveys || null,
    fearGreed: previous && previous.fearGreed || null,
    putCall: previous && previous.putCall || null,
    news: previous && Array.isArray(previous.news) ? previous.news : null
  };
}

// Keep each source plane independently observable. A single unexpected provider exception must not abort the other
// free-source collectors or turn a complete cycle into an unlabelled empty artifact.
export function sourcePlanes({ prior, attemptedAt, env = process.env, blsReleaseSchedules = null }) {
  const unavailable = { attemptedAt, fetchedAt: null };
  return [
    { id: 'quotes', label: 'quote', run: () => mapLimit(SYMBOLS, 6, fetchQuote),
      fallback: () => SYMBOLS.map((symbol) => ({ __error: true, item: symbol, msg: 'quote-plane-failed' })) },
    { id: 'fred', label: 'FRED', run: () => fetchFred(env.FRED_API_KEY),
      fallback: () => ({ _source: 'fred:unavailable', _attemptedAt: attemptedAt, _successfulSeries: [], _failedSeries: Object.keys(FRED_SERIES), _failureReason: 'fred-plane-failed' }) },
    { id: 'fearGreed', label: 'Fear & Greed', run: () => fetchFearGreed(prior.fearGreed),
      fallback: () => ({
        ...(prior.fearGreed && typeof prior.fearGreed === 'object' ? prior.fearGreed : {}),
        _source: prior.fearGreed?.score != null ? 'cnn:last-known-good' : 'cnn:unavailable',
        status: prior.fearGreed?.score != null ? 'stale-reference' : 'unavailable',
        attemptedAt, fetchedAt: null, failureReason: 'fear-greed-plane-failed'
      }) },
    // 2026-10-19: same-cycle articles stay candidates (carriedNewsCandidates).
    { id: 'news', label: 'news', run: () => fetchNews(Date.parse(attemptedAt), { carry: prior.news }),
      fallback: () => (prior.news && prior.news.length ? prior.news : []) },
    // v58.74 (refresh-data 10/24 01:20Z): a failed Cboe read published totalPutCall null and the static-data contract
    // refused the whole refresh. A failed read keeps the last value labelled stale-reference (history writes only
    // current-reference rows), like Fear & Greed.
    { id: 'putCall', label: 'Put/Call', run: () => fetchCboePutCall().then((value) => (value?.error && prior.putCall?.totalPutCall != null && Number.isFinite(Number(prior.putCall.totalPutCall)) && prior.putCall?.asOf
      ? { ...prior.putCall, status: 'stale-reference', attemptedAt, failureReason: value.error } : value)),
      fallback: () => ({ source: 'Cboe Daily Market Statistics', sourceKind: 'unavailable', allowedUse: 'none', fetchedAt: null, attemptedAt, totalPutCall: null, error: 'put-call-plane-failed' }) },
    { id: 'bls', label: 'BLS', run: () => fetchBlsSeries(prior.bls, { releaseSchedules: blsReleaseSchedules }),
      fallback: () => (prior.bls?.series ? { ...prior.bls, status: 'stale', attemptedAt, failureReason: 'bls-plane-failed' }
        : { status: 'unavailable', ...unavailable, lastSuccessfulAt: null, values: {}, series: {}, failures: [{ metricId: 'batch', reason: 'bls-plane-failed' }] }) },
    { id: 'bea', label: 'BEA', run: () => fetchBeaPce(prior.bea),
      fallback: () => (prior.bea ? { ...prior.bea, status: 'last-known-good', attemptedAt, failureReason: 'bea-plane-failed' }
        : { status: 'unavailable', ...unavailable, lastSuccessfulAt: null, values: {}, failureReason: 'bea-plane-failed' }) },
    { id: 'treasury', label: 'Treasury', run: () => fetchTreasuryYieldCurve(prior.treasury),
      fallback: () => (prior.treasury?.values ? { ...prior.treasury, status: 'stale', attemptedAt, failureReason: 'treasury-plane-failed' }
        : { status: 'unavailable', ...unavailable, values: {}, failureReason: 'treasury-plane-failed' }) },
    { id: 'fredHyOas', label: 'FRED HY OAS', run: () => fetchFredHyOasPublic(prior.fredHyOas),
      fallback: () => (prior.fredHyOas ? { ...prior.fredHyOas, status: 'stale', attemptedAt, failureReason: 'fred-hy-oas-plane-failed' }
        : { status: 'unavailable', ...unavailable, value: null, failureReason: 'fred-hy-oas-plane-failed' }) },
    { id: 'cryptoCrossCheck', label: 'crypto cross-check', run: () => fetchCoinGeckoCrossCheck(),
      fallback: () => ({ status: 'unavailable', ...unavailable, quotes: [], reason: 'crypto-cross-check-plane-failed' }) },
    { id: 'aaii', label: 'AAII', run: () => fetchAaiiSentiment(prior.marketSurveys?.aaii || null),
      fallback: () => (prior.marketSurveys?.aaii ? { ...prior.marketSurveys.aaii, status: 'stale-reference', attemptedAt, failureReason: 'aaii-plane-failed' }
        : { status: 'unavailable', ...unavailable, observedAt: null, failureReason: 'aaii-plane-failed' }) },
    { id: 'fredDexkous', label: 'FRED DEXKOUS', run: () => fetchFredDexkousPublic(prior.fredDexkous),
      fallback: () => ({ status: 'unavailable', ...unavailable, value: null, reason: 'fred-dexkous-plane-failed' }) }
  ];
}

// Runs every plane concurrently; a plane that throws (or resolves null) publishes its declared fallback.
export async function collectSourcePlanes(planes, { warn = console.warn } = {}) {
  const settled = await Promise.allSettled(planes.map((plane) => Promise.resolve().then(() => plane.run())));
  const values = {};
  const failures = {};
  const settledValue = (plane, result) => {
    if (result?.status === 'fulfilled' && result.value != null) return result.value;
    const reason = result?.reason?.message || String(result?.reason || 'unknown-error');
    warn(`[fetch-data] ${plane.label} plane failed; preserving other planes: ${reason}`);
    failures[plane.id] = reason;
    return plane.fallback(reason);
  };
  planes.forEach((plane, index) => { values[plane.id] = settledValue(plane, settled[index]); });
  return { values, failures };
}
