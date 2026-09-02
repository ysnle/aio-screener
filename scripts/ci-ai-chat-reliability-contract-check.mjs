// AI chat reliability contract. This is a static gate for the shared
// credential/route/control-plane invariants; it does not call a provider.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const errors = [];
const check = (label, condition) => { if (!condition) errors.push(label); };

const core = read('js/aio-core.js');
const chat = read('js/aio-chat.js');
const data = read('js/aio-data.js');
const html = read('index.html');
const worker = read('cloudflare-worker-proxy.js');
const config = json('public-config.json');
const operations = json('public-data/operations-status.json');

for (const key of ['aio_claude_api_key', 'aio_rss2json_key', 'aio_bok_key', 'aio_kosis_key']) {
  check(`provider registry includes ${key}`, core.includes(`credentialKey: '${key}'`));
  check(`sensitive key set includes ${key}`, core.includes(`'${key}'`));
}
check('safeLS returns a write result', core.includes('return { ok: true, key: key, removed: false'));
check('safeLS throws on write failure', /async function safeLS\([\s\S]{0,1800}throw e;/.test(core));
check('credential save performs readback', core.includes('persistence_readback_mismatch') && core.includes('safeLSGet(lsKey, \'\')'));
check('credential save has no plaintext fallback', !/safeLS[\s\S]{0,120}localStorage\.setItem\(lsKey/.test(core));
check('sidebar save waits for result', html.includes('const result = await setApiKey(key);') && html.includes('if (!result || !result.ok)'));
check('legacy getApiKey overload preserves Claude no-arg route', core.includes("var keyName = (name == null || name === '') ? 'aio_claude_api_key' : name") && core.includes("_AioVault._claudeKeyRuntime"));
check('legacy setApiKey overload returns credential result', core.includes("if (arguments.length < 2)") && core.includes("_aioSaveCredential('aio_claude_api_key'") && core.includes("Promise.resolve({ ok: false, state: 'KEYSTORE_UNAVAILABLE' })"));
check('route readiness is explicit', chat.includes("reason: 'NO_ROUTE'") && chat.includes('WORKER_NOT_READY'));
check('route readiness follows the selected target and never bypasses Worker health because a personal key also exists', chat.indexOf('if (!target || !target.serverKey)') < chat.indexOf('var cacheTtl = cached && cached.ok') && uiRouteReadinessUsesTarget());
check('Worker health is deduplicated and transient failures have a short cache', chat.includes('_aioWorkerHealthInFlight[target.workerUrl]') && chat.includes('cached && cached.ok ? 60000 : 5000') && chat.includes('ctrl.abort(); }, 7000'));
check('research preparation is shared and cancellable in both chat surfaces', chat.includes('async function _aioPrepareAIResearch') && chat.includes('_aioPrepareAIResearch(_activeQuestionPlanForResearch, { signal: _chatSignal })') && html.includes('_aioPrepareAIResearch(_uniQuestionPlan, { signal: _uniResearchAbort.signal })'));
check('knowledge reference retrieval is shared through the existing orchestrator facade boundary', chat.includes('knowledgeOrchestrator.buildAIKnowledgeContext(q') && html.includes('_uniKnowledgeOrchestrator.buildAIKnowledgeContext(q') && read('src/ai/retrieval/knowledge.js').includes('currentClaimsAllowed: false'));
check('research opt-out preserves non-current answer path', chat.includes('web_research_disabled_by_user') && !/userOptOut\)[\s\S]{0,600}state\._chatSendEntered = 0;[\s\S]{0,180}return;/.test(chat));
check('insufficient external evidence forces native fallback', chat.includes('externalEvidenceReady') && chat.includes('prepared.nativeFallbackRequired = !prepared.externalEvidenceReady'));
check('research evidence gate is executable ESM SSOT', chat.includes('evaluateAIResearchEvidenceFloor') && !chat.includes('function _aioBuildResearchEvidenceDocuments'));
check('research producer uses canonical nested evidence', /researchEvidence:\s*\{[\s\S]*evidenceDocuments:\s*evidenceDocuments/.test(chat) && !/\n\s*evidenceDocuments:\s*evidenceDocuments,\n\s*researchPlanId/.test(chat));
check('research failures retain per-provider detail', chat.includes('_aioNormalizeResearchProviderFailure') && chat.includes('noResults.failures = subFailures'));
check('Worker route does not certify native search tool', core.includes("'NATIVE_TOOL_UNVERIFIED'") && !core.includes("'NATIVE_TOOL_ROUTE_READY'") && core.includes('nativeCitationCount'));
check('research diagnostic audit exposes contract and last execution', core.includes('contractReady: contractReady') && core.includes('lastPreparation:') && core.includes('lastExecution:'));
const normalizeWorkerUrl = value => String(value || '').trim().replace(/\/+$/, '');
const configWorkerUrl = normalizeWorkerUrl(config.ai?.workerUrl);
const operationsWorkerUrl = normalizeWorkerUrl(operations.ai?.publicChat?.workerEndpoint);
const publicRoutePublished = /^https:\/\//i.test(configWorkerUrl);
const publicRouteDisabled = !configWorkerUrl
  && config.ai?.routeStatus === 'DISABLED'
  && config.ai?.serverMode === 'personal-key-only'
  && config.ai?.chatPolicy === 'personal-key-only'
  && typeof config.ai?.routeReason === 'string'
  && config.ai.routeReason.length > 0
  && config.ai?.routeEvidence?.status === 'OPERATOR_REQUIRED'
  && operations.ai?.publicChat?.statusCode !== 'CONFIGURED_HEALTHY';
check('public config is revision-bound and either publishes the healthy shared route or explicitly disables it', config.schemaVersion === 'ai-public-config.v1'
  && config.appRevision === operations.appRevision
  && ((publicRoutePublished
    && config.ai?.routeStatus === 'PUBLISHED'
    && config.ai?.routeEvidence?.status === 'CURRENT'
    && configWorkerUrl === operationsWorkerUrl
    && config.ai?.serverMode === 'shared-worker-fallback'
    && config.ai?.chatPolicy === 'personal-key-or-public-worker'
    && operations.ai?.publicChat?.statusCode === 'CONFIGURED_HEALTHY')
    || publicRouteDisabled));
const bootRouteContract = publicRoutePublished
  ? core.includes(`workerUrl: '${configWorkerUrl}'`) && core.includes("serverMode: 'shared-worker-fallback'")
  : core.includes('workerUrl: workerUrl || null') && core.includes('loadPublicConfig');
check('boot fallback follows the generated public route state without storing a provider secret', bootRouteContract && !read('public-config.json').includes('ANTHROPIC_API_KEY'));
check('personal key remains preferred over the public fallback while manual Worker override remains explicit', chat.indexOf("if (localWorker && serverMode)") < chat.indexOf("if (apiKey) return") && chat.indexOf("if (apiKey) return") < chat.indexOf("if (publicWorker) return"));
check('both chat surfaces share the expanded evidence registry', chat.includes('function _aioCollectAIClaimEvidence') && chat.includes('evidence: _pageClaimEvidence') && html.includes('evidence: _uniClaimEvidence'));
check('invalid or unbound AnswerPlan claims degrade claim scope instead of erasing the answer', chat.includes('answer-plan-claim-degraded') && chat.includes('droppedClaims') && !chat.includes("blocked: true,\n      text: 'AI 베타 안전 모드\\n\\n현재성 수치의 AnswerPlan claim"));
check('partial structured streams hide control JSON until completion', chat.includes("visible = 'AI 답변을 구성하고 근거를 검증하는 중…'") && chat.includes("var isPartialStream = meta.streamPhase === 'partial'"));
check('Worker token cap and stop reason are consumed by the client', chat.includes('workerMaxTokens') && chat.includes('effectiveMaxTokens') && chat.includes("stopReason === 'max_tokens'") && chat.includes('completion: completion || null'));
check('server market prose requires typed evidence before client publish', data.includes('_serverMarketMetricEvidenceValid') && data.includes('metric-evidence-required') && data.includes('_serverMarketSemanticContract'));
check('Worker exposes health readiness', worker.includes("_u.pathname === '/health'") && worker.includes("schemaVersion: 'aio-worker-health.v1'") && worker.includes('ai: { configured'));
check('Worker CORS allows every browser chat header', worker.includes("anthropic-version, anthropic-beta, X-AIO-App-Token") && worker.includes('Access-Control-Allow-Headers'));
check('Worker rolls back owned failed quota reservations', worker.includes('releaseAnthropicQuota') && worker.includes('ownedReservation'));
check('Worker exposes effective token cap', worker.includes("'X-AIO-Max-Tokens'"));
check('operations status separates scheduled analysis and public chat', operations.ai?.scheduledAnalysis && operations.ai?.publicChat?.scheduledAnalysisDoesNotImplyChat === true);
check('operations status separates five readiness fields', ['secretConfigured', 'workflowWired', 'lastCallSucceeded', 'dataCurrent', 'licensedForUse'].every(field => read('public-data/operations-status.json').includes(`"${field}"`)));

function uiRouteReadinessUsesTarget() {
  const ui = read('js/aio-ui.js');
  return ui.includes("_aioClaudeTarget(personalKey)") && ui.includes("target && target.serverKey ? target.workerUrl : ''");
}

if (errors.length) {
  console.error(`AI chat reliability contract failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('AI chat reliability contract OK');
