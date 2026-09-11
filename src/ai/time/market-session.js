export const AI_MARKET_SESSION_VERSION = 'market-session-evidence.v1';
export const AI_MARKET_TIME_VERSION = 'market-time-evidence.v1';

// Published 2026 US equity calendar, verified 2026-09-08:
// https://www.nyse.com/trade/hours-calendars
// https://www.cboe.com/about/hours
// Unknown years fail closed instead of assuming that weekdays are sessions.
export const US_REGULAR_CALENDAR_2026 = Object.freeze({
  holidays: Object.freeze(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']),
  halfDays: Object.freeze({ '2026-11-27': '13:00', '2026-12-24': '13:00' })
});

export function isLatestUsRegularClose({ instrumentId, observedAt, now = Date.now() } = {}) {
  if (!/^\^(GSPC|IXIC|DJI|RUT|VIX|VIX3M|TNX|IRX)$/.test(String(instrumentId || ''))) return false;
  const observedMs = Date.parse(observedAt || '');
  const nowMs = Number(now);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) || observedMs > nowMs) return false;
  const parts = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
  };
  const current = parts(nowMs);
  const observed = parts(observedMs);
  const session = (date) => date.startsWith('2026-') ? resolveMarketCalendarSession({ market: 'US', date, calendar: US_REGULAR_CALENDAR_2026, ...US_REGULAR_CALENDAR_2026 }) : { status: 'unknown' };
  const today = session(current.date);
  if (today.status === 'unknown') return false;
  const closeMinute = (s) => Number(s.close.slice(0, 2)) * 60 + Number(s.close.slice(3));
  // A previous close cannot certify current evidence once regular trading resumes.
  if (today.status === 'open' && current.minute >= 570 && current.minute < closeMinute(today)) return false;
  let lastDate = current.date;
  if (today.status !== 'open' || current.minute < 570) {
    for (let i = 0; i < 10; i++) {
      lastDate = new Date(Date.parse(`${lastDate}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
      const prior = session(lastDate);
      if (prior.status === 'unknown') return false;
      if (prior.status === 'open') break;
    }
  }
  const lastSession = session(lastDate);
  if (lastSession.status !== 'open' || observed.date !== lastDate) return false;
  // Yahoo Treasury index observations end around 14:59 ET. Accept only a
  // bounded closing observation window, never a stale morning tick.
  const minimumMinute = /^\^(TNX|IRX)$/.test(instrumentId) ? Math.min(895, closeMinute(lastSession) - 5) : closeMinute(lastSession) - 5;
  return observed.minute >= minimumMinute;
}

export const MARKET_CALENDAR_ADAPTERS = Object.freeze({
  NYSE: Object.freeze({ market: 'US', timezone: 'America/New_York', regularOpen: '09:30', regularClose: '16:00', dstAware: true }),
  KRX: Object.freeze({ market: 'KR', timezone: 'Asia/Seoul', regularOpen: '09:00', regularClose: '15:30', dstAware: false }),
});

function dateOnly(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

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

export function resolveMarketCalendarSession({ market = 'US', date, calendar = null, holidays = [], halfDays = {} } = {}) {
  const adapter = MARKET_CALENDAR_ADAPTERS[String(market).toUpperCase() === 'KR' ? 'KRX' : 'NYSE'];
  const day = dateOnly(date);
  if (!day || !calendar || typeof calendar !== 'object') {
    return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'unknown', reason: 'calendar-unavailable', timezone: adapter.timezone, dstAware: adapter.dstAware };
  }
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'weekend', timezone: adapter.timezone, dstAware: adapter.dstAware };
  if (holidays.map(dateOnly).includes(day)) return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'holiday', timezone: adapter.timezone, dstAware: adapter.dstAware };
  const close = halfDays[day] || adapter.regularClose;
  return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'open', session: 'regular', open: adapter.regularOpen, close, halfDay: close !== adapter.regularClose, timezone: adapter.timezone, dstAware: adapter.dstAware };
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

export function resolveMarketSessionSchedule({ market = 'US', now = new Date(), root = globalThis, supplied = null } = {}) {
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
  const getter = String(market).toUpperCase() === 'KR' ? root?._getKrxSession : root?._getUsSession;
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
