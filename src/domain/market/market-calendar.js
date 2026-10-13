// Pure exchange calendar (NYSE / KRX): registered annual holiday and half-day tables, session resolution, the latest
// completed session and holiday-aware session counting. It imports nothing and has no DOM, network or storage, so the
// domain layer (briefing, signal, themes, market) and the AI layer can both build on it; src/ai/time/market-session.js
// re-exports these names for the AI evidence code and the scripts that already import them from there (P1533).
export const MARKET_TIME_VERSION = 'market-time-evidence.v1';

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

// P1735: the one holiday table. The briefing schedule (src/domain/briefing/schedule.js) derives its holiday rows from
// MARKET_CALENDAR_REGISTRY plus these display names; the classic DATE_ENGINE copy in js/aio-core.js runs before any
// module loads, so it keeps a literal copy that ci-market-session-contract-check.mjs holds equal to this registry.
// A registered date without a name is shown without one, never with a guessed name.
export const MARKET_HOLIDAY_NAMES = Object.freeze({
  KRX: Object.freeze({
    '2026-01-01': '신정', '2026-02-16': '설 연휴', '2026-02-17': '설 연휴', '2026-02-18': '설 연휴', '2026-03-02': '삼일절 대체휴일',
    '2026-05-01': '근로자의 날', '2026-05-05': '어린이날', '2026-05-25': '부처님오신날 대체휴일', '2026-06-03': '지방선거',
    '2026-07-17': '제헌절', '2026-08-17': '광복절 대체휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석 연휴',
    '2026-10-05': '개천절 대체휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절', '2026-12-31': '연말 휴장',
    '2027-01-01': '신정', '2027-02-08': '설 연휴', '2027-02-09': '설 대체휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날', '2027-07-19': '제헌절 대체휴일', '2027-08-16': '광복절 대체휴일', '2027-09-14': '추석 연휴',
    '2027-09-15': '추석 연휴', '2027-09-16': '추석 연휴', '2027-10-04': '개천절 대체휴일', '2027-10-11': '한글날 대체휴일',
    '2027-12-27': '성탄절 대체휴일', '2027-12-31': '연말 휴장'
  }),
  NYSE: Object.freeze({
    '2026-01-01': '신정', '2026-01-19': '마틴 루서 킹 데이', '2026-02-16': '대통령의 날', '2026-04-03': '성금요일',
    '2026-05-25': '메모리얼 데이', '2026-06-19': '준틴스', '2026-07-03': '독립기념일 대체휴일', '2026-09-07': '노동절',
    '2026-11-26': '추수감사절', '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-01-18': '마틴 루서 킹 데이', '2027-02-15': '대통령의 날', '2027-03-26': '성금요일',
    '2027-05-31': '메모리얼 데이', '2027-06-18': '준틴스 대체휴일', '2027-07-05': '독립기념일 대체휴일', '2027-09-06': '노동절',
    '2027-11-25': '추수감사절', '2027-12-24': '성탄절 대체휴일'
  })
});

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
// P1755: formatters are built once per time zone; constructing them per call dominated boot self-time.
const NY_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ZONE_DATE_FORMATTERS = new Map();
function zoneDateFormatter(timeZone) {
  let formatter = ZONE_DATE_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    if (ZONE_DATE_FORMATTERS.size >= 64) ZONE_DATE_FORMATTERS.clear();
    ZONE_DATE_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}
export function nyParts(ms) {
  const p = Object.fromEntries(NY_PARTS_FORMATTER.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
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
const KR_EOD_CONFIRM_GRACE_MS = 30 * 60 * 1000;
export function latestCompletedKrSession(now = Date.now()) {
  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) return null;
  let date = dateInTimezone(nowMs, 'Asia/Seoul');
  for (let i = 0; i < 12 && date; i += 1) {
    const session = resolveMarketCalendarSession({ market: 'KR', date });
    if (session.status === 'unknown') return null;
    const closeMs = session.status === 'open' ? Date.parse(`${date}T${session.close}:00+09:00`) : null;
    // P1533: the 15:30 close is final only after the 30-minute closing-auction and publication grace (legacy lastKrTradingDayEx: 15:30-16:00 is unconfirmed).
    if (closeMs != null && closeMs <= nowMs) return Object.freeze({ date, closeMs, eodConfirmed: nowMs >= closeMs + KR_EOD_CONFIRM_GRACE_MS });
    date = new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return null;
}

export function dateOnly(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null;
}

export function dateInTimezone(ms, timezone) {
  try {
    const parts = Object.fromEntries(zoneDateFormatter(timezone).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch (_) {
    return null;
  }
}

export function resolveMarketCalendarSession({ market = 'US', date, calendar = null } = {}) {
  const marketKey = String(market).toUpperCase();
  const calendarKey = marketKey === 'KR' || marketKey === 'KRX' ? 'KRX' : 'NYSE';
  const adapter = MARKET_CALENDAR_ADAPTERS[calendarKey];
  const day = dateOnly(date);
  const calendarForDate = day ? MARKET_CALENDAR_REGISTRY[calendarKey][day.slice(0, 4)] : null;
  const unknown = (reason = 'calendar-unavailable') => ({ schemaVersion: MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'unknown', reason, timezone: adapter.timezone, dstAware: adapter.dstAware });
  if (!day || !calendarForDate) return unknown();
  if (String(calendarForDate.year) !== day.slice(0, 4)) return unknown('calendar-year-mismatch');
  if (calendar && (calendar !== calendarForDate || String(calendar.year) !== day.slice(0, 4))) return unknown('calendar-year-mismatch');
  const schedule = calendar || calendarForDate;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return { schemaVersion: MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'weekend', timezone: adapter.timezone, dstAware: adapter.dstAware };
  if (schedule.holidays.includes(day)) return { schemaVersion: MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'closed', reason: 'holiday', timezone: adapter.timezone, dstAware: adapter.dstAware };
  const close = schedule.halfDays[day] || adapter.regularClose;
  return { schemaVersion: MARKET_TIME_VERSION, market: adapter.market, date: day, status: 'open', session: 'regular', open: adapter.regularOpen, close, halfDay: close !== adapter.regularClose, timezone: adapter.timezone, dstAware: adapter.dstAware };
}

export function currentCalendarContext(market, now) {
  const marketKey = String(market).toUpperCase();
  const calendarKey = ['KR', 'KRX'].includes(marketKey) ? 'KRX' : ['US', 'NYSE'].includes(marketKey) ? 'NYSE' : null;
  const adapter = calendarKey ? MARKET_CALENDAR_ADAPTERS[calendarKey] : null;
  const nowMs = new Date(now).getTime();
  if (!adapter || !Number.isFinite(nowMs)) return null;
  const date = dateInTimezone(nowMs, adapter.timezone);
  const session = resolveMarketCalendarSession({ market: calendarKey === 'KRX' ? 'KR' : 'US', date });
  return { calendarKey, date, nowMs, session };
}


// P1533: sessions after `fromDate` up to and including `toDate` (or strictly before it with includeEnd:false) on which the
// exchange is open, from the registered calendars. A date in an unregistered year is a weekday when unknownYear is
// 'weekday' (a lag count must never read stale data as aligned) and not a session when it is 'closed' (a gap report must
// not claim a missing session it cannot verify). maxDays bounds the walk.
// P1755: the registered calendars are static, so a (range, market, options) walk is memoised; callers get a copy.
const OPEN_SESSION_MEMO = new Map();
export function openSessionDatesBetween(fromDate, toDate, { market = 'US', includeEnd = true, unknownYear = 'weekday', maxDays = 800 } = {}) {
  const marketKey = String(market).toUpperCase();
  const calendarKey = marketKey === 'KR' || marketKey === 'KRX' ? 'KRX' : 'NYSE';
  const memoKey = `${calendarKey}|${String(fromDate || '')}|${String(toDate || '')}|${includeEnd ? 1 : 0}|${String(unknownYear)}|${String(maxDays)}`;
  const memo = OPEN_SESSION_MEMO.get(memoKey);
  if (memo) return memo.slice();
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);
  if (!from || !to || to <= from) return [];
  const out = [];
  const end = Date.parse(`${to}T12:00:00Z`);
  let cursor = Date.parse(`${from}T12:00:00Z`);
  for (let i = 0; i < maxDays; i += 1) {
    cursor += 86400000;
    if (includeEnd ? cursor > end : cursor >= end) break;
    const date = new Date(cursor).toISOString().slice(0, 10);
    const weekday = new Date(cursor).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const registered = MARKET_CALENDAR_REGISTRY[calendarKey][date.slice(0, 4)];
    if (!registered) {
      if (unknownYear === 'weekday') out.push(date);
      continue;
    }
    if (!registered.holidays.includes(date)) out.push(date);
  }
  if (OPEN_SESSION_MEMO.size >= 5000) OPEN_SESSION_MEMO.clear();
  OPEN_SESSION_MEMO.set(memoKey, out.slice());
  return out;
}

export function countOpenSessionsBetween(fromDate, toDate, market = 'US') {
  return openSessionDatesBetween(fromDate, toDate, { market, includeEnd: true, unknownYear: 'weekday' }).length;
}
