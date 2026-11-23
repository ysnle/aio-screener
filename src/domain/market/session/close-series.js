import { countOpenSessionsBetween, resolveMarketCalendarSession } from './market-calendar.js';
import { shortDate } from '../../content/date-labels.js';
import { historyFieldSessionDate } from './history-session.js';
import { readNumber as finite } from '../../shared/number.js';
import { isoDay, stampDay } from '../../shared/session-date.js';
import { percentileOf } from '../../shared/percentile.js';
import { historyFieldMeta } from '../indices/history-meta.js';

export { finite };

const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const NY_DATE_MEMO = new Map();
function nyDate(iso) {
  const text = String(iso || '');
  if (isoDay(text) || (stampDay(text) && /T00:00:00(\.000)?Z$/.test(text))) return text.slice(0, 10);
  if (NY_DATE_MEMO.has(text)) return NY_DATE_MEMO.get(text);
  const ms = Date.parse(text);
  const date = Number.isFinite(ms) ? NY_DATE.format(new Date(ms)) : null;
  if (NY_DATE_MEMO.size > 20000) NY_DATE_MEMO.clear();
  NY_DATE_MEMO.set(text, date);
  return date;
}

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
    SESSION_MEMO.set(key, status === 'open' || (status === 'unknown' && isoDay(date) && weekday !== 0 && weekday !== 6));
  }
  return SESSION_MEMO.get(key);
}

const SESSION_CLOSE_NY_MINUTE = Object.freeze({
  spx: 960, nasdaq: 960, ndx: 960, dow: 960, rut: 960, tlt: 960, // NYSE/Nasdaq close 16:00 ET
  vix: 975, vix3m: 975, vvix: 975, // Cboe volatility indices settle 16:15 ET
  tnx: 900, // the 10-year yield index stops at 15:00 ET
  dxy: 1020, wti: 1020, brent: 1020, gold: 1020, silver: 1020, usdkrw: 1020, usdjpy: 1020, eurusd: 1020, gbpusd: 1020, usdcny: 1020, audusd: 1020
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
    const meta = historyFieldMeta(row, field);
    if (meta?.observationRelation === 'carried-forward') continue;
    const sessionDate = historyFieldSessionDate(meta, field);
    const sessionDated = !!sessionDate;
    const date = sessionDated ? sessionDate : meta?.observedAt ? nyDate(meta.observedAt) : row.date;
    if (!date || (through && date > through) || !isCloseSessionDate(date, market)) continue;
    const minute = close != null && meta?.observedAt ? nyMinute(meta.observedAt) : null;
    const previousClose = meta?.observationRelation === 'previous-completed-close' || meta?.valueBasis === 'previous-completed-close';
    const rank = sessionDated && previousClose && close != null ? 0 : minute == null ? null : settleRank(minute, close);
    const held = rankOf.get(date);
    if (byDate.has(date) && rank != null && held != null && rank > held) continue; // C11: an earlier stamp sits closer to the settle
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

/**
 * v59.70 (step 1, one move one number): a field's close-to-close change between two dates, read from the completed
 * close series. A history row that repeats the previous close (a weekend row, or 11/03 carrying 11/02 before the next
 * refresh) is not a close of its own date, so reading rows by date compared a session with itself and printed 0.0%
 * beside every 11/03 earnings reaction. `from` takes the last close on or before it; `to` the last close on or before it,
 * or — with `exactTo` — only a close of that very session (otherwise null: the move is unknown, not flat).
 */
export function closeMoveBetween(history, field, from, to, { exactTo = false } = {}) {
  if (!from || !to) return null;
  const series = buildCloseSeries(history, field, { through: to });
  let start = null; let end = null;
  for (const point of series) {
    if (point.date <= from) start = point;
    if (point.date <= to) end = point;
  }
  if (!start || !end || start.date === end.date || !start.value || (exactTo && end.date !== String(to).slice(0, 10))) return null;
  return { from: start.value, to: end.value, fromDate: start.date, toDate: end.date, pct: (end.value / start.value - 1) * 100 };
}

export const RECORD_FULL_YEAR = 252;
export function recordPercentile(series, value = null, { window = RECORD_FULL_YEAR } = {}) {
  const points = (Array.isArray(series) ? series : []).filter((point) => Number.isFinite(point?.value)).slice(-window);
  const current = finite(value) ?? points.at(-1)?.value ?? null;
  if (current == null || points.length < 20) return { n: points.length, pct: null, provisional: true };
  const below = points.filter((point) => point.value < current).length;
  const pct = Math.round(percentileOf(points.map((point) => point.value), current));
  const above = points.filter((point) => point.value > current).length;
  return { n: points.length, pct, provisional: points.length < RECORD_FULL_YEAR, lowest: below === 0, highest: above === 0, lowRank: below + 1, highRank: above + 1 };
}
