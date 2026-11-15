#!/usr/bin/env node
// v59.70 (data audit R10): the screener validation gate and the model validation status were hand-written on 2026-08-13
// and never re-evaluated. This script judges each gate requirement (architecture/validation-gate-criteria.json — the
// seven blockers are the pass criteria, owner 2026-11-04) from the research backtest artifact itself
// (public-data/factor-backtest-longrun.json, or the fresh one the research-backtest workflow writes). A status changes
// only when every required requirement is met. Offline and deterministic; it never fetches.
//
//   node scripts/build-validation-gates.mjs [--backtest <factor-backtest-longrun.json>] [--lean-backtest <market-lean-backtest.json>] [--lean-risk <risk-result.json>] [--out-dir <dir>] [--check]
//
// model-validation-status.json also carries `marketLean`, the 시장 기울기 lean verdict (judgeMarketLean below), with the
// risk read of the same count under `marketLean.risk` (judgeMarketLeanRisk). A missing study judges NOT_RUN.
//
// --check compares the status/allowedUse/blockers judged on --backtest with the gate files in --out-dir (default
// public-data/) and exits 1 on a difference, without writing. The committed gate files are the judgement of the
// committed backtest (public-data/factor-backtest-longrun.json), so `--check` with no --backtest is the CI question
// "do the published gates match the published evidence?". With a fresh backtest from the manual research-backtest workflow
// a difference is expected until that backtest is promoted into public-data/ and this script is rerun without --check
// in the same reviewed change; the message names both evidence dates so the two cases are told apart.
// --out-dir is created when missing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finiteNumber as finite } from '../src/domain/shared/number.js';
import { FACTOR_RANKS_MODEL_VERSION } from '../src/domain/screener/factor-ranks.js';
import { FACTOR_WEIGHTS_MODEL_VERSION, MODEL_DEFAULT_WEIGHTS } from '../src/domain/screener/factor-weights.js';
import { MARKET_LEAN_VERSION, LEAN_RULES } from '../src/domain/market/regime/market-lean.js';

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
  // The backtest writes turnover as { rebalanceCount, average, maximum } per horizon and the cost scenario as
  // executionModel.transactionCostBps with a net-of-cost spread beside the gross one (scripts/lib/factors.mjs).
  turnoverModeled: (b) => {
    const rows = Object.values(b?.overallByHorizon || {});
    return rows.length > 0 && rows.every((row) => finite(row?.turnover?.average) != null && finite(row?.turnover?.rebalanceCount) > 0);
  },
  transactionCostsModeled: (b) => {
    const rows = Object.values(b?.overallByHorizon || {});
    return finite(b?.executionModel?.transactionCostBps) != null && rows.length > 0 && rows.every((row) => finite(row?.quantileSpreadNet) != null);
  },
  liquidityCapacityModeled: (b) => finite(b?.methodology?.capacity?.maxAdvShare) != null,
  liveBacktestParity: (b) => Array.isArray(b?.methodology?.excludedFactors) && b.methodology.excludedFactors.length === 0 && b.methodology.regimeWeightsValidated === true
});

/** Every requirement judged on one backtest: { key: true|false }. A missing artifact meets none. */
export function judgeRequirements(backtest, keys = Object.keys(REQUIREMENT_TESTS)) {
  return Object.fromEntries(keys.map((key) => [key, !!backtest && REQUIREMENT_TESTS[key]?.(backtest) === true]));
}

function reported(backtest, spec = {}) {
  const row = backtest?.overallByHorizon?.[spec.horizon]?.icIR?.[spec.factor] || null;
  // tStat/ci95 are the naive IID figures; the Newey-West pair is the one to read when forward windows overlap
  // (null for a backtest written before it carried HAC inference).
  return row ? { horizon: spec.horizon, factor: spec.factor, n: finite(row.n), mean: finite(row.mean), icIR: finite(row.icIR), tStat: finite(row.tStat), ci95: Array.isArray(row.ci95) ? row.ci95 : null,
    inference: row.inference || 'naive-iid-normal-approximation', hacTStat: finite(row.hac?.hacTStat), hacCi95: Array.isArray(row.hac?.hacCi95) ? row.hac.hacCi95 : null } : null;
}

// The model the evidence was run on, beside the live ranking model. A study records its model in
// methodology.modelFingerprint; one written before that is named by the factors it left out. Reported on both outputs
// so a reader sees when the evidence on file describes another model; the status still follows the requirements.
export function evidenceModelIdentity(backtest) {
  const liveModel = { factorRanksModelVersion: FACTOR_RANKS_MODEL_VERSION, factorWeightsModelVersion: FACTOR_WEIGHTS_MODEL_VERSION,
    activeFactors: Object.keys(MODEL_DEFAULT_WEIGHTS).filter((factor) => MODEL_DEFAULT_WEIGHTS[factor] > 0).sort() };
  let stored = null;
  try { stored = JSON.parse(backtest?.methodology?.modelFingerprint || 'null'); } catch { stored = null; }
  const excluded = Array.isArray(backtest?.methodology?.excludedFactors) ? backtest.methodology.excludedFactors : null;
  const evidenceModel = !backtest ? null : {
    factorRanksModelVersion: stored?.factorRanksModelVersion ?? null,
    factorWeightsModelVersion: stored?.factorWeightsModelVersion ?? null,
    activeFactors: Array.isArray(stored?.activeFactors) ? [...stored.activeFactors].sort()
      : excluded ? Object.keys(MODEL_DEFAULT_WEIGHTS).filter((factor) => MODEL_DEFAULT_WEIGHTS[factor] > 0 && !excluded.includes(factor)).sort() : null
  };
  return { evidenceModelMatchesLive: !!evidenceModel && JSON.stringify(evidenceModel) === JSON.stringify(liveModel), evidenceModel, liveModel };
}

export function buildValidationGates({ criteria, backtest = null, leanBacktest = null, leanRisk = null, nowIso = new Date().toISOString() } = {}) {
  const met = judgeRequirements(backtest);
  const model = evidenceModelIdentity(backtest);
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
    ...model,
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
    ...model,
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
  if (criteria.marketLean) modelValidation.marketLean = judgeMarketLean(leanBacktest, criteria.marketLean);
  if (criteria.marketLean && criteria.marketLeanRisk) modelValidation.marketLean.risk = judgeMarketLeanRisk(leanRisk, criteria.marketLeanRisk);
  return { screenerGate, modelValidation };
}

// Review v60.19 A5: the risk read of the same count (does a burden-heavy count precede more -5% drawdowns?), judged like
// the direction verdict — on the study scripts/backtest-market-lean-risk.mjs writes, by the criterion registered before
// its first run (validation-gate-criteria.json `marketLeanRisk`). The checks are recomputed here from the study's
// numbers; its own `verdict` is not read. market-lean.js builds the fold sentence from this block.
export const LEAN_RISK_PATH = 'public-data/market-lean-risk.json';
export function judgeMarketLeanRisk(study, spec) {
  const head = { ruleVersion: MARKET_LEAN_VERSION, horizon: spec.horizon, criteria: 'architecture/validation-gate-criteria.json#marketLeanRisk', evidenceArtifact: spec.evidenceArtifact,
    criterion: { drawdownPct: spec.drawdownPct, lowBurden: spec.groups.lowBurden, highBurdenMin: spec.groups.highBurdenMin, minEffectiveN: spec.minEffectiveN, level: spec.interval.level } };
  if (!study) return { ...head, status: 'NOT_RUN', blockers: ['no-backtest'], checks: null, heldOut: null, evidenceGeneratedAt: null };
  const m = study.methodology || {};
  const numeric = (interval) => ['blockSessions', 'resamples', 'seed', 'level'].map((key) => interval?.[key]);
  const blockers = [];
  if (m.ruleVersion !== MARKET_LEAN_VERSION || JSON.stringify(m.leanRules) !== JSON.stringify(LEAN_RULES)) blockers.push('rule-differs-from-live');
  if (JSON.stringify(numeric(m.interval)) !== JSON.stringify(numeric(spec.interval)) || m.split?.heldOutFraction !== spec.heldOutFraction || m.split?.embargoSessions !== spec.embargoSessions
    || m.primary?.horizon !== spec.horizon || m.primary?.drawdownPct !== spec.drawdownPct || m.primary?.lowBurden !== spec.groups.lowBurden || m.primary?.highBurdenMin !== spec.groups.highBurdenMin) blockers.push('method-differs-from-criterion');
  const h = study.horizons?.[`h${spec.horizon}`] || {};
  const point = (span) => finite(h[span]?.diffHighMinusLow?.point);
  const ci = h.heldOut?.diffHighMinusLow?.ci;
  const high = finite(h.heldOut?.burden?.high?.cases) ?? 0, low = finite(h.heldOut?.burden?.low?.cases) ?? 0;
  const checks = { heldOutCases: high >= spec.minEffectiveN && low >= spec.minEffectiveN,
    heldOutLowerAboveZero: Array.isArray(ci) && ci.every((v) => finite(v) != null) && ci[0] > 0,
    firstTwoThirdsPositive: point('firstTwoThirds') != null && point('firstTwoThirds') > 0,
    halfAPositive: point('halfA') != null && point('halfA') > 0, halfBPositive: point('halfB') != null && point('halfB') > 0 };
  return { ...head, status: !blockers.length && Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', blockers, checks,
    heldOut: { from: h.heldOut?.from ?? null, to: h.heldOut?.to ?? null, highCases: high, lowCases: low, point: point('heldOut'), ci: Array.isArray(ci) ? ci : null },
    evidenceGeneratedAt: study.generatedAt || null };
}

// The 시장 기울기 lean (owner 2026-11-15): one verdict per direction on the study scripts/backtest-market-lean.mjs writes,
// by the criterion declared in validation-gate-criteria.json `marketLean` before the first run. market-lean.js reads
// this block (model-validation-status.json `marketLean`) and speaks a direction only where `directions` says true.
export const LEAN_BACKTEST_PATH = 'public-data/market-lean-backtest.json';
export function judgeMarketLean(lean, spec) {
  const head = { ruleVersion: MARKET_LEAN_VERSION, horizon: spec.horizon, criteria: 'architecture/validation-gate-criteria.json#marketLean', evidenceArtifact: spec.evidenceArtifact };
  if (!lean) return { ...head, status: 'NOT_RUN', directions: { buy: false, defend: false }, blockers: ['no-backtest'], evidenceGeneratedAt: null };
  const m = lean.methodology || {};
  const blockers = [];
  if (m.ruleVersion !== MARKET_LEAN_VERSION || JSON.stringify(m.leanRules) !== JSON.stringify(LEAN_RULES)) blockers.push('rule-differs-from-live');
  if (!Array.isArray(m.axesReconstructed) || m.axesReconstructed.length < spec.minAxesReconstructed) blockers.push('too-few-axes');
  if (JSON.stringify(m.interval) !== JSON.stringify(spec.interval) || m.split?.heldOutFraction !== spec.heldOutFraction || m.split?.embargoSessions !== spec.embargoSessions) blockers.push('method-differs-from-criterion');
  const h = lean.horizons?.[`h${spec.horizon}`];
  const judge = (name, sign) => {
    const held = h?.heldOut?.labels?.[name], ins = h?.inSample?.labels?.[name];
    const ci = held?.vsAll?.ci, point = ins?.vsAll?.point;
    const checks = { heldOutCases: finite(held?.cases) != null && held.cases >= spec.minEffectiveN,
      heldOutInterval: Array.isArray(ci) && ci.every((v) => finite(v) != null) && (sign > 0 ? ci[0] > 0 : ci[1] < 0),
      inSampleSign: finite(point) != null && Math.sign(point) === sign };
    return { pass: !blockers.length && Object.values(checks).every(Boolean), checks, heldOut: { cases: held?.cases ?? 0, vsAll: held?.vsAll ?? null }, inSample: { cases: ins?.cases ?? 0, vsAll: ins?.vsAll ?? null } };
  };
  const buy = judge('buy', 1), defend = judge('defend', -1);
  // The past frequency shown beside a spoken direction: every replayed session, non-overlapping cases, beside the base.
  const base = h?.all?.base?.hitRate;
  const frequencies = Object.fromEntries(['2', '1', '0', '-1', '-2'].map((key) => [key, h?.all?.labels?.[key]])
    .filter(([, row]) => finite(row?.hitRate) != null && finite(base) != null).map(([key, row]) => [key, { rate: row.hitRate, base, n: row.cases }]));
  return { ...head, status: buy.pass && defend.pass ? 'PASS' : buy.pass || defend.pass ? 'PARTIAL' : 'FAIL',
    directions: { buy: buy.pass, defend: defend.pass }, blockers, judged: { buy, defend }, frequencies,
    span: { from: lean.span?.from ?? null, to: lean.span?.to ?? null, heldOutFrom: m.split?.heldOutFrom ?? null },
    axesReconstructed: m.axesReconstructed || [], axesMissing: (m.axesMissing || []).map((row) => row.id), evidenceGeneratedAt: lean.generatedAt || null };
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
  // The lean study: --lean-backtest, or the promoted copy in public-data/ (absent until a reviewed promotion: NOT_RUN).
  let leanBacktest = null;
  try { leanBacktest = JSON.parse(fs.readFileSync(path.resolve(arg('--lean-backtest') || path.join(ROOT, LEAN_BACKTEST_PATH)), 'utf8')); } catch { leanBacktest = null; }
  // The risk study the same way (--lean-risk, or the promoted public-data/market-lean-risk.json; absent: NOT_RUN).
  let leanRisk = null;
  try { leanRisk = JSON.parse(fs.readFileSync(path.resolve(arg('--lean-risk') || path.join(ROOT, LEAN_RISK_PATH)), 'utf8')); } catch { leanRisk = null; }
  const built = buildValidationGates({ criteria, backtest, leanBacktest, leanRisk });
  const files = [[SCREENER_GATE_OUT, built.screenerGate], [MODEL_VALIDATION_OUT, built.modelValidation]];
  if (args.includes('--check')) {
    // A file without the lean block reads as the lean not run (the published file predates the lean study).
    const leanKey = (o) => o?.marketLean ? `${o.marketLean.status}:${o.marketLean.directions?.buy === true}:${o.marketLean.directions?.defend === true}:risk-${o.marketLean.risk?.status || 'NOT_RUN'}` : 'NOT_RUN:false:false:risk-NOT_RUN';
    const keyOf = (o) => JSON.stringify({ status: o?.status, allowedUse: o?.allowedUse, blockers: [...(o?.blockers || [])].sort(), predictiveValidation: o?.predictiveValidation ?? null, ...(o?.schemaVersion === 'model-validation.v1' ? { lean: leanKey(o) } : {}) });
    let bad = 0;
    for (const [name, value] of files) {
      let published = null;
      try { published = JSON.parse(fs.readFileSync(path.join(outDir, name), 'utf8')); } catch { published = null; }
      if (keyOf(published) !== keyOf(value)) {
        bad += 1;
        const judgedOn = published?.evidenceGeneratedAt ?? published?.backtestGeneratedAt ?? null;
        const evidence = judgedOn !== (backtest?.generatedAt || null)
          ? ` — the published file was judged on the backtest of ${judgedOn || 'unknown date'}, this run on ${backtest?.generatedAt || 'no backtest'} (${path.relative(ROOT, backtestPath)}); promote that backtest and rerun without --check, or check against the backtest the file was judged on`
          : ' — same evidence, different judgement: the criteria or the requirement tests changed; rerun without --check';
        console.error(`${name}: published ${keyOf(published)} != computed ${keyOf(value)}${evidence}`);
      }
    }
    if (bad) process.exit(1);
    console.log(`validation gates OK: ${built.screenerGate.status}/${built.modelValidation.status}`);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, value] of files) fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
    console.log(`validation gates written: ${built.screenerGate.status}/${built.modelValidation.status} → ${outDir}`);
  }
}
