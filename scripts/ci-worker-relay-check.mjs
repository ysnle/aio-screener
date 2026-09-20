// P1151 / R627 — /relay server-side key relay contract.
//
// The relay exists so browser-blocked sources (FRED, BOK ECOS, KOSIS) can reach the
// user without the user holding a key. Before it existed, all three were declared,
// configurable, and unreachable — every assertion here guards one property whose loss
// would silently restore that state:
//   1. the browser never supplies a key and never chooses the destination (no SSRF),
//   2. a missing operator key fails that provider closed instead of degrading open,
//   3. the operator key never reaches the response body, headers, or logs.
import worker from '../cloudflare-worker-proxy.js';
import { readFileSync } from 'node:fs';

const errors = [];
const check = (label, condition, detail) => {
  if (!condition) errors.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
};
const PROD_ORIGIN = 'https://ysnle.github.io';
const SECRET = 'relay-fixture-secret-value';

function relayRequest(query, { origin = PROD_ORIGIN, method = 'GET', headers = {} } = {}) {
  return new Request('https://worker.example/relay?' + query, {
    method,
    headers: new Headers({ Origin: origin, ...headers }),
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
  const source = readFileSync(new URL('../cloudflare-worker-proxy.js', import.meta.url), 'utf8');

  // ── Static boundary ────────────────────────────────────────────────────────
  check('P1151 single canonical relay handler', (source.match(/async function handleRelay\(/g) || []).length === 1);
  const relayBlock = source.slice(source.indexOf('const RELAY_PROVIDERS'), source.indexOf('/**\n * Canonical /relay handler'));
  check('P1151 relay is a separate route from the generic url proxy', /_u\.pathname === '\/relay'/.test(source));
  for (const host of ['api.stlouisfed.org', 'ecos.bok.or.kr', 'kosis.kr']) {
    check(`P1151 relay hardcodes upstream host ${host}`, relayBlock.includes(host));
  }
  check('P1151 relay sources keys from env only', ['FRED_API_KEY', 'BOK_API_KEY', 'KOSIS_API_KEY'].every((name) => relayBlock.includes(`'${name}'`)));
  check('P1151 relay exposes no client-supplied destination parameter', !/params\.(url|host|endpoint|target)\b/.test(relayBlock) && !/url:\s*\{\s*required/.test(relayBlock));

  const env = {
    FRED_API_KEY: SECRET,
    BOK_API_KEY: SECRET,
    KOSIS_API_KEY: SECRET,
    AIO_QUOTA_DO: atomicQuota(),
    RELAY_DAILY_CAP: '5',
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  const method = await worker.fetch(relayRequest('provider=fred&series_id=DGS10', { method: 'POST' }), env);
  check('P1151 non-GET relay is rejected', method.status === 405, method.status);

  const badOrigin = await worker.fetch(relayRequest('provider=fred&series_id=DGS10', { origin: 'https://example.com' }), env);
  check('P1151 non-allowlisted origin is refused before any upstream call', badOrigin.status === 403, badOrigin.status);

  const tokenEnv = { ...env, AIO_APP_TOKEN: 'app-token-fixture' };
  const badToken = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), tokenEnv);
  check('P1151 missing app token is refused', badToken.status === 403, badToken.status);
  const goodToken = await worker.fetch(relayRequest('provider=fred&series_id=DGS10', { headers: { 'X-AIO-App-Token': 'app-token-fixture' } }), {
    ...tokenEnv,
    AIO_QUOTA_DO: atomicQuota(),
  });
  check('P1151 configured app token is accepted', goodToken.status !== 403, goodToken.status);

  const unknown = await worker.fetch(relayRequest('provider=evil&series_id=DGS10'), env);
  check('P1151 unknown provider is rejected', unknown.status === 400, unknown.status);

  const missingParam = await worker.fetch(relayRequest('provider=fred'), env);
  check('P1151 missing required parameter is rejected', missingParam.status === 400, missingParam.status);

  const invalidParam = await worker.fetch(relayRequest('provider=fred&series_id=' + encodeURIComponent('../etc/passwd')), env);
  check('P1151 parameter outside the whitelist regex is rejected', invalidParam.status === 400, invalidParam.status);

  const noQuota = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), { FRED_API_KEY: SECRET });
  check('P1151 missing atomic quota binding fails closed', noQuota.status === 503, noQuota.status);

  // A provider whose operator key is absent must fail alone, not degrade open.
  const partialEnv = { BOK_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() };
  const keylessFred = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), partialEnv);
  check('P1151 provider without an operator key fails closed', keylessFred.status === 503, keylessFred.status);
  check('P1151 keyless failure names the provider', /fred/i.test(await keylessFred.text()));

  // ── Daily cap ──────────────────────────────────────────────────────────────
  const capEnv = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota(), RELAY_DAILY_CAP: '1' };
  const realFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (url) => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ observations: [{ date: '2026-01-01', value: '1' }], echoed: String(url) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const first = await worker.fetch(relayRequest('provider=fred&series_id=DGS10&limit=1'), capEnv);
    check('P1151 relay serves a configured provider', first.status === 200, first.status);
    const firstBody = await first.json();
    check('P1151 relay returns the upstream payload unchanged', Array.isArray(firstBody.observations) && firstBody.observations.length === 1, firstBody);
    check('P1151 relay marks its own provider in the response', first.headers.get('X-AIO-Relay-Provider') === 'fred', first.headers.get('X-AIO-Relay-Provider'));

    const second = await worker.fetch(relayRequest('provider=fred&series_id=DGS10&limit=1'), capEnv);
    check('P1151 daily cap exhaustion returns 429', second.status === 429, second.status);
    check('P1151 a capped request never reaches upstream', upstreamCalls === 1, upstreamCalls);

    // ── Key redaction ────────────────────────────────────────────────────────
    const leakEnv = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() };
    globalThis.fetch = async (url) => new Response(
      JSON.stringify({ observations: [], error_message: 'bad request to ' + String(url) }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
    const leak = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), leakEnv);
    const leakBody = await leak.text();
    check('P1151 an upstream body echoing the operator key is redacted', !leakBody.includes(SECRET), leakBody.slice(0, 160));
    check('P1151 redaction keeps the response readable', leakBody.includes('***'));

    // ── Server-side key injection ────────────────────────────────────────────
    let observedUrl = '';
    globalThis.fetch = async (url) => {
      observedUrl = String(url);
      return new Response(JSON.stringify({ observations: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    await worker.fetch(relayRequest('provider=fred&series_id=DGS10&limit=1'), { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() });
    check('P1151 the operator key is injected server-side into the upstream call', observedUrl.includes('api_key=' + SECRET), observedUrl);
    check('P1151 the client cannot influence the destination host', observedUrl.startsWith('https://api.stlouisfed.org/fred/series/observations?'), observedUrl);

    let bokUrl = '';
    globalThis.fetch = async (url) => {
      bokUrl = String(url);
      return new Response(JSON.stringify({ StatisticSearch: { row: [] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    await worker.fetch(relayRequest('provider=bok&statCode=722Y001&cycle=M&start=202601&end=202602&item=0101000'), { BOK_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() });
    check('P1151 the BOK path-embedded key is assembled server-side', bokUrl.startsWith('https://ecos.bok.or.kr/api/StatisticSearch/' + SECRET + '/json/kr/1/100/722Y001/M/202601/202602/0101000'), bokUrl);

    // ── Blocked upstream ─────────────────────────────────────────────────────
    globalThis.fetch = async () => new Response('<!doctype html><title>Access denied</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    const blocked = await worker.fetch(relayRequest('provider=kosis&orgId=101&tblId=DT_1J17001&itmId=T10'), { KOSIS_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() });
    check('P1151 an HTML block page is surfaced as 502', blocked.status === 502, blocked.status);
  } finally {
    globalThis.fetch = realFetch;
  }

  // ── Shared proxy surface (P1156) ───────────────────────────────────────────
  // The generic ?url= route never refused a request: the Origin allowlist only chose which
  // ACAO value to echo, so any client could ride this Worker to every ALLOWED_DOMAINS host.
  const proxyEnv = { AIO_QUOTA_DO: atomicQuota() };
  const yahoo = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/SPY');
  const proxyBadOrigin = await worker.fetch(new Request('https://worker.example/?url=' + yahoo, { headers: { Origin: 'https://example.com' } }), proxyEnv);
  check('P1156 the generic proxy refuses a non-allowlisted Origin', proxyBadOrigin.status === 403, proxyBadOrigin.status);
  const proxyNoOrigin = await worker.fetch(new Request('https://worker.example/?url=' + yahoo), proxyEnv);
  check('P1156 the generic proxy refuses a missing Origin', proxyNoOrigin.status === 403, proxyNoOrigin.status);
  const proxyBadMethod = await worker.fetch(new Request('https://worker.example/?url=' + yahoo, { method: 'POST', headers: { Origin: PROD_ORIGIN } }), proxyEnv);
  check('P1156 the generic proxy stays GET-only', proxyBadMethod.status === 405, proxyBadMethod.status);

  // ── Cloudflare-native rate limiting (P1157) ────────────────────────────────
  // `workers.dev` has no zone, so a WAF rate limiting rule is not available to this deployment.
  // These bindings are the strongest bound it can carry, and a missing/throwing binding must
  // degrade to the in-isolate Map rather than admitting or rejecting blindly.
  const proxyToml = readFileSync(new URL('../worker/wrangler.proxy.toml', import.meta.url), 'utf8');
  for (const name of ['RATE_LIMIT_PROXY', 'RATE_LIMIT_ANTHROPIC', 'RATE_LIMIT_RELAY']) {
    check(`P1157 the proxy config declares the ${name} binding`, new RegExp(`name\\s*=\\s*"${name}"`).test(proxyToml));
  }
  check('P1157 every declared rate limit period is 10 or 60', [...proxyToml.matchAll(/period\s*=\s*(\d+)/g)].every((match) => ['10', '60'].includes(match[1])));
  check('P1157 rate limit namespace ids are unique positive integers', (() => {
    const ids = [...proxyToml.matchAll(/namespace_id\s*=\s*"(\d+)"/g)].map((match) => match[1]);
    return ids.length === 3 && new Set(ids).size === ids.length && ids.every((id) => Number(id) > 0);
  })());

  {
    const stubbed = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ observations: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    try {
      const refusing = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_RELAY: { limit: async () => ({ success: false }) } };
      const refusedRelay = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), refusing);
      check('P1157 a refusing binding returns 429 on /relay', refusedRelay.status === 429, refusedRelay.status);

      const refusingProxy = { AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_PROXY: { limit: async () => ({ success: false }) } };
      const refusedProxy = await worker.fetch(new Request('https://worker.example/?url=' + yahoo, { headers: { Origin: PROD_ORIGIN } }), refusingProxy);
      check('P1157 a refusing binding returns 429 on the generic proxy', refusedProxy.status === 429, refusedProxy.status);

      const allowing = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_RELAY: { limit: async () => ({ success: true }) } };
      const allowedRelay = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), allowing);
      check('P1157 an allowing binding lets the request through', allowedRelay.status === 200, allowedRelay.status);

      const throwing = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota(), RATE_LIMIT_RELAY: { limit: async () => { throw new Error('binding unavailable'); } } };
      const fellBack = await worker.fetch(relayRequest('provider=fred&series_id=DGS10'), throwing);
      check('P1157 a throwing binding falls back to the in-isolate limiter instead of erroring', fellBack.status === 200, fellBack.status);
    } finally {
      globalThis.fetch = stubbed;
    }
  }

  // ── Health surface ─────────────────────────────────────────────────────────
  const healthEnv = { FRED_API_KEY: SECRET, AIO_QUOTA_DO: atomicQuota() };
  const health = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), healthEnv);
  const healthText = await health.text();
  const healthBody = JSON.parse(healthText);
  check('P1151 health lists the relay providers', Array.isArray(healthBody.relay?.providers) && healthBody.relay.providers.includes('fred'), healthBody.relay);
  check('P1151 health reports per-provider key presence', healthBody.relay?.configured?.fred === true && healthBody.relay?.configured?.bok === false, healthBody.relay?.configured);
  check('P1151 health never exposes a relay key', !healthText.includes(SECRET));
  // The token check is `if (env.AIO_APP_TOKEN && …)`, so an unset token means no check at all.
  // /health has to say which state the operator is in instead of implying the gate is closed.
  check('P1156 health reports whether the app token is required', healthBody.relay?.appTokenRequired === false, healthBody.relay);
  const tokenHealth = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: PROD_ORIGIN } }), { ...healthEnv, AIO_APP_TOKEN: 'token-fixture' });
  check('P1156 health reflects a configured app token', (await tokenHealth.json()).relay?.appTokenRequired === true);

  if (errors.length) {
    console.error('Worker relay contract failed:');
    errors.forEach((error) => console.error(' - ' + error));
    process.exit(1);
  }
  console.log('Worker relay contract OK: env-only operator keys, hardcoded destinations, fail-closed per provider, atomic daily cap, and key redaction.');
  process.exit(0);
}

main();
