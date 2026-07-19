import { createResourceBag } from '../../app/lifecycle.js';
import { selectNewsItems } from '../../state/selectors/news.js';

// RM-01 (2026-07-19): this module used to replaceChildren() live-news-feed/briefing-live-news-list
// while legacy (js/aio-data.js, 5 writers for live-news-feed / 6 for briefing-live-news-list) kept
// writing the same containers — the contested-container case F-03 flagged for market-news/briefing.
// It also intercepted data-action clicks (filterNewsByCountry/filterNewsByTopic/setNewsSortMode/
// setNewsTypeTab/_aioFetchAllNewsForce) with stopPropagation()+preventDefault(), which silently
// blocked legacy's own data-action delegator (js/aio-data.js defines all of those as real global
// functions) from ever receiving the click — a hidden regression beyond the DOM-write race. Content
// and interaction ownership stay legacy until market-news/briefing get their real ARX cutover; this
// module only stamps news state availability.
function render({ documentRef, store, route }) {
  const items = selectNewsItems(store?.getState?.() || {});
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureSlice = 'news';
    page.dataset.aioArchitectureState = items.length ? 'observed' : 'blocked';
  }
}

export function createNewsPage({ documentRef, store, route = 'market-news' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, store, route });
      renderNow();
      const unsubscribe = store?.subscribe?.(renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || globalThis;
      ['aio:newsUpdated', 'aio:refresh:done', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
      const page = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'news') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
