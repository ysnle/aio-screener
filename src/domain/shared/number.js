// v57.60: the strict "already a finite number" reader that ~30 modules declared locally as `finite`.
// Strings, booleans, null and NaN/Infinity all return null — no Number() coercion. Modules whose
// local `finite` coerces strings keep their own copy (different behaviour).
export function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
