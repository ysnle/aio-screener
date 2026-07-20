// RM-03 item 2: extracted from js/aio-core.js:calcTechnicalSnapshot (MA-stack/stage block) and
// index.html:updateMTF (trend classification block). Pure functions: no DOM, no window globals —
// every value the legacy call site read from its own locals is now an explicit parameter. The
// formulas (MA-stack thresholds, stage enum, MTF trend thresholds) are transcribed unchanged —
// this is code motion, not a new model (R352/F-03: legacy and native must not diverge).
export const STAGE_MODEL_VERSION = 'stage.v1';
export const MTF_MODEL_VERSION = 'mtf.v1';

/**
 * @param {object} input
 * @param {number|null} input.sma5
 * @param {number|null} input.sma10
 * @param {number|null} input.sma20
 * @param {number|null} input.sma50
 * @param {number|null} input.sma100
 * @param {number|null} input.sma200
 * @param {number|null} input.sma50Prior   SMA50 computed 5 bars earlier (rising/falling probe)
 * @param {number|null} input.lastClose
 */
export function classifyMovingAverageStructure({ sma5 = null, sma10 = null, sma20 = null, sma50 = null, sma100 = null, sma200 = null, sma50Prior = null, lastClose = null } = {}) {
  const shortBull = !!(sma5 && sma10 && sma20 && sma5 > sma10 && sma10 > sma20);
  const shortBear = !!(sma5 && sma10 && sma20 && sma5 < sma10 && sma10 < sma20);
  const longBull = !!(sma50 && sma100 && sma200 && sma50 > sma100 && sma100 > sma200);
  const longBear = !!(sma50 && sma100 && sma200 && sma50 < sma100 && sma100 < sma200);
  const fullBull = !!(shortBull && sma20 && sma50 && sma20 > sma50 && longBull);
  const fullBear = !!(shortBear && sma20 && sma50 && sma20 < sma50 && longBear);
  const sma50Rising = (sma50 && sma50Prior) ? sma50 > sma50Prior : null;
  const shortMAState = shortBull ? 'SHORT_BULL_STACK_5_10_20' : shortBear ? 'SHORT_BEAR_STACK_5_10_20' : 'SHORT_MIXED';
  const longMAState = longBull ? 'LONG_BULL_STACK_50_100_200' : longBear ? 'LONG_BEAR_STACK_50_100_200' : 'LONG_MIXED';
  const fullMAState = fullBull ? 'FULL_BULL_STACK_5_10_20_50_100_200' : fullBear ? 'FULL_BEAR_STACK_5_10_20_50_100_200' : 'PARTIAL_STACK';
  const maStackScore = (shortBull ? 25 : shortBear ? 0 : 10) + (longBull ? 35 : longBear ? 0 : 15) + (fullBull ? 25 : fullBear ? 0 : 8) + ((sma50 && lastClose >= sma50) ? 8 : 0) + ((sma200 && lastClose >= sma200) ? 7 : 0);
  const trendState = fullBull && sma50Rising !== false ? 'UPTREND' : fullBull && sma50Rising === false ? 'TOPPING' : fullBear ? 'DOWNTREND' : sma50 && lastClose < sma50 ? 'TREND_DAMAGED' : 'MIXED';
  const stageEstimate = fullBull && sma50Rising !== false ? 'STAGE_2_ADVANCE' : fullBull && sma50Rising === false ? 'STAGE_3_TOPPING' : fullBear ? 'STAGE_4_DECLINE' : sma50 && lastClose < sma50 ? 'STAGE_4_OR_BASE_REPAIR' : 'STAGE_1_OR_3_TRANSITION';
  return Object.freeze({
    modelVersion: STAGE_MODEL_VERSION,
    shortBull, shortBear, longBull, longBear, fullBull, fullBear, sma50Rising,
    shortMAState, longMAState, fullMAState, maStackScore, trendState, stageEstimate
  });
}

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export function classifyDailyTrend(dayGainPct) {
  const value = finite(dayGainPct);
  if (value == null) return 'pending';
  if (value > 0.15) return 'up';
  if (value < -0.15) return 'down';
  return 'neutral';
}

export function classifyWeeklyTrend(weeklyRaw) {
  const text = String(weeklyRaw || '');
  if (/UP|BULL|상승/i.test(text)) return 'up';
  if (/DOWN|BEAR|하락/i.test(text)) return 'down';
  if (weeklyRaw) return 'mixed';
  return 'pending';
}

export function classifyMediumTrend({ bars = 0, longMAState = null } = {}) {
  if (!(bars >= 200)) return 'pending';
  if (typeof longMAState === 'string' && longMAState.indexOf('BULL') >= 0) return 'up';
  if (typeof longMAState === 'string' && longMAState.indexOf('BEAR') >= 0) return 'down';
  return 'mixed';
}

/** @param {object} snapshot  the calcTechnicalSnapshot()-shaped object (or null/unavailable) */
export function deriveMultiTimeframeView(snapshot) {
  if (!snapshot || !snapshot.ok) return Object.freeze({ available: false, modelVersion: MTF_MODEL_VERSION });
  return Object.freeze({
    available: true,
    modelVersion: MTF_MODEL_VERSION,
    daily: classifyDailyTrend(snapshot.dayGainPct),
    weekly: classifyWeeklyTrend(snapshot.weeklyCtx && snapshot.weeklyCtx.wTrend),
    medium: classifyMediumTrend({ bars: snapshot.bars, longMAState: snapshot.longMAState }),
    quarterly: 'pending'
  });
}
