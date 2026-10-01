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
 *        - P1353: ANTHROPIC_MONTHLY_BUDGET_USD (기본 $10, $0~$10). UTC 월별 보수적
 *          비용 예약 상한이며 실제 청구액이 아니다. 개인 키/Actions 직접 호출은 제외된다.
 *        - (선택, WO-1B) 변수 AIO_APP_TOKEN — 값은 반드시 클라이언트(js/aio-chat.js
 *          `_aioAppToken()`)와 동일한 문자열로 설정. 미설정 시 이 검사는 건너뜀(기존 배포
 *          하위호환 — 갑자기 막히지 않음). 설정 시 이 헤더 없는 curl 등 단순 남용 차단.
 *          공개 클라이언트 JS에 그대로 노출되는 값이라 진짜 비밀은 아님 — "URL만 아는" 수준의
 *          자동화 남용을 거르는 최소 방어선일 뿐, 소스를 직접 읽는 공격자는 우회 가능(WO-1B 한계).
 *        - (선택, WO-1B) 변수 ANTHROPIC_KILL_SWITCH = '1' — 값을 실제 API 키를 지우지 않고도
 *          /anthropic 라우트 전체를 즉시 차단하고 싶을 때(예: 남용 급증 대응) 사용.
 *   2) (v52.47부터 필수, 현재는 DO 기반) 일일 캡 강제용 Durable Object 바인딩 AIO_QUOTA_DO
 *        (AIOQuotaDurableObject, SQLite-backed)를 Worker에 추가. **DO 미바인딩이면 서버 키 모드
 *        자체가 503으로 비활성화된다**(v52.46 이전엔 캡 없이 통과하는 fail-open이었음 — 무제한 비용
 *        노출 방지를 위해 정책 변경). 구버전 KV Namespace 바인딩(AIO_QUOTA)은 더 이상 지원하지 않는다
 *        — legacy KV는 fail-closed로 거부된다(architecture/worker-endpoints.json 참조).
 *        개인 Claude 키 입력 경로는 DO와 무관하게 항상 정상 동작.
 *   3) 사이트에서: 사이드바 "CF Worker URL" 입력 + localStorage 'aio_claude_server_mode'='1'
 *        (개인 키를 입력하면 개인 키가 우선 — 서버 키는 개인 키 없을 때/서버모드 토글 시 사용)
 * 비용 보호: 가격 확인된 모델만 허용, max_tokens 상한, 일일 호출 캡 + 월 비용 예약 캡.
 * 유료 서버 검색·멀티모달은 안전한 비용 상한이 없어 명시적으로 거부한다. 공급자 Workspace
 * 월 지출 한도도 설정해야 하며 이 Worker만으로 전체 계정의 월 청구액을 보장하지 않는다.
 *
 * ── v56: 서버측 키 릴레이 (GET /relay?provider=<fred|bok|kosis>&<params>) ──
 * FRED·BOK ECOS·KOSIS는 브라우저에서 CORS로 막히거나(FRED) 애초에 CORS 헤더를 보내지
 * 않는다(BOK/KOSIS). 운영자가 키를 1회 등록하면 모든 사용자가 개인 키 없이 이 소스들을
 * 쓸 수 있다. 사용자 개인 키는 이 라우트로 전송되지 않는다 — 키는 서버 시크릿에서만 나온다.
 *   Secrets: FRED_API_KEY, BOK_API_KEY, KOSIS_API_KEY
 *   Var(선택): RELAY_DAILY_CAP (기본 2000, 제공자별 일일 호출 상한)
 * 업스트림 host/path는 코드에 하드코딩되어 클라이언트가 목적지를 지정할 수 없다(SSRF 불가).
 * 파라미터는 제공자별 정규식 화이트리스트만 통과하며, Origin·앱 토큰·IP 레이트리밋·DO 일일
 * 캡이 모두 적용된다. DO(AIO_QUOTA_DO) 미바인딩이면 릴레이도 fail-closed 503이다.
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
// 브라우저에서 CORS로 막히는 소스(FRED/BOK/KOSIS)를 운영자 키로 대신 조회한다.
// 사용자는 개인 키를 이 Worker에 보내지 않는다 — 키는 서버 시크릿에서만 나온다.
// 업스트림 host/path는 아래 맵에 하드코딩되어 있어 클라이언트가 목적지를 지정할 수
// 없으므로 이 라우트는 SSRF 릴레이로 전용될 수 없다. 파라미터는 제공자별 정규식
// 화이트리스트로만 통과한다.
const RELAY_PROVIDERS = Object.freeze({
  fred: {
    keyEnv: 'FRED_API_KEY',
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, anthropic-beta, X-AIO-App-Token, X-AIO-Idempotency-Key, X-AIO-Request-Id',
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
    source: aiContext.source || 'worker-anthropic', reason,
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

// ── v50.52 B5 / v52.47 WO-1B: Claude(Anthropic) 서버 키 프록시 ──────────────────────
// 운영자 시크릿(env.ANTHROPIC_API_KEY)으로 호출 → 사용자는 개인 키 입력 불요.
// 비용/남용 보호(WO-1B 강화): kill switch → Origin 서버측 강제 → 앱 토큰(선택) →
// IP당 20회/분 레이트리밋 → body 크기·가격·content 계약 → DO 일일/월 예약 캡
// (fail-closed) → upstream. 스트리밍 지원(SSE 그대로 파이프).
// [WO-1B 한계 — 정직하게 기록] 정적 사이트+무료 Workers 구조상 진짜 호출자 인증은 불가능하다.
// 앱 토큰은 공개 클라이언트 JS에 그대로 노출되므로 "URL만 알고 curl로 두드리는" 자동화
// 남용은 막지만, 공개 소스를 직접 읽는 작정한 공격자는 우회할 수 있다 — Codex 자체도 이 구조적
// 한계를 명시했다(진짜 해결은 사용자 계정/OAuth 백엔드가 필요한데 정적 배포 전제와 맞지 않는다).
// [HKG/B8] Cloudflare 무료 플랜 anycast가 홍콩(HKG) 리전으로 라우팅하면 Anthropic이 지역 정책상
// 403을 반환하는 사례가 있다(레포/시크릿 문제 아님, `_context/DEFERRED-BLOCKS.md` B8). 이 Worker
// 코드로는 우회 불가 — 클라이언트(`js/aio-chat.js` `_aioFetchClaudeWithRetry`)가 같은 403 forbidden
// 포맷일 때만 즉시 재시도해 다른(정상) 엣지로 재라우팅되길 기대하는 완화책을 이미 구현 중(v52.44).
// Public readiness is metadata-only: it reveals whether the Worker can serve
// AI traffic, never the secret itself or its value.
async function healthResponse(origin, env, method = 'GET') {
  const configured = !!(env && env.ANTHROPIC_API_KEY);
  const quotaConfigured = hasAtomicQuotaBinding(env);
  const killSwitch = !!(env && env.ANTHROPIC_KILL_SWITCH === '1');
  let authority = { ready: false, jurisdiction: null, reason: 'us-authority-unavailable' };
  if (hasDurableObjectNamespace(env)) {
    try {
      const response = await aiAuthorityDurableObjectStub(env).fetch('https://aio-authority.internal/health');
      if (response.ok) authority = await response.json();
    } catch (_) {}
  }
  const authorityReady = authority?.ready === true && authority?.jurisdiction === 'us';
  const ready = configured && quotaConfigured && authorityReady && !killSwitch;
  const payload = {
    schemaVersion: 'aio-worker-health.v1',
    ok: true,
    service: 'aio-screener-worker',
    revision: env && env.AIO_APP_REVISION ? String(env.AIO_APP_REVISION) : null,
    sourceSha: env && env.AIO_SOURCE_SHA ? String(env.AIO_SOURCE_SHA) : null,
    ai: { configured, quotaConfigured, authorityReady, authorityJurisdiction: authority?.jurisdiction || null, killSwitch, ready, maxTokens: parseInt((env && env.ANTHROPIC_MAX_TOKENS) || '1500', 10) },
    // Presence only — never the relay key value.
    relay: {
      providers: Object.keys(RELAY_PROVIDERS),
      configured: Object.fromEntries(Object.entries(RELAY_PROVIDERS).map(([id, provider]) => [id, !!(env && env[provider.keyEnv])])),
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
    const cap = quotaInteger(env.ANTHROPIC_DAILY_CAP, 300);
    const monthlyCapMicroUsd = anthropicMonthlyBudgetMicroUsd(env);
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
      usageMonthUtc: usage.usageMonthUtc,
      monthlyReservedMicroUsd: usage.monthlyReservedMicroUsd,
      monthlyBudgetMicroUsd: monthlyCapMicroUsd,
      monthlyPastSpendUnknown: usage.monthlyPastSpendUnknown === true,
      accountingBasis: 'conservative-reservation-not-invoice',
      scope: 'worker-anthropic-only; excludes personal-key-browser and GitHub-Actions direct calls'
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

// P1353: frozen 2026-09-30 price snapshot, USD per million tokens. Exact
// model versions only; an unknown alias must never inherit another model's price.
// https://platform.claude.com/docs/en/about-claude/pricing
const ANTHROPIC_PRICES = Object.freeze({
  'claude-haiku-4-5': [1, 5], 'claude-haiku-4-5-20251001': [1, 5],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5': [3, 15], 'claude-sonnet-4-5-20250929': [3, 15],
});
const BUDGET_SCHEMA = 2;
const MONTH_RETENTION_MS = 70 * 24 * 60 * 60 * 1000;

function quotaInteger(value, fallback, maximum = 1000000) {
  const raw = value === undefined ? String(fallback) : String(value);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > maximum) throw new Error('invalid AI quota configuration');
  return Number(raw);
}

export function anthropicMonthlyBudgetMicroUsd(env = {}) {
  const raw = env.ANTHROPIC_MONTHLY_BUDGET_USD === undefined ? '10' : String(env.ANTHROPIC_MONTHLY_BUDGET_USD);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(raw)) throw new Error('invalid monthly AI budget');
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10000000) throw new Error('monthly AI budget must be between $0 and $10');
  return amount;
}

// This is an admission reservation, NEVER a measurement of invoiced usage.
// Text byte-level tokenization cannot create more text tokens than UTF-8 bytes;
// reserve extra framing room per message/tool without clipping to a model's
// context size. This narrow text/custom-tool protocol
// excludes image/PDF/audio/server-tool expansion and premium/unknown parameters.
// Cache writes reserve the most expensive supported 1h write (2x input), and
// every request reserves the US inference premium (1.1x), even if not incurred.
// Provider workspace spend limits remain necessary: direct browser/Actions calls
// bypass this ledger, and provider pricing/tokenization changes are not attested here.
export function prepareAnthropicBudget(body, env = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('JSON object required');
  const model = body.model === undefined ? 'claude-haiku-4-5' : body.model;
  const rates = typeof model === 'string' && Object.hasOwn(ANTHROPIC_PRICES, model) ? ANTHROPIC_PRICES[model] : null;
  if (!rates) throw new Error('unsupported model: no verified price; server AI supports Haiku 4.5 and Sonnet 4.5/4.6 only');
  const maxTokens = quotaInteger(env.ANTHROPIC_MAX_TOKENS, 1500, 8192);
  let outputTokens;
  try { outputTokens = body.max_tokens === undefined ? maxTokens : quotaInteger(body.max_tokens, maxTokens, 1000000); }
  catch { throw new Error('invalid max_tokens input'); }
  body = { ...body, model, max_tokens: Math.min(maxTokens, outputTokens) };
  const allowed = new Set(['model','max_tokens','messages','system','stream','temperature','top_p','top_k','stop_sequences','tools','tool_choice','thinking','cache_control','metadata','inference_geo']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new Error('unsupported AI request parameter: no safe cost bound');
  if (!Array.isArray(body.messages) || body.messages.length > 64) throw new Error('at most 64 text messages required');
  if (body.stream !== undefined && typeof body.stream !== 'boolean') throw new Error('boolean stream required');
  for (const key of ['temperature','top_p']) if (body[key] !== undefined
    && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1)) throw new Error('invalid sampling parameter');
  if (body.top_k !== undefined && (!Number.isSafeInteger(body.top_k) || body.top_k < 0)) throw new Error('invalid top_k');
  if (body.stop_sequences !== undefined && (!Array.isArray(body.stop_sequences) || body.stop_sequences.length > 64 || body.stop_sequences.some(value => typeof value !== 'string'))) throw new Error('invalid stop sequences');
  if (body.metadata !== undefined && (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)
    || Object.keys(body.metadata).some(key => key !== 'user_id') || (body.metadata.user_id !== undefined && typeof body.metadata.user_id !== 'string'))) throw new Error('invalid metadata');
  if (body.tool_choice !== undefined && (!body.tool_choice || !['auto','any','tool','none'].includes(body.tool_choice.type)
    || Object.keys(body.tool_choice).some(key => !['type','name','disable_parallel_tool_use'].includes(key))
    || (body.tool_choice.type === 'tool' && typeof body.tool_choice.name !== 'string')
    || (body.tool_choice.disable_parallel_tool_use !== undefined && typeof body.tool_choice.disable_parallel_tool_use !== 'boolean'))) throw new Error('unsupported tool choice');
  const cache = value => {
    if (value === undefined) return;
    if (!value || value.type !== 'ephemeral' || (value.ttl !== undefined && !['5m','1h'].includes(value.ttl))
      || Object.keys(value).some(key => !['type','ttl'].includes(key))) throw new Error('unsupported cache configuration');
  };
  const textBlocks = value => {
    if (typeof value === 'string') return;
    if (!Array.isArray(value) || value.length > 64) throw new Error('only bounded text content is supported by the monthly budget');
    for (const block of value) {
      if (!block || block.type !== 'text' || typeof block.text !== 'string'
        || Object.keys(block).some(key => !['type','text','cache_control'].includes(key))) throw new Error('image/PDF/audio/server-tool content has no safe server budget bound');
      cache(block.cache_control);
    }
  };
  if (body.system !== undefined) textBlocks(body.system);
  for (const message of body.messages) {
    if (!message || !['user','assistant'].includes(message.role) || Object.keys(message).some(key => !['role','content'].includes(key))) throw new Error('unsupported AI message');
    if (typeof message.content === 'string') continue;
    if (!Array.isArray(message.content) || message.content.length > 64) throw new Error('unsupported AI message content');
    for (const block of message.content) {
      if (block?.type === 'text') { textBlocks([block]); continue; }
      if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string'
        && block.input && typeof block.input === 'object' && !Array.isArray(block.input)
        && Object.keys(block).every(key => ['type','id','name','input','cache_control'].includes(key))) { cache(block.cache_control); continue; }
      if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string'
        && Object.keys(block).every(key => ['type','tool_use_id','content','is_error','cache_control'].includes(key))) { textBlocks(block.content); cache(block.cache_control); continue; }
      throw new Error('unsupported AI content: no safe cost bound');
    }
  }
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length > 32)) throw new Error('at most 32 custom tools supported');
  for (const tool of body.tools || []) {
    if (tool?.type && tool.type !== 'custom') throw new Error('유료 서버 검색·도구는 검색 결과 토큰의 안전 상한이 없어 서버 모드에서 차단됩니다. 개인 키 경로와 공급자 예산 설정을 확인하세요.');
    if (!tool || typeof tool.name !== 'string' || !tool.input_schema || typeof tool.input_schema !== 'object'
      || Object.keys(tool).some(key => !['type','name','description','input_schema','cache_control'].includes(key))) throw new Error('unsupported custom tool configuration');
    cache(tool.cache_control);
  }
  cache(body.cache_control);
  if (body.inference_geo !== undefined && (model !== 'claude-sonnet-4-6' || !['us','global'].includes(body.inference_geo))) throw new Error('unsupported inference pricing for this model');
  if (body.thinking !== undefined && (!body.thinking || !['enabled','disabled'].includes(body.thinking.type)
    || Object.keys(body.thinking).some(key => !['type','budget_tokens'].includes(key))
    || (body.thinking.type === 'enabled' && (!Number.isSafeInteger(body.thinking.budget_tokens) || body.thinking.budget_tokens < 1 || body.thinking.budget_tokens >= body.max_tokens)))) throw new Error('unsupported thinking budget');
  const bytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (bytes > 200 * 1024) throw new Error('AI request exceeds the budgeted text limit');
  const inputTokenUpperBound = bytes + 8192 + body.messages.length * 1024 + (body.tools?.length || 0) * 4096;
  const reservationMicroUsd = Math.ceil((inputTokenUpperBound * rates[0] * 2 + body.max_tokens * rates[1]) * 11 / 10);
  const monthlyCapMicroUsd = anthropicMonthlyBudgetMicroUsd(env);
  return { body, reservationMicroUsd, monthlyCapMicroUsd, inputTokenUpperBound,
    accountingBasis: 'conservative-reservation-not-invoice', pricingAsOf: '2026-09-30' };
}

// Keep the deadline and caller cancellation alive until the body is consumed.
// Fetch resolving only means headers arrived; an SSE body may still stall.
async function fetchAnthropicWithDeadline(apiKey, body, callerSignal) {
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
  timeout = setTimeout(() => abort(new DOMException('Claude timeout', 'AbortError')), 60000);
  callerSignal?.addEventListener('abort', cancelFromCaller, { once: true });
  if (callerSignal?.aborted) cancelFromCaller();
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    if (controller.signal.aborted) {
      void upstream.body?.cancel().catch(() => {});
      throw controller.signal.reason;
    }
    if (!upstream.body) { finished = true; cleanup(); return upstream; }
    reader = upstream.body.getReader();
    const streamedBody = new ReadableStream({
      start(value) { streamController = value; },
      async pull(value) {
        try {
          const chunk = await reader.read();
          if (finished) return;
          if (chunk.done) { finished = true; cleanup(); value.close(); }
          else value.enqueue(chunk.value);
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
      sums[reservation.monthKey] = (sums[reservation.monthKey] || 0) + reservation.reservationMicroUsd;
    }
    for (const [month, sum] of Object.entries(sums)) if (sum > this.counts.months[month]) throw new Error('monthly ledger was reset or undercounts reservations');
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
          throw new Error('valid Anthropic UTC dayKey is required');
        }
        const requestCount = this.counts.days[dayKey] ?? 0;
        if (!Number.isSafeInteger(requestCount) || requestCount < 0) throw new Error('valid Anthropic quota count is required');
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
        ready: jurisdiction === 'us' && !!this.env?.ANTHROPIC_API_KEY,
        jurisdiction,
        configured: !!this.env?.ANTHROPIC_API_KEY,
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
        budget = prepareAnthropicBudget(body.claudeBody, this.env);
        cap = quotaInteger(this.env.ANTHROPIC_DAILY_CAP, 300);
      } catch (error) {
        return Response.json({ error: { type: 'budget_validation_error', message: error.message } }, { status: 400 });
      }
      const payload = { dayKey: 'claude:' + new Date().toISOString().slice(0, 10), cap, requestId: body.requestId,
        reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd };
      const upstream = await dispatchAnthropic(this.env, budget, payload, request.signal, (operation, value) => this.mutateQuota(operation, value));
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'X-AIO-Upstream-Authority': 'durable-object-us' } });
    }
    const result = await this.mutateQuota(operation, body);
    return Response.json(result || { ok: false }, { status: 200 });
  }
}

async function fetchAnthropicThroughDurableObject(env, payload, signal) {
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

async function dispatchAnthropic(env, budget, payload, signal, rpc) {
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
  try { return await fetchAnthropicWithDeadline(env.ANTHROPIC_API_KEY, budget.body, signal); }
  catch (error) {
    return Response.json({ error: { type: error.name === 'AbortError' ? 'timeout' : 'upstream_error', message: 'Claude upstream unavailable; monthly reservation retained' } }, { status: 502 });
  }
}

/** Canonical, atomic /anthropic production handler. */
async function handleAnthropic(request, env, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(origin, env) });
  const aiError = { source: 'worker-anthropic' };
  if (request.method !== 'POST') return errorResponse('POST required for /anthropic', 405, origin, aiError, env);
  if (env?.ANTHROPIC_KILL_SWITCH === '1') return errorResponse('server AI mode disabled by kill switch', 503, origin, aiError, env);
  if (!env?.ANTHROPIC_API_KEY) return errorResponse('server Anthropic key is not configured', 503, origin, aiError, env);
  if (!resolveAllowedOrigin(origin, env)) return errorResponse('Origin not allowed', 403, origin, aiError, env);
  if (env.AIO_APP_TOKEN && request.headers.get('X-AIO-App-Token') !== env.AIO_APP_TOKEN) return errorResponse('Forbidden', 403, origin, aiError, env);
  cleanupRateLimitMap(anthropicRateLimitMap);
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!await enforceRateLimit(env, 'RATE_LIMIT_ANTHROPIC', anthropicRateLimitMap, ANTHROPIC_RATE_LIMIT, clientIp)) return errorResponse('Too many AI requests', 429, origin, aiError, env);
  if (!hasAtomicQuotaBinding(env)) return errorResponse('atomic AI quota is not configured', 503, origin, aiError, env);
  const maxBodyBytes = 200 * 1024;
  let bodyText;
  try { bodyText = await request.text(); } catch { return errorResponse('Failed to read request body', 400, origin, aiError, env); }
  if (new TextEncoder().encode(bodyText).byteLength > maxBodyBytes) return errorResponse('Request body too large', 413, origin, aiError, env);
  let body;
  try { body = JSON.parse(bodyText); } catch { return errorResponse('Invalid JSON body', 400, origin, aiError, env); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse('JSON object required', 400, origin, aiError, env);
  let cap, budget;
  try {
    cap = quotaInteger(env.ANTHROPIC_DAILY_CAP, 300);
    budget = prepareAnthropicBudget(body, env);
    body = budget.body;
  } catch (error) { return errorResponse(error.message, /configuration|monthly AI budget/.test(error.message) ? 503 : 400, origin, aiError, env); }
  const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
  const requestId = await deriveRequestId(request, bodyText);
  const maxTokens = body.max_tokens;
  if (hasDurableObjectNamespace(env)) {
    try {
      const upstream = await fetchAnthropicThroughDurableObject(env, { dayKey, cap, requestId, claudeBody: body }, request.signal);
      return new Response(upstream.body, { status: upstream.status, headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-anthropic', 'X-AIO-Max-Tokens': String(maxTokens),
        'X-AIO-Upstream-Authority': upstream.headers.get('X-AIO-Upstream-Authority') || 'durable-object',
      }});
    } catch (error) {
      const detail = String(error && error.message || error && error.name || 'unknown').slice(0, 180);
      console.error('AI durable authority unavailable', detail);
      return errorResponse('AI durable authority unavailable', 503, origin, aiError, env);
    }
  }
  try {
    const upstream = await dispatchAnthropic(env, budget, { dayKey, cap, requestId,
      reservationMicroUsd: budget.reservationMicroUsd, monthlyCapMicroUsd: budget.monthlyCapMicroUsd }, request.signal, (operation, payload) => quotaRpc(env, operation, payload));
    return new Response(upstream.body, { status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
      'X-AIO-Proxy': 'cloudflare-worker-anthropic', 'X-AIO-Max-Tokens': String(maxTokens),
    }});
  } catch (error) {
    return errorResponse('AI quota unavailable', 503, origin, aiError, env);
  }
}

/**
 * Canonical /relay handler — server-side key relay for browser-blocked sources.
 * The operator owns the upstream key (validated against FRED/BOK/KOSIS terms);
 * the browser never sends or receives one. Guard order mirrors /anthropic:
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

  const key = env && env[provider.keyEnv];
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
    const response = await fetch(provider.build(key, params), {
      method: 'GET',
      headers: { 'Accept': 'application/json,text/plain,*/*', 'User-Agent': 'AIO-Screener-relay/1.0' },
      signal: controller.signal,
      cf: { cacheTtl: provider.cacheTtl || 600 },
    });
    clearTimeout(timeoutId);

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      if (ownedReservation) await releaseQuota(env, dayKey, requestId);
      return errorResponse('Response too large', 502, origin);
    }
    const body = redactRelayKey(await response.text(), key);
    if (looksLikeHtml(body)) {
      if (ownedReservation) await releaseQuota(env, dayKey, requestId);
      return errorResponse('Upstream returned HTML block page', 502, origin);
    }
    if (response.status >= 400 && ownedReservation) await releaseQuota(env, dayKey, requestId);
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': `public, max-age=${provider.cacheTtl || 600}`,
        ...getCorsHeaders(origin, env), ...SECURITY_HEADERS,
        'X-AIO-Proxy': 'cloudflare-worker-relay',
        'X-AIO-Relay-Provider': providerId,
      },
    });
  } catch (error) {
    if (ownedReservation) await releaseQuota(env, dayKey, requestId);
    return errorResponse(error.name === 'AbortError' ? 'Relay timeout' : 'Relay upstream error', 502, origin);
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

    // v50.52 B5: Claude 서버 키 프록시 라우트 (POST /anthropic). 데이터 프록시(GET ?url=)보다 먼저 분기.
    if (_u.pathname === '/anthropic' || _u.searchParams.get('anthropic') === '1') {
      return handleAnthropic(request, env, requestOrigin);
    }

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
    // 익명 릴레이로 이 Worker를 쓸 수 있었다. /anthropic·/relay와 동일하게 게이트로 강제한다.
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
          ...getCorsHeaders(requestOrigin, env),
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
