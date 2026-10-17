import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { encodeScreenerArtifact, expandScreenerArtifact } from '../src/data/screener-extended.js';

const root = process.cwd();
const outIndex = process.argv.indexOf('--out');
const requestedOut = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) || (outIndex >= 0 ? process.argv[outIndex + 1] : null) || '_artifacts/screener-scale-benchmark.json';
const samples = 9;

// v57.93: rows are the published screener rows (~3 KB each with lineage, news and fundamentals), not ~200-byte
// synthetic rows, so parse cost and bytes match what the page receives. Larger sizes cycle the real rows under new
// symbols. The first size is the current core row count; 5,000 is about core + extended; 20,000 is headroom.
const artifactPath = path.resolve(root, 'public-data/screener.json');
const published = expandScreenerArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
const realRows = Object.values(published.data || {}).filter((row) => row && typeof row === 'object');
if (!realRows.length) throw new Error(`benchmark needs rows in ${artifactPath}`);
const sizes = [realRows.length, 5000, 20000];
const { data: _rows, ...artifactMeta } = published;

function buildData(size) {
  const data = {};
  for (let index = 0; index < size; index += 1) data[`B${String(index).padStart(5, '0')}`] = realRows[index % realRows.length];
  return data;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return Number(sorted[index].toFixed(3));
}

function measure(label, fn) {
  const durations = [];
  let result = null;
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    result = fn();
    durations.push(performance.now() - start);
  }
  return { label, p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), resultCount: Array.isArray(result) ? result.length : Number(result?.length || 0) };
}

function benchmarkSize(size) {
  const artifact = { ...artifactMeta, data: buildData(size) };
  const plainJson = JSON.stringify(artifact);
  const encodedJson = JSON.stringify(encodeScreenerArtifact(artifact));
  const before = process.memoryUsage().heapUsed;
  const parse = measure('json-parse', () => Object.keys(JSON.parse(plainJson).data));
  // The page's path: parse the encoded file, then expand it once (expandScreenerArtifact).
  const parseEncoded = measure('json-parse-encoded-expand', () => Object.keys(expandScreenerArtifact(JSON.parse(encodedJson)).data));
  const parsed = Object.entries(expandScreenerArtifact(JSON.parse(encodedJson)).data).map(([sym, row]) => ({ sym, ...row }));
  const projection = measure('column-projection', () => parsed.map((row) => ({ sym: row.sym, market: row.listingMarket, ret3m: row.ret3m, vol: row.vol, rsi: row.rsi, dollarVolume30d: row.dollarVolume30d })));
  const query = measure('rank-query', () => parsed.filter((row) => row.dollarVolume30d >= 1_000_000 && row.ret3m >= 0 && row.vol <= 45).sort((a, b) => b.ret3m - a.ret3m).slice(0, 100));
  const renderPrep = measure('render-preparation', () => parsed.slice(0, 250).map((row, rank) => ({ key: row.sym, rank: rank + 1, cells: [row.sym, row.listingMarket, row.ret1d, row.ret3m, row.vol, row.rsi, row.dollarVolume30d, row.newsMemo ? row.newsMemo.slice(0, 70) : null] })));
  const after = process.memoryUsage().heapUsed;
  return {
    size,
    serializedBytes: Buffer.byteLength(plainJson),
    encodedBytes: Buffer.byteLength(encodedJson),
    bytesPerRow: Math.round(Buffer.byteLength(plainJson) / size),
    encodedBytesPerRow: Math.round(Buffer.byteLength(encodedJson) / size),
    memoryDeltaBytes: Math.max(0, after - before),
    operations: { parse, parseEncoded, projection, query, renderPrep }
  };
}

const results = sizes.map(benchmarkSize);
const maxQueryP95 = Math.max(...results.map((entry) => entry.operations.query.p95Ms));
const maxRenderP95 = Math.max(...results.map((entry) => entry.operations.renderPrep.p95Ms));
const decision = maxQueryP95 <= 150 && maxRenderP95 <= 150 ? 'json-column-projection' : 'parquet-duckdb-candidate';
const report = {
  schemaVersion: 'screener-scale-benchmark.v2',
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, samples, synthetic: false, rowSource: 'public-data/screener.json rows (cycled beyond the core count)', artifactAsOf: published.asOf || null },
  sizes,
  results,
  decision,
  decisionReason: decision === 'json-column-projection' ? 'Query and render preparation over published-size rows remain within the local p95 budget; keep JSON and add projection/virtualization first.' : 'Query/render preparation over published-size rows exceeds the local p95 budget; retain JSON compatibility while spiking Parquet/DuckDB as the next scale candidate.',
  rightsBoundary: 'Benchmark reuses published research rows for size only and does not establish provider rights, PIT validity, or predictive model validity.'
};
const outputPath = path.resolve(root, requestedOut);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
