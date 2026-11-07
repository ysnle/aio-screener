// v59.74 (owner 2026-11-07, chart redesign): the chart's layers on every bar interval (minute, hour, day, week, month).
// The base tier (5·10·20·50·100·200 moving averages with their alignment, the volume profile and the trend areas, on top
// of the candles and volume) is on for every stock; the added moving averages (EMA 8·21) and the studies (RSI, MACD,
// divergence, Fibonacci, Bollinger squeeze/expansion, and on daily bars VCP, signals, the RS line, price levels) are
// opt-in from one toggle row and remembered on this device. Calculations live in domain/technical/chart-layers.js; this file only
// draws them with Lightweight Charts series and series primitives (custom canvas layers, available since 4.1).
import { CHART_LAYERS, resolveLayers, layerFacts } from '../../domain/technical/chart-layers.js';
import { createStorageGateway } from '../../platform/storage.js';
import { el } from './dom.js';

const PREF_KEY = 'chart-layer-pref-v1';
const storage = createStorageGateway();
const readPref = () => { try { return JSON.parse(storage.get(PREF_KEY, '') || 'null'); } catch (_) { return null; } };
const writePref = (value) => { try { storage.set(PREF_KEY, JSON.stringify(value)); } catch (_) {} };

// Heights in px: the price chart keeps its 440 px; each study pane (RSI, MACD, RS) is its own chart of PANE_PX under it,
// sharing the time axis (scroll, zoom and crosshair are synced) and a fixed price-axis width so the bars line up.
export const PRICE_PX_DEFAULT = 440;
export const PANE_PX = 120;
export const AXIS_PX = 76;
const PANE_ORDER = ['rsi', 'macd', 'rs'];
// [period, line width, line style]: the short set (5·10·20) and the mid/long set (20·50·200) heavier, 100 thin, 200 dashed.
const MA_STYLE = Object.freeze([[5, 1.6, 0], [10, 1.6, 0], [20, 2, 0], [50, 1.8, 0], [100, 1, 0], [200, 1.8, 2]]);

/** Scale margins (fractions of the price chart's height) for the price and the volume overlay. */
export function chartLayout(pricePx = PRICE_PX_DEFAULT) {
  return { height: pricePx, price: { top: 0.06, bottom: 0.22 }, volume: { top: 0.82, bottom: 0 }, priceRegionBottom: 1 };
}

function withAlpha(color, alpha) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return `#${hex[1]}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) { const [r, g, b] = rgb[1].split(',').map((part) => part.trim()); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
  return color;
}

// A series primitive whose single pane view runs `paint(ctx, size)` in media (CSS px) coordinates.
function canvasLayer(paint, zOrder = 'bottom') {
  let request = null;
  const renderer = { draw: (target) => target.useMediaCoordinateSpace(({ context, mediaSize }) => { try { paint(context, mediaSize); } catch (_) {} }) };
  const view = { zOrder: () => zOrder, renderer: () => renderer };
  return { attached: (param) => { request = param.requestUpdate; }, detached: () => { request = null; }, paneViews: () => [view], updateAllViews: () => {}, refresh: () => request?.() };
}

// `compact` (the market strip): base layers only, no toggle row or legend, the read written into `readHost`.
export function attachChartLayers({ doc, root, instance, layers, analysis = null, rs = null, price = (v) => String(v), compact = false, readHost = null, pricePx = PRICE_PX_DEFAULT }) {
  if (!compact) { doc.getElementById('stock-chart-layers')?.remove(); doc.querySelector('.stock-chart-layer-read')?.remove(); }
  if (!instance?.chart || !instance.candles || !layers?.available) return null;
  const { chart, candles, volume, palette, host } = instance;
  const bars = layers.bars;
  const n = bars.length - 1;
  const daily = !!analysis?.available;
  const offered = (layer) => (!layer.daily || daily) && (layer.id !== 'rs' || !!rs);
  const active = compact ? resolveLayers({}) : resolveLayers(readPref());
  for (const layer of CHART_LAYERS) if (!offered(layer)) active[layer.id] = false;
  let owned = { series: [], primitives: [], priceLines: [], panes: [] };
  let levelList = [];

  const ts = () => chart.timeScale();
  const xOf = (index) => ts().logicalToCoordinate(index);
  const spacing = () => { const a = xOf(0), b = xOf(1); return a != null && b != null ? Math.abs(b - a) : 6; };
  const line = (values, color, width, { style = 0, scale = 'right', title = '' } = {}) => {
    const series = chart.addLineSeries({ priceScaleId: scale, color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title });
    series.setData(bars.map((bar, i) => (values[i] == null ? null : { time: bar.time, value: values[i] })).filter(Boolean));
    owned.series.push(series);
    return series;
  };
  const primitive = (series, layer) => { series.attachPrimitive(layer); owned.primitives.push([series, layer]); return layer; };
  const priceLine = (options) => { owned.priceLines.push(candles.createPriceLine({ lineWidth: 1, axisLabelVisible: true, title: '', ...options })); };
  const clear = () => {
    for (const [series, layer] of owned.primitives) { try { series.detachPrimitive(layer); } catch (_) {} }
    for (const series of owned.series) { try { chart.removeSeries(series); } catch (_) {} }
    for (const item of owned.priceLines) { try { candles.removePriceLine(item); } catch (_) {} }
    for (const pane of owned.panes) pane.dispose();
    owned = { series: [], primitives: [], priceLines: [], panes: [] };
  };
  chart.applyOptions({ rightPriceScale: { minimumWidth: AXIS_PX } });

  // One study pane: its own chart under the price chart, time axis hidden except on the last pane, synced both ways.
  const paneHost = (() => {
    if (!host?.insertAdjacentElement) return null;
    host.parentElement?.querySelector?.(':scope > .stock-chart-panes')?.remove();
    const box = el(doc, 'div', null, 'stock-chart-panes');
    host.insertAdjacentElement('afterend', box);
    return box;
  })();
  const LWC = root.LightweightCharts;
  const addPane = (name, valueText) => {
    if (!paneHost || !LWC?.createChart) return null;
    const box = el(doc, 'div', null, 'stock-chart-pane');
    box.style.height = `${PANE_PX}px`;
    box.style.position = 'relative';
    const label = el(doc, 'span', `${name}${valueText ? `  ${valueText}` : ''}`, 'stock-chart-pane-label');
    paneHost.append(box);
    const pane = LWC.createChart(box, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: palette.text, fontFamily: 'inherit', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: palette.grid }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: palette.grid, minimumWidth: AXIS_PX, scaleMargins: { top: 0.14, bottom: 0.08 } },
      timeScale: { visible: false, borderColor: palette.grid },
      crosshair: { mode: 0 },
      handleScroll: !compact, handleScale: !compact
    });
    box.append(label);
    let syncing = false;
    const fromMain = (range) => { if (syncing || !range) return; syncing = true; pane.timeScale().setVisibleLogicalRange(range); syncing = false; };
    const toMain = (range) => { if (syncing || !range) return; syncing = true; ts().setVisibleLogicalRange(range); syncing = false; };
    ts().subscribeVisibleLogicalRangeChange(fromMain);
    pane.timeScale().subscribeVisibleLogicalRangeChange(toMain);
    const now = ts().getVisibleLogicalRange();
    if (now) pane.timeScale().setVisibleLogicalRange(now);
    const record = { chart: pane, series: null, values: null, dispose: () => { try { ts().unsubscribeVisibleLogicalRangeChange(fromMain); } catch (_) {} try { pane.remove(); } catch (_) {} box.remove(); } };
    owned.panes.push(record);
    return record;
  };
  const paneLine = (pane, values, color, width = 1.5, extra = {}) => {
    const series = pane.chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra });
    series.setData(bars.map((bar, i) => (values[i] == null ? null : { time: bar.time, value: values[i] })).filter(Boolean));
    return series;
  };
  // The crosshair on the price chart moves a crosshair on every pane at the same bar.
  const onCross = (param) => {
    for (const pane of owned.panes) {
      if (!pane.series) continue;
      const i = param?.logical != null ? Math.round(param.logical) : null;
      const value = i != null ? pane.values?.[i] : null;
      if (param?.time != null && value != null) pane.chart.setCrosshairPosition(value, param.time, pane.series); else pane.chart.clearCrosshairPosition?.();
    }
  };
  chart.subscribeCrosshairMove?.(onCross);

  const render = () => {
    clear();
    const layout = chartLayout(pricePx);
    if (host?.style) host.style.height = `${layout.height}px`;
    chart.priceScale('right').applyOptions({ scaleMargins: layout.price });
    chart.priceScale('volume').applyOptions({ scaleMargins: layout.volume });
    const priceBottom = (size) => size.height;

    // Base: trend areas — a faint wash over each confirmed up/down run and a stronger strip along the top edge.
    if (active.trend) {
      const segments = layers.trend.segments;
      primitive(candles, canvasLayer((ctx, size) => {
        const half = spacing() / 2, bottom = priceBottom(size);
        for (const seg of segments) {
          const x1 = xOf(seg.from), x2 = xOf(seg.to);
          if (x1 == null || x2 == null || x2 + half < 0 || x1 - half > size.width) continue;
          const color = seg.dir === 'up' ? palette.up : palette.down;
          ctx.fillStyle = withAlpha(color, 0.055);
          ctx.fillRect(x1 - half, 0, x2 - x1 + 2 * half, bottom);
          ctx.fillStyle = withAlpha(color, 0.55);
          ctx.fillRect(x1 - half, 0, x2 - x1 + 2 * half, 3);
        }
      }));
    }
    // Base: volume profile — horizontal bars on the right edge, the three heaviest zones as full-width bands.
    if (active.profile && layers.profile.available) {
      const { bins, zones } = layers.profile;
      const max = Math.max(...bins.map((bin) => bin.volume)) || 1;
      const zoneIndex = new Set(zones.map((zone) => zone.index));
      primitive(candles, canvasLayer((ctx, size) => {
        const width = Math.min(150, size.width * 0.2);
        for (const zone of zones) {
          const y1 = candles.priceToCoordinate(zone.high), y2 = candles.priceToCoordinate(zone.low);
          if (y1 == null || y2 == null) continue;
          ctx.fillStyle = withAlpha(palette.zone, 0.07);
          ctx.fillRect(0, y1, size.width, Math.max(1, y2 - y1));
        }
        bins.forEach((bin, index) => {
          const y1 = candles.priceToCoordinate(bin.high), y2 = candles.priceToCoordinate(bin.low);
          if (y1 == null || y2 == null) return;
          const w = bin.volume / max * width;
          ctx.fillStyle = withAlpha(palette.zone, zoneIndex.has(index) ? 0.42 : 0.2);
          ctx.fillRect(size.width - w, y1 + 0.5, w, Math.max(1, y2 - y1 - 1));
        });
      }));
    }
    // Base: 5·10·20·50·100·200 simple moving averages; 5·10·20 (short) and 20·50·200 (mid/long) drawn heavier, 100 light.
    if (active.ma) for (const [p, width, style] of MA_STYLE) if (bars.length >= p) line(layers.ma[p], palette[`ma${p}`], width, { style });
    if (active.ema821) { line(layers.ema8, palette.ema8, 1.3, { style: 1 }); line(layers.ema21, palette.ema21x, 1.3, { style: 1 }); }
    // Extra: Bollinger bands as a filled area; squeeze spans filled in amber.
    if (active.bands) {
      const { upper, lower } = layers.bands;
      line(upper, withAlpha(palette.band, 0.7), 1);
      line(lower, withAlpha(palette.band, 0.7), 1);
      const spans = layers.squeezes;
      primitive(candles, canvasLayer((ctx) => {
        const fill = (from, to, color) => {
          ctx.beginPath();
          let started = false;
          for (let i = from; i <= to; i++) { const x = xOf(i), y = candles.priceToCoordinate(upper[i]); if (x == null || y == null || upper[i] == null) continue; if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
          for (let i = to; i >= from; i--) { const x = xOf(i), y = candles.priceToCoordinate(lower[i]); if (x == null || y == null || lower[i] == null) continue; ctx.lineTo(x, y); }
          if (started) { ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
        };
        const first = upper.findIndex((v) => v != null);
        if (first >= 0) fill(first, n, withAlpha(palette.band, 0.07));
        for (const span of spans) fill(Math.max(first, span.from), span.to, withAlpha(palette.squeeze, 0.3));
      }));
    }

    // Price lines: the 52-week high (base), the pivot (VCP), prior-day high/low and the level map (levels), Fibonacci.
    const levels = [];
    if (daily && analysis.high52 > analysis.last.close * 1.002) levels.push([analysis.high52, palette.muted, analysis.rangeLabel ? `${analysis.rangeLabel} 고점` : '52주 고점', 3]);
    if (daily && active.vcp && analysis.pivot != null) levels.push([analysis.pivot, palette.sma50, '피벗', 0]);
    if (daily && active.levels) { if (analysis.prev?.high != null) levels.push([analysis.prev.high, palette.text, '전일 고가', 1]); if (analysis.prev?.low != null) levels.push([analysis.prev.low, palette.text, '전일 저가', 1]); }
    const near = Math.abs(bars[n].close) * 0.004;
    const placed = [];
    for (const [value, color, title, style] of levels.filter(([value]) => value != null).sort((x, y) => y[0] - x[0])) {
      const group = placed.find((slot) => Math.abs(slot.price - value) <= near);
      if (group) { group.titles.push(title); priceLine({ price: value, color, lineStyle: style, axisLabelVisible: false }); continue; }
      placed.push({ price: value, color, style, titles: [title] });
    }
    for (const slot of placed) priceLine({ price: slot.price, color: slot.color, lineStyle: slot.style, title: slot.titles.join('·') });
    if (active.levels) for (const level of levelList) priceLine({ price: level.price, color: palette.zone, lineStyle: 1, axisLabelVisible: false });
    if (active.fib && layers.fib.available) {
      for (const level of layers.fib.levels) priceLine({ price: level.price, color: withAlpha(palette.fib, level.ratio === 0 || level.ratio === 1 ? 0.9 : 0.75), lineStyle: level.ratio === 0.5 || level.ratio === 0.618 ? 0 : 2, title: `${(level.ratio * 100).toFixed(1)}%` });
    }

    // Markers: VCP contractions and the breakout, event signals, divergences. The latest of each label keeps its text.
    const markers = [];
    if (daily && active.vcp && analysis.vcp?.valid) for (const step of analysis.vcp.contractions) markers.push({ time: bars[step.lowIndex].time, position: 'belowBar', color: palette.sma50, shape: 'arrowUp', text: `수축 -${step.depth.toFixed(1)}%` });
    if (daily && active.vcp && analysis.state === 'breakout') markers.push({ time: analysis.last.time, position: 'aboveBar', color: palette.up, shape: 'arrowDown', text: '피벗 돌파' });
    if (daily && active.signals) {
      const tone = { favorable: palette.up, burden: palette.down, neutral: palette.muted };
      for (const event of analysis.events || []) markers.push({ time: bars[event.index].time, position: event.position, color: tone[event.tone] || palette.muted, shape: event.position === 'aboveBar' ? 'arrowDown' : 'arrowUp', text: event.text });
    }
    if (active.divergence) {
      for (const d of layers.divergences) {
        const color = d.kind === 'bullish' ? palette.up : palette.down;
        const seg = chart.addLineSeries({ color, lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        seg.setData([{ time: bars[d.from].time, value: d.priceFrom }, { time: bars[d.to].time, value: d.priceTo }]);
        owned.series.push(seg);
        markers.push({ time: bars[d.to].time, position: d.kind === 'bullish' ? 'belowBar' : 'aboveBar', color, shape: d.kind === 'bullish' ? 'arrowUp' : 'arrowDown', text: d.kind === 'bullish' ? '강세 다이버전스' : '약세 다이버전스' });
      }
    }
    const byTime = (a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0);
    const labelled = new Set();
    for (const marker of [...markers].sort((a, b) => byTime(b, a))) { if (labelled.has(marker.text)) marker.text = ''; else labelled.add(marker.text); }
    candles.setMarkers(markers.sort(byTime));

    // Study panes, in a fixed order: RSI, MACD, relative strength.
    if (active.rsi) {
      const { overbought, oversold } = layers.rsiBands;
      const pane = addPane('RSI 14', layers.rsi[n] != null ? layers.rsi[n].toFixed(1) : '');
      if (pane) {
        const fixed = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
        pane.series = paneLine(pane, layers.rsi, palette.rsi, 1.5, { autoscaleInfoProvider: fixed, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
        pane.values = layers.rsi;
        for (const [value, style] of [[overbought, 2], [50, 1], [oversold, 2]]) pane.series.createPriceLine({ price: value, color: palette.muted, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: '' });
        if (active.divergence) for (const d of layers.divergences) {
          const seg = pane.chart.addLineSeries({ color: d.kind === 'bullish' ? palette.up : palette.down, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: fixed });
          seg.setData([{ time: bars[d.from].time, value: d.rsiFrom }, { time: bars[d.to].time, value: d.rsiTo }]);
        }
      }
    }
    if (active.macd) {
      const { line: macdLine, signal, hist } = layers.macd;
      const digits = Math.abs(macdLine[n] ?? 0) >= 100 ? 0 : 2;
      const pane = addPane('MACD 12·26·9', macdLine[n] != null ? macdLine[n].toFixed(digits) : '');
      if (pane) {
        const histogram = pane.chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
        histogram.setData(bars.map((bar, i) => (hist[i] == null ? null : { time: bar.time, value: hist[i], color: withAlpha(hist[i] >= 0 ? palette.up : palette.down, hist[i - 1] != null && Math.abs(hist[i]) < Math.abs(hist[i - 1]) ? 0.3 : 0.6) })).filter(Boolean));
        pane.series = paneLine(pane, macdLine, palette.macd, 1.3);
        pane.values = macdLine;
        paneLine(pane, signal, palette.signal, 1.1);
        pane.series.createPriceLine({ price: 0, color: palette.muted, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
      }
    }
    if (active.rs && rs) {
      const pane = addPane(`상대강도 ÷ ${analysis?.benchmarkLabel || '지수'}`, rs.points.at(-1)?.value?.toFixed(1) || '');
      if (pane) {
        const series = pane.chart.addLineSeries({ color: palette.rs, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } });
        series.setData(rs.points);
        if (rs.highs.length) series.setMarkers(rs.highs.map((time) => ({ time, position: 'inBar', color: palette.rs, shape: 'circle', size: 0.6 })));
        const byTime = new Map(rs.points.map((point) => [point.time, point.value]));
        pane.series = series;
        pane.values = bars.map((bar) => byTime.get(bar.time) ?? null);
      }
    }
    // Only the bottom chart shows dates.
    const lastPane = owned.panes.at(-1);
    chart.applyOptions({ timeScale: { visible: !lastPane } });
    if (lastPane) lastPane.chart.applyOptions({ timeScale: { visible: true, timeVisible: typeof bars[0]?.time === 'number', secondsVisible: false, borderColor: palette.grid, ...(typeof bars[0]?.time === 'number' ? {} : { tickMarkFormatter: (time, type) => (type === 2 && typeof time === 'string' ? `${Number(time.slice(5, 7))}/${Number(time.slice(8, 10))}` : null) }) } });
    syncLegend();
    syncRead();
  };

  // The toggle row: base chips first (on by default), then the extra chips (off by default).
  const row = el(doc, 'div', null, 'stock-chart-layers');
  row.id = 'stock-chart-layers';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '차트 레이어');
  const group = (label, tier) => {
    const box = el(doc, 'div', null, 'sx-seg stock-chart-layer-group');
    box.dataset.tier = tier;
    box.append(el(doc, 'span', label, 'stock-chart-layer-label'));
    for (const layer of CHART_LAYERS.filter((item) => item.tier === tier)) {
      if (!offered(layer)) continue;
      const button = el(doc, 'button', layer.label);
      button.type = 'button';
      button.dataset.layer = layer.id;
      button.title = layer.title;
      button.setAttribute('aria-pressed', String(!!active[layer.id]));
      button.addEventListener('click', () => {
        active[layer.id] = !active[layer.id];
        button.setAttribute('aria-pressed', String(active[layer.id]));
        writePref(active);
        render();
      });
      box.append(button);
    }
    return box;
  };
  row.append(group('기본', 'base'), group('추가 이평선', 'ma'), group('보조 지표', 'extra'));
  const read = readHost || el(doc, 'div', null, 'stock-chart-layer-read');
  read.setAttribute('aria-live', 'polite');
  const anchor = compact ? null : doc.getElementById('stock-chart-intervals');
  if (anchor) { anchor.insertAdjacentElement('afterend', row); row.insertAdjacentElement('afterend', read); }

  function syncRead() {
    const chips = layerFacts(layers, active, bars, price);
    read.replaceChildren(...chips.map((chip) => { const span = el(doc, 'span', chip.text, `chart-chip is-${chip.tone}`); span.dataset.fact = chip.id; if (chip.title) span.title = chip.title; return span; }));
    read.hidden = !chips.length;
  }
  function syncLegend() {
    if (compact) return;
    const legend = doc.querySelector?.('#stock-chart-section .stock-chart-legend');
    if (!legend) return;
    const items = [];
    const item = (glyph, color, text, title = '') => {
      const span = el(doc, 'span', null, 'lg-item');
      const mark = el(doc, 'span', glyph); mark.style.color = color; mark.setAttribute('aria-hidden', 'true');
      span.append(mark, doc.createTextNode(` ${text}`));
      if (title) span.title = title;
      items.push(span);
    };
    if (active.ma) for (const [p, , style] of MA_STYLE) if (bars.length >= p) item(style ? '┅' : '━', palette[`ma${p}`], String(p));
    if (active.ema821) { item('┈', palette.ema8, 'EMA 8'); item('┈', palette.ema21x, 'EMA 21'); }
    if (active.trend) { item('▬', palette.up, '상승 추세'); item('▬', palette.down, '하락 추세', '배경 면: 추세 조건이 3거래일 이상 이어진 구간'); }
    if (active.profile) item('▮', palette.zone, '매물대', '오른쪽 막대: 가격대별 거래량, 진한 띠: 거래 집중 상위 3구간');
    if (active.signals) item('▲▼', palette.muted, '신호', '8일 EMA 이탈·회복, 거래량 갭, 변동성 압축, 과열');
    if (active.vcp) item('━', palette.sma50, '피벗 · ▲ 수축');
    if (active.bands) item('▒', palette.band, '볼린저 · 수렴', '진한 노란 면: 밴드 폭이 6개월 최저인 수렴 구간');
    if (active.fib) item('┄', palette.fib, '피보나치');
    if (active.divergence) item('╱', palette.muted, '다이버전스');
    if (active.levels) item('┈', palette.zone, '가격 레벨');
    legend.replaceChildren(...items);
  }

  // The coach section's "show every level" toggle calls this; `reveal` turns the layer on for a user action.
  instance.setLevels = (list = [], { reveal = false } = {}) => {
    levelList = Array.isArray(list) ? list : [];
    if (reveal && !active.levels) {
      active.levels = true;
      row.querySelector('[data-layer="levels"]')?.setAttribute('aria-pressed', 'true');
      writePref(active);
    }
    render();
  };
  instance.layers = { active: () => ({ ...active }), render, dispose: () => { clear(); paneHost?.remove(); try { chart.unsubscribeCrosshairMove?.(onCross); } catch (_) {} } };
  render();
  if (!compact) root.__aioChartLayers = { active: () => ({ ...active }) };
  return { active };
}
