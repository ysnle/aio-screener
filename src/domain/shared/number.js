// v57.60: the strict "already a finite number" reader that ~30 modules declared locally as `finite`.
// Strings, booleans, null and NaN/Infinity all return null — no Number() coercion. Modules whose
// local `finite` coerces strings keep their own copy (different behaviour).
export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// v59.46 (structure pilot): the one reader for values that may arrive as numeric strings (JSON, CSV, form fields).
// A reading is a finite number or a non-blank numeric string; null, '', '  ', booleans, arrays and objects are missing,
// not 0 or 1 — Number(null), Number(''), Number(' '), Number(false) and Number([]) are all 0, which is how a missing
// value became a zero reading in ~35 local copies of this function.
export function readNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// v58.74 (text audit): one sign style for every displayed change. 34 local helpers printed "-0.8%", "−0.0%" (U+2212) and
// "±0.00%p" side by side on one screen. The sign is chosen after rounding (a value that rounds to zero carries no
// sign) and the minus is the ASCII hyphen-minus every other number on the site uses.
// `plus: false` prints a minus but no plus (range ends, premiums); a value that rounds to zero is unsigned either way.
export function signedText(value, digits = 1, unit = '', { plus = true } = {}) {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return '—';
  const text = Math.abs(number).toFixed(digits);
  return `${Number(text) === 0 ? '' : number > 0 ? (plus ? '+' : '') : '-'}${text}${unit}`;
}

// v58.80 (first-users R2-27): the colour follows the printed sign — a change that rounds to zero ("0.0%") is neither
// rising red nor falling blue. Same rounding as signedText; null for a missing value.
export function directionOf(value, digits = 1) {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number) || Number(Math.abs(number).toFixed(digits)) === 0) return null;
  return number > 0 ? 'up' : 'down';
}

// v58.74 (text audit): job counts arrive in thousands and were printed as "100천 명", "25천 명" and "5.1만 명" in one card.
// Under 10천 the count stays in 천; from there it reads in 만 with at most one decimal.
export function peopleText(thousands, { sign = false } = {}) {
  if (typeof thousands !== 'number' || !Number.isFinite(thousands)) return '—';
  const abs = Math.abs(thousands);
  const body = abs < 10 ? `${Math.round(abs)}천 명` : `${Number((abs / 10).toFixed(1)).toLocaleString('en-US')}만 명`;
  const prefix = thousands < 0 && Math.round(abs) !== 0 ? '-' : sign && thousands > 0 && Math.round(abs) !== 0 ? '+' : '';
  return `${prefix}${body}`;
}

// First-users F33: one dollar format in 조·억·만 달러, sign first; `precise` keeps decimals for exact-value titles.
export function usdKoreanText(value, { precise = false } = {}) {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return '—';
  const abs = Math.abs(number);
  const fmt = (n, digits) => Number(n.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
  const body = precise
    ? (abs >= 1e8 ? `${fmt(abs / 1e8, 4)}억 달러` : abs >= 1e4 ? `${fmt(abs / 1e4, 2)}만 달러` : `${fmt(abs, 2)}달러`)
    : abs >= 1e12 ? `${fmt(abs / 1e12, 2)}조 달러` : abs >= 1e8 ? `${fmt(abs / 1e8, abs >= 1e10 ? 0 : 1)}억 달러` : abs >= 1e4 ? `${fmt(abs / 1e4, 0)}만 달러` : `${fmt(abs, 0)}달러`;
  return `${number < 0 && body !== '0달러' ? '-' : ''}${body}`;
}

/**
 * v59.70 (step 1, one move one number): an actual's surprise against its estimate in percent of the estimate's size,
 * rounded to 0.1. Earnings briefs, the market-day facts, the news card and the fundamental read each wrote this formula
 * with their own rounding and guards; they read this one. A missing value or a zero estimate is null.
 */
export function surprisePct(actual, estimate) {
  const a = readNumber(actual), e = readNumber(estimate);
  if (a == null || e == null || e === 0) return null;
  return Math.round(((a - e) / Math.abs(e)) * 1000) / 10;
}

/**
 * A dollar amount in the English release form at the
 * scale that keeps its digits — billions from 1e9, millions below, thousands under a million. Null for no number.
 */
export function usdScaleWords(value, digits = 2) {
  const n = readNumber(value);
  if (n == null) return null;
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(digits)} billion`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(digits)} million`;
  return `${sign}$${(abs / 1e3).toFixed(digits)} thousand`;
}

// The one mean and standard deviation (ADR-0003). Callers keep their own guards (minimum samples, what an empty input
// returns); the arithmetic is shared so a population and a sample deviation are never confused by a local copy.

/** Arithmetic mean of finite numbers already filtered by the caller; null for an empty list. */
export function mean(values) {
  if (!Array.isArray(values) || !values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Standard deviation. Population (÷ n) by default; `sample: true` divides by n − 1 (returns, test statistics).
 * null when there are too few values (none, or one for a sample deviation).
 */
export function stdev(values, { sample = false } = {}) {
  const n = Array.isArray(values) ? values.length : 0;
  if (n < (sample ? 2 : 1)) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (sample ? n - 1 : n));
}
