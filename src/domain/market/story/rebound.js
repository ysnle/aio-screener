// The rebound inside a fall (owner 2026-11-24). On 11/23, the session after the 11/20 crash, the S&P 500 rose
// 4.7%, the Nasdaq-100 6.9% and the SOX 14.0%, and the opening still read "…쏠림이 되돌려지는 하락입니다". The state is
// decided on the Nasdaq-100's closes (the centre index, as in the diagnosis) inside its fall from the closing high, with
// the S&P 500 for the trend lines. A rebound is a close RULES.story.reboundPct or more over the lowest close so far; then
//   반등 시도  while that low holds (the lowest close since the high is still the one the rebound rose from);
//   추세 회복  from the first session after that low on which the S&P 500 and the Nasdaq-100 both close over their 50- and
//            200-session averages, while both stay over the 200-session one (a dip under the 50-day line does not undo it);
//   반등 실패  on the session that closes under the low the rebound rose from (only that session: the fall's lede says the rest).
// Only inside a fall whose deepest close reached the correction line; nothing outside one, nothing before a rebound.
import { RULES } from '../../rules/thresholds.js';

export const REBOUND_WORDS = Object.freeze({ attempt: '반등 시도', recovered: '추세 회복', failed: '반등 실패' });

/**
 * An index's fall on its closes from `highDate`: the lowest close, the close's bounce off it (%), the low the last
 * rebound rose from (`from`), the 50- and 200-session averages at the close, and from the low on each session's place
 * against them (`lines`: date → { over50, over200 }).
 * @param {Array<{date:string, value:number}>} series ascending closes
 */
export function episodeOf(series, highDate) {
  let low = null, from = null;
  for (const point of series) {
    if (point.date < highDate) continue;
    if (!low || point.value < low.value) low = point;
    else if ((point.value / low.value - 1) * 100 >= RULES.story.reboundPct) from = low;
  }
  const sums = [0];
  for (const point of series) sums.push(sums.at(-1) + point.value);
  const average = (i, n) => (i + 1 >= n ? (sums[i + 1] - sums[i + 1 - n]) / n : null);
  // Every session's place (not only this index's own fall): the S&P 500's lines are read over the Nasdaq-100's fall.
  const lines = new Map();
  for (let i = 49; i < series.length; i += 1) {
    const a50 = average(i, 50), a200 = average(i, 200);
    lines.set(series[i].date, { over50: a50 != null && series[i].value > a50, over200: a200 != null && series[i].value > a200 });
  }
  const last = series.length - 1;
  return { low, from, close: series[last].value, prev: series[last - 1]?.value ?? null, bounce: low ? (series[last].value / low.value - 1) * 100 : null,
    ma50: average(last, 50), ma200: average(last, 200), lines };
}

/** The rebound state of the opening's rows ({ ndx, spx } with `episode` and `fall`), or null outside one. */
export function reboundOf({ ndx, spx }) {
  const e = ndx?.episode;
  if (!e?.from || !spx?.episode || !((ndx.fall.trough ?? ndx.fall.value) <= -RULES.story.correctionPct)) return null;
  if (e.from !== e.low) return e.close < e.from.value && e.prev >= e.from.value ? { state: 'failed', word: REBOUND_WORDS.failed, low: e.from } : null;
  let recovered = false;
  for (const [date, n] of e.lines) {
    const s = spx.episode.lines.get(date);
    if (s && date >= e.low.date) recovered = recovered ? n.over200 && s.over200 : n.over50 && n.over200 && s.over50 && s.over200;
  }
  const state = recovered ? 'recovered' : 'attempt';
  return { state, word: REBOUND_WORDS[state], low: e.low };
}
