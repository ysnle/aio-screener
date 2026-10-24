// v57.81 (analysis audit 2026-10-15): the 테마·섹터 verdicts come from slow windows — the theme stage from 6-month (KR
// 3-month) and 1-month medians, the sector rotation from a ~50-session momentum — while semis and AI infra fell 12.6% and
// 12.7% in five sessions and SMH's relative strength 8.8%. One owner for the two checks every slow verdict now passes:
//   1. relative, banded: "ahead of the market" means ahead of the S&P 500 (KR: KOSPI) over the SAME window by more than
//      a band, never "above 0". The band is a typical sector tracking error (about 5% a year, so 1.5%p a month) scaled by
//      the square root of the window length — a property of how sectors move against an index, not of this week.
//   2. recent contradiction: when the last five sessions move against the verdict by more than twice the series' own
//      typical weekly move (median absolute 5-session move), the label says so and drops present-tense direction words.
// The RRG neutral band (경계) also lives here so every reader of sector rotation (테마·섹터, the market screens) shares it.
import { buildCloseSeries } from '../market/close-series.js';
import { classifyRRG, RRG_QUADRANT_WORDS } from './rrg.js';

export const RECENT_SESSIONS = 5;
export const NOISE_MULTIPLE = 2;
/** RS-Ratio / RS-Momentum points around 100 that are too close to call a quadrant (both axes) when no trail exists. */
export const RRG_NEUTRAL_BAND = 1;
// v57.84 (owner decision, TECHNICAL-DEFINITIONS 3-3 안 A): with the produced trail the band is each sector's own typical
// 5-session move on that axis (median |change|), held inside [RRG_BAND_MIN, RRG_BAND_MAX]; a fixed ±1 was narrower than a
// normal week for most of the 31 ETFs (0.65–4.1 on RS-Ratio, 1.3–9.8 on RS-Momentum) and ICLN changed quadrant 9 times in
// 20 sessions. Hysteresis: a side is entered beyond 100 ± band and left only past the other side's band × RRG_EXIT_SHARE.
export const RRG_BAND_MIN = 0.5;
export const RRG_BAND_MAX = 3;
export const RRG_EXIT_SHARE = 0.5;
const RRG_MIN_TRAIL = 10;
// Audit 2026-10-17 (owner D4): the band is one standard deviation of a theme's return less its index's. It assumed a 5%/yr
// tracking error (1-month ±1.5%p, 6-month ±3.7%p); the 31 sector/theme ETFs measured 13–44%/yr against SPY (median
// 22.8%), so a noise-sized gap read 주도 or 약세. 15%/yr is the low end of that range — narrow enough that a real lead
// still reads, and a theme median of 20+ names tracks closer than a single ETF.
export const ANNUAL_TRACKING_ERROR_PCT = 15;
/** %p per month: ANNUAL_TRACKING_ERROR_PCT ÷ √12 (≈ 4.3). */
export const MONTHLY_RELATIVE_BAND = ANNUAL_TRACKING_ERROR_PCT / Math.sqrt(12);
/** Typical 5-session move of a theme's return less its index's (median |x| of that tracking error over five sessions). */
export const WEEKLY_RELATIVE_NOISE = ANNUAL_TRACKING_ERROR_PCT * Math.sqrt(5 / 252) * 0.6745;
export const WINDOW_SESSIONS = Object.freeze({ ret5d: 5, ret1m: 21, ret3m: 63, ret6m: 126 });
export const WINDOW_LABELS = Object.freeze({ ret5d: '5거래일', ret1m: '1개월', ret3m: '3개월', ret6m: '6개월' });
// A normal variable's median absolute value is 0.6745 σ; σ of a 5-session move is the annual σ × √(5/252).
const MEDIAN_ABS_OF_SIGMA = 0.6745;

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const round1 = (value) => Math.round(value * 10) / 10;
export const signedPct = (value, unit = '%') => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${unit}`);
export function medianOf(values) {
  const list = (values || []).filter((value) => finite(value) != null).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

/** ± band in %p for "ahead of / behind the market" over a window key (ret1m 4.3, ret3m 7.5, ret6m 10.6). */
export function relativeBand(key) {
  const sessions = WINDOW_SESSIONS[key];
  return sessions ? round1(MONTHLY_RELATIVE_BAND * Math.sqrt(sessions / WINDOW_SESSIONS.ret1m)) : null;
}

/** Benchmark close returns over the same session counts, ending at `through` (the theme's own close date). */
export function marketWindowReturns(history = [], field = 'spx', { through = null } = {}) {
  const series = buildCloseSeries(history, field, through ? { through } : {});
  const last = series[series.length - 1];
  const out = { field, asOf: last?.date || null, from: {} };
  for (const [key, n] of Object.entries(WINDOW_SESSIONS)) {
    const then = series.length > n ? series[series.length - 1 - n] : null;
    out[key] = last && then ? (last.value / then.value - 1) * 100 : null;
    out.from[key] = then?.date || null;
  }
  return out;
}

/** Average pairwise correlation of stocks inside one industry group (a common stylised value, about 0.5). */
export const WITHIN_GROUP_CORRELATION = 0.5;
/**
 * Typical weekly move (median absolute 5-session %) of a group's median from its members' annualised volatility.
 * A median of n members with average pairwise correlation ρ moves about σ·√(ρ + (1−ρ)/n), so a 30-name theme is not
 * held to a single stock's weekly swing. members = 1 gives a single series' own typical weekly move.
 */
export function weeklyNoiseFromVol(annualVolPct, { members = 1, correlation = WITHIN_GROUP_CORRELATION } = {}) {
  const vol = finite(annualVolPct);
  if (vol == null || vol <= 0) return null;
  const n = Math.max(1, Math.round(finite(members) ?? 1));
  return vol * Math.sqrt(correlation + (1 - correlation) / n) * Math.sqrt(WINDOW_SESSIONS.ret5d / 252) * MEDIAN_ABS_OF_SIGMA;
}

/**
 * Five-session contradiction of a slow verdict. `move` is the group's 5-session return less the benchmark's when both
 * exist (leadership is relative), else the group's own. `broken` = fell more than NOISE_MULTIPLE × the typical weekly move.
 * Audit 2026-10-17 (D4): a relative move is held to the relative noise (tracking error), not the members' own volatility,
 * which is several times larger and kept 급락 from reading; `noise` stays the yardstick for an own-return move.
 */
export function recentMove({ ret5d = null, benchRet5d = null, noise = null, relativeNoise = WEEKLY_RELATIVE_NOISE } = {}) {
  const own = finite(ret5d);
  if (own == null) return null;
  const bench = finite(benchRet5d);
  const move = bench == null ? own : own - bench;
  const typical = bench == null ? finite(noise) : finite(relativeNoise);
  const threshold = typical == null ? null : NOISE_MULTIPLE * typical;
  return Object.freeze({ ret5d: own, relative: bench != null, move, threshold, broken: threshold != null && move <= -threshold, surged: threshold != null && move >= threshold });
}

/** "최근 5거래일 -12.6%(S&P 500 대비 -10.4%p)" */
export function recentMoveText(check, { benchmarkName = 'S&P 500' } = {}) {
  if (!check) return '';
  return `최근 5거래일 ${signedPct(check.ret5d)}${check.relative ? `(${benchmarkName} 대비 ${signedPct(check.move, '%p')})` : ''}`;
}

function seriesValues(series) {
  return (Array.isArray(series) ? series : []).map((point) => finite(typeof point === 'number' ? point : point?.value)).filter((value) => value != null && value > 0);
}

/** Median absolute `lag`-session % change over the whole series (the series' own typical weekly move). */
export function medianAbsChange(series, lag = RECENT_SESSIONS) {
  const values = seriesValues(series);
  const changes = [];
  for (let i = lag; i < values.length; i += 1) changes.push(Math.abs((values[i] / values[i - lag] - 1) * 100));
  return changes.length >= 20 ? medianOf(changes) : null;
}

/** Five-session change of a relative-strength line against its own typical five-session move. */
export function rsRecentCheck(series, { sessions = RECENT_SESSIONS } = {}) {
  const values = seriesValues(series);
  if (values.length <= sessions) return null;
  const change = (values[values.length - 1] / values[values.length - 1 - sessions] - 1) * 100;
  const noise = medianAbsChange(values, sessions);
  const threshold = noise == null ? null : NOISE_MULTIPLE * noise;
  return Object.freeze({ change, noise, threshold, sessions, fell: threshold != null && change <= -threshold, rose: threshold != null && change >= threshold });
}

export { RRG_QUADRANT_WORDS };

const clampBand = (value) => Math.min(RRG_BAND_MAX, Math.max(RRG_BAND_MIN, value));
function trailPoints(trail, ratio, momentum) {
  const points = (Array.isArray(trail) ? trail : []).map((point) => [finite(point?.rsRatio), finite(point?.rsMomentum)]).filter(([r, m]) => r != null && m != null);
  const last = points.at(-1);
  if (!last || Math.abs(last[0] - ratio) > 1e-6 || Math.abs(last[1] - momentum) > 1e-6) points.push([ratio, momentum]);
  return points;
}
/** Per-axis band: the median absolute 5-session change on the trail (clamped), or null when the trail is too short. */
export function rrgNoiseBands(trail) {
  const points = (Array.isArray(trail) ? trail : []).map((point) => [finite(point?.rsRatio), finite(point?.rsMomentum)]).filter(([r, m]) => r != null && m != null);
  if (points.length < RRG_MIN_TRAIL) return null;
  const moves = (axis) => points.slice(RECENT_SESSIONS).map((point, i) => Math.abs(point[axis] - points[i][axis]));
  return Object.freeze({ ratio: clampBand(medianOf(moves(0))), momentum: clampBand(medianOf(moves(1))) });
}
// One axis through the trail: +1 / −1 once beyond 100 ± band, kept until it crosses past the other side's band × exit
// share, 0 (undecided) in between.
function settledSide(values, band) {
  let side = 0;
  for (const value of values) {
    if (side > 0 && value < 100 - band * RRG_EXIT_SHARE) side = 0;
    else if (side < 0 && value > 100 + band * RRG_EXIT_SHARE) side = 0;
    if (side === 0) side = value >= 100 + band ? 1 : value <= 100 - band ? -1 : 0;
  }
  return side;
}
/**
 * Quadrant with a neutral band: a point too close to 100 on either axis is 경계 between the quadrants it touches. With a
 * produced `trail` (rotation-history items) the band is the sector's own and the sides carry hysteresis; without one it is
 * the fixed ±RRG_NEUTRAL_BAND on the latest point. `quadrant` is the settled one; `raw` is classifyRRG's.
 */
export function rrgZone(rsRatio, rsMomentum, { band = RRG_NEUTRAL_BAND, trail = null } = {}) {
  const ratio = finite(rsRatio), momentum = finite(rsMomentum);
  if (ratio == null || momentum == null) return null;
  // v57.84: the raw quadrant boundaries are classifyRRG's (the producer's), not a second copy.
  const { quadrant: raw } = classifyRRG(ratio, momentum);
  if (raw === 'unknown') return null;
  const bands = rrgNoiseBands(trail);
  const points = bands ? trailPoints(trail, ratio, momentum) : [[ratio, momentum]];
  const bandRatio = bands ? bands.ratio : band, bandMomentum = bands ? bands.momentum : band;
  const sideR = settledSide(points.map(([r]) => r), bandRatio), sideM = settledSide(points.map(([, m]) => m), bandMomentum);
  const meta = { raw, bands: Object.freeze({ ratio: bandRatio, momentum: bandMomentum, basis: bands ? 'own-5-session-move' : 'fixed' }), hysteresis: !!bands };
  if (sideR && sideM) {
    const quadrant = sideR > 0 ? (sideM > 0 ? 'Leading' : 'Weakening') : (sideM > 0 ? 'Improving' : 'Lagging');
    return Object.freeze({ quadrant, border: false, between: null, ...meta });
  }
  const between = !sideR && !sideM ? '네 사분면'
    : !sideR ? (sideM > 0 ? '선도/개선' : '약화/후행')
      : (sideR > 0 ? '선도/약화' : '개선/후행');
  return Object.freeze({ quadrant: raw, border: true, between, ...meta });
}

/** v57.84: the settled quadrant of a produced rotation row (its trail's band + hysteresis): a quadrant, 'Border' or null. */
export function rrgSettledQuadrant(row) {
  const zone = rrgZone(row?.rsRatio, row?.rsMomentum, { trail: row?.trail || null });
  return zone ? (zone.border ? 'Border' : zone.quadrant) : null;
}

/**
 * One reading of a sector point: the banded zone, the ~50-session window named, and the last five sessions of the
 * relative-strength line when they run against the quadrant's direction (Leading/Improving = strengthening).
 */
export function rrgRecentReading(item, series = null) {
  const zone = rrgZone(item?.rsRatio, item?.rsMomentum, { trail: item?.trail || null });
  if (!zone) return null;
  const check = rsRecentCheck(series);
  // v57.84: the direction is the settled quadrant's (Leading/Improving = strengthening), not the raw momentum sign.
  const strengthening = zone.border ? finite(item.rsMomentum) >= 100 : zone.quadrant === 'Leading' || zone.quadrant === 'Improving';
  const reversal = check ? (strengthening && check.fell ? 'fell' : !strengthening && check.rose ? 'rose' : null) : null;
  // v57.84: tri-state for readers that colour a tone — null when the series or its typical move is missing (fails closed).
  const opposed = check == null || check.threshold == null ? null : reversal != null;
  const word = RRG_QUADRANT_WORDS[zone.quadrant];
  const head = zone.border ? `기준선 부근(${zone.between} 사이)` : `${word}(약 50일 기준)`;
  const clause = reversal ? `, 최근 5거래일 상대강도 ${signedPct(check.change)}로 ${reversal === 'fell' ? '반락' : '반등'}` : '';
  return Object.freeze({ ...zone, check, reversal, opposed, label: `${head}${clause}`, clause });
}
