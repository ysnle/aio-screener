/**
 * AIO Screener CORS 프록시 — Cloudflare Workers
 * v2.2: P310 대량삭제(825d3c5)로 소실된 소스 복원 + 잠복 버그 수정
 *        (rateLimit 정리 호출이 주석에 붙어 미실행이던 것 시정).
 *        보안: Origin 화이트리스트, URL 도메인 화이트리스트, SSRF 차단, 타임아웃,
 *        봇/스캐너 UA 차단, 보안 응답 헤더.
 *
 * ※ 이 Worker는 기본적으로 "데이터(시세/뉴스/FRED 등) CORS 프록시"다. 개인 Claude 키를 쓰는
 *   사용자는 여전히 클라이언트가 api.anthropic.com에 직접 호출한다(이 Worker 미경유).
 *   v50.23부터 시세/매크로/F&G는 서버측 GitHub Actions(public-data/data.json)가 우선이고,
 *   이 Worker는 그 외 데이터(뉴스 RSS 등)의 브라우저 CORS 우회 레이어다.
 *   [v52.47 WO-1B 정정] 위 설명은 오래 전엔 사실이었으나 v50.52(B5)부터 "서버 키 모드"가 추가돼
 *   아래 POST /anthropic 라우트로 실제로 이 Worker를 경유하는 경로가 생겼다(개인 키가 없거나
 *   서버 모드 토글 시). 이 주석이 실제 코드와 어긋나 있던 것 자체가 WO-1B에서 발견된 문제였다.
 *
 * ── Cloudflare WAF Rate Limiting Rules (권장 — 코드 외부) ───────────────────
 * Workers > Zone > Security > WAF > Rate Limiting Rules:
 *   조건: (http.request.uri.path contains "/") AND (ip.src ne <allowlist>)
 *   속도: 300 req/1 min per IP / 동작: Block(429) 또는 Challenge
 *   → isolate 간 공유 문제 없이 완전한 레이트 리밋 적용.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * 배포 방법:
 * 1. https://workers.cloudflare.com 접속 + 무료 계정
 * 2. "새 Worker 만들기" → 아래 코드 전체 복사/붙여넣기 → "배포"
 * 3. 워커 URL 복사 (예: https://aio-proxy.username.workers.dev)
 * 4. AIO Screener 사이드바 "CF Worker URL"에 붙여넣기
 *
 * ── v50.52 B5 / v52.47 WO-1B: Claude(AI 채팅) 서버 키 모드 (선택 — 사용자가 키 입력 없이 AI 채팅) ──
 * 운영자만 1회 설정하면 모든 사용자가 개인 Claude 키 없이 AI 채팅 사용(키는 서버 시크릿).
 *   1) 위 Worker 배포 후 → Worker 설정(Settings) → Variables and Secrets:
 *        - Secret 추가(필수): 이름 ANTHROPIC_API_KEY, 값 = 운영자 Anthropic API 키
 *        - (선택) 변수 ANTHROPIC_DAILY_CAP (기본 300), ANTHROPIC_MAX_TOKENS (기본 1500)
 *        - (선택, WO-1B) 변수 AIO_APP_TOKEN — 값은 반드시 클라이언트(js/aio-chat.js
 *          `_aioAppToken()`)와 동일한 문자열로 설정. 미설정 시 이 검사는 건너뜀(기존 배포
 *          하위호환 — 갑자기 막히지 않음). 설정 시 이 헤더 없는 curl 등 단순 남용 차단.
 *          공개 클라이언트 JS에 그대로 노출되는 값이라 진짜 비밀은 아님 — "URL만 아는" 수준의
 *          자동화 남용을 거르는 최소 방어선일 뿐, 소스를 직접 읽는 공격자는 우회 가능(WO-1B 한계).
 *        - (선택, WO-1B) 변수 ANTHROPIC_KILL_SWITCH = '1' — 값을 실제 API 키를 지우지 않고도
 *          /anthropic 라우트 전체를 즉시 차단하고 싶을 때(예: 남용 급증 대응) 사용.
 *   2) (v52.47부터 필수 — WO-1B fail-closed) 일일 캡 강제용 KV Namespace 생성 → Worker에
 *        바인딩 이름 AIO_QUOTA 로 추가. **KV 미바인딩이면 서버 키 모드 자체가 503으로 비활성화된다**
 *        (v52.46 이전엔 캡 없이 그냥 통과하는 fail-open이었음 — 무제한 비용 노출 방지를 위해 정책
 *        변경). 개인 Claude 키 입력 경로는 KV와 무관하게 항상 정상 동작.
 *   3) 사이트에서: 사이드바 "CF Worker URL" 입력 + localStorage 'aio_claude_server_mode'='1'
 *        (개인 키를 입력하면 개인 키가 우선 — 서버 키는 개인 키 없을 때/서버모드 토글 시 사용)
 * 비용 보호: 모델 haiku/sonnet만 허용(opus 차단), max_tokens 상한, 일일 호출 캡.
 */

// ── 허용 Origin (CORS) ──────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://ysnle.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

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

const anthropicRateLimitMap = new Map();
const ANTHROPIC_RATE_LIMIT = 20; // 요청/분 — AI 호출은 데이터 프록시보다 훨씬 비쌈

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

// 오래된 항목 정리 (isolate 장기 유지 시 메모리 방어)
function cleanupRateLimitMap(map) {
  map = map || rateLimitMap;
  const now = Date.now();
  for (const [key, val] of map) {
    if (now > val.resetTime + 60000) map.delete(key);
  }
}

/** CORS 헤더 생성 — Origin 화이트리스트 적용 */
function getCorsHeaders(requestOrigin) {
  let normalizedOrigin;
  try { normalizedOrigin = new URL(requestOrigin).origin; } catch { normalizedOrigin = ''; }
  const origin = ALLOWED_ORIGINS.includes(normalizedOrigin) ? normalizedOrigin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, X-AIO-App-Token', // v52.47 WO-1B: 신규 앱 토큰 헤더 — 없으면 브라우저 CORS 프리플라이트가 이 헤더 전송 자체를 차단
    'Access-Control-Max-Age': '86400',
  };
}

/** 에러 응답 생성 — /anthropic은 브라우저와 공유하는 정규화된 AI 오류 envelope도 함께 반환 */
function errorResponse(message, status = 400, origin = '', aiContext = null) {
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
    source: aiContext.source || 'worker-anthropic', reason,
    rawMessage: raw.slice(0, 240), retryable, referenceOnly: true,
    userMessage: reason === 'rate_limit' ? 'AI 사용 한도에 도달했습니다.' : reason === 'timeout' ? 'AI 응답이 시간 초과되었습니다.' : reason === 'auth_or_origin' ? 'AI 인증 또는 허용 출처 확인이 필요합니다.' : reason === 'regional_forbidden' ? '현재 네트워크 지역에서 AI 요청이 거부되었습니다.' : 'AI 서버가 일시적으로 사용할 수 없습니다.',
    nextAction: reason === 'rate_limit' ? '1분 후 다시 시도하세요.' : reason === 'auth_or_origin' ? 'API 키·Worker URL·Origin 설정을 확인하세요.' : '잠시 후 다시 시도하세요.'
  } : undefined;
  const payload = { error: raw, status };
  if (aioAiError) payload.aioAiError = aioAiError;
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
        ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker',
      },
    }
  );
}

// ── v50.52 B5 / v52.47 WO-1B: Claude(Anthropic) 서버 키 프록시 ──────────────────────
// 운영자 시크릿(env.ANTHROPIC_API_KEY)으로 호출 → 사용자는 개인 키 입력 불요.
// 비용/남용 보호(WO-1B 강화): kill switch → Origin 서버측 강제 → 앱 토큰(선택) →
// IP당 20회/분 레이트리밋 → 일일 캡(KV 필수, fail-closed) → body 크기 상한 → 모델
// allowlist(haiku/sonnet, opus 차단) → max_tokens 상한. 스트리밍 지원(SSE 그대로 파이프).
// [WO-1B 한계 — 정직하게 기록] 정적 사이트+무료 Workers 구조상 진짜 호출자 인증은 불가능하다.
// 앱 토큰은 공개 클라이언트 JS에 그대로 노출되므로 "URL만 알고 curl로 두드리는" 자동화
// 남용은 막지만, 공개 소스를 직접 읽는 작정한 공격자는 우회할 수 있다 — Codex 자체도 이 구조적
// 한계를 명시했다(진짜 해결은 사용자 계정/OAuth 백엔드가 필요한데 정적 배포 전제와 맞지 않는다).
// [HKG/B8] Cloudflare 무료 플랜 anycast가 홍콩(HKG) 리전으로 라우팅하면 Anthropic이 지역 정책상
// 403을 반환하는 사례가 있다(레포/시크릿 문제 아님, `_context/DEFERRED-BLOCKS.md` B8). 이 Worker
// 코드로는 우회 불가 — 클라이언트(`js/aio-chat.js` `_aioFetchClaudeWithRetry`)가 같은 403 forbidden
// 포맷일 때만 즉시 재시도해 다른(정상) 엣지로 재라우팅되길 기대하는 완화책을 이미 구현 중(v52.44).
async function handleAnthropic(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  const aiError = { source: 'worker-anthropic' };
  if (request.method !== 'POST') return errorResponse('POST required for /anthropic', 405, origin, aiError);

  // Kill switch — 실제 API 키를 지우지 않고도 대시보드 변수 하나로 즉시 전체 차단(남용 급증 대응용).
  if (env && env.ANTHROPIC_KILL_SWITCH === '1') return errorResponse('서버 키 모드 일시 중단(운영자 kill switch 활성) — 개인 Claude 키를 입력하세요', 503, origin, aiError);
  if (!env || !env.ANTHROPIC_API_KEY) return errorResponse('서버 Claude 키 미설정 (운영자가 ANTHROPIC_API_KEY 시크릿 추가 필요)', 503, origin, aiError);

  // Origin 서버측 강제(WO-1B) — 기존엔 CORS 헤더만 발급하고 실제로 거부하지 않았다.
  // CORS는 브라우저가 응답을 "읽지" 못하게 할 뿐 서버로의 요청 자체는 막지 않으므로(curl은 CORS의
  // 적용을 받지 않음), 이 검사가 진짜 방어선은 아니지만 Origin 헤더조차 안 보내는 단순 curl/스크립트
  // 남용은 차단한다.
  let _normalizedOrigin;
  try { _normalizedOrigin = new URL(origin).origin; } catch { _normalizedOrigin = ''; }
  if (!ALLOWED_ORIGINS.includes(_normalizedOrigin)) return errorResponse('Origin not allowed', 403, origin, aiError);

  // 앱 토큰(WO-1B, 선택) — env.AIO_APP_TOKEN 미설정이면 기존 배포 하위호환을 위해 건너뜀.
  if (env.AIO_APP_TOKEN) {
    const _sentToken = request.headers.get('X-AIO-App-Token') || '';
    if (_sentToken !== env.AIO_APP_TOKEN) return errorResponse('Forbidden', 403, origin, aiError);
  }

  // IP당 레이트리밋(WO-1B) — 기존엔 /anthropic이 일반 프록시의 checkRateLimit을 완전히 우회했다.
  const _clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  cleanupRateLimitMap(anthropicRateLimitMap);
  if (!checkRateLimit(_clientIp, anthropicRateLimitMap, ANTHROPIC_RATE_LIMIT)) {
    return errorResponse('Too many AI requests — 잠시 후 다시 시도하세요', 429, origin, aiError);
  }

  // 일일 호출 캡 — v52.47부터 KV 필수(fail-closed). 미바인딩이면 무제한 비용 노출 상태로
  // 조용히 통과시키는 대신 서버 키 모드 자체를 비활성화한다(개인 키 입력 경로는 영향 없음).
  if (!env.AIO_QUOTA || typeof env.AIO_QUOTA.get !== 'function') {
    return errorResponse('서버 키 모드 일시 비활성화(용량 캐핑 미설정) — 개인 Claude 키를 입력하세요', 503, origin, aiError);
  }
  const DAILY_CAP = parseInt(env.ANTHROPIC_DAILY_CAP || '300', 10);
  try {
    const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
    const cur = parseInt((await env.AIO_QUOTA.get(dayKey)) || '0', 10);
    if (cur >= DAILY_CAP) return errorResponse('일일 AI 사용 한도 초과 — 잠시 후 다시 시도하거나 개인 Claude 키를 입력하세요', 429, origin, aiError);
    await env.AIO_QUOTA.put(dayKey, String(cur + 1), { expirationTtl: 172800 });
  } catch (e) {
    // KV put/get 자체의 일시 오류(바인딩은 있으나 호출 실패) — 캡을 무의미하게 만들지 않기 위해
    // 여기서는 요청을 막지 않고 통과시킨다(바인딩 자체가 없는 경우와는 다름 — 그건 위에서 이미 차단).
  }

  // Body 크기 상한(WO-1B) — 기존엔 요청 크기 제한이 전혀 없어 비정상적으로 큰 입력(=입력 토큰
  // 비용 폭주)을 그대로 업스트림에 전달했다. 클라이언트 자체가 90K자에서 자동 트리밍하므로(v51.04)
  // 200KB면 정상 트래픽엔 절대 안 걸리면서 악의적 대용량 payload는 차단하는 여유 있는 상한.
  const MAX_BODY_BYTES = 200 * 1024;
  let _bodyText;
  try { _bodyText = await request.text(); } catch { return errorResponse('Failed to read request body', 400, origin, aiError); }
  if (_bodyText.length > MAX_BODY_BYTES) return errorResponse('Request body too large', 413, origin, aiError);

  let body;
  try { body = JSON.parse(_bodyText); } catch { return errorResponse('Invalid JSON body', 400, origin, aiError); }
  // 모델 allowlist: haiku/sonnet만 (opus 차단 — 비용 폭주 방지)
  if (!/^claude-(haiku|sonnet)/.test(String(body.model || ''))) body.model = 'claude-haiku-4-5';
  // max_tokens 상한 (공유 키 비용 한계)
  const MAX_TOK = parseInt(env.ANTHROPIC_MAX_TOKENS || '1500', 10);
  if (!body.max_tokens || body.max_tokens > MAX_TOK) body.max_tokens = MAX_TOK;

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 60000);
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    // 본문 스트림 그대로 파이프(스트리밍 SSE/일반 JSON 모두 보존) + CORS
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        ...getCorsHeaders(origin),
        ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-anthropic',
      },
    });
  } catch (e) {
    return errorResponse(e.name === 'AbortError' ? 'Claude timeout' : 'Claude upstream error', 502, origin, aiError);
  }
}

/** 메인 요청 핸들러 */
export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const _u = new URL(request.url);

    // v50.52 B5: Claude 서버 키 프록시 라우트 (POST /anthropic). 데이터 프록시(GET ?url=)보다 먼저 분기.
    if (_u.pathname === '/anthropic' || _u.searchParams.get('anthropic') === '1') {
      return handleAnthropic(request, env, requestOrigin);
    }

    // OPTIONS 프리플라이트
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(requestOrigin) });
    }

    // GET 만 허용
    if (request.method !== 'GET') {
      return errorResponse('GET 요청만 지원됩니다', 405, requestOrigin);
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
    if (!checkRateLimit(clientIp)) {
      return errorResponse('Too many requests', 429, requestOrigin);
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

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: upstreamHeaders,
        signal: controller.signal,
        cf: { cacheTtl: _cacheTtl },
      });

      clearTimeout(timeoutId);

      // 대용량 응답 차단 (5MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        return errorResponse('Response too large', 502, requestOrigin);
      }

      const data = await response.text();
      const contentType = response.headers.get('content-type') || 'application/json';
      if (_expectsJson && looksLikeHtml(data)) {
        return errorResponse('Upstream returned HTML block page for JSON endpoint', 502, requestOrigin);
      }

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${_cacheTtl}`,
          ...getCorsHeaders(requestOrigin),
          ...SECURITY_HEADERS,
          'X-AIO-Proxy': 'cloudflare-worker',
          'X-AIO-Cache-TTL': String(_cacheTtl),
        },
      });
    } catch (error) {
      const msg = error.name === 'AbortError' ? 'Request timeout' : 'Upstream error';
      return errorResponse(msg, 502, requestOrigin);
    }
  },
};
