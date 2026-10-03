// P1395: one dependency-free time-series chart for the 시장 폭 / 투자 심리 boards. Owner review
// 2026-10-03: the first version stretched text (preserveAspectRatio="none") and had no axes. This
// one keeps a fixed aspect ratio, draws a labelled Y axis with gridlines, month ticks on the time
// axis, dashed reference lines, and a hover readout (date · value) so a change can be followed.
// P1399 (Codex review 2026-10-03): x is placed by calendar date, not array index. Charts shown side
// by side pass one `range`, so the same horizontal position is the same date on every card and a
// series whose record starts later begins later on the axis.
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
 * @param {{ series: Array<{date:string,value:number}>, refLines?: number[], format?: (v:number)=>string, label?: string, domain?: [number, number], range?: [string, string] }} options
 */
export function createTrendChart(doc, { series = [], refLines = [], format = (value) => value.toFixed(1), label = '', domain = null, range = null } = {}) {
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
  const values = points.map((point) => point.value);
  let lo = domain ? domain[0] : Math.min(...values, ...refLines);
  let hi = domain ? domain[1] : Math.max(...values, ...refLines);
  if (hi === lo) { hi += 1; lo -= 1; }
  const step = niceStep(hi - lo);
  lo = domain ? domain[0] : Math.floor(lo / step) * step;
  hi = domain ? domain[1] : Math.ceil(hi / step) * step;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const t0 = dayMs(start);
  const span = Math.max(1, dayMs(end) - t0);
  const xd = (date) => PAD.left + ((dayMs(date) - t0) / span) * plotW;
  const x = (index) => xd(points[index].date);
  const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * plotH;

  // Y axis: gridlines + labels.
  for (let tick = lo; tick <= hi + step / 1000; tick += step) {
    svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(tick), y2: y(tick), class: 'trend-chart-grid' }));
    const text = svgEl(doc, 'text', { x: PAD.left - 8, y: y(tick) + 4, 'text-anchor': 'end', class: 'trend-chart-axis' });
    text.textContent = format(tick);
    svg.append(text);
  }
  // X axis: one tick on the first day of each month.
  svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: PAD.top + plotH, y2: PAD.top + plotH, class: 'trend-chart-baseline' }));
  const first = new Date(t0);
  for (let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1); cursor <= t0 + span; cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1)) {
    const month = new Date(cursor).toISOString().slice(0, 7);
    const xm = xd(`${month}-01`);
    if (xm < PAD.left + 12 || xm > W - PAD.right - 20) continue;
    svg.append(svgEl(doc, 'line', { x1: xm, x2: xm, y1: PAD.top + plotH, y2: PAD.top + plotH + 4, class: 'trend-chart-baseline' }));
    const text = svgEl(doc, 'text', { x: xm, y: H - 8, 'text-anchor': 'middle', class: 'trend-chart-axis' });
    const m = Number(month.slice(5, 7));
    text.textContent = m === 1 ? `${month.slice(2, 4)}년 1월` : `${m}월`;
    svg.append(text);
  }
  // Reference lines (thresholds), labelled at the left edge of the plot.
  for (const ref of refLines) {
    if (ref < lo || ref > hi) continue;
    svg.append(svgEl(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(ref), y2: y(ref), class: 'trend-chart-ref' }));
  }
  // Area + line.
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  svg.append(svgEl(doc, 'path', { d: `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`, class: 'trend-chart-area' }));
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
    const target = t0 + ((vx - PAD.left) / plotW) * span;
    let index = 0;
    for (let i = 1; i < points.length; i += 1) if (Math.abs(dayMs(points[i].date) - target) < Math.abs(dayMs(points[index].date) - target)) index = i;
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
