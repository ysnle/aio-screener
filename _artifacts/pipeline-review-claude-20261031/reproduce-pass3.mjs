// Review fixtures only: no producer writes, network, staging or commits.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildAttribution } from '../../src/domain/portfolio/attribution.js';
import { createOnDemandSymbolReader } from '../../src/data/on-demand-symbol.js';
const make = (sectorDate, sectorReturn) => buildAttribution({
  holdings: [{ symbol: 'AAPL', value: 110 }], cash: 0, baseCurrency: 'USD',
  rowFor: symbol => symbol === 'AAPL' ? { ret3m: 10, sector: 'Technology', factorSessionDate: '2026-10-23' }
    : symbol === 'XLK' ? { ret3m: sectorReturn, factorSessionDate: sectorDate } : null,
  marketReturnFor: () => ({ ret3m: 5, label: 'SPY', asOf: '2026-10-23' })
});
const aligned = make('2026-10-23', 8), stale = make('2026-09-01', 8), otherWindow = make('2026-09-01', 50);
assert.deepEqual(stale, aligned);
assert.equal(otherWindow.available, true);
assert.equal(otherWindow.sectorMappedPct, 100);
assert.equal(otherWindow.skipped.length, 0);
assert.equal(otherWindow.components.find(x => x.id === 'sector').pct, 45);
assert.equal(otherWindow.components.find(x => x.id === 'stock').pct, -40);
const source = fs.readFileSync('scripts/qa-runner.mjs', 'utf8');
const fn = source.match(/const stagedDigest = \(file\) => \{[\s\S]*?\n  \};/)[0];
const file = 'js/aio-core.js';
const stagedDigest = vm.runInNewContext(`${fn}\nstagedDigest(${JSON.stringify(file)})`, { spawnSync, candidateRepo: process.cwd(), createHash });
const probe = spawnSync('git', ['show', `:${file}`], { cwd: process.cwd(), encoding: 'buffer' });
const sizeProbe = spawnSync('git', ['cat-file', '-s', `:${file}`], { encoding: 'utf8' });
// fixed at v59.44: assert.equal(stagedDigest, null);
// latent: aio-core.js now 169B under 1MiB: assert.equal(probe.error?.code, 'ENOBUFS');
const dartSource = fs.readFileSync('scripts/fetch-dart-fundamentals.mjs', 'utf8');
const mainSource = dartSource.slice(dartSource.indexOf('async function main()'), dartSource.indexOf('\nif (process.argv[1]'));
const writes = [];
const previousDart = { count: 1, generatedAt: '2000-01-01T00:00:00Z', companies: { '005930.KS': { fiscalYear: 2024, current: { revenue: 100 } } } };
await vm.runInNewContext(`${mainSource}\nmain()`, {
  process: { env: { DART_API_KEY: 'fixture-key', DART_FORCE: '1' } },
  console: { log() {} }, OUT: 'memory:kr', SCREENER: 'memory:screener', API: 'https://fixture.invalid', REFRESH_AFTER_MS: 6 * 86400000,
  readFile: async p => JSON.stringify(p === 'memory:kr' ? previousDart : { data: { '005930.KS': {} } }),
  fetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }), Buffer,
  unzipFirstEntry: () => Buffer.from('fixture'), parseCorpCodes: () => new Map([['005930', { corpCode: 'fixture', corpName: 'fixture' }]]),
  getJson: async () => ({ status: '020', message: 'fixture quota exceeded' }),
  setTimeout: fn => { fn(); return 0; },
  writeFile: async (p, value) => writes.push({ path: p, payload: JSON.parse(value) }), rename: async () => {}
});
assert.equal(writes.length, 1);
assert.equal(writes[0].payload.count, 0);
assert.equal(writes[0].payload.failed[0].reason, 'no-annual-report');
let peers = [{ sym: 'AAPL', factorSessionDate: '2026-10-23' }];
let listingChecks = 0;
const reader = createOnDemandSymbolReader({ universeRows: () => peers, isListed: async () => { listingChecks++; return { listed: false }; }, fetchChart: async () => null });
const beforeRemoval = await reader.load('AAPL');
peers = [{ sym: 'MSFT', factorSessionDate: '2026-10-23' }];
const afterRemoval = await reader.load('AAPL');
assert.equal(beforeRemoval.status, 'in-universe');
assert.equal(afterRemoval.status, 'in-universe');
assert.equal(listingChecks, 0);
const result = {
  evidence: 'actual pure-domain function and extracted actual stagedDigest; no full QA or live/browser assertion',
  attribution: { aligned, stale, otherWindow, dateOnlyChangeIgnored: true },
  onDemand: { beforeRemoval, afterRemoval, listingChecks, currentPeerSymbols: peers.map(p => p.sym), trigger: 'same row count and max session date, different universe membership' },
  dart: { previousCount: previousDart.count, replacement: writes[0].payload, evidence: 'actual main in VM; every IO mocked; no public-data write or network request' },
  candidate: { file, indexBytes: Number(sizeProbe.stdout.trim()), stagedDigest, status: probe.status, error: probe.error.code, capturedBytes: probe.stdout.length,
    limit: 'candidate full-profile preconditions not run; verified helper failure and consequent comparison path only' }
};
fs.writeFileSync(new URL('./pass3-reproductions.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
