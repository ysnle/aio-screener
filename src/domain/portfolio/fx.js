/**
 * Declared FX legs (E3, 11 §23).
 *
 * A total in a mixed-currency portfolio is a conversion claim, and a conversion
 * needs an observed rate with a source and a time. This module owns the pure part
 * of that declaration — normalizing legs, keeping one rate per direction, and
 * converting a value to the declared base currency **or refusing to**. A refusal
 * is the honest outcome: `null` means "no conversion basis", never "assume 1".
 */

// A rate older than the window the repo already uses for a delayed quote is not a
// valuation basis for today's total. The threshold travels with the result so a
// consumer can see which rule produced the conversion.
export const FX_LEG_MAX_AGE_MS = 72 * 60 * 60 * 1000;

function cleanCode(value) {
  const text = String(value == null ? '' : value).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(text) ? text : null;
}

function cleanRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function cleanObservedAt(value) {
  if (value == null || String(value).trim() === '') return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function normalizeFxLegs(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((leg) => ({
      from: cleanCode(leg && leg.from),
      to: cleanCode(leg && leg.to),
      rate: cleanRate(leg && leg.rate),
      observedAt: cleanObservedAt(leg && leg.observedAt),
      source: String((leg && leg.source) || 'declared-user').slice(0, 64)
    }))
    .filter((leg) => leg.from && leg.to && leg.from !== leg.to && leg.rate != null && leg.observedAt != null);
}

export function appendFxLeg(legs, input = {}) {
  const base = normalizeFxLegs(legs);
  const leg = normalizeFxLegs([input])[0];
  if (!leg) return { ok: false, reason: 'invalid-fx-leg', legs: base };
  // One rate per direction: a second declaration for the same pair replaces the first
  // instead of leaving two competing rates for one conversion.
  const next = base.filter((entry) => !(entry.from === leg.from && entry.to === leg.to)).concat([leg]);
  next.sort((left, right) => (`${left.from}${left.to}` < `${right.from}${right.to}` ? -1 : 1));
  return { ok: true, legs: next };
}

export function removeFxLeg(legs, index) {
  const base = normalizeFxLegs(legs);
  const position = Number(index);
  if (!Number.isInteger(position) || position < 0 || position >= base.length) return { ok: false, reason: 'invalid-fx-index', legs: base };
  const next = base.slice();
  next.splice(position, 1);
  return { ok: true, legs: next };
}

/**
 * A leg is usable only when it was observed at or before the conversion instant and
 * is not older than the declared age budget. Refusals carry their reason and pair so the
 * caller can publish why a total stayed unconverted.
 */
export function resolveFxRate(legs, { from, to, asOfMs = Date.now(), maxAgeMs = FX_LEG_MAX_AGE_MS } = {}) {
  const source = cleanCode(from);
  const target = cleanCode(to);
  if (!source || !target) return { ok: false, reason: 'currency-undeclared' };
  if (source === target) return { ok: true, rate: 1, leg: null, inverted: false };
  const list = normalizeFxLegs(legs);
  const direct = list.find((leg) => leg.from === source && leg.to === target);
  const inverse = direct ? null : list.find((leg) => leg.from === target && leg.to === source);
  const chosen = direct || inverse;
  if (!chosen) return { ok: false, reason: 'rate-not-declared', pair: `${source}/${target}` };
  const observedMs = Date.parse(chosen.observedAt);
  if (!(observedMs <= asOfMs)) return { ok: false, reason: 'rate-observed-after-cut', pair: `${chosen.from}/${chosen.to}` };
  if (!(asOfMs - observedMs <= maxAgeMs)) return { ok: false, reason: 'rate-stale', pair: `${chosen.from}/${chosen.to}`, ageMs: asOfMs - observedMs };
  return {
    ok: true,
    rate: direct ? chosen.rate : 1 / chosen.rate,
    inverted: !!inverse,
    leg: { from: chosen.from, to: chosen.to, rate: chosen.rate, observedAt: chosen.observedAt, source: chosen.source }
  };
}

/**
 * Convert with declared legs, or refuse. No triangulation: a rate chain assembled
 * from two declared pairs is a different claim than the one the user made, so this
 * only uses a declared pair or its inverse.
 */
export function convertWithDeclaredRates({ value, from, to, legs, asOfMs, maxAgeMs } = {}) {
  // P1176 class: Number(null) === 0, so an absent amount must be refused **before**
  // coercion — otherwise "no value" converts into a real 0 amount and the total
  // silently changes.
  if (value === null || value === undefined || value === '') return { ok: false, reason: 'value-missing' };
  const amount = Number(value);
  if (!Number.isFinite(amount)) return { ok: false, reason: 'value-missing' };
  const resolved = resolveFxRate(legs, { from, to, asOfMs, maxAgeMs });
  if (!resolved.ok) return resolved;
  return { ok: true, value: amount * resolved.rate, rate: resolved.rate, leg: resolved.leg, inverted: resolved.inverted };
}

// The declaration's own state, so a surface can show which leg is stale instead of
// only reporting that the total was held.
export function fxLegsState(legs, { asOfMs = Date.now(), maxAgeMs = FX_LEG_MAX_AGE_MS } = {}) {
  const list = normalizeFxLegs(legs);
  return {
    maxAgeMs,
    legs: list.map((leg) => {
      const ageMs = asOfMs - Date.parse(leg.observedAt);
      return { ...leg, ageMs, usable: Date.parse(leg.observedAt) <= asOfMs && ageMs <= maxAgeMs };
    })
  };
}
