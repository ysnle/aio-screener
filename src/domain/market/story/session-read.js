// What the latest completed US session did, said before the fall's standing: the leaders' and the broad market's one-session
// moves and what their signs say together, how much of a rebound's gain the session gave back, where the move gathered
// (the ledger's theme groups and its most material stocks, market-day.json), and what the companies that reported after
// the close did in extended trading (data.json afterHours). Every part is computed from the session's own data and is
// absent when its data is: a quiet session says only its moves. No cause is asserted here — why it happened is the
// investigation's and the AI reading's question, and they read these same lines (openingFactLines).
import { RULES } from '../../rules/thresholds.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { readNumber } from '../../shared/number.js';

const R = RULES.sessionRead;
const dayClaim = (row) => row?.claims?.[1] || null;
const pctClaim = (subject, measure, value, asOf, label) => claim({ subject, measure, asOf, figures: [{ value, unit: 'pct', basis: measure, label }] });

/** The sign pattern of the leaders (Nasdaq-100) against everything else (the equal weight), as one closing clause. */
function shapeSaid(ndx, rsp) {
  const lead = ndx.moves[1], rest = rsp?.moves?.[1];
  if (!Number.isFinite(lead) || !Number.isFinite(rest) || Math.abs(lead) < R.movePct) return NOTHING;
  const side = lead < 0 ? '하락' : '상승';
  if (lead * rest <= 0) return say(`${side}이 주도주에 몰린 날입니다.`);
  if (Math.abs(lead) - Math.abs(rest) >= R.leadGapPp) return say(lead < 0 ? '주도주가 시장 전체보다 더 내렸습니다.' : '주도주가 시장 전체보다 더 올랐습니다.');
  return say(lead < 0 ? '시장 전체가 함께 내렸습니다.' : '시장 전체가 함께 올랐습니다.');
}

/** "11/24 반도체 -8.3%, 나스닥 100 -2.0%, S&P 500 -0.5%, 동일가중 +0.3%. 하락이 주도주에 몰린 날입니다." */
function movesSaid(rows, asOf) {
  const parts = ['sox', 'ndx', 'spx', 'rsp'].map((id) => rows[id]).filter((row) => dayClaim(row)).map((row) => say('{lab} {m}', { lab: row.label, m: dayClaim(row) }));
  if (!parts.length) return NOTHING;
  return sayJoin([say('{d} {list}.', { d: shortDate(asOf), list: sayJoin(parts, ', ') }), shapeSaid(rows.ndx, rows.rsp)], ' ');
}

/**
 * The share of a rebound's gain (its low to its highest close since) the close has given back, for an index whose
 * highest close since the low came before this session.
 */
function givenBack(row) {
  const e = row?.episode;
  if (!e?.peak || !e.low || e.peak.date === row.asOf || !(e.peak.value > e.low.value)) return null;
  return { share: (e.peak.value - e.close) / (e.peak.value - e.low.value) * 100, peak: e.peak };
}
function giveBackSaid(rows, rebound) {
  if (!rebound || rebound.state === 'failed') return NOTHING;
  const read = [rows.sox, rows.ndx].filter(Boolean).map((row) => ({ row, back: givenBack(row) }))
    .filter((item) => item.back && item.back.share >= R.giveBackMinShare);
  if (!read.length || !read.some((item) => item.back.share >= R.giveBackShare)) return NOTHING;
  const piece = ({ row, back }) => say('{lab} {s}', { lab: row.label, s: claim({ subject: row.id, measure: 'reboundGivenBack', asOf: row.asOf,
    figures: [{ value: back.share, unit: 'share', digits: 0, basis: 'reboundGivenBack', label: row.label }] }) });
  return say('{d} 저점 뒤 오른 폭 가운데 {list}를 되돌렸습니다.', { d: shortDate(rebound.low.date), list: sayJoin(read.map(piece), ', ') });
}

const factsOn = (day, asOf) => (Array.isArray(day?.facts) && day?.sessions?.us === asOf ? day.facts.filter((fact) => fact?.date === asOf) : []);
const byMateriality = (a, b) => Number(b.materiality || 0) - Number(a.materiality || 0);

/** Where the session's move gathered: the theme groups and the most material stocks on the index's side, then one group against it. */
function gatheredOf(day, asOf, direction) {
  const facts = factsOn(day, asOf);
  const sided = (fact) => Number.isFinite(fact.change) && Math.sign(fact.change) === direction;
  const themes = facts.filter((fact) => fact.kind === 'group-move' && String(fact.id).startsWith('group:theme:') && R.ranks.includes(fact.rank));
  const groups = themes.filter(sided).sort(byMateriality).slice(0, R.groupsMax);
  const names = facts.filter((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] && sided(fact)).sort(byMateriality).slice(0, R.namesMax);
  const against = themes.filter((fact) => Number.isFinite(fact.change) && Math.sign(fact.change) === -direction).sort(byMateriality)[0] || null;
  if (!groups.length && !names.length) return null;
  const groupSaid = (fact) => say('{lab} {m}', { lab: fact.label, m: pctClaim(fact.id, 'groupChange1d', fact.change, asOf, fact.label) });
  const nameSaid = (fact) => say('{sym} {m}', { sym: fact.subjects[0], m: pctClaim(`stock:${fact.subjects[0]}`, 'change1d', fact.change, asOf, fact.subjects[0]) });
  const said = sayJoin([
    groups.length ? say('테마로는 {list}.', { list: sayJoin(groups.map(groupSaid), ', ') }) : NOTHING,
    names.length ? say('큰 종목으로는 {list}.', { list: sayJoin(names.map(nameSaid), ', ') }) : NOTHING,
    against ? say('반대로 {g}.', { g: groupSaid(against) }) : NOTHING
  ], ' ');
  return { label: direction < 0 ? '내린 곳' : '오른 곳', said, groups: groups.map((fact) => fact.label), names: names.map((fact) => fact.subjects[0]) };
}

/**
 * The companies that reported after this session's close, by index weight: the extended-hours move off the regular close
 * and, beside it, the regular session's own move when the ledger or `regularMoves` (symbol -> % on this session, from the
 * screener rows of the same session) has it. Provisional prints (the artifact says so).
 */
function afterHoursOf(afterHours, briefs, day, asOf, regularMoves) {
  if (afterHours?.sessionDate !== asOf || !Array.isArray(afterHours.rows)) return null;
  const nameOf = new Map((Array.isArray(briefs?.briefs) ? briefs.briefs : []).filter((row) => row?.symbol && row.nameKo).map((row) => [row.symbol, row.nameKo]));
  const regular = new Map([...Object.entries(regularMoves || {}), ...factsOn(day, asOf).filter((fact) => fact.kind === 'stock-move').map((fact) => [fact.subjects?.[0], fact.change])]);
  const rows = afterHours.rows.filter((row) => row?.symbol && readNumber(row.changePct) != null)
    .sort((a, b) => (Number(b.indexWeight) || 0) - (Number(a.indexWeight) || 0)).slice(0, R.afterHoursMax);
  if (!rows.length) return null;
  const piece = (row) => {
    const name = nameOf.get(row.symbol) ? `${nameOf.get(row.symbol)}(${row.symbol})` : row.symbol;
    const after = pctClaim(`stock:${row.symbol}`, 'afterHoursChange', Number(row.changePct), asOf, row.symbol);
    const session = regular.get(row.symbol);
    return Number.isFinite(session) ? say('{name} 시간외 {a}(정규장 {r})', { name, a: after, r: pctClaim(`stock:${row.symbol}`, 'change1d', session, asOf, row.symbol) })
      : say('{name} 시간외 {a}', { name, a: after });
  };
  return { label: '장 마감 뒤 실적', said: say('{list}. 시간외 가격은 잠정값입니다.', { list: sayJoin(rows.map(piece), ', ') }), symbols: rows.map((row) => row.symbol) };
}

/**
 * The session read of the opening's rows.
 * @param {{rows: object, asOf: string, rebound?: object|null, day?: object|null, afterHours?: object|null, briefs?: object|null, regularMoves?: object|null}} input
 * @returns {{said: object, gathered: object|null, afterHours: object|null}|null} `said`: the session's own sentence(s);
 *   `gathered` and `afterHours`: { label, said } face lines, each null without its data.
 */
export function sessionReadOf({ rows, asOf, rebound = null, day = null, afterHours = null, briefs = null, regularMoves = null } = {}) {
  if (!rows?.ndx || !Number.isFinite(rows.ndx.moves?.[1])) return null;
  const moves = movesSaid(rows, asOf);
  if (!moves.text) return null;
  const direction = Math.abs(rows.ndx.moves[1]) >= R.movePct ? Math.sign(rows.ndx.moves[1]) : 0;
  return {
    said: sayJoin([moves, giveBackSaid(rows, rebound)], ' '),
    gathered: direction ? gatheredOf(day, asOf, direction) : null,
    afterHours: afterHoursOf(afterHours, briefs, day, asOf, regularMoves)
  };
}
