import { buildCloseSeries, closeBasis, sessionPointBack } from '../../domain/briefing/market-read.js';
import { usWeekendClosed } from '../../domain/market/session/market-calendar.js';
import { MARKET_WINDOWS } from '../../domain/market/session/market-windows.js';

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

export function homeParticipationSeries(history = []) {
  const basis = closeBasis(history);
  const all = buildCloseSeries(history, 'spx', { through: basis });
  const start = sessionPointBack(all, MARKET_WINDOWS.quarter);
  return { spx: start ? all.filter((point) => point.date >= start.date) : all.slice(-(MARKET_WINDOWS.quarter + 1)), b50: buildCloseSeries(history, 'breadth50', { through: basis }) };
}
