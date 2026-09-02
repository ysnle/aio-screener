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

export function concentrationPenaltyForWeight(weightPct) {
  const weight = finite(weightPct);
  if (weight == null || weight < 0) return 0;
  return weight >= 25 ? 18 : weight >= 15 ? 10 : weight >= 10 ? 5 : 0;
}

function positionValue(position) {
  const explicit = finite(position?.value);
  if (explicit != null && explicit >= 0) return explicit;
  const qty = Math.max(0, finite(position?.qty) ?? finite(position?.shares) ?? 0);
  const price = Math.max(0, finite(position?.price) ?? finite(position?.currentPrice) ?? finite(position?.cost) ?? finite(position?.avgCost) ?? 0);
  return qty * price;
}

/**
 * @param {object} input
 * @param {Array<object>} input.positions  holdings, each optionally {ticker, qty|shares, price|
 *   currentPrice|cost|avgCost, value, weightPct} — weightPct is used only as a fallback when
 *   totalValue resolves to <= 0 for that position (matches legacy).
 * @param {number|null} input.totalValue   explicit override; falls back to summing positions
 * @param {string} input.inputVersion
 */
export function deriveConcentrationRisk({ positions = [], totalValue = null, inputVersion = 'unknown' } = {}) {
  const list = Array.isArray(positions) ? positions : [];
  if (!list.length) {
    return Object.freeze({ modelVersion: PORTFOLIO_CONCENTRATION_MODEL_VERSION, inputVersion, status: 'unavailable', holdingCount: 0, totalValue: 0, topWeightPct: 0, items: Object.freeze([]) });
  }
  const explicitTotal = finite(totalValue);
  const total = explicitTotal && explicitTotal > 0 ? explicitTotal : list.reduce((sum, position) => sum + positionValue(position), 0);
  const items = list.map((position) => {
    const value = positionValue(position);
    const fallbackWeight = finite(position?.weightPct);
    const weightPct = total > 0 ? (value / total) * 100 : (fallbackWeight != null && fallbackWeight >= 0 ? fallbackWeight : 0);
    return Object.freeze({ ticker: String(position?.ticker || position?.symbol || '').toUpperCase(), weightPct, concentrationPenalty: concentrationPenaltyForWeight(weightPct) });
  });
  const topWeightPct = items.length ? Math.max(...items.map((item) => item.weightPct)) : 0;
  return Object.freeze({
    modelVersion: PORTFOLIO_CONCENTRATION_MODEL_VERSION,
    inputVersion,
    status: 'current',
    holdingCount: items.length,
    totalValue: total,
    topWeightPct,
    topWeightConcentrationPenalty: concentrationPenaltyForWeight(topWeightPct),
    items: Object.freeze(items)
  });
}
