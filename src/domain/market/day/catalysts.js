// The session's catalysts: the headlines the day ledger (public-data/market-day.json, facts.js buildMarketDay) itself
// linked to a move of that session and graded at least major on its own materiality scale. No second ranking: the
// ledger's materiality orders them, its links decide which qualify. A headline the ledger did not link, or graded
// minor, is not a catalyst; with none the line is absent. The title is the ledger's Korean title as collected — a
// headline is quoted, not rewritten, and what it means for the move is the AI reading's.
import { say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { DAY_READ_WORDS } from '../../content/day-read-words.js';

const W = DAY_READ_WORDS.catalysts;
export const CATALYST_RANKS = Object.freeze(['lead', 'major']);
export const CATALYSTS_MAX = 3;
const MOVE_KINDS = new Set(['price', 'stock-move', 'group-move']);

/**
 * @param {object|null} day market-day.json
 * @param {string} asOf the basis US session (the opening's)
 * @returns {{items: Array<{id: string, date: string, title: string, materiality: number, moves: string[]}>, said: {text: string, claims: object[]}}}
 */
export function sessionCatalysts(day, asOf, { max = CATALYSTS_MAX } = {}) {
  const none = { items: [], said: NOTHING };
  if (!asOf || day?.sessions?.us !== asOf || !Array.isArray(day.facts)) return none;
  const byId = new Map(day.facts.map((fact) => [fact?.id, fact]));
  // The moves of this session each headline is linked to (any basis the ledger draws from a cause to a move).
  const linked = new Map();
  for (const link of Array.isArray(day.links) ? day.links : []) {
    const move = byId.get(link?.to);
    if (!move || !MOVE_KINDS.has(move.kind) || move.date !== asOf) continue;
    linked.set(link.from, [...(linked.get(link.from) || []), move.id]);
  }
  const items = day.facts
    .filter((fact) => fact?.kind === 'headline' && fact.date === asOf && CATALYST_RANKS.includes(fact.rank) && linked.has(fact.id)
      && fact.titleKo && !fact.titleKoFailed)
    .sort((a, b) => Number(b.materiality || 0) - Number(a.materiality || 0))
    .slice(0, max)
    .map((fact) => ({ id: fact.id, date: fact.date, title: String(fact.titleKo).trim(), materiality: fact.materiality, moves: linked.get(fact.id) }));
  if (!items.length) return none;
  return { items, said: sayJoin(items.map((item) => say(W.item, { d: shortDate(item.date), title: item.title })), ' · ') };
}
