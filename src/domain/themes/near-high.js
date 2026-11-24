// v59.70 (X bookmarks 11/4 packet §4 #2): how many of each sector's S&P 500 members close within 5% of their 52-week
// closing high — a breadth reading per sector, beside the sector ETF's own return. The population is the index
// membership (screener metadata.indexWeights, GICS sectors); the value is the screener row's pctFromCloseHigh52w on the
// US factor session the bars print. A member without that session's value is not measured, never counted as far.
import { readRowNumber } from '../../data/contracts/screener.js';
import { GICS_KO } from '../market/indices/sector-map.js';

export const NEAR_HIGH_PCT = 5;
// One or two members must not set a sector's share (Real Estate and Materials have ~20–30 members).
export const NEAR_HIGH_MIN_MEASURED = 10;

/** The 11 sector ETFs on the 테마 bars → the GICS sector names in indexWeights. */
export const SECTOR_ETF_GICS = Object.freeze({
  XLK: 'Information Technology', XLC: 'Communication', XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLV: 'Health Care',
  XLF: 'Financials', XLE: 'Energy', XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate'
});
const sameSector = (a, b) => a === b || (a === 'Communication Services' && b === 'Communication') || (b === 'Communication Services' && a === 'Communication');

/**
 * { bySector: { [gics]: { sector, label, listed, measured, near, share } }, total } — share is the percent of measured
 * members within NEAR_HIGH_PCT of the 52-week closing high, null below NEAR_HIGH_MIN_MEASURED.
 */
export function sectorNearHigh({ weights = null, rows = [], session = null } = {}) {
  const members = (Array.isArray(weights?.rows) ? weights.rows : [])
    .map((row) => (Array.isArray(row) ? { sym: row[0], sector: row[1] } : row))
    .filter((row) => row?.sym && row.sector);
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const bySector = {};
  const total = { listed: 0, measured: 0, near: 0, share: null };
  for (const member of members) {
    const key = Object.values(SECTOR_ETF_GICS).find((name) => sameSector(name, member.sector)) || member.sector;
    const bucket = bySector[key] ||= { sector: key, label: GICS_KO[key] || key, listed: 0, measured: 0, near: 0, share: null };
    const row = bySym.get(String(member.sym).toUpperCase());
    const value = row && (!session || row.factorSessionDate === session) ? readRowNumber(row, 'pctFromCloseHigh52w', 'calculation') : null;
    for (const target of [bucket, total]) {
      target.listed += 1;
      if (value == null) continue;
      target.measured += 1;
      if (value >= -NEAR_HIGH_PCT) target.near += 1;
    }
  }
  for (const target of [...Object.values(bySector), total]) {
    target.share = target.measured >= NEAR_HIGH_MIN_MEASURED ? Math.round(target.near / target.measured * 100) : null;
  }
  return { bySector, total };
}
