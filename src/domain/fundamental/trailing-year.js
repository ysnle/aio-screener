// The trailing-year read of the SEC quarters (sec-fiscal-history `quarters`, parsed by quarter-read.js parseQuarterHistory).
// One implementation for 재무 공시, the ticker page's peer comparison and the screener row: the screener producer
// and the page cannot compute two different "latest four quarters".
import { finiteFact as finite, isQuarterGap } from './period.js';
import { isIsoDay } from '../shared/session-date.js';
import { SEC_MARGIN_HOLD_ABOVE_PCT } from './sec-report.js';

// 2026-10-14 audit #2: the four latest consecutive fiscal quarters (period.js isQuarterGap, no gap), newest last, or null.
// A derived fourth quarter (FY − Q1..Q3) counts; nothing is estimated beyond the published quarters.
// `field` is the value every quarter of the span must carry: net income by default (a margin or an income sum), revenue
// for a revenue-only comparison (an issuer's oldest stored quarter is often a derived Q4 with revenue but no net income).
// (Moved verbatim from fiscal-read.js in 2026-11-18, which re-exports it.)
export function trailingQuarters(quarters = [], count = 4, { field = 'netIncome' } = {}) {
  const rows = (Array.isArray(quarters) ? quarters : []).filter((q) => isIsoDay(String(q?.periodEnd || '')))
    .slice().sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  if (rows.length < count) return null;
  const span = rows.slice(-count);
  for (let i = 1; i < span.length; i += 1) {
    const gapDays = (Date.parse(span[i].periodEnd) - Date.parse(span[i - 1].periodEnd)) / 86400000;
    if (!isQuarterGap(gapDays)) return null;
  }
  return span.every((q) => finite(q[field]) != null) ? span : null;
}

// ── 재무 공시 for fundamental investors and traders ─────────────────────────────────────────────
// The latest four consecutive fiscal quarters summed (sec-fiscal-history `quarters`), beside the same four quarters a year
// earlier. Null unless all four are consecutive and carry both revenue and net income; the prior span only when it is the
// eight-quarter run directly before. A derived fourth quarter (FY − Q1..Q3) counts, as everywhere else on the page.
// (Moved verbatim from analysis-read.js in 2026-11-18, which re-exports it.)
export function buildTrailingYearRead(quarters = []) {
  const span = trailingQuarters(quarters, 4);
  if (!span || !span.every((q) => finite(q.revenue) != null)) return null;
  const sum = (rows, field) => rows.reduce((total, q) => total + q[field], 0);
  const revenue = sum(span, 'revenue');
  const netIncome = sum(span, 'netIncome');
  // The year-earlier span needs revenue only: its net income may be missing (a derived Q4 without the year's Q1..Q3 income)
  // and that blanks the income comparison, not the revenue growth (TSLA, PLTR, AVGO fell back to a ten-month-old year).
  const run = trailingQuarters(quarters, 8, { field: 'revenue' });
  const prior = run && run.slice(4).every((q, index) => q === span[index]) ? run.slice(0, 4) : null;
  const priorRevenue = prior ? sum(prior, 'revenue') : null;
  const priorIncome = prior && prior.every((q) => finite(q.netIncome) != null) ? sum(prior, 'netIncome') : null;
  return {
    from: span[0].periodEnd, through: span[3].periodEnd, revenue, netIncome, margin: revenue > 0 ? netIncome / revenue * 100 : null,
    revenueYoy: priorRevenue > 0 ? (revenue / priorRevenue - 1) * 100 : null,
    netIncomeYoy: priorIncome > 0 ? (netIncome / priorIncome - 1) * 100 : null,
    priorMargin: priorRevenue > 0 && priorIncome != null ? priorIncome / priorRevenue * 100 : null,
    hasDerived: span.some((q) => q.derived)
  };
}

// The time basis of a screener row's margin and revenue growth. 'ttm' = the latest four quarters (growth: against the
// four before them); 'fy' = the latest fiscal year. A row without a basis field (artifacts before 2026-11-18) is FY.
export const FUNDAMENTAL_BASIS = Object.freeze({ ttm: 'ttm', fy: 'fy' });
export const TRAILING_ROW_FIELDS = Object.freeze(['margin', 'revGrowth']);
const round1 = (value) => Math.round(value * 10) / 10;

/**
 * The row's margin and revenue growth on one basis with the P/E's trailing earnings. `fy` is the fiscal-year record's
 * own { margin, revGrowth, observedAt } (already healed: margin > 100% withheld); `quarters` the parsed quarter series.
 * A trailing figure replaces the FY one only when its four quarters end on or after the fiscal year end, and is held
 * under the FY path's limits: no TTM read for a record whose revenue concept was withheld as a subtotal (heldRevenue),
 * revenue and the year-earlier revenue must be positive, and a TTM margin above 100% falls back to FY.
 * Returns { margin, marginBasis, marginThrough, revGrowth, revGrowthBasis, revGrowthThrough } with a missing figure omitted.
 */
export function trailingRowFundamentals(quarters = [], { margin = null, revGrowth = null, observedAt = null, heldRevenue = false } = {}) {
  const fiscalEnd = String(observedAt || '').slice(0, 10) || null;
  const read = heldRevenue ? null : buildTrailingYearRead(quarters);
  const current = read && (!fiscalEnd || read.through >= fiscalEnd) ? read : null;
  const out = {};
  const ttmMargin = current && current.revenue > 0 && current.margin != null && current.margin <= SEC_MARGIN_HOLD_ABOVE_PCT ? round1(current.margin) : null;
  if (ttmMargin != null) Object.assign(out, { margin: ttmMargin, marginBasis: FUNDAMENTAL_BASIS.ttm, marginThrough: current.through });
  else if (finite(margin) != null) Object.assign(out, { margin: finite(margin), marginBasis: FUNDAMENTAL_BASIS.fy, marginThrough: fiscalEnd });
  const ttmGrowth = current && current.revenueYoy != null ? round1(current.revenueYoy) : null;
  if (ttmGrowth != null) Object.assign(out, { revGrowth: ttmGrowth, revGrowthBasis: FUNDAMENTAL_BASIS.ttm, revGrowthThrough: current.through });
  else if (finite(revGrowth) != null) Object.assign(out, { revGrowth: finite(revGrowth), revGrowthBasis: FUNDAMENTAL_BASIS.fy, revGrowthThrough: fiscalEnd });
  return out;
}
