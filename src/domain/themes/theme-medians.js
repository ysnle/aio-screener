// v59.70 (data audit R9, D4): the one median every theme reader uses — US sub-themes (group-strength), Korean themes
// (kr-themes), the theme criteria, the playbook's pooled theme rows and the AI-chain groups each had their own copy
// (finite-only in some, `!= null` in others, a minimum count in one, rounding in another).
import { finiteNumber } from '../shared/number.js';

/** Median of the finite values; null below `minCount` (default 1) values. */
export function median(values, { minCount = 1 } = {}) {
  const list = (Array.isArray(values) ? values : []).map(finiteNumber).filter((value) => value != null).sort((a, b) => a - b);
  if (!list.length || list.length < minCount) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

/**
 * The members' median of each field, read through `read(row, field)` (the screener row reader by default).
 * @returns {Record<string, number|null>}
 */
export function themeMedians(members, fields, { read = (row, field) => row?.[field], minCount = 1 } = {}) {
  const rows = Array.isArray(members) ? members : [];
  return Object.fromEntries(fields.map((field) => [field, median(rows.map((row) => read(row, field)), { minCount })]));
}
