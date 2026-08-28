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
import { computeRelativeRotation } from '../domain/themes/rrg.js';
import { classifyMovingAverageStructure, deriveMultiTimeframeView } from '../domain/technical/stage.js';
import { computeNewsSentimentScore, computeNewsRiskSignals } from '../domain/news/scoring.js';
import { classifyBreadthParticipation } from '../domain/market/breadth.js';
import { computeMarketHealth } from '../domain/market/health.js';
import { deriveTreasuryCurveEvidence } from '../domain/macro/treasury-curve.js';
import { deriveConcentrationRisk, concentrationPenaltyForWeight } from '../domain/portfolio/concentration.js';
import { computeFactorRanks } from '../domain/screener/factor-ranks.js';
import { deriveFactorWeights } from '../domain/screener/factor-weights.js';
import { createDefaultScreenDefinitions, runScreen } from '../domain/screener/screen-engine.js';
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
import { buildEvidenceContext } from '../ai/context-builder.js';
import { createEvidenceRetriever } from '../ai/retrieval/evidence.js';
import { createAIAnswerOrchestrator } from '../ai/orchestrator/answer-orchestrator.js';
import { createEvidenceDocument, evaluateResearchEvidenceFloor, normalizeResearchExecutionResult } from '../ai/research/evidence.js';
import { createLazyPage, createRouteRegistry, createLifecycleRouter } from './router.js';
import { renderSentimentSummaryProjection } from '../ui/projections/sentiment-summary.js';
import { createInitialAnalysisState, analysisReducer, ANALYSIS_DATA_CLEAR, ANALYSIS_DATA_SET } from '../state/slices/analysis.js';
import { createAnalysisCommands } from './commands/analysis.js';
import { createAnalysisProvider } from '../data/providers/analysis.js';
import { createAnalysisOrchestrator } from '../data/orchestrators/analysis.js';
import { createStorageGateway } from '../platform/storage.js';
import { createLegacyFacade, exposeArchitecture } from '../legacy/compatibility-facade.js';
import { applyMarketSnapshotToLegacy } from '../legacy/market-snapshot-bridge.js';
import { ROUTE_IDS } from './routes.js';
import { VERTICAL_SLICE_CONTRACTS, auditVerticalSliceContracts, getVerticalSliceContract } from './vertical-slices.js';
import { PAGE_DATA_TIMELINE_CONTRACTS, auditPageDataTimelines, evaluatePageDataTimeline } from '../data/contracts/page-timeline.js';
import { CAPABILITY_MANIFEST_VERSION, getCapability, getCapabilityManifest, auditCapabilityClaims } from '../domain/content/capability-manifest.js';
import { classifyAIConduct, buildScopedConductFallback, getAIConductPolicy } from '../ai/policy/conduct.js';

export const ARCHITECTURE_VERSION = 'AR-01~16.v1';

// RM-02: collapses repeated same-tick event firings into a single trailing
// microtask flush instead of running `fn` once per firing.
function coalesceMicrotask(fn) {
  let scheduled = false;
  return (...args) => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      fn(...args);
    });
  };
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
  const snapshotLoader = createMarketSnapshotLoader({ httpClient, clock });
  let marketSnapshot = null;
  const snapshotEvidence = new Map();
  const aiRetriever = createEvidenceRetriever({ evidenceStore });
  // AIQ-0/AIQ-1: the legacy chat surfaces remain UI adapters, while planning and
  // dispatch ownership lives in one ESM orchestrator. This is deliberately created
  // beside the canonical evidence store so future tool adapters can consume the same
  // state without creating a second chat path.
  const aiOrchestrator = createAIAnswerOrchestrator({ root, now: () => clock.now() });

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
  const screenerSessionStorage = createStorageGateway({ storage: root?.sessionStorage, prefix: 'aio-session' });
  // ARX-10: the native provider/orchestrator feeds the native screener renderer from the
  // published artifact + identity universe. Legacy SCREENER_DB/profile/watchlist helpers remain
  // compatibility boundaries for non-cut-over consumers; the native route does not read legacy
  // DOM projections.
  const syncScreener = createScreenerOrchestrator({
    provider: createScreenerProvider({ httpClient, readLiveData: () => root?._liveData || {} }),
    commands: screenerCommands,
    getState: () => store.getState(),
    ranker: computeFactorRanks,
    rankingContext: () => {
      const profileKey = typeof root?._aioGetActiveProfile === 'function' ? root._aioGetActiveProfile() : 'balanced';
      const profile = profileKey && root?.AIO_TRADER_PROFILES ? root.AIO_TRADER_PROFILES[profileKey] : null;
      const resolved = deriveFactorWeights({ marketState: root?.AIO?.marketState || null, profile: profileKey === 'balanced' ? null : profile });
      return { weights: resolved?.weights || null, regimeLabel: resolved?.regimeLabel || null, now: clock.now() };
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
      readLiveData: () => root?._liveData || {},
      readWatchlist: () => root?._aioWatchlistGet?.() || [],
      readAliases: () => root?.SCR_KEYWORD_ALIASES || {},
      onTicker: (symbol) => {
        if (typeof root?._aioScreenerTicker === 'function') return root._aioScreenerTicker(symbol);
        return root?.showTicker?.(symbol);
      },
      onWatchlistToggle: (symbol) => root?._aioWLToggle?.(symbol),
      writeReturnContext: (context) => screenerSessionStorage.set('screener:return-context', JSON.stringify(context)),
      onProfileChange: (profile) => profile ? syncScreenerData() : null
    })
  });
  modules.home = createLazyPage({ route: 'home', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'home' }) });
  modules.signal = createLazyPage({ route: 'signal', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'signal' }) });
  modules.technical = createLazyPage({ route: 'technical', loader: () => import('../ui/pages/analysis.js'), factory: ({ createAnalysisPage }) => createAnalysisPage({ root, documentRef, store, route: 'technical' }) });
  const router = createLifecycleRouter({ root: eventTarget, registry: createRouteRegistry({ modules }), context: { store, evidenceStore, legacy, clock, documentRef, runtimeRoot: root } });

  function syncScreenerData({ scope = router.activeScope() } = {}) {
    return syncScreener.sync({ scope }).then((result) => {
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

  const emitDataTimelineUpdated = coalesceMicrotask((reason = 'state-updated') => {
    try {
      eventTarget.dispatchEvent(new CustomEvent('aio:dataTimelineUpdated', { detail: { reason, audit: getPageDataTimelineAudit() } }));
    } catch (_) {}
  });

  function start() {
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
      () => syncScreenerData()
    ];
    let deferredStartupIndex = 0;
    const runDeferredStartupSync = () => {
      const task = deferredStartupSyncs[deferredStartupIndex++];
      if (!task) return;
      try {
        const result = task();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (_) {}
      setTimeout(runDeferredStartupSync, 0);
    };
    setTimeout(runDeferredStartupSync, 2300);
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
      emitDataTimelineUpdated('live-quotes');
    });
    const stopQuotes = legacy.on('aio:liveQuotes', flushLiveQuoteSyncs);
    const stopRefresh = legacy.on('aio:refresh:done', syncSentimentProjection);
    const stopHistory = legacy.on('aio:historyLoaded', syncSentimentProjection);
    const stopSentiment = legacy.on('aio:sentimentUpdated', syncSentimentProjection);
    const stopNews = legacy.on('aio:newsUpdated', syncNews.sync);
    const stopMarketRefresh = legacy.on('aio:refresh:done', syncMarket.sync);
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
      emitDataTimelineUpdated('server-data');
    });
    const stopServerMarketData = legacy.on('aio:serverDataLoaded', syncServerArtifactConsumers);
    const stopMacroUpdated = legacy.on('aio:macroUpdated', syncMarket.sync);
    const stopThemesRefresh = legacy.on('aio:refresh:done', syncThemes.sync);
    const stopThemesHistory = legacy.on('aio:themesHistoryLoaded', syncThemes.sync);
    const stopThemeDetail = legacy.on('aio:themeDetailShown', syncThemes.sync);
    const stopEntityRefresh = legacy.on('aio:refresh:done', syncEntity.sync);
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
        if (router.active() !== shownRoute) return;
        const scope = router.activeScope();
        return withScope ? sync({ scope }) : sync();
      });
    };
    const stopEntityShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['ticker', 'fundamental', 'options']), syncEntity.sync, { withScope: true }));
    const stopPortfolioShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['portfolio']), syncPortfolio.sync));
    const stopPortfolioChanged = legacy.on('aio:portfolioChanged', syncPortfolio.sync);
    const stopScreenerRefresh = legacy.on('aio:refresh:done', syncScreenerData);
    const stopScreenerShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['screener']), syncScreenerData, { withScope: true }));
    const stopAnalysisRefresh = legacy.on('aio:refresh:done', syncAnalysis.sync);
    const stopAnalysisShown = legacy.on('aio:pageShown', onCurrentRouteShown(new Set(['home', 'signal', 'technical']), syncAnalysis.sync));
    const stopShown = legacy.on('aio:pageShown', (event) => {
      const detail = event?.detail;
      const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
      if (route) store.dispatch({ type: 'route/changed', payload: route });
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
    // MP-02/KG-07: a direct hash entry can fire the legacy pageShown event
    // before this ESM listener is attached. Replay the canonical initial route
    // once so deep links mount the same native surface as sidebar navigation.
    const initialHashRoute = String(root?.location?.hash || '').replace(/^#/, '').split('?')[0].trim();
    const initialRoute = ROUTE_IDS.includes(initialHashRoute) ? initialHashRoute : 'home';
    if (!router.active()) router.transition(initialRoute, { source: 'initial-load', directEntry: true });
    if (root?._serverDataMeta) queueMicrotask(syncServerArtifactConsumers);
    router.start();
    let navigation = legacy.installNavigation(router);
    let disposed = false;
    const retryNavigation = () => {
      if (!disposed && !navigation.installed) navigation = legacy.installNavigation(router);
    };
    queueMicrotask(retryNavigation);
    const navigationRetryTimer = setTimeout(retryNavigation, 0);
    const ready = snapshotLoader.load().then((result) => {
      if (result.ok) {
        marketSnapshot = result.snapshot;
        ingestSnapshotEvidence(marketSnapshot);
        store.dispatch({ type: 'market/snapshot', payload: marketSnapshot });
        applyMarketSnapshotToLegacy(root, marketSnapshot);
        syncSentimentProjection();
        syncMarket.sync();
        emitDataTimelineUpdated('market-snapshot');
      }
      return result;
    }).catch((error) => ({ ok: false, error: error?.message || 'snapshot_loader_failed' }));
    const stop = () => {
      disposed = true;
      clearTimeout(navigationRetryTimer);
      navigation.restore();
      stopQuotes();
      stopRefresh();
      stopHistory();
      stopSentiment();
      stopNews();
      stopMarketRefresh();
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
      stopScreenerShown();
      stopAnalysisRefresh();
      stopAnalysisShown();
      stopShown();
      stopTimelineStore();
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
    runScreenerDefinition: (definition) => runScreen({ definition, rows: store.getState()?.screener?.rows || [], snapshotId: store.getState()?.screener?.snapshotId || 'unknown', providerSet: store.getState()?.screener?.metadata?.source ? [store.getState().screener.metadata.source] : [] }),
    // ARX-16 compatibility read boundary: non-route consumers may read the
    // canonical native screener rows without reaching into the store shape.
    // Legacy rows only fill fields the native artifact does not publish yet.
    getScreenerRows: () => {
      const nativeRows = store.getState()?.screener?.rows;
      const legacyRows = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
      if (!Array.isArray(nativeRows) || nativeRows.length === 0) return legacyRows;
      const legacyBySymbol = new Map(legacyRows.map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), row]));
      return nativeRows.map((row) => {
        const legacy = legacyBySymbol.get(String(row?.sym || row?.symbol || '').toUpperCase()) || {};
        const merged = { ...row };
        for (const key of Object.keys(legacy)) {
          if (merged[key] == null || (key === 'factorScores' && Object.keys(merged[key] || {}).length === 0)) {
            merged[key] = legacy[key];
          }
        }
        return merged;
      });
    },
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
  exposeArchitecture(root, api);
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
