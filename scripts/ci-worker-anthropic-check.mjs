// Atomic Worker /anthropic contract and concurrent quota fixture.
import worker, { AIOQuotaDurableObject, prepareAnthropicBudget, anthropicMonthlyBudgetMicroUsd } from '../cloudflare-worker-proxy.js';
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
  let monthlyReservedMicroUsd = 0;
  const reservations = new Set();
  const amounts = new Map();
  const started = new Set();
  return {
    async reserve({ cap, requestId, reservationMicroUsd, monthlyCapMicroUsd }) {
      if (reservations.has(requestId)) return { ok: true, reserved: true, duplicate: true, count };
      if (count >= cap) return { ok: false, reserved: false, duplicate: false, count, reason: 'daily-cap' };
      if (monthlyReservedMicroUsd + reservationMicroUsd > monthlyCapMicroUsd) return { ok: false, reserved: false, count, reason: 'monthly-budget' };
      count += 1;
      monthlyReservedMicroUsd += reservationMicroUsd;
      reservations.add(requestId);
      amounts.set(requestId, reservationMicroUsd);
      return { ok: true, reserved: true, duplicate: false, count };
    },
    async start({ requestId }) { started.add(requestId); return { ok: true, started: true }; },
    async release({ requestId }) {
      if (started.has(requestId)) return { ok: true, released: false, retained: true, count };
      if (!reservations.delete(requestId)) return { ok: true, released: false, idempotent: true, count };
      monthlyReservedMicroUsd -= amounts.get(requestId);
      count = Math.max(0, count - 1);
      return { ok: true, released: true, idempotent: false, count };
    },
    async usage({ dayKey }) { return { ok: true, requestCount: dayKey.startsWith('claude:') ? count : 0, usageMonthUtc: dayKey.slice(7,14), monthlyReservedMicroUsd, monthlyPastSpendUnknown: false }; },
    get count() { return count; },
    get monthlyReservedMicroUsd() { return monthlyReservedMicroUsd; },
  };
}

async function main() {
  const workerSource = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');
  check('single canonical Anthropic handler', (workerSource.match(/async function handleAnthropic\(/g) || []).length === 1);
  check('legacy non-atomic KV handler removed', !workerSource.includes('env.AIO_QUOTA.get(') && !workerSource.includes('env.AIO_QUOTA.put('));
  const realFetch = globalThis.fetch;
  let anthropicFetchCount = 0;
  globalThis.fetch = async (url) => String(url).includes('api.anthropic.com')
    ? (anthropicFetchCount += 1, new Response(JSON.stringify({ id: 'fixture', type: 'message', content: [{ type: 'text', text: 'ok' }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    : realFetch(url);
  const missing = await worker.fetch(makeReq({ body: {} }), {});
  check('missing key -> 503', missing.status === 503, missing.status);

  const legacyKv = { get: async () => '0', put: async () => {} };
  const legacy = await worker.fetch(makeReq({ body: {} }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: legacyKv });
  check('legacy KV without atomic binding -> 503', legacy.status === 503, legacy.status);

  // P1157: /anthropic uses its own Cloudflare rate-limiting binding. A refusing binding must
  // return 429 before any upstream call; a missing binding must keep the previous Map behaviour.
  const refusingLimiter = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_ANTHROPIC: { limit: async () => ({ success: false }) } };
  const rateLimited = await worker.fetch(makeReq({ body: { messages: [] } }), refusingLimiter);
  check('P1157 a refusing rate-limit binding blocks /anthropic', rateLimited.status === 429, rateLimited.status);

  const env = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: atomicQuota(), ANTHROPIC_DAILY_CAP: '5', AIO_DEV_ORIGINS: DEV_ORIGIN };
  const operatorToken = 'operator-fixture-token-' + 'x'.repeat(32);
  const privateUsageEnv = { AIO_QUOTA_DO: atomicQuota(4), AIO_OPERATOR_TOKEN: operatorToken, ANTHROPIC_DAILY_CAP: '10' };
  const hiddenUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage'));
  check('P1312/R658/QA-OPS-02 private AI usage endpoint is undiscoverable until its operator secret is configured', hiddenUsage.status === 404 && hiddenUsage.headers.get('Cache-Control') === 'no-store', hiddenUsage.status);
  const rejectedUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': 'wrong-' + 'x'.repeat(32) } }), privateUsageEnv);
  check('P1312/R658/QA-OPS-02 private AI usage endpoint rejects an invalid operator secret without CORS', rejectedUsage.status === 404 && !rejectedUsage.headers.has('Access-Control-Allow-Origin'), rejectedUsage.status);
  const privateUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': operatorToken } }), privateUsageEnv);
  const privateUsageBody = await privateUsage.json();
  check('P1312/R658/QA-OPS-02 authorized private AI usage returns only the UTC-day count and configured Anthropic cap with no-store',
    privateUsage.status === 200
      && privateUsage.headers.get('Cache-Control') === 'no-store'
      && privateUsageBody.schemaVersion === 'aio-operator-ai-usage.v1'
      && privateUsageBody.usageDayUtc === new Date().toISOString().slice(0, 10)
      && privateUsageBody.requestCount === 4
      && privateUsageBody.anthropicDailyCap === 10
      && privateUsageBody.monthlyBudgetMicroUsd === 10000000
      && privateUsageBody.monthlyReservedMicroUsd === 0
      && privateUsageBody.accountingBasis === 'conservative-reservation-not-invoice'
      && !JSON.stringify(privateUsageBody).includes(operatorToken), privateUsageBody);
  const missingUsageSource = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': operatorToken } }), { AIO_OPERATOR_TOKEN: operatorToken, ANTHROPIC_DAILY_CAP: '10' });
  const malformedCapUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': operatorToken } }), { ...privateUsageEnv, ANTHROPIC_DAILY_CAP: 'not-a-cap' });
  check('P1312/R658/QA-OPS-02 private AI usage fails closed when quota source or configured cap is unavailable',
    missingUsageSource.status === 503 && malformedCapUsage.status === 503, { missingSource: missingUsageSource.status, malformedCap: malformedCapUsage.status });
  const methodUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { method: 'POST', headers: { 'X-AIO-Operator-Token': operatorToken } }), privateUsageEnv);
  check('P1312/R658/QA-OPS-02 authorized private AI usage accepts read-only GET only', methodUsage.status === 405, methodUsage.status);
  const wrongPort = await worker.fetch(makeReq({ origin: 'http://localhost:8892', body: {} }), env);
  check('unconfigured dev port -> 403', wrongPort.status === 403, wrongPort.status);
  const devPreflight = await worker.fetch(makeReq({ origin: DEV_ORIGIN, method: 'OPTIONS' }), env);
  check('configured exact dev origin preflight -> 204', devPreflight.status === 204, devPreflight.status);
  check('configured dev origin echoed', devPreflight.headers.get('Access-Control-Allow-Origin') === DEV_ORIGIN, devPreflight.headers.get('Access-Control-Allow-Origin'));
  check('idempotency headers are allowed by preflight', /X-AIO-Idempotency-Key/.test(devPreflight.headers.get('Access-Control-Allow-Headers') || '') && /X-AIO-Request-Id/.test(devPreflight.headers.get('Access-Control-Allow-Headers') || ''), devPreflight.headers.get('Access-Control-Allow-Headers'));

  const noToken = await worker.fetch(makeReq({ body: {} }), { ...env, AIO_APP_TOKEN: 'secret' });
  check('missing app token -> 403', noToken.status === 403, noToken.status);
  const noQuota = await worker.fetch(makeReq({ body: {} }), { ANTHROPIC_API_KEY: 'sk-test' });
  check('no atomic quota -> 503', noQuota.status === 503, noQuota.status);
  const oversized = await worker.fetch(makeReq({ body: { messages: [{ role: 'user', content: 'x'.repeat(250 * 1024) }] } }), env);
  check('oversized body rejected before quota -> 413', oversized.status === 413, oversized.status);
  const unicodeOversized = await worker.fetch(makeReq({ body: { messages: [{ role: 'user', content: '한'.repeat(75 * 1024) }] } }), env);
  check('UTF-8 body bytes rejected before quota -> 413', unicodeOversized.status === 413, unicodeOversized.status);

  const quota = atomicQuota(0);
  const concurrentEnv = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: quota, ANTHROPIC_DAILY_CAP: '3' };
  const concurrent = await Promise.all(Array.from({ length: 12 }, (_, i) => worker.fetch(makeReq({
    headers: { 'X-AIO-Idempotency-Key': 'concurrent-' + i, 'cf-connecting-ip': '10.0.0.' + i }, body: { messages: [] }
  }), concurrentEnv)));
  check('concurrent cap has at most 3 accepted upstream attempts', concurrent.filter(res => ![429, 503].includes(res.status)).length <= 3, concurrent.map(res => res.status));
  check('atomic quota count never exceeds cap', quota.count <= 3, quota.count);

  const sameKeyQuota = atomicQuota(0);
  const sameKeyEnv = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: sameKeyQuota, ANTHROPIC_DAILY_CAP: '1' };
  const beforeSameKeyFetches = anthropicFetchCount;
  const sameKey = await Promise.all(Array.from({ length: 5 }, () => worker.fetch(makeReq({ headers: { 'X-AIO-Idempotency-Key': 'same-key-1234' }, body: { messages: [] } }), sameKeyEnv)));
  check('same idempotency key is deduplicated', sameKeyQuota.count === 1, sameKeyQuota.count);
  check('duplicate idempotency key invokes upstream exactly once', anthropicFetchCount - beforeSameKeyFetches === 1 && sameKey.filter((response) => response.status === 409).length === 4, { fetches: anthropicFetchCount - beforeSameKeyFetches, statuses: sameKey.map((response) => response.status) });

  const repeatedBodyQuota = atomicQuota(0);
  const repeatedBodyEnv = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA_DO: repeatedBodyQuota, ANTHROPIC_DAILY_CAP: '3' };
  const repeatedBody = await Promise.all(Array.from({ length: 2 }, () => worker.fetch(makeReq({ body: { messages: [{ role: 'user', content: 'same prompt' }] } }), repeatedBodyEnv)));
  check('identical bodies without idempotency key count as separate attempts', repeatedBodyQuota.count === 2 && repeatedBody.every((response) => response.status === 200), { count: repeatedBodyQuota.count, statuses: repeatedBody.map((response) => response.status) });

  env.AIO_SOURCE_SHA = '2'.repeat(40);
  const health = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), env);
  const healthBody = await health.json();
  check('health reports atomic quota configured', healthBody.ai?.quotaConfigured === true, healthBody);
  check('health reports exact source SHA', healthBody.sourceSha === '2'.repeat(40), healthBody);

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

  const currentUtcDay = new Date().toISOString().slice(0, 10);
  const durableStorage = new Map([['quota-state', { schemaVersion: 2, months: { [currentUtcDay.slice(0,7)]: 100000 }, legacyUnknownMonths: {}, days: { 'claude:2020-01-01': 9, [`claude:${currentUtcDay}`]: 7 }, reservations: { 'claude:2020-01-01:old': 1 } }]]);
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
  const prunedState = durableStorage.get('quota-state');
  check('Durable Object prunes expired day and reservation state', !Object.hasOwn(prunedState.days, 'claude:2020-01-01') && !Object.hasOwn(prunedState.reservations, 'claude:2020-01-01:old'), prunedState);
  const durableUsage = await durable.fetch(new Request('https://aio-quota.internal/usage', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dayKey: `claude:${currentUtcDay}` }),
  }));
  const durableUsageBody = await durableUsage.json();
  check('P1312/R658/QA-OPS-02 US Durable Object exposes an Anthropic-only read of the existing UTC-day counter',
    durableUsage.status === 200 && durableUsageBody.ok === true && durableUsageBody.requestCount === 8, durableUsageBody);
  let invalidUsageRejected = false;
  try {
    await durable.fetch(new Request('https://aio-quota.internal/usage', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dayKey: `relay:fred:${currentUtcDay}` }),
    }));
  } catch { invalidUsageRejected = true; }
  check('P1312/R658/QA-OPS-02 Durable Object usage reads reject non-Anthropic day keys', invalidUsageRejected, invalidUsageRejected);
  let impossibleUsageDayRejected = false;
  try {
    await durable.fetch(new Request('https://aio-quota.internal/usage', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dayKey: 'claude:2026-02-31' }),
    }));
  } catch { impossibleUsageDayRejected = true; }
  check('P1312/R658/QA-OPS-02 Durable Object usage reads reject impossible calendar dates', impossibleUsageDayRejected, impossibleUsageDayRejected);
  const corruptUsage = new AIOQuotaDurableObject({ ...durableState, storage: {
    get: async () => ({ schemaVersion: 2, months: {}, legacyUnknownMonths: {}, days: { [`claude:${currentUtcDay}`]: -1 }, reservations: {} }),
    put: async () => {},
  } }, { ANTHROPIC_API_KEY: 'sk-test' });
  let corruptUsageRejected = false;
  try {
    await corruptUsage.fetch(new Request('https://aio-quota.internal/usage', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dayKey: `claude:${currentUtcDay}` }),
    }));
  } catch { corruptUsageRejected = true; }
  check('P1312/R658/QA-OPS-02 Durable Object usage reads reject malformed stored counts', corruptUsageRejected, corruptUsageRejected);

  const wrongJurisdiction = new AIOQuotaDurableObject({ ...durableState, id: { jurisdiction: undefined } }, { ANTHROPIC_API_KEY: 'sk-test' });
  const wrongJurisdictionResponse = await wrongJurisdiction.fetch(new Request('https://aio-quota.internal/proxy', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dayKey: 'claude:fixture', cap: 2, requestId: 'fixture-wrong-jurisdiction', claudeBody: { model: 'claude-haiku-4-5', max_tokens: 8, messages: [] } }),
  }));
  check('non-US Durable Object fails closed before provider fetch', wrongJurisdictionResponse.status === 503, wrongJurisdictionResponse.status);

  // P1353: exercise the production Worker -> real DO -> mocked provider path,
  // not just an optimistic reserve mock. Storage returns copies, and its lock
  // serializes concurrent read/modify/write operations like the Cloudflare DO.
  const RealDate = globalThis.Date;
  let clock = RealDate.parse('2026-09-30T23:59:00Z');
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } };
  function durableHarness(initial) {
    let saved = initial === undefined ? undefined : structuredClone(initial);
    let serial = Promise.resolve();
    const state = { id: { jurisdiction: 'us' }, storage: {
      get: async () => saved === undefined ? undefined : structuredClone(saved),
      put: async (_key, value) => { saved = structuredClone(value); },
    }, blockConcurrencyWhile: fn => { const task = serial.then(fn, fn); serial = task.catch(() => {}); return task; } };
    const env = { ANTHROPIC_API_KEY: 'fixture-only', ANTHROPIC_DAILY_CAP: '100', ANTHROPIC_MAX_TOKENS: '8', ANTHROPIC_MONTHLY_BUDGET_USD: '10' };
    let object = new AIOQuotaDurableObject(state, env);
    env.AIO_QUOTA_DO = { jurisdiction: () => ({ getByName: () => ({ fetch: async (url, init) => object.fetch(new Request(url, init)) }) }) };
    return { env, object: () => object, saved: () => structuredClone(saved), replace: value => { saved = structuredClone(value); }, restart: () => { object = new AIOQuotaDurableObject(state, env); } };
  }
  let budgetFetches = 0;
  let fixtureSequence = 0;
  const budgetBody = { model: 'claude-haiku-4-5', max_tokens: 8, messages: [{ role: 'user', content: 'Hello' }] };
  const budgetRequest = (body = budgetBody, id = 'budget-id-' + (++fixtureSequence)) => makeReq({ body,
    headers: { 'X-AIO-Idempotency-Key': id, 'cf-connecting-ip': 'budget-ip-' + (++fixtureSequence) } });
  const okProvider = async () => { budgetFetches++; return Response.json({ content: [{ type: 'text', text: 'ok' }] }); };
  globalThis.fetch = okProvider;
  try {
    const fixture = durableHarness();
    const cost = prepareAnthropicBudget(budgetBody, fixture.env).reservationMicroUsd;
    fixture.env.ANTHROPIC_MONTHLY_BUDGET_USD = (cost * 2 / 1000000).toFixed(6);
    const before = budgetFetches;
    const batch = await Promise.all(Array.from({ length: 12 }, () => worker.fetch(budgetRequest(), fixture.env)));
    await Promise.all(batch.map(response => response.text()));
    check('P1353 concurrent monthly cap admits exactly two provider calls', budgetFetches - before === 2 && batch.filter(r => r.status === 200).length === 2, batch.map(r => r.status));
    check('P1353 monthly integer ledger never exceeds configured reservation cap', fixture.saved().months['2026-09'] === cost * 2, fixture.saved());
    fixture.env.AIO_OPERATOR_TOKEN = operatorToken;
    const observedUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': operatorToken } }), fixture.env);
    const observedUsageBody = await observedUsage.json();
    check('P1353 private operator usage reports reservations, UTC month and limited scope', observedUsage.status === 200
      && observedUsageBody.monthlyReservedMicroUsd === cost * 2 && observedUsageBody.monthlyBudgetMicroUsd === cost * 2
      && observedUsageBody.usageMonthUtc === '2026-09' && observedUsageBody.accountingBasis === 'conservative-reservation-not-invoice'
      && /excludes personal-key-browser and GitHub-Actions/.test(observedUsageBody.scope), observedUsageBody);
    const publicBudgetHealth = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), fixture.env);
    const publicBudgetText = await publicBudgetHealth.text();
    check('P1353 public health never exposes monthly ledger or operator secrets', publicBudgetHealth.status === 200
      && !/monthlyReserved|monthlyBudget|monthlyPastSpendUnknown|usageMonthUtc/.test(publicBudgetText)
      && !publicBudgetText.includes(operatorToken) && !publicBudgetText.includes('fixture-only'), publicBudgetText);
    fixture.restart();
    const restarted = await worker.fetch(budgetRequest(), fixture.env);
    check('P1353 restart cannot reset exhausted monthly budget', restarted.status === 429 && budgetFetches - before === 2, restarted.status);
    const keys = Object.keys(fixture.saved().reservations);
    const reservedKey = keys[0];
    const reservedRecord = fixture.saved().reservations[reservedKey];
    await fixture.object().mutateQuota('release', { dayKey: reservedRecord.dayKey, requestId: reservedKey.slice(reservedRecord.dayKey.length + 1) });
    check('P1353 started release retains the original month reservation', fixture.saved().months['2026-09'] === cost * 2, fixture.saved());
    clock = RealDate.parse('2026-10-01T00:01:00Z');
    const nextMonth = await worker.fetch(budgetRequest(), fixture.env); await nextMonth.text();
    check('P1353 UTC rollover creates independent headroom without erasing previous month', nextMonth.status === 200 && fixture.saved().months['2026-09'] === cost * 2 && fixture.saved().months['2026-10'] === cost, fixture.saved());

    const preflight = { dayKey: 'claude:2026-09-30', cap: 100, requestId: 'preflight-late-release', reservationMicroUsd: cost, monthlyCapMicroUsd: 10000000 };
    const releasing = durableHarness();
    await releasing.object().mutateQuota('reserve', preflight);
    const septemberBefore = releasing.saved().months['2026-09'];
    await releasing.object().mutateQuota('reserve', { ...preflight, dayKey: 'claude:2026-10-01', requestId: 'october-start' });
    await releasing.object().mutateQuota('release', preflight);
    await releasing.object().mutateQuota('release', preflight);
    check('P1353 delayed pre-dispatch release refunds the stored month exactly once', septemberBefore === cost && releasing.saved().months['2026-09'] === 0 && releasing.saved().months['2026-10'] === cost, releasing.saved());

    const duplicate = durableHarness();
    const beforeDuplicates = budgetFetches;
    const duplicateResponses = await Promise.all(Array.from({ length: 5 }, () => worker.fetch(budgetRequest(budgetBody, 'same-monthly-id'), duplicate.env)));
    await Promise.all(duplicateResponses.map(r => r.text()));
    check('P1353 duplicate id charges and dispatches exactly once', budgetFetches - beforeDuplicates === 1 && duplicate.saved().months['2026-10'] === cost && duplicateResponses.filter(r => r.status === 409).length === 4, duplicateResponses.map(r => r.status));

    const legacy = durableHarness({ days: { 'claude:2026-10-01': 4 }, reservations: {} });
    const beforeLegacy = budgetFetches;
    const blockedLegacy = await worker.fetch(budgetRequest(), legacy.env);
    const legacyMessage = await blockedLegacy.text();
    check('P1353 legacy month with unprovable past spend fails closed without provider dispatch', blockedLegacy.status === 429 && budgetFetches === beforeLegacy && legacy.saved().legacyUnknownMonths['2026-10'] === true && /과거 AI 비용/.test(legacyMessage), legacyMessage);
    const corrupt = durableHarness(duplicate.saved());
    const tampered = corrupt.saved(); tampered.months['2026-10'] = 0; corrupt.replace(tampered); corrupt.restart();
    const corruptResponse = await worker.fetch(budgetRequest(), corrupt.env);
    check('P1353 a reset monthly counter fails closed instead of restoring headroom', corruptResponse.status === 503 && budgetFetches === beforeLegacy, corruptResponse.status);

    for (const invalid of ['-1','NaN','Infinity','10.000001','10junk','',null]) {
      const invalidFixture = durableHarness(); invalidFixture.env.ANTHROPIC_MONTHLY_BUDGET_USD = invalid;
      const at = budgetFetches; const result = await worker.fetch(budgetRequest(), invalidFixture.env);
      check('P1353 invalid monthly budget rejects before provider: ' + invalid, result.status === 503 && budgetFetches === at, result.status);
    }
    const zero = durableHarness(); zero.env.ANTHROPIC_MONTHLY_BUDGET_USD = '0';
    const atZero = budgetFetches; const zeroResult = await worker.fetch(budgetRequest(), zero.env);
    check('P1353 zero budget is an explicit closed ceiling', zeroResult.status === 429 && budgetFetches === atZero, zeroResult.status);
    for (const model of ['claude-sonnet-99','claude-opus-4-6','claude-haiku-latest','toString',['claude-haiku-4-5']]) {
      const invalidFixture = durableHarness(); const at = budgetFetches;
      const result = await worker.fetch(budgetRequest({ ...budgetBody, model }), invalidFixture.env);
      check('P1353 unknown model is not silently repriced: ' + model, result.status === 400 && budgetFetches === at, result.status);
    }
    const serverTool = durableHarness(); const atTool = budgetFetches;
    const toolResult = await worker.fetch(budgetRequest({ ...budgetBody, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] }), serverTool.env);
    check('P1353 unbounded paid server tool is explicitly rejected before dispatch', toolResult.status === 400 && budgetFetches === atTool && /유료 서버 검색/.test(await toolResult.text()), toolResult.status);
    const custom = durableHarness(); const beforeCustom = budgetFetches;
    const customResult = await worker.fetch(budgetRequest({ ...budgetBody, tools: [{ name: 'local_context', description: 'Read local context', input_schema: { type: 'object', properties: { id: { type: 'string' } } } }] }), custom.env);
    await customResult.text();
    check('P1353 bounded custom client tools remain supported', customResult.status === 200 && budgetFetches === beforeCustom + 1, customResult.status);
    for (const invalidBody of [
      { ...budgetBody, max_tokens: -1 }, { ...budgetBody, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://fixture.invalid/image' } }] }] },
      { ...budgetBody, service_tier: 'premium' }, { ...budgetBody, inference_geo: 'us' },
    ]) {
      const invalidFixture = durableHarness(); const at = budgetFetches;
      const response = await worker.fetch(budgetRequest(invalidBody), invalidFixture.env);
      check('P1353 unpriced input/mode fails closed before dispatch', response.status === 400 && budgetFetches === at, { body: invalidBody, status: response.status });
    }
    const price = prepareAnthropicBudget({ ...budgetBody, model: 'claude-sonnet-4-6', system: [{ type: 'text', text: '한글', cache_control: { type: 'ephemeral', ttl: '1h' } }], inference_geo: 'us' }, {});
    check('P1353 reservation includes UTF-8/framing, worst cache write and US premium', price.inputTokenUpperBound > new TextEncoder().encode('한글').byteLength && price.reservationMicroUsd === Math.ceil((price.inputTokenUpperBound * 3 * 2 + 8 * 15) * 11 / 10) && anthropicMonthlyBudgetMicroUsd({}) === 10000000, price);
    const errorFixture = durableHarness(); const beforeError = budgetFetches;
    globalThis.fetch = async () => { budgetFetches++; throw new DOMException('fixture timeout after dispatch', 'AbortError'); };
    const errored = await worker.fetch(budgetRequest(), errorFixture.env);
    check('P1353 post-dispatch timeout retains monthly reservation', errored.status === 502 && budgetFetches === beforeError + 1 && errorFixture.saved().months['2026-10'] === cost && Object.values(errorFixture.saved().reservations)[0].started === true, errorFixture.saved());
    globalThis.fetch = async () => { budgetFetches++; return Response.json({ error: 'fixture bad gateway' }, { status: 502 }); };
    const providerError = await worker.fetch(budgetRequest(), errorFixture.env); await providerError.text();
    check('P1353 provider error is not assumed unbilled', errorFixture.saved().months['2026-10'] === cost * 2, errorFixture.saved());
    globalThis.fetch = okProvider;
  } finally { globalThis.Date = RealDate; }

  // Isolated provider and clock: never wait 60 seconds or contact a real API.
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const deadlines = new Map();
  globalThis.setTimeout = (callback, delay) => {
    if (delay !== 60000) return realSetTimeout(callback, delay);
    const id = {}; deadlines.set(id, callback); return id;
  };
  globalThis.clearTimeout = (id) => { if (!deadlines.delete(id)) realClearTimeout(id); };
  try {
    let sequence = 0;
    for (const route of ['direct', 'durable']) {
      let streamQuota;
      const invoke = (signal) => {
        sequence += 1;
        if (route === 'direct') { streamQuota = atomicQuota(); return worker.fetch(new Request('https://worker.example/anthropic', {
          method: 'POST', headers: { Origin: PROD_ORIGIN, 'cf-connecting-ip': 'stream-' + sequence },
          body: JSON.stringify({ messages: [] }), signal,
        }), { ANTHROPIC_API_KEY: 'fixture-only', AIO_QUOTA_DO: streamQuota }); }
        return durable.fetch(new Request('https://aio-quota.internal/proxy', {
          method: 'POST', body: JSON.stringify({ dayKey: 'claude:stream', cap: 100, requestId: 'stream-' + sequence, claudeBody: { messages: [] } }), signal,
        }));
      };
      for (const action of ['timeout', 'caller-abort', 'body-cancel', 'complete', 'fetch-reject']) {
        let providerSignal;
        let cancelled = false;
        globalThis.fetch = async (_url, init) => {
          providerSignal = init.signal;
          if (action === 'fetch-reject') throw new Error('fixture provider offline');
          return new Response(new ReadableStream({
            start(controller) { if (action === 'complete') { controller.enqueue(new TextEncoder().encode('ok')); controller.close(); } },
            cancel() { cancelled = true; },
          }), { headers: { 'content-type': 'text/event-stream' } });
        };
        const caller = new AbortController();
        const response = await invoke(caller.signal);
        if (action === 'fetch-reject') {
          check(route + ' rejected fetch clears deadline', response.status === 502 && deadlines.size === 0);
          continue;
        }
        check(route + ' deadline survives response headers: ' + action, deadlines.size === 1, deadlines.size);
        if (action === 'complete') {
          check(route + ' complete stream preserved', await response.text() === 'ok');
        } else if (action === 'body-cancel') {
          await response.body.cancel('fixture consumer closed');
          check(route + ' body cancellation reaches provider', providerSignal.aborted && cancelled);
        } else {
          const reading = response.text().then(() => false, () => true);
          if (action === 'timeout') for (const callback of [...deadlines.values()]) callback();
          else caller.abort();
          const rejected = await Promise.race([reading, new Promise(resolve => realSetTimeout(() => resolve(false), 100))]);
          check(route + ' ' + action + ' interrupts stalled body', rejected && providerSignal.aborted && cancelled);
        }
        check(route + ' ' + action + ' clears deadline', deadlines.size === 0, deadlines.size);
        check('P1353 ' + route + ' streaming ' + action + ' retains dispatched reservation', route === 'direct'
          ? streamQuota.monthlyReservedMicroUsd > 0
          : Object.values(durableStorage.get('quota-state').reservations).some(row => typeof row === 'object' && row.started === true && row.reservationMicroUsd > 0));
      }
    }
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }

  if (errors.length) {
    console.error('Worker atomic quota check failed:');
    errors.forEach(error => console.error(' - ' + error));
    process.exit(1);
  }
  console.log('Worker atomic quota check OK: exact origins, US jurisdiction authority, fail-closed binding, idempotency, and concurrent cap fixture passed.');
  process.exit(0);
}

main();
