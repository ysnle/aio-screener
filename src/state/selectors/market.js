export function selectMarketState(state) {
  return state?.market || null;
}

export function selectMarketQuotes(state) {
  return selectMarketState(state)?.quotes || {};
}

export function selectMarketMetrics(state) {
  return selectMarketState(state)?.metrics || {};
}

export function selectMarketQuote(state, symbol) {
  return selectMarketQuotes(state)[symbol] || null;
}

export function selectMarketMetric(state, key) {
  return selectMarketMetrics(state)[key] ?? null;
}
