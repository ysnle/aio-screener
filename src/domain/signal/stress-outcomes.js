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

// v57.50 D08: consecutive forward windows overlap, so a horizon-h mean rests on about n/h independent windows. The
// standard error of the mean uses that effective count (nEff = n / h), not the day count.
export function meanStandardError({ sd, n, horizon }) {
  if (!Number.isFinite(sd) || !Number.isFinite(n) || n < 2 || !Number.isFinite(horizon) || horizon < 1) return null;
  return sd / Math.sqrt(Math.max(1, n / horizon));
}

function summarize(returns, horizon) {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return { n: 0, mean: null, median: null, hitRate: null, p10: null, p90: null, sd: null, nEff: 0, se: null };
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const sd = n > 1 ? Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean: round(mean), median: round(percentile(sorted, 0.5)),
    hitRate: round((sorted.filter((value) => value > 0).length / n) * 100, 1), p10: round(percentile(sorted, 0.1)), p90: round(percentile(sorted, 0.9)),
    sd: round(sd), nEff: round(n / horizon, 1), se: round(meanStandardError({ sd, n, horizon })) };
}

// v57.50 D07: a session that dips out of a band for a day or two and comes back is the same stress spell. A new run
// that starts within CLUSTER_GAP sessions of the band's previous run joins that run's cluster; the cluster count is
// the number of separate spells, the run count (episodes) stays for continuity.
export const CLUSTER_GAP_SESSIONS = 21;

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
  const perBand = new Map(STRESS_BANDS.map((band) => [band.id, { episodes: 0, clusters: 0, shortRuns: 0, runLength: 0, lastIndex: null, returns: Object.fromEntries(horizons.map((h) => [h, []])) }]));
  const all = Object.fromEntries(horizons.map((h) => [h, []]));
  let previousBand = null;
  const closeRun = (bucket) => { if (bucket && bucket.runLength && bucket.runLength <= 3) bucket.shortRuns += 1; if (bucket) bucket.runLength = 0; };
  rows.forEach(([date, close]) => {
    const index = sessionIndex.get(date);
    const band = stressBandOf(vixByDate.get(date));
    if (!band) return;
    const bucket = perBand.get(band.id);
    // An episode is a run of consecutive sessions in one band. Forward windows overlap inside a run and across
    // adjacent runs, so the run count is a smaller, more honest sample size than the day count — still not a
    // count of fully independent observations. D07: runs that restart within CLUSTER_GAP_SESSIONS form one cluster.
    if (band.id !== previousBand) {
      closeRun(previousBand ? perBand.get(previousBand) : null);
      bucket.episodes += 1;
      if (bucket.lastIndex == null || index - bucket.lastIndex > CLUSTER_GAP_SESSIONS) bucket.clusters += 1;
    }
    bucket.runLength += 1;
    bucket.lastIndex = index;
    previousBand = band.id;
    for (const horizon of horizons) {
      const future = sessions[index + horizon];
      if (!future) continue;
      const change = (future[1] / close - 1) * 100;
      bucket.returns[horizon].push(change);
      all[horizon].push(change);
    }
  });
  closeRun(previousBand ? perBand.get(previousBand) : null);
  return {
    from: rows[0]?.[0] || null,
    to: rows.at(-1)?.[0] || null,
    days: rows.length,
    clusterGapSessions: CLUSTER_GAP_SESSIONS,
    bands: STRESS_BANDS.map((band) => ({ id: band.id, label: band.label, episodes: perBand.get(band.id).episodes,
      clusters: perBand.get(band.id).clusters, shortRuns: perBand.get(band.id).shortRuns,
      horizons: Object.fromEntries(horizons.map((h) => [h, summarize(perBand.get(band.id).returns[h], h)])) })),
    all: Object.fromEntries(horizons.map((h) => [h, summarize(all[h], h)]))
  };
}
