// RM-03: extracted from js/aio-core.js:computeTradingScore (v51.98 Phase 3 A3 relocated it from
// index.html; this packet moves the scoring math itself into a pure module while the legacy
// function becomes a thin wrapper that gathers inputs and calls this). This is a pure function:
// no DOM, no global reads, no fetch — every value the legacy wrapper used to read from its own
// globals is now an explicit parameter, already clamped/evidence-gated exactly as the legacy
// wrapper gated it before. The formula itself (thresholds, weights,
// corrections, order of operations) is transcribed unchanged — this is code motion, not a new
// model (R352/F-03: legacy and native must not diverge into two different formulas).
export const TRADING_SCORE_MODEL_VERSION = 'trading-score.v1';
export const SIGNAL_DECISION_MODEL_VERSION = 'signal-from-trading-score.v1';

function finiteNumber(value) {
  return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}

/**
 * @param {object} input
 * @param {'day'|'swing'|string|undefined} input.mode
 * @param {number|null} input.vix        clamped 5-150
 * @param {number|null} input.vvix       clamped 50-250
 * @param {number|null} input.dxy        clamped 80-130
 * @param {number|null} input.tnx        clamped 0-8
 * @param {number|null} input.oilPrice   clamped 0-300
 * @param {number|null} input.fg         clamped 0-100, already evidence-gated (allowedUse==='decision')
 * @param {boolean} input.maCurrent      whether the legacy `_spxMA` global is fresh (<=4 days old)
 * @param {number|null} input.spx200ma   legacy `_spxMA[200]` when maCurrent, else null
 * @param {number|null} input.spx50ma    legacy `_spxMA[50]` when maCurrent, else null
 * @param {number|null} input.spxPrice   closing/live ^GSPC price
 * @param {boolean} input.breadthAvailable
 * @param {number|null} input.breadth200 % above 20-SMA, when breadthAvailable
 * @param {number|null} input.pcr        put/call ratio, already evidence-gated
 * @param {number|null} input.hyBp       FRED HY OAS in bp, already evidence-gated
 * @param {number|null} input.newsSentimentScore  null means "skip the news sentiment adjustment"
 *   (matches the legacy try/catch: if gathering it threw, no adjustment was applied)
 * @param {Array<{impact:number}>} input.newsRiskSignals  empty array means "skip" (same reason)
 */
export function computeTradingScoreModel(input = {}) {
  const { mode, vix, vvix, dxy, tnx, oilPrice, fg, maCurrent, spx200ma, spx50ma, spxPrice, breadthAvailable, breadth200, pcr, hyBp, newsSentimentScore, newsRiskSignals } = input;

  // 1. Volatility Score (25%) — lower VIX is better for trading
  let volScore = null;
  if (vix == null) volScore = null;
  else if (vix < 15) volScore = 90;
  else if (vix < 18) volScore = 78;
  else if (vix < 22) volScore = 62;
  else if (vix < 27) volScore = 42;
  else if (vix < 35) volScore = 22;
  else volScore = 8;
  // Day trading: elevated volatility is slightly better
  if (mode === 'day' && volScore != null) {
    if (vix >= 18 && vix < 30) volScore = Math.min(100, volScore + 12);
  }

  // 2. Momentum Score (25%) — Fear&Greed as proxy, inverted-U (extreme greed fades)
  let momScore = null;
  if (fg == null) momScore = null;
  else if (fg >= 75) momScore = 66;
  else if (fg >= 55) momScore = 74;
  else if (fg >= 45) momScore = 52;
  else if (fg >= 25) momScore = 34;
  else momScore = 25;

  // 3. Trend Score (20%) — SPX vs estimated MAs (종가 기준)
  let trendCalcScore = null;
  if (!spxPrice || !spx50ma || !spx200ma) trendCalcScore = null;
  else if (spxPrice > spx50ma * 1.02) trendCalcScore = 82;
  else if (spxPrice > spx50ma) trendCalcScore = 68;
  else if (spxPrice > spx200ma) trendCalcScore = 50;
  else if (spxPrice > spx200ma * 0.97) trendCalcScore = 32;
  else trendCalcScore = 15;
  let trendScore = maCurrent ? trendCalcScore : null;

  // 4. Breadth Score (20%) — % above 20 SMA
  let breadthCalcScore = null;
  if (breadth200 != null && breadth200 > 70) breadthCalcScore = 88;
  else if (breadth200 != null && breadth200 > 55) breadthCalcScore = 72;
  else if (breadth200 != null && breadth200 > 40) breadthCalcScore = 52;
  else if (breadth200 != null && breadth200 > 25) breadthCalcScore = 28;
  else if (breadth200 != null) breadthCalcScore = 12;
  let breadthScore = breadthAvailable ? breadthCalcScore : null;

  // 5. Macro Score (10%) — 기저 55, 누진 감점
  let macroScore = dxy != null && tnx != null && vvix != null ? 55 : null;
  if (macroScore != null && dxy > 107) macroScore -= 12;
  if (macroScore != null && dxy > 110) macroScore -= 8;
  if (macroScore != null && tnx > 4.5) macroScore -= 10;
  if (macroScore != null && fg != null && fg < 20) macroScore -= 5;
  if (macroScore != null && vvix > 110) macroScore -= 8;
  if (macroScore != null) macroScore = Math.max(10, Math.min(90, macroScore));

  // Put/Call ratio correction
  if (pcr != null && momScore != null && pcr > 1.3) { momScore = Math.max(5, momScore - 8); }
  else if (pcr != null && momScore != null && pcr > 1.1) { momScore = Math.max(5, momScore - 4); }

  // 교차변수 보정 — 복합 리스크 시 추가 감점
  let crossRiskCount = 0;
  if (vix != null && vix > 25) crossRiskCount++;
  if (dxy != null && dxy > 107) crossRiskCount++;
  if (tnx != null && tnx > 4.5) crossRiskCount++;
  if (oilPrice != null && oilPrice > 100) crossRiskCount++;
  if (crossRiskCount >= 3 && macroScore != null) macroScore = Math.max(10, macroScore - 10);

  // 추세-시장폭 다이버전스 보너스/패널티
  if (trendScore != null && breadthScore != null && trendScore > 65 && breadthScore < 30) {
    trendScore = Math.max(10, trendScore - 10);
    trendCalcScore = trendScore;
  } else if (trendScore != null && breadthScore != null && trendScore < 35 && breadthScore > 55) {
    breadthScore = Math.min(90, breadthScore + 8);
    breadthCalcScore = breadthScore;
  }

  const weightedComponents = [
    { value: volScore, weight: 25 }, { value: momScore, weight: 25 },
    { value: trendCalcScore, weight: 20 }, { value: breadthCalcScore, weight: 20 },
    { value: macroScore, weight: 10 }
  ];
  const availableWeight = weightedComponents.reduce((sum, row) => sum + (row.value == null ? 0 : row.weight), 0);
  let compositeScore = availableWeight ? Math.round(weightedComponents.reduce((sum, row) => sum + (row.value == null ? 0 : row.value * row.weight), 0) / availableWeight) : null;

  // Credit Stress 보정 (HY Spread bp, 실측 우선)
  if (compositeScore != null && hyBp != null && hyBp > 500) compositeScore -= 15;
  else if (compositeScore != null && hyBp != null && hyBp > 400) compositeScore -= 8;
  else if (compositeScore != null && hyBp != null && hyBp > 350) compositeScore -= 3;

  // 지정학 위험 보정 (유가)
  if (compositeScore != null && oilPrice != null && oilPrice > 100) compositeScore -= 10;
  else if (compositeScore != null && oilPrice != null && oilPrice > 90) compositeScore -= 5;

  // 뉴스 감성/리스크 보정 — null/[] means the legacy gather step failed and applied no adjustment
  if (compositeScore != null && newsSentimentScore != null && newsSentimentScore < 30) compositeScore -= 8;
  else if (compositeScore != null && newsSentimentScore != null && newsSentimentScore > 70) compositeScore += 5;
  if (compositeScore != null && Array.isArray(newsRiskSignals)) {
    newsRiskSignals.forEach((riskSignal) => { compositeScore += riskSignal.impact; });
  }

  // 최소 5점 보장 — 0점은 "데이터 미수신"으로 오해되므로 바닥값 설정
  const total = compositeScore == null ? null : Math.max(5, Math.min(100, compositeScore));

  const componentMissing = [];
  if (volScore == null) componentMissing.push('volatility');
  if (momScore == null) componentMissing.push('momentum');
  if (!maCurrent) componentMissing.push('trend');
  if (!breadthAvailable) componentMissing.push('breadth');
  if (macroScore == null) componentMissing.push('macro');

  return {
    total,
    score: total,
    modelVersion: TRADING_SCORE_MODEL_VERSION,
    volScore, momScore, trendScore, breadthScore, macroScore,
    componentCoveragePct: availableWeight,
    componentMissing,
    partial: availableWeight < 100
  };
}

/**
 * Convert the canonical market-environment score into the analysis signal
 * envelope. This is intentionally descriptive (WATCH/WAIT/REDUCE), not a
 * security-specific buy/sell prediction.
 */
export function deriveSignalDecisionFromTradingScore({ score = {}, inputVersion = 'unknown' } = {}) {
  const total = finiteNumber(score?.total ?? score?.score);
  const missing = Array.isArray(score?.componentMissing) ? score.componentMissing.slice() : [];
  if (total == null) {
    return Object.freeze({
      modelVersion: SIGNAL_DECISION_MODEL_VERSION,
      inputVersion,
      status: 'blocked',
      action: 'WAIT',
      score: null,
      reasons: missing.length ? ['required-input-missing', ...missing.map((key) => `missing:${key}`)] : ['required-input-missing']
    });
  }
  const action = total >= 60 ? 'WATCH' : total <= 30 ? 'REDUCE' : 'WAIT';
  const band = total >= 60 ? 'favorable' : total <= 30 ? 'defensive' : 'neutral';
  const reasons = [`trading-score-band:${band}`];
  if (missing.length) reasons.push(...missing.map((key) => `missing:${key}`));
  return Object.freeze({
    modelVersion: SIGNAL_DECISION_MODEL_VERSION,
    inputVersion,
    status: score?.partial ? 'partial' : 'current',
    action,
    score: total,
    reasons
  });
}
