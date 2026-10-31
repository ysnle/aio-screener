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

import { calendarDate } from '../domain/portfolio/trade-journal.js';

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

// v59.45 (PASS27 P27-IMPORT-01): a day that does not exist (2026-02-30) is not a ledger date.
const cleanDate = calendarDate;

function cleanAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function emptyLedger() {
  return { currency: null, dayCount: DAY_COUNT, flowTiming: 'end-of-period', coverage: {}, valuations: [], transactions: [] };
}

function byDate(left, right) {
  // Equal dates compare 0 so the stable sort keeps same-day rows in entry order.
  return String(left.date) < String(right.date) ? -1 : String(left.date) > String(right.date) ? 1 : 0;
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
  const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  const rawValuations = Array.isArray(raw.valuations) ? raw.valuations : [];
  ledger.transactions = rawTransactions
    .map((entry) => ({ date: cleanDate(entry?.date), kind: TRANSACTION_KINDS.includes(entry?.kind) ? entry.kind : null, amount: cleanAmount(entry?.amount) }))
    .filter((entry) => entry.date && entry.kind && entry.amount != null)
    .sort(byDate);
  ledger.valuations = rawValuations
    .map((entry) => ({ date: cleanDate(entry?.date), amount: cleanAmount(entry?.amount) }))
    .filter((entry) => entry.date && entry.amount != null)
    .sort(byDate);
  // v59.45 (PASS27 P27-IMPORT-01): a row that could not be read is a missing flow or mark, so the matching "all included"
  // declaration no longer holds — a dropped deposit with 입출금 still declared read as a higher account return. The
  // declaration is withdrawn (account performance holds on account-input-incomplete until the reader re-declares it); a
  // stored ledger written by this module never carries such rows, so its declaration is unchanged.
  if (ledger.transactions.length < rawTransactions.length) delete ledger.coverage['deposits-withdrawals'];
  if (ledger.valuations.length < rawValuations.length) delete ledger.coverage['valuation-cuts'];
  return ledger;
}

export function appendLedgerTransaction(ledger, input = {}) {
  const base = normalizeLedger(ledger) || emptyLedger();
  const date = cleanDate(input.date);
  const amount = cleanAmount(input.amount);
  if (!date || amount == null) return { ok: false, reason: 'invalid-ledger-entry', ledger: base };
  if (!TRANSACTION_KINDS.includes(input.kind)) return { ok: false, reason: 'invalid-ledger-kind', ledger: base };
  // v59.45 (PASS27 P27-LEDGER-01): '추가' adds a flow. A second deposit on the same day used to replace the first (100 then
  // 200 kept 200, not 300) while the screen said the deposit was saved; the period's net flow already sums every row.
  // The stable sort keeps same-day rows in entry order, so the remove index still names the row the list shows.
  const next = { ...base, transactions: base.transactions.concat([{ date, kind: input.kind, amount }]).sort(byDate) };
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
  // v59.45 (PASS27): an unknown kind is refused instead of deleting a transaction row.
  if (kind !== 'valuation' && kind !== 'transaction') return { ok: false, reason: 'invalid-ledger-kind', ledger: base };
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
