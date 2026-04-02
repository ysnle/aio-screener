/**
 * AIO Screener CORS 프록시 - Cloudflare Workers
 *
 * 배포 방법:
 * 1. https://workers.cloudflare.com 접속 및 무료 계정 생성
 * 2. "새 Worker 만들기" 클릭
 * 3. 아래 코드 전체 복사 및 붙여넣기
 * 4. "배포" 버튼 클릭
 * 5. 워커 URL 복사 (예: https://aio-proxy.username.workers.dev)
 * 6. AIO Screener 설정 패널의 "CF Worker URL"에 붙여넣기
 */

// Rate limiting을 위한 간단한 in-memory 맵 (메모리 캐시)
const rateLimitMap = new Map();

/**
 * IP 주소 기반 Rate Limiter
 * 최대 300요청/분
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }

  const record = rateLimitMap.get(key);

  if (now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= 300) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * CORS 헤더 생성
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 에러 응답 생성
 */
function errorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message, status }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(),
        'X-AIO-Proxy': 'cloudflare-worker',
      },
    }
  );
}

/**
 * 메인 요청 핸들러
 */
export default {
  async fetch(request, env, ctx) {
    // OPTIONS 프리플라이트 요청 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    // GET 요청만 허용
    if (request.method !== 'GET') {
      return errorResponse('GET 요청만 지원됩니다', 405);
    }

    // 클라이언트 IP 추출
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    // Rate limit 체크
    if (!checkRateLimit(clientIp)) {
      return errorResponse('너무 많은 요청입니다. 1분당 최대 300개 요청', 429);
    }

    // URL 파라미터 파싱
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return errorResponse('url 쿼리 파라미터가 필요합니다');
    }

    // URL 유효성 검사
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return errorResponse('유효하지 않은 URL입니다');
    }

    // 타겟 URL이 http/https인지 확인
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return errorResponse('http 또는 https 프로토콜만 지원됩니다');
    }

    try {
      // 타겟 URL 요청
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'AIO-Screener-Proxy/1.0 (+https://workers.cloudflare.com)',
        },
        cf: { cacheTtl: 30 }, // 30초 캐시
      });

      // 응답 데이터 읽기
      const data = await response.text();
      const contentType = response.headers.get('content-type') || 'application/json';

      // 응답 생성
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=30',
          ...getCorsHeaders(),
          'X-AIO-Proxy': 'cloudflare-worker',
          'X-Original-Status': response.status,
        },
      });
    } catch (error) {
      return errorResponse(`타겟 URL 요청 실패: ${error.message}`, 502);
    }
  },
};
