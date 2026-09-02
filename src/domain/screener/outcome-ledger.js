import { OUTCOME_HORIZONS, createOutcomeObservation, stableHash, validateOutcomeObservation } from '../../data/contracts/screener.js';

export const OUTCOME_LEDGER_VERSION = 'outcome-ledger.v3';

const horizonDays = { 'T+1': 1, 'T+5': 5, 'T+21': 21, 'T+63': 63 };

export function createOutcomeLedger(initial = []) {
  const records = new Map();
  (Array.isArray(initial) ? initial : []).forEach((record) => {
    // v2 stored the cost-adjusted result under `rawReturn`. Reconstruct the
    // gross value when loading that legacy shape so persisted observations are
    // migrated instead of silently discarded.
    const legacyCost = typeof record?.costBps === 'number' && Number.isFinite(record.costBps) ? record.costBps : null;
    const migrated = record?.status === 'observed' && record?.netReturn == null && record?.costsApplied === true && legacyCost != null && typeof record?.rawReturn === 'number'
      ? { ...record, netReturn: record.rawReturn, rawReturn: record.rawReturn + legacyCost / 100 }
      : record;
    const canonical = createOutcomeObservation(migrated);
    if (validateOutcomeObservation(canonical).ok) records.set(canonical.outcomeId, canonical);
  });
  function record(input) {
    const outcome = createOutcomeObservation(input);
    const validation = validateOutcomeObservation(outcome);
    if (!validation.ok) return Object.freeze({ ok: false, errors: validation.errors, outcome });
    records.set(outcome.outcomeId, outcome);
    return Object.freeze({ ok: true, outcome });
  }
  function recordForRun(runId, observations = []) {
    const results = (Array.isArray(observations) ? observations : []).map((observation) => record({ ...observation, runId }));
    return Object.freeze({ runId, ok: results.every((result) => result.ok), records: Object.freeze(results.map((result) => result.outcome)) });
  }
  function list({ runId = null, instrumentId = null, horizon = null } = {}) {
    return Object.freeze([...records.values()].filter((record) => (!runId || record.runId === runId) && (!instrumentId || record.instrumentId === instrumentId) && (!horizon || record.horizon === horizon)));
  }
  function snapshot() { return Object.freeze({ schemaVersion: OUTCOME_LEDGER_VERSION, count: records.size, hash: stableHash([...records.values()]), records: list() }); }
  return Object.freeze({ record, recordForRun, list, snapshot });
}

export function calculateOutcome({ runId, instrumentId, entry, exit, benchmarkEntry = null, benchmarkExit = null, horizon = 'T+21', costBps = null, liquidityFlags = [] } = {}) {
  if (!OUTCOME_HORIZONS.includes(horizon)) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: ['invalid_horizon'] });
  const modeledCostBps = typeof costBps === 'number' ? costBps : NaN;
  if (!Number.isFinite(modeledCostBps) || modeledCostBps < 0) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'transaction_cost_missing'], costsApplied: false });
  const entryTime = Date.parse(entry?.observedAt || '');
  const exitTime = Date.parse(exit?.observedAt || '');
  if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime) || exitTime <= entryTime) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'observation_time_invalid'], costsApplied: false });
  const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  const entryValue = numeric(entry?.value);
  const exitValue = numeric(exit?.value);
  const benchmarkStart = numeric(benchmarkEntry?.value);
  const benchmarkEnd = numeric(benchmarkExit?.value);
  if (![entryValue, exitValue].every(Number.isFinite) || entryValue <= 0 || exitValue <= 0) return createOutcomeObservation({ runId, instrumentId, horizon, entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'price_missing'], costsApplied: false });
  const rawReturn = (exitValue / entryValue - 1) * 100;
  const benchmarkReturn = [benchmarkStart, benchmarkEnd].every(Number.isFinite) && benchmarkStart > 0 && benchmarkEnd > 0 ? (benchmarkEnd / benchmarkStart - 1) * 100 : null;
  const netReturn = rawReturn - modeledCostBps / 100;
  // Endpoints (even an exit-day low) cannot establish path-dependent maximum drawdown.
  return createOutcomeObservation({ runId, instrumentId, horizon, entryConvention: 'next-completed-close', entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, rawReturn, netReturn, benchmarkReturn, maxDrawdown: null, liquidityFlags, costsApplied: true, costBps: modeledCostBps, status: 'observed', observedAt: exit?.observedAt });
}

export function expectedExitDate(entryObservedAt, horizon = 'T+21', { sessionDates = [] } = {}) {
  const start = Date.parse(entryObservedAt || '');
  if (!Number.isFinite(start) || !horizonDays[horizon] || !Array.isArray(sessionDates)) return null;
  const sessions = sessionDates.map((date) => Date.parse(date || ''));
  if (sessions.some((date, index) => !Number.isFinite(date) || (index > 0 && date <= sessions[index - 1]))) return null;
  const entryIndex = sessions.indexOf(start);
  const exit = entryIndex < 0 ? null : sessions[entryIndex + horizonDays[horizon]];
  return exit == null ? null : new Date(exit).toISOString();
}
