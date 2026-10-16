// P1389: the briefing's "connected read". Owner review 2026-10-02: the briefing restated numbers
// (S&P x, VIX y, WTI z) in five places and never connected them. This pure module turns the
// completed-close history into cross-asset statements — rates vs equities, index vs breadth,
// fear gauge vs credit, dollar vs gold, oil vs yields, Korea vs the US — each citing its numbers.
// Rules are descriptive (what the tape shows), never a trade instruction, and a rule whose
// inputs are missing stays silent instead of guessing.
// P1399 (Codex review 2026-10-03): every input is aligned to one basis — the S&P 500's last
// completed close. Later observations (an in-session snapshot) are dropped, older ones carry their
// lag and are excluded once stale; missing is never read as calm or as stress; a statement keeps
// the observation (text) apart from the interpretation (reading), which is worded as a hypothesis.

import { RULES } from '../rules/thresholds.js';
import { countOpenSessionsBetween, latestCompletedKrSession, latestCompletedUsSession, resolveMarketCalendarSession } from '../market/market-calendar.js';
import { shortDate } from '../content/date-labels.js';
import { historyFieldSessionDate } from '../market/history-session.js';
import { brentWtiFromSeries } from '../macro/macro-signals.js';

const DAY_MS = 86400000;

function finite(value) {
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
  if (alignment.status === 'lagged') return `${day} · ${alignment.lag}거래일 전`;
  if (alignment.status === 'ahead') return `${day} 장중 · 판정 제외`;
  return `${day} · 오래됨(판정 제외)`;
}

// P1428 (Codex review): n observations are n sessions only when no day is missing. If the session span
// to that point exceeds n plus holiday slack, the producer skipped days and the "5일/20일" change is
// withheld rather than silently covering a longer period. T19: a Korean series counts KRX sessions.
// T01: "n일" is n sessions, not n rows — the point is the first observation at least n sessions back (a missing
// session falls back to the next earlier one inside the slack). A complete series gives the same point as before.
// v57.50 C12: exported so every "n거래일 변화" (home KPI trend, rates/FX) counts sessions the same way.
export function sessionPointBack(series, n, market = 'US') {
  const last = Array.isArray(series) ? series[series.length - 1] : null;
  if (!last) return null;
  for (let index = series.length - 2; index >= 0; index -= 1) {
    const gap = countOpenSessionsBetween(series[index].date, last.date, market);
    if (gap >= n) return gap > n + Math.max(2, Math.ceil(n * 0.15)) ? null : series[index];
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

function stats(series, market = 'US') {
  if (!series.length) return null;
  const last = series[series.length - 1];
  const backPoint = (n) => sessionPointBack(series, n, market);
  const back = (n) => backPoint(n)?.value ?? null;
  const point20 = backPoint(20);
  const year = series.filter((point) => Date.parse(point.date) >= Date.parse(last.date) - 365 * DAY_MS).map((point) => point.value);
  const mean = (n) => series.length >= n ? series.slice(-n).reduce((sum, point) => sum + point.value, 0) / n : null;
  const max = Math.max(...year);
  const min = Math.min(...year);
  return {
    date: last.date, value: last.value, d1: back(1), d5: back(5), d20: point20?.value ?? null, d20Date: point20?.date ?? null,
    yearMax: max, yearMin: min, yearPosition: max > min && year.length >= 120 ? (last.value - min) / (max - min) : null,
    ma5: mean(5), ma10: mean(10), ma20: mean(20), ma50: mean(50), ma100: mean(100), ma200: mean(200)
  };
}

const pct = (now, then) => now != null && then ? (now / then - 1) * 100 : null;
const bp = (now, then) => now != null && then != null ? (now - then) * 100 : null;
const signed = (value, digits = 1, unit = '%') => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
const fmt = (value, digits = 2) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// P1633 (owner 2026-10-12): short-term trend = price > 5 > 10 > 20-day averages, long-term trend =
// 20 > 50 > 100 > 200-day averages. 정배열 when every step holds, 역배열 when every step is reversed.
// Strict on both sides: equal neighbours are neither 정배열 nor 역배열 (a flat line is 혼조, not a downtrend).
// M10: a level gap between the 20- and 50-day participation is not a direction. "회복/약해짐" only when the
// 20-day share itself moved that way over the last 20 sessions.
function breadthGapRead(b20, b50, stat) {
  const move = stat?.value != null && stat?.d20 != null ? stat.value - stat.d20 : null;
  const level = `단기(20일선 위 ${fmt(b20, 0)}%) 참여가 중기(${fmt(b50, 0)}%)보다 ${b20 > b50 ? '높습니다' : '낮습니다'}`;
  if (move == null || Math.abs(move) < 5) return ` ${level}.`;
  if (b20 > b50 && move > 0) {
    // v57.81 (audit 2026-10-15): "회복하고 있습니다" on a day the 20-day share fell 4.7pp — the last session is checked first.
    const check = recoveryCheck(stat.value, stat.d1, stat.d20);
    const lastMove = stat.d1 != null ? stat.value - stat.d1 : null;
    if (check === 'reversed') return ` ${level} — 20거래일 동안 ${fmt(move, 0)}%p 늘었지만 마지막 거래일 ${fmt(lastMove, 1)}%p 되밀려, 단기 참여 회복이 이어지는지 확인할 단계입니다.`;
    if (check === 'pullback') return ` ${level} — 20거래일 동안 ${fmt(move, 0)}%p 늘었지만 마지막 거래일 ${fmt(lastMove, 1)}%p 줄어, 회복이 이어지는지 다음 종가로 확인합니다.`;
    return ` ${level} — 20거래일 동안 ${fmt(move, 0)}%p 늘어 단기 참여가 먼저 회복하고 있습니다.`;
  }
  if (b20 < b50 && move < 0) return ` ${level} — 20거래일 동안 ${fmt(Math.abs(move), 0)}%p 줄어 단기 참여가 먼저 약해지고 있습니다.`;
  return ` ${level}(20거래일 변화 ${move > 0 ? '+' : ''}${fmt(move, 0)}%p).`;
}

export function maOrder(values) {
  if (values.some((value) => value == null)) return null;
  const steps = values.slice(1).map((value, index) => values[index] - value);
  return steps.every((step) => step > 0) ? 'up' : steps.every((step) => step < 0) ? 'down' : 'mixed';
}

export function movingAverageStructure(stat) {
  const order = maOrder;
  const label = { up: '정배열', down: '역배열', mixed: '혼조' };
  const short = order([stat?.value, stat?.ma5, stat?.ma10, stat?.ma20]);
  const long = order([stat?.ma20, stat?.ma50, stat?.ma100, stat?.ma200]);
  return {
    short, long,
    shortLabel: short ? label[short] : null, longLabel: long ? label[long] : null,
    shortText: short ? `${label[short]} · 종가 ${fmt(stat.value, 0)} / 5일 ${fmt(stat.ma5, 0)} / 10일 ${fmt(stat.ma10, 0)} / 20일 ${fmt(stat.ma20, 0)}` : null,
    longText: long ? `${label[long]} · 20일 ${fmt(stat.ma20, 0)} / 50일 ${fmt(stat.ma50, 0)} / 100일 ${fmt(stat.ma100, 0)} / 200일 ${fmt(stat.ma200, 0)}` : null
  };
}

const SERIES_FIELDS = ['spx', 'nasdaq', 'ndx', 'rut', 'vix', 'vix3m', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'usdkrw', 'usdjpy', 'breadth50', 'breadth20', 'breadth200', 'advanceRatio',
  // P1416: leadership and index-confirmation evidence (src/domain/market/breadth-signals.js).
  'breadth40', 'breadthNewHighs', 'breadthNewLows', 'breadthUp4', 'breadthDown4', 'distributionDays'];

/**
 * The input contract shared by the briefing read, the regime board and the sentiment board.
 * @param {object} input
 * @param {Array} input.history  public-data/history.json rows
 * @param {object} [input.credit] { hyBp, hyDelta5Bp, hyAsOf, pcr, pcrAsOf, fg, fgAsOf }
 * @param {object} [input.rates] FRED one-week changes in percent plus asOf
 */
// P1651: a Korean index close belongs to its own KRX session (P1628). Capping it at the US basis showed the 10/8 KOSPI
// on 10/12 evening while that day's KRX close (-3.6%) was already published; it is aligned to the latest completed
// KRX session instead and carries its own date.
const KR_SESSION_FIELDS = new Set(['kospi']);
export function krSessionThrough(now = Date.now()) {
  return latestCompletedKrSession(now)?.date || null;
}
// T05 (expert review 2026-10-13): the credit axis read only the level and the 5-day change, so +44bp in 20 sessions to the
// top of the one-year range still read '양호·안정'. The 20-session change comes from the published daily HY OAS series.
export function hyDelta20Bp(macroHistory, through = null) {
  const byDate = new Map();
  for (const row of macroHistory?.series?.hyOas?.observations || []) {
    const date = String(Array.isArray(row) ? row[0] : row?.date || '').slice(0, 10);
    const value = finite(Array.isArray(row) ? row[1] : row?.value);
    if (value != null && /^\d{4}-\d{2}-\d{2}$/.test(date) && (!through || date <= through) && isCloseSessionDate(date, 'US')) byDate.set(date, value);
  }
  const stat = stats([...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value })));
  return stat?.d20 != null ? { value: (stat.value - stat.d20) * 100, date: stat.date, from: stat.d20Date } : null;
}
// v57.81: hysteresis over dated points — on from the first point where enter() holds, off again only where exit() holds.
export function latchedState(points = [], enter, exit) {
  let on = false, since = null;
  for (const point of points) {
    if (enter(point)) { if (!on) since = point.date; on = true; }
    else if (on && exit(point)) { on = false; since = null; }
  }
  return { on, since };
}

const quantile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
};

// v57.81 (audit 2026-10-15): HY +40bp in 20 sessions was the 96th percentile of its own 20-session changes, yet the credit
// axis could not go past 중립. The 20-session changes are measured against the series' own record (last 252); a change at
// or above its 90th percentile (or 2 x widen20dBp while the record is short) enters 부담, and the state holds until the
// 20-session change is back under widen20dBp.
export function hyWidening20Record(macroHistory, through = null) {
  const byDate = new Map();
  for (const row of macroHistory?.series?.hyOas?.observations || []) {
    const date = String(Array.isArray(row) ? row[0] : row?.date || '').slice(0, 10);
    const value = finite(Array.isArray(row) ? row[1] : row?.value);
    if (value != null && /^\d{4}-\d{2}-\d{2}$/.test(date) && (!through || date <= through) && isCloseSessionDate(date, 'US')) byDate.set(date, value * 100);
  }
  const series = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  const rule = RULES.credit;
  const keep = RECORD_FULL_YEAR + rule.latchSessions;
  const changes = [];
  for (let index = Math.max(20, series.length - keep); index < series.length; index += 1) {
    const base = sessionPointBack(series.slice(Math.max(0, index - 40), index + 1), 20);
    if (base) changes.push({ date: series[index].date, value: series[index].value - base.value });
  }
  const last = changes.at(-1);
  if (!last) return null;
  const record = changes.slice(-RECORD_FULL_YEAR).map((point) => point.value);
  const p = record.length >= rule.recordMin ? quantile(record, rule.stress20dPct / 100) : null;
  const multiple = rule.stress20dMultiple * rule.widen20dBp;
  const enterBp = Math.max(rule.widen20dBp, p == null ? multiple : Math.min(p, multiple));
  const latch = latchedState(changes.slice(-rule.latchSessions), (point) => point.value >= enterBp, (point) => point.value < rule.widen20dBp);
  const rank = recordPercentile(changes.slice(-RECORD_FULL_YEAR), last.value);
  return { value: last.value, date: last.date, enterBp, pct: rank.pct, n: rank.n, stress: latch.on, since: latch.since };
}

// v57.81: "회복 중" only when the last session kept the window's gain — a last drop of reversalShare of the gain to the
// previous session is 'reversed', a last drop of lastSessionNoticePp or more is 'pullback', anything else 'holding'.
export function recoveryCheck(now, previous, start) {
  if (![now, previous, start].every(Number.isFinite)) return 'holding';
  const gain = previous - start, lastMove = now - previous;
  if (lastMove < 0 && gain > 0 && -lastMove >= gain * RULES.breadth.reversalShare) return 'reversed';
  if (lastMove <= -RULES.breadth.lastSessionNoticePp) return 'pullback';
  return 'holding';
}

// v57.81: one 20-session USD/KRW window for the 환율 axis and the 원/달러 card. The change counts as a direction only when
// the shift of the 20-session mean agrees (same sign, at least meanShareOfBar of the bar) — an endpoint on a one-day spike
// is not a trend.
export function usdKrwWindow(series = []) {
  const last = series.at(-1);
  const base = sessionPointBack(series, 20);
  if (!last || !base?.value) return null;
  const change = (last.value / base.value - 1) * 100;
  const baseIndex = series.indexOf(base);
  const mean = (points) => points.length === 20 ? points.reduce((sum, point) => sum + point.value, 0) / 20 : null;
  const now = mean(series.slice(-20));
  const then = baseIndex >= 19 ? mean(series.slice(baseIndex - 19, baseIndex + 1)) : null;
  const meanShift = now != null && then ? (now / then - 1) * 100 : null;
  const bar = RULES.fx.krwMove20dPct;
  const agrees = meanShift != null && Math.sign(meanShift) === Math.sign(change) && Math.abs(meanShift) >= bar * RULES.fx.meanShareOfBar;
  return { last, base, change, meanShift, agrees, direction: Math.abs(change) >= bar && agrees ? (change > 0 ? 'weaker' : 'stronger') : null };
}

// v57.81: the one dollar-rise rule (달러·원자재 axis, 거시 '달러 급등' branch). A 20-session rise counts once it is
// RULES.dollar.bufferPct past rise20dPct, or past rise20dPct while the index sits in the top of its own one-year range
// (position, 0-1; null when unknown — then only the buffered line counts).
export function dollarRiseBurden(dxy20, position = null) {
  const D = RULES.dollar;
  if (finite(dxy20) == null) return null;
  return dxy20 >= D.rise20dPct + D.bufferPct || (dxy20 >= D.rise20dPct && finite(position) != null && position >= D.rangeHighAt);
}

// v57.81: the macro screen's Brent/WTI divergence check on the same completed closes, so 시장 and 거시 hold the same oil read.
export function oilCheckOf(history = [], through = null) {
  return brentWtiFromSeries({ brent: buildCloseSeries(history, 'brent', { through }), wti: buildCloseSeries(history, 'wti', { through }), pointBack: sessionPointBack });
}

// v57.50 C01/C02/D01: one credit judgement for every surface (market-state axis, briefing, scenarios, sentiment).
// 'favorable' = low level, not widening over 5 days or 20 sessions, no heavy hedging; 'burden' = stress level or a
// fast 5-day widening, or (v57.81) a 20-session widening in the top of its own record (hy20Stress, with hysteresis);
// everything else is 'neutral'. Callers must not re-derive "calm" from the level alone.
export function creditState({ hyBp = null, hy5 = null, hy20 = null, pcr = null, hy20Stress = false } = {}) {
  if (finite(hyBp) == null) return 'unknown';
  if (hyBp >= RULES.credit.stressAtBp || (hy5 != null && hy5 >= RULES.credit.widen5dBp) || hy20Stress) return 'burden';
  const widening20 = hy20 != null && hy20 >= RULES.credit.widen20dBp;
  if (hyBp < RULES.credit.tightBelowBp && hy5 != null && hy5 <= RULES.credit.calm5dBp && !widening20 /* v57.84: 0 sat inside the 5-day noise (IQR −6~+6bp) */ && (pcr == null || pcr < RULES.credit.putCallHedgeAt)) return 'favorable';
  return 'neutral';
}

// Codex audit F06 (2026-10-15): which input made the credit verdict a 부담 — the level, a fast 5-session widening or a
// 20-session widening at the top of its own record. The macro chain sentence and gauge said "수준이 부담" for a 316bp
// (neutral) level whose 20-session +40bp widening (96th percentile) was the real trigger. One owner, many readers.
export function creditCause({ hyBp = null, hy5 = null, hy20Record = null } = {}) {
  const level = finite(hyBp) != null && hyBp >= RULES.credit.stressAtBp;
  const fast5 = finite(hy5) != null && hy5 >= RULES.credit.widen5dBp;
  const wide20 = hy20Record?.stress === true;
  const primary = level ? 'level' : fast5 ? 'fast5' : wide20 ? 'wide20' : null;
  return { level, fast5, wide20, primary };
}

// P1723 (2026-10-13: KOSPI -5.46%, five sessions -13.8%): the six US axes are judged on US closes, so a Korean shock
// never reached the briefing lead or the axis reads. Where the KOSPI 1- and 5-session changes sit in AIO's own record
// of those changes (last 252 KRX sessions, exact session spans only) decides how prominently the Korean sentence is
// placed. The US axis states are unchanged; this is description and ordering only.
export const KR_SHOCK_TAIL_PCT = 5;
const KR_RECORD_MEMO = new WeakMap();
export function koreaMoveRecord(history = [], { now = Date.now() } = {}) {
  const through = krSessionThrough(now);
  const memo = Array.isArray(history) ? KR_RECORD_MEMO.get(history) : null;
  if (memo && memo.through === through) return memo.result;
  const series = buildCloseSeries(history, 'kospi', { through });
  let result = null;
  if (series.length >= 2) {
    const changes = (n) => {
      const out = [];
      for (let index = n; index < series.length; index += 1) {
        if (countOpenSessionsBetween(series[index - n].date, series[index].date, 'KR') === n) out.push({ date: series[index].date, value: (series[index].value / series[index - n].value - 1) * 100 });
      }
      return out;
    };
    const last = series[series.length - 1];
    const one = changes(1);
    const five = changes(5);
    const latest = (list) => list.at(-1)?.date === last.date ? list.at(-1).value : null;
    const d1 = latest(one);
    const d5 = latest(five);
    const rec1 = d1 == null ? null : recordPercentile(one, d1);
    const rec5 = d5 == null ? null : recordPercentile(five, d5);
    const tailOf = (rec) => rec?.pct == null ? null : Math.min(rec.pct, 100 - rec.pct);
    const tails = [tailOf(rec1), tailOf(rec5)].filter((value) => value != null);
    const tail = tails.length ? Math.min(...tails) : null;
    result = { date: last.date, d1, d5, rec1, rec5, tail1: tailOf(rec1), tail5: tailOf(rec5), tail, extreme: tail != null && tail <= KR_SHOCK_TAIL_PCT };
  }
  if (Array.isArray(history)) KR_RECORD_MEMO.set(history, { through, result });
  return result;
}
/** "하위 6%" — the side of the record a change sits on, never a grade. */
// v57.81: 최저/최고 only at rank 1; a percentile that rounds to 0 or 100 names its rank ("하위 1% 이내(252거래일 중 2번째로 낮음)").
const rankText = (rec, low) => { const rank = low ? rec.lowRank : rec.highRank; return rank ? `(${rec.n}거래일 중 ${rank}번째로 ${low ? '낮음' : '높음'})` : ''; };
export const recordSide = (rec) => rec?.pct == null ? '' : rec.lowest ? '최저' : rec.highest ? '최고' : rec.pct <= 0 ? `하위 1% 이내${rankText(rec, true)}` : rec.pct >= 100 ? `상위 1% 이내${rankText(rec, false)}` : rec.pct <= 50 ? `하위 ${rec.pct}%` : `상위 ${100 - rec.pct}%`;
/** "최근 252거래일 기록에서 하루 하위 6%·5거래일 하위 2%" for the parts of a koreaMoveRecord that are named. */
export function koreaRecordText(record, { maxTail = 100 } = {}) {
  const parts = [[record?.rec1, record?.tail1, '하루'], [record?.rec5, record?.tail5, '5거래일']]
    .filter(([rec, tail]) => rec?.pct != null && tail != null && tail <= maxTail);
  if (!parts.length) return '';
  const n = Math.max(...parts.map(([rec]) => rec.n));
  return `최근 ${n}거래일 기록에서 ${parts.map(([rec, , label]) => `${label} ${recordSide(rec)}`).join('·')}${parts.some(([rec]) => rec.provisional) ? '(기록 1년 미만 · 잠정)' : ''}`;
}

export function alignMarketInputs({ history = [], credit = {}, rates = {}, now = Date.now(), macroHistory = null } = {}) {
  const basis = closeBasis(history);
  const krThrough = krSessionThrough(now);
  const alignments = {};
  const s = {};
  for (const field of SERIES_FIELDS) {
    if (KR_SESSION_FIELDS.has(field) && krThrough) {
      const stat = stats(buildCloseSeries(history, field, { through: krThrough }), 'KR');
      const lag = stat?.date ? countOpenSessionsBetween(stat.date, krThrough, 'KR') : null;
      alignments[field] = !stat ? { status: 'missing', date: null, lag: null } : { status: lag === 0 ? 'aligned' : lag <= 2 ? 'lagged' : 'stale', date: stat.date, lag, market: 'KR' };
      s[field] = stat && lag != null && lag <= 2 ? stat : null;
      continue;
    }
    const stat = stats(buildCloseSeries(history, field, { through: basis }));
    alignments[field] = alignInput(stat?.date, basis);
    s[field] = stat && isUsable(alignments[field]) ? stat : null;
  }
  const fgSeries = buildCloseSeries(history, 'fg', { through: basis });
  const fgLast = fgSeries[fgSeries.length - 1] || null;
  alignments.fg = fgLast ? alignInput(fgLast.date, basis) : alignInput(credit.fgAsOf, basis);
  alignments.hy = alignInput(credit.hyAsOf, basis);
  alignments.pcr = alignInput(credit.pcrAsOf, basis);
  alignments.rates = alignInput(rates.asOf, basis);
  const take = (value, alignment) => finite(value) != null && isUsable(alignment) ? finite(value) : null;
  const hy20 = finite(credit.hyDelta20Bp) != null ? { value: finite(credit.hyDelta20Bp), date: credit.hyAsOf } : hyDelta20Bp(macroHistory, basis);
  const hyRecord = macroHistory ? hyWidening20Record(macroHistory, basis) : null;
  const c = {
    hyBp: take(credit.hyBp, alignments.hy),
    hy5: take(credit.hyDelta5Bp, alignments.hy),
    hy20: hy20 && isUsable(alignInput(hy20.date, basis)) ? hy20.value : null,
    // v57.81: the 20-session widening against its own record (hysteresis); without a record only the 2 x line enters.
    hy20Record: hyRecord && isUsable(alignInput(hyRecord.date, basis)) ? hyRecord : null,
    pcr: take(credit.pcr, alignments.pcr),
    fg: isUsable(alignments.fg) ? (fgLast ? fgLast.value : finite(credit.fg)) : null
  };
  // v57.81: 20-session stress needs the current change at the widen20dBp line and either the latched record state or,
  // without a record, a change of stress20dMultiple x widen20dBp.
  c.hy20Stress = c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp
    && (c.hy20Record ? c.hy20Record.stress : c.hy20 >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);
  const r = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, take(rates[key], alignments.rates)]));
  const day = (value) => String(value || '').slice(0, 10);
  if (rates.realAsOf && rates.breakevenAsOf && day(rates.realAsOf) !== day(rates.breakevenAsOf)) {
    r.realYield10Delta5 = null;
    r.breakeven10Delta5 = null;
    r.splitHeld = `실질금리(${day(rates.realAsOf)})와 기대인플레이션(${day(rates.breakevenAsOf)})의 기준일이 달라 나누지 않았습니다.`;
  }
  return { basis, s, c, r, alignments, fgSeries };
}

// Expert review 2026-10-14: the narrow-market read names S&P 500 members (screener breadth.segments.sp500) when that
// segment covers >= 90% of members on the same close; otherwise it keeps the AIO watch-list wording.
export function sp500BreadthOn(segment, date) {
  const above50 = finite(segment?.above50);
  if (above50 == null || !(finite(segment?.coveragePct) >= 90) || !date || String(segment?.observedAt || '').slice(0, 10) !== String(date).slice(0, 10)) return null;
  return { above50, above200: finite(segment?.above200), eligible: finite(segment?.eligible) };
}

/**
 * @param {object} input see alignMarketInputs; input.breadthSp500 = screener breadth.segments.sp500 (optional)
 */
export function buildMarketRead(input = {}) {
  const { basis, s, c, r } = alignMarketInputs(input);
  const spx = s.spx;
  if (!spx) return { available: false, reason: 'history-missing', statements: [], drivers: [] };
  const { hyBp, pcr, fg } = c;
  const statements = [];
  // text = what the numbers show; reading = the interpretation, worded as a hypothesis.
  const add = (id, weight, text, axis, { check = null, reading = null } = {}) => statements.push({ id, weight, text, reading, axis, check });
  const win20 = (stat) => (stat?.d20Date ? ` (${shortDate(stat.d20Date)} 종가 대비)` : '');

  const spx5 = pct(spx.value, spx.d5);
  const spx20 = pct(spx.value, spx.d20);
  const spxFromHigh = pct(spx.value, spx.yearMax);
  const tnx = s.tnx;
  const tnx5 = tnx ? bp(tnx.value, tnx.d5) : null;
  const tnx20 = tnx ? bp(tnx.value, tnx.d20) : null;
  const real5 = r.realYield10Delta5 == null ? null : r.realYield10Delta5 * 100;
  const bei5 = r.breakeven10Delta5 == null ? null : r.breakeven10Delta5 * 100;

  // 1. Rates vs equities over a week — which force is winning.
  if (tnx5 != null && spx5 != null && Math.abs(tnx5) >= 8) {
    const atHigh = tnx.yearPosition != null && tnx.yearPosition >= 0.95;
    const rateText = `10년물 금리 5일 ${signed(tnx5, 0, 'bp')}(${fmt(tnx.value)}%${atHigh ? ', 1년 최고권' : ''})`;
    if (tnx5 > 0 && spx5 >= 0) add('rates-up-stocks-up', Math.min(95, 40 + tnx5 * 2), `${rateText}에도 S&P 500은 ${signed(spx5)}.`, 'rates', { reading: '주가가 금리 부담을 견디고 있습니다 — 실적·성장 기대가 받치는 것으로 볼 수 있습니다.', check: `금리가 더 오를 때도 주가가 버티는지(10년물 ${fmt(tnx.value)}% 기준)` });
    else if (tnx5 > 0) add('rates-up-stocks-down', Math.min(95, 45 + tnx5 * 2), `${rateText}, S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리 상승이 주가 할인율 부담으로 작용하는 모습입니다.', check: `10년물이 ${fmt(tnx.value)}% 위에서 굳는지, S&P 500이 50일선(${fmt(spx.ma50, 0)})을 지키는지` });
    // v57.84: a falling S&P 500 needs a real move (≥1% over 5 days) before the week is read as growth fear, and the weight
    // stays below a credit sentence — −0.27% on 2026-10-15 led the briefing over HY +16bp.
    else if (spx5 <= -1) add('rates-down-stocks-down', Math.min(70, 45 - tnx5 * 2), `${rateText}에도 S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리보다 성장 둔화 우려가 앞설 가능성이 있습니다 — 경기 지표로 확인이 필요합니다.', check: '다음 경기 지표(고용·ISM)가 둔화를 확인하는지' });
    else if (spx5 >= 0) add('rates-down-stocks-up', Math.min(90, 35 - tnx5 * 2), `${rateText} 속에 S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리 하락이 주가를 받치는 모습입니다.' });
  }
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && !statements.some((row) => row.axis === 'rates')) add('rates-year-high', 70, `10년물 금리 ${fmt(tnx.value)}%는 최근 1년 범위의 최상단입니다(1년 최저 ${fmt(tnx.yearMin)}%).`, 'rates');

  // P1390 (frameworks from owner-supplied material 2026-09-28~30: 윤지호/인포맥스, @laylaperfume daily recaps):
  // (a) what drives the nominal move — real yield (multiple compression) or inflation compensation.
  // Nominal ≈ real + breakeven, so the split itself is arithmetic, not a guess.
  if (real5 != null && bei5 != null && Math.abs(real5 + bei5) >= 8) {
    const realLed = Math.abs(real5) >= Math.abs(bei5);
    add(realLed ? 'real-yield-led' : 'breakeven-led', 78,
      `10년물 5일 변화 중 실질금리 ${signed(real5, 0, 'bp')}·기대인플레 ${signed(bei5, 0, 'bp')}${r.realYield10 != null ? `(실질금리 ${fmt(r.realYield10)}%)` : ''}.`, 'rates',
      { reading: realLed ? '물가보다 실질금리가 금리를 움직여, 주식 밸류에이션(PER)에 더 직접적인 부담입니다.' : '유가·물가 기대가 금리를 움직이는 구간입니다.',
        check: realLed ? '실질금리 상승이 멈추는지 — 멈추지 않으면 성장주 밸류에이션 부담 지속' : '유가와 다음 물가 지표가 기대인플레를 더 밀어 올리는지' });
  }
  // (b) short vs long end — policy expectations or the long end itself;
  // v57.50 C10: the page quotes one 10-year series. The 10-year side is the same close series as "10년물 금리 5일"
  // above, measured over the five sessions ending on the 2-year observation's own date, so both legs share a window;
  // when that date is not the S&P 500 basis the sentence names it.
  const two5 = r.dgs2Delta5 == null ? null : r.dgs2Delta5 * 100;
  const curveDate = String(input.rates?.dgs2AsOf || input.rates?.asOf || '').slice(0, 10) || null;
  let ten5 = null;
  if (two5 != null && curveDate && isUsable(alignInput(curveDate, basis))) {
    const tenSeries = buildCloseSeries(input.history, 'tnx', { through: curveDate });
    const from = tenSeries.at(-1)?.date === curveDate ? sessionPointBack(tenSeries, 5) : null;
    ten5 = from ? bp(tenSeries.at(-1).value, from.value) : null;
  }
  if (two5 != null && ten5 != null) {
    const span = curveDate !== spx.date ? ` (${shortDate(curveDate)}까지 5거래일)` : '';
    if (ten5 >= 8 && ten5 - two5 >= 8) add('bear-steepening', 72, `장기금리(10년 ${signed(ten5, 0, 'bp')})가 단기금리(2년 ${signed(two5, 0, 'bp')})보다 크게 올랐습니다${span}.`, 'rates', { reading: '연준 기대보다 장기 요인(기간 프리미엄·성장·국채 수급)이 주도하는 모양입니다. 이 경우 단기 금리가 안정돼도 위험선호 회복이 늦어질 수 있습니다.' });
    else if (two5 >= 8 && two5 - ten5 >= 8) add('bear-flattening', 72, `단기금리(2년 ${signed(two5, 0, 'bp')})가 장기금리(10년 ${signed(ten5, 0, 'bp')})보다 더 올랐습니다${span}.`, 'rates', { reading: '추가 긴축 기대가 금리를 끌어올리는 모양입니다.' });
  }
  // (c) a weaker dollar with higher long rates points inward (inflation, growth, supply), not to FX.
  const dxyWeek = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  if (dxyWeek != null && tnx5 != null && dxyWeek <= -0.3 && tnx5 >= 8) add('weak-dollar-higher-rates', 55, `달러 5일 ${signed(dxyWeek)}인데 10년물은 ${signed(tnx5, 0, 'bp')}.`, 'rates', { reading: '달러가 약한데 장기금리가 올라, 해외 요인보다 미국 내부 요인(물가·성장·국채 공급)을 먼저 확인할 조합입니다 — 원인을 확정하지는 않습니다.' });

  // 2. Index vs participation.
  const b50 = s.breadth50?.value ?? null;
  const members = sp500BreadthOn(input.breadthSp500, spx.date);
  const narrowB50 = members ? members.above50 : b50;
  const narrowWho = members ? 'S&P 500 구성 종목' : 'AIO 관찰 종목';
  if (b50 != null && spxFromHigh != null) {
    if (spxFromHigh > -RULES.technical.nearHighPct && narrowB50 < RULES.breadth.weakBelow) add('narrow-rally', 85, `S&P 500은 1년 고점 대비 ${signed(spxFromHigh)}로 고점권인데 ${narrowWho} 중 50일선 위 종목은 ${fmt(narrowB50, 0)}%뿐입니다.`, 'index', { reading: '지수 상승이 일부 대형주에 집중된 좁은 장세일 수 있습니다.', check: `${narrowWho} 중 50일선 위 비율이 ${RULES.breadth.weakBelow}% 위로 회복되는지(현재 ${fmt(narrowB50, 0)}%) — 회복 없이 대형주가 꺾이면 지수 하락 폭이 커질 수 있음` });
    else if (b50 >= RULES.breadth.broadAtLeast && spx20 != null && spx20 > 0) add('broad-rally', 55, `AIO 관찰 종목 중 50일선 위 ${fmt(b50, 0)}%, S&P 500 20일 ${signed(spx20)}${win20(spx)} — 상승이 대형주에 그치지 않고 넓게 퍼져 있습니다.`, 'index');
    else if (b50 < 30 && spx20 != null && spx20 < 0) add('broad-weakness', 70, `AIO 관찰 종목 중 50일선 위 ${fmt(b50, 0)}%, S&P 500 20일 ${signed(spx20)}${win20(spx)} — 약세가 시장 전반에 퍼져 있습니다.`, 'index');
  }
  // P1416: leadership and distribution (definitions in src/domain/market/breadth-signals.js).
  const nh = s.breadthNewHighs?.date === spx.date ? s.breadthNewHighs.value : null;
  const nl = s.breadthNewLows?.date === spx.date ? s.breadthNewLows.value : null;
  if (nh != null && nl != null && spxFromHigh != null) {
    if (spxFromHigh > -RULES.technical.nearHighPct && nl > nh && nl >= 10) add('highs-lows-divergence', 76, `S&P 500은 고점권(${signed(spxFromHigh)})인데 52주 신저가 종목 ${fmt(nl, 0)}개가 신고가 ${fmt(nh, 0)}개보다 많습니다.`, 'index', { reading: '지수 아래에서 약해지는 종목이 늘고 있습니다 — 주도주 폭이 좁아지는 괴리입니다.', check: `52주 신고가 종목이 신저가보다 다시 많아지는지(현재 ${fmt(nh, 0)} / ${fmt(nl, 0)})` });
    // Codex browser audit H19: one day's count says where leadership is today, not that it is spreading.
    else if (nh >= 20 && nh >= 3 * Math.max(1, nl)) add('leadership-broadening', 52, `52주 신고가 종목 ${fmt(nh, 0)}개, 신저가 ${fmt(nl, 0)}개(수집 대상 기준, 하루 집계).`, 'index', { reading: '오늘 기준으로 신고가 쪽이 신저가보다 훨씬 많습니다. 확산 중인지는 이 숫자가 며칠 이어지는지로 확인합니다.' });
  }
  const dd = s.distributionDays?.value ?? null;
  // v57.50 D05: the textbook 5-6 line is crossed on about half of AIO's recorded days, so the reading quotes where
  // today's count sits in that record instead of calling every crossing a warning.
  // v57.84 (threshold consolidation): the sentence fires on the same 분배일 line as the leadership check (RULES.leadership,
  // 6 in 25 sessions); it fired at 5 while 주도주 이탈 counted from 6.
  const ddAt = RULES.leadership.distributionDaysAt;
  if (dd != null && dd >= ddAt) {
    const ddSeries = buildCloseSeries(input.history, 'distributionDays', { through: basis });
    const record = recordPercentile(ddSeries, dd);
    const common = ddSeries.length ? Math.round(ddSeries.filter((point) => point.value >= ddAt).length / ddSeries.length * 100) : null;
    const where = record.pct == null ? '' : ` AIO 기록 ${record.n}일 중 ${record.pct}백분위${record.provisional ? '(기록 1년 미만 · 잠정)' : ''}.`;
    add('distribution-cluster', 74, `S&P 500 최근 25거래일 중 ${fmt(dd, 0)}일이 0.2% 이상 하락하면서 거래량이 늘어난 날(분배일)입니다.${where}`, 'index', {
      reading: record.pct != null && record.pct < 80 && common != null
        ? `흔히 25거래일 중 5~6회 이상을 추세 약화 신호로 보지만, AIO 기록에서는 ${common}%의 날이 ${ddAt}회 이상이라 이 숫자만으로 경고라고 단정하지 않습니다.`
        : '매도 압력이 평소보다 많이 쌓인 편입니다 — 흔히 25거래일 중 5~6회 이상을 추세 약화 신호로 봅니다.',
      check: '분배일이 줄어드는지, 지수가 거래량을 동반해 반등하는지' });
  }
  // 3. Leadership: tech and small caps relative to the S&P over a month.
  const ndx20 = s.nasdaq ? pct(s.nasdaq.value, s.nasdaq.d20) : null;
  const rut20 = s.rut ? pct(s.rut.value, s.rut.d20) : null;
  // C25: this series is the Nasdaq Composite; the home KPI cell is the Nasdaq-100 — each names its own index.
  if (ndx20 != null && spx20 != null && Math.abs(ndx20 - spx20) >= 2) add(ndx20 > spx20 ? 'tech-leads' : 'tech-lags', 50, `나스닥 종합 20일 ${signed(ndx20)}${win20(s.nasdaq)} vs S&P 500 ${signed(spx20)}${win20(spx)} — ${ndx20 > spx20 ? '기술주가 상승을 주도' : '기술주가 시장보다 약함'}.`, 'index');
  const hyWeek = c.hy5;
  // v57.50 C01/C02: "안정" only when the shared credit judgement is favorable — level alone missed a +45bp
  // 20-session widening. A neutral credit state names why the credit cause cannot be ruled out.
  const credit = creditState(c);
  const creditCalm = credit === 'favorable';
  const widening20 = c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp;
  if (rut20 != null && spx20 != null && Math.abs(rut20 - spx20) >= 3) {
    const lags = rut20 < spx20;
    add(lags ? 'smallcap-lags' : 'smallcap-leads', lags && creditCalm ? 55 : 45, `러셀 2000 20일 ${signed(rut20)}${win20(s.rut)} vs S&P 500 ${signed(spx20)}${win20(spx)}.`, 'index', {
      reading: !lags ? '위험선호가 중소형주까지 퍼진 모습입니다.'
        // Codex browser audit H19: rate sensitivity is one possible path, not the established cause.
        : creditCalm ? `HY 스프레드(${fmt(hyBp, 0)}bp)가 낮고 5일·20거래일 모두 넓어지지 않아 신용 위험이 원인이라는 신호는 없습니다. 금리 부담이 그럴듯한 설명이지만, 실적 차이·업종 구성·유동성도 같은 결과를 만들 수 있습니다.`
          // v57.86 (live review): below the 350bp level the 부담 comes from the 20-session move, not the level — say which.
          : credit === 'burden' ? `HY 스프레드가 ${hyBp != null && hyBp < RULES.credit.tightBelowBp ? `수준은 낮지만 빠르게 넓어지는 중(${fmt(hyBp, 0)}bp${c.hy20 != null ? `, 20거래일 ${signed(c.hy20, 0, 'bp')}` : ''})` : `부담 구간(${fmt(hyBp, 0)}bp${hyWeek != null ? `, 5일 ${signed(hyWeek, 0, 'bp')}` : ''})`}이라 자금 조달 여건이 중소형주를 누르는 경로일 수 있습니다. 금리 부담, 실적 차이, 업종 구성도 함께 확인합니다.`
            : credit === 'neutral' && widening20 ? `HY 스프레드는 ${fmt(hyBp, 0)}bp로 낮은 편이지만 20거래일 동안 ${signed(c.hy20, 0, 'bp')} 넓어지는 중이라 신용 원인을 배제하지 못합니다. 금리 부담, 실적 차이, 업종 구성도 같은 결과를 만들 수 있습니다.`
              : credit === 'neutral' ? `신용 지표가 중립(HY ${fmt(hyBp, 0)}bp${hyWeek != null ? `, 5일 ${signed(hyWeek, 0, 'bp')}` : ''})이라 신용 원인을 배제하지 못합니다. 금리 부담, 실적 차이, 업종 구성 중 무엇 때문인지는 이 숫자만으로 가려지지 않습니다.`
                : '중소형주가 상대적으로 약합니다. 금리 부담, 실적 차이, 업종 구성 중 무엇 때문인지는 이 숫자만으로 가려지지 않습니다.'
    });
  }
  const adv = s.advanceRatio?.value ?? null;
  const spxDay = pct(spx.value, spx.d1);
  if (adv != null && spxDay != null && s.advanceRatio.date === spx.date) {
    const advPct = adv <= 1 ? adv * 100 : adv;
    if (spxDay <= -0.8 && advPct < 30) add('broad-derisking', 65, `S&P 500 ${signed(spxDay)}, 상승 종목 ${fmt(advPct, 0)}%.`, 'index', { reading: '특정 섹터가 아닌 시장 전반의 고른 위험 축소로 보입니다.' });
    else if (spxDay > 0 && advPct < 45) add('index-defended', /* v57.84: a falling index is not 'defended' */ 62, `S&P 500 ${signed(spxDay)}인데 상승 종목은 ${fmt(advPct, 0)}%.`, 'index', { reading: '지수와 다수 종목의 방향이 갈렸습니다 — 시가총액이 큰 일부 종목이 지수를 받쳤는지 테마 화면의 S&P 500 지도에서 종목별 기여로 확인합니다.' });
  }

  // 4. Fear gauge vs credit: is the fear priced in credit too?
  const vix = s.vix;
  // P1449: level and direction are both observed facts; only (수준 + 방향 + 관측창) together can
  // support the "not yet spread to credit" reading. HY 324bp +44bp/5일 is stress forming, and a
  // level-only gate cannot prove contagion absence — the reading splits on the 5-day change
  // (KNOWLEDGE-BASE: the HY 350bp breakout inverts ' 공포는 신용으로 번지지 않았다').
  // v57.81: a 20-session widening at the top of its own record is the credit axis's 부담 — not "경계선 아래".
  const fearBelow = RULES.fearGreed.fearBelow; // v57.84: one fear line with the F&G band (was a separate 35)
  if (fg != null && fg < fearBelow && hyBp != null && c.hy20Stress) {
    add('fear-with-credit-widening', 80, `F&G ${fmt(fg, 0)}(공포)와 함께 HY 신용 스프레드가 20거래일 ${signed(c.hy20, 0, 'bp')} 넓어졌습니다(${fmt(hyBp, 0)}bp${c.hy20Record?.pct != null ? `, 20거래일 변화 기록 ${c.hy20Record.pct}백분위` : ''}).`, 'risk', {
      reading: hyBp < RULES.credit.tightBelowBp ? '수준은 아직 낮지만 확대 폭이 드문 수준이라, 공포가 신용 시장으로 번지는 중인지 확인할 단계입니다.' : '수준도 경계선을 넘었고 확대 폭이 드문 수준이라, 공포가 신용 시장으로 번지는 중입니다.',
      check: `20거래일 확대가 +${RULES.credit.widen20dBp}bp 아래로 줄어드는지, 수준이 ${RULES.credit.tightBelowBp}bp를 넘는지(현재 ${fmt(hyBp, 0)}bp)`
    });
  } else if (fg != null && fg < fearBelow && hyBp != null && hyBp < RULES.credit.tightBelowBp && vix && vix.value < RULES.volatility.calmBelow) {
    const widening = hyWeek != null && hyWeek >= RULES.credit.widen5dBp / 2;
    const widening20 = c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp; // T05
    add('fear-without-credit-stress', 80, `F&G ${fmt(fg, 0)}(공포)인데 HY 신용 스프레드 ${fmt(hyBp, 0)}bp·VIX ${fmt(vix.value)}는 경계선 아래입니다${hyWeek != null ? ` (HY 5일 ${signed(hyWeek, 0, 'bp')}${c.hy20 != null ? `, 20거래일 ${signed(c.hy20, 0, 'bp')}` : ''})` : ''}.`, 'risk', {
      reading: widening || widening20
        ? `아직 ${RULES.credit.tightBelowBp}bp 아래지만 ${widening ? `5일 ${signed(hyWeek, 0, 'bp')}` : `20거래일 ${signed(c.hy20, 0, 'bp')}`} 확대됐습니다 — 공포가 신용으로 번지지 않았다고 말하려면 확대가 멈추는지 확인이 필요합니다.`
        : creditState({ hyBp, hy5: hyWeek, hy20: c.hy20, pcr: c.pcr, hy20Stress: c.hy20Stress }) === 'favorable' ? '공포가 아직 신용 시장으로 번지지 않았습니다.' : `아직 ${RULES.credit.tightBelowBp}bp 아래지만 5일 변화가 줄지 않아 신용 판정이 양호는 아닙니다 — 번지는지 확인할 단계입니다.`, /* v57.84: 'not spread' only when the shared credit verdict is 양호 */
      check: `HY 스프레드가 ${RULES.credit.tightBelowBp}bp(신용 지표가 양호에서 벗어나는 선)를 넘는지(현재 ${fmt(hyBp, 0)}bp), 5일 확대가 멈추는지(현재 ${hyWeek == null ? '—' : signed(hyWeek, 0, 'bp')})`
    });
  } else if (fg != null && fg > RULES.fearGreed.extremeGreedAbove && vix && vix.value < RULES.volatility.complacentBelow) {
    add('complacency', 60, `F&G ${fmt(fg, 0)}(탐욕)·VIX ${fmt(vix.value)}.`, 'risk', { reading: '낙관이 강하고 변동성 대비가 얇은 상태입니다.' });
  }
  if (hyWeek != null && hyWeek >= RULES.credit.widenWatch5dBp && hyBp != null && hyBp < RULES.credit.stressAtBp) add('credit-widening', 72, `HY 신용 스프레드 5일 ${signed(hyWeek, 0, 'bp')} 확대(${fmt(hyBp, 0)}bp).`, 'risk', { reading: '자금 조달 여건이 빠듯해지는 신호입니다.', check: 'HY 스프레드 확대가 이어지는지 — 이어지면 주식보다 신용이 먼저 위험을 반영' });
  if (hyBp != null && hyBp >= RULES.credit.stressAtBp) add('credit-stress', 85, `HY 신용 스프레드 ${fmt(hyBp, 0)}bp(${RULES.credit.stressAtBp}bp 이상 스트레스 구간).`, 'risk', { reading: '신용 시장이 위험을 가격에 반영하고 있습니다.' });
  if (vix && s.vix3m && s.vix3m.date === vix.date && vix.value / s.vix3m.value >= RULES.volatility.invertedRatioAt) add('vix-inversion', 75, `VIX(${fmt(vix.value)})가 3개월 VIX(${fmt(s.vix3m.value)})보다 높은 역전 상태입니다.`, 'risk', { reading: '단기 스트레스가 중기 기대보다 큽니다.' });
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && vix && vix.value < RULES.volatility.calmBelow /* v57.84: the volatility axis calm line, was 20 */) add('orderly-at-rate-high', 58, `10년물 금리는 1년 최고권인데 VIX는 ${fmt(vix.value)}.`, 'risk', { reading: '금리 부담에도 공포성 매도 신호는 아직 없습니다.' });
  const vix5 = vix ? pct(vix.value, vix.d5) : null;
  if (vix5 != null && vix5 >= RULES.volatility.spike5dPct) add('vix-spike', 75, `VIX 5일 ${signed(vix5, 0)} 급등(${fmt(vix.value)}).`, 'risk');

  // 5. Dollar and gold.
  const dxy5 = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  const gold20 = s.gold ? pct(s.gold.value, s.gold.d20) : null;
  if (s.gold?.yearPosition != null && s.gold.yearPosition >= 0.95) add('gold-high', 55, `금 ${fmt(s.gold.value, 0)}달러로 1년 최고권(20일 ${signed(gold20)}${win20(s.gold)}).`, 'commodities', { reading: dxy5 != null && dxy5 > 0.5 ? '달러 강세에도 오르는 안전자산 수요로 볼 수 있습니다.' : null });
  else if (dxy5 != null && gold20 != null && dxy5 > 1 && gold20 > 3) add('haven-demand', 55, `달러(5일 ${signed(dxy5)})와 금(20일 ${signed(gold20)}${win20(s.gold)})이 함께 상승.`, 'commodities', { reading: '안전자산 선호 신호일 수 있습니다.' });

  if (gold20 != null && tnx20 != null && gold20 <= -3 && tnx20 >= 10 && !statements.some((row) => row.id === 'gold-high')) add('gold-down-rates-up', 60, `금 20일 ${signed(gold20)}${win20(s.gold)}·10년물 20일 ${signed(tnx20, 0, 'bp')}${win20(tnx)}.`, 'commodities', {
    reading: real5 != null && real5 > 0 ? `실질금리도 5일 ${signed(real5, 0, 'bp')} 올라, 실질금리 상승이 금을 누르는 경로와 맞습니다.` : '실질금리 상승이 금을 누르는 경로일 수 있습니다(실질금리 자료로 확인 필요).'
  });
  // 6. Oil and yields — the inflation channel.
  const wti20 = s.wti ? pct(s.wti.value, s.wti.d20) : null;
  // v57.81: when Brent and WTI disagree (the macro screen's oil check), WTI alone does not carry an oil sentence.
  const oilHeld = s.wti ? oilCheckOf(input.history, basis) : null;
  if (oilHeld?.held) add('oil-held', 45, oilHeld.text, 'commodities', { reading: 'WTI 한 가지로 유가 방향이나 물가 경로를 단정하지 않습니다.' });
  else if (wti20 != null && tnx20 != null && wti20 >= 8 && tnx20 >= 15) add('oil-rates-inflation', 80, `WTI 20일 ${signed(wti20)}${win20(s.wti)}·10년물 20일 ${signed(tnx20, 0, 'bp')}${win20(tnx)} 동반 상승.`, 'commodities', {
    reading: bei5 != null && bei5 > 0 ? '기대인플레도 올라, 유가가 물가 기대를 거쳐 금리를 밀어 올리는 경로와 맞습니다.' : '유가가 물가 기대를 거쳐 금리를 밀어 올리는 경로일 수 있습니다.'
  });
  else if (s.wti?.yearPosition != null && s.wti.yearPosition >= RULES.oil.rangeHighAt) add('oil-high', 50, `WTI ${fmt(s.wti.value)}달러, 1년 범위 상단(${fmt(s.wti.yearPosition * 100, 0)}%).`, 'commodities', { reading: '높은 유가는 물가·금리 부담 요인입니다.', check: 'WTI가 1년 범위 상단에 머무는지 — 머물면 다음 물가 지표 부담' }); // P1394: range-relative

  // 7. Korea relative to the US, with the currency. P1723: one sentence carries the KRX session's 1- and 5-session move
  // beside the last US close, each with its own date (the former 5-day and 1-day sentences compared a 10/13 KRX close
  // with a 10/12 US close without saying so). Its weight follows where the move sits in AIO's own KOSPI record, so a
  // rare move reaches the four-sentence lead. P1725: the won joins with its own date when it differs from the KRX date.
  // P1727: a won move inside ±0.5% is 보합권, the same band the 시장 상태 won card uses.
  const kospi = s.kospi;
  const kospi1 = kospi ? pct(kospi.value, kospi.d1) : null;
  const kospi5 = kospi ? pct(kospi.value, kospi.d5) : null;
  const spx1 = pct(spx.value, spx.d1);
  const krw5 = s.usdkrw ? pct(s.usdkrw.value, s.usdkrw.d5) : null;
  const krRecord = kospi ? koreaMoveRecord(input.history, { now: input.now ?? Date.now() }) : null;
  const krRec = krRecord?.date === kospi?.date ? krRecord : null;
  const apart = (kospi5 != null && spx5 != null && Math.abs(kospi5 - spx5) >= 2) || (kospi1 != null && spx1 != null && Math.abs(kospi1 - spx1) >= 1.5);
  if (kospi1 != null && (apart || (krRec?.tail != null && krRec.tail <= 10))) {
    const tail = krRec?.tail ?? null;
    const weight = tail == null || tail > 10 ? 45 : tail <= 2 ? 84 : tail <= KR_SHOCK_TAIL_PCT ? 76 : 58;
    const usText = spx1 == null ? '' : ` · 직전 미국장(${shortDate(spx.date)}) S&P 500 ${signed(spx1)}${spx5 != null ? `(5거래일 ${signed(spx5)})` : ''}`;
    const fxDate = s.usdkrw?.date && s.usdkrw.date !== kospi.date ? `${shortDate(s.usdkrw.date)}까지 ` : '';
    const krwText = krw5 == null ? '' : ` · 원/달러 ${fxDate}5거래일 ${signed(krw5)}(${Math.abs(krw5) < RULES.fx.krwFlatPct ? '보합권' : krw5 > 0 ? '원화 약세' : '원화 강세'})`;
    const where = koreaRecordText(krRec, { maxTail: 10 });
    const rare = tail != null && tail <= KR_SHOCK_TAIL_PCT;
    add('korea-relative', weight, `코스피 ${shortDate(kospi.date)} ${signed(kospi1)}${kospi5 != null ? `(5거래일 ${signed(kospi5)})` : ''}${usText}${krwText}.${where ? ` 코스피 변화는 ${where}입니다.` : ''}`, 'korea', {
      reading: rare ? '미국 6개 지표 판정은 미국 종가로만 내려 이 움직임을 반영하지 않습니다 — 한국 고유 요인인지, 대형주에 몰린 움직임인지 표본 종목 전반으로 번졌는지는 시장 상태의 한국 시장 참고에서 따로 확인합니다.' : null,
      // v57.86 (live review): the check asked what 시장 상태 already answers (sample median, share falling) — it now names what to watch next.
      check: rare ? `다음 한국 거래일에 코스피가 ${kospi1 < 0 ? '하락' : '상승'}을 이어가는지와 원/달러가 함께 움직이는지 — 표본 종목 전반의 하락 폭은 시장 상태의 한국 시장 참고에 있습니다` : null });
  }

  statements.sort((a, b) => b.weight - a.weight);
  // The lead block shows the four strongest statements; driver rows add only the rest, so no
  // sentence appears twice on the page.
  const lead = statements.slice(0, 4);
  const restFor = (axis) => statements.filter((row) => row.axis === axis && !lead.includes(row)).map(({ text, reading }) => ({ text, reading }));
  const ma = (stat, label) => stat?.ma50 && stat?.ma200 ? `${label} 50일선 ${stat.value > stat.ma50 ? '위' : '아래'} · 200일선 ${stat.value > stat.ma200 ? '위' : '아래'}` : null;
  // P1599 (F101): structured moves for the briefing chart. Percent assets share one axis; the 10-year yield
  // moves in basis points and is kept apart so the two units never share a scale.
  const moves = [
    ['S&P 500', spx], ['나스닥 종합', s.nasdaq], ['달러 인덱스', s.dxy], ['WTI', s.wti], ['금', s.gold], ['코스피', s.kospi], ['원/달러', s.usdkrw]
  ].map(([label, stat]) => ({ label, unit: '%', neutral: label === '달러 인덱스' || label === '원/달러', d1: stat ? pct(stat.value, stat.d1) : null, d5: stat ? pct(stat.value, stat.d5) : null }))
    .concat(tnx ? [{ label: '미 10년물', unit: 'bp', d1: bp(tnx.value, tnx.d1), d5: tnx5 }] : [])
    .filter((row) => Number.isFinite(row.d1) || Number.isFinite(row.d5));
  // v57.77: the move chart above the cards already draws each asset's 1-day and 5-day move, so a card for an asset
  // in `moves` carries only its level. The archived facts have no chart, so they keep the level with its moves
  // (the 10-year yield keeps its bp wording there).
  const charted = new Set(moves.map((row) => row.label));
  const withMoves = {};
  const level = (label, stat, digits = 2, unit = '') => {
    if (!stat) return null;
    const shown = `${fmt(stat.value, digits)}${unit}`;
    withMoves[label] = label === '미 10년물'
      ? `${shown} (1일 ${signed(bp(stat.value, stat.d1), 1, 'bp')}, 5일 ${signed(tnx5, 0, 'bp')})`
      : `${shown} (1일 ${signed(pct(stat.value, stat.d1))}, 5일 ${signed(pct(stat.value, stat.d5))})`;
    return charted.has(label) ? shown : withMoves[label];
  };
  const drivers = [
    { id: 'index', title: '지수 · 시장 폭', values: [['S&P 500', level('S&P 500', spx)], ['나스닥 종합', level('나스닥 종합', s.nasdaq)], ['50일선 위 종목', b50 == null ? null : `${fmt(b50, 0)}%`]], context: ma(spx, 'S&P 500'), reads: restFor('index') },
    { id: 'rates', title: '금리 · 달러', values: [['미 10년물', level('미 10년물', tnx, 2, '%')], ['달러 인덱스', level('달러 인덱스', s.dxy)]], context: null, reads: restFor('rates') },
    { id: 'commodities', title: '원자재', values: [['WTI', level('WTI', s.wti)], ['금', level('금', s.gold, 0)]], context: null, reads: restFor('commodities') },
    { id: 'risk', title: '변동성 · 위험선호', values: [['VIX', vix ? `${fmt(vix.value)} (5일 ${signed(vix5, 0)})` : null], ['HY 스프레드', hyBp == null ? null : `${fmt(hyBp, 0)}bp`], ['풋/콜', pcr == null ? null : fmt(pcr)], ['F&G', fg == null ? null : fmt(fg, 0)]], context: null, reads: restFor('risk') },
    { id: 'korea', title: '한국', values: [['코스피', level('코스피', s.kospi)], ['원/달러', level('원/달러', s.usdkrw, 1)]], context: null, reads: restFor('korea') }
  ].map((row) => ({ ...row, values: row.values.filter(([, value]) => value) }));
  const headline = statements[0] || null;
  // P1602: archive values and provenance come from the same filtered observations as the screen.
  const factFields = { 'S&P 500': 'spx', '나스닥 종합': 'nasdaq', '미 10년물': 'tnx', '달러 인덱스': 'dxy', 'WTI': 'wti', '금': 'gold', '코스피': 'kospi', '원/달러': 'usdkrw', '50일선 위 종목': 'breadth50', VIX: 'vix', 'F&G': 'fg' };
  const creditFields = { 'HY 스프레드': 'hy', '풋/콜': 'pcr', 'F&G': 'fg' };
  const facts = drivers.flatMap((driver) => driver.values.map(([label, value]) => {
    const field = factFields[label];
    const point = field ? buildCloseSeries(input.history, field, { through: KR_SESSION_FIELDS.has(field) ? (krSessionThrough(input.now ?? Date.now()) || basis) : basis, includeProvenance: true }).at(-1) : null;
    const key = creditFields[label];
    return { label, value: withMoves[label] || value, observedAt: point?.observedAt || input.credit?.[`${key}AsOf`] || null,
      source: point?.source || (!point ? input.credit?.[`${key}Source`] : null) || null,
      basis: point ? '저장된 일별 종가 기록' : '각 관측일 기준 참고값' };
  }));
  return {
    available: true,
    asOf: basis,
    headline: headline?.text || null,
    headlineReading: headline?.reading || null,
    points: lead.slice(1).map(({ text, reading }) => ({ text, reading })),
    checks: [...new Set(statements.filter((row) => row.check).map((row) => row.check))].slice(0, 3),
    statements,
    drivers,
    facts,
    moves
  };
}

// P1392 (owner decision 2026-10-02): the 0-100 environment score showed no predictive power
// (P714), double-counted VIX and missed the rates trend, real yields, FX and term structure. The
// 시장 상태 screen now shows six axes, each with a state, the evidence numbers, one reading and
// the condition that would flip it. States are descriptive (양호/중립/부담), never instructions.
// P1399: a state is decided only from inputs that are present and aligned; one present input never
// stands in for a missing one, and the flip text quotes the same thresholds the rule uses.
const STATE_LABELS = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담', unknown: '확인 불가' });
export const MIN_KNOWN_AXES = 4; // of the six US axes, before an overall label is shown

// v57.81 (owner 2026-10-15): "소수 종목 주도" assumed the leaders were still holding. The leadership proxy is the
// Nasdaq-100 (the history has no semiconductor series). A break needs the proxy weakening (5-session drop of
// RULES.trend.leaderDrop5dPct or a close under its 50-day line) AND at least RULES.leadership.minConfirmations market-wide
// confirmations; the session counts (new highs/lows, advancers, distribution days) count only on the basis close.
// state: 'break' | 'weak' | 'holding' | 'unknown' (missing inputs could still decide it — never read as holding).
// v57.83 crash replay (owner 2026-10-16: "지수는 덜 빠져도 AI·반도체는 많이 빠졌다"): on 2026-07-28 the Nasdaq-100 was 9.5%
// under its one-year high and 5.8% under its 50-day line, but the single-session confirmations had not fired, and the
// state read 'holding' — the AI packet then said "주도 영역 이탈: 아니오". A weak proxy without the confirmations is now
// 'weak' (주도주 약세 · 확산 미확인), never 'holding'; and "under the 50-day line" needs RULES.trend.bufferPct (R707) —
// 2026-08-06 read a break at -0.0% in a +4.5% week.
export function leadershipBreakOf(s = {}, basis = null) {
  const rule = RULES.leadership;
  const ndx = s?.ndx;
  if (!ndx || ndx.ma50 == null) return { available: false, break: false, state: 'unknown', proxy: 'ndx', proxyLabel: '나스닥 100', proxyWeak: null, drop5: null, belowMa50: null, confirmations: [], met: 0, known: 0, need: rule.minConfirmations };
  const onBasis = (stat) => stat && (!basis || stat.date === basis) ? stat : null;
  const drop5 = pct(ndx.value, ndx.d5);
  const belowMa50 = ndx.value < ndx.ma50 * (1 - RULES.trend.bufferPct / 100);
  const offHigh = ndx.yearMax ? pct(ndx.value, ndx.yearMax) : null;
  const proxyWeak = (drop5 != null && drop5 <= -RULES.trend.leaderDrop5dPct) || belowMa50;
  const highs = onBasis(s.breadthNewHighs), lows = onBasis(s.breadthNewLows), adv = onBasis(s.advanceRatio), dist = onBasis(s.distributionDays), rut = s.rut;
  const advRatio = adv ? (adv.value > 1 ? adv.value / 100 : adv.value) : null;
  const confirmations = [
    { id: 'newLows', label: '52주 신저가가 신고가보다 많음', ok: highs && lows ? lows.value > highs.value : null, value: highs && lows ? `신저가 ${fmt(lows.value, 0)} · 신고가 ${fmt(highs.value, 0)}` : null },
    { id: 'advance', label: `마감일 상승 종목 ${fmt(rule.advanceRatioWeakBelow * 100, 0)}% 미만`, ok: advRatio == null ? null : advRatio < rule.advanceRatioWeakBelow, value: advRatio == null ? null : `상승 종목 ${fmt(advRatio * 100, 0)}%` },
    { id: 'distribution', label: `분배일 ${rule.distributionDaysAt}일 이상`, ok: dist ? dist.value >= rule.distributionDaysAt : null, value: dist ? `분배일 ${fmt(dist.value, 0)}일` : null },
    { id: 'smallcaps', label: '러셀 2000이 200일선 아래', ok: rut?.ma200 != null ? rut.value < rut.ma200 : null, value: rut?.ma200 != null ? `러셀 2000 200일선 대비 ${signed(pct(rut.value, rut.ma200))}` : null }
  ];
  const met = confirmations.filter((item) => item.ok === true).length;
  const known = confirmations.filter((item) => item.ok != null).length;
  const broken = proxyWeak && met >= rule.minConfirmations;
  const undecided = proxyWeak && !broken && met + (confirmations.length - known) >= rule.minConfirmations;
  const proxyText = `나스닥 100 5거래일 ${signed(drop5)}${belowMa50 ? ` · 50일선 ${signed(pct(ndx.value, ndx.ma50))}` : ''}${proxyWeak && offHigh != null ? ` · 1년 고점 대비 ${signed(offHigh)}` : ''}`;
  return { available: true, break: broken, state: broken ? 'break' : undecided ? 'unknown' : proxyWeak ? 'weak' : 'holding', proxy: 'ndx', proxyLabel: '나스닥 100',
    proxyWeak, drop5, belowMa50, offHigh, date: ndx.date, confirmations, met, known, need: rule.minConfirmations,
    summary: [proxyText, ...confirmations.filter((item) => item.ok).map((item) => item.value)].join(' · ') };
}

// v57.81: one evidence line per index — level, distance to its own 50/200-day lines and to its one-year high.
const indexPositionText = (stat, extra = '') => !stat ? null : [fmt(stat.value), stat.ma50 != null ? `50일선 ${signed(pct(stat.value, stat.ma50))}` : null,
  stat.ma200 != null ? `200일선 ${signed(pct(stat.value, stat.ma200))}` : null, stat.yearMax ? `1년 고점 대비 ${signed(pct(stat.value, stat.yearMax))}` : null, extra || null].filter(Boolean).join(' · ');

export function buildMarketRegime(input = {}) {
  const { basis, s, c, r, alignments } = alignMarketInputs(input);
  const spx = s.spx;
  if (!spx) return { available: false, axes: [], reason: 'history-missing' };
  const axis = (id, title, state, evidence, read, flip, basisOf, valueAsOf = null) => {
    const shown = evidence.map(([label, value], index) => ({ label, value, iso: value == null ? null : valueAsOf?.[index]?.date || null }))
      .filter((row) => row.value != null && row.value !== '—');
    const days = [...new Set(shown.map((row) => row.iso).filter(Boolean))].sort();
    const mixed = days.length > 1;
    return {
      id, title, state, stateLabel: STATE_LABELS[state], read, flip,
      evidence: shown.map((row) => [row.label, mixed && row.iso ? `${row.value} · ${shortDate(row.iso)}` : row.value]),
      basis: mixed ? `${shortDate(days[0])}~${shortDate(days[days.length - 1])}` : basisOf ? alignmentLabel(basisOf) : null,
      basisStatus: mixed ? 'mixed' : basisOf?.status || null
    };
  };
  const staleRead = (label, alignment) => alignment?.status === 'stale' || alignment?.status === 'ahead'
    ? `${label} 최근 관측(${alignmentLabel(alignment)})이 기준일(${shortDate(basis)})과 달라 판정에서 제외했습니다.` : `${label} 기록이 없습니다.`;
  const axes = [];

  // 1. Trend — S&P 500 against its own averages and the 50-day slope.
  // v57.81 (owner 2026-10-15): 양호 needs the close at least RULES.trend.bufferPct above a rising 50-day line (a 0.15%
  // margin read 양호 while the leaders fell 3.9% in a week); inside ±bufferPct the index is testing the line (중립). The axis
  // stays S&P 500-based, but the Nasdaq-100 and Russell 2000 are shown beside it, and when the small caps are under their
  // 200-day line while the Nasdaq-100 fell RULES.trend.leaderDrop5dPct in five sessions the state is capped at 중립.
  const leadership = leadershipBreakOf(s, basis);
  let trendCap = null;
  {
    const series = buildCloseSeries(input.history, 'spx', { through: basis });
    const ma50Then = series.length >= 70 ? series.slice(-70, -20).reduce((sum, point) => sum + point.value, 0) / 50 : null;
    const rising = spx.ma50 != null && ma50Then != null ? spx.ma50 > ma50Then : null;
    const fromHigh = pct(spx.value, spx.yearMax);
    const buffer = RULES.trend.bufferPct;
    const gap50 = spx.ma50 ? pct(spx.value, spx.ma50) : null;
    const testing = gap50 != null && Math.abs(gap50) < buffer;
    let state = 'neutral';
    if (spx.ma50 == null || spx.ma200 == null || rising == null) state = 'unknown';
    else if (gap50 >= buffer && spx.ma50 > spx.ma200 && rising) state = 'favorable';
    else if (spx.value < spx.ma200 || (gap50 <= -buffer && !rising)) state = 'burden';
    const ndx = s.ndx, rut = s.rut;
    const ndx5 = ndx ? pct(ndx.value, ndx.d5) : null;
    const smallBelow200 = rut?.ma200 != null && rut.value < rut.ma200;
    const leadersFalling = ndx5 != null && ndx5 <= -RULES.trend.leaderDrop5dPct;
    // The cap names why the S&P 500 alone is not read as 양호; it applies whether or not the buffer already held it at 중립.
    const capped = state !== 'burden' && state !== 'unknown' && smallBelow200 && leadersFalling;
    if (capped && state === 'favorable') state = 'neutral';
    trendCap = capped ? { ndx5, rutVs200: pct(rut.value, rut.ma200), date: spx.date } : null;
    const capRead = capped ? ` 나스닥 100이 5거래일 ${signed(ndx5)} 밀렸고 러셀 2000은 200일선 아래(${signed(trendCap.rutVs200)})라, 주도 대형주와 중소형주가 함께 약해지는 중입니다 — S&P 500 하나만 보고 추세가 양호하다고 읽지 않습니다.` : '';
    const nd20 = s.nasdaq ? pct(s.nasdaq.value, s.nasdaq.d20) : null;
    const structure = movingAverageStructure(spx);
    const horizon = structure.short && structure.long
      ? ` 단기(5·10·20일)는 ${structure.shortLabel}, 장기(20·50·100·200일)는 ${structure.longLabel}${structure.short !== structure.long ? ' — 두 기간의 방향이 달라 단기 흐름이 장기 추세로 이어지는지 확인할 구간입니다' : ''}.` : '';
    const baseRead = state === 'favorable' ? `지수가 오르는 50일선보다 ${signed(gap50)} 위에 있고 50일선이 200일선 위 — 상승 추세가 유지되고 있습니다.`
      : state === 'burden' ? (spx.value < spx.ma200 ? 'S&P 500이 200일선 아래 — 장기 추세가 꺾였습니다.' : 'S&P 500이 하락하는 50일선 아래 — 단기 추세가 약해졌습니다.')
        : state === 'unknown' ? '이동평균 계산에 필요한 종가 기록(200거래일 이상)이 부족합니다.'
          // T21: 중립 covers several shapes; each is named instead of a blanket "추세는 유지되지만".
          : spx.ma50 < spx.ma200 ? 'S&P 500은 200일선 위지만 50일선이 200일선 아래 — 장기 추세 회복이 아직 확인되지 않은 혼조 상태입니다.'
            : testing ? `S&P 500이 50일선과 ${signed(gap50)} 차이 — 50일선을 시험하는 구간입니다. 50일선보다 ${buffer}% 이상 위에서 마감해야 상승 추세 유지로, ${buffer}% 넘게 아래면 약화로 봅니다.`
              : spx.value < spx.ma50 ? 'S&P 500이 오르는 50일선 아래로 내려왔지만 200일선 위 — 단기 조정인지 추세 약화인지 확인할 구간입니다.'
                : capped ? 'S&P 500은 오르는 50일선 위입니다.'
                  : '지수는 50일선·200일선 위지만 50일선이 내려가기 시작해 상승 탄력이 약해진 상태입니다.';
    const read = baseRead + capRead + horizon;
    const up = spx.ma50 != null ? spx.ma50 * (1 + buffer / 100) : null;
    const down = spx.ma50 != null ? spx.ma50 * (1 - buffer / 100) : null;
    const capFlip = capped ? ` (러셀 2000이 200일선을 되찾거나 나스닥 100의 5거래일 낙폭이 ${RULES.trend.leaderDrop5dPct}% 안으로 줄어야 함)` : '';
    const flip = state === 'unknown' ? null
      : state === 'favorable' ? `S&P 500이 50일선+${buffer}%(${fmt(up, 0)}) 아래로 마감하면 중립, 200일선(${fmt(spx.ma200, 0)}) 아래면 부담`
        : state === 'burden' ? `S&P 500이 200일선(${fmt(spx.ma200, 0)})과 50일선(${fmt(spx.ma50, 0)}) 위로 회복하면 완화`
          : `S&P 500이 상승하는 50일선보다 ${buffer}% 이상 위(${fmt(up, 0)} 이상)에서 마감하고 50일선이 200일선 위면 양호${capFlip} · 200일선(${fmt(spx.ma200, 0)}) 아래이거나 하락하는 50일선보다 ${buffer}% 넘게 아래(${fmt(down, 0)} 미만)면 부담`;
    const rows = [
      ['S&P 500', `${fmt(spx.value)} (20일 ${signed(pct(spx.value, spx.d20))})`, alignments.spx],
      ['50일선 대비', gap50 == null ? null : `${signed(gap50, 2)} (양호 기준 +${buffer}% 이상)`, alignments.spx],
      ['단기 추세 (종가>5>10>20일선)', structure.shortText, alignments.spx],
      ['장기 추세 (20>50>100>200일선)', structure.longText, alignments.spx],
      ['50일선 / 200일선', spx.ma50 != null && spx.ma200 != null ? `${fmt(spx.ma50, 0)} / ${fmt(spx.ma200, 0)}` : null, alignments.spx],
      ['50일선 방향', rising == null ? null : rising ? '상승' : '하락', alignments.spx],
      ['1년 고점 대비', fromHigh == null ? null : signed(fromHigh), alignments.spx],
      // v57.81: the leadership proxy and the small caps against their own lines, each dated by its own close.
      ['나스닥 100', indexPositionText(ndx, ndx5 == null ? '' : `5거래일 ${signed(ndx5)}`), alignments.ndx],
      ['러셀 2000', indexPositionText(rut, rut ? `5거래일 ${signed(pct(rut.value, rut.d5))}` : ''), alignments.rut],
      ['나스닥 종합 20일', nd20 == null ? null : signed(nd20), alignments.nasdaq],
      // P1416: O'Neil distribution days — evidence only; the trend rule is unchanged.
      ['분배일 (최근 25거래일)', s.distributionDays ? `${fmt(s.distributionDays.value, 0)}일` : null, alignments.distributionDays]
    ];
    axes.push(axis('trend', '추세', state, rows.map(([label, value]) => [label, value]), read, flip, alignments.spx, rows.map((row) => row[2])));
    axes[axes.length - 1].testing = state === 'neutral' && testing;
    axes[axes.length - 1].capped = capped;
    axes[axes.length - 1].leadership = leadership;
  }
  // 2. Breadth — participation behind the index. Both windows must be present to call it broad.
  {
    const b20 = s.breadth20?.value ?? null;
    const b50 = s.breadth50?.value ?? null;
    const b200 = s.breadth200?.value ?? null;
    const adv = s.advanceRatio?.value ?? null;
    const advPct = adv == null ? null : adv <= 1 ? adv * 100 : adv;
    const rut20 = s.rut ? pct(s.rut.value, s.rut.d20) : null;
    const spx20 = pct(spx.value, spx.d20);
    let state = 'neutral';
    if (b50 == null && b200 == null) state = 'unknown';
    else if ((b50 != null && b50 < RULES.breadth.weakBelow) || (b200 != null && b200 < RULES.breadth.weakBelow)) state = 'burden';
    else if (b50 != null && b200 != null && b50 >= RULES.breadth.broadAtLeast && b200 >= RULES.breadth.broadAtLeast) state = 'favorable';
    const fromHigh = pct(spx.value, spx.yearMax);
    const narrow = state === 'burden' && fromHigh != null && fromHigh > -RULES.technical.nearHighPct;
    const members = sp500BreadthOn(input.breadthSp500, spx.date);
    const narrowWho = members && members.above50 < RULES.breadth.weakBelow ? `S&P 500 구성 종목 중 50일선 위 ${fmt(members.above50, 0)}%로`
      : `AIO 관찰 종목 가운데 이동평균선 위 비율이 낮은${members ? `(S&P 500 구성 종목은 50일선 위 ${fmt(members.above50, 0)}%)` : ''}`;
    const partial = state !== 'unknown' && (b50 == null || b200 == null) ? ` (${b50 == null ? '50일선' : '200일선'} 비율 미수신 — 나머지 하나로만 판단)` : '';
    // v57.50 D20: the 40/60 lines are conventions; beside them, where today's ratio sits in AIO's own record
    // (one-year window, provisional while the record is shorter than 252 sessions).
    const recordOf = (field, value) => value == null ? null : recordPercentile(buildCloseSeries(input.history, field, { through: basis }), value);
    const rec50 = recordOf('breadth50', b50);
    const rec200 = recordOf('breadth200', b200);
    const recordText = (rec) => rec?.pct == null ? '' : ` · 기록 ${rec.n}일 중 ${rec.pct}백분위${rec.provisional ? '(잠정)' : ''}`;
    const recordRead = rec50?.pct == null ? '' : ` 50일선 위 비율 ${fmt(b50, 0)}%는 AIO 자체 기록 ${rec50.n}일 중 ${rec50.pct}백분위입니다${rec50.provisional ? `(기록 ${RECORD_FULL_YEAR}거래일 미만 · 잠정)` : ''}.`;
    const read = (state === 'favorable' ? '상승이 다수 종목으로 퍼져 있습니다.'
      // v57.81: while the leadership break holds, the narrow tape is not "the index leaning on a few leaders" — they are falling too.
      : state === 'burden' ? (narrow && leadership.break ? `지수는 고점권(${signed(fromHigh)})이지만 ${narrowWho} 좁은 장세에서, 최근에는 주도 영역(${leadership.drop5 != null && leadership.drop5 <= -RULES.trend.leaderDrop5dPct ? `나스닥 100 5거래일 ${signed(leadership.drop5)}` : '나스닥 100 50일선 아래'})까지 밀려 소수 종목이 지수를 받치는 힘도 약해지고 있습니다.`
        : narrow ? `지수는 고점권(${signed(fromHigh)})인데 ${narrowWho} 좁은 장세 — 지수가 소수 대형주에 기대고 있을 수 있습니다(어느 종목이 끌어올렸는지는 테마 화면의 S&P 500 지도에서 확인).` : '약세가 시장 전반에 퍼져 있습니다.')
        : state === 'unknown' ? staleRead('시장 폭', alignments.breadth50) : '참여 종목 비율이 중간 — 확산도 위축도 뚜렷하지 않습니다.') + partial + recordRead
      // P1633: the 20-day ratio moves first; a gap to the 50-day ratio says which way participation is turning.
      + (state !== 'unknown' && b20 != null && b50 != null && Math.abs(b20 - b50) >= 10
        ? breadthGapRead(b20, b50, s.breadth20) : '');
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.weakBelow}% 이상이면 중립, 모두 ${RULES.breadth.broadAtLeast}% 이상이면 양호`
        : state === 'favorable' ? `둘 중 하나라도 ${RULES.breadth.broadAtLeast}% 아래면 중립, ${RULES.breadth.weakBelow}% 아래면 부담`
          : `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상이면 양호, 하나라도 ${RULES.breadth.weakBelow}% 아래면 부담`;
    axes.push(axis('breadth', '시장 폭', state, [
      ['20일선 위 종목 (단기)', b20 == null ? null : `${fmt(b20, 0)}%`],
      ['50일선 위 종목 (중기)', b50 == null ? null : `${fmt(b50, 0)}%${recordText(rec50)}`],
      ['200일선 위 종목 (장기)', b200 == null ? null : `${fmt(b200, 0)}%${recordText(rec200)}`],
      ['마감일 상승 종목 비율(보합 제외)', advPct == null ? null : `${fmt(advPct, 0)}%`],
      // P1416: leadership evidence beside the moving-average ratios (the state rule is unchanged).
      ['40일선 위 종목', s.breadth40 ? `${fmt(s.breadth40.value, 0)}%` : null],
      ['52주 신고가 / 신저가', s.breadthNewHighs && s.breadthNewLows ? `${fmt(s.breadthNewHighs.value, 0)} / ${fmt(s.breadthNewLows.value, 0)}` : null],
      ['4% 이상 상승 / 하락', s.breadthUp4 && s.breadthDown4 ? `${fmt(s.breadthUp4.value, 0)} / ${fmt(s.breadthDown4.value, 0)}` : null],
      ['러셀 2000 vs S&P 500 (20일)', rut20 == null || spx20 == null ? null : `${signed(rut20)} vs ${signed(spx20)}`]
    ], read, flip, alignments.breadth50));
    // I14: the narrow-tape shape (index near its high, participation burden) travels with the axis so page flows can
    // point to the S&P 500 map without re-deriving it.
    axes[axes.length - 1].narrow = narrow;
    axes[axes.length - 1].record = rec50;
  }
  // 3. Volatility — level (canonical 18/25 bands), one-week change and term structure.
  {
    const vix = s.vix;
    const ratio = vix && s.vix3m && s.vix3m.date === vix.date ? vix.value / s.vix3m.value : null;
    const vix5 = vix ? pct(vix.value, vix.d5) : null;
    let state = 'neutral';
    if (!vix) state = 'unknown';
    else if (vix.value >= RULES.volatility.stressAt || (ratio != null && ratio >= RULES.volatility.invertedRatioAt) || (vix5 != null && vix5 >= RULES.volatility.spike5dPct)) state = 'burden';
    // v57.81 (audit 2026-10-15): VIX 16.87 after +11.9% in five sessions read 양호 1.1pt under the 18 edge. 양호 now needs
    // VIX calmBufferPt under the edge (or under it and not rising over five sessions) and a five-session rise under
    // rise5dWatchPct; the read names the rise.
    const V = RULES.volatility;
    const calmLevel = vix && vix.value < V.calmBelow && ratio != null && ratio < V.calmRatioBelow;
    const rising = vix5 != null && vix5 >= V.rise5dWatchPct;
    const nearEdge = vix && vix.value >= V.calmBelow - V.calmBufferPt && !(vix5 != null && vix5 <= 0);
    if (state === 'neutral' && calmLevel && !rising && !nearEdge) state = 'favorable';
    const read = state === 'favorable' ? `변동성이 낮고 단기 불안도 작음${vix5 != null && vix5 > 0 ? `(VIX 5일 ${signed(vix5, 0)})` : ''} — 시장이 단기 충격을 크게 반영하지 않고 있습니다.`
      : state === 'burden' ? (ratio != null && ratio >= RULES.volatility.invertedRatioAt ? '단기 변동성이 중기보다 높은 역전 — 단기 스트레스 구간입니다.' : vix5 != null && vix5 >= 25 ? '변동성이 한 주 사이 급등했습니다.' : 'VIX 25 이상 — 경계 구간입니다.')
        : state === 'unknown' ? staleRead('VIX', alignments.vix)
          : ratio == null ? 'VIX는 낮은 편이지만 3개월 VIX가 없어 기간 구조를 확인하지 못했습니다.'
            : calmLevel && rising ? `VIX ${fmt(vix.value)}는 ${V.calmBelow} 아래지만 5일 ${signed(vix5, 0)} 올라 단기 불안이 커지는 중입니다 — 양호로 보지 않습니다.`
              : calmLevel && nearEdge ? `VIX ${fmt(vix.value)}가 ${V.calmBelow} 경계에서 ${V.calmBufferPt}pt 안이고 5일 ${signed(vix5, 0)} 올라 양호로 보지 않습니다.`
                : 'VIX 18~25 주의 구간이거나 기간 구조가 평탄합니다.';
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `VIX ${V.stressAt} 미만, VIX/3개월 VIX ${V.invertedRatioAt} 미만, 5일 상승률 +${V.spike5dPct}% 미만이 모두 충족되면 완화`
        : state === 'favorable' ? `VIX ${V.calmBelow - V.calmBufferPt} 이상에서 5일 상승, 5일 +${V.rise5dWatchPct}% 이상 상승, VIX ${V.calmBelow} 이상 또는 VIX/3개월 VIX ${V.calmRatioBelow} 이상이면 중립 · VIX ${V.stressAt} 이상, 역전(${V.invertedRatioAt} 이상), 5일 +${V.spike5dPct}% 급등 중 하나면 부담`
          : `VIX ${V.calmBelow - V.calmBufferPt} 미만(또는 ${V.calmBelow} 미만에서 5일 하락)이고 5일 상승이 +${V.rise5dWatchPct}% 미만, VIX/3개월 VIX ${V.calmRatioBelow} 미만이면 양호 · VIX ${V.stressAt} 이상, 역전, 5일 +${V.spike5dPct}% 급등 중 하나면 부담`;
    axes.push(axis('volatility', '변동성', state, [
      ['VIX', vix ? `${fmt(vix.value)} (5일 ${signed(vix5, 0)})` : null],
      ['VIX / 3개월 VIX', ratio == null ? null : `${fmt(ratio)} ${ratio >= 1 ? '(역전)' : '(정상)'}`]
    ], read, flip, alignments.vix));
  }
  // 4. Rates — level, direction and what drives it (real yield vs breakeven).
  {
    const tnx = s.tnx;
    const tnx5 = tnx ? bp(tnx.value, tnx.d5) : null;
    const tnx20 = tnx ? bp(tnx.value, tnx.d20) : null;
    const real5 = r.realYield10Delta5 == null ? null : r.realYield10Delta5 * 100;
    const bei5 = r.breakeven10Delta5 == null ? null : r.breakeven10Delta5 * 100;
    const atHigh = tnx?.yearPosition != null && tnx.yearPosition >= RULES.rates.rangeHighAt;
    // v57.81 (audit 2026-10-15): 부담 vs 중립 rode on one week's sign at 91% of the range. Hysteresis over the last
    // latchSessions closes: 부담 is entered by the usual rule and held until the range position is under rangeExitAt or
    // the 20-session rise is under exit20dBp.
    const R = RULES.rates;
    const tnxSeries = buildCloseSeries(input.history, 'tnx', { through: basis });
    const daily = tnxSeries.slice(-R.latchSessions).map((point, index, list) => {
      const stat = stats(tnxSeries.slice(0, tnxSeries.length - list.length + index + 1));
      return { date: point.date, d20: bp(stat.value, stat.d20), d5: bp(stat.value, stat.d5), position: stat.yearPosition };
    });
    const entersBurden = (point) => (point.d20 != null && point.d20 >= R.move20dBp) || (point.position != null && point.position >= R.rangeHighAt && point.d5 != null && point.d5 > 0);
    const latch = latchedState(daily, entersBurden, (point) => !entersBurden(point) && ((point.position == null || point.position < R.rangeExitAt) || point.d20 == null || point.d20 < R.exit20dBp));
    const held = latch.on && !(tnx20 >= R.move20dBp || (atHigh && tnx5 != null && tnx5 > 0));
    let state = 'neutral';
    if (!tnx || tnx20 == null) state = 'unknown';
    else if (latch.on) state = 'burden';
    else if (tnx20 <= -R.move20dBp) state = 'favorable';
    const realLed = real5 != null && bei5 != null && real5 > 0 && Math.abs(real5) >= Math.abs(bei5);
    // P1592 (F44): name the window — a 20-day rise with a small 5-day pullback is not 'rising now'.
    const rateMove = tnx20 != null && tnx20 >= RULES.rates.move20dBp
      ? `장기금리가 20거래일 ${signed(tnx20, 0, 'bp')} 오른 구간${tnx5 != null && tnx5 < 0 ? `(최근 5일은 ${signed(tnx5, 0, 'bp')} 되돌림)` : ''}${atHigh ? ' · 1년 범위 상단' : ''}`
      : `1년 범위 상단에서 최근 5일 ${signed(tnx5, 0, 'bp')} 오른 장기금리`;
    const heldRead = held ? `장기금리가 1년 범위 상단(${fmt(tnx.yearPosition * 100, 0)}%)에서 20거래일 ${signed(tnx20, 0, 'bp')}이고 최근 5일은 ${signed(tnx5, 0, 'bp')} 되돌렸지만, 범위 ${R.rangeExitAt * 100}% 아래로 내려오거나 20거래일 상승이 +${R.exit20dBp}bp 아래로 줄기 전까지는 할인율 부담이 이어지는 것으로 봅니다${latch.since ? `(${shortDate(latch.since)}부터)` : ''}.` : null;
    const read = heldRead || state === 'burden' ? heldRead || `${rateMove} — 주식 할인율 부담${realLed ? '. 실질금리 주도 여부는 5일 관측 기준이며(20일 전체를 분해한 자료는 없습니다), 최근 5일 상승분 대부분이 실질금리였습니다' : ''}.`
      : state === 'favorable' ? '장기금리가 내려오는 구간 — 할인율 부담이 줄고 있습니다.'
        : state === 'unknown' ? (tnx ? '10년물 20일 변화를 계산할 기록이 부족합니다.' : staleRead('금리', alignments.tnx))
          // v57.55 review (E2-09): "+22bp" read as "뚜렷한 방향 없이" — below the burden bar is not the same as no direction.
          : Math.abs(tnx20) >= RULES.rates.move20dBp / 2 ? `장기금리가 20거래일 ${signed(tnx20, 0, 'bp')} ${tnx20 > 0 ? '올랐지만' : '내렸지만'} 판정 기준(±${RULES.rates.move20dBp}bp)에는 못 미칩니다${atHigh ? ' · 1년 범위 상단' : ''}.`
            : '금리가 뚜렷한 방향 없이 움직이고 있습니다.';
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `10년물 20일 변화 +${RULES.rates.move20dBp}bp 미만(현재 ${signed(tnx20, 0, 'bp')})이고, 1년 범위 위치가 ${R.rangeExitAt * 100}% 아래로 내려오거나 20일 상승이 +${R.exit20dBp}bp 아래로 줄면 완화`
        : state === 'favorable' ? `10년물 20일 변화가 -${RULES.rates.move20dBp}bp 위로 올라오면 중립, +${RULES.rates.move20dBp}bp 이상이면 부담`
          : `10년물 20일 +${RULES.rates.move20dBp}bp 이상 또는 1년 범위 ${RULES.rates.rangeHighAt * 100}% 이상에서 5일 상승 시 부담 · 20일 -${RULES.rates.move20dBp}bp 이하면 양호`;
    axes.push(axis('rates', '금리', state, [
      ['미 10년물', tnx ? `${fmt(tnx.value)}% (5거래일 ${signed(tnx5, 0, 'bp')}, 20일 ${signed(tnx20, 0, 'bp')})` : null],
      ['1년 범위 내 위치', tnx?.yearPosition == null ? null : `${fmt(tnx.yearPosition * 100, 0)}%`],
      ['실질금리 / 기대인플레 (5거래일)', real5 == null || bei5 == null ? null : `${signed(real5, 0, 'bp')} / ${signed(bei5, 0, 'bp')}`],
      ['실질금리 (10년 TIPS)', r.realYield10 == null ? null : `${fmt(r.realYield10)}%`]
    ], read, flip, alignments.tnx, [alignments.tnx, alignments.tnx, alignments.rates, alignments.rates]));
  }
  // 5. Credit & risk appetite — the funding market and hedging demand. Calm needs the direction too.
  {
    const { hyBp, hy5, hy20, pcr } = c;
    const widening20 = hy20 != null && hy20 >= RULES.credit.widen20dBp;
    const month = hy20 == null ? '' : `, 20거래일 ${signed(hy20, 0, 'bp')}`;
    const state = creditState({ hyBp, hy5, hy20, pcr, hy20Stress: c.hy20Stress });
    const rec = c.hy20Record;
    const stress20 = state === 'burden' && hyBp < RULES.credit.stressAtBp && !(hy5 != null && hy5 >= RULES.credit.widen5dBp) && c.hy20Stress;
    const recordWord = rec?.pct != null ? `자체 기록 ${rec.n}개 20거래일 변화 중 ${rec.pct}백분위` : `+${RULES.credit.stress20dMultiple * RULES.credit.widen20dBp}bp 이상`;
    // T21: "주식 약세가 번지지 않았다" presumes a weak tape; it is said only when the index or breadth is actually weak.
    const weakTape = (spx.d20 != null && spx.value < spx.d20) || (s.breadth50?.value != null && s.breadth50.value < RULES.breadth.weakBelow);
    const read = state === 'favorable' ? `스프레드가 낮고(${fmt(hyBp, 0)}bp) 최근 5일 넓어지지 않았습니다${hy20 == null ? '' : `(20거래일 ${signed(hy20, 0, 'bp')})`} —${weakTape ? '주식 약세가 신용 위험으로 번지지 않았습니다.' : '자금 조달 여건이 안정적입니다.'}`
      // Codex review 2026-10-05: say which condition fired — HY 324bp is below the 450bp level line, so a
      // "부담" from the 5-day widening must not read as a stressed level.
      : state === 'burden' ? (hyBp >= RULES.credit.stressAtBp
        ? `스프레드 수준이 ${fmt(hyBp, 0)}bp로 ${RULES.credit.stressAtBp}bp 이상 — 자금 조달 여건이 나쁜 구간입니다.`
        // v57.81: say which condition fired — the 20-session widening against its own record, not the level.
        : stress20 ? `수준(${fmt(hyBp, 0)}bp)은 ${RULES.credit.stressAtBp}bp 아래지만 20거래일 동안 ${signed(hy20, 0, 'bp')} 넓어졌습니다(${recordWord}${hy5 != null ? `, 최근 5일 ${signed(hy5, 0, 'bp')}` : ''}) — 확대 폭이 드문 수준이라 부담으로 봅니다.`
        : `수준(${fmt(hyBp, 0)}bp)은 ${RULES.credit.stressAtBp}bp 아래지만 5일 동안 ${signed(hy5, 0, 'bp')} 빠르게 넓어졌습니다 — 수준보다 확대 속도가 부담입니다.`)
        : state === 'unknown' ? staleRead('신용 스프레드', alignments.hy)
          : widening20 ? `수준(${fmt(hyBp, 0)}bp)은 ${RULES.credit.stressAtBp}bp 아래지만 20거래일 동안 ${signed(hy20, 0, 'bp')} 넓어졌습니다${hy5 != null ? `(최근 5일 ${signed(hy5, 0, 'bp')})` : ''} — 한 달째 확대라 안정으로 보지 않습니다.`
            : hy5 == null && hyBp < RULES.credit.tightBelowBp ? '스프레드 수준은 낮지만 5일 변화가 없어 방향을 확인하지 못했습니다.' : `신용은 크게 나쁘지 않지만 스프레드 수준·방향이나 헤지 수요가 경계선입니다(HY ${fmt(hyBp, 0)}bp, 5일 ${signed(hy5, 0, 'bp')}${month}).`;
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `HY 스프레드가 ${RULES.credit.stressAtBp}bp 아래이고 5일 확대가 +${RULES.credit.widen5dBp}bp 미만이며 20거래일 확대가 +${RULES.credit.widen20dBp}bp 아래로 줄면 완화`
        : state === 'favorable' ? `HY ${RULES.credit.tightBelowBp}bp 이상, 5일 확대, 20거래일 +${RULES.credit.widen20dBp}bp 이상 확대, 풋/콜 ${RULES.credit.putCallHedgeAt} 이상 중 하나면 중립 · ${RULES.credit.stressAtBp}bp 이상, 5일 +${RULES.credit.widen5dBp}bp 확대, 20거래일 확대가 자체 기록 상위 ${100 - RULES.credit.stress20dPct}% 중 하나면 부담`
          : `HY ${RULES.credit.tightBelowBp}bp 미만에 5일 축소·보합, 20거래일 확대 +${RULES.credit.widen20dBp}bp 미만, 풋/콜 ${RULES.credit.putCallHedgeAt} 미만이면 양호 · ${RULES.credit.stressAtBp}bp 이상, 5일 +${RULES.credit.widen5dBp}bp 확대, 20거래일 확대가 자체 기록 상위 ${100 - RULES.credit.stress20dPct}% 중 하나면 부담`;
    axes.push(axis('credit', '신용 · 위험선호', state, [
      ['고위험 회사채 금리차(HY)', hyBp == null ? null : `${fmt(hyBp, 0)}bp${hy5 != null ? ` (5거래일 ${signed(hy5, 0, 'bp')}${month})` : ''}`],
      ['풋/콜 비율', pcr == null ? null : fmt(pcr)],
      ['F&G (참고)', c.fg == null ? null : fmt(c.fg, 0)]
    ], read, flip, alignments.hy, [alignments.hy, alignments.pcr, alignments.fg]));
    // D01: scenario checks say why a non-favorable credit state is not "안정" (widening vs a borderline level).
    axes[axes.length - 1].widening = widening20 || (hy5 != null && hy5 > 0);
  }
  // 6. Dollar & commodities — oil (inflation channel), the dollar and gold.
  // P1394: oil is judged against its own 1-year range and 20-day change, not a fixed $90 line.
  // P1399: easing needs both oil and the dollar measured and falling; one alone never makes it.
  {
    const dxy20 = s.dxy ? pct(s.dxy.value, s.dxy.d20) : null;
    const wti = s.wti;
    const wti20 = wti ? pct(wti.value, wti.d20) : null;
    const wtiHigh = wti?.yearPosition != null && wti.yearPosition >= RULES.oil.rangeHighAt;
    const gold20 = s.gold ? pct(s.gold.value, s.gold.d20) : null;
    let state = 'neutral';
    // v57.81 (audit 2026-10-15): DXY +2.23% against the 2.0% line read 부담 on 0.23pp. The dollar counts once it is
    // bufferPct past the line, or past the line while the index sits in the top of its own one-year range.
    const D = RULES.dollar;
    const dxyPos = s.dxy?.yearPosition ?? null;
    const dollarBurden = dollarRiseBurden(dxy20, dxyPos) === true;
    const dollarEdge = dxy20 != null && dxy20 >= D.rise20dPct && !dollarBurden;
    // v57.81: the shared Brent/WTI check — while it holds, a WTI fall is not 완화 and WTI alone fires no 부담.
    const oil = wti ? oilCheckOf(input.history, basis) : null;
    const oilHeld = !!oil?.held;
    const oilBurden = !oilHeld && (wtiHigh || (wti20 != null && wti20 >= RULES.oil.rise20dPct));
    if (wti20 == null && dxy20 == null && !wtiHigh) state = 'unknown';
    else if (oilBurden || dollarBurden) state = 'burden';
    else if (!oilHeld && wti20 != null && dxy20 != null && wti20 <= RULES.oil.fall20dPct && dxy20 <= 0) state = 'favorable';
    const missing = state !== 'unknown' && (wti20 == null || dxy20 == null) ? ` (${wti20 == null ? 'WTI' : '달러'} 20일 변화 미수신)` : '';
    // P1726 (P1592 pattern): a 5-session move against the 20-session direction is named beside it — a +4.8% rebound
    // was hidden under "20일 -7.5%". The state still follows the 20-session rule.
    const wti5 = wti ? pct(wti.value, wti.d5) : null;
    const oilTurn = wti20 != null && wti5 != null && Math.abs(wti5) >= RULES.oil.turn5dPct && Math.sign(wti5) !== Math.sign(wti20) ? (wti5 > 0 ? '반등' : '반락') : null;
    const oilShort = oilTurn ? ` WTI는 20일 ${signed(wti20)}이지만 최근 5일 ${signed(wti5)} ${oilTurn}했습니다(판정은 20일 기준).` : '';
    const read = (state === 'burden' ? (!oilHeld && wti20 != null && wti20 >= RULES.oil.rise20dPct ? '유가가 빠르게 오르며 물가·금리 부담을 키우고 있습니다.' : !oilHeld && wtiHigh ? `유가가 1년 범위 상단(${fmt(wti.yearPosition * 100, 0)}%)에 머물러 물가·금리 부담입니다.` : `달러 강세(20일 ${signed(dxy20)}${dxyPos != null ? ` · 1년 범위 ${fmt(dxyPos * 100, 0)}%` : ''})가 해외 매출 기업과 신흥국 자금 흐름에 부담입니다.`)
      : state === 'favorable' ? '유가와 달러가 함께 내려오며 물가·금융 여건 부담이 줄고 있습니다.'
        : state === 'unknown' ? staleRead('유가·달러', alignments.wti)
          // v57.81: a dollar rise just past the line (inside the buffer, below the top of its range) is named, not judged.
          : dollarEdge ? `달러가 20일 ${signed(dxy20)} 올라 기준(+${D.rise20dPct}%)을 조금 넘었지만${dxyPos != null ? ` 1년 범위 ${fmt(dxyPos * 100, 0)}%로 상단이 아니라` : ''} 부담으로 판정하지 않습니다(+${D.rise20dPct + D.bufferPct}% 이상이거나 1년 범위 ${D.rangeHighAt * 100}% 이상이면 부담).`
            : '유가·달러가 중립 범위입니다.') + missing + (oilHeld ? ` ${oil.text}` : oilShort);
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 미만, WTI 20일 +${RULES.oil.rise20dPct}% 미만, 달러 20일 +${D.rise20dPct + D.bufferPct}% 미만(1년 범위 ${D.rangeHighAt * 100}% 이상이면 +${D.rise20dPct}% 미만)이 모두 충족되면 완화`
        : state === 'favorable' ? `WTI 20일 ${RULES.oil.fall20dPct}% 위 또는 달러 20일 상승이면 중립 · WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상, WTI 20일 +${RULES.oil.rise20dPct}%, 달러 20일 +${D.rise20dPct + D.bufferPct}%(1년 범위 ${D.rangeHighAt * 100}% 이상이면 +${D.rise20dPct}%) 중 하나면 부담`
          : `WTI 20일 ${RULES.oil.fall20dPct}% 이하이면서 달러 20일 하락이면 양호 · WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상, WTI 20일 +${RULES.oil.rise20dPct}%, 달러 20일 +${D.rise20dPct + D.bufferPct}%(1년 범위 ${D.rangeHighAt * 100}% 이상이면 +${D.rise20dPct}%) 중 하나면 부담`;
    axes.push(axis('commodities', '달러 · 원자재', state, [
      ['WTI', wti ? `${fmt(wti.value)}달러 (20일 ${signed(wti20)}${oilTurn ? ` · 최근 5일 ${signed(wti5)} ${oilTurn}` : ''})` : null],
      ['WTI 1년 범위 내 위치', wti?.yearPosition == null ? null : `${fmt(wti.yearPosition * 100, 0)}%`],
      ['달러 인덱스', s.dxy ? `${fmt(s.dxy.value)} (20일 ${signed(dxy20)}${dxyPos != null ? ` · 1년 범위 ${fmt(dxyPos * 100, 0)}%` : ''})` : null],
      ['금', s.gold ? `${fmt(s.gold.value, 0)}달러 (20일 ${signed(gold20)})` : null]
    ], read, flip, alignments.wti));
  }
  // 7. FX — the won (foreign flows into Korea) and the yen (carry trade; a fast yen rally has
  // preceded global de-risking, e.g. August 2024). P1394 adds USD/JPY at the owner's request.
  {
    // v57.81: one 20-session won window shared with the 원/달러 card (usdKrwWindow) — the change counts as a direction only
    // when the 20-session mean moved the same way, so a base on a one-day spike is not read as a trend.
    const krwWin = s.usdkrw ? usdKrwWindow(buildCloseSeries(input.history, 'usdkrw', { through: basis }).filter((point) => point.date <= s.usdkrw.date)) : null;
    const krw20 = krwWin ? krwWin.change : null;
    const jpy20 = s.usdjpy ? pct(s.usdjpy.value, s.usdjpy.d20) : null;
    const kospi20 = s.kospi ? pct(s.kospi.value, s.kospi.d20) : null;
    const yenSurge = jpy20 != null && jpy20 <= -RULES.fx.yenRally20dPct;
    let state = 'neutral';
    if (krw20 == null && jpy20 == null) state = 'unknown';
    else if (krwWin?.direction === 'weaker' || yenSurge) state = 'burden';
    else if (krwWin?.direction === 'stronger') state = 'favorable';
    const endpointOnly = krwWin && Math.abs(krw20) >= RULES.fx.krwMove20dPct && !krwWin.agrees;
    // v57.75 (10/15 crash audit): the 20-day won strength kept this axis 'favorable' on a day KOSPI fell 7.8% and the won
    // weakened 0.7%. A won that turned weak on the last session (USD/KRW +0.5% or more) holds the verdict at neutral.
    const krw1 = s.usdkrw ? pct(s.usdkrw.value, s.usdkrw.d1) : null;
    const turned = state === 'favorable' && krw1 != null && krw1 >= RULES.fx.krwFlatPct;
    if (turned) state = 'neutral';
    // v57.81 (portfolio/KR audit): won strength is not read as foreign inflow while KOSPI itself fell kospiContradict20dPct
    // or more over 20 sessions or had a rare day in its own record — the two say different things (혼조).
    const krRecord = state === 'favorable' && s.kospi ? koreaMoveRecord(input.history, { now: input.now ?? Date.now() }) : null;
    const kospiContradicts = state === 'favorable' && ((kospi20 != null && kospi20 <= -RULES.fx.kospiContradict20dPct) || !!krRecord?.extreme);
    if (kospiContradicts) state = 'neutral';
    const read = kospiContradicts ? `혼조 — 원화는 20거래일 ${signed(-krw20)} 강세지만 코스피가 ${kospi20 != null && kospi20 <= -RULES.fx.kospiContradict20dPct ? `20일 ${signed(kospi20)}` : '기록상 드문 하락'}로 밀려, 외국인 자금 유입으로 읽지 않습니다.`
      : turned ? `20일로는 원화 강세지만 직전 거래일 원화가 ${signed(krw1)} 약세로 돌아섰습니다 — 강세가 이어지는지 확인 전에는 양호로 보지 않습니다.`
      : endpointOnly ? `원/달러 20거래일 변화(${signed(krw20)})는 기준을 넘지만 20일 평균은 ${signed(krwWin.meanShift)}만 움직여, 시작점(${shortDate(krwWin.base.date)})의 일시적 수준 탓으로 보고 방향으로 판정하지 않습니다.`
      : yenSurge ? `엔화가 20일 ${signed(-jpy20)} 강세 — 2024년 8월 엔 캐리 청산 때는 글로벌 위험자산 매도가 함께 나타났습니다.`
      : state === 'burden' ? '원화 약세 — 외국인 수급과 수입 물가에 부담입니다.'
        : state === 'favorable' ? '원화 강세 — 외국인 자금 유입에 유리하지만 수출 기업 이익에는 부담일 수 있습니다.'
          : state === 'unknown' ? staleRead('환율', alignments.usdkrw) : '원/달러·엔/달러가 중립 범위입니다.';
    axes.push(axis('korea', '환율 (원 · 엔)', state, [
      ['원/달러', s.usdkrw ? `${fmt(s.usdkrw.value, 1)}원 (20거래일 ${signed(krw20)}${krwWin?.meanShift != null ? ` · 20일 평균 ${signed(krwWin.meanShift)}` : ''})` : null],
      ['엔/달러', s.usdjpy ? `${fmt(s.usdjpy.value, 2)}엔 (20일 ${signed(jpy20)})` : '수집 시작 대기'],
      ['코스피', s.kospi ? `${fmt(s.kospi.value)} (20일 ${signed(kospi20)})` : null]
      // P1725: each value carries its own observation date (won/yen on the FX calendar, KOSPI on KRX), so a 10/9 won beside
      // a 10/13 KOSPI shows a mixed-date chip instead of one "10/9 · 1거래일 전" chip for all three.
    ], read, state === 'unknown' ? null : `원/달러 20일 +${RULES.fx.krwMove20dPct}% 이상 또는 엔/달러 20일 -${RULES.fx.yenRally20dPct}% 이하(엔 급강세)면 부담 · 원/달러 20일 -${RULES.fx.krwMove20dPct}% 이하면 양호(20일 평균도 같은 방향이어야 함 · 직전 거래일 원/달러 +0.5% 이상이거나 코스피 20일 -${RULES.fx.kospiContradict20dPct}% 이하면 중립)`, alignments.usdkrw, [alignments.usdkrw, alignments.usdjpy, alignments.kospi]));
  }

  // P1723: the trend and volatility axes stay US-only; when the KOSPI move is rare in its own record, their reading
  // ends with one sentence saying so, so a calm US read is not taken as a calm Korean market.
  const kr = s.kospi ? koreaMoveRecord(input.history, { now: input.now ?? Date.now() }) : null;
  if (kr?.extreme && kr.date === s.kospi.date && kr.d1 != null) {
    const note = ` 단, 한국은 ${shortDate(kr.date)} 코스피 ${signed(kr.d1)}${kr.d5 != null ? `(5거래일 ${signed(kr.d5)})` : ''}로 ${koreaRecordText(kr)}입니다 — 미국과 다른 시장이며, 이 지표는 미국 종가로만 판정합니다.`;
    // P1745: once, on the volatility axis (the trend card no longer repeats the same sentence).
    for (const row of axes) if (row.id === 'volatility') row.read += note;
  }

  const us = axes.filter((row) => row.id !== 'korea');
  const known = us.filter((row) => row.state !== 'unknown');
  const count = (state) => known.filter((row) => row.state === state).length;
  const burden = count('burden');
  const favorable = count('favorable');
  // P1399: an overall label needs at least four of the six US axes; fewer is "판정 보류".
  // M05: with a clock (input.now), the basis must be the latest completed US session or at most two sessions
  // behind it. A long-open tab or a stalled producer would otherwise present an old close as today's verdict.
  const latest = Number.isFinite(Number(input.now)) ? latestCompletedUsSession(Number(input.now), { requirePrevious: false })?.date || null : null;
  const basisLag = latest && basis && latest > basis ? sessionsBetween(basis, latest) : 0;
  const staleBasis = basisLag > 2 ? { basis, latest, lag: basisLag } : null;
  const enough = known.length >= MIN_KNOWN_AXES && !staleBasis;
  const overall = !enough ? '판정 보류'
    // v57.84 review: the label is symmetric — 1·2·3 read '부담 우세' while its mirror 3·2·1 read only '다소 양호'.
    : burden >= 4 && favorable <= 1 ? '부담 우세' : favorable >= 4 && burden <= 1 ? '양호 우세'
      : (burden >= 3 && favorable <= 1) || (burden >= 2 && favorable === 0) ? '다소 부담' : (favorable >= 3 && burden <= 1) || (favorable >= 2 && burden === 0) ? '다소 양호' : '혼조';
  // Codex review 2026-10-05: '방어적 환경' read like a validated stance. The label now names only how the
  // six conventional axes split (counts beside it); it is a description, not an allocation call.
  const byId = Object.fromEntries(axes.map((row) => [row.id, row]));
  const conflicts = [];
  if (byId.trend?.state === 'favorable' && byId.breadth?.state === 'burden') conflicts.push('추세는 양호인데 시장 폭은 부담 — 지수는 오르는 흐름이지만 함께 오르는 종목은 적어, 몇몇 큰 종목이 지수를 떠받치고 있을 수 있습니다.'); // v57.55 beginner panel: plain words
  // v57.81: the leaders and the small caps breaking down together is named beside the axes (the 시장 상태 conflict list and
  // the AI context read it), so a narrow-leadership reading cannot stand while it holds.
  // v57.83: leaders weak without the market-wide confirmations — the index can hold while AI·semis fall (2026-07).
  if (leadership.state === 'weak') conflicts.push(`주도주 약세 — ${leadership.summary}. 시장 전반의 확인 신호(신저가 우위·상승 종목 감소·분배일·러셀 2000 약세)는 ${leadership.met}/${leadership.confirmations.length}개라 아직 동반 약세로 번지지 않았지만, 지수만 보고 주도 영역이 건재하다고 읽지 않습니다.`);
  if (leadership.break) conflicts.push(`주도 영역이 꺾이는 신호 — ${leadership.summary}(확인 ${leadership.met}/${leadership.confirmations.length}, ${leadership.need}개 이상이면 판정). 소수 종목이 지수를 받치던 흐름에서 함께 약해지는 흐름으로 넘어가는지 확인할 구간입니다.`);
  // P1591 (M02): the HY clause follows the observed 5-day direction — "확대가 이어지면" read as already widening
  // when the spread had narrowed 9bp.
  const hyClause = c?.hy5 == null ? 'HY 스프레드의 5일 방향은 아직 확인하지 못했습니다'
    : c.hy5 > 0 ? `HY 스프레드가 5일간 ${Math.round(c.hy5)}bp 넓어졌습니다 — 확대가 계속되면 결론이 바뀔 수 있습니다`
      : c.hy20 != null && c.hy20 >= RULES.credit.widen20dBp
        // P1685: after a month of widening a 5-day narrowing is a pause, not "not widening".
        ? `HY 스프레드는 20거래일 동안 ${Math.round(c.hy20)}bp 넓어진 뒤 최근 5일 ${Math.abs(Math.round(c.hy5))}bp ${c.hy5 < 0 ? '좁아졌습니다' : '멈췄습니다'} — 확대가 다시 이어지면 결론이 바뀔 수 있습니다`
        : `HY 스프레드는 5일간 ${Math.abs(Math.round(c.hy5))}bp ${c.hy5 < 0 ? '좁아졌습니다' : '변화가 없습니다'} — 확대로 돌아서면 결론이 바뀔 수 있습니다`;
  if (byId.volatility?.state === 'favorable' && byId.rates?.state === 'burden') conflicts.push(`금리는 부담인데 변동성은 낮음 — 금리 부담에 따른 투매는 아직 없습니다. ${hyClause}.`);
  if (byId.credit?.state === 'favorable' && byId.breadth?.state === 'burden') conflicts.push(`시장 폭은 약하지만 신용은 안정${c.hy20 != null ? `(HY 20거래일 ${signed(c.hy20, 0, 'bp')})` : ''} — 신용 위험이 약세를 이끈다는 신호는 없습니다.`);
  return {
    available: true,
    asOf: basis,
    overall,
    sufficient: enough,
    staleBasis,
    holdReason: staleBasis ? `마지막 종가 기록(${shortDate(basis)})이 최신 완료 거래일(${shortDate(latest)})보다 ${basisLag}거래일 늦어 현재 판정으로 쓰지 않습니다. 자료 갱신 뒤 다시 판정합니다.`
      : enough ? null : `6개 지표 중 ${known.length}개만 확인돼 전체 판정을 보류합니다(최소 ${MIN_KNOWN_AXES}개).`,
    counts: { favorable, neutral: count('neutral'), burden, unknown: us.length - known.length },
    conflicts,
    // v57.81: the leadership-break test and the trend cap travel with the regime (scenario rules, outlook, AI context).
    leadership,
    leadershipBreak: !!leadership.break,
    trendCap,
    axes
  };
}
