import { createResourceBag } from '../../app/lifecycle.js';
import { selectPortfolioState, selectPortfolioHoldings, selectPortfolioTotals } from '../../state/selectors/portfolio.js';

function setText(documentRef, id, value, fallback = '—') {
  const node = documentRef?.getElementById(id);
  if (node) node.textContent = value == null || value === '' ? fallback : String(value);
}

function money(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—';
}

function render({ documentRef, store }) {
  const state = selectPortfolioState(store.getState());
  const holdings = selectPortfolioHoldings(store.getState());
  const totals = selectPortfolioTotals(store.getState()) || {};
  setText(documentRef, 'pf-total-value', money(totals.totalValue));
  setText(documentRef, 'pf-holding-count', `${holdings.length} 종목`);
  setText(documentRef, 'pf-daily-chg', money(totals.dailyChange));
  setText(documentRef, 'pf-daily-pct', totals.dailyPct == null ? '—' : `${totals.dailyPct}%`);
  setText(documentRef, 'pf-total-pnl', money(totals.pnl));
  setText(documentRef, 'pf-total-pnl-pct', totals.pnlPct == null ? '—' : `${totals.pnlPct}%`);
  setText(documentRef, 'pf-cash-hero', money(state?.cash));
  setText(documentRef, 'pf-cash-pct-hero', totals.cashPct == null ? '—' : `${totals.cashPct}%`);
  setText(documentRef, 'pf-exposure-current', `현재 노출 ${totals.exposurePct == null ? '—' : `${totals.exposurePct}%`}`);
  const body = documentRef?.getElementById('pf-positions-tbody');
  if (body) {
    body.replaceChildren();
    if (!holdings.length) {
      const row = documentRef.createElement('tr');
      const cell = documentRef.createElement('td');
      cell.colSpan = 10;
      cell.textContent = state?.privacy === 'consent-required' ? '명시적 동의 후 포트폴리오를 표시합니다.' : '보유 종목 데이터가 없습니다.';
      row.append(cell);
      body.append(row);
    } else {
      holdings.slice(0, 100).forEach((holding) => {
        const row = documentRef.createElement('tr');
        [holding.symbol, holding.shares, holding.price, holding.value, holding.weight].forEach((value) => {
          const cell = documentRef.createElement('td');
          cell.textContent = value == null ? '—' : String(value);
          row.append(cell);
        });
        body.append(row);
      });
    }
  }
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureRenderer = 'native';
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
      return () => bag.dispose();
    }
  };
}
