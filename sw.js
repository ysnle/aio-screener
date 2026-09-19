// AIO Screener Service Worker — offline-first v48.27 (P3-4 1단계)
// 전략: shell (index.html/version.json/js)은 Network-First, API는 Network-First + 캐시 폴백
// 제약: GitHub Pages HTTPS + 정적 호스팅 (POST 캐싱 불가, CORS 프록시는 제3자 도메인)
// v48.27 (QA-3): SW_VERSION을 APP_VERSION과 동기화 — activate 시 신규 캐시로 전환 (R1 7번째 동기화 지점)

// R1: keep SW_VERSION in sync with APP_VERSION/version.json for reliable cache rotation.
// v48.80/P150: operational hardening adds an explicit build marker and health message.
const SW_VERSION = 'v55.11';
const SW_BUILD = '2026-09-19T12:10:00+09:00';
const SHELL_CACHE = 'aio-shell-' + SW_VERSION;
const DATA_CACHE  = 'aio-data-'  + SW_VERSION;

// Only the bounded critical shell is installed atomically. The larger registry
// below is a publication/dependency audit aid; route/ESM modules are cached only
// after the browser actually requests them.
const CRITICAL_SHELL_ASSETS = [
  './',
  './index.html',
  './version.json',
  './public-config.json',
  './js/aio-core.js',
  './js/aio-data.js',
  './js/aio-ui.js',
  './js/aio-chat.js',
  './js/aio-glossary.js',
  './src/app/bootstrap.js'
];
const RUNTIME_SHELL_PATH_RE = /\/(?:js|src)\//;



// API/데이터 URL 패턴 — Network-First + 캐시 폴백
// P1112: `market-snapshot-status.json`과 `operations-status.json`은 클라이언트가
// 한 번도 fetch하지 않는데 이 목록에만 있었다(캐시는 채워지지 않는다). 소비자가
// 없는 항목은 캐시 구성을 거짓으로 설명하므로 제거했다. 반대로 실제로 읽는
// `data.json`·`history.json`·`screener.json`·`telegram-digest.json`은 이 목록 밖이라
// 오프라인 폴백이 없다 — 그쪽 보강은 TTL 의미와 함께 별도 검증이 필요하다.
const DATA_URL_PATTERNS = [
  /\/public-data\/(?:market-snapshot|reconciliation-status)\.json(?:\?|$)/,
  /\/public-data\/sec-fundamentals-summary\.json(?:\?|$)/,
  /query[12]\.finance\.yahoo\.com/,      // Yahoo Finance
  /api\.coingecko\.com/,                  // CoinGecko
  /fredgraph\.csv|fredapi/,               // FRED
  /cdn\.cboe\.com/,                       // CBOE
  /unusualwhales\.com/,                   // Unusual Whales
  /finnhub\.io/,                          // Finnhub
  /alphavantage\.co/,                     // Alpha Vantage
  /financialmodelingprep\.com/,           // FMP
  /data\.sec\.gov/,                       // SEC EDGAR
  /corsproxy\.io|allorigins\.win|codetabs\.com/,  // CORS 프록시
  /rsshub\.app/,                          // RSSHub 텔레그램
];

// 교육·원문 reference artifact — 네트워크 성공 후 오프라인에서도 마지막
// 검증 원장을 유지하되, 현재 가격·뉴스 TTL과 섞지 않는다.
const REFERENCE_URL_PATTERNS = [
  /\/public-data\/(?:objects\/masters\/[a-f0-9]{64}|atlas\/current-evidence-ledger|masters\/(?:holdings-summary|ticker-index-reference|history\/managers\/[^/]+)|principles\/lesson-library|atlas\/foundation-lessons|knowledge\/(?:articles(?:\/(?:principles|atlas-foundations)\/[^/]+)?|status-summary|learning-graph|coverage-matrix|research-dossiers))\.json(?:\?|$)/
];

// 민감 URL 패턴 — API 키/토큰/중첩 proxy URL 포함 시 캐시 금지
const SENSITIVE_QUERY_RE = /[?&](apikey|api_key|token|access_token|client_secret|url)=/i;
function isSensitiveUrl(u) { return SENSITIVE_QUERY_RE.test(u); }

// DATA_CACHE TTL 상수 (초)
const DATA_CACHE_TTL = 900;   // 시세/API: 15분
const NEWS_CACHE_TTL = 1800;  // 뉴스/RSS: 30분
const REFERENCE_CACHE_TTL = 86400; // 지식·원문 reference artifact: 24시간

// TTL 만료된 DATA_CACHE 항목 정리 (비동기 논블로킹 — 매 저장 시 호출)
async function purgeExpiredData(cache) {
  try {
    var keys = await cache.keys();
    var now = Date.now();
    for (var i = 0; i < keys.length; i++) {
      var res = await cache.match(keys[i]);
      if (!res) continue;
      var t   = parseInt(res.headers.get('x-cache-time') || '0');
      var ttl = parseInt(res.headers.get('x-cache-ttl')  || String(DATA_CACHE_TTL)) * 1000;
      if (t > 0 && now - t > ttl) cache.delete(keys[i]);
    }
  } catch(e) {}
}

// 읽기 경로의 최대 허용 나이. TTL은 쓰기 시점 정리에만 쓰였고, 폴백 읽기는
// `caches.match` 결과를 나이와 무관하게 그대로 반환했다 — 오프라인이거나
// 네트워크 실패가 반복되면 임의로 오래된 시세가 "현재 값"으로 무기한 표시될
// 수 있었다. 삭제만으로는 부족하므로(오프라인에서는 재확인 경로가 없다)
// 읽을 때 나이를 판정하고, 초과분은 현재 데이터로 서빙하지 않는다.
const STALE_MAX_AGE_MULTIPLIER = 4;                  // data/news: TTL의 4배까지
const REFERENCE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;   // reference: 최대 7일

function offlineResponse() {
  return new Response(JSON.stringify({
    _offline: true,
    _sw_version: SW_VERSION,
    _message: 'Offline and no cached data available'
  }), {
    status: 503,
    statusText: 'Service Unavailable (offline)',
    headers: { 'Content-Type': 'application/json' }
  });
}

function staleResponse(ageMs, maxAgeMs) {
  return new Response(JSON.stringify({
    _offline: true,
    _stale: true,
    _sw_version: SW_VERSION,
    _cache_age_seconds: Math.round(ageMs / 1000),
    _cache_max_age_seconds: Math.round(maxAgeMs / 1000),
    _message: 'Cached copy exceeded its maximum age and is not served as current data'
  }), {
    status: 503,
    statusText: 'Service Unavailable (stale cache)',
    headers: { 'Content-Type': 'application/json' }
  });
}

// 나이를 알 수 있는 항목(x-cache-time/ttl)에만 상한을 적용한다. 헤더가 없는
// 구버전 캐시 항목은 나이 판정이 불가능하므로 그대로 사용한다.
async function cachedWithinMaxAge(request, isReference) {
  const cached = await caches.match(request);
  if (!cached) return { cached: null };
  const cachedAt = parseInt(cached.headers.get('x-cache-time') || '0', 10);
  const ttlSeconds = parseInt(cached.headers.get('x-cache-ttl') || '0', 10);
  if (!cachedAt || !ttlSeconds) return { cached };
  const ageMs = Date.now() - cachedAt;
  const maxAgeMs = isReference
    ? Math.max(REFERENCE_MAX_AGE_MS, ttlSeconds * 1000)
    : ttlSeconds * 1000 * STALE_MAX_AGE_MULTIPLIER;
  return { cached, stale: ageMs > maxAgeMs, ageMs, maxAgeMs };
}

// RSS 뉴스 피드 URL 패턴 (별도 — 짧은 TTL)
const NEWS_URL_PATTERNS = [
  /\/rss|\/feed|\.xml|\.rss/i,
  /reuters\.com|cnbc\.com|bloomberg\.com|wsj\.com/,
  /washingtonpost\.com|nytimes\.com|ft\.com/,
  /techcrunch\.com|theverge\.com|arstechnica\.com/,
  /digitimes\.com|trendforce\.com/
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache) {
      // A missing critical asset invalidates the install. Partial shell versions
      // must never become active under a successful service-worker revision.
      return cache.addAll(CRITICAL_SHELL_ASSETS);
    }).then(function() { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        // 이전 버전 캐시 삭제 — 새 버전 활성화 시 자동 정리
        if (k !== SHELL_CACHE && k !== DATA_CACHE) {
          return caches.delete(k);
        }
      }));
    }).then(function() { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = request.url;

  // GET만 캐싱 (POST/PUT 등은 패스스루)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // chrome-extension://, data:, blob: 등 스킴 제외
  if (!url.startsWith('http')) {
    event.respondWith(fetch(request));
    return;
  }

  // 1) 앱 셸 — Network-First (응답 후 캐시 갱신, 오프라인 시 캐시 폴백)
  const reqUrl = new URL(url);
  const scopeUrl = new URL(self.registration.scope);
  const isCriticalShell = CRITICAL_SHELL_ASSETS.some(function(asset) {
    const rel = asset.replace(/^\.\//, '');
    if (!rel) {
      return reqUrl.origin === scopeUrl.origin &&
        (reqUrl.pathname === scopeUrl.pathname || reqUrl.pathname === scopeUrl.pathname.replace(/\/$/, ''));
    }
    return reqUrl.origin === scopeUrl.origin && reqUrl.pathname.endsWith('/' + rel);
  });
  const isRuntimeShell = reqUrl.origin === scopeUrl.origin && RUNTIME_SHELL_PATH_RE.test(reqUrl.pathname);
  const isShell = isCriticalShell || isRuntimeShell;
  if (isShell) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then(function(resp) {
        if (resp && resp.ok) {
          var clone = resp.clone();
          caches.open(SHELL_CACHE).then(function(c) { c.put(request, clone); });
        }
        return resp;
      }).catch(function() {
        return caches.match(request).then(function(cached) {
          return cached || new Response('Offline shell asset unavailable', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }
  // 2) 데이터/API — Network-First + 캐시 폴백 (offline 시 마지막 캐시 응답)
  const isData = DATA_URL_PATTERNS.some(function(re) { return re.test(url); });
  const isNews = NEWS_URL_PATTERNS.some(function(re) { return re.test(url); });
  const isReference = REFERENCE_URL_PATTERNS.some(function(re) { return re.test(url); });
  if (isData || isNews || isReference) {
    event.respondWith(
      fetch(request).then(function(resp) {
        if (resp && resp.ok && resp.status === 200 && !isSensitiveUrl(url)) {
          var ttl = isReference ? REFERENCE_CACHE_TTL : isNews ? NEWS_CACHE_TTL : DATA_CACHE_TTL;
          var now = String(Date.now());
          // TTL 헤더를 주입한 래핑 응답 저장 (body 복사 필요)
          resp.clone().arrayBuffer().then(function(body) {
            try {
              var headers = new Headers(resp.headers);
              headers.set('x-cache-time', now);
              headers.set('x-cache-ttl', String(ttl));
              var wrapped = new Response(body, { status: resp.status, statusText: resp.statusText, headers: headers });
              caches.open(DATA_CACHE).then(function(c) {
                c.put(request, wrapped);
                purgeExpiredData(c); // TTL 만료 항목 비동기 정리
                c.keys().then(function(keys) {
                  if (keys.length > 500) c.delete(keys[0]); // FIFO 폴백
                });
              });
            } catch(e) {}
          }).catch(function() {});
        }
        return resp;
      }).catch(function() {
        // offline or 네트워크 실패 → 캐시 폴백.
        // 최대 허용 나이를 넘긴 캐시는 "현재 값"으로 반환하지 않는다.
        return cachedWithinMaxAge(request, isReference).then(function(entry) {
          if (!entry.cached) return offlineResponse();
          if (entry.stale) return staleResponse(entry.ageMs, entry.maxAgeMs);
          return entry.cached;
        });
      })
    );
    return;
  }

  // 3) 기타 — 일반 fetch (SW 개입 최소화)
  event.respondWith(fetch(request).catch(function() {
    return caches.match(request);
  }));
});

// 메시지 채널 — 클라이언트가 SW 제어 가능 (예: 캐시 수동 초기화)
self.addEventListener('message', function(event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_DATA_CACHE') {
    caches.delete(DATA_CACHE).then(function() {
      event.ports[0] && event.ports[0].postMessage({ ok: true });
    });
  } else if (event.data.type === 'GET_VERSION') {
    event.ports[0] && event.ports[0].postMessage({ version: SW_VERSION });
  } else if (event.data.type === 'GET_HEALTH') {
    caches.keys().then(function(keys) {
      event.ports[0] && event.ports[0].postMessage({
        version: SW_VERSION,
        build: SW_BUILD,
        shellCache: SHELL_CACHE,
        dataCache: DATA_CACHE,
        cacheNames: keys
      });
    }).catch(function(e) {
      event.ports[0] && event.ports[0].postMessage({
        version: SW_VERSION,
        build: SW_BUILD,
        error: e && e.message || String(e)
      });
    });
  }
});


