// The section a control belongs to: the nearest ancestor with an id that is still in the document after the rebuild.
function identity(node) {
  const group = node.closest('[role="group"],[role="tablist"],[role="radiogroup"],[role="toolbar"]');
  const anchors = [];
  for (let at = node.parentElement; at; at = at.parentElement) if (at.id) anchors.push(at.id);
  return {
    anchors,
    tag: node.tagName,
    group: group?.getAttribute('aria-label') || '',
    key: node.dataset?.window || node.dataset?.period || node.dataset?.key || node.dataset?.value || '',
    text: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 80)
  };
}

function twinOf(documentRef, mark) {
  for (const id of mark.anchors) {
    const scope = documentRef.getElementById(id);
    if (!scope) continue;
    const candidates = [...scope.querySelectorAll(mark.tag)].filter((node) => {
      const other = identity(node);
      return other.group === mark.group && other.key === mark.key && other.text === mark.text;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }
  return null;
}

export function installFocusContinuity({ root = globalThis, documentRef = root?.document } = {}) {
  if (!documentRef?.addEventListener) return () => {};
  let last = null;
  let mark = null;
  const onFocusIn = (event) => {
    const node = event.target;
    if (!node || node === documentRef.body || !node.closest?.('.page')) { last = null; mark = null; return; }
    last = node;
    mark = identity(node);
  };
  const recover = (gone) => {
    const active = documentRef.activeElement;
    if (active && active !== documentRef.body) return;
    const twin = twinOf(documentRef, gone);
    if (twin && !twin.disabled) twin.focus({ preventScroll: true });
  };
  // Removing a focused element does not reliably fire focusout, so the check runs after DOM changes (one cheap test while
  // nothing focused was removed). A plain blur (a click on empty space) leaves `last` connected and is not touched.
  const onFocusOut = (event) => { if (event.target === last && event.relatedTarget) { last = null; mark = null; } };
  const observer = typeof root.MutationObserver === 'function' ? new root.MutationObserver(() => { if (last && !last.isConnected) { const gone = mark; last = null; mark = null; recover(gone); } }) : null;
  documentRef.addEventListener('focusin', onFocusIn);
  documentRef.addEventListener('focusout', onFocusOut);
  observer?.observe(documentRef.body, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    documentRef.removeEventListener('focusin', onFocusIn);
    documentRef.removeEventListener('focusout', onFocusOut);
  };
}
