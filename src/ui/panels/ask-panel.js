// P1653 (owner 2026-10-12): one AI conversation. The home and theme-detail pages had their own inline chat boxes with a
// second send pipeline; their prompts now open the top AI panel and send there, so every question shares one history,
// one route check and one budget.
// v59.68: the screens' questions (askRow templates) become the panel's chips while it is open on that screen.
import { pageQuestions } from '../components/ask-row.js';

export function installAskPanel(root, documentRef) {
  if (!root || !documentRef?.getElementById) return () => {};
  const previous = root._aioAskInPanel;
  const ask = (question) => {
    const panel = documentRef.getElementById('ai-panel');
    const input = documentRef.getElementById('ai-panel-inp');
    if (!panel || !input) return;
    if (!panel.classList.contains('open')) root.toggleAIPanel?.();
    const text = String(question || '').trim();
    if (!text) { input.focus?.(); return; }
    input.value = text;
    root.chatSendUnified?.();
  };
  root._aioAskInPanel = ask;
  const panel = documentRef.getElementById('ai-panel');
  const chips = documentRef.getElementById('ai-panel-chips');
  const paint = () => {
    if (!panel?.classList.contains('open') || !chips || panel.querySelector('#ai-panel-msgs .ai-msg.user')) return;
    const questions = pageQuestions(documentRef);
    if (!questions.length) return;
    chips.replaceChildren(...questions.map(([label, question]) => {
      const chip = documentRef.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-chip';
      chip.textContent = label;
      chip.dataset.question = question;
      chip.addEventListener('click', () => ask(question));
      return chip;
    }));
  };
  const observer = panel && typeof root.MutationObserver === 'function' ? new root.MutationObserver(() => paint()) : null;
  observer?.observe(panel, { attributes: true, attributeFilter: ['class'] });
  // A route change while the panel is open restores the context defaults first (js/aio-chat.js); the screen's own follow.
  const onRoute = () => setTimeout(paint, 700);
  root.addEventListener?.('hashchange', onRoute);
  return () => {
    observer?.disconnect();
    root.removeEventListener?.('hashchange', onRoute);
    if (root._aioAskInPanel === ask) root._aioAskInPanel = previous;
  };
}
