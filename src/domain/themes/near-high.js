// Per-sector member counts of the S&P 500 (screener metadata.indexWeights, GICS sectors) on one US factor session: the
// population every sector-breadth figure on 테마와 섹터 shares. A member without that session's value is not measured,
// never counted as far from the line or the extreme.
import { readRowNumber } from '../../data/contracts/screener.js';
import { GICS_KO } from '../content/sector-words.js';

export const NEAR_HIGH_PCT = 5;
// One or two members must not set a sector's share (Real Estate and Materials have ~20–30 members).
export const NEAR_HIGH_MIN_MEASURED = 10;

/** The 11 sector ETFs on the 테마 bars → the GICS sector names in indexWeights. */
export const SECTOR_ETF_GICS = Object.freeze({
  XLK: 'Information Technology', XLC: 'Communication', XLY: 'Consumer Discretionary', XLP: 'Consumer Staples', XLV: 'Health Care',
  XLF: 'Financials', XLE: 'Energy', XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate'
});
const sameSector = (a, b) => a === b || (a === 'Communication Services' && b === 'Communication') || (b === 'Communication Services' && a === 'Communication');
/** The indexWeights spelling of a GICS sector name ('Communication Services' → 'Communication'). */
export const gicsKeyOf = (sector) => Object.values(SECTOR_ETF_GICS).find((name) => sameSector(name, sector)) || sector;

/** { [gics]: { sector, label, rows } } — each listed member's screener row when it is on `session`, else null. */
export function sectorMembers({ weights = null, rows = [], session = null } = {}) {
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const out = {};
  for (const member of Array.isArray(weights?.rows) ? weights.rows : []) {
    const { sym, sector } = Array.isArray(member) ? { sym: member[0], sector: member[1] } : member || {};
    if (!sym || !sector) continue;
    const key = gicsKeyOf(sector);
    const row = bySym.get(String(sym).toUpperCase());
    (out[key] ||= { sector: key, label: GICS_KO[key] || key, rows: [] }).rows.push(row && (!session || row.factorSessionDate === session) ? row : null);
  }
  return out;
}

/** { measured, hit, share }: members with `field` on the session, how many pass `test`, the percent (null below the floor). */
export function memberShare(rows, field, test) {
  const values = rows.map((row) => (row ? readRowNumber(row, field, 'calculation') : null)).filter((value) => value != null);
  const hit = values.filter(test).length;
  return { measured: values.length, hit, share: values.length >= NEAR_HIGH_MIN_MEASURED ? Math.round(hit / values.length * 100) : null };
}

// Both ends of the 52-week range on one denominator (members with a 52-week closing high). Near the high = within
// NEAR_HIGH_PCT of the closing high; near the low = within NEAR_HIGH_PCT above the 52-week low (the producer's low is
// the intraday low). A member near both (a range narrower than 10%) counts only on the high side, so the sets never overlap.
function extremesOf(rows) {
  const high = (row) => readRowNumber(row, 'pctFromCloseHigh52w', 'calculation');
  const measured = rows.filter((row) => row && high(row) != null);
  const near = measured.filter((row) => high(row) >= -NEAR_HIGH_PCT).length;
  const low = measured.filter((row) => high(row) < -NEAR_HIGH_PCT && (readRowNumber(row, 'pctFrom52wLow', 'calculation') ?? Infinity) <= NEAR_HIGH_PCT).length;
  const enough = measured.length >= NEAR_HIGH_MIN_MEASURED;
  return { listed: rows.length, measured: measured.length, near, low, share: enough ? Math.round(near / measured.length * 100) : null, lowShare: enough ? Math.round(low / measured.length * 100) : null };
}

/** { bySector: { [gics]: { sector, label, listed, measured, near, low, share, lowShare } }, total } on one session. */
export function sectorNearHigh({ weights = null, rows = [], session = null } = {}) {
  const groups = sectorMembers({ weights, rows, session });
  const bySector = Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, { sector: group.sector, label: group.label, ...extremesOf(group.rows) }]));
  return { bySector, total: extremesOf(Object.values(groups).flatMap((group) => group.rows)) };
}
