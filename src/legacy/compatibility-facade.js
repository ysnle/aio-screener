import { computeMarketHealth } from '../domain/market/health.js';
import { SCREENER_ROW_INTENT, resolveScreenerRows } from '../data/screener-row-policy.js';
import { createRuntimeReaders } from '../data/runtime-readers.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  return JSON.parse(JSON.stringify(value));
}

function readonlySnapshot(value) {
  const snapshot = clone(value);
  const freeze = (node) => {
    if (!node || typeof node !== 'object' || Object.isFrozen(node)) return node;
    Object.values(node).forEach(freeze);
    return Object.freeze(node);
  };
  return freeze(snapshot);
}

// Quote timestamps are a shared compatibility boundary for every legacy
// projection.  Keep the snapshot-only `ts` fallback explicit so a live quote
// without an observation timestamp is never presented as current.
function readQuoteObservedAt(live, symbol) {
  const row = live?.[symbol] || {};
  return row.observedAt || row.timestamp || row.lastUpdated
    || (String(row.source || '').startsWith('snapshot:') ? row.ts : null)
    || null;
}

function readLegacy(root) {
  const live = root?._liveData || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const canonicalFg = typeof root?.AIO?.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
  const fgMeta = root?._lastFGMeta || {};
  const fg = finite(canonicalFg?.value) ?? finite(root?._lastFG) ?? finite(snapshot.fg);
  const quote = (symbol) => finite(live[symbol]?.price);
  const payload = root?._lastPutCallPayload || {};
  const vixHistory = Array.isArray(root?._vixHistory) ? root._vixHistory.slice(-30).map((point) => ({
    date: point?.date || null,
    value: finite(point?.value)
  })) : [];
  return Object.freeze({
    fearGreed: fg,
    fearGreedSourceKind: canonicalFg?.sourceKind || fgMeta.sourceKind || (fg == null ? 'unavailable' : 'snapshot'),
    fearGreedSource: canonicalFg?.source || canonicalFg?.sourceLabel || fgMeta.sourceLabel || 'DATA_SNAPSHOT:fear-greed',
    fearGreedObservedAt: canonicalFg?.asOf || canonicalFg?.observedAt || fgMeta.sourceTs || snapshot._updated || snapshot._snapshotDate || null,
    vix9d: quote('^VIX9D'),
    vix9dObservedAt: readQuoteObservedAt(live, '^VIX9D'),
    vix: quote('^VIX'),
    vixObservedAt: readQuoteObservedAt(live, '^VIX'),
    vix3m: quote('^VIX3M'),
    vix3mObservedAt: readQuoteObservedAt(live, '^VIX3M'),
    vix6m: quote('^VIX6M'),
    vix6mObservedAt: readQuoteObservedAt(live, '^VIX6M'),
    putCall: finite(root?._putCallRatio) ?? finite(payload.totalPutCall) ?? finite(snapshot.pcr),
    putCallSourceKind: payload.sourceKind || (root?._putCallRatio != null ? 'delayed' : 'snapshot'),
    putCallSource: payload.sourceLabel || (root?._putCallRatio != null ? 'CBOE options volume daily' : 'DATA_SNAPSHOT'),
    putCallObservedAt: payload.asOf || payload.tradeDate || snapshot._snapshotDate || snapshot._updated || null,
    hySpread: finite(root?._hySpreadBp) ?? finite(snapshot.hySpread),
    hySpreadSourceKind: root?._hySpreadBp != null ? 'fred' : 'snapshot',
    hySpreadSource: root?._hySpreadBp != null ? 'FRED BAMLH0A0HYM2' : 'DATA_SNAPSHOT',
    hySpreadDate: root?._hySpreadDate || snapshot._snapshotDate || snapshot._updated || null,
    aaiiBear: finite(snapshot.aaiiBear),
    aaiiBull: finite(snapshot.aaiiBull),
    aaiiObservedAt: snapshot._fieldTs?.aaii || root?._serverDataMeta?.marketSurveys?.aaii?.observedAt || null,
    vixHistory,
    now: new Date().toISOString()
  });
}

function readMarket(root) {
  const live = root?._liveData || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const symbols = ['CL=F', 'GC=F', '^TNX', 'DX-Y.NYB', 'KRW=X', 'JPY=X', 'HYG', '^GSPC', '^IXIC', 'SPY', 'QQQ'];
  const quotes = Object.fromEntries(symbols.map((symbol) => [symbol, {
    value: finite(live[symbol]?.price),
    pct: finite(live[symbol]?.pct),
    observedAt: readQuoteObservedAt(live, symbol),
    source: live[symbol]?.source || 'legacy-live-data'
  }]));
  const metrics = {};
  ['fedRate', 'cpi', 'coreCpi', 'pce', 'corePce', 'unemployment', 'nfp', 'consConf', 'breadth5sma', 'breadth20sma', 'breadth50sma', 'breadthAdvanceRatio'].forEach((key) => {
    metrics[key] = finite(snapshot[key]);
  });
  return Object.freeze({ quotes, metrics, updatedAt: snapshot._updated || new Date().toISOString() });
}

function readThemes(root) {
  const live = root?._liveData || {};
  const sources = [
    ...(Array.isArray(root?.RRG_SECTORS) ? root.RRG_SECTORS.map((item) => ({ ...item, view: 'sectors' })) : []),
    ...(Array.isArray(root?.RRG_SUBSECTORS) ? root.RRG_SUBSECTORS.map((item) => ({ ...item, view: 'subsectors' })) : [])
  ];
  const seen = new Set();
  const items = sources.filter((item) => {
    const id = String(item?.id || item?.sym || item?.symbol || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((item) => {
    const symbol = String(item?.sym || item?.symbol || item?.id || '');
    const history = root?._priceHistory?.[symbol] || null;
    const benchmarkHistory = root?._priceHistory?.SPY || null;
    const rotation = typeof root?.AIO_ARCH?.computeRelativeRotation === 'function'
      ? root.AIO_ARCH.computeRelativeRotation({
          history,
          benchmarkHistory,
          hasQuote: !!live[symbol],
          hasBenchmarkQuote: !!live.SPY
        })
      : null;
    const dailyPct = live[symbol]?.pct ?? (
      Array.isArray(history) && history.length > 1 && Number(history[history.length - 2]) > 0
        ? ((Number(history[history.length - 1]) / Number(history[history.length - 2])) - 1) * 100
        : null
    );
    return {
      id: String(item?.id || symbol),
      symbol,
      label: item?.name || item?.label || symbol,
      pct: finite(dailyPct),
      rsRatio: finite(rotation?.rsRatio ?? item?.rsRatio),
      rsMomentum: finite(rotation?.rsMom ?? item?.rsMomentum),
      quadrant: rotation?.quadrant || item?.quadrant || 'neutral',
      view: item?.view || 'sectors',
      source: rotation?.modelVersion ? `legacy-rrg:${rotation.modelVersion}` : (item?.source || 'legacy-rrg')
    };
  });
  const selectedId = root?._currentThemeId || null;
  const themeDefinitions = Array.isArray(root?.THEME_MAP)
    ? root.THEME_MAP
    : (root?.THEME_MAP && typeof root.THEME_MAP === 'object' ? Object.values(root.THEME_MAP) : []);
  const selectedTheme = themeDefinitions.find((theme) => String(theme?.id || '') === String(selectedId || '')) || null;
  let selectedDetail = null;
  if (selectedTheme) {
    const quotePct = (symbol) => finite(live?.[symbol]?.pct);
    const etfPct = selectedTheme.etf ? quotePct(selectedTheme.etf) : null;
    const basePct = selectedTheme.compositeBase ? quotePct(selectedTheme.compositeBase) : null;
    const leaderPcts = (selectedTheme.leaders || []).map(quotePct).filter((value) => value != null);
    const weightEntries = selectedTheme.weights && typeof selectedTheme.weights === 'object'
      ? Object.entries(selectedTheme.weights)
      : [];
    const weightedPcts = weightEntries
      .map(([symbol, weight]) => ({ pct: quotePct(symbol), weight: Number(weight) }))
      .filter((row) => row.pct != null && Number.isFinite(row.weight) && row.weight > 0);
    const weightTotal = weightedPcts.reduce((sum, row) => sum + row.weight, 0);
    const weightedPct = weightTotal > 0
      ? weightedPcts.reduce((sum, row) => sum + row.pct * row.weight, 0) / weightTotal
      : null;
    const pct = etfPct ?? basePct ?? weightedPct ?? (
      leaderPcts.length ? leaderPcts.reduce((sum, value) => sum + value, 0) / leaderPcts.length : null
    );
    const source = etfPct != null ? selectedTheme.etf
      : basePct != null ? selectedTheme.compositeBase
      : weightedPct != null ? 'weighted-leaders'
      : leaderPcts.length ? 'leader-average' : 'quote-missing';
    const detailSymbols = new Set();
    [selectedTheme.etf, selectedTheme.compositeBase, ...(selectedTheme.leaders || []), ...(selectedTheme.leaderHighlight || [])].forEach((symbol) => {
      if (symbol) detailSymbols.add(String(symbol));
    });
    (selectedTheme.subThemes || []).forEach((sub) => {
      if (sub?.etf) detailSymbols.add(String(sub.etf));
      (sub?.tickers || []).forEach((symbol) => detailSymbols.add(String(symbol)));
    });
    const quotes = Object.fromEntries([...detailSymbols].map((symbol) => [symbol, {
      price: finite(live[symbol]?.price),
      pct: finite(live[symbol]?.pct)
    }]));
    const pricedLeaders = (selectedTheme.leaders || []).map((symbol) => live[symbol]).filter((quote) => quote && quote.price && quote.pct != null && Number.isFinite(Number(quote.pct))); // P1575
    const breadth = pricedLeaders.length >= Math.max(2, Math.ceil((selectedTheme.leaders || []).length * 0.6))
      ? Math.round(pricedLeaders.filter((quote) => Number(quote.pct) > 0).length / pricedLeaders.length * 100)
      : null;
    selectedDetail = {
      id: String(selectedTheme.id || selectedId),
      label: String(selectedTheme.nameKr || selectedTheme.name || selectedTheme.id || selectedId),
      etf: selectedTheme.etf || null,
      pct: finite(pct),
      breadth: finite(breadth),
      source,
      quotes,
      leaders: Array.isArray(selectedTheme.leaders) ? selectedTheme.leaders.slice() : [],
      leaderHighlight: Array.isArray(selectedTheme.leaderHighlight) ? selectedTheme.leaderHighlight.slice() : [],
      subThemes: Array.isArray(selectedTheme.subThemes) ? selectedTheme.subThemes.map((sub) => ({
        name: sub?.name,
        tickers: Array.isArray(sub?.tickers) ? sub.tickers.slice() : [],
        etf: sub?.etf || null,
        weights: sub?.weights && typeof sub.weights === 'object' ? { ...sub.weights } : null
      })) : []
    };
  }
  return Object.freeze({ items, selectedId, selectedDetail, updatedAt: new Date().toISOString() });
}

function readEntity(root) {
  const live = root?._liveData || {};
  const fundamentals = root?._fundAnalysisData || null;
  const id = String(root?._currentTickerId || root?._currentTickerSym || fundamentals?.ticker || '').trim().toUpperCase() || null;
  const liveQuote = id ? live[id] || {} : {};
  const quote = id ? {
    value: finite(liveQuote.price),
    pct: finite(liveQuote.pct),
    observedAt: liveQuote.observedAt || liveQuote.timestamp || liveQuote.lastUpdated || (String(liveQuote.source || '').startsWith('snapshot:') ? liveQuote.ts : null) || null,
    source: liveQuote.source || 'legacy-live-data'
  } : null;
  const legacyOptions = root?._optionsAnalysisData || root?._optionsData || null;
  const optionQuote = (symbol) => {
    const row = live[symbol] || {};
    const value = finite(row.price);
    return {
      value,
      pct: finite(row.pct),
      observedAt: row.observedAt || row.timestamp || row.lastUpdated || (String(row.source || '').startsWith('snapshot:') ? row.ts : null) || null,
      source: row.source || 'legacy-live-data',
      sourceKind: value == null ? 'unavailable' : 'live'
    };
  };
  const pcrPayload = root?._lastPutCallPayload || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const pcrValue = finite(root?._putCallRatio) ?? finite(pcrPayload.totalPutCall) ?? finite(snapshot.pcr);
  const options = {
    ...(legacyOptions ? clone(legacyOptions) : {}),
    vix: optionQuote('^VIX'),
    pcr: {
      value: pcrValue,
      observedAt: pcrPayload.asOf || pcrPayload.tradeDate || snapshot._snapshotDate || snapshot._updated || null,
      source: pcrPayload.sourceLabel || (pcrValue == null ? 'unavailable' : 'DATA_SNAPSHOT'),
      sourceKind: pcrValue == null ? 'unavailable' : (pcrPayload.sourceKind || (root?._putCallRatio != null ? 'delayed' : 'snapshot'))
    },
    skew: optionQuote('^SKEW')
  };
  return Object.freeze({
    id,
    name: id ? String(root?._currentTickerName || id) : null,
    quote,
    fundamentals: fundamentals ? clone(fundamentals) : null,
    options: options ? clone(options) : null,
    updatedAt: fundamentals?._ts ? new Date(fundamentals._ts).toISOString() : new Date().toISOString()
  });
}

// E0/P1280 (P-A): the facade's second Vault mapping is retired. It dropped
// targetWeight, the declared quote/cost currencies, cash/base currency, ledger,
// FX legs and the locked/failed read states, so every consumer behind this
// surface could see a different portfolio than the native one. One reader owns
// the mapping (`createRuntimeReaders().readPortfolio`) and the shadow-diff gate
// in ci-esm-core-unit-check keeps the two surfaces byte-identical by construction.
function readPortfolio(root) {
  return createRuntimeReaders({ root }).readPortfolio();
}

function readScreener(root) {
  // E2/S-C (P1241): the row chain is no longer written here. `resolveScreenerRows` owns it and this
  // reader declares the evidence intent — it never substitutes the bundled legacy DB, and the s-b
  // retired global is no longer reachable from this path.
  const rows = resolveScreenerRows(root, SCREENER_ROW_INTENT.EVIDENCE);
  const metadata = root?._serverDataMeta?.screener || root?._aioScreenerLoadState || {};
  return Object.freeze({ rows: clone(rows), revision: metadata.revision || metadata.generatedAt || null, updatedAt: metadata.asOf || metadata.generatedAt || new Date().toISOString() });
}

export function createLegacyFacade(root = globalThis, eventTarget = root?.document || root) {
  let originalShowPage = null;
  let installedNavigation = null;

  function installNavigation(router) {
    if (installedNavigation?.router === router) return installedNavigation;
    const candidate = root?.showPage;
    if (typeof candidate !== 'function' || candidate.__aioArchitectureNavigation) {
      return Object.freeze({ installed: candidate?.__aioArchitectureNavigation === true, router, restore: () => {} });
    }
    originalShowPage = candidate;
    const facade = function architectureShowPage(pageId, ...args) {
      // E0/P1279: capture the last committed route BEFORE the legacy side effects run.
      const previousRoute = router?.active?.() || null;
      const result = originalShowPage.apply(this, [pageId, ...args]);
      // W00-A: the typed command owns identity — DOM args never become entity ids.
      const canonicalRoute = root?.AIO_ROUTE_REGISTRY?.canonical?.[pageId] || pageId;
      const explicitEntity = args.find((arg) => typeof arg === 'string' && arg.trim() && !/^[<>]/.test(arg.trim())) || null;
      try {
        router?.transition?.(canonicalRoute, { source: 'architecture-navigation', entityId: explicitEntity });
      } catch (transitionError) {
        // E0/P1279: the legacy shell has already painted the new page when the router
        // mount throws, and the router resets its active state on that throw. Leaving
        // it that way showed users a page whose router never committed. Roll the shell
        // and the commit back through the same typed boundary and report the failure as
        // observation — a failed navigation must be visible, never a split surface.
        let rolledBack = false;
        try {
          if (previousRoute) {
            originalShowPage.call(this, previousRoute);
            router?.transition?.(previousRoute, { source: 'navigation-rollback' });
            rolledBack = router?.active?.() === previousRoute;
          }
        } catch (_) {
          rolledBack = false;
        }
        const EventConstructor = globalThis.CustomEvent;
        if (typeof EventConstructor === 'function' && typeof eventTarget?.dispatchEvent === 'function') {
          eventTarget.dispatchEvent(new EventConstructor('aio:navigationFailed', {
            detail: {
              routeId: canonicalRoute,
              rolledBack,
              message: String(transitionError?.message || transitionError)
            }
          }));
        }
        return false;
      }
      return result;
    };
    Object.defineProperty(facade, '__aioArchitectureNavigation', { value: true, enumerable: false });
    try {
      root.showPage = facade;
    } catch (_) {
      // Some embedded/static hosts expose the classic global as a non-writable
      // property.  The router already listens to aio:pageShown from that
      // function, so retain the original callable and mark the compatibility
      // boundary instead of falsely reporting that navigation is absent.
      try { Object.defineProperty(candidate, '__aioArchitectureNavigation', { value: true, configurable: true }); } catch (_) {}
      return Object.freeze({ installed: candidate.__aioArchitectureNavigation === true, router, restore: () => {} });
    }
    // W00/P1143: hand the single transition authority to this typed facade. The
    // router must not also transition on the aio:pageShown event it caused.
    router?.claimNavigationAuthority?.();
    const restore = () => {
      // A host without a writable global keeps the event path, so only a facade
      // that actually owned navigation releases the authority.
      router?.releaseNavigationAuthority?.();
      if (root.showPage === facade) {
        try { root.showPage = originalShowPage; } catch (_) {}
      }
      if (installedNavigation?.router === router) installedNavigation = null;
    };
    installedNavigation = Object.freeze({ installed: true, router, restore });
    return installedNavigation;
  }

  return Object.freeze({
    readSentiment: () => readLegacy(root),
    readMarket: () => readMarket(root),
    readThemes: () => readThemes(root),
    readEntity: () => readEntity(root),
    readPortfolio: () => readPortfolio(root),
    readScreener: () => readScreener(root),
    readRoute: () => root?.AIO?.state?.activePage || null,
    readVersion: () => root?.APP_VERSION || root?.AIO?.APP_VERSION || null,
    installNavigation,
    navigate: (route, ...args) => {
      if (typeof root?.showPage === 'function') return root.showPage(route, ...args);
      return false;
    },
    on: (eventName, listener) => {
      if (typeof eventTarget?.addEventListener !== 'function') return () => {};
      eventTarget.addEventListener(eventName, listener);
      return () => eventTarget.removeEventListener(eventName, listener);
    }
  });
}

export function exposeArchitecture(root, api, { immutableState = false } = {}) {
  if (!root || !api) return;
  const snapshotCall = (fn) => (...args) => readonlySnapshot(typeof fn === 'function' ? fn(...args) : null);
  // Only the canonical structural-sharing store opts in. Time-sensitive evidence
  // selectors and arbitrary legacy readers still create fresh snapshots.
  const stateSnapshotCall = (fn) => {
    if (!immutableState) return snapshotCall(fn);
    let hasSnapshot = false;
    let previous;
    let snapshot;
    return (...args) => {
      const value = typeof fn === 'function' ? fn(...args) : null;
      if (hasSnapshot && value === previous) return snapshot;
      const nextSnapshot = readonlySnapshot(value);
      previous = value;
      snapshot = nextSnapshot;
      hasSnapshot = true;
      return snapshot;
    };
  };
  Object.defineProperty(root, 'AIO_ARCH', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      status: 'MIGRATION_IN_PROGRESS',
      version: api.version,
       getState: stateSnapshotCall(api.getState),
       getSuppliedMaterialsReference: snapshotCall(api.getSuppliedMaterialsReference),
       getSuppliedMaterialClaimIds: snapshotCall(api.getSuppliedMaterialClaimIds),
       getScreenerRows: stateSnapshotCall(api.getScreenerRows),
       getScreenerState: stateSnapshotCall(api.getScreenerState),
       // E2/S-C (P1241): the classic legacy bundle cannot import the policy module, so the declared
       // intent is bridged here. This is the only legacy entry point into the shared resolver.
       resolveScreenerRows: (intent) => resolveScreenerRows(root, intent),
       getEvidence: snapshotCall(api.getEvidence),
       selectForDecision: snapshotCall(api.selectForDecision),
       selectForDisplay: snapshotCall(api.selectForDisplay),
       selectLastKnown: snapshotCall(api.selectLastKnown),
       selectCompleteness: snapshotCall(api.selectCompleteness),
       getMarketSnapshot: snapshotCall(api.getMarketSnapshot),
       getRuntimeObservationCatalog: snapshotCall(api.getRuntimeObservationCatalog),
       getCanonicalMarketRevision: snapshotCall(api.getCanonicalMarketRevision),
       getPageDataTimelineState: snapshotCall(api.getPageDataTimelineState),
       getPageDataTimelineAudit: snapshotCall(api.getPageDataTimelineAudit),
       getPageDataTimelineContracts: snapshotCall(api.getPageDataTimelineContracts),
       getSentimentSummary: snapshotCall(api.getSentimentSummary),
      ingestSentiment: api.ingestSentiment,
       getAIContext: api.getAIContext,
       getAIOrchestrator: api.getAIOrchestrator,
       planAIQuestion: api.planAIQuestion,
       classifyAIConduct: api.classifyAIConduct,
       buildScopedConductFallback: api.buildScopedConductFallback,
       getAIConductPolicy: api.getAIConductPolicy,
         executeAIQuestion: api.executeAIQuestion,
         analyzeAIQuestion: api.analyzeAIQuestion,
         validateAIResearch: api.validateAIResearch,
          getAIResearchCapability: api.getAIResearchCapability,
          validateAIResearchCapability: api.validateAIResearchCapability,
          createAIResearchEvidenceDocument: api.createAIResearchEvidenceDocument,
          normalizeAIResearchExecutionResult: api.normalizeAIResearchExecutionResult,
          evaluateAIResearchEvidenceFloor: api.evaluateAIResearchEvidenceFloor,
           parseAIAnswerPlan: api.parseAIAnswerPlan,
           renderAIAnswerPlan: api.renderAIAnswerPlan,
       navigate: api.navigate,
      router: api.router,
      computeTradingScoreModel: api.computeTradingScoreModel,
      signalScoreMode: Object.freeze({ get: api.getSignalScoreMode, set: api.setSignalScoreMode, describe: api.describeSignalScoreMode }),
      computeRelativeRotation: api.computeRelativeRotation,
      classifyMovingAverageStructure: api.classifyMovingAverageStructure,
      deriveMultiTimeframeView: api.deriveMultiTimeframeView,
      computeNewsSentimentScore: api.computeNewsSentimentScore,
      computeNewsRiskSignals: api.computeNewsRiskSignals,
      MIN_NEWS_ANALYSIS_SAMPLE: api.MIN_NEWS_ANALYSIS_SAMPLE,
      classifyBreadthParticipation: api.classifyBreadthParticipation,
      deriveTreasuryCurveEvidence: api.deriveTreasuryCurveEvidence,
      deriveConcentrationRisk: api.deriveConcentrationRisk,
      concentrationPenaltyForWeight: api.concentrationPenaltyForWeight,
      computeFactorRanks: api.computeFactorRanks,
      deriveFactorWeights: api.deriveFactorWeights
       ,computeMarketHealth: api.computeMarketHealth
       ,getVerticalSliceContract: api.getVerticalSliceContract
       ,getVerticalSliceContracts: api.getVerticalSliceContracts
       ,auditVerticalSliceContracts: api.auditVerticalSliceContracts
       ,capabilityManifestVersion: api.capabilityManifestVersion
       ,getCapability: api.getCapability
       ,getCapabilityManifest: api.getCapabilityManifest
       ,auditCapabilityClaims: api.auditCapabilityClaims
     })
  });
}
