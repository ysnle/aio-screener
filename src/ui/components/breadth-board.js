import { principleLink } from './principle-link.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { createTrendChart, seriesChange } from './trend-chart.js';
import { renderNextSteps } from './page-flow.js';
import { el } from './dom.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { sectorLabel } from '../../domain/screener/sector-label.js';
import { breadthScopeOf } from '../../domain/market/breadth/screener-breadth.js';
import { BREADTH_SPEED_METHOD, breadthCounter, measureFace } from '../../domain/market/breadth/breadth-face.js';
import { indicatorRow, kindFold, rawTable, setFoldBody } from './indicator-face.js';
import { historyWaitText } from './data-state.js';
import { renderMarketStructure } from './market-structure.js';
import { stockFalls, STOCK_FALLS_METHOD } from '../../domain/market/breadth/stock-falls.js';
import { fallBars } from './fall-bars.js';

// The screener rows in the store (the page re-renders on the screener slice, so rows arriving after mount repaint the
// line); none before the screener loads.
const screenerRows = (root) => root?.AIO_ARCH?.getScreenerState?.('rows') || [];

const WINDOW = 126; // about six months of sessions

function rolling(series, n, { sum = false } = {}) {
  return series.map((point, index) => {
    if (index + 1 < n) return null;
    const slice = series.slice(index + 1 - n, index + 1);
    const total = slice.reduce((acc, row) => acc + row.value, 0);
    return { date: point.date, value: sum ? total : total / n };
  }).filter(Boolean);
}

function cumulative(series) {
  let total = 0;
  return series.map((point) => ({ date: point.date, value: (total += point.value) }));
}

// Two same-date series combined (a − b); a date missing from either is not a reading.
function difference(a, b) {
  const other = new Map(b.map((point) => [point.date, point.value]));
  return a.filter((point) => other.has(point.date)).map((point) => ({ date: point.date, value: point.value - other.get(point.date) }));
}

const count = (value) => Math.round(value).toLocaleString('en-US');
const signedCount = (value) => `${{ up: '+', down: '-' }[directionOf(value, 0)] || ''}${Math.abs(Math.round(value)).toLocaleString('en-US')}`;

// Each group: its rows, then its charts in this order (the lead first; participation keeps its three horizons side by side).
export const BREADTH_GROUPS = Object.freeze([
  { id: 'participation', title: '참여도 — 이동평균 위 종목 비율', lead: 'b50', order: ['b20', 'b50', 'b200', 'b40', 'adv', 'ad'] },
  { id: 'leadership', title: '강한 종목 수 — 신고가·신저가, 급등락', lead: 'hl', order: ['hl', 'mv'] },
  // The S&P 500 itself is the 시장 상태 trend axis chart; its series only sets the shared date range here.
  { id: 'index', title: '지수 확인 — 분배일', lead: 'dd', order: ['dd'] }
]);

export function buildBreadthCards(history = []) {
  const through = closeBasis(history);
  const series = (field) => buildCloseSeries(history, field, { through });
  const pctSeries = (field) => series(field).slice(-WINDOW);
  const advance = series('advanceRatio').map((point) => ({ date: point.date, value: point.value <= 1 ? point.value * 100 : point.value }));
  const spx = series('spx').slice(-WINDOW);
  const highs = series('breadthNewHighs');
  const lows = series('breadthNewLows');
  const up4 = series('breadthUp4');
  const down4 = series('breadthDown4');
  const lastOf = (list) => list[list.length - 1] || null;
  const pct = (value) => `${value.toFixed(0)}%`;
  return [
    { id: 'b20', group: 'participation', title: '20일선 위 종목 비율', note: '단기 참여도 — 빠르게 움직여 반등·이탈을 먼저 보여 줌', series: pctSeries('breadth20'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b40', group: 'participation', title: '40일선 위 종목 비율', note: '20% 아래는 지나친 하락(과매도), 80% 위는 지나친 상승(과열)으로 보는 관례 구간 — 극단에서 방향이 바뀌는지 확인', series: pctSeries('breadth40'), refLines: [20, 80], format: pct, domain: [0, 100] },
    { id: 'b50', group: 'participation', title: '50일선 위 종목 비율', note: '중기 참여도 — 60% 이상이면 확산, 40% 미만이면 위축', series: pctSeries('breadth50'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b200', group: 'participation', title: '200일선 위 종목 비율', note: '장기 추세에 올라탄 종목 비율', series: pctSeries('breadth200'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'adv', group: 'participation', title: '상승 종목 비율 (10일 평균)', note: '하루치는 소음이 커서 10일 평균으로 봄 — 50% 위면 상승 종목 우세', series: rolling(advance, 10).slice(-WINDOW), refLines: [50], format: pct },
    { id: 'ad', group: 'participation', title: '누적 상승-하락 종목 수 (A/D 라인)', note: '지수(시장 상태의 추세 차트)와 같이 오르면 넓은 상승, 지수만 오르면 괴리 — 시작점은 기록 첫날이라 높이보다 방향을 봄', series: cumulative(series('advanceDecline')).slice(-WINDOW), refLines: [], format: count, changeUnit: '', changeDigits: 0 },
    { id: 'hl', group: 'leadership', title: '52주 신고가 − 신저가 종목 수', note: '장중 고가·저가가 지난 1년 범위를 넘은 종목 수(그날 종가가 내려도 셈) — 신고가가 많으면 강한 종목이 우세, 며칠 이어지는지로 확산 여부를 봄, 지수 고점에서 신저가가 늘면 괴리 신호', series: difference(highs, lows).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(highs) && lastOf(lows) ? `신고가 ${count(lastOf(highs).value)}, 신저가 ${count(lastOf(lows).value)}` : null, drill: ['newHigh', 'newLow'] },
    { id: 'mv', group: 'leadership', title: '4% 이상 상승 − 하락 종목 수 (5일 합계)', note: '거래량이 늘며 하루 4% 넘게 움직인 종목 — 5일 합계에서 상승·하락 중 어느 쪽이 우세한지 봄', series: rolling(difference(up4, down4), 5, { sum: true }).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(up4) && lastOf(down4) ? `${lastOf(up4).date.slice(5).replace('-', '/')} 상승 ${count(lastOf(up4).value)}, 하락 ${count(lastOf(down4).value)}` : null, drill: ['up4', 'down4'] },
    { id: 'dd', group: 'index', title: 'S&P 500 매도 우위일(분배일, 최근 25거래일)', note: `지수가 0.2% 이상 내리면서 거래량이 늘어난 날의 수 — 흔히 25거래일 중 5~6회 이상이면 추세 약화 경고로 보고, 시장 상태는 ${RULES.leadership.distributionDaysAt}회 이상을 주도 영역 확인 신호로 셈`, series: pctSeries('distributionDays'), refLines: [RULES.leadership.distributionDaysAt] /* v58.75 (persona review): same line as 시장 상태 */, format: count, changeUnit: '', changeDigits: 0, domain: [0, 12] },
    // Not drawn (no group): the S&P 500 window sets the shared date range and feeds the index group's sentence.
    { id: 'spx', group: null, title: 'S&P 500', series: spx }
  ];
}

// The common window: the S&P 500's last WINDOW sessions up to the basis.
export function breadthRange(cards) {
  const spx = cards.find((card) => card.id === 'spx')?.series || [];
  return spx.length ? [spx[0].date, spx[spx.length - 1].date] : null;
}

const DRILL_LABELS = Object.freeze({ newHigh: '52주 신고가', newLow: '52주 신저가', up4: '4% 이상 상승', down4: '4% 이상 하락' });

// Which stocks made the count, for one of the latest 20 sessions, never later than the basis.
export function contributorSession(contributors, basis, date = null) {
  const sessions = Array.isArray(contributors?.sessions) ? contributors.sessions.filter((row) => !basis || row.date <= basis) : [];
  if (!sessions.length) return null;
  return (date && sessions.find((row) => row.date === date)) || sessions[sessions.length - 1];
}

function nameOf(root, symbol) {
  const rows = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
  return rows.find((row) => row?.sym === symbol)?.name || '';
}

function sectorMix(root, list) {
  const rows = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
  const bySym = new Map(rows.filter((row) => row?.sym).map((row) => [row.sym, row.sector]));
  const counts = new Map();
  let named = 0;
  for (const entry of list) {
    const symbol = Array.isArray(entry) ? entry[0] : entry?.symbol;
    const assetType = Array.isArray(entry) ? entry[2] : entry?.assetType;
    const sector = assetType === 'ETF' ? null : bySym.get(symbol);
    if (!sector) continue;
    named += 1;
    const label = sectorLabel(sector);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  if (named < 8) return '';
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `업종 구성: ${top.map(([label, n]) => `${label} ${n}`).join(', ')}${counts.size > 3 ? ` 외 ${named - top.reduce((sum, [, n]) => sum + n, 0)}` : ''} (업종이 확인된 ${named}종목)`;
}

function renderDrill(doc, root, card, contributors, basis) {
  const sessions = Array.isArray(contributors?.sessions) ? contributors.sessions.filter((row) => !basis || row.date <= basis) : [];
  // The stocks behind a count are the count's raw table (one of the three permitted folds).
  const wrap = kindFold(doc, 'raw-table', sessions.length ? `${card.drill.map((key) => DRILL_LABELS[key]).join('·')} 종목` : '종목 목록 수집 대기');
  wrap.classList.add('breadth-drill');
  if (!sessions.length) return wrap;
  const picker = el(doc, 'select', null, 'breadth-drill-date');
  picker.setAttribute('aria-label', `${card.title} 날짜 선택`);
  sessions.slice().reverse().forEach((row) => { const option = el(doc, 'option', shortDate(row.date)); option.value = row.date; picker.append(option); });
  const body = el(doc, 'div', null, 'breadth-drill-body');
  const draw = () => {
    const session = contributorSession(contributors, basis, picker.value);
    body.replaceChildren(...card.drill.map((key) => {
      const list = session?.signals?.[key] || [];
      const column = el(doc, 'div', null, 'breadth-drill-col');
      column.append(el(doc, 'h4', `${DRILL_LABELS[key]} ${session?.counts?.[key] ?? list.length}`, 'breadth-drill-title'));
      if (!list.length) column.append(el(doc, 'p', '해당 종목 없음', 'breadth-drill-empty'));
      const mix = sectorMix(root, list);
      if (mix) column.append(el(doc, 'p', mix, 'breadth-drill-mix'));
      const ul = el(doc, 'ul', null, 'breadth-drill-list');
      for (const entry of list.slice(0, 40)) {
        const symbol = Array.isArray(entry) ? entry[0] : entry?.symbol;
        const change = Array.isArray(entry) ? entry[1] : entry?.dayChangePct;
        const assetType = Array.isArray(entry) ? entry[2] : entry?.assetType;
        const caSuspected = Array.isArray(entry) ? entry[3] === true : entry?.corporateActionSuspected === true;
        if (!symbol) continue;
        const li = el(doc, 'li');
        const button = el(doc, 'button', symbol, 'breadth-drill-symbol');
        button.type = 'button';
        button.addEventListener('click', () => { if (typeof root?.showTicker === 'function') root.showTicker(symbol); });
        li.append(button, el(doc, 'span', [assetType === 'ETF' ? 'ETF' : '', nameOf(root, symbol)].filter(Boolean).join(' '), 'breadth-drill-name'), el(doc, 'span', change == null ? '' : signedText(change, 1, '%'), `breadth-drill-chg ${({ up: 'is-up', down: 'is-down' }[directionOf(change)] || '')}`));
        const badge = (text) => el(doc, 'span', text, 'breadth-drill-ca'); // .breadth-drill-ca: src/ui/styles/responsive.css
        if (assetType === 'ETF') li.append(badge('ETF — 개별 주식 수에 함께 집계됩니다'));
        else if (caSuspected) li.append(badge('변동 폭이 커 분할·분사 반영 여부 확인 전'));
        ul.append(li);
      }
      column.append(ul);
      return column;
    }));
  };
  picker.addEventListener('change', draw);
  wrap.append(picker, body);
  draw();
  return wrap;
}

function methodBody(doc, root, cards) {
  const nodes = [el(doc, 'p', `숫자는 모두 직전 미국장 종가 기준입니다. 행의 구간은 각 차트에 그린 기준선이고, 50일선·200일선 위 비율의 ${RULES.breadth.weakBelow}%·${RULES.breadth.broadAtLeast}%는 시장 상태 '시장 폭' 판정의 기준과 같습니다. ${BREADTH_SPEED_METHOD}`, 'ind-method__lead'),
    el(doc, 'p', STOCK_FALLS_METHOD, 'ind-method__lead')];
  for (const card of cards.filter((row) => row.group && row.note)) {
    const box = el(doc, 'section', null, 'ind-method');
    box.dataset.methodMetric = card.id;
    box.append(el(doc, 'h3', card.title, 'ind-method__title'), el(doc, 'p', card.note, 'ind-method__text'));
    nodes.push(box);
  }
  nodes.push(principleLink(doc, root, 'breadth', '시장 폭'));
  return nodes;
}

export function renderBreadthBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-breadth');
  if (!page) return null;
  const interpretation = marketInterpretation(root);
  const { inputs, regime } = interpretation;
  const axis = regime.axes?.find((row) => row.id === 'breadth');
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  const eligible = contributorSession(root?._aioBreadthContributors, regime.asOf)?.eligible || null;
  const judgedCount = buildCloseSeries(inputs.history, 'breadth50', { through: regime.asOf, includeProvenance: true }).at(-1)?.eligible ?? null;
  const scope = breadthScopeOf(inputs.history);
  const denominator = judgedCount ? (scope.sp500 ? `, S&P 500 ${judgedCount}개 종목` : `, 판정 대상 ${judgedCount}개 종목`) : '';
  const sp500 = root?.AIO_ARCH?.getScreenerState?.('metadata.breadth.segments.sp500') || null;
  const sp500Same = !scope.sp500 && sp500 && Number(sp500.eligible) >= 300 && Number.isFinite(sp500.above50) && String(sp500.observedAt || '').slice(0, 10) === String(regime.asOf || '').slice(0, 10);
  const sp500Row = sp500Same ? [`S&P 500 구성 종목만 (${sp500.eligible}개)`, `50일선 위 ${sp500.above50.toFixed(0)}%${Number.isFinite(sp500.above200) ? `, 200일선 위 ${sp500.above200.toFixed(0)}%` : ''}`] : null;
  // The subtitle is the date and the judged count; who is counted and how sits in the 데이터 출처 fold, and the S&P 500
  // member figures are a row of the raw table.
  const basisNode = doc.getElementById('breadth-basis');
  if (basisNode) basisNode.title = `${scope.label}의 1년 조정 종가로 계산한 값이며 거래소·지수 공식 통계가 아닙니다`;
  set('breadth-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준${axis?.basisStatus && axis.basisStatus !== 'aligned' ? `, 시장 폭 ${axis.basis}` : ''}${denominator}` : historyWaitText(root));
  const state = doc.getElementById('breadth-state');
  const tone = { favorable: 'good', burden: 'warn' }[axis?.state] || 'neutral';
  if (state) { state.textContent = axis?.verdictLabel || '판정 대기'; state.className = `regime-state is-${axis?.state || 'unknown'} sx-chip sx-chip--sm sx-chip--${tone}`; }
  const falls = regime.available ? stockFalls({ rows: screenerRows(root), history: inputs.history, session: regime.asOf }) : null;
  set('breadth-read', falls?.said.text || '');
  let fallsHost = doc.getElementById('breadth-falls');
  if (!fallsHost && state) { fallsHost = el(doc, 'div', null, 'mk-sub-hero__falls'); fallsHost.id = 'breadth-falls'; state.closest('.mk-sub-hero__row')?.after(fallsHost); }
  if (fallsHost) {
    fallsHost.replaceChildren(...(falls ? [fallBars(doc, falls.bars, `52주 종가 고점 대비 · ${falls.measured}개 종목`)] : []));
    fallsHost.hidden = !falls;
  }
  // The condition that changes the verdict: the nearest threshold of the rule (flipDistance, the rule's own numbers) and its
  // distance; without a measured lever the rule's first sentence. The whole rule is in the raw table.
  const d = axis?.flipDistance;
  set('breadth-flip', d ? `판정이 바뀌는 조건: ${d.condition}${(d.also || []).map((also) => `, 함께 필요: ${also.condition}`).join('')} 시장 폭 → ${d.towardLabel} · ${d.label}`
    : axis?.flip ? `판정이 바뀌는 조건: ${String(axis.flip).match(/^.+?[.](?=\s|$)/)?.[0] || axis.flip}` : '');
  // The three market flows read from breadth and leadership, after the verdict and its AI reading.
  renderMarketStructure({ documentRef: doc, root, interpretation, anchor: doc.getElementById('breadth-screen-reading') || state?.closest?.('section') || null });
  const grid = doc.getElementById('breadth-chart-grid');
  if (grid) {
    const cards = buildBreadthCards(inputs.history);
    const range = breadthRange(cards);
    const basis = closeBasis(inputs.history);
    const faceOf = (card) => {
      const points = card.series;
      const last = points[points.length - 1] || null;
      const change = (n) => seriesChange(points, n, card.changeUnit ?? '%p', card.changeDigits ?? 1);
      const changes = [[5, '5일'], [20, '20일']].map(([n, label]) => { const value = change(n); return value ? `${label} ${value}` : null; }).filter(Boolean).join(', ');
      const lateStart = range && points.length && points[0].date > range[0] ? `, 기록 시작 ${shortDate(points[0].date)}` : '';
      const highLowBasis = card.id === 'hl' && eligible?.highLow ? `, 신고·신저 판정 대상 ${eligible.highLow}개` : '';
      const change20 = points.length > 20 ? last.value - points[points.length - 21].value : null;
      return { last, text: last ? card.format(last.value) : '', changes: `${changes || '변화 기록 수집 중'}${lateStart}`, latest: card.latest ? `${card.latest}${highLowBasis}` : '', face: measureFace(card.id, last?.value, { change20 }) };
    };
    const renderRow = (card) => {
      const f = faceOf(card);
      const row = indicatorRow(doc, { title: card.title, stateLabel: f.face.band || '기록 없음', tone: 'neutral', value: f.text, distance: f.face.distance, lines: [['change', f.changes], ['latest', f.latest]] });
      row.dataset.metric = card.id;
      return row;
    };
    const renderChart = (card) => {
      const box = el(doc, 'section', null, 'trend-card');
      box.dataset.metric = card.id;
      box.append(renderRow(card), createTrendChart(doc, { series: card.series, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }));
      if (card.drill) box.append(renderDrill(doc, root, card, root._aioBreadthContributors, basis));
      return box;
    };
    // A re-render (live quotes, history) keeps an opened drilldown and its chosen date.
    const opened = new Map([...grid.querySelectorAll('details.breadth-drill[open]')].map((node) => [node.closest('[data-metric]')?.dataset.metric, node.querySelector('select')?.value]));
    // Each group is a section of indicator cards (participation's three horizons in a row first); the
    // leadership and index groups sit side by side.
    const sections = BREADTH_GROUPS.map((group) => {
      const members = group.order.map((id) => cards.find((card) => card.id === id && card.group === group.id)).filter(Boolean);
      if (!members.length) return null;
      const section = el(doc, 'section', null, `bb-group bb-group--${group.id}${members.length > 2 ? ' bb-group--trio' : ''}`);
      section.dataset.group = group.id;
      const faceGrid = el(doc, 'div', null, 'bb-face');
      faceGrid.append(...members.map((card) => { const box = renderChart(card); if (card.id === group.lead) box.classList.add('breadth-lead'); return box; }));
      section.append(el(doc, 'h2', group.title, 'breadth-group-title'), faceGrid);
      return section;
    }).filter(Boolean);
    const pair = el(doc, 'div', null, 'bb-pair');
    pair.append(...sections.filter((node) => node.dataset.group !== 'participation'));
    grid.replaceChildren(...sections.filter((node) => node.dataset.group === 'participation'), pair);
    // The counter line: the measures on the other side of where the verdict stands (breadth-face.js), as title and value.
    const counter = breadthCounter(axis, cards.filter((card) => card.group).map((card) => { const f = faceOf(card); return { id: card.id, title: card.title, value: f.last?.value, text: f.text }; }));
    const counterNode = doc.getElementById('breadth-counter');
    if (counterNode) {
      counterNode.replaceChildren(...(counter ? [el(doc, 'span', counter.kind === 'opposite' ? '반대 근거' : `${counter.toward === 'favorable' ? '양호' : '부담'} 쪽과 반대인 지표`, 'mk-hero__counter-label'), el(doc, 'span', counter.items.join(' · '), 'mk-hero__counter-text')] : []));
      counterNode.hidden = !counter;
    }
    // The raw table: every evidence row of the breadth axis but the 판정 사유 on the face, the thresholds toward each other
    // state, the whole rule, the observation date and the S&P 500 member figures.
    let raw = doc.getElementById('breadth-raw');
    if (!raw) { raw = kindFold(doc, 'raw-table', '시장 폭 판정의 관측값 전체'); raw.id = 'breadth-raw'; grid.insertAdjacentElement('afterend', raw); }
    const rawRows = [...(axis?.evidence || [])];
    for (const item of axis?.flipDistances || []) rawRows.push([`${item.towardLabel}까지 ${item.text}`, `${item.condition}${(item.also || []).map((also) => `, 함께 필요: ${also.condition}`).join('')}`]);
    rawRows.push(['판정 규칙', axis?.flip || ''], ['관측일', axis?.basis || '']);
    if (sp500Row) rawRows.push(sp500Row);
    setFoldBody(raw, rawTable(doc, rawRows, '시장 폭 관측값'));
    raw.hidden = !axis;
    // The method at the foot of the page: each measure's definition and reference lines, then the link to the breadth
    // principle in the research library; built when first opened.
    let method = doc.getElementById('breadth-method');
    if (!method) {
      method = kindFold(doc, 'method', '지표별 정의와 기준선', () => methodBody(doc, root, cards));
      method.id = 'breadth-method';
      const next = doc.getElementById('breadth-next');
      if (next) next.insertAdjacentElement('beforebegin', method); else page.append(method);
    }
    renderNextSteps(doc, doc.getElementById('breadth-next'));
    for (const [metric, date] of opened) {
      const details = grid.querySelector(`[data-metric="${metric}"] details.breadth-drill`);
      if (!details) continue;
      details.open = true;
      const picker = details.querySelector('select');
      if (picker && date && [...picker.options].some((option) => option.value === date)) { picker.value = date; picker.dispatchEvent(new Event('change')); }
    }
  }
  page.dataset.aioBreadthBoardRenderer = 'native';
  return regime;
}
