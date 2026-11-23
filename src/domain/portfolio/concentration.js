import { readNumber as finite } from '../shared/number.js';
import { RULES } from '../rules/thresholds.js';
export const PORTFOLIO_CONCENTRATION_MODEL_VERSION = 'portfolio-concentration.v2';

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

// The tiers are RULES.portfolio (the lines every portfolio screen states); the points each tier adds to the legacy heat
// score are this model's own weights. The band words live in concentration-bands.js.
const TIERS = RULES.portfolio.holdingPct;
const PENALTY = [5, 10, 18];

export function concentrationPenaltyForWeight(weightPct) {
  const weight = finite(weightPct);
  if (weight == null || weight < 0) return 0;
  // The penalty of the highest tier reached (index -1, below the first tier, reads 0).
  return PENALTY[TIERS.filter((line) => weight >= line).length - 1] || 0;
}

function declaresNonDecisionQuote(position) {
  const kind = position?.quoteSourceKind ?? position?.priceSource;
  const allowed = position?.currentQuoteAllowedUse ?? position?.allowedUse;
  const kindDeclared = kind != null && kind !== '';
  const allowedDeclared = allowed != null && allowed !== '';
  return (kindDeclared && kind !== 'live-quote') || (allowedDeclared && allowed !== true && allowed !== 'decision');
}

function resolvePositionValue(position) {
  if (declaresNonDecisionQuote(position)) return { state: 'data-insufficient', reason: 'quote-not-decision-grade', value: null };
  const explicit = numericField(position?.value);
  if (explicit.state === 'invalid') return { state: 'invalid-input', reason: 'non-numeric-value', value: null };
  if (explicit.state === 'ok' && explicit.value < 0) return { state: 'invalid-input', reason: 'negative-value', value: null };
  if (explicit.state === 'ok') return { state: 'ok', reason: null, value: explicit.value };

  const qtyField = firstField(position, ['qty', 'shares']);
  if (qtyField.parsed.state === 'invalid') return { state: 'invalid-input', reason: `non-numeric-${qtyField.key}`, value: null };
  if (qtyField.parsed.state === 'ok' && qtyField.parsed.value < 0) return { state: 'invalid-input', reason: `negative-${qtyField.key}`, value: null };
  if (qtyField.parsed.state === 'missing') return { state: 'data-insufficient', reason: 'quantity-unavailable', value: null };
  const qty = qtyField.parsed.value;

  const priceField = firstField(position, ['price', 'currentPrice']);
  if (priceField.parsed.state === 'invalid') return { state: 'invalid-input', reason: `non-numeric-${priceField.key}`, value: null };
  if (priceField.parsed.state === 'ok' && priceField.parsed.value < 0) return { state: 'invalid-input', reason: `negative-${priceField.key}`, value: null };
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
      weightBasis: 'invested-sleeve-positions-only', denominator: 'sum-of-position-values',
      issues: Object.freeze([]), heldItems: Object.freeze([]), items: Object.freeze([])
    });
  }
  const explicitTotal = finite(totalValue);
  const resolved = list.map((position) => ({ position, resolution: resolvePositionValue(position) }));
  const heldItems = resolved
    .filter((entry) => entry.resolution.state !== 'ok')
    .map((entry) => Object.freeze({
      ticker: String(entry.position?.ticker || entry.position?.symbol || '').toUpperCase(),
      status: entry.resolution.state,
      reason: entry.resolution.reason
    }));
  const total = explicitTotal && explicitTotal > 0
    ? explicitTotal
    : resolved.reduce((sum, entry) => sum + (entry.resolution.state === 'ok' ? entry.resolution.value : 0), 0);
  const items = resolved.map(({ position, resolution }) => {
    const ticker = String(position?.ticker || position?.symbol || '').toUpperCase();
    if (resolution.state !== 'ok') {
      return Object.freeze({ ticker, weightPct: null, concentrationPenalty: 0, status: resolution.state, reason: resolution.reason });
    }
    const fallbackWeight = finite(position?.weightPct);
    const weightPct = total > 0 ? (resolution.value / total) * 100 : (fallbackWeight != null && fallbackWeight >= 0 ? fallbackWeight : 0);
    return Object.freeze({ ticker, weightPct, concentrationPenalty: concentrationPenaltyForWeight(weightPct), status: 'ok', reason: null });
  });
  const scored = items.filter((item) => item.status === 'ok');
  const topWeightPct = scored.length ? Math.max(...scored.map((item) => item.weightPct)) : 0;
  const weightPctSum = items.reduce((sum, item) => sum + (item.weightPct != null ? item.weightPct : 0), 0);
  const issues = weightPctSum > 100.5 ? ['denominator-mismatch'] : [];
  const denominatorExcludesHeld = heldItems.length > 0 && !(explicitTotal && explicitTotal > 0);
  if (denominatorExcludesHeld) issues.push('held-positions-excluded-from-denominator');
  return Object.freeze({
    modelVersion: PORTFOLIO_CONCENTRATION_MODEL_VERSION,
    inputVersion,
    status: denominatorExcludesHeld ? 'partial' : 'current',
    holdingCount: items.length,
    totalValue: total,
    weightBasis: denominatorExcludesHeld ? 'priced-positions-only' : 'invested-sleeve-positions-only',
    denominator: explicitTotal && explicitTotal > 0 ? 'explicit-total-value' : 'sum-of-position-values',
    issues: Object.freeze(issues),
    topWeightPct,
    topWeightConcentrationPenalty: concentrationPenaltyForWeight(topWeightPct),
    heldItems: Object.freeze(heldItems),
    items: Object.freeze(items)
  });
}
