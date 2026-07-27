import { normalizeEntity } from '../normalize/entity.js';

export function createEntityOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ENTITY_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now fetches fundamentals (src/data/providers/entity.js), so
  // this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Fable-advisor review (2026-07-21): sync() is invoked on every aio:pageShown (any route) and
  // every aio:refresh:done. The fundamentals fetch itself is memoized per symbol table load, but
  // the id/quote/options legacy projection can still change between the read() call and this
  // await resolving (e.g. the user navigates to a different ticker while the fetch is in flight),
  // so an older call resolving after a newer one could overwrite the newer ticker's state with
  // the previous ticker's data. Same generation-counter guard as the screener orchestrator.
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
