#!/usr/bin/env node
// v59.70 (data audit R10): the screener validation gate and the model validation status were hand-written on 2026-08-13
// and never re-evaluated. This script judges each gate requirement (architecture/validation-gate-criteria.json — the
// seven blockers are the pass criteria, owner 2026-11-04) from the research backtest artifact itself
// (public-data/factor-backtest-longrun.json, or the fresh one the research-backtest workflow writes). A status changes
// only when every required requirement is met. Offline and deterministic; it never fetches.
//
//   node scripts/build-validation-gates.mjs [--backtest <factor-backtest-longrun.json>] [--out-dir <dir>] [--check]
//
// --check compares the computed status/allowedUse/blockers with the published files and exits 1 on a difference,
// without writing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finiteNumber as finite } from '../src/domain/shared/number.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CRITERIA_PATH = path.join(ROOT, 'architecture/validation-gate-criteria.json');
export const SCREENER_GATE_OUT = 'screener-validation-gate.json';
export const MODEL_VALIDATION_OUT = 'model-validation-status.json';

// One test per requirement, over the backtest artifact only (the evidence text in the criteria file says the same).
const LOOKAHEAD = /look-?ahead/i;
export const REQUIREMENT_TESTS = Object.freeze({
  pointInTimeUniverse: (b) => b?.methodology?.universeBasis === 'point-in-time' && !b.methodology.survivorshipBiasCaveat,
  delistingAndCorporateAction: (b) => b?.universe?.includesDelisted === true && b?.methodology?.corporateActions === 'adjusted',
  filingAvailableDate: (b) => b?.methodology?.fundamentalsAsOf === 'filing-available-date' && !LOOKAHEAD.test(String(b.methodology.excludedFactorsReason || '')),
  turnoverModeled: (b) => {
    const rows = Object.values(b?.overallByHorizon || {});
    return rows.length > 0 && rows.every((row) => finite(row?.turnover) != null);
  },
  transactionCostsModeled: (b) => finite(b?.methodology?.transactionCostBps) != null && b.methodology.returnsNetOfCost === true,
  liquidityCapacityModeled: (b) => finite(b?.methodology?.capacity?.maxAdvShare) != null,
  liveBacktestParity: (b) => Array.isArray(b?.methodology?.excludedFactors) && b.methodology.excludedFactors.length === 0 && b.methodology.regimeWeightsValidated === true
});

/** Every requirement judged on one backtest: { key: true|false }. A missing artifact meets none. */
export function judgeRequirements(backtest, keys = Object.keys(REQUIREMENT_TESTS)) {
  return Object.fromEntries(keys.map((key) => [key, !!backtest && REQUIREMENT_TESTS[key]?.(backtest) === true]));
}

function reported(backtest, spec = {}) {
  const row = backtest?.overallByHorizon?.[spec.horizon]?.icIR?.[spec.factor] || null;
  return row ? { horizon: spec.horizon, factor: spec.factor, n: finite(row.n), mean: finite(row.mean), icIR: finite(row.icIR), tStat: finite(row.tStat), ci95: Array.isArray(row.ci95) ? row.ci95 : null } : null;
}

export function buildValidationGates({ criteria, backtest = null, nowIso = new Date().toISOString() } = {}) {
  const met = judgeRequirements(backtest);
  const blockersOf = (list) => (list || []).filter((key) => met[key] !== true);
  const flags = (list) => Object.fromEntries((list || []).map((key) => [key, met[key] === true]));
  const evidenceAt = backtest?.generatedAt || null;

  const gateSpec = criteria.screenerGate;
  const gateBlockers = blockersOf(gateSpec.required);
  const screenerGate = {
    schemaVersion: 'screener-validation-gate.v1',
    gateId: gateSpec.gateId,
    status: gateBlockers.length ? 'BLOCKED' : 'PASS',
    allowedUse: gateBlockers.length ? gateSpec.blockedAllowedUse : gateSpec.passAllowedUse,
    ...flags(gateSpec.required),
    blockers: gateBlockers,
    reason: gateBlockers.length
      ? `The research backtest does not carry the evidence for: ${gateBlockers.join(', ')}. Current screener artifacts are present-day relative-ranking inputs.`
      : 'The research backtest carries the evidence for every gate requirement.',
    criteria: 'architecture/validation-gate-criteria.json',
    evidenceArtifact: 'public-data/factor-backtest-longrun.json',
    evidenceGeneratedAt: evidenceAt,
    localContractStatus: 'VERIFIED_LOCAL',
    localContractEvidence: 'scripts/ci-screener-workbench-contract.mjs',
    computedAt: nowIso,
    observedAt: nowIso
  };

  const modelSpec = criteria.modelValidation;
  const modelBlockers = blockersOf(modelSpec.required);
  const walk = backtest?.walkForward || null;
  const modelValidation = {
    schemaVersion: 'model-validation.v1',
    status: modelBlockers.length ? 'BLOCKED' : 'PASS',
    allowedUse: modelBlockers.length ? modelSpec.blockedAllowedUse : modelSpec.passAllowedUse,
    predictiveValidation: modelBlockers.length ? 'not-established' : 'established',
    ...flags(modelSpec.required),
    walkForward: !!walk?.referencePeriod,
    holdout: !!walk?.holdoutPeriod,
    metrics: modelSpec.metrics,
    blockers: modelBlockers,
    // Reported, not judged: the IC row is shown beside the status; no threshold on it decides anything.
    predictive: reported(backtest, modelSpec.reported),
    backtestGeneratedAt: evidenceAt,
    reason: modelBlockers.length
      ? `Predictive validity not established: the long-run backtest lacks ${modelBlockers.join(', ')} (present-day universe).`
      : 'The long-run backtest carries the evidence for every requirement.',
    criteria: 'architecture/validation-gate-criteria.json',
    evidenceArtifact: 'scripts/backtest-factors-longrun.mjs',
    localContractStatus: 'VERIFIED_LOCAL',
    localContractEvidence: 'scripts/ci-screener-workbench-contract.mjs',
    computedAt: nowIso,
    observedAt: nowIso
  };
  return { screenerGate, modelValidation };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const outDir = path.resolve(arg('--out-dir') || path.join(ROOT, 'public-data'));
  const backtestPath = path.resolve(arg('--backtest') || path.join(ROOT, 'public-data/factor-backtest-longrun.json'));
  const criteria = JSON.parse(fs.readFileSync(CRITERIA_PATH, 'utf8'));
  let backtest = null;
  try { backtest = JSON.parse(fs.readFileSync(backtestPath, 'utf8')); } catch { backtest = null; }
  const built = buildValidationGates({ criteria, backtest });
  const files = [[SCREENER_GATE_OUT, built.screenerGate], [MODEL_VALIDATION_OUT, built.modelValidation]];
  if (args.includes('--check')) {
    const keyOf = (o) => JSON.stringify({ status: o?.status, allowedUse: o?.allowedUse, blockers: [...(o?.blockers || [])].sort(), predictiveValidation: o?.predictiveValidation ?? null });
    let bad = 0;
    for (const [name, value] of files) {
      let published = null;
      try { published = JSON.parse(fs.readFileSync(path.join(outDir, name), 'utf8')); } catch { published = null; }
      if (keyOf(published) !== keyOf(value)) { bad += 1; console.error(`${name}: published ${keyOf(published)} != computed ${keyOf(value)}`); }
    }
    if (bad) process.exit(1);
    console.log(`validation gates OK: ${built.screenerGate.status}/${built.modelValidation.status}`);
  } else {
    for (const [name, value] of files) fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
    console.log(`validation gates written: ${built.screenerGate.status}/${built.modelValidation.status} → ${outDir}`);
  }
}
