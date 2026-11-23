import { finiteFact as finite, isQuarterGap } from './period.js';
import { isIsoDay } from '../shared/session-date.js';
import { SEC_MARGIN_HOLD_ABOVE_PCT } from './sec-report.js';

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
