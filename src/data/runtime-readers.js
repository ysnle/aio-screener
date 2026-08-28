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

function parseTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function latestIso(values = []) {
  const timestamps = values.map(parseTime).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function oldestIso(values = []) {
  const timestamps = values.map(parseTime).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
}

function lastSeriesObservedAt(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[rows.length - 1] || {};
  return row.observedAt || row.date || row.time || row.timestamp || null;
}

function quoteObservation(root, symbol) {
  const row = root?._liveData?.[symbol] || {};
  const envelope = row.quoteEnvelope || {};
  const value = finite(row.price ?? envelope.price);
  const directionValue = finite(row.pct ?? envelope.pct);
  const changeBasis = row.changeBasis || row.valueBasis || envelope.changeBasis || envelope.valueBasis || 'unknown';
  return {
    value,
    pct: directionValue,
    directionValue,
    observedAt: observedAt(row) || envelope.observedAt || null,
    fetchedAt: row.fetchedAt || envelope.fetchedAt || null,
    source: row.source || envelope.source || 'unavailable',
    sourceKind: value == null ? 'unavailable' : String(row.source || envelope.source || '').startsWith('snapshot') ? 'snapshot' : 'runtime-quote',
    revision: row.revision || envelope.revision || null,
    changeBasis,
    directionCompatible: directionValue != null && changeBasis !== 'unknown',
    directionReason: directionValue == null ? 'quote-change-missing' : changeBasis === 'unknown' ? 'quote-change-basis-unknown' : null
  };
}

function coverageObservation(rows, { emptyAllowed = false, fallbackObservedAt = null, source = 'runtime-coverage' } = {}) {
  const values = Array.isArray(rows) ? rows : [];
  if (!values.length && emptyAllowed) {
    return { value: 0, directionValue: 0, observedAt: fallbackObservedAt, source, sourceKind: 'local-state', changeBasis: 'not-applicable-empty', directionCompatible: true };
  }
  const usable = values.filter((row) => finite(row?.price ?? row?.quote?.value ?? row?.pct ?? row?.quote?.pct) != null && (row?.quoteObservedAt || row?.observedAt || row?.quote?.observedAt));
  const bases = new Set(usable.map((row) => row?.changeBasis || row?.quote?.changeBasis || 'unknown'));
  const revisions = new Set(usable.map((row) => row?.revision || row?.quote?.revision).filter(Boolean));
  const observedTimes = usable.map((row) => row?.quoteObservedAt || row?.observedAt || row?.quote?.observedAt);
  const directionValues = usable.map((row) => finite(row?.dailyPct ?? row?.pct ?? row?.quote?.pct ?? row?.quote?.directionValue)).filter((value) => value != null);
  const coverage = values.length ? usable.length / values.length : 0;
  const compatible = coverage >= 0.6 && bases.size === 1 && !bases.has('unknown') && revisions.size <= 1 && directionValues.length >= Math.ceil(values.length * 0.6);
  return {
    value: coverage,
    directionValue: directionValues.length ? directionValues.reduce((sum, value) => sum + value, 0) / directionValues.length : null,
    observedAt: oldestIso(observedTimes),
    fetchedAt: latestIso(usable.map((row) => row?.fetchedAt || row?.quote?.fetchedAt)),
    source,
    sourceKind: coverage ? 'runtime-quote-set' : 'unavailable',
    revision: revisions.size === 1 ? [...revisions][0] : null,
    changeBasis: bases.size === 1 ? [...bases][0] : 'mixed',
    directionCompatible: compatible,
    directionReason: compatible ? null : `coverage=${coverage.toFixed(2)},bases=${[...bases].join('|') || 'none'},revisions=${revisions.size}`
  };
}

function hySpreadObservation(root, snapshot = {}) {
  const evidence = root?._serverMacroEvidence?.hyOAS || root?._serverDataMeta?.hyOAS || {};
  const value = finite(root?._hySpreadBp) ?? finite(snapshot.hySpread);
  const source = evidence.source || root?._hySpreadSource || snapshot._hySpreadSource || 'DATA_SNAPSHOT';
  const sourceKind = evidence.sourceKind
    || (String(source).includes('last-known-good') || value == null ? (value == null ? 'unavailable' : 'snapshot') : 'official-primary');
  return {
    value,
    observedAt: evidence.observedAt || root?._hySpreadDate || snapshot._fieldTs?.hySpread || snapshot._snapshotDate || snapshot._updated || null,
    fetchedAt: evidence.fetchedAt || null,
    source,
    sourceKind,
    allowedUse: value == null ? 'none' : evidence.allowedUse || (sourceKind === 'official-primary' ? 'reference' : 'reference')
  };
}

const SCREENER_FACTOR_FIELD_IDS = Object.freeze([
  'price.ret1m', 'price.ret3m', 'price.ret6m', 'price.volatility', 'price.rsi14',
  'price.pctSma50', 'price.pctSma200', 'technical.kalmanVelocity',
  'technical.kalmanConfidence', 'technical.vcpScore', 'technical.vcpStage',
  'technical.ema8', 'technical.ema21', 'technical.ema60'
]);
const SCREENER_FUNDAMENTAL_FIELD_IDS = Object.freeze([
  'valuation.pe', 'valuation.pb', 'valuation.evEbitda', 'quality.roe', 'quality.margin', 'quality.revGrowth'
]);

function screenerObservationCoverage(rows, fieldIds, { now = Date.now(), maxAgeMs, minCoverage = 0.8, source } = {}) {
  const values = Array.isArray(rows) ? rows : [];
  const observations = [];
  values.forEach((row) => {
    const byId = new Map((Array.isArray(row?.fieldObservations) ? row.fieldObservations : []).map((item) => [item?.fieldId, item]));
    fieldIds.forEach((fieldId) => {
      const item = byId.get(fieldId);
      if (item?.value == null || item.value === '' || !item?.observedAt) return;
      const observedMs = parseTime(item.observedAt);
      if (observedMs == null) return;
      observations.push({ ...item, observedMs, current: maxAgeMs == null || (now - observedMs >= 0 && now - observedMs <= maxAgeMs) });
    });
  });
  const expected = values.length * fieldIds.length;
  const presentCoverage = expected ? observations.length / expected : 0;
  const current = observations.filter((item) => item.current);
  const currentCoverage = expected ? current.length / expected : 0;
  const available = currentCoverage >= minCoverage;
  return {
    value: currentCoverage,
    available,
    observedAt: oldestIso(current.map((item) => item.observedAt)),
    fetchedAt: latestIso(current.map((item) => item.fetchedAt)),
    source: source || 'screener-field-observations',
    sourceKind: available ? 'field-observation-set' : 'partial-field-observation-set',
    reason: available ? null : `currentCoverage=${currentCoverage.toFixed(3)},presentCoverage=${presentCoverage.toFixed(3)},required=${minCoverage.toFixed(3)}`,
    coverage: { current: currentCoverage, present: presentCoverage, expected, currentCount: current.length, observedCount: observations.length }
  };
}

export function buildRuntimeObservationCatalog({ root = globalThis, state = {}, now = Date.now() } = {}) {
  const meta = root?._serverDataMeta || {};
  const snapshot = root?.DATA_SNAPSHOT || {};
  const catalog = {};
  Object.keys(root?._liveData || {}).forEach((symbol) => { catalog[`market.${symbol}`] = quoteObservation(root, symbol); });
  const canonicalFearGreed = root?.AIO?.getCanonicalMetric?.('fg') || null;
  catalog['sentiment.fearGreed'] = {
    value: finite(canonicalFearGreed?.value) ?? finite(root?._lastFG) ?? finite(snapshot.fg),
    observedAt: canonicalFearGreed?.asOf || canonicalFearGreed?.observedAt || root?._lastFGMeta?.sourceTs || snapshot._updated || snapshot._snapshotDate || null,
    fetchedAt: meta.generatedAt || null,
    source: canonicalFearGreed?.source || root?._lastFGMeta?.sourceLabel || 'DATA_SNAPSHOT:fear-greed',
    sourceKind: canonicalFearGreed?.sourceKind || root?._lastFGMeta?.sourceKind || 'snapshot',
    allowedUse: canonicalFearGreed?.decisionUse === true ? 'decision' : 'reference',
    allowedUseCeiling: root?._lastFGMeta?.allowedUseCeiling || 'reference'
  };
  const putCall = root?._lastPutCallPayload || {};
  catalog['sentiment.putCall'] = {
    value: finite(root?._putCallRatio) ?? finite(putCall.totalPutCall) ?? finite(snapshot.pcr),
    observedAt: putCall.asOf || putCall.tradeDate || meta.putCallAsOf || null,
    fetchedAt: putCall.fetchedAt || meta.generatedAt || null,
    source: putCall.sourceLabel || putCall.source || 'CBOE options volume daily',
    sourceKind: putCall.sourceKind || 'delayed'
  };
  catalog['sentiment.hySpread'] = hySpreadObservation(root, snapshot);
  const breadth = state?.screener?.metadata?.breadth || root?.AIO_ARCH?.getScreenerState?.()?.metadata?.breadth || null;
  for (const market of ['us', 'kr']) {
    const segment = breadth?.segments?.[market] || null;
    catalog[`breadth.${market}`] = {
      value: finite(segment?.coveragePct),
      directionValue: finite(segment?.advanceRatio),
      observedAt: segment?.observedAt || null,
      fetchedAt: state?.screener?.updatedAt || null,
      source: breadth?.source || 'public-data/screener.json',
      sourceKind: segment ? 'server-artifact' : 'unavailable',
      changeBasis: 'same-universe-advance-decline',
      directionCompatible: finite(segment?.advanceRatio) != null
    };
  }
  const historyRows = Array.isArray(root?._aioHistory) ? root._aioHistory : Array.isArray(root?._historyData) ? root._historyData : [];
  catalog['breadth.history'] = {
    value: historyRows.filter((row) => finite(row?.breadth50) != null || finite(row?.advanceDecline) != null).length,
    observedAt: lastSeriesObservedAt(historyRows),
    source: 'public-data/history.json',
    sourceKind: 'server-history'
  };
  const newsItems = state?.news?.items || root?._allNewsItems || [];
  catalog['news.completedCycle'] = {
    value: Array.isArray(newsItems) ? newsItems.length : 0,
    observedAt: meta.newsCycleEnd || null,
    fetchedAt: meta.generatedAt || null,
    source: 'public-data/data.json:news',
    sourceKind: meta.newsCycleEnd ? 'server-artifact' : 'unavailable',
    revision: meta.cycleId || null
  };
  const screenerState = state?.screener || {};
  catalog['screener.snapshot'] = {
    value: Array.isArray(screenerState.rows) ? screenerState.rows.length : 0,
    observedAt: screenerState.metadata?.factorObservedAt || null,
    fetchedAt: screenerState.metadata?.asOf || screenerState.updatedAt || null,
    source: screenerState.metadata?.source || 'public-data/screener.json',
    sourceKind: screenerState.status || 'unavailable',
    revision: screenerState.revision || null
  };
  const screenerRows = Array.isArray(screenerState.rows) ? screenerState.rows : [];
  catalog['screener.factorCoverage'] = {
    ...screenerObservationCoverage(screenerRows, SCREENER_FACTOR_FIELD_IDS, { now, maxAgeMs: 4 * 86400000, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:factor` }),
    revision: screenerState.revision || null
  };
  catalog['screener.fundamentalCoverage'] = {
    ...screenerObservationCoverage(screenerRows, SCREENER_FUNDAMENTAL_FIELD_IDS, { now, maxAgeMs: 180 * 86400000, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:fundamental` }),
    revision: screenerState.revision || null
  };
  catalog['screener.newsCoverage'] = {
    ...screenerObservationCoverage(screenerRows, ['news.latest'], { now, maxAgeMs: 2 * 86400000, minCoverage: 0.1, source: `field-registry:${screenerState.metadata?.fieldRegistryVersion || 'unknown'}:news` }),
    revision: screenerState.revision || null
  };
  const ranking = screenerState.metadata?.ranking || {};
  const rankingCurrent = !!ranking.available
    && ranking.inputVersion === screenerState.revision
    && Number(ranking.ranked) >= Math.ceil(screenerRows.length * 0.8)
    && screenerState.lastRun?.snapshotId === screenerState.snapshotId;
  catalog['screener.rankingEpoch'] = {
    value: Number(ranking.ranked) || 0,
    available: rankingCurrent,
    observedAt: screenerState.metadata?.factorObservedAt || null,
    fetchedAt: screenerState.metadata?.asOf || screenerState.updatedAt || null,
    source: `${ranking.modelVersion || 'factor-ranks'}:${screenerState.lastRun?.engineVersion || 'screen-engine'}`,
    sourceKind: rankingCurrent ? 'derived-current-snapshot' : 'derived-revision-mismatch',
    revision: ranking.inputVersion || null,
    reason: rankingCurrent ? null : `input=${ranking.inputVersion || 'missing'},state=${screenerState.revision || 'missing'},ranked=${Number(ranking.ranked) || 0},snapshot=${screenerState.lastRun?.snapshotId || 'missing'}|${screenerState.snapshotId || 'missing'}`
  };
  const visibleSymbols = [...(root?.document?.querySelectorAll?.('#screener-results-body [data-aio-screener-ticker]') || [])]
    .map((node) => String(node?.dataset?.aioScreenerTicker || '').toUpperCase()).filter(Boolean);
  const visibleQuotes = visibleSymbols.map((symbol) => {
    const quote = quoteObservation(root, symbol);
    return { price: quote.value, observedAt: quote.observedAt, fetchedAt: quote.fetchedAt, revision: quote.revision, changeBasis: quote.changeBasis, dailyPct: quote.directionValue };
  });
  catalog['screener.visibleQuotes'] = coverageObservation(visibleQuotes, { source: 'screener-visible-runtime-quotes' });
  const entity = state?.entity || {};
  const entityQuote = entity.quote || quoteObservation(root, entity.id || root?._currentTickerId || root?._currentTickerSym || '');
  catalog['entity.quote'] = {
    value: finite(entityQuote?.value), directionValue: finite(entityQuote?.pct ?? entityQuote?.directionValue),
    observedAt: entityQuote?.observedAt || null, fetchedAt: entityQuote?.fetchedAt || null,
    source: entityQuote?.source || 'unavailable', sourceKind: entityQuote?.sourceKind || 'runtime-quote',
    revision: entityQuote?.revision || null, changeBasis: entityQuote?.changeBasis || 'unknown',
    directionCompatible: entityQuote?.directionCompatible !== false && !!entityQuote?.changeBasis && entityQuote.changeBasis !== 'unknown'
  };
  const entityHistory = Array.isArray(entity.history) ? entity.history : [];
  catalog['entity.history'] = { value: entityHistory.length, observedAt: lastSeriesObservedAt(entityHistory), source: 'ticker-history', sourceKind: entityHistory.length ? 'runtime-history' : 'unavailable' };
  catalog['technical.history'] = { ...catalog['entity.history'], source: 'technical-ohlcv' };
  const fundamentals = entity.fundamentals || null;
  catalog['entity.fundamental'] = { value: fundamentals?.coverage?.length || (fundamentals ? 1 : 0), observedAt: fundamentals?.observedAt || fundamentals?.filedAt || null, fetchedAt: fundamentals?.fetchedAt || null, source: fundamentals?.source || 'SEC EDGAR', sourceKind: fundamentals ? 'official-regulator' : 'unavailable' };
  const holdings = Array.isArray(state?.portfolio?.holdings) ? state.portfolio.holdings : [];
  catalog['portfolio.quoteCoverage'] = coverageObservation(holdings, { emptyAllowed: true, fallbackObservedAt: state?.portfolio?.updatedAt || meta.generatedAt || null, source: 'portfolio-holding-quotes' });
  const themeItems = Array.isArray(state?.themes?.items) ? state.themes.items : [];
  catalog['themes.quoteCoverage'] = coverageObservation(themeItems, { source: 'theme-universe-quotes' });
  const detailQuotes = Object.values(state?.themes?.selectedDetail?.quotes || {}).map((quote) => ({ quote }));
  catalog['themeDetail.quoteCoverage'] = coverageObservation(detailQuotes, { source: 'theme-detail-quotes' });
  const macroRecord = (key, valueKey = key) => {
    const evidence = root?._serverMacroEvidence?.[key] || {};
    return { value: finite(snapshot[valueKey]), observedAt: evidence.observedAt || null, fetchedAt: evidence.fetchedAt || null, source: evidence.source || snapshot[`_${key}_src`] || 'DATA_SNAPSHOT', sourceKind: evidence.source ? 'official-primary' : 'snapshot' };
  };
  catalog['macro.cpi'] = macroRecord('cpi');
  catalog['macro.pce'] = macroRecord('pce');
  catalog['macro.employment'] = macroRecord('unemployment');
  catalog['macro.fedRate'] = macroRecord('fedRate');
  return Object.freeze(catalog);
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
    const hySpread = hySpreadObservation(root, snapshot);
    return Object.freeze({
      fearGreed: fg,
      fearGreedSourceKind: canonical?.sourceKind || root?._lastFGMeta?.sourceKind || (fg == null ? 'unavailable' : 'snapshot'),
      fearGreedSource: canonical?.source || canonical?.sourceLabel || root?._lastFGMeta?.sourceLabel || 'DATA_SNAPSHOT:fear-greed',
      fearGreedObservedAt: canonical?.asOf || canonical?.observedAt || root?._lastFGMeta?.sourceTs || snapshot._updated || snapshot._snapshotDate || null,
      fearGreedAllowedUse: canonical?.decisionUse === true ? 'decision' : (root?._lastFGMeta?.allowedUse || 'reference'),
      fearGreedAllowedUseCeiling: root?._lastFGMeta?.allowedUseCeiling || 'reference',
      vix9d: finite(quote('^VIX9D').price), vix9dObservedAt: observedAt(quote('^VIX9D')),
      vix: finite(quote('^VIX').price), vixObservedAt: observedAt(quote('^VIX')),
      vix3m: finite(quote('^VIX3M').price), vix3mObservedAt: observedAt(quote('^VIX3M')),
      vix6m: finite(quote('^VIX6M').price), vix6mObservedAt: observedAt(quote('^VIX6M')),
      putCall: finite(root?._putCallRatio) ?? finite(putCall.totalPutCall) ?? finite(snapshot.pcr),
      putCallSourceKind: putCall.sourceKind || (root?._putCallRatio != null ? 'delayed' : 'snapshot'),
      putCallSource: putCall.sourceLabel || (root?._putCallRatio != null ? 'CBOE options volume daily' : 'DATA_SNAPSHOT'),
      putCallObservedAt: putCall.asOf || putCall.tradeDate || snapshot._snapshotDate || snapshot._updated || null,
      hySpread: hySpread.value,
      hySpreadSourceKind: hySpread.sourceKind,
      hySpreadSource: hySpread.source,
      hySpreadDate: hySpread.observedAt,
      hySpreadFetchedAt: hySpread.fetchedAt,
      hySpreadAllowedUse: hySpread.allowedUse,
      aaiiBear: finite(snapshot.aaiiBear), aaiiBull: finite(snapshot.aaiiBull),
      aaiiObservedAt: snapshot._fieldTs?.aaii || root?._serverDataMeta?.marketSurveys?.aaii?.observedAt || null,
      vixHistory: Array.isArray(root?._vixHistory) ? root._vixHistory.slice(-30).map((point) => ({ date: point?.date || null, value: finite(point?.value) })) : [],
      now: isoNow()
    });
  };

  const readMarket = () => {
    const snapshot = readSnapshot();
    const symbols = ['CL=F', 'GC=F', '^TNX', 'DX-Y.NYB', 'KRW=X', 'JPY=X', 'HYG', '^GSPC', '^IXIC', 'SPY', 'QQQ'];
    const quotes = Object.fromEntries(symbols.map((symbol) => [symbol, quoteObservation(root, symbol)]));
    const metrics = {};
    ['fedRate', 'cpi', 'coreCpi', 'pce', 'corePce', 'unemployment', 'nfp', 'consConf', 'breadth5sma', 'breadth20sma', 'breadth50sma', 'breadthAdvanceRatio'].forEach((key) => { metrics[key] = finite(snapshot[key]); });
    const observationTimes = Object.values(quotes).map((row) => row.observedAt);
    return Object.freeze({ quotes, metrics, updatedAt: latestIso([snapshot._updated, ...observationTimes]), observationStart: oldestIso(observationTimes), observationEnd: latestIso(observationTimes) });
  };

  const readNews = () => Array.isArray(root?._allNewsItems) ? root._allNewsItems.slice() : [];

  const readEntity = () => {
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const quote = id ? quoteObservation(root, id) : null;
    const pcr = root?._lastPutCallPayload || {};
    const snapshot = readSnapshot();
    const optionQuote = (symbol) => {
      const item = quoteObservation(root, symbol);
      return { ...item, sourceKind: item.value == null ? 'unavailable' : 'live' };
    };
    return Object.freeze({
      id,
      name: id ? String(root?._currentTickerName || id) : null,
      quote,
      history: id ? clone(root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || []) : [],
      // Fundamentals are replaced by the SEC provider in createEntityProvider.
      fundamentals: null,
      options: { vix: optionQuote('^VIX'), pcr: { value: finite(root?._putCallRatio) ?? finite(pcr.totalPutCall) ?? finite(snapshot.pcr), observedAt: pcr.asOf || pcr.tradeDate || snapshot._snapshotDate || null, source: pcr.sourceLabel || 'DATA_SNAPSHOT', sourceKind: pcr.sourceKind || 'snapshot' }, skew: optionQuote('^SKEW') },
      updatedAt: latestIso([quote?.observedAt, lastSeriesObservedAt(id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : []), pcr.asOf || pcr.tradeDate])
    });
  };

  const readPortfolio = () => {
    try {
      const state = typeof root?.getPortfolioState === 'function' ? clone(root.getPortfolioState()) : clone(root?._portfolioState) || {};
      const positions = Array.isArray(state?.holdings) && state.holdings.length ? state.holdings : typeof root?.getPortfolioData === 'function' ? root.getPortfolioData() : [];
      const live = readLive();
      const holdings = Array.isArray(positions) ? positions.map((position) => {
        const symbol = String(position?.ticker || position?.symbol || position?.sym || '').toUpperCase();
        const shares = Number(position?.qty ?? position?.shares);
        const avgCost = Number(position?.cost ?? position?.avgCost);
        const quote = live[symbol] || {};
        const price = Number(quote.price);
        return { symbol, shares: Number.isFinite(shares) ? shares : null, avgCost: Number.isFinite(avgCost) ? avgCost : null, price: Number.isFinite(price) && price > 0 ? price : null, dailyPct: finite(quote.pct), quoteObservedAt: observedAt(quote), fetchedAt: quote.fetchedAt || quote.quoteEnvelope?.fetchedAt || null, revision: quote.revision || quote.quoteEnvelope?.revision || null, changeBasis: quote.changeBasis || quote.valueBasis || quote.quoteEnvelope?.changeBasis || 'unknown', sector: position?.sector || null, target: finite(Number(position?.target)), memo: position?.memo || '', addedAt: position?.addedAt || null, updatedAt: position?.updatedAt || null, source: quote.source || 'native-runtime-vault' };
      }).filter((item) => item.symbol) : [];
      return { ...state, holdings, cash: state?.cash ?? null, totals: state?.totals ?? null, privacy: state?.privacy || 'opt-in', status: holdings.length ? 'current' : 'empty', updatedAt: latestIso([...holdings.map((row) => row.quoteObservedAt), state?.updatedAt]) || null };
    } catch (_) { return { holdings: [], privacy: 'opt-in', status: 'unavailable', updatedAt: null }; }
  };

  const readAnalysis = () => {
    const live = readLive();
    const id = String(root?._currentTickerId || root?._currentTickerSym || '').trim().toUpperCase() || null;
    const history = id ? root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || [] : [];
    const sentiment = readSentiment();
    const market = readMarket();
    const health = typeof root?.AIO?.getMarketHealth === 'function' ? root.AIO.getMarketHealth() : null;
    const technicalHealth = health || (typeof root?.computeMarketHealth === 'function' ? root.computeMarketHealth({ quotes: live, spxMA: root?._spxMA || {}, spxATH: root?._spxATH }) : null);
    return Object.freeze({ inputVersion: readSnapshot()._updated || readSnapshot()._snapshotDate || 'native-runtime', technical: { symbol: id, ohlcv: clone(history), health: technicalHealth }, sentiment: { fearGreed: sentiment.fearGreed, vix: sentiment.vix }, market: market.metrics, tradingScoreInputs: decisionInputs(root, now()), newsCount: readNews().length, updatedAt: latestIso([lastSeriesObservedAt(history), sentiment.fearGreedObservedAt, sentiment.vixObservedAt, market.updatedAt]) });
  };

  const readScreener = () => ({ rows: Array.isArray(root?._aioScreenerRows) ? clone(root._aioScreenerRows) : [], revision: root?._aioScreenerLoadState?.revision || null, updatedAt: root?._aioScreenerLoadState?.asOf || null });

  const readObservationCatalog = (state = {}) => buildRuntimeObservationCatalog({ root, state, now: now() });
  return Object.freeze({ readSentiment, readMarket, readNews, readEntity, readPortfolio, readAnalysis, readScreener, readObservationCatalog });
}
