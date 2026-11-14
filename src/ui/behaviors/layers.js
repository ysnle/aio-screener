// Open dialogs, sheets and popovers stack in order. Escape closes the top one only; a press outside closes the layers
// it is outside of; Tab stays inside the nearest modal one; the page behind a modal is inert unless the layer keeps its
// own backdrop (inert: false).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]';

const stacks = new WeakMap();
const pressed = new WeakMap();

// The control a layer returns focus to when it closes.
export function focusOrigin(documentRef) {
  const active = documentRef.activeElement;
  if (active && active !== documentRef.body) return active;
  const last = pressed.get(documentRef);
  return last?.isConnected ? last : null;
}

function focusableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((node) => (node.localName === 'summary' ? node.getAttribute('tabindex') !== '-1' : node.tabIndex >= 0) && !node.closest('[hidden],[inert]') && node.getClientRects().length);
}

// The layer's own ancestors lose an inert flag a lower layer set, and everything beside them gains one. Release puts
// back exactly what this call changed: another layer may hold the same element.
function inertOutside(root, documentRef) {
  const made = [];
  const lifted = [];
  for (let node = root; node && node !== documentRef.body; node = node.parentElement) {
    if (node.inert) { node.inert = false; lifted.push(node); }
    for (const sibling of node.parentElement?.children || []) {
      if (sibling === node || sibling.inert || String(sibling.id || '').startsWith('aio-announce-')) continue;
      sibling.inert = true;
      made.push(sibling);
    }
  }
  return () => {
    for (const node of made) node.inert = false;
    for (const node of lifted) node.inert = true;
  };
}

// A layer whose root left the document without being released is dropped.
function liveStack(stack) {
  for (let at = stack.length - 1; at >= 0; at -= 1) {
    if (stack[at].root?.isConnected === false) stack.splice(at, 1)[0].restore();
  }
  return stack;
}

function pressedOutside(stack, target) {
  for (const layer of [...stack].reverse()) {
    if (!layer.root) continue;
    if (layer.root.contains(target) || layer.trigger?.contains?.(target)) return;
    if (layer.outside) layer.onDismiss?.();
    if (layer.modal) return;
  }
}

function stackFor(documentRef) {
  let stack = stacks.get(documentRef);
  if (stack) return stack;
  stack = [];
  stacks.set(documentRef, stack);
  documentRef.addEventListener('keydown', (event) => {
    const layer = liveStack(stack)[stack.length - 1];
    if (!layer || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      layer.onDismiss?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = [...stack].reverse().find((entry) => entry.modal);
    if (!modal) return;
    const items = focusableIn(modal.root);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = documentRef.activeElement;
    if (!modal.root.contains(active)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && (active === first || active === modal.root)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }, true);
  // A finger that starts a scroll also starts a pointerdown, so touch decides on the click that follows a tap. A press
  // on a scrollbar is not a press on the page.
  let touchStarted = false;
  documentRef.addEventListener('pointerdown', (event) => {
    touchStarted = event.pointerType === 'touch';
    pressed.set(documentRef, event.target?.closest?.('button,a[href],[role="button"],[tabindex]') || null);
    if (touchStarted || !liveStack(stack).length) return;
    const target = event.target;
    if (target?.clientWidth > 0 && (event.offsetX > target.clientWidth || event.offsetY > target.clientHeight)) return;
    pressedOutside(stack, target);
  }, true);
  documentRef.addEventListener('click', (event) => {
    if (!touchStarted) return;
    touchStarted = false;
    if (liveStack(stack).length) pressedOutside(stack, event.target);
  }, true);
  return stack;
}

// Returns the function that takes the layer off the stack; onDismiss is the layer's own close and is expected to call it.
// A popover passes modal: false; outside: true also closes it on a press outside root and trigger.
export function openLayer({ root, onDismiss, modal = true, inert = modal, focus = modal, outside = false, trigger = null, documentRef = root?.ownerDocument } = {}) {
  if (!documentRef) return () => {};
  const stack = stackFor(documentRef);
  const layer = { root, onDismiss, modal: modal && Boolean(root), outside, trigger, restore: () => {} };
  stack.push(layer);
  if (inert && root) layer.restore = inertOutside(root, documentRef);
  if (focus && root) {
    const first = focusableIn(root)[0];
    if (first) first.focus(); else if (root.tabIndex >= 0) root.focus();
  }
  return () => {
    const at = stack.indexOf(layer);
    if (at < 0) return;
    stack.splice(at, 1);
    layer.restore();
  };
}

export function openLayerCount(documentRef) { return stacks.get(documentRef)?.length || 0; }

export function installLayers({ root = globalThis } = {}) {
  if (!root) return;
  if (root.document) { stackFor(root.document); root._aioFocusOrigin = () => focusOrigin(root.document); }
  root._aioModalTrap = (rootEl, onDismiss) => openLayer({ root: rootEl, onDismiss });
  root._aioOpenLayer = openLayer;
}
