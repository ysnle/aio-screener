export const ANALYSIS_DATA_SET = 'data/analysis';
export const ANALYSIS_DATA_CLEAR = 'data/analysis/clear';

export function createInitialAnalysisState() {
  return Object.freeze({ status: 'unavailable', technical: null, signal: null, home: null, updatedAt: null });
}

export function createAnalysisDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: ANALYSIS_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function analysisReducer(state = createInitialAnalysisState(), action = {}) {
  if (action.type === ANALYSIS_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return { status: payload.status || 'current', technical: payload.technical || null, signal: payload.signal || null, home: payload.home || null, updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null };
  }
  if (action.type === ANALYSIS_DATA_CLEAR) return createInitialAnalysisState();
  return state;
}
