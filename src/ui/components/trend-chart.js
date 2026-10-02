// P1395: one dependency-free time-series chart for the 시장 폭 / 투자 심리 boards. Owner review
// 2026-10-03: the first version stretched text (preserveAspectRatio="none") and had no axes. This
// one keeps a fixed aspect ratio, draws a labelled Y axis with gridlines, month ticks on the time
// axis, dashed reference lines, and a hover readout (date · value) so a change can be followed.
const SVG = 'http://www.w3.org/2000/svg';
const W = 520;
const H = 210;
const PAD = { top: 14, right: 16, bottom: 30, left: 48 };

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

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

/**
 * @param {Document} doc
 * @param {{ series: Array<{date:string,value:number}>, refLines?: number[], format?: (v:number)=>string, label?: string, domain?: [number, number] }} options
 */
export function createTrendChart(doc, { series = [], refLines = [], format = (value) => value.toFixed(1), label = '', domain = null } = {}) {
  const wrap = doc.createElement('div');
  wrap.className = 'trend-chart-wrap';
  const svg = svgEl(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend-chart', role: 'img' });
  wrap.append(svg);
  const points = series.filter((point) => Number.isFinite(point?.value));
  if (points.length < 2) {
    svg.setAttribute('aria-label', `${label} 추이 기록 부족`);
    const text = svgEl(doc, 'text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'trend-chart-empty' });
    text.textContent = '추이 기록 수집 중';
    svg.append(text);
    return wrap;
  }
  const values = points.map((point) => point.value);
  let lo = domain ? domain[0] : Math.min(...values, ...refLines);
  let hi = domain ? domain[1] : Math.max(...values, ...refLines);
  if (hi === lo) { hi += 1; lo -= 1; }
  const step = niceStep(hi - lo);
  lo = domain ? domain[0] : Math.floor(lo / step) * step;
  hi = domain ? domain[1] : Math.ceil(hi / step) * step;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (index) => PAD.left + (index / (points.length - 1)) * plotW;
  const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * plotH;

  // Y axis: gridlines + labels.
  for (let tick = lo; tick <= hi + step / 1000; tick += step) {
    svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(tick), y2: y(tick), class: 'trend-chart-grid' }));
    const text = svgEl(doc, 'text', { x: PAD.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'trend-chart-axis' });
    text.textContent = format(tick);
    svg.append(text);
  }
  // X axis: one tick at the first session of each month.
  svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: PAD.top + plotH, y2: PAD.top + plotH, class: 'trend-chart-baseline' }));
  let lastMonth = null;
  points.forEach((point, index) => {
    const month = point.date.slice(0, 7);
    if (month === lastMonth) return;
    lastMonth = month;
    if (index === 0 && points.length > 1 && points[1].date.slice(0, 7) === month && Number(point.date.slice(8, 10)) > 10) return;
    const xm = x(index);
    if (xm > W - PAD.right - 20) return;
    svg.append(svgEl(doc, 'line', { x1: xm, x2: xm, y1: PAD.top + plotH, y2: PAD.top + plotH + 4, class: 'trend-chart-baseline' }));
    const text = svgEl(doc, 'text', { x: xm, y: H - 8, 'text-anchor': 'middle', class: 'trend-chart-axis' });
    const m = Number(month.slice(5, 7));
    text.textContent = m === 1 ? `${month.slice(2, 4)}년 1월` : `${m}월`;
    svg.append(text);
  });
  // Reference lines (thresholds), labelled at the left edge of the plot.
  for (const ref of refLines) {
    if (ref < lo || ref > hi) continue;
    svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(ref), y2: y(ref), class: 'trend-chart-ref' }));
  }
  // Area + line.
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  svg.append(svgEl(doc, 'path', { d: `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + plotH} L${PAD.left},${PAD.top + plotH} Z`, class: 'trend-chart-area' }));
  svg.append(svgEl(doc, 'path', { d: line, class: 'trend-chart-line' }));
  const last = points[points.length - 1];
  svg.append(svgEl(doc, 'circle', { cx: x(points.length - 1), cy: y(last.value), r: 4, class: 'trend-chart-dot' }));

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
    const index = Math.max(0, Math.min(points.length - 1, Math.round(((vx - PAD.left) / plotW) * (points.length - 1))));
    const point = points[index];
    cursor.setAttribute('x1', x(index)); cursor.setAttribute('x2', x(index)); cursor.setAttribute('visibility', 'visible');
    marker.setAttribute('cx', x(index)); marker.setAttribute('cy', y(point.value)); marker.setAttribute('visibility', 'visible');
    tip.textContent = `${shortDate(point.date)} · ${format(point.value)}`;
    tip.hidden = false;
    const left = (x(index) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(left, 40), box.width - 40)}px`;
    tip.style.top = `${(y(point.value) / H) * box.height - 30}px`;
  };
  const hide = () => { cursor.setAttribute('visibility', 'hidden'); marker.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  overlay.addEventListener('mousemove', show);
  overlay.addEventListener('mouseleave', hide);
  svg.setAttribute('aria-label', `${label} ${shortDate(points[0].date)}~${shortDate(last.date)} 추이, 최근 ${format(last.value)}`);
  return wrap;
}

// Change over n observations, as a signed string in the indicator's own unit.
export function seriesChange(series, n, unit = '%p', digits = 1) {
  const points = series.filter((point) => Number.isFinite(point?.value));
  if (points.length <= n) return null;
  const delta = points[points.length - 1].value - points[points.length - 1 - n].value;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(digits)}${unit}`;
}
