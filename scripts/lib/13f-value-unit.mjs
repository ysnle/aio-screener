// One rule for the unit of a 13F information table's <value> column, decided per filing from the filing's own rows.
//
// Form 13F asked for value in thousands of dollars until the 2023 form change and in whole dollars since. Some filers
// still report thousands (T. Rowe Price, Duquesne, Baupost), and the cover's tableValueTotal follows the same unit, so
// the cover cannot tell. The rows can: value / shares is the implied price per share. A dollar-unit filing of listed
// equities has a median implied price in the tens of dollars; the same filing in thousands has a median 1000x lower.
//
// Rule: over the plain share rows (sshPrnamtType SH, no put/call, shares > 0, value > 0), when at least
// MIN_SAMPLE_ROWS rows exist and the median implied price is in [THOUSANDS_MEDIAN_FLOOR, THOUSANDS_MEDIAN_CEILING),
// the filing is read as USD thousands and its row values and cover value total are multiplied by 1000.
// The floor keeps a broken or principal-only table from being scaled; the ceiling of $1 means a dollar filing flips only
// when more than half its share rows are sub-dollar stocks. After scaling the median is at least $1, so the rule is
// idempotent: applying it to rows it already scaled leaves them unchanged.
import { readNumber } from '../../src/domain/shared/number.js';

export const MIN_SAMPLE_ROWS = 3;
export const THOUSANDS_MEDIAN_FLOOR = 0.001;
export const THOUSANDS_MEDIAN_CEILING = 1;
export const THOUSANDS_MULTIPLIER = 1000;

const isShareRow = (row) => String(row?.shareType || '').trim().toUpperCase() === 'SH'
  && !String(row?.putCall || '').trim()
  && Number(row?.shares) > 0
  && Number(row?.value) > 0;

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Which unit a filing's rows were reported in, with the evidence the decision rests on. */
export function detectValueUnit(rows) {
  const sample = (rows || []).filter(isShareRow);
  const medianImpliedPrice = median(sample.map((row) => Number(row.value) / Number(row.shares)));
  const thousands = sample.length >= MIN_SAMPLE_ROWS && medianImpliedPrice != null
    && medianImpliedPrice >= THOUSANDS_MEDIAN_FLOOR && medianImpliedPrice < THOUSANDS_MEDIAN_CEILING;
  return {
    reportedUnit: thousands ? 'USD_THOUSANDS' : 'USD',
    multiplier: thousands ? THOUSANDS_MULTIPLIER : 1,
    basis: 'MEDIAN_IMPLIED_PRICE_OF_SHARE_ROWS',
    medianImpliedPrice,
    sampleRows: sample.length
  };
}

/**
 * A filing bundle ({ rows, cover, ... }) with values in whole dollars. The decision is returned as `valueUnit`;
 * the cover's tableValueTotal is scaled with the rows so value reconciliation keeps comparing like with like.
 */
export function normalizeFilingValueUnit(bundle) {
  const valueUnit = detectValueUnit(bundle?.rows);
  if (valueUnit.multiplier === 1) return { ...bundle, valueUnit };
  const scale = (value) => { const number = readNumber(value); return number == null ? value : number * valueUnit.multiplier; };
  return {
    ...bundle,
    rows: (bundle.rows || []).map((row) => ({ ...row, value: scale(row.value) })),
    cover: bundle.cover ? { ...bundle.cover, tableValueTotal: scale(bundle.cover.tableValueTotal) } : bundle.cover,
    valueUnit
  };
}
