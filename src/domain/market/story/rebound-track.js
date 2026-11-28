// The rebound as a process rather than one session: which session after the low this is, each session's close against
// that low's close for the leaders and the broad market (반도체 · 나스닥 100 · S&P 500 · 동일가중), and what would confirm
// or fail it. The state and the low are rebound.js's (the Nasdaq-100's low the rebound rose from); the confirmation is
// the follow-through count (rally-attempt.js, Nasdaq Composite closes and volume), the failure the low's own check
// (market-story.js reboundChecks). Sessions are the Nasdaq-100's closes after the low; an index with no close on the low's
// session or on a session is 자료 없음 for that cell, never filled from a neighbouring session.
import { RULES } from '../../rules/thresholds.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { readNumber } from '../../shared/number.js';
import { buildCloseSeries } from '../session/close-series.js';
import { FOLLOW_THROUGH_WORDS as FTD } from '../../content/rebound-words.js';
import { volatilityState } from '../sentiment/volatility-state.js';

export const REBOUND_TRACK_WORDS = Object.freeze({ title: '반등 추적', confirm: '확인 조건', fail: '실패 조건', missing: '자료 없음', met: '확인', broke: '실패', retest: '저점 재시험' });
/** The tracker's columns, leaders first. */
export const REBOUND_TRACK_INDEXES = Object.freeze(['sox', 'ndx', 'spx', 'rsp']);

const closesOf = (history, id, through) => new Map(buildCloseSeries(history, id, { through })
  .filter((point) => readNumber(point.value) > 0).map((point) => [point.date, Number(point.value)]));

/** The follow-through condition while it has not happened, on the count's own rule (RULES.rallyAttempt). */
function pendingSaid(asOf) {
  const R = RULES.rallyAttempt;
  return say(`${FTD.index}이 저점 뒤 {m}일째부터 하루 {g} 이상 오르고 거래량이 전날보다 많으면 ${FTD.name}`, { m: String(R.minDay),
    g: claim({ subject: 'rally-rule', measure: 'gainPct', asOf, figures: [{ value: R.gainPct, unit: 'pct', digits: 2, basis: 'gainPct', label: '하루' }] }) });
}

/**
 * The last retest of the S&P 500 low against the VIX spike of that low (volatility-state.js), as one dated line, or NOTHING:
 * "11/17 S&P 500 7,341 < 11/5 저점 7,354, VIX 25.46 < 11/5 고점 28.18 — VIX 비확인; 11/19 VIX 28.44 고점 넘음".
 */
export function retestSaid(retest) {
  if (!retest) return NOTHING;
  const close = (subject, value, digits, date, label) => claim({ subject, measure: 'close', asOf: date, figures: [{ value, unit: 'level', digits, basis: 'close', label }] });
  const head = say('{d} S&P 500 {s} {r1} {pd} 저점 {p}, VIX {v} {r2} {hd} 고점 {h} — {w}', {
    d: shortDate(retest.date), s: close('spx', retest.spx, 0, retest.date, 'S&P 500'), r1: '<', pd: shortDate(retest.priorLow.date), p: close('spx', retest.priorLow.value, 0, retest.priorLow.date, 'S&P 500'),
    v: close('vix', retest.vix, 2, retest.date, 'VIX'), r2: retest.state === 'unconfirmed' ? '<' : '≥', hd: shortDate(retest.spikeHigh.date), h: close('vix', retest.spikeHigh.value, 2, retest.spikeHigh.date, 'VIX'), w: retest.word });
  return retest.refuted ? sayJoin([head, say('{d} VIX {v} {w}', { d: shortDate(retest.refuted.date), v: close('vix', retest.refuted.value, 2, retest.refuted.date, 'VIX'), w: retest.refuted.word })], '; ') : head;
}

/**
 * The tracker of an opening's rebound, or null without one.
 * @param {{history: object[], rows: object, rebound: object|null, asOf: string, indexes: Array<{id:string, label:string}>, ftd?: object}} input
 *   `rebound`: rebound.js's state with its `checks` (market-story.js); `ftd`: the follow-through sentence once it happened
 *   after the low (empty otherwise); `indexes`: the columns' specs in REBOUND_TRACK_INDEXES order.
 * @returns {{state:string, word:string, low:object, day:number, columns:Array<{id:string,label:string}>,
 *   rows:Array<{date:string, day:number, cells:Array<{id:string, value:number|null, said:object}>, said:object}>,
 *   head:object, confirm:{met:boolean, said:object}|null, fail:{met:boolean, said:object}, said:object}|null}
 *   `rows`: the last RULES.reboundTrack.sessionsMax sessions after the low, oldest first; `said`: the whole as one line.
 */
export function reboundTrackOf({ history = [], rows = {}, rebound = null, asOf = null, indexes = [], ftd = NOTHING } = {}) {
  if (!rebound?.low?.date || !asOf || !rows.ndx) return null;
  const low = rebound.low;
  const closes = Object.fromEntries(indexes.map((spec) => [spec.id, closesOf(history, spec.id, asOf)]));
  const sessions = [...closes.ndx.keys()].filter((date) => date > low.date).sort();
  if (!sessions.length) return null;
  const cell = (spec, date) => {
    const base = closes[spec.id].get(low.date), now = closes[spec.id].get(date);
    const value = base && now ? (now / base - 1) * 100 : null;
    return { id: spec.id, value, said: value == null ? say(REBOUND_TRACK_WORDS.missing)
      : say('{c}', { c: claim({ subject: `rebound-track:${spec.id}`, measure: 'fromReboundLow', asOf: date, figures: [{ value, unit: 'pct', basis: 'fromReboundLow', label: spec.label }] }) }) };
  };
  const shown = sessions.slice(-RULES.reboundTrack.sessionsMax);
  const first = sessions.length - shown.length + 1;
  const trackRows = shown.map((date, i) => {
    const cells = indexes.map((spec) => cell(spec, date));
    const list = sayJoin(cells.map((item, k) => say('{lab} {v}', { lab: indexes[k].label, v: item.said })), ', ');
    return { date, day: first + i, cells, said: say('{d}({k}일째) {list}', { d: shortDate(date), k: String(first + i), list }) };
  });
  const head = say('{d} 저점 뒤 {n}일째', { d: shortDate(low.date), n: String(sessions.length) });
  const failed = rebound.state === 'failed';
  const confirm = failed ? null : ftd?.text ? { met: true, said: ftd } : { met: false, said: pendingSaid(asOf) };
  const fail = failed
    ? { met: true, said: say('{lab}이 {d} 종가 {low} 아래로 마감해 반등 실패', { lab: rows.ndx.label, d: shortDate(low.date),
      low: claim({ subject: 'ndx', measure: 'reboundFrom', asOf, figures: [{ value: low.value, unit: 'level', digits: 0, basis: 'reboundFrom', label: rows.ndx.label }] }) }) }
    : { met: false, said: rebound.checks?.said?.[0] || NOTHING };
  const said = sayJoin([
    say('{head}({w}).', { head, w: rebound.word }),
    say('{r}.', { r: sayJoin(trackRows.map((row) => row.said), '; ') }),
    // The follow-through sentence ends itself; the conditions are clauses.
    confirm ? say(confirm.met ? '{lab}: {c}' : '{lab}: {c}.', { lab: REBOUND_TRACK_WORDS.confirm, c: confirm.said }) : NOTHING,
    fail.said.text ? say('{lab}: {c}.', { lab: REBOUND_TRACK_WORDS.fail, c: fail.said }) : NOTHING
  ], ' ');
  const retest = volatilityState(history, { through: asOf })?.retest || null;
  return { state: rebound.state, word: rebound.word, low, day: sessions.length, columns: indexes.map(({ id, label }) => ({ id, label })), rows: trackRows, head, confirm, fail, said,
    retest: retest ? { ...retest, said: retestSaid(retest) } : null };
}
