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

/**
 * `(story) => { moves: [{ id, said }] } | null` over one market-day ledger: the stock, group and price facts a matched
 * headline is linked to by subject or member (a topic link is too broad to name), most material first, at most two.
 * A story the ledger did not link (it keeps fifty headlines) still names its company: when the card resolved exactly
 * one issuer, that issuer's own stock move is the tie — the same subject basis, read from the card instead of the ledger.
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
  const headlinesOf = ledgerHeadlinesOf(day);
  return (story, { issuers = [] } = {}) => {
    if (!story) return null;
    const byLedger = headlinesOf(story).flatMap((fact) => movesOf.get(fact.id) || []);
    const own = !byLedger.length && issuers.length === 1 ? stockMoveOf.get(issuers[0]) : null;
    const linked = [...new Set(own ? [own] : byLedger)]
      .sort((a, b) => (Number(b.materiality) || 0) - (Number(a.materiality) || 0))
      .slice(0, MAX_MOVES)
      .map((fact) => ({ id: fact.id, said: moveSaid(fact) }));
    return linked.length ? { moves: linked } : null;
  };
}
