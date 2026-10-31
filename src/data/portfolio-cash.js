/**
 * Cash balances by currency (v57.81).
 *
 * Cash used to be one number (`aio_portfolio_cash`) with one declared currency
 * (`aio_portfolio_cash_currency`), so a won balance and a dollar balance could not both
 * be held. The model is now a list of balances, one per currency code, stored as JSON
 * under one key. KRW and USD are the two the screen asks for; any three-letter code is
 * kept, so the list extends without a new key.
 *
 * Migration is a pure read: when the new key is absent, a valid legacy single value is
 * read as one balance in its declared currency (or the base currency, or USD — the unit
 * the screen already printed it in). Nothing is written until the user saves the new
 * model, and the legacy value is removed only after that write reads back equal, so the
 * old value survives any failed or partial save. Reading twice gives the same result.
 *
 * Cash stays plain browser storage like the legacy key did (it was never a Vault key).
 */
import { PORTFOLIO_ASSUMPTION_KEYS, normalizeCurrencyCode } from './portfolio-assumptions.js';

export const PORTFOLIO_CASH_KEY = 'aio_portfolio_cash_balances';
export const LEGACY_CASH_KEY = 'aio_portfolio_cash';
export const CASH_INPUT_CURRENCIES = Object.freeze(['KRW', 'USD']);

const ORDER = (code) => {
  const index = CASH_INPUT_CURRENCIES.indexOf(code);
  return index === -1 ? CASH_INPUT_CURRENCIES.length : index;
};

function cleanAmount(value) {
  if (value == null || String(value).trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Accepts a list [{currency, amount}] or a map {KRW: 1000}; drops invalid rows; one row per code. */
export function normalizeCashBalances(raw) {
  const entries = Array.isArray(raw)
    ? raw.map((row) => [row && row.currency, row && row.amount])
    : raw && typeof raw === 'object' ? Object.entries(raw) : [];
  const byCode = new Map();
  for (const [code, value] of entries) {
    const currency = normalizeCurrencyCode(code);
    const amount = cleanAmount(value);
    if (currency && amount != null) byCode.set(currency, amount);
  }
  return Object.freeze([...byCode.entries()]
    .sort(([a], [b]) => ORDER(a) - ORDER(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, amount]) => Object.freeze({ currency, amount })));
}

/** The unit the single legacy value was in: its declared cash currency, else the base, else USD (the screen's default). */
export function legacyCashCurrency({ cashCurrency = null, baseCurrency = null } = {}) {
  return normalizeCurrencyCode(cashCurrency) || normalizeCurrencyCode(baseCurrency) || 'USD';
}

export function legacyCashBalances(rawCash, declarations = {}) {
  const amount = cleanAmount(rawCash);
  return amount == null ? Object.freeze([]) : normalizeCashBalances([{ currency: legacyCashCurrency(declarations), amount }]);
}

/**
 * Pure read. `known` is true once anything was entered (a stored 0 included), so an empty
 * list after the user cleared every box stays distinct from "never entered".
 */
export function readCashBalances(storage) {
  const get = (key) => {
    try { return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null; } catch (_) { return null; }
  };
  const stored = get(PORTFOLIO_CASH_KEY);
  if (stored != null) {
    let parsed = null;
    try { parsed = JSON.parse(stored); } catch (_) { parsed = null; }
    if (parsed && typeof parsed === 'object') return Object.freeze({ balances: normalizeCashBalances(parsed), known: true, source: 'balances' });
  }
  const legacy = get(LEGACY_CASH_KEY);
  const balances = legacyCashBalances(legacy, {
    cashCurrency: get(PORTFOLIO_ASSUMPTION_KEYS.cashCurrency),
    baseCurrency: get(PORTFOLIO_ASSUMPTION_KEYS.baseCurrency)
  });
  if (balances.length) return Object.freeze({ balances, known: true, source: 'legacy-single' });
  return Object.freeze({ balances: Object.freeze([]), known: false, source: 'none' });
}

/** One balance replaced; a blank amount removes that currency's row. */
export function setCashBalance(balances, currency, value) {
  const code = normalizeCurrencyCode(currency);
  if (!code) return normalizeCashBalances(balances);
  const amount = cleanAmount(value);
  const rest = normalizeCashBalances(balances).filter((row) => row.currency !== code);
  return normalizeCashBalances(amount == null ? rest : [...rest, { currency: code, amount }]);
}

/**
 * Write the new model, read it back, and only then drop the legacy value. A failed write
 * leaves the legacy value (and any earlier new-model value) untouched.
 */
export function writeCashBalances(storage, balances) {
  const list = normalizeCashBalances(balances);
  const text = JSON.stringify(list.map((row) => ({ currency: row.currency, amount: row.amount })));
  // v59.45 (PASS27): a write that does not read back restores the value that was there, so the comment above holds
  // for a readback failure too, not only for a refused write.
  let before = null;
  try { before = storage.getItem(PORTFOLIO_CASH_KEY); } catch (_) { before = null; }
  try {
    storage.setItem(PORTFOLIO_CASH_KEY, text);
    if (storage.getItem(PORTFOLIO_CASH_KEY) !== text) {
      try { if (before == null) storage.removeItem(PORTFOLIO_CASH_KEY); else storage.setItem(PORTFOLIO_CASH_KEY, before); } catch (_) {}
      return { ok: false, reason: 'readback-mismatch', balances: list };
    }
  } catch (_) {
    return { ok: false, reason: 'write-failed', balances: list };
  }
  try { storage.removeItem(LEGACY_CASH_KEY); } catch (_) {}
  return { ok: true, balances: list };
}
