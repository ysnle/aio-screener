import { OUTCOME_HORIZONS, createOutcomeObservation, stableHash, validateOutcomeObservation } from '../../data/contracts/screener.js';

export const OUTCOME_LEDGER_VERSION = 'outcome-ledger.v1';

const horizonDays = { 'T+1': 1, 'T+5': 5, 'T+21': 21, 'T+63': 63 };

export function createOutcomeLedger(initial = []) {
  const records = new Map();
  (Array.isArray(initial) ? initial : []).forEach((record) => { if (validateOutcomeObservation(record).ok) records.set(record.outcomeId, record); });
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

export function calculateOutcome({ runId, instrumentId, entry, exit, benchmarkEntry = null, benchmarkExit = null, horizon = 'T+21', costBps = 0, liquidityFlags = [] } = {}) {
  if (!OUTCOME_HORIZONS.includes(horizon)) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: ['invalid_horizon'] });
  const entryValue = Number(entry?.value);
  const exitValue = Number(exit?.value);
  const benchmarkStart = Number(benchmarkEntry?.value);
  const benchmarkEnd = Number(benchmarkExit?.value);
  if (![entryValue, exitValue].every(Number.isFinite) || entryValue <= 0 || exitValue <= 0) return createOutcomeObservation({ runId, instrumentId, horizon, entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'price_missing'], costsApplied: false });
  const rawReturn = (exitValue / entryValue - 1) * 100;
  const benchmarkReturn = [benchmarkStart, benchmarkEnd].every(Number.isFinite) && benchmarkStart > 0 ? (benchmarkEnd / benchmarkStart - 1) * 100 : null;
  const netReturn = rawReturn - Number(costBps || 0) / 100;
  return createOutcomeObservation({ runId, instrumentId, horizon, entryConvention: 'next-completed-close', entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, rawReturn: netReturn, benchmarkReturn, maxDrawdown: finiteDrawdown(entry, exit), liquidityFlags, costsApplied: Number(costBps || 0) > 0, costBps, status: 'observed', observedAt: exit?.observedAt });
}

function finiteDrawdown(entry, exit) {
  const low = Number(exit?.low ?? exit?.value);
  const start = Number(entry?.value);
  return Number.isFinite(low) && Number.isFinite(start) && start > 0 ? Math.min(0, (low / start - 1) * 100) : null;
}

export function expectedExitDate(entryObservedAt, horizon = 'T+21') {
  const start = Date.parse(entryObservedAt || '');
  return Number.isFinite(start) && horizonDays[horizon] ? new Date(start + horizonDays[horizon] * 86_400_000).toISOString() : null;
}

