// P1505: the four home KPI cells (S&P 500, Nasdaq, 10-year yield, WTI) showed a number and a one-day change only.
// Each now carries its last 20 completed sessions as a quiet line, so the reader sees where today's number sits in
// the recent move. Closes come from the shared daily history (completed market cut), never from the live strip.
//
// Codex browser audit H03 (2026-10-07): the home read "20거래일" S&P +2.4% while 시장 상태 read +1.3% for the same
// 20 days. The home took the last 20 history ROWS — one per collection day, weekends and holidays included with the
// close carried forward — i.e. about 14 sessions. Both screens now use the same session series (one point per
// trading date, carried-forward values excluded), so 20 sessions means 20 sessions on every screen.
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { createTrendChart } from './trend-chart.js';

const CELLS = Object.freeze([
  { selector: '[data-live-price="ES=F"]', field: 'spx', label: 'S&P 500' },
  { selector: '[data-live-price="NQ=F"]', field: 'nasdaq', label: '나스닥 종합' },
  { selector: '[data-live-price="^TNX"]', field: 'tnx', label: '미 10년 금리' },
  { selector: '[data-live-price="CL=F"]', field: 'wti', label: 'WTI' }
]);
const SESSIONS = 20;

export function trendPoints(history, field, sessions = SESSIONS) {
  // sessions + 1 closes span `sessions` session-to-session changes. P1527: stop at the common close basis (the S&P 500's
  // last completed close) like 시장 상태 does; an intraday or pre-market row dated after it is not a completed close and
  // moved the 10-year yield "20거래일" change to +45bp on the home against +47bp on 시장 상태.
  return buildCloseSeries(history, field, { through: closeBasis(history) }).slice(-(sessions + 1));
}

function svgLine(doc, points, width = 120, height = 26, neutral = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-hidden', 'true');
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => `${(index / (points.length - 1)) * (width - 2) + 1},${height - 2 - ((point.value - min) / span) * (height - 4)}`);
  const line = doc.createElementNS(ns, 'polyline');
  line.setAttribute('points', coords.join(' '));
  line.setAttribute('fill', 'none');
  // P1599 (F100): a yield rise is not 'good' — the rate line stays neutral instead of borrowing price up/down colours.
  line.setAttribute('stroke', neutral ? 'var(--text-secondary)' : values[values.length - 1] >= values[0] ? 'var(--data-green)' : 'var(--data-red)');
  line.setAttribute('stroke-width', '1.4');
  line.setAttribute('stroke-linejoin', 'round');
  svg.append(line);
  return svg;
}

export function renderHomeKpiTrends({ documentRef: doc, root }) {
  const strip = doc?.getElementById?.('home-kpi-strip');
  if (!strip) return 0;
  const history = Array.isArray(root?._aioHistory) ? root._aioHistory : [];
  let drawn = 0;
  for (const cell of CELLS) {
    const value = strip.querySelector(cell.selector);
    const host = value?.closest('.is-interactive');
    if (!host) continue;
    const points = trendPoints(history, cell.field);
    let box = host.querySelector(':scope > .kpi-trend');
    if (points.length < 10) { box?.remove(); continue; }
    if (!box) {
      box = doc.createElement('div');
      box.className = 'kpi-trend';
      host.append(box);
    }
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const change = cell.field === 'tnx' ? `${last - first >= 0 ? '+' : ''}${Math.round((last - first) * 100)}bp` : `${last >= first ? '+' : ''}${((last / first - 1) * 100).toFixed(1)}%`;
    const caption = doc.createElement('span');
    caption.className = 'kpi-trend-caption';
    caption.textContent = `${points.length - 1}거래일 ${change}`;
    box.replaceChildren(svgLine(doc, points, 120, 26, cell.field === 'tnx'), caption);
    const lo = Math.min(...points.map((point) => point.value));
    const hi = Math.max(...points.map((point) => point.value));
    const digits = cell.field === 'tnx' ? 2 : lo >= 100 ? 0 : 2;
    box.title = `${cell.label} ${points[0].date} 종가 → ${points[points.length - 1].date} 종가 (${points.length - 1}거래일) · 기간 저점 ${lo.toFixed(digits)} · 고점 ${hi.toFixed(digits)} · 카드마다 세로 범위가 달라 카드끼리 높이를 비교하지 않습니다`;
    drawn += 1;
  }
  renderHomeParticipation({ documentRef: doc, root, history });
  return drawn;
}

// P1599 (F100): the home verdict's core question — is the index rising with or without the stocks under it — as
// two same-period charts side by side. Each keeps its own axis (index level vs % of stocks); the shared x-range
// and a one-line read make the comparison, not a merged scale.
const PARTICIPATION_SESSIONS = 63;
function renderHomeParticipation({ documentRef: doc, root, history }) {
  const anchor = doc?.getElementById?.('home-cross-assets');
  if (!anchor) return;
  let host = doc.getElementById('home-participation');
  const basis = closeBasis(history);
  const spx = buildCloseSeries(history, 'spx', { through: basis }).slice(-PARTICIPATION_SESSIONS);
  const b50 = buildCloseSeries(history, 'breadth50', { through: basis }).map((point) => ({ date: point.date, value: point.value <= 1 ? point.value * 100 : point.value }));
  if (spx.length < 20) { host?.remove(); return; }
  const range = [spx[0].date, spx[spx.length - 1].date];
  const b50In = b50.filter((point) => point.date >= range[0] && point.date <= range[1]);
  if (!host) {
    host = doc.createElement('section');
    host.id = 'home-participation';
    host.className = 'home-participation';
    host.setAttribute('aria-label', '지수와 참여 종목 — 같은 기간');
    anchor.insertAdjacentElement('afterend', host);
  }
  const pct = (a, b) => ((b / a - 1) * 100);
  const spxMove = pct(spx[0].value, spx[spx.length - 1].value);
  const b0 = b50In[0]?.value;
  const b1 = b50In[b50In.length - 1]?.value;
  const read = b50In.length >= 2
    ? `${spx.length - 1}거래일 동안 S&P 500 ${spxMove >= 0 ? '+' : ''}${spxMove.toFixed(1)}% · 같은 기간 50일선 위 종목 ${b0.toFixed(0)}% → ${b1.toFixed(0)}%${spxMove > 0 && b1 < b0 ? ' — 지수는 올랐지만 참여 종목은 줄었습니다' : spxMove > 0 && b1 >= b0 ? ' — 지수와 참여가 함께 늘었습니다' : spxMove <= 0 && b1 < b0 ? ' — 지수와 참여가 함께 약해졌습니다' : ' — 지수는 약했지만 참여는 늘었습니다'}`
    : `${spx.length - 1}거래일 S&P 500 ${spxMove >= 0 ? '+' : ''}${spxMove.toFixed(1)}% · 시장 폭 기록은 아직 같은 기간을 채우지 못했습니다`;
  const head = doc.createElement('div');
  head.className = 'home-participation-head';
  const title = doc.createElement('strong');
  title.textContent = '지수와 참여 종목 · 같은 기간';
  const note = doc.createElement('span');
  note.textContent = read;
  head.append(title, note);
  const grid = doc.createElement('div');
  grid.className = 'home-participation-grid';
  const card = (label, chart) => { const box = doc.createElement('div'); const caption = doc.createElement('div'); caption.className = 'home-participation-label'; caption.textContent = label; box.append(caption, chart); return box; };
  grid.append(
    card('S&P 500 종가', createTrendChart(doc, { series: spx, format: (value) => value.toFixed(0), label: 'S&P 500 종가', range })),
    card('50일선 위 종목 비율(%) · AIO 수집 종목 기준', createTrendChart(doc, { series: b50In, refLines: [40, 60], format: (value) => `${value.toFixed(0)}%`, label: '50일선 위 종목 비율', domain: [0, 100], range }))
  );
  host.replaceChildren(head, grid);
}
