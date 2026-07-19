import { createResourceBag } from '../../app/lifecycle.js';
import { selectEntityState } from '../../state/selectors/entity.js';
import { selectSentimentValues } from '../../state/selectors/sentiment.js';

function text(documentRef, id, value, fallback = '—') {
  const node = documentRef?.getElementById(id);
  if (node) node.textContent = value == null || value === '' ? fallback : String(value);
}

function number(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
}

function setVisible(documentRef, id, visible) {
  const node = documentRef?.getElementById(id);
  if (node) node.hidden = !visible;
}

function render({ documentRef, store, route }) {
  const state = selectEntityState(store.getState());
  const sentiment = selectSentimentValues(store.getState());
  const id = state?.id || '—';
  const quote = state?.quote || {};
  text(documentRef, 'ticker-hero-name', id);
  text(documentRef, 'ticker-hero-price', number(quote.value));
  text(documentRef, 'ticker-hero-chg', quote.pct == null ? '—' : `${number(quote.pct)}%`);
  text(documentRef, 'ticker-hero-fullname', state?.status === 'current' ? `관측 시각 ${quote.observedAt || '확인 중'}` : '종목 데이터를 기다리는 중입니다.');
  text(documentRef, 'ticker-m-mcap', number(state?.fundamentals?.marketCap));
  text(documentRef, 'ticker-m-pe', number(state?.fundamentals?.pe));
  text(documentRef, 'ticker-m-pb', number(state?.fundamentals?.pb));
  text(documentRef, 'ticker-m-roe', state?.fundamentals?.roe == null ? '—' : `${number(state.fundamentals.roe)}%`);
  text(documentRef, 'ticker-m-div', state?.fundamentals?.dividendYield == null ? '—' : `${number(state.fundamentals.dividendYield)}%`);
  text(documentRef, 'fund-analysis-text', state?.fundamentals ? 'Canonical entity data가 연결되었습니다.' : '기업 데이터 수신 후 표시됩니다.');
  text(documentRef, 'opt-pcr-val-secondary', sentiment?.putCall == null ? '—' : number(sentiment.putCall));
  text(documentRef, 'ticker-candle-symbol', id);
  text(documentRef, 'ticker-entry-symbol', id);
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
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
      if (routeNode) {
        routeNode.dataset.aioArchitectureRoute = route;
        routeNode.dataset.aioArchitectureRenderer = 'native';
      }
      return () => bag.dispose();
    }
  };
}
