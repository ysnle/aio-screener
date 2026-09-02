function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numeric(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  return finite(Number(value));
}

function positiveFinite(value) {
  const number = numeric(value);
  return number != null && number > 0 ? number : null;
}

export function normalizePortfolio(raw = {}) {
  const holdings = Array.isArray(raw.holdings) ? raw.holdings.map((holding) => Object.freeze({
    symbol: String(holding?.symbol || holding?.sym || '').toUpperCase(),
    shares: numeric(holding?.shares ?? holding?.qty),
    avgCost: numeric(holding?.avgCost ?? holding?.avg),
    // A blocked quote is not a zero-dollar quote. Preserve missingness so the
    // table cannot manufacture a 100% loss from an unavailable price.
    price: positiveFinite(holding?.price),
    value: positiveFinite(holding?.value),
    weight: numeric(holding?.weight),
    dailyPct: numeric(holding?.dailyPct ?? holding?.pct),
    directionValue: numeric(holding?.directionValue ?? holding?.dailyPct ?? holding?.pct),
    quoteObservedAt: holding?.quoteObservedAt || holding?.observedAt || null,
    fetchedAt: holding?.fetchedAt || null,
    revision: holding?.revision || null,
    changeBasis: holding?.changeBasis || 'unknown',
    directionCompatible: holding?.directionCompatible === true || (!!holding?.changeBasis && holding.changeBasis !== 'unknown'),
    sector: holding?.sector ? String(holding.sector) : null,
    target: numeric(holding?.target),
    memo: holding?.memo ? String(holding.memo) : '',
    addedAt: holding?.addedAt || null,
    updatedAt: holding?.updatedAt || null,
    source: holding?.source || 'portfolio-repository'
  })).filter((holding) => holding.symbol) : [];
  const totals = raw.totals && typeof raw.totals === 'object' ? Object.freeze({
    ...raw.totals,
    totalValue: numeric(raw.totals.totalValue),
    totalAssets: numeric(raw.totals.totalAssets),
    totalCost: numeric(raw.totals.totalCost),
    totalPnl: numeric(raw.totals.totalPnl),
    totalPnlPct: numeric(raw.totals.totalPnlPct),
    dailyChange: numeric(raw.totals.dailyChange ?? raw.totals.totalDailyChg),
    dailyPct: numeric(raw.totals.dailyPct),
    cash: numeric(raw.totals.cash)
  }) : null;
  return Object.freeze({
    holdings: Object.freeze(holdings),
    cash: numeric(raw.cash),
    totals,
    privacy: raw.privacy || 'opt-in',
    status: raw.status || (holdings.length ? 'current' : 'empty'),
    updatedAt: raw.updatedAt || null
  });
}
