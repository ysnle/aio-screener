import { normalizeNews } from '../normalize/news.js';

export function createNewsOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('NEWS_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeNews(provider.readCurrent());
    commands.setData({ items: normalized.items, status: normalized.items.length ? 'current' : 'unavailable', revision: normalized.cycleId, updatedAt: normalized.updatedAt }, { revision: normalized.cycleId, updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
