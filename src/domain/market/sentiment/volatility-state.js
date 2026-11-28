// The one reading of the volatility complex on the S&P 500 close basis: the VIX level and its band, the term structure
// (metrics.js vixTermStructure on one session's 9-day, 30-day and 3-month VIX), the spike high over the recent record, a
// retest of the index low against the VIX spike of that low, and the S&P 500's session move against the one-standard-
// deviation range the previous session's VIX implied. 투자 심리, 매크로 변동성, 시장 상태 (pairs, depth row, bottom watch)
// and 오늘 read it here. Facts and fixed state words only; no sentence is built. Each value is a close of its own session,
// never borrowed from a neighbouring one.
import { RULES } from '../../rules/thresholds.js';
import { buildCloseSeries, closeBasis } from '../session/close-series.js';
import { vixTermStructure } from './metrics.js';
import { vixBandRow } from './narrative.js';

export const VOLATILITY_STATE_RULES = Object.freeze({
  tradingDays: 252,
  // VIX ÷ √252 is one implied standard deviation of a session: a move at or inside it is 범위 안, over twice it 범위 밖
  // (2111149350722162744); between them 1표준편차 초과. One sd holds about two sessions in three.
  rangeInsideSd: 1, rangeOutsideSd: 2,
  // A retest: the S&P 500 closes under the lowest close of the previous retestSessions, that low at least retestGapSessions
  // back (two lows, not one slide); the spike is the highest VIX close within spikeAroundSessions of the earlier low. A VIX
  // close under it is 비확인 (2111173383320981984, 2124108524171227620 — closes, not the intraday prints the posts use).
  retestSessions: 63, retestGapSessions: 5, spikeAroundSessions: 5,
  // The spike high named beside the level: the highest VIX close of the last spikeSessions.
  spikeSessions: 63
});

export const TERM_WORDS = Object.freeze({
  inverted: Object.freeze({ label: '역전, 단기 불안', tone: 'burden' }),
  front: Object.freeze({ label: '앞쪽 역전, 9일물 > 30일물', tone: 'burden' }),
  flat: Object.freeze({ label: '평탄', tone: 'neutral' }),
  normal: Object.freeze({ label: '정상', tone: 'favorable' })
});
export const RANGE_WORDS = Object.freeze({ inside: '범위 안', beyond: '1표준편차 초과', outside: '범위 밖' });
export const RETEST_WORDS = Object.freeze({ unconfirmed: 'VIX 비확인', confirmed: 'VIX 확인', refuted: '고점 넘음' });

/** The term-structure word of one session's closes, or null without VIX and its 3-month. */
export function termStateOf({ vix9d = null, vix = null, vix3m = null } = {}) {
  const term = vixTermStructure({ vix9d, vix, vix3m });
  return term.blocked ? null : { state: term.state, ratio: term.ratio, frontInverted: term.frontInverted, ...TERM_WORDS[term.state] };
}

/** |move| against one implied sd; null without both. */
export function rangeStateOf(movePct, priorVix) {
  if (!Number.isFinite(movePct) || !(priorVix > 0)) return null;
  const R = VOLATILITY_STATE_RULES;
  const sd = priorVix / Math.sqrt(R.tradingDays);
  const multiple = Math.abs(movePct) / sd;
  const state = multiple <= R.rangeInsideSd ? 'inside' : multiple > R.rangeOutsideSd ? 'outside' : 'beyond';
  return { sd, multiple, state, label: RANGE_WORDS[state] };
}

const maxPoint = (points) => points.reduce((best, point) => (!best || point.value > best.value ? point : best), null);

/** The latest retest of the S&P 500 low inside the record (spx, vix: closes ascending), or null. */
function lastRetest(spx, vixOn, vix) {
  const R = VOLATILITY_STATE_RULES;
  let found = null;
  for (let t = R.retestSessions; t < spx.length; t += 1) {
    const prior = spx.slice(t - R.retestSessions, t);
    const low = prior.reduce((best, point, i) => (!best || point.value < best.point.value ? { point, i: t - R.retestSessions + i } : best), null);
    if (!(spx[t].value < low.point.value) || t - low.i < R.retestGapSessions) continue;
    const vixNow = vixOn.get(spx[t].date);
    const around = spx.slice(Math.max(0, low.i - R.spikeAroundSessions), Math.min(t, low.i + R.spikeAroundSessions + 1))
      .map((point) => ({ date: point.date, value: vixOn.get(point.date) })).filter((point) => point.value != null);
    const spike = maxPoint(around);
    if (vixNow == null || !spike) continue;
    found = { date: spx[t].date, spx: spx[t].value, priorLow: { date: low.point.date, value: low.point.value }, vix: vixNow, spikeHigh: spike,
      state: vixNow < spike.value ? 'unconfirmed' : 'confirmed' };
  }
  if (!found) return null;
  // The counter-evidence the posts name: VIX closing over the spike high after the retest.
  const later = vix.find((point) => point.date > found.date && point.value > found.spikeHigh.value);
  return { ...found, word: RETEST_WORDS[found.state], refuted: found.state === 'unconfirmed' && later ? { date: later.date, value: later.value, word: RETEST_WORDS.refuted } : null };
}

/**
 * @param {object[]} history history.json rows
 * @param {{through?: string|null}} [options] the close basis (default: the S&P 500's last completed close)
 * @returns {null | {asOf, level, term, spike, range, retest, ratioSeries}} null without a VIX close on the basis.
 */
export function volatilityState(history = [], { through = null } = {}) {
  const basis = through || closeBasis(history);
  const vix = buildCloseSeries(history, 'vix', { through: basis });
  const last = vix.at(-1);
  if (!last || last.date !== basis) return null;
  const on = (field) => new Map(buildCloseSeries(history, field, { through: basis }).map((point) => [point.date, point.value]));
  const vix3m = on('vix3m'), vix9d = on('vix9d'), vixOn = new Map(vix.map((point) => [point.date, point.value]));
  const ratioSeries = vix.filter((point) => vix3m.get(point.date) > 0).map((point) => ({ date: point.date, value: point.value / vix3m.get(point.date) }));
  const term = termStateOf({ vix9d: vix9d.get(basis) ?? null, vix: last.value, vix3m: vix3m.get(basis) ?? null });
  const band = vixBandRow(last.value);
  const spike = maxPoint(vix.slice(-VOLATILITY_STATE_RULES.spikeSessions));
  const spx = buildCloseSeries(history, 'spx', { through: basis }).filter((point) => point.value > 0);
  const [prev, now] = spx.slice(-2);
  const priorVix = prev ? vixOn.get(prev.date) ?? null : null;
  const move = prev && now?.date === basis ? (now.value / prev.value - 1) * 100 : null;
  const rangeRead = rangeStateOf(move, priorVix);
  return {
    asOf: basis,
    level: { value: last.value, date: last.date, band: band?.label || null },
    term: term ? { ...term, date: basis, vix9d: vix9d.get(basis) ?? null, vix3m: vix3m.get(basis) ?? null } : null,
    spike: spike ? { value: spike.value, date: spike.date, sessions: Math.min(vix.length, VOLATILITY_STATE_RULES.spikeSessions) } : null,
    // The session's move against the range the previous session's close implied (the range known that morning).
    range: rangeRead ? { ...rangeRead, date: basis, move, priorVix, priorDate: prev.date } : null,
    retest: lastRetest(spx, vixOn, vix),
    ratioSeries
  };
}
