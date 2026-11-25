// Whether the markets beside the index say the same thing as the session: credit, the dollar, volatility, breadth and
// rates, one row each for the opening (market-story.js), between the session read and the fall's standing. A row is the
// level and its recent change (every figure a claim), the state, and one fixed clause for what that state means for
// stocks now (content/cross-market-words.js).
//
// No state is judged here. Credit, volatility, breadth and rates take the 시장 상태 axis's own state (market-read.js
// buildMarketRegime, the same object the axis table prints), and only when that regime is of this very session; the
// dollar takes the dollar leg of the 유가와 달러 axis (dollarRiseBurden) and the 매크로 chain's fall line, since the axis
// itself mixes in oil. The rates row adds where the 2-year prices the policy path against the target midpoint, on the
// policy axis's line (macro-read.js policyPricing, policyLean), and the next inflation release the collected calendar has.
//
// Each figure is its series' own close (or observation) and says its own date when that is not the session's; a series
// with nothing on or before the session is said as 값 없음, never filled from a neighbouring session.
import { RULES } from '../../rules/thresholds.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { readNumber } from '../../shared/number.js';
import { buildCloseSeries, sessionPointBack } from '../session/close-series.js';
import { dollarRiseBurden } from '../../briefing/market-read.js';
import { policyLean, policyPricing, seriesOf } from '../../macro/macro-read.js';
import { STATE_LABELS } from '../interpretation/concepts.js';
import { REBOUND_QUALITY_WORDS } from '../../content/rebound-words.js';
import { CROSS_MARKET_LABELS as LABEL, CROSS_MARKET_MEANING as MEANING, CROSS_MARKET_PATH_LABEL, POLICY_LEAN_WORDS, POLICY_PATH_MEANING, CROSS_MARKET_SINCE_LOW } from '../../content/cross-market-words.js';

const X = RULES.crossMarket;
// The releases that move the rate path through prices (the week-ahead list's words read the same ids).
const INFLATION_RELEASE = /\b(?:cpi|pce)\b/;
export const CROSS_MARKET_IDS = Object.freeze(['credit', 'dollar', 'volatility', 'breadth', 'rates']);

const figure = (subject, measure, asOf, value, unit, label, digits) => claim({ subject, measure, asOf,
  figures: [{ value, unit, basis: measure, label, ...(Number.isInteger(digits) ? { digits } : {}) }] });
// "(11/23)" after a figure whose own date is not the session's.
const dated = (date, asOf) => (date && date !== asOf ? say('({d})', { d: shortDate(date) }) : NOTHING);

/** The last close of `field` on or before `through` and the close `back` sessions before it ({ last, from }, each { date, value } or null). */
function closes(history, field, through, back) {
  const series = buildCloseSeries(history, field, { through }).filter((point) => readNumber(point.value) !== null)
    .map((point) => ({ date: point.date, value: Number(point.value) }));
  const last = series.at(-1) || null;
  return { last, from: last && back ? sessionPointBack(series, back) : null };
}

// ---- the rows ------------------------------------------------------------------------------------------------------------
// The spread is the credit axis's own observation (level and changes of one date), so the row and the axis never differ.
function creditSaid(axis, asOf) {
  const obs = axis?.observation;
  if (readNumber(obs?.level) === null) return say('하이일드 스프레드 값 없음');
  const level = figure('hy', 'level', obs.asOf, obs.level, 'spread', '하이일드 스프레드');
  const change = (value, n) => (readNumber(value) === null ? NOTHING : say(', {n}거래일 {c}', { n: String(n), c: figure('hy', `change${n}d`, obs.asOf, value, 'bp', `${n}거래일`) }));
  return sayJoin([say('하이일드 스프레드 {l}{at}', { l: level, at: dated(obs.asOf, asOf) }), change(obs.change5, 5), change(obs.change20, 20)], '');
}

/** The dollar index's 20-session change and its state on the 유가와 달러 axis's dollar leg (position: that axis's one-year position). */
function dollarRow(history, asOf, commodities) {
  const { last, from } = closes(history, 'dxy', asOf, X.longSessions);
  if (!last) return { state: 'unknown', said: say('달러 지수 값 없음') };
  const pct = from && from.value > 0 ? (last.value / from.value - 1) * 100 : null;
  const state = pct === null ? 'unknown' : dollarRiseBurden(pct, commodities?.decidedBy?.dxyPosition ?? null) === true ? 'burden'
    : pct <= RULES.dollar.fall20dPct ? 'favorable' : 'neutral';
  const said = sayJoin([say('달러 지수 {l}{at}', { l: figure('dxy', 'level', last.date, last.value, 'level', '달러 지수'), at: dated(last.date, asOf) }),
    pct === null ? NOTHING : say(', {n}거래일 {c}', { n: String(X.longSessions), c: figure('dxy', `change${X.longSessions}d`, last.date, pct, 'pct', `${X.longSessions}거래일`) })], '');
  return { state, said };
}

function volatilitySaid(history, asOf) {
  const { last, from } = closes(history, 'vix', asOf, X.shortSessions);
  if (!last) return say('VIX 값 없음');
  const term = closes(history, 'vix3m', last.date, 0).last;
  const n = X.shortSessions;
  return sayJoin([say('VIX {l}{at}', { l: figure('vix', 'level', last.date, last.value, 'level', 'VIX'), at: dated(last.date, asOf) }),
    from?.value > 0 ? say(', {n}거래일 {c}', { n: String(n), c: figure('vix', `change${n}d`, last.date, (last.value / from.value - 1) * 100, 'pct', `${n}거래일`) }) : NOTHING,
    // The 3-month VIX only of the VIX's own session: the two are compared on the face.
    term?.date === last.date ? say(', 3개월 VIX {t}', { t: figure('vix3m', 'level', last.date, term.value, 'level', '3개월 VIX') }) : NOTHING], '');
}

function breadthSaid(history, asOf) {
  const { last, from } = closes(history, 'breadth50', asOf, X.shortSessions);
  if (!last) return say('50일선 위 종목 비율 값 없음');
  const long = closes(history, 'breadth200', last.date, 0).last;
  const share = (field, measure, value, label) => figure(field, measure, last.date, value, 'share', label);
  return sayJoin([say('50일선 위 종목 {l}{at}', { l: share('breadth50', 'level', last.value, '50일선 위 종목'), at: dated(last.date, asOf) }),
    from ? say('({n}거래일 전 {f})', { n: String(X.shortSessions), f: share('breadth50', `before${X.shortSessions}d`, from.value, '50일선 위 종목') }) : NOTHING,
    long?.date === last.date ? say(', 200일선 위 {b}', { b: share('breadth200', 'level', long.value, '200일선 위') }) : NOTHING], '');
}

function ratesSaid(history, asOf) {
  const near = closes(history, 'tnx', asOf, X.shortSessions), far = closes(history, 'tnx', asOf, X.longSessions);
  const last = near.last;
  if (!last) return say('10년 금리 값 없음');
  const change = (from, n) => (from ? say(', {n}거래일 {c}', { n: String(n), c: figure('tnx', `change${n}d`, last.date, (last.value - from.value) * 100, 'bp', `${n}거래일`) }) : NOTHING);
  return sayJoin([say('10년 {l}{at}', { l: figure('tnx', 'level', last.date, last.value, 'rate', '10년 금리'), at: dated(last.date, asOf) }),
    change(near.from, X.shortSessions), change(far.from, X.longSessions)], '');
}

// ---- the policy path -----------------------------------------------------------------------------------------------------
const onOrBefore = (series, date) => { let hit = null; for (const row of series) if (row.date <= date) hit = row; return hit; };
const daysBefore = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);

/** The 2-year against the target midpoint on its last observation on or before `date` (both bounds of that day), or null. */
function pathGapAt(macroHistory, date) {
  const two = onOrBefore(seriesOf(macroHistory, 'dgs2'), date);
  if (!two) return null;
  const lower = onOrBefore(seriesOf(macroHistory, 'fedTargetLower'), two.date), upper = onOrBefore(seriesOf(macroHistory, 'fedTargetUpper'), two.date);
  const { pricing, mid } = policyPricing({ dgs2: two.value, fedTargetLower: lower?.value, fedTargetUpper: upper?.value, _asOf_fedTargetLower: lower?.date, _asOf_fedTargetUpper: upper?.date });
  return pricing === null ? null : { date: two.date, twoYear: two.value, mid, gapBp: pricing * 100, lean: policyLean(pricing) };
}

/**
 * "2년물 − 기준금리 중간값 +76bp(11/23), 10/23 +81bp" with its lean word (인상 반영 · 동결 부근 · 인하 반영) and how the gap moved
 * since about a month before (down: toward cuts). null without a 2-year and a target range of one day.
 */
export function policyPathOf(macroHistory, asOf) {
  const now = macroHistory && asOf ? pathGapAt(macroHistory, asOf) : null;
  if (!now) return null;
  const then = pathGapAt(macroHistory, daysBefore(now.date, X.pathLookbackDays));
  const before = then && then.date < now.date ? then : null;
  const delta = before ? now.gapBp - before.gapBp : null;
  const move = delta === null ? null : delta <= -X.pathMoveBp ? 'down' : delta >= X.pathMoveBp ? 'up' : 'flat';
  const gap = (row, measure) => figure('policy-path', measure, row.date, row.gapBp, 'bp', '2년물 − 기준금리 중간값');
  const word = POLICY_LEAN_WORDS[now.lean];
  const said = sayJoin([say('2년물 − 기준금리 중간값 {g}{at}', { g: gap(now, 'twoYearOverMid'), at: dated(now.date, asOf) }),
    before ? say(', {d}에는 {g}', { d: shortDate(before.date), g: gap(before, 'twoYearOverMidBefore') }) : NOTHING], '');
  return { lean: now.lean, word, move, said, meaning: POLICY_PATH_MEANING[now.lean][move || 'flat'], now, before };
}

/** The first CPI or PCE release after the session in the collected calendar (`events`: { id, name, date }), as a said line. */
export function nextInflationRelease(events, asOf) {
  const next = (Array.isArray(events) ? events : []).filter((event) => event?.date && event.name && INFLATION_RELEASE.test(String(event.id)) && event.date > asOf)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { id: next.id, date: next.date, said: say('다음 물가 발표 {d} {name}', { d: shortDate(next.date), name: next.name }) } : null;
}

/**
 * The five rows for the session `asOf`, or [] when the regime is not of that session (no state is borrowed from another day).
 * `quality`: the rebound's cross-market read (rebound-quality.js), whose check mark joins the row of the same market.
 * @returns {Array<{id:string, label:string, state:string, word:string, said:object, meaning:string, since:{met:boolean|null, mark:string}|null,
 *   path?:object|null, next?:object|null}>}
 */
export function crossMarketRows({ history = [], macroHistory = null, regime = null, events = [], asOf = null, quality = null } = {}) {
  if (!asOf || !regime?.available || regime.asOf !== asOf || !Array.isArray(regime.axes)) return [];
  const axis = (id) => regime.axes.find((row) => row?.id === id) || null;
  const stateOf = (id) => (STATE_LABELS[axis(id)?.state] ? axis(id).state : 'unknown');
  const checks = new Map((quality?.checks || []).map((check) => [check.id, check]));
  const sinceOf = (id) => (checks.has(id) ? { met: checks.get(id).met, mark: REBOUND_QUALITY_WORDS.marks[checks.get(id).met == null ? 'unknown' : checks.get(id).met ? 'met' : 'unmet'] } : null);
  const dollar = dollarRow(history, asOf, axis('commodities'));
  const rates = axis('rates');
  const ratesKey = stateOf('rates') === 'neutral' && rates?.growthScare ? 'growthScare' : stateOf('rates');
  const rows = [
    { id: 'credit', state: stateOf('credit'), said: creditSaid(axis('credit'), asOf) },
    { id: 'dollar', state: dollar.state, said: dollar.said },
    { id: 'volatility', state: stateOf('volatility'), said: volatilitySaid(history, asOf) },
    { id: 'breadth', state: stateOf('breadth'), said: breadthSaid(history, asOf) },
    { id: 'rates', state: stateOf('rates'), said: ratesSaid(history, asOf), meaningKey: ratesKey, path: policyPathOf(macroHistory, asOf), next: nextInflationRelease(events, asOf) }
  ];
  return rows.map(({ meaningKey, ...row }) => ({ ...row, label: LABEL[row.id], word: STATE_LABELS[row.state], meaning: MEANING[row.id][meaningKey || row.state], since: sinceOf(row.id) }));
}

// The synthesis's state buckets in the order said; a row without a state is said as 자료 없음, never left out.
const SYNTHESIS_ORDER = Object.freeze(['burden', 'neutral', 'favorable', 'unknown']);

/**
 * 오늘's one sentence for the rows: "다른 시장 — 부담: 신용·변동성. 중립: 달러·시장 폭·금리. 금리 경로 인상 반영, 다음 물가
 * 발표 11/25 PCE." — each state's markets, then the rates row's policy path and next inflation release. Built from the
 * same rows 시장 상태 prints, so the two never differ; null without rows.
 */
export function crossMarketSynthesis(rows) {
  if (!rows?.length) return null;
  const word = (state) => (state === 'unknown' ? REBOUND_QUALITY_WORDS.marks.unknown : STATE_LABELS[state]);
  const buckets = SYNTHESIS_ORDER.map((state) => ({ state, names: rows.filter((row) => (STATE_LABELS[row.state] ? row.state : 'unknown') === state).map((row) => row.label) }))
    .filter((bucket) => bucket.names.length);
  const rates = rows.find((row) => row.id === 'rates');
  const path = !rates ? NOTHING : rates.path
    ? say('{lab} {w}{next}.', { lab: CROSS_MARKET_PATH_LABEL, w: rates.path.word, next: rates.next ? say(', {n}', { n: rates.next.said }) : NOTHING })
    : say('{lab} {w}.', { lab: CROSS_MARKET_PATH_LABEL, w: REBOUND_QUALITY_WORDS.marks.unknown });
  const said = sayJoin([...buckets.map((bucket) => say('{w}: {names}.', { w: word(bucket.state), names: bucket.names.join('·') })), path], ' ');
  return { label: '다른 시장', said, buckets };
}

/**
 * The rows as face lines: each row's figures and its rebound mark, then its clause; the rates row is followed by its policy
 * path with the next inflation release (key 'rates-path', its tag the lean word). `label` and `said` are the plain line
 * (the static shell, the record); `name`, `tag`, `state`, `figures` and `meaning` are its parts for the face.
 */
export function crossMarketLines(rows) {
  const since = (row) => (row.since ? say('{low} {mark}', { low: CROSS_MARKET_SINCE_LOW, mark: row.since.mark }) : NOTHING);
  const line = (key, name, tag, state, figures, meaning) => ({ key, name, tag, state, figures, meaning, label: `${name} ${tag}`, said: sayJoin([figures, say(meaning)], ' — ') });
  return rows.flatMap((row) => [
    line(row.id, row.label, row.word, row.state, sayJoin([row.said, since(row)], ' · '), row.meaning),
    ...(row.path ? [line('rates-path', CROSS_MARKET_PATH_LABEL, row.path.word, row.path.lean, sayJoin([row.path.said, row.next?.said || NOTHING], ' · '), row.path.meaning)] : [])
  ]);
}
