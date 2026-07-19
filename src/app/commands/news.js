import { createNewsDataAction, NEWS_DATA_CLEAR } from '../../state/slices/news.js';

export function createNewsCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('NEWS_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) {
      return store.dispatch(createNewsDataAction(payload, meta));
    },
    clear() {
      return store.dispatch({ type: NEWS_DATA_CLEAR });
    }
  });
}
