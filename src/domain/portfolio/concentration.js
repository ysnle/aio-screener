// RM-03 continued (2026-07-21, P758): extracted from js/aio-core.js's calcPortfolioTechnicalRisk
// (~19628-19647) and calcPositionTechnicalRisk (~19608-19626) — CONCENTRATION SLICE ONLY (per-
// position weightPct, the concentrationPenalty tier ladder, and topWeightPct). Deliberately does
// NOT extract calcSellPressure/calcTechnicalSnapshot (the much larger technical/OHLCV-driven half
// of heatScore) — that's a separate, materially bigger extraction. Superseded toy: the retired
// derivePortfolioRisk (src/domain/portfolio/risk.js) had zero real callers and used an invented
// 20%/40% concentration band unrelated to legacy's actual 10%/15%/25% penalty tiers; this uses the
// real tiers and legacy's own field names (weightPct/concentrationPenalty/topWeightPct) instead of
// renaming them into something that only looked cleaner.
//
// v2 closes a legacy extraction defect: the inferred portfolio total and each holding weight use
// one position-value formula. The old split formula could produce weights above 100% for valid
// `{shares,currentPrice}` holdings.
export const PORTFOLIO_CONCENTRATION_MODEL_VERSION = 'portfolio-concentration.v2';

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// P1252 (CON-03): 숫자 필드 해석 — 누락(missing)과 음수/비수 입력(invalid)을 구분한다.
// 종전에는 음수를 0으로 눌러 실제 0 비중과 구분할 수 없었다.
function numericField(value) {
  if (value == null || value === '') return { state: 'missing', value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) return { state: 'invalid', value: null };
  return { state: 'ok', value: n };
}

function firstField(position, keys) {
  for (const key of keys) {
    const raw = position?.[key];
    if (raw != null && raw !== '') return { key, parsed: numericField(raw) };
  }
  return { key: null, parsed: { state: 'missing', value: null } };
}

export function concentrationPenaltyForWeight(weightPct) {
  const weight = finite(weightPct);
  if (weight == null || weight < 0) return 0;
  return weight >= 25 ? 18 : weight >= 15 ? 10 : weight >= 10 ? 5 : 0;
}

// P1252 (CON-01/CON-03): 레거시 계약(js/aio-core.js ~21450: "Cost basis는 역사적 맥락일 뿐,
// 시세/노출/분모를 대신할 수 없다")을 따른다. 시장가치는 시세(price/currentPrice) 또는 명시
// value만 선행한다 — cost/avgCost 폴백은 원가를 시장가 분모에 섞어 가격이 없는 포지션을 값으로
// 눕혔다. 그런 포지션은 data-insufficient로 보류하고, 음수/비수 입력은 0으로 눌리지 않고
// invalid-input으로 분리한다(합법적 0과 구분).
function resolvePositionValue(position) {
  const explicit = numericField(position?.value);
  if (explicit.state === 'invalid') return { state: 'invalid-input', reason: 'non-numeric-value', value: null };
  if (explicit.state === 'ok' && explicit.value < 0) return { state: 'invalid-input', reason: 'negative-value', value: null };
  if (explicit.state === 'ok') return { state: 'ok', reason: null, value: explicit.value };

  const qtyField = firstField(position, ['qty', 'shares']);
  if (qtyField.parsed.state === 'invalid') return { state: 'invalid-input', reason: `non-numeric-${qtyField.key}`, value: null };
  if (qtyField.parsed.state === 'ok' && qtyField.parsed.value < 0) return { state: 'invalid-input', reason: `negative-${qtyField.key}`, value: null };
  const qty = qtyField.parsed.state === 'ok' ? qtyField.parsed.value : 0;

  const priceField = firstField(position, ['price', 'currentPrice']);
  if (priceField.parsed.state === 'invalid') return { state: 'invalid-input', reason: `non-numeric-${priceField.key}`, value: null };
  if (priceField.parsed.state === 'ok' && priceField.parsed.value < 0) return { state: 'invalid-input', reason: `negative-${priceField.key}`, value: null };
  // P1252 (CON-01): 시세가 없으면 cost/avgCost로 대신하지 않는다 — 보류가 정답이다.
  if (priceField.parsed.state === 'missing') return { state: 'data-insufficient', reason: 'market-price-unavailable', value: null };
  return { state: 'ok', reason: null, value: qty * priceField.parsed.value };
}

/**
 * @param {object} input
 * @param {Array<object>} input.positions  holdings, each optionally {ticker, qty|shares, price|
 *   currentPrice, value, weightPct} — cost/avgCost는 시장가치로 쓰이지 않는다(P1252/CON-01).
 *   weightPct is used only as a fallback when
 *   totalValue resolves to <= 0 for that position (matches legacy).
 * @param {number|null} input.totalValue   explicit override; falls back to summing positions
 * @param {string} input.inputVersion
 */
export function deriveConcentrationRisk({ positions = [], totalValue = null, inputVersion = 'unknown' } = {}) {
  const list = Array.isArray(positions) ? positions : [];
  if (!list.length) {
    return Object.freeze({
      modelVersion: PORTFOLIO_CONCENTRATION_MODEL_VERSION, inputVersion, status: 'unavailable', holdingCount: 0, totalValue: 0, topWeightPct: 0,
      // P1252 (CON-02): 분모는 포지션 합만 — 현금은 모델링하지 않는다.
      weightBasis: 'invested-sleeve-positions-only', denominator: 'sum-of-position-values',
      issues: Object.freeze([]), heldItems: Object.freeze([]), items: Object.freeze([])
    });
  }
  const explicitTotal = finite(totalValue);
  const resolved = list.map((position) => ({ position, resolution: resolvePositionValue(position) }));
  // P1252 (CON-01/CON-03): 계산에서 제외된 항목은 조용히 지우지 않고 명시적 보류 목록으로 남긴다.
  const heldItems = resolved
    .filter((entry) => entry.resolution.state !== 'ok')
    .map((entry) => Object.freeze({
      ticker: String(entry.position?.ticker || entry.position?.symbol || '').toUpperCase(),
      status: entry.resolution.state,
      reason: entry.resolution.reason
    }));
  // P1252 (CON-01): 분모는 시장가치로 평가된 포지션만 더한다 — 비어 있는 값 대신 보류가 분모에
  // 참여하지 않는다. 명시 totalValue가 있으면 그게 분모다.
  const total = explicitTotal && explicitTotal > 0
    ? explicitTotal
    : resolved.reduce((sum, entry) => sum + (entry.resolution.state === 'ok' ? entry.resolution.value : 0), 0);
  const items = resolved.map(({ position, resolution }) => {
    const ticker = String(position?.ticker || position?.symbol || '').toUpperCase();
    if (resolution.state !== 'ok') {
      // P1252 (CON-01/CON-03): 벌점 계산에서 제외 — 가중치·벌점을 0으로 발행하지 않는다
      // (0은 합법적 0 비중과 다른 뜻이다).
      return Object.freeze({ ticker, weightPct: null, concentrationPenalty: 0, status: resolution.state, reason: resolution.reason });
    }
    const fallbackWeight = finite(position?.weightPct);
    const weightPct = total > 0 ? (resolution.value / total) * 100 : (fallbackWeight != null && fallbackWeight >= 0 ? fallbackWeight : 0);
    return Object.freeze({ ticker, weightPct, concentrationPenalty: concentrationPenaltyForWeight(weightPct), status: 'ok', reason: null });
  });
  const scored = items.filter((item) => item.status === 'ok');
  const topWeightPct = scored.length ? Math.max(...scored.map((item) => item.weightPct)) : 0;
  // P1252 (CON-04): 비중 합이 100을 의미 있게 넘으면 분모 불일치로 표시한다(정규화하지 않는다).
  const weightPctSum = items.reduce((sum, item) => sum + (item.weightPct != null ? item.weightPct : 0), 0);
  const issues = weightPctSum > 100.5 ? ['denominator-mismatch'] : [];
  return Object.freeze({
    modelVersion: PORTFOLIO_CONCENTRATION_MODEL_VERSION,
    inputVersion,
    status: 'current',
    holdingCount: items.length,
    totalValue: total,
    // P1252 (CON-02): 분모 계약 명시 — 포지션 가치 합만 쓰고(현금은 이 모델에 없음), 명시
    // totalValue가 있으면 그 출처를 이름으로 발행한다.
    weightBasis: 'invested-sleeve-positions-only',
    denominator: explicitTotal && explicitTotal > 0 ? 'explicit-total-value' : 'sum-of-position-values',
    issues: Object.freeze(issues),
    topWeightPct,
    topWeightConcentrationPenalty: concentrationPenaltyForWeight(topWeightPct),
    heldItems: Object.freeze(heldItems),
    items: Object.freeze(items)
  });
}
