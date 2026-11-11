// v59.16 (roadmap 11, layer 1 chat): js/aio-chat.js (the AI panel, about 360 KB) is no longer a boot script. It loads
// on the first use of the panel or when a pointer or focus reaches an AI control (v59.70). The panel's entry points
// are stubs until then: a call is queued and replayed in order once the classic script has defined the real function.
import { dataState, DATA_STATE_TIMEOUT_MS } from '../ui/components/data-state.js';

const ENTRY_POINTS = Object.freeze(['toggleAIPanel', 'chatSendUnified', 'aiChipClick', 'chatFromChip', 'updateAIPanelContext']);
// Controls that open or ask the panel: the top-bar button, chips, screen question rows and the panel itself.
const AI_TRIGGERS = '[data-action="toggleAIPanel"], [data-action="aiChipClick"], [data-action="chatFromChip"], [aria-controls="ai-panel"], .aio-ask-questions, .ai-chip, #ai-panel';

// The chat script carries the same cachebuster as the static shell scripts (bump-version patches those).
function scriptVersion(doc) {
  const src = doc.querySelector?.('script[src*="aio-core.js"]')?.getAttribute('src') || '';
  const match = /[?&]v=([\d.]+)/.exec(src);
  return match ? match[1] : String(Date.now());
}

export function installChatLoader(root = globalThis, doc = root.document, { onLoaded = () => {}, alongside = () => null } = {}) {
  root.AIO = root.AIO || {};
  if (!doc || typeof root.AIO.loadChat === 'function') return root.AIO.loadChat || null;
  const queue = [];
  const stubs = {};
  let pending = null;
  const replay = () => {
    try { onLoaded(); } catch (_) { /* session/context glue is optional; the panel itself still works */ }
    // Calls made before the load are replayed as they were made. Nothing else runs: the first page shown at boot never
    // reached the panel's aio:pageShown listener before either, and opening the panel sets its context.
    // A caller fills the question box between opening and sending (ask-panel, 기업 분석, 학습 질문). Opening clears the
    // box when the context changes, which used to happen before the fill; so a replayed send gets the text that was in the
    // box when it was queued, and a fill with no send is put back after the replay.
    const input = doc.getElementById('ai-panel-inp');
    const filled = input ? input.value : '';
    const calls = queue.splice(0);
    for (const [name, self, args, draft] of calls) {
      try {
        if (typeof root[name] !== 'function' || root[name] === stubs[name]) continue;
        if (name === 'chatSendUnified' && input) input.value = draft;
        root[name].apply(self, args);
      } catch (_) { /* one failed replay must not drop the rest */ }
    }
    if (input && filled && !input.value && !input.disabled && calls.length && calls[calls.length - 1][0] !== 'chatSendUnified') input.value = filled;
  };
  // v59.42: the AI question keyword cues (src/ai/intent/question-cues.js, read by the panel's answer policy and the chat
  // data profile through root._aioQuestionCues) load with the panel, outside the boot set; the replay waits for them.
  const loadCues = () => import('../ai/intent/question-cues.js').then((cues) => { root._aioQuestionCues = cues; }).catch(() => {});
  // v59.48: the chat-only AIO helpers (market facts, answer mode and principles) install from their own chunk too.
  const loadChatGlobals = () => import('./chat-globals.js').then((module) => { module.installChatGlobals(root); }).catch(() => {});
  // v59.70 (2nd batch A, QUALITY-BAR 4): a click that waits for the panel script is visible. The AI buttons show the
  // shared busy spinner (button[aria-busy], ui-states.css) while it loads; a failed load, or one still pending after
  // DATA_STATE_TIMEOUT_MS, puts one line with 다시 시도 at the top of the content (the same look as the core-file notice).
  // Only a user action shows either: a hover warm-up loads silently.
  let notice = null;
  let slowTimer = null;
  const buttons = () => [...(doc.querySelectorAll?.('[data-action="toggleAIPanel"]') || [])].filter((button) => !button.closest('#ai-panel'));
  const setBusy = (on) => { for (const button of buttons()) { if (on) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy'); } };
  const clearNotice = () => { if (slowTimer) root.clearTimeout?.(slowTimer); slowTimer = null; notice?.remove(); notice = null; };
  const showNotice = () => {
    const host = doc.getElementById('main-content');
    if (!host?.prepend || !queue.length) return;
    const next = dataState(doc, { state: 'error', text: 'AI 도우미를 불러오지 못했습니다', onRetry: () => { clearNotice(); setBusy(true); load().catch(() => {}); } });
    next.id = 'aio-chat-load-failure';
    next.classList.add('aio-load-failure');
    if (notice?.isConnected) notice.replaceWith(next); else host.prepend(next);
    notice = next;
    setBusy(false);
  };
  // The user research digest (public-data/user-research-digest.json, read only by the AI question path) loads with the
  // panel, and the replay waits for it.
  const loadResearchDigest = () => Promise.resolve().then(() => root.AIO.loadUserResearchDigest?.()).catch(() => {});
  const load = () => pending || (pending = new Promise((resolve, reject) => {
    const cuesReady = Promise.all([loadCues(), loadChatGlobals(), Promise.resolve().then(alongside).catch(() => {}), loadResearchDigest()]);
    const script = doc.createElement('script');
    script.src = './js/aio-chat.js?v=' + scriptVersion(doc);
    script.onload = () => { cuesReady.then(() => { clearNotice(); setBusy(false); replay(); resolve(true); }); };
    script.onerror = () => { script.remove?.(); pending = null; if (slowTimer) root.clearTimeout?.(slowTimer); slowTimer = null; showNotice(); reject(new Error('aio-chat.js 로드 실패')); };
    doc.head.appendChild(script);
  }));
  // A user action that has to wait: busy now, the notice if it is still waiting after the shared timeout.
  const waitVisibly = () => {
    if (!slowTimer && !notice) slowTimer = root.setTimeout?.(() => { slowTimer = null; if (queue.length) showNotice(); }, DATA_STATE_TIMEOUT_MS) || null;
    if (!notice) setBusy(true);
  };
  for (const name of ENTRY_POINTS) {
    if (typeof root[name] === 'function') continue;
    stubs[name] = function (...args) {
      const input = doc.getElementById('ai-panel-inp');
      const draft = input?.value || '';
      // Keep the draft visible until the real send accepts it, including a failed script load. A repeated Enter
      // retries loading without queuing the same draft twice (P2171).
      if (name === 'chatSendUnified') {
        if (!draft.trim() || queue.some(([entry, , , queuedDraft]) => entry === name && queuedDraft === draft)) { load().catch(() => {}); return; }
      }
      // A second click on the AI button while the script is still loading is the same request, not open-then-close.
      if (name === 'toggleAIPanel' && queue.some(([entry]) => entry === name)) { waitVisibly(); load().catch(() => {}); return; }
      queue.push([name, this, args, draft]);
      waitVisibly();
      load().catch(() => {});
    };
    root[name] = stubs[name];
  }
  root.AIO.loadChat = load;
  // v59.70 (owner D1, 2nd batch A P1): no idle prefetch. The panel script and the AI reference corpus (about 886 KB with
  // their chunks) load when a pointer or the keyboard reaches an AI control, a moment before the click that needs them;
  // a tap or a programmatic open still loads through the stubs above, and the dispatch waits for the corpus.
  const warm = (event) => {
    if (!event.target?.closest?.(AI_TRIGGERS)) return;
    doc.removeEventListener?.('pointerover', warm, true);
    doc.removeEventListener?.('focusin', warm, true);
    load().catch(() => {});
    try { root.AIO.ensureResearchCorpus?.()?.catch?.(() => {}); } catch (_) { /* the dispatch loads it again */ }
  };
  doc.addEventListener?.('pointerover', warm, true);
  doc.addEventListener?.('focusin', warm, true);
  // Automated browsers (QA gates) get the panel right away, as they get the QA audits, unless the gate measures the
  // boot a user gets (scripts/ci-boot-interaction-check.mjs sets __aioUserBoot before the page runs).
  if (root.navigator?.webdriver && !root.__aioUserBoot) load().catch(() => {});
  return load;
}
