import { createResourceBag } from '../../app/lifecycle.js';

// RM-01 (2026-07-19): this module used to write rrg-quadrant-cards, rrg-chart-status, and
// theme-detail-title. All three have live legacy writers in js/aio-core.js (:22646, :22674/:22715/
// :22841, :23469 — route-owners.json legacyWriterEvidence). Content ownership stays legacy until
// themes/theme-detail get their real ARX cutover; this module only stamps that the normalized
// themes slice is mounted.
export function createThemesPage({ documentRef, route = 'themes' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureSlice = 'themes';
      bag.add(() => {
        if (page.dataset.aioArchitectureSlice === 'themes') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
