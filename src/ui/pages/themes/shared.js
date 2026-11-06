// Theme screens: small helpers shared by the RRG, sector board and theme detail modules.
import { directionOf } from '../../../domain/shared/number.js';

// v58.80: a change that rounds to zero is drawn in the text colour, not rising red or falling blue.
export const dirColor = (value, digits = 1) => { const dir = directionOf(value, digits); return value == null ? 'var(--text-muted)' : dir === 'up' ? 'var(--dir-up)' : dir === 'down' ? 'var(--dir-down)' : 'var(--text-primary)'; };

export const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
// Published screener rows by symbol (the store's rows; ETFs included), for the period bars and the member tables.
export function screenerRowMap(store) {
  const rows = store?.getState?.()?.screener?.rows || [];
  return new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
}
