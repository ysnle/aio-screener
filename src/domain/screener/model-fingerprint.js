// P1449 (P1443 follow-up): a validation claim is about THIS model. The stored backtest artifact
// must therefore carry the identity of the model that produced it — rank model version, weight
// model version, applied (renormalized) weights vector, active factors, price basis, rebalance
// offsets, hold horizon and the modelled cost — and the UI may only say "지금 순위의 과거 검증"
// when that identity matches the live model. Before this, two hand-written weight sets drifted
// (37.0/27.4/21.9/13.7 vs 39.0/28.0/22.0/11.0 renormalized) while both artefacts claimed
// "one model" (P584/C1), and the prose-only modelParity fields could be (and were) mis-read.
// Pure module usable in both the producer (node) and the browser runtime.
import { FACTOR_RANKS_MODEL_VERSION } from './factor-ranks.js';
import { FACTOR_WEIGHTS_MODEL_VERSION, MODEL_DEFAULT_WEIGHTS } from './factor-weights.js';

// The backtest validates this 4-factor subset of the live model (size/value/quality are
// documented exclusions — no point-in-time data; see fetch-data.mjs EXCLUDED_FACTORS_REASON).
export const BACKTEST_ACTIVE_FACTORS = Object.freeze(['momentum', 'trend', 'lowvol', 'kalman']);
export const BACKTEST_REBALANCE_OFFSETS = Object.freeze([147, 126, 105, 84, 63, 42]);
export const BACKTEST_FWD_DAYS = 21;
export const BACKTEST_PRICE_BASIS = 'adjusted-close-required';
export const BACKTEST_TRANSACTION_COST_BPS = 20;

export function renormalizedWeightsOver(weights = MODEL_DEFAULT_WEIGHTS, activeFactors = BACKTEST_ACTIVE_FACTORS) {
  const vector = {};
  let total = 0;
  for (const factor of activeFactors) {
    const value = Number(weights?.[factor]);
    vector[factor] = Number.isFinite(value) && value > 0 ? value : 0;
    total += vector[factor];
  }
  if (!(total > 0)) return null;
  // Identity documentation, not float-exact application: 4-decimal rounding intentionally
  // summarizes the applied renormalized vector (rank math itself uses full precision).
  return Object.freeze(Object.fromEntries(activeFactors.map((factor) => {
    const value = Number(weights?.[factor]);
    return [factor, Math.round((Number.isFinite(value) && value > 0 ? value : 0) / total * 10000) / 10000];
  })));
}

// Canonical, key-sorted JSON string of the model identity — stored in the artifact
// (modelFingerprint) and rebuilt by the UI from its own live model for comparison.
// Keys are sorted with a recursive function replacer: an ARRAY replacer would silently
// drop every nested-object key not listed at the top level.
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, inner]) => [key, canonicalize(inner)]));
  }
  return value;
};

export function buildScreenerModelFingerprint({
  ranksModelVersion = FACTOR_RANKS_MODEL_VERSION,
  weightsModelVersion = FACTOR_WEIGHTS_MODEL_VERSION,
  weights = null,
  activeFactors = BACKTEST_ACTIVE_FACTORS,
  priceBasis = BACKTEST_PRICE_BASIS,
  rebalanceOffsets = BACKTEST_REBALANCE_OFFSETS,
  fwdDays = BACKTEST_FWD_DAYS,
  transactionCostBps = BACKTEST_TRANSACTION_COST_BPS
} = {}) {
  const appliedWeights = renormalizedWeightsOver(weights || MODEL_DEFAULT_WEIGHTS, activeFactors);
  if (!appliedWeights) return null;
  const components = {
    factorRanksModelVersion: ranksModelVersion,
    factorWeightsModelVersion: weightsModelVersion,
    appliedWeights,
    activeFactors: [...activeFactors],
    priceBasis,
    rebalanceOffsets: [...rebalanceOffsets],
    fwdDays,
    transactionCostBps
  };
  return JSON.stringify(canonicalize(components));
}

// Live runtime model identity. The UI compares this with the artifact's stored fingerprint;
// a mismatch means the stored rows were produced by a different model and must read as
// disclosure, not validation.
export function liveScreenerModelFingerprint() {
  return buildScreenerModelFingerprint();
}
