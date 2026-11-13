// A search field over a list of options. Focus stays in the field; the arrow keys, Home and End move a highlight the
// field points at with aria-activedescendant, Enter chooses it, Escape closes the list. Call sync() after the options
// are redrawn.
let serial = 0;

export function nextOptionIndex(key, index, length) {
  if (!length) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown') return index < 0 ? 0 : (index + 1) % length;
  if (key === 'ArrowUp') return index < 0 ? length - 1 : (index - 1 + length) % length;
  return index;
}

export function bindCombobox({ input, list, onClose } = {}) {
  if (!input || !list) return { sync() {}, destroy() {} };
  const name = list.id || (list.id = `aio-listbox-${++serial}`);
  let active = -1;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', name);
  const options = () => (list.hidden ? [] : [...list.querySelectorAll('[role="option"]')]);
  const highlight = (index) => {
    const items = options();
    active = index >= 0 && index < items.length ? index : -1;
    items.forEach((item, at) => {
      if (!item.id) item.id = `${name}-option-${at}`;
      item.tabIndex = -1;
      item.setAttribute('aria-selected', String(at === active));
    });
    if (active >= 0) { input.setAttribute('aria-activedescendant', items[active].id); items[active].scrollIntoView?.({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-expanded', String(!list.hidden));
  };
  const onKey = (event) => {
    if (event.isComposing) return;
    const items = options();
    if (event.key === 'Escape') {
      if (list.hidden) return;
      event.preventDefault();
      onClose?.();
      highlight(-1);
      return;
    }
    if (event.key === 'Enter') {
      if (active < 0 || !items[active]) return;
      event.preventDefault();
      items[active].click();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !items.length) return;
    if ((event.key === 'Home' || event.key === 'End') && active < 0) return; // the caret's keys until a highlight exists
    event.preventDefault();
    highlight(nextOptionIndex(event.key, active, items.length));
  };
  input.addEventListener('keydown', onKey);
  highlight(-1);
  return {
    sync: () => highlight(-1),
    destroy: () => input.removeEventListener('keydown', onKey),
  };
}
