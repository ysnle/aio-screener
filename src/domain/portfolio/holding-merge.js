// One row per ticker is the portfolio model. A second buy of a held ticker (the add form's 합치기) and an import
// file that lists a ticker twice are merged by one rule: quantities add, the purchase price is the quantity-weighted
// average, target weights add. A weighted average is only a number when both prices are in one currency and both are
// known; otherwise the add form refuses to merge (it can still replace) and an import keeps the summed quantity with the
// price left unknown, and says so. Pure functions on the stored position shape ({ ticker, qty, cost, costCurrency, ... }).
import { readNumber } from '../shared/number.js';
import { listingCurrency } from './fx.js';

const upper = (value) => String(value == null ? '' : value).trim().toUpperCase() || null;
const optional = (value) => readNumber(value);
// A price average carries float noise (199.99999999999997); six decimals are below any quoted tick.
const tidy = (value) => Math.round(value * 1e6) / 1e6;

/** Why two lots of one ticker cannot be averaged, or null when they can. */
export function holdingMergeBlocker(existing, incoming) {
  const a = upper(existing?.costCurrency);
  const b = upper(incoming?.costCurrency);
  // No currency entered is the listing's own currency (the holdings table reads it that way).
  const listed = listingCurrency(upper(existing?.ticker || incoming?.ticker));
  if ((a || listed) !== (b || listed)) return { reason: 'cost-currency-differs', existingCurrency: a, incomingCurrency: b };
  if (optional(existing?.cost) == null || optional(incoming?.cost) == null) return { reason: 'cost-unknown' };
  const qa = optional(existing?.qty), qb = optional(incoming?.qty);
  if (!(qa > 0) || !(qb > 0)) return { reason: 'quantity-unknown' };
  return null;
}

/**
 * The add form's 합치기: `incoming` is what the form holds now. Quantity and price merge; the form's own optional fields
 * (target price, memo) replace the stored ones only when the form filled them; everything else stays as stored.
 */
export function mergeHoldingPair(existing, incoming, { now = Date.now() } = {}) {
  const blocker = holdingMergeBlocker(existing, incoming);
  if (blocker) return { ok: false, ...blocker };
  const qa = optional(existing.qty), qb = optional(incoming.qty);
  const qty = qa + qb;
  const cost = tidy((qa * optional(existing.cost) + qb * optional(incoming.cost)) / qty);
  const targetWeight = sumWeights([existing.targetWeight, incoming.targetWeight]);
  const position = { ...existing, qty, cost, updatedAt: now };
  if (optional(incoming.target) != null) position.target = incoming.target;
  if (String(incoming.memo || '').trim()) position.memo = String(incoming.memo).trim();
  if (targetWeight == null) delete position.targetWeight; else position.targetWeight = targetWeight;
  return { ok: true, position };
}

// A blank target weight is "not set"; an explicit 0 is a weight (src/domain/portfolio/risk.js keeps the same split).
function sumWeights(values) {
  const set = values.map(optional).filter((value) => value != null);
  return set.length ? tidy(set.reduce((sum, value) => sum + value, 0)) : null;
}

/**
 * An import's positions with each ticker once. Returns the merged list (first-seen order) and one note per merged
 * ticker: how many rows it had and whether the price could be averaged.
 */
export function mergeDuplicatePositions(positions) {
  const order = [];
  const groups = new Map();
  for (const position of Array.isArray(positions) ? positions : []) {
    const ticker = upper(position?.ticker);
    if (!ticker) continue;
    if (!groups.has(ticker)) { groups.set(ticker, []); order.push(ticker); }
    groups.get(ticker).push(position);
  }
  const merged = [];
  const notes = [];
  for (const ticker of order) {
    const rows = groups.get(ticker);
    if (rows.length === 1) { merged.push(rows[0]); continue; }
    let row = { ...rows[0] };
    let priced = true;
    for (const next of rows.slice(1)) {
      const result = priced ? mergeHoldingPair(row, next) : { ok: false };
      if (result.ok) { row = result.position; continue; }
      // The quantity still adds (the shares were bought); the price is unknown rather than a mixed-unit average.
      priced = false;
      row = { ...row, qty: (optional(row.qty) || 0) + (optional(next.qty) || 0) };
      delete row.cost;
      delete row.costCurrency;
      const weight = sumWeights([row.targetWeight, next.targetWeight]);
      if (weight == null) delete row.targetWeight; else row.targetWeight = weight;
    }
    // The earliest add date is the holding's.
    const added = rows.map((item) => item.addedAt).filter((value) => value != null).sort((a, b) => a - b)[0];
    if (added != null) row.addedAt = added;
    merged.push(row);
    notes.push({ ticker, rows: rows.length, priced });
  }
  return { positions: merged, notes };
}

