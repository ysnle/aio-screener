// The rebound inside a fall, decided on the Nasdaq-100's closes (the centre index, as in the diagnosis) with the S&P 500
// for the trend lines, only inside a fall whose deepest close reached the correction line. A rebound is a close
// RULES.story.reboundPct over the lowest close so far; then
//   반등 시도  while that low holds;
//   추세 회복  from the first session after the low on which both indexes close over their 50- and 200-session averages,
//            while both stay over the 200-session one (a dip under the 50-day line does not undo it, so the word holds);
//   반등 실패  on the session that closes under the low the rebound rose from (after it the fall's own read applies).
import { RULES } from '../../rules/thresholds.js';
import { say } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { REBOUND_WORDS } from '../../content/rebound-words.js'; // shared with the follow-through count's words

export { REBOUND_WORDS };

// What each stance costs in each state, conditionally (no order, no share of a portfolio). {d}: the low's date.
export const REBOUND_STANCE = Object.freeze({
  attempt: '200일선 회복을 기다리면 반등의 앞부분을 놓치고, 지금 따라가면 {d} 종가를 다시 깨는 실패한 반등에 걸릴 수 있습니다. 조건이 하나씩 확인될 때마다 나눠 접근하면 두 비용을 함께 줄일 수 있습니다.',
  recovered: '추세 회복이 확인된 뒤에도 기다리면 오르는 구간을 더 놓치고, S&P 500이나 나스닥 100이 200일선 아래로 다시 마감하면 이 판단은 거둡니다.',
  failed: '{d} 종가 아래로 마감해 반등 판단은 거둡니다. 지금은 하락 구간의 단계와 진단이 기준입니다.'
});

/**
 * An index's fall on its closes from `highDate`: the lowest close, the close's bounce off it (%), the low the last
 * rebound rose from (`from`), the highest close since the low (`peak`), the 50- and 200-session averages at the close, and each session's place against them
 * (`lines`: date → { over50, over200 }; every session, so the S&P 500's are read over the Nasdaq-100's fall).
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
  const lines = new Map();
  for (let i = 49; i < series.length; i += 1) {
    const a50 = average(i, 50), a200 = average(i, 200);
    lines.set(series[i].date, { over50: a50 != null && series[i].value > a50, over200: a200 != null && series[i].value > a200 });
  }
  const last = series.length - 1;
  const peak = low ? series.filter((point) => point.date >= low.date).reduce((best, point) => (point.value > best.value ? point : best), low) : null;
  return { low, from, peak, close: series[last].value, prev: series[last - 1]?.value ?? null, bounce: low ? (series[last].value / low.value - 1) * 100 : null,
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

/** The state's stance sentence (the guide and 시장 상태 print it). */
export const reboundStanceSaid = (rebound) => say(REBOUND_STANCE[rebound.state], { d: shortDate(rebound.low.date) });
