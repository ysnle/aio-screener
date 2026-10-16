// P1425 (owner review 2026-10-03): the 거시 hub as two native boards.
// P1426: 거시 경제 now leads with the growth × inflation regime, six equity-impact axes (growth, inflation
// and policy rules here; rates, oil/dollar and credit shared with 시장 상태), the oil → inflation →
// policy → rates → valuation chain, then the indicator cards with 24-month trends and oil/gold charts.
//   거시 경제 (route macro)  — official monthly releases grouped as 정책금리 · 물가 · 고용 · 소비·주택,
//                              each card with reference month, release date, next release and source.
//   금리 · 환율 (route fxbond) — Treasury curve, real yield / breakeven / HY spread, and the dollar,
//                              won, yen and 10Y on the completed-close basis with six-month charts.
// Observations only: the fixed-threshold storyline, risk pill and four-axis bull/bear count are retired.
import { alignInput, alignmentLabel, buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { buildMacroRead, macroNextSteps, ratesNextSteps, seriesOf } from '../../domain/macro/macro-read.js';
import { renderNextSteps } from './page-flow.js';
import { readMarketRegime } from './market-regime.js';
import { buildMacroBoard } from '../../domain/macro/indicators.js';
import { buildRatesFx, sessionPointBack, signed } from '../../domain/macro/rates-fx.js';
import { createTrendChart } from './trend-chart.js';
import { buildLiquidityGrowthGroups } from '../../domain/macro/liquidity-growth.js';
import { AXIS_DEEP_DIVES, MACRO_AXIS_DEEP_DIVES, MACRO_GROUP_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { deepDiveFold } from './deep-dive.js';
import { renderMacroCrossroads, openCrossroadsBranch } from './macro-crossroads.js';
import { BRANCHES } from '../../domain/market/macro-crossroads.js';
import { longHistoryRows } from '../../domain/macro/long-history.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';

const SVG = 'http://www.w3.org/2000/svg';

function signedNumber(value, digits) {
  return `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;
}

// Codex browser audit H16: "내리는 중" beside a +0.1pp month read as a contradiction. The mark names its window —
// the latest 3-month average against the 3-month average six months earlier (indicators.js trendOf).
const DIRECTION_MARK = Object.freeze({ up: '▲ 6개월 추세 상승', down: '▼ 6개월 추세 하락', flat: '― 6개월 추세 횡보' });
const DIRECTION_TITLE = '최근 3개월 평균을 6개월 전 3개월 평균과 비교한 방향입니다. 전월 대비 변화와 다를 수 있습니다.';

// A 24-month sparkline for an indicator card: the line, its last point and the range labels.
// A minimum vertical span keeps a near-flat series flat instead of stretching rounding noise to full height.
function sparkline(doc, series, { unitLabel = '', minSpan = null, format = null } = {}) {
  const W = 220;
  // v57.79 (UI review): the date labels moved out of the SVG (see statCard) — inside it they scaled with the card and
  // printed larger than the value lines at 375px; the 10px label strip under the line went with them.
  const H = 44;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'macro-spark');
  svg.setAttribute('role', 'img');
  const values = series.map((row) => row.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const floor = minSpan ?? Math.max(Math.abs(mean) * 0.05, 0.1);
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);
  const pad = Math.max(0, (floor - (rawHi - rawLo)) / 2);
  const lo = rawLo - pad;
  const hi = rawHi + pad;
  const span = hi - lo || 1;
  const x = (index) => 4 + (index / (series.length - 1)) * (W - 8);
  const y = (value) => 5 + (1 - (value - lo) / span) * (H - 10);
  const add = (tag, attrs, text) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  if (lo < 0 && hi > 0) add('line', { x1: 4, x2: W - 4, y1: y(0), y2: y(0), class: 'macro-spark-zero' });
  add('polyline', { points: series.map((row, index) => `${x(index)},${y(row.value)}`).join(' '), class: 'macro-spark-line' });
  add('circle', { cx: x(series.length - 1), cy: y(values[values.length - 1]), r: 2.6, class: 'macro-spark-dot' });
  const first = series[0].date.slice(2, 7).replace('-', '.');
  const last = series[series.length - 1].date.slice(2, 7).replace('-', '.');
  svg.dataset.first = first;
  svg.dataset.last = last;
  // P1449: the cadence comes from the dates, not an assumption. A daily rates series of 260
  // observations is one year, not "260개월" — the declared frequency of the series decides the
  // unit, and it is preserved (R570) because the aria label is part of the observation record.
  const spanDays = Math.round((Date.parse(series[series.length - 1].date) - Date.parse(series[0].date)) / 86400000);
  const gap = series.length >= 2 ? spanDays / (series.length - 1) : 1;
  const cadence = gap > 20 ? '월별' : gap > 5 ? '주별' : '일별'; // weekly series (순유동성 · 금융여건) were labelled 일별
  const spanLabel = cadence === '월별' ? `${Math.min(Math.round(spanDays / 30.4), 999)}개월` : `${Math.min(Math.round(spanDays / 30.4), 999)}개월(${cadence} 관측 ${series.length}개)`;
  const ends = format ? `${format(rawLo)}~${format(rawHi)}` : `${signedNumber(rawLo, 1)}~${signedNumber(rawHi, 1)}${unitLabel}`;
  svg.setAttribute('aria-label', `최근 ${spanLabel} 추이 ${first}~${last}, 범위 ${ends}`);
  return svg;
}

// P1505 (owner 2026-10-06): the face of a card carries the date only; the provider and series name move to the
// card's hover title. "10/5 기준 · 다음 10/28 · FRED" shows "10/5 기준 · 다음 10/28" and hovers "출처: FRED".
const SOURCE_TOKEN = /^(FRED|BLS|BEA|Cboe|CBOE|Yahoo|ISM|Census|SEC|CNN|ICE|KRX|ECOS|한국은행|미 재무부|연준|Fed)\b/;
function splitMeta(meta) {
  const parts = String(meta || '').split(' · ');
  const shown = []; const sources = [];
  for (const part of parts) (SOURCE_TOKEN.test(part.trim()) ? sources : shown).push(part);
  return { shown: shown.join(' · '), sources };
}
function statCard(doc, { label, valueText, lines = [], meta, note, status, series = null, direction = null, unit = null, format = null, staleText = null }) {
  const card = el(doc, 'article', null, `macro-stat${status === 'missing' ? ' is-missing' : ''}`);
  const { shown: metaShown, sources: metaSources } = splitMeta(meta);
  if (metaSources.length) card.title = `출처: ${metaSources.join(' · ')}`;
  const head = el(doc, 'div', null, 'macro-stat-head');
  head.append(el(doc, 'h3', label, 'macro-stat-label'));
  if (direction) { const mark = el(doc, 'span', DIRECTION_MARK[direction], `macro-dir is-${direction}`); mark.title = DIRECTION_TITLE; head.append(mark); }
  card.append(head, el(doc, 'div', valueText, 'macro-stat-value'));
  lines.filter(Boolean).forEach((line) => card.append(el(doc, 'div', line, 'macro-stat-line')));
  if (series && series.length >= 6) {
    const spark = sparkline(doc, series, { minSpan: unit === '%' ? 1 : null, format });
    // The first and last month under the line, in page text smaller than the value lines (the SVG's aria-label names them).
    const dates = el(doc, 'div', null, 'macro-spark-dates');
    dates.setAttribute('aria-hidden', 'true');
    dates.append(el(doc, 'span', spark.dataset.first), el(doc, 'span', spark.dataset.last));
    card.append(spark, dates);
    // P1599 (A05): the period's high and low in words under the line, so the shape has a scale (inside the SVG
    // the labels scaled with wide cards and collided with the date ticks).
    const values = series.map((row) => row.value).filter(Number.isFinite);
    // Expert review M16: the range uses the value's own format, so "5.86조 달러" is not ranged as "5987 · 5596".
    const fmtRange = format || ((value) => `${signedNumber(value, Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2)}${unit || ''}`);
    const suffix = '';
    card.append(el(doc, 'p', `기간 고점 ${fmtRange(Math.max(...values))}${suffix} · 저점 ${fmtRange(Math.min(...values))}${suffix}`, 'macro-spark-range'));
  }
  if (status === 'stale') card.append(el(doc, 'span', staleText || '이번 수집 실패 · 직전 발표값', 'basis-chip is-off'));
  if (metaShown) card.append(el(doc, 'div', metaShown, 'macro-stat-meta'));
  if (note) card.append(el(doc, 'p', note, 'macro-stat-note'));
  return card;
}

const TONE_WORD = Object.freeze({ favorable: '양호', neutral: '중립', burden: '부담' });

// Bands are half-open [from, to) like the rules (core PCE 3.0% is already 부담); the last band is closed.
function bandOf(g) {
  const last = g.bands[g.bands.length - 1];
  if (g.value < g.min) return g.bands[0];
  if (g.value >= last.to) return last;
  return g.bands.find((item) => g.value >= item.from && g.value < item.to) || last;
}

// P1427: a threshold gauge — the rule's bands coloured by their effect on stocks, with the current value pinned.
export function gaugeBar(doc, g) {
  if (!g) return null;
  const W = 320;
  const H = 46;
  const left = 8;
  const right = W - 8;
  const x = (value) => left + (Math.min(g.max, Math.max(g.min, value)) - g.min) / (g.max - g.min) * (right - left);
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'macro-gauge');
  svg.setAttribute('role', 'img');
  const add = (tag, attrs, text) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  for (const band of g.bands) add('rect', { x: x(band.from), y: 16, width: Math.max(0, x(band.to) - x(band.from)), height: 8, class: `macro-gauge-band is-${band.tone}` });
  // v57.81: markers close together (0 and "+0.5 재가속") overlapped; a label that would collide with its neighbour
  // is anchored away from it (left one ends at its tick, right one starts at its tick).
  const labelWidth = (text) => [...String(text || '')].reduce((sum, ch) => sum + (/[ㄱ-힝]/.test(ch) ? 11 : 6.5), 0);
  const placed = [...g.markers].sort((a, b) => a.at - b.at).map((marker) => ({ marker, at: x(marker.at), anchor: 'middle' }));
  placed.forEach((item, i) => {
    const prev = placed[i - 1];
    if (!prev) return;
    const edge = (p, side) => p.anchor === 'middle' ? p.at + side * labelWidth(p.marker.label) / 2 : p.anchor === 'end' ? (side < 0 ? p.at - labelWidth(p.marker.label) : p.at) : (side < 0 ? p.at : p.at + labelWidth(p.marker.label));
    if (edge(prev, 1) + 4 > edge(item, -1)) { if (i - 1 > 0 || prev.anchor === 'middle') prev.anchor = 'end'; item.anchor = 'start'; }
  });
  for (const item of placed) {
    add('line', { x1: item.at, x2: item.at, y1: 13, y2: 27, class: 'macro-gauge-tick' });
    add('text', { x: item.anchor === 'middle' ? item.at : item.at + (item.anchor === 'start' ? 2 : -2), y: 40, 'text-anchor': item.anchor, class: 'macro-gauge-label' }, item.marker.label);
  }
  const px = x(g.value);
  add('path', { d: `M${px - 6},4 L${px + 6},4 L${px},14 Z`, class: 'macro-gauge-pin' });
  add('line', { x1: px, x2: px, y1: 14, y2: 26, class: 'macro-gauge-needle' });
  const band = bandOf(g);
  const valueText = `${g.value > 0 && g.min < 0 ? '+' : ''}${signedNumber(g.value, g.digits)}${g.unit}`;
  svg.setAttribute('aria-label', `${g.label}: ${valueText}${band ? `, ${TONE_WORD[band.tone]} 구간` : ''}${g.clipped ? ' (눈금 밖)' : ''}`);
  const wrap = doc.createElement('div');
  wrap.className = 'macro-gauge-wrap';
  const caption = doc.createElement('div');
  caption.className = 'macro-gauge-caption';
  caption.textContent = `${g.label} · ${valueText}${g.clipped ? ' (눈금 밖)' : ''}`;
  wrap.append(caption, svg);
  return wrap;
}

function axisCard(doc, row, root = null) {
  const card = el(doc, 'section', null, 'regime-axis macro-axis');
  card.id = `macro-axis-${row.id}`;
  card.dataset.axis = row.id;
  card.dataset.state = row.state;
  const head = el(doc, 'div', null, 'regime-axis-head');
  head.append(el(doc, 'h3', row.title, 'regime-axis-title'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state}`));
  card.append(head);
  if (row.headline) card.append(el(doc, 'div', row.headline, 'macro-axis-headline'));
  const bar = gaugeBar(doc, row.gauge);
  if (bar) {
    card.append(bar);
    // A multi-condition rule can leave the drawn variable in a different band than the verdict; say so.
    const g = row.gauge;
    const band = bandOf(g);
    if (band && row.state !== 'unknown' && band.tone !== row.state) card.append(el(doc, 'p', `막대는 ${TONE_WORD[band.tone]} 구간이지만 다른 조건 때문에 ${row.stateLabel}입니다 — 아래 판정 기준 참고.`, 'macro-gauge-note'));
  }
  card.append(el(doc, 'p', row.read, 'regime-read'));
  if (row.caveat) card.append(el(doc, 'p', row.caveat, 'macro-gauge-note')); // M06: Brent against the WTI-only reading
  // The forward branches whose conditions this axis tests (BRANCHES[].axes) — each opens that branch on 거시.
  const branches = BRANCHES.filter((branch) => (branch.axes || []).includes(row.id));
  if (branches.length) {
    const strip = el(doc, 'div', null, 'macro-axis-branches');
    strip.append(el(doc, 'span', '관련 시나리오:', 'macro-axis-branches-label'));
    for (const branch of branches) {
      const button = el(doc, 'button', branch.title.split(' — ')[0], 'macro-axis-branch');
      button.type = 'button';
      button.title = `${branch.title} — 향후 시나리오에서 근거와 선택지 보기`;
      button.addEventListener('click', () => openCrossroadsBranch(doc, root, branch.id));
      strip.append(button);
    }
    card.append(strip);
  }
  // P1660: the fold teaches first (principle · reading · links), then today's numbers, the equity link and the rule.
  const extra = [];
  if (row.shared) extra.push(el(doc, 'span', '시장 상태와 같은 판정', 'basis-chip'));
  if (row.evidence?.length) {
    const list = el(doc, 'dl', null, 'regime-evidence');
    for (const [label, value] of row.evidence) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
    extra.push(el(doc, 'h4', '지금 숫자'), list);
  }
  if (row.link) {
    const link = el(doc, 'p', null, 'macro-axis-link');
    link.append(el(doc, 'span', '증시 연결', 'briefing-hypothesis-tag'), doc.createTextNode(` ${row.link}`));
    extra.push(link);
  }
  if (row.flip) extra.push(el(doc, 'p', `판정 기준: ${row.flip}`, 'regime-flip'));
  const fold = deepDiveFold(doc, root, row.title, MACRO_AXIS_DEEP_DIVES[row.id] || AXIS_DEEP_DIVES[row.id], extra);
  if (fold) { fold.classList.add('macro-axis-more'); card.append(fold); }
  return card;
}

function chainNode(doc, node) {
  // P1599 (A03): an inferred node (no direct observation) is drawn dashed so it never reads as a measured move.
  const box = el(doc, 'div', null, `macro-chain-node is-${node.impact || node.dir}${node.inferred ? ' is-inferred' : ''}`);
  box.append(el(doc, 'span', node.label, 'macro-chain-label'), el(doc, 'span', node.value, 'macro-chain-value'));
  // v57.81 (audit X4): a held node (WTI not confirmed by Brent) draws no arrow — the rate hub says 혼재 for the same pair.
  if (node.held) box.append(el(doc, 'span', '방향 보류', 'macro-chain-arrow is-held'));
  else if (node.dir === 'up' || node.dir === 'down') box.append(el(doc, 'span', node.dir === 'up' ? '▲' : '▼', 'macro-chain-arrow'));
  return box;
}

const BRANCH_ROUTES = Object.freeze({
  dollar: { route: 'fxbond', label: '금리 · 환율에서 달러·원·엔 추이', why: '달러·원화·엔화의 6개월 종가 추이와 환율 참고 지표' },
  credit: { route: 'sentiment', label: '투자 심리에서 신용·변동성', why: '하이일드 스프레드와 VIX가 심리와 같은 쪽인지' }
});

function renderChain(doc, chain) {
  const host = doc.getElementById('macro-chain');
  if (!host) return;
  const row = el(doc, 'div', null, 'macro-chain-row');
  chain.nodes.forEach((node, index) => {
    if (index) row.append(el(doc, 'span', '→', 'macro-chain-sep'));
    row.append(chainNode(doc, node));
  });
  const links = el(doc, 'ul', null, 'macro-chain-links');
  (chain.links.length ? chain.links : ['지금은 유가 → 물가 → 금리 경로에서 뚜렷하게 움직이는 고리가 없습니다.']).forEach((text) => links.append(el(doc, 'li', text)));
  const branches = el(doc, 'div', null, 'macro-chain-branches');
  chain.branches.forEach((branch) => {
    const box = el(doc, 'div', null, 'macro-chain-branch');
    box.append(chainNode(doc, branch), el(doc, 'p', branch.effect || '자료 대기', 'macro-chain-effect'));
    // v57.50 I04: each branch ends where its own evidence is read, so the chain is not a dead end.
    const target = BRANCH_ROUTES[branch.id];
    if (target) {
      const link = el(doc, 'button', `${target.label} →`, 'flow-next-link');
      link.type = 'button';
      link.dataset.action = 'showPage';
      link.dataset.arg = target.route;
      link.title = target.why;
      box.append(link);
    }
    branches.append(box);
  });
  host.replaceChildren(row, links, branches, el(doc, 'p', chain.legend || '', 'briefing-footnote macro-chain-legend'));
}

// P1427: growth × inflation as a 2 × 2 map — the current quadrant filled and marked, a known half shaded
// when only one direction is established, nothing marked when neither is.
const QUADRANTS = Object.freeze([
  { key: 'down/up', label: '스태그플레이션 위험', sub: '성장↓ 물가 속도↑', tone: 'burden', col: 0, row: 0 },
  { key: 'up/up', label: '과열 · 리플레이션', sub: '성장↑ 물가 속도↑', tone: 'neutral', col: 1, row: 0 },
  { key: 'down/down', label: '둔화 · 디스인플레이션', sub: '성장↓ 물가 속도↓', tone: 'neutral', col: 0, row: 1 },
  { key: 'up/down', label: '골디락스', sub: '성장↑ 물가 속도↓', tone: 'favorable', col: 1, row: 1 }
]);

function quadrantChart(doc, regime) {
  const W = 300;
  const H = 230;
  const pad = { left: 26, top: 10, right: 6, bottom: 24 };
  const cw = (W - pad.left - pad.right) / 2;
  const ch = (H - pad.top - pad.bottom) / 2;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'macro-quadrant');
  svg.setAttribute('role', 'img');
  const add = (tag, attrs, text) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  const current = regime.growthDir && regime.inflationDir ? `${regime.growthDir}/${regime.inflationDir}` : null;
  for (const q of QUADRANTS) {
    const [g, i] = q.key.split('/');
    const partial = !current && ((regime.growthDir && regime.growthDir === g) || (regime.inflationDir && regime.inflationDir === i));
    const state = current === q.key ? 'is-current' : partial ? 'is-partial' : '';
    const x = pad.left + q.col * cw;
    const y = pad.top + q.row * ch;
    add('rect', { x: x + 2, y: y + 2, width: cw - 4, height: ch - 4, rx: 6, class: `macro-quadrant-cell is-${q.tone} ${state}` });
    add('text', { x: x + cw / 2, y: y + ch / 2 - 4, 'text-anchor': 'middle', class: 'macro-quadrant-name' }, q.label);
    add('text', { x: x + cw / 2, y: y + ch / 2 + 13, 'text-anchor': 'middle', class: 'macro-quadrant-sub' }, q.sub);
    if (current === q.key) {
      add('circle', { cx: x + cw / 2, cy: y + ch / 2 + 32, r: 6, class: 'macro-quadrant-dot' });
      add('text', { x: x + cw / 2 + 11, y: y + ch / 2 + 36, class: 'macro-quadrant-now' }, '지금');
    }
  }
  add('text', { x: pad.left + cw, y: H - 6, 'text-anchor': 'middle', class: 'macro-quadrant-axis' }, '← 성장 둔화 · 성장 견조 →');
  add('text', { x: 10, y: pad.top + ch, 'text-anchor': 'middle', transform: `rotate(-90 10 ${pad.top + ch})`, class: 'macro-quadrant-axis' }, '← 물가 속도 둔화 · 물가 속도 상승 →');
  svg.setAttribute('aria-label', current ? `거시 국면: ${regime.label}` : '거시 국면 판정 보류');
  return svg;
}

function overviewTiles(doc, axes) {
  const strip = el(doc, 'div', null, 'macro-tiles');
  for (const row of axes) {
    const tile = el(doc, 'button', null, `macro-tile is-${row.state}`);
    tile.type = 'button';
    tile.dataset.axis = row.id;
    tile.append(el(doc, 'span', row.title.replace(/ \(.*\)$/, ''), 'macro-tile-title'), el(doc, 'span', row.stateLabel, 'macro-tile-state'), el(doc, 'span', row.headline || '—', 'macro-tile-value'));
    tile.addEventListener('click', () => doc.getElementById(`macro-axis-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    strip.append(tile);
  }
  return strip;
}

// The held quadrant in one sentence: why each undecided direction is held, and which direction is settled.
function heldRegimeLine(r) {
  const reasons = [];
  if (!r.growthDir) reasons.push(r.held?.growth === '근소(경계)' ? ['성장 방향이 기준과 차이가 작고', '성장 방향이 기준과 차이가 작아'] : r.held?.growth ? ['성장 방향이 견조·둔화 어느 기준에도 닿지 않고', '성장 방향이 견조·둔화 어느 기준에도 닿지 않아'] : ['성장 방향 자료가 부족하고', '성장 방향 자료가 부족해']);
  // v57.81 (audit X1): core PCE and core CPI pointing opposite ways is 엇갈림, named with each series' month.
  if (!r.inflationDir) reasons.push(r.held?.inflation === '엇갈림' ? [`근원 물가 속도가 지표마다 엇갈리고(${r.inflationSplit || '근원 PCE·CPI'})`, `근원 물가 속도가 지표마다 엇갈려(${r.inflationSplit || '근원 PCE·CPI'})`]
    : r.held?.inflation ? ['물가 속도가 기준과 차이가 작고', '물가 속도가 기준과 차이가 작아'] : ['물가 방향 자료가 부족하고', '물가 방향 자료가 부족해']);
  const why = reasons.map(([and, so], index) => (index === reasons.length - 1 ? so : and)).join(' ');
  const settled = [r.growthDir ? `성장 ${r.growthDir === 'up' ? '견조' : '둔화'}` : null, r.inflationDir ? `근원 물가 속도 ${r.inflationDir === 'up' ? '상승' : '둔화'}` : null].filter(Boolean);
  // v57.55 review (E2-14): "확정된 것은 물가 속도 둔화" beside a rising headline CPI — the settled direction is core pace only.
  return `${why || '방향이 정해지지 않아'} 국면을 정하지 않습니다${settled.length ? ` — 기준을 넘은 방향은 ${settled.join(' · ')}입니다(헤드라인 물가는 에너지 가격에 따라 다를 수 있습니다)` : ''}.`;
}

function renderRegime(doc, read) {
  const host = doc.getElementById('macro-regime');
  if (!host) return;
  const r = read.regime;
  const left = el(doc, 'div', null, 'macro-overview-map');
  left.append(quadrantChart(doc, r));
  // Expert review M12: which month each input describes, and a direction decided near its cut is called 근소.
  // v57.50 D16/D17: a direction inside its dead band is held — the note names the gap whether or not the quadrant is set.
  const nearText = [r.near?.growth ? `성장 방향은 근소(경계)로 보류 — ${r.near.growth}` : null, r.near?.inflation ? `물가 방향 보류 — ${r.near.inflation}` : null].filter(Boolean).join(' · ');
  const timingNote = r.timing || nearText ? el(doc, 'p', [r.timing, nearText ? `${nearText}.` : null].filter(Boolean).join(' '), 'briefing-footnote macro-quadrant-note') : null;
  if (r.available && timingNote) left.append(timingNote);
  const right = el(doc, 'div', null, 'macro-overview-side');
  const head = el(doc, 'div', null, 'macro-regime-head');
  head.append(el(doc, 'span', r.label, `macro-regime-label is-${r.tone}`));
  if (r.near?.growth || r.near?.inflation) head.append(el(doc, 'span', '기준선 근처 · 방향 보류', 'basis-chip is-off'));
  if (r.available && r.provisional) head.append(el(doc, 'span', '잠정 — 월별 추세 일부 미반영', 'basis-chip is-off'));
  const counts = read.counts;
  const tally = el(doc, 'div', null, 'macro-tally');
  for (const [state, label] of [['favorable', '양호'], ['neutral', '중립'], ['burden', '부담'], ['unknown', '보류']]) {
    if (state === 'unknown' && !counts.unknown) continue;
    tally.append(el(doc, 'span', `${label} ${counts[state]}`, `macro-tally-chip is-${state}`));
  }
  const reading = el(doc, 'p', null, 'briefing-read-reading');
  reading.append(el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${r.reading}`));
  // P1506: the quadrant reads the 3-month direction of growth and prices; the six cards judge today's level
  // against a threshold. A disinflation quadrant beside a 부담 price card is consistent once that is said.
  const lens = el(doc, 'p', '사분면은 성장·물가가 어느 쪽으로 움직이는지(물가는 3개월 속도), 아래 판정은 지금 수준이 증시에 부담인지를 봅니다. 물가 속도가 둔화돼도 수준이 목표보다 높으면 물가 요인은 부담으로 남습니다.', 'briefing-footnote macro-lens-note');
  const criteria = el(doc, 'details', null, 'macro-axis-more');
  if (r.available) {
    right.append(head, tally, lens, overviewTiles(doc, read.axes), reading);
    criteria.append(el(doc, 'summary', '국면 판정 기준과 지금 읽은 값'));
  } else {
    // A held quadrant is one line (why it is held, and which direction is settled); the reasoning folds below.
    right.append(head, tally, el(doc, 'p', heldRegimeLine(r), 'macro-regime-held'), overviewTiles(doc, read.axes));
    criteria.append(el(doc, 'summary', '보류 이유와 국면 판정 기준'), ...[timingNote, reading, lens].filter(Boolean));
  }
  criteria.append(el(doc, 'p', r.criteria || '', 'regime-flip'));
  if (Array.isArray(r.inputs) && r.inputs.length) {
    const table = el(doc, 'table', null, 'macro-regime-inputs');
    const head = el(doc, 'tr');
    ['지표', '지금 값', '기준', '판정'].forEach((label) => head.append(el(doc, 'th', label)));
    table.append(head);
    r.inputs.forEach((cells) => { const tr = el(doc, 'tr'); cells.forEach((cell) => tr.append(el(doc, 'td', cell))); table.append(tr); });
    criteria.append(table);
  }
  right.append(criteria);
  if (read.historyStatus !== 'ok') right.append(el(doc, 'p', '월별 경제 기록이 다음 자동 수집부터 쌓입니다. 그 전까지 성장·물가의 3개월 추세와 국면 판정은 일부 보류됩니다.', 'briefing-footnote'));
  const grid = el(doc, 'div', null, 'macro-overview');
  grid.append(left, right);
  host.replaceChildren(grid);
}

function renderCommodities(doc, root, oil = null) {
  const grid = doc.getElementById('macro-commodities');
  if (!grid) return;
  const history = root._aioHistory || [];
  const basis = closeBasis(history);
  const card = (field, title, digits, note, extra = null) => {
    const series = buildCloseSeries(history, field, { through: basis });
    const last = series[series.length - 1] || null;
    const back = (n) => sessionPointBack(series, n)?.value ?? null; // M01: n exchange sessions, not n rows
    const year = series.filter((row) => Date.parse(row.date) >= Date.parse(last?.date || 0) - 365 * 86400000).map((row) => row.value);
    const pos = year.length > 20 ? (last.value - Math.min(...year)) / ((Math.max(...year) - Math.min(...year)) || 1) * 100 : null;
    const chg = (n) => back(n) ? (last.value / back(n) - 1) * 100 : null;
    const box = el(doc, 'section', null, 'trend-card');
    box.dataset.metric = field;
    const head = el(doc, 'div', null, 'trend-card-head');
    head.append(el(doc, 'h3', title, 'trend-card-title'), el(doc, 'span', last ? `${last.value.toLocaleString('en-US', { maximumFractionDigits: digits })}달러` : '—', 'trend-card-value'));
    box.append(head);
    if (last) {
      const tags = el(doc, 'div', null, 'trend-card-tags');
      tags.append(el(doc, 'span', `${alignmentLabel(alignInput(last.date, basis))} 종가`, `basis-chip${alignInput(last.date, basis).status === 'aligned' ? '' : ' is-off'}`));
      box.append(tags, el(doc, 'div', `20일 ${signed(chg(20), 1, '%')} · 3개월 ${signed(chg(63), 1, '%')}${pos == null ? '' : ` · 1년 범위의 ${pos.toFixed(0)}% 위치`}`, 'trend-card-change'));
      if (extra) box.append(el(doc, 'div', extra, 'trend-card-change'));
    }
    box.append(createTrendChart(doc, { series: series.slice(-252), format: (value) => `${value.toFixed(0)}달러`, label: title }));
    box.append(el(doc, 'p', note, 'trend-card-note'));
    return box;
  };
  grid.replaceChildren(
    card('wti', 'WTI 원유', 2, `유가는 휘발유·운송비를 거쳐 물가(에너지는 CPI의 약 7%)와 소비 여력을 움직입니다. 빠르게 오르면 기대인플레이션과 금리를 밀어 올리고, 에너지주에는 유리하지만 항공·운송·소비재에는 비용 부담입니다. 시장 상태에서는 1년 범위 85% 이상이나 20일 +10% 이상을 부담으로 봅니다.`, oil?.sentence || null),
    card('gold', '금', 0, '금은 이자가 없는 자산이라 보통 실질금리가 오르면 약해집니다. 실질금리가 높은데도 금이 오르면 중앙은행 매입·위험 회피·달러 약세 같은 다른 수요가 작용했을 수 있습니다. 어느 쪽인지는 이 화면만으로 확정하지 않습니다.')
  );
}

// Expert review M11: the 한국 시장 fold's 1-year range and 3-month move of the won, from the completed-close history.
function renderKoreaWon(doc, root) {
  const range = doc.getElementById('kr-macro-krw-range');
  const trend = doc.getElementById('kr-macro-krw-3m');
  if (!range && !trend) return;
  const history = root._aioHistory || [];
  const series = buildCloseSeries(history, 'usdkrw', { through: closeBasis(history) });
  const last = series[series.length - 1];
  const won = (value) => `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}원`;
  const set = (node, text) => { if (node) node.textContent = text; };
  const year = last ? series.filter((row) => Date.parse(row.date) >= Date.parse(last.date) - 365 * 86400000) : [];
  if (year.length > 20) {
    const values = year.map((row) => row.value);
    const lo = Math.min(...values); const hi = Math.max(...values);
    set(range, `${won(lo)}–${won(hi)}`);
    set(doc.getElementById('kr-macro-krw-range-note'), `${shortDate(last.date)} 종가 ${won(last.value)} · 1년 범위의 ${((last.value - lo) / ((hi - lo) || 1) * 100).toFixed(0)}% 위치`);
  }
  const back = last ? sessionPointBack(series, 63) : null;
  if (back) {
    set(trend, signed((last.value / back.value - 1) * 100, 1, '%'));
    set(doc.getElementById('kr-macro-krw-3m-note'), `${shortDate(back.date)} ${won(back.value)} → ${shortDate(last.date)} ${won(last.value)} · 오르면 원화 약세`);
  }
}

export function renderMacroBoard({ documentRef: doc, root }) {
  const host = doc?.getElementById('macro-board');
  if (!host) return null;
  const macroHistory = root._aioMacroHistory || null;
  const board = buildMacroBoard({ macro: root._aioServerMacro || null, releases: root.AIO_MACRO_CALENDAR?.releases || {}, schedules: root.AIO_MACRO_OFFICIAL_SCHEDULES || {}, macroHistory });
  const regime = readMarketRegime(root);
  const read = buildMacroRead({ macro: root._aioServerMacro || null, macroHistory, regime: regime.available ? regime : null, history: root._aioHistory || [] });
  const basis = doc.getElementById('macro-board-basis');
  if (basis) basis.textContent = board.available ? '공식 발표와 미국 종가 기준 · 각 판정의 기준은 카드 아래에 표시' : '공식 발표 자료를 불러오는 중입니다.';
  renderMacroCrossroads({ documentRef: doc, root, regime }); // P1742; v57.76: the forward branches follow the chain (current state first)
  renderRegime(doc, read);
  const axesHost = doc.getElementById('macro-axes');
  if (axesHost) axesHost.replaceChildren(...read.axes.map((row) => axisCard(doc, row, root)));
  renderChain(doc, read.chain);
  host.replaceChildren(...board.groups.map((group) => {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = group.id;
    section.append(el(doc, 'h3', group.title, 'macro-group-title'), el(doc, 'p', group.fact, 'macro-group-fact'));
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    grid.append(...group.items.map((item) => statCard(doc, { label: item.label, valueText: item.valueText, lines: [item.deltaText, item.targetText, item.trendText], meta: item.meta, note: item.note, status: item.status, series: item.series, direction: item.direction, unit: item.unit })));
    section.append(grid);
    return section;
  }));
  // P1654: liquidity, growth-lead and commodity/Asia-FX groups from the extended FRED lane (hidden until produced).
  for (const group of buildLiquidityGrowthGroups(macroHistory, { macro: root._aioServerMacro || null, history: root._aioHistory || [] })) {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = group.id;
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    // M13/M14: the period the observation covers, and a stale chip once the cadence's normal delay has passed.
    grid.append(...group.items.map((item) => statCard(doc, { label: item.label, valueText: item.valueText, lines: [item.changeText], meta: `${item.period} · FRED`, note: item.reading, series: item.series, unit: item.unit, format: item.format, status: item.stale ? 'stale' : 'observed', staleText: '새 값 발표 지연' })));
    section.append(el(doc, 'h3', group.title, 'macro-group-title'), el(doc, 'p', group.fact, 'macro-group-fact'), grid);
    const fold = deepDiveFold(doc, root, group.title, MACRO_GROUP_DEEP_DIVES[group.id]); // P1660: a teaching fold
    if (fold) section.append(fold);
    host.append(section);
  }
  // 2026-10-14 (live review 4f): where this month sits in decades of history — a level, not a direction.
  const longRows = longHistoryRows(macroHistory?.long || null);
  if (longRows.length) {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = 'long-history';
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    grid.append(...longRows.map((row) => statCard(doc, { label: row.label, valueText: row.valueText, lines: [row.monthText, row.positionText], series: row.series, unit: row.unit, format: (value) => `${value.toFixed(2)}${row.unit}`, status: row.stale ? 'stale' : 'observed', staleText: '이번 수집 실패 · 직전 값', meta: 'FRED 월평균' })));
    // v57.79 (UI review): 실업률 · 근원 CPI · 10년물 · 2년물 also sit in the cards above (latest release or close) and on the
    // 금리 card (live close), so the same name showed three values. The cards above are the primary reading; this block
    // is folded behind its basis line (last completed month's average) so the values do not read as a contradiction.
    const fold = el(doc, 'details', null, 'regime-axis-details macro-long-fold');
    fold.append(el(doc, 'summary', `수십 년 속 위치 보기 (${longRows.length}개 지표)`),
      el(doc, 'p', `1990년(또는 자료 시작) 이후 매달 평균 가운데 가장 최근 마감된 달이 어디쯤인지 봅니다. 높은 편·낮은 편은 과거 분포 안의 위치일 뿐 앞으로의 방향을 말하지 않고, 오르는 중인지 내리는 중인지는 위 카드의 6개월 추세로 읽습니다.`, 'macro-group-fact'), grid);
    section.append(el(doc, 'h3', '수십 년 속 지금 위치', 'macro-group-title'),
      el(doc, 'p', '기준: 지난달 월평균 — 위 카드(최신 발표값)와 금리 카드(최근 종가)와는 기준 시점이 달라 같은 지표도 숫자가 다를 수 있습니다.', 'macro-group-fact macro-long-basis'), fold);
    host.append(section);
  }
  renderCommodities(doc, root, read.oil);
  renderKoreaWon(doc, root);
  renderNextSteps(doc, doc.getElementById('macro-next'), macroNextSteps(read)); // v57.50 I04
  host.dataset.aioMacroBoardRenderer = 'native';
  return { board, read };
}

// The Treasury par curve on a log-maturity axis (expert review M22: an evenly spaced axis drew 2→5 years as wide as
// 20→30 years and bent the curve's shape).
function curveSvg(doc, yields) {
  const points = yields.filter((row) => row.value != null);
  const W = 520;
  const H = 150;
  const pad = { top: 18, right: 24, bottom: 34, left: 54 }; // P1505: room between the lowest y label and the first tenor label
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'rates-curve');
  svg.setAttribute('role', 'img');
  svg.style.maxHeight = '220px'; // v57.91: a wide desktop column scaled the 150-unit chart (and its text) to about 2x
  if (points.length < 2) { svg.setAttribute('aria-label', '수익률 곡선 자료 부족'); return svg; }
  svg.setAttribute('aria-label', `미 국채 수익률 곡선: ${points.map((row) => `${row.label} ${row.value.toFixed(2)}%`).join(', ')}`);
  const values = points.map((row) => row.value);
  const lo = Math.floor((Math.min(...values) - 0.1) * 10) / 10;
  const hi = Math.ceil((Math.max(...values) + 0.1) * 10) / 10;
  const logs = yields.map((row) => Math.log(row.years || 1));
  const lx0 = Math.min(...logs); const lx1 = Math.max(...logs);
  const x = (index) => pad.left + ((logs[index] - lx0) / ((lx1 - lx0) || 1)) * (W - pad.left - pad.right);
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
    // v57.81: the last two tenors (20년·30년) sit 37 units apart; the narrow-screen label floor (responsive.css) turns them
    // away from each other instead of letting them touch. The classes do not change the drawn chart on their own.
    const edge = index === yields.length - 1 ? ' is-last' : index === yields.length - 2 ? ' is-penult' : '';
    // v57.91 (visual audit): the 20-year labels lean left of their point so they never meet the 30-year ones.
    const lean = index === yields.length - 2 ? { dx: -4, anchor: 'end' } : { dx: 0, anchor: 'middle' };
    add('text', { x: x(index) + lean.dx, y: H - 6, 'text-anchor': lean.anchor, class: `trend-chart-axis rates-curve-tenor${edge}` }, row.label);
    if (row.value == null) return;
    add('circle', { cx: x(index), cy: y(row.value), r: 3.5, class: 'rates-curve-dot' });
    add('text', { x: x(index) + lean.dx, y: y(row.value) - 8, 'text-anchor': lean.anchor, class: 'rates-curve-label' }, row.value.toFixed(2));
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
  const model = buildRatesFx({ macro: root._aioServerMacro || null, history: root._aioHistory || [], macroHistory: root._aioMacroHistory || null });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  const t = model.treasury;
  // P1426: the equity-impact axes for this tab — policy from the 거시 read, the rest shared with 시장 상태.
  const axesHost = doc.getElementById('rates-axes');
  const regime = readMarketRegime(root);
  const read = buildMacroRead({ macro: root._aioServerMacro || null, macroHistory: root._aioMacroHistory || null, regime: regime.available ? regime : null, history: root._aioHistory || [] });
  if (axesHost) {
    const byId = Object.fromEntries(read.axes.map((row) => [row.id, row]));
    const fxAxis = regime.available ? regime.axes.find((row) => row.id === 'korea') : null;
    // P1505: only the FX axis is unique to this tab; the other four are on the 거시 경제 six-axis board.
    void byId;
    const rows = [fxAxis && { ...fxAxis, shared: true, gauge: read.sharedGauges?.korea?.gauge || null, headline: read.sharedGauges?.korea?.headline || null, link: '원화가 약해지면 외국인이 한국 주식을 팔 유인이 커지고 수입 물가가 오릅니다. 엔화가 짧은 기간에 급등하면 엔으로 빌려 투자한 자금(엔 캐리)이 청산되며 전 세계 위험자산이 함께 흔들릴 수 있습니다.' }].filter(Boolean);
    axesHost.replaceChildren(...rows.map((row) => axisCard(doc, row, root)));
  }
  set('rates-basis', model.basis ? `${shortDate(model.basis)} 미국 종가 기준 · 국채 금리 ${t.asOf ? `${shortDate(t.asOf)} ` : ''}공식 고시 기준` : '종가 기록을 불러오는 중입니다.');

  // 1. Treasury curve
  set('rates-curve-basis', t.basisLabel || ''); // v57.50 C10: source and date of the curve's levels and changes
  const yieldRow = doc.getElementById('rates-yields');
  if (yieldRow) {
    yieldRow.replaceChildren(...t.yields.map((row) => {
      const cell = el(doc, 'div', null, 'rates-yield');
      if (row.derived) cell.title = '같은 날 10년물에서 10년–3개월 금리차를 빼서 구한 값';
      else if (row.id === 'dgs10' && t.basisLabel) cell.title = `${t.basisLabel}의 변화입니다. 시장 상태와 아래 10년물 카드의 '5일' 변화는 일별 종가 기준이라 기준일이 다를 수 있습니다.`;
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
  // P1426: the 10-year minus 3-month spread is the one the New York Fed's recession model uses.
  const t10y3m = seriesOf(root._aioMacroHistory, 't10y3m');
  const last3m = t10y3m[t10y3m.length - 1] || null;
  const spread3m = doc.getElementById('rates-spread-3m');
  if (spread3m) spread3m.textContent = last3m ? `10년–3개월 금리차 ${signed(last3m.value, 2, '%p')} (${shortDate(last3m.date)} — 뉴욕 연준 경기침체 확률 모형이 쓰는 금리차)` : '';
  const reading = doc.getElementById('rates-curve-reading');
  if (reading) reading.replaceChildren(...(t.reading ? [el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${t.reading}`)] : []));

  // 2. Real yield, breakeven, credit
  const levels = doc.getElementById('rates-levels');
  if (levels) {
    // P1427: each level card carries its one-year daily line from the FRED history (text + picture).
    const historyField = { realYield10: 'realYield10', breakeven10: 'breakeven10', hyOAS: 'hyOas' };
    levels.replaceChildren(...[...model.real, model.credit].map((row) => {
      const daily = seriesOf(root._aioMacroHistory, historyField[row.id]).slice(-260).map((point) => ({ date: point.date, value: row.id === 'hyOAS' ? point.value * 100 : point.value }));
      const year = daily.length > 200 ? daily[daily.length - 1].value - daily[0].value : null;
      return statCard(doc, {
        label: row.label,
        valueText: row.valueText,
        lines: [row.weekText, year == null ? null : `1년 전보다 ${signed(year, row.id === 'hyOAS' ? 0 : 2, row.id === 'hyOAS' ? 'bp' : '%p')}`],
        meta: row.asOf ? `${shortDate(row.asOf)} · FRED` : null,
        note: row.note,
        status: row.value == null ? 'missing' : row.stale ? 'stale' : 'observed',
        series: daily.length >= 20 ? daily : null,
        unit: row.id === 'hyOAS' ? null : '%',
        format: row.id === 'hyOAS' ? (value) => `${value.toFixed(0)}bp` : null // M16: the range keeps the bp unit
      });
    }));
    // P1469: the share of the 10-year yield that is compensation for holding duration rather than the
    // expected path of short rates — a model estimate, shown only once the FRED series has arrived.
    const premium = seriesOf(root._aioMacroHistory, 'termPremium10').slice(-260);
    const lastPremium = premium[premium.length - 1] || null;
    if (lastPremium) {
      const tenYear = seriesOf(root._aioMacroHistory, 'dgs10').filter((point) => point.date <= lastPremium.date).pop() || null;
      const back63 = premium.length > 63 ? premium[premium.length - 64] : null;
      const year = premium.length > 200 ? lastPremium.value - premium[0].value : null;
      const ageDays = (Date.now() - Date.parse(`${lastPremium.date}T00:00:00Z`)) / 86400000;
      const premiumLag = alignInput(lastPremium.date, model.basis).lag;
      levels.append(statCard(doc, {
        label: '10년 기간 프리미엄 (Kim-Wright)',
        valueText: `${signedNumber(lastPremium.value, 2)}%`,
        lines: [back63 ? `3개월 ${signed(lastPremium.value - back63.value, 2, '%p')}` : null, year == null ? null : `1년 전보다 ${signed(year, 2, '%p')}`,
          tenYear ? `같은 날 10년 금리 ${tenYear.value.toFixed(2)}% 중 단기금리 예상분 약 ${(tenYear.value - lastPremium.value).toFixed(2)}%` : null],
        meta: [shortDate(lastPremium.date), premiumLag ? `${premiumLag}거래일 전` : null, 'FRED THREEFYTP10 (연준 이사회 모형)'].filter(Boolean).join(' · '),
        note: '10년 금리 가운데 앞으로의 단기금리 예상이 아니라 오래 묶어 두는 위험에 대한 보상으로 추정되는 부분입니다. 관측값이 아닌 모형 추정치이고, 뉴욕 연준 ACM 등 다른 모형과는 수준이 다릅니다.',
        status: ageDays > 30 ? 'stale' : 'observed',
        series: premium.length >= 20 ? premium : null,
        unit: '%'
      }));
    }
  }

  // 3. Dollar, won, yen and the 10-year on the close basis
  const grid = doc.getElementById('rates-fx-grid');
  if (grid) {
    const tnxLast = model.tnx[model.tnx.length - 1] || null;
    const tc = model.tnxChange || {}; // v57.50 C10: the 시장 상태 series and session count
    const cards = [
      ...model.fx.map((card) => {
        const align = alignInput(card.asOf, model.basis);
        return trendCard(doc, {
          id: card.id,
          title: card.label,
          valueText: card.available ? card.valueText : '—',
          chip: card.available ? `${alignmentLabel(align)} 종가` : null,
          chipOff: align.status !== 'aligned',
          // P1725: the day change here is close-to-close on the FX trading day (New York evening); the live quote strip's
          // 전일 대비 is measured from the 08:00 KST cut, so the two can differ and the line says which this is.
          lines: card.available ? [`직전 거래일 종가 대비 ${signed(card.day, 2, '%')} · 20거래일 ${signed(card.change20, 1, '%')}`] : ['기록 수집 중'],
          series: card.series,
          format: (value) => `${value.toFixed(card.digits === 1 ? 0 : 1)}${card.unit || ''}`,
          note: card.id === 'usdjpy' ? model.carry.text : card.id === 'usdkrw' ? '원/달러가 오르면 원화 약세입니다. 일별 값은 뉴욕 외환 거래일 마감 무렵 종가라, 실시간 시세의 전일 대비(한국 시간 오전 8시 기준)와 기준 시각이 다릅니다.' : '주요 6개 통화 대비 달러 가치입니다.'
        });
      }),
      trendCard(doc, {
        id: 'tnx',
        title: '미 10년물 금리 (일별 종가)',
        valueText: tnxLast ? `${tnxLast.value.toFixed(2)}%` : '—',
        chip: tnxLast ? `${alignmentLabel(alignInput(tnxLast.date, model.basis))} 종가` : null,
        chipOff: tnxLast ? alignInput(tnxLast.date, model.basis).status !== 'aligned' : false,
        lines: [tnxLast && (tc.d5Bp != null || tc.d20Bp != null) ? [tc.d5Bp == null ? null : `5일 ${signed(tc.d5Bp, 0, 'bp')}`, tc.d20Bp == null ? null : `20일 ${signed(tc.d20Bp, 0, 'bp')}`].filter(Boolean).join(' · ') : null],
        series: model.tnx,
        format: (value) => `${value.toFixed(1)}%`,
        note: `일별 종가 기준이며 시장 상태의 10년물 5일·20일 변화와 같은 계열입니다. 위 재무부 공식 곡선${t.asOf ? `(${shortDate(t.asOf)})` : ''}과는 기준일과 소수점이 다를 수 있습니다.`
      })
    ];
    grid.replaceChildren(...cards);
  }
  syncOtherCurrencyNote(doc, root);
  renderNextSteps(doc, doc.getElementById('fxbond-next'), ratesNextSteps({ read, carry: model.carry })); // v57.50 I04
  page.dataset.aioRatesBoardRenderer = 'native';
  return model;
}

// Codex browser audit H18: "그 밖의 통화 · 실시간 시세 · 지연 가능" sat above once-a-day public reference rates with
// no change. The note now names what the cells actually hold — a market quote time, or a daily reference rate and
// its date — and an empty change cell for a reference rate is hidden instead of showing a fixed dash.
const OTHER_FX = Object.freeze(['EURUSD=X', 'GBPUSD=X', 'CNY=X', 'AUDUSD=X']);
export function describeOtherFx(live = {}) {
  const rows = OTHER_FX.map((symbol) => live?.[symbol]).filter((row) => row && Number.isFinite(Number(row.price ?? row.quoteEnvelope?.price ?? row.regularMarketPrice)));
  if (!rows.length) return { text: '시세 대기', reference: false };
  const basisOf = (row) => row.quoteEnvelope?.valueBasis || row.valueBasis || null;
  const sourceOf = (row) => String(row.quoteEnvelope?.source || row._source || row.source || '');
  const reference = rows.every((row) => basisOf(row) === 'daily-reference-rate' || sourceOf(row).startsWith('reference:fx'));
  const stamps = rows.map((row) => row.observedAt || row.quoteEnvelope?.observedAt).map((at) => (typeof at === 'number' ? at * (at < 1e12 ? 1000 : 1) : Date.parse(at))).filter(Number.isFinite);
  const latest = stamps.length ? new Date(Math.max(...stamps)) : null;
  const md = latest ? `${latest.getMonth() + 1}/${latest.getDate()}` : null;
  const hm = latest ? latest.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
  return reference
    ? { text: `참고 환율 · ${md ? `${md} 고시` : '고시일 미확인'} · 하루 1회 갱신, 등락 없음`, reference: true }
    : { text: latest ? `시장 시세 · ${md} ${hm} 관측` : '시장 시세 · 관측 시각 미확인', reference: false };
}
function syncOtherCurrencyNote(doc, root) {
  const note = doc.querySelector?.('#rates-other-title .rates-other-note');
  if (!note) return;
  const read = describeOtherFx(root?._liveData || {});
  // v57.91 (wording audit): with no quote at all, one line replaces a grid of eight dashes.
  const empty = read.text === '시세 대기';
  const grid = doc.querySelector?.('.rates-other');
  if (grid) grid.style.display = empty ? 'none' : ''; // the class sets display:grid, which a hidden attribute would not override
  note.textContent = empty ? '시세를 아직 받지 못했습니다' : read.text;
  for (const symbol of OTHER_FX) {
    const change = doc.querySelector?.(`.rates-other [data-live-chg="${symbol}"]`);
    if (change) change.hidden = read.reference;
  }
}
