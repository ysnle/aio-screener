import { createResourceBag } from '../../app/lifecycle.js';
import { selectTechnical, selectSignal, selectHomeSummary } from '../../state/selectors/analysis.js';

// RM-01 (2026-07-19): every id this module used to write (home-hero-*, home-trading-signal,
// home-quality-score, score-gauge-val, score-decision-*, tech-candle-*, tech-health-pill,
// health-score-display) has a live legacy writer in js/aio-core.js/aio-data.js/aio-ui.js or an
// inline index.html script (route-owners.json legacyWriterEvidence). Content ownership stays
// legacy until each route's real ARX cutover deletes that writer; this module only stamps which
// slice state is available for that future cutover to consume.
function render({ documentRef, store, route }) {
  const technical = selectTechnical(store.getState());
  const signal = selectSignal(store.getState());
  const home = selectHomeSummary(store.getState());
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureSlice = 'analysis';
    page.dataset.aioArchitectureStatus = (route === 'home' ? home?.status : route === 'signal' ? signal?.status : technical?.status) || 'unavailable';
  }
}

export function createAnalysisPage({ documentRef, store, route = 'home' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store, route });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      eventTarget?.addEventListener?.('aio:refresh:done', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', renderNow));
      const page = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'analysis') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
