export const NEWS_DATA_SET = 'data/news';
export const NEWS_DATA_CLEAR = 'data/news/clear';

export function createInitialNewsState() {
  return Object.freeze({ items: [], status: 'unavailable', revision: null, updatedAt: null });
}

export function createNewsDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: NEWS_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function newsReducer(state = createInitialNewsState(), action = {}) {
  if (action.type === NEWS_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      items: Array.isArray(payload.items) ? payload.items.slice() : [],
      status: payload.status || (payload.items?.length ? 'current' : 'unavailable'),
      revision: action.meta?.revision || payload.revision || state.revision || null,
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === NEWS_DATA_CLEAR) return createInitialNewsState();
  return state;
}
