import { normalizeScreener } from '../normalize/screener.js';

export function createScreenerOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('SCREENER_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now performs a real fetch (src/data/providers/screener.js),
  // so this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  async function sync() {
    const raw = await provider.readCurrent();
    const normalized = normalizeScreener(raw);
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
