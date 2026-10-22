// v57.81 (analysis audit 2026-10-15): the stress panel gave KRX holdings a plain market beta of 1.0 against US shocks
// only — a book that is mostly Korean had no Korean scenario while the KOSPI fell 18.4% in five sessions. This row
// applies the KOSPI's own worst recorded 5- and 20-session moves to the Korean share. Observed index history (applied
// 1:1, i.e. beta 1, which the label states; no forecast); a window is offered only when the record holds at least STRESS_MIN_CASES
// non-overlapping windows of that length (R706 sample floor), and the record length is named beside it.
import { krSessionThrough } from '../briefing/market-read.js';
import { buildCloseSeries } from '../market/close-series.js';
import { countOpenSessionsBetween } from '../market/market-calendar.js';

export const STRESS_MIN_CASES = 10;
const WINDOWS = Object.freeze([5, 20]);
const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** Worst exact-span n-session change in a close series, with its dates. Null below the R706 floor. */
export function worstSessionMove(series, n, market = 'KR') {
  const points = Array.isArray(series) ? series : [];
  if (Math.floor((points.length - 1) / n) < STRESS_MIN_CASES) return null;
  // v58.63 (architecture audit, DOMAIN #6): the floor counted rows, not usable windows, so a gappy 201-row record with one
  // exact 20-session window passed. A window counts only when its span is exactly n open sessions; the floor needs that
  // many non-overlapping valid windows.
  const valid = (index) => points[index - n]?.value > 0 && countOpenSessionsBetween(points[index - n].date, points[index].date, market) === n;
  let cases = 0;
  for (let index = n; index < points.length;) {
    if (valid(index)) { cases += 1; index += n; } else index += 1;
  }
  if (cases < STRESS_MIN_CASES) return null;
  let worst = null;
  for (let index = n; index < points.length; index += 1) {
    const from = points[index - n], to = points[index];
    if (!valid(index)) continue;
    const pct = (to.value / from.value - 1) * 100;
    if (!worst || pct < worst.pct) worst = { pct, from: from.date, to: to.date };
  }
  return worst ? { ...worst, sessions: n, record: points.length } : null;
}

/** Rows for the stress panel: name, the KOSPI move (a fraction) and how it was measured. Empty without a record. */
export function krIndexStressRows(history = [], { now = Date.now(), field = 'kospi' } = {}) {
  const series = buildCloseSeries(history, field, { through: krSessionThrough(now) });
  return WINDOWS.map((n) => worstSessionMove(series, n)).filter((move) => move && move.pct < 0).map((move) => ({
    name: `코스피 기록상 최악 ${move.sessions}거래일 (${md(move.from)}~${md(move.to)} ${move.pct.toFixed(1)}%)`,
    shock: move.pct / 100,
    // v57.84 review: applying the index move 1:1 to the Korean share is itself a beta-1 assumption — the label says so.
    basis: `기록된 ${move.record}거래일 중 · 보유분이 코스피와 같이 움직인다고 가정`,
    ...move
  }));
}
