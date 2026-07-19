import { createResourceBag } from '../../app/lifecycle.js';
import { selectEntityState } from '../../state/selectors/entity.js';

// RM-01 (2026-07-19): every id this module used to write (ticker-hero-*, ticker-m-*,
// fund-analysis-text, opt-pcr-val-secondary, ticker-candle-symbol, ticker-entry-symbol) has a
// live legacy writer in js/aio-core.js/aio-data.js or an inline index.html script
// (route-owners.json legacyWriterEvidence). Content ownership stays legacy until each of
// ticker/fundamental/options gets its real ARX cutover; this module only stamps entity state
// availability for that future cutover to consume.
function render({ documentRef, store, route }) {
  const state = selectEntityState(store.getState());
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
    routeNode.dataset.aioArchitectureRoute = route;
    routeNode.dataset.aioArchitectureSlice = 'entity';
    routeNode.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  }
}

export function createEntityPage({ documentRef, store, route = 'ticker' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store, route });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      const refresh = () => renderNow();
      eventTarget?.addEventListener?.('aio:liveQuotes', refresh);
      eventTarget?.addEventListener?.('aio:refresh:done', refresh);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', refresh));
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', refresh));
      const routeNode = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (routeNode?.dataset.aioArchitectureRoute === route) delete routeNode.dataset.aioArchitectureRoute;
        if (routeNode?.dataset.aioArchitectureSlice === 'entity') delete routeNode.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
