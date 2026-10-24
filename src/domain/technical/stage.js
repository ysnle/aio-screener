// RM-03 item 2: extracted from js/aio-core.js:calcTechnicalSnapshot (MA-stack/stage block) and
// index.html:updateMTF (trend classification block). Pure functions: no DOM, no window globals —
// every value the legacy call site read from its own locals is now an explicit parameter. The
// formulas (MA-stack thresholds, stage enum, MTF trend thresholds) are transcribed unchanged —
// this is code motion, not a new model (R352/F-03: legacy and native must not diverge).
import { finiteNumber as finite } from '../shared/number.js';
import { smaLast } from './definitions.js';
export const STAGE_MODEL_VERSION = 'stage.v4';
const STAGE_BY_TREND = Object.freeze({ UPTREND: 'STAGE_2_ADVANCE', TOPPING: 'STAGE_3_TOPPING', PULLBACK: 'STAGE_2_PULLBACK', DOWNTREND: 'STAGE_4_DECLINE', TREND_DAMAGED: 'STAGE_4_OR_BASE_REPAIR', MIXED: 'STAGE_1_OR_3_TRANSITION' });
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
  // Audit 2026-10-17 follow-up: the 0-100 maStackScore composite had no surface and no stated basis (AGENTS: no grade
  // without evidence), so the model returns only the named stack states.
  // v57.81 (analysis audit): the close is read against the 50- and 20-day lines before the stack. A full bull stack with
  // the close under the 50-day line is damaged, and under the 20-day line a pullback — DELL closed 9.1% under its
  // 20-day line and read "정배열(50일선 상승)". A missing close never reads as an advance.
  const under50 = !!(sma50 && lastClose != null && lastClose < sma50);
  const under20 = !!(sma20 && lastClose != null && lastClose < sma20);
  // Audit 2026-10-17 (owner D7): the trend is the close over a 50-day line that is over the 200-day line (Minervini's core
  // template), not the full 5>10>20>50>100>200 stack — on the 10/16 screener rows 172 of 286 names above both lines with
  // the 50 over the 200 read 혼조 after two quiet sessions. The short 5·10·20 order stays its own field (shortMAState).
  const bullHeld = !!(sma50 && sma200 && lastClose != null && !under50 && lastClose > sma50 && sma50 > sma200);
  const trendState = bullHeld && !under20 && sma50Rising !== false ? 'UPTREND' : bullHeld && !under20 ? 'TOPPING' : bullHeld ? 'PULLBACK'
    : fullBear ? 'DOWNTREND' : under50 ? 'TREND_DAMAGED' : 'MIXED';
  const stageEstimate = STAGE_BY_TREND[trendState];
  return Object.freeze({
    modelVersion: STAGE_MODEL_VERSION,
    shortBull, shortBear, longBull, longBear, fullBull, fullBear, sma50Rising,
    shortMAState, longMAState, fullMAState, trendState, stageEstimate
  });
}

// v57.50 C19: stageEstimate is a moving-average-stack reading (5·10·20·50·100·200 order + 50-day slope), not
// Weinstein's 30-week stage. The enum ids stay for parity; anything shown to a reader uses these names, and
// 'Stage n' is reserved for the Weinstein reading (chart-analysis weinstein).
export const MA_STRUCTURE_LABELS = Object.freeze({
  STAGE_2_ADVANCE: '이동평균 배열, 상승 추세(50일선 상승)',
  STAGE_3_TOPPING: '이동평균 배열, 상승 추세(50일선 둔화)',
  STAGE_2_PULLBACK: '이동평균 배열, 20일선 아래 눌림(50일선 위)',
  STAGE_4_DECLINE: '이동평균 배열, 역배열',
  STAGE_4_OR_BASE_REPAIR: '이동평균 배열, 50일선 아래(훼손)',
  STAGE_1_OR_3_TRANSITION: '이동평균 배열, 혼조'
});

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

// 2026-07-21/P756: sma(closes, period) is the simple average of the last `period` values (null if fewer) — the legacy
// _calcSMA. v57.84: it is technical/definitions.js smaLast, the one copy the chart and the screener producer also use.
const sma = smaLast;

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
export function deriveTechnicalStageFromOhlcv({ symbol = null, ohlcv = [], inputVersion = 'unknown', now = Date.now(), maxAgeMs = 7 * 86_400_000 } = {}) {
  const points = Array.isArray(ohlcv) ? ohlcv : [];
  const timeValue = (point) => point?.observedAt ?? point?.date ?? point?.time ?? point?.timestamp ?? null;
  const timestamped = points.some((point) => timeValue(point) != null && String(timeValue(point)).trim() !== '');
  // Moving windows require one contiguous, chronologically ordered tail. Dropping
  // an invalid middle bar and stitching older/newer observations together shifts
  // every MA period and can create a stage that never existed at one time cut.
  const closes = [];
  let nextObservedMs = Infinity;
  let latestObservedMs = null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    const close = Number(point?.close);
    if (!Number.isFinite(close) || close <= 0) break;
    const rawTime = timeValue(point);
    const observedMs = rawTime == null || String(rawTime).trim() === '' ? null : Date.parse(rawTime);
    if (timestamped && !Number.isFinite(observedMs)) break;
    if (observedMs != null && observedMs >= nextObservedMs) break;
    if (latestObservedMs == null && observedMs != null) latestObservedMs = observedMs;
    nextObservedMs = observedMs ?? nextObservedMs;
    closes.unshift(close);
  }
  const sma5 = sma(closes, 5), sma10 = sma(closes, 10), sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma100 = sma(closes, 100), sma200 = sma(closes, 200);
  // mirrors calcTechnicalSnapshot's sma50_5d probe (SMA50 five bars ago, for the sma50Rising signal)
  const sma50Prior = closes.length >= 55 ? sma(closes.slice(0, -5), 50) : null;
  const current = closes.at(-1) ?? null;
  const previous = closes.at(-2) ?? null;
  const changePct = current != null && previous ? ((current - previous) / previous) * 100 : null;
  const structure = classifyMovingAverageStructure({ sma5, sma10, sma20, sma50, sma100, sma200, sma50Prior, lastClose: current });
  // v57.81: the 20-day position is the close against the 20-day line itself, not the stack's verdict.
  const trend = current != null && sma20 != null ? (current > sma20 ? 'above-ma20' : current < sma20 ? 'below-ma20' : null) : null;
  const nowMs = Number(now);
  const ageMs = latestObservedMs == null || !Number.isFinite(nowMs) ? null : nowMs - latestObservedMs;
  const freshness = ageMs == null ? 'unknown' : ageMs >= 0 && ageMs <= maxAgeMs ? 'fresh' : 'stale';
  const status = closes.length < 2 ? 'unavailable' : closes.length >= 200 && freshness === 'fresh' ? 'current' : 'partial';
  return Object.freeze({
    modelVersion: STAGE_MODEL_VERSION,
    inputVersion,
    symbol: symbol ? String(symbol).toUpperCase() : null,
    status,
    indicators: Object.freeze({ current, changePct, ma20: sma20, ma50: sma50, trend }),
    structure,
    observedCount: closes.length,
    observedAt: latestObservedMs == null ? null : new Date(latestObservedMs).toISOString(),
    freshness
  });
}
