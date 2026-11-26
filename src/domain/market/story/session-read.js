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
import { sectorLabel } from '../../screener/sector-label.js';
import { reboundSpreadOf } from './rebound-spread.js';

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
 * The share of a rebound's gain (its low to its highest close since) the close has given back, for an index that fell
 * this session and whose highest close since the low came before it. A session that rose gave nothing back.
 */
function givenBack(row) {
  const e = row?.episode;
  if (!e?.peak || !e.low || e.peak.date === row.asOf || !(e.peak.value > e.low.value) || !(row.moves?.[1] < 0)) return null;
  return { share: (e.peak.value - e.close) / (e.peak.value - e.low.value) * 100, rise: (e.peak.value / e.low.value - 1) * 100, peak: e.peak };
}
function giveBackSaid(rows, rebound) {
  if (!rebound || rebound.state === 'failed') return NOTHING;
  const read = [rows.sox, rows.ndx].filter(Boolean).map((row) => ({ row, back: givenBack(row) }))
    .filter((item) => item.back && item.back.share >= R.giveBackMinShare);
  if (!read.length || !read.some((item) => item.back.share >= R.giveBackShare) || !read.some((item) => item.row.moves[1] <= -R.movePct)) return NOTHING;
  const piece = ({ row, back }) => say('{lab} {rise} 중 {s}', { lab: row.label, rise: pctClaim(row.id, 'reboundRise', back.rise, row.asOf, row.label), s: claim({ subject: row.id, measure: 'reboundGivenBack', asOf: row.asOf,
    figures: [{ value: back.share, unit: 'share', digits: 0, basis: 'reboundGivenBack', label: row.label }] }) });
  return say('{d} 저점 뒤 오른 폭 가운데 {list}를 되돌렸습니다.', { d: shortDate(rebound.low.date), list: sayJoin(read.map(piece), ', ') });
}

const factsOn = (day, asOf) => (Array.isArray(day?.facts) && day?.sessions?.us === asOf ? day.facts.filter((fact) => fact?.date === asOf) : []);
const byMateriality = (a, b) => Number(b.materiality || 0) - Number(a.materiality || 0);

// The sub-theme whose median went furthest past its theme's, the theme's way: "반도체 -8.4%(메모리/스토리지 -11.0%)".
function furthestPart(fact) {
  const way = Math.sign(fact.change);
  return (Array.isArray(fact.parts) ? fact.parts : []).filter((part) => part?.name && Number.isFinite(part.change) && way * (part.change - fact.change) >= R.partGapPp)
    .sort((a, b) => way * (b.change - a.change))[0] || null;
}

/** Where the session's move gathered: the theme groups and the most material stocks on the index's side, then one group against it. */
function gatheredOf(day, asOf, direction) {
  const facts = factsOn(day, asOf);
  const sided = (fact) => Number.isFinite(fact.change) && Math.sign(fact.change) === direction;
  const themes = facts.filter((fact) => fact.kind === 'group-move' && String(fact.id).startsWith('group:theme:') && R.ranks.includes(fact.rank));
  const groups = themes.filter(sided).sort(byMateriality).slice(0, R.groupsMax);
  const names = facts.filter((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] && sided(fact)).sort(byMateriality).slice(0, R.namesMax);
  const against = themes.filter((fact) => Number.isFinite(fact.change) && Math.sign(fact.change) === -direction).sort(byMateriality)[0] || null;
  if (!groups.length && !names.length) return null;
  const groupSaid = (fact) => {
    const whole = say('{lab} {m}', { lab: fact.label, m: pctClaim(fact.id, 'groupChange1d', fact.change, asOf, fact.label) });
    const part = furthestPart(fact);
    return part ? say('{whole}({name} {m})', { whole, name: part.name, m: pctClaim(`${fact.id}/${part.name}`, 'groupChange1d', part.change, asOf, part.name) }) : whole;
  };
  const nameSaid = (fact) => say('{sym} {m}', { sym: fact.subjects[0], m: pctClaim(`stock:${fact.subjects[0]}`, 'change1d', fact.change, asOf, fact.subjects[0]) });
  const said = sayJoin([
    groups.length ? say('테마로는 {list}.', { list: sayJoin(groups.map(groupSaid), ', ') }) : NOTHING,
    names.length ? say('큰 종목으로는 {list}.', { list: sayJoin(names.map(nameSaid), ', ') }) : NOTHING,
    against ? say('반대로 {g}.', { g: groupSaid(against) }) : NOTHING
  ], ' ');
  return { label: direction < 0 ? '내린 곳' : '오른 곳', said, groups: groups.map((fact) => fact.label), names: names.map((fact) => fact.subjects[0]) };
}

/**
 * Why the S&P 500 moved less (or more) than its leaders: the sector that pulled hardest the index's way, what every other
 * sector added up to, and the sectors that went the other way (market-day.json indexSplit). The equal weight and the Dow
 * hold less of that one sector, which is the whole of the difference on a day the rest of the index rose.
 */
function splitOf(day, asOf, spx) {
  const split = day?.indexSplit, move = spx?.moves?.[1];
  if (split?.date !== asOf || !Array.isArray(split.sectors) || !(split.coverage >= R.splitCoverage) || !Number.isFinite(move) || !move || Math.abs(split.total - move) > R.splitGapPp) return null;
  const way = Math.sign(move);
  const lead = [...split.sectors].sort((a, b) => way * (b.contribution - a.contribution))[0];
  if (!lead || way * lead.contribution <= 0) return null;
  const rest = split.total - lead.contribution;
  const points = (subject, value, label) => claim({ subject, measure: 'indexContribution', asOf, figures: [{ value, unit: 'pp', basis: 'indexContribution', label }] });
  const share = claim({ subject: `sector:${lead.sector}`, measure: 'indexWeight', asOf, figures: [{ value: lead.weight, unit: 'share', digits: 0, basis: 'indexWeight', label: sectorLabel(lead.sector) }] });
  const pull = way < 0 ? ['끌어내렸고', '끌어올렸습니다', '끌어내렸습니다'] : ['끌어올렸고', '끌어내렸습니다', '끌어올렸습니다'];
  const against = split.sectors.filter((row) => row !== lead && way * row.change <= -R.splitAgainstPct && row.weight >= R.splitAgainstWeight)
    .sort((a, b) => way * (a.contribution - b.contribution)).slice(0, R.splitAgainstMax);
  const said = sayJoin([
    say(`{lab} {m} 가운데 {sec}(비중 {w})이 {a} ${pull[0]}, 나머지 업종은 합쳐 {b} ${way * rest < 0 ? pull[1] : pull[2]}.`, { lab: spx.label, m: dayClaim(spx), sec: sectorLabel(lead.sector), w: share,
      a: points(`sector:${lead.sector}`, lead.contribution, sectorLabel(lead.sector)), b: points('spx:rest', rest, '나머지 업종') }),
    against.length ? say(way < 0 ? '{list}가 올랐습니다.' : '{list}가 내렸습니다.', { list: sayJoin(against.map((row) => say('{sec} {m}', { sec: sectorLabel(row.sector), m: pctClaim(`sector:${row.sector}`, 'sectorChange1d', row.change, asOf, sectorLabel(row.sector)) })), ', ') }) : NOTHING,
    way * rest < 0 ? say('동일가중과 다우는 {sec} 비중이 작아 그만큼 덜 움직였습니다.', { sec: sectorLabel(lead.sector) }) : NOTHING
  ], ' ');
  return { label: '지수 안에서', said, lead: lead.sector, against: against.map((row) => row.sector) };
}

// The reported result beside the price reaction: the adjusted EPS against the estimate seen before the report (event-briefs.json).
function surpriseOf(briefs, asOf) {
  const out = new Map();
  for (const brief of Array.isArray(briefs?.briefs) ? briefs.briefs : []) {
    if (brief?.kind !== 'earnings' || brief.eventDate !== asOf || !brief.symbol) continue;
    const pct = (brief.figures || []).map((figure) => readNumber(figure?.estimate?.surprisePct)).find((value) => value != null);
    if (pct != null) out.set(brief.symbol, pct);
  }
  return out;
}

// An after-hours extreme the last print did not hold: " 한때 +12.4%까지 올랐다가 +0.9%" reads as "시간외 +0.9%, 한때 +12.4%".
function fadeSaid(row, asOf) {
  const last = Number(row.changePct);
  const pick = (extreme, measure) => (readNumber(extreme) != null && Math.abs(extreme) >= R.afterHoursSwingPct && Math.abs(extreme - last) >= R.afterHoursFadePp
    ? say(', 한때 {x}', { x: pctClaim(`stock:${row.symbol}`, measure, Number(extreme), asOf, row.symbol) }) : NOTHING);
  const up = pick(row.highPct, 'afterHoursHigh'), down = pick(row.lowPct, 'afterHoursLow');
  // The larger departure from the last print is the one said.
  if (up.text && down.text) return Math.abs(row.highPct - last) >= Math.abs(row.lowPct - last) ? up : down;
  return up.text ? up : down;
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
  const surprise = surpriseOf(briefs, asOf);
  const piece = (row) => {
    const name = nameOf.get(row.symbol) ? `${nameOf.get(row.symbol)}(${row.symbol})` : row.symbol;
    const after = pctClaim(`stock:${row.symbol}`, 'afterHoursChange', Number(row.changePct), asOf, row.symbol);
    const session = regular.get(row.symbol);
    const beat = surprise.get(row.symbol);
    const result = beat != null ? say(' EPS 예상 대비 {s}에', { s: pctClaim(`stock:${row.symbol}`, 'epsSurprise', beat, asOf, row.symbol) }) : NOTHING;
    const said = sayJoin([say('{name}', { name }), result, say(' 시간외 {a}', { a: after }), fadeSaid(row, asOf)], '');
    return Number.isFinite(session) ? say('{said}(정규장 {r})', { said, r: pctClaim(`stock:${row.symbol}`, 'change1d', session, asOf, row.symbol) }) : said;
  };
  return { label: '장 마감 뒤 실적', said: say('{list}. 시간외 가격은 잠정값입니다.', { list: sayJoin(rows.map(piece), ', ') }), symbols: rows.map((row) => row.symbol) };
}

/**
 * The session read of the opening's rows.
 * @param {{rows: object, asOf: string, rebound?: object|null, day?: object|null, afterHours?: object|null, briefs?: object|null, regularMoves?: object|null}} input
 * @returns {{said: object, moves: object, gathered: object|null, split: object|null, afterHours: object|null}|null} `said`: the session's own
 *   sentence(s); `moves`: its first sentence only (the indexes' moves and their shape); `gathered`, `split` and `afterHours`: { label, said } face lines, each null without its data.
 */
export function sessionReadOf({ rows, asOf, rebound = null, day = null, afterHours = null, briefs = null, regularMoves = null } = {}) {
  if (!rows?.ndx || !Number.isFinite(rows.ndx.moves?.[1])) return null;
  const moves = movesSaid(rows, asOf);
  if (!moves.text) return null;
  const direction = Math.abs(rows.ndx.moves[1]) >= R.movePct ? Math.sign(rows.ndx.moves[1]) : 0;
  return {
    said: sayJoin([moves, giveBackSaid(rows, rebound)], ' '),
    // The moves alone: the one-line summary a screen without its own story line shows beside a link to 오늘.
    moves,
    gathered: direction ? gatheredOf(day, asOf, direction) : null,
    split: direction ? splitOf(day, asOf, rows.spx) : null,
    spread: reboundSpreadOf({ day, asOf, rebound, index: rows.sox }),
    afterHours: afterHoursOf(afterHours, briefs, day, asOf, regularMoves)
  };
}
