// The 한국 tab's one flow: the US semiconductor session, the KOSPI session that followed it (or has not yet), and
// foreign investors' net purchases on KOSPI. The US closes about 06:00 KST the next morning, so a Korean session dated k
// follows the US session with the latest date before k; while the latest US session is not before the latest KOSPI
// session, its move has not reached a Korean session yet (pending). Semis are the opening's 반도체 (the SOX close series,
// market-story.js OPENING_INDEXES), read through the same session-keyed close series and one-session step.
// A flow figure keeps its own date: on a day the flows lag the KOSPI session, the line says so by its date and its
// meaning is read against the KOSPI move of that same day, never the session's.
import { buildCloseSeries, sessionPointBack, closeSessionMarket } from '../session/close-series.js';
import { sessionStep } from '../session/move-size.js';
import { BRIDGE_RULES } from '../session/session-bridge.js';
import { claim, say, sayJoin, NOTHING, printedValue } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { KOREA_LINK_WORDS as W } from '../../content/korea-link-words.js';

const SEMIS = 'sox';
const KOSPI = 'kospi';

function closes(history, field, market) {
  return buildCloseSeries(history, field, { market }).filter((point) => Number(point.value) > 0).map((point) => ({ date: point.date, value: Number(point.value) }));
}
// The one-session move ending at series[index] (the previous point must be the previous open session of `market`).
function moveAt(series, index, market) {
  if (index < 1) return null;
  const upTo = series.slice(0, index + 1);
  const back = sessionPointBack(upTo, 1, market);
  return back ? { date: upTo.at(-1).date, move: sessionStep('pct', back.value, upTo.at(-1).value) } : null;
}
const moveClaim = (subject, label, at) => claim({ subject, measure: 'change1d', asOf: at.date, figures: [{ value: at.move, unit: 'pct', basis: 'change1d', label }] });
// The printed sign: a move that prints 0.0% has no direction.
const printedSign = (figureClaim) => Math.sign(printedValue(figureClaim.figures[0]));

function pairSaid(us, kr) {
  const m = moveClaim(SEMIS, '반도체(SOX)', us); const k = moveClaim(KOSPI, '코스피', kr);
  const usSign = printedSign(m);
  const kind = Math.abs(printedValue(k.figures[0])) < BRIDGE_RULES.movePct ? 'flat' : !usSign ? null : printedSign(k) === usSign ? 'same' : 'opposite';
  return kind ? say(W.pair[kind], { usDay: shortDate(us.date), krDay: shortDate(kr.date), m, k }) : NOTHING;
}

function flowMeaning(day, sum5, sum20, kospiSign) {
  if (!day || !Number.isFinite(sum20) || !sum20) return null;
  if (day > 0 && sum20 < 0) return Number.isFinite(sum5) ? (sum5 > 0 ? 'buy-turning' : 'buy-early') : null;
  if (day < 0 && sum20 < 0) return kospiSign == null ? null : kospiSign > 0 ? 'sell-up' : 'sell-down';
  return day > 0 ? 'buy-ongoing' : 'sell-holding';
}

function flowsSaid(flows, kospi) {
  const market = flows?.state === 'ok' ? flows.markets.find((item) => item.id === 'kospi') : null;
  const row = market?.rows.find((item) => item.id === 'foreign');
  const trend = market?.trends.find((item) => item.id === 'foreign');
  if (!row || !Number.isFinite(row.value)) return NOTHING;
  const at = (value, label) => claim({ subject: 'kr-flows:kospi:foreign', measure: label, asOf: market.date, figures: [{ value, unit: 'eok', basis: 'netPurchase', label }] });
  const v = at(row.value, '외국인');
  const sums = [[trend?.sum5, '5거래일 합', W.sum5], [trend?.sum20, '20거래일 합', W.sum20]]
    .map(([value, label, words]) => (Number.isFinite(value) ? say(words, { s: at(value, label) }) : NOTHING));
  const figure = say(W.flows, { parts: sayJoin([say(W.flowDay, { day: shortDate(market.date), v }), ...sums], ', ') });
  // The KOSPI move of the flows' own day (null when that day has no KOSPI close).
  const index = kospi.findIndex((point) => point.date === market.date);
  const kospiMove = index >= 0 ? moveAt(kospi, index, 'KR') : null;
  const kospiSign = kospiMove ? printedSign(moveClaim(KOSPI, '코스피', kospiMove)) : null;
  const printed = (value) => (Number.isFinite(value) ? Math.round(value) : null);
  const meaning = flowMeaning(printed(row.value), printed(trend?.sum5), printed(trend?.sum20), kospiSign);
  return meaning ? sayJoin([figure, say(W.meaning[meaning])], ' ') : figure;
}

// A KOSPI session this large carries what the data already has around it on the index line.
export const KOREA_BIG_MOVE_PCT = 3;
const WON = 'usdkrw';
const INVESTORS = Object.freeze([['foreign', '외국인'], ['institution', '기관']]);

/**
 * One sentence for a KOSPI session that moved at least KOREA_BIG_MOVE_PCT: the US semiconductor session before it, the
 * foreign and institutional net purchases of that same KOSPI day, and the won's move of that day — up to three claims,
 * each left out when its figure is missing or of another day. NOTHING for a smaller session.
 * @param {{history?: object[], flows?: object|null, kr: {date: string, move: number}|null}} input `kr`: the KOSPI session
 *   (the opening's row: its asOf and one-session move); `flows`: buildKrInvestorFlowView.
 */
export function koreaBigMoveSaid({ history = [], flows = null, kr = null } = {}) {
  if (!kr?.date || !Number.isFinite(kr.move) || Math.abs(kr.move) < KOREA_BIG_MOVE_PCT) return NOTHING;
  const B = W.bigMove;
  const semis = closes(history, SEMIS, 'US');
  let before = -1;
  for (let index = 0; index < semis.length; index += 1) if (semis[index].date < kr.date) before = index;
  const us = before >= 0 ? moveAt(semis, before, 'US') : null;
  // Its own subject: the opening's 'sox' claims are of the US session the opening reads, this one of the session before KOSPI's.
  const semisSaid = us ? say(B.semis, { usDay: shortDate(us.date), m: moveClaim(`${SEMIS}:before-kr`, '반도체(SOX)', us) }) : NOTHING;
  const market = flows?.state === 'ok' ? flows.markets.find((item) => item.id === 'kospi' && item.date === kr.date) : null;
  const flowParts = INVESTORS.map(([id, who]) => {
    const row = market?.rows.find((item) => item.id === id);
    return row && Number.isFinite(row.value) ? say(B.flowPart, { who, v: claim({ subject: `kr-flows:kospi:${id}`, measure: 'netPurchase', asOf: market.date, figures: [{ value: row.value, unit: 'eok', basis: 'netPurchase', label: who }] }) }) : NOTHING;
  });
  const flowSaid = flowParts.some((piece) => piece.text) ? say(B.flows, { day: shortDate(kr.date), parts: sayJoin(flowParts, '·') }) : NOTHING;
  const wonSeries = closes(history, WON, closeSessionMarket(WON) || 'US');
  const wonIndex = wonSeries.findIndex((point) => point.date === kr.date);
  const won = wonIndex >= 0 ? moveAt(wonSeries, wonIndex, closeSessionMarket(WON) || 'US') : null;
  const wonSaid = won ? say(B.won, { w: moveClaim(WON, '원/달러', won) }) : NOTHING;
  const parts = sayJoin([semisSaid, flowSaid, wonSaid], ', ');
  return parts.text ? say(B.said, { parts }) : NOTHING;
}

/**
 * @param {{history: object[], flows: object|null}} input `history`: history.json rows; `flows`: buildKrInvestorFlowView.
 * @returns {{state: 'pending'|'reflected', us: {date, move}, kr: {date, move}, lines: Array<{id, label, said}>, factLines: string[]}|null}
 *   null when either index has no completed one-session move.
 */
export function koreaSessionLink({ history = [], flows = null } = {}) {
  const semis = closes(history, SEMIS, 'US');
  const kospi = closes(history, KOSPI, 'KR');
  const usLast = moveAt(semis, semis.length - 1, 'US');
  const krLast = moveAt(kospi, kospi.length - 1, 'KR');
  if (!usLast || !krLast) return null;
  const state = usLast.date >= krLast.date ? 'pending' : 'reflected';
  // The US session the latest KOSPI session followed: the latest one dated before it.
  let before = -1;
  for (let index = 0; index < semis.length; index += 1) if (semis[index].date < krLast.date) before = index;
  const usBefore = before >= 0 ? moveAt(semis, before, 'US') : null;
  const pending = state === 'pending' ? say(W.pending, { usDay: shortDate(usLast.date), m: moveClaim(SEMIS, '반도체(SOX)', usLast) }) : NOTHING;
  const lines = [
    { id: 'korea-pending', label: W.label.session, said: pending },
    { id: 'korea-pair', label: W.label.session, said: usBefore ? pairSaid(usBefore, krLast) : NOTHING },
    { id: 'korea-flows', label: W.label.flows, said: flowsSaid(flows, kospi) }
  ].filter((line) => line.said.text);
  const factLines = lines.map((line) => `${line.label}: ${line.said.text}`);
  return { state, us: { date: usLast.date, move: usLast.move }, kr: { date: krLast.date, move: krLast.move }, lines, factLines };
}
