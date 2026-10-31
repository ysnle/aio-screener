// v59.44 (owner 2026-10-30, X bookmarks 10/30: Alphabet fell on negative quarterly free cash flow and Amazon on capex —
// "the market is pricing cash, not growth"): the screener's two cash conditions, read from the latest filed fiscal year in
// the SEC fiscal history (USD, the same rows 종목's 이익의 질 card reads). Observed filings only; no year is estimated.
// Financials (SIC 6000–6799) are left out: their operating cash flow mixes deposits and loans.
// v59.46 (structure pilot): the local reader read '' and false as 0, so a blank capex became "0% capex" and the whole
// operating cash flow counted as free cash flow; values go through the shared reader.
import { readNumber as finite } from '../shared/number.js';
import { isoDay } from '../shared/session-date.js';
import { FRESHNESS_POLICY } from '../shared/freshness-policy.js';

const DAY = 86400000;
export const CASH_METRICS_MAX_AGE_DAYS = FRESHNESS_POLICY.fundamentalPeriodDays; // the screener's other annual filing figures' budget

const round1 = (value) => Math.round(value * 10) / 10;

/** { fcfMargin, capexIntensity, periodEnd } of the latest fiscal year, or null when it cannot be read. */
export function cashMetrics(years, { sic = null, nowMs = Date.now() } = {}) {
  const code = finite(sic);
  if (code != null && code >= 6000 && code < 6800) return null;
  const latest = (Array.isArray(years) ? years : []).filter((year) => isoDay(year?.periodEnd)).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).at(-1);
  if (!latest || nowMs - Date.parse(`${latest.periodEnd}T00:00:00Z`) > CASH_METRICS_MAX_AGE_DAYS * DAY) return null;
  const revenue = finite(latest.revenue);
  const cash = finite(latest.operatingCashFlow);
  const capex = finite(latest.capex);
  if (!(revenue > 0) || capex == null || capex < 0) return null;
  return { fcfMargin: cash == null ? null : round1(((cash - capex) / revenue) * 100), capexIntensity: round1((capex / revenue) * 100), periodEnd: latest.periodEnd };
}
