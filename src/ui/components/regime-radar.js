// P1637: the regime radar on 시장 상태 — six axes, today against 5 and 20 sessions ago. Plain SVG so it
// follows the theme tokens; numbers are one-year positions of each series, not a composite score.
import { buildRegimeRadar } from '../../domain/market/regime/regime-radar.js';
import { el } from './dom.js';
import { signedText } from '../../domain/shared/number.js';

const SVG = 'http://www.w3.org/2000/svg';
// Today's measured value per axis (the rank alone read as the price's own position).
const RAW_TEXT = Object.freeze({ trend: (v) => `${signedText(v, 1, '%')}`, breadth: (v) => `${v.toFixed(0)}%`, volatility: (v) => v.toFixed(1), rates: (v) => `${v.toFixed(2)}%`, credit: (v) => `${(v / 100).toFixed(2)}%` });
const node = (doc, tag, attrs = {}, text = null) => {
  const out = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) out.setAttribute(key, String(value));
  if (text != null) out.textContent = text;
  return out;
};

export function radarSvg(doc, model, { size = 340 } = {}) {
  const center = size / 2, radius = size / 2 - 64, count = model.axes.length;
  const point = (index, value) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    const r = radius * Math.max(0, Math.min(100, value)) / 100;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const svg = node(doc, 'svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', class: 'regime-radar-svg', 'aria-label': `시장 레이더: ${model.axes.map((axis) => `${axis.label} ${axis.now ?? '없음'}`).join(', ')}` });
  for (const ring of [25, 50, 75, 100]) {
    svg.append(node(doc, 'polygon', { points: model.axes.map((_, i) => point(i, ring).join(',')).join(' '), class: 'regime-radar-ring' }));
  }
  model.axes.forEach((axis, i) => {
    const [x, y] = point(i, 100);
    svg.append(node(doc, 'line', { x1: center, y1: center, x2: x, y2: y, class: 'regime-radar-spoke' }));
    const [lx, ly] = point(i, 126);
    const label = node(doc, 'text', { x: lx, y: ly - 6, 'text-anchor': Math.abs(lx - center) < 8 ? 'middle' : lx > center ? 'start' : 'end', class: 'regime-radar-label' }, axis.label);
    const value = node(doc, 'text', { x: lx, y: ly + 10, 'text-anchor': Math.abs(lx - center) < 8 ? 'middle' : lx > center ? 'start' : 'end', class: 'regime-radar-value' },
      axis.now == null ? '없음' : `${axis.now}${axis.change5 == null ? '' : ` (${signedText(axis.change5, 0)})`}`);
    const basis = `${axis.label}: ${axis.note}${RAW_TEXT[axis.id] && Number.isFinite(axis.raw) ? `, 지금 ${RAW_TEXT[axis.id](axis.raw)}` : ''}. ${axis.sample ? `이 값의 최근 ${axis.sample}거래일 중 위치(0~100, 가격 자체의 위치가 아님)` : '표본 부족'} ${axis.now ?? '없음'}, 5거래일 전 ${axis.values[1] ?? '—'}, 20거래일 전 ${axis.values[2] ?? '—'}`;
    label.setAttribute('data-basis', basis); value.setAttribute('data-basis', basis); // v57.77 (a11y): the keyboard stop is the table's dd row; a focusable <text> inside role=img was a hidden second stop
    if (axis.observed?.[0]) { label.setAttribute('data-observed-at', axis.observed[0]); value.setAttribute('data-observed-at', axis.observed[0]); }
    svg.append(label, value);
  });
  // Oldest first so today is drawn on top.
  [[2, 'is-d20'], [1, 'is-d5'], [0, 'is-now']].forEach(([slot, cls]) => {
    const points = model.axes.map((axis, i) => axis.values[slot] == null ? null : point(i, axis.values[slot]));
    // M09: with an axis missing, the shape would lie about it — draw only the observed points for today.
    if (points.every((p) => p != null)) svg.append(node(doc, 'polygon', { points: points.map((p) => p.join(',')).join(' '), class: `regime-radar-shape ${cls}` }));
    if (slot === 0) points.forEach((p) => { if (p) svg.append(node(doc, 'circle', { cx: p[0], cy: p[1], r: 3.5, class: 'regime-radar-dot' })); });
  });
  return svg;
}

export function renderRegimeRadar({ documentRef: doc, root, inputs, anchor, verdicts = [] }) {
  if (!doc || !anchor) return null;
  doc.getElementById('regime-radar')?.remove();
  const model = buildRegimeRadar(inputs, { macroHistory: root?._aioMacroHistory || null });
  if (!model.available) return null;
  // v57.76: the radar is the visual of the six-indicator section — the shell's h2 "미국 시장 6개 지표 — 1년 중 지금
  // 위치" heads it, so the radar carries no heading of its own (two stacked h2s read as two sections).
  const section = el(doc, 'div', null, 'regime-radar');
  section.id = 'regime-radar';
  if (model.asOf) section.setAttribute('data-observed-at', model.asOf); // P1643
  const short = (date) => date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '—';
  // Codex M-screen: the radar is a position inside each axis's own past, not the 양호/부담 verdict above.
  // v57.54 audit (6): the numbers are a position (0~100), not a grade — the caption says so and each row names its card verdict.
  // v58.79: the scale in a few words; that it differs from the verdicts above is the line's hover.
  // v59.55 (visual review): the radar is 국면 판정's face picture — one reading line, then the picture; the scale and the
  // verdict-vs-position note sit under it (they were three lines above the drawing).
  // v59.69 (owner 2026-11-04): the scale is the section's hover, not a caption line.
  section.title = '최근 1년(최대 252거래일) 중 지금 위치, 0~100, 클수록 양호 — 위 표의 판정과는 다른 잣대';
  const notes = [];
  section.append(el(doc, 'p', model.lead, 'regime-radar-lead'));
  // X-review (2026-10-13, PM/credit view): "양호" above and 9 here read as a contradiction at first glance. When an
  // axis's absolute verdict and its position in its own past point opposite ways, say so on the face of the chart.
  const stateOf = new Map((verdicts || []).map((row) => [row.id, row.state]));
  const gaps = model.axes.filter((axis) => axis.now != null && ((stateOf.get(axis.id) === 'favorable' && axis.now <= 25) || (stateOf.get(axis.id) === 'neutral' && axis.now <= 15) || (stateOf.get(axis.id) === 'burden' && axis.now >= 75)));
  // v57.79 (UI review): one conclusion line instead of one paragraph per axis — the table beside the radar already shows
  // each axis's verdict next to its position and 5/20-day change, and the cards below carry the evidence, so a per-axis
  // paragraph was the same six-axis reading a third time. The comparison window per axis is each row's data-basis.
  const gapIds = new Set(gaps.map((axis) => axis.id)); // v59.69: marked on their table rows, not repeated as a sentence
  const body = el(doc, 'div', null, 'regime-radar-body');
  body.append(radarSvg(doc, model));
  const legend = el(doc, 'ul', null, 'regime-radar-legend');
  [['is-now', `오늘 (${short(model.dates[0])})`], ['is-d5', `5거래일 전 (${short(model.dates[1])})`], ['is-d20', `20거래일 전 (${short(model.dates[2])})`]].forEach(([cls, text]) => {
    const item = el(doc, 'li', null); item.append(el(doc, 'span', null, `regime-radar-swatch ${cls}`), el(doc, 'span', text)); legend.append(item);
  });
  const side = el(doc, 'div', null, 'regime-radar-side');
  side.append(legend);
  // The axis table sits beside the drawing (it was folded, leaving the right side empty on desktop).
  const table = el(doc, 'dl', null, 'regime-evidence regime-radar-table');
  for (const axis of model.axes) {
    const dd = el(doc, 'dd', axis.now == null ? '최신 관측 없음' : `${axis.now}, 5일 ${axis.change5 == null ? '—' : signedText(axis.change5, 0)}, 20일 ${axis.change20 == null ? '—' : signedText(axis.change20, 0)}`);
    if (axis.observed?.[0]) dd.setAttribute('data-observed-at', axis.observed[0]);
    dd.setAttribute('data-basis', `${axis.note}, 비교 표본 ${axis.sample ? `${axis.sample}거래일` : '부족'}`);
    dd.tabIndex = 0;
    const verdict = { favorable: '양호', neutral: '중립', burden: '부담' }[stateOf.get(axis.id)];
    const dt = el(doc, 'dt', verdict ? `${axis.label}, 판정 ${verdict}` : axis.label);
    if (gapIds.has(axis.id)) { dt.classList.add('is-gap'); dd.classList.add('is-gap'); dd.title = '판정과 1년 중 위치가 엇갈림'; }
    table.append(dt, dd);
  }
  side.append(table);
  body.append(side);
  section.append(body, ...notes);
  // v58.53 개편 v2: on 시장 상태 the radar is a lower card's content (host element); other anchors keep the old placement.
  if (anchor.id === 'regime-radar-host') anchor.replaceChildren(section);
  else anchor.insertAdjacentElement('beforebegin', section);
  return model;
}
