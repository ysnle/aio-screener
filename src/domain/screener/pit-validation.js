import { stableHash } from '../../data/contracts/screener.js';

export const PIT_VALIDATION_VERSION = 'pit-validation.v1';

function dateMs(value) { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : NaN; }

function hasFiniteMeasure(value, objectKeys = []) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (!value || typeof value !== 'object') return false;
  return objectKeys.some((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0);
}

export function validatePITObservation({ asOf, effectiveAt, filedAt, availableAt, validFrom, validTo, delistedAt, corporateActionAt, turnover, liquidity, costBps, currentUniverse = false } = {}) {
  const errors = [];
  const asOfMs = dateMs(asOf);
  if (!Number.isFinite(asOfMs)) errors.push('as_of_missing');
  for (const [label, value] of [['effectiveAt', effectiveAt], ['filedAt', filedAt], ['availableAt', availableAt]]) {
    const ms = dateMs(value);
    if (value && !Number.isFinite(ms)) errors.push(`${label}_invalid`);
    if (Number.isFinite(asOfMs) && Number.isFinite(ms) && ms > asOfMs) errors.push(`future_${label}`);
  }
  const fromMs = dateMs(validFrom);
  const toMs = dateMs(validTo);
  const delistedMs = dateMs(delistedAt);
  const corporateActionMs = dateMs(corporateActionAt);
  if (validFrom && !Number.isFinite(fromMs)) errors.push('valid_from_invalid');
  if (validTo && !Number.isFinite(toMs)) errors.push('valid_to_invalid');
  if (delistedAt && !Number.isFinite(delistedMs)) errors.push('delisted_invalid');
  if (corporateActionAt && !Number.isFinite(corporateActionMs)) errors.push('corporate_action_invalid');
  if (Number.isFinite(fromMs) && Number.isFinite(asOfMs) && asOfMs < fromMs) errors.push('before_valid_from');
  if (Number.isFinite(toMs) && Number.isFinite(asOfMs) && asOfMs > toMs) errors.push('after_valid_to');
  if (Number.isFinite(delistedMs) && asOfMs >= delistedMs) errors.push('delisted_in_universe');
  if (Number.isFinite(corporateActionMs) && corporateActionMs > asOfMs) errors.push('future_corporate_action');
  if (currentUniverse) errors.push('present_day_universe_not_pit');
  if (turnover == null) errors.push('turnover_missing');
  else if (!hasFiniteMeasure(turnover, ['turnover', 'turnoverPct'])) errors.push('turnover_invalid');
  if (liquidity == null) errors.push('liquidity_missing');
  else if (!hasFiniteMeasure(liquidity, ['dollarVolume', 'dollarVolume30d', 'capacity', 'adv'])) errors.push('liquidity_invalid');
  if (costBps == null) errors.push('transaction_cost_missing');
  else if (!hasFiniteMeasure(costBps, ['costBps', 'bps', 'roundTripBps'])) errors.push('transaction_cost_invalid');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}

export function validatePITRun({ universe = [], observations = [], asOf, benchmark = null, costs = null, liquidity = null, liveDefinitionHash = null, backtestDefinitionHash = null } = {}) {
  const errors = [];
  if (!Array.isArray(universe) || !universe.length) errors.push('pit_universe_missing');
  const universeResults = (Array.isArray(universe) ? universe : []).map((row) => validatePITObservation({ ...row, asOf }));
  universeResults.forEach((result) => { if (!result.ok) errors.push(...result.errors); });
  if (!Array.isArray(observations) || !observations.length) errors.push('pit_observations_missing');
  if (Array.isArray(observations) && observations.some((observation) => !observation?.instrumentId || !Number.isFinite(dateMs(observation.observedAt)))) errors.push('pit_observation_shape_invalid');
  if (!benchmark) errors.push('benchmark_missing');
  else if (typeof benchmark === 'object' && !benchmark.symbol && !benchmark.instrumentId) errors.push('benchmark_identity_missing');
  if (costs == null) errors.push('costs_missing');
  else if (!hasFiniteMeasure(costs, ['costBps', 'bps', 'roundTripBps'])) errors.push('costs_invalid');
  if (liquidity == null) errors.push('liquidity_capacity_missing');
  else if (!hasFiniteMeasure(liquidity, ['dollarVolume', 'dollarVolume30d', 'capacity', 'adv'])) errors.push('liquidity_capacity_invalid');
  if (!liveDefinitionHash || !backtestDefinitionHash || liveDefinitionHash !== backtestDefinitionHash) errors.push('live_backtest_definition_mismatch');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)], checkedUniverse: universeResults.length, checkedObservations: Array.isArray(observations) ? observations.length : 0 });
}

export function createValidationGate(input = {}) {
  const checks = {
    pointInTimeUniverse: input.pointInTimeUniverse === true,
    delistingAndCorporateAction: input.delistingAndCorporateAction === true,
    filingAvailableDate: input.filingAvailableDate === true,
    turnoverModeled: input.turnoverModeled === true,
    transactionCostsModeled: input.transactionCostsModeled === true,
    liquidityCapacityModeled: input.liquidityCapacityModeled === true,
    liveBacktestParity: input.liveBacktestParity === true
  };
  const blockers = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return Object.freeze({ schemaVersion: PIT_VALIDATION_VERSION, gateId: String(input.gateId || 'G-SCR-PIT'), status: blockers.length ? 'BLOCKED' : 'READY_FOR_RESEARCH_PROMOTION_REVIEW', allowedUse: 'research-relative-ranking-only', checks: Object.freeze(checks), blockers: Object.freeze(blockers), reason: String(input.reason || (blockers.length ? 'PIT/cost/liquidity/live parity evidence is incomplete.' : 'All local validation evidence is present; promotion still requires review.')), evidenceArtifact: String(input.evidenceArtifact || 'public-data/screener-validation-gate.json'), observedAt: input.observedAt || null, gateHash: stableHash({ checks, blockers }) });
}

export function promotionDecision({ gate, regime, result } = {}) {
  const blockers = [];
  if (!gate || gate.status !== 'READY_FOR_RESEARCH_PROMOTION_REVIEW') blockers.push('pit_gate_blocked');
  if (!regime || regime.allowedUse !== 'reference-only' || regime.liveBacktestParity !== true) blockers.push('regime_not_promotable');
  if (!result?.run?.resultHash) blockers.push('screen_run_missing');
  const promotionReviewReady = blockers.length === 0;
  return Object.freeze({
    promoted: false,
    promotionReviewReady,
    autoWeightPromotion: false,
    blockers,
    allowedUse: 'research-relative-ranking-only',
    reason: blockers.length ? 'Promotion prerequisites are incomplete.' : 'Evidence is ready for human review; automatic regime-weight promotion remains disabled.'
  });
}
