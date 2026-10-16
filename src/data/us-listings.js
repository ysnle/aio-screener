// v57.81: every US exchange-listed symbol (public-data/us-listings.json, built in Actions by
// scripts/build-us-listings.mjs from the Nasdaq Trader symbol directory + SEC CIKs). Never on the boot path: it is
// loaded only when a symbol is unknown to the name registry, the KRX list and the screener universe.
// Exact symbol match only (P1339). The one rewrite is the documented class-share separator (BRK.B / BRK/B -> BRK-B,
// the form the universe, quotes and SEC use). Company names are never resolved automatically (R663); since v57.83 a
// name search offers listing candidates for the reader to choose from (searchUsListingNames), nothing more.
import { loadJsonArtifact } from './artifact-cache.js';

export const US_LISTINGS_URL = './public-data/us-listings.json';
export const US_LISTINGS_SCHEMA = 'us-listings.v1';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 10 * 1000;
const CLASS_SHARE_RE = /^([A-Z]{1,5})[./]([A-Z])$/;
const LISTABLE_RE = /^[A-Z]{1,5}(?:-[A-Z])?$/;

/** Upper-cased symbol in listing form; only the class-share separator changes. */
export function usListingSymbol(raw) {
  const text = String(raw == null ? '' : raw).trim().toUpperCase();
  const share = text.match(CLASS_SHARE_RE);
  return share ? `${share[1]}-${share[2]}` : text;
}

const indexes = new WeakMap();
/** Columnar payload -> { asOf, exchanges, bySymbol } or null when the payload is not a us-listings.v1 artifact. */
export function indexUsListings(payload) {
  if (!payload || typeof payload !== 'object' || payload.schemaVersion !== US_LISTINGS_SCHEMA) return null;
  if (indexes.has(payload)) return indexes.get(payload);
  const columns = payload.columns || {};
  const symbols = Array.isArray(columns.sym) ? columns.sym : [];
  if (!symbols.length) return null;
  const bySymbol = new Map();
  symbols.forEach((symbol, index) => { if (typeof symbol === 'string' && !bySymbol.has(symbol)) bySymbol.set(symbol, index); });
  const index = { asOf: payload.asOf || null, exchanges: payload.exchanges || {}, columns, bySymbol, count: bySymbol.size };
  indexes.set(payload, index);
  return index;
}

/** Exact lookup in an index. listed:null means the listing could not be checked (no index). */
export function lookupUsListing(index, raw) {
  if (!index) return { listed: null, name: null, exchange: null, etf: null, asOf: null, cik: null, directoryAvailable: false };
  const at = index.bySymbol.get(usListingSymbol(raw));
  if (at == null) return { listed: false, name: null, exchange: null, etf: null, asOf: index.asOf, cik: null };
  const code = String(index.columns.exch || '').charAt(at);
  const cik = Array.isArray(index.columns.cik) ? index.columns.cik[at] : null;
  return {
    listed: true,
    name: Array.isArray(index.columns.name) ? index.columns.name[at] || null : null,
    exchange: index.exchanges[code] || code || null,
    etf: String(index.columns.etf || '').charAt(at) === '1',
    asOf: index.asOf,
    cik: typeof cik === 'string' && /^\d{10}$/.test(cik) ? cik : null
  };
}

const state = { index: null, loadedAt: 0, failedAt: 0, inFlight: null };

/** Loads (once per 6h, shared in-flight) and indexes the listing. Resolves null when it is missing or offline. */
export async function loadUsListings({ fetch: fetchFn = null, force = false } = {}) {
  const now = Date.now();
  if (!force && state.index && now - state.loadedAt < MAX_AGE_MS) return state.index;
  if (state.inFlight) return state.inFlight;
  if (!force && !state.index && now - state.failedAt < RETRY_AFTER_FAILURE_MS) return null;
  const transport = fetchFn || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  if (!transport) return state.index;
  state.inFlight = loadJsonArtifact(transport, US_LISTINGS_URL, { maxAgeMs: 0, force: true, maxBytes: MAX_BYTES, timeoutMs: 20_000 })
    .then((payload) => {
      const index = indexUsListings(payload);
      if (!index) throw new Error('us-listings schema');
      state.index = index;
      state.loadedAt = Date.now();
      return index;
    })
    .catch(() => { state.failedAt = Date.now(); return state.index; })
    .finally(() => { state.inFlight = null; });
  return state.inFlight;
}

/**
 * { listed, name, exchange, etf, asOf, cik }. listed is true/false from the official listing, or null when the
 * listing could not be loaded — callers must not accept an unchecked symbol.
 */
export async function isListedUsSymbol(sym) {
  const symbol = usListingSymbol(sym);
  if (!LISTABLE_RE.test(symbol)) {
    const index = state.index;
    return { listed: false, name: null, exchange: null, etf: null, asOf: index?.asOf || null, cik: null };
  }
  return lookupUsListing(await loadUsListings(), symbol);
}

const SHARE_SUFFIX_RE = /\s*-?\s*(Common Stock|Common Shares|Ordinary Shares|Class [A-C] (?:Common Stock|Ordinary Shares)|American Depositary Shares?.*|Depositary Shares?.*)\s*$/i;
/**
 * v57.83 (owner 2026-10-16: no company-name search for symbols outside the universe): listing names that contain the
 * query at a word start, as candidates the reader picks from. Operating companies before funds, a name that starts
 * with the query first; never auto-selected (R663). Queries under 3 letters or with no Latin letter return nothing.
 */
export function searchUsListingNames(index, raw, { limit = 6, exclude = [] } = {}) {
  const query = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!index || query.length < 3 || !/[a-z]/.test(query)) return [];
  const names = Array.isArray(index.columns.name) ? index.columns.name : [];
  const symbols = index.columns.sym || [];
  const skip = new Set(exclude.map((symbol) => String(symbol).toUpperCase()));
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordStart = new RegExp(`(?:^|[\\s(&./-])${escaped}`);
  const found = [];
  for (let at = 0; at < names.length; at += 1) {
    const name = String(names[at] || '');
    const lower = name.toLowerCase();
    if (!wordStart.test(lower) || skip.has(symbols[at])) continue;
    found.push({ at, starts: lower.startsWith(query), etf: String(index.columns.etf || '').charAt(at) === '1', name: name.replace(SHARE_SUFFIX_RE, '').trim() || name });
  }
  found.sort((a, b) => Number(b.starts) - Number(a.starts) || Number(a.etf) - Number(b.etf) || a.name.length - b.name.length);
  return found.slice(0, limit).map(({ at, name, etf }) => ({ symbol: symbols[at], label: name, exchange: index.exchanges[String(index.columns.exch || '').charAt(at)] || null, etf }));
}

/** Test seam: forget the in-memory copy. */
export function resetUsListingsCache() {
  state.index = null; state.loadedAt = 0; state.failedAt = 0; state.inFlight = null;
}
