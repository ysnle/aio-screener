import { createResourceBag } from '../../app/lifecycle.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';

// RM-01 (2026-07-19): this module used to fully repaint pf-total-value/pf-total-pnl/etc. and
// replaceChildren() the pf-positions-tbody table with a 5-column row, while legacy
// (js/aio-ui.js liveEls + an inline index.html script at :12742/:12928-:12952) kept writing the
// same ids/table with the real column set. That is the highest-severity contested container in
// F-03/route-owners.json: whichever writer runs last wins the race, and native losing means the
// table silently shrinks. Content ownership stays legacy until portfolio gets its real ARX
// cutover (behind RM-09 storage/vault work); this module only stamps portfolio state
// availability.
function render({ documentRef, store }) {
  const state = selectPortfolioState(store.getState());
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureSlice = 'portfolio';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  }
}

export function createPortfolioPage({ documentRef, store } = {}) {
  return {
    route: 'portfolio',
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store });
      renderNow();
      bag.add(store.subscribe(renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      const page = documentRef?.getElementById('page-portfolio');
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
