export function selectPortfolioState(state) {
  return state?.portfolio || null;
}

export function selectPortfolioHoldings(state) {
  return selectPortfolioState(state)?.holdings || [];
}

export function selectPortfolioTotals(state) {
  return selectPortfolioState(state)?.totals || null;
}

export function selectPortfolioPrivacy(state) {
  return selectPortfolioState(state)?.privacy || 'opt-in';
}
