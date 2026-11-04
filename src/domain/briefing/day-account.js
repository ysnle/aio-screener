// v59.65 (owner 2026-11-03, phase 3): 브리핑 tells the last 24 hours as linked stories from the market-day ledger
// (public-data/market-day.json, src/domain/market-day/facts.js). The ledger's own threads join everything a shared subject
// or peer touches (one 11/3 thread held 36 facts), so a story here is one level down: a lead or major fact claims its direct
// neighbours — the members of a group, the headlines about its subject, the groups the price drives, the same-family
// prices — and a fact belongs to one story only, in materiality order. What moved hard with nothing linked to it is kept
// apart as unexplained; what is still ahead is a dated list. Nothing is scored here: rank and materiality are the ledger's.
import { signedText } from '../shared/number.js';

const pct = (value, digits = 1) => signedText(value, digits, '%');
const bp = (value) => signedText(value, 0, 'bp');
const md = (date) => { const text = String(date || ''); return text.length >= 10 ? `${Number(text.slice(5, 7))}/${Number(text.slice(8, 10))}` : text; };
const move = (fact) => (fact.unit === 'bp' ? bp(fact.change) : pct(fact.change));
const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

// Prices told together: one story per family, named by the family and the direction that matters for it.
const FAMILIES = Object.freeze([
  { id: 'oil', name: '유가', assets: ['wti', 'brent'], up: '상승', down: '하락', topics: ['energy'] },
  { id: 'credit', name: '신용 스프레드', assets: ['igOas', 'hyOas', 'cccOas'], up: '확대', down: '축소', topics: ['credit'] },
  { id: 'rates', name: '금리', assets: ['tnx', 'dgs2', 'realYield10', 'breakeven10'], up: '상승', down: '하락', topics: ['rates', 'inflation'] },
  { id: 'dollar', name: '달러', assets: ['dxy', 'usdjpy', 'usdkrw'], up: '강세', down: '약세', topics: ['fx'] },
  { id: 'metals', name: '금과 은', assets: ['gold', 'silver'], up: '상승', down: '하락', topics: ['metals'] },
  { id: 'vol', name: '변동성', assets: ['vix'], up: '확대', down: '진정', topics: [] },
  { id: 'crypto', name: '비트코인', assets: ['btc'], up: '상승', down: '하락', topics: ['crypto'] },
  { id: 'us', name: '미국 지수', assets: ['spx', 'ndx', 'soxx', 'rut', 'rsp'], up: '상승', down: '하락' },
  { id: 'kr', name: '한국 증시', assets: ['kospi', 'kosdaq'], up: '상승', down: '하락' }
]);
const FAMILY_OF = new Map(FAMILIES.flatMap((family) => family.assets.map((asset) => [asset, family])));
const SEED_KINDS = new Set(['price', 'group-move', 'stock-move', 'earnings', 'deal', 'event']);

const byMateriality = (a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.materiality || 0) - (a.materiality || 0);
// A report whose own words point the other way from the move ("... Move Higher" under a -2.8% day) is an older story.
const UP_WORDS = /\b(?:rise[sn]?|rising|jump(?:s|ed)?|gain(?:s|ed)?|surge[sd]?|soar(?:s|ed)?|rall(?:y|ies|ied)|higher|climb(?:s|ed)?)\b|(?<![가-힣])(?:상승|급등|강세)/i;
const DOWN_WORDS = /\b(?:fall(?:s|en)?|fell|drop(?:s|ped)?|slide[sd]?|slid|tumbl(?:e|es|ed|ing)|sinks?|sank|plunge[sd]?|lower|slump(?:s|ed)?|dips?)\b|(?<![가-힣])(?:하락|급락|약세)/i;
const agrees = (fact, change) => {
  const text = `${fact.title || ''} ${fact.titleKo || ''}`;
  const up = UP_WORDS.test(text); const down = DOWN_WORDS.test(text);
  return !Number.isFinite(change) || up === down || (change >= 0 ? up : down);
};
const evidenceOf = (fact) => ({ title: fact.titleKo || fact.title, original: fact.titleKo ? fact.title : null, at: fact.at || null });

/** The opening line: both markets' indexes, with the equal-weight S&P 500 read against the index (who carried the move). */
export function indexLine(facts) {
  const price = (asset) => facts.find((fact) => fact.kind === 'price' && fact.asset === asset);
  const us = ['spx', 'ndx', 'soxx'].map(price).filter(Boolean);
  const kr = ['kospi', 'kosdaq'].map(price).filter(Boolean);
  const parts = [];
  if (us.length) parts.push(`미국은 ${us.map((fact) => `${fact.label} ${pct(fact.change)}`).join(', ')}`);
  if (kr.length) parts.push(`한국은 ${kr.map((fact) => `${fact.label} ${pct(fact.change)}`).join(', ')}`);
  if (!parts.length) return '';
  const spx = price('spx'); const rsp = price('rsp');
  let breadth = '';
  if (spx && rsp && Math.abs(rsp.change - spx.change) >= 0.8) {
    breadth = rsp.change > spx.change ? ` 동일가중 S&P 500은 ${pct(rsp.change)}로, 지수 하락은 대형주 몇 곳에 몰렸고 나머지 종목은 덜 내렸습니다.`
      : ` 동일가중 S&P 500은 ${pct(rsp.change)}로, 지수보다 나머지 종목이 더 약했습니다.`;
  }
  return `${parts.join('. ')}.${breadth}`;
}

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
export function buildDayAccount(day) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  if (!facts.length) return { available: false, opening: '', coverage: null, stories: [], more: [], unexplained: [], ahead: [] };
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const { out, into } = linkIndex(day.links);
  const claimed = new Map(); // fact id -> story id
  const headlinesAbout = (subjects, change) => facts.filter((fact) => fact.kind === 'headline' && fact.rank !== 'context' && !claimed.has(fact.id)
    && (fact.subjects || []).some((sym) => subjects.includes(sym)) && agrees(fact, change)).sort(byMateriality);
  // A price story's reports must name its field in their own words (the topic link alone follows the feed it came from).
  const topicHeadlines = (ids, topics) => [...new Set(ids.flatMap((id) => into(id).filter((link) => link.basis === 'topic').map((link) => link.from)))]
    .map((id) => byId.get(id)).filter((fact) => fact && fact.rank !== 'context' && !claimed.has(fact.id) && (fact.wordTopics || []).some((topic) => topics.includes(topic))).sort(byMateriality);
  const stories = [];
  const claim = (story, list) => { for (const fact of list) if (fact && !claimed.has(fact.id)) claimed.set(fact.id, story.id); };
  const groupMembers = (fact) => new Set(fact.members || []);

  for (const seed of facts.filter((fact) => SEED_KINDS.has(fact.kind) && fact.kind !== 'price' || (fact.kind === 'price' && FAMILY_OF.get(fact.asset)?.id !== 'us' && FAMILY_OF.get(fact.asset)?.id !== 'kr')).sort(byMateriality)) {
    if (claimed.has(seed.id) || !['lead', 'major', 'minor'].includes(seed.rank)) continue;
    // v59.68: direction is the lead fact's own sign (a spread widening is +), for the story's weight bar; not a tone.
    const story = { id: `story:${seed.id}`, rank: seed.rank, materiality: seed.materiality || 0, direction: Math.sign(Number(seed.change) || 0), kind: seed.kind, title: '', line: '', why: [], evidence: [], related: [] };
    if (seed.kind === 'price') {
      const family = FAMILY_OF.get(seed.asset);
      const kin = facts.filter((fact) => fact.kind === 'price' && FAMILY_OF.get(fact.asset) === family && fact.rank !== 'context' && !claimed.has(fact.id)).sort(byMateriality);
      const ids = kin.map((fact) => fact.id);
      const driven = [...new Map(ids.flatMap((id) => out(id).filter((link) => link.basis === 'driver').map((link) => byId.get(link.to)))
        .filter((fact) => fact?.kind === 'group-move' && !claimed.has(fact.id)).map((fact) => [fact.id, fact])).values()]
        .sort((a, b) => Number(String(b.group).startsWith('theme:')) - Number(String(a.group).startsWith('theme:')) || byMateriality(a, b));
      // A theme and the sector of the same members are one move: the theme (Korean name) speaks for both.
      const groups = driven.filter((fact, index) => !driven.slice(0, index).some((other) => [...groupMembers(other)].filter((sym) => groupMembers(fact).has(sym)).length >= Math.min(groupMembers(fact).size, groupMembers(other).size) / 2));
      story.title = `${family ? family.name : seed.label} ${seed.change >= 0 ? family?.up || '상승' : family?.down || '하락'}`;
      const times = Number.isFinite(seed.z) ? `평소 하루 변동의 ${Math.abs(seed.z).toFixed(1)}배입니다.` : '';
      story.line = `${kin.map((fact) => `${fact.label} ${move(fact)}`).join(', ')}.${times ? (kin.length > 1 ? ` 가장 큰 변화(${seed.label})는 ${times}` : ` ${times}`) : ''}`;
      if (groups.length) story.why.push(`같이 움직인 업종은 ${groups.slice(0, 2).map((fact) => `${fact.label}(${pct(fact.change)})`).join(', ')}입니다.`);
      const reports = topicHeadlines(ids, family?.topics || []).slice(0, 2);
      story.evidence = reports.map(evidenceOf);
      claim(story, [...kin, ...driven, ...reports]);
      for (const group of driven) claim(story, (group.members || []).map((sym) => facts.find((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym)));
    } else if (seed.kind === 'group-move') {
      const members = seed.members || [];
      const moved = facts.filter((fact) => fact.kind === 'stock-move' && members.includes(fact.subjects?.[0]) && !claimed.has(fact.id)).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      const siblings = facts.filter((fact) => fact.kind === 'group-move' && fact.id !== seed.id && !claimed.has(fact.id)
        && (fact.members || []).filter((sym) => members.includes(sym)).length >= Math.min((fact.members || []).length, members.length) / 2);
      // Leaders already told in an earlier story (MRVL under 광통신 and again under AI 인프라) are not repeated.
      const leaders = moved.slice(0, 3).map((fact) => `${fact.subjects[0]} ${pct(fact.change)}`);
      story.title = `${seed.label} ${seed.change >= 0 ? '상승' : '하락'}`;
      story.line = `업종 중간값 ${pct(seed.change)}${leaders.length ? `, 크게 움직인 종목은 ${leaders.join(', ')}` : ''}.`;
      const drivers = into(seed.id).filter((link) => link.basis === 'driver').map((link) => byId.get(link.from)).filter(Boolean);
      const drivenBy = drivers.map((fact) => claimed.get(fact.id)).find(Boolean);
      if (drivers.length) story.why.push(`${drivers[0].label} ${move(drivers[0])}와 같은 방향입니다.`);
      story.joins = drivenBy || null;
      const reports = headlinesAbout(members, seed.change).slice(0, 3);
      story.evidence = reports.map(evidenceOf);
      story.related = moved.slice(0, 6).map((fact) => ({ sym: fact.subjects[0], label: fact.label, change: fact.change }));
      claim(story, [seed, ...moved, ...siblings, ...reports]);
    } else if (seed.kind === 'earnings') {
      const sym = seed.subjects?.[0];
      const stock = facts.find((fact) => fact.kind === 'stock-move' && fact.subjects?.[0] === sym && !claimed.has(fact.id));
      const result = [Number.isFinite(seed.epsSurprise) ? `주당순이익은 예상보다 ${pct(seed.epsSurprise)}` : null, Number.isFinite(seed.revenueSurprise) ? `매출은 ${pct(seed.revenueSurprise)}` : null].filter(Boolean);
      story.title = `${seed.label} 실적`;
      story.line = `${result.length ? `${result.join(', ')}.` : '실적을 발표했습니다.'}${stock ? ` 주가 ${pct(stock.change)}${Number.isFinite(stock.indexBp) && Math.abs(stock.indexBp) >= 5 ? `(S&P 500에 ${bp(stock.indexBp)})` : ''}.` : ''}`;
      const reports = headlinesAbout([sym], stock?.change).slice(0, 3);
      story.evidence = reports.map(evidenceOf);
      claim(story, [seed, stock, ...reports]);
    } else {
      const sym = seed.subjects?.[0];
      if (seed.kind === 'stock-move' && !(seed.explainedBy || []).length) continue; // told below as unexplained
      const reports = sym ? headlinesAbout([sym], seed.change).slice(0, 3) : [];
      // A stock that also reported: its results are the story's first reason.
      const results = seed.kind === 'stock-move' ? facts.find((fact) => fact.kind === 'earnings' && fact.subjects?.[0] === sym && !claimed.has(fact.id)) : null;
      const resultText = results ? [Number.isFinite(results.epsSurprise) ? `주당순이익 예상 대비 ${pct(results.epsSurprise)}` : null, Number.isFinite(results.revenueSurprise) ? `매출 ${pct(results.revenueSurprise)}` : null].filter(Boolean).join(', ') : '';
      if (results) claim(story, [results]);
      story.title = seed.kind === 'stock-move' ? `${seed.label} ${pct(seed.change)}` : seed.label || seed.title || '';
      story.line = seed.kind === 'stock-move'
        ? `${resultText ? `실적 발표(${resultText}) 뒤의 움직임입니다. ` : ''}${Number.isFinite(seed.indexBp) && Math.abs(seed.indexBp) >= 5 ? `S&P 500 지수에 ${bp(seed.indexBp)}만큼 영향을 줬습니다.` : `평소 움직임의 ${Math.abs(seed.z || 0).toFixed(1)}배입니다.`}${(seed.explainedBy || []).includes('driver') ? ' 업종이 따르는 가격과 같은 방향입니다.' : ''}`
        : seed.why || '';
      story.evidence = reports.map(evidenceOf);
      claim(story, [seed, ...reports]);
    }
    stories.push(story);
  }

  const unexplained = facts.filter((fact) => fact.kind === 'stock-move' && !(fact.explainedBy || []).length && !claimed.has(fact.id) && ['lead', 'major', 'minor'].includes(fact.rank))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6).map((fact) => ({ sym: fact.subjects?.[0], label: fact.label, change: fact.change }));
  const ahead = facts.filter((fact) => fact.kind === 'upcoming' && ['lead', 'major'].includes(fact.rank))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || byMateriality(a, b))
    .map((fact) => ({ date: fact.date, label: fact.label, why: fact.why || (fact.hour === 'amc' ? '장 마감 후 실적' : fact.hour === 'bmo' ? '장 시작 전 실적' : ''), rank: fact.rank }));
  const face = stories.filter((story) => story.rank !== 'minor').slice(0, 6);
  const counts = facts.reduce((acc, fact) => { acc[fact.rank] = (acc[fact.rank] || 0) + 1; return acc; }, {});
  return {
    available: true,
    opening: indexLine(facts),
    coverage: { facts: facts.length, lead: counts.lead || 0, major: counts.major || 0, noise: day.dropped?.noise || 0, generatedAt: day.generatedAt || null, session: day.sessions?.us || null },
    stories: face,
    more: stories.filter((story) => !face.includes(story)).slice(0, 12),
    unexplained,
    ahead,
    md
  };
}
