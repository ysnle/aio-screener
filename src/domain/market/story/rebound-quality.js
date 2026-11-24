// Whether markets other than the index confirm a rebound (rebound.js, attempt or recovered), read from the rebound's
// low to the latest close: credit (high-yield spread lower), the dollar (DXY lower), volatility (VIX lower and under the
// 3-month VIX) and participation (more members over their 50-day line and the equal weight up). Each end is that series'
// own close on that very session; a series with no close on the low's day or the latest day is 자료 없음 for its check,
// never filled from a neighbouring session. Unknown checks leave the denominator and are named. The tally's word comes
// from RULES.reboundQuality; no cause is asserted (an index-only rebound gets one conditional note).
import { RULES } from '../../rules/thresholds.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { buildCloseSeries } from '../session/close-series.js';
import { hyObservation } from '../../briefing/market-read.js';
import { REBOUND_QUALITY_WORDS as W } from '../../content/rebound-words.js';

/** A close of `field` on exactly `date` (completed-close series through `through`), else null. */
const closeOn = (history, field, date, through) => buildCloseSeries(history, field, { through }).find((point) => point.date === date)?.value ?? null;
/** The HY spread (bp) observed on exactly `date`, through the one reader every credit surface uses. */
const hyOn = (macroHistory, date) => { const obs = hyObservation({ macroHistory, through: date }); return obs?.asOf === date ? obs.level : null; };

// "{label} {low}({date}) → {latest}({date})", a missing end said as "{date} 값 없음".
function pairSaid(id, label, unit, digits, low, now) {
  const figures = [low, now].filter((end) => end.value != null).map((end) => ({ value: end.value, unit, digits, basis: end === low ? 'atLow' : 'atLatest', label }));
  const c = figures.length ? claim({ subject: `rebound-quality:${id}`, measure: 'lowToLatest', asOf: now.date, figures }) : null;
  const end = (point, index) => (point.value == null ? say('{d} 값 없음', { d: shortDate(point.date) }) : say(index ? '{c.1}({d})' : '{c.0}({d})', { c, d: shortDate(point.date) }));
  return say('{lab} {a} → {b}', { lab: label, a: end(low, 0), b: end(now, low.value == null ? 0 : 1) });
}
const levelSaid = (id, label, unit, digits, point) => (point.value == null ? say('{lab} {d} 값 없음', { lab: label, d: shortDate(point.date) })
  : say('{lab} {c}', { lab: label, c: claim({ subject: `rebound-quality:${id}`, measure: 'atLatest', asOf: point.date, figures: [{ value: point.value, unit, digits, basis: 'atLatest', label }] }) }));
const lower = (low, now) => (low.value == null || now.value == null ? null : now.value < low.value);

function checkOf(id, met, value) {
  const mark = met == null ? W.marks.unknown : met ? W.marks.met : W.marks.unmet;
  return { id, label: W.checks[id], met, value, said: say('{lab} {mark} — {v}', { lab: W.checks[id], mark, v: value }) };
}

/**
 * The cross-market checks of a rebound from its low's session to `through` (the latest close), or null without an attempt
 * or recovered rebound. `checks`: { id, label, met: true|false|null, value (both ends with dates), said }.
 * @param {{state:string, low:{date:string}}|null} rebound
 * @param {{history?: object[], macroHistory?: object|null, through: string}} input
 */
export function reboundQualityOf(rebound, { history = [], macroHistory = null, through } = {}) {
  if (!rebound || (rebound.state !== 'attempt' && rebound.state !== 'recovered') || !rebound.low?.date || !through || through <= rebound.low.date) return null;
  const from = rebound.low.date;
  const at = (field) => [{ date: from, value: closeOn(history, field, from, through) }, { date: through, value: closeOn(history, field, through, through) }];
  const [hyLow, hyNow] = [{ date: from, value: hyOn(macroHistory, from) }, { date: through, value: hyOn(macroHistory, through) }];
  const [dxyLow, dxyNow] = at('dxy');
  const [vixLow, vixNow] = at('vix');
  const vix3m = { date: through, value: closeOn(history, 'vix3m', through, through) };
  const [b50Low, b50Now] = at('breadth50');
  const [rspLow, rspNow] = at('rsp');

  const vixDown = lower(vixLow, vixNow);
  const underTerm = vixNow.value == null || vix3m.value == null ? null : vixNow.value < vix3m.value;
  const b50Up = b50Low.value == null || b50Now.value == null ? null : b50Now.value > b50Low.value;
  const rspUp = rspLow.value == null || rspNow.value == null ? null : rspNow.value > rspLow.value;
  const rspSaid = rspUp == null ? say('동일가중 {d} 값 없음', { d: shortDate((rspLow.value == null ? rspLow : rspNow).date) })
    : say('동일가중 {c}', { c: claim({ subject: 'rebound-quality:rsp', measure: 'fromLow', asOf: through, figures: [{ value: (rspNow.value / rspLow.value - 1) * 100, unit: 'pct', basis: 'fromLow', label: '동일가중' }] }) });
  const both = (a, b) => (a == null || b == null ? null : a && b);
  const checks = [
    checkOf('credit', lower(hyLow, hyNow), pairSaid('hy', '하이일드 스프레드', 'spread', 0, hyLow, hyNow)),
    checkOf('dollar', lower(dxyLow, dxyNow), pairSaid('dxy', '달러 지수', 'level', 2, dxyLow, dxyNow)),
    checkOf('volatility', both(vixDown, underTerm), sayJoin([pairSaid('vix', 'VIX', 'level', 2, vixLow, vixNow), levelSaid('vix3m', '3개월 VIX', 'level', 2, vix3m)], ', ')),
    checkOf('breadth', both(b50Up, rspUp), sayJoin([pairSaid('breadth50', '50일선 위 종목', 'share', 0, b50Low, b50Now), rspSaid], ', '))
  ];

  const R = RULES.reboundQuality;
  const known = checks.filter((row) => row.met != null);
  const met = known.filter((row) => row.met).length;
  const share = known.length ? met / known.length : 0;
  const state = known.length < R.minKnown ? 'thin' : share >= R.confirmShare ? 'confirmed' : share >= R.mixedShare ? 'mixed' : met > 0 ? 'weak' : 'index-only';
  const tally = claim({ subject: 'rebound-quality', measure: 'tally', asOf: through,
    figures: [{ value: met, unit: 'ratio', digits: 0, basis: 'met', label: W.label }, { value: known.length, unit: 'ratio', digits: 0, basis: 'known', label: W.label }] });
  const unknown = checks.filter((row) => row.met == null).map((row) => row.label);
  const said = sayJoin([
    say('{lab} {t.0}/{t.1}, {lo} 저점부터 {now} 종가까지.', { lab: W.label, t: tally, lo: shortDate(from), now: shortDate(through) }),
    unknown.length ? say('{m}: {names}.', { m: W.marks.unknown, names: unknown.join(', ') }) : NOTHING,
    state === 'index-only' ? say(W.indexOnlyNote) : NOTHING
  ], ' ');
  return { state, word: W[state], met, known: known.length, total: checks.length, from, through, checks, said, items: checks.map((row) => row.said) };
}
