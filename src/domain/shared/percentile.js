// v59.59 (logic refactor): the one percentile of a value within a sample, for every "N년 중 몇 %" reading on screen.
// Before this file four modules ranked with two conventions: the fear-greed composite and the market temperature
// counted the latest value in its own sample, (below + ½·equal) ÷ n, so a one-year high read 99.8 and a low 0.2,
// while the regime radar and the record percentile ranked against the other observations and reached 0 and 100 —
// the same extreme printed two numbers. The convention kept is the mid-rank over the others (scripts/lib/rank-
// statistics.mjs percentileRank01 is the same): ties count half, the highest value is 100, the lowest 0.

/**
 * Percentile (0..100, unrounded) of `current` within `sample` (finite numbers). When `current` is one of the sample's
 * values, one copy of it is the observation itself and is left out; a value outside the sample is ranked against all of
 * it. null for an empty comparison set.
 */
export function percentileOf(sample, current) {
  if (typeof current !== 'number' || !Number.isFinite(current)) return null;
  let below = 0, equal = 0, n = 0;
  for (const value of Array.isArray(sample) ? sample : []) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    n += 1;
    if (value < current) below += 1; else if (value === current) equal += 1;
  }
  const others = equal > 0 ? n - 1 : n;
  if (others <= 0) return equal > 0 ? 50 : null;
  return (below + Math.max(0, equal - 1) / 2) / others * 100;
}
