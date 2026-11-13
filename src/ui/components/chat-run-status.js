// The AI panel's waiting line: the loading bubble the classic panel appends (js/aio-chat.js chatSendUnified) becomes one
// status line that says what the answer is doing and for how long (src/ai/session/run-progress.js). It is updated in
// place, text only; a one-second timer runs only while the run is in flight. The stage words are announced politely;
// the counters (characters, seconds) sit in an aria-hidden part so a screen reader is not read a number every second.
// While a run is in flight its question is kept for this tab (src/ai/session/pending-turn.js) and leaving the page asks
// first (beforeunload); a reload during the wait shows one card that offers the question again, never resending it alone.
import { createRunProgress, progressHook } from '../../ai/session/run-progress.js';
import { clearPendingTurn, pendingQuestionPreview, readPendingTurn, savePendingTurn } from '../../ai/session/pending-turn.js';
import { el } from './dom.js';

// Lets the page paint the checking line before the synchronous filters run: one frame, at most 100 ms (a hidden tab
// paints nothing and gets no frame, so it does not wait).
function nextPaint(root, doc) {
  if (doc?.hidden) return undefined;
  return new Promise((resolve) => {
    const fallback = root.setTimeout?.(resolve, 100);
    root.requestAnimationFrame?.(() => root.setTimeout?.(() => { root.clearTimeout?.(fallback); resolve(); }, 0));
  });
}

// The device store is handed in by the app layer (`storage()` returns this tab's own store).
export function createChatRunKit(root = globalThis, doc = root.document, { now = () => Date.now(), storage = () => null } = {}) {
  let card = null;
  const removeCard = () => { card?.remove(); card = null; };
  const onLeave = (event) => { event.preventDefault(); event.returnValue = ''; };

  /**
   * Starts the status line of one run in `node` (the loading bubble), keeps its question for this tab and asks before
   * the page is left. Returns { stage, chars, hook, end }: `hook` is callSharedAi's opts.onStage; `end()` stops the
   * timer, the leave question and the kept question (the panel calls it when the run is released: done, error or stop).
   */
  function begin({ node, ctx = '', question = '' } = {}) {
    removeCard();
    savePendingTurn(storage(), { sessionId: root.__aioChatSessions?.sessionId || null, ctx, question, startedAt: now() });
    root.addEventListener?.('beforeunload', onLeave);
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
      root.removeEventListener?.('beforeunload', onLeave);
      clearPendingTurn(storage());
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

  /**
   * After a reload: a question younger than 15 minutes that never got its answer gets one card above the question box.
   * 다시 묻기 puts it in the box and sends it in the open conversation; 지우기 forgets it. Returns the card or null.
   */
  function showPendingCard() {
    const turn = readPendingTurn(storage(), { now: now() });
    const anchor = doc?.getElementById('ai-panel')?.querySelector('.ai-chips');
    if (!turn || !anchor) return null;
    removeCard();
    card = el(doc, 'div', null, 'ai-session-consent');
    card.id = 'ai-pending-turn';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', '답변을 받지 못한 질문');
    card.append(el(doc, 'p', `답변을 받기 전에 화면이 새로 열렸습니다. 방금 질문: "${pendingQuestionPreview(turn.question)}"`, 'ai-session-consent-body'));
    const row = el(doc, 'div', null, 'ai-session-actions');
    const again = el(doc, 'button', '다시 묻기', 'ai-session-btn is-primary'); again.type = 'button';
    const forget = el(doc, 'button', '지우기', 'ai-session-btn'); forget.type = 'button';
    again.addEventListener('click', () => {
      const input = doc.getElementById('ai-panel-inp');
      if (!input || input.disabled) return;
      removeCard();
      clearPendingTurn(storage());
      input.value = turn.question;
      root.chatSendUnified?.();
    });
    forget.addEventListener('click', () => { removeCard(); clearPendingTurn(storage()); });
    row.append(again, forget);
    card.append(row);
    anchor.before(card);
    return card;
  }
  return { begin, showPendingCard };
}
