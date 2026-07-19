export const MARKET_DATA_SET = 'data/market';
export const MARKET_DATA_CLEAR = 'data/market/clear';

export function createInitialMarketState() {
  return Object.freeze({ quotes: {}, metrics: {}, updatedAt: null });
}

export function createMarketDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: MARKET_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function marketReducer(state = createInitialMarketState(), action = {}) {
  if (action.type === MARKET_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      quotes: payload.quotes && typeof payload.quotes === 'object' ? { ...payload.quotes } : {},
      metrics: payload.metrics && typeof payload.metrics === 'object' ? { ...payload.metrics } : {},
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === MARKET_DATA_CLEAR) return createInitialMarketState();
  return state;
}
