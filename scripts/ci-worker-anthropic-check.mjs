// Atomic Worker /anthropic contract and concurrent quota fixture.
import worker, { AIOQuotaDurableObject } from '../cloudflare-worker-proxy.js';
import { readFileSync } from 'node:fs';

const errors = [];
const check = (label, condition, detail) => { if (!condition) errors.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); };
const PROD_ORIGIN = 'https://ysnle.github.io';
const DEV_ORIGIN = 'http://localhost:8891';

function makeReq({ origin = PROD_ORIGIN, method = 'POST', headers = {}, body } = {}) {
  return new Request('https://worker.example/anthropic', {
    method, headers: new Headers({ Origin: origin, ...headers }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function atomicQuota(initial = 0) {
  let count = initial;
  const reservations = new Set();
  return {
    async reserve({ cap, requestId }) {
      if (reservations.has(requestId)) return { ok: true, reserved: true, duplicate: true, count };
      if (count >= cap) return { ok: false, reserved: false, duplicate: false, count, reason: 'daily-cap' };
      count += 1;
      reservations.add(requestId);
      return { ok: true, reserved: true, duplicate: false, count };
    },
    async release({ requestId }) {
      if (!reservations.delete(requestId)) return { ok: true, released: false, idempotent: true, count };
      count = Math.max(0, count - 1);
      return { ok: true, released: true, idempotent: false, count };
    },
    get count() { return count; },
  };
}

async function main() {
  const workerSource = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');
  check('single canonical Anthropic handler', (workerSource.match(/async function handleAnthropic\(/g) || []).length === 1);
  check('legacy non-atomic KV handler removed', !workerSource.includes('env.AIO_QUOTA.get(') && !workerSource.includes('env.AIO_QUOTA.put('));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('api.anthropic.com')
    ? new Response(JSON.stringify({ id: 'fixture', type: 'message', content: [{ type: 'text', text: 'ok' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    : realFetch(url);
  const missing = await worker.fetch(makeReq({ body: {} }), {});
  check('missing key -> 503', missing.status === 503, missing.status);

  const legacyKv = { get: async () => '0', put: async () => {} };
  const legacy = await worker.fetch(makeReq({ body: {} }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: legacyKv });
  check('legacy KV without atomic binding -> 503', legacy.status === 503, legacy.status);

  const env = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: atomicQuota(), ANTHROPIC_DAILY_CAP: '5', AIO_DEV_ORIGINS: DEV_ORIGIN };
  const wrongPort = await worker.fetch(makeReq({ origin: 'http://localhost:8892', body: {} }), env);
  check('unconfigured dev port -> 403', wrongPort.status === 403, wrongPort.status);
  const devPreflight = await worker.fetch(makeReq({ origin: DEV_ORIGIN, method: 'OPTIONS' }), env);
  check('configured exact dev origin preflight -> 204', devPreflight.status === 204, devPreflight.status);
  check('configured dev origin echoed', devPreflight.headers.get('Access-Control-Allow-Origin') === DEV_ORIGIN, devPreflight.headers.get('Access-Control-Allow-Origin'));

  const noToken = await worker.fetch(makeReq({ body: {} }), { ...env, AIO_APP_TOKEN: 'secret' });
  check('missing app token -> 403', noToken.status === 403, noToken.status);
  const noQuota = await worker.fetch(makeReq({ body: {} }), { ANTHROPIC_API_KEY: 'sk-test' });
  check('no atomic quota -> 503', noQuota.status === 503, noQuota.status);
  const oversized = await worker.fetch(makeReq({ body: { messages: [{ role: 'user', content: 'x'.repeat(250 * 1024) }] } }), env);
  check('oversized body rejected before quota -> 413', oversized.status === 413, oversized.status);

  const quota = atomicQuota(0);
  const concurrentEnv = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: quota, ANTHROPIC_DAILY_CAP: '3' };
  const concurrent = await Promise.all(Array.from({ length: 12 }, (_, i) => worker.fetch(makeReq({
    headers: { 'X-AIO-Idempotency-Key': 'concurrent-' + i, 'cf-connecting-ip': '10.0.0.' + i }, body: { messages: [] }
  }), concurrentEnv)));
  check('concurrent cap has at most 3 accepted upstream attempts', concurrent.filter(res => ![429, 503].includes(res.status)).length <= 3, concurrent.map(res => res.status));
  check('atomic quota count never exceeds cap', quota.count <= 3, quota.count);

  const sameKeyQuota = atomicQuota(0);
  const sameKeyEnv = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: sameKeyQuota, ANTHROPIC_DAILY_CAP: '1' };
  const sameKey = await Promise.all(Array.from({ length: 5 }, () => worker.fetch(makeReq({ headers: { 'X-AIO-Idempotency-Key': 'same-key-1234' }, body: { messages: [] } }), sameKeyEnv)));
  check('same idempotency key is deduplicated', sameKeyQuota.count === 1, sameKeyQuota.count);

  const health = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), env);
  const healthBody = await health.json();
  check('health reports atomic quota configured', healthBody.ai?.quotaConfigured === true, healthBody);

  let observedJurisdiction = null;
  let observedAuthorityName = null;
  const namespaceEnv = {
    ANTHROPIC_API_KEY: 'sk-test',
    AIO_QUOTA_DO: {
      jurisdiction: (value) => {
        observedJurisdiction = value;
        return {
          getByName: (name) => {
            observedAuthorityName = name;
            return { fetch: async (url) => String(url).endsWith('/health')
              ? Response.json({ schemaVersion:'aio-ai-authority-health.v1', ready:true, jurisdiction:'us', configured:true })
              : new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200, headers: { 'content-type': 'application/json', 'X-AIO-Upstream-Authority': 'durable-object-us' } }) };
          },
        };
      },
    },
  };
  const durableProxy = await worker.fetch(makeReq({ body: { model: 'claude-haiku-4-5', max_tokens: 8, messages: [] } }), namespaceEnv);
  check('production namespace routes upstream through Durable Object', durableProxy.status === 200 && durableProxy.headers.get('X-AIO-Upstream-Authority') === 'durable-object-us', durableProxy.status);
  check('Durable Object uses guaranteed US jurisdiction', observedJurisdiction === 'us', observedJurisdiction);
  check('Durable Object uses versioned authority identity', observedAuthorityName === 'anthropic-authority-v1', observedAuthorityName);
  const authorityHealth = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), namespaceEnv);
  const authorityHealthBody = await authorityHealth.json();
  check('health executes the authority and requires US jurisdiction', authorityHealthBody.ai?.authorityReady === true && authorityHealthBody.ai?.authorityJurisdiction === 'us' && authorityHealthBody.ai?.ready === true, authorityHealthBody);

  const durableStorage = new Map();
  const durableState = {
    id: { jurisdiction: 'us' },
    storage: {
      get: async (key) => durableStorage.get(key),
      put: async (key, value) => { durableStorage.set(key, value); },
    },
    blockConcurrencyWhile: async (fn) => fn(),
  };
  const durable = new AIOQuotaDurableObject(durableState, { ANTHROPIC_API_KEY: 'sk-test' });
  const durableResponse = await durable.fetch(new Request('https://aio-quota.internal/proxy', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dayKey: 'claude:fixture', cap: 2, requestId: 'fixture-do-request', claudeBody: { model: 'claude-haiku-4-5', max_tokens: 8, messages: [] } }),
  }));
  check('Durable Object executes quota and provider in one authority', durableResponse.status === 200 && durableResponse.headers.get('X-AIO-Upstream-Authority') === 'durable-object-us', durableResponse.status);

  const wrongJurisdiction = new AIOQuotaDurableObject({ ...durableState, id: { jurisdiction: undefined } }, { ANTHROPIC_API_KEY: 'sk-test' });
  const wrongJurisdictionResponse = await wrongJurisdiction.fetch(new Request('https://aio-quota.internal/proxy', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dayKey: 'claude:fixture', cap: 2, requestId: 'fixture-wrong-jurisdiction', claudeBody: { model: 'claude-haiku-4-5', max_tokens: 8, messages: [] } }),
  }));
  check('non-US Durable Object fails closed before provider fetch', wrongJurisdictionResponse.status === 503, wrongJurisdictionResponse.status);

  if (errors.length) {
    console.error('Worker atomic quota check failed:');
    errors.forEach(error => console.error(' - ' + error));
    process.exit(1);
  }
  console.log('Worker atomic quota check OK: exact origins, US jurisdiction authority, fail-closed binding, idempotency, and concurrent cap fixture passed.');
  process.exit(0);
}

main();
