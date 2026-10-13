// RM-03 item 2: extracted from index.html:calcLiveRS/classifyRRG. Pure function: no DOM, no
// global reads — every value the legacy wrapper read from its own live-quote/price-history
// globals is now an explicit parameter. The formula (RS-Ratio/RS-Momentum thresholds, quadrant
// boundaries) is transcribed unchanged — this is code motion, not a new model (R352/F-03).
export const RRG_MODEL_VERSION = 'rrg.v2';

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function classifyRRG(rsRatio, rsMom) {
  const ratio = positive(rsRatio);
  const momentum = positive(rsMom);
  if (ratio == null || momentum == null) return Object.freeze({ rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'invalid_rotation', modelVersion: RRG_MODEL_VERSION });
  const quadrant = ratio >= 100 && momentum >= 100 ? 'Leading'
    : ratio < 100 && momentum >= 100 ? 'Improving'
    : ratio >= 100 && momentum < 100 ? 'Weakening'
    : 'Lagging';
  return Object.freeze({ rsRatio: ratio, rsMom: momentum, quadrant, modelVersion: RRG_MODEL_VERSION });
}

/**
 * @param {object} input
 * @param {number[]|null} input.history           daily close series for the symbol
 * @param {number[]|null} input.benchmarkHistory   daily close series for the benchmark (SPY)
 * @param {boolean} input.hasQuote            whether a live tick exists for the symbol
 * @param {boolean} input.hasBenchmarkQuote   whether a live tick exists for the benchmark
 */
// P1591 (T02): one minimum for the client fallback and the produced artifact (alignedSessionCount >= 30).
export const RRG_MIN_SESSIONS = 30;
export function computeRelativeRotation({ history = null, benchmarkHistory = null, hasQuote = false, hasBenchmarkQuote = false } = {}) {
  const hasHist = Array.isArray(history) && history.length >= RRG_MIN_SESSIONS && Array.isArray(benchmarkHistory) && benchmarkHistory.length >= RRG_MIN_SESSIONS;
  if (!hasHist && (!hasQuote || !hasBenchmarkQuote)) {
    return Object.freeze({ rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'quote_missing', modelVersion: RRG_MODEL_VERSION });
  }
  if (hasHist) {
    const n = Math.min(history.length, benchmarkHistory.length);
    // Histories end at the current observation. Align the overlapping tail;
    // pairing an asset's newest N bars with a longer benchmark's oldest N bars
    // creates a non-contemporaneous relative-strength series.
    const assetHistory = history.slice(-n);
    const alignedBenchmarkHistory = benchmarkHistory.slice(-n);
    const rsVals = [];
    for (let i = 0; i < n; i++) {
      const asset = positive(assetHistory[i]);
      const benchmark = positive(alignedBenchmarkHistory[i]);
      if (asset != null && benchmark != null) rsVals.push(asset / benchmark);
    }
    if (rsVals.length >= RRG_MIN_SESSIONS) {
      const rsLatest = rsVals[rsVals.length - 1];
      const rsAvg = rsVals.reduce((sum, value) => sum + value, 0) / rsVals.length;
      const rsRatio = rsAvg > 0 ? (100 * rsLatest) / rsAvg : 100;
      const mid = Math.floor(rsVals.length / 2);
      const rsMid = rsVals[mid] || rsVals[0];
      const rsMidAvg = rsVals.slice(0, mid + 1).reduce((sum, value) => sum + value, 0) / (mid + 1);
      const rsMidRatio = rsMidAvg > 0 ? (100 * rsMid) / rsMidAvg : 100;
      const rsMom = rsMidRatio > 0 ? (100 * rsRatio) / rsMidRatio : 100;
      return classifyRRG(rsRatio, rsMom);
    }
  }
  return Object.freeze({ rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'relative_history_lt_30', modelVersion: RRG_MODEL_VERSION });
}

// Expert review M09: the scatter used a fixed ±3.5 window around 100, so 8 of 11 sectors sat clipped on the edge
// (XLI·XLY·XLRE·XLU on one corner point). The axes now span the plotted points, always include the 100 baseline
// that splits the quadrants, and carry round tick values so a position can be read back.
function niceStep(span, target = 5) {
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function axisOf(values) {
  const list = values.filter((value) => Number.isFinite(value));
  let min = Math.min(100, ...list);
  let max = Math.max(100, ...list);
  const pad = Math.max(0.5, (max - min) * 0.08);
  min -= pad; max += pad;
  const step = niceStep(max - min);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const ticks = [];
  for (let tick = min; tick <= max + step / 1e6; tick += step) ticks.push(Number(tick.toFixed(6)));
  return Object.freeze({ min, max, step, ticks: Object.freeze(ticks) });
}

export function rrgAxisDomain(points = []) {
  const list = (points || []).filter((point) => Number.isFinite(point?.rsRatio) && Number.isFinite(point?.rsMomentum));
  return Object.freeze({ x: axisOf(list.map((point) => point.rsRatio)), y: axisOf(list.map((point) => point.rsMomentum)) });
}
