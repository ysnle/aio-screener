// Legacy unification (2026-10-26, roadmap item 11, screen 테마 · 섹터): the 11섹터 / +세부 업종 toggle above the sector bars
// moved here from setSectorPerfView in js/aio-pages.js. The bars themselves are drawn by src/ui/pages/themes.js
// (renderThemePerformanceBars), which reads window._sectorPerfView and repaints on aio:sectorPerfChanged.

export function setSectorPerfView(view, btn, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._sectorPerfView = view;
  documentRef?.querySelectorAll?.('#sector-perf-view-tabs .news-sort-btn').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  try { documentRef.dispatchEvent(new CustomEvent('aio:sectorPerfChanged', { detail: { view } })); } catch (_) {}
}
