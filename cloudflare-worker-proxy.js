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
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

/** 메인 요청 핸들러 */
export default {
  async fetch(request) {
    const requestOrigin = request.headers.get('Origin') || '';

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
