import { readNumber as finite } from '../shared/number.js';
import { isoDay } from '../shared/session-date.js';
import { FRESHNESS_POLICY } from '../shared/freshness-policy.js';
import { financialKind } from './financial-kind.js';

const DAY = 86400000;
export const CASH_METRICS_MAX_AGE_DAYS = FRESHNESS_POLICY.fundamentalPeriodDays; // the screener's other annual filing figures' budget

const round1 = (value) => Math.round(value * 10) / 10;

/** { fcfMargin, capexIntensity, periodEnd } of the latest fiscal year, or null when it cannot be read. */
export function cashMetrics(years, { sic = null, symbol = null, sector = null, nowMs = Date.now() } = {}) {
  if (financialKind(symbol, sector, sic) != null) return null;
  const latest = (Array.isArray(years) ? years : []).filter((year) => isoDay(year?.periodEnd)).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).at(-1);
  if (!latest || nowMs - Date.parse(`${latest.periodEnd}T00:00:00Z`) > CASH_METRICS_MAX_AGE_DAYS * DAY) return null;
  const revenue = finite(latest.revenue);
  const cash = finite(latest.operatingCashFlow);
  const capex = finite(latest.capex);
  if (!(revenue > 0) || capex == null || capex < 0) return null;
  return { fcfMargin: cash == null ? null : round1(((cash - capex) / revenue) * 100), capexIntensity: round1((capex / revenue) * 100), periodEnd: latest.periodEnd };
}
