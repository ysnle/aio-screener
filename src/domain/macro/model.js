export const MACRO_MODEL_VERSION = 'macro.v1';

export function deriveMacroModel({ metrics = {}, inputVersion = 'unknown' } = {}) {
  const twoYear = Number(metrics.twoYear ?? metrics.y2);
  const tenYear = Number(metrics.tenYear ?? metrics.y10);
  const slope = Number.isFinite(twoYear) && Number.isFinite(tenYear) ? tenYear - twoYear : null;
  const observed = Object.values(metrics || {}).filter((value) => Number.isFinite(Number(value))).length;
  return Object.freeze({ modelVersion: MACRO_MODEL_VERSION, inputVersion, status: observed ? 'current' : 'unavailable', slope, regime: slope == null ? 'unknown' : slope < 0 ? 'inverted' : 'positive', metrics: { ...metrics } });
}
