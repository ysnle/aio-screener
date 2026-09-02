// RM-03 item 2: extracted from js/aio-core.js:calcTechnicalSnapshot (MA-stack/stage block) and
// index.html:updateMTF (trend classification block). Pure functions: no DOM, no window globals —
// every value the legacy call site read from its own locals is now an explicit parameter. The
// formulas (MA-stack thresholds, stage enum, MTF trend thresholds) are transcribed unchanged —
// this is code motion, not a new model (R352/F-03: legacy and native must not diverge).
export const STAGE_MODEL_VERSION = 'stage.v1';
export const MTF_MODEL_VERSION = 'mtf.v1';

// Supplied chart-pattern article integration. This is a glossary/taxonomy for
// analysis and chat context, not a new detector or a fixed hit-rate model.
export const CHART_PATTERN_REFERENCE = Object.freeze({
  id: 'chart-pattern-taxonomy-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  families: Object.freeze([
    Object.freeze({ id: 'reversal', label: '반전', patterns: Object.freeze(['double top/bottom', 'triple top/bottom', 'head and shoulders', 'reverse head and shoulders', 'rounding top/bottom', 'Quasimodo']), confirmation: 'neckline·거래량·추세 맥락을 함께 확인', invalidation: 'neckline 실패 또는 기존 추세가 유지되는 경우' }),
    Object.freeze({ id: 'continuation', label: '지속', patterns: Object.freeze(['wedge', 'flag', 'pennant']), confirmation: '강한 선행 이동·수렴·돌파 후 거래량 확인', invalidation: '돌파 실패 또는 수렴 구조가 무너지는 경우' }),
    Object.freeze({ id: 'neutral', label: '중립/방향 대기', patterns: Object.freeze(['converging triangle', 'symmetric broadening']), confirmation: '돌파 방향과 종가·거래량 확인 전 방향을 고정하지 않음', invalidation: '구조가 해소되거나 관측창이 부족한 경우' }),
    Object.freeze({ id: 'special', label: '특수 구조', patterns: Object.freeze(['cup and handle', 'Wolfe Wave']), confirmation: '손잡이 되돌림·파동점·EPA 등 해당 구조의 정의를 충족하는지 확인', invalidation: '필수 pivot/파동/손잡이 조건이 결여된 경우' })
  ]),
  constraints: Object.freeze([
    '패턴 이름만으로 현재 종목의 패턴·방향·목표가를 확정하지 않습니다.',
    '측정 목표·neckline·EPA는 OHLCV 기반 구조가 확정되고 무효화 조건이 함께 있을 때만 교육적으로 표시합니다.',
    '고정 적중률·과거 사례의 현재 재현·신호 점수 편입은 이 taxonomy의 기능이 아닙니다.'
  ])
});

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
  [sma5, sma10, sma20, sma50, sma100, sma200, sma50Prior, lastClose] = [sma5, sma10, sma20, sma50, sma100, sma200, sma50Prior, lastClose]
    .map((value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
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

// 2026-07-21/P756: sma(closes, period) replicates js/aio-core.js:_calcSMA exactly (simple average
// of the last `period` finite values, null if fewer than `period` are available) — not a legacy
// extraction (that function is one small piece of the much larger, still-legacy
// calcTechnicalSnapshot, which also computes ATR/RSI/MACD/Bollinger/VCP/Fibonacci/volume-profile
// and is out of scope here), but a faithful reimplementation of an unambiguous, single-definition
// arithmetic primitive (mean of N values) — not a "parallel model" in the R352 sense that rule
// guards against (that rule is about competing SCORING formulas with judgment calls, not about
// which of two files computes an average the same way).
function sma(closes, period) {
  if (!Array.isArray(closes) || closes.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

/**
 * OHLCV -> MA-stack/stage classification, composed from the already-extracted, already-parity-
 * verified classifyMovingAverageStructure (this function only supplies its inputs from raw
 * closes). Replaces the toy `deriveTechnicalModel` (src/domain/technical/indicators.js, retired
 * P756) as normalizeAnalysis's technical model — that toy was independently invented and had no
 * legacy formula behind it at all (confirmed by repo-wide grep before retiring it), whereas this
 * reuses the real classification legacy's own calcTechnicalSnapshot depends on.
 * @param {object} input
 * @param {string|null} input.symbol
 * @param {Array<{close:number}>} input.ohlcv  daily bars, oldest first (same shape the legacy
 *   provider already supplies via compatibility-facade.js readAnalysis)
 * @param {string} input.inputVersion
 */
export function deriveTechnicalStageFromOhlcv({ symbol = null, ohlcv = [], inputVersion = 'unknown' } = {}) {
  const closes = (Array.isArray(ohlcv) ? ohlcv : [])
    .map((point) => { const value = Number(point?.close); return Number.isFinite(value) && value > 0 ? value : null; })
    .filter((value) => value != null);
  const sma5 = sma(closes, 5), sma10 = sma(closes, 10), sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma100 = sma(closes, 100), sma200 = sma(closes, 200);
  // mirrors calcTechnicalSnapshot's sma50_5d probe (SMA50 five bars ago, for the sma50Rising signal)
  const sma50Prior = closes.length >= 55 ? sma(closes.slice(0, -5), 50) : null;
  const current = closes.at(-1) ?? null;
  const previous = closes.at(-2) ?? null;
  const changePct = current != null && previous ? ((current - previous) / previous) * 100 : null;
  const structure = classifyMovingAverageStructure({ sma5, sma10, sma20, sma50, sma100, sma200, sma50Prior, lastClose: current });
  const trend = structure.trendState === 'UPTREND' ? 'above-ma20' : structure.trendState === 'DOWNTREND' ? 'below-ma20' : null;
  const status = closes.length < 2 ? 'unavailable' : closes.length >= 200 ? 'current' : 'partial';
  return Object.freeze({
    modelVersion: STAGE_MODEL_VERSION,
    inputVersion,
    symbol: symbol ? String(symbol).toUpperCase() : null,
    status,
    indicators: Object.freeze({ current, changePct, ma20: sma20, ma50: sma50, trend }),
    structure,
    observedCount: closes.length
  });
}
