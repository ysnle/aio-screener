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

// How long 다시 묻기 waits for the panel to reach the question's screen before leaving the question in the box unsent.
const PANEL_ARRIVAL_MS = 4000;

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
    savePendingTurn(storage(), { sessionId: root.__aioChatSessions?.sessionId || null, ctx, route: root.location?.hash || '', question, startedAt: now() });
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

  // 다시 묻기 asks in the conversation and on the screen the question belongs to. The conversation is restored through
  // the panel's session api; a question from another screen first goes back to its address (the app's own deep link),
  // and is sent once the panel reports that screen. If the panel does not get there, the question waits in the box and is
  // not sent on the wrong screen.
  function askAgain(turn) {
    root.__aioChatSessions?.restore?.(turn.sessionId);
    const send = () => {
      const input = doc.getElementById('ai-panel-inp');
      if (!input || input.disabled) return false;
      input.value = turn.question;
      if (turn.ctx && root._aiCurrentCtx !== turn.ctx) return false;
      root.chatSendUnified?.();
      return true;
    };
    if (!turn.ctx || root._aiCurrentCtx === turn.ctx || !root.location) { send(); return; }
    let timer = null;
    const done = () => { doc.removeEventListener?.('aio:pageShown', onShown); root.clearTimeout?.(timer); };
    const onShown = () => root.setTimeout?.(() => { if (root._aiCurrentCtx === turn.ctx) { done(); send(); } }, 0);
    doc.addEventListener?.('aio:pageShown', onShown);
    timer = root.setTimeout?.(() => { done(); send(); }, PANEL_ARRIVAL_MS) ?? null;
    root.location.hash = turn.route || `#${turn.ctx}`;
  }

  /**
   * After a reload: a question younger than 15 minutes that never got its answer gets one card above the question box.
   * 다시 묻기 sends it again in its own conversation and screen (askAgain); 지우기 forgets it. Returns the card or null.
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
      if (!doc.getElementById('ai-panel-inp')) return;
      removeCard();
      clearPendingTurn(storage());
      askAgain(turn);
    });
    forget.addEventListener('click', () => { removeCard(); clearPendingTurn(storage()); });
    row.append(again, forget);
    card.append(row);
    anchor.before(card);
    return card;
  }
  return { begin, showPendingCard };
}
