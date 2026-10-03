// P1425 (owner review 2026-10-03): the 거시 hub as two native boards.
//   거시 경제 (route macro)  — official monthly releases grouped as 정책금리 · 물가 · 고용 · 소비·주택,
//                              each card with reference month, release date, next release and source.
//   금리 · 환율 (route fxbond) — Treasury curve, real yield / breakeven / HY spread, and the dollar,
//                              won, yen and 10Y on the completed-close basis with six-month charts.
// Observations only: the fixed-threshold storyline, risk pill and four-axis bull/bear count are retired.
import { alignInput, alignmentLabel } from '../../domain/briefing/market-read.js';
import { buildMacroBoard } from '../../domain/macro/indicators.js';
import { buildRatesFx, signed } from '../../domain/macro/rates-fx.js';
import { createTrendChart } from './trend-chart.js';

const SVG = 'http://www.w3.org/2000/svg';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

function statCard(doc, { label, valueText, lines = [], meta, note, status }) {
  const card = el(doc, 'article', null, `macro-stat${status === 'missing' ? ' is-missing' : ''}`);
  card.append(el(doc, 'h4', label, 'macro-stat-label'), el(doc, 'div', valueText, 'macro-stat-value'));
  lines.filter(Boolean).forEach((line) => card.append(el(doc, 'div', line, 'macro-stat-line')));
  if (status === 'stale') card.append(el(doc, 'span', '이번 수집 실패 · 직전 발표값', 'basis-chip is-off'));
  if (meta) card.append(el(doc, 'div', meta, 'macro-stat-meta'));
  if (note) card.append(el(doc, 'p', note, 'macro-stat-note'));
  return card;
}

export function renderMacroBoard({ documentRef: doc, root }) {
  const host = doc?.getElementById('macro-board');
  if (!host) return null;
  const board = buildMacroBoard({ macro: root._aioServerMacro || null, releases: root.AIO_MACRO_CALENDAR?.releases || {}, schedules: root.AIO_MACRO_OFFICIAL_SCHEDULES || {} });
  const basis = doc.getElementById('macro-board-basis');
  if (basis) basis.textContent = board.available ? '공식 발표 기준 · 발표월과 다음 발표일은 각 지표 아래에 표시' : '공식 발표 자료를 불러오는 중입니다.';
  host.replaceChildren(...board.groups.map((group) => {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = group.id;
    section.append(el(doc, 'h3', group.title, 'macro-group-title'), el(doc, 'p', group.fact, 'macro-group-fact'));
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    grid.append(...group.items.map((item) => statCard(doc, { label: item.label, valueText: item.valueText, lines: [item.deltaText, item.targetText], meta: item.meta, note: item.note, status: item.status })));
    section.append(grid);
    return section;
  }));
  host.dataset.aioMacroBoardRenderer = 'native';
  return board;
}

// The Treasury par curve as five points on an ordinal tenor axis.
function curveSvg(doc, yields) {
  const points = yields.filter((row) => row.value != null);
  const W = 520;
  const H = 150;
  const pad = { top: 18, right: 24, bottom: 26, left: 44 };
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'rates-curve');
  svg.setAttribute('role', 'img');
  if (points.length < 2) { svg.setAttribute('aria-label', '수익률 곡선 자료 부족'); return svg; }
  svg.setAttribute('aria-label', `미 국채 수익률 곡선: ${points.map((row) => `${row.label} ${row.value.toFixed(2)}%`).join(', ')}`);
  const values = points.map((row) => row.value);
  const lo = Math.floor((Math.min(...values) - 0.1) * 10) / 10;
  const hi = Math.ceil((Math.max(...values) + 0.1) * 10) / 10;
  const x = (index) => pad.left + (index / (yields.length - 1)) * (W - pad.left - pad.right);
  const y = (value) => pad.top + (1 - (value - lo) / (hi - lo)) * (H - pad.top - pad.bottom);
  const add = (tag, attrs, text) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  [lo, (lo + hi) / 2, hi].forEach((value) => {
    add('line', { x1: pad.left, x2: W - pad.right, y1: y(value), y2: y(value), class: 'trend-chart-grid' });
    add('text', { x: pad.left - 6, y: y(value) + 4, 'text-anchor': 'end', class: 'trend-chart-axis' }, `${value.toFixed(1)}%`);
  });
  const path = yields.map((row, index) => (row.value == null ? null : `${x(index)},${y(row.value)}`)).filter(Boolean).join(' ');
  add('polyline', { points: path, class: 'trend-chart-line' });
  yields.forEach((row, index) => {
    add('text', { x: x(index), y: H - 6, 'text-anchor': 'middle', class: 'trend-chart-axis' }, row.label);
    if (row.value == null) return;
    add('circle', { cx: x(index), cy: y(row.value), r: 3.5, class: 'rates-curve-dot' });
    add('text', { x: x(index), y: y(row.value) - 8, 'text-anchor': 'middle', class: 'rates-curve-label' }, row.value.toFixed(2));
  });
  return svg;
}

function trendCard(doc, { id, title, valueText, chip, chipOff, lines, series, format, note }) {
  const box = el(doc, 'section', null, 'trend-card');
  box.dataset.metric = id;
  const head = el(doc, 'div', null, 'trend-card-head');
  head.append(el(doc, 'h3', title, 'trend-card-title'), el(doc, 'span', valueText, 'trend-card-value'));
  box.append(head);
  const tags = el(doc, 'div', null, 'trend-card-tags');
  if (chip) tags.append(el(doc, 'span', chip, `basis-chip${chipOff ? ' is-off' : ''}`));
  box.append(tags);
  lines.filter(Boolean).forEach((line) => box.append(el(doc, 'div', line, 'trend-card-change')));
  box.append(createTrendChart(doc, { series, format, label: title }));
  if (note) box.append(el(doc, 'p', note, 'trend-card-note'));
  return box;
}

export function renderRatesFxBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-fxbond');
  if (!page) return null;
  const model = buildRatesFx({ macro: root._aioServerMacro || null, history: root._aioHistory || [] });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  const t = model.treasury;
  set('rates-basis', model.basis ? `${shortDate(model.basis)} 미국 종가 기준 · 국채 금리는 ${t.asOf ? `${shortDate(t.asOf)} ` : ''}미 재무부 공식 고시` : '종가 기록을 불러오는 중입니다.');

  // 1. Treasury curve
  const yieldRow = doc.getElementById('rates-yields');
  if (yieldRow) {
    yieldRow.replaceChildren(...t.yields.map((row) => {
      const cell = el(doc, 'div', null, 'rates-yield');
      cell.append(el(doc, 'span', row.label, 'rates-yield-label'), el(doc, 'span', row.value == null ? '—' : `${row.value.toFixed(2)}%`, 'rates-yield-value'));
      const changes = [row.day == null ? null : `1일 ${signed(row.day * 100, 0, 'bp')}`, row.week == null ? null : `1주 ${signed(row.week * 100, 0, 'bp')}`].filter(Boolean).join(' · ');
      if (changes) cell.append(el(doc, 'span', changes, 'rates-yield-change'));
      return cell;
    }));
  }
  const curveHost = doc.getElementById('rates-curve');
  if (curveHost) curveHost.replaceChildren(curveSvg(doc, t.yields));
  const spreads = doc.getElementById('rates-spreads');
  if (spreads) {
    spreads.replaceChildren(...t.curve.map((row) => {
      const item = el(doc, 'div', null, 'rates-spread');
      item.append(el(doc, 'span', `${row.label} (${row.legs})`, 'rates-spread-label'), el(doc, 'span', row.value == null ? '—' : `${signed(row.value, 2, '%p')}`, 'rates-spread-value'));
      return item;
    }));
  }
  set('rates-curve-fact', t.fact);
  const reading = doc.getElementById('rates-curve-reading');
  if (reading) reading.replaceChildren(...(t.reading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${t.reading}`)] : []));

  // 2. Real yield, breakeven, credit
  const levels = doc.getElementById('rates-levels');
  if (levels) {
    levels.replaceChildren(...[...model.real, model.credit].map((row) => statCard(doc, {
      label: row.label,
      valueText: row.valueText,
      lines: [row.weekText],
      meta: row.asOf ? `${shortDate(row.asOf)} · FRED` : null,
      note: row.note,
      status: row.value == null ? 'missing' : row.stale ? 'stale' : 'observed'
    })));
  }

  // 3. Dollar, won, yen and the 10-year on the close basis
  const grid = doc.getElementById('rates-fx-grid');
  if (grid) {
    const tnxLast = model.tnx[model.tnx.length - 1] || null;
    const tnxBack = model.tnx.length > 20 ? model.tnx[model.tnx.length - 21] : null;
    const cards = [
      ...model.fx.map((card) => {
        const align = alignInput(card.asOf, model.basis);
        return trendCard(doc, {
          id: card.id,
          title: card.label,
          valueText: card.available ? card.valueText : '—',
          chip: card.available ? `${alignmentLabel(align)} 종가` : null,
          chipOff: align.status !== 'aligned',
          lines: card.available ? [`1일 ${signed(card.day, 2, '%')} · 20일 ${signed(card.change20, 1, '%')}`] : ['기록 수집 중'],
          series: card.series,
          format: (value) => value.toFixed(card.digits === 1 ? 0 : 1),
          note: card.id === 'usdjpy' ? model.carry.text : card.id === 'usdkrw' ? '원/달러가 오르면 원화 약세입니다.' : '주요 6개 통화 대비 달러 가치입니다.'
        });
      }),
      trendCard(doc, {
        id: 'tnx',
        title: '미 10년물 금리 (일별 종가)',
        valueText: tnxLast ? `${tnxLast.value.toFixed(2)}%` : '—',
        chip: tnxLast ? `${alignmentLabel(alignInput(tnxLast.date, model.basis))} 종가` : null,
        chipOff: tnxLast ? alignInput(tnxLast.date, model.basis).status !== 'aligned' : false,
        lines: [tnxLast && tnxBack ? `20일 ${signed((tnxLast.value - tnxBack.value) * 100, 0, 'bp')}` : null],
        series: model.tnx,
        format: (value) => value.toFixed(1),
        note: '시세 제공처의 일별 종가입니다. 위 공식 고시값과 소수점 차이가 날 수 있습니다.'
      })
    ];
    grid.replaceChildren(...cards);
  }
  page.dataset.aioRatesBoardRenderer = 'native';
  return model;
}
