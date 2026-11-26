// v59.65 (owner 2026-11-03, phase 3): 브리핑 tells the last 24 hours as linked stories from the market-day ledger
// (public-data/market-day.json, src/domain/market/day/facts.js). The ledger's own threads join everything a shared subject
// or peer touches (one 11/3 thread held 36 facts), so a story here is one level down: a lead or major fact claims its direct
// neighbours — the members of a group, the headlines about its subject, the groups the price drives, the same-family
// prices — and a fact belongs to one story only, in materiality order. What moved hard with nothing linked to it is kept
// apart as unexplained; what is still ahead is a dated list. Nothing is scored here: rank and materiality are the ledger's.
import { usThenKorea, marketOfSymbol } from '../market/session/session-time.js';
import { resolveMarketCalendarSession } from '../market/session/market-calendar.js';
import { UP_WORDS, DOWN_WORDS } from '../news/direction-words.js';
import { CLAIM_WORDS, claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { readNumber } from '../shared/number.js';
import { RULES } from '../rules/thresholds.js';
import { buildCloseSeries } from '../market/session/close-series.js';
import { readIndexLongrun } from '../market/indices/long-run.js';
import { reportAboutMove } from './news-picks.js';
// Every figure, date and judgement word of the account is printed from a claim (src/domain/shared/claim.js), so the
// replay gate (scripts/ci-sentence-claim-replay-check.mjs) can check each word against the ledger it came from.
const md = (date) => { const text = String(date || ''); return text.length >= 10 ? `${Number(text.slice(5, 7))}/${Number(text.slice(8, 10))}` : text; };
const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

// The subject a fact's claims are about: an asset, a stock, a group.
const subjectOf = (fact) => (fact.kind === 'price' ? fact.asset : fact.kind === 'group-move' ? fact.group : fact.subjects?.[0]) || fact.id;
const unitOf = (fact) => ((fact.changeUnit || fact.unit) === 'bp' ? 'bp' : 'pct');
/** A fact's one-session change (a group's median member), printed under `label`. */
export const changeClaim = (fact, { word = null, label = fact.label, unit = unitOf(fact), compare = null, basis = fact.kind === 'group-move' ? 'median' : 'change1d' } = {}) =>
  claim({ subject: subjectOf(fact), measure: 'change1d', word, asOf: fact.date, compare, figures: [{ value: fact.change, unit, basis, label }] });
/** A one-figure claim on another measure of the fact (a surprise, a size multiple, a pull on the index). */
const figureClaim = (fact, measure, value, unit, label) => claim({ subject: subjectOf(fact), measure, asOf: fact.date, figures: [{ value, unit, basis: measure, label }] });
// v59.71 (owner 11/07 '거래량'): a stock move on at least twice its 20-session turnover says so beside the price.
const volTag = (fact) => (Number.isFinite(fact?.rvol) && fact.rvol >= 2 ? say('(거래량 {v})', { v: figureClaim(fact, 'rvol20', fact.rvol, 'x', '거래량') }) : NOTHING);
// A price the ledger marks provisional (the 17:00 ET print before the futures settle) says so beside its figure.
const provisionalTag = (fact) => (fact?.provisional ? say('(잠정)') : NOTHING);
const named = (fact, word = null) => say('{name} {move}{tag}', { name: fact.label, move: changeClaim(fact, { word }), tag: provisionalTag(fact) });
/** The five-session leg and its size against the usual five-session move. */
const weekClaim = (fact) => claim({ subject: subjectOf(fact), measure: 'week5d', asOf: fact.date, figures: [{ value: fact.week, unit: unitOf(fact), basis: 'week5d', label: '5거래일' },
  { value: Math.abs(fact.zWeek), unit: 'x', basis: 'zWeek', label: '평소 5거래일 변동' }] });
/** A price fact's size on the leg the ledger ranked it by (the session, or the five-session leg). */
const legSize = (fact) => Math.abs((fact.sizedBy === 'week' ? fact.zWeek : fact.z) ?? 0);
/** 가장 큰 변화: the fact's size (its ledger leg) is the largest of its price family. */
// The stories' date label. Index bars and the stock and group moves come from different sources, so the index can be
// one session ahead of the movers; then the label names both sessions instead of dating the index by the movers.
function sessionLabel(day, facts) {
  const movers = day.sessions?.us || null;
  const index = facts.find((fact) => fact.kind === 'price' && fact.asset === 'spx')?.date || null;
  const session = (subject, asOf) => claim({ subject, measure: 'session', asOf });
  if (!movers) return NOTHING;
  if (!index || index === movers) return say('{session.date} 마감', { session: session('us-session', movers) });
  return say('지수 {index.date} 마감, 종목 {movers.date} 마감', { index: session('us-session', index), movers: session('us-movers', movers) });
}

const largestClaim =(fact, family) => claim({ subject: subjectOf(fact), measure: 'size', word: 'largest', asOf: fact.date, rank: { among: `family:${family?.id}` } });
/** A group's named members ({sym, change}): its leaders under a superlative, or its main movers. */
const memberClaim = (group, movers, word) => claim({ subject: subjectOf(group), measure: 'change1d', word, asOf: group.date, ...(CLAIM_WORDS[word].rank ? { rank: { among: subjectOf(group) } } : {}),
  figures: movers.map((row) => ({ value: row.change, unit: 'pct', basis: 'member', label: row.sym })) });
/**
 * A stock's pull on the S&P 500 as percentage points of the index's own move ("S&P 500을 1.6%p
 * 끌어올렸습니다"), when it is 5bp or more; "+160bp만큼 영향" was a unit no reader holds.
 */
function pullSaid(fact) {
  if (!Number.isFinite(fact?.indexBp) || Math.abs(fact.indexBp) < 5) return NOTHING;
  const value = fact.indexBp / 100;
  const pull = claim({ subject: subjectOf(fact), measure: 'indexPp', asOf: fact.date, figures: [{ value, unit: 'pp', basis: 'indexPp', label: 'S&P 500', digits: Math.abs(value) < 1 ? 2 : 1 }] });
  return say(value > 0 ? 'S&P 500을 {pull} 끌어올렸습니다' : 'S&P 500을 {pull} 끌어내렸습니다', { pull });
}
/** A story field set from composed text; the story keeps every claim it prints. */
function tell(story, field, said) {
  if (field === 'why') story.why.push(said.text); else story[field] = said.text;
  story.claims.push(...said.claims);
}

// Prices told together: one story per family, named by the family and the direction (a CLAIM_WORDS id) that matters for it.
const FAMILIES = Object.freeze([
  { id: 'oil', name: '유가', assets: ['wti', 'brent'], up: 'rise', down: 'fall', topics: ['energy'] },
  { id: 'credit', name: '신용 스프레드', assets: ['igOas', 'hyOas', 'cccOas'], up: 'widen', down: 'narrow', topics: ['credit'] },
  { id: 'rates', name: '금리', assets: ['tnx', 'dgs2', 'realYield10', 'breakeven10'], up: 'rise', down: 'fall', topics: ['rates', 'inflation'] },
  { id: 'dollar', name: '달러', assets: ['dxy', 'usdjpy', 'usdkrw'], up: 'strong', down: 'weak', topics: ['fx'] },
  { id: 'metals', name: '금과 은', assets: ['gold', 'silver'], up: 'rise', down: 'fall', topics: ['metals'] },
  { id: 'vol', name: '변동성', assets: ['vix'], up: 'widen', down: 'calm', topics: [] },
  { id: 'crypto', name: '비트코인', assets: ['btc'], up: 'rise', down: 'fall', topics: ['crypto'] },
  { id: 'us', name: '미국 지수', assets: ['spx', 'ndx', 'soxx', 'rut', 'rsp'], up: 'rise', down: 'fall' },
  { id: 'kr', name: '한국 증시', assets: ['kospi', 'kosdaq'], up: 'rise', down: 'fall' }
]);
const FAMILY_OF = new Map(FAMILIES.flatMap((family) => family.assets.map((asset) => [asset, family])));
/** The family a price asset is told in (the replay checks 가장 큰 변화 within it). */
export const priceFamilyOf = (asset) => FAMILY_OF.get(asset)?.id || null;
const SEED_KINDS = new Set(['price', 'group-move', 'stock-move', 'earnings', 'deal', 'event']);

const byMateriality = (a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.materiality || 0) - (a.materiality || 0);
// A report whose own words point the other way from the move ("... Move Higher" under a -2.8% day) is an older story.
// A report published after the session that made the move closed did not cause it. It stays only as a recap: its own
// words must state the move's direction (an insider filing or a new story posted after the close is left out).
const STAMPS = new Map();
const localStamp = (at, timeZone) => {
  if (!STAMPS.has(timeZone)) STAMPS.set(timeZone, new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }));
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? STAMPS.get(timeZone).format(ms) : '';
};
export const afterClose = (fact, seed) => {
  const kr = seed?.kind === 'price' ? FAMILY_OF.get(seed.asset)?.id === 'kr' : marketOfSymbol(seed?.subjects?.[0] || seed?.members?.[0]) === 'KR';
  const session = seed?.date ? resolveMarketCalendarSession({ market: kr ? 'KR' : 'US', date: seed.date }) : null;
  const stamp = session?.close ? localStamp(fact.at, session.timezone) : '';
  return !!stamp && stamp > `${seed.date} ${session.close}`;
};
export const agrees = (fact, change, seed = null) => {
  const text = `${fact.title || ''} ${fact.titleKo || ''}`;
  const up = UP_WORDS.test(text); const down = DOWN_WORDS.test(text);
  if (seed && Number.isFinite(change) && afterClose(fact, seed)) return up !== down && (change >= 0 ? up : down);
  return !Number.isFinite(change) || up === down || (change >= 0 ? up : down);
};
// The order of a story's reports, the ledger's own: the publisher tier (1 best, an unrated company memo last), then the
// feed score, then materiality. The link basis comes first by construction: a stock or group story reads only reports
// that name it (subject, member); a price story, which has none, reads its topic reports.
const reportTier = (fact) => (Number.isFinite(fact?.tier) ? fact.tier : 9);
export const byReportOrder = (a, b) => reportTier(a) - reportTier(b) || (Number(b.score) || 0) - (Number(a.score) || 0) || byMateriality(a, b);
const evidenceOf = (fact) => ({ title: fact.titleKo || fact.title, original: fact.titleKo ? fact.title : null, at: fact.at || null, date: fact.date || null });
/**
 * The report a lead move shows on its face, or null: the first of `reports` that is about the move (news-picks
 * reportAboutMove, the one rule the 종목 header and the movers lists use too). `reports` arrive in link order (a stock's
 * own name; a group's leaders or its thread's lead stock), then byReportOrder. A wrong evidence line is worse than none,
 * so with no such report there is no line.
 */
function faceReport(seed, reports) {
  if (!Math.sign(Number(seed?.change) || 0) || !seed.date) return null;
  const kr = seed.kind === 'price' ? FAMILY_OF.get(seed.asset)?.id === 'kr' : marketOfSymbol(seed.subjects?.[0] || seed.members?.[0] || '') === 'KR';
  const fact = reports.find((row) => reportAboutMove(row, { session: seed.date, market: kr ? 'KR' : 'US', change: seed.change }));
  return fact ? evidenceOf(fact) : null;
}
// A story cites a report by its Korean title; an English one the producer could not translate
// (titleKoFailed) is passed over, so the account never reads half in English.
const HANGUL_PAIR = /[가-힣].*[가-힣]/;
const shownKorean = (fact) => HANGUL_PAIR.test(fact?.titleKo || '') || HANGUL_PAIR.test(fact?.title || '');

const SINCE_INDEX = Object.freeze({ spx: 'spx', ndx: 'ndx' }); // the ledger's US indexes the long-run tables hold
const yearMonth = (date) => `${String(date).slice(0, 4)}년 ${Number(String(date).slice(5, 7))}월`;
/**
 * v60.50 (owner 2026-11-23): the rank of the leading US index's one-session move, when it is true and notable — at most
 * one per account. With the long-run tables (indices/long-run.js): the largest such move since the last one as large,
 * when that is over a year back, or since the tables start. Without them: the largest move of the page's own record
 * (history.json, a full year of sessions at least — RULES.technical.fullYearSessions), as a ranked claim
 * (rank among `record:<asset>:change1d`, every earlier session's move) the replay holds against the closes.
 */
function rankSaid(fact, { history = null, longrun = null } = {}) {
  if (!fact || !Array.isArray(history) || !Number.isFinite(fact.change) || fact.change === 0) return NOTHING;
  const series = buildCloseSeries(history, fact.asset, { through: fact.date }).filter((point) => Number(point.value) > 0);
  if (series.at(-1)?.date !== fact.date) return NOTHING;
  const side = fact.change < 0 ? 'fall' : 'rise';
  const move = changeClaim(fact, { unit: 'pct' });
  const lab = fact.label;
  const read = SINCE_INDEX[fact.asset] && longrun ? readIndexLongrun(longrun, { index: SINCE_INDEX[fact.asset], horizon: 1, recent: series.map((point) => [point.date, Number(point.value)]) }) : null;
  if (read && read.liveThrough === fact.date) {
    const m = read.move;
    const yearAgo = `${Number(fact.date.slice(0, 4)) - 1}${fact.date.slice(4)}`;
    if (!m?.inTail || m.side !== side || (m.since && m.since.date >= yearAgo)) return NOTHING;
    return say(' {lab} 하루 {move}는 {when} 이후 가장 큰 하루 {dir}입니다.', { lab, move, dir: side === 'fall' ? '하락' : '상승', when: m.since ? yearMonth(m.since.date) : `${read.from.slice(0, 4)}년` });
  }
  if (read || series.length < RULES.technical.fullYearSessions + 1) return NOTHING;
  const record = series.slice(1).map((point, i) => (Number(point.value) / Number(series[i].value) - 1) * 100);
  const earlier = record.slice(0, -1);
  if (earlier.some((value) => (side === 'fall' ? value <= fact.change : value >= fact.change))) return NOTHING;
  const ranked = claim({ subject: subjectOf(fact), measure: 'change1d', word: side === 'fall' ? 'most-fell' : 'most-rose', asOf: fact.date, rank: { among: `record:${fact.asset}:change1d` } });
  return say(' {lab} 기준 기록({from} 이후) 중 {r.word} 하루입니다.', { lab, from: series[0].date, r: ranked });
}

/** The opening line composed from its claims ({text, claims}); with `history` (and the long-run tables) one rank. */
export function indexSaid(facts, context = {}) {
  const price = (asset) => facts.find((fact) => fact.kind === 'price' && fact.asset === asset);
  const us = ['spx', 'ndx', 'soxx'].map(price).filter(Boolean);
  const kr = ['kospi', 'kosdaq'].map(price).filter(Boolean);
  const listed = (list) => sayJoin(list.map((fact) => say('{name} {move}', { name: fact.label, move: changeClaim(fact, { unit: 'pct' }) })), ', ');
  const parts = [];
  if (us.length) parts.push(say('미국은 {list}', { list: listed(us) }));
  if (kr.length) parts.push(say('한국은 {list}', { list: listed(kr) }));
  if (!parts.length) return NOTHING;
  const spx = price('spx'); const rsp = price('rsp');
  let breadth = NOTHING;
  if (spx && rsp && Math.abs(rsp.change - spx.change) >= 0.8) {
    // The wording follows the sign of both figures: "지수 하락" only on a day the index fell, "덜 내렸습니다" only
    // when the equal-weight index also fell.
    const word = rsp.change <= spx.change ? 'rest-weaker' : spx.change >= 0 ? 'rest-stronger' : rsp.change > 0 ? 'cap-fall-rest-rose' : 'cap-fall-rest-less';
    const rest = changeClaim(rsp, { word, unit: 'pct', label: '동일가중 S&P 500', compare: { against: subjectOf(spx), relation: CLAIM_WORDS[word].relation } });
    breadth = say(' 동일가중 S&P 500은 {rest}로, {rest.word}.', { rest });
  }
  // The index that leads the story: the most material of the US indexes on the ledger.
  const leading = [...us].sort(byMateriality)[0];
  return say('{parts}.{breadth}{rank}', { parts: sayJoin(parts, '. '), breadth, rank: rankSaid(leading, context) });
}
/** The opening line: both markets' indexes, with the equal-weight S&P 500 read against the index (who carried the move). */
export const indexLine = (facts) => indexSaid(facts).text;

function linkIndex(links) {
  const from = new Map(); const to = new Map();
  for (const link of Array.isArray(links) ? links : []) {
    if (!from.has(link.from)) from.set(link.from, []);
    if (!to.has(link.to)) to.set(link.to, []);
    from.get(link.from).push(link); to.get(link.to).push(link);
  }
  return { out: (id) => from.get(id) || [], into: (id) => to.get(id) || [] };
}

/**
 * @param {object|null} day market-day.v1
 * @returns {{available:boolean, opening:string, coverage:object|null, stories:Array, more:Array, unexplained:Array, ahead:Array}}
 */
/** The company's own earnings brief whose first reaction session is `date` (event-briefs.v1 rows), else null. */
export function reportFor(briefs, sym, date) {
  const list = Array.isArray(briefs) ? briefs : Array.isArray(briefs?.briefs) ? briefs.briefs : [];
  const want = String(sym || '').toUpperCase();
  if (!want || !date) return null;
  return list.find((brief) => brief?.kind === 'earnings' && String(brief.symbol || '').toUpperCase() === want
    && (brief.reaction?.firstDate === date || (!brief.reaction?.firstDate && brief.eventDate === date))) || null;
}

export function buildDayAccount(day, { briefs = null, history = null, longrun = null } = {}) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  if (!facts.length) return { available: false, opening: '', claims: { opening: [], asOf: [] }, coverage: null, asOf: '', stories: [], more: [], unexplained: [], reported: [], ahead: [] };
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const { out, into } = linkIndex(day.links);
  const claimed = new Map(); // fact id -> story id
  const headlinesAbout = (subjects, change, seed = null) => facts.filter((fact) => fact.kind === 'headline' && shownKorean(fact) && fact.rank !== 'context' && !claimed.has(fact.id)
    && (fact.subjects || []).some((sym) => subjects.includes(sym)) && agrees(fact, change, seed)).sort(byReportOrder);
  // A price story's reports must name its field in their own words (the topic link alone follows the feed it came from).
  const topicHeadlines = (ids, topics, seed) => [...new Set(ids.flatMap((id) => into(id).filter((link) => link.basis === 'topic').map((link) => link.from)))]
    .map((id) => byId.get(id)).filter((fact) => fact && shownKorean(fact) && fact.rank !== 'context' && !claimed.has(fact.id) && (fact.wordTopics || []).some((topic) => topics.includes(topic))
      && (!afterClose(fact, seed) || agrees(fact, seed.change, seed))).sort(byReportOrder);
  const stories = [];
  const assign = (story, list) => { for (const fact of list) if (fact && !claimed.has(fact.id)) claimed.set(fact.id, story.id); };
  const groupMembers = (fact) => new Set(fact.members || []);
  // The stock that leads a fact's market-day thread (its largest move), when that is another stock move.
  const threadLeadSymbol = (id) => {
    const lead = byId.get((Array.isArray(day.threads) ? day.threads : []).find((thread) => (thread.facts || []).includes(id))?.lead);
    return lead?.kind === 'stock-move' && lead.id !== id ? lead.subjects?.[0] || null : null;
  };

  for (const seed of facts.filter((fact) => SEED_KINDS.has(fact.kind) && fact.kind !== 'price' || (fact.kind === 'price' && FAMILY_OF.get(fact.asset)?.id !== 'us' && FAMILY_OF.get(fact.asset)?.id !== 'kr')).sort(byMateriality)) {
    if (claimed.has(seed.id) || !['lead', 'major', 'minor'].includes(seed.rank)) continue;
    // Direction is the lead fact's own sign (a spread widening is +), for the story's weight bar; not a tone.
    const story = { id: `story:${seed.id}`, rank: seed.rank, materiality: seed.materiality || 0, direction: Math.sign(Number(seed.change) || 0), kind: seed.kind, title: '', line: '', why: [], evidence: [], related: [], claims: [] };
    if (seed.kind === 'price') {
      const family = FAMILY_OF.get(seed.asset);
      const kin = facts.filter((fact) => fact.kind === 'price' && FAMILY_OF.get(fact.asset) === family && fact.rank !== 'context' && !claimed.has(fact.id)).sort(byMateriality);
      const ids = kin.map((fact) => fact.id);
      const driven = [...new Map(ids.flatMap((id) => out(id).filter((link) => link.basis === 'driver').map((link) => byId.get(link.to)))
        .filter((fact) => fact?.kind === 'group-move' && !claimed.has(fact.id)).map((fact) => [fact.id, fact])).values()]
        .sort((a, b) => Number(String(b.group).startsWith('theme:')) - Number(String(a.group).startsWith('theme:')) || byMateriality(a, b));
      // A theme and the sector of the same members are one move: the theme (Korean name) speaks for both.
      const groups = driven.filter((fact, index) => !driven.slice(0, index).some((other) => [...groupMembers(other)].filter((sym) => groupMembers(fact).has(sym)).length >= Math.min(groupMembers(fact).size, groupMembers(other).size) / 2));
      tell(story, 'title', say('{name} {move.word}', { name: family ? family.name : seed.label, move: changeClaim(seed, { word: seed.change >= 0 ? family?.up || 'rise' : family?.down || 'fall' }) }));
      // A fact the ledger ranked on its five-session leg (sizedBy 'week') says that leg — the day
      // is the same sign by the rule, and "평소 하루 변동의 0.9배" would not say why it leads.
      // 가장 큰 변화 is the family member whose move is largest against its own volatility, on the leg the ledger sized
      // it by. That is not always the lead: the lead is the most material, and a core gauge (the dollar index, the 10-year,
      // HY) counts more than a secondary one, so "가장 큰 변화(달러지수)" stood beside a larger 엔/달러 move.
      const largest = kin.reduce((best, fact) => (legSize(fact) > legSize(best) ? fact : best), seed);
      const byWeek = largest.sizedBy === 'week' && Number.isFinite(largest.zWeek) && Number.isFinite(largest.week);
      const times = byWeek ? say('5거래일 {week}로 평소 5거래일 변동의 {week.1}입니다.', { week: weekClaim(largest) })
        : Number.isFinite(largest.z) ? say('평소 하루 변동의 {z}입니다.', { z: figureClaim(largest, 'z1d', Math.abs(largest.z), 'x', '평소 하루 변동') }) : NOTHING;
      // The close date leads, so this day move is not read against a live quote chip or a week figure.
      const tail = !times.text ? NOTHING : kin.length > 1 ? say(' {largest.word}: {name}, {times}', { largest: largestClaim(largest, family), name: largest.label, times }) : say(' {times}', { times });
      tell(story, 'line', say('{date}{kin}.{tail}', { date: seed.date ? say('{seed.date} 종가 ', { seed: changeClaim(seed) }) : NOTHING, kin: sayJoin(kin.map((fact) => named(fact)), ', '), tail }));
      if (groups.length) {
        const moved = groups.slice(0, 2).map((fact) => changeClaim(fact, { word: 'moved-with', unit: 'pct', compare: { against: subjectOf(seed) } }));
        tell(story, 'why', say('{first.word} 업종은 {list}입니다.', { first: moved[0], list: sayJoin(moved.map((group, i) => say('{name}({group})', { name: groups[i].label, group })), ', ') }));
      }
      const reports = topicHeadlines(ids, family?.topics || [], seed).slice(0, 2);
      story.evidence = reports.map(evidenceOf);
      story.faceFrom ??= reports;
      assign(story,[...kin, ...driven, ...reports]);
      for (const group of driven) assign(story,(group.members || []).map((sym) => facts.find((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym)));
    } else if (seed.kind === 'group-move') {
      const members = seed.members || [];
      const moved = facts.filter((fact) => fact.kind === 'stock-move' && members.includes(fact.subjects?.[0]) && !claimed.has(fact.id)).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      const siblings = facts.filter((fact) => fact.kind === 'group-move' && fact.id !== seed.id && !claimed.has(fact.id)
        && (fact.members || []).filter((sym) => members.includes(sym)).length >= Math.min((fact.members || []).length, members.length) / 2);
      // The group's own leaders are its largest members' moves in the median's direction; the stock-move facts are only
      // the members big enough to matter to the index, so they are named as such when the group carries no leaders.
      const stockOf = (sym) => facts.find((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym);
      const ownLeaders = (Array.isArray(seed.leaders) ? seed.leaders : []).filter((lead) => lead?.sym && readNumber(lead.change) !== null);
      const movers = ownLeaders.length
        ? ownLeaders.slice(0, 3).map((lead) => ({ sym: lead.sym, change: readNumber(lead.change), stock: stockOf(lead.sym) }))
        : moved.slice(0, 3).map((fact) => ({ sym: fact.subjects[0], change: fact.change, stock: fact }));
      const leaders = memberClaim(seed, movers, ownLeaders.length ? (seed.change >= 0 ? 'most-rose' : 'most-fell') : 'main-movers');
      tell(story, 'title', say('{name} {median.word}', { name: seed.label, median: changeClaim(seed, { word: seed.change >= 0 ? 'rise' : 'fall', unit: 'pct' }) }));
      tell(story, 'line', say('업종 중간값 {median}{leaders}.', { median: changeClaim(seed, { unit: 'pct', label: '업종 중간값' }),
        leaders: movers.length ? say(', {leaders.word} 종목은 {list}', { leaders, list: sayJoin(movers.map((row, i) => say('{sym} {leaders.' + i + '}{vol}', { sym: row.sym, leaders, vol: volTag(row.stock) })), ', ') }) : NOTHING }));
      const drivers = into(seed.id).filter((link) => link.basis === 'driver').map((link) => byId.get(link.from)).filter(Boolean);
      const drivenBy = drivers.map((fact) => claimed.get(fact.id)).find(Boolean);
      if (drivers.length) tell(story, 'why', say('{name} {driver}와 {driver.word}입니다.', { name: drivers[0].label, driver: changeClaim(drivers[0], { word: 'same-way', compare: { against: subjectOf(seed) } }) }));
      story.joins = drivenBy || null;
      const reports = headlinesAbout(members, seed.change, seed).slice(0, 3);
      // On the face, a group's report must be about the group's move: it names one of the leaders that made the median,
      // or the stock that leads the group's thread (that stock's report, ranked first). A report naming any other member
      // ("헤지펀드가 매수하는 AI 주식에 Intel, Meta 포함" under 반도체 +13.5%) stays folded.
      const leadSym = threadLeadSymbol(seed.id);
      const leaderSyms = new Set([...(leadSym ? [leadSym] : []), ...ownLeaders.slice(0, 3).map((lead) => lead.sym)]);
      const names = (fact) => (fact.subjects || []).some((sym) => leaderSyms.has(sym));
      const viaLead = (fact) => Number(!!leadSym && (fact.subjects || []).includes(leadSym));
      story.faceFrom = headlinesAbout([...leaderSyms], seed.change, seed).filter(names).sort((a, b) => viaLead(b) - viaLead(a) || byReportOrder(a, b));
      story.evidence = reports.map(evidenceOf);
      story.faceFrom ??= reports;
      story.related = moved.slice(0, 6).map((fact) => ({ sym: fact.subjects[0], label: fact.label, change: fact.change }));
      assign(story,[seed, ...moved, ...siblings, ...reports]);
    } else if (seed.kind === 'earnings') {
      const sym = seed.subjects?.[0];
      const stock = facts.find((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym && !claimed.has(fact.id));
      const result = sayJoin([Number.isFinite(seed.epsSurprise) ? say('주당순이익은 예상보다 {eps}', { eps: figureClaim(seed, 'epsSurprise', seed.epsSurprise, 'pct', '주당순이익') }) : NOTHING,
        Number.isFinite(seed.revenueSurprise) ? say('매출은 {revenue}', { revenue: figureClaim(seed, 'revenueSurprise', seed.revenueSurprise, 'pct', '매출') }) : NOTHING], ', ');
      tell(story, 'title', say('{name} 실적', { name: seed.label }));
      tell(story, 'line', say('{result}{stock}', { result: result.text ? say('{result}.', { result }) : say('실적을 발표했습니다.'),
        stock: stock ? say(' 주가 {move}{vol}.{pull}', { move: changeClaim(stock, { unit: 'pct', label: '주가' }), vol: volTag(stock), pull: pullSaid(stock).text ? say(' {pull}.', { pull: pullSaid(stock) }) : NOTHING }) : NOTHING }));
      const reports = headlinesAbout([sym], stock?.change, stock).slice(0, 3);
      story.evidence = reports.map(evidenceOf);
      story.faceFrom ??= reports;
      assign(story,[seed, stock, ...reports]);
    } else if (seed.kind === 'deal') {
      // A deal fact carries acquirer/target/terms but no label, so the generic branch told it
      // as an empty title and line under its reports.
      const name = (sym) => facts.find((fact) => fact.subjects?.[0] === sym && fact.kind !== 'headline' && fact.label)?.label || sym;
      const reports = headlinesAbout(seed.subjects || [], NaN).slice(0, 3);
      tell(story, 'title', say('{acquirer}, {target} 인수', { acquirer: name(seed.acquirer), target: name(seed.target) }));
      const terms = sayJoin([Number.isFinite(seed.valueUsd) && seed.valueUsd > 0 ? say('규모 {value}', { value: figureClaim(seed, 'dealValue', seed.valueUsd, 'usd', '규모') }) : NOTHING,
        say(seed.payment === 'stock' ? '주식 교환' : seed.payment === 'cash' ? '현금 인수' : ''),
        Number.isFinite(seed.premiumPct) ? say('프리미엄 {premium}', { premium: figureClaim(seed, 'dealPremium', seed.premiumPct, 'pct', '프리미엄') }) : NOTHING], ', ');
      tell(story, 'line', terms.text ? say('{terms}.', { terms }) : NOTHING);
      story.evidence = reports.map(evidenceOf);
      story.faceFrom ??= reports;
      assign(story,[seed, ...reports]);
    } else {
      const sym = seed.subjects?.[0];
      if (seed.kind === 'stock-move' && !(seed.explainedBy || []).length) continue; // told below as unexplained
      const reports = sym ? headlinesAbout([sym], seed.change, seed.kind === 'stock-move' ? seed : null).slice(0, 3) : [];
      // A stock that also reported: its results are the story's first reason.
      const results = seed.kind === 'stock-move' ? facts.find((fact) => fact.kind === 'earnings' && fact.subjects?.[0] === sym && !claimed.has(fact.id)) : null;
      const resultText = results ? sayJoin([Number.isFinite(results.epsSurprise) ? say('주당순이익 예상 대비 {eps}', { eps: figureClaim(results, 'epsSurprise', results.epsSurprise, 'pct', '주당순이익') }) : NOTHING,
        Number.isFinite(results.revenueSurprise) ? say('매출 {revenue}', { revenue: figureClaim(results, 'revenueSurprise', results.revenueSurprise, 'pct', '매출') }) : NOTHING], ', ') : NOTHING;
      if (results) assign(story,[results]);
      if (seed.kind === 'stock-move') {
        // With no linked report, the price its group runs on (explainedBy 'driver') is named with its move, as the group
        // stories do; with one, the report itself is the evidence line (story.report).
        const driver = reports.length ? null : into(seed.id).filter((link) => link.basis === 'driver').map((link) => byId.get(link.from)).find(Boolean);
        tell(story, 'title', named(seed));
        tell(story, 'line', say('{results}{size}{driver}', {
          results: resultText.text ? say('실적 발표({results}) 뒤의 움직임입니다. ', { results: resultText }) : NOTHING,
          size: pullSaid(seed).text ? say('{pull}.', { pull: pullSaid(seed) }) : say('평소 움직임의 {z}입니다.', { z: figureClaim(seed, 'z1d', Math.abs(seed.z || 0), 'x', '평소 움직임') }),
          driver: driver ? say(' {name} {driver}와 {driver.word}입니다.', { name: driver.label, driver: changeClaim(driver, { word: 'same-way', compare: { against: subjectOf(seed) } }) }) : NOTHING }));
      } else {
        // An event's own label and reason, as the ledger wrote them.
        story.title = seed.label || seed.title || '';
        story.line = seed.why || '';
      }
      story.evidence = reports.map(evidenceOf);
      story.faceFrom ??= reports;
      assign(story,[seed, ...reports]);
    }
    if (!story.title) continue; // a seed kind with no wording here is not shown as a bare weight bar
    // A lead story's top linked report (byReportOrder) is shown on the face under the move, as written.
    story.report = story.rank === 'lead' ? faceReport(seed, story.faceFrom || []) : null;
    delete story.faceFrom;
    stories.push(story);
  }

  // v59.70 (re-review N7): the same US → Korea order as 오늘's names, no third market.
  // TEAM -16.1% sat under "이유가 확인되지 않은 큰 움직임" while 뉴스 carried its 8-K
  // earnings brief (-16.2% on the first session). A move on the first session after the company's own report is that
  // report's reaction: it leaves the unexplained list (before the cap of six) and is told with the brief's headline.
  const unclaimed = usThenKorea(facts.filter((fact) => fact.kind === 'stock-move' && !(fact.explainedBy || []).length && !claimed.has(fact.id) && ['lead', 'major', 'minor'].includes(fact.rank)),
    (fact) => String(fact.subjects?.[0] || ''), (a, b) => Math.abs(b.change) - Math.abs(a.change));
  const reported = [];
  const rowOf = (fact) => ({ sym: fact.subjects?.[0], label: fact.label, change: fact.change, rvol: Number.isFinite(fact.rvol) ? fact.rvol : null });
  const unexplainedFacts = unclaimed.filter((fact) => {
    const brief = reportFor(briefs, fact.subjects?.[0], fact.date);
    if (!brief) return true;
    reported.push({ ...rowOf(fact), headline: brief.headline || '', reportDate: brief.eventDate || null });
    return false;
  });
  const unexplained = unexplainedFacts.slice(0, 6).map(rowOf);
  const ahead = facts.filter((fact) => fact.kind === 'upcoming' && ['lead', 'major'].includes(fact.rank))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || byMateriality(a, b))
    .map((fact) => ({ date: fact.date, label: fact.label, why: fact.why || (fact.hour === 'amc' ? '장 마감 후 실적' : fact.hour === 'bmo' ? '장 시작 전 실적' : ''), rank: fact.rank }));
  const face = stories.filter((story) => story.rank !== 'minor').slice(0, 6);
  const counts = facts.reduce((acc, fact) => { acc[fact.rank] = (acc[fact.rank] || 0) + 1; return acc; }, {});
  const opening = indexSaid(facts, { history, longrun });
  const asOf = sessionLabel(day, facts);
  return {
    available: true,
    opening: opening.text,
    // what the opening line and the date label claim (each story carries its own claims)
    claims: { opening: opening.claims, asOf: asOf.claims },
    coverage: { facts: facts.length, lead: counts.lead || 0, major: counts.major || 0, noise: day.dropped?.noise || 0, generatedAt: day.generatedAt || null, session: day.sessions?.us || null },
    // the one dated label of these stories — 오늘's 오늘의 핵심 and 브리핑's 지난 24시간 both
    // print it, so the briefing no longer sits its 11/16 movers under the page's 11/17 close line with no date.
    asOf: asOf.text,
    stories: face,
    more: stories.filter((story) => !face.includes(story)).slice(0, 12),
    unexplained,
    reported: reported.slice(0, 6),
    ahead,
    md
  };
}
