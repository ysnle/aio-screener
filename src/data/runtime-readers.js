// Native runtime readers.  These readers are deliberately kept in the data
// layer so route providers do not depend on the legacy compatibility facade.
// The legacy shell still owns the mutable runtime globals, but the native data
// contract now has one explicit, read-only boundary for every route slice.

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function observedAt(row = {}) {
  return row.observedAt || row.timestamp || row.lastUpdated
    || (String(row.source || '').startsWith('snapshot:') ? row.ts : null)
    || null;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) {}
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function decisionInputs(root, nowMs = Date.now()) {
  let rows = [];
  try { rows = root?.AIO?.getTradingDecisionInputEvidence?.()?.rows || []; } catch (_) {}
  const byId = new Map(rows.map((row) => [row.id, row]));
  const currentRow = (id) => {
    const row = byId.get(id);
    return row && row.status === 'verified_current' && row.decisionUse === 'trading' ? row : null;
  };
  const value = (id) => finite(currentRow(id)?.value);
  const input = {
    vix: value('vix-price'),
    vvix: value('vvix-price'),
    dxy: value('dxy-dollar'),
    tnx: value('tnx-yield'),
    oilPrice: value('oil-price'),
    fg: value('fg-sentiment'),
    spxPrice: value('spx-price'),
    spx50ma: null,
    spx200ma: null,
    breadth200: value('breadth200-participation'),
    pcr: value('pcr-putcall'),
    hyBp: value('hy-spread-bp')
  };
  // MA values are not part of the generic critical-input registry, but the
  // legacy fetcher stamps them with a freshness timestamp and source.  Only
  // promote them when that timestamp is inside the same four-day decision SLA.
  const maTs = Number(root?._spxMATs);
  const maCurrent = Number.isFinite(maTs) && nowMs - maTs >= 0 && nowMs - maTs <= 4 * 24 * 60 * 60 * 1000;
  const maEvidence = {};
  if (maCurrent) {
    for (const [key, period] of [['spx50ma', 50], ['spx200ma', 200]]) {
      const value = finite(root?._spxMA?.[period]);
      if (value != null) {
        input[key] = value;
        maEvidence[key] = { value, source: root?._spxMASource || 'native-runtime-ma', status: 'verified_current', allowedUse: 'decision', observedAt: new Date(maTs).toISOString() };
      }
    }
  }
  const evidenceKeys = {
    vix: 'vix-price', vvix: 'vvix-price', dxy: 'dxy-dollar', tnx: 'tnx-yield',
    oilPrice: 'oil-price', fg: 'fg-sentiment', spxPrice: 'spx-price',
    breadth200: 'breadth200-participation', pcr: 'pcr-putcall', hyBp: 'hy-spread-bp'
  };
  const decisionEvidence = {};
  Object.entries(evidenceKeys).forEach(([key, id]) => {
    const row = byId.get(id);
    decisionEvidence[key] = row
      ? { value: finite(row.value), source: row.source || 'unknown', status: row.status || 'unavailable', allowedUse: row.status === 'verified_current' && row.decisionUse === 'trading' ? 'decision' : 'reference', observedAt: row.observedAt || null }
      : { value: null, source: 'unavailable', status: 'unavailable', allowedUse: 'blocked', observedAt: null };
  });
  Object.assign(decisionEvidence, maEvidence);
  input.decisionEvidence = decisionEvidence;
  try { input.newsSentimentScore = finite(root?.computeNewsSentimentScore?.()?.score); } catch (_) { input.newsSentimentScore = null; }
  try { input.newsRiskSignals = root?.computeNewsRiskSignals?.() || []; } catch (_) { input.newsRiskSignals = []; }
  return input;
}

export function createRuntimeReaders({ root = globalThis, now = () => Date.now() } = {}) {
  const readLive = () => root?._liveData && typeof root._liveData === 'object' ? root._liveData : {};
  const readSnapshot = () => root?.DATA_SNAPSHOT && typeof root.DATA_SNAPSHOT === 'object' ? root.DATA_SNAPSHOT : {};
  const isoNow = () => new Date(now()).toISOString();

  const readSentiment = () => {
    const live = readLive();
    const snapshot = readSnapshot();
    const canonical = typeof root?.AIO?.getCanonicalMetric === 'function' ? root.AIO.getCanonicalMetric('fg') : null;
    const fg = finite(canonical?.value) ?? finite(root?._lastFG) ?? finite(snapshot.fg);
    const putCall = root?._lastPutCallPayload || {};
    const quote = (symbol) => live[symbol] || {};
    return Object.freeze({
      fearGreed: fg,
      fearGreedSourceKind: canonical?.sourceKind || root?._lastFGMeta?.sourceKind || (fg == null ? 'unavailable' : 'snapshot'),
      fearGreedSource: canonical?.source || canonical?.sourceLabel || root?._lastFGMeta?.sourceLabel || 'DATA_SNAPSHOT:fear-greed',
      fearGreedObservedAt: canonical?.asOf || canonical?.observedAt || root?._lastFGMeta?.sourceTs || snapshot._updated || snapshot._snapshotDate || null,
      vix9d: finite(quote('^VIX9D').price), vix9dObservedAt: observedAt(quote('^VIX9D')),
      vix: finite(quote('^VIX').price), vixObservedAt: observedAt(quote('^VIX')),
      vix3m: finite(quote('^VIX3M').price), vix3mObservedAt: observedAt(quote('^VIX3M')),
      vix6m: finite(quote('^VIX6M').price), vix6mObservedAt: observedAt(quote('^VIX6M')),
      putCall: finite(root?._putCallRatio) ?? finite(putCall.totalPutCall) ?? finite(snapshot.pcr),
      putCallSourceKind: putCall.sourceKind || (root?._putCallRatio != null ? 'delayed' : 'snapshot'),
      putCallSource: putCall.sourceLabel || (root?._putCallRatio != null ? 'CBOE options volume daily' : 'DATA_SNAPSHOT'),
      putCallObservedAt: putCall.asOf || putCall.tradeDate || snapshot._snapshotDate || snapshot._updated || null,
      hySpread: finite(root?._hySpreadBp) ?? finite(snapshot.hySpread),
      hySpreadSourceKind: root?._hySpreadBp != null ? 'fred' : 'snapshot',
      hySpreadSource: root?._hySpreadBp != null ? 'FRED BAMLH0A0HYM2' : 'DATA_SNAPSHOT',
      hySpreadDate: root?._hySpreadDate || snapshot._snapshotDate || snapshot._updated || null,
      aaiiBear: finite(snapshot.aaiiBear), aaiiBull: finite(snapshot.aaiiBull),
      vixHistory: Array.isArray(root?._vixHistory) ? root._vixHistory.slice(-30).map((point) => ({ date: point?.date || null, value: finite(point?.value) })) : [],
      now: isoNow()
    });
  };

  const readMarket = () => {
    const live = readLive();
    const snapshot = readSnapshot();
    const symbols = ['CL=F', 'GC=F', '^TNX', 'DX-Y.NYB', 'KRW=X', 'JPY=X', 'HYG', '^GSPC', '^IXIC', 'SPY', 'QQQ'];
    const quotes = Object.fromEntries(symbols.map((symbol) => {
      const row = live[symbol] || {};
      return [symbol, { value: finite(row.price), pct: finite(row.pct), observedAt: observedAt(row), source: row.source || 'native-runtime-live' }];
    }));
    const metrics = {};
    ['fedRate', 'cpi', 'coreCpi', 'pce', 'corePce', 'unemployment', 'nfp', 'consConf', 'breadth5sma', 'breadth20sma', 'breadth50sma', 'breadthAdvanceRatio'].forEach((key) => { metrics[key] = finite(snapshot[key]); });
    return Object.freeze({ quotes, metrics, updatedAt: snapshot._updated || isoNow() });
  };

  const readNews = () => Array.isArray(root?._allNewsItems) ? root._allNewsItems.slice() : [];

  const readEntity = () => {
    const live = readLive();
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const row = id ? live[id] || {} : {};
    const quote = id ? { value: finite(row.price), pct: finite(row.pct), observedAt: observedAt(row), source: row.source || 'native-runtime-live' } : null;
    const pcr = root?._lastPutCallPayload || {};
    const snapshot = readSnapshot();
    const optionQuote = (symbol) => {
      const item = live[symbol] || {};
      const value = finite(item.price);
      return { value, pct: finite(item.pct), observedAt: observedAt(item), source: item.source || 'native-runtime-live', sourceKind: value == null ? 'unavailable' : 'live' };
    };
    return Object.freeze({
      id,
      name: id ? String(root?._currentTickerName || id) : null,
      quote,
      history: id ? clone(root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || []) : [],
      // Fundamentals are replaced by the SEC provider in createEntityProvider.
      fundamentals: null,
      options: { vix: optionQuote('^VIX'), pcr: { value: finite(root?._putCallRatio) ?? finite(pcr.totalPutCall) ?? finite(snapshot.pcr), observedAt: pcr.asOf || pcr.tradeDate || snapshot._snapshotDate || null, source: pcr.sourceLabel || 'DATA_SNAPSHOT', sourceKind: pcr.sourceKind || 'snapshot' }, skew: optionQuote('^SKEW') },
      updatedAt: isoNow()
    });
  };

  const readPortfolio = () => {
    try {
      if (typeof root?.getPortfolioState === 'function') return clone(root.getPortfolioState()) || {};
      if (root?._portfolioState && typeof root._portfolioState === 'object') return clone(root._portfolioState) || {};
      const positions = typeof root?.getPortfolioData === 'function' ? root.getPortfolioData() : [];
      const live = readLive();
      const holdings = Array.isArray(positions) ? positions.map((position) => {
        const symbol = String(position?.ticker || position?.symbol || position?.sym || '').toUpperCase();
        const shares = Number(position?.qty ?? position?.shares);
        const avgCost = Number(position?.cost ?? position?.avgCost);
        const quote = live[symbol] || {};
        const price = Number(quote.price);
        return { symbol, shares: Number.isFinite(shares) ? shares : null, avgCost: Number.isFinite(avgCost) ? avgCost : null, price: Number.isFinite(price) && price > 0 ? price : null, dailyPct: finite(quote.pct), sector: position?.sector || null, target: finite(Number(position?.target)), memo: position?.memo || '', addedAt: position?.addedAt || null, updatedAt: position?.updatedAt || null, source: 'native-runtime-vault' };
      }).filter((item) => item.symbol) : [];
      return { holdings, cash: null, totals: null, privacy: 'opt-in', status: holdings.length ? 'current' : 'empty', updatedAt: isoNow() };
    } catch (_) { return { holdings: [], privacy: 'opt-in', status: 'unavailable', updatedAt: isoNow() }; }
  };

  const readAnalysis = () => {
    const live = readLive();
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const history = id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : [];
    const sentiment = readSentiment();
    const market = readMarket();
    const health = typeof root?.AIO?.getMarketHealth === 'function' ? root.AIO.getMarketHealth() : null;
    const technicalHealth = health || (typeof root?.computeMarketHealth === 'function' ? root.computeMarketHealth({ quotes: live, spxMA: root?._spxMA || {}, spxATH: root?._spxATH }) : null);
    return Object.freeze({ inputVersion: readSnapshot()._updated || readSnapshot()._snapshotDate || 'native-runtime', technical: { symbol: id, ohlcv: clone(history), health: technicalHealth }, sentiment: { fearGreed: sentiment.fearGreed, vix: sentiment.vix }, market: market.metrics, tradingScoreInputs: decisionInputs(root, now()), newsCount: readNews().length, updatedAt: isoNow() });
  };

  const readScreener = () => ({ rows: Array.isArray(root?._aioScreenerRows) ? clone(root._aioScreenerRows) : [], revision: root?._aioScreenerLoadState?.revision || null, updatedAt: root?._aioScreenerLoadState?.asOf || isoNow() });

  return Object.freeze({ readSentiment, readMarket, readNews, readEntity, readPortfolio, readAnalysis, readScreener });
}
