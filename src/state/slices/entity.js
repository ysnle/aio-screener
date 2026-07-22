export const ENTITY_DATA_SET = 'data/entity';
export const ENTITY_DATA_CLEAR = 'data/entity/clear';

export function createInitialEntityState() {
  return Object.freeze({ id: null, name: null, quote: null, fundamentals: null, options: null, status: 'unavailable', updatedAt: null });
}

export function createEntityDataAction(payload = {}, meta = {}) {
  return Object.freeze({ type: ENTITY_DATA_SET, payload: { ...payload }, meta: { ...meta } });
}

export function entityReducer(state = createInitialEntityState(), action = {}) {
  if (action.type === ENTITY_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      id: payload.id || null,
      name: payload.name || null,
      quote: payload.quote && typeof payload.quote === 'object' ? { ...payload.quote } : null,
      fundamentals: payload.fundamentals && typeof payload.fundamentals === 'object' ? { ...payload.fundamentals } : null,
      options: payload.options && typeof payload.options === 'object' ? { ...payload.options } : null,
      status: payload.status || (payload.id ? 'current' : 'unavailable'),
      updatedAt: action.meta?.updatedAt || payload.updatedAt || state.updatedAt || null
    };
  }
  if (action.type === ENTITY_DATA_CLEAR) return createInitialEntityState();
  return state;
}
