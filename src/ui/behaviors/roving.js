// One tab stop per group of sibling choices. Tab enters a tab list, a radio group, a toolbar or a labelled group made
// only of pressed-state buttons (a segmented control) at its chosen item and leaves on the next Tab; the arrow keys,
// Home and End move inside it. Nothing is bound per group: a strip rebuilt by a re-render is picked up the next time
// focus or a key reaches it. A long run of sibling buttons opts in with data-roving.
const GROUPS = '[role="tablist"],[role="radiogroup"],[role="toolbar"],[role="group"],[data-roving]';
const PRESSABLE = 'button[aria-pressed],[role="button"][aria-pressed]';
const OTHER_CONTROLS = 'a[href],input,select,textarea,button:not([aria-pressed]),[role="button"]:not([aria-pressed])';
const ITEMS = {
  tablist: '[role="tab"]',
  radiogroup: '[role="radio"]',
};
const CHOSEN = '[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"],[aria-current]:not([aria-current="false"])';
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

function itemsOf(group) {
  const role = group.getAttribute('role');
  const own = (node) => node.closest(GROUPS) === group;
  if (role === 'group' && [...group.querySelectorAll(OTHER_CONTROLS)].some(own)) return [];
  const selector = ITEMS[role] || (role === 'group' ? PRESSABLE : 'button,[role="button"]');
  return [...group.querySelectorAll(selector)].filter((node) => !node.hidden && !node.disabled
    && node.getAttribute('aria-disabled') !== 'true' && node.closest(GROUPS) === group && node.getClientRects().length);
}

function setStop(items, stop) {
  if (items.length < 2) return;
  for (const item of items) item.tabIndex = item === stop ? 0 : -1;
}

// "auto" presses the item an arrow lands on, the way a tab list that swaps a panel in place behaves. "manual" only moves
// focus, for tabs that load a new screen and for groups of toggles.
function activation(group) {
  return group.dataset.activation || (group.getAttribute('role') === 'tablist' ? 'auto' : 'manual');
}

export function rovingTarget(key, index, length, { rtl = false, vertical = false } = {}) {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  const forward = vertical ? key === 'ArrowDown' : key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  const backward = vertical ? key === 'ArrowUp' : key === (rtl ? 'ArrowRight' : 'ArrowLeft');
  if (!forward && !backward) return -1;
  return (index + (forward ? 1 : -1) + length) % length;
}

export function installRoving({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.addEventListener) return () => {};
  let tabbing = false;
  const onKey = (event) => {
    // Only the focus move this Tab press causes counts as tabbing in; a later scripted focus must not be redirected.
    tabbing = event.key === 'Tab';
    if (tabbing) root.setTimeout(() => { tabbing = false; }, 0);
    if (event.defaultPrevented || !KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const group = event.target?.closest?.(GROUPS);
    if (!group) return;
    const items = itemsOf(group);
    const index = items.indexOf(event.target.closest('button,[role]'));
    if (index < 0 || items.length < 2) return;
    const next = rovingTarget(event.key, index, items.length, {
      rtl: root.getComputedStyle?.(group).direction === 'rtl',
      vertical: group.getAttribute('aria-orientation') === 'vertical',
    });
    if (next < 0) return;
    event.preventDefault();
    setStop(items, items[next]);
    items[next].focus();
    if (activation(group) === 'auto') items[next].click();
  };
  const onPointer = () => { tabbing = false; };
  const onFocus = (event) => {
    const group = event.target?.closest?.(GROUPS);
    if (!group) return;
    const items = itemsOf(group);
    const item = items.find((node) => node === event.target || node.contains(event.target));
    if (!item) return;
    const entered = !group.contains(event.relatedTarget);
    const chosen = items.find((node) => node.matches(CHOSEN));
    if (entered && tabbing && chosen && chosen !== item) {
      setStop(items, chosen);
      chosen.focus();
      return;
    }
    setStop(items, item);
  };
  documentRef.addEventListener('keydown', onKey);
  documentRef.addEventListener('pointerdown', onPointer, true);
  documentRef.addEventListener('focusin', onFocus);
  return () => {
    documentRef.removeEventListener('keydown', onKey);
    documentRef.removeEventListener('pointerdown', onPointer, true);
    documentRef.removeEventListener('focusin', onFocus);
  };
}
