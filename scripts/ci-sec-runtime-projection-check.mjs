import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sourceText = read('public-data/sec-fundamentals.json');
const runtimeText = read('public-data/sec-fundamentals-summary.json');
const source = JSON.parse(sourceText);
const runtime = JSON.parse(runtimeText);
const manifest = JSON.parse(read('public-data/sec-fundamentals-summary.manifest.json'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`[sec-runtime-projection] ${message}`); };

if (runtime.schemaVersion !== 'sec-fundamentals-runtime-summary.v1' || runtime.artifactRole !== 'BOUNDED_PAGE_PROJECTION') fail('runtime projection identity is invalid');
if (Buffer.byteLength(runtimeText) > 1024 * 1024) fail(`runtime projection exceeds 1 MiB: ${Buffer.byteLength(runtimeText)}`);
const sourceSymbols = Object.keys(source.data || {});
const runtimeSymbols = Object.keys(runtime.data || {});
if (sourceSymbols.length !== runtimeSymbols.length || sourceSymbols.some((symbol) => !runtime.data[symbol])) fail('runtime symbol coverage differs from canonical source');
for (const symbol of sourceSymbols) {
  const canonical = source.data[symbol];
  const projected = runtime.data[symbol];
  for (const field of ['symbol', 'cik', 'observedAt', 'filedAt', 'accession', 'revenue', 'netIncome']) {
    if (projected?.[field] !== canonical?.[field]) fail(`${symbol} field drift: ${field}`);
  }
  if (projected?.pit?.observations) fail(`${symbol} leaked append-only PIT observations into the page projection`);
  if ((projected?.pit?.observationCount || 0) !== (canonical?.pit?.observationCount || 0)) fail(`${symbol} PIT coverage count drifted`);
}
if (manifest.sourceSha256 !== sha256(sourceText) || manifest.runtimeSha256 !== sha256(runtimeText)) fail('projection digest manifest drifted');
if (manifest.sourceBytes !== Buffer.byteLength(sourceText) || manifest.runtimeBytes !== Buffer.byteLength(runtimeText) || manifest.records !== runtimeSymbols.length) fail('projection byte/count manifest drifted');
console.log(JSON.stringify({ ok: true, records: runtimeSymbols.length, sourceBytes: manifest.sourceBytes, runtimeBytes: manifest.runtimeBytes, reductionPct: Math.round((1 - manifest.runtimeBytes / manifest.sourceBytes) * 1000) / 10 }));
