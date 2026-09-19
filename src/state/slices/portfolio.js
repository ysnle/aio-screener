export const PORTFOLIO_DATA_SET = 'data/portfolio';
export const PORTFOLIO_DATA_CLEAR = 'data/portfolio/clear';

export function createInitialPortfolioState() {
  return Object.freeze({ status: 'unavailable', readState: 'loading', holdings: [], holdingsKnown: false, cash: null, cashKnown: false, totals: null, privacy: 'opt-in', updatedAt: null });
}

export function createPortfolioDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: PORTFOLIO_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function portfolioReducer(state = createInitialPortfolioState(), action = {}) {
  if (action.type === PORTFOLIO_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      status: payload.status || (Array.isArray(payload.holdings) ? 'current' : 'unavailable'),
      readState: ['loading', 'locked', 'ready', 'failed'].includes(payload.readState) ? payload.readState : (payload.status === 'locked' ? 'locked' : Array.isArray(payload.holdings) ? 'ready' : 'unavailable'),
      holdings: Array.isArray(payload.holdings) ? payload.holdings.map((holding) => ({ ...holding })) : [],
      holdingsKnown: payload.holdingsKnown === true || Array.isArray(payload.holdings),
      cash: Number.isFinite(payload.cash) ? payload.cash : null,
      cashKnown: payload.cashKnown === true || Number.isFinite(payload.cash),
      totals: payload.totals && typeof payload.totals === 'object' ? { ...payload.totals } : null,
      privacy: payload.privacy || 'opt-in',
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === PORTFOLIO_DATA_CLEAR) return createInitialPortfolioState();
  return state;
}
