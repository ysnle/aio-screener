function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizePortfolio(raw = {}) {
  const holdings = Array.isArray(raw.holdings) ? raw.holdings.map((holding) => ({
    symbol: String(holding?.symbol || holding?.sym || '').toUpperCase(),
    shares: finite(Number(holding?.shares ?? holding?.qty)),
    avgCost: finite(Number(holding?.avgCost ?? holding?.avg)),
    price: finite(Number(holding?.price)),
    value: finite(Number(holding?.value)),
    weight: finite(Number(holding?.weight)),
    source: holding?.source || 'portfolio-repository'
  })).filter((holding) => holding.symbol) : [];
  return Object.freeze({
    holdings,
    cash: finite(Number(raw.cash)),
    totals: raw.totals && typeof raw.totals === 'object' ? { ...raw.totals } : null,
    privacy: raw.privacy || 'opt-in',
    status: raw.status || (holdings.length ? 'current' : 'empty'),
    updatedAt: raw.updatedAt || new Date().toISOString()
  });
}
