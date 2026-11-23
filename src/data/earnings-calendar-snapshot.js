import { EARNINGS_CALENDAR } from './artifact-registry.js';
import { refreshSharedArtifact } from './shared-artifacts.js';

export async function fetchEarningsCalendarSnapshot({ root = globalThis } = {}) {
  try {
    await refreshSharedArtifact(root, EARNINGS_CALENDAR);
    const d = root[EARNINGS_CALENDAR.key];
    if (!d || !Array.isArray(d.earnings)) return null;
    return {
      earnings: d.earnings,
      ipos: Array.isArray(d.ipos) ? d.ipos : [],
      weekStart: d.weekStart || null,
      weekEnd: d.weekEnd || null,
      generatedAt: d.generatedAt || null,
      source: d.source || null,
      sourceUrl: d.sourceUrl || null,
      unconfirmed: d.largeCapCoverage && Array.isArray(d.largeCapCoverage.unconfirmed) ? d.largeCapCoverage.unconfirmed : []
    };
  } catch (e) {
    if (typeof root._aioLog === 'function') root._aioLog('warn', 'fetch', `earnings calendar snapshot error: ${e.message}`);
    return null;
  }
}
