// P1395: one dependency-free time-series chart for the 시장 폭 / 투자 심리 boards. Owner review
// 2026-10-03: the first version stretched text (preserveAspectRatio="none") and had no axes. This
// one keeps a fixed aspect ratio, draws a labelled Y axis with gridlines, month ticks on the time
// axis, dashed reference lines, and a hover readout (date · value) so a change can be followed.
// P1399 (Codex review 2026-10-03): x is placed by calendar date, not array index. Charts shown side
// by side pass one `range`, so the same horizontal position is the same date on every card and a
// series whose record starts later begins later on the axis.
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';
const SVG = 'http://www.w3.org/2000/svg';
const W = 520;
const H = 210;
const PAD = { top: 14, right: 16, bottom: 30, left: 48 };
// P1529: the widest month label ("26년 1월" at 13px) is about 44 units; neighbours closer than this overlap.
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

// v58.53 개편 v2 (README 차트 규칙): at most three Y ticks — the next nice step up until the rounded range fits in two steps.
function threeTickStep(lo, hi) {
  let step = niceStep(hi - lo, 2);
  for (let guard = 0; guard < 8 && Math.ceil(hi / step - 1e-9) - Math.floor(lo / step + 1e-9) > 2; guard += 1) step = niceStep(step * 1.01, 1);
  return step;
}

function datedShort(date) {
  const text = String(date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text.slice(2, 4)}.${text.slice(5, 7)}.${text.slice(8, 10)}` : '';
}

/**
 * @param {Document} doc
 * @param {{ series: Array<{date:string,value:number}>, refLines?: number[], format?: (v:number)=>string, label?: string, domain?: [number, number], range?: [string, string], spans?: Array<{start:string,end:string,tone:string}> }} options
 */
// v58.80 run-5 (skeptic #5): `guide` is a second, dashed series the reading is measured against (the 50-day line under
// the S&P 500 close); it sets the scale with the line, names itself at its right end and joins the hover readout.
export function createTrendChart(doc, { series = [], refLines = [], format = (value) => value.toFixed(1), label = '', domain = null, range = null, spans = [], guide = null } = {}) {
  const wrap = doc.createElement('div');
  wrap.className = 'trend-chart-wrap';
  const svg = svgEl(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend-chart', role: 'img' });
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
  const values = [...points.map((point) => point.value), ...guidePoints.map((point) => point.value)];
  let lo = domain ? domain[0] : Math.min(...values, ...refLines);
  let hi = domain ? domain[1] : Math.max(...values, ...refLines);
  if (hi === lo) { hi += 1; lo -= 1; }
  const step = domain ? (domain[1] - domain[0]) / 2 : threeTickStep(lo, hi);
  lo = domain ? domain[0] : Math.floor(lo / step + 1e-9) * step;
  hi = domain ? domain[1] : Math.ceil(hi / step - 1e-9) * step;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const t0 = dayMs(start);
  const span = Math.max(1, dayMs(end) - t0);
  const xd = (date) => PAD.left + ((dayMs(date) - t0) / span) * plotW;
  const x = (index) => xd(points[index].date);
  const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * plotH;

  // Y axis: gridlines + labels.
  // 2026-10-18 UI review: when every tick reads N.0 (100.0%, 25.0, 165.0엔) the decimal carries nothing — drop it.
  const ticks = [];
  for (let tick = lo; tick <= hi + step / 1000; tick += step) ticks.push(tick);
  const tickLabels = ticks.map((tick) => format(tick));
  const trimmed = tickLabels.every((text) => /\d\.0+(?!\d)/.test(text)) ? tickLabels.map((text) => text.replace(/(\d)\.0+(?!\d)/, '$1')) : tickLabels;
  // Run-5 (skeptic #14): thresholds are named in the value-axis column (a tag at the plot's right edge sat on the line's last
  // point whenever the line ended inside the band); a tick label too close to one gives way, its gridline stays.
  const axisRefs = refLines.filter((ref) => Number.isFinite(ref) && ref >= lo && ref <= hi && !ticks.some((tick) => Math.abs(tick - ref) < step / 1000));
  const LABEL_GAP = 24; // viewBox units: a 13px label still clears its neighbour when a card draws the chart at ~0.55 scale
  ticks.forEach((tick, index) => {
    svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(tick), y2: y(tick), class: 'trend-chart-grid' }));
    if (axisRefs.some((ref) => Math.abs(y(ref) - y(tick)) < LABEL_GAP)) return;
    const text = svgEl(doc, 'text', { x: PAD.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'trend-chart-axis' });
    text.textContent = trimmed[index];
    svg.append(text);
  });
  // X axis: one tick on the first day of each month.
  svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: PAD.top + plotH, y2: PAD.top + plotH, class: 'trend-chart-baseline' }));
  // Ticks stay monthly; labels are thinned to every k-th month with k dividing 12 so January is always labelled and the
  // widest label never collides with its neighbour. A growing range used to put "12월" and "26년 1월" on top of each other.
  // v58.53 개편 v2: at most three labelled months (README: 축 눈금 ≤3); only labelled months keep a tick mark.
  const months = span / MONTH_MS;
  const labelEvery = [1, 2, 3, 4, 6, 12].find((k) => (plotW * MONTH_MS / span) * k >= MIN_MONTH_LABEL_SPACING && months / k <= 3) || 12;
  const first = new Date(t0);
  for (let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1); cursor <= t0 + span; cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1)) {
    const month = new Date(cursor).toISOString().slice(0, 7);
    const xm = xd(`${month}-01`);
    if (xm < PAD.left + 12 || xm > W - PAD.right - 20) continue;
    const m = Number(month.slice(5, 7));
    if ((m - 1) % labelEvery !== 0) continue;
    svg.append(svgEl(doc, 'line', { x1: xm, x2: xm, y1: PAD.top + plotH, y2: PAD.top + plotH + 4, class: 'trend-chart-baseline' }));
    const text = svgEl(doc, 'text', { x: xm, y: H - 8, 'text-anchor': 'middle', class: 'trend-chart-axis' });
    text.textContent = m === 1 ? `${month.slice(2, 4)}년 1월` : `${m}월`;
    svg.append(text);
  }
  // Reference lines (thresholds). v58.53 개편 v2: two or more thresholds read as one soft band between the outer two
  // (radius 6, ink 5%) instead of dashed amber lines; a single threshold stays a quiet line.
  const shownRefs = refLines.filter((ref) => Number.isFinite(ref) && ref >= lo && ref <= hi);
  if (shownRefs.length >= 2) {
    const top = y(Math.max(...shownRefs)), bottom = y(Math.min(...shownRefs));
    svg.append(svgEl(doc, 'rect', { x: PAD.left, y: top.toFixed(1), width: plotW, height: Math.max(2, bottom - top).toFixed(1), rx: 6, class: 'trend-chart-band' }));
  }
  for (const ref of shownRefs) svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(ref), y2: y(ref), class: shownRefs.length >= 2 ? 'trend-chart-ref is-band-edge' : 'trend-chart-ref' }));
  // v58.79 (layout over captions): a threshold names its own value (axis column since run-5; right edge when crowded; halo so the line
  // stays readable under it), so a card label no longer spells "기준선 40%·60%" — unless it sits on a labelled gridline.
  for (const ref of shownRefs) {
    if (ticks.some((tick) => Math.abs(tick - ref) < step / 1000)) continue;
    // Two thresholds too close for the axis column: the upper one keeps the right-edge tag.
    const crowded = shownRefs.some((other) => other !== ref && other < ref && Math.abs(y(other) - y(ref)) < LABEL_GAP);
    const tag = svgEl(doc, 'text', !crowded ? { x: PAD.left - 8, y: (y(ref) + 4).toFixed(1), 'text-anchor': 'end', class: 'trend-chart-ref-label' }
      : { x: W - PAD.right - 2, y: (y(ref) - 3).toFixed(1), 'text-anchor': 'end', class: 'trend-chart-ref-label' });
    tag.textContent = format(ref).replace(/(\d)\.0+(?!\d)/, '$1');
    svg.append(tag);
  }
  // P1599 (M04/F46): a series that starts after the shared range marks the earlier span as 'no record yet',
  // so the empty left side reads as missing history rather than a rendering failure.
  const firstX = x(0);
  if (firstX - PAD.left > 24) {
    svg.append(svgEl(doc, 'rect', { x: PAD.left, y: PAD.top, width: (firstX - PAD.left).toFixed(1), height: plotH, class: 'trend-chart-nodata' }));
    const note = svgEl(doc, 'text', { x: ((PAD.left + firstX) / 2).toFixed(1), y: PAD.top + plotH / 2, 'text-anchor': 'middle', class: 'trend-chart-empty' });
    note.textContent = '기록 이전';
    svg.append(note);
  }
  // v57.54: shaded date spans behind the line (market temperature extremes); tone picks the class.
  for (const span of spans) {
    if (!span?.start || !span?.end || span.end < start || span.start > end) continue;
    const x0 = xd(span.start < start ? start : span.start);
    const x1 = Math.max(x0 + 2, xd(span.end > end ? end : span.end));
    svg.append(svgEl(doc, 'rect', { x: x0.toFixed(1), y: PAD.top, width: (x1 - x0).toFixed(1), height: plotH, class: `trend-chart-span is-${span.tone}` }));
  }
  // Line only (v58.53 개편 v2: no area fill; 1.6–2px round stroke in v2-market.css).
  if (guidePoints.length > 1) {
    svg.append(svgEl(doc, 'path', { d: guidePoints.map((point, index) => `${index ? 'L' : 'M'}${xd(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(' '), class: 'trend-chart-guide' }));
    const tail = guidePoints[guidePoints.length - 1];
    const tag = svgEl(doc, 'text', { x: W - PAD.right - 2, y: (y(tail.value) + (tail.value > points[points.length - 1].value ? -5 : 13)).toFixed(1), 'text-anchor': 'end', class: 'trend-chart-ref-label' });
    tag.textContent = guide.label || '';
    svg.append(tag);
  }
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  svg.append(svgEl(doc, 'path', { d: line, class: 'trend-chart-line' }));
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
  const overlay = svgEl(doc, 'rect', { x: PAD.left, y: PAD.top, width: plotW, height: plotH, fill: 'transparent' });
  svg.append(overlay);
  const show = (event) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const vx = ((event.clientX - box.left) / box.width) * W;
    const target = t0 + ((vx - PAD.left) / plotW) * span;
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
  // v57.81 (phone/iPad audit): mouse-only events left touch with no readout. Pointer events serve mouse, pen and
  // finger; pan-y keeps a vertical swipe scrolling the page while a sideways drag scrubs. A lifted finger keeps the
  // last reading; the browser taking the gesture for a scroll (pointercancel) clears it.
  overlay.style.touchAction = 'pan-y';
  svg.style.touchAction = 'pan-y';
  overlay.addEventListener('pointerdown', show);
  overlay.addEventListener('pointermove', show);
  overlay.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') hide(); });
  overlay.addEventListener('pointercancel', hide);
  svg.setAttribute('aria-label', `${label} ${datedShort(points[0].date)}~${datedShort(last.date)} 추이, 최근 ${format(last.value)}${guideAt.has(last.date) ? `, ${guide.label} ${format(guideAt.get(last.date))}` : ''}`);
  return wrap;
}

// Change over n observations, as a signed string in the indicator's own unit.
export function seriesChange(series, n, unit = '%p', digits = 1) {
  const points = series.filter((point) => Number.isFinite(point?.value));
  if (points.length <= n) return null;
  const delta = points[points.length - 1].value - points[points.length - 1 - n].value;
  return signedText(delta, digits, unit);
}
