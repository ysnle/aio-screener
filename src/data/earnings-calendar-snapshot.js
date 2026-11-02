// Roadmap item 11 (legacy decomposition, 종목 · 실적 일정): the stored earnings calendar reader moved here unchanged from
// js/aio-pages.js (_fetchEarningsCalendarSnapshot). refresh-screener writes public-data/earnings-calendar.json weekly; it
// had no reader for a long time, so the screen's "무키 시 스냅샷" wording was not true (P1102). The snapshot carries its
// window (weekStart~weekEnd); dates outside it are dropped by the renderer. 브리핑, 오늘 일정 and 뉴스 read it through
// root._fetchEarningsCalendarSnapshot, so src/app/compatibility-globals.js installs it at boot.

export async function fetchEarningsCalendarSnapshot({ root = globalThis } = {}) {
  try {
    const res = typeof root.fetchWithTimeout === 'function'
      ? await root.fetchWithTimeout(`public-data/earnings-calendar.json?v=${Date.now()}`, { cache: 'no-cache' }, 6000)
      : null;
    if (!res || !res.ok) return null;
    const d = await res.json();
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
