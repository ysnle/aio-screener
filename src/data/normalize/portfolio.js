import { finiteNumber as finite } from '../../domain/shared/number.js';
function numeric(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  return finite(Number(value));
}

function positiveFinite(value) {
  const number = numeric(value);
  return number != null && number > 0 ? number : null;
}

function weightPercent(value) {
  const number = numeric(value);
  return number != null && number >= 0 && number <= 100 ? number : null;
}

export function normalizePortfolio(raw = {}) {
  const holdings = Array.isArray(raw.holdings) ? raw.holdings.map((holding) => Object.freeze({
    symbol: String(holding?.symbol || holding?.sym || '').toUpperCase(),
    // The listing a stored code is quoted under (005930 -> 005930.KS), resolved once by the runtime reader. Dropping it
    // here sent the bare code to the quote providers and left the row unpriced; absent stays null, never guessed.
    listingSymbol: String(holding?.listingSymbol || '').toUpperCase() || null,
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
    currency: String(holding?.currency || holding?.priceCurrency || '').trim().toUpperCase() || null,
    costCurrency: String(holding?.costCurrency || '').trim().toUpperCase() || null,
    sector: holding?.sector ? String(holding.sector) : null,
    target: positiveFinite(holding?.target),
    targetWeight: weightPercent(holding?.targetWeight),
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
    holdingsKnown: raw.holdingsKnown === true || Array.isArray(raw.holdings),
    cash: numeric(raw.cash),
    cashKnown: raw.cashKnown === true || numeric(raw.cash) != null,
    baseCurrency: String(raw.baseCurrency || raw.currency || '').trim().toUpperCase() || null,
    cashCurrency: String(raw.cashCurrency || '').trim().toUpperCase() || null,
    ...(Array.isArray(raw.cashBalances) ? { cashBalances: Object.freeze(raw.cashBalances.map((row) => Object.freeze({ currency: String(row?.currency || '').trim().toUpperCase() || null, amount: numeric(row?.amount) }))) } : {}),
    fxLegs: Object.freeze((Array.isArray(raw.fxLegs) ? raw.fxLegs : []).map((leg) => Object.freeze({
      from: String(leg?.from || '').trim().toUpperCase() || null,
      to: String(leg?.to || '').trim().toUpperCase() || null,
      rate: numeric(leg?.rate),
      observedAt: leg?.observedAt ? String(leg.observedAt) : null,
      source: leg?.source ? String(leg.source) : null
    }))),
    readState: ['loading', 'locked', 'ready', 'failed'].includes(raw.readState) ? raw.readState : (raw.status === 'locked' ? 'locked' : raw.status === 'loading' ? 'loading' : raw.status === 'failed' ? 'failed' : 'ready'),
    totals,
    privacy: raw.privacy || 'opt-in',
    status: raw.status || (holdings.length ? 'current' : 'empty'),
    updatedAt: raw.updatedAt || null
  });
}
