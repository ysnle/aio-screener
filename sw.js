// AIO Screener Service Worker v34.9
const CACHE_NAME = 'aio-v34.9';
const ASSETS = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Network-first strategy for API calls, cache-first for assets
  if (event.request.url.includes('api.') || event.request.url.includes('query1.') || event.request.url.includes('corsproxy')) {
    // Network only for API calls
    event.respondWith(fetch(event.request).catch(function() {
      return new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetched = fetch(event.request).then(function(response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || fetched;
    })
  );
});