import { createMarketDataAction, MARKET_DATA_CLEAR } from '../../state/slices/market.js';

export function createMarketCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('MARKET_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) {
      return store.dispatch(createMarketDataAction(payload, meta));
    },
    clear() {
      return store.dispatch({ type: MARKET_DATA_CLEAR });
    }
  });
}
