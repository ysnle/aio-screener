// P1608: execute source-first selection, recency boundaries and the actual
// legacy Responses adapter. No network, provider key or paid API is used.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { selectNativeSearch, attachNativeSearch, hasInternalCurrentEvidence } from '../src/ai/research/native-search.js';
import { evaluateResearchEvidenceFloor } from '../src/ai/research/evidence.js';
import { buildQuestionDomainContext } from '../src/ai/context/market-content.js';
const now = Date.parse('2026-10-11T06:00:00Z');
const health = { ai: { paidWebSearchEnabled: true, maxTokens: 4000 } };
const plan = { queryId: 'test-query', query: 'NVDA 현재 주가', intent: { primary: 'ENTITY_FACT' },
  researchDecision: { requirement: 'OPTIONAL', currentSensitive: true, decidedAt: new Date(now).toISOString() },
  researchPlan: { eventWindow: { asOf: '2026-10-11', lookbackDays: 1 }, stopConditions: { minimumIndependentSources: 1, minimumPrimarySources: 1 } } };
const row = { symbol: 'NVDA', source: 'fixture', observedAt: '2026-10-10T20:00:00Z', decisionUse: true, truthStatus: 'current', hasLivePrice: true };
const internal = hasInternalCurrentEvidence({ freshness: { status: 'ok', after: { quoteRows: [row] } }, tickers: ['NVDA'], questionPlan: plan, now });
assert.equal(internal, true, 'P1608 usable injected quote answers a price question');
const select = overrides => selectNativeSearch({ decision: plan.researchDecision, questionPlan: plan, health, ...overrides });
assert.equal(select({ internalEvidenceReady: internal }), false, 'P1608 sufficient internal coverage avoids a paid request');
assert.equal(select({ internalEvidenceReady: false }), true, 'P1608 missing internal evidence enables supplementation');
for (const overrides of [{ optedOut: true }, { preparation: { cancelled: true } }, { preparation: { externalEvidenceReady: true } }, { health: { ai: { paidWebSearchEnabled: false } } }, { decision: { requirement: 'NOT_NEEDED' } }])
  assert.equal(select(overrides), false, 'P1608 opt-out/cancel/external evidence/old Worker/concept avoids paid search');
assert.equal(hasInternalCurrentEvidence({ freshness: { status: 'ok', after: { quoteRows: [row] } }, tickers: ['AMD'], questionPlan: plan, now }), false, 'P1608 another ticker is not coverage');
assert.equal(hasInternalCurrentEvidence({ freshness: { status: 'ok', after: { quoteRows: [row] } }, tickers: ['NVDA'], questionPlan: { ...plan, query: 'NVDA 현재 사업 구조' }, now }), false, 'P1608 a quote is not business evidence');
assert.equal(hasInternalCurrentEvidence({ freshness: { status: 'ok', after: { quoteRows: [{ ...row, observedAt: '2017-01-01' }] } }, tickers: ['NVDA'], questionPlan: plan, now }), false, 'P1608 stale timestamp cannot avoid research');
const cite = { url: 'https://www.sec.gov/Archives/test', title: 'Filing', requestId: 'test-query' };
const requiredPlan = { ...plan, researchDecision: { ...plan.researchDecision, requirement: 'REQUIRED' } };
const floor = citation => evaluateResearchEvidenceFloor({ questionPlan: requiredPlan, nativeCitations: [citation] });
const undated = floor(cite);
assert.equal(undated.ready, true, 'P1608 datedness does not erase reference citations');
assert.equal(undated.currentClaimsAllowed, false, 'P1608 undated URL never certifies current claims');
assert.equal(undated.freshnessStatus, 'UNDATED', 'P1608 missing publication time stays explicit');
assert.equal(undated.evidenceDocuments[0].requestId, 'test-query', 'P1608 normalized native evidence preserves request binding');
assert.equal(undated.evidenceDocuments[0].sourceType, 'openai-native-web-search', 'P1608 actual provider identity is preserved');
assert.equal(floor({ ...cite, publishedAt: '2017-01-01', fetchedAt: new Date(now).toISOString() }).freshnessStatus, 'STALE', 'P1608 collection time cannot replace publication time');
assert.equal(floor({ ...cite, publishedAt: '2026-10-11T05:00:00Z' }).currentClaimsAllowed, true, 'P1608 in-window bound official evidence can certify recency');
assert.equal(floor({ ...cite, publishedAt: '2026-10-12' }).currentClaimsAllowed, false, 'P1608 future evidence cannot certify recency');
assert.equal(floor({ ...cite, requestId: 'other' }).ready, false, 'P1608 another request cannot supply citations');
const externalResult = { citations: [cite], researchEvidence: { currentClaimsAllowed: true, evidenceDocuments: [{ canonicalUrl: cite.url, title: cite.title, contentDepth: 'EXCERPT', rights: 'PUBLIC_REFERENCE', requestId: cite.requestId }] } };
assert.equal(select({ externalResult }), false, 'P1608 sufficient optional external evidence avoids duplicate paid search');
assert.equal(attachNativeSearch({ input: 'test' }, { enabled: true, health: { ai: {} } }).tools, undefined, 'P1608 old Worker gets no unsupported tool');

const chat = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
const optional = { requirement: 'OPTIONAL', currentSensitive: false };
assert.equal(select({ decision: optional, questionPlan: { ...plan, query: 'NVDA 재무 요약' }, internalReferenceEvidence: { deep: true } }), false, 'P1608 existing company evidence avoids optional search');
assert.equal(select({ decision: optional, questionPlan: { ...plan, query: 'NVDA 경쟁 해자' }, internalReferenceEvidence: { deep: true } }), true, 'P1608 financial evidence alone does not cover a moat question');
assert.equal(select({ decision: optional, internalReferenceEvidence: {} }), true, 'P1608 missing optional company evidence permits supplementation');
const start = chat.indexOf('async function callSharedAi(');
const end = chat.indexOf('\nvar _detectSectorQuery', start);
assert.ok(start >= 0 && end > start, 'P1608 production adapter extraction exists');
let sent, done, error;
const stream = { citations: [], researchError: null };
const output = { id: 'resp_mock', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '참고 설명', annotations: [{ type: 'url_citation', url: cite.url, title: cite.title }] }] }] };
const events = [{ type: 'response.output_text.delta', delta: '참고 설명' }, { type: 'response.completed', response: output }];
const context = vm.createContext({ window: { AIO: { attachNativeSearch } }, console: { log() {} }, AbortController, TextDecoder, setTimeout, clearTimeout,
  getApiKey: () => '', getModelConfig: () => ({ reasoningEffort: 'none', label: 'fixture' }),
  _aioAIRequestStream: () => stream, _aioThrowIfChatAborted: signal => { if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); },
  _aioEnsureClaudeRoute: async () => ({ ok: true, target: { url: 'https://worker.test/openai' }, health }),
  _aioLinkChatAbortSignal: () => () => {}, _aioAppToken: () => '',
  _aioFetchClaudeWithRetry: async (_url, init) => { sent = JSON.parse(init.body); return new Response(events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''), { headers: { 'Content-Type': 'text/event-stream' } }); },
  _aioChatError: value => ({ displayMessage: value.message }) });
vm.runInContext(chat.slice(start, end), context);
await context.callSharedAi('public context', [{ role: 'user', content: '최근 공시를 확인해줘' }], () => {}, text => { done = text; }, text => { error = text; }, { webSearch: true, requestId: 'test-query' });
assert.equal(error, undefined, 'P1608 actual adapter completes offline search fixture');
assert.equal(done, '참고 설명', 'P1608 source-based reference answer remains visible');
assert.equal(sent.tools[0].type, 'web_search', 'P1608 actual common transport attaches hosted search');
assert.equal(sent.max_tool_calls, 2, 'P1608 actual transport limits repeated tool work');
assert.equal(stream.citations[0].requestId, 'test-query', 'P1608 streamed annotation belongs to this request');
assert.equal(stream.citations[0].url, cite.url, 'P1608 actual provider annotation reaches citation output');
console.log('PASS: P1608 conditional native search selection, recency and actual Responses stream (offline).');
// Execute both production caller selection blocks, not just the pure helper.
context.window.AIO.selectNativeSearch = selectNativeSearch;
context.window.AIO.hasInternalCurrentEvidence = args => hasInternalCurrentEvidence({ ...args, now });
context.window._aioLastClaudeRouteState = { health };
context.localStorage = { getItem: () => null };
context.q = plan.query; context.ctxId = 'ticker'; context.detectedTickers = ['NVDA'];
context._aioQuestionPlan = plan; context._uniQuestionPlan = plan;
context.chatFreshPreflight = { status: 'ok', after: { quoteRows: [row] } };
context._uniFreshPreflight = context.chatFreshPreflight;
context._preparedResearchForChat = {}; context._uniPreparedResearch = {};
context.webSearchResult = null; context._uniWebResult = null;
context._uniResearchRequired = false; context._uniResearchFailure = null;
context._researchRequiredForChat = false; context._researchDecisionForChat = plan.researchDecision;
context._uniResearchDecision = plan.researchDecision;
for (const name of ['tickerDataStr', 'singleDeepStr', 'deepCompareStr', 'sectorCompareStr', 'domainDataStr', 'newsContextStr', '_uniTickerData', '_uniDeepData', '_uniDomainData', '_uniNewsCtx']) context[name] = '';
const helperStart = chat.indexOf('function _shouldUseClaudeWebSearch(');
vm.runInContext(chat.slice(helperStart, chat.indexOf('\nwindow._shouldUseClaudeWebSearch', helperStart)), context);
// v57.62: the per-page chatSend caller was retired; the unified panel is the only production chat caller.
assert.ok(!chat.includes('var _useClaudeWebSearch = false;') && !chat.includes('async function chatSend('), 'v57.62 per-page chatSend caller retired');
for (const [variable, marker] of [['_uniUseClaudeWebSearch', 'var _uniUseClaudeWebSearch = false;']]) {
  const blockStart = chat.indexOf(marker);
  // P1740: the unified caller decides once in _uniDecideWebSearch (before its status blocks); run that actual function.
  const block = variable === '_uniUseClaudeWebSearch'
    ? chat.slice(blockStart, chat.indexOf('var _withTimeout', blockStart)) + '\n_uniDecideWebSearch();'
    : chat.slice(blockStart, chat.indexOf('if (' + variable + ') {', blockStart));
  assert.ok(blockStart >= 0 && !/\bawait\b/.test(block), 'P1608 decision block is extractable without async preparation');
  vm.runInContext(block, context);
  assert.equal(context[variable], false, 'P1608 actual caller passes the question plan and uses internal coverage');
  context.chatFreshPreflight = null; context._uniFreshPreflight = null;
  vm.runInContext(block, context);
  assert.equal(context[variable], true, 'P1608 actual caller supplements missing internal evidence');
  context.webSearchResult = externalResult; context._uniWebResult = externalResult;
  vm.runInContext(block, context);
  assert.equal(context[variable], false, 'P1608 actual caller avoids duplicate search with sufficient external evidence');
  context.webSearchResult = null; context._uniWebResult = null;
  context._preparedResearchForChat = { nativeFallbackRequired: true }; context._uniPreparedResearch = context._preparedResearchForChat;
  context._researchRequiredForChat = true; context._uniResearchRequired = true;
  vm.runInContext(block, context);
  assert.equal(context[variable], true, 'P1655 a required question always reaches the shared Worker search (no opt-out)');
  context.chatFreshPreflight = { status: 'ok', after: { quoteRows: [row] } }; context._uniFreshPreflight = context.chatFreshPreflight;
}
console.log('PASS: P1608 the production chat caller preserves internal/external evidence; required research always reaches the Worker.');
// P1653/P1655: the opt-out toggle is retired; neither the transport nor core keeps a per-browser preference.
const core = readFileSync(new URL('../js/aio-core.js', import.meta.url), 'utf8');
assert.equal(/aio_web_search_enabled/.test(chat) || /aio_web_search_enabled/.test(core), false, 'P1655 no web-search opt-out preference remains');
console.log('PASS: P1655 web search is automatic (no opt-out preference).');

// P1621: exercise the real single-company block with an already-loaded screen cache (v57.62: per-page copy retired).
for (const [startMarker, endMarker, outputName] of [
  ['var _isFundCtx =', '\n    // 5. 웹검색', 'sysPrompt']
]) {
  const startAt = outputName === 'sysPrompt' ? chat.indexOf(startMarker, chat.indexOf('// 4. 단일 기업')) : chat.indexOf(startMarker);
  const endAt = chat.indexOf(endMarker, startAt);
  assert.ok(startAt >= 0 && endAt > startAt, 'P1621 production financial block is extractable');
  let reads = 0;
  const financial = vm.createContext({ window: { _fundAnalysisData: { ticker: 'NVDA' } }, ctxId: 'home', q: 'NVDA 재무 요약', detectedTickers: ['NVDA'], deepCompareStr: '', sysPrompt: '',
    _shouldSingleDeepAnalyzeChat: () => true, _fetchDeepCompareData: async () => { reads++; return { NVDA: { secFundamentals: { source: 'SEC' } } }; },
    _formatSingleDeepPrompt: () => 'SEC 공시 실제 자료', _wrapUnifiedExternal: (_name, text) => text, _withTimeout: promise => promise,
    _isCurrentChatRun: () => true, _isCurrentUnifiedRun: () => true, _chatSignal: null, _uniSignal: null, _aioLog: () => {}, _aioReleaseChatRequest: () => {} });
  await vm.runInContext('(async function(){' + chat.slice(startAt, endAt) + ';return ' + outputName + ';})()', financial).then(result => {
    assert.ok(result.includes('SEC 공시 실제 자료'), 'P1621 loaded screen financials cannot suppress prompt financial evidence');
  });
  assert.equal(reads, 1, 'P1621 shared financial provider/cache is reused by each caller');
}
const domainStart = chat.indexOf('function _aioDomainContextForQuestion(');
const domainEnd = chat.indexOf('\n}', domainStart) + 2;
const domainCalls = [];
const domain = vm.createContext({ window: { AIO: { buildQuestionDomainContext }, _aioHistory: [{ date: '2026-10-09', spx: 7800, breadth50: 34.7 }] }, _fetchDomainContextForChat: id => { domainCalls.push(id); return id + ' facts'; } });
vm.runInContext(chat.slice(domainStart, domainEnd), domain);
assert.ok(domain._aioDomainContextForQuestion('home', 'CPI와 채권 및 섹터, 시장 폭').includes('34.7%'), 'P1621 native facts reach cross-page questions through the production facade');
assert.deepEqual(domainCalls, ['macro', 'fxbond', 'themes'], 'P1621 home questions select existing macro, bonds and themes contexts');
console.log('PASS: P1621 the financial caller block and question-selected internal domains (offline).');
