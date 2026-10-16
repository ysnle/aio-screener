// v57.60: return-statistics helpers extracted from backtest.js (pure; no DOM, no globals). backtest.js
// re-exports the same names, so bootstrap's _stat* compatibility bindings and the module API are unchanged.

function _statMean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

function _statStdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = _statMean(arr);
  const variance = arr.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── 22:PFR05 (E4) sample-stability verification ──────────────────────────────
// VaR/CVaR may be trusted only when the sample is stable and the estimate is
// insensitive to the estimator chosen. The bootstrap derives its seed from the
// sample itself, so the same input replays the same band (R630) without a clock
// or Math.random. Sensitivity re-estimates on the same sample with other rules.
// The thresholds travel with the result — a certification without a declared
// threshold is the same unbacked claim the hold replaced.
function _btFnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

function _btMulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _btTailRisk(values, quantile) {
  const sorted = values.slice().sort((a, b) => a - b);
  const cut = _quantileR7(sorted, quantile);
  const tail = sorted.filter((value) => value <= cut);
  return {
    var: Math.max(0, -cut),
    cvar: tail.length ? Math.max(0, -_statMean(tail)) : null,
    tailN: tail.length,
    cut
  };
}

// P1243: the `recent-half` sensitivity variant reads the sample's second half *in the order given*, so
// it is only meaningful for a time-ordered sample. P1203 fixed the caller that passed a sorted sample,
// but the function still assumed that contract instead of verifying it. A dated sample is now checked
// for non-decreasing observation time; otherwise the caller must declare `order: 'chronological'`. An
// unverified order withholds the variant and holds certification, so the assumption cannot silently
// return.
function _btVarOrderAudit(values, order, observedAt) {
  const stamps = Array.isArray(observedAt)
    ? observedAt.map((value) => (Number.isFinite(Number(value)) ? Number(value) : null))
    : null;
  if (stamps && stamps.length === values.length && stamps.every((value) => value != null)) {
    for (let i = 1; i < stamps.length; i += 1) if (stamps[i] < stamps[i - 1]) return { state: 'violated', usable: false };
    return { state: 'verified', usable: true };
  }
  return order === 'chronological' ? { state: 'declared', usable: true } : { state: 'undeclared', usable: false };
}

function deriveVarStability({ returns = [], iterations = 400, quantile = 0.05, thresholds = {}, order = 'unspecified', observedAt = null } = {}) {
  const clean = (Array.isArray(returns) ? returns : []).filter((value) => typeof value === 'number' && isFinite(value));
  const declared = {
    minSampleN: Number.isFinite(thresholds.minSampleN) ? thresholds.minSampleN : 41, // v57.84: the 5% R7 tail holds ≥3 points only from n=41; 36 always held
    minTailN: Number.isFinite(thresholds.minTailN) ? thresholds.minTailN : 3,
    maxRelativeBand: Number.isFinite(thresholds.maxRelativeBand) ? thresholds.maxRelativeBand : 0.75,
    maxRelativeSensitivity: Number.isFinite(thresholds.maxRelativeSensitivity) ? thresholds.maxRelativeSensitivity : 0.5
  };
  if (clean.length < 2) {
    return { status: 'unavailable', reason: 'insufficient-sample', sampleN: clean.length, thresholds: declared, certification: 'held', certificationReasons: ['sample-below-declared-minimum'] };
  }
  const point = _btTailRisk(clean, quantile);

  const random = _btMulberry32(_btFnv1a(clean.map((value) => Number(value).toFixed(8)).join(',')));
  const varSamples = [];
  const draws = Math.max(1, Math.floor(iterations));
  for (let i = 0; i < draws; i += 1) {
    const resample = new Array(clean.length);
    for (let j = 0; j < clean.length; j += 1) resample[j] = clean[Math.floor(random() * clean.length)];
    varSamples.push(_btTailRisk(resample, quantile).var);
  }
  const sortedVars = varSamples.slice().sort((a, b) => a - b);
  const band = { p05: _quantileR7(sortedVars, 0.05), median: _quantileR7(sortedVars, 0.5), p95: _quantileR7(sortedVars, 0.95) };
  const relativeBand = point.var > 0 ? (band.p95 - band.p05) / point.var : null;

  const orderAudit = _btVarOrderAudit(clean, order, observedAt);
  const ascending = clean.slice().sort((a, b) => a - b);
  const nearestIndex = Math.max(0, Math.min(ascending.length - 1, Math.ceil(quantile * ascending.length) - 1));
  const variants = [
    { id: 'nearest-rank', var: Math.max(0, -ascending[nearestIndex]) },
    { id: 'leave-one-worst-out', var: ascending.length > 2 ? _btTailRisk(ascending.slice(1), quantile).var : null },
    { id: 'recent-half', var: orderAudit.usable && clean.length >= 4 ? _btTailRisk(clean.slice(Math.floor(clean.length / 2)), quantile).var : null }
  ].filter((entry) => entry.var != null && isFinite(entry.var))
    .map((entry) => ({ id: entry.id, var: entry.var, deviation: entry.var - point.var }));
  const maxAbsDeviation = variants.length ? Math.max.apply(null, variants.map((entry) => Math.abs(entry.deviation))) : null;
  const relativeSensitivity = point.var > 0 && maxAbsDeviation != null ? maxAbsDeviation / point.var : null;

  const reasons = [];
  if (clean.length < declared.minSampleN) reasons.push('sample-below-declared-minimum');
  if (point.tailN < declared.minTailN) reasons.push('tail-below-declared-minimum');
  if (relativeBand == null || relativeBand > declared.maxRelativeBand) reasons.push('bootstrap-band-exceeds-declared-maximum');
  if (relativeSensitivity == null || relativeSensitivity > declared.maxRelativeSensitivity) reasons.push('estimator-sensitivity-exceeds-declared-maximum');
  if (!orderAudit.usable) reasons.push(`recent-half-order-${orderAudit.state}`);

  return {
    status: 'ready',
    quantile,
    sampleN: clean.length,
    tailN: point.tailN,
    point: { var: point.var, cvar: point.cvar },
    bootstrap: { iterations: draws, seed: 'sample-derived-fnv1a', band, relativeBand },
    sensitivity: { variants, maxAbsDeviation, relativeSensitivity, recentHalfOrder: orderAudit.state },
    thresholds: declared,
    certification: reasons.length ? 'held' : 'certified',
    certificationReasons: reasons
  };
}

function _quantileR7(sorted, p) {
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function _calcSharpe(returns, rfRate) {
  if (!returns || returns.length < 10 || typeof rfRate !== 'number' || !isFinite(rfRate) || rfRate <= -1) return null;
  var clean = returns.filter(function(r) { return typeof r === 'number' && isFinite(r); });
  if (clean.length < 10) return null;
  var rfDaily = Math.pow(1 + rfRate, 1 / 252) - 1;
  var excess = clean.map(function(r) { return r - rfDaily; });
  var mean = _statMean(excess);
  var std = _statStdDev(excess);
  if (std < 1e-10) return null;  // v48.95 P1-9: near-zero std → null (division-by-zero 방지)
  return (mean / std) * Math.sqrt(252);
}

/**
 * 최대낙폭 (Max Drawdown) — 누적 수익률 고점 대비 최대 하락폭
 * @param {number[]} returns - 일별 수익률 배열
 * @returns {{mdd: number, peakIdx: number, troughIdx: number}|null}
 */
function _calcMaxDrawdown(returns) {
  if (!returns || returns.length < 2) return null;
  var cum = [1];
  for (var i = 0; i < returns.length; i++) {
    cum.push(cum[cum.length - 1] * (1 + returns[i]));
  }
  var maxMdd = 0, peak = cum[0], peakIdx = 0, troughIdx = 0, tempPeak = 0;
  for (var j = 1; j < cum.length; j++) {
    if (cum[j] > peak) { peak = cum[j]; tempPeak = j; }
    var dd = (peak - cum[j]) / peak;
    if (dd > maxMdd) { maxMdd = dd; peakIdx = tempPeak; troughIdx = j; }
  }
  return { mdd: maxMdd, peakIdx: peakIdx, troughIdx: troughIdx };
}

/**
 * Pearson 상관계수 (두 등길이 배열)
 */
function _pearsonCorr(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 2) return 0;
  var n = a.length;
  var mA = _statMean(a), mB = _statMean(b);
  var num = 0, denA = 0, denB = 0;
  for (var i = 0; i < n; i++) {
    var da = a[i] - mA, db = b[i] - mB;
    num += da * db; denA += da * da; denB += db * db;
  }
  if (denA < 1e-12 || denB < 1e-12) return 0;  // v48.95 P1-3: near-zero denom EPS → NaN 방지
  return num / Math.sqrt(denA * denB);
}

/**
 * 상관계수 매트릭스 (Pearson, n×n)
 * @param {Object} returnsMap - { ticker: number[] } 수익률 맵
 * @returns {{tickers: string[], matrix: number[][]}|null}
 */
function _calcCorrelationMatrix(returnsMap) {
  var tickers = Object.keys(returnsMap);
  if (tickers.length < 2) return null;
  var matrix = tickers.map(function(t1) {
    return tickers.map(function(t2) {
      if (t1 === t2) return 1;
      var r1 = returnsMap[t1], r2 = returnsMap[t2];
      var minLen = Math.min(r1.length, r2.length);
      return _pearsonCorr(r1.slice(r1.length - minLen), r2.slice(r2.length - minLen));
    });
  });
  return { tickers: tickers, matrix: matrix };
}

export {
  _statMean,
  _statStdDev,
  _btFnv1a,
  _btMulberry32,
  _btTailRisk,
  _btVarOrderAudit,
  deriveVarStability,
  _quantileR7,
  _calcSharpe,
  _calcMaxDrawdown,
  _pearsonCorr,
  _calcCorrelationMatrix
};
