function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(value[key], seen);
  }
  return value;
}

/**
 * Minimal command/reducer store (RM-02, ADR-0002 appendix). Reducers must be
 * spread-based/structurally-sharing, as every reducer in src/state/slices/*.js
 * already is — the store trusts that contract and does not clone state on read
 * (getState) or write (dispatch/notify). devMode deep-freezes the committed
 * state so an accidental in-place mutation throws immediately instead of
 * silently corrupting canonical state; it defaults to false because the freeze
 * walk has a real cost that must never be paid by end users.
 */
export function createStore({ initialState = {}, reducer = (state) => state, devMode = false } = {}) {
  let state = devMode ? deepFreeze(initialState) : initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') throw new Error('STORE_ACTION_INVALID');
    const next = reducer(state, action);
    if (next === undefined) throw new Error('STORE_REDUCER_RETURNED_UNDEFINED');
    state = devMode ? deepFreeze(next) : next;
    listeners.forEach((listener) => listener(state, action));
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('STORE_LISTENER_INVALID');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({ getState, dispatch, subscribe });
}
