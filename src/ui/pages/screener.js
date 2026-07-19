import { createResourceBag } from '../../app/lifecycle.js';
import { selectScreenerState, selectScreenerRows } from '../../state/selectors/screener.js';

function setText(documentRef, id, value, fallback = '—') {
  const node = documentRef?.getElementById(id);
  if (node) node.textContent = value == null || value === '' ? fallback : String(value);
}

function render({ documentRef, store }) {
  const state = selectScreenerState(store.getState());
  const rows = selectScreenerRows(store.getState());
  setText(documentRef, 'screener-result-count', rows.length, '0');
  setText(documentRef, 'scr-kpi-total', rows.length, '0');
  setText(documentRef, 'scr-kpi-top', Math.ceil(rows.length * 0.2), '0');
  setText(documentRef, 'screener-readiness-note', rows.length ? `Canonical screener artifact · ${state?.revision || 'revision 확인 중'}` : '검증된 스크리너 산출물이 없습니다.');
  const body = documentRef?.getElementById('screener-results-body');
  if (body) {
    body.replaceChildren();
    if (!rows.length) {
      const row = documentRef.createElement('tr');
      const cell = documentRef.createElement('td');
      cell.colSpan = 22;
      cell.textContent = '조건에 맞는 검증된 종목이 없습니다.';
      row.append(cell);
      body.append(row);
    } else {
      rows.slice(0, 100).forEach((item, index) => {
        const row = documentRef.createElement('tr');
        [item.rank || index + 1, item.symbol, item.name, item.sector || '—', item.score == null ? '—' : item.score].forEach((value) => {
          const cell = documentRef.createElement('td');
          cell.textContent = String(value);
          row.append(cell);
        });
        body.append(row);
      });
    }
  }
  const page = documentRef?.getElementById('page-screener');
  if (page) {
    page.dataset.aioArchitectureRoute = 'screener';
    page.dataset.aioArchitectureRenderer = 'native';
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
      return () => bag.dispose();
    }
  };
}
