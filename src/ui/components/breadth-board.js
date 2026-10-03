// P1395 (owner review 2026-10-02): 시장 폭 shows each participation measure as a trend so the
// change and its direction can be followed, with the same breadth judgement as the 시장 상태 board.
// P1399: every card runs through the S&P 500 close basis and shares one date range, so the same
// horizontal position is the same date; a measure whose record starts later says so.
// P1416 (open-source comparison 2026-10-03): three groups — participation (moving-average ratios),
// leadership (52-week highs vs lows, 4% movers, with the stocks behind each count) and index
// confirmation (S&P 500 distribution days and the index itself). Definitions live in
// src/domain/market/breadth-signals.js; this module only presents them.
import { buildCloseSeries, buildMarketRegime, closeBasis } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';
import { createTrendChart, seriesChange } from './trend-chart.js';

const WINDOW = 126; // about six months of sessions

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

export const BREADTH_GROUPS = Object.freeze([
  { id: 'participation', title: '참여도 — 이동평균 위 종목 비율' },
  { id: 'leadership', title: '리더십 — 신고가·신저가와 급등락 종목' },
  { id: 'index', title: '지수 확인 — 분배일과 S&P 500' }
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
    { id: 'b50', group: 'participation', title: '50일선 위 종목 비율', note: '중기 참여도 — 60% 이상이면 확산, 40% 미만이면 위축', series: pctSeries('breadth50'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b20', group: 'participation', title: '20일선 위 종목 비율', note: '단기 참여도 — 빠르게 움직여 반등·이탈을 먼저 보여 줌', series: pctSeries('breadth20'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b40', group: 'participation', title: '40일선 위 종목 비율 (T2108 계열)', note: '20% 아래는 과매도, 80% 위는 과열로 보는 관례 구간 — 극단에서 방향이 바뀌는지 확인', series: pctSeries('breadth40'), refLines: [20, 80], format: pct, domain: [0, 100] },
    { id: 'b200', group: 'participation', title: '200일선 위 종목 비율', note: '장기 추세에 올라탄 종목 비율', series: pctSeries('breadth200'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'adv', group: 'participation', title: '상승 종목 비율 (10일 평균)', note: '하루치는 소음이 커서 10일 평균으로 봄 — 50% 위면 상승 종목 우세', series: rolling(advance, 10).slice(-WINDOW), refLines: [50], format: pct },
    { id: 'ad', group: 'participation', title: '누적 상승-하락 종목 수 (A/D 라인)', note: '지수와 같이 오르면 건강한 상승, 지수만 오르면 괴리', series: cumulative(series('advanceDecline')).slice(-WINDOW), refLines: [], format: count, changeUnit: '', changeDigits: 0 },
    { id: 'hl', group: 'leadership', title: '52주 신고가 − 신저가 종목 수', note: '신고가가 신저가보다 많으면 주도주가 넓어지는 중 — 지수 고점에서 신저가가 늘면 괴리 신호', series: difference(highs, lows).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(highs) && lastOf(lows) ? `신고가 ${count(lastOf(highs).value)} · 신저가 ${count(lastOf(lows).value)}` : null, drill: ['newHigh', 'newLow'] },
    { id: 'mv', group: 'leadership', title: '4% 이상 상승 − 하락 종목 수 (5일 합계)', note: '거래량이 늘며 하루 4% 넘게 움직인 종목 — 상승 쪽이 우세하면 매수세, 하락 쪽이 몰리면 투매', series: rolling(difference(up4, down4), 5, { sum: true }).slice(-WINDOW), refLines: [0], format: signedCount, changeUnit: '', changeDigits: 0,
      latest: lastOf(up4) && lastOf(down4) ? `오늘 상승 ${count(lastOf(up4).value)} · 하락 ${count(lastOf(down4).value)}` : null, drill: ['up4', 'down4'] },
    { id: 'dd', group: 'index', title: 'S&P 500 분배일 (최근 25거래일)', note: '지수가 0.2% 이상 내리면서 거래량이 늘어난 날의 수 — 오닐 방식에서는 5~6회 이상이면 추세 약화 경고로 봄', series: pctSeries('distributionDays'), refLines: [5], format: count, changeUnit: '', changeDigits: 0, domain: [0, 12] },
    { id: 'spx', group: 'index', title: 'S&P 500 (같은 기간 비교)', note: '위 참여도 차트와 나란히 보면 지수와 시장 폭의 괴리가 보임', series: spx, refLines: [], format: count, changeUnit: '%', percentChange: true }
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
      const ul = el(doc, 'ul', null, 'breadth-drill-list');
      for (const [symbol, change] of list.slice(0, 40)) {
        const li = el(doc, 'li');
        const button = el(doc, 'button', symbol, 'breadth-drill-symbol');
        button.type = 'button';
        button.addEventListener('click', () => { if (typeof root?.showTicker === 'function') root.showTicker(symbol); });
        li.append(button, el(doc, 'span', nameOf(root, symbol), 'breadth-drill-name'), el(doc, 'span', change == null ? '' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, `breadth-drill-chg ${change >= 0 ? 'is-up' : 'is-down'}`));
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
  const inputs = collectMarketInputs(root);
  const regime = buildMarketRegime(inputs);
  const axis = regime.axes?.find((row) => row.id === 'breadth');
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('breadth-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준${axis?.basisStatus && axis.basisStatus !== 'aligned' ? ` · 시장 폭 ${axis.basis}` : ''} · AIO 미국 주식 유니버스(약 700종목, 거래소 전체 집계 아님)` : '종가 기록을 불러오는 중입니다.');
  const state = doc.getElementById('breadth-state');
  if (state) { state.textContent = axis?.stateLabel || '판정 대기'; state.className = `regime-state is-${axis?.state || 'unknown'}`; }
  set('breadth-read', axis?.read || '');
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
          return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
        }
        return seriesChange(points, n, card.changeUnit ?? '%p', card.changeDigits ?? 1);
      };
      const changes = [[5, '5일'], [20, '20일']].map(([n, label]) => { const value = change(n); return value ? `${label} ${value}` : null; }).filter(Boolean).join(' · ');
      const lateStart = range && points.length && points[0].date > range[0] ? ` · 기록 시작 ${shortDate(points[0].date)}` : '';
      box.append(head);
      if (card.latest) box.append(el(doc, 'div', card.latest, 'trend-card-latest'));
      box.append(el(doc, 'div', `${changes || '변화 기록 수집 중'}${lateStart}`, 'trend-card-change'),
        createTrendChart(doc, { series: points, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }),
        el(doc, 'p', card.note, 'trend-card-note'));
      if (card.drill) box.append(renderDrill(doc, root, card, root._aioBreadthContributors, basis));
      return box;
    };
    // A re-render (live quotes, history) keeps an opened drilldown and its chosen date.
    const opened = new Map([...grid.querySelectorAll('details.breadth-drill[open]')].map((node) => [node.closest('[data-metric]')?.dataset.metric, node.querySelector('select')?.value]));
    grid.replaceChildren(...BREADTH_GROUPS.flatMap((group) => {
      const members = cards.filter((card) => card.group === group.id);
      return members.length ? [el(doc, 'h2', group.title, 'breadth-group-title'), ...members.map(renderCard)] : [];
    }));
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
