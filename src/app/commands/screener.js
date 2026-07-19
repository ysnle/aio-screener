import { createScreenerDataAction, SCREENER_DATA_CLEAR } from '../../state/slices/screener.js';

export function createScreenerCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('SCREENER_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) { return store.dispatch(createScreenerDataAction(payload, meta)); },
    clear() { return store.dispatch({ type: SCREENER_DATA_CLEAR }); }
  });
}
