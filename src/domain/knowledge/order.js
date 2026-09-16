/**
 * Locale-independent UTF-16 code-unit ordering for generated artifacts.
 * `localeCompare` depends on the host ICU build and can reorder Korean,
 * punctuation, and Latin aliases differently on Windows and Linux.
 */
export function compareStableText(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}
