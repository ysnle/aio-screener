// Roadmap item 11 (legacy decomposition, 종목 · 실적 일정): the stored earnings calendar reader moved here from
// js/aio-pages.js (_fetchEarningsCalendarSnapshot). refresh-screener writes public-data/earnings-calendar.json; it
// had no reader for a long time, so the screen's "무키 시 스냅샷" wording was not true (P1102). The snapshot carries its
// window (weekStart~weekEnd); dates outside it are dropped by the renderer. 브리핑, 오늘 일정 and 뉴스 read it through
// root._fetchEarningsCalendarSnapshot, so src/app/compatibility-globals.js installs it at boot.
// The reader shares the registry's cached copy (EARNINGS_CALENDAR, kept on root[EARNINGS_CALENDAR.key]) with the
// company summary, the chart coach, 테마 detail and 시장 상태, so one session downloads the file once per max age; a
// failed refresh keeps the last good copy.
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
      // v58.75 (persona review): the provider travels with the rows, so the schedule's estimate hover can name it.
      source: d.source || null,
      sourceUrl: d.sourceUrl || null,
      // v57.51 N19: large caps the provider window does not list are 'schedule unconfirmed', never "no report".
      unconfirmed: d.largeCapCoverage && Array.isArray(d.largeCapCoverage.unconfirmed) ? d.largeCapCoverage.unconfirmed : []
    };
  } catch (e) {
    if (typeof root._aioLog === 'function') root._aioLog('warn', 'fetch', `earnings calendar snapshot error: ${e.message}`);
    return null;
  }
}
