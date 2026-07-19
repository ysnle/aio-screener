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

function readLegacy(root) {
  const live = root?._liveData || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const canonicalFg = typeof root?.AIO?.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
  const fgMeta = root?._lastFGMeta || {};
  const fg = finite(canonicalFg?.value) ?? finite(root?._lastFG) ?? finite(snapshot.fg);
  const quote = (symbol) => finite(live[symbol]?.price);
  const quoteObservedAt = (symbol) => live[symbol]?.observedAt || live[symbol]?.timestamp || live[symbol]?.lastUpdated || null;
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
    vix9dObservedAt: quoteObservedAt('^VIX9D'),
    vix: quote('^VIX'),
    vixObservedAt: quoteObservedAt('^VIX'),
    vix3m: quote('^VIX3M'),
    vix3mObservedAt: quoteObservedAt('^VIX3M'),
    vix6m: quote('^VIX6M'),
    vix6mObservedAt: quoteObservedAt('^VIX6M'),
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
    observedAt: live[symbol]?.observedAt || live[symbol]?.timestamp || live[symbol]?.lastUpdated || null,
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
  const sources = [root?.RRG_SECTORS, root?.RRG_SUBSECTORS, root?.ALL_RRG_ETFS].filter(Array.isArray).flat();
  const seen = new Set();
  const items = sources.filter((item) => {
    const id = String(item?.id || item?.sym || item?.symbol || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((item) => {
    const symbol = String(item?.sym || item?.symbol || item?.id || '');
    return {
      id: String(item?.id || symbol),
      symbol,
      label: item?.name || item?.label || symbol,
      pct: finite(live[symbol]?.pct),
      rsRatio: finite(item?.rsRatio),
      rsMomentum: finite(item?.rsMomentum),
      quadrant: item?.quadrant || 'neutral',
      source: item?.source || 'legacy-rrg'
    };
  });
  return Object.freeze({ items, selectedId: root?._currentThemeId || null, updatedAt: new Date().toISOString() });
}

function readEntity(root) {
  const live = root?._liveData || {};
  const fundamentals = root?._fundAnalysisData || null;
  const id = String(root?._currentTickerId || root?._currentTickerSym || fundamentals?.ticker || '').trim().toUpperCase() || null;
  const liveQuote = id ? live[id] || {} : {};
  const quote = id ? {
    value: finite(liveQuote.price),
    pct: finite(liveQuote.pct),
    observedAt: liveQuote.observedAt || liveQuote.timestamp || liveQuote.lastUpdated || null,
    source: liveQuote.source || 'legacy-live-data'
  } : null;
  const options = root?._optionsAnalysisData || root?._optionsData || null;
  return Object.freeze({
    id,
    quote,
    fundamentals: fundamentals ? clone(fundamentals) : null,
    options: options ? clone(options) : null,
    updatedAt: fundamentals?._ts ? new Date(fundamentals._ts).toISOString() : new Date().toISOString()
  });
}

function readPortfolio(root) {
  try {
    if (typeof root?.getPortfolioState === 'function') return clone(root.getPortfolioState()) || {};
  } catch (_) {}
  return clone(root?._portfolioState || root?._portfolioData || { holdings: [], privacy: 'opt-in' }) || {};
}

function readScreener(root) {
  const rows = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : Array.isArray(root?._aioScreenerRows) ? root._aioScreenerRows : [];
  const metadata = root?._serverDataMeta?.screener || root?._aioScreenerLoadState || {};
  return Object.freeze({ rows: clone(rows), revision: metadata.revision || metadata.generatedAt || null, updatedAt: metadata.asOf || metadata.generatedAt || new Date().toISOString() });
}

function readAnalysis(root) {
  const snapshot = root?.DATA_SNAPSHOT || {};
  const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
  const technicalHistory = id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : [];
  const sentiment = readLegacy(root);
  const market = readMarket(root);
  return Object.freeze({
    inputVersion: snapshot._updated || snapshot._snapshotDate || 'legacy-runtime',
    technical: { symbol: id, ohlcv: clone(technicalHistory) },
    sentiment: { fearGreed: sentiment.fearGreed, vix: sentiment.vix },
    market: market.metrics,
    newsCount: Array.isArray(root?._allNewsItems) ? root._allNewsItems.length : 0,
    updatedAt: new Date().toISOString()
  });
}

export function createLegacyFacade(root = globalThis, eventTarget = root?.document || root) {
  let originalShowPage = null;
  let installedNavigation = null;

  function installNavigation(router) {
    if (installedNavigation?.router === router) return installedNavigation;
    const candidate = root?.showPage;
    if (typeof candidate !== 'function' || candidate.__aioArchitectureNavigation) {
      return Object.freeze({ installed: false, router, restore: () => {} });
    }
    originalShowPage = candidate;
    const facade = function architectureShowPage(pageId, ...args) {
      const result = originalShowPage.apply(this, [pageId, ...args]);
      router?.transition?.(pageId, { source: 'architecture-navigation', args });
      return result;
    };
    Object.defineProperty(facade, '__aioArchitectureNavigation', { value: true, enumerable: false });
    try {
      root.showPage = facade;
    } catch (_) {
      return Object.freeze({ installed: false, router, restore: () => {} });
    }
    const restore = () => {
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
    readAnalysis: () => readAnalysis(root),
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

export function exposeArchitecture(root, api) {
  if (!root || !api) return;
  Object.defineProperty(root, 'AIO_ARCH', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      status: 'MIGRATION_IN_PROGRESS',
      version: api.version,
       getState: api.getState,
       getEvidence: api.getEvidence,
       getMarketSnapshot: api.getMarketSnapshot,
      getSentimentSummary: api.getSentimentSummary,
      ingestSentiment: api.ingestSentiment,
      getAIContext: api.getAIContext,
      navigate: api.navigate,
      router: api.router
    })
  });
}
