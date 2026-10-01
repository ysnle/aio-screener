export const AI_MARKET_SESSION_VERSION = 'market-session-evidence.v1';
export const AI_MARKET_TIME_VERSION = 'market-time-evidence.v1';

// R447/P1045/P1302, QA-MARKET-CALENDAR/QA-DATA-46: only registered year
// calendars can establish a regular session; unknown years fail closed.
// NYSE source (2026-2028 holiday and early-close calendar):
// https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/
// KRX source (official holiday query; verified 2026 and 2027 weekday closures):
// https://open.krx.co.kr/contents/MKD/01/0110/01100305/MKD01100305.jsp
const createRegularCalendar = (year, holidays, halfDays = {}) => Object.freeze({
  year,
  holidays: Object.freeze(holidays),
  halfDays: Object.freeze(halfDays)
});

export const US_REGULAR_CALENDAR_2026 = createRegularCalendar(2026,
  ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25'],
  { '2026-11-27': '13:00', '2026-12-24': '13:00' }
);

export const US_REGULAR_CALENDAR_2027 = createRegularCalendar(2027,
  ['2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24'],
  { '2027-11-26': '13:00' }
);

export const KRX_REGULAR_CALENDAR_2026 = createRegularCalendar(2026,
  ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-01', '2026-05-05', '2026-05-25', '2026-06-03', '2026-07-17', '2026-08-17', '2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09', '2026-12-25', '2026-12-31']
);

export const KRX_REGULAR_CALENDAR_2027 = createRegularCalendar(2027,
  ['2027-01-01', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-03', '2027-05-05', '2027-05-13', '2027-07-19', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27', '2027-12-31']
);

export const MARKET_CALENDAR_REGISTRY = Object.freeze({
  NYSE: Object.freeze({
    2026: US_REGULAR_CALENDAR_2026,
    2027: US_REGULAR_CALENDAR_2027
  }),
  KRX: Object.freeze({
    2026: KRX_REGULAR_CALENDAR_2026,
    2027: KRX_REGULAR_CALENDAR_2027
  })
});

// New York wall-clock date and minute-of-day for an instant (DST aware).
export function nyParts(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

export function isLatestUsRegularClose({ instrumentId, observedAt, now = Date.now() } = {}) {
  if (!/^\^(GSPC|IXIC|DJI|RUT|VIX|VIX3M|TNX|IRX)$/.test(String(instrumentId || ''))) return false;
  const observedMs = Date.parse(observedAt || '');
  const nowMs = Number(now);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) || observedMs > nowMs) return false;
  // A previous close cannot certify current evidence once regular trading resumes.
  const last = latestCompletedUsSession(nowMs, { requirePrevious: false });
  const observed = nyParts(observedMs);
  if (!last || last.inSession || observed.date !== last.date) return false;
  // Yahoo Treasury index observations end around 14:59 ET. Accept only a
  // bounded closing observation window, never a stale morning tick.
  const closeMinute = nyParts(last.closeMs).minute;
  return observed.minute >= (/^\^(TNX|IRX)$/.test(instrumentId) ? Math.min(895, closeMinute - 5) : closeMinute - 5);
}

// P1328: the most recent COMPLETED US regular session (date + exact close instant) and the date of
// the session before it. While a session is in progress its close has not
// happened yet, so the "latest completed" session is the previous one. Unknown years fail
// closed (null).
export function latestCompletedUsSession(now = Date.now(), { requirePrevious = true } = {}) {
  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) return null;
  const minuteOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const closeInstant = (date, hhmm) => {
    // New York wall time → UTC instant (DST aware): start from UTC-5 and correct once.
    let guess = Date.parse(`${date}T${hhmm}:00Z`) + 5 * 3600000;
    const seen = nyParts(guess);
    const drift = (seen.date === date ? seen.minute : seen.minute + (seen.date > date ? 1440 : -1440)) - minuteOf(hhmm);
    guess -= drift * 60000;
    return guess;
  };
  const previousOpen = (date) => {
    let cursor = date;
    for (let i = 0; i < 10; i += 1) {
      cursor = new Date(Date.parse(`${cursor}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
      const session = resolveMarketCalendarSession({ market: 'US', date: cursor });
      if (session.status === 'unknown') return null;
      if (session.status === 'open') return session;
    }
    return null;
  };
  const current = nyParts(nowMs);
  const today = resolveMarketCalendarSession({ market: 'US', date: current.date });
  if (today.status === 'unknown') return null;
  const last = today.status === 'open' && current.minute >= minuteOf(today.close) ? today : previousOpen(current.date);
  if (!last) return null;
  const before = previousOpen(last.date);
  if (!before && requirePrevious) return null;
  return Object.freeze({
    date: last.date,
    closeMs: closeInstant(last.date, last.close),
    previousDate: before?.date ?? null,
    inSession: today.status === 'open' && current.minute >= 570 && current.minute < minuteOf(today.close)
  });
}

export const MARKET_CALENDAR_ADAPTERS = Object.freeze({
  NYSE: Object.freeze({ market: 'US', timezone: 'America/New_York', regularOpen: '09:30', regularClose: '16:00', dstAware: true }),
  KRX: Object.freeze({ market: 'KR', timezone: 'Asia/Seoul', regularOpen: '09:00', regularClose: '15:30', dstAware: false }),
});

// P1349: Korean observations use the latest completed KRX session independently
// of the US basis. Unknown calendars and pre-close observations cannot certify it.
export function latestCompletedKrSession(now = Date.now()) {
  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) return null;
  let date = dateInTimezone(nowMs, 'Asia/Seoul');
  for (let i = 0; i < 12 && date; i += 1) {
    const session = resolveMarketCalendarSession({ market: 'KR', date });
    if (session.status === 'unknown') return null;
    const closeMs = session.status === 'open' ? Date.parse(`${date}T${session.close}:00+09:00`) : null;
    if (closeMs != null && closeMs <= nowMs) return Object.freeze({ date, closeMs });
    date = new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return null;
}

function dateOnly(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null;
}

function dateInTimezone(ms, timezone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return null;
  }
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

export function resolveMarketCalendarSession({ market = 'US', date, calendar = null } = {}) {
  const marketKey = String(market).toUpperCase();
  const calendarKey = marketKey === 'KR' || marketKey === 'KRX' ? 'KRX' : 'NYSE';
  const adapter = MARKET_CALENDAR_ADAPTERS[calendarKey];
  const day = dateOnly(date);
  const calendarForDate = day ? MARKET_CALENDAR_REGISTRY[calendarKey][day.slice(0, 4)] : null;
  const unknown = (reason = 'calendar-unavailable') => ({ schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'unknown', reason, timezone: adapter.timezone, dstAware: adapter.dstAware });
  if (!day || !calendarForDate) return unknown();
  if (String(calendarForDate.year) !== day.slice(0, 4)) return unknown('calendar-year-mismatch');
  if (calendar && (calendar !== calendarForDate || String(calendar.year) !== day.slice(0, 4))) return unknown('calendar-year-mismatch');
  const schedule = calendar || calendarForDate;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'weekend', timezone: adapter.timezone, dstAware: adapter.dstAware };
  if (schedule.holidays.includes(day)) return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'holiday', timezone: adapter.timezone, dstAware: adapter.dstAware };
  const close = schedule.halfDays[day] || adapter.regularClose;
  return { schemaVersion: AI_MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'open', session: 'regular', open: adapter.regularOpen, close, halfDay: close !== adapter.regularClose, timezone: adapter.timezone, dstAware: adapter.dstAware };
}

function currentCalendarContext(market, now) {
  const marketKey = String(market).toUpperCase();
  const calendarKey = ['KR', 'KRX'].includes(marketKey) ? 'KRX' : ['US', 'NYSE'].includes(marketKey) ? 'NYSE' : null;
  const adapter = calendarKey ? MARKET_CALENDAR_ADAPTERS[calendarKey] : null;
  const nowMs = new Date(now).getTime();
  if (!adapter || !Number.isFinite(nowMs)) return null;
  const date = dateInTimezone(nowMs, adapter.timezone);
  const session = resolveMarketCalendarSession({ market: calendarKey === 'KRX' ? 'KR' : 'US', date });
  return { calendarKey, date, nowMs, session };
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
