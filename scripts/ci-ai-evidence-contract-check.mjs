#!/usr/bin/env node
// AI evidence contracts. v58.84 gate consolidation: the sections below were separate gates until v58.84. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('ai-evidence', [
// ── section premise (was ci-ai-premise-check.mjs) ──
['premise', async () => {
const { default: assert } = await import('node:assert/strict');
const { evaluateDirectionalPremise, createQuestionPremise } = await import('../src/ai/orchestrator/premise.js');
const { createQuestionPlan } = await import('../src/ai/orchestrator/question-planner.js');

const now = new Date('2026-09-08T21:00:00Z');
const period = { start: '2026-09-07T20:00:00Z', end: '2026-09-08T20:00:00Z' };
const assertion = { entityId: 'NVDA', metricId: 'price-change-pct', unit: '%', timeframe: 'session', period, direction: 'down' };
const row = {
  ...assertion,
  value: -2,
  observedAt: period.end,
  source: 'fixture-exchange',
  sourceKind: 'exchange',
  evidenceId: 'fixture:nvda-change',
  status: 'verified',
  allowedUse: 'decision',
  allowedUseCeiling: 'decision',
  currentClaim: true,
  claimUse: 'current-claim',
  qualityStatus: 'CURRENT',
  quality: { status: 'CURRENT' },
  freshnessStatus: 'fresh',
  freshnessMs: 24 * 60 * 60 * 1000,
  revisionId: 'fixture-revision-2026-09-08',
  rightsId: 'fixture-rights-verified'
};
const evaluate = (rows, overrides = {}) => evaluateDirectionalPremise({ ...assertion, ...overrides }, rows, { now });
assert.equal(evaluate([]).status, 'UNVERIFIED');
assert.equal(evaluate([row]).status, 'VERIFIED');
assert.equal(evaluate([{ ...row, sourceKind: 'T1_OFFICIAL' }]).status, 'VERIFIED');
assert.equal(evaluate([{ ...row, sourceKind: 'licensed-api' }]).status, 'VERIFIED');
assert.equal(evaluate([{ ...row, sourceKind: 'delayed-eod' }]).status, 'UNVERIFIED');
assert.equal(evaluate([{ ...row, allowedUse: 'reference' }]).status, 'UNVERIFIED');
assert.equal(evaluate([{ ...row, currentClaim: false }]).status, 'UNVERIFIED');
assert.equal(evaluate([{ ...row, qualityStatus: 'unknown' }]).status, 'UNVERIFIED');
assert.equal(evaluate([{ ...row, freshnessStatus: 'stale' }]).status, 'UNVERIFIED');
// v58.63 (architecture audit C2): the old case kept freshnessMs (which wins) and moved observedAt out of the period, so it
// failed for the period and never exercised the SLA. Only the SLA changes here, once on each field name.
assert.equal(evaluate([{ ...row, freshnessMs: 1 }]).status, 'UNVERIFIED', 'v58.63 C2 an expired freshness SLA alone must unverify the premise');
{ const { freshnessMs: _sla, ...aliasRow } = row; assert.equal(evaluate([{ ...aliasRow, freshnessMaxAgeMs: 1 }]).status, 'UNVERIFIED', 'v58.63 C2 the freshnessMaxAgeMs alias applies when freshnessMs is absent'); }
assert.equal(evaluate([{ ...row, freshnessMs: 2 * 60 * 60 * 1000 }]).status, 'VERIFIED', 'v58.63 C2 positive control: an SLA the observation meets keeps it verified');
assert.equal(evaluate([{ ...row, value: 2 }]).status, 'CONTRADICTED');
assert.equal(evaluate([{ ...row, value: 0 }]).observedDirection, 'flat');
assert.equal(evaluate([{ ...row, value: 0 }]).status, 'CONTRADICTED');
assert.equal(evaluate([row, { ...row, evidenceId: 'other', value: 2 }]).status, 'CONFLICT');
for (const value of [NaN, Infinity, -Infinity, '-2', null, -101]) assert.equal(evaluate([{ ...row, value }]).status, 'UNVERIFIED');
for (const patch of [
  { entityId: 'AMD' }, { metricId: 'price' }, { unit: 'USD' }, { timeframe: 'week' },
  { period: { ...period, start: '2026-09-06T20:00:00Z' } }, { period: null },
  { observedAt: 'invalid' }, { observedAt: '2026-09-09T00:00:00Z' },
  { observedAt: period.start }, { status: 'stale' }, { sourceKind: 'REFERENCE' },
  { sourceKind: '' }, { sourceKind: null }, { sourceKind: undefined }, { sourceKind: 'made-up-provider' },
  { evidenceId: '' }, { source: '' }
]) assert.equal(evaluate([{ ...row, ...patch }]).status, 'UNVERIFIED', JSON.stringify(patch));
assert.equal(evaluate([row], { timeframe: 'unspecified' }).status, 'UNVERIFIED');
assert.equal(evaluate([row], { period: null }).status, 'UNVERIFIED');
assert.equal(evaluate([row], { metricId: 'price' }).status, 'UNVERIFIED');
const mutablePeriod = { ...period };
const defensiveResult = evaluate([row], { period: mutablePeriod });
mutablePeriod.end = '2030-01-01T00:00:00Z';
assert.equal(defensiveResult.period.end, period.end);
assert.ok(Object.isFrozen(defensiveResult.period));
assert.throws(() => { defensiveResult.period.start = '2030-01-01T00:00:00Z'; }, TypeError);
const inputs = { now, root: {}, premiseEvidence: [row], premisePeriod: period };
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 하락 중인데 왜 그래?' }).premise.status, 'VERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '지금 NVDA 하락 중인데 왜 그래?' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 상승 중인데 왜 그래?' }).premise.status, 'CONTRADICTED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 반도체 하락 중인데 왜 그래?', premiseEvidence: [{ ...row, entityId: 'SMH' }] }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA와 AMD 하락 중인데 왜 그래?' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPlan({ ...inputs, query: 'NVDA가 하락하면 어떻게 해?' }).premise.status, 'NONE');
assert.equal(createQuestionPlan({ ...inputs, query: '오늘 NVDA 상승 하락 이유' }).premise.status, 'UNVERIFIED');
assert.equal(createQuestionPremise({ query: '오늘 시장은?', assertions: [assertion], evidence: [row], now }).status, 'VERIFIED');
console.log('PASS ai-premise: observed direction, zero, conflict, tuple identity, malformed evidence, unknown timeframe, proxy and planner integration');
}],
// ── section analysis-evidence (was ci-ai-analysis-evidence-check.mjs) ──
['analysis-evidence', async () => {
const { default: assert } = await import('node:assert/strict');
const { createAIAnswerOrchestrator } = await import('../src/ai/orchestrator/answer-orchestrator.js');
const { buildEvidenceAnalysisInputs } = await import('../src/ai/analysis/evidence-inputs.js');

const ai = createAIAnswerOrchestrator({ now: () => new Date('2026-09-10T12:00:00Z') });
const plan = (intent) => ({ intent: { primary: intent }, entities: { entities: [{ symbol: 'NVDA' }] } });
const row = (metric, value, extra = {}) => {
  const defaultAsOf = '2026-09-10T10:00:00Z';
  const asOf = Object.prototype.hasOwnProperty.call(extra, 'asOf') ? extra.asOf : defaultAsOf;
  return {
    evidenceId: `test:${metric}`,
    metric,
    entity: 'NVDA',
    value,
    unit: 'USD',
    asOf,
    observedAt: Object.prototype.hasOwnProperty.call(extra, 'observedAt') ? extra.observedAt : asOf,
    fetchedAt: '2026-09-10T10:05:00Z',
    source: 'fixture-provider',
    sourceKind: 'T3_PUBLIC_DELAYED',
    status: 'verified',
    rightsId: 'FIXTURE-RIGHTS-V1',
    revisionId: 'fixture-revision-v1',
    quality: { status: 'CURRENT', stale: false, blocked: false, maxAgeMs: 24 * 60 * 60 * 1000 },
    freshnessMs: 24 * 60 * 60 * 1000,
    allowedUse: 'reference',
    allowedUseCeiling: 'reference',
    scale: 'raw',
    ...extra
  };
};
const run = (intent, evidence) => ai.buildAnalysisContext(plan(intent), { evidence });
const company = run('ENTITY_ANALYSIS', [row('price', 100)]);
assert.equal(company.result.facts[0].value, 100);
assert.equal(company.result.quality.score, null);
assert.equal(company.result.valuation.percentile, null);
assert.equal(company.audit.currentClaimEligible, false);
assert.match(company.context, /reference-only/);
const conditions = run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90)]);
assert.equal(conditions.result.conditions[0].value, 10);
assert.equal(conditions.result.conditions[0].status, 'above');
assert.equal(run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90, { asOf: '2026-09-09T10:00:00Z' })]).result.status, 'insufficient');
assert.equal(run('TECHNICAL_ANALYSIS', [row('price', 100), row('sma20', 90, { unit: 'KRW' })]).result.status, 'insufficient');
assert.equal(run('ENTITY_FACT', [row('price', 100, { entity: undefined, entityId: 'NVDA' })]).result.facts[0].value, 100);
assert.equal(buildEvidenceAnalysisInputs(plan('ENTITY_FACT'), { evidence: [row('price', 100, { sourceKind: 'T1_OFFICIAL' })], now: Date.parse('2026-09-10T12:00:00Z') }).inputs.facts.price.sourceTier, 'T1_OFFICIAL');
assert.equal(buildEvidenceAnalysisInputs(plan('ENTITY_FACT'), { evidence: [row('price', 100, { sourceKind: 'delayed-eod' })], now: Date.parse('2026-09-10T12:00:00Z') }).inputs.facts.price.sourceTier, 'T3_PUBLIC_DELAYED');
for (const bad of [{ sourceKind: 'IMAGINARY' }, { status: 'stale' }, { asOf: null }, { unit: '' }, { value: '100' }, { scale: 'million' }, { asOf: '2026-09-11T10:00:00Z' }]) {
  assert.equal(run('ENTITY_FACT', [row('price', 100, bad)]).result.status, 'insufficient');
}
const conflict = run('ENTITY_FACT', [row('price', 100), row('price', 101, { evidenceId: 'other' })]);
assert.equal(conflict.result.status, 'insufficient');
assert.equal(conflict.audit.rejected.length, 2);
for (const mutation of [{ entity: 'AAPL' }, { metric: 'revenue' }, { value: 101 }, { asOf: '2026-09-09T10:00:00Z' }, { unit: 'KRW' }]) {
  const result = run('ENTITY_FACT', [row('price', 100), row('price', 100, mutation)]);
  assert.equal(result.result.status, 'insufficient');
  assert.equal(result.audit.rejected.filter((r) => r.reason === 'evidence-id-conflict').length, 2);
}
for (const intent of ['MARKET_CAUSAL', 'SECTOR_ANALYSIS']) assert.equal(run(intent, [row('price', 100)]).result.status, 'insufficient');
const fx = run('FX_ANALYSIS', [row('market.fx.usdkrw', 1350, { entity: 'KRW=X', unit: 'KRW/USD' })]);
assert.equal(fx.result.status, 'partial');
assert.equal(fx.result.fx['KRW=X:market.fx.usdkrw'].value, 1350);
assert.deepEqual(fx.result.transmissionEdges, []);
assert.equal(run('EDUCATION', []).context, '');
const original = { ...plan('ENTITY_FACT'), query: 'NVDA', currentSensitive: true };
const enriched = ai.withPremiseEvidence(original, { evidence: [] });
assert.ok(enriched.premise);
assert.equal(original.premise, undefined);
assert.ok(Object.isFrozen(enriched));
console.log('PASS AI analysis evidence adapter: typed mapping, conflicts, time/unit isolation, missing-input boundaries, premise API');
}],
// ── section quote-evidence (was ci-ai-quote-evidence-check.mjs) ──
['quote-evidence', async () => {
const answerPublication = await import('../src/ai/response/publication.js');
const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { default: vm } = await import('node:vm');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');

const helperStart = core.indexOf('var _AIO_CLAIM_SCHEMA_VERSION');
const helperEnd = core.indexOf('function _aioClaimEvidenceList', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'quote evidence helper slice is present');

const sandbox = {
  window: { AIO: {} },
  console,
  Date,
  Number,
  String,
  Object,
  Array,
  Math,
  isFinite,
  URL
};
vm.runInNewContext(core.slice(helperStart, helperEnd), sandbox, { filename: 'js/aio-core.js#quote-evidence' });
const AIO = sandbox.window.AIO;
assert.equal(typeof AIO.buildAIQuoteEvidenceRow, 'function', 'canonical quote evidence helper is exposed');
assert.equal(typeof AIO.normalizeAIChatEvidenceRow, 'function', 'chat evidence normalizer remains exposed');

const normalizeBlock = core.slice(core.indexOf('window.AIO.normalizeAIChatEvidenceRow'), core.indexOf('function _aioClaimEvidenceList'));
assert.doesNotMatch(normalizeBlock, /input\.fetchedAt\s*\|\|\s*input\.generatedAt/, 'chat normalization cannot use fetch/generation time as observation');
assert.doesNotMatch(normalizeBlock, /input\.sourceTs/, 'chat normalization cannot substitute a source/collection timestamp for observation');
assert.doesNotMatch(normalizeBlock, /source\s*\?\s*['"]LIVE['"]/, 'arbitrary source cannot be promoted to LIVE');
assert.match(core, /window\.AIO\.buildAIQuoteEvidenceRow\s*=\s*function/, 'shared quote evidence producer exists');
assert.match(core.slice(core.indexOf('window.AIO.getChatEvidenceContext')), /buildAIQuoteEvidenceRow/, 'chat evidence context consumes the shared producer');

const freshnessStart = data.indexOf('window.AIO.getChatAnswerFreshnessAudit');
const freshnessEnd = data.indexOf('window.AIO.ensureFreshChatAnswerData', freshnessStart);
assert.ok(freshnessStart >= 0 && freshnessEnd > freshnessStart, 'freshness audit slice is present');
const freshness = data.slice(freshnessStart, freshnessEnd);
assert.match(freshness, /buildAIQuoteEvidenceRow/, 'freshness audit consumes the shared producer');
assert.doesNotMatch(freshness, /_aioTickerQuoteAgeMs\(t\)/, 'freshness age is based on quote observation, not fetch cache age');

const producerStart = data.indexOf('function _aioNormalizeAtomicQuote');
const producerEnd = data.indexOf('function _aioAtomicSourceRank', producerStart);
const producer = data.slice(producerStart, producerEnd);
assert.match(producer, /_atomicObservedAt/, 'atomic producer preserves observation timestamp');
const applyStart = data.indexOf('function applyLiveQuotes');
const applyEnd = data.indexOf('function ', data.indexOf('window._dataSource[q.symbol]', applyStart));
const apply = data.slice(applyStart, applyEnd > applyStart ? applyEnd : applyStart + 24000);
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1000}price:\s*price/, 'live quote envelope preserves price');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1200}observedAt:\s*q\._atomicObservedAt/, 'live quote envelope preserves observation time');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1400}currency:\s*_quoteCurrency/, 'live quote envelope preserves upstream currency');
assert.match(apply, /quoteEnvelope:\s*\{[\s\S]{0,1400}unit:\s*_quoteUnit/, 'live quote envelope preserves quote unit');

const observedAt = new Date(Date.now() - 30 * 1000).toISOString();
const truth = { status: 'verified', decisionUse: true, issues: [], warnings: [] };
const quote = {
  ticker: 'AAPL',
  price: 197.25,
  currency: 'USD',
  quoteEnvelope: {
    revision: 'fixture-revision',
    source: 'live:yahoo-v7-batch',
    price: 197.25,
    currency: 'USD',
    unit: 'USD',
    observedAt,
    fetchedAt: new Date().toISOString()
  }
};
const contextRow = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth });
const freshnessRow = AIO.buildAIQuoteEvidenceRow('AAPL', { ...quote, source: 'ignored-legacy-source' }, { truth });
const tuple = row => [row.evidenceId, row.metric, row.entity, row.value, row.unit, row.currency, row.asOf, row.source, row.sourceKind];
assert.deepEqual(tuple(contextRow), tuple(freshnessRow), 'both consumers produce one coherent evidence tuple');
assert.equal(contextRow.status, 'verified');
assert.equal(contextRow.decisionUse, true);
assert.equal(contextRow.metric, 'price');
assert.equal(contextRow.entity, 'AAPL');
assert.equal(contextRow.asOf, observedAt);
assert.equal(contextRow.sourceKind, 'LIVE');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'unknown', decisionUse: true } }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'stale', decisionUse: true } }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', { ...quote, observedAt: new Date(Date.now() - 600000).toISOString() }, { truth }).status, 'blocked');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth, source: 'spoof', sourceKind: 'SNAPSHOT' }).source, contextRow.source);

const noObservation = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { source: 'live:yahoo', currency: 'USD', unit: 'USD', fetchedAt: new Date().toISOString(), generatedAt: new Date().toISOString() }
}, { truth });
assert.equal(noObservation.status, 'blocked');
assert.equal(noObservation.asOf, null);
assert.ok(noObservation.blockers.includes('observation-missing'));

const noSource = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  source: 'live:yahoo',
  quoteEnvelope: { price: 197.25, observedAt, currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(noSource.status, 'blocked');
assert.equal(noSource.sourceKind, 'UNKNOWN');
assert.ok(noSource.blockers.includes('source-missing'));

const noCurrency = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  currency: 'USD',
  quoteEnvelope: { price: 197.25, observedAt, source: 'live:yahoo' }
}, { truth });
assert.equal(noCurrency.status, 'blocked');
assert.equal(noCurrency.currency, 'UNKNOWN');
assert.equal(noCurrency.unit, 'UNKNOWN');
assert.ok(noCurrency.blockers.includes('currency-missing'));
assert.ok(noCurrency.blockers.includes('unit-missing'));

const arbitrarySource = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { price: 197.25, observedAt, source: 'provider-claimed-live', currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(arbitrarySource.sourceKind, 'UNKNOWN');
assert.equal(arbitrarySource.status, 'blocked');

const mismatchedPrice = AIO.buildAIQuoteEvidenceRow('AAPL', {
  price: 197.25,
  quoteEnvelope: { price: 198.25, observedAt, source: 'live:yahoo', currency: 'USD', unit: 'USD' }
}, { truth });
assert.equal(mismatchedPrice.status, 'blocked');
assert.ok(mismatchedPrice.blockers.includes('price-envelope-mismatch'));

const truthMismatch = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status: 'verified', decisionUse: false } });
assert.equal(truthMismatch.status, 'blocked');
assert.equal(truthMismatch.decisionUse, false);

const normalizedMissing = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'live:yahoo', asOf: observedAt, truthStatus: 'verified', status: 'ok'
});
assert.equal(normalizedMissing.status, 'blocked', 'normalizer fails closed when quote currency/unit is absent');
assert.equal(normalizedMissing.asOf, observedAt);
const normalizedFetchedOnly = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'live:yahoo', sourceTs: observedAt, fetchedAt: observedAt, currency: 'USD', unit: 'USD', truthStatus: 'verified'
});
assert.equal(normalizedFetchedOnly.asOf, null, 'fetchedAt cannot become quote observation');
assert.equal(normalizedFetchedOnly.status, 'blocked');
const normalizedArbitrary = AIO.normalizeAIChatEvidenceRow({
  ticker: 'AAPL', price: 197.25, source: 'provider-claimed-live', asOf: observedAt, currency: 'USD', unit: 'USD', truthStatus: 'verified'
});
assert.equal(normalizedArbitrary.sourceKind, 'UNKNOWN');
assert.equal(normalizedArbitrary.status, 'blocked');

const evidenceStart = chat.indexOf('function _aioAIClaimEvidenceId(');
const evidenceEnd = chat.indexOf('function _aioHasCurrentNumericContent(', evidenceStart);
assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart, 'claim evidence collector slice is present');
sandbox.window.AIO_ARCH = { getAIOrchestrator: () => ({ answerPublication }) };
sandbox.window.AIO.normalizeAIChatEvidenceRow = row => ({ ...row });
vm.runInNewContext(chat.slice(evidenceStart, evidenceEnd), sandbox, { filename: 'js/aio-chat.js#quote-evidence-conflict' });
const duplicateConflict = sandbox._aioCollectAIClaimEvidence({ evidence: [contextRow, { ...contextRow, value: 198.25 }] });
assert.equal(duplicateConflict.length, 1, 'duplicate quote evidence IDs collapse to one registry row');
assert.equal(duplicateConflict[0].status, 'conflict', 'conflicting duplicate quote tuples are rejected');

console.log('PASS ai-quote-evidence: shared envelope tuple, observation/source/currency fail-closed rules, sibling consumer parity and duplicate conflict rejection');
}],
// ── section chat-analysis-integration (was ci-ai-chat-analysis-integration-check.mjs) ──
['chat-analysis-integration', async () => {
const answerPublication = await import('../src/ai/response/publication.js');
const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { default: vm } = await import('node:vm');
const { fileURLToPath } = await import('node:url');
const { createAIAnswerOrchestrator } = await import('../src/ai/orchestrator/answer-orchestrator.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep source-slice contracts independent of the checkout's CRLF/LF mode.
// The assertion is about wiring and evidence semantics, not line endings.
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
const chat = read('js/aio-chat.js');
const html = read('index.html');

const helperStart = chat.indexOf('function _aioBuildChatAnalysisContext(');
const helperEnd = chat.indexOf('\n\n// 2026-08-30 supplied-materials', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'production helper slice is present');

const boundaryKinds = [];
const sandbox = {
  window: {
    AIO_ARCH: null,
    AIO: {
      normalizeAIChatEvidenceRow(row) { return { ...row }; },
      buildAIUntrustedBlock(kind, payload) {
        boundaryKinds.push(kind);
        return `[AIO UNTRUSTED DATA START kind=${kind}]\n${String(payload)}\n[AIO UNTRUSTED DATA END kind=${kind}]`;
      }
    }
  }
};
vm.runInNewContext(chat.slice(helperStart, helperEnd), sandbox, { filename: 'js/aio-chat.js#analysis-helper' });
assert.equal(typeof sandbox.window._aioBuildChatAnalysisContext, 'function', 'helper is exposed on window');

const evidenceStart = chat.indexOf('function _aioAIClaimEvidenceId(');
const evidenceEnd = chat.indexOf('function _aioHasCurrentNumericContent(', evidenceStart);
assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart, 'production evidence collector slice is present');
sandbox.window.AIO_ARCH = { getAIOrchestrator: () => ({ answerPublication }) };
vm.runInNewContext(chat.slice(evidenceStart, evidenceEnd), sandbox, { filename: 'js/aio-chat.js#claim-evidence' });
const duplicateEvidence = {
  evidenceId: 'fixture:duplicate', metric: 'price-change-pct', entity: 'NVDA', value: -2,
  unit: '%', scale: 'raw', asOf: '2026-09-08T20:00:00Z', source: 'fixture-exchange', status: 'verified'
};
const repeated = sandbox._aioCollectAIClaimEvidence({ evidence: [duplicateEvidence, { ...duplicateEvidence }] });
assert.equal(repeated.length, 1, 'identical evidence rows remain deduplicated');
assert.equal(repeated[0].status, 'verified');
const conflicting = sandbox._aioCollectAIClaimEvidence({ evidence: [duplicateEvidence, { ...duplicateEvidence, value: 2 }] });
assert.equal(conflicting.length, 1, 'conflicting evidence IDs remain a single registry row');
assert.equal(conflicting[0].status, 'conflict', 'conflicting evidence is rejected by publish status');
assert.equal(sandbox._aioEvidenceCanPublish({ ...duplicateEvidence, asOf: new Date(Date.now() + 86400000).toISOString() }), false, 'future observations are not publishable');

const now = new Date('2026-09-08T21:00:00Z');
const period = { start: '2026-09-07T20:00:00Z', end: '2026-09-08T20:00:00Z' };
const assertion = {
  entityId: 'NVDA',
  metricId: 'price-change-pct',
  timeframe: 'session',
  period,
  unit: '%',
  direction: 'down'
};
const evidence = {
  ...assertion,
  value: -2,
  observedAt: period.end,
  evidenceId: 'fixture:nvda-session-change',
  source: 'fixture-exchange',
  // Matching premise fixtures must carry the same explicit grants as a
  // production current/decision observation.  Freshness or `verified` alone
  // is intentionally insufficient under the strict evidence contract.
  sourceKind: 'T1_OFFICIAL',
  revisionId: 'fixture-revision-20260908-nvda-session-change',
  rightsId: 'fixture-exchange-public-rights',
  status: 'verified',
  allowedUse: 'decision',
  allowedUseCeiling: 'decision',
  claimUse: 'current',
  currentClaim: true,
  freshnessStatus: 'current',
  freshnessMs: 24 * 60 * 60 * 1000,
  qualityStatus: 'CURRENT',
  quality: { status: 'CURRENT', stale: false, blocked: false, decisionUse: true }
};
const orchestrator = createAIAnswerOrchestrator({ root: sandbox.window, now: () => now });
sandbox.window.AIO_ARCH = { getAIOrchestrator: () => orchestrator };

const plan = orchestrator.plan({
  query: '오늘 NVDA 하락 중인데 왜 그래?',
  route: 'home',
  now,
  premiseAssertions: [assertion],
  premisePeriod: period
});
const verified = sandbox.window._aioBuildChatAnalysisContext(plan, [evidence]);
assert.equal(verified.questionPlan.premise.status, 'VERIFIED', 'matching evidence verifies the premise');
assert.match(verified.context, /DOMAIN_ANALYSIS|AIO UNTRUSTED DATA START kind=DOMAIN_ANALYSIS/, 'domain context is quarantined');
assert.equal(verified.audit.premiseStatus, 'VERIFIED');
assert.deepEqual(verified.audit.requestedPeriod, period, 'explicit plan period is forwarded');

const missing = sandbox.window._aioBuildChatAnalysisContext(plan, []);
assert.equal(missing.questionPlan.premise.status, 'UNVERIFIED', 'missing evidence is delivered as unverified');
assert.match(missing.context, /premise\.status=UNVERIFIED/, 'unverified status is visible in the context');

const oppositePlan = orchestrator.plan({
  query: '오늘 NVDA 상승 중인데 왜 그래?',
  route: 'home',
  now,
  premiseAssertions: [{ ...assertion, direction: 'up' }],
  premisePeriod: period
});
const opposite = sandbox.window._aioBuildChatAnalysisContext(oppositePlan, [evidence]);
assert.equal(opposite.questionPlan.premise.status, 'CONTRADICTED', 'opposite observed direction is delivered');
assert.match(opposite.context, /premise\.status=CONTRADICTED/, 'contradicted status is visible in the context');

const noPeriodPlan = orchestrator.plan({
  query: '오늘 NVDA 하락 중인데 왜 그래?',
  route: 'home',
  now
});
const numericOnlyQuote = sandbox.window._aioBuildChatAnalysisContext(noPeriodPlan, [{
  entityId: 'NVDA', metricId: 'price-change-pct', timeframe: 'session', unit: '%', value: -2,
  observedAt: period.end, evidenceId: 'fixture:numeric-only', source: 'fixture-exchange', sourceKind: 'exchange', status: 'verified'
}]);
assert.equal(numericOnlyQuote.questionPlan.premise.status, 'UNVERIFIED', 'numeric quote cannot infer a requested period');
assert.equal(numericOnlyQuote.audit.requestedPeriod, null, 'numeric quote cannot create a requested period');

// v57.62: the dead per-page chatSend (no #chat-<ctx>-inp since P1653) was retired; only the unified surface remains.
assert.ok(!/async function chatSend\(/.test(chat) && !/_pageAnalysisSlice/.test(chat), 'v57.62 per-page chatSend retired');
// P1131/R619: the unified chat surface moved from index.html's inline block G into js/aio-chat.js.
// All three assertions below follow the code there — including the chip markup, which is emitted by
// _aiDefaultChips (also block G) rather than authored in the shell. The gate caught that assumption
// when it failed on the stale index.html read.
assert.ok(/_uniClaimEvidence[\s\S]{0,900}_aioBuildChatAnalysisContext/.test(chat), 'unified chat calls the shared helper after evidence collection');
assert.ok(/_uniAnalysisSlice\.questionPlan/.test(chat) && /sysPrompt \+= _uniAnalysisSlice\.context/.test(chat), 'unified chat adopts the updated plan and context');
assert.ok(/premise-['"] \+ premiseStatus\.toLowerCase\(\)/.test(chat) && /CONTRADICTED/.test(chat), 'pipeline adds premise limitations without a blanket block');
assert.ok(/_aioAIClaimEvidenceTuple/.test(chat) && /status: 'conflict'/.test(chat), 'claim registry marks conflicting tuples explicitly');
assert.ok((chat.match(/<button type="button" class="ai-chip"/g) || []).length >= 2 && !/<div class="ai-chip"/.test(chat), 'unified chat chips are keyboard-activatable buttons');
assert.ok(/function aiChipClick\(el\)[\s\S]{0,220}chatSendUnified\(\)/.test(chat), 'keyboard chip activation retains the unified send path');
assert.ok(boundaryKinds.filter(kind => kind === 'DOMAIN_ANALYSIS').length >= 4, 'all analysis contexts use the untrusted boundary');

console.log('PASS ai-chat-analysis-integration: production helper, orchestrator premise states, period safety, the unified chat surface and limitation pipeline');
}],
// ── section connection-access (was ci-connection-access-check.mjs) ──
['connection-access', async () => {
const { default: assert } = await import('node:assert/strict');
const { default: vm } = await import('node:vm');
const { readFileSync } = await import('node:fs');
const { describeSharedConnection } = await import('../src/domain/connections/shared.js');
const { formatSecResearchEvidence } = await import('../src/ai/context/sec-fundamentals.js');
const { createEntityProvider } = await import('../src/data/providers/entity.js');
const { selectPublicEarnings } = await import('../src/data/providers/earnings.js');
const { assessWorkerSetup } = await import('./check-worker-setup.mjs');

// P1607: execute the actual keyless AI consumer, not a parallel implementation.
const chat = readFileSync(new URL('../js/aio-chat.js',import.meta.url),'utf8');
const start = chat.indexOf('async function _fetchDeepCompareData(');
const end = chat.indexOf('// 기업 내부 비교 데이터', start);
const facts = { symbol:'NVDA', source:'SEC EDGAR companyfacts', periodType:'FY', observedAt:'2026-01-31', filedAt:'2026-03-01', coverage:['revenue','netIncome'], revenue:123, netIncome:0 };
let requests = 0;
const provider = createEntityProvider({ read:()=>({id:'NVDA'}), httpClient:{requestJson:async()=>{ requests++;return {ok:true,data:{data:{NVDA:facts}}};}} });
const root = { AIO:{readPublicFundamentals:provider.readFundamentals,formatSecResearchEvidence} };
const context = vm.createContext({window:root,_getApiKey:()=>'',_aioThrowIfChatAborted:signal=>{if(signal?.aborted) throw new DOMException('Aborted','AbortError');},_aioLog(){},Date,console});
vm.runInContext(chat.slice(start,end),context);
const [deep,screen] = await Promise.all([context._fetchDeepCompareData(['NVDA']),provider.readCurrent()]);
assert.equal(requests,1,'P1607 screen and keyless AI share one provider load');
assert.equal(deep.NVDA.secFundamentals.revenue,screen.fundamentals.revenue,'P1607 AI does not discard shared facts without FMP');
assert.equal(await context._fetchDeepCompareData(['UNKNOWN']),null,'P1607 unavailable symbols never fabricate a result');
assert.match(formatSecResearchEvidence(facts),/FY/,'P1607 annual source keeps its period');
assert.match(formatSecResearchEvidence(facts),/순이익: 0/,'P1607 a reported zero remains distinct from missing');
assert.equal(formatSecResearchEvidence({...facts,filedAt:'2099-01-01'}),'','P1607 future unavailable facts are held');
assert.equal(formatSecResearchEvidence({...facts,filedAt:null}),'','P1607 missing availability is held');
assert.equal(formatSecResearchEvidence({...facts,availableAt:'invalid'}),'','P1607 invalid availability cannot fall back to a valid filing');
assert.equal(formatSecResearchEvidence({...facts,acceptedAt:'2099-01-01'}),'','P1607 future acceptance is held despite a past filing');
assert.match(formatSecResearchEvidence(facts),/매출: 123 \(USD\)/,'P1607 SEC USD amounts retain their actual unit');
const connection = {schemaVersion:'aio-worker-health.v1',ai:{ready:true,provider:'openai',model:'gpt-6-luna',appTokenRequired:true,appTokenAccepted:false}};
assert.equal(describeSharedConnection(connection).ok,false,'P1607 ready server with denied caller must hold');
assert.equal(describeSharedConnection({...connection,ai:{...connection.ai,appTokenAccepted:true}}).ok,true,'P1607 accepted caller can use a ready server');
assert.equal(describeSharedConnection({ai:{ready:true}}).ok,false,'P1607 malformed health cannot certify a route');
assert.equal(/googleapis\.com\/customsearch|aio_google_cse/.test(chat),false,'P1655 browser-side Google search path is removed');
const calendar = {status:'current-reference',weekStart:'2026-10-12',weekEnd:'2026-10-16',earnings:[{symbol:'A',date:'2026-10-15'},{symbol:'AA',date:'2026-10-14'}]};
assert.equal(selectPublicEarnings(calendar,'A','2026-10-12','2026-10-16').length,1,'P1607 calendar matches exact issuer');
assert.equal(selectPublicEarnings(calendar,'A','2026-10-20','2026-11-01'),null,'P1607 unknown future window is not an empty certified calendar');
assert.equal(assessWorkerSetup({ai:{ready:true}},{}).dispatchConfigured,false,'P1607 AI readiness does not certify scheduler token');
console.log('PASS P1607 shared connections, keyless SEC AI, no browser search path and calendar boundaries');
}],
// ── section inference (was ci-inference-contract-check.mjs) ──
['inference', async () => {
const { createInferredClaim, evaluateInferredClaim, validateInferredClaim } = await import('../src/ai/inference.js');

const claim = createInferredClaim({
  metricId: 'market.risk',
  direction: 'BULLISH',
  confidence: 'HIGH',
  sourceUrls: ['https://example.com/one', 'https://example.com/two'],
  observedWindow: { start: '2026-07-17T00:00:00Z', end: '2026-07-18T00:00:00Z' }
});
const valid = validateInferredClaim(claim);
if (!valid.ok || !evaluateInferredClaim(claim).allowed) throw new Error(`[inference-contract] valid claim rejected: ${valid.errors.join(',')}`);
const highOneSource = createInferredClaim({ ...claim, confidence: 'HIGH', sourceUrls: ['https://example.com/one'], sourceCount: 1 });
if (validateInferredClaim(highOneSource).ok) throw new Error('[inference-contract] high confidence accepted with one source');
if (validateInferredClaim({ ...claim, value: 42 }).ok) throw new Error('[inference-contract] exact numeric search value accepted');
console.log(JSON.stringify({ ok: true, schemaVersion: claim.schemaVersion, sourceCount: claim.sourceCount, highConfidenceRequires: 2 }));
}],
]);
