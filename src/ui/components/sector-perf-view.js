export function setSectorPerfView(view, btn, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._sectorPerfView = view;
  documentRef?.querySelectorAll?.('#sector-perf-view-tabs .news-sort-btn').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  try { documentRef.dispatchEvent(new CustomEvent('aio:sectorPerfChanged', { detail: { view } })); } catch (_) {}
}
