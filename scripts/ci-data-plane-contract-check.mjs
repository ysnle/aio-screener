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
const rollbackResolver = await import('./resolve-worker-rollback-version.mjs');
const workerImpact = await import('./worker-deploy-impact.mjs');
const watchdog = read('.github/workflows/data-watchdog.yml');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const watchdogScripts = (qaPipeline.profiles?.watchdog || []).flatMap((group) => qaPipeline.groups?.[group]?.gates || []).map((gate) => gate.script);

for (const token of ['scheduled', 'publishQuotes', 'AIO_QUOTES_KV', "'quotes:current'", "'quotes:heartbeat'", 'validateMarketSnapshot', 'tier0Coverage']) {
  if (!worker.includes(token)) fail(`Worker missing ${token}`);
}
for (const token of ['*/5 * * * *', 'AIO_QUOTES_KV_ID']) if (!wrangler.includes(token)) fail(`wrangler example missing ${token}`);
for (const token of ['workflow_run', 'workflow_dispatch', 'ci_run_id', 'aio-release-attestation', 'attested_change', 'worker-deploy-impact.mjs', 'getWorkerChangesBetween', 'shouldDeployWorker', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'AIO_QUOTES_KV_ID', 'wrangler']) if (!workflow.includes(token)) fail(`deploy workflow missing ${token}`);
for (const token of ['deployments list --json', 'rollback-baseline', 'wrangler rollback', 'Verify fast-plane rollback source identity']) if (!workflow.includes(token)) fail(`P1307/R652/QA-DATA-49 auto deploy/rollback missing ${token}`);
if (!/fetch-depth:\s*0/.test(workflow) || !/convergence-health\.json/.test(workflow) || !/sourceSha/.test(workflow)
  || !/branches\/main/.test(workflow) || !/latestMainSha/.test(workflow)
  || !/Recheck main head immediately before Worker mutation/.test(workflow) || !/steps\.latest-main\.outputs\.safe/.test(workflow)) fail('P1308/R653/QA-DATA-50 must compare latest main and live Worker SHA with full attested history');
const rollbackFixtureVersion = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';
// P1335: Wrangler returns deployments oldest-first; the newest (by created_on) is the active one.
if (rollbackResolver.resolveActiveWorkerVersionId({ deployments: [{ created_on: '2026-07-27T00:00:00Z', versions: [{ percentage: 100, version_id: '11111111-1111-4111-8111-111111111111' }] }, { created_on: '2026-09-20T00:00:00Z', versions: [{ percentage: 100, version_id: rollbackFixtureVersion }] }] }) !== rollbackFixtureVersion) throw new Error('rollback resolver must pick the newest deployment, not the first listed (P1335)');
if (rollbackResolver.resolveActiveWorkerVersionId({ deployments: [{ created_on: '2026-09-20T00:00:00Z', versions: [{ percentage: 100, version_id: rollbackFixtureVersion }] }] }) !== rollbackFixtureVersion) { // P1351: even a single rollback target must carry a valid date.
  fail('P1307/R652/QA-DATA-49 single active rollback target was not resolved');
}
let splitRollbackRefused = false;
try {
  rollbackResolver.resolveActiveWorkerVersionId({ deployments: [{ created_on: '2026-09-20T00:00:00Z', versions: [{ percentage: 50, version_id: rollbackFixtureVersion }, { percentage: 50, version_id: 'b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2' }] }] });
} catch { splitRollbackRefused = true; }
if (!splitRollbackRefused) fail('P1307/R652/QA-DATA-49 split active traffic must refuse automatic rollback selection');
const deploymentInputs = workerImpact.getWorkerDeploymentInputs();
const marketSnapshotDependency = workerImpact.classifyWorkerDeployChanges(['src/data/contracts/market-snapshot.js']);
const sourceKindDependency = workerImpact.classifyWorkerDeployChanges(['src/data/contracts/source-kind.js']);
const canceledRunRecovery = workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: false, liveSha: 'c'.repeat(40), testedSha: 'd'.repeat(40), latestMainSha: 'd'.repeat(40), cumulativeChanges: { dataPlane: true, aiProxy: false }, isAncestor: () => true });
const outdatedCiRunRejected = !workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: true, liveSha: 'e'.repeat(40), testedSha: 'd'.repeat(40), latestMainSha: 'f'.repeat(40) });
const newerLiveRejected = !workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: true, liveSha: 'f'.repeat(40), testedSha: 'e'.repeat(40), latestMainSha: 'e'.repeat(40), isAncestor: (ancestor, descendant) => ancestor === 'e'.repeat(40) && descendant === 'f'.repeat(40) });
const staleCiRunRejected = !workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: true, liveSha: 'd'.repeat(40), testedSha: 'e'.repeat(40), latestMainSha: 'f'.repeat(40) });
if (!['worker/data-plane.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/source-kind.js'].every((file) => deploymentInputs.dataPlane.includes(file))
  || !marketSnapshotDependency.dataPlane || !sourceKindDependency.dataPlane) fail('P1308/R653/QA-DATA-50 misses a transitive data-plane bundle source');
if (!canceledRunRecovery) fail('P1308/R653/QA-DATA-50 does not recover a canceled or replaced Worker run from cumulative live-SHA changes');
if (!outdatedCiRunRejected || !newerLiveRejected || !staleCiRunRejected) fail('P1308/R653/QA-DATA-50 permits stale CI to overwrite a newer main or live Worker SHA');
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
// P1578: /health states whether the refresh dispatcher is configured and never echoes the token.
if (smokeBody.schedulerDispatch?.configured !== false) fail('P1578 /health must report schedulerDispatch.configured=false without a token');
{
  const tokenBody = await (await dataPlane.fetch(new Request('https://fast.example/health'), { AIO_QUOTES_KV: kv, GITHUB_DISPATCH_TOKEN: 'github_pat_fixture_secret' })).json();
  if (tokenBody.schedulerDispatch?.configured !== true || JSON.stringify(tokenBody).includes('github_pat_fixture_secret')) fail('P1578 /health must report a configured dispatcher without exposing the token');
}

// P1156: the read routes ran for ANY method, so `POST /quotes` skipped the CDN cache and hit the
// KV namespace on every request — an unauthenticated, unmetered read amplifier. Keep the read
// surface GET/HEAD-only, and keep the token-gated write route working through the reorder.
const postQuotes = await dataPlane.fetch(new Request('https://fast.example/quotes', { method: 'POST' }), smokeEnv);
if (postQuotes.status !== 405) fail(`/quotes accepted a write verb: ${postQuotes.status}`);
const postHealth = await dataPlane.fetch(new Request('https://fast.example/health', { method: 'POST' }), smokeEnv);
if (postHealth.status !== 405) fail(`/health accepted a write verb: ${postHealth.status}`);
const readQuotes = await dataPlane.fetch(new Request('https://fast.example/quotes', { headers: { Origin: 'https://ysnle.github.io' } }), smokeEnv);
if (readQuotes.status !== 200) fail(`GET /quotes regressed: ${readQuotes.status}`);
const adminWithoutToken = await dataPlane.fetch(new Request('https://fast.example/admin/run', { method: 'POST' }), smokeEnv);
if (adminWithoutToken.status !== 401) fail(`/admin/run without the cron token was not refused: ${adminWithoutToken.status}`);

if (FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit !== 1000
  || FAST_PLANE_WRITE_POLICY.warningDailyTarget > FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit / 2
  || FAST_PLANE_WRITE_POLICY.maxSuccessfulKvWritesPerDay >= FAST_PLANE_WRITE_POLICY.warningDailyTarget
  || FAST_PLANE_WRITE_POLICY.maxSuccessfulKvWritesPerDayWorstCase >= FAST_PLANE_WRITE_POLICY.kvFreeTierDailyLimit
  || FAST_PLANE_WRITE_POLICY.heartbeatIntervalMs < 15 * 60 * 1000) fail('fast-plane write policy does not leave normal/worst-case KV free-tier safety margins');
if (!/revision-change-or-15m-liveness/.test(worker) || !/snapshotChanged/.test(worker) || !/kvWritePolicy/.test(worker)) fail('fast-plane worker lacks revision no-op and bounded heartbeat policy');

const originalFetch = globalThis.fetch;
const baseNow = Date.parse('2026-09-14T12:00:00Z');
let fixtureNow = Date.now();
let fixtureValue = 100;
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return { chart: { result: [{ meta: { regularMarketPrice: fixtureValue, regularMarketTime: Math.floor((fixtureNow - 60 * 60 * 1000) / 1000), marketState: 'CLOSED', chartPreviousClose: fixtureValue - 1, fullExchangeName: 'fixture' }, indicators: { quote: [{ close: [fixtureValue - 1, fixtureValue] }] } }] } };
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
  // P1266: exercise the authenticated write route under the same deterministic
  // quote transport as scheduled publication; CI must not depend on live Yahoo.
  const adminWithToken = await dataPlane.fetch(new Request('https://fast.example/admin/run', { method: 'POST', headers: { 'X-AIO-Cron-Token': 'cron-fixture' } }), new Proxy({ ...smokeEnv, AIO_CRON_SECRET: 'cron-fixture' }, { get: (t, p) => (p === 'AIO_QUOTES_BUCKET' || p === 'AIO_QUOTES_R2_BUCKET') ? fail('KV smoke touched an R2 binding') : Reflect.get(t, p) }));
  if (adminWithToken.status !== 200) fail(`/admin/run with a valid cron token regressed: ${adminWithToken.status}`);
  fixtureNow = baseNow;
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

// P1377: the Worker cron dispatches refresh-data at :20/:50 only with a token, as trigger=scheduler,
// and the workflow skips the operator-only full 13F chain for that trigger.
{
  const { dispatchRefreshData, REFRESH_DISPATCH_POLICY } = await import('../worker/data-plane.js');
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }); };
  const slot = Date.parse('2026-10-01T13:20:00Z');
  const none = await dispatchRefreshData({ env: {}, scheduledTime: slot, fetchImpl });
  const offSlot = await dispatchRefreshData({ env: { GITHUB_DISPATCH_TOKEN: 'fixture' }, scheduledTime: Date.parse('2026-10-01T13:25:00Z'), fetchImpl });
  const sent = await dispatchRefreshData({ env: { GITHUB_DISPATCH_TOKEN: 'fixture' }, scheduledTime: slot, fetchImpl });
  const body = calls[0] ? JSON.parse(calls[0].init.body) : null;
  if (none.dispatched || none.reason !== 'token-not-configured' || offSlot.dispatched || !sent.dispatched || calls.length !== 1
    || !/\/repos\/ysnle\/aio-screener\/actions\/workflows\/refresh-data\.yml\/dispatches$/.test(calls[0].url)
    || body?.ref !== 'main' || body?.inputs?.trigger !== REFRESH_DISPATCH_POLICY.trigger) fail(`P1377 refresh dispatch contract regressed: ${JSON.stringify({ none, offSlot, sent, calls: calls.length, body })}`);
  const refreshWorkflow = read('.github/workflows/refresh-data.yml');
  if (!/workflow_dispatch:\n\s+inputs:\n\s+trigger:/.test(refreshWorkflow) || !/inputs\.trigger != 'scheduler'/.test(refreshWorkflow)) fail('P1377 refresh-data must accept trigger=scheduler and keep the full 13F chain operator-only');
  if (!/dispatchRefreshData\(\{ env, scheduledTime: controller\?\.scheduledTime/.test(worker)) fail('P1377 scheduled() must dispatch refresh-data');
}

// P1518: a provider can send headers and never finish its body. Both mirrors
// remain bounded, failure records a heartbeat, and existing good data survives.
{
  const retained = kvValues.get('quotes:current');
  const signals = [];
  const stalled = await publishQuotes({ env: smokeEnv, now: baseNow, timeoutMs: 5,
    fetchImpl: async (_url, options) => {
      signals.push(options.signal);
      return { ok: true, status: 200, json: () => new Promise(() => {}) };
    }
  });
  if (stalled.ok || stalled.heartbeat.status !== 'failed' || !stalled.heartbeatWritten
      || signals.length !== stalled.snapshot.coverage.required * 2 || !signals.every(signal => signal.aborted)
      || kvValues.get('quotes:current') !== retained) fail('P1518 stalled bodies must finish with LKG retention and failure heartbeat');
  let firstHostCalls = 0;
  let fallbackCalls = 0;
  const recovered = await publishQuotes({ env: smokeEnv, now: baseNow, timeoutMs: 5,
    fetchImpl: async url => {
      if (url.includes('query1.')) {
        firstHostCalls++;
        return { ok: true, status: 200, json: () => new Promise(() => {}) };
      }
      fallbackCalls++;
      return { ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: {
        regularMarketPrice: 100, regularMarketTime: baseNow / 1000, marketState: 'CLOSED', previousClose: 99
      } }] } }) };
    }
  });
  if (!recovered.ok || firstHostCalls !== fallbackCalls || fallbackCalls !== recovered.snapshot.coverage.required) fail('P1518 body timeout must recover through the alternate host');
}

console.log(JSON.stringify({ ok: true, worker: 'cron+kv', kvSmoke: 'health/fixture-pass', qg: ['QG-01', 'QG-06', 'QG-08'], deploy: 'exact-CI-attested-auto+rollback' }));
