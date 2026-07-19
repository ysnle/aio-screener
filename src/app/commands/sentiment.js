import { createSentimentDataAction, SENTIMENT_DATA_CLEAR } from '../../state/slices/sentiment.js';

export function createSentimentCommands({ store } = {}) {
  if (!store?.dispatch) throw new Error('SENTIMENT_COMMAND_STORE_INVALID');
  return Object.freeze({
    setData(payload, meta = {}) {
      return store.dispatch(createSentimentDataAction(payload, meta));
    },
    clear() {
      return store.dispatch({ type: SENTIMENT_DATA_CLEAR });
    }
  });
}
