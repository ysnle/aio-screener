import { normalizeScreener } from '../normalize/screener.js';

export function createScreenerOrchestrator({ provider, commands, ranker = null, rankingContext = () => ({}) } = {}) {
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
    const context = rankingContext?.() || {};
    const ranking = typeof ranker === 'function' ? ranker({
      rows: normalized.rows,
      weights: context.weights || null,
      regimeLabel: context.regimeLabel || null,
      fundamentalCoveragePct: Number(normalized.metadata.fundamentalCoveragePct) || 0,
      fmpOk: !!normalized.metadata.fmpOk,
      now: Number.isFinite(context.now) ? context.now : Date.now(),
      inputVersion: normalized.revision || 'unknown'
    }) : null;
    const bySymbol = new Map((ranking?.rows || []).map((row) => [row.sym || row.symbol, row]));
    const rows = normalized.rows.map((row) => {
      const result = bySymbol.get(row.sym || row.symbol);
      return result ? { ...row, ...result, symbol: row.symbol, sym: row.sym } : row;
    });
    const result = {
      ...normalized,
      rows,
      metadata: {
        ...normalized.metadata,
        ranking: ranking ? {
          modelVersion: ranking.modelVersion,
          inputVersion: ranking.inputVersion,
          available: ranking.available,
          ranked: ranking.ranked,
          activeFactors: ranking.activeFactors,
          activeFactorRegime: ranking.activeFactorRegime,
          activeFactorWeights: ranking.activeFactorWeights,
          inactiveFactorReasons: ranking.inactiveFactorReasons
        } : null
      }
    };
    commands.setData(result, { updatedAt: result.updatedAt });
    return result;
  }
  function dispose() { disposed = true; }
  return Object.freeze({ sync, dispose });
}
