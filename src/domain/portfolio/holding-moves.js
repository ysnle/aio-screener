// A held stock's move on the ledger's latest session (public-data/market-day.json stock-move facts). The ledger keeps
// only the moves that stood out against the stock's own volatility, so a holding without one moved as usual and gets
// no "why" line. Pure: holdings arrive as listing symbols and nothing about them leaves this function.
import { marketOfSymbol } from '../market/session/session-time.js';

/**
 * @param {object|null} day market-day.v1
 * @param {string[]} symbols listing symbols (105560.KS, NVDA)
 * @returns {Map<string, {symbol:string, date:string, change:number, label:string}>} symbol → its move on the basis session
 */
export function holdingMoveFacts(day, symbols) {
  const moves = new Map();
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  if (!facts.length || !Array.isArray(symbols) || !symbols.length) return moves;
  const wanted = new Set(symbols.map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean));
  for (const fact of facts) {
    if (fact?.kind !== 'stock-move' || !Number.isFinite(fact.change)) continue;
    const symbol = String(fact.subjects?.[0] || '').toUpperCase();
    if (!wanted.has(symbol) || moves.has(symbol)) continue;
    // The basis session is the ledger's own for the listing's market; an older fact is another session's move.
    const session = day.sessions?.[marketOfSymbol(symbol) === 'KR' ? 'kr' : 'us'];
    if (!session || fact.date !== session) continue;
    moves.set(symbol, { symbol, date: fact.date, change: fact.change, label: String(fact.label || '') });
  }
  return moves;
}
