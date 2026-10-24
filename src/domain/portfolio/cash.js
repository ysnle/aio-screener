/**
 * Cash total across currencies (v57.81).
 *
 * Each balance stays in its own currency. A total in one currency is a conversion claim,
 * so it uses an observed rate only: a rate the user declared (fx.js legs), or the app's own
 * published USD/KRW completed close, with its date carried into the label. Without either,
 * the total is not computed and the reason says which currency had no rate — never a guessed
 * rate and never 1.
 */
import { convertWithDeclaredRates } from './fx.js';
import { buildCloseSeries, closeBasis } from '../market/close-series.js';

const md = (date) => (/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

// A close older than a week (a long holiday is about four sessions) is no longer today's rate.
export const APP_FX_MAX_AGE_DAYS = 7;

/** The latest completed USD/KRW close the app published (the market screens' basis), or null. */
export function appUsdKrwClose(history, { now = Date.now() } = {}) {
  const rows = Array.isArray(history) ? history : [];
  if (!rows.length) return null;
  const series = buildCloseSeries(rows, 'usdkrw', { through: closeBasis(rows) });
  const last = series[series.length - 1];
  const rate = Number(last?.value);
  if (!last || !(Number.isFinite(rate) && rate > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(last.date || ''))) return null;
  const ageDays = (Number(now) - Date.parse(`${last.date}T00:00:00Z`)) / 86400000;
  if (!(ageDays >= -1 && ageDays <= APP_FX_MAX_AGE_DAYS + 1)) return null;
  return Object.freeze({ pair: 'USD/KRW', rate, date: last.date, basis: 'completed-close', label: `USD/KRW ${md(last.date)} 종가 기준` });
}

function viaAppClose(amount, from, to, appFx) {
  if (!appFx || !(appFx.rate > 0)) return null;
  if (from === 'USD' && to === 'KRW') return amount * appFx.rate;
  if (from === 'KRW' && to === 'USD') return amount / appFx.rate;
  return null;
}

/**
 * balances: [{currency, amount}] (a null currency is the legacy undeclared unit: counted as the
 * target unit, the single-basis behaviour that existed before). target: the unit of the total.
 * Returns the total (or null) and how each balance got there.
 */
export function convertCashBalances({ balances = [], target = null, legs = [], appFx = null, asOfMs = Date.now() } = {}) {
  const rows = (Array.isArray(balances) ? balances : []).filter((row) => row && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0);
  const to = String(target || '').trim().toUpperCase() || null;
  const parts = [];
  const held = [];
  const bases = new Set();
  for (const row of rows) {
    const amount = Number(row.amount);
    const from = String(row.currency || '').trim().toUpperCase() || null;
    if (amount === 0 || !from || from === to) { parts.push({ currency: from, amount, converted: amount, basis: 'same-unit' }); continue; }
    if (!to) { held.push(from); continue; }
    const declared = convertWithDeclaredRates({ value: amount, from, to, legs: Array.isArray(legs) ? legs : [], asOfMs });
    if (declared.ok) { parts.push({ currency: from, amount, converted: declared.value, basis: 'declared-rate' }); bases.add('선언 환율 기준'); continue; }
    const app = viaAppClose(amount, from, to, appFx);
    if (app != null) { parts.push({ currency: from, amount, converted: app, basis: 'app-close' }); bases.add(appFx.label); continue; }
    held.push(from);
  }
  const ok = rows.length > 0 && held.length === 0;
  return Object.freeze({
    ok,
    target: to,
    total: ok ? parts.reduce((sum, part) => sum + part.converted, 0) : null,
    parts: Object.freeze(parts.map((part) => Object.freeze(part))),
    held: Object.freeze([...new Set(held)]),
    converted: parts.some((part) => part.basis !== 'same-unit'),
    basisLabel: [...bases].join(', ') || null,
    appFx: appFx || null
  });
}
