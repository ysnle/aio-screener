export const CHOICE_WORDS = Object.freeze({
  favored: '비용이 작은 쪽',
  favoredState: '비용이 작음',
  costlyState: '비용이 큼'
});
// The kind of ground a favoured or costly choice stands on (the decision frame's labels), here so boot readers
// such as the market guide can name it without importing the lazy frame (src/domain/scenarios/decision-frame.js).
export const GROUND_LABELS = Object.freeze({ 'cost-hypothesis': '비용 가설', 'past-record': '과거 기록', none: '' });
