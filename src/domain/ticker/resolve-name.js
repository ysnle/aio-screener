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

// v57.54 review: a search with no exact match ("삼성") showed a one-second toast and left the previous stock on screen.
// These are candidates for the user to pick (names or symbols containing the query) — never opened automatically.
export function searchCandidates(raw, { entries = {}, krStockDb = {}, krToYahoo = null, limit = 6 } = {}) {
  const query = String(raw || '').trim().toLowerCase();
  if (query.length < 2) return [];
  const found = new Map();
  const add = (symbol, label, names) => {
    if (found.has(symbol)) return;
    const starts = names.some((name) => name.startsWith(query)) || symbol.toLowerCase().startsWith(query);
    if (starts || names.some((name) => name.includes(query))) found.set(symbol, { symbol, label, starts });
  };
  for (const [symbol, row] of Object.entries(entries || {})) add(symbol, row?.kr || row?.en || symbol, [row?.kr, row?.en, ...(row?.alt || [])].filter(Boolean).map((name) => String(name).toLowerCase()));
  for (const [code, row] of Object.entries(krStockDb || {})) {
    const symbol = typeof krToYahoo === 'function' ? krToYahoo(code) : `${code}.KS`;
    add(symbol, row?.name || code, [String(row?.name || '').toLowerCase(), code]);
  }
  return [...found.values()].sort((a, b) => Number(b.starts) - Number(a.starts)).slice(0, limit).map(({ symbol, label }) => ({ symbol, label }));
}

/** Whether AIO knows a symbol at all (name registry, KRX list or the screener universe). */
export function isKnownSymbol(symbol, { entries = {}, krStockDb = {}, universe = [] } = {}) {
  const id = String(symbol || '').trim().toUpperCase();
  if (!id) return false;
  if (entries?.[id] || krStockDb?.[id.replace(/\.K[SQ]$/, '')]) return true;
  return (Array.isArray(universe) ? universe : []).some((row) => String(row?.sym || row || '').toUpperCase() === id);
}

/**
 * v57.81: the portfolio entry box. A ticker-shaped input stays exactly what was typed (never rewritten to another issuer);
 * only a non-ticker-shaped input (a Korean name or a registered nickname such as "스엑") resolves, and only by an exact
 * registry match. `known` uses the same owner as the ticker route (isKnownSymbol: name registry, KRX list, screener universe).
 */
export function resolveHoldingInput(raw, { entries = {}, krStockDb = {}, universe = [] } = {}) {
  const text = String(raw || '').trim();
  if (!text) return { symbol: '', known: false, resolvedFrom: null };
  const typed = text.toUpperCase();
  const tickerShaped = /^[A-Z0-9.^=-]{1,10}$/.test(typed);
  const named = tickerShaped ? null : resolveRegisteredName(text, entries);
  const symbol = named || typed;
  return { symbol, known: isKnownSymbol(symbol, { entries, krStockDb, universe }), resolvedFrom: named && named !== typed ? text : null };
}
