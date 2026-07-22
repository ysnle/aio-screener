export const SCREENER_DATA_SET = 'data/screener';
export const SCREENER_DATA_CLEAR = 'data/screener/clear';

export function createInitialScreenerState() {
  return Object.freeze({ status: 'unavailable', rows: [], filters: {}, metadata: {}, revision: null, updatedAt: null });
}

export function createScreenerDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: SCREENER_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function screenerReducer(state = createInitialScreenerState(), action = {}) {
  if (action.type === SCREENER_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      status: payload.status || (Array.isArray(payload.rows) ? 'current' : 'unavailable'),
      rows: Array.isArray(payload.rows) ? payload.rows.map((row) => ({ ...row })) : [],
      filters: payload.filters && typeof payload.filters === 'object' ? { ...payload.filters } : {},
      metadata: payload.metadata && typeof payload.metadata === 'object' ? { ...payload.metadata } : {},
      revision: payload.revision || null,
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === SCREENER_DATA_CLEAR) return createInitialScreenerState();
  return state;
}
