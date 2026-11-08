// The multi-timeframe trend strip. One question a chart on a single interval cannot
// answer — is this move with or against the bigger trend? — answered with three short chips: the weekly, daily and
// hourly trend in the one vocabulary (trend-state.js, the words the 종목 page and the screener use). The interval on
// screen reads its own bars; the other two are fetched once per symbol and kept for five minutes, so switching interval
// costs no extra request. A chip opens that interval. A failed fetch shows a dash, never a guess.
import { trendOfBars } from '../../domain/technical/trend-state.js';
import { el } from './dom.js';

export const MTF_FRAMES = Object.freeze([
  { id: '1wk', short: '주' },
  { id: '1d', short: '일' },
  { id: '1h', short: '1시간' }
]);
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const keyOf = (sym, id) => `${sym}|${id}`;

/** Bars the chart already fetched for this symbol and interval, kept for the strip. */
export function rememberBars(sym, id, bars) {
  if (sym && id && Array.isArray(bars) && bars.length) cache.set(keyOf(sym, id), { at: Date.now(), bars: Promise.resolve(bars) });
}

function barsFor(sym, id, load) {
  const now = Date.now();
  for (const [key, entry] of cache) if (now - entry.at >= TTL_MS) cache.delete(key); // expired series do not pile up
  const hit = cache.get(keyOf(sym, id));
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bars;
  const bars = Promise.resolve().then(() => load(id)).then((list) => (Array.isArray(list) ? list : [])).catch(() => []);
  cache.set(keyOf(sym, id), { at: Date.now(), bars });
  bars.then((list) => { if (!list.length) cache.delete(keyOf(sym, id)); });
  return bars;
}

const TONE = Object.freeze({ favorable: 'up', burden: 'down' });

/**
 * Draw the strip into `host` (replacing what it held). `load(id)` resolves to the bars of that interval; `onOpen(id)`
 * switches the chart. Returns a promise that settles when every chip has its word (for tests).
 */
export function renderTrendStrip({ doc, host, sym, active, bars = null, load, onOpen, isCurrent = () => true }) {
  if (!host) return Promise.resolve([]);
  if (bars?.length) rememberBars(sym, active, bars);
  host.replaceChildren(el(doc, 'span', '추세', 'stock-chart-mtf-label'));
  host.hidden = false;
  const chips = MTF_FRAMES.map((frame) => {
    const chip = el(doc, 'button', `${frame.short} …`, 'chart-chip is-neutral stock-chart-mtf-chip');
    chip.type = 'button';
    chip.dataset.frame = frame.id;
    if (frame.id === active) chip.setAttribute('aria-current', 'true');
    chip.addEventListener('click', () => { if (frame.id !== active) onOpen?.(frame.id); });
    host.append(chip);
    return chip;
  });
  return Promise.all(MTF_FRAMES.map(async (frame, index) => {
    const list = frame.id === active && bars?.length ? bars : await barsFor(sym, frame.id, load);
    if (!isCurrent()) return null;
    const trend = list.length ? trendOfBars(list) : null;
    const chip = chips[index];
    chip.textContent = `${frame.short} ${trend ? trend.label : list.length ? '판단 보류' : '—'}`;
    chip.className = `chart-chip is-${TONE[trend?.tone] || 'neutral'} stock-chart-mtf-chip`;
    chip.title = trend ? trend.text : list.length ? '이 주기는 50·200개 봉의 이동평균을 계산할 기록이 부족합니다' : '이 주기의 시세를 받지 못했습니다';
    chip.dataset.trend = trend ? trend.phase || trend.id : '';
    return trend;
  }));
}
