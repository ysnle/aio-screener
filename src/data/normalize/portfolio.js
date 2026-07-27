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
    dailyPct: finite(Number(holding?.dailyPct ?? holding?.pct)),
    sector: holding?.sector ? String(holding.sector) : null,
    target: finite(Number(holding?.target)),
    memo: holding?.memo ? String(holding.memo) : '',
    addedAt: holding?.addedAt || null,
    updatedAt: holding?.updatedAt || null,
    source: holding?.source || 'portfolio-repository'
  })).filter((holding) => holding.symbol) : [];
  return Object.freeze({
    holdings,
    cash: finite(Number(raw.cash)),
    totals: raw.totals && typeof raw.totals === 'object' ? {
      ...raw.totals,
      totalValue: finite(Number(raw.totals.totalValue)),
      totalAssets: finite(Number(raw.totals.totalAssets)),
      totalCost: finite(Number(raw.totals.totalCost)),
      totalPnl: finite(Number(raw.totals.totalPnl)),
      totalPnlPct: finite(Number(raw.totals.totalPnlPct)),
      dailyChange: finite(Number(raw.totals.dailyChange ?? raw.totals.totalDailyChg)),
      dailyPct: finite(Number(raw.totals.dailyPct)),
      cash: finite(Number(raw.totals.cash))
    } : null,
    privacy: raw.privacy || 'opt-in',
    status: raw.status || (holdings.length ? 'current' : 'empty'),
    updatedAt: raw.updatedAt || new Date().toISOString()
  });
}
