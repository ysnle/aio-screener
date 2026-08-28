import { normalizeScreener } from '../normalize/screener.js';
import { deriveScreenerSetupProfile } from '../../domain/screener/setup-profile.js';
import { createScreenDefinition, stableHash } from '../contracts/screener.js';
import { runScreen, summarizeScreenReadiness, SCREEN_ENGINE_VERSION } from '../../domain/screener/screen-engine.js';

export function createScreenerOrchestrator({ provider, commands, getState = () => ({}), ranker = null, rankingContext = () => ({}) } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('SCREENER_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now performs a real fetch (src/data/providers/screener.js),
  // so this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Route-scoped pageShown dispatch plus the generation guard prevent duplicate artifact reads and
  // stale results during rapid navigation. refresh:done remains global because it publishes a new
  // shared screener artifact to the native consumer.
  let generation = 0;
  let disposed = false;
  async function sync({ scope } = {}) {
    const thisGeneration = ++generation;
    const raw = await provider.readCurrent({ signal: scope?.signal });
    if (disposed || thisGeneration !== generation || (scope && !scope.isCurrent())) return null;
    const normalized = normalizeScreener(raw);
    if (scope && !scope.isCurrent()) return null;
    const context = rankingContext?.() || {};
    const ranking = typeof ranker === 'function' ? ranker({
      rows: normalized.rows,
      weights: context.weights || null,
      regimeLabel: context.regimeLabel || null,
      fundamentalCoveragePct: Number.isFinite(Number(normalized.metadata.fundamentalCoveragePct)) ? Number(normalized.metadata.fundamentalCoveragePct) : 0,
      fmpOk: !!normalized.metadata.fmpOk,
      now: Number.isFinite(context.now) ? context.now : Date.now(),
      inputVersion: normalized.revision || 'unknown'
    }) : null;
    const bySymbol = new Map((ranking?.rows || []).map((row) => [row.sym || row.symbol, row]));
    const rankedRows = normalized.rows.map((row) => {
      const result = bySymbol.get(row.sym || row.symbol);
      const merged = result ? { ...row, ...result, symbol: row.symbol, sym: row.sym } : row;
      return { ...merged, setupProfile: deriveScreenerSetupProfile(merged) };
    });
    const screenDefinition = createScreenDefinition({
      screenId: 'native-screener-workbench',
      version: 1,
      name: 'Native Screener Workbench 기본 결과',
      objective: 'research-relative-ranking',
      filtersAST: { type: 'and', children: [] },
      requiredFields: ['price.ret3m', 'price.pctSma200', 'price.rsi14'],
      ranking: { field: 'rank', direction: 'desc' },
      columns: ['identity.symbol', 'identity.name', 'rank', 'price.ret3m', 'price.rsi14'],
      minCoverage: 0.8,
      regimePolicy: { mode: 'reference-only', autoPromote: false }
    });
    const screenResult = runScreen({
      definition: screenDefinition,
      rows: rankedRows,
      snapshotId: normalized.snapshotId || normalized.revision || 'unknown',
      providerSet: [normalized.metadata?.source || 'screener-artifact'],
      engineVersion: SCREEN_ENGINE_VERSION
    });
    const runBySymbol = new Map(screenResult.rows.map((row) => [row.sym || row.symbol, row]));
    const rows = rankedRows.map((row) => {
      const result = runBySymbol.get(row.sym || row.symbol);
      return result ? { ...row, screenStatus: result.screenStatus, screenRank: result.screenRank, rankExplanation: result.rankExplanation } : row;
    });
    const readiness = summarizeScreenReadiness(rows, screenDefinition.requiredFields);
    const priorRuns = getState?.()?.screener?.runHistory || [];
    const runHistory = [...priorRuns, screenResult.run].slice(-20);
    const result = {
      ...normalized,
      rows,
      screenDefinition,
      lastRun: screenResult.run,
      runHistory,
      readiness,
      workbenchHash: stableHash({ screenDefinition: screenDefinition.definitionHash, run: screenResult.run.resultHash }),
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
          appliedFactorWeights: ranking.appliedFactorWeights,
          inactiveFactorReasons: ranking.inactiveFactorReasons,
          factorCoverage: ranking.factorCoverage,
          qualityStatus: ranking.qualityStatus,
          confidence: ranking.confidence,
          compositeConfidence: ranking.compositeConfidence,
          confidenceMeaning: ranking.confidenceMeaning,
          inputAudit: ranking.inputAudit,
          sectorNeutrality: ranking.sectorNeutrality,
          outlierDiagnostics: ranking.outlierDiagnostics,
          regimeStability: ranking.regimeStability,
          turnoverStability: ranking.turnoverStability,
          researchBoundary: ranking.researchBoundary
          } : null,
        workbench: {
          contractVersion: 'screener-workbench.v1',
          engineVersion: SCREEN_ENGINE_VERSION,
          definitionHash: screenDefinition.definitionHash,
          runId: screenResult.run.runId,
          resultHash: screenResult.resultHash,
          readiness
        }
      }
    };
    commands.setData(result, { updatedAt: result.updatedAt });
    return result;
  }
  function dispose() { disposed = true; }
  return Object.freeze({ sync, dispose });
}
