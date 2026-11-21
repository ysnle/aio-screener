// Non-AI surface of the aio-proxy Worker: the generic ?url= data proxy, its transport boundary, the
// Cloudflare rate-limit bindings, /workers-ai/translate and the public /health payload.
// v60.39: this gate was scripts/ci-worker-relay-check.mjs. The BOK/KOSIS /relay route left the Worker
// (its browser client left in v60.38), so its assertions were removed and the shared ones (transport,
// rate limiting, dev-origin errors) now run on the generic proxy. /openai lives in worker/openai-contract.test.mjs.
import worker from '../cloudflare-worker-proxy.js';
import { readFileSync } from 'node:fs';
// All upstreams in this contract use deterministic fixtures, including early auth checks.
globalThis.fetch = async () => Response.json({ observations: [{ date: '2026-10-01', value: '4.0' }] });

const errors = [];
const check = (label, condition, detail) => {
  if (!condition) errors.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
};
const PROD_ORIGIN = 'https://ysnle.github.io';

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
  const source = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');
  const yahoo = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/SPY');
  const proxyRequest = ({ origin = PROD_ORIGIN, method = 'GET', headers = {} } = {}) => new Request('https://worker.example/?url=' + yahoo, {
    method, headers: new Headers({ ...(origin ? { Origin: origin } : {}), ...headers }),
  });

  // ── Retired /relay (v60.39) ────────────────────────────────────────────────
  // The path now reaches the generic proxy, which needs ?url=, so a BOK query gets the generic 400.
  {
    const retired = await worker.fetch(new Request('https://worker.example/relay?provider=bok&statCode=722Y001&cycle=M&start=202601&end=202602', { headers: { Origin: PROD_ORIGIN } }), { BOK_API_KEY: 'relay-fixture-secret-value', AIO_QUOTA_DO: atomicQuota() });
    const retiredText = await retired.text();
    check('v60.39 P1151 /relay is no longer a Worker route', retired.status === 400 && /url parameter required/.test(retiredText) && retired.headers.get('X-AIO-Relay-Provider') === null, [retired.status, retiredText.slice(0, 80)]);
  }

  // ── Shared proxy surface (P1156) ───────────────────────────────────────────
  // The generic ?url= route never refused a request: the Origin allowlist only chose which
  // ACAO value to echo, so any client could ride this Worker to every ALLOWED_DOMAINS host.
  const proxyEnv = { AIO_QUOTA_DO: atomicQuota() };
  const proxyBadOrigin = await worker.fetch(proxyRequest({ origin: 'https://example.com' }), proxyEnv);
  check('P1156 the generic proxy refuses a non-allowlisted Origin', proxyBadOrigin.status === 403, proxyBadOrigin.status);
  const proxyNoOrigin = await worker.fetch(proxyRequest({ origin: '' }), proxyEnv);
  check('P1156 the generic proxy refuses a missing Origin', proxyNoOrigin.status === 403, proxyNoOrigin.status);
  const proxyBadMethod = await worker.fetch(proxyRequest({ method: 'POST' }), proxyEnv);
  check('P1156 the generic proxy stays GET-only', proxyBadMethod.status === 405, proxyBadMethod.status);

  // ── Transport boundary (P1413) ─────────────────────────────────────────────
  {
    const realFetch = globalThis.fetch;
    try {
      const followed = [];
      globalThis.fetch = async (url) => { followed.push(String(url)); return new Response('', { status: 302, headers: { location: 'https://evil.example/steal' } }); };
      const redirected = await worker.fetch(proxyRequest(), proxyEnv);
      check('v60.39 P1413 a proxy redirect off the allowlist is refused', redirected.status === 502 && followed.length === 1 && /redirect refused/i.test(await redirected.text()), `${redirected.status} ${followed.join(',')}`);
      globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { for (let i = 0; i < 6; i += 1) controller.enqueue(new Uint8Array(1024 * 1024)); controller.close(); } }), { status: 200 });
      const oversized = await worker.fetch(proxyRequest(), proxyEnv);
      check('v60.39 P1413 a streamed proxy body over 5MB without Content-Length is refused', oversized.status === 502 && /too large/i.test(await oversized.text()), oversized.status);
      let hop = 0;
      globalThis.fetch = async (url) => { hop += 1; return hop === 1 ? new Response('', { status: 301, headers: { location: String(url) + '&hop=2' } }) : Response.json({ chart: { result: [] } }); };
      const sameHost = await worker.fetch(proxyRequest(), proxyEnv);
      check('v60.39 P1413 a redirect that stays on the allowlist is still followed', sameHost.status === 200 && hop === 2, `${sameHost.status} ${hop}`);
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // ── Cloudflare-native rate limiting (P1157) ────────────────────────────────
  // `workers.dev` has no zone, so a WAF rate limiting rule is not available to this deployment.
  // These bindings are the strongest bound it can carry, and a missing/throwing binding must
  // degrade to the in-isolate Map rather than admitting or rejecting blindly.
  const proxyToml = readFileSync(new URL('../worker/wrangler.proxy.toml', import.meta.url), 'utf8');
  for (const name of ['RATE_LIMIT_PROXY', 'RATE_LIMIT_OPENAI', 'RATE_LIMIT_FEEDBACK', 'RATE_LIMIT_WORKERS_AI']) {
    check(`P1157 the proxy config declares the ${name} binding`, new RegExp(`name\\s*=\\s*"${name}"`).test(proxyToml));
  }
  check('P1157 every declared rate limit period is 10 or 60', [...proxyToml.matchAll(/period\s*=\s*(\d+)/g)].every((match) => ['10', '60'].includes(match[1])));
  check('P1157 rate limit namespace ids are unique positive integers', (() => {
    const ids = [...proxyToml.matchAll(/namespace_id\s*=\s*"(\d+)"/g)].map((match) => match[1]);
    return ids.length >= 3 && new Set(ids).size === ids.length && ids.every((id) => Number(id) > 0);
  })());

  // v59.97: the shared bindings must bound exactly what the in-isolate fallback bounds, so a deploy with the binding
  // and an isolate without it admit the same rate.
  {
    const declaredLimit = (name) => {
      const block = proxyToml.split('[[ratelimits]]').find((part) => new RegExp(`name\\s*=\\s*"${name}"`).test(part));
      const match = block && block.match(/limit\s*=\s*(\d+)/);
      return match ? Number(match[1]) : null;
    };
    const { WORKERS_AI_TRANSLATE_PER_MINUTE } = await import('../cloudflare-worker-proxy.js');
    check('v59.97 the RATE_LIMIT_WORKERS_AI binding limit equals WORKERS_AI_TRANSLATE_PER_MINUTE', declaredLimit('RATE_LIMIT_WORKERS_AI') === WORKERS_AI_TRANSLATE_PER_MINUTE, [declaredLimit('RATE_LIMIT_WORKERS_AI'), WORKERS_AI_TRANSLATE_PER_MINUTE]);
    // The feedback limit is not exported: count how many notes one IP gets past the fallback limiter before its 429.
    const feedbackRequest = (ip, env) => worker.fetch(new Request('https://worker.example/feedback', {
      method: 'POST', headers: { Origin: PROD_ORIGIN, 'Content-Type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ text: 'note' }),
    }), env);
    let admitted = 0;
    for (let i = 0; i < 50; i += 1) {
      const response = await feedbackRequest('192.0.2.197', {});
      await response.arrayBuffer();
      if (response.status === 429) break;
      admitted += 1;
    }
    check('v59.97 the RATE_LIMIT_FEEDBACK binding limit equals the per-IP /feedback fallback limit', admitted > 0 && admitted < 50 && declaredLimit('RATE_LIMIT_FEEDBACK') === admitted, [declaredLimit('RATE_LIMIT_FEEDBACK'), admitted]);
    const refusedFeedback = await feedbackRequest('192.0.2.198', { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_FEEDBACK: { limit: async () => ({ success: false }) } });
    check('v59.97 a refusing RATE_LIMIT_FEEDBACK binding returns 429 on /feedback', refusedFeedback.status === 429, refusedFeedback.status);
  }

  {
    const stubbed = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ chart: { result: [] } });
    try {
      const refusedProxy = await worker.fetch(proxyRequest(), { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_PROXY: { limit: async () => ({ success: false }) } });
      check('P1157 a refusing binding returns 429 on the generic proxy', refusedProxy.status === 429, refusedProxy.status);
      const allowedProxy = await worker.fetch(proxyRequest(), { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_PROXY: { limit: async () => ({ success: true }) } });
      check('v60.39 P1157 an allowing binding lets a proxy request through', allowedProxy.status === 200, allowedProxy.status);
      const fellBack = await worker.fetch(proxyRequest(), { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_PROXY: { limit: async () => { throw new Error('binding unavailable'); } } });
      check('v60.39 P1157 a throwing binding falls back to the in-isolate limiter instead of erroring', fellBack.status === 200, fellBack.status);
    } finally {
      globalThis.fetch = stubbed;
    }
  }

  // ── v57.61 non-AI Worker hardening ─────────────────────────────────────────
  {
    const stubbed = globalThis.fetch;
    try {
      // Error responses carry the configured dev origin's CORS header (errorResponse receives env).
      const DEV = 'http://localhost:8891';
      const devEnv = { AIO_DEV_ORIGINS: DEV, AIO_QUOTA_DO: atomicQuota() };
      const devProxy = await worker.fetch(new Request('https://worker.example/', { headers: { Origin: DEV } }), devEnv);
      const devTombstone = await worker.fetch(new Request('https://worker.example/anthropic', { headers: { Origin: DEV } }), devEnv);
      check('v60.39 P1156 proxy and tombstone errors echo a configured dev origin', [devProxy, devTombstone].every((r) => r.headers.get('Access-Control-Allow-Origin') === DEV)
        && devProxy.status === 400 && devTombstone.status === 410, [devProxy, devTombstone].map((r) => `${r.status}:${r.headers.get('Access-Control-Allow-Origin')}`));
      check('v57.61 every errorResponse call site passes env', !/errorResponse\([^\n]*,\s*\d{3},\s*(?:origin|requestOrigin)\)/.test(source));
      // Rate-limit buckets: IPv6 grouped per /64 and the isolate map is bounded.
      globalThis.fetch = async () => Response.json({ chart: { result: [] } });
      const keys = [];
      const keyed = { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_PROXY: { limit: async ({ key }) => { keys.push(key); return { success: true }; } } };
      for (const ip of ['2001:db8:1:2:aaaa::1', '2001:db8:1:2:bbbb:cccc:dddd:eeee']) {
        await worker.fetch(proxyRequest({ headers: { 'cf-connecting-ip': ip } }), keyed);
      }
      check('v60.39 P1157 rate-limit buckets group IPv6 by /64', keys.length === 2 && keys[0] === keys[1] && keys[0] === '2001:db8:1:2::/64', keys);
      const { checkRateLimit, RATE_LIMIT_MAP_MAX_KEYS } = await import('../cloudflare-worker-proxy.js');
      const bounded = new Map();
      for (let i = 0; i < RATE_LIMIT_MAP_MAX_KEYS; i += 1) bounded.set('10.0.' + i, { count: 1, resetTime: Date.now() + 60000 });
      const admitted = checkRateLimit('192.0.2.1', bounded, 10);
      check('v57.61 the isolate rate-limit map never grows past its bound', RATE_LIMIT_MAP_MAX_KEYS === 5000 && admitted && bounded.size <= RATE_LIMIT_MAP_MAX_KEYS && bounded.has('192.0.2.1'), bounded.size);
    } finally {
      globalThis.fetch = stubbed;
    }
  }

  // ── /workers-ai/translate (v57.61) ─────────────────────────────────────────
  {
    const AUTOMATION = 'automation-fixture-token-' + 'y'.repeat(32);
    const MODEL_TEXT = 'MODEL-OUTPUT-MUST-NOT-LEAK';
    const aiEnv = (reply) => ({ AIO_AUTOMATION_TOKEN: AUTOMATION, AI: { run: async () => (typeof reply === 'function' ? reply() : reply) } });
    const translate = (titles, { token = AUTOMATION, method = 'POST', raw } = {}) => new Request('https://worker.example/workers-ai/translate', {
      method, headers: token ? { 'X-AIO-Automation-Token': token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: raw ?? JSON.stringify({ titles }) } : {}) });
    const titles = (n) => Array.from({ length: n }, (_, i) => `Headline ${i}`);
    const ok = aiEnv((() => ({ response: JSON.stringify(titles(2).map((_, i) => `번역 ${i}`)) })));
    const noToken = await worker.fetch(translate(titles(2), { token: '' }), ok);
    const anonGet = await worker.fetch(translate(null, { token: '', method: 'GET' }), ok);
    const authedGet = await worker.fetch(translate(null, { method: 'GET' }), ok);
    check('v57.61 translate hides itself (404) from a caller without the automation token, for every method', noToken.status === 404 && anonGet.status === 404 && authedGet.status === 405, [noToken.status, anonGet.status, authedGet.status]);
    const big = await worker.fetch(translate(null, { raw: JSON.stringify({ titles: ['x'.repeat(40 * 1024)] }) }), ok);
    check('v57.61 translate answers 413 for an oversized body', big.status === 413, big.status);
    const over41 = await worker.fetch(translate(titles(41)), ok);
    const over21 = await worker.fetch(translate(titles(21)), ok);
    check('v57.61 translate refuses more than 20 titles with 400', over41.status === 400 && over21.status === 400, [over41.status, over21.status]);
    const good = await worker.fetch(translate(titles(2)), ok);
    const goodBody = await good.json();
    check('v57.61 translate returns one translation per title', good.status === 200 && goodBody.translations?.length === 2, goodBody);
    // v59.74: the producer's glossary reaches the free model's system prompt (bounded); a request without one still works.
    let seenSystem = '';
    const glossed = await worker.fetch(translate(null, { raw: JSON.stringify({ titles: titles(2), glossary: 'muted → 약한·제한적, oil prices → 유가' }) }),
      { AIO_AUTOMATION_TOKEN: AUTOMATION, AI: { run: async (_model, input) => { seenSystem = input.messages[0].content; return { response: '["번역 0", "번역 1"]' }; } } });
    check('v59.74 translate passes the caller glossary into the system prompt', glossed.status === 200 && seenSystem.includes('oil prices → 유가') && seenSystem.includes('제목체'), seenSystem);
    const tried = [];
    const gatedFirst = { AIO_AUTOMATION_TOKEN: AUTOMATION, AI: { run: async (model) => { tried.push(model); if (tried.length === 1) throw new Error('5018: This account is not allowed to access ' + model); return { response: '["번역 0", "번역 1"]' }; } } };
    const fellBack = await worker.fetch(translate(titles(2)), gatedFirst), fellBackBody = await fellBack.json();
    const brokenOnce = []; const parseError = { AIO_AUTOMATION_TOKEN: AUTOMATION, AI: { run: async (model) => { brokenOnce.push(model); throw new Error('upstream timeout'); } } };
    const noFallback = await worker.fetch(translate(titles(2)), parseError);
    check('v57.63 translate moves to the next model only when the account cannot access one (5018), not on other errors',
      fellBack.status === 200 && tried.length === 2 && tried[0] !== tried[1] && fellBackBody.model === tried[1] && noFallback.status === 503 && brokenOnce.length === 1, { tried, brokenOnce, status: noFallback.status });
    const truncated = await worker.fetch(translate(titles(2)), aiEnv({ response: `["번역 0", "${MODEL_TEXT}` }));
    const mismatch = await worker.fetch(translate(titles(2)), aiEnv({ response: `["${MODEL_TEXT}"]` }));
    const empty = await worker.fetch(translate(titles(2)), aiEnv({ response: '["번역 0", ""]' }));
    const nonString = await worker.fetch(translate(titles(2)), aiEnv({ response: ['번역 0', 7] }));
    const thrown = await worker.fetch(translate(titles(2)), aiEnv(() => { throw new Error(MODEL_TEXT); }));
    const failures = [truncated, mismatch, empty, nonString, thrown];
    const failureBodies = await Promise.all(failures.map((r) => r.text()));
    check('v57.61 translate fails (503) on a truncated, short, empty-item, non-string or thrown reply', failures.every((r) => r.status === 503), failures.map((r) => r.status));
    check('v57.61 translate error bodies carry short codes only, never model output or exception text',
      failureBodies.every((text) => !text.includes(MODEL_TEXT) && !/"detail"/.test(text) && /"error":"[a-z0-9:-]+"/.test(text))
      && JSON.parse(failureBodies[1]).error === 'workers-ai-unparsed:count-mismatch' && JSON.parse(failureBodies[2]).error === 'workers-ai-unparsed:empty-item', failureBodies);
    // v57.83 codex audit F18: the operator kill switch stops Workers AI too (it is billed outside the OpenAI ledger).
    let killedRuns = 0;
    const killed = await worker.fetch(translate(titles(2)), { AIO_AUTOMATION_TOKEN: AUTOMATION, AI_KILL_SWITCH: '1', AI: { run: async () => { killedRuns++; return { response: '["a","b"]' }; } } });
    check('v57.83 AI_KILL_SWITCH=1 stops Workers AI translation before any AI.run', killed.status === 503 && killedRuns === 0 && (await killed.json()).error === 'kill-switch', { status: killed.status, killedRuns });
    const limited = { AIO_AUTOMATION_TOKEN: AUTOMATION, RATE_LIMIT_WORKERS_AI: { limit: async () => ({ success: false }) }, AI: { run: async () => ({ response: '["a","b"]' }) } };
    check('v57.83 a Workers AI rate-limit binding refuses a runaway caller with 429', (await worker.fetch(translate(titles(2)), limited)).status === 429);
    // Client side: larger lists are chunked to <=20 titles per request, and a failure reason keeps the code only.
    const { requestWorkersAiTranslation } = await import('./lib/ai-shared-analysis.mjs');
    const sizes = [];
    let sentGlossary = '';
    const clientEnv = { AIO_AUTOMATION_TOKEN: AUTOMATION, AI_PROXY_URL: 'https://worker.example' };
    const chunked = await requestWorkersAiTranslation(titles(30), { env: clientEnv, fetchImpl: async (_url, init) => {
      const sent = JSON.parse(init.body).titles; sizes.push(sent.length); sentGlossary = JSON.parse(init.body).glossary;
      return Response.json({ model: 'm', translations: sent.map((t) => '번역 ' + t) });
    } });
    check('v57.61 the translation client sends at most 20 titles per request and keeps order', JSON.stringify(sizes) === '[20,10]' && chunked.translations?.length === 30 && chunked.translations[29] === '번역 Headline 29', { sizes, n: chunked.translations?.length });
    check('v59.74 the translation client sends the shared market glossary', /oil prices → 유가/.test(sentGlossary || '') && /earnings → 실적/.test(sentGlossary || ''), sentGlossary);
    const failedClient = await requestWorkersAiTranslation(titles(2), { env: clientEnv, fetchImpl: async () => Response.json({ error: 'workers-ai-unparsed:count-mismatch', detail: MODEL_TEXT }, { status: 503 }) });
    check('v57.61 the translation client logs the Worker code only', failedClient.translations === null && failedClient.reason === 'workers-ai-http-503-workers-ai-unparsed:count-mismatch', failedClient);
  }

  // ── Health surface ─────────────────────────────────────────────────────────
  const OPERATOR = 'operator-private-fixture-' + 'x'.repeat(32);
  const healthEnv = { AIO_QUOTA_DO: atomicQuota(), AI_DAILY_CAP: '321', AIO_OPERATOR_TOKEN: OPERATOR };
  const health = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), healthEnv);
  const healthText = await health.text();
  const healthBody = JSON.parse(healthText);
  check('v60.39 P1151 health has no relay block and never exposes the operator token', healthBody.relay === undefined && !healthText.includes(OPERATOR), Object.keys(healthBody));
  {
    const bound = await (await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), { ...healthEnv, AI: { run: async () => ({}) } })).json();
    check('v57.61 health reports the Workers AI binding as a presence boolean', healthBody.workersAiBound === false && bound.workersAiBound === true, [healthBody.workersAiBound, bound.workersAiBound]);
  }
  // The token check is `if (env.AIO_APP_TOKEN && …)`, so an unset token means no check at all.
  // /health has to say which state the operator is in instead of implying the gate is closed.
  check('v60.39 P1156 health reports whether the app token is required', healthBody.ai?.appTokenRequired === false, healthBody.ai);
  const tokenHealth = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), { ...healthEnv, AIO_APP_TOKEN: 'token-fixture' });
  check('v60.39 P1156 health reflects a configured app token', (await tokenHealth.json()).ai?.appTokenRequired === true);
  check('P1312/R658/QA-OPS-02 public health never exposes Anthropic daily count or cap',
    healthBody.ai?.requestCount === undefined
      && healthBody.ai?.anthropicDailyCap === undefined
      && healthBody.ai?.dailyCap === undefined
      && !healthText.includes('AI_DAILY_CAP'), healthBody.ai);

  // v60.31: a Yahoo chart body whose OHLC values are mostly null is asked for once more past the edge copy; a body that
  // stays hollow is served uncached.
  {
    const realFetch = globalThis.fetch;
    const chart = (closes) => JSON.stringify({ chart: { result: [{ timestamp: closes.map((_, i) => 1700000000 + i * 300), indicators: { quote: [{ close: closes }] } }] } });
    const hollowBody = chart(Array.from({ length: 79 }, (_, i) => (i < 14 || i === 78 ? 100 + i : null)));
    const fullBody = chart(Array.from({ length: 79 }, (_, i) => 100 + i));
    const target = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=1d';
    const chartRequest = () => new Request(`https://worker.example/?url=${encodeURIComponent(target)}`, { headers: { Origin: PROD_ORIGIN } });
    const run = async (bodies) => {
      const calls = [];
      globalThis.fetch = async (url, init) => { calls.push({ url: String(url), cf: init?.cf }); return new Response(bodies[Math.min(calls.length - 1, bodies.length - 1)], { status: 200, headers: { 'content-type': 'application/json' } }); };
      const response = await worker.fetch(chartRequest(), proxyEnv);
      return { calls, body: await response.text(), cache: response.headers.get('cache-control') };
    };
    try {
      const healed = await run([hollowBody, fullBody]);
      check('v60.31 a hollow Yahoo chart body is asked for again under a one-off uncached key and the full answer is served',
        healed.calls.length === 2 && healed.calls[1].url !== healed.calls[0].url && healed.calls[1].cf?.cacheTtlByStatus?.['100-599'] === -1
          && healed.body === fullBody && /max-age=120/.test(healed.cache || ''), [healed.calls.length, healed.cache]);
      const stuck = await run([hollowBody, hollowBody]);
      check('v60.31 a Yahoo chart body that stays hollow is served no-store', stuck.calls.length === 2 && stuck.cache === 'no-store', [stuck.calls.length, stuck.cache]);
      const fine = await run([fullBody]);
      check('v60.31 a full Yahoo chart body is one upstream call', fine.calls.length === 1 && /max-age=120/.test(fine.cache || ''), [fine.calls.length, fine.cache]);
    } finally { globalThis.fetch = realFetch; }
  }

  if (errors.length) {
    console.error('Worker proxy contract failed:');
    errors.forEach((error) => console.error(' - ' + error));
    process.exit(1);
  }
  console.log('Worker proxy contract OK: generic proxy origin/method/transport bounds, rate-limit bindings, translation, public health, and no /relay route.');
  process.exit(0);
}

main();
