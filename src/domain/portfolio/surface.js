export const PORTFOLIO_SURFACE_MODEL_VERSION = 'portfolio-surface.v1';

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number != null) return number;
  }
  return null;
}

function firstPositive(...values) {
  for (const value of values) {
    const number = finite(value);
    if (number != null && number > 0) return number;
  }
  return null;
}

function holdingValue(holding, live) {
  const shares = finite(holding?.shares);
  const livePrice = firstPositive(live?.price, live?.regularMarketPrice);
  const price = firstPositive(livePrice, holding?.price);
  const explicitValue = firstPositive(holding?.value);
  if (shares != null && price != null && price > 0) return { value: shares * price, price, sourceKind: livePrice != null ? 'live-quote' : 'portfolio-state' };
  if (explicitValue != null) return { value: explicitValue, price, sourceKind: 'portfolio-state' };
  return { value: null, price, sourceKind: 'unavailable' };
}

function exposureCapForVix(vix) {
  if (vix == null) return null;
  return vix < 15 ? 100 : vix < 20 ? 80 : vix < 25 ? 50 : vix < 30 ? 30 : 15;
}

/**
 * Derives the deterministic, non-chart portion of the portfolio surface.
 * Missing canonical inputs remain null so the UI cannot turn unavailable data into a zero.
 */
export function derivePortfolioSurface({ state = {}, liveData = {}, vix = null } = {}) {
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const totals = state?.totals && typeof state.totals === 'object' ? state.totals : {};
  const live = liveData && typeof liveData === 'object' ? liveData : {};
  const rows = holdings.map((holding) => {
    const symbol = String(holding?.symbol || holding?.ticker || '').toUpperCase();
    const quote = holdingValue(holding, live[symbol] || {});
    const shares = finite(holding?.shares);
    const avgCost = finite(holding?.avgCost);
    const cost = shares != null && avgCost != null ? shares * avgCost : null;
    const dailyPct = firstFinite(holding?.dailyPct, live[symbol]?.pct, live[symbol]?.regularMarketChangePercent);
    return Object.freeze({
      symbol,
      value: quote.value,
      price: quote.price,
      cost,
      sector: String(holding?.sector || 'Unclassified'),
      dailyPct,
      sourceKind: quote.sourceKind
    });
  }).filter((row) => row.symbol);

  const allRowsValued = rows.length > 0 && rows.every((row) => row.value != null);
  const positionValue = firstPositive(totals.totalValue, totals.positionsValue, totals.equityValue) ?? (allRowsValued ? rows.reduce((sum, row) => sum + row.value, 0) : null);
  const cash = firstFinite(state?.cash, totals.cash);
  const totalAssets = firstPositive(totals.totalAssets, totals.totalValueWithCash) ?? (positionValue != null && cash != null ? positionValue + Math.max(0, cash) : positionValue);
  const allRowsCosted = rows.length > 0 && rows.every((row) => row.cost != null);
  const totalCost = firstPositive(totals.totalCost, totals.costBasis) ?? (allRowsCosted ? rows.reduce((sum, row) => sum + row.cost, 0) : null);
  const totalPnl = positionValue != null && totalCost != null && totalCost > 0
    ? firstFinite(totals.totalPnl, totals.pnl, totals.profitLoss) ?? (positionValue - totalCost)
    : null;
  const totalPnlPct = firstFinite(totals.totalPnlPct, totals.pnlPct) ?? (totalPnl != null && totalCost > 0 ? totalPnl / totalCost * 100 : null);
  const allRowsDaily = rows.length > 0 && rows.every((row) => row.value != null && row.dailyPct != null);
  const dailyChange = firstFinite(totals.dailyChange, totals.totalDailyChg, totals.dailyPnl) ?? (allRowsDaily ? rows.reduce((sum, row) => sum + row.value * row.dailyPct / 100, 0) : null);
  const dailyPct = firstFinite(totals.dailyPct) ?? (dailyChange != null && totalAssets > 0 ? dailyChange / totalAssets * 100 : null);
  const exposurePct = totalAssets != null && totalAssets > 0 && positionValue != null ? positionValue / totalAssets * 100 : null;
  const exposureCap = exposureCapForVix(finite(vix));
  const sectors = new Map();
  for (const row of rows) {
    if (row.value == null || totalAssets == null || totalAssets <= 0) continue;
    const name = row.sector || 'Unclassified';
    sectors.set(name, (sectors.get(name) || 0) + row.value / totalAssets * 100);
  }
  if (cash != null && totalAssets != null && totalAssets > 0 && cash > 0) sectors.set('CASH', cash / totalAssets * 100);
  const sectorBreakdown = [...sectors.entries()]
    .map(([name, pct]) => Object.freeze({ name, pct }))
    .sort((a, b) => b.pct - a.pct);
  const sourceKind = rows.some((row) => row.sourceKind === 'live-quote') ? 'portfolio-state+live-quote' : rows.length ? 'portfolio-state' : 'unavailable';
  const hasCanonicalValue = positionValue != null && (rows.length > 0 || cash != null);
  return Object.freeze({
    modelVersion: PORTFOLIO_SURFACE_MODEL_VERSION,
    status: hasCanonicalValue ? 'current' : (state?.status || 'unavailable'),
    holdingCount: rows.length,
    rows: Object.freeze(rows),
    positionValue,
    totalAssets,
    totalCost,
    totalPnl,
    totalPnlPct,
    cash,
    cashPct: cash != null && totalAssets != null && totalAssets > 0 ? cash / totalAssets * 100 : null,
    dailyChange,
    dailyPct,
    vix: finite(vix),
    exposurePct,
    exposureCap,
    exposureExceeded: exposurePct != null && exposureCap != null ? exposurePct > exposureCap : null,
    sectorBreakdown: Object.freeze(sectorBreakdown),
    sourceKind,
    sourceLabel: sourceKind === 'unavailable' ? 'portfolio-surface-unavailable' : 'native-portfolio-surface',
    observedAt: state?.updatedAt || null
  });
}
