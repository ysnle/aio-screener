const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' when the value is exactly that, else null. */
export function isoDay(value) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return ISO_DAY.test(text) ? text : null;
}

/** true when the value is exactly 'YYYY-MM-DD' (the boolean form of isoDay; same coercion as RegExp#test). */
export function isIsoDay(value) {
  return ISO_DAY.test(value == null ? '' : String(value));
}

/** true when the value starts with 'YYYY-MM-DD' (a date or any timestamp that begins with one). */
export function hasLeadingIsoDay(value) {
  return ISO_DAY.test((value == null ? '' : String(value)).slice(0, 10));
}

/** The date part of a date or an ISO timestamp ('2026-10-30' or '2026-10-30T20:00:00Z'), else null. */
export function stampDay(value) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return text.length === 10 || text[10] === 'T' ? isoDay(text.slice(0, 10)) : null;
}

/**
 * The rows that sit on the latest session among them. `sessionOf` reads a row's session (default factorSessionDate);
 * rows without a readable session never count. Returns { basis, rows, older } — basis null when no row has a session.
 */
export function latestSessionRows(rows, sessionOf = (row) => isoDay(row?.factorSessionDate)) {
  const dated = (Array.isArray(rows) ? rows : []).map((row) => ({ row, day: sessionOf(row) })).filter((item) => item.day);
  const basis = dated.reduce((latest, item) => (latest == null || item.day > latest ? item.day : latest), null);
  const current = dated.filter((item) => item.day === basis).map((item) => item.row);
  return { basis, rows: current, older: dated.length - current.length };
}
