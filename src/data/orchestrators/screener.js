import { normalizeScreener } from '../normalize/screener.js';

export function createScreenerOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('SCREENER_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeScreener(provider.readCurrent());
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
