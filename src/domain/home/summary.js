export const HOME_MODEL_VERSION = 'home.v1';

export function deriveHomeSummary({ sentiment = {}, signal = {}, market = {}, newsCount = 0, inputVersion = 'unknown' } = {}) {
  const available = [sentiment.fearGreed, sentiment.vix, market.breadthAdvanceRatio, signal.score].filter((value) => value != null).length;
  return Object.freeze({ modelVersion: HOME_MODEL_VERSION, inputVersion, status: available ? available >= 3 ? 'current' : 'partial' : 'unavailable', availableInputs: available, action: signal.action || 'WAIT', newsCount: Number.isFinite(newsCount) ? newsCount : 0 });
}
