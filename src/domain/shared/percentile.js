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
