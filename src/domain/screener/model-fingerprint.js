import { FACTOR_RANKS_MODEL_VERSION } from './factor-ranks.js';
import { FACTOR_WEIGHTS_MODEL_VERSION, MODEL_DEFAULT_WEIGHTS } from './factor-weights.js';
import { PRICE_FACTOR_MIN_CLOSES } from './price-factors.js';

// The backtest validates this 4-factor subset of the live model (size/value/quality are
// documented exclusions — no point-in-time data; see fetch-data.mjs EXCLUDED_FACTORS_REASON).
export const BACKTEST_ACTIVE_FACTORS = Object.freeze(['momentum', 'trend', 'lowvol', 'kalman']);
export const BACKTEST_EXCLUDED_FACTOR_REASONS = Object.freeze({
  size: 'no-historical-shares-outstanding',
  value: 'no-point-in-time-fundamentals',
  quality: 'no-point-in-time-fundamentals'
});
export const BACKTEST_FWD_DAYS = 21;
// Sessions of close history the active factors read before a rebalance: the longest of their windows
// (price-factors.js PRICE_FACTOR_MIN_CLOSES — 12-1 momentum reads the close 252 sessions back).
export const BACKTEST_FACTOR_LOOKBACK_SESSIONS = Math.max(...BACKTEST_ACTIVE_FACTORS.map((factor) => PRICE_FACTOR_MIN_CLOSES[factor])) - 1;
// Completed sessions in the producer's 2-year factor history (screener.mjs FACTOR_HISTORY_RANGE '2y'; the published
// backtest calendar holds 500 dates).
export const BACKTEST_HISTORY_SESSIONS = 500;

/**
 * Rebalance offsets (sessions before the last calendar date, oldest first): one every `fwdDays`, so the forward
 * windows do not overlap; the newest leaves a full forward window and the oldest leaves the full factor lookback.
 * A study with several holding lengths passes its longest as `newestOffset` and its rebalance spacing as `step`.
 */
export function deriveRebalanceOffsets({ historySessions = BACKTEST_HISTORY_SESSIONS, lookbackSessions = BACKTEST_FACTOR_LOOKBACK_SESSIONS, fwdDays = BACKTEST_FWD_DAYS, newestOffset = fwdDays, step = fwdDays } = {}) {
  const offsets = [];
  for (let offset = newestOffset; historySessions - 1 - offset >= lookbackSessions; offset += step) offsets.push(offset);
  return Object.freeze(offsets.reverse());
}
export const BACKTEST_REBALANCE_OFFSETS = deriveRebalanceOffsets();
// A symbol enters the production backtest with a close at the oldest rebalance date (offset sessions before the last).
export const BACKTEST_MIN_SERIES_CLOSES = BACKTEST_REBALANCE_OFFSETS[0] + 1;
export const BACKTEST_PRICE_BASIS = 'adjusted-close-required';
export const BACKTEST_TRANSACTION_COST_BPS = 20;
export const RANKING_POPULATION_POLICY = 'market-separated.v1';

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

/**
 * How much of a live weight vector the backtest re-ranks: the weighted factors it covers, the weighted factors it
 * leaves out, and the share of the live weight those left-out factors carry (0..1, null without positive weights).
 */
export function backtestFactorCoverage(weights = MODEL_DEFAULT_WEIGHTS, activeFactors = BACKTEST_ACTIVE_FACTORS) {
  const weighted = Object.entries(weights && typeof weights === 'object' ? weights : {})
    .map(([factor, value]) => [factor, Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  const total = weighted.reduce((sum, [, value]) => sum + value, 0);
  const covered = weighted.filter(([factor]) => activeFactors.includes(factor));
  const excluded = weighted.filter(([factor]) => !activeFactors.includes(factor));
  return Object.freeze({
    covered: covered.map(([factor]) => factor),
    excluded: excluded.map(([factor]) => factor),
    excludedShare: total > 0 ? excluded.reduce((sum, [, value]) => sum + value, 0) / total : null
  });
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
  transactionCostBps = BACKTEST_TRANSACTION_COST_BPS,
  populationPolicy = RANKING_POPULATION_POLICY
} = {}) {
  const appliedWeights = renormalizedWeightsOver(weights || MODEL_DEFAULT_WEIGHTS, activeFactors);
  if (!appliedWeights) return null;
  const components = {
    factorRanksModelVersion: ranksModelVersion,
    factorWeightsModelVersion: weightsModelVersion,
    appliedWeights,
    activeFactors: [...activeFactors],
    populationPolicy,
    priceBasis,
    rebalanceOffsets: [...rebalanceOffsets],
    fwdDays,
    transactionCostBps
  };
  return JSON.stringify(canonicalize(components));
}

export function buildRankingIdentity({ appliedFactorWeights = null, activeFactors = null, factorDefinitions = null } = {}) {
  const active = Array.isArray(activeFactors) ? [...activeFactors].map(String).sort() : [];
  if (!active.length || !appliedFactorWeights || typeof appliedFactorWeights !== 'object') return null;
  const applied = Object.fromEntries(active.map((factor) => [factor, Math.round((Number(appliedFactorWeights[factor]) || 0) * 10000) / 10000]));
  const definitions = factorDefinitions && typeof factorDefinitions === 'object' && Object.keys(factorDefinitions).length ? { factorDefinitions } : {};
  return JSON.stringify(canonicalize({ factorRanksModelVersion: FACTOR_RANKS_MODEL_VERSION, factorWeightsModelVersion: FACTOR_WEIGHTS_MODEL_VERSION, populationPolicy: RANKING_POPULATION_POLICY, activeFactors: active, appliedWeights: applied, ...definitions }));
}

export function buildPopulationRankingIdentity(ranking = null) {
  const byMarket = ranking?.byMarket && typeof ranking.byMarket === 'object' ? ranking.byMarket : null;
  const markets = byMarket ? Object.keys(byMarket).filter((market) => byMarket[market]?.available !== false).sort() : [];
  const identityOf = (result) => buildRankingIdentity({ appliedFactorWeights: result?.appliedFactorWeights, activeFactors: result?.activeFactors, factorDefinitions: result?.factorDefinitions });
  if (markets.length <= 1) return identityOf(markets.length ? byMarket[markets[0]] : ranking);
  const parts = Object.fromEntries(markets.map((market) => [market, identityOf(byMarket[market])]).filter(([, identity]) => identity));
  return Object.keys(parts).length ? JSON.stringify(canonicalize({ byMarket: parts })) : null;
}

export function liveScreenerModelFingerprint(weights = null) {
  const live = weights && typeof weights === 'object' && Object.keys(weights).length ? weights : null;
  return buildScreenerModelFingerprint({ weights: live });
}
