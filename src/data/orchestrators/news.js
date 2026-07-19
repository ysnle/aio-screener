import { normalizeNews } from '../normalize/news.js';

export function createNewsOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('NEWS_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeNews(provider.readCurrent());
    commands.setData({ items: normalized.items, status: normalized.items.length ? 'current' : 'unavailable', updatedAt: normalized.updatedAt }, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
