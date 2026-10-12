// P1653 (owner 2026-10-12): one AI conversation. The home and theme-detail pages had their own inline chat boxes with a
// second send pipeline; their prompts now open the top AI panel and send there, so every question shares one history,
// one route check and one budget.
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
  return () => { if (root._aioAskInPanel === ask) root._aioAskInPanel = previous; };
}
