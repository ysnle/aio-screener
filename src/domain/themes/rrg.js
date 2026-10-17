// RM-03 item 2: extracted from index.html:calcLiveRS/classifyRRG. Pure function: no DOM, no
// global reads — every value the legacy wrapper read from its own live-quote/price-history
// globals is now an explicit parameter. The formula (RS-Ratio/RS-Momentum thresholds, quadrant
// boundaries) is transcribed unchanged — this is code motion, not a new model (R352/F-03).
// Audit 2026-10-17 (owner D3): rrg.v3 — RS-Momentum compares RS-Ratio with itself RRG_MOMENTUM_LAG sessions earlier,
// both on the same RRG_RATIO_SESSIONS span; rrg.v2 divided a 100-session-window ratio by a ~51-session-window ratio
// at the midpoint, so a steady relative trend (no change in speed) read 102.5 (선도) or 97.6 (후행) instead of 100; on
// the 10/16 artifact 17 of the 31 ETFs sat in a different quadrant than the same-window reading.
export const RRG_MODEL_VERSION = 'rrg.v3';
export const RRG_RATIO_SESSIONS = 50;
export const RRG_MOMENTUM_LAG = 10;

// What the two axes are (rrg.v3). The produced artifact feeds the last 100 aligned sessions (scripts/lib/rotation-history.mjs):
//   RS-Ratio    = 100 × (price ÷ SPY now) ÷ (its average over the last 50 sessions) — a position, not "vs SPY = 100";
//   RS-Momentum = 100 × RS-Ratio ÷ (RS-Ratio 10 sessions earlier, on the same 50-session window) — 100 = steady.
// It is not the JdK smoothed/normalized RS-Ratio. The benchmark is cap-weighted SPY, so a few mega-caps leading the
// index put many sectors below 100 at once without any of them weakening on its own.
export const RRG_DEFINITION = Object.freeze({
  // v57.76: plain-Korean axis names (the themes scatter is the only reader).
  ratio: `가로축 상대강도(시장 대비)는 지금의 상대가격(섹터 ÷ SPY)이 최근 ${RRG_RATIO_SESSIONS}거래일 평균의 몇 %인지입니다(100 = 자기 평균 수준)`,
  momentum: `세로축 상대강도 변화 속도는 그 값이 ${RRG_MOMENTUM_LAG}거래일 전 같은 방식으로 잰 값보다 높은지입니다(100 초과 = 나아지는 중, 100 = 같은 속도 유지)`,
  benchmarkBias: '기준인 SPY는 시가총액 가중이라, 소수 초대형주가 지수를 끄는 국면에서는 여러 섹터가 동시에 100 아래(후행·약화)로 보일 수 있습니다 — 각 섹터가 스스로 약해졌다는 뜻은 아닙니다.'
});

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** v57.84: the one set of quadrant words and readings (themes scatter, chips, bars, stock summary). The readings name
 * both windows — RS-Ratio against its own 50-session average, RS-Momentum against 10 sessions ago (rrg.v3). */
export const RRG_QUADRANT_WORDS = Object.freeze({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' });
export const RRG_QUADRANT_READS = Object.freeze({
  Leading: '시장 대비 상대가격이 50일 평균보다 높고, 10거래일 전보다 그 격차가 커짐',
  Improving: '시장 대비 상대가격이 50일 평균보다 낮지만, 10거래일 전보다 그 격차가 줄어듦',
  Weakening: '시장 대비 상대가격이 50일 평균보다 높지만, 10거래일 전보다 그 격차가 줄어듦',
  Lagging: '시장 대비 상대가격이 50일 평균보다 낮고, 10거래일 전보다 그 격차가 커짐'
});

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
// v57.84 (owner decision, TECHNICAL-DEFINITIONS 3-3 안 A): the producer publishes this many daily points on the same model
// (each on its own trailing window) so a reader can size the boundary band from the sector's own movement and apply
// hysteresis without stored state (themes/recent-check.js rrgZone).
export const RRG_TRAIL_SESSIONS = 20;
export const RRG_WINDOW_SESSIONS = 100;

/** Daily (rsRatio, rsMomentum) for the last `sessions` sessions, oldest first; each point on its own trailing span. */
export function relativeRotationTrail({ history = [], benchmarkHistory = [], dates = [], sessions = RRG_TRAIL_SESSIONS, span = RRG_WINDOW_SESSIONS } = {}) {
  const n = Math.min(history.length, benchmarkHistory.length);
  const out = [];
  for (let k = sessions - 1; k >= 0; k--) {
    const end = n - k;
    if (end < RRG_MIN_SESSIONS) continue;
    const from = Math.max(0, end - span);
    const point = computeRelativeRotation({ history: history.slice(from, end), benchmarkHistory: benchmarkHistory.slice(from, end) });
    if (point.quadrant === 'unknown') continue;
    out.push(Object.freeze({ sessionDate: dates[end - 1] ?? null, rsRatio: Math.round(point.rsRatio * 1e4) / 1e4, rsMomentum: Math.round(point.rsMom * 1e4) / 1e4 }));
  }
  return out;
}
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
      // rrg.v3: one window for both points; a short history (30~59 sessions) shortens the window, never the lag.
      const window = Math.min(RRG_RATIO_SESSIONS, rsVals.length - RRG_MOMENTUM_LAG);
      const ratioAt = (end) => {
        const slice = rsVals.slice(end - window, end);
        const avg = slice.reduce((sum, value) => sum + value, 0) / window;
        return avg > 0 ? (100 * slice[slice.length - 1]) / avg : null;
      };
      const rsRatio = ratioAt(rsVals.length);
      const rsThen = ratioAt(rsVals.length - RRG_MOMENTUM_LAG);
      const rsMom = rsRatio != null && rsThen ? (100 * rsRatio) / rsThen : null;
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
