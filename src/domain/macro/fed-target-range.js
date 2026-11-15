// The FOMC target range is one decision: its lower and upper bounds are read from one observation date or not at all.
// The two bounds arrive as separate series (FRED DFEDTARL / DFEDTARU) with their own dates, so a refresh that updated
// only one of them averaged an old upper bound with a new lower bound and printed the midpoint as current.
import { readNumber as finite } from '../shared/number.js';

/** { lower, upper, mid, asOf } when both bounds are present, ordered and dated the same day (or both undated); else null. */
export function fedTargetRange(lower, upper, lowerAsOf, upperAsOf) {
  const lo = finite(lower), hi = finite(upper), day = String(upperAsOf || '').slice(0, 10);
  return lo == null || hi == null || lo > hi || String(lowerAsOf || '').slice(0, 10) !== day ? null : { lower: lo, upper: hi, mid: (lo + hi) / 2, asOf: day || null };
}
