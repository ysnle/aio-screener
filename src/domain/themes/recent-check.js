// v57.81 (analysis audit 2026-10-15): the 테마·섹터 verdicts come from slow windows — the theme stage from 6-month (KR
// 3-month) and 1-month medians, the sector rotation from a ~50-session momentum — while semis and AI infra fell 12.6% and
// 12.7% in five sessions and SMH's relative strength 8.8%. One owner for the two checks every slow verdict now passes:
//   1. relative, banded: "ahead of the market" means ahead of the S&P 500 (KR: KOSPI) over the SAME window by more than
//      a band, never "above 0". The band is a typical sector tracking error (about 5% a year, so 1.5%p a month) scaled by
//      the square root of the window length — a property of how sectors move against an index, not of this week.
//   2. recent contradiction: when the last five sessions move against the verdict by more than twice the series' own
//      typical weekly move (median absolute 5-session move), the label says so and drops present-tense direction words.
// The RRG neutral band (경계) also lives here so every reader of sector rotation (테마·섹터, the market screens) shares it.
import { buildCloseSeries } from '../briefing/market-read.js';

export const RECENT_SESSIONS = 5;
export const NOISE_MULTIPLE = 2;
/** RS-Ratio / RS-Momentum points around 100 that are too close to call a quadrant (both axes). */
export const RRG_NEUTRAL_BAND = 1;
/** %p per month: a typical sector's tracking error against its index (~5%/yr ÷ √12). */
export const MONTHLY_RELATIVE_BAND = 1.5;
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

/** ± band in %p for "ahead of / behind the market" over a window key (ret1m 1.5, ret3m 2.6, ret6m 3.7). */
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
 */
export function recentMove({ ret5d = null, benchRet5d = null, noise = null } = {}) {
  const own = finite(ret5d);
  if (own == null) return null;
  const bench = finite(benchRet5d);
  const move = bench == null ? own : own - bench;
  const typical = finite(noise);
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

export const RRG_QUADRANT_WORDS = Object.freeze({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' });

/** Quadrant with a neutral band: a point within ±band of 100 on either axis is 경계 between the quadrants it touches. */
export function rrgZone(rsRatio, rsMomentum, { band = RRG_NEUTRAL_BAND } = {}) {
  const ratio = finite(rsRatio), momentum = finite(rsMomentum);
  if (ratio == null || momentum == null) return null;
  const quadrant = ratio >= 100 ? (momentum >= 100 ? 'Leading' : 'Weakening') : (momentum >= 100 ? 'Improving' : 'Lagging');
  const nearRatio = Math.abs(ratio - 100) < band, nearMomentum = Math.abs(momentum - 100) < band;
  if (!nearRatio && !nearMomentum) return Object.freeze({ quadrant, border: false, between: null });
  const between = nearRatio && nearMomentum ? '네 사분면'
    : nearRatio ? (momentum >= 100 ? '선도/개선' : '약화/후행')
      : (ratio >= 100 ? '선도/약화' : '개선/후행');
  return Object.freeze({ quadrant, border: true, between });
}

/**
 * One reading of a sector point: the banded zone, the ~50-session window named, and the last five sessions of the
 * relative-strength line when they run against the quadrant's direction (Leading/Improving = strengthening).
 */
export function rrgRecentReading(item, series = null) {
  const zone = rrgZone(item?.rsRatio, item?.rsMomentum);
  if (!zone) return null;
  const check = rsRecentCheck(series);
  const strengthening = finite(item.rsMomentum) >= 100;
  const reversal = check ? (strengthening && check.fell ? 'fell' : !strengthening && check.rose ? 'rose' : null) : null;
  const word = RRG_QUADRANT_WORDS[zone.quadrant];
  const head = zone.border ? `경계(${zone.between} 사이)` : `${word}(약 50일 기준)`;
  const clause = reversal ? ` · 최근 5거래일 상대강도 ${signedPct(check.change)}로 ${reversal === 'fell' ? '반락' : '반등'}` : '';
  return Object.freeze({ ...zone, check, reversal, label: `${head}${clause}`, clause });
}
