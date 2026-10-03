// P1395 (owner review 2026-10-02): 시장 폭 shows each participation measure as a trend so the
// change and its direction can be followed, with the same breadth judgement as the 시장 상태 board.
// P1399: every card runs through the S&P 500 close basis and shares one date range, so the same
// horizontal position is the same date; a measure whose record starts later says so.
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

function rolling(series, n) {
  return series.map((point, index) => {
    if (index + 1 < n) return null;
    const slice = series.slice(index + 1 - n, index + 1);
    return { date: point.date, value: slice.reduce((sum, row) => sum + row.value, 0) / n };
  }).filter(Boolean);
}

function cumulative(series) {
  let total = 0;
  return series.map((point) => ({ date: point.date, value: (total += point.value) }));
}

export function buildBreadthCards(history = []) {
  const through = closeBasis(history);
  const pctSeries = (field) => buildCloseSeries(history, field, { through }).slice(-WINDOW);
  const advance = buildCloseSeries(history, 'advanceRatio', { through }).map((point) => ({ date: point.date, value: point.value <= 1 ? point.value * 100 : point.value }));
  const spx = buildCloseSeries(history, 'spx', { through }).slice(-WINDOW);
  const pct = (value) => `${value.toFixed(0)}%`;
  return [
    { id: 'b50', title: '50일선 위 종목 비율', note: '중기 참여도 — 60% 이상이면 확산, 40% 미만이면 위축', series: pctSeries('breadth50'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b20', title: '20일선 위 종목 비율', note: '단기 참여도 — 빠르게 움직여 반등·이탈을 먼저 보여 줌', series: pctSeries('breadth20'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'b200', title: '200일선 위 종목 비율', note: '장기 추세에 올라탄 종목 비율', series: pctSeries('breadth200'), refLines: [40, 60], format: pct, domain: [0, 100] },
    { id: 'adv', title: '상승 종목 비율 (10일 평균)', note: '하루치는 소음이 커서 10일 평균으로 봄 — 50% 위면 상승 종목 우세', series: rolling(advance, 10).slice(-WINDOW), refLines: [50], format: pct },
    { id: 'ad', title: '누적 상승-하락 종목 수 (A/D 라인)', note: '지수와 같이 오르면 건강한 상승, 지수만 오르면 괴리', series: cumulative(buildCloseSeries(history, 'advanceDecline', { through })).slice(-WINDOW), refLines: [], format: (value) => Math.round(value).toLocaleString('en-US'), changeUnit: '', changeDigits: 0 },
    { id: 'spx', title: 'S&P 500 (같은 기간 비교)', note: '위 참여도 차트와 나란히 보면 지수와 시장 폭의 괴리가 보임', series: spx, refLines: [], format: (value) => Math.round(value).toLocaleString('en-US'), changeUnit: '%', percentChange: true }
  ];
}

// The common window: the S&P 500's last WINDOW sessions up to the basis.
export function breadthRange(cards) {
  const spx = cards.find((card) => card.id === 'spx')?.series || [];
  return spx.length ? [spx[0].date, spx[spx.length - 1].date] : null;
}

export function renderBreadthBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-breadth');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const regime = buildMarketRegime(inputs);
  const axis = regime.axes?.find((row) => row.id === 'breadth');
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('breadth-basis', regime.available ? `${shortDate(regime.asOf)} 미국 종가 기준${axis?.basisStatus && axis.basisStatus !== 'aligned' ? ` · 시장 폭 ${axis.basis}` : ''} · AIO 미국 주식 유니버스(약 700종목)` : '종가 기록을 불러오는 중입니다.');
  const state = doc.getElementById('breadth-state');
  if (state) { state.textContent = axis?.stateLabel || '판정 대기'; state.className = `regime-state is-${axis?.state || 'unknown'}`; }
  set('breadth-read', axis?.read || '');
  set('breadth-flip', axis?.flip ? `전환 조건: ${axis.flip}` : '');
  const grid = doc.getElementById('breadth-chart-grid');
  if (grid) {
    const cards = buildBreadthCards(inputs.history);
    const range = breadthRange(cards);
    grid.replaceChildren(...cards.map((card) => {
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
      box.append(head, el(doc, 'div', `${changes || '변화 기록 수집 중'}${lateStart}`, 'trend-card-change'),
        createTrendChart(doc, { series: points, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }),
        el(doc, 'p', card.note, 'trend-card-note'));
      return box;
    }));
  }
  page.dataset.aioBreadthBoardRenderer = 'native';
  return regime;
}
