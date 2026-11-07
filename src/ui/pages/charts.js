// v59.64 (owner 2026-11-03): 기술적 분석 — a screen of its own, like 매크로. Each index card shows where the close sits
// against its 50/200-day lines, the nearest swing levels and a pattern if one is live (src/domain/technical/market-charts.js);
// the table below reads the largest S&P 500 weights and the day's material movers from the screener's own fields.
// Breadth joins only the S&P 500 reading, where it changes what the chart says.
import { createResourceBag } from '../../app/lifecycle.js';
import { MARKET_DAY, refreshSharedArtifact, screenerRowsState } from '../../data/shared-artifacts.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { chartsConclusion, coreStockRows, indexChartReadings } from '../../domain/technical/market-charts.js';
import { signedText } from '../../domain/shared/number.js';
import { createTrendChart } from '../components/trend-chart.js';
import { noteFold } from '../components/section-frame.js';
import { openMarketChart } from '../components/stock-chart.js';
import { el } from '../components/dom.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { historyWaitText, renderDataState } from '../components/data-state.js';

// The ETF the 종목 차트 tab can open for each index; the Korean indexes have no tradable twin there.
const CHART_SYMBOL = Object.freeze({ ndx: 'QQQ', spx: 'SPY', soxx: 'SOXX', rut: 'IWM' });

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

// v59.70 (lens plan step 4): a card whose last close is older than the page basis (코스피 before the US close) says its own date.
function indexCard(doc, root, reading, latest) {
  const box = el(doc, 'section', null, 'trend-card charts-card');
  box.dataset.index = reading.field;
  box.dataset.trend = reading.trend;
  const head = el(doc, 'div', null, 'trend-card-head');
  head.append(el(doc, 'h3', reading.label, 'trend-card-title'), el(doc, 'span', reading.trendWord, `charts-trend is-${reading.trend}`));
  if (reading.asOf && latest && reading.asOf !== latest) head.append(el(doc, 'span', `${shortDate(reading.asOf)} 종가`, 'charts-asof'));
  box.append(head, el(doc, 'p', reading.conclusion, 'charts-card-conclusion'));
  if (reading.volume?.text) box.append(el(doc, 'p', reading.volume.text, 'charts-card-volume'));
  // One level line, the one to hold: the nearest support (or the double-top neck when there is none). A second line closer
  // than a label's height moves its label to the right edge, onto the 50-day line's end tag (trend-chart.js LABEL_GAP);
  // resistance and the neck stay in the 근거와 수치 fold.
  const refs = [reading.support?.value ?? reading.doubleTop?.neck?.value].filter(Number.isFinite);
  // v59.70 (screen review #14): index levels in thousands ('27,192', not '27192'); the level line says it is the support
  // (or the double top's neck), not another tick.
  const whole = (value) => Math.round(value).toLocaleString('en-US');
  const levelName = Number.isFinite(reading.support?.value) ? '지지' : '목선';
  box.append(createTrendChart(doc, { series: reading.series, refLines: refs, format: whole, refLabel: (value) => `${levelName} ${whole(value)}`, label: `${reading.label} 종가`, guide: { series: reading.ma50Series, label: '50일선' } }));
  const fold = noteFold(doc, reading.read, '근거와 수치');
  if (fold) {
    const list = el(doc, 'dl', null, 'charts-numbers');
    for (const [name, value] of reading.numbers) list.append(el(doc, 'dt', name), el(doc, 'dd', value));
    fold.append(list);
    box.append(fold);
  }
  const symbol = CHART_SYMBOL[reading.field];
  if (symbol) {
    const button = el(doc, 'button', `${symbol} 차트 열기`, 'charts-open');
    button.type = 'button';
    button.addEventListener('click', () => openMarketChart(root, symbol));
    box.append(button);
  }
  return box;
}

function stockTable(doc, root, rows) {
  const table = el(doc, 'table', null, 'charts-table');
  const head = el(doc, 'tr');
  for (const name of ['종목', '추세', '1일', '50일선', '200일선', '고점 대비', 'RSI']) head.append(el(doc, 'th', name));
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
      cell.colSpan = 7;
      cell.scope = 'colgroup';
      label.append(cell);
      table.tBodies[0].append(label);
    }
    const line = el(doc, 'tr');
    line.dataset.group = pick.group;
    const nameCell = el(doc, 'td');
    const button = el(doc, 'button', pick.sym, 'charts-stock');
    button.type = 'button';
    button.title = `${pick.name} 차트 열기`;
    button.addEventListener('click', () => openMarketChart(root, pick.sym));
    nameCell.append(button, el(doc, 'span', pick.name === pick.sym ? '' : pick.name, 'charts-stock-name'));
    line.append(nameCell, el(doc, 'td', pick.trendWord, `charts-trend is-${pick.trend}`), el(doc, 'td', pct(pick.ret1d)), el(doc, 'td', pct(pick.vs50)), el(doc, 'td', pct(pick.vs200)),
      el(doc, 'td', pct(pick.fromHigh)), el(doc, 'td', Number.isFinite(pick.rsi) ? pick.rsi.toFixed(0) : '—'));
    table.tBodies[0].append(line);
  }
  return table;
}

function render(documentRef, root, store, page) {
  const history = root?._aioHistory || [];
  const readings = indexChartReadings(history);
  const set = (id, text) => { const node = documentRef.getElementById(id); if (node) node.textContent = text; };
  const asOf = readings.map((reading) => reading.asOf).sort().at(-1);
  set('charts-basis', readings.length ? `${shortDate(asOf)} 종가 · 일봉` : historyWaitText(root));
  set('charts-conclusion', chartsConclusion(readings));
  const grid = documentRef.getElementById('charts-index-grid');
  if (grid) {
    const opened = new Set([...grid.querySelectorAll('[data-index] details[open]')].map((node) => node.closest('[data-index]').dataset.index));
    // v59.70 (ui-states): an empty grid drew nothing at all; it now shows the shared loading or failed state.
    if (!readings.length) renderDataState(grid, root?.__aioHistoryLoadState === 'failed'
      ? { state: 'error', text: historyWaitText(root), onRetry: () => root?._aioLoadHistory?.() } : { state: 'loading', lines: 4 });
    else grid.replaceChildren(...readings.map((reading) => indexCard(documentRef, root, reading, asOf)));
    grid.querySelectorAll('[data-index]').forEach((card) => { if (opened.has(card.dataset.index)) card.querySelector('details')?.setAttribute('open', ''); });
  }
  const host = documentRef.getElementById('charts-stock-table');
  if (host) {
    const rows = coreStockRows({ ...screenerOf(root, store), day: root?.[MARKET_DAY.key] || null });
    if (rows.length) host.replaceChildren(stockTable(documentRef, root, rows));
    else renderDataState(host, screenerRowsState(root) === 'failed' ? { state: 'error', text: '종목 지표를 받지 못했습니다' } : { state: 'loading', lines: 5 });
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
      const renderNow = () => { if (alive) render(documentRef, root, store, page); };
      renderNow();
      refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderNow(); }).catch(() => {});
      const unsubscribe = store && subscribeToSlices(store, ['screener'], renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      // history.json announces itself on window (js/aio-data.js); the server cut on document.
      for (const [target, eventName] of [[root, 'aio:historyLoaded'], [documentRef, 'aio:serverDataLoaded'], [documentRef, 'aio:refresh:done']]) {
        target?.addEventListener?.(eventName, renderNow);
        bag.add(() => target?.removeEventListener?.(eventName, renderNow));
      }
      bag.add(() => {
        delete page.dataset.aioArchitectureRoute;
        delete page.dataset.aioArchitectureRenderer;
      });
      return () => bag.dispose();
    }
  };
}
