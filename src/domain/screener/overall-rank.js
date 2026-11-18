// The overall rank — each row's ordinal position by the unrounded composite (_compositeZ) inside its own ranking
// market. The 0–100 percentile (row.rank) is rounded, so about eight stocks shared each value and an ordinal taken from it
// read at or above the true place (AAPL 14 for 17th); the active screen's own order (screenRank) is a different list.
// Equal composites share a rank and the next distinct composite skips (1, 1, 3), as screen-engine does for scores.
// Only rows the factor model ranked (a finite percentile and composite) carry one, so the ranked count of a market is
// one number everywhere it is quoted: the page header, the inspector denominator and the reading.
import { screenerMarket } from './market-scope.js';
import { finiteNumber as finite } from '../shared/number.js';

const rankingMarketOf = (row) => row?.rankingMarket || screenerMarket(row);
const rankable = (row) => finite(row?._compositeZ) != null && finite(row?.rank) != null;

/** Returns new rows with `overallRank` (number or null); the input rows are not changed. */
export function withOverallRanks(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byMarket = new Map();
  list.forEach((row, index) => {
    if (!rankable(row)) return;
    const market = rankingMarketOf(row);
    if (!byMarket.has(market)) byMarket.set(market, []);
    byMarket.get(market).push({ index, z: row._compositeZ });
  });
  const ordinal = new Map();
  for (const entries of byMarket.values()) {
    entries.sort((a, b) => b.z - a.z || a.index - b.index);
    entries.forEach((entry, position) => {
      const previous = entries[position - 1];
      ordinal.set(entry.index, previous && previous.z === entry.z ? ordinal.get(previous.index) : position + 1);
    });
  }
  return list.map((row, index) => ({ ...row, overallRank: ordinal.get(index) ?? null }));
}

/** The number of rows of `market` that carry an overall rank — the one denominator the screener quotes. */
export function overallRankedCount(rows, market) {
  return (Array.isArray(rows) ? rows : []).filter((row) => finite(row?.overallRank) != null && (!market || screenerMarket(row) === market)).length;
}
