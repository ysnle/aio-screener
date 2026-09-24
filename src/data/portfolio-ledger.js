/**
 * Account ledger (E4/P1191).
 *
 * Account performance is a ledger claim: without external cashflows and period
 * valuation cuts there is nothing to link returns around, so the ledger is an
 * input the user must declare, not something derived from holdings. This module
 * owns the pure part of that declaration — normalization, append/remove and the
 * per-input coverage declaration — so the classic shell only owns the DOM and
 * the Vault write, and the contract can be unit-tested without a browser.
 */

export const LEDGER_COVERAGE_INPUTS = Object.freeze([
  Object.freeze({ id: 'trades', label: '매매' }),
  Object.freeze({ id: 'deposits-withdrawals', label: '입출금' }),
  Object.freeze({ id: 'dividends-splits', label: '배당·분할' }),
  Object.freeze({ id: 'fees-taxes', label: '비용·세금' }),
  Object.freeze({ id: 'fx', label: 'FX' }),
  Object.freeze({ id: 'valuation-cuts', label: '기간 평가액' })
]);

const COVERAGE_IDS = LEDGER_COVERAGE_INPUTS.map((entry) => entry.id);
const DAY_COUNT = 'actual-365';
const TRANSACTION_KINDS = ['deposit', 'withdrawal'];

function cleanDate(value) {
  const text = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function emptyLedger() {
  return { currency: null, dayCount: DAY_COUNT, flowTiming: 'end-of-period', coverage: {}, valuations: [], transactions: [] };
}

function byDate(left, right) {
  return String(left.date) < String(right.date) ? -1 : 1;
}

// A ledger read from storage is normalized, never trusted: an entry that cannot
// be dated or priced is dropped rather than carried as a zero. An object that
// carries none of the ledger keys is not a ledger — returning an empty one would
// let a caller that passed the wrong shape silently lose the real declaration.
export function normalizeLedger(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!('transactions' in raw) && !('valuations' in raw) && !('coverage' in raw) && !('flowTiming' in raw)) return null;
  const ledger = emptyLedger();
  ledger.currency = typeof raw.currency === 'string' && /^[A-Za-z]{3}$/.test(raw.currency.trim()) ? raw.currency.trim().toUpperCase() : null;
  ledger.flowTiming = raw.flowTiming === 'start-of-period' ? 'start-of-period' : 'end-of-period';
  ledger.coverage = {};
  if (raw.coverage && typeof raw.coverage === 'object') {
    COVERAGE_IDS.forEach((id) => { if (raw.coverage[id] === true) ledger.coverage[id] = true; });
  }
  ledger.transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
    .map((entry) => ({ date: cleanDate(entry?.date), kind: TRANSACTION_KINDS.includes(entry?.kind) ? entry.kind : null, amount: cleanAmount(entry?.amount) }))
    .filter((entry) => entry.date && entry.kind && entry.amount != null)
    .sort(byDate);
  ledger.valuations = (Array.isArray(raw.valuations) ? raw.valuations : [])
    .map((entry) => ({ date: cleanDate(entry?.date), amount: cleanAmount(entry?.amount) }))
    .filter((entry) => entry.date && entry.amount != null)
    .sort(byDate);
  return ledger;
}

export function appendLedgerTransaction(ledger, input = {}) {
  const base = normalizeLedger(ledger) || emptyLedger();
  const date = cleanDate(input.date);
  const amount = cleanAmount(input.amount);
  if (!date || amount == null) return { ok: false, reason: 'invalid-ledger-entry', ledger: base };
  if (!TRANSACTION_KINDS.includes(input.kind)) return { ok: false, reason: 'invalid-ledger-kind', ledger: base };
  const next = { ...base, transactions: base.transactions.filter((entry) => !(entry.date === date && entry.kind === input.kind)).concat([{ date, kind: input.kind, amount }]).sort(byDate) };
  return { ok: true, ledger: next };
}

export function appendLedgerValuation(ledger, input = {}) {
  const base = normalizeLedger(ledger) || emptyLedger();
  const date = cleanDate(input.date);
  const amount = cleanAmount(input.amount);
  if (!date || amount == null) return { ok: false, reason: 'invalid-ledger-entry', ledger: base };
  // One valuation per date: a second mark for the same day replaces the first
  // rather than creating two denominators for one period boundary.
  const next = { ...base, valuations: base.valuations.filter((mark) => mark.date !== date).concat([{ date, amount }]).sort(byDate) };
  return { ok: true, ledger: next };
}

export function removeLedgerEntry(ledger, kind, index) {
  const base = normalizeLedger(ledger);
  if (!base) return { ok: false, reason: 'ledger-missing', ledger: null };
  const list = kind === 'valuation' ? base.valuations : base.transactions;
  const position = Number(index);
  if (!Number.isInteger(position) || position < 0 || position >= list.length) return { ok: false, reason: 'invalid-ledger-index', ledger: base };
  list.splice(position, 1);
  return { ok: true, ledger: base };
}

export function setLedgerCoverage(ledger, field, checked) {
  const base = normalizeLedger(ledger) || emptyLedger();
  if (!COVERAGE_IDS.includes(field)) return { ok: false, reason: 'unknown-ledger-input', ledger: base };
  const coverage = { ...base.coverage };
  if (checked === true) coverage[field] = true;
  else delete coverage[field];
  return { ok: true, ledger: { ...base, coverage } };
}

export function setLedgerFlowTiming(ledger, value) {
  const base = normalizeLedger(ledger) || emptyLedger();
  return { ok: true, ledger: { ...base, flowTiming: value === 'start-of-period' ? 'start-of-period' : 'end-of-period' } };
}

// The declared-inclusion facts the surface shows beside the ledger, so a hold can
// always be traced to the input that was not declared.
export function ledgerCoverageState(ledger) {
  const base = normalizeLedger(ledger);
  const declared = base ? COVERAGE_IDS.filter((id) => base.coverage[id] === true) : [];
  return {
    inputs: LEDGER_COVERAGE_INPUTS.map((entry) => ({ ...entry, declared: declared.includes(entry.id) })),
    declared,
    missing: COVERAGE_IDS.filter((id) => !declared.includes(id)),
    complete: declared.length === COVERAGE_IDS.length
  };
}
