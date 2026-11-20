import { RULES } from '../../rules/thresholds.js';
import { finiteNumber as finite } from '../../shared/number.js';

// v59.70 (owner 11/4): the put/call bands left with the Cboe source (its terms forbid storing the statistics).
// P1534: the same 18 / 25 / 32 edges as RULES.volatility and the legacy regime alert (16 / 35 had no source).
// One row per band, highest first: `from` is the band's lower edge (inclusive), `to` the next band's edge.
export const VIX_BANDS = Object.freeze([
  Object.freeze({ from: RULES.volatility.highAt, to: null, label: '고변동 구간' }),
  Object.freeze({ from: RULES.volatility.stressAt, to: RULES.volatility.highAt, label: '변동성 경계 구간' }),
  Object.freeze({ from: RULES.volatility.calmBelow, to: RULES.volatility.stressAt, label: '통상 범위' }),
  Object.freeze({ from: null, to: RULES.volatility.calmBelow, label: '저변동 구간' })
]);

/** The VIX_BANDS row a VIX level sits in, or null for a missing or negative value. */
export function vixBandRow(value) {
  const vix = finite(value);
  if (vix == null || vix < 0) return null;
  return VIX_BANDS.find((row) => row.from == null || vix >= row.from);
}

export function vixBand(value) {
  const row = vixBandRow(value);
  if (!row) return Object.freeze({ value: null, label: '판정 보류', blocked: true });
  return Object.freeze({ value: finite(value), label: row.label, blocked: false });
}
