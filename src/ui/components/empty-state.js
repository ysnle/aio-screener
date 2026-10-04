// P1429 (Codex review 2026-10-04): one way to say "this is not available" — what is missing, why, and what
// the user can still do or when it appears — instead of large '—' cards and scattered '미수신' labels.
export function emptyState(doc, { title, reason = '', next = '', action = null, compact = false } = {}) {
  const box = doc.createElement('div');
  box.className = `empty-state${compact ? ' is-compact' : ''}`;
  box.setAttribute('role', 'status');
  const head = doc.createElement('strong');
  head.className = 'empty-state-title';
  head.textContent = title || '지금은 볼 수 없습니다';
  box.append(head);
  if (reason) {
    const why = doc.createElement('span');
    why.className = 'empty-state-reason';
    why.textContent = reason;
    box.append(why);
  }
  if (next) {
    const then = doc.createElement('span');
    then.className = 'empty-state-next';
    then.textContent = next;
    box.append(then);
  }
  if (action?.label && typeof action.onClick === 'function') {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'aio-btn-table';
    button.textContent = action.label;
    button.addEventListener('click', action.onClick);
    box.append(button);
  }
  return box;
}
