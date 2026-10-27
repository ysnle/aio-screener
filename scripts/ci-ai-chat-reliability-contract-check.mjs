#!/usr/bin/env node
// AI chat reliability and transport. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('ai-chat-reliability', [
// ── section reliability (was ci-ai-chat-reliability-contract-check.mjs) ──
['reliability', async () => {
// AI chat reliability contract. This is a static gate for the shared
// credential/route/control-plane invariants; it does not call a provider.
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const chat = read('js/aio-chat.js') + String.fromCharCode(10) + read('src/data/providers/shared-ai-transport.js') + String.fromCharCode(10) + read('src/ai/response/request-pipeline.js'); // v59.11: the shared AI route moved to the transport module; v59.15: the request/response pipeline module
const data = read('js/aio-data.js');
const html = read('index.html');
// P1136/R620: the sidebar credential-save handler (and other user-state writers) moved with
// index.html's inline block A into js/aio-workspace.js.
const workspace = read('js/aio-workspace.js');
const worker = read('cloudflare-worker-proxy.js');
const config = json('public-config.json');
const operations = json('public-data/operations-status.json');

// v57.79: retired personal provider keys left the registry (no input, no reader); the sensitive set still lists
// them so any leftover stored value stays encrypted until boot deletes it.
for (const key of ['aio_rss2json_key', 'aio_bok_key', 'aio_kosis_key']) {
  check(`v57.79 provider registry excludes retired ${key}`, !core.includes(`credentialKey: '${key}'`)); // text-pin-ok: retirement absence
  check(`sensitive key set includes ${key}`, core.includes(`'${key}'`));
}
check('v57.79 provider registry keeps the self-proxy URL credential', core.includes("credentialKey: 'aio_cf_worker_url'"));
check('safeLS returns a write result', core.includes('return { ok: true, key: key, removed: false'));
check('safeLS throws on write failure', /async function safeLS\([\s\S]{0,1800}throw e;/.test(core));
check('credential save performs readback', core.includes('persistence_readback_mismatch') && core.includes('safeLSGet(lsKey, \'\')'));
check('credential save has no plaintext fallback', !/safeLS[\s\S]{0,120}localStorage\.setItem\(lsKey/.test(core));
// P1136/R620: the sidebar credential-save handler moved with inline block A into js/aio-workspace.js.
// P1421: browser personal AI credentials cannot bypass the shared monthly authority.
check('P1421: personal AI helpers fail closed', workspace.includes("function getApiKey() { return ''; }") && !workspace.includes('function setApiKey') /* v58.19: the zero-caller setApiKey stub is retired, so no saver exists */ && !html.includes('id="sidebar-api-key"'));
check('P1421: retired AI credentials cannot be read or saved', core.includes("lsKey === 'aio_claude_api_key' || lsKey === 'aio_perplexity_key'") && !core.includes("credentialKey: 'aio_claude_api_key'"));
check('route readiness is explicit', chat.includes("reason: 'NO_ROUTE'") && chat.includes('WORKER_NOT_READY'));
check('route readiness follows the selected target and never bypasses Worker health because a personal key also exists', chat.indexOf('if (!target || !target.serverKey)') < chat.indexOf('var cacheTtl = cached && cached.ok') && uiRouteReadinessUsesTarget());
check('Worker health is deduplicated and transient failures have a short cache', chat.includes('_aioWorkerHealthInFlight[target.workerUrl]') && chat.includes('cached && cached.ok ? 60000 : 5000') && /var _AIO_HEALTH_TIMEOUT_MS = 12000;[\s\S]*ctrl\.abort\(\); \}, _AIO_HEALTH_TIMEOUT_MS\)[\s\S]*timeoutMs: _AIO_HEALTH_TIMEOUT_MS \+ 500/.test(chat));
// P1131/R619: the unified chat surface moved from index.html's inline block G into js/aio-chat.js,
// so these three `_uni*` assertions now read the chat module.
// v57.62: the dead per-page chatSend was retired, so these read the one remaining (unified) chat surface.
check('v57.62 per-page chatSend retired (unified panel is the only chat surface)', !chat.includes('async function chatSend(') && chat.includes('async function chatSendUnified('));
check('v57.62 research preparation is shared and cancellable in the chat surface', chat.includes('async function _aioPrepareAIResearch') && chat.includes('_aioPrepareAIResearch(_uniQuestionPlan, { signal: _uniResearchAbort.signal })'));
check('knowledge reference retrieval is shared through the existing orchestrator facade boundary', chat.includes('_uniKnowledgeOrchestrator.buildAIKnowledgeContext(q') && read('src/ai/retrieval/knowledge.js').includes('currentClaimsAllowed: false'));
check('research opt-out preserves non-current answer path', chat.includes("_uniResearchFailure.code === 'DISABLED_BY_USER') _uniUseClaudeWebSearch = false;") && !/DISABLED_BY_USER'\)[^\n]{0,200}return;/.test(chat));
check('required research always hands off to the shared Worker search (P1655)', chat.includes('nativeFallbackRequired: required && !decision.userOptOut'));
check('research evidence gate is executable ESM SSOT', chat.includes('evaluateAIResearchEvidenceFloor') && !chat.includes('function _aioBuildResearchEvidenceDocuments'));
check('Worker route does not certify native search tool', core.includes("'NATIVE_TOOL_UNVERIFIED'") && !core.includes("'NATIVE_TOOL_ROUTE_READY'") && core.includes('nativeCitationCount'));
check('P1655 research diagnostic audit exposes contract and last preparation', core.includes('contractReady: contractReady') && core.includes('lastPreparation:') && core.includes("transport: 'shared-worker'"));
const normalizeWorkerUrl = value => String(value || '').trim().replace(/\/+$/, '');
const configWorkerUrl = normalizeWorkerUrl(config.ai?.workerUrl);
const operationsWorkerUrl = normalizeWorkerUrl(operations.ai?.publicChat?.workerEndpoint);
const publicRoutePublished = /^https:\/\//i.test(configWorkerUrl) && config.ai?.routeStatus === 'PUBLISHED';
const publicRouteDisabled = config.ai?.routeStatus === 'DISABLED'
  && config.ai?.serverMode === 'shared-worker-only'
  && config.ai?.chatPolicy === 'shared-worker-only'
  && typeof config.ai?.routeReason === 'string'
  && config.ai.routeReason.length > 0
  && config.ai?.routeEvidence?.status === 'OPERATOR_REQUIRED';
check('P1421 public config publishes only matching provider evidence or explicitly holds AI', config.schemaVersion === 'ai-public-config.v1'
  && config.ai?.provider === 'openai' && config.ai?.model === 'gpt-6-luna'
  && config.appRevision === operations.appRevision
  && ((publicRoutePublished
    && config.ai?.routeStatus === 'PUBLISHED'
    && config.ai?.routeEvidence?.status === 'CURRENT'
    && configWorkerUrl === operationsWorkerUrl
    && config.ai?.serverMode === 'shared-worker-only'
    && config.ai?.chatPolicy === 'shared-worker-only'
    && operations.ai?.publicChat?.statusCode === 'CONFIGURED_HEALTHY'
    && operations.ai?.publicChat?.health?.provider === 'openai'
    && operations.ai?.publicChat?.health?.model === 'gpt-6-luna')
    || publicRouteDisabled));
const bootRouteContract = publicRoutePublished
  ? core.includes(`workerUrl: '${configWorkerUrl}'`) && core.includes("serverMode: 'shared-worker-only'")
  : core.includes('workerUrl: workerUrl || null') && core.includes('loadPublicConfig');
check('P1421 boot fallback follows the generated shared policy without storing a provider secret', bootRouteContract && !/(?:ANTHROPIC|OPENAI)_API_KEY/.test(read('public-config.json')));
check('P1421: AI target is exclusively the published Worker', chat.includes("publicWorker + '/openai'") && !chat.includes('api.anthropic.com') && !chat.includes("source: 'personal-key'") && !chat.includes("source: 'local-config'"));
check('v57.62 the chat surface uses the expanded evidence registry', chat.includes('function _aioCollectAIClaimEvidence') && chat.includes('evidence: _uniClaimEvidence')); // v57.62: per-page copy retired
check('invalid or unbound AnswerPlan claims degrade claim scope instead of erasing the answer', chat.includes('answer-plan-claim-degraded') && chat.includes('droppedClaims') && !chat.includes("blocked: true,\n      text: 'AI 베타 안전 모드\\n\\n현재성 수치의 AnswerPlan claim"));
check('partial structured streams hide control JSON until completion', chat.includes("visible = 'AI 답변을 구성하고 근거를 검증하는 중…'") && chat.includes("var isPartialStream = meta.streamPhase === 'partial'"));
check('Worker token cap and stop reason are consumed by the client', chat.includes('workerMaxTokens') && chat.includes('effectiveMaxTokens') && chat.includes("stopReason === 'max_tokens'") && chat.includes('completion: completion || null'));
// Legacy unification (2026-10-17): the gate lives in src/data/server-market-analysis.js; run it with prose that passes
// every check except the typed metric evidence.
{
  const { verifyServerMarketAnalysis } = await import('../src/data/server-market-analysis.js');
  const claimed = { full: 'prose', semanticStatus: 'verified', schemaVersion: 'market-analysis.v2', claims: [{ text: 'c', evidenceIds: ['e1'] }] };
  const row = (id) => ({ evidenceId: id, metricId: 'market.spx', unit: 'pt', source: 's', asOf: '2026-10-16T20:00:00Z', value: 1 });
  const untyped = verifyServerMarketAnalysis({ ...claimed, metricEvidence: [{ evidenceId: 'e1' }, { evidenceId: 'e2' }] });
  const typed = verifyServerMarketAnalysis({ ...claimed, metricEvidence: [row('e1'), row('e2')] });
  check('server market prose requires typed evidence before client publish', untyped.analysis === null && untyped.meta.reason === 'metric-evidence-required' && typed.analysis?.status === 'verified');
}
check('Worker exposes health readiness', worker.includes("_u.pathname === '/health'") && worker.includes("schemaVersion: 'aio-worker-health.v1'") && worker.includes('ai: { configured'));
check('Worker CORS allows every browser chat header', worker.includes('X-AIO-App-Token') && worker.includes('Access-Control-Allow-Headers'));
// v56: the rollback helper is shared with /relay, so it is no longer Anthropic-specific
// by name. The property under test is unchanged: only the request that owns a failed
// reservation may release it.
check('Worker rolls back owned failed quota reservations', /async function releaseQuota\(/.test(worker) && worker.includes('ownedReservation'));
check('Worker exposes effective token cap', worker.includes("'X-AIO-Max-Tokens'"));
check('operations status separates scheduled analysis and public chat', operations.ai?.scheduledAnalysis && operations.ai?.publicChat?.scheduledAnalysisDoesNotImplyChat === true);
check('operations status separates five readiness fields', ['secretConfigured', 'workflowWired', 'lastCallSucceeded', 'dataCurrent', 'licensedForUse'].every(field => read('public-data/operations-status.json').includes(`"${field}"`)));

function uiRouteReadinessUsesTarget() {
  const ui = read('js/aio-ui.js');
  return ui.includes("_aioClaudeTarget()") && ui.includes("target && target.serverKey ? target.workerUrl : ''");
}

if (errors.length) {
  console.error(`AI chat reliability contract failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('AI chat reliability contract OK');
}],
// ── section provider-stream (was ci-ai-provider-stream-check.mjs) ──
['provider-stream', async () => {
// Isolated transport fixtures; no API key or external network is used.
const { readFileSync } = await import('node:fs');
const { default: vm } = await import('node:vm');
const { default: assert } = await import('node:assert/strict');

const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/ai/response/request-pipeline.js', import.meta.url), 'utf8'); // v59.15: the request/response pipeline moved to its module
const start = source.indexOf('async function callSharedAi(');
const end = source.indexOf('// ── 스크리너 질의', start);
assert(start >= 0 && end > start);
// P1245 (05 A05): callSharedAi records native citations and research tool errors in the per-request
// stream store, so this isolated transport context must execute the real store rather than a stub
// that can drift from it. The fixture passes no requestId, so the store returns no record and the
// transport assertions below are unchanged.
const storeStart = source.indexOf('var _AIO_AI_REQUEST_STREAM_LIMIT');
const storeEnd = source.indexOf('// P897: the ESM evidence module', storeStart);
assert(storeStart >= 0 && storeEnd > storeStart);
const encode = value => new TextEncoder().encode(value);
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
const text = event({ type: 'response.output_text.delta', delta: 'verified' });
const terminal = 'data: ' + JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 12, input_tokens_details: { cached_tokens: 4 }, output_tokens: 8 } } });
let assertions = 0;
for (const serverKey of [true]) {
  for (const kind of ['complete', 'provider-error', 'premature-eof', 'invalid-event', 'incomplete', 'filtered', 'response-failed', 'citations', 'error-body-timeout', 'caller-abort']) {
    const deadlines = new Map();
    const result = { done: [], errors: [], cancelled: 0 };
    const caller = new AbortController();
    const context = {
      console: { log() {}, warn() {} }, AbortController, TextDecoder, performance,
      setTimeout(callback, delay) { const id = {}; deadlines.set(id, { callback, delay }); return id; },
      clearTimeout(id) { deadlines.delete(id); },
      getApiKey: () => 'fixture-only',
      getModelConfig: () => ({ id: 'gpt-6-luna', label: 'fixture', reasoningEffort: 'none' }),
      _aioEnsureClaudeRoute: async () => ({ ok: true, target: { url: 'https://fixture.invalid', serverKey } }),
      _aioThrowIfChatAborted(signal) { if (signal?.aborted) throw signal.reason; },
      _aioLinkChatAbortSignal(signal, controller) { const cancel = () => controller.abort(); signal.addEventListener('abort', cancel); return () => signal.removeEventListener('abort', cancel); },
      _aioChatError: error => ({ displayMessage: error.message }),
      _aioAppToken: () => '',
      _aioFetchClaudeWithRetry: async (_url, options) => {
        const bodyJson = JSON.parse(options.body);
        assert.equal(bodyJson.model, 'gpt-6-luna'); assert.equal(bodyJson.store, false);
        assert.equal(bodyJson.reasoning.effort, 'none'); assert.equal(bodyJson.max_output_tokens, 4000);
        assert.equal(bodyJson.input[0].role, 'user'); assert.equal(bodyJson.instructions, 'fixture');
        assert.equal(options.headers['X-AIO-Idempotency-Key'], 'fixture-stream-' + kind);
        assert(!bodyJson.tools); assert(!options.headers['x-api-key']); assert(!options.headers.Authorization);
        if (kind === 'error-body-timeout' || kind === 'caller-abort') {
          return {
            status: 500, ok: false,
            text: () => new Promise((_resolve, reject) => {
              options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
              if (kind === 'caller-abort') caller.abort();
              else for (const entry of [...deadlines.values()]) if (entry.delay === 30000) entry.callback();
            }),
          };
        }
        const body = kind === 'complete' ? text + terminal
          : kind === 'citations' ? text + event({ type: 'response.output_text.annotation.added', annotation: { type: 'url_citation', url: 'https://sec.gov/fixture', title: 'SEC' } }) + event({ type: 'response.output_text.annotation.added', annotation: { type: 'url_citation', url: 'javascript:alert(1)' } }) + terminal
          : kind === 'response-failed' ? text + event({ type: 'response.failed', response: { error: { message: 'provider failed' } } })
          : kind === 'filtered' ? text + event({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'content_filter' } } })
          : kind === 'incomplete' ? text + event({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } })
          : kind === 'provider-error' ? text + event({ type: 'error', error: { message: 'fixture overloaded' } })
          : kind === 'invalid-event' ? text + 'data: {broken}\n\n' : text;
        return new Response(new ReadableStream({ start(controller) {
          // Deliberately split the payload and leave the terminal line without LF.
          controller.enqueue(encode(body.slice(0, 17)));
          controller.enqueue(encode(body.slice(17)));
          controller.close();
        } }));
      },
    };
    context.window = context;
    context._lastClaudeUsage = { input_tokens: 99999 };
    vm.createContext(context);
    vm.runInContext(source.slice(storeStart, storeEnd) + '\n' + source.slice(start, end), context);
    await context.callSharedAi('fixture', [{ role: 'user', content: 'test' }], () => {},
      (...args) => result.done.push(args), error => result.errors.push(error),
      { signal: caller.signal, requestId: 'fixture-stream-' + kind, onCancel() { result.cancelled++; } });
    if (kind === 'complete' || kind === 'citations') {
      assert.equal(result.done.length, 1);
      assert.equal(result.done[0][0], 'verified');
      assert.equal(context._lastClaudeUsage.input_tokens, 12, 'prior request usage must not leak');
      assert.equal(context._lastClaudeUsage.output_tokens, 8);
      assert.equal(result.errors.length, 0);
      if (kind === 'citations') {
        const citations = context._aioAIRequestStream('fixture-stream-' + kind).citations;
        assert.equal(citations.length, 1); assert.equal(citations[0].url, 'https://sec.gov/fixture');
        assert.equal(citations[0].requestId, 'fixture-stream-citations');
      }
    } else if (kind === 'incomplete' || kind === 'filtered') {
      assert.equal(result.done.length, 1); assert.equal(result.done[0][1].truncated, true);
      assert.equal(result.done[0][1].stopReason, kind === 'filtered' ? 'incomplete' : 'max_output_tokens'); assert.equal(result.errors.length, 0);
    } else if (kind === 'caller-abort') {
      assert.equal(result.cancelled, 1);
      assert.equal(result.errors.length, 0);
      assert.equal(result.done.length, 0);
    } else {
      assert.equal(result.done.length, 0, kind + ' cannot complete successfully');
      assert.equal(result.errors.length, 1, kind + ' must report failure');
      assert.equal(result.cancelled, 0, 'timeout is not user cancellation');
      // P1421: a Responses failure must remain attached to its owning request.
      if (kind === 'provider-error' || kind === 'response-failed') {
        assert.equal(context._aioAIRequestStream('fixture-stream-' + kind).researchError,
          kind === 'provider-error' ? 'fixture overloaded' : 'provider failed');
      }
    }
    assert.equal(deadlines.size, 0, kind + ' must clean timers');
    assertions++;
  }
}
console.log('AI provider stream check OK: ' + assertions + ' isolated Responses Worker transport scenarios.');
}],
// ── section chat-resilience (was ci-chat-resilience-check.mjs) ──
['chat-resilience', async () => {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { default: vm } = await import('node:vm');
const { createAIKnowledgeRetriever } = await import('../src/ai/retrieval/knowledge.js');
const { evaluateResearchEvidenceFloor } = await import('../src/ai/research/evidence.js');
const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/ai/response/request-pipeline.js', import.meta.url), 'utf8'); // v59.15: the request/response pipeline moved to its module
const section = (a,b) => { const start=source.indexOf(a), end=source.indexOf(b,start); assert(start>=0 && end>start); return source.slice(start,end); };
const states = {}, button = { disabled: true }, documentListeners = {};
const root = { AbortController, setTimeout, clearTimeout, URL, console, document: {
  getElementById:()=>button,
  addEventListener:(name, handler)=>{ documentListeners[name] = handler; }
},
  getChatState: id => states[id] ||= {}, chatState: states, _aioSetChatRuntimeState() {}, _aioLog() {},
  localStorage: { getItem:()=>null }, _getApiKey:()=> 'fixture', escHtml:String };
root.window=root;
vm.createContext(root);
// v59.11: the cancellation helpers come from the shared transport module (moved from js/aio-chat.js).
const { installSharedRoute } = await import('../src/data/providers/shared-ai-transport.js');
const transport = installSharedRoute({});
for (const name of ['_aioChatAbortError', '_aioThrowIfChatAborted', '_aioRunChatTask', '_aioLinkChatAbortSignal']) root[name] = transport[name];
vm.runInContext(section('function _aioBeginChatRequest(', '// ── Text processing helpers'), root);
vm.runInContext(section('function _aioCanonicalResearchUrl(', '/** 검색 출처 → UI HTML */'), root);
vm.runInContext(section('function _aioResearchFailureForUser(', '// ── Send message'), root);
vm.runInContext(section('function _shouldUseClaudeWebSearch(', 'function _aioCanonicalResearchUrl('), root);
vm.runInContext(section('function _searchCitationsHTML(', 'function _aioResearchFailureForUser('), root);
const first=root._aioBeginChatRequest('home','old'), second=root._aioBeginChatRequest('home','new');
assert(first.controller.signal.aborted && !root._aioIsCurrentChatRequest('home', first));
root._aioReleaseChatRequest(first); assert(states.home.streaming && states.home._activeRequest===second);
root._aioCancelChatRequest('home','cleared'); assert(!states.home.streaming && second.controller.signal.aborted && !button.disabled);
let retried=false;
const third=root._aioBeginChatRequest('home','retry'); third.retryTimer=setTimeout(()=>{retried=true;},10);
root._aioCancelChatRequest('home','clear'); await new Promise(resolve=>setTimeout(resolve,20)); assert(!retried);
const unifiedRun=root._aioBeginChatRequest('home','unified',{entrypoint:'unified-chat',routeId:'fundamental',buttonId:'ai-panel-btn',loadingId:'ai-panel-loading',streamingId:'ai-panel-streaming'});
assert.equal(unifiedRun.entrypoint,'unified-chat'); assert(states.home.streaming && states.home._activeRequest===unifiedRun);
documentListeners['aio:pageShown']({detail:'technical'});
assert(unifiedRun.controller.signal.aborted && !root._aioIsCurrentChatRequest('home', unifiedRun));
root._aiCtxMap={'trend':'themes','themes':'themes'}; // a legacy route alias (kr-themes retired v57.54)
const aliasRun=root._aioBeginChatRequest('themes','alias',{entrypoint:'unified-chat',routeId:'themes',buttonId:'ai-panel-btn',loadingId:'ai-panel-loading',streamingId:'ai-panel-streaming'});
documentListeners['aio:pageShown']({detail:'trend'});
assert(!aliasRun.controller.signal.aborted && root._aioIsCurrentChatRequest('themes', aliasRun));
root._aioCancelChatRequest('themes','route-test');
let timedOutSignal;
await assert.rejects(root._aioRunChatTask(signal => { timedOutSignal = signal; return new Promise(()=>{}); },{timeoutMs:5}),{code:'RESEARCH_TIMEOUT'});
assert(timedOutSignal && timedOutSignal.aborted);
// P1655: no browser-side search provider remains; a required question always hands off to the shared Worker search.
const prepared=await root._aioPrepareAIResearch({researchDecision:{requirement:'REQUIRED'},researchPlan:{planId:'p'}});
assert(prepared.nativeFallbackRequired===true && prepared.externalResult===null && prepared.failure===null);
assert.equal((await root._aioPrepareAIResearch({researchDecision:{requirement:'NOT_NEEDED'}})).nativeFallbackRequired,false);
assert(!/_aiWebSearch|_googleSearch|_perplexitySearch|_needsWebSearch/.test(source));
const plan={researchDecision:{requirement:'REQUIRED'},researchPlan:{planId:'p',stopConditions:{minimumIndependentSources:1,minimumPrimarySources:1}}};
assert.equal(root._shouldUseClaudeWebSearch('today','home',[],plan,{preparation:{planId:'p',externalEvidenceReady:true}}),false);
assert.equal(root._shouldUseClaudeWebSearch('today','home',[],plan,{preparation:{planId:'old',externalEvidenceReady:true}}),false);
const doc={canonicalUrl:'https://sec.gov/report',contentDepth:'EXCERPT',rights:'PUBLIC_REFERENCE'};
const floor=evaluateResearchEvidenceFloor({questionPlan:plan,externalResult:{citations:[{url:doc.canonicalUrl}],researchEvidence:{currentClaimsAllowed:true,evidenceDocuments:[doc,{canonicalUrl:'https://example.org/snippet',contentDepth:'SNIPPET'}]}}});
assert(floor.ready && floor.eligibleEvidenceCount===1 && floor.excludedEvidenceCount===1);
assert(!evaluateResearchEvidenceFloor({questionPlan:plan,externalResult:{citations:['https://sec.gov.attacker.test'],researchEvidence:{currentClaimsAllowed:true,evidenceDocuments:[{...doc,canonicalUrl:'https://sec.gov.attacker.test'}]}}}).ready);
const html=root._searchCitationsHTML({citations:[{url:'https://sec.gov/report'},'javascript:alert(1)']});
const duplicateHtml=root._searchCitationsHTML({citations:[{url:'https://sec.gov/report',title:'Annual report'},'https://sec.gov/report']});
assert.equal((duplicateHtml.match(/<a /g)||[]).length,1);
assert(duplicateHtml.includes('Annual report') && duplicateHtml.includes('검증됐다는 뜻은 아닙니다'));
root._AIO_PUBLIC_AI_POLICY={label:'AI 베타'};
vm.runInContext(section('function _aioPublicAIFormatAsOf(', 'function _aioApplyAIActionGate('),root);
root._serverDataMeta={generatedAt:'2026-09-10T00:00:00Z'};
const disclosure=root._aioBuildAIResponseDisclosure({freshness:{after:{quoteRows:[{fetchedAt:'2026-09-10T00:00:00Z',truthStatus:'unknown'}]}}});
assert.equal(disclosure.asOf,'미확인');
assert.equal(disclosure.status,'확인 필요');
assert.equal(root._aioBuildAIResponseDisclosure({freshness:{after:{quoteRows:[{truthStatus:'verified',decisionUse:true,source:'Yahoo chart',fetchedAt:new Date().toISOString()}]}}}).status,'확인 필요');
assert.deepEqual([...html.matchAll(/<a href="([^"]*)"/g)].map((m)=>m[1]),['https://sec.gov/report']);
assert(!html.includes('javascript:'));
let loads=0;
const retry=createAIKnowledgeRetriever({timeoutMs:5,fetchImpl:()=>++loads===1 ? new Promise(()=>{}) : Promise.resolve({ok:true,json:async()=>({articles:[]})})});
assert.equal((await retry.buildContext('금리')).audit.status,'UNAVAILABLE');
assert.equal((await retry.buildContext('금리')).audit.status,'NO_RELEVANT_MATCH');
assert.equal(loads,2);
let resolveLoad; const shared=createAIKnowledgeRetriever({timeoutMs:100,fetchImpl:()=>new Promise(resolve=>{resolveLoad=resolve;})});
const cancel=new AbortController(); const a=shared.buildContext('금리',{signal:cancel.signal}), b=shared.buildContext('AI');
await Promise.resolve(); cancel.abort(); assert.equal((await a).audit.status,'CANCELLED');
resolveLoad({ok:true,json:async()=>({articles:[]})}); assert.equal((await b).audit.status,'NO_RELEVANT_MATCH');
// v57.62: the dead per-page chatSend (P1653 removed every #chat-<ctx>-inp it needed) is gone; the unified panel is the
// only chat path, so its stream callbacks carry the stale-epoch guard.
assert(!source.includes('async function chatSend(') && !source.includes('var _pageOnError = function'), 'v57.62 per-page chatSend retired');
for(const marker of ['var _uniOnChunk = function(fullText) {','var _uniOnDone = function(fullText, completion) {','var _uniOnError = function(errMsg) {']) {
  assert(source.indexOf(marker)>=0 && source.slice(source.indexOf(marker),source.indexOf(marker)+150).includes('if (!_isCurrentUnifiedRun()) return;'), 'v57.62 unified callback is epoch-guarded: '+marker);
}
// P1740: the uncalled per-page chatClear (no .acp-clear button exists) was removed; any clear entry point must cancel first.
assert(!/function chatClear\(/.test(source) || source.includes("_aioCancelChatRequest(ctxId, 'history-cleared')"));
vm.runInContext(section('window._aioChatFreshnessInfo = function()', '// ── Click a suggestion chip'), root);
root._liveData={AAA:{price:100,observedAt:new Date(Date.now()-60000).toISOString()}};
assert(!root._aioChatFreshnessInfo().liveStatus.includes('인용 자체 금지'));
root._liveData={AAA:{price:100}}; root._quoteTimestamps={AAA:Date.now()};
assert.equal(root._aioChatFreshnessInfo().ldAgeMin,null);
const shell=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../js/aio-ui.js',import.meta.url),'utf8');
// P1131/R619: the unified chat surface (inline block G) moved from index.html into js/aio-chat.js, so
// the assertions that read it now read the chat module.
const chatShell=readFileSync(new URL('../js/aio-chat.js',import.meta.url),'utf8');
// P1136/R620: showConfirmModal/_confirmCancelCallback moved with inline block A into js/aio-workspace.js.
const shellWorkspace=readFileSync(new URL('../js/aio-workspace.js',import.meta.url),'utf8');
assert(chatShell.includes('preparation: _uniPreparedResearch, externalResult: _uniWebResult'));
assert(chatShell.includes("typeof _uniPreparedResearch !== 'object'"));
const unifiedChat=chatShell.slice(chatShell.indexOf('async function chatSendUnified('),chatShell.indexOf('function aiChipClick('));
assert(unifiedChat.includes('window._aioBeginChatRequest') && unifiedChat.includes("entrypoint: 'unified-chat'"));
assert(unifiedChat.includes('_uniSignal') && unifiedChat.includes('if (!_isCurrentUnifiedRun()) return;'));
assert(unifiedChat.includes('signal: _uniSignal') && chatShell.includes("_aioCancelChatRequest(_aiCurrentCtx, 'context-changed')"));
assert(unifiedChat.includes('_uniRun.quotaPending = true') && source.includes("closeConfirmModal('chat-cancelled')"));
assert(shellWorkspace.includes('function showConfirmModal(title, msg, onConfirm, icon, onCancel)'));
assert(shellWorkspace.includes('_confirmCancelCallback') && shellWorkspace.includes("closeConfirmModal('escape')"));
// P1342: R592 is enforced by behaviour (the quota badge never flips the switch for a missing route), not by an unused snapshot helper.
assert(ui.includes('function getLLMRouteReadiness(') && ui.includes('window._aioGetLLMRouteReadiness'));
const quotaUi=ui.slice(ui.indexOf('function updateQuotaBadge()'),ui.indexOf('function toggleLLM()'));
// v57.77: AI is always on (P1653) — route readiness is the only gate; no OFF branch ('AI OFF' / unlimited quota) remains.
assert(quotaUi.includes('if (!route.ready)') && !quotaUi.includes('isOn') && !quotaUi.includes("'AI OFF'"), 'v57.77 quota badge gates on route readiness only');
const toggleUi=ui.slice(ui.indexOf('function toggleLLM()'),ui.indexOf('function consumeLLMQuery()'));
assert(toggleUi.includes('updateQuotaBadge()') && !toggleUi.includes('classList'), 'v57.77 toggleLLM only refreshes the readout');
const consumeUi=ui.slice(ui.indexOf('function consumeLLMQuery()'),ui.indexOf('// Init on load'));
assert(consumeUi.indexOf('if (!route.ready)') >= 0 && consumeUi.indexOf('return false') > consumeUi.indexOf('if (!route.ready)') && consumeUi.indexOf('return false') < consumeUi.indexOf('getQuota()'), 'v57.77 a missing route fails closed before any quota accounting');
assert(!consumeUi.includes('getLLMState'), 'v57.77 no OFF/unlimited quota shortcut'); // text-pin-ok: retirement absence
assert(consumeUi.includes('settle(false)') && consumeUi.includes('saveQuota(quota)'));
// v57.62: quota and freshness preflight contracts read the unified panel (the per-page chatSend copy was retired).
const quotaAwait=unifiedChat.indexOf('_qOk = await consumeLLMQuery();');
assert(quotaAwait>=0 && unifiedChat.indexOf('if (!_isCurrentUnifiedRun())', quotaAwait) > quotaAwait && unifiedChat.indexOf('if (!_isCurrentUnifiedRun())', quotaAwait) < unifiedChat.indexOf("inp.value = '';", quotaAwait), 'v57.62 unified quota await rejects a cancelled epoch before clearing the input');
assert(!/Promise\.race\(\[[\s\S]{0,500}ensureFreshChatAnswerData/.test(unifiedChat));
assert(/_withTimeout\(window\.AIO\.ensureFreshChatAnswerData\([\s\S]{0,260}\), 6500, 'chatFresh'/.test(unifiedChat) && /_withTimeout\(window\.AIO\.ensureFreshDataForUse\([\s\S]{0,260}\), 4500, 'freshness'/.test(unifiedChat), 'v57.62 unified freshness preflight is bounded (6.5s / 4.5s)');
const tickerChat=section('async function _fetchTickerDataForChat(', 'function _detectDeepCompareIntent(');
assert(tickerChat.includes('signal: opts.signal || null') && tickerChat.includes('_aioThrowIfChatAborted(opts.signal)'));
assert(!source.includes('function _aioChatAbortPromise('));
// v57.60: suggestion chips (KR theme buttons, follow-up chips) go through the unified AI panel; the retired per-page
// #chat-<ctx>-inp lookup (P1653) only produced a missing-input toast.
{
  const chip = section('function chatFromChip(ctxId, q) {', '// v29.1:');
  assert(chip.includes("getElementById('ai-panel-inp')") && chip.includes('chatSendUnified()') && !chip.includes("'chat-' + ctxId + '-inp'") && !/\bchatSend\(ctxId/.test(chip), 'v57.60 chatFromChip routes to the unified AI panel');
}
assert(source.includes('function _aioCanonicalSuppliedMaterialsContext(') && source.includes('var canonicalRegistry = window.AIO && window.AIO.SUPPLIED_MATERIALS_REFERENCE;'));
assert(source.includes("'kr-market': 'macro'") && !source.includes("'kr-tech'") && !source.includes("'kr-themes':") && !/'kr-macro':\s*(?:'|_aio)/.test(source)); // P1758/v57.54: kr-tech, kr-themes, kr-macro retired
assert(source.includes('function _aioWrapChatExternalContext(') && unifiedChat.includes('window._aioWrapChatExternalContext') && unifiedChat.includes("_wrapUnifiedExternal('TECHNICAL_ENRICHMENT'")); // v57.62: per-page caller retired
assert(unifiedChat.includes('_wrapUnifiedExternal') && unifiedChat.includes("_wrapUnifiedExternal('DEEP_COMPARISON'"));
// P1756: the first attempt keeps automatic web search; a retry after a timeout/5xx repeats the request without it (each
// searched attempt is billed and reserves search budget), says so in its status line, and every attempt resets the
// citation collector so a failed searched attempt's sources are never bound to the retry's answer.
{
  const uniRetry = section('var _uniOnError = function(errMsg) {', "var loadEl = document.getElementById('ai-panel-loading');");
  assert(/modelKey: nextModel, webSearch: false, signal: _uniSignal/.test(uniRetry), 'P1756 unified-panel retry runs without web search');
  assert(uniRetry.includes("', 웹 검색 없이'"), 'P1756 retry status says search is off');
  assert(/promptWithoutWebSearch \|\| String\)\(sysPrompt\)/.test(uniRetry), 'v57.54 a retry without search also tells the model it did not search (prompt line swapped)');
  assert(/modelOpts\.webSearch = true;/.test(unifiedChat) && /callSharedAi\(sysPrompt, state\.messages, _uniOnChunk, _uniOnDone, _uniOnError, Object\.assign\(\{\}, modelOpts, \{ signal: _uniSignal, requestId: _uniRequestId \}\)\)/.test(unifiedChat), 'P1756 first attempts keep automatic web search (modelOpts carries it)');
  const stream = section('async function callSharedAi(', 'function _pushWebCite(');
  assert(/\n\s*if \(_streamState\) \{[^\n]*\n\s*_streamState\.citations\.length = 0;/.test(stream), 'P1756 each attempt resets its citation collector');
}
console.log('Chat resilience PASS: shared cancellation/epochs on the unified chat path (per-page retired v57.62), retry, route/quota fail-closed, modal liveness, empty+timeout search fallback, evidence objects, source spoofing, safe links, deduplication and shared knowledge retry/cancellation (offline).');
}],
]);
