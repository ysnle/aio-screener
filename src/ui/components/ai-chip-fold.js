// Owner 2026-10-25: on a phone or iPad the AI panel's example questions stayed on screen for the whole conversation
// (up to 110px under the answers, refilled with follow-ups after every answer) and squeezed the answers further when
// the keyboard opened. On touch and narrow layouts (CSS in chat-sessions.css):
//   - before the first question the chips sit on one sideways-scrolling row;
//   - once a conversation has a question, they fold behind one "이어 물어볼 질문 n개" button;
//   - while the reader types they are hidden.
// Wide desktop pointers keep the open chips. The chip list itself stays owned by js/aio-chat.js; this module only
// reads it and sets data-convo / data-chips-open on #ai-panel.
export function installAIChipFold(root = globalThis, doc = root.document) {
  if (!doc || root.__aioAIChipFold) return root.__aioAIChipFold || null;
  const panel = doc.getElementById('ai-panel');
  const msgs = doc.getElementById('ai-panel-msgs');
  const chips = doc.getElementById('ai-panel-chips');
  if (!panel || !msgs || !chips) return null;
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.id = 'ai-panel-chips-toggle';
  toggle.className = 'ai-chips-toggle';
  toggle.setAttribute('aria-controls', 'ai-panel-chips');
  toggle.setAttribute('aria-expanded', 'false');
  chips.before(toggle);

  const setOpen = (open) => {
    if (open) panel.dataset.chipsOpen = '1'; else delete panel.dataset.chipsOpen;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const sync = () => {
    const convo = !!msgs.querySelector('.ai-msg.user');
    if (convo) panel.dataset.convo = '1'; else { delete panel.dataset.convo; setOpen(false); }
    const count = chips.querySelectorAll('.ai-chip').length;
    toggle.hidden = !count;
    toggle.textContent = panel.dataset.chipsOpen === '1' ? '질문 접기' : `이어 물어볼 질문 ${count}개`;
  };
  toggle.addEventListener('click', () => { setOpen(panel.dataset.chipsOpen !== '1'); sync(); });
  // A chip sends the question; the row folds again so the answer gets the room.
  chips.addEventListener('click', (event) => { if (event.target?.closest?.('.ai-chip')) { setOpen(false); sync(); } });
  // A new chip list (follow-ups after an answer, or a screen switch) arrives folded.
  const observer = new root.MutationObserver((records) => { if (records.some((r) => r.target === chips)) setOpen(false); sync(); });
  observer.observe(msgs, { childList: true });
  observer.observe(chips, { childList: true });
  sync();
  const api = { sync, setOpen, dispose: () => observer.disconnect() };
  root.__aioAIChipFold = api;
  return api;
}
