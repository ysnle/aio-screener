export const AI_MARKET_SESSION_VERSION = 'market-session-evidence.v1';

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function resolveQuestionTime(query, now = new Date()) {
  const text = String(query == null ? '' : query);
  const currentSensitive = /(지금|현재|오늘|장중|장전|장후|방금|실시간|최근|now|today|current|live|latest|as.?of)/i.test(text);
  const timeframe = /장중|intraday|분봉/i.test(text) ? 'intraday'
    : /오늘|당일|today/i.test(text) ? 'session'
    : /이번 주|주간|weekly/i.test(text) ? 'week'
    : /이번 달|월간|monthly/i.test(text) ? 'month'
    : /3개월|분기|quarter/i.test(text) ? 'quarter'
    : 'unspecified';
  return Object.freeze({ currentSensitive, timeframe, requestedAt: iso(now) });
}

export function createMarketSessionEvidence({ market = 'US', now = new Date(), observedAt = null, schedule = null, source = 'session-provider' } = {}) {
  const supplied = schedule && typeof schedule === 'object' && ['open', 'closed', 'pre', 'post', 'unknown'].includes(schedule.status)
    ? schedule : null;
  const status = supplied?.status || 'unknown';
  return Object.freeze({
    schemaVersion: AI_MARKET_SESSION_VERSION,
    evidenceId: `session:${String(market).toLowerCase()}:${iso(observedAt || now) || 'unknown'}`,
    market: String(market),
    status,
    isOpen: status === 'open' ? true : status === 'closed' ? false : null,
    session: supplied?.session || null,
    observedAt: iso(observedAt || supplied?.observedAt || now),
    source: supplied?.source || source,
    sourceKind: supplied?.sourceKind || 'session-provider',
    allowedUse: supplied?.allowedUse || 'reference',
    verified: supplied != null
  });
}

export function validateMarketSessionEvidence(evidence) {
  const errors = [];
  if (!evidence || evidence.schemaVersion !== AI_MARKET_SESSION_VERSION) errors.push('schema_version_invalid');
  if (!['open', 'closed', 'pre', 'post', 'unknown'].includes(evidence?.status)) errors.push('status_invalid');
  if (!evidence?.observedAt || !iso(evidence.observedAt)) errors.push('observed_at_missing');
  if (evidence?.status === 'unknown' && evidence?.verified === true) errors.push('unknown_cannot_be_verified');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
