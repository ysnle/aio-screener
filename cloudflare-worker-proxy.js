import { OPENAI_MODEL, quotaInteger, aiMonthlyBudgetMicroUsd, prepareOpenAiBudget, verifiedOpenAiCharge } from './worker/openai-budget.mjs';
import { createOpenAiReceiptObserver } from './worker/openai-usage.mjs';
export { aiMonthlyBudgetMicroUsd, prepareOpenAiBudget } from './worker/openai-budget.mjs';
/**
 * AIO Screener CORS/data relay and shared GPT-6 Luna gateway.
 * Browser chat/translation and Actions analysis POST /openai through the same
 * atomic Durable Object. OPENAI_API_KEY stays in a Worker secret; no client key
 * route or direct Actions provider call belongs to the shared AI budget.
 * Required: OPENAI_API_KEY, AIO_QUOTA_DO. Actions additionally requires the
 * same 32+ character AIO_AUTOMATION_TOKEN in GitHub and Worker secrets.
 * AI_MONTHLY_BUDGET_USD defaults to $10 and accepts only $0-$10. AI_DAILY_CAP
 * defaults to 300; AI_MAX_OUTPUT_TOKENS defaults to 4000 (up to 8192).
 * The stable anthropic-authority-v1 DO identity/claude: day keys intentionally
 * retain historical reservations. They identify the ledger, not the provider.
 * Only standard text/function Responses calls are priced. Paid server search,
 * images/files/audio, previous-response IDs, fast/long-context inputs fail closed.
 * Successful verified usage settles conservatively; missing/failed/cancelled
 * receipts retain the full reserve. This ledger is not an account invoice: use
 * a dedicated OpenAI project/key exclusively through the shared Worker.
 * Browser Origin/app token is an abuse speed bump, not user authentication.
 * Missing Origin requires the private automation token and never bypasses quota.
 * Data proxy and /relay are independent; FRED_API_KEY, BOK_API_KEY, KOSIS_API_KEY
 * remain server-only. Their upstream URLs/parameters are explicitly allowlisted.
 * No commit, deploy or secret provisioning is performed by this source file.
 */

// ── 허용 Origin (CORS) ──────────────────────────────────────────
const PRODUCTION_ORIGINS = Object.freeze([
  'https://ysnle.github.io',
]);
const DEV_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.pathname !== '/' && parsed.pathname !== '') return '';
    return parsed.origin;
  } catch { return ''; }
}

function getAllowedOrigins(env) {
  const configuredDev = String(env?.AIO_DEV_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(origin => DEV_ORIGIN_RE.test(origin));
  return [...PRODUCTION_ORIGINS, ...new Set(configuredDev)];
}

function resolveAllowedOrigin(requestOrigin, env) {
  const normalized = normalizeOrigin(requestOrigin);
  return getAllowedOrigins(env).includes(normalized) ? normalized : '';
}

// ── 허용 타겟 도메인 (Open Proxy 방지) ──────────────────────────
// index.html 실제 호출처와 동기화 (누락 시 CF Worker 경유 403 → 직접 호출 폴백, 설계 무산).
const ALLOWED_DOMAINS = [
  // Yahoo Finance
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finance.yahoo.com',
  // 뉴스/RSS
  'api.rss2json.com',
  'rss2json.com',
  // 주요 API
  'www.alphavantage.co',
  'api.twelvedata.com',
  'finnhub.io',
  'api.stlouisfed.org',
  'financialmodelingprep.com',
  'newsdata.io',
  // SEC
  'efts.sec.gov',
  'data.sec.gov',
  // Stooq
  'stooq.com',
  'www.stooq.com',
  // RSS 수집
  'rsshub.app',
  'nitter.net',
  't.me',
  // Naver 증권
  'm.stock.naver.com',
  'api.stock.naver.com',
  'polling.finance.naver.com',
  'api.finance.naver.com',
  'fchart.stock.naver.com',
  // Fear & Greed
  'api.fear-and-greed.com',
  'production.dataviz.cnn.io',
  'api.alternative.me',
  // 암호화폐
  'api.coingecko.com',
  // 환율
  'open.er-api.com',
  'api.exchangerate-api.com',
  // 옵션
  'cdn.cboe.com',
  // 번역
  'translate.googleapis.com',
  'translate.google.com',
];

// ── v56 /relay: 서버측 키 릴레이 ───────────────────────────────────────────
// P1422: FRED uses the user's explicitly consented personal header; BOK/KOSIS
// use operator secrets. Destinations are fixed and credentials never enter cache/logs.
// 업스트림 host/path는 아래 맵에 하드코딩되어 있어 클라이언트가 목적지를 지정할 수
// 없으므로 이 라우트는 SSRF 릴레이로 전용될 수 없다. 파라미터는 제공자별 정규식
// 화이트리스트로만 통과한다.
const RELAY_PROVIDERS = Object.freeze({
  fred: {
    keyHeader: 'X-AIO-Provider-Key',
    cacheTtl: 3600,
    params: {
      series_id: { required: true, re: /^[A-Za-z0-9._-]{1,32}$/ },
      sort_order: { re: /^(asc|desc)$/ },
      limit: { re: /^\d{1,4}$/ },
    },
    build(key, p) {
      const u = new URL('https://api.stlouisfed.org/fred/series/observations');
      u.searchParams.set('series_id', p.series_id);
      u.searchParams.set('api_key', key);
      u.searchParams.set('file_type', 'json');
      u.searchParams.set('sort_order', p.sort_order || 'desc');
      u.searchParams.set('limit', p.limit || '120');
      return u.toString();
    },
  },
  bok: {
    keyEnv: 'BOK_API_KEY',
    cacheTtl: 3600,
    params: {
      statCode: { required: true, re: /^[A-Za-z0-9]{1,12}$/ },
      cycle: { required: true, re: /^(D|M|Q|S|A)$/ },
      start: { required: true, re: /^\d{4,8}$/ },
      end: { required: true, re: /^\d{4,8}$/ },
      item: { re: /^[A-Za-z0-9]{1,12}$/ },
    },
    // ECOS는 키가 쿼리가 아니라 경로 세그먼트다 — 서버가 조립한다.
    build(key, p) {
      const item = p.item ? '/' + p.item : '';
      return `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/100/${p.statCode}/${p.cycle}/${p.start}/${p.end}${item}`;
    },
  },
  kosis: {
    keyEnv: 'KOSIS_API_KEY',
    cacheTtl: 3600,
    params: {
      itmId: { required: true, re: /^[A-Za-z0-9_]{1,16}$/ },
      objL1: { re: /^(ALL|[A-Za-z0-9_]{1,16})$/ },
      prdSe: { re: /^(M|Q|A)$/ },
      newEstPrdCnt: { re: /^\d{1,2}$/ },
      orgId: { required: true, re: /^\d{1,8}$/ },
      tblId: { required: true, re: /^[A-Za-z0-9_]{1,24}$/ },
    },
    build(key, p) {
      const u = new URL('https://kosis.kr/openapi/Param/statisticsParameterData.do');
      u.searchParams.set('method', 'getList');
      u.searchParams.set('apiKey', key);
      u.searchParams.set('itmId', p.itmId);
      u.searchParams.set('objL1', p.objL1 || 'ALL');
      u.searchParams.set('format', 'json');
      u.searchParams.set('jsonVD', 'Y');
      u.searchParams.set('prdSe', p.prdSe || 'M');
      u.searchParams.set('newEstPrdCnt', p.newEstPrdCnt || '3');
      u.searchParams.set('orgId', p.orgId);
      u.searchParams.set('tblId', p.tblId);
      return u.toString();
    },
  },
});

// The relay key is never logged or echoed. Upstream error bodies occasionally
// repeat the request URL, so redact the exact key value before returning bytes.
function redactRelayKey(text, key) {
  if (!key) return text;
  return String(text).split(key).join('***');
}

// ── 봇/스캐너 User-Agent 차단 ────────────────────────────────────
const BOT_UA_RE = /sqlmap|nikto|nmap|masscan|zgrab|nuclei|dirbuster|hydra|curl\/[0-9]|python-requests|go-http-client|java\/|wget\//i;
function isBotUA(ua) { return BOT_UA_RE.test(ua || ''); }

// ── 보안 응답 헤더 ────────────────────────────────────────────────
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
};

// ── Private IP 차단 (SSRF 방지) ─────────────────────────────────
function isPrivateHost(hostname) {
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|::1|fc00|fd00|fe80|localhost)/i.test(hostname)) {
    return true;
  }
  return false;
}

// P1413 (Codex structural review): one transport boundary for the relay and the generic proxy. The
// deadline covers the body as well as the headers, the size cap counts the bytes actually streamed
// (Content-Length is optional), and every redirect hop passes the same host policy before it is
// followed (fetch's default redirect follow never re-checked the destination).
const MAX_UPSTREAM_BYTES = 5 * 1024 * 1024;
const MAX_UPSTREAM_REDIRECTS = 3;
function transportError(code) { const error = new Error(code); error.code = code; return error; }

async function readUpstreamText(response, maxBytes = MAX_UPSTREAM_BYTES) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw transportError('too-large');
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw transportError('too-large');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch (_) {} throw transportError('too-large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function fetchUpstream(url, init, isAllowedUrl) {
  let current = String(url);
  for (let hop = 0; hop <= MAX_UPSTREAM_REDIRECTS; hop += 1) {
    const response = await fetch(current, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;
    const next = new URL(location, current);
    if (!isAllowedUrl(next)) throw transportError('redirect-refused');
    current = next.toString();
  }
  throw transportError('redirect-limit');
}

function transportFailureMessage(error) {
  return error?.name === 'AbortError' ? 'timeout' : error?.code === 'too-large' ? 'too-large' : error?.code === 'redirect-refused' || error?.code === 'redirect-limit' ? 'redirect-refused' : 'upstream-error';
}

function targetExpectsJson(parsedUrl) {
  const s = `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase();
  return /\/api\/|finance\/chart|query1\.finance\.yahoo\.com|query2\.finance\.yahoo\.com|m\.stock\.naver\.com|polling\.finance\.naver\.com|api\.stock\.naver\.com|production\.dataviz\.cnn\.io|api\.fear-and-greed\.com|api\.alternative\.me/.test(s);
}

function looksLikeHtml(text) {
  const t = String(text || '').trimStart();
  return /^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t) || /<title>.*(captcha|access denied|forbidden|blocked|error).*<\/title>/i.test(t.slice(0, 800));
}

// ── Rate Limiter ─────────────────────────────────────────────────
// NOTE: Worker isolate 간 Map 공유 불가. 단일 isolate 내 best-effort 방어.
// 완전한 레이트 리밋은 Cloudflare Rate Limiting Rules 또는 Durable Objects 필요.
// v52.47 WO-1B: map/limit을 인자로 받도록 일반화 — 데이터 프록시(300/분)와 /anthropic
// (훨씬 비싼 호출이라 20/분, 아래 별도 map)이 같은 로직을 공유하되 서로 다른 한도를 쓴다.
const rateLimitMap = new Map();
const RATE_LIMIT = 300; // 요청/분 — 데이터 프록시(GET)

const openAiRateLimitMap = new Map();
const OPENAI_RATE_LIMIT = 20; // 요청/분 — AI 호출은 데이터 프록시보다 훨씬 비쌈

const relayRateLimitMap = new Map();
const RELAY_RATE_LIMIT = 60; // 요청/분 — 운영자 키로 나가는 공유 쿼터 소비 경로

function checkRateLimit(ip, map, limit) {
  map = map || rateLimitMap;
  limit = limit || RATE_LIMIT;
  const now = Date.now();
  if (!map.has(ip)) {
    map.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  const record = map.get(ip);
  if (now > record.resetTime) {
    map.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

// ── Cloudflare 네이티브 레이트리밋 바인딩 (v56, P1157) ─────────────────────────
// 위 `Map` 은 isolate 로컬이라 실효 상한이 `limit × IP 수 × isolate 수`였다. 아래 바인딩은
// WAF 레이트리밋 규칙과 같은 인프라를 쓰므로 **한 Cloudflare 로케이션 안의 모든 isolate가
// 카운터를 공유**한다 — `workers.dev`에는 존이 없어 존 단위 WAF 규칙을 쓸 수 없으므로, 이
// 배포에서 쓸 수 있는 가장 강한 상한이다.
// 남는 한계는 정직하게 둘: 로케이션별(전역 아님)이고, 설계상 eventually consistent다.
// 즉 계정 시스템이 아니라 완충 장치이며, 전역 권위는 여전히 DO 일일 캡이다.
// 바인딩이 없으면(구버전 배포·`wrangler dev`·계정 미지원) isolate 로컬 Map으로 폴백해
// 이전 동작을 그대로 유지한다 — 조용히 열리지도, 이유 없이 막히지도 않게 한다.
async function enforceRateLimit(env, bindingName, fallbackMap, limit, key) {
  const bucket = String(key || 'unknown');
  const binding = env && env[bindingName];
  if (binding && typeof binding.limit === 'function') {
    try {
      const result = await binding.limit({ key: bucket });
      if (result && result.success === false) return false;
      if (result && result.success === true) return true;
    } catch (_) {
      // 폴백으로 내려간다 — 예외를 통과로도 거부로도 해석하지 않는다.
    }
  }
  return checkRateLimit(bucket, fallbackMap, limit);
}

// 오래된 항목 정리 (isolate 장기 유지 시 메모리 방어)
function cleanupRateLimitMap(map) {
  map = map || rateLimitMap;
  const now = Date.now();
  for (const [key, val] of map) {
    if (now > val.resetTime + 60000) map.delete(key);
  }
}

/** CORS 헤더 생성 — Origin 화이트리스트 적용 */
function getCorsHeaders(requestOrigin, env) {
  const origin = resolveAllowedOrigin(requestOrigin, env) || PRODUCTION_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AIO-App-Token, X-AIO-Idempotency-Key, X-AIO-Request-Id, X-AIO-Provider-Key',
    'Access-Control-Max-Age': '86400',
  };
}

/** 에러 응답 생성 — /anthropic은 브라우저와 공유하는 정규화된 AI 오류 envelope도 함께 반환 */
function errorResponse(message, status = 400, origin = '', aiContext = null, env = null) {
  const raw = String(message || 'Proxy request failed');
  const lower = raw.toLowerCase();
  let reason = 'unknown';
  let retryable = false;
  if (status === 408 || /timeout|timed out/i.test(lower)) { reason = 'timeout'; retryable = true; }
  else if (status === 429 || /rate|too many|한도/i.test(lower)) { reason = 'rate_limit'; retryable = true; }
  else if (status === 403 && /region|regional|location|country|hkg/i.test(lower)) { reason = 'regional_forbidden'; retryable = true; }
  else if (status === 401 || (status === 403 && /origin|token|key|auth|forbidden/i.test(lower))) reason = 'auth_or_origin';
  else if (status >= 500 || /upstream|kv|일시|중단/i.test(lower)) { reason = 'upstream_unavailable'; retryable = true; }
  const aioAiError = aiContext ? {
    code: 'AIO_AI_' + reason.toUpperCase(), kind: reason, status,
    source: aiContext.source || 'worker-openai', reason,
    rawMessage: raw.slice(0, 240), retryable, referenceOnly: true,
    userMessage: reason === 'rate_limit' ? 'AI 사용 한도에 도달했습니다.' : reason === 'timeout' ? 'AI 응답이 시간 초과되었습니다.' : reason === 'auth_or_origin' ? 'AI 인증 또는 허용 출처 확인이 필요합니다.' : reason === 'regional_forbidden' ? '현재 네트워크 지역에서 AI 요청이 거부되었습니다.' : 'AI 서버가 일시적으로 사용할 수 없습니다.',
    nextAction: /monthly|월.*예산|과거.*비용/i.test(raw) ? 'UTC 월 예산 상태와 공급자 Console 한도를 확인하세요. 반복 재시도로 예산이 복구되지 않습니다.' : reason === 'rate_limit' ? '1분 후 다시 시도하세요.' : reason === 'auth_or_origin' ? 'API 키·Worker URL·Origin 설정을 확인하세요.' : '잠시 후 다시 시도하세요.'
  } : undefined;
  const payload = { error: raw, status };
  if (aioAiError) payload.aioAiError = aioAiError;
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin, env),
        ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker',
      },
    }
  );
}

// P1421: shared OpenAI Responses gateway. SSE bytes are forwarded unchanged.
// DO admission and settlement are atomic across browser/automation concurrency.
// Public readiness is metadata-only: it reveals whether the Worker can serve
// AI traffic, never the secret itself or its value.
async function healthResponse(origin, env, method = 'GET') {
  const configured = !!(env && env.OPENAI_API_KEY);
  const quotaConfigured = hasAtomicQuotaBinding(env);
  const killSwitch = !!(env && env.AI_KILL_SWITCH === '1');
  let configurationValid = false;
  try { aiMonthlyBudgetMicroUsd(env); quotaInteger(env?.AI_DAILY_CAP, 300); quotaInteger(env?.AI_MAX_OUTPUT_TOKENS, 4000, 8192); configurationValid = true; } catch (_) {}
  let authority = { ready: false, jurisdiction: null, reason: 'us-authority-unavailable' };
  if (hasDurableObjectNamespace(env)) {
    try {
      const response = await aiAuthorityDurableObjectStub(env).fetch('https://aio-authority.internal/health');
      if (response.ok) authority = await response.json();
    } catch (_) {}
  }
  const authorityReady = authority?.ready === true && authority?.jurisdiction === 'us';
  const ready = configured && quotaConfigured && authorityReady && configurationValid && !killSwitch;
  const payload = {
    schemaVersion: 'aio-worker-health.v1',
    ok: true,
    service: 'aio-screener-worker',
    revision: env && env.AIO_APP_REVISION ? String(env.AIO_APP_REVISION) : null,
    sourceSha: env && env.AIO_SOURCE_SHA ? String(env.AIO_SOURCE_SHA) : null,
    ai: { configured, quotaConfigured, authorityReady, authorityJurisdiction: authority?.jurisdiction || null, configurationValid, killSwitch, ready, maxTokens: parseInt((env && env.AI_MAX_OUTPUT_TOKENS) || '4000', 10), provider: 'openai', model: OPENAI_MODEL,
      automationConfigured: typeof env?.AIO_AUTOMATION_TOKEN === 'string' && env.AIO_AUTOMATION_TOKEN.length >= 32 },
    // Presence only — never the relay key value.
    relay: {
      providers: Object.keys(RELAY_PROVIDERS),
      configured: Object.fromEntries(Object.entries(RELAY_PROVIDERS).map(([id, provider]) => [id, !!(env && env[provider.keyEnv])])),
      personalKeyRequired: ['fred'],
      quotaConfigured,
      dailyCap: parseInt((env && env.RELAY_DAILY_CAP) || '2000', 10),
      // Presence only. When false the token check is skipped entirely (fail-open), so an
      // operator can see from /health whether even the speed bump is in place. Neither this
      // nor the Origin allowlist authenticates a non-browser caller.
      appTokenRequired: !!(env && env.AIO_APP_TOKEN)
    },
    dataProxy: { ready: true }
  };
  return new Response(method === 'HEAD' ? null : JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin, env), ...SECURITY_HEADERS, 'Cache-Control': 'no-store', 'X-AIO-Proxy': 'cloudflare-worker-health' }
  });
}

function hasAtomicQuotaBinding(env) {
  const binding = env && env.AIO_QUOTA_DO;
  return !!binding && (
    (typeof binding.reserve === 'function' && typeof binding.release === 'function') ||
    typeof binding.jurisdiction === 'function'
  );
}

function hasDurableObjectNamespace(env) {
  const binding = env && env.AIO_QUOTA_DO;
  return !!binding && typeof binding.jurisdiction === 'function';
}

function aiAuthorityDurableObjectStub(env) {
  const binding = env && env.AIO_QUOTA_DO;
  if (!hasDurableObjectNamespace(env)) throw new Error('durable object namespace unavailable');
  const usNamespace = binding.jurisdiction('us');
  if (!usNamespace) throw new Error('US durable object jurisdiction unavailable');
  if (typeof usNamespace.getByName === 'function') return usNamespace.getByName('anthropic-authority-v1');
  if (typeof usNamespace.idFromName === 'function' && typeof usNamespace.get === 'function') {
    return usNamespace.get(usNamespace.idFromName('anthropic-authority-v1'));
  }
  throw new Error('US durable object namespace methods unavailable');
}

async function quotaRpc(env, operation, payload) {
  const binding = env && env.AIO_QUOTA_DO;
  if (!hasAtomicQuotaBinding(env)) throw new Error('atomic quota binding unavailable');
  if (typeof binding[operation] === 'function') return binding[operation](payload);
  const stub = aiAuthorityDurableObjectStub(env);
  const response = await stub.fetch('https://aio-quota.internal/' + operation, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('quota durable object ' + response.status);
  return response.json();
}

async function matchesOperatorToken(expected, supplied) {
  if (typeof expected !== 'string' || expected.length < 32 || typeof supplied !== 'string' || supplied.length < 32) return false;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  const encoder = new TextEncoder();
  const [expectedDigest, suppliedDigest] = await Promise.all([
    subtle.digest('SHA-256', encoder.encode(expected)),
    subtle.digest('SHA-256', encoder.encode(supplied))
  ]);
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function privateOperatorResponse(payload, status = 200) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

async function handleOperatorAiUsage(request, env) {
  const configuredToken = env?.AIO_OPERATOR_TOKEN;
  const suppliedToken = request.headers.get('X-AIO-Operator-Token');
  if (!await matchesOperatorToken(configuredToken, suppliedToken)) return privateOperatorResponse(null, 404);
  if (request.method !== 'GET') return privateOperatorResponse({ error: 'GET required' }, 405);
  if (!hasAtomicQuotaBinding(env)) return privateOperatorResponse({ error: 'usage source unavailable' }, 503);

  const usageDayUtc = new Date().toISOString().slice(0, 10);
  try {
    const cap = quotaInteger(env.AI_DAILY_CAP, 300);
    const monthlyCapMicroUsd = aiMonthlyBudgetMicroUsd(env);
    const usage = await quotaRpc(env, 'usage', { dayKey: `claude:${usageDayUtc}` });
    if (usage?.ok !== true || !Number.isSafeInteger(usage.requestCount) || usage.requestCount < 0
      || !Number.isSafeInteger(usage.monthlyReservedMicroUsd) || usage.monthlyReservedMicroUsd < 0) {
      return privateOperatorResponse({ error: 'usage source unavailable' }, 503);
    }
    return privateOperatorResponse({
      schemaVersion: 'aio-operator-ai-usage.v1',
      usageDayUtc,
      requestCount: usage.requestCount,
      anthropicDailyCap: cap,
      aiDailyCap: cap,
      provider: 'openai',
      model: OPENAI_MODEL,
      usageMonthUtc: usage.usageMonthUtc,
      monthlyReservedMicroUsd: usage.monthlyReservedMicroUsd,
      monthlyBudgetMicroUsd: monthlyCapMicroUsd,
      monthlyPastSpendUnknown: usage.monthlyPastSpendUnknown === true,
      accountingBasis: 'conservative-reservation-and-verified-usage-not-invoice',
      scope: 'all-AIO-browser-and-GitHub-Actions-through-shared-Worker'
    });
  } catch (_) {
    return privateOperatorResponse({ error: 'usage source unavailable' }, 503);
  }
}

async function deriveRequestId(request, bodyText) {
  const supplied = request.headers.get('X-AIO-Idempotency-Key') || request.headers.get('X-AIO-Request-Id');
  if (supplied && /^[A-Za-z0-9._:-]{8,160}$/.test(supplied)) return 'client:' + supplied;
  // Identical prompts are separate billable attempts unless the caller opts
  // into an explicit idempotency key. Hashing the body under-counted repeated
  // upstream spend while the provider was still called for every duplicate.
  if (typeof crypto.randomUUID === 'function') return 'attempt:' + crypto.randomUUID();
  const bytes = new TextEncoder().encode(`${Date.now()}:${Math.random()}:${bodyText.length}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'attempt:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

const QUOTA_STATE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

// Keep the established quota schema and DO identity across the provider migration.
// The persisted month ledger includes all previously reserved Anthropic spend.
const BUDGET_SCHEMA = 2;
const MONTH_RETENTION_MS = 70 * 24 * 60 * 60 * 1000;

// Keep the deadline and caller cancellation alive until the body is consumed.
// Fetch resolving only means headers arrived; an SSE body may still stall.
async function fetchOpenAiWithDeadline(apiKey, budget, callerSignal, settle) {
  const body = budget.body;
  const controller = new AbortController();
  let reader;
  let streamController;
  let finished = false;
  let timeout;
  const cleanup = () => {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', cancelFromCaller);
  };
  const abort = (reason) => {
    if (finished) return;
    finished = true;
    controller.abort(reason);
    if (streamController) streamController.error(reason);
    if (reader) void reader.cancel(reason).catch(() => {});
    cleanup();
  };
  const cancelFromCaller = () => abort(new DOMException('AI request cancelled', 'AbortError'));
  timeout = setTimeout(() => abort(new DOMException('OpenAI timeout', 'AbortError')), 60000);
  callerSignal?.addEventListener('abort', cancelFromCaller, { once: true });
  if (callerSignal?.aborted) cancelFromCaller();
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      // P1433: Cloudflare Workers reject redirect: 'error' with a TypeError before any request leaves
      // (live 2026-10-04: every /openai call failed in under 0.5 s). 'manual' plus refusing any 3xx keeps
      // the same "never follow a redirect with the key" guarantee.
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      void upstream.body?.cancel().catch(() => {});
      throw new TypeError('OpenAI redirect refused');
    }
    if (controller.signal.aborted) {
      void upstream.body?.cancel().catch(() => {});
      throw controller.signal.reason;
    }
    if (!upstream.body) { finished = true; cleanup(); return upstream; }
    const receipt = upstream.status === 200 ? createOpenAiReceiptObserver(upstream.headers.get('content-type')) : null;
    reader = upstream.body.getReader();
    const streamedBody = new ReadableStream({
      start(value) { streamController = value; },
      async pull(value) {
        try {
          const chunk = await reader.read();
          if (finished) return;
          if (chunk.done) {
            finished = true; cleanup();
            const amount = receipt ? verifiedOpenAiCharge(receipt.finish(), budget) : null;
            if (amount !== null) {
              try { await settle(amount); } catch (_) { /* Retain the safe reservation if settlement storage is unavailable. */ }
            }
            value.close();
          } else { receipt?.push(chunk.value); value.enqueue(chunk.value); }
        } catch (error) {
          if (!finished) { finished = true; cleanup(); value.error(error); }
        }
      },
      cancel(reason) {
        if (finished) return;
        finished = true;
        controller.abort(reason);
        cleanup();
        return reader.cancel(reason);
      },
    });
    return new Response(streamedBody, { status: upstream.status, headers: upstream.headers });
  } catch (error) { finished = true; cleanup(); throw error; }
}

/**
 * Single Durable Object quota authority. The state lock makes reserve/release
 * atomic across concurrent Worker requests; request IDs make retries idempotent.
 */
export class AIOQuotaDurableObject {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.counts = { schemaVersion: BUDGET_SCHEMA, days: {}, months: {}, reservations: {}, legacyUnknownMonths: {} };
  }

  async load() {
    const saved = await this.storage.get('quota-state');
    if (saved === undefined) return;
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!record(saved) || !record(saved.days) || !record(saved.reservations)) throw new Error('corrupt quota state');
    this.counts = saved;
    if (saved.schemaVersion !== BUDGET_SCHEMA) {
      // P1353: legacy request counters cannot reconstruct past monthly spend.
      // Never migrate an existing authority to a silently empty dollar ledger.
      if (saved.schemaVersion !== undefined || saved.months !== undefined) throw new Error('unsupported quota schema');
      const month = new Date().toISOString().slice(0, 7);
      this.counts = { ...saved, schemaVersion: BUDGET_SCHEMA, months: { [month]: 10000000 }, legacyUnknownMonths: { [month]: true } };
      await this.save();
    }
    if (!record(this.counts.months) || !record(this.counts.legacyUnknownMonths)) throw new Error('corrupt monthly quota state');
    for (const count of Object.values(this.counts.days)) if (!Number.isSafeInteger(count) || count < 0) throw new Error('corrupt daily quota count');
    for (const [month, amount] of Object.entries(this.counts.months)) {
      if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(amount) || amount < 0) throw new Error('corrupt monthly quota count');
    }
    const sums = {};
    for (const reservation of Object.values(this.counts.reservations)) {
      if (typeof reservation === 'number' && Number.isFinite(reservation) && reservation > 0) continue; // legacy/relay
      if (!record(reservation) || !Number.isFinite(reservation.createdAt) || typeof reservation.started !== 'boolean'
        || !Number.isSafeInteger(reservation.reservationMicroUsd) || reservation.reservationMicroUsd < 1
        || !Object.hasOwn(this.counts.months, reservation.monthKey)) throw new Error('corrupt reservation');
      if (reservation.settled !== undefined && (reservation.settled !== true || reservation.started !== true
        || !Number.isSafeInteger(reservation.originalReservationMicroUsd)
        || reservation.originalReservationMicroUsd < reservation.reservationMicroUsd)) throw new Error('corrupt settled reservation');
      sums[reservation.monthKey] = (sums[reservation.monthKey] || 0) + reservation.reservationMicroUsd;
    }
    for (const [month, sum] of Object.entries(sums)) if (sum > this.counts.months[month]) throw new Error('monthly ledger was reset or undercounts reservations');
    // P1433 (owner decision 2026-10-04): the P1353 migration blocks a month whose past spend the old
    // request counters cannot reconstruct. The owner may state that month's prior spend once through
    // AI_LEGACY_MONTH_ACK = "YYYY-MM:<micro-USD>"; the ledger then holds that amount plus every
    // reservation already recorded, the flag clears, and the monthly cap applies as usual. The value
    // is ignored for any other month and once the flag is gone.
    const ack = String(this.env?.AI_LEGACY_MONTH_ACK || '').match(/^(\d{4}-(?:0[1-9]|1[0-2])):(\d{1,8})$/);
    if (ack && this.counts.legacyUnknownMonths[ack[1]] === true) {
      const stated = Number(ack[2]);
      if (Number.isSafeInteger(stated) && stated <= 10000000) {
        this.counts.months[ack[1]] = Math.min(10000000, stated + (sums[ack[1]] || 0));
        delete this.counts.legacyUnknownMonths[ack[1]];
        await this.save();
      }
    }
    for (const [day, count] of Object.entries(this.counts.days)) {
      if (count > 0 && day.startsWith('claude:') && Date.parse(day.slice(7) + 'T00:00:00Z') >= Date.now() - QUOTA_STATE_RETENTION_MS
        && !Object.hasOwn(this.counts.months, day.slice(7, 14))) throw new Error('monthly ledger missing for existing AI usage');
    }
  }

  async save() { await this.storage.put('quota-state', this.counts); }

  prune(now = Date.now()) {
    let changed = false;
    const cutoff = now - QUOTA_STATE_RETENTION_MS;
    for (const [key, reservation] of Object.entries(this.counts.reservations || {})) {
      const reservedAt = typeof reservation === 'object' ? reservation.createdAt : reservation;
      const expiresBefore = typeof reservation === 'object' ? now - MONTH_RETENTION_MS : cutoff;
      if (Number(reservedAt) < expiresBefore) {
        delete this.counts.reservations[key];
        changed = true;
      }
    }
    for (const month of Object.keys(this.counts.months)) {
      const nextMonth = new Date(`${month}-01T00:00:00Z`);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      if (nextMonth.getTime() < now - MONTH_RETENTION_MS) {
        delete this.counts.months[month]; delete this.counts.legacyUnknownMonths[month]; changed = true;
      }
    }
    for (const dayKey of Object.keys(this.counts.days || {})) {
      const match = dayKey.match(/(\d{4}-\d{2}-\d{2})$/);
      if (match && Date.parse(`${match[1]}T00:00:00Z`) < cutoff) {
        delete this.counts.days[dayKey];
        changed = true;
      }
    }
    return changed;
  }

  async mutateQuota(operation, body) {
    let result;
    await this.state.blockConcurrencyWhile(async () => {
      await this.load();
      if (this.prune()) await this.save();
      const dayKey = String(body.dayKey || '');
      const requestId = String(body.requestId || '');
      const key = dayKey + ':' + requestId;
      if (operation === 'usage') {
        const day = dayKey.slice(7);
        const parsedDay = Date.parse(`${day}T00:00:00.000Z`);
        if (!/^claude:\d{4}-\d{2}-\d{2}$/.test(dayKey)
          || !Number.isFinite(parsedDay)
          || new Date(parsedDay).toISOString().slice(0, 10) !== day) {
          throw new Error('valid AI ledger UTC dayKey is required');
        }
        const requestCount = this.counts.days[dayKey] ?? 0;
        if (!Number.isSafeInteger(requestCount) || requestCount < 0) throw new Error('valid AI ledger quota count is required');
        const monthKey = day.slice(0, 7);
        result = { ok: true, requestCount, usageMonthUtc: monthKey,
          monthlyReservedMicroUsd: this.counts.months[monthKey] ?? 0,
          monthlyPastSpendUnknown: this.counts.legacyUnknownMonths[monthKey] === true };
        return;
      }
      if (!dayKey || !requestId) throw new Error('dayKey and requestId are required');
      if (operation === 'reserve') {
        if (this.counts.reservations[key]) {
          result = { ok: true, reserved: true, duplicate: true, count: this.counts.days[dayKey] || 0 };
          return;
        }
        const count = this.counts.days[dayKey] || 0;
        const cap = quotaInteger(body.cap, 300);
        const isAi = dayKey.startsWith('claude:');
        const monthKey = dayKey.slice(7, 14);
        if (isAi) {
          const day = dayKey.slice(7);
          const instant = Date.parse(`${day}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== day
            || !Number.isSafeInteger(body.reservationMicroUsd) || body.reservationMicroUsd < 1
            || !Number.isSafeInteger(body.monthlyCapMicroUsd) || body.monthlyCapMicroUsd < 0 || body.monthlyCapMicroUsd > 10000000) throw new Error('valid AI budget reservation required');
          const monthlyReservedMicroUsd = this.counts.months[monthKey] || 0;
          if (this.counts.legacyUnknownMonths[monthKey] || monthlyReservedMicroUsd + body.reservationMicroUsd > body.monthlyCapMicroUsd) {
            result = { ok: false, reserved: false, count, reason: this.counts.legacyUnknownMonths[monthKey] ? 'legacy-month-spend-unknown' : 'monthly-budget', monthlyReservedMicroUsd };
            return;
          }
        }
        if (count >= cap) {
          result = { ok: false, reserved: false, duplicate: false, count, reason: 'daily-cap' };
          return;
        }
        this.counts.days[dayKey] = count + 1;
        if (isAi) {
          this.counts.months[monthKey] = (this.counts.months[monthKey] || 0) + body.reservationMicroUsd;
          this.counts.reservations[key] = { createdAt: Date.now(), dayKey, monthKey, reservationMicroUsd: body.reservationMicroUsd, started: false };
        } else this.counts.reservations[key] = Date.now();
        await this.save();
        result = { ok: true, reserved: true, duplicate: false, count: count + 1 };
        return;
      }
      if (operation === 'release') {
        if (!this.counts.reservations[key]) {
          result = { ok: true, released: false, idempotent: true, count: this.counts.days[dayKey] || 0 };
          return;
        }
        const reservation = this.counts.reservations[key];
        // An upstream-started attempt may already be billed, even on timeout,
        // cancellation or 4xx/5xx. It must never replenish monthly headroom.
        if (typeof reservation === 'object' && reservation.started) {
          result = { ok: true, released: false, retained: true, count: this.counts.days[dayKey] || 0 };
          return;
        }
        if (typeof reservation === 'object') {
          this.counts.months[reservation.monthKey] -= reservation.reservationMicroUsd;
        }
        delete this.counts.reservations[key];
        this.counts.days[dayKey] = Math.max(0, Number(this.counts.days[dayKey] || 0) - 1);
        await this.save();
        result = { ok: true, released: true, idempotent: false, count: this.counts.days[dayKey] };
        return;
      }
      if (operation === 'start') {
        const reservation = this.counts.reservations[key];
        if (!reservation || typeof reservation !== 'object') throw new Error('budgeted AI reservation required');
        reservation.started = true;
        await this.save();
        result = { ok: true, started: true };
        return;
      }
      if (operation === 'settle') {
        const reservation = this.counts.reservations[key];
        if (!reservation || typeof reservation !== 'object' || !reservation.started) throw new Error('started AI reservation required');
        if (reservation.settled === true) { result = { ok: true, settled: false, duplicate: true }; return; }
        if (!Number.isSafeInteger(body.chargeMicroUsd) || body.chargeMicroUsd < 1 || body.chargeMicroUsd > reservation.reservationMicroUsd) throw new Error('verified charge exceeds reservation or is invalid');
        this.counts.months[reservation.monthKey] -= reservation.reservationMicroUsd - body.chargeMicroUsd;
        reservation.originalReservationMicroUsd = reservation.reservationMicroUsd;
        reservation.reservationMicroUsd = body.chargeMicroUsd;
        reservation.settled = true;
        await this.save();
        result = { ok: true, settled: true, chargeMicroUsd: body.chargeMicroUsd };
        return;
      }
      throw new Error('unsupported quota operation');
    });
    return result || { ok: false };
  }

  async fetch(request) {
    const operation = new URL(request.url).pathname.split('/').pop();
    const jurisdiction = this.state?.id?.jurisdiction || null;
    if (operation === 'health') {
      return Response.json({
        schemaVersion: 'aio-ai-authority-health.v1',
        ready: jurisdiction === 'us' && !!this.env?.OPENAI_API_KEY,
        jurisdiction,
        configured: !!this.env?.OPENAI_API_KEY,
      }, { status: 200 });
    }
    const body = await request.json();
    if (operation === 'usage') {
      if (jurisdiction !== 'us') return Response.json({ error: { type: 'authority_location_error', message: 'US AI authority required' } }, { status: 503 });
      const result = await this.mutateQuota('usage', body);
      return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    if (operation === 'proxy') {
      if (jurisdiction !== 'us') {
        return Response.json({ error: { type: 'authority_location_error', message: 'US AI authority required' } }, { status: 503 });
      }
      let budget, cap;
      try {
        budget = prepareOpenAiBudget(body.responseBody, this.env);
        cap = quotaInteger(this.env.AI_DAILY_CAP, 300);
      } catch (error) {
        return Response.json({ error: { type: 'budget_validation_error', message: error.message } }, { status: 400 });
      }
      const payload = { dayKey: 'claude:' + new Date().toISOString().slice(0, 10), cap, requestId: body.requestId,
        reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd };
      const upstream = await dispatchOpenAi(this.env, budget, payload, request.signal, (operation, value) => this.mutateQuota(operation, value));
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'X-AIO-Upstream-Authority': 'durable-object-us' } });
    }
    const result = await this.mutateQuota(operation, body);
    return Response.json(result || { ok: false }, { status: 200 });
  }
}

async function fetchOpenAiThroughDurableObject(env, payload, signal) {
  const stub = aiAuthorityDurableObjectStub(env);
  return stub.fetch('https://aio-quota.internal/proxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

// Relay failures and AI attempts stopped BEFORE dispatch may release. Once an
// AI request starts, its conservative monthly reservation is never refunded.
async function releaseQuota(env, dayKey, requestId) {
  if (!dayKey || !requestId) return;
  try {
    await quotaRpc(env, 'release', { dayKey, requestId });
  } catch (_) {
    // The atomic authority remains the source of truth.
  }
}

async function dispatchOpenAi(env, budget, payload, signal, rpc) {
  const reservation = await rpc('reserve', payload);
  if (!reservation?.ok || !reservation.reserved) {
    const message = reservation?.reason === 'legacy-month-spend-unknown'
      ? '이번 UTC 월의 과거 AI 비용을 확인할 수 없어 서버 AI를 보호 차단했습니다. 공급자 Console의 월 한도를 확인하세요.'
      : reservation?.reason === 'monthly-budget' ? '월 AI 예산의 보수적 예약 상한에 도달했습니다. 실제 청구액이 아니며 반복 재시도로 복구되지 않습니다.' : 'daily AI quota exceeded';
    return Response.json({ error: { type: 'rate_limit_error', message, quotaReason: reservation?.reason || 'quota-unavailable' } }, { status: 429 });
  }
  if (reservation.duplicate) return Response.json({ error: { type: 'idempotency_conflict', message: 'duplicate request is already reserved' } }, { status: 409 });
  if (signal?.aborted) {
    await rpc('release', payload);
    return Response.json({ error: { type: 'cancelled', message: 'AI request cancelled before upstream dispatch' } }, { status: 502 });
  }
  try { await rpc('start', payload); }
  catch (error) { await rpc('release', payload); throw error; }
  // P1433: a secret pasted with a trailing newline/space makes the Authorization header invalid and fetch
  // throws before any request leaves (live 2026-10-04: every call 502 in under 0.5 s). Trim it here.
  try { return await fetchOpenAiWithDeadline(String(env.OPENAI_API_KEY).trim(), budget, signal,
    chargeMicroUsd => rpc('settle', { ...payload, chargeMicroUsd })); }
  catch (error) {
    // The error class only (no message, no key material) so an operator can tell a local throw from a network failure.
    return Response.json({ error: { type: error.name === 'AbortError' ? 'timeout' : 'upstream_error', message: 'OpenAI upstream unavailable; monthly reservation retained', errorClass: String(error?.name || 'Error').slice(0, 40) } }, { status: 502 });
  }
}

// P1421: enforce the byte ceiling while reading, before allocating an arbitrary
// request.text() buffer. Content-Length is only an early refusal hint; the
// received stream must still obey the ceiling when that header is absent/false.
async function readBoundedAiRequestBody(request, maximumBytes) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw Object.assign(new Error('Invalid Content-Length'), { status: 400 });
    if (Number(declared) > maximumBytes) throw Object.assign(new Error('Request body too large'), { status: 413 });
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) {
        try { await reader.cancel('AI request body byte limit'); } catch (_) {}
        throw Object.assign(new Error('Request body too large'), { status: 413 });
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

/** Canonical, atomic /openai production handler. */
async function handleOpenAi(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  const aiError = { source: 'worker-openai' };
  if (request.method !== 'POST') return errorResponse('POST required for /openai', 405, origin, aiError, env);
  if (env?.AI_KILL_SWITCH === '1') return errorResponse('server AI mode disabled by kill switch', 503, origin, aiError, env);
  if (!env?.OPENAI_API_KEY) return errorResponse('server OpenAI key is not configured', 503, origin, aiError, env);
  if (origin) {
    if (!resolveAllowedOrigin(origin, env)) return errorResponse('Origin not allowed', 403, origin, aiError, env);
    if (env.AIO_APP_TOKEN && request.headers.get('X-AIO-App-Token') !== env.AIO_APP_TOKEN) return errorResponse('Forbidden', 403, origin, aiError, env);
  } else if (!await matchesOperatorToken(env.AIO_AUTOMATION_TOKEN, request.headers.get('X-AIO-Automation-Token'))) {
    return errorResponse('Authorized automation token required', 403, origin, aiError, env);
  }
  cleanupRateLimitMap(openAiRateLimitMap);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!await enforceRateLimit(env, 'RATE_LIMIT_OPENAI', openAiRateLimitMap, OPENAI_RATE_LIMIT, clientIp)) return errorResponse('Too many AI requests', 429, origin, aiError, env);
  if (!hasAtomicQuotaBinding(env)) return errorResponse('atomic AI quota is not configured', 503, origin, aiError, env);
  const maxBodyBytes = 200 * 1024;
  let bodyText;
  try { bodyText = await readBoundedAiRequestBody(request, maxBodyBytes); }
  catch (error) { return errorResponse(error.status === 413 ? 'Request body too large' : 'Failed to read request body', error.status === 413 ? 413 : 400, origin, aiError, env); }
  let body;
  try { body = JSON.parse(bodyText); } catch { return errorResponse('Invalid JSON body', 400, origin, aiError, env); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse('JSON object required', 400, origin, aiError, env);
  let cap, budget;
  try {
    cap = quotaInteger(env.AI_DAILY_CAP, 300);
    budget = prepareOpenAiBudget(body, env);
    body = budget.body;
  } catch (error) { return errorResponse(error.message, /configuration|monthly AI budget/.test(error.message) ? 503 : 400, origin, aiError, env); }
  const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
  const requestId = await deriveRequestId(request, bodyText);
  const maxTokens = body.max_output_tokens;
  if (hasDurableObjectNamespace(env)) {
    try {
      const upstream = await fetchOpenAiThroughDurableObject(env, { dayKey, cap, requestId, responseBody: body }, request.signal);
      return new Response(upstream.body, { status: upstream.status, headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-openai', 'X-AIO-Max-Tokens': String(maxTokens),
        'X-AIO-Upstream-Authority': upstream.headers.get('X-AIO-Upstream-Authority') || 'durable-object',
      }});
    } catch (error) {
      const detail = String(error && error.message || error && error.name || 'unknown').slice(0, 180);
      console.error('AI durable authority unavailable', detail);
      return errorResponse('AI durable authority unavailable', 503, origin, aiError, env);
    }
  }
  try {
    const upstream = await dispatchOpenAi(env, budget, { dayKey, cap, requestId,
      reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd }, request.signal, (operation, payload) => quotaRpc(env, operation, payload));
    return new Response(upstream.body, { status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
      'X-AIO-Proxy': 'cloudflare-worker-openai', 'X-AIO-Max-Tokens': String(maxTokens),
    }});
  } catch (error) {
    return errorResponse('AI quota unavailable', 503, origin, aiError, env);
  }
}

/**
 * Canonical /relay handler — server-side key relay for browser-blocked sources.
 * The operator owns the upstream key (validated against FRED/BOK/KOSIS terms);
 * the browser never sends or receives one. Guard order mirrors /openai:
 * Origin → app token → per-IP rate limit → provider+param validation → atomic
 * daily cap (fail-closed when unbound) → upstream fetch with size/HTML guards.
 */
async function handleRelay(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  if (request.method !== 'GET') return errorResponse('GET required for /relay', 405, origin);
  if (!resolveAllowedOrigin(origin, env)) return errorResponse('Origin not allowed', 403, origin);
  if (env.AIO_APP_TOKEN && request.headers.get('X-AIO-App-Token') !== env.AIO_APP_TOKEN) return errorResponse('Forbidden', 403, origin);
  cleanupRateLimitMap(relayRateLimitMap);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!await enforceRateLimit(env, 'RATE_LIMIT_RELAY', relayRateLimitMap, RELAY_RATE_LIMIT, clientIp)) return errorResponse('Too many relay requests', 429, origin, null, env);

  const url = new URL(request.url);
  const providerId = String(url.searchParams.get('provider') || '').toLowerCase();
  const provider = RELAY_PROVIDERS[providerId];
  if (!provider) return errorResponse('Unknown relay provider', 400, origin);

  // P1422: a browser FRED query uses its user's own key, never the operator's key.
  const key = providerId === 'fred' ? request.headers.get('X-AIO-Provider-Key') : env && env[provider.keyEnv];
  if (providerId === 'fred' && (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key))) return errorResponse('Personal FRED key required', 400, origin);
  if (!key) return errorResponse('Relay key is not configured for ' + providerId, 503, origin);

  const params = {};
  for (const [name, spec] of Object.entries(provider.params)) {
    const raw = url.searchParams.get(name);
    if (raw === null || raw === '') {
      if (spec.required) return errorResponse('Missing relay parameter: ' + name, 400, origin);
      continue;
    }
    if (!spec.re.test(raw)) return errorResponse('Invalid relay parameter: ' + name, 400, origin);
    params[name] = raw;
  }

  if (!hasAtomicQuotaBinding(env)) return errorResponse('Relay quota is not configured', 503, origin);
  const cap = Math.max(1, parseInt(env.RELAY_DAILY_CAP || '2000', 10));
  const dayKey = 'relay:' + providerId + ':' + new Date().toISOString().slice(0, 10);
  const requestId = 'relay:' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()) + ':' + Math.random());
  let ownedReservation = false;
  try {
    const reservation = await quotaRpc(env, 'reserve', { dayKey, cap, requestId });
    if (!reservation?.ok || !reservation.reserved) return errorResponse('Daily relay quota exceeded', 429, origin);
    ownedReservation = !reservation.duplicate;
  } catch { return errorResponse('Relay quota unavailable', 503, origin); }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const providerUrl = new URL(provider.build(key, params));
    let response;
    let rawBody;
    try {
      // A relay hop may only stay on the provider's own host over https; a personal FRED key
      // never follows a redirect (P1422).
      response = await fetchUpstream(providerUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json,text/plain,*/*', 'User-Agent': 'AIO-Screener-relay/1.0' },
        signal: controller.signal,
        cf: { cacheTtl: providerId === 'fred' ? 0 : provider.cacheTtl || 600 },
      }, (next) => providerId !== 'fred' && next.protocol === 'https:' && next.hostname === providerUrl.hostname);
      rawBody = await readUpstreamText(response);
    } finally {
      clearTimeout(timeoutId);
    }
    const body = redactRelayKey(rawBody, key);
    if (looksLikeHtml(body)) {
      if (ownedReservation) await releaseQuota(env, dayKey, requestId);
      return errorResponse('Upstream returned HTML block page', 502, origin);
    }
    if (response.status >= 400 && ownedReservation) await releaseQuota(env, dayKey, requestId);
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': providerId === 'fred' ? 'private, no-store' : `public, max-age=${provider.cacheTtl || 600}`,
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-relay',
        'X-AIO-Relay-Provider': providerId,
      },
    });
  } catch (error) {
    if (ownedReservation) await releaseQuota(env, dayKey, requestId);
    const kind = transportFailureMessage(error);
    return errorResponse(kind === 'timeout' ? 'Relay timeout' : kind === 'too-large' ? 'Response too large' : kind === 'redirect-refused' ? 'Relay redirect refused' : 'Relay upstream error', 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const _u = new URL(request.url);

    if (_u.pathname === '/_ops/ai-usage') return handleOperatorAiUsage(request, env);

    if (_u.pathname === '/health') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(requestOrigin, env) });
      if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('GET required for /health', 405, requestOrigin);
      return healthResponse(requestOrigin, env, request.method);
    }

    // P1421: AI provider route branches before the independent data proxy.
    if (_u.pathname === '/openai') return handleOpenAi(request, env, requestOrigin);
    // Retired route never sends an Anthropic request or spends outside the shared ledger.
    if (_u.pathname === '/anthropic' || _u.searchParams.get('anthropic') === '1') return errorResponse('AI provider migrated; use /openai', 410, requestOrigin);

    // v56: 서버측 키 릴레이 (GET /relay?provider=…). 클라이언트가 목적지를 지정하지
    // 않으므로 일반 ?url= 프록시의 도메인 화이트리스트 경로와 완전히 분리되어 있다.
    if (_u.pathname === '/relay') {
      return handleRelay(request, env, requestOrigin);
    }

    // OPTIONS 프리플라이트
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(requestOrigin, env) });
    }

    // GET 만 허용
    if (request.method !== 'GET') {
      return errorResponse('GET 요청만 지원됩니다', 405, requestOrigin);
    }

    // v56: 이 라우트에서 Origin 허용목록은 지금까지 403을 내지 않았다 — 어떤 ACAO 값을 돌려줄지
    // 고르는 데만 쓰였으므로, 비브라우저 클라이언트는 ALLOWED_DOMAINS 전체(약 35개 호스트)로 가는
    // 익명 릴레이로 이 Worker를 쓸 수 있었다. /openai·/relay와 동일하게 게이트로 강제한다.
    // (비브라우저 클라이언트는 Origin을 위조할 수 있으므로 이것은 인증이 아니라 최소 방어선이며,
    //  isolate 독립적인 실효 상한은 헤더에 적힌 Cloudflare WAF 레이트리밋 규칙뿐이다.)
    if (!resolveAllowedOrigin(requestOrigin, env)) {
      return errorResponse('Origin not allowed', 403, requestOrigin);
    }

    // 봇/스캐너 UA 차단
    const ua = request.headers.get('User-Agent') || '';
    if (isBotUA(ua)) {
      return errorResponse('Forbidden', 403, requestOrigin);
    }

    // 클라이언트 IP
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    // Rate limit 체크 + 정리 (v2.2: cleanup 호출이 주석에 붙어 미실행이던 버그 시정)
    cleanupRateLimitMap();
    if (!await enforceRateLimit(env, 'RATE_LIMIT_PROXY', rateLimitMap, RATE_LIMIT, clientIp)) {
      return errorResponse('Too many requests', 429, requestOrigin, null, env);
    }

    // URL 파라미터
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return errorResponse('url parameter required', 400, requestOrigin);
    }

    // URL 유효성
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); }
    catch { return errorResponse('Invalid URL', 400, requestOrigin); }

    // 프로토콜
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return errorResponse('Only http/https supported', 400, requestOrigin);
    }

    // SSRF: Private IP 차단
    if (isPrivateHost(parsedUrl.hostname)) {
      return errorResponse('Forbidden', 403, requestOrigin);
    }

    // 도메인 화이트리스트
    const targetHost = parsedUrl.hostname.toLowerCase();
    if (!ALLOWED_DOMAINS.some(d => targetHost === d || targetHost.endsWith('.' + d))) {
      return errorResponse('Domain not allowed', 403, requestOrigin);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // TTL: 뉴스/RSS 30분, FRED/MA 1시간, 시세/기타 2분
      const _host = parsedUrl.hostname;
      const _path = parsedUrl.pathname;
      const _isNews = /\/rss|\/feed|\.xml|\.rss|reuters|cnbc|bloomberg|wsj|nikkei|digitimes/i.test(_path + _host);
      const _isFred = /stlouisfed|fred/i.test(_host);
      const _cacheTtl = _isNews ? 1800 : _isFred ? 3600 : 120;

      const _expectsJson = targetExpectsJson(parsedUrl);
      const _isNaver = /(^|\.)naver\.com$/i.test(parsedUrl.hostname);
      const upstreamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 AIO-Screener/1.0',
        'Accept': _expectsJson ? 'application/json,text/plain,*/*' : '*/*',
      };
      if (_isNaver) {
        upstreamHeaders.Referer = 'https://m.stock.naver.com/';
        upstreamHeaders.Origin = 'https://m.stock.naver.com';
      }

      // P1413: every hop passes the same private-host and domain allowlist; the deadline and the 5MB
      // cap cover the streamed body.
      const allowedHop = (next) => ['http:', 'https:'].includes(next.protocol) && !isPrivateHost(next.hostname)
        && ALLOWED_DOMAINS.some(d => next.hostname.toLowerCase() === d || next.hostname.toLowerCase().endsWith('.' + d));
      let response;
      let data;
      try {
        response = await fetchUpstream(targetUrl, {
          method: 'GET',
          headers: upstreamHeaders,
          signal: controller.signal,
          cf: { cacheTtl: _cacheTtl },
        }, allowedHop);
        data = await readUpstreamText(response);
      } finally {
        clearTimeout(timeoutId);
      }
      const contentType = response.headers.get('content-type') || 'application/json';
      if (_expectsJson && looksLikeHtml(data)) {
        return errorResponse('Upstream returned HTML block page for JSON endpoint', 502, requestOrigin);
      }

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${_cacheTtl}`,
          ...getCorsHeaders(requestOrigin, env),
          ...SECURITY_HEADERS,
          'X-AIO-Proxy': 'cloudflare-worker',
          'X-AIO-Cache-TTL': String(_cacheTtl),
        },
      });
    } catch (error) {
      const kind = transportFailureMessage(error);
      const msg = kind === 'timeout' ? 'Request timeout' : kind === 'too-large' ? 'Response too large' : kind === 'redirect-refused' ? 'Redirect refused' : 'Upstream error';
      return errorResponse(msg, 502, requestOrigin);
    }
  },
};
