// Extended screener shard (screener-extended.json): same row schema as the core lane, its own job and freshness.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { factorScopesByMarket } from '../../src/domain/market/session-time.js';
import { round } from '../lib/producer-math.mjs';
import { EXTENDED_SHARD_SCHEMA, RANKING_CONTRACTS, encodeShardRows, isValidShard } from '../../src/data/screener-extended.js';
import { REPO_ROOT } from './paths.mjs';
import { SCREENER_OUT, screenerAssetType, getScreenerUniverse, enrichSecFundamentals, _enrichPriceFactors, mergeSecIntoFactorRows } from './screener.mjs';

// ── v57.81: extended universe shard (Russell 2000 + Nasdaq-listed common stocks outside the core) ──
// Owner (2026-10-15): every Russell 2000 member and every Nasdaq-listed stock must be ranked with the same factors.
// The core artifact (screener.json) keeps its size and contract; the extra rows go to screener-extended.json with the
// same row schema, produced by the same _enrichPriceFactors / enrichSecFundamentals / mergeSecIntoFactorRows path.
// It runs as its own job after the core refresh (refresh-screener.yml), so a failure here never touches the core.
const SCREENER_EXTENDED_OUT = `${REPO_ROOT}/public-data/screener-extended.json`;
const SCREENER_EXTENDED_UNIVERSE = `${REPO_ROOT}/public-data/screener-extended-universe.json`;
const SEC_EXTENDED_LEDGER_PATH = `${REPO_ROOT}/public-data/sec-fundamentals-extended.json`;
// Below this share of fetched histories the run is treated as a provider failure: the previous shard stays.
export const EXTENDED_SHARD_COVERAGE_FLOOR = 0.6;
// A full refresh runs once per new US session (the core's US factor session advanced past the shard's), with an age
// backstop so a missed trigger heals within a day. Rows all describe one session, so no rotation is needed.
export const EXTENDED_REFRESH_MAX_AGE_MS = 26 * 3600 * 1000;

export function extendedRefreshDue({ previousShard = null, coreScreener = null, nowMs = Date.now(), force = false } = {}) {
  if (force) return { due: true, reason: 'forced' };
  if (!previousShard?.asOf || !isValidShard(previousShard)) return { due: true, reason: 'no-previous-shard' };
  const previousSession = previousShard.factorSessionDateByMarket?.US || null;
  const coreSession = coreScreener?.factorSessionDateByMarket?.US || null;
  if (coreSession && (!previousSession || previousSession < coreSession)) return { due: true, reason: `core-session-advanced:${previousSession || 'none'}->${coreSession}` };
  const ageMs = nowMs - Date.parse(previousShard.asOf);
  if (!(ageMs < EXTENDED_REFRESH_MAX_AGE_MS)) return { due: true, reason: 'age-backstop' };
  return { due: false, reason: `shard-current:${previousSession || 'unknown'}` };
}

export function buildExtendedShardPayload({ data, syms, identityRows, membership, secResult, computedAt, ok, nowIso = new Date().toISOString() }) {
  const factorScopes = factorScopesByMarket(data);
  const fundamentalCount = syms.filter((sym) => ['pe', 'pb', 'roe', 'margin', 'revGrowth'].some((key) => typeof data[sym]?.[key] === 'number' && Number.isFinite(data[sym][key]))).length;
  const sources = membership?.meta?.sources || {};
  const encoded = encodeShardRows(data);
  return {
    schemaVersion: EXTENDED_SHARD_SCHEMA,
    asOf: nowIso,
    factorObservedAt: factorScopes.US?.barStart || null,
    factorTimeBasis: 'bar-start',
    factorSessionDateByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.sessionDate])),
    factorBarStartByMarket: Object.fromEntries(Object.entries(factorScopes).map(([market, scope]) => [market, scope.barStart])),
    factorComputedAt: computedAt,
    source: 'github-actions:yahoo-1y',
    universe: syms.length,
    ok,
    unfetchedSymbols: syms.filter((sym) => !data[sym]).sort(),
    coverage: { pricePct: syms.length ? round(ok / syms.length * 100, 1) : 0, floorPct: EXTENDED_SHARD_COVERAGE_FLOOR * 100, fundamentalCount, fundamentalCoveragePct: syms.length ? round(fundamentalCount / syms.length * 100, 1) : 0 },
    membership: {
      artifact: 'public-data/screener-extended-universe.json',
      generatedAt: membership?.generatedAt || null,
      asOf: { r2000: sources.r2000?.asOf || null, nasdaq: sources.nasdaq?.asOf || null },
      status: { r2000: sources.r2000?.status || 'UNKNOWN', nasdaq: sources.nasdaq?.status || 'UNKNOWN' },
      counts: membership?.meta?.counts || null
    },
    fmpHasKey: false,
    secFundamentalsOk: secResult.ok > 0,
    secFundamentalsCount: secResult.ok,
    secFundamentalsStored: secResult.stored,
    secFundamentalsEligible: secResult.eligible,
    secFundamentalsModel: secResult.model,
    secFundamentalsGeneratedAt: secResult.generatedAt,
    fundamentalCount,
    fundamentalCoveragePct: syms.length ? round(fundamentalCount / syms.length * 100, 1) : 0,
    fundamentalCoverageDenominator: syms.length,
    fundamentalModels: ['sec-fy-normalized-v2'],
    fundamentalCoverageScope: 'extended universe (Russell 2000 + Nasdaq common stocks outside the core); SEC annual facts from the compact extended ledger, filled over daily batches',
    rankingContract: {
      contract: RANKING_CONTRACTS.extended.id,
      label: RANKING_CONTRACTS.extended.label,
      population: RANKING_CONTRACTS.extended.population,
      allowedUse: 'research-relative-ranking-only',
      tradingSignal: false,
      predictiveValidation: 'not-established',
      liveModelParity: false,
      validationReadiness: { status: 'BLOCKED', blockers: ['extended-universe-not-backtested'] },
      percentilePolicy: 'The browser recomputes factor percentiles over core + extended rows of the same market. The core view ranks the core universe only, so a core stock can hold a different percentile in each view.',
      coreOnly: ['backtest', 'candidate-archive', 'conditional-evidence', 'model-validation'],
      weightPolicy: 'fixed-neutral-until-explicit-promotion',
      reason: 'same factor model as the core artifact; the extended population has no backtest or forward candidate record'
    },
    universeLineage: {
      generatedFrom: 'public-data/screener-extended-universe.json',
      membershipPolicy: 'current-membership-applied-retrospectively',
      lookaheadBias: 'historical-membership-not-available',
      survivorshipBias: 'uncontrolled-current-membership-only',
      allowedUse: 'research-reference-not-predictive-validation'
    },
    coreMembership: membership?.coreMembership && typeof membership.coreMembership === 'object' ? membership.coreMembership : {},
    // 2026-10-17: SEC's description of each SIC code the identity rows carry, written once per code (the browser fills a
    // Nasdaq-only row's sector from its code and names the code and this description as the industry).
    sicDescriptions: sicDescriptionMap(identityRows.map((row) => secResult?.sicBySymbol?.[row.sym])),
    identity: identityRows.map((row) => ({
      sym: row.sym, name: row.name || row.sym, sector: row.sector || null, index: row.index || null,
      membership: Array.isArray(row.membership) ? row.membership : [], exchange: row.exchange || null,
      ...(row.nasdaqFinancialStatus ? { nasdaqFinancialStatus: row.nasdaqFinancialStatus } : {}),
      // 2026-10-16: SEC SIC from the extended ledger; the ranker drops blank checks (6770) by this code, not the name.
      ...(/^\d{3,4}$/.test(String(secResult?.sicBySymbol?.[row.sym]?.sic || '')) ? { sic: String(secResult.sicBySymbol[row.sym].sic) } : {})
    })),
    ...encoded
  };
}

export function sicDescriptionMap(entries) {
  const map = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const code = String(entry?.sic || '');
    const description = String(entry?.description || '').replace(/\s+/g, ' ').trim();
    if (/^\d{3,4}$/.test(code) && description && !map[code]) map[code] = description;
  }
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
}

export async function enrichScreenerExtended({ nowMs = Date.now() } = {}) {
  let membership = null;
  try { membership = JSON.parse(await readFile(SCREENER_EXTENDED_UNIVERSE, 'utf8')); } catch { /* not produced yet */ }
  if (!Array.isArray(membership?.universe) || !membership.universe.length) return { skipped: true, reason: 'no-extended-universe' };
  let previous = null;
  try { previous = JSON.parse(await readFile(SCREENER_EXTENDED_OUT, 'utf8')); } catch { /* first run */ }
  let core = null;
  try { core = JSON.parse(await readFile(SCREENER_OUT, 'utf8')); } catch { /* core missing: the age rule decides */ }
  const due = extendedRefreshDue({ previousShard: previous, coreScreener: core, nowMs, force: process.env.SCREENER_EXTENDED_FORCE === '1' });
  if (!due.due) { console.log(`[fetch-data] extended shard not due (${due.reason})`); return { skipped: true, reason: due.reason }; }
  // The core universe may have grown since the membership file was written; a core symbol is never duplicated here.
  const coreSymbols = new Set((await getScreenerUniverse()).symbols);
  const identityRows = membership.universe.filter((row) => row && row.sym && !coreSymbols.has(row.sym));
  const syms = identityRows.map((row) => row.sym);
  const assetType = Object.fromEntries(identityRows.map((row) => [row.sym, screenerAssetType(row)]));
  const concurrency = Math.max(1, Math.min(8, Number(process.env.SCREENER_EXTENDED_CONCURRENCY) || 5));
  const startedAt = Date.now();
  const { data, results, ok, computedAt } = await _enrichPriceFactors(syms, { concurrency });
  console.log(`[fetch-data] extended price factors ${ok}/${syms.length} in ${Math.round((Date.now() - startedAt) / 1000)}s (concurrency ${concurrency}, due: ${due.reason})`);
  const secResult = await enrichSecFundamentals(syms, data, results, assetType, { ledgerPath: SEC_EXTENDED_LEDGER_PATH });
  mergeSecIntoFactorRows(data, secResult.data);
  // P715: no raw price is published. Ticker news is collected for the core only; the status says so per row.
  for (const sym in data) {
    if (data[sym] && 'price' in data[sym]) delete data[sym].price;
    data[sym].newsStatus = 'not-covered';
  }
  if (syms.length && ok / syms.length < EXTENDED_SHARD_COVERAGE_FLOOR) {
    console.log(`::warning::extended shard: ${ok}/${syms.length} histories (< ${EXTENDED_SHARD_COVERAGE_FLOOR * 100}%) — ${previous ? 'previous shard kept' : 'nothing written'}`);
    return { retained: !!previous, count: ok, universe: syms.length };
  }
  const payload = buildExtendedShardPayload({ data, syms, identityRows, membership, secResult, computedAt, ok });
  await atomicWriteFile(SCREENER_EXTENDED_OUT, JSON.stringify(payload));
  console.log(`[fetch-data] extended shard ${ok}/${syms.length} rows · fundamentals ${payload.fundamentalCount} (${payload.fundamentalCoveragePct}%) · US session ${payload.factorSessionDateByMarket.US || '-'}`);
  return { count: ok, universe: syms.length, asOf: payload.asOf };
}

// v57.81: SESSION_CLOSE_RULES, sessionSegmentOfSymbol, listingCurrencyOf and isSessionComplete live in
// src/domain/screener/price-factors.js (shared with the browser's out-of-universe read).
