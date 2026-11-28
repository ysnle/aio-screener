// Each screen's own sentence under its story tie: what the screen's existing reading says beside what the latest session
// did. Nothing is judged here. The session's shape is the session read's (session-read.js shapeSaid, on the same
// RULES.sessionRead lines over the opening's rows); each screen's state is its own verdict — the 시장 폭 and 금리 axes and
// the 심리 reference row of the shared regime, the policy path of the opening's rates row, the theme stages of the
// playbook, the 나스닥100 card's trend. The words are a fixed table (content/screen-tie-words.js); every figure is a
// claim. A missing shape, state or figure gives no sentence.
import { RULES } from '../../rules/thresholds.js';
import { claim, say } from '../../shared/claim.js';
import { readNumber } from '../../shared/number.js';
import { buildCloseSeries, sessionPointBack } from '../session/close-series.js';
import { sentimentReadOf } from '../../briefing/market-read.js';
import { policyPathOf } from './cross-market.js';
import { SCREEN_TIE_SHAPES, SCREEN_TIE_WORDS } from '../../content/screen-tie-words.js';

const R = RULES.sessionRead;
export const SCREEN_TIE_IDS = Object.freeze(Object.keys(SCREEN_TIE_WORDS));

/**
 * The session's shape from the opening's rows, on shapeSaid's lines: the Nasdaq-100 (leaders) against the equal weight
 * (everything else). null when the leaders moved less than RULES.sessionRead.movePct or either move is missing.
 * @returns {'leaders-down'|'leaders-up'|'leaders-more-down'|'leaders-more-up'|'broad-down'|'broad-up'|null}
 */
export function sessionShapeOf(opening) {
  const lead = opening?.rows?.ndx?.moves?.[1], rest = opening?.rows?.rsp?.moves?.[1];
  if (!Number.isFinite(lead) || !Number.isFinite(rest) || Math.abs(lead) < R.movePct) return null;
  const side = lead < 0 ? 'down' : 'up';
  if (lead * rest <= 0) return `leaders-${side}`;
  if (Math.abs(lead) - Math.abs(rest) >= R.leadGapPp) return `leaders-more-${side}`;
  return `broad-${side}`;
}

const figure = (subject, measure, asOf, value, unit, label, digits) => claim({ subject, measure, asOf,
  figures: [{ value, unit, basis: measure, label, ...(Number.isInteger(digits) ? { digits } : {}) }] });
const count = (subject, measure, asOf, value, label) => figure(subject, measure, asOf, value, 'count', label);
// The regime only when it is of this very session (as the opening's cross-market rows take it).
const regimeOf = (regime, asOf) => (regime?.available && regime.asOf === asOf ? regime : null);
const axisOf = (regime, id, list = 'axes') => (Array.isArray(regime?.[list]) ? regime[list].find((row) => row?.id === id && row.observed !== false) : null) || null;
const KNOWN = Object.freeze(['favorable', 'neutral', 'burden']);

// ---- each screen's state ------------------------------------------------------------------------------------------------
// A reader returns { state, slots } or null.

/** 시장 폭: the breadth axis, with the share above the 50-day line of the session. */
function breadthState({ regime, history, asOf }) {
  const axis = axisOf(regimeOf(regime, asOf), 'breadth');
  const point = buildCloseSeries(history, 'breadth50', { through: asOf }).at(-1);
  const share = point?.date === asOf ? readNumber(point.value) : null;
  if (!KNOWN.includes(axis?.state) || share === null) return null;
  return { state: axis.state, slots: { b: figure('breadth50', 'level', asOf, share, 'share', '50일선 위 종목') } };
}

/** 투자 심리: the 심리 reference row; its component counts from the same read the row is built from. */
function sentimentState({ regime, history, macroHistory, sentiment, asOf }) {
  const axis = axisOf(regimeOf(regime, asOf), 'sentiment', 'watchAxes');
  if (!['burden', 'neutral'].includes(axis?.state)) return null;
  const read = sentiment || sentimentReadOf(history, macroHistory);
  if (read.state !== axis.state || !read.ready.length) return null;
  const state = axis.state === 'burden' ? 'fear' : read.overheated ? 'greed' : 'even';
  return { state, slots: { n: count('sentiment', 'componentsRead', asOf, read.ready.length, '심리 지표'), f: count('sentiment', 'componentsFear', asOf, read.fear.length, '공포 쪽'),
    g: count('sentiment', 'componentsGreed', asOf, read.greed.length, '과열 쪽') } };
}

/** 매크로: how the policy path (the opening's rates row) moved over about a month — the difference of the two gaps as
 *  the opening prints them (whole bp), so +74 and +80 read -6 here too. */
function macroState({ macroHistory, asOf }) {
  const path = policyPathOf(macroHistory, asOf);
  if (!path?.move || !path.before) return null;
  return { state: path.move, slots: { d: figure('policy-path', 'twoYearOverMidChange', path.now.date, Math.round(path.now.gapBp) - Math.round(path.before.gapBp), 'bp', '2년물 − 기준금리 중간값 변화') } };
}

/** 금리와 환율: the rates axis (중립 held by a falling stock market reads growthScare), with the 10-year's 20-session change. */
function fxbondState({ regime, history, asOf }) {
  const axis = axisOf(regimeOf(regime, asOf), 'rates');
  if (!KNOWN.includes(axis?.state)) return null;
  const series = buildCloseSeries(history, 'tnx', { through: asOf }).filter((point) => readNumber(point.value) !== null);
  const last = series.at(-1), from = last ? sessionPointBack(series, 20) : null;
  if (last?.date !== asOf || !from) return null;
  const state = axis.state === 'neutral' && axis.growthScare ? 'growthScare' : axis.state;
  return { state, slots: { r: figure('tnx', 'change20d', asOf, (Number(last.value) - Number(from.value)) * 100, 'bp', '10년 금리 20거래일') } };
}

/** 테마와 섹터 / 한국: the playbook's theme stages of one market, on a basis that fits the session. */
function stageState(market, fits) {
  return ({ playbook, asOf }) => {
    const basis = playbook?.asOfByMarket?.[market];
    if (!playbook?.available || !basis || !fits(basis, asOf) || playbook.lagging?.[market]) return null;
    const rows = (playbook.themes || []).filter((row) => row?.market === market && row.state);
    if (!rows.length) return null;
    const leading = rows.filter((row) => row.state === 'leading').length;
    const subject = `themes:${market}`;
    return { state: leading ? 'lead' : 'none', slots: { t: count(subject, 'themesStaged', basis, rows.length, '테마'), n: count(subject, 'themesLeading', basis, leading, '주도 단계') } };
  };
}

// The 나스닥100 card's trend key (domain/technical/bands.js trendKey) → the table's state.
const TREND_STATE = Object.freeze({ up: 'above', recovery: 'above', unconfirmed: 'above', 'up-shaken': 'above', near50: 'near', pullback: 'pullback',
  rebound: 'under', breakdown: 'under', down: 'under' });
/** 기술적 분석: the 나스닥100 card the screen draws, on the session's close. */
function chartsState({ readings, asOf }) {
  const card = (Array.isArray(readings) ? readings : []).find((row) => row?.field === 'ndx');
  const state = TREND_STATE[card?.trend];
  if (!state || card.asOf !== asOf || !Number.isFinite(card.s50) || !Number.isFinite(card.s200)) return null;
  return { state, slots: { s50: figure('ndx', 'vsMa50', asOf, card.s50, 'pct', '50일선 대비'), s200: figure('ndx', 'vsMa200', asOf, card.s200, 'pct', '200일선 대비') } };
}

const STATE_OF = Object.freeze({
  breadth: breadthState, sentiment: sentimentState, macro: macroState, fxbond: fxbondState,
  themes: stageState('US', (basis, asOf) => basis === asOf),
  // A Korean session after the US one, so the sentence can say "그 뒤".
  korea: stageState('KR', (basis, asOf) => basis > asOf),
  charts: chartsState
});

/** The states each screen's reader can return (the table's keys are shape class × these). */
export const SCREEN_TIE_STATES = Object.freeze({
  breadth: KNOWN, sentiment: Object.freeze(['fear', 'even', 'greed']), macro: Object.freeze(['down', 'flat', 'up']),
  fxbond: Object.freeze(['favorable', 'neutral', 'growthScare', 'burden']), themes: Object.freeze(['lead', 'none']), korea: Object.freeze(['lead', 'none']),
  charts: Object.freeze(['above', 'near', 'pullback', 'under'])
});

/**
 * The screen's own sentence: { key, shape, state, said } or null.
 * @param {string} screen one of SCREEN_TIE_IDS
 * `sentiment`: the 심리 read (market-read.js sentimentReadOf) when the caller holds it; else it is read from history.
 * @param {{opening: object, regime?: object|null, history?: object[], macroHistory?: object|null, playbook?: object|null, readings?: object[]|null, sentiment?: object|null}} input
 */
export function screenTieOf(screen, { opening = null, regime = null, history = [], macroHistory = null, playbook = null, readings = null, sentiment = null } = {}) {
  const words = SCREEN_TIE_WORDS[screen];
  if (!words || !opening?.available || !opening.asOf) return null;
  const shape = sessionShapeOf(opening);
  const shapeClass = shape ? SCREEN_TIE_SHAPES[screen][shape] : null;
  if (!shapeClass) return null;
  const read = STATE_OF[screen]({ regime, history, macroHistory, playbook, readings, sentiment, asOf: opening.asOf });
  const key = read ? `${shapeClass}:${read.state}` : null;
  if (!key || !words[key]) return null;
  return { key, shape, state: read.state, said: say(words[key], read.slots) };
}
