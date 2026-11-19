// v59.64 (owner 2026-11-03): 기술적 분석 — a screen of its own, like 매크로. Owner 2026-11-19: "기술적 분석에서는 시장 지수와
// 대표 종목/대장주들을 분석해서 하나하나 보여줘야" — the screen holds the one chart analysis slot (#stock-chart-section,
// stock-chart.js) that the 종목 screen's 차트 tab used to hold. Two views of the same card part (market-candles.js, each card
// read from the bars it draws): 시장 지수 (one card per index) and 대표 종목 (the largest S&P 500 weights and the day's
// material movers, with the screener's fields as the raw table under them); the page's search or a card opens its symbol
// in the slot.
import { createResourceBag } from '../../app/lifecycle.js';
import { refreshSharedArtifact, screenerRowsState } from '../../data/shared-artifacts.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { chartsConclusion, chartsPageBasis, coreStockRows, indexChartReadings, stockTableSessionBehind } from '../../domain/technical/market-charts.js';
import { sessionChipText } from '../components/session-lag.js';
import { signedText } from '../../domain/shared/number.js';
import { installStockChart, showChartSubject } from '../components/stock-chart.js';
import { createChartCards } from '../components/market-candles.js';
import { el } from '../components/dom.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { historyWaitText, renderDataState } from '../components/data-state.js';
import { MARKET_DAY } from '../../data/artifact-registry.js';

// The screener carries the S&P 500 weights column-encoded ({columns, rows}); the published file carries objects.
function weightRows(meta) {
  if (Array.isArray(meta)) return meta;
  if (!Array.isArray(meta?.rows) || !Array.isArray(meta?.columns)) return [];
  return meta.rows.map((row) => (Array.isArray(row) ? Object.fromEntries(meta.columns.map((column, index) => [column, row[index]])) : row));
}

function screenerOf(root, store) {
  const state = store?.getState?.() || {};
  let rows = state.screener?.rows;
  if (!Array.isArray(rows) || !rows.length) { try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; } }
  return { screener: { data: Object.fromEntries(rows.filter((row) => row?.sym).map((row) => [row.sym, row])) }, universe: rows, indexWeights: weightRows(state.screener?.metadata?.indexWeights) };
}

// The screener's own fields for the same stocks, the raw table under the cards. The trend word is the card's (read from
// the bars it draws), so the table carries numbers only.
function stockTable(doc, rows, asOf, open, current) {
  const table = el(doc, 'table', null, 'charts-table');
  // rows from an earlier session than the header's index close say their own session, with the
  // same words as 테마와 섹터 ("11/16 종가 기준, 11/17 반영 전").
  const behind = stockTableSessionBehind(rows, asOf);
  if (behind) table.append(el(doc, 'caption', sessionChipText(behind, String(asOf).slice(0, 10)), 'charts-table__session'));
  const head = el(doc, 'tr');
  for (const name of ['종목', '1일', '50일선', '200일선', '고점 대비', 'RSI']) head.append(el(doc, 'th', name));
  table.append(el(doc, 'thead'), el(doc, 'tbody'));
  table.tHead.append(head);
  const pct = (value) => (Number.isFinite(value) ? `${signedText(value, 1)}%` : '—');
  // v59.68: a group row names each part (S&P 500 비중 상위, 오늘 크게 움직인 종목) where the table note used to.
  const GROUPS = { weight: 'S&P 500 비중 상위', mover: '오늘 크게 움직인 종목' };
  let group = null;
  for (const pick of rows) {
    if (pick.group !== group) {
      group = pick.group;
      const label = el(doc, 'tr', null, 'charts-group');
      const cell = el(doc, 'th', GROUPS[group] || '', 'charts-group__label');
      cell.colSpan = 6;
      cell.scope = 'colgroup';
      label.append(cell);
      table.tBodies[0].append(label);
    }
    const line = el(doc, 'tr', null, 'charts-stock-row');
    line.dataset.group = pick.group;
    line.dataset.symbol = pick.sym;
    if (pick.sym === current) line.setAttribute('aria-current', 'true');
    const nameCell = el(doc, 'td');
    const button = el(doc, 'button', pick.sym, 'charts-stock');
    button.type = 'button';
    button.title = `${pick.name} 차트 분석 열기`;
    button.addEventListener('click', (event) => { event.stopPropagation(); open(pick.sym); });
    nameCell.append(button, el(doc, 'span', pick.name === pick.sym ? '' : pick.name, 'charts-stock-name'));
    // The whole row opens the slot; the symbol button stays the keyboard and screen-reader control.
    line.addEventListener('click', () => open(pick.sym));
    line.append(nameCell, el(doc, 'td', pct(pick.ret1d)), el(doc, 'td', pct(pick.vs50)), el(doc, 'td', pct(pick.vs200)),
      el(doc, 'td', pct(pick.fromHigh)), el(doc, 'td', Number.isFinite(pick.rsi) ? pick.rsi.toFixed(0) : '—'));
    table.tBodies[0].append(line);
  }
  return table;
}

const STOCK_GROUPS = Object.freeze(['weight', 'mover']);

function render(documentRef, root, store, page, cards, stockCards) {
  const history = root?._aioHistory || [];
  const readings = indexChartReadings(history);
  const set = (id, text) => { const node = documentRef.getElementById(id); if (node) node.textContent = text; };
  const asOf = chartsPageBasis(readings);
  set('charts-basis', readings.length ? `${shortDate(asOf)} 종가 · 일봉` : historyWaitText(root));
  const grid = documentRef.getElementById('charts-index-grid');
  if (grid && !readings.length && root?.__aioHistoryLoadState === 'failed') {
    grid.dataset.state = 'failed';
    set('charts-conclusion', historyWaitText(root));
  } else if (grid) delete grid.dataset.state;
  cards.update(history, asOf);
  const rows = coreStockRows({ ...screenerOf(root, store), day: root?.[MARKET_DAY.key] || null });
  for (const group of STOCK_GROUPS) {
    const list = rows.filter((row) => row.group === group);
    stockCards[group].setSpecs(list.map((row) => ({ key: row.sym, label: row.name, symbol: row.sym })));
    stockCards[group].update(history, asOf);
    const box = documentRef.getElementById(`charts-stock-${group}`);
    if (box) box.hidden = !list.length && (group === 'mover' || rows.length > 0);
  }
  const host = documentRef.getElementById('charts-stock-table');
  const raw = documentRef.getElementById('charts-stock-raw');
  if (raw) raw.hidden = !rows.length;
  if (host && rows.length) {
    const open = (sym) => showChartSubject({ documentRef, root, symbol: sym, byReader: true, scroll: true });
    host.replaceChildren(stockTable(documentRef, rows, asOf, open, root?._aioChartSubject || ''));
  } else {
    const grid = documentRef.getElementById('charts-weight-grid');
    if (grid) renderDataState(grid, screenerRowsState(root) === 'failed' ? { state: 'error', text: '종목 지표를 받지 못했습니다' } : { state: 'loading', lines: 5 });
  }
  page.dataset.aioChartsRendered = String(readings.length);
}

export function createChartsPage({ root = globalThis, documentRef, store, route = 'charts' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureRenderer = 'native';
      let alive = true;
      bag.add(() => { alive = false; });
      const open = (sym) => showChartSubject({ documentRef, root, symbol: sym, byReader: true, scroll: true });
      const conclusion = (list) => { const node = documentRef.getElementById('charts-conclusion'); if (node) node.textContent = chartsConclusion(list); };
      const cards = createChartCards({ documentRef, root, host: documentRef.getElementById('charts-index-grid'), onOpen: open, onReadings: conclusion });
      bag.add(() => cards.dispose());
      // 대표 종목: the same card part, one grid per group; a card's bars load once it comes into view (a hidden view's never do).
      const stockCards = Object.fromEntries(STOCK_GROUPS.map((group) => [group, createChartCards({ documentRef, root, host: documentRef.getElementById(`charts-${group}-grid`), specs: [], lazy: true, onOpen: open })]));
      bag.add(() => Object.values(stockCards).forEach((grid) => grid.dispose()));
      const renderNow = () => { if (alive) render(documentRef, root, store, page, cards, stockCards); };
      renderNow();
      // The analysis slot: the request another screen handed over (openMarketChart, an old #technical link), else the
      // symbol it showed last, else SPY.
      installStockChart({ documentRef, root });
      const onRequest = () => { const sym = String(root._aioChartRequest || '').trim(); if (sym) { root._aioChartRequest = null; open(sym); } };
      // A request set while this screen is already open (an old caller's `_aioChartRequest = X; showPage('technical')`
      // lands here without a remount) is read when the screen is shown again.
      const onShown = (event) => { if (event?.detail === route) onRequest(); };
      for (const eventName of ['aio:chartRequested', 'aio:pageShown']) {
        const handler = eventName === 'aio:pageShown' ? onShown : onRequest;
        documentRef.addEventListener?.(eventName, handler);
        bag.add(() => documentRef.removeEventListener?.(eventName, handler));
      }
      const markRow = (event) => {
        const sym = event?.detail?.symbol || '';
        documentRef.querySelectorAll?.('#charts-stock-table tr[data-symbol]').forEach((row) => { if (row.dataset.symbol === sym) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current'); });
      };
      documentRef.addEventListener?.('aio:chartSubjectChanged', markRow);
      bag.add(() => documentRef.removeEventListener?.('aio:chartSubjectChanged', markRow));
      refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderNow(); }).catch(() => {});
      const unsubscribe = store && subscribeToSlices(store, ['screener'], renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      // history.json announces itself on window (js/aio-data.js); the server cut on document.
      for (const [target, eventName] of [[root, 'aio:historyLoaded'], [documentRef, 'aio:serverDataLoaded'], [documentRef, 'aio:refresh:done']]) {
        target?.addEventListener?.(eventName, renderNow);
        bag.add(() => target?.removeEventListener?.(eventName, renderNow));
      }
      // The refresh scheduler announces on window; the document registration above stays.
      if (typeof root?.addEventListener === 'function' && root !== documentRef) {
        root.addEventListener('aio:refresh:done', renderNow);
        bag.add(() => root.removeEventListener?.('aio:refresh:done', renderNow));
      }
      bag.add(() => {
        delete page.dataset.aioArchitectureRoute;
        delete page.dataset.aioArchitectureRenderer;
      });
      return () => bag.dispose();
    }
  };
}
