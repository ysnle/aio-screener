const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function requirement(id, maxAgeMs, options = {}) {
  return Object.freeze({ id, maxAgeMs, required: options.required !== false, direction: !!options.direction, marketRevision: !!options.marketRevision });
}

export const PAGE_DATA_TIMELINE_CONTRACTS = Object.freeze({
  home: Object.freeze([requirement('market.^GSPC', 4 * DAY, { direction: true, marketRevision: true }), requirement('sentiment.fearGreed', 2 * DAY), requirement('breadth.us', 4 * DAY), requirement('news.completedCycle', 30 * HOUR)]),
  signal: Object.freeze([requirement('market.^GSPC', 4 * DAY, { direction: true, marketRevision: true }), requirement('market.^VIX', 4 * DAY, { marketRevision: true }), requirement('sentiment.fearGreed', 2 * DAY), requirement('breadth.us', 4 * DAY)]),
  breadth: Object.freeze([requirement('breadth.us', 4 * DAY), requirement('breadth.kr', 4 * DAY), requirement('breadth.history', 90 * DAY, { required: false })]),
  sentiment: Object.freeze([requirement('market.^VIX', 4 * DAY, { marketRevision: true }), requirement('market.^VIX3M', 4 * DAY, { marketRevision: true }), requirement('sentiment.fearGreed', 2 * DAY), requirement('sentiment.putCall', 4 * DAY), requirement('sentiment.hySpread', 4 * DAY)]),
  briefing: Object.freeze([requirement('news.completedCycle', 30 * HOUR), requirement('market.^GSPC', 4 * DAY, { direction: true, marketRevision: true })]),
  'market-news': Object.freeze([requirement('news.completedCycle', 30 * HOUR), requirement('market.^GSPC', 4 * DAY, { direction: true, marketRevision: true })]),
  technical: Object.freeze([requirement('technical.history', 4 * DAY), requirement('market.^GSPC', 4 * DAY, { direction: true, marketRevision: true }), requirement('breadth.us', 4 * DAY)]),
  screener: Object.freeze([
    requirement('screener.snapshot', 4 * DAY),
    requirement('screener.factorCoverage', 4 * DAY),
    requirement('screener.rankingEpoch', 4 * DAY),
    requirement('screener.visibleQuotes', 4 * DAY, { required: false }),
    requirement('screener.fundamentalCoverage', 180 * DAY, { required: false }),
    requirement('screener.newsCoverage', 2 * DAY, { required: false })
  ]),
  ticker: Object.freeze([requirement('entity.quote', 4 * DAY, { direction: true }), requirement('entity.history', 7 * DAY)]),
  portfolio: Object.freeze([requirement('portfolio.quoteCoverage', 4 * DAY, { direction: true })]),
  themes: Object.freeze([requirement('themes.quoteCoverage', 4 * DAY, { direction: true })]),
  'theme-detail': Object.freeze([requirement('themeDetail.quoteCoverage', 4 * DAY, { direction: true })]),
  macro: Object.freeze([requirement('macro.cpi', 50 * DAY), requirement('macro.pce', 75 * DAY), requirement('macro.employment', 50 * DAY), requirement('macro.fedRate', 50 * DAY), requirement('market.^TNX', 4 * DAY, { marketRevision: true })]),
  fxbond: Object.freeze([requirement('market.DX-Y.NYB', 2 * DAY, { direction: true, marketRevision: true }), requirement('market.KRW=X', 2 * DAY, { direction: true, marketRevision: true }), requirement('market.^TNX', 4 * DAY, { marketRevision: true }), requirement('market.^IRX', 4 * DAY, { marketRevision: true }), requirement('sentiment.hySpread', 4 * DAY)]),
  fundamental: Object.freeze([requirement('entity.fundamental', 450 * DAY)]),
  options: Object.freeze([requirement('market.^VIX', 4 * DAY, { marketRevision: true }), requirement('sentiment.putCall', 4 * DAY), requirement('market.^SKEW', 4 * DAY, { required: false, marketRevision: true })])
});

function parseTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValue(observation) {
  if (!observation || observation.available === false) return false;
  if (observation.value === 0) return true;
  if (typeof observation.value === 'number') return Number.isFinite(observation.value);
  if (Array.isArray(observation.value)) return observation.value.length > 0;
  return observation.value != null && observation.value !== '';
}

export function evaluatePageDataTimeline(route, catalog = {}, {
  now = Date.now(),
  marketRevision = null
} = {}) {
  const pageId = String(route || '').replace(/^page-/, '');
  const requirements = PAGE_DATA_TIMELINE_CONTRACTS[pageId] || Object.freeze([]);
  const checks = requirements.map((contract) => {
    const observation = catalog[contract.id] || null;
    const observedMs = parseTime(observation?.observedAt);
    const ageMs = observedMs == null ? null : now - observedMs;
    let status = 'PASS';
    let reason = null;
    if (!hasValue(observation)) {
      status = 'UNAVAILABLE';
      reason = observation?.reason || 'value-or-observation-missing';
    } else if (observedMs == null) {
      status = 'UNAVAILABLE';
      reason = 'observedAt-missing';
    } else if (ageMs < -15 * 60 * 1000 || ageMs > contract.maxAgeMs) {
      status = 'STALE';
      reason = `ageMs=${ageMs}`;
    } else if (contract.marketRevision && (!observation?.revision || observation.revision !== marketRevision)) {
      status = 'REVISION_MISMATCH';
      reason = `${observation?.revision || 'missing'}!=${marketRevision || 'missing'}`;
    } else if (contract.direction && (typeof observation?.directionValue !== 'number' || !Number.isFinite(observation.directionValue))) {
      status = 'DIRECTION_UNAVAILABLE';
      reason = 'direction-value-missing';
    } else if (contract.direction && (observation?.directionCompatible === false || !observation?.changeBasis || observation.changeBasis === 'unknown')) {
      status = 'DIRECTION_INCOMPATIBLE';
      reason = observation?.directionReason || 'change-basis-incompatible';
    }
    return Object.freeze({
      id: contract.id,
      required: contract.required,
      direction: contract.direction,
      marketRevision: contract.marketRevision,
      status,
      reason,
      observedAt: observation?.observedAt || null,
      fetchedAt: observation?.fetchedAt || null,
      source: observation?.source || null,
      sourceKind: observation?.sourceKind || null,
      revision: observation?.revision || null,
      changeBasis: observation?.changeBasis || null,
      ageMs,
      maxAgeMs: contract.maxAgeMs
    });
  });
  const failedRequired = checks.filter((check) => check.required && check.status !== 'PASS');
  const hardFailures = failedRequired.filter((check) => !['STALE'].includes(check.status));
  const optionalFailures = checks.filter((check) => !check.required && check.status !== 'PASS');
  const status = hardFailures.length ? 'BLOCKED' : failedRequired.length || optionalFailures.length ? 'PARTIAL' : requirements.length ? 'CURRENT' : 'REFERENCE';
  const observedTimes = checks.map((check) => parseTime(check.observedAt)).filter(Number.isFinite);
  return Object.freeze({
    pageId,
    status,
    checks,
    requiredCount: checks.filter((check) => check.required).length,
    passCount: checks.filter((check) => check.status === 'PASS').length,
    blockedFields: hardFailures.map((check) => check.id),
    staleFields: failedRequired.filter((check) => check.status === 'STALE').map((check) => check.id),
    optionalUnavailable: optionalFailures.map((check) => check.id),
    observationStart: observedTimes.length ? new Date(Math.min(...observedTimes)).toISOString() : null,
    observationEnd: observedTimes.length ? new Date(Math.max(...observedTimes)).toISOString() : null
  });
}

export function auditPageDataTimelines(catalog = {}, options = {}) {
  const rows = Object.keys(PAGE_DATA_TIMELINE_CONTRACTS).map((route) => evaluatePageDataTimeline(route, catalog, options));
  return Object.freeze({
    schemaVersion: 'page-data-timeline-audit-v1',
    status: rows.some((row) => row.status === 'BLOCKED') ? 'BLOCKED' : rows.some((row) => row.status === 'PARTIAL') ? 'PARTIAL' : 'CURRENT',
    pageCount: rows.length,
    fieldCheckCount: rows.reduce((sum, row) => sum + row.checks.length, 0),
    blockedPages: rows.filter((row) => row.status === 'BLOCKED').map((row) => row.pageId),
    partialPages: rows.filter((row) => row.status === 'PARTIAL').map((row) => row.pageId),
    rows
  });
}
