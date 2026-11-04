// Legacy unification (2026-10-26, roadmap item 11, screen 테마 · 섹터): the RRG 11섹터 / 세부 업종 / 전체 pills moved
// here from setRRGView in js/aio-pages.js. The scatter, status and quadrant chips are drawn by src/ui/pages/themes.js,
// which reads window._rrgViewMode and repaints on aio:themesViewChanged.
// v59.70 (theme-sector): the pills are the sector card's one scope control, so they also set the bars' scope
// (_sectorPerfView, read by the legacy weekly fetch) and carry aria-pressed.

export function setRRGView(mode, btn, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._rrgViewMode = mode;
  root._sectorPerfView = mode === 'sectors' ? 'sectors' : 'all';
  documentRef?.querySelectorAll?.('#rrg-view-tabs .news-sort-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute?.('aria-pressed', 'false'); });
  if (btn) { btn.classList.add('active'); btn.setAttribute?.('aria-pressed', 'true'); }
  try { documentRef.dispatchEvent(new CustomEvent('aio:themesViewChanged', { detail: { mode } })); } catch (_) {}
}
