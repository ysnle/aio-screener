import { normalizeEntity } from '../normalize/entity.js';

// First-users run 4: a failed SEC table load (no record, no meta) left 요약 on '받지 못함'; it re-reads with growing gaps.
const FUNDAMENTALS_RETRY_MS = Object.freeze([3000, 8000, 20000]);

export function createEntityOrchestrator({ provider, commands, schedule = (fn, ms) => globalThis.setTimeout?.(fn, ms)?.unref?.() } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('ENTITY_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now fetches fundamentals (src/data/providers/entity.js), so
  // this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Route-scoped pageShown dispatch plus the generation guard prevent an older entity read from
  // overwriting a newer ticker after rapid navigation. refresh:done remains global because it
  // represents a new shared market-data batch.
  let generation = 0;
  let disposed = false;
  let retry = { id: null, count: 0 };
  async function sync({ scope } = {}) {
    const thisGeneration = ++generation;
    const raw = await provider.readCurrent({ signal: scope?.signal });
    if (disposed || thisGeneration !== generation || (scope && !scope.isCurrent())) return null;
    const normalized = normalizeEntity(raw);
    if (scope && !scope.isCurrent()) return null;
    commands.setData({ ...normalized, status: normalized.id ? 'current' : 'unavailable' }, { updatedAt: normalized.updatedAt });
    const failed = !!normalized.id && !normalized.fundamentals && !normalized.fundamentalsMeta;
    if (retry.id !== normalized.id) retry = { id: normalized.id, count: 0 };
    if (failed && retry.count < FUNDAMENTALS_RETRY_MS.length) {
      const delay = FUNDAMENTALS_RETRY_MS[retry.count++];
      schedule(() => (!disposed && thisGeneration === generation ? sync() : null), delay);
    }
    return normalized;
  }
  function dispose() { disposed = true; }
  return Object.freeze({ sync, dispose });
}
