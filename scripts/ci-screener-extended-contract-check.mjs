#!/usr/bin/env node
// v57.81: contract gate for the extended screener universe (every Russell 2000 member and every Nasdaq-listed common
// stock beyond the core). Runs without the network: canned IWM/nasdaqlisted/otherlisted samples, the membership floor
// and retain-on-failure rule, the lossless row encoding, schema parity with core rows, the provider's lazy shard read
// (the default view never requests it), the ranking contract label, the workflow job shape and every registration.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEMBERSHIP_FLOORS, buildExtendedUniverse, isNasdaqCommonStock, parseIwmHoldings, parseNasdaqListed, parseOtherListed
} from './lib/extended-universe.mjs';
import { validateExtendedShard } from './lib/screener-extended-validate.mjs';
import { buildExtendedShardPayload, extendedRefreshDue, EXTENDED_SHARD_COVERAGE_FLOOR } from './fetch-data.mjs';
import { compactSecRecord, extendedSecOptions } from './fetch-sec-fundamentals.mjs';
import { deriveExtendedScreenerAvailability } from './build-operations-status.mjs';
import {
  EXTENDED_SHARD_SCHEMA, EXTENDED_SHARD_URL, RANKING_CONTRACTS, encodeShardRows, expandShardRows, readUniverseScope, writeUniverseScope
} from '../src/data/screener-extended.js';
import { createScreenerProvider } from '../src/data/providers/screener.js';
import { createScreenerOrchestrator } from '../src/data/orchestrators/screener.js';
import { computeFactorRanks } from '../src/domain/screener/factor-ranks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const failures = [];
let passed = 0;
const check = (label, ok, detail = '') => { if (ok) passed += 1; else failures.push(`${label}${detail ? `: ${detail}` : ''}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. Membership parsers on canned samples (v57.81) ─────────────────────────────────────────────────────────────
const IWM_SAMPLE = [
  'iShares Russell 2000 ETF',
  'Fund Holdings as of,"Oct 14, 2026"',
  'Inception Date,"May 22, 2000"',
  'Shares Outstanding,"300,000,000.00"',
  'Stock,"-"', 'Bond,"-"', 'Cash,"-"', 'Other,"-"', ' ',
  'Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Quantity,Price,Location,Exchange,Currency,FX Rate,Market Currency,Accrual Date',
  '"CRDO","CREDO TECHNOLOGY GROUP HOLDING LT","Information Technology","Equity","1,000.00","0.50","1,000.00","10.00","100.00","United States","NASDAQ","USD","1.00","USD","-"',
  '"MOGA","MOOG INC CLASS A","Industrials","Equity","900.00","0.45","900.00","9.00","100.00","United States","New York Stock Exchange Inc.","USD","1.00","USD","-"',
  '"FN","FABRINET","Information Technology","Equity","800.00","0.40","800.00","8.00","100.00","United States","New York Stock Exchange Inc.","USD","1.00","USD","-"',
  '"HIMS","HIMS & HERS HEALTH INC CLASS A","Health Care","Equity","700.00","0.35","700.00","7.00","100.00","United States","New York Stock Exchange Inc.","USD","1.00","USD","-"',
  '"OMNIAB CVR","OMNIAB INC CVR","Health Care","Equity","0.00","0.00","0.00","5.00","0.00","United States","NO MARKET (E.G. UNLISTED)","USD","1.00","USD","-"',
  '"USD","USD CASH","Cash and/or Derivatives","Cash","50.00","0.03","50.00","50.00","100.00","United States","-","USD","1.00","USD","-"',
  '"RTYZ6","RUSS 2000 EMINI CME DEC 26","Cash and/or Derivatives","Futures","0.00","0.00","200.00","1.00","2,400.00","United States","Chicago Mercantile Exchange","USD","1.00","USD","-"',
  '"XTSLA","BLK CSH FND TREASURY SL AGENCY","Cash and/or Derivatives","Money Market","40.00","0.02","40.00","40.00","1.00","United States","-","USD","1.00","USD","-"',
  ' ',
  '"The content contained herein is owned or licensed by BlackRock and/or its third-party information providers."'
].join('\r\n');
const NASDAQ_SAMPLE = [
  'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',
  'AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N',
  'CRDO|Credo Technology Group Holding Ltd - Ordinary Shares|Q|N|N|100|N|N',
  'HIMS|Hims & Hers Health, Inc. - Class A Common Stock|Q|N|N|100|N|N',
  'ABCD|ABC Acquisition Corp - Class A Ordinary Shares|G|N|N|100|N|N',
  'ABCDW|ABC Acquisition Corp - Warrant|G|N|N|100|N|N',
  'ABCDU|ABC Acquisition Corp - Units|G|N|N|100|N|N',
  'ABCDR|ABC Acquisition Corp - Rights|G|N|N|100|N|N',
  'XYZP|XYZ Bancorp - 7.00% Series A Cumulative Redeemable Preferred Stock|G|N|N|100|N|N',
  'XYZNO|XYZ Bancorp - 6.50% Senior Notes due 2029|G|N|N|25|N|N',
  'QQQ|Invesco QQQ Trust, Series 1|G|N|N|100|Y|N',
  'ZZZT|Test Company - Common Stock|S|Y|N|100|N|N',
  'UNTC|Unit Corporation - Common Stock|S|N|N|100|N|N',
  'PENY|Penny Holdings Inc - Common Stock|S|N|D|100|N|N',
  'ADRX|Foreign Co Ltd - American Depositary Shares|G|N|N|100|N|N',
  'File Creation Time: 1014202614:01|||||||'
].join('\r\n');
const OTHER_SAMPLE = [
  'ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol',
  'MOG.A|Moog Inc. Class A Common Stock|N|MOG A|N|100|N|MOG=A',
  'FN|Fabrinet Ordinary Shares|N|FN|N|100|N|FN',
  'HIMS|Hims & Hers Health, Inc. Class A Common Stock|N|HIMS|N|100|N|HIMS',
  'SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY',
  'File Creation Time: 1014202614:01|||||||'
].join('\r\n');

const iwm = parseIwmHoldings(IWM_SAMPLE);
check('v57.81 IWM holdings: equity rows only (cash, futures, money market and unlisted CVR dropped)', same(iwm.rows.map((row) => row.ticker), ['CRDO', 'MOGA', 'FN', 'HIMS']), JSON.stringify(iwm.rows.map((row) => row.ticker)));
check('v57.81 IWM holdings: as-of date and GICS sector mapped to screener sector keys', iwm.asOf === '2026-10-14' && iwm.rows[0].sector === 'Technology' && iwm.rows[3].sector === 'Healthcare', JSON.stringify({ asOf: iwm.asOf, sectors: iwm.rows.map((row) => row.sector) }));
let reshaped = null;
try { parseIwmHoldings('Fund Holdings as of,"Oct 14, 2026"\nSymbol,Weight\nAAA,1'); } catch (error) { reshaped = error.message; }
check('v57.81 IWM holdings: a reshaped file throws instead of returning an empty member list', /header row not found/.test(String(reshaped)));
const nasdaq = parseNasdaqListed(NASDAQ_SAMPLE);
check('v57.81 nasdaqlisted: common stocks only (warrant/unit/right/preferred/note, ETF and test issue dropped)', same(nasdaq.rows.map((row) => row.sym).sort(), ['AAPL', 'ABCD', 'ADRX', 'CRDO', 'HIMS', 'PENY', 'UNTC']), JSON.stringify(nasdaq.rows.map((row) => row.sym)));
check('v57.81 nasdaqlisted: an issuer named "Unit" is not dropped by its name, and a deficient status is recorded, not dropped',
  nasdaq.rows.some((row) => row.sym === 'UNTC') && nasdaq.rows.find((row) => row.sym === 'PENY')?.financialStatus === 'D' && nasdaq.fileCreatedAt === '2026-10-14T14:01' && nasdaq.listed === 14);
check('v57.81 nasdaqlisted: fifth-character W/R/U rule applies only without a common-share description',
  !isNasdaqCommonStock({ Symbol: 'EFGHW', 'Security Name': 'EFG Corp - Warrants to purchase', 'Test Issue': 'N', ETF: 'N' })
  && isNasdaqCommonStock({ Symbol: 'EFGHU', 'Security Name': 'EFGH Holdings - Class A Common Stock', 'Test Issue': 'N', ETF: 'N' }));
const other = parseOtherListed(OTHER_SAMPLE);
check('v57.81 otherlisted: share-class separator normalized to the universe form (MOG.A -> MOG-A)', other.rows.some((row) => row.sym === 'MOG-A' && row.exchange === 'NYSE'));

// ── 2. Merge, floors and retain-on-failure (v57.81) ──────────────────────────────────────────────────────────────
check('v57.81 membership floors are Russell 2000 >= 1,800 and Nasdaq common >= 2,500', MEMBERSHIP_FLOORS.r2000 === 1800 && MEMBERSHIP_FLOORS.nasdaq === 2500);
const smallFloors = { r2000: 3, nasdaq: 5 };
const first = buildExtendedUniverse({ iwm, nasdaq, other, coreSymbols: ['AAPL'], floors: smallFloors, now: '2026-10-15T00:00:00.000Z' });
const bySym = new Map(first.payload.universe.map((row) => [row.sym, row]));
check('v57.81 merge: core symbols stay in the core and their tags go to coreMembership', !bySym.has('AAPL') && same(first.payload.coreMembership.AAPL, ['NASDAQ']));
check('v57.81 merge: Russell share-class ticker resolved through the listing directory', bySym.has('MOG-A') && !bySym.has('MOGA'));
check('v57.81 merge: a stock in both lists carries both tags, Russell first, with the fund sector',
  same(bySym.get('CRDO')?.membership, ['RUSSELL2000', 'NASDAQ']) && bySym.get('CRDO')?.index === 'RUSSELL2000' && bySym.get('CRDO')?.sector === 'Technology' && same(bySym.get('ADRX')?.membership, ['NASDAQ']) && bySym.get('ADRX')?.sector === null);
check('v57.81 merge: both sources CURRENT with counts', first.usable && first.payload.meta.sources.r2000.status === 'CURRENT' && first.payload.meta.sources.nasdaq.status === 'CURRENT' && first.payload.meta.counts.extended === first.payload.universe.length);
const iwmDown = buildExtendedUniverse({ iwm: null, iwmError: 'HTTP 403', nasdaq, other, previous: first.payload, coreSymbols: ['AAPL'], floors: smallFloors });
const iwmDownR2000 = iwmDown.payload.universe.filter((row) => row.membership.includes('RUSSELL2000')).map((row) => row.sym).sort();
check('v57.81 retain: a failed Russell fetch keeps the previous members (RETAINED, previous as-of, reason)',
  iwmDown.payload.meta.sources.r2000.status === 'RETAINED' && iwmDown.payload.meta.sources.r2000.asOf === '2026-10-14' && /HTTP 403/.test(iwmDown.payload.meta.sources.r2000.reason) && same(iwmDownR2000, ['CRDO', 'FN', 'HIMS', 'MOG-A']));
const belowFloor = buildExtendedUniverse({ iwm: { asOf: '2026-10-15', rows: iwm.rows.slice(0, 1) }, nasdaq: { ...nasdaq, rows: nasdaq.rows.slice(0, 2) }, other, previous: first.payload, coreSymbols: ['AAPL'], floors: smallFloors });
check('v57.81 retain: a source below its floor is treated as failed and keeps the previous rows',
  belowFloor.payload.meta.sources.r2000.status === 'RETAINED' && belowFloor.payload.meta.sources.nasdaq.status === 'RETAINED' && /below the 3 floor/.test(belowFloor.payload.meta.sources.r2000.reason) && belowFloor.payload.universe.length === first.payload.universe.length);
const nothing = buildExtendedUniverse({ iwmError: 'down', nasdaqError: 'down', previous: null, floors: smallFloors });
check('v57.81 retain: no source and no previous file is unusable (the producer writes nothing)', nothing.usable === false && nothing.payload.meta.sources.r2000.status === 'UNAVAILABLE');

// ── 3. Lossless row encoding and shard schema parity (v57.81) ────────────────────────────────────────────────────
const core = json('public-data/screener.json');
const coreUniverse = json('public-data/screener-universe.json').universe || [];
const encodedCore = encodeShardRows(core.data);
const expandedCore = expandShardRows({ ...encodedCore, schemaVersion: EXTENDED_SHARD_SCHEMA });
const mismatched = Object.keys(core.data).filter((sym) => !same(Object.entries(expandedCore[sym] || {}).sort(), Object.entries(core.data[sym]).sort()));
check('v57.81 row-defaults encoding is lossless on every core row', mismatched.length === 0 && Object.keys(expandedCore).length === Object.keys(core.data).length, mismatched.slice(0, 5).join(','));
const usStocks = coreUniverse.filter((row) => core.data[row.sym] && !/\.(KS|KQ|T|TW|TWO)$/.test(row.sym) && row.index !== 'ETF' && row.sector !== 'ETF').slice(0, 80);
const renamed = usStocks.map((row, index) => ({ from: row.sym, sym: `ZXQ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + Math.floor(index / 26))}`, row }));
const NEWS_KEYS = ['newsMemo', 'newsTs', 'newsObservedAt', 'newsFetchedAt', 'newsMemoVerified', 'newsMemoSources'];
const shardData = Object.fromEntries(renamed.map(({ from, sym }) => {
  const row = { ...core.data[from] };
  NEWS_KEYS.forEach((key) => delete row[key]);
  row.newsStatus = 'not-covered';
  return [sym, row];
}));
const identityRows = renamed.map(({ sym, row }, index) => ({ sym, name: `${row.name} (fixture)`, sector: row.sector || null, index: index % 2 ? 'NASDAQ' : 'RUSSELL2000', membership: index % 2 ? ['NASDAQ'] : ['RUSSELL2000', 'NASDAQ'], exchange: 'NASDAQ' }));
identityRows.push({ sym: 'ZXQZZ', name: 'Unfetched fixture', sector: null, index: 'NASDAQ', membership: ['NASDAQ'], exchange: 'NASDAQ' });
const membership = { generatedAt: '2026-10-15T00:00:00.000Z', meta: { sources: { r2000: { status: 'CURRENT', asOf: '2026-10-14' }, nasdaq: { status: 'CURRENT', asOf: '2026-10-14T14:01' } }, counts: { extended: identityRows.length } }, coreMembership: { AAPL: ['NASDAQ'], MSFT: ['NASDAQ'] } };
const shard = buildExtendedShardPayload({
  data: shardData, syms: identityRows.map((row) => row.sym), identityRows, membership,
  secResult: { ok: 0, stored: 0, eligible: 0, model: 'sec-fy-normalized-v2', generatedAt: null }, computedAt: core.factorComputedAt, ok: Object.keys(shardData).length, nowIso: core.asOf
});
const parity = validateExtendedShard(shard, { coreData: core.data, freshness: false });
check('v57.81 shard schema parity: a shard built by the producer validates against the core row schema', parity.ok, parity.errors.join(' | '));
check('v57.81 shard meta: asOf, counts, membership as-of, coverage, unfetchedSymbols and the extended ranking contract',
  shard.schemaVersion === EXTENDED_SHARD_SCHEMA && shard.universe === identityRows.length && shard.ok === renamed.length && same(shard.unfetchedSymbols, ['ZXQZZ'])
  && shard.membership.asOf.r2000 === '2026-10-14' && shard.coverage.floorPct === EXTENDED_SHARD_COVERAGE_FLOOR * 100 && shard.rankingContract.contract === RANKING_CONTRACTS.extended.id && shard.rankingContract.tradingSignal === false
  && Array.isArray(shard.rankingContract.coreOnly) && shard.rankingContract.coreOnly.includes('backtest'));
const withExtraField = { ...shard, data: { ...shard.data, [renamed[0].sym]: { ...shard.data[renamed[0].sym], invented: 1 } } };
const withPrice = { ...shard, data: { ...shard.data, [renamed[0].sym]: { ...shard.data[renamed[0].sym], price: 10 } } };
const duplicated = { ...shard, data: { ...shard.data, AAPL: shard.data[renamed[0].sym] }, ok: shard.ok + 1 };
check('v57.81 shard validator rejects a field outside the core schema, a raw price and a core duplicate',
  !validateExtendedShard(withExtraField, { coreData: core.data, freshness: false }).ok
  && validateExtendedShard(withPrice, { coreData: core.data, freshness: false }).errors.some((error) => /raw price/.test(error))
  && validateExtendedShard(duplicated, { coreData: core.data, freshness: false }).errors.some((error) => /duplicated|identity/.test(error)));
const shardBytes = Buffer.byteLength(JSON.stringify(shard));
const perRow = shardBytes / identityRows.length;
console.log(`[screener-extended] size sample: ${identityRows.length} rows -> ${shardBytes.toLocaleString('en-US')} bytes (${Math.round(perRow)} B/row; core ${Math.round(Buffer.byteLength(JSON.stringify(core.data)) / Object.keys(core.data).length)} B/row) -> 4,200 rows ~ ${(perRow * 4200 / 1e6).toFixed(1)} MB`);
check('v57.81 encoded extended rows fit the 15 MB shard budget at 4,200 rows (estimate from a real core sample)', perRow * 4200 < 15_000_000, `${Math.round(perRow)} B/row`);
if (existsSync(join(root, 'public-data/screener-extended.json'))) {
  const committed = validateExtendedShard(json('public-data/screener-extended.json'), { coreData: core.data, freshness: false });
  check('v57.81 committed extended shard keeps the contract', committed.ok, committed.errors.join(' | '));
}

// ── 4. Producer due rule, SEC compact ledger, operations availability (v57.81) ───────────────────────────────────
const nowMs = Date.parse('2026-10-15T22:30:00Z');
check('v57.81 due: missing shard is due; core session advance is due; same session within 26h is not; 26h backstop is due',
  extendedRefreshDue({ previousShard: null, nowMs }).due
  && extendedRefreshDue({ previousShard: { ...shard, asOf: '2026-10-15T00:00:00Z', factorSessionDateByMarket: { US: '2026-10-14' } }, coreScreener: { factorSessionDateByMarket: { US: '2026-10-15' } }, nowMs }).due
  && !extendedRefreshDue({ previousShard: { ...shard, asOf: '2026-10-15T00:00:00Z', factorSessionDateByMarket: { US: '2026-10-15' } }, coreScreener: { factorSessionDateByMarket: { US: '2026-10-15' } }, nowMs }).due
  && extendedRefreshDue({ previousShard: { ...shard, asOf: '2026-10-14T19:00:00Z', factorSessionDateByMarket: { US: '2026-10-15' } }, coreScreener: { factorSessionDateByMarket: { US: '2026-10-15' } }, nowMs }).due);
const compact = compactSecRecord({ symbol: 'X', revenue: 1, recentFilings: [{ form: '8-K' }], pit: { schemaVersion: 'sec-pit-facts.v1', status: 'filed-date-only', observationCount: 3, acceptedTimeCount: 0, observations: { revenue: [1, 2, 3] } } });
const secOptions = extendedSecOptions({});
check('v57.81 extended SEC ledger: compact records drop observation arrays and filings; bounded 600-issuer batch; own files',
  !compact.recentFilings && !compact.pit.observations && compact.pit.observationCount === 3 && compact.revenue === 1
  && secOptions.batchLimit === 600 && secOptions.compact === true && secOptions.requireRestored === false
  && /sec-fundamentals-extended\.json$/.test(secOptions.outPath) && /screener-extended-universe\.json$/.test(secOptions.universePath));
const fresh = deriveExtendedScreenerAvailability({ schemaVersion: EXTENDED_SHARD_SCHEMA, asOf: '2026-10-15T22:00:00Z', coverage: { pricePct: 95, floorPct: 60 }, membership: { status: { r2000: 'CURRENT', nasdaq: 'CURRENT' } } }, '2026-10-15T23:00:00Z');
const stale = deriveExtendedScreenerAvailability({ schemaVersion: EXTENDED_SHARD_SCHEMA, asOf: '2026-10-12T22:00:00Z', coverage: { pricePct: 95, floorPct: 60 }, membership: { status: {} } }, '2026-10-15T23:00:00Z');
const retainedOps = deriveExtendedScreenerAvailability({ schemaVersion: EXTENDED_SHARD_SCHEMA, asOf: '2026-10-15T22:00:00Z', coverage: { pricePct: 95, floorPct: 60 }, membership: { status: { r2000: 'RETAINED', nasdaq: 'CURRENT' } } }, '2026-10-15T23:00:00Z');
check('v57.81 operations status: extended availability AVAILABLE / DEGRADED(stale, retained) / UNAVAILABLE(absent)',
  fresh.availability === 'AVAILABLE' && stale.availability === 'DEGRADED' && /h-old/.test(stale.missingReason) && retainedOps.availability === 'DEGRADED' && /r2000/.test(retainedOps.missingReason) && deriveExtendedScreenerAvailability(null).availability === 'UNAVAILABLE');

// ── 5. Provider: lazy shard read, merge and ranking contract (v57.81) ───────────────────────────────────────────
const responses = {
  './public-data/screener.json': core,
  './public-data/screener-universe.json': json('public-data/screener-universe.json'),
  './public-data/model-validation-status.json': json('public-data/model-validation-status.json'),
  [EXTENDED_SHARD_URL]: shard
};
const requested = [];
const httpClient = { requestJson: async (url) => { requested.push(url); return responses[url] ? { ok: true, data: JSON.parse(JSON.stringify(responses[url])) } : { ok: false, error: 'HTTP_404' }; } };
let scope = 'core';
let allowFetch = true;
const provider = createScreenerProvider({ httpClient, readUniverseScope: () => scope, allowExtendedFetch: () => allowFetch, yieldImpl: async () => {} });
const coreRead = await provider.readCurrent();
check('v57.81 default view does not request the extended shard', requested.length === 3 && !requested.includes(EXTENDED_SHARD_URL) && coreRead.metadata.universeScope === 'core' && !coreRead.rows.some((row) => 'universeTier' in row || 'membership' in row), JSON.stringify(requested));
scope = 'extended'; allowFetch = false; requested.length = 0;
const deferred = await provider.readCurrent({ refresh: false });
check('v57.81 a remembered 확장 choice does not download the shard outside the screener route', !requested.includes(EXTENDED_SHARD_URL) && deferred.metadata.extended?.status === 'deferred' && deferred.metadata.universeScope === 'core');
allowFetch = true; requested.length = 0;
const extendedRead = await provider.readCurrent({ refresh: false });
const extendedRows = extendedRead.rows.filter((row) => row.universeTier === 'extended');
const aapl = extendedRead.rows.find((row) => row.sym === 'AAPL');
check('v57.81 확장 reads the shard once and merges its rows with the core rows',
  requested.filter((url) => url === EXTENDED_SHARD_URL).length === 1 && extendedRows.length === identityRows.length && extendedRead.rows.length === coreRead.rows.length + identityRows.length
  && extendedRead.metadata.universeScope === 'extended' && extendedRead.metadata.extended.status === 'loaded' && extendedRead.metadata.extended.rows === identityRows.length, JSON.stringify(requested));
check('v57.81 merged rows carry tier, membership and the shard lineage; a core row takes its Nasdaq tag from coreMembership',
  extendedRows.every((row) => Array.isArray(row.membership) && row.membership.length && row.identitySource === 'public-data/screener-extended.json' && row.fieldReadiness)
  && aapl?.universeTier === 'core' && aapl.membership.includes('NASDAQ') && aapl.membership.includes('SP500'));
const sample = extendedRows.find((row) => row.sym === renamed[0].sym);
const sourceRow = core.data[renamed[0].from];
check('v57.81 a shard row reaches the screener with the same factor values as its source row', sample && sample.ret3m === sourceRow.ret3m && sample.rsi === sourceRow.rsi && sample.pctSma200 === sourceRow.pctSma200 && sample.factorSessionDate === sourceRow.factorSessionDate);
requested.length = 0;
await provider.readCurrent({ refresh: false });
check('v57.81 a held shard is reused without another download until a refresh', !requested.includes(EXTENDED_SHARD_URL));
check('v57.81 the extended snapshot identity differs from the core one', extendedRead.snapshotId !== coreRead.snapshotId);

const runOrchestrator = async (scopeValue) => {
  scope = scopeValue;
  let published = null;
  const orchestrator = createScreenerOrchestrator({ provider, commands: { setData: (value) => { published = value; } }, ranker: computeFactorRanks, rankingContext: () => ({ now: Date.parse(core.asOf) + 3600000 }) });
  await orchestrator.sync({ refresh: false });
  return published;
};
const startedAt = Date.now();
const extendedState = await runOrchestrator('extended');
const extendedMs = Date.now() - startedAt;
const coreState = await runOrchestrator('core');
check('v57.81 ranking metadata names its contract (core vs extended) and extended rows carry rankingUniverse',
  extendedState?.metadata?.ranking?.contract === RANKING_CONTRACTS.extended.id && extendedState.rows.every((row) => row.rankingUniverse === 'extended')
  && coreState?.metadata?.ranking?.contract === RANKING_CONTRACTS.core.id && coreState.rows.every((row) => !('rankingUniverse' in row)), JSON.stringify({ e: extendedState?.metadata?.ranking?.contract, c: coreState?.metadata?.ranking?.contract }));
const rankedExtended = extendedState.rows.filter((row) => row.universeTier === 'extended' && Number.isFinite(row.rank));
check('v57.81 extended rows are ranked with the same factor model as core rows', rankedExtended.length >= Math.floor(renamed.length * 0.5), `${rankedExtended.length}/${renamed.length}`);
console.log(`[screener-extended] provider + ranking over ${extendedState.rows.length} rows: ${extendedMs} ms (node)`);

// ── 6. Scope storage (v57.81) ───────────────────────────────────────────────────────────────────────────────────
const store = new Map();
const fakeRoot = { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) } };
check('v57.81 the 종목 범위 choice is remembered per reader and anything else reads as 기본',
  readUniverseScope(fakeRoot) === 'core' && writeUniverseScope(fakeRoot, 'extended') === 'extended' && readUniverseScope(fakeRoot) === 'extended'
  && writeUniverseScope(fakeRoot, 'bogus') === 'core' && readUniverseScope({ localStorage: { getItem: () => { throw new Error('blocked'); } } }) === 'core');

// ── 7. Workflow job shape and registrations (v57.81) ────────────────────────────────────────────────────────────
const workflow = read('.github/workflows/refresh-screener.yml');
// Comment lines are dropped so a job's prose can neither satisfy nor break a structural check.
const jobBlock = (name) => (workflow.match(new RegExp(`\\n  ${name}:\\n[\\s\\S]*?(?=\\n  [a-z][a-z-]*:\\n|$)`))?.[0] || '')
  .split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
const coreJob = jobBlock('refresh-screener');
const extendedJob = jobBlock('refresh-screener-extended');
const convergeJob = jobBlock('converge');
const convergeExtended = jobBlock('converge-extended');
check('v57.81 workflow: the extended job runs after the core job in its own concurrency group with a 40-minute cap',
  /needs: refresh-screener\n/.test(extendedJob) && /group: refresh-screener-extended/.test(extendedJob) && /timeout-minutes: 40/.test(extendedJob) && /if: \$\{\{ !cancelled\(\) \}\}/.test(extendedJob));
const order = ['screener-extended-due.mjs', 'fetch-extended-universe.mjs', 'SEC_LEDGER_SCOPE: extended', "SCREENER_EXTENDED: '1'", 'validate-screener-extended.mjs', 'ci-screener-extended-contract-check.mjs', 'git commit -m "data: refresh extended screener universe'];
check('v57.81 workflow: due check -> membership -> SEC batch -> shard -> validation -> commit, in that order',
  order.every((token, index) => extendedJob.indexOf(token) >= 0 && (index === 0 || extendedJob.indexOf(token) > extendedJob.indexOf(order[index - 1]))), order.filter((token) => extendedJob.indexOf(token) < 0).join(','));
check('v57.81 workflow: the core job never stages extended files and the core converge does not wait for the extended job',
  !/screener-extended|sec-fundamentals-extended/.test(coreJob) && /needs: refresh-screener\n/.test(convergeJob) && /needs: refresh-screener-extended/.test(convergeExtended) && /group: live-convergence/.test(convergeExtended));
check('v57.81 workflow: the extended commit stages only its three files', /public-data\/screener-extended\.json public-data\/screener-extended-universe\.json public-data\/sec-fundamentals-extended\.json/.test(extendedJob) && !/git add -- public-data\/screener\.json/.test(extendedJob));
const lineage = read('scripts/ci-data-lineage-audit.mjs');
check('v57.81 freshness registry lists the shard, the membership file and the extended SEC ledger', ['screener-extended.json', 'screener-extended-universe.json', 'sec-fundamentals-extended.json'].every((name) => lineage.includes(`'${name}'`)));
check('v57.81 artifact size watchdog budgets the shard (15 MB) and keeps the core artifact bounded', /screener-extended-shard[^\n]*15_000_000/.test(read('scripts/ci-artifact-size-headroom-check.mjs')) && /screener-core/.test(read('scripts/ci-artifact-size-headroom-check.mjs')));
check('v57.81 operations status publishes the extended availability', /'screener-extended': deriveExtendedScreenerAvailability/.test(read('scripts/build-operations-status.mjs')));
check('v57.81 static-data contract keeps the shard research-only and price-free', /screener-extended\.json/.test(read('scripts/ci-static-data-contract-check.mjs')));
const qa = json('architecture/qa-pipeline.json');
const gateScripts = Object.values(qa.groups || {}).flatMap((group) => (group.gates || []).map((gate) => gate.script));
check('v57.81 extended gates are registered in qa-pipeline.json', gateScripts.includes('scripts/ci-screener-extended-contract-check.mjs') && gateScripts.includes('scripts/ci-screener-extended-browser-check.mjs'));

if (failures.length) {
  console.error(`Screener extended contract FAIL (${failures.length}):\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`Screener extended contract PASS (${passed} checks)`);
