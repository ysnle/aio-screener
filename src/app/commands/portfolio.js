import { createPortfolioDataAction, PORTFOLIO_DATA_CLEAR } from '../../state/slices/portfolio.js';

export function createPortfolioCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('PORTFOLIO_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) { return store.dispatch(createPortfolioDataAction(payload, meta)); },
    clear() { return store.dispatch({ type: PORTFOLIO_DATA_CLEAR }); }
  });
}
