export const SIGNAL_MODEL_VERSION = 'signal.v1';

export function deriveSignalDecision({ technical = {}, sentiment = {}, market = {}, inputVersion = 'unknown' } = {}) {
  const scoreParts = [technical?.trend === 'above-ma20' ? 1 : technical?.trend === 'below-ma20' ? -1 : null, sentiment?.fearGreed == null ? null : sentiment.fearGreed >= 70 ? -1 : sentiment.fearGreed <= 30 ? 1 : 0, market?.breadthAdvanceRatio == null ? null : market.breadthAdvanceRatio >= 1 ? 1 : -1].filter((value) => value != null);
  if (!scoreParts.length) return Object.freeze({ modelVersion: SIGNAL_MODEL_VERSION, inputVersion, status: 'blocked', action: 'WAIT', score: null, reasons: ['required-input-missing'] });
  const score = scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length;
  const action = score >= 0.34 ? 'WATCH' : score <= -0.34 ? 'REDUCE' : 'WAIT';
  return Object.freeze({ modelVersion: SIGNAL_MODEL_VERSION, inputVersion, status: scoreParts.length === 3 ? 'current' : 'partial', action, score, reasons: scoreParts.length < 3 ? ['partial-input'] : [] });
}
