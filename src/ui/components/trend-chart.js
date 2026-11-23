import { monthLabel, shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';
import { isIsoDay } from '../../domain/shared/session-date.js';
const SVG = 'http://www.w3.org/2000/svg';
const DEFAULT_W = 520;
const DEFAULT_H = 210;
const PAD = { top: 14, right: 16, bottom: 30, left: 48 };
const MIN_MONTH_LABEL_SPACING = 42;
const MONTH_MS = 30.4 * 86400000;

function svgEl(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function niceStep(range, target = 4) {
  const raw = range / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function threeTickStep(lo, hi) {
  let step = niceStep(hi - lo, 2);
  for (let guard = 0; guard < 8 && Math.ceil(hi / step - 1e-9) - Math.floor(lo / step + 1e-9) > 2; guard += 1) step = niceStep(step * 1.01, 1);
  return step;
}

function datedShort(date) {
  const text = String(date || '').slice(0, 10);
  return isIsoDay(text) ? `${text.slice(2, 4)}.${text.slice(5, 7)}.${text.slice(8, 10)}` : '';
}

/**
 * @param {Document} doc
 * @param {{ series: Array<{date:string,value:number}>, refLines?: number[], format?: (v:number)=>string, label?: string, domain?: [number, number], range?: [string, string], spans?: Array<{start:string,end:string,tone:string}> }} options
 */
export function createTrendChart(doc, options = {}) {
  const { series = [], refLines = [], format = (value) => value.toFixed(1), label = '', domain = null, range = null, spans = [], guide = null, longGuide = null, width = DEFAULT_W, refLabel = null, marks = [] } = options;
  const H = Math.max(120, Math.round(options.height) || DEFAULT_H);
  const refText = (ref) => (typeof refLabel === 'function' ? refLabel(ref) : format(ref).replace(/(\d)\.0+(?!\d)/, '$1'));
  const W = Math.max(320, Math.round(width) || DEFAULT_W);
  const wrap = doc.createElement('div');
  wrap.className = 'trend-chart-wrap';
  const svg = svgEl(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend-chart', role: 'img' });
  if (W !== DEFAULT_W || H !== DEFAULT_H) { svg.style.aspectRatio = `${W} / ${H}`; svg.setAttribute('class', 'trend-chart is-actual-size'); }
  wrap.append(svg);
  const dayMs = (date) => Date.parse(`${date}T12:00:00Z`);
  const start = range?.[0] || series[0]?.date;
  const end = range?.[1] || series[series.length - 1]?.date;
  const points = series.filter((point) => Number.isFinite(point?.value) && point.date >= start && point.date <= end);
  if (points.length < 2) {
    svg.setAttribute('aria-label', `${label} 추이 기록 부족`);
    const text = svgEl(doc, 'text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'trend-chart-empty' });
    text.textContent = '추이 기록 수집 중';
    svg.append(text);
    return wrap;
  }
  const guidePoints = (guide?.series || []).filter((point) => Number.isFinite(point?.value) && point.date >= start && point.date <= end);
  const guideAt = new Map(guidePoints.map((point) => [point.date, point.value]));
  // A second, fainter reference line (the 200-day line); it carries no tag in the plot — the caller names it beside the chart.
  const longPoints = (longGuide?.series || []).filter((point) => Number.isFinite(point?.value) && point.date >= start && point.date <= end);
  const values = [...points.map((point) => point.value), ...guidePoints.map((point) => point.value), ...longPoints.map((point) => point.value)];
  let lo = domain ? domain[0] : Math.min(...values, ...refLines);
  let hi = domain ? domain[1] : Math.max(...values, ...refLines);
  if (hi === lo) { hi += 1; lo -= 1; }
  const step = domain ? (domain[1] - domain[0]) / 2 : threeTickStep(lo, hi);
  lo = domain ? domain[0] : Math.floor(lo / step + 1e-9) * step;
  hi = domain ? domain[1] : Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let tick = lo; tick <= hi + step / 1000; tick += step) ticks.push(tick);
  const tickLabels = ticks.map((tick) => format(tick));
  const trimmed = tickLabels.every((text) => /\d\.0+(?!\d)/.test(text)) ? tickLabels.map((text) => text.replace(/(\d)\.0+(?!\d)/, '$1')) : tickLabels;
  const textUnits = (text) => [...String(text)].reduce((sum, ch) => sum + (/[가-힣]/.test(ch) ? 12.5 : 7.2), 0);
  const axisTexts = [...trimmed, ...refLines.filter((ref) => Number.isFinite(ref) && ref >= lo && ref <= hi).map(refText)];
  const padLeft = Math.max(PAD.left, Math.ceil(Math.max(...axisTexts.map(textUnits)) + 8));
  const plotW = W - padLeft - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const t0 = dayMs(start);
  const span = Math.max(1, dayMs(end) - t0);
  const xd = (date) => padLeft + ((dayMs(date) - t0) / span) * plotW;
  const x = (index) => xd(points[index].date);
  const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * plotH;
  // Run-5 (skeptic #14): thresholds are named in the value-axis column (a tag at the plot's right edge sat on the line's last
  // point whenever the line ended inside the band); a tick label too close to one gives way, its gridline stays.
  const axisRefs = refLines.filter((ref) => Number.isFinite(ref) && ref >= lo && ref <= hi && !ticks.some((tick) => Math.abs(tick - ref) < step / 1000));
  const LABEL_GAP = 24; // viewBox units: a 13px label still clears its neighbour when a card draws the chart at ~0.55 scale
  ticks.forEach((tick, index) => {
    svg.append(svgEl(doc, 'line', { x1: padLeft, x2: W - PAD.right, y1: y(tick), y2: y(tick), class: 'trend-chart-grid' }));
    if (axisRefs.some((ref) => Math.abs(y(ref) - y(tick)) < LABEL_GAP)) return;
    const text = svgEl(doc, 'text', { x: padLeft - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'trend-chart-axis' });
    text.textContent = trimmed[index];
    svg.append(text);
  });
  // X axis: one tick on the first day of each month.
  svg.append(svgEl(doc, 'line', { x1: padLeft, x2: W - PAD.right, y1: PAD.top + plotH, y2: PAD.top + plotH, class: 'trend-chart-baseline' }));
  const months = span / MONTH_MS;
  const labelEvery = [1, 2, 3, 4, 6, 12].find((k) => (plotW * MONTH_MS / span) * k >= MIN_MONTH_LABEL_SPACING && months / k <= 3) || 12;
  const first = new Date(t0);
  if (months < 2) {
    // Distinct observation days only: two points used to label the second day twice.
    for (const index of [...new Set([0.2, 0.5, 0.8].map((share) => Math.round((points.length - 1) * share)))]) {
      const point = points[index];
      const xm = xd(point.date);
      svg.append(svgEl(doc, 'line', { x1: xm, x2: xm, y1: PAD.top + plotH, y2: PAD.top + plotH + 4, class: 'trend-chart-baseline' }));
      const text = svgEl(doc, 'text', { x: xm, y: H - 8, 'text-anchor': 'middle', class: 'trend-chart-axis' });
      text.textContent = `${Number(point.date.slice(5, 7))}/${Number(point.date.slice(8, 10))}`;
      svg.append(text);
    }
  }
  for (let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1); months >= 2 && cursor <= t0 + span; cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1)) {
    const month = new Date(cursor).toISOString().slice(0, 7);
    const xm = xd(`${month}-01`);
    if (xm < padLeft + 12 || xm > W - PAD.right - 20) continue;
    const m = Number(month.slice(5, 7));
    if ((m - 1) % labelEvery !== 0) continue;
    svg.append(svgEl(doc, 'line', { x1: xm, x2: xm, y1: PAD.top + plotH, y2: PAD.top + plotH + 4, class: 'trend-chart-baseline' }));
    const text = svgEl(doc, 'text', { x: xm, y: H - 8, 'text-anchor': 'middle', class: 'trend-chart-axis' });
    text.textContent = m === 1 ? monthLabel(month) : `${m}월`;
    svg.append(text);
  }
  const shownRefs = refLines.filter((ref) => Number.isFinite(ref) && ref >= lo && ref <= hi);
  if (shownRefs.length >= 2) {
    const top = y(Math.max(...shownRefs)), bottom = y(Math.min(...shownRefs));
    svg.append(svgEl(doc, 'rect', { x: padLeft, y: top.toFixed(1), width: plotW, height: Math.max(2, bottom - top).toFixed(1), rx: 6, class: 'trend-chart-band' }));
  }
  for (const ref of shownRefs) svg.append(svgEl(doc, 'line', { x1: padLeft, x2: W - PAD.right, y1: y(ref), y2: y(ref), class: shownRefs.length >= 2 ? 'trend-chart-ref is-band-edge' : 'trend-chart-ref' }));
  for (const ref of shownRefs) {
    if (ticks.some((tick) => Math.abs(tick - ref) < step / 1000)) continue;
    // Two thresholds too close for the axis column: the upper one keeps the right-edge tag.
    const crowded = shownRefs.some((other) => other !== ref && other < ref && Math.abs(y(other) - y(ref)) < LABEL_GAP);
    const tag = svgEl(doc, 'text', !crowded ? { x: padLeft - 8, y: (y(ref) + 4).toFixed(1), 'text-anchor': 'end', class: 'trend-chart-ref-label' }
      : { x: W - PAD.right - 2, y: (y(ref) - 3).toFixed(1), 'text-anchor': 'end', class: 'trend-chart-ref-label' });
    tag.textContent = refText(ref);
    svg.append(tag);
  }
  const firstX = x(0);
  if (firstX - padLeft > 24) {
    svg.append(svgEl(doc, 'rect', { x: padLeft, y: PAD.top, width: (firstX - padLeft).toFixed(1), height: plotH, class: 'trend-chart-nodata' }));
    if (firstX - padLeft >= 60) {
      const note = svgEl(doc, 'text', { x: ((padLeft + firstX) / 2).toFixed(1), y: PAD.top + plotH / 2, 'text-anchor': 'middle', class: 'trend-chart-empty' });
      note.textContent = '기록 이전';
      svg.append(note);
    }
  }
  for (const span of spans) {
    if (!span?.start || !span?.end || span.end < start || span.start > end) continue;
    const x0 = xd(span.start < start ? start : span.start);
    const x1 = Math.max(x0 + 2, xd(span.end > end ? end : span.end));
    svg.append(svgEl(doc, 'rect', { x: x0.toFixed(1), y: PAD.top, width: (x1 - x0).toFixed(1), height: plotH, class: `trend-chart-span is-${span.tone}` }));
  }
  if (longPoints.length > 1) svg.append(svgEl(doc, 'path', { d: longPoints.map((point, index) => `${index ? 'L' : 'M'}${xd(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(' '), class: 'trend-chart-guide is-long' }));
  if (guidePoints.length > 1) {
    svg.append(svgEl(doc, 'path', { d: guidePoints.map((point, index) => `${index ? 'L' : 'M'}${xd(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(' '), class: 'trend-chart-guide' }));
    const tail = guidePoints[guidePoints.length - 1];
    const tagW = textUnits(guide.label || '') + 4;
    const priceAt = new Map(points.map((point) => [point.date, point.value]));
    const box = (cx, baseline) => points.reduce((n, point, index) => {
      const px = x(index); const py = y(point.value);
      return n + (px > cx - tagW / 2 && px < cx + tagW / 2 && py > baseline - 14 && py < baseline + 4 ? 1 : 0);
    }, 0);
    const half = padLeft + plotW / 2;
    let best = null;
    for (let i = guidePoints.length - 1; i >= 0; i -= 3) {
      const point = guidePoints[i];
      const cx = Math.min(W - PAD.right - tagW / 2, xd(point.date));
      if (cx < half) break;
      const gy = y(point.value);
      const priceY = priceAt.has(point.date) ? y(priceAt.get(point.date)) : gy;
      const baseline = priceY < gy ? gy + 13 : gy - 5; // price above the guide → tag below it, and the other way
      if (baseline - 12 < PAD.top || baseline > H - PAD.bottom) continue;
      const hits = box(cx, baseline);
      if (!best || hits < best.hits) best = { cx, baseline, hits };
      if (hits === 0) break;
    }
    const tagX = best ? best.cx : W - PAD.right - tagW / 2;
    const tagY = best ? best.baseline : y(tail.value) - 5;
    const tag = svgEl(doc, 'text', { x: tagX.toFixed(1), y: tagY.toFixed(1), 'text-anchor': 'middle', class: 'trend-chart-ref-label' });
    tag.textContent = guide.label || '';
    svg.append(tag);
  }
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  svg.append(svgEl(doc, 'path', { d: line, class: 'trend-chart-line' }));
  // A named point: a dot on the line and its label beside it, toward the plot's middle, above a high and below a low.
  for (const mark of marks) {
    if (!Number.isFinite(mark?.value) || !(mark.date >= start && mark.date <= end) || !(mark.value >= lo && mark.value <= hi)) continue;
    const mx = xd(mark.date);
    const my = y(mark.value);
    svg.append(svgEl(doc, 'circle', { cx: mx.toFixed(1), cy: my.toFixed(1), r: 3, class: 'trend-chart-dot' }));
    const left = mx > padLeft + plotW / 2;
    const ty = Math.min(Math.max(mark.side === 'below' ? my + 14 : my - 4, PAD.top + 10), PAD.top + plotH - 2);
    const tag = svgEl(doc, 'text', { x: (left ? mx - 6 : mx + 6).toFixed(1), y: ty.toFixed(1), 'text-anchor': left ? 'end' : 'start', class: 'trend-chart-ref-label' });
    tag.textContent = mark.label || format(mark.value);
    svg.append(tag);
  }
  const last = points[points.length - 1];
  svg.append(svgEl(doc, 'circle', { cx: x(points.length - 1), cy: y(last.value), r: 3.5, class: 'trend-chart-dot' }));

  // Hover readout.
  const cursor = svgEl(doc, 'line', { x1: 0, x2: 0, y1: PAD.top, y2: PAD.top + plotH, class: 'trend-chart-cursor', visibility: 'hidden' });
  const marker = svgEl(doc, 'circle', { r: 4, class: 'trend-chart-dot', visibility: 'hidden' });
  svg.append(cursor, marker);
  const tip = doc.createElement('div');
  tip.className = 'trend-chart-tip';
  tip.hidden = true;
  wrap.append(tip);
  const overlay = svgEl(doc, 'rect', { x: padLeft, y: PAD.top, width: plotW, height: plotH, fill: 'transparent' });
  svg.append(overlay);
  const show = (event) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const vx = ((event.clientX - box.left) / box.width) * W;
    const target = t0 + ((vx - padLeft) / plotW) * span;
    let index = 0;
    for (let i = 1; i < points.length; i += 1) if (Math.abs(dayMs(points[i].date) - target) < Math.abs(dayMs(points[index].date) - target)) index = i;
    const point = points[index];
    cursor.setAttribute('x1', x(index)); cursor.setAttribute('x2', x(index)); cursor.setAttribute('visibility', 'visible');
    marker.setAttribute('cx', x(index)); marker.setAttribute('cy', y(point.value)); marker.setAttribute('visibility', 'visible');
    tip.textContent = `${shortDate(point.date)}, ${format(point.value)}${guideAt.has(point.date) ? `, ${guide.label} ${format(guideAt.get(point.date))}` : ''}`;
    tip.hidden = false;
    const left = (x(index) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(left, 40), box.width - 40)}px`;
    tip.style.top = `${(y(point.value) / H) * box.height - 30}px`;
  };
  const hide = () => { cursor.setAttribute('visibility', 'hidden'); marker.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  overlay.style.touchAction = 'pan-y';
  svg.style.touchAction = 'pan-y';
  overlay.addEventListener('pointerdown', show);
  overlay.addEventListener('pointermove', show);
  overlay.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') hide(); });
  overlay.addEventListener('pointercancel', hide);
  svg.setAttribute('aria-label', `${label} ${datedShort(points[0].date)}~${datedShort(last.date)} 추이, 최근 ${format(last.value)}${guideAt.has(last.date) ? `, ${guide.label} ${format(guideAt.get(last.date))}` : ''}`);
  if (!options.width) {
    const view = doc.defaultView;
    view?.requestAnimationFrame?.(() => {
      const real = wrap.isConnected ? Math.round(wrap.clientWidth) : 0;
      if (!(real > 0 && Math.abs(real - W) / W > 0.15)) return;
      const next = createTrendChart(doc, { ...options, width: real });
      next.className = wrap.className; // classes a caller added (is-up/is-down) carry over
      wrap.replaceWith(next);
    });
  }
  return wrap;
}

// Change over n observations, as a signed string in the indicator's own unit.
export function seriesChange(series, n, unit = '%p', digits = 1) {
  const points = series.filter((point) => Number.isFinite(point?.value));
  if (points.length <= n) return null;
  const delta = points[points.length - 1].value - points[points.length - 1 - n].value;
  return signedText(delta, digits, unit);
}
