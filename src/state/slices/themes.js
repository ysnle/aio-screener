export const THEMES_DATA_SET = 'data/themes';
export const THEMES_DATA_CLEAR = 'data/themes/clear';

export function createInitialThemesState() {
  return Object.freeze({ items: [], selectedId: null, updatedAt: null });
}

export function createThemesDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: THEMES_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function themesReducer(state = createInitialThemesState(), action = {}) {
  if (action.type === THEMES_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      items: Array.isArray(payload.items) ? payload.items.slice() : [],
      selectedId: payload.selectedId || state.selectedId || null,
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === THEMES_DATA_CLEAR) return createInitialThemesState();
  return state;
}
