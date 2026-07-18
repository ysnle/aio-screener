function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/** Minimal command/reducer store. State is never mutated by subscribers. */
export function createStore({ initialState = {}, reducer = (state) => state } = {}) {
  let state = clone(initialState);
  const listeners = new Set();

  function getState() {
    return clone(state);
  }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') throw new Error('STORE_ACTION_INVALID');
    const next = reducer(clone(state), action);
    if (next === undefined) throw new Error('STORE_REDUCER_RETURNED_UNDEFINED');
    state = clone(next);
    listeners.forEach((listener) => listener(getState(), action));
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('STORE_LISTENER_INVALID');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({ getState, dispatch, subscribe });
}
