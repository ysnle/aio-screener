// Which moves of the day's market story a news story belongs to: the ones the market-day ledger links it to. A tie
// says the ledger links the article to the move, never that the article moved the price. A relayed-story label was
// tried on the card and dropped: the story patterns are written to count mentions (a company name is enough), which is
// too loose to say what one article is about.
import { say } from '../shared/claim.js';
import { readNumber } from '../shared/number.js';
import { ledgerHeadlinesOf } from './news-picks.js';
import { changeClaim } from './day-account.js';

const MOVE_KINDS = new Set(['stock-move', 'group-move', 'price']);
const MAX_MOVES = 2;

// The day account's own claim of a move's one-session change, so the card and the account print one figure.
const moveSaid = (fact) => say('{label} {change}', { label: fact.label, change: changeClaim(fact) });

// A headline that reports a priced asset's own move ("Gold edges lower…", "원/달러 환율 … 하락") names that asset as its
// subject. The ledger links prices to headlines by topic only (too broad to name) and keeps fifty headlines of a bundle
// of about 150, so 10 of 128 cards carried a fact line on 11/27. The asset is read from the card: its name and a
// price-move word, both in the headline — "Congo Gold Trader Plans Two Refineries" names gold and reports no price.
const ASSET_NAMES = Object.freeze([
  ['gold', /(?<!digital )\bgold\b|금값|금 가격/i], ['silver', /\bsilver\b|은값|은 가격/i],
  ['wti', /\b(?:oil|crude|wti)\b|(?<![가-힣])유가(?!증권)|원유/i], ['brent', /\bbrent\b|브렌트/i],
  ['tnx', /\b(?:10-year|treasury yields?|treasuries)\b|미 국채|美 국채|미국 국채/i],
  ['spx', /\b(?:s&p 500|wall street|us stocks)\b|뉴욕증시|S&P\s?500/i], ['ndx', /(?<![(:])\bnasdaq\b(?!\s*:)|나스닥/i], ['rut', /\b(?:russell 2000|small caps)\b|러셀/i],
  ['vix', /\b(?:vix|volatility index)\b|공포지수/i], ['soxx', /\b(?:chip|semiconductor) stocks\b|반도체주/i],
  ['dxy', /\b(?:dollar index|dxy|greenback)\b|\bdollar\b(?! tree| general)|달러지수|달러인덱스|달러화/i],
  ['usdjpy', /\byen\b|엔화|엔\/달러|달러[-·\/]엔/i], ['usdkrw', /\bwon\b(?!['’]t)|원[\/·]달러|원달러|달러[-·\/]원|원화/i],
  ['kospi', /\bkospi\b|코스피/i], ['kosdaq', /\bkosdaq\b|코스닥/i], ['btc', /\bbitcoin\b|비트코인/i],
].map(([asset, re]) => Object.freeze({ asset, re })));
const UP_WORDS = /\b(?:rises?|rose|gains?|jumps?|surges?|soars?|climbs?|rall(?:y|ies)|rebounds?|strengthens?|higher)\b|상승|급등|폭등|반등|강세|올라|돌파|회복|↑/i;
const DOWN_WORDS = /\b(?:falls?|fell|drops?|slips?|slides?|slid|tumbles?|plunges?|sinks?|retreats?|weakens?|lower)\b|하락|급락|폭락|약세|내려|반납|↓/i;
const FLAT_WORDS = /\b(?:edges?|drifts?|stead(?:y|ies)|flat|little changed)\b|보합|마감/i;
const reportsMove = (title) => UP_WORDS.test(title) || DOWN_WORDS.test(title) || FLAT_WORDS.test(title);
// A headline that says only "rises" is not the report of a session the ledger priced as a fall (another session's move).
const agrees = (title, fact) => { const up = UP_WORDS.test(title); const down = DOWN_WORDS.test(title); return up === down || (up ? fact.change > 0 : fact.change < 0); };
const KOREAN_SESSION_ASSETS = new Set(['kospi', 'kosdaq', 'usdkrw']);
const HOUR = 3600000;
// The article reports the session the ledger priced: from the evening before that date to the next session's open
// (14:00Z the next day for a US close, the next midnight UTC for a Korean one). A later article is about a later move.
const reportsSession = (stamp, fact) => {
  const day = Date.parse(`${fact.date}T00:00:00Z`);
  return Number.isFinite(stamp) && Number.isFinite(day) && stamp >= day - 9 * HOUR && stamp < day + (KOREAN_SESSION_ASSETS.has(fact.asset) ? 24 : 38) * HOUR;
};

/**
 * `(story) => { moves: [{ id, said }] } | null` over one market-day ledger: the stock, group and price facts a matched
 * headline is linked to by subject or member (a topic link is too broad to name), most material first, at most two.
 * A story the ledger did not link (it keeps fifty headlines) still names its subject, read from the card instead of the
 * ledger: when the card resolved exactly one issuer, that issuer's own stock move; else the priced assets whose move
 * the headline reports (ASSET_NAMES) for the session the ledger priced.
 */
export function newsStoryLinks(day) {
  if (!day || typeof day !== 'object') return () => null;
  const facts = Array.isArray(day.facts) ? day.facts : [];
  const moves = new Map(facts.filter((fact) => MOVE_KINDS.has(fact?.kind) && readNumber(fact.change) !== null && fact.label).map((fact) => [fact.id, fact]));
  const movesOf = new Map();
  for (const link of Array.isArray(day.links) ? day.links : []) {
    if ((link?.basis !== 'subject' && link?.basis !== 'member') || !moves.has(link.to)) continue;
    movesOf.set(link.from, [...(movesOf.get(link.from) || []), moves.get(link.to)]);
  }
  const stockMoveOf = new Map([...moves.values()].filter((fact) => fact.kind === 'stock-move' && fact.subjects?.length === 1).map((fact) => [fact.subjects[0], fact]));
  const priceOf = new Map([...moves.values()].filter((fact) => fact.kind === 'price' && fact.asset && Math.abs(readNumber(fact.change)) >= 0.05).map((fact) => [fact.asset, fact]));
  const headlinesOf = ledgerHeadlinesOf(day);
  const assetsOf = (story) => {
    const title = `${story.originalTitle || ''} ${story.title || ''}`;
    if (!reportsMove(title)) return [];
    const stamp = Date.parse(story.pubDate || story.publishedAt || story.eventTime || '');
    return ASSET_NAMES.filter(({ asset, re }) => priceOf.has(asset) && re.test(title) && reportsSession(stamp, priceOf.get(asset)) && agrees(title, priceOf.get(asset))).map(({ asset }) => priceOf.get(asset));
  };
  return (story, { issuers = [] } = {}) => {
    if (!story) return null;
    const byLedger = headlinesOf(story).flatMap((fact) => movesOf.get(fact.id) || []);
    const own = !byLedger.length && issuers.length === 1 ? stockMoveOf.get(issuers[0]) : null;
    const linked = [...new Set(own ? [own] : [...byLedger, ...assetsOf(story)])]
      .sort((a, b) => (Number(b.materiality) || 0) - (Number(a.materiality) || 0))
      .slice(0, MAX_MOVES)
      .map((fact) => ({ id: fact.id, said: moveSaid(fact) }));
    return linked.length ? { moves: linked } : null;
  };
}
