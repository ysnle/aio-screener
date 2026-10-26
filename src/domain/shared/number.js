// v57.60: the strict "already a finite number" reader that ~30 modules declared locally as `finite`.
// Strings, booleans, null and NaN/Infinity all return null — no Number() coercion. Modules whose
// local `finite` coerces strings keep their own copy (different behaviour).
export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// v58.74 (text audit): one sign style for every displayed change. 34 local helpers printed "-0.8%", "−0.0%" (U+2212) and
// "±0.00%p" side by side on one screen. The sign is chosen after rounding (a value that rounds to zero carries no
// sign) and the minus is the ASCII hyphen-minus every other number on the site uses.
export function signedText(value, digits = 1, unit = '') {
  const number = typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return '—';
  const text = Math.abs(number).toFixed(digits);
  return `${Number(text) === 0 ? '' : number > 0 ? '+' : '-'}${text}${unit}`;
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
