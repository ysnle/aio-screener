// v57.60: shared "M/D" label for ISO dates (was copied into market-read and eight ui components).
// Empty string when month or day is missing. sector-map and macro-crossroads keep their own
// variants on purpose (different input handling).
// v59.70 (screen review #35): one month label for chart ends and January ticks ("26년 1월"); the sparkline ends read
// "25.10" while the trend charts read "26년 1월".
export function monthLabel(date) {
  const text = String(date || '');
  const month = Number(text.slice(5, 7));
  return /^\d{4}-\d{2}/.test(text) && month ? `${text.slice(2, 4)}년 ${month}월` : '';
}

export function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}
