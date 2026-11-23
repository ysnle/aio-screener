import { openLayer } from '../behaviors/layers.js';

export const POPOVER_EDGE = 8;

// Below the anchor when it fits, else above, else whichever side has more room, clamped to the viewport.
export function placePopover(anchorRect, size, viewport) {
  const width = Math.min(size.width, viewport.width - POPOVER_EDGE * 2);
  const left = Math.max(POPOVER_EDGE, Math.min(anchorRect.left, viewport.width - width - POPOVER_EDGE));
  const below = anchorRect.bottom + 6;
  const above = anchorRect.top - size.height - 6;
  const roomBelow = viewport.height - POPOVER_EDGE - below;
  const top = roomBelow >= size.height ? below : above >= POPOVER_EDGE ? above
    : roomBelow >= anchorRect.top - POPOVER_EDGE ? Math.min(below, viewport.height - size.height - POPOVER_EDGE) : POPOVER_EDGE;
  return { left: Math.round(left), top: Math.round(Math.max(POPOVER_EDGE, top)), width: Math.round(width), side: top >= anchorRect.bottom ? 'below' : 'above' };
}

let current = null;

// A popover calls this as it opens, with the function that closes it; the one already open is closed first.
export function claimPopover(documentRef, close, { dismiss = close } = {}) {
  if (current?.close === close) return;
  if (current) {
    const previous = current;
    current = null;
    previous.release();
    try { previous.close(); } catch (_) { /* a broken closer never blocks the new popover */ }
  }
  // Escape closes the popover before anything under it (behaviors/layers.js).
  current = { close, release: documentRef?.addEventListener ? openLayer({ documentRef, onDismiss: dismiss, modal: false }) : () => {} };
  documentRef?.body?.classList.add('aio-popover-open');
}

export function releasePopover(documentRef, close) {
  if (current?.close !== close) return;
  current.release();
  current = null;
  documentRef?.body?.classList.remove('aio-popover-open');
}

export function openPopoverCount() { return current ? 1 : 0; }

let lastScrollAt = -Infinity;
let awaitingMove = false;
const watched = new WeakSet();
const clock = (root) => (typeof root?.performance?.now === 'function' ? root.performance.now() : Date.now());
export function watchScroll(root) {
  if (!root || watched.has(root) || typeof root.addEventListener !== 'function') return;
  watched.add(root);
  root.addEventListener('scroll', () => { lastScrollAt = clock(root); }, { capture: true, passive: true });
  const navigated = () => { awaitingMove = true; };
  root.addEventListener('hashchange', navigated);
  root.addEventListener('popstate', navigated);
  root.addEventListener('pointermove', (event) => { if (event.movementX || event.movementY) awaitingMove = false; }, { capture: true, passive: true });
}
export function hoverSuppressed(root, ms = 400) { return awaitingMove || clock(root) - lastScrollAt < ms; }
