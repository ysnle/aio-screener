import { normalizeEntity } from '../normalize/entity.js';

export function createEntityOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ENTITY_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now fetches fundamentals (src/data/providers/entity.js), so
  // this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  async function sync() {
    const raw = await provider.readCurrent();
    const normalized = normalizeEntity(raw);
    commands.setData({ ...normalized, status: normalized.id ? 'current' : 'unavailable' }, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
