// v58.80 (first-users F23, cross-cutting causes 3 and 4): one owner for the small floating layers — the glossary term
// popover, the "?" tooltips and the touch title popover. Only one is open at a time (opening one closes the other), all
// are placed inside the viewport by one rule, and while one is open the floating chrome steps aside
// (body.aio-popover-open hides 맨 위로, which sat on top of popovers near the bottom-right).
export const POPOVER_EDGE = 8;

// Below the anchor when it fits, else above, else whichever side has more room, clamped to the viewport.
export function placePopover(anchorRect, size, viewport) {
  const width = Math.min(size.width, viewport.width - POPOVER_EDGE * 2);
  const left = Math.max(POPOVER_EDGE, Math.min(anchorRect.left + anchorRect.width / 2 - width / 2, viewport.width - width - POPOVER_EDGE));
  const below = anchorRect.bottom + 6;
  const above = anchorRect.top - size.height - 6;
  const roomBelow = viewport.height - POPOVER_EDGE - below;
  const top = roomBelow >= size.height ? below : above >= POPOVER_EDGE ? above
    : roomBelow >= anchorRect.top - POPOVER_EDGE ? Math.min(below, viewport.height - size.height - POPOVER_EDGE) : POPOVER_EDGE;
  return { left: Math.round(left), top: Math.round(Math.max(POPOVER_EDGE, top)), width: Math.round(width), side: top >= anchorRect.bottom ? 'below' : 'above' };
}

let current = null;

// A popover calls this as it opens, with the function that closes it; the one already open is closed first.
export function claimPopover(documentRef, close) {
  if (current && current.close !== close) {
    const previous = current;
    current = null;
    try { previous.close(); } catch (_) { /* a broken closer never blocks the new popover */ }
  }
  current = { close };
  documentRef?.body?.classList.add('aio-popover-open');
}

// A popover calls this as it closes; only the owner of the open slot clears it.
export function releasePopover(documentRef, close) {
  if (current?.close !== close) return;
  current = null;
  documentRef?.body?.classList.remove('aio-popover-open');
}

export function openPopoverCount() { return current ? 1 : 0; }

// N4#6/#7: a page scrolled under a resting mouse fired pointerover and opened popovers nobody pointed at. Hover opens
// are ignored for a moment after any scroll; taps, clicks and keyboard focus are unaffected.
// v58.80 run-5: a route change draws a new page under the same resting mouse (a sidebar click left the 시장 상태
// tooltip open on arrival), so after a navigation hover waits for the pointer to really move (movement 0 = synthetic).
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
