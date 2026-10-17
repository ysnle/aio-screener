// Per-screen data completeness (wp10.page-completeness.v1). Legacy unification (2026-10-17): moved from js/aio-core.js
// (_aioProducerState / AIO.getPageDataCompleteness / AIO.auditPageDataCompleteness). The screener artifact's load state
// now comes from the native screener slice instead of the _aioScreenerLoadState global the data.json loader and the
// screener projection both wrote. The router writes the result onto each screen as data-aio-vertical-slice-* attributes.
export const PAGE_COMPLETENESS_VERSION = 'wp10.page-completeness.v1';
const ISSUE_STATUSES = ['missing', 'loading', 'failed', 'unavailable', 'error', 'stale', 'zero', 'partial', 'blocked', 'reference', 'neutral'];
const EMPTY_STATUSES = ['missing', 'zero', 'empty'];

const isoMs = (ms) => (ms && Number.isFinite(Number(ms)) ? new Date(Number(ms)).toISOString() : null);

// The screener artifact's load state from the native slice: a slice that has never been written is still loading, a
// read that failed is unavailable, and a published artifact is ready only with its backtest and a current universe
// (the rule js/aio-data.js _aioApplyNativeScreenerState applied).
export function screenerLoadState(screener = null) {
  const state = screener && typeof screener === 'object' ? screener : {};
  const metadata = state.metadata && typeof state.metadata === 'object' ? state.metadata : {};
  const hasArtifact = ['current', 'partial', 'ready'].includes(state.status);
  if (hasArtifact) return { status: metadata.universeFreshnessStatus === 'stale' ? 'partial' : metadata.backtest ? 'ready' : 'partial', detail: null };
  if (!state.status || (state.status === 'unavailable' && !state.updatedAt && !state.revision && !Object.keys(metadata).length)) {
    return { status: 'loading', detail: 'native screener state pending' };
  }
  return { status: state.status, detail: metadata.detail || null };
}

export function producerState(producer, { meta = {}, refreshSchedule = null, screener = null, now = Date.now() } = {}) {
  const cfg = (refreshSchedule && refreshSchedule[producer]) || null;
  let state = {
    producer,
    status: 'missing',
    coverage: null,
    attemptedAt: (cfg && cfg._attemptedAt) || null,
    lastSuccessfulAt: (cfg && (cfg._lastSuccessfulAt || isoMs(cfg._lastOk))) || null,
    evidenceIds: cfg && Array.isArray(cfg._evidenceIds) ? cfg._evidenceIds.slice() : [],
    failureReason: (cfg && (cfg._failureReason || cfg._lastErr)) || null,
    sourceKind: (cfg && cfg._sourceKind) || null,
    allowedUse: (cfg && cfg._allowedUse) || null
  };
  const load = screenerLoadState(screener);
  const screenerReady = load.status === 'ready';
  const direct = {
    // P1116: derive the citation from the producer's publication flag; data.json.quotes is published empty (P715).
    quotes: meta.generatedAt && Number(meta.symbolsOk) > 0 ? { status: Number(meta.symbolsFail || 0) ? 'partial' : 'loaded', coverage: (Number(meta.symbolsOk) / Math.max(1, Number(meta.symbolsOk) + Number(meta.symbolsFail || 0))) * 100, lastSuccessfulAt: meta.generatedAt, evidenceIds: [meta.quotesPublished === true ? 'data.json:quotes' : 'market-snapshot.json:quotes'], sourceKind: 'delayed-eod' } : null,
    news: meta.generatedAt && meta.newsOk ? { status: 'loaded', coverage: 100, lastSuccessfulAt: meta.generatedAt, evidenceIds: ['data.json:news'], sourceKind: 'server-cache' } : null,
    fred: meta.generatedAt && meta.fredFetchOk ? { status: 'loaded', coverage: 100, lastSuccessfulAt: meta.generatedAt, evidenceIds: ['data.json:macro:fred'], sourceKind: 'official-primary' } : null,
    sentiment: meta.generatedAt && meta.fearGreedOk ? { status: 'loaded', coverage: 100, lastSuccessfulAt: meta.generatedAt, evidenceIds: ['data.json:fearGreed'], sourceKind: 'delayed' } : null,
    // The projected load state never carried a coverage or generation time: breadth reads 100%, the artifact's coverage
    // stays unknown (NaN, as before), and both take the data.json generation time.
    breadth: screenerReady ? { status: 'loaded', coverage: 100, lastSuccessfulAt: meta.generatedAt, evidenceIds: ['screener.json:breadth'], sourceKind: 'delayed-eod' } : null,
    screenerArtifact: screenerReady ? { status: 'loaded', coverage: NaN, lastSuccessfulAt: meta.generatedAt, evidenceIds: ['screener.json'], sourceKind: 'delayed-eod', allowedUse: 'research-relative-ranking-only' } : null
  }[producer] || null;
  if (direct) state = Object.assign(state, direct);
  if (cfg) {
    if (cfg._status) state.status = cfg._status;
    if (cfg._coverage != null) state.coverage = Number(cfg._coverage);
    if (cfg._lastSuccessfulAt) state.lastSuccessfulAt = cfg._lastSuccessfulAt;
    if (cfg._attemptedAt) state.attemptedAt = cfg._attemptedAt;
    if (Array.isArray(cfg._evidenceIds) && cfg._evidenceIds.length) state.evidenceIds = cfg._evidenceIds.slice();
    if (cfg._failureReason || cfg._lastErr) state.failureReason = cfg._failureReason || cfg._lastErr;
    if (cfg._sourceKind) state.sourceKind = cfg._sourceKind;
    if (cfg._allowedUse) state.allowedUse = cfg._allowedUse;
    if (!state.lastSuccessfulAt && cfg._lastOk) state.lastSuccessfulAt = isoMs(cfg._lastOk);
    if (state.status === 'missing' && cfg._lastOk) state.status = 'loaded';
  }
  if (producer === 'screenerArtifact') {
    // The slice's own state is authoritative over the schedule, as the load-state global was.
    state.status = load.status === 'ready' ? 'loaded' : load.status;
    state.attemptedAt = isoMs(now) || state.attemptedAt;
    state.failureReason = load.detail || state.failureReason;
  }
  return state;
}

export function pageDataCompleteness(pageId, contract, readProducer, now = Date.now()) {
  const id = String(pageId || '').replace(/^page-/, '');
  if (!contract) return { version: PAGE_COMPLETENESS_VERSION, pageId: id, status: 'blocked', reason: 'unknown-route', producers: {} };
  const required = contract.requiredProducers || [];
  const producerIds = Array.from(new Set(required.concat(contract.optionalProducers || [])));
  const producers = {};
  const issues = [];
  producerIds.forEach((producer) => {
    const state = readProducer(producer);
    const maxAgeMs = contract.maxAge && contract.maxAge[producer] != null ? Number(contract.maxAge[producer]) : Infinity;
    const minCoverage = contract.minCoverage && contract.minCoverage[producer] != null ? Number(contract.minCoverage[producer]) : 0;
    const ageMs = state.lastSuccessfulAt ? now - new Date(state.lastSuccessfulAt).getTime() : null;
    if (state.status === 'loaded' && ageMs != null && Number.isFinite(maxAgeMs) && ageMs > maxAgeMs) state.status = 'stale';
    if (state.status === 'loaded' && state.coverage != null && state.coverage < minCoverage) state.status = state.coverage <= 0 ? 'zero' : 'partial';
    state.ageMs = ageMs;
    state.maxAgeMs = maxAgeMs;
    state.minCoverage = minCoverage;
    producers[producer] = state;
  });
  required.forEach((producer) => {
    const state = producers[producer];
    if (state && ISSUE_STATUSES.includes(state.status)) issues.push({ producer, status: state.status, failureReason: state.failureReason || null, coverage: state.coverage, maxAgeMs: state.maxAgeMs });
  });
  const blocked = issues.some((issue) => issue.status === 'blocked' || (contract.failureState === 'blocked' && issue.status === 'failed'));
  const staleReference = issues.some((issue) => issue.status === 'reference');
  const empty = issues.length > 0 && issues.length === required.length && issues.every((issue) => EMPTY_STATUSES.includes(issue.status));
  const status = !issues.length ? 'loaded' : staleReference ? 'stale-reference' : empty ? 'empty' : blocked ? 'blocked' : 'partial';
  return {
    version: PAGE_COMPLETENESS_VERSION,
    pageId: id,
    status,
    requiredProducers: required.slice(),
    optionalProducers: (contract.optionalProducers || []).slice(),
    minCoverage: { ...(contract.minCoverage || {}) },
    maxAge: { ...(contract.maxAge || {}) },
    failureState: contract.failureState || 'partial',
    forbiddenClaims: (contract.forbiddenClaims || []).slice(),
    producers,
    issues,
    checkedAt: new Date(now).toISOString()
  };
}

export function auditPageDataCompleteness(pages, ids) {
  const count = (status) => pages.filter((row) => row.status === status).length;
  const blockedCount = count('blocked');
  const partialCount = count('partial');
  const emptyCount = count('empty');
  const staleReferenceCount = count('stale-reference');
  return {
    version: PAGE_COMPLETENESS_VERSION,
    status: blockedCount ? 'blocked' : staleReferenceCount ? 'stale-reference' : emptyCount ? 'empty' : partialCount ? 'partial' : 'loaded',
    routeCount: ids.length,
    loadedCount: count('loaded'),
    partialCount,
    blockedCount,
    emptyCount,
    staleReferenceCount,
    pages,
    checkedAt: new Date().toISOString()
  };
}

// Installs the AIO.* entry points the router, QA audits and tests call (getScreenerLoadState: the QA runtime audit).
export function installPageCompleteness(root, { readScreener }) {
  const AIO = root.AIO = root.AIO || {};
  const readProducer = (producer) => producerState(producer, { meta: root._serverDataMeta || {}, refreshSchedule: root.REFRESH_SCHEDULE || null, screener: readScreener() });
  AIO.getScreenerLoadState = () => screenerLoadState(readScreener());
  AIO.getPageDataCompleteness = (pageId) => pageDataCompleteness(pageId, AIO.getPageContract?.(pageId) || null, readProducer);
  AIO.auditPageDataCompleteness = (opts = {}) => {
    const contracts = root.AIO_PAGE_CONTRACTS || {};
    const ids = (opts.allRoutes ? (contracts.routePageIds || []).slice() : Array.isArray(opts.pageIds) && opts.pageIds.length ? opts.pageIds.slice() : [String(opts.pageId || '').replace(/^page-/, '')]).filter(Boolean);
    return auditPageDataCompleteness(ids.map((id) => AIO.getPageDataCompleteness(id)), ids);
  };
}
