import { normalizeEntity } from '../normalize/entity.js';

export function createEntityOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ENTITY_ORCHESTRATOR_DEPENDENCY_INVALID');
  function sync() {
    const normalized = normalizeEntity(provider.readCurrent());
    commands.setData({ ...normalized, status: normalized.id ? 'current' : 'unavailable' }, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  return Object.freeze({ sync });
}
