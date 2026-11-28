// The index cards' verdict set beyond the trend word, each a rule over closes (and volume where the card has it):
// where the close stands against the line it last crossed (breakout attempt, acceptance, failure; a support turned
// resistance; a false break), whether the five US indexes confirm one another (Dow's rule on the prior swing high and low),
// an oversold bounce under a falling 10-day line, the volume cells every card shares, and the Nasdaq crash-day event
// table. Words are fixed state words; no sentence is assembled here. Pure.
import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite } from '../shared/number.js';
import { sessionCloses } from '../market/indices/index-levels.js';
import { distributionDaySeries } from '../market/breadth/breadth-signals.js';

export const INDEX_READ_RULES = Object.freeze({
  // A crossing stays the card's state for 10 sessions: the analysis slot's breakout window (chart-analysis brokeOut).
  boundaryWindow: 10,
  swingSpan: 5,
  // 2125236108904575008: a big up day under a 10-day line lower than five sessions before, on less volume than the day
  // before, is an oversold bounce. "Big" is the follow-through day's own gain (RULES.rallyAttempt.gainPct).
  bounce: Object.freeze({ maSessions: 10, slopeSessions: 5 }),
  // chart-analysis's up/down volume bands (20 sessions): 1.3× up-day dominance, 0.77× down-day dominance.
  pressure: Object.freeze({ upAt: 1.3, downAt: 0.77 }),
  // 2118529616533234035: Nasdaq Composite down 5% or more in a day with the close 10% or more under its 252-session closing
  // high; re-break within 60 sessions, worst close within 20; cases at least the 60-session window apart (non-overlapping).
  crash: Object.freeze({ dropPct: 5, fromHighPct: 10, highSessions: 252, horizon: 60, drawdownSessions: 20, minCases: 10 })
});
const R = INDEX_READ_RULES;

export const INDEX_READ_WORDS = Object.freeze({
  boundary: Object.freeze({ attempt: '돌파 시도', accepted: '돌파 수용', failed: '돌파 실패', breakdown: '지지 이탈', flipped: '지지→저항 전환', 'false-break': '가짜 이탈' }),
  confirmation: Object.freeze({ up: '상승 확인', down: '하락 확인', split: '미확인 괴리', inside: '직전 고점·저점 사이' }),
  bounce: Object.freeze({ oversold: '과매도 반등', pending: '반등 확인 대기' }),
  volume: Object.freeze({ distribution: '분배 우세', accumulation: '상승일 거래량 우위', even: '비슷함' }),
  ftdUnderDistribution: '분배 우세 중 FTD',
  crash: '급락일 사건'
});

export function movingAverage(closes, n) {
  const out = [];
  let sum = 0;
  closes.forEach((row, i) => {
    sum += row.value;
    if (i >= n) sum -= closes[i - n].value;
    if (i >= n - 1) out.push({ date: row.date, value: sum / n });
  });
  return out;
}

/** Swing highs and lows of the last year: a close higher (lower) than the `span` sessions on each side. */
export function swingPointsOf(closes, span = R.swingSpan) {
  const recent = closes.slice(-252);
  const highs = []; const lows = [];
  for (let i = span; i < recent.length - span; i += 1) {
    const around = recent.slice(i - span, i + span + 1).map((row) => row.value);
    if (recent[i].value === Math.max(...around)) highs.push(recent[i]);
    if (recent[i].value === Math.min(...around)) lows.push(recent[i]);
  }
  return { highs, lows };
}

/**
 * The close against one line over the last `window` sessions. The line's role is where the close stood when the window
 * opened: under it, a resistance; over it, a support. The latest crossing decides: a resistance crossed up is a breakout
 * attempt, accepted once a down close has come and gone above it, failed when a close returns under it; a support crossed
 * down is a breakdown, turned resistance once an up close has come and stayed under it, a false break when a close
 * returns over it. A close on the line is not past it. null without a crossing.
 * @param {number[]} closes ascending completed closes
 */
export function boundaryState(closes, line, { window = R.boundaryWindow } = {}) {
  const n = (closes?.length || 0) - 1;
  if (!(line > 0) || n < window + 1) return null;
  const above = (value) => value > line;
  const role = above(closes[n - window]) ? 'support' : 'resistance';
  let at = -1;
  for (let i = n - window + 1; i <= n; i += 1) if (above(closes[i]) !== above(closes[i - 1])) at = i;
  if (at < 0) return null;
  const moves = closes.slice(at + 1).map((value, k) => value - closes[at + k]);
  const up = above(closes[at]);
  const state = role === 'resistance'
    ? (up ? (moves.some((move) => move < 0) ? 'accepted' : 'attempt') : 'failed')
    : (up ? 'false-break' : (moves.some((move) => move > 0) ? 'flipped' : 'breakdown'));
  return Object.freeze({ state, word: INDEX_READ_WORDS.boundary[state], role, line, index: at, sessions: n - at });
}

/**
 * An index card's line: the nearest swing high above and the nearest swing low below the close where the window opened,
 * from the swing points dated before it; whichever was crossed last is the card's state.
 * @param {Array<{date:string, value:number}>} closes
 */
export function indexBoundary(closes, { window = R.boundaryWindow } = {}) {
  if (!Array.isArray(closes) || closes.length < 60 + window) return null;
  const start = closes.length - 1 - window;
  const { highs, lows } = swingPointsOf(closes.slice(0, start + 1));
  const open = closes[start].value;
  const resistance = highs.filter((row) => row.value > open).sort((a, b) => a.value - b.value)[0] || null;
  const support = lows.filter((row) => row.value < open).sort((a, b) => b.value - a.value)[0] || null;
  const values = closes.map((row) => row.value);
  const read = (level) => {
    const state = level ? boundaryState(values, level.value, { window }) : null;
    return state ? { ...state, lineDate: level.date, date: closes[state.index].date } : null;
  };
  return [read(resistance), read(support)].filter(Boolean).sort((a, b) => b.index - a.index)[0] || null;
}

// The indexes Dow's rule reads against one another (history.json fields).
export const CONFIRM_INDEXES = Object.freeze([['spx', 'S&P 500'], ['ndx', '나스닥100'], ['dow', '다우'], ['rut', '러셀2000'], ['rsp', 'S&P 500 동일가중']]);

/**
 * 2008895040068972869: two indexes that close above their prior secondary highs together confirm an advance, below their
 * prior secondary lows together a decline; one without the other is an unconfirmed divergence. Each row: the last close,
 * the latest swing high and low (five sessions each side) and which side of them the close stands, the 50-day distance;
 * `weakest` marks the row furthest under its 50-day line.
 */
export function crossConfirmation(history) {
  const rows = CONFIRM_INDEXES.map(([field, label]) => {
    const closes = sessionCloses(history, field);
    if (closes.length < 60) return null;
    const { highs, lows } = swingPointsOf(closes);
    const close = closes.at(-1).value;
    const swingHigh = highs.at(-1) || null, swingLow = lows.at(-1) || null;
    const ma50 = movingAverage(closes, 50).at(-1)?.value;
    return { field, label, asOf: closes.at(-1).date, close, swingHigh, swingLow,
      aboveHigh: swingHigh ? close > swingHigh.value : null, belowLow: swingLow ? close < swingLow.value : null,
      s50: ma50 > 0 ? (close / ma50 - 1) * 100 : null, weakest: false };
  }).filter(Boolean);
  if (rows.length < 2) return null;
  const weakest = rows.filter((row) => row.s50 != null).sort((a, b) => a.s50 - b.s50)[0];
  if (weakest) weakest.weakest = true;
  const known = rows.filter((row) => row.aboveHigh != null && row.belowLow != null);
  const above = known.filter((row) => row.aboveHigh), below = known.filter((row) => row.belowLow);
  const state = known.length < 2 ? null
    : above.length === known.length ? 'up' : below.length === known.length ? 'down' : above.length || below.length ? 'split' : 'inside';
  const dates = [...new Set(rows.map((row) => row.asOf))].sort();
  return Object.freeze({ state, word: state ? INDEX_READ_WORDS.confirmation[state] : null, rows, above: above.map((row) => row.label), below: below.map((row) => row.label),
    asOf: dates.at(-1), mixedDates: dates.length > 1 });
}

/**
 * 2125236108904575008: the latest session's big up day (RULES.rallyAttempt.gainPct or more) read against the 10-day line.
 * Under a 10-day line lower than five sessions before, on less volume than the day before: an oversold bounce, not a
 * confirmed low. Any other big up day waits for confirmation. null on any other day.
 * @param {Array<{time:string, close:number, volume?:number}>} bars
 */
export function bounceRead(bars) {
  const { maSessions, slopeSessions } = R.bounce;
  const list = Array.isArray(bars) ? bars : [];
  const n = list.length - 1;
  if (n < maSessions + slopeSessions) return null;
  const close = list[n].close, prev = list[n - 1].close;
  const gainPct = prev > 0 ? (close / prev - 1) * 100 : null;
  if (!(gainPct >= RULES.rallyAttempt.gainPct - 1e-9)) return null;
  const average = (end) => list.slice(end - maSessions + 1, end + 1).reduce((sum, bar) => sum + bar.close, 0) / maSessions;
  const ma10 = average(n), ma10Then = average(n - slopeSessions);
  const volume = finite(list[n].volume), prevVolume = finite(list[n - 1].volume);
  const lighter = volume > 0 && prevVolume > 0 ? volume < prevVolume : null;
  const below = close < ma10, falling = ma10 < ma10Then;
  const state = below && falling && lighter === true ? 'oversold' : 'pending';
  return Object.freeze({ state, word: INDEX_READ_WORDS.bounce[state], date: list[n].time, gainPct, ma10, below, falling, lighter });
}

/**
 * The volume cells every card with volume carries: distribution days over the last 25 sessions (breadth-signals.js, one
 * definition; the S&P 500 card reads the index's own count from history.json, the other cards their fund's bars) and the
 * 20-session up/down-day volume ratio of the chart analysis. `heavy`: the count at RULES.leadership.distributionDaysAt or
 * more, or down-day volume dominant.
 */
export function volumeCells({ bars = [], pressure = null, history = [], field = null } = {}) {
  let distribution = null;
  if (field === 'spx') {
    for (let i = (history?.length || 0) - 1; i >= 0 && !distribution; i -= 1) {
      const count = finite(history[i]?.distributionDays);
      if (count != null) distribution = { count, date: history[i].date, basis: 'index' };
    }
  } else {
    const series = distributionDaySeries((bars || []).map((bar) => ({ date: bar.time, close: bar.close, volume: bar.volume })));
    const last = series.at(-1);
    if (last?.count != null) distribution = { count: last.count, date: last.date, basis: 'bars' };
  }
  const tilt = pressure == null ? null : pressure >= R.pressure.upAt ? 'accumulation' : pressure <= R.pressure.downAt ? 'distribution' : 'even';
  const heavy = distribution || tilt ? (distribution?.count ?? 0) >= RULES.leadership.distributionDaysAt || tilt === 'distribution' : null;
  return Object.freeze({ distribution, pressure, tilt, tiltWord: tilt ? INDEX_READ_WORDS.volume[tilt] : null, heavy });
}

/**
 * 2118529616533234035: the Nasdaq crash-day events in a close series — a session down `dropPct` or more that closes
 * `fromHighPct` or more under the 252-session closing high — cases at least `horizon` sessions apart. Each case with a full
 * window: whether a later close in `horizon` sessions went under the event close, the worst close in `drawdownSessions`,
 * and the close `horizon` sessions on. Under `minCases` complete cases only the count. `today`: the latest session is one.
 * @param {Array<{date:string, value:number}>} closes
 */
export function crashDayEvents(closes, rules = R.crash) {
  const list = Array.isArray(closes) ? closes : [];
  const value = (i) => list[i].value;
  const isEvent = (i) => {
    if (i < rules.highSessions || !(value(i - 1) > 0)) return false;
    let high = -Infinity;
    for (let k = i - rules.highSessions + 1; k <= i; k += 1) high = Math.max(high, value(k));
    return (value(i) / value(i - 1) - 1) * 100 <= -rules.dropPct && (value(i) / high - 1) * 100 <= -rules.fromHighPct;
  };
  const cases = [];
  for (let i = rules.highSessions, nextFree = 0; i < list.length; i += 1) {
    if (i < nextFree || !isEvent(i)) continue;
    nextFree = i + rules.horizon;
    const complete = i + rules.horizon < list.length;
    const after = list.slice(i + 1, i + rules.horizon + 1).map((row) => row.value);
    const near = after.slice(0, rules.drawdownSessions);
    cases.push({ date: list[i].date, complete, reBreak: complete ? after.some((close) => close < value(i)) : null,
      worst20: complete && near.length ? (Math.min(...near) / value(i) - 1) * 100 : null, up60: complete ? value(i + rules.horizon) > value(i) : null });
  }
  const done = cases.filter((row) => row.complete);
  const share = (test) => done.filter(test).length / done.length;
  const sorted = done.map((row) => row.worst20).sort((a, b) => a - b);
  const quantile = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const n = list.length - 1;
  return Object.freeze({
    count: cases.length, complete: done.length, cases, from: list[0]?.date || null, through: list.at(-1)?.date || null,
    summary: done.length >= rules.minCases ? Object.freeze({ reBreakShare: share((row) => row.reBreak), upShare: share((row) => row.up60), worst20Median: quantile(0.5), worst20Q20: quantile(0.2), worst20Q80: quantile(0.8) }) : null,
    today: n >= 0 && isEvent(n) ? Object.freeze({ date: list[n].date, change: (value(n) / value(n - 1) - 1) * 100 }) : null
  });
}
