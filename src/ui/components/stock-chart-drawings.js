// v58.79 (owner 2026-10-25): drawings on the daily chart — rule trendlines, anchored VWAP and the user's own horizontal
// lines — behind one toggle row under the interval buttons. The rule lines come from domain/technical/chart-drawings.js;
// the user's lines stay on this device (storage gateway) and feed the plan check below the chart, which reads them
// against the price-level map. Nothing drawn here is a proposed entry, stop or target (R724).
import { ruleTrendLines, anchoredVwap, vwapAnchors, nearestMappedLevel, DRAWING_RULES } from '../../domain/technical/chart-drawings.js';
import { createStorageGateway } from '../../platform/storage.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';

const PREF_KEY = 'chart-drawing-pref-v1';
const LINES_KEY = 'chart-my-lines-v1';
const MAX_LINES = 8;
const COLORS = { support: '#2f8f5b', resistance: '#c2571a', avwap: '#8e7cc3', mine: '#d9a400' };
const storage = createStorageGateway();
const readJson = (key, fallback) => { try { return JSON.parse(storage.get(key, '') || 'null') ?? fallback; } catch (_) { return fallback; } };
const writeJson = (key, value) => storage.set(key, JSON.stringify(value));

export function readMyLines(sym) {
  const all = readJson(LINES_KEY, {});
  const list = Array.isArray(all?.[sym]) ? all[sym] : [];
  return list.map(Number).filter((price) => Number.isFinite(price) && price > 0).slice(0, MAX_LINES);
}
function saveMyLines(sym, prices) {
  const all = readJson(LINES_KEY, {}) || {};
  if (prices.length) all[sym] = prices.slice(0, MAX_LINES); else delete all[sym];
  writeJson(LINES_KEY, all);
}

/** One sentence per rule line, for the read under the toggles and the AI panel. */
export function trendLineText(line, price) {
  if (!line) return null;
  const word = line.side === 'support' ? '지지 추세선' : '저항 추세선';
  return `${word} ${price(line.value)}(현재가 대비 ${signedText(line.distancePct, 1, '%')}, 접점 ${line.touches}회${line.status === 'tentative' ? ', 잠정' : ''}, 주당 ${signedText(line.slopePctPerWeek, 2, '%')})`;
}

export function attachChartDrawings({ doc, root, sym, instance, analysis, levels, price }) {
  const head = doc.getElementById('stock-chart-intervals');
  doc.getElementById('stock-chart-draw')?.remove();
  if (!instance?.chart || !instance.candles || !head) return null;
  const { chart, candles } = instance;
  const bars = analysis.bars;
  const last = bars.length - 1;
  const pref = { trend: true, avwap: false, ...readJson(PREF_KEY, {}) };
  const trend = ruleTrendLines(bars);
  const anchors = vwapAnchors(bars);
  let trendSeries = [], vwapSeries = [], minePriceLines = [], drawing = false;
  let mine = readMyLines(sym);

  const lineSeries = (color, style, width = 1.5) => chart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  const clear = (list) => { list.forEach((series) => { try { chart.removeSeries(series); } catch (_) {} }); return []; };
  const drawTrend = () => {
    trendSeries = clear(trendSeries);
    if (!pref.trend || !trend.available) return;
    for (const line of [trend.support, trend.resistance].filter(Boolean)) {
      const series = lineSeries(COLORS[line.side], line.status === 'confirmed' ? 0 : 2);
      series.setData([{ time: bars[line.from.index].time, value: line.from.price }, { time: bars[last].time, value: line.value }]);
      trendSeries.push(series);
    }
  };
  const drawVwap = () => {
    vwapSeries = clear(vwapSeries);
    if (!pref.avwap) return;
    for (const anchor of anchors) {
      const values = anchoredVwap(bars, anchor.index);
      if (!values) continue;
      const series = chart.addLineSeries({ color: COLORS.avwap, lineWidth: 1, lineStyle: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: `AVWAP·${anchor.short || anchor.label}` }); // the 52주 고점 price line keeps its own name
      series.setData(bars.map((bar, k) => (values[k] == null ? null : { time: bar.time, value: values[k] })).filter(Boolean));
      vwapSeries.push(series);
    }
  };
  const drawMine = () => {
    minePriceLines.forEach((line) => { try { candles.removePriceLine(line); } catch (_) {} });
    minePriceLines = mine.map((value) => candles.createPriceLine({ price: value, color: COLORS.mine, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '내 선' }));
  };

  const row = el(doc, 'div', null, 'stock-chart-draw sx-seg');
  row.id = 'stock-chart-draw';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', '차트 작도');
  const toggle = (label, key, title, onChange) => {
    const button = el(doc, 'button', label);
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-pressed', String(!!pref[key]));
    button.addEventListener('click', () => { pref[key] = !pref[key]; button.setAttribute('aria-pressed', String(pref[key])); writeJson(PREF_KEY, { trend: pref.trend, avwap: pref.avwap }); onChange(); syncRead(); });
    return button;
  };
  const R = DRAWING_RULES;
  const trendButton = toggle('추세선', 'trend', `좌우 ${R.swingSpan}개 봉으로 확인된 스윙 저점 두 개(오르는 쪽)·고점 두 개(내리는 쪽)를 잇고, 그 뒤 종가가 일평균 변동폭의 ${R.breakAdr}배 넘게 뚫지 않은 선 중 접점이 가장 많은 것. 접점 ${R.confirmTouches}회 이상은 실선, 2회는 점선(잠정)`, drawTrend);
  const vwapButton = toggle('앵커 VWAP', 'avwap', '52주 고점, 6개월 저점, 최근 3개월의 가장 큰 갭(2% 이상)에서 시작한 거래량 가중 평균가 — 그날 이후 산 사람들의 평균 단가', drawVwap);
  const drawButton = el(doc, 'button', '내 선 긋기');
  drawButton.type = 'button';
  drawButton.title = '켜고 차트를 누르면 그 가격에 가로선을 긋습니다(최대 8개, 이 기기에만 저장). 아래 내 계획 점검이 이 선을 레벨 지도와 비교합니다';
  drawButton.setAttribute('aria-pressed', 'false');
  drawButton.addEventListener('click', () => { drawing = !drawing; drawButton.setAttribute('aria-pressed', String(drawing)); });
  const clearButton = el(doc, 'button', '내 선 지우기');
  clearButton.type = 'button';
  clearButton.addEventListener('click', () => { mine = []; saveMyLines(sym, mine); drawMine(); syncRead(); root.__aioMyLinesChanged?.(sym); });
  row.append(trendButton, vwapButton, drawButton, clearButton);
  const read = el(doc, 'p', null, 'stock-chart-draw-read');
  read.setAttribute('aria-live', 'polite');
  const syncRead = () => {
    clearButton.hidden = !mine.length;
    const parts = [];
    if (pref.trend) parts.push(...(trend.available ? [trendLineText(trend.support, price), trendLineText(trend.resistance, price)].filter(Boolean) : []));
    if (pref.trend && trend.available && !trend.support && !trend.resistance) parts.push('규칙에 맞는 추세선 없음(최근 1년 스윙 점 기준)');
    if (pref.avwap) parts.push(anchors.length ? `앵커 VWAP: ${anchors.map((anchor) => { const values = anchoredVwap(bars, anchor.index); const value = values?.[last]; return value ? `${anchor.label} ${price(value)}(${signedText((bars[last].close / value - 1) * 100, 1, '%')})` : null; }).filter(Boolean).join(', ')}` : '앵커 VWAP: 거래량 기록이 없어 계산하지 않음');
    read.textContent = parts.join(' · ');
    read.hidden = !parts.length;
  };
  head.insertAdjacentElement('afterend', row);
  row.insertAdjacentElement('afterend', read);

  chart.subscribeClick?.((param) => {
    if (!drawing || !param?.point) return;
    const value = candles.coordinateToPrice?.(param.point.y);
    if (!(value > 0)) return;
    const rounded = Number(value.toFixed(value >= 1000 ? 0 : 2));
    mine = [...mine, rounded].slice(-MAX_LINES);
    saveMyLines(sym, mine);
    drawMine();
    syncRead();
    root.__aioMyLinesChanged?.(sym);
  });
  drawTrend(); drawVwap(); drawMine(); syncRead();
  // The AI panel and the plan check read the same lines the chart draws.
  root.__aioChartDrawings = { symbol: sym, asOf: analysis.asOf, trend, anchors: anchors.map((anchor) => ({ ...anchor, value: anchoredVwap(bars, anchor.index)?.[last] ?? null })), mine: () => readMyLines(sym) };
  return { trend, anchors };
}

/** The user's lines read against the level map: nearest mapped level and distance, for the plan check. */
export function myLineFacts(sym, levels, price) {
  return readMyLines(sym).map((value) => {
    const near = nearestMappedLevel(levels, value);
    return { value, text: near ? `내 선 ${price(value)}: 현재가 대비 ${signedText(near.vsClose, 1, '%')}, 가장 가까운 레벨 ${price(near.level.price)}, 거리 ${signedText(near.pct, 1, '%')}${near.adrMultiple != null ? `(일평균 변동폭 ${near.adrMultiple.toFixed(1)}배)` : ''}` : `내 선 ${price(value)}` };
  });
}
