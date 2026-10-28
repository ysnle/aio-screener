// Expect cases for the 오늘 "지금 시세" chip (P2115): the observation time names the oldest price shown under the heading.
// A fresh BTC or a looked-up ticker in _liveData, or a price the cell hides behind CSS, used to label stale tiles as
// just observed.
export const suite = { name: 'home-quote-heading', source: 'src/ui/components/home-kpi-trend.js' };

const node = (props = {}) => ({ ...props, children: [], replaceChildren(...items) { this.children = items; } });
const doc = (tiles) => {
  const heading = node();
  return {
    heading,
    createElement: (tag) => node({ tag }),
    createTextNode: (text) => ({ textContent: text }),
    getElementById: (id) => (id === 'home-quote-basis' ? heading : id === 'home-kpi-strip' ? { querySelectorAll: () => tiles } : null)
  };
};
// A tile is the price element under the strip; `shown: false` is one CSS hides (getClientRects() is empty).
const tile = (symbol, shown = true) => ({ getAttribute: () => symbol, getClientRects: () => (shown ? [{}] : []) });
const text = (heading) => heading.children.map((child) => child.textContent).join('');

const live = {
  'ES=F': { observedAt: '2026-10-27T18:59:00Z' },
  '^TNX': { observedAt: '2026-10-27T18:40:00Z' },
  '^GSPC': { observedAt: '2026-10-28T01:10:00Z' },
  'BTC-USD': { observedAt: '2026-10-28T01:17:00Z' },
  NVDA: { quoteEnvelope: { observedAt: '2026-10-28T01:16:00Z' } }
};
const weekday = Date.parse('2026-10-28T01:20:00Z');

export default async function cases({ load }) {
  const { renderHomeQuoteHeading, tileObservedKst } = await load(suite.source);
  const scenarios = [
    ['oldest-shown-tile-not-newest-live-row', [tile('ES=F'), tile('^TNX'), tile('BTC-USD')]],
    ['css-hidden-price-does-not-count', [tile('ES=F'), tile('^GSPC', false), tile('^TNX')]],
    ['looked-up-ticker-outside-strip-ignored', [tile('BTC-USD')]],
    ['no-tiles-no-time', []]
  ];
  const out = scenarios.map(([name, tiles]) => {
    const page = doc(tiles);
    renderHomeQuoteHeading({ documentRef: page, root: { _liveData: live }, nowMs: weekday });
    return { name, input: { tiles: tiles.map((item) => `${item.getAttribute()}${item.getClientRects().length ? '' : ' (hidden)'}`), live }, output: text(page.heading) };
  });
  out.push({ name: 'epoch-seconds-stamp', input: { live: { X: { observedAt: 1793145600 } } }, output: tileObservedKst({ X: { observedAt: 1793145600 } }, ['X']) ?? '(없음)' });
  return out;
}
