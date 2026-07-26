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

export function createThemesProvider({
  read = null,
  readLiveData = () => ({}),
  readHistory = () => ({}),
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
        const history = historyBySymbol[symbol];
        const dailyPct = finite(live[symbol]?.pct) ?? (
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
          source: rotation?.modelVersion ? `native-rrg:${rotation.modelVersion}` : (item?.source || 'native-rrg')
        };
      });

      const selectedId = readSelectedId() || null;
      const selectedTheme = themeDefinitions(definitions.themes)
        .find((theme) => String(theme?.id || '') === String(selectedId || '')) || null;
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
      return Object.freeze({ items, selectedId, selectedDetail, updatedAt: now() });
    }
  });
}
