function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeMarket(raw = {}) {
  const quotes = {};
  Object.entries(raw.quotes || {}).forEach(([symbol, quote]) => {
    quotes[symbol] = Object.freeze({
      value: finite(quote?.value),
      pct: finite(quote?.pct),
      observedAt: quote?.observedAt || null,
      fetchedAt: quote?.fetchedAt || null,
      source: quote?.source || 'market-provider',
      sourceKind: quote?.sourceKind || null,
      revision: quote?.revision || null,
      changeBasis: quote?.changeBasis || 'unknown',
      directionCompatible: quote?.directionCompatible === true
    });
  });
  const metrics = {};
  Object.entries(raw.metrics || {}).forEach(([key, value]) => { metrics[key] = finite(value); });
  return Object.freeze({ quotes: Object.freeze(quotes), metrics: Object.freeze(metrics), updatedAt: raw.updatedAt || null, observationStart: raw.observationStart || null, observationEnd: raw.observationEnd || null });
}
