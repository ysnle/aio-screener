import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELD_STATUS,
  OBSERVATION_SOURCES,
  OUTCOME_HORIZONS,
  SCREENER_FIELD_REGISTRY,
  buildFieldReadiness,
  calculationRow,
  classifyFieldStatus,
  fieldValueForPurpose,
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
import { captureScreenRun, createDefaultScreenDefinitions, replayScreenRun, runScreen } from '../src/domain/screener/screen-engine.js';
import { createSavedScreen, decodeScreenSharePayload, encodeScreenSharePayload, exportSavedScreen, importSavedScreen } from '../src/domain/screener/saved-screens.js';
import { createRefreshPlanner } from '../src/domain/screener/refresh-planner.js';
import { DEFAULT_SCREENER_CAPABILITY_CATALOG, observationFromProvider, reconcileFieldObservations, selectProviderForField } from '../src/domain/screener/provider-capability.js';
import { createScreenerProvider } from '../src/data/providers/screener.js';
import { deriveRegimeState, replayRegime } from '../src/domain/screener/regime.js';
import { createValidationGate, promotionDecision, validatePITRun } from '../src/domain/screener/pit-validation.js';
import { calculateOutcome, expectedExitDate } from '../src/domain/screener/outcome-ledger.js';
import { filterRows } from '../src/ui/pages/screener.js';

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
    instrumentRef: createInstrumentRef({ instrumentId: `${market}:${symbol}`, symbol, market, mic: market === 'KR' ? 'XKRX' : 'XNAS', currency: market === 'KR' ? 'KRW' : 'USD', assetType: 'EQUITY' }),
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

async function run() {
  const registryCheck = validateFieldRegistry(SCREENER_FIELD_REGISTRY);
  assert(registryCheck.ok && registryCheck.size >= 30, 'G-SCR-FIELD: registry has 30+ fields with US/KR coverage', registryCheck);
  assert(FIELD_STATUS.length === 9 && OBSERVATION_SOURCES.length === 4, 'G-SCR-FIELD: status/source vocabulary is closed');
  const usRef = createInstrumentRef({ instrumentId: 'US:AAA', symbol: 'AAA', market: 'US', mic: 'XNAS', currency: 'USD', assetType: 'EQUITY' });
  const krRef = createInstrumentRef({ instrumentId: 'KR:BBB', symbol: 'BBB', market: 'KR', mic: 'XKRX', currency: 'KRW', assetType: 'EQUITY' });
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
  const captured = captureScreenRun({ definition, rows, snapshotId: 'fixture-snapshot', providerSet: ['fixture'] }, result);
  const reloaded = JSON.parse(JSON.stringify(captured));
  assert(replayScreenRun(reloaded).resultHash === result.resultHash && Object.isFrozen(captured.rows[0].fieldReadiness), 'G-SCR-REPLAY: frozen full inputs reproduce identical results after serialization without external data');
  let tamperRejected = false;
  try { replayScreenRun({ ...reloaded, rows: [{ ...reloaded.rows[0], ret3m: -999 }] }); } catch (_) { tamperRejected = true; }
  assert(tamperRejected, 'G-SCR-REPLAY: modified inputs cannot reuse a recorded result');
  for (const malformed of [{ hardGates: 'invalid' }, { requiredFields: {} }, { filtersAST: { type: 'and', children: {} } }, { ranking: { fields: ['price.volatility', 'rank'], direction: 'desc' } }]) {
    assert(!validateScreenDefinition({ ...definition, ...malformed }).ok, 'G-SCR-DEFINITION: malformed shapes and mixed ranking units are rejected', malformed);
  }
  const incompleteRow = fixtureRow('GAP', 'US', 1);
  incompleteRow.fieldReadiness = {
    ...incompleteRow.fieldReadiness,
    fields: {
      ...incompleteRow.fieldReadiness.fields,
      'quality.roe': { ...incompleteRow.fieldReadiness.fields['quality.roe'], value: null, status: 'MISSING' }
    }
  };
  const incompleteResult = runScreen({ definition, rows: [incompleteRow], snapshotId: 'fixture-incomplete', providerSet: ['fixture'] });
  assert(validateScreenRun(incompleteResult.run).ok && incompleteResult.run.rowCount === 1 && incompleteResult.run.eligibleCount === 0, 'G-SCR-RUN: unavailable rows count toward input rows, not eligible rows');
  assert(incompleteResult.run.eligibleCount === 0 && incompleteResult.run.passed === 0 && incompleteResult.unavailable[0]?.symbol === 'GAP' && incompleteResult.readiness.records[0]?.missingFields.includes('quality.roe'), 'G-SCR-READINESS: any missing required field blocks pass and rank eligibility');
  const publicField = { value: 12, observedAt: '2026-08-12T00:00:00.000Z', now: Date.parse('2026-08-12T01:00:00.000Z'), freshnessBudgetMs: 86400000, rights: 'REVIEW_REQUIRED', sourceKind: 'T3_PUBLIC_DELAYED' };
  assert(classifyFieldStatus(publicField) === 'DELAYED' && classifyFieldStatus({ ...publicField, rights: 'UNKNOWN' }) === 'BLOCKED_RIGHTS' && classifyFieldStatus({ ...publicField, now: publicField.now + 2 * 86400000 }) === 'STALE' && classifyFieldStatus({ ...publicField, value: null, lastGood: true }) === 'MISSING', 'G-SCR-RESEARCH: rights review is not missing data; unknown rights, stale and missing remain distinct');
  const queryDocument = (query) => ({ getElementById: (id) => ({ value: id === 'scr-text-search' ? query : '', checked: false }) });
  const queryRows = [{ sym: 'NVDA', name: 'NVIDIA', signal: 'BUY' }, { sym: 'QQQ', name: 'Nasdaq ETF', memo: 'NVDA exposure', signal: 'HOLD' }];
  const queryAliases = () => ({ nvda: ['NVDA'], 매수: 'BUY' });
  assert(filterRows(queryRows, queryDocument('NVDA'), { readAliases: queryAliases }).map((row) => row.sym).join(',') === 'NVDA' && filterRows(queryRows, queryDocument('매수'), { readAliases: queryAliases }).length === 1, 'G-SCR-SEARCH: alias-only queries do not match every row and signal aliases still work');
  const presetsA = createDefaultScreenDefinitions();
  const presetsB = createDefaultScreenDefinitions();
  assert(presetsA.length === 6 && stableHash(presetsA) === stableHash(presetsB), 'G-SCR-PRESET: six deterministic presets are registered');
  const mutableAST = { type: 'range', field: 'rank', min: 60 };
  const immutable = createScreenDefinition({ screenId: 'immutable-fixture', filtersAST: mutableAST });
  mutableAST.min = 80;
  assert(immutable.filtersAST.min === 60 && Object.isFrozen(immutable.filtersAST)
    && runScreen({ definition: immutable, rows: [{ sym: 'IMM', rank: 70 }] }).passed.length === 1,
  'G-SCR-DEFINITION: caller mutation cannot change a hashed screen');
  assert(!validateScreenDefinition({ ...immutable, filtersAST: { type: 'range', field: 'rank', min: 80 } }).ok,
    'G-SCR-DEFINITION: tampered content cannot reuse a definition hash');
  const lastGoodDefinition = createScreenDefinition({ screenId: 'last-good-fixture', filtersAST: { type: 'range', field: 'price.ret3m', min: 0 } });
  const lastGoodRow = { ...fixtureRow('LKG', 'US'), fieldReadiness: { fields: { 'price.ret3m': { value: 10, status: 'LAST_GOOD' } } } };
  assert(runScreen({ definition: lastGoodDefinition, rows: [lastGoodRow] }).unavailable.length === 1,
    'G-SCR-FILTER: last-good evidence cannot pass a current filter even without requiredFields');
  const defensiveRows = [fixtureRow('LOWVOL', 'US'), fixtureRow('HIGHVOL', 'US')];
  defensiveRows[0].vol = 10; defensiveRows[0].rank = 90;
  defensiveRows[1].vol = 20; defensiveRows[1].rank = 20;
  assert(runScreen({ definition: presetsA.find((item) => item.screenId === 'preset-lowvol'), rows: defensiveRows }).passed[0]?.sym === 'LOWVOL',
    'G-SCR-PRESET: lower volatility wins regardless of unrelated composite rank');
  const saved = createSavedScreen({ savedId: 'fixture-saved', label: 'Fixture saved', definition });
  const share = encodeScreenSharePayload(saved);
  const decoded = decodeScreenSharePayload(share);
  assert(decoded.definition.definitionHash === definition.definitionHash && !/api[_-]?key|secret|token/i.test(share), 'G-SCR-IMPORT: credential-free saved-screen share round-trips');
  const tampered = JSON.parse(exportSavedScreen(saved));
  tampered.definition.filtersAST.children[0].min = 999;
  let importRejected = false;
  try { importSavedScreen(JSON.stringify(tampered)); } catch (_) { importRejected = true; }
  assert(importRejected, 'G-SCR-IMPORT: migration cannot rehash a tampered current definition into validity');

  const planner = createRefreshPlanner({ budget: { maxItems: 3, maxPerProvider: 1 }, maxAttempts: 2, baseRetryMs: 1000 });
  const demand = { instrumentId: 'US:AAA', fieldGroup: 'price', asOfBucket: '2026-08-12T00', priority: 1, reason: 'stale' };
  assert(planner.enqueue(demand).accepted && planner.enqueue(demand).deduped, 'G-SCR-REFRESH: duplicate refresh demand is deduped');
  const planned = planner.plan({ providerId: 'fixture-provider', limit: 3 });
  assert(planned.length === 1 && planned[0].idempotencyKey, 'G-SCR-REFRESH: budget and idempotency are bounded');
  planner.resetBudget();
  assert(planner.plan({ providerId: 'fixture-provider' }).length === 0, 'G-SCR-REFRESH: in-flight demand is not scheduled twice');
  const failed = planner.acknowledge(planned[0], { providerId: 'fixture-provider', reason: 'timeout', lkgObservedAt: '2026-08-11T00:00:00.000Z' });
  assert(failed.status === 'retry' && planner.snapshot().queued[0].lkgObservedAt, 'G-SCR-REFRESH: retry and last-known-good are retained');
  planner.acknowledge(planned[0], { providerId: 'fixture-provider', reason: 'rights blocked' });
  planner.resetBudget();
  assert(planner.plan({ providerId: 'fixture-provider' }).length === 0, 'G-SCR-REFRESH: terminal blocked demand is not rescheduled');
  const boundedPlanner = createRefreshPlanner({ budget: { maxItems: 1, maxPerProvider: 10 } });
  boundedPlanner.enqueue({ instrumentId: 'US:A', fieldGroup: 'price', asOfBucket: 'a' });
  boundedPlanner.enqueue({ instrumentId: 'US:B', fieldGroup: 'price', asOfBucket: 'b' });
  assert(boundedPlanner.plan({ limit: NaN }).length === 1, 'G-SCR-REFRESH: malformed limit must not bypass the global budget');

  const sec = selectProviderForField({ catalog: DEFAULT_SCREENER_CAPABILITY_CATALOG, fieldId: 'quality.roe', market: 'US', preferred: ['sec-edgar'] });
  const delayed = selectProviderForField({ catalog: DEFAULT_SCREENER_CAPABILITY_CATALOG, fieldId: 'price.close', market: 'US', preferred: ['aio-yahoo-eod'] });
  assert(sec?.providerId === 'sec-edgar' && delayed?.providerId === 'aio-yahoo-eod', 'G-SCR-CAPABILITY: provider selection is capability-based');
  const currentA = observationFromProvider({ provider: sec, instrumentId: 'US:AAA', fieldId: 'quality.roe', value: 10, unit: 'percent', observedAt: '2026-08-12T00:00:00.000Z', fetchedAt: '2026-08-12T00:01:00.000Z', revisionId: 'r1', qualityStatus: 'CURRENT', rightsId: 'VERIFIED' });
  const currentB = observationFromProvider({ provider: sec, instrumentId: 'US:AAA', fieldId: 'quality.roe', value: 20, unit: 'percent', observedAt: '2026-08-12T00:00:00.000Z', fetchedAt: '2026-08-12T00:01:00.000Z', revisionId: 'r2', qualityStatus: 'CURRENT', rightsId: 'VERIFIED' });
  assert(reconcileFieldObservations([currentA, currentB], { tolerance: 1 }).status === 'CONFLICT', 'G-SCR-RECON: divergent observations fail closed');
  const wrongUnit = { ...currentB, value: 10, unit: 'ratio' };
  const wrongEpoch = { ...currentB, value: 10, observedAt: '2026-08-13T00:00:00.000Z' };
  assert(reconcileFieldObservations([currentA, wrongUnit], { tolerance: 1 }).reason === 'incompatible_observation_dimensions' && reconcileFieldObservations([currentA, wrongEpoch], { tolerance: 1 }).reason === 'observation_epochs_incompatible', 'G-SCR-RECON: unlike units or observation epochs cannot be reconciled as one fact');

  const baseInputs = { trendScore: 1, breadthScore: 100, volatilityScore: 100, creditScore: 1, rotationScore: 1 };
  const on = deriveRegimeState({ inputs: baseInputs, now: Date.parse('2026-08-01T00:00:00.000Z'), minHoldMs: 0 });
  const held = deriveRegimeState({ inputs: { trendScore: -1, breadthScore: 0, volatilityScore: 0, creditScore: -1, rotationScore: -1 }, previous: on, now: Date.parse('2026-08-02T00:00:00.000Z') });
  const replay = replayRegime({ history: [{ now: Date.parse('2026-08-01T00:00:00.000Z'), inputs: baseInputs }, { now: Date.parse('2026-08-02T00:00:00.000Z'), inputs: baseInputs }, { now: Date.parse('2026-08-04T00:00:00.000Z'), inputs: { trendScore: -1, breadthScore: 0, volatilityScore: 0, creditScore: -1, rotationScore: -1 } }] });
  assert(on.state === 'RISK_ON' && held.state === 'RISK_ON' && replay.autoWeightPromotion === false, 'G-SCR-REGIME: confidence/hysteresis/replay keep auto weight promotion disabled');
  const futurePrevious = deriveRegimeState({ inputs: { trendScore: -1, breadthScore: 0, volatilityScore: 0, creditScore: -1, rotationScore: -1 }, previous: { ...on, observedAt: '2026-09-01T00:00:00.000Z' }, now: Date.parse('2026-08-02T00:00:00.000Z') });
  assert(futurePrevious.hysteresisState === 'eligible-to-transition' && futurePrevious.state === 'NEUTRAL', 'G-SCR-REGIME: a future previous timestamp cannot freeze the current regime');
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
    observations: [{ instrumentId: 'US:AAA', observedAt: '2026-08-11T00:00:00.000Z', availableAt: '2026-08-11T01:00:00.000Z' }],
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
  const temporalFixture = {
    asOf: '2026-08-12', universe: [{ availableAt: '2026-08-01', validFrom: '2020-01-01', turnover: 0, liquidity: 100, costBps: 0 }],
    benchmark: { symbol: 'SPY' }, costs: 0, liquidity: 100, liveDefinitionHash: 'same', backtestDefinitionHash: 'same'
  };
  const future = validatePITRun({ ...temporalFixture, observations: [{ instrumentId: 'US:AAA', observedAt: '2027-01-01', availableAt: '2027-01-02' }] });
  const unavailableTime = validatePITRun({ ...temporalFixture, observations: [{ instrumentId: 'US:AAA', observedAt: '2026-08-01' }] });
  const lateFiling = validatePITRun({ ...temporalFixture, observations: [{ instrumentId: 'US:AAA', observedAt: '2026-08-01', availableAt: '2026-08-13' }] });
  assert(!future.ok && !unavailableTime.ok && !lateFiling.ok, 'G-SCR-PIT: future observations and unknown/late availability fail even when universe and costs pass');
  assert(reviewDecision.promotionReviewReady && reviewDecision.promoted === false && reviewDecision.autoWeightPromotion === false, 'G-SCR-PROMOTION: ready evidence still requires human review and keeps auto promotion disabled');
  const outcomes = OUTCOME_HORIZONS.map((horizon) => calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon, entry: { value: 100, observedAt: '2026-08-12T00:00:00.000Z' }, exit: { value: 105, low: 98, observedAt: '2026-08-20T00:00:00.000Z' }, benchmarkEntry: { value: 100 }, benchmarkExit: { value: 102 }, costBps: 15 }));
  assert(outcomes.length === 4 && outcomes.every((outcome) => outcome.status === 'observed' && outcome.costsApplied), 'G-SCR-OUTCOME: T+1/5/21/63 outcomes carry cost flags');
  assert(outcomes.every((outcome) => Math.abs(outcome.rawReturn - 5) < 1e-9 && Math.abs(outcome.netReturn - 4.85) < 1e-9), 'G-SCR-OUTCOME: gross and cost-adjusted returns must remain distinct');
  const zeroCostOutcome = calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon: 'T+1', entry: { value: 100, observedAt: '2026-08-12T00:00:00.000Z' }, exit: { value: 105, observedAt: '2026-08-13T00:00:00.000Z' }, costBps: 0 });
  const missingCostOutcome = calculateOutcome({ runId: result.run.runId, instrumentId: 'US:AAA', horizon: 'T+1', entry: { value: 100 }, exit: { value: 105 } });
  assert(zeroCostOutcome.status === 'observed' && zeroCostOutcome.costsApplied && missingCostOutcome.status === 'unavailable' && missingCostOutcome.liquidityFlags.includes('transaction_cost_missing'), 'G-SCR-COST: explicit zero cost is modeled while missing cost is unavailable');
  const endpointFixture = { runId: 'endpoint', instrumentId: 'US:AAA', horizon: 'T+1', entry: { value: 100, observedAt: '2026-08-28' }, exit: { value: 105, low: 98, observedAt: '2026-08-31' }, costBps: 0 };
  const missingBenchmark = calculateOutcome({ ...endpointFixture, benchmarkEntry: { value: 100 }, benchmarkExit: { value: null } });
  assert(missingBenchmark.benchmarkReturn === null && missingBenchmark.maxDrawdown === null, 'G-SCR-OUTCOME: missing benchmark and missing price path do not fabricate return or drawdown');
  assert(calculateOutcome({ ...endpointFixture, exit: { value: 105, observedAt: '2026-08-27' } }).status === 'unavailable', 'G-SCR-OUTCOME: exit cannot precede entry');
  assert(expectedExitDate('2026-08-28', 'T+1') === null
    && expectedExitDate('2026-08-28', 'T+1', { sessionDates: ['2026-08-28', '2026-08-31'] }) === '2026-08-31T00:00:00.000Z',
  'G-SCR-OUTCOME: T+n uses explicit sessions and stays unavailable without a calendar');

  const artifact = readJson('public-data/screener.json');
  const model = readJson('public-data/model-validation-status.json');
  const validationGate = readJson('public-data/screener-validation-gate.json');
  const artifactRows = Object.values(artifact.data || {});
  const factorRows = artifactRows.filter((row) => Number.isFinite(Number(row?.ret1m)) || Number.isFinite(Number(row?.rsi)));
  const expectedFundamentalCoverage = artifact.fundamentalCoverageDenominator > 0
    ? Math.round((Number(artifact.fundamentalCount || 0) / artifact.fundamentalCoverageDenominator) * 1000) / 10 : 0;
  assert(artifact.universe === 873
    && artifact.ok === artifactRows.length
    && factorRows.length === artifactRows.length
    && artifact.ok >= Math.ceil(artifact.universe * 0.8)
    && artifact.fundamentalCoveragePct === expectedFundamentalCoverage,
  'SCR-OS-00: published baseline is self-consistent and keeps 80%+ factor coverage', {
    universe: artifact.universe,
    ok: artifact.ok,
    rows: artifactRows.length,
    factorRows: factorRows.length,
    fundamentalCoveragePct: artifact.fundamentalCoveragePct,
    expectedFundamentalCoverage
  });
  assert(model.status === 'BLOCKED' && model.pointInTimeUniverse === false && model.transactionCostsModeled === false, 'G-SCR-09: model validation remains explicitly blocked');
  assert(validationGate.status === 'BLOCKED' && validationGate.pointInTimeUniverse === false, 'G-SCR-09: persistent validation gate is fail-closed');
  const contextCatalog = JSON.parse(fs.readFileSync(path.join(root, '_context/CONTEXT-CATALOG.json'), 'utf8'));
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const provider = fs.readFileSync(path.join(root, 'src/data/providers/screener.js'), 'utf8');
  assert(contextCatalog.documents?.some((doc) => doc.path === '_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md' && doc.readPolicy === 'targeted'), 'G-SCR-DOCS: handoff remains catalogued for targeted reads');
  assert(page.includes('scr-definition-editor') && page.includes('scr-readiness-preview') && page.includes('scr-run-history') && page.includes('scr-outcome-lab'), 'G-SCR-UI: workbench adapter controls are present');
  const screenerUi = fs.readFileSync(path.join(root, 'src/ui/pages/screener.js'), 'utf8');
  const screenerOrchestrator = fs.readFileSync(path.join(root, 'src/data/orchestrators/screener.js'), 'utf8');
  assert(provider.includes('buildFieldReadiness') && provider.includes('fieldObservations'), 'G-SCR-PIPELINE: provider emits field-level readiness and observations');
  assert(provider.includes('rightsByField') && provider.includes('resolveFieldRights') && provider.includes('sourceKindByField'), 'G-SCR-RIGHTS: provider resolves explicit rights/source kind per field before readiness');
  assert(screenerUi.includes('screener-visible-quotes') && screenerUi.includes('registerLiveSymbol'), 'G-SCR-LIVE: rendered screener rows register bounded live-quote demand');
  assert(page.includes('screener-factor-confidence') && page.includes('screener-factor-diagnostics') && screenerUi.includes('미래 수익률 확률 아님') && screenerUi.includes('dataset.decisionEligible'), 'G-SCR-FACTOR-UX: confidence and research-only diagnostics are visible and cannot masquerade as return probability');
  assert(['factorCoverage', 'confidenceMeaning', 'sectorNeutrality', 'outlierDiagnostics', 'turnoverStability', 'researchBoundary'].every((field) => screenerOrchestrator.includes(field)), 'G-SCR-FACTOR-LINEAGE: factor diagnostics survive ranker-to-UI metadata projection');

  const providerArtifact = {
    asOf: '2026-08-25T12:00:00.000Z',
    factorObservedAt: '2026-08-25T11:00:00.000Z',
    source: 'github-actions:yahoo-1y',
    universe: 1,
    data: {
      AAA: {
        ret1m: 1,
        ret3m: 2,
        ret6m: 3,
        vol: 10,
        rsi: 50,
        roe: 12,
        margin: 10,
        revGrowth: 8,
        observedAt: '2026-08-25T11:00:00.000Z',
        source: 'Yahoo chart 1y adjusted-close history',
        sourceKind: 'delayed-eod',
        allowedUse: 'research-relative-ranking-only',
        fundamentalSource: 'SEC EDGAR companyfacts',
        fundamentalModel: 'sec-fy-normalized-v2',
        fundamentalObservedAt: '2026-08-20T00:00:00.000Z',
        fundamentalFiledAt: '2026-08-19T00:00:00.000Z',
        fundamentalFetchedAt: '2026-08-25T11:00:00.000Z'
      }
    }
  };
  const providerUniverse = {
    meta: { currentness: 'CURRENT', lastBulkUpdate: '2026-08-25T00:00:00.000Z', staleAfterDays: 30 },
    universe: [{ sym: 'AAA', name: 'Fixture Corp', sector: 'Technology', index: 'NASDAQ100' }]
  };
  const artifactProvider = createScreenerProvider({
    httpClient: {
      requestJson: async (requestUrl) => requestUrl.includes('screener-universe')
        ? { ok: true, data: providerUniverse }
        : { ok: true, data: providerArtifact }
    },
    clock: { now: () => Date.parse('2026-08-26T00:00:00.000Z'), iso: () => '2026-08-26T00:00:00.000Z' }
  });
  const providerOutput = await artifactProvider.readCurrent();
  const changedOutput = await createScreenerProvider({ httpClient: { requestJson: async url => ({ ok: true, data: url.includes('screener-universe') ? providerUniverse : { ...providerArtifact, data: { AAA: { ...providerArtifact.data.AAA, ret3m: 99 } } } }) }, clock: { now: () => Date.parse('2026-08-26T00:00:00Z') } }).readCurrent();
  assert(changedOutput.revision === providerOutput.revision && changedOutput.snapshotId !== providerOutput.snapshotId, 'G-SCR-SNAPSHOT: different field values cannot reuse a revision-only snapshot identity');
  const providerReadiness = providerOutput.rows[0]?.fieldReadiness;
  const providerStatuses = Object.values(providerReadiness?.fields || {}).map((field) => field.status);
  assert(providerOutput.rows.length === 1 && providerStatuses.some((status) => status !== 'BLOCKED_RIGHTS'), 'G-SCR-RIGHTS: provider fixture does not turn every populated readiness field into BLOCKED_RIGHTS', { statuses: providerStatuses });
  assert(providerReadiness?.fields?.['identity.symbol']?.status !== 'BLOCKED_RIGHTS' && providerReadiness?.fields?.['quality.roe']?.status !== 'BLOCKED_RIGHTS' && providerReadiness?.fields?.['quality.roe']?.rightsId === 'VERIFIED' && providerReadiness?.observations?.some((observation) => observation.fieldId === 'quality.roe' && observation.rightsId === 'VERIFIED'), 'G-SCR-RIGHTS: identity and SEC fundamental fields preserve verified rights', providerReadiness?.fields?.['quality.roe']);

  const readFixture = async ({ artifact = providerArtifact, now = '2026-09-10T00:00:00Z', ok = true } = {}) => createScreenerProvider({
    httpClient: { requestJson: async url => url.includes('screener-universe') ? { ok: true, data: providerUniverse } : { ok, data: artifact } },
    clock: { now: () => Date.parse(now) }
  }).readCurrent();
  const oldOutput = await readFixture();
  const oldRow = oldOutput.rows[0];
  const numericFilterDocument = id => ({ getElementById: key => ({ value: key === id ? '0' : '', checked: false }) });
  assert(filterRows([oldRow], numericFilterDocument('scr-rsi-min')).length === 0
    && filterRows([oldRow], numericFilterDocument('scr-min-mom')).length === 0, 'G-SCR-DISPLAY: visible stale RSI/return cannot satisfy table calculation filters');
  assert(oldOutput.rows.length === 1 && oldOutput.status === 'partial' && oldOutput.metadata.warnings.includes('SCREENER_ARTIFACT_STALE'), 'G-SCR-DISPLAY: stale artifacts retain identifiable rows and an explicit warning');
  assert(fieldValueForPurpose(oldRow, 'price.ret3m') === 2 && calculationRow(oldRow).ret3m === null && calculationRow(oldRow).roe === 12, 'G-SCR-DISPLAY: stale price factors are reference-visible while fresh fundamentals remain independently calculable');
  const identityOnly = await readFixture({ ok: false });
  assert(identityOnly.rows[0]?.symbol === 'AAA' && identityOnly.rows[0]?.ret3m === null && identityOnly.metadata.artifactFreshnessStatus === 'missing', 'G-SCR-DISPLAY: factor request failure preserves the independently fetched universe');
  const newerRow = await readFixture({ artifact: { ...providerArtifact, data: { AAA: { ...providerArtifact.data.AAA, observedAt: '2026-09-09T20:00:00Z' } } } });
  assert(newerRow.metadata.artifactFreshnessStatus === 'stale' && calculationRow(newerRow.rows[0]).ret3m === 2, 'G-SCR-TIME: old file generation cannot invalidate a independently fresh field observation');
  const futureRow = await readFixture({ artifact: { ...providerArtifact, data: { AAA: { ...providerArtifact.data.AAA, observedAt: '2027-01-01T00:00:00Z' } } } });
  assert(futureRow.rows[0].fieldReadiness.fields['price.ret3m'].status === 'STALE' && calculationRow(futureRow.rows[0]).ret3m === null, 'G-SCR-TIME: future observations never become fresh through a clamped age');
  const restricted = await readFixture({ now: '2026-08-26T00:00:00Z', artifact: { ...providerArtifact, rightsByField: { 'price.ret3m': 'BLOCKED' } } });
  assert(restricted.rows[0].fieldReadiness.fields['price.ret3m'].status === 'BLOCKED_RIGHTS' && fieldValueForPurpose(restricted.rows[0], 'price.ret3m') === null && calculationRow(restricted.rows[0]).ret3m === null, 'G-SCR-RIGHTS: explicit denial is preserved instead of reverting to public-feed defaults');
  const capDocument = value => ({ getElementById: id => ({ value: id === 'scr-cap' ? value : '', checked: false }) });
  const currencyProvider = createScreenerProvider({
    httpClient: { requestJson: async url => ({ ok: true, data: url.includes('screener-universe')
      ? { ...providerUniverse, universe: [...providerUniverse.universe, { sym: '005930.KS', name: 'KR fixture', index: 'KOSPI' }, { sym: 'MISMATCH', name: 'Currency conflict fixture', index: 'NASDAQ100' }] }
      : { ...providerArtifact, data: { ...providerArtifact.data, '005930.KS': { ...providerArtifact.data.AAA, currency: 'KRW', dollarVolume30d: 20e9, dollarVolume: 10e9 }, MISMATCH: { ...providerArtifact.data.AAA, price: 100, currency: 'USD' } } } }) },
    readLiveData: () => ({
      AAA: { price: 10, marketCap: 2e9, currency: 'USD', observedAt: providerArtifact.factorObservedAt },
      '005930.KS': { price: 70000, marketCap: 200e12, currency: 'KRW', observedAt: providerArtifact.factorObservedAt },
      MISMATCH: { price: 70000, currency: 'KRW', observedAt: '2026-08-25T23:00:00Z' }
    }),
    clock: { now: () => Date.parse('2026-08-26T00:00:00Z') }
  });
  const currencyRows = (await currencyProvider.readCurrent()).rows;
  const krCurrency = currencyRows.find(row => row.sym === '005930.KS');
  const usdCurrency = currencyRows.find(row => row.sym === 'AAA');
  const conflictCurrency = currencyRows.find(row => row.sym === 'MISMATCH');
  assert(krCurrency.mcap === null && krCurrency.nativeMarketCap.value === 200e12 && krCurrency.nativeMarketCap.currency === 'KRW', 'G-SCR-UNITS: keep native KRW observation without relabelling it as USD market cap');
  assert(krCurrency.dollarVolume30d === null && krCurrency.dollarVolume === null && usdCurrency.mcap === 2, 'G-SCR-UNITS: unconverted liquidity cannot pass dollar gates; actual USD observations remain usable');
  assert(usdCurrency.instrumentRef.mic === null && usdCurrency.instrumentRef.assetType === null, 'G-SCR-IDENTITY: index membership does not manufacture listing venue or asset type');
  assert(conflictCurrency.price === 100 && conflictCurrency.instrumentRef.currency === 'USD' && conflictCurrency.priceCurrencyConflict === true, 'G-SCR-UNITS: a newer quote in a conflicting currency cannot replace the artifact price');
  const noCurrency = await createScreenerProvider({
    httpClient: { requestJson: async url => ({ ok: true, data: url.includes('screener-universe') ? providerUniverse : { ...providerArtifact, data: { AAA: { ...providerArtifact.data.AAA, currency: null, dollarVolumeCurrency: null } } } }) },
    readLiveData: () => ({}),
    clock: { now: () => Date.parse('2026-08-26T00:00:00Z') }
  }).readCurrent();
  assert(noCurrency.rows[0].instrumentRef.currency === null && noCurrency.rows[0].dollarVolume30d === null, 'G-SCR-UNITS: an unlabeled historical amount cannot be promoted to USD by market inference');
  let liveReads = 0;
  const oneSnapshotProvider = createScreenerProvider({
    httpClient: { requestJson: async url => ({ ok: true, data: url.includes('screener-universe') ? providerUniverse : providerArtifact }) },
    readLiveData: () => { liveReads++; return {}; },
    clock: { now: () => Date.parse('2026-08-26T00:00:00Z') }
  });
  await oneSnapshotProvider.readCurrent();
  assert(liveReads === 1, 'G-SCR-SNAPSHOT: one provider read uses one coherent live-data snapshot');
  assert(filterRows([krCurrency], capDocument('MEGA')).length === 0, 'G-SCR-UNITS: native currency display cannot satisfy USD cap filter');
  assert(filterRows([{ sym: 'MISSING', mcap: null }, { sym: 'SMALL', mcap: 1 }], capDocument('SMALL')).map(row => row.sym).join(',') === 'SMALL', 'G-SCR-FILTER: missing market cap does not become a small cap');
  assert(filterRows([{ sym: 'BOUNDARY', mcap: 10 }], capDocument('MID')).length === 0, 'G-SCR-FILTER: market-cap buckets do not overlap at 10 billion');

  const report = { schemaVersion: 'screener-workbench-ci.v1', generatedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : 'PASS', checks, failures, baseline: { universe: artifact.universe, ok: artifact.ok, fundamentalCoveragePct: artifact.fundamentalCoveragePct }, fieldRegistry: registryCheck.size, presetCount: presetsA.length };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

run().catch((error) => {
  process.stderr.write(`screener workbench contract check crashed: ${error?.stack || error}\n`);
  process.exitCode = 1;
});
