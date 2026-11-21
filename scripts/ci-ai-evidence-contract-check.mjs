#!/usr/bin/env node
// AI evidence contracts. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('ai-evidence', [
// ── section screen-facts (S5, ADR-0003, v59.87): the AI reads the facts the screens compute ──
['screen-facts', async () => {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const { stockTrendLine, screenRowFor, chatStockTrendLine } = await import('../src/ai/context/stock-trend-line.js');
const { buildStockRead } = await import('../src/domain/entity/stock-read.js');
// v59.87 [주가 추이] prints the 종목 page's own numbers: returns, trend label, 52-week position and RSI from the same row.
const row = { sym: 'NVDA', factorSessionDate: '2026-11-06', ret5d: -8.8, ret1m: -19.02, ret3m: -14.11, pctSma50: -15.08, pctSma200: -8.68, adrPct: 2.95, rsi: 30.8, pctFrom52wLow: 13.6, pctFrom52wHigh: -23.3 };
const line = stockTrendLine({ symbol: 'NVDA', row });
const page = buildStockRead({ symbol: 'NVDA', row });
assert.ok(line.includes(`추세 ${page.facts.trendLabel}(`), `v59.87 trend label is the page label: ${line}`);
assert.ok(line.includes('5거래일 -8.8%, 1개월 -19.0%, 3개월 -14.1%'), `v59.87 returns are the row values: ${line}`);
assert.ok(line.includes(`52주 범위 ${Math.round(page.position * 100)}% 위치(고점 대비 -23.3%)`), `v59.87 52-week position is the page position: ${line}`);
assert.ok(line.includes('RSI 31') && line.includes('11/6 종가'), `v59.87 RSI and session date: ${line}`);
assert.equal(stockTrendLine({ symbol: 'X', row: null }), null, 'v59.87 no row, no line');
assert.ok(stockTrendLine({ symbol: 'NVDA', row: { ...row, ret1d: -14.01 } }).includes('1거래일 -14.0%, 5거래일 -8.8%'), 'v60.41 the last session change leads the returns');
// v59.87 row order: published screener row, then a ready on-demand row; a KR listing outside the universe has none.
const root = { _aioGetCanonicalScreenerRows: () => [row], _aioOnDemandSymbol: (sym) => (sym === 'ZZZZ' ? { status: 'ready', row: { ...row, sym: 'ZZZZ' } } : null) };
assert.equal(screenRowFor(root, 'nvda').source, 'screener', 'v59.87 published row first');
assert.equal(screenRowFor(root, 'ZZZZ').source, 'on-demand', 'v59.87 then the ready on-demand row');
assert.ok((await chatStockTrendLine('ZZZZ', { root })).includes('요청 시 산출'), 'v59.87 an on-demand line says it was computed on request');
let requested = 0;
assert.equal(await chatStockTrendLine('000660.KS', { root: { ...root, _aioRequestOnDemandSymbol: () => { requested += 1; } } }), null, 'v59.87 a KR listing outside the universe has no line');
assert.equal(requested, 0, 'v59.87 a KR listing is never sent to the US on-demand reader');
// v59.87 no second computation path in the chat: _fetchTickerTrend returns the shared line and never downloads a chart.
const vm = await import('node:vm');
const chat = read('js/aio-chat.js');
const trendFn = chat.slice(chat.indexOf('async function _fetchTickerTrend('), chat.indexOf('// _withTimeout moved to'));
let downloads = 0;
const sandbox = { fetchViaProxy: () => { downloads += 1; throw new Error('no chart download'); }, fetch: () => { downloads += 1; throw new Error('no fetch'); } };
sandbox.window = { ...sandbox, AIO: { chatStockTrendLine: async (sym, opts) => (opts.root === sandbox.window ? `shared:${sym}` : null) } };
vm.createContext(sandbox);
vm.runInContext(`${trendFn}; this._trend = _fetchTickerTrend;`, sandbox);
assert.equal(await sandbox._trend('NVDA'), 'shared:NVDA', 'v59.87 _fetchTickerTrend returns the shared screen-row line');
assert.equal(downloads, 0, 'v59.87 _fetchTickerTrend downloads nothing');
const { buildChatMacroLines } = await import('../src/ai/context/chat-macro-lines.js');
const fx = buildChatMacroLines({ ctxId: 'fxbond', root: { _liveData: { 'DX-Y.NYB': { price: 120 } }, DATA_SNAPSHOT: { dxy: 99.5 } } });
assert.ok(fx.some((l) => l.includes('99.50') && l.includes('스냅샷 참고')) && !fx.some((l) => l.includes('120')), `v59.87 DXY fallback is the labelled snapshot, not the raw live quote: ${fx.join()}`);
// v59.87 the RSI zone is RULES.technical.rsi.
const { RULES } = await import('../src/domain/rules/thresholds.js');
const { buildTechnicalConditions } = await import('../src/ai/analysis/technical.js');
const zone = (rsi14) => buildTechnicalConditions({ indicators: { rsi14 } }).conditions[0].status;
assert.equal(zone(RULES.technical.rsi.overbought), 'overbought', 'v59.87 overbought band is RULES');
assert.equal(zone(RULES.technical.rsi.overbought - 0.1), 'neutral', 'v59.87 just under the overbought band is neutral');
assert.equal(zone(RULES.technical.rsi.oversold), 'oversold', 'v59.87 oversold band is RULES');
assert.equal(zone(RULES.technical.rsi.oversold + 0.1), 'neutral', 'v59.87 just over the oversold band is neutral');
// v59.87 one browser–Worker contract: the Worker's model and the chat's trim target come from it; the published config agrees.
const contract = await import('../src/domain/ai/worker-contract.js');
const budget = await import('../worker/openai-budget.mjs');
assert.equal(budget.OPENAI_MODEL, contract.AI_MODEL, 'v59.87 the Worker serves the contract model');
assert.ok(contract.AI_CLIENT_BODY_TARGET_BYTES < contract.AI_REQUEST_MAX_BYTES, 'v59.87 the chat trims under the Worker limit');
assert.equal(JSON.parse(read('public-config.json')).ai?.model, contract.AI_MODEL, 'v59.87 public-config.json names the contract model');
// v59.87 one AI policy folder; the retriever has no fetch of its own even when a global fetch exists.
const { existsSync } = await import('node:fs');
assert.ok(!existsSync(new URL('../src/ai/policy.js', import.meta.url)) && !existsSync(new URL('../src/ai/policies', import.meta.url)), 'v59.87 src/ai/policy/ is the one policy folder');
const { createAIKnowledgeRetriever } = await import('../src/ai/retrieval/knowledge.js');
const loaderError = await createAIKnowledgeRetriever({}).load().then(() => null, (error) => error);
assert.ok(/knowledge_loader_unavailable/.test(String(loaderError?.message)), 'v59.87 the knowledge retriever needs the injected loader');
console.log(JSON.stringify({ ok: true, section: 'screen-facts' }));
}],
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
const chat = (read('js/aio-chat.js') + '\n' + read('src/ai/response/request-pipeline.js'));

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
// v60.41: the producer reads its price basis from src/ai/time/quote-basis.js (installed with the chat). These fixtures
// are intraday claims, so they run at a fixed open NYSE instant (Wed 2026-11-18 10:00 ET).
const { decideQuoteBasis } = await import('../src/ai/time/quote-basis.js');
const OPEN_NOW = Date.parse('2026-11-18T15:00:00Z');
assert.equal(AIO.buildAIQuoteEvidenceRow('AAPL', {}, {}).blockers.includes('quote-basis-missing'), true, 'v60.41 without the basis rule a quote is never usable');
AIO.decideQuoteBasis = (input) => decideQuoteBasis({ ...input, now: OPEN_NOW });
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

const observedAt = new Date(OPEN_NOW - 30 * 1000).toISOString();
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
// v60.41: an intraday quote no second source confirmed is not usable; it asks for a refresh instead of reading as a conflict.
for (const status of ['unknown', 'stale', 'warn']) {
  const unconfirmed = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { status, decisionUse: true } });
  assert.equal(unconfirmed.decisionUse, false, `v60.41 truth ${status} intraday quote is not usable`);
  assert.equal(unconfirmed.status, 'refresh_required', `v60.41 truth ${status} intraday quote asks for a refresh`);
  assert.equal(unconfirmed.basisNeedsCrossCheck, true, `v60.41 truth ${status} intraday quote asks for a second source`);
}
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
assert.ok(truthMismatch.status === 'refresh_required', `v60.41 truth mismatch status ${truthMismatch.status}`);
assert.equal(truthMismatch.decisionUse, false);
const conflicted = AIO.buildAIQuoteEvidenceRow('AAPL', quote, { truth: { ...truth, status: 'blocked', issues: ['cross_source_mismatch:fmp:30%'] } });
assert.equal(conflicted.status, 'blocked', 'v60.41 a source conflict still blocks');

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
// ── section quote-basis (v60.41): the chat states a confirmed close with its date on a closed market ──
// Live failure 2026-11-21 (Saturday): "엔비디아 … 지금 주가는 52주 고점 대비 어디야?" was refused ("교차검증 상태가 차단") after
// 39 s although _liveData.NVDA held the 2026-11-20 close: every ticker needed a 2-minute-old, cross-checked quote.
['quote-basis', async () => {
const { default: assert } = await import('node:assert/strict');
const { default: fs } = await import('node:fs');
const { default: vm } = await import('node:vm');
const { decideQuoteBasis, quoteBasisLine } = await import('../src/ai/time/quote-basis.js');
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const SAT = Date.parse('2026-11-21T05:00:00Z'); // Saturday 14:00 KST, both markets closed
const NVDA_CLOSE = '2026-11-20T21:00:01Z'; // Friday 16:00:01 ET
const single = { status: 'warn', decisionUse: true, issues: [], warnings: ['single_source_no_crosscheck'], crossSource: { status: 'single_source', blockingMismatches: [] } };
// 1. Closed market, quote at the latest completed close: the close basis, usable, nothing to look up or cross-check.
const close = decideQuoteBasis({ symbol: 'NVDA', price: 125.53, observedAt: NVDA_CLOSE, truth: single, now: SAT });
assert.deepEqual([close.basis, close.status, close.sessionDate, close.label, close.needsLookup, close.needsCrossCheck], ['close', 'usable', '2026-11-20', '2026-11-20 종가', false, false], `v60.41 closed market + last-close quote is the close basis: ${JSON.stringify(close)}`);
// The truth gate's age issue (18 h after the close) is the session rule's question, not a defect.
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 125.53, observedAt: NVDA_CLOSE, truth: { ...single, status: 'blocked', issues: ['stale_quote:68400s'] }, now: SAT + 12 * 3600000 }).status, 'usable', 'v60.41 a weekend-old close stays usable');
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 120, observedAt: '2026-11-19T21:00:00Z', truth: single, now: SAT }).status, 'refresh_required', 'v60.41 a quote from an older session is not the latest close');
// 2. Open session, 10-minute-old quote: intraday, refresh required (lookup); a fresh cross-checked quote is usable.
const OPEN = Date.parse('2026-11-18T15:00:00Z');
const old = decideQuoteBasis({ symbol: 'NVDA', price: 130, observedAt: new Date(OPEN - 600000).toISOString(), truth: { status: 'verified', decisionUse: true, issues: [] }, now: OPEN });
assert.deepEqual([old.basis, old.status, old.needsLookup], ['intraday', 'refresh_required', true], `v60.41 open session + 10-minute-old quote needs a refresh: ${JSON.stringify(old)}`);
const live = decideQuoteBasis({ symbol: 'NVDA', price: 130, observedAt: new Date(OPEN - 30000).toISOString(), truth: { status: 'verified', decisionUse: true, issues: [] }, now: OPEN });
assert.deepEqual([live.basis, live.status, live.label], ['intraday', 'usable', '2026-11-18 09:59 뉴욕 시각 장중'], `v60.41 a fresh confirmed quote is the intraday basis: ${JSON.stringify(live)}`);
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 130, observedAt: new Date(OPEN - 30000).toISOString(), truth: single, now: OPEN }).needsCrossCheck, true, 'v60.41 an intraday single source asks for the second source');
// 3. Conflicting sources block, on an open or a closed market; a defective quote blocks too.
for (const now of [SAT, OPEN]) {
  const conflict = decideQuoteBasis({ symbol: 'NVDA', price: 125.53, observedAt: NVDA_CLOSE, truth: { ...single, status: 'blocked', issues: ['cross_source_mismatch:fmp:30%'], crossSource: { status: 'mismatch', blockingMismatches: [{ family: 'fmp', diffPct: 30 }] } }, now });
  assert.equal(conflict.status, 'blocked', `v60.41 conflicting sources block (${new Date(now).toISOString()})`);
}
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 125.53, observedAt: NVDA_CLOSE, truth: { ...single, issues: ['price_out_of_sanity_range:125.53'] }, now: SAT }).status, 'blocked', 'v60.41 a truth defect blocks');
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 125.53, observedAt: NVDA_CLOSE, integrityBlockers: ['currency-missing'], truth: single, now: SAT }).status, 'blocked', 'v60.41 an envelope defect blocks');
// 4. A Korean listing is judged on the KRX session, not the NYSE one.
const krAfter = Date.parse('2026-11-20T10:00:00Z'); // Fri 19:00 KST (KRX closed and final); NYSE has not opened
const kr = decideQuoteBasis({ symbol: '005930.KS', price: 183000, observedAt: '2026-11-20T06:30:00Z', truth: single, now: krAfter });
assert.deepEqual([kr.market, kr.basis, kr.status, kr.label], ['KR', 'close', 'usable', '2026-11-20 종가'], `v60.41 KRX close is read on the KRX session: ${JSON.stringify(kr)}`);
assert.equal(decideQuoteBasis({ symbol: 'NVDA', price: 125, observedAt: '2026-11-20T06:30:00Z', truth: single, now: krAfter }).status, 'refresh_required', 'v60.41 the same instant is not a US close');
const krOpen = Date.parse('2026-11-20T02:00:00Z'); // Fri 11:00 KST, KRX trading while NYSE is closed
assert.equal(decideQuoteBasis({ symbol: '005930.KS', price: 190000, observedAt: '2026-11-19T07:30:00Z', truth: single, now: krOpen }).basis, 'intraday', 'v60.41 a KRX listing during the KRX session is intraday');
assert.equal(decideQuoteBasis({ symbol: '005930.KS', price: 190000, observedAt: '2026-11-19T07:30:00Z', truth: single, now: Date.parse('2026-11-19T07:45:00Z') }).basis, 'intraday', 'v60.41 before the KRX close is final (30 minutes) it is still intraday');
assert.equal(decideQuoteBasis({ symbol: '005930.KS', price: 190000, observedAt: '2026-11-19T07:30:00Z', truth: single, now: Date.parse('2026-11-19T09:00:00Z') }).label, '2026-11-19 종가', 'v60.41 the 16:30 KRX close on the exam day is the close');
// 5. The chat path: the legacy audit and preflight read the basis, request no lookup or cross-check for a close, and
// tell the model the close with its date.
const core = read('js/aio-core.js');
const data = read('js/aio-data.js');
const calls = { lookup: 0, cross: 0, refreshForce: [] };
const nvda = { price: 125.53, pct: -14.01, quoteEnvelope: { source: 'live:yahoo-v7-batch', price: 125.53, currency: 'USD', unit: 'USD', observedAt: NVDA_CLOSE } };
const sandbox = { window: { AIO: {}, _liveData: { NVDA: nvda } }, console, Date, Number, String, Object, Array, Math, isFinite, URL, AbortController,
  dynamicTickerLookup: async () => { calls.lookup += 1; return null; } };
vm.runInNewContext(core.slice(core.indexOf('var _AIO_CLAIM_SCHEMA_VERSION'), core.indexOf('function _aioClaimEvidenceList')), sandbox);
vm.runInNewContext(data.slice(data.indexOf('function _aioNormalizeChatTickers'), data.indexOf('// v59.20: updateDataStatusError')), sandbox);
const AIO = sandbox.window.AIO;
AIO.decideQuoteBasis = (input) => decideQuoteBasis({ ...input, now: SAT });
AIO.evaluateDataTruth = () => single;
AIO.ensureFreshDataForUse = async (scope) => { calls.refreshForce.push(scope.forceFresh); return { status: 'recently_refreshed' }; };
AIO.validateQuoteCrossSources = async () => { calls.cross += 1; return { status: 'warn' }; };
const preflight = await AIO.ensureFreshChatAnswerData({ tickers: ['NVDA'], reason: 'chat-answer', forceFresh: true });
const row = preflight.after.quoteRows[0];
assert.deepEqual([preflight.status, row.status, row.basis, row.decisionUse, preflight.closeBasisOnly], ['recently_refreshed', 'ok', 'close', true, true], `v60.41 closed market + last-close quote: usable preflight ${JSON.stringify({ status: preflight.status, row })}`);
assert.deepEqual([calls.lookup, calls.cross, calls.refreshForce], [0, 0, [false]], `v60.41 a close basis requests no lookup, no cross-check and no forced refresh: ${JSON.stringify(calls)}`);
const line = quoteBasisLine(row);
assert.equal(line, 'NVDA: 종가 기준 사용 가능 — 2026-11-20 종가 $125.53, 전일 대비 -14.01% (미국 정규장 마감 뒤 확정 종가, 장중 시세 아님)', `v60.41 the model reads the close with its date: ${line}`);
// Open session + 10-minute-old quote: the same path asks for the lookup and the cross-check.
AIO.decideQuoteBasis = (input) => decideQuoteBasis({ ...input, now: OPEN });
sandbox.window._liveData.NVDA = { ...nvda, quoteEnvelope: { ...nvda.quoteEnvelope, observedAt: new Date(OPEN - 600000).toISOString() } };
const intraday = await AIO.ensureFreshChatAnswerData({ tickers: ['NVDA'], reason: 'chat-answer', forceFresh: true });
assert.deepEqual([intraday.status, intraday.after.quoteRows[0].status, calls.lookup, calls.cross, calls.refreshForce.at(-1)], ['warn', 'refresh_required', 1, 1, true], `v60.41 open session + 10-minute-old quote: refresh required ${JSON.stringify(calls)}`);
assert.match(quoteBasisLine(intraday.after.quoteRows[0]), /^NVDA: 장중 시세 확인 안 됨 — 장중 관측이 2분보다 오래됨$/, 'v60.41 the model reads why the intraday price is unavailable');
// The chat hands the model the basis lines, not the old age/truth diagnostics.
const chat = read('js/aio-chat.js');
assert.match(chat, /\[종목 가격 기준\][\s\S]{0,400}거부하지 않는다/, 'v60.41 the preflight block tells the model to state the close with its date');
assert.doesNotMatch(chat, /quote-ok' : 'quote-missing'/, 'v60.41 the age/truth diagnostic line is gone');
console.log('PASS v60.41 quote basis: close on a closed market, intraday rule while open, conflicts block, KRX session for Korean listings, no lookups for a close');
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
const chat = (read('js/aio-chat.js') + '\n' + read('src/ai/response/request-pipeline.js'));
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
// v59.51 (content audit): aiChipClick delegates to the one chip path, chatFromChip, which ends in the unified send.
assert.ok(/function chatFromChip\(ctxId, q\)[\s\S]{0,1200}return chatSendUnified\(\);[\s\S]*function aiChipClick\(el\)[\s\S]{0,120}chatFromChip\x28/.test(chat), 'v59.51 (content audit): keyboard chip activation retains the unified send path through chatFromChip');
assert.ok(boundaryKinds.filter(kind => kind === 'DOMAIN_ANALYSIS').length >= 4, 'all analysis contexts use the untrusted boundary');

console.log('PASS ai-chat-analysis-integration: production helper, orchestrator premise states, period safety, the unified chat surface and limitation pipeline');
}],
// ── section connection-access (was ci-connection-access-check.mjs) ──
['connection-access', async () => {
const { default: assert } = await import('node:assert/strict');
const { default: vm } = await import('node:vm');
const { readFileSync } = await import('node:fs');
const { describeSharedConnection } = await import('../src/domain/ai/shared-connection.js');
const { formatSecResearchEvidence } = await import('../src/ai/context/sec-fundamentals.js');
const { createEntityProvider } = await import('../src/data/providers/entity.js');
const { selectPublicEarnings } = await import('../src/data/providers/earnings.js');
const { assessWorkerSetup } = await import('./check-worker-setup.mjs');

// P1607: execute the actual keyless AI consumer, not a parallel implementation.
const chat = (readFileSync(new URL('../js/aio-chat.js',import.meta.url),'utf8') + '\n' + readFileSync(new URL('../src/ai/response/request-pipeline.js',import.meta.url),'utf8'));
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
