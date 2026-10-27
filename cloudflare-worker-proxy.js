import { OPENAI_MODEL, AI_MONTHLY_MAX_MICRO_USD, AI_MAX_OUTPUT_TOKENS_LIMIT, paidWebSearchEnabled, quotaInteger, aiMonthlyBudgetMicroUsd, prepareOpenAiBudget, verifiedOpenAiCharge } from './worker/openai-budget.mjs';
import { createOpenAiReceiptObserver } from './worker/openai-usage.mjs';
export { aiMonthlyBudgetMicroUsd, prepareOpenAiBudget } from './worker/openai-budget.mjs';
/**
 * AIO Screener CORS/data relay and shared GPT-6 Luna gateway.
 * Browser chat/translation and Actions analysis POST /openai through the same
 * atomic Durable Object. OPENAI_API_KEY stays in a Worker secret; no client key
 * route or direct Actions provider call belongs to the shared AI budget.
 * Required: OPENAI_API_KEY, AIO_QUOTA_DO. Actions additionally requires the
 * same 32+ character AIO_AUTOMATION_TOKEN in GitHub and Worker secrets.
 * AI_MONTHLY_BUDGET_USD defaults to $20 and accepts only $0-$20; AI_MONTHLY_BUDGET_MODE=target makes it a
 * target that is reported and alerted on but never refuses (v59.27, owner 2026-10-27). AI_DAILY_CAP
 * defaults to 300; AI_MAX_OUTPUT_TOKENS defaults to 4000 (up to 16384, v57.61).
 * P1759: AI_PER_CLIENT_DAILY_CAP (default 150, 1-1000, clamped to AI_DAILY_CAP) bounds each browser
 * connection per UTC day in the same DO admission; below 20% of the month hosted search is removed.
 * The stable anthropic-authority-v1 DO identity/claude: day keys intentionally
 * retain historical reservations. They identify the ledger, not the provider.
 * Text/function Responses and bounded opt-in web search share the ledger;
 * images/files/audio, previous-response IDs, fast/long-context inputs fail closed.
 * Successful verified usage settles conservatively (v57.62: searched answers too, at usage tokens plus
 * one fee per web_search_call item); missing/failed/cancelled receipts retain the full reserve. This ledger is not an account invoice: use
 * a dedicated OpenAI project/key exclusively through the shared Worker.
 * Browser Origin/app token is an abuse speed bump, not user authentication.
 * Missing Origin requires the private automation token and never bypasses quota.
 * Data proxy and /relay are independent; BOK_API_KEY and KOSIS_API_KEY
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
  // v57.81: Alpha Vantage, Twelve Data, Finnhub, FRED API, FMP, NewsData, Stooq and Nitter left the list.
  // Their personal-key and fallback clients were retired (v57.67-v57.79) and no browser path relays them;
  // Actions producers call providers directly. js/aio-data.js _AIO_SHARED_WORKER_HOSTS mirrors this list.
  // SEC
  'efts.sec.gov',
  'data.sec.gov',
  // RSS 수집
  'rsshub.app',
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
// BOK/KOSIS use operator secrets. v57.79: the personal-key FRED relay (P1422) had no
// client after v57.76 and was removed. Destinations are fixed and credentials never enter logs.
// 업스트림 host/path는 아래 맵에 하드코딩되어 있어 클라이언트가 목적지를 지정할 수
// 없으므로 이 라우트는 SSRF 릴레이로 전용될 수 없다. 파라미터는 제공자별 정규식
// 화이트리스트로만 통과한다.
const RELAY_PROVIDERS = Object.freeze({
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
// v58.82: the key also appears URL-encoded (searchParams.set percent-encodes '=', '+', '/'), so both forms are removed.
function redactRelayKey(text, key) {
  if (!key) return text;
  let out = String(text);
  for (const form of new Set([key, encodeURIComponent(key), new URLSearchParams({ k: key }).toString().slice(2)])) out = out.split(form).join('***');
  return out;
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

// Edge cache by upstream status: successes keep the route TTL, a 404 is held briefly, every other 4xx/5xx
// expires immediately (ranges kept disjoint so no precedence rule is assumed).
function edgeCacheTtlByStatus(ttl) {
  return { '200-299': ttl, '404': 30, '400-403': 0, '405-599': 0 };
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

// P1759: /health has its own lighter bucket. Sharing the data proxy's 300/min bucket meant a page's
// readiness polls and its market-data GETs competed, so a shared IP (office/mobile NAT) reached 429 on
// data sooner. The answer is memoized (authority 60 s, client budget 20 s), so an isolate-local bucket is
// enough; an operator may still bind RATE_LIMIT_HEALTH later without a code change.
const healthRateLimitMap = new Map();
const HEALTH_RATE_LIMIT = 120; // 요청/분 — /health 전용

// v57.61: an isolate-local bucket map is bounded. Past this many keys (a scan rotating addresses) expired
// entries are dropped first and, if that is not enough, the map is reset — a reset only forgets counts
// inside one isolate, while the binding and the DO caps stay the authority.
export const RATE_LIMIT_MAP_MAX_KEYS = 5000;
export function checkRateLimit(ip, map, limit) {
  map = map || rateLimitMap;
  limit = limit || RATE_LIMIT;
  const now = Date.now();
  if (!map.has(ip) && map.size >= RATE_LIMIT_MAP_MAX_KEYS) {
    cleanupRateLimitMap(map, true);
    if (map.size >= RATE_LIMIT_MAP_MAX_KEYS) map.clear();
  }
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
  // v57.61: IPv6 is bucketed per /64 (normalizeClientAddress), so rotating addresses inside one
  // allocation share one allowance instead of minting a fresh bucket per request.
  const bucket = normalizeClientAddress(key);
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
// Operator-visible denial reason (Workers logs). Route and reason only: never headers, keys, tokens or bodies.
function logDenial(route, reason) {
  console.warn({ route, reason });
}

function cleanupRateLimitMap(map, expiredNow = false) {
  map = map || rateLimitMap;
  const now = Date.now();
  const grace = expiredNow ? 0 : 60000;
  for (const [key, val] of map) {
    if (now > val.resetTime + grace) map.delete(key);
  }
}

/** CORS 헤더 생성 — Origin 화이트리스트 적용 */
function getCorsHeaders(requestOrigin, env) {
  const origin = resolveAllowedOrigin(requestOrigin, env) || PRODUCTION_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AIO-App-Token, X-AIO-Operator-Token, X-AIO-Idempotency-Key, X-AIO-Request-Id',
    'Access-Control-Max-Age': '86400',
    // The allowed origin is echoed per request; a shared cache must not serve one origin's ACAO to another.
    'Vary': 'Origin',
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
// /health is public and polled by every open page; the DO round trip it makes is memoized for 60 s per
// isolate (keyed by the binding so a different namespace never reads another's answer).
// P1759: only a ready answer is held for 60 s. A failed probe (brief DO glitch, cold start) is held for
// 5 s, so the AI route does not report not-ready for a whole minute after one transient error.
const AUTHORITY_HEALTH_MEMO_MS = 60000;
const AUTHORITY_HEALTH_FAILURE_MEMO_MS = 5000;
let authorityHealthMemo = null;
async function readAuthorityHealth(env) {
  const binding = env && env.AIO_QUOTA_DO;
  const now = Date.now();
  if (authorityHealthMemo && authorityHealthMemo.binding === binding && now - authorityHealthMemo.at < authorityHealthMemo.ttl) return authorityHealthMemo.value;
  let authority = { ready: false, jurisdiction: null, reason: 'us-authority-unavailable' };
  try {
    const response = await aiAuthorityDurableObjectStub(env).fetch('https://aio-authority.internal/health');
    if (response.ok) authority = await response.json();
  } catch (_) {}
  const healthy = authority?.ready === true && authority?.jurisdiction === 'us';
  authorityHealthMemo = { binding, at: now, ttl: healthy ? AUTHORITY_HEALTH_MEMO_MS : AUTHORITY_HEALTH_FAILURE_MEMO_MS, value: authority };
  return authority;
}

// P1759: coarse budget state plus the caller's own remaining daily questions. Memoized per (binding,
// client key) for 20 s; the fresh count also arrives on every /openai response header. Bounded memory.
const CLIENT_BUDGET_MEMO_MS = 20000;
const CLIENT_BUDGET_MEMO_MAX = 512;
const clientBudgetMemo = new WeakMap();
async function readClientBudgetStatus(env, clientIp) {
  const binding = env && env.AIO_QUOTA_DO;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const clientKey = await deriveClientKey(env, clientIp, day);
  const memoKey = clientKey || 'none';
  let memo = clientBudgetMemo.get(binding);
  if (!memo) { memo = new Map(); clientBudgetMemo.set(binding, memo); }
  const hit = memo.get(memoKey);
  if (hit && hit.day === day && now - hit.at < CLIENT_BUDGET_MEMO_MS) return hit.value;
  let value = null;
  try {
    const status = await quotaRpc(env, 'status', { dayKey: 'claude:' + day, monthlyCapMicroUsd: aiMonthlyBudgetMicroUsd(env),
      ...(clientKey ? { clientKey, clientCap: perClientDailyCap(env) } : {}) });
    if (status?.ok === true && AI_BUDGET_STATES.includes(status.budgetState)) value = status;
  } catch (_) {}
  if (memo.size >= CLIENT_BUDGET_MEMO_MAX) memo.clear();
  // A failed lookup is not memoized, mirroring the authority probe: the next poll retries.
  if (value) memo.set(memoKey, { day, at: now, value });
  return value;
}

async function healthResponse(origin, env, method = 'GET', appToken = '', clientIp = 'unknown') {
  const configured = !!(env && env.OPENAI_API_KEY);
  const quotaConfigured = hasAtomicQuotaBinding(env);
  const killSwitch = !!(env && env.AI_KILL_SWITCH === '1');
  let configurationValid = false;
  try { aiMonthlyBudgetMicroUsd(env); quotaInteger(env?.AI_DAILY_CAP, 300); quotaInteger(env?.AI_MAX_OUTPUT_TOKENS, 4000, AI_MAX_OUTPUT_TOKENS_LIMIT); perClientDailyCap(env); configurationValid = true; } catch (_) {}
  const authority = hasDurableObjectNamespace(env)
    ? await readAuthorityHealth(env)
    : { ready: false, jurisdiction: null, reason: 'us-authority-unavailable' };
  // Compared only when the caller sent a token; an absent header is simply "not accepted".
  const appTokenAccepted = !env?.AIO_APP_TOKEN || (!!appToken && await constantTimeTokenEquals(env.AIO_APP_TOKEN, appToken));
  const authorityReady = authority?.ready === true && authority?.jurisdiction === 'us';
  const ready = configured && quotaConfigured && authorityReady && configurationValid && !killSwitch;
  // P1759: coarse budget visibility only (never spend, cap or reservation amounts).
  const budgetStatus = method !== 'HEAD' && configured && configurationValid && authorityReady && hasDurableObjectNamespace(env)
    ? await readClientBudgetStatus(env, clientIp) : null;
  const budgetState = budgetStatus ? budgetStatus.budgetState : 'unknown';
  const budgetSaverActive = !aiBudgetIsTarget(env) && (budgetState === 'low' || budgetState === 'exhausted');
  const payload = {
    schemaVersion: 'aio-worker-health.v1',
    ok: true,
    service: 'aio-screener-worker',
    revision: env && env.AIO_APP_REVISION ? String(env.AIO_APP_REVISION) : null,
    sourceSha: env && env.AIO_SOURCE_SHA ? String(env.AIO_SOURCE_SHA) : null,
    ai: { configured, quotaConfigured, authorityReady, authorityJurisdiction: authority?.jurisdiction || null, configurationValid, killSwitch, ready, maxTokens: parseInt((env && env.AI_MAX_OUTPUT_TOKENS) || '4000', 10), provider: 'openai', model: OPENAI_MODEL,
      automationConfigured: typeof env?.AIO_AUTOMATION_TOKEN === 'string' && env.AIO_AUTOMATION_TOKEN.length >= 32,
      appTokenRequired: !!env?.AIO_APP_TOKEN,
      appTokenAccepted,
      paidWebSearchEnabled: paidWebSearchEnabled(env),
      // P1759: 'ok' | 'low' (<20% of the month left) | 'exhausted' | 'unknown'. In low/exhausted the Worker
      // removes hosted web search from new requests itself; webSearchAvailable is what a client should gate on.
      budgetState,
      budgetSaver: { active: budgetSaverActive, webSearch: !budgetSaverActive, label: budgetSaverActive ? AI_BUDGET_SAVER_LABEL : null },
      webSearchAvailable: paidWebSearchEnabled(env) && (budgetState === 'ok' || (aiBudgetIsTarget(env) && budgetState !== 'unknown')),
      budgetMode: aiBudgetIsTarget(env) ? 'target' : 'hard',
      client: budgetStatus && Number.isSafeInteger(budgetStatus.clientLimit)
        ? { dailyLimit: budgetStatus.clientLimit, remainingToday: budgetStatus.clientRemaining, resetsAt: budgetStatus.resetsAt, basis: 'utc-day-per-connection' }
        : null },
    // Presence only — never the relay key value.
    relay: {
      providers: Object.keys(RELAY_PROVIDERS),
      configured: Object.fromEntries(Object.entries(RELAY_PROVIDERS).map(([id, provider]) => [id, !!(env && env[provider.keyEnv])])),
      credentialModes: { bok: 'operator-secret', kosis: 'operator-secret' },
      quotaConfigured,
      dailyCap: parseInt((env && env.RELAY_DAILY_CAP) || '2000', 10),
      // Presence only. When false the token check is skipped entirely (fail-open), so an
      // operator can see from /health whether even the speed bump is in place. Neither this
      // nor the Origin allowlist authenticates a non-browser caller.
      appTokenRequired: !!(env && env.AIO_APP_TOKEN)
    },
    dataProxy: { ready: true },
    // v57.61: presence only. The deploy retries without the [ai] binding when the token lacks Workers AI
    // permission; this boolean shows whether headline translation can use the free path at all.
    workersAiBound: !!(env && env.AI)
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
  return constantTimeTokenEquals(expected, supplied);
}

// Fixed-length digest comparison: timing does not depend on where the supplied token first differs.
async function constantTimeTokenEquals(expected, supplied) {
  if (typeof expected !== 'string' || !expected || typeof supplied !== 'string' || !supplied) return false;
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

// v58.82 (owner 2026-10-26, roadmap 12): the in-app "이상해요" note. The repository and its Actions logs are public, so
// notes stay in the Worker (Durable Object) and only the operator token reads them. v59.10 (owner 2026-10-26: family codes
// removed): each connection may leave FEEDBACK_PER_MEMBER_DAY notes a UTC day, the newest FEEDBACK_KEEP stay.
const FEEDBACK_MAX_CHARS = 1000, FEEDBACK_KEEP = 300, FEEDBACK_PER_MEMBER_DAY = 10, FEEDBACK_RATE_LIMIT = 5;
const feedbackRateLimitMap = new Map();
async function handleFeedback(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  if (request.method !== 'POST') return errorResponse('POST required for /feedback', 405, origin, null, env);
  if (!resolveAllowedOrigin(origin, env)) return errorResponse('Origin not allowed', 403, origin, null, env);
  if (env.AIO_APP_TOKEN && !await constantTimeTokenEquals(env.AIO_APP_TOKEN, request.headers.get('X-AIO-App-Token'))) return errorResponse('Forbidden', 403, origin, null, env);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  cleanupRateLimitMap(feedbackRateLimitMap);
  if (!await enforceRateLimit(env, 'RATE_LIMIT_FEEDBACK', feedbackRateLimitMap, FEEDBACK_RATE_LIMIT, clientIp)) return errorResponse('Too many requests', 429, origin, null, env);
  if (!hasAtomicQuotaBinding(env)) return errorResponse('feedback store unavailable', 503, origin, null, env);
  let body;
  try { body = JSON.parse(await readBoundedAiRequestBody(request, 8 * 1024)); } catch { return errorResponse('Invalid JSON body', 400, origin, null, env); }
  const text = typeof body?.text === 'string' ? body.text.normalize('NFC').trim().slice(0, FEEDBACK_MAX_CHARS) : '';
  if (!text) return errorResponse('feedback text required', 400, origin, null, env);
  const route = typeof body.route === 'string' && /^[a-z][a-z0-9-]{0,30}(?:\/[A-Za-z0-9.^=-]{1,20})?$/.test(body.route) ? body.route : 'unknown';
  const version = typeof body.version === 'string' && /^v\d{1,3}\.\d{1,3}$/.test(body.version) ? body.version : null;
  // The day's connection id (an HMAC, never the address) lets the owner tell one sender's notes apart within a day.
  const member = (await deriveClientKey(env, clientIp, new Date().toISOString().slice(0, 10)) || '').slice(0, 8);
  if (!member) return errorResponse('feedback store unavailable', 503, origin, null, env);
  try {
    const saved = await quotaRpc(env, 'feedback-add', { item: { at: new Date().toISOString(), member, route, version, text } });
    if (saved?.ok !== true) return errorResponse('feedback daily limit reached', 429, origin, null, env);
  } catch { return errorResponse('feedback store unavailable', 503, origin, null, env); }
  return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin, env) } });
}

async function handleOperatorFeedback(request, env, origin) {
  // The owner reads notes in the app's connection panel, so a browser preflight is answered; everything else is 404
  // without the operator token, like /_ops/ai-usage.
  if (request.method === 'OPTIONS' && resolveAllowedOrigin(origin, env)) return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  if (!await matchesOperatorToken(env?.AIO_OPERATOR_TOKEN, request.headers.get('X-AIO-Operator-Token'))) return privateOperatorResponse(null, 404);
  if (request.method !== 'GET') return privateOperatorResponse({ error: 'GET required' }, 405);
  const cors = resolveAllowedOrigin(origin, env) ? getCorsHeaders(origin, env) : {};
  try {
    const listed = await quotaRpc(env, 'feedback-list', {});
    const response = privateOperatorResponse({ schemaVersion: 'aio-operator-feedback.v1', items: listed.items });
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  } catch { return privateOperatorResponse({ error: 'feedback store unavailable' }, 503); }
}

async function handleOperatorAiUsage(request, env) {
  const configuredToken = env?.AIO_OPERATOR_TOKEN;
  const suppliedToken = request.headers.get('X-AIO-Operator-Token');
  // v59.27: the automation token (already able to spend through /openai) may read these counters too, so the
  // weekly review needs no separate AIO_OPERATOR_TOKEN repository secret to see the month.
  const automationReader = !suppliedToken && await matchesOperatorToken(env?.AIO_AUTOMATION_TOKEN, request.headers.get('X-AIO-Automation-Token'));
  if (!automationReader && !await matchesOperatorToken(configuredToken, suppliedToken)) return privateOperatorResponse(null, 404);
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

// ── P1759: per-client daily AI admission + coarse budget state ──────────────────────────────────
// The global AI_DAILY_CAP and the monthly dollar ledger stay the authority. A browser connection also
// gets its own, lower UTC-day count so one client (Origin/app token are spoofable by curl) cannot burn
// the shared day or month. The count lives in the same DO ledger and is checked inside the same
// blockConcurrencyWhile transaction that admits the request. Authenticated GitHub Actions requests carry
// no client key and are not per-client limited (still global + monthly).
// The client key is HMAC-SHA256(secret, UTC day | address): raw IPs are never stored or sent to the DO,
// and the same address maps to unrelated keys on different days. IPv6 is grouped by /64 so rotating
// addresses inside one allocation does not mint new allowances.
const AI_FREE_RETRIES_PER_DAY = 20; // v57.61: retries of a counted question that do not use the connection's daily questions
const AI_PER_CLIENT_DAILY_CAP_DEFAULT = 150; // v57.54: a household shares one IP; half the 300/day global cap still stops one outsider draining it
const AI_PER_CLIENT_DAILY_CAP_MAX = 1000;
// 2026-10-18 review A1/A2: the per-connection cap above counts questions, not money. One connection inside its 200
// questions could reserve the whole $20 month (74 searched answers at the $0.27 upper bound, ~10 minutes at the
// 20/min rate limit), so a connection's reserved micro-USD per UTC day is also capped at 1/20 of the month. The
// reservation is the upper bound and settlement returns the unused part, so ordinary use stays far below it.
const AI_PER_CLIENT_MONTH_SHARE = 20;
// Entries <= admitted browser requests today <= AI_DAILY_CAP; this ceiling only binds if an operator raises
// AI_DAILY_CAP above it. A new client beyond it is refused (fail closed) rather than left uncounted.
const AI_CLIENT_LEDGER_MAX_ENTRIES = 2000;
const AI_CLIENT_KEY_RE = /^[0-9a-f]{32}$/;
const AI_BUDGET_STATES = ['ok', 'low', 'exhausted'];
// Below this headroom no ordinary answer fits (a short 4000-token answer reserves ~$0.003-0.01).
const AI_BUDGET_EXHAUSTED_FLOOR_MICRO_USD = 10000;
const AI_BUDGET_SAVER_LABEL = '예산 절약 모드 · 웹 검색 없이';
const AI_META_HEADERS = ['Retry-After', 'X-AIO-Budget-State', 'X-AIO-Budget-Saver', 'X-AIO-Web-Search-Removed', 'X-AIO-Client-Limit', 'X-AIO-Client-Remaining', 'X-AIO-Client-Reset'];

function perClientDailyCap(env) {
  return Math.min(quotaInteger(env?.AI_PER_CLIENT_DAILY_CAP, AI_PER_CLIENT_DAILY_CAP_DEFAULT, AI_PER_CLIENT_DAILY_CAP_MAX), quotaInteger(env?.AI_DAILY_CAP, 300));
}

function normalizeClientAddress(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!raw.includes(':')) return raw;
  const halves = raw.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length > 1 ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return groups.slice(0, 4).map(group => (parseInt(group, 16) || 0).toString(16)).join(':') + '::/64';
}

export async function deriveClientKey(env, address, day) {
  const secret = String(env?.AI_CLIENT_KEY_SALT || env?.OPENAI_API_KEY || '').trim();
  const subtle = globalThis.crypto?.subtle;
  if (!secret || !subtle || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return null;
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode('aio-client-key-v1|' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(day + '|' + normalizeClientAddress(address))));
  return Array.from(signature.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
}

function nextUtcDayStartMs(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

// v59.27 (owner 2026-10-27): "$20 and the daily caps are targets to keep, not hard stops — I top up the
// OpenAI balance when more is needed." AI_MONTHLY_BUDGET_MODE=target keeps the same ledger and budget
// state but never refuses, removes web search or splits the month per connection because of it; the
// weekly operations review raises the over-target alert. Unset (or 'hard') keeps the fail-closed bound.
const aiBudgetIsTarget = env => String(env?.AI_MONTHLY_BUDGET_MODE || '').trim().toLowerCase() === 'target';

function aiBudgetState(reservedMicroUsd, capMicroUsd, legacyUnknown) {
  const remaining = capMicroUsd - reservedMicroUsd;
  if (legacyUnknown || capMicroUsd <= 0 || remaining < AI_BUDGET_EXHAUSTED_FLOOR_MICRO_USD) return 'exhausted';
  return remaining * 5 < capMicroUsd ? 'low' : 'ok';
}

// The same request without hosted search: used only when the ledger says the month is low, decided inside
// the admission transaction (reserve), so the reservation and the dispatched body always agree.
function budgetSaverVariant(budget, env) {
  if (!(budget?.searchReserveMicroUsd > 0)) return null;
  const { tools, max_tool_calls: _maxToolCalls, tool_choice: _toolChoice, ...rest } = budget.body;
  const note = '\n[예산 절약 모드] 이번 답변은 웹 검색 없이 제공된 자료만으로 작성하세요. 최신 사실이 필요한데 자료에 없으면 확인되지 않았다고 밝히세요.';
  return prepareOpenAiBudget({ ...rest, instructions: (typeof rest.instructions === 'string' ? rest.instructions : '') + note }, env);
}

function aiAdmissionHeaders(reservation) {
  const headers = {};
  if (AI_BUDGET_STATES.includes(reservation?.budgetState)) {
    headers['X-AIO-Budget-State'] = reservation.budgetState;
    headers['X-AIO-Budget-Saver'] = reservation.budgetState === 'ok' || reservation.budgetTarget === true ? '0' : '1';
  }
  if (reservation?.budgetSaverApplied === true) headers['X-AIO-Web-Search-Removed'] = '1';
  if (Number.isSafeInteger(reservation?.clientLimit) && Number.isSafeInteger(reservation?.clientRemaining)) {
    headers['X-AIO-Client-Limit'] = String(reservation.clientLimit);
    headers['X-AIO-Client-Remaining'] = String(reservation.clientRemaining);
    headers['X-AIO-Client-Reset'] = new Date(nextUtcDayStartMs()).toISOString();
  }
  return headers;
}

function copyAiMetaHeaders(from) {
  const headers = {};
  for (const name of AI_META_HEADERS) { const value = from?.get?.(name); if (value) headers[name] = value; }
  return headers;
}

function withAiMetaHeaders(response, extra) {
  if (!extra || !Object.keys(extra).length) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// A hosted-search request or a long (> 4000-token, reasoning-inclusive) answer routinely needs more than a
// minute; cutting it at 60 s retained the whole reservation for an answer the caller never received. The
// Actions search client (scripts/lib/ai-shared-analysis.mjs) waits 115 s, inside this 120 s bound.
const OPENAI_DEADLINE_MS = 60000;
const OPENAI_LONG_DEADLINE_MS = 120000;
// v57.61: medium reasoning or a >8192-token answer (search included) needs more wall time than 120 s.
const OPENAI_DEEP_DEADLINE_MS = 180000;
function openAiDeadlineMs(budget) {
  if (budget?.body?.reasoning?.effort === 'medium' || Number(budget?.body?.max_output_tokens) > 8192) return OPENAI_DEEP_DEADLINE_MS;
  return (budget?.searchReserveMicroUsd > 0 || Number(budget?.body?.max_output_tokens) > 4000) ? OPENAI_LONG_DEADLINE_MS : OPENAI_DEADLINE_MS;
}

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
  timeout = setTimeout(() => abort(new DOMException('OpenAI timeout', 'AbortError')), openAiDeadlineMs(budget));
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
    // v58.82: an OpenAI error body (401 names the masked key's last characters, quota text names the organization) is
    // read within the same deadline and returned with key-shaped and org-shaped tokens removed.
    if (!upstream.ok) {
      const text = (await upstream.text()).slice(0, 8192).replace(/\bsk-[A-Za-z0-9_*-]{2,}/g, 'sk-***').replace(/\borg-[A-Za-z0-9]{6,}/g, 'org-***');
      finished = true; cleanup();
      return new Response(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
    }
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
    this.counts = { schemaVersion: BUDGET_SCHEMA, days: {}, months: {}, reservations: {}, legacyUnknownMonths: {}, clients: {}, clientSpend: {}, retryWaivers: {} };
    // Validated state stays in memory for this object's lifetime (every caller runs under
    // blockConcurrencyWhile, so there is one writer); a failed save drops it so the next call re-reads storage.
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    const saved = await this.storage.get('quota-state');
    if (saved === undefined) { this.loaded = true; return; }
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
    // P1759: per-client day counts are an abuse bound, not money. A missing or malformed map (older
    // ledger, unexpected shape) resets to empty instead of bricking AI; the global day/month caps still hold.
    const clientsValid = record(this.counts.clients) && Object.entries(this.counts.clients).every(([day, bucket]) => /^claude:\d{4}-\d{2}-\d{2}$/.test(day)
      && record(bucket) && Object.entries(bucket).every(([key, used]) => AI_CLIENT_KEY_RE.test(key) && Number.isSafeInteger(used) && used >= 0));
    if (!clientsValid) this.counts.clients = {};
    const spendValid = record(this.counts.clientSpend) && Object.entries(this.counts.clientSpend).every(([day, bucket]) => /^claude:\d{4}-\d{2}-\d{2}$/.test(day)
      && record(bucket) && Object.entries(bucket).every(([key, used]) => AI_CLIENT_KEY_RE.test(key) && Number.isSafeInteger(used) && used >= 0));
    if (!spendValid) this.counts.clientSpend = {};
    if (!record(this.counts.retryWaivers)) this.counts.retryWaivers = {}; // v57.61: bounded free retries per connection-day
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
      if (Number.isSafeInteger(stated) && stated <= AI_MONTHLY_MAX_MICRO_USD) {
        this.counts.months[ack[1]] = stated + (sums[ack[1]] || 0);
        delete this.counts.legacyUnknownMonths[ack[1]];
        await this.save();
      }
    }
    for (const [day, count] of Object.entries(this.counts.days)) {
      if (count > 0 && day.startsWith('claude:') && Date.parse(day.slice(7) + 'T00:00:00Z') >= Date.now() - QUOTA_STATE_RETENTION_MS
        && !Object.hasOwn(this.counts.months, day.slice(7, 14))) throw new Error('monthly ledger missing for existing AI usage');
    }
    this.loaded = true;
  }

  async save() {
    try { await this.storage.put('quota-state', this.counts); }
    catch (error) { this.loaded = false; throw error; }
  }

  // The whole ledger is one storage value, so it must stay bounded. A started or settled AI reservation can
  // never be released, and its amount already lives in months[monthKey]; past the 3-day idempotency window
  // it only answers duplicate request IDs, so it drops with the day counters. Dropping a row only lowers
  // the per-month reservation sums, so load()'s sums <= months check still holds. An un-started
  // reservation may still be released (its amount returned to the month), so it keeps the month-retention rule.
  refundClientSpend(reservation, amount) {
    const bucket = reservation?.spendKey ? this.counts.clientSpend?.[reservation.dayKey] : null;
    if (!bucket || !(bucket[reservation.spendKey] > 0) || !(amount > 0)) return;
    const left = bucket[reservation.spendKey] - amount;
    if (left > 0) bucket[reservation.spendKey] = left; else delete bucket[reservation.spendKey];
  }

  prune(now = Date.now()) {
    let changed = false;
    const cutoff = now - QUOTA_STATE_RETENTION_MS;
    for (const [key, reservation] of Object.entries(this.counts.reservations || {})) {
      const isAiRow = typeof reservation === 'object' && reservation !== null;
      const reservedAt = isAiRow ? reservation.createdAt : reservation;
      const expiresBefore = isAiRow && !reservation.started ? now - MONTH_RETENTION_MS : cutoff;
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
    // P1759: per-client counts expire at the UTC day boundary the ledger already uses.
    const currentClientDay = 'claude:' + new Date(now).toISOString().slice(0, 10);
    for (const day of Object.keys(this.counts.clients || {})) {
      if (day !== currentClientDay) { delete this.counts.clients[day]; changed = true; }
    }
    for (const day of Object.keys(this.counts.retryWaivers || {})) {
      if (day !== currentClientDay) { delete this.counts.retryWaivers[day]; changed = true; }
    }
    for (const day of Object.keys(this.counts.clientSpend || {})) {
      if (day !== currentClientDay) { delete this.counts.clientSpend[day]; changed = true; }
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

  // v58.82 (roadmap 12): feedback notes in their own bounded storage value, beside the quota ledger.
  async feedback(operation, body) {
    const stored = (await this.storage.get('feedback-v1')) || { items: [], perDay: {} };
    if (operation === 'feedback-list') return { ok: true, items: stored.items.slice(-FEEDBACK_KEEP).reverse() };
    const item = body?.item;
    if (!item || typeof item.text !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(String(item.at)) || !/^[0-9a-f]{8}$/.test(String(item.member))) throw new Error('valid feedback item required');
    const day = item.at.slice(0, 10), key = day + ':' + item.member;
    for (const k of Object.keys(stored.perDay)) if (!k.startsWith(day)) delete stored.perDay[k];
    if ((stored.perDay[key] || 0) >= FEEDBACK_PER_MEMBER_DAY) return { ok: false, reason: 'daily' };
    stored.perDay[key] = (stored.perDay[key] || 0) + 1;
    stored.items.push(item);
    if (stored.items.length > FEEDBACK_KEEP) stored.items.splice(0, stored.items.length - FEEDBACK_KEEP);
    await this.storage.put('feedback-v1', stored);
    return { ok: true };
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
      if (operation === 'status') {
        // P1759: read-only coarse state for /health. Never returns amounts.
        const day = dayKey.slice(7);
        const parsedDay = Date.parse(`${day}T00:00:00.000Z`);
        if (!/^claude:\d{4}-\d{2}-\d{2}$/.test(dayKey) || !Number.isFinite(parsedDay) || new Date(parsedDay).toISOString().slice(0, 10) !== day
          || !Number.isSafeInteger(body.monthlyCapMicroUsd) || body.monthlyCapMicroUsd < 0 || body.monthlyCapMicroUsd > AI_MONTHLY_MAX_MICRO_USD) throw new Error('valid AI budget status request required');
        const monthKey = day.slice(0, 7);
        result = { ok: true, budgetState: aiBudgetState(this.counts.months[monthKey] || 0, body.monthlyCapMicroUsd, this.counts.legacyUnknownMonths[monthKey] === true),
          resetsAt: new Date(parsedDay + 24 * 60 * 60 * 1000).toISOString() };
        if (body.clientKey !== undefined) {
          if (typeof body.clientKey !== 'string' || !AI_CLIENT_KEY_RE.test(body.clientKey)) throw new Error('valid client key required');
          const clientCap = quotaInteger(body.clientCap, AI_PER_CLIENT_DAILY_CAP_DEFAULT, AI_PER_CLIENT_DAILY_CAP_MAX);
          const used = this.counts.clients[dayKey]?.[body.clientKey] || 0;
          result.clientLimit = clientCap;
          result.clientRemaining = Math.max(0, clientCap - used);
        }
        return;
      }
      if (operation === 'feedback-add' || operation === 'feedback-list') { result = await this.feedback(operation, body); return; }
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
        let amount = body.reservationMicroUsd, budgetState = null, budgetSaverApplied = false, clientKey = null, clientCap = null, clientUsed = 0, waiverKey = null;
        const budgetTarget = isAi && aiBudgetIsTarget(this.env);
        if (isAi) {
          const day = dayKey.slice(7);
          const instant = Date.parse(`${day}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== day
            || !Number.isSafeInteger(body.reservationMicroUsd) || body.reservationMicroUsd < 1
            || !Number.isSafeInteger(body.monthlyCapMicroUsd) || body.monthlyCapMicroUsd < 0 || body.monthlyCapMicroUsd > AI_MONTHLY_MAX_MICRO_USD) throw new Error('valid AI budget reservation required');
          if (body.clientKey !== undefined && body.clientKey !== null) {
            if (typeof body.clientKey !== 'string' || !AI_CLIENT_KEY_RE.test(body.clientKey)) throw new Error('valid client key required');
            clientKey = body.clientKey;
            clientCap = quotaInteger(body.clientCap, AI_PER_CLIENT_DAILY_CAP_DEFAULT, AI_PER_CLIENT_DAILY_CAP_MAX);
            // v57.61: one question counts once. Its retries (<id>:retry1/2) reserve money and the global day as usual
            // but not the connection's daily questions when the same connection's counted original exists today.
            // The waiver is bounded per connection-day (AI_FREE_RETRIES_PER_DAY), so invented retry keys cannot multiply the cap.
            const retryBase = /^client:(.+):retry[12]$/.exec(String(requestId))?.[1];
            const waived = this.counts.retryWaivers?.[dayKey]?.[clientKey] || 0;
            if (retryBase && this.counts.reservations[dayKey + ':client:' + retryBase]?.clientKey === clientKey && waived < quotaInteger(this.env?.AI_FREE_RETRIES_PER_DAY, AI_FREE_RETRIES_PER_DAY, 100)) { waiverKey = clientKey; clientKey = null; }
          }
          const monthlyReservedMicroUsd = this.counts.months[monthKey] || 0;
          const legacyUnknown = this.counts.legacyUnknownMonths[monthKey] === true;
          budgetState = aiBudgetState(monthlyReservedMicroUsd, body.monthlyCapMicroUsd, legacyUnknown);
          // P1759: below 20% of the month, a searched request is admitted (if at all) as its no-search variant.
          if (!budgetTarget && budgetState !== 'ok' && Number.isSafeInteger(body.saverReservationMicroUsd) && body.saverReservationMicroUsd >= 1 && body.saverReservationMicroUsd < amount) {
            amount = body.saverReservationMicroUsd; budgetSaverApplied = true;
          }
          if (!budgetTarget && (legacyUnknown || monthlyReservedMicroUsd + amount > body.monthlyCapMicroUsd)) {
            result = { ok: false, reserved: false, count, reason: legacyUnknown ? 'legacy-month-spend-unknown' : 'monthly-budget', monthlyReservedMicroUsd, budgetState };
            return;
          }
        }
        if (count >= cap) {
          result = { ok: false, reserved: false, duplicate: false, count, reason: 'daily-cap', budgetState };
          return;
        }
        if (clientKey) {
          const bucket = this.counts.clients[dayKey] || {};
          clientUsed = bucket[clientKey] || 0;
          const ledgerFull = !Object.hasOwn(bucket, clientKey) && Object.keys(bucket).length >= AI_CLIENT_LEDGER_MAX_ENTRIES;
          if (clientUsed >= clientCap || ledgerFull) {
            result = { ok: false, reserved: false, duplicate: false, count, reason: 'client-daily-cap', budgetState, clientLimit: clientCap, clientRemaining: Math.max(0, clientCap - clientUsed) };
            return;
          }
        }
        // Retries waived from the question count still spend money, so the spend bound follows the connection either way.
        const spendKey = isAi ? (clientKey || waiverKey) : null;
        const clientSpent = spendKey ? this.counts.clientSpend?.[dayKey]?.[spendKey] || 0 : 0;
        // A connection's first reservation of the day is never refused by its share alone (the month bound above still
        // applies), so a small configured month cannot block every single answer.
        const clientShare = Math.floor(body.monthlyCapMicroUsd / AI_PER_CLIENT_MONTH_SHARE);
        // v58.82: a household shares one address, so three or four searched answers in flight at once (each reserving
        // the ~$0.27 upper bound until settlement) reach the share although real spend is far lower. The answer is then
        // admitted without web search when that variant fits, as in the month's saver mode, instead of being refused.
        if (!budgetTarget && spendKey && clientSpent > 0 && clientSpent + amount > clientShare && !budgetSaverApplied
          && Number.isSafeInteger(body.saverReservationMicroUsd) && body.saverReservationMicroUsd >= 1 && body.saverReservationMicroUsd < amount
          && clientSpent + body.saverReservationMicroUsd <= clientShare) {
          amount = body.saverReservationMicroUsd; budgetSaverApplied = true;
        }
        if (!budgetTarget && spendKey && clientSpent > 0 && clientSpent + amount > clientShare) {
          result = { ok: false, reserved: false, duplicate: false, count, reason: 'client-daily-cap', budgetState, clientSpendLimited: true };
          return;
        }
        this.counts.days[dayKey] = count + 1;
        if (isAi) {
          this.counts.months[monthKey] = (this.counts.months[monthKey] || 0) + amount;
          this.counts.reservations[key] = { createdAt: Date.now(), dayKey, monthKey, reservationMicroUsd: amount, started: false, ...(clientKey ? { clientKey } : {}), ...(spendKey ? { spendKey } : {}) };
          if (clientKey) (this.counts.clients[dayKey] ||= {})[clientKey] = clientUsed + 1;
          if (spendKey) ((this.counts.clientSpend ||= {})[dayKey] ||= {})[spendKey] = clientSpent + amount;
          if (waiverKey) { const waivers = ((this.counts.retryWaivers ||= {})[dayKey] ||= {}); waivers[waiverKey] = (waivers[waiverKey] || 0) + 1; }
          budgetState = aiBudgetState(this.counts.months[monthKey], body.monthlyCapMicroUsd, false);
        } else this.counts.reservations[key] = Date.now();
        await this.save();
        result = { ok: true, reserved: true, duplicate: false, count: count + 1 };
        if (isAi) {
          result.budgetState = budgetState;
          result.budgetSaverApplied = budgetSaverApplied;
          if (budgetTarget) result.budgetTarget = true;
          if (clientKey) { result.clientLimit = clientCap; result.clientRemaining = Math.max(0, clientCap - clientUsed - 1); }
        }
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
          // P1759: a pre-dispatch release also returns the client's daily question.
          const bucket = reservation.clientKey ? this.counts.clients[reservation.dayKey] : null;
          if (bucket && bucket[reservation.clientKey] > 0) {
            if (bucket[reservation.clientKey] === 1) delete bucket[reservation.clientKey];
            else bucket[reservation.clientKey] -= 1;
          }
          this.refundClientSpend(reservation, reservation.reservationMicroUsd);
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
        this.refundClientSpend(reservation, reservation.reservationMicroUsd - body.chargeMicroUsd);
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
      let budget, cap, clientCap;
      try {
        budget = prepareOpenAiBudget(body.responseBody, this.env);
        cap = quotaInteger(this.env.AI_DAILY_CAP, 300);
        clientCap = perClientDailyCap(this.env);
      } catch (error) {
        return Response.json({ error: { type: 'budget_validation_error', message: error.message } }, { status: 400 });
      }
      // P1759: the Worker sends only the HMAC client key (never the address); automation sends none.
      const clientKey = typeof body.clientKey === 'string' && AI_CLIENT_KEY_RE.test(body.clientKey) ? body.clientKey : null;
      const payload = { dayKey: 'claude:' + new Date().toISOString().slice(0, 10), cap, requestId: body.requestId,
        reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd,
        ...(clientKey ? { clientKey, clientCap } : {}) };
      const upstream = await dispatchOpenAi(this.env, budget, payload, request.signal, (operation, value) => this.mutateQuota(operation, value));
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'X-AIO-Upstream-Authority': 'durable-object-us', ...copyAiMetaHeaders(upstream.headers) } });
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
  // P1759: a searched request also offers its no-search price; the ledger picks one inside the admission
  // transaction (low/exhausted month -> no search) so the reservation always matches the dispatched body.
  let saver = null;
  try { saver = budgetSaverVariant(budget, env); } catch (_) { /* no cheaper variant fits: admit as requested or not at all */ }
  const reservation = await rpc('reserve', saver ? { ...payload, saverReservationMicroUsd: saver.reservationMicroUsd } : payload);
  if (!reservation?.ok || !reservation.reserved) {
    const reason = reservation?.reason || 'quota-unavailable';
    // v58.82: the spend share frees up as in-flight answers settle, so it is not a wait-until-midnight limit.
    const spendLimited = reason === 'client-daily-cap' && reservation?.clientSpendLimited === true;
    const daily = (reason === 'daily-cap' || reason === 'client-daily-cap') && !spendLimited;
    const resetMs = nextUtcDayStartMs();
    const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    const message = reason === 'legacy-month-spend-unknown'
      ? '이번 UTC 월의 과거 AI 비용을 확인할 수 없어 서버 AI를 보호 차단했습니다. 공급자 Console의 월 한도를 확인하세요.'
      : reason === 'monthly-budget' ? '월 AI 예산의 보수적 예약 상한에 도달했습니다. 실제 청구액이 아니며 반복 재시도로 복구되지 않습니다.'
      : reason === 'client-daily-cap' && reservation?.clientSpendLimited === true ? '이 연결의 오늘 AI 사용 금액 상한(월 예산의 1/20)에 도달했습니다. 진행 중인 답변이 끝나면 남은 예약분이 돌아오니 잠시 뒤 다시 시도하세요.'
      : reason === 'client-daily-cap' ? `이 연결의 오늘 AI 질문 한도(${Number.isSafeInteger(reservation?.clientLimit) ? reservation.clientLimit + '회' : '일일 한도'})를 모두 사용했습니다. UTC 자정(한국 시간 오전 9시)에 다시 사용할 수 있습니다.`
      : 'daily AI quota exceeded';
    logDenial('/openai', reason);
    return Response.json({ error: { type: 'rate_limit_error', code: reason, message, quotaReason: reason,
      ...(daily ? { retryAfterSeconds, resetAt: new Date(resetMs).toISOString() } : {}) } },
    { status: 429, headers: { ...aiAdmissionHeaders(reservation), ...(daily ? { 'Retry-After': String(retryAfterSeconds) } : spendLimited ? { 'Retry-After': '60' } : {}) } });
  }
  if (reservation.duplicate) return Response.json({ error: { type: 'idempotency_conflict', message: 'duplicate request is already reserved' } }, { status: 409 });
  if (reservation.budgetSaverApplied === true && saver) budget = saver;
  const meta = aiAdmissionHeaders(reservation);
  if (signal?.aborted) {
    await rpc('release', payload);
    return Response.json({ error: { type: 'cancelled', message: 'AI request cancelled before upstream dispatch' } }, { status: 502 });
  }
  try { await rpc('start', payload); }
  catch (error) { await rpc('release', payload); throw error; }
  // P1433: a secret pasted with a trailing newline/space makes the Authorization header invalid and fetch
  // throws before any request leaves (live 2026-10-04: every call 502 in under 0.5 s). Trim it here.
  try { return withAiMetaHeaders(await fetchOpenAiWithDeadline(String(env.OPENAI_API_KEY).trim(), budget, signal,
    chargeMicroUsd => rpc('settle', { ...payload, chargeMicroUsd })), meta); }
  catch (error) {
    // The error class only (no message, no key material) so an operator can tell a local throw from a network failure.
    return Response.json({ error: { type: error.name === 'AbortError' ? 'timeout' : 'upstream_error', message: 'OpenAI upstream unavailable; monthly reservation retained', errorClass: String(error?.name || 'Error').slice(0, 40) } }, { status: 502, headers: meta });
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
    if (env.AIO_APP_TOKEN && !await constantTimeTokenEquals(env.AIO_APP_TOKEN, request.headers.get('X-AIO-App-Token'))) return errorResponse('Forbidden', 403, origin, aiError, env);
  } else if (!await matchesOperatorToken(env.AIO_AUTOMATION_TOKEN, request.headers.get('X-AIO-Automation-Token'))) {
    return errorResponse('Authorized automation token required', 403, origin, aiError, env);
  }
  cleanupRateLimitMap(openAiRateLimitMap);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!await enforceRateLimit(env, 'RATE_LIMIT_OPENAI', openAiRateLimitMap, OPENAI_RATE_LIMIT, clientIp)) { logDenial('/openai', 'rate-limit'); return errorResponse('Too many AI requests', 429, origin, aiError, env); }
  if (!hasAtomicQuotaBinding(env)) return errorResponse('atomic AI quota is not configured', 503, origin, aiError, env);
  const maxBodyBytes = 200 * 1024;
  let bodyText;
  try { bodyText = await readBoundedAiRequestBody(request, maxBodyBytes); }
  catch (error) { return errorResponse(error.status === 413 ? 'Request body too large' : 'Failed to read request body', error.status === 413 ? 413 : 400, origin, aiError, env); }
  let body;
  try { body = JSON.parse(bodyText); } catch { return errorResponse('Invalid JSON body', 400, origin, aiError, env); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse('JSON object required', 400, origin, aiError, env);
  let cap, budget, clientCap;
  try {
    cap = quotaInteger(env.AI_DAILY_CAP, 300);
    clientCap = perClientDailyCap(env);
    budget = prepareOpenAiBudget(body, env);
    body = budget.body;
  } catch (error) { return errorResponse(error.message, /configuration|monthly AI budget/.test(error.message) ? 503 : 400, origin, aiError, env); }
  const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
  const requestId = await deriveRequestId(request, bodyText);
  const maxTokens = body.max_output_tokens;
  // P1759: browser (Origin) requests carry a per-connection HMAC key; authenticated automation does not.
  const clientKey = origin ? await deriveClientKey(env, clientIp, dayKey.slice(7)) : null;
  const clientFields = clientKey ? { clientKey, clientCap } : {};
  const exposeAiMeta = { 'Access-Control-Expose-Headers': ['X-AIO-Max-Tokens', ...AI_META_HEADERS].join(', ') };
  if (hasDurableObjectNamespace(env)) {
    try {
      const upstream = await fetchOpenAiThroughDurableObject(env, { dayKey, cap, requestId, responseBody: body, ...clientFields }, request.signal);
      return new Response(upstream.body, { status: upstream.status, headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS, ...exposeAiMeta, ...copyAiMetaHeaders(upstream.headers),
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
      reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd, ...clientFields }, request.signal, (operation, payload) => quotaRpc(env, operation, payload));
    return new Response(upstream.body, { status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      ...getCorsHeaders(origin, env), ...SECURITY_HEADERS, ...exposeAiMeta, ...copyAiMetaHeaders(upstream.headers),
      'X-AIO-Proxy': 'cloudflare-worker-openai', 'X-AIO-Max-Tokens': String(maxTokens),
    }});
  } catch (error) {
    return errorResponse('AI quota unavailable', 503, origin, aiError, env);
  }
}

/**
 * Canonical /relay handler — server-side key relay for browser-blocked sources.
 * The operator owns the upstream key (validated against BOK/KOSIS terms);
 * the browser never sends or receives one. Guard order mirrors /openai:
 * Origin → app token → per-IP rate limit → provider+param validation → atomic
 * daily cap (fail-closed when unbound) → upstream fetch with size/HTML guards.
 */
async function handleRelay(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  if (request.method !== 'GET') return errorResponse('GET required for /relay', 405, origin, null, env);
  if (!resolveAllowedOrigin(origin, env)) return errorResponse('Origin not allowed', 403, origin, null, env);
  if (env.AIO_APP_TOKEN && !await constantTimeTokenEquals(env.AIO_APP_TOKEN, request.headers.get('X-AIO-App-Token'))) return errorResponse('Forbidden', 403, origin, null, env);
  cleanupRateLimitMap(relayRateLimitMap);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!await enforceRateLimit(env, 'RATE_LIMIT_RELAY', relayRateLimitMap, RELAY_RATE_LIMIT, clientIp)) { logDenial('/relay', 'rate-limit'); return errorResponse('Too many relay requests', 429, origin, null, env); }

  const url = new URL(request.url);
  const providerId = String(url.searchParams.get('provider') || '').toLowerCase();
  const provider = RELAY_PROVIDERS[providerId];
  if (!provider) return errorResponse('Unknown relay provider', 400, origin, null, env);

  const key = env && env[provider.keyEnv];
  if (!key) return errorResponse('Relay key is not configured for ' + providerId, 503, origin, null, env);

  const params = {};
  for (const [name, spec] of Object.entries(provider.params)) {
    const raw = url.searchParams.get(name);
    if (raw === null || raw === '') {
      if (spec.required) return errorResponse('Missing relay parameter: ' + name, 400, origin, null, env);
      continue;
    }
    if (!spec.re.test(raw)) return errorResponse('Invalid relay parameter: ' + name, 400, origin, null, env);
    params[name] = raw;
  }

  if (!hasAtomicQuotaBinding(env)) return errorResponse('Relay quota is not configured', 503, origin, null, env);
  const cap = Math.max(1, parseInt(env.RELAY_DAILY_CAP || '2000', 10));
  const dayKey = 'relay:' + providerId + ':' + new Date().toISOString().slice(0, 10);
  const requestId = 'relay:' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()) + ':' + Math.random());
  let ownedReservation = false;
  try {
    const reservation = await quotaRpc(env, 'reserve', { dayKey, cap, requestId });
    if (!reservation?.ok || !reservation.reserved) { logDenial('/relay', reservation?.reason || 'daily-cap'); return errorResponse('Daily relay quota exceeded', 429, origin, null, env); }
    ownedReservation = !reservation.duplicate;
  } catch { return errorResponse('Relay quota unavailable', 503, origin, null, env); }

  let dispatched = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const providerUrl = new URL(provider.build(key, params));
    let response;
    let rawBody;
    try {
      // v58.63 (architecture audit SEC01/D4): once the request is sent the provider may have counted the key call, so an
      // uncertain failure after this point (stream cut, timeout, oversize) keeps the reservation — only a failure before
      // dispatch returns it. Releasing it let a provider that broke every body be called without bound under the cap.
      dispatched = true;
      // A relay hop may only stay on the provider's own host over https.
      response = await fetchUpstream(providerUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json,text/plain,*/*', 'User-Agent': 'AIO-Screener-relay/1.0' },
        signal: controller.signal,
        // Upstream errors are never cached at the edge (a 5xx or quota error must not pin for the full TTL).
        cf: { cacheTtlByStatus: edgeCacheTtlByStatus(provider.cacheTtl || 600) },
      }, (next) => next.protocol === 'https:' && next.hostname === providerUrl.hostname);
      rawBody = await readUpstreamText(response);
    } finally {
      clearTimeout(timeoutId);
    }
    const body = redactRelayKey(rawBody, key);
    // v57.61: an upstream that answered (>=400 or an HTML block page) still consumed an operator-key call, so the
    // reservation stays counted toward RELAY_DAILY_CAP; releasing it let a failing upstream be retried without bound.
    if (looksLikeHtml(body)) return errorResponse('Upstream returned HTML block page', 502, origin, null, env);
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': response.ok ? `public, max-age=${provider.cacheTtl || 600}` : 'no-store',
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-relay',
        'X-AIO-Relay-Provider': providerId,
      },
    });
  } catch (error) {
    if (ownedReservation && !dispatched) await releaseQuota(env, dayKey, requestId);
    const kind = transportFailureMessage(error);
    return errorResponse(kind === 'timeout' ? 'Relay timeout' : kind === 'too-large' ? 'Response too large' : kind === 'redirect-refused' ? 'Relay redirect refused' : 'Relay upstream error', 502, origin, null, env);
  }
}

// 2026-10-14 (owner: use Workers AI where it fits): headline translation runs on the account's Workers AI allowance
// (free daily neurons) instead of the shared OpenAI budget. Automation token only — browsers never reach it, so it
// cannot be spent from outside. Any failure (no binding, model error, unparsable output) returns 503 and the caller
// falls back to the shared OpenAI path; the response carries translations only, never a judgement.
// v57.63: the account answered 5018 "not allowed to access @cf/google/gemma-3-12b-it", so every free translation fell
// back to paid OpenAI. Models are tried in order and only an access/availability error moves to the next one.
export const WORKERS_AI_TRANSLATE_MODELS = Object.freeze(['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct-fast', '@cf/google/gemma-3-12b-it']);
export const WORKERS_AI_TRANSLATE_MODEL = WORKERS_AI_TRANSLATE_MODELS[0];
const workersAiModelUnavailable = (error) => /\b(5018|5007)\b|not allowed to access|no such model|model not found/i.test(String(error?.message || error));
// v57.61: at most 20 titles per call (callers chunk) so the reply fits max_tokens; a truncated reply used to
// surface as a count mismatch carrying model text. Error bodies carry short codes only — they are written to
// Actions logs by scripts/lib/ai-shared-analysis.mjs, so no model output and no exception message.
export const WORKERS_AI_TRANSLATE_MAX_TITLES = 20;
// Codex audit F18 (2026-10-15): Workers AI is billed outside the OpenAI reservation ledger (10,000 free neurons a day,
// overage on a paid plan), so it obeys the same operator stop and has its own per-minute ceiling: AI_KILL_SWITCH=1
// stops every AI path, and a runaway caller (a loop in a workflow) is cut at WORKERS_AI_TRANSLATE_PER_MINUTE calls.
export const WORKERS_AI_TRANSLATE_PER_MINUTE = 30;
const workersAiRateLimitMap = new Map();
async function handleWorkersAiTranslate(request, env) {
  // Token first: an anonymous caller sees 404 for every method, like /_ops/ai-usage.
  if (!await matchesOperatorToken(env?.AIO_AUTOMATION_TOKEN, request.headers.get('X-AIO-Automation-Token'))) return privateOperatorResponse(null, 404);
  if (request.method !== 'POST') return privateOperatorResponse({ error: 'post-required' }, 405);
  if (env?.AI_KILL_SWITCH === '1') return privateOperatorResponse({ error: 'kill-switch' }, 503);
  if (!await enforceRateLimit(env, 'RATE_LIMIT_WORKERS_AI', workersAiRateLimitMap, WORKERS_AI_TRANSLATE_PER_MINUTE, 'automation')) return privateOperatorResponse({ error: 'rate-limit' }, 429);
  if (!env?.AI || typeof env.AI.run !== 'function') return privateOperatorResponse({ error: 'workers-ai-unbound' }, 503);
  let titles;
  try {
    const body = JSON.parse(await readBoundedAiRequestBody(request, 32 * 1024));
    titles = Array.isArray(body?.titles) ? body.titles : null;
  } catch (error) {
    if (error?.status === 413) return privateOperatorResponse({ error: 'body-too-large' }, 413);
    titles = null;
  }
  if (!titles || !titles.length || titles.length > WORKERS_AI_TRANSLATE_MAX_TITLES || titles.some((title) => typeof title !== 'string' || !title.trim() || title.length > 300)) {
    return privateOperatorResponse({ error: 'titles-invalid', maxTitles: WORKERS_AI_TRANSLATE_MAX_TITLES, maxTitleLength: 300 }, 400);
  }
  const models = [...new Set([env.WORKERS_AI_TRANSLATE_MODEL, ...WORKERS_AI_TRANSLATE_MODELS].filter(Boolean))];
  let model = models[0];
  try {
    let result = null;
    for (const candidate of models) {
      model = candidate;
      try {
        result = await env.AI.run(model, { max_tokens: Math.min(2400, 400 + titles.length * 100), temperature: 0.1, messages: [
          { role: 'system', content: '너는 금융 뉴스 번역가다. 영어 헤드라인을 자연스러운 한국어 기사 제목으로 옮긴다. 고유명사·티커·숫자는 그대로 두고, 뜻을 더하거나 빼지 않는다. 출력은 JSON 문자열 배열 하나뿐이다.' },
          { role: 'user', content: `입력과 같은 순서로 정확히 ${titles.length}개를 JSON 배열로만 출력하라.\n${JSON.stringify(titles)}` }
        ] });
        break;
      } catch (error) {
        if (!workersAiModelUnavailable(error) || candidate === models[models.length - 1]) throw error;
      }
    }
    // v57.59: some Workers AI models hand back already-parsed JSON in `response`; a text reply is parsed from its array.
    const raw = result?.response;
    const text = String(typeof raw === 'string' ? raw : result?.choices?.[0]?.message?.content || '');
    let parsed = Array.isArray(raw) ? raw : null;
    if (!parsed) { try { parsed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch { parsed = null; } }
    if (!Array.isArray(parsed)) return privateOperatorResponse({ error: 'workers-ai-unparsed:not-array', model }, 503);
    if (parsed.length !== titles.length) return privateOperatorResponse({ error: 'workers-ai-unparsed:count-mismatch', model }, 503);
    const translations = parsed.map((item) => (typeof item === 'string' ? item.replace(/\s+/g, ' ').trim().slice(0, 200) : ''));
    // An empty or non-string item is a failed translation, not a blank title: fail so the caller falls back.
    if (translations.some((item) => !item)) return privateOperatorResponse({ error: 'workers-ai-unparsed:empty-item', model }, 503);
    return privateOperatorResponse({ model, translations });
  } catch (_) {
    return privateOperatorResponse({ error: 'workers-ai-failed', model }, 503);
  }
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const _u = new URL(request.url);

    if (_u.pathname === '/_ops/ai-usage') return handleOperatorAiUsage(request, env);
    if (_u.pathname === '/_ops/feedback') return handleOperatorFeedback(request, env, requestOrigin);
    if (_u.pathname === '/feedback') return handleFeedback(request, env, requestOrigin);
    if (_u.pathname === '/workers-ai/translate') return handleWorkersAiTranslate(request, env);

    if (_u.pathname === '/health') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(requestOrigin, env) });
      if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('GET required for /health', 405, requestOrigin, null, env);
      // P1759: /health reaches the Durable Object (memoized) and must not be a free amplifier, but it has its
      // own per-IP bucket so readiness polls never consume the data proxy's allowance.
      cleanupRateLimitMap(healthRateLimitMap);
      const healthClientIp = request.headers.get('cf-connecting-ip') || 'unknown';
      if (!await enforceRateLimit(env, 'RATE_LIMIT_HEALTH', healthRateLimitMap, HEALTH_RATE_LIMIT, healthClientIp)) {
        logDenial('/health', 'rate-limit');
        return errorResponse('Too many requests', 429, requestOrigin, null, env);
      }
      return healthResponse(requestOrigin, env, request.method, request.headers.get('X-AIO-App-Token') || '', healthClientIp);
    }

    // P1421: AI provider route branches before the independent data proxy.
    if (_u.pathname === '/openai') return handleOpenAi(request, env, requestOrigin);
    // Retired route never sends an Anthropic request or spends outside the shared ledger.
    if (_u.pathname === '/anthropic' || _u.searchParams.get('anthropic') === '1') return errorResponse('AI provider migrated; use /openai', 410, requestOrigin, null, env);

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
      return errorResponse('GET 요청만 지원됩니다', 405, requestOrigin, null, env);
    }

    // v56: 이 라우트에서 Origin 허용목록은 지금까지 403을 내지 않았다 — 어떤 ACAO 값을 돌려줄지
    // 고르는 데만 쓰였으므로, 비브라우저 클라이언트는 ALLOWED_DOMAINS 전체(v57.81 기준 24개 호스트)로 가는
    // 익명 릴레이로 이 Worker를 쓸 수 있었다. /openai·/relay와 동일하게 게이트로 강제한다.
    // (비브라우저 클라이언트는 Origin을 위조할 수 있으므로 이것은 인증이 아니라 최소 방어선이며,
    //  isolate 독립적인 실효 상한은 헤더에 적힌 Cloudflare WAF 레이트리밋 규칙뿐이다.)
    if (!resolveAllowedOrigin(requestOrigin, env)) {
      return errorResponse('Origin not allowed', 403, requestOrigin, null, env);
    }

    // 봇/스캐너 UA 차단
    const ua = request.headers.get('User-Agent') || '';
    if (isBotUA(ua)) {
      return errorResponse('Forbidden', 403, requestOrigin, null, env);
    }

    // 클라이언트 IP
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    // Rate limit 체크 + 정리 (v2.2: cleanup 호출이 주석에 붙어 미실행이던 버그 시정)
    cleanupRateLimitMap();
    if (!await enforceRateLimit(env, 'RATE_LIMIT_PROXY', rateLimitMap, RATE_LIMIT, clientIp)) {
      logDenial('/proxy', 'rate-limit');
      return errorResponse('Too many requests', 429, requestOrigin, null, env);
    }

    // URL 파라미터
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return errorResponse('url parameter required', 400, requestOrigin, null, env);
    }

    // URL 유효성
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); }
    catch { return errorResponse('Invalid URL', 400, requestOrigin, null, env); }

    // 프로토콜
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return errorResponse('Only http/https supported', 400, requestOrigin, null, env);
    }

    // SSRF: Private IP 차단
    if (isPrivateHost(parsedUrl.hostname)) {
      return errorResponse('Forbidden', 403, requestOrigin, null, env);
    }

    // 도메인 화이트리스트
    const targetHost = parsedUrl.hostname.toLowerCase();
    if (!ALLOWED_DOMAINS.some(d => targetHost === d || targetHost.endsWith('.' + d))) {
      return errorResponse('Domain not allowed', 403, requestOrigin, null, env);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // TTL: 뉴스/RSS 30분, 시세/기타 2분 (v57.81: the FRED API host left the allowlist, so its 1-hour tier went with it)
      const _host = parsedUrl.hostname;
      const _path = parsedUrl.pathname;
      const _isNews = /\/rss|\/feed|\.xml|\.rss|reuters|cnbc|bloomberg|wsj|nikkei|digitimes/i.test(_path + _host);
      const _cacheTtl = _isNews ? 1800 : 120;

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
          cf: { cacheTtlByStatus: edgeCacheTtlByStatus(_cacheTtl) },
        }, allowedHop);
        data = await readUpstreamText(response);
      } finally {
        clearTimeout(timeoutId);
      }
      const contentType = response.headers.get('content-type') || 'application/json';
      if (_expectsJson && looksLikeHtml(data)) {
        return errorResponse('Upstream returned HTML block page for JSON endpoint', 502, requestOrigin, null, env);
      }

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': response.ok ? `public, max-age=${_cacheTtl}` : 'no-store',
          ...getCorsHeaders(requestOrigin, env),
          ...SECURITY_HEADERS,
          'X-AIO-Proxy': 'cloudflare-worker',
          'X-AIO-Cache-TTL': String(_cacheTtl),
        },
      });
    } catch (error) {
      const kind = transportFailureMessage(error);
      const msg = kind === 'timeout' ? 'Request timeout' : kind === 'too-large' ? 'Response too large' : kind === 'redirect-refused' ? 'Redirect refused' : 'Upstream error';
      return errorResponse(msg, 502, requestOrigin, null, env);
    }
  },
};
