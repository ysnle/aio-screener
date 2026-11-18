// When a printed figure or word agrees with the value it stands for. One set of rules for every checker that holds text
// against data: the AI answer's figure check (src/ai/response/publication.js), the AI claim ledger
// (src/ai/response/claim-ledger.js), the market-reading validator (scripts/lib/market-analysis-validate.mjs) and the
// sentence-claim checker (scripts/lib/claim-validate.mjs). Pure functions; nothing here reads text.

const decimals = (value) => (String(value).split('.')[1] || '').length;

/**
 * A figure printed as `written` (its absolute value, with `places` decimals) stands for `value` when it is the value as
 * written or the value rounded to those places (180.25 → "180.25", "180.3", "180"). A rounded print never stands for a
 * value with fewer decimals than it shows.
 */
export function printedValueAgrees(written, places, value) {
  const size = Math.abs(value);
  return written === size || (decimals(size) > places && Number(size.toFixed(places)) === written);
}

/** A printed sign (+1, -1, or 0 for none) agrees unless the value moved the other way; a value printed unsigned agrees either way. */
export const signAgrees = (sign, value, signed = true) => !(sign && value !== 0 && signed !== false && sign !== Math.sign(value));

/** A direction word (+1 up, -1 down) agrees with a change unless the change moved the other way; no direction or no change agrees. */
export const directionAgrees = (direction, value) => !(direction && Number.isFinite(value) && value !== 0 && direction !== Math.sign(value));

/**
 * A printed day ('YYYY-MM-DD', or the year-less ISO form '--MM-DD' of an "11/12" print) names the data day `day`
 * ('YYYY-MM-DD'): the same day, or the same month and day when the print has no year.
 */
export function dayAgrees(printed, day) {
  const text = String(printed || ''), want = String(day || '');
  return !!text && !!want && (text === want || (text.charAt(0) === '-' && text.slice(1) === want.slice(4)));
}

/**
 * A size word against the move's grade (src/domain/market/session/move-size.js moveGrade): a large-move word (급등, 큰 폭)
 * needs a large grade, a small-move word (소폭, 보합) may not stand on one. `kind` is 'large' or 'small'; with no grade no
 * size can be judged and the word stands.
 */
export const sizeWordAgrees = (kind, grade) => !grade || !((kind === 'large' && grade !== 'large') || (kind === 'small' && grade === 'large'));

/** What a numeric claim needs to be traced: its value, its unit and the date of its data. */
export function numericFieldsMissing({ value, unit, asOf } = {}) {
  const missing = [];
  if (typeof value !== 'number' || !Number.isFinite(value)) missing.push('numeric_value_missing');
  if (!unit) missing.push('unit_missing');
  if (!asOf) missing.push('as_of_missing');
  return missing;
}
