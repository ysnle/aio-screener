export const THEMES_DATA_SET = 'data/themes';
export const THEMES_DATA_CLEAR = 'data/themes/clear';

export function createInitialThemesState() {
  return Object.freeze({ items: [], selectedId: null, selectedDetail: null, updatedAt: null });
}

export function createThemesDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: THEMES_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function themesReducer(state = createInitialThemesState(), action = {}) {
  if (action.type === THEMES_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    return {
      items: has('items') && Array.isArray(payload.items) ? payload.items.map((item) => item && typeof item === 'object' ? { ...item } : item) : state.items,
      selectedId: has('selectedId') ? payload.selectedId || null : state.selectedId,
      selectedDetail: has('selectedDetail') ? (payload.selectedDetail && typeof payload.selectedDetail === 'object' ? { ...payload.selectedDetail } : null) : state.selectedDetail,
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === THEMES_DATA_CLEAR) return createInitialThemesState();
  return state;
}
