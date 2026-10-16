// v57.81: which market session a public-data/history.json value belongs to.
//
// A history row is keyed by the UTC day the producer ran (`row.date`), and each field holds the latest completed close
// known at that run. For a field written as `previous-completed-close`, the producer stamped `observedAt` with a bar
// boundary from the provider's daily bars (bars are stamped at their OPEN):
//   - normally the open of the bar still in progress — the boundary that ENDED the recorded session, so the session is
//     the one before the local date of `observedAt` (10/14 23:21Z run: WTI 94.14 stamped 10/14 00:00 ET = 10/13 close);
//   - when that boundary passed the row's cut (P1192 boundPreviousCloseToCut), the open of the recorded bar itself, so
//     the session is the local date of `observedAt` (10/15 07:51Z run: WTI 95.09 stamped 10/14 00:00 ET = 10/14 close).
// The two stamps are identical text, and rows before v57.70 carry no `sessionDate`, so a reader dating by `observedAt`
// put the 10/13 close and the 10/14 close on the same session and the 10/12 DXY close on both 10/12 and 10/13.
// They differ in one fact the row keeps: whether a newer bar had opened by the time the value was fetched.
import { resolveMarketCalendarSession } from './market-calendar.js';

const DAY_MS = 86400000;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The zone that names a daily bar's session, and the calendar its sessions follow.
const BAR_ZONE = Object.freeze({
  spx: 'America/New_York', nasdaq: 'America/New_York', ndx: 'America/New_York', dow: 'America/New_York', rut: 'America/New_York',
  vix: 'America/New_York', vix3m: 'America/New_York', vvix: 'America/New_York', tnx: 'America/New_York', tlt: 'America/New_York',
  smh: 'America/New_York',
  dxy: 'America/New_York', wti: 'America/New_York', brent: 'America/New_York', gold: 'America/New_York',
  usdkrw: 'Europe/London', usdjpy: 'Europe/London',
  kospi: 'Asia/Seoul', kosdaq: 'Asia/Seoul',
  btc: 'UTC',
});
// Exchange-calendar sessions for listed indices; futures, FX and DXY trade on US holidays (weekday sessions); BTC daily.
const FIELD_CALENDAR = Object.freeze({
  spx: 'US', nasdaq: 'US', ndx: 'US', dow: 'US', rut: 'US', vix: 'US', vix3m: 'US', vvix: 'US', tnx: 'US', tlt: 'US', smh: 'US',
  kospi: 'KR', kosdaq: 'KR',
});

const FORMATTERS = new Map();
function localDate(ms, zone) {
  let formatter = FORMATTERS.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    FORMATTERS.set(zone, formatter);
  }
  return formatter.format(new Date(ms));
}

function isSessionDay(date, field) {
  if (field === 'btc') return true;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const market = FIELD_CALENDAR[field];
  if (!market) return true;
  const status = resolveMarketCalendarSession({ market, date }).status;
  return status !== 'closed' && status !== 'holiday';
}

function shiftDate(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The session before `date` for this field (weekends, and listed-index holidays, skipped). */
export function previousHistorySession(date, field) {
  if (!VALID_DATE.test(String(date || ''))) return null;
  let cursor = date;
  for (let i = 0; i < 14; i += 1) {
    cursor = shiftDate(cursor, -1);
    if (isSessionDay(cursor, field)) return cursor;
  }
  return null;
}

/**
 * Session of a `previous-completed-close` value from its bar-boundary stamp and fetch time. Null when the field has no
 * declared bar zone or either time is missing — the caller keeps its own dating rule then (never a guess).
 */
export function inferPreviousCloseSession(meta, field) {
  const zone = BAR_ZONE[field];
  const observedMs = Date.parse(String(meta?.observedAt || ''));
  const fetchedMs = Date.parse(String(meta?.fetchedAt || meta?.lastSuccessfulAt || ''));
  if (!zone || !Number.isFinite(observedMs) || !Number.isFinite(fetchedMs)) return null;
  const barDate = localDate(observedMs, zone);
  // A newer bar can only exist once the next session day has begun in the bar's zone (bars open at or after local
  // midnight: 00:00 ET futures, 03:00 ET or 09:30 ET indices, 00:00 London FX, 09:00 KST). If the fetch came after that
  // day began, the stamp is the recorded bar's own open (bounded to the cut); before it, the stamp is the boundary that
  // closed the session before it. Rows written since v57.81 carry an explicit sessionDate and never reach this rule.
  let nextDay = barDate;
  for (let i = 0; i < 14; i += 1) {
    nextDay = shiftDate(nextDay, 1);
    if (isSessionDay(nextDay, field)) break;
  }
  return zoneMidnightMs(nextDay, zone) <= fetchedMs ? barDate : previousHistorySession(barDate, field);
}

const WALL_FORMATTERS = new Map();
function zoneMidnightMs(date, zone) {
  let formatter = WALL_FORMATTERS.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    WALL_FORMATTERS.set(zone, formatter);
  }
  const wallAsUtc = (ms) => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  };
  const naive = Date.parse(`${date}T00:00:00Z`);
  let guess = naive - (wallAsUtc(naive) - naive);
  guess = naive - (wallAsUtc(guess) - guess); // second pass settles a DST change between the two instants
  return guess;
}

/**
 * The session a history field belongs to when the row says so or the stamp determines it: an explicit `sessionDate`,
 * or the inferred session of a `previous-completed-close`. Null otherwise — the caller dates the value by its
 * observation as before. A held (carried-forward) copy is not an observation and has no session of its own here.
 */
export function historyFieldSessionDate(meta, field) {
  if (!meta || meta.observationRelation === 'carried-forward') return null;
  if (VALID_DATE.test(String(meta.sessionDate || ''))) return meta.sessionDate;
  if (meta.observationRelation === 'previous-completed-close' || meta.valueBasis === 'previous-completed-close') return inferPreviousCloseSession(meta, field);
  return dailyBarSessionDate(meta, field);
}

/**
 * A daily bar written by the backfill lane (no valueBasis) is stamped at its open; when that open is local midnight
 * in the bar's zone, the bar's session is that local date. Yahoo FX bars open at 00:00 London (23:00Z in summer), so
 * the 10/9 won bar is stamped 10/08T23:00Z and was read as a 10/8 close beside the real 10/8 bar (P1721 named the
 * same stamp the Friday 10/9 bar). Other stamps return null and keep the caller's dating.
 */
export function dailyBarSessionDate(meta, field) {
  const zone = BAR_ZONE[field];
  const observedMs = Date.parse(String(meta?.observedAt || ''));
  // The backfill lane's marker set: a completed-close relation, a provider stamp, no valueBasis.
  if (!zone || meta?.valueBasis || meta?.observationRelation !== 'latest-completed-close' || meta?.observedAtSource !== 'provider-current' || !Number.isFinite(observedMs)) return null;
  const date = localDate(observedMs, zone);
  return zoneMidnightMs(date, zone) === observedMs ? date : null;
}

/** The session of a provider daily bar stamped at `observedAt` (its open), in the field's bar zone. */
export function barSessionDateForField(field, observedAt) {
  const zone = BAR_ZONE[field];
  const observedMs = Date.parse(String(observedAt || ''));
  return zone && Number.isFinite(observedMs) ? localDate(observedMs, zone) : null;
}

/**
 * Session of a completed-close observation dated by its own time: the Seoul date for Korean indices, the UTC date for
 * BTC, the New York date for everything else (a midnight-UTC stamp already names its date, as the readers treat it).
 */
export function observationSessionDate(field, observedAt) {
  const text = String(observedAt || '');
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  if (FIELD_CALENDAR[field] === 'KR') return localDate(ms, 'Asia/Seoul');
  if (field === 'btc' || /T00:00:00(\.000)?Z$/.test(text)) return new Date(ms).toISOString().slice(0, 10);
  return localDate(ms, 'America/New_York');
}

/** True when the field value is a held copy of an earlier row's session, not an observation. */
export function isHeldHistoryValue(meta) {
  return meta?.observationRelation === 'carried-forward';
}
