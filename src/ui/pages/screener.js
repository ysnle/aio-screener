import { createResourceBag } from '../../app/lifecycle.js';
import { selectScreenerState } from '../../state/selectors/screener.js';

// RM-01 (2026-07-19): this module used to replaceChildren() the screener-results-body table
// with a 5-column row (rank/symbol/name/sector/score) while legacy (js/aio-data.js:1974/1977/2013)
// kept writing the same table via a 22-column innerHTML string. That is the highest-severity
// contested container in F-03/route-owners.json: if native's replaceChildren() runs after
// legacy's innerHTML, the visible table regresses from 22 columns to 5. Content ownership stays
// legacy until screener gets its real ARX cutover (behind RM-09/RM-02 table virtualization work);
// this module only stamps screener state availability.
function render({ documentRef, store }) {
  const state = selectScreenerState(store.getState());
  const page = documentRef?.getElementById('page-screener');
  if (page) {
    page.dataset.aioArchitectureRoute = 'screener';
    page.dataset.aioArchitectureSlice = 'screener';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  }
}

export function createScreenerPage({ documentRef, store } = {}) {
  return {
    route: 'screener',
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:refresh:done', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:refresh:done', renderNow));
      const page = documentRef?.getElementById('page-screener');
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'screener') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
