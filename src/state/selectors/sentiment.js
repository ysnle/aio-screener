import { deriveSentimentSummary } from '../../domain/sentiment/metrics.js';
import { deriveSentimentViewModel } from '../../domain/sentiment/narrative.js';

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

export function selectSentimentViewModel(state, evidenceStore = null) {
  const sentiment = selectSentimentState(state);
  const values = selectSentimentValues(state);
  const getEvidence = (metric) => evidenceStore?.get?.(metric) || null;
  const evidenceByMetric = {
    fearGreed: getEvidence('fearGreed'),
    vix: getEvidence('vix'),
    putCall: getEvidence('putCall')
  };
  return deriveSentimentViewModel({ values, evidenceByMetric, revision: sentiment?.revision || null, now: sentiment?.updatedAt || null });
}
