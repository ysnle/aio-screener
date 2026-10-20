// P1397: 종목 차트 — candles with the evidence drawn on the price (Lightweight Charts, Apache-2.0,
// already loaded by the shell) and an evidence panel with a setup state. No composite grade.
import { TEMPLATE_LABEL, analyzeChart, benchmarkFieldFor, chartReading } from '../../domain/technical/chart-analysis.js';
import { buildCloseSeries, maOrder } from '../../domain/briefing/market-read.js';
import { readMarketRegime } from './market-regime.js';
import { emptyState } from './empty-state.js';
import { renderNextSteps } from './page-flow.js';
import { buildChartScenarios, buildVolumeByPrice } from '../../domain/technical/chart-scenarios.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { normalizeTickerInput } from '../../domain/entity/ticker-symbol.js';
import { el } from './dom.js';
// v57.91 (visual audit): the loading card spans the whole evidence grid instead of sitting in its last column.
const fullRow = (node) => { if (node?.style) node.style.gridColumn = '1 / -1'; return node; };

const STATE_TONE = Object.freeze({ breakout: 'favorable', setup: 'favorable', extended: 'neutral', none: 'neutral', failed: 'burden', downtrend: 'burden' });

// v57.54: the chart library is loaded on demand by the shell (window._aioEnsureChartLibrary). The first visit to 차트
// could read window.LightweightCharts before that load finished and print the failure text. Wait for it here, bounded,
// and report the failure only after the wait itself fails.
export async function ensureChartLibrary(root, timeoutMs = 8000) {
  if (root?.LightweightCharts?.createChart) return root.LightweightCharts;
  if (typeof root?._aioEnsureChartLibrary !== 'function') return null;
  let timer = null;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  await Promise.race([Promise.resolve().then(() => root._aioEnsureChartLibrary('lwc')).catch(() => null), timeout]);
  clearTimeout(timer);
  return root.LightweightCharts?.createChart ? root.LightweightCharts : null;
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
  const closeMinutes = tz === 'Asia/Seoul' ? 15 * 60 + 30 : tz === 'America/New_York' ? 16 * 60 : null;
  const closed = Number.isFinite(end) && end > 0 ? nowMs >= end + 20 * 60000 : closeMinutes != null && minutes >= closeMinutes + 20;
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

// Screen audit 2026-10-20: a Korean listing's axis read "400000.00" and the phone's last date tick read "9일" with no month.
// Won prices are whole numbers with separators; a day tick carries its month (M/D).
function chartLocalization(kr) {
  return {
    locale: 'ko-KR',
    priceFormatter: (price) => (kr ? Math.round(price).toLocaleString('ko-KR') : Number(price).toFixed(2))
  };
}
function dayTickFormatter(time, type) {
  if (type !== 2) return null; // year, month and intraday ticks keep the library's labels
  const parts = typeof time === 'string' ? time.split('-').map(Number).slice(1) : typeof time === 'object' && time ? [time.month, time.day]
    : (() => { const d = new Date(Number(time) * 1000); return [d.getUTCMonth() + 1, d.getUTCDate()]; })();
  return parts.every(Number.isFinite) ? `${parts[0]}/${parts[1]}` : null;
}
function drawChart(root, host, analysis, previous, kr = false) {
  const LWC = root.LightweightCharts;
  if (previous?.chart) { try { previous.chart.remove(); } catch (_) {} }
  host.replaceChildren();
  if (!LWC?.createChart) { host.append(el(root.document, 'div', '차트 라이브러리를 불러오지 못했습니다.', 'briefing-empty')); return null; }
  const text = cssVar(root, '--text-secondary', '#57513f');
  const grid = cssVar(root, '--border-subtle', '#e6e0d4');
  // P1634: Korean brokerage convention (rising red, falling blue) and a fixed bar spacing so a long
  // history scrolls instead of compressing every candle into a one-pixel line.
  const up = cssVar(root, '--candle-up', '#d23f35');
  const down = cssVar(root, '--candle-down', '#2a64c8');
  const chart = LWC.createChart(host, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit', fontSize: 12 },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderColor: grid, rightOffset: 4, barSpacing: 7, minBarSpacing: 3, tickMarkFormatter: dayTickFormatter },
    crosshair: { mode: 0 },
    localization: chartLocalization(kr)
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
  volume.setData(analysis.bars.map((bar) => ({ time: bar.time, value: bar.volume || 0, color: bar.close >= bar.open ? 'rgba(210,63,53,0.35)' : 'rgba(42,100,200,0.35)' })));
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
  // 2026-10-18 UI review: the same label (8일 EMA 회복 …) printed at every occurrence piled up over the latest bars; older
  // repeats keep their arrow and only the most recent one is labelled.
  const labelled = new Set();
  for (const marker of [...markers].sort((a, b) => b.time.localeCompare(a.time))) {
    if (labelled.has(marker.text)) marker.text = '';
    else labelled.add(marker.text);
  }
  candles.setMarkers(markers.sort((a, b) => a.time.localeCompare(b.time)));
  const showRecent = () => chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, analysis.bars.length - 130), to: analysis.bars.length + 3 });
  showRecent();
  (root.requestAnimationFrame || setTimeout)(showRecent); // autoSize lays out after the first frame
  return { chart, applyTheme: (palette) => {
    chart.applyOptions({ layout: { textColor: palette.text }, grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } }, rightPriceScale: { borderColor: palette.grid }, timeScale: { borderColor: palette.grid } });
    candles.applyOptions({ upColor: palette.up, downColor: palette.down, borderUpColor: palette.up, borderDownColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down });
  } };
}

// 2026-10-14 audit #6: with no bars there is nothing for the legend (8일 EMA …) or the setup chip to describe. The
// empty canvas column and those two hide, and the empty-state card spans the whole width; data restores them.
function setChartEmpty(doc, empty) {
  const section = doc.getElementById('stock-chart-section');
  const layout = section?.querySelector('.stock-chart-layout');
  const canvasColumn = doc.getElementById('stock-chart-canvas')?.parentElement;
  if (layout) layout.style.gridTemplateColumns = empty ? 'minmax(0, 1fr)' : '';
  if (canvasColumn && canvasColumn !== layout) canvasColumn.style.display = empty ? 'none' : '';
  const legend = section?.querySelector('.stock-chart-legend');
  if (legend) legend.style.display = empty ? 'none' : '';
  const badge = doc.getElementById('stock-chart-state');
  if (badge) badge.style.display = empty ? 'none' : '';
  section?.toggleAttribute?.('data-chart-empty', empty);
}

export async function renderStockChart({ documentRef: doc, root, symbol, interval = null }) {
  const host = doc.getElementById('stock-chart-canvas');
  const panel = doc.getElementById('stock-chart-evidence');
  if (!host || !panel) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const set = (id, value) => { const node = doc.getElementById(id); if (node) node.textContent = value; return node; };
  const spec = intervalSpec(interval || root.__aioStockChartInterval || '1d');
  root.__aioStockChartInterval = spec.id;
  set('stock-chart-title', `${sym} ${spec.label}봉`);
  renderIntervalButtons(doc, root, sym, spec.id);
  // Codex review 2026-10-05: switching the chart to SPY left the 종목 header on NVDA with nothing saying the
  // two differ. A market chart now says so and offers the way back to the company's chart.
  const subject = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
  const title = doc.getElementById('stock-chart-title');
  doc.getElementById('stock-chart-context')?.remove();
  if (title && subject && subject !== sym) {
    const note = el(doc, 'span', `시장 비교 차트 · 요약·재무 탭의 종목은 ${subject} 그대로입니다 `, 'stock-chart-context');
    note.id = 'stock-chart-context';
    const back = el(doc, 'button', `${subject} 차트로`, 'aio-btn-table');
    back.type = 'button';
    back.addEventListener('click', () => renderStockChart({ documentRef: doc, root, symbol: subject }));
    note.append(back);
    title.insertAdjacentElement('afterend', note);
  }
  if (spec.id !== '1d') return renderIntervalChart({ doc, root, sym, spec, ticket: (root.__aioStockChartTicket = (root.__aioStockChartTicket || 0) + 1) });
  set('stock-chart-status', '불러오는 중…');
  panel.replaceChildren(fullRow(emptyState(doc, { title: `${sym} 일봉을 불러오는 중입니다`, reason: '시세 제공처에서 일봉을 받아오는 중입니다.', compact: true })));
  // A slower earlier request must not overwrite the symbol the user asked for last.
  const ticket = (root.__aioStockChartTicket = (root.__aioStockChartTicket || 0) + 1);
  root.__aioStockChartAnalysis = null;
  const pending = Promise.resolve().then(() => root._aioFetchYahooChartData?.(sym, '2y', '1d')).catch(() => null);
  const library = ensureChartLibrary(root);
  let slowTimer = null;
  const slow = new Promise((resolve) => { slowTimer = setTimeout(() => resolve('__slow__'), 4000); });
  const first = await Promise.race([pending, slow]);
  clearTimeout(slowTimer);
  if (ticket !== root.__aioStockChartTicket) return null;
  if (first === '__slow__') {
    set('stock-chart-status', `${sym} 시세 응답이 늦어 계속 시도 중입니다`);
    if (!root.__aioStockChartInstance) setChartEmpty(doc, true);
    panel.replaceChildren(emptyState(doc, { title: `${sym} 시세를 아직 받아오지 못했습니다`, reason: '시세 제공처나 중계 서버 응답이 늦어지고 있습니다.', next: '응답이 오면 차트가 나타납니다 — 기다리거나 다시 시도하세요.', action: { label: '다시 시도', onClick: () => renderStockChart({ documentRef: doc, root, symbol: sym }) } }));
  }
  const payload = await pending;
  if (ticket !== root.__aioStockChartTicket) return null;
  const { bars, droppedLive } = completedBars(barsFromYahoo(payload), payload);
  const kr = /\.(KS|KQ)$/.test(sym);
  const benchmarkField = benchmarkFieldFor(sym);
  const benchmark = benchmarkField ? buildCloseSeries(root._aioHistory || [], benchmarkField) : [];
  const analysis = analyzeChart(bars, { benchmark, benchmarkLabel: kr ? (/\.KQ$/.test(sym) ? 'KOSDAQ' : 'KOSPI') : 'S&P 500' });
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
    setChartEmpty(doc, true);
    return null;
  }
  setChartEmpty(doc, false);
  const change = analysis.prev ? (analysis.last.close / analysis.prev.close - 1) * 100 : null;
  root.__aioStockChartAnalysis = { symbol: sym, analysis };
  set('stock-chart-status', `${analysis.asOf} 종가 ${formatScreenerPrice(analysis.last.close, kr ? 'KRW' : payload?.meta?.currency || null)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)${droppedLive ? ' · 장중인 오늘 봉은 분석에서 제외' : ''}`);
  const badge = doc.getElementById('stock-chart-state');
  if (badge) { badge.textContent = analysis.stateLabel; badge.className = `regime-state is-${STATE_TONE[analysis.state] || 'neutral'}`; }
  await library;
  if (ticket !== root.__aioStockChartTicket) return null;
  root.__aioStockChartInstance = drawChart(root, host, analysis, root.__aioStockChartInstance, kr);
  const regime = readMarketRegime(root); // v57.55 review (E1-02): the same regime reader (and credit history) as 시장 상태
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
  template.append(el(doc, 'span', `${TEMPLATE_LABEL} ${analysis.templatePass}/8`, 'chart-vis-title'));
  const dots = el(doc, 'ul', null, 'chart-template-dots');
  for (const [label, ok] of analysis.templateChecks) {
    const li = el(doc, 'li', ok === true ? '✓' : ok === false ? '✕' : '–', `chart-template-dot ${ok === true ? 'is-pass' : ok === false ? 'is-fail' : 'is-unknown'}`);
    li.title = `${label} — ${ok === true ? '충족' : ok === false ? '미충족' : '확인 불가'}`;
    li.setAttribute('aria-label', li.title); // v57.88: the mark is a symbol; screen readers get the words, and 확인 불가 is a dash, not '?'
    dots.append(li);
  }
  template.append(dots);
  visuals.append(template);
  const list = el(doc, 'dl', null, 'regime-evidence');
  const structure = intervalStructure(analysis.bars);
  const structureRows = [['단기 추세 (종가>5>10>20일선)', structure.short || '계산 불가'], ['장기 추세 (20>50>100>200일선)', structure.long || '기록 부족']];
  for (const [label, value] of [...structureRows, ...analysis.evidence, ['시장 상태', regime.available ? `${regime.overall} (양호 ${regime.counts.favorable} · 부담 ${regime.counts.burden})` : '—']]) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
  const more = el(doc, 'details', null, 'chart-evidence-more');
  more.append(el(doc, 'summary', `근거 전체 (${analysis.evidence.length + 3}개)`), list);
  panel.replaceChildren(read, visuals, more);
  const forward = buildChartScenarios(analysis);
  if (forward.available) {
    const section = el(doc, 'section', null, 'chart-scenarios');
    section.append(el(doc, 'h3', '앞으로 구분할 세 가지 흐름', 'briefing-h2'));
    section.append(el(doc, 'p', `${forward.asOf} 완료 봉의 가격 구조 기준 · 조건이 성립했을 때의 해석입니다.`, 'theme-strength-basis'));
    for (const scenario of forward.scenarios) {
      const card = el(doc, 'div', null, 'chart-scenario'); card.dataset.scenario = scenario.id;
      card.append(el(doc, 'h4', scenario.title), el(doc, 'p', scenario.text)); section.append(card);
    }
    panel.append(section);
  }
  const profile = buildVolumeByPrice(analysis.bars);
  if (profile.available) {
    const section = el(doc, 'section', null, 'chart-volume-profile');
    section.append(el(doc, 'h3', '거래 집중 가격대 · 일봉 추정', 'briefing-h2'));
    section.append(el(doc, 'p', `${profile.start}~${profile.end} · ${profile.sessions}거래일`, 'theme-strength-basis'));
    const max = Math.max(...profile.zones.map(zone => zone.volume));
    for (const zone of profile.zones) {
      const row = el(doc, 'div', null, 'chart-volume-zone');
      row.append(el(doc, 'span', kr ? `${Math.round(zone.low).toLocaleString('ko-KR')}~${Math.round(zone.high).toLocaleString('ko-KR')}원` : `$${zone.low.toFixed(2)}~$${zone.high.toFixed(2)}`));
      const track = el(doc, 'span', null, 'chart-volume-track'), bar = el(doc, 'span'); bar.style.width = `${zone.volume / max * 100}%`; track.append(bar);
      row.append(track, el(doc, 'span', `${zone.share.toFixed(1)}%`)); section.append(row);
    }
    section.append(el(doc, 'p', '일별 거래량을 그날 저가~고가 범위에 균등 배분한 참고 분포입니다. 실제 가격별 체결량·보유자의 매입단가·매수/매도 우위를 보여주지는 않습니다. 구간은 관찰할 가격대이며 지지·저항을 보장하지 않습니다.', 'theme-strength-basis'));
    panel.append(section);
  }
  const logic = el(doc, 'details', null, 'chart-analysis-logic');
  logic.append(el(doc, 'summary', '차트를 읽는 순서와 계산 기준'));
  logic.append(el(doc, 'p', '① 완료된 일봉과 30주선으로 큰 추세를 확인합니다. ② 8·21·50·200일선과 수축 고점/저점으로 현재 가격 구조를 읽습니다. ③ 상승·하락일 거래량과 평균 거래량 대비로 참여를 확인합니다. ④ 같은 시장 지수의 동일 기간 수익률과 비교합니다. ⑤ 가격이 관찰 구간 위·안·아래로 움직일 때 해석을 갱신합니다. 지표 하나만으로 미래 방향을 확정하지 않습니다.'));
  panel.append(logic);
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

// P1634: one chart, eight bar intervals. The setup analysis (VCP, pivot, trend template) is defined on
// daily bars and stays there; other intervals show candles, moving averages, volume and their own
// short/long moving-average order. Yahoo has no 4-hour bars, so up to four 1-hour bars of the same
// exchange day are combined.
export const CHART_INTERVALS = Object.freeze([
  { id: '5m', label: '5분', interval: '5m', range: '5d', intraday: true },
  { id: '15m', label: '15분', interval: '15m', range: '1mo', intraday: true },
  { id: '30m', label: '30분', interval: '30m', range: '1mo', intraday: true },
  { id: '1h', label: '1시간', interval: '1h', range: '3mo', intraday: true },
  { id: '4h', label: '4시간', interval: '1h', range: '1y', intraday: true, group: 4 },
  { id: '1d', label: '일', interval: '1d', range: '2y' },
  { id: '1wk', label: '주', interval: '1wk', range: '10y' },
  { id: '1mo', label: '월', interval: '1mo', range: 'max' }
]);
export const intervalSpec = (id) => CHART_INTERVALS.find((spec) => spec.id === id) || CHART_INTERVALS[5];

function zoneOffsetSeconds(epochSeconds, zone) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(epochSeconds * 1000)).map((part) => [part.type, part.value]));
    return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) / 1000) - epochSeconds;
  } catch (_) { return 0; }
}

export function intervalBars(payload, spec) {
  if (!payload || !Array.isArray(payload.timestamps)) return [];
  const zone = payload.meta?.exchangeTimezoneName || 'America/New_York';
  const raw = payload.timestamps.map((ts, i) => ({ ts, open: payload.opens?.[i], high: payload.highs?.[i], low: payload.lows?.[i], close: payload.closes?.[i], volume: payload.volumes?.[i] || 0 }))
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0));
  // Intraday times are shifted to exchange-local wall time because the chart library renders UTC.
  const timeOf = (ts) => spec.intraday ? ts + zoneOffsetSeconds(ts, zone) : new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: zone });
  const dayOf = (ts) => new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: zone });
  const buckets = new Map(); const dayIndex = new Map();
  for (const bar of raw) {
    let key = timeOf(bar.ts);
    if (spec.group) { const day = dayOf(bar.ts); const index = dayIndex.get(day) || 0; dayIndex.set(day, index + 1); key = `${day}:${Math.floor(index / spec.group)}`; }
    const bucket = buckets.get(key);
    if (!bucket || !spec.group) buckets.set(key, { time: bucket?.time ?? timeOf(bar.ts), open: bucket?.open ?? bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    else { bucket.high = Math.max(bucket.high, bar.high); bucket.low = Math.min(bucket.low, bar.low); bucket.close = bar.close; bucket.volume += bar.volume; }
  }
  return [...buckets.values()].sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
}

const smaOf = (values, n) => values.map((_, i) => i + 1 >= n ? values.slice(i + 1 - n, i + 1).reduce((sum, v) => sum + v, 0) / n : null);

// 단기 = 종가>5>10>20, 장기 = 20>50>100>200 (owner 2026-10-12), on whatever bars are shown.
export function intervalStructure(bars) {
  const closes = bars.map((bar) => bar.close);
  const last = (n) => smaOf(closes, n).at(-1) ?? null;
  const order = (values) => ({ up: '정배열', down: '역배열', mixed: '혼조' })[maOrder(values)] ?? null;
  return { short: order([closes.at(-1), last(5), last(10), last(20)]), long: order([last(20), last(50), last(100), last(200)]) };
}

async function renderIntervalChart({ doc, root, sym, spec, ticket }) {
  const kr = /\.(KS|KQ)$/.test(sym);
  const host = doc.getElementById('stock-chart-canvas');
  const panel = doc.getElementById('stock-chart-evidence');
  const set = (id, value) => { const node = doc.getElementById(id); if (node) node.textContent = value; return node; };
  set('stock-chart-status', '불러오는 중…');
  root.__aioStockChartAnalysis = null;
  panel.replaceChildren(fullRow(emptyState(doc, { title: `${sym} ${spec.label}봉을 불러오는 중입니다`, reason: '시세 제공처에서 봉 데이터를 받아오는 중입니다.', compact: true })));
  const library = ensureChartLibrary(root);
  const payload = await Promise.resolve().then(() => root._aioFetchYahooChartData?.(sym, spec.range, spec.interval)).catch(() => null);
  await library;
  if (ticket !== root.__aioStockChartTicket) return null;
  const bars = intervalBars(payload, spec);
  if (root.__aioStockChartInstance?.chart) { try { root.__aioStockChartInstance.chart.remove(); } catch (_) {} }
  root.__aioStockChartInstance = null;
  host.replaceChildren();
  const badge = doc.getElementById('stock-chart-state');
  if (badge) { badge.textContent = `${spec.label}봉`; badge.className = 'regime-state is-neutral'; }
  doc.getElementById('stock-chart-section')?.setAttribute('data-symbol', sym);
  if (bars.length < 2) {
    set('stock-chart-status', '');
    panel.replaceChildren(emptyState(doc, { title: `${sym} ${spec.label}봉을 받아오지 못했습니다`, reason: payload == null ? '시세 제공처나 중계 서버가 응답하지 않았습니다.' : '이 주기의 봉 데이터가 없습니다.', action: { label: '다시 시도', onClick: () => renderStockChart({ documentRef: doc, root, symbol: sym, interval: spec.id }) } }));
    setChartEmpty(doc, true);
    return null;
  }
  setChartEmpty(doc, false);
  const LWC = root.LightweightCharts;
  if (!LWC?.createChart) { host.append(el(doc, 'div', '차트 라이브러리를 불러오지 못했습니다.', 'briefing-empty')); return null; }
  const text = cssVar(root, '--text-secondary', '#57513f');
  const grid = cssVar(root, '--border-subtle', '#e6e0d4');
  const up = cssVar(root, '--candle-up', '#d23f35');
  const down = cssVar(root, '--candle-down', '#2a64c8');
  const chart = LWC.createChart(host, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit', fontSize: 12 },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderColor: grid, rightOffset: 4, barSpacing: 7, minBarSpacing: 3, timeVisible: !!spec.intraday, secondsVisible: false, ...(spec.intraday ? {} : { tickMarkFormatter: dayTickFormatter }) },
    crosshair: { mode: 0 },
    localization: chartLocalization(kr)
  });
  const candles = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
  candles.setData(bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  const closes = bars.map((bar) => bar.close);
  const maColors = { 5: '#d4862a', 20: '#3b6fb6', 60: '#2f9e8f', 120: '#8a4fa3' };
  for (const n of [5, 20, 60, 120]) {
    if (bars.length < n) continue;
    const values = smaOf(closes, n);
    chart.addLineSeries({ color: maColors[n], lineWidth: n >= 60 ? 1.5 : 1.2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      .setData(bars.map((bar, i) => values[i] == null ? null : { time: bar.time, value: values[i] }).filter(Boolean));
  }
  const volume = chart.addHistogramSeries({ priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  volume.setData(bars.map((bar) => ({ time: bar.time, value: bar.volume || 0, color: bar.close >= bar.open ? 'rgba(210,63,53,0.35)' : 'rgba(42,100,200,0.35)' })));
  const showRecent = () => chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 130), to: bars.length + 3 });
  showRecent();
  (root.requestAnimationFrame || setTimeout)(showRecent);
  root.__aioStockChartInstance = { chart, applyTheme: (palette) => {
    chart.applyOptions({ layout: { textColor: palette.text }, grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } } });
    candles.applyOptions({ upColor: palette.up, downColor: palette.down, borderUpColor: palette.up, borderDownColor: palette.down, wickUpColor: palette.up, wickDownColor: palette.down });
  } };
  const lastBar = bars.at(-1), prevBar = bars.at(-2);
  const change = (lastBar.close / prevBar.close - 1) * 100;
  const stamp = spec.intraday ? new Date(lastBar.time * 1000).toISOString().slice(0, 16).replace('T', ' ') : lastBar.time;
  set('stock-chart-status', `${stamp}${spec.intraday ? ' 거래소 현지 시각' : ''} ${formatScreenerPrice(lastBar.close, kr ? 'KRW' : payload?.meta?.currency || null)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}% · 직전 봉 대비)`);
  const structure = intervalStructure(bars);
  const read = el(doc, 'div', null, 'chart-read');
  read.append(el(doc, 'p', `${spec.label}봉 기준 단기 이동평균(종가>5>10>20)은 ${structure.short || '계산 불가'}, 장기(20>50>100>200)는 ${structure.long || '기록 부족'}입니다.`, 'chart-read-headline'));
  read.append(el(doc, 'p', `${bars.length}개 봉 · 이동평균 5·20·60·120 · 거래량. ${spec.intraday ? '분·시간봉은 정규장 기준이며 마지막 봉은 아직 진행 중일 수 있습니다. 짧은 주기일수록 잡음이 크므로 일봉 추세와 같은 방향인지 함께 봅니다.' : '주·월봉은 큰 추세를 확인하는 용도이며 마지막 봉은 기간이 끝나기 전까지 바뀝니다.'}`, 'stock-chart-interval-note'));
  read.append(el(doc, 'p', '피벗·변동성 수축·추세 템플릿 판정은 일봉 기준으로만 계산합니다.', 'stock-chart-interval-note'));
  const toDaily = el(doc, 'button', '일봉 셋업 분석 보기', 'aio-btn-table');
  toDaily.type = 'button';
  toDaily.addEventListener('click', () => renderStockChart({ documentRef: doc, root, symbol: sym, interval: '1d' }));
  read.append(toDaily);
  panel.replaceChildren(read);
  return { interval: spec.id, bars: bars.length, structure };
}

function renderIntervalButtons(doc, root, sym, active) {
  const head = doc.querySelector('#stock-chart-section .stock-chart-head');
  if (!head) return;
  let group = doc.getElementById('stock-chart-intervals');
  if (!group) {
    group = el(doc, 'div', null, 'stock-chart-intervals');
    group.id = 'stock-chart-intervals';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '봉 주기');
    head.insertAdjacentElement('afterend', group);
  }
  group.replaceChildren(...CHART_INTERVALS.map((spec) => {
    const button = el(doc, 'button', spec.label);
    button.type = 'button';
    button.dataset.interval = spec.id;
    button.setAttribute('aria-pressed', String(spec.id === active));
    button.addEventListener('click', () => renderStockChart({ documentRef: doc, root, symbol: sym, interval: spec.id }));
    return button;
  }));
  const legend = doc.querySelector('#stock-chart-section .stock-chart-legend');
  if (legend) {
    if (!legend.__aioDailyLegend) legend.__aioDailyLegend = [...legend.childNodes].map((node) => node.cloneNode(true));
    if (active === '1d') legend.replaceChildren(...legend.__aioDailyLegend.map((node) => node.cloneNode(true)));
    else legend.replaceChildren(el(doc, 'span', '━ 5 · 20 · 60 · 120 이동평균'), el(doc, 'span', '아래 막대는 거래량 · 상승 빨강, 하락 파랑'));
  }
}

// P1405/P1430: the chart follows the 종목 screen's company (root._aioLastOpenedSymbol, display-only); an index card on
// 오늘 (root._aioChartRequest) opens a market chart without changing the company.
// v57.76: the tab's own ticker form (SPY/QQQ chips + input) was retired — the 종목 search drives the chart through
// aio:subjectChanged, and the install state lives on #stock-chart-section.
export function installStockChart({ documentRef: doc, root }) {
  const section = doc.getElementById('stock-chart-section');
  if (!section) return;
  // E06: the chart uses the same symbol normalization as the 종목 summary (005930 / 삼성전자 → 005930.KS).
  const normalize = (value) => normalizeTickerInput(value, { krStockDb: root?.KR_STOCK_DB || {}, krToYahoo: root?.krTickerToYahoo }) || '';
  const historyMark = () => { const rows = root?._aioHistory; return Array.isArray(rows) && rows.length ? String(rows[rows.length - 1]?.date || '') : ''; };
  const show = (value) => {
    const sym = normalize(value) || 'SPY';
    section.dataset.aioStockChartEntity = sym;
    section.dataset.aioStockChartAt = String(Date.now());
    section.dataset.aioStockChartMark = historyMark();
    renderStockChart({ documentRef: doc, root, symbol: sym });
  };
  const request = String(root._aioChartRequest || '').trim().toUpperCase();
  root._aioChartRequest = null;
  const entity = String(root._aioLastOpenedSymbol || '').trim().toUpperCase();
  const target = normalize(request || entity || section.dataset.aioStockChartEntity || '') || 'SPY';
  if (section.dataset.aioStockChart === 'installed') {
    // E04: re-entering with the same symbol redraws when a new close arrived or the chart is older than 5 minutes.
    const age = Date.now() - Number(section.dataset.aioStockChartAt || 0);
    if (target !== section.dataset.aioStockChartEntity || age > 5 * 60 * 1000 || historyMark() !== (section.dataset.aioStockChartMark || '')) show(target);
    return;
  }
  section.dataset.aioStockChart = 'installed';
  doc.addEventListener?.('aio:subjectChanged', () => {
    if (!doc.getElementById?.('page-technical')?.classList?.contains('active')) return;
    const subject = String(root._aioLastOpenedSymbol || '').trim().toUpperCase();
    if (subject && subject !== section.dataset.aioStockChartEntity) show(subject);
  });
  show(target);
}

// P1430: 오늘's S&P 500 / 나스닥 cards open the index chart they show, not the last company.
export function openMarketChart(root, symbol) {
  root._aioChartRequest = String(symbol || 'SPY').toUpperCase();
  if (typeof root.showPage === 'function') root.showPage('technical');
}
