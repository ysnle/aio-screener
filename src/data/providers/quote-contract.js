/**
 * P1174 (15 D06): price, currency, identity and observation time are one quote, not four fields.
 *
 * The merge in the screener provider treated the currency as an optional annotation on a price: a live
 * quote without a currency was "compatible" with the artifact, so an envelope that declared a price of
 * 101 and nothing else could replace the artifact price and be labelled CURRENT while the instrument's
 * currency stayed MISSING. The design rule is narrower than "adopt if not conflicting": the artifact's
 * known currency may only be carried over when the same instrument/listing is **proven**, and an
 * incomplete quote is kept as a diagnostic instead of becoming the current price.
 */
export const QUOTE_CONTRACT_VERSION = 'quote-contract.v1';

function result(fields) {
  return Object.freeze({ version: QUOTE_CONTRACT_VERSION, ...fields });
}

/**
 * @param {{ price?: unknown, currency?: unknown, observedAt?: unknown }} quote
 * @param {{ currency?: unknown }} artifact
 * @param {boolean} identityProof same instrument/listing proven (registry-verified), not inferred
 */
export function evaluateQuoteContract({ quote = {}, artifact = {}, identityProof = false } = {}) {
  const price = Number.isFinite(quote.price) ? Number(quote.price) : null;
  const ownCurrency = String(quote.currency || '').trim().toUpperCase() || null;
  const artifactCurrency = String(artifact.currency || '').trim().toUpperCase() || null;
  const observedAt = quote.observedAt || null;
  const reject = (reason) => result({
    admissible: false, price: null, currency: null, currencySource: null,
    diagnosticPrice: price, reason
  });
  if (price == null) return reject('quote-price-missing');
  if (!observedAt) return reject('quote-observed-time-missing');
  if (ownCurrency) {
    if (artifactCurrency && artifactCurrency !== ownCurrency && !identityProof) {
      return reject('quote-currency-conflict-without-identity-proof');
    }
    return result({ admissible: true, price, currency: ownCurrency, currencySource: 'declared', diagnosticPrice: null, reason: null });
  }
  if (!identityProof) return reject('quote-currency-missing-without-identity-proof');
  if (!artifactCurrency) return reject('quote-currency-missing-and-artifact-currency-unknown');
  return result({
    admissible: true, price, currency: artifactCurrency,
    currencySource: 'inherited-from-artifact-with-identity-proof', diagnosticPrice: null, reason: null
  });
}
