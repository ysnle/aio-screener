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

// P1176 (22 PFR01): a price target and a target weight are different types. `numeric(0)`
// kept the legacy writer's "field left blank" sentinel as a real target price, which the
// table then rendered as $0.00 plus a -100% potential return. An explicit 0% weight, by
// contrast, is a meaningful value and must survive.
function weightPercent(value) {
  const number = numeric(value);
  return number != null && number >= 0 && number <= 100 ? number : null;
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
    // P1175 (11 P11-02): 통화는 표시가 아니라 합산의 단위다. 정규화가 버리면 이후 합산이 서로 다른
    // 단위를 더하고도 complete라고 말할 수 있다 — 선언을 보존하고, 없으면 추정하지 않는다.
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
    // E3/P1194: 선언된 FX leg는 환산의 유일한 근거다 — 정규화가 지우면 surface는 영원히 보류만 한다.
    // 여기서는 통과만 시키고 유효성(관측 시각·창)은 surface의 fx 계약이 판정한다.
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
