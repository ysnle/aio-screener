import { createResourceBag } from '../../app/lifecycle.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';

// RM-01 (2026-07-19): this module used to fully repaint pf-total-value/pf-total-pnl/etc. and
// replaceChildren() the pf-positions-tbody table with a 5-column row, while legacy
// (js/aio-ui.js liveEls + an inline index.html script at :12742/:12928-:12952) kept writing the
// same ids/table with the real column set. That is the highest-severity contested container in
// F-03/route-owners.json: whichever writer runs last wins the race, and native losing means the
// table silently shrinks. P780 transfers only the independently owned pf-analysis-status
// readiness text; table, totals, prices, CRUD, risk, and chart surfaces remain legacy until the
// real ARX/RM-09 storage/vault cutover.
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

function render({ documentRef, store }) {
  const state = selectPortfolioState(store.getState());
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureSlice = 'portfolio';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    page.dataset.aioArchitectureRenderer = 'native';
  }
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
      bag.add(() => {
        if (page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
