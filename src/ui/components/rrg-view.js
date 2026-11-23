export function setRRGView(mode, btn, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._rrgViewMode = mode;
  root._sectorPerfView = mode === 'sectors' ? 'sectors' : 'all';
  documentRef?.querySelectorAll?.('#rrg-view-tabs .news-sort-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute?.('aria-pressed', 'false'); });
  if (btn) { btn.classList.add('active'); btn.setAttribute?.('aria-pressed', 'true'); }
  try { documentRef.dispatchEvent(new CustomEvent('aio:themesViewChanged', { detail: { mode } })); } catch (_) {}
}
