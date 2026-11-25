// 기술적 분석 — a screen of its own, like 매크로. "기술적 분석에서는 시장 지수와
// 대표 종목/대장주들을 분석해서 하나하나 보여줘야" — the screen holds the one chart analysis slot (#stock-chart-section,
// stock-chart.js) that the 종목 screen's 차트 tab used to hold. Three views: 시장 지수 (one card per index) and 대표 종목
// (the largest S&P 500 weights and the day's material movers, with the screener's fields as the raw table under them),
// both the same card part (market-candles.js, each card read from the bars it draws), and 종목 분석, the slot alone
// (2026-11-20: under both card views it made each over 10,000px tall on a phone). The page's search, a card or a row
// opens its symbol there.
import { createResourceBag } from '../../app/lifecycle.js';
import { refreshSharedArtifact, screenerRowsState } from '../../data/shared-artifacts.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { chartsConclusion, chartsHeaderBasis, coreStockRows, indexChartReadings, stockGroupLabels, stockTableSessionBehind } from '../../domain/technical/market-charts.js';
import { sessionChipText } from '../components/session-lag.js';
import { signedText } from '../../domain/shared/number.js';
import { installStockChart, showChartSubject } from '../components/stock-chart.js';
import { createChartCards } from '../components/market-candles.js';
import { el } from '../components/dom.js';
import { renderIndexStandings, renderReboundTrack } from '../components/market-story.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { historyWaitText, renderDataState } from '../components/data-state.js';
import { MARKET_DAY } from '../../data/artifact-registry.js';
import { renderScreenReading } from '../components/screen-reading.js';
import { renderStoryTie } from '../components/story-tie.js';

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
function stockTable(doc, rows, asOf, open, current, GROUPS) {
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
  // A group row names each part (S&P 500 비중 상위, 11/20 크게 움직인 종목) where the table note used to.
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
// The view that holds the analysis slot (page-views.css); stock-chart.js opens it by the slot itself (showViewOf).
const SLOT_VIEW = 'analysis';

function renderBasis(documentRef, root, asOf) {
  const node = documentRef.getElementById('charts-basis');
  if (node) node.textContent = asOf ? `${shortDate(asOf)} 종가 · 일봉` : historyWaitText(root);
}

function render(documentRef, root, store, page, cards, stockCards, basis) {
  const history = root?._aioHistory || [];
  const readings = indexChartReadings(history);
  const set = (id, text) => { const node = documentRef.getElementById(id); if (node) node.textContent = text; };
  const grid = documentRef.getElementById('charts-index-grid');
  if (grid && !readings.length && root?.__aioHistoryLoadState === 'failed') {
    grid.dataset.state = 'failed';
    set('charts-conclusion', historyWaitText(root));
  } else if (grid) delete grid.dataset.state;
  // The index grid dates itself (basisOf) and reports the date to the header before the stock parts read it.
  cards.update(history);
  // Under the index cards, the rebound since its low (hidden without one), then this fall among each index's past falls
  // (the long-run tables; hidden without them).
  if (grid) {
    let standings = documentRef.getElementById('charts-fall-standings');
    if (!standings) { standings = el(documentRef, 'div', null, 'charts-standings'); standings.id = 'charts-fall-standings'; standings.hidden = true; grid.after(standings); }
    let track = documentRef.getElementById('charts-rebound-track');
    if (!track) { track = el(documentRef, 'div', null, 'charts-rebound'); track.id = 'charts-rebound-track'; track.hidden = true; grid.after(track); }
    renderReboundTrack({ documentRef, root, host: track });
    renderIndexStandings({ documentRef, root, host: standings });
  }
  const asOf = basis();
  const day = root?.[MARKET_DAY.key] || null;
  const rows = coreStockRows({ ...screenerOf(root, store), day });
  const labels = stockGroupLabels(day);
  for (const group of STOCK_GROUPS) {
    const list = rows.filter((row) => row.group === group);
    stockCards[group].setSpecs(list.map((row) => ({ key: row.sym, label: row.name, symbol: row.sym })));
    stockCards[group].update(history, asOf);
    const box = documentRef.getElementById(`charts-stock-${group}`);
    if (box) box.hidden = !list.length && (group === 'mover' || rows.length > 0);
    const title = box?.querySelector?.('.charts-group-title');
    if (title) title.textContent = labels[group];
  }
  const host = documentRef.getElementById('charts-stock-table');
  const raw = documentRef.getElementById('charts-stock-raw');
  if (raw) raw.hidden = !rows.length;
  if (host && rows.length) {
    const open = (sym) => showChartSubject({ documentRef, root, symbol: sym, byReader: true, scroll: true });
    host.replaceChildren(stockTable(documentRef, rows, asOf, open, root?._aioChartSubject || '', labels));
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
      // The header, the conclusion and the stock parts follow the index cards' own close date; a card's bars arriving on
      // another session re-renders the stock parts once (the nested report inside a render only records the date).
      // `ready`: the grid reports once while it is built, before the render below exists.
      let basis = null, rendering = false, ready = false;
      const onIndexReadings = (list, asOf) => {
        const node = documentRef.getElementById('charts-conclusion');
        if (node) node.textContent = chartsConclusion(list);
        renderStoryTie({ documentRef, root, screen: 'charts', context: { readings: list } });
        renderScreenReading({ documentRef, root, screen: 'charts', shownBasis: asOf || null }); // the AI reading on the cards' close
        renderBasis(documentRef, root, asOf);
        if (asOf === basis) return;
        basis = asOf;
        if (ready && !rendering) renderNow();
      };
      const cards = createChartCards({ documentRef, root, host: documentRef.getElementById('charts-index-grid'), onOpen: open, onReadings: onIndexReadings,
        basisOf: (list) => chartsHeaderBasis(list, root?._aioHistory) });
      bag.add(() => cards.dispose());
      // 대표 종목: the same card part, one grid per group; its bars load once its view is shown (a hidden view's never do).
      const stockCards = Object.fromEntries(STOCK_GROUPS.map((group) => [group, createChartCards({ documentRef, root, host: documentRef.getElementById(`charts-${group}-grid`), specs: [], lazy: true, onOpen: open })]));
      bag.add(() => Object.values(stockCards).forEach((grid) => grid.dispose()));
      const renderNow = () => {
        if (!alive || rendering) return;
        rendering = true;
        try { render(documentRef, root, store, page, cards, stockCards, () => basis); } finally { rendering = false; }
      };
      ready = true;
      renderNow();
      // The analysis slot (종목 분석 view): a request another screen handed over (openMarketChart, an old #technical link)
      // opens it at once and shows that view; otherwise it draws when its view is first shown — the symbol it showed last,
      // else SPY — so the other views load no analysis chart.
      const installSlot = () => installStockChart({ documentRef, root });
      const onRequest = () => { const sym = String(root._aioChartRequest || '').trim(); if (sym) { root._aioChartRequest = null; open(sym); } };
      // A request set while this screen is already open (an old caller's `_aioChartRequest = X; showPage('technical')`
      // lands here without a remount) is read when the screen is shown again.
      const onShown = (event) => { if (event?.detail === route) onRequest(); };
      const onView = (event) => { if (event?.detail?.page === page.id && event.detail.view === SLOT_VIEW) installSlot(); };
      for (const [eventName, handler] of [['aio:chartRequested', onRequest], ['aio:pageShown', onShown], ['aio:pageViewChanged', onView]]) {
        documentRef.addEventListener?.(eventName, handler);
        bag.add(() => documentRef.removeEventListener?.(eventName, handler));
      }
      if (root._aioChartRequest || page.dataset.view === SLOT_VIEW) installSlot();
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
