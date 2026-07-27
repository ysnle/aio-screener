import { computeMarketHealth } from '../domain/market/health.js';

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
    const pricedLeaders = (selectedTheme.leaders || []).map((symbol) => live[symbol]).filter((quote) => quote && quote.price);
    const breadth = pricedLeaders.length >= Math.max(2, Math.ceil((selectedTheme.leaders || []).length * 0.6))
      ? Math.round(pricedLeaders.filter((quote) => Number(quote.pct || 0) > 0).length / pricedLeaders.length * 100)
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
    observedAt: liveQuote.observedAt || liveQuote.timestamp || liveQuote.lastUpdated || null,
    source: liveQuote.source || 'legacy-live-data'
  } : null;
  const legacyOptions = root?._optionsAnalysisData || root?._optionsData || null;
  const optionQuote = (symbol) => {
    const row = live[symbol] || {};
    const value = finite(row.price);
    return {
      value,
      pct: finite(row.pct),
      observedAt: row.observedAt || row.timestamp || row.lastUpdated || null,
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

function readPortfolio(root) {
  try {
    if (typeof root?.getPortfolioState === 'function') return clone(root.getPortfolioState()) || {};
  } catch (_) {}
  const existing = root?._portfolioState || root?._portfolioData;
  if (existing && (Array.isArray(existing.holdings) || existing.totals)) return clone(existing) || {};
  try {
    const positions = typeof root?.getPortfolioData === 'function' ? root.getPortfolioData() : [];
    const liveData = root?._liveData || {};
    const holdings = Array.isArray(positions) ? positions.map((position) => {
      const symbol = String(position?.ticker || position?.symbol || position?.sym || '').toUpperCase();
      const shares = Number(position?.qty ?? position?.shares);
      const avgCost = Number(position?.cost ?? position?.avgCost);
      const live = liveData[symbol] || {};
      const price = Number(live.price ?? live.regularMarketPrice);
      const dailyPct = Number(live.pct ?? live.regularMarketChangePercent);
      const validShares = Number.isFinite(shares) ? shares : null;
      const validAvgCost = Number.isFinite(avgCost) ? avgCost : null;
      const validPrice = Number.isFinite(price) && price > 0 ? price : null;
      return {
        symbol,
        shares: validShares,
        avgCost: validAvgCost,
        price: validPrice,
        value: validPrice != null && validShares != null ? validPrice * validShares : null,
        dailyPct: Number.isFinite(dailyPct) ? dailyPct : null,
        sector: position?.sector ? String(position.sector) : null,
        target: Number.isFinite(Number(position?.target)) ? Number(position.target) : null,
        memo: position?.memo ? String(position.memo) : '',
        addedAt: position?.addedAt || null,
        updatedAt: position?.updatedAt || null,
        source: validPrice != null ? 'legacy-vault+live-quote' : 'legacy-vault'
      };
    }).filter((holding) => holding.symbol) : [];
    const totalValue = holdings.reduce((sum, holding) => sum + (Number.isFinite(holding.value) ? holding.value : 0), 0);
    const totalCost = holdings.reduce((sum, holding) => sum + (Number.isFinite(holding.shares) && Number.isFinite(holding.avgCost) ? holding.shares * holding.avgCost : 0), 0);
    let cash = null;
    try {
      const storedCash = Number(root?.localStorage?.getItem?.('aio_portfolio_cash'));
      cash = Number.isFinite(storedCash) && storedCash >= 0 ? storedCash : null;
    } catch (_) {}
    const dailyChange = holdings.reduce((sum, holding) => sum + (Number.isFinite(holding.value) && Number.isFinite(holding.dailyPct) ? holding.value * holding.dailyPct / 100 : 0), 0);
    return { holdings, cash, totals: { totalValue: totalValue || null, totalAssets: totalValue + (cash || 0) || null, totalCost: totalCost || null, totalPnl: totalValue && totalCost ? totalValue - totalCost : null, dailyChange: dailyChange || null }, privacy: 'opt-in', status: holdings.length ? 'current' : 'empty', updatedAt: new Date().toISOString() };
  } catch (_) {
    return { holdings: [], privacy: 'opt-in', status: 'unavailable' };
  }
}

function readScreener(root) {
  const nativeRows = typeof root?.AIO_ARCH?.getScreenerRows === 'function' ? root.AIO_ARCH.getScreenerRows() : null;
  const rows = Array.isArray(nativeRows) && nativeRows.length
    ? nativeRows
    : Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : Array.isArray(root?._aioScreenerRows) ? root._aioScreenerRows : [];
  const metadata = root?._serverDataMeta?.screener || root?._aioScreenerLoadState || {};
  return Object.freeze({ rows: clone(rows), revision: metadata.revision || metadata.generatedAt || null, updatedAt: metadata.asOf || metadata.generatedAt || new Date().toISOString() });
}

function readTradingScoreInputs(root) {
  const live = root?._liveData || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const freshnessPolicy = root?.FRESHNESS_POLICY?.static_snapshot || {};
  const hardStaleMs = Number(freshnessPolicy.hardStaleMs) || 7 * 24 * 60 * 60 * 1000;
  const snapshotTs = Date.parse(String(snapshot._updated || snapshot._snapshotDate || ''));
  const snapshotUsable = Number.isFinite(snapshotTs) && Date.now() - snapshotTs <= hardStaleMs;
  const snapshotKeys = { '^VIX': 'vix', '^VVIX': 'vvix', '^GSPC': 'spx', '^TNX': 'tnx', 'DX-Y.NYB': 'dxy', 'CL=F': 'wti' };
  const quote = (symbol) => {
    const liveValue = finite(live[symbol]?.price);
    if (liveValue != null) return liveValue;
    const snapshotValue = finite(snapshot[snapshotKeys[symbol]]);
    return snapshotUsable ? snapshotValue : null;
  };
  const closing = (symbol) => {
    const row = live[symbol];
    if (row) return finite(row.chartPreviousClose) ?? finite(row.previousClose) ?? finite(row.price);
    return quote(symbol);
  };
  const evidence = typeof root?.AIO?.getTradingDecisionInputEvidence === 'function'
    ? root.AIO.getTradingDecisionInputEvidence()
    : null;
  const verified = (id) => {
    const row = Array.isArray(evidence?.rows) ? evidence.rows.find((candidate) => candidate.id === id) : null;
    return row?.status === 'verified_current' ? finite(row.value) : null;
  };
  const canonicalFg = typeof root?.AIO?.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
  const breadth = typeof root?.AIO?.getCurrentBreadthEvidence === 'function' ? root.AIO.getCurrentBreadthEvidence() : null;
  const ma = root?._spxMA || {};
  const maTs = finite(root?._spxMATs);
  const maCurrent = ma[50] != null && ma[200] != null && maTs != null && Date.now() - maTs <= 4 * 24 * 60 * 60 * 1000;
  let newsSentimentScore = null;
  let newsRiskSignals = [];
  try {
    if (typeof root?.computeNewsSentimentScore === 'function') newsSentimentScore = finite(root.computeNewsSentimentScore()?.score);
    if (typeof root?.computeNewsRiskSignals === 'function') newsRiskSignals = root.computeNewsRiskSignals() || [];
  } catch (_) {}
  return Object.freeze({
    mode: 'swing',
    vix: quote('^VIX'),
    vvix: quote('^VVIX'),
    dxy: quote('DX-Y.NYB'),
    tnx: quote('^TNX'),
    oilPrice: quote('CL=F'),
    fg: canonicalFg?.allowedUse ? finite(canonicalFg.value) : null,
    maCurrent,
    spx200ma: maCurrent ? finite(ma[200]) : null,
    spx50ma: maCurrent ? finite(ma[50]) : null,
    spxPrice: closing('^GSPC'),
    breadthAvailable: !!breadth?.available,
    breadth200: breadth?.available ? finite(breadth.sma20) : null,
    pcr: verified('pcr-putcall'),
    hyBp: verified('hy-spread-bp'),
    newsSentimentScore,
    newsRiskSignals
  });
}

function readAnalysis(root) {
  const snapshot = root?.DATA_SNAPSHOT || {};
  const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
  const technicalHistory = id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : [];
  const sentiment = readLegacy(root);
  const market = readMarket(root);
  const health = computeMarketHealth({
    quotes: root?._liveData || {},
    spxMA: root?._spxMA || {},
    spxATH: root?._spxATH
  });
  return Object.freeze({
    inputVersion: snapshot._updated || snapshot._snapshotDate || 'legacy-runtime',
    technical: { symbol: id, ohlcv: clone(technicalHistory), health },
    sentiment: { fearGreed: sentiment.fearGreed, vix: sentiment.vix },
    market: market.metrics,
    tradingScoreInputs: readTradingScoreInputs(root),
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
      // P826: showPage('theme-detail') canonicalizes the derived panel to the
      // themes page before emitting aio:pageShown.  Replaying the raw route
      // here would immediately dispose the themes mount and leave the inline
      // native detail panel hidden. Keep the compatibility transition on the
      // same canonical route as the legacy navigation call.
      const canonicalRoute = root?.AIO_ROUTE_REGISTRY?.canonical?.[pageId] || pageId;
      router?.transition?.(canonicalRoute, { source: 'architecture-navigation', args });
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
       getScreenerRows: api.getScreenerRows,
       getScreenerState: api.getScreenerState,
       getEvidence: api.getEvidence,
       getMarketSnapshot: api.getMarketSnapshot,
      getSentimentSummary: api.getSentimentSummary,
      ingestSentiment: api.ingestSentiment,
      getAIContext: api.getAIContext,
      navigate: api.navigate,
      router: api.router,
      computeTradingScoreModel: api.computeTradingScoreModel,
      computeRelativeRotation: api.computeRelativeRotation,
      classifyMovingAverageStructure: api.classifyMovingAverageStructure,
      deriveMultiTimeframeView: api.deriveMultiTimeframeView,
      computeNewsSentimentScore: api.computeNewsSentimentScore,
      computeNewsRiskSignals: api.computeNewsRiskSignals,
      classifyBreadthParticipation: api.classifyBreadthParticipation,
      deriveTreasuryCurveEvidence: api.deriveTreasuryCurveEvidence,
      deriveConcentrationRisk: api.deriveConcentrationRisk,
      concentrationPenaltyForWeight: api.concentrationPenaltyForWeight,
      computeFactorRanks: api.computeFactorRanks,
      deriveFactorWeights: api.deriveFactorWeights
      ,computeMarketHealth: api.computeMarketHealth
    })
  });
}
