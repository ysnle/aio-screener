// P1258 — 위험 입력 조립(구성 스냅샷·returnsMap·estimate 호출)의 단일 소유자.
// 이전에는 js/aio-workspace.js의 셸이 이 조립(~60줄)을 직접 수행해 도메인 계약과 셸 DOM이
// 한 함수에 섞여 있었다(P1195/P1199 선례의 분해 잔여). 여기는 순수 계산만 소유하고,
// DOM 문구·렌더는 셸이 남는다. 입력 자격 판정(공통 거래일·현재 시세·평가액)도 같은 계약에서
// 수행해, 보류 사유를 코드로 돌려주고 셸이 사유별 문구를 고른다.
import { createCompositionSnapshot, deriveRiskEstimate } from '../../domain/portfolio/risk.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function assembleRiskEstimateInput({
  positions,
  priceEvidenceMap,
  historyMap,
  validTickers,
  commonDates,
  cashValue,
  declarations,
  nowIso
}) {
  const dates = Array.isArray(commonDates) ? commonDates : [];
  if (dates.length < 6) {
    return { ok: false, code: 'common-dates-insufficient' };
  }

  // Cost is historical context, never a current-value fallback. Require a
  // timestamped decision-authorized quote for each live portfolio weight.
  const currentValueMap = {};
  const missingCurrent = [];
  (Array.isArray(positions) ? positions : []).forEach((p) => {
    const evidence = priceEvidenceMap ? priceEvidenceMap[p.ticker] : null;
    const price = evidence && evidence.allowedUse === true ? finite(evidence.value) : null;
    if (price == null || price <= 0) missingCurrent.push(p.ticker);
    else currentValueMap[p.ticker] = price * Number(p.qty);
  });
  if (missingCurrent.length) {
    return { ok: false, code: 'missing-current', tickers: missingCurrent };
  }
  const totalCurrentValue = (Array.isArray(positions) ? positions : []).reduce((s, p) => s + (currentValueMap[p.ticker] || 0), 0);
  if (!(totalCurrentValue > 0)) {
    return { ok: false, code: 'no-current-value' };
  }

  const minLen = dates.length - 1;
  const returnsMap = {};
  (Array.isArray(validTickers) ? validTickers : []).forEach((t) => {
    const values = dates.map((day) => historyMap[t][day]);
    returnsMap[t] = values.slice(1).map((value, idx) => (value / values[idx]) - 1);
  });

  // 22:PFR02/PFR09/PFR10 (E4): publish a DECLARED risk path instead of an
  // implied one. Weights are frozen into one immutable composition snapshot;
  // cash is declared or held (never dropped into a stock-only denominator and
  // then called "account risk"); the estimate carries exposure path, rebalance
  // policy, denominator, RF state and sample facts for the renderer.
  // E3/E4/P1188: 선언된 계좌·현금 통화와 현금 수익률·RF만 쓴다. 현금 통화가 없거나 기준 통화와
  // 다르면 계좌 전체 분모를 만들 수 없으므로 주식 부분만 게시하고 계좌 뷰는 보류한다.
  const decl = declarations || {};
  const cashAmount = Math.max(0, Number(cashValue) || 0);
  const cashDeclarable = cashAmount === 0
    || (decl.cashCurrency != null && decl.baseCurrency != null && decl.cashCurrency === decl.baseCurrency);
  const snapshot = createCompositionSnapshot({
    members: (Array.isArray(positions) ? positions : []).map((p) => {
      const ev = priceEvidenceMap ? priceEvidenceMap[p.ticker] : null;
      return {
        ticker: p.ticker,
        qty: Number(p.qty),
        price: ev ? finite(ev.value) : null,
        priceObservedAt: ev && ev.ts != null ? new Date(ev.ts).toISOString() : null,
        priceSource: ev && ev.source != null ? String(ev.source) : null
      };
    }),
    cash: { amount: cashAmount, currency: decl.cashCurrency },
    asOf: nowIso || new Date().toISOString(),
    weightBasis: cashDeclarable ? 'whole_account' : 'invested_sleeve',
    baseCurrency: decl.baseCurrency
  });

  // E4/P1193: 측정 경로와 리밸런싱 정책도 선언 입력이다. 전략 경로는 포지션이 선언한 목표비중
  // (폼 단위 %)이 합 100%일 때만 성립하고, 아니면 엔진이 `strategy-target-weights-invalid`로 보류한다.
  // P1198: 선언된 정책만 넘긴다 — 셸이 'daily'를 지어내면 미선언이 선언으로 게시된다(ledger P1198).
  const exposurePath = decl.exposurePath || 'current_composition_retrospective';
  const rebalancePolicy = decl.rebalancePolicy;
  let strategyTargetWeights;
  if (exposurePath === 'fixed_target_weight_strategy') {
    let declaredWeightSum = 0;
    let weightComplete = positions.length > 0;
    strategyTargetWeights = {};
    positions.forEach((p) => {
      const declaredWeight = Number(p.targetWeight);
      if (!isFinite(declaredWeight) || declaredWeight < 0) { weightComplete = false; return; }
      strategyTargetWeights[p.ticker] = declaredWeight / 100;
      declaredWeightSum += declaredWeight;
    });
    // P1200: 합이 100% 미만이면 나머지는 현금 목표비중이다(계좌 범위 선언). 100% 초과만 무효다.
    if (!weightComplete || declaredWeightSum > 100 + 1e-6) strategyTargetWeights = {};
  }

  const estimate = snapshot ? deriveRiskEstimate({
    snapshot,
    returnsMap,
    cashReturn: decl.cashReturn != null ? { mode: 'explicit_assumption', annualRate: decl.cashReturn } : { mode: 'unresolved' },
    rfAnnual: decl.riskFreeRate,
    exposureHistoryMode: exposurePath,
    rebalancePolicy,
    targetWeights: strategyTargetWeights,
    sampleDates: dates.slice(1)
  }) : null;

  return {
    ok: true,
    returnsMap,
    snapshot,
    estimate,
    minLen,
    strategyTargetWeights,
    exposurePath,
    rebalancePolicy
  };
}
