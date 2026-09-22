/**
 * P1174 (15 D06, 수익률 비교 계약): a return is only comparable when its basis is declared.
 *
 * The design requires priceReturn/totalReturn, currency basis, split/dividend adjustment, start and end
 * valuation times and FX direction with its source. The provider's field name `adjustedClose` is not
 * evidence of what was adjusted, so the scope is declared here instead of inferred from a name. The
 * arithmetic below is plain currency conversion for one asset with no cash flows; it carries no
 * transaction cost, tax or dividend-reinvestment policy.
 */
export const RETURN_CONTRACT_VERSION = 'return-contract.v1';

export const RETURN_KINDS = Object.freeze(['price', 'total']);
export const ADJUSTMENT_SCOPES = Object.freeze(['none', 'split', 'split+dividend']);
export const FX_DIRECTIONS = Object.freeze(['base-per-local', 'local-per-base']);

export function createReturnObservation(input = {}) {
  const errors = [];
  const kind = String(input.kind || '').trim();
  const adjustment = String(input.adjustment || '').trim();
  const currency = String(input.currency || '').trim().toUpperCase() || null;
  const startValuationAt = input.startValuationAt || null;
  const endValuationAt = input.endValuationAt || null;
  if (!RETURN_KINDS.includes(kind)) errors.push('return-kind-not-declared');
  if (!ADJUSTMENT_SCOPES.includes(adjustment)) errors.push('adjustment-scope-not-declared');
  if (!currency) errors.push('currency-not-declared');
  if (!startValuationAt || !endValuationAt) errors.push('valuation-times-not-declared');
  if (Date.parse(startValuationAt || '') >= Date.parse(endValuationAt || '')) errors.push('valuation-times-not-ordered');
  if (kind === 'total' && adjustment !== 'split+dividend') errors.push('total-return-requires-dividend-adjustment');
  if (Number.isFinite(input.value) === false) errors.push('return-value-missing');
  // A provider field name is not a declaration of what was adjusted.
  if (input.adjustedClose === true && !input.adjustment) errors.push('adjustment-inferred-from-field-name');
  return Object.freeze({
    version: RETURN_CONTRACT_VERSION,
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    kind: RETURN_KINDS.includes(kind) ? kind : null,
    adjustment: ADJUSTMENT_SCOPES.includes(adjustment) ? adjustment : null,
    currency,
    startValuationAt,
    endValuationAt,
    value: Number.isFinite(input.value) ? Number(input.value) : null
  });
}

/**
 * fxDirection declares how the rate is quoted: how much base currency one local unit is worth
 * ('base-per-local'), or its inverse. One plus the base-currency return is
 * (1 + R_local) x FX_end / FX_start; an inverse quote is normalized first, not flipped by guessing.
 */
export function convertReturnToBaseCurrency({ localReturn, fxStart, fxEnd, fxDirection } = {}) {
  if (!Number.isFinite(localReturn)) return Object.freeze({ ok: false, reason: 'local-return-missing', value: null });
  if (!Number.isFinite(fxStart) || !Number.isFinite(fxEnd) || fxStart <= 0 || fxEnd <= 0) {
    return Object.freeze({ ok: false, reason: 'fx-rate-missing', value: null });
  }
  if (!FX_DIRECTIONS.includes(fxDirection)) return Object.freeze({ ok: false, reason: 'fx-direction-not-declared', value: null });
  const toBasePerLocal = (rate) => (fxDirection === 'base-per-local' ? rate : 1 / rate);
  const value = (1 + localReturn) * (toBasePerLocal(fxEnd) / toBasePerLocal(fxStart)) - 1;
  return Object.freeze({ ok: true, reason: null, value, direction: 'base-per-local' });
}

/**
 * A 2:1 split is not a loss. The economic return is the change in the value of the holding, so the
 * split-adjusted series and the share count must not both be applied to the same cash amount — the
 * shares the holder actually has are used once.
 */
export function economicReturnWithSplit({ priceBefore, priceAfter, sharesBefore = 1, sharesAfter = 1 } = {}) {
  if (!Number.isFinite(priceBefore) || !Number.isFinite(priceAfter) || priceBefore <= 0 || sharesBefore <= 0 || sharesAfter <= 0) {
    return Object.freeze({ ok: false, reason: 'price-or-share-count-missing', value: null });
  }
  return Object.freeze({ ok: true, reason: null, value: (priceAfter * sharesAfter) / (priceBefore * sharesBefore) - 1 });
}

/** Price return excludes the distribution; holding return includes cash actually received. */
export function holdingReturn({ priceBefore, priceAfter, cashPerShare = 0 } = {}) {
  if (!Number.isFinite(priceBefore) || !Number.isFinite(priceAfter) || priceBefore <= 0) {
    return Object.freeze({ ok: false, reason: 'price-missing', priceReturn: null, holdingReturn: null });
  }
  const cash = Number.isFinite(cashPerShare) ? Number(cashPerShare) : 0;
  return Object.freeze({
    ok: true, reason: null,
    priceReturn: (priceAfter - priceBefore) / priceBefore,
    holdingReturn: (priceAfter + cash - priceBefore) / priceBefore
  });
}

/**
 * A comparison group must be comparable: price returns and total returns cannot be mixed without
 * saying so, and neither can two currencies. Returns the first violation instead of averaging
 * incompatible numbers into one figure.
 */
export function assertComparableReturns(observations = []) {
  const rows = Array.isArray(observations) ? observations.map((entry) => createReturnObservation(entry)) : [];
  const invalid = rows.find((row) => !row.ok);
  if (invalid) return Object.freeze({ comparable: false, reason: 'return-observation-invalid', errors: invalid.errors });
  if (!rows.length) return Object.freeze({ comparable: false, reason: 'return-group-empty', errors: Object.freeze([]) });
  const kinds = new Set(rows.map((row) => row.kind));
  const currencies = new Set(rows.map((row) => row.currency));
  const adjustments = new Set(rows.map((row) => row.adjustment));
  if (kinds.size > 1) return Object.freeze({ comparable: false, reason: 'price-and-total-return-mixed-without-declaration', errors: Object.freeze([]) });
  if (currencies.size > 1) return Object.freeze({ comparable: false, reason: 'multiple-currency-bases-in-one-comparison', errors: Object.freeze([]) });
  if (adjustments.size > 1) return Object.freeze({ comparable: false, reason: 'mixed-adjustment-scope-in-one-comparison', errors: Object.freeze([]) });
  return Object.freeze({ comparable: true, reason: null, kind: [...kinds][0], currency: [...currencies][0], adjustment: [...adjustments][0], errors: Object.freeze([]) });
}

/**
 * A missing FX observation is a missing value, not a trading value. Interpolating between two quotes to
 * make a comparable number would invent a rate that could not be transacted at that time.
 */
export function alignFxToValuationTime({ series = [], at } = {}) {
  const target = Date.parse(at || '');
  if (!Number.isFinite(target)) return Object.freeze({ ok: false, reason: 'valuation-time-missing', rate: null, usedAt: null });
  const observations = (Array.isArray(series) ? series : [])
    .map((entry) => ({ at: Date.parse(entry?.at || ''), rate: Number(entry?.rate) }))
    .filter((entry) => Number.isFinite(entry.at) && Number.isFinite(entry.rate) && entry.at <= target)
    .sort((left, right) => right.at - left.at);
  if (!observations.length) return Object.freeze({ ok: false, reason: 'fx-observation-not-available-at-valuation-time', rate: null, usedAt: null });
  return Object.freeze({ ok: true, reason: null, rate: observations[0].rate, usedAt: new Date(observations[0].at).toISOString(), interpolated: false });
}
