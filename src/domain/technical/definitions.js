// v57.84 (technical definitions): the one owner of the indicator definitions the chart (chart-analysis.js), the
// moving-average structure (stage.js), the screener producer (screener/price-factors.js), the setup profile and the stock
// summary read. Before this file each computed its own: ATR was a 14-session simple mean on the chart and Wilder's in the
// legacy snapshot; the chart's "50일선 대비 배수" divided by ATR while the screener and the summary divided by ADR, against
// the same 2/4/7 bands; the producer called 60 sessions of highs a "52주" range that the chart refused below 252.
// Periods and bands are RULES.technical constants (R713). Pure functions: no DOM, no globals.
import { RULES } from '../rules/thresholds.js';

export const TECHNICAL_DEFINITIONS_VERSION = 'technical-definitions.v1';
const T = RULES.technical;

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Simple moving average per index (null until `period` values exist). */
export function smaSeries(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    let sum = 0;
    for (let k = index + 1 - period; k <= index; k++) sum += values[k];
    return sum / period;
  });
}

/** Simple average of the last `period` values, or null when fewer exist. */
export function smaLast(values, period) {
  if (!Array.isArray(values) || period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/** Exponential moving average per index, seeded with the simple average of the first `period` values. */
export function emaSeries(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  values.forEach((value, index) => {
    if (index + 1 < period) { out.push(null); return; }
    if (prev == null) { prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; out.push(prev); return; }
    prev = value * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

/** Last EMA value, or null when fewer than `period` values exist. */
export function emaLast(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return emaSeries(values, period).at(-1) ?? null;
}

/** True range per bar; the first bar has no prior close, so its range is high − low. */
export function trueRanges(bars) {
  return bars.map((bar, i) => (i ? Math.max(bar.high - bar.low, Math.abs(bar.high - bars[i - 1].close), Math.abs(bar.low - bars[i - 1].close)) : bar.high - bar.low));
}

/** Wilder's ATR (the published definition, and the legacy snapshot's): needs period + 1 bars. */
export function atrWilder(bars, period = T.atrPeriod) {
  if (!Array.isArray(bars) || bars.length < period + 1) return null;
  const ranges = trueRanges(bars).slice(1);
  let atr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let k = period; k < ranges.length; k++) atr = (atr * (period - 1) + ranges[k]) / period;
  return atr;
}

/**
 * Average daily range in % — the mean of (high − low) ÷ that session's close over the last `period` sessions. The
 * screener publishes this as adrPct; the chart computes the same number from its own bars.
 */
export function adrPctOf(highs, lows, closes, period = T.adrPeriod) {
  const n = Math.min(highs?.length || 0, lows?.length || 0, closes?.length || 0);
  if (n < 1) return null;
  const window = Math.min(period, n);
  const values = [];
  for (let i = n - window; i < n; i++) {
    const high = highs[i], low = lows[i], base = closes[i];
    // A missing low is unknown: `null >= 0` is true in JS and used to count a full-height bar (high − 0).
    if (high > 0 && low > 0 && high >= low && base > 0) values.push((high - low) / base * 100);
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/**
 * Highest high and lowest low over the last `sessions` bars. fullYear is false below RULES fullYearSessions (240): the range is then
 * "최근 N거래일", never a 52-week figure (P1428).
 */
export function rangeExtremesOf(highs, lows, sessions = T.rangeSessions) {
  const n = Math.min(highs?.length || 0, lows?.length || 0);
  if (n < 1) return null;
  const from = Math.max(0, n - sessions);
  const hi = highs.slice(from, n).filter((value) => value > 0);
  const lo = lows.slice(from, n).filter((value) => value > 0);
  if (!hi.length || !lo.length) return null;
  // v57.92 (internal review M02): the full-year test counts the span of real bars, not the array length — 239 null pairs
  // and one valid bar used to pass as a 52-week range. Producer and chart bars carry no null rows, so their result is unchanged.
  let firstValid = from;
  while (firstValid < n && !(highs[firstValid] > 0 && lows[firstValid] > 0)) firstValid += 1;
  return Object.freeze({ high: Math.max(...hi), low: Math.min(...lo), sessions: n - from, fullYear: n - firstValid >= Math.min(sessions, T.fullYearSessions) });
}

/** Distance to the 50-day line in average daily ranges, one decimal; null when either input is missing or ADR ≤ 0. */
export function extensionMultiple(pctSma50, adrPct) {
  // Coerces numeric strings (the summary reads artifact rows), unlike the strict `finite` above.
  const value = pctSma50 == null || pctSma50 === '' ? null : finite(Number(pctSma50));
  const adr = adrPct == null || adrPct === '' ? null : finite(Number(adrPct));
  return value == null || adr == null || !(adr > 0) ? null : Math.round(value / adr * 10) / 10;
}

/** The setup bands for an extension multiple: near-base · normal · extended · stretched (unavailable when missing). */
export function extensionStateFor(multiple) {
  const value = finite(multiple);
  if (value == null) return 'unavailable';
  const bands = T.extension;
  return value >= bands.stretched ? 'stretched' : value >= bands.extended ? 'extended' : value <= bands.nearBase ? 'near-base' : 'normal';
}

/** Last close of each ISO week (Monday key), oldest first. */
export function weeklyCloses(bars) {
  const weekly = [];
  for (const bar of bars) {
    const d = new Date(`${bar.time}T12:00:00Z`);
    const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (weekly.length && weekly[weekly.length - 1].key === key) weekly[weekly.length - 1].close = bar.close; else weekly.push({ key, close: bar.close });
  }
  return weekly;
}

export const WEINSTEIN_READS = Object.freeze({
  1: '바닥 형성 — 30주선이 평평하거나 아직 내려가는 중이고, 가격이 그 주변에서 다지는 단계',
  2: '상승 추세 — 가격이 오르는 30주선 위에 있는 단계(추세 추종이 유효한 구간)',
  3: '천장 형성 — 오르던 30주선이 평평해지거나 가격이 그 아래로 내려오는 단계',
  4: '하락 추세 — 가격이 내려가는 30주선 아래에 있는 단계'
});

/**
 * Weinstein stage on weekly closes: the 30-week average and its 4-week slope. Flat (|slope| < 1%) is a base (1) or a
 * top (3) by whether the average stands above where it was 26 weeks ago; rising is 2 above the line and 3 under it;
 * falling is 4 under the line and 1 above it. The only reading that may be called 'n단계' (stage.js names the moving-
 * average order, not this).
 */
export function weinsteinStage(closes, rules = T.weinstein) {
  const w30 = smaSeries(closes, rules.maWeeks);
  const wn = closes.length - 1;
  const now = w30[wn];
  const then = wn >= rules.slopeWeeks ? w30[wn - rules.slopeWeeks] : null;
  if (now == null || then == null) return null;
  const prior = wn >= rules.priorWeeks ? w30[wn - rules.priorWeeks] : null;
  const slope = (now / then - 1) * 100;
  const above = closes[wn] > now;
  const flat = Math.abs(slope) < rules.flatSlopePct;
  const stage = flat ? (prior != null && now > prior ? 3 : 1) : slope > 0 ? (above ? 2 : 3) : (above ? 1 : 4);
  return Object.freeze({ stage, slope, above, text: WEINSTEIN_READS[stage] });
}

// v57.84 (owner decision, TECHNICAL-DEFINITIONS 2절 1): moved from chart-analysis.js — the one VCP contraction detector for the
// chart, the screener producer (price-factors _calcVCPServer) and the legacy snapshot (aio-core _calcVCP via AIO_ARCH).
// Swing points: a bar whose high (low) is the extreme of `span` bars on each side.
function swings(bars, span) {
  const highs = []; const lows = [];
  for (let i = span; i < bars.length - span; i++) {
    let isHigh = true; let isLow = true;
    for (let k = i - span; k <= i + span; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) isHigh = false;
      if (bars[k].low <= bars[i].low) isLow = false;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

/**
 * Volatility contraction: from the highest high of the base, each pullback (swing high → next swing
 * low) must be shallower than the one before; the last one sets the pivot (its swing high).
 */
export function detectContractions(bars, { lookback = 130, span = 3 } = {}) {
  const start = Math.max(0, bars.length - lookback);
  const recent = bars.slice(start);
  if (recent.length < 30) return { contractions: [], valid: false, pivot: null };
  // v57.84 review: the base high is searched only up to the last confirmable swing (span bars before the end). Taking
  // the newest bar made a new-high breakout erase its own base — no contractions, no pivot, state 'none'.
  let baseIndex = 0;
  const baseLimit = Math.max(1, recent.length - span - 1);
  recent.slice(0, baseLimit).forEach((bar, index) => { if (bar.high > recent[baseIndex].high) baseIndex = index; });
  const { highs, lows } = swings(recent, span);
  const contractions = [];
  let cursorHigh = baseIndex;
  for (let guard = 0; guard < 8; guard++) {
    const lowIndex = lows.find((index) => index > cursorHigh);
    if (lowIndex == null) break;
    const segment = recent.slice(cursorHigh, lowIndex + 1);
    const low = Math.min(...segment.map((bar) => bar.low));
    const depth = (recent[cursorHigh].high - low) / recent[cursorHigh].high * 100;
    contractions.push({ highIndex: start + cursorHigh, lowIndex: start + lowIndex, high: recent[cursorHigh].high, low, depth });
    const nextHigh = highs.find((index) => index > lowIndex);
    if (nextHigh == null) break;
    cursorHigh = nextHigh;
  }
  const all = contractions.filter((row) => row.depth >= 2);
  // The pattern is the latest run of successively shallower pullbacks (Minervini's 'T' count),
  // not the whole base: walk back from the last pullback while each earlier one was deeper.
  let startRun = all.length - 1;
  while (startRun > 0 && all[startRun - 1].depth > all[startRun].depth) startRun--; // v57.84: strictly shallower, as the comment says
  const meaningful = all.slice(Math.max(0, startRun));
  const valid = meaningful.length >= 2 && meaningful[meaningful.length - 1].depth <= 12 && meaningful[0].depth <= 40;
  const last = meaningful[meaningful.length - 1] || null;
  return { contractions: meaningful, valid, pivot: last ? last.high : null, baseHigh: recent[baseIndex].high };
}
