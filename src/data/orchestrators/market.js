import { normalizeMarket } from '../normalize/market.js';

export function createMarketOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('MARKET_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeMarket(provider.readCurrent());
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
