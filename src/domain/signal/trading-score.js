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
export const SIGNAL_PRESENTATION_MODEL_VERSION = 'signal-presentation.v1';

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
  const { mode, newsSentimentScore, newsRiskSignals } = input;
  const hasDecisionEvidence = !!input && input.decisionEvidence && typeof input.decisionEvidence === 'object';
  const decisionValue = (key, fallback) => {
    if (!hasDecisionEvidence) return finiteNumber(fallback);
    const evidence = input.decisionEvidence[key];
    if (!evidence || evidence.allowedUse !== 'decision' || !['live', 'fresh'].includes(evidence.status)) return null;
    return finiteNumber(evidence.value);
  };
  const vix = decisionValue('vix', input.vix);
  const vvix = decisionValue('vvix', input.vvix);
  const dxy = decisionValue('dxy', input.dxy);
  const tnx = decisionValue('tnx', input.tnx);
  const oilPrice = decisionValue('oilPrice', input.oilPrice);
  const fg = decisionValue('fg', input.fg);
  const spx200ma = decisionValue('spx200ma', input.spx200ma);
  const spx50ma = decisionValue('spx50ma', input.spx50ma);
  const spxPrice = decisionValue('spxPrice', input.spxPrice);
  const pcr = decisionValue('pcr', input.pcr);
  const hyBp = decisionValue('hyBp', input.hyBp);
  const breadth200 = decisionValue('breadth200', input.breadth200);
  const maCurrent = hasDecisionEvidence
    ? !!(decisionValue('spx200ma', input.spx200ma) != null && decisionValue('spx50ma', input.spx50ma) != null && decisionValue('spxPrice', input.spxPrice) != null)
    : input.maCurrent === true;
  const breadthAvailable = hasDecisionEvidence ? breadth200 != null : input.breadthAvailable === true;

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
  const rawCompositeScore = availableWeight ? Math.round(weightedComponents.reduce((sum, row) => sum + (row.value == null ? 0 : row.value * row.weight), 0) / availableWeight) : null;
  const decisionCoverageThreshold = Number.isFinite(Number(input.decisionCoverageThreshold))
    ? Math.max(0, Math.min(100, Number(input.decisionCoverageThreshold)))
    : hasDecisionEvidence ? 80 : 0;
  let compositeScore = hasDecisionEvidence && availableWeight < decisionCoverageThreshold ? null : rawCompositeScore;

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
    partial: availableWeight < 100,
    decisionBlocked: hasDecisionEvidence && total == null,
    decisionCoverageThreshold,
    rawCompositeScore,
    componentEvidence: hasDecisionEvidence ? Object.freeze({ ...input.decisionEvidence }) : null
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
  const presentation = deriveTradingScoreDecisionPresentation({ score, inputVersion });
  if (total == null) {
    return Object.freeze({
      modelVersion: SIGNAL_DECISION_MODEL_VERSION,
      inputVersion,
      status: 'blocked',
      action: 'WAIT',
      score: null,
      reasons: missing.length ? ['required-input-missing', ...missing.map((key) => `missing:${key}`)] : ['required-input-missing'],
      presentation
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
    reasons,
    presentation
  });
}

/**
 * The visible signal hero uses a five-tier Korean explanation while the
 * machine-facing envelope above intentionally stays at the coarser
 * WATCH/WAIT/REDUCE action level. Keeping that distinction explicit prevents
 * the legacy wording from becoming a second scoring implementation.
 */
export function deriveTradingScoreDecisionPresentation({ score = {}, inputVersion = 'unknown' } = {}) {
  const total = finiteNumber(score?.total ?? score?.score);
  const missing = Array.isArray(score?.componentMissing) ? score.componentMissing.slice() : [];
  const reasons = missing.map((key) => `missing:${key}`);
  if (total == null) {
    return Object.freeze({
      modelVersion: SIGNAL_PRESENTATION_MODEL_VERSION,
      inputVersion,
      status: 'blocked',
      tier: 'blocked',
      action: 'WAIT',
      score: null,
      displayScore: '—',
      decision: '판정 보류 — 필수 입력 미수신',
      description: `필수 구성요소(${missing.join(', ') || '시장 환경'})가 없어 현재 판단을 산출하지 않습니다.`,
      reasons: ['required-input-missing', ...reasons]
    });
  }

  const partial = score?.partial === true;
  if (partial) {
    return Object.freeze({
      modelVersion: SIGNAL_PRESENTATION_MODEL_VERSION,
      inputVersion,
      status: 'partial',
      tier: 'partial',
      action: 'WAIT',
      score: total,
      displayScore: `${total}*`,
      decision: '판정 보류 — 부분 데이터 점수',
      description: `미수신 구성요소(${missing.join(', ') || '일부 입력'})를 제외한 부분 점수입니다. 현재 진입 판단에는 사용하지 않습니다.`,
      reasons: ['partial-inputs', ...reasons]
    });
  }

  const bands = total >= 75
    ? {
        tier: 'favorable', action: 'WATCH', decision: '환경 우호 — 종목별 근거 별도 확인',
        description: '현재 시장 입력 조합이 우호적입니다. 점수는 예측 신호가 아니며 종목별 거래량·손익비·무효화 가격을 별도로 확인하세요.'
      }
    : total >= 60
      ? {
          tier: 'constructive', action: 'WATCH', decision: '환경 양호 — 단독 진입 신호 아님',
          description: '현재 시장 여건은 양호합니다. 점수는 예측 신호가 아니므로 점수 단독으로 진입하지 말고 종목·거래량·손익비를 확인하세요.'
        }
      : total >= 45
        ? {
            tier: 'neutral', action: 'WAIT', decision: '중립 — 관망 우선',
            description: '시장 신호가 혼재된 환경입니다. 점수는 예측 신호가 아니므로 진입·비중 결정은 종목별 근거와 본인 리스크 한도로 판단하세요.'
          }
        : total >= 30
          ? {
              tier: 'caution', action: 'REDUCE', decision: '주의 — 비중 축소 검토',
              description: '리스크 증가. 기존 포지션의 방어선, 현금 비중, 헤지 조건을 점검하세요.'
            }
          : {
              tier: 'defensive', action: 'REDUCE', decision: '위험 — 방어 우선',
              description: '극단 리스크. 신규 진입을 중단하고 현금·헤지·VIX 추적을 우선하세요.'
            };

  return Object.freeze({
    modelVersion: SIGNAL_PRESENTATION_MODEL_VERSION,
    inputVersion,
    status: 'current',
    ...bands,
    score: total,
    displayScore: String(total),
    reasons: [`trading-score-tier:${bands.tier}`]
  });
}
