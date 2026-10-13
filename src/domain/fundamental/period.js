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

export function isPriorAnnualPeriod(current, prior) {
  const days = (Date.parse(current?.periodEnd || current?.end || '') - Date.parse(prior?.periodEnd || prior?.end || '')) / 86400000;
  // Matches the producer's supported annual duration range; a missing fiscal
  // year must never become a one-year growth observation.
  return Number.isFinite(days) && days >= 300 && days <= 400;
}
