// Codex review 2026-10-05 (분기 추이): the 재무 공시 page read annual 10-K only, so a fiscal year that ended
// a year ago stood in for "recent results". This reads the last eight fiscal quarters published in
// public-data/sec-fiscal-history.json (`quarters`, USD millions) and compares each quarter with the same
// quarter a year earlier — the comparison that removes seasonality. A derived fourth quarter (FY − Q1..Q3)
// is labelled; no quarter is estimated beyond that.
import { signedText, readNumber as finite } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';
import { withSubjectParticle } from '../content/korean-particle.js';

export function parseQuarterHistory(text) {
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => isIsoDay(cells[0] || ''))
    .map(([periodEnd, revenue, netIncome, basis, inventory, receivables]) => ({
      periodEnd,
      revenue: finite(revenue) == null ? null : finite(revenue) * 1e6,
      netIncome: finite(netIncome) == null ? null : finite(netIncome) * 1e6,
      derived: basis === 'd',
      // v59.70 (X bookmarks #8): quarter-end balances; undefined = not yet collected, null = not reported.
      inventory: inventory === undefined ? undefined : finite(inventory) == null ? null : finite(inventory) * 1e6,
      receivables: receivables === undefined ? undefined : finite(receivables) == null ? null : finite(receivables) * 1e6
    }));
}

const DAY = 86400000;
function yearAgo(quarters, quarter) {
  const target = Date.parse(quarter.periodEnd) - 365 * DAY;
  return quarters.find((other) => Math.abs(Date.parse(other.periodEnd) - target) <= 20 * DAY) || null;
}

export function buildQuarterRead(quarters = []) {
  const rows = (Array.isArray(quarters) ? quarters : []).filter((q) => q && q.periodEnd).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  if (rows.length < 2) return { available: false, rows: [] };
  const withYoy = rows.map((q) => {
    const prior = yearAgo(rows, q);
    const revenueYoy = prior?.revenue > 0 && q.revenue != null ? (q.revenue / prior.revenue - 1) * 100 : null;
    const margin = q.revenue > 0 && q.netIncome != null ? q.netIncome / q.revenue * 100 : null;
    return { ...q, revenueYoy, margin };
  });
  const latest = withYoy[withYoy.length - 1];
  // v59.45 (pipeline review P19 quarter-read): the trend reads the latest three quarters themselves — consecutive (about
  // a quarter apart) and each with a year-ago value. Dropping the gaps first read non-adjacent quarters as a run.
  const last3 = withYoy.slice(-3);
  const consecutive = last3.length === 3 && last3.every((q, i) => i === 0 || ((Date.parse(q.periodEnd) - Date.parse(last3[i - 1].periodEnd)) / 86400000 >= 60 && (Date.parse(q.periodEnd) - Date.parse(last3[i - 1].periodEnd)) / 86400000 <= 120));
  const yoys = consecutive && last3.every((q) => q.revenueYoy != null) ? last3.map((q) => q.revenueYoy) : [];
  // v57.55 review (E1-03): comparing only the last and the third-last value called MRNA's +260% → +2.1% "빨라졌다".
  // A direction is named only when both of the last two steps agree; otherwise the series is uneven.
  const [a, b, c] = yoys;
  const trend = yoys.length >= 3
    ? (b > a + 3 && c > b + 3 ? '전년 대비 성장률이 최근 분기로 갈수록 빨라졌습니다'
      : b < a - 3 && c < b - 3 ? '전년 대비 성장률이 최근 분기로 갈수록 느려졌습니다'
        : Math.max(a, b, c) - Math.min(a, b, c) <= 6 ? '전년 대비 성장률이 비슷하게 유지됩니다'
          : `전년 대비 성장률이 분기마다 들쭉날쭉합니다(직전 분기 ${signedText(b, 1, '%')})`)
    : null;
  const signed = (value) => signedText(value, 1, '%');
  const headline = latest.revenueYoy != null
    ? `최근 분기(${latest.periodEnd.slice(0, 7)} 마감) 매출은 전년 같은 분기보다 ${signed(latest.revenueYoy)}${trend ? `입니다. ${trend}` : '입니다'}.`
    : `최근 분기(${latest.periodEnd.slice(0, 7)} 마감) 매출은 비교할 전년 같은 분기 기록이 아직 없습니다.`;
  return { available: true, rows: withYoy, latest, headline, hasDerived: withYoy.some((q) => q.derived) };
}

// v59.70 (X bookmarks #8): the working-capital side of a cash-flow change — inventory and trade receivables at the latest
// quarter end against the quarter before (about a quarter apart), beside revenue's change over the same step. A balance
// growing faster than revenue is cash tied up (AMD 3Q26: free cash flow -64% q/q on inventory and receivables).
export function buildWorkingCapitalRead(quarters = []) {
  const rows = (Array.isArray(quarters) ? quarters : []).filter((q) => q?.periodEnd).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const latest = rows.at(-1); const prior = rows.at(-2);
  if (!latest || !prior || latest.inventory === undefined) return { available: false, collected: latest?.inventory !== undefined, rows: [] };
  const gap = (Date.parse(latest.periodEnd) - Date.parse(prior.periodEnd)) / DAY;
  if (!(gap >= 60 && gap <= 120)) return { available: false, collected: true, rows: [] };
  const change = (field) => (Number.isFinite(latest[field]) && Number.isFinite(prior[field]) && prior[field] > 0 ? { from: prior[field], to: latest[field], pct: (latest[field] / prior[field] - 1) * 100 } : null);
  const inventory = change('inventory'); const receivables = change('receivables'); const revenue = change('revenue');
  if (!inventory && !receivables) return { available: false, collected: true, rows: [] };
  const faster = [inventory && revenue && inventory.pct > revenue.pct + 5 ? '재고' : null, receivables && revenue && receivables.pct > revenue.pct + 5 ? '매출채권' : null].filter(Boolean);
  const part = (label, value) => (value ? `${label} ${signedText(value.pct, 1, '%')}` : null);
  const parts = [part('재고', inventory), part('매출채권', receivables)].filter(Boolean).join(', ');
  const headline = `${latest.periodEnd.slice(0, 7)} 분기 말, 직전 분기 대비 ${parts}${revenue ? `(분기 매출 ${signedText(revenue.pct, 1, '%')})` : ''}${faster.length ? ` — ${withSubjectParticle(faster.join('·'))} 매출보다 빠르게 늘어 현금이 묶였습니다` : ''}.`;
  // The last quarters' balances for the bars, oldest first, with each step's change.
  const bars = rows.slice(-5).map((q, i, list) => ({ periodEnd: q.periodEnd, inventory: q.inventory ?? null, receivables: q.receivables ?? null,
    inventoryPct: i && Number.isFinite(q.inventory) && list[i - 1].inventory > 0 ? (q.inventory / list[i - 1].inventory - 1) * 100 : null,
    receivablesPct: i && Number.isFinite(q.receivables) && list[i - 1].receivables > 0 ? (q.receivables / list[i - 1].receivables - 1) * 100 : null }));
  return { available: true, collected: true, latest, prior, inventory, receivables, revenue, faster, headline, rows: bars };
}
