// 2026-10-17 (logic audit D8, owner-approved): the company analysis panel's SEC XBRL statements. The legacy parser in
// js/aio-chat.js picked a concept per field by recency only, pooled 10-K and 20-F rows in whatever currency the first
// unit was, priced P/E on annual EPS against an unverified cover count and printed every amount with '$'. It now
// reads the same primitives as the screener's normalizer: the report's taxonomy and currency (reportingBasis), one
// concept per series (anchorConceptRows), the latest filing per period, 300–400 / 80–100 day windows, and the
// normalized record for the price-based ratios (verified share count, TTM / common-earnings numerator, average-equity
// ROE). Series keep the legacy shape — arrays of { end, val } oldest first — so the panel code reads them unchanged.
import { reportingBasis, normalizeSecCompanyFacts } from './sec-normalize.js';
import { bestRevenueRowsByPeriod, secSharesTrust, SEC_PRIMARY_REVENUE_CONCEPTS, SEC_FALLBACK_REVENUE_CONCEPTS, SEC_IFRS_PRIMARY_REVENUE_CONCEPTS, SEC_IFRS_FALLBACK_REVENUE_CONCEPTS } from './sec-report.js';
import { anchorConceptRows } from './sec-earnings.js';
import { finiteFact as finite, fiscalYearLabel } from './period.js';

// [us-gaap concepts, ifrs-full concepts] in preference order; the first is the anchor when several report the latest period.
const FIELD_CONCEPTS = Object.freeze({
  netIncome: [['NetIncomeLoss', 'ProfitLoss'], ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss']],
  totalAssets: [['Assets'], ['Assets']],
  equity: [['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], ['EquityAttributableToOwnersOfParent', 'Equity']],
  eps: [['EarningsPerShareDiluted', 'EarningsPerShareBasic'], ['DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare']],
  opCashFlow: [['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], ['CashFlowsFromUsedInOperatingActivities']],
  capex: [['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], ['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities']],
  grossProfit: [['GrossProfit'], ['GrossProfit']],
  opIncome: [['OperatingIncomeLoss'], ['ProfitLossFromOperatingActivities']],
  totalDebt: [['LongTermDebtNoncurrent', 'LongTermDebt'], ['NoncurrentPortionOfNoncurrentBorrowings', 'LongtermBorrowings']],
  costOfRevenue: [['CostOfRevenue', 'CostOfGoodsAndServicesSold'], ['CostOfSales']],
  rd: [['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'], ['ResearchAndDevelopmentExpense']],
  sbc: [['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'], []],
  sga: [['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'], ['SellingGeneralAndAdministrativeExpense']],
  cash: [['CashAndCashEquivalentsAtCarryingValue', 'Cash'], ['CashAndCashEquivalents']],
  inventory: [['InventoryNet'], ['Inventories']],
  receivables: [['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'], ['TradeAndOtherCurrentReceivables']],
  currentDebt: [['DebtCurrent', 'LongTermDebtCurrent'], ['CurrentBorrowings', 'CurrentPortionOfNoncurrentBorrowings']]
});
const ANNUAL_FORMS = /^(10-K|20-F|40-F)(\/A)?$/;
const QUARTER_FORMS = /^10-Q(\/A)?$/;

function rowsOf(companyFacts, taxonomy, concepts, unit) {
  const facts = companyFacts?.facts?.[taxonomy] || {};
  return concepts.flatMap((concept) => (Array.isArray(facts[concept]?.units?.[unit]) ? facts[concept].units[unit] : []).map((row) => ({ ...row, concept })));
}
function windowed(rows, quarterly) {
  return rows.filter((row) => {
    if (!row?.end || finite(row.val) == null || !(quarterly ? QUARTER_FORMS : ANNUAL_FORMS).test(String(row.form || ''))) return false;
    if (!row.start) return !quarterly; // a balance-sheet instant
    const days = (Date.parse(row.end) - Date.parse(row.start)) / 86400000;
    return quarterly ? days >= 80 && days <= 100 : days >= 300 && days <= 400;
  });
}
// One row per period end (the latest filing), oldest first, the last `count`.
function series(rows, count) {
  const byEnd = new Map();
  for (const row of rows) { const prev = byEnd.get(row.end); if (!prev || String(row.filed || '') > String(prev.filed || '')) byEnd.set(row.end, row); }
  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end)).slice(-count)
    .map((row) => ({ end: row.end, val: finite(row.val), filed: row.filed || null, form: row.form || null, concept: row.concept, year: (fiscalYearLabel(row.end) || '').replace(/^FY/, '') }));
}
const lastOf = (list) => (list.length ? list[list.length - 1] : null);
const samePeriod = (a, b) => Boolean(a && b && a.end === b.end);

export function parseSecStatements(companyFacts, { symbol = '', price = null } = {}) {
  if (!companyFacts?.facts) return null;
  const basis = reportingBasis(companyFacts);
  const ifrs = basis.taxonomy === 'ifrs-full' ? 1 : 0;
  const amountUnit = basis.currency;
  const field = (key, quarterly = false, count = 5, unit = amountUnit) => {
    const concepts = FIELD_CONCEPTS[key][ifrs];
    return series(anchorConceptRows(windowed(rowsOf(companyFacts, basis.taxonomy, concepts, unit), quarterly), concepts), count);
  };
  const revenueConcepts = ifrs ? [...SEC_IFRS_PRIMARY_REVENUE_CONCEPTS, ...SEC_IFRS_FALLBACK_REVENUE_CONCEPTS] : [...SEC_PRIMARY_REVENUE_CONCEPTS, ...SEC_FALLBACK_REVENUE_CONCEPTS];
  const revenue = (quarterly, count) => series(bestRevenueRowsByPeriod(windowed(rowsOf(companyFacts, basis.taxonomy, revenueConcepts, amountUnit), quarterly)), count);
  const result = { currency: amountUnit, accountingStandard: ifrs ? 'IFRS' : 'US-GAAP', revenue: revenue(false, 5) };
  for (const key of Object.keys(FIELD_CONCEPTS)) result[key] = field(key, false, 5, key === 'eps' ? `${amountUnit}/shares` : amountUnit);
  result.qRevenue = revenue(true, 6);
  result.qNetIncome = field('netIncome', true, 6);
  result.qEps = field('eps', true, 6, `${amountUnit}/shares`);

  // Price-based ratios from the normalized record: a verified count (P1587 EPS match) on the quote's basis only.
  const record = normalizeSecCompanyFacts(String(symbol || '').toUpperCase(), companyFacts, price);
  const px = finite(price);
  const usd = amountUnit === 'USD';
  const shares = record && usd ? secSharesTrust(record, { price: px }).shares : null;
  result.sharesOut = shares ? [{ end: record.sharesObservedAt || record.observedAt, val: shares }] : [];
  const marketCap = px > 0 && shares ? px * shares : null;
  const earnings = finite(record?.peEarnings?.value) ?? finite(record?.netIncome);
  const [rev, ni, eq, gp, ocf, capex, debt, eps] = ['revenue', 'netIncome', 'equity', 'grossProfit', 'opCashFlow', 'capex', 'totalDebt', 'eps'].map((key) => lastOf(result[key]));
  const fcf = samePeriod(ocf, capex) ? ocf.val - Math.abs(capex.val) : null;
  const equityNow = finite(record?.equity) ?? (eq?.val ?? null);
  result.metrics = Object.freeze({
    currency: amountUnit,
    periodEnd: record?.observedAt || rev?.end || null,
    marketCap,
    pe: marketCap && earnings > 0 ? marketCap / earnings : null,
    peBasis: record?.peEarnings?.basis || 'fy',
    peThrough: record?.peEarnings?.through || record?.observedAt || null,
    pb: marketCap && equityNow > 0 ? marketCap / equityNow : null,
    roe: finite(record?.roe) != null ? record.roe / 100 : null,
    roeBasis: record?.roeBasis || (record?.equityPrior != null ? 'average-equity' : null),
    eps: eps && samePeriod(eps, rev) ? eps.val : null,
    grossMargin: samePeriod(gp, rev) && rev.val ? gp.val / rev.val : null,
    fcf,
    fcfYield: fcf != null && marketCap ? fcf / marketCap : null,
    debtToEquity: samePeriod(debt, eq) && eq.val > 0 ? debt.val / eq.val : null,
    sharesCheck: record?.sharesCheck || null
  });
  return result;
}
