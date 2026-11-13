// Open dialogs, sheets and popovers stack in order. Escape and a press outside close the top one only; Tab stays inside
// a modal one; the page behind is inert unless the layer keeps its own backdrop (inert: false).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const stacks = new WeakMap();

function focusableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((node) => !node.closest('[hidden],[inert]') && node.getClientRects().length);
}

// Restores only what this call made inert: another layer may hold the same element.
function inertOutside(root, documentRef) {
  const made = [];
  for (let node = root; node && node !== documentRef.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children || []) {
      if (sibling === node || sibling.inert || sibling.hasAttribute('aria-live')) continue;
      sibling.inert = true;
      made.push(sibling);
    }
  }
  return () => { for (const node of made) node.inert = false; };
}

function stackFor(documentRef) {
  let stack = stacks.get(documentRef);
  if (stack) return stack;
  stack = [];
  stacks.set(documentRef, stack);
  documentRef.addEventListener('keydown', (event) => {
    const layer = stack[stack.length - 1];
    if (!layer || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      layer.onDismiss?.();
      return;
    }
    if (event.key !== 'Tab' || !layer.modal || !layer.root) return;
    const items = focusableIn(layer.root);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = documentRef.activeElement;
    if (!layer.root.contains(active)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }, true);
  documentRef.addEventListener('pointerdown', (event) => {
    const layer = stack[stack.length - 1];
    if (!layer?.outside || !layer.root || layer.root.contains(event.target) || layer.trigger?.contains?.(event.target)) return;
    layer.onDismiss?.();
  }, true);
  return stack;
}

// Returns the function that takes the layer off the stack; onDismiss is the layer's own close and is expected to call it.
// A popover passes modal: false; outside: true also closes it on a press outside root and trigger.
export function openLayer({ root, onDismiss, modal = true, inert = modal, focus = modal, outside = false, trigger = null, documentRef = root?.ownerDocument } = {}) {
  if (!documentRef) return () => {};
  const stack = stackFor(documentRef);
  const layer = { root, onDismiss, modal, outside, trigger };
  stack.push(layer);
  const restore = inert && root ? inertOutside(root, documentRef) : () => {};
  if (focus && root) {
    const first = focusableIn(root)[0];
    if (first) first.focus(); else if (root.tabIndex >= 0) root.focus();
  }
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const at = stack.indexOf(layer);
    if (at >= 0) stack.splice(at, 1);
    restore();
  };
}

export function openLayerCount(documentRef) { return stacks.get(documentRef)?.length || 0; }

export function installLayers({ root = globalThis } = {}) {
  if (!root) return;
  root._aioModalTrap = (rootEl, onDismiss) => openLayer({ root: rootEl, onDismiss });
}
