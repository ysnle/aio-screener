// 2026-10-17 (logic audit D1/D2/D6/D7, owner-approved recommendations): the earnings and equity bases that price P/E and
// ROE, read from a record's own PIT observations so the producer, the page projection, the screener merge and the
// browser's out-of-universe read share one rule.
//  D6 — a field's series keeps one XBRL concept: the concept of its latest period, falling back to another concept
//       only for a period that concept never reported (EXEL/MTCH LongTermDebt vs LongTermDebtNoncurrent, AVB/MDLN
//       NetIncomeLoss vs ProfitLoss mixed the year-over-year read).
//  D1 — P/E is priced on the last four consecutive quarters (TTM) when they end after the fiscal year; a fourth
//       quarter only filed inside the 10-K is derived as FY − Q1..Q3. Otherwise the fiscal year.
//  D7 — the P/E numerator is earnings available to common stockholders when the filer tags it for every period used
//       (preferred dividends and participating securities removed); otherwise net income.
//  D2 — ROE is net income over the average of the prior and current fiscal year-end equity (same concept); a missing
//       or non-positive prior year falls back to year-end equity and says so (roeBasis 'year-end-equity').
import { finiteFact as finite, isPriorAnnualPeriod } from './period.js';

export const SEC_EARNINGS_BASIS_VERSION = 'sec-earnings-basis.2026-10-17';
export const SEC_COMMON_INCOME_CONCEPT = 'NetIncomeLossAvailableToCommonStockholdersBasic';
// The first concept of each list is the anchor when several report the latest period.
export const SEC_FIELD_CONCEPT_PREFERENCE = Object.freeze({
  netIncome: ['NetIncomeLoss', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'CashFlowsFromUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  longTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt']
});

const rowEnd = (row) => row?.periodEnd ?? row?.end ?? null;
const rowStart = (row) => row?.periodStart ?? row?.start ?? null;
const rowValue = (row) => finite(row?.value ?? row?.val);
const rowFiled = (row) => String(row?.filedAt ?? row?.filed ?? '');
const rowAvailable = (row) => row?.acceptedAt || row?.effectiveAt || row?.filedAt || row?.filed || null;
const durationDays = (row) => (Date.parse(rowEnd(row) || '') - Date.parse(rowStart(row) || '')) / 86400000;
const latestIso = (values) => values.filter(Boolean).sort().pop() || null;

// D6: rows of one field reduced to the anchor concept wherever that concept reported the period.
const usableRows = (rows) => (Array.isArray(rows) ? rows : []).filter((row) => row && rowEnd(row) && rowValue(row) != null);
export function anchorConcept(rows, preference = []) {
  const list = usableRows(rows);
  if (!list.length) return null;
  const rank = (concept) => { const index = preference.indexOf(concept); return index < 0 ? preference.length : index; };
  const latestEnd = list.reduce((max, row) => (rowEnd(row) > max ? rowEnd(row) : max), '');
  return list.filter((row) => rowEnd(row) === latestEnd)
    .sort((a, b) => rank(a.concept) - rank(b.concept) || rowFiled(b).localeCompare(rowFiled(a)))[0].concept ?? null;
}
export function anchorConceptRows(rows, preference = []) {
  const list = usableRows(rows);
  if (!list.length) return [];
  const anchor = anchorConcept(list, preference);
  const key = (row) => `${rowStart(row) || ''}|${rowEnd(row)}`;
  const covered = new Set(list.filter((row) => row.concept === anchor).map(key));
  return list.filter((row) => row.concept === anchor || !covered.has(key(row)));
}

// Discrete quarters (80–100 days, latest filing per period end), plus a fourth quarter derived from a fiscal year
// (330+ days) that contains exactly three of them. Sorted oldest first.
export function discreteQuarterSeries(quarterRows, annualRows = []) {
  const byEnd = new Map();
  for (const row of Array.isArray(quarterRows) ? quarterRows : []) {
    const days = durationDays(row);
    if (rowValue(row) == null || !rowStart(row) || !(days >= 80 && days <= 100)) continue;
    const prev = byEnd.get(rowEnd(row));
    if (!prev || rowFiled(row) > rowFiled(prev)) byEnd.set(rowEnd(row), row);
  }
  const series = new Map([...byEnd].map(([end, row]) => [end, { periodEnd: end, value: rowValue(row), derived: false, concept: row.concept || null, availableAt: rowAvailable(row) }]));
  const fiscal = new Map();
  for (const row of Array.isArray(annualRows) ? annualRows : []) {
    if (rowValue(row) == null || !rowStart(row) || !(durationDays(row) >= 330) || (row.fiscalPeriod && row.fiscalPeriod !== 'FY') || (row.fp && row.fp !== 'FY')) continue;
    const prev = fiscal.get(rowEnd(row));
    if (!prev || rowFiled(row) > rowFiled(prev)) fiscal.set(rowEnd(row), row);
  }
  for (const [end, fy] of fiscal) {
    if (series.has(end)) continue;
    const inside = [...byEnd.values()].filter((row) => rowEnd(row) > rowStart(fy) && rowEnd(row) < end);
    if (inside.length !== 3) continue;
    series.set(end, { periodEnd: end, value: rowValue(fy) - inside.reduce((sum, row) => sum + rowValue(row), 0), derived: true, concept: fy.concept || null, availableAt: latestIso([rowAvailable(fy), ...inside.map(rowAvailable)]) });
  }
  return [...series.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

// The last four quarters when they are consecutive (period ends 75–105 days apart, 52/53-week years included).
export function trailingFourQuarters(series) {
  const last = (Array.isArray(series) ? series : []).slice(-4);
  if (last.length !== 4) return null;
  for (let i = 1; i < 4; i += 1) {
    const gap = (Date.parse(last[i].periodEnd) - Date.parse(last[i - 1].periodEnd)) / 86400000;
    if (!(gap >= 75 && gap <= 105)) return null;
  }
  return last;
}

function trailingEarnings(quarterRows, annualRows, fiscalEnd, preference) {
  const quarters = usableRows(quarterRows);
  if (!quarters.length) return null;
  const concept = anchorConcept(quarters, preference);
  // The derived fourth quarter must come from the same concept as the three it is netted against.
  const four = trailingFourQuarters(discreteQuarterSeries(quarters.filter((row) => row.concept === concept), (annualRows || []).filter((row) => row.concept === concept)));
  if (!four || !(four[3].periodEnd > fiscalEnd)) return null;
  return { value: four.reduce((sum, q) => sum + q.value, 0), through: four[3].periodEnd, availableAt: latestIso(four.map((q) => q.availableAt)), derivedQuarter: four.some((q) => q.derived) };
}

// D1/D7: the P/E numerator. Returns null when the fiscal year's own net income is the basis (the record's netIncome).
export function secPeEarnings(record) {
  const observations = record?.pit?.observations;
  const fiscalEnd = String(record?.observedAt || '').slice(0, 10);
  if (!observations || !fiscalEnd || (record.reportingCurrency && record.reportingCurrency !== 'USD')) return null;
  const common = trailingEarnings(observations.netIncomeCommonQ, observations.netIncomeCommon, fiscalEnd, [SEC_COMMON_INCOME_CONCEPT]);
  if (common) return { basis: 'ttm', concept: 'common', ...common };
  const net = trailingEarnings(observations.netIncomeQ, observations.netIncome, fiscalEnd, SEC_FIELD_CONCEPT_PREFERENCE.netIncome);
  if (net) return { basis: 'ttm', concept: 'net-income', ...net };
  const fyCommon = (Array.isArray(observations.netIncomeCommon) ? observations.netIncomeCommon : [])
    .filter((row) => rowEnd(row) === fiscalEnd && durationDays(row) >= 300 && rowValue(row) != null)
    .sort((a, b) => rowFiled(b).localeCompare(rowFiled(a)))[0];
  return fyCommon ? { basis: 'fy', concept: 'common', value: rowValue(fyCommon), through: fiscalEnd, availableAt: rowAvailable(fyCommon), derivedQuarter: false } : null;
}

// D2: the prior fiscal year-end equity of the same concept as the current one.
export function secPriorEquity(record) {
  const rows = Array.isArray(record?.pit?.observations?.equity) ? record.pit.observations.equity : [];
  const fiscalEnd = String(record?.observedAt || '').slice(0, 10);
  const current = finite(record?.equity) ?? finite(record?.reportedAmounts?.equity);
  if (!rows.length || !fiscalEnd || current == null) return null;
  const currentRow = rows.filter((row) => rowEnd(row) === fiscalEnd && rowValue(row) === current).sort((a, b) => rowFiled(b).localeCompare(rowFiled(a)))[0];
  const concept = currentRow?.concept || record.equityConcept || null;
  const prior = rows.filter((row) => (!concept || row.concept === concept) && rowValue(row) != null && isPriorAnnualPeriod({ periodEnd: fiscalEnd }, row))
    .sort((a, b) => String(rowEnd(b)).localeCompare(String(rowEnd(a))) || rowFiled(b).localeCompare(rowFiled(a)))[0];
  return prior ? { value: rowValue(prior), periodEnd: rowEnd(prior) } : null;
}

const round1 = (value) => Math.round(value * 10) / 10;
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Heals a record from its PIT observations (idempotent). A record without observations (the compact extended ledger)
// keeps the fields its producer wrote.
export function reconcileSecEarningsBasis(record) {
  if (!record || typeof record !== 'object' || !record.pit?.observations) return record;
  const peEarnings = secPeEarnings(record);
  const netIncome = finite(record.netIncome) ?? finite(record.reportedAmounts?.netIncome);
  const equity = finite(record.equity) ?? finite(record.reportedAmounts?.equity);
  const prior = secPriorEquity(record);
  // Without both operands the stored ROE fields stay as written.
  let roe = finite(record.roe);
  let roeBasis = record.roeBasis ?? null;
  let equityPrior = finite(record.equityPrior);
  if (netIncome == null || equity == null) { /* keep */ } else if (!(equity > 0)) {
    roe = null; roeBasis = null; equityPrior = null;
  } else if (prior?.value > 0) {
    roe = round1(netIncome / ((equity + prior.value) / 2) * 100);
    roeBasis = 'average-equity';
    equityPrior = prior.value;
  } else {
    roe = round1(netIncome / equity * 100);
    roeBasis = 'year-end-equity';
    equityPrior = null;
  }
  const stored = { peEarnings: record.peEarnings, roe: finite(record.roe), roeBasis: record.roeBasis, equityPrior: finite(record.equityPrior) };
  const next = { peEarnings: peEarnings || undefined, roe, roeBasis, equityPrior };
  if (sameJson(stored, next)) return record;
  const healed = { ...record };
  for (const key of ['peEarnings', 'roeBasis', 'equityPrior']) { if (next[key] == null) delete healed[key]; else healed[key] = next[key]; }
  const coverage = (Array.isArray(record.coverage) ? record.coverage : []).filter((key) => key !== 'roe');
  if (roe == null) delete healed.roe; else { healed.roe = roe; coverage.push('roe'); }
  // The stored fetch-day P/E (P/E × its numerator = the market value it used) moves to the new numerator.
  const storedPe = finite(record.pe);
  const oldEarnings = finite(record.peEarnings?.value) ?? finite(record.netIncome);
  const newEarnings = finite(peEarnings?.value) ?? finite(record.netIncome);
  if (storedPe != null && oldEarnings > 0 && !sameJson(stored.peEarnings, next.peEarnings)) {
    const filtered = coverage.filter((key) => key !== 'pe');
    coverage.length = 0; coverage.push(...filtered);
    if (newEarnings > 0) { healed.pe = Math.round(storedPe * oldEarnings / newEarnings * 100) / 100; coverage.push('pe'); } else delete healed.pe;
  }
  healed.coverage = coverage;
  return healed;
}
