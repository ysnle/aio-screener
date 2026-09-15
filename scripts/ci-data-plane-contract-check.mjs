import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[data-plane-contract] ${message}`); };

const worker = read('worker/data-plane.js');
const wrangler = read('worker/wrangler.example.toml');
const workerReadme = read('worker/README.md');
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
for (const token of ['384 successful KV writes/day', '576/day', 'checkedAt', 'publishedAt', 'writtenAt']) {
  if (!workerReadme.includes(token)) fail(`worker README omits write-budget/evidence semantics: ${token}`);
}
if (!/qa-runner\.mjs watchdog --no-cache/.test(watchdog) || !watchdogScripts.includes('scripts/ci-market-snapshot-contract-check.mjs')) fail('watchdog missing canonical market-snapshot gate');
for (const token of ['market-snapshot.json', 'market-snapshot-status.json']) if (!read('scripts/ci-market-snapshot-contract-check.mjs').includes(token)) fail(`market-snapshot gate missing ${token}`);
if (/git\s+push/.test(worker)) fail('Worker must not mutate repository state');
if (!/retainedRevision|last-known-good|lastKnownGood/i.test(worker)) fail('Worker does not expose LKG retention');

const { default: dataPlane, publishQuotes, FAST_PLANE_WRITE_POLICY } = await import('../worker/data-plane.js');
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

if (FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit !== 1000
  || FAST_PLANE_WRITE_POLICY.warningDailyTarget > FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit / 2
  || FAST_PLANE_WRITE_POLICY.maxSuccessfulKvWritesPerDay >= FAST_PLANE_WRITE_POLICY.warningDailyTarget
  || FAST_PLANE_WRITE_POLICY.maxSuccessfulKvWritesPerDayWorstCase >= FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit
  || FAST_PLANE_WRITE_POLICY.heartbeatIntervalMs < 15 * 60 * 1000) fail('fast-plane write policy does not leave normal/worst-case KV free-tier safety margins');
if (!/revision-change-or-15m-liveness/.test(worker) || !/snapshotChanged/.test(worker) || !/kvWritePolicy/.test(worker)) fail('fast-plane worker lacks revision no-op and bounded heartbeat policy');

const originalFetch = globalThis.fetch;
const baseNow = Date.parse('2026-09-14T12:00:00Z');
let fixtureValue = 100;
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return { chart: { result: [{ meta: { regularMarketPrice: fixtureValue, regularMarketTime: Math.floor((baseNow - 60 * 60 * 1000) / 1000), marketState: 'CLOSED', chartPreviousClose: fixtureValue - 1, fullExchangeName: 'fixture' }, indicators: { quote: [{ close: [fixtureValue - 1, fixtureValue] }] } }] } };
  }
});
const writes = [];
const values = new Map();
const policyKv = {
  async get(key, type) {
    const value = values.get(key) ?? null;
    return value && type === 'json' ? JSON.parse(value) : value;
  },
  async put(key, value) { writes.push(key); values.set(key, String(value)); }
};
try {
  const policyEnv = { AIO_QUOTES_KV: policyKv };
  const first = await publishQuotes({ env: policyEnv, now: baseNow });
  if (!first.snapshotWritten || !first.heartbeatWritten || first.heartbeat.publishedAt !== first.snapshot.generatedAt || first.heartbeat.checkedAt !== first.snapshot.attemptedAt) fail(`first publish timestamp semantics regressed: ${JSON.stringify(first)}`);
  const stable = await publishQuotes({ env: policyEnv, now: baseNow + 5 * 60 * 1000 });
  const stableWrites = writes.length;
  if (stable.snapshotWritten || stable.heartbeatWritten || stable.heartbeat.publishedAt !== first.heartbeat.publishedAt || stable.heartbeat.checkedAt === first.heartbeat.checkedAt) fail(`stable snapshot must separate checkedAt from publishedAt/writtenAt: ${JSON.stringify(stable)}`);
  const liveness = await publishQuotes({ env: policyEnv, now: baseNow + 15 * 60 * 1000 });
  const livenessWrites = writes.length - stableWrites;
  if (liveness.snapshotWritten || !liveness.heartbeatWritten || liveness.heartbeat.publishedAt !== first.heartbeat.publishedAt || !liveness.heartbeatWrittenAt) fail(`liveness heartbeat must not masquerade as snapshot publication: ${JSON.stringify(liveness)}`);
  fixtureValue = 101;
  const changed = await publishQuotes({ env: policyEnv, now: baseNow + 20 * 60 * 1000 });
  if (!changed.snapshotWritten || changed.heartbeat.publishedAt !== changed.snapshot.generatedAt) fail(`changed snapshot publication semantics regressed: ${JSON.stringify(changed)}`);
  if (writes.filter((key) => key === 'quotes:current').length !== 2) fail(`unchanged snapshot rewrote quotes:current: ${JSON.stringify(writes)}`);
  if (stableWrites !== 2 || livenessWrites !== 1 || writes.length > FAST_PLANE_WRITE_POLICY.maxSuccessfulKvWritesPerDay) fail(`fast-plane write budget regression: ${JSON.stringify({ writes, stableWrites, livenessWrites, policy: FAST_PLANE_WRITE_POLICY })}`);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ ok: true, worker: 'cron+kv', kvSmoke: 'health/fixture-pass', qg: ['QG-01', 'QG-06', 'QG-08'], deploy: 'manual-preflight' }));
