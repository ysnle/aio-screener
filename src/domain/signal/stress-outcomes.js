// P1661 (owner 2026-10-12, option 나): the composite market score failed validation, so the screen shows what
// actually happened after past days in the same stress band instead of a score. Stress is the VIX close (the
// input that carried most of the old score's signal); outcomes are the S&P 500's forward price returns.
// Pure function shared by the producer (scripts/build-stress-outcomes.mjs) and the regression fixture.

// T14 (expert review 2026-10-13, coordinator decision): these producer bands (15/20/25/30/40) stay as published so the
// artifact and its history keep one definition; they are outcome buckets, not RULES.volatility (18/25/32) judgement edges,
// and the screen says so in one line.
export const STRESS_BANDS = Object.freeze([
  Object.freeze({ id: 'calm', label: 'VIX 15 미만', min: -Infinity, max: 15 }),
  Object.freeze({ id: 'normal', label: '15~20', min: 15, max: 20 }),
  Object.freeze({ id: 'elevated', label: '20~25', min: 20, max: 25 }),
  Object.freeze({ id: 'high', label: '25~30', min: 25, max: 30 }),
  Object.freeze({ id: 'stress', label: '30~40', min: 30, max: 40 }),
  Object.freeze({ id: 'panic', label: '40 이상', min: 40, max: Infinity })
]);
export const STRESS_HORIZONS = Object.freeze([21, 63]);

export function stressBandOf(vix) {
  const value = Number(vix);
  if (!Number.isFinite(value) || value <= 0) return null;
  return STRESS_BANDS.find((band) => value >= band.min && value < band.max) || null;
}

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index];
};

function summarize(returns) {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return { n: 0, mean: null, median: null, hitRate: null, p10: null };
  return { n, mean: round(sorted.reduce((sum, value) => sum + value, 0) / n), median: round(percentile(sorted, 0.5)),
    hitRate: round((sorted.filter((value) => value > 0).length / n) * 100, 1), p10: round(percentile(sorted, 0.1)) };
}

/**
 * @param {Array<[string, number]>} spx  date-sorted [date, close]
 * @param {Array<[string, number]>} vix  [date, close]; joined to spx by date
 * @returns {{ from, to, days, bands: Array, all: object }}
 */
export function buildStressOutcomes(spx = [], vix = [], { horizons = STRESS_HORIZONS } = {}) {
  const vixByDate = new Map(vix.filter(([, value]) => Number.isFinite(value) && value > 0));
  // X19 (2026-10-13): the forward horizon counts S&P 500 sessions. Counting it on the VIX-joined subset shifted the
  // axis whenever a VIX close was missing (21 rows could span 22+ sessions), so the horizon walks the full series.
  const sessions = spx.filter(([date, close]) => Number.isFinite(close) && close > 0).sort((a, b) => a[0].localeCompare(b[0]));
  const sessionIndex = new Map(sessions.map(([date], index) => [date, index]));
  const rows = sessions.filter(([date]) => vixByDate.has(date));
  const perBand = new Map(STRESS_BANDS.map((band) => [band.id, { episodes: 0, returns: Object.fromEntries(horizons.map((h) => [h, []])) }]));
  const all = Object.fromEntries(horizons.map((h) => [h, []]));
  let previousBand = null;
  rows.forEach(([date, close]) => {
    const index = sessionIndex.get(date);
    const band = stressBandOf(vixByDate.get(date));
    if (!band) return;
    const bucket = perBand.get(band.id);
    // An episode is a run of consecutive sessions in one band. Forward windows overlap inside a run and across
    // adjacent runs, so the run count is a smaller, more honest sample size than the day count — still not a
    // count of fully independent observations.
    if (band.id !== previousBand) bucket.episodes += 1;
    previousBand = band.id;
    for (const horizon of horizons) {
      const future = sessions[index + horizon];
      if (!future) continue;
      const change = (future[1] / close - 1) * 100;
      bucket.returns[horizon].push(change);
      all[horizon].push(change);
    }
  });
  return {
    from: rows[0]?.[0] || null,
    to: rows.at(-1)?.[0] || null,
    days: rows.length,
    bands: STRESS_BANDS.map((band) => ({ id: band.id, label: band.label, episodes: perBand.get(band.id).episodes,
      horizons: Object.fromEntries(horizons.map((h) => [h, summarize(perBand.get(band.id).returns[h])])) })),
    all: Object.fromEntries(horizons.map((h) => [h, summarize(all[h])]))
  };
}
