// The evidence beside price for the 11 sectors, one row each: the ~50-session rotation quadrant, the sector ETF's 1-month
// return against SPY, the share of S&P 500 members above their 20/50/200-day lines, the members near the 52-week high
// and near the low, and the 4-week net estimate revisions. Facts, fixed state words and the price × estimates cell only —
// no rotation verdict: the quadrants alone do not establish a risk-on/off rotation (page-flow.js rotationFlow).
// Population and denominators: near-high.js (S&P 500 members on the US factor session, ten measured or the cell is empty).
import { NEAR_HIGH_MIN_MEASURED, SECTOR_ETF_GICS, gicsKeyOf, memberShare, sectorMembers, sectorNearHigh } from './near-high.js';
import { relativeBand } from './recent-check.js';
import { revisionTiltOf } from '../market/indices/index-earnings.js';
import { readRowNumber } from '../../data/contracts/screener.js';

export const SECTOR_EVIDENCE_MODEL = 'sector-evidence.v1';
/** The moving-average windows read together: a line read alone hides which one gave way first. */
export const SECTOR_SMA_FIELDS = Object.freeze([['pctSma20', '20일선'], ['pctSma50', '50일선'], ['pctSma200', '200일선']]);
// Price side: the sector ETF's 1-month return less SPY's on the same close, beyond the shared ±1-month relative band
// (recent-check.js relativeBand, ≈4.3%p) — inside it the sector moved with the index.
export const PRICE_SIDE_WORDS = Object.freeze({ ahead: '지수보다 강함', inline: '지수와 비슷', behind: '지수보다 약함' });
// Estimates side: index-earnings.js revisionTiltOf over the sector's 4-week up/down counts (±10% of all revisions).
// 'even' sits with 'down' on the not-raised side: a price lead while estimates stall is the cell the method names.
export const PRICE_ESTIMATE_WORDS = Object.freeze({ both: '가격·추정 함께 강함', price: '가격만 강함', estimates: '추정만 강함', neither: '가격·추정 함께 약함' });

/** 'ahead' · 'inline' · 'behind' for a 1-month gap to the index in %p, or null without one. */
export function priceSideOf(gap) {
  if (gap == null || !Number.isFinite(gap)) return null;
  const band = relativeBand('ret1m');
  return gap > band ? 'ahead' : gap < -band ? 'behind' : 'inline';
}

/** The price × estimates cell, or null when either side is unknown or the price moved with the index. */
export function priceEstimateCell(priceSide, tilt) {
  if (!tilt || (priceSide !== 'ahead' && priceSide !== 'behind')) return null;
  const raised = tilt === 'up';
  return priceSide === 'ahead' ? (raised ? 'both' : 'price') : (raised ? 'estimates' : 'neither');
}

/**
 * @param {{ weights: object, rows: object[], session: string|null, quadrants?: Record<string,string>, revisions?: Array<{sector:string,up:number,down:number,revision:number}>|null }} input
 * quadrants: sector ETF → settled quadrant key ('Leading' … 'Border'), read on the rotation artifact's own session.
 * revisions: index-earnings.js sector rows (sectors below its member floor are absent — an empty cell, never 하향).
 */
export function buildSectorEvidence({ weights = null, rows = [], session = null, quadrants = {}, revisions = null } = {}) {
  const groups = sectorMembers({ weights, rows, session });
  const extremes = sectorNearHigh({ weights, rows, session });
  const etf = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym && (!session || row.factorSessionDate === session)).map((row) => [String(row.sym).toUpperCase(), row]));
  const ret1m = (sym) => (etf.has(sym) ? readRowNumber(etf.get(sym), 'ret1m', 'calculation') : null);
  const spy = ret1m('SPY');
  const revisionBySector = new Map((Array.isArray(revisions) ? revisions : []).filter((row) => Number.isFinite(row?.revision)).map((row) => [gicsKeyOf(row.sector), row]));
  const sectors = Object.entries(SECTOR_ETF_GICS).map(([symbol, gics]) => {
    const group = groups[gics];
    if (!group) return null;
    const own = ret1m(symbol);
    const rel1m = own != null && spy != null ? own - spy : null;
    const revision = revisionBySector.get(gics) || null;
    const tilt = revision ? revisionTiltOf(revision.revision) : null;
    const priceSide = priceSideOf(rel1m);
    return {
      symbol, sector: gics, label: group.label, listed: group.rows.length,
      quadrant: quadrants?.[symbol] || null,
      rel1m, priceSide,
      sma: Object.fromEntries(SECTOR_SMA_FIELDS.map(([field]) => [field, memberShare(group.rows, field, (value) => value > 0)])),
      extremes: extremes.bySector[gics],
      revision: revision ? { up: revision.up, down: revision.down, net: revision.revision, tilt } : null,
      cell: priceEstimateCell(priceSide, tilt)
    };
  }).filter(Boolean);
  return { model: SECTOR_EVIDENCE_MODEL, session, minMeasured: NEAR_HIGH_MIN_MEASURED, spyRet1m: spy, total: extremes.total, sectors };
}
