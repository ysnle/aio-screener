import {
  MARKET_TIME_VERSION,
  currentCalendarContext
} from '../../domain/market/market-calendar.js';

// P1533: the pure exchange calendar moved to the domain layer; these names stay importable from here.
export {
  US_REGULAR_CALENDAR_2026,
  US_REGULAR_CALENDAR_2027,
  KRX_REGULAR_CALENDAR_2026,
  KRX_REGULAR_CALENDAR_2027,
  MARKET_CALENDAR_REGISTRY,
  MARKET_CALENDAR_ADAPTERS,
  nyParts,
  isLatestUsRegularClose,
  latestCompletedUsSession,
  latestCompletedKrSession,
  resolveMarketCalendarSession,
  countOpenSessionsBetween,
  openSessionDatesBetween
} from '../../domain/market/market-calendar.js';

export const AI_MARKET_SESSION_VERSION = 'market-session-evidence.v1';
export const AI_MARKET_TIME_VERSION = MARKET_TIME_VERSION;

export function createTemporalEvidence({ eventAt = null, observedAt = null, collectedAt = null, publishedAt = null, source = 'temporal-provider', sourceKind = 'official-primary', allowedUse = 'reference' } = {}) {
  return Object.freeze({
    schemaVersion: AI_MARKET_TIME_VERSION,
    eventAt: iso(eventAt),
    observedAt: iso(observedAt),
    collectedAt: iso(collectedAt),
    publishedAt: iso(publishedAt),
    source,
    sourceKind,
    allowedUse,
    status: eventAt && observedAt ? 'observed' : 'unknown',
  });
}

function calendarClosedSchedule(context) {
  return {
    status: 'closed',
    session: 'closed',
    observedAt: new Date(context.nowMs).toISOString(),
    source: 'registered-market-calendar',
    sourceKind: 'official-market-calendar',
    allowedUse: 'current-session',
    calendarReason: context.session.reason
  };
}

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
  const calendar = currentCalendarContext(market, now);
  const evidenceSchedule = calendar?.session.status === 'closed'
    ? calendarClosedSchedule(calendar)
    : calendar?.session.status === 'open' ? supplied : null;
  const status = evidenceSchedule?.status || 'unknown';
  return Object.freeze({
    schemaVersion: AI_MARKET_SESSION_VERSION,
    evidenceId: `session:${String(market).toLowerCase()}:${iso(observedAt || now) || 'unknown'}`,
    market: String(market),
    status,
    isOpen: status === 'open' ? true : status === 'closed' ? false : null,
    session: evidenceSchedule?.session || null,
    observedAt: iso(observedAt || evidenceSchedule?.observedAt || now),
    source: evidenceSchedule?.source || source,
    sourceKind: evidenceSchedule?.sourceKind || 'session-provider',
    allowedUse: evidenceSchedule?.allowedUse || 'reference',
    verified: evidenceSchedule != null
  });
}

export function resolveMarketSessionSchedule({ market = 'US', now = new Date(), root = globalThis, supplied = null } = {}) {
  const calendar = currentCalendarContext(market, now);
  if (!calendar || calendar.session.status === 'unknown') return null;
  if (calendar.session.status === 'closed') return calendarClosedSchedule(calendar);
  const nowMs = calendar.nowMs;
  const normalize = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return null;
    const status = candidate.status === 'after' ? 'post' : candidate.status === 'futures_only' ? 'closed' : candidate.status;
    return ['open', 'closed', 'pre', 'post'].includes(status) ? { ...candidate, status } : null;
  };
  const suppliedNormalized = normalize(supplied);
  if (suppliedNormalized) return suppliedNormalized;
  const state = root?.AIO?.marketSession || root?.AIO?.marketState?.sessionEvidence;
  const stateNormalized = normalize(state);
  if (stateNormalized) return stateNormalized;
  const getter = calendar.calendarKey === 'KRX' ? root?._getKrxSession : root?._getUsSession;
  if (typeof getter !== 'function') return null;
  let raw = null;
  try { raw = getter.call(root); } catch (_) { return null; }
  const status = raw === 'after' ? 'post' : raw === 'futures_only' ? 'closed' : raw;
  if (!['open', 'closed', 'pre', 'post'].includes(status)) return null;
  return {
    status,
    session: status === 'post' ? 'after-hours' : status === 'pre' ? 'pre-market' : status === 'open' ? 'regular' : 'closed',
    observedAt: new Date(now).toISOString(),
    source: 'runtime-session-clock',
    sourceKind: 'runtime-session-clock',
    allowedUse: 'current-session'
  };
}

export function validateMarketSessionEvidence(evidence) {
  const errors = [];
  if (!evidence || evidence.schemaVersion !== AI_MARKET_SESSION_VERSION) errors.push('schema_version_invalid');
  if (!['open', 'closed', 'pre', 'post', 'unknown'].includes(evidence?.status)) errors.push('status_invalid');
  if (!evidence?.observedAt || !iso(evidence.observedAt)) errors.push('observed_at_missing');
  if (evidence?.status === 'unknown' && evidence?.verified === true) errors.push('unknown_cannot_be_verified');
  if (evidence?.verified !== true) errors.push('session_not_verified');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
