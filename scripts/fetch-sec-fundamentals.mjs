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
import { reconcileSecRecord, bestRevenueRowsByPeriod, shareGapDays, SEC_SHARES_MAX_GAP_DAYS, SEC_MARGIN_HOLD_ABOVE_PCT, SEC_PRIMARY_REVENUE_CONCEPTS, SEC_FALLBACK_REVENUE_CONCEPTS } from '../src/domain/fundamental/sec-report.js';
// v57.81: the companyfacts normalizer lives in src/domain/fundamental/sec-normalize.js (shared with the browser's
// out-of-universe issuer read); re-exported here so the gates and callers keep their imports.
import { tickerKey, SEC_NORMALIZER_VERSION, SEC_CONCEPT_SET_VERSION, SEC_CONCEPT_SET_REASON_CODES, SEC_SUCCESSOR_ISSUERS, mergeSuccessorCompanyFacts, mergeSuccessorSubmissions, classifyIssuerCapability, parseClassShareFacts, classInstanceUrl, normalizeSecCompanyFacts } from '../src/domain/fundamental/sec-normalize.js';
import { secClassification } from '../src/domain/fundamental/sic-sector.js';
export { SEC_NORMALIZER_VERSION, SEC_CONCEPT_SET_VERSION, SEC_CONCEPT_SET_REASON_CODES, reportingBasis, classifyIssuerCapability, parseClassShareFacts, CLASS_EPS_TOLERANCE, selectClassDimensionedShares, classInstanceUrl, RECENT_FILING_WINDOW_DAYS, RECENT_FILING_MAX, recentFilingsFrom, normalizeSecCompanyFacts } from '../src/domain/fundamental/sec-normalize.js';
import { buildDomainReceipt } from './lib/domain-receipt.mjs';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.95 core row encoding

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
// v58.55: a normalizer change that adds observation fields (total assets and R&D for DuPont, Sloan accruals and R&D ÷
// revenue) makes every stored core record due at once. At 24 per run (5 runs a day) the ~840 core issuers took about
// a week, so records due ONLY for that backfill get extra slots on top of the normal batch: 24 + 48 = 72 issuers per
// run (~2 SEC requests each at the 150 ms pace, about 1-2 minutes, well under SEC's 10 requests/second), which fills
// the core ledger in about 12 runs (2-3 days). The extra slots never take failures, new issuers or regular refreshes.
export const SEC_BACKFILL_EXTRA_DEFAULT = 48;
const REFRESH_AFTER_MS = 28 * 86400000;
// v58.71 (pipeline audit): a stored record waited up to 28 days after its issuer filed a new 10-Q/10-K, so TTM P/E and
// quarters showed the previous quarter as current through earnings season. EDGAR's daily form index (one small file per
// business day) names every periodic filer; an issuer that filed on or after its record's fetch date is due now.
const SEC_DAILY_INDEX_BASE = 'https://www.sec.gov/Archives/edgar/daily-index';
const SEC_PERIODIC_FORMS = new Set(['10-Q', '10-K', '10-Q/A', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '10-KT', '10-QT']);
export const SEC_FILING_LOOKBACK_DAYS = 7;
const FAILURE_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = process.env.SEC_USER_AGENT || '';


async function fetchJSON(url, tries = 3, as = 'json') {
  let lastError;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': as === 'json' ? 'application/json' : 'application/xml',
          'Accept-Encoding': 'gzip, deflate'
        },
        signal: ctrl.signal
      });
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      return as === 'json' ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      if (i + 1 < tries) await new Promise(resolve => setTimeout(resolve, 900 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// Pure (v58.71): the form-type daily index as cik -> latest filing date (YYYY-MM-DD) for periodic report forms.
export function parsePeriodicFilers(indexText, into = new Map()) {
  for (const line of String(indexText || '').split(/\r?\n/)) {
    const form = line.slice(0, 12).trim();
    if (!SEC_PERIODIC_FORMS.has(form)) continue;
    const match = line.match(/\s(\d{8})\s+edgar\/data\/(\d+)\//);
    if (!match) continue;
    const date = `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
    const cik = match[2].padStart(10, '0');
    if (!into.has(cik) || into.get(cik) < date) into.set(cik, date);
  }
  return into;
}

// The last few business days of periodic filers; a missing day (holiday, not yet published) or a failed read is skipped,
// so the age rule alone still governs when EDGAR is unreachable.
async function recentPeriodicFilers(nowMs, days = SEC_FILING_LOOKBACK_DAYS) {
  const filers = new Map();
  let read = 0;
  for (let back = 1; back <= days; back++) {
    const day = new Date(nowMs - back * 86400000);
    if ([0, 6].includes(day.getUTCDay())) continue;
    const ymd = day.toISOString().slice(0, 10).replace(/-/g, '');
    const quarter = Math.floor(day.getUTCMonth() / 3) + 1;
    try {
      parsePeriodicFilers(await fetchJSON(`${SEC_DAILY_INDEX_BASE}/${ymd.slice(0, 4)}/QTR${quarter}/form.${ymd}.idx`, 1, 'text'), filers);
      read++;
    } catch { /* not published or unreachable */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return { filers, read };
}

// F08: same reading as the screener universe (fetch-data getScreenerUniverse assetType): an explicit assetType,
// else sector or index 'ETF'.
export function isEtfUniverseRow(row) {
  if (!row || !row.sym) return false;
  return [row.assetType, row.sector, row.index].some((value) => String(value || '').trim().toUpperCase() === 'ETF');
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

// v57.81: the extended screener universe (Russell 2000 + Nasdaq common stocks outside the core) keeps its own ledger.
// Records are the same normalizeSecCompanyFacts output with the point-in-time observation arrays dropped (the
// ~90 KB/issuer arrays feed the core 재무 공시 projection only), so ~4,000 issuers stay a few MB on main instead of
// growing the producer-only core ledger past the data-store push limit. The batch converges over daily runs.
export const SEC_EXTENDED_LEDGER = `${ROOT}/public-data/sec-fundamentals-extended.json`;
export const SEC_EXTENDED_UNIVERSE = `${ROOT}/public-data/screener-extended-universe.json`;
export const SEC_EXTENDED_DEFAULT_BATCH = 600;
// 2026-10-16 (P1872 follow-up): the ledger keeps each issuer's SEC Standard Industrial Classification in `issuerSic`
// so the ranker can drop blank-check companies (SIC 6770) by the filer's own code instead of its name. Every
// submissions read records it — including issuers whose facts are terminal-unsupported (most SPACs report no
// revenue) — and a SIC-only pass (one submissions request each, same 150 ms pace) fills issuers without a code or
// with one older than 30 days (a de-SPAC can keep its ticker and change code). A failed read keeps the previous code.
export const SEC_SIC_BACKFILL_DEFAULT = 800;
export const SEC_SIC_REFRESH_AFTER_MS = 30 * 86400000;
export function compactSecRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const { recentFilings, ...rest } = record;
  const pit = record.pit && typeof record.pit === 'object'
    ? { schemaVersion: record.pit.schemaVersion, status: record.pit.status, observationCount: record.pit.observationCount, acceptedTimeCount: record.pit.acceptedTimeCount, observationsDropped: 'extended-ledger-compact' }
    : record.pit;
  return { ...rest, pit };
}
export function extendedSecOptions(env = process.env) {
  return {
    scope: 'extended',
    universePath: SEC_EXTENDED_UNIVERSE,
    outPath: SEC_EXTENDED_LEDGER,
    compact: true,
    requireRestored: false,
    batchLimit: Math.max(1, Math.min(2000, Number(env.SEC_EXTENDED_BATCH_LIMIT) || SEC_EXTENDED_DEFAULT_BATCH)),
    sicBackfillLimit: Math.max(0, Math.min(2000, Number(env.SEC_SIC_BACKFILL_LIMIT ?? SEC_SIC_BACKFILL_DEFAULT) || 0))
  };
}

// Pure: the SIC-only pass picks issuers not already read this run — never-classified first, then the oldest code.
export function sicBackfillTargets(eligible, issuerSic, attemptedSymbols, { limit, nowMs, refreshAfterMs = SEC_SIC_REFRESH_AFTER_MS }) {
  if (!(limit > 0)) return [];
  const observed = (symbol) => Date.parse(issuerSic[symbol]?.observedAt || '');
  return eligible
    .filter(symbol => !attemptedSymbols.has(symbol) && !(nowMs - observed(symbol) < refreshAfterMs))
    .sort((a, b) => Number(Boolean(issuerSic[a])) - Number(Boolean(issuerSic[b])) || (observed(a) || 0) - (observed(b) || 0) || a.localeCompare(b))
    .slice(0, limit);
}

// Pure (v58.55): the normal batch first, then up to `extra` stored records that are due only because their observation
// arrays predate the current normalizer (no failure, fetched inside the regular refresh window).
export function selectSecBatch(sorted, limit, extra = 0, nowMs = Date.now(), refreshAfterMs = REFRESH_AFTER_MS) {
  const primary = sorted.slice(0, limit);
  if (!(extra > 0)) return primary;
  const backfillOnly = (row) => (row.assetChainMissing || row.normalizerOutdated) && row.fetchedAt && !row.priorFailure && !row.cashChainMissing && !row.conceptSetChanged
    && nowMs - new Date(row.fetchedAt).getTime() < refreshAfterMs;
  return [...primary, ...sorted.slice(limit).filter(backfillOnly).slice(0, extra)];
}

export async function refreshSecFundamentals(priceHints = null, { scope = 'core', universePath = UNIVERSE_PATH, outPath = OUT, compact = false, requireRestored = true, batchLimit = null, sicBackfillLimit = 0 } = {}) {
  const universePayload = await readJSON(universePath, { universe: [] });
  const screener = expandScreenerArtifact(await readJSON(SCREENER_PATH, { data: {} }));
  let previousExists = true;
  let previous;
  try { previous = JSON.parse(await readFile(outPath, 'utf8')); } catch { previousExists = false; previous = { schemaVersion: '2.0', data: {} }; }
  // P1757: the ledger is producer-only (data-store branch) and restored before this runs. In Actions a missing ledger
  // means the restore chain failed; starting from nothing with a 24-symbol batch would publish a near-empty projection,
  // so only an explicit full rebuild (SEC_FULL_REBUILD=1, set by the workflow when every restore source is gone) may.
  // v57.81: the extended ledger lives on main and starts empty by design (requireRestored false).
  const fullRebuild = process.env.SEC_FULL_REBUILD === '1' && scope === 'core';
  if (requireRestored && !previousExists && process.env.GITHUB_ACTIONS === 'true' && !fullRebuild) {
    throw new Error('P1757: public-data/sec-fundamentals.json was not restored (run scripts/sec-fundamentals-store.mjs restore, or set SEC_FULL_REBUILD=1 for a deliberate full rebuild)');
  }
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
      await atomicWrite(outPath, skipped);
    }
    console.warn('[sec-fundamentals] skipped: SEC_USER_AGENT repository variable is required by SEC fair-access policy');
    return skipped;
  }
  // F08 (2026-10-13): ETFs/trusts are not operating companies — a commodity trust's "revenue" is its trading
  // gain or loss (USO margin 115%, SLV negative revenue). They are excluded from collection and pruned below.
  const etfSymbols = new Set((universePayload.universe || []).filter(isEtfUniverseRow).map(row => row.sym));
  const symbols = (universePayload.universe || []).map(row => row && row.sym).filter(sym => sym && !/\.(KS|KQ)$/i.test(sym) && !etfSymbols.has(sym));
  if (scope !== 'core' && !symbols.length) {
    console.log(`::warning::[sec-fundamentals:${scope}] universe ${universePath} is missing or empty — ledger left unchanged`);
    return previous;
  }
  const tickerPayload = await fetchJSON(SEC_TICKERS_URL);
  const tickerMap = buildTickerMap(tickerPayload);
  const eligible = symbols.filter(symbol => tickerMap.has(tickerKey(symbol)));
  const now = Date.now();
  // P1757: a full rebuild collects every eligible issuer in one run (~2 SEC requests each at the 150 ms pace).
  const limit = fullRebuild ? Math.max(1, eligible.length) : Number.isFinite(batchLimit) && batchLimit > 0 ? Math.floor(batchLimit) : Math.max(1, Math.min(100, Number(process.env.SEC_BATCH_LIMIT) || DEFAULT_BATCH_LIMIT));
  const force = process.env.SEC_REFRESH === '1';
  const retryFailedNow = process.env.SEC_RETRY_FAILED === '1';
  const periodic = force || fullRebuild ? { filers: new Map(), read: 0 } : await recentPeriodicFilers(now);
  console.log(`[sec-fundamentals:${scope}] periodic filers in the last ${SEC_FILING_LOOKBACK_DAYS} days: ${periodic.filers.size} (${periodic.read} daily indexes read)`);
  const previousFailureRecords = new Map((previous.failures || []).map(row => [row && row.symbol, row]).filter(([symbol]) => symbol));
  const previousFailureAt = new Map([...previousFailureRecords.entries()].map(([symbol, row]) => [
    symbol,
    row && (row.attemptedAt || row.failedAt || previous.generatedAt || null)
  ]));
  const recheckUnsupported = process.env.SEC_RECHECK_UNSUPPORTED === '1';
  const backfillExtra = scope === 'core' ? Math.max(0, Math.min(100, Number(process.env.SEC_BACKFILL_EXTRA ?? SEC_BACKFILL_EXTRA_DEFAULT) || 0)) : 0;
  const dueTargets = eligible
    .map(symbol => ({
      symbol,
      fetchedAt: previous.data && previous.data[symbol] && previous.data[symbol].fetchedAt,
      // Codex review 2026-10-05: P1446 added the cash chain (operating cash flow, capex, debt) to new
      // fetches, but stored records only refresh after REFRESH_AFTER_MS, so all 592 published issuers
      // still lacked it. A stored record without the cash-chain observations is due now.
      // v57.81: a compact (extended) record drops the observation arrays on purpose, so it is never 'missing' them.
      cashChainMissing: !compact && Boolean(previous.data && previous.data[symbol] && (!Array.isArray(previous.data[symbol]?.pit?.observations?.operatingCashFlow) || !Array.isArray(previous.data[symbol]?.pit?.observations?.revenueQ))),
      // 2026-10-13 F04: a record from an older normalizer (494 of 659 lacked the P1587 share check) is due now;
      // the publish-time heal below covers what its stored observations allow until then.
      normalizerOutdated: Boolean(previous.data && previous.data[symbol] && previous.data[symbol].normalizerVersion !== SEC_NORMALIZER_VERSION),
      // v58.55: a stored record without the total-assets / R&D observation arrays (written before they were read).
      assetChainMissing: !compact && Boolean(previous.data && previous.data[symbol] && !Array.isArray(previous.data[symbol]?.pit?.observations?.totalAssets)),
      // P1798: a stored record without a share count leaves market cap, P/E and the value factor blank (GOOGL/META
      // waited 2-5 days behind 700 outdated records), so it is refreshed first among the due records.
      // 2026-10-17: a count withheld by policy (non-USD report, 20-F ordinary shares) is not missing — a re-read cannot fill it.
      newFiling: Boolean(previous.data?.[symbol]?.fetchedAt && (periodic.filers.get(tickerMap.get(tickerKey(symbol))?.cik) || '') >= String(previous.data[symbol].fetchedAt).slice(0, 10)),
      sharesMissing: Boolean(previous.data && previous.data[symbol] && !(Number(previous.data[symbol].sharesOutstanding) > 0)
        && !['reporting-currency-differs', 'foreign-share-basis-unverified'].includes(previous.data[symbol].sharesCheck)),
      lastFailureAt: previousFailureAt.get(symbol) || null,
      priorFailure: previousFailureRecords.get(symbol) || null,
      // v6: the terminal IFRS rows (no conceptSetVersion) are rechecked under the IFRS basis the same way.
      conceptSetChanged: SEC_CONCEPT_SET_REASON_CODES.includes(previousFailureRecords.get(symbol)?.reasonCode)
        && previousFailureRecords.get(symbol)?.conceptSetVersion !== SEC_CONCEPT_SET_VERSION
    }))
    .filter(row => {
      if (force) return true;
      const conceptSetChanged = row.conceptSetChanged;
      // v57.87: a successor registrant (SEC_SUCCESSOR_ISSUERS) is rechecked once per entry version with its predecessor's facts.
      const successor = SEC_SUCCESSOR_ISSUERS[tickerMap.get(tickerKey(row.symbol))?.cik];
      if (successor && row.priorFailure && row.priorFailure.successorVersion !== successor.version) return true;
      if (row.priorFailure?.status === 'TERMINAL_UNSUPPORTED' && !recheckUnsupported && !conceptSetChanged) return false;
      if (conceptSetChanged) return true;
      const dataDue = !row.fetchedAt || row.newFiling || row.cashChainMissing || row.normalizerOutdated || now - new Date(row.fetchedAt).getTime() >= REFRESH_AFTER_MS;
      const retryDue = retryFailedNow || !row.lastFailureAt || now - new Date(row.lastFailureAt).getTime() >= FAILURE_RETRY_AFTER_MS;
      return dataDue && retryDue;
    })
    // Prefer never-attempted and retryable candidates. Terminal taxonomy
    // failures remain in the audit but cannot starve fresh coverage.
    // 2026-10-16: a failure recorded under an older concept set is rechecked FIRST. It sorted last behind every due
    // record, and a normalizer bump makes ~750 records due at 24 per run, so GS/CRWD/VLO/ODFL/KHC/ARE/SJM (normalizable
    // since v3/v4) sat a month as failures. Each recheck stamps the current version, so this set is bounded.
    .sort((a, b) => Number(b.conceptSetChanged) - Number(a.conceptSetChanged) || Number(Boolean(a.priorFailure)) - Number(Boolean(b.priorFailure)) || Number(b.newFiling) - Number(a.newFiling) || Number(b.sharesMissing) - Number(a.sharesMissing) || String(a.fetchedAt || '').localeCompare(String(b.fetchedAt || '')) || a.symbol.localeCompare(b.symbol));
  const targets = selectSecBatch(dueTargets, limit, fullRebuild || force ? 0 : backfillExtra, now, REFRESH_AFTER_MS);

  const data = { ...(previous.data || {}) };
  const failuresBySymbol = new Map([...previousFailureRecords.entries()]);
  let updated = 0;
  const attemptedAt = new Date(now).toISOString();
  const issuerSic = previous.issuerSic && typeof previous.issuerSic === 'object' ? { ...previous.issuerSic } : {};
  const recordSic = (symbol, cik, submissions) => {
    const classification = secClassification(submissions);
    if (classification) issuerSic[symbol] = { sic: classification.sic, description: classification.description, cik, observedAt: attemptedAt };
    return Boolean(classification);
  };
  for (const target of targets) {
    const meta = tickerMap.get(tickerKey(target.symbol));
    try {
      let [facts, submissions] = await Promise.all([
        fetchJSON(`${SEC_FACTS_BASE}${meta.cik}.json`, 2),
        fetchJSON(`${SEC_SUBMISSIONS_BASE}${meta.cik}.json`, 2)
      ]);
      recordSic(target.symbol, meta.cik, submissions);
      const successor = SEC_SUCCESSOR_ISSUERS[meta.cik] || null;
      const ownAccessions = new Set(submissions?.filings?.recent?.accessionNumber || []);
      if (successor) {
        const [priorFacts, priorSubmissions] = await Promise.all([
          fetchJSON(`${SEC_FACTS_BASE}${successor.predecessorCik}.json`, 2),
          fetchJSON(`${SEC_SUBMISSIONS_BASE}${successor.predecessorCik}.json`, 2)
        ]);
        facts = mergeSuccessorCompanyFacts(facts, priorFacts);
        submissions = mergeSuccessorSubmissions(submissions, priorSubmissions);
      }
      const successorStamp = successor ? { successorVersion: successor.version, predecessorCik: successor.predecessorCik } : {};
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
          retryPolicy: 'manual-or-explicit-SEC_RECHECK_UNSUPPORTED',
          ...successorStamp
        });
        continue;
      }
      let normalized = normalizeSecCompanyFacts(target.symbol, facts, price, submissions);
      // P1798: no count in companyfacts — read the class-dimensioned facts from the same 10-K's XBRL instance.
      const instanceUrl = normalized && normalized.sharesOutstanding == null && ['stale-period', 'unreported'].includes(normalized.sharesCheck)
        ? classInstanceUrl(successor && !ownAccessions.has(normalized.accession) ? successor.predecessorCik : meta.cik, normalized.accession, submissions) : null;
      if (instanceUrl) {
        try {
          const classFacts = parseClassShareFacts(await fetchJSON(instanceUrl, 2, 'xml'));
          normalized = normalizeSecCompanyFacts(target.symbol, facts, price, submissions, classFacts);
        } catch (error) {
          normalized = { ...normalized, sharesClassCheck: 'class-instance-unavailable' };
        }
      }
      if (!normalized) {
        failuresBySymbol.set(target.symbol, {
          symbol: target.symbol,
          status: 'TERMINAL_UNSUPPORTED',
          reasonCode: capability.issuerTaxonomy === 'IFRS' ? 'required-ifrs-annual-concepts-unavailable' : 'required-us-gaap-annual-concepts-unavailable',
          reason: capability.issuerTaxonomy === 'IFRS' ? 'no comparable annual IFRS revenue facts' : 'no comparable annual US-GAAP revenue/net-income facts',
          conceptSetVersion: SEC_CONCEPT_SET_VERSION,
          issuerTaxonomy: capability.issuerTaxonomy,
          filingForms: capability.filingForms,
          attemptedAt,
          retryPolicy: 'manual-or-explicit-SEC_RECHECK_UNSUPPORTED',
          ...successorStamp
        });
        continue;
      }
      data[target.symbol] = compact ? compactSecRecord(normalized) : normalized;
      failuresBySymbol.delete(target.symbol);
      updated++;
    } catch (error) {
      failuresBySymbol.set(target.symbol, { symbol: target.symbol, status: 'TRANSIENT_PROVIDER_FAILURE', reasonCode: 'provider-or-network-error', reason: String(error && error.message || error), attemptedAt, retryAfterMs: FAILURE_RETRY_AFTER_MS });
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const sicTargets = sicBackfillTargets(eligible, issuerSic, new Set(targets.map(target => target.symbol)), { limit: sicBackfillLimit, nowMs: now });
  let sicUpdated = 0;
  let sicFailed = 0;
  for (const symbol of sicTargets) {
    const meta = tickerMap.get(tickerKey(symbol));
    try {
      if (recordSic(symbol, meta.cik, await fetchJSON(`${SEC_SUBMISSIONS_BASE}${meta.cik}.json`, 2))) sicUpdated++;
    } catch {
      sicFailed++;
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
  // v57.81: the extended ledger follows its universe — a symbol that left it (moved into the core or delisted) is dropped.
  const universeSymbols = new Set(symbols);
  // v58.71 (pipeline audit): the core ledger kept AVB, BRK.B, PSKY, WBD and EA after they left the universe (EA last read
  // 08-14), inflating `stored`. The core follows its universe too, unless the universe read came back implausibly small.
  const pruneLeavers = scope !== 'core' || universeSymbols.size >= 500;
  for (const [symbol, record] of Object.entries(data)) {
    if (etfSymbols.has(symbol) || (pruneLeavers && !universeSymbols.has(symbol))) { delete data[symbol]; etfPruned++; continue; }
    const healed = reconcileSecRecord(record); // + 2026-10-17 D1/D2/D7 earnings basis
    if (healed !== record) { data[symbol] = healed; healedCount++; }
  }
  for (const symbol of Object.keys(issuerSic)) if (etfSymbols.has(symbol) || !universeSymbols.has(symbol)) delete issuerSic[symbol];

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
    backfillExtra,
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
  if (scope !== 'core') { payload.scope = scope; payload.recordPolicy = compact ? 'compact: normalized annual record without point-in-time observation arrays' : 'full'; }
  payload.issuerSicPolicy = `SEC submissions sic per issuer; recorded on every submissions read plus a SIC-only pass of up to ${sicBackfillLimit} issuers (missing first, then older than ${SEC_SIC_REFRESH_AFTER_MS / 86400000} days); a failed read keeps the previous code`;
  payload.issuerSicCoverage = { classified: Object.keys(issuerSic).length, eligible: eligible.length, passAttempted: sicTargets.length, passUpdated: sicUpdated, passFailed: sicFailed };
  payload.issuerSic = Object.fromEntries(Object.entries(issuerSic).sort(([a], [b]) => a.localeCompare(b)));
  await atomicWrite(outPath, payload);
  console.log(`[sec-fundamentals${scope === 'core' ? '' : `:${scope}`}] stored=${payload.stored}/${payload.eligible} attempted=${payload.attempted} updated=${updated} failed=${payload.failures.length} terminalUnsupported=${payload.terminalUnsupported.length} healed=${healedCount} etfPruned=${etfPruned} sic=${payload.issuerSicCoverage.classified} (pass ${sicUpdated}/${sicTargets.length})`);
  return payload;
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  // v57.81: SEC_LEDGER_SCOPE=extended refreshes the extended-universe ledger (refresh-screener extended job).
  (process.env.SEC_LEDGER_SCOPE === 'extended' ? refreshSecFundamentals(null, extendedSecOptions()) : refreshSecFundamentals()).catch(error => {
    console.error('[sec-fundamentals] fatal:', error);
    process.exit(1);
  });
}
