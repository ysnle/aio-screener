// RM-03 item 2: extracted from index.html:calcLiveRS/classifyRRG. Pure function: no DOM, no
// global reads — every value the legacy wrapper read from its own live-quote/price-history
// globals is now an explicit parameter. The formula (RS-Ratio/RS-Momentum thresholds, quadrant
// boundaries) is transcribed unchanged — this is code motion, not a new model (R352/F-03).
export const RRG_MODEL_VERSION = 'rrg.v1';

export function classifyRRG(rsRatio, rsMom) {
  const quadrant = rsRatio >= 100 && rsMom >= 100 ? 'Leading'
    : rsRatio < 100 && rsMom >= 100 ? 'Improving'
    : rsRatio >= 100 && rsMom < 100 ? 'Weakening'
    : 'Lagging';
  return Object.freeze({ rsRatio, rsMom, quadrant, modelVersion: RRG_MODEL_VERSION });
}

/**
 * @param {object} input
 * @param {number[]|null} input.history           daily close series for the symbol
 * @param {number[]|null} input.benchmarkHistory   daily close series for the benchmark (SPY)
 * @param {boolean} input.hasQuote            whether a live tick exists for the symbol
 * @param {boolean} input.hasBenchmarkQuote   whether a live tick exists for the benchmark
 */
export function computeRelativeRotation({ history = null, benchmarkHistory = null, hasQuote = false, hasBenchmarkQuote = false } = {}) {
  const hasHist = Array.isArray(history) && history.length > 20 && Array.isArray(benchmarkHistory) && benchmarkHistory.length > 20;
  if (!hasHist && (!hasQuote || !hasBenchmarkQuote)) {
    return Object.freeze({ rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'quote_missing', modelVersion: RRG_MODEL_VERSION });
  }
  if (Array.isArray(history) && history.length > 20 && Array.isArray(benchmarkHistory) && benchmarkHistory.length > 20) {
    const n = Math.min(history.length, benchmarkHistory.length);
    const rsVals = [];
    for (let i = 0; i < n; i++) {
      if (benchmarkHistory[i] > 0) rsVals.push(history[i] / benchmarkHistory[i]);
    }
    if (rsVals.length >= 10) {
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
  return Object.freeze({ rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'relative_history_lt_20', modelVersion: RRG_MODEL_VERSION });
}
