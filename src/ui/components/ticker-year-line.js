// 종목 머리 (2026-11-20): a year of daily closes under the name and price — the line with its 200-day line, the year's
// highest and lowest close, and one state line (the last close, 고점 대비, 200일선 대비). The bars are the ones 기술적 분석
// reads (daily-chart-bars.js: the same transport and completed-session rule) and the numbers come from market-charts.js
// yearCloseRead, the close basis of its cards. No bars, nothing drawn. Chart analysis lives on 기술적 분석 (owner
// 2026-11-19), so the line is a way there: it opens the symbol in that screen's 종목 분석 view.
import { loadCompletedDailyBars } from '../../data/daily-chart-bars.js';
import { yearCloseRead } from '../../domain/technical/market-charts.js';
import { signedText } from '../../domain/shared/number.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { createTrendChart } from './trend-chart.js';
import { el } from './dom.js';

const FRESH_MS = 10 * 60 * 1000;
const loads = new Map(); // symbol → { at, promise }: one request per symbol while it is fresh

function barsOf(root, symbol) {
  const held = loads.get(symbol);
  if (held && Date.now() - held.at < FRESH_MS) return held.promise;
  const promise = loadCompletedDailyBars(root, symbol).catch(() => ({ bars: [], payload: null }))
    .then((result) => { if (!result.bars?.length) loads.delete(symbol); return result; }); // a miss is asked again next visit
  loads.set(symbol, { at: Date.now(), promise });
  return promise;
}

function paint(doc, host, { root, symbol, read, money }) {
  const pct = (value) => signedText(value, 1, '%');
  const chart = createTrendChart(doc, {
    series: read.series, format: money, label: `${symbol} 1년 종가`, height: 140,
    longGuide: { series: read.ma200Series },
    marks: [{ ...read.high, side: 'above', label: `고점 ${money(read.high.value)} (${shortDate(read.high.date)})` },
      { ...read.low, side: 'below', label: `저점 ${money(read.low.value)} (${shortDate(read.low.date)})` }]
  });
  const state = el(doc, 'p', [`${shortDate(read.asOf)} 종가 ${money(read.close)}`, `고점 대비 ${pct(read.fromHigh)}`,
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
 * Draws `symbol`'s year line in `host` once per symbol (a repaint with the same symbol does nothing); hides it until the
 * bars arrive and keeps it hidden without them. `money(value, currency)` writes a price in the listing's currency.
 */
export function renderTickerYearLine(doc, host, { root, symbol, money }) {
  if (!host) return;
  const sym = String(symbol || '').trim().toUpperCase();
  if (host.dataset.symbol === sym) return;
  host.dataset.symbol = sym;
  host.hidden = true;
  host.replaceChildren();
  if (!sym) return;
  barsOf(root, sym).then(({ bars, payload }) => {
    if (host.dataset.symbol !== sym) return;
    const read = yearCloseRead(bars);
    if (!read) return;
    const currency = /\.K[SQ]$/.test(sym) ? 'KRW' : payload?.meta?.currency || null;
    paint(doc, host, { root, symbol: sym, read, money: (value) => money(value, currency) });
  });
}
