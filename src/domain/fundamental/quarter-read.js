// Codex review 2026-10-05 (분기 추이): the 재무 공시 page read annual 10-K only, so a fiscal year that ended
// a year ago stood in for "recent results". This reads the last eight fiscal quarters published in
// public-data/sec-fiscal-history.json (`quarters`, USD millions) and compares each quarter with the same
// quarter a year earlier — the comparison that removes seasonality. A derived fourth quarter (FY − Q1..Q3)
// is labelled; no quarter is estimated beyond that.
import { signedText } from '../shared/number.js';
const finite = (value) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value));

export function parseQuarterHistory(text) {
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''))
    .map(([periodEnd, revenue, netIncome, basis]) => ({
      periodEnd,
      revenue: finite(revenue) == null ? null : finite(revenue) * 1e6,
      netIncome: finite(netIncome) == null ? null : finite(netIncome) * 1e6,
      derived: basis === 'd'
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
  const yoys = withYoy.map((q) => q.revenueYoy).filter((value) => value != null);
  // v57.55 review (E1-03): comparing only the last and the third-last value called MRNA's +260% → +2.1% "빨라졌다".
  // A direction is named only when both of the last two steps agree; otherwise the series is uneven.
  const [a, b, c] = yoys.slice(-3);
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
