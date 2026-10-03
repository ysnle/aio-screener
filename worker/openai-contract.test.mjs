// P1421: shared OpenAI gateway, conservative admission and verified settlement.
import worker, { AIOQuotaDurableObject, prepareOpenAiBudget, aiMonthlyBudgetMicroUsd } from '../cloudflare-worker-proxy.js';
import { verifiedOpenAiCharge } from './openai-budget.mjs';
import { createOpenAiReceiptObserver } from './openai-usage.mjs';
import { readFileSync } from 'node:fs';
const errors = []; let checks = 0;
const check = (label, condition, detail) => { checks++; if (!condition) errors.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); };
const rejects = (label, fn) => { let rejected = false; try { fn(); } catch { rejected = true; } check('P1421 ' + label, rejected); };
const PROD = 'https://ysnle.github.io';
const TOKEN = 'fixture-automation-token-' + 'x'.repeat(32);
const body = { model: 'gpt-6-luna', input: [{ role: 'user', content: '한글 and text' }], max_output_tokens: 64, reasoning: { effort: 'none' }, store: false };
const usageResponse = (overrides = {}) => ({ id: 'resp_fixture', object: 'response', model: 'gpt-6-luna', status: 'completed', service_tier: 'default', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok', annotations: [] }] }], usage: { input_tokens: 16, output_tokens: 8, total_tokens: 24 }, ...overrides });
function req(data = body, { origin = PROD, headers = {}, path = '/openai', method = 'POST', signal } = {}) {
  return new Request('https://worker.example' + path, { method, signal, headers: { ...(origin ? { Origin: origin } : {}), ...headers }, ...(method === 'POST' ? { body: JSON.stringify(data) } : {}) });
}
function harness(saved, extraEnv = {}) {
  const rows = new Map(saved ? [['quota-state', structuredClone(saved)]] : []);
  let queue = Promise.resolve(); let observedName;
  const state = { id: { jurisdiction: 'us' }, storage: { get: async key => structuredClone(rows.get(key)), put: async (key, value) => rows.set(key, structuredClone(value)) }, blockConcurrencyWhile(fn) { const job = queue.then(fn, fn); queue = job.catch(() => {}); return job; } };
  const env = { OPENAI_API_KEY: 'fake-not-a-live-key', AI_DAILY_CAP: '300', AI_MAX_OUTPUT_TOKENS: '4000', AI_MONTHLY_BUDGET_USD: '10', AIO_AUTOMATION_TOKEN: TOKEN, AIO_DEV_ORIGINS: 'http://localhost:8891', ...extraEnv };
  const durable = new AIOQuotaDurableObject(state, env);
  env.AIO_QUOTA_DO = { jurisdiction(value) { if (value !== 'us') throw new Error('wrong jurisdiction'); return { getByName(name) { observedName = name; return { fetch(url, init) { return durable.fetch(new Request(url, init)); } }; } }; } };
  return { env, durable, state, saved: () => rows.get('quota-state'), name: () => observedName };
}
const currentDay = new Date().toISOString().slice(0, 10), currentMonth = currentDay.slice(0, 7);
const payload = (id, amount = 1000, cap = 10000000) => ({ dayKey: 'claude:' + currentDay, cap: 300, requestId: id, reservationMicroUsd: amount, monthlyCapMicroUsd: cap });

async function main() {
  const source = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');
  check('P1421 one OpenAI handler and no Anthropic upstream', (source.match(/async function handleOpenAi\(/g) || []).length === 1 && !source.includes('api.anthropic.com'));
  check('P1353/P1421 stable DO identity preserves prior dollar ledger', source.includes("getByName('anthropic-authority-v1')") && source.includes('const BUDGET_SCHEMA = 2'));
  check('P1421 zero to ten dollar integer cap', aiMonthlyBudgetMicroUsd({}) === 10000000 && aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: '0' }) === 0 && aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: '0.000001' }) === 1);
  for (const amount of ['-1','10.000001','1e1','NaN','1.0000001']) rejects('invalid monthly cap ' + amount, () => aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: amount }));
  const budget = prepareOpenAiBudget(body);
  check('P1421 reserve covers UTF8/framing/cache-write/regional premium and reasoning-inclusive output', budget.inputTokenUpperBound > new TextEncoder().encode(JSON.stringify(body)).byteLength && budget.reservationMicroUsd === Math.ceil(budget.inputTokenUpperBound * 0.1375 + 64 * 0.55));
  check('P1421 output clamp and no persisted provider state', prepareOpenAiBudget({ ...body, max_output_tokens: 8000 }).body.max_output_tokens === 4000 && budget.body.store === false && budget.body.service_tier === 'default');
  [
    { ...body, model: 'claude-haiku-4-5' }, { ...body, model: 'gpt-6-sol' }, { ...body, service_tier: 'priority' }, { ...body, service_tier: 'auto' }, { ...body, store: true },
    { ...body, previous_response_id: 'resp_other' }, { ...body, background: true }, { ...body, tools: [{ type: 'web_search' }] }, { ...body, input: [{ role: 'user', content: [{ type: 'input_image', image_url: 'data:image/png;base64,x' }] }] },
    { ...body, input: [{ role: 'user', content: [{ type: 'input_file', file_id: 'file_x' }] }] }, { ...body, reasoning: { effort: 'low', summary: 'auto' } }, { ...body, max_output_tokens: 0 }, { ...body, max_output_tokens: 1.1 },
    { ...body, input: Array.from({ length: 64 }, () => ({ role: 'user', content: 'x'.repeat(3000) })), tools: Array.from({ length: 32 }, (_, i) => ({ type: 'function', name: 'fn' + i, parameters: {} })) }
  ].forEach((value, index) => rejects('unsupported cost expansion ' + index, () => prepareOpenAiBudget(value)));
  check('P1421 local function loop and JSON schema supported', prepareOpenAiBudget({ ...body, input: [{ type: 'function_call', call_id: 'call_1', name: 'get_fact', arguments: '{}' }, { type: 'function_call_output', call_id: 'call_1', output: '{"fact":1}' }], tools: [{ type: 'function', name: 'get_fact', parameters: { type: 'object', properties: {} }, strict: false }], text: { format: { type: 'json_schema', name: 'fact', schema: { type: 'object' }, strict: false } } }).body.model === 'gpt-6-luna');
  const charge = verifiedOpenAiCharge(usageResponse(), budget);
  check('P1421 verified charge uses worst premium without cache discount', charge === Math.ceil(16 * 0.1375 + 8 * 0.55));
  for (const response of [usageResponse({ model: 'gpt-6-sol' }), usageResponse({ status: 'incomplete' }), usageResponse({ usage: { input_tokens: 16, output_tokens: 8 } }), usageResponse({ usage: { input_tokens: 16, output_tokens: 65, total_tokens: 81 } }), usageResponse({ usage: { input_tokens: 16, output_tokens: -1, total_tokens: 15 } }), usageResponse({ service_tier: 'priority' })]) check('P1421 invalid receipt cannot replenish', verifiedOpenAiCharge(response, budget) === null);
  const originalFetch = globalThis.fetch; let upstreamCalls = 0, lastRequest;
  let upstream = async () => Response.json(usageResponse());
  globalThis.fetch = async (url, init) => { if (String(url) !== 'https://api.openai.com/v1/responses') throw new Error('unexpected external network fixture'); upstreamCalls++; lastRequest = { url: String(url), init }; return upstream(url, init); };
  try {
    check('P1421 missing key fails closed', (await worker.fetch(req(), {})).status === 503);
    check('P1421 old route retired without upstream', (await worker.fetch(req(body, { path: '/anthropic' }), {})).status === 410 && upstreamCalls === 0);
    const fixture = harness(), before = upstreamCalls;
    const blocked = await Promise.all([worker.fetch(req(body, { origin: '' }), fixture.env), worker.fetch(req(body, { origin: '', headers: { 'X-AIO-Automation-Token': 'wrong' } }), fixture.env), worker.fetch(req(body, { origin: 'https://attacker.invalid', headers: { 'X-AIO-Automation-Token': TOKEN } }), fixture.env), worker.fetch(req(body, { origin: 'http://localhost:8892' }), fixture.env)]);
    check('P1421 bad automation and arbitrary Origin denied before spend', blocked.every(response => response.status === 403) && upstreamCalls === before);
    const noAutomation = harness(undefined, { AIO_AUTOMATION_TOKEN: undefined });
    check('P1421 unconfigured automation fails closed', (await worker.fetch(req(body, { origin: '', headers: { 'X-AIO-Automation-Token': TOKEN } }), noAutomation.env)).status === 403);
    const appAuth = harness(undefined, { AIO_APP_TOKEN: 'fixture-public-app-token' }), appBefore = upstreamCalls;
    const rejectedAppTokens = await Promise.all([worker.fetch(req(), appAuth.env), worker.fetch(req(body, { headers: { 'X-AIO-App-Token': 'invalid-token' } }), appAuth.env)]);
    check('P1421 configured app token rejects missing and invalid before reservation', rejectedAppTokens.every(response => response.status === 403) && upstreamCalls === appBefore && appAuth.saved() === undefined);
    const acceptedAppToken = await worker.fetch(req(body, { headers: { 'X-AIO-App-Token': 'fixture-public-app-token', 'cf-connecting-ip': '198.51.100.2' } }), appAuth.env); await acceptedAppToken.arrayBuffer();
    check('P1421 configured app token accepts the matching browser token', acceptedAppToken.status === 200 && appAuth.saved().days['claude:' + currentDay] === 1);
    const devPreflight = await worker.fetch(req(undefined, { origin: 'http://localhost:8891', method: 'OPTIONS' }), fixture.env);
    check('P1421 exact configured development origin preflight is echoed', devPreflight.status === 204 && devPreflight.headers.get('Access-Control-Allow-Origin') === 'http://localhost:8891');
    const allowedHeaders = devPreflight.headers.get('Access-Control-Allow-Headers') || '';
    check('P1421 browser preflight permits both idempotency headers without exposing automation header', /X-AIO-Idempotency-Key/.test(allowedHeaders) && /X-AIO-Request-Id/.test(allowedHeaders) && !/X-AIO-Automation-Token/.test(allowedHeaders));
    const nonUsFixture = harness(), nonUsAuthority = new AIOQuotaDurableObject({ ...nonUsFixture.state, id: { jurisdiction: 'eu' } }, nonUsFixture.env), nonUsBefore = upstreamCalls;
    const nonUsProxy = await nonUsAuthority.fetch(new Request('https://aio-quota.internal/proxy', { method: 'POST', body: JSON.stringify({ requestId: 'fixture-non-us', responseBody: body }) }));
    const nonUsUsage = await nonUsAuthority.fetch(new Request('https://aio-quota.internal/usage', { method: 'POST', body: JSON.stringify({ dayKey: 'claude:' + currentDay }) }));
    check('P1421 non-US authority rejects proxy and usage without upstream or ledger mutation', nonUsProxy.status === 503 && nonUsUsage.status === 503 && upstreamCalls === nonUsBefore && nonUsFixture.saved() === undefined);
    const automation = await worker.fetch(req(body, { origin: '', headers: { 'X-AIO-Automation-Token': TOKEN } }), fixture.env); const automationJson = await automation.json();
    check('P1421 automation shares DO and private Authorization; redirects refused', automation.status === 200 && automationJson.output[0].content[0].text === 'ok' && fixture.name() === 'anthropic-authority-v1' && lastRequest.init.headers.Authorization === 'Bearer fake-not-a-live-key' && lastRequest.init.redirect === 'error' && !JSON.stringify(lastRequest.init).includes(TOKEN));
    check('P1421 verified JSON settles atomically', fixture.saved().months[currentMonth] === charge && Object.values(fixture.saved().reservations)[0].settled === true);
    const browser = await worker.fetch(req(), fixture.env); await browser.arrayBuffer();
    check('P1421 browser and Actions share monthly/day ledger', fixture.saved().months[currentMonth] === charge * 2 && fixture.saved().days['claude:' + currentDay] === 2);
    const health = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), fixture.env), healthJson = await health.json();
    check('P1421 health reports readiness/provider and automation presence only', healthJson.ai?.ready === true && healthJson.ai.provider === 'openai' && healthJson.ai.model === 'gpt-6-luna' && healthJson.ai.automationConfigured === true && !JSON.stringify(healthJson).includes(TOKEN) && !/monthlyReserved|monthlyBudget|monthlyPastSpendUnknown|usageMonthUtc|AI_MONTHLY_BUDGET_USD|AI_DAILY_CAP|anthropicDailyCap|aiDailyCap/.test(JSON.stringify(healthJson)));
    const malformedHealth = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), { ...fixture.env, AI_MONTHLY_BUDGET_USD: '11' });
    check('P1421 malformed budget cannot report ready', (await malformedHealth.json()).ai.ready === false);
    check('P1157/P1421 rate limiter fails before cost', (await worker.fetch(req(), { ...fixture.env, RATE_LIMIT_OPENAI: { limit: async () => ({ success: false }) } })).status === 429);
    check('P1421 Unicode byte limit before dispatch', (await worker.fetch(req({ ...body, input: '한'.repeat(75000) }), fixture.env)).status === 413);
    const declaredBefore = upstreamCalls;
    const declaredTooLarge = await worker.fetch(req(body, { headers: { 'Content-Length': '99999999999999999999999999999', 'cf-connecting-ip': '198.51.100.3' } }), fixture.env);
    const falseLength = await worker.fetch(req({ ...body, input: 'x'.repeat(210000) }, { headers: { 'Content-Length': '1', 'cf-connecting-ip': '198.51.100.4' } }), fixture.env);
    check('P1421 large declared length rejected early and false small length cannot bypass actual bytes', declaredTooLarge.status === 413 && falseLength.status === 413 && upstreamCalls === declaredBefore);
    let bodyChunks = 0, oversizedBodyCancelled = false;
    const oversizedBody = new ReadableStream({ pull(controller) { bodyChunks++; if (bodyChunks > 100) controller.close(); else controller.enqueue(new Uint8Array(8192).fill(120)); }, cancel() { oversizedBodyCancelled = true; } });
    const streamedRequest = new Request('https://worker.example/openai', { method: 'POST', body: oversizedBody, duplex: 'half', headers: { Origin: PROD, 'cf-connecting-ip': '198.51.100.5' } });
    const oversizedStream = await worker.fetch(streamedRequest, fixture.env);
    check('P1421 headerless oversized request cancels at byte ceiling without reading entire stream', oversizedStream.status === 413 && oversizedBodyCancelled && bodyChunks < 100 && upstreamCalls === declaredBefore);
    check('P1353/P1421 missing atomic authority/legacy KV fails closed', (await worker.fetch(req(), { OPENAI_API_KEY: 'fake', AIO_QUOTA: { get: async () => '0', put: async () => {} } })).status === 503);
    const zero = harness(undefined, { AI_MONTHLY_BUDGET_USD: '0' });
    check('P1421 zero monthly cap denies before upstream', (await worker.fetch(req(), zero.env)).status === 429);
    const duplicate = harness(), duplicateBefore = upstreamCalls;
    const duplicates = await Promise.all(Array.from({ length: 5 }, () => worker.fetch(req(body, { headers: { 'X-AIO-Idempotency-Key': 'same-identity-1234' } }), duplicate.env))); await Promise.all(duplicates.map(response => response.arrayBuffer()));
    check('P1353/P1421 idempotency spends once', upstreamCalls - duplicateBefore === 1 && duplicates.filter(response => response.status === 409).length === 4);
    const race = harness(undefined, { AI_MONTHLY_BUDGET_USD: (budget.reservationMicroUsd * 2 / 1000000).toFixed(6) }); upstream = async () => Response.json(usageResponse({ usage: undefined }));
    const raceResponses = await Promise.all(Array.from({ length: 10 }, (_, i) => worker.fetch(req(body, { headers: { 'X-AIO-Idempotency-Key': 'race-' + i + '-identity', 'cf-connecting-ip': '10.0.0.' + i } }), race.env))); await Promise.all(raceResponses.map(response => response.arrayBuffer()));
    check('P1421 concurrent reserve cannot exceed two priced attempts', raceResponses.filter(response => response.status === 200).length === 2 && race.saved().months[currentMonth] === budget.reservationMicroUsd * 2);
    const monthRestart = harness(race.saved(), { AI_MONTHLY_BUDGET_USD: race.env.AI_MONTHLY_BUDGET_USD }), monthRestartBefore = upstreamCalls;
    const exhaustedMonth = await worker.fetch(req(body, { headers: { 'cf-connecting-ip': '198.51.100.6' } }), monthRestart.env), exhaustedMonthJson = await exhaustedMonth.json();
    check('P1421 exhausted dollar cap survives storage/authority restart', exhaustedMonth.status === 429 && exhaustedMonthJson.error?.quotaReason === 'monthly-budget' && upstreamCalls === monthRestartBefore && monthRestart.saved().months[currentMonth] === budget.reservationMicroUsd * 2);
    const dailyRace = harness(undefined, { AI_DAILY_CAP: '3' }), dailyBefore = upstreamCalls; upstream = async () => Response.json(usageResponse());
    const dailyResponses = await Promise.all(Array.from({ length: 12 }, (_, i) => worker.fetch(req(body, { headers: { 'X-AIO-Idempotency-Key': 'daily-race-' + i, 'cf-connecting-ip': '10.0.1.' + i } }), dailyRace.env))); await Promise.all(dailyResponses.map(response => response.arrayBuffer()));
    check('P1421 concurrent daily admission permits at most configured three upstream attempts', upstreamCalls - dailyBefore === 3 && dailyResponses.filter(response => response.status === 200).length === 3 && dailyResponses.filter(response => response.status === 429).length === 9 && dailyRace.saved().days['claude:' + currentDay] === 3);
    const dayRestart = harness(dailyRace.saved(), { AI_DAILY_CAP: '3' }), dayRestartBefore = upstreamCalls;
    const exhaustedDay = await worker.fetch(req(body, { headers: { 'cf-connecting-ip': '198.51.100.7' } }), dayRestart.env), exhaustedDayJson = await exhaustedDay.json();
    check('P1421 exhausted daily cap survives storage/authority restart even after settlement', exhaustedDay.status === 429 && exhaustedDayJson.error?.quotaReason === 'daily-cap' && upstreamCalls === dayRestartBefore && dayRestart.saved().days['claude:' + currentDay] === 3 && dayRestart.saved().months[currentMonth] === charge * 3);
    const failing = harness(); upstream = async () => { throw new Error('fixture timeout'); }; const failed = await worker.fetch(req(), failing.env); await failed.arrayBuffer();
    check('P1353/P1421 network failure retains full reservation', failed.status === 502 && failing.saved().months[currentMonth] === budget.reservationMicroUsd && Object.values(failing.saved().reservations)[0].started === true);
    const badReceipt = harness(); upstream = async () => Response.json(usageResponse({ usage: { input_tokens: 1, output_tokens: 999999, total_tokens: 1000000 } })); const invalidReceipt = await worker.fetch(req(), badReceipt.env); await invalidReceipt.arrayBuffer();
    check('P1421 impossible usage cannot replenish', badReceipt.saved().months[currentMonth] === budget.reservationMicroUsd);
    const prior = harness({ schemaVersion: 2, months: { [currentMonth]: 9000000 }, legacyUnknownMonths: {}, days: { ['claude:' + currentDay]: 4 }, reservations: {} }); upstream = async () => Response.json(usageResponse()); const migrated = await worker.fetch(req(), prior.env); await migrated.arrayBuffer();
    check('P1353/P1421 migration never resets Anthropic spend history', prior.saved().months[currentMonth] === 9000000 + charge && prior.saved().days['claude:' + currentDay] === 5);
    const legacy = harness({ days: { ['claude:' + currentDay]: 4 }, reservations: {} });
    check('P1353/P1421 old unpriced month protected until rollover', (await worker.fetch(req(), legacy.env)).status === 429 && legacy.saved().legacyUnknownMonths[currentMonth] === true);
    const release = harness(), reserved = payload('fixture-before-start'); await release.durable.mutateQuota('reserve', reserved); await release.durable.mutateQuota('release', reserved);
    check('P1421 pre-dispatch cancellation may release', release.saved().months[currentMonth] === 0);
    const started = payload('fixture-started'); await release.durable.mutateQuota('reserve', started); await release.durable.mutateQuota('start', started); await release.durable.mutateQuota('release', started);
    check('P1421 dispatched attempts cannot release', release.saved().months[currentMonth] === 1000);
    await release.durable.mutateQuota('settle', { ...started, chargeMicroUsd: 7 }); await release.durable.mutateQuota('settle', { ...started, chargeMicroUsd: 1 });
    check('P1421 settlement idempotent without double refunds', release.saved().months[currentMonth] === 7);
    const invalidSettlement = payload('fixture-bad-charge'); await release.durable.mutateQuota('reserve', invalidSettlement); await release.durable.mutateQuota('start', invalidSettlement);
    for (const amount of [-1, 0, 1.1, 1001]) {
      let denied = false; try { await release.durable.mutateQuota('settle', { ...invalidSettlement, chargeMicroUsd: amount }); } catch { denied = true; }
      check('P1421 invalid settlement never replenishes ' + amount, denied && release.saved().months[currentMonth] === 1007);
    }
    const previousInstant = new Date(currentMonth + '-01T00:00:00Z'); previousInstant.setUTCDate(0); const previousDay = previousInstant.toISOString().slice(0, 10), previousMonth = previousDay.slice(0, 7);
    const lateKey = 'claude:' + previousDay + ':fixture-month-rollover';
    const rollover = harness({ schemaVersion: 2, months: { [previousMonth]: 1000, [currentMonth]: 50 }, legacyUnknownMonths: {}, days: {}, reservations: { [lateKey]: { createdAt: Date.now(), dayKey: 'claude:' + previousDay, monthKey: previousMonth, reservationMicroUsd: 1000, started: true } } });
    await rollover.durable.mutateQuota('settle', { dayKey: 'claude:' + previousDay, requestId: 'fixture-month-rollover', chargeMicroUsd: 7 });
    check('P1421 late receipt credits its original month only', rollover.saved().months[previousMonth] === 7 && rollover.saved().months[currentMonth] === 50);
    const expiredInstant = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), expiredDay = expiredInstant.toISOString().slice(0, 10), expiredMonth = expiredDay.slice(0, 7), expiredKey = 'claude:' + expiredDay + ':expired-attempt', freshKey = 'claude:' + currentDay + ':fresh-attempt';
    const pruning = harness({ schemaVersion: 2, months: { [expiredMonth]: 1000, [currentMonth]: 50 }, legacyUnknownMonths: {}, days: { ['claude:' + expiredDay]: 5, ['relay:fred:' + expiredDay]: 2, ['claude:' + currentDay]: 1 }, reservations: { [expiredKey]: { createdAt: expiredInstant.getTime(), dayKey: 'claude:' + expiredDay, monthKey: expiredMonth, reservationMicroUsd: 1000, started: true }, ['relay:fred:' + expiredDay + ':old']: expiredInstant.getTime(), [freshKey]: { createdAt: Date.now(), dayKey: 'claude:' + currentDay, monthKey: currentMonth, reservationMicroUsd: 50, started: true } } });
    await pruning.durable.mutateQuota('usage', { dayKey: 'claude:' + currentDay });
    check('P1421 expired day/relay/AI reservations and old month prune while current ledger remains', !Object.hasOwn(pruning.saved().days, 'claude:' + expiredDay) && !Object.hasOwn(pruning.saved().days, 'relay:fred:' + expiredDay) && !Object.hasOwn(pruning.saved().reservations, expiredKey) && !Object.hasOwn(pruning.saved().reservations, 'relay:fred:' + expiredDay + ':old') && !Object.hasOwn(pruning.saved().months, expiredMonth) && pruning.saved().months[currentMonth] === 50 && Object.hasOwn(pruning.saved().reservations, freshKey));
    const corrupt = harness({ schemaVersion: 2, months: {}, legacyUnknownMonths: {}, days: { ['claude:' + currentDay]: 1 }, reservations: {} });
    check('P1353/P1421 missing dollar ledger cannot silently reopen budget', (await worker.fetch(req(), corrupt.env)).status === 503);
    const privateEnv = { ...fixture.env, AIO_OPERATOR_TOKEN: TOKEN }, privateUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': TOKEN } }), privateEnv), privateJson = await privateUsage.json();
    check('P1312/P1421 private usage scopes browser and Actions together', privateUsage.status === 200 && privateJson.aiDailyCap === 300 && privateJson.anthropicDailyCap === 300 && privateJson.scope === 'all-AIO-browser-and-GitHub-Actions-through-shared-Worker' && !privateUsage.headers.has('Access-Control-Allow-Origin'));
    check('P1312/P1421 private usage undiscoverable without token', (await worker.fetch(new Request('https://worker.example/_ops/ai-usage'), privateEnv)).status === 404);
    const wrongOperator = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': 'wrong-fixture-token-' + 'x'.repeat(32) } }), privateEnv);
    const operatorPost = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { method: 'POST', headers: { 'X-AIO-Operator-Token': TOKEN } }), privateEnv);
    check('P1421 invalid operator secret and authorized non-GET requests rejected privately with no-store', wrongOperator.status === 404 && operatorPost.status === 405 && [wrongOperator, operatorPost, privateUsage].every(response => response.headers.get('Cache-Control') === 'no-store' && !response.headers.has('Access-Control-Allow-Origin')));
    const streamFixture = harness(), wire = 'event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"한글"}\r\n\r\nevent: response.completed\r\ndata: ' + JSON.stringify({ type: 'response.completed', response: usageResponse() }) + '\r\n\r\n';
    upstream = async () => { const encoded = new TextEncoder().encode(wire); let position = 0; return new Response(new ReadableStream({ pull(controller) { if (position >= encoded.length) { controller.close(); return; } controller.enqueue(encoded.slice(position, position + 7)); position += 7; } }), { headers: { 'content-type': 'text/event-stream' } }); };
    const streamed = await worker.fetch(req({ ...body, stream: true }), streamFixture.env), wireReceived = await streamed.text();
    check('P1421 SSE/UTF8 bytes unchanged and completed receipt settles', wireReceived === wire && streamFixture.saved().months[currentMonth] === charge);
    const cancelledFixture = harness(); let upstreamAborted = false;
    upstream = async (_, init) => { init.signal.addEventListener('abort', () => { upstreamAborted = true; }); return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')); } }), { headers: { 'content-type': 'text/event-stream' } }); };
    const caller = new AbortController(), cancelled = await worker.fetch(req({ ...body, stream: true }, { signal: caller.signal }), cancelledFixture.env), reader = cancelled.body.getReader(); await reader.read(); await reader.cancel('fixture disconnect');
    check('P1353/P1421 stream cancel aborts upstream and retains reservation', upstreamAborted && cancelledFixture.saved().months[currentMonth] === prepareOpenAiBudget({ ...body, stream: true }).reservationMicroUsd);
    const malformed = createOpenAiReceiptObserver('text/event-stream'); malformed.push(new TextEncoder().encode('data: {broken}\n\n')); check('P1421 malformed SSE cannot settle', malformed.finish() === null);
    const truncated = createOpenAiReceiptObserver('text/event-stream'); truncated.push(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.completed', response: usageResponse() }))); check('P1421 incomplete SSE frame cannot settle', truncated.finish() === null);
    const failedObserver = createOpenAiReceiptObserver('text/event-stream'); failedObserver.push(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.completed', response: usageResponse() }) + '\n\ndata: {"type":"response.failed"}\n\n')); check('P1421 late SSE failure keeps full reserve', failedObserver.finish() === null);
    const oversizedObserver = createOpenAiReceiptObserver('application/json'); oversizedObserver.push(new Uint8Array(2 * 1024 * 1024 + 1)); check('P1421 oversized receipt keeps full reserve', oversizedObserver.finish() === null);
    const timeoutFixture = harness(); const originalTimeout = globalThis.setTimeout; let deadlineAbort = false;
    globalThis.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 60000 ? 5 : delay, ...args);
    try {
      upstream = async (_, init) => { init.signal.addEventListener('abort', () => { deadlineAbort = true; }); return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"stall"}\n\n')); } }), { headers: { 'content-type': 'text/event-stream' } }); };
      const stalled = await worker.fetch(req({ ...body, stream: true }), timeoutFixture.env); let rejected = false; try { await stalled.text(); } catch { rejected = true; }
      check('P1353/P1421 streaming deadline survives header arrival and retains reserve', rejected && deadlineAbort && timeoutFixture.saved().months[currentMonth] === prepareOpenAiBudget({ ...body, stream: true }).reservationMicroUsd);
    } finally { globalThis.setTimeout = originalTimeout; }
  } finally { globalThis.fetch = originalFetch; }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`PASS: shared GPT-6 Luna Worker (${checks} assertions; no live API requests)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
