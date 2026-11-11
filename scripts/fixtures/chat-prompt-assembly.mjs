// Offline assembly of the unified chat system prompt (chatSendUnified, js/aio-chat.js) for gate fixtures.
// The instruction blocks are produced by the real builders: the classic-script functions run in a vm context from
// their own source, the ESM builders are imported. Blocks that need live data (quotes, technicals, screener, domain
// pages, knowledge/imported research, the analysis slice, answer visuals, the teach block, the same-screen memo) are not
// built; the news block is built from a fixture news cache, and the reader-memory blocks from a fixture device store
// (assemble's `memory` option).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXTURE_NOW = '2026-11-11T14:00:00Z';

export const PROMPT_FIXTURE_QUESTIONS = Object.freeze([
  { id: 'explain-gamma', query: '감마 스퀴즈가 뭐야?', ctxId: 'home' },
  { id: 'quick-tesla-per', query: '테슬라 PER 얼마야?', ctxId: 'home' },
  { id: 'causal-nvidia-today', query: '엔비디아 오늘 왜 떨어졌어?', ctxId: 'home' },
  { id: 'outlook-market', query: '앞으로 미국 증시 전망은 어때?', ctxId: 'home' }
]);

// Eight long news items in the home topics, all fresh, so the news block is at its item and length caps.
export function longNewsItems(count = 8, nowMs = Date.parse(FIXTURE_NOW)) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Fixture headline ${i + 1} ` + '반도체 수요와 금리 경로가 엇갈린 하루 '.repeat(12),
    desc: `Fixture summary ${i + 1} ` + '실적 발표 뒤 가이던스와 마진 전망, 금리 기대 변화가 함께 움직였다는 요약 '.repeat(12),
    source: 'fixture', topic: 'macro', score: 80, pubDate: new Date(nowMs - (i + 1) * 3600000).toISOString()
  }));
}

function slice(src, start, end, label) {
  const at = src.indexOf(start);
  const to = at < 0 ? -1 : src.indexOf(end, at + start.length);
  if (at < 0 || to < 0) throw new Error(`chat-prompt-assembly: source slice not found (${label || start})`);
  return src.slice(at, to);
}

export async function loadChatPromptKit({ root = DEFAULT_ROOT } = {}) {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const load = (file) => import(pathToFileURL(path.join(root, file)).href);
  const chat = read('js/aio-chat.js');
  const core = read('js/aio-core.js');
  const ui = read('js/aio-ui.js');
  const { createQuestionPlan, companyEntitySymbols } = await load('src/ai/orchestrator/question-planner.js');
  const cues = await load('src/ai/intent/question-cues.js');
  const modes = await load('src/ai/response/answer-modes.js');
  const principles = await load('src/ai/response/answer-principles.js');
  const { installAIRequestPipeline } = await load('src/ai/response/request-pipeline.js');
  const nativeSearch = await load('src/ai/research/native-search.js');
  let budget = {};
  try { budget = (await load('src/ai/context/reference-budget.js')).CHAT_REFERENCE_BUDGET || {}; } catch (_) { budget = {}; }

  const window = {
    AIO: { chatReferenceBudget: budget },
    AIO_ARCH: { planAIQuestion: ({ query, route } = {}) => createQuestionPlan({ query, route, now: FIXTURE_NOW }) },
    _aioQuestionCues: cues,
    _aioRouteLabel: (id) => id
  };
  installAIRequestPipeline(window, { createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }) });
  const context = vm.createContext({ window, console, newsCache: [] });
  context.globalThis = context;
  const run = (code, label) => vm.runInContext(code, context, { filename: label });
  run(slice(core, 'function _aioQuestionCue(', 'function _aioLooksFreshIntent(', 'question cue'), 'aio-core.js#cue');
  run(slice(core, 'var _AIO_AI_SECURITY_VERSION', '// P1350: absent prices', 'untrusted block'), 'aio-core.js#untrusted');
  run(slice(chat, 'var AIO_CHAT_PIPELINE_REGISTRY = [', '// v57.50 C05/C06/C08', 'pipeline registry'), 'aio-chat.js#registry');
  run(slice(chat, 'var _CTX_TOPIC_MAP = {', 'function _buildNewsContext(', 'topic map'), 'aio-chat.js#topics');
  run(slice(chat, 'function _buildNewsContext(', '\n}\n', 'news context') + '\n}\n', 'aio-chat.js#news');
  run(slice(chat, 'function _aioChatTokens(', 'function _shouldSingleDeepAnalyzeChat(', 'intent builders'), 'aio-chat.js#intent');
  run(slice(chat, 'function _autoNavigatePage(', '// v49.69 P365 R129', 'navigation'), 'aio-chat.js#nav');
  run(slice(chat, 'function _aioBuildAIClaimEvidenceRegistry(', "if (typeof window !== 'undefined') {\n  if (typeof window._aioBuildAIClaimEvidenceRegistry", 'evidence registry'), 'aio-chat.js#registry-rule');
  run(slice(ui, 'function _detectQueryComplexity(', '\nfunction ', 'complexity') , 'aio-ui.js#complexity');
  run('function _aioQueryNamesCompany() { return false; }', 'stub');

  const unified = slice(chat, 'async function chatSendUnified(', '\n}\n', 'chatSendUnified');
  // Statements of chatSendUnified that write prompt text or route the request, run as written.
  const statement = (start, end, label) => slice(unified, start, end, label);
  const newsWrap = statement('var newsCtx = _buildNewsContext(ctxId, q);', '\n      if (newsCtx) {', 'news wrap');
  const modelRoute = statement("var selectedModelKey = 'luna';", 'var selectedModelCfg', 'model route');
  const maxTokensExpr = statement('var modelOpts = {', ';', 'model opts') + ';';
  const webResearch = statement("sysPrompt += '\\n\\n【웹 리서치 지시", ';\n', 'web research') + ';';
  const evidenceTail = statement("sysPrompt += '\\n\\n[AIO EXTERNAL EVIDENCE CONTRACT]\\n'", ';\n', 'evidence tail') + ';';
  // Reader memory: the turn's entity ids and the earlier-conversation block, through the chat-globals the panel installs.
  const turnEntities = statement('state._turnEntities = window.AIO && typeof window.AIO.chatTurnEntities', ';\n', 'turn entities') + ';';
  const earlierTurns = statement('if (window.AIO && typeof window.AIO.relatedEarlierTurnsBlock', ';\n', 'earlier turns') + ';';
  run(`function __readerMemory(window, ctxId, detectedTickers) { var state = {}; var sysPrompt = ''; ${turnEntities} ${earlierTurns} return { entities: state._turnEntities, text: sysPrompt }; }`, 'unified#memory');
  const { installChatGlobals } = await load('src/app/chat-globals.js');
  const { installChatSessions } = await load('src/ui/components/chat-sessions.js');
  run(`function __newsBlock(ctxId, q) { ${newsWrap.replace('var newsCtx', 'var newsCtx')} return newsCtx || ''; }`, 'unified#news');
  run(`function __route(q, ctxId, _uniMode, _uniDeepData) { ${modelRoute} ${maxTokensExpr} return { modelKey: selectedModelKey, maxTokens: modelOpts.maxTokens }; }`, 'unified#route');
  run(`function getModelConfig(key) { return { label: key }; }`, 'stub');
  run(`function __webResearch() { var sysPrompt = ''; ${webResearch} return sysPrompt; }`, 'unified#web');
  run(`function __evidenceTail() { var sysPrompt = ''; ${evidenceTail} return sysPrompt; }`, 'unified#tail');
  const LLM_MODELS = vm.runInNewContext(`(${slice(ui, 'const LLM_MODELS = {', '\n};', 'models').replace('const LLM_MODELS = ', '')}\n})`);

  function plan(query, ctxId = 'home') { return createQuestionPlan({ query, route: ctxId, now: FIXTURE_NOW }); }

  function route(query, ctxId = 'home', { deepData = false } = {}) {
    const questionPlan = plan(query, ctxId);
    const tickers = companyEntitySymbols(questionPlan);
    const policy = context._aioChatAnswerPolicy(query, ctxId, tickers, null);
    const mode = modes.chooseAnswerMode(policy);
    const routed = context.__route(query, ctxId, mode, deepData);
    return { questionPlan, tickers, policy, mode, ...routed, reasoningEffort: (LLM_MODELS[routed.modelKey] || {}).reasoningEffort || 'none' };
  }

  function newsBlock(query, ctxId = 'home', items = longNewsItems()) {
    context.newsCache = items;
    vm.runInContext('newsCache = globalThis.newsCache;', context);
    const raw = context._buildNewsContext(ctxId, query);
    return { raw, wrapped: context.__newsBlock(ctxId, query) };
  }

  // memory: { storage, sessionId, now, themeId } — the reader's device store as the panel sees it: the real session
  // component (on an inert stub document) and the chat-globals that read it.
  const stubNode = () => ({ style: {}, dataset: {}, setAttribute() {}, addEventListener() {}, append() {}, focus() {} });
  const stubDoc = { createElement: stubNode, getElementById: () => null, querySelector: () => null };
  function readerMemory(memory, ctxId, tickers) {
    const root = { localStorage: memory.storage, _currentThemeId: memory.themeId || null, setTimeout: () => 0 };
    installChatGlobals(root);
    installChatSessions(root, stubDoc, { storage: memory.storage });
    root.__aioChatSessions.sessionId = memory.sessionId || null;
    const block = root.AIO.relatedEarlierTurnsBlock;
    root.AIO.relatedEarlierTurnsBlock = (options) => block({ ...options, now: Date.parse(memory.now || FIXTURE_NOW) });
    return context.__readerMemory(root, ctxId, tickers);
  }

  function assemble(query, ctxId = 'home', { news = longNewsItems(), health = { ai: { paidWebSearchEnabled: true, webSearchAvailable: true } }, memory = null } = {}) {
    const r = route(query, ctxId);
    const { questionPlan, tickers, mode } = r;
    const webSearch = nativeSearch.selectNativeSearch({ decision: questionPlan.researchDecision || {}, questionPlan, health, internalEvidenceReady: false });
    const blocks = [];
    const add = (name, text) => { if (text) blocks.push({ name, text: String(text) }); };
    const nb = newsBlock(query, ctxId, news);
    add('news', nb.wrapped);
    const flags = { tickers, tickerData: tickers.length > 0, technicalData: false, screenerData: false, domainData: false, trendData: false, deepData: false, webSearch, news: !!nb.wrapped, freshness: tickers.length > 0, portfolioData: false };
    add('intent', context._buildChatIntentContext(ctxId, query, flags));
    add('coverage', context._buildChatAnswerCoverageContext(ctxId, query, flags));
    add('integrated', context._buildAioIntegratedAnswerContext(ctxId, query, flags));
    const mem = memory ? readerMemory(memory, ctxId, tickers) : { entities: [], text: '' };
    add('earlier-turns', mem.text);
    add('registry', context._aioBuildAIClaimEvidenceRegistry([]));
    add('principles', principles.buildAnswerPrinciples({ today: FIXTURE_NOW.slice(0, 10), mode, hasTickers: tickers.length > 0, hasTrend: false, liveStatus: 'fixture', newsInjected: !!nb.wrapped, webSearch, snapAgeHours: 2 }));
    add('mode', modes.answerModeGuide(mode));
    if (webSearch) add('web-research', context.__webResearch());
    add('evidence-tail', context.__evidenceTail());
    add('policy', window._aioPublicAIActionPolicyPrompt());
    let body = { model: 'fixture', instructions: blocks.map((b) => b.text).join(''), reasoning: { effort: r.reasoningEffort } };
    body = nativeSearch.attachNativeSearch(body, { enabled: webSearch, health, mustSearch: nativeSearch.searchMustRun ? nativeSearch.searchMustRun(questionPlan.researchDecision || {}) : undefined });
    return { ...r, webSearch, blocks, prompt: blocks.map((b) => b.text).join(''), toolChoice: body.tool_choice || null, newsRaw: nb.raw, entities: mem.entities };
  }

  return { window, context, plan, route, assemble, newsBlock, longNewsItems, modes, principles, nativeSearch, budget };
}
