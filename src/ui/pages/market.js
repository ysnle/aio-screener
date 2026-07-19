import { createResourceBag } from '../../app/lifecycle.js';
import { selectMarketMetric, selectMarketQuote } from '../../state/selectors/market.js';

function format(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

const ROUTE_QUOTES = Object.freeze({
  macro: ['CL=F', 'GC=F', '^TNX', 'DX-Y.NYB', 'KRW=X'],
  fxbond: ['DX-Y.NYB', '^TNX', 'JPY=X', 'KRW=X', 'HYG'],
  breadth: []
});

const ROUTE_METRICS = Object.freeze({
  macro: ['fedRate', 'cpi', 'coreCpi', 'corePce', 'nfp'],
  fxbond: [],
  breadth: ['breadth5sma', 'breadth20sma', 'breadth50sma']
});

function renderQuote(documentRef, state, symbol) {
  const quote = selectMarketQuote(state, symbol);
  documentRef?.querySelectorAll?.(`[data-live-price="${symbol}"]`).forEach((element) => {
    element.textContent = format(quote?.value, symbol === '^TNX' ? 2 : 2);
    element.dataset.aioStateSource = 'market-selector';
    element.dataset.aioObservedAt = quote?.observedAt || '';
  });
  documentRef?.querySelectorAll?.(`[data-live-chg="${symbol}"]`).forEach((element) => {
    element.textContent = quote?.pct == null ? '—' : `${quote.pct >= 0 ? '+' : ''}${format(quote.pct, 2)}%`;
  });
}

function renderMetric(documentRef, state, metric) {
  const value = selectMarketMetric(state, metric);
  const aliases = {
    breadth5sma: 'breadth-5sma-big',
    breadth20sma: 'breadth-20sma-big',
    breadth50sma: 'breadth-50sma-big'
  };
  const element = documentRef?.getElementById?.(aliases[metric] || `macro-${metric}`);
  if (element) {
    element.textContent = format(value, 1);
    element.dataset.aioStateSource = 'market-selector';
  }
}

export function createMarketSlicePage({ documentRef, store, route } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureSlice = 'market';
      const render = () => {
        const state = store?.getState?.() || {};
        (ROUTE_QUOTES[route] || []).forEach((symbol) => renderQuote(documentRef, state, symbol));
        (ROUTE_METRICS[route] || []).forEach((metric) => renderMetric(documentRef, state, metric));
      };
      const unsubscribe = store?.subscribe?.(render);
      if (unsubscribe) bag.add(unsubscribe);
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:serverDataLoaded'].forEach((eventName) => {
        documentRef?.addEventListener?.(eventName, render);
        bag.add(() => documentRef?.removeEventListener?.(eventName, render));
      });
      bag.add(() => {
        if (page.dataset.aioArchitectureSlice === 'market') delete page.dataset.aioArchitectureSlice;
      });
      render();
      return () => bag.dispose();
    }
  };
}
