// Offline assembly of the unified chat system prompt (chatSendUnified, src/ui/chat/panel.js) for gate fixtures, in the order
// chatSendUnified writes it: the tools block first, then the short prompt (composeLeanPrompt), reader memory, the answer
// principles, the mode guide, the evidence tail and the action policy. The blocks are produced by the real builders: the
// classic-script functions run in a vm context from their own source, the ESM builders are imported. Blocks that need
// live data (screener rows of named stocks, the screen basis, the broad comparison sample, the domain block, quote
// basis, the analysis slice, answer visuals, the teach block, the same-screen memo) are not built; the reader-memory
// blocks come from a fixture device store (assemble's `memory` option). The news tool's text builder
// (_buildNewsContext) runs on a fixture news cache through `newsBlock`.
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
// The news builder keeps items from the last 24 hours of the real clock, so these are dated from it: dated from the
// fixed fixture time they aged out of the window one day after they were written.
export function longNewsItems(count = 8, nowMs = Date.now()) {
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
  const chat = read('src/ui/chat/panel.js');
  const core = read('js/aio-core.js');
  const ui = read('js/aio-ui.js');
  const { createQuestionPlan, companyEntitySymbols } = await load('src/ai/orchestrator/question-planner.js');
  const cues = await load('src/ai/intent/question-cues.js');
  const modes = await load('src/ai/response/answer-modes.js');
  const principles = await load('src/ai/response/answer-principles.js');
  const { installAIRequestPipeline } = await load('src/ai/response/request-pipeline.js');
  const nativeSearch = await load('src/ai/research/native-search.js');
  const { composeLeanPrompt } = await load('src/ai/prompt/lean-prompt.js');
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
  run(slice(core, 'var _AIO_AI_SECURITY_VERSION', 'window.AIO.redactPortfolioForAI = function(', 'untrusted block'), 'aio-core.js#untrusted');
  run(slice(chat, 'var _CTX_TOPIC_MAP = {', 'function _buildNewsContext(', 'topic map'), 'aio-chat.js#topics');
  run(slice(chat, 'function _buildNewsContext(', '\n}\n', 'news context') + '\n}\n', 'aio-chat.js#news');
  run(slice(chat, 'function _aioChatTokens(', 'function _buildChatMemoryContext(', 'answer policy'), 'aio-chat.js#policy');
  run(slice(ui, 'function _detectQueryComplexity(', '\nfunction ', 'complexity') , 'aio-ui.js#complexity');
  const CHAT_CONTEXTS = vm.runInNewContext(`(${slice(chat, 'const CHAT_CONTEXTS = {', '\n};', 'chat contexts').replace('const CHAT_CONTEXTS = ', '')}\n})`);
  run('function _aioQueryNamesCompany() { return false; }', 'stub');

  const unified = slice(chat, 'async function chatSendUnified(', '\n}\n', 'chatSendUnified');
  // Statements of chatSendUnified that write prompt text or route the request, run as written.
  const statement = (start, end, label) => slice(unified, start, end, label);
  const modelRoute = statement("var selectedModelKey = 'luna';", 'var selectedModelCfg', 'model route');
  const maxTokensExpr = statement('var modelOpts = {', ';', 'model opts') + ';';
  const evidenceTail = statement("sysPrompt += '\\n\\n[AIO EXTERNAL EVIDENCE CONTRACT]\\n'", ';\n', 'evidence tail') + ';';
  // The data tools and hosted search: the one block that leads every prompt (the chat-globals kit).
  const toolsOffer = statement('var _uniTools = window.AIO', '\n  if (_uniTools) modelOpts.tools', 'tools block');
  window.AIO.chatTools = (await load('src/ai/tools/loop.js')).chatToolKit(window);
  // Reader memory: the turn's entity ids and the earlier-conversation block, through the chat-globals the panel installs.
  const turnEntities = statement('state._turnEntities = window.AIO && typeof window.AIO.chatTurnEntities', ';\n', 'turn entities') + ';';
  const earlierTurns = statement('if (window.AIO && typeof window.AIO.relatedEarlierTurnsBlock', ';\n', 'earlier turns') + ';';
  const readerNotes = statement('if (window.AIO && typeof window.AIO.readerNotesBlock', ';\n', 'reader notes') + ';';
  run(`function __readerMemory(window, ctxId, detectedTickers) { var state = {}; var sysPrompt = ''; ${turnEntities} ${earlierTurns} var earlier = sysPrompt; ${readerNotes} return { entities: state._turnEntities, earlier: earlier, notes: sysPrompt.slice(earlier.length) }; }`, 'unified#memory');
  const { installChatGlobals } = await load('src/app/chat-globals.js');
  const { installChatSessions } = await load('src/ui/components/chat-sessions.js');
  run(`function __route(q, ctxId, _uniMode) { ${modelRoute} ${maxTokensExpr} return { modelKey: selectedModelKey, maxTokens: modelOpts.maxTokens }; }`, 'unified#route');
  run(`function getModelConfig(key) { return { label: key }; }`, 'stub');
  run(`function __evidenceTail() { var sysPrompt = ''; ${evidenceTail} return sysPrompt; }`, 'unified#tail');
  run(`function __tools(window, _uniUseClaudeWebSearch) { var sysPrompt = ''; ${toolsOffer} return sysPrompt; }`, 'unified#tools');
  const LLM_MODELS = vm.runInNewContext(`(${slice(ui, 'const LLM_MODELS = {', '\n};', 'models').replace('const LLM_MODELS = ', '')}\n})`);

  function plan(query, ctxId = 'home') { return createQuestionPlan({ query, route: ctxId, now: FIXTURE_NOW }); }

  function route(query, ctxId = 'home') {
    const questionPlan = plan(query, ctxId);
    const tickers = companyEntitySymbols(questionPlan);
    const policy = context._aioChatAnswerPolicy(query, ctxId, tickers, null);
    const mode = modes.chooseAnswerMode(policy);
    const routed = context.__route(query, ctxId, mode);
    return { questionPlan, tickers, policy, mode, ...routed, reasoningEffort: (LLM_MODELS[routed.modelKey] || {}).reasoningEffort || 'none' };
  }

  // The text the news tool returns (src/ai/tools/market-tools.js reads root._buildNewsContext).
  function newsBlock(query, ctxId = 'home', items = longNewsItems()) {
    context.newsCache = items;
    vm.runInContext('newsCache = globalThis.newsCache;', context);
    return { raw: context._buildNewsContext(ctxId, query) };
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

  function assemble(query, ctxId = 'home', { health = { ai: { paidWebSearchEnabled: true, webSearchAvailable: true } }, memory = null } = {}) {
    const r = route(query, ctxId);
    const { questionPlan, tickers, mode } = r;
    const webSearch = nativeSearch.selectNativeSearch({ decision: questionPlan.researchDecision || {}, questionPlan, health, mode });
    const blocks = [];
    const add = (name, text) => { if (text) blocks.push({ name, text: String(text) }); };
    // No screener rows in the fixture, so the named stocks add no rows; the screen basis needs live data.
    const lean = composeLeanPrompt({ root: window, screenTitle: (CHAT_CONTEXTS[ctxId] || {}).title || ctxId, tickers, screenBasis: '', profile: '', now: Date.parse(FIXTURE_NOW) });
    add('lean', lean.prompt);
    const mem = memory ? readerMemory(memory, ctxId, tickers) : { entities: [], earlier: '', notes: '' };
    add('earlier-turns', mem.earlier);
    add('reader-notes', mem.notes);
    add('principles', principles.buildAnswerPrinciples({ today: FIXTURE_NOW.slice(0, 10), hasTickers: tickers.length > 0, liveStatus: 'fixture', webSearch, snapAgeHours: 2 }));
    add('mode', modes.answerModeGuide(mode));
    const toolsBlock = context.__tools(window, webSearch);
    if (toolsBlock) blocks.unshift({ name: 'tools', text: toolsBlock });
    add('evidence-tail', context.__evidenceTail());
    add('policy', window._aioPublicAIActionPolicyPrompt());
    let body ={ model: 'fixture', instructions: blocks.map((b) => b.text).join(''), reasoning: { effort: r.reasoningEffort } };
    // chatSendUnified's search options (no injected quote rows in the fixture, so a current question is not covered).
    const searchOptions = nativeSearch.nativeSearchOptions({ decision: questionPlan.researchDecision || {}, mode, internalEvidenceReady: false });
    body = nativeSearch.attachNativeSearch(body, { enabled: webSearch, health, mustSearch: searchOptions.mustSearch, context: searchOptions.searchContext });
    const functions = /^【추가 자료 요청 \(도구/.test(toolsBlock || '');
    return { ...r, webSearch, blocks, prompt: blocks.map((b) => b.text).join(''), toolChoice: body.tool_choice || null, searchContext: body.tools ? body.tools[0].search_context_size : null, entities: mem.entities, tools: functions };
  }

  return { window, context, plan, route, assemble, newsBlock, longNewsItems, modes, principles, nativeSearch, budget };
}
