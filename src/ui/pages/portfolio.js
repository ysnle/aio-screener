import { createResourceBag } from '../../app/lifecycle.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';

// RM-01 (2026-07-19): this module used to fully repaint pf-total-value/pf-total-pnl/etc. and
// replaceChildren() the pf-positions-tbody table with a 5-column row, while legacy
// (js/aio-ui.js liveEls + an inline index.html script at :12742/:12928-:12952) kept writing the
// same ids/table with the real column set. That is the highest-severity contested container in
// F-03/route-owners.json: whichever writer runs last wins the race, and native losing means the
// table silently shrinks. P780 transfers only the independently owned pf-analysis-status
// readiness text; table, prices, CRUD, risk, and chart surfaces remain legacy until the
// real ARX/RM-09 storage/vault cutover. P810 adds a bounded native hero projection
// for total value and total P/L; the legacy summary writer is fenced from those two sinks.
function renderPortfolioStatus(documentRef, state) {
  const element = documentRef?.getElementById('pf-analysis-status');
  if (!element) return;
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const current = state?.status === 'current' && holdings.length > 0;
  element.textContent = current
    ? `리스크 계산 입력 수신 · ${holdings.length}개 포지션`
    : state?.status === 'empty' ? '포트폴리오 등록 후 자동 계산됩니다.' : '포트폴리오 데이터 수신 대기';
  element.setAttribute('data-source-kind', current ? 'portfolio-state' : 'unavailable');
  element.setAttribute('data-source-label', current ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  element.setAttribute('data-operational-use', 'reference-only');
  if (state?.updatedAt) element.setAttribute('data-observed-at', state.updatedAt);
  else element.removeAttribute('data-observed-at');
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value) {
  return value == null ? '—' : `$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function renderPortfolioHero(documentRef, state) {
  const valueElement = documentRef?.getElementById('pf-total-value');
  const pnlElement = documentRef?.getElementById('pf-total-pnl');
  if (!valueElement && !pnlElement) return;
  const totals = state?.totals && typeof state.totals === 'object' ? state.totals : {};
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const holdingValue = holdings.reduce((sum, holding) => sum + (finite(holding?.value) ?? 0), 0);
  const cash = finite(state?.cash) ?? 0;
  const totalValue = finite(totals.totalAssets ?? totals.totalValue ?? totals.value) ?? (holdingValue + cash || null);
  const holdingCost = holdings.reduce((sum, holding) => {
    const shares = finite(holding?.shares);
    const avgCost = finite(holding?.avgCost);
    return sum + (shares != null && avgCost != null ? shares * avgCost : 0);
  }, 0);
  const totalPnl = finite(totals.totalPnl ?? totals.pnl ?? totals.profitLoss) ?? (holdingValue - holdingCost || null);
  if (valueElement) {
    valueElement.textContent = formatMoney(totalValue);
    valueElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    valueElement.setAttribute('data-source-kind', totalValue == null ? 'unavailable' : 'portfolio-state');
    valueElement.setAttribute('data-source-label', totalValue == null ? 'portfolio-value-unavailable' : 'native-portfolio-totals');
    valueElement.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlElement) {
    pnlElement.textContent = totalPnl == null ? '—' : `${totalPnl >= 0 ? '+' : '-'}${formatMoney(totalPnl)}`;
    pnlElement.style.color = totalPnl == null ? 'var(--text-dim)' : totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
    pnlElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    pnlElement.setAttribute('data-source-kind', totalPnl == null ? 'unavailable' : 'portfolio-state');
    pnlElement.setAttribute('data-source-label', totalPnl == null ? 'portfolio-pnl-unavailable' : 'native-portfolio-totals');
    pnlElement.setAttribute('data-operational-use', 'reference-only');
  }
}

function render({ documentRef, store }) {
  const state = selectPortfolioState(store.getState());
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureSlice = 'portfolio';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    page.dataset.aioArchitectureRenderer = 'native';
  }
  renderPortfolioHero(documentRef, state);
  renderPortfolioStatus(documentRef, state);
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
      ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
        const element = documentRef?.getElementById(id);
        if (element) element.setAttribute('data-aio-portfolio-hero-renderer', 'native');
      });
      bag.add(() => {
        ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
          const element = documentRef?.getElementById(id);
          if (element?.dataset.aioPortfolioHeroRenderer === 'native') delete element.dataset.aioPortfolioHeroRenderer;
        });
        if (page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
