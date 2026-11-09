// v59.74 (owner 2026-11-07): the 기술적 분석 screen opens on the three market ETFs — QQQ, SPY, IWM — as candle charts
// with the base tier the stock chart carries (5~200 moving averages and their alignment, volume, volume profile, trend
// areas), so the market's state and direction read at a glance. Short chips, no prose; each card opens the full chart.
import { drawChart, ensureChartLibrary, openMarketChart } from './stock-chart.js';
import { attachChartLayers } from './stock-chart-layers.js';
import { buildChartLayers } from '../../domain/technical/chart-layers.js';
import { barsFromYahoo, completedBars } from '../../data/chart-bars.js';
import { chartPalette } from './color-theme.js';
import { el } from './dom.js';

export const MARKET_CANDLES = Object.freeze([['QQQ', '나스닥100'], ['SPY', 'S&P 500'], ['IWM', '러셀2000']]);
const CARD_PRICE_PX = 260;

// The section is built here and placed ahead of the index cards (#charts-indexes), so the shell stays unchanged.
function marketSection(doc, page) {
  let host = doc.getElementById('charts-candle-grid');
  if (host) return host;
  const section = el(doc, 'section', null, 'briefing-block charts-section');
  section.id = 'charts-market-candles';
  section.setAttribute('aria-labelledby', 'charts-candles-title');
  const title = el(doc, 'h2', '시장 지수 일봉', 'briefing-h2');
  title.id = 'charts-candles-title';
  host = el(doc, 'div', null, 'charts-candle-grid');
  host.id = 'charts-candle-grid';
  section.append(title, host);
  const anchor = doc.getElementById('charts-indexes');
  if (anchor) anchor.insertAdjacentElement('beforebegin', section); else page?.append(section);
  return host;
}

export function installMarketCandles({ documentRef: doc, root, page = null, host = null }) {
  host = host || (page ? marketSection(doc, page) : null);
  if (!host) return () => {};
  let alive = true;
  const instances = [];
  host.replaceChildren(...MARKET_CANDLES.map(([sym, name]) => {
    const card = el(doc, 'section', null, 'sx-card charts-candle-card');
    card.dataset.symbol = sym;
    const head = el(doc, 'div', null, 'charts-candle-head');
    head.append(el(doc, 'h3', sym, 'charts-candle-title'), el(doc, 'span', name, 'charts-candle-name'), el(doc, 'span', '', 'charts-candle-close'));
    const chips = el(doc, 'div', null, 'stock-chart-layer-read charts-candle-chips');
    const canvas = el(doc, 'div', null, 'charts-candle-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${sym} 일봉 캔들과 거래량, 이동평균, 매물대, 추세 구간`);
    canvas.style.height = `${CARD_PRICE_PX}px`;
    const open = el(doc, 'button', '전체 차트', 'charts-open');
    open.type = 'button';
    open.addEventListener('click', () => openMarketChart(root, sym));
    card.append(head, chips, canvas, open);
    return card;
  }));
  const load = async ([sym]) => {
    const card = host.querySelector(`[data-symbol="${sym}"]`);
    const canvas = card.querySelector('.charts-candle-canvas');
    const [payload, LWC] = await Promise.all([Promise.resolve().then(() => root._aioFetchYahooChartData?.(sym, '2y', '1d')).catch(() => null), ensureChartLibrary(root)]);
    if (!alive) return;
    const { bars } = completedBars(barsFromYahoo(payload), payload);
    if (!LWC || bars.length < 2) { canvas.replaceChildren(el(doc, 'p', payload == null ? '시세를 받지 못했습니다' : '일봉이 없습니다', 'briefing-empty')); return; }
    const instance = drawChart(root, canvas, { bars }, null, false);
    if (!instance) return;
    instance.chart.applyOptions({ handleScroll: false, handleScale: false, timeScale: { barSpacing: 4, rightOffset: 2 } });
    const range = () => instance.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 180), to: bars.length + 2 });
    range();
    (root.requestAnimationFrame || setTimeout)(range);
    instances.push(instance);
    attachChartLayers({ doc, root, instance, layers: buildChartLayers(bars), compact: true, readHost: card.querySelector('.charts-candle-chips'), pricePx: CARD_PRICE_PX, price: (value) => `$${value.toFixed(2)}` });
    const last = bars.at(-1), prev = bars.at(-2);
    const change = (last.close / prev.close - 1) * 100;
    const close = card.querySelector('.charts-candle-close');
    close.textContent = `${last.time.slice(5).replace('-', '/')} $${last.close.toFixed(2)} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    close.classList.add(change >= 0 ? 'is-up' : 'is-down');
  };
  MARKET_CANDLES.forEach((item) => { load(item).catch(() => {}); });
  const recolor = () => { const next = chartPalette(root); instances.forEach((instance) => instance.applyTheme?.(next)); };
  doc.addEventListener?.('aio:colorThemeChanged', recolor);
  return () => {
    alive = false;
    doc.removeEventListener?.('aio:colorThemeChanged', recolor);
    instances.forEach((instance) => { try { instance.chart.remove(); } catch (_) {} });
  };
}
