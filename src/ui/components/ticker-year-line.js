import { loadCompletedDailyBars } from '../../data/daily-chart-bars.js';
import { yearCloseRead } from '../../domain/technical/market-charts.js';
import { signedText } from '../../domain/shared/number.js';
import { shortDate, shortDateAgainst } from '../../domain/content/date-labels.js';
import { createTrendChart } from './trend-chart.js';
import { el } from './dom.js';

const drawn = new WeakMap(); // host → { sym, live, read, money, root, outside }

// The marks are completed closes; the header's live price is not mixed in. When it has gone past either mark, neither is
// named the year's high or low: both read as the close they are.
const outsideOf = (read, live) => Number.isFinite(live) && live > 0 && (live < read.low.value || live > read.high.value);

function paint(doc, host, view) {
  const { root, sym: symbol, read, money } = view;
  view.outside = outsideOf(read, view.live);
  const pct = (value) => signedText(value, 1, '%');
  const mark = (row, word) => `${view.outside ? '종가 기준' : word} ${money(row.value)} (${shortDateAgainst(row.date, read.asOf)})`;
  const chart = createTrendChart(doc, {
    series: read.series, format: money, label: `${symbol} 1년 종가`, height: 140,
    longGuide: { series: read.ma200Series },
    marks: [{ ...read.high, side: 'above', label: mark(read.high, '고점') }, { ...read.low, side: 'below', label: mark(read.low, '저점') }]
  });
  const state = el(doc, 'p', [`${shortDate(read.asOf)} 종가 ${money(read.close)}`, read.fromHigh == null ? null : `고점 대비 ${pct(read.fromHigh)}`,
    read.s200 == null ? null : `200일선(점선) 대비 ${pct(read.s200)}`].filter(Boolean).join(' · '), 'ticker-year-state');
  host.replaceChildren(chart, state);
  const open = () => root?.aioOpenMarketChart?.(symbol);
  host.onclick = open;
  host.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
  host.setAttribute('role', 'button');
  host.tabIndex = 0;
  host.title = `${symbol} 기술적 분석에서 보기`;
  host.setAttribute('aria-label', `${symbol} 1년 종가, ${state.textContent}. 기술적 분석에서 보기`);
  host.hidden = false;
}

/**
 * Draws `symbol`'s year line in `host` once per symbol; a repaint with the same symbol only redraws the mark captions when
 * the live price `live` crosses either mark. Hidden until the bars arrive and without them. `money(value, currency)` writes
 * a price in the listing's currency.
 */
export function renderTickerYearLine(doc, host, { root, symbol, money, live = null }) {
  if (!host) return;
  const sym = String(symbol || '').trim().toUpperCase();
  const held = drawn.get(host);
  if (held?.sym === sym) {
    held.live = live;
    if (held.read && outsideOf(held.read, live) !== held.outside) paint(doc, host, held);
    return;
  }
  const view = { sym, live, read: null, money: null, root, outside: false };
  drawn.set(host, view);
  host.dataset.symbol = sym;
  host.hidden = true;
  host.replaceChildren();
  if (!sym) return;
  // The loader shares one request per symbol with the header's summary (summary-hydration.js).
  loadCompletedDailyBars(root, sym).catch(() => ({ bars: [], payload: null })).then(({ bars, payload }) => {
    if (drawn.get(host) !== view) return;
    const read = yearCloseRead(bars);
    if (!read) return;
    const currency = /\.K[SQ]$/.test(sym) ? 'KRW' : payload?.meta?.currency || null;
    Object.assign(view, { read, money: (value) => money(value, currency) });
    paint(doc, host, view);
  });
}
