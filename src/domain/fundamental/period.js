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

export const FUNDAMENTAL_MAX_PERIOD_AGE_DAYS = FRESHNESS_POLICY.fundamentalPeriodDays;
export function fundamentalPeriodTooOld(periodEnd, sessionDate) {
  const end = Date.parse(String(periodEnd || '').slice(0, 10));
  const session = Date.parse(String(sessionDate || '').slice(0, 10));
  return Number.isFinite(end) && Number.isFinite(session) && (session - end) / 86400000 > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
}

export const ANNUAL_FILING_GRACE_DAYS = 90;
export function fiscalYearLabel(periodEnd) {
  const end = String(periodEnd || '').slice(0, 10);
  if (!isIsoDay(end)) return null;
  const [y, m, d] = end.split('-').map(Number);
  return `FY${m === 1 && d <= 7 ? y - 1 : y}`;
}
export function fiscalYearShortLabel(periodEnd) {
  const label = fiscalYearLabel(periodEnd);
  return label ? `FY${label.slice(-2)}` : null;
}
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

export const isQuarterSpan = (days) => days >= 77 && days <= 119;
export const isQuarterGap = (days) => days >= 75 && days <= 125;

export function isPriorAnnualPeriod(current, prior) {
  const days = (Date.parse(current?.periodEnd || current?.end || '') - Date.parse(prior?.periodEnd || prior?.end || '')) / 86400000;
  // Matches the producer's supported annual duration range; a missing fiscal
  // year must never become a one-year growth observation.
  return Number.isFinite(days) && days >= 300 && days <= 400;
}
