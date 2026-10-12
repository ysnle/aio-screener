// P1637: the regime radar on 시장 상태 — six axes, today against 5 and 20 sessions ago. Plain SVG so it
// follows the theme tokens; numbers are one-year positions of each series, not a composite score.
import { buildRegimeRadar } from '../../domain/market/regime-radar.js';

const SVG = 'http://www.w3.org/2000/svg';
const node = (doc, tag, attrs = {}, text = null) => {
  const out = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) out.setAttribute(key, String(value));
  if (text != null) out.textContent = text;
  return out;
};
const el = (doc, tag, text, className) => { const out = doc.createElement(tag); if (text != null) out.textContent = text; if (className) out.className = className; return out; };

export function radarSvg(doc, model, { size = 340 } = {}) {
  const center = size / 2, radius = size / 2 - 64, count = model.axes.length;
  const point = (index, value) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    const r = radius * Math.max(0, Math.min(100, value)) / 100;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const svg = node(doc, 'svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', class: 'regime-radar-svg', 'aria-label': `국면 레이더: ${model.axes.map((axis) => `${axis.label} ${axis.now ?? '없음'}`).join(', ')}` });
  for (const ring of [25, 50, 75, 100]) {
    svg.append(node(doc, 'polygon', { points: model.axes.map((_, i) => point(i, ring).join(',')).join(' '), class: 'regime-radar-ring' }));
  }
  model.axes.forEach((axis, i) => {
    const [x, y] = point(i, 100);
    svg.append(node(doc, 'line', { x1: center, y1: center, x2: x, y2: y, class: 'regime-radar-spoke' }));
    const [lx, ly] = point(i, 126);
    const label = node(doc, 'text', { x: lx, y: ly - 6, 'text-anchor': Math.abs(lx - center) < 8 ? 'middle' : lx > center ? 'start' : 'end', class: 'regime-radar-label' }, axis.label);
    const value = node(doc, 'text', { x: lx, y: ly + 10, 'text-anchor': Math.abs(lx - center) < 8 ? 'middle' : lx > center ? 'start' : 'end', class: 'regime-radar-value' },
      axis.now == null ? '없음' : `${axis.now}${axis.change5 == null ? '' : ` (${axis.change5 >= 0 ? '+' : ''}${axis.change5})`}`);
    svg.append(label, value);
  });
  // Oldest first so today is drawn on top.
  [[2, 'is-d20'], [1, 'is-d5'], [0, 'is-now']].forEach(([slot, cls]) => {
    const points = model.axes.map((axis, i) => axis.values[slot] == null ? null : point(i, axis.values[slot]));
    if (points.some((p) => p == null)) return;
    svg.append(node(doc, 'polygon', { points: points.map((p) => p.join(',')).join(' '), class: `regime-radar-shape ${cls}` }));
    if (slot === 0) points.forEach(([x, y]) => svg.append(node(doc, 'circle', { cx: x, cy: y, r: 3.5, class: 'regime-radar-dot' })));
  });
  return svg;
}

export function renderRegimeRadar({ documentRef: doc, root, inputs, anchor }) {
  if (!doc || !anchor) return null;
  doc.getElementById('regime-radar')?.remove();
  const model = buildRegimeRadar(inputs, { macroHistory: root?._aioMacroHistory || null });
  if (!model.available) return null;
  const section = el(doc, 'section', null, 'regime-radar');
  section.id = 'regime-radar';
  const short = (date) => date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '—';
  section.append(el(doc, 'h2', '국면 레이더 · 바깥일수록 우호', 'briefing-h2'));
  section.append(el(doc, 'p', model.lead, 'regime-radar-lead'));
  const body = el(doc, 'div', null, 'regime-radar-body');
  body.append(radarSvg(doc, model));
  const legend = el(doc, 'ul', null, 'regime-radar-legend');
  [['is-now', `오늘 (${short(model.dates[0])})`], ['is-d5', `5거래일 전 (${short(model.dates[1])})`], ['is-d20', `20거래일 전 (${short(model.dates[2])})`]].forEach(([cls, text]) => {
    const item = el(doc, 'li', null); item.append(el(doc, 'span', null, `regime-radar-swatch ${cls}`), el(doc, 'span', text)); legend.append(item);
  });
  const side = el(doc, 'div', null, 'regime-radar-side');
  side.append(legend);
  const table = el(doc, 'dl', null, 'regime-evidence');
  for (const axis of model.axes) table.append(el(doc, 'dt', `${axis.label} — ${axis.note}`), el(doc, 'dd', axis.now == null ? '자료 없음' : `${axis.now} · 5일 ${axis.change5 == null ? '—' : `${axis.change5 >= 0 ? '+' : ''}${axis.change5}`} · 20일 ${axis.change20 == null ? '—' : `${axis.change20 >= 0 ? '+' : ''}${axis.change20}`}`));
  const details = el(doc, 'details', null, 'regime-axis-details');
  details.append(el(doc, 'summary', '숫자 읽는 법과 축별 값'), el(doc, 'p', '각 축의 숫자는 지난 1년(252거래일) 안에서 오늘 값이 어디쯤인지입니다. 100은 1년 중 가장 우호적인 수준, 0은 가장 부담스러운 수준입니다. 축끼리 더한 종합 점수는 예측 근거가 없어 만들지 않습니다. 안쪽으로 줄어든 축이 지금 시장이 약해진 곳입니다.', 'regime-read'), table);
  side.append(details);
  body.append(side);
  section.append(body);
  anchor.insertAdjacentElement('beforebegin', section);
  return model;
}
