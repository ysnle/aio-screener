// What qualifies a record's P/E and P/B, read from its own PIT observations: one-off gains inside the P/E numerator and
// the common equity of the latest reported balance sheet. Producer-side (the observations are not shipped to the page):
// the normalizer and the SEC ledger's publish-time heal write the two fields on the record, and every consumer reads
// them from there. Kept apart from sec-earnings.js, which the browser loads at boot.
import { finiteFact as finite, isQuarterSpan, isQuarterGap } from './period.js';
import { anchorConcept, anchorConceptRows, discreteQuarterSeries, trailingFourQuarters, SEC_FIELD_CONCEPT_PREFERENCE } from './sec-earnings.js';

const rowEnd = (row) => row?.periodEnd ?? row?.end ?? null;
const rowStart = (row) => row?.periodStart ?? row?.start ?? null;
const rowValue = (row) => finite(row?.value ?? row?.val);
const rowFiled = (row) => String(row?.filedAt ?? row?.filed ?? '');
const usableRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => row && rowEnd(row) && rowValue(row) != null);

// One-off gains inside the P/E numerator. GAAP net income carries investment gains, disposal gains and tax releases
// (GOOGL 2026-06 quarter: net income 112.2B on 119.8B revenue against a 32% usual margin), so a P/E on it reads low.
// A quarter is flagged when its net margin is over twice the median of the last eight quarters (and 5 points above it),
// the same quarter a year earlier was not (a seasonal peak repeats), and either its net income exceeds its operating
// income, or that year-ago quarter is on file and the margin fell back at least halfway the next quarter (an operating
// upswing persists; MU and SNDK are not flagged).
export const ONE_OFF_MARGIN_MULTIPLE = 2;
export const ONE_OFF_MIN_EXCESS = 0.05;
export const ONE_OFF_MIN_QUARTERS = 6;
export const ONE_OFF_REVERT_SHARE = 0.5;
const medianOf = (values) => { const sorted = [...values].sort((a, b) => a - b); const mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const dayGap = (a, b) => (Date.parse(a) - Date.parse(b)) / 86400000;

/** Period ends of the last `span` quarters that carry a one-off gain. quarters: [{ periodEnd, revenue, netIncome, operatingIncome? }], oldest first. */
export function oneOffQuarters(quarters, span = 4) {
  const rows = (Array.isArray(quarters) ? quarters : []).filter((q) => q?.periodEnd && finite(q.revenue) > 0 && finite(q.netIncome) != null).slice(-8);
  if (rows.length < ONE_OFF_MIN_QUARTERS) return [];
  const margin = (q) => q.netIncome / q.revenue;
  const usual = Math.max(medianOf(rows.map(margin)), 0);
  const spike = (q) => q.netIncome > 0 && margin(q) > usual * ONE_OFF_MARGIN_MULTIPLE && margin(q) - usual >= ONE_OFF_MIN_EXCESS;
  return rows.slice(-span).filter((q) => {
    if (!spike(q)) return false;
    const index = rows.indexOf(q);
    const yearAgo = rows.find((other) => Math.abs(dayGap(q.periodEnd, other.periodEnd) - 365) <= 20);
    if (yearAgo && spike(yearAgo)) return false;
    if (finite(q.operatingIncome) != null && q.netIncome > q.operatingIncome) return true;
    // A margin that fell back is a one-off only when the same quarter a year earlier is on file and was ordinary:
    // without it a seasonal or cyclical peak (winter gas, a recovery quarter, a miner's coin mark) reads the same.
    // Fell back means at least halfway to the usual margin; a margin that stays near the peak is a recovery.
    const next = rows[index + 1];
    return Boolean(yearAgo) && Boolean(next) && isQuarterGap(dayGap(next.periodEnd, q.periodEnd)) && !spike(next)
      && margin(next) <= usual + (margin(q) - usual) * ONE_OFF_REVERT_SHARE;
  }).map((q) => q.periodEnd);
}

// One revenue row per period for the margin base: the largest tagged total (a customer-contract subtotal never exceeds it).
function largestPerPeriod(rows) {
  const byPeriod = new Map();
  for (const row of usableRows(rows)) {
    const key = `${rowStart(row) || ''}|${rowEnd(row)}`;
    const prev = byPeriod.get(key);
    if (!prev || rowValue(row) > rowValue(prev)) byPeriod.set(key, row);
  }
  return [...byPeriod.values()];
}

/** One-off quarters among the four quarters ending at the record's P/E numerator end, or null. */
export function secEarningsOneOff(record) {
  const observations = record?.pit?.observations;
  const through = String(record?.peEarnings?.through || record?.observedAt || '').slice(0, 10);
  if (!observations || !through || (record.reportingCurrency && record.reportingCurrency !== 'USD')) return null;
  const concept = anchorConcept(observations.netIncomeQ, SEC_FIELD_CONCEPT_PREFERENCE.netIncome);
  const sameConcept = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => row.concept === concept);
  const income = discreteQuarterSeries(sameConcept(observations.netIncomeQ), sameConcept(observations.netIncome)).filter((q) => q.periodEnd <= through);
  const four = trailingFourQuarters(income);
  // A loss over the four quarters has no P/E for a gain to lower (a miner's coin mark inside a losing year).
  if (!four || income.at(-1).periodEnd !== through || !(four.reduce((sum, q) => sum + q.value, 0) > 0)) return null;
  const valuesByEnd = (series) => new Map(series.map((q) => [q.periodEnd, q.value]));
  const revenue = valuesByEnd(discreteQuarterSeries(largestPerPeriod(observations.revenueQ), largestPerPeriod(observations.revenue)));
  const operating = valuesByEnd(discreteQuarterSeries(anchorConceptRows(observations.operatingIncomeQ, SEC_FIELD_CONCEPT_PREFERENCE.operatingIncome), anchorConceptRows(observations.operatingIncome, SEC_FIELD_CONCEPT_PREFERENCE.operatingIncome)));
  const priced = new Set(income.slice(-4).map((q) => q.periodEnd));
  const flagged = oneOffQuarters(income.map((q) => ({ periodEnd: q.periodEnd, netIncome: q.value, revenue: revenue.get(q.periodEnd) ?? null, operatingIncome: operating.get(q.periodEnd) ?? null })))
    .filter((periodEnd) => priced.has(periodEnd));
  return flagged.length ? flagged : null;
}

// The P/B denominator: common equity on the latest reported balance sheet. The fiscal year-end total is up to 15 months
// behind the price (a year of retained earnings: the last four quarters' income is 15% of year-end equity at the median
// issuer, 57% at GOOGL) and carries preferred stock (banks). Returns null when neither a later quarter-end nor a
// preferred line is on file, so the record's own year-end equity stays the basis.
export function secPbEquity(record) {
  const observations = record?.pit?.observations;
  const fiscalEnd = String(record?.observedAt || '').slice(0, 10);
  const current = finite(record?.equity);
  if (!observations || !fiscalEnd || current == null || (record.reportingCurrency && record.reportingCurrency !== 'USD')) return null;
  const newest = (rows) => rows.sort((a, b) => String(rowEnd(b)).localeCompare(String(rowEnd(a))) || rowFiled(b).localeCompare(rowFiled(a)))[0] || null;
  const yearEnd = (Array.isArray(observations.equity) ? observations.equity : []).filter((row) => rowEnd(row) === fiscalEnd && rowValue(row) === current);
  const concept = newest(yearEnd)?.concept || record.equityConcept || null;
  const later = concept ? newest(usableRows(observations.equityQ).filter((row) => row.concept === concept && !rowStart(row) && rowEnd(row) > fiscalEnd)) : null;
  const periodEnd = later ? rowEnd(later) : fiscalEnd;
  const preferred = rowValue(newest(usableRows(observations.preferredQ).filter((row) => !rowStart(row) && rowEnd(row) === periodEnd)));
  if (!later && !(preferred > 0)) return null;
  const total = later ? rowValue(later) : current;
  return { value: preferred > 0 ? total - preferred : total, periodEnd, ...(preferred > 0 ? { preferred } : {}) };
}

// The P/E numerator ends before the newest quarter on file: the four-quarter chain could not be formed (a quarter is
// missing, or the periods do not cover one year), so the P/E is priced on older earnings than the filings hold.
// Returns { laterQuarter, reason } or null; the row carries it so the figure never reads as current.
export function secPeEarningsLag(record) {
  const observations = record?.pit?.observations;
  const through = String(record?.peEarnings?.through || record?.observedAt || '').slice(0, 10);
  if (!observations || !through || (record.reportingCurrency && record.reportingCurrency !== 'USD')) return null;
  const quarterEnds = [observations.netIncomeQ, observations.netIncomeCommonQ].flatMap(usableRows)
    .filter((row) => rowStart(row) && isQuarterSpan(dayGap(rowEnd(row), rowStart(row)))).map(rowEnd).sort();
  const laterQuarter = quarterEnds.at(-1);
  return laterQuarter > through ? { laterQuarter, reason: 'quarter-chain-incomplete' } : null;
}

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const VALUATION_FIELDS = Object.freeze({ earningsOneOff: secEarningsOneOff, pbEquity: secPbEquity, peEarningsLag: secPeEarningsLag });

// Writes earningsOneOff, pbEquity and peEarningsLag on a record from its PIT observations (idempotent; run after the
// earnings-basis heal, whose peEarnings names the P/E numerator). A record without observations keeps what its producer wrote.
export function reconcileSecValuationBasis(record) {
  if (!record || typeof record !== 'object' || !record.pit?.observations) return record;
  const next = Object.fromEntries(Object.entries(VALUATION_FIELDS).map(([key, read]) => [key, read(record) || undefined]));
  if (sameJson(Object.fromEntries(Object.keys(VALUATION_FIELDS).map((key) => [key, record[key]])), next)) return record;
  const healed = { ...record };
  for (const key of Object.keys(VALUATION_FIELDS)) { if (next[key] == null) delete healed[key]; else healed[key] = next[key]; }
  return healed;
}
