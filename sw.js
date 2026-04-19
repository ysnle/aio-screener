// AIO Screener Service Worker — offline-first v48.27 (P3-4 1단계)
// 전략: shell (index.html/manifest/version.json)은 Cache-First, API는 Network-First + 캐시 폴백
// 제약: GitHub Pages HTTPS + 정적 호스팅 (POST 캐싱 불가, CORS 프록시는 제3자 도메인)
// v48.27 (QA-3): SW_VERSION을 APP_VERSION과 동기화 — activate 시 신규 캐시로 전환 (R1 7번째 동기화 지점)

const SW_VERSION = 'v48.29';
const SHELL_CACHE = 'aio-shell-' + SW_VERSION;
const DATA_CACHE  = 'aio-data-'  + SW_VERSION;

// 앱 셸 — 최초 설치 시 pre-cache
// v48.29: 4개 모듈 모두 외부 분리 (MODULE 1/2/3/4 = core/data/ui/chat)
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './js/aio-core.js',
  './js/aio-data.js',
  './js/aio-ui.js',
  './js/aio-chat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'
];

// API/데이터 URL 패턴 — Network-First + 캐시 폴백
const DATA_URL_PATTERNS = [
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
      // shell 항목만 pre-cache (일부 실패해도 설치 계속)
      return Promise.allSettled(
        SHELL_ASSETS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[AIO SW] shell cache miss:', url, e.message);
          });
        })
      );
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

  // 1) 앱 셸 — Cache-First (네트워크 실패 시에도 즉시 응답)
  const isShell = SHELL_ASSETS.some(function(asset) {
    return url.endsWith(asset.replace('./','')) || url === asset;
  });
  if (isShell) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        if (cached) {
          // 백그라운드 갱신 (stale-while-revalidate)
          fetch(request).then(function(fresh) {
            if (fresh && fresh.ok) {
              caches.open(SHELL_CACHE).then(function(c) { c.put(request, fresh.clone()); });
            }
          }).catch(function(){});
          return cached;
        }
        return fetch(request).then(function(resp) {
          if (resp && resp.ok) {
            var clone = resp.clone();
            caches.open(SHELL_CACHE).then(function(c) { c.put(request, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // 2) 데이터/API — Network-First + 캐시 폴백 (offline 시 마지막 캐시 응답)
  const isData = DATA_URL_PATTERNS.some(function(re) { return re.test(url); });
  const isNews = NEWS_URL_PATTERNS.some(function(re) { return re.test(url); });
  if (isData || isNews) {
    event.respondWith(
      fetch(request).then(function(resp) {
        if (resp && resp.ok && resp.status === 200) {
          var clone = resp.clone();
          caches.open(DATA_CACHE).then(function(c) {
            // 데이터 캐시는 500개 제한 (오래된 것부터 제거)
            c.put(request, clone);
            c.keys().then(function(keys) {
              if (keys.length > 500) {
                c.delete(keys[0]);
              }
            });
          });
        }
        return resp;
      }).catch(function() {
        // offline or 네트워크 실패 → 캐시 폴백
        return caches.match(request).then(function(cached) {
          if (cached) return cached;
          // 캐시도 없으면 기본 offline 응답
          return new Response(JSON.stringify({
            _offline: true,
            _sw_version: SW_VERSION,
            _message: 'Offline and no cached data available'
          }), {
            status: 503,
            statusText: 'Service Unavailable (offline)',
            headers: { 'Content-Type': 'application/json' }
          });
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
  }
});
