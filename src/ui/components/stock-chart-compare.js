// v58.79 (owner 2026-10-25, chart review): compare the stock with up to three other symbols on the same daily chart —
// same-theme chips (smallest sub-theme first) or any ticker typed in — rebased to the stock's close at the start of the
// last six months, plus a period-return table. The picks stay in memory for this page; nothing is stored.
import { chartPeers, rebasedLine, periodReturns, COMPARE_PERIODS, COMPARE_MAX, COMPARE_WINDOW } from '../../domain/technical/chart-compare.js';
import { normalizeTickerInput } from '../../domain/entity/ticker-symbol.js';
import { barsFromYahoo, completedBars } from './chart-bars.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';

const COLORS = ['#3a7bd5', '#b5487a', '#5a9e6f'];
const PICKS = new Map();
const BARS = new Map();

async function barsFor(root, sym) {
  if (BARS.has(sym)) return BARS.get(sym);
  const payload = await Promise.resolve().then(() => root._aioFetchYahooChartData?.(sym, '2y', '1d')).catch(() => null);
  const { bars } = completedBars(barsFromYahoo(payload), payload);
  const out = bars.length >= 22 ? bars : null;
  if (out) BARS.set(sym, out);
  return out;
}

export function attachChartCompare({ doc, root, sym, instance, analysis }) {
  doc.getElementById('stock-chart-compare')?.remove();
  const anchor = doc.querySelector('.stock-chart-draw-read') || doc.getElementById('stock-chart-draw') || doc.getElementById('stock-chart-intervals');
  if (!instance?.chart || !anchor) return null;
  const { chart } = instance;
  const bars = analysis.bars;
  const picks = PICKS.get(sym) || [];
  PICKS.set(sym, picks);
  const series = new Map();
  const { peers } = chartPeers(root.THEME_MAP, sym);

  const box = el(doc, 'div', null, 'stock-chart-compare');
  box.id = 'stock-chart-compare';
  const row = el(doc, 'div', null, 'sx-seg stock-chart-compare-row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '다른 종목과 비교');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', maxWidth: '100%' });
  row.title = `고른 종목을 최근 ${COMPARE_WINDOW}거래일 창의 첫날 이 종목 종가에 맞춰 같은 출발점에서 그립니다. 선 사이 간격이 그 기간의 상대 수익률입니다. 최대 ${COMPARE_MAX}개`;
  const form = el(doc, 'form', null, 'stock-chart-compare-form');
  Object.assign(form.style, { display: 'inline-flex', gap: '4px', alignItems: 'center' });
  const input = el(doc, 'input');
  input.type = 'text';
  input.placeholder = '비교 티커';
  input.setAttribute('aria-label', '비교할 티커');
  input.autocomplete = 'off';
  Object.assign(input.style, { fontSize: '16px', width: '7.5em', padding: '4px 8px', border: '0.5px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)' });
  const add = el(doc, 'button', '비교');
  add.type = 'submit';
  form.append(input, add);
  const table = el(doc, 'div', null, 'aio-table-scroll stock-chart-compare-table');
  table.style.overflowX = 'auto';
  const status = el(doc, 'p', null, 'stock-chart-draw-read');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  const renderTable = async () => {
    if (!picks.length) { table.replaceChildren(); return; }
    const rows = [[sym, bars, null]];
    for (const pick of picks) rows.push([pick, await barsFor(root, pick), COLORS[picks.indexOf(pick) % COLORS.length]]);
    const tableEl = el(doc, 'table', null, 'aio-table');
    const caption = el(doc, 'caption', '기간 수익률 비교 (완료 일봉 종가 기준)', 'sr-only');
    const head = el(doc, 'tr');
    ['종목', ...COMPARE_PERIODS.map(([label]) => label)].forEach((label) => { const th = el(doc, 'th', label); th.scope = 'col'; head.append(th); });
    const thead = el(doc, 'thead'); thead.append(head);
    const body = el(doc, 'tbody');
    for (const [name, list, color] of rows) {
      const tr = el(doc, 'tr');
      const nameCell = el(doc, 'th', name);
      nameCell.scope = 'row';
      if (color) nameCell.style.borderLeft = `3px solid ${color}`;
      tr.append(nameCell);
      const returns = list ? periodReturns(list) : {};
      for (const [label] of COMPARE_PERIODS) { const td = el(doc, 'td', returns[label] == null ? '—' : signedText(returns[label], 1, '%')); td.style.fontVariantNumeric = 'tabular-nums'; tr.append(td); }
      body.append(tr);
    }
    tableEl.append(caption, thead, body);
    table.replaceChildren(tableEl);
  };
  const draw = (pick, list) => {
    const line = rebasedLine(bars, list);
    if (!line) return false;
    const color = COLORS[picks.indexOf(pick) % COLORS.length];
    const s = chart.addLineSeries({ color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: pick });
    s.setData(line.points);
    series.set(pick, s);
    return true;
  };
  const remove = (pick) => {
    const s = series.get(pick);
    if (s) { try { chart.removeSeries(s); } catch (_) {} series.delete(pick); }
    picks.splice(picks.indexOf(pick), 1);
  };
  const toggle = async (pick) => {
    if (!pick || pick === sym) return;
    if (picks.includes(pick)) { remove(pick); syncChips(); renderTable(); return; }
    if (picks.length >= COMPARE_MAX) remove(picks[0]);
    picks.push(pick);
    syncChips();
    status.hidden = false; status.textContent = `${pick} 일봉을 불러오는 중…`;
    const list = await barsFor(root, pick);
    if (!picks.includes(pick) || !doc.getElementById('stock-chart-compare')) return;
    if (!list || !draw(pick, list)) { picks.splice(picks.indexOf(pick), 1); status.textContent = `${pick}의 일봉을 받지 못해 비교하지 않았습니다`; syncChips(); return; }
    status.hidden = true;
    renderTable();
  };
  const chipButtons = new Map();
  const syncChips = () => {
    for (const [pick, button] of chipButtons) button.setAttribute('aria-pressed', String(picks.includes(pick)));
    const extra = picks.filter((pick) => !chipButtons.has(pick));
    row.querySelectorAll('.is-typed').forEach((node) => node.remove());
    for (const pick of extra) {
      const button = el(doc, 'button', `${pick} 빼기`, 'is-typed');
      button.type = 'button';
      button.setAttribute('aria-pressed', 'true');
      button.addEventListener('click', () => toggle(pick));
      form.insertAdjacentElement('beforebegin', button);
    }
  };
  for (const pick of ['SPY', ...peers].filter((value, index, list) => value !== sym && list.indexOf(value) === index).slice(0, 6)) {
    const button = el(doc, 'button', pick);
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => toggle(pick));
    chipButtons.set(pick, button);
    row.append(button);
  }
  row.append(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const pick = normalizeTickerInput(input.value, { krStockDb: root?.KR_STOCK_DB || {}, krToYahoo: root?.krTickerToYahoo }).toUpperCase();
    input.value = '';
    toggle(pick);
  });
  box.append(row, status, table);
  anchor.insertAdjacentElement('afterend', box);
  // A redraw (same symbol) keeps the picks: draw them again from the cached bars.
  (async () => {
    for (const pick of [...picks]) { const list = await barsFor(root, pick); if (!list || !draw(pick, list)) picks.splice(picks.indexOf(pick), 1); }
    syncChips();
    renderTable();
  })();
  return { peers };
}
