// One definition of "operating cash flow less PP&E capex is not this company's free cash flow", shared by the fiscal
// read, the peer comparison, the reverse DCF and the screener's cash conditions.
import { sectorFromSic } from './sic-sector.js';

// Financials-sector names that take no deposits and make no loans (payment networks, exchanges, rating and data houses,
// asset managers): their cash flow is read like any other company's.
const NON_LENDING_FINANCIALS = new Set(['V', 'MA', 'PYPL', 'FI', 'FIS', 'GPN', 'CPAY', 'JKHY', 'CME', 'ICE', 'NDAQ', 'CBOE', 'SPGI', 'MCO', 'MSCI', 'FDS', 'BLK', 'BX', 'KKR', 'APO', 'ARES', 'TROW', 'BEN', 'IVZ', 'AMP', 'BR']);
const sicCode = (sic) => { const code = Number.parseInt(String(sic ?? '').trim(), 10); return Number.isInteger(code) && code > 0 ? code : null; };

/**
 * 'lending' | 'insurer' | 'reit' | null. The issuer's SEC SIC code decides when it is known: depository and credit
 * institutions (6020–6179) lend, insurance carriers (6300–6399) are insurers, real estate investment trusts (6798)
 * buy buildings through investing cash flow rather than capex, insurance agents and brokers (6411: AON, MRSH, AJG) are
 * service businesses. Every other code, and a missing code, follows the sector (the SIC's own sector when none is
 * passed) with the curated list above.
 */
export function financialKind(symbol, sector, sic = null) {
  const code = sicCode(sic);
  if (code != null && code >= 6020 && code <= 6179) return 'lending';
  if (code != null && code >= 6300 && code <= 6399) return 'insurer';
  if (code === 6798) return 'reit';
  if (code === 6411) return null;
  return /financ|bank/i.test(String(sector || sectorFromSic(code) || '')) && !NON_LENDING_FINANCIALS.has(String(symbol || '').toUpperCase()) ? 'lending' : null;
}
export const isLendingFinancial = (symbol, sector, sic = null) => financialKind(symbol, sector, sic) === 'lending';
