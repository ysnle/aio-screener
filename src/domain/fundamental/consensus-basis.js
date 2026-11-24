// The consensus row's share basis. SNDK split 8-for-1 (trading adjusted from 2026-11-20). The screener's close is split-adjusted
// ($87.71 on its factor session) while the consensus provider still published pre-split EPS (next four quarters 245.29,
// last four 116.79), so the reader's Forward PER came out 0.4x. The split is already in data we fetch: the screener row
// carries the chart's split event (valuationSplitRatio, valuationSplitDate; src/domain/fundamental/sec-row-fields.js).
// The consensus producer (scripts/fetch-consensus-estimates.mjs) puts the EPS on the close's basis here, and flags a row
// whose EPS sum still reaches the price before it is published. The reader keeps its own guard (consensus-read.js).
import { readNumber as finite } from '../shared/number.js';
import { PE_PLAUSIBLE_MIN } from './consensus-read.js';
import { isoDay } from '../shared/session-date.js';

export const SPLIT_SIZED = 1.5;
const round = (value) => Math.round(value * 1000) / 1000;
const scaleHist = (hist, ratio) => String(hist || '').split(';').filter(Boolean).map((part) => {
  const [month, actual, estimate] = part.split(':');
  const scale = (text) => (finite(text) == null ? text : String(round(finite(text) / ratio)));
  return [month, scale(actual), scale(estimate)].join(':');
}).join(';');

/** The listing's close for the basis check: the screener row's valuation price (split-adjusted close). */
const closeOf = (listing) => finite(listing?.valuationPrice) ?? finite(listing?.pePrice);

/**
 * The share basis of one consensus row against the listing's split event. `listing` is the expanded screener row
 * ({ valuationSplitRatio, valuationSplitDate, valuationPrice, pe }). Returns { row, basis } where basis is
 * 'no-split' | 'already-adjusted' | 'adjusted' | 'as-published'. A split after the last reported quarter ends is the only
 * case the provider can still be on the old basis; which basis it published is read from the numbers: the trailing
 * multiple of each candidate against the SEC trailing P/E (pe) when the row has one, otherwise the plausibility floor.
 */
export function alignConsensusSplit(row, listing) {
  if (!row || row.unavailable || !row.fwd || !row.trailing) return { row, basis: 'no-split' };
  if (row.shareBasis?.splitRatio) return { row, basis: 'already-adjusted' };
  const ratio = finite(listing?.valuationSplitRatio);
  const date = String(listing?.valuationSplitDate || '').slice(0, 10);
  const price = closeOf(listing);
  const trailing = finite(row.trailing.eps);
  // A stock dividend (SCCO 1.01) moves EPS less than the provider's own rounding: only a split-sized factor is a basis.
  if (!(ratio >= SPLIT_SIZED || (ratio > 0 && ratio <= 1 / SPLIT_SIZED)) || !isoDay(date) || !(price > 0) || !(trailing > 0)) return { row, basis: 'no-split' };
  if (row.trailing.to && date.slice(0, 7) <= row.trailing.to) return { row, basis: 'no-split' };
  const rawPe = price / trailing;
  const adjustedPe = price * ratio / trailing;
  const secPe = finite(listing?.pe);
  const adjust = secPe > 0
    ? Math.abs(Math.log(adjustedPe / secPe)) < Math.abs(Math.log(rawPe / secPe))
    : rawPe < PE_PLAUSIBLE_MIN && adjustedPe >= PE_PLAUSIBLE_MIN;
  if (!adjust) return { row, basis: 'as-published' };
  const scale = (value) => (finite(value) == null ? value : round(finite(value) / ratio));
  return {
    basis: 'adjusted',
    row: {
      ...row,
      fwd: { ...row.fwd, eps: scale(row.fwd.eps), hi: scale(row.fwd.hi), lo: scale(row.fwd.lo) },
      trailing: { ...row.trailing, eps: scale(row.trailing.eps) },
      ...(row.hist ? { hist: scaleHist(row.hist, ratio) } : {}),
      shareBasis: { splitRatio: ratio, splitDate: date, adjustedBy: 'aio', publishedFwdEps: finite(row.fwd.eps), publishedTrailingEps: trailing }
    }
  };
}

/** A row whose EPS sum reaches the close (PER under PE_PLAUSIBLE_MIN): price and EPS are not on one share basis. */
export function consensusBasisMismatch(row, listing) {
  const price = closeOf(listing);
  if (!row || row.unavailable || !row.fwd || !row.trailing || !(price > 0)) return null;
  const eps = Math.max(finite(row.fwd.eps) ?? -Infinity, finite(row.trailing.eps) ?? -Infinity);
  return eps * PE_PLAUSIBLE_MIN >= price ? { price, eps, splitRatio: finite(listing?.valuationSplitRatio) || null } : null;
}
