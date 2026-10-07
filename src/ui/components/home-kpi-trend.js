// P1505: the four home KPI cells (S&P 500, Nasdaq, 10-year yield, WTI) showed a number and a one-day change only.
// Each now carries its last 20 completed sessions as a quiet line, so the reader sees where today's number sits in
// the recent move. Closes come from the shared daily history (completed market cut), never from the live strip.

const CELLS = Object.freeze([
  { selector: '[data-live-price="ES=F"]', field: 'spx', label: 'S&P 500' },
  { selector: '[data-live-price="NQ=F"]', field: 'nasdaq', label: '나스닥 종합' },
  { selector: '[data-live-price="^TNX"]', field: 'tnx', label: '미 10년 금리' },
  { selector: '[data-live-price="CL=F"]', field: 'wti', label: 'WTI' }
]);
const SESSIONS = 20;

export function trendPoints(history, field, sessions = SESSIONS) {
  const rows = (Array.isArray(history) ? history : [])
    .filter((row) => row && Number.isFinite(Number(row[field])) && Number(row[field]) > 0)
    .slice(-sessions);
  return rows.map((row) => ({ date: row.date, value: Number(row[field]) }));
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
    caption.textContent = `${points.length}거래일 ${change}`;
    box.replaceChildren(svgLine(doc, points), caption);
    box.title = `${cell.label} 최근 ${points.length}거래일 종가 (${points[0].date} ~ ${points[points.length - 1].date})`;
    drawn += 1;
  }
  return drawn;
}
