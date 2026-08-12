import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const root = process.cwd();
const outIndex = process.argv.indexOf('--out');
const requestedOut = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) || (outIndex >= 0 ? process.argv[outIndex + 1] : null) || '_artifacts/screener-scale-benchmark.json';
const sizes = [873, 5000, 20000];
const samples = 9;

function syntheticRow(index) {
  const market = index % 6 === 0 ? 'KR' : 'US';
  return {
    symbol: `${market === 'KR' ? 'K' : 'U'}${String(index).padStart(5, '0')}`,
    name: `Synthetic ${index}`,
    market,
    price: 50 + (index % 700) / 10,
    ret3m: ((index * 17) % 4000) / 100 - 20,
    volatility: 8 + ((index * 13) % 4200) / 100,
    rsi: 25 + ((index * 7) % 5000) / 100,
    dollarVolume30d: 500_000 + (index % 1000) * 25_000,
    rank: (index * 97) % 1000,
    observedAt: '2026-08-12T00:00:00.000Z'
  };
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
  const rows = Array.from({ length: size }, (_, index) => syntheticRow(index));
  const json = JSON.stringify({ schemaVersion: 'fixture.v1', rows });
  const before = process.memoryUsage().heapUsed;
  const parse = measure('json-parse', () => JSON.parse(json).rows);
  const parsed = JSON.parse(json).rows;
  const projection = measure('column-projection', () => parsed.map((row) => ({ symbol: row.symbol, market: row.market, price: row.price, ret3m: row.ret3m, volatility: row.volatility, rank: row.rank })));
  const query = measure('rank-query', () => parsed.filter((row) => row.dollarVolume30d >= 1_000_000 && row.ret3m >= 0 && row.volatility <= 45).sort((a, b) => b.rank - a.rank).slice(0, 100));
  const renderPrep = measure('render-preparation', () => parsed.slice(0, 250).map((row, rank) => ({ key: row.symbol, rank: rank + 1, cells: [row.symbol, row.name, row.market, row.price, row.ret3m, row.volatility, row.rank] })));
  const after = process.memoryUsage().heapUsed;
  return { size, serializedBytes: Buffer.byteLength(json), memoryDeltaBytes: Math.max(0, after - before), operations: { parse, projection, query, renderPrep } };
}

const results = sizes.map(benchmarkSize);
const maxQueryP95 = Math.max(...results.map((entry) => entry.operations.query.p95Ms));
const maxRenderP95 = Math.max(...results.map((entry) => entry.operations.renderPrep.p95Ms));
const decision = maxQueryP95 <= 150 && maxRenderP95 <= 150 ? 'json-column-projection' : 'parquet-duckdb-candidate';
const report = {
  schemaVersion: 'screener-scale-benchmark.v1',
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, samples, synthetic: true },
  sizes,
  results,
  decision,
  decisionReason: decision === 'json-column-projection' ? 'Synthetic query and render preparation remain within the local p95 budget; keep JSON and add projection/virtualization first.' : 'Synthetic p95 query/render preparation exceeds the local budget; retain JSON compatibility while spiking Parquet/DuckDB as the next scale candidate.',
  rightsBoundary: 'Benchmark is synthetic and does not establish provider rights, PIT validity, or predictive model validity.'
};
const outputPath = path.resolve(root, requestedOut);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
