// Incremental SEC EDGAR companyfacts adapter.
//
// The SEC API is free and keyless, but fair-access rules require a declared
// User-Agent and moderate request volume. This job refreshes a bounded batch
// and preserves prior verified rows so the full screener universe converges
// over multiple scheduled runs without hammering EDGAR.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finiteFact, sameFiscalPeriod, isPriorAnnualPeriod, FUNDAMENTAL_MAX_PERIOD_AGE_DAYS } from '../src/domain/fundamental/period.js';
import { reconcileSecEquity, reconcileSecRevenueShares, bestRevenueRowsByPeriod, shareGapDays, SEC_SHARES_MAX_GAP_DAYS, SEC_MARGIN_HOLD_ABOVE_PCT, SEC_PRIMARY_REVENUE_CONCEPTS, SEC_FALLBACK_REVENUE_CONCEPTS } from '../src/domain/fundamental/sec-report.js';
import { buildDomainReceipt } from './lib/domain-receipt.mjs';

// P1256: 도메인 receipt 계약은 이제 모든 수집 도메인이 공유한다(SEC는 첫 수용자).
export { buildDomainReceipt };

const sha256Hex = (value) => createHash('sha256').update(String(value)).digest('hex');

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = `${__dir}/..`;
const UNIVERSE_PATH = `${ROOT}/public-data/screener-universe.json`;
const SCREENER_PATH = `${ROOT}/public-data/screener.json`;
const OUT = `${ROOT}/public-data/sec-fundamentals.json`;
const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const SEC_FACTS_BASE = 'https://data.sec.gov/api/xbrl/companyfacts/CIK';
const SEC_SUBMISSIONS_BASE = 'https://data.sec.gov/submissions/CIK';
const DEFAULT_BATCH_LIMIT = 24;
const REFRESH_AFTER_MS = 28 * 86400000;
const FAILURE_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = process.env.SEC_USER_AGENT || '';

function round(n, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

async function fetchJSON(url, tries = 3) {
  let lastError;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        signal: ctrl.signal
      });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (i + 1 < tries) await new Promise(resolve => setTimeout(resolve, 900 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// F08: same reading as the screener universe (fetch-data getScreenerUniverse assetType): an explicit assetType,
// else sector or index 'ETF'.
export function isEtfUniverseRow(row) {
  if (!row || !row.sym) return false;
  return [row.assetType, row.sector, row.index].some((value) => String(value || '').trim().toUpperCase() === 'ETF');
}

function tickerKey(symbol) {
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

function dedupeLatestFiled(rows) {
  const byPeriod = new Map();
  rows.forEach(row => {
    const key = `${row.start || ''}|${row.end || ''}|${row.form || ''}|${row.fp || ''}`;
    const prev = byPeriod.get(key);
    if (!prev || String(row.filed || '') > String(prev.filed || '')) byPeriod.set(key, row);
  });
  return [...byPeriod.values()].sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')) || String(b.filed || '').localeCompare(String(a.filed || '')));
}

function annualDurationRows(companyFacts, concepts) {
  const rows = factRows(companyFacts, 'us-gaap', concepts, 'USD').filter(row => {
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

// W09-A/P1148: a fiscal year older than this is not "current financials" however recently we
// fetched it. 2026-10-13 F15: the producer uses the project's single 456-day rule (15 months after the
// fiscal year end, period.js) instead of its own 550-day budget, so its quality label and the screener agree.
const REPORT_RECENCY_MAX_DAYS = FUNDAMENTAL_MAX_PERIOD_AGE_DAYS;
// Stored records written by an older normalizer are due for re-fetch (in addition to the publish-time heal).
export const SEC_NORMALIZER_VERSION = 'sec-normalizer.2026-10-13';

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
// P1374: concept-coverage failures are only terminal for the concept set that produced them.
// Bump when the annual revenue/income concept lists change so those rows are rechecked once.
// v3 (2026-10-13 F06): RevenueFromContractWithCustomerIncludingAssessedTax added (VLO; XOM rechecked).
export const SEC_CONCEPT_SET_VERSION = 'sec-annual-concepts.v3';

export function classifyIssuerCapability(companyFacts, submissions = null) {
  const taxonomies = Object.keys(companyFacts?.facts || {});
  const hasUsGaap = taxonomies.includes('us-gaap');
  const hasIfrs = taxonomies.includes('ifrs-full');
  const recentForms = Array.isArray(submissions?.filings?.recent?.form) ? submissions.filings.recent.form : [];
  const foreignForm = recentForms.some(form => /^(20-F|40-F)(\/A)?$/.test(String(form || '')));
  const domesticForm = recentForms.some(form => /^(10-K)(\/A)?$/.test(String(form || '')));
  if (!hasUsGaap && hasIfrs) return { status: 'TERMINAL_UNSUPPORTED', reasonCode: 'ifrs-taxonomy-not-supported-by-us-gaap-normalizer', issuerTaxonomy: 'IFRS', filingForms: foreignForm ? ['20-F/40-F'] : [] };
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
      concept: row.concept || null
    }));
}

function buildPointInTimeFacts(companyFacts, submissions) {
  const acceptedMap = acceptedAtByAccession(submissions);
  const REVENUE_CONCEPTS = [...SEC_PRIMARY_REVENUE_CONCEPTS, ...SEC_FALLBACK_REVENUE_CONCEPTS]; // F05/F06: consumers pick per period via bestRevenueRowsByPeriod
  // Codex review 2026-10-05 (분기 추이): discrete-quarter facts (about three months) from 10-Q/10-K.
  // A fourth quarter is rarely tagged on its own; the projection derives it from FY minus Q1–Q3 and labels it.
  const quarterly = (row) => { const days = durationDays(row); return /^(10-Q|10-K)(\/A)?$/.test(row.form || '') && days != null && days >= 80 && days <= 100; };
  const revenueQRows = factRows(companyFacts, 'us-gaap', REVENUE_CONCEPTS, 'USD').filter(quarterly);
  const incomeQRows = factRows(companyFacts, 'us-gaap', ['NetIncomeLoss', 'ProfitLoss'], 'USD').filter(quarterly);
  const revenueRows = factRows(companyFacts, 'us-gaap', REVENUE_CONCEPTS, 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  const incomeRows = factRows(companyFacts, 'us-gaap', ['NetIncomeLoss', 'ProfitLoss'], 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  // P1402: parent-company equity first (the ROE/P-B denominator, matching NetIncomeLoss); the
  // NCI-inclusive total is a fallback. Agilent's FY2025 10-K tagged the NCI-inclusive total with
  // its accumulated OCI (-$226M against $6,741M parent equity).
  const equityRows = factRows(companyFacts, 'us-gaap', [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ], 'USD').filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const shareRows = factRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares')
    .filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  // P1446 (review 2026-10-04): the 재무 공시 reading needs the cash chain — operating cash flow, capital
  // spending (→ free cash flow) and long-term debt — beside revenue and income. Annual 10-K facts only.
  const annualFy = (row) => { const days = durationDays(row); return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400; };
  const ocfRows = factRows(companyFacts, 'us-gaap', ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], 'USD').filter(annualFy);
  const capexRows = factRows(companyFacts, 'us-gaap', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], 'USD').filter(annualFy);
  const debtRows = factRows(companyFacts, 'us-gaap', ['LongTermDebtNoncurrent', 'LongTermDebt'], 'USD').filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const observations = {
    revenue: compactPitRows(revenueRows, 'revenue', acceptedMap),
    netIncome: compactPitRows(incomeRows, 'netIncome', acceptedMap),
    equity: compactPitRows(equityRows, 'equity', acceptedMap),
    sharesOutstanding: compactPitRows(shareRows, 'sharesOutstanding', acceptedMap),
    operatingCashFlow: compactPitRows(ocfRows, 'operatingCashFlow', acceptedMap),
    capex: compactPitRows(capexRows, 'capex', acceptedMap),
    longTermDebt: compactPitRows(debtRows, 'longTermDebt', acceptedMap),
    revenueQ: compactPitRows(revenueQRows, 'revenueQ', acceptedMap, 16),
    netIncomeQ: compactPitRows(incomeQRows, 'netIncomeQ', acceptedMap, 16)
  };
  const all = Object.values(observations).flat();
  return {
    schemaVersion: 'sec-pit-facts.v1',
    status: all.some(row => row.acceptedAt) ? 'accepted-time-partial' : 'filed-date-only',
    observationCount: all.length,
    acceptedTimeCount: all.filter(row => row.acceptedAt).length,
    observations
  };
}

function legacyPitFacts(record) {
  const observations = {};
  for (const field of ['revenue', 'netIncome', 'equity', 'sharesOutstanding']) {
    const value = finiteFact(record?.[field]);
    observations[field] = value != null && record?.observedAt && record?.filedAt ? [{
      field,
      value,
      periodStart: null,
      periodEnd: record.observedAt,
      filedAt: record.filedAt,
      acceptedAt: record.acceptedAt || null,
      effectiveAt: record.acceptedAt || record.filedAt,
      form: record.form || null,
      accession: record.accession || null,
      fiscalYear: null,
      fiscalPeriod: record.periodType || 'FY',
      frame: null,
      concept: null
    }] : [];
  }
  const all = Object.values(observations).flat();
  return {
    schemaVersion: 'sec-pit-facts.v1',
    status: all.some(row => row.acceptedAt) ? 'accepted-time-partial' : 'filed-date-only',
    observationCount: all.length,
    acceptedTimeCount: all.filter(row => row.acceptedAt).length,
    observations
  };
}

function migrateLegacyPointInTimeData(data = {}) {
  let migrated = 0;
  const next = Object.fromEntries(Object.entries(data).map(([symbol, record]) => {
    if (record?.pit?.schemaVersion === 'sec-pit-facts.v1') return [symbol, record];
    migrated++;
    return [symbol, { ...record, model: 'sec-fy-normalized-v2', pit: legacyPitFacts(record) }];
  }));
  return { data: next, migrated };
}

// 2026-10-13 audit F03/F04/F16: the share count that prices P/E, P/B and the reference market cap. Candidates in
// order — the cover-page count (same 10-K first, else the nearest within 400 days of the fiscal year end), the
// same fiscal year's weighted diluted count, the year-end common shares outstanding. Before this, a missing
// current cover count fell back to the newest cover count of ANY year (V/MA/CMCSA/CHTR priced on 2009-2015
// shares, P/E 2-9) and multi-class filers (GOOGL/META) whose cover counts are only class-dimensioned — which
// companyfacts omits, so a per-class sum is not available here — had none. Each candidate is checked against
// net income ÷ diluted EPS (P1587); a scale mismatch moves on to the next candidate.
function selectShareCount(companyFacts, currentRevenue, netIncome, eps) {
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
  return { row: null, value: null, basis: null, check: dei.length ? 'stale-period' : 'unreported' };
}

// N20 (2026-10-13): the issuer's own recent filings from the submissions document this job already reads —
// 8-K (with Item numbers), 10-Q, 10-K and their amendments within 30 days before the fetch, newest first, at most 5.
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

export function normalizeSecCompanyFacts(symbol, companyFacts, price, submissions = null) {
  // F05/F06: every annual revenue concept is collected; bestRevenueRowsByPeriod picks one row per fiscal period
  // (largest primary concept, assessed-tax-inclusive only as a fallback). P1374 bank net revenue stays a
  // primary concept.
  // (annualDurationRows dedupes by period+form across concepts, so the per-concept rows are filtered here instead.)
  const revenues = bestRevenueRowsByPeriod(factRows(companyFacts, 'us-gaap', [
    ...SEC_PRIMARY_REVENUE_CONCEPTS,
    ...SEC_FALLBACK_REVENUE_CONCEPTS
  ], 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && finiteFact(row.val) != null;
  }));
  const incomes = annualDurationRows(companyFacts, ['NetIncomeLoss', 'ProfitLoss']);
  if (!revenues.length) return null;

  const currentRevenue = revenues[0];
  const priorRevenue = revenues.find(row => isPriorAnnualPeriod(currentRevenue, row));
  const currentIncome = incomes.find(row => sameFiscalPeriod(currentRevenue, row)) || null;
  const equities = instantRows(companyFacts, 'us-gaap', [
    'StockholdersEquity', // P1402: parent equity first; see buildPointInTimeFacts
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ], 'USD');
  const currentEquity = closestEnd(equities, currentRevenue.end) || null;
  const acceptedMap = acceptedAtByAccession(submissions);

  const revenue = Number(currentRevenue.val);
  const netIncome = finiteFact(currentIncome?.val);
  const equity = finiteFact(currentEquity?.val);
  // P1587: the share count is cross-checked against net income ÷ diluted EPS for the same fiscal year. PKG's
  // companyfacts carried 89,213,394,000 cover shares (1000x), which published P/E 26,500 and P/B 4,461.
  const epsRow = dedupeLatestFiled(factRows(companyFacts, 'us-gaap', ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')
    .filter((row) => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && row.end === currentRevenue.end && finiteFact(row.val) != null))[0] || null;
  const eps = finiteFact(epsRow?.val);
  const shareSelection = selectShareCount(companyFacts, currentRevenue, netIncome, eps);
  const currentShares = shareSelection.row;
  const sharesCheck = shareSelection.check;
  const sharesOutstanding = shareSelection.value;
  const px = Number(price);
  const marketCap = px > 0 && sharesOutstanding > 0 ? px * sharesOutstanding : null;

  // W09-A/B/P1148 (F01/F02): transport freshness, report recency, and per-operand availability
  // are separate. A filing arriving today does not make an old fiscal year current, and a
  // derived ratio cannot have been reproducible before its LATEST operand was public.
  const operandAvailability = {
    revenue: pitAvailability(currentRevenue, acceptedMap),
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
    ? Math.round((Date.now() - Date.parse(currentRevenue.end)) / 86400000)
    : null;
  const reportRecency = reportAgeDays != null && reportAgeDays <= REPORT_RECENCY_MAX_DAYS ? 'recent-fy' : 'stale-fy';
  const revenueAcceptedAt = acceptedMap.get(String(currentRevenue.accn || '')) || null;
  const qualityStatus = revenueAcceptedAt && reportRecency === 'recent-fy' ? 'CURRENT' : 'REFERENCE';

  const record = {
    symbol,
    cik: String(companyFacts.cik || '').padStart(10, '0'),
    // P1582: the submissions document names the registrant itself; companyfacts.entityName can carry
    // a co-registrant (CIK 70858 Bank of America → "BofA Finance LLC").
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
    transportFetchedAt: new Date().toISOString(),
    reportAgeDays,
    reportRecency,
    accessionByField: { revenue: currentRevenue.accn || null, netIncome: currentIncome?.accn || null, equity: currentEquity?.accn || null, sharesOutstanding: currentShares?.accn || null },
    operandAvailability,
    derivedAvailability,
    allowedUse: 'research-relative-ranking-only',
    qualityStatus,
    quality: { status: qualityStatus, stale: reportRecency !== 'recent-fy', decisionUse: false, allowedUse: 'reference' },
    fetchedAt: new Date().toISOString(),
    form: currentRevenue.form || null,
    accession: currentRevenue.accn || null,
    revenue,
    netIncome,
    equity: Number.isFinite(equity) ? equity : null,
    // P1582: declare which equity concept fed ROE/P-B. The NCI-inclusive fallback does not match the
    // parent-only NetIncomeLoss numerator, so consumers can see when the ratio mixes bases.
    equityBasis: !Number.isFinite(equity) ? null : currentEquity?.concept === 'StockholdersEquity' ? 'parent' : 'including-noncontrolling-interest',
    sharesOutstanding: Number.isFinite(sharesOutstanding) ? sharesOutstanding : null,
    // P1587 + F03/F04: consistent | scale-mismatch (withheld) | unchecked | stale-period / unreported (no count
    // within 400 days of the fiscal year end — withheld, P/E·P/B·reference market cap stay empty)
    sharesCheck,
    sharesBasis: Number.isFinite(sharesOutstanding) ? shareSelection.basis : null, // dei-cover | weighted-diluted | common-shares-outstanding
    sharesObservedAt: Number.isFinite(sharesOutstanding) ? currentShares?.end || null : null,
    normalizerVersion: SEC_NORMALIZER_VERSION,
    revenueConcept: currentRevenue.concept || null,
    // N20: recent 8-K/10-Q/10-K filings within 30 days before this fetch (`fetchedAt`): date, form, Item numbers,
    // accession only — no filing text.
    recentFilings: recentFilingsFrom(submissions),
    coverage: ['revenue', ...(netIncome != null ? ['netIncome'] : []), ...(equity != null ? ['equity'] : []), ...(sharesOutstanding != null ? ['sharesOutstanding'] : [])],
    pit: buildPointInTimeFacts(companyFacts, submissions)
  };

  if (priorRevenue && Number(priorRevenue.val) > 0) record.revGrowth = round((revenue / Number(priorRevenue.val) - 1) * 100, 1);
  if (netIncome != null && revenue !== 0) record.margin = round(netIncome / revenue * 100, 1);
  // F05: a margin above 100% means a revenue subtotal, not the business; withheld (value kept for audit).
  if (record.margin > SEC_MARGIN_HOLD_ABOVE_PCT) { record.marginHeld = { value: record.margin, reason: 'margin-above-100pct-revenue-subtotal' }; delete record.margin; }
  if (netIncome != null && equity > 0) record.roe = round(netIncome / equity * 100, 1);
  if (marketCap && netIncome > 0) record.pe = round(marketCap / netIncome, 2);
  if (marketCap && equity > 0) record.pb = round(marketCap / equity, 2);
  ['revGrowth', 'margin', 'roe', 'pe', 'pb'].forEach(key => {
    if (Number.isFinite(record[key])) record.coverage.push(key);
  });
  return record;
}

async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function atomicWrite(path, value) {
  await atomicWriteFile(path, JSON.stringify(value, null, 1));
}

function buildTickerMap(payload) {
  const fields = payload && payload.fields || [];
  const tickerIndex = fields.indexOf('ticker');
  const cikIndex = fields.indexOf('cik');
  const nameIndex = fields.indexOf('name');
  const exchangeIndex = fields.indexOf('exchange');
  const map = new Map();
  (payload && payload.data || []).forEach(row => {
    const ticker = tickerKey(row[tickerIndex]);
    if (!ticker) return;
    map.set(ticker, { cik: String(row[cikIndex]).padStart(10, '0'), name: row[nameIndex] || null, exchange: exchangeIndex >= 0 ? row[exchangeIndex] || null : null });
  });
  return map;
}

// P1169 (17 작업 단위 1 / 06 O06): 도메인 receipt. "이번 수집 성공 / 기존 값 보존 / 분석 적격성 /
// publication 성공"을 하나의 성공 상태로 합치지 않도록 카운터를 독립 기록한다. receipt는 job exit
// code가 아니라 시도·갱신·보존·terminal·transient 수에서 계산되며, 생성시각 하나로 데이터가
// 새로워졌다고 표시하지 않는다.
// (P1256: buildDomainReceipt의 정본 구현은 scripts/lib/domain-receipt.mjs로 이전했다.)

export async function refreshSecFundamentals(priceHints = null) {
  const universePayload = await readJSON(UNIVERSE_PATH, { universe: [] });
  const screener = await readJSON(SCREENER_PATH, { data: {} });
  let previousExists = true;
  let previous;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { previousExists = false; previous = { schemaVersion: '2.0', data: {} }; }
  const migration = migrateLegacyPointInTimeData(previous.data || {});
  previous = { ...previous, schemaVersion: '2.0', model: 'sec-fy-normalized-v2', data: migration.data };
  if (!/\S+@\S+\.\S+/.test(USER_AGENT)) {
    const skipped = {
      ...previous,
      schemaVersion: '2.0',
      status: 'operator_configuration_required',
      source: 'SEC EDGAR companyfacts',
      sourceUrl: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
      allowedUse: 'none until SEC fair-access User-Agent is configured',
      requiredConfiguration: 'Repository variable SEC_USER_AGENT with monitored contact email',
      pointInTimeCoverage: Object.values(previous.data || {}).filter(row => row?.pit?.observationCount > 0).length,
      pointInTimeAcceptedCoverage: Object.values(previous.data || {}).filter(row => row?.pit?.acceptedTimeCount > 0).length,
      data: previous.data || {}
    };
    if (!previousExists || migration.migrated > 0) {
      skipped.generatedAt = new Date().toISOString();
      skipped.migratedAt = skipped.generatedAt;
      skipped.migratedRows = migration.migrated;
      await atomicWrite(OUT, skipped);
    }
    console.warn('[sec-fundamentals] skipped: SEC_USER_AGENT repository variable is required by SEC fair-access policy');
    return skipped;
  }
  // F08 (2026-10-13): ETFs/trusts are not operating companies — a commodity trust's "revenue" is its trading
  // gain or loss (USO margin 115%, SLV negative revenue). They are excluded from collection and pruned below.
  const etfSymbols = new Set((universePayload.universe || []).filter(isEtfUniverseRow).map(row => row.sym));
  const symbols = (universePayload.universe || []).map(row => row && row.sym).filter(sym => sym && !/\.(KS|KQ)$/i.test(sym) && !etfSymbols.has(sym));
  const tickerPayload = await fetchJSON(SEC_TICKERS_URL);
  const tickerMap = buildTickerMap(tickerPayload);
  const eligible = symbols.filter(symbol => tickerMap.has(tickerKey(symbol)));
  const now = Date.now();
  const limit = Math.max(1, Math.min(100, Number(process.env.SEC_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT));
  const force = process.env.SEC_REFRESH === '1';
  const retryFailedNow = process.env.SEC_RETRY_FAILED === '1';
  const previousFailureRecords = new Map((previous.failures || []).map(row => [row && row.symbol, row]).filter(([symbol]) => symbol));
  const previousFailureAt = new Map([...previousFailureRecords.entries()].map(([symbol, row]) => [
    symbol,
    row && (row.attemptedAt || row.failedAt || previous.generatedAt || null)
  ]));
  const recheckUnsupported = process.env.SEC_RECHECK_UNSUPPORTED === '1';
  const targets = eligible
    .map(symbol => ({
      symbol,
      fetchedAt: previous.data && previous.data[symbol] && previous.data[symbol].fetchedAt,
      // Codex review 2026-10-05: P1446 added the cash chain (operating cash flow, capex, debt) to new
      // fetches, but stored records only refresh after REFRESH_AFTER_MS, so all 592 published issuers
      // still lacked it. A stored record without the cash-chain observations is due now.
      cashChainMissing: Boolean(previous.data && previous.data[symbol] && (!Array.isArray(previous.data[symbol]?.pit?.observations?.operatingCashFlow) || !Array.isArray(previous.data[symbol]?.pit?.observations?.revenueQ))),
      // 2026-10-13 F04: a record from an older normalizer (494 of 659 lacked the P1587 share check) is due now;
      // the publish-time heal below covers what its stored observations allow until then.
      normalizerOutdated: Boolean(previous.data && previous.data[symbol] && previous.data[symbol].normalizerVersion !== SEC_NORMALIZER_VERSION),
      lastFailureAt: previousFailureAt.get(symbol) || null,
      priorFailure: previousFailureRecords.get(symbol) || null
    }))
    .filter(row => {
      if (force) return true;
      const conceptSetChanged = row.priorFailure?.reasonCode === 'required-us-gaap-annual-concepts-unavailable'
        && row.priorFailure?.conceptSetVersion !== SEC_CONCEPT_SET_VERSION;
      if (row.priorFailure?.status === 'TERMINAL_UNSUPPORTED' && !recheckUnsupported && !conceptSetChanged) return false;
      if (conceptSetChanged) return true;
      const dataDue = !row.fetchedAt || row.cashChainMissing || row.normalizerOutdated || now - new Date(row.fetchedAt).getTime() >= REFRESH_AFTER_MS;
      const retryDue = retryFailedNow || !row.lastFailureAt || now - new Date(row.lastFailureAt).getTime() >= FAILURE_RETRY_AFTER_MS;
      return dataDue && retryDue;
    })
    // Prefer never-attempted and retryable candidates. Terminal taxonomy
    // failures remain in the audit but cannot starve fresh coverage.
    .sort((a, b) => Number(Boolean(a.priorFailure)) - Number(Boolean(b.priorFailure)) || String(a.fetchedAt || '').localeCompare(String(b.fetchedAt || '')) || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);

  const data = { ...(previous.data || {}) };
  const failuresBySymbol = new Map([...previousFailureRecords.entries()]);
  let updated = 0;
  const attemptedAt = new Date(now).toISOString();
  for (const target of targets) {
    const meta = tickerMap.get(tickerKey(target.symbol));
    try {
      const [facts, submissions] = await Promise.all([
        fetchJSON(`${SEC_FACTS_BASE}${meta.cik}.json`, 2),
        fetchJSON(`${SEC_SUBMISSIONS_BASE}${meta.cik}.json`, 2)
      ]);
      // P715 공개 계약 때문에 screener.json에는 원시가가 없다. 같은 파이프라인
      // 실행에서 전달받은 메모리 한정 priceHints(adjusted close)를 우선 쓰고,
      // 없으면 종전대로 screener.json 값을 본다. 어느 경로도 발행 아티팩트에
      // 가격을 기록하지 않는다.
      const hintedPrice = priceHints && typeof priceHints.get === 'function' ? priceHints.get(target.symbol) : null;
      const price = Number.isFinite(Number(hintedPrice)) && Number(hintedPrice) > 0
        ? Number(hintedPrice)
        : screener.data && screener.data[target.symbol] && screener.data[target.symbol].price;
      const capability = classifyIssuerCapability(facts, submissions);
      if (capability.status === 'TERMINAL_UNSUPPORTED') {
        failuresBySymbol.set(target.symbol, {
          symbol: target.symbol,
          status: 'TERMINAL_UNSUPPORTED',
          reasonCode: capability.reasonCode,
          reason: `${capability.reasonCode}; issuerTaxonomy=${capability.issuerTaxonomy}`,
          issuerTaxonomy: capability.issuerTaxonomy,
          filingForms: capability.filingForms,
          attemptedAt,
          retryPolicy: 'manual-or-explicit-SEC_RECHECK_UNSUPPORTED'
        });
        continue;
      }
      const normalized = normalizeSecCompanyFacts(target.symbol, facts, price, submissions);
      if (!normalized) {
        failuresBySymbol.set(target.symbol, {
          symbol: target.symbol,
          status: 'TERMINAL_UNSUPPORTED',
          reasonCode: 'required-us-gaap-annual-concepts-unavailable',
          reason: 'no comparable annual US-GAAP revenue/net-income facts',
          conceptSetVersion: SEC_CONCEPT_SET_VERSION,
          issuerTaxonomy: capability.issuerTaxonomy,
          filingForms: capability.filingForms,
          attemptedAt,
          retryPolicy: 'manual-or-explicit-SEC_RECHECK_UNSUPPORTED'
        });
        continue;
      }
      data[target.symbol] = normalized;
      failuresBySymbol.delete(target.symbol);
      updated++;
    } catch (error) {
      failuresBySymbol.set(target.symbol, { symbol: target.symbol, status: 'TRANSIENT_PROVIDER_FAILURE', reasonCode: 'provider-or-network-error', reason: String(error && error.message || error), attemptedAt, retryAfterMs: FAILURE_RETRY_AFTER_MS });
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // P1449: heal stored rows at publish time. Records written before the P1402 parent-first
  // concept order (for example Agilent, whose NCI-inclusive tag carried its AOCI value) keep
  // shipping -226M until their 28-day re-fetch; when the same filing's parent
  // StockholdersEquity row is in the stored PIT observations, use it without waiting.
  // 2026-10-13 F03/F05: the same publish-time heal re-selects revenue per period, withholds margins above 100%
  // and drops share counts from another fiscal year (reconcileSecRevenueShares), so every stored row follows
  // the new policy on the next run instead of waiting for its re-fetch. F08: ETF rows are pruned.
  let healedCount = 0;
  let etfPruned = 0;
  for (const [symbol, record] of Object.entries(data)) {
    if (etfSymbols.has(symbol)) { delete data[symbol]; etfPruned++; continue; }
    const healed = reconcileSecEquity(reconcileSecRevenueShares(record));
    if (healed !== record) { data[symbol] = healed; healedCount++; }
  }

  const payload = {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    source: 'SEC EDGAR companyfacts',
    sourceUrl: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
    licenseClass: 'US federal public disclosure; SEC fair-access policy applies',
    allowedUse: 'research/reference; normalized annual filing facts, not analyst estimates or live TTM',
    model: 'sec-fy-normalized-v2',
    eligible: eligible.length,
    stored: Object.keys(data).length,
    attempted: targets.length,
    updated,
    failures: [...failuresBySymbol.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol))),
    terminalUnsupported: [...failuresBySymbol.values()].filter(row => row.status === 'TERMINAL_UNSUPPORTED').map(row => row.symbol),
    retryableFailures: [...failuresBySymbol.values()].filter(row => row.status !== 'TERMINAL_UNSUPPORTED').map(row => row.symbol),
    pointInTimeCoverage: Object.values(data).filter(row => row?.pit?.observationCount > 0).length,
    pointInTimeAcceptedCoverage: Object.values(data).filter(row => row?.pit?.acceptedTimeCount > 0).length,
    batchLimit: limit,
    unsupportedRecheckPolicy: 'SEC_RECHECK_UNSUPPORTED=1 required for explicit recheck; terminal unsupported rows remain auditable and out of normal batches',
    nextRefreshCandidates: Math.max(0, eligible.length - Object.keys(data).length),
    // P1169 (17 작업 단위 1 / 06 O06): 이번 batch의 수집 성과를 job exit code가 아니라 카운터로
    // 기록한다. 관측시각 하나(generatedAt)로 "데이터가 새로워졌다"를 표시하지 않는다.
    domainReceipt: buildDomainReceipt({
      domain: 'sec-fundamentals',
      runId: process.env.GITHUB_RUN_ID ? `gha:${process.env.GITHUB_RUN_ID}` : `local:${attemptedAt}`,
      attemptedAt,
      sourceRevision: `sec-company-tickers:${sha256Hex(JSON.stringify(tickerPayload))}`,
      inputWatermarks: {
        universe: universePayload.lastBulkUpdate || universePayload.generatedAt || null,
        screener: screener.asOf || screener.generatedAt || null,
        previousArtifact: previous.generatedAt || null
      },
      eligible: eligible.length,
      attempted: targets.length,
      updated,
      stored: Object.keys(data).length,
      failures: [...failuresBySymbol.values()],
      priorReceipt: previous.domainReceipt || null,
      batchLimit: limit
    }),
    data
  };
  await atomicWrite(OUT, payload);
  console.log(`[sec-fundamentals] stored=${payload.stored}/${payload.eligible} attempted=${payload.attempted} updated=${updated} failed=${payload.failures.length} terminalUnsupported=${payload.terminalUnsupported.length} healed=${healedCount} etfPruned=${etfPruned}`);
  return payload;
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  refreshSecFundamentals().catch(error => {
    console.error('[sec-fundamentals] fatal:', error);
    process.exit(1);
  });
}
