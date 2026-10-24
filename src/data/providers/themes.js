import { computeRelativeRotation } from '../../domain/themes/rrg.js';
import { selectProducedRotation } from '../../domain/themes/produced-rotation.js';
import { finiteNumber as finite } from '../../domain/shared/number.js';

function asDefinitions(value) {
  if (!value || typeof value !== 'object') return { sectors: [], subsectors: [], themes: {}, insights: {}, membershipPolicy: null };
  const themes = Array.isArray(value.themes)
    ? value.themes
    : (value.themes && typeof value.themes === 'object' ? value.themes : {});
  return {
    sectors: Array.isArray(value.sectors) ? value.sectors : [],
    subsectors: Array.isArray(value.subsectors) ? value.subsectors : [],
    themes,
    insights: value.insights && typeof value.insights === 'object' ? value.insights : {},
    membershipPolicy: value.membershipPolicy && typeof value.membershipPolicy === 'object' ? { ...value.membershipPolicy } : null
  };
}

function themeDefinitions(value) {
  return Array.isArray(value) ? value : Object.values(value || {});
}

function runtimeQuote(live, symbol) {
  const row = live?.[symbol] || {};
  const envelope = row.quoteEnvelope || {};
  const price = finite(row.price ?? envelope.price);
  const rawPct = finite(row.pct ?? envelope.pct);
  const observedAt = row.observedAt || envelope.observedAt || null;
  const fetchedAt = row.fetchedAt || envelope.fetchedAt || null;
  const revision = row.revision || envelope.revision || null;
  const changeBasis = row.changeBasis || row.valueBasis || envelope.changeBasis || envelope.valueBasis || 'unknown';
  const currency = row.currency || envelope.currency || null;
  const directionCompatible = rawPct != null && !!observedAt && changeBasis !== 'unknown';
  return {
    price,
    pct: directionCompatible ? rawPct : null,
    rawPct,
    currency: currency ? String(currency).trim().toUpperCase() : null,
    observedAt,
    fetchedAt,
    revision,
    changeBasis,
    directionCompatible,
    source: row.source || envelope.source || 'unavailable'
  };
}

// The screener's completed one-session move per symbol, kept only for the session most of the requested symbols share.
function closeQuotesFor(symbols, rows) {
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym && finite(row.ret1d) != null && row.factorSessionDate).map((row) => [String(row.sym), row]));
  const counts = new Map();
  for (const symbol of symbols) {
    const row = bySymbol.get(symbol);
    if (row) counts.set(row.factorSessionDate, (counts.get(row.factorSessionDate) || 0) + 1);
  }
  const session = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || null;
  const quotes = {};
  for (const symbol of symbols) {
    const row = bySymbol.get(symbol);
    if (!row || row.factorSessionDate !== session) continue;
    const pct = finite(row.ret1d);
    // v58.74 (audit): the leader cards read '가격 대기' on every weekend row; the completed close is the valuation close.
    const close = finite(row.valuationPrice ?? row._valuationPrice ?? row.pePrice);
    quotes[symbol] = { price: close != null && close > 0 ? close : null, pct, rawPct: pct, currency: close != null && row.currency ? String(row.currency).toUpperCase() : null, observedAt: session, fetchedAt: null, revision: null, changeBasis: 'completed-close', directionCompatible: true, closeBased: true, source: 'screener-completed-close' };
  }
  return { session, quotes };
}

function latestObservedAt(rows) {
  const timestamps = rows.map((row) => Date.parse(row?.observedAt || '')).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export function createThemesProvider({
  read = null,
  readLiveData = () => ({}),
  readHistory = () => ({}),
  readWeeklyPerf = () => ({}),
  readRotationHistory = () => null,
  readDefinitions = () => ({}),
  readSelectedId = () => null,
  readScreenerRows = () => [],
  now = () => new Date().toISOString()
} = {}) {
  return Object.freeze({
    readCurrent() {
      if (typeof read === 'function') {
        const value = read() || {};
        return Object.freeze({
          items: Array.isArray(value.items) ? value.items.slice() : [],
          selectedId: value.selectedId || null,
          selectedDetail: value.selectedDetail || null,
          updatedAt: value.updatedAt || now()
        });
      }
      const live = readLiveData() || {};
      const historyBySymbol = readHistory() || {};
      const producedArtifact = readRotationHistory();
      const observationNow = typeof now() === 'number' ? now() : Date.parse(now());
      const definitions = asDefinitions(readDefinitions());
      const sources = [
        ...definitions.sectors.map((item) => ({ ...item, view: 'sectors' })),
        ...definitions.subsectors.map((item) => ({ ...item, view: 'subsectors' }))
      ];
      const seen = new Set();
      const items = sources.filter((item) => {
        const id = String(item?.id || item?.sym || item?.symbol || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).map((item) => {
        const symbol = String(item?.sym || item?.symbol || item?.id || '');
        const rotation = computeRelativeRotation({
          history: historyBySymbol[symbol] || null,
          benchmarkHistory: historyBySymbol.SPY || null,
          hasQuote: !!live[symbol],
          hasBenchmarkQuote: !!live.SPY
        });
        const currentQuote = runtimeQuote(live, symbol);
        const produced = selectProducedRotation(producedArtifact, symbol, observationNow);
        // v57.50 C21/C22: the sector bars and summary are labelled "<date> 미국 종가 기준", so the 1-day and 1-week
        // returns come only from the session-checked completed-close artifact. The live quote (intraday pct) and the
        // legacy 5-day cache (today's open→close first) no longer stand in under a close label; the live move is kept
        // separately as livePct for any reader that labels it as live.
        const closePct = finite(produced?.dailyPct);
        return {
          id: String(item?.id || symbol),
          symbol,
          label: item?.name || item?.label || symbol,
          price: currentQuote.price,
          pct: closePct,
          livePct: finite(currentQuote.pct),
          weeklyPct: finite(produced?.weeklyPct),
          rsRatio: finite(produced?.rsRatio ?? rotation?.rsRatio ?? item?.rsRatio),
          rsMomentum: finite(produced?.rsMomentum ?? rotation?.rsMom ?? item?.rsMomentum),
          quadrant: produced?.quadrant || rotation?.quadrant || item?.quadrant || 'neutral',
          view: item?.view || 'sectors',
          source: closePct != null ? produced?.source : currentQuote.source,
          sourceKind: closePct != null ? produced?.sourceKind || 'unavailable' : 'unavailable',
          observedAt: closePct != null ? produced?.observedAt || null : null,
          fetchedAt: closePct != null ? produced?.fetchedAt || null : null,
          revision: produced?.revision || currentQuote.revision,
          changeBasis: closePct != null ? produced?.changeBasis || 'unknown' : 'unknown',
          directionCompatible: closePct != null,
          rotationSource: rotation?.modelVersion ? `native-rrg:${rotation.modelVersion}` : (item?.source || 'native-rrg')
        };
      });

      const selectedId = readSelectedId() || null;
      const selectedTheme = themeDefinitions(definitions.themes)
        .find((theme) => String(theme?.id || '') === String(selectedId || '')) || null;
      let selectedDetail = null;
      if (selectedTheme) {
        const detailSymbols = new Set();
        [selectedTheme.etf, selectedTheme.compositeBase, ...(selectedTheme.leaders || []), ...(selectedTheme.leaderHighlight || [])].forEach((symbol) => {
          if (symbol) detailSymbols.add(String(symbol));
        });
        (selectedTheme.subThemes || []).forEach((sub) => {
          if (sub?.etf) detailSymbols.add(String(sub.etf));
          (sub?.tickers || []).forEach((symbol) => detailSymbols.add(String(symbol)));
        });
        const liveQuotes = Object.fromEntries([...detailSymbols].map((symbol) => [symbol, runtimeQuote(live, symbol)]));
        // v57.70 (2026-10-15 audit): live quotes are polled for the core symbols only, so a theme's 48 constituents stayed
        // "시세 대기" while the screener held their completed-close moves. One basis per detail: live when it covers at
        // least 60% of the constituents, else the published completed-close move of the session most of them share.
        const closeRows = readScreenerRows();
        const closeBasis = closeQuotesFor([...detailSymbols], closeRows);
        const liveCovered = [...detailSymbols].filter((symbol) => liveQuotes[symbol].pct != null).length;
        const useClose = closeBasis.session && liveCovered < Math.ceil(detailSymbols.size * 0.6);
        // v58.63 (architecture audit D2): in completed-close mode a constituent without that session's close is missing —
        // it is no longer filled with a live quote, and the hero move and breadth come from the same close set as the
        // rows (the hero move used to be computed live-first before the basis was chosen).
        const missingClose = { price: null, pct: null, rawPct: null, currency: null, observedAt: null, fetchedAt: null, revision: null, changeBasis: 'completed-close', directionCompatible: false, closeBased: true, missing: true };
        const quotes = useClose ? Object.fromEntries([...detailSymbols].map((symbol) => [symbol, closeBasis.quotes[symbol] || missingClose])) : liveQuotes;
        const quotePct = useClose
          ? (symbol) => { const close = closeQuotesFor([symbol], closeRows).quotes[symbol]; return close && close.observedAt === closeBasis.session ? close.pct : null; }
          : (symbol) => runtimeQuote(live, symbol).pct ?? selectProducedRotation(producedArtifact, symbol, observationNow)?.dailyPct ?? null;
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
        const pricedLeaders = (selectedTheme.leaders || []).map((symbol) => quotes[symbol]).filter((quote) => quote && (quote.price != null || quote.closeBased) && quote.directionCompatible && quote.pct != null && Number.isFinite(Number(quote.pct))); // P1575: a leader without a move is not counted as down
        const breadth = pricedLeaders.length >= Math.max(2, Math.ceil((selectedTheme.leaders || []).length * 0.6))
          ? Math.round(pricedLeaders.filter((quote) => Number(quote.pct) > 0).length / pricedLeaders.length * 100)
          : null;
        const insight = definitions.insights[selectedTheme.id] || null;
        selectedDetail = {
          id: String(selectedTheme.id || selectedId),
          label: String(selectedTheme.nameKr || selectedTheme.name || selectedTheme.id || selectedId),
          etf: selectedTheme.etf || null,
          compositeBase: selectedTheme.compositeBase || null,
          pct: finite(pct),
          breadth: finite(breadth),
          source,
          membershipPolicy: definitions.membershipPolicy,
          quoteBasis: useClose ? { kind: 'completed-close', session: closeBasis.session } : { kind: 'live', session: null },
          quotes,
          insight,
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
      return Object.freeze({ items, selectedId, selectedDetail, updatedAt: latestObservedAt(items) });
    }
  });
}
