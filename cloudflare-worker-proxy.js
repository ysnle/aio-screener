/**
 * AIO Screener CORS 프록시 — Cloudflare Workers
 * v2.2: P310 대량삭제(825d3c5)로 소실된 소스 복원 + 잠복 버그 수정
 *        (rateLimit 정리 호출이 주석에 붙어 미실행이던 것 시정).
 *        보안: Origin 화이트리스트, URL 도메인 화이트리스트, SSRF 차단, 타임아웃,
 *        봇/스캐너 UA 차단, 보안 응답 헤더.
 *
 * ※ 이 Worker는 "데이터(시세/뉴스/FRED 등) CORS 프록시"다. AI 채팅 Claude 키는
 *   별도로 클라이언트가 api.anthropic.com에 직접 호출한다(이 Worker 경유 아님).
 *   v50.23부터 시세/매크로/F&G는 서버측 GitHub Actions(public-data/data.json)가 우선이고,
 *   이 Worker는 그 외 데이터(뉴스 RSS 등)의 브라우저 CORS 우회 레이어다.
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
 * ── v50.52 B5: Claude(AI 채팅) 서버 키 모드 (선택 — 사용자가 키 입력 없이 AI 채팅) ──
 * 운영자만 1회 설정하면 모든 사용자가 개인 Claude 키 없이 AI 채팅 사용(키는 서버 시크릿).
 *   1) 위 Worker 배포 후 → Worker 설정(Settings) → Variables and Secrets:
 *        - Secret 추가: 이름 ANTHROPIC_API_KEY, 값 = 운영자 Anthropic API 키
 *        - (선택) 변수 ANTHROPIC_DAILY_CAP (기본 300), ANTHROPIC_MAX_TOKENS (기본 1500)
 *   2) (권장) 일일 캡 강제: KV Namespace 생성 → Worker에 바인딩 이름 AIO_QUOTA 로 추가
 *        (KV 없으면 캡은 best-effort 미적용 — Cloudflare WAF Rate Limiting Rules 병행 권장)
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

// ── Rate Limiter ─────────────────────────────────────────────────
// NOTE: Worker isolate 간 Map 공유 불가. 단일 isolate 내 best-effort 방어.
// 완전한 레이트 리밋은 Cloudflare Rate Limiting Rules 또는 Durable Objects 필요.
const rateLimitMap = new Map();
const RATE_LIMIT = 300; // 요청/분

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  const record = rateLimitMap.get(ip);
  if (now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// 오래된 항목 정리 (isolate 장기 유지 시 메모리 방어)
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetTime + 60000) rateLimitMap.delete(key);
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version',
    'Access-Control-Max-Age': '86400',
  };
}

/** 에러 응답 생성 */
function errorResponse(message, status = 400, origin = '') {
  return new Response(
    JSON.stringify({ error: message, status }),
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

// ── v50.52 B5: Claude(Anthropic) 서버 키 프록시 ──────────────────────
// 운영자 시크릿(env.ANTHROPIC_API_KEY)으로 호출 → 사용자는 개인 키 입력 불요.
// 비용 보호: 모델 allowlist(haiku/sonnet, opus 차단)·max_tokens 상한·일일 캡(env.AIO_QUOTA KV).
// 스트리밍 지원: 업스트림 응답 본문(r.body)을 그대로 파이프(SSE 보존).
async function handleAnthropic(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  if (request.method !== 'POST') return errorResponse('POST required for /anthropic', 405, origin);
  if (!env || !env.ANTHROPIC_API_KEY) return errorResponse('서버 Claude 키 미설정 (운영자가 ANTHROPIC_API_KEY 시크릿 추가 필요)', 503, origin);

  // 일일 호출 캡 (KV 바인딩 시). 미바인딩이면 통과(Cloudflare WAF Rate Limiting 권장).
  const DAILY_CAP = parseInt(env.ANTHROPIC_DAILY_CAP || '300', 10);
  if (env.AIO_QUOTA && typeof env.AIO_QUOTA.get === 'function') {
    try {
      const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
      const cur = parseInt((await env.AIO_QUOTA.get(dayKey)) || '0', 10);
      if (cur >= DAILY_CAP) return errorResponse('일일 AI 사용 한도 초과 — 잠시 후 다시 시도하거나 개인 Claude 키를 입력하세요', 429, origin);
      await env.AIO_QUOTA.put(dayKey, String(cur + 1), { expirationTtl: 172800 });
    } catch (e) { /* KV 실패는 통과(best-effort) */ }
  }

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400, origin); }
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
    return errorResponse(e.name === 'AbortError' ? 'Claude timeout' : 'Claude upstream error', 502, origin);
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

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
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
