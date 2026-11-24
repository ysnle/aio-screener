import { finiteFact, sameFiscalPeriod, isPriorAnnualPeriod, isQuarterSpan, FUNDAMENTAL_MAX_PERIOD_AGE_DAYS } from './period.js';
import { reconcileSecRevenueShares, bestRevenueRowsByPeriod, shareGapDays, SEC_SHARES_MAX_GAP_DAYS, SEC_MARGIN_HOLD_ABOVE_PCT, FOREIGN_ORDINARY_SHARE_FORMS, SEC_PRIMARY_REVENUE_CONCEPTS, SEC_FALLBACK_REVENUE_CONCEPTS, SEC_BANK_NET_REVENUE_CONCEPT, SEC_IFRS_PRIMARY_REVENUE_CONCEPTS, SEC_IFRS_FALLBACK_REVENUE_CONCEPTS } from './sec-report.js';
import { reconcileSecEarningsBasis, SEC_COMMON_INCOME_CONCEPT, SEC_RD_CONCEPTS, SEC_CAPITAL_CONCEPTS, SEC_IFRS_CAPITAL_CONCEPTS, SEC_TOTAL_DEBT_DERIVED_CONCEPT, SEC_DEBT_AND_LEASE_DERIVED_CONCEPT } from './sec-earnings.js';
import { reconcileSecValuationBasis } from './sec-valuation-basis.js';
export { SEC_RD_CONCEPTS };

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function tickerKey(symbol) {
  return String(symbol || '').toUpperCase().replace(/\./g, '-');
}

function durationDays(row) {
  if (!row || !row.start || !row.end) return null;
  return Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 86400000);
}

function factRows(companyFacts, taxonomy, concepts, unit) {
  const facts = companyFacts && companyFacts.facts && companyFacts.facts[taxonomy];
  if (!facts) return [];
  const collected = [];
  for (const concept of concepts) {
    const conceptRows = facts[concept] && facts[concept].units && facts[concept].units[unit];
    if (Array.isArray(conceptRows) && conceptRows.length) conceptRows.forEach(row => collected.push({ ...row, concept }));
  }
  return collected;
}

const BANK_NET_INTEREST_CONCEPTS = ['InterestIncomeExpenseNet', 'InterestRevenueExpenseNet'];
function bankNetRevenueRows(companyFacts, currency = 'USD') {
  const key = (row) => `${row.accn || ''}|${row.start || ''}|${row.end || ''}|${row.form || ''}|${row.fp || ''}`;
  const nonInterest = new Map(factRows(companyFacts, 'us-gaap', ['NoninterestIncome'], currency).map((row) => [key(row), row]));
  if (!nonInterest.size) return [];
  const netInterest = new Map();
  factRows(companyFacts, 'us-gaap', BANK_NET_INTEREST_CONCEPTS, currency).forEach((row) => { if (!netInterest.has(key(row))) netInterest.set(key(row), row); });
  const rows = [];
  for (const [k, nii] of netInterest) {
    const other = nonInterest.get(k);
    const a = finiteFact(nii.val);
    const b = finiteFact(other?.val);
    if (a == null || b == null) continue;
    rows.push({ ...nii, val: a + b, concept: SEC_BANK_NET_REVENUE_CONCEPT });
  }
  return rows;
}

export const DEBT_DERIVED_PAIRS = Object.freeze([
  ['LongTermDebtNoncurrent', 'LongTermDebtCurrent', SEC_TOTAL_DEBT_DERIVED_CONCEPT],
  ['LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligationsCurrent', SEC_DEBT_AND_LEASE_DERIVED_CONCEPT]
]);
function totalDebtDerivedRows(companyFacts, basis) {
  if (basis.taxonomy !== 'us-gaap') return [];
  const key = (row) => `${row.accn || ''}|${row.end || ''}|${row.form || ''}`;
  const rows = [];
  for (const [noncurrentConcept, currentConcept, derivedConcept] of DEBT_DERIVED_PAIRS) {
    const current = new Map(factRows(companyFacts, 'us-gaap', [currentConcept], basis.currency).filter((row) => !row.start).map((row) => [key(row), row]));
    if (!current.size) continue;
    for (const noncurrent of factRows(companyFacts, 'us-gaap', [noncurrentConcept], basis.currency)) {
      const a = finiteFact(noncurrent.val);
      const b = finiteFact(current.get(key(noncurrent))?.val);
      if (noncurrent.start || a == null || b == null) continue;
      rows.push({ ...noncurrent, val: a + b, concept: derivedConcept });
    }
  }
  return rows;
}

const US_GAAP_BASIS = Object.freeze({ taxonomy: 'us-gaap', currency: 'USD' });
const BASIS_CONCEPTS = Object.freeze({
  'us-gaap': {
    revenue: [...SEC_PRIMARY_REVENUE_CONCEPTS, ...SEC_FALLBACK_REVENUE_CONCEPTS],
    income: ['NetIncomeLoss', 'ProfitLoss'],
    equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    longTermDebt: ['LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities', 'LongTermDebtAndCapitalLeaseObligations'],
    totalAssets: ['Assets'],
    researchAndDevelopment: SEC_RD_CONCEPTS,
    ...SEC_CAPITAL_CONCEPTS,
    inventory: ['InventoryNet'],
    receivables: ['AccountsReceivableNetCurrent'],
    // Preferred stock carried inside stockholders' equity (banks: JPM, BAC); common equity is the P/B denominator.
    preferredEquity: ['PreferredStockValue', 'PreferredStockValueOutstanding']
  },
  // Parent-attributable profit and equity first (the ROE pair), the group totals only when the parent line is absent.
  'ifrs-full': {
    revenue: [...SEC_IFRS_PRIMARY_REVENUE_CONCEPTS, ...SEC_IFRS_FALLBACK_REVENUE_CONCEPTS],
    income: ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
    equity: ['EquityAttributableToOwnersOfParent', 'Equity'],
    operatingCashFlow: ['CashFlowsFromUsedInOperatingActivities'],
    capex: ['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
    longTermDebt: [],
    totalAssets: ['Assets'],
    researchAndDevelopment: ['ResearchAndDevelopmentExpense'],
    ...SEC_IFRS_CAPITAL_CONCEPTS,
    inventory: ['Inventories'],
    receivables: ['TradeAndOtherCurrentReceivables']
  }
});

// An IFRS bank's customer-contract revenue (IFRS 15) is its fee income — interest sits outside IFRS 15 — so it is not
// read as revenue when the filer tags bank fee and commission income (BCS: 11.1B fees against ~29B total income).
const IFRS_BANK_SIGNAL = 'FeeAndCommissionIncomeExpense';
function revenueFactRows(companyFacts, basis = US_GAAP_BASIS) {
  const ifrsBank = basis.taxonomy === 'ifrs-full' && Boolean(companyFacts?.facts?.['ifrs-full']?.[IFRS_BANK_SIGNAL]);
  const rows = factRows(companyFacts, basis.taxonomy, BASIS_CONCEPTS[basis.taxonomy].revenue.filter((concept) => !(ifrsBank && concept === 'RevenueFromContractsWithCustomers')), basis.currency);
  return basis.taxonomy === 'us-gaap' ? [...rows, ...bankNetRevenueRows(companyFacts, basis.currency)] : rows;
}

const isAnnualFy = (row) => { const days = durationDays(row); return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && finiteFact(row.val) != null; };

const revenueRowKey = (row) => `${row.concept || ''}|${row.accn || ''}|${row.start || ''}|${row.end || ''}|${row.val}`;
function fullYearRevenueOnQuarterSpan(companyFacts, basis) {
  const revenueRows = revenueFactRows(companyFacts, basis);
  const annualRevenue = revenueRows.filter(isAnnualFy);
  const annualRevenueEnds = new Set(annualRevenue.map((row) => String(row.end)));
  const yearStart = new Map();
  for (const row of [...annualRevenue, ...factRows(companyFacts, basis.taxonomy, BASIS_CONCEPTS[basis.taxonomy].income, basis.currency).filter(isAnnualFy)]) {
    if (!yearStart.has(String(row.end))) yearStart.set(String(row.end), String(row.start));
  }
  const tenQ = revenueRows.filter((row) => /^10-Q(\/A)?$/.test(row.form || '') && isQuarterSpan(durationDays(row)) && finiteFact(row.val) != null);
  const fullYear = [];
  const recovered = [];
  for (const row of revenueRows) {
    const end = String(row.end || '');
    const start = yearStart.get(end);
    const value = finiteFact(row.val);
    if (!start || value == null || !/^10-K(\/A)?$/.test(row.form || '') || row.fp !== 'FY' || !isQuarterSpan(durationDays(row))) continue;
    const quarters = new Map();
    for (const q of tenQ) {
      if (q.concept !== row.concept || String(q.start) < start || String(q.end) >= end) continue;
      const key = `${q.start}|${q.end}`;
      if (!quarters.has(key) || String(q.filed || '') > String(quarters.get(key).filed || '')) quarters.set(key, q);
    }
    if (quarters.size < 3 || value < [...quarters.values()].reduce((sum, q) => sum + finiteFact(q.val), 0)) continue;
    fullYear.push(row);
    if (!annualRevenueEnds.has(end)) recovered.push({ ...row, start, reportedStart: row.start });
  }
  return { fullYear, recovered };
}

function convenienceTranslationCurrency(companyFacts, usdEnd) {
  const accessions = new Set(revenueFactRows(companyFacts, US_GAAP_BASIS).filter((row) => isAnnualFy(row) && String(row.end) === usdEnd && row.accn).map((row) => row.accn));
  if (!accessions.size) return null;
  const facts = companyFacts?.facts?.['us-gaap'] || {};
  for (const concept of BASIS_CONCEPTS['us-gaap'].revenue) {
    for (const [unit, rows] of Object.entries(facts[concept]?.units || {})) {
      if (unit === 'USD' || !/^[A-Z]{3}$/.test(unit)) continue;
      if ((rows || []).some((row) => accessions.has(row.accn) && String(row.end) === usdEnd && isAnnualFy(row))) return unit;
    }
  }
  return null;
}

export function reportingBasis(companyFacts, nowMs = Date.now()) {
  const latestEnd = (basis) => revenueFactRows(companyFacts, basis).filter(isAnnualFy).reduce((max, row) => (String(row.end) > max ? String(row.end) : max), '');
  const usd = latestEnd(US_GAAP_BASIS);
  const native = usd ? convenienceTranslationCurrency(companyFacts, usd) : null;
  if (native) return Object.freeze({ taxonomy: 'us-gaap', currency: native });
  if (usd && (nowMs - Date.parse(usd)) / 86400000 <= REPORT_RECENCY_MAX_DAYS) return US_GAAP_BASIS;
  let best = usd ? { ...US_GAAP_BASIS, end: usd } : null;
  for (const taxonomy of ['us-gaap', 'ifrs-full']) {
    const facts = companyFacts?.facts?.[taxonomy] || {};
    const currencies = new Set(BASIS_CONCEPTS[taxonomy].revenue.flatMap((concept) => Object.keys(facts[concept]?.units || {})).filter((unit) => /^[A-Z]{3}$/.test(unit)));
    for (const currency of currencies) {
      if (taxonomy === 'us-gaap' && currency === 'USD') continue;
      const end = latestEnd({ taxonomy, currency });
      if (end && (!best || end > best.end)) best = { taxonomy, currency, end };
    }
  }
  return best ? Object.freeze({ taxonomy: best.taxonomy, currency: best.currency }) : US_GAAP_BASIS;
}

// The first concept (in the basis' preference order) that reported the period. US-GAAP keeps its historical selection
// (all concepts pooled, latest filing) so existing records do not move.
function preferredRow(companyFacts, basis, concepts, pick, rowsOf) {
  if (basis.taxonomy === 'us-gaap') return pick(rowsOf(concepts));
  for (const concept of concepts) { const hit = pick(rowsOf([concept])); if (hit) return hit; }
  return null;
}

function dedupeLatestFiled(rows) {
  const byPeriod = new Map();
  rows.forEach(row => {
    const key = `${row.start || ''}|${row.end || ''}|${row.form || ''}|${row.fp || ''}`;
    const prev = byPeriod.get(key);
    if (!prev || String(row.filed || '') > String(prev.filed || '')) byPeriod.set(key, row);
  });
  return [...byPeriod.values()].sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')) || String(b.filed || '').localeCompare(String(a.filed || '')));
}

function annualDurationRows(companyFacts, concepts, basis = US_GAAP_BASIS) {
  const rows = factRows(companyFacts, basis.taxonomy, concepts, basis.currency).filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && finiteFact(row.val) != null;
  });
  return dedupeLatestFiled(rows);
}

function instantRows(companyFacts, taxonomy, concepts, unit) {
  return dedupeLatestFiled(factRows(companyFacts, taxonomy, concepts, unit).filter(row =>
    /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && finiteFact(row.val) != null
  ));
}

function closestEnd(rows, end) {
  return rows.find(row => row.end === end) || null;
}

function acceptedAtByAccession(submissions) {
  const recent = submissions?.filings?.recent || {};
  const accessions = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const accepted = Array.isArray(recent.acceptanceDateTime) ? recent.acceptanceDateTime : [];
  return new Map(accessions.map((accession, index) => [String(accession || ''), accepted[index] || null]));
}

const REPORT_RECENCY_MAX_DAYS = FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
export const SEC_NORMALIZER_VERSION = 'sec-normalizer.2026-11-18';

// The earliest instant a single operand could have been known: its accession acceptance time
// when available, otherwise the filing date (which is a date, not an intraday time).
function pitAvailability(row, acceptedMap) {
  if (!row) return null;
  return acceptedMap.get(String(row.accn || '')) || row.filed || null;
}

function latestIso(values) {
  const times = (values || []).map((value) => Date.parse(value || '')).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/**
 * SEC ticker membership is not a data-capability claim. Foreign issuers often
 * have a SEC ticker entry but publish IFRS facts (or no comparable annual
 * concepts), while this normalizer intentionally consumes a bounded US-GAAP
 * concept set. Classify that boundary before scheduling so terminally
 * unsupported issuers do not occupy every future retry batch.
 */
export const SEC_CONCEPT_SET_VERSION = 'sec-annual-concepts.v7';
// Failure reason codes that a concept-set change can resolve (the scheduler rechecks them once per version).
export const SEC_CONCEPT_SET_REASON_CODES = Object.freeze(['required-us-gaap-annual-concepts-unavailable', 'required-ifrs-annual-concepts-unavailable', 'ifrs-taxonomy-not-supported-by-us-gaap-normalizer']);

export const SEC_SUCCESSOR_ISSUERS = Object.freeze({
  '0002115436': Object.freeze({ predecessorCik: '0000034088', basis: '8-K12B 2026-07-01', version: 'successor.v1' })
});
export function mergeSuccessorCompanyFacts(successor, predecessor) {
  if (!predecessor?.facts) return successor;
  const facts = {};
  for (const source of [predecessor, successor]) {
    for (const [taxonomy, concepts] of Object.entries(source?.facts || {})) {
      facts[taxonomy] = facts[taxonomy] || {};
      for (const [concept, entry] of Object.entries(concepts || {})) {
        const target = facts[taxonomy][concept] = facts[taxonomy][concept] || { ...entry, units: {} };
        for (const [unit, rows] of Object.entries(entry?.units || {})) {
          const seen = new Set((target.units[unit] || []).map((row) => `${row.accn}|${row.start || ''}|${row.end}|${row.fp}|${row.val}`));
          target.units[unit] = [...(target.units[unit] || []), ...(rows || []).filter((row) => !seen.has(`${row.accn}|${row.start || ''}|${row.end}|${row.fp}|${row.val}`))];
        }
      }
    }
  }
  return { ...successor, facts };
}
export function mergeSuccessorSubmissions(successor, predecessor) {
  const a = successor?.filings?.recent || {}, b = predecessor?.filings?.recent || {};
  if (!Object.keys(b).length) return successor;
  const recent = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) recent[key] = [...(Array.isArray(a[key]) ? a[key] : []), ...(Array.isArray(b[key]) ? b[key] : [])];
  return { ...successor, filings: { ...(successor?.filings || {}), recent } };
}

export function classifyIssuerCapability(companyFacts, submissions = null) {
  const taxonomies = Object.keys(companyFacts?.facts || {});
  const hasUsGaap = taxonomies.includes('us-gaap');
  const hasIfrs = taxonomies.includes('ifrs-full');
  const recentForms = Array.isArray(submissions?.filings?.recent?.form) ? submissions.filings.recent.form : [];
  const foreignForm = recentForms.some(form => /^(20-F|40-F)(\/A)?$/.test(String(form || '')));
  const domesticForm = recentForms.some(form => /^(10-K)(\/A)?$/.test(String(form || '')));
  // v6: IFRS filers are read on their own basis (ratios only; see reportingBasis).
  if (!hasUsGaap && hasIfrs) return { status: 'SUPPORTED_IFRS', reasonCode: null, issuerTaxonomy: 'IFRS', filingForms: foreignForm ? ['20-F/40-F'] : [] };
  if (!hasUsGaap && foreignForm) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'foreign-issuer-without-us-gaap-taxonomy', issuerTaxonomy: 'FOREIGN_NON_US_GAAP', filingForms: ['20-F/40-F'] };
  if (!hasUsGaap) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'required-us-gaap-taxonomy-missing', issuerTaxonomy: foreignForm ? 'FOREIGN_UNKNOWN' : 'UNKNOWN', filingForms: foreignForm ? ['20-F/40-F'] : [] };
  return { status: 'SUPPORTED_US_GAAP', reasonCode: null, issuerTaxonomy: foreignForm && !domesticForm ? 'FOREIGN_US_GAAP' : 'US_GAAP', filingForms: [...new Set(recentForms.filter(form => /^(10-K|20-F|40-F)(\/A)?$/.test(String(form || ''))))] };
}

function compactPitRows(rows, field, acceptedMap, maxRows = 40) {
  const seen = new Set();
  return rows
    .filter(row => row && row.end && row.filed && finiteFact(row.val) != null)
    .sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)))
    .filter(row => {
      const key = `${row.start || ''}|${row.end}|${row.filed}|${row.accn || ''}|${row.val}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxRows)
    .map(row => ({
      field,
      value: Number(row.val),
      periodStart: row.start || null,
      periodEnd: row.end,
      filedAt: row.filed,
      acceptedAt: acceptedMap.get(String(row.accn || '')) || null,
      effectiveAt: acceptedMap.get(String(row.accn || '')) || row.filed,
      form: row.form || null,
      accession: row.accn || null,
      fiscalYear: row.fy ?? null,
      fiscalPeriod: row.fp || null,
      frame: row.frame || null,
      concept: row.concept || null,
      ...(row.reportedStart ? { reportedPeriodStart: row.reportedStart } : {})
    }));
}

// Twelve quarters: the four of the TTM, the year before them (one-off and year-over-year reads) and the three that a
// derived fourth quarter is netted against. The row cap only bounds a filer tagging several concepts per quarter.
const QUARTER_PERIODS = 12;
const QUARTER_ROW_CAP = 48;
function latestFiledPerPeriod(rows, maxPeriods) {
  const latest = new Map();
  for (const row of rows) {
    if (!row || !row.end || !row.filed || finiteFact(row.val) == null) continue;
    const key = `${row.concept || ''}|${row.start || ''}|${row.end}`;
    const prev = latest.get(key);
    if (!prev || String(row.filed) > String(prev.filed)) latest.set(key, row);
  }
  const ends = new Set([...new Set([...latest.values()].map((row) => row.end))].sort().slice(-maxPeriods));
  return [...latest.values()].filter((row) => ends.has(row.end));
}

function buildPointInTimeFacts(companyFacts, submissions, basis = US_GAAP_BASIS) {
  const concepts = BASIS_CONCEPTS[basis.taxonomy];
  const amountRows = (list) => factRows(companyFacts, basis.taxonomy, list, basis.currency);
  const acceptedMap = acceptedAtByAccession(submissions);
  const quarterly = (row) => /^(10-Q|10-K)(\/A)?$/.test(row.form || '') && isQuarterSpan(durationDays(row));
  // Every later 10-Q repeats a quarter as its comparative, so the rows of one quarter are reduced to the latest filing
  // per concept and the newest QUARTER_PERIODS period ends are kept. A row cap alone let one re-tagged quarter push the
  // prior-year quarters out (ETN's 2025-03 quarter held 7 of 16 rows), and the TTM chain fell back to the fiscal year.
  const quarterRows = (rows) => latestFiledPerPeriod(rows.filter(quarterly), QUARTER_PERIODS);
  // A full-year value tagged on a quarter span is annual, never a quarter (fullYearRevenueOnQuarterSpan).
  const fullYearRevenue = fullYearRevenueOnQuarterSpan(companyFacts, basis);
  const fullYearKeys = new Set(fullYearRevenue.fullYear.map(revenueRowKey));
  const revenueQRows = quarterRows(revenueFactRows(companyFacts, basis).filter((row) => !fullYearKeys.has(revenueRowKey(row))));
  const incomeQRows = quarterRows(amountRows(concepts.income));
  const revenueRows = [...revenueFactRows(companyFacts, basis).filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  }), ...fullYearRevenue.recovered];
  const incomeRows = amountRows(concepts.income).filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  const equityRows = amountRows(concepts.equity).filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const shareRows = factRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares')
    .filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const annualFy = (row) => { const days = durationDays(row); return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400; };
  const ocfRows = amountRows(concepts.operatingCashFlow).filter(annualFy);
  const capexRows = amountRows(concepts.capex).filter(annualFy);
  const debtRows = [...amountRows(concepts.longTermDebt), ...totalDebtDerivedRows(companyFacts, basis)].filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const assetRows = amountRows(concepts.totalAssets).filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && !row.start);
  const rdRows = amountRows(concepts.researchAndDevelopment).filter(annualFy);
  const yearEnd = (row) => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && !row.start;
  const capitalObservations = Object.fromEntries(Object.keys(SEC_CAPITAL_CONCEPTS).map((field) => [field,
    compactPitRows(amountRows(concepts[field] || []).filter(['cash', 'shortTermInvestments'].includes(field) ? yearEnd : annualFy), field, acceptedMap, 12)]));
  const commonRows = basis.taxonomy === 'us-gaap' ? amountRows([SEC_COMMON_INCOME_CONCEPT]) : [];
  const quarterEnd = (row) => /^(10-Q|10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && !row.start;
  const observations = {
    revenue: compactPitRows(revenueRows, 'revenue', acceptedMap),
    netIncome: compactPitRows(incomeRows, 'netIncome', acceptedMap),
    equity: compactPitRows(equityRows, 'equity', acceptedMap),
    sharesOutstanding: compactPitRows(shareRows, 'sharesOutstanding', acceptedMap),
    operatingCashFlow: compactPitRows(ocfRows, 'operatingCashFlow', acceptedMap),
    capex: compactPitRows(capexRows, 'capex', acceptedMap),
    longTermDebt: compactPitRows(debtRows, 'longTermDebt', acceptedMap),
    totalAssets: compactPitRows(assetRows, 'totalAssets', acceptedMap, 24),
    researchAndDevelopment: compactPitRows(rdRows, 'researchAndDevelopment', acceptedMap, 30),
    ...capitalObservations,
    revenueQ: compactPitRows(revenueQRows, 'revenueQ', acceptedMap, QUARTER_ROW_CAP),
    netIncomeQ: compactPitRows(incomeQRows, 'netIncomeQ', acceptedMap, QUARTER_ROW_CAP),
    // Quarterly operating income: the one-off earnings check compares a quarter's net income with it.
    operatingIncomeQ: compactPitRows(quarterRows(amountRows(concepts.operatingIncome || [])), 'operatingIncomeQ', acceptedMap, QUARTER_ROW_CAP),
    // Quarter-end equity and preferred stock from every periodic filing: P/B is priced on the latest reported balance
    // sheet's common equity (sec-valuation-basis secPbEquity), not the fiscal year-end total.
    equityQ: compactPitRows(amountRows(concepts.equity).filter(quarterEnd), 'equityQ', acceptedMap, 12),
    preferredQ: compactPitRows(amountRows(concepts.preferredEquity || []).filter(quarterEnd), 'preferredQ', acceptedMap, 8),
    inventoryQ: compactPitRows(amountRows(concepts.inventory || []).filter(quarterEnd), 'inventoryQ', acceptedMap, 16),
    receivablesQ: compactPitRows(amountRows(concepts.receivables || []).filter(quarterEnd), 'receivablesQ', acceptedMap, 16),
    ...(commonRows.length ? {
      netIncomeCommon: compactPitRows(commonRows.filter(annualFy), 'netIncomeCommon', acceptedMap, 12),
      netIncomeCommonQ: compactPitRows(quarterRows(commonRows), 'netIncomeCommonQ', acceptedMap, QUARTER_ROW_CAP)
    } : {})
  };
  const all = Object.values(observations).flat();
  return {
    schemaVersion: 'sec-pit-facts.v1',
    // v6: amounts are in this currency; the runtime projection publishes fiscal history only for USD.
    ...(basis.currency !== 'USD' ? { currency: basis.currency } : {}),
    status: all.some(row => row.acceptedAt) ? 'accepted-time-partial' : 'filed-date-only',
    observationCount: all.length,
    acceptedTimeCount: all.filter(row => row.acceptedAt).length,
    observations
  };
}

const LATEST_COVER_DRIFT_BAND = Object.freeze({ min: 0.67, max: 1.5 });
const SPLIT_RATIO_MIN = 1.9;
const SPLIT_RATIO_TOLERANCE = 0.06;
function splitRatioOf(later, earlier) {
  const ratio = later > 0 && earlier > 0 ? later / earlier : null;
  if (ratio == null) return null;
  const near = (x) => x >= SPLIT_RATIO_MIN && Math.abs(x - Math.round(x)) / Math.round(x) < SPLIT_RATIO_TOLERANCE;
  return near(ratio) || near(1 / ratio) ? ratio : null;
}

function selectShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow = null, classFacts = null, symbol = '') {
  const selected = selectReportedShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow, classFacts, symbol);
  if (!(selected?.value > 0) || !selected.row) return selected;
  const fiscalEnd = currentRevenue.end;
  const later = factRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares')
    .filter((row) => /^(10-K|10-Q)(\/A)?$/.test(row.form || '') && finiteFact(row.val) > 0 && row.end && row.filed
      && String(row.filed) > String(selected.row.filed || '') && String(row.end) > String(selected.row.end || '')
      && (shareGapDays(row.end, fiscalEnd) ?? Infinity) <= SEC_SHARES_MAX_GAP_DAYS)
    .sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)))[0] || null;
  const ratio = later ? splitRatioOf(finiteFact(later.val), selected.value) : null;
  if (ratio != null) return { ...selected, row: later, value: finiteFact(later.val), basis: 'dei-cover-post-split', splitRatio: Math.round(ratio * 1000) / 1000 };
  // The 10-K cover count is up to 15 months old at the next 10-K (buybacks and issuance moved it over 5% a year at 144
  // of 651 issuers). A later 10-Q cover count on the same basis replaces it; a jump outside the band below is a class
  // or unit change, not a year of buybacks, and keeps the 10-K count.
  const drift = later && selected.basis === 'dei-cover' ? finiteFact(later.val) / selected.value : null;
  if (drift != null && drift >= LATEST_COVER_DRIFT_BAND.min && drift <= LATEST_COVER_DRIFT_BAND.max) return { ...selected, row: later, value: finiteFact(later.val), basis: 'dei-cover-latest' };
  return selected;
}

function selectReportedShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow = null, classFacts = null, symbol = '') {
  const fiscalEnd = currentRevenue.end;
  const gap = (row) => shareGapDays(row.end, fiscalEnd);
  const withinYear = (rows) => rows.filter((row) => { const days = gap(row); return days != null && days <= SEC_SHARES_MAX_GAP_DAYS; });
  const dei = instantRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares');
  const deiNear = withinYear(dei);
  const cover = deiNear.find((row) => row.accn && row.accn === currentRevenue.accn) || deiNear.sort((a, b) => gap(a) - gap(b))[0] || null;
  const weighted = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares').filter((row) => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && sameFiscalPeriod(currentRevenue, row) && finiteFact(row.val) != null;
  }))[0] || null;
  const yearEnd = withinYear(instantRows(companyFacts, 'us-gaap', ['CommonStockSharesOutstanding'], 'shares')).sort((a, b) => gap(a) - gap(b))[0] || null;
  const implied = Number.isFinite(netIncome) && Number.isFinite(eps) && eps !== 0 && Math.sign(netIncome) === Math.sign(eps) ? netIncome / eps : null;
  const weightedValue = finiteFact(weighted?.val);
  const checkAgainst = (value, reference) => {
    const ratio = value > 0 && reference > 0 ? value / reference : null;
    return ratio == null ? null : ratio > 3 || ratio < 1 / 3 ? 'scale-mismatch' : 'consistent';
  };
  const candidates = [[cover, 'dei-cover'], [weighted, 'weighted-diluted'], [yearEnd, 'common-shares-outstanding']].filter(([row]) => row && finiteFact(row.val) > 0);
  let rejected = null;
  for (const [row, basis] of candidates) {
    const value = finiteFact(row.val);
    // Without EPS, a cover or year-end count is cross-checked against the weighted diluted count of the same year.
    const check = checkAgainst(value, implied) || (basis !== 'weighted-diluted' ? checkAgainst(value, weightedValue) : null) || 'unchecked';
    if (check === 'scale-mismatch') { rejected = rejected || { row, basis }; continue; }
    return { row, value, basis, check };
  }
  if (rejected) return { row: rejected.row, value: null, basis: rejected.basis, check: 'scale-mismatch' };
  const dilutedEps = finiteFact(dilutedEpsRow?.val);
  const impliedDiluted = Number.isFinite(netIncome) && Number.isFinite(dilutedEps) && dilutedEps !== 0 ? netIncome / dilutedEps : null;
  if (Number.isFinite(impliedDiluted) && impliedDiluted > 0) {
    const row = { val: impliedDiluted, end: dilutedEpsRow.end, filed: dilutedEpsRow.filed, accn: dilutedEpsRow.accn, form: dilutedEpsRow.form };
    return { row, value: impliedDiluted, basis: 'eps-implied', check: 'consistent' };
  }
  const byClass = classFacts ? selectClassDimensionedShares(classFacts, symbol, netIncome, fiscalEnd) : null;
  if (byClass?.value > 0) {
    const row = { val: byClass.value, end: fiscalEnd, filed: currentRevenue.filed, accn: currentRevenue.accn, form: currentRevenue.form };
    return { row, value: byClass.value, basis: 'class-dimensioned-10k', check: 'consistent', classMembers: byClass.members, classMethod: byClass.method };
  }
  return { row: null, value: null, basis: null, check: dei.length ? 'stale-period' : 'unreported', classCheck: byClass?.reason || null };
}

const CLASS_FACT_CONCEPTS = ['TradingSymbol', 'EarningsPerShareDiluted', 'EarningsPerShareBasic', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'];
export function parseClassShareFacts(xml) {
  const text = String(xml || '');
  const contexts = new Map();
  for (const match of text.matchAll(/<(?:[\w-]+:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?context>/g)) {
    const body = match[2];
    const members = [...body.matchAll(/<(?:[\w-]+:)?explicitMember\b[^>]*\bdimension="([^"]+)"[^>]*>\s*([^<\s]+)\s*</g)];
    if (members.length > 1 || (members.length === 1 && !/:StatementClassOfStockAxis$/.test(members[0][1]))) continue;
    if (/<(?:[\w-]+:)?typedMember\b/.test(body)) continue;
    const date = (tag) => (body.match(new RegExp(`<(?:[\\w-]+:)?${tag}>\\s*([0-9-]{10})`)) || [])[1] || null;
    contexts.set(match[1], { member: members.length ? members[0][2].replace(/^[\w-]+:/, '') : null, start: date('startDate'), end: date('endDate') || date('instant') });
  }
  const facts = [];
  for (const match of text.matchAll(/<(?:dei|us-gaap):(\w+)\b([^>]*)>([^<]*)<\/(?:dei|us-gaap):\1>/g)) {
    if (!CLASS_FACT_CONCEPTS.includes(match[1])) continue;
    const context = contexts.get((match[2].match(/\bcontextRef="([^"]+)"/) || [])[1]);
    if (!context) continue;
    const raw = match[3].trim();
    if (match[1] === 'TradingSymbol') { if (raw) facts.push({ concept: match[1], ...context, value: raw }); continue; }
    const value = finiteFact(raw);
    if (value != null) facts.push({ concept: match[1], ...context, value });
  }
  return facts;
}

// The traded class (cover TradingSymbol on the class axis) is priced on its own reported count when net income ÷ its
// EPS matches that count (as-converted classes: V Class A 1,966M, COKE common 83.8M); otherwise, when every class
// earns the same EPS, on the sum of the class counts (WMG A+B). With no class-axis symbol, a class whose own count
// matches is used only when all classes earn the same EPS. Anything else — a traded class without its own EPS
// (BRK.B, whose EPS is tagged on an "equivalent class B" member) — is withheld.
export const CLASS_EPS_TOLERANCE = 0.03;
export function selectClassDimensionedShares(classFacts, symbol, netIncome, fiscalEnd) {
  if (!Array.isArray(classFacts) || !classFacts.length || !Number.isFinite(netIncome) || netIncome === 0) return { value: null, reason: 'class-facts-unavailable' };
  const annual = classFacts.filter((row) => row.member && row.end === fiscalEnd && row.start && shareGapDays(row.start, row.end) >= 300 && shareGapDays(row.start, row.end) <= 400);
  const classes = new Map();
  for (const row of annual) {
    const entry = classes.get(row.member) || {};
    if (entry[row.concept] == null) entry[row.concept] = row.value;
    classes.set(row.member, entry);
  }
  const perClass = [...classes.entries()].map(([member, row]) => {
    const diluted = row.EarningsPerShareDiluted != null && row.WeightedAverageNumberOfDilutedSharesOutstanding > 0;
    const eps = diluted ? row.EarningsPerShareDiluted : row.EarningsPerShareBasic;
    const count = diluted ? row.WeightedAverageNumberOfDilutedSharesOutstanding : row.WeightedAverageNumberOfSharesOutstandingBasic;
    return { member, eps, count };
  }).filter((row) => Number.isFinite(row.eps) && row.eps !== 0 && Math.sign(row.eps) === Math.sign(netIncome) && row.count > 0);
  if (!perClass.length) return { value: null, reason: 'class-facts-unavailable' };
  // EPS is published to the cent, so the tolerance carries half a cent on top of the relative band.
  const matches = (count, eps) => Math.abs(netIncome / count - eps) <= 0.005 + CLASS_EPS_TOLERANCE * Math.abs(eps);
  const sameEps = perClass.every((row) => Math.abs(row.eps - perClass[0].eps) <= 0.005 + CLASS_EPS_TOLERANCE * Math.abs(perClass[0].eps));
  const sum = perClass.reduce((total, row) => total + row.count, 0);
  const summed = () => sameEps && matches(sum, perClass[0].eps) ? { value: sum, members: perClass.map((row) => row.member).sort(), method: 'class-sum' } : null;
  const symbolRows = classFacts.filter((row) => row.concept === 'TradingSymbol');
  const traded = symbolRows.find((row) => row.member && tickerKey(row.value) === tickerKey(symbol));
  if (traded) {
    const own = perClass.find((row) => row.member === traded.member);
    if (!own) return { value: null, reason: 'class-member-unmatched' };
    if (matches(own.count, own.eps)) return { value: own.count, members: [own.member], method: 'traded-class' };
    return summed() || { value: null, reason: 'class-count-inconsistent' };
  }
  if (symbolRows.some((row) => row.member)) return { value: null, reason: 'class-member-unmatched' };
  if (!sameEps) return { value: null, reason: 'class-eps-differs' };
  const own = perClass.filter((row) => matches(row.count, row.eps));
  if (own.length === 1) return { value: own[0].count, members: [own[0].member], method: 'traded-class' };
  return summed() || { value: null, reason: 'class-count-inconsistent' };
}

// The 10-K instance document EDGAR extracts from an inline XBRL primary document (v-20250930.htm → v-20250930_htm.xml).
export function classInstanceUrl(cik, accession, submissions) {
  const recent = submissions?.filings?.recent || {};
  const index = (recent.accessionNumber || []).indexOf(accession);
  const doc = index >= 0 ? String(recent.primaryDocument?.[index] || '') : '';
  if (!/^\d{10}-\d{2}-\d{6}$/.test(String(accession || '')) || !/^[\w.-]+\.htm$/i.test(doc) || !(Number(cik) > 0)) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${doc.replace(/\.htm$/i, '_htm.xml')}`;
}

export const RECENT_FILING_WINDOW_DAYS = 30;
export const RECENT_FILING_MAX = 5;
export function recentFilingsFrom(submissions, nowMs = Date.now()) {
  const recent = submissions?.filings?.recent || {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const cutoff = nowMs - RECENT_FILING_WINDOW_DAYS * 86400000;
  const rows = [];
  forms.forEach((form, index) => {
    if (!/^(8-K|10-Q|10-K)(\/A)?$/.test(String(form || ''))) return;
    const filedAt = String(recent.filingDate?.[index] || '').slice(0, 10);
    const accession = String(recent.accessionNumber?.[index] || '');
    const filedMs = Date.parse(filedAt);
    if (!Number.isFinite(filedMs) || filedMs < cutoff || filedMs > nowMs + 86400000 || !/^\d{10}-\d{2}-\d{6}$/.test(accession)) return;
    const items = String(recent.items?.[index] || '').split(',').map((item) => item.trim()).filter((item) => /^\d\.\d{2}$/.test(item));
    rows.push({ form: String(form), filedAt, accession, ...(items.length ? { items } : {}), ...(recent.reportDate?.[index] ? { reportDate: String(recent.reportDate[index]).slice(0, 10) } : {}) });
  });
  return rows.sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.accession.localeCompare(a.accession)).slice(0, RECENT_FILING_MAX);
}

export function normalizeSecCompanyFacts(symbol, companyFacts, price, submissions = null, classFacts = null, nowMs = Date.now()) {
  const basis = reportingBasis(companyFacts, nowMs);
  const usGaapUsd = basis.taxonomy === 'us-gaap' && basis.currency === 'USD';
  const concepts = BASIS_CONCEPTS[basis.taxonomy];
  let revenues = bestRevenueRowsByPeriod([...revenueFactRows(companyFacts, basis).filter(isAnnualFy), ...fullYearRevenueOnQuarterSpan(companyFacts, basis).recovered]);
  const incomeAnchor = preferredRow(companyFacts, basis, concepts.income, (rows) => rows.filter(isAnnualFy)[0] || null, (list) => annualDurationRows(companyFacts, list, basis));
  const incomeNewer = incomeAnchor && finiteFact(incomeAnchor.val) != null && revenues.length && String(incomeAnchor.end || '') > String(revenues[0].end || '')
    && preferredRow(companyFacts, basis, concepts.equity, (rows) => closestEnd(rows, incomeAnchor.end), (list) => instantRows(companyFacts, basis.taxonomy, list, basis.currency));
  let revenueUnreported = false;
  if (!revenues.length || incomeNewer) {
    if (!incomeAnchor || finiteFact(incomeAnchor.val) == null) return null;
    revenues = [{ ...incomeAnchor, val: null, concept: null }];
    revenueUnreported = true;
  }

  const currentRevenue = revenues[0];
  const priorRevenue = revenueUnreported ? null : revenues.find(row => isPriorAnnualPeriod(currentRevenue, row));
  const currentIncome = preferredRow(companyFacts, basis, concepts.income, (rows) => rows.find(row => sameFiscalPeriod(currentRevenue, row)) || null, (list) => annualDurationRows(companyFacts, list, basis));
  const currentEquity = preferredRow(companyFacts, basis, concepts.equity, (rows) => closestEnd(rows, currentRevenue.end) || null, (list) => instantRows(companyFacts, basis.taxonomy, list, basis.currency));
  const acceptedMap = acceptedAtByAccession(submissions);

  const revenue = revenueUnreported ? null : Number(currentRevenue.val);
  const netIncome = finiteFact(currentIncome?.val);
  const equity = finiteFact(currentEquity?.val);
  // Without revenue the record is worth publishing only for ROE / P/B; net income alone is not a fundamental row.
  if (revenueUnreported && equity == null) return null;
  const epsRow = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')
    .filter((row) => isAnnualFy(row) && row.end === currentRevenue.end))[0] || null;
  const eps = finiteFact(epsRow?.val);
  const dilutedEpsRow = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['EarningsPerShareDiluted'], 'USD/shares')
    .filter((row) => isAnnualFy(row) && row.end === currentRevenue.end))[0] || null;
  const foreignShareBasis = FOREIGN_ORDINARY_SHARE_FORMS.test(String(currentRevenue.form || ''));
  const shareSelection = usGaapUsd && !foreignShareBasis
    ? selectShareCount(companyFacts, currentRevenue, netIncome, eps, dilutedEpsRow, classFacts, symbol)
    : { row: null, value: null, basis: null, check: basis.currency !== 'USD' ? 'reporting-currency-differs' : 'foreign-share-basis-unverified' };
  const currentShares = shareSelection.row;
  const sharesCheck = shareSelection.check;
  const sharesOutstanding = shareSelection.value;
  const px = Number(price);
  const marketCap = px > 0 && sharesOutstanding > 0 ? px * sharesOutstanding : null;

  const operandAvailability = {
    revenue: revenueUnreported ? null : pitAvailability(currentRevenue, acceptedMap),
    netIncome: pitAvailability(currentIncome, acceptedMap),
    equity: pitAvailability(currentEquity, acceptedMap),
    sharesOutstanding: pitAvailability(currentShares, acceptedMap),
    priorRevenue: pitAvailability(priorRevenue, acceptedMap)
  };
  const derivedAvailability = {
    revGrowth: latestIso([operandAvailability.revenue, operandAvailability.priorRevenue]),
    margin: latestIso([operandAvailability.revenue, operandAvailability.netIncome]),
    roe: latestIso([operandAvailability.netIncome, operandAvailability.equity]),
    pe: latestIso([operandAvailability.sharesOutstanding, operandAvailability.netIncome]),
    pb: latestIso([operandAvailability.sharesOutstanding, operandAvailability.equity])
  };
  const recordAvailableAt = latestIso(Object.values(operandAvailability));
  const reportAgeDays = Number.isFinite(Date.parse(currentRevenue.end || ''))
    ? Math.round((nowMs - Date.parse(currentRevenue.end)) / 86400000)
    : null;
  const reportRecency = reportAgeDays != null && reportAgeDays <= REPORT_RECENCY_MAX_DAYS ? 'recent-fy' : 'stale-fy';
  const revenueAcceptedAt = acceptedMap.get(String(currentRevenue.accn || '')) || null;
  const qualityStatus = revenueAcceptedAt && reportRecency === 'recent-fy' ? 'CURRENT' : 'REFERENCE';

  const record = {
    symbol,
    cik: String(companyFacts.cik || '').padStart(10, '0'),
    entityName: submissions?.name || companyFacts.entityName || null,
    source: 'SEC EDGAR companyfacts',
    sourceTier: 'T1_OFFICIAL',
    sourceKind: 'T1_OFFICIAL',
    rightsId: 'PUBLIC_REFERENCE',
    // The v2 model id stays the artifact contract (allowlists and stored records key on it).
    // Availability semantics are versioned separately so this fix does not silently relabel
    // existing stored records.
    model: 'sec-fy-normalized-v2',
    availabilityModel: 'sec-pit-availability.v1',
    periodType: 'FY',
    fiscalPeriodEnd: currentRevenue.end || null,
    // The observation is the fiscal period end; the transport time is when we fetched it.
    observedAt: currentRevenue.end || null,
    filedAt: currentRevenue.filed || null,
    // The revenue accession's acceptance time, kept for compatibility. `availableAt` is the
    // earliest time the WHOLE record's operands were all public, which is never earlier.
    acceptedAt: revenueAcceptedAt,
    availableAt: recordAvailableAt,
    transportFetchedAt: new Date(nowMs).toISOString(),
    reportAgeDays,
    reportRecency,
    ...(revenueUnreported ? { periodAnchor: 'net-income', revenueStatus: 'unreported' } : {}),
    accessionByField: { revenue: revenueUnreported ? null : currentRevenue.accn || null, netIncome: currentIncome?.accn || null, equity: currentEquity?.accn || null, sharesOutstanding: currentShares?.accn || null },
    operandAvailability,
    derivedAvailability,
    allowedUse: 'research-relative-ranking-only',
    qualityStatus,
    quality: { status: qualityStatus, stale: reportRecency !== 'recent-fy', decisionUse: false, allowedUse: 'reference' },
    fetchedAt: new Date(nowMs).toISOString(),
    form: currentRevenue.form || null,
    accession: currentRevenue.accn || null,
    accountingStandard: basis.taxonomy === 'ifrs-full' ? 'IFRS' : 'US-GAAP',
    reportingCurrency: basis.currency,
    ...(basis.currency !== 'USD' ? { reportedAmounts: { currency: basis.currency, revenue, netIncome, equity: Number.isFinite(equity) ? equity : null } } : {}),
    revenue: basis.currency === 'USD' ? revenue : null,
    netIncome: basis.currency === 'USD' ? netIncome : null,
    equity: basis.currency === 'USD' && Number.isFinite(equity) ? equity : null,
    equityBasis: !Number.isFinite(equity) ? null : ['StockholdersEquity', 'EquityAttributableToOwnersOfParent'].includes(currentEquity?.concept) ? 'parent' : 'including-noncontrolling-interest',
    sharesOutstanding: Number.isFinite(sharesOutstanding) ? sharesOutstanding : null,
    sharesCheck,
    sharesBasis: Number.isFinite(sharesOutstanding) ? shareSelection.basis : null, // dei-cover | weighted-diluted | common-shares-outstanding | eps-implied | class-dimensioned-10k | dei-cover-post-split | dei-cover-latest
    ...(shareSelection.splitRatio ? { sharesSplitRatio: shareSelection.splitRatio } : {}),
    ...(shareSelection.classMembers ? { sharesClassMembers: shareSelection.classMembers, sharesClassMethod: shareSelection.classMethod } : {}),
    ...(shareSelection.classCheck ? { sharesClassCheck: shareSelection.classCheck } : {}),
    sharesObservedAt: Number.isFinite(sharesOutstanding) ? currentShares?.end || null : null,
    normalizerVersion: SEC_NORMALIZER_VERSION,
    revenueConcept: currentRevenue.concept || null,
    ...(currentRevenue.reportedStart ? { revenueReportedPeriodStart: currentRevenue.reportedStart } : {}),
    // N20: recent 8-K/10-Q/10-K filings within 30 days before this read (`fetchedAt`): date, form, Item numbers,
    // accession only — no filing text.
    recentFilings: recentFilingsFrom(submissions, nowMs),
    coverage: basis.currency !== 'USD' ? [] : [...(revenue != null ? ['revenue'] : []), ...(netIncome != null ? ['netIncome'] : []), ...(equity != null ? ['equity'] : []), ...(sharesOutstanding != null ? ['sharesOutstanding'] : [])],
    pit: buildPointInTimeFacts(companyFacts, submissions, basis)
  };

  if (priorRevenue && Number(priorRevenue.val) > 0) record.revGrowth = round((revenue / Number(priorRevenue.val) - 1) * 100, 1);
  if (netIncome != null && revenue != null && revenue !== 0) record.margin = round(netIncome / revenue * 100, 1);
  if (record.margin > SEC_MARGIN_HOLD_ABOVE_PCT) { record.marginHeld = { value: record.margin, reason: 'margin-above-100pct-revenue-subtotal' }; delete record.margin; }
  // v6: the same subtotal does not measure growth either (one rule with reconcileSecRevenueShares).
  if (record.marginHeld && Number.isFinite(record.revGrowth)) { record.revGrowthHeld = { value: record.revGrowth, reason: 'revenue-subtotal' }; delete record.revGrowth; }
  if (netIncome != null && equity > 0) record.roe = round(netIncome / equity * 100, 1);
  if (marketCap && netIncome > 0) record.pe = round(marketCap / netIncome, 2);
  if (marketCap && equity > 0) record.pb = round(marketCap / equity, 2);
  ['revGrowth', 'margin', 'roe', 'pe', 'pb'].forEach(key => {
    if (Number.isFinite(record[key])) record.coverage.push(key);
  });
  return reconcileSecValuationBasis(reconcileSecEarningsBasis(record));
}
