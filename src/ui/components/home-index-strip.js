// Owner 2026-10-25: 오늘 opens with how the four US index ETFs moved through the last New York regular session, before
// any reading — S&P 500 (SPY), Nasdaq 100 (QQQ), semiconductors (SOXX), Russell 2000 (IWM). Each card is the session's
// 5-minute candles against the previous close, with the change from that close. The bars are fetched on the client
// through the app's Yahoo chart path (window._fetchYahooChartData), so nothing here is a producer artifact; while the
// session is open the strip re-reads every five minutes. A card opens that ETF on the 차트 screen.
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { signedText } from '../../domain/shared/number.js';

export const INDEX_STRIP = Object.freeze([
  Object.freeze({ sym: 'SPY', label: 'S&P 500' }),
  Object.freeze({ sym: 'QQQ', label: '나스닥 100' }),
  Object.freeze({ sym: 'SOXX', label: '반도체' }),
  Object.freeze({ sym: 'IWM', label: '러셀 2000' })
]);
const REFRESH_MS = 5 * 60 * 1000;
const W = 300;
const H = 120;
const SVG_NS = 'http://www.w3.org/2000/svg';

const nyParts = (seconds) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(new Date(seconds * 1000));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return { month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), minute: Number(get('minute')), weekday: get('weekday') };
};
const WEEKDAY_KO = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };
const price = (value) => (Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');

/** One session of 5-minute bars → candles, the previous close, the change and whether the session is still open. */
export function sessionModel(payload, nowSeconds = Date.now() / 1000) {
  if (!payload || !Array.isArray(payload.timestamps) || !payload.timestamps.length) return null;
  const bars = [];
  payload.timestamps.forEach((t, i) => {
    const o = payload.opens?.[i]; const h = payload.highs?.[i]; const l = payload.lows?.[i]; const c = payload.closes?.[i];
    if ([o, h, l, c].every(Number.isFinite)) bars.push({ t, o, h, l, c });
  });
  if (!bars.length) return null;
  const meta = payload.meta || {};
  const previousClose = Number.isFinite(meta.chartPreviousClose) ? meta.chartPreviousClose : Number.isFinite(meta.previousClose) ? meta.previousClose : null;
  const last = bars[bars.length - 1].c;
  const regular = meta.currentTradingPeriod?.regular;
  const open = !!(regular && Number.isFinite(regular.start) && Number.isFinite(regular.end) && nowSeconds >= regular.start && nowSeconds < regular.end
    && bars[bars.length - 1].t >= regular.start);
  const lows = bars.map((bar) => bar.l); const highs = bars.map((bar) => bar.h);
  const min = Math.min(...lows, previousClose ?? Infinity); const max = Math.max(...highs, previousClose ?? -Infinity);
  return {
    bars, previousClose, last, open, min, max,
    change: previousClose ? last - previousClose : null,
    changePct: previousClose ? (last / previousClose - 1) * 100 : null,
    session: nyParts(bars[0].t)
  };
}

function svgNode(doc, name, attrs) {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

// Vertical position of a price in the 120-unit chart box (4 units of padding top and bottom).
const yOf = (model, value) => 4 + (1 - (value - model.min) / (model.max - model.min || 1)) * (H - 8);

// 78 five-minute slots make a full 9:30–16:00 session; an open session leaves the rest of the axis empty.
function chartSvg(doc, model) {
  const svg = svgNode(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'home-index-chart', 'aria-hidden': 'true', focusable: 'false' });
  const slots = Math.max(78, model.bars.length);
  const step = W / slots;
  const y = (value) => yOf(model, value);
  if (model.previousClose != null) {
    svg.append(svgNode(doc, 'line', { x1: 0, x2: W, y1: y(model.previousClose), y2: y(model.previousClose), class: 'home-index-prev', 'vector-effect': 'non-scaling-stroke' }));
  }
  model.bars.forEach((bar, i) => {
    const x = i * step + step / 2;
    const up = bar.c >= bar.o;
    const cls = up ? 'is-up' : 'is-down';
    svg.append(svgNode(doc, 'line', { x1: x, x2: x, y1: y(bar.h), y2: y(bar.l), class: `home-index-wick ${cls}`, 'vector-effect': 'non-scaling-stroke' }));
    const top = y(Math.max(bar.o, bar.c));
    svg.append(svgNode(doc, 'rect', { x: x - step * 0.35, y: top, width: step * 0.7, height: Math.max(0.8, y(Math.min(bar.o, bar.c)) - top), class: `home-index-body ${cls}` }));
  });
  return svg;
}

function card(doc, root, spec, model, failed) {
  const node = el(doc, 'button', null, 'home-index-card');
  node.type = 'button';
  node.dataset.sym = spec.sym;
  node.addEventListener('click', () => root.aioOpenMarketChart?.(spec.sym));
  const head = el(doc, 'div', null, 'home-index-head');
  const name = el(doc, 'span', null, 'home-index-name');
  name.append(el(doc, 'strong', spec.label), el(doc, 'span', spec.sym, 'home-index-sym'));
  head.append(name);
  if (!model) {
    head.append(el(doc, 'span', failed ? '분봉 수신 실패' : '불러오는 중', 'home-index-change'));
    node.append(head, el(doc, 'div', null, 'home-index-plot is-empty'));
    node.setAttribute('aria-label', `${spec.label} ${spec.sym}, ${failed ? '분봉을 받지 못했습니다' : '불러오는 중'}. 누르면 차트 화면으로 이동`);
    return node;
  }
  const direction = model.change == null ? '' : model.change >= 0 ? 'is-up' : 'is-down';
  const changeText = model.change == null ? '전일 종가 없음' : `${signedText(model.change, 2)} (${signedText(model.changePct, 2, '%')})`;
  head.append(el(doc, 'span', changeText, `home-index-change ${direction}`));
  const plot = el(doc, 'div', null, 'home-index-plot');
  const axis = el(doc, 'div', null, 'home-index-axis');
  axis.append(el(doc, 'span', price(model.max)), el(doc, 'span', price(model.last), `home-index-last ${direction}`), el(doc, 'span', price(model.min)));
  // v58.79 (layout over captions): the dashed line names itself ("전일") at its left end instead of a caption line.
  const canvas = el(doc, 'div', null, 'home-index-canvas');
  canvas.append(chartSvg(doc, model));
  if (model.previousClose != null) {
    const tag = el(doc, 'span', '전일', 'home-index-prev-tag');
    tag.style.top = `${((yOf(model, model.previousClose) / H) * 100).toFixed(1)}%`;
    tag.setAttribute('aria-hidden', 'true');
    canvas.append(tag);
  }
  plot.append(canvas, axis);
  // Hour marks at their place in the 9:30–16:00 session (390 minutes), on the same slot scale as the candles.
  const times = el(doc, 'div', null, 'home-index-times');
  const slots = Math.max(78, model.bars.length);
  for (const [label, minutes] of [['10시', 30], ['12시', 150], ['14시', 270], ['16시', 390]]) {
    const mark = el(doc, 'span', label);
    mark.style.left = `${Math.min(100, (minutes / 5 / slots) * 100).toFixed(2)}%`;
    times.append(mark);
  }
  node.append(head, plot, times);
  node.setAttribute('aria-label', `${spec.label} ${spec.sym}, ${model.session.month}/${model.session.day} ${model.open ? '진행 중' : '종가'} ${price(model.last)}, 전일 종가 대비 ${changeText}. 누르면 차트 화면으로 이동`);
  return node;
}

/** Fetches the four sessions and draws the strip; returns the models (null where a fetch failed). */
export async function renderHomeIndexStrip({ documentRef: doc, root }) {
  const host = doc?.getElementById('home-index-strip');
  const fetchBars = root?._fetchYahooChartData;
  if (!host) return null;
  // The chart path is a legacy script that can finish loading after the first 오늘 render; wait for it, bounded.
  if (typeof fetchBars !== 'function') {
    const tries = (host._aioIndexWaits || 0) + 1;
    host._aioIndexWaits = tries;
    if (tries <= 20) setTimeout(() => renderHomeIndexStrip({ documentRef: doc, root }), 500);
    return null;
  }
  if (host._aioIndexPending) return host._aioIndexPending;
  // v58.79 section frame: the cards name themselves, so the head is a screen-reader title and one as-of chip; the
  // method (5-minute bars, the dashed previous close, delayed quotes) is the chip's hover.
  const head = (asOf, detail = '') => frameHead(doc, { title: '지수 하루 흐름', hiddenTitle: true, asOf, asOfDetail: detail });
  markFrame(host, 'home.index-strip');
  if (!host.childElementCount) {
    host.replaceChildren(head('불러오는 중'), el(doc, 'div', null, 'home-index-grid'));
    host.lastChild.append(...INDEX_STRIP.map((spec) => card(doc, root, spec, null, false)));
  }
  // SPY first: when no relay answers, the other three are not tried, so one unreachable chart path does not count four
  // failures against the shared proxy health (three flip it to error).
  const read = (spec) => Promise.resolve().then(() => fetchBars(spec.sym, '1d', '5m')).then((payload) => sessionModel(payload)).catch(() => null);
  host._aioIndexPending = read(INDEX_STRIP[0])
    .then((first) => (first ? Promise.all(INDEX_STRIP.slice(1).map(read)).then((rest) => [first, ...rest]) : INDEX_STRIP.map(() => null)))
    .then((models) => {
      const basis = models.find(Boolean);
      const when = basis ? `${basis.session.month}/${basis.session.day}(${WEEKDAY_KO[basis.session.weekday] || ''})` : '';
      const chip = !basis ? '분봉 없음' : basis.open ? `${when} 진행 중` : `${when} 마감`;
      const detail = `뉴욕 정규장 5분봉, 점선은 전일 종가, 시세는 지연될 수 있음${basis?.open ? ', 장중에는 5분마다 다시 읽음' : ''}`;
      const grid = el(doc, 'div', null, 'home-index-grid');
      grid.append(...INDEX_STRIP.map((spec, i) => card(doc, root, spec, models[i], !models[i])));
      host.replaceChildren(head(chip, detail), grid);
      host.dataset.session = basis ? `${basis.session.month}/${basis.session.day}` : '';
      clearTimeout(host._aioIndexTimer);
      if (basis?.open) {
        host._aioIndexTimer = setTimeout(() => {
          if (host.isConnected && doc.getElementById('page-home')?.classList.contains('active') && doc.visibilityState !== 'hidden') renderHomeIndexStrip({ documentRef: doc, root });
        }, REFRESH_MS);
      }
      return models;
    })
    .finally(() => { host._aioIndexPending = null; });
  return host._aioIndexPending;
}
