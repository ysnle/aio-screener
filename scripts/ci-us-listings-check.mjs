#!/usr/bin/env node
// v57.81: contract for the official US listing (public-data/us-listings.json) and its lazy client check.
// Runs the producer's pure parser/floors/SEC join on a tiny canned sample (scripts/fixtures/us-listings), the client
// lookup with a stubbed fetch, the wiring (workflow, lineage, headroom, not on the boot path), and — when the artifact
// exists — its published shape. No network.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const load = (rel) => import(pathToFileURL(join(root, rel)).href);
const fixture = (name) => read(`scripts/fixtures/us-listings/${name}`);
const failures = [];
const check = (label, fn) => { try { fn(); } catch (error) { failures.push(`${label}: ${error.message}`); } };
const checkAsync = async (label, fn) => { try { await fn(); } catch (error) { failures.push(`${label}: ${error.message}`); } };

const lib = await load('scripts/lib/us-listings.mjs');
const client = await load('src/data/us-listings.js');

// 1. Parser: test issues and the footer line are dropped; symbols normalised to the form AIO writes.
const built = lib.buildListingRows(fixture('nasdaqlisted.txt'), fixture('otherlisted.txt'));
const bySym = new Map(built.rows.map((row) => [row.sym, row]));
check('v57.81 parser drops test issues (Test Issue=Y) and the File Creation Time footer', () => {
  assert.equal(built.dropped.testIssue, 2);
  assert.ok(!bySym.has('ZJZZT') && !bySym.has('NTEST'));
  assert.ok(![...bySym.keys()].some((sym) => /FILE|CREATION/.test(sym)));
  assert.equal(built.fileCreationTime.nasdaqlisted, '1015202610:02');
  assert.equal(lib.fileCreationDate(built.fileCreationTime.otherlisted), '2026-10-15');
});
check('v57.81 class share ACT symbol BRK.B is published as BRK-B (universe/Yahoo/SEC form); preferred, unit and warrant lines are not', () => {
  assert.ok(bySym.has('BRK-B') && !bySym.has('BRK.B'));
  assert.ok(![...bySym.keys()].some((sym) => /^BAC|^AAM|ACHR-W|\$|\./.test(sym)));
  assert.equal(built.dropped.preferred, 1);
  assert.equal(built.dropped['unit-right-warrant'], 2);
  assert.ok(bySym.has('ACHRW'), 'a Nasdaq 5th-letter symbol is a plain listed symbol');
});
check('v57.81 exchange codes, ETF flag and name cleanup', () => {
  assert.equal(bySym.get('AAPL').exch, 'Q');
  assert.equal(bySym.get('SPY').exch, 'P');
  assert.equal(bySym.get('IEXG').exch, 'V');
  // v57.81 first live run: ET (Energy Transfer, NYSE Texas 'F') was dropped as an unknown exchange; LP common units are equities.
  assert.equal(bySym.get('ET')?.exch, 'F');
  assert.equal(lib.EXCHANGE_CODES.F, 'NYSE Texas');
  assert.equal(bySym.get('XNEW')?.exch, 'K', 'an unrecognised one-letter venue keeps the listed security');
  assert.equal(built.dropped.unknownExchangeKept, 1);
  assert.equal(bySym.get('QQQ').etf, true);
  assert.equal(bySym.get('AAPL').etf, false);
  assert.equal(bySym.get('AAPL').name, 'Apple Inc.');
  assert.equal(bySym.get('GOOGL').name, 'Alphabet Inc. - Class A');
  assert.equal(bySym.get('GHC').name, 'Graham Holdings Company Class B');
});
check('v57.81 a reshaped directory (missing column) throws instead of publishing', () => {
  assert.throws(() => lib.buildListingRows('Symbol|Security Name\nAAPL|Apple\n', fixture('otherlisted.txt')), /columns changed/);
});

// 2. SEC CIK join by exact symbol key; a Nasdaq Trader symbol absent from SEC keeps cik null.
const sec = lib.joinSecCik(built.rows, lib.secCikMap(JSON.parse(fixture('sec-company-tickers-exchange.json'))));
const joined = new Map(sec.rows.map((row) => [row.sym, row]));
check('v57.81 SEC join: 10-digit CIK by exact symbol, null when SEC has no such ticker', () => {
  assert.equal(joined.get('AAPL').cik, '0000320193');
  assert.equal(joined.get('BRK-B').cik, '0001067983');
  assert.equal(joined.get('HWKN').cik, '0000046250');
  assert.equal(joined.get('QQQ').cik, null);
  assert.equal(joined.get('SPY').cik, null);
  assert.ok(sec.summary.secOnlySample.includes('SECO'), 'SEC-only exchange tickers are reported, not added');
  assert.ok(!joined.has('SECO'));
});

// 3. Publish floors.
check('v57.81 floors: more than 8000 rows and the universe index members present', () => {
  assert.equal(lib.validateListing(sec.rows, []).ok, false, 'the 9-row sample is below the row floor');
  const many = Array.from({ length: 8001 }, (_, i) => ({ sym: `Z${i.toString(36).toUpperCase()}`, name: 'x', exch: 'Q', etf: false, cik: null }));
  const universe = Array.from({ length: 20 }, (_, i) => ({ sym: `Z${i.toString(36).toUpperCase()}`, index: 'SP500' }));
  assert.equal(lib.validateListing(many, universe).ok, true);
  const missing = (n, index) => [...universe, ...Array.from({ length: n }, (_, i) => ({ sym: `MISS${i}`, index }))];
  assert.equal(lib.validateListing(many, missing(lib.MAX_CORE_MISSES, 'SP500')).ok, true);
  const core = lib.validateListing(many, missing(lib.MAX_CORE_MISSES + 1, 'SP500'));
  assert.equal(core.ok, false);
  assert.equal(core.coverage.coreMissing.length, lib.MAX_CORE_MISSES + 1);
  const wideUniverse = [...Array.from({ length: 100 }, (_, i) => ({ sym: `Z${i.toString(36).toUpperCase()}`, index: 'RUSSELL2000' })), ...Array.from({ length: 6 }, (_, i) => ({ sym: `GONE${i}`, index: 'RUSSELL2000' }))];
  assert.equal(lib.validateListing(many, wideUniverse).ok, false, '6/106 wide misses exceed 5%');
  assert.equal(lib.validateListing(many, [{ sym: '005930.KS', index: 'SP500' }, { sym: '8035.T', index: 'SP500' }]).ok, true, 'non-US suffixed rows are not expected');
});

// 4. Client lookup: exact symbol only, no fuzzy rewrite, no name search; unavailable never reads as listed.
const artifact = lib.buildArtifact(sec.rows, { generatedAt: '2026-10-15T10:30:00Z', asOf: '2026-10-15', fileCreationTime: built.fileCreationTime, dropped: built.dropped, coverage: {}, secJoin: { status: 'joined' } });
const index = client.indexUsListings(artifact);
check('v57.81 client lookup: listed, unlisted, no fuzzy rewrite, no name search', () => {
  const hwkn = client.lookupUsListing(index, ' hwkn ');
  assert.deepEqual(Object.keys(hwkn).sort(), ['asOf', 'cik', 'etf', 'exchange', 'listed', 'name']);
  assert.deepEqual(hwkn, { listed: true, name: 'Hawkins, Inc.', exchange: 'Nasdaq', etf: false, asOf: '2026-10-15', cik: '0000046250' });
  assert.equal(client.lookupUsListing(index, 'BRK.B').listed, true, 'class-share separator only');
  assert.equal(client.lookupUsListing(index, 'BRK/B').listed, true);
  assert.equal(client.lookupUsListing(index, 'QQQ').cik, null);
  assert.equal(client.lookupUsListing(index, 'SPY').exchange, 'NYSE Arca');
  assert.equal(client.lookupUsListing(index, 'SPY').etf, true);
  const appl = client.lookupUsListing(index, 'APPL');
  assert.equal(appl.listed, false, 'APPL is not rewritten to AAPL');
  assert.equal(appl.name, null);
  assert.equal(client.lookupUsListing(index, 'Hawkins').listed, false, 'company names are never resolved by the exact lookup');
  // v57.83: a name search offers candidates to choose from (never an automatic resolution); short or non-Latin queries return none.
  const named = client.searchUsListingNames(index, 'hawkins');
  assert.equal(named[0]?.symbol, 'HWKN', 'a company name is offered as a listing candidate');
  assert.equal(named[0]?.exchange, 'Nasdaq');
  assert.deepEqual(client.searchUsListingNames(index, 'ha'), [], 'under three letters: no candidates');
  assert.deepEqual(client.searchUsListingNames(index, '호킨스'), [], 'no Latin letter: no candidates');
  assert.deepEqual(client.searchUsListingNames(index, 'hawkins', { exclude: ['HWKN'] }).map((pick) => pick.symbol).includes('HWKN'), false, 'registry picks are not repeated');
  assert.equal(client.lookupUsListing(index, 'BRKB').listed, false);
  assert.equal(client.usListingSymbol('brk.b'), 'BRK-B');
  assert.equal(client.usListingSymbol('APPL'), 'APPL');
  assert.equal(client.lookupUsListing(null, 'AAPL').listed, null);
  assert.equal(client.indexUsListings({ schemaVersion: 'other', columns: { sym: ['AAPL'] } }), null);
});

check('v57.96 name candidates leave out warrants, rights and SPAC units, keep partnership units, and prefer universe symbols', () => {
  const index = client.indexUsListings({ schemaVersion: client.US_LISTINGS_SCHEMA, asOf: '2026-10-17', exchanges: { Q: 'Nasdaq', N: 'NYSE' },
    columns: { sym: ['OPEN', 'OPENW', 'OPENL', 'RKTO', 'RKLB', 'ROCKU', 'ET', 'ETW'], exch: 'QQQQQQNN', etf: '00000000', cik: [],
      name: ['Opendoor Technologies Inc', 'Opendoor Technologies Inc - Series K Warrants', 'Opendoor Technologies Inc - Series A Warrants, each whole warrant',
        'Rocket One Inc.', 'Rocket Lab Corporation', 'Rocket Acquisition Corp - Units', 'Energy Transfer LP Common Units', 'Energy Transfer Warrants Corp - Right'] } });
  assert.deepEqual(client.searchUsListingNames(index, 'opendoor').map((pick) => pick.symbol), ['OPEN'], 'warrant lines are not company candidates');
  assert.deepEqual(client.searchUsListingNames(index, 'rocket').map((pick) => pick.symbol), ['RKTO', 'RKLB'], 'units are dropped; without a preference the shorter name leads');
  assert.deepEqual(client.searchUsListingNames(index, 'rocket', { prefer: ['RKLB'] }).map((pick) => pick.symbol), ['RKLB', 'RKTO'], 'a universe symbol leads among equal matches');
  assert.deepEqual(client.searchUsListingNames(index, 'energy transfer').map((pick) => pick.symbol), ['ET'], 'partnership common units stay, a rights line goes');
  assert.equal(client.isDerivativeListingName('Plains All American Pipeline, L.P. - Common Units representing'), false);
});
check('v57.96 refused watchlist and holding names show listing candidates through one native owner (v58.76: price alerts retired)', () => {
  const compat = read('src/app/compatibility-globals.js');
  assert.match(compat, /window\._aioListingNameSuggestion = \(raw\) =>/);
  assert.match(compat, /window\._aioToastWithNameHint = \(raw, message\) =>/);
  assert.match(read('js/aio-workspace.js'), /else window\._aioToastWithNameHint\(ticker, ticker \+ ': 등록 종목·미국 상장 목록에서 찾지 못한 티커입니다/);
  assert.match(read('js/aio-workspace.js'), /window\._aioToastWithNameHint\(pfRawTicker \|\| ticker, '"' \+ \(pfRawTicker \|\| ticker\) \+ '" 검증되지 않은 티커라 저장하지 않았습니다/);
  assert.doesNotMatch(read('js/aio-chat.js'), /function _aioAddAlert\b/);
});

const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => JSON.parse(body), text: async () => body });
const originalFetch = globalThis.fetch;
await checkAsync('v57.81 isListedUsSymbol: listed through the lazy artifact, one request for many checks', async () => {
  let calls = 0;
  client.resetUsListingsCache();
  globalThis.fetch = async (url) => { calls += 1; assert.match(String(url), /public-data\/us-listings\.json$/); return response(JSON.stringify(artifact)); };
  const got = await client.isListedUsSymbol('HWKN');
  assert.equal(got.listed, true);
  assert.equal(got.cik, '0000046250');
  assert.equal((await client.isListedUsSymbol('APPL')).listed, false);
  assert.equal(calls, 1);
  const before = calls;
  assert.equal((await client.isListedUsSymbol('005930')).listed, false);
  assert.equal(calls, before, 'a non-US-shaped code does not fetch');
});
await checkAsync('v57.81 isListedUsSymbol: missing, offline or reshaped artifact -> listed null (never accept)', async () => {
  for (const stub of [async () => response('', 404), async () => { throw new TypeError('Failed to fetch'); }, async () => response(JSON.stringify({ schemaVersion: 'us-listings.v0' }))]) {
    client.resetUsListingsCache();
    globalThis.fetch = stub;
    const got = await client.isListedUsSymbol('HWKN');
    assert.equal(got.listed, null);
    assert.equal(got.name, null);
  }
});
globalThis.fetch = originalFetch;
client.resetUsListingsCache();

// 5. Wiring: producer, workflow, registries; not on the boot path.
const producer = read('scripts/build-us-listings.mjs');
const workflow = read('.github/workflows/refresh-screener.yml');
const workspace = read('js/aio-workspace.js');
check('v57.81 producer keeps the previous artifact on any failure and refreshes daily', () => {
  assert.match(producer, /validateListing\(/);
  assert.match(producer, /previous file kept/);
  assert.match(producer, /FRESH_MS = 20 \* 60 \* 60 \* 1000/);
  assert.ok(producer.indexOf('atomicWriteFile(OUT') > producer.indexOf('if (!check.ok) throw'), 'write only after the floors');
});
check('v57.81 refresh-screener runs the producer with the SEC User-Agent and stages the artifact', () => {
  assert.match(workflow, /node scripts\/build-us-listings\.mjs/);
  assert.match(workflow, /stage_if_exists public-data\/us-listings\.json/);
  assert.match(workflow, /node scripts\/ci-us-listings-check\.mjs/);
  const step = workflow.slice(workflow.indexOf('Refresh US exchange listing'), workflow.indexOf('node scripts/build-us-listings.mjs'));
  assert.match(step, /SEC_USER_AGENT: \$\{\{ vars\.SEC_USER_AGENT \}\}/);
});
check('v57.81 lineage freshness policy and size budget registered', () => {
  assert.match(read('scripts/ci-data-lineage-audit.mjs'), /'us-listings\.json': \{ kind: 'exchange-listing-reference', timestamp: \['generatedAt'\], maxAgeHours: 24 \* 4 \}/);
  assert.match(read('scripts/ci-artifact-size-headroom-check.mjs'), /id: 'us-listings', bytes: size\('public-data\/us-listings\.json'\)/);
});
check('v57.81 the listing is not on the boot path (no preload, no precache, no boot fetch)', () => {
  for (const rel of ['index.html', 'sw.js', 'src/app/bootstrap.js', 'js/aio-core.js', 'js/aio-data.js']) assert.ok(!read(rel).includes('us-listings.json'), `${rel} references us-listings.json`);
  const compat = read('src/app/compatibility-globals.js');
  assert.match(compat, /window\._aioCheckUsListing = \(symbol\) => isListedUsSymbol\(symbol\);/);
});
check('v57.81 portfolio entry: unknown symbols go through the listing; unavailable is not saved', () => {
  const body = workspace.slice(workspace.indexOf('async function addPortfolioPosition'), workspace.indexOf('function removePosition'));
  assert.match(body, /await window\._aioCheckUsListing\(pfListingSym\)/);
  assert.match(body, /pfListing\.listed == null\) \{ showToast\([^;]*불러오지 못해 저장하지 않았습니다[^;]*\); return; \}/);
  assert.match(body, /if \(pfListing\.listed === true\) \{ ticker = pfListingSym; isKnown = true; \}/);
});

// 6. Published artifact (absent until the first Actions run).
const outPath = join(root, 'public-data/us-listings.json');
if (existsSync(outPath)) {
  check('v57.81 published us-listings.json shape', () => {
    const published = JSON.parse(readFileSync(outPath, 'utf8'));
    const cols = published.columns || {};
    assert.equal(published.schemaVersion, lib.US_LISTINGS_SCHEMA);
    assert.ok(published.count > lib.MIN_ROWS, `count ${published.count}`);
    for (const key of ['sym', 'name', 'cik']) assert.equal(cols[key]?.length, published.count, `${key} column length`);
    assert.equal(cols.exch.length, published.count);
    assert.equal(cols.etf.length, published.count);
    assert.ok(cols.cik.every((cik) => cik === null || /^\d{10}$/.test(cik)));
    assert.ok(cols.sym.every((sym) => /^[A-Z]{1,5}(-[A-Z])?$/.test(sym)));
    assert.ok(statSync(outPath).size < 1_200_000, `size ${statSync(outPath).size}`);
  });
} else {
  console.log('us-listings: public-data/us-listings.json not published yet (first refresh-screener run writes it)');
}

if (failures.length) {
  console.error(`US listings check failed:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`US listings check OK: parser/floors/SEC join on the canned sample (${built.rows.length} rows), client lookup, wiring.`);
