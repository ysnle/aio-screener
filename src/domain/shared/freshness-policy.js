// v59.46 boundary contract: the age budgets that several modules applied with their own copies of the same number.
// A budget changes here or nowhere — the screener provider, factor ranker, breadth reader and portfolio surface used to
// each hold a 15-minute, 4-day or 456-day literal, so one could move without the others. Budgets whose meaning differs
// (the 72-hour FX leg, the 20-minute quote-currentness window, artifact cache ages) are not the same rule and stay local.
const DAY_MS = 86400000;

export const FRESHNESS_POLICY = Object.freeze({
  // A quote counts as live: the screener's live overlay and the portfolio surface.
  liveQuoteMs: 15 * 60 * 1000,
  // Price factors and the breadth computed from them: the last completed close plus a weekend and a holiday.
  factorSessionMs: 4 * DAY_MS,
  // Fiscal period end to the price session: 15 months, the latest date the next 10-K can arrive.
  fundamentalPeriodDays: 456,
});
