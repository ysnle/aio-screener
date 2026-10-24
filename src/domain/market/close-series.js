// v58.64 (architecture audit DOMAIN #8): the completed-close series and its session helpers moved here from
// briefing/market-read.js. Sixteen domain modules (market, macro, cash, stress, sentiment, themes) read one close
// series; they no longer depend on the briefing module for it. briefing/market-read.js re-exports every name, so
// existing imports keep working. The code is moved unchanged.
import { countOpenSessionsBetween, resolveMarketCalendarSession } from './market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { historyFieldSessionDate } from './history-session.js';

export function finite(value) {
  if (value == null || typeof value === 'boolean') return null; // Number(null) is 0, not a reading
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

// A date-only stamp (YYYY-MM-DD or midnight UTC) already names the trading date; converting
// midnight UTC to New York would move it to the previous day.
// P1432: toLocaleDateString builds a time-zone formatter on every call, and this runs for every
// row × field of the close history on each render (≈0.5 s per regime build); one shared formatter
// plus a small memo keeps the same result at a fraction of the cost.
const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const NY_DATE_MEMO = new Map();
function nyDate(iso) {
  const text = String(iso || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(text)) return text.slice(0, 10);
  if (NY_DATE_MEMO.has(text)) return NY_DATE_MEMO.get(text);
  const ms = Date.parse(text);
  const date = Number.isFinite(ms) ? NY_DATE.format(new Date(ms)) : null;
  if (NY_DATE_MEMO.size > 20000) NY_DATE_MEMO.clear();
  NY_DATE_MEMO.set(text, date);
  return date;
}

// T01/M01 (expert review 2026-10-13): a field's dates are the sessions of the market that closes it. 24-hour assets
// (won, yen, DXY, WTI, gold) also trade on Sunday evening and US holidays; that tick (about Friday's close) became its
// own "close", so "20일" spanned 16-17 sessions and the basis chip read 10/11(일). Korean indices use the KRX calendar,
// 24/7 crypto none, everything else the NYSE calendar. An unregistered year falls back to weekdays.
const KR_CLOSE_FIELDS = new Set(['kospi', 'kosdaq']);
const ALL_DAY_FIELDS = new Set(['btc']);
export const closeSessionMarket = (field) => KR_CLOSE_FIELDS.has(field) ? 'KR' : ALL_DAY_FIELDS.has(field) ? null : 'US';
const SESSION_MEMO = new Map();
export function isCloseSessionDate(date, market) {
  if (!market) return true;
  const key = `${market}:${date}`;
  if (!SESSION_MEMO.has(key)) {
    const status = resolveMarketCalendarSession({ market, date }).status;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (SESSION_MEMO.size > 5000) SESSION_MEMO.clear();
    SESSION_MEMO.set(key, status === 'open' || (status === 'unknown' && /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && weekday !== 0 && weekday !== 6));
  }
  return SESSION_MEMO.get(key);
}

// v57.50 C11: New York wall-clock minute at which each field's session settles. Two observations can share one NY
// date — the 16:59:59 ET won settlement (1,340.02) and an evening tick at 23:30 ET (1,340.90) were both "10/9", and the
// later row won. With a settle time known for both stamps, the observation at or just before the settle is kept; one
// after it is used only when nothing earlier exists. Fields without an entry (breadth counts, F&G, Korean indices,
// crypto) and date-only stamps keep the former rule: the later row wins.
const SESSION_CLOSE_NY_MINUTE = Object.freeze({
  spx: 960, nasdaq: 960, ndx: 960, dow: 960, rut: 960, tlt: 960, // NYSE/Nasdaq close 16:00 ET
  vix: 975, vix3m: 975, vvix: 975, // Cboe volatility indices settle 16:15 ET
  tnx: 900, // the 10-year yield index stops at 15:00 ET
  dxy: 1020, wti: 1020, brent: 1020, gold: 1020, usdkrw: 1020, usdjpy: 1020 // FX and futures trading day ends 17:00 ET (P1726: Brent futures too)
});
const NY_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const NY_MINUTE_MEMO = new Map();
function nyMinute(iso) {
  const text = String(iso || '');
  if (!/T\d{2}:\d{2}/.test(text) || /T00:00:00(\.000)?Z$/.test(text)) return null; // date-only stamps carry no time of day
  if (NY_MINUTE_MEMO.has(text)) return NY_MINUTE_MEMO.get(text);
  const ms = Date.parse(text);
  let minute = null;
  if (Number.isFinite(ms)) {
    const parts = Object.fromEntries(NY_CLOCK.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
    minute = Number(parts.hour) * 60 + Number(parts.minute);
  }
  if (NY_MINUTE_MEMO.size > 20000) NY_MINUTE_MEMO.clear();
  NY_MINUTE_MEMO.set(text, minute);
  return minute;
}
// Lower is closer to the settle: at/before it by distance, after it only behind every earlier stamp.
const settleRank = (minute, close) => minute <= close ? close - minute : 10000 + minute - close;

// One value per trading date. The producer stamps a close either near the bell or at its bar start,
// and a later row can carry a late-settling bar (DXY/WTI); key by the observation's own NY date and
// let the later row win unless C11's settle-time preference decides. Carried-forward weekend copies are not
// observations, and neither is an observation dated on a day its market was closed (T01). `through` drops
// observations after the basis date.
// P1755: history arrays are replaced wholesale on reload (never mutated in place), and one render reads the same
// (field, through) series many times, so results are memoised per array identity (+ length guard) and options.
// Callers always receive fresh point objects, so a consumer that edits its copy cannot alter the memo.
const CLOSE_SERIES_MEMO = new WeakMap();
const copyPoints = (points) => points.map((point) => ({ ...point }));
export function buildCloseSeries(history = [], field, { through = null, includeProvenance = false, market = closeSessionMarket(field) } = {}) {
  if (!Array.isArray(history)) return computeCloseSeries(history, field, { through, includeProvenance, market });
  let memo = CLOSE_SERIES_MEMO.get(history);
  if (!memo || memo.length !== history.length) {
    memo = { length: history.length, series: new Map() };
    CLOSE_SERIES_MEMO.set(history, memo);
  }
  const key = JSON.stringify([field, through ?? null, !!includeProvenance, market ?? null]);
  let series = memo.series.get(key);
  if (!series) {
    series = computeCloseSeries(history, field, { through, includeProvenance, market });
    memo.series.set(key, series);
  }
  return copyPoints(series);
}
function computeCloseSeries(history, field, { through, includeProvenance, market }) {
  const byDate = new Map();
  const rankOf = new Map();
  const historyOf = new Map();
  const close = SESSION_CLOSE_NY_MINUTE[field] ?? null;
  const rows = [...(Array.isArray(history) ? history : [])].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  for (const row of rows) {
    const value = finite(row?.[field]);
    if (value == null || (value <= 0 && !/^(breadth|advance|distribution)/.test(field))) continue; // a 0 yield/price is a producer gap, not a close (a 0 count is real)
    const meta = row.fieldMeta?.[field];
    if (meta?.observationRelation === 'carried-forward') continue;
    // v57.70: a previous close stamped at the next bar's 00:00 ET boundary carries its own session date.
    // v57.81: rows written before v57.70 carry none — their previous close is dated from its bar stamp and fetch time
    // (historyFieldSessionDate), so the 10/13 WTI close on the 10/14 row is no longer read as a second 10/14 value.
    const sessionDate = historyFieldSessionDate(meta, field);
    const sessionDated = !!sessionDate;
    const date = sessionDated ? sessionDate : meta?.observedAt ? nyDate(meta.observedAt) : row.date;
    if (!date || (through && date > through) || !isCloseSessionDate(date, market)) continue;
    const minute = close != null && meta?.observedAt ? nyMinute(meta.observedAt) : null;
    // A session-dated previous close is that session's completed bar — as close to the settle as a stamp can be.
    // v57.81: only a previous close; a session-dated backfill bar or closing print keeps C11's settle-time rank.
    const previousClose = meta?.observationRelation === 'previous-completed-close' || meta?.valueBasis === 'previous-completed-close';
    const rank = sessionDated && previousClose && close != null ? 0 : minute == null ? null : settleRank(minute, close);
    const held = rankOf.get(date);
    if (byDate.has(date) && rank != null && held != null && rank > held) continue; // C11: an earlier stamp sits closer to the settle
    // v58.74 (audit: F&G 10/16 showed 18; the recorded close is 22.07): a field without a settle time (F&G) took the later row, so the Saturday live
    // reading re-dated to Friday replaced CNN's own historical close for that day. A historical-graph value
    // (allowedUse 'reference-history') is that day's record; a live reading never overwrites it.
    const recorded = meta?.allowedUse === 'reference-history';
    if (close == null && byDate.has(date) && historyOf.get(date) && !recorded) continue;
    historyOf.set(date, recorded || !!historyOf.get(date));
    rankOf.set(date, rank);
    byDate.set(date, includeProvenance ? { value, observedAt: meta?.observedAt || row.date, source: meta?.source || null, ...(Number.isFinite(meta?.eligible) ? { eligible: meta.eligible } : {}) } : value);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => includeProvenance ? { date, ...value } : { date, value });
}

// The common reference: the S&P 500's last completed close.
export function closeBasis(history = []) {
  const spx = buildCloseSeries(history, 'spx');
  return spx.length ? spx[spx.length - 1].date : null;
}

// P1533: US sessions after `from` up to `to` on the registered exchange calendar. Weekday-only counting read a market
// holiday as a missed session (2026-07-01 -> 07-06 counted 3 and dropped a one-session-old input as stale).
const sessionsBetween = (from, to) => countOpenSessionsBetween(from, to, 'US');

/** How one input's observation date relates to the basis: aligned · lagged · stale · ahead · missing. */
export function alignInput(date, basis, maxLag = 2) {
  const day = date ? nyDate(date) : null;
  if (!day) return { status: 'missing', date: null, lag: null };
  if (!basis) return { status: 'aligned', date: day, lag: 0 };
  if (day > basis) return { status: 'ahead', date: day, lag: 0 };
  const lag = sessionsBetween(day, basis);
  return { status: lag === 0 ? 'aligned' : lag <= maxLag ? 'lagged' : 'stale', date: day, lag };
}

export const isUsable = (alignment) => alignment?.status === 'aligned' || alignment?.status === 'lagged';

/** One short basis chip per card: "9/30", "9/29 · 1거래일 전", "9/24 · 오래됨(판정 제외)". */
export function alignmentLabel(alignment) {
  if (!alignment || alignment.status === 'missing') return '미수신';
  const day = shortDate(alignment.date);
  if (alignment.status === 'aligned') return day;
  if (alignment.status === 'lagged') return `${day}, ${alignment.lag}거래일 전`;
  if (alignment.status === 'ahead') return `${day} 장중, 판정 제외`;
  return `${day}, 오래됨(판정 제외)`;
}

// P1428 (Codex review): n observations are n sessions only when no day is missing. If the session span
// to that point exceeds n plus holiday slack, the producer skipped days and the "5일/20일" change is
// withheld rather than silently covering a longer period. T19: a Korean series counts KRX sessions.
// T01: "n일" is n sessions, not n rows — the point is the first observation at least n sessions back (a missing
// session falls back to the next earlier one inside the slack). A complete series gives the same point as before.
// v57.50 C12: exported so every "n거래일 변화" (home KPI trend, rates/FX) counts sessions the same way.
// v58.69 (live 2026-10-23): a one-session change needs the previous session itself. The two-session slack let "1일"
// read 10/20→10/22 when the 10/21 close was missing (briefing S&P 500 -0.6% for -1.21%, Nasdaq -1.6% for -2.6%).
export function sessionPointBack(series, n, market = 'US') {
  const last = Array.isArray(series) ? series[series.length - 1] : null;
  if (!last) return null;
  const slack = n === 1 ? 0 : Math.max(2, Math.ceil(n * 0.15));
  for (let index = series.length - 2; index >= 0; index -= 1) {
    const gap = countOpenSessionsBetween(series[index].date, last.date, market);
    if (gap >= n) return gap > n + slack ? null : series[index];
  }
  return null;
}

// v57.50 D05/D20: where a value sits in AIO's own recorded history of that series (mid-rank percentile, the regime
// radar's convention), with the record length. A fixed textbook line (분배일 5회, 시장 폭 40/60%) can be crossed on half
// of all recorded days; the percentile says how unusual today is in this sample. Fewer than 252 records is provisional.
export const RECORD_FULL_YEAR = 252;
export function recordPercentile(series, value = null, { window = RECORD_FULL_YEAR } = {}) {
  const points = (Array.isArray(series) ? series : []).filter((point) => Number.isFinite(point?.value)).slice(-window);
  const current = finite(value) ?? points.at(-1)?.value ?? null;
  if (current == null || points.length < 20) return { n: points.length, pct: null, provisional: true };
  const below = points.filter((point) => point.value < current).length;
  const equal = points.filter((point) => point.value === current).length;
  const pct = Math.round((below + Math.max(0, equal - 1) / 2) / Math.max(1, points.length - 1) * 100);
  // v57.81: 1 of 252 rounds to 0%, which read as 최저 for the second-lowest value; the extremes are rank facts.
  const above = points.filter((point) => point.value > current).length;
  return { n: points.length, pct, provisional: points.length < RECORD_FULL_YEAR, lowest: below === 0, highest: above === 0, lowRank: below + 1, highRank: above + 1 };
}
