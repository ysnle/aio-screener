export const HOME_MODEL_VERSION = 'home.v1';

export function deriveHomeSummary({ sentiment = {}, signal = {}, market = {}, newsCount = 0, inputVersion = 'unknown' } = {}) {
  const available = [sentiment.fearGreed, sentiment.vix, market.breadthAdvanceRatio, signal.score].filter((value) => typeof value === 'number' && Number.isFinite(value)).length;
  const count = typeof newsCount === 'number' && Number.isFinite(newsCount) && newsCount >= 0 ? newsCount : 0;
  return Object.freeze({ modelVersion: HOME_MODEL_VERSION, inputVersion, status: available ? available >= 3 ? 'current' : 'partial' : 'unavailable', availableInputs: available, action: signal.action || 'WAIT', newsCount: count });
}
