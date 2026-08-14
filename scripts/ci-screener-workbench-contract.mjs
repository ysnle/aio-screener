import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELD_STATUS,
  OBSERVATION_SOURCES,
  OUTCOME_HORIZONS,
  SCREENER_FIELD_REGISTRY,
  buildFieldReadiness,
  createInstrumentRef,
  createObservationEnvelope,
  createScreenDefinition,
  stableHash,
  validateFieldRegistry,
  validateInstrumentRef,
  validateObservationEnvelope,
  validateScreenDefinition,
  validateScreenRun
} from '../src/data/contracts/screener.js';
import { createDefaultScreenDefinitions, runScreen } from '../src/domain/screener/screen-engine.js';
import { createSavedScreen, decodeScreenSharePayload, encodeScreenSharePayload } from '../src/domain/screener/saved-screens.js';
import { createRefreshPlanner } from '../src/domain/screener/refresh-planner.js';
import { DEFAULT_SCREENER_CAPABILITY_CATALOG, observationFromProvider, reconcileFieldObservations, selectProviderForField } from '../src/domain/screener/provider-capability.js';
import { deriveRegimeState, replayRegime } from '../src/domain/screener/regime.js';
import { createValidationGate, promotionDecision, validatePITRun } from '../src/domain/screener/pit-validation.js';
import { calculateOutcome } from '../src/domain/screener/outcome-ledger.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message, details = null) {
  const item = { id: message, ok: Boolean(condition), ...(details ? { details } : {}) };
  checks.push(item);
  if (!condition) failures.push(item);
}

function fixtureRow(symbol, market, offset = 0) {
  const row = {
    sym: symbol,
    symbol,
    name: `${symbol} fixture`,
    market,
    mic: market === 'KR' ? 'XKRX' : 'XNAS',
    currency: market === 'KR' ? 'KRW' : 'USD',
    assetType: 'EQUITY',
    instrumentRef: createInstrumentRef({ instrumentId: `${market}:${symbol}`, symbol, market }),
    observedAt: '2026-08-12T00:00:00.000Z',
    fetchedAt: '2026-08-12T00:01:00.000Z',
    price: 100 + offset,
    close: 100 + offset,
    ret1m: 4 + offset,
    ret3m: 12 - offset,
    ret6m: 18 - offset,
    vol: 18 + offset,
    rsi: 58 + offset,
    pctSma50: 5,
    pctSma200: 8,
    rvol20: 1.4,
    dollarVolume30d: 4_000_000,
    kalmanVel: 0.8,
    kalmanVelConf: 0.7,
    vcpScore: 72,
    vcpStage: 'ready',
    ema8: 101,
    ema21: 99,
    ema60: 94,
    mcap: 100,
    pe: 18,
    pb: 2.2,
    evEbitda: 12,
    roe: 18,
    margin: 14,
    revGrowth: 10,
    _fundamentalFiledAt: '2026-07-31T00:00:00.000Z',
    _fundamentalObservedAt: '2026-08-02T00:00:00.000Z',
    _fundamentalSource: 'fixture',
    newsScore: 0.2,
    newsCount: 2,
    advanceRatio: 0.6,
    regimeLabel: 'NEUTRAL',
    rank: 75 - offset,
    score: 75 - offset,
    factorScores: { momentum: 80 - offset, trend: 70, lowvol: 65, composite: 74 - offset }
  };
  for (const definition of SCREENER_FIELD_REGISTRY.fields) {
    if (definition.rowKey && row[definition.rowKey] == null) row[definition.rowKey] = definition.type === 'number' ? 1 : definition.type === 'enum' ? 'NEUTRAL' : `${symbol}-${definition.rowKey}`;
  }
  row.fieldReadiness = buildFieldReadiness(row, {
    now: Date.parse('2026-08-12T00:02:00.000Z'),
    revisionId: 'fixture-v1',
    sourceId: `${market.toLowerCase()}-fixture`,
    sourceKind: 'T1_OFFICIAL',
    rightsByField: Object.fromEntries(SCREENER_FIELD_REGISTRY.fields.map((field) => [field.fieldId, 'VERIFIED']))
  });
  row.fieldObservations = row.fieldReadiness.observations;
  return row;
}

function run() {
  const registryCheck = validateFieldRegistry(SCREENER_FIELD_REGISTRY);
  assert(registryCheck.ok && registryCheck.size >= 30, 'G-SCR-FIELD: registry has 30+ fields with US/KR coverage', registryCheck);
  assert(FIELD_STATUS.length === 9 && OBSERVATION_SOURCES.length === 4, 'G-SCR-FIELD: status/source vocabulary is closed');
  const usRef = createInstrumentRef({ instrumentId: 'US:AAA', symbol: 'AAA', market: 'US' });
  const krRef = createInstrumentRef({ instrumentId: 'KR:BBB', symbol: 'BBB', market: 'KR' });
  assert(validateInstrumentRef(usRef).ok && validateInstrumentRef(krRef).ok, 'G-SCR-IDENTITY: US/KR instrument references validate');
  const observation = createObservationEnvelope({ instrumentId: usRef.instrumentId, fieldId: 'price.close', value: 100, unit: 'USD', sourceId: 'fixture', sourceKind: 'T1_OFFICIAL', qualityStatus: 'CURRENT', rightsId: 'VERIFIED', observedAt: '2026-08-12T00:00:00.000Z', fetchedAt: '2026-08-12T00:01:00.000Z', revisionId: 'fixture-v1' });
  assert(validateObservationEnvelope(observation).ok, 'G-SCR-FIELD: ObservationEnvelope validates with four timestamps');

  const rows = [fixtureRow('AAA', 'US', 0), fixtureRow('BBB', 'KR', 2)];
  const lineageRow = fixtureRow('LINEAGE', 'US', 1);
  lineageRow.priceObservedAt = '2026-08-12T00:01:30.000Z';
  lineageRow.priceFetchedAt = '2026-08-12T00:01:45.000Z';
  lineageRow.priceSource = 'runtime-quote-fixture';
  lineageRow._fundamentalObservedAt = '2026-07-31T00:00:00.000Z';
  lineageRow._fundamentalFetchedAt = '2026-08-01T00:00:00.000Z';
  lineageRow._fundamentalSource = 'sec-fixture';
  const lineage = buildFieldReadiness(lineageRow, {
    now: Date.parse('2026-08-12T00:02:00.000Z'),
    revisionId: 'fixture-v2',
    sourceId: 'factor-fixture',
    sourceKind: 'T1_OFFICIAL',
    rightsByField: Object.fromEntries(SCREENER_FIELD_REGISTRY.fields.map((field) => [field.fieldId, 'VERIFIED']))
  });
  assert(lineage.fields['price.close'].observedAt === '2026-08-12T00:01:30.000Z' && lineage.fields['price.close'].sourceId === 'runtime-quote-fixture', 'G-SCR-LINEAGE: live price keeps its own observation/source epoch');
  assert(lineage.fields['quality.roe'].observedAt === '2026-07-31T00:00:00.000Z' && lineage.fields['quality.roe'].sourceId === 'sec-fixture', 'G-SCR-LINEAGE: fundamentals keep filing-derived observation/source epoch');
  const definition = createScreenDefinition({ screenId: 'fixture-screen', name: 'Fixture screen', objective: 'contract-test', filtersAST: { type: 'and', children: [{ type: 'range', field: 'price.ret3m', min: 0, nullPolicy: 'reject' }, { type: 'exists', field: 'quality.roe', nullPolicy: 'reject' }] }, hardGates: [{ type: 'range', field: 'price.dollarVolume30d', min: 1_000_000, nullPolicy: 'reject' }], ranking: { field: 'price.ret3m', direction: 'desc' }, requiredFields: ['price.ret3m', 'quality.roe'] });
  assert(validateScreenDefinition(definition).ok, 'G-SCR-DEFINITION: AST definition validates without executable code');
  const engineSource = fs.readFileSync(path.join(root, 'src/domain/screener/screen-engine.js'), 'utf8');
  assert(!/\beval\s*\(/.test(engineSource) && !/new\s+Function\s*\(/.test(engineSource), 'G-SCR-DEFINITION: screen engine has no eval/new Function path');
  const result = runScreen({ definition, rows, snapshotId: 'fixture-snapshot', providerSet: ['fixture'] });
  assert(validateScreenRun(result.run).ok && result.run.resultHash && result.readiness.rowCount === rows.length, 'G-SCR-RUN: ScreenRun and readiness are reproducible', result.run);
  assert(result.passed[0]?.symbol === 'AAA', 'G-SCR-RANK: descending rank order is deterministic');
  const presetsA = createDefaultScreenDefinitions();
  const presetsB = createDefaultScreenDefinitions();
  assert(presetsA.length === 6 && stableHash(presetsA) === stableHash(presetsB), 'G-SCR-PRESET: six deterministic presets are registered');
  const saved = createSavedScreen({ savedId: 'fixture-saved', label: 'Fixture saved', definition });
  const share = encodeScreenSharePayload(saved);
  const decoded = decodeScreenSharePayload(share);
  assert(decoded.definition.definitionHash === definition.definitionHash && !/api[_-]?key|secret|token/i.test(share), 'G-SCR-IMPORT: credential-free saved-screen share round-trips');

  const planner = createRefreshPlanner({ budget: { maxItems: 3, maxPerProvider: 1 }, maxAttempts: 2, baseRetryMs: 1000 });
  const demand = { instrumentId: 'US:AAA', fieldGroup: 'price', asOfBucket: '2026-08-12T00', priority: 1, reason: 'stale' };
  assert(planner.enqueue(demand).accepted && planner.enqueue(demand).deduped, 'G-SCR-REFRESH: duplicate refresh demand is deduped');
  const planned = planner.plan({ providerId: 'fixture-provider', limit: 3 });
  assert(planned.length === 1 && planned[0].idempotencyKey, 'G-SCR-REFRESH: budget and idempotency are bounded');
  const failed = planner.acknowledge(planned[0], { providerId: 'fixture-provider', reason: 'timeout', lkgObservedAt: '2026-08-11T00:00:00.000Z' });
  assert(failed.status === 'retry' && planner.snapshot().queued[0].lkgObservedAt, 'G-SCR-REFRESH: retry and last-known-good are retained');

  const sec = selectProviderForField({ catalog: DEFAULT_SCREENER_CAPABILITY_CATALOG, fieldId: 'quality.roe', market: 'US', preferred: ['sec-edgar'] });
  const delayed = selectProviderForField({ catalog: DEFAULT_SCREENER_CAPABILITY_CATALOG, fieldId: 'price.close', market: 'US', preferred: ['aio-yahoo-eod'] });
  assert(sec?.providerId === 'sec-edgar' && delayed?.providerId === 'aio-yahoo-eod', 'G-SCR-CAPABILITY: provider selection is capability-based');
  const currentA = observationFromProvider({ provider: sec, instrumentId: 'US:AAA', fieldId: 'quality.roe', value: 10, unit: 'percent', observedAt: '2026-08-12T00:00:00.000Z', fetchedAt: '2026-08-12T00:01:00.000Z', revisionId: 'r1', qualityStatus: 'CURRENT', rightsId: 'VERIFIED' });
  const currentB = observationFromProvider({ provider: sec, instrumentId: 'US:AAA', fieldId: 'quality.roe', value: 20, unit: 'percent', observedAt: '2026-08-12T00:00:00.000Z', fetchedAt: '2026-08-12T00:01:00.000Z', revisionId: 'r2', qualityStatus: 'CURRENT', rightsId: 'VERIFIED' });
  assert(reconcileFieldObservations([currentA, currentB], { tolerance: 1 }).status === 'CONFLICT', 'G-SCR-RECON: divergent observations fail closed');

  const baseInputs = { trendScore: 1, breadthScore: 100, volatilityScore: 100, creditScore: 1, rotationScore: 1 };
  const on = deriveRegimeState({ inputs: baseInputs, now: Date.parse('2026-08-01T00:00:00.000Z'), minHoldMs: 0 });
  const held = deriveRegimeState({ inputs: { trendScore: -1, breadthScore: 0, volatilityScore: 0, creditScore: -1, rotationScore: -1 }, previous: on, now: Date.parse('2026-08-02T00:00:00.000Z') });
  const replay = replayRegime({ history: [{ now: Date.parse('2026-08-01T00:00:00.000Z'), inputs: baseInputs }, { now: Date.parse('2026-08-02T00:00:00.000Z'), inputs: baseInputs }, { now: Date.parse('2026-08-04T00:00:00.000Z'), inputs: { trendScore: -1, breadthScore: 0, volatilityScore: 0, creditScore: -1, rotationScore: -1 } }] });
  assert(on.state === 'RISK_ON' && held.state === 'RISK_ON' && replay.autoWeightPromotion === false, 'G-SCR-REGIME: confidence/hysteresis/replay keep auto weight promotion disabled');
  const pit = validatePITRun({ universe: [{ asOf: '2026-08-12T00:00:00.000Z', currentUniverse: true }], observations: [], asOf: '2026-08-12T00:00:00.000Z' });
  const gate = createValidationGate({ observedAt: '2026-08-12T00:00:00.000Z' });
  assert(!pit.ok && gate.status === 'BLOCKED' && gate.blockers.length >= 5, 'G-SCR-PIT: missing PIT/cost/liquidity evidence remains blocked');
  assert(promotionDecision({ gate, regime: on, result }).promoted === false, 'G-SCR-PROMOTION: blocked validation cannot promote weights');
  const pitReady = validatePITRun({
    universe: [{
      asOf: '2026-08-12T00:00:00.000Z',
      effectiveAt: '2026-08-11T00:00:00.000Z',
      filedAt: '2026-08-01T00:00:00.000Z',
      availableAt: '2026-08-02T00:00:00.000Z',
      validFrom: '2020-01-01T00:00:00.000Z',
      turnover: 0.12,
      liquidity: { dollarVolume30d: 4_000_000 },
      costBps: 15
    }],
    observations: [{ instrumentId: 'US:AAA', observedAt: '2026-08-11T00:00:00.000Z' }],
    asOf: '2026-08-12T00:00:00.000Z',
    benchmark: { symbol: 'SPY' },
    costs: { roundTripBps: 15 },
    liquidity: { dollarVolume30d: 4_000_000 },
    liveDefinitionHash: definition.definitionHash,
    backtestDefinitionHash: definition.definitionHash
  });
  const readyGate = createValidationGate({
    pointInTimeUniverse: true,
    delistingAndCorporateAction: true,
    filingAvailableDate: true,
    turnoverModeled: true,
    transactionCostsModeled: true,
    liquidityCapacityModeled: true,
    liveBacktestParity: true,
    observedAt: '2026-08-12T00:00:00.000Z'
  });
  const reviewDecision = promotionDecision({ gate: readyGate, regime: { allowedUse: 'reference-only', liveBacktestParity: true }, result });
  assert(pitReady.ok && readyGate.status === 'READY_FOR_RESEARCH_PROMOTION_REVIEW', 'G-SCR-PIT: complete evidence path validates without promoting live status');
  assert(reviewDecision.promotionReviewReady && reviewDecision.promoted === false && reviewDecision.autoWeightPromotion === false, 'G-SCR-PROMOTION: ready evidence still requires human review and keeps auto promotion disabled');
  const outcomes = OUTCOME_HORIZONS.map((horizon) => calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon, entry: { value: 100, observedAt: '2026-08-12T00:00:00.000Z' }, exit: { value: 105, low: 98, observedAt: '2026-08-20T00:00:00.000Z' }, benchmarkEntry: { value: 100 }, benchmarkExit: { value: 102 }, costBps: 15 }));
  assert(outcomes.length === 4 && outcomes.every((outcome) => outcome.status === 'observed' && outcome.costsApplied), 'G-SCR-OUTCOME: T+1/5/21/63 outcomes carry cost flags');
  const zeroCostOutcome = calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon: 'T+1', entry: { value: 100, observedAt: '2026-08-12T00:00:00.000Z' }, exit: { value: 105, observedAt: '2026-08-13T00:00:00.000Z' }, costBps: 0 });
  const missingCostOutcome = calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon: 'T+1', entry: { value: 100 }, exit: { value: 105 } });
  assert(zeroCostOutcome.status === 'observed' && zeroCostOutcome.costsApplied && missingCostOutcome.status === 'unavailable' && missingCostOutcome.liquidityFlags.includes('transaction_cost_missing'), 'G-SCR-COST: explicit zero cost is modeled while missing cost is unavailable');

  const artifact = readJson('public-data/screener.json');
  const model = readJson('public-data/model-validation-status.json');
  const validationGate = readJson('public-data/screener-validation-gate.json');
  assert(artifact.universe === 873 && artifact.ok === 848 && artifact.fundamentalCoveragePct === 74.2, 'SCR-OS-00: baseline remains 873/848/74.2', { universe: artifact.universe, ok: artifact.ok, fundamentalCoveragePct: artifact.fundamentalCoveragePct });
  assert(model.status === 'BLOCKED' && model.pointInTimeUniverse === false && model.transactionCostsModeled === false, 'G-SCR-09: model validation remains explicitly blocked');
  assert(validationGate.status === 'BLOCKED' && validationGate.pointInTimeUniverse === false, 'G-SCR-09: persistent validation gate is fail-closed');
  const index = fs.readFileSync(path.join(root, '_context/INDEX.md'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const provider = fs.readFileSync(path.join(root, 'src/data/providers/screener.js'), 'utf8');
  assert(index.includes('SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md'), 'G-SCR-DOCS: handoff remains indexed');
  assert(page.includes('scr-definition-editor') && page.includes('scr-readiness-preview') && page.includes('scr-run-history') && page.includes('scr-outcome-lab'), 'G-SCR-UI: workbench adapter controls are present');
  const screenerUi = fs.readFileSync(path.join(root, 'src/ui/pages/screener.js'), 'utf8');
  assert(provider.includes('buildFieldReadiness') && provider.includes('fieldObservations') && provider.includes('FACTOR_STALE_AFTER_DAYS = 4'), 'G-SCR-PIPELINE: provider emits readiness and rejects stale factor epochs');
  assert(screenerUi.includes('screener-visible-quotes') && screenerUi.includes('registerLiveSymbol'), 'G-SCR-LIVE: rendered screener rows register bounded live-quote demand');

  const report = { schemaVersion: 'screener-workbench-ci.v1', generatedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : 'PASS', checks, failures, baseline: { universe: artifact.universe, ok: artifact.ok, fundamentalCoveragePct: artifact.fundamentalCoveragePct }, fieldRegistry: registryCheck.size, presetCount: presetsA.length };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

run();
