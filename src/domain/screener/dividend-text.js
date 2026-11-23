import { finiteNumber as finite } from '../shared/number.js';

/** '배당수익률 2.1%(최근 12개월)', '배당 없음(최근 12개월)', or null when the row carries no dividend facts. */
export function dividendYieldText(row = {}) {
  const yieldPct = finite(row?.dividendYieldPct);
  if (yieldPct == null || row?.dividendBasis == null) return null;
  if (yieldPct === 0 && !(finite(row.dividendTtm) > 0)) return '배당 없음(최근 12개월)';
  return `배당수익률 ${yieldPct.toFixed(yieldPct < 1 ? 2 : 1)}%(최근 12개월)`;
}
