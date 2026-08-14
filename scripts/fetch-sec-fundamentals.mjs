// Incremental SEC EDGAR companyfacts adapter.
//
// The SEC API is free and keyless, but fair-access rules require a declared
// User-Agent and moderate request volume. This job refreshes a bounded batch
// and preserves prior verified rows so the full screener universe converges
// over multiple scheduled runs without hammering EDGAR.

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  for (const concept of concepts) {
    const rows = facts[concept] && facts[concept].units && facts[concept].units[unit];
    if (Array.isArray(rows) && rows.length) return rows.map(row => ({ ...row, concept }));
  }
  return [];
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
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400 && Number.isFinite(Number(row.val));
  });
  return dedupeLatestFiled(rows);
}

function instantRows(companyFacts, taxonomy, concepts, unit) {
  return dedupeLatestFiled(factRows(companyFacts, taxonomy, concepts, unit).filter(row =>
    /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && Number.isFinite(Number(row.val))
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

function compactPitRows(rows, field, acceptedMap, maxRows = 40) {
  const seen = new Set();
  return rows
    .filter(row => row && row.end && row.filed && Number.isFinite(Number(row.val)))
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
  const revenueRows = factRows(companyFacts, 'us-gaap', [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet'
  ], 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  const incomeRows = factRows(companyFacts, 'us-gaap', ['NetIncomeLoss', 'ProfitLoss'], 'USD').filter(row => {
    const days = durationDays(row);
    return /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || '') && row.fp === 'FY' && days != null && days >= 300 && days <= 400;
  });
  const equityRows = factRows(companyFacts, 'us-gaap', [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'StockholdersEquity'
  ], 'USD').filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const shareRows = factRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares')
    .filter(row => /^(10-K|20-F|40-F)(\/A)?$/.test(row.form || ''));
  const observations = {
    revenue: compactPitRows(revenueRows, 'revenue', acceptedMap),
    netIncome: compactPitRows(incomeRows, 'netIncome', acceptedMap),
    equity: compactPitRows(equityRows, 'equity', acceptedMap),
    sharesOutstanding: compactPitRows(shareRows, 'sharesOutstanding', acceptedMap)
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
    const value = Number(record?.[field]);
    observations[field] = Number.isFinite(value) && record?.observedAt && record?.filedAt ? [{
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

export function normalizeSecCompanyFacts(symbol, companyFacts, price, submissions = null) {
  const revenues = annualDurationRows(companyFacts, [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet'
  ]);
  const incomes = annualDurationRows(companyFacts, ['NetIncomeLoss', 'ProfitLoss']);
  if (!revenues.length || !incomes.length) return null;

  const currentRevenue = revenues[0];
  const priorRevenue = revenues.find(row => row.end < currentRevenue.end);
  const currentIncome = closestEnd(incomes, currentRevenue.end) || incomes[0];
  const equities = instantRows(companyFacts, 'us-gaap', [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'StockholdersEquity'
  ], 'USD');
  const shares = instantRows(companyFacts, 'dei', ['EntityCommonStockSharesOutstanding'], 'shares');
  const currentEquity = closestEnd(equities, currentRevenue.end) || equities[0] || null;
  const currentShares = closestEnd(shares, currentRevenue.end) || shares[0] || null;
  const acceptedMap = acceptedAtByAccession(submissions);

  const revenue = Number(currentRevenue.val);
  const netIncome = Number(currentIncome && currentIncome.val);
  const equity = Number(currentEquity && currentEquity.val);
  const sharesOutstanding = Number(currentShares && currentShares.val);
  const px = Number(price);
  const marketCap = px > 0 && sharesOutstanding > 0 ? px * sharesOutstanding : null;
  const record = {
    symbol,
    cik: String(companyFacts.cik || '').padStart(10, '0'),
    entityName: companyFacts.entityName || null,
    source: 'SEC EDGAR companyfacts',
    sourceTier: 'official-regulator',
    model: 'sec-fy-normalized-v2',
    periodType: 'FY',
    observedAt: currentRevenue.end || null,
    filedAt: currentRevenue.filed || null,
    acceptedAt: acceptedMap.get(String(currentRevenue.accn || '')) || null,
    fetchedAt: new Date().toISOString(),
    form: currentRevenue.form || null,
    accession: currentRevenue.accn || null,
    revenue,
    netIncome,
    equity: Number.isFinite(equity) ? equity : null,
    sharesOutstanding: Number.isFinite(sharesOutstanding) ? sharesOutstanding : null,
    coverage: ['revenue', 'netIncome'],
    pit: buildPointInTimeFacts(companyFacts, submissions)
  };

  if (priorRevenue && Number(priorRevenue.val) > 0) record.revGrowth = round((revenue / Number(priorRevenue.val) - 1) * 100, 1);
  if (revenue !== 0) record.margin = round(netIncome / revenue * 100, 1);
  if (equity > 0) record.roe = round(netIncome / equity * 100, 1);
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
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 1));
  await rename(temp, path);
}

function buildTickerMap(payload) {
  const fields = payload && payload.fields || [];
  const tickerIndex = fields.indexOf('ticker');
  const cikIndex = fields.indexOf('cik');
  const nameIndex = fields.indexOf('name');
  const map = new Map();
  (payload && payload.data || []).forEach(row => {
    const ticker = tickerKey(row[tickerIndex]);
    if (!ticker) return;
    map.set(ticker, { cik: String(row[cikIndex]).padStart(10, '0'), name: row[nameIndex] || null });
  });
  return map;
}

export async function refreshSecFundamentals() {
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
  const symbols = (universePayload.universe || []).map(row => row && row.sym).filter(sym => sym && !/\.(KS|KQ)$/i.test(sym));
  const tickerPayload = await fetchJSON(SEC_TICKERS_URL);
  const tickerMap = buildTickerMap(tickerPayload);
  const eligible = symbols.filter(symbol => tickerMap.has(tickerKey(symbol)));
  const now = Date.now();
  const limit = Math.max(1, Math.min(100, Number(process.env.SEC_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT));
  const force = process.env.SEC_REFRESH === '1';
  const retryFailedNow = process.env.SEC_RETRY_FAILED === '1';
  const previousFailureAt = new Map((previous.failures || []).map(row => [
    row && row.symbol,
    row && (row.attemptedAt || row.failedAt || previous.generatedAt || null)
  ]));
  const targets = eligible
    .map(symbol => ({
      symbol,
      fetchedAt: previous.data && previous.data[symbol] && previous.data[symbol].fetchedAt,
      lastFailureAt: previousFailureAt.get(symbol) || null
    }))
    .filter(row => {
      if (force) return true;
      const dataDue = !row.fetchedAt || now - new Date(row.fetchedAt).getTime() >= REFRESH_AFTER_MS;
      const retryDue = retryFailedNow || !row.lastFailureAt || now - new Date(row.lastFailureAt).getTime() >= FAILURE_RETRY_AFTER_MS;
      return dataDue && retryDue;
    })
    .sort((a, b) => Number(Boolean(a.lastFailureAt)) - Number(Boolean(b.lastFailureAt)) || String(a.fetchedAt || '').localeCompare(String(b.fetchedAt || '')) || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);

  const data = { ...(previous.data || {}) };
  const failures = [];
  let updated = 0;
  const attemptedAt = new Date(now).toISOString();
  for (const target of targets) {
    const meta = tickerMap.get(tickerKey(target.symbol));
    try {
      const [facts, submissions] = await Promise.all([
        fetchJSON(`${SEC_FACTS_BASE}${meta.cik}.json`, 2),
        fetchJSON(`${SEC_SUBMISSIONS_BASE}${meta.cik}.json`, 2)
      ]);
      const price = screener.data && screener.data[target.symbol] && screener.data[target.symbol].price;
      const normalized = normalizeSecCompanyFacts(target.symbol, facts, price, submissions);
      if (!normalized) throw new Error('no comparable annual US-GAAP revenue/net-income facts');
      data[target.symbol] = normalized;
      updated++;
    } catch (error) {
      failures.push({ symbol: target.symbol, reason: String(error && error.message || error), attemptedAt });
    }
    await new Promise(resolve => setTimeout(resolve, 150));
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
    failures,
    pointInTimeCoverage: Object.values(data).filter(row => row?.pit?.observationCount > 0).length,
    pointInTimeAcceptedCoverage: Object.values(data).filter(row => row?.pit?.acceptedTimeCount > 0).length,
    batchLimit: limit,
    nextRefreshCandidates: Math.max(0, eligible.length - Object.keys(data).length),
    data
  };
  await atomicWrite(OUT, payload);
  console.log(`[sec-fundamentals] stored=${payload.stored}/${payload.eligible} attempted=${payload.attempted} updated=${updated} failed=${failures.length}`);
  return payload;
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  refreshSecFundamentals().catch(error => {
    console.error('[sec-fundamentals] fatal:', error);
    process.exit(1);
  });
}
