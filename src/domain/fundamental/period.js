// Shared by the SEC producer and the historical selector. A missing fact is
// not zero; ratios must not join unrelated fiscal periods.
export function finiteFact(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sameFiscalPeriod(left, right) {
  const leftEnd = left?.periodEnd || left?.end;
  const rightEnd = right?.periodEnd || right?.end;
  if (!leftEnd || leftEnd !== rightEnd || !Number.isFinite(Date.parse(leftEnd))) return false;
  const leftStart = left?.periodStart || left?.start;
  const rightStart = right?.periodStart || right?.start;
  return !leftStart || !rightStart || leftStart === rightStart;
}

// P1652 + 2026-10-13 review S01: one fundamental freshness rule. A filing whose fiscal period ended more than
// 15 months (456 days) before the price session is not the company's current fundamentals. The screener
// provider holds such values and the factor ranker gates value/quality with the same rule — a second,
// filing-date budget (180 days) used to switch both factors off for 731 of 810 US rows.
export const FUNDAMENTAL_MAX_PERIOD_AGE_DAYS = 456;
export function fundamentalPeriodTooOld(periodEnd, sessionDate) {
  const end = Date.parse(String(periodEnd || '').slice(0, 10));
  const session = Date.parse(String(sessionDate || '').slice(0, 10));
  return Number.isFinite(end) && Number.isFinite(session) && (session - end) / 86400000 > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
}

// v57.81 (analysis audit): the stock hero read "연간 공시 매출 +48.9%" for a fiscal year that closed 412 days earlier.
// The annual figure names its fiscal year, and when the NEXT fiscal year has closed and the longest SEC 10-K deadline
// (90 days, non-accelerated filers) has passed with no newer annual row, that is said. Nothing is estimated.
export const ANNUAL_FILING_GRACE_DAYS = 90;
export function annualFilingStatus(periodEnd, asOf) {
  const end = String(periodEnd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const asOfMs = typeof asOf === 'number' ? asOf : Date.parse(String(asOf || '').slice(0, 10));
  const [y, m, d] = end.split('-').map(Number);
  const nextEndMs = Date.UTC(y + 1, m - 1, d);
  const dueMs = nextEndMs + ANNUAL_FILING_GRACE_DAYS * 86400000;
  return Object.freeze({ fyLabel: `FY${y}`, periodEnd: end, nextDueBy: new Date(dueMs).toISOString().slice(0, 10), overdue: Number.isFinite(asOfMs) && asOfMs > dueMs });
}

export function isPriorAnnualPeriod(current, prior) {
  const days = (Date.parse(current?.periodEnd || current?.end || '') - Date.parse(prior?.periodEnd || prior?.end || '')) / 86400000;
  // Matches the producer's supported annual duration range; a missing fiscal
  // year must never become a one-year growth observation.
  return Number.isFinite(days) && days >= 300 && days <= 400;
}
