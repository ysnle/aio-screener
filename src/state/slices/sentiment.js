export const SENTIMENT_DATA_SET = 'data/sentiment';
export const SENTIMENT_DATA_CLEAR = 'data/sentiment/clear';

export function createInitialSentimentState() {
  return Object.freeze({ values: {}, revision: null, updatedAt: null });
}

export function createSentimentDataAction(payload = {}, meta = {}) {
  return Object.freeze({
    type: SENTIMENT_DATA_SET,
    payload: { ...payload },
    meta: { ...meta }
  });
}

export function sentimentReducer(state = createInitialSentimentState(), action = {}) {
  if (action.type === SENTIMENT_DATA_SET) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return {
      values: { ...payload },
      revision: action.meta?.revision || payload.revision || state.revision || null,
      updatedAt: action.meta?.updatedAt || payload.now || state.updatedAt || null
    };
  }
  if (action.type === SENTIMENT_DATA_CLEAR) return createInitialSentimentState();
  return state;
}
