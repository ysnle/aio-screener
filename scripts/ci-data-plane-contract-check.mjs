import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[data-plane-contract] ${message}`); };

const worker = read('worker/data-plane.js');
const wrangler = read('worker/wrangler.example.toml');
const workflow = read('.github/workflows/deploy-data-plane.yml');
const watchdog = read('.github/workflows/data-watchdog.yml');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const watchdogScripts = (qaPipeline.profiles?.watchdog || []).flatMap((group) => qaPipeline.groups?.[group]?.gates || []).map((gate) => gate.script);

for (const token of ['scheduled', 'publishQuotes', 'AIO_QUOTES_KV', "'quotes:current'", "'quotes:heartbeat'", 'validateMarketSnapshot', 'tier0Coverage']) {
  if (!worker.includes(token)) fail(`Worker missing ${token}`);
}
for (const token of ['*/5 * * * *', 'AIO_QUOTES_KV_ID']) if (!wrangler.includes(token)) fail(`wrangler example missing ${token}`);
for (const token of ['workflow_dispatch', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'AIO_QUOTES_KV_ID', 'wrangler']) if (!workflow.includes(token)) fail(`deploy workflow missing ${token}`);
for (const source of [worker, wrangler, workflow]) {
  if (/AIO_QUOTES_BUCKET|AIO_QUOTES_R2_BUCKET|r2_buckets/i.test(source)) fail('R2 must remain disabled for the KV-only fast plane');
}
if (!/qa-runner\.mjs watchdog --no-cache/.test(watchdog) || !watchdogScripts.includes('scripts/ci-market-snapshot-contract-check.mjs')) fail('watchdog missing canonical market-snapshot gate');
for (const token of ['market-snapshot.json', 'market-snapshot-status.json']) if (!read('scripts/ci-market-snapshot-contract-check.mjs').includes(token)) fail(`market-snapshot gate missing ${token}`);
if (/git\s+push/.test(worker)) fail('Worker must not mutate repository state');
if (!/retainedRevision|last-known-good|lastKnownGood/i.test(worker)) fail('Worker does not expose LKG retention');

const { default: dataPlane } = await import('../worker/data-plane.js');
const kvValues = new Map([
  ['quotes:current', JSON.stringify({ revision: 'fixture:kv-only', coverage: { tier0Required: 16, tier0Observed: 16 } })],
  ['quotes:heartbeat', JSON.stringify({ status: 'published', revision: 'fixture:kv-only' })]
]);
const kv = {
  async get(key, type) {
    const value = kvValues.get(key) ?? null;
    return value && type === 'json' ? JSON.parse(value) : value;
  },
  async put(key, value) { kvValues.set(key, String(value)); }
};
const smokeEnv = new Proxy({ AIO_QUOTES_KV: kv, AIO_SOURCE_SHA: '1'.repeat(40) }, {
  get(target, property, receiver) {
    if (property === 'AIO_QUOTES_BUCKET' || property === 'AIO_QUOTES_R2_BUCKET') fail('KV smoke touched an R2 binding');
    return Reflect.get(target, property, receiver);
  }
});
const smokeResponse = await dataPlane.fetch(new Request('https://fast.example/health', { headers: { Origin: 'https://ysnle.github.io' } }), smokeEnv);
const smokeBody = await smokeResponse.json();
if (smokeResponse.status !== 200 || smokeBody.ok !== true || smokeBody.revision !== 'fixture:kv-only' || smokeBody.sourceSha !== '1'.repeat(40)) fail('KV-only /health smoke/exact-source identity failed');

console.log(JSON.stringify({ ok: true, worker: 'cron+kv', kvSmoke: 'health/fixture-pass', qg: ['QG-01', 'QG-06', 'QG-08'], deploy: 'manual-preflight' }));
