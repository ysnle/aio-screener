import { drawChart, ensureChartLibrary } from './stock-chart.js';
import { attachChartLayers, recentLogicalRange } from './stock-chart-layers.js';
import { buildChartLayers } from '../../domain/technical/chart-layers.js';
import { barsFromYahoo, completedBars } from '../../data/chart-bars.js';
import { CHART_INDEXES, barsChartReading, indexChartReading, latestBreadth } from '../../domain/technical/market-charts.js';
import { createTrendChart } from './trend-chart.js';
import { kindFold, rawTable, setFoldBody } from './indicator-face.js';
import { chartPalette } from './color-theme.js';
import { el } from './dom.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { shortDate } from '../../domain/content/date-labels.js';

const CARD_PRICE_PX = 260;
const whole = (value) => Math.round(value).toLocaleString('en-US');
const isKorean = (symbol) => /\.K[SQ]$/i.test(String(symbol || ''));
const priceOf = (symbol) => (isKorean(symbol) ? (value) => `₩${whole(value)}` : (value) => `$${value.toFixed(2)}`);

/** The 시장 지수 cards: [field, label, fund] → card specs; `closes` names the history field a card can fall back to. */
export const INDEX_CARD_SPECS = Object.freeze(CHART_INDEXES.map(([field, label, symbol]) => Object.freeze({ key: field, label, symbol, closes: field })));

// Daily bars for every card on the page go through one queue: at most four requests in flight, whichever view asked.
const MAX_LOADS = 4;
let inFlight = 0;
const waiting = [];
function queued(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      inFlight += 1;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { inFlight -= 1; waiting.shift()?.(); });
    };
    if (inFlight < MAX_LOADS) run(); else waiting.push(run);
  });
}

function shell(doc, spec) {
  const card = el(doc, 'section', null, 'charts-card charts-index-card');
  if (spec.closes) card.dataset.index = spec.key; else card.dataset.stock = spec.key;
  if (spec.symbol) card.dataset.symbol = spec.symbol;
  const head = el(doc, 'div', null, 'charts-candle-head');
  const title = el(doc, 'h3', spec.label, 'charts-candle-title');
  const source = el(doc, 'span', '', 'charts-candle-name');
  const verdict = el(doc, 'span', '불러오는 중', 'charts-trend');
  const close = el(doc, 'span', '', 'charts-candle-close');
  head.append(title, source, verdict, close);
  const facts = el(doc, 'p', '', 'charts-card-conclusion');
  const volume = el(doc, 'p', '', 'charts-card-volume');
  const chips = el(doc, 'div', null, 'stock-chart-layer-read charts-candle-chips');
  const chart = el(doc, 'div', null, 'charts-index-chart');
  chart.style.minHeight = `${CARD_PRICE_PX}px`;
  const fold = kindFold(doc, 'raw-table', '이 카드의 수치', []);
  // Every card keeps its seven children (the row's shared tracks, chart-quality.css subgrid); a Korean index card's open
  // slot is an empty placeholder, since its index has no fund to open.
  const open = spec.symbol ? el(doc, 'button', `${spec.symbol} 분석 열기`, 'charts-open') : el(doc, 'span', null, 'charts-open-none');
  if (spec.symbol) open.type = 'button';
  card.append(head, facts, volume, chips, chart, fold, open);
  return { card, source, verdict, close, facts, volume, chips, chart, fold, open };
}

/**
 * A grid of chart cards. `specs` is [{ key, label, symbol, closes? }]; `setSpecs` replaces the list (a card already drawn
 * for a key is kept). `lazy` loads nothing while the grid is not drawn (a hidden view, an inactive screen); once it is,
 * every card's bars load through the queue. Loading each card as it scrolled into view left the cards a
 * reader had not reached, or jumped past, at "불러오는 중" without a request.
 * `update(history, asOf)` re-reads every card from the history the page holds; `onReadings(readings, asOf)` hears the
 * settled readings in card order and the close date the cards were marked against. `basisOf(readings)`, when given,
 * dates the grid from its own settled readings and the `asOf` passed to update is ignored.
 */
export function createChartCards({ documentRef: doc, root, host, specs = INDEX_CARD_SPECS, lazy = false, onOpen = () => {}, onReadings = () => {}, basisOf = null }) {
  if (!host) return { update: () => {}, setSpecs: () => {}, dispose: () => {} };
  let alive = true;
  let history = [];
  let asOf = null;
  let cards = [];
  // A grid gets a box when its view is shown; the observer hears that change (and the first measure).
  const drawn = () => host.getClientRects().length > 0;
  const Watcher = lazy ? root?.ResizeObserver : null;
  const watcher = Watcher ? new Watcher(() => { if (drawn()) cards.forEach(start); }) : null;

  const readingOf = (card) => {
    const { key, label, symbol, closes } = card.spec;
    const breadth = closes === 'spx' ? latestBreadth(history) : null;
    if (card.state === 'bars') return barsChartReading({ bars: card.bars, field: closes || key, label, symbol, positionOnly: false, history: closes ? history : [], breadth, money: priceOf(symbol) });
    if (card.state === 'closes') return indexChartReading(history, closes, label, { breadth });
    return null;
  };

  const paintCloses = (card, reading) => {
    const { chart } = card.parts;
    if (!reading) { chart.replaceChildren(el(doc, 'p', '종가 기록을 불러오는 중입니다.', 'briefing-empty')); return; }
    const refs = [reading.support?.value ?? reading.doubleTop?.neck?.value].filter(Number.isFinite);
    const levelName = Number.isFinite(reading.support?.value) ? '지지' : '목선';
    const svg = createTrendChart(doc, { series: reading.series, refLines: refs, format: whole, refLabel: (value) => `${levelName} ${whole(value)}`, label: `${reading.label} 종가`, guide: { series: reading.ma50Series, label: '50일선' }, longGuide: { series: reading.ma200Series } });
    chart.replaceChildren(svg);
    if (reading.ma200Series?.length > 1) chart.append(el(doc, 'p', '긴 점선 50일선, 촘촘한 점선 200일선', 'charts-legend'));
  };

  const paint = (card) => {
    const { parts, spec } = card;
    const reading = readingOf(card);
    card.reading = reading;
    parts.card.classList.toggle('charts-candle-card', card.state === 'bars');
    parts.card.dataset.source = card.state;
    parts.source.textContent = card.state === 'bars' ? `${spec.symbol} 일봉` : card.state === 'closes' ? '종가' : spec.closes ? '' : spec.symbol;
    parts.verdict.textContent = reading ? reading.trendWord : card.state === 'missing' ? '값 없음' : card.state === 'closes' ? '판단 보류' : '불러오는 중';
    parts.verdict.className = `charts-trend${reading ? ` is-${reading.trend} is-tone-${reading.tone}` : ''}`;
    parts.card.dataset.trend = reading?.trend || '';
    parts.facts.textContent = reading ? `${reading.facts}${reading.asOf && asOf && reading.asOf !== asOf ? ` · ${shortDate(reading.asOf)} 종가` : ''}` : '';
    parts.volume.textContent = reading?.volume?.text || '';
    if (card.state === 'bars') {
      const last = card.bars.at(-1), prev = card.bars.at(-2);
      const change = (last.close / prev.close - 1) * 100;
      parts.close.textContent = `${last.time.slice(5).replace('-', '/')} ${priceOf(spec.symbol)(last.close)} ${signedText(change, 2, '%')}`;
      const direction = directionOf(change, 2);
      parts.close.className = `charts-candle-close${direction ? ` is-${direction === 'up' ? 'up' : 'down'}` : ''}`;
    } else {
      parts.close.textContent = reading ? `${shortDate(reading.asOf)} ${whole(reading.close)}` : '';
      parts.close.className = 'charts-candle-close';
      if (card.state === 'closes') paintCloses(card, reading);
      // A stock without daily bars draws no empty chart: one line names the page's close date and that there is no value.
      if (card.state === 'missing') {
        parts.chart.style.minHeight = '';
        parts.chart.replaceChildren(el(doc, 'p', `${asOf ? `${shortDate(asOf)} 종가 기준 ` : ''}일봉 값 없음`, 'charts-card-missing'));
      }
    }
    setFoldBody(parts.fold, reading ? rawTable(doc, reading.numbers, `${spec.label} 수치`) : []);
    parts.fold.style.visibility = reading ? '' : 'hidden';
  };

  // With `basisOf`, the grid's close date is read from what it draws: each settled card (its bars arriving, a fallback to
  // closes) re-reads it, and a changed date repaints the cards that now sit on another session.
  const report = () => {
    const settled = cards.filter((card) => !['loading', 'waiting'].includes(card.state)).map((card) => card.reading).filter(Boolean);
    if (basisOf) {
      const next = basisOf(settled) || null;
      if (next !== asOf) { asOf = next; cards.forEach(paint); }
    }
    onReadings(settled, asOf);
  };

  const drawBars = (card, LWC) => {
    const { chart, chips } = card.parts;
    const canvas = el(doc, 'div', null, 'charts-candle-canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${card.spec.symbol} 일봉 캔들과 거래량, 이동평균, 매물대, 추세 구간`);
    canvas.style.height = `${CARD_PRICE_PX}px`;
    chart.replaceChildren(canvas);
    if (!LWC) return false;
    const instance = drawChart(root, canvas, { bars: card.bars }, null, false);
    if (!instance) return false;
    // The library's logo sat over the card's bottom-left candles; the page's 데이터 출처 fold carries the attribution.
    instance.chart.applyOptions({ handleScroll: false, handleScale: false, layout: { attributionLogo: false }, timeScale: { barSpacing: 4, minBarSpacing: 2, rightOffset: 2 } });
    // About 90 sessions at 2 px or more on a ~240 px plot; a longer span was clamped by minBarSpacing from the left.
    const range = () => instance.chart.timeScale().setVisibleLogicalRange(recentLogicalRange(card.bars.length, 90));
    range();
    (root.requestAnimationFrame || setTimeout)(range);
    card.instance = instance;
    canvas.__aioChart = instance; // the chart-scale gate reads the drawn geometry (layers.geometry) from the card
    attachChartLayers({ doc, root, instance, layers: buildChartLayers(card.bars), compact: true, readHost: chips, pricePx: CARD_PRICE_PX, price: priceOf(card.spec.symbol) });
    return true;
  };

  const fallback = (card) => (card.spec.closes ? 'closes' : 'missing');
  const load = async (card) => {
    const sym = card.spec.symbol;
    const [payload, LWC] = await Promise.all([queued(() => root._aioFetchYahooChartData?.(sym, '2y', '1d')).catch(() => null), ensureChartLibrary(root)]);
    if (!alive || card.gone) return;
    const { bars } = completedBars(barsFromYahoo(payload), payload);
    if (LWC && bars.length >= 60) {
      card.bars = bars;
      card.state = 'bars';
      if (!drawBars(card, LWC)) card.state = fallback(card);
    } else card.state = fallback(card);
    paint(card);
    report();
  };
  function start(card) {
    if (card.state !== 'waiting') return;
    card.state = 'loading';
    paint(card);
    load(card).catch(() => { card.state = fallback(card); paint(card); report(); });
  }

  const disposeCard = (card) => {
    card.gone = true;
    try { card.instance?.layers?.dispose?.(); } catch (_) {}
    try { card.instance?.chart.remove(); } catch (_) {}
  };
  const setSpecs = (list) => {
    const next = (Array.isArray(list) ? list : []).filter((spec) => spec?.key);
    const kept = new Map(cards.map((card) => [card.spec.key, card]));
    cards = next.map((spec) => {
      const old = kept.get(spec.key);
      if (old) { kept.delete(spec.key); return old; }
      return { spec, parts: shell(doc, spec), state: spec.symbol ? 'waiting' : fallback({ spec }), bars: null, instance: null };
    });
    kept.forEach(disposeCard);
    host.replaceChildren(...cards.map((card) => card.parts.card));
    for (const card of cards) {
      if (card.bound) continue;
      card.bound = true;
      if (card.spec.symbol) card.parts.open.addEventListener('click', () => onOpen(card.spec.symbol));
      paint(card);
      if (card.state === 'waiting' && (!watcher || drawn())) start(card);
    }
    report();
  };

  setSpecs(specs);
  watcher?.observe(host);
  const recolor = () => { const next = chartPalette(root); cards.forEach((card) => card.instance?.applyTheme?.(next)); };
  doc.addEventListener?.('aio:colorThemeChanged', recolor);

  return {
    update(nextHistory, pageAsOf) {
      history = Array.isArray(nextHistory) ? nextHistory : [];
      if (!basisOf) asOf = pageAsOf || null;
      cards.forEach(paint);
      report();
    },
    setSpecs,
    dispose() {
      alive = false;
      watcher?.disconnect?.();
      doc.removeEventListener?.('aio:colorThemeChanged', recolor);
      cards.forEach(disposeCard);
    }
  };
}
