// P1397: 종목 차트 — candles with the evidence drawn on the price (Lightweight Charts, Apache-2.0,
// already loaded by the shell) and an evidence panel with a setup state. No composite grade.
import { analyzeChart, chartReading } from '../../domain/technical/chart-analysis.js';
import { buildCloseSeries, buildMarketRegime } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';
import { emptyState } from './empty-state.js';
import { setStockSubject } from '../navigation/route-hubs.js';
import { renderNextSteps } from './page-flow.js';

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

// P1428 (Codex review): during the session Yahoo's last daily bar is still moving; it was analysed and
// labelled 종가. A bar dated today in the exchange's zone is kept only after the close (+20 minutes for the
// official print); the regular-session end comes from the payload when present (16:00 by default).
export function completedBars(bars, payload, nowMs = Date.now()) {
  if (!bars.length) return { bars, droppedLive: false };
  const tz = payload?.meta?.exchangeTimezoneName || 'America/New_York';
  const today = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: tz });
  const last = bars[bars.length - 1];
  if (last.time !== today) return { bars, droppedLive: false };
  const end = Number(payload?.meta?.currentTradingPeriod?.regular?.end) * 1000;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const closed = Number.isFinite(end) && end > 0 ? nowMs >= end + 20 * 60000 : minutes >= 16 * 60 + 20;
  return closed ? { bars, droppedLive: false } : { bars: bars.slice(0, -1), droppedLive: true };
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
  // Codex review 2026-10-05: switching the chart to SPY left the 종목 header on NVDA with nothing saying the
  // two differ. A market chart now says so and offers the way back to the company's chart.
  const subject = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
  const title = doc.getElementById('stock-chart-title');
  doc.getElementById('stock-chart-context')?.remove();
  if (title && subject && subject !== sym) {
    const note = el(doc, 'span', `시장 비교 차트 · 요약·재무 탭의 종목은 ${subject} 그대로입니다 `, 'stock-chart-context');
    note.id = 'stock-chart-context';
    note.style.cssText = 'display:block;font-size:12px;font-weight:400;color:var(--text-muted);margin-top:2px;';
    const back = el(doc, 'button', `${subject} 차트로`, 'aio-btn-table');
    back.type = 'button';
    back.addEventListener('click', () => { const input = doc.getElementById('stock-chart-input'); if (input) input.value = subject; renderStockChart({ documentRef: doc, root, symbol: subject }); });
    note.append(back);
    title.insertAdjacentElement('afterend', note);
  }
  set('stock-chart-status', '불러오는 중…');
  // A slower earlier request must not overwrite the symbol the user asked for last.
  const ticket = (root.__aioStockChartTicket = (root.__aioStockChartTicket || 0) + 1);
  let payload = null;
  try { payload = await root._aioFetchYahooChartData?.(sym, '2y', '1d'); } catch (_) { payload = null; }
  if (ticket !== root.__aioStockChartTicket) return null;
  const { bars, droppedLive } = completedBars(barsFromYahoo(payload), payload);
  const benchmark = buildCloseSeries(root._aioHistory || [], 'spx');
  const analysis = analyzeChart(bars, { benchmark });
  if (!analysis.available) {
    set('stock-chart-status', '');
    // P1429: say which failure it is — no connection, an unknown ticker, or too little history.
    const retry = { label: '다시 시도', onClick: () => renderStockChart({ documentRef: doc, root, symbol: sym }) };
    const state = payload == null
      ? emptyState(doc, { title: `${sym} 시세를 받아오지 못했습니다`, reason: '시세 제공처나 중계 서버가 응답하지 않았습니다.', next: '잠시 후 다시 시도하거나 다른 종목으로 확인해 보세요.', action: retry })
      : bars.length === 0
        ? emptyState(doc, { title: `${sym}의 일봉이 없습니다`, reason: '티커가 맞는지 확인하세요. 한국 종목은 6자리 코드(예: 005930)로 검색합니다.' })
        : emptyState(doc, { title: `${sym}의 일봉이 ${bars.length}개뿐입니다`, reason: '추세·셋업 분석에는 최소 60거래일이 필요합니다.', next: '상장 직후 종목은 기록이 쌓인 뒤 분석됩니다.' });
    panel.replaceChildren(state);
    host.replaceChildren();
    // P1428: a failed lookup clears the previous symbol's setup badge and chart instance too.
    const staleBadge = doc.getElementById('stock-chart-state');
    if (staleBadge) { staleBadge.textContent = ''; staleBadge.className = 'regime-state is-unknown'; }
    if (root.__aioStockChartInstance?.chart) { try { root.__aioStockChartInstance.chart.remove(); } catch (_) {} }
    root.__aioStockChartInstance = null;
    return null;
  }
  const change = analysis.prev ? (analysis.last.close / analysis.prev.close - 1) * 100 : null;
  set('stock-chart-status', `${analysis.asOf} 종가 ${analysis.last.close.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)${droppedLive ? ' · 장중인 오늘 봉은 분석에서 제외' : ''}`);
  const badge = doc.getElementById('stock-chart-state');
  if (badge) { badge.textContent = analysis.stateLabel; badge.className = `regime-state is-${STATE_TONE[analysis.state] || 'neutral'}`; }
  root.__aioStockChartInstance = drawChart(root, host, analysis, root.__aioStockChartInstance);
  const regime = buildMarketRegime(collectMarketInputs(root));
  // P1435: reading first (state → why → market → flip), two pictures (Weinstein stage, trend template),
  // and the full evidence list folded underneath.
  const reading = chartReading(analysis, regime);
  const read = el(doc, 'div', null, 'chart-read');
  read.append(el(doc, 'p', reading.headline, 'chart-read-headline'));
  if (reading.why) read.append(el(doc, 'p', `근거: ${reading.why}.`, 'chart-read-why'));
  if (reading.market) read.append(el(doc, 'p', `${reading.market}.`, 'chart-read-market'));
  if (reading.flip) read.append(el(doc, 'p', `전환 조건: ${reading.flip}`, 'regime-flip'));
  const visuals = el(doc, 'div', null, 'chart-read-visuals');
  if (analysis.weinstein) {
    const stage = el(doc, 'div', null, 'chart-stage');
    stage.append(el(doc, 'span', 'Weinstein 단계 (30주선)', 'chart-vis-title'));
    const steps = el(doc, 'ol', null, 'chart-stage-steps');
    ['바닥', '상승', '천장', '하락'].forEach((label, index) => {
      const li = el(doc, 'li', `${index + 1} ${label}`, `chart-stage-step${analysis.weinstein.stage === index + 1 ? ' is-current' : ''}`);
      li.dataset.stage = String(index + 1);
      steps.append(li);
    });
    stage.append(steps);
    visuals.append(stage);
  }
  const template = el(doc, 'div', null, 'chart-template');
  template.append(el(doc, 'span', `추세 템플릿 ${analysis.templatePass}/8`, 'chart-vis-title'));
  const dots = el(doc, 'ul', null, 'chart-template-dots');
  for (const [label, ok] of analysis.templateChecks) {
    const li = el(doc, 'li', ok === true ? '✓' : ok === false ? '✕' : '?', `chart-template-dot ${ok === true ? 'is-pass' : ok === false ? 'is-fail' : 'is-unknown'}`);
    li.title = `${label} — ${ok === true ? '충족' : ok === false ? '미충족' : '확인 불가'}`;
    dots.append(li);
  }
  template.append(dots);
  visuals.append(template);
  const list = el(doc, 'dl', null, 'regime-evidence');
  for (const [label, value] of [...analysis.evidence, ['시장 상태', regime.available ? `${regime.overall} (우호 ${regime.counts.favorable} · 부담 ${regime.counts.burden})` : '—']]) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
  const more = el(doc, 'details', null, 'chart-evidence-more');
  more.append(el(doc, 'summary', `근거 전체 (${analysis.evidence.length + 1}개)`), list);
  panel.replaceChildren(read, visuals, more);
  // P1435: where the chart's question continues.
  const isIndex = /^(SPY|QQQ|DIA|IWM)$/.test(sym);
  renderNextSteps(doc, doc.getElementById('technical-next'), isIndex ? [
    { route: 'signal', label: '시장 상태', why: `${sym}의 추세가 시장 폭·금리·신용과 같은 방향인지` },
    { route: 'breadth', label: '시장 폭', why: '지수 움직임을 얼마나 많은 종목이 따라가는지' }
  ] : [
    { action: 'showTicker', arg: sym, route: 'ticker', label: '요약', why: '이 셋업이 섹터 회전·지수 대비 강도와 같은 방향인지' },
    { route: 'fundamental', label: '재무 공시', why: '가격 추세를 매출·이익이 뒷받침하는지' },
    { route: 'signal', label: '시장 상태', why: `셋업이 놓인 환경 — 지금은 ${regime.available ? regime.overall : '판정 대기'}` }
  ]);
  doc.getElementById('stock-chart-section')?.setAttribute('data-symbol', sym);
  return analysis;
}

// P1405/P1430: the chart follows the 종목 screen's company (root._aioLastOpenedSymbol, display-only).
// A symbol typed here becomes that company for 요약 · 재무 공시 too; the SPY/QQQ chips and an index
// card on 오늘 (root._aioChartRequest) open a market chart without changing the company.
export function installStockChart({ documentRef: doc, root }) {
  const form = doc.getElementById('stock-chart-form');
  if (!form) return;
  const input = doc.getElementById('stock-chart-input');
  const run = (symbol) => { if (input && symbol) input.value = symbol; renderStockChart({ documentRef: doc, root, symbol: symbol || input?.value }); };
  const request = String(root._aioChartRequest || '').trim().toUpperCase();
  root._aioChartRequest = null;
  const entity = String(root._aioLastOpenedSymbol || '').trim().toUpperCase();
  if (form.dataset.aioStockChart === 'installed') {
    if (request) run(request);
    else if (entity && entity !== form.dataset.aioStockChartEntity) { form.dataset.aioStockChartEntity = entity; run(entity); }
    return;
  }
  form.dataset.aioStockChart = 'installed';
  form.dataset.aioStockChartEntity = entity;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const typed = String(input?.value || '').trim().toUpperCase();
    if (setStockSubject({ root, documentRef: doc, symbol: typed })) form.dataset.aioStockChartEntity = typed;
    run();
  });
  doc.querySelectorAll('[data-stock-chart-symbol]').forEach((chip) => chip.addEventListener('click', () => run(chip.dataset.stockChartSymbol)));
  run(request || entity || input?.value || 'SPY');
}

// P1430: 오늘's S&P 500 / 나스닥 cards open the index chart they show, not the last company.
export function openMarketChart(root, symbol) {
  root._aioChartRequest = String(symbol || 'SPY').toUpperCase();
  if (typeof root.showPage === 'function') root.showPage('technical');
}
