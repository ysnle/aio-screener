// v57.54 (owner X packet 2026-10-14, image 3 "밭 온도계"): a per-market price temperature — the S&P 500 and Nasdaq
// first, with KOSPI, KOSDAQ and Nikkei (no gauge on the sentiment screen before) as the secondary read. The published thermometer's formula
// is not public, so this is AIO's own documented reconstruction from daily closes only — not that index and not CNN's.
// D02 (v57.50) holds: no 0-100 average and no 공포~탐욕 band. Each component's rank against its own trailing three
// years is shown side by side; a market is "과도한 냉각/고온" only when at least three of the five components sit in the
// bottom/top decile at once, and the evidence line is what the index did after past first days of such spells.
// Pure function shared by the producer (scripts/build-market-temperature.mjs) and the unit check.
import { isIsoDay } from '../shared/session-date.js';

export const MARKET_TEMPERATURE_SCHEMA = 'market-temperature.v1';
// US first (AIO is a US-market screener); Korea and Japan follow as the secondary read.
export const TEMPERATURE_MARKETS = Object.freeze([
  Object.freeze({ id: 'spx', symbol: '^GSPC', label: 'S&P 500', region: 'us' }),
  Object.freeze({ id: 'nasdaq', symbol: '^IXIC', label: '나스닥 종합', region: 'us' }),
  Object.freeze({ id: 'kospi', symbol: '^KS11', label: '코스피', region: 'kr' }),
  Object.freeze({ id: 'kosdaq', symbol: '^KQ11', label: '코스닥', region: 'kr' }),
  Object.freeze({ id: 'nikkei', symbol: '^N225', label: '닛케이 225', region: 'jp' })
]);
export const TEMPERATURE_COMPONENTS = Object.freeze([
  Object.freeze({ id: 'trend', label: '125일선 거리', basis: '종가 ÷ 125거래일 평균 − 1' }),
  Object.freeze({ id: 'range', label: '52주 범위 위치', basis: '(종가 − 52주 최저) ÷ (52주 최고 − 52주 최저)' }),
  Object.freeze({ id: 'rsi', label: 'RSI 14일', basis: '14거래일 상대강도지수(와일더 평활)' }),
  Object.freeze({ id: 'calm', label: '낮은 변동성', basis: '20거래일 일간 로그수익률 표준편차, 낮을수록 높은 순위' }),
  Object.freeze({ id: 'ret20', label: '20일 수익률', basis: '종가 ÷ 20거래일 전 종가 − 1' })
]);
export const TEMPERATURE_RULES = Object.freeze({
  rankWindow: 756, // three years of sessions: one year let a single long selloff redefine "normal"
  minRankSample: 252,
  coldAtOrBelow: 10,
  hotAtOrAbove: 90,
  extremeMinComponents: 3,
  clusterGapSessions: 21,
  horizons: Object.freeze([21, 63]),
  historySessions: 504
});

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

function rawComponents(closes) {
  const n = closes.length;
  const trend = Array(n).fill(null), range = Array(n).fill(null), rsi = Array(n).fill(null), calm = Array(n).fill(null), ret20 = Array(n).fill(null);
  let sum125 = 0, gain = 0, loss = 0;
  const logRet = closes.map((close, i) => (i ? Math.log(close / closes[i - 1]) : 0));
  for (let i = 0; i < n; i += 1) {
    sum125 += closes[i];
    if (i >= 125) sum125 -= closes[i - 125];
    if (i >= 124) trend[i] = closes[i] / (sum125 / 125) - 1;
    if (i >= 251) {
      let hi = -Infinity, lo = Infinity;
      for (let k = i - 251; k <= i; k += 1) { if (closes[k] > hi) hi = closes[k]; if (closes[k] < lo) lo = closes[k]; }
      if (hi > lo) range[i] = (closes[i] - lo) / (hi - lo);
    }
    if (i >= 1) {
      const delta = closes[i] - closes[i - 1];
      const up = Math.max(delta, 0), down = Math.max(-delta, 0);
      if (i <= 14) { gain += up / 14; loss += down / 14; } else { gain = (gain * 13 + up) / 14; loss = (loss * 13 + down) / 14; }
      if (i >= 14) rsi[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    if (i >= 20) {
      let s = 0, s2 = 0;
      for (let k = i - 19; k <= i; k += 1) { s += logRet[k]; s2 += logRet[k] * logRet[k]; }
      const mean = s / 20;
      calm[i] = -Math.sqrt(Math.max(0, s2 / 20 - mean * mean));
      ret20[i] = closes[i] / closes[i - 20] - 1;
    }
  }
  return { trend, range, rsi, calm, ret20 };
}

// Rank of each value within its trailing window (inclusive), 0..100, null until the window holds minRankSample values.
export function trailingRanks(values, { window = TEMPERATURE_RULES.rankWindow, minSample = TEMPERATURE_RULES.minRankSample } = {}) {
  const out = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v == null) continue;
    let count = 0, below = 0;
    for (let k = Math.max(0, i - window + 1); k <= i; k += 1) {
      const w = values[k];
      if (w == null) continue;
      count += 1;
      if (w < v) below += 1; else if (w === v) below += 0.5;
    }
    if (count >= minSample) out[i] = Math.round((below / count) * 1000) / 10;
  }
  return out;
}

function stats(returns) {
  const n = returns.length;
  if (!n) return { n: 0 };
  const sorted = [...returns].sort((a, b) => a - b);
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return {
    n, mean: round(mean), median: round(sorted[Math.floor((n - 1) / 2)]), p10: round(sorted[Math.floor(0.1 * (n - 1))]),
    hitRate: Math.round((returns.filter((r) => r > 0).length / n) * 100), sd: round(sd), se: sd == null ? null : round(sd / Math.sqrt(n))
  };
}

/**
 * @param {Array<[string, number]>} rows completed daily closes, oldest first
 * @returns {object|null} the market body of public-data/market-temperature.json
 */
export function buildMarketTemperature(rows = [], { rules = TEMPERATURE_RULES } = {}) {
  const clean = rows.filter((row) => Array.isArray(row) && isIsoDay(row[0]) && Number.isFinite(row[1]) && row[1] > 0);
  if (clean.length < rules.minRankSample + 252) return null;
  const dates = clean.map((row) => row[0]);
  const closes = clean.map((row) => row[1]);
  const raw = rawComponents(closes);
  const ranks = Object.fromEntries(TEMPERATURE_COMPONENTS.map(({ id }) => [id, trailingRanks(raw[id], { window: rules.rankWindow, minSample: rules.minRankSample })]));
  const n = closes.length;
  const ready = (i) => TEMPERATURE_COMPONENTS.every(({ id }) => ranks[id][i] != null);
  const counts = (i) => {
    if (!ready(i)) return null;
    const scores = TEMPERATURE_COMPONENTS.map(({ id }) => ranks[id][i]);
    return { cold: scores.filter((s) => s <= rules.coldAtOrBelow).length, hot: scores.filter((s) => s >= rules.hotAtOrAbove).length, low: Math.min(...scores), high: Math.max(...scores) };
  };
  const stateAt = (i) => {
    const c = counts(i);
    if (!c) return null;
    return c.cold >= rules.extremeMinComponents ? 'cold' : c.hot >= rules.extremeMinComponents ? 'hot' : 'none';
  };
  const states = Array.from({ length: n }, (_, i) => stateAt(i));
  const last = n - 1;
  if (states[last] == null) return null;

  let streak = 0;
  for (let i = last; i >= 0 && states[i] === states[last]; i -= 1) streak += 1;

  // Evidence: forward price returns after the first day of each spell (a re-entry within clusterGapSessions joins the
  // previous spell), against every ranked day as the baseline. Spell starts can sit closer together than the horizon
  // (a 21-session gap is shorter than a 63-session window — codex audit F05, 2026-10-15), so each horizon keeps only
  // starts at least h sessions after the previous kept one: n is the non-overlapping sample, clusters the spell count.
  const forward = (i, h) => (i + h < n ? (closes[i + h] / closes[i] - 1) * 100 : null);
  const outcomes = {};
  for (const state of ['cold', 'hot']) {
    const starts = [];
    let lastIn = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (states[i] !== state) continue;
      if (i - lastIn > rules.clusterGapSessions) starts.push(i);
      lastIn = i;
    }
    outcomes[state] = { clusters: starts.length, lastStart: starts.length ? dates[starts.at(-1)] : null };
    for (const h of rules.horizons) {
      const kept = [];
      for (const i of starts) if (forward(i, h) != null && (!kept.length || i - kept.at(-1) >= h)) kept.push(i);
      outcomes[state][`h${h}`] = { ...stats(kept.map((i) => forward(i, h))), spells: starts.length, nonOverlapping: true };
    }
  }
  const firstRanked = states.findIndex((s) => s != null);
  outcomes.all = {};
  for (const h of rules.horizons) {
    const all = [];
    for (let i = firstRanked; i < n; i += 1) { const r = forward(i, h); if (r != null) all.push(r); }
    const s = stats(all);
    // Overlapping h-session windows: about n/h independent ones (the stress-outcomes D08 rule).
    outcomes.all[`h${h}`] = { ...s, se: s.sd == null ? null : round(s.sd / Math.sqrt(Math.max(1, s.n / h))) };
  }

  const snapshot = (i) => (i >= 0 && counts(i) ? { date: dates[i], ...counts(i), state: states[i] } : null);
  const now = counts(last);
  return {
    asOf: dates[last],
    close: round(closes[last], 2),
    change1d: round((closes[last] / closes[last - 1] - 1) * 100),
    // v58.80 (first-users bundle 1): raw at 4 places was rounded again on screen — the S&P 20-session return -1.546%
    // stored as -0.0155 printed -1.6% here beside -1.5% elsewhere. Six places keep the one rounding on the screen.
    components: TEMPERATURE_COMPONENTS.map(({ id, label }) => ({ id, label, score: ranks[id][last], raw: round(raw[id][last], 6) })),
    cold: now.cold,
    hot: now.hot,
    state: states[last],
    streak,
    week: snapshot(last - 5),
    month: snapshot(last - 21),
    from: dates[firstRanked],
    outcomes,
    history: Array.from({ length: Math.min(rules.historySessions, n) }, (_, k) => {
      const i = n - Math.min(rules.historySessions, n) + k;
      const c = counts(i);
      return [dates[i], round(closes[i], 2), c ? c.cold : null, c ? c.hot : null];
    })
  };
}
