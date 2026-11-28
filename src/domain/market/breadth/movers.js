// The 4% movers as ratios: on each session the members that rose 4% or more on rising volume against those that fell as
// much (breadth-signals.js counts them), and over the last 5 and 10 sessions the sum of the risers over the sum of the
// fallers. A ratio, not a difference, so 500 and 1,000 members read on one scale. Two rule states: 극단 약세 (the day's
// fallers over ten times the risers and the 5-session ratio under 0.5, 2110395636965065198) and 추력 (the day's risers at
// least RULES.bottomWatch.thrustRatio times the fallers, 2110897647355637879) — a thrust is a condition, not a bottom.
// A window whose fallers sum to zero has no ratio.
import { RULES } from '../../rules/thresholds.js';
import { buildCloseSeries, closeBasis } from '../session/close-series.js';

export const MOVER_RULES = Object.freeze({ windows: Object.freeze([5, 10]), extremeDayMultiple: 10, extremeRatioBelow: 0.5, refLines: Object.freeze([0.5, 1, 2]) });
export const MOVER_WORDS = Object.freeze({ extreme: '극단 약세', thrust: '추력' });

/** The paired session counts { date, up, down } through `through`, oldest first. */
export function moverCounts(history = [], through = closeBasis(history)) {
  const down = new Map(buildCloseSeries(history, 'breadthDown4', { through }).map((point) => [point.date, point.value]));
  return buildCloseSeries(history, 'breadthUp4', { through }).filter((point) => down.has(point.date)).map((point) => ({ date: point.date, up: point.value, down: down.get(point.date) }));
}

/** The n-session ratio ending at each session (null where the fallers sum to zero). */
export function moverRatioSeries(counts, n) {
  const out = [];
  for (let i = n - 1; i < counts.length; i += 1) {
    const span = counts.slice(i + 1 - n, i + 1);
    const up = span.reduce((sum, row) => sum + row.up, 0), down = span.reduce((sum, row) => sum + row.down, 0);
    out.push({ date: counts[i].date, up, down, value: down > 0 ? up / down : null });
  }
  return out;
}

/** The day's state word id: 'extreme', 'thrust' or null. */
export function moverStateOf(day, ratio5) {
  if (!day) return null;
  const R = MOVER_RULES;
  if (day.down > day.up * R.extremeDayMultiple && ratio5 != null && ratio5 < R.extremeRatioBelow) return 'extreme';
  if (day.up > 0 && day.up >= day.down * RULES.bottomWatch.thrustRatio) return 'thrust';
  return null;
}

/**
 * @returns {null | {asOf, day:{date, up, down}, windows:Array<{n, up, down, value}>, state, word, series:Object<number, Array>}}
 *   null without a count on the basis session.
 */
export function moverRatios(history = [], { through = closeBasis(history) } = {}) {
  const counts = moverCounts(history, through);
  const day = counts.at(-1);
  if (!day || day.date !== through) return null;
  const series = Object.fromEntries(MOVER_RULES.windows.map((n) => [n, moverRatioSeries(counts, n)]));
  const windows = MOVER_RULES.windows.map((n) => { const last = series[n].at(-1); return last?.date === day.date ? { n, up: last.up, down: last.down, value: last.value } : { n, up: null, down: null, value: null }; });
  const state = moverStateOf(day, windows[0].value);
  return { asOf: day.date, day, windows, state, word: state ? MOVER_WORDS[state] : null, series };
}
