import { createClock } from '../platform/clock.js';
import { createHttpClient } from '../platform/http.js';
import { createStore } from '../state/store.js';
import { createInitialSentimentState, sentimentReducer, SENTIMENT_DATA_CLEAR, SENTIMENT_DATA_SET } from '../state/slices/sentiment.js';
import { createInitialNewsState, newsReducer, NEWS_DATA_CLEAR, NEWS_DATA_SET } from '../state/slices/news.js';
import { createInitialMarketState, marketReducer, MARKET_DATA_CLEAR, MARKET_DATA_SET } from '../state/slices/market.js';
import { createInitialThemesState, themesReducer, THEMES_DATA_CLEAR, THEMES_DATA_SET } from '../state/slices/themes.js';
import { createInitialEntityState, entityReducer, ENTITY_DATA_CLEAR, ENTITY_DATA_SET } from '../state/slices/entity.js';
import { createInitialPortfolioState, portfolioReducer, PORTFOLIO_DATA_CLEAR, PORTFOLIO_DATA_SET } from '../state/slices/portfolio.js';
import { createInitialScreenerState, screenerReducer, SCREENER_DATA_CLEAR, SCREENER_DATA_SET } from '../state/slices/screener.js';
import { createSentimentCommands } from './commands/sentiment.js';
import { createNewsCommands } from './commands/news.js';
import { createMarketCommands } from './commands/market.js';
import { createThemesCommands } from './commands/themes.js';
import { createEntityCommands } from './commands/entity.js';
import { createPortfolioCommands } from './commands/portfolio.js';
import { createScreenerCommands } from './commands/screener.js';
import { selectSentimentSummary } from '../state/selectors/sentiment.js';
import { createEvidenceStore } from '../data/evidence-store.js';
import { createEvidence } from '../data/contracts/evidence.js';
import { selectForDecision, selectForDisplay, selectLastKnown, selectCompleteness } from '../data/selectors/evidence.js';
import { computeTradingScoreModel } from '../domain/signal/trading-score.js';
import { normalizeSignalScoreMode, describeSignalScoreMode, SIGNAL_SCORE_MODE_STORAGE_KEY } from '../domain/signal/mode.js';
import { computeRelativeRotation } from '../domain/themes/rrg.js';
import { classifyMovingAverageStructure, deriveMultiTimeframeView } from '../domain/technical/stage.js';
import { computeNewsSentimentScore, computeNewsRiskSignals } from '../domain/news/scoring.js';
import { classifyBreadthParticipation } from '../domain/market/breadth.js';
import { computeMarketHealth } from '../domain/market/health.js';
import { deriveTreasuryCurveEvidence } from '../domain/macro/treasury-curve.js';
import { deriveConcentrationRisk, concentrationPenaltyForWeight } from '../domain/portfolio/concentration.js';
// Portfolio statistics/backtest is a native ESM module; importing it during
// bootstrap keeps the classic regression surface available before lazy route
// navigation while leaving the implementation out of aio-core.js.
import {
  buildPortfolioBacktestLab,
  _statMean,
  _statStdDev,
  _calcDailyReturns,
  _quantileR7,
  _calcSharpe,
  _calcMaxDrawdown,
  _pearsonCorr,
  _calcCorrelationMatrix
} from '../domain/portfolio/backtest.js';
import { createCompositionSnapshot, deriveRiskEstimate, assessAccountPerformance } from '../domain/portfolio/risk.js';
import { computeFactorRanks } from '../domain/screener/factor-ranks.js';
import { deriveFactorWeights } from '../domain/screener/factor-weights.js';
import { captureScreenRun, createDefaultScreenDefinitions, replayScreenRun, runScreen } from '../domain/screener/screen-engine.js';
import { createScreenerRunArchive } from '../storage/screener-runs.js';
import { createSavedScreenCollection } from '../domain/screener/saved-screens.js';
import { createMarketSnapshotLoader } from '../data/market-snapshot-loader.js';
import { createSentimentProvider } from '../data/providers/sentiment.js';
import { createSentimentOrchestrator } from '../data/orchestrators/sentiment.js';
import { createNewsProvider } from '../data/providers/news.js';
import { createNewsOrchestrator } from '../data/orchestrators/news.js';
import { createMarketProvider } from '../data/providers/market.js';
import { createMarketOrchestrator } from '../data/orchestrators/market.js';
import { createThemesProvider } from '../data/providers/themes.js';
import { createThemesOrchestrator } from '../data/orchestrators/themes.js';
import { createEntityProvider } from '../data/providers/entity.js';
import { createEntityOrchestrator } from '../data/orchestrators/entity.js';
import { createPortfolioProvider } from '../data/providers/portfolio.js';
import { createPortfolioOrchestrator } from '../data/orchestrators/portfolio.js';
import { createScreenerProvider } from '../data/providers/screener.js';
import { createScreenerOrchestrator } from '../data/orchestrators/screener.js';
import { createRuntimeReaders } from '../data/runtime-readers.js';
import { PORTFOLIO_ASSUMPTION_KEYS, EXPOSURE_PATHS, REBALANCE_POLICIES, normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy, readPortfolioAssumptions } from '../data/portfolio-assumptions.js';
import { LEDGER_COVERAGE_INPUTS, appendLedgerTransaction, appendLedgerValuation, ledgerCoverageState, normalizeLedger, removeLedgerEntry as removeLedgerEntryFromLedger, setLedgerCoverage as setLedgerCoverageOnLedger, setLedgerFlowTiming as setLedgerFlowTimingOnLedger } from '../data/portfolio-ledger.js';
import { FX_LEG_MAX_AGE_MS, appendFxLeg, fxLegsState, normalizeFxLegs, removeFxLeg } from '../domain/portfolio/fx.js';
import { applyFxPanel, applyLedgerPanel, clearDeclaredFields, readDeclaredFields, showDeclarationStatus } from '../ui/panels/portfolio-declarations.js';
import { assembleRiskEstimateInput } from '../ui/panels/portfolio-risk-input.js';
import { createDeclarationsStore } from '../data/portfolio-declarations-store.js';
import { buildEvidenceContext } from '../ai/context-builder.js';
import { createEvidenceRetriever } from '../ai/retrieval/evidence.js';
import { createAIKnowledgeRetriever } from '../ai/retrieval/knowledge.js';
import { createAIAnswerOrchestrator } from '../ai/orchestrator/answer-orchestrator.js';
import { createEvidenceDocument, evaluateResearchEvidenceFloor, normalizeResearchExecutionResult } from '../ai/research/evidence.js';
import { createLazyPage, createRouteRegistry, createLifecycleRouter } from './router.js';

// Classic-shell compatibility belongs at the app boundary. Domain modules
// remain pure and reusable in Node/worker contexts without browser globals.
if (typeof window !== 'undefined') {
  window._statMean = _statMean;
  window._statStdDev = _statStdDev;
  window._calcDailyReturns = _calcDailyReturns;
  window._quantileR7 = _quantileR7;
  window._calcSharpe = _calcSharpe;
  window._calcMaxDrawdown = _calcMaxDrawdown;
  window._pearsonCorr = _pearsonCorr;
  window._calcCorrelationMatrix = _calcCorrelationMatrix;
  window.AIO = window.AIO || {};
  window.AIO.buildPortfolioBacktestLab = buildPortfolioBacktestLab;
  window._aioBuildPortfolioBacktestLab = buildPortfolioBacktestLab;
  // 22 W22-I/W22-J (E4): the risk/performance surfaces consume the declared
  // domain contract — composition snapshot, risk path, account-performance hold.
  window._pfCreateCompositionSnapshot = createCompositionSnapshot;
  window._pfDeriveRiskEstimate = deriveRiskEstimate;
  // P1258: 위험 입력 조립(스냅샷·returnsMap·estimate 호출)의 단일 소유자 — 셸은 이 브리지를
  // 호출해 결과를 그대로 렌더한다.
  window._pfAssembleRiskEstimateInput = assembleRiskEstimateInput;
  window._pfAssessAccountPerformance = assessAccountPerformance;
  // E3/P1188: the classic-shell form is the writer for the declared currency /
  // cash-return / RF inputs; it consumes the same keys and normalizers the
  // reader uses, so the two ends cannot drift (R632).
  window._pfPortfolioAssumptions = { keys: PORTFOLIO_ASSUMPTION_KEYS, exposurePaths: EXPOSURE_PATHS, rebalancePolicies: REBALANCE_POLICIES, normalizeCurrencyCode, normalizeAnnualRate, normalizeExposurePath, normalizeRebalancePolicy, read: readPortfolioAssumptions };
  // E4/P1191: 원장의 유효성·병합은 ESM 모듈이 소유하고, 셸은 DOM과 Vault 쓰기만 맡는다.
  window._pfPortfolioLedger = {
    inputs: LEDGER_COVERAGE_INPUTS,
    normalize: normalizeLedger,
    appendTransaction: appendLedgerTransaction,
    appendValuation: appendLedgerValuation,
    remove: removeLedgerEntryFromLedger,
    setCoverage: setLedgerCoverageOnLedger,
    setFlowTiming: setLedgerFlowTimingOnLedger,
    coverageState: ledgerCoverageState
  };
  // E3/P1194 (11 §23): 선언된 FX leg의 유효성·환산 근거는 도메인 모듈이 소유하고, 셸은 DOM과 저장만 맡는다.
  window._pfPortfolioFx = { maxAgeMs: FX_LEG_MAX_AGE_MS, normalize: normalizeFxLegs, appendLeg: appendFxLeg, removeLeg: removeFxLeg, legsState: fxLegsState };
  // P1195: 선언 패널의 마크업·ack 문구는 네이티브가 소유한다 — 셸은 저장 경로와 순서만 남긴다.
  // P1199: 선언 저장소의 *형태*(읽기 규칙·ack 분리)는 네이티브가 소유하고, 셸이 저장 정책(경로)을 주입한다.
  window._pfDeclarationsStore = { create: createDeclarationsStore };
  window._pfDeclarationPanels = { applyLedgerPanel, applyFxPanel, showDeclarationStatus, readDeclaredFields, clearDeclaredFields };
}
import { renderSentimentSummaryProjection } from '../ui/projections/sentiment-summary.js';
import { createInitialAnalysisState, analysisReducer, ANALYSIS_DATA_CLEAR, ANALYSIS_DATA_SET } from '../state/slices/analysis.js';
import { createAnalysisCommands } from './commands/analysis.js';
import { createAnalysisProvider } from '../data/providers/analysis.js';
import { createAnalysisOrchestrator } from '../data/orchestrators/analysis.js';
import { createLegacyFacade, exposeArchitecture } from '../legacy/compatibility-facade.js';
import { applyMarketSnapshotToLegacy } from '../legacy/market-snapshot-bridge.js';
import { ROUTE_IDS } from './routes.js';
import { VERTICAL_SLICE_CONTRACTS, auditVerticalSliceContracts, getVerticalSliceContract } from './vertical-slices.js';
import { PAGE_DATA_TIMELINE_CONTRACTS, auditPageDataTimelines, evaluatePageDataTimeline } from '../data/contracts/page-timeline.js';
import { CAPABILITY_MANIFEST_VERSION, getCapability, getCapabilityManifest, auditCapabilityClaims } from '../domain/content/capability-manifest.js';
import { classifyAIConduct, buildScopedConductFallback, getAIConductPolicy } from '../ai/policy/conduct.js';
import { coalesceMicrotask, createDeferredTaskQueue } from './lifecycle.js';
import { SUPPLIED_MATERIALS_REFERENCE, SUPPLIED_MATERIAL_CLAIM_IDS } from '../domain/research/supplied-materials.js';
import { NATHAN_PREVIOUS_THREADS_REFERENCE, NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS } from '../domain/research/nathan-previous-threads.js';
import { NATHAN_FRAMEWORK_PACK, NATHAN_ANALYSIS_PROTOCOL, NATHAN_KNOWLEDGE_ALIASES } from '../domain/knowledge/nathan-framework-pack.js';

export const ARCHITECTURE_VERSION = 'AR-01~16.v1';

const COMPATIBILITY_EVENT_DEDUPE_WINDOW_MS = 250;

function serializeCompatibilityEventDetail(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const seen = new WeakSet();
  const serialize = (value) => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (seen.has(value)) throw new TypeError('cyclic event detail');
    seen.add(value);
    const serialized = Array.isArray(value)
      ? `[${value.map((entry) => serialize(entry)).join(',')}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(',')}}`;
    seen.delete(value);
    return serialized;
  };
  try {
    return serialize(detail);
  } catch (_) {
    return null;
  }
}

/**
 * Subscribe to a legacy event on both the document and its window without
 * making every native consumer know which target the legacy producer chose.
 * Refresh/history producers have not always agreed on that target. A short
 * detail-fingerprint window collapses the two dispatches of one logical event
 * while still allowing two events from the same target through.
 */
export function createCompatibilityEventAdapter({ root = globalThis, eventTarget = root?.document, now = () => Date.now() } = {}) {
  const primaryTarget = eventTarget || root;
  const secondaryTarget = root && root !== primaryTarget ? root : null;
  const targets = [...new Set([primaryTarget, secondaryTarget]
    .filter((target) => typeof target?.addEventListener === 'function'))];
  const subscriptions = new Map();
  const recentEvents = new Map();
  const eventTokens = new WeakMap();
  let nextEventToken = 0;
  let disposed = false;

  const readNow = () => {
    try {
      const value = Number(now());
      if (Number.isFinite(value)) return value;
    } catch (_) {}
    return Date.now();
  };
  const eventKey = (eventName, event) => {
    const serializedDetail = serializeCompatibilityEventDetail(event?.detail);
    if (serializedDetail != null) return `${eventName}:detail:${serializedDetail}`;
    if (event && typeof event === 'object') {
      if (!eventTokens.has(event)) eventTokens.set(event, ++nextEventToken);
      return `${eventName}:event:${eventTokens.get(event)}`;
    }
    return null;
  };
  const isDuplicate = (key, source, at) => {
    if (!key) return false;
    const previous = recentEvents.get(key);
    return !!previous && previous.expiresAt > at && previous.source !== source;
  };
  const remember = (key, source, at) => {
    if (!key) return;
    for (const [seenKey, record] of recentEvents) {
      if (record.expiresAt <= at) recentEvents.delete(seenKey);
    }
    recentEvents.set(key, { source, expiresAt: at + COMPATIBILITY_EVENT_DEDUPE_WINDOW_MS });
  };

  const on = (eventName, listener) => {
    const name = String(eventName || '').trim();
    if (disposed || !name || typeof listener !== 'function' || !targets.length) return () => {};
    let subscription = subscriptions.get(name);
    if (!subscription) {
      subscription = { name, listeners: new Set(), handlers: [] };
      const dispatch = (event, source) => {
        if (disposed) return;
        const at = readNow();
        const key = eventKey(name, event);
        const duplicate = isDuplicate(key, source, at);
        remember(key, source, at);
        if (duplicate) return;
        [...subscription.listeners].forEach((callback) => callback(event));
      };
      targets.forEach((target) => {
        const handler = (event) => dispatch(event, target);
        target.addEventListener(name, handler);
        subscription.handlers.push({ target, handler });
      });
      subscriptions.set(name, subscription);
    }
    subscription.listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscription.listeners.delete(listener);
      if (subscription.listeners.size) return;
      subscription.handlers.forEach(({ target, handler }) => target.removeEventListener(name, handler));
      subscriptions.delete(name);
    };
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    subscriptions.forEach((subscription) => {
      subscription.handlers.forEach(({ target, handler }) => target.removeEventListener(subscription.name, handler));
    });
    subscriptions.clear();
    recentEvents.clear();
  };

  return Object.freeze({ on, dispose });
}

export function resolveInitialRoute({ root = globalThis, hash = root?.location?.hash } = {}) {
  const rawRoute = String(hash || '').replace(/^#/, '').split('?')[0].trim();
  const canonicalRoute = root?.AIO_ROUTE_REGISTRY?.canonical?.[rawRoute]
    || (rawRoute === 'theme-detail' ? 'themes' : rawRoute);
  if (rawRoute === 'theme-detail') {
    const themeId = String(
      root?._aioOpenThemeDetailOnThemes
      || root?._currentThemeId
      || root?.THEME_MAP?.[0]?.id
      || ''
    ).trim();
    if (themeId && !root?._aioOpenThemeDetailOnThemes) {
      try { root._aioOpenThemeDetailOnThemes = themeId; } catch (_) {}
    }
  }
  return ROUTE_IDS.includes(canonicalRoute) ? canonicalRoute : 'home';
}

function reducer(state, action) {
  if (action.type === SENTIMENT_DATA_SET || action.type === SENTIMENT_DATA_CLEAR) {
    return { ...state, sentiment: sentimentReducer(state.sentiment, action) };
  }
  if (action.type === NEWS_DATA_SET || action.type === NEWS_DATA_CLEAR) {
    return { ...state, news: newsReducer(state.news, action) };
  }
  if (action.type === MARKET_DATA_SET || action.type === MARKET_DATA_CLEAR) {
    return { ...state, market: marketReducer(state.market, action) };
  }
  if (action.type === THEMES_DATA_SET || action.type === THEMES_DATA_CLEAR) {
    return { ...state, themes: themesReducer(state.themes, action) };
  }
  if (action.type === ENTITY_DATA_SET || action.type === ENTITY_DATA_CLEAR) {
    return { ...state, entity: entityReducer(state.entity, action) };
  }
  if (action.type === PORTFOLIO_DATA_SET || action.type === PORTFOLIO_DATA_CLEAR) {
    return { ...state, portfolio: portfolioReducer(state.portfolio, action) };
  }
  if (action.type === SCREENER_DATA_SET || action.type === SCREENER_DATA_CLEAR) {
    return { ...state, screener: screenerReducer(state.screener, action) };
  }
  if (action.type === ANALYSIS_DATA_SET || action.type === ANALYSIS_DATA_CLEAR) {
    return { ...state, analysis: analysisReducer(state.analysis, action) };
  }
  if (action.type === 'market/snapshot') return { ...state, marketSnapshot: action.payload };
  if (action.type === 'route/changed') return { ...state, route: action.payload };
  return state;
}

export function createAIOArchitecture({ root = globalThis, documentRef = root.document, now = () => Date.now(), fetchImpl = root.fetch } = {}) {
  const clock = createClock(now);
  const evidenceStore = createEvidenceStore();
  const defaultSavedScreens = createSavedScreenCollection(createDefaultScreenDefinitions().map((definition) => ({ definition })));
  const store = createStore({ initialState: { sentiment: createInitialSentimentState(), news: createInitialNewsState(), market: createInitialMarketState(), themes: createInitialThemesState(), entity: createInitialEntityState(), portfolio: createInitialPortfolioState(), screener: { ...createInitialScreenerState(), savedScreens: defaultSavedScreens }, analysis: createInitialAnalysisState(), route: null, marketSnapshot: null }, reducer });
  const eventTarget = documentRef || root;
  const legacy = createLegacyFacade(root, eventTarget);
  const httpClient = createHttpClient({ fetchImpl, clock });
  // Native data ownership is explicit: route providers read the runtime through
  // the data-layer readers, not through legacy.read* projections.  The legacy
  // facade remains available only for compatibility actions and navigation.
  const runtimeReaders = createRuntimeReaders({ root, now: clock.now });
  // E2/LC-26: the single writer/reader for the signal score mode. The legacy toggle calls
  // `setSignalScoreMode`; both the native runtime reader and the legacy facade read it back
  // so the pill, the score input and the score hero share one revision. Persisted so a reload
  // does not silently revert a declared day mode to swing.
  let signalScoreMode = null;
  const getSignalScoreMode = () => {
    if (signalScoreMode == null) {
      let stored = null;
      try { stored = root?.localStorage?.getItem(SIGNAL_SCORE_MODE_STORAGE_KEY); } catch (_) {}
      signalScoreMode = normalizeSignalScoreMode(stored);
    }
    return signalScoreMode;
  };
  const setSignalScoreMode = (mode) => {
    signalScoreMode = normalizeSignalScoreMode(mode);
    try { root?.localStorage?.setItem(SIGNAL_SCORE_MODE_STORAGE_KEY, signalScoreMode); } catch (_) {}
    return signalScoreMode;
  };
  // The fast quote plane is evidence-gated upstream (scripts/ci-fast-plane-consumer-gate.mjs
  // derives marketData.fastQuotes.enabled). Read it per load so a promotion takes effect and a
  // revocation stops working without a reload; when it is unset or disabled the loader chain is
  // the durable snapshot alone, exactly as before.
  const snapshotLoader = createMarketSnapshotLoader({
    httpClient,
    clock,
    fastQuotesProvider: () => root?.AIO_PUBLIC_CONFIG?.marketData?.fastQuotes || null
  });
  let marketSnapshot = null;
  const snapshotEvidence = new Map();
  const aiRetriever = createEvidenceRetriever({ evidenceStore });
  // Lazy and cached: no knowledge artifact is fetched during application boot.
  // The compact index is loaded only on the first chat question and always
  // remains REFERENCE, separate from current market evidence.
  const aiKnowledgeRetriever = createAIKnowledgeRetriever({ fetchImpl, suppliedMaterials: SUPPLIED_MATERIALS_REFERENCE });
  // AIQ-0/AIQ-1: the legacy chat surfaces remain UI adapters, while planning and
  // dispatch ownership lives in one ESM orchestrator. This is deliberately created
  // beside the canonical evidence store so future tool adapters can consume the same
  // state without creating a second chat path.
  const aiOrchestrator = createAIAnswerOrchestrator({ root, now: () => clock.now(), knowledgeRetriever: aiKnowledgeRetriever });

  function ingestSnapshotEvidence(snapshot) {
    snapshotEvidence.clear();
    for (const quote of snapshot?.quotes || []) {
      const evidence = createEvidence({
        evidenceId: quote.evidenceId,
        metric: quote.metricId,
        value: quote.value,
        unit: quote.unit,
        sourceKind: 'market-snapshot',
        source: quote.source,
        observedAt: quote.observedAt,
        fetchedAt: quote.fetchedAt,
        lastSuccessfulAt: quote.lastSuccessfulAt,
        status: quote.quality === 'UNAVAILABLE' ? 'missing' : 'snapshot',
        allowedUse: 'reference',
        metadata: {
          instrumentId: quote.instrumentId,
          quality: quote.quality,
          session: quote.session,
          revision: snapshot.revision
        }
      });
      if (evidence.value != null) {
        evidenceStore.ingest(evidence);
        snapshotEvidence.set(quote.instrumentId, evidence);
      }
      const aliases = { '^VIX': 'vix', '^VIX3M': 'vix3m', '^VIX9D': 'vix9d' };
      const alias = aliases[quote.instrumentId];
      if (alias && evidence.value != null) {
        snapshotEvidence.set(alias, evidence);
        evidenceStore.ingest({ ...evidence, metric: alias });
      }
    }
  }

  const sentimentProvider = createSentimentProvider({ read: runtimeReaders.readSentiment, now: clock.now });
  const sentimentCommands = createSentimentCommands({ store });
  const syncSentiment = createSentimentOrchestrator({ provider: sentimentProvider, evidenceStore, store, commands: sentimentCommands, snapshotEvidence, clock });
  const syncSentimentProjection = (patch = null) => {
    const result = syncSentiment.sync(patch);
    renderSentimentSummaryProjection(documentRef, selectSentimentSummary(store.getState()));
    return result;
  };
  const ingestSentiment = (patch = {}) => syncSentimentProjection(patch);
  const newsProvider = createNewsProvider({ read: runtimeReaders.readNews, readMeta: () => root?._serverDataMeta || {}, now: clock.now });
  const newsCommands = createNewsCommands({ store });
  const syncNews = createNewsOrchestrator({ provider: newsProvider, commands: newsCommands });
  const marketCommands = createMarketCommands({ store });
  const syncMarket = createMarketOrchestrator({ provider: createMarketProvider({ read: runtimeReaders.readMarket }), commands: marketCommands });
  const themesCommands = createThemesCommands({ store });
  // P800: themes data is assembled by the native provider from explicit runtime inputs;
  // legacy.readThemes remains a compatibility facade for non-cut-over consumers only.
  const syncThemes = createThemesOrchestrator({
    provider: createThemesProvider({
      readLiveData: () => root?._liveData || {},
      readHistory: () => root?._priceHistory || {},
      readWeeklyPerf: () => root?._sectorWeeklyCache || {},
      readDefinitions: () => ({
        sectors: root?.RRG_SECTORS,
        subsectors: root?.RRG_SUBSECTORS,
        themes: root?.THEME_MAP,
        insights: root?.THEME_INSIGHTS,
        membershipPolicy: root?.THEME_MEMBERSHIP_POLICY
      }),
      readSelectedId: () => root?._currentThemeId || null,
      now: clock.now
    }),
    commands: themesCommands
  });
  const entityCommands = createEntityCommands({ store });
  // ARX-04/P977: entity fundamentals use the bounded SEC current-facts projection; append-only
  // PIT observations stay outside the interactive payload.
  // — see src/data/providers/entity.js. id/quote/options remain legacy.readEntity projections.
  const syncEntity = createEntityOrchestrator({ provider: createEntityProvider({ read: runtimeReaders.readEntity, httpClient, now: clock.now }), commands: entityCommands });
  const portfolioCommands = createPortfolioCommands({ store });
  // Personal holdings are read from the established AES-GCM `_AioVault` path
  // through runtimeReaders. Do not create a second consent-only/plaintext store.
  const syncPortfolio = createPortfolioOrchestrator({ provider: createPortfolioProvider({ read: runtimeReaders.readPortfolio }), commands: portfolioCommands });
  const screenerCommands = createScreenerCommands({ store });
  let screenerArchive = null;
  const getScreenerArchive = () => screenerArchive || (screenerArchive = createScreenerRunArchive({ indexedDB: root?.indexedDB }));
  async function runScreenerDefinition(definition) {
    const state = store.getState()?.screener || {};
    const input = { definition, rows: state.rows || [], snapshotId: state.snapshotId || 'unknown', providerSet: state.metadata?.source ? [state.metadata.source] : [], metadata: state.metadata || {} };
    const result = runScreen(input);
    const record = captureScreenRun(input, result);
    let persistence;
    try { persistence = await getScreenerArchive().put(record); }
    catch (error) { persistence = { status: 'memory-only', reason: error?.message || 'archive-unavailable' }; }
    return { ...result, snapshotMetadata: record.metadata, persistence };
  }
  // P1165 (19 스크리너 작업 카드 / 12 U01): 실행 전 미리보기는 **선택한 정의**로 계산한다.
  // 실행(runScreenerDefinition)과 같은 rows·snapshotId를 입력으로 쓰되 capture/persist하지 않는다.
  // 그래야 같은 정의·같은 snapshot에서 preview와 execute의 판정 집합·건수가 같아진다.
  function previewScreenerDefinition(definition) {
    const state = store.getState()?.screener || {};
    const input = { definition, rows: state.rows || [], snapshotId: state.snapshotId || 'unknown', providerSet: state.metadata?.source ? [state.metadata.source] : [], metadata: state.metadata || {} };
    const result = runScreen(input);
    return { ...result, snapshotMetadata: input.metadata, definition, preview: true };
  }
  // ARX-10: the native provider/orchestrator feeds the native screener renderer from the
  // published artifact + identity universe. Legacy SCREENER_DB/profile/watchlist helpers remain
  // compatibility boundaries for non-cut-over consumers; the native route does not read legacy
  // DOM projections.
  const syncScreener = createScreenerOrchestrator({
    provider: createScreenerProvider({ httpClient, readLiveData: () => root?._liveData || {} }),
    commands: screenerCommands,
    getState: () => store.getState(),
    getSuppliedMaterialsReference: () => SUPPLIED_MATERIALS_REFERENCE,
    getSuppliedMaterialClaimIds: () => SUPPLIED_MATERIAL_CLAIM_IDS,
    ranker: computeFactorRanks,
    rankingContext: () => {
      const profileKey = typeof root?._aioGetActiveProfile === 'function' ? root._aioGetActiveProfile() : 'balanced';
      const profile = profileKey && root?.AIO_TRADER_PROFILES ? root.AIO_TRADER_PROFILES[profileKey] : null;
      const resolved = deriveFactorWeights({ marketState: root?.AIO?.marketState || null, profile: profileKey === 'balanced' ? null : profile });
      // W07-A/P1146: an explicit user profile is a requested model; the neutral default is
      // the versioned default model and keeps renormalizing over available factors.
      return { weights: resolved?.weights || null, weightsPolicy: resolved?.source === 'explicit-user-profile' ? 'explicit' : 'model-default', regimeLabel: resolved?.regimeLabel || null, now: clock.now() };
    }
  });
  const analysisCommands = createAnalysisCommands({ store });
  const syncAnalysis = createAnalysisOrchestrator({ provider: createAnalysisProvider({ read: runtimeReaders.readAnalysis }), commands: analysisCommands });

  const modules = {};
  modules.principles = createLazyPage({
    route: 'principles',
    loader: () => import('../ui/pages/principles.js'),
    factory: ({ createPrinciplesPage }) => createPrinciplesPage({ root, documentRef })
  });
  modules.masters = createLazyPage({
    route: 'masters',
    loader: () => import('../ui/pages/masters.js'),
    factory: ({ createMastersPage }) => createMastersPage({ root, documentRef })
  });
  modules.atlas = createLazyPage({
    route: 'atlas',
    loader: () => import('../ui/pages/atlas.js'),
    factory: ({ createAtlasPage }) => createAtlasPage({ root, documentRef })
  });
  modules.guide = createLazyPage({
    route: 'guide',
    loader: () => import('../ui/pages/guide.js'),
    factory: ({ createGuidePage }) => createGuidePage({ documentRef })
  });
  modules['market-news'] = createLazyPage({ route: 'market-news', loader: () => import('../ui/pages/news.js'), factory: ({ createNewsPage }) => createNewsPage({ root, documentRef, store, route: 'market-news' }) });
  modules.briefing = createLazyPage({ route: 'briefing', loader: () => import('../ui/pages/news.js'), factory: ({ createNewsPage }) => createNewsPage({ root, documentRef, store, route: 'briefing' }) });
  modules.macro = createLazyPage({ route: 'macro', loader: () => import('../ui/pages/market.js'), factory: ({ createMarketSlicePage }) => createMarketSlicePage({ documentRef, store, route: 'macro' }) });
  modules.fxbond = createLazyPage({ route: 'fxbond', loader: () => import('../ui/pages/market.js'), factory: ({ createMarketSlicePage }) => createMarketSlicePage({ documentRef, store, route: 'fxbond' }) });
  modules.breadth = createLazyPage({ route: 'breadth', loader: () => import('../ui/pages/market.js'), factory: ({ createMarketSlicePage }) => createMarketSlicePage({ documentRef, store, route: 'breadth' }) });
  modules.themes = createLazyPage({ route: 'themes', loader: () => import('../ui/pages/themes.js'), factory: ({ createThemesPage }) => createThemesPage({ documentRef, store, route: 'themes' }) });
  modules['theme-detail'] = createLazyPage({ route: 'theme-detail', loader: () => import('../ui/pages/themes.js'), factory: ({ createThemesPage }) => createThemesPage({ documentRef, store, route: 'theme-detail' }) });
  modules.sentiment = createLazyPage({ route: 'sentiment', loader: () => import('../ui/pages/sentiment.js'), factory: ({ createSentimentPage }) => createSentimentPage({ documentRef, evidenceStore, store, chartFactory: () => root?.Chart }) });
  modules.ticker = createLazyPage({ route: 'ticker', loader: () => import('../ui/pages/entity.js'), factory: ({ createEntityPage }) => createEntityPage({ root, documentRef, store, route: 'ticker' }) });
  modules.fundamental = createLazyPage({ route: 'fundamental', loader: () => import('../ui/pages/entity.js'), factory: ({ createEntityPage }) => createEntityPage({ root, documentRef, store, route: 'fundamental' }) });
  modules.options = createLazyPage({ route: 'options', loader: () => import('../ui/pages/entity.js'), factory: ({ createEntityPage }) => createEntityPage({ root, documentRef, store, route: 'options' }) });
  modules.portfolio = createLazyPage({ route: 'portfolio', loader: () => import('../ui/pages/portfolio.js'), factory: ({ createPortfolioPage }) => createPortfolioPage({ root, documentRef, store }) });
  modules.screener = createLazyPage({
    route: 'screener',
    loader: () => import('../ui/pages/screener.js'),
    factory: ({ createScreenerPage }) => createScreenerPage({
      documentRef,
      store,
      root,
      workbench: Object.freeze({
        getDefaultScreens: api.getDefaultScreenerScreens,
        setSavedScreens: api.setScreenerSavedScreens,
        run: api.runScreenerDefinition,
        preview: api.previewScreenerDefinition,
        list: api.listScreenerRuns,
        replay: api.replayScreenerRun,
        remove: api.deleteScreenerRun
      }),
      readLiveData: () => root?._liveData || {},
      readWatchlist: () => root?._aioWatchlistGet?.() || [],
      readAliases: () => root?.SCR_KEYWORD_ALIASES || {},
      onTicker: (symbol) => {
        if (typeof root?._aioScreenerTicker === 'function') return root._aioScreenerTicker(symbol);
        return root?.showTicker?.(symbol);
      },
      onWatchlistToggle: (symbol) => root?._aioWLToggle?.(symbol),
      onProfileChange: (profile) => profile ? syncScreenerData() : null
    })
  });
  modules.home = createLazyPage({ route: 'home', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'home' }) });
  modules.signal = createLazyPage({ route: 'signal', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'signal' }) });
  modules.technical = createLazyPage({ route: 'technical', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'technical' }) });
  const router = createLifecycleRouter({ root: eventTarget, registry: createRouteRegistry({ modules }), context: { store, evidenceStore, legacy, clock, documentRef, runtimeRoot: root } });

  function syncScreenerData({ scope = router.activeScope(), refresh = true } = {}) {
    return syncScreener.sync({ scope, refresh }).then((result) => {
      if (result) {
        eventTarget.dispatchEvent(new CustomEvent('aio:nativeScreenerReady', { detail: result }));
      }
      return result;
    });
  }

  const requiredMarketSymbols = Object.freeze([...new Set(Object.values(PAGE_DATA_TIMELINE_CONTRACTS)
    .flat()
    .filter((contract) => contract.required && contract.marketRevision && contract.id.startsWith('market.'))
    .map((contract) => contract.id.slice('market.'.length)))].sort());

  function getRuntimeObservationCatalog() {
    return runtimeReaders.readObservationCatalog(store.getState());
  }

  function getCanonicalMarketRevision(catalog = getRuntimeObservationCatalog()) {
    const browserBatch = root?.AIO?._quoteBatchEpoch || null;
    const batchSymbols = new Set(Array.isArray(browserBatch?.symbols) ? browserBatch.symbols : []);
    const completeBrowserBatch = !!browserBatch?.revision
      && requiredMarketSymbols.every((symbol) => batchSymbols.has(symbol))
      && requiredMarketSymbols.every((symbol) => catalog[`market.${symbol}`]?.revision === browserBatch.revision);
    if (completeBrowserBatch) return browserBatch.revision;
    return marketSnapshot?.revision || root?._serverDataMeta?.marketSnapshotRevision || null;
  }

  function getPageDataTimelineState(route) {
    const catalog = getRuntimeObservationCatalog();
    return evaluatePageDataTimeline(route, catalog, { now: clock.now(), marketRevision: getCanonicalMarketRevision(catalog) });
  }

  function getPageDataTimelineAudit() {
    const catalog = getRuntimeObservationCatalog();
    return auditPageDataTimelines(catalog, { now: clock.now(), marketRevision: getCanonicalMarketRevision(catalog) });
  }

  function start() {
    let disposed = false;
    const deferredTasks = createDeferredTaskQueue({
      setTimeoutImpl: root?.setTimeout?.bind(root) || globalThis.setTimeout.bind(globalThis),
      clearTimeoutImpl: root?.clearTimeout?.bind(root) || globalThis.clearTimeout.bind(globalThis)
    });
    const compatibilityEvents = createCompatibilityEventAdapter({ root, eventTarget, now: clock.now });
    const emitDataTimelineUpdated = coalesceMicrotask((reason = 'state-updated') => {
      try {
        eventTarget.dispatchEvent(new CustomEvent('aio:dataTimelineUpdated', { detail: { reason, audit: getPageDataTimelineAudit() } }));
      } catch (_) {}
    }, { isActive: () => !disposed });
    // P858: the legacy snapshot/DOM shell already provides the first paint.
    // Keep only the small decision-state projections on the critical path;
    // news/entity/themes/portfolio/screener hydration is staged after the
    // interactive boot window so large normalization passes cannot become a
    // single long task before the user can navigate.
    syncSentimentProjection();
    syncMarket.sync();
    syncAnalysis.sync();
    const deferredStartupSyncs = [
      () => syncNews.sync(),
      () => syncThemes.sync(),
      () => syncEntity.sync(),
      () => syncPortfolio.sync(),
      // Server hydration commonly finishes before the staged startup reaches
      // this task. Do not rebuild and refetch that same universe a second time.
      () => store.getState()?.screener?.rows?.length ? null : syncScreenerData()
    ];
    let deferredStartupIndex = 0;
    const runDeferredStartupSync = () => {
      const task = deferredStartupSyncs[deferredStartupIndex++];
      if (!task) return;
      try {
        const result = task();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (_) {}
      deferredTasks.defer(runDeferredStartupSync, 0);
    };
    deferredTasks.defer(runDeferredStartupSync, 2300);
    // RM-02: aio:liveQuotes previously ran 6 independent listeners (one dispatch each,
    // any of which could be redundant if quotes ticked again before the previous
    // dispatch's subscribers finished reacting). Coalesce them into one microtask-
    // batched flush: repeated aio:liveQuotes firings before the microtask runs collapse
    // into a single pass over all 6 syncs instead of one pass per firing.
    const flushLiveQuoteSyncs = coalesceMicrotask(async () => {
      await Promise.allSettled([
        Promise.resolve().then(() => syncSentimentProjection()),
        Promise.resolve().then(() => syncMarket.sync()),
        Promise.resolve().then(() => syncThemes.sync()),
        Promise.resolve().then(() => syncEntity.sync()),
        Promise.resolve().then(() => syncPortfolio.sync()),
        Promise.resolve().then(() => syncAnalysis.sync())
      ]);
      if (!disposed) emitDataTimelineUpdated('live-quotes');
    }, { isActive: () => !disposed });
    const stopQuotes = legacy.on('aio:liveQuotes', flushLiveQuoteSyncs);
    const stopRefresh = compatibilityEvents.on('aio:refresh:done', syncSentimentProjection);
    const stopHistory = compatibilityEvents.on('aio:historyLoaded', syncSentimentProjection);
    const stopSentiment = legacy.on('aio:sentimentUpdated', syncSentimentProjection);
    const stopNews = legacy.on('aio:newsUpdated', syncNews.sync);
    const stopNewsRefresh = compatibilityEvents.on('aio:refresh:done', syncNews.sync);
    const stopMarketRefresh = compatibilityEvents.on('aio:refresh:done', syncMarket.sync);
    const stopMarketHistory = compatibilityEvents.on('aio:historyLoaded', syncMarket.sync);
    const stopMarketSnapshot = legacy.on('aio:marketSnapshot', syncMarket.sync);
    const syncServerArtifactConsumers = coalesceMicrotask(async () => {
      await Promise.allSettled([
        Promise.resolve().then(() => syncSentimentProjection()),
        Promise.resolve().then(() => syncNews.sync()),
        Promise.resolve().then(() => syncMarket.sync()),
        Promise.resolve().then(() => syncThemes.sync()),
        Promise.resolve().then(() => syncEntity.sync()),
        Promise.resolve().then(() => syncPortfolio.sync()),
        Promise.resolve().then(() => syncScreenerData()),
        Promise.resolve().then(() => syncAnalysis.sync())
      ]);
      if (!disposed) emitDataTimelineUpdated('server-data');
    }, { isActive: () => !disposed });
    const stopServerMarketData = legacy.on('aio:serverDataLoaded', syncServerArtifactConsumers);
    const stopMacroUpdated = legacy.on('aio:macroUpdated', syncMarket.sync);
    const stopThemesRefresh = compatibilityEvents.on('aio:refresh:done', syncThemes.sync);
    const stopThemesHistory = legacy.on('aio:themesHistoryLoaded', syncThemes.sync);
    const stopThemeDetail = legacy.on('aio:themeDetailShown', syncThemes.sync);
    const stopEntityRefresh = compatibilityEvents.on('aio:refresh:done', syncEntity.sync);
    const stopEntityChanged = legacy.on('aio:entityChanged', syncEntity.sync);
    const normalizeShownRoute = (event) => {
      const detail = event?.detail;
      const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route || router.active();
      return String(route || '').replace(/^page-/, '');
    };
    const onCurrentRouteShown = (routes, sync, { withScope = false } = {}) => (event) => {
      const shownRoute = normalizeShownRoute(event);
      if (!routes.has(shownRoute)) return;
      queueMicrotask(() => {
        if (disposed || router.active() !== shownRoute) return;
        const scope = router.activeScope();
        return withScope ? sync({ scope }) : sync();
      });
    };
    const stopEntityShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['ticker', 'fundamental', 'options']), syncEntity.sync, { withScope: true }));
    const stopPortfolioShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['portfolio']), syncPortfolio.sync));
    const stopPortfolioChanged = legacy.on('aio:portfolioChanged', syncPortfolio.sync);
    const stopScreenerRefresh = compatibilityEvents.on('aio:refresh:done', syncScreenerData);
    const stopScreenerQuotes = legacy.on('aio:liveQuotes', () => {
      if (String(store.getState()?.route || router.active() || '').replace(/^page-/, '') === 'screener') return syncScreenerData({ refresh: false });
    });
    const stopScreenerShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['screener']), syncScreenerData, { withScope: true }));
    const stopAnalysisRefresh = compatibilityEvents.on('aio:refresh:done', syncAnalysis.sync);
    const stopAnalysisChanged = legacy.on('aio:entityChanged', syncAnalysis.sync);
    const stopAnalysisShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['home', 'signal', 'technical']), syncAnalysis.sync));
    // E2/LC-26: a mode change is a score input change, so re-derive the analysis slice instead of
    // leaving the hero on the previous mode until the next refresh cycle. Deliberately its own
    // event (not `aio:refresh:done`) so toggling the pill does not re-run every route provider.
    const stopAnalysisModeChange = compatibilityEvents.on('aio:signalScoreModeChanged', syncAnalysis.sync);
    const stopShown = legacy.on('aio:navigationCommitted', (event) => {
      // W00/P1143: the store route follows the router's single committed result, so
      // DOM, router, scope, and canonical state move together on one navigation.
      const committed = event?.detail?.routeId || router.active();
      if (committed) store.dispatch({ type: 'route/changed', payload: committed });
    });
    const stopTimelineStore = store.subscribe(() => emitDataTimelineUpdated('store-updated'));
    const refreshStaleActivePage = () => {
      emitDataTimelineUpdated('freshness-watchdog');
      if (documentRef?.visibilityState === 'hidden') return;
      const route = String(store.getState()?.route || router.active() || '').replace(/^page-/, '');
      if (!route) return;
      const timeline = getPageDataTimelineState(route);
      if ((timeline.status === 'PARTIAL' || timeline.status === 'BLOCKED') && typeof root?._aioRefreshPageData === 'function') {
        try { root._aioRefreshPageData(route); } catch (_) {}
      }
    };
    const timelineWatchdog = setInterval(refreshStaleActivePage, 5 * 60 * 1000);
    const onVisibilityTimelineCheck = () => {
      if (documentRef?.visibilityState !== 'hidden') refreshStaleActivePage();
    };
    documentRef?.addEventListener?.('visibilitychange', onVisibilityTimelineCheck);
    // W00-B: the initial route commits through the same typed boundary. router.start()
    // first so observers of aio:navigationCommitted see the very first commit.
    const initialRoute = resolveInitialRoute({ root });
    router.start();
    if (!router.active()) {
      router.transition(initialRoute, { source: 'initial-load', directEntry: true });
      if (store.getState()?.route == null) {
        const committedInitial = router.active() || initialRoute;
        if (committedInitial) store.dispatch({ type: 'route/changed', payload: committedInitial });
      }
    }
    if (root?._serverDataMeta) queueMicrotask(syncServerArtifactConsumers);
    let navigation = legacy.installNavigation(router);
    const retryNavigation = () => {
      if (!disposed && !navigation.installed) navigation = legacy.installNavigation(router);
    };
    queueMicrotask(retryNavigation);
    deferredTasks.defer(retryNavigation, 0);
    const ready = snapshotLoader.load().then((result) => {
      if (!disposed && result.ok) {
        marketSnapshot = result.snapshot;
        ingestSnapshotEvidence(marketSnapshot);
        store.dispatch({ type: 'market/snapshot', payload: marketSnapshot });
        applyMarketSnapshotToLegacy(root, marketSnapshot, { sourceId: result.source });
        syncSentimentProjection();
        syncMarket.sync();
        emitDataTimelineUpdated('market-snapshot');
      }
      return result;
    }).catch((error) => ({ ok: false, error: error?.message || 'snapshot_loader_failed' }));
    const stop = () => {
      if (disposed) return;
      disposed = true;
      deferredTasks.stop();
      navigation.restore();
      stopQuotes();
      stopRefresh();
      stopHistory();
      stopSentiment();
      stopNews();
      stopNewsRefresh();
      stopMarketRefresh();
      stopMarketHistory();
      stopMarketSnapshot();
      stopServerMarketData();
      stopMacroUpdated();
      stopThemesRefresh();
      stopThemesHistory();
      stopThemeDetail();
      stopEntityRefresh();
      stopEntityChanged();
      stopEntityShown();
      stopPortfolioShown();
      stopPortfolioChanged();
      stopScreenerRefresh();
      stopScreenerQuotes();
      stopScreenerShown();
      stopAnalysisRefresh();
      stopAnalysisChanged();
      stopAnalysisShown();
      stopAnalysisModeChange();
      stopShown();
      stopTimelineStore();
      compatibilityEvents.dispose();
      clearInterval(timelineWatchdog);
      documentRef?.removeEventListener?.('visibilitychange', onVisibilityTimelineCheck);
      router.dispose();
      // Fable-advisor review (2026-07-21): drop any in-flight screener/entity fetch resolution
      // permanently once the app is torn down — see the generation-counter guard in those two
      // orchestrators for the (more common) case of a newer sync() superseding an older one.
      syncScreener.dispose();
      syncEntity.dispose();
      evidenceStore.clear();
      snapshotEvidence.clear();
    };
    stop.ready = ready;
    return stop;
  }

  const api = {
    version: ARCHITECTURE_VERSION,
    start,
    router,
    getState: () => store.getState(),
    getRuntimeObservationCatalog,
    getCanonicalMarketRevision,
    getPageDataTimelineState,
    getPageDataTimelineAudit,
    getPageDataTimelineContracts: () => PAGE_DATA_TIMELINE_CONTRACTS,
    getScreenerState: () => store.getState()?.screener || null,
    getScreenerWorkbench: () => {
      const state = store.getState()?.screener || {};
      return { snapshotId: state.snapshotId, definition: state.screenDefinition, run: state.lastRun, runHistory: state.runHistory || [], readiness: state.readiness, savedScreens: state.savedScreens || [], outcomes: state.outcomes || [], refreshPlan: state.refreshPlan || null, hash: state.workbenchHash || null };
    },
    getDefaultScreenerScreens: () => defaultSavedScreens,
    setScreenerSavedScreens: (savedScreens) => screenerCommands.setSavedScreens(Array.isArray(savedScreens) ? savedScreens : []),
    runScreenerDefinition,
    previewScreenerDefinition,
    listScreenerRuns: () => getScreenerArchive().list(),
    replayScreenerRun: async (id) => {
      const record = await getScreenerArchive().get(id);
      if (!record) throw new Error('SCREEN_ARCHIVE_RECORD_MISSING');
      return { definition: record.definition, ...replayScreenRun(record), snapshotMetadata: record.metadata, persistence: { status: 'persisted', id }, replay: true };
    },
    deleteScreenerRun: (id) => getScreenerArchive().remove(id),
    // ARX-16 compatibility read boundary: non-route consumers may read the
    // canonical native screener rows without reaching into the store shape.
    // Native nulls/readiness are authoritative, including an empty result.
    // Backfilling legacy numeric values here bypassed the provider's checks.
    getScreenerRows: () => store.getState()?.screener?.rows || [],
    getEvidence: (metric) => metric ? evidenceStore.get(metric) : evidenceStore.snapshot(),
    selectForDecision: (source, metric) => selectForDecision(source || evidenceStore.snapshot(), metric),
    selectForDisplay: (source, metric) => selectForDisplay(source || evidenceStore.snapshot(), metric),
    selectLastKnown: (source, metric) => selectLastKnown(source || evidenceStore.snapshot(), metric),
    selectCompleteness: (source, requiredMetrics, purpose) => selectCompleteness(source || evidenceStore.snapshot(), requiredMetrics, purpose),
    getMarketSnapshot: () => marketSnapshot,
    getSentimentSummary: () => selectSentimentSummary(store.getState()),
    ingestSentiment,
    getAIContext: (metrics = ['fearGreed', 'vix']) => buildEvidenceContext({ evidenceStore, metrics, retriever: aiRetriever })
    ,getAIOrchestrator: () => aiOrchestrator
    ,planAIQuestion: (input = {}) => aiOrchestrator.plan(input)
     ,executeAIQuestion: (input = {}) => aiOrchestrator.execute(input)
      ,analyzeAIQuestion: (questionPlan, inputs = {}) => aiOrchestrator.analyze(questionPlan, inputs)
      ,validateAIResearch: (questionPlan = null) => aiOrchestrator.validateResearch(questionPlan || aiOrchestrator.getLastPlan())
      ,getAIResearchCapability: (input = {}) => aiOrchestrator.getResearchCapability(input)
      ,validateAIResearchCapability: (capability = null) => aiOrchestrator.validateResearchCapability(capability)
      ,createAIResearchEvidenceDocument: (input = {}) => createEvidenceDocument(input)
      ,normalizeAIResearchExecutionResult: (result = {}) => normalizeResearchExecutionResult(result)
      ,evaluateAIResearchEvidenceFloor: (input = {}) => evaluateResearchEvidenceFloor(input)
      ,parseAIAnswerPlan: (text, options = {}) => aiOrchestrator.parseAnswerPlanText(text, options)
       ,renderAIAnswerPlan: (plan, options = {}) => aiOrchestrator.renderAnswerPlan(plan, options)
      ,classifyAIConduct
      ,buildScopedConductFallback
      ,getAIConductPolicy
    ,navigate: (route, ...args) => legacy.navigate(route, ...args)
    // RM-03: single-implementation trading-score model. js/aio-core.js's computeTradingScore
    // wrapper calls this instead of keeping its own copy of the scoring formula (R352/F-03: legacy
    // and native must not diverge into two different models).
    ,computeTradingScoreModel
    // E2/LC-26: signal score mode revision — a calculation input shared by the legacy toggle
    // and the native readers, plus the pure descriptor/normalizer so the UI never invents a
    // mode-dependent threshold the model does not produce.
    ,getSignalScoreMode
    ,setSignalScoreMode
    ,describeSignalScoreMode
    ,normalizeSignalScoreMode
    // RM-03 item 2: same single-implementation pattern for RRG (index.html:calcLiveRS) and
    // Weinstein/MTF (js/aio-core.js:calcTechnicalSnapshot, index.html:updateMTF).
    ,computeRelativeRotation
    ,classifyMovingAverageStructure
    ,deriveMultiTimeframeView
    ,computeNewsSentimentScore
    ,computeNewsRiskSignals
    // P746 follow-up (2026-07-21, Fable-advisor design): breadth page's own participation
    // classifier — deliberately NOT reusing classifyMovingAverageStructure (single-symbol price MA
    // stack, categorically different input) or the RSP/SPY-ratio breadth-signal-val logic.
    ,classifyBreadthParticipation
    // RM-03 continued (2026-07-21, P757): single-implementation treasury-curve/2s10s model —
    // js/aio-core.js's getUsTreasuryCurveEvidence wrapper calls this instead of keeping its own
    // copy of the multi-source fallback formula (R352/F-03).
    ,deriveTreasuryCurveEvidence
    // RM-03 continued (2026-07-21, P758): concentration-risk slice of calcPortfolioTechnicalRisk/
    // calcPositionTechnicalRisk. concentrationPenaltyForWeight is the single-implementation tier
    // ladder js/aio-core.js's calcPositionTechnicalRisk now calls instead of its own copy;
    // deriveConcentrationRisk is exposed for future portfolio-route native consumers (not yet
    // wired to any UI — the portfolio orchestrator's data source is the encrypted Vault, a
    // different shape than this slice's positions/OHLCV-derived risk model).
    ,deriveConcentrationRisk
    ,concentrationPenaltyForWeight
    // RM-03 continued (2026-07-21, P759): the legacy screener ranking wrapper resolves its
    // existing profile/regime inputs and projects this pure model back onto SCREENER_DB; native
    // consumers can use the same implementation without importing legacy globals (R352/F-03).
    ,computeFactorRanks
    ,deriveFactorWeights
    // P785: single pure market-health model for the technical primary surface; the legacy
    // computeMarketHealth wrapper consumes this API and only renders when the native fence is absent.
    ,computeMarketHealth
    ,getVerticalSliceContract: (route) => getVerticalSliceContract(route)
    ,getVerticalSliceContracts: () => VERTICAL_SLICE_CONTRACTS.slice()
    ,auditVerticalSliceContracts: (routes = ROUTE_IDS) => auditVerticalSliceContracts(routes)
    ,capabilityManifestVersion: CAPABILITY_MANIFEST_VERSION
    ,getCapability: (id) => getCapability(id)
    ,getCapabilityManifest: () => getCapabilityManifest()
    ,auditCapabilityClaims: (options = {}) => auditCapabilityClaims({ documentRef, ...options })
  };
  exposeArchitecture(root, api, { immutableState: true });
  // The legacy chat remains a UI adapter, but its supplied-material context
  // reads this canonical ESM registry instead of maintaining another claim
  // ledger.  Expose a frozen reference snapshot only; no current values enter
  // the runtime signal or ranking stores.
  root.AIO = root.AIO || {};
  root.AIO.SUPPLIED_MATERIALS_REFERENCE = SUPPLIED_MATERIALS_REFERENCE;
  root.AIO.SUPPLIED_MATERIAL_CLAIM_IDS = SUPPLIED_MATERIAL_CLAIM_IDS;
  root.AIO.NATHAN_PREVIOUS_THREADS_REFERENCE = NATHAN_PREVIOUS_THREADS_REFERENCE;
  root.AIO.NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS = NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS;
  root.AIO.NATHAN_FRAMEWORK_PACK = NATHAN_FRAMEWORK_PACK;
  root.AIO.NATHAN_ANALYSIS_PROTOCOL = NATHAN_ANALYSIS_PROTOCOL;
  root.AIO.NATHAN_KNOWLEDGE_ALIASES = NATHAN_KNOWLEDGE_ALIASES;
  return Object.freeze({ ...api, store, evidenceStore });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const boot = () => {
    if (window.__AIO_ARCH_RUNTIME__) return;
    try {
      const runtime = createAIOArchitecture({ root: window, documentRef: document });
      window.__AIO_ARCH_RUNTIME__ = runtime.start();
    } catch (error) {
      document.documentElement.dataset.aioArchitectureFallback = 'legacy';
      console.warn('[AIO] architecture bootstrap deferred to legacy shell', error?.message || error);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
