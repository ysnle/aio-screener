import { deriveSentimentSummary } from '../../domain/sentiment/metrics.js';

export function selectSentimentState(state) {
  return state?.sentiment || null;
}

export function selectSentimentValues(state) {
  const sentiment = selectSentimentState(state);
  if (!sentiment) return {};
  return sentiment.values && typeof sentiment.values === 'object' ? sentiment.values : sentiment;
}

export function selectSentimentValue(state, metric) {
  return selectSentimentValues(state)[metric] ?? null;
}

export function selectSentimentSummary(state) {
  return deriveSentimentSummary(selectSentimentValues(state));
}
