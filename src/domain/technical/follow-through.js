// v57.87 (owner X-bookmark read 2026-10-16): the follow-through evidence the bookmarked chart frameworks keep returning
// to, computed on completed daily bars — pocket pivots, heavy-volume down days, the base number since a trend started,
// climax signs after a long run, and how a stock closed on its index's down days. Pure functions over arrays; a field
// is null when its inputs are short or missing (never guessed). Reference conditions for the screener, not an entry,
// exit or sizing rule. Thresholds are RULES.technical.followThrough (R713).
import { RULES } from '../rules/thresholds.js';

export const FOLLOW_THROUGH_VERSION = 'follow-through.v1';
const F = RULES.technical.followThrough;
const ok = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Sessions since the latest pocket pivot in the last `pocketWindow` sessions (0 = last session), or null for none. */
export function pocketPivotAgo(closes, volumes, window = F.pocketWindow) {
  const n = Math.min(closes?.length || 0, volumes?.length || 0);
  if (n < window * 2 + 1) return { ago: null, count: null };
  let latest = null;
  let count = 0;
  for (let i = n - window; i < n; i += 1) {
    if (!ok(closes[i]) || !ok(closes[i - 1]) || !ok(volumes[i]) || !(closes[i] > closes[i - 1])) continue;
    let maxDown = 0;
    let seen = 0;
    for (let j = i - window; j < i; j += 1) {
      if (!ok(closes[j]) || !ok(closes[j - 1]) || !ok(volumes[j])) continue;
      seen += 1;
      if (closes[j] < closes[j - 1]) maxDown = Math.max(maxDown, volumes[j]);
    }
    if (seen >= window - 2 && maxDown > 0 && volumes[i] > maxDown) { latest = n - 1 - i; count += 1; }
  }
  return { ago: latest, count };
}

/**
 * Down closes of at least heavyDownPct on volume above the stock's own heavyDownAvgSessions average (the sessions
 * before that day), in the last `window` sessions. The index rule (0.2% on more volume than the prior session) is too
 * loose for single stocks — about half of all down days would qualify (v57.88 review).
 */
export function heavyDownDays(closes, volumes, window = F.heavyDownWindow) {
  const n = Math.min(closes?.length || 0, volumes?.length || 0);
  const avgSessions = F.heavyDownAvgSessions;
  if (n < window + avgSessions + 1) return null;
  let count = 0;
  let seen = 0;
  for (let i = n - window; i < n; i += 1) {
    if (!ok(closes[i]) || !ok(closes[i - 1]) || !ok(volumes[i])) continue;
    const prior = volumes.slice(i - avgSessions, i).filter(ok);
    if (prior.length < avgSessions * 0.8) continue;
    seen += 1;
    const average = prior.reduce((sum, value) => sum + value, 0) / prior.length;
    if ((closes[i] / closes[i - 1] - 1) * 100 <= -F.heavyDownPct && volumes[i] > average) count += 1;
  }
  return seen >= window - 3 ? count : null;
}

/**
 * The base number since the trend restarted: each pullback of ≥ basePullbackPct from a closing high that lasts
 * ≥ baseMinSessions and is then closed above counts one completed base; a pullback still open counts as the base
 * being formed. A close below the latest completed base's low (the base failed), a drawdown of resetDrawdownPct or a
 * new 52-week closing low restarts the count. Returns
 * { count, forming, depthPct } — count includes a base being formed; null below a year of closes.
 */
export function baseCount(closes) {
  const values = (closes || []).filter(ok);
  if (values.length < RULES.technical.fullYearSessions) return null;
  let count = 0;
  let high = values[0];
  let pullbackStart = null;
  let pullbackLow = Infinity;
  let yearLow = values[0];
  let lastBaseLow = null;
  const restart = (close) => { count = 0; high = close; pullbackStart = null; pullbackLow = Infinity; lastBaseLow = null; };
  // v58.63: the producer passes two years of closes (FACTOR_HISTORY_RANGE), so the lowest close seen so far was a
  // two-year low and a new 52-week low above it never restarted the count. The low is the trailing rangeSessions span.
  const span = RULES.technical.rangeSessions;
  const lowIndex = [];
  for (let i = 1; i < values.length; i += 1) {
    const close = values[i];
    while (lowIndex.length && values[lowIndex[lowIndex.length - 1]] >= values[i - 1]) lowIndex.pop();
    lowIndex.push(i - 1);
    while (lowIndex[0] < i - span) lowIndex.shift();
    yearLow = values[lowIndex[0]];
    if (close < yearLow) { restart(close); continue; }
    if (lastBaseLow != null && close < lastBaseLow) { restart(close); continue; }
    if (close > high) {
      if (pullbackStart != null && (high - pullbackLow) / high * 100 >= F.basePullbackPct && i - pullbackStart >= F.baseMinSessions) { count += 1; lastBaseLow = pullbackLow; }
      high = close;
      pullbackStart = null;
      pullbackLow = Infinity;
      continue;
    }
    if (pullbackStart == null) pullbackStart = i;
    pullbackLow = Math.min(pullbackLow, close);
    if ((high - pullbackLow) / high * 100 >= F.resetDrawdownPct) restart(close);
  }
  const last = values[values.length - 1];
  const depthPct = high > 0 ? Math.round((high - last) / high * 1000) / 10 : null;
  const forming = pullbackStart != null && (high - pullbackLow) / high * 100 >= F.basePullbackPct;
  return { count: count + (forming ? 1 : 0), forming, depthPct };
}

/**
 * Climax signs after a long run (O'Neil): run-up days (≥ climaxUpDays up closes in the last 10), the largest one-day
 * gain of the year inside the last 10 sessions, the largest volume of the year on an up close inside the last 10,
 * and a close ≥ climaxStretch200Pct above the 200-day line. Applies only after a run of climaxMinRunPct from the
 * 52-week closing low; [] when it does not apply, null below a year of closes.
 */
export function climaxSigns(closes, volumes) {
  const n = Math.min(closes?.length || 0, volumes?.length || 0);
  if (n < RULES.technical.fullYearSessions) return null;
  // v58.63: "of the year" and the 52-week low are the last rangeSessions sessions — the two-year producer series made a
  // year-old gain or volume spike outrank the latest ten sessions and measured the run from a two-year low.
  const m = Math.min(n, RULES.technical.rangeSessions);
  const c = closes.slice(-m);
  const v = volumes.slice(-m);
  if (!c.every(ok)) return null;
  const last = c[m - 1];
  const yearLow = Math.min(...c);
  if ((last / yearLow - 1) * 100 < F.climaxMinRunPct) return [];
  const signs = [];
  let ups = 0;
  for (let i = m - 10; i < m; i += 1) if (c[i] > c[i - 1]) ups += 1;
  if (ups >= F.climaxUpDays) signs.push('run-up-days');
  const gains = c.map((value, i) => (i ? value / c[i - 1] - 1 : -Infinity));
  const maxGain = Math.max(...gains);
  if (gains.slice(-10).includes(maxGain) && maxGain > 0) signs.push('largest-gain');
  const upVolumes = v.map((value, i) => (i && c[i] > c[i - 1] && ok(value) ? value : 0));
  const maxUpVolume = Math.max(...upVolumes);
  if (maxUpVolume > 0 && upVolumes.slice(-10).includes(maxUpVolume)) signs.push('largest-volume');
  const sma200 = c.slice(-200).reduce((sum, value) => sum + value, 0) / 200;
  if ((last / sma200 - 1) * 100 >= F.climaxStretch200Pct) signs.push('stretch-200');
  return signs;
}

/**
 * On the index's down closes in the last `resilienceWindow` sessions (dates matched exactly): the share of those days
 * the stock closed better than the index, and the mean excess return in %p. null when the index series is missing or
 * fewer than resilienceMinDays down days are matched.
 * v59.45 P8-DATA-12: `gapDates` are completed sessions with no close. A stock return that spans one of them covers two
 * sessions, so it is not compared with the index's one-session return on that day — the day leaves the sample.
 */
export function downDayResilience(dates, closes, indexByDate, window = F.resilienceWindow, gapDates = []) {
  if (!(indexByDate instanceof Map) || !Array.isArray(dates) || !Array.isArray(closes)) return null;
  const gaps = (Array.isArray(gapDates) ? gapDates : []).map(String);
  const n = Math.min(dates.length, closes.length);
  let days = 0;
  let held = 0;
  let excess = 0;
  for (let i = Math.max(1, n - window); i < n; i += 1) {
    const indexReturn = indexByDate.get(dates[i]);
    if (!(typeof indexReturn === 'number' && Number.isFinite(indexReturn)) || !(indexReturn < 0) || !ok(closes[i]) || !ok(closes[i - 1])) continue;
    if (gaps.some((date) => date > dates[i - 1] && date < dates[i])) continue;
    const stockReturn = (closes[i] / closes[i - 1] - 1) * 100;
    days += 1;
    if (stockReturn > indexReturn) held += 1;
    excess += stockReturn - indexReturn;
  }
  if (days < F.resilienceMinDays) return null;
  return { days, holdRatePct: Math.round(held / days * 100), excessPp: Math.round(excess / days * 100) / 100 };
}

/** Index one-session returns in % by session date, from a { dates, closes } series. */
export function indexReturnsByDate(series) {
  const map = new Map();
  const dates = series?.dates || [];
  const closes = series?.closes || [];
  for (let i = 1; i < Math.min(dates.length, closes.length); i += 1) {
    if (ok(closes[i]) && ok(closes[i - 1])) map.set(dates[i], (closes[i] / closes[i - 1] - 1) * 100);
  }
  return map;
}

/** All follow-through fields for one symbol's completed-session history; benchmark returns by date are optional. */
export function followThroughFields({ dates, closes, volumes, gapDates = [] }, indexByDate = null) {
  const pocket = pocketPivotAgo(closes, volumes);
  const base = baseCount(closes);
  const resilience = indexByDate ? downDayResilience(dates, closes, indexByDate, F.resilienceWindow, gapDates) : null;
  return {
    pocketPivotAgo: pocket.ago,
    pocketPivots10: pocket.count,
    heavyDownDays25: heavyDownDays(closes, volumes),
    baseCount: base ? base.count : null,
    baseForming: base ? base.forming : null,
    baseDepthPct: base ? base.depthPct : null,
    climaxSigns: climaxSigns(closes, volumes),
    downDayHoldPct: resilience ? resilience.holdRatePct : null,
    downDayExcessPp: resilience ? resilience.excessPp : null,
    downDayCount: resilience ? resilience.days : null,
    followThroughModel: FOLLOW_THROUGH_VERSION
  };
}
