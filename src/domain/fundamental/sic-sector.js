// v57.83 (owner 2026-10-16, "유니버스 밖 종목은 섹터·테마가 비어 있다"): a US listing outside the published universe has
// no curated sector, but its SEC submissions record carries the issuer's official Standard Industrial Classification
// (SIC) code. This is a fixed, documented translation of that code into the universe's eleven sector keys — not an
// estimate from prices or names. Codes that do not map cleanly (public administration, non-classifiable 9xxx, blank
// checks 6770) stay null, and every consumer names the SIC code and its SEC description beside the sector.
export const SIC_SECTOR_MODEL = 'sic-to-universe-sector.v1';

// [from, to, sector] — first match wins, so narrow ranges sit before the broad division they belong to.
const RANGES = Object.freeze([
  [100, 999, 'Consumer Defensive'], // agriculture, forestry, fishing
  [1000, 1099, 'Materials'], [1200, 1399, 'Energy'], [1400, 1499, 'Materials'], // mining: metals · coal/oil & gas · minerals
  [1500, 1799, 'Industrials'], // construction
  [2000, 2199, 'Consumer Defensive'], // food, beverages, tobacco
  [2200, 2399, 'Consumer'], [2400, 2499, 'Materials'], [2500, 2599, 'Consumer'], [2600, 2699, 'Materials'],
  [2700, 2799, 'Communication Services'], // printing and publishing
  [2833, 2836, 'Healthcare'], [2840, 2844, 'Consumer Defensive'], [2800, 2899, 'Materials'], // pharma · household · chemicals
  [2900, 2999, 'Energy'], // petroleum refining
  [3000, 3099, 'Materials'], [3100, 3199, 'Consumer'], [3200, 3399, 'Materials'], [3400, 3499, 'Industrials'],
  [3570, 3579, 'Technology'], [3500, 3599, 'Industrials'], // computers · industrial machinery
  [3630, 3639, 'Consumer'], [3651, 3652, 'Consumer'], [3660, 3679, 'Technology'], [3600, 3699, 'Industrials'], // appliances · audio · comms/semis · electrical
  [3710, 3716, 'Consumer'], [3750, 3751, 'Consumer'], [3700, 3799, 'Industrials'], // vehicles · motorcycles · aerospace/rail/ships
  [3820, 3829, 'Technology'], [3840, 3851, 'Healthcare'], [3860, 3869, 'Technology'], [3870, 3873, 'Consumer'], [3800, 3899, 'Industrials'],
  [3900, 3999, 'Consumer'], // misc manufacturing (toys, jewelry, sporting goods)
  [4000, 4799, 'Industrials'], // transportation
  [4800, 4899, 'Communication Services'],
  [4950, 4959, 'Industrials'], [4900, 4999, 'Utilities'], // waste management · utilities
  [5120, 5129, 'Healthcare'], [5140, 5149, 'Consumer Defensive'], [5000, 5199, 'Industrials'], // wholesale
  [5400, 5499, 'Consumer Defensive'], [5912, 5912, 'Consumer Defensive'], [5200, 5999, 'Consumer'], // retail
  [6770, 6770, null], [6798, 6798, 'Real Estate'], [6500, 6553, 'Real Estate'], [6000, 6799, 'Financials'],
  [7370, 7379, 'Technology'], [7310, 7319, 'Communication Services'], [7300, 7399, 'Industrials'], // software · advertising · business services
  [7800, 7899, 'Communication Services'], [7000, 7999, 'Consumer'], // motion pictures · hotels/personal/amusement
  [8000, 8099, 'Healthcare'], [8200, 8299, 'Consumer'], [8100, 8999, 'Industrials'] // health · education · professional services
]);

/** Universe sector key for an SEC SIC code, or null when the code is missing or does not map cleanly. */
export function sectorFromSic(sic) {
  const code = Number(String(sic ?? '').trim());
  if (!Number.isInteger(code) || code <= 0) return null;
  for (const [from, to, sector] of RANGES) if (code >= from && code <= to) return sector;
  return null;
}

/** { sic, description, sector } from an SEC submissions record, or null when it carries no SIC code. */
export function secClassification(submissions) {
  const sic = String(submissions?.sic ?? '').trim();
  if (!/^\d{3,4}$/.test(sic)) return null;
  const description = String(submissions?.sicDescription || '').trim() || null;
  return Object.freeze({ sic, description, sector: sectorFromSic(sic), model: SIC_SECTOR_MODEL, source: 'SEC EDGAR submissions' });
}
