// 오늘: the one quote row and the participation card.
//
// v59.51 (content audit 2026-10-31, "one price surface"): the four KPI tiles (futures, 10-year, WTI with 20-session lines),
// the "지금 시세" heading and the cross-asset capsules were three price surfaces under the index strip, and on a weekend the
// futures tiles repeated the strip's closes. They are one chip row now (#home-cross-assets); the strip above is the market
// visual. A futures chip shows only a live futures quote while CME trades (usWeekendClosed, the rule the session bridge's
// futures line uses too); otherwise the strip's close is the answer and the chip is hidden.
import { buildCloseSeries, closeBasis, sessionPointBack } from '../../domain/briefing/market-read.js';
import { countOpenSessionsBetween, usWeekendClosed } from '../../domain/market/market-calendar.js';
import { createTrendChart } from './trend-chart.js';
import { readMarketRegime } from './market-regime.js';
import { asOfChip, markFrame } from './section-frame.js';
import { breadthScopeOf } from '../../domain/market/screener-breadth.js';
import { signedText } from '../../domain/shared/number.js';
import { MARKET_WINDOWS } from '../../domain/market/market-windows.js';

// v58.74: usWeekendClosed lives in market-calendar.js (the futures chips and the session bridge read it too).
export { usWeekendClosed };

/** Shows a futures chip only with a live quote on an open CME week. Runs on every live-quote event and route show. */
export function syncHomeQuoteRow({ documentRef: doc, root, nowMs = Date.now() }) {
  const row = doc?.getElementById?.('home-cross-assets');
  if (!row) return 0;
  const closed = usWeekendClosed(nowMs);
  let shown = 0;
  for (const chip of row.querySelectorAll('[data-futures]')) {
    const price = Number(root?._liveData?.[chip.dataset.futures]?.price);
    chip.hidden = closed || !(price > 0);
    if (!chip.hidden) shown += 1;
  }
  return shown;
}

// P1599 (F100): the home verdict's core question — is the index rising with or without the stocks under it — as
// two same-period charts side by side. Each keeps its own axis (index level vs % of stocks); the shared x-range
// and a one-line read make the comparison, not a merged scale.
// v58.80 (first-users bundle 1): the same 3개월 (63 sessions, sessionPointBack) as every other screen.
export function homeParticipationSeries(history = []) {
  const basis = closeBasis(history);
  const all = buildCloseSeries(history, 'spx', { through: basis });
  const start = sessionPointBack(all, MARKET_WINDOWS.quarter);
  return { spx: start ? all.filter((point) => point.date >= start.date) : all.slice(-(MARKET_WINDOWS.quarter + 1)), b50: buildCloseSeries(history, 'breadth50', { through: basis }) }; // P1623: producer declares percent, including values below 1%.
}
// v58.80 (first-users R2-12): a recent turn against the window's direction is part of the title too.
export function participationTitle(spxMove, b0, b1, b20 = null) {
  if (!Number.isFinite(b0) || !Number.isFinite(b1)) return '지수와 참여 종목, 같은 기간';
  const flat = Math.abs(b1 - b0) < 0.5;
  const turn = Number.isFinite(b20) && Math.abs(b1 - b20) >= 3 && !flat && Math.sign(b1 - b20) !== Math.sign(b1 - b0);
  if (turn) return `${spxMove > 0 ? '지수는 올랐고' : '지수는 약했고'} 참여 종목은 ${b1 < b0 ? '줄었다가 최근 다시 늘고 있습니다' : '늘었다가 최근 다시 줄고 있습니다'}`;
  if (spxMove > 0) return flat ? '지수는 올랐고 참여 종목은 그대로입니다' : b1 < b0 ? '지수는 올랐지만 참여 종목은 줄었습니다' : '지수가 오르며 참여 종목도 늘었습니다';
  return flat ? '지수는 약했고 참여 종목은 그대로입니다' : b1 < b0 ? '지수와 참여 종목이 함께 약해졌습니다' : '지수는 약했지만 참여 종목은 늘었습니다';
}

// v59.51 (two layers): the card's face is its title (the plain answer) and the two charts; the numbers behind the title,
// the rotation-or-decline question and the counting basis open under it. The "6개 축 근거" link row left — the hero's
// chips and chart link go to 시장 상태; the 시장 폭 row stays as the way to the breadth screen.
export function renderHomeParticipation({ documentRef: doc, root, history = Array.isArray(root?._aioHistory) ? root._aioHistory : [] }) {
  const host = doc?.getElementById?.('home-participation');
  if (!host) return false;
  syncHomeQuoteRow({ documentRef: doc, root });
  const { spx, b50 } = homeParticipationSeries(history);
  if (spx.length < 20) { host.hidden = true; return false; }
  const range = [spx[0].date, spx[spx.length - 1].date];
  const b50In = b50.filter((point) => point.date >= range[0] && point.date <= range[1]);
  const spxMove = (spx[spx.length - 1].value / spx[0].value - 1) * 100;
  const b0 = b50In[0]?.value;
  const b1 = b50In[b50In.length - 1]?.value;
  // v57.86 (live review): a recent move against the window's direction is named beside it.
  const b20 = sessionPointBack(b50In, MARKET_WINDOWS.rule)?.value ?? null; // v58.80: 20 sessions, not 21 rows
  const recentTurn = b20 != null && b0 != null && b1 != null && Math.sign(b1 - b20) !== 0 && Math.sign(b1 - b20) !== Math.sign(b1 - b0) && Math.abs(b1 - b20) >= 3
    ? `. 최근 20거래일은 ${b20.toFixed(0)}% → ${b1.toFixed(0)}%로 ${b1 > b20 ? '다시 넓어지는 중입니다' : '다시 줄어드는 중입니다'}` : '';
  const hasBreadth = b50In.length >= 2;
  // v58.74 (text audit): widening participation beside a leadership break is the expert's next question.
  const leadershipState = root ? readMarketRegime(root)?.leadershipVerdict?.state : null;
  const bridge = recentTurn && b1 > b20 && (leadershipState === 'break' || leadershipState === 'weak')
    ? ' 참여는 넓어지는데 주도주는 약해지는 중이라, 돈이 다른 업종으로 옮겨 가는 순환인지 동반 약세의 앞 단계인지가 다음 확인입니다.' : '';
  const spanSessions = countOpenSessionsBetween(range[0], range[1], 'US');
  const read = hasBreadth
    ? `${spanSessions === MARKET_WINDOWS.quarter ? '3개월' : `${spanSessions}거래일`} 동안 S&P 500 ${signedText(spxMove, 1, '%')}, 같은 기간 50일선 위 종목 ${b0.toFixed(0)}% → ${b1.toFixed(0)}%${recentTurn}.${bridge}`
    : `${spanSessions}거래일 S&P 500 ${signedText(spxMove, 1, '%')}, 시장 폭 기록은 아직 같은 기간을 채우지 못했습니다.`;
  const head = doc.createElement('div');
  head.className = 'sx-card__head home-participation-head aio-frame-head';
  const title = doc.createElement('h2');
  title.className = 'sx-card__title';
  title.id = 'home-participation-title';
  title.textContent = participationTitle(spxMove, hasBreadth ? b0 : null, hasBreadth ? b1 : null, hasBreadth ? b20 : null);
  const [, endMonth, endDay] = range[1].split('-').map(Number);
  head.append(title, asOfChip(doc, `${endMonth}/${endDay} 종가`, `최근 ${spanSessions}거래일, ${range[0]} ~ ${range[1]} 종가`));
  markFrame(host, 'home.participation');
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
    card('S&P 500 종가', `${signedText(spxMove, 1)}%`, createTrendChart(doc, { series: spx, format: (value) => value.toFixed(0), label: 'S&P 500 종가', range })),
    card('50일선 위 종목 비율', hasBreadth ? `${b0.toFixed(0)}% → ${b1.toFixed(0)}%` : '기록 수집 중', createTrendChart(doc, { series: b50In, refLines: [40, 60], format: (value) => `${value.toFixed(0)}%`, label: '50일선 위 종목 비율', domain: [0, 100], range }))
  );
  const wasOpen = !!host.querySelector(':scope > details')?.open;
  const detail = doc.createElement('details');
  detail.className = 'home-participation-basis';
  detail.open = wasOpen;
  const label = doc.createElement('summary');
  label.textContent = '숫자와 집계 기준';
  const reading = doc.createElement('p');
  reading.textContent = read;
  const text = doc.createElement('p');
  // v58.79 (owner 2026-10-25): S&P 500 members after the producer switch; the history row says which population it counts.
  const scope = breadthScopeOf(root?._aioHistory);
  text.textContent = scope.sp500
    ? '50일선 위 종목 비율은 S&P 500 구성 종목으로 계산한 값이며 지수 회사의 공식 통계가 아닙니다. 두 차트는 같은 기간을 쓰지만 세로축은 각자의 단위입니다.'
    : '50일선 위 종목 비율은 ETF를 뺀 AIO 관찰 목록(미국)의 개별 주식으로 계산해 거래소 전체 집계와 다릅니다. 두 차트는 같은 기간을 쓰지만 세로축은 각자의 단위입니다.';
  detail.append(label, reading, text);
  const breadthRow = doc.createElement('button');
  breadthRow.type = 'button';
  breadthRow.className = 'flow-next-link home-breadth-link';
  breadthRow.textContent = '시장 폭 상세 →';
  breadthRow.dataset.action = 'showPage';
  breadthRow.dataset.arg = 'breadth';
  host.replaceChildren(head, grid, detail, breadthRow);
  host.hidden = false;
  return true;
}
