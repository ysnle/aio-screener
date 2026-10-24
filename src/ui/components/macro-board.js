// P1425 (owner review 2026-10-03): the 거시 hub as two native boards.
// P1426: 거시 경제 now leads with the growth × inflation regime, six equity-impact axes (growth, inflation
// and policy rules here; rates, oil/dollar and credit shared with 시장 상태), the oil → inflation →
// policy → rates → valuation chain, then the indicator cards with 24-month trends and oil/gold charts.
//   거시 경제 (route macro)  — official monthly releases grouped as 정책금리 · 물가 · 고용 · 소비·주택,
//                              each card with reference month, release date, next release and source.
//   금리 · 환율 (route fxbond) — Treasury curve, real yield / breakeven / HY spread, and the dollar,
//                              won, yen and 10Y on the completed-close basis with six-month charts.
// Observations only: the fixed-threshold storyline, risk pill and four-axis bull/bear count are retired.
import { alignInput, alignmentLabel, buildCloseSeries, closeBasis, closeSessionMarket, sessionPointBack as closePointBack } from '../../domain/briefing/market-read.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { macroNextSteps, ratesNextSteps, seriesOf } from '../../domain/macro/macro-read.js';
import { renderNextSteps } from './page-flow.js';
import { readMarketRegime } from './market-regime.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { buildMacroBoard } from '../../domain/macro/indicators.js';
import { buildRatesFx, sessionPointBack, signed } from '../../domain/macro/rates-fx.js';
import { createTrendChart } from './trend-chart.js';
import { buildLiquidityGrowthGroups } from '../../domain/macro/liquidity-growth.js';
import { AXIS_DEEP_DIVES, MACRO_AXIS_DEEP_DIVES, MACRO_GROUP_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { deepDiveFold } from './deep-dive.js';
import { renderMacroCrossroads, openCrossroadsBranch } from './macro-crossroads.js';
import { BRANCHES } from '../../domain/market/macro-crossroads.js';
import { longHistoryRows } from '../../domain/macro/long-history.js';
import { taylorRule, TAYLOR_R_STAR_OPTIONS, TAYLOR_R_STAR_SEP } from '../../domain/macro/taylor-rule.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { usWeekendClosed } from '../../domain/market/market-calendar.js';
import { signedText } from '../../domain/shared/number.js';

const SVG = 'http://www.w3.org/2000/svg';

function signedNumber(value, digits) {
  return `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(digits)}`;
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
  const parts = String(meta || '').split(/ · |, /);
  const shown = []; const sources = [];
  for (const part of parts) (SOURCE_TOKEN.test(part.trim()) ? sources : shown).push(part);
  return { shown: shown.join(', '), sources };
}
function statCard(doc, { label, valueText, lines = [], meta, note, status, series = null, direction = null, unit = null, format = null, staleText = null }) {
  const card = el(doc, 'article', null, `macro-stat${status === 'missing' ? ' is-missing' : ''}`);
  const { shown: metaShown, sources: metaSources } = splitMeta(meta);
  if (metaSources.length) card.title = `출처: ${metaSources.join(', ')}`;
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
    card.append(el(doc, 'p', `기간 고점 ${fmtRange(Math.max(...values))}${suffix}, 저점 ${fmtRange(Math.min(...values))}${suffix}`, 'macro-spark-range'));
  }
  if (status === 'stale') card.append(el(doc, 'span', staleText || '이번 수집 실패, 직전 발표값', 'basis-chip is-off'));
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

// v58.53 (owner 2026-10-20: "실제 화면과 사용자 입장에서"): the indicator board was 3,500px on a desktop and 9,100px on a
// phone below the six factor rows that already carry today's verdict. Every group's title and one-line fact stay on the
// face (the 30-second read); its cards and charts open one group at a time, like the factor rows above. The reader's open
// group is kept across repaints. Folded, not removed: every card, chart and teaching fold is still one tap away.
function groupFold(doc, root, id, title, fact, count, body) {
  const fold = el(doc, 'details', null, 'macro-group-fold sx-disclosure');
  fold.dataset.fold = id;
  fold.open = root.__aioOpenMacroGroup === id;
  const summary = el(doc, 'summary', null, 'macro-group-summary');
  const text = el(doc, 'span', null, 'macro-group-summary__text');
  text.append(el(doc, 'h3', title, 'macro-group-title'), el(doc, 'p', fact, 'macro-group-fact'));
  summary.append(text, el(doc, 'span', `지표 ${count}개`, 'macro-group-count'));
  fold.append(summary, ...body);
  fold.addEventListener('toggle', () => {
    if (fold.open) {
      root.__aioOpenMacroGroup = id;
      fold.closest('#macro-board')?.querySelectorAll('details.macro-group-fold[open]').forEach((other) => { if (other !== fold) other.open = false; });
    } else if (root.__aioOpenMacroGroup === id) root.__aioOpenMacroGroup = null;
  });
  return fold;
}
// v58.74 (audit): '1년 전보다' compared with the first of the last 260 observations — about 13 months back on a series
// with gaps (HY +58bp vs +39bp over the actual year). The base is the last point on or before the same date a year earlier.
function yearChange(points) {
  const last = points[points.length - 1];
  if (!last || points.length < 200) return null;
  const target = new Date(`${last.date}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  const cutoff = target.toISOString().slice(0, 10);
  const base = points.filter((point) => point.date <= cutoff).pop();
  return base && cutoff.localeCompare(base.date) >= 0 && Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${base.date}T00:00:00Z`) <= 10 * 86400000 ? last.value - base.value : null;
}

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
  const labelWidth = (text) => [...String(text || '')].reduce((sum, ch) => sum + (/[ㄱ-힝]/.test(ch) ? 12 : 7.5), 0); // 12px labels (owner type scale 2026-10-23)
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
  caption.textContent = `${g.label}, ${valueText}${g.clipped ? ' (눈금 밖)' : ''}`;
  wrap.append(caption, svg);
  return wrap;
}

// v58.53 개편 v2 (3e): the six factors are single-open disclosure rows — title · verdict · headline value — that open
// into 원리 / 지금 읽기 (gauge + reading) / 주식에 주는 영향 cards, then the numbers, the rule and the evidence line.
const MACRO_REFS = Object.freeze({
  growth: ['Okun 1962, Sahm 2019', 'BLS 고용 보고서, Census 소매판매 (FRED)'],
  inflation: ['Phillips 1958, Friedman 1968', 'BEA PCE, BLS CPI (FRED)'],
  policy: ['Taylor 1993, 기대가설', '미 재무부 2년물, FOMC 목표 범위 (FRED)'],
  rates: ['Campbell·Shiller 1988, Adrian·Crump·Moench 2013', '미 재무부 10년물, DFII10 (FRED)'],
  commodities: ['Bruno·Shin 2015', 'WTI, 달러 인덱스 종가'],
  credit: ['Gilchrist·Zakrajšek 2012', 'ICE BofA 하이일드 OAS (FRED)']
});
const MACRO_OPEN_FIRST = ['inflation', 'policy', 'rates', 'growth', 'credit', 'commodities'];
// v58.75 (persona review, spec F2): how each factor's numbers lead or lag the cycle, and why the gap to expectations and a
// turn in direction move prices more than the level. One line per card, read before the numbers.
const AXIS_TIMING = Object.freeze({
  growth: '선행·후행 섞임 — 실업수당 청구는 먼저 움직이고, 일자리·소매판매는 경기와 같이, 실업률은 꺾인 뒤 늦게 오릅니다. 발표 날 가격은 수준보다 예상과의 차이에 반응합니다.',
  inflation: '후행 — 물가는 경기보다 늦게 움직입니다. 예상된 숫자는 이미 가격에 들어가 있어, 예상과의 차이와 3개월 속도의 방향 전환이 금리를 움직입니다.',
  policy: '기준금리는 후행, 2년물 금리는 선행 — 연준은 자료를 보고 움직이고, 2년물은 그 결정을 미리 가격에 넣습니다. 결정 자체보다 예상과 달랐는지가 중요합니다.',
  rates: '선행 — 10년물은 성장·물가 기대를 매일 가격에 넣습니다. 수준보다 빠른 방향 전환이 주식의 할인율을 바꿉니다.',
  commodities: '동행, 물가에는 선행 — 유가는 지금 수요와 공급을 보여 주고, 몇 달 뒤 헤드라인 물가로 이어집니다. 꾸준한 수준보다 급한 변화가 부담입니다.',
  credit: '선행에 가까움 — 신용 시장은 주식보다 먼저 위험을 가격에 넣는 경향이 있습니다. 스프레드 수준보다 빠르게 넓어지는지가 신호입니다.'
});
const CHIP = Object.freeze({ favorable: 'good', burden: 'warn', neutral: 'neutral', unknown: 'neutral' });

function axisCard(doc, row, root = null, open = false) {
  const card = el(doc, 'details', null, 'regime-axis macro-axis sx-disclosure mk-maxis');
  card.id = `macro-axis-${row.id}`;
  card.dataset.axis = row.id;
  card.dataset.state = row.state;
  card.open = !!open;
  const summary = el(doc, 'summary', null, 'mk-maxis__row');
  summary.append(el(doc, 'b', row.title, 'regime-axis-title mk-maxis__title'), el(doc, 'span', row.stateLabel, `regime-state is-${row.state} sx-chip sx-chip--sm sx-chip--${CHIP[row.state] || 'neutral'}`),
    el(doc, 'span', row.headline || '—', 'macro-axis-headline mk-maxis__value'));
  card.append(summary);
  const deep = MACRO_AXIS_DEEP_DIVES[row.id] || AXIS_DEEP_DIVES[row.id];
  const body = el(doc, 'div', null, 'sx-disclosure__body mk-maxis__body');
  const cardOf = (label, ...nodes) => { const box = el(doc, 'div', null, 'sx-disclosure__card'); box.append(el(doc, 'span', label, 'sx-disclosure__label'), ...nodes.filter(Boolean)); return box; };
  const now = cardOf('지금 읽기');
  now.append(el(doc, 'p', row.read, 'regime-read sx-disclosure__text'));
  if (row.caveat) now.append(el(doc, 'p', row.caveat, 'macro-gauge-note')); // M06: Brent against the WTI-only reading
  body.append(cardOf('원리', deep?.blocks?.[0] ? el(doc, 'p', deep.blocks[0][1], 'sx-disclosure__text') : null), now,
    cardOf('주식에 주는 영향', row.link ? el(doc, 'p', row.link, 'sx-disclosure__text macro-axis-link') : el(doc, 'p', '—', 'sx-disclosure__text')));
  const facts = el(doc, 'div', null, 'mk-maxis__facts');
  if (AXIS_TIMING[row.id]) facts.append(el(doc, 'p', `읽는 법: ${AXIS_TIMING[row.id]}`, 'regime-flip macro-axis-timing'));
  // P1427: the threshold gauge spans the full row width under the three cards (in a card column it shrank past legibility).
  const bar = gaugeBar(doc, row.gauge);
  if (bar) {
    facts.append(bar);
    // A multi-condition rule can leave the drawn variable in a different band than the verdict; say so.
    const g = row.gauge;
    const band = bandOf(g);
    if (band && row.state !== 'unknown' && band.tone !== row.state) facts.append(el(doc, 'p', `막대는 ${TONE_WORD[band.tone]} 구간이지만 다른 조건 때문에 ${row.stateLabel}입니다 — 아래 판정 기준 참고.`, 'macro-gauge-note'));
  }
  if (row.shared) facts.append(el(doc, 'span', '시장 상태와 같은 판정', 'basis-chip'));
  if (row.evidence?.length) {
    const list = el(doc, 'dl', null, 'regime-evidence');
    for (const [label, value] of row.evidence) list.append(el(doc, 'dt', label), el(doc, 'dd', value));
    facts.append(el(doc, 'h4', '지금 숫자'), list);
  }
  if (row.flip) facts.append(el(doc, 'p', `판정 기준: ${row.flip}`, 'regime-flip'));
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
    facts.append(strip);
  }
  // P1660: the rest of the teaching (how practitioners read it, links to other factors) folds one level down.
  const fold = deepDiveFold(doc, root, row.title, deep ? { ...deep, blocks: (deep.blocks || []).slice(1) } : null);
  if (fold) { fold.classList.add('macro-axis-more'); facts.append(fold); }
  body.append(facts);
  card.append(body);
  const [refs, data] = MACRO_REFS[row.id] || [];
  if (refs || data) {
    const line = el(doc, 'p', null, 'sx-evidence mk-maxis__evidence');
    line.append(el(doc, 'span', `학술 근거, ${refs || '—'}`), el(doc, 'span', `데이터, ${data || '—'}`));
    card.append(line);
  }
  // Single-open accordion (README: openMacro); the choice survives a repaint.
  card.addEventListener('toggle', () => {
    if (card.open) {
      if (root) root.__aioOpenMacro = row.id;
      for (const other of card.parentElement?.children || []) if (other !== card && other.open) other.open = false;
    } else if (root?.__aioOpenMacro === row.id) root.__aioOpenMacro = '';
  });
  return card;
}

// v58.53 개편 v2 (3e): the rate strip under the factors — the Fisher split of the 10-year yield (DGS10 ≈ DFII10 + T10YIE on
// one shared FRED date) and the 10-year − 3-month spread (T10Y3M).
// v58.55: the design's Taylor-rule tile, now that CBO's natural rate (FRED NROU) is collected — see taylorTile below.
function basisValue(doc, text, explanation, asOf) {
  const node = el(doc, 'b', text, 'mk-rate-tile__value');
  node.title = explanation;
  if (asOf) { node.dataset.asOf = asOf; node.dataset.cadence = 'session'; }
  return node;
}

function renderRateStrip(doc, root) {
  const host = doc.getElementById('macro-rate-strip');
  if (!host) return;
  const series = root?._aioMacroHistory?.series || {};
  const obs = (key) => new Map((series[key]?.observations || []).filter(([, value]) => Number.isFinite(value)));
  const nominal = obs('dgs10'), real = obs('realYield10'), bei = obs('breakeven10');
  const common = [...nominal.keys()].filter((date) => real.has(date) && bei.has(date)).sort().at(-1) || null;
  const spread = (series.t10y3m?.observations || []).filter(([, value]) => Number.isFinite(value)).at(-1) || null;
  const pct = (value) => `${value.toFixed(2)}%`;
  const dateChip = (date) => {
    const old = date && Date.now() - Date.parse(`${date}T00:00:00Z`) > 7 * 86400000;
    return el(doc, 'span', `${shortDate(date)} 관측`, old ? 'sx-chip sx-chip--sm sx-chip--date' : 'sx-meta');
  };
  const tiles = [];
  if (common) {
    const n = nominal.get(common), r = real.get(common), b = bei.get(common);
    const gap = n - (r + b);
    const tile = el(doc, 'div', null, 'mk-rate-tile');
    // v58.53: the face values carry their basis (value-basis.js turns title + data-as-of into the tap/hover basis card).
    const value = basisValue(doc, `${pct(n)} ≈ ${pct(r)} + ${pct(b)}`, '10년물 명목 금리를 같은 날의 10년 실질금리(TIPS)와 기대 인플레이션(BEI)으로 나눈 값입니다. 세 값이 모두 있는 가장 최근 관측일 기준입니다.', common);
    tile.append(el(doc, 'span', '명목 금리 분해, 피셔 방정식', 'mk-rate-tile__label'), value,
      el(doc, 'span', `10년 실질금리(TIPS) + 기대 인플레이션(BEI)${Math.abs(gap) >= 0.005 ? `, 나머지 ${signedText(gap, 2, '%p')}` : ''}`, 'mk-rate-tile__note'),
      // v58.74 (text audit): the expert's next step after the split — which part carries the level.
      el(doc, 'span', Math.abs(r - b) < 0.1 ? '실질금리와 기대 인플레이션이 비슷한 몫을 차지합니다.' : r > b ? `실질금리가 기대 인플레이션보다 커, 10년물 수준은 물가 기대보다 실질금리(성장·기간 프리미엄) 쪽에서 더 나옵니다.` : `기대 인플레이션이 실질금리보다 커, 10년물 수준은 물가 기대 쪽에서 더 나옵니다.`, 'mk-rate-tile__note'), dateChip(common));
    tiles.push(tile);
  }
  if (spread) {
    const [date, value] = spread;
    const tile = el(doc, 'div', null, 'mk-rate-tile');
    tile.append(el(doc, 'span', '장단기 금리차, 10년 − 3개월', 'mk-rate-tile__label'), basisValue(doc, signedText(value, 2, '%p'), '10년물 금리에서 3개월물 금리를 뺀 값입니다. 0 아래면 역전입니다.', date),
      el(doc, 'span', value >= 0 ? '역전 아님 — 경기 침체 확률 모형에 쓰이는 대표 입력' : '역전 — 과거 미국 경기 침체 대부분에 앞섰던 신호', 'mk-rate-tile__note'), dateChip(date));
    tiles.push(tile);
  }
  const taylor = taylorRule({ macroHistory: root?._aioMacroHistory || null, macro: root?._aioServerMacro || null, rStar: root?.__aioTaylorRStar });
  if (tiles.length || taylor.inflation || taylor.unemployment) tiles.push(taylorTile(doc, root, taylor));
  host.hidden = !tiles.length;
  if (!tiles.length) { host.replaceChildren(); return; }
  const grid = el(doc, 'div', null, 'mk-rate-strip__grid');
  grid.append(...tiles);
  const line = el(doc, 'p', null, 'sx-evidence mk-rate-strip__evidence');
  line.append(el(doc, 'span', '근거, Fisher 1930, Estrella·Mishkin 1998, Taylor 1993'), el(doc, 'span', '데이터, FRED (DGS10, DFII10, T10YIE, T10Y3M, PCEPILFE, UNRATE, NROU, FEDTARMDLR, DFEDTARL/U)'));
  // Round-2 review (v58.55): a repaint (r* switch, data refresh) keeps the formula fold open if the reader opened it.
  const wasOpen = !!host.querySelector?.('.mk-taylor__fold')?.open;
  const fold = taylorFold(doc, root, taylor);
  fold.open = wasOpen;
  host.replaceChildren(grid, fold, line);
}

// v58.55 (개편 v2 3e): Taylor (1993) as a reference point for the policy rate; the face shows where the actual target-range
// midpoint sits against the rule, never what the Fed should do.
// v58.56 (re-audit #14): r* defaults to the FOMC's dated estimate (SEP longer-run median − 2%); 0.5%/1.0% moved into the
// formula fold as alternatives, so the face no longer asks the reader to pick an assumption before seeing a number.
const STANCE_WORD = Object.freeze({ near: '준칙 근처', tighter: '준칙보다 긴축적', looser: '준칙보다 완화적' });
const sepMonth = (date) => `${String(date).slice(2, 4)}년 ${Number(String(date).slice(5, 7))}월`;
function rStarText(t) {
  if (t.rStarSource === TAYLOR_R_STAR_SEP) return `r* ${t.rStar.toFixed(2).replace(/0$/, '')}% = FOMC 장기 금리 전망 ${t.sep.longRun.toFixed(2).replace(/0$/, '')}% − 물가 목표 2%`;
  return `r* ${t.rStar.toFixed(1)}% 가정`;
}
function taylorRStarSeg(doc, root, t) {
  const seg = el(doc, 'div', null, 'sx-seg mk-taylor__seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', '중립 실질금리(r*) 기준');
  const options = [...(t.sep ? [{ key: TAYLOR_R_STAR_SEP, label: `FOMC 전망 기준 ${t.sep.rStar.toFixed(2).replace(/0$/, '')}%` }] : []), ...TAYLOR_R_STAR_OPTIONS.map((option) => ({ key: String(option), label: `r* ${option.toFixed(1)}% 가정` }))];
  const current = t.rStarSource === TAYLOR_R_STAR_SEP ? TAYLOR_R_STAR_SEP : String(t.rStar);
  for (const option of options) {
    const button = el(doc, 'button', option.label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(option.key === current));
    button.dataset.rStar = option.key;
    // Round-2 review (v58.55): the strip is rebuilt, so focus returns to the same option instead of dropping to <body>.
    button.addEventListener('click', () => {
      root.__aioTaylorRStar = option.key === TAYLOR_R_STAR_SEP ? TAYLOR_R_STAR_SEP : Number(option.key);
      renderRateStrip(doc, root);
      doc.querySelector?.(`.mk-taylor__seg button[data-r-star="${option.key}"]`)?.focus();
    });
    seg.append(button);
  }
  return seg;
}
function taylorTile(doc, root, t) {
  const tile = el(doc, 'div', null, 'mk-rate-tile mk-taylor');
  const head = el(doc, 'div', null, 'mk-taylor__head');
  head.append(el(doc, 'span', '테일러 준칙 대비 정책금리', 'mk-rate-tile__label'));
  const pct = (value, digits = 2) => `${value.toFixed(digits)}%`;
  tile.append(head);
  // Round-2 review (v58.55): every input names its year, so a value carried over from an older release cannot pass as current.
  const yy = (date) => String(date).slice(2, 4);
  const month = (date) => `${yy(date)}년 ${Number(String(date).slice(5, 7))}월`;
  const quarter = (date) => `${yy(date)}년 ${Math.floor((Number(String(date).slice(5, 7)) - 1) / 3) + 1}분기`;
  const inputs = [
    t.inflation ? `근원 PCE ${pct(t.inflation.value, 1)} (${month(t.inflation.date)})` : '근원 PCE 없음',
    t.unemployment ? `실업률 ${pct(t.unemployment.value, 1)} (${month(t.unemployment.date)})` : '실업률 없음',
    t.natural ? `자연실업률 ${pct(t.natural.value, 1)} (CBO ${quarter(t.natural.date)})` : null
  ].filter(Boolean).join(', ');
  if (!t.available) {
    // Until the producer's first run with NROU, the inputs that exist are shown and the rule waits — no assumed u*.
    tile.append(el(doc, 'b', '수집 대기', 'mk-rate-tile__value is-pending'),
      el(doc, 'span', `${t.natural ? '' : 'CBO 자연실업률(NROU)을 다음 자료 갱신부터 받아 계산합니다. '}${inputs}`, 'mk-rate-tile__note'));
    if (t.stale) tile.append(taylorStaleLine(doc, t));
    return tile;
  }
  const valueText = t.diff == null ? `준칙 ${pct(t.rule)}` : `${signed(t.diff, 2)}%p ${STANCE_WORD[t.stance]}`;
  const value = basisValue(doc, valueText, '실제 연준 목표 범위 중간값에서 테일러 준칙 금리를 뺀 값입니다. 양수면 정책금리가 준칙보다 높아(긴축적) 있고, 음수면 낮습니다. 연준이 따라야 하는 값이 아니라 비교 기준입니다.', null); // inputs carry their months below
  const target = t.target ? `실제 목표 범위 ${t.target.lower.toFixed(2)}~${t.target.upper.toFixed(2)}% (중간 ${t.target.mid.toFixed(2)}%${t.target.asOf ? `, ${shortDate(String(t.target.asOf).slice(0, 10))} 기준` : ''})` : '실제 목표 범위 자료 없음';
  const basis = el(doc, 'span', null, 'mk-rate-tile__note mk-taylor__basis');
  basis.append(doc.createTextNode(`준칙 ${pct(t.rule)} (${rStarText(t)})`));
  if (t.rStarSource === TAYLOR_R_STAR_SEP) {
    // The SEP date is the estimate's own date; older than one release cycle → the amber date chip.
    basis.append(doc.createTextNode(' '), el(doc, 'span', `${sepMonth(t.sep.date)} SEP`, t.sep.old || t.sep.stale ? 'sx-chip sx-chip--sm sx-chip--date' : 'sx-meta'));
  } else if (!t.sep) {
    basis.append(doc.createTextNode(', FOMC 장기 금리 전망(SEP)은 다음 자료 갱신부터 기준으로 씁니다'));
  }
  tile.append(value, basis,
    el(doc, 'span', `${target}, r* 0.5~1.0% 가정 시 준칙 ${pct(t.range.lo)}~${pct(t.range.hi)}`, 'mk-rate-tile__note'),
    el(doc, 'span', `${inputs}, 실업률 갭 ${signed(t.unemploymentGap, 1)}%p`, 'mk-rate-tile__note'));
  const tension = taylorTension(t, root?._aioServerMacro || null);
  if (tension) tile.append(el(doc, 'span', tension, 'mk-rate-tile__note mk-taylor__tension'));
  if (t.stale) tile.append(taylorStaleLine(doc, t));
  return tile;
}

// v58.74 (text audit C3): the rule gap next to what the 2-year prices — where the market leans relative to the rule. The
// 2-year carries term premium, so the sentence says where prices sit, not what the Fed will do.
function taylorTension(t, macro) {
  const twoYear = Number(macro?.dgs2);
  if (t.diff == null || t.stance === 'near' || !t.target || !Number.isFinite(twoYear)) return null;
  const pricing = twoYear - t.target.mid;
  const gap = `정책금리는 준칙보다 ${Math.abs(t.diff).toFixed(2)}%p ${t.diff < 0 ? '낮고' : '높고'}`;
  if (Math.abs(pricing) < 0.1) return `${gap}, 2년물은 기준금리 중간값 부근(${signedText(pricing, 2, '%p')})입니다 — 시장은 그 차이를 좁히는 쪽을 아직 가격에 넣지 않았습니다.`;
  const toward = (t.diff < 0 && pricing > 0) || (t.diff > 0 && pricing < 0);
  return `${gap}, 2년물은 기준금리 중간값보다 ${Math.abs(pricing).toFixed(2)}%p ${pricing > 0 ? '높습니다' : '낮습니다'} — 시장 금리는 ${toward ? `준칙 쪽(${pricing > 0 ? '더 높은' : '더 낮은'} 금리)으로 기울어 있습니다` : '준칙과 반대쪽으로 더 벌어져 있습니다'}. 2년물에는 기간 프리미엄도 섞여 있어 정책 예상으로 단정하지 않습니다.`;
}

// Round-2 review (v58.55): an input kept from an earlier run, or inputs more than three months apart, get the amber date chip
// and a plain sentence — the number stays, but it is not presented as today's reading.
const TAYLOR_SERIES_NAME = Object.freeze({ corePceIndex: '근원 PCE', unemployment: '실업률', naturalUnemployment: 'CBO 자연실업률' });
function taylorStaleLine(doc, t) {
  const line = el(doc, 'span', null, 'mk-rate-tile__note mk-taylor__stale');
  const reasons = [
    t.staleSeries.length ? `${t.staleSeries.map((field) => TAYLOR_SERIES_NAME[field]).join("·")}: 이번 수집에 실패해 직전 값을 씁니다` : null,
    t.spreadMonths > 3 ? `입력 시점이 ${t.spreadMonths}개월 벌어져 있습니다` : null
  ].filter(Boolean).join(', ');
  line.append(el(doc, 'span', '지난 값 포함', 'sx-chip sx-chip--sm sx-chip--date'), doc.createTextNode(` ${reasons} — 최신 값으로 보지 않습니다.`));
  return line;
}

function taylorFold(doc, root, t) {
  const fold = el(doc, 'details', null, 'sx-disclosure mk-taylor__fold');
  fold.append(el(doc, 'summary', '테일러 준칙 — 계산식과 한계'));
  const body = el(doc, 'div', null, 'sx-disclosure__body mk-taylor__body');
  const card = (title, text) => { const box = el(doc, 'div', null, 'sx-disclosure__card'); box.append(el(doc, 'span', title, 'sx-disclosure__label'), el(doc, 'p', text, 'sx-disclosure__text')); return box; };
  const filled = t.available
    ? ` 지금: ${String(Math.round(t.rStar * 1000) / 1000)} + ${t.inflation.value.toFixed(2)} + 0.5×(${t.inflation.value.toFixed(2)} − 2) + 0.5×(${t.outputGap.toFixed(2)}) = ${t.rule.toFixed(2)}%.`
    : '';
  body.append(
    card('계산식', `준칙 금리 = r* + 물가 + 0.5×(물가 − 2%) + 0.5×(산출 갭). 물가는 연준 목표 지표인 근원 PCE 전년 대비, 산출 갭은 오쿤의 법칙으로 실업률에서 환산합니다(산출 갭 ≈ -2 × (실업률 − CBO 자연실업률)).${filled}`),
    card('r*는 추정값입니다', `r*(중립 실질금리)는 직접 관측되지 않습니다. 기본값은 FOMC 위원들의 장기 연방기금금리 전망 중앙값(경제전망 요약 SEP, 분기마다 발표)에서 물가 목표 2%를 뺀 값${t.sep ? ` — ${t.sep.date} 발표 ${t.sep.longRun.toFixed(2).replace(/0$/, '')}% − 2% = ${t.sep.rStar.toFixed(2).replace(/0$/, '')}%` : '이며, 아직 수집 전이라 0.5% 가정으로 계산합니다'}. 아래에서 0.5%·1.0% 가정으로 바꿔 볼 수 있습니다. r*가 0.5%p 달라지면 준칙 금리도 그대로 0.5%p 달라집니다.`),
    card('한계', '존 테일러(1993)가 과거 연준 정책을 요약한 기준선입니다. 연준은 이 식을 기계적으로 따르지 않고, 자연실업률·r* 추정 오차와 금융 여건·위험 관리도 함께 봅니다. 준칙과의 차이는 정책 위치를 설명할 뿐 다음 결정을 예측하지 않습니다.')
  );
  if (t.available) body.append(taylorRStarSeg(doc, root, t));
  fold.append(body);
  return fold;
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
  dollar: { route: 'fxbond', label: '금리와 환율에서 달러·원·엔 추이', why: '달러·원화·엔화의 6개월 종가 추이와 환율 참고 지표' },
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
  // v58.74 (text audit C6): the bridge the scenario section promised — which links moved toward burden, and what the
  // scenarios below count.
  const moved = [...chain.nodes, ...chain.branches].filter((node) => node.impact === 'burden').map((node) => node.label.replace(/ \(.*\)$/, ''));
  const bridge = moved.length ? `이 경로에서 지금 부담 쪽으로 움직인 고리는 ${moved.join(', ')}입니다. 아래 향후 시나리오는 이 움직임이 어디로 이어지는지를 조건으로 셉니다.`
    : '이 경로에서 부담 쪽으로 뚜렷하게 움직인 고리는 없습니다. 아래 향후 시나리오는 어느 고리가 먼저 움직일지를 조건으로 셉니다.';
  host.replaceChildren(row, links, branches, el(doc, 'p', bridge, 'macro-chain-bridge'), el(doc, 'p', chain.legend || '', 'briefing-footnote macro-chain-legend'));
}

// P1427: growth × inflation as a 2 × 2 map — the current quadrant filled and marked, a known half shaded
// when only one direction is established, nothing marked when neither is.
const QUADRANTS = Object.freeze([
  { key: 'down/up', label: '스태그플레이션 위험', sub: '성장↓ 물가 속도↑', tone: 'burden', col: 0, row: 0 },
  { key: 'up/up', label: '과열, 리플레이션', sub: '성장↑ 물가 속도↑', tone: 'neutral', col: 1, row: 0 },
  { key: 'down/down', label: '둔화, 디스인플레이션', sub: '성장↓ 물가 속도↓', tone: 'neutral', col: 0, row: 1 },
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
  add('text', { x: pad.left + cw, y: H - 6, 'text-anchor': 'middle', class: 'macro-quadrant-axis' }, '← 성장 둔화, 성장 견조 →');
  add('text', { x: 10, y: pad.top + ch, 'text-anchor': 'middle', transform: `rotate(-90 10 ${pad.top + ch})`, class: 'macro-quadrant-axis' }, '← 물가 속도 둔화, 물가 속도 상승 →');
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
    tile.addEventListener('click', () => { const target = doc.getElementById(`macro-axis-${row.id}`); if (target && 'open' in target) target.open = true; target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
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
  // v58.74 (text audit #18/C2): the line also says what settles it, so the fold no longer repeats the same reason.
  return `${why || '방향이 정해지지 않아'} 국면을 정하지 않습니다${settled.length ? ` — 기준을 넘은 방향은 ${settled.join(', ')}입니다(헤드라인 물가는 에너지 가격에 따라 다를 수 있습니다)` : ''}.${r.decider ? ` ${r.decider}` : ''}`;
}

function renderRegime(doc, read) {
  const host = doc.getElementById('macro-regime');
  if (!host) return;
  const r = read.regime;
  const left = el(doc, 'div', null, 'macro-overview-map');
  left.append(quadrantChart(doc, r));
  // Expert review M12: which month each input describes, and a direction decided near its cut is called 근소.
  // v57.50 D16/D17: a direction inside its dead band is held — the note names the gap whether or not the quadrant is set.
  const nearText = [r.near?.growth ? `성장 방향은 근소(경계)라 보류합니다. ${r.near.growth}.` : null, r.near?.inflation ? `물가 방향은 보류합니다. ${r.near.inflation}.` : null].filter(Boolean).join(' ');
  const timingNote = r.timing || nearText ? el(doc, 'p', [r.timing, nearText || null].filter(Boolean).join(' '), 'briefing-footnote macro-quadrant-note') : null;
  if (r.available && timingNote) left.append(timingNote);
  const right = el(doc, 'div', null, 'macro-overview-side');
  const head = el(doc, 'div', null, 'macro-regime-head');
  head.append(el(doc, 'span', r.label, `macro-regime-label is-${r.tone}`));
  if (r.near?.growth || r.near?.inflation) head.append(el(doc, 'span', '기준선 근처, 방향 보류', 'basis-chip is-off'));
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
    criteria.append(el(doc, 'summary', '보류 이유와 국면 판정 기준'), ...[timingNote, lens].filter(Boolean));
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
      box.append(tags, el(doc, 'div', `20일 ${signed(chg(20), 1, '%')}, 3개월 ${signed(chg(63), 1, '%')}${pos == null ? '' : `, 1년 범위의 ${pos.toFixed(0)}% 위치`}`, 'trend-card-change'));
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

// v58.75 (persona review): no producer publishes Korea's manufacturing PMI or quarterly GDP (DATA_SNAPSHOT keeps them
// null), so the 경기지표 card showed two '—' rows whenever the export reference made it visible. A row still on '—'
// is hidden and the card names what is not collected in one line; a value that arrives later shows its row again.
const KR_UNCOLLECTED = Object.freeze([['kr-manuf-pmi', '제조업 PMI'], ['kr-gdp-qoq', 'GDP 성장률(전분기 대비)']]);
function syncUncollectedKorea(doc) {
  const missing = [];
  let card = null;
  for (const [snap, label] of KR_UNCOLLECTED) {
    const cell = doc.querySelector(`#kr-integrated-macro [data-snap="${snap}"]`);
    if (!cell) continue;
    card = card || cell.closest('.aio-widget');
    const empty = /^(—|-|.*미수신)?$/.test(String(cell.textContent || '').trim());
    const row = cell.parentElement;
    if (row) row.hidden = empty;
    if (empty) missing.push(label);
  }
  if (!card) return;
  let note = card.querySelector('.kr-uncollected-note');
  if (!missing.length) { note?.remove(); return; }
  if (!note) { note = el(doc, 'p', null, 'sh-muted-note kr-uncollected-note'); card.querySelector('.widget-title')?.after(note); }
  note.textContent = `아직 수집하지 않는 자료: 한국 ${missing.join(', ')}`;
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
    set(doc.getElementById('kr-macro-krw-range-note'), `${shortDate(last.date)} 종가 ${won(last.value)}, 1년 범위의 ${((last.value - lo) / ((hi - lo) || 1) * 100).toFixed(0)}% 위치`);
  }
  const back = last ? sessionPointBack(series, 63) : null;
  if (back) {
    set(trend, signed((last.value / back.value - 1) * 100, 1, '%'));
    set(doc.getElementById('kr-macro-krw-3m-note'), `${shortDate(back.date)} ${won(back.value)} → ${shortDate(last.date)} ${won(last.value)}, 오르면 원화 약세`);
  }
  // v58.74 (text audit C6): the won block reads its own move against the dollar index over the same 3 months — a won move
  // much larger than the dollar's is more likely Korea-specific (flows, exports) than U.S. rates.
  const dxy = buildCloseSeries(history, 'dxy', { through: closeBasis(history) });
  const dxyLast = dxy[dxy.length - 1];
  const dxyBack = dxyLast ? sessionPointBack(dxy, 63) : null;
  const readNode = doc.getElementById('kr-macro-krw-read');
  if (readNode && back && dxyBack) {
    const krw = (last.value / back.value - 1) * 100;
    const usd = (dxyLast.value / dxyBack.value - 1) * 100;
    const wonWord = krw > 0 ? '약세' : '강세';
    readNode.textContent = Math.abs(krw) < 1 ? `원화는 3개월 동안 큰 변화가 없습니다(원/달러 ${signed(krw, 1, '%')}, 달러 인덱스 ${signed(usd, 1, '%')}).`
      : Math.abs(krw) >= Math.abs(usd) * 2 || Math.sign(krw) !== Math.sign(usd)
        ? `원화는 3개월 ${wonWord}(원/달러 ${signed(krw, 1, '%')})로, 같은 기간 달러 인덱스(${signed(usd, 1, '%')})보다 움직임이 커 미국 금리보다 한국 쪽 요인(수급·수출)이 더 컸을 수 있습니다.`
        : `원화는 3개월 ${wonWord}(원/달러 ${signed(krw, 1, '%')})이고, 달러 인덱스도 같은 쪽(${signed(usd, 1, '%')})이라 달러 전체 흐름과 함께 움직였습니다.`;
  }
}

// v58.74 (text audit C1): the page opens with its through-line — which factors weigh, whether the quadrant is set, which
// branch fits best and the release that decides next — so the sections below read as steps of one argument.
function macroThroughLine(read, crossroads) {
  const axes = read?.axes || [];
  if (!axes.length) return null;
  // v58.75 (persona review): "부담은 3개(통화정책, 유가, 달러, 신용)" read as four — a comma inside one factor name is '·'.
  const burden = axes.filter((row) => row.state === 'burden').map((row) => row.title.replace(/ \(.*\)$/, '').replace(/,\s*/g, '·'));
  const weigh = burden.length ? `거시 6요인 중 부담은 ${burden.length}개(${burden.join(', ')})` : '거시 6요인 중 부담 요인은 없고';
  const quadrant = read.regime?.available ? `국면은 '${read.regime.label}'` : '성장·물가 국면은 방향 보류';
  const lead = crossroads?.leadId ? crossroads.items?.find((item) => item.id === crossroads.leadId) : null;
  const branch = lead ? ` 조건이 가장 많이 맞는 시나리오는 '${lead.title.split(' — ')[0]}'(${lead.fit})입니다.` : ' 핵심 조건을 갖춘 시나리오는 아직 없습니다.';
  const next = crossroads?.nextEvent ? ` 다음 갈림길은 ${crossroads.nextEvent.when || crossroads.nextEvent.date} ${crossroads.nextEvent.name}입니다.` : '';
  return `${weigh}${burden.length ? '이고' : ''}, ${quadrant}입니다.${branch}${next}`;
}

export function renderMacroBoard({ documentRef: doc, root }) {
  const host = doc?.getElementById('macro-board');
  if (!host) return null;
  const macroHistory = root._aioMacroHistory || null;
  const board = buildMacroBoard({ macro: root._aioServerMacro || null, releases: root.AIO_MACRO_CALENDAR?.releases || {}, schedules: root.AIO_MACRO_OFFICIAL_SCHEDULES || {}, macroHistory });
  readMarketRegime(root); // keeps the macro-history refresh request
  const { regime, macroRead: read, crossroads } = marketInterpretation(root); // owner 2026-10-19: the shared macro read (same as the branches)
  const basis = doc.getElementById('macro-board-basis');
  if (basis) {
    basis.textContent = board.available ? macroThroughLine(read, crossroads) || '공식 발표와 미국 종가 기준' : '공식 발표 자료를 불러오는 중입니다.';
    basis.title = '공식 발표와 미국 종가 기준';
  }
  renderMacroCrossroads({ documentRef: doc, root, regime }); // P1742; v57.76: the forward branches follow the chain (current state first)
  renderRegime(doc, read);
  const axesHost = doc.getElementById('macro-axes');
  if (axesHost) {
    // README: the default open row is the key burden factor (물가 first); a reader's own choice is kept across repaints.
    const openId = typeof root.__aioOpenMacro === 'string' ? root.__aioOpenMacro
      : MACRO_OPEN_FIRST.find((id) => read.axes.some((row) => row.id === id && row.state === 'burden')) || '';
    axesHost.replaceChildren(...read.axes.map((row) => axisCard(doc, row, root, row.id === openId)));
  }
  renderRateStrip(doc, root);
  renderChain(doc, read.chain);
  host.replaceChildren(...board.groups.map((group) => {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = group.id;
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    grid.append(...group.items.map((item) => statCard(doc, { label: item.label, valueText: item.valueText, lines: [item.deltaText, item.targetText, item.trendText], meta: item.meta, note: item.note, status: item.status, series: item.series, direction: item.direction, unit: item.unit })));
    section.append(groupFold(doc, root, group.id, group.title, group.fact, group.items.length, [grid]));
    return section;
  }));
  // P1654: liquidity, growth-lead and commodity/Asia-FX groups from the extended FRED lane (hidden until produced).
  for (const group of buildLiquidityGrowthGroups(macroHistory, { macro: root._aioServerMacro || null, history: root._aioHistory || [] })) {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = group.id;
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    // M13/M14: the period the observation covers, and a stale chip once the cadence's normal delay has passed.
    grid.append(...group.items.map((item) => statCard(doc, { label: item.label, valueText: item.valueText, lines: [item.changeText], meta: item.period, note: item.reading, series: item.series, unit: item.unit, format: item.format, status: item.stale ? 'stale' : 'observed', staleText: '새 값 발표 지연(평소 발표 주기보다 늦음)' })));
    const fold = deepDiveFold(doc, root, group.title, MACRO_GROUP_DEEP_DIVES[group.id]); // P1660: a teaching fold
    section.append(groupFold(doc, root, group.id, group.title, group.fact, group.items.length, fold ? [grid, fold] : [grid]));
    host.append(section);
  }
  // 2026-10-14 (live review 4f): where this month sits in decades of history — a level, not a direction.
  const longRows = longHistoryRows(macroHistory?.long || null);
  if (longRows.length) {
    const section = el(doc, 'section', null, 'macro-group');
    section.dataset.group = 'long-history';
    const grid = el(doc, 'div', null, 'macro-stat-grid');
    grid.append(...longRows.map((row) => statCard(doc, { label: row.label, valueText: row.valueText, lines: [row.monthText, row.positionText], series: row.series, unit: row.unit, format: (value) => `${value.toFixed(2)}${row.unit}`, status: row.stale ? 'stale' : 'observed', staleText: '이번 수집 실패, 직전 값', meta: 'FRED 월평균' })));
    // v57.79 (UI review): 실업률 · 근원 CPI · 10년물 · 2년물 also sit in the cards above (latest release or close) and on the
    // 금리 card (live close), so the same name showed three values. The cards above are the primary reading; this block
    // is folded behind its basis line (last completed month's average) so the values do not read as a contradiction.
    const fold = el(doc, 'details', null, 'regime-axis-details macro-long-fold');
    fold.append(el(doc, 'summary', `수십 년 속 위치 보기 (${longRows.length}개 지표)`),
      el(doc, 'p', `1990년(또는 자료 시작) 이후 매달 평균 가운데 가장 최근 마감된 달이 어디쯤인지 봅니다. 높은 편·낮은 편은 과거 분포 안의 위치일 뿐 앞으로의 방향을 말하지 않고, 오르는 중인지 내리는 중인지는 위 카드의 6개월 추세로 읽습니다.`, 'macro-group-fact'), grid);
    section.append(el(doc, 'h3', '수십 년 속 지금 위치', 'macro-group-title'),
      el(doc, 'p', '기준은 지난달 월평균입니다. 위 카드(최신 발표값)나 금리 카드(최근 종가)와 시점이 달라 같은 지표도 숫자가 다를 수 있습니다.', 'macro-group-fact macro-long-basis'), fold);
    host.append(section);
  }
  renderCommodities(doc, root, read.oil);
  renderKoreaWon(doc, root);
  syncUncollectedKorea(doc);
  renderNextSteps(doc, doc.getElementById('macro-next'), macroNextSteps(read)); // v57.50 I04
  host.dataset.aioMacroBoardRenderer = 'native';
  return { board, read };
}

// The Treasury par curve on a log-maturity axis (expert review M22: an evenly spaced axis drew 2→5 years as wide as
// 20→30 years and bent the curve's shape).
function curveSvg(doc, yields, previous = null) {
  const points = yields.filter((row) => row.value != null);
  // Screen audit 2026-10-20: a phone scaled the 520×150 chart to about 100px tall with 8px labels; narrow screens get a taller frame.
  const narrow = Number(doc.defaultView?.innerWidth) > 0 && doc.defaultView.innerWidth < 600;
  const W = narrow ? 360 : 520;
  const H = narrow ? 200 : 150;
  const pad = { top: 18, right: 24, bottom: 34, left: 54 }; // P1505: room between the lowest y label and the first tenor label
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'rates-curve');
  svg.setAttribute('role', 'img');
  svg.style.maxHeight = '220px'; // v57.91: a wide desktop column scaled the 150-unit chart (and its text) to about 2x
  if (points.length < 2) { svg.setAttribute('aria-label', '수익률 곡선 자료 부족'); return svg; }
  const prevLabel = previous?.points?.length ? `, 1개월 전(${shortDate(previous.date)}): ${previous.points.map((row) => `${row.label} ${row.value.toFixed(2)}%`).join(', ')}` : '';
  svg.setAttribute('aria-label', `미 국채 수익률 곡선: ${points.map((row) => `${row.label} ${row.value.toFixed(2)}%`).join(', ')}${prevLabel}`);
  // v58.55 (5e): the dashed "1개월 전" curve shares the scale, so its points are part of the range.
  const prevById = new Map((previous?.points || []).map((row) => [row.id, row.value]));
  const values = [...points.map((row) => row.value), ...prevById.values()];
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
  const prevPath = yields.map((row, index) => (prevById.has(row.id) ? `${x(index)},${y(prevById.get(row.id))}` : null)).filter(Boolean);
  if (prevPath.length >= 2) add('polyline', { points: prevPath.join(' '), class: 'rates-curve-prev' });
  const path = yields.map((row, index) => (row.value == null ? null : `${x(index)},${y(row.value)}`)).filter(Boolean).join(' ');
  add('polyline', { points: path, class: 'trend-chart-line' });
  // v58.55: on the narrow frame 20년 sits ~24 units from 30년 and its labels ran into 10년/30년 once the chart drew at its
  // real height; a label too close to the one kept to its right is dropped (the dot stays, the value is in the row below).
  // v58.56 (re-audit #9): with up to eleven tenors (1개월…30년) the short end is crowded on every width, so labels are
  // placed by priority — 30년·10년·2년·3개월·5년 first, then the rest where they fit. Every dot stays; every value is in
  // the row of tenors below the chart and in the chart's aria-label.
  const minGap = narrow ? 52 : 30; // narrow labels render ~45 units wide after the phone font floor
  const PRIORITY = ['dgs30', 'dgs10', 'dgs2', 'dgs3mo', 'dgs5', 'dgs1mo', 'dgs1', 'dgs20', 'dgs6mo', 'dgs7', 'dgs3'];
  const rank = (row) => { const at = PRIORITY.indexOf(row.id); return at < 0 ? PRIORITY.length : at; };
  const labelled = new Set();
  yields.map((row, index) => ({ row, index })).sort((a, b) => rank(a.row) - rank(b.row)).forEach(({ index }) => {
    // On a phone the 1개월 label would sit against 3개월 (two-character Hangul labels), so only its dot is drawn there.
    if (narrow && yields[index].id === 'dgs1mo') return;
    if ([...labelled].every((other) => Math.abs(x(other) - x(index)) >= minGap)) labelled.add(index);
  });
  yields.forEach((row, index) => {
    // v57.81: the last two tenors (20년·30년) sit 37 units apart; the narrow-screen label floor (responsive.css) turns them
    // away from each other instead of letting them touch. The classes do not change the drawn chart on their own.
    const edge = index === yields.length - 1 ? ' is-last' : index === yields.length - 2 ? ' is-penult' : '';
    // v57.91 (visual audit): the 20-year labels lean left of their point so they never meet the 30-year ones.
    const lean = index === yields.length - 2 ? { dx: -4, anchor: 'end' } : { dx: 0, anchor: 'middle' };
    if (labelled.has(index)) add('text', { x: x(index) + lean.dx, y: H - 6, 'text-anchor': lean.anchor, class: `trend-chart-axis rates-curve-tenor${edge}` }, row.label);
    if (row.value == null) return;
    add('circle', { cx: x(index), cy: y(row.value), r: 3.5, class: 'rates-curve-dot' });
    if (labelled.has(index)) add('text', { x: x(index) + lean.dx, y: y(row.value) - 8, 'text-anchor': lean.anchor, class: 'rates-curve-label' }, row.value.toFixed(2));
  });
  return svg;
}

// v58.55 (5e): legend for the two curves — the official cut's date and the dashed line one month (21 sessions) earlier.
// Tenors without collected history are named as 수집 대기 rather than drawn from a guess.
function curveLegend(doc, t) {
  const legend = el(doc, 'div', null, 'rates-curve-legend');
  if (t.asOf) legend.append(el(doc, 'span', shortDate(t.asOf), 'rates-curve-key is-now'));
  const prev = t.previous;
  if (prev) {
    const key = el(doc, 'span', `1개월 전, ${shortDate(prev.date)}`, 'rates-curve-key is-prev');
    key.title = `${prev.date} FRED H.15 국채 고정만기 금리(미 재무부 공식 곡선과 같은 값) — 이날과 오늘 모두 값이 있는 만기만 잇습니다.`;
    legend.append(key);
    if (prev.pending.length) legend.append(el(doc, 'span', `${prev.pending.join('·')} 1개월 전 값 수집 대기`, 'rates-curve-key is-pending'));
  } else if (t.asOf) {
    legend.append(el(doc, 'span', '1개월 전 곡선 수집 대기', 'rates-curve-key is-pending'));
  }
  // v58.56: a short/middle tenor with no value on the official cut's date is named, not drawn from another day.
  if (t.pendingTenors?.length) legend.append(el(doc, 'span', `${t.pendingTenors.join('·')} 수집 대기`, 'rates-curve-key is-pending'));
  return legend;
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
  readMarketRegime(root); // keeps the macro-history refresh request
  const { regime, macroRead: read } = marketInterpretation(root); // owner 2026-10-19: the shared macro read
  if (axesHost) {
    const byId = Object.fromEntries(read.axes.map((row) => [row.id, row]));
    const fxAxis = regime.available ? regime.axes.find((row) => row.id === 'korea') : null;
    // P1505: only the FX axis is unique to this tab; the other four are on the 거시 경제 six-axis board.
    void byId;
    const rows = [fxAxis && { ...fxAxis, shared: true, gauge: read.sharedGauges?.korea?.gauge || null, headline: read.sharedGauges?.korea?.headline || null, link: '원화가 약해지면 외국인이 한국 주식을 팔 유인이 커지고 수입 물가가 오릅니다. 엔화가 짧은 기간에 급등하면 엔으로 빌려 투자한 자금(엔 캐리)이 청산되며 전 세계 위험자산이 함께 흔들릴 수 있습니다.' }].filter(Boolean);
    axesHost.replaceChildren(...rows.map((row) => axisCard(doc, row, root)));
  }
  set('rates-basis', model.basis ? `${shortDate(model.basis)} 미국 종가 기준, 국채 금리 ${t.asOf ? `${shortDate(t.asOf)} ` : ''}공식 고시 기준` : '종가 기록을 불러오는 중입니다.');

  // 1. Treasury curve
  set('rates-curve-basis', t.basisLabel || ''); // v57.50 C10: source and date of the curve's levels and changes
  const yieldRow = doc.getElementById('rates-yields');
  if (yieldRow) {
    yieldRow.replaceChildren(...t.yields.map((row) => {
      const cell = el(doc, 'div', null, 'rates-yield');
      if (row.derived) cell.title = '같은 날 10년물에서 10년–3개월 금리차를 빼서 구한 값';
      else if (row.source === 'fred') cell.title = `${row.asOf} FRED H.15 국채 고정만기 금리 — 미 재무부 공식 곡선과 같은 값입니다.`;
      else if (row.id === 'dgs10' && t.basisLabel) cell.title = `${t.basisLabel}의 변화입니다. 시장 상태와 아래 10년물 카드의 '5일' 변화는 일별 종가 기준이라 기준일이 다를 수 있습니다.`;
      cell.append(el(doc, 'span', row.label, 'rates-yield-label'), el(doc, 'span', row.value == null ? '—' : `${row.value.toFixed(2)}%`, 'rates-yield-value'));
      const changes = [row.day == null ? null : `1일 ${signed(row.day * 100, 0, 'bp')}`, row.week == null ? null : `1주 ${signed(row.week * 100, 0, 'bp')}`].filter(Boolean);
      for (const change of changes) cell.append(el(doc, 'span', change, 'rates-yield-change'));
      return cell;
    }));
  }
  const curveHost = doc.getElementById('rates-curve');
  if (curveHost) curveHost.replaceChildren(curveLegend(doc, t), curveSvg(doc, t.yields, t.previous));
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
  // Expertise review 2026-10-19: which leg moved the curve over 20 sessions, and whether an inversion just ended.
  let dynamicsHost = doc.getElementById('rates-curve-dynamics');
  if (!dynamicsHost && spread3m) { dynamicsHost = el(doc, 'p', null, 'rates-curve-fact'); dynamicsHost.id = 'rates-curve-dynamics'; spread3m.after(dynamicsHost); }
  if (dynamicsHost) {
    const d = t.dynamics;
    const interpretation = [d?.reading, d?.uninversionReading, d?.uninversion3mText].filter(Boolean).join(' ');
    dynamicsHost.replaceChildren(...(d ? [
      el(doc, 'strong', `곡선 움직임: ${d.label}.`), doc.createTextNode(` ${d.fact}`),
      ...(interpretation ? [doc.createElement('br'), el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(` ${interpretation}`)] : [])
    ] : []));
  }

  // 2. Real yield, breakeven, credit
  const levels = doc.getElementById('rates-levels');
  if (levels) {
    // P1427: each level card carries its one-year daily line from the FRED history (text + picture).
    const historyField = { realYield10: 'realYield10', breakeven10: 'breakeven10', hyOAS: 'hyOas' };
    // v58.75 (persona review): the high-yield spread card was the fourth copy of the same series (시장 상태 credit axis with
    // its chart, the 거시 credit factor, 투자 심리's card); here it is one dated line pointing to the judgement on 시장 상태.
    levels.replaceChildren(...model.real.map((row) => {
      const full = seriesOf(root._aioMacroHistory, historyField[row.id]).map((point) => ({ date: point.date, value: row.id === 'hyOAS' ? point.value * 100 : point.value }));
      const daily = full.slice(-260);
      const year = yearChange(full);
      return statCard(doc, {
        label: row.label,
        valueText: row.valueText,
        lines: [row.weekText, year == null ? null : `1년 전보다 ${signed(year, row.id === 'hyOAS' ? 0 : 2, row.id === 'hyOAS' ? 'bp' : '%p')}`],
        meta: row.asOf ? shortDate(row.asOf) : null,
        note: row.note,
        status: row.value == null ? 'missing' : row.stale ? 'stale' : 'observed',
        series: daily.length >= 20 ? daily : null,
        unit: row.id === 'hyOAS' ? null : '%',
        format: row.id === 'hyOAS' ? (value) => `${value.toFixed(0)}bp` : null // M16: the range keeps the bp unit
      });
    }));
    // P1469: the share of the 10-year yield that is compensation for holding duration rather than the
    // expected path of short rates — a model estimate, shown only once the FRED series has arrived.
    const premiumFull = seriesOf(root._aioMacroHistory, 'termPremium10');
    const premium = premiumFull.slice(-260);
    const lastPremium = premium[premium.length - 1] || null;
    if (lastPremium) {
      const tenYear = seriesOf(root._aioMacroHistory, 'dgs10').filter((point) => point.date <= lastPremium.date).pop() || null;
      const back63 = premium.length > 63 ? premium[premium.length - 64] : null;
      const year = yearChange(premiumFull);
      const ageDays = (Date.now() - Date.parse(`${lastPremium.date}T00:00:00Z`)) / 86400000;
      const premiumLag = alignInput(lastPremium.date, model.basis).lag;
      levels.append(statCard(doc, {
        label: '10년 기간 프리미엄 (Kim-Wright)',
        valueText: `${signedNumber(lastPremium.value, 2)}%`,
        lines: [back63 ? `3개월 ${signed(lastPremium.value - back63.value, 2, '%p')}` : null, year == null ? null : `1년 전보다 ${signed(year, 2, '%p')}`,
          tenYear ? `같은 날 10년 금리 ${tenYear.value.toFixed(2)}% 중 단기금리 예상분 약 ${(tenYear.value - lastPremium.value).toFixed(2)}%` : null],
        meta: [shortDate(lastPremium.date), premiumLag ? `${premiumLag}거래일 전` : null, 'FRED THREEFYTP10 (연준 이사회 모형)'].filter(Boolean).join(', '),
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
          lines: card.available ? [`직전 거래일 종가 대비 ${signed(card.day, 2, '%')}, 20거래일 ${signed(card.change20, 1, '%')}`] : ['기록 수집 중'],
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
        lines: [tnxLast && (tc.d5Bp != null || tc.d20Bp != null) ? [tc.d5Bp == null ? null : `5일 ${signed(tc.d5Bp, 0, 'bp')}`, tc.d20Bp == null ? null : `20일 ${signed(tc.d20Bp, 0, 'bp')}`].filter(Boolean).join(', ') : null],
        series: model.tnx,
        format: (value) => `${value.toFixed(1)}%`,
        note: `일별 종가 기준이며 시장 상태의 10년물 5일·20일 변화와 같은 계열입니다. 위 공식 국채 곡선${t.asOf ? `(${shortDate(t.asOf)})` : ''}과는 기준일과 소수점이 다를 수 있습니다.`
      })
    ];
    grid.replaceChildren(...cards);
  }
  renderRatesSummary(doc, model, read);
  renderCreditLink(doc, model.credit, regime);
  renderErpLine(doc, root);
  renderAssetPerformance(doc, root, model.basis);
  syncOtherCurrencyNote(doc, root);
  renderNextSteps(doc, doc.getElementById('fxbond-next'), ratesNextSteps({ read, carry: model.carry })); // v57.50 I04
  page.dataset.aioRatesBoardRenderer = 'native';
  return model;
}

// v58.75 (persona review): an asset allocator reads rates and FX against what the asset classes did. One line (the
// strongest and weakest of the investable rows over 3 months, and the stock-bond correlation), the S&P 500–TLT 60-session
// correlation line over the record the TLT series has, and a 1M/3M/YTD table from the daily closes in history.json.
const ASSET_ROWS = Object.freeze([
  ['spx', 'S&P 500', true], ['ndx', '나스닥 100', true], ['rut', '러셀 2000', true], ['rsp', 'S&P 500 동일가중 (RSP)', true],
  ['tlt', '미 장기채 (TLT)', true], ['gold', '금', true], ['dxy', '달러 인덱스', false], ['wti', 'WTI 원유', true],
  ['kospi', '한국 코스피', true], ['usdkrw', '한국 원/달러 (오르면 원화 약세)', false]
]);
const CORR_WINDOW = 60;

export function buildAssetPerformance(history = [], basis = closeBasis(history)) {
  const year = String(basis || '').slice(0, 4);
  const rows = ASSET_ROWS.map(([field, label, investable]) => {
    const series = buildCloseSeries(history, field, { through: basis });
    const last = series.at(-1) || null;
    if (!last) return { field, label, investable, last: null, m1: null, m3: null, ytd: null, ytdFrom: null };
    const market = closeSessionMarket(field) || 'US';
    const back = (n) => { const point = closePointBack(series, n, market); return point ? (last.value / point.value - 1) * 100 : null; };
    const prevYear = year ? series.filter((point) => point.date < `${year}-01-01`).at(-1) : null;
    return { field, label, investable, last, m1: back(21), m3: back(63), ytd: prevYear ? (last.value / prevYear.value - 1) * 100 : null, ytdFrom: prevYear?.date || null };
  });
  // Daily simple returns on the dates both US closes exist, then a trailing 60-session Pearson correlation.
  const spx = buildCloseSeries(history, 'spx', { through: basis });
  const tltBy = new Map(buildCloseSeries(history, 'tlt', { through: basis }).map((point) => [point.date, point.value]));
  const joint = spx.filter((point) => tltBy.has(point.date)).map((point) => ({ date: point.date, a: point.value, b: tltBy.get(point.date) }));
  const returns = joint.slice(1).map((point, i) => ({ date: point.date, a: point.a / joint[i].a - 1, b: point.b / joint[i].b - 1 }));
  const corr = [];
  for (let i = CORR_WINDOW - 1; i < returns.length; i += 1) {
    const win = returns.slice(i - CORR_WINDOW + 1, i + 1);
    const ma = win.reduce((sum, row) => sum + row.a, 0) / CORR_WINDOW, mb = win.reduce((sum, row) => sum + row.b, 0) / CORR_WINDOW;
    let sab = 0, saa = 0, sbb = 0;
    for (const row of win) { sab += (row.a - ma) * (row.b - mb); saa += (row.a - ma) ** 2; sbb += (row.b - mb) ** 2; }
    if (saa > 0 && sbb > 0) corr.push({ date: returns[i].date, value: Number((sab / Math.sqrt(saa * sbb)).toFixed(3)) });
  }
  return { basis, rows, corr, corrFrom: joint[0]?.date || null, jointSessions: joint.length };
}

function renderAssetPerformance(doc, root, basis) {
  let host = doc.getElementById('rates-assets');
  if (!host) {
    const anchor = doc.getElementById('rates-fx-grid')?.closest('section');
    if (!anchor) return;
    host = el(doc, 'section', null, 'briefing-block rates-block');
    host.id = 'rates-assets';
    host.setAttribute('aria-labelledby', 'rates-assets-title');
    anchor.after(host);
  }
  const model = buildAssetPerformance(root._aioHistory || [], basis || undefined);
  const title = el(doc, 'h2', '자산군 성과와 주식·채권 상관', 'briefing-h2');
  title.id = 'rates-assets-title';
  if (model.basis) title.append(el(doc, 'span', `${shortDate(model.basis)} 종가 기준`, 'briefing-h2-note'));
  const ranked = model.rows.filter((row) => row.investable && row.m3 != null).sort((a, b) => b.m3 - a.m3);
  if (!ranked.length) { host.replaceChildren(title, el(doc, 'div', '자산별 종가 기록을 불러오는 중입니다.', 'briefing-empty')); return; }
  const nowCorr = model.corr.at(-1) || null;
  const corrText = nowCorr ? ` S&P 500과 미 장기채의 최근 ${CORR_WINDOW}거래일 상관은 ${nowCorr.value.toFixed(2)}입니다.` : '';
  const lead = el(doc, 'p', `최근 3개월 가장 강한 자산은 ${ranked[0].label}(${signed(ranked[0].m3, 1, '%')}), 가장 약한 자산은 ${ranked.at(-1).label}(${signed(ranked.at(-1).m3, 1, '%')})입니다.${corrText}`, 'rates-curve-fact');
  const table = el(doc, 'table', null, 'macro-regime-inputs');
  const head = el(doc, 'tr');
  const ytdFrom = model.rows.find((row) => row.field === 'spx')?.ytdFrom;
  ['자산', '최근 종가', '1개월', '3개월', `올해${ytdFrom ? ` (${shortDate(ytdFrom)} 대비)` : ''}`].forEach((label) => head.append(el(doc, 'th', label)));
  table.append(head);
  const cell = (value) => el(doc, 'td', value == null ? '—' : signed(value, 1, '%'));
  for (const row of model.rows) {
    const tr = el(doc, 'tr');
    tr.append(el(doc, 'td', row.label), el(doc, 'td', row.last ? `${row.last.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${shortDate(row.last.date)})` : '—'), cell(row.m1), cell(row.m3), cell(row.ytd));
    table.append(tr);
  }
  const fold = el(doc, 'details', null, 'aio-comp-secondary');
  fold.open = true;
  fold.append(el(doc, 'summary', '자산별 1개월·3개월·올해 수익률'), table,
    el(doc, 'p', '각 자산의 일별 종가로 계산한 가격 변화이며 배당·이자는 넣지 않았습니다. 1개월은 21거래일, 3개월은 63거래일 전 종가 대비이고, 코스피는 한국 거래일 기준입니다. 원/달러와 달러 인덱스는 환율이라 가장 강한·약한 자산 비교에서 뺐습니다.', 'briefing-footnote'));
  const parts = [title, lead, fold];
  if (model.corr.length >= 5) {
    parts.push(el(doc, 'h3', `S&P 500 – 미 장기채(TLT) ${CORR_WINDOW}거래일 상관`, 'trend-card-title'),
      createTrendChart(doc, { series: model.corr, refLines: [0], domain: [-1, 1], format: (value) => value.toFixed(2), label: `S&P 500과 TLT의 ${CORR_WINDOW}거래일 일간 수익률 상관` }),
      el(doc, 'p', `표본: 두 종가가 모두 있는 ${model.jointSessions}거래일(${shortDate(model.corrFrom)}부터), 상관 ${model.corr.length}개 시점. 일간 수익률의 피어슨 상관이며 TLT 기록이 쌓인 만큼만 그립니다.`, 'trend-card-note'));
  } else parts.push(el(doc, 'p', `S&P 500과 TLT가 함께 기록된 날이 ${model.jointSessions}거래일이라 ${CORR_WINDOW}거래일 상관은 아직 그리지 않습니다.`, 'briefing-empty'));
  const reading = el(doc, 'p', null, 'briefing-read-reading');
  reading.append(el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(' 상관이 0보다 크면 주식과 장기채가 같은 방향으로 움직여, 주식이 내릴 때 채권이 받쳐 주는 분산 효과가 줄어든 상태입니다. 0보다 작으면 채권이 완충 역할을 하는 쪽입니다. 물가·금리 충격이 주도하는 시기에는 양(+)으로, 성장 둔화 걱정이 주도하는 시기에는 음(−)으로 기우는 경향이 알려져 있지만, 이 값은 지난 60거래일의 관계일 뿐 앞으로를 보장하지 않습니다.'));
  parts.push(reading, allocationPrinciples(doc, root, model, nowCorr));
  host.replaceChildren(...parts);
}

// v58.75 (persona review, spec F3): three allocation principles read against today's numbers — what the stock–bond
// correlation sign means for a bond cushion (the conclusion of the chart above), the dollar's and gold's roles, and the
// option value of cash at the cash-like rate (SOFR, the rate the scenarios already quote). Principles, not weights.
function allocationPrinciples(doc, root, model, nowCorr) {
  const box = el(doc, 'details', null, 'aio-comp-secondary rates-allocation');
  const row = (field) => model.rows.find((item) => item.field === field) || null;
  const m3 = (field) => { const r = row(field); return r?.m3 == null ? null : `${r.label} 3개월 ${signed(r.m3, 1, '%')}`; };
  let cash = null;
  try { cash = marketInterpretation(root).crossroads?.cash || null; } catch (_) { cash = null; }
  const corrLine = nowCorr == null ? '상관 기록이 쌓이면 지금 채권이 완충 쪽인지 표시합니다.'
    : nowCorr.value > 0 ? `지금은 ${nowCorr.value.toFixed(2)}로 0보다 커, 주식이 내리는 날 장기채도 함께 내리기 쉬운 쪽입니다 — 채권을 들고 있어도 분산 효과가 평소보다 작습니다.`
      : `지금은 ${nowCorr.value.toFixed(2)}로 0보다 작아, 주식이 내리는 날 장기채가 받쳐 주는 쪽입니다.`;
  const items = [
    ['주식·채권 상관의 부호', `채권이 주식의 완충이 되는지는 상관의 부호가 정합니다. ${corrLine}`],
    ['달러의 역할', `위험 회피 때 달러가 오르는 경향이 있어, 원화로 계산하는 미국 자산은 주가 하락 일부가 환율로 상쇄되곤 합니다. 반대로 원화가 강해지면 환차손이 납니다.${m3('dxy') ? ` 지금 ${m3('dxy')}.` : ''}`],
    ['금의 역할', `금은 이자가 없어 실질금리가 오르면 부담이고, 통화 가치 불안이나 지정학 위험 때 수요가 몰립니다. 주식과 다른 이유로 움직이는 자산입니다.${m3('gold') ? ` 지금 ${m3('gold')}.` : ''}`],
    ['현금의 선택권', `현금은 수익이 0이 아니라 기다리는 동안 이자를 받으며 다음 기회를 고를 수 있는 선택권입니다.${cash ? ` 지금 현금성 금리(SOFR)는 연 ${cash.value.toFixed(2)}%(${shortDate(cash.date)})로, 기다림의 비용을 그만큼 줄여 줍니다.` : ' 현금성 금리는 아직 확인되지 않았습니다.'}`]
  ];
  box.append(el(doc, 'summary', '자산배분 원리 — 채권·달러·금·현금이 하는 일'));
  const list = el(doc, 'dl', null, 'regime-evidence');
  for (const [label, text] of items) list.append(el(doc, 'dt', label), el(doc, 'dd', text));
  box.append(list, el(doc, 'p', '각 자산의 역할을 설명하는 원리이며, 얼마를 담을지는 내 목표와 원칙으로 정합니다.', 'briefing-footnote'));
  return box;
}

function renderCreditLink(doc, credit, regime) {
  const levels = doc.getElementById('rates-levels');
  if (!levels) return;
  let line = doc.getElementById('rates-credit-link');
  if (!line) { line = el(doc, 'p', null, 'rates-curve-fact'); line.id = 'rates-credit-link'; levels.after(line); }
  const axis = regime?.available ? regime.axes.find((row) => row.id === 'credit') : null;
  if (!credit || credit.value == null) { line.hidden = true; line.replaceChildren(); return; }
  const go = el(doc, 'button', '시장 상태의 신용 지표', 'flow-next-link');
  go.type = 'button';
  go.dataset.action = 'showPage';
  go.dataset.arg = 'signal';
  line.replaceChildren(el(doc, 'strong', `${credit.label} ${credit.valueText}`),
    doc.createTextNode(`${credit.asOf ? ` (${shortDate(credit.asOf)})` : ''}${credit.weekText ? `, ${credit.weekText}` : ''}${axis ? ` — 판정 ${axis.stateLabel}` : ''}. 1년 추이와 판정 기준은 `), go, doc.createTextNode('에서 봅니다.'));
  line.hidden = false;
}

// v58.75 (persona review): the equity risk premium (S&P 500 forward earnings yield − 10-year real yield) sits beside the
// real-yield card it depends on — the same indexEarnings stage the themes screen renders (src/domain/market/index-earnings.js).
function renderErpLine(doc, root) {
  const levels = doc.getElementById('rates-levels');
  if (!levels) return;
  let line = doc.getElementById('rates-erp');
  if (!line) { line = el(doc, 'p', null, 'rates-curve-fact'); line.id = 'rates-erp'; levels.after(line); }
  if (!root[CONSENSUS_KEY]) requestConsensusEstimates(root, () => renderErpLine(doc, root));
  const model = marketInterpretation(root).indexEarnings;
  if (!model?.available || model.erp == null) { line.hidden = true; line.replaceChildren(); return; }
  const link = el(doc, 'button', '테마 화면의 S&P 500 이익 전망', 'flow-next-link');
  link.type = 'button';
  link.dataset.action = 'showPage';
  link.dataset.arg = 'themes';
  line.replaceChildren(el(doc, 'strong', `주식위험프리미엄 ${model.erp.toFixed(1)}%p`),
    doc.createTextNode(` — S&P 500 선행 이익수익률 ${(model.earningsYield * 100).toFixed(1)}%에서 10년 실질금리 ${model.realYield10.toFixed(2)}%${model.realYieldAsOf ? `(${shortDate(model.realYieldAsOf)})` : ''}를 뺀 값입니다. 실질금리가 오르면 같은 이익에서 이 차이가 줄어듭니다. 이익 전망 수정은 `), link, doc.createTextNode('에서 함께 봅니다.'));
  line.hidden = false;
}

// v58.53 개편 v2 (5e): three tiles beside the curve — 원/달러, 엔/달러 (close-basis cards below) and 2년물 − 기준금리 (the
// 거시 policy factor's own evidence row). Values are the same objects the cards and the factor read; a missing one is
// shown as 없음, not dropped.
function renderRatesSummary(doc, model, read) {
  const host = doc.getElementById('rates-summary');
  if (!host) return;
  const fx = Object.fromEntries((model.fx || []).map((card) => [card.id, card]));
  const tile = (label, value, change, note, dated = null) => {
    const box = el(doc, 'div', null, 'mk-rsum');
    const head = el(doc, 'div', null, 'mk-rsum__head');
    head.append(el(doc, 'span', label, 'mk-rsum__label'), el(doc, 'span', change || '', 'mk-rsum__change'));
    box.append(head, el(doc, 'b', value, 'mk-rsum__value'), el(doc, 'span', note, 'mk-rsum__note'));
    if (dated) box.append(dated);
    return box;
  };
  const chipFor = (asOf, suffix = '종가') => {
    if (!asOf) return null;
    const align = alignInput(asOf, model.basis);
    return el(doc, 'span', `${alignmentLabel(align)} ${suffix}`, align.status === 'aligned' ? 'sx-meta' : 'sx-chip sx-chip--sm sx-chip--date');
  };
  const fxTile = (id, label, note) => {
    const card = fx[id];
    return card?.available ? tile(label, card.valueText, card.change20 == null ? '' : `20일 ${signed(card.change20, 1, '%')}`, note, chipFor(card.asOf)) : tile(label, '없음', '', '종가 기록 없음');
  };
  const policy = (read?.axes || []).find((row) => row.id === 'policy');
  const gap = policy?.evidence?.find(([label]) => label.startsWith('2년물 − 기준금리'))?.[1] || null;
  host.replaceChildren(
    fxTile('usdkrw', '원/달러', '오르면 원화 약세 — 외국인 자금 흐름과 수입 물가에 연결됩니다.'),
    fxTile('usdjpy', '엔/달러', '내리면 엔화 강세 — 엔으로 빌려 투자한 자금(엔 캐리)의 기준선입니다.'),
    tile('2년물 − 기준금리 중간값', gap ? gap.replace(/\s*\(.*$/, '') : '없음', policy ? policy.stateLabel : '', gap ? '2년물에는 앞으로 1~2년 기준금리 예상과 기간·위험 프리미엄이 함께 들어 있습니다 — 거시 경제의 통화정책 판정과 같은 값입니다.' : '2년물 또는 기준금리 자료 없음', gap ? chipFor(policy?.asOf, '2년물 관측') : null)
  );
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
    // v58.74 (audit): the provider stamps its Saturday update '10/24 고시' over Friday's rates; on a weekend it says so.
    ? { text: `참고 환율, ${md ? (usWeekendClosed(latest.getTime()) ? `${md} 고시(주말이라 금요일 시세)` : `${md} 고시`) : '고시일 미확인'}. 하루 한 번 갱신해 등락은 표시하지 않습니다`, reference: true }
    : { text: latest ? `시장 시세, ${md} ${hm} 관측` : '시장 시세, 관측 시각 미확인', reference: false };
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
