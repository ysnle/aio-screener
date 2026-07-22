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
// Legacy quirk preserved as-is (do not "fix"): totalValue (when not given explicitly) is computed
// from `positions` via `value || qty*(price||cost)`, while each position's own value inside
// calcPositionTechnicalRisk uses a DIFFERENT fallback chain: `qty(or shares) * (price||currentPrice
// ||cost||avgCost)`. These two formulas can disagree for a position that only sets `shares`/
// `currentPrice` — that is genuinely how legacy behaves today, not a bug this extraction should
// silently paper over.
export const PORTFOLIO_CONCENTRATION_MODEL_VERSION = 'portfolio-concentration.v1';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function concentrationPenaltyForWeight(weightPct) {
  return weightPct >= 25 ? 18 : weightPct >= 15 ? 10 : weightPct >= 10 ? 5 : 0;
}

function positionValueForTotal(position) {
  const explicit = finite(position?.value);
  if (explicit) return explicit;
  const qty = finite(position?.qty) || 0;
  const price = finite(position?.price) || finite(position?.cost) || 0;
  return qty * price || 0;
}

function positionValueForWeight(position) {
  const qty = finite(position?.qty) || finite(position?.shares) || 0;
  const price = finite(position?.price) || finite(position?.currentPrice) || finite(position?.cost) || finite(position?.avgCost) || 0;
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
  const total = explicitTotal && explicitTotal > 0 ? explicitTotal : list.reduce((sum, position) => sum + positionValueForTotal(position), 0);
  const items = list.map((position) => {
    const value = positionValueForWeight(position);
    const weightPct = total > 0 ? (value / total) * 100 : (finite(position?.weightPct) || 0);
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
