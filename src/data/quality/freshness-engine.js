// v59.19 (roadmap 11, layer 2 quality/evidence): the freshness helpers moved out of js/aio-core.js unchanged —
// FRESHNESS_ENGINE (date normalising, stale checks and the relative-age badge), AIO_Cache (the TTL localStorage cache),
// _aioFeedHealth (RSS/API feed dead-endpoint tracking) and the _lastFetch/_markFetch registry. The classic scripts read
// them as window globals; src/app/compatibility-globals.js installs them at boot.
export function installFreshnessEngine(window = globalThis) {
  // ═══════════════════════════════════════════════════════════════════════════
  // v48.36: FRESHNESS_ENGINE (v58.51: renamed from window.DATE_ENGINE, which shared its name with the calendar const DATE_ENGINE below) — 날짜 표준화 + Stale 감지 중앙 유틸
  // ─────────────────────────────────────────────────────────────────────────
  // 용도: DATA_SNAPSHOT · SCREENER_DB · _lastFetch · 뉴스 타임스탬프 등
  //       프로젝트 전체에서 **단일 진실의 원천**으로 사용.
  // 철학:
  //   - 하드코딩 날짜 문자열 금지 (FRESHNESS_ENGINE.now() / .isoNow() 사용)
  //   - stale 판정은 isStale(ts, maxAgeMs)로 통일
  //   - UI 배지는 staleBadge(ts)로 자동 생성 (실시간 · N분 전 · N일 전)
  //   - 애널리스트 리포트는 staleBadge(ts, 'report')로 7일 이상이면 경고
  // ═══════════════════════════════════════════════════════════════════════════
  window.FRESHNESS_ENGINE = (function() {
    var MIN = 60000, HR = 3600000, DAY = 86400000;
    var LOCALE = 'ko-KR';
    var TZ_LABEL = 'Asia/Seoul';

    // stale 임계값 (카테고리별) — 이 값을 기준으로 UI 배지 색상 결정
    var STALE_THRESHOLDS = {
      quote: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.quote && window.FRESHNESS_POLICY.quote.staleMs) || 10 * MIN,
      news: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.news && window.FRESHNESS_POLICY.news.staleMs) || 60 * MIN,
      sentiment: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.sentiment && window.FRESHNESS_POLICY.sentiment.staleMs) || 30 * MIN,
      macro: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.macro_daily && window.FRESHNESS_POLICY.macro_daily.staleMs) || 7 * DAY,
      report: 7 * DAY,          // 애널리스트 리포트 7일
      earnings: 90 * DAY,       // 실적 분기
      snapshot: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.static_snapshot && window.FRESHNESS_POLICY.static_snapshot.staleMs) || 72 * HR,
      unknown: 24 * HR
    };

    function now() { return Date.now(); }
    function isoNow() { return new Date().toISOString(); }

    function toTs(v) {
      if (v == null) return 0;
      if (typeof v === 'number') return v > 1e12 ? v : v * 1000;  // seconds vs ms auto
      if (typeof v === 'string') {
        var t = Date.parse(v);
        return isNaN(t) ? 0 : t;
      }
      if (v instanceof Date) return v.getTime();
      return 0;
    }

    function ageMs(v) {
      var t = toTs(v);
      if (!t) return Infinity;
      return now() - t;
    }

    function isStale(v, category) {
      var threshold = STALE_THRESHOLDS[category] || STALE_THRESHOLDS.unknown;
      return ageMs(v) > threshold;
    }

    // "방금", "3분 전", "2시간 전", "3일 전"
    function formatRelative(v) {
      var a = ageMs(v);
      if (a === Infinity) return '—';
      if (a < 30000) return '방금';
      if (a < HR) return Math.floor(a / MIN) + '분 전';
      if (a < DAY) return Math.floor(a / HR) + '시간 전';
      if (a < 30 * DAY) return Math.floor(a / DAY) + '일 전';
      if (a < 365 * DAY) return Math.floor(a / (30 * DAY)) + '개월 전';
      return Math.floor(a / (365 * DAY)) + '년 전';
    }

    // "2026-04-19 13:45" — 한국 로케일
    function formatAbsolute(v, opts) {
      var t = toTs(v);
      if (!t) return '—';
      var d = new Date(t);
      opts = opts || {};
      try {
        if (opts.dateOnly) {
          return d.toLocaleDateString(LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ_LABEL });
        }
        return d.toLocaleString(LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ_LABEL });
      } catch(_) {
        return d.toISOString().slice(0, 16).replace('T', ' ');
      }
    }

    // 실시간 · 3분 전 · 3일 전 (stale 여부 기반 색상)
    function staleBadge(v, category, opts) {
      opts = opts || {};
      var t = toTs(v);
      if (!t) return opts.emptyText || '';
      var a = ageMs(v);
      var threshold = STALE_THRESHOLDS[category] || STALE_THRESHOLDS.unknown;
      var icon, tone;
      if (a < threshold * 0.3) { icon = ''; tone = 'fresh'; }   // fresh (30% of threshold)
      else if (a < threshold) { icon = ''; tone = 'aging'; }    // aging
      else { icon = ''; tone = 'stale'; }                        // stale
      var label = formatRelative(v);
      if (opts.asHtml === false) return icon + ' ' + label;
      // v59.19: the colour and type come from .aio-stale-badge (src/ui/styles/legacy-core.css) — the old inline colours, at
      // the --fs-min floor instead of 11px; the unused opts.fontSize override went with it.
      return '<span class="aio-stale-badge aio-stale-badge--' + tone + '" title="' + formatAbsolute(v) + '">' + icon + ' ' + label + '</span>';
    }

    // 여러 타임스탬프 중 가장 오래된 것 기준 stale 판정 (데이터 일관성)
    function oldest(vals) {
      var min = Infinity;
      for (var i = 0; i < vals.length; i++) {
        var t = toTs(vals[i]);
        if (t && t < min) min = t;
      }
      return min === Infinity ? 0 : min;
    }

    return {
      now: now,
      isoNow: isoNow,
      toTs: toTs,
      ageMs: ageMs,
      isStale: isStale,
      formatRelative: formatRelative,
      formatAbsolute: formatAbsolute,
      staleBadge: staleBadge,
      oldest: oldest,
      THRESHOLDS: STALE_THRESHOLDS
    };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // v48.38: 통일된 캐시 레이어 — localStorage 기반, 명시적 TTL + 만료 감지
  // ─────────────────────────────────────────────────────────────────────────
  // 철학:
  //   - 모든 localStorage 캐시는 이 API 경유 (난립 방지)
  //   - TTL 초과 시 자동 만료 (get 반환 null)
  //   - 용량 초과 시 LRU-like 정리 (오래된 항목 자동 삭제)
  // ═══════════════════════════════════════════════════════════════════════════
  window.AIO_Cache = (function() {
    var PREFIX = '_aioCache:';
    var DEFAULT_TTL = 60 * 60 * 1000; // 1시간

    function _key(k) { return PREFIX + k; }

    function get(k) {
      try {
        var raw = localStorage.getItem(_key(k));
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (!obj || !obj.v) return null;
        if (obj.exp && Date.now() > obj.exp) {
          localStorage.removeItem(_key(k));
          return null;
        }
        return obj.v;
      } catch(_) { return null; }
    }

    function set(k, v, ttlMs) {
      try {
        var ttl = typeof ttlMs === 'number' ? ttlMs : DEFAULT_TTL;
        var obj = { v: v, exp: Date.now() + ttl, set: Date.now() };
        localStorage.setItem(_key(k), JSON.stringify(obj));
        return true;
      } catch(e) {
        // QuotaExceededError — LRU-like 정리 후 재시도
        if (e && e.name && e.name.indexOf('Quota') !== -1) {
          _prune();
          try {
            localStorage.setItem(_key(k), JSON.stringify({ v: v, exp: Date.now() + (ttlMs || DEFAULT_TTL), set: Date.now() }));
            return true;
          } catch(_) { return false; }
        }
        return false;
      }
    }

    function del(k) { try { localStorage.removeItem(_key(k)); } catch(_){} }

    function _prune() {
      // 만료된 항목 먼저 정리 → 여전히 꽉 차면 오래된 20% 제거
      var now = Date.now();
      var entries = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(PREFIX) !== 0) continue;
        try {
          var obj = JSON.parse(localStorage.getItem(key));
          if (obj && obj.exp && now > obj.exp) {
            localStorage.removeItem(key); i--;
          } else if (obj) {
            entries.push({ key: key, set: obj.set || 0 });
          }
        } catch(_) { localStorage.removeItem(key); i--; }
      }
      if (entries.length > 10) {
        entries.sort(function(a, b) { return a.set - b.set; });
        var toRemove = Math.ceil(entries.length * 0.2);
        for (var j = 0; j < toRemove; j++) localStorage.removeItem(entries[j].key);
      }
    }

    function stats() {
      var count = 0, totalBytes = 0, expired = 0;
      var now = Date.now();
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(PREFIX) !== 0) continue;
        count++;
        var val = localStorage.getItem(key);
        totalBytes += (val || '').length + key.length;
        try {
          var obj = JSON.parse(val);
          if (obj && obj.exp && now > obj.exp) expired++;
        } catch(_){}
      }
      return { count: count, bytes: totalBytes, kb: Math.round(totalBytes / 1024), expired: expired };
    }

    function clear() {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function(k) { localStorage.removeItem(k); });
      return keys.length;
    }

    return { get: get, set: set, del: del, stats: stats, clear: clear, prune: _prune };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // v48.38: RSS/API 피드 헬스체크 — dead endpoint 자동 비활성화
  // ─────────────────────────────────────────────────────────────────────────
  // - 각 피드의 성공/실패 카운트 추적 (1시간 window + 24시간 window)
  // - 24h 내 3회+ 연속 실패 시 _disabled=true 자동 전환 (다음 fetch에서 skip)
  // - 1h window 내 성공 1회 이상 있으면 복구
  // - 상태는 localStorage 저장 (_aioFeedHealth), 세션 간 지속
  // ═══════════════════════════════════════════════════════════════════════════
  window._aioFeedHealth = (function() {
    var KEY = '_aioFeedHealthV1';
    var FAIL_THRESHOLD = 3;        // 연속 실패 N회 → disable
    var WINDOW_24H = 24 * 3600 * 1000;
    var RECOVER_AFTER = 2 * 3600 * 1000;   // 2시간 후 disabled 해제 재시도

    var state = {};
    try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(_){ state = {}; }

    function _save() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(_){}
    }

    function _get(id) {
      if (!state[id]) state[id] = { ok: 0, fail: 0, consecFail: 0, lastOk: 0, lastFail: 0, disabledUntil: 0 };
      return state[id];
    }

    function reportOk(id) {
      var s = _get(id);
      s.ok++; s.consecFail = 0; s.lastOk = Date.now(); s.disabledUntil = 0;
      _save();
    }

    function reportFail(id) {
      var s = _get(id);
      s.fail++; s.consecFail++; s.lastFail = Date.now();
      if (s.consecFail >= FAIL_THRESHOLD) {
        s.disabledUntil = Date.now() + RECOVER_AFTER;
      }
      _save();
    }

    function isDisabled(id) {
      var s = state[id];
      if (!s) return false;
      if (s.disabledUntil && Date.now() < s.disabledUntil) return true;
      if (s.disabledUntil && Date.now() >= s.disabledUntil) {
        // Recovery: disabledUntil 지나면 재시도 허용 (하지만 consecFail 유지)
        s.disabledUntil = 0;
        _save();
      }
      return false;
    }

    function stats() {
      var now = Date.now();
      var summary = { total: 0, ok: 0, degraded: 0, disabled: 0, details: [] };
      for (var id in state) {
        summary.total++;
        var s = state[id];
        var status = 'ok';
        if (s.disabledUntil && now < s.disabledUntil) { status = 'disabled'; summary.disabled++; }
        else if (s.consecFail >= 2) { status = 'degraded'; summary.degraded++; }
        else summary.ok++;
        summary.details.push({ id: id, status: status, ok: s.ok, fail: s.fail, consecFail: s.consecFail, lastOk: s.lastOk });
      }
      return summary;
    }

    function reset(id) {
      if (id) delete state[id];
      else state = {};
      _save();
    }

    return {
      reportOk: reportOk,
      reportFail: reportFail,
      isDisabled: isDisabled,
      stats: stats,
      reset: reset,
      _raw: function() { return state; }
    };
  })();

  // v48.36: _lastFetch — API별 마지막 성공 타임스탬프 중앙 저장소
  // 각 fetch 함수가 성공 시 FRESHNESS_ENGINE.now() 값을 기록.
  // UI는 staleBadge(_lastFetch[apiName], category)로 freshness 표시.
  window._lastFetch = window._lastFetch || {};
  window._markFetch = function(apiName) {
    window._lastFetch[apiName] = window.FRESHNESS_ENGINE.now();
  };
  return window;
}
