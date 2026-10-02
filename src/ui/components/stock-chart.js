// P1397: 종목 차트 — candles with the evidence drawn on the price (Lightweight Charts, Apache-2.0,
// already loaded by the shell) and an evidence panel with a setup state. No composite grade.
import { analyzeChart } from '../../domain/technical/chart-analysis.js';
import { buildCloseSeries, buildMarketRegime } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';

const STATE_TONE = Object.freeze({ breakout: 'favorable', setup: 'favorable', extended: 'neutral', none: 'neutral', failed: 'burden', downtrend: 'burden' });

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function cssVar(root, name, fallback) {
  try { return root.getComputedStyle(root.document.body).getPropertyValue(name).trim() || fallback; } catch (_) { return fallback; }
}

export function barsFromYahoo(payload) {
  if (!payload || !Array.isArray(payload.timestamps)) return [];
  const tz = payload.meta?.exchangeTimezoneName || 'America/New_York';
  return payload.timestamps.map((ts, i) => ({
    time: new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: tz }),
    open: payload.opens?.[i], high: payload.highs?.[i], low: payload.lows?.[i], close: payload.closes?.[i], volume: payload.volumes?.[i]
  })).filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0));
}

function drawChart(root, host, analysis, previous) {
  const LWC = root.LightweightCharts;
  if (previous?.chart) { try { previous.chart.remove(); } catch (_) {} }
  host.replaceChildren();
  if (!LWC?.createChart) { host.append(el(root.document, 'div', '차트 라이브러리를 불러오지 못했습니다.', 'briefing-empty')); return null; }
  const text = cssVar(root, '--text-secondary', '#57513f');
  const grid = cssVar(root, '--border-subtle', '#e6e0d4');
  const up = cssVar(root, '--data-green', '#22754c');
  const down = cssVar(root, '--data-red', '#b13a30');
  const chart = LWC.createChart(host, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit', fontSize: 12 },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderColor: grid, rightOffset: 4 },
    crosshair: { mode: 0 },
    localization: { locale: 'ko-KR' }
  });
  const candles = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
  candles.setData(analysis.bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  const line = (values, color, width, style = 0) => {
    const series = chart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    series.setData(analysis.bars.map((bar, i) => values[i] == null ? null : { time: bar.time, value: values[i] }).filter(Boolean));
    return series;
  };
  line(analysis.lines.ema8, '#2f9e8f', 1.2);
  line(analysis.lines.ema21, '#3b6fb6', 1.5);
  line(analysis.lines.sma50, '#c7892a', 1.5);
  line(analysis.lines.sma200, '#8a4fa3', 1.5, 2);
  const volume = chart.addHistogramSeries({ priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  volume.setData(analysis.bars.map((bar) => ({ time: bar.time, value: bar.volume || 0, color: bar.close >= bar.open ? 'rgba(34,117,76,0.35)' : 'rgba(177,58,48,0.35)' })));
  const priceLine = (price, color, title, style = 2) => { if (price != null) candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }); };
  priceLine(analysis.pivot, '#c7892a', '피벗', 0);
  priceLine(analysis.prev.high, text, '전일 고가', 1);
  priceLine(analysis.prev.low, text, '전일 저가', 1);
  if (analysis.high52 > analysis.last.close * 1.002) priceLine(analysis.high52, grid === '#e6e0d4' ? '#999' : text, '52주 고점', 3);
  // Contraction lows (depth) + descriptive events (8-day line, volume gap, squeeze, overheating).
  const toneColor = { favorable: up, burden: down, neutral: '#8a8271' };
  const markers = (analysis.vcp.valid ? analysis.vcp.contractions : []).map((row) => ({ time: analysis.bars[row.lowIndex].time, position: 'belowBar', color: '#c7892a', shape: 'arrowUp', text: `수축 -${row.depth.toFixed(1)}%` }));
  for (const event of analysis.events || []) markers.push({ time: analysis.bars[event.index].time, position: event.position, color: toneColor[event.tone] || '#8a8271', shape: event.position === 'aboveBar' ? 'arrowDown' : 'arrowUp', text: event.text });
  if (analysis.state === 'breakout') markers.push({ time: analysis.last.time, position: 'aboveBar', color: up, shape: 'arrowDown', text: '피벗 돌파' });
  candles.setMarkers(markers.sort((a, b) => a.time.localeCompare(b.time)));
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, analysis.bars.length - 160), to: analysis.bars.length + 3 });
  return { chart };
}

export async function renderStockChart({ documentRef: doc, root, symbol }) {
  const host = doc.getElementById('stock-chart-canvas');
  const panel = doc.getElementById('stock-chart-evidence');
  if (!host || !panel) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const set = (id, value) => { const node = doc.getElementById(id); if (node) node.textContent = value; return node; };
  set('stock-chart-title', `${sym} 일봉`);
  set('stock-chart-status', '불러오는 중…');
  // A slower earlier request must not overwrite the symbol the user asked for last.
  const ticket = (root.__aioStockChartTicket = (root.__aioStockChartTicket || 0) + 1);
  let payload = null;
  try { payload = await root._aioFetchYahooChartData?.(sym, '2y', '1d'); } catch (_) { payload = null; }
  if (ticket !== root.__aioStockChartTicket) return null;
  const bars = barsFromYahoo(payload);
  const benchmark = buildCloseSeries(root._aioHistory || [], 'spx');
  const analysis = analyzeChart(bars, { benchmark });
  if (!analysis.available) {
    set('stock-chart-status', bars.length ? '일봉 기록이 60개 미만이라 분석할 수 없습니다.' : '시세를 받지 못했습니다. 티커를 확인하거나 잠시 후 다시 시도하세요.');
    panel.replaceChildren();
    host.replaceChildren();
    return null;
  }
  const change = analysis.prev ? (analysis.last.close / analysis.prev.close - 1) * 100 : null;
  set('stock-chart-status', `${analysis.asOf} 종가 ${analysis.last.close.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
  const badge = doc.getElementById('stock-chart-state');
  if (badge) { badge.textContent = analysis.stateLabel; badge.className = `regime-state is-${STATE_TONE[analysis.state] || 'neutral'}`; }
  root.__aioStockChartInstance = drawChart(root, host, analysis, root.__aioStockChartInstance);
  const regime = buildMarketRegime(collectMarketInputs(root));
  const list = el(doc, 'dl', null, 'regime-evidence');
  for (const [label, value] of [...analysis.evidence, ['시장 상태', regime.available ? `${regime.overall} (우호 ${regime.counts.favorable} · 부담 ${regime.counts.burden})` : '—']]) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
  panel.replaceChildren(list);
  if (analysis.flip) panel.append(el(doc, 'p', `전환 조건: ${analysis.flip}`, 'regime-flip'));
  doc.getElementById('stock-chart-section')?.setAttribute('data-symbol', sym);
  return analysis;
}

export function installStockChart({ documentRef: doc, root }) {
  const form = doc.getElementById('stock-chart-form');
  if (!form || form.dataset.aioStockChart === 'installed') return;
  form.dataset.aioStockChart = 'installed';
  const input = doc.getElementById('stock-chart-input');
  const run = (symbol) => { if (input && symbol) input.value = symbol; renderStockChart({ documentRef: doc, root, symbol: symbol || input?.value }); };
  form.addEventListener('submit', (event) => { event.preventDefault(); run(); });
  doc.querySelectorAll('[data-stock-chart-symbol]').forEach((chip) => chip.addEventListener('click', () => run(chip.dataset.stockChartSymbol)));
  run(input?.value || 'SPY');
}
