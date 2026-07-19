import { createResourceBag } from '../../app/lifecycle.js';

// RM-01 (2026-07-19): this module used to write [data-live-price]/[data-live-chg] quote
// attributes for macro/fxbond and breadth-*-big metric ids. All of those are live legacy writer
// targets (js/aio-data.js quote sink, js/aio-ui.js updateBreadthBars) except the macro FRED
// metric ids (macro-${metric}), which turned out not to exist in index.html at all — that write
// path was inert, not contested. Either way this module does not safely own any content today;
// it only stamps that a normalized market slice is mounted for macro/fxbond/breadth, for a future
// ARX cutover to build on.
export function createMarketSlicePage({ documentRef, route } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureSlice = 'market';
      bag.add(() => {
        if (page.dataset.aioArchitectureSlice === 'market') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
