import { readNumber } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';
import { FUNDAMENTAL_BASIS, TRAILING_ROW_FIELDS } from '../fundamental/trailing-year.js';
import { DIVIDEND_BASIS, DIVIDEND_FACT_FIELDS, DIVIDEND_YIELD_MAX_PCT } from './price-factors.js';

const day = (value) => String(value || '').slice(0, 10);

/** Problems with one row's basis and dividend fields (empty when the row keeps the contract). */
export function rowFactContractErrors(row = {}) {
  const errors = [];
  for (const field of TRAILING_ROW_FIELDS) {
    const basis = row[`${field}Basis`];
    const through = row[`${field}Through`];
    const value = readNumber(row[field]);
    if (basis == null && through == null) continue;
    if (value == null) { errors.push(`${field}Basis/${field}Through without ${field}`); continue; }
    if (!Object.values(FUNDAMENTAL_BASIS).includes(basis)) errors.push(`${field}Basis must be ttm or fy (${basis})`);
    if (!isIsoDay(day(through))) errors.push(`${field}Through must be a date (${through})`);
    // Four quarters that end before the fiscal year they replace are not the latest figure.
    if (basis === FUNDAMENTAL_BASIS.ttm && isIsoDay(day(row.fundamentalPeriodEnd)) && day(through) < day(row.fundamentalPeriodEnd)) errors.push(`${field} TTM ends ${day(through)} before the fiscal year ${day(row.fundamentalPeriodEnd)}`);
    if (field === 'margin' && value > 100) errors.push(`margin ${value}% above 100% is withheld`);
  }
  if (DIVIDEND_FACT_FIELDS.some((field) => row[field] != null)) {
    const ttm = readNumber(row.dividendTtm);
    const yieldPct = readNumber(row.dividendYieldPct);
    const count = readNumber(row.dividendCount12m);
    if (row.dividendBasis !== DIVIDEND_BASIS) errors.push(`dividendBasis must be ${DIVIDEND_BASIS}`);
    if (ttm == null || ttm < 0) errors.push('dividendTtm must be a non-negative number');
    if (yieldPct == null || yieldPct < 0 || yieldPct > DIVIDEND_YIELD_MAX_PCT) errors.push(`dividendYieldPct must be 0-${DIVIDEND_YIELD_MAX_PCT}% (${row.dividendYieldPct})`);
    if (count == null || !Number.isInteger(count) || count < 0) errors.push('dividendCount12m must be a whole number');
    if (ttm != null && yieldPct != null && count != null) {
      // Zero dividends, zero yield and no ex-date go together; a paid dividend has a positive amount and an ex-date (its
      // yield can round to 0.00% on a high price, never the reverse).
      if ((count === 0) !== (ttm === 0) || (ttm === 0 && yieldPct !== 0)) errors.push(`dividend count ${count}, amount ${ttm} and yield ${yieldPct}% disagree`);
      if (count > 0 && !isIsoDay(day(row.dividendLastExDate))) errors.push('dividendLastExDate missing for a paid dividend');
      if (count === 0 && row.dividendLastExDate != null) errors.push('dividendLastExDate on a row with no dividend');
    }
  }
  return errors;
}
