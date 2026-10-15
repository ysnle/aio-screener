// P1637: the regime radar on 시장 상태 — six axes, today against 5 and 20 sessions ago. Plain SVG so it
// follows the theme tokens; numbers are one-year positions of each series, not a composite score.
import { buildRegimeRadar } from '../../domain/market/regime-radar.js';
import { el } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
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
      axis.now == null ? '없음' : `${axis.now}${axis.change5 == null ? '' : ` (${axis.change5 >= 0 ? '+' : ''}${axis.change5})`}`);
    const basis = `${axis.label}: ${axis.note}. ${axis.sample ? `최근 ${axis.sample}거래일 중 위치` : '표본 부족'} ${axis.now ?? '없음'} · 5거래일 전 ${axis.values[1] ?? '—'} · 20거래일 전 ${axis.values[2] ?? '—'}`;
    label.setAttribute('data-basis', basis); value.setAttribute('data-basis', basis); value.setAttribute('tabindex', '0'); // P1643/U01: one keyboard stop per axis value
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
  section.append(el(doc, 'p', '숫자 = 최근 1년(최대 252거래일) 중 지금 위치(0~100, 클수록 양호) — 아래 카드의 양호·중립·부담 판정과는 다른 잣대', 'regime-chart-caption'));
  section.append(el(doc, 'p', model.lead, 'regime-radar-lead'));
  // X-review (2026-10-13, PM/credit view): "양호" above and 9 here read as a contradiction at first glance. When an
  // axis's absolute verdict and its position in its own past point opposite ways, say so on the face of the chart.
  const stateOf = new Map((verdicts || []).map((row) => [row.id, row.state]));
  const gaps = model.axes.filter((axis) => axis.now != null && ((stateOf.get(axis.id) === 'favorable' && axis.now <= 25) || (stateOf.get(axis.id) === 'neutral' && axis.now <= 15) || (stateOf.get(axis.id) === 'burden' && axis.now >= 75)));
  // v57.50 D22: each axis has its own comparison window (추세 69, 시장 폭 182 sessions while their records are short), so the
  // sentence names that window instead of "최근 1년".
  const windowOf = (axis) => axis.sample ? `지난 ${axis.sample}거래일${axis.sample >= 252 ? '(약 1년)' : ''}` : '비교 표본';
  // Live review 2026-10-14: one short paragraph per axis (two axes joined into one 274자 block before).
  if (gaps.length) {
    section.append(...gaps.map((axis) => el(doc, 'p', stateOf.get(axis.id) === 'favorable'
      ? `${axis.label}: 수준은 양호하지만 ${windowOf(axis)} 기준으로는 나빠진 편(${axis.now})입니다.`
      : stateOf.get(axis.id) === 'neutral'
        ? `${axis.label}: 판정은 중립(절대 수준)이지만 ${windowOf(axis)} 안에서는 가장 나쁜 쪽 가까이(${axis.now})까지 밀렸습니다${axis.change20 != null ? ` (20거래일 ${axis.change20 >= 0 ? '+' : ''}${axis.change20})` : ''}${axis.change20 != null && axis.change20 > 0 ? ' — 최근 20거래일은 나아지는 쪽이지만 아직 바닥권이라, 다음 갱신에서 반등이 이어지는지 먼저 확인할 지표입니다.' : ' — 이 속도가 이어지면 판정이 부담으로 바뀔 수 있어 다음 갱신에서 먼저 확인할 지표입니다.'}` // v57.54 review: an improving +20일 move no longer reads "이 속도가 이어지면 부담으로"
      : `${axis.label}: ${windowOf(axis)} 기준으로는 나아진 편(${axis.now})이지만 수준은 아직 부담입니다.`, 'regime-radar-gap')));
  }
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
    const dd = el(doc, 'dd', axis.now == null ? '최신 관측 없음' : `${axis.now} · 5일 ${axis.change5 == null ? '—' : `${axis.change5 >= 0 ? '+' : ''}${axis.change5}`} · 20일 ${axis.change20 == null ? '—' : `${axis.change20 >= 0 ? '+' : ''}${axis.change20}`}`);
    if (axis.observed?.[0]) dd.setAttribute('data-observed-at', axis.observed[0]);
    dd.setAttribute('data-basis', `${axis.note} · 비교 표본 ${axis.sample ? `${axis.sample}거래일` : '부족'}`);
    dd.tabIndex = 0;
    const verdict = { favorable: '양호', neutral: '중립', burden: '부담' }[stateOf.get(axis.id)];
    table.append(el(doc, 'dt', verdict ? `${axis.label} · 판정 ${verdict}` : axis.label), dd);
  }
  side.append(table);
  const details = el(doc, 'details', null, 'regime-axis-details');
  details.append(el(doc, 'summary', '숫자 읽는 법'), el(doc, 'p', `각 지표의 숫자는 비교 표본(최대 1년, 252거래일) 안에서 오늘 값이 어디쯤인지입니다. 100은 그 기간 중 가장 우호적인 수준, 0은 가장 부담스러운 수준입니다. 자료가 짧은 지표는 짧은 기간 안의 위치입니다(${model.axes.filter((axis) => axis.sample && axis.sample < 252).map((axis) => `${axis.label} ${axis.sample}거래일`).join(', ') || '모두 252거래일'}). 위의 양호·부담 판정은 절대 기준이고 레이더는 상대 위치라서, 판정이 양호여도 레이더 값은 낮을 수 있습니다. 지표끼리 더한 종합 점수는 예측 근거가 없어 만들지 않습니다.`, 'regime-read'));
  side.append(details);
  body.append(side);
  section.append(body);
  anchor.insertAdjacentElement('beforebegin', section);
  return model;
}
