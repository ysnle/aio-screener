// P1505: the four home KPI cells (S&P 500, Nasdaq, 10-year yield, WTI) showed a number and a one-day change only.
// Each now carries its last 20 completed sessions as a quiet line, so the reader sees where today's number sits in
// the recent move. Closes come from the shared daily history (completed market cut), never from the live strip.
//
// Codex browser audit H03 (2026-10-07): the home read "20거래일" S&P +2.4% while 시장 상태 read +1.3% for the same
// 20 days. The home took the last 20 history ROWS — one per collection day, weekends and holidays included with the
// close carried forward — i.e. about 14 sessions. Both screens now use the same session series (one point per
// trading date, carried-forward values excluded), so 20 sessions means 20 sessions on every screen.
import { buildCloseSeries, closeBasis, sessionPointBack } from '../../domain/briefing/market-read.js';
import { countOpenSessionsBetween } from '../../domain/market/market-calendar.js';
import { createTrendChart } from './trend-chart.js';
import { readMarketRegime } from './market-regime.js';

// C25: the second cell is the Nasdaq-100 (^NDX); the briefing's "나스닥 종합" is the Composite.
const CELLS = Object.freeze([
  { selector: '[data-live-price="ES=F"]', field: 'spx', label: 'S&P 500' },
  { selector: '[data-live-price="NQ=F"]', field: 'ndx', label: '나스닥 100 현물' },
  { selector: '[data-live-price="^TNX"]', field: 'tnx', label: '미 10년 금리' },
  { selector: '[data-live-price="CL=F"]', field: 'wti', label: 'WTI' }
]);
const SESSIONS = 20;

export function trendPoints(history, field, sessions = SESSIONS) {
  // sessions + 1 closes span `sessions` session-to-session changes. P1527: stop at the common close basis (the S&P 500's
  // last completed close) like 시장 상태 does; an intraday or pre-market row dated after it is not a completed close and
  // moved the 10-year yield "20거래일" change to +45bp on the home against +47bp on 시장 상태.
  // v57.50 C12: the start is the first close at least `sessions` exchange sessions back (market-read's sessionPointBack),
  // not 21 rows — a missing session no longer stretches "20거래일" over a longer period; too large a gap draws nothing.
  const series = buildCloseSeries(history, field, { through: closeBasis(history) });
  const start = sessionPointBack(series, sessions);
  return start ? series.filter((point) => point.date >= start.date) : [];
}

// v58.53 개편 v2 (2b): the line fills the tile's width (36px tall, 1.6px round stroke that does not scale, no fill).
function svgLine(doc, points, width = 220, height = 40, neutral = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sx-spark kpi-trend-line');
  svg.setAttribute('aria-hidden', 'true');
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => `${((index / (points.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((point.value - min) / span) * (height - 4)).toFixed(1)}`);
  const line = doc.createElementNS(ns, 'path');
  line.setAttribute('d', `M${coords.join('L')}`);
  // P1599 (F100): a yield rise is not 'good' — the rate line stays neutral instead of borrowing price up/down colours.
  line.setAttribute('class', neutral ? 'is-neutral' : values[values.length - 1] >= values[0] ? 'is-up' : 'is-down');
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
    const sessions = countOpenSessionsBetween(points[0].date, points[points.length - 1].date, 'US');
    caption.textContent = `${sessions}거래일 ${change}`; // 2b tile foot
    box.replaceChildren(svgLine(doc, points, 220, 40, cell.field === 'tnx'), caption);
    const lo = Math.min(...points.map((point) => point.value));
    const hi = Math.max(...points.map((point) => point.value));
    const digits = cell.field === 'tnx' ? 2 : lo >= 100 ? 0 : 2;
    box.setAttribute('data-observed-at', points[points.length - 1].date); // P1643
    box.tabIndex = 0; // U01
    box.title = `${cell.label} ${points[0].date} 종가 → ${points[points.length - 1].date} 종가 (${sessions}거래일), 기간 저점 ${lo.toFixed(digits)}, 고점 ${hi.toFixed(digits)}, 카드마다 세로 범위가 달라 카드끼리 높이를 비교하지 않습니다`;
    drawn += 1;
  }
  renderHomeParticipation({ documentRef: doc, root, history });
  return drawn;
}

// P1599 (F100): the home verdict's core question — is the index rising with or without the stocks under it — as
// two same-period charts side by side. Each keeps its own axis (index level vs % of stocks); the shared x-range
// and a one-line read make the comparison, not a merged scale.
const PARTICIPATION_SESSIONS = 63;
export function homeParticipationSeries(history = []) {
  const basis = closeBasis(history);
  return { spx: buildCloseSeries(history, 'spx', { through: basis }).slice(-PARTICIPATION_SESSIONS), b50: buildCloseSeries(history, 'breadth50', { through: basis }) }; // P1623: producer declares percent, including values below 1%.
}
// v58.53 개편 v2 (2b): one card after the daily loop — a title that says what the two lines did, the two same-period charts
// with their end values beside the captions, the one-line read, then link rows to the screens holding the depth.
// It sits first in #home-depth (the fold of scenarios and the guide follows it); without that host it keeps the old
// anchor after the close comparison.
export function participationTitle(spxMove, b0, b1) {
  if (!Number.isFinite(b0) || !Number.isFinite(b1)) return '지수와 참여 종목, 같은 기간';
  if (spxMove > 0) return b1 < b0 ? '지수는 올랐지만 참여 종목은 줄었습니다' : '지수와 참여 종목이 함께 늘었습니다';
  return b1 < b0 ? '지수와 참여 종목이 함께 약해졌습니다' : '지수는 약했지만 참여 종목은 늘었습니다';
}

function linkRow(doc, label, meta, onClick = null) {
  const row = doc.createElement('button');
  row.type = 'button';
  row.className = 'sx-row';
  const text = doc.createElement('span');
  text.textContent = label;
  const note = doc.createElement('span');
  note.className = 'sx-row__meta';
  note.textContent = meta;
  row.append(text, note);
  if (onClick) row.addEventListener('click', onClick);
  return row;
}

function renderHomeParticipation({ documentRef: doc, root, history }) {
  const depth = doc?.getElementById?.('home-depth');
  const anchor = doc?.getElementById?.('home-daily-changes');
  if (!depth && !anchor) return;
  let host = doc.getElementById('home-participation');
  const { spx, b50 } = homeParticipationSeries(history);
  if (spx.length < 20) { host?.remove(); return; }
  const range = [spx[0].date, spx[spx.length - 1].date];
  const b50In = b50.filter((point) => point.date >= range[0] && point.date <= range[1]);
  if (!host) {
    host = doc.createElement('section');
    host.id = 'home-participation';
    host.className = 'sx-card home-participation';
    host.setAttribute('aria-labelledby', 'home-participation-title');
  }
  if (depth) { if (depth.firstElementChild !== host) depth.prepend(host); } else if (host.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', host);
  const pct = (a, b) => ((b / a - 1) * 100);
  const spxMove = pct(spx[0].value, spx[spx.length - 1].value);
  const b0 = b50In[0]?.value;
  const b1 = b50In[b50In.length - 1]?.value;
  // v57.86 (live review): the 62-session line read "참여 종목은 줄었습니다" while 시장 폭 said participation widened over 20
  // sessions (+6.1%p) — a recent move against the window's direction is named beside it.
  const b20 = b50In.length > 21 ? b50In[b50In.length - 21].value : null;
  const recentTurn = b20 != null && b0 != null && b1 != null && Math.sign(b1 - b20) !== 0 && Math.sign(b1 - b20) !== Math.sign(b1 - b0) && Math.abs(b1 - b20) >= 3
    ? ` (최근 20거래일은 ${b20.toFixed(0)}% → ${b1.toFixed(0)}%로 ${b1 > b20 ? '다시 넓어지는 중' : '다시 줄어드는 중'})` : '';
  const hasBreadth = b50In.length >= 2;
  const read = hasBreadth
    ? `${spx.length - 1}거래일 동안 S&P 500 ${spxMove >= 0 ? '+' : ''}${spxMove.toFixed(1)}%, 같은 기간 50일선 위 종목 ${b0.toFixed(0)}% → ${b1.toFixed(0)}%${spxMove > 0 && b1 < b0 ? ' — 지수는 올랐지만 참여 종목은 줄었습니다' : spxMove > 0 && b1 >= b0 ? ' — 지수와 참여가 함께 늘었습니다' : spxMove <= 0 && b1 < b0 ? ' — 지수와 참여가 함께 약해졌습니다' : ' — 지수는 약했지만 참여는 늘었습니다'}${recentTurn}`
    : `${spx.length - 1}거래일 S&P 500 ${spxMove >= 0 ? '+' : ''}${spxMove.toFixed(1)}%, 시장 폭 기록은 아직 같은 기간을 채우지 못했습니다`;
  const head = doc.createElement('div');
  head.className = 'sx-card__head home-participation-head';
  const title = doc.createElement('h2');
  title.className = 'sx-card__title';
  title.id = 'home-participation-title';
  title.textContent = participationTitle(spxMove, hasBreadth ? b0 : null, hasBreadth ? b1 : null);
  const meta = doc.createElement('span');
  meta.className = 'sx-card__meta';
  meta.textContent = `최근 ${spx.length - 1}거래일`;
  head.append(title, meta);
  const note = doc.createElement('p');
  note.className = 'home-participation-read';
  note.textContent = read;
  const grid = doc.createElement('div');
  grid.className = 'home-participation-grid';
  const card = (label, value, chart) => {
    const box = doc.createElement('div');
    const caption = doc.createElement('div');
    caption.className = 'home-participation-label';
    const name = doc.createElement('span');
    name.textContent = label;
    const end = doc.createElement('b');
    end.textContent = value;
    caption.append(name, end);
    box.append(caption, chart);
    return box;
  };
  grid.append(
    card('S&P 500 종가', `${spxMove >= 0 ? '+' : ''}${spxMove.toFixed(1)}%`, createTrendChart(doc, { series: spx, format: (value) => value.toFixed(0), label: 'S&P 500 종가', range })),
    card('50일선 위 종목 비율, 기준선 40%·60%', hasBreadth ? `${b0.toFixed(0)}% → ${b1.toFixed(0)}%` : '기록 수집 중', createTrendChart(doc, { series: b50In, refLines: [40, 60], format: (value) => `${value.toFixed(0)}%`, label: '50일선 위 종목 비율', domain: [0, 100], range }))
  );
  // v57.76: the five same-session breadth cards repeated the 시장 폭 screen on the home; the two charts and their
  // one-line read stay, the counting basis folds, and one link leads to the full breadth screen.
  const detail = doc.createElement('details');
  detail.className = 'home-participation-basis';
  const label = doc.createElement('summary');
  label.textContent = '집계 기준';
  const text = doc.createElement('p');
  text.textContent = '50일선 위 종목 비율은 ETF를 뺀 AIO 관찰 목록(미국)의 개별 주식으로 계산해 거래소 전체 집계와 다릅니다. 두 차트는 같은 기간을 쓰지만 세로축은 각자의 단위입니다.';
  detail.append(label, text);
  // 2b link rows: the axis board, the breadth screen, and this page's 데이터 출처 fold.
  const regime = root ? readMarketRegime(root) : null;
  const counts = regime?.available ? regime.counts : null;
  const rows = doc.createElement('div');
  rows.className = 'sx-rows home-participation-rows';
  const axisRow = linkRow(doc, '6개 축 근거와 읽은 값', counts ? `양호 ${counts.favorable}, 중립 ${counts.neutral}, 부담 ${counts.burden}` : '시장 상태');
  axisRow.dataset.action = 'showPage';
  axisRow.dataset.arg = 'signal';
  const breadthRow = linkRow(doc, '시장 폭 상세', '50일선, 200일선, 신고가');
  breadthRow.classList.add('home-breadth-link');
  breadthRow.dataset.action = 'showPage';
  breadthRow.dataset.arg = 'breadth';
  const [, month, day] = range[1].split('-').map(Number);
  const sourceRow = linkRow(doc, '데이터 기준과 출처', `${month}/${day} 종가`, () => {
    const fold = doc.querySelector('#page-home > details.page-sources');
    if (!fold) return;
    fold.open = true;
    fold.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    fold.querySelector('summary')?.focus?.({ preventScroll: true });
  });
  rows.append(axisRow, breadthRow, sourceRow);
  host.replaceChildren(head, note, grid, detail, rows);
}
