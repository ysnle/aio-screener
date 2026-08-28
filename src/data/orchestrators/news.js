import { normalizeNews } from '../normalize/news.js';

export function createNewsOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('NEWS_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeNews(provider.readCurrent());
    const checkedMs = Date.parse(normalized.checkedAt || '') || Date.now();
    const nextRefreshMs = Date.parse(normalized.nextRefreshAt || '');
    const fetchedMs = Date.parse(normalized.fetchedAt || '');
    const expiredBySchedule = Number.isFinite(nextRefreshMs) && checkedMs > nextRefreshMs;
    const staleByFetch = Number.isFinite(fetchedMs) && checkedMs - fetchedMs > 36 * 60 * 60 * 1000;
    const status = !normalized.items.length
      ? 'unavailable'
      : (expiredBySchedule || staleByFetch ? 'stale' : 'current');
    const metadata = {
      revision: normalized.cycleId,
      updatedAt: normalized.updatedAt,
      fetchedAt: normalized.fetchedAt,
      nextRefreshAt: normalized.nextRefreshAt,
      checkedAt: normalized.checkedAt
    };
    commands.setData({ items: normalized.items, status, revision: normalized.cycleId, updatedAt: normalized.updatedAt, ...metadata }, metadata);
    return normalized;
  }
  return Object.freeze({ sync });
}
