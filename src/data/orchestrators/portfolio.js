import { normalizePortfolio } from '../normalize/portfolio.js';

export function createPortfolioOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('PORTFOLIO_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizePortfolio(provider.readCurrent());
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
