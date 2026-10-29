// v59.16 (roadmap 11, layer 1 chat): js/aio-chat.js (the AI panel, about 360 KB) is no longer a boot script. It loads
// on the first use of the panel or once the page is idle after boot, whichever comes first. The panel's entry points
// are stubs until then: a call is queued and replayed in order once the classic script has defined the real function.
const ENTRY_POINTS = Object.freeze(['toggleAIPanel', 'chatSendUnified', 'aiChipClick', 'chatFromChip', 'updateAIPanelContext']);
const IDLE_TIMEOUT_MS = 4000;

// The chat script carries the same cachebuster as the static shell scripts (bump-version patches those).
function scriptVersion(doc) {
  const src = doc.querySelector?.('script[src*="aio-core.js"]')?.getAttribute('src') || '';
  const match = /[?&]v=([\d.]+)/.exec(src);
  return match ? match[1] : String(Date.now());
}

export function installChatLoader(root = globalThis, doc = root.document, { onLoaded = () => {} } = {}) {
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
  const load = () => pending || (pending = new Promise((resolve, reject) => {
    const cuesReady = loadCues();
    const script = doc.createElement('script');
    script.src = './js/aio-chat.js?v=' + scriptVersion(doc);
    script.onload = () => { cuesReady.then(() => { replay(); resolve(true); }); };
    script.onerror = () => { pending = null; reject(new Error('aio-chat.js 로드 실패')); };
    doc.head.appendChild(script);
  }));
  for (const name of ENTRY_POINTS) {
    if (typeof root[name] === 'function') continue;
    stubs[name] = function (...args) { queue.push([name, this, args, doc.getElementById('ai-panel-inp')?.value || '']); load().catch(() => {}); };
    root[name] = stubs[name];
  }
  root.AIO.loadChat = load;
  const soon = () => {
    if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(() => { load().catch(() => {}); }, { timeout: IDLE_TIMEOUT_MS });
    else root.setTimeout(() => { load().catch(() => {}); }, 1);
  };
  // Automated browsers (QA gates) get the panel right away, as they get the QA audits.
  if (root.navigator?.webdriver) load().catch(() => {});
  else if (doc.readyState === 'complete') soon();
  else root.addEventListener('load', soon, { once: true });
  return load;
}
