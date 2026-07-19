function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeMarket(raw = {}) {
  const quotes = {};
  Object.entries(raw.quotes || {}).forEach(([symbol, quote]) => {
    quotes[symbol] = {
      value: finite(quote?.value),
      pct: finite(quote?.pct),
      observedAt: quote?.observedAt || null,
      source: quote?.source || 'market-provider'
    };
  });
  const metrics = {};
  Object.entries(raw.metrics || {}).forEach(([key, value]) => { metrics[key] = finite(value); });
  return Object.freeze({ quotes: Object.freeze(quotes), metrics: Object.freeze(metrics), updatedAt: raw.updatedAt || new Date().toISOString() });
}
