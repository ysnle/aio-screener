import { createResourceBag } from '../../app/lifecycle.js';
import { selectEntityState } from '../../state/selectors/entity.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function renderTickerHero(documentRef, state) {
  const id = state?.id || null;
  const quote = state?.quote || {};
  const price = finite(quote.value);
  const pct = finite(quote.pct);
  setText(documentRef, 'ticker-hero-name', id || '—');
  setText(documentRef, 'ticker-hero-fullname', id ? (state?.name || id) : '종목을 검색하세요');
  setText(documentRef, 'ticker-hero-price', price == null ? '—' : `$${price.toFixed(2)}`);
  const change = setText(documentRef, 'ticker-hero-chg', pct == null ? '—' : `${pct >= 0 ? '▲ +' : '▼ '}${Math.abs(pct).toFixed(2)}%`);
  if (change) change.className = `ticker-chg-big ${pct == null ? '' : pct >= 0 ? 'up' : 'down'}`;
}

function formatOptionMetric(metric) {
  const value = finite(metric?.value);
  return value == null ? '—' : value.toFixed(2);
}

function renderOptionMetric(documentRef, id, metric, color = null) {
  const element = setText(documentRef, id, formatOptionMetric(metric));
  if (!element) return;
  const sourceKind = metric?.sourceKind || 'unavailable';
  element.setAttribute('data-source-kind', sourceKind);
  element.setAttribute('data-source-label', metric?.source || 'unavailable');
  element.setAttribute('data-operational-use', 'reference-only');
  if (color) element.style.color = color;
}

function renderOptions(documentRef, state) {
  const options = state?.options || {};
  const pcr = finite(options.pcr?.value);
  const pcrColor = pcr == null
    ? 'var(--text-muted)'
    : pcr >= 1.2 ? 'var(--data-red)' : pcr >= 0.9 ? 'var(--data-amber)' : 'var(--data-green)';
  renderOptionMetric(documentRef, 'opt-vix-val-secondary', options.vix);
  renderOptionMetric(documentRef, 'opt-pcr-val-secondary', options.pcr, pcrColor);
  renderOptionMetric(documentRef, 'opt-skew-val-secondary', options.skew);
}

function renderFundamentalStatus(documentRef, state) {
  const element = documentRef?.getElementById('fund-data-status');
  if (!element) return;
  const fundamentals = state?.fundamentals;
  const available = !!fundamentals && typeof fundamentals === 'object'
    && Array.isArray(fundamentals.coverage) && fundamentals.coverage.length > 0;
  element.textContent = available ? '● SEC 연간 데이터' : '○ SEC 데이터 미수신';
  element.className = `freshness-badge ${available ? 'fb-live' : 'fb-static'}`;
  element.setAttribute('data-source-kind', available ? (fundamentals.sourceTier || 'official-regulator') : 'unavailable');
  element.setAttribute('data-source-label', available ? (fundamentals.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  if (fundamentals?.observedAt) element.setAttribute('data-observed-at', fundamentals.observedAt);
  else element.removeAttribute('data-observed-at');
}

// RM-01 (2026-07-19): every id this module used to write (ticker-m-*,
// fund-analysis-text, opt-pcr-val-secondary, ticker-candle-symbol, ticker-entry-symbol) has a
// live legacy writer in js/aio-core.js/aio-data.js or an inline index.html script
// (route-owners.json legacyWriterEvidence). P777 transfers only the ticker hero
// name/fullname/price/change primary surface; secondary ticker overview/candle/entry surfaces remain legacy.
// P778 transfers only the three options replacement-metric values; P779 transfers only the
// SEC annual-data availability/source badge on fundamental. Options-chain, report, chart, and
// narrative scaffolding remain legacy-owned.
function render({ documentRef, store, route }) {
  const state = selectEntityState(store.getState());
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
    routeNode.dataset.aioArchitectureRoute = route;
    routeNode.dataset.aioArchitectureSlice = 'entity';
    routeNode.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    if (route === 'ticker' || route === 'options' || route === 'fundamental') routeNode.dataset.aioArchitectureRenderer = 'native';
  }
  if (route === 'ticker') renderTickerHero(documentRef, state);
  if (route === 'options') renderOptions(documentRef, state);
  if (route === 'fundamental') renderFundamentalStatus(documentRef, state);
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
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:sentimentUpdated', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, refresh);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, refresh));
      });
      const routeNode = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (routeNode?.dataset.aioArchitectureRenderer === 'native') delete routeNode.dataset.aioArchitectureRenderer;
        if (routeNode?.dataset.aioArchitectureRoute === route) delete routeNode.dataset.aioArchitectureRoute;
        if (routeNode?.dataset.aioArchitectureSlice === 'entity') delete routeNode.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
