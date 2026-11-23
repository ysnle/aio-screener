const DAY_MS = 86400000;

export const FRESHNESS_POLICY = Object.freeze({
  // A quote counts as live: the screener's live overlay and the portfolio surface.
  liveQuoteMs: 15 * 60 * 1000,
  // Price factors and breadth: the latest completed session, or one behind while that close is under 12 hours old (the
  // screener runs every 6 hours and after the US close: two missed runs). 4 days only where the calendar has no year.
  factorSession: Object.freeze({ maxLag: 1, graceMs: 12 * 60 * 60 * 1000 }),
  factorSessionMs: 4 * DAY_MS,
  // Fiscal period end to the price session: 15 months, the latest date the next 10-K can arrive.
  fundamentalPeriodDays: 456,
});
