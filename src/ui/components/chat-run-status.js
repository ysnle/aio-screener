// The AI panel's waiting line: the loading bubble the classic panel appends (js/aio-chat.js chatSendUnified) becomes one
// status line that says what the answer is doing and for how long (src/ai/session/run-progress.js). It is updated in
// place, text only; a one-second timer runs only while the run is in flight. The stage words are announced politely;
// the counters (characters, seconds) sit in an aria-hidden part so a screen reader is not read a number every second.
import { createRunProgress, progressHook } from '../../ai/session/run-progress.js';

// Lets the page paint the checking line before the synchronous filters run: one frame, at most 100 ms (a hidden tab
// paints nothing and gets no frame, so it does not wait).
function nextPaint(root, doc) {
  if (doc?.hidden) return undefined;
  return new Promise((resolve) => {
    const fallback = root.setTimeout?.(resolve, 100);
    root.requestAnimationFrame?.(() => root.setTimeout?.(() => { root.clearTimeout?.(fallback); resolve(); }, 0));
  });
}

export function createChatRunKit(root = globalThis, doc = root.document, { now = () => Date.now() } = {}) {
  /**
   * Starts the status line of one run in `node` (the loading bubble). Returns { stage, chars, hook, end }: `hook` is
   * callSharedAi's opts.onStage, `end()` stops the timer (the panel calls it when the run is released).
   */
  function begin({ node } = {}) {
    const progress = createRunProgress({ now });
    const line = node?.querySelector?.('.lch-muted') || node || null;
    // "생각하는 중" + " · 30초" (aria-hidden) + ". 자료 조회와 검색이 있으면 …": one line, three parts updated in place.
    let words = null, counters = null, note = null, timer = null, ended = false, painted = '';
    if (line && doc) {
      line.setAttribute('role', 'status');
      line.setAttribute('aria-live', 'polite');
      words = doc.createTextNode('');
      counters = doc.createElement('span');
      counters.setAttribute('aria-hidden', 'true');
      note = doc.createTextNode('');
      line.replaceChildren(words, counters, note);
    }
    const render = () => {
      if (ended || !words) return;
      const view = progress.snapshot(now());
      const tail = view.note ? `. ${view.note}` : '';
      if (words.data !== view.base) words.data = view.base;
      if (counters.textContent !== view.counters) counters.textContent = view.counters;
      if (note.data !== tail) note.data = tail;
      painted = view.label + tail;
    };
    render();
    if (words) timer = root.setInterval?.(render, 1000) ?? null;
    const end = () => {
      if (ended) return;
      ended = true;
      if (timer != null) root.clearInterval?.(timer);
      timer = null;
    };
    const onStage = progressHook(progress, { settle: () => { render(); return nextPaint(root, doc); } });
    return {
      stage: (name, detail) => { progress.stage(name, detail); render(); },
      chars: (n) => { progress.chars(n); render(); },
      hook: (name, detail) => { const settled = onStage(name, detail); if (name !== 'event') render(); return settled; },
      end,
      get text() { return painted; },
      get running() { return !ended; },
      stages: () => progress.stages()
    };
  }
  return { begin };
}
