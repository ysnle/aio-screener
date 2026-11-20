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
import { finiteFact as finite, isPriorAnnualPeriod, isQuarterSpan, isQuarterGap } from './period.js';

export const SEC_COMMON_INCOME_CONCEPT = 'NetIncomeLossAvailableToCommonStockholdersBasic';
// The first concept of each list is the anchor when several report the latest period.
// v58.55: R&D expense as filed, in preference order. The acquired in-process R&D variants are the same line without
// purchased IPR&D; the plain concept is preferred, the software variant is the last fallback. ResearchAndDevelopmentInProcess
// (purchased IPR&D alone) is not ongoing R&D and is not read.
export const SEC_RD_CONCEPTS = Object.freeze(['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost', 'ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost']);
// v58.75 (persona review): US-GAAP concepts for the margin ladder, net cash and capital return, in preference order. Cash is
// cash and equivalents only (restricted cash is a different total); short-term investments are read as their own column.
export const SEC_CAPITAL_CONCEPTS = Object.freeze({
  grossProfit: ['GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  shortTermInvestments: ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
  shareBasedCompensation: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  dividends: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock']
});
// The IFRS lines for the same items (an IFRS filer has no separate short-term investments concept here).
export const SEC_IFRS_CAPITAL_CONCEPTS = Object.freeze({ grossProfit: ['GrossProfit'], operatingIncome: ['ProfitLossFromOperatingActivities'], cash: ['CashAndCashEquivalents'], shortTermInvestments: [],
  shareBasedCompensation: ['AdjustmentsForSharebasedPayments'], buybacks: ['PaymentsToAcquireOrRedeemEntitysShares'], dividends: ['DividendsPaidClassifiedAsFinancingActivities'] });
// Noncurrent long-term debt plus the current portion of the same filing, for a filer that tags no LongTermDebt total.
export const SEC_TOTAL_DEBT_DERIVED_CONCEPT = 'derived:LongTermDebtTotal';
// The same pairing on the lease-inclusive lines (LongTermDebtAndCapitalLeaseObligations + its current portion).
export const SEC_DEBT_AND_LEASE_DERIVED_CONCEPT = 'derived:LongTermDebtAndLeaseTotal';
// 2026-11-18 (debt coverage): 304 of 795 issuers had no latest-year debt because they tag only the lease-inclusive debt lines
// (AVGO FY2022+, CVX, KO...). Those lines are read after the debt-only ones and carry their basis: a series anchored on one
// says 'lease-inclusive' (finance-lease obligations inside the figure). Instrument-level concepts (DebtInstrumentCarryingAmount,
// SeniorNotes, LongTermNotesPayable, UnsecuredDebt) are not read: companyfacts drops the instrument dimension, so one
// tranche cannot be told from the total. DebtLongtermAndShorttermCombinedAmount is not read either (short-term borrowings in).
export const SEC_DEBT_LEASE_CONCEPTS = Object.freeze(['LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities', SEC_DEBT_AND_LEASE_DERIVED_CONCEPT, 'LongTermDebtAndCapitalLeaseObligations']);
export const secDebtBasis = (concept) => (concept == null ? null : SEC_DEBT_LEASE_CONCEPTS.includes(concept) ? 'lease-inclusive' : 'long-term');
// Whether the debt figure includes the part due within a year. us-gaap sums each total from a noncurrent line and its
// current portion (LongTermDebt = LongTermDebtNoncurrent + LongTermDebtCurrent; the lease-inclusive total likewise, and the
// derived totals are those sums, sec-normalize DEBT_DERIVED_PAIRS); only the two noncurrent lines leave the current part out.
export const SEC_DEBT_NONCURRENT_CONCEPTS = Object.freeze(['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations']);
export const secDebtCurrentCoverage = (concept) => (concept == null ? null : SEC_DEBT_NONCURRENT_CONCEPTS.includes(concept) ? 'excluded' : 'included');
/** The reader's name for the debt figure on each basis (sec-fiscal-history.json debtBasis). */
export const DEBT_BASIS_LABEL = Object.freeze({ 'long-term': '장기부채', 'lease-inclusive': '장기부채(리스 포함)' });
export const debtLabel = (basis) => DEBT_BASIS_LABEL[basis] || DEBT_BASIS_LABEL['long-term'];
// A total tagged below one of its own parts on the same date is a partial and never anchors (TSCO LongTermDebt 150M
// against 1,765M noncurrent).
const SEC_CONCEPT_PARTS = Object.freeze({
  LongTermDebt: ['LongTermDebtNoncurrent'],
  LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities: ['LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtNoncurrent'],
  LongTermDebtAndCapitalLeaseObligations: ['LongTermDebtNoncurrent']
});
// A period the anchor concept never reported is filled only from a concept of the same basis, so a debt series never
// steps between lease-inclusive and debt-only figures year to year (fields without a basis keep the plain D6 fill).
const conceptFamily = (concept) => (SEC_DEBT_LEASE_CONCEPTS.includes(concept) ? 'lease-inclusive' : '');
export const SEC_FIELD_CONCEPT_PREFERENCE = Object.freeze({
  netIncome: ['NetIncomeLoss', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'CashFlowsFromUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  // Total debt first: LongTermDebt carries the current portion (MSFT FY2026 40,294M against 31,067M noncurrent); then the
  // lease-inclusive lines in the same total → derived total → noncurrent order.
  longTermDebt: ['LongTermDebt', SEC_TOTAL_DEBT_DERIVED_CONCEPT, 'LongTermDebtNoncurrent', ...SEC_DEBT_LEASE_CONCEPTS],
  researchAndDevelopment: SEC_RD_CONCEPTS,
  ...Object.fromEntries(Object.entries(SEC_CAPITAL_CONCEPTS).map(([field, list]) => [field, [...list, ...(SEC_IFRS_CAPITAL_CONCEPTS[field] || [])]]))
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
  const latest = list.filter((row) => rowEnd(row) === latestEnd)
    .sort((a, b) => rank(a.concept) - rank(b.concept) || rowFiled(b).localeCompare(rowFiled(a)));
  const partial = (row) => (SEC_CONCEPT_PARTS[row.concept] || []).some((part) => latest.some((other) => other.concept === part && rowValue(other) > rowValue(row)));
  return (latest.find((row) => !partial(row)) || latest[0]).concept ?? null;
}
export function anchorConceptRows(rows, preference = []) {
  const list = usableRows(rows);
  if (!list.length) return [];
  const anchor = anchorConcept(list, preference);
  const key = (row) => `${rowStart(row) || ''}|${rowEnd(row)}`;
  const covered = new Set(list.filter((row) => row.concept === anchor).map(key));
  const family = conceptFamily(anchor);
  return list.filter((row) => row.concept === anchor || (!covered.has(key(row)) && conceptFamily(row.concept) === family));
}

// Discrete quarters (latest filing per period end), plus a fourth quarter derived from a fiscal year (330+ days) that
// contains exactly three of them. Sorted oldest first. A quarter is 77–119 days: 12- and 16-week fiscal quarters
// (Kroger, Costco, AutoZone, CAVA) count beside the 13/14-week ones.
export function discreteQuarterSeries(quarterRows, annualRows = []) {
  const byEnd = new Map();
  for (const row of Array.isArray(quarterRows) ? quarterRows : []) {
    if (rowValue(row) == null || !rowStart(row) || !isQuarterSpan(durationDays(row))) continue;
    const prev = byEnd.get(rowEnd(row));
    if (!prev || rowFiled(row) > rowFiled(prev)) byEnd.set(rowEnd(row), row);
  }
  const series = new Map([...byEnd].map(([end, row]) => [end, { periodEnd: end, value: rowValue(row), derived: false, concept: row.concept || null, availableAt: rowAvailable(row), days: durationDays(row) }]));
  const fiscal = new Map();
  for (const row of Array.isArray(annualRows) ? annualRows : []) {
    if (rowValue(row) == null || !rowStart(row) || !(durationDays(row) >= 330) || (row.fiscalPeriod && row.fiscalPeriod !== 'FY') || (row.fp && row.fp !== 'FY')) continue;
    const prev = fiscal.get(rowEnd(row));
    if (!prev || rowFiled(row) > rowFiled(prev)) fiscal.set(rowEnd(row), row);
  }
  // 2026-10-19 data audit: LHX's fourth quarters were published at the full-year revenue (21,865 against ~5.6k quarters)
  // — a three-month row carrying the fiscal-year amount. A "quarter" worth 90%+ of the year ending the same day is the
  // year, so it is dropped and the quarter is derived as FY − Q1..Q3 below.
  for (const [end, fy] of fiscal) {
    const q = byEnd.get(end);
    if (q && rowValue(fy) > 0 && rowValue(q) >= rowValue(fy) * 0.9) { byEnd.delete(end); series.delete(end); }
  }
  for (const [end, fy] of fiscal) {
    if (series.has(end)) continue;
    const inside = [...byEnd.values()].filter((row) => rowEnd(row) > rowStart(fy) && rowEnd(row) < end);
    if (inside.length !== 3) continue;
    const days = durationDays(fy) - inside.reduce((sum, row) => sum + durationDays(row) + 1, 0);
    // The remainder of the year must itself be a quarter (a year holding three quarters and a gap is not netted).
    if (!isQuarterSpan(days)) continue;
    series.set(end, { periodEnd: end, value: rowValue(fy) - inside.reduce((sum, row) => sum + rowValue(row), 0), derived: true, concept: fy.concept || null, availableAt: latestIso([rowAvailable(fy), ...inside.map(rowAvailable)]), days });
  }
  return [...series.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

// The last four quarters when they are consecutive (period.js isQuarterGap) and together cover one year: 350–380 days,
// so four periods that overlap or leave a hole (a mis-tagged half-year) never sum to a TTM.
export function trailingFourQuarters(series) {
  const last = (Array.isArray(series) ? series : []).slice(-4);
  if (last.length !== 4) return null;
  for (let i = 1; i < 4; i += 1) {
    if (!isQuarterGap((Date.parse(last[i].periodEnd) - Date.parse(last[i - 1].periodEnd)) / 86400000)) return null;
  }
  const covered = last.reduce((sum, q) => sum + q.days + 1, 0);
  return covered >= 350 && covered <= 380 ? last : null;
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
  const net = trailingEarnings(observations.netIncomeQ, observations.netIncome, fiscalEnd, SEC_FIELD_CONCEPT_PREFERENCE.netIncome);
  // The newer four quarters price the P/E; common earnings win only when they run as late as net income
  // (PLD tagged common earnings through 2026-03 with net income filed through 2026-09).
  if (common && !(net?.through > common.through)) return { basis: 'ttm', concept: 'common', ...common };
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
