// The two buttons under the holdings consent question in the chat (src/ai/context/personal-turn.js decides when it is
// asked). The answer sanitiser drops buttons, so they are built as elements under the last unsent notice.
export function showConsentChoices(document, card, action) {
  const rows = document.querySelectorAll('#ai-panel-msgs .ai-msg.ai[data-aio-unsent] .ai-msg-content');
  const host = rows[rows.length - 1];
  if (!host) return null;
  const group = document.createElement('div');
  group.className = 'lch-fb';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '보유 종목 전송 동의');
  for (const [choice, label] of [['yes', card.yes], ['no', card.no]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-chip';
    button.setAttribute('data-action', action);
    button.setAttribute('data-arg', choice);
    button.textContent = label;
    group.appendChild(button);
  }
  host.appendChild(group);
  return group;
}
