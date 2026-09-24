export const PORTFOLIO_DATA_SET = 'data/portfolio';
export const PORTFOLIO_DATA_CLEAR = 'data/portfolio/clear';

export function createInitialPortfolioState() {
  return Object.freeze({ status: 'unavailable', readState: 'loading', holdings: [], holdingsKnown: false, cash: null, cashKnown: false, totals: null, privacy: 'opt-in', updatedAt: null, baseCurrency: null, cashCurrency: null, fxLegs: Object.freeze([]) });
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
      // E3/P1194: 선언(기준 통화·현금 통화·FX leg)은 표시 상태의 일부다. 이 리듀서가 필드를 열거하며
      // 조용히 버리면 surface는 영원히 '미선언'으로 보류하고, 환산 근거가 선언돼도 도달하지 못한다 —
      // P1181의 provider 드롭과 같은 클래스(선언이 경계에서 사라진다).
      baseCurrency: String(payload.baseCurrency || '').trim().toUpperCase() || null,
      cashCurrency: String(payload.cashCurrency || '').trim().toUpperCase() || null,
      fxLegs: Array.isArray(payload.fxLegs) ? payload.fxLegs.map((leg) => ({ ...leg })) : [],
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === PORTFOLIO_DATA_CLEAR) return createInitialPortfolioState();
  return state;
}
