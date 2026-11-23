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
