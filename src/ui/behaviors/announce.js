// Results that change the screen without moving focus (a toast, a re-sorted table, a result count) are read out through
// two regions that exist from boot: a screen reader skips a live region created together with its first message.
const REGION_ID = { polite: 'aio-announce-polite', assertive: 'aio-announce-assertive' };

function region(documentRef, priority) {
  let node = documentRef.getElementById(REGION_ID[priority]);
  if (node) return node;
  node = documentRef.createElement('div');
  node.id = REGION_ID[priority];
  node.className = 'sr-only';
  node.setAttribute('aria-live', priority);
  node.setAttribute('aria-atomic', 'true');
  if (priority === 'assertive') node.setAttribute('role', 'alert');
  documentRef.body.appendChild(node);
  return node;
}

export function prepareAnnouncements(documentRef) {
  if (!documentRef?.body) return;
  region(documentRef, 'polite');
  region(documentRef, 'assertive');
}

export function announce(text, { priority = 'polite', documentRef = globalThis.document } = {}) {
  const message = String(text == null ? '' : text).trim();
  if (!message || !documentRef?.body) return;
  const node = region(documentRef, priority === 'assertive' ? 'assertive' : 'polite');
  // The same message twice in a row is a change only if the region was emptied in between.
  node.textContent = '';
  (documentRef.defaultView || globalThis).setTimeout(() => { node.textContent = message; }, 50);
}

export function installAnnouncements({ root = globalThis, documentRef = root?.document } = {}) {
  prepareAnnouncements(documentRef);
  if (root) root._aioAnnounce = (text, options) => announce(text, { ...options, documentRef });
}
