import { OUTCOME_HORIZONS, createOutcomeObservation } from '../../data/contracts/screener.js';

const horizonDays = { 'T+1': 1, 'T+5': 5, 'T+21': 21, 'T+63': 63 };

export function calculateOutcome({ runId, instrumentId, entry, exit, benchmarkEntry = null, benchmarkExit = null, horizon = 'T+21', costBps = null, liquidityFlags = [], sessionDates = [] } = {}) {
  if (!OUTCOME_HORIZONS.includes(horizon)) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: ['invalid_horizon'] });
  const modeledCostBps = typeof costBps === 'number' ? costBps : NaN;
  if (!Number.isFinite(modeledCostBps) || modeledCostBps < 0) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'transaction_cost_missing'], costsApplied: false });
  const entryTime = Date.parse(entry?.observedAt || '');
  const exitTime = Date.parse(exit?.observedAt || '');
  if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime) || exitTime <= entryTime) return createOutcomeObservation({ runId, instrumentId, horizon, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'observation_time_invalid'], costsApplied: false });
  const expectedExit = expectedExitDate(entry?.observedAt, horizon, { sessionDates });
  if (!expectedExit) return createOutcomeObservation({ runId, instrumentId, horizon, entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'session_calendar_missing_or_entry_unaligned'], costsApplied: false });
  if (Date.parse(expectedExit) !== exitTime) return createOutcomeObservation({ runId, instrumentId, horizon, entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'horizon_exit_mismatch'], costsApplied: false });
  const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  const entryValue = numeric(entry?.value);
  const exitValue = numeric(exit?.value);
  const benchmarkStart = numeric(benchmarkEntry?.value);
  const benchmarkEnd = numeric(benchmarkExit?.value);
  if (![entryValue, exitValue].every(Number.isFinite) || entryValue <= 0 || exitValue <= 0) return createOutcomeObservation({ runId, instrumentId, horizon, entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, status: 'unavailable', liquidityFlags: [...liquidityFlags, 'price_missing'], costsApplied: false });
  const rawReturn = (exitValue / entryValue - 1) * 100;
  const benchmarkTimesAligned = Date.parse(benchmarkEntry?.observedAt || '') === entryTime
    && Date.parse(benchmarkExit?.observedAt || '') === exitTime;
  const benchmarkReturn = benchmarkTimesAligned && [benchmarkStart, benchmarkEnd].every(Number.isFinite) && benchmarkStart > 0 && benchmarkEnd > 0 ? (benchmarkEnd / benchmarkStart - 1) * 100 : null;
  const outcomeFlags = benchmarkStart > 0 && benchmarkEnd > 0 && !benchmarkTimesAligned
    ? [...liquidityFlags, 'benchmark_time_missing_or_misaligned']
    : liquidityFlags;
  const netReturn = rawReturn - modeledCostBps / 100;
  // Endpoints (even an exit-day low) cannot establish path-dependent maximum drawdown.
  return createOutcomeObservation({ runId, instrumentId, horizon, entryConvention: 'next-completed-close', entryObservedAt: entry?.observedAt, exitObservedAt: exit?.observedAt, rawReturn, netReturn, benchmarkReturn, maxDrawdown: null, liquidityFlags: outcomeFlags, costsApplied: true, costBps: modeledCostBps, status: 'observed', observedAt: exit?.observedAt });
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
