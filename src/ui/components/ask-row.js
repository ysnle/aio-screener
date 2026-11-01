// v59.56: one 'AI에게 묻기' row for every screen — label plus question chips that open the shared AI panel
// (button.q-chip[data-action=_aioAskInPanel], handled by ui/panels/ask-panel.js). Questions are [label, question]
// pairs built from the screen's own read; empty or null entries are skipped, and no row is drawn without a question.
import { el } from './dom.js';

export function askRow(doc, questions, className = '') {
  const list = (questions || []).filter((item) => Array.isArray(item) && item[0] && item[1]);
  if (!doc || !list.length) return null;
  const row = el(doc, 'div', null, `aio-ask-row${className ? ` ${className}` : ''}`);
  row.append(el(doc, 'span', 'AI에게 묻기', 'sh-muted-text'));
  for (const [label, question] of list) {
    const chip = el(doc, 'button', label, 'q-chip');
    chip.type = 'button';
    chip.dataset.action = '_aioAskInPanel';
    chip.dataset.arg = question;
    row.append(chip);
  }
  return row;
}
