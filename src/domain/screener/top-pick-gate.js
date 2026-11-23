// The factor percentile ranks a stock on 12-1 momentum, which
// skips the latest month by design, so a stock in a broken trend can sit at the top (MU 2026-11-20: percentile 100 the
// day it closed 23% under its 200-day line after a 23.6% five-session fall). The rank stays as computed and the row stays
// in the list under the reader's own sort and filter; this gate only decides two things:
//   - a top-pick surface (the 종목 landing's 백분위 상위 list) does not offer a row whose close is under its 200-day line,
//     or that broke down over five sessions (technical/bands.js recentDrop), or whose inputs for those two are missing;
//   - the list row shows how many model contrary checks it trips (technical/bands.js modelContraryEvidence — the same
//     checks the inspector lists, a P/E on a peak margin among them) beside the percentile. A contrary check alone
//     never holds a row; only the two trend conditions do.
import { modelContraryEvidence, recentDrop } from '../technical/bands.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { readNumber } from '../shared/number.js';
import { screenerMarket } from './market-scope.js';

const symbolOf = (row) => String(row?.sym || row?.symbol || '').trim().toUpperCase();

/** { held, reasons: ('below-200' | 'five-session-break' | 'unchecked')[], contraryCount, hits } for one screener row. */
export function topPickGate(row) {
  const contrary = modelContraryEvidence(row);
  const sma200 = readRowNumber(row, 'pctSma200', 'calculation');
  const drop = recentDrop(row);
  const reasons = [];
  if (sma200 != null && sma200 < 0) reasons.push('below-200');
  if (drop?.broken) reasons.push('five-session-break');
  if (sma200 == null || drop == null) reasons.push('unchecked');
  return Object.freeze({ held: reasons.length > 0, reasons: Object.freeze(reasons), contraryCount: contrary.hits.length, hits: contrary.hits });
}

/** The top `limit` passed rows of `market` by percentile that clear the trend gate, as symbols. */
export function topRankedPicks(rows, { market = 'US', limit = 5 } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.screenStatus === 'passed' && readNumber(row.rank) != null && screenerMarket(row) === market && !topPickGate(row).held)
    .sort((a, b) => readNumber(b.rank) - readNumber(a.rank) || (readNumber(a.overallRank) ?? Infinity) - (readNumber(b.overallRank) ?? Infinity))
    .slice(0, limit)
    .map(symbolOf)
    .filter(Boolean);
}
