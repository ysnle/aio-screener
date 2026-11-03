// 오늘: the one quote row and the participation card.
//
// v59.51 (content audit 2026-10-31, "one price surface"): the four KPI tiles (futures, 10-year, WTI with 20-session lines),
// the "지금 시세" heading and the cross-asset capsules were three price surfaces under the index strip, and on a weekend the
// futures tiles repeated the strip's closes. They are one chip row now (#home-cross-assets); the strip above is the market
// visual. A futures chip shows only a live futures quote while CME trades (usWeekendClosed, the rule the session bridge's
// futures line uses too); otherwise the strip's close is the answer and the chip is hidden.
import { buildCloseSeries, closeBasis, sessionPointBack } from '../../domain/briefing/market-read.js';
import { usWeekendClosed } from '../../domain/market/market-calendar.js';
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
