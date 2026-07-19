export const MARKET_MODEL_VERSION = 'market.v1';

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export function deriveMarketModel({ quotes = {}, inputVersion = 'unknown' } = {}) {
  const normalized = Object.fromEntries(Object.entries(quotes || {}).map(([symbol, quote]) => [symbol, { value: finite(quote?.value), pct: finite(quote?.pct), observedAt: quote?.observedAt || null }]));
  const observed = Object.values(normalized).filter((quote) => quote.value != null).length;
  return Object.freeze({ modelVersion: MARKET_MODEL_VERSION, inputVersion, status: observed ? 'current' : 'unavailable', observed, quotes: normalized });
}
