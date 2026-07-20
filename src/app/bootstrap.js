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
import { computeTradingScoreModel } from '../domain/signal/trading-score.js';
import { computeRelativeRotation } from '../domain/themes/rrg.js';
import { classifyMovingAverageStructure, deriveMultiTimeframeView } from '../domain/technical/stage.js';
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
import { buildEvidenceContext } from '../ai/context-builder.js';
import { createEvidenceRetriever } from '../ai/retrieval/evidence.js';
import { createRouteRegistry } from './router.js';
import { createLifecycleRouter } from './router.js';
import { createGuidePage } from '../ui/pages/guide.js';
import { createNewsPage } from '../ui/pages/news.js';
import { createMarketSlicePage } from '../ui/pages/market.js';
import { createThemesPage } from '../ui/pages/themes.js';
import { createSentimentPage, renderSentimentSummaryProjection } from '../ui/pages/sentiment.js';
import { createEntityPage } from '../ui/pages/entity.js';
import { createPortfolioPage } from '../ui/pages/portfolio.js';
import { createScreenerPage } from '../ui/pages/screener.js';
import { createAnalysisPage } from '../ui/pages/analysis.js';
import { createInitialAnalysisState, analysisReducer, ANALYSIS_DATA_CLEAR, ANALYSIS_DATA_SET } from '../state/slices/analysis.js';
import { createAnalysisCommands } from './commands/analysis.js';
import { createAnalysisProvider } from '../data/providers/analysis.js';
import { createAnalysisOrchestrator } from '../data/orchestrators/analysis.js';
import { createStorageGateway } from '../platform/storage.js';
import { createPrivacyVault } from '../storage/vault.js';
import { createLegacyFacade, exposeArchitecture } from '../legacy/compatibility-facade.js';
import { applyMarketSnapshotToLegacy } from '../legacy/market-snapshot-bridge.js';
import { ROUTE_IDS } from './routes.js';

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
  const store = createStore({ initialState: { sentiment: createInitialSentimentState(), news: createInitialNewsState(), market: createInitialMarketState(), themes: createInitialThemesState(), entity: createInitialEntityState(), portfolio: createInitialPortfolioState(), screener: createInitialScreenerState(), analysis: createInitialAnalysisState(), route: null, marketSnapshot: null }, reducer });
  const eventTarget = documentRef || root;
  const legacy = createLegacyFacade(root, eventTarget);
  const httpClient = createHttpClient({ fetchImpl, clock });
  const snapshotLoader = createMarketSnapshotLoader({ httpClient, clock });
  let marketSnapshot = null;
  const snapshotEvidence = new Map();
  const aiRetriever = createEvidenceRetriever({ evidenceStore });

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

  const sentimentProvider = createSentimentProvider({ read: legacy.readSentiment, now: clock.now });
  const sentimentCommands = createSentimentCommands({ store });
  const syncSentiment = createSentimentOrchestrator({ provider: sentimentProvider, evidenceStore, store, commands: sentimentCommands, snapshotEvidence, clock });
  const syncSentimentProjection = (patch = null) => {
    const result = syncSentiment.sync(patch);
    renderSentimentSummaryProjection(documentRef, selectSentimentSummary(store.getState()));
    return result;
  };
  const ingestSentiment = (patch = {}) => syncSentimentProjection(patch);
  const newsProvider = createNewsProvider({ read: () => root?._allNewsItems || root?.newsCache || [], now: clock.now });
  const newsCommands = createNewsCommands({ store });
  const syncNews = createNewsOrchestrator({ provider: newsProvider, commands: newsCommands });
  const marketCommands = createMarketCommands({ store });
  const syncMarket = createMarketOrchestrator({ provider: createMarketProvider({ read: legacy.readMarket }), commands: marketCommands });
  const themesCommands = createThemesCommands({ store });
  const syncThemes = createThemesOrchestrator({ provider: createThemesProvider({ read: legacy.readThemes }), commands: themesCommands });
  const entityCommands = createEntityCommands({ store });
  const syncEntity = createEntityOrchestrator({ provider: createEntityProvider({ read: legacy.readEntity }), commands: entityCommands });
  const portfolioCommands = createPortfolioCommands({ store });
  const portfolioStorage = createStorageGateway({ storage: root?.localStorage, prefix: 'aio' });
  const portfolioVault = createPrivacyVault({ storage: portfolioStorage, key: 'portfolio', consent: () => root?._portfolioVaultConsent === true });
  const syncPortfolio = createPortfolioOrchestrator({ provider: createPortfolioProvider({ read: legacy.readPortfolio, repository: portfolioVault }), commands: portfolioCommands });
  const screenerCommands = createScreenerCommands({ store });
  // ARX-04 first slice: screener's provider fetches public-data/screener.json directly through
  // the platform httpClient gateway instead of projecting legacy's SCREENER_DB global — see
  // src/data/providers/screener.js. This is additive (legacy's own fetch/_aioApplyServerScreener
  // and SCREENER_DB stay exactly as they were); nothing currently renders from this native slice
  // (RM-01 stripped src/ui/pages/screener.js down to a dataset marker), so there is no blast
  // radius to the live screener page.
  const syncScreener = createScreenerOrchestrator({ provider: createScreenerProvider({ httpClient }), commands: screenerCommands });
  const analysisCommands = createAnalysisCommands({ store });
  const syncAnalysis = createAnalysisOrchestrator({ provider: createAnalysisProvider({ read: legacy.readAnalysis }), commands: analysisCommands });

  const modules = {};
  modules.guide = createGuidePage({ documentRef });
  modules['market-news'] = createNewsPage({ root, documentRef, store, route: 'market-news' });
  modules.briefing = createNewsPage({ root, documentRef, store, route: 'briefing' });
  modules.macro = createMarketSlicePage({ documentRef, store, route: 'macro' });
  modules.fxbond = createMarketSlicePage({ documentRef, store, route: 'fxbond' });
  modules.breadth = createMarketSlicePage({ documentRef, store, route: 'breadth' });
  modules.themes = createThemesPage({ documentRef, store, route: 'themes' });
  modules['theme-detail'] = createThemesPage({ documentRef, store, route: 'theme-detail' });
  modules.sentiment = createSentimentPage({ documentRef, evidenceStore, store, chartFactory: () => root?.Chart });
  modules.ticker = createEntityPage({ documentRef, store, route: 'ticker' });
  modules.fundamental = createEntityPage({ documentRef, store, route: 'fundamental' });
  modules.options = createEntityPage({ documentRef, store, route: 'options' });
  modules.portfolio = createPortfolioPage({ documentRef, store });
  modules.screener = createScreenerPage({ documentRef, store });
  modules.home = createAnalysisPage({ documentRef, store, route: 'home' });
  modules.signal = createAnalysisPage({ documentRef, store, route: 'signal' });
  modules.technical = createAnalysisPage({ documentRef, store, route: 'technical' });
  const router = createLifecycleRouter({ root: eventTarget, registry: createRouteRegistry({ modules }), context: { store, evidenceStore, legacy, clock } });

  function start() {
    syncSentimentProjection();
    syncNews.sync();
    syncMarket.sync();
    syncThemes.sync();
    syncEntity.sync();
    syncPortfolio.sync();
    syncScreener.sync();
    syncAnalysis.sync();
    // RM-02: aio:liveQuotes previously ran 6 independent listeners (one dispatch each,
    // any of which could be redundant if quotes ticked again before the previous
    // dispatch's subscribers finished reacting). Coalesce them into one microtask-
    // batched flush: repeated aio:liveQuotes firings before the microtask runs collapse
    // into a single pass over all 6 syncs instead of one pass per firing.
    const flushLiveQuoteSyncs = coalesceMicrotask(() => {
      syncSentimentProjection();
      syncMarket.sync();
      syncThemes.sync();
      syncEntity.sync();
      syncPortfolio.sync();
      syncAnalysis.sync();
    });
    const stopQuotes = legacy.on('aio:liveQuotes', flushLiveQuoteSyncs);
    const stopRefresh = legacy.on('aio:refresh:done', syncSentimentProjection);
    const stopHistory = legacy.on('aio:historyLoaded', syncSentimentProjection);
    const stopSentiment = legacy.on('aio:sentimentUpdated', syncSentimentProjection);
    const stopNews = legacy.on('aio:newsUpdated', syncNews.sync);
    const stopMarketRefresh = legacy.on('aio:refresh:done', syncMarket.sync);
    const stopMarketSnapshot = legacy.on('aio:marketSnapshot', syncMarket.sync);
    const stopThemesRefresh = legacy.on('aio:refresh:done', syncThemes.sync);
    const stopEntityRefresh = legacy.on('aio:refresh:done', syncEntity.sync);
    const stopEntityShown = legacy.on('aio:pageShown', syncEntity.sync);
    const stopPortfolioShown = legacy.on('aio:pageShown', syncPortfolio.sync);
    const stopScreenerRefresh = legacy.on('aio:refresh:done', syncScreener.sync);
    const stopScreenerShown = legacy.on('aio:pageShown', syncScreener.sync);
    const stopAnalysisRefresh = legacy.on('aio:refresh:done', syncAnalysis.sync);
    const stopAnalysisShown = legacy.on('aio:pageShown', syncAnalysis.sync);
    const stopShown = legacy.on('aio:pageShown', (event) => {
      const detail = event?.detail;
      const route = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
      if (route) store.dispatch({ type: 'route/changed', payload: route });
    });
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
      stopThemesRefresh();
      stopEntityRefresh();
      stopEntityShown();
      stopPortfolioShown();
      stopScreenerRefresh();
      stopScreenerShown();
      stopAnalysisRefresh();
      stopAnalysisShown();
      stopShown();
      router.dispose();
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
    getEvidence: (metric) => metric ? evidenceStore.get(metric) : evidenceStore.snapshot(),
    getMarketSnapshot: () => marketSnapshot,
    getSentimentSummary: () => selectSentimentSummary(store.getState()),
    ingestSentiment,
    getAIContext: (metrics = ['fearGreed', 'vix']) => buildEvidenceContext({ evidenceStore, metrics, retriever: aiRetriever })
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
