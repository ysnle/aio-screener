// v59.31 (roadmap 11, layer 4 boot sequence): the IndexedDB news cache moved out of js/aio-data.js unchanged — the
// news-scoped DB (AIOScreenerNewsCache), the one-time copy from the legacy AIOScreenerDB name (P1238), and the save
// and load used by fetchAllNews and the boot render. The functions stay window globals for those classic callers.
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installNewsCache(window = globalThis) {
  /* ── Phase D: IndexedDB 뉴스 캐시 (v48.63) ─────────────────────────────── */
  // 뉴스 원본을 IDB에 저장 → 새로고침 후 fetchAllNews 완료 전 즉시 렌더
  // E2/S-F (P1238): 이 DB는 뉴스 캐시 전용인데 이름이 스크리너 저장소처럼 읽혔다. 이름을 뉴스
  // 범위로 바꾸고, 이전 이름의 DB는 삭제하지 않고 'news' 스토어가 비었을 때만 복사한다(마이그레이션).
  const _AIO_IDB_NAME = 'AIOScreenerNewsCache';
  const _AIO_IDB_LEGACY_NAME = 'AIOScreenerDB';
  const _AIO_IDB_VER  = 1;

  function _idbOpen() {
    return new Promise(function(resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IDB 미지원')); return; }
      var req = indexedDB.open(_AIO_IDB_NAME, _AIO_IDB_VER);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('news')) {
          var os = db.createObjectStore('news', { keyPath: '_idbKey' });
          os.createIndex('ts', 'ts', { unique: false });
        }
      };
      req.onsuccess = function(e) {
        resolve(e.target.result);
        _idbMigrateLegacyNews(e.target.result);
      };
      req.onerror   = function()  { reject(req.error); };
    });
  }

  var _aioIdbMigrationDone = false;
  // S-F 마이그레이션: 새 DB가 비었고 이전 이름의 DB가 실제로 존재할 때만 'news' 레코드를 복사한다.
  // `indexedDB.open`은 없으면 DB를 만들어버리므로, 존재 확인 후에만 연다. 이전 DB는 지우지 않는다.
  function _idbMigrateLegacyNews(db) {
    if (_aioIdbMigrationDone) return Promise.resolve({ migrated: 0, reason: 'already-checked' });
    _aioIdbMigrationDone = true;
    return new Promise(function(resolve) {
      try {
        var countReq = db.transaction('news', 'readonly').objectStore('news').count();
        countReq.onerror = function() { resolve({ migrated: 0, reason: 'count-error' }); };
        countReq.onsuccess = function() {
          if (countReq.result > 0) { resolve({ migrated: 0, reason: 'store-not-empty' }); return; }
          var exists = Promise.resolve(true);
          if (typeof indexedDB.databases === 'function') {
            exists = indexedDB.databases().then(function(list) {
              return (list || []).some(function(entry) { return entry && entry.name === _AIO_IDB_LEGACY_NAME; });
            }).catch(function() { return false; });
          }
          exists.then(function(present) {
            if (!present) { resolve({ migrated: 0, reason: 'legacy-absent' }); return; }
            var legacyReq = indexedDB.open(_AIO_IDB_LEGACY_NAME);
            legacyReq.onerror = function() { resolve({ migrated: 0, reason: 'legacy-unavailable' }); };
            legacyReq.onsuccess = function(e) {
              var legacy = e.target.result;
              try {
                if (!legacy.objectStoreNames.contains('news')) { legacy.close(); resolve({ migrated: 0, reason: 'legacy-store-absent' }); return; }
                var rows = [];
                var cursorReq = legacy.transaction('news', 'readonly').objectStore('news').openCursor();
                cursorReq.onerror = function() { legacy.close(); resolve({ migrated: 0, reason: 'cursor-error' }); };
                cursorReq.onsuccess = function(event) {
                  var cursor = event.target.result;
                  if (cursor) { rows.push(cursor.value); cursor.continue(); return; }
                  legacy.close();
                  try {
                    var tx = db.transaction('news', 'readwrite');
                    rows.forEach(function(row) { try { tx.objectStore('news').put(row); } catch (_) {} });
                  } catch (_) {}
                  resolve({ migrated: rows.length, reason: 'copied' });
                };
              } catch (err) { try { legacy.close(); } catch (_) {} resolve({ migrated: 0, reason: 'legacy-error' }); }
            };
          });
        };
      } catch (e) { resolve({ migrated: 0, reason: 'error' }); }
    });
  }

  async function _idbSaveNews(items) {
    try {
      if (!items || !items.length) return;
      var db = await _idbOpen();
      var tx = db.transaction('news', 'readwrite');
      var os = tx.objectStore('news');
      var ts = Date.now();
      items.forEach(function(item) {
        var key = String(item.link || item.title || '').slice(0, 200);
        if (!key) return;
        var rec = Object.assign({}, item, { _idbKey: key, ts: ts });
        os.put(typeof window._aioRedactPII === 'function' ? window._aioRedactPII(rec) : rec);
      });
      // 7일 초과 항목 비동기 정리
      var cutoff = ts - 7 * 24 * 3600000;
      var delReq = os.index('ts').openCursor(IDBKeyRange.upperBound(cutoff));
      delReq.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    } catch(e) {} // 프라이빗 모드 등 IDB 비가용 환경 무시
  }

  async function _idbLoadNews(maxAgeMs) {
    maxAgeMs = maxAgeMs || 4 * 3600000; // 기본 4시간
    try {
      var db = await _idbOpen();
      return new Promise(function(resolve) {
        var tx  = db.transaction('news', 'readonly');
        var req = tx.objectStore('news').getAll();
        req.onsuccess = function() {
          var cutoff = Date.now() - maxAgeMs;
          var items  = (req.result || []).filter(function(i) { return i.ts > cutoff; });
          items.sort(function(a, b) { return (b.pubDate ? new Date(b.pubDate) : 0) - (a.pubDate ? new Date(a.pubDate) : 0); });
          resolve(items.length > 0 ? items : null);
        };
        req.onerror = function() { resolve(null); };
      });
    } catch(e) { return null; }
  }

  window._idbOpen = _idbOpen;
  window._idbMigrateLegacyNews = _idbMigrateLegacyNews;
  window._idbSaveNews = _idbSaveNews;
  window._idbLoadNews = _idbLoadNews;
  return window;
}
