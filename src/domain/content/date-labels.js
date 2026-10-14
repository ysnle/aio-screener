// v57.60: shared "M/D" label for ISO dates (was copied into market-read and eight ui components).
// Empty string when month or day is missing. sector-map and macro-crossroads keep their own
// variants on purpose (different input handling).
export function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}
