// P1607: shared calendar discovery stays within the artifact's actual date window.
import { EARNINGS_CALENDAR } from '../artifact-registry.js';
import { refreshSharedArtifact } from '../shared-artifacts.js';
export function selectPublicEarnings(data, symbol, from, to) {
  if (!data || data.status !== 'current-reference' || !Array.isArray(data.earnings) || !data.weekStart || !data.weekEnd || from > data.weekEnd || to < data.weekStart) return null;
  return data.earnings.filter(row => row.symbol === symbol && row.date >= from && row.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, source: data.source, sourceUrl: data.sourceUrl, fetchedAt: data.generatedAt, coverageEnd: data.weekEnd }));
}

// The AI's earnings reader reads the registry's shared copy (root[EARNINGS_CALENDAR.key]), the same one the screens use.
export function createPublicEarningsReader(root) {
  return async (symbol, from, to) => {
    await refreshSharedArtifact(root, EARNINGS_CALENDAR);
    return selectPublicEarnings(root?.[EARNINGS_CALENDAR.key] || null, symbol, from, to);
  };
}
