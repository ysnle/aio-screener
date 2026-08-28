import { normalizeEntity } from '../normalize/entity.js';

export function createEntityOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ENTITY_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now fetches fundamentals (src/data/providers/entity.js), so
  // this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Route-scoped pageShown dispatch plus the generation guard prevent an older entity read from
  // overwriting a newer ticker after rapid navigation. refresh:done remains global because it
  // represents a new shared market-data batch.
  let generation = 0;
  let disposed = false;
  async function sync({ scope } = {}) {
    const thisGeneration = ++generation;
    const raw = await provider.readCurrent({ signal: scope?.signal });
    if (disposed || thisGeneration !== generation || (scope && !scope.isCurrent())) return null;
    const normalized = normalizeEntity(raw);
    if (scope && !scope.isCurrent()) return null;
    commands.setData({ ...normalized, status: normalized.id ? 'current' : 'unavailable' }, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  function dispose() { disposed = true; }
  return Object.freeze({ sync, dispose });
}
