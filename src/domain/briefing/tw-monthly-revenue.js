// v59.56 (X-bookmark gap 2, 2026-11-01): the read model of public-data/tw-monthly-revenue.json
// (scripts/fetch-tw-monthly-revenue.mjs, TWSE OpenAPI t187ap05_L). Taiwan's listed AI supply chain reports each month's
// revenue by the 10th, a month or more before the US quarterly results it feeds; the AI 공급망 흐름 block sets it under
// the US price medians. Sums and changes come from the source's own amounts; a group with no company in the latest
// month is left out, and companies on an older month never enter the latest month's sum.
export const TW_MONTHLY_REVENUE = Object.freeze({ key: '_aioTwMonthlyRevenue', url: './public-data/tw-monthly-revenue.json', schemas: ['tw-monthly-revenue.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 256 * 1024 });
// The month M figure is due by the 10th of M+1; past the 15th of M+2 the latest month is a month late.
const LATE_AFTER_DAY = 15;

const pct = (now, before) => (now == null || before == null || before <= 0 ? null : Math.round((now / before - 1) * 1000) / 10);
export const signedPct = (value) => (value == null ? '-' : `${value > 0 ? '+' : ''}${(Math.round(value * 10) / 10 || 0).toFixed(1)}%`);
const monthLabel = (month) => `${Number(String(month).slice(5, 7))}월`;

function monthsLate(month, nowMs) {
  const now = new Date(nowMs);
  const [y, m] = String(month).split('-').map(Number);
  const gap = (now.getUTCFullYear() * 12 + now.getUTCMonth()) - (y * 12 + (m - 1));
  return gap > 2 || (gap === 2 && now.getUTCDate() > LATE_AFTER_DAY);
}

/** States: loading · unavailable (fetch failed / schema / not ok) · pending (수집 전 marker) · ok. */
export function buildTwRevenueView(artifact, { nowMs = Date.now(), loadState = 'loading' } = {}) {
  if (!artifact) return loadState === 'failed' ? { state: 'unavailable', reason: 'fetch-failed' } : { state: 'loading' };
  if (artifact.schemaVersion !== TW_MONTHLY_REVENUE.schemas[0]) return { state: 'unavailable', reason: 'schema' };
  if (artifact.status === 'not-collected') return { state: 'pending', reason: artifact.reason || null };
  if (artifact.status !== 'ok' || !artifact.latestMonth) return { state: 'unavailable', reason: artifact.status || 'unknown' };
  const month = artifact.latestMonth;
  const current = (artifact.companies || []).filter((c) => c?.month === month && Number.isFinite(c.revenue));
  const groups = [];
  for (const group of artifact.groups || []) {
    const members = current.filter((c) => c.group === group.id);
    if (!members.length) continue;
    const paired = members.filter((c) => Number.isFinite(c.yearAgo) && c.yearAgo > 0);
    const yoyPct = paired.length ? pct(paired.reduce((s, c) => s + c.revenue, 0), paired.reduce((s, c) => s + c.yearAgo, 0)) : null;
    groups.push({ id: group.id, name: group.name, yoyPct, reported: members.length, listed: (group.codes || []).length,
      members: members.map((c) => ({ code: c.code, name: c.nameKo || c.sourceName, yoyPct: c.yoyPct ?? pct(c.revenue, c.yearAgo), momPct: c.momPct ?? pct(c.revenue, c.prevMonth) })) });
  }
  if (!groups.length) return { state: 'unavailable', reason: 'no-current-month' };
  const paired = current.filter((c) => Number.isFinite(c.yearAgo) && c.yearAgo > 0);
  const totalYoy = paired.length ? pct(paired.reduce((s, c) => s + c.revenue, 0), paired.reduce((s, c) => s + c.yearAgo, 0)) : null;
  const up = current.filter((c) => (c.yoyPct ?? pct(c.revenue, c.yearAgo)) > 0).length;
  const listed = (artifact.groups || []).reduce((n, g) => n + (g.codes || []).length, 0);
  const late = monthsLate(month, nowMs);
  const strongest = [...groups].filter((g) => g.yoyPct != null).sort((a, b) => b.yoyPct - a.yoyPct)[0];
  const reading = `대만 AI 공급망 ${current.length}개사의 ${monthLabel(month)} 매출 합계는 1년 전보다 ${signedPct(totalYoy)}이고, ${current.length}개사 중 ${up}개사가 늘었습니다.`
    + (strongest && strongest.yoyPct > 0 ? ` 가장 크게 늘어난 묶음은 ${strongest.name} ${signedPct(strongest.yoyPct)}입니다.` : '')
    + (late ? ` ${monthLabel(month)}이 최신이라 지연된 상태입니다.` : '');
  return { state: 'ok', month, publishedAt: artifact.publishedAt || null, generatedAt: artifact.generatedAt || null, reported: current.length, listed, up, totalYoy, late, groups, reading, source: artifact.source || null };
}
