// P1395 (owner review 2026-10-02): 시장 폭 shows each participation measure as a trend so the
// change and its direction can be followed, with the same breadth judgement as the 시장 상태 board.
// P1399: every card runs through the S&P 500 close basis and shares one date range, so the same
// horizontal position is the same date; a measure whose record starts later says so.
// P1416 (open-source comparison 2026-10-03): three groups — participation (moving-average ratios),
// leadership (52-week highs vs lows, 4% movers, with the stocks behind each count) and index
// confirmation (S&P 500 distribution days and the index itself). Definitions live in
// src/domain/market/breadth-signals.js; this module only presents them.
import { deepDiveFold } from './deep-dive.js';
import { splitReading } from './market-regime.js';
import { AXIS_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { createTrendChart, seriesChange } from './trend-chart.js';
import { breadthFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps, sectionLead } from './page-flow.js';
import { el } from './dom.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { sectorLabel } from '../../domain/screener/sector-label.js';
import { breadthScopeOf } from '../../domain/market/screener-breadth.js';
import { noteFold } from './section-frame.js';

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
const signedCount = (value) => `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString('en-US')}`;

// v57.77: each group shows one lead chart beside its reading; the other measures sit in a "나머지 지표 보기" fold.
export const BREADTH_GROUPS = Object.freeze([
  // v58.53 개편 v2 (5c): the participation group shows its three horizons side by side (lead stays the 50-day ratio).
  { id: 'participation', title: '참여도 — 이동평균 위 종목 비율', lead: 'b50', face: ['b20', 'b50', 'b200'] },
  { id: 'leadership', title: '강한 종목 수 — 신고가·신저가, 급등락', lead: 'hl' },
  { id: 'index', title: '지수 확인 — 분배일과 S&P 500', lead: 'spx' }
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
    { id: 'ad', group: 'participation', title: '누적 상승-하락 종목 수 (A/D 라인)', note: '지수와 같이 오르면 건강한 상승, 지수만 오르면 괴리', series: cumulative(series('advanceDecline')).slice(-WINDOW), refLines: [], format: count, changeUnit: '', changeDigits: 0 },
    { id: 'hl', group: 'leadership', title: '52주 신고가 − 신저가 종목 수', note: '신고가가 신저가보다 많으면 그날은 강한 종목이 우세 — 며칠 이어지는지로 확산 여부를 봄, 지수 고점에서 신저가가 늘면 괴리 신호', series: difference(highs, lows).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(highs) && lastOf(lows) ? `신고가 ${count(lastOf(highs).value)}, 신저가 ${count(lastOf(lows).value)}` : null, drill: ['newHigh', 'newLow'] },
    { id: 'mv', group: 'leadership', title: '4% 이상 상승 − 하락 종목 수 (5일 합계)', note: '거래량이 늘며 하루 4% 넘게 움직인 종목 — 5일 합계에서 상승·하락 중 어느 쪽이 우세한지 봄', series: rolling(difference(up4, down4), 5, { sum: true }).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(up4) && lastOf(down4) ? `${lastOf(up4).date.slice(5).replace('-', '/')} 상승 ${count(lastOf(up4).value)}, 하락 ${count(lastOf(down4).value)}` : null, drill: ['up4', 'down4'] },
    { id: 'dd', group: 'index', title: 'S&P 500 매도 우위일(분배일, 최근 25거래일)', note: `지수가 0.2% 이상 내리면서 거래량이 늘어난 날의 수 — 흔히 25거래일 중 5~6회 이상이면 추세 약화 경고로 보고, 시장 상태는 ${RULES.leadership.distributionDaysAt}회 이상을 주도 영역 확인 신호로 셈`, series: pctSeries('distributionDays'), refLines: [RULES.leadership.distributionDaysAt] /* v58.75 (persona review): same line as 시장 상태 */, format: count, changeUnit: '', changeDigits: 0, domain: [0, 12] },
    { id: 'spx', group: 'index', title: 'S&P 500 (같은 기간 비교)', series: spx, refLines: [], format: count, changeUnit: '%', percentChange: true }
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

// v58.74 (text audit 시장 상태 C3): which sectors a signal list is made of — a breadth gain carried by energy and defensives
// reads differently from one carried by tech. Shown only when at least eight named stocks map to a sector.
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
  const wrap = el(doc, 'details', null, 'breadth-drill');
  const sessions = Array.isArray(contributors?.sessions) ? contributors.sessions.filter((row) => !basis || row.date <= basis) : [];
  wrap.append(el(doc, 'summary', sessions.length ? '종목 보기' : '종목 목록 수집 대기', 'breadth-drill-summary'));
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
        else if (caSuspected) li.append(badge('분사·합병 가능성(공시 미확인)'));
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

export function renderBreadthBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-breadth');
  if (!page) return null;
  const { inputs, regime } = marketInterpretation(root); // T05 / owner 2026-10-19: the shared regime, same as 시장 상태
  const axis = regime.axes?.find((row) => row.id === 'breadth');
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  // Codex browser audit H09: the denominator is named — how many symbols were judged, and that stocks and ETFs are
  // mixed — so 33% is not read as a share of the whole exchange or of the S&P 500.
  const eligible = contributorSession(root?._aioBreadthContributors, regime.asOf)?.eligible || null;
  // T12 (expert review 2026-10-13): the count came from screener.json (811) while the ratios come from the history row
  // (804 judged); the denominator is now the one stored with the shown 50-day ratio.
  const judgedCount = buildCloseSeries(inputs.history, 'breadth50', { through: regime.asOf, includeProvenance: true }).at(-1)?.eligible ?? null;
  // v58.79 (owner 2026-10-25): the history says which population it counts — S&P 500 members after the switch.
  const scope = breadthScopeOf(inputs.history);
  const denominator = judgedCount ? (scope.sp500 ? `, S&P 500 ${judgedCount}개 종목` : `, 판정 대상 ${judgedCount}개 종목`) : '';
  // v57.51 V16: the same measure on S&P 500 members only, read from the screener artifact, so the watch list's theme
  // tilt is visible next to the headline ratios. Shown only when the segment is on the shown close date.
  const sp500 = root?.AIO_ARCH?.getScreenerState?.('metadata.breadth.segments.sp500') || null; // v57.77 perf: path read, no row clone
  const sp500Same = !scope.sp500 && sp500 && Number(sp500.eligible) >= 300 && Number.isFinite(sp500.above50) && String(sp500.observedAt || '').slice(0, 10) === String(regime.asOf || '').slice(0, 10);
  const sp500Read = sp500Same ? ` S&P 500 구성 종목만(${sp500.eligible}개) 보면 50일선 위 ${sp500.above50.toFixed(0)}%${Number.isFinite(sp500.above200) ? `, 200일선 위 ${sp500.above200.toFixed(0)}%` : ''}입니다.` : '';
  // v57.77: the subtitle is the date and the judged count; who is counted and how sits in the 데이터 출처 fold, and the
  // S&P 500 member read joins the participation group's reading below.
  const basisNode = doc.getElementById('breadth-basis');
  if (basisNode) basisNode.title = `${scope.label}의 1년 조정 종가로 계산한 값이며 거래소·지수 공식 통계가 아닙니다`;
  set('breadth-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준${axis?.basisStatus && axis.basisStatus !== 'aligned' ? `, 시장 폭 ${axis.basis}` : ''}${denominator}` : '종가 기록을 불러오는 중입니다.');
  const state = doc.getElementById('breadth-state');
  const tone = { favorable: 'good', burden: 'warn' }[axis?.state] || 'neutral';
  if (state) { state.textContent = axis?.stateLabel || '판정 대기'; state.className = `regime-state is-${axis?.state || 'unknown'} sx-chip sx-chip--sm sx-chip--${tone}`; }
  // v58.53 개편 v2 (5c): the hero keeps the reading's first sentences; the rest folds under '이어서 읽기'.
  const { lead: readLead, rest: readRest } = splitReading(axis?.read || '');
  set('breadth-read', readLead);
  const restNode = doc.getElementById('breadth-read-more');
  if (restNode) { restNode.hidden = !readRest; const body = restNode.querySelector('p'); if (body) body.textContent = readRest; }
  set('breadth-flip', axis?.flip ? `전환 조건: ${axis.flip}` : '');
  const grid = doc.getElementById('breadth-chart-grid');
  if (grid) {
    const cards = buildBreadthCards(inputs.history);
    const range = breadthRange(cards);
    const basis = closeBasis(inputs.history);
    const renderCard = (card) => {
      const box = el(doc, 'section', null, 'trend-card');
      box.dataset.metric = card.id;
      const points = card.series;
      const last = points[points.length - 1];
      const head = el(doc, 'div', null, 'trend-card-head');
      head.append(el(doc, 'h3', card.title, 'trend-card-title'), el(doc, 'span', last ? card.format(last.value) : '—', 'trend-card-value'));
      const change = (n) => {
        if (card.percentChange) {
          const pts = points.filter((point) => Number.isFinite(point.value));
          if (pts.length <= n) return null;
          const delta = (pts[pts.length - 1].value / pts[pts.length - 1 - n].value - 1) * 100;
          return signedText(delta, 1, '%');
        }
        return seriesChange(points, n, card.changeUnit ?? '%p', card.changeDigits ?? 1);
      };
      const changes = [[5, '5일'], [20, '20일']].map(([n, label]) => { const value = change(n); return value ? `${label} ${value}` : null; }).filter(Boolean).join(', ');
      const lateStart = range && points.length && points[0].date > range[0] ? `, 기록 시작 ${shortDate(points[0].date)}` : '';
      const highLowBasis = card.id === 'hl' && eligible?.highLow ? `, 신고·신저 판정 대상 ${eligible.highLow}개` : '';
      box.append(head);
      if (card.latest) box.append(el(doc, 'div', `${card.latest}${highLowBasis}`, 'trend-card-latest'));
      box.append(el(doc, 'div', `${changes || '변화 기록 수집 중'}${lateStart}`, 'trend-card-change'),
        createTrendChart(doc, { series: points, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }));
      // v58.79 (layout over captions): how to read the chart is one fold down, not lines under every card.
      const note = noteFold(doc, card.note);
      if (note) box.append(note);
      if (card.drill) box.append(renderDrill(doc, root, card, root._aioBreadthContributors, basis));
      return box;
    };
    // A re-render (live quotes, history) keeps an opened drilldown and its chosen date, and an opened group fold.
    // querySelectorAll reaches cards inside a closed <details>, so folded drilldowns are found too.
    const opened = new Map([...grid.querySelectorAll('details.breadth-drill[open]')].map((node) => [node.closest('[data-metric]')?.dataset.metric, node.querySelector('select')?.value]));
    const openedGroups = new Set([...grid.querySelectorAll('details.breadth-more[open]')].map((node) => node.dataset.group));
    // P1431: each group opens with what it adds to the verdict above, from the same series.
    const flow = breadthFlow({ cards, regime });
    // v58.53 개편 v2 (5c): each group is a section — participation as three horizon cards in a row, the other two groups
    // side by side — and the teaching fold closes the page as its own card.
    const sections = BREADTH_GROUPS.map((group) => {
      const members = cards.filter((card) => card.group === group.id);
      if (!members.length) return null;
      // v57.77: one lead chart per group; the rest wait in a fold so the page is three charts, not ten in a row.
      const face = group.face ? members.filter((card) => group.face.includes(card.id)) : [members.find((card) => card.id === group.lead) || members[0]];
      const rest = members.filter((card) => !face.includes(card));
      const section = el(doc, 'section', null, `bb-group bb-group--${group.id}${face.length > 1 ? ' bb-group--trio' : ''}`);
      section.dataset.group = group.id;
      const faceGrid = el(doc, 'div', null, 'bb-face');
      faceGrid.append(...face.map((card) => { const box = renderCard(card); if (card.id === group.lead) box.classList.add('breadth-lead'); return box; }));
      section.append(el(doc, 'h2', group.title, 'breadth-group-title'), sectionLead(doc, `${flow.leads[group.id] || ''}${group.id === 'participation' ? sp500Read : ''}`.trim()), faceGrid);
      if (rest.length) {
        const more = el(doc, 'details', null, 'breadth-more');
        more.dataset.group = group.id;
        more.open = openedGroups.has(group.id);
        const body = el(doc, 'div', null, 'trend-grid breadth-more-grid');
        body.append(...rest.map(renderCard));
        more.append(el(doc, 'summary', '나머지 지표 보기', 'breadth-more-summary'), body);
        section.append(more);
      }
      return section;
    }).filter(Boolean);
    const pair = el(doc, 'div', null, 'bb-pair');
    pair.append(...sections.filter((node) => node.dataset.group !== 'participation'));
    grid.replaceChildren(...sections.filter((node) => node.dataset.group === 'participation'), pair);
    // P1660: the page-level teaching fold, with the link back to the 시장 상태 axis that uses these series.
    const fold = deepDiveFold(doc, root, '시장 폭', { ...AXIS_DEEP_DIVES.breadth, related: [['signal', '시장 상태에서 추세 축과 함께 보기']] });
    if (fold) { fold.classList.add('sx-card', 'bb-principle'); grid.append(fold); }
    renderNextSteps(doc, doc.getElementById('breadth-next'), flow.next);
    for (const [metric, date] of opened) {
      const details = grid.querySelector(`[data-metric="${metric}"] details.breadth-drill`);
      if (!details) continue;
      const folded = details.closest('details.breadth-more');
      if (folded) folded.open = true; // v57.77: a drilldown on a folded card opens its group fold
      details.open = true;
      const picker = details.querySelector('select');
      if (picker && date && [...picker.options].some((option) => option.value === date)) { picker.value = date; picker.dispatchEvent(new Event('change')); }
    }
  }
  page.dataset.aioBreadthBoardRenderer = 'native';
  return regime;
}
