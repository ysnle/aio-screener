// Shared by the SEC producer and the historical selector. A missing fact is
// not zero; ratios must not join unrelated fiscal periods.
// finiteFact is the shared reader (same rule: numbers and non-blank numeric strings only).
import { readNumber } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';
import { FRESHNESS_POLICY } from '../shared/freshness-policy.js';

export const finiteFact = readNumber;

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
export const FUNDAMENTAL_MAX_PERIOD_AGE_DAYS = FRESHNESS_POLICY.fundamentalPeriodDays;
export function fundamentalPeriodTooOld(periodEnd, sessionDate) {
  const end = Date.parse(String(periodEnd || '').slice(0, 10));
  const session = Date.parse(String(sessionDate || '').slice(0, 10));
  return Number.isFinite(end) && Number.isFinite(session) && (session - end) / 86400000 > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
}

// The stock hero read "연간 공시 매출 +48.9%" for a fiscal year that closed 412 days earlier.
// The annual figure names its fiscal year, and when the NEXT fiscal year has closed and the longest SEC 10-K deadline
// (90 days, non-accelerated filers) has passed with no newer annual row, that is said. Nothing is estimated.
export const ANNUAL_FILING_GRACE_DAYS = 90;
// A 52/53-week fiscal year can close in the first days of January (LDOS 2026-01-02, SNA/TXT/SWK
// 2026-01-03); the filer calls it the previous year's fiscal year, so it is labelled by that year. Any other end date is
// labelled by its calendar year (Walmart's year ending 2026-01-31 is its own FY2026).
export function fiscalYearLabel(periodEnd) {
  const end = String(periodEnd || '').slice(0, 10);
  if (!isIsoDay(end)) return null;
  const [y, m, d] = end.split('-').map(Number);
  return `FY${m === 1 && d <= 7 ? y - 1 : y}`;
}
// The short axis label ("FY25") comes from the same rule, so a chart axis and the card
// beside it never name one filing by two years. Every fiscal-year label in src/ goes through these two functions.
export function fiscalYearShortLabel(periodEnd) {
  const label = fiscalYearLabel(periodEnd);
  return label ? `FY${label.slice(-2)}` : null;
}
// The one quarter label on 재무 공시 — the year-month of the SEC quarter end ('2026-08' for a quarter ended
// 2026-08-02). The consensus source names the same fiscal quarter by its own month ('2026-07'); secQuarterLabel maps such
// a month to the SEC quarter end nearest its month end within 45 days, or returns null (the caller keeps the source label).
export const quarterLabel = (periodEnd) => (isIsoDay(String(periodEnd || '').slice(0, 10)) ? String(periodEnd).slice(0, 7) : null);
const QUARTER_ALIGN_DAYS = 45;
export function secQuarterLabel(month, quarters = []) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return null;
  const anchor = Date.UTC(Number(m[1]), Number(m[2]), 0);
  let best = null;
  for (const quarter of Array.isArray(quarters) ? quarters : []) {
    const end = String(quarter?.periodEnd || '').slice(0, 10);
    if (!isIsoDay(end)) continue;
    const gap = Math.abs(Date.parse(`${end}T00:00:00Z`) - anchor) / 86400000;
    if (gap <= QUARTER_ALIGN_DAYS && (!best || gap < best.gap)) best = { gap, end };
  }
  return best ? quarterLabel(best.end) : null;
}
export function annualFilingStatus(periodEnd, asOf) {
  const end = String(periodEnd || '').slice(0, 10);
  if (!isIsoDay(end)) return null;
  const asOfMs = typeof asOf === 'number' ? asOf : Date.parse(String(asOf || '').slice(0, 10));
  const [y, m, d] = end.split('-').map(Number);
  const nextEndMs = Date.UTC(y + 1, m - 1, d);
  const dueMs = nextEndMs + ANNUAL_FILING_GRACE_DAYS * 86400000;
  return Object.freeze({ fyLabel: fiscalYearLabel(end), periodEnd: end, nextDueBy: new Date(dueMs).toISOString().slice(0, 10), overdue: Number.isFinite(asOfMs) && asOfMs > dueMs });
}

// One fiscal quarter: 13/14 weeks, or the 12- and 16-week quarters of a 12-12-12-16 year (77–119 days from start to end).
// Consecutive quarter ends sit 75–125 days apart. The producer's quarter rows, the TTM chain and the page share these.
export const isQuarterSpan = (days) => days >= 77 && days <= 119;
export const isQuarterGap = (days) => days >= 75 && days <= 125;

export function isPriorAnnualPeriod(current, prior) {
  const days = (Date.parse(current?.periodEnd || current?.end || '') - Date.parse(prior?.periodEnd || prior?.end || '')) / 86400000;
  // Matches the producer's supported annual duration range; a missing fiscal
  // year must never become a one-year growth observation.
  return Number.isFinite(days) && days >= 300 && days <= 400;
}
