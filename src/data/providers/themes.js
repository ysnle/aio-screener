import { computeRelativeRotation } from '../../domain/themes/rrg.js';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDefinitions(value) {
  if (!value || typeof value !== 'object') return { sectors: [], subsectors: [], themes: {}, insights: {} };
  const themes = Array.isArray(value.themes)
    ? value.themes
    : (value.themes && typeof value.themes === 'object' ? value.themes : {});
  return {
    sectors: Array.isArray(value.sectors) ? value.sectors : [],
    subsectors: Array.isArray(value.subsectors) ? value.subsectors : [],
    themes,
    insights: value.insights && typeof value.insights === 'object' ? value.insights : {}
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
  const directionCompatible = rawPct != null && !!observedAt && changeBasis !== 'unknown';
  return {
    price,
    pct: directionCompatible ? rawPct : null,
    rawPct,
    observedAt,
    fetchedAt,
    revision,
    changeBasis,
    directionCompatible,
    source: row.source || envelope.source || 'unavailable'
  };
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
  readDefinitions = () => ({}),
  readSelectedId = () => null,
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
      const weeklyPerf = readWeeklyPerf() || {};
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
        const dailyPct = currentQuote.pct;
        return {
          id: String(item?.id || symbol),
          symbol,
          label: item?.name || item?.label || symbol,
          price: currentQuote.price,
          pct: finite(dailyPct),
          weeklyPct: finite(weeklyPerf[symbol]),
          rsRatio: finite(rotation?.rsRatio ?? item?.rsRatio),
          rsMomentum: finite(rotation?.rsMom ?? item?.rsMomentum),
          quadrant: rotation?.quadrant || item?.quadrant || 'neutral',
          view: item?.view || 'sectors',
          source: currentQuote.source,
          sourceKind: currentQuote.price == null ? 'unavailable' : 'runtime-quote',
          observedAt: currentQuote.observedAt,
          fetchedAt: currentQuote.fetchedAt,
          revision: currentQuote.revision,
          changeBasis: currentQuote.changeBasis,
          directionCompatible: currentQuote.directionCompatible,
          rotationSource: rotation?.modelVersion ? `native-rrg:${rotation.modelVersion}` : (item?.source || 'native-rrg')
        };
      });

      const selectedId = readSelectedId() || null;
      const selectedTheme = themeDefinitions(definitions.themes)
        .find((theme) => String(theme?.id || '') === String(selectedId || '')) || null;
      let selectedDetail = null;
      if (selectedTheme) {
        const quotePct = (symbol) => runtimeQuote(live, symbol).pct;
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
        const quotes = Object.fromEntries([...detailSymbols].map((symbol) => [symbol, runtimeQuote(live, symbol)]));
        const pricedLeaders = (selectedTheme.leaders || []).map((symbol) => runtimeQuote(live, symbol)).filter((quote) => quote.price != null && quote.directionCompatible);
        const breadth = pricedLeaders.length >= Math.max(2, Math.ceil((selectedTheme.leaders || []).length * 0.6))
          ? Math.round(pricedLeaders.filter((quote) => Number(quote.pct || 0) > 0).length / pricedLeaders.length * 100)
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
