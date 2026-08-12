import { stableHash } from '../../data/contracts/screener.js';

export const PIT_VALIDATION_VERSION = 'pit-validation.v1';

function dateMs(value) { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : NaN; }

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
  if (Number.isFinite(fromMs) && Number.isFinite(asOfMs) && asOfMs < fromMs) errors.push('before_valid_from');
  if (Number.isFinite(toMs) && Number.isFinite(asOfMs) && asOfMs > toMs) errors.push('after_valid_to');
  if (Number.isFinite(dateMs(delistedAt)) && asOfMs >= dateMs(delistedAt)) errors.push('delisted_in_universe');
  if (Number.isFinite(dateMs(corporateActionAt)) && dateMs(corporateActionAt) > asOfMs) errors.push('future_corporate_action');
  if (currentUniverse) errors.push('present_day_universe_not_pit');
  if (turnover == null) errors.push('turnover_missing');
  if (liquidity == null) errors.push('liquidity_missing');
  if (costBps == null) errors.push('transaction_cost_missing');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}

export function validatePITRun({ universe = [], observations = [], asOf, benchmark = null, costs = null, liquidity = null, liveDefinitionHash = null, backtestDefinitionHash = null } = {}) {
  const errors = [];
  const universeResults = (Array.isArray(universe) ? universe : []).map((row) => validatePITObservation({ ...row, asOf }));
  universeResults.forEach((result) => { if (!result.ok) errors.push(...result.errors); });
  if (!Array.isArray(observations) || !observations.length) errors.push('pit_observations_missing');
  if (!benchmark) errors.push('benchmark_missing');
  if (costs == null) errors.push('costs_missing');
  if (liquidity == null) errors.push('liquidity_capacity_missing');
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
  return Object.freeze({ promoted: blockers.length === 0, blockers, allowedUse: 'research-relative-ranking-only', reason: blockers.length ? '승격 조건 미충족' : '승격 검토 가능; 자동 운영 가중치 변경은 별도 승인 필요' });
}
