import { normalizeScreener } from '../normalize/screener.js';
import { deriveScreenerSetupProfile } from '../../domain/screener/setup-profile.js';
import { calculationRow, createScreenDefinition, stableHash } from '../contracts/screener.js';
import { runScreen, summarizeScreenReadiness, SCREEN_ENGINE_VERSION } from '../../domain/screener/screen-engine.js';
import { SUPPLIED_MATERIALS_META, SUPPLIED_MATERIAL_CLAIM_IDS } from '../../domain/research/reference-index.js';
import { NATHAN_PREVIOUS_THREADS_REFERENCE } from '../../domain/research/nathan-previous-threads.js';
import { NATHAN_ANALYSIS_PROTOCOL, NATHAN_KNOWLEDGE_CONCEPTS } from '../../domain/knowledge/nathan-framework-pack.js';
import { CONDITIONAL_EVIDENCE_VERSION } from '../../domain/screener/conditional-evidence.js';
import { EVIDENCE_LINEAGE_VERSION } from '../../domain/screener/evidence-lineage.js';
import { RANKING_CONTRACTS } from '../screener-extended.js';

const SCREENER_RESEARCH_MAPPING = Object.freeze(SUPPLIED_MATERIALS_META.routeMappings?.screener || {});
const SCREENER_REFERENCE_FRAMEWORK_IDS = Object.freeze([
  ...new Set([
    ...(SCREENER_RESEARCH_MAPPING.sectionIds || []),
    ...(SCREENER_RESEARCH_MAPPING.nathanFrameworkIds || [])
  ])
]);

export function createScreenerOrchestrator({ provider, commands, getState = () => ({}), ranker = null, rankingContext = () => ({}), onRankingResult = null } = {}) {
  if (!provider?.readCurrent || !commands?.setData) throw new Error('SCREENER_ORCHESTRATOR_DEPENDENCY_INVALID');
  // ARX-04: provider.readCurrent() now performs a real fetch (src/data/providers/screener.js),
  // so this orchestrator awaits it instead of treating it as a synchronous legacy projection.
  // Route-scoped pageShown dispatch plus the generation guard prevent duplicate artifact reads and
  // stale results during rapid navigation. refresh:done remains global because it publishes a new
  // shared screener artifact to the native consumer.
  let generation = 0;
  let disposed = false;
  // Normalized rows keyed by the provider's row object: a quotes-only read hands back the rows it reused unchanged.
  let normalizedRowCache = new WeakMap();
  async function sync({ scope, refresh = true, quotesOnly = false } = {}) {
    const thisGeneration = ++generation;
    let raw;
    try { raw = await provider.readCurrent({ signal: scope?.signal, refresh, quotesOnly }); }
    catch (error) {
      if (disposed || thisGeneration !== generation || scope?.signal?.aborted || error?.name === 'AbortError') return null;
      throw error;
    }
    if (disposed || thisGeneration !== generation || (scope && !scope.isCurrent())) return null;
    const normalized = normalizeScreener(raw, { rowCache: normalizedRowCache });
    if (scope && !scope.isCurrent()) return null;
    const context = rankingContext?.() || {};
    const ranking = typeof ranker === 'function' ? ranker({
      rows: normalized.rows.map(calculationRow),
      weights: context.weights || null,
      // W07-A/P1146: only a user-profile request is explicit. The model's own neutral
      // default keeps model-default (renormalize) semantics.
      weightsPolicy: context.weightsPolicy === 'explicit' || context.weightsPolicy === 'model-default' ? context.weightsPolicy : null,
      regimeLabel: context.regimeLabel || null,
      fundamentalCoveragePct: Number.isFinite(Number(normalized.metadata.fundamentalCoveragePct)) ? Number(normalized.metadata.fundamentalCoveragePct) : 0,
      fmpOk: !!normalized.metadata.fmpOk,
      now: Number.isFinite(context.now) ? context.now : Date.now(),
      inputVersion: normalized.revision || 'unknown'
    }) : null;
    // P1452: a failed or successful re-rank publishes/discards the hold the same way on both
    // surfaces (the legacy wrapper and the native orchestrator share the semantics, not copies).
    if (typeof onRankingResult === 'function') {
      try { onRankingResult(ranking, context); } catch (_) {}
    }
    const bySymbol = new Map((ranking?.rows || []).map((row) => [row.sym || row.symbol, row]));
    const universeScope = normalized.metadata?.universeScope === 'extended' ? 'extended' : 'core';
    const rankedRows = normalized.rows.map((row) => {
      const result = bySymbol.get(row.sym || row.symbol);
      const merged = result ? { ...row, ...result, symbol: row.symbol, sym: row.sym } : { ...row, rank: null, score: null, factorScores: {}, quantSignal: null };
      // v57.81: under the extended contract every row says so (the ticker page labels its rank from this).
      return { ...merged, ...(universeScope === 'extended' ? { rankingUniverse: 'extended' } : {}), setupProfile: deriveScreenerSetupProfile(calculationRow(merged)) };
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
      referenceFrameworkIds: SCREENER_REFERENCE_FRAMEWORK_IDS,
      referenceConceptIds: NATHAN_KNOWLEDGE_CONCEPTS.map((concept) => concept.canonicalId),
      referenceQuestionIds: NATHAN_PREVIOUS_THREADS_REFERENCE.frameworks.flatMap((framework) => [`${framework.id}:confirmation`, `${framework.id}:invalidation`]),
      referenceProcessingStages: NATHAN_ANALYSIS_PROTOCOL.stages,
      referenceTimeSeriesIds: SCREENER_RESEARCH_MAPPING.timeSeriesIds,
      referenceClaimIds: SUPPLIED_MATERIAL_CLAIM_IDS,
      referenceBoundary: SUPPLIED_MATERIALS_META.operationalUse,
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
    // P1168 (13 잔여·SCR-UX-07): 이 이력은 사용자 실행이 아니라 이 producer가 sync마다 도는
    // **파이프라인 기준 run**이다. 그런데 같은 결과를 매번 덧붙여 화면 재진입마다 2→4→6으로
    // 늘었고, 이름은 사용자 실행처럼 읽혔다. 같은 snapshot·같은 정의의 동일 resultHash는 다시
    // 쌓지 않고 마지막 항목을 갱신하며, 기계 실행임을 provenance로 남긴다.
    const priorRuns = getState?.()?.screener?.runHistory || [];
    const pipelineEntry = { ...screenResult.run, origin: 'pipeline-sync' };
    const lastRun = priorRuns[priorRuns.length - 1];
    const runHistory = lastRun && lastRun.origin === 'pipeline-sync'
      && lastRun.resultHash && lastRun.resultHash === pipelineEntry.resultHash
      ? [...priorRuns.slice(0, -1), pipelineEntry]
      : [...priorRuns, pipelineEntry].slice(-20);
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
        researchContext: {
          referenceId: SUPPLIED_MATERIALS_META.id,
          sourceKind: SUPPLIED_MATERIALS_META.sourceKind,
          operationalUse: SUPPLIED_MATERIALS_META.operationalUse,
          frameworkIds: [...(screenDefinition.referenceFrameworkIds || [])],
          conceptIds: [...(screenDefinition.referenceConceptIds || [])],
          questionIds: [...(screenDefinition.referenceQuestionIds || [])],
          processingStages: [...(screenDefinition.referenceProcessingStages || [])],
          timeSeriesIds: [...(screenDefinition.referenceTimeSeriesIds || [])],
          claimIds: [...(screenDefinition.referenceClaimIds || [])],
          sourceExtensionPacketId: SUPPLIED_MATERIALS_META.sourceExtensions?.packetId || null,
          pipelineVersion: SUPPLIED_MATERIALS_META.sourceExtensions?.pipeline?.version || null,
          conditionalEvidenceVersion: CONDITIONAL_EVIDENCE_VERSION,
          evidenceLineageVersion: EVIDENCE_LINEAGE_VERSION,
          requiredLineage: [...(SUPPLIED_MATERIALS_META.sourceExtensions?.pipeline?.requiredLineage || [])],
          boundary: screenDefinition.referenceBoundary,
          currentClaimsAllowed: false,
          rankingUse: 'none'
        },
        ranking: ranking ? {
          // v57.81: the population this ranking was computed over (core universe, or core + extended shard).
          contract: RANKING_CONTRACTS[universeScope].id,
          contractLabel: RANKING_CONTRACTS[universeScope].label,
          universeScope,
          modelVersion: ranking.modelVersion,
          populationPolicy: ranking.populationPolicy,
          populationMarket: ranking.populationMarket,
          byMarket: ranking.byMarket,
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
