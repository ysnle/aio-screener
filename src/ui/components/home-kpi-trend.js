// P1505: the four home KPI cells (S&P 500, Nasdaq, 10-year yield, WTI) showed a number and a one-day change only.
// Each now carries its last 20 completed sessions as a quiet line, so the reader sees where today's number sits in
// the recent move. Closes come from the shared daily history (completed market cut), never from the live strip.
//
// Codex browser audit H03 (2026-10-07): the home read "20거래일" S&P +2.4% while 시장 상태 read +1.3% for the same
// 20 days. The home took the last 20 history ROWS — one per collection day, weekends and holidays included with the
// close carried forward — i.e. about 14 sessions. Both screens now use the same session series (one point per
// trading date, carried-forward values excluded), so 20 sessions means 20 sessions on every screen.
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';

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

function svgLine(doc, points, width = 120, height = 26) {
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
  line.setAttribute('stroke', values[values.length - 1] >= values[0] ? 'var(--data-green)' : 'var(--data-red)');
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
    box.replaceChildren(svgLine(doc, points), caption);
    box.title = `${cell.label} ${points[0].date} 종가 → ${points[points.length - 1].date} 종가 (${points.length - 1}거래일)`;
    drawn += 1;
  }
  return drawn;
}
