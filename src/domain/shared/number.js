export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function signedText(value, digits = 1, unit = '', { plus = true } = {}) {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return '—';
  const text = Math.abs(number).toFixed(digits);
  return `${Number(text) === 0 ? '' : number > 0 ? (plus ? '+' : '') : '-'}${text}${unit}`;
}

// one per-share dollar style, sign before the dollar — "-$0.07", never "$-0.07" or "$(0.07)".
// Shared by the consensus read and the earnings cells.
export const usdPerShareText = (value, digits = 2) => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(digits)}`;

export function directionOf(value, digits = 1) {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number) || Number(Math.abs(number).toFixed(digits)) === 0) return null;
  return number > 0 ? 'up' : 'down';
}

// The sign printed before an amount formatted elsewhere (money): nothing for a value that rounds to zero.
export const signMark = (value, digits = 1) => ({ up: '+', down: '-' })[directionOf(value, digits)] || '';
export const directionColor = (value, digits = 1, neutral = 'var(--color-text-primary)') => ({ up: 'var(--color-data-up)', down: 'var(--color-data-down)' })[directionOf(value, digits)] || neutral;

export function peopleText(thousands, { sign = false } = {}) {
  if (typeof thousands !== 'number' || !Number.isFinite(thousands)) return '—';
  const abs = Math.abs(thousands);
  const body = abs < 10 ? `${Math.round(abs)}천 명` : `${Number((abs / 10).toFixed(1)).toLocaleString('en-US')}만 명`;
  const prefix = thousands < 0 && Math.round(abs) !== 0 ? '-' : sign && thousands > 0 && Math.round(abs) !== 0 ? '+' : '';
  return `${prefix}${body}`;
}

/** 억원 as Korean market news prints it, signed by the printed amount: +1,234억, -5,678억, -1.8조, 0억. */
export function eokText(value) {
  const abs = Math.abs(value), shown = Math.round(value), sign = shown > 0 ? '+' : shown < 0 ? '-' : '';
  return abs >= 1e4 ? `${sign}${(abs / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}조` : `${sign}${Math.round(abs).toLocaleString('en-US')}억`;
}

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
