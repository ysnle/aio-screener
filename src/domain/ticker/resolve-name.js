// P1339: company-name → ticker resolution without guessing (memory rule: no ticker inference).
// A registered ticker stays itself; an exact English/Korean company name resolves; registry aliases apply only
// to input that is not ticker-shaped, so GOOG / HR / SQ are never rewritten to a different issuer.
export function resolveRegisteredName(raw, entries = {}) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (entries[text.toUpperCase()]) return text.toUpperCase();
  const tickerShaped = /^[a-z0-9.^=-]{1,5}$/i.test(text);
  const lower = text.toLowerCase();
  return Object.keys(entries).find((symbol) => [entries[symbol].en, entries[symbol].kr, ...(tickerShaped ? [] : entries[symbol].alt || [])]
    .some((name) => name && String(name).toLowerCase() === lower)) || null;
}
