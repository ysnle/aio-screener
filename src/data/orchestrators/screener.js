import { normalizeScreener } from '../normalize/screener.js';

export function createScreenerOrchestrator({ provider, commands } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('SCREENER_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now performs a real fetch (src/data/providers/screener.js),
  // so this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Fable-advisor review (2026-07-21): sync() is invoked on every aio:pageShown (any route) and
  // every aio:refresh:done, and readCurrent() has no internal caching (unlike entity's memoized
  // fundamentals fetch) — so overlapping in-flight calls are possible, and without ordering an
  // older response resolving after a newer one would silently overwrite fresher state with stale
  // data. The generation counter drops any resolution that isn't from the most recently started
  // call; dispose() drops every in-flight resolution permanently (for bootstrap teardown/tests).
  let generation = 0;
  let disposed = false;
  async function sync() {
    const thisGeneration = ++generation;
    const raw = await provider.readCurrent();
    if (disposed || thisGeneration !== generation) return null;
    const normalized = normalizeScreener(raw);
    commands.setData(normalized, { updatedAt: normalized.updatedAt });
    return normalized;
  }
  function dispose() { disposed = true; }
  return Object.freeze({ sync, dispose });
}
