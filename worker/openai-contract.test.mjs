// P1421: shared OpenAI gateway, conservative admission and verified settlement.
import worker, { AIOQuotaDurableObject, prepareOpenAiBudget, aiMonthlyBudgetMicroUsd, deriveClientKey } from '../cloudflare-worker-proxy.js';
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
  const env = { OPENAI_API_KEY: 'fake-not-a-live-key', AI_DAILY_CAP: '300', AI_MAX_OUTPUT_TOKENS: '4000', AI_MONTHLY_BUDGET_USD: '20', AI_WEB_SEARCH_ENABLED: 'true', AIO_AUTOMATION_TOKEN: TOKEN, AIO_DEV_ORIGINS: 'http://localhost:8891', ...extraEnv };
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
  check('P1421 P1608 zero to twenty dollar integer cap', aiMonthlyBudgetMicroUsd({}) === 20000000 && aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: '0' }) === 0 && aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: '0.000001' }) === 1);
  for (const amount of ['-1','20.000001','1e1','NaN','1.0000001']) rejects('invalid monthly cap ' + amount, () => aiMonthlyBudgetMicroUsd({ AI_MONTHLY_BUDGET_USD: amount }));
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
  const searchBody = { ...body, tools: [{ type: 'web_search', search_context_size: 'low', return_token_budget: 'default' }], max_tool_calls: 2, tool_choice: 'required' };
  const searchBudget = prepareOpenAiBudget(searchBody, { AI_WEB_SEARCH_ENABLED: 'true' });
  check('P1608 hosted search shares twenty dollar admission and reserves above the text-only price', searchBudget.monthlyCapMicroUsd === 20000000 && searchBudget.searchReserveMicroUsd > 0 && searchBudget.reservationMicroUsd > searchBudget.searchReserveMicroUsd && searchBudget.body.reasoning.effort === 'low');
  const deepSearch = prepareOpenAiBudget({ ...searchBody, reasoning: { effort: 'medium' }, tools: [{ ...searchBody.tools[0], search_context_size: 'medium' }] }, { AI_WEB_SEARCH_ENABLED: 'true' });
  const highSearch = prepareOpenAiBudget({ ...searchBody, reasoning: { effort: 'high' } }, { AI_WEB_SEARCH_ENABLED: 'true' });
  check('v57.61 analysis search keeps medium reasoning/context; higher effort is clamped to low', deepSearch.body.reasoning.effort === 'medium' && deepSearch.body.tools[0].search_context_size === 'medium' && highSearch.body.reasoning.effort === 'low');
  rejects('v57.61 search context above medium stays unbudgeted', () => prepareOpenAiBudget({ ...searchBody, tools: [{ ...searchBody.tools[0], search_context_size: 'high' }] }, { AI_WEB_SEARCH_ENABLED: 'true' }));
  check('v57.61 output cap admits 16384 reasoning-inclusive tokens and refuses more', prepareOpenAiBudget({ ...body, max_output_tokens: 20000 }, { AI_MAX_OUTPUT_TOKENS: '16384' }).body.max_output_tokens === 16384);
  rejects('v57.61 output cap above 16384 is invalid configuration', () => prepareOpenAiBudget(body, { AI_MAX_OUTPUT_TOKENS: '16385' }));
  for (const attempt of [
    { ...searchBody, max_tool_calls: 3 }, { ...searchBody, max_tool_calls: 0 },
    { ...searchBody, tools: [{ ...searchBody.tools[0], return_token_budget: 'unlimited' }] },
    { ...searchBody, tools: [{ ...searchBody.tools[0], return_token_budget: 8000 }] },
    { ...searchBody, tools: [{ ...searchBody.tools[0], filters: { allowed_domains: ['https://sec.gov'] } }] },
    { ...searchBody, tools: [searchBody.tools[0], { type: 'function', name: 'x', parameters: {} }] }
  ]) rejects('P1608 hosted search expansion cannot bypass admission', () => prepareOpenAiBudget(attempt, { AI_WEB_SEARCH_ENABLED: 'true' }));
  rejects('P1608 search disabled without explicit Worker configuration', () => prepareOpenAiBudget(searchBody));
  // v57.62: searched reservation is a worst-case bound; completed searched receipts settle from usage + per-call fee.
  const searchCall = action => ({ type: 'web_search_call', id: 'ws_' + action, status: 'completed', action: { type: action } });
  const answer = usageResponse().output[0];
  const maxPrompt = { ...searchBody, input: [{ role: 'user', content: 'x'.repeat(150000) }], max_output_tokens: 16384, reasoning: { effort: 'medium' }, tools: [{ ...searchBody.tools[0], search_context_size: 'medium' }] };
  for (const [label, data] of [['small low-context', searchBody], ['max-prompt medium-context', maxPrompt]]) {
    const b = prepareOpenAiBudget(data, { AI_WEB_SEARCH_ENABLED: 'true', AI_MAX_OUTPUT_TOKENS: '16384' });
    const calls = b.body.max_tool_calls, content = { low: 32000, medium: 64000 }[b.body.tools[0].search_context_size];
    const turn = b.inputTokenUpperBound + calls * content + b.body.max_output_tokens, long = turn > 272000;
    const worst = calls * 11000 + (1 + calls) * turn * (long ? 0.275 : 0.1375) + b.body.max_output_tokens * (long ? 0.825 : 0.55);
    check('v57.62 searched reservation >= worst-case charge (prompt re-read every turn, content per call, fee per call) ' + label,
      b.reservationMicroUsd >= worst && b.billedInputTokenUpperBound === (1 + calls) * turn && b.longContextPricing === long, { reservation: b.reservationMicroUsd, worst });
    const worstReceipt = usageResponse({ output: [searchCall('search'), searchCall('open_page'), answer], usage: { input_tokens: b.billedInputTokenUpperBound, output_tokens: b.body.max_output_tokens, total_tokens: b.billedInputTokenUpperBound + b.body.max_output_tokens } });
    const worstCharge = verifiedOpenAiCharge(worstReceipt, b);
    check('v57.62 a receipt at every reserved bound settles at or below the reservation ' + label, worstCharge !== null && worstCharge <= b.reservationMicroUsd, { worstCharge, reservation: b.reservationMicroUsd });
  }
  check('v57.62 the max-prompt medium search crosses 272k per turn and is priced at long-context rates', prepareOpenAiBudget(maxPrompt, { AI_WEB_SEARCH_ENABLED: 'true', AI_MAX_OUTPUT_TOKENS: '16384' }).longContextPricing === true && searchBudget.longContextPricing === false);
  const oneCall = verifiedOpenAiCharge(usageResponse({ output: [searchCall('search'), answer], usage: { input_tokens: 30000, output_tokens: 60, total_tokens: 30060 } }), searchBudget);
  check('v57.62 settle with one search call charges one fee plus usage and refunds the unused call and token difference',
    oneCall === Math.ceil(11000 + 30000 * 0.1375 + 60 * 0.55) && searchBudget.reservationMicroUsd - oneCall > 11000, { oneCall, reservation: searchBudget.reservationMicroUsd });
  const twoCalls = verifiedOpenAiCharge(usageResponse({ output: [searchCall('search'), searchCall('find_in_page'), answer], usage: { input_tokens: 30000, output_tokens: 60, total_tokens: 30060 } }), searchBudget);
  check('v57.62 every web_search_call item is billed, whatever its action', twoCalls === oneCall + 11000);
  for (const [label, response] of [
    ['incomplete', usageResponse({ status: 'incomplete', output: [searchCall('search')] })],
    ['missing output', usageResponse({ output: undefined })],
    ['malformed output item', usageResponse({ output: [searchCall('search'), null] })],
    ['more calls than admitted', usageResponse({ output: [searchCall('search'), searchCall('search'), searchCall('search'), answer] })],
    ['missing usage', usageResponse({ output: [searchCall('search'), answer], usage: undefined })],
    ['total mismatch', usageResponse({ output: [searchCall('search'), answer], usage: { input_tokens: 30000, output_tokens: 60, total_tokens: 1 } })],
    ['input above reserved bound', usageResponse({ output: [searchCall('search'), answer], usage: { input_tokens: searchBudget.billedInputTokenUpperBound + 1, output_tokens: 1, total_tokens: searchBudget.billedInputTokenUpperBound + 2 } })],
    ['other model', usageResponse({ model: 'gpt-6-sol', output: [searchCall('search'), answer] })]
  ]) check('v57.62 malformed/incomplete searched receipt keeps the reservation: ' + label, verifiedOpenAiCharge(response, searchBudget) === null);
  check('v57.62 settle never exceeds the reservation even when every bound is individually met', verifiedOpenAiCharge(usageResponse({ output: [searchCall('search'), answer], usage: { input_tokens: 0, output_tokens: 1, total_tokens: 1 } }), { ...searchBudget, reservationMicroUsd: 11000 }) === null);
  check('v57.62 a text-only budget never settles a receipt that ran hosted search', verifiedOpenAiCharge(usageResponse({ output: [searchCall('search'), answer] }), budget) === null);
  check('P1421 verified charge uses worst premium without cache discount', charge === Math.ceil(16 * 0.1375 + 8 * 0.55));
  for (const response of [usageResponse({ model: 'gpt-6-sol' }), usageResponse({ status: 'incomplete' }), usageResponse({ usage: { input_tokens: 16, output_tokens: 8 } }), usageResponse({ usage: { input_tokens: 16, output_tokens: 65, total_tokens: 81 } }), usageResponse({ usage: { input_tokens: 16, output_tokens: -1, total_tokens: 15 } }), usageResponse({ service_tier: 'priority' })]) check('P1421 invalid receipt cannot replenish', verifiedOpenAiCharge(response, budget) === null);
  {
    // v58.20 review A1: an answer stopped at max_output_tokens settles at its verified usage (it reached the user and was
    // billed); an incomplete receipt for any other reason, or without a reason, still keeps the whole reservation.
    const limited = usageResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } });
    const limitedObserver = createOpenAiReceiptObserver('text/event-stream');
    limitedObserver.push(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.incomplete', response: limited }) + '\n\n'));
    const filteredObserver = createOpenAiReceiptObserver('text/event-stream');
    filteredObserver.push(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.incomplete', response: usageResponse({ status: 'incomplete', incomplete_details: { reason: 'content_filter' } }) }) + '\n\n'));
    check('v58.20 an output-limited answer settles at verified usage; other incomplete receipts keep the reservation',
      verifiedOpenAiCharge(limited, budget) === charge && limitedObserver.finish()?.status === 'incomplete' && filteredObserver.finish() === null
        && verifiedOpenAiCharge(usageResponse({ status: 'incomplete', incomplete_details: { reason: 'content_filter' } }), budget) === null);
  }
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
    check('P1421 automation shares DO and private Authorization; redirects refused', automation.status === 200 && automationJson.output[0].content[0].text === 'ok' && fixture.name() === 'anthropic-authority-v1' && lastRequest.init.headers.Authorization === 'Bearer fake-not-a-live-key' && lastRequest.init.redirect === 'manual' && !JSON.stringify(lastRequest.init).includes(TOKEN));
    check('P1421 verified JSON settles atomically', fixture.saved().months[currentMonth] === charge && Object.values(fixture.saved().reservations)[0].settled === true);
    const browser = await worker.fetch(req(), fixture.env); await browser.arrayBuffer();
    check('P1421 browser and Actions share monthly/day ledger', fixture.saved().months[currentMonth] === charge * 2 && fixture.saved().days['claude:' + currentDay] === 2);
    const searchRace = harness(undefined, { AI_MONTHLY_BUDGET_USD: (searchBudget.reservationMicroUsd * 2 / 1000000).toFixed(6) });
    const searchRaceResponses = await Promise.all(Array.from({ length: 6 }, (_, i) => worker.fetch(req(searchBody, { origin: i % 2 ? '' : PROD,
      headers: { ...(i % 2 ? { 'X-AIO-Automation-Token': TOKEN } : {}), 'X-AIO-Idempotency-Key': 'search-race-' + i, 'cf-connecting-ip': '198.18.0.' + i } }), searchRace.env)));
    await Promise.all(searchRaceResponses.map(response => response.arrayBuffer()));
    check('P1608 mixed browser and automation searches atomically share one budget without per-user allowance', searchRaceResponses.filter(response => response.status === 200).length === 2 && searchRaceResponses.filter(response => response.status === 429).length === 4 && searchRace.saved().months[currentMonth] === verifiedOpenAiCharge(usageResponse(), searchBudget) * 2);
    const searchOff = harness(undefined, { AI_WEB_SEARCH_ENABLED: 'false' }), searchOffCalls = upstreamCalls;
    check('P1608 disabled hosted search never spends', (await worker.fetch(req(searchBody), searchOff.env)).status === 400 && upstreamCalls === searchOffCalls && searchOff.saved() === undefined);
    const health = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), fixture.env), healthJson = await health.json();
    check('P1421 health reports readiness/provider and automation presence only', healthJson.ai?.ready === true && healthJson.ai.provider === 'openai' && healthJson.ai.model === 'gpt-6-luna' && healthJson.ai.automationConfigured === true && !JSON.stringify(healthJson).includes(TOKEN) && !/monthlyReserved|monthlyBudget|monthlyPastSpendUnknown|usageMonthUtc|AI_MONTHLY_BUDGET_USD|AI_DAILY_CAP|anthropicDailyCap|aiDailyCap/.test(JSON.stringify(healthJson)));
    const malformedHealth = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), { ...fixture.env, AI_MONTHLY_BUDGET_USD: '21' });
    const deniedHealth = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), appAuth.env);
    const deniedHealthJson = await deniedHealth.json();
    const allowedHealth = await worker.fetch(req(undefined, { path: '/health', method: 'GET', headers: { 'X-AIO-App-Token': 'fixture-public-app-token' } }), appAuth.env);
    const allowedHealthJson = await allowedHealth.json();
    check('P1607 health separates server readiness from caller token acceptance without exposing credentials', deniedHealthJson.ai.ready && deniedHealthJson.ai.appTokenRequired && !deniedHealthJson.ai.appTokenAccepted && allowedHealthJson.ai.appTokenAccepted && !JSON.stringify(allowedHealthJson).includes('fixture-public-app-token'));
    check('v57.79 P1607 P1608 health lists operator-secret relays only (personal FRED relay retired) and enabled paid search truthfully', healthJson.relay.credentialModes.bok === 'operator-secret' && healthJson.relay.credentialModes.kosis === 'operator-secret' && !('fred' in healthJson.relay.credentialModes) && healthJson.relay.personalKeyRequired === undefined && !healthJson.relay.providers.includes('fred') && healthJson.ai.paidWebSearchEnabled === true); // text-pin-ok: retirement absence
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
    // P1433: the owner's one-time statement of the blocked month's prior spend clears the flag; the cap still applies.
    const unknownMonth = { schemaVersion: 2, months: { [currentMonth]: 10000000 }, legacyUnknownMonths: { [currentMonth]: true }, days: {}, reservations: {} };
    const acknowledged = harness(structuredClone(unknownMonth), { AI_LEGACY_MONTH_ACK: `${currentMonth}:0` }); upstream = async () => Response.json(usageResponse());
    const ackResponse = await worker.fetch(req(undefined, { headers: { 'cf-connecting-ip': '198.51.100.33' } }), acknowledged.env); await ackResponse.arrayBuffer();
    check('P1433 owner acknowledgement clears the unknown month and the cap applies from the stated spend', ackResponse.status === 200 && acknowledged.saved().legacyUnknownMonths[currentMonth] === undefined && acknowledged.saved().months[currentMonth] === charge);
    const otherMonth = harness(structuredClone(unknownMonth), { AI_LEGACY_MONTH_ACK: '1999-01:0' });
    check('P1433 acknowledgement for another month is ignored', (await worker.fetch(req(undefined, { headers: { 'cf-connecting-ip': '198.51.100.33' } }), otherMonth.env)).status === 429 && otherMonth.saved().legacyUnknownMonths[currentMonth] === true);
    const overCap = harness(structuredClone(unknownMonth), { AI_LEGACY_MONTH_ACK: `${currentMonth}:20000000` });
    check('P1433 a stated spend at the cap still blocks', (await worker.fetch(req(undefined, { headers: { 'cf-connecting-ip': '198.51.100.33' } }), overCap.env)).status === 429);
    const paddedKey = harness(undefined, { OPENAI_API_KEY: 'fake-not-a-live-key\n' }); let sentAuth = null;
    upstream = async (_, init) => { sentAuth = init.headers.Authorization; return Response.json(usageResponse()); };
    const padded = await worker.fetch(req(undefined, { headers: { 'cf-connecting-ip': '198.51.100.34' } }), paddedKey.env); await padded.arrayBuffer();
    check('P1433 a secret saved with a trailing newline is trimmed before the Authorization header', padded.status === 200 && sentAuth === 'Bearer fake-not-a-live-key');
    // P1433: Workers reject redirect:'error' (TypeError) — the handler uses 'manual' and refuses any 3xx itself.
    const redirected = harness(); upstream = async () => new Response(null, { status: 302, headers: { location: 'https://attacker.example/' } });
    const redirectResponse = await worker.fetch(req(undefined, { headers: { 'cf-connecting-ip': '198.51.100.35' } }), redirected.env); await redirectResponse.arrayBuffer();
    check('P1433 an upstream redirect is refused, never followed with the key', redirectResponse.status === 502);
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
    // Ledger bound: the whole ledger is one storage value. Started/settled rows past the 3-day idempotency window
    // drop (their amounts already live in months); un-started rows keep the month-retention rule; totals never move.
    const bulkReservations = {}, bulkHour = 60 * 60 * 1000;
    for (let i = 0; i < 10000; i++) {
      const old = i < 5000, createdAt = Date.now() - (old ? 5 * 24 : 1) * bulkHour;
      bulkReservations['claude:' + currentDay + ':bulk-' + i] = { createdAt, dayKey: 'claude:' + currentDay, monthKey: currentMonth, reservationMicroUsd: 7, originalReservationMicroUsd: 900, started: true, settled: true };
    }
    bulkReservations['claude:' + currentDay + ':old-unstarted'] = { createdAt: Date.now() - 5 * 24 * bulkHour, dayKey: 'claude:' + currentDay, monthKey: currentMonth, reservationMicroUsd: 900, started: false };
    const bulkMonthTotal = 10000 * 7 + 900 + 123;
    const bulk = harness({ schemaVersion: 2, months: { [currentMonth]: bulkMonthTotal }, legacyUnknownMonths: {}, days: { ['claude:' + currentDay]: 10001 }, reservations: bulkReservations });
    await bulk.durable.mutateQuota('usage', { dayKey: 'claude:' + currentDay });
    const bulkSaved = bulk.saved(), bulkKeys = Object.keys(bulkSaved.reservations);
    check('ledger prune drops 10k-scale settled rows outside the idempotency window and keeps month totals', bulkKeys.length === 5001 && bulkKeys.every(key => !/:bulk-(?:[0-9]|[1-9][0-9]{1,2}|[1-4][0-9]{3})$/.test(key)) && Object.hasOwn(bulkSaved.reservations, 'claude:' + currentDay + ':old-unstarted') && bulkSaved.months[currentMonth] === bulkMonthTotal);
    const bulkReload = harness(bulkSaved);
    const bulkUsage = await bulkReload.durable.mutateQuota('usage', { dayKey: 'claude:' + currentDay });
    check('ledger prune keeps the reservation-sum <= month-total check satisfied on reload', bulkUsage.ok === true && bulkUsage.monthlyReservedMicroUsd === bulkMonthTotal);
    let failingPut = false; const flaky = harness();
    flaky.state.storage.put = async (key, value) => { if (failingPut) throw new Error('fixture storage failure'); return undefined; };
    await flaky.durable.mutateQuota('reserve', payload('flaky-ok'));
    failingPut = true; let flakyThrew = false;
    try { await flaky.durable.mutateQuota('reserve', payload('flaky-lost')); } catch { flakyThrew = true; }
    check('in-memory ledger cache is dropped after a failed save', flakyThrew && flaky.durable.loaded === false);
    const corrupt = harness({ schemaVersion: 2, months: {}, legacyUnknownMonths: {}, days: { ['claude:' + currentDay]: 1 }, reservations: {} });
    check('P1353/P1421 missing dollar ledger cannot silently reopen budget', (await worker.fetch(req(), corrupt.env)).status === 503);
    const privateEnv = { ...fixture.env, AIO_OPERATOR_TOKEN: TOKEN }, privateUsage = await worker.fetch(new Request('https://worker.example/_ops/ai-usage', { headers: { 'X-AIO-Operator-Token': TOKEN } }), privateEnv), privateJson = await privateUsage.json();
    check('P1312/P1421 private usage scopes browser and Actions together', privateUsage.status === 200 && privateJson.aiDailyCap === 300 && privateJson.anthropicDailyCap === undefined /* v57.79: legacy alias retired */ && privateJson.scope === 'all-AIO-browser-and-GitHub-Actions-through-shared-Worker' && !privateUsage.headers.has('Access-Control-Allow-Origin'));
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
    const longStream = createOpenAiReceiptObserver('text/event-stream'), deltaFrame = new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: 'x'.repeat(200) }) + '\n\n');
    for (let n = 0; n < 12000; n += 1) longStream.push(deltaFrame);
    longStream.push(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'response.completed', response: usageResponse() }) + '\n\n'));
    const hugeStream = createOpenAiReceiptObserver('text/event-stream'); hugeStream.push(new Uint8Array(32 * 1024 * 1024 + 1));
    check('v57.62 a long streamed answer (>2 MB of text deltas) still settles; a stream over 32 MB keeps the reserve', longStream.finish() !== null && hugeStream.finish() === null);
    const timeoutFixture = harness(); const originalTimeout = globalThis.setTimeout; let deadlineAbort = false;
    globalThis.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 60000 ? 5 : delay, ...args);
    try {
      upstream = async (_, init) => { init.signal.addEventListener('abort', () => { deadlineAbort = true; }); return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"stall"}\n\n')); } }), { headers: { 'content-type': 'text/event-stream' } }); };
      const stalled = await worker.fetch(req({ ...body, stream: true }), timeoutFixture.env); let rejected = false; try { await stalled.text(); } catch { rejected = true; }
      check('P1353/P1421 streaming deadline survives header arrival and retains reserve', rejected && deadlineAbort && timeoutFixture.saved().months[currentMonth] === prepareOpenAiBudget({ ...body, stream: true }).reservationMicroUsd);
    } finally { globalThis.setTimeout = originalTimeout; }
    const deadlineDelays = [];
    globalThis.setTimeout = (callback, delay, ...args) => { deadlineDelays.push(delay); return originalTimeout(callback, delay, ...args); };
    try {
      upstream = async () => Response.json(usageResponse());
      for (const [label, data] of [['short', body], ['search', { ...searchBody }], ['long', { ...body, max_output_tokens: 8000 }]]) {
        const deadlineFixture = harness(undefined, { AI_MAX_OUTPUT_TOKENS: '8000' }); deadlineDelays.length = 0;
        const response = await worker.fetch(req(data, { headers: { 'cf-connecting-ip': '198.51.100.40' } }), deadlineFixture.env); await response.arrayBuffer();
        check('upstream deadline ' + label, deadlineDelays.includes(label === 'short' ? 60000 : 120000) && !deadlineDelays.includes(label === 'short' ? 120000 : 60000), deadlineDelays);
      }
    } finally { globalThis.setTimeout = originalTimeout; }

    // ── P1759: per-client daily AI cap, coarse budget state, budget-saver search removal ─────────────
    upstream = async () => Response.json(usageResponse());
    const ip = (address, extra = {}) => ({ 'cf-connecting-ip': address, ...extra });
    {
      // v58.20 review A1/A2: a connection's reserved micro-USD per UTC day is capped at 1/20 of the month, so one
      // spoofed browser caller inside its question count cannot reserve the whole month. Settlement returns the unused
      // part, so verified small answers keep passing.
      const spendBudget = (budget.reservationMicroUsd * 2 * 20 / 1000000).toFixed(6);
      const sendAs = async (fixture, address, key) => { const response = await worker.fetch(req(body, { headers: ip(address, key ? { 'X-AIO-Idempotency-Key': key } : {}) }), fixture.env); await response.arrayBuffer(); return response.status; };
      upstream = async () => Response.json(usageResponse({ usage: undefined }));
      const unsettled = harness(undefined, { AI_MONTHLY_BUDGET_USD: spendBudget });
      const unsettledStatuses = [];
      for (let i = 0; i < 3; i += 1) unsettledStatuses.push(await sendAs(unsettled, '203.0.113.70', 'spend-' + i));
      const otherConnection = await sendAs(unsettled, '203.0.113.71');
      upstream = async () => Response.json(usageResponse());
      const settled = harness(undefined, { AI_MONTHLY_BUDGET_USD: spendBudget });
      const settledStatuses = [];
      for (let i = 0; i < 4; i += 1) settledStatuses.push(await sendAs(settled, '203.0.113.72', 'settled-' + i));
      check('v58.20 one connection cannot reserve more than 1/20 of the month per UTC day; settled answers refund the unused part',
        unsettledStatuses.join() === '200,200,429' && otherConnection === 200 && settledStatuses.every((status) => status === 200),
        { unsettledStatuses, otherConnection, settledStatuses });
    }
    const clientCap = harness(undefined, { AI_PER_CLIENT_DAILY_CAP: '3' }), clientCapBefore = upstreamCalls;
    const clientRace = await Promise.all(Array.from({ length: 6 }, (_, i) => worker.fetch(req(body, { headers: ip('203.0.113.9', { 'X-AIO-Idempotency-Key': 'client-race-' + i }) }), clientCap.env)));
    const clientRaceJson = await Promise.all(clientRace.map(response => response.status === 429 ? response.json() : response.arrayBuffer().then(() => null)));
    const deniedClient = clientRace.find(response => response.status === 429), deniedClientJson = clientRaceJson.find(Boolean);
    check('P1759 concurrent admits from one connection stop exactly at the per-client cap inside the ledger transaction',
      clientRace.filter(response => response.status === 200).length === 3 && clientRace.filter(response => response.status === 429).length === 3 && upstreamCalls - clientCapBefore === 3);
    const retryAfter = Number(deniedClient?.headers.get('Retry-After'));
    check('P1759 client cap returns 429 JSON code client-daily-cap with Retry-After to the next UTC day',
      deniedClientJson?.error?.code === 'client-daily-cap' && deniedClientJson.error.quotaReason === 'client-daily-cap' && Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 86400
      && deniedClientJson.error.retryAfterSeconds === retryAfter && deniedClientJson.error.resetAt === new Date(Date.parse(currentDay + 'T00:00:00Z') + 86400000).toISOString()
      && /UTC 자정/.test(deniedClientJson.error.message) && deniedClient.headers.get('X-AIO-Client-Remaining') === '0', deniedClientJson);
    const admittedClient = clientRace.find(response => response.status === 200);
    check('P1759 admitted browser responses expose limit/remaining/budget headers to CORS readers',
      admittedClient.headers.get('X-AIO-Client-Limit') === '3' && /^[0-2]$/.test(admittedClient.headers.get('X-AIO-Client-Remaining') || '') && admittedClient.headers.get('X-AIO-Budget-State') === 'ok'
      && admittedClient.headers.get('X-AIO-Budget-Saver') === '0' && /X-AIO-Client-Remaining/.test(admittedClient.headers.get('Access-Control-Expose-Headers') || '') && /Retry-After/.test(admittedClient.headers.get('Access-Control-Expose-Headers') || ''));
    const otherClient = await worker.fetch(req(body, { headers: ip('203.0.113.10') }), clientCap.env); await otherClient.arrayBuffer();
    const automationAfterCap = await worker.fetch(req(body, { origin: '', headers: ip('203.0.113.9', { 'X-AIO-Automation-Token': TOKEN }) }), clientCap.env); await automationAfterCap.arrayBuffer();
    check('P1759 one capped connection never blocks another connection or authenticated Actions (global cap stays the authority)',
      otherClient.status === 200 && otherClient.headers.get('X-AIO-Client-Remaining') === '2' && automationAfterCap.status === 200 && !automationAfterCap.headers.has('X-AIO-Client-Limit')
      && clientCap.saved().days['claude:' + currentDay] === 5);
    const clientLedger = clientCap.saved().clients['claude:' + currentDay], clientLedgerText = JSON.stringify(clientCap.saved());
    check('P1759 ledger stores only HMAC client keys, never raw addresses', Object.keys(clientLedger).length === 2 && Object.keys(clientLedger).every(key => /^[0-9a-f]{32}$/.test(key))
      && Object.values(clientLedger).sort().join(',') === '1,3' && !clientLedgerText.includes('203.0.113'));
    const retryCap = harness(undefined, { AI_PER_CLIENT_DAILY_CAP: '1' }), retrySend = async (key, address = '203.0.113.20') => { const response = await worker.fetch(req(body, { headers: ip(address, { 'X-AIO-Idempotency-Key': key }) }), retryCap.env); await response.arrayBuffer(); return response.status; };
    const retryStatuses = [await retrySend('question-one'), await retrySend('question-one:retry1'), await retrySend('question-one:retry2'), await retrySend('question-one:retry3'), await retrySend('question-two'), await retrySend('question-three', '203.0.113.21'), await retrySend('question-three:retry1')];
    check('v57.61 retries of one counted question do not spend the connection daily questions; other ids and connections still do', retryStatuses.join(',') === '200,200,200,429,429,200,429'
      && Object.values(retryCap.saved().clients['claude:' + currentDay]).join(',') === '1,1' && retryCap.saved().days['claude:' + currentDay] === 4, retryStatuses);
    const waiverCap = harness(undefined, { AI_PER_CLIENT_DAILY_CAP: '30', AI_FREE_RETRIES_PER_DAY: '3' }), waiverSend = async (key) => { const response = await worker.fetch(req(body, { headers: ip('203.0.113.30', { 'X-AIO-Idempotency-Key': key }) }), waiverCap.env); await response.arrayBuffer(); return response.status; };
    const waiverStatuses = []; for (let n = 0; n < 4; n += 1) for (const suffix of ['', ':retry1', ':retry2']) waiverStatuses.push(await waiverSend(`waiver-${n}${suffix}`));
    check('v57.61 free retries are bounded per connection-day, so invented retry keys cannot multiply the per-client cap',
      waiverStatuses.every((status) => status === 200) && Object.values(waiverCap.saved().clients['claude:' + currentDay]).join(',') === '9' && Object.values(waiverCap.saved().retryWaivers['claude:' + currentDay]).join(',') === '3', waiverStatuses);
    const keyEnv = { OPENAI_API_KEY: 'fake-not-a-live-key' };
    const [keyToday, keyTomorrow, keySame64, keyOther64, keySalted] = await Promise.all([
      deriveClientKey(keyEnv, '2001:db8:1:2::1', '2026-10-14'), deriveClientKey(keyEnv, '2001:db8:1:2::1', '2026-10-15'),
      deriveClientKey(keyEnv, '2001:0db8:0001:0002:ffff:0:0:5', '2026-10-14'), deriveClientKey(keyEnv, '2001:db8:1:3::1', '2026-10-14'),
      deriveClientKey({ ...keyEnv, AI_CLIENT_KEY_SALT: 'separate-salt' }, '2001:db8:1:2::1', '2026-10-14')]);
    check('P1759 client key rotates daily, groups IPv6 by /64 and depends on the secret salt', keyToday !== keyTomorrow && keyToday === keySame64 && keyToday !== keyOther64 && keyToday !== keySalted && /^[0-9a-f]{32}$/.test(keyToday));
    const v6 = harness(undefined, { AI_PER_CLIENT_DAILY_CAP: '2' });
    const v6Responses = [];
    for (const address of ['2001:db8:9:9::1', '2001:db8:9:9::2', '2001:db8:9:9:abcd::3', '2001:db8:9:a::1']) { const response = await worker.fetch(req(body, { headers: ip(address) }), v6.env); await response.arrayBuffer(); v6Responses.push(response.status); }
    check('P1759 rotating addresses inside one IPv6 /64 cannot mint new allowances', v6Responses.join(',') === '200,200,429,200', v6Responses);
    const clamp = harness(undefined, { AI_DAILY_CAP: '2', AI_PER_CLIENT_DAILY_CAP: '40' }), clamped = await worker.fetch(req(body, { headers: ip('198.51.100.60') }), clamp.env); await clamped.arrayBuffer();
    check('P1759 per-client cap is clamped to the global day cap', clamped.headers.get('X-AIO-Client-Limit') === '2');
    for (const value of ['0', '1001', '4.5', 'x']) {
      const invalid = harness(undefined, { AI_PER_CLIENT_DAILY_CAP: value }), invalidBefore = upstreamCalls;
      const invalidResponse = await worker.fetch(req(body, { headers: ip('198.51.100.61') }), invalid.env);
      const invalidHealth = await (await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), invalid.env)).json();
      check('P1759 out-of-range AI_PER_CLIENT_DAILY_CAP fails closed and reports not ready ' + value, invalidResponse.status === 503 && upstreamCalls === invalidBefore && invalidHealth.ai.ready === false && invalidHealth.ai.configurationValid === false);
    }
    // Ledger-level: release returns the question, day rollover prunes, malformed map resets, bucket bound.
    const ledger = harness(), clientKeyA = 'a'.repeat(32), withClient = id => ({ ...payload(id), clientKey: clientKeyA, clientCap: 2 });
    await ledger.durable.mutateQuota('reserve', withClient('client-release-1'));
    await ledger.durable.mutateQuota('release', withClient('client-release-1'));
    const afterRelease = structuredClone(ledger.saved().clients['claude:' + currentDay] || {});
    await ledger.durable.mutateQuota('reserve', withClient('client-release-2')); await ledger.durable.mutateQuota('start', withClient('client-release-2')); await ledger.durable.mutateQuota('release', withClient('client-release-2'));
    check('P1759 pre-dispatch release returns the question; a dispatched attempt keeps it', afterRelease[clientKeyA] === undefined && ledger.saved().clients['claude:' + currentDay][clientKeyA] === 1);
    let badKeyRejected = false; try { await ledger.durable.mutateQuota('reserve', { ...payload('client-bad-key'), clientKey: '203.0.113.9' }); } catch { badKeyRejected = true; }
    check('P1759 the ledger refuses anything but a hashed client key', badKeyRejected && !JSON.stringify(ledger.saved()).includes('203.0.113.9'));
    const yesterday = new Date(Date.parse(currentDay + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    const rolled = harness({ schemaVersion: 2, months: { [currentMonth]: 0 }, legacyUnknownMonths: {}, days: {}, reservations: {}, clients: { ['claude:' + yesterday]: { [clientKeyA]: 2 } } });
    const rolledReserve = await rolled.durable.mutateQuota('reserve', withClient('client-rollover'));
    check('P1759 per-client counts expire at the UTC day boundary (yesterday pruned, today admitted)', rolledReserve.reserved === true && rolledReserve.clientRemaining === 1
      && !Object.hasOwn(rolled.saved().clients, 'claude:' + yesterday) && rolled.saved().clients['claude:' + currentDay][clientKeyA] === 1);
    const malformedClients = harness({ schemaVersion: 2, months: { [currentMonth]: 0 }, legacyUnknownMonths: {}, days: {}, reservations: {}, clients: { ['claude:' + currentDay]: { 'raw-ip': 'x' } } });
    const malformedReserve = await malformedClients.durable.mutateQuota('reserve', withClient('client-malformed'));
    check('P1759 malformed client map resets instead of bricking AI', malformedReserve.reserved === true && Object.keys(malformedClients.saved().clients['claude:' + currentDay]).join() === clientKeyA);
    const fullBucket = {}; for (let i = 0; i < 2000; i++) fullBucket[i.toString(16).padStart(32, '0')] = 1;
    const bounded = harness({ schemaVersion: 2, months: { [currentMonth]: 0 }, legacyUnknownMonths: {}, days: {}, reservations: {}, clients: { ['claude:' + currentDay]: fullBucket } });
    const boundedNew = await bounded.durable.mutateQuota('reserve', withClient('client-bound-new'));
    const boundedOld = await bounded.durable.mutateQuota('reserve', { ...payload('client-bound-old'), clientKey: '0'.repeat(32), clientCap: 2 });
    check('P1759 client map is bounded: a new key past the ceiling fails closed, a known key still counts', boundedNew.reserved === false && boundedNew.reason === 'client-daily-cap' && boundedOld.reserved === true
      && Object.keys(bounded.saved().clients['claude:' + currentDay]).length === 2000);
    // Budget state and server-side search removal.
    const monthCap = 1000000, lowSpent = 850000, exhaustedSpent = monthCap - 100;
    const ledgerAt = spent => ({ schemaVersion: 2, months: { [currentMonth]: spent }, legacyUnknownMonths: {}, days: {}, reservations: {} });
    const okSearch = harness(ledgerAt(0), { AI_MONTHLY_BUDGET_USD: '1' }); lastRequest = null;
    const okSearchResponse = await worker.fetch(req(searchBody, { headers: ip('198.51.100.70') }), okSearch.env); await okSearchResponse.arrayBuffer();
    check('P1759 healthy month keeps hosted search and says so', okSearchResponse.status === 200 && JSON.parse(lastRequest.init.body).tools?.[0]?.type === 'web_search' && okSearchResponse.headers.get('X-AIO-Budget-State') === 'ok' && !okSearchResponse.headers.has('X-AIO-Web-Search-Removed')
      && okSearch.saved().months[currentMonth] === verifiedOpenAiCharge(usageResponse(), searchBudget) && Object.values(okSearch.saved().reservations)[0].originalReservationMicroUsd === searchBudget.reservationMicroUsd);
    const lowSearch = harness(ledgerAt(lowSpent), { AI_MONTHLY_BUDGET_USD: '1' }); lastRequest = null;
    const lowSearchResponse = await worker.fetch(req(searchBody, { headers: ip('198.51.100.71') }), lowSearch.env); await lowSearchResponse.arrayBuffer();
    const lowSent = JSON.parse(lastRequest.init.body);
    check('P1759 below 20% of the month the Worker removes hosted search from new requests and flags it',
      lowSearchResponse.status === 200 && lowSent.tools === undefined && lowSent.max_tool_calls === undefined && lowSent.tool_choice === undefined && /예산 절약 모드/.test(lowSent.instructions)
      && lowSearchResponse.headers.get('X-AIO-Budget-State') === 'low' && lowSearchResponse.headers.get('X-AIO-Budget-Saver') === '1' && lowSearchResponse.headers.get('X-AIO-Web-Search-Removed') === '1', lowSent);
    check('P1759 the saver request is reserved and settled at its no-search price inside the same ledger', lowSearch.saved().months[currentMonth] > lowSpent && lowSearch.saved().months[currentMonth] < lowSpent + searchBudget.searchReserveMicroUsd
      && Object.values(lowSearch.saved().reservations)[0].settled === true);
    const lowPlain = await worker.fetch(req(body, { headers: ip('198.51.100.72') }), lowSearch.env); await lowPlain.arrayBuffer();
    check('P1759 plain requests in a low month are admitted and carry the saver flag without a removal marker', lowPlain.status === 200 && lowPlain.headers.get('X-AIO-Budget-Saver') === '1' && !lowPlain.headers.has('X-AIO-Web-Search-Removed'));
    const exhausted = harness(ledgerAt(exhaustedSpent), { AI_MONTHLY_BUDGET_USD: '1' }), exhaustedBefore = upstreamCalls;
    const exhaustedResponse = await worker.fetch(req(searchBody, { headers: ip('198.51.100.73') }), exhausted.env), exhaustedJson = await exhaustedResponse.json();
    check('P1759 exhausted month denies before upstream with budget-state header and no Retry-After', exhaustedResponse.status === 429 && exhaustedJson.error.code === 'monthly-budget' && exhaustedResponse.headers.get('X-AIO-Budget-State') === 'exhausted' && !exhaustedResponse.headers.has('Retry-After') && upstreamCalls === exhaustedBefore, { status: exhaustedResponse.status, json: exhaustedJson, state: exhaustedResponse.headers.get('X-AIO-Budget-State'), ra: exhaustedResponse.headers.get('Retry-After') });
    // /health: coarse state + caller's own remaining questions; no amounts.
    const healthOf = async (fixture, address) => (await worker.fetch(req(undefined, { path: '/health', method: 'GET', headers: ip(address) }), fixture.env)).json();
    const okHealth = await healthOf(okSearch, '198.51.100.70'), lowHealth = await healthOf(lowSearch, '198.51.100.71'), exhaustedHealth = await healthOf(exhausted, '198.51.100.73');
    const capHealth = await healthOf(clientCap, '203.0.113.9'), freshHealth = await healthOf(clientCap, '203.0.113.11');
    check('P1759 health reports coarse budgetState and the matching saver label/web-search availability',
      okHealth.ai.budgetState === 'ok' && okHealth.ai.budgetSaver.active === false && okHealth.ai.webSearchAvailable === true
      && lowHealth.ai.budgetState === 'low' && lowHealth.ai.budgetSaver.active === true && lowHealth.ai.budgetSaver.label === '예산 절약 모드 · 웹 검색 없이' && lowHealth.ai.webSearchAvailable === false && lowHealth.ai.paidWebSearchEnabled === true
      && exhaustedHealth.ai.budgetState === 'exhausted' && exhaustedHealth.ai.ready === true, { ok: okHealth.ai, low: lowHealth.ai });
    check('P1759 health reports the caller\'s own remaining daily questions from its hashed key', capHealth.ai.client?.dailyLimit === 3 && capHealth.ai.client.remainingToday === 0
      && freshHealth.ai.client?.remainingToday === 3 && freshHealth.ai.client.resetsAt === deniedClientJson.error.resetAt, capHealth.ai.client);
    const lowHealthText = JSON.stringify(lowHealth);
    check('P1759 health never leaks spend, reservation or cap amounts', !/monthlyReserved|monthlyBudget|MicroUsd|requestCount|aiDailyCap|850000|1000000/.test(lowHealthText) && !lowHealthText.includes('198.51.100'));
    // Review items: transient authority failure is not held for a minute; /health has its own bucket.
    const flakyAuthority = harness(); let failNextHealth = true;
    const realBinding = flakyAuthority.env.AIO_QUOTA_DO;
    flakyAuthority.env.AIO_QUOTA_DO = { jurisdiction(value) { const ns = realBinding.jurisdiction(value); return { getByName(name) { const stub = ns.getByName(name); return { fetch(url, init) { if (String(url).endsWith('/health') && failNextHealth) { failNextHealth = false; throw new Error('fixture DO glitch'); } return stub.fetch(url, init); } }; } }; } };
    const firstProbe = await healthOf(flakyAuthority, '198.51.100.80'), cachedProbe = await healthOf(flakyAuthority, '198.51.100.80');
    const realNow = Date.now; let laterProbe;
    try { Date.now = () => realNow() + 6000; laterProbe = await healthOf(flakyAuthority, '198.51.100.80'); } finally { Date.now = realNow; }
    check('P1759 a failed authority probe is cached for seconds, not a minute', firstProbe.ai.ready === false && cachedProbe.ai.ready === false && laterProbe.ai.ready === true);
    const healthOwnBucket = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), { ...fixture.env, RATE_LIMIT_PROXY: { limit: async () => ({ success: false }) } });
    const healthRefused = await worker.fetch(req(undefined, { path: '/health', method: 'GET' }), { ...fixture.env, RATE_LIMIT_HEALTH: { limit: async () => ({ success: false }) } });
    check('P1759 /health no longer spends the data-proxy bucket and has its own limiter', healthOwnBucket.status === 200 && healthRefused.status === 429);
    check('P1759 Worker source keeps per-client admission inside the reserve transaction', source.includes("reason: 'client-daily-cap'") && source.includes('AUTHORITY_HEALTH_FAILURE_MEMO_MS') && source.includes("'RATE_LIMIT_HEALTH', healthRateLimitMap"));
  } finally { globalThis.fetch = originalFetch; }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`PASS: shared GPT-6 Luna Worker (${checks} assertions; no live API requests)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
