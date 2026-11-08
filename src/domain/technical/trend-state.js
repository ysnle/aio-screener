// v59.85 (chart review 2026-11-08, one trend vocabulary): the trend of a bar series in the words the screener row uses.
// The inputs bands.js classifyTrend reads from a screener row — distance to the 50- and 200-bar lines, the 20-bar
// average daily range (ADR) and the five-bar return — are computed here from the bars themselves, so the stock chart's
// chip and trend areas, the market candle cards, the multi-timeframe strip and the 기술적 분석 index cards all say the
// same word the 종목 page and the screener say for the same numbers. Pure functions, no DOM.
import { classifyTrend, recentDrop, trendKey } from './bands.js';
import { smaSeries } from './definitions.js';
import { RULES } from '../rules/thresholds.js';

export const TREND_STATE_VERSION = 'trend-state.v1';
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Up or down for the shaded trend areas. Above both lines (incl. a short-term shake) shades up, below both shades down;
 * 조정 and 반등 (the lines disagree) stay unshaded. 50일선 부근 says the side is not readable yet, so the area keeps the
 * direction it had rather than opening a gap every time a calm index hugs its 50-day line.
 */
export const TREND_DIRECTION = Object.freeze({ up: 'up', recovery: 'up', 'up-shaken': 'up', down: 'down', breakdown: 'down' });
const INHERITS_DIRECTION = new Set(['near50']);

/** The classifier's inputs at bar `i` from precomputed 50/200 lines; ADR and the five-bar return need high/low. */
function inputsAt(bars, i, sma50, sma200, positionOnly) {
  const close = bars[i].close;
  const s50 = isNum(sma50[i]) && sma50[i] > 0 ? (close / sma50[i] - 1) * 100 : null;
  const s200 = isNum(sma200[i]) && sma200[i] > 0 ? (close / sma200[i] - 1) * 100 : null;
  if (positionOnly) return { s50, s200, positionOnly: true };
  const period = RULES.technical.adrPeriod;
  let sum = 0, count = 0;
  for (let k = Math.max(0, i - period + 1); k <= i; k++) {
    const bar = bars[k];
    if (bar.high > 0 && bar.low > 0 && bar.high >= bar.low && bar.close > 0) { sum += (bar.high - bar.low) / bar.close * 100; count++; }
  }
  const adr = count >= Math.min(period, i + 1) * 0.8 && count ? sum / count : null;
  const ret5d = i >= 5 && bars[i - 5].close > 0 ? (close / bars[i - 5].close - 1) * 100 : null;
  return { s50, s200, adr, drop: recentDrop({ ret5d, adrPct: adr }) };
}

/**
 * The canonical trend on the last bar plus a per-bar key series with a `confirm`-bar hysteresis (a new state has to hold
 * that many bars before it replaces the old one, and the confirmed run is painted from its first bar), and the up/down
 * segments the chart shades. `positionOnly` is for closes without a high/low (published index levels).
 */
export function trendStateSeries(bars, { confirm = 3, positionOnly = false, sma50 = null, sma200 = null } = {}) {
  const list = Array.isArray(bars) ? bars : [];
  const closes = list.map((bar) => bar.close);
  const s50 = sma50 || smaSeries(closes, 50), s200 = sma200 || smaSeries(closes, 200);
  const raw = list.map((_, i) => classifyTrend(inputsAt(list, i, s50, s200, positionOnly)));
  const keys = raw.map(trendKey);
  const states = keys.map(() => null);
  let current = null, candidate = null, run = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key == null) { states[i] = null; current = null; candidate = null; run = 0; continue; }
    if (current == null) { current = key; states[i] = key; continue; }
    if (key === current) { candidate = null; run = 0; states[i] = current; continue; }
    if (key !== candidate) { candidate = key; run = 1; } else run++;
    if (run >= confirm) {
      current = candidate;
      for (let k = i - run + 1; k <= i; k++) states[k] = current;
      candidate = null; run = 0;
    } else states[i] = current;
  }
  const segments = [];
  let carried = null;
  for (let i = 0; i < states.length; i++) {
    const dir = INHERITS_DIRECTION.has(states[i]) ? carried : TREND_DIRECTION[states[i]] || null;
    carried = dir;
    if (!dir) continue;
    const prev = segments.at(-1);
    if (prev && prev.dir === dir && prev.to === i - 1) prev.to = i; else segments.push({ dir, from: i, to: i });
  }
  // The word shown is the latest bar's own reading (what the 종목 page says today); `held` is how long the confirmed
  // state has run, counted only when today's reading is that state.
  const last = raw.at(-1) || null;
  const lastKey = trendKey(last);
  let held = 0;
  if (lastKey != null && states.at(-1) === lastKey) for (let i = states.length - 1; i >= 0 && states[i] === lastKey; i--) held++;
  return { version: TREND_STATE_VERSION, current: last, key: lastKey, held, states, segments, direction: TREND_DIRECTION[lastKey] || null };
}

/** The canonical trend of the last bar only. */
export function trendOfBars(bars, options = {}) {
  return trendStateSeries(bars, options).current;
}
