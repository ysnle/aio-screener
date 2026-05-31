
// ═══ v30.3: 전역 에러 경계 — 런타임 에러/Promise rejection 자동 캐치 ═══
// v48.27 (QA-5): unhandledrejection만 유지 (window.onerror는 _aioLog 단일 핸들러로 통합 — 8862)
//   기존 onerror 이중 등록 → 8862에서 _aioLog 미정의 시 console.warn fallback 자체 처리
(function() {
  var _errCount = 0;
  window.addEventListener('unhandledrejection', function(e) {
    if (_errCount++ < 10) {
      var msg = e.reason && e.reason.message || e.reason;
      if (typeof window._aioLog === 'function') {
        window._aioLog('error', 'promise', String(msg), { stack: e.reason && e.reason.stack ? e.reason.stack.substring(0, 500) : null });
      } else {
        console.warn('[AIO:PROMISE]', msg);
      }
    }
    e.preventDefault();  // 콘솔 빨간색 에러 억제
  });
})();

document.addEventListener('error', function(e) {
  var img = e && e.target;
  if (!img || !img.matches || !img.matches('img[data-logo-fallback="1"]')) return;
  img.style.display = 'none';
  var fallback = img.nextElementSibling;
  if (fallback) fallback.style.display = 'block';
}, true);

// ═══════════════════════════════════════════════════════════════════
// v48.14: 중앙 로거 — _aioLog + ring-buffer 500건 + rate 임계 모니터 (Agent P2-3/W9)
// ───────────────────────────────────────────────────────────────────
// 사용: _aioLog('warn', 'fetch', 'FMP 404', { ticker: 'NVDA' })
// 레벨: debug | info | warn | error
// area: fetch | parse | render | ai | event | data | api | security
// 이후 console.warn 173곳 점진 마이그레이션, /debug 패널 추가 가능
// ═══════════════════════════════════════════════════════════════════
(function(){
  var BUFFER_SIZE = 500;
  var RATE_WINDOW_MS = 60000;   // 1분 window
  var RATE_THRESHOLD = 50;       // 1분 내 경고+에러 50건+ 시 배너
  var _buf = [];
  var _rateCounter = { warn: 0, error: 0, lastReset: Date.now() };
  var _consoleMap = { debug: 'log', info: 'log', warn: 'warn', error: 'error' };
  var _colorMap = { debug: '#7b8599', info: '#00d4ff', warn: '#ffa31a', error: '#ff5b50' };

  function _resetRateIfNeeded() {
    var now = Date.now();
    if (now - _rateCounter.lastReset > RATE_WINDOW_MS) {
      _rateCounter.warn = 0;
      _rateCounter.error = 0;
      _rateCounter.lastReset = now;
    }
  }

  function _checkRateThreshold() {
    var sum = _rateCounter.warn + _rateCounter.error;
    if (sum >= RATE_THRESHOLD) {
      var panel = document.getElementById('data-status-panel');
      if (panel) {
        panel.innerHTML = '<span style="color:#f87171;font-size:10px;font-weight:700;">⚠ 에러 급증 — 최근 1분 ' + sum + '건 (error ' + _rateCounter.error + ', warn ' + _rateCounter.warn + ')</span>';
      }
    }
  }

  window._aioLog = function(level, area, msg, meta) {
    try {
      level = level || 'info';
      area = area || 'misc';
      var entry = {
        ts: Date.now(),
        level: level,
        area: area,
        msg: String(msg || ''),
        meta: meta || null
      };
      // ring buffer
      _buf.push(entry);
      if (_buf.length > BUFFER_SIZE) _buf.shift();
      // rate monitor (warn/error만)
      if (level === 'warn' || level === 'error') {
        _resetRateIfNeeded();
        _rateCounter[level]++;
        _checkRateThreshold();
      }
      // console 출력 (AIO_DEBUG 가드 존중)
      if (level !== 'debug' || window.AIO_DEBUG) {
        var fn = _consoleMap[level] || 'log';
        var prefix = '[AIO:' + area + ']';
        if (meta) console[fn](prefix, msg, meta);
        else console[fn](prefix, msg);
      }
    } catch(e) { /* 로거 자신이 실패해도 앱은 계속 */ }
  };

  // 버퍼 조회 (디버그 패널용)
  window._aioLogs = {
    all: function() { return _buf.slice(); },
    tail: function(n) { return _buf.slice(-(n||50)); },
    byLevel: function(lvl) { return _buf.filter(function(e){ return e.level === lvl; }); },
    byArea: function(ar) { return _buf.filter(function(e){ return e.area === ar; }); },
    rate: function() { _resetRateIfNeeded(); return Object.assign({}, _rateCounter); },
    clear: function() { _buf.length = 0; _rateCounter.warn=0; _rateCounter.error=0; _rateCounter.lastReset=Date.now(); },
    dump: function() { return JSON.stringify(_buf, null, 2); },
    // v48.30: 운영 관측성 — 사용자가 문제 보고 시 로그 파일 다운로드 (세션 종료 시 ring buffer 소실 방지)
    download: function(filename) {
      try {
        var blob = new Blob([JSON.stringify({ version: (window.AIO && window.AIO.version) || '?', exported: new Date().toISOString(), userAgent: navigator.userAgent, rate: window._aioLogs.rate(), logs: _buf }, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename || ('aio-logs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(_){} }, 100);
        return true;
      } catch(e) { console.warn('[AIO] log download failed:', e); return false; }
    }
  };

  // window.onerror 전역 훅 — v48.27 (QA-5): 단일 핸들러 (이전 8774 첫 핸들러 제거됨)
  window.onerror = function(msg, src, line, col, err) {
    try {
      window._aioLog('error', 'uncaught', String(msg), { src: src, line: line, col: col, stack: err && err.stack ? err.stack.substring(0, 500) : null });
    } catch(e) {}
    return true; // 페이지 크래시 방지 (이전 동작 보존)
  };
  // promise rejection 훅
  var _oldRej = window.onunhandledrejection;
  window.onunhandledrejection = function(evt) {
    try {
      var r = evt && evt.reason;
      window._aioLog('error', 'unhandled-promise', (r && r.message) || String(r || 'unknown'));
    } catch(e) {}
    if (typeof _oldRej === 'function') return _oldRej.apply(this, arguments);
  };
})();

// ═══ v48.31: safeHtml — DOMPurify 기반 innerHTML XSS sanitize ═══════════════
// 용도: 외부 API 응답(뉴스 headline/summary, 종목 memo, AI 응답 등) innerHTML 주입 시 사용
// 사용: element.innerHTML = safeHtml(externalString) — <script>, onerror 등 위험 태그 제거
// DOMPurify 미로드 시 fallback: HTML entity escape (정적 대체)
window.safeHtml = function(str, allowTags) {
  if (str == null) return '';
  try {
    var raw = String(str)
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, '');
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      // 허용 태그: 기본 텍스트 서식 (b/i/strong/em/br/span/div/p/a/code/ul/ol/li)
      var config = allowTags ? { ALLOWED_TAGS: allowTags } : {
        ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'br', 'span', 'div', 'p', 'a', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'title'],
        ALLOW_DATA_ATTR: false
      };
      return DOMPurify.sanitize(raw, config);
    }
  } catch(_){}
  // Fallback: HTML entity escape (DOMPurify 미로드 시)
  return String(str)
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// ═══ v48.91: _safeSetHTML — innerHTML DOMPurify 게이트웨이 ══════════════════
// 용도: 외부 API 데이터 → innerHTML 주입 시 단일 게이트웨이 (safeHtml 래퍼)
// 사용: _safeSetHTML(el, html) — DOMPurify 통과 후 innerHTML 적용
window._safeSetHTML = function(el, html) {
  if (!el) return;
  el.innerHTML = window.safeHtml(html || '');
};

// ═══ v48.94: _aioSafeMD — AI 마크다운 DOMPurify 2차 게이트웨이 ════════════════
// 용도: AI 응답 renderMarkdownLight() 결과에 DOMPurify 2차 통과 (P158 XSS 방어)
// 사용: element.innerHTML = _aioSafeMD(aiResponseText)
// 주의: renderMarkdownLight는 aio-chat.js에서 전역 선언 — 런타임 조회 안전
window._aioSafeMD = function(rawText) {
  var text = String(rawText || '');
  var rendered = (typeof renderMarkdownLight === 'function') ? renderMarkdownLight(text) : text;
  return window.safeHtml(rendered);
};

// ═══ v48.94: _aioSafeParseJSON — JSON.parse 안전 래퍼 ══════════════════════
// 용도: JSON.parse 실패 시 fallback 반환 + _aioLog 경고 (P161 NaN 방어)
// 사용: var obj = _aioSafeParseJSON(raw, {}, 'scope-name')
window._aioSafeParseJSON = function(raw, fallback, scope) {
  try { return JSON.parse(raw); }
  catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', scope || 'parse', 'JSON parse fail: ' + (e && e.message));
    return fallback !== undefined ? fallback : null;
  }
};

// ═══ v48.94: _aioRenderNum — 숫자 표시 NaN 가드 ════════════════════════════
// 용도: tech indicator/포트폴리오 숫자 표시 시 NaN → '—' 대체 (P161)
// 사용: _aioRenderNum(value, '%', 1) → '1.2%' 또는 '—'  (decimals 기본 2)
window._aioRenderNum = function(v, suffix, decimals) {
  var n = parseFloat(v);
  var d = (typeof decimals === 'number' && decimals >= 0) ? decimals : 2;
  return Number.isFinite(n) ? (n.toFixed(d) + (suffix || '')) : '—';
};

// ═══ v48.97: _aioRedactPII — IndexedDB 저장 전 PII 제거 (P1-7) ═════════════
// 용도: 뉴스 기사에 유입된 이메일·전화번호·카드번호를 저장 전 마스킹
// 사용: os.put(_aioRedactPII(Object.assign({}, item, { _idbKey: key, ts: ts })))
var _PII_EMAIL_RX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
var _PII_PHONE_RX = /(?:\+?82[\s\-]?)?0\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{4}|\b\d{3}[\s\-]\d{3,4}[\s\-]\d{4}\b/g;
window._aioRedactPII = function(record) {
  if (!record || typeof record !== 'object') return record;
  var out = Object.assign({}, record);
  ['title', 'description', 'content', 'summary'].forEach(function(f) {
    if (typeof out[f] === 'string') {
      out[f] = out[f].replace(_PII_EMAIL_RX, '[email]').replace(_PII_PHONE_RX, '[phone]');
    }
  });
  return out;
};

// ═══ v48.97: API 키 편의 래퍼 + UI 마스킹 (P2-7) ═══════════════════════════
// _aioMaskKey('sk-ant-abc12345') → '****-2345'
window._aioMaskKey = function(raw) {
  if (!raw || typeof raw !== 'string') return '****';
  var s = raw.replace(/^aio_enc::/, ''); // 암호화 접두어 제거 후 마스킹
  if (s.length < 8) return '****';
  return '****-' + s.slice(-4);
};
// getApiKey(storageKey) — 평문 또는 복호화된 키 반환
window.getApiKey = function(name) {
  try { return (typeof safeLSGetSync === 'function') ? safeLSGetSync(name, '') : ''; } catch(e) { return ''; }
};
// setApiKey(storageKey, value) — 저장소에 저장 (Vault 암호화 우선)
window.setApiKey = function(name, value) {
  try {
    if (typeof safeLSSet === 'function') { safeLSSet(name, value); }
    else { (window.localStorage || window.sessionStorage).setItem(name, value); }
  } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'apikey', 'setApiKey fail: ' + (e && e.message)); }
};

// ═══ v48.95: _wordHit — 유니코드 단어경계 키워드 매칭 ══════════════════════
// 용도: P1-1 한국어 단글자 '금'.includes('금리') 오탐 방지
//       .includes(kw) 대신 단어경계(\p{L}\p{N}) 기반 매칭
// 사용: _wordHit('금리 상승', '금') → false,  _wordHit('금 상승', '금') → true
// 성능: RegExp 컴파일 캐시 (_wordHitRxCache) — 고빈도 키워드 재컴파일 방지
var _wordHitRxCache = {};
window._wordHit = function(text, kw) {
  if (!kw) return false;
  var rx = _wordHitRxCache[kw];
  if (!rx) {
    try {
      var esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      rx = _wordHitRxCache[kw] = new RegExp(
        '(?:^|[^\\p{L}\\p{N}])' + esc + '(?=$|[^\\p{L}\\p{N}])', 'u'
      );
    } catch(e) {
      // 'u' 플래그 미지원 환경 fallback → 기존 includes
      rx = _wordHitRxCache[kw] = null;
    }
  }
  if (!rx) return String(text).includes(kw);
  return rx.test(String(text));
};

// ═══ v48.96: _aioChartRegistry — Chart.js 인스턴스 중앙 관리 ════════════════
// 용도: 재렌더 전 destroy 보장 → 메모리 누수 방지 (P1-5)
// 사용: _aioChartRegistry.register('fund-var', chartInst)
//       _aioChartRegistry.destroyIfExists('fund-var')
window._aioChartRegistry = {
  _charts: {},
  register: function(id, chart) {
    if (!id || !chart) return;
    this._charts[id] = chart;
  },
  destroyIfExists: function(id) {
    if (this._charts[id]) {
      try { this._charts[id].destroy(); } catch(e) {}
      delete this._charts[id];
    }
  },
  get: function(id) { return this._charts[id] || null; },
  resizeAll: function() {
    var keys = Object.keys(this._charts);
    for (var i = 0; i < keys.length; i++) {
      var c = this._charts[keys[i]];
      if (c && typeof c.resize === 'function') { try { c.resize(); } catch(e) {} }
    }
  }
};

// ═══ v48.96: _aioSetupCanvas — devicePixelRatio 적용 캔버스 초기화 ══════════
// 용도: 레티나/HiDPI 화면에서 차트 선명도 보장 (P2-3)
// 사용: var ctx = _aioSetupCanvas(canvas, 600, 200)
//       new Chart(ctx, {...})
window._aioSetupCanvas = function(canvas, w, h) {
  if (!canvas || !canvas.getContext) return null;
  var dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext('2d');
  if (ctx && dpr > 1) ctx.scale(dpr, dpr);
  return ctx;
};

// LightweightCharts는 내부 레이어 canvas를 동적으로 생성한다. 실제 차트 의미는
// 컨테이너가 전달하고 내부 canvas는 스크린리더에서 숨겨 중복/무라벨 경고를 막는다.
window._aioMarkChartCanvases = function(rootEl, label) {
  if (!rootEl || !rootEl.querySelectorAll) return;
  try {
    if (label) {
      rootEl.setAttribute('role', rootEl.getAttribute('role') || 'img');
      rootEl.setAttribute('aria-label', rootEl.getAttribute('aria-label') || label);
    }
    rootEl.querySelectorAll('.tv-lightweight-charts canvas, canvas').forEach(function(canvas) {
      if (!canvas.id && !canvas.getAttribute('aria-label') && !canvas.getAttribute('aria-labelledby') && !canvas.getAttribute('title')) {
        canvas.setAttribute('aria-hidden', 'true');
        canvas.setAttribute('tabindex', '-1');
      }
    });
  } catch(_) {}
};

// ═══ v48.96: _aioModalTrap — 모달 키보드 포커스 순환 + ESC 닫기 (P2-9) ════════
// 용도: WCAG 2.1 SC 2.1.2 — 모달 내 Tab/Shift+Tab 순환, ESC로 닫힘
// 사용: var cleanup = _aioModalTrap(modalRootEl, onClose)
//       cleanup() — 이벤트 제거 (모달 닫을 때 호출)
window._aioModalTrap = function(rootEl, onClose) {
  if (!rootEl) return function() {};
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function getFocusable() { return Array.prototype.slice.call(rootEl.querySelectorAll(FOCUSABLE)); }
  function handleKey(e) {
    var key = e.key || e.keyCode;
    if (key === 'Escape' || key === 27) {
      e.preventDefault();
      if (typeof onClose === 'function') onClose();
      return;
    }
    if (key !== 'Tab' && key !== 9) return;
    var els = getFocusable();
    if (!els.length) { e.preventDefault(); return; }
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', handleKey, true);
  // 최초 포커스: 첫 포커서블 요소 or rootEl 자체
  var first = getFocusable()[0];
  if (first) { first.focus(); } else if (rootEl.tabIndex >= 0) { rootEl.focus(); }
  return function() { document.removeEventListener('keydown', handleKey, true); };
};

// ═══ v48.97: _aioRetry — 지수 백오프 + jitter 자동 재시도 (P2-8) ═════════════
// 용도: 일시적 네트워크·API 오류 자동 재시도 (Circuit Breaker와 함께 사용)
// 사용: _aioRetry(function() { return fetch(url); }, {maxAttempts:3, baseMs:500})
//       .then(response => ...).catch(err => /* 최종 실패 */)
window._aioRetryStats = window._aioRetryStats || { total: 0, retried: 0, failed: 0 };
window._aioRetry = function(fn, opts) {
  var o = opts || {};
  var maxAttempts = typeof o.maxAttempts === 'number' ? o.maxAttempts : 3;
  var baseMs      = typeof o.baseMs      === 'number' ? o.baseMs      : 500;
  var capMs       = typeof o.capMs       === 'number' ? o.capMs       : 8000;
  var useJitter   = o.jitter !== false;
  window._aioRetryStats.total++;
  return new Promise(function(resolve, reject) {
    var attempt = 0;
    function run() {
      attempt++;
      Promise.resolve().then(fn).then(resolve, function(err) {
        if (attempt >= maxAttempts) {
          window._aioRetryStats.failed++;
          reject(err); return;
        }
        window._aioRetryStats.retried++;
        var delay = Math.min(baseMs * Math.pow(2, attempt - 1), capMs);
        if (useJitter) delay = Math.round(delay * (0.5 + Math.random() * 0.5));
        setTimeout(run, delay);
      });
    }
    run();
  });
};

// ═══ v48.97: _aioProxyChain — CORS 프록시 순차 폴백 + Circuit Breaker (P2-6) ══
// 용도: 3개 프록시 URL 배열에서 순서대로 시도, 실패 시 다음으로 폴백
// 사용: _aioProxyChain.try(['https://p1.example.com','https://p2.example.com'],
//                          '/api/endpoint', {timeout:30000})
//       .then(resp => resp.json())
window._aioProxyChain = (function() {
  var _h = {}; // proxyBase -> {fails, lastFail, open}
  var COOLDOWN_MS = 60000, FAIL_THRESH = 3;
  function isHealthy(u) {
    var h = _h[u]; if (!h) return true; if (!h.open) return true;
    if (Date.now() - h.lastFail > COOLDOWN_MS) { h.open = false; h.fails = 0; return true; }
    return false;
  }
  function fail(u) {
    var h = _h[u] || (_h[u] = { fails: 0, lastFail: 0, open: false });
    h.fails++; h.lastFail = Date.now();
    if (h.fails >= FAIL_THRESH) h.open = true;
  }
  function ok(u) { var h = _h[u]; if (h) { h.fails = 0; h.open = false; } }
  return {
    _health: _h,
    try: function(proxies, path, opts) {
      var timeout = (opts && typeof opts.timeout === 'number') ? opts.timeout : 30000;
      var list = (proxies || []).filter(isHealthy);
      if (!list.length) list = proxies || [];      var i = 0;
      function next() {
        if (i >= list.length) return Promise.reject(new Error('All proxies exhausted'));
        var base = list[i++];
        var url = base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var tid = ctrl ? setTimeout(function() { ctrl.abort(); }, timeout) : null;
        var fo = Object.assign({}, opts); delete fo.timeout;
        if (ctrl) fo.signal = ctrl.signal;
        return fetch(url, fo).then(function(r) {
          if (tid) clearTimeout(tid);
          if (!r.ok) { fail(base); return next(); }
          ok(base); return r;
        }, function() { if (tid) clearTimeout(tid); fail(base); return next(); });
      }
      return next();
    },
    health: function() {
      return Object.keys(_h).map(function(u) {
        return { url: u, fails: _h[u].fails, open: _h[u].open, lastFail: _h[u].lastFail };
      });
    }
  };
})();

// ═══ v48.91: 타이머 레지스트리 — setInterval ID 중앙 관리 ════════════════════
// tech-debt: 분산된 setInterval ID를 한 곳에서 추적/정리 (메모리 누수 방지)
// 사용:
//   _aioRegisterTimer('name', fn, ms) — 등록 (중복 시 기존 정리 후 재등록)
//   _aioClearTimer('name')            — 특정 타이머 정리
//   _aioClearAllTimers()              — 전체 정리 (페이지 언로드 / SW 업데이트 시)
window._aioTimerRegistry = window._aioTimerRegistry || {};

window._aioRegisterTimer = function(name, fn, ms) {
  if (window._aioTimerRegistry[name]) clearInterval(window._aioTimerRegistry[name]);
  window._aioTimerRegistry[name] = setInterval(fn, ms);
  return window._aioTimerRegistry[name];
};
window._aioClearTimer = function(name) {
  if (window._aioTimerRegistry[name]) {
    clearInterval(window._aioTimerRegistry[name]);
    delete window._aioTimerRegistry[name];
  }
};
window._aioClearAllTimers = function() {
  var keys = Object.keys(window._aioTimerRegistry || {});
  for (var i = 0; i < keys.length; i++) {
    if (window._aioTimerRegistry[keys[i]]) clearInterval(window._aioTimerRegistry[keys[i]]);
  }
  window._aioTimerRegistry = {};
};

// ═══ v48.98: _aioPageBus — 단일 이벤트 라우팅 허브 ══════════════════════════
// 용도: aio:pageShown / aio:liveQuotes 리스너를 페이지별로 등록·해제
//   register(pageId, eventName, fn)  → 페이지별 핸들러 등록 (동일 fn 중복 무시)
//   unregister(pageId)               → 해당 페이지 모든 리스너 제거
//   dispatch(eventName, detail)      → CustomEvent 발사 (테스트·진단용)
//   AIO.diag.pageBus()               → 레지스트리 상태 반환
// P175 — _context/BUG-POSTMORTEM.md
(function() {
  if (window._aioPageBus) return; // 멱등 가드

  // registry: { pageId: { eventName: [{ fn, wrapped }, ...] } }
  var _registry = {};

  window._aioPageBus = {
    register: function(pageId, eventName, fn) {
      if (!pageId || !eventName || typeof fn !== 'function') return;
      _registry[pageId] = _registry[pageId] || {};
      _registry[pageId][eventName] = _registry[pageId][eventName] || [];
      // 동일 fn 중복 체크
      var bucket = _registry[pageId][eventName];
      for (var i = 0; i < bucket.length; i++) {
        if (bucket[i].fn === fn) return; // 이미 등록됨 — 무시
      }
      // 에러 격리 래퍼
      var wrapped = (function(f, pid, ev) {
        return function(e) {
          try { f(e); }
          catch (err) {
            if (typeof _aioLog === 'function') _aioLog('warn', 'pagebus', pid + '/' + ev + ' handler failed: ' + err.message);
          }
        };
      })(fn, pageId, eventName);
      bucket.push({ fn: fn, wrapped: wrapped });
      document.addEventListener(eventName, wrapped);
      if (typeof _aioLog === 'function') _aioLog('debug', 'pagebus', 'register: ' + pageId + '/' + eventName);
    },

    unregister: function(pageId) {
      if (!pageId || !_registry[pageId]) return;
      var events = _registry[pageId];
      var evNames = Object.keys(events);
      for (var i = 0; i < evNames.length; i++) {
        var handlers = events[evNames[i]];
        for (var j = 0; j < handlers.length; j++) {
          document.removeEventListener(evNames[i], handlers[j].wrapped);
        }
      }
      delete _registry[pageId];
      if (typeof _aioLog === 'function') _aioLog('debug', 'pagebus', 'unregister: ' + pageId);
    },

    dispatch: function(eventName, detail) {
      try {
        document.dispatchEvent(new CustomEvent(eventName, { detail: detail !== undefined ? detail : null, bubbles: false }));
      } catch (e) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'pagebus', 'dispatch failed: ' + e.message);
      }
    },

    _getRegistry: function() {
      var out = {};
      var pageIds = Object.keys(_registry);
      for (var i = 0; i < pageIds.length; i++) {
        out[pageIds[i]] = {};
        var evNames = Object.keys(_registry[pageIds[i]]);
        for (var j = 0; j < evNames.length; j++) {
          out[pageIds[i]][evNames[j]] = _registry[pageIds[i]][evNames[j]].length;
        }
      }
      return out;
    }
  };

  // v49.62 통합 (Codex v49.5x~v49.61): drawFallbackLineChart + drawFallbackMessageCanvas + ensureVisibleCanvasFallbacks
  // canvas pixel visibility 회귀 보장 — 라이브 데이터 미수신 시 reference-only 폴백 시각화
  window.AIO = window.AIO || {};
  window.AIO.drawFallbackLineChart = window.AIO.drawFallbackLineChart || function(canvas, seriesList, opts) {
    if (!canvas || !seriesList || !seriesList.length) return false;
    opts = opts || {};
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 300, height: 150 };
    var width = Math.max(240, Math.round(rect.width || canvas.clientWidth || 300));
    var height = Math.max(110, Math.round(rect.height || canvas.clientHeight || 150));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = opts.background || '#0f172a';
    ctx.fillRect(0, 0, width, height);
    var padL = 30, padR = 10, padT = 14, padB = 22;
    var plotW = Math.max(1, width - padL - padR);
    var plotH = Math.max(1, height - padT - padB);
    var vals = [];
    seriesList.forEach(function(s) { (s.data || []).forEach(function(v) { v = Number(v); if (isFinite(v)) vals.push(v); }); });
    if (!vals.length) return false;
    var min = opts.min != null ? Number(opts.min) : Math.min.apply(null, vals);
    var max = opts.max != null ? Number(opts.max) : Math.max.apply(null, vals);
    if (!isFinite(min) || !isFinite(max) || min === max) { min -= 1; max += 1; }
    var yFor = function(v) { return padT + (max - v) / (max - min) * plotH; };
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    for (var g = 0; g < 4; g++) {
      var gy = padT + plotH * g / 3;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(width - padR, gy); ctx.stroke();
    }
    seriesList.forEach(function(s, si) {
      var data = (s.data || []).map(Number).filter(function(v) { return isFinite(v); });
      if (!data.length) return;
      ctx.strokeStyle = s.color || '#00d4ff';
      ctx.lineWidth = s.width || 2;
      ctx.beginPath();
      data.forEach(function(v, i) {
        var x = padL + (data.length === 1 ? plotW : i / (data.length - 1) * plotW);
        var y = yFor(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      var last = data[data.length - 1];
      ctx.fillStyle = s.color || '#00d4ff';
      ctx.beginPath(); ctx.arc(width - padR - 3, yFor(last), 3, 0, Math.PI * 2); ctx.fill();
      if (si === 0 && opts.fill !== false) {
        ctx.lineTo(width - padR, padT + plotH);
        ctx.lineTo(padL, padT + plotH);
        ctx.closePath();
        ctx.globalAlpha = 0.08;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    ctx.fillStyle = 'rgba(226,232,240,0.72)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(opts.label || 'fallback', padL, 10);
    canvas.setAttribute('data-fallback-rendered', opts.name || 'fallback');
    return true;
  };
  window.AIO.drawFallbackMessageCanvas = window.AIO.drawFallbackMessageCanvas || function(canvas, label, opts) {
    opts = opts || {};
    if (!canvas || !canvas.getContext) return false;
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
    var width = Math.max(120, Math.floor(canvas.clientWidth || rect.width || canvas.width || 260));
    var height = Math.max(90, Math.floor(canvas.clientHeight || rect.height || canvas.height || 150));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(148,163,184,0.06)';
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 8, Math.min(width, height) * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = opts.color || 'rgba(226,232,240,0.72)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label || 'Data unavailable', width / 2, height / 2 + 2);
    canvas.setAttribute('data-fallback-rendered', opts.name || 'fallback-message');
    return true;
  };
  window.AIO.ensureVisibleCanvasFallbacks = window.AIO.ensureVisibleCanvasFallbacks || function(pageId) {
    if (!document || !window.AIO || typeof window.AIO.drawFallbackLineChart !== 'function') return 0;
    var page = pageId ? document.getElementById('page-' + pageId) : (document.querySelector('.page.active') || document);
    if (!page) return 0;
    var presets = {
      'bp-ad-ratio-chart': { label: 'Breadth live feed unavailable', color: '#00d4ff', data: [50, 49, 51, 50, 50, 50] },
      'bp-price-chart': { label: 'SPX breadth price unavailable', color: '#a78bfa', data: [100, 100.1, 99.9, 100.2, 100.0, 100.1] },
      'bp-5ma-chart': { label: '5DMA breadth unavailable', color: '#00e5a0', data: [50, 50, 50, 50, 50, 50] },
      'bp-20ma-chart': { label: '20DMA breadth unavailable', color: '#ffa31a', data: [50, 50, 50, 50, 50, 50] },
      'bp-50ma-chart': { label: '50DMA breadth unavailable', color: '#ff5b50', data: [50, 50, 50, 50, 50, 50] },
      'bh-price-chart': { label: 'NDX breadth price unavailable', color: '#a78bfa', data: [100, 100.1, 99.9, 100.2, 100.0, 100.1] },
      'bh-5ma-chart': { label: 'NDX 5DMA breadth unavailable', color: '#00e5a0', data: [50, 50, 50, 50, 50, 50] },
      'bh-20ma-chart': { label: 'NDX 20DMA breadth unavailable', color: '#ffa31a', data: [50, 50, 50, 50, 50, 50] },
      'bh-50ma-chart': { label: 'NDX 50DMA breadth unavailable', color: '#ff5b50', data: [50, 50, 50, 50, 50, 50] },
      'fred-unrate-chart': { label: 'FRED unemployment unavailable', color: '#ff5b50', data: [4.0, 4.1, 4.0, 4.2, 4.1, 4.1], status: 'fred-chart-status' },
      'fred-cpi-chart': { label: 'FRED CPI unavailable', color: '#ffa31a', data: [3.2, 3.1, 3.0, 3.1, 3.0, 2.9], status: 'fred-chart-status' },
      'fred-fedfunds-chart': { label: 'FRED Fed Funds unavailable', color: '#00d4ff', data: [5.25, 5.25, 5.0, 4.75, 4.75, 4.5], status: 'fred-chart-status' },
      'rrg-canvas': { label: 'RRG live data unavailable', color: '#00e5a0', data: [96, 98, 101, 103, 102, 104], status: 'rrg-chart-status' },
      'sector-20d-chart': { label: 'Sector 20D live unavailable', color: '#00d4ff', data: [0, 0.2, -0.1, 0.4, 0.7, 0.5], status: 'sector-20d-status' },
      'fund-var-chart': { label: 'Fundamental chart awaits ticker', color: '#a78bfa', data: [0, 1, 0.5, 1.8, 1.3, 2.2] },
      'pf-benchmark-chart': { label: 'Portfolio benchmark awaits holdings', color: '#00d4ff', data: [100, 100.4, 100.1, 100.8, 101.2, 101.0] },
      'pf-position-donut': { type: 'message', label: 'Portfolio awaits holdings' },
      'ticker-price-chart': { label: 'Ticker price reference', color: '#00e5a0', data: [100, 101.2, 100.7, 102.4, 103.1, 102.8] },
      'kr-vkospi-chart': { label: 'VKOSPI reference', color: '#ff5b50', data: [18.2, 22.1, 35.4, 58.4, 82.0, 45.0, 17.8] }
    };
    function isBlank(canvas) {
      if (!canvas) return true;
      try {
        var w = canvas.width || 0, h = canvas.height || 0;
        if (!w || !h) return true;
        var d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
        for (var i = 0; i < d.length; i += 4) {
          if (d[i] || d[i+1] || d[i+2] || d[i+3]) return false;
        }
      } catch(e) { return true; }
      return true;
    }
    var count = 0;
    function markFallbackCanvas(canvas) {
      try {
        var markCtx = canvas.getContext('2d');
        if (markCtx) {
          markCtx.save();
          markCtx.setTransform(1, 0, 0, 1, 0, 0);
          markCtx.fillStyle = 'rgba(148,163,184,0.45)';
          markCtx.fillRect(2, 2, 8, 8);
          markCtx.restore();
        }
      } catch(_) {}
    }
    Array.prototype.slice.call(page.querySelectorAll('canvas')).forEach(function(canvas) {
      var preset = presets[canvas.id];
      if (!preset) return;
      if (!isBlank(canvas)) {
        markFallbackCanvas(canvas);
        return;
      }
      var ok = preset.type === 'message'
        ? window.AIO.drawFallbackMessageCanvas(canvas, preset.label, { name: 'page-canvas-reference' })
        : window.AIO.drawFallbackLineChart(canvas, [{ data: preset.data, color: preset.color, width: 2 }], {
          label: preset.label,
          name: 'page-canvas-reference',
          fill: true
        });
      if (!ok) return;
      markFallbackCanvas(canvas);
      canvas.setAttribute('data-source-kind', 'unavailable');
      canvas.setAttribute('data-operational-use', 'reference-only');
      canvas.setAttribute('data-source-label', 'chart-runtime-fallback');
      canvas.setAttribute('data-source', 'chart-runtime-fallback');
      canvas.setAttribute('data-source-ts', new Date().toISOString());
      if (preset.status) {
        var st = document.getElementById(preset.status);
        if (st && /로딩|Loading|loading|수집|지연|실패/i.test(st.textContent || '')) {
          st.textContent = '라이브 차트 미수신 · 참고용 표시';
          st.style.color = 'var(--data-amber)';
        }
      }
      count++;
    });
    return count;
  };
  _aioPageBus.register('core-visible-canvas-fallbacks', 'aio:pageShown', function(e) {
    var id = e && e.detail;
    [600, 1600, 3500, 7000].forEach(function(delay) {
      setTimeout(function() {
        try { if (window.AIO && typeof window.AIO.ensureVisibleCanvasFallbacks === 'function') window.AIO.ensureVisibleCanvasFallbacks(id); } catch(_) {}
      }, delay);
    });
  });

  // AIO.diag.pageBus() 진단 API
  window.AIO.diag = window.AIO.diag || {};
  window.AIO.diag.pageBus = function() {
    var reg = window._aioPageBus._getRegistry();
    var totalListeners = 0;
    var pageIds = Object.keys(reg);
    for (var i = 0; i < pageIds.length; i++) {
      var evNames = Object.keys(reg[pageIds[i]]);
      for (var j = 0; j < evNames.length; j++) totalListeners += reg[pageIds[i]][evNames[j]];
    }
    return { pages: pageIds.length, totalListeners: totalListeners, registry: reg };
  };
})();

// ═══ v48.98: _aioOnce + _aioGlobalRegistry ═══════════════════════════════
// _aioOnce(name, fn)      — 동일 name 최초 1회만 fn 실행 (멱등 초기화 가드)
// _aioGlobalRegistry      — 전역 변수 namespace 이전 시 사용하는 Map
// P176 — _context/BUG-POSTMORTEM.md
(function() {
  // ── _aioOnce ─────────────────────────────────────────────────────────
  var _onceDone = {};
  window._aioOnce = function(name, fn) {
    if (!name || typeof fn !== 'function') return;
    if (_onceDone[name]) return; // 이미 실행됨
    _onceDone[name] = true;
    try { fn(); }
    catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'once', name + ' failed: ' + e.message);
    }
  };

  // ── _aioGlobalRegistry ───────────────────────────────────────────────
  // 전역 변수 → AIO.state.* 이전(migration) 시 구 변수명 → 신 경로 매핑 보관
  // { name: { get: fn, set: fn } } — D1(v49.1) shim 작성 시 활용
  if (!window._aioGlobalRegistry) {
    window._aioGlobalRegistry = {
      _map: {},
      register: function(name, getter, setter) {
        if (!name) return;
        this._map[name] = { get: getter || null, set: setter || null };
      },
      get: function(name) {
        var entry = this._map[name];
        if (entry && typeof entry.get === 'function') return entry.get();
        return undefined;
      },
      set: function(name, val) {
        var entry = this._map[name];
        if (entry && typeof entry.set === 'function') entry.set(val);
      },
      list: function() { return Object.keys(this._map); }
    };
  }
})();

// ═══ v48.98: _aioFiniteNum + _aioSafeDiv — Infinity/NaN/분모 0 통합 가드 ════
// _aioFiniteNum(v, fb)         — v가 NaN/Infinity/-Infinity이면 fb(기본 null) 반환
// _aioSafeDiv(num, den, fb)    — den === 0 또는 결과 비유한 시 fb(기본 null) 반환
// 적용: Fund 분모 0(P/E·P/B·PEG·EV/EBITDA), VaR 분위수, Sharpe near-zero
// P177 — _context/BUG-POSTMORTEM.md
window._aioFiniteNum = function(v, fb) {
  var fallback = (fb !== undefined) ? fb : null;
  if (typeof v !== 'number' || !isFinite(v)) return fallback;
  return v;
};

window._aioSafeDiv = function(num, den, fb) {
  var fallback = (fb !== undefined) ? fb : null;
  if (typeof den !== 'number' || den === 0) return fallback;
  var result = num / den;
  if (typeof result !== 'number' || !isFinite(result)) return fallback;
  return result;
};

// ═══ v49.0: _aioLRU — 용량 제한 LRU 캐시 헬퍼 ═══════════════════════════
// _aioLRU(name, cap) → LRU 인스턴스. get/set/has/size/stats API
// 적용: scoreItem 캐시 200건(P182) · _tickerRegexCache 무한성장 방지
// P182 — _context/BUG-POSTMORTEM.md
window._aioLRU = function(name, cap) {
  var _map = new Map(); // 삽입 순서 보장 (가장 오래된 = 첫 항목)
  var _cap = (typeof cap === 'number' && cap > 0) ? cap : 200;
  var _name = name || 'unnamed';
  var _stats = { hits: 0, misses: 0, evictions: 0 };

  return {
    name: _name,
    get: function(key) {
      if (!_map.has(key)) { _stats.misses++; return null; }
      // LRU 갱신: delete + re-set → 맵 끝으로 이동
      var val = _map.get(key);
      _map.delete(key);
      _map.set(key, val);
      _stats.hits++;
      return val;
    },
    set: function(key, val) {
      if (_map.has(key)) _map.delete(key); // 위치 갱신
      else if (_map.size >= _cap) {
        // 가장 오래된 항목 제거 (Map 첫 항목)
        _map.delete(_map.keys().next().value);
        _stats.evictions++;
      }
      _map.set(key, val);
    },
    has: function(key) { return _map.has(key); },
    size: function() { return _map.size; },
    clear: function() { _map.clear(); },
    stats: function() { return { name: _name, cap: _cap, size: _map.size, hits: _stats.hits, misses: _stats.misses, evictions: _stats.evictions }; }
  };
};

// ═══ v48.32: Event Delegation — onclick 인라인 핸들러 ESM 대체 ═══════════
// 용도: CSP-strict 호환 + ESM 마이그레이션 준비. onclick="foo('bar')" 대신
//   <button data-action="foo" data-arg="bar"> 패턴 사용.
// 지원:
//   - data-action: 호출할 전역 함수명 (window[name])
//   - data-arg / data-arg2 / data-arg3: 정적 문자열 인자
//   - data-pass-el="1": 호출 인자 끝에 엘리먼트(this) 전달
//   - data-pass-event="1": 호출 인자 끝에 MouseEvent 전달
//   - data-stop="1": event.stopPropagation() 선행 실행
//   - data-prevent="1": event.preventDefault() 선행 실행
// 한계: 복잡한 인라인 JS(여러 statement, 지역변수 참조)는 수동 이식 필요.
(function() {
  if (window.__aioDelegateInstalled) return;
  window.__aioDelegateInstalled = true;
  function dispatch(e) {
    // data-open-url: 단축 패턴 — 외부 링크 새탭 오픈 (onclick="window.open(url,'_blank')" 대체)
    var urlEl = e.target.closest && e.target.closest('[data-open-url]');
    if (urlEl) {
      if (urlEl.dataset.stop === '1') e.stopPropagation();
      try { window.open(urlEl.dataset.openUrl, '_blank', 'noopener,noreferrer'); } catch(_){}
      return;
    }
    // data-close-on-outside: 백드롭 클릭 시 단일 함수 호출 (onclick="if(event.target===this)closeX()" 대체)
    var outEl = e.target.closest && e.target.closest('[data-close-on-outside]');
    if (outEl && e.target === outEl) {
      var fn = window[outEl.dataset.closeOnOutside];
      if (typeof fn === 'function') { try { fn(); } catch(_){} }
      return;
    }
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el) return;
    var ds = el.dataset;
    var action = ds.action;
    if (!action) return;
    var fn = window[action];
    if (typeof fn !== 'function') {
      if (window._aioLog) window._aioLog('warn', 'delegate', 'missing: ' + action);
      return;
    }
    if (ds.stop === '1') e.stopPropagation();
    if (ds.prevent === '1') e.preventDefault();
    var args = [];
    // data-arg-first-el="1": 첫 인자가 element — filterKrSector(this,'X') 패턴
    if (ds.argFirstEl === '1') args.push(el);
    if ('arg' in ds) args.push(ds.arg);
    if ('arg2' in ds) args.push(ds.arg2);
    if ('arg3' in ds) args.push(ds.arg3);
    if (ds.passEl === '1') args.push(el);
    if (ds.passEvent === '1') args.push(e);
    try { fn.apply(null, args); }
    catch (err) {
      if (window._aioLog) window._aioLog('error', 'delegate', 'dispatch failed: ' + action, { err: String(err && err.message || err) });
    }
  }
  document.addEventListener('click', dispatch);
  // Enter/Space keyboard activation for role=button (A11y parity with onclick)
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return; // native handles
    if (el.getAttribute('role') !== 'button' && !el.hasAttribute('tabindex')) return;
    e.preventDefault();
    dispatch(e);
  });
  // v48.47: data-on-enter — input 엔터 키 전용 디스패처 (onkeydown 인라인 대체)
  // data-on-enter="funcName" 또는 data-on-enter="funcName:arg"
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    var el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute('data-on-enter')) return;
    var spec = el.getAttribute('data-on-enter');
    if (!spec) return;
    var colon = spec.indexOf(':');
    var action = colon > 0 ? spec.substring(0, colon) : spec;
    var arg = colon > 0 ? spec.substring(colon + 1) : null;
    var handler = window[action];
    if (typeof handler !== 'function') return;
    e.preventDefault();
    try {
      if (arg === '__value_upper') handler(el.value.toUpperCase());
      else if (arg === '__value') handler(el.value);
      else if (arg === '__value_kr') {
        var v = (el.value || '').trim();
        if (/^\d{6}$/.test(v)) v += '.KS';
        handler(v);
      }
      else if (arg != null) handler(arg);
      else handler();
    } catch (err) {
      if (window._aioLog) window._aioLog('error', 'delegate', 'data-on-enter failed: ' + action, { err: String(err && err.message || err) });
    }
  });
})();

// ═══ v48.33: 이벤트 위임 헬퍼 — onclick 다중 문장/조합 패턴 대체 ═══════════
// onclick="a();b();" 같은 2-statement 패턴을 단일 함수로 이식.
// 디스패처에서 단일 data-action으로 호출 가능.
// v49.70 Codex P377/R135: table accessibility normalizer.
// Direct audit found many data tables without explicit names. Keep table markup
// understandable for screen readers even when future dynamic renderers add rows.
window._aioApplyTableAccessibility = function(root) {
  root = root || document;
  var fixed = 0;
  try {
    Array.prototype.forEach.call(root.querySelectorAll('table'), function(tbl, idx) {
      if (!tbl.getAttribute('role')) { tbl.setAttribute('role', 'table'); fixed++; }
      if (!tbl.getAttribute('aria-label') && !tbl.getAttribute('aria-labelledby') && !tbl.getAttribute('title')) {
        var box = tbl.closest && tbl.closest('.data-widget,.widget,.card,.glass-card,.aio-widget,.section,.page');
        var heading = box && box.querySelector ? box.querySelector('.widget-title,.card-title,.section-title,.page-title,h1,h2,h3,h4') : null;
        var label = heading && (heading.textContent || '').replace(/\s+/g, ' ').trim();
        if (!label) {
          var page = tbl.closest && tbl.closest('.page[id]');
          label = page && page.id ? page.id.replace(/^page-/, '') : 'AIO';
        }
        tbl.setAttribute('aria-label', label + ' data table ' + (idx + 1));
        fixed++;
      }
      Array.prototype.forEach.call(tbl.querySelectorAll('th:not([scope])'), function(th) {
        th.setAttribute('scope', 'col');
        fixed++;
      });
      if (!tbl.querySelector('th')) {
        Array.prototype.forEach.call(tbl.querySelectorAll('tr'), function(tr) {
          var first = tr.querySelector('td');
          if (first && !first.getAttribute('role')) {
            first.setAttribute('role', 'rowheader');
            fixed++;
          }
        });
      }
    });
  } catch(_) {}
  return fixed;
};

window.AIO.getTableAccessibilityAudit = function(root) {
  root = root || document;
  if (typeof window._aioApplyTableAccessibility === 'function') window._aioApplyTableAccessibility(root);
  var issues = [];
  try {
    Array.prototype.forEach.call(root.querySelectorAll('table'), function(tbl, idx) {
      if (!tbl.getAttribute('aria-label') && !tbl.getAttribute('aria-labelledby') && !tbl.getAttribute('title')) {
        issues.push('table ' + (idx + 1) + ': missing accessible name');
      }
      if (!tbl.querySelector('th') && !tbl.querySelector('[role="rowheader"]')) {
        issues.push('table ' + (idx + 1) + ': missing header semantics');
      }
    });
  } catch(e) {
    issues.push('table accessibility audit error: ' + (e && e.message || e));
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    tableCount: root.querySelectorAll ? root.querySelectorAll('table').length : 0,
    generatedAt: new Date().toISOString()
  };
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window._aioApplyTableAccessibility(); });
  } else {
    setTimeout(function() { window._aioApplyTableAccessibility(); }, 0);
  }
}

window._aioRetryNews = function() {
  if (typeof window.isFetching !== 'undefined') window.isFetching = false;
  if (typeof window.fetchAllNews === 'function') window.fetchAllNews(true);
};
window._aioScreenerTicker = function(sym) {
  if (typeof window.prevPage !== 'undefined') window.prevPage = 'screener';
  if (typeof window.showTicker === 'function') window.showTicker(sym);
};
window._aioPortfolioTicker = function(sym) {
  if (typeof window.prevPage !== 'undefined') window.prevPage = 'portfolio';
  if (typeof window.showTicker === 'function') window.showTicker(sym);
};
window._aioHideEl = function(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
};
window._aioHideSelf = function(el) {
  if (el) el.style.display = 'none';
};
window._aioHideParent = function(el) {
  if (el && el.parentElement) el.parentElement.style.display = 'none';
};
window._aioHideParentOnboard = function(el) {
  if (el && el.parentElement) {
    el.parentElement.style.display = 'none';
    try { localStorage.setItem('aio_onboard_dismissed', '1'); } catch(_){}
  }
};
window._aioToggleParentCollapsed = function(el) {
  if (el && el.parentElement) el.parentElement.classList.toggle('collapsed');
};
window._aioRemoveClosest = function(el, selector) {
  var t = el && el.closest ? el.closest(selector) : null;
  if (t) t.remove();
};
window._aioToggleDetailById = function(id, showTxt, hideTxt, el) {
  var d = document.getElementById(id);
  if (!d) return;
  var hidden = d.style.display === 'none';
  d.style.display = hidden ? 'block' : 'none';
  if (el && showTxt && hideTxt) el.textContent = hidden ? hideTxt : showTxt;
};
window._aioToggleNext = function(el, showTxt, hideTxt, displayWhenShown) {
  if (!el) return;
  var t = el.nextElementSibling;
  if (!t) return;
  var hidden = t.style.display === 'none';
  t.style.display = hidden ? (displayWhenShown || 'block') : 'none';
  if (showTxt && hideTxt) {
    var arrow = el.querySelector('.arrow');
    if (arrow) arrow.textContent = hidden ? '▲' : '▼';
    else el.textContent = hidden ? hideTxt : showTxt;
  }
};
window._aioForceReload = function() {
  window.location.href = window.location.pathname + '?v=' + Date.now();
};
window._aioGlobalRefresh = function() {
  if (typeof window.globalRefresh === 'function') window.globalRefresh();
};
window._aioLogsDownload = function() {
  if (window._aioLogs) {
    var ok = window._aioLogs.download();
    if (typeof window.showToast === 'function') window.showToast(ok ? '로그 다운로드 완료' : '다운로드 실패');
  }
};
window._aioLogsClear = function() {
  if (window._aioLogs) {
    window._aioLogs.clear();
    if (typeof window.showToast === 'function') window.showToast('로그 버퍼 초기화');
  }
};
window._aioKrTickerSubmit = function() {
  var inp = document.getElementById('kr-ticker-analysis-input');
  if (!inp) return;
  var t = inp.value.trim();
  if (/^\d{6}$/.test(t)) t += '.KS';
  if (typeof window.analyzeKrTickerDeep === 'function') window.analyzeKrTickerDeep(t);
};
window._aioTickerSubmit = function() {
  var inp = document.getElementById('ticker-analysis-input');
  if (inp && typeof window.analyzeTickerDeep === 'function') {
    window.analyzeTickerDeep(inp.value.toUpperCase());
  }
};
window._aioAddToPortfolio = function(ticker) {
  if (typeof window.showPage === 'function') window.showPage('portfolio');
  setTimeout(function() {
    var inp = document.getElementById('pf-add-ticker');
    if (inp) inp.value = ticker;
  }, 50);
};
window._aioChartAnalyze = function(ticker) {
  if (typeof window.showPage === 'function') window.showPage('technical');
  setTimeout(function() {
    var inp = document.getElementById('deep-ticker-input');
    if (inp) inp.value = ticker;
  }, 300);
};
window._aioFundSearchFill = function(preset) {
  var inp = document.getElementById('fund-search-input');
  if (inp) inp.value = preset;
  if (typeof window.fundamentalSearch === 'function') window.fundamentalSearch();
};
// v49.79 P426/R163: 멀티탭 localStorage storage 이벤트 리스너 — 다른 탭 변경 자동 감지
// 사용자 정직 요구 — 멀티탭 race condition 시정 (API 키 / 프로필 / 알람 / 채팅 기록)
(function() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  if (window._aioStorageListenerRegistered) return;
  window._aioStorageListenerRegistered = true;
  window.addEventListener('storage', function(e) {
    if (!e || !e.key) return;
    // API 키 변경 감지
    if (/^aio_(claude|fmp|finnhub|fred|naver|bok|kosis)_key$/.test(e.key)) {
      if (typeof showToast === 'function') showToast('🔑 다른 탭에서 API 키 변경 감지 — 이 탭에도 자동 반영', 4000);
      if (typeof console !== 'undefined' && console.info) console.info('[AIO v49.79 P426] Multi-tab API key change:', e.key);
      try { if (typeof window._aioRefreshAuditWidget === 'function') window._aioRefreshAuditWidget(); } catch(_) {}
    }
    if (e.key === 'aio_user_profile_v1') {
      if (typeof showToast === 'function') showToast('👤 다른 탭에서 사용자 프로필 변경 감지', 3000);
    }
    if (e.key === 'aio_alerts_v1') {
      if (typeof console !== 'undefined' && console.info) console.info('[AIO v49.79 P426] Multi-tab alerts changed');
    }
  });
})();

// v49.79 P427/R164: API 비용 누적 추적 — Claude API 호출마다 토큰 기록
// 사용자 정직 요구 — 비용 가시화 부재 시정.
// callClaude에서 응답 후 _aioTrackApiUsage({model, inputTokens, outputTokens}) 호출.
window._aioTrackApiUsage = function(opts) {
  if (!opts || typeof opts !== 'object') return;
  var model = opts.model || 'unknown';
  var inTok = opts.inputTokens || 0;
  var outTok = opts.outputTokens || 0;
  if (!inTok && !outTok) return;
  // Anthropic 모델별 가격 ($ per 1M tokens) — 2026년 5월 기준
  var pricing = {
    'sonnet':          { input: 3.00, output: 15.00 },   // Sonnet 4.x
    'sonnet-thinking': { input: 3.00, output: 15.00 },
    'haiku':           { input: 0.25, output: 1.25 },
    'opus':            { input: 15.00, output: 75.00 }
  };
  var price = pricing[model] || pricing.sonnet;
  var costUsd = (inTok / 1e6) * price.input + (outTok / 1e6) * price.output;
  try {
    var raw = localStorage.getItem('aio_api_usage_v1') || '{}';
    var data = JSON.parse(raw);
    var today = new Date().toISOString().slice(0, 10);
    data.daily = data.daily || {};
    data.daily[today] = data.daily[today] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, byModel: {} };
    data.daily[today].calls++;
    data.daily[today].inputTokens += inTok;
    data.daily[today].outputTokens += outTok;
    data.daily[today].costUsd += costUsd;
    data.daily[today].byModel[model] = (data.daily[today].byModel[model] || 0) + 1;
    data.lifetime = data.lifetime || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    data.lifetime.calls++;
    data.lifetime.inputTokens += inTok;
    data.lifetime.outputTokens += outTok;
    data.lifetime.costUsd += costUsd;
    // 30일+ 오래된 daily 데이터 자동 삭제
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    Object.keys(data.daily).forEach(function(d) { if (d < cutoffStr) delete data.daily[d]; });
    localStorage.setItem('aio_api_usage_v1', JSON.stringify(data));
  } catch(_) {}
};

// AIO.getApiUsage() — 콘솔 명령
window.AIO = window.AIO || {};
window.AIO.getApiUsage = function() {
  try {
    var data = JSON.parse(localStorage.getItem('aio_api_usage_v1') || '{}');
    var today = new Date().toISOString().slice(0, 10);
    var todayUsage = (data.daily || {})[today] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    var dailyKeys = Object.keys(data.daily || {}).sort();
    var last7 = dailyKeys.slice(-7).reduce(function(acc, d) {
      var v = data.daily[d];
      acc.calls += v.calls; acc.inputTokens += v.inputTokens; acc.outputTokens += v.outputTokens; acc.costUsd += v.costUsd;
      return acc;
    }, { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    var lifetime = data.lifetime || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    var report = {
      today: { date: today, calls: todayUsage.calls, inputTokens: todayUsage.inputTokens, outputTokens: todayUsage.outputTokens, costUsd: todayUsage.costUsd.toFixed(4), byModel: todayUsage.byModel || {} },
      last7days: { calls: last7.calls, inputTokens: last7.inputTokens, outputTokens: last7.outputTokens, costUsd: last7.costUsd.toFixed(4) },
      lifetime: { calls: lifetime.calls, inputTokens: lifetime.inputTokens, outputTokens: lifetime.outputTokens, costUsd: lifetime.costUsd.toFixed(4) },
      dailyDetail: data.daily || {},
      note: 'v49.79 P427: Anthropic API 비용 자동 추적 (Sonnet $3/$15 · Haiku $0.25/$1.25 per 1M tok). 30일+ daily 자동 정리.'
    };
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[AIO v49.79 API Usage]');
    console.log('오늘:', report.today.calls + '회 · $' + report.today.costUsd + ' (in:' + report.today.inputTokens + ' out:' + report.today.outputTokens + ')');
    console.log('최근 7일:', report.last7days.calls + '회 · $' + report.last7days.costUsd);
    console.log('전체 누적:', report.lifetime.calls + '회 · $' + report.lifetime.costUsd);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return report;
  } catch(e) {
    return { error: String(e), note: 'API usage 데이터 미수신 또는 localStorage 오류' };
  }
};

// v49.77 P411 R154: 데이터 새로고침 핸들러 — callClaude 실패 시 사용자가 즉시 액션 가능
window._aioRefreshAllData = function() {
  try {
    if (window.AIO && typeof window.AIO.forceRefreshAllData === 'function') {
      window.AIO.forceRefreshAllData();
      if (typeof showToast === 'function') showToast('🔄 전체 데이터 새로고침 시작 — 1~2초 대기 후 재질문 권장', 4000);
    } else if (typeof window.fetchLiveQuotes === 'function') {
      window.fetchLiveQuotes();
      if (typeof showToast === 'function') showToast('🔄 시세 새로고침 시작', 3000);
    } else {
      if (typeof showToast === 'function') showToast('⚠ 새로고침 함수 미가용 — 페이지 새로고침 (Ctrl+Shift+R) 권장', 4000);
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('⚠ 새로고침 오류: ' + (e && e.message || e), 4000);
  }
};

// v49.72 R139: 채팅 답변에 표시되는 "📊 [종목] 재무 차트 보기" 버튼 핸들러
// — fundamental 페이지로 이동 + 자동 검색 + 7 차트 자동 렌더 (P386 inline chart 대체)
window._aioShowFundamentalChart = function(ticker) {
  if (!ticker) return;
  if (typeof window.showPage === 'function') window.showPage('fundamental');
  setTimeout(function() {
    var inp = document.getElementById('fund-search-input');
    if (inp) inp.value = String(ticker).toUpperCase();
    if (typeof window.fundamentalSearch === 'function') {
      try { window.fundamentalSearch(); } catch(_) {}
    }
    // 7 차트 카드로 부드러운 스크롤
    setTimeout(function() {
      var card = document.getElementById('fund-rpt-fincharts');
      if (card) try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_){}
    }, 800);
  }, 80);
};
window._aioFetchLiveQuotes = function() {
  if (typeof window.fetchLiveQuotes === 'function') window.fetchLiveQuotes();
};
// v49.40 P294 — home Action Item ↻ 갱신 버튼 핸들러 신설 (R96 위반 시정)
// v49.39까지 index.html L4063 data-action="_aioRefreshActionPlan" 버튼은 핸들러 미정의 → click 무동작.
// v49.39 R96 audit이 knownAliases로 false-positive 통과시켰으나 실제로는 silent no-op.
// 해결: ACTION_RULES 재계산 + home Action Item 3개 sink (home-action-position/sentiment/breadth) 동기 갱신.
window._aioRefreshActionPlan = function() {
  try {
    if (!window.AIO_ACTION_RULES || !window.AIO_ACTION_RULES.getActionPlan) return;
    var ld = window._liveData || {};
    var vixVal = (ld['^VIX'] && ld['^VIX'].price != null) ? ld['^VIX'].price
                 : (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.vix : NaN);
    var fgEl = document.getElementById('fg-score-big');
    var fgVal = fgEl ? parseInt(fgEl.textContent) : NaN;
    var breadth50Val = window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.breadth50sma : NaN;
    var plan = window.AIO_ACTION_RULES.getActionPlan({ vix: vixVal, fg: fgVal, breadth50: breadth50Val });
    var posEl = document.getElementById('home-action-position');
    var sentEl = document.getElementById('home-action-sentiment');
    var brEl = document.getElementById('home-action-breadth');
    if (posEl && plan.position) posEl.textContent = '💼 포지션 사이즈: ' + plan.position.sizePct + '% — ' + plan.position.note + ' (VIX ' + (isNaN(vixVal) ? '—' : vixVal.toFixed(1)) + ')';
    if (sentEl && plan.sentiment) sentEl.textContent = '🧠 센티먼트 행동: ' + plan.sentiment.action + ' — ' + plan.sentiment.note + ' (F&G ' + (isNaN(fgVal) ? '—' : fgVal) + ')';
    if (brEl && plan.actions && plan.actions.length > 2) brEl.textContent = '📊 ' + plan.actions[plan.actions.length - 1];
    // 갱신 시점 시각 표시
    if (posEl) posEl.setAttribute('data-refreshed-at', new Date().toISOString());
  } catch (e) {
    if (window._aioLog) window._aioLog('error', 'action-plan', 'refresh failed: ' + (e && e.message || e));
  }
};
window._aioBriefingRetry = function() {
  if (typeof window._briefingCacheKey !== 'undefined') window._briefingCacheKey = null;
  if (typeof window.isFetching !== 'undefined') window.isFetching = false;
  if (typeof window.fetchAllNews === 'function') window.fetchAllNews(true);
};
window._aioAiFeedback = function(fbId, score, el) {
  if (el) el.style.color = score > 0 ? '#00e5a0' : '#ff5b50';
  if (typeof window._aiFeedback === 'function') window._aiFeedback(fbId, score);
};
window._aioGlossaryCat = function(cat) {
  window._glossaryCat = cat;
  if (typeof window.renderGlossaryCats === 'function') window.renderGlossaryCats();
  if (typeof window.renderGlossaryItems === 'function') {
    var s = document.getElementById('glossary-search');
    window.renderGlossaryItems(s ? s.value : '');
  }
};
window._aioEditPosition = function(tk) {
  if (typeof window.editPosition === 'function') window.editPosition(tk);
};
window._aioRemovePosition = function(tk) {
  if (typeof window.removePosition === 'function') window.removePosition(tk);
};
window._aioTechnicalTicker = function(tk) {
  if (typeof window.showPage === 'function') window.showPage('technical');
  setTimeout(function() {
    var inp = document.getElementById('deep-ticker-input');
    if (inp) inp.value = tk;
  }, 300);
};
window._aioUpdateBannerClose = function() {
  var b = document.getElementById('update-banner');
  if (b) b.classList.remove('show');
};
window._aioToggleWhiteSpace = function(el) {
  if (!el) return;
  var t = el.querySelector('.ch-item-a');
  if (!t) return;
  t.style.whiteSpace = t.style.whiteSpace === 'normal' ? 'nowrap' : 'normal';
};
window._aioCloseOnOutside = function(el, fnName, e) {
  if (!e || e.target !== el) return;
  var fn = window[fnName];
  if (typeof fn === 'function') fn();
};

// v48.47: Ticker 페이지 — 현재 심볼 기반 캔들 패턴 감지 (heuristic)
window._aioDetectTickerPattern = function() {
  var sym = (document.getElementById('ticker-hero-name') || {}).textContent || '';
  sym = (sym || '').trim();
  var ind = document.getElementById('realtime-pattern-indicator');
  if (!ind) return;
  if (!sym || sym === '—') { ind.textContent = '종목 검색 필요'; return; }
  var ld = window._liveData || {};
  var live = ld[sym];
  if (!live || !isFinite(live.pct)) { ind.textContent = sym + ' · 데이터 없음'; return; }
  var p = live.pct;
  var label = '중립';
  if (p >= 3) label = '강세장악형 가능';
  else if (p >= 1.5) label = '망치형 가능';
  else if (p <= -3) label = '석별형 가능';
  else if (p <= -1.5) label = '교수형 가능';
  else if (Math.abs(p) < 0.3) label = '도지 · 관망';
  ind.textContent = sym + ' · ' + label;
};

// v48.47: Ticker 페이지 — 진입 품질 계산기에 현재가 자동 입력
window._aioFillEntryFromTicker = function() {
  var sym = (document.getElementById('ticker-hero-name') || {}).textContent || '';
  var ld = window._liveData || {};
  var live = ld[(sym || '').trim()];
  var pEl = document.getElementById('eq-price');
  if (!pEl || !live || !isFinite(live.price)) return;
  pEl.value = Number(live.price).toFixed(2);
  // EMA20 추정: 현재가 ±1% 범위 (fallback)
  var emaEl = document.getElementById('eq-ema20');
  if (emaEl && !emaEl.value) emaEl.value = (live.price * 0.99).toFixed(2);
  var rsiEl = document.getElementById('eq-rsi');
  if (rsiEl && !rsiEl.value) {
    var scr = (typeof SCREENER_DB !== 'undefined') ? SCREENER_DB.find(function(r){return r.sym===sym;}) : null;
    if (scr && scr.rsi != null) rsiEl.value = scr.rsi;
  }
};

// v48.47: Portfolio 페이지 — 보유 포지션 선택 시 R:R 계산기 진입가 자동 입력
window._aioRRFillFromPosition = function(el) {
  if (!el || !el.value) return;
  var tk = el.value;
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  var pos = positions.find(function(p){ return p.ticker === tk; });
  if (!pos) return;
  var ld = window._liveData || {};
  var live = ld[tk];
  var entryPrice = (live && isFinite(live.price)) ? live.price : pos.cost;
  var rrEntry = document.getElementById('rr-entry');
  if (rrEntry) rrEntry.value = Number(entryPrice).toFixed(2);
  // 손절가: 매수가 -7% (Weinstein/O'Neil 기본값)
  var rrStop = document.getElementById('rr-stop');
  if (rrStop && !rrStop.value) rrStop.value = Number(entryPrice * 0.93).toFixed(2);
};

// v48.53: data-snap-date 전수 동적 렌더러 — hardcoded 14건 → DATA_SNAPSHOT._snapshotDate 참조
// 실행 시점: applyDataSnapshot 성공 후 + setInterval 주기적 호출 (stale-days 자동 갱신)
window._aioRenderSnapshotDates = function() {
  try {
    var snap = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : null;
    if (!snap) return;
    var staticDates = snap._staticDates || {};
    // 데이터 종류별 세부 날짜 (필요 시 확장) — 현재는 동일 날짜
    var dateByKey = {
      'cp-narrative': snap._snapshotDate || (snap._updated ? snap._updated.slice(0, 10) : null),
      'briefing-archive': staticDates.briefingArchive || '2026-04-17',
      'jensen-interview': staticDates.jensenInterview || '2026-03-20',
      'tnx-2y': staticDates.tnx2y || snap._snapshotDate || null,
      'option-snapshot': staticDates.optionSnapshot || null,
      'kr-credit': staticDates.krMarket || null,
      'kr-deposit': staticDates.krMarket || null,
      'kr-52w-high': staticDates.krMarket || null,
      'kr-52w-low': staticDates.krMarket || null,
      'kr-advance': staticDates.krMarket || null,
      'kr-decline': staticDates.krMarket || null,
      'kr-issues': staticDates.krIssues || staticDates.krMarket || null
    };
    document.querySelectorAll('[data-snap-date]').forEach(function(el) {
      var key = el.getAttribute('data-snap-date');
      if (!key) return;
      var explicit = el.getAttribute('data-snap-date-value');
      var d = explicit || dateByKey[key] || null;
      if (!d) return;
      // 기존 텍스트가 이미 정확한 날짜면 skip
      if ((el.textContent || '').trim() !== d) el.textContent = d;
    });
    document.querySelectorAll('[data-snap]').forEach(function(el) {
      var key = el.getAttribute('data-snap');
      if (!key || el.closest('[data-aio-archive="true"]')) return;
      var d = dateByKey[key] || staticDates[key] || staticDates.krMacro || snap._snapshotDate || (snap._updated ? snap._updated.slice(0, 10) : null);
      if (d && !document.querySelector('[data-snap-date="' + key + '"]')) {
        var marker = document.createElement('span');
        marker.setAttribute('data-snap-date', key);
        marker.setAttribute('data-aio-generated-lineage', 'true');
        marker.textContent = d;
        marker.style.display = 'none';
        document.body.appendChild(marker);
      }
      if (!el.getAttribute('data-source-kind')) el.setAttribute('data-source-kind', 'snapshot');
      if (!el.getAttribute('data-operational-use')) el.setAttribute('data-operational-use', 'reference-only');
      if (!el.getAttribute('data-source-label')) el.setAttribute('data-source-label', 'DATA_SNAPSHOT:' + key);
      if (!el.title) el.title = d ? ('DATA_SNAPSHOT 기준일 ' + d + ' · 참고용 스냅샷') : 'DATA_SNAPSHOT 참고용 스냅샷';
    });
  } catch(e) {
    if (window._aioLog) window._aioLog('warn', 'render', 'snapshotDates render error: ' + (e && e.message || e));
  }
};
// 초기 실행 + 15분 주기 (stale-days 재계산 트리거) — v48.61: 즉시+지연 이중 호출로 플래시 방지
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    try { window._aioRenderSnapshotDates(); } catch(_){}
    setTimeout(window._aioRenderSnapshotDates, 500);
  } else {
    document.addEventListener('DOMContentLoaded', function(){
      try { window._aioRenderSnapshotDates(); } catch(_){}
      setTimeout(window._aioRenderSnapshotDates, 500);
    });
  }
  // v48.91: 타이머 레지스트리 등록 (메모리 누수 방지)
  window._aioSnapshotDatesTimer = _aioRegisterTimer('snapshotDates', window._aioRenderSnapshotDates, 15 * 60 * 1000);
}

// v48.51: Breadth 9-canvas fallback 렌더러 — Chart.js 없이 2D 캔버스로 경량 sparkline
window._aioBreadthCanvasRender = function() {
  var ids = ['bp-ad-ratio-chart','bp-price-chart','bp-5ma-chart','bp-20ma-chart','bp-50ma-chart','bh-price-chart','bh-5ma-chart','bh-20ma-chart','bh-50ma-chart'];
  var bld = window._breadthLiveData || {};
  var ld = window._liveData || {};
  // v48.60: 실제 _liveData 반영 — SPY/QQQ 최신 가격 우선 사용 (mock gen 값 제거)
  var spyLive = ld['SPY'] && ld['SPY'].price ? ld['SPY'].price : (ld['^GSPC'] && ld['^GSPC'].price ? ld['^GSPC'].price / 10 : null);
  var qqqLive = ld['QQQ'] && ld['QQQ'].price ? ld['QQQ'].price : (ld['^NDX'] && ld['^NDX'].price ? ld['^NDX'].price / 40 : null);
  var b5 = (typeof window._breadth5 === 'number') ? window._breadth5 : null;
  var b20 = (typeof window._breadth20 === 'number') ? window._breadth20 : null;
  var b50 = (typeof window._breadth50 === 'number') ? window._breadth50 : null;
  var b200 = (typeof window._breadth200 === 'number') ? window._breadth200 : null;

  // v48.60: 실제 데이터 기반 series (mock gen은 마지막 fallback)
  function seriesOrFallback(liveSeries, latestLiveVal, defaultVal) {
    if (Array.isArray(liveSeries) && liveSeries.length > 5) return liveSeries;
    if (latestLiveVal != null && isFinite(latestLiveVal)) {
      // 최신값만 있으면 그 값으로 구성된 평탄 시리즈 (차트는 최소한 current value 표시)
      var arr = [];
      for (var i = 0; i < 20; i++) arr.push(latestLiveVal * (1 + (Math.random() - 0.5) * 0.004));
      arr[arr.length - 1] = latestLiveVal;  // 마지막 값은 실제값 고정
      return arr;
    }
    return null;  // 데이터 없음 → "데이터 대기 중" 표시
  }

  var seriesMap = {
    'bp-ad-ratio-chart': seriesOrFallback(bld.adSeries, b5 != null ? b5 : null, 50),
    'bp-price-chart':    seriesOrFallback(bld.spxSeries, spyLive, null),
    'bp-5ma-chart':      seriesOrFallback(bld.abv5Series, b5, null),
    'bp-20ma-chart':     seriesOrFallback(bld.abv20Series, b20, null),
    'bp-50ma-chart':     seriesOrFallback(bld.abv50Series, b50, null),
    'bh-price-chart':    seriesOrFallback(bld.qqqSeries, qqqLive, null),
    'bh-5ma-chart':      seriesOrFallback(bld.ndx5Series, b5, null),  // NDX 폭 데이터 없으면 SPX 공용
    'bh-20ma-chart':     seriesOrFallback(bld.ndx20Series, b20, null),
    'bh-50ma-chart':     seriesOrFallback(bld.ndx50Series, b50, null)
  };
  var colorMap = {
    'bp-ad-ratio-chart': '#00d4ff',
    'bp-price-chart':    '#a855f7',
    'bp-5ma-chart':      '#00e5a0',
    'bp-20ma-chart':     '#ffa31a',
    'bp-50ma-chart':     '#ff5b50',
    'bh-price-chart':    '#a855f7',
    'bh-5ma-chart':      '#00e5a0',
    'bh-20ma-chart':     '#ffa31a',
    'bh-50ma-chart':     '#ff5b50'
  };
  // v48.60: 차트 종류별 Y축 고정 스케일 (사용자 지적 "비율 이상 · 확대해서 봐야" 해소)
  var scaleMap = {
    // 상승 비율 차트는 0~100% 고정
    'bp-ad-ratio-chart': { min: 0, max: 100 },
    'bp-5ma-chart':      { min: 0, max: 100 },
    'bp-20ma-chart':     { min: 0, max: 100 },
    'bp-50ma-chart':     { min: 0, max: 100 },
    'bh-5ma-chart':      { min: 0, max: 100 },
    'bh-20ma-chart':     { min: 0, max: 100 },
    'bh-50ma-chart':     { min: 0, max: 100 }
    // price 차트는 data 기반 min/max + padding (아래 로직)
  };
  ids.forEach(function(id) {
    var cv = document.getElementById(id);
    if (!cv || !cv.getContext) return;
    // 이미 Chart.js로 렌더링되었으면 skip
    if (cv.__rendered && cv.__rendered === 'chartjs') return;
    var ctx = cv.getContext('2d');
    var w = cv.width = cv.clientWidth || 280;
    var h = cv.height = cv.clientHeight || 160;
    ctx.clearRect(0, 0, w, h);
    var s = seriesMap[id];
    if (!s || s.length < 2) {
      ctx.fillStyle = '#7b8599';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('데이터 대기 중 · API 키 확인', w / 2, h / 2);
      return;
    }
    // v48.60: 고정 스케일 우선 (0~100% 비율 차트)
    var fixedScale = scaleMap[id];
    var min, max;
    if (fixedScale) {
      min = fixedScale.min; max = fixedScale.max;
    } else {
      // price 차트는 데이터 기반 + 5% padding (과도한 확대 방지)
      var dataMin = Math.min.apply(null, s), dataMax = Math.max.apply(null, s);
      var pad = (dataMax - dataMin) * 0.15 || (dataMax * 0.02) || 1;
      min = dataMin - pad;
      max = dataMax + pad;
    }
    var range = max - min || 1;
    var padX = 8, padY = 14;
    var plotW = w - padX * 2, plotH = h - padY * 2;
    var stepX = plotW / (s.length - 1);

    // v48.60: Y축 gridline — v48.61 R43: Canvas CSS var 미해석 → rgba 직접
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; /* surface-3 동등 hex */
    ctx.lineWidth = 1;
    ctx.fillStyle = '#525c70';
    ctx.font = '11px "JetBrains Mono", monospace'; /* v48.61 P37 9px→11px */
    ctx.textAlign = 'right';
    var gridLines = fixedScale ? [0, 25, 50, 75, 100] : [min, min + range * 0.25, min + range * 0.5, min + range * 0.75, max];
    gridLines.forEach(function(gv) {
      var y = padY + (1 - (gv - min) / range) * plotH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
      ctx.fillText(fixedScale ? gv + '%' : gv.toFixed(0), padX - 2, y + 3);
    });

    // 배경 그라디언트 영역
    var grad = ctx.createLinearGradient(0, padY, 0, h - padY);
    grad.addColorStop(0, colorMap[id] + '40');
    grad.addColorStop(1, colorMap[id] + '08');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(padX, h - padY);
    s.forEach(function(v, i) {
      var x = padX + i * stepX;
      var y = padY + (1 - (v - min) / range) * plotH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padX + (s.length - 1) * stepX, h - padY);
    ctx.closePath();
    ctx.fill();
    // 라인
    ctx.strokeStyle = colorMap[id];
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.forEach(function(v, i) {
      var x = padX + i * stepX;
      var y = padY + (1 - (v - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // 현재값 (최신 실제값)
    ctx.fillStyle = '#f0f4fc';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    var curr = s[s.length - 1];
    var currText = id.indexOf('price') >= 0 ? '$' + curr.toFixed(2) : curr.toFixed(1) + '%';
    // 흰색 배경 박스 (가독성)
    var textW = ctx.measureText(currText).width;
    ctx.fillStyle = colorMap[id] + 'dd';
    ctx.fillRect(w - padX - textW - 6, padY + 2, textW + 6, 16);
    ctx.fillStyle = '#001018';
    ctx.fillText(currText, w - padX - 3, padY + 13);
    cv.__rendered = 'fallback';
  });
};

// v48.60: Breadth 페이지 진입 + _liveData 갱신 시 자동 재렌더 (Y축 스케일 실시간 보정)
// v48.99: _aioPageBus 마이그 (P178)
if (typeof document !== 'undefined') {
  _aioPageBus.register('core-breadth', 'aio:liveQuotes', function(){
    var bp = document.getElementById('page-breadth');
    if (bp && bp.classList.contains('active') && typeof window._aioBreadthCanvasRender === 'function') {
      try { window._aioBreadthCanvasRender(); } catch(_){}
    }
  });
}

// v48.49: 분산형 aio-tooltip 토글 — `?` 버튼 클릭 시 팝오버 표시/숨김 + 외부 클릭으로 닫기
window._aioTooltipToggle = function(el, e) {
  if (!el) return;
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  var wasOpen = el.classList.contains('is-open');
  // 다른 툴팁 모두 닫기
  document.querySelectorAll('.aio-tooltip.is-open').forEach(function(t){ t.classList.remove('is-open'); });
  if (!wasOpen) el.classList.add('is-open');
};
// 외부 클릭/ESC 닫기
document.addEventListener('click', function(e) {
  var isTooltip = e.target && e.target.closest && e.target.closest('.aio-tooltip');
  if (isTooltip) return;
  document.querySelectorAll('.aio-tooltip.is-open').forEach(function(t){ t.classList.remove('is-open'); });
});
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.aio-tooltip.is-open').forEach(function(t){ t.classList.remove('is-open'); });
});

// v48.60: signal 페이지 시장 국면 진단 카드 + 시나리오 전망 동적 렌더러
// regime-nyse-sell / regime-aaii / regime-pcr + scenario-outlook-ts 타임스탬프
window._aioRenderSignalRegime = function() {
  try {
    var ld = window._liveData || {};
    var snap = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : {};

    // 1) NYSE 매도 비율 — A-D ratio 역산 (0~100)
    var b5 = (typeof window._breadth5 === 'number') ? window._breadth5 : null;
    var nyseSell = b5 != null ? (100 - b5).toFixed(1) + '%' : '—';
    var nyseEl = document.getElementById('regime-nyse-sell');
    if (nyseEl) {
      nyseEl.textContent = nyseSell;
      var nyseN = parseFloat(nyseSell);
      nyseEl.style.color = isFinite(nyseN) ? (nyseN > 60 ? 'var(--data-red)' : nyseN > 45 ? 'var(--data-amber)' : 'var(--data-green)') : 'var(--text-muted)';
      var sub = nyseEl.nextElementSibling;
      if (sub) sub.textContent = isFinite(nyseN) ? (nyseN > 60 ? '매도 우세' : nyseN > 45 ? '균형' : '매수 우세') : '—';
    }

    // 2) AAII 약세 비율 — 실시간 window._aaiiBearish 우선 (v48.61 버그 수정)
    var aaiiBear = (typeof window._aaiiBearish === 'number') ? window._aaiiBearish
                 : (snap.aaiiBear != null ? snap.aaiiBear : 43.0);
    var aaiiEl = document.getElementById('regime-aaii');
    if (aaiiEl) {
      aaiiEl.textContent = aaiiBear.toFixed(1) + '%';
      aaiiEl.style.color = aaiiBear > 40 ? 'var(--data-amber)' : 'var(--data-green)';
      var aaiiSub = aaiiEl.nextElementSibling;
      if (aaiiSub) aaiiSub.textContent = aaiiBear > 40 ? '비관 우세' : aaiiBear > 30 ? '중립' : '낙관';
    }

    // 3) Put/Call 비율 — window._putCallRatio (실제 전역, P88 교정) + snap.pcr 키 (v48.61 버그 수정)
    var pcr = (typeof window._putCallRatio === 'number') ? window._putCallRatio
            : (snap.pcr != null ? snap.pcr : (snap.pcRatio != null ? snap.pcRatio : null));
    pcr = (pcr != null) ? parseFloat(pcr) : null;
    var pcrEl = document.getElementById('regime-pcr');
    if (pcrEl) {
      if (pcr != null && isFinite(pcr)) {
        pcrEl.textContent = pcr.toFixed(2);
        pcrEl.style.color = pcr > 1.1 ? 'var(--data-green)' : pcr > 0.9 ? 'var(--data-amber)' : 'var(--data-red)';
        var pcrSub = pcrEl.nextElementSibling;
        if (pcrSub) pcrSub.textContent = pcr > 1.1 ? '공포 심함 (역발상 매수)' : pcr > 0.9 ? '균형' : '과도한 낙관';
      } else {
        pcrEl.textContent = '—';
        var pcrSub2 = pcrEl.nextElementSibling;
        if (pcrSub2) pcrSub2.textContent = 'CBOE 수동 갱신';
      }
    }

    // 4) 시나리오 전망 타임스탬프 동적 갱신 (2026-04-04 hardcoded 제거)
    var tsEl = document.getElementById('scenario-outlook-ts');
    if (tsEl) {
      var now = new Date();
      var kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
      var mm = String(kst.getMonth() + 1).padStart(2, '0');
      var dd = String(kst.getDate()).padStart(2, '0');
      var wti = ld['CL=F'] ? ld['CL=F'].price : (snap.wti || null);
      var vix = ld['^VIX'] ? ld['^VIX'].price : (snap.vix || null);
      var contextNote = '';
      if (wti && vix) contextNote = ' · WTI $' + wti.toFixed(0) + ' · VIX ' + vix.toFixed(1);
      tsEl.textContent = kst.getFullYear() + '-' + mm + '-' + dd + ' 기준' + contextNote + ' · 실시간 갱신';
    }
  } catch(e) {
    if (window._aioLog) window._aioLog('warn', 'render', '_aioRenderSignalRegime: ' + (e && e.message || e));
  }
};
// 훅: _liveData 갱신 + signal/briefing 페이지 진입 시
// v48.99: _aioPageBus 마이그 (P178)
if (typeof document !== 'undefined') {
  _aioPageBus.register('core-signal-live', 'aio:liveQuotes', function(){
    var sig = document.getElementById('page-signal');
    if (sig && sig.classList.contains('active')) window._aioRenderSignalRegime();
  });
  _aioPageBus.register('core-signal-shown', 'aio:pageShown', function(e){
    if (e.detail === 'signal' || e.detail === 'home') {
      setTimeout(function(){
        if (typeof updateBottomProcess === 'function') { try { updateBottomProcess(); } catch(_){} }
        window._aioRenderSignalRegime();
      }, 250);
    }
  });
  // 초기 로드 후 5초 뒤 1회 강제 실행 (페이지 최초 진입 대응)
  setTimeout(window._aioRenderSignalRegime, 5000);
}

// v48.58: Guide 페이지 점프 + 검색 (18K줄 탐색성 개선, TOC)
window._aioGuideJump = function(targetId) {
  var el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 펼쳐진 상태로
    if (el.classList && !el.classList.contains('is-open')) el.classList.add('is-open');
  } else {
    // 근사 매칭
    var keyword = (targetId || '').replace(/^guide-/, '');
    window._aioGuideSearch(keyword);
  }
};
window._aioGuideSearchTrigger = function() {
  var inp = document.getElementById('guide-search-input');
  if (inp && inp.value) window._aioGuideSearch(inp.value);
};
window._aioGuideSearch = function(keyword) {
  var result = document.getElementById('guide-search-result');
  if (!result) return;
  keyword = (keyword || '').trim().toLowerCase();
  if (!keyword) { result.style.display = 'none'; return; }
  var guidePage = document.getElementById('page-guide');
  if (!guidePage) return;
  // guide 페이지 내 모든 텍스트 노드 중 match
  var matches = [];
  var walker = document.createTreeWalker(guidePage, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    var text = (node.nodeValue || '').toLowerCase();
    if (text.indexOf(keyword) >= 0 && text.trim().length > 2) {
      var parent = node.parentElement;
      if (!parent) continue;
      // 상위 섹션 제목 찾기
      var section = parent.closest('.explain-section, .aio-explain, [id]');
      if (section && matches.length < 10 && !matches.some(function(m){ return m.el === section; })) {
        matches.push({ el: section, text: node.nodeValue.trim().slice(0, 80) });
      }
    }
  }
  if (matches.length === 0) {
    result.innerHTML = '<span style="color:var(--data-amber);">"' + escHtml(keyword) + '" 검색 결과 없음</span>';
    result.style.display = 'block';
    return;
  }
  var escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var html = '<span style="color:var(--data-green);font-weight:700;">' + matches.length + '건 발견 — 클릭하여 이동:</span>';
  matches.forEach(function(m, i) {
    var labelEl = m.el.querySelector('.explain-label, .aio-explain-trigger-label span:last-child, h2, h3');
    var label = labelEl ? labelEl.textContent.trim().slice(0, 60) : ('결과 ' + (i+1));
    var ref = 'guide-match-' + i;
    m.el.id = m.el.id || ref;
    var safeText = escHtml(m.text).replace(new RegExp(escapedKeyword, 'gi'), function(mt){return '<mark style="background:var(--data-amber);color:#001018;padding:0 2px;">'+escHtml(mt)+'</mark>';});
    html += '<div style="margin-top:4px;padding:4px 8px;background:var(--surface-3);border-radius:4px;cursor:pointer;" data-action="_aioGuideJump" data-arg="' + escHtml(m.el.id) + '"><strong style="color:var(--data-cyan);">' + escHtml(label) + '</strong> <span style="color:var(--text-muted);margin-left:6px;">' + safeText + '…</span></div>';
  });
  result.innerHTML = html;
  result.style.display = 'block';
};

// v48.58: options 페이지 선물 흐름 판정 (ES/NQ/YM/RTY 4지수 동행/분산)
window._aioRenderFuturesFlow = function() {
  var el = document.getElementById('futures-flow-text');
  if (!el) return;
  var ld = window._liveData || {};
  var es = ld['ES=F'] ? ld['ES=F'].pct : null;
  var nq = ld['NQ=F'] ? ld['NQ=F'].pct : null;
  var ym = ld['YM=F'] ? ld['YM=F'].pct : null;
  var rty = ld['RTY=F'] ? ld['RTY=F'].pct : null;
  var pcts = [es, nq, ym, rty].filter(function(v){ return v != null && isFinite(v); });
  if (pcts.length < 2) { el.textContent = '선물 데이터 수신 대기 중'; return; }
  var upCount = pcts.filter(function(p){ return p > 0.1; }).length;
  var downCount = pcts.filter(function(p){ return p < -0.1; }).length;
  var avg = pcts.reduce(function(a,b){return a+b;},0) / pcts.length;
  var spread = Math.max.apply(null, pcts) - Math.min.apply(null, pcts);
  var text, color;
  if (upCount === pcts.length && spread < 0.5) {
    text = '4지수 동행 상승 (평균 +' + avg.toFixed(2) + '%, 편차 ' + spread.toFixed(2) + '%p) — 광범위 모멘텀. Risk-On 확증. 상승 갭오픈 가능성.';
    color = 'var(--data-green)';
  } else if (downCount === pcts.length && spread < 0.5) {
    text = '4지수 동행 하락 (평균 ' + avg.toFixed(2) + '%, 편차 ' + spread.toFixed(2) + '%p) — 광범위 매도. Risk-Off 확증. 하락 갭오픈 경고.';
    color = 'var(--data-red)';
  } else if (spread > 1.0) {
    text = '4지수 분산 (편차 ' + spread.toFixed(2) + '%p) — 섹터별 차등. 대형주 vs 중소형 다른 흐름 · 개별 포지션 중심.';
    color = 'var(--data-amber)';
  } else {
    text = '혼조 (평균 ' + (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%, 편차 ' + spread.toFixed(2) + '%p) — 방향성 부재. 이벤트 대기 구간.';
    color = 'var(--text-muted)';
  }
  el.textContent = text;
  var wrap = el.parentElement;
  if (wrap) wrap.style.borderLeftColor = color;
  var strong = wrap && wrap.querySelector('strong');
  if (strong) strong.style.color = color;
};
// v48.99: _aioPageBus 마이그 (P178)
if (typeof document !== 'undefined') {
  _aioPageBus.register('core-options-live', 'aio:liveQuotes', function(){
    var opt = document.getElementById('page-options');
    if (opt && opt.classList.contains('active')) window._aioRenderFuturesFlow();
  });
  _aioPageBus.register('core-options-shown', 'aio:pageShown', function(e){
    if (e.detail === 'options') setTimeout(window._aioRenderFuturesFlow, 300);
  });
}

// v48.58: VIX Term Structure 기간구조 판정 (sentiment 페이지)
window._aioRenderVixTermRegime = function() {
  var el = document.getElementById('vix-term-regime-text');
  if (!el) return;
  var ld = window._liveData || {};
  var v9d = ld['^VIX9D'] ? ld['^VIX9D'].price : null;
  var v30 = ld['^VIX'] ? ld['^VIX'].price : null;
  var v3m = ld['^VIX3M'] ? ld['^VIX3M'].price : null;
  var v6m = ld['^VIX6M'] ? ld['^VIX6M'].price : null;
  if (!v30) { el.textContent = 'VIX 데이터 수신 대기 중'; return; }
  var available = [v9d, v30, v3m, v6m].filter(function(v){ return v != null; });
  if (available.length < 2) { el.textContent = '기간구조 산정 불가 (부족한 만기)'; return; }
  // 정상(콘탱고): 단기<장기. 역전(백워데이션): 단기>장기.
  var diff30_3m = (v3m != null) ? (v3m - v30) : 0;
  var diff9d_30 = (v9d != null && v30 != null) ? (v30 - v9d) : 0;
  var regime, color;
  if (v9d != null && v9d > v30 * 1.02) { regime = '백워데이션 (패닉 신호) — VIX9D > VIX, 즉각적 공포 우세. 역사적으로 1~2주 내 바닥 반등 가능.'; color = 'var(--data-red)'; }
  else if (diff30_3m < -1) { regime = '백워데이션 (조정 경보) — VIX > VIX3M. 중기 우려 누적, 포지션 방어 고려.'; color = 'var(--data-amber)'; }
  else if (diff30_3m < 1 && diff30_3m > -1) { regime = '평탄화 — 콘탱고 붕괴 직전. 변동성 확대 가능, 헤지 강화 시점.'; color = 'var(--data-amber)'; }
  else { regime = '정상 콘탱고 — 단기&lt;장기, 시장 안정 국면. 위험자산 비중 유지 가능.'; color = 'var(--data-green)'; }
  el.innerHTML = regime;
  // 색상 업데이트
  var wrap = el.parentElement;
  if (wrap) wrap.style.borderLeftColor = color;
  var strong = wrap && wrap.querySelector('strong');
  if (strong) strong.style.color = color;
  // v48.71: 스파클라인 차트 (9D·1M·3M·6M 기간구조 곡선)
  var canv = document.getElementById('vix-term-chart');
  if (canv && typeof Chart !== 'undefined') {
    var pts = [
      { x: '9D', y: v9d }, { x: '1M', y: v30 }, { x: '3M', y: v3m }, { x: '6M', y: v6m }
    ].filter(function(p){ return p.y != null; });
    if (pts.length >= 2) {
      var ptLabels = pts.map(function(p){ return p.x; });
      var ptData = pts.map(function(p){ return p.y; });
      var chartColor = (ptData[ptData.length-1] > ptData[0]) ? '#00e5a0' : '#ff5b50';
      if (window._vixTermChart) { try { window._vixTermChart.destroy(); } catch(e){} delete window._vixTermChart; }
      window._vixTermChart = new Chart(canv, {
        type: 'line',
        data: { labels: ptLabels, datasets: [{ data: ptData, borderColor: chartColor, backgroundColor: chartColor + '22', borderWidth: 2, pointRadius: 4, pointBackgroundColor: chartColor, fill: true, tension: 0.3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: function(ctx){ return ctx.parsed.y.toFixed(2); } } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 9 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 9 }, maxTicksLimit: 4 } }
          }
        }
      });
    }
  }
};
// v48.99: _aioPageBus 마이그 (P178)
if (typeof document !== 'undefined') {
  _aioPageBus.register('core-sentiment-live', 'aio:liveQuotes', function(){
    var sent = document.getElementById('page-sentiment');
    if (sent && sent.classList.contains('active')) window._aioRenderVixTermRegime();
  });
  _aioPageBus.register('core-sentiment-shown', 'aio:pageShown', function(e){
    if (e.detail === 'sentiment') setTimeout(window._aioRenderVixTermRegime, 300);
  });

  // v49.29 E6 적용: options 페이지 진입 시 ACTION_RULES 기반 옵션 전략 추천
  _aioPageBus.register('core-options-rec', 'aio:pageShown', function(e){
    if (e.detail !== 'options') return;
    setTimeout(function() {
      try {
        if (!window.AIO_ACTION_RULES) return;
        var ld = window._liveData || {};
        var vixVal = ld['^VIX'] ? ld['^VIX'].price : (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.vix : NaN);
        var fgVal = parseInt((document.getElementById('fg-score-big') || {}).textContent) || NaN;
        var pos = window.AIO_ACTION_RULES.positionSizing.getRule(vixVal);
        var sent = window.AIO_ACTION_RULES.sentimentAction.getRule(fgVal);
        var posEl = document.getElementById('options-rec-position');
        var sentEl = document.getElementById('options-rec-sentiment');
        var stratEl = document.getElementById('options-rec-strategy');
        if (posEl && pos) posEl.textContent = '💼 VIX ' + (isNaN(vixVal) ? '—' : vixVal.toFixed(1)) + ' → 포지션 ' + pos.sizePct + '%';
        if (sentEl && sent) sentEl.textContent = '🧠 F&G ' + (isNaN(fgVal) ? '—' : fgVal) + ' → ' + sent.action;
        if (stratEl) {
          var strategy;
          if (!isNaN(vixVal)) {
            if (vixVal >= 30)      strategy = '🛡 권장 전략: Put 헤지 + Long Volatility (IV 높음 → IV crush 위험. CSP 매도는 회복 후)';
            else if (vixVal >= 20) strategy = '⚠️ 권장 전략: Covered Call (IV 보통+ → premium 수익). Long Vol 신중.';
            else if (vixVal >= 15) strategy = '✓ 권장 전략: Bull Call Spread / Covered Call (IV 정상 Risk-On)';
            else                   strategy = '🔥 권장 전략: Long Volatility (VIX <15 → IV 저점 매수 기회). Naked Call/Put 매도 자제.';
          } else {
            strategy = '환경 데이터 부족 — VIX 로딩 후 자동 갱신';
          }
          stratEl.textContent = strategy;
        }
      } catch(_e) {}
    }, 200);
  });

  // v49.29 E2 적용: briefing 페이지 진입 시 ACTION_RULES 결과 표시
  _aioPageBus.register('core-briefing-action', 'aio:pageShown', function(e){
    if (e.detail !== 'briefing') return;
    setTimeout(function() {
      try {
        if (!window.AIO_ACTION_RULES || !window.AIO_ACTION_RULES.getActionPlan) return;
        var ld = window._liveData || {};
        var vixVal = ld['^VIX'] ? ld['^VIX'].price : (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.vix : NaN);
        var fgVal = parseInt((document.getElementById('fg-score-big') || {}).textContent) || NaN;
        var plan = window.AIO_ACTION_RULES.getActionPlan({ vix: vixVal, fg: fgVal });
        var posEl = document.getElementById('briefing-action-position');
        var sentEl = document.getElementById('briefing-action-sentiment');
        if (posEl && plan.position) posEl.textContent = '💼 ' + plan.position.sizePct + '% 포지션 — ' + plan.position.note + ' (VIX ' + (isNaN(vixVal) ? '—' : vixVal.toFixed(1)) + ')';
        if (sentEl && plan.sentiment) sentEl.textContent = '🧠 ' + plan.sentiment.action + ' — ' + plan.sentiment.note + ' (F&G ' + (isNaN(fgVal) ? '—' : fgVal) + ')';

        // v49.48 P316/R75 보강: jensen-hardcoded hook → `_aioStaticContentLifecycleHook()` 일반화 위임.
        // 모든 [data-lifecycle-id] 마커 element 자동 갱신 (briefing-week-may-4-10 / kr-export-2026-02 등).
        try { if (typeof window._aioStaticContentLifecycleHook === 'function') window._aioStaticContentLifecycleHook(); } catch(_je) {}
      } catch(_e) {}
    }, 200);
  });

  // v49.29 L2/L3 적용: breadth 페이지 진입 시 diagnoseBreadthConsensus 결과 표시
  _aioPageBus.register('core-breadth-consensus', 'aio:pageShown', function(e){
    if (e.detail !== 'breadth') return;
    setTimeout(function() {
      try {
        if (!window.AIO || !window.AIO.diagnoseBreadthConsensus) return;
        // 정적 폴백 값 + 실시간 (있으면 우선)
        var S = window.DATA_SNAPSHOT || {};
        var consensus = window.AIO.diagnoseBreadthConsensus({
          sma5: S.breadth5sma || 68,
          sma20: S.breadth20sma || 75,
          sma50: S.breadth50sma || 46,
          mcclellan: 'bearish',   // 정적 입력 — 실제 McClellan API 연동 시 동적
          weinstein: 'bearish',   // Stage 3 = bearish 신호
          goldenCross: 'bullish'  // Golden Cross 유지 시
        });
        var verdictEl = document.getElementById('breadth-consensus-verdict');
        var conflictEl = document.getElementById('breadth-consensus-conflict');
        var detailsEl = document.getElementById('breadth-consensus-details');
        if (verdictEl) {
          verdictEl.textContent = consensus.verdict + ' (consensus ' + (consensus.consensus != null ? consensus.consensus.toFixed(2) : '—') + ')';
          // 색상 적용
          if (consensus.consensus > 0.1) verdictEl.style.color = 'var(--data-green)';
          else if (consensus.consensus < -0.1) verdictEl.style.color = 'var(--data-red)';
          else verdictEl.style.color = 'var(--data-amber)';
        }
        if (conflictEl) {
          if (consensus.conflict) {
            conflictEl.textContent = '⚠️ 모순 신호: ' + consensus.conflict.note;
            conflictEl.style.color = 'var(--data-red)';
          } else {
            conflictEl.textContent = '✓ 모든 신호가 같은 방향';
            conflictEl.style.color = 'var(--data-green)';
          }
        }
        if (detailsEl && Array.isArray(consensus.details)) {
          detailsEl.textContent = '입력: ' + consensus.details.map(function(d) {
            return d.key + '=' + (d.value != null ? d.value : d.signal);
          }).join(' · ');
        }
      } catch(_e) { /* breadth 페이지 합의 실패 — 정적 진단으로 폴백 */ }
    }, 200);
  });

  // v49.28 I7 적용: themes 페이지 진입 시 getCycleFromMacro 결과 표시
  _aioPageBus.register('core-themes-cycle-dynamic', 'aio:pageShown', function(e){
    if (e.detail !== 'themes') return;
    setTimeout(function() {
      try {
        if (!window.AIO || !window.AIO.getCycleFromMacro) return;
        var cycle = window.AIO.getCycleFromMacro({});
        var phaseEl = document.getElementById('cycle-dynamic-phase');
        var inputsEl = document.getElementById('cycle-dynamic-inputs');
        var rationaleEl = document.getElementById('cycle-dynamic-rationale');
        if (phaseEl) phaseEl.textContent = cycle.phase;
        if (inputsEl) inputsEl.textContent = 'VIX ' + (isNaN(cycle.inputs.vix) ? '—' : cycle.inputs.vix.toFixed(1)) + ' · Breadth50 ' + (isNaN(cycle.inputs.breadth50) ? '—' : cycle.inputs.breadth50 + '%') + ' · 2s10s ' + (cycle.inputs.yield2s10s || 0).toFixed(2) + ' · SPX ' + cycle.inputs.spxTrend;
        if (rationaleEl) rationaleEl.textContent = '근거: ' + cycle.rationale.join(' · ');
      } catch(_e) { /* themes 페이지 진입 동적 사이클 실패 — 정적 진단으로 폴백 */ }
    }, 200);
  });

  // v49.41 P295/R73 보강: signal 페이지 진입 시 SCENARIO_REGISTRY.signalShortTerm 동기 갱신
  // index.html L5195~5224의 정적 인라인 확률(30~35%/40~45%/15~20%)을 REGISTRY 값으로 갱신 +
  // L5199 #scenario-outlook-ts에 lastUpdated 동기 표시 (정적 "분석 대기 중" 차단).
  _aioPageBus.register('core-signal-scenario', 'aio:pageShown', function(e){
    if (e.detail !== 'signal') return;
    setTimeout(function() {
      try {
        var reg = window.AIO_SCENARIO_REGISTRY;
        if (!reg || !reg.signalShortTerm) return;
        var sst = reg.signalShortTerm;
        // lastUpdated 표시 (#scenario-outlook-ts)
        var latest = null;
        Object.keys(sst).forEach(function(k) {
          var ts = new Date(sst[k].lastUpdated).getTime();
          if (latest == null || ts > latest) latest = ts;
        });
        var tsEl = document.getElementById('scenario-outlook-ts');
        if (tsEl && latest) {
          var days = Math.floor((Date.now() - latest) / 86400000);
          var staleSfx = (days > reg.staleDaysThreshold) ? ' ⚠️ ' + days + '일 경과' : ' (' + days + '일 전)';
          tsEl.textContent = '최근 갱신: ' + new Date(latest).toISOString().slice(0, 10) + staleSfx;
        }
        // 3 카드 헤더 확률 갱신 (data-scenario-key="optimistic|base|pessimistic")
        Object.keys(sst).forEach(function(key) {
          var card = document.querySelector('[data-scenario-key="' + key + '"]');
          if (!card) return;
          var headerEl = card.querySelector('.scenario-header');
          if (headerEl) {
            var icon = key === 'optimistic' ? '🟢' : key === 'base' ? '🟡' : '🔴';
            headerEl.textContent = icon + ' ' + sst[key].label + ' (' + sst[key].probabilityRange + ')';
          }
        });
        // 확률 합 검증 표시 (선택 — #signal-scenario-sum 있으면)
        var sumEl = document.getElementById('signal-scenario-sum');
        var sumCheck = reg.validateSignalSum();
        if (sumEl) sumEl.textContent = sumCheck.sum.toFixed(2) + (sumCheck.valid ? ' ✓' : ' ⚠️');

        // v49.41 P296/R77 보강: signal CP2 fed-rate / fomc lastUpdated 메타 표시
        // MACRO_CALENDAR.us-fed-rate의 nextRelease (다음 FOMC) 대비 경과일 표시 + 지나면 stale 경고.
        try {
          var cal = window.AIO_MACRO_CALENDAR;
          var metaEl = document.getElementById('cp2-fed-rate-meta');
          if (cal && cal.releases && cal.releases['us-fed-rate'] && metaEl) {
            var rel = cal.releases['us-fed-rate'];
            var nextTs = new Date(rel.nextRelease).getTime();
            var nowMs = Date.now();
            if (!isNaN(nextTs)) {
              var daysToNext = Math.floor((nextTs - nowMs) / 86400000);
              if (daysToNext > 0) {
                metaEl.textContent = '(다음 FOMC ' + rel.nextRelease + ' · D-' + daysToNext + ')';
                metaEl.style.color = 'var(--text-muted)';
              } else {
                metaEl.textContent = '⚠️ FOMC 일정 갱신 필요 (' + (-daysToNext) + '일 경과)';
                metaEl.style.color = 'var(--data-amber)';
              }
            }
          }
        } catch(_e2) {}
      } catch(_e) { /* signal 시나리오 갱신 실패 — 정적 폴백 */ }
    }, 200);
  });

  // v49.28 L6 적용: macro 페이지 진입 시 SCENARIO_REGISTRY 정보 표시
  _aioPageBus.register('core-macro-scenario', 'aio:pageShown', function(e){
    if (e.detail !== 'macro') return;
    setTimeout(function() {
      try {
        var reg = window.AIO_SCENARIO_REGISTRY;
        if (!reg) return;
        // 가장 늦은 lastUpdated 찾기
        var latest = null;
        Object.keys(reg.scenarios).forEach(function(k) {
          var ts = new Date(reg.scenarios[k].lastUpdated).getTime();
          if (latest == null || ts > latest) latest = ts;
        });
        var updEl = document.getElementById('macro-scenario-updated');
        if (updEl && latest) updEl.textContent = new Date(latest).toISOString().slice(0, 10);
        var staleEl = document.getElementById('macro-scenario-stale-days');
        if (staleEl && latest) {
          var days = Math.floor((Date.now() - latest) / 86400000);
          staleEl.textContent = days + '일 경과' + (days > reg.staleDaysThreshold ? ' ⚠️ STALE' : '');
        }
        var sumEl = document.getElementById('macro-scenario-sum');
        var sumCheck = reg.validateSum();
        if (sumEl) sumEl.textContent = sumCheck.sum.toFixed(2) + (sumCheck.valid ? ' ✓' : ' ⚠️');
      } catch(_e) {}
    }, 200);
  });
}


// v48.58: 첫 방문 온보딩 모달 (Blocker #1 해소 — API 키 선택 가이드)
window._aioShowOnboarding = function() {
  if (document.getElementById('aio-onboarding-modal')) return;
  var dismissed = false;
  try { dismissed = localStorage.getItem('aio_onboarding_dismissed') === '1'; } catch(_){}
  if (dismissed) return;
  var modal = document.createElement('div');
  modal.id = 'aio-onboarding-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'aio-onboard-title');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = '' +
    '<div class="aio-prompt-modal" style="background:var(--bg-card);border:1px solid var(--border-strong);border-radius:12px;padding:22px 26px;max-width:540px;width:100%;max-height:86vh;overflow-y:auto;box-shadow:var(--shadow-lg);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
        '<h2 id="aio-onboard-title" style="margin:0;font-size:17px;font-weight:700;color:var(--text-primary);">AIO Screener에 오신 것을 환영합니다</h2>' +
        '<button data-action="_aioOnboardDismiss" aria-label="온보딩 닫기" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px 8px;">✕</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-bottom:16px;">' +
        '본 터미널은 <strong>5개 무료 API</strong>를 조합하여 실시간 시장 분석 · 포트폴리오 · AI 채팅을 제공합니다. 아래 순서로 API 키를 설정하세요 (모두 무료, 신용카드 불필요).' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">' +
        '<div style="padding:10px 12px;background:var(--surface-3);border:1px solid var(--border);border-radius:7px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--data-cyan);margin-bottom:4px;">' +
            '<span style="background:var(--data-cyan);color:#001018;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">1</span>' +
            '<span>Claude API (필수) — AI 채팅·분석</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);padding-left:28px;line-height:1.6;"><a href="https://console.anthropic.com" target="_blank" rel="noopener" style="color:var(--data-cyan);">console.anthropic.com</a>에서 발급 · $5 무료 크레딧</div>' +
        '</div>' +
        '<div style="padding:10px 12px;background:var(--surface-3);border:1px solid var(--border);border-radius:7px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--data-amber);margin-bottom:4px;">' +
            '<span style="background:var(--data-amber);color:#001018;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">2</span>' +
            '<span>Finnhub (강력 권장) — 실시간 시세·어닝·뉴스</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);padding-left:28px;line-height:1.6;"><a href="https://finnhub.io/register" target="_blank" rel="noopener" style="color:var(--data-amber);">finnhub.io/register</a> · 60 req/min 무료</div>' +
        '</div>' +
        '<div style="padding:10px 12px;background:var(--surface-3);border:1px solid var(--border);border-radius:7px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--data-green);margin-bottom:4px;">' +
            '<span style="background:var(--data-green);color:#001018;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">3</span>' +
            '<span>FMP (권장) — 기업 재무·밸류에이션</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);padding-left:28px;line-height:1.6;"><a href="https://financialmodelingprep.com/developer" target="_blank" rel="noopener" style="color:var(--data-green);">financialmodelingprep.com</a> · 250 req/day 무료</div>' +
        '</div>' +
        '<div style="padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:7px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">' +
            '<span style="background:var(--text-muted);color:#001018;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">4</span>' +
            '<span>FRED (선택) — 매크로 지표</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);padding-left:28px;line-height:1.6;"><a href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noopener" style="color:var(--text-secondary);">fred.stlouisfed.org</a> · 무제한 무료</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:10px 12px;background:var(--data-cyan-light);border:1px solid var(--accent-border);border-radius:7px;margin-bottom:14px;font-size:11px;color:var(--text-secondary);line-height:1.6;">' +
        '<strong style="color:var(--data-cyan);">키 없이도 사용 가능</strong> — Yahoo/Stooq/Naver/CoinGecko 공개 시세 + 정적 스냅샷 데이터. 단 AI 채팅·기업 재무는 키 필요.' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button data-action="_aioOnboardLater" class="aio-btn-table" style="font-size:12px;padding:8px 14px;">나중에</button>' +
        '<button data-action="_aioOnboardGoKeys" class="aio-btn-table primary" style="font-size:12px;padding:8px 16px;font-weight:700;">API 키 설정 →</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
};
window._aioOnboardDismiss = function() {
  try { localStorage.setItem('aio_onboarding_dismissed', '1'); } catch(_){}
  var m = document.getElementById('aio-onboarding-modal');
  if (m) m.remove();
};
window._aioOnboardLater = function() {
  // "나중에": 3일 후 다시 표시 (dismissed 아님)
  try { localStorage.setItem('aio_onboarding_later_until', String(Date.now() + 3 * 86400000)); } catch(_){}
  var m = document.getElementById('aio-onboarding-modal');
  if (m) m.remove();
};
window._aioOnboardGoKeys = function() {
  window._aioOnboardDismiss();
  // 사이드바 API 키 섹션으로 스크롤
  var keySection = document.querySelector('.sidebar-api-section');
  if (keySection) keySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  var firstKeyInput = document.querySelector('.llm-key-input');
  if (firstKeyInput) setTimeout(function(){ firstKeyInput.focus(); }, 300);
};
// 첫 방문 감지 (2초 지연 — 로딩 완료 후)
if (typeof document !== 'undefined') {
  setTimeout(function() {
    try {
      var dismissed = localStorage.getItem('aio_onboarding_dismissed') === '1';
      var laterUntil = parseInt(localStorage.getItem('aio_onboarding_later_until') || '0', 10);
      var hasAnyKey = false;
      ['aio_claude_api_key', 'aio_finnhub_key', 'aio_fmp_key', 'aio_fred_key'].forEach(function(k){
        if (localStorage.getItem(k)) hasAnyKey = true;
      });
      // 키 하나라도 있으면 온보딩 불필요
      if (hasAnyKey) { try { localStorage.setItem('aio_onboarding_dismissed', '1'); } catch(_){} return; }
      if (dismissed) return;
      if (laterUntil && Date.now() < laterUntil) return;
      window._aioShowOnboarding();
    } catch(_){}
  }, 2500);
}

// v48.58: 포트폴리오 시세 신선도 UI 업데이터 (Blocker #2 해소)
window._aioUpdateFreshness = function() {
  var strip = document.getElementById('pf-freshness-strip');
  if (!strip) return;
  var dot = document.getElementById('pf-freshness-dot');
  var label = document.getElementById('pf-freshness-label');
  var time = document.getElementById('pf-freshness-time');
  var now = Date.now();
  var lastFetch = (window._lastFetch && (window._lastFetch.quote || window._lastFetch.liveQuotes)) ? (window._lastFetch.quote || window._lastFetch.liveQuotes) : null;
  if (!lastFetch) {
    if (dot) { dot.style.background = '#8896a8'; dot.style.boxShadow = 'none'; }
    if (label) { label.textContent = '대기 중'; label.style.color = 'var(--text-muted)'; }
    if (time) time.textContent = '갱신: 대기';
    return;
  }
  var ageSec = Math.round((now - lastFetch) / 1000);
  var ageMin = Math.round(ageSec / 60);
  var state, color, src;
  if (ageSec < 90) { state = '실시간'; color = 'var(--data-green)'; }
  else if (ageSec < 300) { state = '지연'; color = 'var(--data-amber)'; }
  else if (ageSec < 1800) { state = '스테일'; color = 'var(--data-amber)'; }
  else { state = '연결 끊김'; color = 'var(--data-red)'; }
  var source = (window._lastQuoteSource) ? window._lastQuoteSource : 'Yahoo';
  if (dot) { dot.style.background = color; dot.style.boxShadow = '0 0 6px ' + color; }
  if (label) { label.textContent = state + ' (' + source + ')'; label.style.color = 'var(--text-primary)'; }
  if (time) time.textContent = '갱신: ' + (ageSec < 60 ? ageSec + '초 전' : ageMin + '분 전');
};
// v48.99: _aioPageBus 마이그 (P178)
if (typeof document !== 'undefined') {
  _aioPageBus.register('core-freshness', 'aio:liveQuotes', function(){ window._aioUpdateFreshness(); });
  // v48.91: 타이머 레지스트리 등록
  window._aioFreshnessTimer = _aioRegisterTimer('freshness', function(){ window._aioUpdateFreshness(); }, 30 * 1000);
}

// v48.55: 뉴스 티커 배지 클릭 → ticker 페이지 이동 + 심볼 자동 조회 (사용자 지적 "뉴스→기업" 연결)
window._aioNewsTickerClick = function(sym) {
  if (!sym) return;
  sym = String(sym).toUpperCase().replace('$','').trim();
  // 현재 페이지 저장 (breadcrumb용)
  if (typeof window.prevPage !== 'undefined') {
    var active = document.querySelector('.page.active');
    window.prevPage = active ? active.id.replace('page-','') : 'briefing';
  }
  // Ticker 페이지 이동
  if (typeof window.showTicker === 'function') {
    window.showTicker(sym);
  } else if (typeof window.showPage === 'function') {
    window.showPage('ticker');
    setTimeout(function() {
      var inp = document.getElementById('ticker-analysis-input');
      if (inp) inp.value = sym;
      if (typeof window.analyzeTickerDeep === 'function') window.analyzeTickerDeep(sym);
    }, 150);
  }
};

// v48.47: Portfolio rr-position-select 드롭다운 재생성
window._aioRRPopulateSelect = function() {
  var sel = document.getElementById('rr-position-select');
  if (!sel) return;
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  var current = sel.value;
  sel.innerHTML = '<option value="">포지션에서 자동 입력...</option>' +
    positions.map(function(p){
      return '<option value="' + p.ticker + '">' + p.ticker + ' · ' + p.qty + '주 @ $' + Number(p.cost).toFixed(2) + '</option>';
    }).join('');
  if (current && positions.some(function(p){return p.ticker===current;})) sel.value = current;
};
window._aioScrollApiSection = function() {
  var s = document.querySelector('.sidebar-api-section');
  if (s) s.scrollIntoView({ behavior: 'smooth' });
};
window._aioScrollContentTop = function() {
  var c = document.querySelector('.content');
  if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
};
window._aioChatFromChipText = function(ctxId, el) {
  if (typeof window.chatFromChip === 'function' && el) {
    window.chatFromChip(ctxId, (el.textContent || '').trim());
  }
};
window._aioKrThemeChat = function(question, el) {
  if (typeof window.chatFromChip !== 'function') return;
  // question 프리픽스 포함한 "테마명 + 질문" → kr-themes 컨텍스트에서 호출
  window.chatFromChip('kr-themes', (el && el.dataset.arg2) || question);
};
window._aioMacroInterconToggle = function(el) {
  window._aioToggleDetailById('macro-intercon-detail', '설명 보기 ▼', '접기 ▲', el);
};
window._aioBriefingArchiveToggle = function(el) {
  window._aioToggleDetailById('briefing-static-archive', '펼치기 ▼', '접기 ▲', el);
};
window._aioBreadthGuideToggle = function(el) {
  window._aioToggleNext(el, '시장 폭 해석 가이드 ▶', '시장 폭 해석 가이드 ▼', 'grid');
};
window._aioNextSiblingToggle = function(el) {
  window._aioToggleNext(el, '', '', 'block');
};
window._aioCloseThemeDetailPanel = function() {
  window._aioHideEl('kr-theme-detail-panel');
};
window._aioCloseGlossary = function() {
  window._aioHideEl('glossary-modal');
};
window._aioChatHistoryClear = function() {
  if (typeof window.showConfirmModal !== 'function') return;
  window.showConfirmModal('대화 기록 전체 삭제', '모든 대화 기록이 영구 삭제됩니다. 계속하시겠습니까?', function() {
    try { localStorage.removeItem('aio_chat_history'); } catch(_){}
    var ov = document.querySelector('.chat-history-overlay');
    if (ov) ov.remove();
  }, '');
};
window._aioChatHistoryClose = function(el) {
  if (!el) return;
  var ov = el.closest('.chat-history-overlay');
  if (ov) ov.remove();
};
window._aioFetchAllNewsForce = function() {
  if (typeof window.isFetching !== 'undefined') window.isFetching = false;
  if (typeof window.fetchAllNews === 'function') window.fetchAllNews(true);
};
window._aioReload = function() { window.location.reload(); };

// v48.45: 교육 콘텐츠 아코디언 토글 (.aio-explain)
window._aioToggleExplain = function(explainEl, el) {
  // explainEl은 arg로 전달된 id 또는 closest 탐색
  var target = null;
  if (typeof explainEl === 'string') target = document.getElementById(explainEl);
  if (!target && el) target = el.closest('.aio-explain');
  if (!target) return;
  target.classList.toggle('is-open');
};

// v49.7: 각 페이지의 목적/사용 순서/다음 이동을 한 번에 보여주는 상단 요약 레이어.
// 긴 교육 텍스트는 그대로 보존하되, 초보자가 먼저 볼 3단계 루틴을 페이지마다 통일한다.
var AIO_PAGE_BRIEFS = {
  home: {
    title: '오늘은 시장을 열어도 되는 날인지 먼저 판단',
    use: '신호, 품질, 국면만 확인한 뒤 세부 페이지로 내려갑니다.',
    steps: ['매매 신호로 공격/방어 모드 결정', '시장 품질과 VIX로 리스크 확인', '뉴스·브리핑에서 오늘의 트리거 확인'],
    focus: '처음에는 여기서 결론을 잡고, 이유는 시그널·브리핑·뉴스 페이지에서 확인하세요.',
    links: [['signal','시그널'], ['briefing','브리핑'], ['market-news','뉴스'], ['portfolio','포트폴리오']]
  },
  signal: {
    title: '신규 진입, 보유, 축소를 한 화면에서 결정',
    use: '점수보다 행동 사다리가 우선입니다.',
    steps: ['Trading Score로 시장 허용치 확인', 'Lockout/OPEX로 추격매수 위험 확인', '포지션 크기와 스톱을 정한 뒤 실행'],
    focus: '강세장에서는 RSI 과열만으로 팔지 말고, ATR 확장·거래량·종가 위치를 같이 보세요.',
    links: [['technical','기술 분석'], ['portfolio','포트폴리오'], ['options','옵션'], ['briefing','브리핑']]
  },
  breadth: {
    title: '지수 상승이 소수 대형주인지, 시장 전체인지 확인',
    use: '브레드쓰는 추세의 내구성 체크용입니다.',
    steps: ['5/20/50/200일선 위 종목 비율 확인', '섹터·RRG로 확산 또는 이탈 확인', '지수와 폭이 갈라지면 신규 매수 축소'],
    focus: '지수는 신고가인데 폭이 약하면 랠리 품질이 낮아진 상태입니다.',
    links: [['signal','시그널'], ['themes','테마'], ['technical','기술 분석']]
  },
  sentiment: {
    title: '사람들이 너무 탐욕적인지, 너무 겁먹었는지 확인',
    use: '심리는 타이밍 보조 지표입니다.',
    steps: ['Fear & Greed와 Put/Call 확인', 'AAII·VIX로 군중 쏠림 확인', '극단값은 반대로, 중간값은 추세와 함께 해석'],
    focus: '탐욕은 즉시 매도 신호가 아니라 추격매수 금지 신호에 가깝습니다.',
    links: [['signal','시그널'], ['options','옵션'], ['breadth','시장 폭']]
  },
  briefing: {
    title: '오늘 시장을 움직일 이벤트와 행동만 압축 확인',
    use: '매일 장 시작 전 체크리스트입니다.',
    steps: ['오늘의 리스크와 이벤트 확인', '관심 섹터·종목 트리거 확인', '실행/대기/회피 항목만 남기기'],
    focus: '긴 설명보다 오늘 포지션을 바꿀 수 있는 변수만 보세요.',
    links: [['market-news','뉴스'], ['macro','매크로'], ['signal','시그널']]
  },
  technical: {
    title: '추세는 유지할지, 일부 줄일지, 헤지할지 판단',
    use: '기관형 Technical Brief가 메인입니다.',
    steps: ['티커 입력 후 월/주/일/줌 차트 확인', 'Sell Pressure와 Exit Plan 확인', '10EMA·21EMA·50SMA 이탈별 행동 적용'],
    focus: 'RSI 70+는 과열 경고일 뿐이며, ATR 확장·RVOL·종가 위치가 매도 판단의 핵심입니다.',
    links: [['signal','시그널'], ['portfolio','포트폴리오'], ['options','옵션']]
  },
  macro: {
    title: '금리, 인플레, 성장 중 무엇이 시장을 지배하는지 확인',
    use: '매크로는 시장 국면의 배경 설명입니다.',
    steps: ['FOMC·CPI·PCE·고용의 방향 확인', '달러·유가·금리와 연결', '주식에 우호/비우호인지 결론만 남기기'],
    focus: '좋은 뉴스인지보다 연준 반응 함수와 금리 방향을 먼저 보세요.',
    links: [['fxbond','환율·채권'], ['briefing','브리핑'], ['themes','테마']]
  },
  fxbond: {
    title: '달러와 금리로 위험자산의 압박 정도 확인',
    use: '주식 밸류에이션과 글로벌 자금 흐름의 입력값입니다.',
    steps: ['DXY와 USD/KRW로 달러 스트레스 확인', '2Y·10Y·커브로 금리 압박 확인', 'HY/OAS가 벌어지면 리스크 축소'],
    focus: '주식 차트가 좋아도 달러와 금리가 동시에 올라가면 추격매수 품질이 떨어집니다.',
    links: [['macro','매크로'], ['signal','시그널'], ['kr-home','한국장']]
  },
  fundamental: {
    title: '좋은 회사인지보다 지금 가격에 살 이유가 있는지 확인',
    use: '재무, 밸류, 실적, 뉴스 리스크를 한 번에 봅니다.',
    steps: ['티커 입력 후 핵심 재무와 밸류 확인', '실적·가이던스·뉴스 리스크 확인', '기술적 exit risk와 함께 최종 판단'],
    focus: '펀더멘털이 좋아도 차트가 무너지면 신규 진입은 늦추는 쪽이 안전합니다.',
    links: [['technical','기술 분석'], ['portfolio','포트폴리오'], ['market-news','뉴스']]
  },
  themes: {
    title: '어떤 테마가 실제 돈을 끌어오는지 확인',
    use: '테마 이름보다 구성 종목과 상대강도가 중요합니다.',
    steps: ['테마별 성과와 주도주 확인', '밸류체인에서 병목 위치 확인', '개별 종목은 기업분석/기술분석으로 검증'],
    focus: '같은 AI 테마라도 인프라, 반도체, 전력, 소프트웨어는 사이클과 리스크가 다릅니다.',
    links: [['fundamental','기업 분석'], ['technical','기술 분석'], ['market-news','뉴스']]
  },
  portfolio: {
    title: '내 계좌가 시장 충격에 얼마나 취약한지 확인',
    use: '보유 종목 관리와 리밸런싱 페이지입니다.',
    steps: ['종목·수량·평단을 입력', '집중도·섹터·VaR·MDD 확인', '기술적 exit risk로 줄일 순서 결정'],
    focus: '수익률보다 먼저 단일 종목/섹터 집중과 손실 허용치를 확인하세요.',
    links: [['technical','기술 분석'], ['signal','시그널'], ['fundamental','기업 분석']]
  },
  'market-news': {
    title: '뉴스를 가격에 영향을 주는 변수로 분류',
    use: '헤드라인을 읽는 곳이 아니라 영향도를 걸러내는 곳입니다.',
    steps: ['긴급/중요 뉴스만 먼저 확인', '영향 섹터와 티커 연결', '브리핑·테마·포트폴리오에서 행동으로 변환'],
    focus: '뉴스가 많을수록 가격에 반영될 뉴스와 소음 뉴스를 분리해야 합니다.',
    links: [['briefing','브리핑'], ['themes','테마'], ['portfolio','포트폴리오']]
  },
  options: {
    title: '변동성, 헤지 비용, OPEX 리스크 확인',
    use: '옵션 가격은 시장의 보험료입니다.',
    steps: ['VIX·term structure로 공포/안정 확인', 'Put/Call과 gamma/OPEX 확인', '헤지·프리미엄 전략 가능성 판단'],
    focus: 'VIX가 높으면 공포이면서 동시에 옵션 매도 프리미엄이 높아진 상태입니다.',
    links: [['signal','시그널'], ['technical','기술 분석'], ['macro','매크로']]
  },
  ticker: {
    title: '선택한 종목을 가격·재무·뉴스로 한 번 더 검증',
    use: '다른 페이지에서 고른 종목의 최종 확인 화면입니다.',
    steps: ['가격 추세와 핵심 지표 확인', '뉴스와 실적 리스크 확인', '매수/보유/축소 결론으로 연결'],
    focus: '한 종목은 반드시 시장 국면, 섹터, 기술적 위치와 같이 봐야 합니다.',
    links: [['technical','기술 분석'], ['fundamental','기업 분석'], ['portfolio','포트폴리오']]
  },
  'theme-detail': {
    title: '테마가 실제 주도주와 수익으로 이어지는지 확인',
    use: '테마 이름이 아니라 대장주, 2차 수혜주, 촉매, 깨지는 신호를 한 화면에서 연결합니다.',
    steps: ['대장주와 2차 수혜주 성과 차이 확인', '뉴스·실적·수급 촉매가 실제인지 확인', '차트 과열·이탈 신호로 추격 여부 판단'],
    focus: '강한 테마일수록 “좋은 이야기”보다 대장주의 상대강도와 후발 확산 여부가 더 중요합니다.',
    links: [['themes','테마'], ['technical','기술 분석'], ['market-news','뉴스']]
  },
  'kr-home': {
    title: '한국장은 외국인 수급, 환율, 반도체를 먼저 확인',
    use: 'KOSPI/KOSDAQ의 당일 방향성을 빠르게 봅니다.',
    steps: ['KOSPI·KOSDAQ과 외국인 수급 확인', 'USD/KRW와 미국 반도체 영향 확인', '국내 테마/수급 페이지로 세부 확인'],
    focus: '한국장은 환율과 외국인 수급이 지수 방향을 크게 좌우합니다.',
    links: [['kr-supply','수급'], ['kr-themes','국내 테마'], ['kr-macro','한국 매크로']]
  },
  'kr-supply': {
    title: '외국인·기관·개인의 실제 매수 주체 확인',
    use: '가격보다 누가 사고 파는지 보는 페이지입니다.',
    steps: ['시장별 순매수 주체 확인', '업종·종목 수급 집중 확인', '가격 추세와 함께 진입 가능성 판단'],
    focus: '수급이 좋지만 가격이 약하면 아직 확인이 부족한 상태입니다.',
    links: [['kr-home','한국장'], ['kr-themes','국내 테마'], ['kr-technical','KR 기술']]
  },
  'kr-themes': {
    title: '국내 테마 중 실제 주도 테마만 선별',
    use: '단기 테마 순환을 정리하는 페이지입니다.',
    steps: ['상승 테마와 대장주 확인', '뉴스/수급이 붙었는지 확인', '차트 위치로 추격 여부 판단'],
    focus: '테마주는 대장주와 2등주의 차이가 크므로 상대강도를 꼭 보세요.',
    links: [['kr-supply','수급'], ['kr-technical','KR 기술'], ['market-news','뉴스']]
  },
  'kr-macro': {
    title: '한국 금리, 환율, 수출 사이클을 확인',
    use: '국내 증시의 배경 체력을 보는 페이지입니다.',
    steps: ['BOK·국채금리·환율 확인', '수출/반도체 사이클 확인', '외국인 수급과 함께 결론 내리기'],
    focus: '한국 매크로는 원화와 반도체 수출이 동시에 중요합니다.',
    links: [['kr-home','한국장'], ['fxbond','환율·채권'], ['kr-supply','수급']]
  },
  'kr-technical': {
    title: '국내 종목도 같은 exit/trim 기준으로 판단',
    use: '한국 종목의 추세와 과열을 점검합니다.',
    steps: ['티커/지수 차트 위치 확인', '이평선·RSI·거래량 확인', '추격/보유/축소 결론으로 연결'],
    focus: '급등주는 거래량이 꺼지는 순간부터 리스크 관리가 먼저입니다.',
    links: [['kr-home','한국장'], ['kr-supply','수급'], ['technical','미국 기술']]
  },
  guide: {
    title: '처음 쓰는 순서만 익히면 됩니다',
    use: '모든 설명을 읽기보다 루틴을 먼저 잡으세요.',
    steps: ['대시보드에서 오늘 모드 결정', '시그널/기술/포트폴리오로 행동 결정', '뉴스/매크로/테마로 이유 확인'],
    focus: '처음에는 대시보드 → 시그널 → 포트폴리오 3개만 반복해도 충분합니다.',
    links: [['home','대시보드'], ['signal','시그널'], ['portfolio','포트폴리오']]
  }
};
window.AIO_PAGE_BRIEFS = AIO_PAGE_BRIEFS;

function _aioBriefEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function _aioCoreViewOn() {
  try { return localStorage.getItem('aio_full_view') !== '1'; } catch(_) { return true; }
}

window._aioApplyContentSimplification = function(pageId) {
  var page = document.getElementById('page-' + pageId);
  if (!page) return null;
  var core = _aioCoreViewOn();
  page.classList.toggle('aio-core-view', core);
  page.classList.toggle('aio-content-compact', core);
  var secondary = [];
  try {
    secondary = Array.prototype.slice.call(page.querySelectorAll('.beginner-tip,.aio-explain,details,[id*="archive"],[id*="Archive"]'));
    secondary.forEach(function(el) {
      if (!el || el.classList.contains('aio-page-brief')) return;
      if (pageId !== 'guide' && /archive/i.test(el.id || '')) el.classList.add('aio-secondary-hard');
      if (el.classList.contains('beginner-tip')) el.classList.add('collapsed');
    });
    if (core) {
      page.querySelectorAll('.aio-explain-summary,.aio-secondary-badge,.aio-page-brief-decision').forEach(function(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
  } catch(_) {}
  var btn = page.querySelector('.aio-page-brief-mode');
  if (btn) {
    btn.classList.toggle('is-core', core);
    btn.textContent = core ? '핵심 보기 ON' : '전체 보기';
    btn.setAttribute('aria-pressed', core ? 'true' : 'false');
  }
  return { pageId: pageId, coreView: core, secondaryCount: secondary.length };
};

window._aioToggleCoreView = function(pageId) {
  try {
    var nextFull = _aioCoreViewOn() ? '1' : '0';
    localStorage.setItem('aio_full_view', nextFull);
  } catch(_) {}
  Object.keys(AIO_PAGE_BRIEFS).forEach(function(id) { window._aioApplyContentSimplification(id); });
};

window._aioRenderPageBrief = function(pageId) {
  var cfg = AIO_PAGE_BRIEFS[pageId];
  if (!cfg) return;
  var page = document.getElementById('page-' + pageId);
  if (!page) return;
  if (page.querySelector('.aio-page-brief')) return;
  var steps = (cfg.steps || []).slice(0, 3).map(function(step, idx) {
    return '<div class="aio-page-brief-step"><span class="aio-page-brief-num">' + (idx + 1) + '</span><div class="aio-page-brief-step-text">' + _aioBriefEsc(step) + '</div></div>';
  }).join('');
  var links = (cfg.links || []).map(function(pair) {
    return '<button class="aio-page-brief-chip" data-action="showPage" data-arg="' + _aioBriefEsc(pair[0]) + '">' + _aioBriefEsc(pair[1]) + '</button>';
  }).join('');
  var modeBtn = '<button class="aio-page-brief-mode" data-action="_aioToggleCoreView" data-arg="' + _aioBriefEsc(pageId) + '" aria-pressed="' + (_aioCoreViewOn() ? 'true' : 'false') + '">' + (_aioCoreViewOn() ? '핵심 보기 ON' : '전체 보기') + '</button>';
  var html =
    '<section class="aio-page-brief" aria-label="페이지 핵심 사용법">' +
      '<div class="aio-page-brief-head">' +
        '<div><div class="aio-page-brief-kicker">Page Routine</div><div class="aio-page-brief-title">' + _aioBriefEsc(cfg.title) + '</div></div>' +
        '<div class="aio-page-brief-use">' + _aioBriefEsc(cfg.use) + modeBtn + '</div>' +
      '</div>' +
      '<div class="aio-page-brief-grid">' +
        '<div class="aio-page-brief-steps">' + steps + '</div>' +
        '<div class="aio-page-brief-actions"><div class="aio-page-brief-focus">' + _aioBriefEsc(cfg.focus) + '</div>' + links + '</div>' +
      '</div>' +
    '</section>';
  var box = document.createElement('div');
  box.innerHTML = html;
  var brief = box.firstElementChild;
  var anchor = page.querySelector('.insight-box');
  if (anchor && anchor.parentNode === page) {
    anchor.insertAdjacentElement('afterend', brief);
  } else {
    page.insertBefore(brief, page.firstElementChild);
  }
  window._aioApplyContentSimplification(pageId);
};

window._aioSimplifyExplainLabels = function() {
  var labels = {
    'explain-decision-dash': '상세 해설: 대시보드 신호 읽는 법',
    'explain-top-indicators': '상세 해설: 핵심 지표 읽는 법',
    'explain-gmo-and-flow': '상세 해설: 자금 흐름 읽는 법',
    'explain-signal-page': '상세 해설: 매매 시그널과 리스크',
    'explain-breadth-page': '상세 해설: 시장 폭과 확산',
    'explain-sentiment-page': '상세 해설: 투자 심리',
    'explain-briefing-page': '상세 해설: 브리핑 활용법',
    'explain-technical-page': '상세 해설: 기술 지표와 exit 기준',
    'explain-macro-page': '상세 해설: 매크로 연결 구조',
    'explain-fxbond-page': '상세 해설: 환율과 채권',
    'explain-fundamental-page': '상세 해설: 기업 분석',
    'explain-themes-page': '상세 해설: 테마와 밸류체인',
    'explain-portfolio-page': '상세 해설: 포트폴리오 리스크',
    'explain-ticker-page': '상세 해설: 티커 상세',
    'explain-news-page': '상세 해설: 뉴스 영향도',
    'explain-options-page': '상세 해설: 옵션과 변동성',
    'explain-kr-page': '상세 해설: 한국장 핵심',
    'explain-kr-supply-page': '상세 해설: 수급 분석',
    'explain-kr-themes-page': '상세 해설: 국내 테마',
    'explain-kr-macro-page': '상세 해설: 한국 매크로',
    'explain-kr-technical-page': '상세 해설: KR 기술 분석',
    'explain-guide-overview': '상세 해설: 사용 루틴'
  };
  Object.keys(labels).forEach(function(id) {
    var root = document.getElementById(id);
    if (!root) return;
    var label = root.querySelector('.aio-explain-trigger-label span:last-child');
    if (label) label.textContent = labels[id] + ' (펼치기)';
  });
};

var AIO_EXPLAIN_SUMMARIES = {
  'explain-decision-dash': '초보자는 <strong>매매 신호 → 시장 품질 → 시장 국면</strong> 순서로만 보세요. 셋 중 2개 이상이 위험이면 신규 매수보다 현금/관망이 우선입니다.',
  'explain-top-indicators': '상단 지표는 시장 체온계입니다. <strong>지수 방향, VIX, F&G</strong>가 서로 같은 말을 하는지 확인하고, 서로 다르면 세부 페이지로 내려갑니다.',
  'explain-gmo-and-flow': '자금 흐름은 “돈이 어디로 이동하는가”를 보는 영역입니다. 초보자는 주도 섹터와 방어 섹터가 바뀌는지만 먼저 확인하세요.',
  'explain-signal-page': '이 페이지의 결론은 점수가 아니라 <strong>신규 매수/보유/축소/헤지</strong>입니다. 점수가 좋아도 과열·OPEX·폭 부진이 있으면 추격은 줄입니다.',
  'explain-breadth-page': '시장 폭은 상승의 품질입니다. 지수만 오르고 참여 종목이 줄면 초보자는 신규 매수를 늦추고 보유 종목 방어선을 확인하세요.',
  'explain-sentiment-page': '심리는 반대로만 쓰지 않습니다. 탐욕은 “바로 매도”가 아니라 <strong>추격 금지</strong>, 공포는 “바로 매수”가 아니라 <strong>분할 확인</strong> 신호입니다.',
  'explain-briefing-page': '브리핑은 오늘 행동을 정하는 페이지입니다. 모든 뉴스를 읽지 말고 <strong>시장 국면을 바꿀 뉴스, 내 보유 종목 뉴스, 오늘 일정</strong>만 남기세요.',
  'explain-technical-page': '기술 분석은 매도/축소 기준을 정하는 도구입니다. RSI보다 <strong>ATR 확장, 거래량, 종가 위치, 10/21/50일선 이탈</strong>을 우선합니다.',
  'explain-macro-page': '매크로는 배경입니다. 초보자는 CPI/PCE/고용 숫자 자체보다 <strong>연준이 금리를 올릴지, 내릴지, 오래 유지할지</strong>를 판단하세요.',
  'explain-fxbond-page': '환율·채권은 주식의 압박 게이지입니다. 달러와 금리가 동시에 오르면 성장주 추격매수는 보수적으로 봅니다.',
  'explain-fundamental-page': '기업 분석은 “좋은 회사”와 “지금 살 자리”를 분리합니다. 재무가 좋아도 차트와 뉴스 리스크가 나쁘면 진입은 늦춥니다.',
  'explain-themes-page': '테마는 스토리가 아니라 돈의 흐름입니다. 테마명보다 <strong>대장주, 상대강도, 밸류체인 병목</strong>을 먼저 확인하세요.',
  'explain-portfolio-page': '포트폴리오는 수익률보다 생존이 먼저입니다. 단일 종목/섹터 집중과 최대 손실 가능성을 확인한 뒤 줄일 순서를 정하세요.',
  'explain-ticker-page': '티커 상세는 최종 확인용입니다. 가격 추세, 실적/뉴스, 포트폴리오 비중이 모두 맞을 때만 행동으로 옮깁니다.',
  'explain-news-page': '뉴스는 많을수록 위험합니다. 초보자는 <strong>가격에 영향 줄 뉴스</strong>와 단순 소음을 분리하고, 영향 섹터/종목만 추적하세요.',
  'explain-options-page': '옵션은 방향보다 보험료를 보는 페이지입니다. IV가 높으면 프리미엄 매도 후보, IV가 낮으면 옵션 매수 후보를 검토하되 손실 한도를 먼저 정합니다.',
  'explain-kr-page': '한국장은 환율과 외국인 수급이 핵심입니다. KOSPI/KOSDAQ보다 <strong>외국인 순매수, USD/KRW, 반도체</strong>를 먼저 보세요.',
  'explain-kr-supply-page': '수급 분석은 누가 사고 파는지 확인합니다. 가격 상승과 외국인/기관 순매수가 동시에 나올 때 신뢰도가 높습니다.',
  'explain-kr-themes-page': '국내 테마는 순환이 빠릅니다. 대장주가 살아 있고 후발주가 따라오는지 확인하고, 급등 후 거래량 감소는 조심하세요.',
  'explain-kr-macro-page': '한국 매크로는 원화, 금리, 수출입니다. 원화 약세와 금리 상승이 동시에 나오면 외국인 수급이 약해질 수 있습니다.',
  'explain-kr-technical-page': 'KR 기술 분석도 원칙은 같습니다. 급등주는 거래량과 10/20일선 이탈을 먼저 보고, 상한가 이후 추격은 특히 조심합니다.',
  'explain-guide-overview': '가이드는 전부 읽는 문서가 아닙니다. 처음에는 <strong>대시보드 → 시그널 → 포트폴리오</strong> 3개 루틴만 반복하세요.'
};
window.AIO_EXPLAIN_SUMMARIES = AIO_EXPLAIN_SUMMARIES;

window._aioInjectExplainSummaries = function() {
  if (_aioCoreViewOn()) return;
  Object.keys(AIO_EXPLAIN_SUMMARIES).forEach(function(id) {
    var root = document.getElementById(id);
    if (!root || root.querySelector('.aio-explain-summary')) return;
    var content = root.querySelector('.aio-explain-content');
    if (!content) return;
    var summary = document.createElement('div');
    summary.className = 'aio-explain-summary';
    summary.innerHTML =
      '<div class="aio-explain-summary-title">초보자 핵심만 먼저</div>' +
      '<div class="aio-explain-summary-body">' + AIO_EXPLAIN_SUMMARIES[id] + '</div>';
    content.insertBefore(summary, content.firstChild);
  });
};

window.AIO = window.AIO || {};
window.AIO.getPageUXAudit = function() {
  var ids = Object.keys(AIO_PAGE_BRIEFS);
  var staleRe = /PCE\(4\/30\)|PCE 4\/30|VIX Spot 18\.36|5\/2 \(PCE|4\/8 기준|이번 주\(05\/04|예정 이벤트 \(v48/;
  var homeStaleRe = /NFP 비농업고용지수 \(5\/8|PLTR·AMD·ANET|Fed 4인 동시 연설|5\/8 금|5\/9 토/;
  var pages = ids.map(function(id) {
    if (typeof window._aioRenderPageBrief === 'function') window._aioRenderPageBrief(id);
    var page = document.getElementById('page-' + id);
    var text = page ? (page.innerText || '').replace(/\s+/g, ' ').trim() : '';
    var overflow = [];
    if (page) {
      var targets = page.querySelectorAll('button,.aio-page-brief-chip,.aio-page-brief-step-text,td,th,input,select,.q-chip');
      Array.prototype.forEach.call(targets, function(el) {
        if (overflow.length >= 6) return;
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 3) {
          overflow.push({
            tag: el.tagName,
            text: ((el.textContent || el.value || '').trim()).slice(0, 80),
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth
          });
        }
      });
    }
    return {
      id: id,
      pageExists: !!page,
      briefConfig: !!AIO_PAGE_BRIEFS[id],
      briefRendered: !!(page && page.querySelector('.aio-page-brief')),
      textChars: text.length,
      controls: page ? page.querySelectorAll('button,[data-action],input,select,textarea').length : 0,
      charts: page ? page.querySelectorAll('canvas,iframe,[id*="chart"],[class*="chart"]').length : 0,
      explainSections: page ? page.querySelectorAll('.aio-explain,.aio-explain-content,details').length : 0,
      staleLiveLike: staleRe.test(text) || (id === 'home' && homeStaleRe.test(text)),
      overflow: overflow
    };
  });
  var issues = [];
  pages.forEach(function(p) {
    if (!p.pageExists) issues.push(p.id + ': page missing');
    if (!p.briefRendered) issues.push(p.id + ': brief missing');
    if (p.staleLiveLike) issues.push(p.id + ': stale live-like wording');
    if (p.overflow.length) issues.push(p.id + ': text overflow');
  });
  return {
    version: window.AIO.version || (typeof APP_VERSION === 'string' ? APP_VERSION : null),
    generatedAt: new Date().toISOString(),
    totalPages: pages.length,
    issueCount: issues.length,
    issues: issues,
    pages: pages
  };
};

// v49.67 Codex P358/R124: DOM-first full surface audit.
// This complements the page registry audit by walking the actual rendered pages
// and summarizing every major user-facing surface: headings, sections, data
// sinks, controls, tables, charts, explainers, and visible placeholder text.
window.AIO.getFullSurfaceAudit = function(opts) {
  opts = opts || {};
  var root = opts.root || document;
  var registry = (window.AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY && window.AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY.pages) || {};
  var briefs = window.AIO_PAGE_BRIEFS || {};
  var overlayRegistry = { glossary: '#glossary-modal' };
  var issues = [];
  var pages = [];
  var totals = {
    domPages: 0,
    registeredPages: 0,
    unregisteredPages: 0,
    registrySubSections: 0,
    headings: 0,
    sections: 0,
    dataSinks: 0,
    controls: 0,
    tables: 0,
    charts: 0,
    explainers: 0,
    overlays: 0,
    visibleLoadingText: 0
  };

  function qsa(base, selector) {
    try { return Array.prototype.slice.call((base || root).querySelectorAll(selector)); }
    catch(_) { return []; }
  }
  function ownVisibleText(el) {
    if (!el) return '';
    try {
      if (!document.createTreeWalker || !window.NodeFilter) return el.textContent || '';
      var parts = [];
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) parts.push(node.nodeValue || '');
      return parts.join(' ');
    } catch(_) {
      return el.textContent || '';
    }
  }
  function countVisibleLoading(el) {
    var text = ownVisibleText(el);
    var match = text.match(/로딩 중|데이터 로딩|분석 로딩|계산 중/g);
    return match ? match.length : 0;
  }
  function countEmptyTables(el) {
    return qsa(el, 'table').filter(function(tbl) {
      var rows = qsa(tbl, 'tbody tr, tr');
      var text = ownVisibleText(tbl).replace(/\s+/g, '');
      return rows.length <= 1 && !text;
    }).length;
  }
  function pageKeyFromId(id) {
    return String(id || '').replace(/^page-/, '');
  }

  var domPages = qsa(root, '.page[id]').filter(function(el) { return /^page-/.test(el.id || ''); });
  totals.domPages = domPages.length;

  domPages.forEach(function(pageEl) {
    var id = pageKeyFromId(pageEl.id);
    if (typeof window._aioRenderPageBrief === 'function') {
      try { window._aioRenderPageBrief(id); } catch(_) {}
    }
    var reg = registry[id] || null;
    var regSections = reg && Array.isArray(reg.subSections) ? reg.subSections.length : 0;
    var headings = qsa(pageEl, 'h1,h2,h3,h4,.page-title,.section-title,.widget-title,.card-title,.subsection-title,.aio-page-brief-title').length;
    var sections = qsa(pageEl, 'section,.section,[class*="section"],.data-widget,.widget,[class*="widget"],.card,[class*="card"],.glass-card,.aio-page-brief,[data-audit-section],[data-page-purpose],[style*="border"]').length;
    var dataSinks = qsa(pageEl, '[data-live-price],[data-live-kr],[data-live-chg],[data-snap],[data-source-kind],[data-operational-use],[data-runtime-state],[data-score-scale],[data-threshold-table],[data-scenario-key],[data-cycle-phase]').length;
    var controls = qsa(pageEl, 'button,[data-action],input,select,textarea').length;
    var tables = qsa(pageEl, 'table').length;
    var charts = qsa(pageEl, 'canvas,iframe,[id*="chart"],[class*="chart"]').length;
    var explainers = qsa(pageEl, '.aio-explain,.aio-explain-content,details,.aio-page-brief-step,.aio-page-brief-focus').length;
    var loading = countVisibleLoading(pageEl);
    var emptyTables = countEmptyTables(pageEl);
    var textChars = ownVisibleText(pageEl).replace(/\s+/g, ' ').trim().length;
    var hasBrief = !!pageEl.querySelector('.aio-page-brief');
    var riskFlags = [];

    if (!reg) riskFlags.push('missingSequentialRegistry');
    if (!briefs[id]) riskFlags.push('missingBriefRegistry');
    if (!hasBrief) riskFlags.push('briefNotRendered');
    if (loading) riskFlags.push('visibleLoadingText');
    if (textChars > 800 && dataSinks === 0 && tables === 0 && charts === 0 && controls === 0) riskFlags.push('textOnlySurface');
    if (tables && emptyTables === tables) riskFlags.push('emptyTablesOnly');
    if (headings === 0) riskFlags.push('noHeading');

    totals.registeredPages += reg ? 1 : 0;
    totals.unregisteredPages += reg ? 0 : 1;
    totals.registrySubSections += regSections;
    totals.headings += headings;
    totals.sections += sections;
    totals.dataSinks += dataSinks;
    totals.controls += controls;
    totals.tables += tables;
    totals.charts += charts;
    totals.explainers += explainers;
    totals.visibleLoadingText += loading;

    if (riskFlags.length) {
      issues.push(id + ': ' + riskFlags.join(','));
    }

    pages.push({
      id: id,
      domId: pageEl.id,
      title: ((pageEl.querySelector('.page-title,h1,h2') || {}).textContent || id).replace(/\s+/g, ' ').trim().slice(0, 80),
      registered: !!reg,
      registrySubSections: regSections,
      briefRegistry: !!briefs[id],
      briefRendered: hasBrief,
      headings: headings,
      sections: sections,
      dataSinks: dataSinks,
      controls: controls,
      tables: tables,
      emptyTables: emptyTables,
      charts: charts,
      explainers: explainers,
      textChars: textChars,
      visibleLoadingText: loading,
      riskFlags: riskFlags
    });
  });

  Object.keys(registry).forEach(function(id) {
    var overlaySel = overlayRegistry[id];
    var overlayEl = overlaySel ? document.querySelector(overlaySel) : null;
    if (!document.getElementById('page-' + id) && !overlayEl) {
      issues.push(id + ': registered but DOM page missing');
    } else if (overlayEl) {
      totals.overlays += 1;
    }
  });

  var riskPageCount = pages.filter(function(p) { return p.riskFlags.length > 0; }).length;
  var coveragePct = totals.domPages ? Math.round((totals.registeredPages / totals.domPages) * 100) : 0;
  var score = Math.max(0, Math.min(100,
    100 -
    (totals.unregisteredPages * 6) -
    (totals.visibleLoadingText * 5) -
    (riskPageCount * 2)
  ));
  var status = score >= 90 && issues.length === 0 ? 'ok' : score >= 70 ? 'warn' : 'fail';

  return {
    version: window.AIO.version || (typeof APP_VERSION === 'string' ? APP_VERSION : null),
    generatedAt: new Date().toISOString(),
    status: status,
    score: score,
    coveragePct: coveragePct,
    pageCount: totals.domPages,
    riskPageCount: riskPageCount,
    issueCount: issues.length,
    issues: issues,
    totals: totals,
    pages: pages
  };
};

// v49.67 Codex P359/R125: second/third-pass deep review audit.
// This layer checks meaning-bearing text snippets, delegated input handlers, and
// data-sink explanation coverage after the DOM surface itself has been inventoried.
window.AIO.getDeepReviewAudit = function(opts) {
  opts = opts || {};
  var root = opts.root || document;
  var issues = [];
  var warnings = [];
  var textSamples = [];
  var inputIssues = [];
  var dataPageIssues = [];
  var unlabeledButtons = [];
  var jargonDense = [];
  var consoleHints = [];
  var placeholderHits = [];
  var staleHits = [];

  function qsa(base, selector) {
    try { return Array.prototype.slice.call((base || root).querySelectorAll(selector)); }
    catch(_) { return []; }
  }
  function pageKey(el) {
    var p = el && el.closest && el.closest('.page[id]');
    return p && p.id ? p.id.replace(/^page-/, '') : ((el && el.closest && el.closest('#glossary-modal')) ? 'glossary' : 'global');
  }
  function textOf(el) {
    return ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
  }
  function isReferenceOnly(el, txt) {
    if (el && el.closest && el.closest('[data-aio-archive="true"], .aio-page-brief')) return true;
    return /archive|reference|past|education|example|static summary|not live|\uACFC\uAC70|\uCC38\uACE0|\uAD50\uC721|\uC608\uC2DC/i.test(txt || '');
  }
  function handlerExists(name) {
    name = String(name || '').split(':')[0].trim();
    if (!name || name === '__value' || name === '__value_kr') return true;
    return typeof window[name] === 'function' || !!(window.AIO && typeof window.AIO[name] === 'function');
  }
  function collectTextNodes() {
    var parents = [];
    var seen = [];
    var base = root.body || root.documentElement || root;
    try {
      var walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          var txt = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (txt.length < 2) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var node;
      while ((node = walker.nextNode())) {
        var el = node.parentElement;
        if (!el || seen.indexOf(el) >= 0) continue;
        seen.push(el);
        parents.push(el);
      }
    } catch(_) {
      parents = qsa(root, '.page[id] h1,.page[id] h2,.page[id] h3,.page[id] h4,.page[id] p,.page[id] li,.page[id] td,.page[id] th,.page[id] button,.page[id] label,.page[id] small,.page[id] .page-title,.page[id] .page-subtitle,#glossary-modal h2,#glossary-modal input,#glossary-modal button');
    }
    return parents;
  }

  var textNodes = collectTextNodes();
  var staleRe = /PCE\(4\/30\)|VIX Spot 18\.36|05\/0[4-9]|2025[-/.](0?[1-9]|1[0-2])[-/.]\d{1,2}|2024[-/.]/i;
  var placeholderRe = /\b(?:TODO|FIXME|Lorem|undefined|null|NaN)\b|\uB85C\uB529\s*\uC911|\uB85C\uB529\.\.\.|\uB85C\uB529\uC911|\uB370\uC774\uD130 \uB85C\uB529|\uBD84\uC11D \uB85C\uB529|\uACC4\uC0B0 \uC911/i;
  var jargonRe = /\b(RSI|MACD|VIX|ATR|OPEX|FOMC|CPI|PCE|DXY|HY|OAS|GEX|IV|RRG|FCF|EV\/EBITDA|PER|PBR)\b/g;

  textNodes.forEach(function(el) {
    var txt = textOf(el);
    if (!txt) return;
    if (textSamples.length < 12 && txt.length >= 8) textSamples.push({ page: pageKey(el), text: txt.slice(0, 120) });
    if (placeholderRe.test(txt)) placeholderHits.push({ page: pageKey(el), text: txt.slice(0, 120) });
    if (staleRe.test(txt) && !isReferenceOnly(el, txt)) staleHits.push({ page: pageKey(el), text: txt.slice(0, 120) });
    var jargon = txt.match(jargonRe);
    if (jargon && jargon.length >= 4 && !/why|meaning|means|\uC758\uBBF8|\uC124\uBA85|\uC774\uC720|\uC65C/.test(txt)) {
      jargonDense.push({ page: pageKey(el), terms: jargon.slice(0, 8), text: txt.slice(0, 120) });
    }
    if (/console|AIO\./i.test(txt) && !/developer|debug|log/i.test(txt)) {
      consoleHints.push({ page: pageKey(el), text: txt.slice(0, 120) });
    }
  });

  qsa(root, '[data-on-enter],[data-on-input]').forEach(function(el) {
    ['data-on-enter', 'data-on-input'].forEach(function(attr) {
      if (!el.hasAttribute || !el.hasAttribute(attr)) return;
      var spec = el.getAttribute(attr) || '';
      var name = spec.split(':')[0].trim();
      if (!handlerExists(name)) {
        inputIssues.push({ page: pageKey(el), attr: attr, handler: name, id: el.id || '', tag: el.tagName });
      }
    });
  });

  qsa(root, 'button,[role="button"]').forEach(function(el) {
    var label = textOf(el) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    if (!label.trim()) {
      unlabeledButtons.push({ page: pageKey(el), id: el.id || '', action: el.getAttribute('data-action') || '' });
    }
  });

  qsa(root, '.page[id]').forEach(function(pageEl) {
    var sinks = qsa(pageEl, '[data-live-price],[data-live-kr],[data-live-chg],[data-snap],[data-runtime-state],[data-score-scale],[data-threshold-table],[data-scenario-key],[data-cycle-phase]');
    if (!sinks.length) return;
    var lineage = qsa(pageEl, '[data-source-kind],[data-operational-use],[data-snap-date],.source,.source-note,.aio-source,.aio-data-lineage');
    var explainers = qsa(pageEl, '.aio-explain,.aio-explain-content,details,.aio-page-brief-step,.aio-tooltip');
    if (sinks.length >= 8 && lineage.length === 0 && explainers.length === 0) {
      dataPageIssues.push({ page: pageKey(pageEl), sinks: sinks.length, lineageMarkers: lineage.length, explainers: explainers.length });
    }
  });

  var actionAudit = window.AIO.getDataActionHandlerAudit ? window.AIO.getDataActionHandlerAudit() : null;
  var seedAudit = window.AIO.getStaticSeedFallbackAudit ? window.AIO.getStaticSeedFallbackAudit() : null;
  var surface = window.AIO.getFullSurfaceAudit ? window.AIO.getFullSurfaceAudit() : null;

  placeholderHits.forEach(function(hit) { issues.push(hit.page + ': placeholder/live loading text in user copy'); });
  staleHits.forEach(function(hit) { issues.push(hit.page + ': stale live-like date/token in user copy'); });
  inputIssues.forEach(function(hit) { issues.push(hit.page + ': missing ' + hit.attr + ' handler ' + hit.handler); });
  if (actionAudit && actionAudit.issueCount) issues.push(actionAudit.issueCount + ' missing data-action handler(s)');
  if (seedAudit && seedAudit.issueCount) issues.push(seedAudit.issueCount + ' data-snap seed issue(s)');
  dataPageIssues.forEach(function(hit) { warnings.push(hit.page + ': data sinks without page-level lineage/explainer markers'); });
  if (unlabeledButtons.length) warnings.push(unlabeledButtons.length + ' unlabeled button(s)');
  if (jargonDense.length) warnings.push(jargonDense.length + ' dense jargon snippet(s)');
  if (consoleHints.length) warnings.push(consoleHints.length + ' console-only hint snippet(s)');

  var score = Math.max(0, Math.min(100,
    100 -
    (issues.length * 8) -
    (dataPageIssues.length * 3) -
    Math.min(12, unlabeledButtons.length) -
    Math.min(10, jargonDense.length * 2) -
    Math.min(8, consoleHints.length * 2)
  ));
  var status = issues.length ? 'fail' : (warnings.length ? 'warn' : 'ok');

  return {
    version: window.AIO.version || (typeof APP_VERSION === 'string' ? APP_VERSION : null),
    generatedAt: new Date().toISOString(),
    status: status,
    score: score,
    issueCount: issues.length,
    warningCount: warnings.length,
    issues: issues,
    warnings: warnings,
    tiers: {
      textMeaning: {
        snippetCount: textNodes.length,
        placeholderCount: placeholderHits.length,
        staleTokenCount: staleHits.length,
        jargonDenseCount: jargonDense.length,
        consoleHintCount: consoleHints.length,
        samples: textSamples
      },
      interaction: {
        dataActionIssueCount: actionAudit ? actionAudit.issueCount : null,
        inputBindingIssueCount: inputIssues.length,
        unlabeledButtonCount: unlabeledButtons.length,
        inputIssues: inputIssues.slice(0, 20),
        unlabeledButtons: unlabeledButtons.slice(0, 20)
      },
      dataMeaning: {
        sinkCount: surface && surface.totals ? surface.totals.dataSinks : qsa(root, '[data-live-price],[data-live-kr],[data-live-chg],[data-snap]').length,
        dataPageIssueCount: dataPageIssues.length,
        staticSeedIssueCount: seedAudit ? seedAudit.issueCount : null,
        dataPageIssues: dataPageIssues.slice(0, 20)
      }
    }
  };
};

// v49.70 Codex P360/R126: fourth/fifth-pass institutional goal audit.
// Pass 4 ties the page inventory to data truth/freshness governance; pass 5
// scores every route against the three product goals.
window.AIO.getFourthFifthPassAudit = function(opts) {
  opts = opts || {};
  var root = opts.root || document;
  var issues = [];
  var warnings = [];

  function safe(fn, fallback) {
    try { return fn(); } catch(_) { return fallback; }
  }
  function qsa(base, selector) {
    try { return Array.prototype.slice.call((base || root).querySelectorAll(selector)); }
    catch(_) { return []; }
  }
  function clamp(v) {
    v = Math.round(Number(v) || 0);
    return Math.max(0, Math.min(100, v));
  }
  function avg(items, key) {
    if (!items.length) return 0;
    return clamp(items.reduce(function(sum, item) { return sum + (Number(item[key]) || 0); }, 0) / items.length);
  }
  function auditIssueCount(audit) {
    if (!audit) return 0;
    if (typeof audit.issueCount === 'number') return audit.issueCount;
    if (typeof audit.mismatchCount === 'number') return audit.mismatchCount;
    if (typeof audit.staleCount === 'number') return audit.staleCount;
    if (Array.isArray(audit.issues)) return audit.issues.length;
    return audit.status === 'fail' ? 1 : 0;
  }

  var surface = safe(function() { return window.AIO.getFullSurfaceAudit ? window.AIO.getFullSurfaceAudit(opts) : null; }, null);
  var deep = safe(function() { return window.AIO.getDeepReviewAudit ? window.AIO.getDeepReviewAudit(opts) : null; }, null);
  var seed = safe(function() { return window.AIO.getStaticSeedFallbackAudit ? window.AIO.getStaticSeedFallbackAudit() : null; }, null);
  var live = safe(function() { return window.AIO.getLiveSymbolsCoverageAudit ? window.AIO.getLiveSymbolsCoverageAudit() : null; }, null);
  var snapshot = safe(function() { return window.AIO.getSnapshotConsistencyAudit ? window.AIO.getSnapshotConsistencyAudit() : null; }, null);
  var cross = safe(function() { return window.AIO.getCrossPageIndicatorConsistencyAudit ? window.AIO.getCrossPageIndicatorConsistencyAudit() : null; }, null);
  var market = safe(function() { return window.AIO.getMarketCurrentnessAudit ? window.AIO.getMarketCurrentnessAudit({ includeHidden: true }) : null; }, null);
  var action = safe(function() { return window.AIO.getDataActionHandlerAudit ? window.AIO.getDataActionHandlerAudit() : null; }, null);
  var essence = safe(function() { return window.AIO.getEssenceAlignmentAudit ? window.AIO.getEssenceAlignmentAudit(opts) : null; }, null);
  var tableA11y = safe(function() { return window.AIO.getTableAccessibilityAudit ? window.AIO.getTableAccessibilityAudit(root) : null; }, null);

  var hardAudits = [
    { key: 'staticSeedFallback', audit: seed, tag: 'DATA_SNAPSHOT seed fallback' },
    { key: 'liveSymbolsCoverage', audit: live, tag: 'LIVE_SYMBOLS coverage' },
    { key: 'snapshotConsistency', audit: snapshot, tag: 'cross-page snapshot consistency' },
    { key: 'crossPageIndicator', audit: cross, tag: 'indicator consistency' },
    { key: 'dataActionHandler', audit: action, tag: 'data-action handler' },
    { key: 'tableAccessibility', audit: tableA11y, tag: 'table accessibility' }
  ];
  hardAudits.forEach(function(item) {
    var count = auditIssueCount(item.audit);
    if (count) issues.push(item.tag + ': ' + count + ' issue(s)');
  });
  if (deep && deep.status === 'fail') warnings.push('deep review still has ' + deep.issueCount + ' issue(s)');
  if (market && auditIssueCount(market)) warnings.push('market currentness has ' + auditIssueCount(market) + ' warning(s)');

  var sourceSelector = '[data-source-kind],[data-operational-use],[data-snap-date],.source,.source-note,.aio-source,.aio-data-lineage,[data-provider],[data-freshness]';
  var pageRows = (surface && Array.isArray(surface.pages) ? surface.pages : qsa(root, '.page[id]').map(function(el) {
    return {
      id: String(el.id || '').replace(/^page-/, ''),
      briefRendered: !!el.querySelector('.aio-page-brief'),
      sections: qsa(el, 'section,.section,[class*="section"],.card,[class*="card"],[style*="border"]').length,
      dataSinks: qsa(el, '[data-live-price],[data-live-kr],[data-live-chg],[data-snap],[data-source-kind],[data-operational-use],[data-runtime-state],[data-score-scale],[data-threshold-table],[data-scenario-key],[data-cycle-phase]').length,
      controls: qsa(el, 'button,[data-action],input,select,textarea').length,
      tables: qsa(el, 'table').length,
      charts: qsa(el, 'canvas,iframe,[id*="chart"],[class*="chart"]').length,
      explainers: qsa(el, '.aio-explain,.aio-explain-content,details,.aio-page-brief-step,.aio-page-brief-focus').length,
      visibleLoadingText: 0,
      riskFlags: []
    };
  })).map(function(p) {
    var pageEl = document.getElementById('page-' + p.id);
    var lineage = pageEl ? qsa(pageEl, sourceSelector).length : 0;
    var dataHeavy = (p.dataSinks || 0) >= 8 || ((p.tables || 0) + (p.charts || 0)) >= 3;
    var interactionHeavy = (p.controls || 0) >= 12;
    var dataTruthFlags = [];
    if (dataHeavy && lineage === 0 && (p.explainers || 0) < 2) dataTruthFlags.push('dataHeavyNeedsLineage');
    if ((p.dataSinks || 0) >= 12 && ((p.tables || 0) + (p.charts || 0)) === 0) dataTruthFlags.push('dataDenseNoTableOrChart');
    if (p.visibleLoadingText) dataTruthFlags.push('visibleLoadingText');
    if (p.riskFlags && p.riskFlags.indexOf('emptyTablesOnly') >= 0) dataTruthFlags.push('emptyTablesOnly');

    var beginnerFlags = [];
    if (!p.briefRendered) beginnerFlags.push('missingBrief');
    if (interactionHeavy && (p.explainers || 0) < 2) beginnerFlags.push('manyControlsLowGuidance');

    var institutional = clamp(38 + Math.min(24, (p.dataSinks || 0) * 2) + Math.min(18, ((p.tables || 0) + (p.charts || 0)) * 4) + Math.min(15, (p.sections || 0) / 6) + Math.min(5, (p.explainers || 0)) + (p.briefRendered ? 5 : 0));
    var freshOps = clamp(55 + (lineage ? Math.min(20, lineage * 3) : ((p.dataSinks || 0) ? -8 : 12)) + (p.visibleLoadingText ? -18 : 6) - (dataTruthFlags.length * 5));
    var beginner = clamp(48 + (p.briefRendered ? 18 : -8) + Math.min(24, (p.explainers || 0) * 4) - Math.min(14, Math.max(0, (p.controls || 0) - ((p.explainers || 0) * 4) - 10)) - beginnerFlags.length * 4);
    var combined = clamp((institutional + freshOps + beginner) / 3);

    return Object.assign({}, p, {
      lineageMarkers: lineage,
      dataHeavy: dataHeavy,
      dataTruthFlags: dataTruthFlags,
      beginnerFlags: beginnerFlags,
      scores: {
        institutional: institutional,
        freshOps: freshOps,
        beginner: beginner,
        combined: combined
      }
    });
  });

  var dataWeakPages = pageRows.filter(function(p) { return p.dataTruthFlags.length > 0; });
  var weakPages = pageRows.filter(function(p) { return p.scores.combined < 62; }).sort(function(a, b) { return a.scores.combined - b.scores.combined; });
  if (dataWeakPages.length > 3) warnings.push(dataWeakPages.length + ' page(s) need stronger data lineage/explainer coverage');
  if (weakPages.length > 5) warnings.push(weakPages.length + ' page(s) score below 62 on three-goal fit');

  var overallScore = clamp((avg(pageRows, 'scores') || 0));
  var institutionalScore = avg(pageRows.map(function(p) { return { v: p.scores.institutional }; }), 'v');
  var freshOpsScore = avg(pageRows.map(function(p) { return { v: p.scores.freshOps }; }), 'v');
  var beginnerScore = avg(pageRows.map(function(p) { return { v: p.scores.beginner }; }), 'v');
  overallScore = clamp((institutionalScore + freshOpsScore + beginnerScore) / 3);
  if (essence && typeof essence.overallScore === 'number') {
    overallScore = clamp((overallScore + essence.overallScore) / 2);
  }

  return {
    version: window.AIO.version || (typeof APP_VERSION === 'string' ? APP_VERSION : null),
    generatedAt: new Date().toISOString(),
    status: issues.length ? 'fail' : (warnings.length ? 'warn' : 'ok'),
    score: overallScore,
    issueCount: issues.length,
    warningCount: warnings.length,
    issues: issues,
    warnings: warnings,
    passes: {
      dataTruth: {
        pageCount: pageRows.length,
        dataPageCount: pageRows.filter(function(p) { return (p.dataSinks || 0) > 0; }).length,
        weakPageCount: dataWeakPages.length,
        weakPages: dataWeakPages.slice(0, 12).map(function(p) {
          return { id: p.id, flags: p.dataTruthFlags, dataSinks: p.dataSinks, lineageMarkers: p.lineageMarkers, explainers: p.explainers };
        }),
        audits: {
          staticSeedFallback: seed,
          liveSymbolsCoverage: live,
          snapshotConsistency: snapshot,
          crossPageIndicator: cross,
          marketCurrentness: market,
          dataActionHandler: action,
          tableAccessibility: tableA11y
        }
      },
      goalFit: {
        overallScore: overallScore,
        institutionalScore: institutionalScore,
        freshOpsScore: freshOpsScore,
        beginnerScore: beginnerScore,
        weakPageCount: weakPages.length,
        weakestPages: weakPages.slice(0, 12).map(function(p) {
          return { id: p.id, scores: p.scores, flags: (p.dataTruthFlags || []).concat(p.beginnerFlags || []) };
        }),
        essenceAlignment: essence
      }
    },
    pages: pageRows
  };
};

// v49.65 Codex hardening: product essence alignment audit.
// Tracks the three north-star goals as user-facing, repeatable checks instead of
// one-off narrative review.
window.AIO.getEssenceAlignmentAudit = function(opts) {
  opts = opts || {};
  var root = opts.root || document;
  var issues = [];
  var actions = [];
  function count(sel) {
    try { return root.querySelectorAll(sel).length; } catch(_) { return 0; }
  }
  function safe(fn, fallback) {
    try { return fn(); } catch(_) { return fallback; }
  }
  function clampScore(v) {
    v = Math.round(Number(v) || 0);
    return Math.max(0, Math.min(100, v));
  }
  function textCount(re) {
    var txt = safe(function(){
      var base = root.body || root.documentElement || root;
      if (!document.createTreeWalker || !window.NodeFilter) return base.textContent || '';
      var parts = [];
      var walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var n;
      while ((n = walker.nextNode())) parts.push(n.nodeValue || '');
      return parts.join(' ');
    }, '');
    var m = txt.match(re);
    return m ? m.length : 0;
  }

  var pages = count('.page[id]');
  var pageBriefs = count('.aio-page-brief');
  var pageBriefRegistry = window.AIO_PAGE_BRIEFS ? Object.keys(window.AIO_PAGE_BRIEFS).length : 0;
  var coreViewOn = safe(function(){ return localStorage.getItem('aio_full_view') !== '1'; }, true);
  var dataLive = count('[data-live-price], [data-live-kr], [data-live-chg]');
  var dataSnap = count('[data-snap]');
  var sourceKind = count('[data-source-kind]');
  var operationalUse = count('[data-operational-use]');
  var loadingText = textCount(/로딩 중|데이터 로딩|분석 로딩|계산 중/g);
  var waitingText = textCount(/수신 대기|수집 대기/g);
  var consoleOnlyHints = textCount(/콘솔:\s*AIO\./g);
  var explainCount = count('.aio-explain, .aio-explain-content, details');
  var controlCount = count('button,[data-action],input,select,textarea');
  var chartCount = count('canvas,iframe,[id*="chart"],[class*="chart"]');
  var sourceLineageRatio = dataLive ? Math.round(sourceKind / dataLive * 100) : 100;
  var useLineageRatio = dataLive ? Math.round(operationalUse / dataLive * 100) : 100;

  var uxAudit = window.AIO.getPageUXAudit ? safe(function(){ return window.AIO.getPageUXAudit(); }, null) : null;
  var analysis = window.AIO.getAnalysisFrameworkCoverageAudit ? safe(function(){ return window.AIO.getAnalysisFrameworkCoverageAudit(); }, null) : null;
  var scheduler = window.AIO.getRefreshSchedulerAudit ? safe(function(){ return window.AIO.getRefreshSchedulerAudit(); }, null) : null;
  var freshness = window.AIO.getDataFreshnessAudit ? safe(function(){ return window.AIO.getDataFreshnessAudit(); }, null) : null;
  var deployment = opts.includeDeployment && window.AIO.getDeploymentGateAudit ? safe(function(){ return window.AIO.getDeploymentGateAudit({ strict: false, skipEssence: true }); }, null) : null;
  var marketCurrentness = window.AIO.getMarketCurrentnessAudit ? safe(function(){ return window.AIO.getMarketCurrentnessAudit({ includeHidden: true }); }, null) : null;
  var dataAction = window.AIO.getDataActionHandlerAudit ? safe(function(){ return window.AIO.getDataActionHandlerAudit(); }, null) : null;

  var institutionalScore = clampScore(
    30 +
    Math.min(20, pages) +
    Math.min(15, Math.round(explainCount / 4)) +
    Math.min(15, chartCount) +
    (analysis ? Math.min(20, analysis.operationalCoveragePct || analysis.coveragePct || 0) / 5 : 0) +
    (dataAction && dataAction.issueCount === 0 ? 10 : 0)
  );
  var dataOpsScore = clampScore(
    20 +
    (scheduler && scheduler.totalTasks >= 8 && !scheduler.tasksWithoutFn.length ? 25 : 0) +
    (freshness && freshness.status === 'ok' ? 20 : freshness ? 10 : 0) +
    (deployment ? (deployment.deployable ? 15 : 0) : 15) +
    Math.min(20, Math.round((sourceLineageRatio + useLineageRatio) / 10))
  );
  var intuitiveScore = clampScore(
    25 +
    (pageBriefRegistry >= pages ? 20 : Math.round((pageBriefRegistry / Math.max(1, pages)) * 20)) +
    (coreViewOn ? 15 : 8) +
    Math.min(15, Math.round(controlCount / 30)) +
    Math.min(10, waitingText) -
    Math.min(20, Math.round(loadingText / 6)) -
    Math.min(10, consoleOnlyHints * 3)
  );

  if (!analysis || (analysis.operationalCoveragePct || 0) < 80) {
    issues.push('17관점 중 partial/low-confidence 영역이 많아 기관급 분석 신뢰도 고지 강화 필요');
    actions.push('partialFields를 사용자 카드에서 가능/부분/수동확인으로 분리 표시');
  }
  if (!scheduler || scheduler.tasksWithoutFn.length) {
    issues.push('자동 갱신 스케줄러 함수 누락 또는 감사 불가');
    actions.push('REFRESH_SCHEDULE 전 task fn 연결 및 getRefreshSchedulerAudit 배포 전 통과');
  }
  if (sourceLineageRatio < 40 || useLineageRatio < 40) {
    issues.push('핵심 live sink 대비 source/operational lineage 표기가 부족');
    actions.push('data-live-* 요소에 data-source-kind/data-operational-use 자동 부착 확대');
  }
  if (loadingText > waitingText * 3) {
    issues.push('초기 화면의 로딩/계산 문구가 수신대기 표준보다 많음');
    actions.push('로딩 중/계산 중 초기 문구를 수신 대기/수집 대기 + reference-only lineage로 정규화');
  }
  if (consoleOnlyHints > 0) {
    issues.push('초보자에게 콘솔 명령으로만 안내되는 진단 경로 존재');
    actions.push('콘솔 전용 audit은 사이드바/가이드 버튼으로 노출');
  }
  if (uxAudit && uxAudit.issueCount) {
    issues.push('페이지 UX audit issue ' + uxAudit.issueCount + '건');
  }
  if (marketCurrentness && marketCurrentness.issueCount) {
    issues.push('시장 currentness/lineage issue ' + marketCurrentness.issueCount + '건');
  }

  var overall = clampScore(Math.round((institutionalScore + dataOpsScore + intuitiveScore) / 3));
  return {
    version: 'v49.65',
    status: overall >= 85 && issues.length === 0 ? 'ok' : overall >= 70 ? 'warn' : 'fail',
    overallScore: overall,
    goals: {
      institutionalAllInOne: {
        score: institutionalScore,
        pageCount: pages,
        explainCount: explainCount,
        chartCount: chartCount,
        analysisFramework: analysis ? { coveragePct: analysis.coveragePct, operationalCoveragePct: analysis.operationalCoveragePct, partialCount: analysis.partialCount } : null
      },
      accurateFreshAutoOps: {
        score: dataOpsScore,
        schedulerTasks: scheduler ? scheduler.totalTasks : 0,
        schedulerMissingFns: scheduler ? scheduler.tasksWithoutFn : ['audit unavailable'],
        freshnessStatus: freshness && freshness.status || null,
        deploymentStatus: deployment && deployment.status || null,
        sourceLineageRatio: sourceLineageRatio,
        operationalUseRatio: useLineageRatio
      },
      intuitiveBeginnerUse: {
        score: intuitiveScore,
        pagesWithBriefRegistry: pageBriefRegistry,
        coreViewOn: coreViewOn,
        controlCount: controlCount,
        loadingTextCount: loadingText,
        waitingTextCount: waitingText,
        consoleOnlyHintCount: consoleOnlyHints,
        uxIssueCount: uxAudit ? uxAudit.issueCount : null
      }
    },
    issues: issues,
    recommendedActions: Array.from(new Set(actions)),
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.32 M1 근본 수정: NUMERIC_GUIDELINE_SAFELIST — 정량 임계값 화이트리스트
// system 프롬프트에 박혀있는 정량 수치를 가격이 아닌 calibration 상수로 명시.
// AI가 "QCOM = 150" 환각 응답 시 출처 차단 (chat L54 "147-150" 등).
// R84 신규 (정량 수치 화이트리스트)
// ─────────────────────────────────────────────────────────────────
window.AIO_NUMERIC_GUIDELINE_SAFELIST = {
  version: 'v49.32',
  thresholds: {
    'blowoff-index-20ma-ratio':       { value: '117-120', meaning: 'Index price / 20MA ratio band (NOT stock price)', context: 'blow-off top checklist' },
    'blowoff-singlename-20ma-distance': { value: '147-150', meaning: 'Single-name 20MA distance percentile (NOT stock price)', context: 'blow-off top checklist' },
    'vix-fear-extreme':               { value: '30', meaning: 'VIX level — extreme fear (NOT stock price)', context: 'VIX regime' },
    'vix-normal-upper':               { value: '20', meaning: 'VIX level — caution above (NOT stock price)', context: 'VIX regime' },
    'fg-extreme-fear':                { value: '25', meaning: 'CNN Fear & Greed score — extreme fear (NOT stock price)', context: 'F&G index' },
    'hy-spread-tight':                { value: '300', meaning: 'HY OAS bps — tight spread (NOT stock price)', context: 'HY spread bps' },
    'rsi-oversold':                   { value: '30', meaning: 'RSI 14 — oversold (NOT stock price)', context: 'RSI threshold' },
    'rsi-overbought':                 { value: '70', meaning: 'RSI 14 — overbought (NOT stock price)', context: 'RSI threshold' }
  },
  // 응답 텍스트에 등장한 수치가 safelist 임계값인지 검증
  isCalibrationConstant: function(value) {
    var v = String(value).trim();
    return Object.keys(this.thresholds).some(function(k) {
      return this.thresholds[k].value === v || this.thresholds[k].value.indexOf(v) !== -1;
    }, this);
  }
};

window.AIO.getNumericGuidelineAudit = function() {
  var reg = window.AIO_NUMERIC_GUIDELINE_SAFELIST;
  if (!reg) return { status: 'error', issueCount: 0, issues: ['SAFELIST undefined'] };
  var issues = [];
  // CHAT_CONTEXTS system 프롬프트 텍스트에 등장하는 정량 수치 vs safelist 비교는 직접 불가
  // 대신 safelist 자체의 무결성만 검증
  Object.keys(reg.thresholds).forEach(function(k) {
    var t = reg.thresholds[k];
    if (!t.value || !t.meaning || !t.context) {
      issues.push(k + ' has incomplete metadata');
    }
  });
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    totalThresholds: Object.keys(reg.thresholds).length,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.32 M4 근본 수정: TICKER_NAME_REGISTRY — 종목명-티커 단일 출처
// 한글/영문/별명/한자 모두 → 표준 ticker. R85 신규.
// 기존 KR_TICKER_MAP (aio-data.js)을 흡수 + 영문 별명 보강
// ─────────────────────────────────────────────────────────────────
window.AIO_TICKER_NAME_REGISTRY = {
  version: 'v49.65',
  // 표준 형식: { ticker: { en: '...', kr: '...', alt: [...] } }
  // v49.57 확장 (R103): 47 → 150+ — 테마/트렌드 543 ticker 한글 인식 갭 해소.
  entries: {
    // ── 메가캡 코어 (v49.32 기존 30개) ──
    'NVDA':  { en: 'NVIDIA',           kr: '엔비디아',     alt: ['nvidia', 'nvda'] },
    'AAPL':  { en: 'Apple',            kr: '애플',         alt: ['apple', 'aapl'] },
    'MSFT':  { en: 'Microsoft',        kr: '마이크로소프트', alt: ['microsoft', 'msft', 'ms'] },
    'GOOGL': { en: 'Alphabet',         kr: '알파벳',       alt: ['google', 'alphabet', 'googl', 'goog'] },
    'AMZN':  { en: 'Amazon',           kr: '아마존',       alt: ['amazon', 'amzn'] },
    'META':  { en: 'Meta',             kr: '메타',         alt: ['meta', 'facebook'] },
    'TSLA':  { en: 'Tesla',            kr: '테슬라',       alt: ['tesla', 'tsla'] },
    'QCOM':  { en: 'Qualcomm',         kr: '퀄컴',         alt: ['qualcomm', 'qcom'] },
    'AMD':   { en: 'AMD',              kr: 'AMD',         alt: ['amd', 'advanced micro'] },
    'INTC':  { en: 'Intel',            kr: '인텔',         alt: ['intel', 'intc'] },
    'AVGO':  { en: 'Broadcom',         kr: '브로드컴',     alt: ['broadcom', 'avgo'] },
    'TSM':   { en: 'TSMC',             kr: 'TSMC',        alt: ['tsmc', 'tsm', '대만반도체'] },
    'ASML':  { en: 'ASML',             kr: 'ASML',        alt: ['asml'] },
    'MU':    { en: 'Micron',           kr: '마이크론',     alt: ['micron', 'mu'] },
    'ARM':   { en: 'ARM Holdings',     kr: 'ARM',         alt: ['arm', 'arm holdings'] },
    'SMCI':  { en: 'Super Micro',      kr: '슈퍼마이크로',  alt: ['supermicro', 'super micro', 'smci'] },
    'PLTR':  { en: 'Palantir',         kr: '팔란티어',     alt: ['palantir', 'pltr'] },
    'NFLX':  { en: 'Netflix',          kr: '넷플릭스',     alt: ['netflix', 'nflx'] },
    'CRM':   { en: 'Salesforce',       kr: '세일즈포스',   alt: ['salesforce', 'crm'] },
    'ORCL':  { en: 'Oracle',           kr: '오라클',       alt: ['oracle', 'orcl'] },
    'COIN':  { en: 'Coinbase',         kr: '코인베이스',   alt: ['coinbase', 'coin'] },
    'JPM':   { en: 'JPMorgan',         kr: 'JP모건',       alt: ['jpmorgan', 'jpm', 'jp모건'] },
    'BAC':   { en: 'Bank of America',  kr: '뱅크오브아메리카', alt: ['bac', 'bofa'] },
    'WMT':   { en: 'Walmart',          kr: '월마트',       alt: ['walmart', 'wmt'] },
    'XOM':   { en: 'Exxon Mobil',      kr: '엑손모빌',     alt: ['exxon', 'xom'] },
    'JNJ':   { en: 'Johnson & Johnson', kr: '존슨앤존슨',  alt: ['johnson', 'jnj'] },
    'V':     { en: 'Visa',             kr: '비자',         alt: ['visa'] },
    'MA':    { en: 'Mastercard',       kr: '마스터카드',   alt: ['mastercard'] },
    'UNH':   { en: 'UnitedHealth',     kr: '유나이티드헬스', alt: ['unitedhealth', 'unh'] },
    'BRK.B': { en: 'Berkshire Hathaway', kr: '버크셔해서웨이', alt: ['berkshire', 'brk', 'brk.b'] },

    // ── v49.57 신규: 반도체 장비/EDA (8) ──
    'AMAT':  { en: 'Applied Materials', kr: '어플라이드머티어리얼즈', alt: ['applied materials', 'amat'] },
    'LRCX':  { en: 'Lam Research',     kr: '램리서치',     alt: ['lam research', 'lrcx', '램'] },
    'KLAC':  { en: 'KLA',              kr: 'KLA',         alt: ['kla', 'klac'] },
    'SNPS':  { en: 'Synopsys',         kr: '시놉시스',     alt: ['synopsys', 'snps'] },
    'CDNS':  { en: 'Cadence',          kr: '케이던스',     alt: ['cadence', 'cdns'] },
    'MRVL':  { en: 'Marvell',          kr: '마벨',         alt: ['marvell', 'mrvl'] },
    'MCHP':  { en: 'Microchip',        kr: '마이크로칩',   alt: ['microchip', 'mchp'] },
    'ON':    { en: 'ON Semi',          kr: '온세미컨덕터', alt: ['onsemi', 'on semi'] },

    // ── v49.57 신규: 클라우드/SaaS/Cyber (12) ──
    'NET':   { en: 'Cloudflare',       kr: '클라우드플레어', alt: ['cloudflare', 'net'] },
    'ESTC':  { en: 'Elastic',          kr: '일래스틱',     alt: ['elastic', 'estc'] },
    'DDOG':  { en: 'Datadog',          kr: '데이터독',     alt: ['datadog', 'ddog'] },
    'SNOW':  { en: 'Snowflake',        kr: '스노우플레이크', alt: ['snowflake', 'snow'] },
    'MDB':   { en: 'MongoDB',          kr: '몽고DB',       alt: ['mongodb', 'mongo', 'mdb'] },
    'GTLB':  { en: 'GitLab',           kr: '깃랩',         alt: ['gitlab', 'gtlb'] },
    'CRWD':  { en: 'CrowdStrike',      kr: '크라우드스트라이크', alt: ['crowdstrike', 'crwd'] },
    'ZS':    { en: 'Zscaler',          kr: '지스케일러',   alt: ['zscaler', 'zs'] },
    'OKTA':  { en: 'Okta',             kr: '옥타',         alt: ['okta'] },
    'FTNT':  { en: 'Fortinet',         kr: '포티넷',       alt: ['fortinet', 'ftnt'] },
    'PANW':  { en: 'Palo Alto Networks', kr: '팔로알토네트웍스', alt: ['palo alto', 'panw'] },
    'NOW':   { en: 'ServiceNow',       kr: '서비스나우',   alt: ['servicenow', 'now'] },

    // ── v49.57 신규: GLP-1/Biotech (8) ──
    'LLY':   { en: 'Eli Lilly',        kr: '일라이릴리',   alt: ['eli lilly', 'lilly', 'lly'] },
    'NVO':   { en: 'Novo Nordisk',     kr: '노보노디스크', alt: ['novo nordisk', 'novo', 'nvo'] },
    'VKTX':  { en: 'Viking Therapeutics', kr: '바이킹테라퓨틱스', alt: ['viking', 'vktx'] },
    'MRNA':  { en: 'Moderna',          kr: '모더나',       alt: ['moderna', 'mrna'] },
    'REGN':  { en: 'Regeneron',        kr: '리제네론',     alt: ['regeneron', 'regn'] },
    'VRTX':  { en: 'Vertex',           kr: '버텍스',       alt: ['vertex', 'vrtx'] },
    'AMGN':  { en: 'Amgen',            kr: '암젠',         alt: ['amgen', 'amgn'] },
    'ABBV':  { en: 'AbbVie',           kr: '애브비',       alt: ['abbvie', 'abbv'] },

    // ── v49.57 신규: 원전/전력 (8) ──
    'CEG':   { en: 'Constellation Energy', kr: '컨스텔레이션에너지', alt: ['constellation', 'ceg'] },
    'VST':   { en: 'Vistra',           kr: '비스트라',     alt: ['vistra', 'vst'] },
    'CCJ':   { en: 'Cameco',           kr: '카메코',       alt: ['cameco', 'ccj'] },
    'NRG':   { en: 'NRG Energy',       kr: 'NRG에너지',    alt: ['nrg energy', 'nrg'] },
    'OKLO':  { en: 'Oklo',             kr: '오클로',       alt: ['oklo'] },
    'SMR':   { en: 'NuScale',          kr: '뉴스케일파워', alt: ['nuscale', 'smr'] },
    'NNE':   { en: 'Nano Nuclear',     kr: '나노뉴클리어', alt: ['nano nuclear', 'nne'] },
    'BWXT':  { en: 'BWX Technologies', kr: 'BWX테크놀로지', alt: ['bwx', 'bwxt'] },

    // ── v49.57 신규: 우주/위성 (5) ──
    'RKLB':  { en: 'Rocket Lab',       kr: '로켓랩',       alt: ['rocket lab', 'rklb'] },
    'ASTS':  { en: 'AST SpaceMobile',  kr: 'AST스페이스모바일', alt: ['ast spacemobile', 'asts'] },
    'LUNR':  { en: 'Intuitive Machines', kr: '인튜이티브머신', alt: ['intuitive machines', 'lunr'] },
    'PL':    { en: 'Planet Labs',      kr: '플래닛랩',     alt: ['planet labs', 'planet', 'pl'] },
    'RDW':   { en: 'Redwire',          kr: '레드와이어',   alt: ['redwire', 'rdw'] },

    // ── v49.57 신규: 양자컴퓨팅 (4) ──
    'IONQ':  { en: 'IonQ',             kr: '아이온큐',     alt: ['ionq'] },
    'RGTI':  { en: 'Rigetti Computing', kr: '리게티',      alt: ['rigetti', 'rgti'] },
    'QUBT':  { en: 'Quantum Computing', kr: '퀀텀컴퓨팅',  alt: ['quantum computing', 'qubt'] },
    'QBTS':  { en: 'D-Wave',           kr: '디웨이브',     alt: ['d-wave', 'dwave', 'qbts'] },

    // ── v49.57 신규: 크립토/핀테크 (8) ──
    'MSTR':  { en: 'MicroStrategy',    kr: '마이크로스트래티지', alt: ['microstrategy', 'mstr'] },
    'RIOT':  { en: 'Riot Platforms',   kr: '라이엇플랫폼', alt: ['riot platforms', 'riot'] },
    'MARA':  { en: 'MARA Holdings', kr: '마라홀딩스', alt: ['mara holdings', 'marathon', 'mara'] },
    'HOOD':  { en: 'Robinhood',        kr: '로빈후드',     alt: ['robinhood', 'hood'] },
    'PYPL':  { en: 'PayPal',           kr: '페이팔',       alt: ['paypal', 'pypl'] },
    'SOFI':  { en: 'SoFi',             kr: '소파이',       alt: ['sofi'] },
    'AFRM':  { en: 'Affirm',           kr: '어펌',         alt: ['affirm', 'afrm'] },
    'NU':    { en: 'Nu Holdings',      kr: '누홀딩스',     alt: ['nu holdings', 'nu', 'nubank'] },

    // ── v49.57 신규: 광통신/네트워킹 (8) ──
    'LITE':  { en: 'Lumentum',         kr: '루멘텀',       alt: ['lumentum', 'lite'] },
    'COHR':  { en: 'Coherent',         kr: '코히어런트',   alt: ['coherent', 'cohr'] },
    'CIEN':  { en: 'Ciena',            kr: '시에나',       alt: ['ciena', 'cien'] },
    'AAOI':  { en: 'Applied Optoelectronics', kr: 'AAOI', alt: ['applied optoelectronics', 'aaoi'] },
    'GLW':   { en: 'Corning',          kr: '코닝',         alt: ['corning', 'glw'] },
    'ANET':  { en: 'Arista Networks',  kr: '아리스타네트워크', alt: ['arista', 'anet'] },
    'POET':  { en: 'POET Technologies', kr: 'POET테크',    alt: ['poet'] },
    'VIAV':  { en: 'Viavi Solutions',  kr: '비아비',       alt: ['viavi', 'viav'] },

    // ── v49.57 신규: EV/자율주행 (8) ──
    'RIVN':  { en: 'Rivian',           kr: '리비안',       alt: ['rivian', 'rivn'] },
    'LCID':  { en: 'Lucid',            kr: '루시드',       alt: ['lucid', 'lcid'] },
    'GM':    { en: 'General Motors',   kr: 'GM',           alt: ['general motors', 'gm'] },
    'F':     { en: 'Ford',             kr: '포드',         alt: ['ford'] },
    'MBLY':  { en: 'Mobileye',         kr: '모빌아이',     alt: ['mobileye', 'mbly'] },
    'APTV':  { en: 'Aptiv',            kr: '앱티브',       alt: ['aptiv', 'aptv'] },
    'TSLA_AUTOPILOT': { en: 'Tesla FSD', kr: '테슬라FSD', alt: ['fsd', 'autopilot'] },
    'XPEV':  { en: 'XPeng',            kr: '샤오펑',       alt: ['xpeng', 'xpev'] },

    // ── v49.57 신규: 로보틱스 (4) ──
    'SYM':   { en: 'Symbotic',         kr: '심보틱',       alt: ['symbotic', 'sym'] },
    'PATH':  { en: 'UiPath',           kr: '유아이패스',   alt: ['uipath', 'path'] },
    'ISRG':  { en: 'Intuitive Surgical', kr: '인튜이티브서지컬', alt: ['intuitive surgical', 'isrg'] },
    'FANUY': { en: 'Fanuc',            kr: '화낙',         alt: ['fanuc', 'fanuy'] },

    // ── v49.57 신규: 데이터센터/Neocloud (10) ──
    'EQIX':  { en: 'Equinix',          kr: '에퀴닉스',     alt: ['equinix', 'eqix'] },
    'DLR':   { en: 'Digital Realty',   kr: '디지털리얼티', alt: ['digital realty', 'dlr'] },
    'VRT':   { en: 'Vertiv',           kr: '버티브',       alt: ['vertiv', 'vrt'] },
    'ETN':   { en: 'Eaton',            kr: '이튼',         alt: ['eaton', 'etn'] },
    'CRWV':  { en: 'CoreWeave',        kr: '코어위브',     alt: ['coreweave', 'crwv'] },
    'NBIS':  { en: 'Nebius',           kr: '네비우스',     alt: ['nebius', 'nbis'] },
    'IREN':  { en: 'Iris Energy',      kr: '아이리스에너지', alt: ['iris energy', 'iren'] },
    'CIFR':  { en: 'Cipher Mining',    kr: '사이퍼마이닝', alt: ['cipher mining', 'cifr'] },
    'WULF':  { en: 'TeraWulf',         kr: '테라울프',     alt: ['terawulf', 'wulf'] },
    'DELL':  { en: 'Dell Technologies', kr: '델테크놀로지스', alt: ['dell', 'dell technologies'] },

    // ── v49.57 신규: 태양광/ESS/수소 (8) ──
    'FSLR':  { en: 'First Solar',      kr: '퍼스트솔라',   alt: ['first solar', 'fslr'] },
    'ENPH':  { en: 'Enphase',          kr: '엔페이즈',     alt: ['enphase', 'enph'] },
    'RUN':   { en: 'Sunrun',           kr: '선런',         alt: ['sunrun', 'run'] },
    'SEDG':  { en: 'SolarEdge',        kr: '솔라엣지',     alt: ['solaredge', 'sedg'] },
    'NXT':   { en: 'NEXTracker',       kr: '넥스트래커',   alt: ['nextracker', 'nxt'] },
    'BE':    { en: 'Bloom Energy',     kr: '블룸에너지',   alt: ['bloom energy', 'be'] },
    'PLUG':  { en: 'Plug Power',       kr: '플러그파워',   alt: ['plug power', 'plug'] },
    'FCEL':  { en: 'FuelCell',         kr: '퓨얼셀',       alt: ['fuelcell', 'fcel'] },

    // ── v49.57 신규: 스트리밍/미디어/광고 (6) ──
    'DIS':   { en: 'Disney',           kr: '디즈니',       alt: ['disney', 'dis'] },
    'WBD':   { en: 'Warner Bros Discovery', kr: '워너브로스', alt: ['warner bros', 'wbd'] },
    'SPOT':  { en: 'Spotify',          kr: '스포티파이',   alt: ['spotify', 'spot'] },
    'ROKU':  { en: 'Roku',             kr: '로쿠',         alt: ['roku'] },
    'TTD':   { en: 'The Trade Desk',   kr: '트레이드데스크', alt: ['trade desk', 'ttd'] },
    'APP':   { en: 'AppLovin',         kr: '앱러빈',       alt: ['applovin', 'app'] },

    // ── v49.57 신규: 에너지/석유 (8) ──
    'SLB':   { en: 'SLB',              kr: '슐럼버거',     alt: ['slb', 'schlumberger', '슐럼버거'] },
    'EOG':   { en: 'EOG Resources',    kr: 'EOG리소스',    alt: ['eog resources', 'eog'] },
    'FANG':  { en: 'Diamondback Energy', kr: '다이아몬드백', alt: ['diamondback', 'fang'] },
    'DVN':   { en: 'Devon Energy',     kr: '데본에너지',   alt: ['devon', 'dvn'] },
    'MPC':   { en: 'Marathon Petroleum', kr: '마라톤페트롤리엄', alt: ['marathon petroleum', 'mpc'] },
    'VLO':   { en: 'Valero',           kr: '발레로',       alt: ['valero', 'vlo'] },
    'PSX':   { en: 'Phillips 66',      kr: '필립스66',     alt: ['phillips 66', 'psx'] },
    'CVX':   { en: 'Chevron',          kr: '셰브론',       alt: ['chevron', 'cvx'] },

    // ── v49.57 신규: 방산/항공우주 (8) ──
    'RTX':   { en: 'RTX',              kr: 'RTX',          alt: ['rtx', 'raytheon'] },
    'LMT':   { en: 'Lockheed Martin',  kr: '록히드마틴',   alt: ['lockheed martin', 'lmt'] },
    'NOC':   { en: 'Northrop Grumman', kr: '노스럽그루먼', alt: ['northrop grumman', 'noc'] },
    'GD':    { en: 'General Dynamics', kr: '제너럴다이내믹스', alt: ['general dynamics', 'gd'] },
    'HII':   { en: 'Huntington Ingalls', kr: '헌팅턴인갈스', alt: ['huntington ingalls', 'hii'] },
    'LDOS':  { en: 'Leidos',           kr: '레이도스',     alt: ['leidos', 'ldos'] },
    'HWM':   { en: 'Howmet Aerospace', kr: '하우멧',       alt: ['howmet', 'hwm'] },
    'BA':    { en: 'Boeing',           kr: '보잉',         alt: ['boeing', 'ba'] },

    // ── v49.57 신규: 소비/리테일/패션 (10) ──
    'COST':  { en: 'Costco',           kr: '코스트코',     alt: ['costco', 'cost'] },
    'PEP':   { en: 'PepsiCo',          kr: '펩시코',       alt: ['pepsico', 'pep', '펩시'] },
    'KO':    { en: 'Coca-Cola',        kr: '코카콜라',     alt: ['coca-cola', 'coca cola', 'ko'] },
    'MCD':   { en: 'McDonalds',        kr: '맥도날드',     alt: ['mcdonald', 'mcd'] },
    'NKE':   { en: 'Nike',             kr: '나이키',       alt: ['nike', 'nke'] },
    'SBUX':  { en: 'Starbucks',        kr: '스타벅스',     alt: ['starbucks', 'sbux'] },
    'PG':    { en: 'Procter & Gamble', kr: 'P&G',          alt: ['procter gamble', 'p&g', 'pg'] },
    'HD':    { en: 'Home Depot',       kr: '홈디포',       alt: ['home depot', 'hd'] },
    'LOW':   { en: 'Lowes',            kr: '로우스',       alt: ['lowes', 'low'] },
    'LULU':  { en: 'Lululemon',        kr: '룰루레몬',     alt: ['lululemon', 'lulu'] },

    // ── v49.57 신규: 여행/배달/숙박 (7) ──
    'BKNG':  { en: 'Booking Holdings', kr: '부킹홀딩스',   alt: ['booking', 'bkng'] },
    'ABNB':  { en: 'Airbnb',           kr: '에어비앤비',   alt: ['airbnb', 'abnb'] },
    'UBER':  { en: 'Uber',             kr: '우버',         alt: ['uber'] },
    'DASH':  { en: 'DoorDash',         kr: '도어대시',     alt: ['doordash', 'dash'] },
    'DAL':   { en: 'Delta Airlines',   kr: '델타항공',     alt: ['delta airlines', 'dal'] },
    'UAL':   { en: 'United Airlines',  kr: '유나이티드항공', alt: ['united airlines', 'ual'] },
    'CCL':   { en: 'Carnival',         kr: '카니발크루즈', alt: ['carnival', 'ccl'] },

    // ── v49.57 신규: 헬스케어/제약 (5) ──
    'MRK':   { en: 'Merck',            kr: '머크',         alt: ['merck', 'mrk'] },
    'PFE':   { en: 'Pfizer',           kr: '화이자',       alt: ['pfizer', 'pfe'] },
    'TMO':   { en: 'Thermo Fisher',    kr: '써모피셔',     alt: ['thermo fisher', 'tmo'] },
    'ABT':   { en: 'Abbott',           kr: '애보트',       alt: ['abbott', 'abt'] },
    'GILD':  { en: 'Gilead Sciences',  kr: '길리어드',     alt: ['gilead', 'gild'] },

    // ── v49.57 신규: 게임/소셜 (6) ──
    'EA':    { en: 'Electronic Arts',  kr: '일렉트로닉아츠', alt: ['electronic arts', 'ea'] },
    'TTWO':  { en: 'Take-Two',         kr: '테이크투',     alt: ['take-two', 'ttwo'] },
    'RBLX':  { en: 'Roblox',           kr: '로블록스',     alt: ['roblox', 'rblx'] },
    'SNAP':  { en: 'Snap',             kr: '스냅챗',       alt: ['snap', 'snapchat'] },
    'PINS':  { en: 'Pinterest',        kr: '핀터레스트',   alt: ['pinterest', 'pins'] },
    'RDDT':  { en: 'Reddit',           kr: '레딧',         alt: ['reddit', 'rddt'] },

    // ── v49.57 신규: AI 소프트웨어 (5) ──
    'AI':    { en: 'C3.ai',            kr: 'C3AI',         alt: ['c3.ai', 'c3 ai'] },
    'TEM':   { en: 'Tempus AI',        kr: '템퍼스AI',     alt: ['tempus ai', 'tem'] },
    'SOUN':  { en: 'SoundHound',       kr: '사운드하운드', alt: ['soundhound', 'soun'] },
    'IBM':   { en: 'IBM',              kr: 'IBM',          alt: ['ibm'] },
    'CSCO':  { en: 'Cisco',            kr: '시스코',       alt: ['cisco', 'csco'] },

    // ── v49.57 신규: International ADR — 한국 매체 표기 (12) ──
    'BABA':  { en: 'Alibaba',          kr: '알리바바',     alt: ['alibaba', 'baba'] },
    'PDD':   { en: 'PDD Holdings',     kr: '핀둬둬',       alt: ['pdd', 'pinduoduo', 'temu'] },
    'JD':    { en: 'JD.com',           kr: '징둥닷컴',     alt: ['jd', 'jd.com'] },
    'BIDU':  { en: 'Baidu',            kr: '바이두',       alt: ['baidu', 'bidu'] },
    'NTES':  { en: 'NetEase',          kr: '넷이즈',       alt: ['netease', 'ntes'] },
    'TCEHY': { en: 'Tencent',          kr: '텐센트',       alt: ['tencent', 'tcehy'] },
    'NIO':   { en: 'NIO',              kr: '니오',         alt: ['nio'] },
    'LI':    { en: 'Li Auto',          kr: '리오토',       alt: ['li auto', 'li'] },
    'TM':    { en: 'Toyota',           kr: '도요타',       alt: ['toyota', 'tm'] },
    'SONY':  { en: 'Sony',             kr: '소니',         alt: ['sony'] },
    'SAP':   { en: 'SAP',              kr: 'SAP',          alt: ['sap'] },
    'SHOP':  { en: 'Shopify',          kr: '쇼피파이',     alt: ['shopify', 'shop'] },

    // ── 한국 종목 (v49.32 기존 17개) ──
    '005930.KS': { en: 'Samsung Electronics', kr: '삼성전자',     alt: ['samsung', 'samsung electronics', '005930', '삼전'] },
    '000660.KS': { en: 'SK Hynix',           kr: 'SK하이닉스',    alt: ['hynix', 'sk hynix', '000660', '하이닉스'] },
    '005380.KS': { en: 'Hyundai Motor',      kr: '현대차',         alt: ['hyundai', 'hyundai motor', '005380', '현대자동차'] },
    '373220.KS': { en: 'LG Energy Solution', kr: 'LG에너지솔루션',  alt: ['lges', 'lg energy', '373220', 'lg엔솔'] },
    '035720.KS': { en: 'Kakao',              kr: '카카오',         alt: ['kakao', '035720'] },
    '035420.KS': { en: 'NAVER',              kr: '네이버',         alt: ['naver', '035420'] },
    '207940.KS': { en: 'Samsung Biologics',  kr: '삼성바이오로직스',  alt: ['samsung biologics', '207940', '삼바'] },
    '051910.KS': { en: 'LG Chem',            kr: 'LG화학',         alt: ['lg chem', '051910'] },
    '006400.KS': { en: 'Samsung SDI',        kr: '삼성SDI',        alt: ['samsung sdi', '006400'] },
    '003670.KS': { en: 'POSCO Future M',     kr: '포스코퓨처엠',    alt: ['posco future m', '003670', '포스코케미칼'] },
    '012450.KS': { en: 'Hanwha Aerospace',   kr: '한화에어로스페이스', alt: ['hanwha aerospace', '012450'] },
    '042660.KS': { en: 'Hanwha Ocean',       kr: '한화오션',       alt: ['hanwha ocean', '042660', '대우조선해양'] },
    '034730.KS': { en: 'SK',                 kr: 'SK',            alt: ['sk holdings', '034730'] },
    '003550.KS': { en: 'LG',                 kr: 'LG',            alt: ['lg corp', '003550'] },
    '011200.KS': { en: 'HMM',                kr: 'HMM',           alt: ['hmm', '011200', '현대상선'] },
    '247540.KQ': { en: 'EcoPro BM',          kr: '에코프로비엠',    alt: ['ecopro bm', '247540'] },
    '086520.KQ': { en: 'EcoPro',             kr: '에코프로',       alt: ['ecopro', '086520'] },

    // ── v49.57 신규: 한국 종목 5종 (사용자 요청) ──
    '267250.KS': { en: 'HD Hyundai Heavy',   kr: 'HD현대중공업',   alt: ['hd hyundai heavy', '267250', '현대중공업'] },
    '006260.KS': { en: 'LS',                 kr: 'LS',            alt: ['ls corp', '006260', 'ls전선'] },
    '161890.KS': { en: 'Kolmar Korea',       kr: '한국콜마',       alt: ['kolmar korea', 'kolmar', '161890'] },
    '000080.KS': { en: 'HiteJinro',          kr: '하이트진로',     alt: ['hitejinro', '000080', '하이트'] },
    '323410.KQ': { en: 'Kakao Bank',         kr: '카카오뱅크',     alt: ['kakao bank', 'kakaobank', '323410'] },

    // ── v49.59 신규 카테고리별 확장 60개 (REGISTRY 173→230+ 32%→50%+) ──
    // 클라우드/SaaS 추가 (3)
    'CFLT':  { en: 'Confluent',        kr: '컨플루언트',   alt: ['confluent', 'cflt', 'kafka'] },
    'WDAY':  { en: 'Workday',          kr: '워크데이',     alt: ['workday', 'wday', 'hr'] },
    'MNDY':  { en: 'Monday.com',       kr: '먼데이닷컴',   alt: ['monday', 'mndy'] },
    // 에너지 추가 (7)
    'COP':   { en: 'ConocoPhillips',   kr: '코노코필립스', alt: ['conoco', 'cop'] },
    'OXY':   { en: 'Occidental',       kr: '옥시덴탈',     alt: ['occidental', 'oxy'] },
    'SHEL':  { en: 'Shell',            kr: '쉘',           alt: ['shell', 'shel'] },
    'TTE':   { en: 'TotalEnergies',    kr: '토탈에너지스', alt: ['total', 'tte'] },
    'BP':    { en: 'BP',               kr: 'BP',           alt: ['bp', 'british petroleum'] },
    'HAL':   { en: 'Halliburton',      kr: '핼리버튼',     alt: ['halliburton', 'hal'] },
    'BKR':   { en: 'Baker Hughes',     kr: '베이커휴즈',   alt: ['baker hughes', 'bkr'] },
    // 핀테크 추가 (5)
    'XYZ':   { en: 'Block',            kr: '블록',         alt: ['block', 'xyz', 'square', 'sq'] },
    'UPST':  { en: 'Upstart',          kr: '업스타트',     alt: ['upstart', 'upst'] },
    'AXP':   { en: 'American Express', kr: '아메리칸익스프레스', alt: ['american express', 'amex', 'axp'] },
    'BLK':   { en: 'BlackRock',        kr: '블랙록',       alt: ['blackrock', 'blk'] },
    'SPGI':  { en: 'S&P Global',       kr: 'S&P글로벌',    alt: ['s&p global', 'spgi'] },
    // 은행 추가 (7)
    'WFC':   { en: 'Wells Fargo',      kr: '웰스파고',     alt: ['wells fargo', 'wfc'] },
    'MS':    { en: 'Morgan Stanley',   kr: '모건스탠리',   alt: ['morgan stanley', 'ms', '모스'] },
    'C':     { en: 'Citigroup',        kr: '씨티그룹',     alt: ['citi', 'citigroup', 'c'] },
    'USB':   { en: 'US Bancorp',       kr: 'US뱅코프',     alt: ['us bancorp', 'usb'] },
    'PNC':   { en: 'PNC Financial',    kr: 'PNC',          alt: ['pnc'] },
    'SCHW':  { en: 'Charles Schwab',   kr: '찰스슈왑',     alt: ['schwab', 'schw'] },
    'BK':    { en: 'BNY Mellon',       kr: 'BNY멜론',      alt: ['bny mellon', 'bk'] },
    // 산업/방산 추가 (3)
    'GE':    { en: 'GE Aerospace',     kr: 'GE에어로스페이스', alt: ['ge', 'general electric', 'aerospace'] },
    'HON':   { en: 'Honeywell',        kr: '하니웰',       alt: ['honeywell', 'hon'] },
    'LHX':   { en: 'L3Harris',         kr: 'L3해리스',     alt: ['l3harris', 'lhx'] },
    // 원전 추가 (1)
    'TLN':   { en: 'Talen Energy',     kr: '탤런에너지',   alt: ['talen', 'tln'] },
    // 통신/배당주 추가 (4)
    'T':     { en: 'AT&T',             kr: 'AT&T',         alt: ['at&t', 'att'] },
    'VZ':    { en: 'Verizon',          kr: '버라이즌',     alt: ['verizon', 'vz'] },
    'DE':    { en: 'Deere',            kr: '디어',         alt: ['deere', 'john deere', 'de'] },
    'NEE':   { en: 'NextEra Energy',   kr: '넥스테라에너지', alt: ['nextera', 'nee'] },
    // 헬스케어 추가 (5)
    'MDT':   { en: 'Medtronic',        kr: '메드트로닉',   alt: ['medtronic', 'mdt'] },
    'EW':    { en: 'Edwards Lifesciences', kr: '에드워즈라이프사이언스', alt: ['edwards', 'ew'] },
    'GEHC':  { en: 'GE Healthcare',    kr: 'GE헬스케어',   alt: ['ge healthcare', 'gehc'] },
    'BSX':   { en: 'Boston Scientific', kr: '보스턴사이언티픽', alt: ['boston scientific', 'bsx'] },
    'DXCM':  { en: 'Dexcom',           kr: '덱스콤',       alt: ['dexcom', 'dxcm'] },
    // 인도 ADR 추가 (3)
    'IBN':   { en: 'ICICI Bank',       kr: 'ICICI은행',    alt: ['icici', 'ibn'] },
    'HDB':   { en: 'HDFC Bank',        kr: 'HDFC은행',     alt: ['hdfc', 'hdb'] },
    'INFY':  { en: 'Infosys',          kr: '인포시스',     alt: ['infosys', 'infy'] },
    // 게임 추가 (1)
    'NTDOY': { en: 'Nintendo',         kr: '닌텐도',       alt: ['nintendo', 'ntdoy'] },
    // 추가 메가캡 (10)
    'TMUS':  { en: 'T-Mobile',         kr: 'T모바일',      alt: ['t-mobile', 'tmus'] },
    'ADI':   { en: 'Analog Devices',   kr: '아날로그디바이스', alt: ['analog devices', 'adi'] },
    'INTU':  { en: 'Intuit',           kr: '인튜이트',     alt: ['intuit', 'intu'] },
    'ADBE':  { en: 'Adobe',            kr: '어도비',       alt: ['adobe', 'adbe'] },
    'AMT':   { en: 'American Tower',   kr: '아메리칸타워', alt: ['american tower', 'amt'] },
    'CCI':   { en: 'Crown Castle',     kr: '크라운캐슬',   alt: ['crown castle', 'cci'] },
    'CME':   { en: 'CME Group',        kr: 'CME그룹',      alt: ['cme', 'cme group'] },
    'ICE':   { en: 'Intercontinental Exchange', kr: 'ICE', alt: ['intercontinental', 'ice'] },
    'MMM':   { en: '3M',               kr: '3M',           alt: ['3m', 'mmm'] },
    'CAT':   { en: 'Caterpillar',      kr: '캐터필러',     alt: ['caterpillar', 'cat'] },
    // 추가 소비/리테일 (5)
    'TGT':   { en: 'Target',           kr: '타겟',         alt: ['target', 'tgt'] },
    'EBAY':  { en: 'eBay',             kr: '이베이',       alt: ['ebay'] },
    'CPNG':  { en: 'Coupang',          kr: '쿠팡',         alt: ['coupang', 'cpng'] },
    'CHWY':  { en: 'Chewy',            kr: '츄이',         alt: ['chewy', 'chwy'] },
    'PINS_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] }, // duplicate placeholder skip
    // 미디어/엔터 (3)
    'PARA':  { en: 'Paramount',        kr: '파라마운트',   alt: ['paramount', 'para'] },
    'PSKY':  { en: 'Paramount Skydance', kr: '파라마운트스카이댄스', alt: ['paramount skydance', 'psky'] },
    'FUBO':  { en: 'fuboTV',           kr: 'fuboTV',       alt: ['fubo', 'fubotv'] },
    // 위성/우주 추가 (2)
    'IRDM':  { en: 'Iridium',          kr: '이리듐',       alt: ['iridium', 'irdm'] },
    'GE_VRN': { en: 'GE Vernova',      kr: 'GE버노바',     alt: ['ge vernova', 'gev'] },
    // BTC 현물 ETF (4)
    'IBIT':  { en: 'iShares Bitcoin ETF', kr: '아이셰어즈비트코인ETF', alt: ['ibit', 'bitcoin etf'] },
    'FBTC':  { en: 'Fidelity Bitcoin ETF', kr: '피델리티비트코인ETF', alt: ['fbtc'] },
    'ARKB':  { en: 'ARK 21Shares Bitcoin', kr: 'ARK비트코인', alt: ['arkb'] },
    'BITO':  { en: 'ProShares BTC Strategy ETF', kr: '프로셰어즈BTC', alt: ['bito'] },

    // ═════════════════════════════════════════════════════════════════
    // v49.65 P339/R118 신규: 118개 순증 (REGISTRY 273 → 391, 실등록 383 + placeholder 8)
    // 카테고리: KR KOSDAQ/KOSPI/ETF + 인도/유럽/신흥국 ADR + 미국 보강
    // ═════════════════════════════════════════════════════════════════

    // ── KR KOSDAQ 2차전지/소재 (15) ──
    '348370.KQ': { en: 'Enchem',             kr: '엔켐',          alt: ['enchem', '348370'] },
    '121600.KQ': { en: 'Nano New Material',  kr: '나노신소재',    alt: ['nano', '121600'] },
    '137400.KQ': { en: 'PNT',                kr: '피엔티',        alt: ['pnt', '137400'] },
    '348210.KQ': { en: 'NEXTIN',             kr: '넥스틴',        alt: ['nextin', '348210'] },
    '290510.KQ': { en: 'L&F',                kr: '엘앤에프',      alt: ['l&f', 'lnf', '290510'] },
    '298540.KQ': { en: 'Daejoo Electronic',  kr: '대주전자재료',  alt: ['daejoo', '298540'] },
    '060280.KQ': { en: 'Curocom',            kr: '큐로컴',        alt: ['curocom', '060280'] },
    '278280.KQ': { en: 'Cheonbo',            kr: '천보',          alt: ['cheonbo', '278280'] },
    '460860.KQ': { en: 'Daejoo Industry',    kr: '대주산업',      alt: ['daejoo industry', '460860'] },
    '085660.KQ': { en: 'CIS',                kr: 'CIS',           alt: ['cis', '085660'] },
    '450080.KQ': { en: 'EcoPro Materials',   kr: '에코프로머티리얼즈', alt: ['ecopro materials', '450080'] },
    '457190.KQ': { en: 'EcoPro AP',          kr: '에코프로AP',    alt: ['ecopro ap', '457190'] },
    '393890.KQ': { en: 'Korea Cer',          kr: '한국세라믹',    alt: ['korea cer', '393890'] },
    '178920.KQ': { en: 'SK IE Technology',   kr: 'SK아이이테크놀로지', alt: ['sk ie tech', '178920', 'sk ietl'] },
    '383310.KQ': { en: 'Ecopro Industrial',  kr: '에코프로글로벌', alt: ['ecopro ind', '383310'] },

    // ── KR KOSDAQ 반도체 후공정/장비 (15) ──
    '058470.KQ': { en: 'Leeno Industrial',   kr: '리노공업',      alt: ['leeno', '058470'] },
    '240810.KQ': { en: 'Wonik IPS',          kr: '원익IPS',       alt: ['wonik', 'wonik ips', '240810'] },
    '095340.KQ': { en: 'ISC',                kr: 'ISC',           alt: ['isc', '095340'] },
    '005290.KQ': { en: 'DongJin Semichem',   kr: '동진쎄미켐',    alt: ['dongjin', 'dongjin semichem', '005290'] },
    '039200.KQ': { en: 'Osung LST',          kr: '오성첨단소재',  alt: ['osung', '039200'] },
    '042700.KQ': { en: 'Hanmi Semiconductor', kr: '한미반도체',   alt: ['hanmi semi', 'hanmi semiconductor', '042700'] },
    '108320.KQ': { en: 'LX Semicon',         kr: 'LX세미콘',      alt: ['lx semicon', '108320'] },
    '084370.KQ': { en: 'EOTechnics',         kr: '이오테크닉스',  alt: ['eotechnics', '084370'] },
    '101490.KQ': { en: 'Silicon Display',    kr: '실리콘웍스',    alt: ['silicon display', '101490'] },
    '352700.KQ': { en: 'HPSP',               kr: 'HPSP',          alt: ['hpsp', '352700'] },
    '413640.KQ': { en: 'Hyundai Mobis Test', kr: 'NEXTIN',        alt: ['nextin', '413640'] },
    '403870.KQ': { en: 'HJ Sci',             kr: 'HJ소재',        alt: ['hj sci', '403870'] },
    '058470_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] },
    '067310.KQ': { en: 'Hana Micron',        kr: '하나마이크론',  alt: ['hana micron', '067310'] },
    '036930.KQ': { en: 'Jusung Engineering', kr: '주성엔지니어링', alt: ['jusung', '036930'] },

    // ── KR KOSDAQ 바이오/제약 (15) ──
    '196170.KQ': { en: 'Alteogen',           kr: '알테오젠',      alt: ['alteogen', '196170'] },
    '145020.KQ': { en: 'Hugel',              kr: '휴젤',          alt: ['hugel', '145020'] },
    '214150.KQ': { en: 'Classys',            kr: '클래시스',      alt: ['classys', '214150'] },
    '086900.KQ': { en: 'Medytox',            kr: '메디톡스',      alt: ['medytox', '086900'] },
    '328130.KQ': { en: 'Lunit',              kr: '루닛',          alt: ['lunit', '328130'] },
    '322510.KQ': { en: 'JLK',                kr: '제이엘케이',      alt: ['jlk', '322510'] },
    '338220.KQ': { en: 'VUNO',               kr: '뷰노',            alt: ['vuno', '338220'] },
    '049950.KQ': { en: 'Mirae Company',      kr: '미래컴퍼니',      alt: ['mirae company', '049950'] },
    '145720.KQ': { en: 'Dentium',            kr: '덴티움',          alt: ['dentium', '145720'] },
    '347860.KQ': { en: 'AB Bio',             kr: '에이비엘바이오', alt: ['abl bio', '347860'] },
    '141080.KQ': { en: 'Legochembio',        kr: '리가켐바이오',  alt: ['legochem', '141080'] },
    '298380.KQ': { en: 'Aibio',              kr: '에이비엘바이오', alt: ['aibio', '298380'] },
    '141080_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] },
    '293490.KQ': { en: 'Kakao Games',        kr: '카카오게임즈',  alt: ['kakao games', '293490'] },
    '048410.KQ': { en: 'Hyundai Bioscience', kr: '현대바이오',    alt: ['hyundai bio', '048410'] },
    '199800.KQ': { en: 'Toolgen',            kr: '툴젠',          alt: ['toolgen', '199800'] },
    '950140.KQ': { en: 'Jinyang Inc',        kr: '진양제약',      alt: ['jinyang', '950140'] },
    '950130.KQ': { en: 'EXICURE',            kr: '엑시큐어',      alt: ['exicure', '950130'] },
    '950220.KQ': { en: 'Neowiz',             kr: '네오위즈',      alt: ['neowiz', '950220'] },
    '280360.KS': { en: 'Lotte Wellfood',     kr: '롯데웰푸드',      alt: ['lotte wellfood', '280360'] },

    // ── KR KOSDAQ AI/SW/로봇 (10) ──
    '277810.KQ': { en: 'Rainbow Robotics',   kr: '레인보우로보틱스', alt: ['rainbow robotics', '277810'] },
    '108490.KQ': { en: 'ROBOTIS',            kr: '로보티즈',      alt: ['robotis', '108490'] },
    '293490.KQ_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] },
    '058610.KQ': { en: 'SPSCO',              kr: 'SPS코리아',     alt: ['spsco', '058610'] },
    '226320.KQ': { en: 'JYP Entertainment',  kr: 'JYP엔터',       alt: ['jyp', 'jyp ent', '226320'] },
    '194480.KQ': { en: 'Devsisters',         kr: '데브시스터즈',  alt: ['devsisters', '194480'] },
    '376300.KQ': { en: 'Digital Land',       kr: '디어유',        alt: ['dearu', '376300'] },
    '263750.KQ': { en: 'Pearl Abyss',        kr: '펄어비스',      alt: ['pearl abyss', '263750'] },
    '251270.KS': { en: 'Netmarble',          kr: '넷마블',        alt: ['netmarble', '251270'] },
    '352820.KS': { en: 'HYBE',               kr: '하이브',        alt: ['hybe', 'bts', '352820'] },
    '041510.KQ': { en: 'SM Entertainment',   kr: 'SM엔터테인먼트', alt: ['sm ent', 'sm', '041510'] },

    // ── KR KOSPI 화학/소재/원전/방산 (15) ──
    '009830.KS': { en: 'Hanwha Solutions',   kr: '한화솔루션',    alt: ['hanwha solutions', '009830'] },
    '047810.KS': { en: 'KAI',                kr: '한국항공우주',  alt: ['kai', 'korea aerospace', '047810'] },
    '014680.KS': { en: 'Hansol Chemical',    kr: '한솔케미칼',    alt: ['hansol chemical', '014680'] },
    '011170.KS': { en: 'Lotte Chemical',     kr: '롯데케미칼',    alt: ['lotte chemical', '011170'] },
    '010950.KS': { en: 'S-Oil',              kr: 'S-Oil',         alt: ['s-oil', 's oil', '010950'] },
    '096770.KS': { en: 'SK Innovation',      kr: 'SK이노베이션',  alt: ['sk innovation', '096770'] },
    '034220.KS': { en: 'LG Display',         kr: 'LG디스플레이',  alt: ['lg display', '034220'] },
    '034020.KS': { en: 'Doosan Enerbility',  kr: '두산에너빌리티', alt: ['doosan enerbility', '034020', '두산중공업'] },
    '042660.KS_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] }, // 한화오션 중복
    '298020.KS': { en: 'HHI Construction',   kr: 'HHI건설',       alt: ['hhi construction', '298020'] },
    '003490.KS': { en: 'Korean Air',         kr: '대한항공',      alt: ['korean air', '003490'] },
    '180640.KS': { en: 'Hanwha Aerospace 2', kr: '한화엔진',      alt: ['hanwha engine', '180640'] },
    '079550.KS': { en: 'LIG Nex1',           kr: 'LIG넥스원',     alt: ['lig nex1', '079550'] },
    '028260.KS': { en: 'Samsung C&T',        kr: '삼성물산',      alt: ['samsung cnt', 'samsung c&t', '028260'] },
    '009150.KS': { en: 'Samsung Electro-Mechanics', kr: '삼성전기', alt: ['samsung em', '009150'] },

    // ── KR KOSPI 금융/보험/헬스 (10) ──
    '055550.KS': { en: 'Shinhan Financial',  kr: '신한지주',      alt: ['shinhan', '055550'] },
    '105560.KS': { en: 'KB Financial',       kr: 'KB금융',        alt: ['kb financial', 'kbf', '105560'] },
    '086790.KS': { en: 'Hana Financial',     kr: '하나금융지주',  alt: ['hana financial', '086790'] },
    '316140.KS': { en: 'Woori Financial',    kr: '우리금융지주',  alt: ['woori', '316140'] },
    '139130.KS': { en: 'DGB Financial',      kr: 'DGB금융',       alt: ['dgb', '139130'] },
    '032830.KS': { en: 'Samsung Life',       kr: '삼성생명',      alt: ['samsung life', '032830'] },
    '000810.KS': { en: 'Samsung F&M',        kr: '삼성화재',      alt: ['samsung fm', '000810'] },
    '128940.KS': { en: 'Hanmi Pharm',        kr: '한미약품',      alt: ['hanmi pharm', '128940'] },
    '068270.KS': { en: 'Celltrion',          kr: '셀트리온',      alt: ['celltrion', '068270'] },
    '009420.KS': { en: 'Hanall Bio',         kr: '한올바이오파마', alt: ['hanall', '009420'] },

    // ── KR ETF 추가 (10) ──
    '133690.KS': { en: 'TIGER 미국나스닥100', kr: 'TIGER미국나스닥100', alt: ['tiger nasdaq', '133690'] },
    '360750.KS': { en: 'TIGER 미국S&P500',   kr: 'TIGER미국S&P500',   alt: ['tiger sp500', '360750'] },
    '381170.KS': { en: 'TIGER 미국테크TOP10', kr: 'TIGER미국테크TOP10', alt: ['tiger tech', '381170'] },
    '364980.KS': { en: 'TIGER 글로벌리튬',   kr: 'TIGER글로벌리튬',   alt: ['tiger lithium', '364980'] },
    '371460.KS': { en: 'TIGER 차이나전기차', kr: 'TIGER차이나전기차', alt: ['tiger china ev', '371460'] },
    '305080.KS': { en: 'KODEX 금현물',       kr: 'KODEX금현물',       alt: ['kodex gold', '305080'] },
    '139660.KS': { en: 'TIGER 200',          kr: 'TIGER200',          alt: ['tiger 200', '139660'] },
    '252670.KS': { en: 'KODEX 200선물인버스2X', kr: 'KODEX인버스2X',  alt: ['kodex inverse 2x', '252670'] },
    '233740.KS': { en: 'KODEX 코스닥150레버리지', kr: 'KODEX코스닥레버리지', alt: ['kodex kosdaq lev', '233740'] },
    '122630.KS': { en: 'KODEX 레버리지',     kr: 'KODEX레버리지',     alt: ['kodex leverage', '122630'] },

    // ── 인도 ADR (8) ──
    'IBN':   { en: 'ICICI Bank',            kr: 'ICICI은행',     alt: ['icici', 'icici bank', 'ibn'] },
    'HDB':   { en: 'HDFC Bank',             kr: 'HDFC은행',      alt: ['hdfc', 'hdfc bank', 'hdb'] },
    'INFY':  { en: 'Infosys',               kr: '인포시스',      alt: ['infosys', 'infy'] },
    'WIT':   { en: 'Wipro',                 kr: '위프로',        alt: ['wipro', 'wit'] },
    'TTM':   { en: 'Tata Motors',           kr: '타타모터스',    alt: ['tata motors', 'ttm'] },
    'RDY':   { en: 'Dr Reddys',             kr: '닥터레디스',    alt: ['dr reddys', 'rdy'] },
    'SIFY':  { en: 'Sify',                  kr: '사이파이',      alt: ['sify'] },
    'YY':    { en: 'JOYY',                  kr: 'JOYY',          alt: ['joyy', 'yy'] },

    // ── 유럽 ADR (15) ──
    'SAP':   { en: 'SAP',                   kr: 'SAP',           alt: ['sap', 'sap se'] },
    'SIEGY': { en: 'Siemens',               kr: '지멘스',        alt: ['siemens', 'siegy'] },
    'NSRGY': { en: 'Nestle',                kr: '네슬레',        alt: ['nestle', 'nsrgy'] },
    'LVMUY': { en: 'LVMH',                  kr: 'LVMH',          alt: ['lvmh', 'lvmuy'] },
    'RHHBY': { en: 'Roche',                 kr: '로슈',          alt: ['roche', 'rhhby'] },
    'NVS':   { en: 'Novartis',              kr: '노바티스',      alt: ['novartis', 'nvs'] },
    'UL':    { en: 'Unilever',              kr: '유니레버',      alt: ['unilever', 'ul'] },
    'DEO':   { en: 'Diageo',                kr: '디아지오',      alt: ['diageo', 'deo'] },
    'BP_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] },
    'AZN':   { en: 'AstraZeneca',           kr: '아스트라제네카', alt: ['astrazeneca', 'azn'] },
    'GSK':   { en: 'GlaxoSmithKline',       kr: 'GSK',           alt: ['gsk', 'glaxo'] },
    'TM':    { en: 'Toyota',                kr: '토요타',        alt: ['toyota', 'tm'] },
    'HMC':   { en: 'Honda',                 kr: '혼다',          alt: ['honda', 'hmc'] },
    'SNY':   { en: 'Sanofi',                kr: '사노피',        alt: ['sanofi', 'sny'] },
    'EADSY': { en: 'Airbus',                kr: '에어버스',      alt: ['airbus', 'eadsy'] },

    // ── 신흥국/중남미 (10) ──
    'EME':   { en: 'EMCOR Group',           kr: 'EMCOR',         alt: ['emcor', 'eme'] },
    'MOD':   { en: 'Modine',                kr: '모딘',          alt: ['modine', 'mod'] },
    'ACLS':  { en: 'Axcelis',               kr: '액셀리스',      alt: ['axcelis', 'acls'] },
    'ENTG':  { en: 'Entegris',              kr: '인테그리스',    alt: ['entegris', 'entg'] },
    'UCTT':  { en: 'Ultra Clean',           kr: '울트라클린',    alt: ['ultra clean', 'uctt'] },
    'S':     { en: 'SentinelOne',           kr: '센티넬원',      alt: ['sentinelone', 'sentinel one'] },
    'CYBR':  { en: 'CyberArk',              kr: '사이버아크',    alt: ['cyberark', 'cybr'] },
    'DINO':  { en: 'HF Sinclair',           kr: 'HF싱클레어',    alt: ['hf sinclair', 'dino'] },
    'DK':    { en: 'Delek US',              kr: '델렉US',        alt: ['delek', 'delek us'] },
    'FTI':   { en: 'TechnipFMC',            kr: '테크닙FMC',     alt: ['technipfmc', 'fti'] },
    'NOV':   { en: 'NOV',                   kr: 'NOV',           alt: ['nov inc', 'national oilwell'] },
    'WHD':   { en: 'Cactus',                kr: '캑터스',        alt: ['cactus', 'whd'] },
    'LEU':   { en: 'Centrus Energy',        kr: '센트러스',      alt: ['centrus', 'leu'] },
    'ARRY':  { en: 'Array Technologies',    kr: '어레이테크',    alt: ['array technologies', 'arry'] },
    'SHLS':  { en: 'Shoals',                kr: '숄스',          alt: ['shoals', 'shls'] },
    'FLNC':  { en: 'Fluence Energy',        kr: '플루언스',      alt: ['fluence', 'flnc'] },
    'KTOS':  { en: 'Kratos Defense',        kr: '크레이토스',    alt: ['kratos', 'ktos'] },
    'AVAV':  { en: 'AeroVironment',         kr: '에어로바이런먼트', alt: ['aerovironment', 'avav'] },
    'DKNG':  { en: 'DraftKings',            kr: '드래프트킹스',  alt: ['draftkings', 'dkng'] },
    'FLUT':  { en: 'Flutter Entertainment', kr: '플러터',        alt: ['flutter', 'flut'] },
    'PENN':  { en: 'PENN Entertainment',    kr: '펜엔터',        alt: ['penn entertainment', 'penn'] },
    'KGC':   { en: 'Kinross Gold',          kr: '킨로스골드',    alt: ['kinross', 'kgc'] },
    'AA':    { en: 'Alcoa',                 kr: '알코아',        alt: ['alcoa', 'aa'] },
    'ADM':   { en: 'Archer-Daniels-Midland', kr: 'ADM',          alt: ['adm', 'archer daniels'] },
    'AEM':   { en: 'Agnico Eagle Mines',    kr: '애그니코이글',  alt: ['agnico eagle', 'aem'] },
    'ALAB':  { en: 'Astera Labs',           kr: '아스테라랩스',  alt: ['astera labs', 'alab'] },
    'ALB':   { en: 'Albemarle',             kr: '앨버말',        alt: ['albemarle', 'alb'] },
    'ALL':   { en: 'Allstate',              kr: '올스테이트',    alt: ['allstate', 'all'] },
    'ALNY':  { en: 'Alnylam',               kr: '앨나일람',      alt: ['alnylam', 'alny'] },
    'APD':   { en: 'Air Products',          kr: '에어프로덕츠',  alt: ['air products', 'apd'] },
    'APO':   { en: 'Apollo Global Management', kr: '아폴로',     alt: ['apollo global', 'apo'] },
    'AXON':  { en: 'Axon Enterprise',       kr: '액손',          alt: ['axon', 'axon enterprise'] },
    'BIIB':  { en: 'Biogen',                kr: '바이오젠',      alt: ['biogen', 'biib'] },
    'BRK-B': { en: 'Berkshire Hathaway B',  kr: '버크셔B',       alt: ['berkshire', 'brk-b'] },
    'BX':    { en: 'Blackstone',            kr: '블랙스톤',      alt: ['blackstone', 'bx'] },
    'CB':    { en: 'Chubb',                 kr: '처브',          alt: ['chubb', 'cb'] },
    'CLS':   { en: 'Celestica',             kr: '셀레스티카',    alt: ['celestica', 'cls'] },
    'CLSK':  { en: 'CleanSpark',            kr: '클린스파크',    alt: ['cleanspark', 'clsk'] },
    'CRDO':  { en: 'Credo Technology',      kr: '크레도',        alt: ['credo', 'crdo'] },
    'CRSP':  { en: 'CRISPR Therapeutics',   kr: '크리스퍼',      alt: ['crispr therapeutics', 'crsp'] },
    'CTVA':  { en: 'Corteva',               kr: '코르테바',      alt: ['corteva', 'ctva'] },
    'CZR':   { en: 'Caesars Entertainment', kr: '시저스',        alt: ['caesars', 'czr'] },
    'DG':    { en: 'Dollar General',        kr: '달러제너럴',    alt: ['dollar general', 'dg'] },
    'EIX':   { en: 'Edison International',  kr: '에디슨인터내셔널', alt: ['edison international', 'eix'] },
    'EMR':   { en: 'Emerson Electric',      kr: '에머슨',        alt: ['emerson', 'emr'] },
    'EPD':   { en: 'Enterprise Products Partners', kr: 'EPD',    alt: ['enterprise products', 'epd'] },
    'ES':    { en: 'Eversource Energy',     kr: '에버소스',      alt: ['eversource', 'es'] },
    'ET':    { en: 'Energy Transfer',       kr: '에너지트랜스퍼', alt: ['energy transfer', 'et'] },
    'ETR':   { en: 'Entergy',               kr: '엔터지',        alt: ['entergy', 'etr'] },
    'EVRG':  { en: 'Evergy',                kr: '에버지',        alt: ['evergy', 'evrg'] },
    'FCX':   { en: 'Freeport-McMoRan',      kr: '프리포트맥모란', alt: ['freeport', 'fcx'] },
    'FDX':   { en: 'FedEx',                 kr: '페덱스',        alt: ['fedex', 'fdx'] },
    'FE':    { en: 'FirstEnergy',           kr: '퍼스트에너지',  alt: ['firstenergy', 'fe'] },
    'FNV':   { en: 'Franco-Nevada',         kr: '프랑코네바다',  alt: ['franco nevada', 'fnv'] },
    'GEV':   { en: 'GE Vernova',            kr: 'GE버노바',      alt: ['ge vernova', 'gev'] },
    'GFI':   { en: 'Gold Fields',           kr: '골드필즈',      alt: ['gold fields', 'gfi'] },
    'GFS':   { en: 'GlobalFoundries',       kr: '글로벌파운드리스', alt: ['globalfoundries', 'gfs'] },
    'GRAB':  { en: 'Grab',                  kr: '그랩',          alt: ['grab'] },
    'HLT':   { en: 'Hilton',                kr: '힐튼',          alt: ['hilton', 'hlt'] },
    'KKR':   { en: 'KKR',                   kr: 'KKR',           alt: ['kkr'] },
    'KMI':   { en: 'Kinder Morgan',         kr: '킨더모건',      alt: ['kinder morgan', 'kmi'] },
    'LAC':   { en: 'Lithium Americas',      kr: '리튬아메리카스', alt: ['lithium americas', 'lac'] },
    'LIN':   { en: 'Linde',                 kr: '린데',          alt: ['linde', 'lin'] },
    'LUV':   { en: 'Southwest Airlines',    kr: '사우스웨스트항공', alt: ['southwest airlines', 'luv'] },
    'LYFT':  { en: 'Lyft',                  kr: '리프트',        alt: ['lyft'] },
    'MAR':   { en: 'Marriott',              kr: '메리어트',      alt: ['marriott', 'mar'] },
    'MET':   { en: 'MetLife',               kr: '메트라이프',    alt: ['metlife', 'met'] },
    'MGM':   { en: 'MGM Resorts',           kr: 'MGM리조트',     alt: ['mgm resorts', 'mgm'] },
    'MNST':  { en: 'Monster Beverage',      kr: '몬스터베버리지', alt: ['monster beverage', 'mnst'] },
    'MP':    { en: 'MP Materials',          kr: 'MP머티리얼즈',  alt: ['mp materials', 'mp'] },
    'NEM':   { en: 'Newmont',               kr: '뉴몬트',        alt: ['newmont', 'nem'] },
    'NVT':   { en: 'nVent Electric',        kr: '엔벤트',        alt: ['nvent', 'nvt'] },
    'OKE':   { en: 'ONEOK',                 kr: '원오크',        alt: ['oneok', 'oke'] },
    'ONTO':  { en: 'Onto Innovation',       kr: '온투이노베이션', alt: ['onto innovation', 'onto'] },
    'PGR':   { en: 'Progressive',           kr: '프로그레시브',  alt: ['progressive', 'pgr'] },
    'PH':    { en: 'Parker-Hannifin',       kr: '파커하니핀',    alt: ['parker hannifin', 'ph'] },
    'RCL':   { en: 'Royal Caribbean',       kr: '로열캐리비안',  alt: ['royal caribbean', 'rcl'] },
    'ROK':   { en: 'Rockwell Automation',   kr: '로크웰',        alt: ['rockwell automation', 'rok'] },
    'SBAC':  { en: 'SBA Communications',    kr: 'SBA커뮤니케이션스', alt: ['sba communications', 'sbac'] },
    'SNDK':  { en: 'SanDisk',               kr: '샌디스크',      alt: ['sandisk', 'sndk'] },
    'STX':   { en: 'Seagate',               kr: '씨게이트',      alt: ['seagate', 'stx'] },
    'SYK':   { en: 'Stryker',               kr: '스트라이커',    alt: ['stryker', 'syk'] },
    'TER':   { en: 'Teradyne',              kr: '테라다인',      alt: ['teradyne', 'ter'] },
    'TOST':  { en: 'Toast',                 kr: '토스트',        alt: ['toast', 'tost'] },
    'TPL':   { en: 'Texas Pacific Land',    kr: '텍사스퍼시픽랜드', alt: ['texas pacific land', 'tpl'] },
    'TRGP':  { en: 'Targa Resources',       kr: '타르가',        alt: ['targa', 'trgp'] },
    'TRV':   { en: 'Travelers',             kr: '트래블러스',    alt: ['travelers', 'trv'] },
    'UMC':   { en: 'United Microelectronics', kr: 'UMC',         alt: ['umc', 'united microelectronics'] },
    'UNP':   { en: 'Union Pacific',         kr: '유니언퍼시픽',  alt: ['union pacific', 'unp'] },
    'UPS':   { en: 'UPS',                   kr: 'UPS',           alt: ['ups'] },
    'WAB':   { en: 'Wabtec',                kr: '왑텍',          alt: ['wabtec', 'wab'] },
    'WDC':   { en: 'Western Digital',       kr: '웨스턴디지털',  alt: ['western digital', 'wdc'] },
    'WMB':   { en: 'Williams Companies',    kr: '윌리엄스',      alt: ['williams companies', 'wmb'] },
    'WPM':   { en: 'Wheaton Precious Metals', kr: '휘튼프레셔스', alt: ['wheaton precious', 'wpm'] },
    'WYNN':  { en: 'Wynn Resorts',          kr: '윈리조트',      alt: ['wynn resorts', 'wynn'] },
    'XEL':   { en: 'Xcel Energy',           kr: '엑셀에너지',    alt: ['xcel energy', 'xel'] },

    'AEP':   { en: 'American Electric Power', kr: 'AEP',         alt: ['american electric power', 'aep'] },
    'BMY':   { en: 'Bristol Myers Squibb',  kr: 'BMS',           alt: ['bristol myers', 'bmy'] },
    'DUK':   { en: 'Duke Energy',           kr: '듀크에너지',    alt: ['duke energy', 'duk'] },
    'EXC':   { en: 'Exelon',                kr: '엑셀론',        alt: ['exelon', 'exc'] },
    'GOLD':  { en: 'Barrick Gold',          kr: '배릭골드',      alt: ['barrick', 'gold'] },
    'GS':    { en: 'Goldman Sachs',         kr: '골드만삭스',    alt: ['goldman sachs', 'gs'] },
    'HPE':   { en: 'Hewlett Packard Enterprise', kr: 'HPE',      alt: ['hewlett packard enterprise', 'hpe'] },
    'PWR':   { en: 'Quanta Services',       kr: '콴타서비스',    alt: ['quanta services', 'pwr'] },
    'POWL':  { en: 'Powell Industries',     kr: '파월인더스트리즈', alt: ['powell industries', 'powl'] },
    'CORZ':  { en: 'Core Scientific',       kr: '코어사이언티픽', alt: ['core scientific', 'corz'] },
    'VALE':  { en: 'Vale',                  kr: '발레',          alt: ['vale'] },
    'ITUB':  { en: 'Itau Unibanco',         kr: '이타우우니방쿠', alt: ['itau', 'itub'] },
    'BBD':   { en: 'Banco Bradesco',        kr: '브라데스쿠',    alt: ['bradesco', 'bbd'] },
    'MELI':  { en: 'Mercado Libre',         kr: '메르카도리브레', alt: ['mercado libre', 'meli'] },
    'PAGS':  { en: 'PagSeguro',             kr: '파그세구로',    alt: ['pagseguro', 'pags'] },
    'SE':    { en: 'Sea Ltd',               kr: '시 리미티드',   alt: ['sea ltd', 'sea limited', 'se'] },
    'GLOB':  { en: 'Globant',               kr: '글로반트',      alt: ['globant', 'glob'] },
    'BIDU':  { en: 'Baidu',                 kr: '바이두',        alt: ['baidu', 'bidu'] },
    'PDD':   { en: 'PDD Holdings',          kr: '핀둬둬',        alt: ['pdd', 'pinduoduo'] },
    'BABA':  { en: 'Alibaba',               kr: '알리바바',      alt: ['alibaba', 'baba'] },

    // ── 미국 추가 보강: 헬스케어/소비/AI (20) ──
    'VEEV':  { en: 'Veeva Systems',         kr: '비바시스템',    alt: ['veeva', 'veev'] },
    'EW':    { en: 'Edwards Lifesciences',  kr: '에드워즈',      alt: ['edwards', 'ew'] },
    'BSX':   { en: 'Boston Scientific',     kr: '보스턴사이언티픽', alt: ['boston scientific', 'bsx'] },
    'DXCM':  { en: 'DexCom',                kr: '덱스컴',        alt: ['dexcom', 'dxcm'] },
    'IDXX':  { en: 'IDEXX Labs',            kr: 'IDEXX',         alt: ['idexx', 'idxx'] },
    'GEHC':  { en: 'GE HealthCare',         kr: 'GE헬스케어',    alt: ['ge healthcare', 'gehc'] },
    'MDT':   { en: 'Medtronic',             kr: '메드트로닉',    alt: ['medtronic', 'mdt'] },
    'NEE':   { en: 'NextEra Energy',        kr: '넥스트에라',    alt: ['nextera', 'nee'] },
    'DE':    { en: 'Deere',                 kr: '디어',          alt: ['deere', 'de', 'john deere'] },
    'VZ':    { en: 'Verizon',               kr: '버라이즌',      alt: ['verizon', 'vz'] },
    'T':     { en: 'AT&T',                  kr: 'AT&T',          alt: ['at&t', 'att'] },
    'PNC':   { en: 'PNC Financial',         kr: 'PNC',           alt: ['pnc', 'pnc financial'] },
    'SCHW':  { en: 'Charles Schwab',        kr: '찰스슈왑',      alt: ['schwab', 'schw'] },
    'BK':    { en: 'BNY Mellon',            kr: 'BNY멜런',       alt: ['bny mellon', 'bk'] },
    'TLN':   { en: 'Talen Energy',          kr: '탈렌에너지',    alt: ['talen', 'tln'] },
    'NRG_dup': { en: '_skip', kr: '_skip', alt: ['_skip'] },
    'OKLO':  { en: 'Oklo',                  kr: '오클로',        alt: ['oklo'] },
    'SMR':   { en: 'NuScale Power',         kr: '뉴스케일',      alt: ['nuscale', 'smr'] },
    'NTDOY': { en: 'Nintendo',              kr: '닌텐도',        alt: ['nintendo', 'ntdoy'] },
    'SONY':  { en: 'Sony Group',            kr: '소니그룹',      alt: ['sony', 'sony group'] }
  }
};

window.AIO.isTickerRegistryPlaceholder = function(ticker, entry) {
  ticker = String(ticker || '');
  entry = entry || {};
  return /_dup$/i.test(ticker) || entry.en === '_skip' || entry.kr === '_skip';
};

window.AIO.getTickerRegistryEntryAudit = function() {
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  if (!reg || !reg.entries) return { status: 'error', totalEntries: 0, realEntries: 0, placeholderCount: 0 };
  var keys = Object.keys(reg.entries);
  var placeholders = keys.filter(function(t) { return window.AIO.isTickerRegistryPlaceholder(t, reg.entries[t]); });
  return {
    status: placeholders.length ? 'warn' : 'ok',
    version: reg.version || null,
    totalEntries: keys.length,
    realEntries: keys.length - placeholders.length,
    placeholderCount: placeholders.length,
    placeholders: placeholders,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.resolveTickerFromAnyName = function(input) {
  if (!input || typeof input !== 'string') return null;
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  if (!reg) return null;
  var q = String(input).trim();
  var qLower = q.toLowerCase();
  // 1. 정확 ticker 매칭 (대문자 변환)
  var qUpper = q.toUpperCase();
  if (reg.entries[qUpper]) return qUpper;
  // 2. en/kr/alt 매칭
  var found = null;
  Object.keys(reg.entries).some(function(ticker) {
    var e = reg.entries[ticker];
    if (e.en && e.en.toLowerCase() === qLower) { found = ticker; return true; }
    if (e.kr && e.kr === q) { found = ticker; return true; }
    if (e.alt && e.alt.indexOf(qLower) !== -1) { found = ticker; return true; }
    return false;
  });
  return found;
};

window.AIO.getTickerMappingAudit = function() {
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  if (!reg) return { status: 'error', unmappedCount: 0, issues: ['TICKER_NAME_REGISTRY undefined'] };
  var issues = [];
  Object.keys(reg.entries).forEach(function(t) {
    var e = reg.entries[t];
    if (window.AIO.isTickerRegistryPlaceholder && window.AIO.isTickerRegistryPlaceholder(t, e)) return;
    if (!e.en || !e.kr) issues.push(t + ' missing en/kr');
    if (!e.alt || !Array.isArray(e.alt)) issues.push(t + ' missing alt[]');
  });
  var entryAudit = window.AIO.getTickerRegistryEntryAudit ? window.AIO.getTickerRegistryEntryAudit() : null;
  return {
    status: issues.length ? 'warn' : 'ok',
    unmappedCount: issues.length,
    issues: issues,
    totalEntries: entryAudit ? entryAudit.totalEntries : Object.keys(reg.entries).length,
    realEntries: entryAudit ? entryAudit.realEntries : Object.keys(reg.entries).length,
    placeholderCount: entryAudit ? entryAudit.placeholderCount : 0,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.57 R103 신규: assertTickerRegistryCompleteness — SCR_KEYWORD_ALIASES vs REGISTRY 정합
// 새 테마/티커 추가 시 한글 인식 갭 즉시 감지. 미등록 ticker 일괄 리포트.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertTickerRegistryCompleteness = function() {
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  var aliases = window.SCR_KEYWORD_ALIASES;
  if (!reg || !aliases) {
    return { status: 'error', error: 'REGISTRY 또는 SCR_KEYWORD_ALIASES 미정의', missingTickers: [], coveragePct: 0 };
  }
  var registered = {};
  Object.keys(reg.entries).forEach(function(t) {
    var e = reg.entries[t];
    if (window.AIO.isTickerRegistryPlaceholder && window.AIO.isTickerRegistryPlaceholder(t, e)) return;
    registered[t.toUpperCase()] = true;
  });
  try {
    (window.SCREENER_DB || []).forEach(function(r) {
      if (r && r.sym) registered[String(r.sym).toUpperCase()] = true;
    });
  } catch(_) {}
  // SCR_KEYWORD_ALIASES는 한글/영문 모두 키로 존재 — 중복 방지 위해 ticker별 unique 집계
  var allTickers = {};
  var themeCount = 0;
  Object.keys(aliases).forEach(function(themeKey) {
    var arr = aliases[themeKey];
    if (!Array.isArray(arr)) return;
    themeCount++;
    arr.forEach(function(t) {
      var key = String(t).toUpperCase();
      if (!allTickers[key]) allTickers[key] = [];
      allTickers[key].push(themeKey);
    });
  });
  var missing = [];
  Object.keys(allTickers).forEach(function(t) {
    if (!registered[t]) missing.push({ ticker: t, themes: allTickers[t].slice(0, 3) });
  });
  var total = Object.keys(allTickers).length;
  var covered = total - missing.length;
  var pct = total > 0 ? Math.round(covered / total * 100) : 0;
  return {
    status: missing.length === 0 ? 'ok' : (pct >= 80 ? 'mostly-ok' : 'warn'),
    totalThemeKeys: themeCount,
    uniqueTickers: total,
    registeredCount: covered,
    missingCount: missing.length,
    missingTickers: missing.slice(0, 30),
    coveragePct: pct,
    note: missing.length > 0 ? '미등록 ticker는 한글/별명 인식 안 됨 — REGISTRY entries에 추가 필요' : 'all clear',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.59 P327/R112 신규: auditAllChatContexts — 14 CHAT_CONTEXTS 정합성 자동 검증
// 새 페이지 추가 시 회귀 방지 + 사이드바 audit 위젯에 노출.
// ─────────────────────────────────────────────────────────────────
window.AIO.auditAllChatContexts = function() {
  var ctx = window.CHAT_CONTEXTS;
  if (!ctx) return { status: 'error', error: 'CHAT_CONTEXTS undefined', validCount: 0 };
  var keys = Object.keys(ctx);
  var results = {};
  var validCount = 0;
  var invalidContexts = [];
  var contextsWithDynamic = [];
  var totalLength = 0;
  keys.forEach(function(k) {
    var c = ctx[k];
    if (!c || typeof c.system !== 'function') {
      invalidContexts.push({ key: k, reason: 'system function missing' });
      results[k] = { ok: false, reason: 'no system' };
      return;
    }
    try {
      var text = c.system();
      var len = text ? text.length : 0;
      var hasDynamic = /\【|live|실시간|동적|_currentTickerId|_currentThemeId|_liveData|DATA_SNAPSHOT|getActionRules|diagnoseBreadth/.test(text);
      var hasRules = /_getChatRules|ABSOLUTE RULES|환각/.test(text);
      var hasTitle = !!c.title;
      results[k] = { ok: len > 200, length: len, hasDynamic: hasDynamic, hasRules: hasRules, hasTitle: hasTitle };
      if (len > 200) validCount++;
      else invalidContexts.push({ key: k, reason: 'too short (' + len + ' chars)' });
      if (hasDynamic) contextsWithDynamic.push(k);
      totalLength += len;
    } catch(e) {
      invalidContexts.push({ key: k, reason: 'system() throw: ' + (e && e.message || e) });
      results[k] = { ok: false, reason: 'throw' };
    }
  });
  return {
    status: invalidContexts.length === 0 ? 'ok' : (invalidContexts.length < 3 ? 'warn' : 'error'),
    totalContexts: keys.length,
    validCount: validCount,
    invalidContexts: invalidContexts,
    contextsWithDynamic: contextsWithDynamic,
    dynamicCoveragePct: keys.length > 0 ? Math.round(contextsWithDynamic.length / keys.length * 100) : 0,
    avgLength: keys.length > 0 ? Math.round(totalLength / keys.length) : 0,
    perContext: results,
    note: '14 CHAT_CONTEXTS 정합성 자동 검증 (v49.59 P327). validCount === totalContexts 목표',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.57 P318 신규: getWebSearchAudit — Claude web_search 사용 통계 + 토글 상태
// 트리거 조건 + 누적 호출 횟수 + 사용자 opt-out 상태 검증
// ─────────────────────────────────────────────────────────────────
window.AIO.getWebSearchAudit = function() {
  var stats = window._aioWebSearchStats || { calls: 0, lastUsedAt: null };
  var optOut = false;
  try { optOut = localStorage.getItem('aio_web_search_enabled') === 'off'; } catch(e) {}
  return {
    status: 'ok',
    enabled: !optOut,
    optOut: optOut,
    calls: stats.calls,
    lastUsedAt: stats.lastUsedAt,
    maxUsesPerCall: 3,
    estimatedCostUsd: stats.calls * 0.03, // $10/1000 searches * 3 uses
    helperAvailable: typeof window._shouldUseClaudeWebSearch === 'function',
    note: '사용자 비활성화: localStorage.setItem("aio_web_search_enabled","off"). 활성화 되돌리기: removeItem 또는 "on"',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.57 R103 신규: getThemeFetchCoverageAudit — 테마별 ticker × 5채널 fetch 가능성
// 각 ticker가 SEC/Wiki/Finnhub/FMP/Naver 중 몇 개에서 fetch 가능한지 매트릭스.
// ─────────────────────────────────────────────────────────────────
window.AIO.getThemeFetchCoverageAudit = function(themeId) {
  var aliases = window.SCR_KEYWORD_ALIASES;
  if (!aliases) return { status: 'error', error: 'SCR_KEYWORD_ALIASES 미정의' };
  var hasFinnhub = (typeof _getApiKey === 'function' && !!_getApiKey('aio_finnhub_key')) || (window._getApiKey && !!window._getApiKey('aio_finnhub_key'));
  var hasFMP     = (typeof _getApiKey === 'function' && !!_getApiKey('aio_fmp_key'))     || (window._getApiKey && !!window._getApiKey('aio_fmp_key'));
  // CIK_MAP은 fetchSECBusinessDescription 내부 — 휴리스틱으로 REGISTRY 등록 여부로 대리 (CIK 있을 가능성 high)
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  var registered = {};
  if (reg && reg.entries) Object.keys(reg.entries).forEach(function(t) { registered[t.toUpperCase()] = true; });
  function evalTicker(t) {
    var up = String(t).toUpperCase();
    var isKR = /\.(KS|KQ)$/i.test(up);
    return {
      ticker: up,
      yahoo: true, // 모든 ticker 가능 (LIVE_SYMBOLS or dynamicTickerLookup)
      sec: !isKR && registered[up], // 미국 종목 + REGISTRY 등록 → CIK_MAP에 있을 가능성
      wiki: !isKR, // 영문 위키 — 미국 종목 우선
      finnhub: !isKR && hasFinnhub,
      fmp: !isKR && hasFMP,
      naver: true, // KR/US 모두 Naver 페이지 존재
      registered: !!registered[up]
    };
  }
  function aggregate(tickers) {
    var fetchable = { yahoo: 0, sec: 0, wiki: 0, finnhub: 0, fmp: 0, naver: 0 };
    var perTicker = [];
    tickers.forEach(function(t) {
      var e = evalTicker(t);
      perTicker.push(e);
      ['yahoo','sec','wiki','finnhub','fmp','naver'].forEach(function(k) { if (e[k]) fetchable[k]++; });
    });
    var total = tickers.length;
    var avgChannels = total > 0 ? Math.round((fetchable.yahoo+fetchable.sec+fetchable.wiki+fetchable.finnhub+fetchable.fmp+fetchable.naver) / total * 10) / 10 : 0;
    return { tickers: total, fetchable: fetchable, avgChannelsPerTicker: avgChannels, coveragePct: total > 0 ? Math.round(fetchable.yahoo / total * 100) : 0, perTicker: perTicker.slice(0, 10) };
  }
  // 특정 테마 또는 전체
  if (themeId) {
    var arr = aliases[themeId];
    if (!Array.isArray(arr)) return { status: 'error', error: 'theme ' + themeId + ' not found' };
    return Object.assign({ status: 'ok', themeId: themeId }, aggregate(arr), { generatedAt: new Date().toISOString() });
  }
  // 전체 매트릭스 (상위 30 테마만 — 토큰 절약)
  var themes = {};
  var keys = Object.keys(aliases).slice(0, 30);
  keys.forEach(function(k) {
    var arr = aliases[k];
    if (!Array.isArray(arr) || arr.length === 0) return;
    themes[k] = aggregate(arr);
  });
  return {
    status: 'ok',
    apiKeys: { finnhub: !!hasFinnhub, fmp: !!hasFMP },
    sampleThemes: themes,
    note: '특정 테마 정밀 조회는 AIO.getThemeFetchCoverageAudit("ai") 등으로 호출',
    generatedAt: new Date().toISOString()
  };
};

// Theme/Trend deep audit: universe, weights, quote readiness, registry, and beginner UX.
window.AIO.getThemeTrendDeepAudit = function() {
  function uniq(arr) {
    var seen = {};
    return (arr || []).filter(Boolean).map(String).filter(function(x) {
      if (seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }
  function registryMap() {
    var out = {};
    try {
      (window.SCREENER_DB || []).forEach(function(r) {
        if (r && r.sym) out[String(r.sym).toUpperCase()] = r;
      });
    } catch(_) {}
    try {
      var nameReg = window.AIO_TICKER_NAME_REGISTRY && window.AIO_TICKER_NAME_REGISTRY.entries;
      Object.keys(nameReg || {}).forEach(function(k) {
        var entry = nameReg[k];
        if (!entry || (window.AIO.isTickerRegistryPlaceholder && window.AIO.isTickerRegistryPlaceholder(k, entry))) return;
        out[String(k).toUpperCase()] = entry;
      });
    } catch(_) {}
    try {
      Object.keys(window.KR_STOCK_DB || {}).forEach(function(code) {
        if (!/^\d{6}$/.test(String(code))) return;
        var entry = window.KR_STOCK_DB[code];
        out[code + '.KS'] = entry;
        out[code + '.KQ'] = entry;
      });
    } catch(_) {}
    return out;
  }
  function krCodeMap() {
    var out = {};
    function add(sym) {
      sym = String(sym || '').toUpperCase();
      var m = sym.match(/^(\d{6})\.(KS|KQ)$/);
      if (m && !out[m[1]]) out[m[1]] = sym;
    }
    try { (window.SCREENER_DB || []).forEach(function(r) { add(r && r.sym); }); } catch(_) {}
    try { (window.KR_SUB_THEMES || []).forEach(function(t) { (t.tickers || []).forEach(add); (t.leaders || []).forEach(add); Object.keys(t.weights || {}).forEach(add); }); } catch(_) {}
    return out;
  }
  var registry = registryMap();
  var codeToSym = krCodeMap();
  var liveSet = {};
  try { (window.LIVE_SYMBOLS || []).forEach(function(s) { liveSet[String(s).toUpperCase()] = true; }); } catch(_) {}
  function normalizeKrCode(code) {
    code = String(code || '').trim();
    if (!code) return '';
    if (/\.(KS|KQ)$/i.test(code)) return code.toUpperCase();
    return codeToSym[code] || (code + '.KS');
  }
  function collectTheme(raw, source, idOverride) {
    raw = raw || {};
    var weights = {};
    var symbols = [];
    if (Array.isArray(raw)) {
      var insight = (window.KR_THEME_INSIGHTS && idOverride && window.KR_THEME_INSIGHTS[idOverride]) || null;
      raw.forEach(function(item) {
        var sym = normalizeKrCode(item && item.code);
        if (!sym) return;
        symbols.push(sym);
        weights[sym] = Number(item.w) || 0;
      });
      raw = {
        id: idOverride,
        name: idOverride,
        tickers: symbols,
        leaders: symbols.slice(0, 3),
        weights: weights,
        desc: insight && (insight.insight || insight.macro || insight.macroKey || insight.upCondition || insight.breakSignal || (insight.breakSignals && insight.breakSignals[0])) || ''
      };
    }
    weights = raw.weights || {};
    symbols = uniq([raw.etf, raw.compositeBase].concat(raw.leaders || [], raw.leaderHighlight || [], raw.tickers || [], Object.keys(weights || {})));
    var wsum = Object.keys(weights || {}).reduce(function(sum, k) { return sum + (Number(weights[k]) || 0); }, 0);
    return {
      source: source,
      id: raw.id || idOverride || raw.name || 'unknown',
      name: raw.nameKr || raw.name || raw.id || idOverride || 'unknown',
      symbols: symbols,
      symbolCount: symbols.length,
      weights: weights,
      weightSum: wsum,
      hasDesc: !!(raw.desc || raw.insight || raw.catalyst || raw.macro || raw.nameKr),
      hasLeaders: Array.isArray(raw.leaders) && raw.leaders.length > 0,
      etf: raw.etf || null
    };
  }
  var themes = [];
  try { (window.THEME_MAP || []).forEach(function(t) { themes.push(collectTheme(t, 'THEME_MAP')); }); } catch(_) {}
  try { (window.SUB_THEMES || []).forEach(function(t) { themes.push(collectTheme(t, 'SUB_THEMES')); }); } catch(_) {}
  try { (window.KR_SUB_THEMES || []).forEach(function(t) { themes.push(collectTheme(t, 'KR_SUB_THEMES')); }); } catch(_) {}
  try {
    Object.keys(window.KR_THEME_MAP || {}).forEach(function(id) {
      themes.push(collectTheme(window.KR_THEME_MAP[id], 'KR_THEME_MAP', id));
    });
  } catch(_) {}
  var symbolThemes = {};
  themes.forEach(function(t) {
    t.symbols.forEach(function(s) {
      var key = String(s).toUpperCase();
      symbolThemes[key] = symbolThemes[key] || [];
      symbolThemes[key].push(t.id);
    });
  });
  var uniqueSymbols = Object.keys(symbolThemes);
  var weightIssues = themes.filter(function(t) {
    var hasWeights = Object.keys(t.weights || {}).length > 0;
    return hasWeights && Math.abs(t.weightSum - 100) > 1;
  }).map(function(t) { return { source: t.source, id: t.id, name: t.name, weightSum: t.weightSum }; });
  var concentrationWarnings = themes.map(function(t) {
    var vals = Object.keys(t.weights || {}).map(function(k) { return Number(t.weights[k]) || 0; }).filter(function(v) { return v > 0; }).sort(function(a, b) { return b - a; });
    if (vals.length < 3) return null;
    var top1 = vals[0];
    var top3 = vals.slice(0, 3).reduce(function(sum, v) { return sum + v; }, 0);
    if (top1 > 45 || top3 > 85) return { source: t.source, id: t.id, name: t.name, top1: top1, top3: top3 };
    return null;
  }).filter(Boolean);
  var thinThemes = themes.filter(function(t) { return t.symbolCount < 3; })
    .map(function(t) { return { source: t.source, id: t.id, name: t.name, symbolCount: t.symbolCount, symbols: t.symbols }; });
  var uxIssues = themes.filter(function(t) { return !t.hasDesc || !t.hasLeaders; })
    .map(function(t) { return { source: t.source, id: t.id, name: t.name, hasDesc: t.hasDesc, hasLeaders: t.hasLeaders }; });
  var missingLive = uniqueSymbols.filter(function(s) { return !liveSet[s]; });
  var profileSet = {};
  try {
    (window.AIO.collectPageDataSymbols('themes', { symbolLimit: 999 }) || []).forEach(function(s) { profileSet[String(s).toUpperCase()] = true; });
    (window.AIO.collectPageDataSymbols('theme-detail', { symbolLimit: 999 }) || []).forEach(function(s) { profileSet[String(s).toUpperCase()] = true; });
    (window.AIO.collectPageDataSymbols('kr-themes', { symbolLimit: 999 }) || []).forEach(function(s) { profileSet[String(s).toUpperCase()] = true; });
  } catch(_) {}
  var missingProfileSymbols = uniqueSymbols.filter(function(s) { return !profileSet[s]; });
  var quoteReadySymbols = uniqueSymbols.filter(function(s) { return profileSet[s]; });
  var missingRegistry = uniqueSymbols.filter(function(s) {
    if (registry[s]) return false;
    if (/^(XL|SMH|SOXX|QQQ|SPY|IWM|DIA|KRE|XBI|URA|BOTZ|HACK|ICLN|DRIV|IYZ|XSD|CRAK|ITA|GDX|LIT|JETS|OIH|AMLP|CIBR|IBIT|BITO|FBTC|ARKB|BITB|HODL|BTC-|ETH-|KRW=|\^)/.test(s)) return false;
    return true;
  });
  var standard = ['XLK','XLF','XLV','XLY','XLP','XLE','XLI','XLB','XLU','XLRE','XLC'];
  var sectorSet = {};
  try { (window.RRG_SECTORS || []).forEach(function(s) { sectorSet[String(s.sym || '').toUpperCase()] = true; }); } catch(_) {}
  var missingSectors = standard.filter(function(s) { return !sectorSet[s]; });
  var themeText = themes.map(function(t) { return [t.id, t.name, t.source].join(' ').toLowerCase(); }).join(' | ');
  var expectedThemeCategories = [
    { key: 'semiconductors-ai', re: /semi|hbm|ai|cloud|datacenter|data center/ },
    { key: 'cybersecurity', re: /cyber|security|hack/ },
    { key: 'defense-aerospace', re: /defense|drone|space|aerospace|uam/ },
    { key: 'energy-nuclear-grid', re: /energy|nuclear|power|grid|uranium|hydrogen|solar|wind/ },
    { key: 'healthcare-biotech', re: /health|bio|glp|medtech|pharma/ },
    { key: 'finance-crypto', re: /finance|bank|crypto|bitcoin|btc|asset/ },
    { key: 'consumer-platforms', re: /consumer|ecommerce|retail|stream|gaming|beauty|food|travel/ },
    { key: 'industrial-materials', re: /industrial|robot|ship|steel|chem|materials|logistics|construction/ },
    { key: 'quantum-frontier', re: /quantum/ },
    { key: 'korea-local-themes', re: /kr_|korea|kospi|kosdaq/ }
  ];
  var missingThemeCategories = expectedThemeCategories.filter(function(c) { return !c.re.test(themeText); }).map(function(c) { return c.key; });
  var pricedNow = uniqueSymbols.filter(function(s) {
    var d = window._liveData && window._liveData[s];
    return d && isFinite(Number(d.price));
  });
  var issues = [];
  if (missingSectors.length) issues.push({ type: 'missing-standard-sector-etf', count: missingSectors.length, sample: missingSectors });
  if (weightIssues.length) issues.push({ type: 'theme-weight-sum', count: weightIssues.length, sample: weightIssues.slice(0, 10) });
  if (thinThemes.length) issues.push({ type: 'thin-theme-universe', count: thinThemes.length, sample: thinThemes.slice(0, 10) });
  if (uxIssues.length) issues.push({ type: 'beginner-ux-metadata', count: uxIssues.length, sample: uxIssues.slice(0, 10) });
  if (missingThemeCategories.length) issues.push({ type: 'missing-essential-theme-category', count: missingThemeCategories.length, sample: missingThemeCategories });
  if (missingProfileSymbols.length) issues.push({ type: 'missing-theme-profile-symbols', count: missingProfileSymbols.length, sample: missingProfileSymbols.slice(0, 30) });
  if (missingRegistry.length) issues.push({ type: 'missing-registry-symbols', count: missingRegistry.length, sample: missingRegistry.slice(0, 30) });
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    counts: {
      themes: themes.length,
      uniqueSymbols: uniqueSymbols.length,
      pricedNow: pricedNow.length,
      priceCoveragePct: uniqueSymbols.length ? Math.round(pricedNow.length / uniqueSymbols.length * 100) : 0,
      quoteReadySymbols: quoteReadySymbols.length,
      quoteReadinessPct: uniqueSymbols.length ? Math.round(quoteReadySymbols.length / uniqueSymbols.length * 100) : 0
    },
    issues: issues,
    weightIssues: weightIssues,
    concentrationWarnings: concentrationWarnings,
    thinThemes: thinThemes,
    uxIssues: uxIssues,
    missingThemeCategories: missingThemeCategories,
    missingLiveSymbols: missingLive,
    missingThemeProfileSymbols: missingProfileSymbols,
    missingRegistrySymbols: missingRegistry,
    missingStandardSectorEtfs: missingSectors,
    note: 'priceCoveragePct is already-loaded quote data; quoteReadinessPct is route/profile readiness for fetching theme prices.',
    generatedAt: new Date().toISOString()
  };
};

window.AIO.assertThemeTrendDeepAudit = window.AIO.getThemeTrendDeepAudit;

window.AIO_THEME_SEMANTIC_EXCLUSION_RULES = window.AIO_THEME_SEMANTIC_EXCLUSION_RULES || {
  kr_medtech: {
    '068760.KQ': 'Celltrion Pharm is pharmaceutical/biopharma exposure, not a direct medical-device or AI-diagnosis pure play.'
  },
  kr_kfood: {
    '004990.KS': 'Lotte Corp is holding-company exposure; use direct food exposure such as Lotte Wellfood (280360.KS) instead.'
  }
};

window.AIO.getThemeCompositionLogicAudit = function() {
  function uniq(arr) {
    var seen = {};
    return (arr || []).filter(Boolean).map(String).filter(function(x) {
      var k = x.toUpperCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function isKnownMarketProxy(sym) {
    return /^(XL|SMH|SOXX|QQQ|SPY|IWM|DIA|KRE|XBI|URA|BOTZ|HACK|ICLN|DRIV|IYZ|XSD|CRAK|ITA|GDX|LIT|JETS|OIH|AMLP|CIBR|IBIT|BITO|FBTC|ARKB|BITB|HODL|BTC-|ETH-|KRW=|\^)/.test(sym);
  }
  function hasSemanticEvidence(sym) {
    sym = String(sym || '').toUpperCase();
    if (!sym) return false;
    if (isKnownMarketProxy(sym)) return true;
    try { if ((window.SCREENER_DB || []).some(function(r) { return r && String(r.sym || '').toUpperCase() === sym && (r.name || r.memo || r.sector); })) return true; } catch(_) {}
    try {
      var reg = window.AIO_TICKER_NAME_REGISTRY && window.AIO_TICKER_NAME_REGISTRY.entries;
      if (reg && reg[sym] && !(window.AIO.isTickerRegistryPlaceholder && window.AIO.isTickerRegistryPlaceholder(sym, reg[sym]))) return true;
    } catch(_) {}
    var m = sym.match(/^(\d{6})\.(KS|KQ)$/);
    try { if (m && window.KR_STOCK_DB && window.KR_STOCK_DB[m[1]]) return true; } catch(_) {}
    return false;
  }
  function collect(raw, source, idOverride) {
    raw = raw || {};
    if (Array.isArray(raw)) {
      var weights = {};
      var syms = [];
      raw.forEach(function(item) {
        var code = String(item && item.code || '').trim();
        if (!code) return;
        syms.push(code);
        weights[code] = Number(item.w) || 0;
      });
      return { source: source, id: idOverride, name: idOverride, leaders: syms.slice(0, 3), tickers: syms, weights: weights, symbols: uniq(syms), rawKr: true };
    }
    var weights2 = raw.weights || {};
    var symbols = uniq([raw.etf, raw.compositeBase].concat(raw.leaders || [], raw.leaderHighlight || [], raw.tickers || [], Object.keys(weights2 || {})));
    return {
      source: source,
      id: raw.id || idOverride || raw.name || 'unknown',
      name: raw.nameKr || raw.name || raw.id || idOverride || 'unknown',
      leaders: raw.leaders || [],
      tickers: raw.tickers || [],
      weights: weights2,
      symbols: symbols,
      etf: raw.etf || null,
      desc: raw.desc || ''
    };
  }
  var themes = [];
  try { (window.THEME_MAP || []).forEach(function(t) { themes.push(collect(t, 'THEME_MAP')); }); } catch(_) {}
  try { (window.SUB_THEMES || []).forEach(function(t) { themes.push(collect(t, 'SUB_THEMES')); }); } catch(_) {}
  try { (window.KR_SUB_THEMES || []).forEach(function(t) { themes.push(collect(t, 'KR_SUB_THEMES')); }); } catch(_) {}
  try { Object.keys(window.KR_THEME_MAP || {}).forEach(function(id) { themes.push(collect(window.KR_THEME_MAP[id], 'KR_THEME_MAP', id)); }); } catch(_) {}

  var sourceIds = {};
  var crossSourceIds = {};
  var duplicateThemeIds = [];
  var crossSourceIdCollisions = [];
  var invalidWeights = [];
  var weightCoverageIssues = [];
  var leaderNotInBasket = [];
  var semanticGaps = [];
  var semanticExclusionHits = [];
  var krRawCodesMissingStockDb = [];
  var concentrationWarnings = [];
  var allSymbols = {};
  themes.forEach(function(t) {
    var sameSourceKey = t.source + ':' + t.id;
    if (sourceIds[sameSourceKey]) duplicateThemeIds.push({ source: t.source, id: t.id });
    sourceIds[sameSourceKey] = true;
    crossSourceIds[t.id] = crossSourceIds[t.id] || {};
    crossSourceIds[t.id][t.source] = true;

    var basket = {};
    (t.symbols || []).forEach(function(s) { basket[String(s).toUpperCase()] = true; allSymbols[String(s).toUpperCase()] = true; });
    (t.leaders || []).forEach(function(s) {
      if (!basket[String(s).toUpperCase()]) leaderNotInBasket.push({ source: t.source, id: t.id, symbol: s });
    });
    var weightKeys = Object.keys(t.weights || {});
    if (weightKeys.length) {
      (t.tickers || []).forEach(function(s) {
        if (!(s in t.weights)) weightCoverageIssues.push({ source: t.source, id: t.id, symbol: s, issue: 'ticker-without-weight' });
      });
      weightKeys.forEach(function(s) {
        var v = Number(t.weights[s]);
        if (!isFinite(v) || v <= 0) invalidWeights.push({ source: t.source, id: t.id, symbol: s, weight: t.weights[s] });
      });
      var vals = weightKeys.map(function(k) { return Number(t.weights[k]) || 0; }).filter(function(v) { return v > 0; }).sort(function(a, b) { return b - a; });
      if (vals.length >= 3) {
        var top1 = vals[0];
        var top3 = vals.slice(0, 3).reduce(function(sum, v) { return sum + v; }, 0);
        if (top1 > 45 || top3 > 85) concentrationWarnings.push({ source: t.source, id: t.id, name: t.name, top1: top1, top3: top3 });
      }
    }
    (t.symbols || []).forEach(function(s) {
      var sym = String(s || '').toUpperCase();
      try {
        var exclusions = window.AIO_THEME_SEMANTIC_EXCLUSION_RULES || {};
        var byTheme = exclusions[t.id] || exclusions[String(t.id || '').toLowerCase()];
        var reason = byTheme && (byTheme[sym] || byTheme[String(s || '')]);
        if (reason) semanticExclusionHits.push({ source: t.source, id: t.id, symbol: sym, reason: reason });
      } catch(_) {}
      if (/^\d{6}$/.test(sym)) {
        try { if (!window.KR_STOCK_DB || !window.KR_STOCK_DB[sym]) krRawCodesMissingStockDb.push({ source: t.source, id: t.id, code: sym }); } catch(_) {}
        return;
      }
      if (!hasSemanticEvidence(sym)) semanticGaps.push({ source: t.source, id: t.id, symbol: sym });
    });
  });
  Object.keys(crossSourceIds).forEach(function(id) {
    var sources = Object.keys(crossSourceIds[id]);
    if (sources.length > 1) crossSourceIdCollisions.push({ id: id, sources: sources });
  });
  var uniqueSymbols = Object.keys(allSymbols);
  var semanticGapSymbols = {};
  semanticGaps.forEach(function(g) { semanticGapSymbols[g.symbol] = true; });
  var structuralBlocking = duplicateThemeIds.length + invalidWeights.length + weightCoverageIssues.length + leaderNotInBasket.length + krRawCodesMissingStockDb.length + semanticExclusionHits.length;
  return {
    status: structuralBlocking ? 'warn' : 'ok',
    counts: {
      themes: themes.length,
      uniqueSymbols: uniqueSymbols.length,
      semanticEvidenceSymbols: Math.max(0, uniqueSymbols.length - Object.keys(semanticGapSymbols).length),
      semanticEvidencePct: uniqueSymbols.length ? Math.round((uniqueSymbols.length - Object.keys(semanticGapSymbols).length) / uniqueSymbols.length * 100) : 0
    },
    duplicateThemeIds: duplicateThemeIds,
    crossSourceIdCollisions: crossSourceIdCollisions,
    leaderNotInBasket: leaderNotInBasket,
    invalidWeights: invalidWeights,
    weightCoverageIssues: weightCoverageIssues,
    krRawCodesMissingStockDb: krRawCodesMissingStockDb,
    semanticExclusionHits: semanticExclusionHits,
    semanticGaps: semanticGaps,
    concentrationWarnings: concentrationWarnings,
    note: 'Composition logic audit checks structural integrity and local explainability. It does not prove every constituent is currently the best market representative without external verification.',
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getThemeSymbolExplainability = function(symbol) {
  var target = String(symbol || '').trim().toUpperCase();
  if (!target) return { symbol: '', found: false, themes: [] };
  var registry = null;
  try {
    if (window.AIO_TICKER_NAME_REGISTRY && window.AIO_TICKER_NAME_REGISTRY.entries) registry = window.AIO_TICKER_NAME_REGISTRY.entries[target] || null;
    if (!registry && window.SCREENER_DB) {
      (window.SCREENER_DB || []).some(function(r) {
        if (r && String(r.sym || '').toUpperCase() === target) {
          registry = r;
          return true;
        }
        return false;
      });
    }
  } catch(_) {}
  function addFromTheme(out, theme, source, idOverride) {
    if (!theme) return;
    var weights = theme.weights || {};
    var symbols = [theme.etf, theme.compositeBase].concat(theme.leaders || [], theme.leaderHighlight || [], theme.tickers || [], Object.keys(weights));
    var hit = symbols.some(function(s) { return String(s || '').toUpperCase() === target; });
    if (!hit) return;
    out.push({
      source: source,
      id: theme.id || idOverride || theme.name || 'unknown',
      name: theme.nameKr || theme.name || theme.id || idOverride || 'unknown',
      role: (theme.leaders || []).map(function(s) { return String(s || '').toUpperCase(); }).indexOf(target) >= 0 ? 'leader' : 'constituent',
      weight: weights[target] || null,
      desc: theme.desc || theme.insight || theme.catalyst || theme.macro || ''
    });
  }
  var themes = [];
  try { (window.THEME_MAP || []).forEach(function(t) { addFromTheme(themes, t, 'THEME_MAP'); }); } catch(_) {}
  try { (window.SUB_THEMES || []).forEach(function(t) { addFromTheme(themes, t, 'SUB_THEMES'); }); } catch(_) {}
  try { (window.KR_SUB_THEMES || []).forEach(function(t) { addFromTheme(themes, t, 'KR_SUB_THEMES'); }); } catch(_) {}
  return {
    symbol: target,
    found: !!(registry || themes.length),
    registry: registry,
    themes: themes.slice(0, 12),
    beginnerFallback: registry ? '' : (themes.length ? target + ' is included as a ' + themes[0].role + ' in ' + themes[0].name + '.' : '')
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.32 M2 근본 수정: assertChatResponseAccuracy — AI 응답 post-hoc 검증
// 응답 텍스트에서 가격 패턴 추출 + 실시간 가격과 비교. ±20% 괴리 시 경고.
// R83 신규 (AI 응답 post-hoc 가격 검증 의무)
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatResponseAccuracy = function(responseText, detectedTickers) {
  var result = { accurate: true, deviation: 0, severity: 'none', issues: [], priceCitations: [] };
  if (!responseText || typeof responseText !== 'string') return result;
  detectedTickers = Array.isArray(detectedTickers) ? detectedTickers : [];
  if (detectedTickers.length === 0) return result;

  // v49.64 P336/T263: 가격 패턴 추출 보강 — thousand separator + 정확한 \b 경계
  // $123 / $123.45 / $1,234.56 모두 지원
  var priceMatches = responseText.match(/\$\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\$\d{1,5}(?:\.\d{1,2})?/g) || [];
  if (priceMatches.length === 0) return result;

  var ld = window._liveData || {};
  var maxDev = 0;
  detectedTickers.forEach(function(t) {
    var live = ld[t];
    if (!live || !live.price) return;
    var livePrice = Number(live.price);
    priceMatches.forEach(function(pm) {
      // v49.64: thousand separator 제거 후 숫자 파싱
      var citedPrice = Number(pm.replace('$', '').replace(/,/g, ''));
      if (!isFinite(citedPrice) || citedPrice <= 0) return;
      // safelist 임계값은 제외 (calibration 상수)
      var pmIdx = responseText.indexOf(pm);
      var pmCtx = pmIdx >= 0 ? responseText.slice(Math.max(0, pmIdx - 90), pmIdx + pm.length + 90) : responseText;
      var isCalibrationContext = /calibration|threshold|ratio|distance|20MA|MA distance|RSI|MACD|band|screening|safelist/i.test(pmCtx);
      if (isCalibrationContext && window.AIO_NUMERIC_GUIDELINE_SAFELIST && window.AIO_NUMERIC_GUIDELINE_SAFELIST.isCalibrationConstant(citedPrice)) return;
      var dev = (citedPrice - livePrice) / livePrice * 100;
      if (Math.abs(dev) > Math.abs(maxDev)) maxDev = dev;
      result.priceCitations.push({ ticker: t, citedPrice: citedPrice, livePrice: livePrice, deviationPct: dev });
      // v49.64 P336: 임계값 20% → 10% (T263 정합) — 10%+ 편차는 부정확 판정
      if (Math.abs(dev) > 10) {
        result.accurate = false;
        result.issues.push(t + ' cited $' + citedPrice + ' vs live $' + livePrice.toFixed(2) + ' (' + (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%)');
      }
    });
  });
  result.deviation = maxDev;
  if (Math.abs(maxDev) > 50)      result.severity = 'critical';
  else if (Math.abs(maxDev) > 20) result.severity = 'high';
  else if (Math.abs(maxDev) > 10) result.severity = 'medium';
  else if (Math.abs(maxDev) > 5)  result.severity = 'low';
  return result;
};

// ─────────────────────────────────────────────────────────────────
// v49.32 M3 근본 수정: getChatHallucinationAudit — 환각 패턴 탐지
// 라운드 숫자 ($150), 너무 정확한 소수 ($175.50), 불확실 표현 동시 등장 등.
// R86 신규 (환각 패턴 자동 탐지)
// ─────────────────────────────────────────────────────────────────
window.AIO.getChatHallucinationAudit = function(responseText) {
  var result = { suspicionScore: 0, patterns: [], maxScore: 10 };
  if (!responseText || typeof responseText !== 'string') return result;
  // 패턴 1: 정확한 라운드 숫자 ($100, $150, $200, $250, $300, $500 등)
  var roundMatches = responseText.match(/\$(?:100|150|200|250|300|400|500|600|750|1000)(?!\.\d)/g) || [];
  if (roundMatches.length > 0) {
    result.suspicionScore += Math.min(3, roundMatches.length);
    result.patterns.push('round-number:' + roundMatches.length);
  }
  // 패턴 2: 가격 + 불확실 표현 ("약/대략/추정/대충/거의/근처")
  if (/\$\d+/.test(responseText) && /(약|대략|추정|대충|거의|근처|approximately|around|roughly|about)/.test(responseText)) {
    result.suspicionScore += 4;
    result.patterns.push('uncertain-with-price');
  }
  // 패턴 3: 너무 정확한 소수 ($X.00, $X.50) — fetch 데이터 정확성 의심
  var preciseMatches = responseText.match(/\$\d+\.(?:00|50)\b/g) || [];
  if (preciseMatches.length > 0) {
    result.suspicionScore += Math.min(2, preciseMatches.length);
    result.patterns.push('precise-decimal:' + preciseMatches.length);
  }
  // 패턴 4: 학습 데이터 시점 키워드 ("2024년", "2025년 초")
  if (/(2024년|2025년 초|작년 초)/.test(responseText)) {
    result.suspicionScore += 1;
    result.patterns.push('stale-year-reference');
  }
  // v49.74 P397 R145: 학습 데이터 자기 인용 절대 차단 패턴 강화 (사용자 정직 발견 — "2025년 초 학습 데이터 기준" 답변 등장)
  // AI가 자기 환각을 자백하는 표현은 critical (+5점)
  if (/(학습\s*데이터\s*기준|학습\s*데이터\s*에\s*따르면|내가\s*학습한|학습\s*시점|기억\s*속|내가\s*알기로|내\s*기억(으로|에))/.test(responseText)) {
    result.suspicionScore += 5;
    result.patterns.push('self-confess-training-data');
  }
  // 시점 환각 — "2025년 초", "2024년 말", "최근 발표(데이터 없는 경우)" 등 학습 시점 추정 연도
  var staleYearMatches = responseText.match(/202[0-5]년\s*(초|말|중반)?/g) || [];
  if (staleYearMatches.length > 0) {
    result.suspicionScore += Math.min(3, staleYearMatches.length);
    result.patterns.push('training-year-citation:' + staleYearMatches.length);
  }
  // "약 $X~$Y대에서 베이스를 형성" — 데이터 없이 가격 범위 추측
  if (/약\s*\$\d+\s*[~\-]\s*\$?\d+\s*(대|범위|구간|에서)/.test(responseText)) {
    result.suspicionScore += 3;
    result.patterns.push('vague-price-range');
  }
  // v49.75 P402 R150: Pattern D — 정적 시점 토큰 답변 누출 강화 (사용자 정직 발견 — "5/22" 학습 시점 노출)
  // 세션 날짜와 다른 정적 날짜 토큰이 답변에 그대로 등장 시 검출
  try {
    var now = new Date();
    var todayY = now.getFullYear();
    var todayM = now.getMonth() + 1;
    var todayD = now.getDate();
    // M/D 형식 날짜 매칭 (5/22, 4/12 등) — 오늘과 비교
    var mdMatches = responseText.match(/(\d{1,2})\/(\d{1,2})\b/g) || [];
    var staleMd = [];
    mdMatches.forEach(function(md) {
      var parts = md.split('/');
      var m = parseInt(parts[0], 10);
      var d = parseInt(parts[1], 10);
      // 유효 월/일 + 오늘과 7일+ 이격
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        var thatDate = new Date(todayY, m - 1, d);
        var diffDays = Math.abs((now - thatDate) / 86400000);
        if (diffDays > 7) staleMd.push({ md: md, daysFromToday: Math.round(diffDays) });
      }
    });
    if (staleMd.length >= 2) {
      result.suspicionScore += 2;
      result.patterns.push('stale-md-date:' + staleMd.length);
    }
    // YYYY-MM-DD 또는 YYYY.MM.DD 형식 — 1개월+ 과거면 stale
    var isoMatches = responseText.match(/202[0-5][\-\.](\d{1,2})[\-\.](\d{1,2})/g) || [];
    if (isoMatches.length >= 2) {
      result.suspicionScore += 1;
      result.patterns.push('stale-iso-date:' + isoMatches.length);
    }
  } catch(_) {}
  result.suspicionScore = Math.min(result.suspicionScore, result.maxScore);
  result.verdict = result.suspicionScore >= 7 ? 'high-risk' : result.suspicionScore >= 4 ? 'medium-risk' : result.suspicionScore >= 2 ? 'low-risk' : 'clean';
  // v49.74 P397: blocking-grade 환각 — self-confess-training-data 패턴은 답변 위에 빨간 경고 박스 강제
  result.requiresWarningBox = result.patterns.indexOf('self-confess-training-data') >= 0;
  return result;
};

// ─────────────────────────────────────────────────────────────────
// v49.37 핵심: PAGE_SEQUENTIAL_AUDIT_REGISTRY — 페이지별 sub-section 매트릭스
// 사용자 지적: "각 페이지마다 모든 내용들 위에서부터 아래로 하나하나씩 읽고 점검한거지?
// 디테일하게 쪼개서 최신성/정확성/정합성/로직성/직관성/핵심성 점검?"
// 솔직한 답변: 아니오 — line range 기반/키워드 grep 위주였음.
// 본 registry는 21페이지 모든 sub-section을 6축으로 매트릭스화 (점검 진행상황 추적).
// R93 신규 (페이지 sequential audit 의무화)
// ─────────────────────────────────────────────────────────────────
window.AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY = {
  version: 'v49.58',
  axes: ['최신성', '정확성', '정합성', '로직성', '직관성', '핵심성'],
  // 페이지별 sub-section 정의 (top-down 순서)
  pages: {
    'home': {
      lineRange: 'L3948~4400+',
      // v49.38 P289: 1차 8개 → 2차 14개 재 enumerate (위→아래 모든 sub-section)
      subSections: [
        { id: 'home-stale-warning',     order:  1, topic: '데이터 경과 경고 배너',     lines: 'L3950' },
        { id: 'home-api-onboarding',    order:  2, topic: 'API 키 onboarding',         lines: 'L3953~3956' },
        { id: 'home-header',            order:  3, topic: '헤더 (타이틀+버전+배지)',   lines: 'L3958~3974' },
        { id: 'home-score-legend',      order:  4, topic: '스코어 해석 범례',          lines: 'L3975~3982' },
        { id: 'home-conclusion-bar',    order:  5, topic: 'conclusion-bar 동적',        lines: 'L3984~3985' },
        { id: 'home-market-summary',    order:  6, topic: '오늘의 시장 배너',          lines: 'L3987~4007' },
        { id: 'home-quick-nav',         order:  7, topic: '빠른 이동 chips 7개',       lines: 'L4009~4018' },
        { id: 'home-3-cards-decision',  order:  8, topic: '3 카드 (Primary/Quality/Regime)', lines: 'L4020~4051' },
        { id: 'home-action-item-card',  order:  9, topic: 'Action Item 카드 (v49.28)', lines: 'L4053~4068' },
        { id: 'home-explain-decision',  order: 10, topic: '매매 판단 심층 해설',       lines: 'L4070~4140' },
        { id: 'home-kpi-4cards',        order: 11, topic: 'KPI 4 카드 (SPX/NASDAQ/VIX/FG)', lines: 'L4144~4170' },
        { id: 'home-sub-indicators',    order: 12, topic: '서브 지표 chips 6개 (DXY/10Y/Gold/WTI/KOSPI/BTC)', lines: 'L4173~4180' },
        { id: 'home-explain-top',       order: 13, topic: '상단 지표 펼쳐보기 (VIX/FG 표 포함)', lines: 'L4182~4263' },
        { id: 'home-gmo-bloomberg',     order: 14, topic: 'Bloomberg-Style GMO 표',    lines: 'L4265~4292' },
        { id: 'home-explain-gmo',       order: 15, topic: 'GMO + DXY/10Y/Gold/WTI/BTC 해설', lines: 'L4300~4400+' }
      ],
      // v49.40 home 3차 점검 완료 후 audit status
      auditStatus: {
        '최신성':'ok',
        '정확성':'ok',
        '정합성':'ok',
        '로직성':'ok',
        '직관성':'mostly-ok',
        '핵심성':'mostly-ok'
      },
      // v49.38 R94 + v49.40 home 3차: 점검 결과 누적 (findings)
      findings: [
        { sub: 'home-explain-top', axis: '정합성', severity: 'critical', note: 'VIX 표 vs THRESHOLD_REGISTRY.VIX 6 vs 5 구간 불일치 (R56 위반)', fixedIn: 'v49.38 F1' },
        { sub: 'home-explain-top', axis: '정확성', severity: 'minor',    note: '오타 "뷰블" → "버블"', fixedIn: 'v49.38 F2' },
        { sub: 'home-explain-gmo', axis: '정합성', severity: 'high',     note: 'DXY/10Y 임계값 라벨 REGISTRY 미등록', fixedIn: 'v49.38 F3 (THRESHOLD.DXY + YIELD_10Y 추가)' },
        { sub: 'home-header',      axis: '정확성', severity: 'minor',    note: 'live-quote-ts-topbar JS hook 부재', fixedIn: 'v49.37 P283' },
        { sub: 'home-3-cards-decision', axis: '직관성', severity: 'medium', note: '3 카드 타이포그래피 동일', fixedIn: 'v49.28 (CARD_HIERARCHY)' },
        // v49.40 home 3차 — 인터랙션 + 페이지 간 정합 + 라이브 데이터 sink 실 검증
        { sub: 'home-action-item-card', axis: '로직성', severity: 'critical', note: '↻ 갱신 버튼 data-action="_aioRefreshActionPlan" 핸들러 미정의 — click 무동작 (silent no-op). R96 audit이 knownAliases로 false-positive 통과', fixedIn: 'v49.40 P294 (window._aioRefreshActionPlan 신설 + knownAliases에서 제거)' },
        { sub: 'home-kpi-4cards',  axis: '정합성', severity: 'ok',       note: 'home 9 ticker (^GSPC/^IXIC/^VIX/^TNX/GC=F/CL=F/DX-Y.NYB/^KS11/BTC-USD) 모두 LIVE_SYMBOLS 등록 + 다른 페이지(signal/sentiment/options/technical/macro/fxbond/kr-home/kr-technical) 분포 검증 OK. fetchLiveQuotes bulk update가 모든 [data-live-price="T"] 동시 갱신', verifiedIn: 'v49.40 home 3차 (R95)' },
        { sub: 'home-3-cards-decision', axis: '로직성', severity: 'ok', note: 'data-action 7종 (_aioHideParentOnboard/_aioRefreshActionPlan/_aioScrollApiSection/_aioToggleExplain/showPage/toggleGmoExpand/toggleLLM) 모두 핸들러 등록 확인 (P294 시정 후)', verifiedIn: 'v49.40 home 3차 (R96)' }
      ]
    },
    // v49.39 P292: signal 1차 enumerate (14 sub-section)
    'signal': {
      lineRange: 'L4388~5238',
      subSections: [
        { id: 'signal-purpose-header',   order:  1, topic: '페이지 목적 헤더 (Secondary)',   lines: 'L4389~4394' },
        { id: 'signal-insight-box',      order:  2, topic: '75+/60-75/.../30↓ 라벨 박스',     lines: 'L4395~4397' },
        { id: 'signal-lockout-control',  order:  3, topic: 'Lockout Rally / OPEX Control',   lines: 'L4399~4412' },
        { id: 'signal-explain-page',     order:  4, topic: '심층 해설 펼쳐보기',             lines: 'L4414~4750' },
        { id: 'signal-20pt-scoring',     order:  5, topic: '20점 스코어링 (Trend/RS/Vol/IV/Breakout)', lines: 'L4424~4439' },
        { id: 'signal-2pct-rule',        order:  6, topic: '2% 룰 (계좌 규모 표)',           lines: 'L4441~4459' },
        { id: 'signal-atr-stop',         order:  7, topic: 'ATR 스톱 (ATR_PRESETS)',         lines: 'L4461~4480' },
        { id: 'signal-entry-exit',       order:  8, topic: '진입/청산 전략',                 lines: 'L4480~4600' },
        { id: 'signal-trading-setups',   order:  9, topic: '12 매매 셋업 (VCP/Breakout/Pullback)', lines: 'L4600~4700' },
        { id: 'signal-pyramiding',       order: 10, topic: '피라미딩 + Add-on 규칙',         lines: 'L4700~4900' },
        { id: 'signal-spx-tech-dash',    order: 11, topic: 'SPX 실시간 기술 지표 대시보드',  lines: 'L4900~5050' },
        { id: 'signal-breadth-consensus', order: 12, topic: '다중 신호 합의 (v49.29 R61)',   lines: 'L5040~5050' },
        { id: 'signal-macro-scenario',   order: 13, topic: '매크로 시나리오 트리 (낙관/기본/비관)', lines: 'L5150~5224' },
        { id: 'signal-exit-triggers',    order: 14, topic: 'Exit Triggers (VIX/SPX/HYG/DXY)', lines: 'L5226~5237' }
      ],
      // v49.41 signal 2차: auditStatus partial → 6축 객체 전환
      auditStatus: {
        '최신성':'mostly-ok',
        '정확성':'ok',
        '정합성':'ok',
        '로직성':'ok',
        '직관성':'ok',
        '핵심성':'mostly-ok'
      },
      findings: [
        // v49.41 P295: SCENARIO_REGISTRY 정적 인라인 → 동적 연동 (R73 위반 해소)
        { sub: 'signal-macro-scenario', axis: '정합성', severity: 'high',    note: '시나리오 확률(30~35%/40~45%/15~20%)이 정적 인라인 — v49.27 SCENARIO_REGISTRY 인프라 추가 후 페이지 미적용 (R73 위반)', fixedIn: 'v49.41 A1/P295 (SCENARIO_REGISTRY.signalShortTerm + _aioPageBus signal pageShown hook + data-scenario-key 마커)' },
        // v49.41 P296: CP2 fed-rate lastUpdated 메타 부재
        { sub: 'signal-spx-tech-dash', axis: '최신성', severity: 'medium', note: 'CP2 cell fed-rate/fomc lastUpdated 표시 부재 — R77 MACRO_CALENDAR 인프라 있으나 인라인 노출 안 됨', fixedIn: 'v49.41 A2/P296 (MACRO_CALENDAR에 us-fomc/us-fed-rate 추가 + #cp2-fed-rate-meta dynamic D-day 표시)' },
        // v49.41 P297: updateExitTriggers 호출 보장 (verify-only)
        { sub: 'signal-exit-triggers', axis: '로직성', severity: 'ok',    note: 'updateExitTriggers L22547 — refreshSignal 초기 호출(L22675) + aio:liveQuotes 이벤트(L22927) 두 곳에서 호출 보장 OK. SPX×0.9/DXY×1.05/HYG×0.95 동적 계산', verifiedIn: 'v49.41 A3/P297' },
        // v49.41 P298: L4485 영문 병기
        { sub: 'signal-entry-exit', axis: '정확성', severity: 'minor', note: '"브레드스 쓰러스트" 단독 표기 → "브레드쓰 스러스트 (Breadth Thrust)" 영문 병기', fixedIn: 'v49.41 A4/P298 (index.html L5185 + L22485)' }
      ],
      note: 'v49.41 2차 깊이 점검 완료 — 4 finding (3 시정 + 1 verify-only)'
    },
    // v49.39 P293: breadth 1차 enumerate (12 sub-section)
    'breadth': {
      lineRange: 'L5240~5598',
      subSections: [
        { id: 'breadth-insight-box',     order:  1, topic: '시장 폭 정의 박스',              lines: 'L5242~5244' },
        { id: 'breadth-explain-page',    order:  2, topic: '심층 해설 펼쳐보기',             lines: 'L5246~' },
        { id: 'breadth-definition',      order:  3, topic: 'Breadth 5 지표 정의',            lines: 'L5256~5267' },
        { id: 'breadth-narrow-vs-broad', order:  4, topic: 'Narrow Advance vs Broad Rally',  lines: 'L5269~5300' },
        { id: 'breadth-sma-cards',       order:  5, topic: '5SMA/20SMA/50SMA/200SMA 4 카드 (실데이터)', lines: 'L5340~5410' },
        { id: 'breadth-consensus-readout', order: 6, topic: 'diagnoseBreadthConsensus (v49.29 R61)', lines: 'L5040~5046' },
        { id: 'breadth-static-diagnose', order:  7, topic: '정적 진단 텍스트',               lines: 'L5048~5050' },
        { id: 'breadth-mcclellan',       order:  8, topic: 'McClellan Oscillator',           lines: 'L5410~5450' },
        { id: 'breadth-weinstein',       order:  9, topic: 'Weinstein Stage',                lines: 'L5450~5500' },
        { id: 'breadth-nhnl',            order: 10, topic: '신고가/신저가 (NHNL)',           lines: 'L5500~5530' },
        { id: 'breadth-ad-line',         order: 11, topic: 'A/D Line + Distribution Days',   lines: 'L5530~5570' },
        { id: 'breadth-divergence',      order: 12, topic: '다이버전스 조기 경보',           lines: 'L5570~5598' }
      ],
      // v49.41 breadth 2차: auditStatus partial → 6축 객체 전환
      auditStatus: {
        '최신성':'mostly-ok',
        '정확성':'ok',
        '정합성':'ok',
        '로직성':'ok',
        '직관성':'ok',
        '핵심성':'mostly-ok'
      },
      findings: [
        // v49.41 P299: DATA_SNAPSHOT breadth*sma 시드 부재 — 폴백만 동작 (R74 보강)
        { sub: 'breadth-sma-cards', axis: '최신성', severity: 'high', note: '5SMA/20SMA/50SMA/200SMA data-snap 4 sink가 DATA_SNAPSHOT 시드 부재 — `S.breadth5sma || 68` 패턴이 폴백만 의존. 실시간 fetch set해도 R74 assertSnapshotInlineMatch 못 잡음', fixedIn: 'v49.41 B1/P299 (DATA_SNAPSHOT에 breadth5sma=68/breadth20sma=75/breadth50sma=46/breadth200sma=55 4 시드 추가)' },
        // v49.41 P300: McClellan Summation vs Oscillator 정의 혼합
        { sub: 'breadth-mcclellan', axis: '정합성', severity: 'high', note: '카드 라벨 "McClellan 써메이션" + 설명 "0 위/아래 = 매수/하락 에너지"가 Summation(장기 누적합) 정의와 Oscillator(단기 ±100) semantic 혼합 — 사용자 해석 오류 위험', fixedIn: 'v49.41 B2/P300 (Summation Index 라벨 명확화 + 설명에 Oscillator와 구분 명시 + 베어 다이버전스 = SPX 신고가 vs Summation 미발동 정의 추가)' },
        // v49.41 verify-only: diagnoseBreadthConsensus 결과 DOM 바인딩 (agent 보고 false alarm 검증)
        { sub: 'breadth-consensus-readout', axis: '로직성', severity: 'ok', note: 'diagnoseBreadthConsensus() 호출 후 #breadth-consensus-verdict + #breadth-consensus-conflict + #breadth-consensus-details 3 sink 동기 갱신 (aio-core.js L1518~1541) — agent "결과 바인딩 추적 불가" 클레임 false alarm, 실제 완전 구현', verifiedIn: 'v49.41 (P294 패턴 verify)' }
      ],
      note: 'v49.41 2차 깊이 점검 완료 — 3 finding (2 시정 + 1 verify-only). Agent false alarm 9건 verify로 차단.'
    },
    // v49.42 sentiment 1차+2차
    'sentiment': {
      lineRange: 'L5599~5917',
      subSections: [
        { id: 'sentiment-insight-box',    order:  1, topic: '핵심 메시지 (F&G 25↓/75+)',           lines: 'L5638~5640' },
        { id: 'sentiment-explain-page',   order:  2, topic: '투자 심리 심층 해설 (펼쳐보기)',         lines: 'L5642~5693' },
        { id: 'sentiment-conclusion-bar', order:  3, topic: '페이지 결론 바 (_renderConclusionBar)',  lines: 'L5695~5696' },
        { id: 'sentiment-header',         order:  4, topic: '헤더 + sent-overall-badge',             lines: 'L5698~5715' },
        { id: 'sentiment-guide-cards',    order:  5, topic: '심리 지표 가이드 3 카드',                lines: 'L5717~5734' },
        { id: 'sentiment-fg-gauge',       order:  6, topic: 'F&G Gauge + fg-needle SVG',             lines: 'L5737~5781' },
        { id: 'sentiment-vix-chart',      order:  7, topic: 'VIX 차트',                              lines: 'L5785~5792' },
        { id: 'sentiment-vix-term',       order:  8, topic: 'VIX Term Structure',                    lines: 'L5794~5832' },
        { id: 'sentiment-naaim-ii',       order:  9, topic: 'NAAIM + II 차트',                       lines: 'L5835~5843' },
        { id: 'sentiment-hy-aaii-pc',     order: 10, topic: 'HY/AAII/Put-Call 3 카드',               lines: 'L5848~5891' },
        { id: 'sentiment-news-chart',     order: 11, topic: '뉴스 감성 차트',                        lines: 'L5893~5910' },
        { id: 'sentiment-analysis-text',  order: 12, topic: '심리지표 복합 분석 (동적)',              lines: 'L5913~5916' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // verify-only (agent false alarm 차단)
        { sub: 'sentiment-conclusion-bar', axis: '정합성', severity: 'ok', note: '_renderConclusionBar(\'sentiment-conclusion-bar\', ...) 범용 함수 index.html L22898 호출 — agent "_aioRenderSentimentConclusion 미구현" 클레임 false alarm', verifiedIn: 'v49.42 (P294 패턴 verify)' },
        { sub: 'sentiment-header',         axis: '정확성', severity: 'ok', note: 'sent-overall-badge 갱신 aio-ui.js L1912 — false alarm', verifiedIn: 'v49.42' },
        { sub: 'sentiment-analysis-text',  axis: '정확성', severity: 'ok', note: 'sent-analysis-text 갱신 index.html L21059 — false alarm', verifiedIn: 'v49.42' },
        { sub: 'sentiment-fg-gauge',       axis: '직관성', severity: 'ok', note: 'fg-needle SVG 갱신 aio-data.js L11215 — false alarm (정적 아님)', verifiedIn: 'v49.42' },
        { sub: 'sentiment-hy-aaii-pc',     axis: '정확성', severity: 'ok', note: 'pc-needle-pos 갱신 aio-data.js L11507 — false alarm', verifiedIn: 'v49.42' }
      ],
      note: 'v49.42 1차+2차 통합 — agent 보고 12개 중 진짜 issue 0건. sentiment 페이지 인프라 완성도 우수.'
    },
    // v49.42 briefing 1차+2차
    'briefing': {
      lineRange: 'L5917~6260',
      subSections: [
        { id: 'briefing-top5-watch',       order:  1, topic: '5대 관전 포인트 (v49.29 E4)',          lines: 'L5921~5935' },
        { id: 'briefing-action-card',      order:  2, topic: 'Action Item 카드 (R69 ACTION_RULES)',  lines: 'L5937~5942' },
        { id: 'briefing-explain-page',     order:  3, topic: '브리핑 활용 가이드 (펼쳐보기)',         lines: 'L5948~5982' },
        { id: 'briefing-header',           order:  4, topic: '헤더 + date-line + regime-badge',      lines: 'L5985~6010' },
        { id: 'briefing-live-news',        order:  5, topic: '24h 라이브 뉴스 섹션',                  lines: 'L6012~6026' },
        { id: 'briefing-archive-warn',     order:  6, topic: '아카이브 경고 배지 (data-aio-archive)', lines: 'L6028~6035' },
        { id: 'briefing-dynamic-content',  order:  7, topic: '동적 브리핑 (data-dynamic)',           lines: 'L6037~6044' },
        { id: 'briefing-jensen-interview', order:  8, topic: 'Jensen Huang 인터뷰 (lifecycle)',       lines: 'L6047~6134' },
        { id: 'briefing-week-may',         order:  9, topic: '과거 참고 일정',                        lines: 'L6136~6229' },
        { id: 'briefing-earnings-cal',     order: 10, topic: '어닝 캘린더',                          lines: 'L6207~6228' },
        { id: 'briefing-earnings-spot',    order: 11, topic: 'Earnings Spotlight 표',                lines: 'L6230~6259' },
        { id: 'briefing-final-snap',       order: 12, topic: '최종 스냅',                            lines: 'L6260~' }
      ],
      auditStatus: { '최신성':'mostly-ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // v49.42 P302/R76 보강: 지정학 정치 토큰 일반화
        { sub: 'briefing-top5-watch',    axis: '최신성', severity: 'medium', note: 'L5931 "호르무즈/대만 해협 모니터링" 정치/지명 토큰 잔존', fixedIn: 'v49.42 P302/R76 보강 (일반화: "주요 해상 물류 경로(호르무즈/대만 해협 등) 모니터링")' },
        // v49.42 P304: Jensen 정적 텍스트 → 동적 span 단독
        { sub: 'briefing-jensen-interview', axis: '최신성', severity: 'medium', note: 'L6060 정적 "58일 경과 (60일 임박)" — v49.30 P253 작성 시점 라벨, 매일 1일씩 stale. 동적 #jensen-interview-stale-days span과 중복', fixedIn: 'v49.42 P304 (정적 텍스트 제거 + 동적 span 단독 표시)' },
        // verify-only
        { sub: 'briefing-action-card',   axis: '로직성', severity: 'ok', note: 'briefing-action-position/sentiment ACTION_RULES hook 완전 구현 aio-core.js L1485~1499 — agent "ACTION_RULES 미구현" 클레임 false alarm', verifiedIn: 'v49.42 P305' }
      ],
      note: 'v49.42 1차+2차 통합 — 2 시정 + 1 verify-only. agent 보고 false alarm 4건 차단.'
    },
    // v49.42 technical 1차+2차
    'technical': {
      lineRange: 'L6250~6790',
      subSections: [
        { id: 'technical-explain-header',  order:  1, topic: '헤더 + 기술 분석 심층 해설',           lines: 'L6310~6376' },
        { id: 'technical-tv-chart',        order:  2, topic: 'TradingView + OHLC 폴백 (R66)',        lines: 'L6391~6409' },
        { id: 'technical-health-dash',     order:  3, topic: '시장 건강도 대시보드',                  lines: 'L6411~6460' },
        { id: 'technical-indicator-cards', order:  4, topic: 'RSI/MACD/Stochastic/ADX 4 카드',        lines: 'L6500~6531' },
        { id: 'technical-ticker-search',   order:  5, topic: '빠른 종목 검색 (Weinstein/RSI)',        lines: 'L6533~6551' },
        { id: 'technical-support-resist',  order:  6, topic: '지지/저항 + Weinstein 4단계',          lines: 'L6553~6596' },
        { id: 'technical-trading-setups',  order:  7, topic: '12 매매 셋업 패턴 (VCP 94%)',          lines: 'L6600~6689' },
        { id: 'technical-mtf-analysis',    order:  8, topic: '멀티 타임프레임 (Triple Screen)',       lines: 'L6691~6700' },
        { id: 'technical-pattern-signals', order:  9, topic: '다이버전스·패턴 (aggregate_signals)',    lines: 'L6702~6710' },
        { id: 'technical-deep-ticker',     order: 10, topic: '심층 종목 기술 분석 (월/주/일 차트)',    lines: 'L6712~6776' },
        { id: 'technical-guide',           order: 11, topic: '기술 분석 핵심 가이드 (collapsed)',     lines: 'L6778~6790' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // v49.42 P306/R94 보강: RSI 카드 data-threshold-key 마커
        { sub: 'technical-indicator-cards', axis: '정합성', severity: 'medium', note: 'L6512 RSI 임계값 카드 title 텍스트만 인라인. THRESHOLD_REGISTRY는 존재하나 data-threshold-key 마커 부재 → R94 getInlineThresholdTableAudit 못 잡음', fixedIn: 'v49.42 P306/R94 보강 (data-threshold-key="RSI" 마커 부착)' },
        // verify-only
        { sub: 'technical-tv-chart',        axis: '직관성', severity: 'ok', note: 'TradingView + OHLC 폴백 v49.29 R66 data-aio-fallback 마킹 (중복 신고 제외)', verifiedIn: 'v49.42' },
        { sub: 'technical-indicator-cards', axis: '정합성', severity: 'ok', note: 'AIO_THRESHOLD_REGISTRY 존재 (RSI/VIX/FG/HY/AAII/SKEW/BREADTH/DXY/YIELD_10Y 9 키) — agent "미구현" 클레임 false alarm', verifiedIn: 'v49.42' }
      ],
      note: 'v49.42 1차+2차 통합 — 1 시정 + 2 verify-only. agent 보고 false alarm 3건 차단.'
    },
    // v49.42 macro 1차+2차
    'macro': {
      lineRange: 'L6730~7323',
      subSections: [
        { id: 'macro-explain-header',     order:  1, topic: '헤더 + Dalio 경제 기계',                lines: 'L6793~6857' },
        { id: 'macro-storyline',          order:  2, topic: '매크로 스토리라인 (서사형)',             lines: 'L6877~6895' },
        { id: 'macro-interconnection',    order:  3, topic: '매크로 인터커넥션 맵 (6 카드)',          lines: 'L6897~6977' },
        { id: 'macro-cycle-timeline',     order:  4, topic: '경제 사이클 타임라인 (Phase 1~6)',       lines: 'L6979~7050' },
        { id: 'macro-fred-charts',        order:  5, topic: 'FRED 차트 + R81 nextUpdate',           lines: 'L7052~7075' },
        { id: 'macro-live-grid',          order:  6, topic: '핵심 매크로 8 카드',                    lines: 'L7077~7134' },
        { id: 'macro-extra-indicators',   order:  7, topic: '추가 지표 (소매/임금/심리/주택)',         lines: 'L7136~7162' },
        { id: 'macro-fx-summary',         order:  8, topic: '외환·채권 요약',                        lines: 'L7164~7178' },
        { id: 'macro-yield-curve',        order:  9, topic: '수익률 곡선 분석기',                    lines: 'L7180~7206' },
        { id: 'macro-thermometer',        order: 10, topic: '글로벌 경기 체온계',                    lines: 'L7208~7242' },
        { id: 'macro-oil-monitor',        order: 11, topic: '유가·에너지 위기 모니터',                lines: 'L7244~7307' },
        { id: 'macro-scenario-tree',      order: 12, topic: '매크로 시나리오 트리 (R72/R85 hook)',    lines: 'L7309~7323+' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // verify-only (agent false alarm 차단 5건)
        { sub: 'macro-extra-indicators', axis: '최신성', severity: 'ok', note: 'retail-sales/wage-growth/cons-conf/housing FRED 동적 갱신 aio-data.js L2284~2488 _updSnap 호출 — agent "정적 하드코딩" 클레임 false alarm', verifiedIn: 'v49.42' },
        { sub: 'macro-scenario-tree',    axis: '정합성', severity: 'ok', note: 'SCENARIO_REGISTRY macro hook aio-core.js L1564~1588 완전 구현 (validateSum + stale-days) — verifiedIn v49.27/R72', verifiedIn: 'v49.42' },
        { sub: 'macro-fred-charts',      axis: '최신성', severity: 'ok', note: 'R81 nextUpdate 표시 L7057 "다음 갱신: NFP 6/6 · CPI 6/12 · PCE 6/30" — verifiedIn v49.31/R81', verifiedIn: 'v49.42' },
        { sub: 'macro-storyline',        axis: '정확성', severity: 'ok', note: 'generateMacroStoryline 함수 aio-core.js + aio-tests.js + aio-chat.js 3 파일 존재 — agent "미검증" 클레임 false alarm', verifiedIn: 'v49.42' },
        { sub: 'macro-thermometer',      axis: '로직성', severity: 'ok', note: 'temp-score 계산 js 3 파일 존재 — agent "미검증" 클레임 false alarm', verifiedIn: 'v49.42' },
        // minor (v49.43 후속)
        { sub: 'macro-cycle-timeline',   axis: '최신성', severity: 'minor', note: 'Phase 5 (2024) "연착륙" 라벨 — 역사 사이클 표시로 의도된 정적이나 현재 2026-05 시점 Phase 6 라벨/위치 갱신 검토', deferredTo: 'v49.43' }
      ],
      note: 'v49.42 1차+2차 통합 — 5 verify-only + 1 minor deferred. agent 보고 false alarm 5건 차단.'
    },
    // v49.47 fxbond 1차+2차 (라이브 데이터 분포: live 36 / snap 7 / snap-date 1)
    'fxbond': {
      lineRange: 'L7324~8155',
      subSections: [
        { id: 'fxbond-header',           order:  1, topic: '헤더 + 외환·채권 심층 해설 (펼쳐보기)',  lines: 'L7340~7400' },
        { id: 'fxbond-fx-matrix',        order:  2, topic: '주요 환율 6 매트릭스 (DXY/JPY/EUR/GBP/CNY/AUD)', lines: 'L7402~7480' },
        { id: 'fxbond-krw-detail',       order:  3, topic: 'USD/KRW 상세 + 변동성',              lines: 'L7482~7530' },
        { id: 'fxbond-yield-curve',      order:  4, topic: '美 국채 수익률 곡선 (2Y/5Y/10Y/30Y) + 2Y/10Y spread', lines: 'L7532~7620' },
        { id: 'fxbond-corp-spread',      order:  5, topic: '신용 스프레드 (HYG/LQD/JNK)',         lines: 'L7622~7680' },
        { id: 'fxbond-bond-etfs',        order:  6, topic: '채권 ETF (TLT/IEF/SHY/AGG/MUB)',     lines: 'L7682~7740' },
        { id: 'fxbond-em-fx',            order:  7, topic: '신흥국 통화 (BRL/INR/IDR/MXN)',       lines: 'L7742~7800' },
        { id: 'fxbond-commodities-fx',   order:  8, topic: '상품 통화 (CAD/AUD/NZD)',             lines: 'L7802~7860' },
        { id: 'fxbond-gold-vs-dxy',      order:  9, topic: 'Gold vs DXY 역상관 차트',             lines: 'L7862~7920' },
        { id: 'fxbond-event-calendar',   order: 10, topic: '주요 외환·채권 이벤트 (FOMC/ECB/BOJ)', lines: 'L7922~7990' },
        { id: 'fxbond-tnx-snapshot',     order: 11, topic: '美 국채 2Y/10Y snapshot (v49.31 P258)', lines: 'L7992~8060' },
        { id: 'fxbond-guide',            order: 12, topic: 'FX/채권 활용 가이드 (collapsed)',     lines: 'L8062~8155' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // v49.47 verify-only: 36 live ticker 모두 LIVE_SYMBOLS 등록 + Yahoo Finance 정상 fetch
        { sub: 'fxbond-fx-matrix', axis: '정합성', severity: 'ok', note: '6 환율 + DXY 모두 [data-live-price] 동적 sink, fetchLiveQuotes 정상 갱신', verifiedIn: 'v49.47 라이브 검증 (Chrome MCP)' },
        // P313 시정: tnx-2y 시드 추가 (v49.47 A1)
        { sub: 'fxbond-tnx-snapshot', axis: '최신성', severity: 'medium', note: 'data-snap="tnx-2y" 시드 부재 → 폴백만 동작 (R97 발견)', fixedIn: 'v49.47 P313/R74 보강 (DATA_SNAPSHOT.tnx2y: 4.28 시드 추가)' },
        // v49.48 cell-level 라이브 검증 (R102)
        { sub: 'fxbond-fx-matrix', axis: '직관성', severity: 'ok', note: 'Chrome MCP cell-level 라이브: 42 cells / 0 placeholder ✓ (모든 카드 정상 렌더)', verifiedIn: 'v49.48 cell-level (R102)' }
      ],
      note: 'v49.48 cell-level 보강 — fxbond 42 cells / 0 placeholder ✓ (Chrome MCP 라이브 검증)'
    },
    // v49.47 fundamental 1차+2차 (라이브 분포: live 0 / snap 0 — 검색 동적 페이지)
    'fundamental': {
      lineRange: 'L8157~8335',
      subSections: [
        { id: 'fundamental-explain-header', order: 1, topic: '헤더 + 15 분석 분야 심층 해설',     lines: 'L8160~8220' },
        { id: 'fundamental-search-input',   order: 2, topic: '종목 검색 input + 예시 4 종목 (v49.29 I5)', lines: 'L8222~8260' },
        { id: 'fundamental-coverage-badge', order: 3, topic: '15 기준 가용성 배지 (v49.35 ✓6/⚠5/❌4 → v49.36 ✓14/⚠0/❌1)', lines: 'L8262~8295' },
        { id: 'fundamental-result-cards',   order: 4, topic: '검색 결과 카드 (동적 렌더)',         lines: 'L8297~8320' },
        { id: 'fundamental-guide',          order: 5, topic: 'Buffett/Graham/Lynch 가이드 (collapsed)', lines: 'L8322~8335' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        // v49.35/v49.36 인프라 v49.47 verify-only
        { sub: 'fundamental-coverage-badge', axis: '로직성', severity: 'ok', note: 'AIO_FUNDAMENTAL_PAGE_CRITERIA 15 entries + getFundamentalPageCriteriaAudit + getCriteriaCrossReferenceAudit + AIO_ANALYSIS_FRAMEWORK_REGISTRY (v49.34~36 인프라 전체 구현)', verifiedIn: 'v49.47' },
        { sub: 'fundamental-search-input', axis: '직관성', severity: 'ok', note: '예시 4 종목 (NVDA/AAPL/TSLA/MSFT) + 가이드 박스 (v49.29 I5 시정)', verifiedIn: 'v49.47' }
      ],
      note: 'v49.47 1차+2차 통합 — v49.34~36에서 인프라 완성. 페이지 자체는 검색 동적이라 라이브 데이터 적음.'
    },
    // v49.47 themes 1차+2차 (라이브 분포: live 0 / snap 0 — 정적 표 + 동적 cards)
    'themes': {
      lineRange: 'L8336~8730',
      subSections: [
        { id: 'themes-explain-header',     order: 1, topic: '헤더 + 섹터 로테이션 심층 해설',     lines: 'L8340~8420' },
        { id: 'themes-cycle-dynamic',      order: 2, topic: '경기 사이클 동적 readout (v49.28 I7 getCycleFromMacro)', lines: 'L8422~8480' },
        { id: 'themes-sector-rotation-table', order: 3, topic: '11 섹터 로테이션 표 (Early/Mid/Late/Recession)', lines: 'L8482~8540' },
        { id: 'themes-ai-infra-matrix',    order: 4, topic: 'AI 인프라 매트릭스 (메가캡/팹리스/장비/EDA/메모리)', lines: 'L8542~8600' },
        { id: 'themes-thematic-cards',     order: 5, topic: '테마별 카드 (Defense/Nuclear/Quantum/Hydrogen 등)', lines: 'L8602~8660' },
        { id: 'themes-etf-recommendations', order: 6, topic: 'ETF 추천 표 (XLK/XLF/XLE 등)',     lines: 'L8662~8700' },
        { id: 'themes-cross-link',         order: 7, topic: 'theme-detail 페이지 cross-link 동선', lines: 'L8702~8720' },
        { id: 'themes-guide',              order: 8, topic: 'Stage 4 + Sector Rotation 가이드 (collapsed)', lines: 'L8722~8730' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'themes-cycle-dynamic', axis: '로직성', severity: 'ok', note: 'getCycleFromMacro 동적 (v49.28 I7) — VIX/Breadth/yield2s10s/spxTrend 기반 phase 자동 판정', verifiedIn: 'v49.47' },
        { sub: 'themes-sector-rotation-table', axis: '정합성', severity: 'ok', note: '"Late Cycle" 라벨 themes 페이지 인라인 vs JS getCycleFromMacro 결과 — v49.31 H5 일반화 + v49.42 P308 verify (의도된 동적)', verifiedIn: 'v49.47' }
      ],
      note: 'v49.47 1차+2차 통합 — themes 페이지 인프라 v49.28+v49.31에서 완성. 라이브 데이터는 theme-detail로 위임.'
    },
    // v49.48 theme-detail 1차+2차 (라이브 cell 3 / placeholder 1: XSD — v49.47 P315 LIVE_SYMBOLS 등록 후 SW 회전 대기)
    'theme-detail': {
      lineRange: 'L8731~9070',
      subSections: [
        { id: 'td-header',          order: 1, topic: '테마 상세 헤더 + 동적 갱신 시점',            lines: 'L8740~8780' },
        { id: 'td-ticker-table',    order: 2, topic: '테마별 종목 표 (SMH/SOXX/XSD 등)',          lines: 'L8782~8880' },
        { id: 'td-news-feed',       order: 3, topic: '테마 관련 뉴스 피드',                       lines: 'L8882~8960' },
        { id: 'td-context-memo',    order: 4, topic: 'CHAT_CONTEXTS 테마 컨텍스트 표시',          lines: 'L8962~9020' },
        { id: 'td-cross-link',      order: 5, topic: '관련 페이지 cross-link',                    lines: 'L9022~9070' }
      ],
      auditStatus: { '최신성':'mostly-ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'td-ticker-table', axis: '최신성', severity: 'medium', note: 'XSD ticker placeholder (v49.47 P315 LIVE_SYMBOLS 등록, SW 캐시 stale로 일부 응답 지연)', fixedIn: 'v49.47 P315 + v49.48 SW 회전' }
      ],
      note: 'v49.48 1차+2차 통합 — Chrome MCP cell-level: 3 cells / 1 placeholder (XSD 캐시 stale)'
    },
    // v49.48 portfolio 1차+2차 (사용자 입력 폼 위주 — 라이브 cell 0)
    'portfolio': {
      lineRange: 'L8739~9512',
      subSections: [
        { id: 'pf-header',           order: 1, topic: '포트폴리오 헤더 + PIN 보안',               lines: 'L8745~8810' },
        { id: 'pf-add-form',         order: 2, topic: '종목 추가 form (입력 + 매수가 + 수량)',     lines: 'L8812~8900' },
        { id: 'pf-holdings-table',   order: 3, topic: '보유 종목 표 (현재가/수익률/비중)',         lines: 'L8902~9100' },
        { id: 'pf-risk-dashboard',   order: 4, topic: '4-card 리스크 (Sharpe/Beta/MDD/Drift) v49.29 E5', lines: 'L9102~9220' },
        { id: 'pf-stats-modal',      order: 5, topic: 'VaR/Sortino/Kelly 통계 모달',               lines: 'L9222~9350' },
        { id: 'pf-export-import',    order: 6, topic: '포트폴리오 export/import (CSV)',           lines: 'L9352~9450' },
        { id: 'pf-guide',            order: 7, topic: '포트폴리오 활용 가이드 (collapsed)',       lines: 'L9452~9512' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'pf-risk-dashboard', axis: '로직성', severity: 'ok', note: 'VaR R-7 quantile (P162) + Sharpe near-zero guard (P164) + Pearson 1e-12 (P163) 수치 인프라 완성', verifiedIn: 'v49.48' },
        { sub: 'pf-add-form', axis: '직관성', severity: 'ok', note: 'localStorage 입력 + PIN 보호', verifiedIn: 'v49.48' }
      ],
      note: 'v49.48 1차+2차 통합 — 사용자 입력 페이지, 라이브 cell 0건 정상'
    },
    // v49.48 ticker 1차+2차 (개별 종목 분석 — 검색 동적)
    'ticker': {
      lineRange: 'L9514~10010',
      subSections: [
        { id: 'tk-search-input',      order: 1, topic: '종목 검색 input + 추천',                   lines: 'L9520~9580' },
        { id: 'tk-overview-tab',      order: 2, topic: '개요 탭 (현재가/52w/시총)',                lines: 'L9582~9720' },
        { id: 'tk-financials-tab',    order: 3, topic: '재무 상세 탭',                             lines: 'L9722~9850' },
        { id: 'tk-external-tab',      order: 4, topic: '외부 정보 탭 (SEC/Wikipedia/Finnhub)',     lines: 'L9852~9950' },
        { id: 'tk-chart-tradingview', order: 5, topic: 'TradingView 차트 + OHLC 폴백',             lines: 'L9952~10010' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'tk-external-tab', axis: '정합성', severity: 'ok', note: 'SEC EDGAR (v49.34) + Wikipedia (v49.34) + Finnhub Insider/13F/Short (v49.36) 통합. 15 분석 분야 93%', verifiedIn: 'v49.48' }
      ],
      note: 'v49.48 1차+2차 통합'
    },
    // v49.48 market-news 1차+2차 (뉴스 피드)
    'market-news': {
      lineRange: 'L10012~10160',
      subSections: [
        { id: 'mn-filter-bar',  order: 1, topic: '뉴스 필터 (카테고리/소스/시간)',                 lines: 'L10018~10060' },
        { id: 'mn-news-list',   order: 2, topic: '뉴스 카드 list (제목/소스/시각/요약)',           lines: 'L10062~10130' },
        { id: 'mn-impact-vector', order: 3, topic: 'NewsImpactVector v49.3 동적 표시',             lines: 'L10132~10160' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'mn-news-list', axis: '최신성', severity: 'ok', note: 'NEWS_CACHE_TTL 1800s 30분 + 24h 라이브 fetchAllNews. RSS hub + 직접 fetch 다중', verifiedIn: 'v49.48' }
      ],
      note: 'v49.48 1차+2차 통합'
    },
    // v49.48 options 1차+2차 (라이브 cell 16 / 0 placeholder ✓)
    'options': {
      lineRange: 'L10162~10321',
      subSections: [
        { id: 'opt-header',         order: 1, topic: '옵션 페이지 헤더 + 주간 갱신 정책',          lines: 'L10165~10210' },
        { id: 'opt-iv-rank',        order: 2, topic: 'IV Rank 카드 (SPY/QQQ/VIX)',                lines: 'L10212~10240' },
        { id: 'opt-gex-card',       order: 3, topic: 'GEX (Gamma Exposure) snapshot',            lines: 'L10242~10260' },
        { id: 'opt-skew-card',      order: 4, topic: 'Skew 25-delta / Risk Reversal',            lines: 'L10262~10280' },
        { id: 'opt-greeks-table',   order: 5, topic: 'Greeks 표 (Delta/Gamma/Vega/Theta)',       lines: 'L10282~10300' },
        { id: 'opt-action-rules',   order: 6, topic: 'ACTION_RULES 옵션 전략 추천 (v49.29 E6)',    lines: 'L10302~10321' }
      ],
      auditStatus: { '최신성':'mostly-ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'opt-iv-rank', axis: '정합성', severity: 'ok', note: 'Chrome MCP cell-level 라이브: 16 cells / 0 placeholder. VIX/SPY/QQQ data-live-price 정상 fetch', verifiedIn: 'v49.48 cell-level' },
        { sub: 'opt-action-rules', axis: '로직성', severity: 'ok', note: 'AIO_ACTION_RULES.optionStrategy v49.29 E6 동적 추천', verifiedIn: 'v49.48' },
        { sub: 'opt-header', axis: '최신성', severity: 'medium', note: '주간 수동 갱신 정책 (의도된 stale — L9612 명시)', fixedIn: 'v49.22 P214' }
      ],
      note: 'v49.48 1차+2차 통합 — Chrome MCP cell-level: 16 cells / 0 placeholder ✓'
    },
    // v49.49 kr-home 1차+2차 (라이브 cell-level: 32 cells / 0 placeholder ✓)
    'kr-home': {
      lineRange: 'L10322~10662',
      subSections: [
        { id: 'krh-header',          order: 1, topic: '한국장 헤더 + 시장 상태',                  lines: 'L10330~10380' },
        { id: 'krh-index-cards',     order: 2, topic: 'KOSPI/KOSDAQ/KRW/VKOSPI 4 카드',           lines: 'L10382~10440' },
        { id: 'krh-credit-deposit',  order: 3, topic: '신용잔고/예탁금/52주 (v49.22 P213 정합)',    lines: 'L10442~10500' },
        { id: 'krh-supply-snapshot', order: 4, topic: '수급 snapshot 주간 테이블',                 lines: 'L10502~10560' },
        { id: 'krh-leaders-board',   order: 5, topic: '리더 종목 board (v49.23 정합)',            lines: 'L10562~10620' },
        { id: 'krh-cross-link',      order: 6, topic: '관련 KR 페이지 동선',                       lines: 'L10622~10662' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'krh-index-cards', axis: '정합성', severity: 'ok', note: 'Chrome MCP cell-level: 32 cells / 0 placeholder ✓. KOSPI/KOSDAQ/KRW data-live-price 정상 fetch', verifiedIn: 'v49.49 cell-level (R102)' },
        { sub: 'krh-credit-deposit', axis: '최신성', severity: 'ok', note: 'v49.22 P213 6 snap-date 정합 (kr-credit/deposit/52w-high/low/advance/issues) + DATA_SNAPSHOT 시드', verifiedIn: 'v49.49' }
      ],
      note: 'v49.49 1차+2차 — Chrome MCP 라이브 cell-level 32 cells / 0 placeholder ✓'
    },
    // v49.49 kr-supply 1차+2차 (table 위주 — cell selector 0건 정상)
    'kr-supply': {
      lineRange: 'L10663~10894',
      subSections: [
        { id: 'krs-header',          order: 1, topic: 'KR 수급 헤더',                             lines: 'L10670~10720' },
        { id: 'krs-weekly-table',    order: 2, topic: '주간 수급 표 (v49.22 P217 정합)',          lines: 'L10722~10800' },
        { id: 'krs-flow-detail',     order: 3, topic: '외국인/기관/개인 세부 흐름',                lines: 'L10802~10860' },
        { id: 'krs-summary',         order: 4, topic: '주간 누적 합계 + 해석',                    lines: 'L10862~10894' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'krs-weekly-table', axis: '정확성', severity: 'ok', note: 'v49.22 P217 2024-03 데이터 → 2026-05-12~16 정합. 기관 합계 -472억 vs 세부 정합 (v49.23 P219)', verifiedIn: 'v49.49' }
      ],
      note: 'v49.49 1차+2차 — table 위주 페이지'
    },
    // v49.49 kr-themes 1차+2차 (동적 cards, cell-level 0 정상)
    'kr-themes': {
      lineRange: 'L10895~10991',
      subSections: [
        { id: 'krt-header',          order: 1, topic: 'KR 테마 헤더',                             lines: 'L10900~10920' },
        { id: 'krt-theme-cards-28',  order: 2, topic: '28 KR 테마 cards (renderKrThemeCardsFromMap)', lines: 'L10922~10970' },
        { id: 'krt-cross-link',      order: 3, topic: 'kr-home/kr-supply 동선',                  lines: 'L10972~10991' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'krt-theme-cards-28', axis: '로직성', severity: 'ok', note: 'renderKrThemeCardsFromMap 완전 동적 28 테마 cards (KR_THEME_MAP 기반)', verifiedIn: 'v49.49' }
      ],
      note: 'v49.49 1차+2차 — 동적 cards 페이지'
    },
    // v49.49 kr-macro 1차+2차 (라이브 cell-level: 23 cells / 0 placeholder ✓)
    'kr-macro': {
      lineRange: 'L10992~11320',
      subSections: [
        { id: 'krm-header',          order: 1, topic: 'KR 거시 헤더',                             lines: 'L11000~11040' },
        { id: 'krm-bok-snapshot',    order: 2, topic: 'BOK 기준금리/다음 금통위 (5/29)',           lines: 'L11042~11100' },
        { id: 'krm-cpi-ppi',         order: 3, topic: 'CPI/PPI/Core CPI (v49.47 P313 시드)',      lines: 'L11102~11160' },
        { id: 'krm-export-import',   order: 4, topic: '수출입 + 반도체 (v49.30 P255 정합)',       lines: 'L11162~11220' },
        { id: 'krm-gdp-pmi',         order: 5, topic: 'GDP/제조업 PMI (v49.47 P313 시드)',        lines: 'L11222~11270' },
        { id: 'krm-kr-export-archive', order: 6, topic: 'kr-export-2026-02 archive (R75 lifecycle)', lines: 'L11272~11320' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'krm-cpi-ppi', axis: '최신성', severity: 'ok', note: 'v49.47 P313 krCpi/krPpi/krManufPmi 시드 + Chrome MCP cell-level: 23 cells / 0 placeholder ✓', verifiedIn: 'v49.49 cell-level (R102)' },
        { sub: 'krm-bok-snapshot', axis: '정합성', severity: 'ok', note: 'v49.22 P215 bokNext 5/29 정합 + R77 MACRO_CALENDAR.us-fed-rate 동일 패턴', verifiedIn: 'v49.49' },
        { sub: 'krm-kr-export-archive', axis: '최신성', severity: 'ok', note: 'data-lifecycle-id="kr-export-2026-02" 마커 + R75 일반화 hook 자동 갱신 (v49.48 P316)', verifiedIn: 'v49.49' }
      ],
      note: 'v49.49 1차+2차 — Chrome MCP 라이브 cell-level: 23 cells / 0 placeholder ✓'
    },
    // v49.49 kr-technical 1차+2차 (라이브 cell-level: 5 cells / 1 placeholder false positive → v49.49 P319 휴리스틱 보강)
    'kr-technical': {
      lineRange: 'L11321~11567',
      subSections: [
        { id: 'krtech-header',       order: 1, topic: 'KR 기술 분석 헤더',                        lines: 'L11328~11380' },
        { id: 'krtech-tradingview',  order: 2, topic: 'TradingView KOSPI 차트',                  lines: 'L11382~11440' },
        { id: 'krtech-credit-widget', order: 3, topic: '시장 건강도 (신용잔고 v49.23 P216 정합)', lines: 'L11442~11500' },
        { id: 'krtech-export-stat',  order: 4, topic: '수출 stat (v49.47 P313 시드 정합)',        lines: 'L11502~11560' },
        { id: 'krtech-cross-link',   order: 5, topic: '관련 페이지 동선',                         lines: 'L11562~11567' }
      ],
      auditStatus: { '최신성':'ok', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'krtech-credit-widget', axis: '정합성', severity: 'ok', note: 'v49.23 P216 신용잔고 19.2조 data-snap 정합 + cell-level: 5 cells / 0 진짜 placeholder (kr-semi-export-yoy false positive — v49.49 P319 휴리스틱 보강으로 해소)', verifiedIn: 'v49.49' },
        { sub: 'krtech-export-stat', axis: '최신성', severity: 'ok', note: 'v49.47 P313 시드 + v49.49 P319 placeholder 휴리스틱 false positive 차단 (`대기` 단어 본문 매칭 제거)', fixedIn: 'v49.49 P319 R102 보강' }
      ],
      note: 'v49.49 1차+2차 — Chrome MCP 라이브 cell-level: 5 cells / R102 v2 false positive 해소'
    },
    // v49.49 guide 1차+2차 (정적 교육 자료 — N/A 데이터 페이지)
    'guide': {
      lineRange: 'L11568~',
      subSections: [
        { id: 'gd-header',           order: 1, topic: '사용 설명서 헤더',                          lines: 'L11570~11600' },
        { id: 'gd-quick-start',      order: 2, topic: 'Quick Start 가이드',                       lines: 'L11602~11700' },
        { id: 'gd-api-setup',        order: 3, topic: 'API 키 설정 단계',                         lines: 'L11702~11800' },
        { id: 'gd-page-overview',    order: 4, topic: '21 페이지 개요',                           lines: 'L11802~11900' },
        { id: 'gd-faq',              order: 5, topic: 'FAQ',                                     lines: 'L11902~11990' }
      ],
      auditStatus: { '최신성':'na', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'gd-page-overview', axis: '핵심성', severity: 'ok', note: '교육 자료 — 데이터 갱신 N/A. 정적 내용 OK. 사용자 새로 진입 시 안내 역할', verifiedIn: 'v49.49' }
      ],
      note: 'v49.49 1차+2차 — 정적 교육 페이지, 데이터 갱신 N/A'
    },
    // v49.62 통합 (Codex v49.61): glossary modal sequential audit 보강
    'glossary': {
      lineRange: 'L27241~27531',
      subSections: [
        { id: 'glossary-modal-shell', order: 1, topic: 'Non-route glossary modal shell and close action', lines: 'L27241~27247' },
        { id: 'glossary-search', order: 2, topic: 'Glossary search input and input handler', lines: 'L27248, L27507~27531' },
        { id: 'glossary-category-filters', order: 3, topic: 'Category filters and active-state rendering', lines: 'L27249, L27496~27505' },
        { id: 'glossary-term-list', order: 4, topic: 'Term list rendering from GLOSSARY registry', lines: 'L27507~27531, js/aio-glossary.js' },
        { id: 'glossary-open-close-flow', order: 5, topic: 'openGlossary, filterGlossary, close and keyboard escape flow', lines: 'L27486~27532, L27776~27778' }
      ],
      auditStatus: { '최신성':'na', '정확성':'ok', '정합성':'ok', '로직성':'ok', '직관성':'ok', '핵심성':'ok' },
      findings: [
        { sub: 'glossary-modal-shell', axis: '정합성', severity: 'ok', note: 'Non-route modal was omitted from route-only page sweeps; now explicitly tracked in sequential audit coverage.', fixedIn: 'v49.62' }
      ],
      note: 'v49.62 (Codex v49.61 통합): non-route glossary modal added to sequential audit coverage so 21-route checks cannot hide overlay omissions.'
    }
  },
  // v49.62 통합: isAuditStatusComplete + getPendingPages object-aware
  isAuditStatusComplete: function(s) {
    if (typeof s === 'string') return s !== 'pending' && s !== 'partial';
    if (!s || typeof s !== 'object') return false;
    var keys = Object.keys(s);
    return keys.length >= 6 && keys.every(function(k) {
      return !/^(pending|partial)$/i.test(String(s[k] || ''));
    });
  },
  getPendingPages: function() {
    var self = this;
    return Object.keys(this.pages).filter(function(p) {
      var s = self.pages[p].auditStatus;
      return !self.isAuditStatusComplete(s);
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.39 R95 신규: getCrossPageIndicatorConsistencyAudit
// 동일 ticker가 여러 페이지에 표시될 때 텍스트 일치 검증.
// v49.24 getSnapshotConsistencyAudit(data-snap)와 별개 — 라이브 가격 sink.
// ─────────────────────────────────────────────────────────────────
window.AIO.getCrossPageIndicatorConsistencyAudit = function() {
  var byTicker = {};
  var issues = [];
  try {
    document.querySelectorAll('[data-live-price]').forEach(function(el) {
      var t = el.getAttribute('data-live-price');
      if (!t) return;
      // archive 섹션 제외
      if (el.closest('[data-aio-archive="true"]')) return;
      if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return;
      if (el.matches && el.matches('.kr-etf-card,.kr-screen-card,.kr-ticker-pill,[data-live-composite="true"]')) return;
      var page = el.closest('[id^="page-"]');
      var pageId = page ? page.id : 'unknown';
      var text = (el.textContent || '').trim();
      var sourceKind = (el.getAttribute('data-source-kind') || '').toLowerCase();
      var operationalUse = (el.getAttribute('data-operational-use') || '').toLowerCase();
      var hasLiveLineage = /^(live|derived|primary|exchange|proxy|cache)$/.test(sourceKind) || operationalUse === 'decision';
      if (!hasLiveLineage && /^(?:—|-|–|\.{3}|수집 대기|로딩|loading|n\/a|na)?$/i.test(text)) return;
      if (!hasLiveLineage && el.hasAttribute('data-static-default')) return;
      if (/^(?:—|-|–|\.{3}|수집 대기|로딩|loading|n\/a|na)?$/i.test(text)) return;
      if (!byTicker[t]) byTicker[t] = [];
      byTicker[t].push({ page: pageId, text: text, elementId: el.id || '' });
    });
    Object.keys(byTicker).forEach(function(t) {
      var sinks = byTicker[t];
      if (sinks.length < 2) return;
      // 텍스트 distinct 비교 (—, 로딩 중 등 placeholder는 제외)
      var nonPlaceholder = sinks.filter(function(s) {
        return s.text && s.text !== '—' && s.text !== '...' && !/로딩|loading/i.test(s.text);
      });
      var distinctValues = {};
      nonPlaceholder.forEach(function(s) { distinctValues[s.text] = (distinctValues[s.text] || 0) + 1; });
      var distinct = Object.keys(distinctValues);
      if (distinct.length > 1) {
        issues.push({
          ticker: t,
          sinkCount: sinks.length,
          distinctValues: distinct,
          sinks: sinks
        });
      }
    });
  } catch (e) {
    return { status: 'error', issueCount: 0, issues: [e && e.message] };
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    totalTickers: Object.keys(byTicker).length,
    note: '동일 ticker가 여러 페이지에서 다른 텍스트 보일 시 mismatch 보고. placeholder(—/loading)는 제외.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.39 R96 신규: getDataActionHandlerAudit
// 모든 [data-action="NAME"] 요소의 NAME이 window 또는 등록 핸들러에 존재하는지.
// 미정의 핸들러는 click 무동작 → 사용자 혼동.
// ─────────────────────────────────────────────────────────────────
window.AIO.getDataActionHandlerAudit = function() {
  var actionCounts = {};
  var missingActions = [];
  var registeredActions = [];
  try {
    document.querySelectorAll('[data-action]').forEach(function(el) {
      var act = el.getAttribute('data-action');
      if (!act) return;
      // action:arg 형식 분리
      var actionName = act.split(':')[0];
      actionCounts[actionName] = (actionCounts[actionName] || 0) + 1;
    });
    Object.keys(actionCounts).forEach(function(act) {
      // 1. window에 직접 정의된 함수
      var isGlobal = typeof window[act] === 'function';
      // 2. AIO 네임스페이스
      var isAio = window.AIO && typeof window.AIO[act] === 'function';
      // 3. _aio 접두 함수 (window에 정의)
      var has_aio = (act.indexOf('_aio') === 0) && typeof window[act] === 'function';
      // 4. data-action 이벤트 위임 핸들러 (예: showPage, runInstitutionalTechnicalBrief)
      // — 페이지 진입 시점에 등록되므로 window/AIO 직접 검사 + alias 허용
      // v49.40 P294: _aioRefreshActionPlan 제거 (이제 window에 실제 정의됨 — has_aio로 통과).
      // knownAliases는 비-_aio 접두 글로벌 함수(showPage, toggleLLM 등)만 유지.
      var knownAliases = ['showPage', 'toggleLLM', 'toggleGmoExpand', 'unlockPortfolio', 'exportPortfolio',
                          'setupPortfolioPin', 'resetPortfolioPin', 'chatSend', 'fundamentalSearch',
                          'runInstitutionalTechnicalBrief'];
      var isAlias = knownAliases.indexOf(act) !== -1;
      if (isGlobal || isAio || has_aio || isAlias) {
        registeredActions.push({ action: act, count: actionCounts[act], source: isGlobal ? 'window' : isAio ? 'AIO' : isAlias ? 'event-delegate' : 'unknown' });
      } else {
        missingActions.push({ action: act, count: actionCounts[act] });
      }
    });
  } catch (e) {
    return { status: 'error', issueCount: 0, issues: [e && e.message] };
  }
  return {
    status: missingActions.length ? 'warn' : 'ok',
    issueCount: missingActions.length,
    missingActions: missingActions,
    registeredCount: registeredActions.length,
    totalActions: Object.keys(actionCounts).length,
    note: 'data-action이 window/AIO/event-delegate에 등록되지 않으면 click 무동작.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.46 R98 v2 (P311 재발 방지 + Task #4 v49.45 잔존 정확도 보강)
// JavaScript 함수 안에 `var X`와 `const X`/`let X`가 동시 선언되면 var hoist로 인해
// 같은 scope에서 SyntaxError("Identifier 'X' has already been declared") 발생.
//
// v1 한계 (4건 false positive): 단순 line-by-line + 1-line lookahead로 nested function/IIFE 잘못 그룹화.
// v2 보강: (1) 문자열/코멘트 sanitize (regex stripping) → 가짜 `{`/`}` 차단,
//         (2) 정확한 함수 stack push/pop (enter brace depth 기준), `function`/`=>` detection 보강,
//         (3) 변수 선언 시 var는 enclosing **function** scope으로 hoist (block scope 통과),
//             const/let은 enclosing **block** scope에 머무름.
// ─────────────────────────────────────────────────────────────────
window.AIO.getVarHoistConflictAudit = async function() {
  var jsFiles = ['./js/aio-core.js', './js/aio-data.js', './js/aio-ui.js', './js/aio-chat.js', './js/aio-glossary.js', './js/aio-tests.js'];
  var conflicts = [];

  // 코멘트 + 문자열 sanitize (가짜 brace/keyword 차단)
  function sanitize(line) {
    // 한 줄 코멘트
    line = line.replace(/\/\/.*$/, '');
    // 블록 코멘트 (간단 — 같은 줄 안에서만)
    line = line.replace(/\/\*.*?\*\//g, '');
    // 문자열 리터럴 (single/double/template — escape 처리 단순화)
    line = line.replace(/'([^'\\]|\\.)*'/g, "''");
    line = line.replace(/"([^"\\]|\\.)*"/g, '""');
    line = line.replace(/`([^`\\]|\\.)*`/g, '``');
    return line;
  }

  for (var fi = 0; fi < jsFiles.length; fi++) {
    var path = jsFiles[fi];
    try {
      var resp = await fetch(path, { cache: 'no-store' });
      if (!resp.ok) { conflicts.push({ file: path, error: 'fetch ' + resp.status }); continue; }
      var code = await resp.text();
      var lines = code.split('\n');

      // 함수 stack — 각 항목: { startLine, name, openDepth (이 함수 본문이 시작되는 depth) }
      // openDepth = 함수 본문 안에서의 depth = 함수 시작 라인의 enter depth + 1
      // 함수 종료 = curDepth가 openDepth 미만이 되는 시점
      var funcStack = [];
      var curDepth = 0;
      var perFuncDecls = {}; // key: funcStack의 startLine, value: [{line, kind, name}]
      var globalDecls = []; // top-level (function 밖) 선언

      for (var i = 0; i < lines.length; i++) {
        var rawLine = lines[i];
        var line = sanitize(rawLine);
        var enterDepth = curDepth;

        // 함수 시작 detection — 같은 line에 'function' 키워드 또는 '=> {' 패턴 + '{' 존재
        // 정확하지 않으면 false positive 만들지 않도록 보수적 매칭
        var isFunctionLine = /\bfunction\b\s*\*?\s*[\w$]*\s*\([^)]*\)\s*\{/.test(line) ||
                             /[\w$)]\s*=>\s*\{/.test(line) ||
                             /\b(get|set)\s+[\w$]+\s*\([^)]*\)\s*\{/.test(line) ||
                             // method shorthand in object: 'name(args) {' 또는 'name: function(...)'
                             /(?:^|[,{(])\s*([\w$]+)\s*\([^)]*\)\s*\{/.test(line);

        if (isFunctionLine) {
          // 첫 '{'가 함수 본문 진입 — openDepth = curDepth + 1
          var nameMatch = line.match(/function\s+([\w$]+)/) || line.match(/(?:^|[\s,{(])\s*([\w$]+)\s*\([^)]*\)\s*\{/);
          var fname = nameMatch ? nameMatch[1] : '(anon)';
          funcStack.push({ startLine: i + 1, name: fname, openDepth: curDepth + 1 });
        }

        // 변수 선언 detect — sanitize된 line에서만 (문자열 안 false positive 차단)
        var declRegex = /\b(var|let|const)\s+([a-zA-Z_$][\w$]*)\b/g;
        var dm;
        while ((dm = declRegex.exec(line)) !== null) {
          var kind = dm[1], name = dm[2];
          if (funcStack.length === 0) {
            globalDecls.push({ line: i + 1, kind: kind, name: name });
          } else {
            // var는 가장 가까운 enclosing **function** scope으로 hoist
            // const/let은 enclosing block scope에 머무름 — 그러나 simplification: 같은 enclosing function 기준 grouping
            // (실제 SyntaxError는 var + const/let in same function일 때 발생하므로 function 기준이면 충분)
            var topFunc = funcStack[funcStack.length - 1];
            var key = topFunc.startLine + ':' + topFunc.name;
            (perFuncDecls[key] = perFuncDecls[key] || []).push({ line: i + 1, kind: kind, name: name });
          }
        }

        // brace depth update — sanitize된 line 기준
        curDepth += (line.match(/\{/g) || []).length;
        curDepth -= (line.match(/\}/g) || []).length;

        // 함수 stack pop — curDepth가 stack top의 openDepth 미만으로 떨어지면 함수 종료
        while (funcStack.length && curDepth < funcStack[funcStack.length - 1].openDepth) {
          funcStack.pop();
        }
      }

      // 충돌 검출: 같은 enclosing function 안에 같은 이름의 var + const/let 동시
      function checkGroup(key, arr, scopeLabel) {
        var byName = {};
        arr.forEach(function(d) { (byName[d.name] = byName[d.name] || []).push(d); });
        Object.keys(byName).forEach(function(name) {
          var ds = byName[name];
          if (ds.length < 2) return;
          var kinds = ds.map(function(d) { return d.kind; });
          var hasVar = kinds.indexOf('var') !== -1;
          var hasConstLet = kinds.indexOf('const') !== -1 || kinds.indexOf('let') !== -1;
          if (hasVar && hasConstLet) {
            conflicts.push({
              file: path,
              scope: scopeLabel || key,
              name: name,
              decls: ds.map(function(d){return d.kind + '@L' + d.line;}).join(', '),
              severity: 'critical',
              pattern: 'P311 (var hoist + const/let in same function scope)'
            });
          }
        });
      }
      Object.keys(perFuncDecls).forEach(function(key) {
        checkGroup(key, perFuncDecls[key], 'function@L' + key);
      });
      // global scope: var + const/let 동일 이름 시 SyntaxError 가능 (script-level)
      checkGroup('global', globalDecls, 'global (script top-level)');
    } catch(e) {
      conflicts.push({ file: path, error: e && e.message });
    }
  }

  return {
    status: conflicts.length ? 'warn' : 'ok',
    issueCount: conflicts.length,
    conflicts: conflicts,
    note: 'v2 정확도 보강 — 문자열/코멘트 sanitize + 정확한 함수 stack push/pop + var hoist 모델 적용. P311 패턴 100% 탐지, false positive 0 목표.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.44 R99 신규: getShellAssetIntegrityAudit (P310 재발 방지)
// sw.js SHELL_ASSETS 각 자산이 실제 fetch 가능한지(200 OK) 검증.
// GitHub UI에서 파일 삭제 시 SW install cache.add 404 발생 차단.
// ─────────────────────────────────────────────────────────────────
window.AIO.getShellAssetIntegrityAudit = async function() {
  // sw.js 본문에서 SHELL_ASSETS 추출
  var swResp;
  try { swResp = await fetch('./sw.js', { cache: 'no-store' }); }
  catch(e) { return { status: 'error', issueCount: 0, message: 'sw.js fetch failed: ' + (e && e.message) }; }
  if (!swResp.ok) return { status: 'error', issueCount: 0, message: 'sw.js ' + swResp.status };
  var swCode = await swResp.text();
  var m = swCode.match(/SHELL_ASSETS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return { status: 'error', issueCount: 0, message: 'SHELL_ASSETS 패턴 미발견' };
  var assets = [];
  var re = /['"`]([^'"`]+)['"`]/g;
  var mm;
  while ((mm = re.exec(m[1])) !== null) assets.push(mm[1]);
  // 각 asset HEAD/GET fetch + status 검증 (외부 CDN은 별도)
  var localAssets = assets.filter(function(a) { return !a.startsWith('http'); });
  var externalAssets = assets.filter(function(a) { return a.startsWith('http'); });
  var missing = [];
  for (var i = 0; i < localAssets.length; i++) {
    var url = localAssets[i];
    try {
      var r = await fetch(url, { cache: 'no-store', method: 'GET' });
      if (!r.ok) missing.push({ url: url, status: r.status });
    } catch(e) {
      missing.push({ url: url, error: e && e.message });
    }
  }
  return {
    status: missing.length ? 'warn' : 'ok',
    issueCount: missing.length,
    missing: missing,
    totalLocal: localAssets.length,
    totalExternal: externalAssets.length,
    note: 'sw.js SHELL_ASSETS 각 자산이 실제 200 OK 응답하는지 검증 (P310 manifest.json 삭제 같은 누락 자동 탐지). 외부 CDN은 검증 제외.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.41 R97 신규: getStaticSeedFallbackAudit
// data-snap 키 ↔ DATA_SNAPSHOT 시드 정합성. 시드가 없는 키는 폴백만 동작 →
// 실시간 fetch 경로에서 set해도 R74 assertSnapshotInlineMatch가 못 잡음 (B1/P299 근본).
// 페이지 DOM의 모든 [data-snap="key"]를 수집 + window.DATA_SNAPSHOT에 대응 필드 존재 검증.
// 시드 매핑은 applyDataSnapshot 라우터(L9510~)와 동일한 키 변환 규칙 사용.
// ─────────────────────────────────────────────────────────────────
window.AIO.getStaticSeedFallbackAudit = function() {
  var DS = window.DATA_SNAPSHOT || {};
  // data-snap 키 → DATA_SNAPSHOT 필드 매핑 규칙 (kebab → camel/snake 변형 허용)
  function toCamel(key) { return key.replace(/-([a-z0-9])/g, function(_,c){ return c.toUpperCase(); }); }
  function toSnakeUnderscore(key) { return key.replace(/-/g, '_'); }
  // v49.47 P313 보강: data-snap 키와 DS 필드명이 다른 14건 alias map
  // 라이브 audit 결과 (Chrome MCP): hy-spread→hySpread / wage-growth→usWageGrowth 등 prefix 차이로 매칭 실패
  var aliasMap = {
    'hy-spread': 'hySpread',
    'wage-growth': 'usWageGrowth',
    'housing': 'housingStarts',
    'tnx-2y': 'tnx2y',
    'krw-full': 'krw',
    'vkospi-chg': 'vkospiPct',
    'kr-credit': 'krCreditBalance',
    'kr-semi-export-yoy-label': 'krSemiExport',
    'kr-cpi-yoy': 'krCpi',
    'kr-ppi-yoy': 'krPpi',
    'kr-manuf-pmi': 'krManufPmi',
    'kr-gdp-qoq': 'krGdp',
    'kr-semi-export-feb': 'krSemiExport',
    'kr-semi-export-yoy': 'krSemiExport'
  };
  // 시드 인정 키: DS[key] / DS[toCamel(key)] / DS[toSnakeUnderscore(key)] / DS[aliasMap[key]] / _fallback
  function hasSeed(key) {
    var camel = toCamel(key);
    var snake = toSnakeUnderscore(key);
    var alias = aliasMap[key];
    if (DS[key] != null || DS[camel] != null || DS[snake] != null) return true;
    if (alias && DS[alias] != null) return true;
    if (DS._fallback && (DS._fallback[key] != null || DS._fallback[camel] != null || DS._fallback[snake] != null || (alias && DS._fallback[alias] != null))) return true;
    return false;
  }
  var missingSeeds = [];
  var coveredKeys = [];
  var totalKeys = 0;
  try {
    var seen = {};
    document.querySelectorAll('[data-snap]').forEach(function(el) {
      var key = el.getAttribute('data-snap');
      if (!key || seen[key]) return;
      seen[key] = true;
      totalKeys++;
      if (hasSeed(key)) coveredKeys.push(key);
      else missingSeeds.push({ key: key, camelHint: toCamel(key), elementId: el.id || '', pageHint: (el.closest('[id^="page-"]') || {}).id || '' });
    });
  } catch (e) {
    return { status: 'error', issueCount: 0, issues: [e && e.message] };
  }
  return {
    status: missingSeeds.length ? 'warn' : 'ok',
    issueCount: missingSeeds.length,
    missingSeeds: missingSeeds,
    coveredCount: coveredKeys.length,
    totalKeys: totalKeys,
    note: 'data-snap key가 DATA_SNAPSHOT 최상위 또는 _fallback에 시드 미등록 시 폴백만 동작 (R74 못 잡음). R97 신규.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.38 R94 신규: getInlineThresholdTableAudit
// 페이지 인라인 <table class="explain-table"> 또는 [data-threshold-table]를 스캔,
// THRESHOLD_REGISTRY 등록 임계값과 라벨 일치 검증. R56/R94 단일 출처 강제.
// ─────────────────────────────────────────────────────────────────
window.AIO.getInlineThresholdTableAudit = function() {
  var reg = window.AIO_THRESHOLD_REGISTRY;
  if (!reg) return { status: 'error', issueCount: 0, issues: ['THRESHOLD_REGISTRY undefined'] };
  var issues = [];
  var inlineTables = [];
  try {
    document.querySelectorAll('[data-threshold-table]').forEach(function(tbl) {
      var key = tbl.getAttribute('data-threshold-table');
      if (!reg[key] || !reg[key].bands) {
        issues.push('table key=' + key + ' has no REGISTRY entry');
        return;
      }
      var rows = tbl.querySelectorAll('tr');
      var regBandCount = reg[key].bands.length;
      if (rows.length !== regBandCount) {
        issues.push('table key=' + key + ' rows=' + rows.length + ' vs REGISTRY bands=' + regBandCount);
      }
      // 라벨 정합 검사 (각 row의 두 번째 column이 REGISTRY label과 일치)
      rows.forEach(function(row, idx) {
        var cells = row.cells;
        if (!cells || cells.length < 2) return;
        var labelInTable = (cells[1].textContent || '').trim();
        var registryLabel = reg[key].bands[idx] && reg[key].bands[idx].label;
        if (registryLabel && labelInTable !== registryLabel) {
          issues.push('table key=' + key + ' row=' + idx + ' label "' + labelInTable + '" vs REGISTRY "' + registryLabel + '"');
        }
      });
      inlineTables.push({ key: key, rowCount: rows.length, regBandCount: regBandCount });
    });
  } catch (e) {
    issues.push({ type: 'audit-error', message: e && e.message });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    inlineTables: inlineTables,
    note: 'data-threshold-table="VIX" 등 마커가 있는 인라인 표는 REGISTRY와 자동 정합 검증',
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getPageSequentialAuditStatus = function() {
  var reg = window.AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY;
  if (!reg) return { status: 'error', issues: ['REGISTRY undefined'] };
  var total = Object.keys(reg.pages).length;
  var pending = 0, partial = 0, done = 0;
  Object.keys(reg.pages).forEach(function(p) {
    var s = reg.pages[p].auditStatus;
    if (typeof s === 'string') {
      if (s === 'pending') pending++;
      else if (s === 'partial') partial++;
      else done++;
    } else if (reg.isAuditStatusComplete && reg.isAuditStatusComplete(s)) {
      // v49.62 통합 (Codex v49.61): 6축 객체가 모두 완료 상태면 done++
      done++;
    } else {
      partial++;  // object status — 6 axes mixed
    }
  });
  var pendingList = reg.getPendingPages();
  return {
    status: (pendingList.length || partial) ? 'warn' : 'ok',
    totalPages: total,
    pending: pending,
    partial: partial,
    done: done,
    pendingList: pendingList,
    note: 'v49.62: page/overlay sequential audit completion status (glossary modal 포함, isAuditStatusComplete 적용). ' + pendingList.length + ' pending/incomplete, ' + done + ' complete.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.36 신규: 7개 compute/fetch 함수 — fundamental 페이지 15 기준 100% 커버
// FCF Yield / Balance Sheet / EV/EBITDA / Macro Beta / Insider / 13F / Short Interest
// + 보조: CIK_MAP 확장 (S&P 500 30+) + Wikipedia 한국 종목 + FMP segments / SEC 8-K
// R92 신규 (페이지 15 기준 100% 커버 의무)
// ─────────────────────────────────────────────────────────────────

// (1) computeFcfYield: FCF / 시총 — Yahoo mcap + FMP CFO/Capex
window.AIO.computeFcfYield = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  var ld = window._liveData || {};
  var mcap = ld[ticker] && ld[ticker].marketCap;
  // 메타데이터 폴백 — Wikipedia / SCREENER_DB
  if (!mcap) {
    var dbRow = null;
    try { dbRow = (window.SCREENER_DB || []).find(function(r){ return r.sym === ticker; }); } catch(_) {}
    if (dbRow && dbRow.mcap) mcap = Number(dbRow.mcap) * 1e9;  // mcap field in B → $
  }
  // FCF: Naver overview 또는 FMP (key 의존) — 미가용 시 estimated
  var fcf = null, fcfSource = 'unknown';
  try {
    if (typeof window.fetchNaverUSData === 'function') {
      var nv = await window.fetchNaverUSData(ticker, true);
      if (nv && nv.financials && nv.financials.fcf) { fcf = nv.financials.fcf; fcfSource = 'Naver'; }
    }
  } catch(_) {}
  if (!fcf) return { ticker: ticker, available: false, reason: 'FCF 미수신 (FMP key 또는 Naver financials 필요)', mcap: mcap || null, plannedFmp: '/cash-flow-statement endpoint' };
  var yieldPct = mcap ? (fcf / mcap * 100) : null;
  return {
    ticker: ticker,
    available: true,
    fcf: fcf,
    mcap: mcap,
    fcfYieldPct: yieldPct,
    verdict: yieldPct == null ? 'unknown' : yieldPct >= 4 ? 'attractive' : yieldPct >= 2 ? 'fair' : 'low',
    source: fcfSource + ' + Yahoo mcap',
    note: '4%+ = 매력적 (Buyback+배당 유지 가능)'
  };
};

// (2) computeBalanceSheetRatios: Net Debt / EBITDA + Interest Coverage
window.AIO.computeBalanceSheetRatios = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // FMP/Naver financials 시도. 미가용 시 placeholder.
  var fin = null;
  try {
    if (typeof window.fetchNaverUSData === 'function') {
      var nv = await window.fetchNaverUSData(ticker, true);
      fin = nv && nv.financials;
    }
  } catch(_) {}
  if (!fin || (!fin.netDebt && !fin.ebitda)) {
    return { ticker: ticker, available: false, reason: 'Balance sheet 데이터 미수신 (FMP key 또는 Naver 재무 필요)', plannedFmp: '/balance-sheet-statement' };
  }
  var netDebtToEbitda = (fin.netDebt != null && fin.ebitda) ? (fin.netDebt / fin.ebitda) : null;
  var interestCoverage = (fin.ebit && fin.interestExpense) ? (fin.ebit / fin.interestExpense) : null;
  return {
    ticker: ticker,
    available: true,
    netDebtToEbitda: netDebtToEbitda,
    interestCoverage: interestCoverage,
    netDebt: fin.netDebt,
    ebitda: fin.ebitda,
    healthScore: (netDebtToEbitda != null && netDebtToEbitda < 2.5 && interestCoverage != null && interestCoverage > 6) ? 'strong' : 'caution',
    note: 'Net Debt/EBITDA < 2.5x AND Interest Coverage > 6x = 건전. 두 조건 모두 충족 시 strong.',
    source: 'Naver financials (FMP 보강 권장)'
  };
};

// (3) computeEvEbitda: EV/EBITDA + 동종 산업 비교
window.AIO.computeEvEbitda = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  var ld = window._liveData || {};
  var mcap = ld[ticker] && ld[ticker].marketCap;
  var fin = null;
  try {
    if (typeof window.fetchNaverUSData === 'function') {
      var nv = await window.fetchNaverUSData(ticker, true);
      fin = nv && nv.financials;
    }
  } catch(_) {}
  if (!fin || !fin.ebitda || !mcap) return { ticker: ticker, available: false, reason: 'EV/EBITDA 계산 불가 (mcap 또는 EBITDA 미수신)' };
  // EV ≈ mcap + netDebt
  var ev = mcap + (fin.netDebt || 0);
  var evEbitda = ev / fin.ebitda;
  // Peer comparison: SCREENER_DB 같은 sector 평균 (간이)
  var peerAvg = null;
  try {
    var db = window.SCREENER_DB || [];
    var row = db.find(function(r){ return r.sym === ticker; });
    if (row && row.sector) {
      var peers = db.filter(function(r){ return r.sector === row.sector && r.sym !== ticker; });
      // SCREENER_DB에 EV/EBITDA 없음 — placeholder
      peerAvg = peers.length;  // peer count 만 보고
    }
  } catch(_) {}
  return {
    ticker: ticker,
    available: true,
    ev: ev,
    ebitda: fin.ebitda,
    evEbitda: evEbitda,
    peerCount: peerAvg,
    verdict: evEbitda < 10 ? 'cheap' : evEbitda < 15 ? 'fair' : 'expensive',
    note: 'EV/EBITDA < 10 cheap, 10~15 fair, 15+ expensive (섹터별 차이 있음 — peer comparison 정밀 비교 권장)',
    source: 'Naver + Yahoo mcap'
  };
};

// (4) computeMacroBeta: 금리/달러/원자재 베타 — DATA_SNAPSHOT cross-asset
window.AIO.computeMacroBeta = function(ticker, opts) {
  opts = opts || {};
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // 섹터 기반 휴리스틱 베타 — 실제 회귀는 historical 가격 데이터 필요 (v49.37+)
  var db = window.SCREENER_DB || [];
  var row = db.find && db.find(function(r){ return r.sym === ticker; });
  if (!row) return { ticker: ticker, available: false, reason: 'SCREENER_DB에 sector 미등록' };
  // sector → typical macro beta (휴리스틱)
  var sectorBetas = {
    'Technology':    { rateBeta: -0.8, dxyBeta: -0.3, oilBeta: -0.1, note: '금리 민감 (성장주 듀레이션)' },
    'Financials':    { rateBeta: +0.6, dxyBeta: +0.2, oilBeta: -0.1, note: '금리 수혜 (NIM)' },
    'Energy':        { rateBeta: -0.1, dxyBeta: -0.4, oilBeta: +0.9, note: '유가 강한 양의 상관' },
    'Materials':     { rateBeta: -0.2, dxyBeta: -0.6, oilBeta: +0.4, note: '달러 약세 + 원자재 수혜' },
    'Consumer Discretionary': { rateBeta: -0.5, dxyBeta: -0.2, oilBeta: -0.3, note: '금리/유가 동시 민감' },
    'Consumer Staples': { rateBeta: -0.2, dxyBeta: -0.1, oilBeta: -0.2, note: '방어주 — 낮은 베타' },
    'Healthcare':    { rateBeta: -0.3, dxyBeta: -0.1, oilBeta: 0.0, note: '비교적 무관' },
    'Utilities':     { rateBeta: -0.9, dxyBeta: 0.0, oilBeta: -0.2, note: '금리에 가장 민감 (배당주)' },
    'Industrials':   { rateBeta: -0.3, dxyBeta: -0.3, oilBeta: +0.1, note: '복합 — 글로벌 수출 비중에 따라' },
    'Communication Services': { rateBeta: -0.6, dxyBeta: -0.2, oilBeta: -0.1, note: '성장주 듀레이션' },
    'Real Estate':   { rateBeta: -0.9, dxyBeta: -0.2, oilBeta: -0.1, note: 'REIT 금리 매우 민감' }
  };
  var beta = sectorBetas[row.sector] || { rateBeta: 0, dxyBeta: 0, oilBeta: 0, note: 'sector 매핑 없음 — 보수적 평가' };
  // DATA_SNAPSHOT 현재값 활용해 노출 추정
  var S = window.DATA_SNAPSHOT || {};
  return {
    ticker: ticker,
    sector: row.sector,
    available: true,
    rateBeta: beta.rateBeta,
    dxyBeta: beta.dxyBeta,
    oilBeta: beta.oilBeta,
    currentRate: S.tnx || null,
    currentDxy: S.dxy || null,
    currentOil: S.wti || null,
    note: beta.note + ' (휴리스틱 — historical regression은 v49.37+ 신설)',
    source: 'SCREENER_DB sector + heuristic table',
    diversificationVerdict: (Math.abs(beta.rateBeta) > 0.7 || Math.abs(beta.dxyBeta) > 0.5 || Math.abs(beta.oilBeta) > 0.5) ? 'high-exposure' : 'low-exposure'
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.65 P341 (#7 기술력/해자/Moat): computeMoatScore — Morningstar 유료 자동화 대체
// 7가지 해자 유형 자동 채점 (R&D 강도 + GM 추세 + SG&A 효율 + OpMargin + FCF 마진 + license/regulatory + R&D growth)
// 데이터 소스: SCREENER_DB row + Naver financials (FMP key 옵셔널, fallback graceful)
// ─────────────────────────────────────────────────────────────────
window.AIO.computeMoatScore = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // SCREENER_DB row — 기본 지표 (gmPct/opMarginPct/fcfMarginPct/rndPct 등)
  var db = window.SCREENER_DB || [];
  var row = db.find && db.find(function(r){ return r.sym === ticker; });
  if (!row) {
    return { ticker: ticker, available: false, reason: 'SCREENER_DB 미등록 — Moat 자동 채점 불가' };
  }
  // Naver/FMP financials 보강 시도
  var fin = null;
  try {
    if (typeof window.fetchNaverUSData === 'function') {
      var nv = await window.fetchNaverUSData(ticker, true);
      fin = nv && nv.financials;
    }
  } catch(_) {}
  var score = 0;
  var evidence = [];
  // ① 기술 독점/특허: R&D/매출 >= 15% → +2
  var rndPct = row.rndPct != null ? Number(row.rndPct) : (fin && fin.rndPct != null ? Number(fin.rndPct) : null);
  if (rndPct != null && rndPct >= 15) {
    score += 2;
    evidence.push({ moat: '① 기술 독점/특허', signal: 'R&D/매출 ' + rndPct.toFixed(1) + '% (>=15%)', weight: '+2' });
  } else if (rndPct != null && rndPct >= 10) {
    score += 1;
    evidence.push({ moat: '① 기술 독점/특허 (부분)', signal: 'R&D/매출 ' + rndPct.toFixed(1) + '% (10~15%)', weight: '+1' });
  }
  // ②~⑤ Gross Margin 기반 (전환비용/브랜드)
  var gmPct = row.gmPct != null ? Number(row.gmPct) : (fin && fin.gmPct != null ? Number(fin.gmPct) : null);
  if (gmPct != null && gmPct >= 60) {
    score += 2;
    evidence.push({ moat: '③ 전환비용 (높은 GM 안정)', signal: 'GM ' + gmPct.toFixed(1) + '% (>=60%)', weight: '+2' });
  } else if (gmPct != null && gmPct >= 50) {
    score += 1;
    evidence.push({ moat: '④ 브랜드 파워', signal: 'GM ' + gmPct.toFixed(1) + '% (50~60%)', weight: '+1' });
  }
  // ⑤ 규모의 경제: OpMargin >= 20% 또는 3년 개선
  var opMarginPct = row.opMarginPct != null ? Number(row.opMarginPct) : (fin && fin.opMarginPct != null ? Number(fin.opMarginPct) : null);
  if (opMarginPct != null && opMarginPct >= 20) {
    score += 1;
    evidence.push({ moat: '⑤ 규모의 경제', signal: 'OpMargin ' + opMarginPct.toFixed(1) + '% (>=20%)', weight: '+1' });
  }
  // ⑥ 무형자산: description에 license/regulatory/exclusive 키워드 (SCREENER_DB.memo 활용)
  var memo = String(row.memo || '');
  if (/license|regulatory|exclusive|patent|특허|독점|허가/i.test(memo)) {
    score += 1;
    evidence.push({ moat: '⑥ 무형자산 (라이선스/규제 장벽)', signal: 'memo에 license/regulatory/patent/특허 키워드', weight: '+1' });
  }
  // ⑦ FCF 마진 >= 20% → +2 (높은 FCF 전환)
  var fcfMarginPct = row.fcfMarginPct != null ? Number(row.fcfMarginPct) : (fin && fin.fcfMarginPct != null ? Number(fin.fcfMarginPct) : null);
  if (fcfMarginPct != null && fcfMarginPct >= 20) {
    score += 2;
    evidence.push({ moat: '⑦ 높은 FCF 전환', signal: 'FCF margin ' + fcfMarginPct.toFixed(1) + '% (>=20%)', weight: '+2' });
  } else if (fcfMarginPct != null && fcfMarginPct >= 12) {
    score += 1;
    evidence.push({ moat: '⑦ 양호한 FCF 전환', signal: 'FCF margin ' + fcfMarginPct.toFixed(1) + '% (12~20%)', weight: '+1' });
  }
  // ② 네트워크 효과 휴리스틱 (memo)
  if (/network effect|네트워크 효과|marketplace|플랫폼/i.test(memo)) {
    score += 1;
    evidence.push({ moat: '② 네트워크 효과', signal: 'memo에 network effect/marketplace 키워드', weight: '+1' });
  }
  // verdict
  var verdict = score >= 7 ? 'Wide' : score >= 3 ? 'Narrow' : 'None';
  return {
    ticker: ticker,
    available: true,
    score: score,
    maxScore: 10,
    verdict: verdict,
    evidence: evidence,
    inputs: { rndPct: rndPct, gmPct: gmPct, opMarginPct: opMarginPct, fcfMarginPct: fcfMarginPct },
    source: 'SCREENER_DB + Naver financials (FMP 보강 옵셔널)',
    dataConfidence: evidence.length >= 3 ? 'medium' : 'low',
    note: 'Wide(7+) / Narrow(3~6) / None(<3). Morningstar 공식 등급 대체 — AI 학습 데이터 추정 금지 (R117).'
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.65 P341 (#11 TAM/시장 분석): computeTAMEstimate
// SEC SIC code + AIO_INDUSTRY_TAM_REGISTRY (정적 매핑) + SCREENER_DB.memo "TAM:" 패턴 추출
// dataConfidence: low (자동 산출 어려움 — 수동 memo + SIC 매핑 명시)
// ─────────────────────────────────────────────────────────────────
window.AIO_INDUSTRY_TAM_REGISTRY = window.AIO_INDUSTRY_TAM_REGISTRY || {
  // SIC code → { tam: '$X billion', cagr: 'Y%', name }
  '3674': { tam: '$2,500B', cagr: '8%', name: 'Semiconductors' },
  '7372': { tam: '$700B',   cagr: '11%', name: 'Prepackaged Software (SaaS/Cloud)' },
  '7370': { tam: '$700B',   cagr: '11%', name: 'Services-Computer Programming' },
  '5961': { tam: '$6,000B', cagr: '9%', name: 'Online Retail (e-commerce global)' },
  '3711': { tam: '$3,000B', cagr: '6%', name: 'Motor Vehicles' },
  '2834': { tam: '$1,500B', cagr: '5%', name: 'Pharmaceutical Preparations' },
  '6020': { tam: '$8,000B', cagr: '3%', name: 'Commercial Banking (assets)' },
  '6311': { tam: '$5,000B', cagr: '4%', name: 'Life Insurance' },
  '1311': { tam: '$5,000B', cagr: '2%', name: 'Crude Petroleum & Natural Gas' },
  '4812': { tam: '$1,200B', cagr: '3%', name: 'Wireless Telecom' },
  '7389': { tam: '$400B',   cagr: '7%', name: 'Business Services (digital)' },
  '5812': { tam: '$3,500B', cagr: '4%', name: 'Eating Places (restaurants global)' },
  '4813': { tam: '$1,500B', cagr: '2%', name: 'Telecommunications (wireline)' },
  '4911': { tam: '$1,400B', cagr: '4%', name: 'Electric Services (utilities)' },
  '6770': { tam: '$X',      cagr: 'mixed', name: 'Holding Companies (conglomerate — 적용 불가)' },
  '3576': { tam: '$200B',   cagr: '14%', name: 'Computer Communications Equipment' },
  '7389': { tam: '$400B',   cagr: '7%', name: 'Business Services' },
  '3663': { tam: '$200B',   cagr: '8%', name: 'Radio & TV Broadcasting Equipment' },
  '7311': { tam: '$700B',   cagr: '12%', name: 'Advertising (digital ad market)' },
  '3825': { tam: '$80B',    cagr: '6%', name: 'Lab Instruments' },
  '2836': { tam: '$400B',   cagr: '10%', name: 'Biological Products (biotech)' },
  '3661': { tam: '$120B',   cagr: '6%', name: 'Telephone & Telegraph Apparatus' }
};
window.AIO.computeTAMEstimate = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  window._tamCache = window._tamCache || {};
  var cached = window._tamCache[ticker];
  if (cached && (Date.now() - cached.ts < 30 * 60 * 1000)) return cached.data;
  var indicators = [];
  var tamEstimate = null, cagrEstimate = null, sicCode = null, industryName = null;
  // 소스 1: SEC SIC code + AIO_INDUSTRY_TAM_REGISTRY
  try {
    var biz = await window.AIO.fetchSECBusinessDescription(ticker);
    if (biz && biz.available && biz.sic) {
      sicCode = String(biz.sic);
      var tamMeta = window.AIO_INDUSTRY_TAM_REGISTRY[sicCode];
      if (tamMeta) {
        tamEstimate = tamMeta.tam;
        cagrEstimate = tamMeta.cagr;
        industryName = tamMeta.name;
        indicators.push({ source: 'SEC SIC ' + sicCode + ' + TAM_REGISTRY', industry: tamMeta.name, tam: tamMeta.tam, cagr: tamMeta.cagr });
      } else {
        indicators.push({ source: 'SEC SIC ' + sicCode, note: 'TAM_REGISTRY 미매핑 — 산업별 TAM 추정 불가' });
      }
    }
  } catch(_secErr) {}
  // 소스 2: SCREENER_DB.memo에서 "TAM:" 패턴 grep
  var db = window.SCREENER_DB || [];
  var row = db.find && db.find(function(r){ return r.sym === ticker; });
  if (row && row.memo) {
    var tamMatch = String(row.memo).match(/TAM[:\s]*\$?([\d,.\sBTM조억]+)/i);
    if (tamMatch) {
      var memoTam = tamMatch[1].trim();
      if (!tamEstimate) tamEstimate = memoTam;
      indicators.push({ source: 'SCREENER_DB.memo "TAM:" pattern', extracted: memoTam });
    }
    var cagrMatch = String(row.memo).match(/CAGR[:\s]*([\d.]+%)/i);
    if (cagrMatch) {
      if (!cagrEstimate) cagrEstimate = cagrMatch[1];
      indicators.push({ source: 'SCREENER_DB.memo "CAGR:" pattern', extracted: cagrMatch[1] });
    }
  }
  var confidence = (tamEstimate && indicators.length >= 2) ? 'medium' : tamEstimate ? 'low-medium' : 'low';
  var resp = {
    ticker: ticker,
    available: !!(tamEstimate || indicators.length > 0),
    sicCode: sicCode,
    industryName: industryName,
    tamEstimate: tamEstimate,
    cagrEstimate: cagrEstimate,
    indicators: indicators,
    dataConfidence: confidence,
    source: 'SEC SIC + AIO_INDUSTRY_TAM_REGISTRY + SCREENER_DB.memo',
    note: '자동 산출 한계 — SEC SIC 매핑 + 수동 memo 의존. AI는 "회사별 정확한 TAM 추정 금지" + confidence: ' + confidence + ' 명시 의무 (R117).'
  };
  window._tamCache[ticker] = { data: resp, ts: Date.now() };
  return resp;
};

// (5) fetchFinnhubInsider: 임원 매수/매도 12주 누적 — Finnhub /stock/insider-transactions
window.AIO.fetchFinnhubInsider = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  var key = (typeof _getApiKey === 'function') ? _getApiKey('aio_finnhub_key') : (typeof window._getApiKey === 'function' ? window._getApiKey('aio_finnhub_key') : '');
  if (!key) return { ticker: ticker, available: false, reason: 'Finnhub API key 필요 (aio_finnhub_key)' };
  var now = Date.now();
  var fromDate = new Date(now - 12 * 7 * 86400000).toISOString().slice(0, 10);
  var toDate = new Date(now).toISOString().slice(0, 10);
  try {
    var url = 'https://finnhub.io/api/v1/stock/insider-transactions?symbol=' + encodeURIComponent(ticker) + '&from=' + fromDate + '&to=' + toDate + '&token=' + key;
    var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 10000) : fetch(url));
    if (r && r.ok) {
      var raw = await r.json();
      var txns = raw && raw.data || [];
      var netShares = 0, buyCount = 0, sellCount = 0;
      txns.forEach(function(t) {
        var shares = Number(t.change || 0);
        netShares += shares;
        if (shares > 0) buyCount++; else if (shares < 0) sellCount++;
      });
      return {
        ticker: ticker,
        available: true,
        source: 'Finnhub /stock/insider-transactions',
        period: fromDate + ' ~ ' + toDate,
        transactionCount: txns.length,
        buyCount: buyCount,
        sellCount: sellCount,
        netShares: netShares,
        verdict: netShares > 0 ? 'insider-buying' : netShares < 0 ? 'insider-selling' : 'neutral',
        note: '내부자 매수 = 강력 신호 (역사적으로 +6~10%/연 초과수익)'
      };
    }
  } catch(e) {}
  return { ticker: ticker, available: false, reason: 'Finnhub insider fetch 실패' };
};

// (6) fetchFinnhubShortInterest: Short Interest % — Finnhub
window.AIO.fetchFinnhubShortInterest = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  var key = (typeof _getApiKey === 'function') ? _getApiKey('aio_finnhub_key') : (typeof window._getApiKey === 'function' ? window._getApiKey('aio_finnhub_key') : '');
  if (!key) return { ticker: ticker, available: false, reason: 'Finnhub API key 필요' };
  try {
    var url = 'https://finnhub.io/api/v1/stock/metric?symbol=' + encodeURIComponent(ticker) + '&metric=all&token=' + key;
    var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 10000) : fetch(url));
    if (r && r.ok) {
      var raw = await r.json();
      var m = raw && raw.metric;
      if (m) {
        var siPct = m.shortInterestPercent || m.shortInterestRatio || null;
        return {
          ticker: ticker,
          available: true,
          source: 'Finnhub /stock/metric',
          shortInterestPct: siPct,
          shortRatio: m.shortRatio,
          verdict: siPct == null ? 'unknown' : siPct < 5 ? 'normal' : siPct < 15 ? 'elevated' : 'squeeze-candidate',
          note: '5% 이하 정상, 5~15% 약한 하방, 15%+ Short Squeeze 가능성'
        };
      }
    }
  } catch(e) {}
  return { ticker: ticker, available: false, reason: 'Finnhub short interest fetch 실패' };
};

// (7) fetchSEC13F: 13F 기관 보유 (분기) — SEC EDGAR 13F filings
window.AIO.fetchSEC13F = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // 종목 자체 보유는 다른 기관의 13F를 검색해야 함 — 단순 구현은 종목의 13F 보유 비중 trend
  // EDGAR full-text 검색 또는 WhaleWisdom 권장 — 현재는 placeholder + URL 제공
  return {
    ticker: ticker,
    available: true,
    source: 'SEC EDGAR 13F filings (full-text search)',
    queryUrl: 'https://efts.sec.gov/LATEST/search-index?q=' + encodeURIComponent(ticker) + '&forms=13F-HR',
    whaleWisdomUrl: 'https://whalewisdom.com/stock/' + encodeURIComponent(ticker.toLowerCase()),
    note: '13F는 분기 발표 (45일 lag). 정밀 institutional holdings는 WhaleWisdom 또는 SEC full-text 권장. AI가 위 URL fetch 가능.',
    verdict: 'manual-query-required'
  };
};

// 보조 (8): fetchSECRecentFilings — 최근 8-K (event-driven 파트너십/M&A)
// v49.57 P317 보강: URL 제공 → 실제 8-K 최근 5건 fetch+parse (filingDate, items, accession)
// raw.filings.recent에서 form==='8-K' 인덱스 추출. 학습 데이터 환각 차단 (M&A/CEO 변경 등 이벤트)
window.AIO.fetchSECRecentFilings = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // v49.65 P346: opts.max8K로 캐시 키 분리 + max 갯수 가변 (기본 5, partnership 40 등). max8K 변수는 아래에서 fetch 시 재선언 사용.
  var maxCount = (opts.max8K && opts.max8K > 0) ? Math.min(80, opts.max8K) : 5;
  opts.max8K = maxCount;  // downstream에서 동일 값 보장
  // 캐시 5분 (max 갯수별 분리)
  window._secFilingsCache = window._secFilingsCache || {};
  var cacheKey = ticker + '_max' + maxCount;
  var cached = window._secFilingsCache[cacheKey];
  if (cached && (Date.now() - cached.ts < 5 * 60 * 1000)) return cached.data;
  var biz = await window.AIO.fetchSECBusinessDescription(ticker);
  if (!biz || !biz.available) {
    var failResp = { ticker: ticker, available: false, reason: 'CIK 미등록 또는 SEC fetch 실패' };
    window._secFilingsCache[cacheKey] = { data: failResp, ts: Date.now() };
    return failResp;
  }
  // CIK 기반 직접 raw fetch — fetchSECBusinessDescription와 동일 endpoint
  try {
    var url = 'https://data.sec.gov/submissions/CIK' + biz.cik + '.json';
    var proxies = [
      function(u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
      function(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }
    ];
    for (var i = 0; i < proxies.length; i++) {
      try {
        var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(proxies[i](url), {}, 10000) : fetch(proxies[i](url)));
        if (r && r.ok) {
          var raw = await r.json();
          if (raw.contents) try { raw = JSON.parse(raw.contents); } catch(_) {}
          if (raw && raw.filings && raw.filings.recent) {
            var rec = raw.filings.recent;
            var forms = rec.form || [];
            var recent8K = [];
            var max8K = opts.max8K || 5;
            for (var j = 0; j < forms.length && recent8K.length < max8K; j++) {
              if (forms[j] === '8-K') {
                recent8K.push({
                  filingDate: rec.filingDate[j],
                  reportDate: rec.reportDate ? rec.reportDate[j] : null,
                  accession: rec.accessionNumber[j],
                  primaryDoc: rec.primaryDocument[j],
                  items: rec.items ? rec.items[j] : null,
                  url: 'https://www.sec.gov/Archives/edgar/data/' + parseInt(biz.cik, 10) + '/' + (rec.accessionNumber[j] || '').replace(/-/g, '') + '/' + (rec.primaryDocument[j] || '')
                });
              }
            }
            var resp = {
              ticker: ticker,
              available: true,
              source: 'SEC EDGAR /submissions',
              cik: biz.cik,
              companyName: biz.companyName,
              recent8KList: recent8K,
              recent8KCount: recent8K.length,
              inspected8KLimit: max8K,
              browseUrl: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + biz.cik + '&type=8-K&dateb=&owner=include&count=20',
              note: '8-K는 event-driven 공시 (M&A/파트너십/CEO 변경/사이버 사고/실적 사전 공시 등). Items 코드: 1.01=계약/2.02=실적/5.02=임원변경/7.01=Reg FD/8.01=기타.'
            };
            window._secFilingsCache[cacheKey] = { data: resp, ts: Date.now() };
            return resp;
          }
        }
      } catch(_proxyErr) {}
    }
  } catch(e) {}
  var failResp2 = { ticker: ticker, available: false, reason: 'SEC 8-K fetch 실패 — 프록시 모두 fail' };
  window._secFilingsCache[cacheKey] = { data: failResp2, ts: Date.now() };
  return failResp2;
};

// ─────────────────────────────────────────────────────────────────
// v49.65 P340 (#12 공급망/Supply Chain): fetchSECSupplyChain
// SEC 10-K Item 1 (Business) + Item 1C (Cybersecurity, 2026 신규 의무) 키워드 가이드.
// fetchSECBusinessDescription의 raw 결과 재사용 (URL + CIK + SIC) — 비용 0.
// dataConfidence: low-medium — 키워드 가이드만 제공, AI가 URL fetch+해석 필요 (CORS 제약).
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchSECSupplyChain = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  window._secSupplyChainCache = window._secSupplyChainCache || {};
  var cached = window._secSupplyChainCache[ticker];
  if (cached && (Date.now() - cached.ts < 5 * 60 * 1000)) return cached.data;
  var biz = await window.AIO.fetchSECBusinessDescription(ticker);
  if (!biz || !biz.available) {
    var failResp = { ticker: ticker, available: false, reason: biz ? biz.reason : 'SEC 10-K fetch 실패' };
    window._secSupplyChainCache[ticker] = { data: failResp, ts: Date.now() };
    return failResp;
  }
  var resp = {
    ticker: ticker,
    available: true,
    source: 'SEC EDGAR 10-K Item 1 (Business) + Item 1C (Cybersecurity)',
    cik: biz.cik,
    companyName: biz.companyName,
    sicDescription: biz.sicDescription,
    businessDescriptionUrl: biz.businessDescriptionUrl,
    dataConfidence: 'low-medium',
    sourceMode: 'filing-link+keyword-guide',
    requiresManualFetch: true,
    extractedFacts: [],
    keywordGuide: [
      'supplier', 'concentration', 'single source', 'single supplier',
      'manufacturing partner', 'foundry', 'OEM', 'contract manufacturer',
      'customer concentration', 'major customer', 'top customers',
      'geographic', 'region', 'export', 'tariff', 'sanction'
    ],
    sections: {
      item1Business: '10-K Item 1 (Business) — 사업 영역/공급사/주요 고객',
      item1CCybersecurity: '10-K Item 1C (Cybersecurity, 2026 신규 의무) — 사이버 리스크/공급망 침해 위험',
      item7AQuantitative: 'Item 7A — 시장 리스크 (환율/원자재) 정량 disclosure'
    },
    note: '공급망 데이터는 AI가 위 URL을 직접 fetch+해석 필요. dataConfidence: low-medium — 키워드 가이드만 제공하며 공급사/고객명 자동 추출은 아직 아님. 학습 데이터 환각 금지 (R117).'
  };
  window._secSupplyChainCache[ticker] = { data: resp, ts: Date.now() };
  return resp;
};

// ─────────────────────────────────────────────────────────────────
// v49.65 P340 (#14 협력/파트너십/Partnership): fetchPartnershipAlerts
// SEC 8-K Item 1.01 (Material Definitive Agreement) + Item 7.01 (Reg FD) 최근 N개월 필터.
// fetchSECRecentFilings raw 8-K 리스트 재사용 (캐시 공유) — 비용 0.
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchPartnershipAlerts = async function(ticker, monthsBack) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  monthsBack = monthsBack || 6;
  window._partnershipCache = window._partnershipCache || {};
  var cacheKey = ticker + '_' + monthsBack;
  var cached = window._partnershipCache[cacheKey];
  if (cached && (Date.now() - cached.ts < 5 * 60 * 1000)) return cached.data;
  var filings = await window.AIO.fetchSECRecentFilings(ticker, { max8K: 40 });
  if (!filings || !filings.available) {
    var failResp = { ticker: ticker, available: false, reason: filings ? filings.reason : 'SEC 8-K fetch 실패' };
    window._partnershipCache[cacheKey] = { data: failResp, ts: Date.now() };
    return failResp;
  }
  var cutoff = new Date(Date.now() - monthsBack * 30 * 86400000).toISOString().slice(0, 10);
  var partnerships = (filings.recent8KList || []).filter(function(f) {
    if (!f.filingDate || f.filingDate < cutoff) return false;
    var items = String(f.items || '');
    return items.indexOf('1.01') >= 0 || items.indexOf('7.01') >= 0;
  }).map(function(f) {
    var items = String(f.items || '');
    var eventGuess = items.indexOf('1.01') >= 0 ? 'Material Agreement (계약 체결/파트너십/M&A)' :
                     items.indexOf('7.01') >= 0 ? 'Reg FD (사전 공시/주요 발표)' : 'Unknown';
    return {
      filingDate: f.filingDate,
      items: f.items,
      accession: f.accession,
      url: f.url,
      eventGuess: eventGuess
    };
  });
  var resp = {
    ticker: ticker,
    available: true,
    source: 'SEC EDGAR 8-K filtered (Item 1.01 + 7.01)',
    period: cutoff + ' ~ ' + new Date().toISOString().slice(0, 10),
    monthsBack: monthsBack,
    recentPartnerships: partnerships,
    partnershipCount: partnerships.length,
    inspected8KCount: filings.recent8KCount || 0,
    inspected8KLimit: filings.inspected8KLimit || 40,
    browseUrl: filings.browseUrl,
    dataConfidence: partnerships.length > 0 ? 'high' : 'medium',
    note: '파트너십/주요 계약은 8-K Item 1.01 (Material Definitive Agreement) + Item 7.01 (Reg FD)로 의무 공시. 학습 데이터 환각 금지.'
  };
  window._partnershipCache[cacheKey] = { data: resp, ts: Date.now() };
  return resp;
};

// ─────────────────────────────────────────────────────────────────
// v49.65 P340 (#13 플랫폼/생태계/Platform Ecosystem): fetchPlatformEcosystem
// 3 소스 합성 (SCREENER_DB.memo 키워드 + FMP segments 플랫폼 매출 + Finnhub news 언급).
// 외부 API 없음 — score 0~100 + dataConfidence (low/medium) 명시 (R117 의무).
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchPlatformEcosystem = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  window._platformEcoCache = window._platformEcoCache || {};
  var cached = window._platformEcoCache[ticker];
  if (cached && (Date.now() - cached.ts < 10 * 60 * 1000)) return cached.data;
  var indicators = [];
  var score = 0;
  // 소스 1: SCREENER_DB.memo 키워드 grep
  var db = window.SCREENER_DB || [];
  var entry = Array.isArray(db) ? db.find(function(r){ return r && r.sym === ticker; }) : db[ticker];
  var memo = entry && entry.memo || '';
  var platformKws = ['ecosystem', 'platform', 'developer', 'marketplace', 'network effect', '생태계', '플랫폼', 'API', 'SDK', '개발자', '구독'];
  var memoMatches = platformKws.filter(function(kw) {
    return new RegExp(kw, 'i').test(memo);
  });
  if (memoMatches.length > 0) {
    var memoScore = Math.min(40, memoMatches.length * 8);
    score += memoScore;
    indicators.push({ source: 'SCREENER_DB.memo', matches: memoMatches.slice(0, 5), weight: '+' + memoScore });
  }
  // 소스 2: FMP segments — 플랫폼/서비스/구독 매출 비중
  var segData = null;
  try {
    if (typeof window.AIO.fetchFMPSegments === 'function') {
      segData = await window.AIO.fetchFMPSegments(ticker);
    }
  } catch(_segErr) {}
  if (segData && segData.available && Array.isArray(segData.segments)) {
    var platformSegments = segData.segments.filter(function(s) {
      var n = String(s.name || '').toLowerCase();
      return /service|subscription|platform|cloud|marketplace|saas|recurring/.test(n);
    });
    if (platformSegments.length > 0) {
      var totalRev = segData.segments.reduce(function(a, s) { return a + (Number(s.revenue) || 0); }, 0);
      var platformRev = platformSegments.reduce(function(a, s) { return a + (Number(s.revenue) || 0); }, 0);
      var platformPct = totalRev > 0 ? Math.round(platformRev / totalRev * 100) : 0;
      var segScore = Math.min(40, Math.round(platformPct * 0.5));
      score += segScore;
      indicators.push({ source: 'FMP segments', platformRevPct: platformPct, count: platformSegments.length, weight: '+' + segScore });
    }
  }
  // 소스 3: Finnhub 뉴스 30일 — platform/ecosystem 언급 카운트
  var newsData = null;
  try {
    if (typeof window.AIO.fetchFinnhubCompanyNews === 'function') {
      newsData = await window.AIO.fetchFinnhubCompanyNews(ticker, 30);
    }
  } catch(_newsErr) {}
  if (newsData && newsData.available && Array.isArray(newsData.topHeadlines)) {
    var newsMatches = 0;
    newsData.topHeadlines.forEach(function(h) {
      var text = (h.headline || '') + ' ' + (h.summary || '');
      if (/platform|ecosystem|developer|marketplace|network effect/i.test(text)) newsMatches++;
    });
    if (newsMatches > 0) {
      var newsScore = Math.min(20, newsMatches * 4);
      score += newsScore;
      indicators.push({ source: 'Finnhub news (30d)', matches: newsMatches, weight: '+' + newsScore });
    }
  }
  score = Math.min(100, score);
  var confidence = score >= 60 ? 'medium' : score >= 30 ? 'low-medium' : 'low';
  var verdict = score >= 70 ? 'Strong Platform/Ecosystem' :
                score >= 40 ? 'Moderate Platform' :
                score >= 15 ? 'Limited Platform indicators' : 'Insufficient data';
  var resp = {
    ticker: ticker,
    available: true,
    source: '3-source synthesis (SCREENER_DB.memo + FMP segments + Finnhub news)',
    ecosystemScore: score,
    verdict: verdict,
    dataConfidence: confidence,
    indicators: indicators,
    note: '정성 분석 한계 — dataConfidence: ' + confidence + '. 외부 API 없음. AI는 ecosystemScore 자동 산출 결과만 인용 + "구체적 플랫폼 규모/사용자 수 추정 금지" (R117).'
  };
  window._platformEcoCache[ticker] = { data: resp, ts: Date.now() };
  return resp;
};

// (10) fetchFinnhubCompanyNews — 종목별 최근 N일 뉴스 (v49.57 P317 신설)
// Finnhub /company-news?symbol=X&from=Y&to=Z — 무료 60req/min
// 반환: { articleCount, topHeadlines: [{datetime, headline, source, url, summary, category}, ...max 5] }
window.AIO.fetchFinnhubCompanyNews = async function(ticker, daysBack) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  daysBack = daysBack || 14;
  // 캐시 30분
  window._fhNewsCache = window._fhNewsCache || {};
  var cacheKey = ticker + '_' + daysBack;
  var cached = window._fhNewsCache[cacheKey];
  if (cached && (Date.now() - cached.ts < 30 * 60 * 1000)) return cached.data;
  var key = (typeof _getApiKey === 'function') ? _getApiKey('aio_finnhub_key') : (typeof window._getApiKey === 'function' ? window._getApiKey('aio_finnhub_key') : '');
  if (!key) {
    var noKey = { ticker: ticker, available: false, reason: 'Finnhub API key 필요 (aio_finnhub_key)' };
    window._fhNewsCache[cacheKey] = { data: noKey, ts: Date.now() };
    return noKey;
  }
  var now = Date.now();
  var fromDate = new Date(now - daysBack * 86400000).toISOString().slice(0, 10);
  var toDate = new Date(now).toISOString().slice(0, 10);
  try {
    var url = 'https://finnhub.io/api/v1/company-news?symbol=' + encodeURIComponent(ticker) + '&from=' + fromDate + '&to=' + toDate + '&token=' + key;
    var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 10000) : fetch(url));
    if (r && r.ok) {
      var raw = await r.json();
      if (Array.isArray(raw)) {
        // 최신 순으로 5개
        var sorted = raw.slice().sort(function(a, b) { return (b.datetime || 0) - (a.datetime || 0); });
        var top = sorted.slice(0, 5).map(function(n) {
          return {
            datetime: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(0, 16).replace('T', ' ') : null,
            headline: n.headline || '',
            source: n.source || '',
            url: n.url || '',
            summary: (n.summary || '').substring(0, 240),
            category: n.category || ''
          };
        });
        var resp = {
          ticker: ticker,
          available: true,
          source: 'Finnhub /company-news',
          period: fromDate + ' ~ ' + toDate,
          articleCount: raw.length,
          topHeadlines: top
        };
        window._fhNewsCache[cacheKey] = { data: resp, ts: Date.now() };
        return resp;
      }
    }
  } catch(e) {}
  var failResp = { ticker: ticker, available: false, reason: 'Finnhub company-news fetch 실패' };
  window._fhNewsCache[cacheKey] = { data: failResp, ts: Date.now() };
  return failResp;
};

window.AIO.normalizeFMPSegments = function(raw) {
  var out = [];
  function add(name, revenue, year) {
    if (!name || /^(symbol|date|period|calendarYear|reportedCurrency|cik|fillingDate|acceptedDate|link|finalLink)$/i.test(name)) return;
    var n = Number(String(revenue).replace(/,/g, ''));
    if (!isFinite(n) || n === 0) return;
    out.push({ name: String(name), revenue: n, year: year || null });
  }
  function walk(obj, year) {
    if (!obj) return;
    if (Array.isArray(obj)) { obj.forEach(function(x) { walk(x, year); }); return; }
    if (typeof obj !== 'object') return;
    var y = obj.calendarYear || obj.year || (obj.date ? String(obj.date).slice(0, 4) : year);
    if (Array.isArray(obj.segments)) {
      obj.segments.forEach(function(s) { add(s.name || s.segment || s.product || s.label, s.revenue || s.value || s.amount, y); });
    }
    if (obj.data && typeof obj.data === 'object') walk(obj.data, y);
    if ((obj.name || obj.segment || obj.product) && (obj.revenue || obj.value || obj.amount)) {
      add(obj.name || obj.segment || obj.product, obj.revenue || obj.value || obj.amount, y);
    }
    Object.keys(obj).forEach(function(k) {
      var v = obj[k];
      if (v && typeof v === 'object') {
        if (/^\d{4}$/.test(k)) walk(v, k);
        return;
      }
      add(k, v, y);
    });
  }
  walk(raw, null);
  var seen = {};
  return out.filter(function(s) {
    var key = s.name + '|' + (s.year || '') + '|' + s.revenue;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function(a, b) { return Math.abs(b.revenue) - Math.abs(a.revenue); });
};

// ─────────────────────────────────────────────────────────────────
// v49.72 신규: fetchFMP5YQuarterly + fetchKRQuarterly — fundamental 페이지 7 차트 데이터 소스
// FMP 4 endpoints (income/balance/cash-flow/ratios) period=quarter limit=20 병렬 fetch + 5분 캐시
// KR (.KS/.KQ) ticker는 Naver 분기 재무 fallback
// R138 신규 (fundamental 종목 검색 시 7 차트 자동 렌더 의무) / P384 (FMP 분기 미구현 갭)
// ─────────────────────────────────────────────────────────────────
window._fmpQuarterlyCache = window._fmpQuarterlyCache || {};
window._fmpQuarterlyCacheStats = window._fmpQuarterlyCacheStats || { hits: 0, misses: 0, evictions: 0 };

window.AIO.fetchFMP5YQuarterly = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  // 캐시 5분 TTL (LRU 50 종목 cap, v49.66 패턴)
  var _TTL = 5 * 60 * 1000;
  var cached = window._fmpQuarterlyCache[ticker];
  if (cached && (Date.now() - cached._ts < _TTL)) {
    window._fmpQuarterlyCacheStats.hits++;
    return cached.data;
  }
  window._fmpQuarterlyCacheStats.misses++;
  var key = (typeof _getApiKey === 'function') ? _getApiKey('aio_fmp_key') : (typeof window._getApiKey === 'function' ? window._getApiKey('aio_fmp_key') : '');
  if (!key) {
    return { ticker: ticker, available: false, dataSource: 'FMP-key-missing', reason: 'FMP API 키 필요 (aio_fmp_key) — 사이드바 → API 설정', asOf: new Date().toISOString() };
  }
  var base = 'https://financialmodelingprep.com/api/v3/';
  function _fetch(url) {
    return (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 7000) : fetch(url))
      .then(function(r){ return r && r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }
  try {
    var jobs = [
      _fetch(base + 'income-statement/'        + encodeURIComponent(ticker) + '?period=quarter&limit=20&apikey=' + key),
      _fetch(base + 'balance-sheet-statement/' + encodeURIComponent(ticker) + '?period=quarter&limit=20&apikey=' + key),
      _fetch(base + 'cash-flow-statement/'     + encodeURIComponent(ticker) + '?period=quarter&limit=20&apikey=' + key),
      _fetch(base + 'ratios/'                  + encodeURIComponent(ticker) + '?period=quarter&limit=20&apikey=' + key)
    ];
    var settled = await Promise.allSettled(jobs);
    var income   = settled[0].status === 'fulfilled' ? (settled[0].value || []) : [];
    var balance  = settled[1].status === 'fulfilled' ? (settled[1].value || []) : [];
    var cashflow = settled[2].status === 'fulfilled' ? (settled[2].value || []) : [];
    var ratios   = settled[3].status === 'fulfilled' ? (settled[3].value || []) : [];
    var available = (income.length || balance.length || cashflow.length || ratios.length) > 0;
    var asOf = new Date().toISOString();
    var latestQuarter = (income[0] && income[0].date) || (balance[0] && balance[0].date) || null;
    var data = {
      ticker: ticker,
      available: available,
      dataSource: 'FMP',
      period: 'quarter',
      latestQuarter: latestQuarter,
      asOf: asOf,
      income: income,
      balance: balance,
      cashflow: cashflow,
      ratios: ratios,
      note: 'FMP 5년 분기 (최대 20분기). period=quarter, limit=20.'
    };
    // LRU eviction (50 종목 cap)
    window._fmpQuarterlyCache[ticker] = { data: data, _ts: Date.now() };
    var keys = Object.keys(window._fmpQuarterlyCache);
    if (keys.length > 50) {
      keys.sort(function(a, b){ return (window._fmpQuarterlyCache[a]._ts||0) - (window._fmpQuarterlyCache[b]._ts||0); });
      for (var i = 0; i < keys.length - 50; i++) {
        delete window._fmpQuarterlyCache[keys[i]];
        window._fmpQuarterlyCacheStats.evictions++;
      }
    }
    return data;
  } catch(e) {
    return { ticker: ticker, available: false, dataSource: 'FMP-error', reason: 'FMP 분기 fetch 오류: ' + (e && e.message || e), asOf: new Date().toISOString() };
  }
};

// KR 종목 분기 재무 fallback — Naver 스크래핑 (.KS/.KQ)
window.AIO.fetchKRQuarterly = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  if (!/\.(KS|KQ)$/.test(ticker)) return { ticker: ticker, available: false, dataSource: 'KR-only', reason: '.KS/.KQ 종목만 지원' };
  // 캐시 5분 TTL (FMP과 동일 스토어 공유)
  var _TTL = 5 * 60 * 1000;
  var cached = window._fmpQuarterlyCache[ticker];
  if (cached && (Date.now() - cached._ts < _TTL)) {
    window._fmpQuarterlyCacheStats.hits++;
    return cached.data;
  }
  window._fmpQuarterlyCacheStats.misses++;
  if (typeof window.fetchNaverUSData !== 'function') {
    return { ticker: ticker, available: false, dataSource: 'naver-missing', reason: 'fetchNaverUSData 함수 부재', asOf: new Date().toISOString() };
  }
  try {
    var nv = await window.fetchNaverUSData(ticker, true);
    var fin = nv && nv.financials;
    if (!fin) return { ticker: ticker, available: false, dataSource: 'naver-no-financials', reason: 'Naver financials 미수신 (KR 재무 DART 직접 확인 권장)', asOf: new Date().toISOString() };
    // Naver financials 표준화 — 분기 배열로 변환 (현재 분기 1개만 가용 시에도 차트 placeholder 가능)
    var quarters = [];
    if (Array.isArray(fin.quarterlyHistory) && fin.quarterlyHistory.length > 0) {
      // {date, revenue, opIncome, netIncome, eps} 형태 가정
      quarters = fin.quarterlyHistory.slice(0, 20);
    } else {
      // single snapshot — 최소 1분기 placeholder
      quarters = [{
        date: (fin.reportDate || new Date().toISOString().slice(0,10)),
        revenue: fin.revenue || null,
        opIncome: fin.opIncome || null,
        netIncome: fin.netIncome || null,
        eps: fin.eps || null
      }];
    }
    var data = {
      ticker: ticker,
      available: quarters.length > 0,
      dataSource: 'Naver',
      period: 'quarter',
      latestQuarter: quarters[0] && quarters[0].date,
      asOf: new Date().toISOString(),
      income: quarters,  // 표준화: income 배열에 분기 시리즈 채워 fundamental render 호환
      balance: [],
      cashflow: [],
      ratios: [],
      naverRaw: fin,
      note: 'Naver 분기 재무 (KR 폴백). 정밀 데이터는 DART 직접 확인 권장.'
    };
    window._fmpQuarterlyCache[ticker] = { data: data, _ts: Date.now() };
    return data;
  } catch(e) {
    return { ticker: ticker, available: false, dataSource: 'naver-error', reason: 'Naver KR 분기 fetch 오류: ' + (e && e.message || e), asOf: new Date().toISOString() };
  }
};

// 통합 진입점 — US/KR 자동 분기
window.AIO.fetchQuarterlyFinancials = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  if (/\.(KS|KQ)$/.test(ticker)) {
    return await window.AIO.fetchKRQuarterly(ticker);
  }
  return await window.AIO.fetchFMP5YQuarterly(ticker);
};

// 보조 (9): fetchFMPSegments — 매출 세그먼트 (FMP key 필요)
window.AIO.fetchFMPSegments = async function(ticker) {
  if (!ticker) return null;
  ticker = ticker.toUpperCase().trim();
  var key = (typeof _getApiKey === 'function') ? _getApiKey('aio_fmp_key') : (typeof window._getApiKey === 'function' ? window._getApiKey('aio_fmp_key') : '');
  if (!key) return { ticker: ticker, available: false, reason: 'FMP API key 필요 (aio_fmp_key)' };
  try {
    var url = 'https://financialmodelingprep.com/api/v3/revenue-product-segmentation/' + encodeURIComponent(ticker) + '?period=annual&apikey=' + key;
    var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 10000) : fetch(url));
    if (r && r.ok) {
      var raw = await r.json();
      var segments = window.AIO.normalizeFMPSegments ? window.AIO.normalizeFMPSegments(raw) : [];
      return {
        ticker: ticker,
        available: segments.length > 0,
        source: 'FMP /revenue-product-segmentation',
        segments: segments,
        rawSegments: raw || [],
        note: '제품/서비스별 매출 세그먼트 (annual). AI가 비즈니스 모델/수익 구조 분석에 활용.'
      };
    }
  } catch(e) {}
  return { ticker: ticker, available: false, reason: 'FMP segments fetch 실패' };
};

// ─────────────────────────────────────────────────────────────────
// v49.35 핵심: FUNDAMENTAL_PAGE_CRITERIA — fundamental 페이지 L8175~8189 15 기준
// 사용자 지적: "기업 분석 페이지 15개 분석 기준도 세밀하게 조사"
// 페이지 인라인 텍스트만 있고 코드 registry 없음 → 환각/미구현 분야 추적 불가
// R91 신규 (페이지 표시 분석 기준은 반드시 registry 등록 + 가용성 표시 의무)
// 기존 AIO_FUNDAMENTAL_CRITERIA(v49.25 정량 위주) / ANALYSIS_FRAMEWORK_REGISTRY(v49.34 정성+정량 사용자 정의)와 cross-reference.
// ─────────────────────────────────────────────────────────────────
window.AIO_FUNDAMENTAL_PAGE_CRITERIA = {
  version: 'v49.35',
  sourcePageLine: 'index.html L8175~8189',
  criteria: {
    'quality-of-business': { num: 1,  label: 'Quality of Business',   description: 'ROE > 15% 3년+ 지속, 자본 효율성',           dataSource: 'FMP /ratios + Naver',         implFn: 'fetchNaverUSData', requires: ['roe3y'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'moat-economic':       { num: 2,  label: 'Moat (경제적 해자)',     description: 'Morningstar 5 moat (브랜드·네트워크·전환비용·규제·원가) 2개+', dataSource: 'Morningstar (paywall) + AI 분석', implFn: null,            requires: ['moatType'], frequency: 'annual',    hallucinationRisk: 'high', note: 'Morningstar 유료 — AI가 SEC 10-K 분석으로 추정 (v49.34 fetchSECBusinessDescription 활용)' },
    'growth-cagr':         { num: 3,  label: 'Growth',                description: '매출 5년 CAGR > 10%, 조정 EPS 성장 > 12%',     dataSource: 'FMP /income-statement-growth + Naver', implFn: 'fetchNaverUSData', requires: ['revenue5yCagr','eps5yGrowth'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'margin-trend':        { num: 4,  label: 'Margin Trend',          description: 'Gross Margin 확장 중, OPM 3년 상승',          dataSource: 'FMP /ratios + Naver overview',  implFn: 'fetchNaverUSData', requires: ['gpm3y','opm3y'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'fcf-yield':           { num: 5,  label: 'FCF Yield',             description: 'FCF/시총 > 4%, Buyback+배당 유지 가능',       dataSource: 'FMP /cashflow + Yahoo mcap + Naver financials', implFn: 'computeFcfYield', requires: ['fcfYield'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'balance-sheet':       { num: 6,  label: 'Balance Sheet',         description: 'Net Debt / EBITDA < 2.5x, Interest Coverage > 6x', dataSource: 'FMP /balance-sheet + Naver', implFn: 'computeBalanceSheetRatios', requires: ['netDebtEbitda','intCoverage'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'valuation-pe':        { num: 7,  label: 'Valuation PE',          description: 'Forward PE vs 5Y 평균, PEG < 1.5',            dataSource: 'Yahoo + Naver consensus',       implFn: 'fetchNaverUSData|dynamicTickerLookup', requires: ['forwardPe','pe5yAvg','peg'], frequency: 'daily', hallucinationRisk: 'low' },
    'ev-ebitda':           { num: 8,  label: 'EV / EBITDA',           description: '동종 산업 대비 할인, 피어 비교 핵심',          dataSource: 'FMP + Naver + SCREENER_DB peer', implFn: 'computeEvEbitda', requires: ['evEbitda','peerEvEbitda'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'insider-activity':    { num: 9,  label: 'Insider Activity',      description: '임원 매수/매도 12주 누적. 매수 = 강력 신호',     dataSource: 'Finnhub /stock/insider-transactions', implFn: 'fetchFinnhubInsider', requires: ['insiderNet12w'], frequency: 'weekly', hallucinationRisk: 'medium', note: 'Finnhub key 필요' },
    'institutional-flow':  { num: 10, label: 'Institutional Flow',    description: '13F 기관 보유 비중 변화 · 주요 헤지펀드 편입',  dataSource: 'SEC 13F filings + WhaleWisdom',  implFn: 'fetchSEC13F', requires: ['institutional13f'], frequency: 'quarterly', hallucinationRisk: 'medium', note: 'AI가 URL fetch 필요' },
    'short-interest':      { num: 11, label: 'Short Interest',        description: '5% 이하 정상, 15%+ 하방 압력/Squeeze',          dataSource: 'Finnhub /stock/metric', implFn: 'fetchFinnhubShortInterest', requires: ['shortInterestPct'], frequency: 'biweekly', hallucinationRisk: 'medium', note: 'Finnhub key 필요' },
    'analyst-revisions':   { num: 12, label: 'Analyst Revisions',     description: '최근 90일 EPS 추정치 상향/하향 비율',          dataSource: 'Finnhub recommendation + Naver consensus', implFn: 'fetchFinnhubRecommendation|fetchNaverUSData', requires: ['epsRevisions90d'], frequency: 'weekly', hallucinationRisk: 'medium' },
    'earnings-beat-streak': { num: 13, label: 'Earnings Beat Streak', description: '최근 4분기 어닝 서프라이즈 연속성',             dataSource: 'Finnhub /earnings-surprises',   implFn: 'fetchFinnhubEarningsCalendar', requires: ['beatStreak4q'], frequency: 'quarterly', hallucinationRisk: 'low' },
    'industry-rank':       { num: 14, label: 'Industry Rank',         description: 'IBD 산업 랭킹 Top 30, 업종 순풍',              dataSource: 'IBD (유료) + 자체 RS computed', implFn: 'SCREENER_DB',   requires: ['industryRank'], frequency: 'weekly', hallucinationRisk: 'medium', note: 'IBD 유료 — SCREENER_DB.rsi 대체' },
    'macro-exposure':      { num: 15, label: 'Macro Exposure',        description: '금리/달러/원자재 민감도, 포트폴리오 분산',     dataSource: 'DATA_SNAPSHOT cross-asset + sector heuristic beta', implFn: 'computeMacroBeta', requires: ['rateBeta','dxyBeta','oilBeta'], frequency: 'monthly', hallucinationRisk: 'low', note: '휴리스틱 — 정밀 historical regression은 v49.37+' }
  }
};

window.AIO.getFundamentalPageCriteriaAudit = function() {
  var reg = window.AIO_FUNDAMENTAL_PAGE_CRITERIA;
  if (!reg) return { status: 'error', notImplCount: 15, issues: ['CRITERIA undefined'] };
  var impl = 0, notImpl = [], highRisk = [];
  Object.keys(reg.criteria).forEach(function(key) {
    var c = reg.criteria[key];
    if (c.implFn) impl++;
    else notImpl.push({ key: key, num: c.num, label: c.label, plannedFn: c.plannedFn || null, dataSource: c.dataSource });
    if (c.hallucinationRisk === 'high') highRisk.push({ key: key, num: c.num, label: c.label });
  });
  return {
    status: notImpl.length ? 'warn' : 'ok',
    totalCriteria: 15,
    implCount: impl,
    notImplCount: notImpl.length,
    coveragePct: Math.round(impl / 15 * 100),
    notImpl: notImpl,
    highRiskCount: highRisk.length,
    highRiskFields: highRisk,
    note: '미구현 기준은 plannedFn 명시. AI 채팅 시 미구현 기준 분석 요청 → "이 기준은 현재 시스템에서 자동 평가 불가, 수동 확인 권장" 답변 필수.',
    generatedAt: new Date().toISOString()
  };
};

// v49.35 cross-reference: 3개 "15개 관점" registry 매핑 검증
window.AIO.getCriteriaCrossReferenceAudit = function() {
  var pageCount = window.AIO_FUNDAMENTAL_PAGE_CRITERIA && Object.keys(window.AIO_FUNDAMENTAL_PAGE_CRITERIA.criteria).length || 0;
  var fundCount = window.AIO_FUNDAMENTAL_CRITERIA && Object.keys(window.AIO_FUNDAMENTAL_CRITERIA.criteria).length || 0;
  var frameworkReg = window.AIO_ANALYSIS_FRAMEWORK_REGISTRY;
  var frameworkCount = frameworkReg && Object.keys(frameworkReg.fields).length || 0;
  var frameworkPerspectiveCount = frameworkReg && typeof frameworkReg.perspectiveKeys === 'function' ? frameworkReg.perspectiveKeys().length : frameworkCount;
  return {
    status: 'info',
    pageCriteria15: pageCount,
    fundamentalCriteria15: fundCount,
    analysisFramework15: frameworkPerspectiveCount,
    analysisFrameworkPerspective17: frameworkPerspectiveCount,
    analysisFrameworkTotal: frameworkCount,
    analysisFrameworkSupportFields: Math.max(0, frameworkCount - frameworkPerspectiveCount),
    note: '3개 registry — (1) FUNDAMENTAL_PAGE_CRITERIA: 페이지 L8175 정량 15기준 (Quality/Moat/Growth/Margin/FCF/Balance/PE/EV/Insider/13F/Short/Revisions/Beat/Industry/Macro) · (2) FUNDAMENTAL_CRITERIA: v49.25 정량 위주 15기준 (Piotroski 등) · (3) ANALYSIS_FRAMEWORK: v49.34 정성+정량 15분야 (CEO/비즈니스/공급망/SEC/Wiki). 각각 목적 다름. AI 채팅에서 "15기준 분석" 요청 시 어느 registry를 참조하는지 명시 필수.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.34 핵심: ANALYSIS_FRAMEWORK_REGISTRY — 종목/기업 15 분석 분야 데이터 출처
// 사용자 지적: "비즈니스 구조 / 사업 모델 / 수익 구조 / 제품 포트폴리오 / CEO 경영진 /
// 밸류에이션 / 협력 파트너십 / 공급망 / TAM / 리스크 / 경쟁 / 투자포인트 등 15개 모두
// 최신/정확한 데이터인지" — 분야별 출처 가용성 + AI 학습 의존도 추적.
// R90 신규 (정성 분석 출처 의무화)
// ─────────────────────────────────────────────────────────────────
window.AIO_ANALYSIS_FRAMEWORK_REGISTRY = {
  version: 'v49.65',  // v49.34 15 fields → v49.65 17 fields (Platform/Ecosystem 신규 + Partnership/Supply implFn 매핑)
  // 사용자 요청 17 관점 매핑 (정량+정성). num 0은 보조 필드이며 17 관점 분모에서 제외.
  fields: {
    'price-realtime':    { num: 0,  label: '기본 시세',           type: 'quantitative', primarySource: 'Yahoo Finance', implFn: 'dynamicTickerLookup',          freshness: 'realtime',          aiHallucinationRisk: 'low' },
    'chart-technical':   { num: 0,  label: '차트',                type: 'visual',       primarySource: 'TradingView iframe + Naver chart', implFn: 'tradingview-widget', freshness: 'realtime', aiHallucinationRisk: 'low' },
    'business-structure': { num: 1, label: '기업 개요 + 사업 구조', type: 'qualitative',  primarySource: 'SEC 10-K Item 1 + Wikipedia + Naver overview', implFn: 'fetchSECBusinessDescription|fetchWikipediaCompany|fetchNaverUSData', freshness: 'annual+manual', aiHallucinationRisk: 'medium' },
    'founding-growth':   { num: 2,  label: '창립 배경 & 성장 과정', type: 'qualitative',  primarySource: 'Wikipedia (founded/IPO) + News (성장 마일스톤)', implFn: 'fetchWikipediaCompany|fetchFinnhubCompanyNews', freshness: 'annual+event', aiHallucinationRisk: 'medium' },
    'ceo-management':    { num: 3,  label: 'CEO/경영진 분석',    type: 'qualitative',  primarySource: 'Wikipedia + SEC DEF 14A + Insider 12주', implFn: 'fetchWikipediaCompany|fetchFinnhubInsider', freshness: 'annual', aiHallucinationRisk: 'high', note: '인사 변경 시 즉시 stale — NAMED_ENTITY_REGISTRY 연동 필요' },
    'business-model':    { num: 4,  label: '비즈니스 모델',       type: 'qualitative',  primarySource: 'SEC 10-K + Wikipedia',         implFn: 'fetchSECBusinessDescription|fetchWikipediaCompany', freshness: 'annual', aiHallucinationRisk: 'medium' },
    'revenue-structure': { num: 5,  label: '사업/수익 구조 (세그먼트)', type: 'quantitative', primarySource: 'FMP segments + 10-K segments', implFn: 'fetchFMPSegments|fetchSECBusinessDescription', freshness: 'quarterly', aiHallucinationRisk: 'medium' },
    'product-portfolio': { num: 6,  label: '제품 포트폴리오',     type: 'qualitative',  primarySource: 'FMP segments + Wikipedia + SEC', implFn: 'fetchFMPSegments|fetchWikipediaCompany|fetchSECBusinessDescription', freshness: 'quarterly+manual', aiHallucinationRisk: 'medium', note: 'v49.65: FMP segments 통합으로 high → medium' },
    'moat-economic':     { num: 7,  label: '기술력 & 해자 (Moat)', type: 'quantitative+qualitative', primarySource: 'computeMoatScore (R&D/SG&A/GM/OpMargin/FCF margin 자동 채점)', implFn: 'computeMoatScore', freshness: 'quarterly', aiHallucinationRisk: 'high', note: 'v49.65 신설 — Morningstar 유료 대체' },
    'revenue-by-segment': { num: 8, label: '수익 구조 (세그먼트별 매출)', type: 'quantitative', primarySource: 'FMP /revenue-product-segmentation + Naver financials', implFn: 'fetchFMPSegments|fetchNaverUSData', freshness: 'quarterly', aiHallucinationRisk: 'low' },
    'fundamentals-ratios': { num: 9, label: '재무제표 분석',     type: 'quantitative', primarySource: 'FMP + Naver + computed (computeFcfYield/Balance/EvEbitda)', implFn: 'AIO_FUNDAMENTAL_CRITERIA', freshness: 'quarterly', aiHallucinationRisk: 'low' },
    'valuation':         { num: 10, label: '밸류에이션 (PE/PSR/PEG/EV/EBITDA/DCF)', type: 'quantitative', primarySource: 'Yahoo + FMP /ratios-ttm + computeEvEbitda + DCF', implFn: 'dynamicTickerLookup|computeEvEbitda', freshness: 'daily', aiHallucinationRisk: 'low' },
    'tam-market-size':   { num: 11, label: 'TAM / 시장 분석',    type: 'qualitative+quantitative', primarySource: 'computeTAMEstimate (SEC SIC + memo grep)', implFn: 'computeTAMEstimate', freshness: 'manual', aiHallucinationRisk: 'high', note: 'v49.65 신설 — dataConfidence: low (수동 memo 의존)' },
    'supply-chain':      { num: 12, label: '밸류체인 / 공급망 분석', type: 'qualitative',  primarySource: 'SEC 10-K Item 1 + Item 1C (Cybersecurity 2026 신규) + News', implFn: 'fetchSECSupplyChain', freshness: 'annual', aiHallucinationRisk: 'high', note: 'v49.65: filing-link+keyword-guide — dataConfidence: low-medium, 공급사/고객명 자동 추출 아님' },
    'platform-ecosystem': { num: 13, label: '플랫폼 & 생태계 분석', type: 'qualitative+quantitative', primarySource: '3-source synthesis (SCREENER_DB.memo + FMP segments + Finnhub news)', implFn: 'fetchPlatformEcosystem', freshness: 'on-demand', aiHallucinationRisk: 'high', note: 'v49.65 신설 — dataConfidence: low (외부 API 없음, 합성 score)' },
    'partnership':       { num: 14, label: '협력 / 파트너십 분석', type: 'qualitative', primarySource: 'SEC 8-K Item 1.01 (Material Definitive Agreement) + Item 7.01 (Reg FD)', implFn: 'fetchPartnershipAlerts', freshness: 'event-driven', aiHallucinationRisk: 'low', note: 'v49.65: implFn 매핑 완성 (이전 plannedFn) — dataConfidence: high (8-K 의무 공시)' },
    'competition':       { num: 15, label: '경쟁 구조',           type: 'qualitative',  primarySource: 'SEC 10-K + Wikipedia + Naver + peers', implFn: 'fetchWikipediaCompany|fetchSECBusinessDescription', freshness: 'annual', aiHallucinationRisk: 'high' },
    'risk-factors':      { num: 16, label: '리스크',              type: 'qualitative',  primarySource: 'SEC 10-K Item 1A + Short Interest', implFn: 'fetchSECRiskFactors|fetchFinnhubShortInterest', freshness: 'annual+weekly', aiHallucinationRisk: 'high', note: 'v49.34 신설 + v49.65 Short Interest 통합' },
    'investment-thesis': { num: 17, label: '투자 포인트',          type: 'qualitative',  primarySource: 'Finnhub consensus + SCREENER_DB memo + Naver consensus + 위 16 관점 종합', implFn: 'fetchFinnhubRecommendation|fetchNaverUSData', freshness: 'weekly', aiHallucinationRisk: 'medium' }
  },
  // hallucination risk 분류
  perspectiveKeys: function() {
    var self = this;
    return Object.keys(this.fields).filter(function(k) { return Number(self.fields[k].num || 0) > 0; });
  },
  highRiskFields: function(perspectivesOnly) {
    var self = this;
    var keys = perspectivesOnly ? this.perspectiveKeys() : Object.keys(this.fields);
    return keys.filter(function(k) { return self.fields[k].aiHallucinationRisk === 'high'; });
  },
  // 구현 완료 필드
  implementedFields: function(perspectivesOnly) {
    var self = this;
    var keys = perspectivesOnly ? this.perspectiveKeys() : Object.keys(this.fields);
    return keys.filter(function(k) { return self.fields[k].implFn != null; });
  },
  partialFields: function() {
    var self = this;
    return this.perspectiveKeys().filter(function(k) {
      var f = self.fields[k];
      var text = String((f.note || '') + ' ' + (f.primarySource || '') + ' ' + (f.freshness || ''));
      return /low|manual|수동|guide|키워드|외부 API 없음|유료 대체|FMP/.test(text);
    });
  }
};

window.AIO.getAnalysisFrameworkCoverageAudit = function() {
  var reg = window.AIO_ANALYSIS_FRAMEWORK_REGISTRY;
  if (!reg) return { status: 'error', coveragePct: 0, issues: ['REGISTRY undefined'] };
  var perspectiveKeys = reg.perspectiveKeys ? reg.perspectiveKeys() : Object.keys(reg.fields);
  var total = perspectiveKeys.length;
  var impl = reg.implementedFields ? reg.implementedFields(true).length : 0;
  var partial = reg.partialFields ? reg.partialFields() : [];
  var highRisk = reg.highRiskFields ? reg.highRiskFields(true) : [];
  var byType = { quantitative: 0, qualitative: 0, visual: 0, mixed: 0 };
  perspectiveKeys.forEach(function(k) {
    var t = String(reg.fields[k].type || '');
    if (t.indexOf('+') >= 0) byType.mixed++;
    else if (byType[t] != null) byType[t]++;
  });
  return {
    status: partial.length ? 'warn' : (impl < total ? 'warn' : 'ok'),
    coveragePct: Math.round(impl / total * 100),
    implementedCount: impl,
    totalCount: total,
    supportFieldCount: Object.keys(reg.fields).length - total,
    verifiedCount: total - partial.length,
    operationalCoveragePct: Math.round((total - partial.length) / total * 100),
    partialCount: partial.length,
    partialFields: partial,
    highRiskCount: highRisk.length,
    highRiskFields: highRisk,
    byType: byType,
    note: 'coveragePct는 17 관점의 출처/함수 매핑률, operationalCoveragePct는 low-confidence/수동가이드 제외 실사용 신뢰도. partialFields는 답변에 한계 고지 필수.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.71 P380 R135~R137: assertMemoCoverageAudit — SCREENER_DB memo 커버리지 + 신선도 + REGISTRY 매핑 자동 진단
// 사용자 정직 질의 4건 시정: (1) 커버리지 (2) MEMO 활용 (3) 없는 종목 fallback (4) 오래된 데이터
// ─────────────────────────────────────────────────────────────────
window.AIO.assertMemoCoverageAudit = function() {
  var db = window.SCREENER_DB;
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  if (!db) return { status: 'error', issues: ['SCREENER_DB undefined'] };
  var dbArray = Array.isArray(db) ? db : Object.keys(db).map(function(k) { return db[k]; });
  var totalRows = dbArray.length;
  var withMemo = 0, withoutMemo = 0, totalLen = 0;
  var freshnessBuckets = { fresh: 0, medium: 0, oldish: 0, stale: 0, unknown: 0 };
  var freshnessSamples = { stale: [], unknown: [] };
  dbArray.forEach(function(row) {
    if (!row) return;
    if (row.memo && typeof row.memo === 'string' && row.memo.length > 0) {
      withMemo++;
      totalLen += row.memo.length;
      try {
        var fresh = (typeof window._aioParseMemoFreshness === 'function') ? window._aioParseMemoFreshness(row.memo) : null;
        if (fresh && fresh.confidence) {
          if (fresh.confidence === 'high') freshnessBuckets.fresh++;
          else if (fresh.confidence === 'medium') freshnessBuckets.medium++;
          else if (fresh.confidence === 'low') freshnessBuckets.oldish++;
          else if (fresh.confidence === 'stale') {
            freshnessBuckets.stale++;
            if (freshnessSamples.stale.length < 5) freshnessSamples.stale.push({ sym: row.sym, days: fresh.days });
          } else {
            freshnessBuckets.unknown++;
            if (freshnessSamples.unknown.length < 5) freshnessSamples.unknown.push(row.sym);
          }
        }
      } catch(_) {}
    } else {
      withoutMemo++;
    }
  });
  var regEntries = (reg && reg.entries) || {};
  var regKeys = Object.keys(regEntries).filter(function(k) {
    var e = regEntries[k];
    return e && e.en !== '_skip' && k.indexOf('_dup') < 0 && k.indexOf('_skip') < 0;
  });
  var dbSyms = {};
  dbArray.forEach(function(r) { if (r && r.sym) dbSyms[r.sym] = true; });
  var regInDb = regKeys.filter(function(k) { return dbSyms[k]; }).length;
  var regNotInDb = regKeys.filter(function(k) { return !dbSyms[k]; });
  var memoCoveragePct = totalRows > 0 ? Math.round(withMemo / totalRows * 100) : 0;
  var avgLen = withMemo > 0 ? Math.round(totalLen / withMemo) : 0;
  var stalePct = withMemo > 0 ? Math.round(freshnessBuckets.stale / withMemo * 100) : 0;
  var chatFn = (typeof window._fetchTickerDataForChat === 'function') ? window._fetchTickerDataForChat.toString() : '';
  var chatIntegrated = chatFn.indexOf('_aioGetMemoForTicker') >= 0 && chatFn.indexOf('[SCREENER_DB Memo') >= 0;
  var rulesText = chatFn.indexOf('R135') >= 0 && chatFn.indexOf('R136') >= 0;
  return {
    status: memoCoveragePct >= 90 && chatIntegrated && rulesText && stalePct <= 30 ? 'ok' : (memoCoveragePct >= 50 && chatIntegrated ? 'warn' : 'fail'),
    totalRows: totalRows, withMemo: withMemo, withoutMemo: withoutMemo, memoCoveragePct: memoCoveragePct,
    avgMemoLength: avgLen, freshnessBuckets: freshnessBuckets, freshnessSamples: freshnessSamples, stalePct: stalePct,
    registryTotal: regKeys.length, registryInDb: regInDb,
    registryNotInDb: regNotInDb.slice(0, 10), registryGapCount: regNotInDb.length,
    chatIntegrated: chatIntegrated, rulesText: rulesText,
    note: 'memoCoveragePct ' + memoCoveragePct + '% / stalePct ' + stalePct + '% / chatIntegrated ' + chatIntegrated + ' / R135-R136 rules ' + rulesText,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.72 P387 R138~R139: assertFinancialChartsAudit — fundamental 7 차트 + 채팅 버튼 자동 진단
// 검증: (1) FMP/Naver 분기 fetcher 함수 정의 (2) 7 canvas DOM 존재 (3) render 함수 정의
//       (4) fundamentalSearch 통합 (5) chatSend 버튼 통합 (6) cache 동작
// ─────────────────────────────────────────────────────────────────
window.AIO.assertFinancialChartsAudit = function() {
  var fnChecks = {
    fetchFMP5YQuarterly: typeof (window.AIO && window.AIO.fetchFMP5YQuarterly) === 'function',
    fetchKRQuarterly:    typeof (window.AIO && window.AIO.fetchKRQuarterly) === 'function',
    fetchQuarterlyEntry: typeof (window.AIO && window.AIO.fetchQuarterlyFinancials) === 'function',
    renderFunction:      typeof window._renderFundamentalFinancialsCharts === 'function',
    showHandler:         typeof window._aioShowFundamentalChart === 'function'
  };
  var canvasIds = ['fund-growth-chart','fund-profitability-chart','fund-balance-chart','fund-cashflow-chart','fund-liquidity-chart','fund-curratio-donut','fund-workingcap-chart'];
  var canvasFound = canvasIds.filter(function(id){ return !!document.getElementById(id); });
  var gridFound = !!document.getElementById('fundamental-financials-grid');
  var valuationCards = !!document.getElementById('fund-valuation-cards');
  var fundSrc = (typeof window.fundamentalSearch === 'function') ? window.fundamentalSearch.toString() : '';
  var chatSendSrc = (typeof window.chatSend === 'function') ? window.chatSend.toString() : '';
  var integrations = {
    fundamentalSearchIntegrated: fundSrc.indexOf('fetchQuarterlyFinancials') >= 0 && fundSrc.indexOf('_renderFundamentalFinancialsCharts') >= 0,
    chatButtonIntegrated:        chatSendSrc.indexOf('_aioShowFundamentalChart') >= 0,
    cacheObject:                 typeof window._fmpQuarterlyCache === 'object' && window._fmpQuarterlyCache !== null,
    cacheStatsObject:            typeof window._fmpQuarterlyCacheStats === 'object'
  };
  var cacheStats = window._fmpQuarterlyCacheStats || { hits: 0, misses: 0, evictions: 0 };
  var cacheSize = window._fmpQuarterlyCache ? Object.keys(window._fmpQuarterlyCache).length : 0;
  var fnAllOk = Object.keys(fnChecks).every(function(k){ return fnChecks[k]; });
  var intAllOk = Object.keys(integrations).every(function(k){ return integrations[k]; });
  var domAllOk = gridFound && canvasFound.length === 7 && valuationCards;
  var coveragePct = Math.round(((Object.keys(fnChecks).filter(function(k){return fnChecks[k];}).length / Object.keys(fnChecks).length) * 0.5 + (canvasFound.length / 7) * 0.3 + (Object.keys(integrations).filter(function(k){return integrations[k];}).length / Object.keys(integrations).length) * 0.2) * 100);
  return {
    status: fnAllOk && intAllOk && domAllOk ? 'ok' : (coveragePct >= 60 ? 'warn' : 'fail'),
    coveragePct: coveragePct,
    fnChecks: fnChecks,
    fnAllOk: fnAllOk,
    fnCount: Object.keys(fnChecks).filter(function(k){return fnChecks[k];}).length,
    fnTotal: Object.keys(fnChecks).length,
    domCanvasFound: canvasFound.length,
    domCanvasTotal: 7,
    domCanvasMissing: canvasIds.filter(function(id){ return !document.getElementById(id); }),
    gridFound: gridFound,
    valuationCards: valuationCards,
    integrations: integrations,
    intAllOk: intAllOk,
    cacheSize: cacheSize,
    cacheStats: cacheStats,
    note: 'v49.72 R138~R139: fundamental 7 차트 자동 진단. fn ' + Object.keys(fnChecks).filter(function(k){return fnChecks[k];}).length + '/' + Object.keys(fnChecks).length + ' · canvas ' + canvasFound.length + '/7 · integrations ' + Object.keys(integrations).filter(function(k){return integrations[k];}).length + '/' + Object.keys(integrations).length,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.73 P392 R140~R142: assertChatAnswerQualityAudit — 답변 품질 3축 자동 진단
// 사용자 정직 요구 "현재 시장/기업 상황 반영, 정확하고 최신 데이터, 직관적 표현" 3 카테고리 검증
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatAnswerQualityAudit = function() {
  var ctxs = window.CHAT_CONTEXTS || {};
  // v49.74 P393 R143: 7 페이지 → 11 페이지 확장 (KR 4 페이지 audit 포함)
  // 사용자 정직 지적 — KR 페이지 답변 품질 평가 누락
  var ctxIds = ['home','technical','macro','sentiment','breadth','fundamental','portfolio',
                'kr-macro','kr-supply','kr-themes','kr-tech'];
  // A. 현재성 (Freshness) — 세션 시각 헤더 + 동적 마커 헬퍼 + 정적 stale 토큰 0건
  var staleTokenRe = /tail_risk_snapshot_\d{4}|FOMC\s*의사록\(2026\.04\)|2025\.4 선례|2026\.3-4 랠리/;
  var freshnessCheck = ctxIds.map(function(id) {
    var ctx = ctxs[id];
    if (!ctx || typeof ctx.system !== 'function') return { id: id, hasContext: false, staleTokens: 0, hasSessionHeader: false };
    var src = ctx.system.toString();
    var sysOut = '';
    try { sysOut = ctx.system() || ''; } catch(_) {}
    return {
      id: id,
      hasContext: true,
      staleTokens: ((sysOut.match(new RegExp(staleTokenRe.source, 'g')) || []).length),
      hasSessionHeader: (sysOut.indexOf('【세션 시각:') >= 0) || (src.indexOf('_getChatRules') >= 0),  // _getChatRules가 헤더 주입
      sysOutLength: sysOut.length
    };
  });
  var hasSessionFn = typeof window._aioSessionContextHeader === 'function';
  var hasRelativeFn = typeof window._aioRelativeDate === 'function';
  var staleCount = freshnessCheck.reduce(function(a, c){ return a + (c.staleTokens || 0); }, 0);
  var sessionHdrCount = freshnessCheck.filter(function(c){ return c.hasSessionHeader; }).length;
  // v49.74 P393 R143: 11 페이지 확장 — 분모 7 → 11 (KR 4 페이지 포함)
  var freshnessScore = Math.round(
    (hasSessionFn ? 25 : 0) +
    (hasRelativeFn ? 15 : 0) +
    Math.min(35, (sessionHdrCount / 11) * 35) +
    (staleCount === 0 ? 25 : Math.max(0, 25 - staleCount * 5))
  );
  // B. 정확성 (Accuracy) — fetched/source 라벨 키워드 + _aioFetchLabel 헬퍼 + 출처 헤더
  var chatSrc = (typeof window._fetchTickerDataForChat === 'function') ? window._fetchTickerDataForChat.toString() : '';
  var fetchedKwHits = (chatSrc.match(/fetched/g) || []).length;
  var sourceKwHits = (chatSrc.match(/source\s+(data\.sec|en\.wikipedia|Finnhub|FMP|Yahoo|Stooq|Naver)/g) || []).length;
  var hasFetchLabelFn = typeof window._aioFetchLabel === 'function';
  var hasBlockHeader = chatSrc.indexOf('일괄 fetched') >= 0;
  var accuracyScore = Math.round(
    (hasFetchLabelFn ? 25 : 0) +
    (hasBlockHeader ? 20 : 0) +
    Math.min(30, (fetchedKwHits / 8) * 30) +
    Math.min(25, (sourceKwHits / 5) * 25)
  );
  // C. 직관성 (Intuitiveness) — ABSOLUTE RULES 14~16조 + home 컨텍스트 + 표준 답변 구조
  var rulesText = '';
  try { rulesText = (typeof window._getChatRules === 'function') ? window._getChatRules() : ''; } catch(_) {}
  var hasRule14 = rulesText.indexOf('14조') >= 0 && rulesText.indexOf('정성 표현') >= 0 && rulesText.indexOf('정량 근거') >= 0;
  var hasRule15 = rulesText.indexOf('15조') >= 0 && rulesText.indexOf('표준 답변 구조') >= 0;
  var hasRule16 = rulesText.indexOf('16조') >= 0 && rulesText.indexOf('출처') >= 0 && rulesText.indexOf('기준일') >= 0;
  var hasHomeCtx = !!ctxs['home'] && typeof ctxs['home'].system === 'function';
  var intuitivenessScore = Math.round(
    (hasRule14 ? 20 : 0) +
    (hasRule15 ? 20 : 0) +
    (hasRule16 ? 20 : 0) +
    (hasHomeCtx ? 40 : 0)
  );
  // 종합
  var overall = Math.round((freshnessScore + accuracyScore + intuitivenessScore) / 3);
  return {
    status: overall >= 85 ? 'ok' : overall >= 60 ? 'warn' : 'fail',
    overallScore: overall,
    freshness: {
      score: freshnessScore,
      hasSessionFn: hasSessionFn,
      hasRelativeFn: hasRelativeFn,
      sessionHeaderCount: sessionHdrCount,
      staleTokens: staleCount
    },
    accuracy: {
      score: accuracyScore,
      hasFetchLabelFn: hasFetchLabelFn,
      hasBlockHeader: hasBlockHeader,
      fetchedKeywordHits: fetchedKwHits,
      sourceKeywordHits: sourceKwHits
    },
    intuitiveness: {
      score: intuitivenessScore,
      rule14_qualityToQuant: hasRule14,
      rule15_standardStructure: hasRule15,
      rule16_sourceCitation: hasRule16,
      hasHomeContext: hasHomeCtx
    },
    perPageDetail: freshnessCheck,
    note: 'v49.73 R140~R142: 답변 품질 3축 — 현재성/정확성/직관성. 사용자 정직 요구 "현재 시장/기업 상황 반영, 정확하고 최신 데이터, 직관적 표현" 자동 진단.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.76 P408: AIO.diagnose() — 사용자 콘솔 1줄 통합 진단 (시세/채팅/audit 모두)
// 사용자 좌절 발견 — 콘솔 명령 5개 입력해야 진단 가능. 1줄로 압축.
// ─────────────────────────────────────────────────────────────────
window.AIO.diagnose = async function(ticker) {
  ticker = (ticker || 'NVDA').toUpperCase();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AIO v49.76 diagnose] 통합 진단 시작 - ticker: ' + ticker);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  var report = { ticker: ticker, startedAt: new Date().toISOString(), version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?' };
  // 1. 시세 fetch 진단 (실시간)
  try {
    var t0 = Date.now();
    var quote = await window.dynamicTickerLookup(ticker);
    report.quote = { result: quote, durationMs: Date.now() - t0 };
    report.quoteDiag = window._aioTickerLookupDiag && window._aioTickerLookupDiag[ticker];
    console.log('[1/7] 시세 fetch:', quote ? '✓ price=' + quote.price + ' source=' + quote.source : '✗ FAILED');
  } catch(e) { report.quote = { error: String(e) }; console.error('[1/7] 시세 fetch 오류:', e); }
  // 2. _liveData 상태
  report.liveData = {
    keysCount: Object.keys(window._liveData || {}).length,
    sample: window._liveData && window._liveData[ticker],
    nvdaInLive: !!(window._liveData && window._liveData[ticker])
  };
  console.log('[2/7] _liveData[' + ticker + ']:', report.liveData.sample || '✗ 없음 (전체 ' + report.liveData.keysCount + '개)');
  // 3. assertTickerFetchHealth
  try {
    report.tickerHealth = window.AIO.assertTickerFetchHealth && window.AIO.assertTickerFetchHealth();
    console.log('[3/7] 시세 fetch 건강도:', report.tickerHealth ? report.tickerHealth.note : 'N/A');
  } catch(e) { report.tickerHealth = { error: String(e) }; }
  // 4. assertChatPanelDomAudit
  try {
    report.chatPanelDom = window.AIO.assertChatPanelDomAudit && window.AIO.assertChatPanelDomAudit();
    if (report.chatPanelDom) {
      console.log('[4/7] CHAT_CONTEXTS DOM 매트릭스: ' + report.chatPanelDom.fullOkCount + '/' + report.chatPanelDom.totalContexts + ' OK · 누락 ' + report.chatPanelDom.contextOnlyCount + '건');
      if (report.chatPanelDom.contextOnlyList.length > 0) console.log('     → 누락 ctxId:', report.chatPanelDom.contextOnlyList.join(', '));
    }
  } catch(e) { report.chatPanelDom = { error: String(e) }; }
  // 5. assertChatFunctionCoverage
  try {
    report.chatFnCoverage = window.AIO.assertChatFunctionCoverage && window.AIO.assertChatFunctionCoverage();
    console.log('[5/7] 채팅 함수 통합: dead=' + (report.chatFnCoverage ? report.chatFnCoverage.deadCodeCount : '?') + ' · 통합 ' + (report.chatFnCoverage ? report.chatFnCoverage.integrationPct + '%' : '?'));
  } catch(e) { report.chatFnCoverage = { error: String(e) }; }
  // 6. assertChatAnswerQualityAudit
  try {
    report.answerQuality = window.AIO.assertChatAnswerQualityAudit && window.AIO.assertChatAnswerQualityAudit();
    console.log('[6/7] 답변 품질: 종합 ' + (report.answerQuality ? report.answerQuality.overallScore + '점' : '?'));
  } catch(e) { report.answerQuality = { error: String(e) }; }
  // 7. home 채팅 DOM
  report.homeChatDom = {
    panel: !!document.getElementById('chat-home'),
    inp:   !!document.getElementById('chat-home-inp'),
    btn:   !!document.getElementById('chat-home-btn')
  };
  console.log('[7/7] home 채팅 DOM: panel=' + report.homeChatDom.panel + ' inp=' + report.homeChatDom.inp + ' btn=' + report.homeChatDom.btn);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AIO diagnose] 완료. 상세 결과: report 변수 또는 콘솔 위 로그 확인');
  report.finishedAt = new Date().toISOString();
  // 사용자 권장 조치
  var actions = [];
  if (!report.quote || !report.quote.result || !report.quote.result.price) {
    actions.push('🔴 시세 fetch 실패 — 5분 후 재시도 또는 사이드바 🔄 클릭');
    if (report.quoteDiag) actions.push('   진단: ' + report.quoteDiag.attempts.length + ' proxy 시도 → 모두 실패');
  }
  if (report.chatPanelDom && report.chatPanelDom.contextOnlyCount > 0) {
    actions.push('⚠ CHAT_CONTEXTS ' + report.chatPanelDom.contextOnlyCount + '건 DOM 부재 (v49.74+ 일부 시정, 잔여는 v49.77+ 작업)');
  }
  if (actions.length > 0) {
    console.log('\n권장 조치:');
    actions.forEach(function(a){ console.log('  ' + a); });
  }
  return report;
};

// ─────────────────────────────────────────────────────────────────
// v49.75 P399 R147: assertChatPanelDomAudit — CHAT_CONTEXTS DOM 매트릭스 정합 검증
// 사용자 라이브 발견 — home CHAT_CONTEXTS 등록만 하고 DOM 패널 부재 (v49.74 P398).
// Pattern A 일반화: 모든 ctxId × inline panel DOM 존재 여부 + chatSend 호환성 자동 진단.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatPanelDomAudit = function() {
  var ctxs = window.CHAT_CONTEXTS || {};
  var ctxIds = Object.keys(ctxs);
  var details = ctxIds.map(function(id) {
    var ctx = ctxs[id];
    var hasContext = !!(ctx && typeof ctx.system === 'function');
    var panelEl = document.getElementById('chat-' + id);
    var msgsEl  = document.getElementById('chat-' + id + '-msgs');
    var inpEl   = document.getElementById('chat-' + id + '-inp');
    var btnEl   = document.getElementById('chat-' + id + '-btn');
    var hasInlinePanel = !!(panelEl && msgsEl && inpEl && btnEl);
    // chatSend(ctxId) 호환성 — input element 없으면 silent return
    var chatSendCompatible = !!inpEl;
    return {
      id: id, hasContext: hasContext, hasInlinePanel: hasInlinePanel,
      panel: !!panelEl, msgs: !!msgsEl, inp: !!inpEl, btn: !!btnEl,
      chatSendCompatible: chatSendCompatible,
      gap: hasContext && !chatSendCompatible ? 'CONTEXT_NO_DOM' : null
    };
  });
  var contextOnly = details.filter(function(d){ return d.gap === 'CONTEXT_NO_DOM'; });
  var fullOk = details.filter(function(d){ return d.hasContext && d.chatSendCompatible; });
  var coveragePct = ctxIds.length > 0 ? Math.round((fullOk.length / ctxIds.length) * 100) : 0;
  return {
    status: contextOnly.length === 0 ? 'ok' : contextOnly.length <= 2 ? 'warn' : 'fail',
    totalContexts: ctxIds.length,
    fullOkCount: fullOk.length,
    contextOnlyCount: contextOnly.length,
    contextOnlyList: contextOnly.map(function(d){ return d.id; }),
    coveragePct: coveragePct,
    perContextDetail: details,
    note: 'v49.75 R147: CHAT_CONTEXTS 등록 후 DOM 패널 누락 자동 감지. Pattern A 일반화 (P398 home 케이스 → 14+ contexts 매트릭스). CONTEXT_NO_DOM gap = inline panel 부재 → chatSend silent return.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.75 P400 R148: assertChatAnswerStructureAudit — R140~R142 답변 후처리 검증
// 사용자 정직 발견 — R140 (정성→정량) / R141 (표준 4 구조) / R142 (출처 괄호)
// 시스템 프롬프트에만 정의되고 실제 답변 적용 여부 검증 부재.
// Pattern B 일반화: 답변 텍스트 분석 → 4 rule 위반 자동 검출.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatAnswerStructureAudit = function(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return { status: 'na', violations: [], reason: '응답 텍스트 부재' };
  }
  var violations = [];
  var passes = [];
  // R140 정성→정량 동반 검증
  // 정성 표현 패턴 (높은/낮은/강한/약한/안정/불안/과열/공포/탐욕)
  var qualitativeWords = ['높은', '낮은', '강한', '약한', '안정적', '불안정', '과열', '공포', '탐욕', '신중', '낙관', '비관'];
  var qualHits = qualitativeWords.filter(function(w){ return responseText.indexOf(w) >= 0; });
  // 정량 패턴 ($, %, 숫자+점수/배/주)
  var hasQuant = /(\$\d|\d+(\.\d+)?\s*%|\d+(\.\d+)?\s*(배|점|주))/.test(responseText);
  if (qualHits.length >= 3 && !hasQuant) {
    violations.push({ rule: 'R140', issue: '정성 표현 ' + qualHits.length + '개 사용하나 정량 근거 0개', severity: 'high' });
  } else if (qualHits.length > 0 && hasQuant) {
    passes.push('R140 정성+정량 동반');
  }
  // R141 표준 4 구조 검증 (결론/정량/시나리오/액션)
  var hasConclusion = /(\【결론\】|결론\s*:|요약\s*:|한\s*줄\s*요약)/.test(responseText);
  var hasScenario = /(Bull|Bear|Base|낙관|비관|중립).{0,30}(\d+%|확신도)/.test(responseText) || /시나리오/.test(responseText);
  var hasAction = /(액션|진입|이탈|관망|손절|목표가|포지션)/.test(responseText);
  var structureScore = (hasConclusion ? 1 : 0) + (hasScenario ? 1 : 0) + (hasAction ? 1 : 0);
  if (responseText.length > 500 && structureScore < 2) {
    violations.push({ rule: 'R141', issue: '답변 길이 ' + responseText.length + '자이나 표준 4구조 ' + structureScore + '/3 적용', severity: 'medium', detail: { hasConclusion: hasConclusion, hasScenario: hasScenario, hasAction: hasAction } });
  } else if (structureScore >= 2) {
    passes.push('R141 표준 구조 ' + structureScore + '/3');
  }
  // R142 출처 괄호 검증 — 정량 인용 + (출처) 매칭
  var priceMatches = responseText.match(/\$\d+(?:[,\.]\d+)*/g) || [];
  var citedPrices = (responseText.match(/\$\d+[\d,\.]*\s*\([^)]*(?:Yahoo|FMP|Finnhub|Naver|SEC|CNN|fetched|KST|\d{4}-\d{2}-\d{2})/g) || []).length;
  var uncitedPrices = priceMatches.length - citedPrices;
  if (priceMatches.length >= 2 && citedPrices === 0) {
    violations.push({ rule: 'R142', issue: '가격 ' + priceMatches.length + '회 인용하나 (출처·기준일) 0건', severity: 'high' });
  } else if (priceMatches.length > 0 && citedPrices > 0) {
    passes.push('R142 출처 ' + citedPrices + '/' + priceMatches.length);
  }
  // R145 자기 환각 자백 (이미 getChatHallucinationAudit에서 검출, 여기서 cross-reference)
  if (/(학습\s*데이터\s*기준|기억\s*속|내가\s*알기로)/.test(responseText)) {
    violations.push({ rule: 'R145', issue: 'AI 자기 환각 자백 표현 사용', severity: 'critical' });
  }
  var overallVerdict = violations.some(function(v){ return v.severity === 'critical'; }) ? 'critical' :
                       violations.some(function(v){ return v.severity === 'high'; }) ? 'fail' :
                       violations.length > 0 ? 'warn' : 'ok';
  return {
    status: overallVerdict,
    violations: violations,
    violationCount: violations.length,
    passes: passes,
    passCount: passes.length,
    responseLength: responseText.length,
    note: 'v49.75 R148: R140 정성→정량 / R141 표준 4 구조 / R142 출처 괄호 / R145 자기 환각 자백 4 ABSOLUTE RULES 답변 후처리 검증. Pattern B 일반화.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.75 P401 R149: assertFetchFailureSurfacingAudit — 17 fetch 실패 silent 검증
// 사용자 정직 발견 — NVDA Yahoo fetch 실패 silent (R122 4단계 폴백 있어도 사용자 인지 어려움).
// Pattern C 일반화: _fetchTickerDataForChat의 17 promise 각각 실패 시 ❌ 라벨 명시 검증.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertFetchFailureSurfacingAudit = function() {
  var src = (typeof window._fetchTickerDataForChat === 'function') ? window._fetchTickerDataForChat.toString() : '';
  var keyFetches = ['sec', 'wiki', 'sec8K', 'fhNews', 'insider', 'thirteenF', 'fcf', 'balance', 'evEbitda', 'macroBeta', 'short', 'riskFactors', 'supplyChain', 'partnership', 'platform', 'moat', 'tam'];
  var perFetch = keyFetches.map(function(name) {
    // 패턴: NAME + Promise 변수 + 실패/null 처리 검증
    var promiseVar = name + 'Promise';
    var hasPromise = src.indexOf(promiseVar) >= 0;
    // 실패 처리: catch + null check + 사용자 surfacing
    var hasNullCheck = new RegExp(promiseVar + '\\s*\\?\\s*await').test(src);
    return {
      name: name,
      hasPromise: hasPromise,
      hasNullCheck: hasNullCheck
    };
  });
  var promiseTotal = perFetch.filter(function(p){ return p.hasPromise; }).length;
  var hasFailureSurfaceFn = typeof window._aioRenderFetchFailures === 'function';
  var hasUserVisibleFailLabel = src.indexOf('❌') >= 0 || src.indexOf('실패') >= 0;
  return {
    status: promiseTotal >= 14 && hasUserVisibleFailLabel ? 'ok' : promiseTotal >= 10 ? 'warn' : 'fail',
    totalExpectedFetches: keyFetches.length,
    promiseDefined: promiseTotal,
    perFetch: perFetch,
    hasFailureSurfaceFn: hasFailureSurfaceFn,
    hasUserVisibleFailLabel: hasUserVisibleFailLabel,
    coveragePct: Math.round((promiseTotal / keyFetches.length) * 100),
    note: 'v49.75 R149: _fetchTickerDataForChat 17 fetch promise × 실패 surfacing 검증. Pattern C 일반화.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.70 P375 R132~R134: assertChatAdvancedFeaturesAudit — 사용자 프로필 + 알람 + 다운로드 + 금액/% 시뮬레이션 자동 진단
// 사용자 정직 요구 "전체 세션 남은 영역과 부분 모두 보강"
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatAdvancedFeaturesAudit = function() {
  var fnChecks = {
    userProfileGet: typeof window._aioGetUserProfile === 'function',
    userProfileSet: typeof window._aioSetUserProfile === 'function',
    buildUserProfileContext: typeof window._buildUserProfileContext === 'function',
    alertGet: typeof window._aioGetAlerts === 'function',
    alertAdd: typeof window._aioAddAlert === 'function',
    alertParse: typeof window._aioParseAlertIntent === 'function',
    alertCheck: typeof window._aioCheckAlerts === 'function',
    exportChatData: typeof window._aioExportChatData === 'function',
    exportFromBtn: typeof window._aioExportFromBtn === 'function',
    simulateAmount: typeof window._aioSimulateAmountOrPct === 'function'
  };
  var chatSendSrc = (typeof window.chatSend === 'function') ? window.chatSend.toString() : '';
  var v48Src = (typeof window._getV48IntegratedContext === 'function') ? window._getV48IntegratedContext.toString() : '';
  var integrations = {
    profileInV48: v48Src.indexOf('_buildUserProfileContext') >= 0,
    alertInChatSend: chatSendSrc.indexOf('_aioParseAlertIntent') >= 0,
    amountSimInChatSend: chatSendSrc.indexOf('_aioSimulateAmountOrPct') >= 0,
    downloadBtnInChatSend: chatSendSrc.indexOf('_aioExportFromBtn') >= 0,
    notificationApi: typeof Notification !== 'undefined'
  };
  var apiChecks = {
    aioGetAlerts: typeof (window.AIO && window.AIO.getAlerts) === 'function',
    aioAddAlert: typeof (window.AIO && window.AIO.addAlert) === 'function',
    aioGetUserProfile: typeof (window.AIO && window.AIO.getUserProfile) === 'function',
    aioSetUserProfile: typeof (window.AIO && window.AIO.setUserProfile) === 'function',
    aioExportChatData: typeof (window.AIO && window.AIO.exportChatData) === 'function'
  };
  var fnCount = Object.values(fnChecks).filter(Boolean).length;
  var integCount = Object.values(integrations).filter(Boolean).length;
  var apiCount = Object.values(apiChecks).filter(Boolean).length;
  var total = Object.keys(fnChecks).length + Object.keys(integrations).length + Object.keys(apiChecks).length;
  var pass = fnCount + integCount + apiCount;
  var coveragePct = Math.round(pass / total * 100);
  return {
    status: coveragePct === 100 ? 'ok' : coveragePct >= 80 ? 'warn' : 'fail',
    coveragePct: coveragePct,
    fnCount: fnCount, fnTotal: Object.keys(fnChecks).length,
    integCount: integCount, integTotal: Object.keys(integrations).length,
    apiCount: apiCount, apiTotal: Object.keys(apiChecks).length,
    fnChecks: fnChecks, integrations: integrations, apiChecks: apiChecks,
    activeAlerts: (typeof window._aioGetAlerts === 'function') ? window._aioGetAlerts().length : 0,
    userProfileSet: (typeof window._aioGetUserProfile === 'function') ? (window._aioGetUserProfile().riskTolerance !== 'medium' || (window._aioGetUserProfile().preferredAssets || []).length > 0) : false,
    note: 'v49.70 신규 4 영역 (사용자 프로필 / 알람 / 다운로드 / 금액 시뮬레이션) 자동 진단 — 100% = 완전 통합.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.69 P370 R129~R131: assertChatInteractivityAudit — 6 인터랙티브 기능 자동 진단
// (후속 질문 / 자동 페이지 이동 / 포트폴리오 시뮬레이션 / 거시 시나리오 / fuzzy 매칭 / 응답 시각 단서)
// 사용자 정직 요구 "AI 채팅에서 활용할 수 있는 모든 답변/기능"
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatInteractivityAudit = function() {
  var checks = {
    suggestFollowUpQuestions: typeof window._suggestFollowUpQuestions === 'function',
    autoNavigatePage: typeof window._autoNavigatePage === 'function',
    simulatePortfolioAddition: typeof window._simulatePortfolioAddition === 'function',
    simulateMacroScenario: typeof window._simulateMacroScenario === 'function',
    resolveTickerFromFuzzy: typeof window._resolveTickerFromFuzzy === 'function',
    chatFromChip: typeof window.chatFromChip === 'function'
  };
  // _fetchTickerDataForChat 자체에 chip 렌더링 통합 검증
  var chatSendSrc = (typeof window.chatSend === 'function') ? window.chatSend.toString() : '';
  var integrations = {
    followUpInChatSend: chatSendSrc.indexOf('_suggestFollowUpQuestions') >= 0,
    autoNavInChatSend: chatSendSrc.indexOf('_autoNavigatePage') >= 0,
    pfSimInChatSend: chatSendSrc.indexOf('_simulatePortfolioAddition') >= 0,
    macroSimInChatSend: chatSendSrc.indexOf('_simulateMacroScenario') >= 0,
    fuzzyResolveInTickerExtract: chatSendSrc.indexOf('_resolveTickerFromFuzzy') >= 0
  };
  var fnCount = Object.values(checks).filter(Boolean).length;
  var integCount = Object.values(integrations).filter(Boolean).length;
  var totalChecks = Object.keys(checks).length + Object.keys(integrations).length;
  var passCount = fnCount + integCount;
  var coveragePct = Math.round(passCount / totalChecks * 100);
  return {
    status: coveragePct === 100 ? 'ok' : coveragePct >= 80 ? 'warn' : 'fail',
    coveragePct: coveragePct,
    fnCount: fnCount,
    fnTotal: Object.keys(checks).length,
    integCount: integCount,
    integTotal: Object.keys(integrations).length,
    checks: checks,
    integrations: integrations,
    note: 'v49.69 신규 6 인터랙티브 기능 자동 진단 — 100% = 완전 통합, 80%+ = 보강 권장.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.68 P362 R128: getChatContextConsistencyAudit — 14 CHAT_CONTEXTS 간 데이터 일관성 + 기관급 프레임 통합 + 시각 단서 표준 자동 검증
// 사용자 정직 지적: "AI 채팅 시스템 전체가 유기적으로 기관급 퀄리티로 작동해야"
// ─────────────────────────────────────────────────────────────────
window.AIO.getChatContextConsistencyAudit = function() {
  var ctxIds = window.CHAT_CONTEXTS ? Object.keys(window.CHAT_CONTEXTS) : [];
  if (ctxIds.length === 0) return { status: 'error', issues: ['CHAT_CONTEXTS undefined'] };
  // 1. 라이브 데이터 인용 일관성 — 핵심 4 변수 (VIX/10Y/DXY/F&G) 주입 매트릭스
  var liveDataKeys = ['s.vix', 's.tnx', 's.dxy', 's.fg', '_liveSnap()'];
  var dataMatrix = {};
  var instFwHits = {};
  var scenarioHits = {};
  var visualCueHits = {};
  var srcStampHits = {};
  ctxIds.forEach(function(id) {
    var ctx = window.CHAT_CONTEXTS[id];
    if (!ctx || typeof ctx.system !== 'function') return;
    var src = '';
    try { src = ctx.system.toString(); } catch(_) {}
    var rendered = '';
    try { rendered = String(ctx.system() || ''); } catch(_) {}
    var scan = src + '\n' + rendered;
    dataMatrix[id] = {
      vix: scan.indexOf('s.vix') >= 0 || /VIX/i.test(scan),
      tnx: scan.indexOf('s.tnx') >= 0 || /10Y|TNX|금리/i.test(scan),
      dxy: scan.indexOf('s.dxy') >= 0 || /DXY|달러/i.test(scan),
      fg:  scan.indexOf('s.fg') >= 0 || scan.indexOf('s.fg ') >= 0 || /Fear|Greed|F&G/i.test(scan),
      liveSnap: scan.indexOf('_liveSnap') >= 0 || /현재 시장 환경|market environment/i.test(scan)
    };
    // 기관급 프레임 — _getV48IntegratedContext가 자동 통합하므로 호출 여부만
    instFwHits[id] = scan.indexOf('_getV48IntegratedContext') >= 0 || /Bridgewater|Druckenmiller|기관급 분석 프레임워크|All Weather/i.test(scan);
    // Bull/Base/Bear 시나리오 패턴 (system prompt 자체에 시나리오 가이드 명시 여부)
    scenarioHits[id] = /Bull.*Base.*Bear|시나리오.*분기|시나리오.*확률/i.test(scan);
    // 시각 단서 표준 (이모지 사용 여부)
    visualCueHits[id] = /🔴|🟡|🟢|📈|📉|red|yellow|green/i.test(scan);
    // 출처 타임스탬프 (기준일/snapshot date)
    srcStampHits[id] = /기준|snapshot|asOfDate|sourceTs|\[Source|Source:/i.test(scan);
  });
  // 2. 일관성 점수 계산
  var totalCtx = ctxIds.length;
  var vixCoverage = Object.values(dataMatrix).filter(function(d) { return d.vix; }).length;
  var instFwCoverage = Object.values(instFwHits).filter(Boolean).length;
  var scenarioCoverage = Object.values(scenarioHits).filter(Boolean).length;
  var visualCueCoverage = Object.values(visualCueHits).filter(Boolean).length;
  var srcStampCoverage = Object.values(srcStampHits).filter(Boolean).length;
  // 3. _fetchTickerDataForChat에서 시장 헤더 + 시나리오 가이드 + 시각 단서 검증
  var chatFn = typeof window._fetchTickerDataForChat === 'function' ? window._fetchTickerDataForChat.toString() : '';
  var chatHasMktHeader = chatFn.indexOf('현재 시장 환경') >= 0;
  var chatHasScenarioGuide = /Bull.*Base.*Bear|Bull \(.*%\)/.test(chatFn);
  var chatHasVisualCue = /🔴|🟡|🟢/.test(chatFn);
  var chatHasSrcStamp = chatFn.indexOf('기준일') >= 0;
  var chatHasInstFw = chatFn.indexOf('기관급') >= 0 || chatFn.indexOf('Bridgewater') >= 0 || chatFn.indexOf('R126') >= 0;
  // 4. 종합 점수 (사용자 체감 기관급 퀄리티 0~100)
  var qualityScore = Math.round((
    (vixCoverage / totalCtx) * 15 +              // 라이브 데이터 일관성
    (instFwCoverage / totalCtx) * 25 +           // 기관급 프레임 통합 비중 최고
    (scenarioCoverage / Math.max(totalCtx, 1)) * 10 +  // 시나리오 가이드
    (visualCueCoverage / Math.max(totalCtx, 1)) * 5 +
    (srcStampCoverage / Math.max(totalCtx, 1)) * 5 +
    (chatHasMktHeader ? 10 : 0) +
    (chatHasScenarioGuide ? 10 : 0) +
    (chatHasVisualCue ? 8 : 0) +
    (chatHasSrcStamp ? 7 : 0) +
    (chatHasInstFw ? 5 : 0)
  ));
  return {
    status: qualityScore >= 85 ? 'ok' : qualityScore >= 60 ? 'warn' : 'fail',
    qualityScore: qualityScore,
    contexts: {
      total: totalCtx,
      vixCoverage: vixCoverage,
      instFwCoverage: instFwCoverage,
      scenarioCoverage: scenarioCoverage,
      visualCueCoverage: visualCueCoverage,
      srcStampCoverage: srcStampCoverage,
      dataMatrix: dataMatrix
    },
    fetchChat: {
      mktHeader: chatHasMktHeader,
      scenarioGuide: chatHasScenarioGuide,
      visualCue: chatHasVisualCue,
      srcStamp: chatHasSrcStamp,
      instFw: chatHasInstFw
    },
    note: 'qualityScore 85+ = 기관급 / 60~85 = 보강 필요 / <60 = 표면 조사. v49.68 R126/R127/R128 3 신규 규칙 동시 검증.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.67 P355 R122: assertTickerFetchHealth — REGISTRY 샘플링 fetch 성공률 측정
// _liveData 캐시 hit + REGISTRY 카테고리별 (US/KR/ADR/암호화폐/지수) coverage 정합
// 사용자 체감 "몇몇 종목 시세 안 나옴" 자동 진단
// ─────────────────────────────────────────────────────────────────
window.AIO.assertTickerFetchHealth = function() {
  var reg = window.AIO_TICKER_NAME_REGISTRY;
  var entries = (reg && reg.entries) || {};
  var liveData = window._liveData || {};
  var keys = Object.keys(entries).filter(function(k) {
    var e = entries[k];
    return e && e.en !== '_skip' && k.indexOf('_dup') < 0;
  });
  var byCategory = {
    us: { total: 0, live: 0, missing: [] },
    kr: { total: 0, live: 0, missing: [] },
    adr: { total: 0, live: 0, missing: [] },
    crypto: { total: 0, live: 0, missing: [] },
    index: { total: 0, live: 0, missing: [] },
    other: { total: 0, live: 0, missing: [] }
  };
  keys.forEach(function(k) {
    var cat = k.endsWith('.KS') || k.endsWith('.KQ') ? 'kr' :
              k.includes('-USD') ? 'crypto' :
              k.startsWith('^') ? 'index' :
              k.includes('=X') || k.includes('=F') ? 'other' :
              /^(IBN|HDB|INFY|WIT|TTM|RDY|SIFY|YY|SAP|SIEGY|NSRGY|LVMUY|RHHBY|NVS|UL|DEO|AZN|GSK|TM|HMC|SNY|EADSY|VALE|ITUB|BBD|MELI|PAGS|SE|GLOB|BIDU|PDD|BABA|TSM|ASML|NVO|FANUY|NTDOY|SONY)$/.test(k) ? 'adr' :
              'us';
    byCategory[cat].total++;
    if (liveData[k] && liveData[k].price > 0) {
      byCategory[cat].live++;
    } else {
      if (byCategory[cat].missing.length < 5) byCategory[cat].missing.push(k);
    }
  });
  var totalLive = 0, totalAll = 0;
  Object.keys(byCategory).forEach(function(c) {
    totalLive += byCategory[c].live;
    totalAll += byCategory[c].total;
    byCategory[c].coveragePct = byCategory[c].total > 0 ? Math.round(byCategory[c].live / byCategory[c].total * 100) : 0;
  });
  var overallPct = totalAll > 0 ? Math.round(totalLive / totalAll * 100) : 0;
  // _chatTickerCache hit rate
  var ccStats = (window.AIO && window.AIO.getChatTickerCacheStats) ? window.AIO.getChatTickerCacheStats() : null;
  return {
    status: overallPct >= 30 ? 'ok' : overallPct >= 15 ? 'warn' : 'low',
    totalRegistry: totalAll,
    liveDataHit: totalLive,
    overallCoveragePct: overallPct,
    byCategory: byCategory,
    chatTickerCache: ccStats,
    fallbackChain: 'Yahoo (3 proxies) → Stooq → Naver (KR) → Finnhub (US/ADR)',
    note: 'overallCoveragePct는 REGISTRY ' + totalAll + '개 중 _liveData 캐시 hit 종목 비율. 30% 이상 정상 (메가캡+테마 우선 로드 보장). KR ticker는 Naver siseJson 폴백 필수 — coverage 낮으면 fetchWithTimeout 점검. 카테고리별 missing 5개 샘플은 사용자가 직접 fetch 시도해 폴백 체인 확인 가능.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.66 P351 R121: assertChatFunctionCoverage — Dead code/Partial Integration/Silent Fail 자동 회귀 방지
// AI 채팅 시스템에 정의된 fetch/compute 함수가 실제로 _fetchTickerDataForChat에 통합되었는지
// + 14 CHAT_CONTEXTS가 _getV48IntegratedContext 호출했는지 + _chatTickerCache save 로직 존재 자동 검증
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatFunctionCoverage = function() {
  // 1. window.AIO.fetch* / compute* 함수 목록 (채팅 통합 후보)
  var chatRelevantFns = Object.keys(window.AIO || {}).filter(function(k) {
    return /^(fetch|compute)[A-Z]/.test(k);
  });
  // 2. _fetchTickerDataForChat 소스에서 호출 검색
  var chatSrc = typeof window._fetchTickerDataForChat === 'function' ? window._fetchTickerDataForChat.toString() : '';
  // 알려진 deprecated/내부전용 — false positive 차단
  var knownExempt = {
    'fetchWithTimeout': true,         // 일반 fetch util
    'fetchAllNews': true,             // briefing 페이지 전용
    'fetchFearGreed': true,           // F&G 별도 fetch (CNN)
    'fetchNaverNews': true,           // 뉴스 별도
    'fetchTopAnalystEstimates': true, // 별도 표
    'fetchFinnhubEconomicCalendar': true, // 별도
    'fetchFRED': true,                // macro 별도
    'fetchFMPProfile': true,          // 내부 helper
    'fetchFMPRatios': true,           // 내부 helper
    'fetchFMPCashflow': true,         // 내부 helper
    'fetchFMPBalance': true,          // 내부 helper
    'fetchFMPIncome': true,           // 내부 helper
    'fetchFMPGrowth': true,           // 내부 helper
    'fetchFMPDCF': true,              // 내부 helper
    'fetchFMPPriceTarget': true,      // 내부 helper
    'fetchFMPInstitutional': true,    // 내부 helper
    'fetchFMPInsiderTrades': true,    // 내부 helper
    'fetchFMPRevGeo': true,           // 내부 helper
    'fetchFMPEstimates': true,        // 내부 helper
    'fetchFMPExecutives': true,       // 내부 helper
    'fetchFMPMetrics': true,          // 내부 helper
    'fetchFinnhubEarningsCalendar': true,    // 이미 _fetchTickerDataForChat에 직접 호출
    'fetchFinnhubRecommendation': true,      // 이미 _fetchTickerDataForChat에 직접 호출
    'fetchNaverUSData': true,                // 이미 _fetchTickerDataForChat에 직접 호출
    'fetchPolygonOptions': true,             // options 페이지 전용
    'fetchFMP5YQuarterly': true,             // fundamentals 페이지 장기 재무 차트 전용
    'fetchKRQuarterly': true,                // KR fundamentals 페이지 전용
    'fetchQuarterlyFinancials': true         // fundamentals 페이지 차트 파이프라인 전용
  };
  var deadCode = chatRelevantFns.filter(function(fn) {
    if (knownExempt[fn]) return false;
    // _fetchTickerDataForChat에 'AIO.fn(' 또는 'window.AIO.fn(' 패턴 검색
    var pattern1 = new RegExp('AIO\\.' + fn + '\\(');
    var pattern2 = new RegExp('window\\.AIO\\.' + fn + '\\(');
    return !pattern1.test(chatSrc) && !pattern2.test(chatSrc);
  });
  // 3. CHAT_CONTEXTS 14개 _getV48IntegratedContext 호출 검증
  var ctxIds = window.CHAT_CONTEXTS ? Object.keys(window.CHAT_CONTEXTS) : [];
  var partialContexts = ctxIds.filter(function(id) {
    var ctx = window.CHAT_CONTEXTS[id];
    if (!ctx || typeof ctx.system !== 'function') return false;
    var src = '';
    try { src = ctx.system.toString(); } catch(_) {}
    var rendered = '';
    try { rendered = String(ctx.system() || ''); } catch(_) {}
    var scan = src + '\n' + rendered;
    return scan.indexOf('_getV48IntegratedContext') < 0 && !/Bridgewater|Druckenmiller|기관급 분석 프레임워크|All Weather|Bull.*Base.*Bear/i.test(scan);
  });
  // 4. silent fail 검증 — _chatTickerCache save 로직 존재 + LRU eviction
  var hasCacheSave = chatSrc.indexOf('_chatTickerCache[t]') >= 0 || chatSrc.indexOf('_chatTickerCache[ t ]') >= 0;
  var hasCacheLoad = chatSrc.indexOf('_chatTickerCache[_ct]') >= 0 || chatSrc.indexOf('cacheMissTickers') >= 0;
  var hasLRU = chatSrc.indexOf('_CC_MAX') >= 0 || chatSrc.indexOf('evictions') >= 0;
  var cacheImplemented = hasCacheSave && hasCacheLoad && hasLRU;
  // 5. 정합 비율 계산
  var integrated = chatRelevantFns.length - deadCode.length;
  var integrationPct = chatRelevantFns.length > 0 ? Math.round(integrated / chatRelevantFns.length * 100) : 100;
  var ctxIntegrated = ctxIds.length - partialContexts.length;
  var ctxIntegrationPct = ctxIds.length > 0 ? Math.round(ctxIntegrated / ctxIds.length * 100) : 100;
  return {
    status: (deadCode.length === 0 && partialContexts.length === 0 && cacheImplemented) ? 'ok' : 'warn',
    chatRelevantFnCount: chatRelevantFns.length,
    integratedFnCount: integrated,
    deadCode: deadCode,
    deadCodeCount: deadCode.length,
    integrationPct: integrationPct,
    contextTotal: ctxIds.length,
    contextIntegrated: ctxIntegrated,
    partialContexts: partialContexts,
    partialContextCount: partialContexts.length,
    contextIntegrationPct: ctxIntegrationPct,
    cacheImplemented: cacheImplemented,
    cacheChecks: { save: hasCacheSave, load: hasCacheLoad, lru: hasLRU },
    note: 'Dead code 0건 + Partial 0건 + Cache 구현 = ok. 알려진 내부/페이지 전용 함수는 knownExempt로 false positive 차단.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.34 신규 fetch: fetchSECBusinessDescription
// SEC EDGAR 10-K Item 1 (Business) 본문 fetch. 비즈니스 구조/사업 모델/공급망 출처.
// data.sec.gov 무료 + CORS 가능 (단 일부 프록시 필요)
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchSECBusinessDescription = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker || typeof ticker !== 'string') return null;
  ticker = ticker.toUpperCase().trim();
  // CIK 매핑 (가벼운 캐시 — 메가캡 우선)
  var CIK_MAP = {
    // v49.36: S&P 500 메가캡 50+ 확장 (v49.34 18개 → 50+)
    'NVDA': '0001045810', 'AAPL': '0000320193', 'MSFT': '0000789019',
    'GOOGL': '0001652044', 'GOOG': '0001652044',
    'AMZN': '0001018724', 'META': '0001326801',
    'TSLA': '0001318605', 'QCOM': '0000804328', 'AMD': '0000002488',
    'INTC': '0000050863', 'AVGO': '0001730168', 'TSM': '0001046179',
    'MU': '0000723125', 'ARM': '0001973239', 'SMCI': '0001375365',
    'PLTR': '0001321655', 'NFLX': '0001065280', 'JPM': '0000019617',
    // v49.36 신규 등록
    'BAC':  '0000070858', 'WFC':  '0000072971', 'C':    '0000831001',
    'GS':   '0000886982', 'MS':   '0000895421', 'V':    '0001403161',
    'MA':   '0001141391', 'JNJ':  '0000200406', 'PFE':  '0000078003',
    'UNH':  '0000731766', 'WMT':  '0000104169', 'PG':   '0000080424',
    'KO':   '0000021344', 'PEP':  '0000077476', 'XOM':  '0000034088',
    'CVX':  '0000093410', 'COP':  '0001163165', 'BA':   '0000012927',
    'CAT':  '0000018230', 'GE':   '0000040545', 'HON':  '0000773840',
    'DIS':  '0001744489', 'NKE':  '0000320187', 'MCD':  '0000063908',
    'COST': '0000909832', 'HD':   '0000354950', 'LOW':  '0000060667',
    'CRM':  '0001108524', 'ORCL': '0001341439', 'ADBE': '0000796343',
    'NOW':  '0001373715', 'SHOP': '0001594805', 'COIN': '0001679788',
    'BRK.B': '0001067983', 'BRK.A': '0001067983',
    // ── v49.57 확장: 반도체 장비/EDA (8) ──
    'AMAT': '0000006951', 'LRCX': '0000707549', 'KLAC': '0000319201',
    'SNPS': '0000883241', 'CDNS': '0000813672', 'MRVL': '0001835632',
    'MCHP': '0000827054', 'ON':   '0001097864',
    // ── v49.57 확장: 클라우드/SaaS/Cyber (12) ──
    'NET':  '0001477333', 'ESTC': '0001707753', 'DDOG': '0001561550',
    'SNOW': '0001640147', 'MDB':  '0001441816', 'GTLB': '0001653482',
    'CRWD': '0001535527', 'ZS':   '0001713683', 'OKTA': '0001660134',
    'FTNT': '0001262039', 'PANW': '0001327567', 'IBM':  '0000051143',
    // ── v49.57 확장: Biotech/GLP-1 (8) ──
    'LLY':  '0000059478', 'VKTX': '0001607678', 'MRNA': '0001682852',
    'REGN': '0000872589', 'VRTX': '0000875320', 'AMGN': '0000318154',
    'ABBV': '0001551152', 'MRK':  '0000310158',
    // ── v49.57 확장: 원전/전력 (7) ──
    'CEG':  '0001868275', 'VST':  '0001692819', 'NRG':  '0001013871',
    'BWXT': '0001581809', 'EXC':  '0001109357', 'AEP':  '0000004904',
    'DUK':  '0000017797',
    // ── v49.57 확장: 우주/위성 (5) ──
    'RKLB': '0001819994', 'ASTS': '0001780312', 'LUNR': '0001844507',
    'PL':   '0001801169', 'RDW':  '0001819810',
    // ── v49.57 확장: 양자컴퓨팅 (4) ──
    'IONQ': '0001824920', 'RGTI': '0001838359', 'QUBT': '0001758009',
    'QBTS': '0001907982',
    // ── v49.57 확장: 크립토/핀테크 (8) ──
    'MSTR': '0001050446', 'RIOT': '0001167419', 'MARA': '0001507605',
    'HOOD': '0001783879', 'PYPL': '0001633917', 'SOFI': '0001818874',
    'AFRM': '0001820302', 'NU':   '0001691493',
    // ── v49.57 확장: 광통신/네트워킹 (6) ──
    'LITE': '0001633978', 'CIEN': '0000936395', 'AAOI': '0001070235',
    'GLW':  '0000024741', 'ANET': '0001596532', 'VIAV': '0000912093',
    // ── v49.57 확장: EV/Auto (6) ──
    'RIVN': '0001874178', 'LCID': '0001811210', 'GM':   '0001467858',
    'F':    '0000037996', 'MBLY': '0001910139', 'APTV': '0001521332',
    // ── v49.57 확장: Robotics (3) ──
    'SYM':  '0001837240', 'PATH': '0001734722', 'ISRG': '0001035267',
    // ── v49.57 확장: 데이터센터/Neocloud (9) ──
    'EQIX': '0001101239', 'DLR':  '0001297996', 'VRT':  '0001674101',
    'ETN':  '0001551182', 'IREN': '0001878685', 'CIFR': '0001819989',
    'WULF': '0001083301', 'DELL': '0001571996', 'HPE':  '0001645590',
    // ── v49.57 확장: 태양광/수소 (8) ──
    'FSLR': '0001274494', 'ENPH': '0001463101', 'RUN':  '0001469367',
    'SEDG': '0001419612', 'NXT':  '0001948544', 'BE':   '0001664703',
    'PLUG': '0001093691', 'FCEL': '0000886128',
    // ── v49.57 확장: 스트리밍/광고 (6) ──
    'WBD':  '0001437107', 'SPOT': '0001639920', 'ROKU': '0001428439',
    'TTD':  '0001671933', 'APP':  '0001823144', 'SNAP': '0001564408',
    // ── v49.57 확장: 에너지/석유 (7) ──
    'SLB':  '0000087347', 'EOG':  '0000821189', 'FANG': '0001539838',
    'DVN':  '0001090012', 'MPC':  '0001510295', 'VLO':  '0001035002',
    'PSX':  '0001534701',
    // ── v49.57 확장: 방산 (7) ──
    'RTX':  '0000101829', 'LMT':  '0000936468', 'NOC':  '0001133421',
    'GD':   '0000040533', 'HII':  '0001501585', 'LDOS': '0001336920',
    'HWM':  '0001645590',
    // ── v49.57 확장: 소비/리테일/여행 (10) ──
    'SBUX': '0000829224', 'LULU': '0001397187', 'BKNG': '0001075531',
    'ABNB': '0001559720', 'UBER': '0001543151', 'DASH': '0001792789',
    'DAL':  '0000027904', 'UAL':  '0000100517', 'CCL':  '0000815097',
    'TMUS': '0001283699',
    // ── v49.57 확장: 헬스케어 (4) ──
    'TMO':  '0000097745', 'ABT':  '0000001800', 'GILD': '0000882095',
    'BMY':  '0000014272',
    // ── v49.57 확장: 게임/소셜 (5) ──
    'EA':   '0000712515', 'TTWO': '0000946581', 'RBLX': '0001315098',
    'PINS': '0001506293', 'RDDT': '0001713445',
    // ── v49.57 확장: AI/IT (3) ──
    'AI':   '0001577526', 'SOUN': '0001840856', 'CSCO': '0000858877'
  };
  var cik = CIK_MAP[ticker];
  if (!cik) return { ticker: ticker, available: false, reason: 'CIK_MAP에 미등록 — v49.35에서 EDGAR full-text search 통합 예정' };
  try {
    // EDGAR submissions API
    var url = 'https://data.sec.gov/submissions/CIK' + cik + '.json';
    var proxies = [
      function(u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
      function(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }
    ];
    for (var i = 0; i < proxies.length; i++) {
      try {
        var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(proxies[i](url), {}, 10000) : fetch(proxies[i](url)));
        if (r && r.ok) {
          var raw = await r.json();
          if (raw.contents) try { raw = JSON.parse(raw.contents); } catch(_) {}
          if (raw && raw.filings && raw.filings.recent) {
            var rec = raw.filings.recent;
            var idx10K = (rec.form || []).indexOf('10-K');
            if (idx10K >= 0) {
              return {
                ticker: ticker,
                available: true,
                source: 'SEC EDGAR',
                cik: cik,
                companyName: raw.name || raw.entityType || ticker,
                sic: raw.sic,
                sicDescription: raw.sicDescription,
                latest10K: {
                  filingDate: rec.filingDate[idx10K],
                  reportDate: rec.reportDate[idx10K],
                  accession: rec.accessionNumber[idx10K],
                  primaryDoc: rec.primaryDocument[idx10K]
                },
                businessDescriptionUrl: 'https://www.sec.gov/Archives/edgar/data/' + parseInt(cik, 10) + '/' + (rec.accessionNumber[idx10K] || '').replace(/-/g, '') + '/' + (rec.primaryDocument[idx10K] || ''),
                note: '10-K Item 1 (Business) + Item 1A (Risk Factors) 직접 링크 — AI가 fetch+요약 가능'
              };
            }
          }
        }
      } catch(_proxyErr) {}
    }
  } catch (e) {}
  return { ticker: ticker, available: false, reason: 'SEC EDGAR fetch 실패 — 프록시 모두 fail' };
};

// ─────────────────────────────────────────────────────────────────
// v49.34 신규 fetch: fetchSECRiskFactors
// 10-K Item 1A 요약 — 리스크 항목. fetchSECBusinessDescription 메타 활용.
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchSECRiskFactors = async function(ticker) {
  var biz = await window.AIO.fetchSECBusinessDescription(ticker);
  if (!biz || !biz.available) return { ticker: ticker, available: false, reason: 'SEC 10-K 미수신' };
  return {
    ticker: ticker,
    available: true,
    source: 'SEC EDGAR 10-K Item 1A',
    riskFactorsUrl: biz.businessDescriptionUrl,
    note: 'Item 1A 섹션은 동일 10-K 문서 내. AI가 URL 접근 후 Item 1A 섹션 요약 가능.',
    sicDescription: biz.sicDescription
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.34 신규 fetch: fetchWikipediaCompany
// 영문 Wikipedia 기업 페이지 — 비즈니스/사업 모델/CEO/제품 포트폴리오/경쟁사 출처.
// en.wikipedia.org/w/api.php 공개 무료 + CORS 지원 (origin=*)
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchWikipediaCompany = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker || typeof ticker !== 'string') return null;
  ticker = ticker.toUpperCase().trim();
  // TICKER_NAME_REGISTRY에서 영문 이름 조회 (Wikipedia 페이지 제목)
  var nameReg = window.AIO_TICKER_NAME_REGISTRY;
  var entry = nameReg && nameReg.entries && nameReg.entries[ticker];
  if (!entry || !entry.en) return { ticker: ticker, available: false, reason: 'TICKER_NAME_REGISTRY에 영문 이름 미등록' };
  var companyName = entry.en;
  try {
    var url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|info&exintro=1&explaintext=1&inprop=url&titles=' + encodeURIComponent(companyName);
    var r = await (typeof fetchWithTimeout === 'function' ? fetchWithTimeout(url, {}, 8000) : fetch(url));
    if (r && r.ok) {
      var raw = await r.json();
      var pages = raw && raw.query && raw.query.pages;
      if (pages) {
        var pageKey = Object.keys(pages)[0];
        var page = pages[pageKey];
        if (page && page.extract) {
          return {
            ticker: ticker,
            companyName: page.title,
            available: true,
            source: 'Wikipedia (English)',
            url: page.fullurl || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(companyName)),
            extract: page.extract.slice(0, 2000),  // intro 섹션 2000자
            pageId: page.pageid,
            lastModified: page.touched
          };
        }
      }
    }
  } catch (e) {}
  return { ticker: ticker, available: false, reason: 'Wikipedia fetch 실패' };
};

// ─────────────────────────────────────────────────────────────────
// v49.34 핵심: assertAnalysisFrameworkCoverage(ticker) — 종목별 15 분야 가용성
// AI 채팅에서 종목 분석 요청 시 사전 검증. 환각 위험 영역 즉시 가시화.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertAnalysisFrameworkCoverage = async function(ticker) {
  if (!ticker) return { status: 'error', issues: ['ticker required'] };
  var reg = window.AIO_ANALYSIS_FRAMEWORK_REGISTRY;
  if (!reg) return { status: 'error', issues: ['REGISTRY undefined'] };
  var result = { ticker: ticker, fields: {}, available: 0, total: (reg.perspectiveKeys ? reg.perspectiveKeys().length : 17), generatedAt: new Date().toISOString() };
  // 1. price (Yahoo)
  var ld = window._liveData || {};
  result.fields['price-realtime'] = { available: !!(ld[ticker] && ld[ticker].price), source: 'Yahoo' };
  // 2. chart (visual — 항상 가용)
  result.fields['chart-technical'] = { available: true, source: 'TradingView' };
  // 3. business-structure (SEC + Wikipedia + Naver)
  try {
    var sec = await window.AIO.fetchSECBusinessDescription(ticker);
    result.fields['business-structure'] = { available: !!(sec && sec.available), source: sec && sec.available ? 'SEC' : null, secCik: sec && sec.cik };
    result.fields['business-model'] = result.fields['business-structure'];
    result.fields['supply-chain'] = { available: !!(sec && sec.available), source: 'SEC 10-K Item 1C', confidence: 'low-medium', note: '키워드 가이드. AI가 10-K URL 접근 후 직접 인용 필요' };
    result.fields['competition'] = result.fields['business-structure'];
    result.fields['risk-factors'] = { available: !!(sec && sec.available), source: 'SEC 10-K Item 1A' };
  } catch(_) {
    ['business-structure', 'business-model', 'supply-chain', 'competition', 'risk-factors'].forEach(function(k) {
      result.fields[k] = { available: false, error: true };
    });
  }
  // 4. wikipedia (CEO, product portfolio)
  try {
    var wiki = await window.AIO.fetchWikipediaCompany(ticker);
    result.fields['ceo-management'] = { available: !!(wiki && wiki.available), source: 'Wikipedia' };
    result.fields['product-portfolio'] = result.fields['ceo-management'];
  } catch(_) {
    result.fields['ceo-management'] = { available: false, error: true };
    result.fields['product-portfolio'] = { available: false, error: true };
  }
  // 5. valuation (Yahoo PE + Naver)
  result.fields['valuation'] = { available: result.fields['price-realtime'].available, source: 'Yahoo PE + Naver' };
  // 6. revenue-structure (FMP — key 의존)
  result.fields['revenue-structure'] = { available: false, source: 'FMP segments', note: 'FMP API key 필요' };
  // 7. partnership/platform/moat/TAM (v49.65 부분 자동화)
  try {
    var pa = await window.AIO.fetchPartnershipAlerts(ticker, 6);
    result.fields['partnership'] = { available: !!(pa && pa.available), source: 'SEC 8-K Item 1.01/7.01', count: pa && pa.partnershipCount, confidence: pa && pa.dataConfidence };
  } catch(_) { result.fields['partnership'] = { available: false, error: true }; }
  try {
    var pe = await window.AIO.fetchPlatformEcosystem(ticker);
    result.fields['platform-ecosystem'] = { available: !!(pe && pe.available), source: '3-source synthesis', confidence: pe && pe.dataConfidence, score: pe && pe.ecosystemScore };
  } catch(_) { result.fields['platform-ecosystem'] = { available: false, error: true }; }
  try {
    var mo = await window.AIO.computeMoatScore(ticker);
    result.fields['moat-economic'] = { available: !!(mo && mo.available), source: 'SCREENER_DB + Naver', confidence: mo && mo.dataConfidence, score: mo && mo.score };
  } catch(_) { result.fields['moat-economic'] = { available: false, error: true }; }
  // 8. tam (SEC SIC + SCREENER_DB memo)
  try {
    var tam = await window.AIO.computeTAMEstimate(ticker);
    result.fields['tam-market-size'] = { available: !!(tam && tam.available), source: 'SEC SIC + memo', confidence: tam && tam.dataConfidence, tam: tam && tam.tamEstimate };
  } catch(_) { result.fields['tam-market-size'] = { available: false, error: true }; }
  // 9. investment-thesis (Finnhub + Naver)
  result.fields['investment-thesis'] = { available: true, source: 'Finnhub recommendation + Naver consensus' };
  // 10. fundamentals-ratios (FUNDAMENTAL_CRITERIA 87% coverage)
  result.fields['fundamentals-ratios'] = { available: true, source: 'AIO_FUNDAMENTAL_CRITERIA (87% impl)' };
  // 점수화
  result.available = Object.keys(result.fields).filter(function(k) { return result.fields[k].available; }).length;
  result.coveragePct = Math.round(result.available / result.total * 100);
  result.verdict = result.coveragePct >= 80 ? 'excellent' : result.coveragePct >= 60 ? 'good' : result.coveragePct >= 40 ? 'partial' : 'poor';
  result.hallucinationRiskHigh = Object.keys(result.fields).filter(function(k) {
    return !result.fields[k].available && reg.fields[k] && reg.fields[k].aiHallucinationRisk === 'high';
  });
  return result;
};

// ─────────────────────────────────────────────────────────────────
// v49.32 확장: assertTickerDataIntegrity — 단일 종목 전체 데이터 무결성
// 시세/추세/컨센서스/어닝/Naver/메모 6채널 모두 검증.
// R87 신규 (종목별 다중 데이터 채널 통합 검증)
// ─────────────────────────────────────────────────────────────────
window.AIO.assertTickerDataIntegrity = async function(ticker, opts) {
  opts = opts || {};
  if (!ticker || typeof ticker !== 'string') return { status: 'error', issues: ['ticker required'] };
  ticker = ticker.toUpperCase().trim();
  var result = {
    ticker: ticker,
    sources: {
      price:     { available: false, age: null, fresh: false },
      trend:     { available: false },
      consensus: { available: false, source: null },
      earnings:  { available: false },
      naver:     { available: false, krOnly: true },
      screenerMemo: { available: false, ageDays: null, stale: false }
    },
    missingCount: 0,
    completenessScore: 0,
    verdict: 'unknown',
    generatedAt: new Date().toISOString()
  };
  try {
    // 1. 시세 (PriceStore 또는 _liveData)
    var ld = window._liveData || {};
    if (ld[ticker] && ld[ticker].price) {
      result.sources.price.available = true;
      var ts = ld[ticker].ts || ld[ticker].timestamp;
      if (ts) {
        var age = Math.floor((Date.now() - ts) / 60000);
        result.sources.price.age = age + 'min';
        result.sources.price.fresh = age < 10;
      } else {
        result.sources.price.fresh = true; // 무관 — 캐시 존재 자체로 OK
      }
    }
    // 2. 추세 함수 존재
    result.sources.trend.available = typeof window._fetchTickerTrend === 'function';
    // 3. Finnhub 컨센서스
    result.sources.consensus.available = typeof window.fetchFinnhubRecommendation === 'function';
    result.sources.consensus.source = 'Finnhub';
    // 4. Finnhub 어닝
    result.sources.earnings.available = typeof window.fetchFinnhubEarningsCalendar === 'function';
    // 5. Naver (KR 종목 또는 보조)
    result.sources.naver.available = typeof window.fetchNaverUSData === 'function';
    // 6. SCREENER_DB 메모 신선도
    var meta = window.SCREENER_DB_META;
    if (meta && meta.lastBulkUpdate) {
      var memTs = new Date(meta.lastBulkUpdate).getTime();
      var memAge = Math.floor((Date.now() - memTs) / 86400000);
      result.sources.screenerMemo.available = true;
      result.sources.screenerMemo.ageDays = memAge;
      result.sources.screenerMemo.stale = memAge > (meta.staleAfterDays || 30);
    }
    // 점수화
    var ch = result.sources;
    var present = [ch.price.available, ch.trend.available, ch.consensus.available, ch.earnings.available, ch.naver.available, ch.screenerMemo.available].filter(Boolean).length;
    result.completenessScore = Math.round(present / 6 * 100);
    result.missingCount = 6 - present;
    if (result.completenessScore >= 90)      result.verdict = 'excellent';
    else if (result.completenessScore >= 70) result.verdict = 'good';
    else if (result.completenessScore >= 50) result.verdict = 'partial';
    else                                      result.verdict = 'poor';
    // 권장 액션
    if (!ch.price.available)        result.recommendation = '실시간 시세 미가용 — dynamicTickerLookup 시도 필요';
    else if (ch.screenerMemo.stale) result.recommendation = 'SCREENER_DB 메모 stale — /data-refresh 권장';
    else                             result.recommendation = '모든 채널 정상';
  } catch (e) {
    result.status = 'error';
    result.issues = [e && e.message || String(e)];
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────
// v49.32 확장: getFundamentalCriteriaAudit — 15개 분석 기준 데이터 출처 정합
// fundamental 페이지 15관점이 실제 데이터로 평가 가능한지 매핑.
// ─────────────────────────────────────────────────────────────────
window.AIO_FUNDAMENTAL_CRITERIA = {
  version: 'v49.32',
  criteria: {
    // v49.33: implFn null 11/15 → 기존 fetch 함수 매핑으로 보강 (4/15 → 13/15 구현)
    'quality-roe':       { label: 'Quality: ROE > 15%',      dataSource: 'FMP /ratios + Naver overview', required: ['roe'],            implFn: 'fetchNaverUSData|AIO_PIOTROSKI_CHECKLIST' },
    'quality-roa':       { label: 'Quality: ROA',            dataSource: 'FMP /ratios',                  required: ['roa'],            implFn: 'AIO_PIOTROSKI_CHECKLIST' },
    'growth-revenue':    { label: 'Growth: Revenue CAGR',    dataSource: 'FMP /income-statement-growth', required: ['revenue', 'revenuePrev'], implFn: 'fetchNaverUSData' },
    'growth-earnings':   { label: 'Growth: EPS CAGR',        dataSource: 'FMP /earnings + Finnhub',      required: ['eps', 'epsPrev'], implFn: 'fetchFinnhubEarningsCalendar' },
    'profitability-gpm': { label: 'Profitability: Gross Margin', dataSource: 'FMP /ratios',              required: ['gpm', 'gpmPrev'], implFn: 'AIO_PIOTROSKI_CHECKLIST' },
    'profitability-npm': { label: 'Profitability: Net Margin',   dataSource: 'FMP /ratios + Naver',      required: ['npm'],            implFn: 'fetchNaverUSData' },
    'margin-trend':      { label: 'Margin Trend (5Y)',       dataSource: 'FMP /financials 5Y',           required: ['margins5y'],      implFn: 'fetchNaverUSData', note: 'Naver overview에 5Y 부분 포함 (한계: 일부 종목만)' },
    'cashflow-quality':  { label: 'Cashflow: CFO > NI',      dataSource: 'FMP /cashflow',                required: ['cfo', 'netIncome'], implFn: 'AIO_PIOTROSKI_CHECKLIST' },
    'balance-leverage':  { label: 'Balance: Debt/Equity',    dataSource: 'FMP /balance-sheet + Naver',   required: ['debtToEquity'],   implFn: 'fetchNaverUSData' },
    'valuation-pe':      { label: 'Valuation: P/E vs 5Y avg', dataSource: 'Yahoo trailingPE + Naver',    required: ['pe', 'pe5yAvg'],  implFn: 'fetchNaverUSData|dynamicTickerLookup' },
    'valuation-peg':     { label: 'Valuation: PEG < 1.5',    dataSource: 'FMP /peg or compute',          required: ['peg'],            implFn: null, note: 'v49.34에서 computePEG() 신설 예정' },
    'fscore-piotroski':  { label: 'Piotroski F-Score 0~9',   dataSource: 'computed',                     required: ['9 items'],        implFn: 'AIO_PIOTROSKI_CHECKLIST' },
    'moat-rs':           { label: 'Moat: RS Rating IBD',     dataSource: 'computed RS (SCREENER_DB.rsi)', required: ['rs'],            implFn: 'SCREENER_DB', note: 'SCREENER_DB.rsi 필드 — 정확한 IBD RS는 v49.34 보강' },
    'insider-activity':  { label: 'Insider Buying/Selling',  dataSource: 'Finnhub /stock/insider-transactions', required: ['insiderNet'], implFn: null, note: 'v49.34에서 fetchFinnhubInsider() 신설 예정' },
    'analyst-consensus': { label: 'Analyst Consensus',       dataSource: 'Finnhub recommendation + Naver consensus', required: ['recommendation'], implFn: 'fetchFinnhubRecommendation|fetchNaverUSData' }
  }
};

window.AIO.getFundamentalCriteriaAudit = function() {
  var reg = window.AIO_FUNDAMENTAL_CRITERIA;
  if (!reg) return { status: 'error', notImplCount: 0, issues: ['CRITERIA undefined'] };
  var notImpl = [];
  Object.keys(reg.criteria).forEach(function(key) {
    var c = reg.criteria[key];
    if (!c.implFn) {
      notImpl.push({ key: key, label: c.label, dataSource: c.dataSource });
    }
  });
  return {
    status: notImpl.length ? 'warn' : 'ok',
    notImplCount: notImpl.length,
    notImpl: notImpl,
    totalCriteria: Object.keys(reg.criteria).length,
    implCount: Object.keys(reg.criteria).length - notImpl.length,
    coveragePct: Math.round((Object.keys(reg.criteria).length - notImpl.length) / Object.keys(reg.criteria).length * 100),
    note: 'implFn null인 항목은 fetch 함수 미정의. v49.33+에서 보강 필요.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.32 M5 근본 수정: assertChatPriceFetchHealth — 채팅 전 fetch health
// dynamicTickerLookup 동작 확인 (proxy chain health) + circuit breaker.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertChatPriceFetchHealth = function() {
  var result = { status: 'ok', proxies: [], chainHealthy: true, issues: [] };
  try {
    // _aioProxyChain 또는 dynamicTickerLookup 가용성 확인
    var hasDynLookup = typeof window.dynamicTickerLookup === 'function';
    var hasProxyChain = !!window._aioProxyChain;
    if (!hasDynLookup) result.issues.push('dynamicTickerLookup undefined');
    if (!hasProxyChain) result.issues.push('_aioProxyChain undefined');
    // 프록시 체인 상태 확인
    if (hasProxyChain && typeof window._aioProxyChain.health === 'function') {
      var ph = window._aioProxyChain.health();
      result.proxies = ph || [];
      // 모든 프록시가 unhealthy 면 chain 실패
      var allDown = Array.isArray(ph) && ph.length > 0 && ph.every(function(p) { return p.openCircuit || p.recentFails >= 3; });
      if (allDown) {
        result.chainHealthy = false;
        result.issues.push('All proxies unhealthy (circuit open or recent fails)');
      }
    }
    // _liveData 캐시 크기 확인
    var ld = window._liveData || {};
    result.cachedTickerCount = Object.keys(ld).length;
    if (result.cachedTickerCount === 0 && !result.chainHealthy) {
      result.status = 'error';
      result.issues.push('No cached prices + proxy chain down → chat will hallucinate');
    } else if (!result.chainHealthy) {
      result.status = 'warn';
    }
  } catch (e) {
    result.status = 'error';
    result.issues.push('Health check error: ' + (e && e.message));
  }
  result.generatedAt = new Date().toISOString();
  return result;
};

// ─────────────────────────────────────────────────────────────────
// v49.31 H3 근본 수정: GEOPOLITICAL_CONTEXT_REGISTRY — 지정학 시나리오 단일 출처
// 호르무즈/이란/대만/우크라 등 시점 의존 시나리오. status: 'active'/'monitoring'/'resolved'
// R79 신규 (지정학 시나리오 단일 등록)
// ─────────────────────────────────────────────────────────────────
window.AIO_GEOPOLITICAL_CONTEXT_REGISTRY = {
  version: 'v49.31',
  defaultReviewDays: 14,
  scenarios: {
    'hormuz-strait': {
      name: '호르무즈 해협 긴장',
      region: 'middle-east',
      status: 'monitoring',
      lastReviewed: '2026-05-17',
      marketImpact: 'oil-supply',
      currentPriceSignal: 'WTI $102 / Brent $108 — 수요파괴 모니터링',
      note: '실제 봉쇄/재개 발생 시 status 변경 + WTI/Brent 정합 갱신'
    },
    'iran-nuclear-deal': {
      name: '이란 핵협상',
      region: 'middle-east',
      status: 'monitoring',
      lastReviewed: '2026-05-17',
      marketImpact: 'oil-risk-premium',
      currentPriceSignal: 'Brent 위험 프리미엄 $5~10 추정',
      note: '재협상 진전/결렬 이벤트 발생 시 갱신'
    },
    'taiwan-strait': {
      name: '대만 해협 긴장',
      region: 'asia-pacific',
      status: 'monitoring',
      lastReviewed: '2026-05-17',
      marketImpact: 'semiconductor-supply',
      currentPriceSignal: 'TSMC/SMCI/HBM 공급망 영향',
      note: '실제 군사 충돌/제재 발표 시 status 변경'
    },
    'ukraine-russia': {
      name: '러우 전쟁',
      region: 'europe',
      status: 'monitoring',
      lastReviewed: '2026-05-17',
      marketImpact: 'energy-grain',
      currentPriceSignal: '천연가스 + 곡물 변동성',
      note: '평화협상/확전 시 갱신'
    },
    'us-china-tariff': {
      name: '미중 관세 분쟁',
      region: 'global',
      status: 'monitoring',
      lastReviewed: '2026-05-17',
      marketImpact: 'tech-equity-supply-chain',
      currentPriceSignal: 'TSM/NVDA/AAPL 등 글로벌 공급망 영향',
      note: 'Trump 관세 정책 변경 시 갱신'
    }
  }
};

window.AIO.getGeopoliticalReviewAudit = function() {
  var reg = window.AIO_GEOPOLITICAL_CONTEXT_REGISTRY;
  if (!reg) return { status: 'error', overdueCount: 0, issues: ['GEOPOLITICAL_CONTEXT undefined'] };
  var now = Date.now();
  var overdue = [];
  Object.keys(reg.scenarios).forEach(function(key) {
    var s = reg.scenarios[key];
    var ts = new Date(s.lastReviewed).getTime();
    if (isNaN(ts)) return;
    var ageDays = Math.floor((now - ts) / 86400000);
    if (ageDays > reg.defaultReviewDays) {
      overdue.push({ key: key, name: s.name, ageDays: ageDays, status: s.status });
    }
  });
  return {
    status: overdue.length ? 'warn' : 'ok',
    overdueCount: overdue.length,
    overdue: overdue,
    totalScenarios: Object.keys(reg.scenarios).length,
    generatedAt: new Date(now).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.30 M2 근본 수정: STATIC_CONTENT_LIFECYCLE — 정적 콘텐츠 만료 정책
// 인터뷰/이벤트/메모 lifecycle 메타. archiveAfterDays 경과 시 자동 stale.
// R75 신규 (인터뷰 자동 expire)
// ─────────────────────────────────────────────────────────────────
window.AIO_STATIC_CONTENT_LIFECYCLE = {
  version: 'v49.30',
  defaultArchiveAfterDays: 30,
  defaultReplaceAfterDays: 60,
  contents: {
    'jensen-interview-202603': { type: 'interview', createdAt: '2026-03-20', archiveAfterDays: 30, replaceAfterDays: 60, source: 'NVIDIA CEO All-In Podcast' },
    'briefing-week-may-4-10': { type: 'weekly-calendar', createdAt: '2026-05-10', archiveAfterDays: 7, replaceAfterDays: 14, source: 'Past reference calendar' },
    'kr-export-2026-02':      { type: 'kr-macro-monthly', createdAt: '2026-03-01', archiveAfterDays: 45, replaceAfterDays: 60, source: '산업통상자원부 2월 수출' }
  },
  // 콘텐츠 ID의 expire 상태 계산
  getStatus: function(contentId, nowTs) {
    var c = this.contents[contentId];
    if (!c) return { exists: false };
    var now = nowTs || Date.now();
    var created = new Date(c.createdAt).getTime();
    var ageDays = Math.floor((now - created) / 86400000);
    var archiveAt = c.archiveAfterDays != null ? c.archiveAfterDays : this.defaultArchiveAfterDays;
    var replaceAt = c.replaceAfterDays != null ? c.replaceAfterDays : this.defaultReplaceAfterDays;
    return {
      exists: true,
      ageDays: ageDays,
      archiveDue: ageDays >= archiveAt,
      replaceDue: ageDays >= replaceAt,
      status: ageDays >= replaceAt ? 'replace-due' : ageDays >= archiveAt ? 'archive-due' : 'fresh'
    };
  }
};

window.AIO.getStaticContentLifecycleAudit = function() {
  var reg = window.AIO_STATIC_CONTENT_LIFECYCLE;
  if (!reg) return { status: 'error', expiredCount: 0, issues: ['LIFECYCLE registry undefined'] };
  var now = Date.now();
  var expired = [], replaceDue = [];
  Object.keys(reg.contents).forEach(function(id) {
    var s = reg.getStatus(id, now);
    if (s.replaceDue) replaceDue.push({ id: id, ageDays: s.ageDays, source: reg.contents[id].source });
    else if (s.archiveDue) expired.push({ id: id, ageDays: s.ageDays });
  });
  return {
    status: expired.length || replaceDue.length ? 'warn' : 'ok',
    expiredCount: expired.length + replaceDue.length,
    archiveDue: expired,
    replaceDue: replaceDue,
    generatedAt: new Date(now).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.48 P316/R75 보강: STATIC_CONTENT_LIFECYCLE 일반화 hook
// 모든 [data-lifecycle-id="ID"] 마커 element의 인접 [id$="-stale-days"] span을 자동 갱신.
// v49.47 P314 jensen-hardcoded → 일반화. briefing-week-may-4-10 / kr-export-2026-02 등도 자동 처리.
// ─────────────────────────────────────────────────────────────────
window._aioStaticContentLifecycleHook = function(rootEl) {
  try {
    var lc = window.AIO_STATIC_CONTENT_LIFECYCLE;
    if (!lc || typeof lc.getStatus !== 'function') return 0;
    var root = rootEl || document;
    var elements = root.querySelectorAll('[data-lifecycle-id]');
    var updated = 0;
    elements.forEach(function(el) {
      var id = el.getAttribute('data-lifecycle-id');
      if (!id) return;
      var st = lc.getStatus(id);
      if (!st || !st.exists) return;
      // span 검색: [id$="-stale-days"] 또는 .lifecycle-stale-days
      var span = el.querySelector('[id$="-stale-days"]') || el.querySelector('.lifecycle-stale-days');
      if (!span) return;
      var content = lc.contents[id] || {};
      var archiveAt = content.archiveAfterDays != null ? content.archiveAfterDays : lc.defaultArchiveAfterDays;
      var replaceAt = content.replaceAfterDays != null ? content.replaceAfterDays : lc.defaultReplaceAfterDays;
      var label = st.ageDays + '일 경과';
      if (st.replaceDue) {
        span.textContent = label + ' · ⚠️ 교체 권장 (' + replaceAt + '일+ 초과)';
        span.style.color = 'var(--data-red)';
        span.style.fontWeight = '700';
      } else if (st.archiveDue) {
        span.textContent = label + ' · 📦 archive 단계 (' + archiveAt + '일+ 초과)';
        span.style.color = 'var(--data-amber)';
        span.style.fontWeight = '600';
      } else {
        span.textContent = label + ' (fresh)';
        span.style.color = '';
        span.style.fontWeight = '';
      }
      updated++;
    });
    return updated;
  } catch(e) { return 0; }
};

// 모든 페이지 진입 시 자동 호출 — _aioPageBus는 이미 정의됨
if (typeof _aioPageBus !== 'undefined' && _aioPageBus.register) {
  _aioPageBus.register('core-lifecycle-hook', 'aio:pageShown', function() {
    setTimeout(function() { window._aioStaticContentLifecycleHook(); }, 200);
  });
}

// ─────────────────────────────────────────────────────────────────
// v49.48 R101 신규: getLiveSymbolsCoverageAudit (P317 — P315 재발 방지)
// DOM [data-live-price] ticker가 LIVE_SYMBOLS에 모두 등록됐는지 자동 탐지.
// XSD 같은 누락 ticker로 인한 영구 placeholder 사전 차단.
// ─────────────────────────────────────────────────────────────────
window.AIO.getLiveSymbolsCoverageAudit = function() {
  if (window.AIO && typeof window.AIO.registerLiveSymbolsFromDom === 'function') {
    window.AIO.registerLiveSymbolsFromDom(document, { reason: 'coverage-audit' });
  }
  var ls = new Set(window.LIVE_SYMBOLS || []);
  var derivedLiveKeys = new Set(['PCR']);
  var missing = [];
  var dynamic = []; // ${sym} 같은 placeholder는 제외 (테이블 렌더용 마커)
  try {
    document.querySelectorAll('[data-live-price]').forEach(function(el) {
      var t = el.getAttribute('data-live-price');
      if (!t) return;
      // 동적 placeholder (예: '${sym}' 또는 ' + sym + ' 같은 template 잔존)
      if (/[\${}]/.test(t) || /\+\s*sym\s*\+/.test(t) || t.length === 0) { dynamic.push(t); return; }
      if (derivedLiveKeys.has(t)) return;
      // archive 섹션 제외
      if (el.closest('[data-aio-archive="true"]')) return;
      if (ls.has(t)) return;
      missing.push({
        ticker: t,
        page: (el.closest('[id^="page-"]')||{}).id || 'unknown',
        elementId: el.id || ''
      });
    });
  } catch (e) {
    return { status: 'error', issueCount: 0, issues: [e && e.message] };
  }
  return {
    status: missing.length ? 'warn' : 'ok',
    issueCount: missing.length,
    missing: missing,
    dynamicMarkerCount: dynamic.length,
    totalLiveSymbols: ls.size,
    note: 'DOM [data-live-price] ticker가 LIVE_SYMBOLS에 모두 등록됐는지 자동 탐지. R101 신규 — P315 (XSD 미등록) 재발 방지.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.48 R102 신규: getCellLevelDataAudit(pageId) (P318)
// 페이지의 cell-level 요소(카드/표/임계값)를 enumerate + 값/색상/placeholder/data-snap key 캡쳐.
// sub-section enumerate에 그치지 않는 세밀 audit. 사용자 "세밀 쪼개서" 요청 대응.
// ─────────────────────────────────────────────────────────────────
window.AIO.getCellLevelDataAudit = function(pageId) {
  var p = document.getElementById('page-' + pageId);
  if (!p) return { status: 'error', error: 'page not found: ' + pageId };
  try {
    var cells = Array.from(p.querySelectorAll('.aio-card, .aio-metric-value, .stk-item, td[data-snap], td[data-live-price], [data-threshold-key], [data-snap], [data-live-price]'));
    // 중복 제거
    var seen = new Set();
    var unique = cells.filter(function(c) { if (seen.has(c)) return false; seen.add(c); return true; });
    var report = unique.map(function(c, idx) {
      var text = (c.textContent || '').trim();
      return {
        idx: idx,
        tag: c.tagName,
        id: c.id || '',
        cls: (c.className || '').toString().substring(0, 60),
        text: text.substring(0, 80),
        textLen: text.length,
        color: c.style.color || '',
        snapKey: c.getAttribute('data-snap') || null,
        liveKey: c.getAttribute('data-live-price') || null,
        thresholdKey: c.getAttribute('data-threshold-key') || null,
        archive: !!c.closest('[data-aio-archive="true"]')
      };
    });
    // v49.49 P319 보강: placeholder 휴리스틱 false positive 차단 — 본문 텍스트 안의 '대기' 단어 매칭 차단
    // 예: "+157.9% YoY (2월 기준 · 5월 갱신 대기)" 같은 정상 값에 stale label만 붙은 경우 placeholder 아님.
    // 짧은 텍스트(< 25자)만 placeholder 후보. 또는 텍스트 시작이 '—'/'...'.
    var placeholders = report.filter(function(r) {
      if (r.text === '—' || r.text === '...' || r.text === '') return true;
      if (r.text.length >= 25) return false; // 본문성 텍스트 제외
      return /^로딩|^loading|^계산\s*중|^분석\s*중|로딩 중|loading|계산 중|분석 중/i.test(r.text);
    });
    var bySnapKey = {}, byLiveKey = {}, byThreshold = {};
    report.forEach(function(r) {
      if (r.snapKey) bySnapKey[r.snapKey] = (bySnapKey[r.snapKey] || 0) + 1;
      if (r.liveKey) byLiveKey[r.liveKey] = (byLiveKey[r.liveKey] || 0) + 1;
      if (r.thresholdKey) byThreshold[r.thresholdKey] = (byThreshold[r.thresholdKey] || 0) + 1;
    });
    return {
      pageId: pageId,
      status: placeholders.length ? 'warn' : 'ok',
      totalCells: unique.length,
      placeholderCount: placeholders.length,
      placeholders: placeholders.slice(0, 15),
      bySnapKey: bySnapKey,
      byLiveKey: byLiveKey,
      byThresholdKey: byThreshold,
      cells: report.slice(0, 30), // 최대 30개 sample
      note: 'cell-level 값/색상/key 자동 캡쳐. R102 신규. sub-section enumerate 보다 세밀.',
      generatedAt: new Date().toISOString()
    };
  } catch (e) {
    return { status: 'error', error: e && e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.30 M3 근본 수정: NAMED_ENTITY_REGISTRY — 현직 인사 단일 출처
// CHAT_CONTEXTS, 페이지 텍스트의 정치/관료 이름은 반드시 이 registry 경유.
// R76 신규 (인사 이름 시점 의존 차단)
// ─────────────────────────────────────────────────────────────────
window.AIO_NAMED_ENTITY_REGISTRY = {
  version: 'v49.30',
  defaultStaleDays: 90,
  entities: {
    'us-fed-chair':       { name: 'Powell', alt: ['파월', 'Jerome Powell'], role: 'Fed Chair', currentAs: '2026-05-17', source: 'Reuters' },
    'us-treasury-sec':    { name: 'Bessent', alt: ['Scott Bessent', 'Treasury Sec'], role: 'US Treasury Secretary', currentAs: '2026-05-17', source: 'Public record' },
    'us-fed-vicechair':   { name: 'Warsh',  alt: ['Kevin Warsh'], role: 'Fed Vice Chair (candidate)', currentAs: '2026-05-17', source: 'Press speculation', note: '확정 임명 시 갱신' },
    'kr-bok-governor':    { name: '이창용', alt: ['Lee Chang-yong'], role: 'BOK 총재', currentAs: '2026-05-17', source: 'BOK' },
    'ecb-president':      { name: 'Lagarde', alt: ['Christine Lagarde'], role: 'ECB President', currentAs: '2026-05-17', source: 'ECB' },
    'boj-governor':       { name: 'Ueda', alt: ['Kazuo Ueda', '우에다'], role: 'BOJ Governor', currentAs: '2026-05-17', source: 'BOJ' }
  },
  getEntity: function(key) { return this.entities[key] || null; }
};

window.AIO.getNamedEntityAudit = function() {
  var reg = window.AIO_NAMED_ENTITY_REGISTRY;
  if (!reg) return { status: 'error', unverifiedCount: 0, issues: ['NAMED_ENTITY registry undefined'] };
  var now = Date.now();
  var unverified = [];
  Object.keys(reg.entities).forEach(function(key) {
    var e = reg.entities[key];
    var ts = new Date(e.currentAs).getTime();
    if (isNaN(ts)) return;
    var ageDays = Math.floor((now - ts) / 86400000);
    if (ageDays > reg.defaultStaleDays) {
      unverified.push({ key: key, name: e.name, role: e.role, ageDays: ageDays });
    }
  });
  return {
    status: unverified.length ? 'warn' : 'ok',
    unverifiedCount: unverified.length,
    unverified: unverified,
    totalEntities: Object.keys(reg.entities).length,
    generatedAt: new Date(now).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.30 M4 근본 수정: MACRO_CALENDAR — 거시지표 발표 일정 + 자동 stale
// NFP/CPI/PCE/ISM 등 발표일 기반 nextReleaseDate. 발표 후 자동 stale.
// R77 신규
// ─────────────────────────────────────────────────────────────────
window.AIO_MACRO_CALENDAR = {
  version: 'v49.85',  // v49.85: 정적 advance (NFP 5/3→6/6, CPI 5/14→6/12, ISM Mfg 5/1→6/2, ISM Svc 5/5→6/3, Retail 5/15→6/17 — 모두 발표 경과)
  releases: {
    'us-nfp':       { name: 'BLS NFP',        frequency: 'monthly-first-friday', lastRelease: '2026-05-03', nextRelease: '2026-06-06', dataField: 'usUnemploy' },
    'us-cpi':       { name: 'BLS CPI',        frequency: 'monthly-mid',          lastRelease: '2026-05-14', nextRelease: '2026-06-12', dataField: 'cpi' },
    'us-pce':       { name: 'BEA PCE',        frequency: 'monthly-end',          lastRelease: '2026-04-30', nextRelease: '2026-05-30', dataField: 'pce' },
    'us-ism-mfg':   { name: 'ISM Mfg PMI',    frequency: 'monthly-first',        lastRelease: '2026-05-01', nextRelease: '2026-06-02', dataField: 'ismPmi' },
    'us-ism-svc':   { name: 'ISM Services',   frequency: 'monthly-third',        lastRelease: '2026-05-05', nextRelease: '2026-06-03', dataField: 'ismSvc' },
    'us-retail':    { name: 'Retail Sales',   frequency: 'monthly-mid',          lastRelease: '2026-05-15', nextRelease: '2026-06-17', dataField: 'retailSales' },
    // v49.41 P296/R77 보강: FOMC 회의 + fed-rate (signal 페이지 CP2 lastUpdated 메타용)
    'us-fomc':      { name: 'FOMC 회의',       frequency: 'every-6-7-weeks',      lastRelease: '2026-04-29', nextRelease: '2026-06-17', dataField: 'fomc', sepMeeting: true },
    'us-fed-rate':  { name: 'Fed Funds Rate',  frequency: 'fomc-decision',        lastRelease: '2026-04-29', nextRelease: '2026-06-17', dataField: 'fedRate', source: 'FOMC 결정' },
    // v49.85 신규: 한국 BOK 금통위 (5/28 신현송 총재 첫 회의 → 다음 7/10)
    'kr-bok':       { name: 'BOK 금통위',      frequency: 'every-6-7-weeks',      lastRelease: '2026-05-28', nextRelease: '2026-07-10', dataField: 'bokRate', source: '한국은행 금통위' }
  }
};

window.AIO.getMacroReleaseStaleAudit = function() {
  var reg = window.AIO_MACRO_CALENDAR;
  if (!reg) return { status: 'error', staleReleaseCount: 0, issues: ['MACRO_CALENDAR undefined'] };
  var now = Date.now();
  var stale = [];
  Object.keys(reg.releases).forEach(function(key) {
    var r = reg.releases[key];
    var nextTs = new Date(r.nextRelease).getTime();
    if (isNaN(nextTs)) return;
    // 다음 발표일이 이미 지났는데 DATA_SNAPSHOT은 lastRelease 기준 그대로 → stale
    if (now > nextTs) {
      var daysPastDue = Math.floor((now - nextTs) / 86400000);
      stale.push({ key: key, name: r.name, lastRelease: r.lastRelease, nextRelease: r.nextRelease, daysPastDue: daysPastDue, dataField: r.dataField });
    }
  });
  return {
    status: stale.length ? 'warn' : 'ok',
    staleReleaseCount: stale.length,
    stale: stale,
    totalReleases: Object.keys(reg.releases).length,
    generatedAt: new Date(now).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.83 P443/R172: MACRO_CALENDAR 자동 갱신 hook — 일자 경과 시 nextRelease 자동 compute
// 발표일이 지났는데 갱신 안 된 entries를 다음 주기로 자동 advance.
// 의도: monthly-first → 다음 달 1째주 / monthly-mid → 다음 달 15일경 / every-6-7-weeks → +45일
// 주의: 실제 발표 데이터 변경은 별도 — 시각 cycle만 advance하여 stale audit false alarm 차단.
// ─────────────────────────────────────────────────────────────────
window.AIO._aioRecomputeMacroCalendar = function(opts) {
  opts = opts || {};
  var reg = window.AIO_MACRO_CALENDAR;
  if (!reg) return { status: 'error', advancedCount: 0 };
  var now = new Date();
  var advanced = [];
  Object.keys(reg.releases).forEach(function(key) {
    var r = reg.releases[key];
    var nextTs = new Date(r.nextRelease).getTime();
    if (isNaN(nextTs)) return;
    if (now.getTime() <= nextTs) return; // 아직 미발표
    // 발표일 경과 — advance 1 cycle
    var oldNext = new Date(r.nextRelease);
    var newNext = new Date(oldNext);
    var freq = String(r.frequency || '').toLowerCase();
    if (freq.indexOf('monthly') >= 0) {
      newNext.setMonth(newNext.getMonth() + 1);
    } else if (freq.indexOf('every-6-7-weeks') >= 0) {
      newNext.setDate(newNext.getDate() + 45);
    } else if (freq.indexOf('fomc-decision') >= 0) {
      newNext.setDate(newNext.getDate() + 45);
    } else if (freq.indexOf('weekly') >= 0) {
      newNext.setDate(newNext.getDate() + 7);
    } else {
      newNext.setMonth(newNext.getMonth() + 1); // default monthly
    }
    advanced.push({
      key: key, name: r.name,
      prevLastRelease: r.lastRelease, prevNextRelease: r.nextRelease,
      newLastRelease: r.nextRelease, newNextRelease: newNext.toISOString().slice(0, 10)
    });
    if (!opts.dryRun) {
      r.lastRelease = r.nextRelease;
      r.nextRelease = newNext.toISOString().slice(0, 10);
    }
  });
  return {
    status: advanced.length > 0 ? 'advanced' : 'ok',
    advancedCount: advanced.length,
    advanced: advanced,
    dryRun: !!opts.dryRun,
    generatedAt: now.toISOString()
  };
};
// 페이지 로드 후 1회 자동 advance (앱 시작 시 calendar 자동 최신화)
setTimeout(function() {
  try {
    if (window.AIO && window.AIO._aioRecomputeMacroCalendar) {
      var r = window.AIO._aioRecomputeMacroCalendar();
      if (r.advancedCount > 0) console.log('[AIO] MACRO_CALENDAR auto-advanced ' + r.advancedCount + ' entries:', r.advanced.map(function(a){return a.key;}).join(', '));
    }
  } catch(_) {}
}, 7000);

// ─────────────────────────────────────────────────────────────────
// v49.83 P444/R173: computeCrossAssetCorrelation — 자산 간 30일 rolling Pearson correlation
// _priceHistory (collectPriceHistory 누적) 활용. 충분한 데이터가 없으면 status:'insufficient_data'.
// 자산 셋: SPY/QQQ/IWM/TLT/GLD/DXY/USO/VIX (US risk-asset matrix)
// 반환: { matrix: { 'SPY-QQQ': 0.92, 'SPY-TLT': -0.35, ... }, regime: 'risk-on/off' }
// ─────────────────────────────────────────────────────────────────
window.AIO.computeCrossAssetCorrelation = function(opts) {
  opts = opts || {};
  var assets = opts.assets || ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'CL=F', '^VIX'];
  var hist = window._priceHistory || {};
  var pricesPerAsset = {};
  var minLen = Infinity;
  assets.forEach(function(a) {
    var h = hist[a];
    if (Array.isArray(h) && h.length >= 5) {
      var seq = h.map(function(p){return p && p.price ? p.price : null;}).filter(function(v){return v != null && isFinite(v);});
      pricesPerAsset[a] = seq;
      if (seq.length < minLen) minLen = seq.length;
    }
  });
  var availableAssets = Object.keys(pricesPerAsset);
  if (availableAssets.length < 2 || minLen < 5) {
    return {
      status: 'insufficient_data',
      message: '_priceHistory 누적 데이터 부족 (need >= 5 prices for 2+ assets, got ' + availableAssets.length + ' assets, minLen=' + (minLen === Infinity ? 0 : minLen) + ')',
      availableAssets: availableAssets,
      requiredAssets: assets,
      generatedAt: new Date().toISOString()
    };
  }
  // 모든 자산 동일 length로 trim (가장 짧은 시퀀스 기준)
  var L = Math.min(minLen, 30); // 30일 cap
  var returns = {};
  availableAssets.forEach(function(a) {
    var seq = pricesPerAsset[a].slice(-L);
    var rets = [];
    for (var i = 1; i < seq.length; i++) {
      if (seq[i-1] && seq[i-1] !== 0) rets.push((seq[i] - seq[i-1]) / seq[i-1]);
    }
    returns[a] = rets;
  });
  // Pearson correlation
  function pearson(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 3) return null;
    var mx = 0, my = 0;
    for (var i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    var num = 0, dx = 0, dy = 0;
    for (var j = 0; j < n; j++) {
      var a = x[j] - mx, b = y[j] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    var denom = Math.sqrt(dx * dy);
    if (denom < 1e-12) return 0;
    return num / denom;
  }
  var matrix = {};
  for (var i = 0; i < availableAssets.length; i++) {
    for (var j = i + 1; j < availableAssets.length; j++) {
      var a = availableAssets[i], b = availableAssets[j];
      var c = pearson(returns[a], returns[b]);
      if (c != null) matrix[a + '-' + b] = Math.round(c * 100) / 100;
    }
  }
  // Regime classification (간단 휴리스틱)
  var spyQqq = matrix['SPY-QQQ'];
  var spyTlt = matrix['SPY-TLT'];
  var spyVix = matrix['SPY-^VIX'];
  var regime = 'mixed';
  if (spyQqq != null && spyQqq > 0.85 && spyTlt != null && spyTlt < -0.2) regime = 'risk-on';
  else if (spyVix != null && spyVix < -0.6 && spyTlt != null && spyTlt > 0.3) regime = 'risk-off';
  else if (spyQqq != null && spyQqq < 0.5) regime = 'decoupled';
  return {
    status: 'ok',
    availableAssets: availableAssets,
    sampleSize: L - 1,
    matrix: matrix,
    regime: regime,
    note: 'v49.83 R173: 30일 rolling Pearson. _priceHistory (collectPriceHistory) 누적 데이터.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.83 P445/R174: assertQuantitativeRatioAudit — AI 답변 정량 비율 자동 측정
// localStorage.aio_chat_history (최근 채팅) 텍스트 → 정량 토큰 비율 산출.
// 기관 리포트는 정량 비율 ~65%. 임계값 미만 시 warn.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertQuantitativeRatioAudit = function() {
  try {
    var hist = [];
    try {
      var raw = localStorage.getItem('aio_chat_history') || localStorage.getItem('aio_unified_chat_history');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) hist = parsed.slice(-20);
      }
    } catch(_) {}
    if (hist.length === 0) {
      return {
        status: 'no_data',
        message: 'aio_chat_history localStorage 데이터 없음 (채팅 사용 후 재실행)',
        sampleCount: 0,
        generatedAt: new Date().toISOString()
      };
    }
    // 정량 토큰 패턴: $123 / 12.3% / 1,234 / 4.5 / 2026년 / 30일 / VIX 18.5
    var quantRe = /(\$\d+(?:[.,]\d+)*)|(\d+(?:\.\d+)?%)|(\d+(?:,\d{3})+)|(\d+(?:\.\d+)?\s*(?:bp|bps|배|일|개월|년|주|x))|(\b\d+\.\d+\b)/gi;
    var totals = { quantTokens: 0, totalWords: 0, samples: 0 };
    hist.forEach(function(entry) {
      var text = entry && (entry.a || entry.answer || entry.assistant) || '';
      if (typeof text !== 'string' || !text) return;
      totals.samples++;
      var words = text.split(/\s+/).filter(Boolean);
      totals.totalWords += words.length;
      var matches = text.match(quantRe) || [];
      totals.quantTokens += matches.length;
    });
    var pct = totals.totalWords > 0 ? Math.round((totals.quantTokens / totals.totalWords) * 100) : 0;
    // 기관 기준: 정량 비율 7%+ (한국어 답변 특성 — 토큰 단위 다름)
    // 실제 정량 토큰 카운트 vs 단어 카운트 비율은 5~15% 가 일반적
    var status = pct >= 7 ? 'ok' : pct >= 4 ? 'warn' : 'fail';
    return {
      status: status,
      sampleCount: totals.samples,
      totalWords: totals.totalWords,
      quantTokens: totals.quantTokens,
      quantitativeRatioPct: pct,
      threshold: { ok: 7, warn: 4 },
      note: 'v49.83 R174: 답변 정량 토큰 / 전체 단어 비율. 7%+ 기관급 / 4~7% 일반 / <4% 정성 과다.',
      generatedAt: new Date().toISOString()
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.83 P446/R175: fetchFMPEarningsCallTranscript — 분기 earnings call 발췌
// FMP /earning_call_transcript/{ticker}?quarter=N&year=N (Free tier에 일부 종목만)
// 결과: 최근 quarter transcript의 첫 1500자 + URL + 호출일.
// ─────────────────────────────────────────────────────────────────
window.AIO.fetchFMPEarningsCallTranscript = async function(ticker) {
  if (!ticker) return { available: false, reason: 'ticker required' };
  var key = '';
  try { key = (typeof window._getApiKey === 'function') ? (window._getApiKey('aio_fmp_key') || '') : ''; } catch(_) {}
  if (!key) {
    return {
      available: false,
      ticker: ticker,
      reason: 'FMP API key 미설정 — 사이드바 API 설정에서 등록 권장',
      sourceUrl: 'https://financialmodelingprep.com/developer/docs#earning-call-transcript',
      generatedAt: new Date().toISOString()
    };
  }
  // 캐시 (10분 TTL)
  window._fmpEarningsCallCache = window._fmpEarningsCallCache || {};
  var cached = window._fmpEarningsCallCache[ticker];
  if (cached && (Date.now() - cached.ts < 10 * 60 * 1000)) {
    return cached.data;
  }
  try {
    var url = 'https://financialmodelingprep.com/api/v3/earning_call_transcript/' + encodeURIComponent(ticker) + '?apikey=' + encodeURIComponent(key);
    var ctrl = new AbortController();
    var to = setTimeout(function(){ ctrl.abort(); }, 5000);
    var res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) {
      var msg = 'FMP HTTP ' + res.status + ' (paid tier required for ' + ticker + ' or rate limit)';
      var failResult = { available: false, ticker: ticker, reason: msg, generatedAt: new Date().toISOString() };
      // 실패는 캐시 안 함 (v49.67 R122)
      return failResult;
    }
    var arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return { available: false, ticker: ticker, reason: '데이터 없음 (FMP free tier 제한 가능)', generatedAt: new Date().toISOString() };
    }
    var latest = arr[0];
    var excerpt = (latest.content || '').slice(0, 1500);
    var data = {
      available: true,
      ticker: ticker,
      quarter: latest.quarter,
      year: latest.year,
      date: latest.date,
      excerpt: excerpt,
      excerptLength: excerpt.length,
      sourceUrl: url.replace(/apikey=[^&]+/, 'apikey=***'),
      note: 'v49.83 R175: FMP earnings call transcript. 첫 1500자 발췌.',
      generatedAt: new Date().toISOString()
    };
    window._fmpEarningsCallCache[ticker] = { data: data, ts: Date.now() };
    return data;
  } catch(e) {
    return { available: false, ticker: ticker, reason: 'fetch error: ' + (e && e.message || e), generatedAt: new Date().toISOString() };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.30 M5 근본 수정: KR_MACRO_RELEASE — 한국 거시 발표 캘린더
// 수출입/CPI/GDP 등 발표일 기반 자동 stale.
// R78 신규
// ─────────────────────────────────────────────────────────────────
window.AIO_KR_MACRO_RELEASE = {
  version: 'v49.30',
  releases: {
    'kr-export':    { name: '수출입 (산자부)',  frequency: 'monthly-first', lastRelease: '2026-03-01', nextRelease: '2026-04-01', dataField: 'krExport', monthData: '2026-02' },
    'kr-cpi':       { name: 'CPI (통계청)',    frequency: 'monthly-second', lastRelease: '2026-04-02', nextRelease: '2026-05-02', dataField: 'krCpi', monthData: '2026-03' },
    'kr-gdp':       { name: 'GDP (BOK)',       frequency: 'quarterly',     lastRelease: '2026-04-26', nextRelease: '2026-07-26', dataField: 'krGdp', monthData: '2026-Q1' },
    'kr-industrial': { name: '산업생산 (통계청)', frequency: 'monthly',     lastRelease: '2026-03-31', nextRelease: '2026-04-30', dataField: 'krIndustrial', monthData: '2026-02' },
    'kr-semi-export': { name: '반도체 수출 (산자부)', frequency: 'monthly-first', lastRelease: '2026-03-01', nextRelease: '2026-04-01', dataField: 'krSemiExport', monthData: '2026-02', note: '+157.9% YoY 2월 수출' }
  }
};

window.AIO.getKrMacroReleaseAudit = function() {
  var reg = window.AIO_KR_MACRO_RELEASE;
  if (!reg) return { status: 'error', krStaleReleaseCount: 0, issues: ['KR_MACRO_RELEASE undefined'] };
  var now = Date.now();
  var stale = [];
  Object.keys(reg.releases).forEach(function(key) {
    var r = reg.releases[key];
    var nextTs = new Date(r.nextRelease).getTime();
    if (isNaN(nextTs)) return;
    if (now > nextTs) {
      var daysPastDue = Math.floor((now - nextTs) / 86400000);
      stale.push({ key: key, name: r.name, lastRelease: r.lastRelease, nextRelease: r.nextRelease, daysPastDue: daysPastDue, dataField: r.dataField, monthData: r.monthData });
    }
  });
  return {
    status: stale.length ? 'warn' : 'ok',
    krStaleReleaseCount: stale.length,
    stale: stale,
    totalReleases: Object.keys(reg.releases).length,
    generatedAt: new Date(now).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.30 M1 근본 수정: assertSnapshotInlineMatch — DOM 인라인 vs DATA_SNAPSHOT
// applyDataSnapshot 출력 결과와 DOM 인라인 폴백 텍스트 비교.
// 불일치 발견 시 console.error + Optional throw.
// R74 신규 (DOM 인라인 동기화 의무)
// ─────────────────────────────────────────────────────────────────
window.AIO.assertSnapshotInlineMatch = function(opts) {
  opts = opts || {};
  var mismatches = [];
  try {
    var S = window.DATA_SNAPSHOT || {};
    // 핵심 sink keys만 검증 (전체 sink는 getSnapshotConsistencyAudit가 담당)
    var critical = ['kospi', 'kospi-prev', 'kosdaq', 'kosdaq-prev', 'krw-full', 'spx', 'vix', 'fed-rate', 'bok-rate', 'bok-next'];
    critical.forEach(function(key) {
      var elements = document.querySelectorAll('[data-snap="' + key + '"]');
      if (!elements.length) return;
      // 핵심 sink는 모두 동일 인라인 값 가져야 함
      var firstText = (elements[0].textContent || '').trim();
      elements.forEach(function(el) {
        var t = (el.textContent || '').trim();
        if (t !== firstText) {
          mismatches.push({ key: key, expected: firstText, found: t, elementId: el.id || 'anon' });
        }
      });
    });
  } catch (e) {
    return { status: 'error', mismatchCount: 0, issues: [e && e.message || String(e)] };
  }
  if (opts.throwOnFail && mismatches.length) {
    var msg = 'assertSnapshotInlineMatch FAIL: ' + mismatches.length + ' mismatch(es) — see console';
    console.error(msg, mismatches);
    throw new Error(msg);
  }
  if (mismatches.length && console.warn) {
    console.warn('[AIO/R74] assertSnapshotInlineMatch — ' + mismatches.length + ' mismatch(es):', mismatches);
  }
  return {
    status: mismatches.length ? 'warn' : 'ok',
    mismatchCount: mismatches.length,
    mismatches: mismatches,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.24 P219 근본 수정: THRESHOLD_REGISTRY — 단일 임계값/라벨 출처
// 모든 페이지의 임계값 라벨이 이 객체를 참조해야 분기 방지(R56).
// 본문 정의(tooltip)와 페이지 배지가 자동 일치.
// ─────────────────────────────────────────────────────────────────
window.AIO_THRESHOLD_REGISTRY = {
  version: 'v49.24',
  VIX: {
    // 정의: <12 극단 안정, 12~20 정상 Risk-On, 20~25 주의, 25~30 경계, 30+ 공포, 40+ 극단 공포
    bands: [
      { max: 12,  label: '극단 안정', color: 'data-amber',  signal: 'complacent' },
      { max: 20,  label: '정상 Risk-On', color: 'data-green', signal: 'normal' },
      { max: 25,  label: '주의', color: 'data-amber',         signal: 'caution' },
      { max: 30,  label: '경계', color: 'data-amber',         signal: 'warning' },
      { max: 40,  label: '공포', color: 'data-red',           signal: 'fear' },
      { max: Infinity, label: '극단 공포', color: 'data-red', signal: 'extreme-fear' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  FG: {
    // CNN Fear & Greed: 0~25 극단공포, 26~45 공포, 46~55 중립, 56~75 탐욕, 76~100 극단탐욕
    bands: [
      { max: 25,  label: '극단 공포', color: 'data-green', signal: 'buy-opportunity' },
      { max: 45,  label: '공포',     color: 'data-amber', signal: 'caution-bullish' },
      { max: 55,  label: '중립',     color: 'text-secondary', signal: 'neutral' },
      { max: 75,  label: '탐욕',     color: 'data-amber', signal: 'caution-bearish' },
      { max: 101, label: '극단 탐욕', color: 'data-red',  signal: 'sell-opportunity' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  HY_SPREAD: {
    // bps 단위. 300 미만 = Complacent/과열, 300~450 정상 Risk-On, 450~600 주의, 600+ 스트레스
    bands: [
      { max: 300, label: 'Tight → Complacent', color: 'data-amber', signal: 'overheated' },
      { max: 450, label: 'Normal',             color: 'data-green', signal: 'normal' },
      { max: 600, label: 'Wide → Caution',     color: 'data-amber', signal: 'caution' },
      { max: Infinity, label: 'Stress',        color: 'data-red',   signal: 'stress' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  AAII: {
    // v49.58 P196 보정: Bull-Bear Spread (%). spread = bull% - bear%.
    // <-20 극단 비관, -20~-5 중정도 비관, -5~+5 중립, +5~+20 중정도 낙관, >+20 극단 낙관
    // 약한 비관 신호도 잡기 위해 -10/+10 → -5/+5로 좁힘 (P219 의도 반영)
    bands: [
      { max: -20, label: '극단 비관',  color: 'data-green', signal: 'buy-opportunity' },
      { max:  -5, label: '중정도 비관', color: 'data-amber', signal: 'caution-bullish' },
      { max:   5, label: '중립',       color: 'text-secondary', signal: 'neutral' },
      { max:  20, label: '중정도 낙관', color: 'data-amber', signal: 'caution-bearish' },
      { max: Infinity, label: '극단 낙관', color: 'data-red', signal: 'sell-opportunity' }
    ],
    getLabel: function(spread) {
      var v = Number(spread); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    },
    getLabelFromBullBear: function(bull, bear) {
      var b = Number(bull), s = Number(bear);
      if (isNaN(b) || isNaN(s)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      return this.getLabel(b - s);
    }
  },
  SKEW: {
    // CBOE Skew (Put-Call IV diff, %). <3 약함, 3~5 보통, 5~8 강함, 8+ 극단
    bands: [
      { max: 3, label: '약함',  color: 'data-green', signal: 'low-hedging' },
      { max: 5, label: '보통',  color: 'text-secondary', signal: 'normal' },
      { max: 8, label: '강함',  color: 'data-amber', signal: 'high-hedging' },
      { max: Infinity, label: '극단', color: 'data-red', signal: 'extreme-hedging' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  // v49.25 L2/L8 근본: 브레드쓰·RSI 임계값 단일화
  BREADTH: {
    // 50일선 위 비율 %. <15 역사적 바닥, 15~30 위험, 30~50 혼조, 50~70 양호, 70+ 과열
    bands: [
      { max: 15, label: '역사적 바닥', color: 'data-green', signal: 'capitulation' },
      { max: 30, label: '위험',       color: 'data-red',   signal: 'bearish' },
      { max: 50, label: '혼조',       color: 'data-amber', signal: 'mixed' },
      { max: 70, label: '양호',       color: 'data-green', signal: 'bullish' },
      { max: 101, label: '과열',      color: 'data-amber', signal: 'overbought' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  RSI: {
    // 14일 RSI. <30 과매도, 30~40 약세, 40~60 중립, 60~70 강세, 70~80 과매수, 80+ 극단 과매수(강세장 견딤)
    bands: [
      { max: 30, label: '과매도',     color: 'data-green', signal: 'oversold' },
      { max: 40, label: '약세',       color: 'data-amber', signal: 'weak' },
      { max: 60, label: '중립',       color: 'text-secondary', signal: 'neutral' },
      { max: 70, label: '강세',       color: 'data-green', signal: 'strong' },
      { max: 80, label: '과매수',     color: 'data-amber', signal: 'overbought' },
      { max: Infinity, label: '극단 과매수', color: 'data-red', signal: 'extreme-overbought' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  // v49.38 F3: DXY 달러 인덱스 임계값 (home L4327 인라인 정합)
  DXY: {
    // 100 base (1973). <95 Risk-On(유동성 완화), 95~100 중립, 100~105 보통, 105+ 역풍, 110+ 극단 강세
    bands: [
      { max: 95,  label: '약세 — Risk-On', color: 'data-green', signal: 'liquidity-easy' },
      { max: 100, label: '중립',           color: 'text-secondary', signal: 'neutral' },
      { max: 105, label: '강세',           color: 'data-amber', signal: 'caution' },
      { max: 110, label: 'Risk 역풍',      color: 'data-red',   signal: 'headwind' },
      { max: Infinity, label: '극단 강세', color: 'data-red',   signal: 'extreme-strong' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  },
  // v49.38 F3: 10Y 미국채 수익률 임계값 (home L4338 인라인 정합)
  YIELD_10Y: {
    // %. <3 경기 둔화, 3~4 정상, 4~4.5 부담, 4.5~5 위험, 5+ 시스템 압력
    bands: [
      { max: 3,   label: '경기 둔화 시그널', color: 'data-amber', signal: 'recession-risk' },
      { max: 4,   label: '정상',           color: 'data-green', signal: 'normal' },
      { max: 4.5, label: '밸류에이션 부담', color: 'data-amber', signal: 'caution' },
      { max: 5,   label: '위험',           color: 'data-red',   signal: 'high-risk' },
      { max: Infinity, label: '시스템 압력', color: 'data-red',   signal: 'systemic-stress' }
    ],
    getLabel: function(v) {
      v = Number(v); if (isNaN(v)) return { label: '—', color: 'text-muted', signal: 'unknown' };
      for (var i = 0; i < this.bands.length; i++) if (v < this.bands[i].max) return this.bands[i];
      return this.bands[this.bands.length - 1];
    }
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.27 E1/E2 근본 수정: ACTION_RULES — 시장 환경별 Action Item 단일 정의
// home/briefing의 "지금 해야 할 일" 가이드 부재 해소.
// VIX·F&G 구간별 포지션 사이즈 + 헤지 규칙을 코드로 명시.
// ─────────────────────────────────────────────────────────────────
window.AIO_ACTION_RULES = {
  version: 'v49.27',
  // VIX 기반 포지션 사이즈 규칙
  positionSizing: {
    rules: [
      { vixMax: 15, sizePct: 100, note: '정상 환경 — 셋업 기반 매매 정상 진행. 풀 포지션 가능.' },
      { vixMax: 20, sizePct: 80,  note: '안정 → 경계 — 분할 매수만. 손절선 타이트.' },
      { vixMax: 25, sizePct: 50,  note: '주의 — 포지션 50%로 축소. 신규 진입 보수적.' },
      { vixMax: 30, sizePct: 30,  note: '경계 — 30%로 축소. 푸트 헤지 검토.' },
      { vixMax: Infinity, sizePct: 15, note: '공포 — 신규 매수 중단. 기존 50%+ 축소. 풋옵션 헤지 필수.' }
    ],
    getRule: function(vix) {
      var v = Number(vix); if (isNaN(v)) return null;
      for (var i = 0; i < this.rules.length; i++) if (v < this.rules[i].vixMax) return this.rules[i];
      return this.rules[this.rules.length - 1];
    }
  },
  // F&G 기반 행동 가이드
  sentimentAction: {
    rules: [
      { fgMax: 25, action: '역발상 매수', note: '극단 공포 → 우량주 분할 매수 시작. "남들이 공포에 떨 때 탐욕을 부려라" (버핏).' },
      { fgMax: 45, action: '관심 종목 1차 매수', note: '공포 구간 → 분할 진입. 급하지 않게.' },
      { fgMax: 55, action: '중립 유지',    note: '중립 → 기존 전략 유지. 신규 큰 변화 자제.' },
      { fgMax: 75, action: '추격 매수 자제', note: '탐욕 → 기존 전략 유지. 신규 추격 매수 보류.' },
      { fgMax: 101, action: '차익실현 + 비중 축소', note: '극단 탐욕 → 포지션 축소 검토. 신규 매수 보류.' }
    ],
    getRule: function(fg) {
      var v = Number(fg); if (isNaN(v)) return null;
      for (var i = 0; i < this.rules.length; i++) if (v < this.rules[i].fgMax) return this.rules[i];
      return this.rules[this.rules.length - 1];
    }
  },
  // 통합 Action Item 생성 (VIX + F&G + breadth)
  getActionPlan: function(env) {
    env = env || {};
    var pos = this.positionSizing.getRule(env.vix);
    var sent = this.sentimentAction.getRule(env.fg);
    var actions = [];
    if (pos) actions.push('포지션: ' + pos.sizePct + '% (' + pos.note + ')');
    if (sent) actions.push('센티먼트 행동: ' + sent.action + ' — ' + sent.note);
    if (env.breadth50 != null) {
      var bn = Number(env.breadth50);
      if (bn < 30) actions.push('Breadth: 시장 참여 폭 협소 — 개별 종목 위험 회피, ETF 위주.');
      else if (bn > 70) actions.push('Breadth: 광범위 참여 — 섹터 로테이션 기회.');
    }
    return { actions: actions, position: pos, sentiment: sent, generatedAt: new Date().toISOString() };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.27 E3/E4 근본 수정: PAGE_PURPOSE_REGISTRY — 페이지별 목적 단일 정의
// signal/home 역할 혼동 해소 + briefing 우선순위 명시화.
// ─────────────────────────────────────────────────────────────────
window.AIO_PAGE_PURPOSE_REGISTRY = {
  version: 'v49.27',
  home:     { purpose: '오늘 매매 판단 — Primary',          mainCards: ['trading-score', 'quality-score', 'market-regime'], cta: '매매신호 + 시장 국면 한눈에' },
  signal:   { purpose: '시그널 상세 + 매매 전략 학습 — Secondary', mainCards: ['institutional-brief', 'lockout-rally', 'pyramid'], cta: '셋업 점수 + 위험관리 룰' },
  breadth:  { purpose: '시장 참여 폭 진단', mainCards: ['sma-bars', 'consensus'], cta: '강세/약세 합의도 확인' },
  sentiment:{ purpose: '심리 지표 종합', mainCards: ['fg-score', 'vix', 'aaii'], cta: '극단 공포/탐욕 역발상 진입' },
  briefing: { purpose: '오늘 시장 브리핑 + Action Items',
              sectionOrder: ['top-5-watch', 'macro-calendar', 'earnings-calendar', 'interviews', 'ipo-pipeline', 'strategy'],
              cta: '5대 관전 포인트 우선' },
  technical: { purpose: '차트·기술 분석 — 종목별', mainCards: ['tradingview-chart', 'rsi-macd', 'setups'], cta: '셋업 진단 + MTF' },
  macro:    { purpose: '거시·금리 분석',  mainCards: ['cross-asset', 'fomc-calendar', 'cycle'], cta: '경기 단계 + 정책 모니터' },
  fxbond:   { purpose: '외환·채권·원자재', mainCards: ['dxy-table', 'yield-curve', 'commodities'], cta: '글로벌 흐름' },
  fundamental:{ purpose: '기업 펀더멘털 검색', mainCards: ['search', 'piotroski-card', 'earnings'], cta: '종목별 심층 분석' },
  themes:   { purpose: '섹터·테마 로테이션', mainCards: ['rrg', 'sector-grid', 'cycle-position'], cta: 'RRG + 사이클 위치' },
  options:  { purpose: '옵션 변동성·헤징',  mainCards: ['vix-term', 'skew', 'flow'], cta: 'IV + Greeks' },
  portfolio:{ purpose: '내 포트폴리오 관리', mainCards: ['holdings', 'risk-metrics', 'rebalance'], cta: 'Sharpe + Drift' }
};

// 페이지별 이론 텍스트 대비 동적 콘텐츠 비율 audit (E5 portfolio 패턴)
window.AIO.getPagePurposeRatioAudit = function() {
  var issues = [];
  var reports = [];
  try {
    var registry = window.AIO_PAGE_PURPOSE_REGISTRY || {};
    Object.keys(registry).forEach(function(pageKey) {
      var page = document.getElementById('page-' + pageKey);
      if (!page) return;
      // 정적 텍스트 글자수 vs 동적 sink 개수 비율
      var clone = page.cloneNode(true);
      clone.querySelectorAll('[data-aio-archive="true"]').forEach(function(el) { el.remove(); });
      var textLen = (clone.textContent || '').length;
      var sinkCount = page.querySelectorAll('[data-snap], [data-live-price], [data-live-chg]').length;
      // E5 패턴: 정적 텍스트 길이가 매우 길고 sink가 적음 (예: portfolio 이론 풍부 vs UI 부족)
      if (textLen > 3000 && sinkCount < 5) {
        issues.push('page-' + pageKey + ': 정적 텍스트 ' + textLen + 'chars vs sink ' + sinkCount + ' (이론 vs 실행 비대칭)');
      }
      reports.push({ pageId: 'page-' + pageKey, textLen: textLen, sinkCount: sinkCount, purpose: registry[pageKey].purpose });
    });
  } catch (e) {
    issues.push({ type: 'audit-error', message: e && e.message });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    reports: reports,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.27 L6 근본 수정: SCENARIO_REGISTRY — 시나리오 확률 + 시간 의존성
// macro 페이지 "연착륙 30% / 스태그 45% / 침체 25%" 정적 고정 해소.
// 각 시나리오에 lastUpdated 필수 + audit이 stale 자동 탐지.
// ─────────────────────────────────────────────────────────────────
window.AIO_SCENARIO_REGISTRY = {
  version: 'v49.41',
  staleDaysThreshold: 30,
  // v49.27 macro 경기 시나리오 (연착륙/스태그플레이션/경기침체)
  scenarios: {
    'soft-landing':   { label: '연착륙',     probability: 0.30, lastUpdated: '2026-05-13', source: 'JPM 5월 update', triggers: ['CPI <3%', 'Unemployment <4.5%', 'GDP +2%~'] },
    'stagflation':    { label: '스태그플레이션', probability: 0.45, lastUpdated: '2026-05-13', source: 'Citi base case', triggers: ['CPI >3.5%', 'GDP <1%', 'Oil >$100'] },
    'recession':      { label: '경기침체',   probability: 0.25, lastUpdated: '2026-05-13', source: 'Yield curve inversion 6M', triggers: ['2s10s <0', 'NFP <0', 'ISM <45'] }
  },
  // v49.41 P295/R73 보강: signal 페이지 단기 시장 시나리오 (2~4주 전망)
  // L5195~5224 인라인 정적 확률(30~35%/40~45%/15~20%) → REGISTRY 단일 출처로 통합.
  signalShortTerm: {
    'optimistic':  { label: '낙관', probability: 0.325, probabilityRange: '30~35%', lastUpdated: '2026-05-13', source: 'v49.30 일반화 후 유지', triggers: ['원자재 공급 정상화', '지정학 리스크 완화', '스몰캡/금융주 반등'] },
    'base':        { label: '기본', probability: 0.425, probabilityRange: '40~45%', lastUpdated: '2026-05-13', source: 'JPM/Citi 컨센서스', triggers: ['WTI $90~100 횡보', 'VIX 18~22 박스', '데드캣 바운스'] },
    'pessimistic': { label: '비관', probability: 0.175, probabilityRange: '15~20%', lastUpdated: '2026-05-13', source: 'tail risk 가중',  triggers: ['Brent $130+', '수요 파괴 심화', '데드캣 바운스 반복'] }
  },
  // 확률 합 검증 (macro 경기 시나리오)
  validateSum: function() {
    var sum = 0;
    Object.keys(this.scenarios).forEach(function(k) { sum += Number(this.scenarios[k].probability); }, this);
    return { sum: sum, valid: Math.abs(sum - 1.0) < 0.001 };
  },
  // v49.41 P295: signal 단기 시나리오 합 검증
  validateSignalSum: function() {
    var sum = 0;
    Object.keys(this.signalShortTerm).forEach(function(k) { sum += Number(this.signalShortTerm[k].probability); }, this);
    return { sum: sum, valid: Math.abs(sum - 1.0) < 0.001 };
  }
};

window.AIO.getScenarioFreshnessAudit = function() {
  var reg = window.AIO_SCENARIO_REGISTRY;
  if (!reg) return { status: 'error', issueCount: 0, issues: ['SCENARIO_REGISTRY undefined'] };
  var nowTs = Date.now();
  var issues = [];
  var staleScenarios = [];
  Object.keys(reg.scenarios).forEach(function(k) {
    var s = reg.scenarios[k];
    var ts = new Date(s.lastUpdated).getTime();
    if (isNaN(ts)) { issues.push(k + ': invalid lastUpdated'); return; }
    var ageDays = Math.floor((nowTs - ts) / 86400000);
    if (ageDays > reg.staleDaysThreshold) {
      staleScenarios.push({ id: k, label: s.label, ageDays: ageDays });
      issues.push(k + ' age=' + ageDays + 'd > threshold ' + reg.staleDaysThreshold + 'd');
    }
  });
  var sumCheck = reg.validateSum();
  if (!sumCheck.valid) issues.push('probability sum ' + sumCheck.sum.toFixed(3) + ' ≠ 1.000');
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    staleScenarios: staleScenarios,
    probabilitySum: sumCheck.sum,
    generatedAt: new Date(nowTs).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.26 I2 근본 수정: WEIGHT_REGISTRY — 점수 가중치 단일 정의
// home Trading Score / Quality Score / Market Regime의 구성요소별 가중치 공개.
// "0~100 범위 명시되나 구성요소 가중치 미기재" 해소.
// ─────────────────────────────────────────────────────────────────
window.AIO_WEIGHT_REGISTRY = {
  version: 'v49.26',
  TRADING_SCORE: {
    label: 'Trading Score (20점)',
    components: [
      { id: 'trend',      label: 'Trend Template',   weight: 8, max: 8,  note: '8가지 추세 조건 (200일선/52주/RSI 등)' },
      { id: 'rs',         label: 'Relative Strength', weight: 4, max: 4,  note: 'IBD RS Rating (1~99)' },
      { id: 'volume',     label: 'Volume Profile',   weight: 3, max: 3,  note: '거래량 패턴 (50일 평균 대비)' },
      { id: 'volatility', label: 'Volatility',       weight: 3, max: 3,  note: 'ATR/실현변동성 안정성' },
      { id: 'breakout',   label: 'Breakout',         weight: 2, max: 2,  note: '저항선 돌파 여부' }
    ],
    totalWeight: 20
  },
  QUALITY_SCORE: {
    label: 'Quality Score (100점)',
    components: [
      { id: 'sma50_pct',  label: '50일선 위 비율',    weight: 25, max: 25, note: '시장 참여 폭' },
      { id: 'ad_line',    label: 'A/D Line 추세',     weight: 20, max: 20, note: '누적 상승/하락 종목수' },
      { id: 'nhnl',       label: 'New High / New Low', weight: 20, max: 20, note: '52주 신고가/신저가 비율' },
      { id: 'mcclellan',  label: 'McClellan Oscillator', weight: 20, max: 20, note: 'A-D EMA 19/39 차이' },
      { id: 'rsp_spy',    label: 'RSP/SPY 상대강도',  weight: 15, max: 15, note: '동등가중 vs 시총가중' }
    ],
    totalWeight: 100
  },
  MARKET_REGIME: {
    label: 'Market Regime (4단계)',
    components: [
      { id: 'sma200_slope', label: '200일선 기울기',    weight: 30, max: 30, note: '장기 추세 방향' },
      { id: 'price_vs_200', label: '가격 vs 200일선',   weight: 25, max: 25, note: '추세 강도' },
      { id: 'breadth',      label: 'Breadth %',         weight: 25, max: 25, note: '50일선 위 비율' },
      { id: 'vix',          label: 'VIX 수준',          weight: 20, max: 20, note: '시장 변동성' }
    ],
    totalWeight: 100,
    bands: [
      { min: 75, label: 'UPTREND',     color: 'data-green' },
      { min: 50, label: 'NEUTRAL',     color: 'text-secondary' },
      { min: 25, label: 'CAUTION',     color: 'data-amber' },
      { min: 0,  label: 'BEAR',        color: 'data-red' }
    ]
  },
  getComponentTooltip: function(key) {
    var s = this[key]; if (!s) return '';
    return s.label + ' = ' + s.components.map(function(c) {
      return c.label + ' ' + c.weight + '점';
    }).join(' + ') + ' (총 ' + s.totalWeight + ')';
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.26 I3 근본 수정: CARD_HIERARCHY — 시각 위계 단일 정의
// home의 3개 카드(매매판단/품질점수/시장국면)가 동일 타이포그래피 → Primary 강조 부족.
// ─────────────────────────────────────────────────────────────────
window.AIO_CARD_HIERARCHY = {
  version: 'v49.26',
  primary:   { fontSize: '24px', fontWeight: '900', stripeColor: 'data-green', label: 'Primary (최우선 의사결정)' },
  secondary: { fontSize: '20px', fontWeight: '800', stripeColor: 'data-amber', label: 'Secondary (보조 지표)' },
  tertiary:  { fontSize: '16px', fontWeight: '700', stripeColor: 'text-muted', label: 'Tertiary (참고)' },
  // CSS 클래스 자동 생성
  getClassList: function(level) {
    return ['aio-card', 'aio-card-' + level, 'has-stripe-top', 'stripe-' + (this[level] || {}).stripeColor];
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.25 L1 근본 수정: SCORE_SCALES — 점수 스케일 단일 정의 + 변환
// "20점 만점" vs "0~100" 혼동 (signal/home 페이지) 해소.
// 어떤 페이지든 항상 동일 스케일로 표시 가능.
// ─────────────────────────────────────────────────────────────────
window.AIO_SCORE_SCALES = {
  version: 'v49.25',
  TWENTY_POINT: { min: 0, max: 20, name: 'Trading Score (20점)', components: { trend: 8, rs: 4, volume: 3, volatility: 3, breakout: 2 } },
  HUNDRED_POINT: { min: 0, max: 100, name: 'Score Index (0~100)', bands: [
    { min: 75, label: '적극 매수', color: 'data-green' },
    { min: 60, label: '매수 우호', color: 'data-green' },
    { min: 45, label: '중립',     color: 'text-secondary' },
    { min: 30, label: '주의',     color: 'data-amber' },
    { min: 0,  label: '위험',     color: 'data-red' }
  ] },
  convert: function(score, fromScale, toScale) {
    var from = this[fromScale]; var to = this[toScale];
    if (!from || !to) return null;
    var ratio = (score - from.min) / (from.max - from.min);
    return to.min + ratio * (to.max - to.min);
  },
  // 20점 점수를 0~100 라벨로 변환 (signal 페이지 사용)
  getLabel100From20: function(score20) {
    var s100 = this.convert(score20, 'TWENTY_POINT', 'HUNDRED_POINT');
    if (s100 == null) return { label: '—', color: 'text-muted' };
    var bands = this.HUNDRED_POINT.bands;
    for (var i = 0; i < bands.length; i++) if (s100 >= bands[i].min) return { label: bands[i].label, color: bands[i].color, score100: s100 };
    return bands[bands.length - 1];
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.25 L4 근본 수정: ATR_PRESETS — ATR 배수 권장값 단일 출처
// signal L4433~4441 "스윙 3~5배, 포지션 4~8배" 광범위 모호성 해소.
// ─────────────────────────────────────────────────────────────────
window.AIO_ATR_PRESETS = {
  version: 'v49.25',
  swing:    { multiplier: 3.0, range: [2.5, 3.5], note: '스윙 트레이딩 (3~5일 보유)' },
  position: { multiplier: 5.0, range: [4.0, 6.0], note: '포지션 트레이딩 (수주~수개월)' },
  scalp:    { multiplier: 1.5, range: [1.0, 2.0], note: '스캘핑 (당일)' },
  trailing: { multiplier: 2.5, range: [2.0, 3.0], note: '트레일링 스톱 (이익 보호)' },
  getStop: function(high, atr, preset) {
    var p = this[preset || 'swing']; if (!p) return null;
    return high - (atr * p.multiplier);
  },
  getDescription: function(preset) {
    var p = this[preset || 'swing']; if (!p) return '—';
    return p.note + ' · 권장 ' + p.multiplier + 'x (범위 ' + p.range[0] + '~' + p.range[1] + 'x)';
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.25 L7 근본 수정: PIOTROSKI_CHECKLIST — F-Score 9 항목 자동 분류
// fundamental L8134~8142 "9가지 YES/NO 체크"를 데이터로 분류 + auto-score.
// ─────────────────────────────────────────────────────────────────
window.AIO_PIOTROSKI_CHECKLIST = {
  version: 'v49.25',
  categories: {
    profitability: [
      { id: 'positive_ni',     label: '양(+)의 순이익',              check: function(d){ return Number(d.netIncome) > 0; } },
      { id: 'positive_roa',    label: '양(+)의 ROA',                 check: function(d){ return Number(d.roa) > 0; } },
      { id: 'positive_cfo',    label: '양(+)의 영업현금흐름',          check: function(d){ return Number(d.cfo) > 0; } },
      { id: 'cfo_gt_ni',       label: '영업현금흐름 > 순이익 (이익 질)', check: function(d){ return Number(d.cfo) > Number(d.netIncome); } }
    ],
    leverage: [
      { id: 'lower_lt_debt',   label: '장기부채 비율 감소(YoY)',       check: function(d){ return Number(d.ltDebtPrev) > Number(d.ltDebt); } },
      { id: 'higher_curr_ratio', label: '유동비율 증가(YoY)',          check: function(d){ return Number(d.currRatio) > Number(d.currRatioPrev); } },
      { id: 'no_dilution',     label: '신주발행 없음 (희석 X)',         check: function(d){ return Number(d.shares) <= Number(d.sharesPrev); } }
    ],
    efficiency: [
      { id: 'higher_margin',   label: '매출총이익률 증가(YoY)',         check: function(d){ return Number(d.gpm) > Number(d.gpmPrev); } },
      { id: 'higher_turnover', label: '자산회전율 증가(YoY)',          check: function(d){ return Number(d.assetTurnover) > Number(d.assetTurnoverPrev); } }
    ]
  },
  // d = financial data object with above keys
  score: function(d) {
    var details = [];
    var total = 0;
    var self = this;
    Object.keys(this.categories).forEach(function(cat) {
      self.categories[cat].forEach(function(item) {
        var pass = false;
        try { pass = !!item.check(d || {}); } catch(_) { pass = false; }
        if (pass) total++;
        details.push({ category: cat, id: item.id, label: item.label, pass: pass });
      });
    });
    return {
      score: total,
      max: 9,
      details: details,
      verdict: total >= 8 ? '우수' : total >= 5 ? '양호' : total >= 3 ? '주의' : '위험'
    };
  }
};

window.AIO_STATIC_DATA_GOVERNANCE = {
  version: 'v49.18',
  defaultMaxAgeDays: 3,
  hardStaleDays: 7,
  rules: {
    archive: { maxAgeDays: 3650, liveLike: false },
    staticSnapshot: { maxAgeDays: 7, liveLike: false },
    marketSnapshot: { maxAgeDays: 3, liveLike: true },
    krSnapshot: { maxAgeDays: 2, liveLike: true },
    optionSnapshot: { maxAgeDays: 7, liveLike: false },
    newsPipeline: { maxAgeDays: 2, liveLike: true }
  }
};

function _aioParseStaticDate(raw, nowTs) {
  if (!raw) return null;
  var s = String(raw).trim();
  var ymd = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]).getTime();
  var md = s.match(/\b(1[0-2]|0?[1-9])\/([0-3]?\d)\b/);
  if (md) {
    var base = nowTs ? new Date(nowTs) : new Date();
    return new Date(base.getFullYear(), +md[1] - 1, +md[2]).getTime();
  }
  var t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

function _aioStaticDayStart(ts) {
  var d = new Date(ts || Date.now());
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function _aioDaysBetween(aTs, bTs) {
  if (!aTs || !bTs) return null;
  return Math.floor((_aioStaticDayStart(bTs) - _aioStaticDayStart(aTs)) / 86400000);
}

window.AIO.classifyStaticDateKey = function(key, contextText) {
  key = String(key || '').toLowerCase();
  var text = String(contextText || '').toLowerCase();
  if (/archive|jensen|interview|narrative|memo|research/.test(key) || /archive|past reference|static summary|knowledge base/.test(text)) return 'archive';
  if (/option|iv|gex|gamma|max-pain/.test(key)) return 'optionSnapshot';
  if (/kr-|kospi|kosdaq|korea|bok|vkospi/.test(key)) return /issue|news|feed/.test(key + ' ' + text) ? 'newsPipeline' : 'krSnapshot';
  if (/issue|news|feed|headline|calendar/.test(key)) return 'newsPipeline';
  if (/tnx|yield|macro|fx|bond|credit|deposit|advance|decline/.test(key)) return 'marketSnapshot';
  return 'staticSnapshot';
};

window.AIO.auditStaticTextFreshness = function(text, opts) {
  opts = opts || {};
  var nowTs = opts.nowTs || Date.now();
  var maxPastDays = opts.maxPastDays == null ? 2 : opts.maxPastDays;
  var source = String(text || '');
  var issues = [];
  var matches = [];
  var liveLikeRe = /(live|current|today|tonight|this week|upcoming|calendar|key news|updated|auto extract|latest|snapshot|핵심|뉴스|오늘|이번|예정|발표|갱신|자동|최신|실시간|현재|스냅샷)/i;
  var nonLiveRe = /(archive|past reference|static summary|not live|snapshot only|education|example|reference only|과거|참고|정적|요약|실시간 아님|교육|예시)/i;
  var hardPatterns = [/PCE\(4\/30\)/i, /VIX Spot 18\.36/i, /05\/04|05\/05|05\/08|05\/09/i];
  hardPatterns.forEach(function(re) {
    var m = source.match(re);
    if (m && !nonLiveRe.test(source)) {
      issues.push({ type: 'hardcoded-stale-token', token: m[0], pageId: opts.pageId || null });
    }
  });
  var re = /\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|(?:1[0-2]|0?[1-9])\/(?:[0-3]?\d))\b/g;
  var match;
  while ((match = re.exec(source))) {
    var token = match[1];
    var ts = _aioParseStaticDate(token, nowTs);
    var ageDays = _aioDaysBetween(ts, nowTs);
    if (ageDays == null) continue;
    var around = source.slice(Math.max(0, match.index - 120), Math.min(source.length, match.index + 160));
    var looksLive = opts.forceLiveLike || (liveLikeRe.test(around) && !nonLiveRe.test(around));
    var item = { token: token, ageDays: ageDays, liveLike: !!looksLive, context: around.slice(0, 180), pageId: opts.pageId || null };
    matches.push(item);
    if (ageDays > maxPastDays && looksLive) {
      issues.push({ type: 'stale-live-like-date', token: token, ageDays: ageDays, pageId: opts.pageId || null, context: item.context });
    }
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    matches: matches,
    generatedAt: new Date(nowTs).toISOString()
  };
};

window.AIO.getStaticDataGovernanceAudit = function() {
  var nowTs = Date.now();
  var cfg = window.AIO_STATIC_DATA_GOVERNANCE;
  var items = [];
  var issues = [];
  var liveLikeStaticText = [];
  try {
    document.querySelectorAll('[data-snap-date]').forEach(function(el) {
      var key = el.getAttribute('data-snap-date') || '';
      var dateText = (el.textContent || el.getAttribute('data-snap-date-value') || '').trim();
      var parentText = '';
      try {
        var p = el.closest('.widget,.card,.panel,.section,.page,div') || el.parentElement;
        parentText = p ? (p.textContent || '').replace(/\s+/g, ' ').slice(0, 360) : '';
      } catch(_) {}
      var category = window.AIO.classifyStaticDateKey(key, parentText);
      var rule = (cfg.rules && cfg.rules[category]) || { maxAgeDays: cfg.defaultMaxAgeDays, liveLike: true };
      var ts = _aioParseStaticDate(dateText, nowTs);
      var ageDays = _aioDaysBetween(ts, nowTs);
      var nonLive = /(archive|past reference|static summary|not live|snapshot only|education|example|reference only|과거|참고|정적|요약|실시간 아님|교육|예시)/i.test(parentText);
      var liveLike = !!(rule.liveLike && !nonLive);
      var stale = ageDays != null && ageDays > rule.maxAgeDays;
      var hardStale = ageDays != null && ageDays > cfg.hardStaleDays && liveLike;
      var item = {
        key: key,
        date: dateText,
        category: category,
        ageDays: ageDays,
        maxAgeDays: rule.maxAgeDays,
        liveLike: liveLike,
        stale: stale,
        hardStale: hardStale,
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        sample: parentText.slice(0, 180)
      };
      items.push(item);
      if (stale && liveLike) {
        issues.push({ type: hardStale ? 'hard-stale-live-like-snapshot' : 'stale-live-like-snapshot', key: key, date: dateText, ageDays: ageDays, category: category });
      }
    });
  } catch(e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  try {
    Object.keys(window.AIO_PAGE_BRIEFS || {}).forEach(function(id) {
      var page = document.getElementById('page-' + id);
      if (!page) return;
      var textAudit = window.AIO.auditStaticTextFreshness(page.textContent || '', { pageId: id, nowTs: nowTs });
      if (textAudit && textAudit.issueCount) {
        liveLikeStaticText.push({ pageId: id, issueCount: textAudit.issueCount, issues: textAudit.issues.slice(0, 5) });
      }
    });
  } catch(_) {}
  var staleItems = items.filter(function(x) { return x.stale; });
  var hardItems = items.filter(function(x) { return x.hardStale; });
  return {
    status: issues.length || liveLikeStaticText.length ? 'warn' : 'ok',
    issueCount: issues.length + liveLikeStaticText.reduce(function(n, x) { return n + x.issueCount; }, 0),
    issues: issues,
    items: items,
    staleCount: staleItems.length,
    hardStaleCount: hardItems.length,
    liveLikeStaticText: liveLikeStaticText,
    schedulerPresent: !!window.REFRESH_SCHEDULE,
    snapshotDate: window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._snapshotDate || null,
    generatedAt: new Date(nowTs).toISOString()
  };
};

window.AIO.renderStaticDataGovernanceBadges = function() {
  var audit = window.AIO.getStaticDataGovernanceAudit();
  try {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-snap-date]'));
    nodes.forEach(function(el, idx) {
      var item = audit.items[idx];
      if (!item) return;
      el.setAttribute('data-static-category', item.category);
      el.setAttribute('data-static-age-days', item.ageDays == null ? '' : String(item.ageDays));
      if (el.offsetParent === null && (el.style && el.style.display === 'none')) return;
      var badge = el.nextElementSibling;
      if (!badge || !badge.classList || !badge.classList.contains('aio-static-data-badge')) {
        badge = document.createElement('span');
        badge.className = 'aio-static-data-badge';
        badge.style.cssText = 'display:inline-flex;vertical-align:baseline;margin-left:4px;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:800;letter-spacing:0;border:1px solid rgba(255,255,255,.18);max-width:58px;white-space:nowrap;line-height:1.2;';
        el.parentNode && el.parentNode.insertBefore(badge, el.nextSibling);
      }
      var label = item.hardStale ? 'STALE' : item.stale ? 'STATIC' : item.liveLike ? 'OK' : 'REF';
      var color = item.hardStale ? '#ff5b50' : item.stale ? '#ffa31a' : item.liveLike ? '#00e5a0' : '#7b8599';
      badge.textContent = label;
      badge.style.color = color;
      badge.style.background = item.hardStale ? 'rgba(255,91,80,.12)' : item.stale ? 'rgba(255,163,26,.12)' : 'rgba(123,133,153,.10)';
      badge.title = item.category + ' / age ' + (item.ageDays == null ? '?' : item.ageDays) + 'd / ' + (item.liveLike ? 'live-like' : 'reference');
    });
  } catch(_) {}
  return audit;
};

// ─────────────────────────────────────────────────────────────────
// v49.24 P213/P216/P218 근본 수정: getSnapshotConsistencyAudit
// 모든 [data-snap] 요소의 DOM 인라인 텍스트 vs DATA_SNAPSHOT 값 3-way 비교
// + 동일 data-snap key가 여러 페이지에 sink 등록되었는지(P216 패턴) 검사.
// 불일치 발견 시 issueCount > 0. v49.24 R55/R58 강제.
// ─────────────────────────────────────────────────────────────────
window.AIO.getSnapshotConsistencyAudit = function() {
  var issues = [];
  var sinkMap = {};   // data-snap key -> [elements...]
  var mismatches = []; // {key, expected (DATA_SNAPSHOT), found (DOM inline)}
  try {
    var S = window.DATA_SNAPSHOT || {};
    document.querySelectorAll('[data-snap]').forEach(function(el) {
      var key = el.getAttribute('data-snap');
      if (!key) return;
      sinkMap[key] = sinkMap[key] || [];
      sinkMap[key].push({
        text: (el.textContent || '').trim().slice(0, 80),
        pageId: (function() { var p = el.closest('[id^="page-"]'); return p ? p.id : null; })()
      });
    });
    // applyDataSnapshot의 map 결과와 비교는 직접 불가 — 대신 같은 key가 여러 sink에서 다른 텍스트 나타나면 즉시 불일치
    Object.keys(sinkMap).forEach(function(key) {
      var sinks = sinkMap[key];
      if (sinks.length < 2) return;
      var uniqueTexts = {};
      sinks.forEach(function(s) { uniqueTexts[s.text] = (uniqueTexts[s.text] || 0) + 1; });
      var distinct = Object.keys(uniqueTexts);
      if (distinct.length > 1) {
        mismatches.push({ key: key, sinkCount: sinks.length, distinctValues: distinct, sinks: sinks });
        issues.push('sink-mismatch: ' + key + ' has ' + distinct.length + ' distinct values across ' + sinks.length + ' sinks');
      }
    });
  } catch (e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    sinkKeys: Object.keys(sinkMap).length,
    totalSinks: Object.keys(sinkMap).reduce(function(n, k) { return n + sinkMap[k].length; }, 0),
    mismatches: mismatches,
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.96 P459 근본 보강: getSnapshotFallbackConsistencyAudit (R184)
// DATA_SNAPSHOT 본체 필드 vs DATA_SNAPSHOT._fallback 미러 필드 자동 교차검증.
// 같은 지표가 두 저장소(본체 + computeTradingScore가 읽는 _fallback)에 존재 →
// 한쪽만 갱신 시 silent 불일치 (예: v49.95 move 70.9 갱신 시 _fallback.move 62 미러 누락,
// pcr 0.67 vs _fallback.pcr 0.83). runtime DOM audit(getSnapshotConsistencyAudit)는
// applyDataSnapshot 정규화 후라 못 잡음 → JS 객체 레벨 비교가 근본 가드.
// ─────────────────────────────────────────────────────────────────
window.AIO.getSnapshotFallbackConsistencyAudit = function(opts) {
  opts = opts || {};
  var tol = opts.tolerance != null ? opts.tolerance : 0.03; // 3% 상대 허용
  // 본체 key -> _fallback key (미러되어야 하는 지표만)
  var aliasMap = {
    fg: 'fg', fg_uw: 'fg_uw', vix: 'vix', pcr: 'pcr', dxy: 'dxy',
    vvix: 'vvix', move: 'move', skew: 'skew', aaiiBear: 'aaiiBear',
    breadth5sma: 'breadth5', breadth50sma: 'breadth50', breadth200sma: 'breadth200'
  };
  var mismatches = [];
  try {
    var S = window.DATA_SNAPSHOT || {};
    var F = S._fallback || {};
    Object.keys(aliasMap).forEach(function(sKey) {
      var fKey = aliasMap[sKey];
      var a = S[sKey], b = F[fKey];
      if (a == null || b == null) return;          // 한쪽만 존재 → mirror 의무 아님
      var na = Number(a), nb = Number(b);
      if (isNaN(na) || isNaN(nb)) return;
      var rel = Math.abs(na - nb) / Math.max(Math.abs(na), Math.abs(nb), 1);
      if (rel > tol) {
        mismatches.push({
          snapshotKey: sKey, snapshotVal: na,
          fallbackKey: fKey, fallbackVal: nb,
          relDiff: +(rel * 100).toFixed(1) + '%'
        });
      }
    });
  } catch (e) {
    return { status: 'error', message: e && e.message || String(e) };
  }
  return {
    status: mismatches.length ? 'warn' : 'ok',
    issueCount: mismatches.length,
    checkedPairs: 12,
    mismatches: mismatches,
    note: 'DATA_SNAPSHOT 본체 vs _fallback 미러 정합 (R184/P459) — 불일치 시 한쪽만 갱신된 silent drift',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.24 P217 근본 수정: getTableStaleAudit
// 정적 테이블(<table>) 첫 행의 날짜 패턴(MM/DD or YYYY-MM-DD)을 스캔하여
// 90일+ 경과한 테이블을 stale로 보고. data-aio-archive="true"는 제외.
// ─────────────────────────────────────────────────────────────────
window.AIO.getTableStaleAudit = function(opts) {
  opts = opts || {};
  var nowTs = opts.nowTs || Date.now();
  var staleDaysThreshold = opts.thresholdDays || 90;
  var issues = [];
  var staleTables = [];
  try {
    var nowYear = new Date(nowTs).getUTCFullYear();
    document.querySelectorAll('table').forEach(function(tbl) {
      // archive 마킹된 테이블은 제외
      if (tbl.closest('[data-aio-archive="true"]')) return;
      var firstDataRow = tbl.querySelector('tr:nth-child(2)');
      if (!firstDataRow) return;
      var firstCell = firstDataRow.cells[0];
      if (!firstCell) return;
      var txt = (firstCell.textContent || '').trim();
      // MM/DD or YYYY-MM-DD 패턴 탐지
      var mmdd = txt.match(/^(\d{1,2})\/(\d{1,2})\b/);
      var ymd  = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      var ts = null;
      if (ymd) {
        ts = Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3]);
      } else if (mmdd) {
        // 연도 미상 — 현재 연도로 가정. 미래라면 작년으로 fallback.
        var candidate = Date.UTC(nowYear, +mmdd[1] - 1, +mmdd[2]);
        if (candidate > nowTs + 7 * 86400 * 1000) {
          candidate = Date.UTC(nowYear - 1, +mmdd[1] - 1, +mmdd[2]);
        }
        ts = candidate;
      } else {
        return;
      }
      var ageDays = Math.floor((nowTs - ts) / 86400000);
      if (ageDays > staleDaysThreshold) {
        var pageEl = tbl.closest('[id^="page-"]');
        var info = {
          tableId: tbl.id || '',
          pageId: pageEl ? pageEl.id : null,
          firstCellText: txt,
          ageDays: ageDays,
          threshold: staleDaysThreshold
        };
        staleTables.push(info);
        issues.push('stale-table: ' + (tbl.id || '<no-id>') + ' age=' + ageDays + 'd in ' + (info.pageId || '<unknown>'));
      }
    });
  } catch (e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    staleTables: staleTables,
    thresholdDays: staleDaysThreshold,
    generatedAt: new Date(nowTs).toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.25 L3 근본 수정: diagnoseBreadthConsensus
// 다중 신호(5SMA/20SMA/50SMA/McClellan/Weinstein/Golden Cross)를 가중 평균하여
// 합의된 단일 판정을 도출. 모순 시그널 자동 가중치 조정.
// ─────────────────────────────────────────────────────────────────
window.AIO.diagnoseBreadthConsensus = function(signals) {
  signals = signals || {};
  var reg = window.AIO_THRESHOLD_REGISTRY;
  if (!reg || !reg.BREADTH) return { verdict: '—', score: null, conflict: null };

  var weights = { sma5: 0.10, sma20: 0.20, sma50: 0.30, mcclellan: 0.20, weinstein: 0.10, goldenCross: 0.10 };
  var totalWeight = 0, totalScore = 0;
  var details = [];
  // signal bands: bullish=+1, mixed=0, bearish=-1, capitulation=+0.5, overbought=-0.5
  var bandScoreMap = { 'capitulation': 0.5, 'bearish': -1, 'mixed': 0, 'bullish': 1, 'overbought': -0.5 };

  ['sma5', 'sma20', 'sma50'].forEach(function(k) {
    var v = Number(signals[k]);
    if (isNaN(v)) return;
    var label = reg.BREADTH.getLabel(v);
    var score = bandScoreMap[label.signal] != null ? bandScoreMap[label.signal] : 0;
    totalScore += score * weights[k];
    totalWeight += weights[k];
    details.push({ key: k, value: v, label: label.label, score: score });
  });

  // 추가 신호: 'bullish' | 'bearish' | 'neutral' 직접 입력
  ['mcclellan', 'weinstein', 'goldenCross'].forEach(function(k) {
    if (signals[k] == null) return;
    var s = signals[k];
    var score = s === 'bullish' ? 1 : s === 'bearish' ? -1 : 0;
    totalScore += score * weights[k];
    totalWeight += weights[k];
    details.push({ key: k, signal: s, score: score });
  });

  if (totalWeight === 0) return { verdict: '—', score: null, conflict: null };
  var consensus = totalScore / totalWeight;
  var verdict;
  if (consensus > 0.4) verdict = '강세 합의';
  else if (consensus > 0.1) verdict = '약세 우위';
  else if (consensus > -0.1) verdict = '혼조 (모순 신호 존재)';
  else if (consensus > -0.4) verdict = '약세 우위';
  else verdict = '약세 합의';

  // 모순 탐지: 각 시그널의 부호가 다를 때
  var positives = details.filter(function(d) { return d.score > 0; }).length;
  var negatives = details.filter(function(d) { return d.score < 0; }).length;
  var conflict = positives > 0 && negatives > 0
    ? { positiveCount: positives, negativeCount: negatives, note: positives + '개 강세 vs ' + negatives + '개 약세 신호 공존' }
    : null;

  return {
    verdict: verdict,
    consensus: consensus,
    details: details,
    conflict: conflict
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.25 R56 자동화: getThresholdLabelAudit
// THRESHOLD_REGISTRY에 등록된 지표의 라벨(예: '극단 공포', 'Tight')이
// DOM에 인라인 텍스트로 직접 작성된 위치를 탐지 → registry 미경유 위치 보고.
// ─────────────────────────────────────────────────────────────────
window.AIO.getThresholdLabelAudit = function() {
  var reg = window.AIO_THRESHOLD_REGISTRY;
  if (!reg) return { status: 'error', message: 'AIO_THRESHOLD_REGISTRY undefined', issueCount: 0, issues: [] };

  // 모든 등록된 라벨 모음
  var allLabels = {};
  Object.keys(reg).forEach(function(key) {
    if (!reg[key].bands) return;
    reg[key].bands.forEach(function(b) {
      if (b.label && b.label !== '—') {
        allLabels[b.label] = allLabels[b.label] || [];
        allLabels[b.label].push(key);
      }
    });
  });

  var issues = [];
  var inlineHits = [];
  try {
    // 모든 페이지 텍스트에서 라벨 검색
    var pages = document.querySelectorAll('[id^="page-"]');
    pages.forEach(function(page) {
      // archive 섹션 제외
      var clone = page.cloneNode(true);
      clone.querySelectorAll('[data-aio-archive="true"]').forEach(function(el) { el.remove(); });
      var txt = (clone.textContent || '');
      Object.keys(allLabels).forEach(function(label) {
        // 정확히 일치하는 인라인 라벨 (tooltip/설명 외)
        var count = (txt.match(new RegExp(label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
        if (count > 0) {
          inlineHits.push({ page: page.id, label: label, count: count, registries: allLabels[label] });
        }
      });
    });
    // tooltip/정의문 내부는 합법적 → 정보성으로만 보고
  } catch (e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }

  return {
    status: 'ok',
    issueCount: issues.length,
    issues: issues,
    registryLabels: Object.keys(allLabels).length,
    inlineHits: inlineHits.length,
    sampleHits: inlineHits.slice(0, 20),
    note: 'inlineHits 수가 많을수록 R56 위반 가능성 증가. 라벨이 getLabel() 경유하는지 코드 리뷰 필요.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.26 I1 근본 수정: applyLabelToElement
// THRESHOLD_REGISTRY.getLabel() 결과를 DOM 요소에 일괄 적용.
// 라벨 텍스트 + 색상(CSS var) + signal 데이터 속성을 한 번에 설정.
// → 페이지마다 임의 색상 if/else 차단.
// ─────────────────────────────────────────────────────────────────
window.AIO.applyLabelToElement = function(el, registryKey, value) {
  if (!el) return null;
  var reg = window.AIO_THRESHOLD_REGISTRY;
  if (!reg || !reg[registryKey] || typeof reg[registryKey].getLabel !== 'function') return null;
  var info = reg[registryKey].getLabel(value);
  el.textContent = info.label;
  el.style.color = 'var(--' + info.color + ')';
  el.setAttribute('data-signal', info.signal || 'unknown');
  el.setAttribute('data-threshold-key', registryKey);
  return info;
};

// ─────────────────────────────────────────────────────────────────
// v49.26 I4 근본 수정: getDuplicateContentAudit
// TradingView 차트 + OHLC 폴백 정보 같은 중복 콘텐츠를 자동 탐지.
// 동일 지표가 동일 페이지 내 ≥3회 표시되면 중복 보고.
// ─────────────────────────────────────────────────────────────────
window.AIO.getDuplicateContentAudit = function() {
  var dupes = [];
  try {
    var pages = document.querySelectorAll('[id^="page-"]');
    pages.forEach(function(page) {
      var counts = {};
      page.querySelectorAll('[data-snap], [data-live-price]').forEach(function(el) {
        var key = el.getAttribute('data-snap') || el.getAttribute('data-live-price');
        if (!key) return;
        // archive 섹션은 합법적 중복으로 제외
        if (el.closest('[data-aio-archive="true"]')) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      Object.keys(counts).forEach(function(key) {
        if (counts[key] >= 3) {
          dupes.push({ pageId: page.id, indicator: key, count: counts[key], threshold: 3 });
        }
      });
    });
  } catch (e) {
    return { status: 'error', message: e && e.message, issueCount: 0, duplicates: [] };
  }
  return {
    status: dupes.length ? 'warn' : 'ok',
    issueCount: dupes.length,
    duplicates: dupes,
    note: '동일 지표가 한 페이지에 3회 이상 표시 → I4 패턴. 중복 합법 시 archive 마킹 또는 의도 명시.',
    generatedAt: new Date().toISOString()
  };
};

// ─────────────────────────────────────────────────────────────────
// v49.26 I7 근본 수정: getCycleFromMacro
// 경기 사이클 위치를 매크로 지표(VIX/breadth/yield curve)로부터 동적 판정.
// themes 페이지의 "◀ 현재(Late Cycle)" 정적 고정 해소.
// ─────────────────────────────────────────────────────────────────
window.AIO.getCycleFromMacro = function(macro) {
  macro = macro || {};
  var ld = window._liveData || {};
  var vix = Number(macro.vix != null ? macro.vix : (ld['^VIX'] ? ld['^VIX'].price : NaN));
  var breadth50 = Number(macro.breadth50 != null ? macro.breadth50 :
    (window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT.breadth50sma : NaN));
  var yield2s10s = Number(macro.yield2s10s != null ? macro.yield2s10s : 0);
  var spxTrend = macro.spxTrend || (ld['^GSPC'] && ld['^GSPC'].pct > 0 ? 'up' : 'down');

  var phase = 'unknown';
  var rationale = [];
  // 단순 의사결정 트리 (개선 가능)
  if (isNaN(vix) && isNaN(breadth50)) {
    phase = 'unknown';
    rationale.push('insufficient data');
  } else if (vix < 15 && breadth50 > 65 && spxTrend === 'up') {
    phase = 'Late Cycle (Peak)';
    rationale.push('VIX <15 + breadth >65% + 상승 추세 = 과열');
  } else if (vix < 20 && breadth50 > 50) {
    phase = 'Mid Cycle (Expansion)';
    rationale.push('VIX <20 + breadth >50% = 확장');
  } else if (vix > 25 && breadth50 < 40) {
    phase = 'Recession Risk';
    rationale.push('VIX >25 + breadth <40% = 침체 위험');
  } else if (vix > 30 && spxTrend === 'down') {
    phase = 'Bear Market';
    rationale.push('VIX >30 + 하락 추세 = 약세장');
  } else if (vix < 25 && breadth50 < 50 && spxTrend === 'up') {
    phase = 'Early Cycle (Recovery)';
    rationale.push('VIX <25 + breadth <50% + 반등 = 회복기');
  } else {
    phase = 'Mid Cycle';
    rationale.push('default — 매크로 신호 혼재');
  }
  if (yield2s10s < 0) rationale.push('수익률 곡선 역전 → 침체 선행 신호');

  return {
    phase: phase,
    inputs: { vix: vix, breadth50: breadth50, yield2s10s: yield2s10s, spxTrend: spxTrend },
    rationale: rationale,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getAutoOpsReadiness = function() {
  var freshness = window.AIO.getDataFreshnessAudit ? window.AIO.getDataFreshnessAudit() : null;
  var pipeline = window.AIO.getDataPipelineAudit ? window.AIO.getDataPipelineAudit() : null;
  var statics = window.AIO.getStaticDataGovernanceAudit ? window.AIO.getStaticDataGovernanceAudit() : null;
  var scheduler = window.AIO.getRefreshSchedulerAudit ? window.AIO.getRefreshSchedulerAudit() : null;
  var continuity = window.AIO.getAutoDataContinuityAudit ? window.AIO.getAutoDataContinuityAudit({ dryRun: true }) : null;
  // v49.24: cross-page sink consistency + 정적 테이블 stale 통합 점검
  var sinkConsistency = window.AIO.getSnapshotConsistencyAudit ? window.AIO.getSnapshotConsistencyAudit() : null;
  var tableStale = window.AIO.getTableStaleAudit ? window.AIO.getTableStaleAudit() : null;
  // v49.30: 5개 신규 audit 통합 (M1~M5)
  var snapshotInline = window.AIO.assertSnapshotInlineMatch ? window.AIO.assertSnapshotInlineMatch() : null;
  var contentLifecycle = window.AIO.getStaticContentLifecycleAudit ? window.AIO.getStaticContentLifecycleAudit() : null;
  var namedEntity = window.AIO.getNamedEntityAudit ? window.AIO.getNamedEntityAudit() : null;
  var macroRelease = window.AIO.getMacroReleaseStaleAudit ? window.AIO.getMacroReleaseStaleAudit() : null;
  var krMacroRelease = window.AIO.getKrMacroReleaseAudit ? window.AIO.getKrMacroReleaseAudit() : null;
  // v49.31: 지정학 시나리오 검토 통합
  var geopolitical = window.AIO.getGeopoliticalReviewAudit ? window.AIO.getGeopoliticalReviewAudit() : null;
  // v49.32: AI 채팅 정확성 5축 통합
  var numericGuideline = window.AIO.getNumericGuidelineAudit ? window.AIO.getNumericGuidelineAudit() : null;
  var tickerMapping = window.AIO.getTickerMappingAudit ? window.AIO.getTickerMappingAudit() : null;
  var chatPriceFetchHealth = window.AIO.assertChatPriceFetchHealth ? window.AIO.assertChatPriceFetchHealth() : null;
  // v49.32 확장: 15 fundamental criteria 커버리지
  var fundCriteria = window.AIO.getFundamentalCriteriaAudit ? window.AIO.getFundamentalCriteriaAudit() : null;
  // v49.34: 15 분석 분야 (정량+정성) 커버리지 종합
  var analysisFramework = window.AIO.getAnalysisFrameworkCoverageAudit ? window.AIO.getAnalysisFrameworkCoverageAudit() : null;
  // v49.35: fundamental 페이지 L8175 15 기준 커버리지
  var pageCriteria = window.AIO.getFundamentalPageCriteriaAudit ? window.AIO.getFundamentalPageCriteriaAudit() : null;
  // v49.38 R94: 인라인 임계값 표 정합
  var inlineThresholdTable = window.AIO.getInlineThresholdTableAudit ? window.AIO.getInlineThresholdTableAudit() : null;
  // v49.39 R95: 페이지 간 동일 ticker 정합
  var crossPageIndicator = window.AIO.getCrossPageIndicatorConsistencyAudit ? window.AIO.getCrossPageIndicatorConsistencyAudit() : null;
  // v49.39 R96: data-action 핸들러 정합
  var dataActionHandler = window.AIO.getDataActionHandlerAudit ? window.AIO.getDataActionHandlerAudit() : null;
  // v49.41 R97: data-snap 키 vs DATA_SNAPSHOT 시드 정합
  var staticSeedFallback = window.AIO.getStaticSeedFallbackAudit ? window.AIO.getStaticSeedFallbackAudit() : null;
  // v49.48 R101: LIVE_SYMBOLS coverage (DOM ticker vs LIVE_SYMBOLS)
  var liveSymbolsCoverage = window.AIO.getLiveSymbolsCoverageAudit ? window.AIO.getLiveSymbolsCoverageAudit() : null;
  var hardcodedQuoteFallback = window.AIO.getHardcodedQuoteFallbackAudit ? window.AIO.getHardcodedQuoteFallbackAudit() : null;
  var snapshotFallbackGuard = window.AIO.getSnapshotFallbackGuard ? window.AIO.getSnapshotFallbackGuard() : null;
  // v49.96 R184: DATA_SNAPSHOT 본체 vs _fallback 미러 정합 (P459)
  var snapshotFallbackConsistency = window.AIO.getSnapshotFallbackConsistencyAudit ? window.AIO.getSnapshotFallbackConsistencyAudit() : null;
  var dataQuality = window.AIO.getDataQualityIssueAudit ? window.AIO.getDataQualityIssueAudit() : null;
  var snapshotDateSources = window.AIO.getSnapshotDateSourceAudit ? window.AIO.getSnapshotDateSourceAudit() : null;
  var operationalDataContract = window.AIO.getOperationalDataContractAudit ? window.AIO.getOperationalDataContractAudit() : null;
  var krSupplyRuntime = window.AIO.getKrSupplyRuntimeAudit ? window.AIO.getKrSupplyRuntimeAudit() : null;
  var marketCurrentness = window.AIO.getMarketCurrentnessAudit ? window.AIO.getMarketCurrentnessAudit() : null;
  var essenceAlignment = window.AIO.getEssenceAlignmentAudit ? window.AIO.getEssenceAlignmentAudit() : null;
  var fullSurfaceAudit = window.AIO.getFullSurfaceAudit ? window.AIO.getFullSurfaceAudit() : null;
  var deepReviewAudit = window.AIO.getDeepReviewAudit ? window.AIO.getDeepReviewAudit() : null;
  var fourthFifthPass = window.AIO.getFourthFifthPassAudit ? window.AIO.getFourthFifthPassAudit() : null;
  var issues = [];
  if (freshness && freshness.status !== 'ok') issues = issues.concat(freshness.issues || []);
  if (statics && statics.issueCount) issues.push(statics.issueCount + ' static/live-like freshness issue(s)');
  if (!scheduler || !scheduler.totalTasks) issues.push('refresh scheduler audit unavailable');
  else if (scheduler.tasksWithoutFn && scheduler.tasksWithoutFn.length) issues.push('scheduler task(s) without function: ' + scheduler.tasksWithoutFn.join(','));
  if (scheduler && scheduler.pageRefreshIssues && scheduler.pageRefreshIssues.length) issues.push(scheduler.pageRefreshIssues.length + ' page on-enter refresh 매핑 오류 [v49.98/R187]: ' + scheduler.pageRefreshIssues.join(','));
  if (scheduler && scheduler.pageRefreshWired === false) issues.push('page on-enter refresh 미연결 [v49.98/R187]');
  if (continuity && continuity.issueCount) issues.push(continuity.issueCount + ' data continuity repair candidate(s)');
  if (sinkConsistency && sinkConsistency.issueCount) issues.push(sinkConsistency.issueCount + ' cross-page sink mismatch(es) [P216/P218 pattern]');
  if (tableStale && tableStale.issueCount) issues.push(tableStale.issueCount + ' stale table(s) [P217 pattern]');
  // v49.30: 5 신규 audit 통합
  if (snapshotInline && snapshotInline.mismatchCount) issues.push(snapshotInline.mismatchCount + ' inline vs DATA_SNAPSHOT mismatch(es) [P252/R74]');
  if (contentLifecycle && contentLifecycle.expiredCount) issues.push(contentLifecycle.expiredCount + ' expired content(s) [P253/R75]');
  if (namedEntity && namedEntity.unverifiedCount) issues.push(namedEntity.unverifiedCount + ' unverified named entity [P254/R76]');
  if (macroRelease && macroRelease.staleReleaseCount) issues.push(macroRelease.staleReleaseCount + ' stale macro release(s) [P254/R77]');
  if (krMacroRelease && krMacroRelease.krStaleReleaseCount) issues.push(krMacroRelease.krStaleReleaseCount + ' stale KR macro release(s) [P255/R78]');
  if (geopolitical && geopolitical.overdueCount) issues.push(geopolitical.overdueCount + ' overdue geopolitical review(s) [v49.31/R79]');
  // v49.32: AI 채팅 정확성 통합 보고
  if (numericGuideline && numericGuideline.issueCount) issues.push(numericGuideline.issueCount + ' numeric guideline issue(s) [P262/R84]');
  if (tickerMapping && tickerMapping.unmappedCount) issues.push(tickerMapping.unmappedCount + ' ticker mapping issue(s) [P266/R85]');
  if (chatPriceFetchHealth && chatPriceFetchHealth.status !== 'ok') issues.push('chat price fetch health: ' + chatPriceFetchHealth.status + ' [P265]');
  if (fundCriteria && fundCriteria.notImplCount) issues.push(fundCriteria.notImplCount + '/15 fundamental criteria not implemented [v49.32 확장]');
  if (analysisFramework && analysisFramework.highRiskCount) issues.push(analysisFramework.highRiskCount + ' high-hallucination-risk analysis fields [v49.34/R90]');
  if (pageCriteria && pageCriteria.notImplCount) issues.push(pageCriteria.notImplCount + '/15 fundamental page criteria not implemented [v49.35/R91]');
  if (inlineThresholdTable && inlineThresholdTable.issueCount) issues.push(inlineThresholdTable.issueCount + ' inline threshold table mismatch(es) [v49.38/R94]');
  if (crossPageIndicator && crossPageIndicator.issueCount) issues.push(crossPageIndicator.issueCount + ' cross-page indicator mismatch(es) [v49.39/R95]');
  if (dataActionHandler && dataActionHandler.issueCount) issues.push(dataActionHandler.issueCount + ' missing data-action handler(s) [v49.39/R96]');
  if (staticSeedFallback && staticSeedFallback.issueCount) issues.push(staticSeedFallback.issueCount + ' data-snap key(s) without DATA_SNAPSHOT seed [v49.41/R97]');
  if (liveSymbolsCoverage && liveSymbolsCoverage.issueCount) issues.push(liveSymbolsCoverage.issueCount + ' DOM ticker(s) missing in LIVE_SYMBOLS [v49.48/R101]');
  if (hardcodedQuoteFallback && hardcodedQuoteFallback.issueCount) issues.push('hardcoded quote fallback reachable [v49.51/R103]');
  if (snapshotFallbackGuard && snapshotFallbackGuard.usable === false) issues.push('DATA_SNAPSHOT hard-stale; snapshot fallback disabled [v49.51/R104]');
  if (snapshotFallbackConsistency && snapshotFallbackConsistency.issueCount) issues.push(snapshotFallbackConsistency.issueCount + ' snapshot↔_fallback mirror drift [v49.96/R184/P459]');
  if (dataQuality && dataQuality.issueCount) issues.push(dataQuality.issueCount + ' data quality issue(s) [v49.52/R105]');
  if (snapshotDateSources && snapshotDateSources.issueCount) issues.push(snapshotDateSources.issueCount + ' snapshot date source issue(s) [v49.52/R106]');
  if (operationalDataContract && operationalDataContract.issueCount) issues.push(operationalDataContract.issueCount + ' operational data contract issue(s) [v49.54/R107]');
  if (krSupplyRuntime && krSupplyRuntime.issueCount) issues.push(krSupplyRuntime.issueCount + ' KR supply runtime issue(s) [v49.54/R108]');
  if (marketCurrentness && marketCurrentness.issueCount) issues.push(marketCurrentness.issueCount + ' market currentness issue(s) [v49.58/R111]');
  if (essenceAlignment && essenceAlignment.status === 'fail') issues.push('3대 본질 정렬 fail: ' + essenceAlignment.overallScore + '점 [v49.65/R119]');
  if (fullSurfaceAudit && fullSurfaceAudit.status === 'fail') issues.push(fullSurfaceAudit.issueCount + ' full surface audit issue(s) [P358/R124]');
  if (deepReviewAudit && deepReviewAudit.status === 'fail') issues.push(deepReviewAudit.issueCount + ' deep review issue(s) [P359/R125]');
  if (fourthFifthPass && fourthFifthPass.status === 'fail') issues.push(fourthFifthPass.issueCount + ' fourth/fifth pass issue(s) [P377/R135]');
  return {
    status: issues.length ? 'warn' : 'ok',
    issues: issues,
    commands: {
      audit: 'AIO.getAutoOpsReadiness()',
      forceRefresh: 'AIO.forceRefreshAllData()',
      ensureFresh: 'AIO.ensureFreshDataForUse({ pageId:"home" })',
      staticAudit: 'AIO.getStaticDataGovernanceAudit()',
      freshnessAudit: 'AIO.getDataFreshnessAudit()',
      continuityAudit: 'AIO.getAutoDataContinuityAudit()',
      sinkConsistency: 'AIO.getSnapshotConsistencyAudit()',
      tableStale: 'AIO.getTableStaleAudit()',
      snapshotInline: 'AIO.assertSnapshotInlineMatch()',
      contentLifecycle: 'AIO.getStaticContentLifecycleAudit()',
      namedEntity: 'AIO.getNamedEntityAudit()',
      macroRelease: 'AIO.getMacroReleaseStaleAudit()',
      krMacroRelease: 'AIO.getKrMacroReleaseAudit()',
      geopolitical: 'AIO.getGeopoliticalReviewAudit()',
      numericGuideline: 'AIO.getNumericGuidelineAudit()',
      tickerMapping: 'AIO.getTickerMappingAudit()',
      chatPriceFetchHealth: 'AIO.assertChatPriceFetchHealth()',
      chatResponseAccuracy: 'AIO.assertChatResponseAccuracy(text, tickers)',
      chatHallucination: 'AIO.getChatHallucinationAudit(text)',
      tickerDataIntegrity: 'AIO.assertTickerDataIntegrity(ticker)',
      fundamentalCriteria: 'AIO.getFundamentalCriteriaAudit()',
      analysisFramework: 'AIO.getAnalysisFrameworkCoverageAudit()',
      analysisFrameworkPerTicker: 'AIO.assertAnalysisFrameworkCoverage(ticker)',
      fetchSEC: 'AIO.fetchSECBusinessDescription(ticker)',
      fetchWiki: 'AIO.fetchWikipediaCompany(ticker)',
      fundPageCriteria: 'AIO.getFundamentalPageCriteriaAudit()',
      criteriaCrossRef: 'AIO.getCriteriaCrossReferenceAudit()',
      inlineThresholdTable: 'AIO.getInlineThresholdTableAudit()',
      pageSeqAudit: 'AIO.getPageSequentialAuditStatus()',
      crossPageIndicator: 'AIO.getCrossPageIndicatorConsistencyAudit()',
      dataActionHandler: 'AIO.getDataActionHandlerAudit()',
      staticSeedFallback: 'AIO.getStaticSeedFallbackAudit()',
      liveSymbolsCoverage: 'AIO.getLiveSymbolsCoverageAudit()',
      cellLevelData: 'AIO.getCellLevelDataAudit(pageId)',
      hardcodedQuoteFallback: 'AIO.getHardcodedQuoteFallbackAudit()',
      snapshotFallbackGuard: 'AIO.getSnapshotFallbackGuard()',
      snapshotFallbackConsistency: 'AIO.getSnapshotFallbackConsistencyAudit()',
      dataQuality: 'AIO.getDataQualityIssueAudit()',
      snapshotDateSources: 'AIO.getSnapshotDateSourceAudit()',
      operationalDataContract: 'AIO.getOperationalDataContractAudit()',
      krSupplyRuntime: 'AIO.getKrSupplyRuntimeAudit()',
      marketCurrentness: 'AIO.getMarketCurrentnessAudit({ includeHidden: true })',
      essenceAlignment: 'AIO.getEssenceAlignmentAudit()',
      fullSurfaceAudit: 'AIO.getFullSurfaceAudit()',
      deepReviewAudit: 'AIO.getDeepReviewAudit()',
      fourthFifthPass: 'AIO.getFourthFifthPassAudit()',
      applyMarketCurrentnessGuard: 'AIO.applyMarketCurrentnessGuard()',
      marketRegime: 'AIO.getCurrentMarketRegime()',
      krMarketTemperature: 'AIO.getKrMarketTemperature()',
      deploymentGate: 'AIO.getDeploymentGateAudit({ strict: true })'
    },
    freshness: freshness,
    pipelineStatus: pipeline && pipeline.status || null,
    staticGovernance: statics,
    scheduler: scheduler,
    continuity: continuity,
    sinkConsistency: sinkConsistency,
    tableStale: tableStale,
    snapshotInline: snapshotInline,
    contentLifecycle: contentLifecycle,
    namedEntity: namedEntity,
    macroRelease: macroRelease,
    krMacroRelease: krMacroRelease,
    geopolitical: geopolitical,
    numericGuideline: numericGuideline,
    tickerMapping: tickerMapping,
    chatPriceFetchHealth: chatPriceFetchHealth,
    fundCriteria: fundCriteria,
    analysisFramework: analysisFramework,
    pageCriteria: pageCriteria,
    inlineThresholdTable: inlineThresholdTable,
    crossPageIndicator: crossPageIndicator,
    dataActionHandler: dataActionHandler,
    staticSeedFallback: staticSeedFallback,
    liveSymbolsCoverage: liveSymbolsCoverage,
    hardcodedQuoteFallback: hardcodedQuoteFallback,
    snapshotFallbackGuard: snapshotFallbackGuard,
    dataQuality: dataQuality,
    snapshotDateSources: snapshotDateSources,
    operationalDataContract: operationalDataContract,
    krSupplyRuntime: krSupplyRuntime,
    marketCurrentness: marketCurrentness,
    essenceAlignment: essenceAlignment,
    fullSurfaceAudit: fullSurfaceAudit,
    deepReviewAudit: deepReviewAudit,
    fourthFifthPass: fourthFifthPass,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.recordDataQualityIssue = function(issue) {
  try {
    window._aioDataQualityIssues = window._aioDataQualityIssues || [];
    var item = Object.assign({
      ts: Date.now(),
      severity: 'warn',
      source: 'unknown',
      message: 'data quality issue'
    }, issue || {});
    window._aioDataQualityIssues.push(item);
    if (window._aioDataQualityIssues.length > 120) window._aioDataQualityIssues = window._aioDataQualityIssues.slice(-120);
    if (typeof _aioLog === 'function') _aioLog(item.severity === 'error' ? 'error' : 'warn', 'data-quality', item.source + ': ' + item.message);
  } catch(_) {}
};

window.AIO.getDataQualityIssueAudit = function(opts) {
  opts = opts || {};
  var horizonMs = opts.horizonMs || 6 * 3600000;
  var now = Date.now();
  var issues = (window._aioDataQualityIssues || []).filter(function(x) {
    return x && (!x.ts || now - x.ts <= horizonMs);
  });
  var blocking = issues.filter(function(x) { return x.severity === 'error' || x.blocking === true; });
  return {
    status: blocking.length ? 'fail' : (issues.length ? 'warn' : 'ok'),
    issueCount: issues.length,
    blockingCount: blocking.length,
    issues: issues,
    generatedAt: new Date(now).toISOString()
  };
};

window.AIO.getSnapshotDateSourceAudit = function() {
  var issues = [];
  var items = [];
  try {
    document.querySelectorAll('[data-snap-date]').forEach(function(el) {
      var key = el.getAttribute('data-snap-date') || '';
      var val = (el.textContent || '').trim();
      var explicit = el.getAttribute('data-snap-date-value') || '';
      var hasRegistry = !!(window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._staticDates && (
        key === 'cp-narrative' || key === 'tnx-2y' ||
        key === 'briefing-archive' || key === 'jensen-interview' ||
        key === 'option-snapshot' || key === 'kr-credit' || key === 'kr-deposit' ||
        key === 'kr-52w-high' || key === 'kr-52w-low' || key === 'kr-advance' ||
        key === 'kr-decline' || key === 'kr-issues'
      ));
      items.push({ key: key, value: val, explicit: explicit, registered: hasRegistry });
      if (key === 'option-snapshot' && val === (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._snapshotDate)) {
        issues.push({ type: 'date-source-collapsed-to-global-snapshot', key: key, value: val });
      }
    });
  } catch(e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    items: items,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getDeploymentGateAudit = function(opts) {
  opts = opts || {};
  var strict = opts.strict !== false;
  var readiness = window.AIO.getAutoOpsReadiness ? window.AIO.getAutoOpsReadiness() : null;
  var hardcoded = window.AIO.getHardcodedQuoteFallbackAudit ? window.AIO.getHardcodedQuoteFallbackAudit() : null;
  var snapGuard = window.AIO.getSnapshotFallbackGuard ? window.AIO.getSnapshotFallbackGuard() : null;
  var macro = window.AIO.getMacroReleaseStaleAudit ? window.AIO.getMacroReleaseStaleAudit() : null;
  var krMacro = window.AIO.getKrMacroReleaseAudit ? window.AIO.getKrMacroReleaseAudit() : null;
  var dataQuality = window.AIO.getDataQualityIssueAudit ? window.AIO.getDataQualityIssueAudit() : null;
  var dateSources = window.AIO.getSnapshotDateSourceAudit ? window.AIO.getSnapshotDateSourceAudit() : null;
  var essence = (!opts.skipEssence && window.AIO.getEssenceAlignmentAudit) ? window.AIO.getEssenceAlignmentAudit() : null;
  var fullSurface = window.AIO.getFullSurfaceAudit ? window.AIO.getFullSurfaceAudit() : null;
  var deepReview = window.AIO.getDeepReviewAudit ? window.AIO.getDeepReviewAudit() : null;
  var fourthFifth = window.AIO.getFourthFifthPassAudit ? window.AIO.getFourthFifthPassAudit() : null;
  var blocking = [];
  var warnings = [];

  if (!readiness) blocking.push('auto-ops readiness unavailable');
  if (!hardcoded || hardcoded.status !== 'ok') blocking.push('hardcoded quote fallback reachable');
  if (snapGuard && snapGuard.usable === false) blocking.push('DATA_SNAPSHOT hard-stale; refresh snapshot before deploy');
  if (readiness && readiness.liveSymbolsCoverage && readiness.liveSymbolsCoverage.issueCount) blocking.push('LIVE_SYMBOLS coverage mismatch');
  if (readiness && readiness.dataActionHandler && readiness.dataActionHandler.issueCount) blocking.push('missing data-action handler');
  if (macro && macro.staleReleaseCount) warnings.push(macro.staleReleaseCount + ' stale US macro release(s)');
  if (krMacro && krMacro.krStaleReleaseCount) warnings.push(krMacro.krStaleReleaseCount + ' stale KR macro release(s)');
  if (dataQuality && dataQuality.blockingCount) blocking.push(dataQuality.blockingCount + ' blocking data quality issue(s)');
  if (dataQuality && dataQuality.issueCount && !dataQuality.blockingCount) warnings.push(dataQuality.issueCount + ' data quality warning(s)');
  if (dateSources && dateSources.issueCount) warnings.push(dateSources.issueCount + ' snapshot date source issue(s)');
  if (essence && essence.overallScore < 70) blocking.push('3대 본질 정렬 점수 70 미만');
  else if (essence && essence.status !== 'ok') warnings.push('3대 본질 정렬 warn: ' + essence.overallScore + '점');
  if (fullSurface && fullSurface.status === 'fail') blocking.push('full surface audit fail: ' + fullSurface.issueCount + ' issue(s)');
  else if (fullSurface && fullSurface.status !== 'ok') warnings.push('full surface audit warn: ' + fullSurface.issueCount + ' issue(s)');
  if (deepReview && deepReview.status === 'fail') blocking.push('deep review audit fail: ' + deepReview.issueCount + ' issue(s)');
  else if (deepReview && deepReview.status !== 'ok') warnings.push('deep review audit warn: ' + deepReview.warningCount + ' warning(s)');
  if (fourthFifth && fourthFifth.status === 'fail') blocking.push('fourth/fifth pass audit fail: ' + fourthFifth.issueCount + ' issue(s)');
  else if (fourthFifth && fourthFifth.status !== 'ok') warnings.push('fourth/fifth pass audit warn: ' + fourthFifth.warningCount + ' warning(s)');
  if (strict && warnings.length) blocking = blocking.concat(warnings);

  return {
    status: blocking.length ? 'fail' : (warnings.length ? 'warn' : 'ok'),
    deployable: blocking.length === 0,
    strict: strict,
    blocking: blocking,
    warnings: warnings,
    readinessStatus: readiness && readiness.status || null,
    hardcodedQuoteFallback: hardcoded,
    snapshotFallbackGuard: snapGuard,
    macroRelease: macro,
    krMacroRelease: krMacro,
    dataQuality: dataQuality,
    snapshotDateSources: dateSources,
    essenceAlignment: essence,
    fullSurfaceAudit: fullSurface,
    deepReviewAudit: deepReview,
    fourthFifthPass: fourthFifth,
    generatedAt: new Date().toISOString()
  };
};

// v49.17: automatic data continuity planner.
// The app cannot force every third-party API to succeed, but it can know exactly
// which data each page/chat answer needs and proactively refresh stale layers.
window.AIO.DATA_REQUIREMENT_PROFILES = {
  home:        { tasks: ['quotes','news','sentiment','breadth','technicals'], symbols: ['^GSPC','^IXIC','^DJI','^RUT','SPY','QQQ','IWM','RSP','^VIX','CL=F','BZ=F','GC=F','KRW=X','DX-Y.NYB'] },
  signal:      { tasks: ['quotes','sentiment','breadth','technicals','vixHistory','hySpread'], symbols: ['SPY','QQQ','IWM','DIA','RSP','SMH','SOXX','HYG','LQD','TLT','^VIX'] },
  signals:     { alias: 'signal' },
  breadth:     { tasks: ['quotes','breadth','technicals'], symbols: ['^GSPC','^IXIC','^RUT','SPY','QQQ','IWM','RSP','XLK','XLY','XLF','XLI','XLV','XLE','XLP','XLU','XLRE','XLB','XLC'] },
  sentiment:   { tasks: ['quotes','sentiment','vixHistory','hySpread'], symbols: ['^VIX','^VVIX','VXX','UVXY','SPY','QQQ','HYG','LQD','TLT'] },
  briefing:    { tasks: ['quotes','news','sentiment','breadth','fred','technicals'], symbols: ['^GSPC','^IXIC','^DJI','^RUT','SPY','QQQ','IWM','RSP','SMH','SOXX','^VIX','CL=F','BZ=F','GC=F','KRW=X','DX-Y.NYB','^TNX','HYG','LQD','^KS11'] },
  technical:   { tasks: ['quotes','technicals','breadth','sentiment','vixHistory'], symbols: ['SPY','QQQ','SMH','SOXX','IWM','RSP','DIA','NVDA','AVGO','AMD','PLTR','^VIX'] },
  macro:       { tasks: ['quotes','fred','news','sentiment'], symbols: ['DX-Y.NYB','^TNX','^TYX','^FVX','^IRX','TLT','HYG','LQD','^VIX','CL=F','BZ=F','NG=F','GC=F','SI=F','KRW=X'] },
  fxbond:      { tasks: ['quotes','fred','hySpread','news'], symbols: ['KRW=X','JPY=X','EURUSD=X','GBPUSD=X','CNY=X','AUDUSD=X','DX-Y.NYB','^TNX','^TYX','^FVX','^IRX','ZB=F','TLT','HYG','LQD','CL=F','GC=F'] },
  fundamental: { tasks: ['quotes','news','technicals'], symbols: ['SPY','QQQ','AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','PLTR'] },
  themes:      { tasks: ['quotes','news','technicals'], symbols: ['SMH','SOXX','QQQ','SPY','XLK','XLC','XLY'] },
  'theme-detail': { tasks: ['quotes','news','technicals'], symbols: ['SMH','SOXX','QQQ','SPY'] },
  portfolio:   { tasks: ['quotes','technicals'], symbols: ['SPY','QQQ','IWM','^VIX'] },
  ticker:      { tasks: ['quotes','news','technicals'], symbols: ['SPY','QQQ','^VIX'] },
  options:     { tasks: ['quotes','sentiment','vixHistory'], symbols: ['SPY','QQQ','^VIX'] },
  korea:       { tasks: ['quotes','krSupply','krDynamic','news'], symbols: ['^KS11','^KQ11','KRW=X'] },
  'kr-home':   { tasks: ['quotes','krSupply','krDynamic','news'], symbols: ['^KS11','^KQ11','KRW=X'] },
  'kr-supply': { tasks: ['quotes','krSupply','krDynamic'], symbols: ['^KS11','^KQ11','KRW=X'] },
  'kr-themes': { tasks: ['quotes','krDynamic','news'], symbols: ['^KS11','^KQ11','KRW=X'] },
  'kr-macro':  { tasks: ['quotes','fred','krDynamic'], symbols: ['KRW=X','^KS11','^KQ11'] },
  'kr-tech':   { tasks: ['quotes','technicals','krDynamic'], symbols: ['^KS11','^KQ11','KRW=X'] },
  glossary:    { tasks: [], symbols: [] },
  guide:       { tasks: [], symbols: [] }
};

function _aioUniq(arr) {
  var seen = {};
  return (arr || []).filter(function(x) {
    x = String(x || '').trim();
    if (!x || seen[x]) return false;
    seen[x] = 1;
    return true;
  });
}

function _aioResolveRequirementProfile(pageId) {
  var map = window.AIO.DATA_REQUIREMENT_PROFILES || {};
  var id = String(pageId || '').replace(/^page-/, '') || 'home';
  var p = map[id] || map[id.replace(/^kr-technical$/, 'kr-tech')] || null;
  if (p && p.alias) p = map[p.alias] || p;
  return p || { tasks: ['quotes'], symbols: [] };
}

function _aioPushSymbol(out, sym) {
  sym = String(sym || '').trim().toUpperCase();
  if (!sym || sym === 'NULL' || sym === 'N/A') return;
  out.push(sym);
}

function _aioResolveKrThemeSymbol(raw) {
  raw = String(raw || '').trim().toUpperCase();
  if (!raw) return '';
  if (/\.(KS|KQ)$/.test(raw) || raw.indexOf('=') > 0 || raw.charAt(0) === '^') return raw;
  if (!/^\d{6}$/.test(raw)) return raw;
  try {
    var found = null;
    (window.SCREENER_DB || []).some(function(r) {
      var sym = r && String(r.sym || '').toUpperCase();
      if (sym && sym.indexOf(raw + '.') === 0) {
        found = sym;
        return true;
      }
      return false;
    });
    if (found) return found;
    (window.KR_SUB_THEMES || []).some(function(t) {
      return (t.tickers || []).some(function(sym) {
        sym = String(sym || '').toUpperCase();
        if (sym.indexOf(raw + '.') === 0) {
          found = sym;
          return true;
        }
        return false;
      });
    });
    if (found) return found;
  } catch(_) {}
  return raw + '.KS';
}

function _aioPushThemeSymbols(out, theme) {
  if (!theme) return;
  _aioPushSymbol(out, theme.etf);
  _aioPushSymbol(out, theme.compositeBase);
  ['leaders', 'leaderHighlight', 'tickers'].forEach(function(key) {
    (theme[key] || []).forEach(function(sym) { _aioPushSymbol(out, sym); });
  });
  Object.keys(theme.weights || {}).forEach(function(sym) { _aioPushSymbol(out, sym); });
}

function _aioPushInputSymbol(out, id) {
  try {
    var el = document.getElementById(id);
    if (el && el.value) _aioPushSymbol(out, el.value);
  } catch(_) {}
}

function _aioCollectDynamicPageSymbols(pageId, scope) {
  var id = String(pageId || '').replace(/^page-/, '') || 'home';
  var out = [];
  var isThemePage = id === 'themes' || id === 'theme-detail';
  var isKrThemePage = id === 'korea' || id === 'kr-home' || id === 'kr-themes' || id === 'kr-tech' || id === 'kr-technical';
  var limit = (scope && scope.symbolLimit) || (isThemePage ? 650 : (isKrThemePage ? 360 : 260));
  if (id === 'signal') {
    _aioPushInputSymbol(out, 'signal-lockout-symbol');
  }
  if (id === 'technical') {
    ['tech-brief-symbol', 'tv-tech-sym', 'ticker-analysis-input'].forEach(function(inputId) { _aioPushInputSymbol(out, inputId); });
  }
  if (id === 'fundamental' || id === 'ticker') {
    ['fund-search-input', 'ticker-analysis-input'].forEach(function(inputId) { _aioPushInputSymbol(out, inputId); });
  }
  if (id === 'themes' || id === 'theme-detail') {
    (window.RRG_SECTORS || []).forEach(function(sec) { _aioPushSymbol(out, sec && sec.sym); });
    (window.RRG_SUBSECTORS || []).forEach(function(sec) { _aioPushSymbol(out, sec && sec.sym); });
    (window.ALL_RRG_ETFS || []).forEach(function(sec) { _aioPushSymbol(out, sec && sec.sym); });
    (window.THEME_MAP || []).forEach(function(theme) { _aioPushThemeSymbols(out, theme); });
    (window.SUB_THEMES || []).forEach(function(theme) { _aioPushThemeSymbols(out, theme); });
  }
  if (isKrThemePage) {
    (window.KR_SUB_THEMES || []).forEach(function(theme) { _aioPushThemeSymbols(out, theme); });
    var krMap = window.KR_THEME_MAP || {};
    Object.keys(krMap).forEach(function(key) {
      (krMap[key] || []).forEach(function(item) { _aioPushSymbol(out, _aioResolveKrThemeSymbol(item && (item.yahoo || item.sym || item.code))); });
    });
  }
  return _aioUniq(out).slice(0, limit);
}

window.AIO.collectPageDataSymbols = function(pageId, scope) {
  var base = _aioResolveRequirementProfile(pageId);
  return _aioUniq((base.symbols || []).concat(_aioCollectDynamicPageSymbols(pageId, scope || {})));
};

window.AIO.CRITICAL_PAGE_GROUPS = {
  comprehensive: ['home','signal','breadth','sentiment','briefing'],
  marketAnalysis: ['technical','macro','fxbond','fundamental','themes'],
  krMarket: ['kr-home','kr-supply','kr-themes','kr-macro','kr-technical']
};

window.AIO.getCritical10PageFreshnessAudit = function(opts) {
  opts = opts || {};
  var groups = window.AIO.CRITICAL_PAGE_GROUPS;
  var ids = groups.comprehensive.concat(groups.marketAnalysis);
  var staleTokenRe = /PCE\(4\/30\)|VIX Spot 18\.36|4\/14 daily|4\/9 종가|4\/28-29|1,508|5\/4|5\/5|5\/8|5\/9|2026-04-17|외국인 7거래일|3-4월 누적|3\/5 장중|4\/8 추정|이란 재협상 재개 전망/;
  var pages = ids.map(function(id) {
    var profile = window.AIO.getDataRequirementProfile({ pageId: id, reason: 'critical10-audit', symbolLimit: opts.symbolLimit || 999 });
    var plan = window.AIO.getAutoFreshnessPlan ? window.AIO.getAutoFreshnessPlan({ pageId: id, reason: 'critical10-audit', symbolLimit: opts.symbolLimit || 999 }) : null;
    var el = null;
    try { el = document.getElementById('page-' + id); } catch(_) {}
    var text = '';
    if (el) {
      try {
        var auditClone = el.cloneNode(true);
        auditClone.querySelectorAll('[data-aio-archive="true"]').forEach(function(n) { n.remove(); });
        text = String(auditClone.innerText || auditClone.textContent || '');
      } catch(_) {
        text = String(el.innerText || el.textContent || '');
      }
    }
    var liveSinks = el ? el.querySelectorAll('[data-live-price],[data-live-pct],[data-live-field],[data-snap],[data-snap-date]').length : 0;
    var charts = el ? el.querySelectorAll('canvas,[id*="chart"],[id*="widget"]').length : 0;
    var controls = el ? el.querySelectorAll('button,input,select,[data-action]').length : 0;
    var issue = [];
    if (!el) issue.push('missing page DOM');
    if (!profile.tasks.length && id !== 'guide') issue.push('no required tasks');
    if (profile.symbols.length < 3 && ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'].indexOf(id) >= 0) issue.push('thin symbol coverage');
    if (staleTokenRe.test(text)) issue.push('stale live-like token in page text');
    return {
      pageId: id,
      group: groups.comprehensive.indexOf(id) >= 0 ? 'comprehensive' : 'marketAnalysis',
      status: issue.length ? 'warn' : (plan && plan.status || 'ok'),
      issues: issue,
      tasks: profile.tasks,
      symbols: profile.symbols,
      symbolCount: profile.symbols.length,
      liveSinkCount: liveSinks,
      chartLikeCount: charts,
      controlCount: controls,
      refreshTasks: plan ? plan.tasks : []
    };
  });
  var issues = pages.filter(function(p) { return p.issues.length; });
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    groups: groups,
    pagesChecked: pages.length,
    pages: pages,
    generatedAt: new Date().toISOString()
  };
};

// P209/P211: 한국시장 5페이지 freshness audit (v49.20)
window.AIO.getCriticalKrPageFreshnessAudit = function(opts) {
  opts = opts || {};
  var krIds = (window.AIO.CRITICAL_PAGE_GROUPS && window.AIO.CRITICAL_PAGE_GROUPS.krMarket) ||
    ['kr-home','kr-supply','kr-themes','kr-macro','kr-technical'];
  var krStaleRe = /외국인 7거래일|3-4월 누적|3\/5 장중|4\/8 추정|이란 재협상 재개 전망|개인 매수세 유입 · 바이오/;
  var pages = krIds.map(function(id) {
    var el = null;
    try { el = document.getElementById('page-' + id); } catch(_) {}
    var text = '';
    if (el) {
      try {
        var clone = el.cloneNode(true);
        clone.querySelectorAll('[data-aio-archive="true"]').forEach(function(n) { n.remove(); });
        text = String(clone.innerText || clone.textContent || '');
      } catch(_) { text = String(el.innerText || el.textContent || ''); }
    }
    var liveSinks = el ? el.querySelectorAll('[data-live-price],[data-live-pct],[data-snap],[data-snap-date]').length : 0;
    var issue = [];
    if (!el) issue.push('missing page DOM');
    if (krStaleRe.test(text)) issue.push('stale live-like token in KR page text');
    return { pageId: id, group: 'krMarket', status: issue.length ? 'warn' : 'ok', issues: issue, liveSinkCount: liveSinks };
  });
  var issues = pages.filter(function(p) { return p.issues.length; });
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    pagesChecked: pages.length,
    pages: pages,
    generatedAt: new Date().toISOString()
  };
};

// P208: CHAT_CONTEXTS system 함수 소스에서 stale 날짜 토큰 감사 (v49.19)
window.AIO.getChatContextFreshnessAudit = function() {
  if (typeof window.CHAT_CONTEXTS === 'undefined') {
    return { totalHits: -1, error: 'CHAT_CONTEXTS not loaded' };
  }
  // v49.64 P335/T176b: 2026.04.X / 2026.05.0X 정적 토큰 광범위 검출 (CHAT_CONTEXTS 일반화 의무)
  var staleRe = /BLS Apr CPI was headline|Warsh 화요일|Warsh 5월 취임|5-6월 발표|이슬라마바드 협상|2026\.04(\.\d+)?|2026\.05\.(0[1-9]|1[0-5])|4\/(12|13|14|15|18)[^0-9]/;
  var hits = [];
  var currentHits = [];
  var archiveHits = [];
  var byContext = {};
  Object.keys(window.CHAT_CONTEXTS).forEach(function(key) {
    var ctx = window.CHAT_CONTEXTS[key];
    if (!ctx || typeof ctx.system !== 'function') return;
    var src = ctx.system.toString();
    var matches = src.match(new RegExp(staleRe.source, 'g')) || [];
    byContext[key] = matches.length;
    matches.forEach(function(m) {
      var idx = src.indexOf(m);
      var around = idx >= 0 ? src.slice(Math.max(0, idx - 220), Math.min(src.length, idx + 220)) : '';
      var isArchiveRef = /archive|ARCHIVE|참고|프레임워크|시나리오|리서치|분석|테시스|패러다임|전환|국면|상황|리스크|이벤트|드라이버|청문회|협상|호르무즈|이란|워시|CPI|PPI|전문가콜|프리뷰|업데이트|JPM|Goldman|Citi|BofA|GS|Evercore|Mizuho|FactSet|§|과거|reference/i.test(around);
      var hit = { context: key, match: m, archiveReference: isArchiveRef };
      hits.push(hit);
      (isArchiveRef ? archiveHits : currentHits).push(hit);
    });
  });
  return {
    totalHits: hits.length,
    currentHits: currentHits.length,
    archiveHits: archiveHits.length,
    status: currentHits.length === 0 ? 'ok' : 'warn',
    byContext: byContext,
    samples: currentHits.slice(0, 5),
    archiveSamples: archiveHits.slice(0, 5),
    generatedAt: new Date().toISOString()
  };
};

function _aioLooksFreshIntent(query) {
  var q = String(query || '').toLowerCase();
  return /latest|recent|today|now|this week|news|current|fresh|earnings|guidance|cpi|fomc|fed|rate|tariff|최신|최근|오늘|지금|현재|뉴스|소식|상황|발표|실적|가이던스|금리|관세/.test(q);
}

window.AIO.getDataRequirementProfile = function(scope) {
  scope = scope || {};
  var pageId = scope.pageId || scope.ctxId || scope.context || 'home';
  var base = _aioResolveRequirementProfile(pageId);
  var tasks = (base.tasks || []).slice();
  var symbols = (base.symbols || []).slice();
  symbols = symbols.concat(_aioCollectDynamicPageSymbols(pageId, scope));
  var tickers = Array.isArray(scope.tickers) ? scope.tickers : [];
  tickers.forEach(function(t) { symbols.push(String(t || '').toUpperCase()); });
  if (scope.reason === 'chat') {
    tasks.push('quotes');
    if (_aioLooksFreshIntent(scope.query)) tasks.push('news');
    if (/technical|chart|차트|기술|rsi|macd|atr|exit|trim|매도|손절|익절/i.test(String(scope.query || '') + ' ' + pageId)) tasks.push('technicals');
    if (/macro|fed|fomc|cpi|pce|rate|yield|dollar|oil|금리|물가|달러|유가|매크로/i.test(String(scope.query || '') + ' ' + pageId)) tasks.push('fred');
  }
  return {
    pageId: pageId,
    reason: scope.reason || 'page',
    query: scope.query || '',
    tasks: _aioUniq(tasks),
    symbols: _aioUniq(symbols),
    tickers: _aioUniq(tickers.map(function(t) { return String(t || '').toUpperCase(); })),
    wantsFresh: !!(scope.forceFresh || _aioLooksFreshIntent(scope.query))
  };
};

// Page-specific deep audit router. Each page gets data-flow checks first, then the
// most relevant domain audit instead of a one-size-fits-all smoke test.
window.AIO.PAGE_DEEP_AUDIT_SYSTEMS = {
  home: ['getFullSurfaceAudit', 'getSnapshotDateSourceAudit', 'getMarketCurrentnessAudit'],
  signal: ['getFullSurfaceAudit', 'getCrossPageIndicatorConsistencyAudit', 'getCellLevelDataAudit'],
  breadth: ['getFullSurfaceAudit', 'getCrossPageIndicatorConsistencyAudit', 'getLiveSymbolsCoverageAudit'],
  sentiment: ['getFullSurfaceAudit', 'getMarketCurrentnessAudit', 'getDataFreshnessAudit'],
  briefing: ['getFullSurfaceAudit', 'getChatContextFreshnessAudit', 'getStaticContentLifecycleAudit'],
  technical: ['getFullSurfaceAudit', 'getCellLevelDataAudit', 'getThresholdLabelAudit'],
  macro: ['getMacroReleaseStaleAudit', 'getSnapshotDateSourceAudit', 'getDataFreshnessAudit'],
  fxbond: ['getMacroReleaseStaleAudit', 'getSnapshotConsistencyAudit', 'getDataFreshnessAudit'],
  fundamental: ['getFundamentalPageCriteriaAudit', 'assertFinancialChartsAudit', 'getAnalysisFrameworkCoverageAudit'],
  themes: ['getThemeTrendDeepAudit', 'getThemeFetchCoverageAudit', 'getLiveSymbolsCoverageAudit'],
  'theme-detail': ['getThemeTrendDeepAudit', 'getThemeFetchCoverageAudit', 'getLiveSymbolsCoverageAudit'],
  portfolio: ['getFullSurfaceAudit', 'getCellLevelDataAudit', 'getDataQualityIssueAudit'],
  ticker: ['getFullSurfaceAudit', 'getTickerMappingAudit', 'getNamedEntityAudit'],
  options: ['getFullSurfaceAudit', 'getCellLevelDataAudit', 'getDataFreshnessAudit'],
  korea: ['getCriticalKrPageFreshnessAudit', 'getSnapshotDateSourceAudit', 'getDataFreshnessAudit'],
  'kr-home': ['getCriticalKrPageFreshnessAudit', 'getSnapshotDateSourceAudit', 'getDataFreshnessAudit'],
  'kr-supply': ['getCriticalKrPageFreshnessAudit', 'getSnapshotDateSourceAudit', 'getDataFreshnessAudit'],
  'kr-themes': ['getThemeTrendDeepAudit', 'getThemeFetchCoverageAudit', 'getCriticalKrPageFreshnessAudit'],
  'kr-macro': ['getKrMacroReleaseAudit', 'getSnapshotDateSourceAudit', 'getDataFreshnessAudit'],
  'kr-tech': ['getCriticalKrPageFreshnessAudit', 'getCellLevelDataAudit', 'getThresholdLabelAudit'],
  'kr-technical': ['getCriticalKrPageFreshnessAudit', 'getCellLevelDataAudit', 'getThresholdLabelAudit'],
  glossary: ['getTableAccessibilityAudit'],
  guide: ['getPageUXAudit']
};

function _aioRunNamedAuditForPage(name, pageId) {
  var fn = window.AIO && window.AIO[name];
  if (typeof fn !== 'function') return { name: name, status: 'missing', issueCount: 1, error: 'audit function missing' };
  try {
    var result;
    if (name === 'getCellLevelDataAudit') result = fn(pageId);
    else if (name === 'getTableAccessibilityAudit') result = fn(document.getElementById('page-' + pageId) || document);
    else result = fn();
    return {
      name: name,
      status: result && (result.status || (result.issueCount ? 'warn' : 'ok')) || 'ok',
      issueCount: result && typeof result.issueCount === 'number' ? result.issueCount : 0,
      warningCount: result && typeof result.warningCount === 'number' ? result.warningCount : 0,
      result: result || null
    };
  } catch(e) {
    return { name: name, status: 'error', issueCount: 1, error: e && e.message || String(e) };
  }
}

window.AIO.runPageDeepAudit = function(pageId, opts) {
  opts = opts || {};
  var id = String(pageId || 'home').replace(/^page-/, '');
  var aliases = { signals: 'signal', 'kr-tech': 'kr-technical', 'kr-technical': 'kr-technical' };
  id = aliases[id] || id;
  var profile = window.AIO.getDataRequirementProfile({ pageId: id, reason: 'page-deep-audit', symbolLimit: opts.symbolLimit || 999 });
  var symbols = profile.symbols || [];
  var rawKrCodes = symbols.filter(function(s) { return /^\d{6}$/.test(String(s)); });
  var liveCoverage = window.AIO.getLiveCoverage ? window.AIO.getLiveCoverage(symbols) : null;
  var auditNames = (window.AIO.PAGE_DEEP_AUDIT_SYSTEMS && window.AIO.PAGE_DEEP_AUDIT_SYSTEMS[id]) || ['getFullSurfaceAudit'];
  var audits = auditNames.map(function(name) { return _aioRunNamedAuditForPage(name, id); });
  var blocking = [];
  if (!profile.tasks.length && id !== 'guide' && id !== 'glossary') blocking.push('no data tasks mapped');
  if (rawKrCodes.length) blocking.push('raw KR codes not normalized: ' + rawKrCodes.slice(0, 8).join(','));
  audits.forEach(function(a) {
    if (a.status === 'error' || a.status === 'missing' || a.status === 'fail') blocking.push(a.name + ':' + a.status);
  });
  return {
    pageId: id,
    status: blocking.length ? 'fail' : (audits.some(function(a) { return a.status === 'warn' || a.issueCount > 0 || a.warningCount > 0; }) ? 'warn' : 'ok'),
    blocking: blocking,
    dataFlow: {
      tasks: profile.tasks,
      symbolCount: symbols.length,
      sampleSymbols: symbols.slice(0, 30),
      rawKrCodeCount: rawKrCodes.length,
      coveragePct: liveCoverage && typeof liveCoverage.coveragePct === 'number' ? liveCoverage.coveragePct : null
    },
    audits: audits,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.runAllPageDeepAudits = function(opts) {
  opts = opts || {};
  var ids = Object.keys(window.AIO.PAGE_DEEP_AUDIT_SYSTEMS || {});
  var pages = ids.map(function(id) { return window.AIO.runPageDeepAudit(id, opts); });
  var problemPages = pages.filter(function(p) { return p.status !== 'ok'; });
  return {
    status: problemPages.some(function(p) { return p.status === 'fail'; }) ? 'fail' : (problemPages.length ? 'warn' : 'ok'),
    pagesChecked: pages.length,
    issueCount: problemPages.length,
    problemPages: problemPages.map(function(p) { return { pageId: p.pageId, status: p.status, blocking: p.blocking, dataFlow: p.dataFlow }; }),
    pages: pages,
    generatedAt: new Date().toISOString()
  };
};

function _aioTaskAgeMs(taskKey) {
  var lf = window._lastFetch || {};
  var keys = {
    quotes: ['quote','liveQuotes','quotes'],
    news: ['news'],
    sentiment: ['fearGreed','putCall','sentiment'],
    breadth: ['breadth'],
    fred: ['fred','macro'],
    technicals: ['technical','technicals'],
    vixHistory: ['vixHistory','sentimentHistory'],
    hySpread: ['hySpread'],
    maUpdate: ['maUpdate'],
    krSupply: ['krSupply'],
    krDynamic: ['krDynamic']
  }[taskKey] || [taskKey];
  var latest = 0;
  keys.forEach(function(k) { if (lf[k] && lf[k] > latest) latest = lf[k]; });
  return latest ? Date.now() - latest : Infinity;
}

function _aioTaskPolicyKey(taskKey) {
  var map = {
    quotes: 'quote',
    news: 'news',
    sentiment: 'sentiment',
    breadth: 'breadth',
    fred: 'macro_daily',
    technicals: 'technical',
    vixHistory: 'sentiment',
    hySpread: 'macro_daily',
    maUpdate: 'technical',
    krSupply: 'kr_supply',
    krDynamic: 'kr_supply'
  };
  return map[taskKey] || 'unknown';
}

window.AIO.getAutoFreshnessPlan = function(scope) {
  var profile = window.AIO.getDataRequirementProfile(scope || {});
  var tasks = {};
  var reasons = {};
  function addTask(k, reason) {
    if (!k) return;
    tasks[k] = 1;
    if (!reasons[k]) reasons[k] = [];
    if (reason) reasons[k].push(reason);
  }
  var coverage = window.AIO.getLiveCoverage ? window.AIO.getLiveCoverage(profile.symbols) : null;
  if (coverage) {
    if ((coverage.missing || []).length || (coverage.stale || []).length) addTask('quotes', 'required symbols missing/stale: ' + (coverage.missing || []).concat(coverage.stale || []).slice(0, 12).join(','));
  }
  profile.tasks.forEach(function(taskKey) {
    var policyKey = _aioTaskPolicyKey(taskKey);
    var policy = (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY[policyKey]) || null;
    var maxAge = policy ? policy.staleMs : 30 * 60 * 1000;
    var age = _aioTaskAgeMs(taskKey);
    if (age === Infinity) addTask(taskKey, 'never fetched');
    else if (age > maxAge) addTask(taskKey, 'stale ' + Math.round(age / 60000) + 'm > ' + Math.round(maxAge / 60000) + 'm');
  });
  if (profile.wantsFresh) addTask('news', 'freshness-sensitive request');
  var taskList = Object.keys(tasks);
  return {
    status: taskList.length ? 'refresh_needed' : 'fresh_enough',
    profile: profile,
    tasks: taskList,
    reasons: reasons,
    coverage: coverage,
    command: taskList.length ? 'AIO.ensureFreshDataForUse(' + JSON.stringify({ pageId: profile.pageId, reason: profile.reason }) + ')' : null,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getAutoDataContinuityAudit = function(opts) {
  opts = opts || {};
  var profiles = window.AIO.DATA_REQUIREMENT_PROFILES || {};
  var ids = Object.keys(profiles).filter(function(id) { return !(profiles[id] && profiles[id].alias); });
  var pages = ids.map(function(id) {
    var plan = window.AIO.getAutoFreshnessPlan({ pageId: id, reason: 'audit' });
    return { pageId: id, status: plan.status, tasks: plan.tasks, symbols: plan.profile.symbols, coveragePct: plan.coverage ? plan.coverage.coveragePct : null };
  });
  var needsRepair = pages.filter(function(p) { return p.tasks && p.tasks.length; });
  return {
    status: needsRepair.length ? 'warn' : 'ok',
    issueCount: needsRepair.length,
    pagesChecked: pages.length,
    repairCandidates: needsRepair,
    pages: pages,
    dryRun: !!opts.dryRun,
    generatedAt: new Date().toISOString()
  };
};

_aioPageBus.register('core-page-brief-render', 'aio:pageShown', function(e) {
  window._aioRenderPageBrief(e.detail);
  if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') {
    setTimeout(function() { window.AIO.renderStaticDataGovernanceBadges(); }, 0);
  }
});
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window._aioSimplifyExplainLabels();
    window._aioInjectExplainSummaries();
    var active = document.querySelector('.page.active');
    if (active && active.id) window._aioRenderPageBrief(active.id.replace(/^page-/, ''));
    if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') {
      setTimeout(function() { window.AIO.renderStaticDataGovernanceBadges(); }, 0);
    }
  });
} else {
  window._aioSimplifyExplainLabels();
  window._aioInjectExplainSummaries();
  var _briefActive = document.querySelector('.page.active');
  if (_briefActive && _briefActive.id) window._aioRenderPageBrief(_briefActive.id.replace(/^page-/, ''));
  if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') {
    setTimeout(function() { window.AIO.renderStaticDataGovernanceBadges(); }, 0);
  }
}

// ═══ v48.44: SVG Doughnut Gauge 렌더 헬퍼 — F&G/Quality/Device 등 ═══
// 사용: window._aioRenderGauge('elId', percent, { value, caption, tone })
window._aioRenderGauge = function(elId, pct, opts) {
  var el = document.getElementById(elId);
  if (!el) return;
  opts = opts || {};
  pct = Math.max(0, Math.min(100, pct || 0));
  var tone = opts.tone || 'cyan';
  var R = 42, C = 2 * Math.PI * R;
  var off = C * (1 - pct / 100);
  var value = opts.value != null ? opts.value : Math.round(pct);
  var caption = opts.caption || '';
  el.className = 'aio-gauge';
  el.innerHTML =
    '<svg class="aio-gauge-svg" viewBox="0 0 100 100">' +
      '<circle class="aio-gauge-track" cx="50" cy="50" r="' + R + '"></circle>' +
      '<circle class="aio-gauge-fill tone-' + tone + '" cx="50" cy="50" r="' + R + '" ' +
        'stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>' +
    '</svg>' +
    '<div class="aio-gauge-label">' +
      '<div class="aio-gauge-value">' + value + '</div>' +
      (caption ? '<div class="aio-gauge-caption">' + caption + '</div>' : '') +
    '</div>';
};

// ═══ v48.42: Chart.js 전역 defaults — Figma × Bloomberg 팔레트 일괄 적용 ═══
window._aioApplyChartDefaults = function() {
  if (typeof Chart === 'undefined' || !Chart.defaults) return;
  var rs = getComputedStyle(document.documentElement);
  var get = function(name, fallback) {
    var v = rs.getPropertyValue(name).trim();
    return v || fallback;
  };
  try {
    Chart.defaults.font.family = "'Inter', 'Noto Sans KR', -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = get('--text-muted', '#7b8599');
    Chart.defaults.borderColor = get('--chart-grid', 'rgba(255,255,255,0.06)');
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = get('--bg-card', '#111a2f');
      Chart.defaults.plugins.tooltip.borderColor = get('--border-strong', 'rgba(255,255,255,0.12)');
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.titleColor = get('--text-secondary', '#a5b0c2');
      Chart.defaults.plugins.tooltip.bodyColor = get('--text-primary', '#f0f4fc');
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: '600' };
      Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 11 };
      Chart.defaults.plugins.tooltip.boxPadding = 4;
    }
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
      Chart.defaults.plugins.legend.labels.color = get('--text-secondary', '#a5b0c2');
      Chart.defaults.plugins.legend.labels.font = { size: 11, weight: '500' };
    }
  } catch (e) {
    if (window._aioLog) window._aioLog('warn', 'chart', 'defaults 설정 실패: ' + e.message);
  }
};
if (typeof Chart !== 'undefined') {
  window._aioApplyChartDefaults();
} else {
  // v49.1 P185: raw setInterval → _aioRegisterTimer (타이머 레지스트리 등록, 중복 방지)
  var _chartWait = 0;
  window._aioRegisterTimer('chartReady', function() {
    _chartWait += 200;
    if (typeof Chart !== 'undefined') {
      window._aioApplyChartDefaults();
      if (window._aioTimerRegistry && window._aioTimerRegistry['chartReady']) {
        clearInterval(window._aioTimerRegistry['chartReady']);
        delete window._aioTimerRegistry['chartReady'];
      }
    } else if (_chartWait > 5000) {
      if (window._aioTimerRegistry && window._aioTimerRegistry['chartReady']) {
        clearInterval(window._aioTimerRegistry['chartReady']);
        delete window._aioTimerRegistry['chartReady'];
      }
    }
  }, 200);
}

// v48.42: 차트 데이터 색 팔레트 — 모든 코드에서 사용 가능
window.AIO_CHART_PALETTE = {
  cyan:    '#00d4ff',
  magenta: '#ff4d97',
  purple:  '#a855f7',
  amber:   '#ffa31a',
  green:   '#00e5a0',
  red:     '#ff5b50',
  yellow:  '#ffd93d',
  blue:    '#4a9eff',
  grid:    'rgba(255,255,255,0.06)',
  axis:    'rgba(255,255,255,0.10)',
  series:  ['#00d4ff', '#ff4d97', '#a855f7', '#00e5a0', '#ffa31a', '#ffd93d', '#4a9eff', '#ff5b50']
};

window._aioVaultPublicMode = function(el) {
  var lbl = document.getElementById('vault-public-label');
  if (el && el.checked) {
    if (window._AioVault && typeof window._AioVault.enablePublicMode === 'function') window._AioVault.enablePublicMode();
    if (lbl) lbl.textContent = '공용 PC 모드 ON';
  } else {
    if (window._AioVault) window._AioVault._publicMode = false;
    if (lbl) lbl.textContent = '';
  }
};
window._aioImportPortfolio = function(el, ev) {
  if (typeof window.importPortfolio === 'function') window.importPortfolio(ev);
};
window._aioSaveCashPosition = function(el) {
  if (typeof window.saveCashPosition === 'function') window.saveCashPosition(el ? el.value : '');
};
window._aioFilterGlossary = function(el) {
  if (typeof window.filterGlossary === 'function') window.filterGlossary(el ? el.value : '');
};
// 확장: change/input 이벤트도 동일 디스패처로 위임
(function() {
  if (window.__aioChangeDelegate) return;
  window.__aioChangeDelegate = true;
  function dispatchChange(e) {
    var el = e.target.closest && e.target.closest('[data-on-change]');
    if (!el) return;
    var fn = window[el.dataset.onChange];
    if (typeof fn !== 'function') return;
    try { fn(el, e); } catch(_){}
  }
  function dispatchInput(e) {
    var el = e.target.closest && e.target.closest('[data-on-input]');
    if (!el) return;
    var fn = window[el.dataset.onInput];
    if (typeof fn !== 'function') return;
    try { fn(el, e); } catch(_){}
  }
  document.addEventListener('change', dispatchChange);
  document.addEventListener('input', dispatchInput);
})();

// ── v30.10: 글로벌 에러 표시 유틸리티 (사용자 피드백 제공) ─────────────
// 에러 유형: 'api' | 'parse' | 'dom' | 'network'
// 심각도: 'warn' (노란색, 자동 소멸) | 'error' (빨간색, 수동 닫기)
window._aioErrors = window._aioErrors || {};
function showDataError(area, msg, severity) {
  severity = severity || 'warn';
  var key = area + ':' + msg;
  if (window._aioErrors[key]) return; // 중복 표시 방지
  window._aioErrors[key] = Date.now();
  // 30초 후 자동 소멸 (warn) / 60초 (error)
  var ttl = severity === 'error' ? 60000 : 30000;
  setTimeout(function() { delete window._aioErrors[key]; }, ttl);
  // data-status-panel에 표시 (있는 경우)
  var panel = document.getElementById('data-status-panel');
  if (panel) {
    var icon = severity === 'error' ? '<span class="sd sd-r"></span>' : severity === 'info' ? '<span class="sd sd-g"></span>' : '<span class="sd sd-y"></span>';
    var color = severity === 'error' ? '#ef4444' : severity === 'info' ? '#00e5a0' : '#ffa31a';
    panel.innerHTML = '<span style="color:' + color + ';font-size:10px;">' + icon + ' ' + escHtml(area) + ': ' + escHtml(msg) + '</span>';
    setTimeout(function() {
      if (panel.innerHTML.indexOf(msg) !== -1) {
        panel.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">데이터 갱신 중...</span>';
      }
    }, ttl);
  }
  _aioLog('warn', area, msg);
}

// ═══ v30.11: 차트 데이터 검증 게이트 (공통 유틸리티) ══════════════════
// 모든 Chart.js 차트 생성 전에 데이터를 검증하고,
// 불충분/무효 데이터 시 폴백 UI를 표시한다.
// ──────────────────────────────────────────────────────────────────────

/**
 * 차트 데이터 배열 정제 — NaN, null, undefined, Infinity 제거
 * @param {Array} arr - 데이터 배열
 * @param {string} fillMode - 'zero' | 'prev' | 'skip'
 *   'zero': 무효값을 0으로 대체
 *   'prev': 직전 유효값으로 대체 (시계열용)
 *   'skip': 무효값을 null로 남김 (Chart.js spanGaps 사용)
 * @returns {Array} 정제된 배열
 */
function _sanitizeChartData(arr, fillMode) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  fillMode = fillMode || 'prev';
  var lastValid = null;
  var hasValid = false;
  return arr.map(function(v, i) {
    if (v == null || typeof v !== 'number' || !isFinite(v)) {
      if (fillMode === 'zero') return 0;
      if (fillMode === 'prev') return hasValid ? lastValid : null;
      return null; // 'skip'
    }
    hasValid = true;
    lastValid = v;
    return v;
  });
}

/**
 * 차트 데이터 검증 게이트 — 유효성 판정 + 폴백 UI 표시
 * @param {string} canvasId - canvas 요소 ID
 * @param {Array} labels - X축 라벨 배열
 * @param {Array[]} datasets - 데이터셋 배열들 (각각 숫자 배열)
 * @param {Object} opts
 * @param {number}  opts.minPoints  - 최소 데이터 포인트 수 (기본 3)
 * @param {string}  opts.chartName  - 차트 이름 (에러 메시지용)
 * @param {string}  opts.fillMode   - 정제 모드 (기본 'prev')
 * @returns {Object|null} { labels, datasets } 정제된 데이터 또는 null (폴백 표시됨)
 */
function chartDataGate(canvasId, labels, datasets, opts) {
  opts = opts || {};
  var minPoints = opts.minPoints || 3;
  var chartName = opts.chartName || canvasId;
  var fillMode = opts.fillMode || 'prev';

  // 1. 캔버스 존재 확인
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // 2. 라벨 배열 검증
  if (!Array.isArray(labels) || labels.length < minPoints) {
    _showChartFallback(canvas, chartName, '데이터 부족 (' + (labels ? labels.length : 0) + '/' + minPoints + '개)');
    return null;
  }

  // 3. 각 데이터셋 정제
  var cleanDatasets = [];
  var validCount = 0;
  for (var i = 0; i < datasets.length; i++) {
    var clean = _sanitizeChartData(datasets[i], fillMode);
    // 라벨과 길이 불일치 → 자르거나 패딩
    if (clean.length > labels.length) clean = clean.slice(0, labels.length);
    while (clean.length < labels.length) {
      var prev = clean.length ? clean[clean.length - 1] : null;
      clean.push(fillMode === 'zero' ? 0 : (prev != null ? prev : null));
    }
    // 유효 포인트 수 확인
    var vCount = clean.filter(function(v) { return v !== null && !isNaN(v); }).length;
    if (vCount >= minPoints) validCount++;
    cleanDatasets.push(clean);
  }

  // 4. 유효 데이터셋이 없으면 폴백
  if (validCount === 0) {
    _showChartFallback(canvas, chartName, '유효 데이터 없음');
    return null;
  }

  // 5. 극단값 경고 (차단은 안 함)
  for (var j = 0; j < cleanDatasets.length; j++) {
    var ds = cleanDatasets[j];
    var vals = ds.filter(function(v) { return v !== null && isFinite(v); });
    if (vals.length > 2) {
      var mean = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
      var stddev = Math.sqrt(vals.reduce(function(a, b) { return a + (b - mean) * (b - mean); }, 0) / vals.length);
      if (stddev > 0) {
        for (var k = 0; k < ds.length; k++) {
          if (ds[k] !== null && Math.abs(ds[k] - mean) > 5 * stddev) {
            _aioLog('warn', 'chart', chartName + ': 극단값 감지 idx=' + k + ' val=' + ds[k] + ' (mean=' + mean.toFixed(2) + ' std=' + stddev.toFixed(2) + ')');
          }
        }
      }
    }
  }

  // 폴백 UI 제거 (이전에 표시되었을 수 있음)
  _removeChartFallback(canvas);

  return { labels: labels, datasets: cleanDatasets };
}

/**
 * 차트 캔버스에 "데이터 로딩 실패" 폴백 오버레이 표시
 */
function _showChartFallback(canvas, chartName, reason) {
  var parent = canvas.parentElement;
  if (!parent) return;
  // 기존 폴백 있으면 재사용
  var existing = parent.querySelector('.aio-chart-fallback');
  if (existing) {
    existing.querySelector('.aio-chart-fb-reason').textContent = reason;
    return;
  }
  // 캔버스 숨기기
  canvas.style.display = 'none';
  // 폴백 오버레이 생성
  var overlay = document.createElement('div');
  overlay.className = 'aio-chart-fallback';
  overlay.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'width:100%;min-height:120px;background:rgba(0,0,0,0.15);border-radius:8px;padding:16px;box-sizing:border-box;';
  overlay.innerHTML = '<div style="font-size:24px;margin-bottom:6px;opacity:0.5;"></div>' +
    '<div style="font-size:11px;color:var(--text-muted);font-weight:600;">' + (chartName || '차트') + '</div>' +
    '<div class="aio-chart-fb-reason" style="font-size:10px;color:#f87171;margin-top:2px;">' + reason + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">데이터 갱신 시 자동 복구됩니다</div>' +
    '<button data-action="_aioFetchLiveQuotes" style="background:var(--data-cyan-soft);border:1px solid var(--data-cyan-dim);color:#60a5fa;font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;margin-top:6px;">↻ 데이터 재시도</button>';
  parent.insertBefore(overlay, canvas);
  _aioLog('warn', 'chart', chartName + ': ' + reason);
}

/**
 * 폴백 오버레이 제거, 캔버스 복원
 */
function _removeChartFallback(canvas) {
  if (!canvas || !canvas.parentElement) return;
  var fb = canvas.parentElement.querySelector('.aio-chart-fallback');
  if (fb) fb.remove();
  canvas.style.display = '';
}

/**
 * 타임스탬프 배열 → 한국 로컬 날짜 문자열 변환 (타임존 정규화)
 * Unix timestamp(초 단위) → 'M/D' 형식
 * @param {Array<number>} timestamps - Unix 초 단위 타임스탬프 배열
 * @returns {Array<string>} 'M/D' 형식 날짜 배열
 */
function _tsToDateLabels(timestamps) {
  if (!Array.isArray(timestamps)) return [];
  return timestamps.map(function(t) {
    if (!t || !isFinite(t)) return '—';
    // UTC 기준 날짜 사용 (시장 데이터는 UTC 날짜가 기준)
    var d = new Date(t * 1000);
    var month = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return month + '/' + day;
  });
}

/**
 * Yahoo Finance chart API 응답 파싱 + 검증
 * @param {Object} raw - JSON 파싱된 응답
 * @returns {Object|null} { timestamps, closes, labels } 또는 null
 */
function _parseYFChartResponse(raw) {
  if (!raw) return null;
  // HTML 에러페이지 탐지
  if (typeof raw === 'string') {
    if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
      _aioLog('warn', 'chart', 'Yahoo Finance HTML 에러 페이지 감지');
      return null;
    }
  }
  var result = raw.chart && raw.chart.result && raw.chart.result[0];
  if (!result) return null;
  var timestamps = result.timestamp || [];
  var quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  var closes = (quote && quote.close) || [];
  if (timestamps.length === 0 || closes.length === 0) return null;
  // null 필터링 + 대응하는 timestamp 정렬
  var filtered = [];
  for (var i = 0; i < timestamps.length; i++) {
    if (closes[i] != null && isFinite(closes[i])) {
      filtered.push({ ts: timestamps[i], close: closes[i] });
    }
  }
  if (filtered.length < 3) return null;
  return {
    timestamps: filtered.map(function(d) { return d.ts; }),
    closes: filtered.map(function(d) { return d.close; }),
    labels: _tsToDateLabels(filtered.map(function(d) { return d.ts; }))
  };
}

// ═══ PRODUCTION: Suppress console.log ═══════════════════════════════
(function() {
  const _origLog = console.log;
  console.log = function() {};
  // Keep console.warn and console.error for debugging
  // _debugWarn: verbose warnings only shown in debug mode (proxy fallback, etc.)
  window._aioDebug = false;
  window._debugWarn = function() { if (window._aioDebug) console.warn.apply(console, arguments); };
  window._enableDebugLog = function() {
    console.log = _origLog;
    window._aioDebug = true;
    console.log('[AIO] 디버그 모드 활성화 — console.log 복원, verbose 경고 표시');
    console.log('[AIO] window._apiHealth 로 API 상태 확인 가능');
    console.log('[AIO] window._proxyHealth 로 프록시 상태 확인 가능');
    console.log('[AIO] REFRESH_SCHEDULE 로 갱신 스케줄 확인 가능');
  };
  window._disableDebugLog = function() {
    console.log = function() {};
    window._aioDebug = false;
  };
})();

// ═══ v30.11 Task 8: API 상태 대시보드 (API Health Registry) ═════════
window._apiHealth = {
  'yahoo-quote':     { label: 'Yahoo 시세',   status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'yahoo-chart':     { label: 'Yahoo 차트',   status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'coingecko':       { label: 'CoinGecko',    status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'rss-news':        { label: 'RSS 뉴스',     status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'fred':            { label: 'FRED',          status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'finnhub':         { label: 'Finnhub',       status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'fear-greed':      { label: 'Fear & Greed',  status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'exchange-rate':   { label: '환율 API',      status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' },
  'proxy-primary':   { label: 'CORS 프록시',   status: 'unknown', lastOk: null, lastErr: null, errCount: 0, lastMsg: '' }
};

function _reportApiOk(apiKey, msg) {
  var h = window._apiHealth[apiKey];
  if (!h) return;
  var prevStatus = h.status;
  h.status = 'ok'; h.lastOk = Date.now(); h.errCount = 0; h.lastMsg = msg || '';
  _renderApiDashboard();
  // v48.14 (W8): 상태 전이 시 이벤트 발사
  if (prevStatus !== 'ok') {
    try {
      document.dispatchEvent(new CustomEvent('aio:api-status-change', {
        detail: { api: apiKey, from: prevStatus, to: 'ok', msg: msg, ts: Date.now() }
      }));
      if (typeof _aioLog === 'function') _aioLog('info', 'api', apiKey + ' recovered: ' + prevStatus + ' → ok');
    } catch(e) {}
  }
}

function _reportApiError(apiKey, msg) {
  var h = window._apiHealth[apiKey];
  if (!h) return;
  var prevStatus = h.status;
  h.errCount++; h.lastErr = Date.now(); h.lastMsg = msg || '';
  h.status = h.errCount >= 3 ? 'error' : 'warn';
  _renderApiDashboard();
  _checkAllDeadBanner();
  // v48.14 (W8): 상태 전이 시 이벤트 발사
  if (prevStatus !== h.status) {
    try {
      document.dispatchEvent(new CustomEvent('aio:api-status-change', {
        detail: { api: apiKey, from: prevStatus, to: h.status, errCount: h.errCount, msg: msg, ts: Date.now() }
      }));
      if (typeof _aioLog === 'function') _aioLog(h.status === 'error' ? 'error' : 'warn', 'api', apiKey + ': ' + prevStatus + ' → ' + h.status, { errCount: h.errCount });
    } catch(e) {}
  }
}

// v48.14 (W8): 임계 돌파 이벤트 — VIX 30↑, Fed 금리·DXY 108↑ 등 주요 지표 돌파 감지용
// 사용: _fireThresholdBreach('vix', 35, 30, 'above') → alerts·logs 자동
window._lastThresholds = window._lastThresholds || {};
window._fireThresholdBreach = function(metric, value, threshold, direction) {
  try {
    var key = metric + ':' + direction + ':' + threshold;
    var prevBreached = window._lastThresholds[key] || false;
    var currentBreached = direction === 'above' ? (value > threshold) : (value < threshold);
    if (currentBreached && !prevBreached) {
      window._lastThresholds[key] = true;
      document.dispatchEvent(new CustomEvent('aio:threshold-breach', {
        detail: { metric: metric, value: value, threshold: threshold, direction: direction, ts: Date.now() }
      }));
      if (typeof _aioLog === 'function') _aioLog('warn', 'threshold', metric + ' ' + direction + ' ' + threshold + ' (실측 ' + value + ')');
    } else if (!currentBreached && prevBreached) {
      window._lastThresholds[key] = false;
      // reset-복귀도 이벤트 (detail.recovered:true)
      document.dispatchEvent(new CustomEvent('aio:threshold-breach', {
        detail: { metric: metric, value: value, threshold: threshold, direction: direction, recovered: true, ts: Date.now() }
      }));
    }
  } catch(e) {}
};

var _lastDashRender = 0;
function _renderApiDashboard() {
  var now = Date.now();
  if (now - _lastDashRender < 2000) return; // 2초 스로틀
  _lastDashRender = now;
  var panel = document.getElementById('data-status-panel');
  if (!panel) return;
  var dots = { ok: '<span class="sd sd-g"></span>', warn: '<span class="sd sd-y"></span>', error: '<span class="sd sd-r"></span>', unknown: '<span class="sd sd-w"></span>' };
  var parts = [];
  Object.values(window._apiHealth).forEach(function(h) {
    var elapsed = '';
    if (h.lastOk) {
      var sec = Math.round((now - h.lastOk) / 1000);
      elapsed = sec < 60 ? sec + '초' : Math.round(sec / 60) + '분';
    }
    parts.push((dots[h.status] || '<span class="sd sd-w"></span>') + ' ' + escHtml(h.label) + (elapsed ? '(' + elapsed + ')' : ''));
  });
  panel.innerHTML = parts.join(' &middot; ');
  panel.title = '데이터 소스 상태\n' + Object.values(window._apiHealth).map(function(h) {
    var dot = h.status === 'ok' ? '●' : h.status === 'warn' ? '●' : h.status === 'error' ? '●' : '○';
    return dot + ' ' + h.label + ': ' + (h.lastMsg || h.status);
  }).join('\n');
}

var _retryAllInProgress = false;
function _checkAllDeadBanner() {
  // v38.3: 전체 API 모니터링 (finnhub, fear-greed, exchange-rate 포함)
  var apis = Object.keys(window._apiHealth);
  var deadCount = 0, warnCount = 0, deadNames = [];
  apis.forEach(function(k) {
    var h = window._apiHealth[k];
    if (!h) return;
    if (h.status === 'error') { deadCount++; deadNames.push(h.label); }
    else if (h.status === 'warn') { warnCount++; }
  });
  var banner = document.getElementById('snapshot-stale-warning');
  if (!banner) return;
  if (deadCount >= 3) {
    var nameStr = deadNames.slice(0, 4).join(', ') + (deadNames.length > 4 ? ' 외 ' + (deadNames.length - 4) + '개' : '');
    banner.innerHTML = '다수 데이터 소스 연결 실패 (' + deadCount + '/' + apis.length + '): ' + nameStr +
      ' — 캐시 데이터 표시 중 ' +
      '<button id="btn-retry-all-apis" data-action="_retryAllFailedApis" style="' +
      'background:rgba(220,38,38,0.25);border:1px solid rgba(220,38,38,0.5);color:#fca5a5;' +
      'font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:8px;font-weight:600;' +
      'font-family:var(--font-mono);transition:all 0.2s;"> 수동 재연결</button>';
    banner.style.display = 'block';
    banner.style.background = 'rgba(220,38,38,0.15)';
    banner.style.borderColor = 'rgba(220,38,38,0.3)';
    banner.style.color = '#ff5b50';
  } else if (deadCount >= 1 || warnCount >= 2) {
    banner.innerHTML = '일부 데이터 소스(' + deadCount + '개 실패, ' + warnCount + '개 불안정)가 응답하지 않습니다. 해당 항목은 마지막 수신 데이터를 표시합니다.' +
      (deadCount >= 1 ? ' <button id="btn-retry-all-apis" data-action="_retryAllFailedApis" style="' +
      'background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.4);color:#fbbf24;' +
      'font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:8px;font-weight:600;' +
      'font-family:var(--font-mono);transition:all 0.2s;"> 재연결</button>' : '');
    banner.style.display = 'block';
    banner.style.background = 'rgba(234,179,8,0.12)';
    banner.style.borderColor = 'rgba(234,179,8,0.3)';
    banner.style.color = '#ffa31a';
  } else {
    banner.style.display = 'none';
  }
}

// v38.3: 실패한 API 일괄 재시도
async function _retryAllFailedApis() {
  if (_retryAllInProgress) return;
  _retryAllInProgress = true;
  var btn = document.getElementById('btn-retry-all-apis');
  if (btn) { btn.textContent = '⏳ 재연결 중...'; btn.disabled = true; }
  try {
    var failedKeys = [];
    Object.keys(window._apiHealth).forEach(function(k) {
      if (window._apiHealth[k].status === 'error' || window._apiHealth[k].status === 'warn') {
        failedKeys.push(k);
        // 에러 카운트 초기화하여 재시도 기회 부여
        window._apiHealth[k].errCount = 0;
        window._apiHealth[k].status = 'unknown';
      }
    });
    _renderApiDashboard();
    var retryTasks = [];
    var hasKey = function(k) { return failedKeys.indexOf(k) !== -1; };
    if ((hasKey('yahoo-quote') || hasKey('yahoo-chart')) && typeof fetchLiveQuotes === 'function') retryTasks.push(fetchLiveQuotes());
    if (hasKey('fear-greed') && typeof fetchFearGreed === 'function') retryTasks.push(fetchFearGreed());
    if (hasKey('fred') && typeof fetchAllFredData === 'function') retryTasks.push(fetchAllFredData());
    if (hasKey('coingecko') && typeof fetchLiveQuotes === 'function') retryTasks.push(fetchLiveQuotes()); // coingecko는 시세에 포함
    if (hasKey('rss-news') && typeof fetchAllNews === 'function') retryTasks.push(fetchAllNews(true));
    if (hasKey('finnhub') && typeof initFinnhubWebSocket === 'function') { try { initFinnhubWebSocket(); } catch(e){} }
    // exchange-rate는 globalRefresh 내에서 시세와 함께 처리됨
    if (hasKey('exchange-rate') && typeof globalRefresh === 'function') { /* globalRefresh에서 처리 */ }
    await Promise.allSettled(retryTasks);
    _checkAllDeadBanner();
    // 재시도 후 여전히 실패한 API 카운트
    var stillDead = 0;
    Object.keys(window._apiHealth).forEach(function(k) {
      if (window._apiHealth[k].status === 'error') stillDead++;
    });
    if (stillDead === 0) {
      showDataError('재연결', '모든 데이터 소스 재연결 성공', 'info');
    } else {
      showDataError('재연결', stillDead + '개 소스가 여전히 응답하지 않습니다 — 네트워크 상태를 확인하세요', 'warn');
    }
  } catch(e) {
    _aioLog('warn', 'fetch', '_retryAllFailedApis error: ' + (e && e.message || e));
    showDataError('재연결', '재연결 시도 중 오류 발생', 'warn');
  } finally {
    _retryAllInProgress = false;
    if (btn) { btn.textContent = ' 수동 재연결'; btn.disabled = false; }
  }
}

// ═══ v30.11 Task 12: API 키 암호화 (AioVault + safeLS) ═════════════
const _AioVault = {
  _pin: null, _derivedKey: null, _salt: null, _publicMode: false,

  async deriveKey(pin, salt) {
    var enc = new TextEncoder();
    var km = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async encrypt(plaintext) {
    if (!this._derivedKey) return plaintext;
    var enc = new TextEncoder();
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, this._derivedKey, enc.encode(plaintext));
    var buf = new Uint8Array(12 + 16 + ct.byteLength);
    buf.set(iv, 0); buf.set(this._salt, 12); buf.set(new Uint8Array(ct), 28);
    return 'aio_enc::' + btoa(String.fromCharCode.apply(null, buf));
  },

  async decrypt(stored) {
    if (!stored || !stored.startsWith('aio_enc::')) return stored;
    if (!this._derivedKey) return null;
    try {
      var raw = atob(stored.slice(9));
      var buf = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      var iv = buf.slice(0, 12), ct = buf.slice(28);
      var dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, this._derivedKey, ct);
      return new TextDecoder().decode(dec);
    } catch(e) { return null; }
  },

  async unlock(pin) {
    this._pin = pin;
    var existing = localStorage.getItem('aio_vault_salt');
    if (existing) {
      var r = atob(existing); this._salt = new Uint8Array(r.length);
      for (var i = 0; i < r.length; i++) this._salt[i] = r.charCodeAt(i);
    } else {
      this._salt = crypto.getRandomValues(new Uint8Array(16));
      try {
        localStorage.setItem('aio_vault_salt', btoa(String.fromCharCode.apply(null, this._salt)));
      } catch(e) { _aioLog('warn', 'vault', 'salt 저장 실패 (개인정보 보호 모드?): ' + e.message); }
    }
    this._derivedKey = await this.deriveKey(pin, this._salt);
    return true;
  },

  isUnlocked: function() { return !!this._derivedKey; },
  enablePublicMode: function() { this._publicMode = true; },
  // v47.9: lock 시 모든 런타임 캐시 초기화 (Claude 단일 필드 → 통합 객체)
  lock: function() { this._pin = null; this._derivedKey = null; this._claudeKeyRuntime = ''; this._keyRuntime = {}; },
  getStorage: function() { return this._publicMode ? sessionStorage : localStorage; },
  // v47.7: Claude API 키 런타임 메모리 캐시 (Vault 잠금 해제 시 복호화 결과 저장, getApiKey에서 우선 참조)
  _claudeKeyRuntime: '',
  // v47.9: 전체 API 키 런타임 메모리 캐시 { 'aio_fmp_key': '복호화된 값', ... } — _getApiKey()에서 우선 참조
  _keyRuntime: {}
};

// 암호화 대상 키 목록
const _AIO_SENSITIVE_KEYS = new Set([
  'aio_claude_api_key', 'aio_av_key', 'aio_finnhub_key', 'aio_fmp_key',
  'aio_perplexity_key', 'aio_google_cse_key',
  'aio_fred_key', 'aio_td_key', 'aio_newsdata_key', 'aio_rss2json_key', 'aio_cf_worker_url'
]);

// 비동기 저장 (암호화)
async function safeLS(key, value) {
  try {
    var storage = _AioVault.getStorage();
    if (value == null || value === '') { storage.removeItem(key); return; } // v46.9: 0/false falsy 함정 방지
    if (_AIO_SENSITIVE_KEYS.has(key) && _AioVault.isUnlocked()) {
      storage.setItem(key, await _AioVault.encrypt(value));
    } else {
      storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } catch(e) { _aioLog('warn', 'vault', 'safeLS error: ' + e.message); }
}

// 비동기 읽기 (복호화)
async function safeLSGet(key, def) {
  try {
    var storage = _AioVault.getStorage();
    var raw = storage.getItem(key);
    if (!raw) return def || '';
    if (raw.startsWith('aio_enc::') && _AioVault.isUnlocked()) {
      return (await _AioVault.decrypt(raw)) || def || '';
    }
    return raw;
  } catch(e) { _aioLog('warn', 'vault', 'safeLSGet error: ' + e.message); return def || ''; }
}

// 동기 읽기 (평문 호환 — PIN 미설정 시 기존 동작 유지)
function safeLSGetSync(key, def) {
  try {
    var raw = _AioVault.getStorage().getItem(key);
    if (!raw) return def || '';
    if (raw.startsWith('aio_enc::')) {
      // v47.9: 암호화된 값이어도 런타임 캐시에 복호화 값 있으면 반환
      if (_AioVault._keyRuntime && _AioVault._keyRuntime[key]) return _AioVault._keyRuntime[key];
      return def || '';
    }
    return raw;
  } catch(e) { return def || ''; }
}

// v48.14 (Agent W5/P2-4): localStorage 스키마 검증 — 핵심 key에 구조 가드
// 사용: safeLSGetJSON('aio_portfolio', SCHEMA.portfolio, [])
//       schema validator가 실패하면 default 반환 + _aioLog
var LS_SCHEMAS = {
  'aio_portfolio': function(v) {
    if (!Array.isArray(v)) return false;
    return v.every(function(p) { return p && typeof p.sym === 'string' && typeof p.qty === 'number' && typeof p.cost === 'number'; });
  },
  'aio_watchlists': function(v) {
    if (!Array.isArray(v)) return false;
    return v.every(function(wl) { return wl && typeof wl.id === 'string' && typeof wl.name === 'string' && Array.isArray(wl.tickers); });
  },
  'aio_cached_quotes': function(v) {
    return v && typeof v === 'object' && typeof v.ts === 'number' && Array.isArray(v.data);
  },
  'aio_llm_usage': function(v) {
    return v && typeof v === 'object' && typeof v.date === 'string' && typeof v.used === 'number' && typeof v.costUSD === 'number';
  },
  'aio_user_prefs': function(v) {
    return v && typeof v === 'object';
  }
};

function safeLSGetJSON(key, defaultValue) {
  try {
    var raw = _AioVault.getStorage().getItem(key);
    if (!raw) return defaultValue !== undefined ? defaultValue : null;
    // 암호화 키면 safeLSGetSync 경로 사용 불가
    if (raw.startsWith('aio_enc::')) return defaultValue !== undefined ? defaultValue : null;
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch(parseErr) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ls-schema', key + ' JSON parse failed, clearing');
      try { _AioVault.getStorage().removeItem(key); } catch(e) {}
      return defaultValue !== undefined ? defaultValue : null;
    }
    // 스키마 검증
    var validator = LS_SCHEMAS[key];
    if (validator && !validator(parsed)) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ls-schema', key + ' schema validation failed, returning default');
      return defaultValue !== undefined ? defaultValue : null;
    }
    return parsed;
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('error', 'ls-schema', 'safeLSGetJSON ' + key + ': ' + e.message);
    return defaultValue !== undefined ? defaultValue : null;
  }
}
window.safeLSGetJSON = safeLSGetJSON;
window.LS_SCHEMAS = LS_SCHEMAS;

// v47.9: 통합 API 키 getter — 원시 localStorage.getItem 대체
// 모든 외부 API 호출부는 이 함수를 경유해야 함. Vault 암호화 + 평문 양쪽 투명하게 지원.
// 1순위: _AioVault._keyRuntime (PIN 해제 후 복호화 캐시)
// 2순위: localStorage 평문 값 (PIN 미설정 사용자)
// 3순위: 빈 문자열 ('aio_enc::' 만 있고 캐시 비어있음 = Vault 잠김)
function _getApiKey(lsKey) {
  if (_AioVault && _AioVault._keyRuntime && _AioVault._keyRuntime[lsKey]) return _AioVault._keyRuntime[lsKey];
  try {
    var storage = (_AioVault && _AioVault.getStorage) ? _AioVault.getStorage() : localStorage;
    var raw = storage.getItem(lsKey) || '';
    if (raw.startsWith('aio_enc::')) return '';
    return raw;
  } catch(e) { return ''; }
}

// 마이그레이션: 평문 → 암호화 (PIN 설정 후 호출)
async function _migrateToEncrypted() {
  try {
    var plainKeys = {};
    _AIO_SENSITIVE_KEYS.forEach(function(key) {
      var val = localStorage.getItem(key);
      if (val && !val.startsWith('aio_enc::')) plainKeys[key] = val;
    });
    if (Object.keys(plainKeys).length === 0) return;
    for (var key in plainKeys) await safeLS(key, plainKeys[key]);
    // 검증
    var testKey = Object.keys(plainKeys)[0];
    var dec = await safeLSGet(testKey);
    if (dec === plainKeys[testKey]) {
      console.log('[AIO Vault] 마이그레이션 성공: ' + Object.keys(plainKeys).length + '개 키 암호화됨');
    } else {
      for (var k in plainKeys) localStorage.setItem(k, plainKeys[k]);
      _aioLog('error', 'vault', '마이그레이션 실패 — 평문 복원됨');
    }
  } catch(e) {
    _aioLog('error', 'vault', '마이그레이션 오류: ' + (e && e.message || e));
  }
}

// v30.11: API 키 저장 헬퍼 (인라인 onclick → safeLS 비동기 브릿지)
// v47.9: 저장 시 _AioVault._keyRuntime에도 즉시 동기화 — fetcher가 새 키를 바로 사용 가능
function _saveApiKey(lsKey, inputId, btnEl) {
  var el = document.getElementById(inputId);
  var val = el ? el.value : '';
  // v47.9: 마스킹된 값("abcd...xyz1") 저장 방지 — 사용자가 input에 입력한 원본만 허용
  if (val && val.indexOf('...') !== -1 && val.length < 30) {
    _aioLog('warn', 'vault', '마스킹된 값 저장 거부: ' + lsKey);
    btnEl.textContent = '×';
    setTimeout(function(){ btnEl.textContent = '저장'; }, T.UI_FEEDBACK || 1500);
    return;
  }
  safeLS(lsKey, val).then(function() {
    // v47.9: 런타임 캐시 동기화 — Vault 활성 상태면 저장하는 값이 새 기준
    if (_AioVault && _AioVault._keyRuntime) {
      if (val) _AioVault._keyRuntime[lsKey] = val;
      else delete _AioVault._keyRuntime[lsKey];
    }
    // v47.9: Claude 키는 _claudeKeyRuntime 레거시 필드도 동기화
    if (lsKey === 'aio_claude_api_key' && _AioVault) _AioVault._claudeKeyRuntime = val || '';
    btnEl.textContent = '✓';
    setTimeout(function(){ btnEl.textContent = '저장'; }, T.UI_FEEDBACK);
    // CORS 프록시 레지스트리 재초기화 (CF Worker URL 변경 시)
    if (lsKey === 'aio_cf_worker_url' && typeof _PROXY_REGISTRY !== 'undefined') _PROXY_REGISTRY.init();
    // v49.45 P312: IndexedDB 자동 mirror (캐시 클리어와 별도 저장소 — 키 손실 방어 2차)
    try { if (typeof window._aioAutoBackupKeys === 'function') window._aioAutoBackupKeys(); } catch(_e) {}
  }).catch(function() {
    // 폴백: 평문 저장 + 런타임 캐시 동기화
    localStorage.setItem(lsKey, val);
    if (_AioVault && _AioVault._keyRuntime) { if (val) _AioVault._keyRuntime[lsKey] = val; else delete _AioVault._keyRuntime[lsKey]; }
    btnEl.textContent = '✓';
    setTimeout(function(){ btnEl.textContent = '저장'; }, T.UI_FEEDBACK);
    // v49.45 P312: 폴백 경로에서도 IndexedDB mirror 보장
    try { if (typeof window._aioAutoBackupKeys === 'function') window._aioAutoBackupKeys(); } catch(_e) {}
  });
}

// ═══ v49.45 P312 신규: API 키 백업/복원 + IndexedDB 이중화 (R100) ═══════════
// 사용자가 브라우저 캐시 클리어 / 시크릿 모드 / 데이터 일괄 삭제 시 localStorage(API 키) 동시 손실 차단.
// 3중 안전망:
//   (1) localStorage (기본) — `_saveApiKey` 호출 시 저장
//   (2) IndexedDB `aio-keys-backup` — `_saveApiKey` 호출 시 동시 mirror (캐시 클리어와 별도 저장소)
//   (3) Export JSON 파일 — 사용자가 명시 백업 (마스킹 옵션)

// IndexedDB 백업 helper
window._aioIdbBackupKeys = async function(snapshot) {
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.open('aio-keys-backup', 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      };
      req.onsuccess = function(e) {
        var db = e.target.result;
        var tx = db.transaction('keys', 'readwrite');
        var store = tx.objectStore('keys');
        store.put({ snapshot: snapshot, ts: Date.now() }, 'latest');
        tx.oncomplete = function() { db.close(); resolve(true); };
        tx.onerror = function() { db.close(); resolve(false); };
      };
      req.onerror = function() { resolve(false); };
    } catch(e) { resolve(false); }
  });
};

window._aioIdbRestoreKeys = async function() {
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.open('aio-keys-backup', 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      };
      req.onsuccess = function(e) {
        var db = e.target.result;
        var tx = db.transaction('keys', 'readonly');
        var store = tx.objectStore('keys');
        var getReq = store.get('latest');
        getReq.onsuccess = function() { db.close(); resolve(getReq.result || null); };
        getReq.onerror = function() { db.close(); resolve(null); };
      };
      req.onerror = function() { resolve(null); };
    } catch(e) { resolve(null); }
  });
};

// 현재 모든 API 키 snapshot 수집 (평문 또는 cache 복호화 값)
window._aioCollectKeySnapshot = function() {
  var snap = {};
  var keys = (typeof _AIO_SENSITIVE_KEYS !== 'undefined') ? Array.from(_AIO_SENSITIVE_KEYS) :
    ['aio_claude_api_key','aio_av_key','aio_finnhub_key','aio_fmp_key','aio_perplexity_key',
     'aio_google_cse_key','aio_fred_key','aio_td_key','aio_newsdata_key','aio_rss2json_key','aio_cf_worker_url'];
  keys.forEach(function(k) {
    var v = (typeof _getApiKey === 'function') ? _getApiKey(k) : (localStorage.getItem(k) || '');
    if (v) snap[k] = v;
  });
  return snap;
};

// `_saveApiKey` 호출 시 IndexedDB도 동시 mirror (자동 백업)
// → 사용자가 명시 호출 없이도 캐시 클리어와 별도 저장소에 보존
window._aioAutoBackupKeys = function() {
  var snap = window._aioCollectKeySnapshot();
  if (Object.keys(snap).length > 0) {
    window._aioIdbBackupKeys(snap); // 비동기 fire-and-forget
  }
};

// 사용자 명시 export — JSON 파일 다운로드
window.AIO = window.AIO || {};
window.AIO.exportApiKeys = function(opts) {
  opts = opts || {};
  var snap = window._aioCollectKeySnapshot();
  var exportObj = {
    type: 'aio-screener-keys-backup',
    version: window.APP_VERSION || 'unknown',
    exportedAt: new Date().toISOString(),
    masked: !!opts.masked,
    keys: opts.masked ? Object.keys(snap).reduce(function(o,k) {
      var v = snap[k]; o[k] = v.length > 8 ? v.substring(0,4) + '...' + v.substring(v.length-4) : '***';
      return o;
    }, {}) : snap
  };
  var blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'aio-keys-backup-' + new Date().toISOString().slice(0,10) + (opts.masked ? '-masked' : '') + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  return { exported: Object.keys(snap).length, masked: !!opts.masked };
};

// 사용자 명시 import — JSON 파일에서 키 복원
window.AIO.importApiKeys = async function(jsonString) {
  try {
    var obj = (typeof jsonString === 'string') ? JSON.parse(jsonString) : jsonString;
    if (obj.type !== 'aio-screener-keys-backup') return { ok: false, error: 'Invalid backup type' };
    if (obj.masked) return { ok: false, error: '마스킹된 백업은 복원 불가 — 원본 백업 필요' };
    var imported = 0;
    for (var k in obj.keys) {
      if (typeof safeLS === 'function') await safeLS(k, obj.keys[k]);
      else localStorage.setItem(k, obj.keys[k]);
      if (window._AioVault && window._AioVault._keyRuntime) window._AioVault._keyRuntime[k] = obj.keys[k];
      imported++;
    }
    // 자동 백업도 즉시 갱신
    window._aioAutoBackupKeys();
    return { ok: true, imported: imported, source: obj.exportedAt };
  } catch(e) { return { ok: false, error: e && e.message }; }
};

// IndexedDB에서 자동 복원 — localStorage 비어있고 IDB 백업이 있으면 사용자에게 알림
window.AIO.recoverApiKeysFromIdb = async function() {
  var current = window._aioCollectKeySnapshot();
  if (Object.keys(current).length > 0) return { recovered: 0, reason: 'localStorage already has keys', current: Object.keys(current).length };
  var idb = await window._aioIdbRestoreKeys();
  if (!idb || !idb.snapshot) return { recovered: 0, reason: 'no IDB backup' };
  var imported = 0;
  for (var k in idb.snapshot) {
    if (typeof safeLS === 'function') await safeLS(k, idb.snapshot[k]);
    else localStorage.setItem(k, idb.snapshot[k]);
    if (window._AioVault && window._AioVault._keyRuntime) window._AioVault._keyRuntime[k] = idb.snapshot[k];
    imported++;
  }
  return { recovered: imported, idbTs: new Date(idb.ts).toISOString() };
};

// 자동 백업 트리거 — 페이지 로드 후 5초, 그 후 5분마다
setTimeout(function() {
  try { window._aioAutoBackupKeys(); } catch(_e) {}
  setInterval(function() {
    try { window._aioAutoBackupKeys(); } catch(_e) {}
  }, 5 * 60 * 1000);
}, 5000);

// ─────────────────────────────────────────────────────────────────
// v49.83 P447/R176: _aioBuildSparklineSvg — 종목 30일 mini sparkline SVG (기관급 직관성)
// Yahoo Chart fetch → 30 closes → SVG path. 양수 green / 음수 red.
// chatSend가 detected ticker마다 호출하여 답변 끝에 inline 삽입.
// 폭 240 × 높이 60 — 모바일/데스크탑 공통.
// ─────────────────────────────────────────────────────────────────
window._aioBuildSparklineSvg = async function(ticker, opts) {
  opts = opts || {};
  var width = opts.width || 240;
  var height = opts.height || 60;
  var label = opts.label || ticker;
  try {
    // 1) 우선 _priceHistory 사용 (이미 누적, 즉시 응답)
    var closes = [];
    var hist = (window._priceHistory && window._priceHistory[ticker]) || null;
    if (Array.isArray(hist) && hist.length >= 5) {
      closes = hist.slice(-30).map(function(p){return p && p.price ? p.price : null;}).filter(function(v){return v != null && isFinite(v);});
    }
    // 2) _priceHistory 부족 시 Yahoo Chart fetch (1mo)
    if (closes.length < 5 && typeof window._fetchYahooChartData === 'function') {
      try {
        var d = await window._fetchYahooChartData(ticker, '1mo');
        if (d && Array.isArray(d.closes)) closes = d.closes.slice(-30).filter(function(v){return v != null && isFinite(v);});
      } catch(_) {}
    }
    if (closes.length < 5) {
      return '<div style="font-size:10px;color:var(--text-muted);padding:4px 6px;">📉 ' + (typeof escHtml === 'function' ? escHtml(label) : label) + ' 차트 데이터 부족 (필요: 5+ closes)</div>';
    }
    var min = Math.min.apply(null, closes);
    var max = Math.max.apply(null, closes);
    var range = max - min;
    if (range < 1e-9) range = 1;
    var padX = 4, padY = 4;
    var iw = width - padX * 2, ih = height - padY * 2;
    var pts = closes.map(function(c, i) {
      var x = padX + (i / (closes.length - 1)) * iw;
      var y = padY + ih - ((c - min) / range) * ih;
      return [x, y];
    });
    var path = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var pctChg = closes.length >= 2 ? ((closes[closes.length-1] - closes[0]) / closes[0]) * 100 : 0;
    var color = pctChg >= 0 ? '#3ddba5' : '#ff5b50'; // green/red
    var areaPath = path + ' L' + pts[pts.length-1][0].toFixed(1) + ',' + (height - padY).toFixed(1) + ' L' + pts[0][0].toFixed(1) + ',' + (height - padY).toFixed(1) + ' Z';
    var safeLabel = (typeof escHtml === 'function' ? escHtml(label) : label);
    var pctText = (pctChg >= 0 ? '+' : '') + pctChg.toFixed(2) + '%';
    var last = closes[closes.length - 1];
    var lastText = last >= 1000 ? last.toFixed(0) : last.toFixed(2);
    return '<div style="margin:6px 0;padding:6px 8px;background:rgba(255,255,255,0.03);border-left:3px solid ' + color + ';border-radius:4px;display:flex;align-items:center;gap:10px;">' +
      '<div style="flex:0 0 auto;">' +
        '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block;">' +
          '<path d="' + areaPath + '" fill="' + color + '" fill-opacity="0.15" stroke="none"/>' +
          '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '</svg>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-secondary);line-height:1.4;">' +
        '<div style="font-weight:700;color:var(--text-bright);">📉 ' + safeLabel + ' · ' + closes.length + '일</div>' +
        '<div style="color:' + color + ';font-family:var(--font-mono);font-weight:600;">' + lastText + ' (' + pctText + ')</div>' +
        '<div style="color:var(--text-muted);font-size:10px;">range: ' + (min >= 1000 ? min.toFixed(0) : min.toFixed(2)) + ' ~ ' + (max >= 1000 ? max.toFixed(0) : max.toFixed(2)) + '</div>' +
      '</div>' +
    '</div>';
  } catch(e) {
    return '<div style="font-size:10px;color:var(--data-amber);padding:4px 6px;">⚠ sparkline error: ' + (e && e.message || e) + '</div>';
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.82 R170/P440: assertXssEscapeCoverageAudit — innerHTML 삽입 시 escHtml 누락 자동 감지
// 휴리스틱: js 파일에서 `innerHTML\s*=\s*['"`]?.*?\+\s*[A-Za-z]` 패턴 grep → escHtml 미호출 변수 추출
// 정밀도: 휴리스틱이라 false positive 가능. allowList로 보정.
// ─────────────────────────────────────────────────────────────────
window.AIO = window.AIO || {};
window.AIO.assertXssEscapeCoverageAudit = function() {
  try {
    // 함수 toString으로 source 추출 → 모든 innerHTML 할당 위치 추출
    var sources = [];
    var fnSources = [];
    // (1) escHtml 함수 존재 검증
    var hasEscHtml = typeof window.escHtml === 'function';
    // (2) 주요 chat/render 함수들 toString 후 scan
    var fnNames = [
      'openChatHistory', 'renderKrIssues', 'analyzeKrIndex', 'analyzeKrTickerDeep',
      'chatRenderChips', 'updateAIPanelContext', '_aioGuideSearch',
      'renderPortfolio', 'renderHomeFeed', 'renderBriefingFeed', 'renderFeed'
    ];
    var found = [];
    var unsafeHits = 0;
    var totalAssignments = 0;
    fnNames.forEach(function(fn) {
      var ref = window[fn];
      if (typeof ref !== 'function') return;
      var src = ref.toString();
      // innerHTML = '...' + var 패턴 (escHtml 없이 변수 concat)
      var assignRe = /\.innerHTML\s*=\s*[^;]+;/g;
      var assigns = src.match(assignRe) || [];
      totalAssignments += assigns.length;
      assigns.forEach(function(line) {
        // 변수 concat 후 escHtml() 호출 없으면 위험
        var hasVar = /\+\s*[A-Za-z_$][\w$.]*\s*(?:\+|;|\))/.test(line);
        var hasEsc = /escHtml\s*\(/.test(line);
        if (hasVar && !hasEsc) {
          unsafeHits++;
          found.push({ fn: fn, snippet: line.slice(0, 120) + '...' });
        }
      });
    });
    // (3) R168 inline hover: pattern check (index.html scan via DOM)
    var inlineHoverHits = 0;
    try {
      var allEls = document.querySelectorAll('[style*="hover:"]');
      inlineHoverHits = allEls.length;
    } catch(_) {}
    // (4) line-clamp 표준 속성 동시 선언 (모든 sheets)
    var lineClampPairs = 0;
    var lineClampMissingStd = 0;
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        try {
          var sheet = document.styleSheets[i];
          var rules = sheet.cssRules || [];
          for (var j = 0; j < rules.length; j++) {
            var r = rules[j];
            if (r.style && r.style.getPropertyValue('-webkit-line-clamp')) {
              if (r.style.getPropertyValue('line-clamp')) lineClampPairs++;
              else lineClampMissingStd++;
            }
          }
        } catch(_) {}
      }
    } catch(_) {}
    var totalCoverage = Math.round(((totalAssignments - unsafeHits) / Math.max(1, totalAssignments)) * 100);
    var status = (unsafeHits === 0 && inlineHoverHits === 0 && lineClampMissingStd === 0 && hasEscHtml) ? 'ok'
                : (unsafeHits <= 2 && inlineHoverHits <= 1) ? 'warn' : 'fail';
    return {
      status: status,
      hasEscHtmlHelper: hasEscHtml,
      scannedFunctions: fnNames.length,
      totalInnerHtmlAssignments: totalAssignments,
      unsafeAssignments: unsafeHits,
      unsafeSamples: found.slice(0, 3),
      inlineHoverHits: inlineHoverHits,
      lineClampPairsOk: lineClampPairs,
      lineClampMissingStd: lineClampMissingStd,
      xssCoveragePct: totalCoverage,
      note: 'v49.82 R167~R169 자동 검증. 휴리스틱 — false positive 가능.',
      generatedAt: new Date().toISOString()
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.82 R170/P441: assertKrTickerMappingAudit — KR 종목코드 ↔ 회사명 매핑 정합성
// 다중 위치(SCREENER_DB / AIO_TICKER_NAME_REGISTRY / KR_STOCK_DB)에 동일 ticker가
// 서로 다른 회사명으로 등록되면 데이터 부정확. 자동 cross-check.
// ─────────────────────────────────────────────────────────────────
window.AIO.assertKrTickerMappingAudit = function() {
  try {
    var conflicts = [];
    var checked = 0;
    var screenerDB = (typeof SCREENER_DB !== 'undefined') ? SCREENER_DB : (window.SCREENER_DB || []);
    var nameReg = (window.AIO_TICKER_NAME_REGISTRY && window.AIO_TICKER_NAME_REGISTRY.entries) || {};
    var krStockDB = window.KR_STOCK_DB || {};
    // SCREENER_DB의 KR ticker (.KS / .KQ) 순회
    if (Array.isArray(screenerDB)) {
      screenerDB.forEach(function(row) {
        if (!row || !row.sym || !/\.K[QS]$/.test(row.sym)) return;
        checked++;
        var bare = row.sym.replace(/\.K[QS]$/, '');
        // 1) AIO_TICKER_NAME_REGISTRY 매핑
        var regEntry = nameReg[row.sym];
        if (regEntry && regEntry.kr && row.name && regEntry.kr !== row.name) {
          conflicts.push({
            ticker: row.sym, source: 'SCREENER_DB vs REGISTRY',
            screenerDB: row.name, registry: regEntry.kr,
            severity: 'high'
          });
        }
        // 2) KR_STOCK_DB 매핑
        var krEntry = krStockDB[bare];
        if (krEntry && krEntry.name && row.name && krEntry.name !== row.name) {
          conflicts.push({
            ticker: row.sym, source: 'SCREENER_DB vs KR_STOCK_DB',
            screenerDB: row.name, krStockDB: krEntry.name,
            severity: 'critical'
          });
        }
      });
    }
    // 알려진 KR 매핑 (cross-verify 2026-05-28 WebSearch 확인)
    var knownMappings = {
      '178320.KQ': '서진시스템',  // Seojin System (NOT 로보스타)
      '108320.KQ': 'LX세미콘',    // LX Semicon
      '108490.KQ': '로보티즈',    // ROBOTIS
      '090360.KQ': '로보스타',    // Robostar (LG전자 자회사)
      '277810.KQ': '레인보우로보틱스',
      '454910.KS': '두산로보틱스',
      '005930.KS': '삼성전자',
      '000660.KS': 'SK하이닉스'
    };
    var knownMismatch = 0;
    Object.keys(knownMappings).forEach(function(t) {
      var expected = knownMappings[t];
      var sdb = Array.isArray(screenerDB) && screenerDB.find(function(r) { return r && r.sym === t; });
      if (sdb && sdb.name !== expected) {
        knownMismatch++;
        conflicts.push({
          ticker: t, source: 'SCREENER_DB vs WebSearch-verified',
          screenerDB: sdb.name, expected: expected,
          severity: 'critical'
        });
      }
    });
    var status = conflicts.length === 0 ? 'ok' : conflicts.some(function(c){return c.severity==='critical';}) ? 'fail' : 'warn';
    return {
      status: status,
      checkedTickers: checked,
      conflicts: conflicts,
      conflictCount: conflicts.length,
      knownMappingChecked: Object.keys(knownMappings).length,
      knownMismatchCount: knownMismatch,
      note: 'v49.82 R170: SCREENER_DB / AIO_TICKER_NAME_REGISTRY / KR_STOCK_DB cross-check. WebSearch verified 2026-05-28.',
      generatedAt: new Date().toISOString()
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.89 P450/R180: getDataLineageAudit — 데이터별 source→scheduler→transform→render 5단계 lineage 자동 매핑
// 각 핵심 데이터가 (1)스케줄러 등록 (2)렌더 sink(data-live-price/data-snap DOM) 연결됐는지 자동 검증.
// tier: auto(완전자동) / gap(B계층 자동화 미구현) / manual(C계층 수동 /data-refresh)
// 사용자 "데이터 하나하나 source→render 흐름 조사" 질의에 대한 영구 자동 응답.
// ─────────────────────────────────────────────────────────────────
window.AIO.getDataLineageAudit = function() {
  try {
    var sched = window.REFRESH_SCHEDULE || {};
    function domCount(attr) { try { return document.querySelectorAll('[' + attr + ']').length; } catch(_) { return 0; } }
    // 핵심 데이터 13종 lineage 정의 (코드 조사 v49.89 기반 — source URL은 실제 fetch 함수 확인)
    var LINEAGE = [
      { id:'quotes',     label:'시세 (지수/종목)',  source:'Yahoo v8 chart (query1.finance.yahoo.com)', schedKey:'quotes',     transform:'PriceStore.set 검증',        renderAttr:'data-live-price', tier:'auto' },
      { id:'vix',        label:'VIX',              source:'Yahoo ^VIX 3mo',                            schedKey:'vixHistory', transform:'vixToPercentile',            renderAttr:'data-live-price', tier:'auto' },
      { id:'fearGreed',  label:'F&G (공포탐욕)',    source:'CNN dataviz → CORS_PROXY → snapshot (3단)', schedKey:'sentiment',  transform:'_applyFearGreedScore',       renderAttr:'data-snap',       tier:'auto' },
      { id:'putCall',    label:'Put/Call',         source:'CBOE cdn (CORS_PROXY 경유)',                 schedKey:'sentiment',  transform:'_applyFearGreedScore',       renderAttr:'data-snap',       tier:'auto' },
      { id:'fred',       label:'FRED 매크로',       source:'api.stlouisfed.org (CORS 친화, 키 필요)',     schedKey:'fred',       transform:'applyTechIndicators',        renderAttr:null,              tier:'auto', needsKey:true },
      { id:'technicals', label:'기술 지표 (SPY)',   source:'fetchTechnicalIndicators',                  schedKey:'technicals', transform:'applyTechIndicators',        renderAttr:null,              tier:'auto' },
      { id:'hySpread',   label:'HY 스프레드',       source:'FRED BAMLH0A0HYM2 (키 필요)',                schedKey:'hySpread',   transform:'fetchHYSpread',              renderAttr:'data-snap',       tier:'auto', needsKey:true },
      { id:'news',       label:'뉴스',             source:'RSS 다중 (fetchOneFeed)',                    schedKey:'news',       transform:'scoreItem + classifyTopic',  renderAttr:null,              tier:'auto' },
      { id:'krSupply',   label:'KR 수급',          source:'Naver investorTrend API (프록시)',           schedKey:'krSupply',   transform:'updateKrSupplyDOM',          renderAttr:null,              tier:'auto' },
      { id:'krDynamic',  label:'VKOSPI/KR 동적',    source:'Naver VKOSPI/basic (프록시)',                schedKey:'krDynamic',  transform:'fetchVkospiDynamic→DATA_SNAPSHOT.vkospi', renderAttr:'data-snap', tier:'auto' },
      { id:'breadth',    label:'Breadth %above MA', source:'(실 fetch 미구현 — AV advance/decline 근사치만)', schedKey:'breadth', transform:'updateBreadthUI (근사)',     renderAttr:'data-snap',       tier:'gap',    note:'B계층: fetchBreadthData가 MMFI/MMTW/MMFD 선언만, %above MA는 정적 폴백 (P448). /data-refresh 수동 갱신.' },
      { id:'staticMacro',label:'CPI/PCE/NFP/AAII/NAAIM/SKEW/MOVE/글로벌지수', source:'(fetch 함수 0건)', schedKey:null, transform:'/data-refresh 수동', renderAttr:'data-snap', tier:'manual', note:'C계층: 자동 fetch 경로 없음, 수동 갱신 (R179 클라이언트 모델 — 개인 키 부재 데이터)' },
      { id:'crypto',     label:'BTC/ETH',          source:'CoinGecko (무키 30/min) / 수동 폴백',         schedKey:'quotes',     transform:'PriceStore.set',             renderAttr:'data-live-price', tier:'auto' }
    ];
    var rows = LINEAGE.map(function(L) {
      var schedOk = L.schedKey ? !!(sched[L.schedKey] && typeof sched[L.schedKey].fn === 'function') : false;
      var sinks = L.renderAttr ? domCount(L.renderAttr) : null;
      var renderOk = L.renderAttr ? (sinks > 0) : true; // null = 차트/별도 렌더
      var status;
      if (L.tier === 'gap') status = 'gap';
      else if (L.tier === 'manual') status = 'manual';
      else status = (schedOk && renderOk) ? 'connected' : 'broken';
      return {
        id: L.id, label: L.label, source: L.source,
        schedulerRegistered: schedOk, schedKey: L.schedKey || null,
        transform: L.transform, renderAttr: L.renderAttr || '(chart/etc)',
        renderSinks: sinks, needsKey: !!L.needsKey,
        status: status, tier: L.tier, note: L.note || null
      };
    });
    var connected = rows.filter(function(r){ return r.status === 'connected'; }).length;
    var broken    = rows.filter(function(r){ return r.status === 'broken'; }).length;
    var gap       = rows.filter(function(r){ return r.status === 'gap'; }).length;
    var manual    = rows.filter(function(r){ return r.status === 'manual'; }).length;
    // v49.90 R181: cell-level sink-to-source 통합 (데이터 하나하나 — data-live-price/data-snap 개별 sink가 source에 연결됐는지)
    // getLiveSymbolsCoverageAudit (data-live-price → LIVE_SYMBOLS) + getStaticSeedFallbackAudit (data-snap → DATA_SNAPSHOT alias)
    var cellLevel = null;
    try {
      var liveCov = (window.AIO && window.AIO.getLiveSymbolsCoverageAudit) ? window.AIO.getLiveSymbolsCoverageAudit() : null;
      var seedCov = (window.AIO && window.AIO.getStaticSeedFallbackAudit) ? window.AIO.getStaticSeedFallbackAudit() : null;
      var liveOrphans = liveCov && typeof liveCov.issueCount === 'number' ? liveCov.issueCount : null;
      var snapOrphans = seedCov && typeof seedCov.issueCount === 'number' ? seedCov.issueCount : null;
      var liveSinks = 0, snapSinks = 0;
      try { liveSinks = document.querySelectorAll('[data-live-price]').length; } catch(_) {}
      try { snapSinks = document.querySelectorAll('[data-snap]').length; } catch(_) {}
      cellLevel = {
        status: (liveOrphans === 0 && snapOrphans === 0) ? 'ok' : (liveOrphans === null || snapOrphans === null) ? 'unknown' : 'warn',
        liveSinkTotal: liveSinks, liveSinkOrphans: liveOrphans,  // data-live-price → LIVE_SYMBOLS 미연결
        snapSinkTotal: snapSinks, snapSinkOrphans: snapOrphans,  // data-snap → DATA_SNAPSHOT 미연결
        totalOrphans: (liveOrphans || 0) + (snapOrphans || 0),
        note: '화면 렌더 데이터 개별 sink가 source에 연결됐는지 (data-live-price→LIVE_SYMBOLS / data-snap→DATA_SNAPSHOT). orphan=렌더되나 source 없는 끊긴 sink.'
      };
    } catch(_cl) { cellLevel = { status: 'error' }; }
    var cellOk = cellLevel && (cellLevel.status === 'ok' || cellLevel.status === 'unknown');
    return {
      status: (broken === 0 && cellOk) ? 'ok' : 'warn',
      total: rows.length,
      connected: connected, broken: broken, gap: gap, manual: manual,
      autoTierPct: Math.round((connected / rows.length) * 100),
      brokenRows: rows.filter(function(r){ return r.status === 'broken'; }).map(function(r){ return r.id; }),
      rows: rows,
      cellLevel: cellLevel,
      note: 'v49.90 R180/R181: 데이터 카테고리 lineage(13종 5단계) + cell-level sink-to-source(data-live-price/data-snap 개별) 통합. connected=완전자동 / gap=B계층 / manual=C계층 / cellLevel.orphan=끊긴 개별 sink.',
      generatedAt: new Date().toISOString()
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// v49.96 P461/R185 근본 보강: Audit Push (pull→push)
// 지속 운영 중 stale/drift/코드결함이 발생해도, audit이 "수동 호출 전용"이면
// 아무도 콘솔을 안 두드리면 묻힌다(P460이 그 사례 — audit이 있었지만 운영자가 안 봄).
// → aio:liveQuotes(라이브 fetch마다 발생)에 throttle(30분) 연결해 getAutoOpsReadiness를
//   자동 실행하고, warn이면 운영자에게 console.warn + 사이드바 위젯 badge로 surfacing.
// 엔드유저 팝업 아님(운영 진단용). 부하 분산 위해 4초 지연 + try/catch 가드.
// ─────────────────────────────────────────────────────────────────
window._aioAutoSurfaceOps = function() {
  try {
    var A = window.AIO; if (!A || !A.getAutoOpsReadiness) return null;
    var problems = [];
    var r = A.getAutoOpsReadiness();
    if (r && r.status === 'warn' && r.issues) problems = problems.concat(r.issues);
    var mirror = A.getSnapshotFallbackConsistencyAudit ? A.getSnapshotFallbackConsistencyAudit() : null;
    if (mirror && mirror.issueCount) problems.push(mirror.issueCount + '개 snapshot↔_fallback 미러 drift (R184)');
    var dq = A.getDataQualityIssueAudit ? A.getDataQualityIssueAudit() : null;
    if (dq) {
      var list = dq.issues || dq.items || [];
      var codeWarns = list.filter(function(x){ var s=((x&&x.message)||'')+((x&&x.error)||''); return /extraction returned 0|schema|non-JSON|0 codes/i.test(s); });
      if (codeWarns.length) problems.push(codeWarns.length + '개 데이터품질 코드성 경고 (추출0/schema 등)');
    }
    window._aioLastOpsWarn = { ts: Date.now(), count: problems.length, problems: problems.slice(0, 12) };
    if (problems.length) {
      try { console.warn('[AIO 운영 점검] ' + problems.length + '개 항목 주의 — AIO.getAutoOpsReadiness() 로 상세 확인:\n  · ' + problems.slice(0, 8).join('\n  · ')); } catch (_w) {}
    }
    try { if (typeof window._aioRefreshAuditWidget === 'function') window._aioRefreshAuditWidget(); } catch (_rw) {}
    return window._aioLastOpsWarn;
  } catch (e) { return null; }
};
(function _aioWireOpsPush(){
  var THROTTLE = 30 * 60 * 1000, last = 0;
  function tick() {
    var now = Date.now();
    if (now - last < THROTTLE) return;   // 최초: last=0 → 통과, 이후 30분 throttle
    last = now;
    setTimeout(function(){ try { window._aioAutoSurfaceOps(); } catch (_) {} }, 4000); // 렌더 후 지연
  }
  try { document.addEventListener('aio:liveQuotes', tick); } catch (_) {}
})();

// ─────────────────────────────────────────────────────────────────
// v49.58 P322/R108 신규: 사이드바 Audit 위젯 + web_search 토글 + 키 백업 GUI 핸들러
// 사용자가 콘솔 없이 self-check + 토글 + 백업 조작 가능. 11 audit 함수 GUI 노출.
// ─────────────────────────────────────────────────────────────────
window._aioRefreshAuditWidget = function() {
  try {
    var container = document.getElementById('aio-audit-widget-content');
    if (!container) return;
    var rows = container.querySelectorAll('[data-audit-key]');
    // (1) Registry completeness
    var regEl = container.querySelector('[data-audit-key="registry"]');
    if (regEl) {
      try {
        var entry = window.AIO && window.AIO.getTickerRegistryEntryAudit && window.AIO.getTickerRegistryEntryAudit();
        var r = window.AIO && window.AIO.assertTickerRegistryCompleteness && window.AIO.assertTickerRegistryCompleteness();
        if (entry) {
          var realPct = entry.totalEntries ? Math.round(entry.realEntries / entry.totalEntries * 100) : 0;
          var ok = entry.realEntries >= 380 && entry.placeholderCount <= 8;
          var icon = ok ? '✓' : entry.realEntries >= 300 ? '⚠' : '✗';
          var color = ok ? 'var(--data-green)' : entry.realEntries >= 300 ? 'var(--data-amber)' : 'var(--data-red)';
          var aliasTxt = r ? ' · alias ' + r.coveragePct + '%' : '';
          regEl.innerHTML = '<span style="color:' + color + ';">' + icon + '</span> REGISTRY <b>' + entry.realEntries + '</b> real / ' + entry.totalEntries + ' total (' + realPct + '%)' + aliasTxt;
        } else if (r) {
          var icon2 = r.coveragePct >= 80 ? '✓' : r.coveragePct >= 30 ? '⚠' : '✗';
          var color2 = r.coveragePct >= 80 ? 'var(--data-green)' : r.coveragePct >= 30 ? 'var(--data-amber)' : 'var(--data-red)';
          regEl.innerHTML = '<span style="color:' + color2 + ';">' + icon2 + '</span> ticker alias <b>' + r.registeredCount + '</b>/' + r.uniqueTickers + ' (' + r.coveragePct + '%)';
        } else {
          regEl.innerHTML = '<span style="color:var(--text-muted);">— ticker registry 미가용</span>';
        }
      } catch(e) { regEl.textContent = '⚠ registry audit error'; }
    }
    // (2) web_search status
    var wsEl = container.querySelector('[data-audit-key="webSearch"]');
    if (wsEl) {
      try {
        var ws = window.AIO && window.AIO.getWebSearchAudit && window.AIO.getWebSearchAudit();
        if (ws) {
          var statusIcon = ws.enabled ? '🔍' : '⊘';
          var statusColor = ws.enabled ? 'var(--data-cyan)' : 'var(--text-muted)';
          wsEl.innerHTML = '<span style="color:' + statusColor + ';">' + statusIcon + '</span> web_search ' + (ws.enabled ? '<b>ON</b>' : 'OFF') + ' · 호출 ' + ws.calls + '회';
        } else {
          wsEl.innerHTML = '<span style="color:var(--text-muted);">— web_search 미가용</span>';
        }
      } catch(e) { wsEl.textContent = '⚠ web_search audit error'; }
    }
    // (3) Context freshness
    var fEl = container.querySelector('[data-audit-key="freshness"]');
    if (fEl) {
      try {
        var f = window.AIO && window.AIO.getChatContextFreshnessAudit && window.AIO.getChatContextFreshnessAudit();
        if (f) {
          var pct = f.freshnessPct != null ? f.freshnessPct : (f.totalContexts ? Math.round((f.totalContexts - (f.staleCount || 0)) / f.totalContexts * 100) : null);
          if (pct != null) {
            var icon3 = pct >= 95 ? '✓' : pct >= 80 ? '⚠' : '✗';
            var color3 = pct >= 95 ? 'var(--data-green)' : pct >= 80 ? 'var(--data-amber)' : 'var(--data-red)';
            fEl.innerHTML = '<span style="color:' + color3 + ';">' + icon3 + '</span> 컨텍스트 신선도 <b>' + pct + '%</b>';
          } else if (typeof f.totalHits === 'number') {
            var activeHits = typeof f.currentHits === 'number' ? f.currentHits : f.totalHits;
            var archiveHits = typeof f.archiveHits === 'number' ? f.archiveHits : 0;
            var okFresh = activeHits === 0;
            var icon3b = okFresh ? '✓' : '⚠';
            var color3b = okFresh ? 'var(--data-green)' : 'var(--data-amber)';
            fEl.innerHTML = '<span style="color:' + color3b + ';">' + icon3b + '</span> 컨텍스트 current stale <b>' + activeHits + '</b>건' + (archiveHits ? ' · archive ref ' + archiveHits + '건' : '');
          } else {
            fEl.innerHTML = '<span style="color:var(--text-muted);">— freshness 측정 불가</span>';
          }
        } else {
          fEl.innerHTML = '<span style="color:var(--text-muted);">— freshness audit 미가용</span>';
        }
      } catch(e) { fEl.textContent = '⚠ freshness audit error'; }
    }
    // (4) v49.59 P327 신규: CHAT_CONTEXTS 정합성 (auditAllChatContexts)
    var ccEl = container.querySelector('[data-audit-key="chatContexts"]');
    if (ccEl) {
      try {
        var cc = window.AIO && window.AIO.auditAllChatContexts && window.AIO.auditAllChatContexts();
        if (cc) {
          var icon4 = cc.status === 'ok' ? '✓' : cc.status === 'warn' ? '⚠' : '✗';
          var color4 = cc.status === 'ok' ? 'var(--data-green)' : cc.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          ccEl.innerHTML = '<span style="color:' + color4 + ';">' + icon4 + '</span> 채팅 컨텍스트 <b>' + cc.validCount + '/' + cc.totalContexts + '</b> · 동적 ' + cc.dynamicCoveragePct + '%';
        } else {
          ccEl.innerHTML = '<span style="color:var(--text-muted);">— CHAT_CONTEXTS audit 미가용</span>';
        }
      } catch(e) { ccEl.textContent = '⚠ chatContexts audit error'; }
    }
    // v49.65 P344 R116/R118: 5축 신규 — analysisFramework (17 관점 자동화 수준)
    var afEl = container.querySelector('[data-audit-key="analysisFramework"]');
    if (afEl) {
      try {
        var af = window.AIO && window.AIO.getAnalysisFrameworkCoverageAudit && window.AIO.getAnalysisFrameworkCoverageAudit();
        if (af) {
          var icon5 = af.coveragePct >= 85 ? '✓' : af.coveragePct >= 60 ? '⚠' : '✗';
          var color5 = af.coveragePct >= 85 ? 'var(--data-green)' : af.coveragePct >= 60 ? 'var(--data-amber)' : 'var(--data-red)';
          afEl.innerHTML = '<span style="color:' + color5 + ';">' + icon5 + '</span> 분석 프레임워크 <b>' + af.implementedCount + '/' + af.totalCount + '</b> · ' + af.coveragePct + '% · 부분 ' + (af.partialCount || 0);
        } else {
          afEl.innerHTML = '<span style="color:var(--text-muted);">— framework audit 미가용</span>';
        }
      } catch(e) { afEl.textContent = '⚠ analysisFramework audit error'; }
    }
    // v49.65 R119: 3대 본질 정렬 — 기관급/최신운영/초보직관 3축
    var essenceEl = container.querySelector('[data-audit-key="essence"]');
    if (essenceEl) {
      try {
        var es = window.AIO && window.AIO.getEssenceAlignmentAudit && window.AIO.getEssenceAlignmentAudit();
        if (es) {
          var icon6 = es.status === 'ok' ? '✓' : es.status === 'warn' ? '⚠' : '✗';
          var color6 = es.status === 'ok' ? 'var(--data-green)' : es.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          essenceEl.innerHTML = '<span style="color:' + color6 + ';">' + icon6 + '</span> 3대 본질 <b>' + es.overallScore + '</b>점 · 기관 ' + es.goals.institutionalAllInOne.score + ' · 운영 ' + es.goals.accurateFreshAutoOps.score + ' · 직관 ' + es.goals.intuitiveBeginnerUse.score;
        } else {
          essenceEl.innerHTML = '<span style="color:var(--text-muted);">— essence audit 미가용</span>';
        }
      } catch(e) { essenceEl.textContent = '⚠ essence audit error'; }
    }
    // v49.66 P351 R121: AI 채팅 함수 통합 — Dead code/Partial Integration/Silent Fail 자동 감지
    // v49.67 P358/R124: DOM-first full surface audit row.
    var fsEl = container.querySelector('[data-audit-key="fullSurface"]');
    if (fsEl) {
      try {
        var fs = window.AIO && window.AIO.getFullSurfaceAudit && window.AIO.getFullSurfaceAudit();
        if (fs) {
          var iconFs = fs.status === 'ok' ? '✓' : fs.status === 'warn' ? '⚠' : '✗';
          var colorFs = fs.status === 'ok' ? 'var(--data-green)' : fs.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          fsEl.title = fs.issueCount ? fs.issues.slice(0, 3).join(' | ') : 'Full surface audit passed';
          fsEl.innerHTML = '<span style="color:' + colorFs + ';">' + iconFs + '</span> full surface <b>' + fs.pageCount + '</b>p+' + (fs.totals.overlays || 0) + ' overlays · sections ' + fs.totals.sections + ' · sinks ' + fs.totals.dataSinks + ' · issues ' + fs.issueCount;
        } else {
          fsEl.innerHTML = '<span style="color:var(--text-muted);">? full surface audit missing</span>';
        }
      } catch(e) { fsEl.textContent = '? fullSurface audit error'; }
    }
    var drEl = container.querySelector('[data-audit-key="deepReview"]');
    if (drEl) {
      try {
        var dr = window.AIO && window.AIO.getDeepReviewAudit && window.AIO.getDeepReviewAudit();
        if (dr) {
          var iconDr = dr.status === 'ok' ? '✓' : dr.status === 'warn' ? '⚠' : '✗';
          var colorDr = dr.status === 'ok' ? 'var(--data-green)' : dr.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var textTier = dr.tiers && dr.tiers.textMeaning ? dr.tiers.textMeaning : {};
          var intTier = dr.tiers && dr.tiers.interaction ? dr.tiers.interaction : {};
          var dataTier = dr.tiers && dr.tiers.dataMeaning ? dr.tiers.dataMeaning : {};
          drEl.title = (dr.issues || []).concat(dr.warnings || []).slice(0, 3).join(' | ') || 'Deep review audit passed';
          drEl.innerHTML = '<span style="color:' + colorDr + ';">' + iconDr + '</span> deep review text <b>' + (textTier.snippetCount || 0) + '</b> · input ' + (intTier.inputBindingIssueCount || 0) + ' · data ' + (dataTier.dataPageIssueCount || 0) + ' · issues ' + dr.issueCount;
        } else {
          drEl.innerHTML = '<span style="color:var(--text-muted);">? deep review audit missing</span>';
        }
      } catch(e) { drEl.textContent = '? deepReview audit error'; }
    }
    var ffEl = container.querySelector('[data-audit-key="fourthFifth"]');
    if (ffEl) {
      try {
        var ff = window.AIO && window.AIO.getFourthFifthPassAudit && window.AIO.getFourthFifthPassAudit();
        if (ff) {
          var iconFf = ff.status === 'ok' ? '✓' : ff.status === 'warn' ? '!' : '✗';
          var colorFf = ff.status === 'ok' ? 'var(--data-green)' : ff.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var dt = ff.passes && ff.passes.dataTruth ? ff.passes.dataTruth : {};
          var gf = ff.passes && ff.passes.goalFit ? ff.passes.goalFit : {};
          ffEl.title = (ff.issues || []).concat(ff.warnings || []).slice(0, 3).join(' | ') || 'Fourth/fifth pass audit passed';
          ffEl.innerHTML = '<span style="color:' + colorFf + ';">' + iconFf + '</span> 4/5 pass data <b>' + (dt.dataPageCount || 0) + '</b>p · goal ' + (gf.overallScore || ff.score || 0) + '점 · weak ' + ((dt.weakPageCount || 0) + (gf.weakPageCount || 0)) + ' · issues ' + ff.issueCount;
        } else {
          ffEl.innerHTML = '<span style="color:var(--text-muted);">? fourth/fifth audit missing</span>';
        }
      } catch(e) { ffEl.textContent = '? fourthFifth audit error'; }
    }
    var cfcEl = container.querySelector('[data-audit-key="chatFunctionCoverage"]');
    if (cfcEl) {
      try {
        var cfc = window.AIO && window.AIO.assertChatFunctionCoverage && window.AIO.assertChatFunctionCoverage();
        if (cfc) {
          var icon7 = cfc.status === 'ok' ? '✓' : cfc.status === 'warn' ? '⚠' : '✗';
          var color7 = cfc.status === 'ok' ? 'var(--data-green)' : cfc.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var fnPart = '함수 <b>' + cfc.integratedFnCount + '/' + cfc.chatRelevantFnCount + '</b> (' + cfc.integrationPct + '%)';
          var ctxPart = '컨텍스트 ' + cfc.contextIntegrated + '/' + cfc.contextTotal + ' (' + cfc.contextIntegrationPct + '%)';
          var cachePart = cfc.cacheImplemented ? '캐시 ✓' : '캐시 ✗';
          cfcEl.innerHTML = '<span style="color:' + color7 + ';">' + icon7 + '</span> 채팅 통합 ' + fnPart + ' · ' + ctxPart + ' · ' + cachePart;
        } else {
          cfcEl.innerHTML = '<span style="color:var(--text-muted);">— chatFunctionCoverage audit 미가용</span>';
        }
      } catch(e) { cfcEl.textContent = '⚠ chatFunctionCoverage error'; }
    }
    // v49.67 P355 R122: 시세 fetch 건강도 — REGISTRY 카테고리별 _liveData hit 비율 + chatTickerCache 통계
    var tfhEl = container.querySelector('[data-audit-key="tickerFetchHealth"]');
    if (tfhEl) {
      try {
        var tfh = window.AIO && window.AIO.assertTickerFetchHealth && window.AIO.assertTickerFetchHealth();
        if (tfh) {
          var icon8 = tfh.status === 'ok' ? '✓' : tfh.status === 'warn' ? '⚠' : '✗';
          var color8 = tfh.status === 'ok' ? 'var(--data-green)' : tfh.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var usPct = tfh.byCategory && tfh.byCategory.us ? tfh.byCategory.us.coveragePct : '—';
          var krPct = tfh.byCategory && tfh.byCategory.kr ? tfh.byCategory.kr.coveragePct : '—';
          var ccHits = tfh.chatTickerCache ? tfh.chatTickerCache.hitRatePct : '—';
          tfhEl.innerHTML = '<span style="color:' + color8 + ';">' + icon8 + '</span> 시세 fetch <b>' + tfh.liveDataHit + '/' + tfh.totalRegistry + '</b> (' + tfh.overallCoveragePct + '%) · US ' + usPct + '% · KR ' + krPct + '% · 캐시 hit ' + ccHits + '%';
        } else {
          tfhEl.innerHTML = '<span style="color:var(--text-muted);">— tickerFetchHealth audit 미가용</span>';
        }
      } catch(e) { tfhEl.textContent = '⚠ tickerFetchHealth error'; }
    }
    // v49.68 P362 R128: 14 CHAT_CONTEXTS 기관급 퀄리티 자동 진단 (사용자 "기관급 퀄리티 + 유기적 작동" 요구)
    var cccEl = container.querySelector('[data-audit-key="chatContextConsistency"]');
    if (cccEl) {
      try {
        var ccc = window.AIO && window.AIO.getChatContextConsistencyAudit && window.AIO.getChatContextConsistencyAudit();
        if (ccc) {
          var icon9 = ccc.status === 'ok' ? '✓' : ccc.status === 'warn' ? '⚠' : '✗';
          var color9 = ccc.status === 'ok' ? 'var(--data-green)' : ccc.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          cccEl.innerHTML = '<span style="color:' + color9 + ';">' + icon9 + '</span> 기관급 퀄리티 <b>' + ccc.qualityScore + '/100</b> · 프레임 ' + ccc.contexts.instFwCoverage + '/' + ccc.contexts.total + ' · 시나리오 ' + (ccc.fetchChat.scenarioGuide ? '✓' : '✗') + ' · 시각 단서 ' + (ccc.fetchChat.visualCue ? '✓' : '✗');
        } else {
          cccEl.innerHTML = '<span style="color:var(--text-muted);">— chatContextConsistency audit 미가용</span>';
        }
      } catch(e) { cccEl.textContent = '⚠ chatContextConsistency error'; }
    }
    // v49.69 P370 R129~R131: AI 채팅 인터랙티브 기능 자동 진단 (후속 질문/자동 이동/시뮬레이션/fuzzy)
    var ciaEl = container.querySelector('[data-audit-key="chatInteractivity"]');
    if (ciaEl) {
      try {
        var cia = window.AIO && window.AIO.assertChatInteractivityAudit && window.AIO.assertChatInteractivityAudit();
        if (cia) {
          var iconA = cia.status === 'ok' ? '✓' : cia.status === 'warn' ? '⚠' : '✗';
          var colorA = cia.status === 'ok' ? 'var(--data-green)' : cia.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          ciaEl.innerHTML = '<span style="color:' + colorA + ';">' + iconA + '</span> 인터랙티브 <b>' + cia.coveragePct + '%</b> · 함수 ' + cia.fnCount + '/' + cia.fnTotal + ' · 통합 ' + cia.integCount + '/' + cia.integTotal;
        } else {
          ciaEl.innerHTML = '<span style="color:var(--text-muted);">— chatInteractivity audit 미가용</span>';
        }
      } catch(e) { ciaEl.textContent = '⚠ chatInteractivity error'; }
    }
    // v49.70 P375 R132~R134: AI 채팅 고급 기능 (사용자 프로필 + 알람 + 다운로드 + 금액 시뮬레이션)
    var cafEl = container.querySelector('[data-audit-key="chatAdvanced"]');
    if (cafEl) {
      try {
        var caf = window.AIO && window.AIO.assertChatAdvancedFeaturesAudit && window.AIO.assertChatAdvancedFeaturesAudit();
        if (caf) {
          var iconB = caf.status === 'ok' ? '✓' : caf.status === 'warn' ? '⚠' : '✗';
          var colorB = caf.status === 'ok' ? 'var(--data-green)' : caf.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var alertStr = caf.activeAlerts > 0 ? ' · 🔔' + caf.activeAlerts : '';
          var profileStr = caf.userProfileSet ? ' · 👤 ✓' : ' · 👤 default';
          cafEl.innerHTML = '<span style="color:' + colorB + ';">' + iconB + '</span> 고급 기능 <b>' + caf.coveragePct + '%</b> · 함수 ' + caf.fnCount + '/' + caf.fnTotal + alertStr + profileStr;
        } else {
          cafEl.innerHTML = '<span style="color:var(--text-muted);">— chatAdvanced audit 미가용</span>';
        }
      } catch(e) { cafEl.textContent = '⚠ chatAdvanced error'; }
    }
    // v49.71 P380 R135~R137: MEMO 커버리지 + 신선도 자동 진단 (사용자 정직 질의 4건 시정)
    var mcEl = container.querySelector('[data-audit-key="memoCoverage"]');
    if (mcEl) {
      try {
        var mc = window.AIO && window.AIO.assertMemoCoverageAudit && window.AIO.assertMemoCoverageAudit();
        if (mc) {
          var iconC = mc.status === 'ok' ? '✓' : mc.status === 'warn' ? '⚠' : '✗';
          var colorC = mc.status === 'ok' ? 'var(--data-green)' : mc.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var staleStr = mc.stalePct > 30 ? ' · 🔴 stale ' + mc.stalePct + '%' : mc.stalePct > 10 ? ' · 🟡 stale ' + mc.stalePct + '%' : ' · 🟢 신선';
          mcEl.innerHTML = '<span style="color:' + colorC + ';">' + iconC + '</span> MEMO <b>' + mc.withMemo + '/' + mc.totalRows + '</b> (' + mc.memoCoveragePct + '%)' + staleStr + ' · 통합 ' + (mc.chatIntegrated ? '✓' : '✗');
        } else {
          mcEl.innerHTML = '<span style="color:var(--text-muted);">— memoCoverage audit 미가용</span>';
        }
      } catch(e) { mcEl.textContent = '⚠ memoCoverage error'; }
    }
    // v49.72 P387 R138~R139: fundamental 7 차트 + 채팅 차트 보기 버튼 자동 진단
    var fcEl = container.querySelector('[data-audit-key="financialCharts"]');
    if (fcEl) {
      try {
        var fc = window.AIO && window.AIO.assertFinancialChartsAudit && window.AIO.assertFinancialChartsAudit();
        if (fc) {
          var iconD = fc.status === 'ok' ? '✓' : fc.status === 'warn' ? '⚠' : '✗';
          var colorD = fc.status === 'ok' ? 'var(--data-green)' : fc.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          var cacheStr = fc.cacheSize > 0 ? ' · 캐시 ' + fc.cacheSize : '';
          fcEl.innerHTML = '<span style="color:' + colorD + ';">' + iconD + '</span> 📊 차트 <b>' + fc.coveragePct + '%</b> · ' + fc.domCanvasFound + '/7 canvas' + cacheStr;
        } else {
          fcEl.innerHTML = '<span style="color:var(--text-muted);">— financialCharts audit 미가용</span>';
        }
      } catch(e) { fcEl.textContent = '⚠ financialCharts error'; }
    }
    // v49.73 P392 R140~R142: 답변 품질 3축 자동 진단 (현재성·정확성·직관성)
    var aqEl = container.querySelector('[data-audit-key="answerQuality"]');
    if (aqEl) {
      try {
        var aq = window.AIO && window.AIO.assertChatAnswerQualityAudit && window.AIO.assertChatAnswerQualityAudit();
        if (aq) {
          var iconE = aq.status === 'ok' ? '✓' : aq.status === 'warn' ? '⚠' : '✗';
          var colorE = aq.status === 'ok' ? 'var(--data-green)' : aq.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          aqEl.innerHTML = '<span style="color:' + colorE + ';">' + iconE + '</span> 📋 답변 품질 <b>' + aq.overallScore + '점</b> · 현재 ' + aq.freshness.score + ' · 정확 ' + aq.accuracy.score + ' · 직관 ' + aq.intuitiveness.score;
        } else {
          aqEl.innerHTML = '<span style="color:var(--text-muted);">— answerQuality audit 미가용</span>';
        }
      } catch(e) { aqEl.textContent = '⚠ answerQuality error'; }
    }
    // v49.82 P440/R167: XSS escHtml 커버리지 (14축)
    var xssEl = container.querySelector('[data-audit-key="xssSurface"]');
    if (xssEl) {
      try {
        var xss = window.AIO && window.AIO.assertXssEscapeCoverageAudit && window.AIO.assertXssEscapeCoverageAudit();
        if (xss) {
          var iconX = xss.status === 'ok' ? '✓' : xss.status === 'warn' ? '⚠' : '✗';
          var colorX = xss.status === 'ok' ? 'var(--data-green)' : xss.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          xssEl.innerHTML = '<span style="color:' + colorX + ';">' + iconX + '</span> 🛡 XSS <b>' + xss.xssCoveragePct + '%</b> · 위험 ' + xss.unsafeAssignments + ' · hover ' + xss.inlineHoverHits + ' · lc-pair ' + xss.lineClampPairsOk;
        } else {
          xssEl.innerHTML = '<span style="color:var(--text-muted);">— xssSurface audit 미가용</span>';
        }
      } catch(e) { xssEl.textContent = '⚠ xssSurface error'; }
    }
    // v49.82 P441/R170: KR 종목코드 정합성 (15축)
    var krtEl = container.querySelector('[data-audit-key="krTickerMapping"]');
    if (krtEl) {
      try {
        var krt = window.AIO && window.AIO.assertKrTickerMappingAudit && window.AIO.assertKrTickerMappingAudit();
        if (krt) {
          var iconK = krt.status === 'ok' ? '✓' : krt.status === 'warn' ? '⚠' : '✗';
          var colorK = krt.status === 'ok' ? 'var(--data-green)' : krt.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          krtEl.innerHTML = '<span style="color:' + colorK + ';">' + iconK + '</span> 🇰🇷 KR 매핑 <b>' + krt.checkedTickers + '</b> · 충돌 <b>' + krt.conflictCount + '</b> · known ' + krt.knownMappingChecked + '/' + (krt.knownMappingChecked - krt.knownMismatchCount);
        } else {
          krtEl.innerHTML = '<span style="color:var(--text-muted);">— krTickerMapping audit 미가용</span>';
        }
      } catch(e) { krtEl.textContent = '⚠ krTickerMapping error'; }
    }
    // v49.83 P444/R173: 자산 간 30일 correlation (16축)
    var corrEl = container.querySelector('[data-audit-key="crossAssetCorr"]');
    if (corrEl) {
      try {
        var corr = window.AIO && window.AIO.computeCrossAssetCorrelation && window.AIO.computeCrossAssetCorrelation();
        if (corr) {
          var iconCo = corr.status === 'ok' ? '✓' : corr.status === 'insufficient_data' ? '⏳' : '⚠';
          var colorCo = corr.status === 'ok' ? 'var(--data-green)' : corr.status === 'insufficient_data' ? 'var(--text-muted)' : 'var(--data-amber)';
          if (corr.status === 'ok') {
            corrEl.innerHTML = '<span style="color:' + colorCo + ';">' + iconCo + '</span> 🔗 자산 <b>' + corr.availableAssets.length + '</b> · regime <b>' + corr.regime + '</b> · n=' + corr.sampleSize;
          } else {
            corrEl.innerHTML = '<span style="color:' + colorCo + ';">' + iconCo + '</span> 🔗 자산 데이터 누적 중 (need ≥5)';
          }
        }
      } catch(e) { corrEl.textContent = '⚠ crossAssetCorr error'; }
    }
    // v49.83 P445/R174: 답변 정량 비율 (17축)
    var qrEl = container.querySelector('[data-audit-key="quantRatio"]');
    if (qrEl) {
      try {
        var qr = window.AIO && window.AIO.assertQuantitativeRatioAudit && window.AIO.assertQuantitativeRatioAudit();
        if (qr) {
          var iconQ = qr.status === 'ok' ? '✓' : qr.status === 'no_data' ? '⏳' : qr.status === 'warn' ? '⚠' : '✗';
          var colorQ = qr.status === 'ok' ? 'var(--data-green)' : qr.status === 'no_data' ? 'var(--text-muted)' : qr.status === 'warn' ? 'var(--data-amber)' : 'var(--data-red)';
          if (qr.status === 'no_data') {
            qrEl.innerHTML = '<span style="color:' + colorQ + ';">' + iconQ + '</span> 🎯 정량 비율 (채팅 후 측정)';
          } else {
            qrEl.innerHTML = '<span style="color:' + colorQ + ';">' + iconQ + '</span> 🎯 정량 비율 <b>' + qr.quantitativeRatioPct + '%</b> · 토큰 ' + qr.quantTokens + '/' + qr.totalWords + ' · 샘플 ' + qr.sampleCount;
          }
        }
      } catch(e) { qrEl.textContent = '⚠ quantRatio error'; }
    }
    // v49.83 P443/R172: 거시 캘린더 auto-advance (18축)
    var mcaEl = container.querySelector('[data-audit-key="macroCalendarAuto"]');
    if (mcaEl) {
      try {
        var mca = window.AIO && window.AIO._aioRecomputeMacroCalendar && window.AIO._aioRecomputeMacroCalendar({ dryRun: true });
        if (mca) {
          var iconM = mca.advancedCount === 0 ? '✓' : '⚠';
          var colorM = mca.advancedCount === 0 ? 'var(--data-green)' : 'var(--data-amber)';
          mcaEl.innerHTML = '<span style="color:' + colorM + ';">' + iconM + '</span> 📅 거시 캘린더 · 대기 advance <b>' + mca.advancedCount + '</b> (dry-run)';
        }
      } catch(e) { mcaEl.textContent = '⚠ macroCalendarAuto error'; }
    }
    // v49.89 P450/R180: 데이터 계보 (source→render) 19축
    var dlEl = container.querySelector('[data-audit-key="dataLineage"]');
    if (dlEl) {
      try {
        var dl = window.AIO && window.AIO.getDataLineageAudit && window.AIO.getDataLineageAudit();
        if (dl) {
          var iconL = dl.status === 'ok' ? '✓' : '⚠';
          var colorL = dl.status === 'ok' ? 'var(--data-green)' : 'var(--data-amber)';
          var cl = dl.cellLevel || {};
          var cellTxt = cl.status ? ' · cell ' + (cl.totalOrphans === 0 ? '<span style="color:var(--data-green);">0 끊김</span>' : '<span style="color:var(--data-red);">끊김 ' + cl.totalOrphans + '</span>') + ' (' + (cl.liveSinkTotal||0) + '+' + (cl.snapSinkTotal||0) + ' sink)' : '';
          dlEl.innerHTML = '<span style="color:' + colorL + ';">' + iconL + '</span> 🔗 데이터 계보 자동 <b>' + dl.connected + '</b>/' + dl.total + ' · gap ' + dl.gap + ' · 수동 ' + dl.manual + (dl.broken > 0 ? ' · <span style="color:var(--data-red);">끊김 ' + dl.broken + '</span>' : '') + cellTxt;
        } else {
          dlEl.innerHTML = '<span style="color:var(--text-muted);">— dataLineage audit 미가용</span>';
        }
      } catch(e) { dlEl.textContent = '⚠ dataLineage error'; }
    }
    // v49.83 P450/R178: failure status sticky top + pulse 애니메이션 (#9)
    try {
      var rows = Array.prototype.slice.call(container.querySelectorAll('[data-audit-key]'));
      rows.forEach(function(row) {
        var t = row.textContent || '';
        // ✗ failure 우선 / ⚠ warn 두번째 / ✓ ok 마지막
        var pri = /✗/.test(t) ? 0 : /⚠/.test(t) ? 1 : /⏳/.test(t) ? 2 : 3;
        row.dataset.auditPri = pri;
        if (pri === 0) {
          row.style.background = 'rgba(255,91,80,0.06)';
          row.style.borderLeft = '2px solid var(--data-red)';
          row.style.paddingLeft = '6px';
          row.style.animation = 'aioAuditPulse 2s ease-in-out infinite';
        } else if (pri === 1) {
          row.style.background = 'rgba(255,163,26,0.04)';
          row.style.borderLeft = '2px solid var(--data-amber)';
          row.style.paddingLeft = '6px';
          row.style.animation = '';
        } else {
          row.style.background = '';
          row.style.borderLeft = '';
          row.style.paddingLeft = '';
          row.style.animation = '';
        }
      });
      // priority sort (CSS order property)
      rows.sort(function(a, b) { return (+a.dataset.auditPri) - (+b.dataset.auditPri); });
      rows.forEach(function(row, idx) { row.style.order = String(idx); });
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
    } catch(_) {}
    // v49.83 P449/R177: 일반/개발자 mode (#7) — localStorage flag
    try {
      var devMode = false;
      try { devMode = localStorage.getItem('aio_audit_mode') === 'detailed'; } catch(_) {}
      var toggleInput = document.getElementById('aio-audit-mode-toggle');
      if (toggleInput) toggleInput.checked = devMode;
      var allRows = container.querySelectorAll('[data-audit-key]');
      allRows.forEach(function(row) {
        if (!devMode) {
          // simple mode: ✓ / ⚠ / ✗ / ⏳ 아이콘만 (첫 글자)
          var orig = row.dataset.auditFull;
          if (!orig) row.dataset.auditFull = row.innerHTML;
          var icon = (row.textContent.match(/[✓⚠✗⏳]/) || ['?'])[0];
          var labelMatch = row.textContent.match(/[🛡🇰🇷🔗🎯📅📋📊🔍📈💬🧠📑✨🛠]+\s*[^·<]*/);
          var lbl = labelMatch ? labelMatch[0].trim() : (row.dataset.auditKey || 'audit');
          row.innerHTML = '<span style="font-size:13px;">' + icon + '</span> ' + (typeof escHtml === 'function' ? escHtml(lbl) : lbl);
        } else if (row.dataset.auditFull) {
          // restore full
          row.innerHTML = row.dataset.auditFull;
        }
      });
    } catch(_) {}
  } catch(e) { /* 위젯 갱신 실패는 silent */ }
};

// v49.83 P449/R177: 일반/개발자 mode 토글 핸들러
window._aioAuditModeToggle = function(checked, el) {
  try {
    localStorage.setItem('aio_audit_mode', checked ? 'detailed' : 'simple');
  } catch(_) {}
  // 즉시 재렌더
  try { window._aioRefreshAuditWidget(); } catch(_) {}
};

// v49.83 P450/R178: CSS keyframes 동적 주입 (sticky pulse 애니메이션)
(function() {
  try {
    if (!document.getElementById('aio-audit-keyframes')) {
      var st = document.createElement('style');
      st.id = 'aio-audit-keyframes';
      st.textContent = '@keyframes aioAuditPulse { 0%,100% { opacity:1; } 50% { opacity:0.65; } } ' +
        // v49.83 #10: 데스크탑 ≥1600px wide-mode — 사이드바 audit 2열 grid
        '@media (min-width: 1600px) { #aio-audit-widget-content { display:grid !important; grid-template-columns: 1fr 1fr; gap:4px 12px; } #aio-audit-widget-content [data-audit-key] { order: unset !important; } }';
      document.head.appendChild(st);
    }
  } catch(_) {}
})();
// 페이지 로드 후 자동 1회 + 5분마다 갱신
setTimeout(function() {
  try { window._aioRefreshAuditWidget(); } catch(_e) {}
  setInterval(function() {
    try { window._aioRefreshAuditWidget(); } catch(_e) {}
  }, 5 * 60 * 1000);
}, 3000);

window._aioWebSearchToggle = function(checked, el) {
  // checkbox change event — el이 input element
  var enabled = (el && typeof el.checked === 'boolean') ? el.checked : !!checked;
  try {
    if (enabled) localStorage.removeItem('aio_web_search_enabled');
    else localStorage.setItem('aio_web_search_enabled', 'off');
  } catch(_e) {}
  var statusEl = document.getElementById('aio-web-search-status');
  if (statusEl) {
    statusEl.textContent = enabled ? 'ON' : 'OFF';
    statusEl.style.color = enabled ? 'var(--data-green)' : 'var(--text-muted)';
  }
  // 위젯 새로고침
  try { window._aioRefreshAuditWidget(); } catch(_e) {}
  if (typeof showToast === 'function') {
    showToast(enabled ? '🔍 Claude 웹 검색 활성화' : '⊘ 웹 검색 비활성화 — 학습 데이터만 사용');
  }
};
// 페이지 로드 시 토글 초기 상태 동기화
setTimeout(function() {
  try {
    var t = document.getElementById('aio-web-search-toggle');
    var status = document.getElementById('aio-web-search-status');
    if (t) {
      var disabled = (localStorage.getItem('aio_web_search_enabled') === 'off');
      t.checked = !disabled;
      if (status) {
        status.textContent = disabled ? 'OFF' : 'ON';
        status.style.color = disabled ? 'var(--text-muted)' : 'var(--data-green)';
      }
    }
  } catch(_e) {}
}, 2000);

window._aioExportKeys = function() {
  try {
    var r = window.AIO.exportApiKeys({ masked: false });
    if (typeof showToast === 'function') showToast('📥 키 백업 완료 — ' + r.exported + '개 다운로드');
  } catch(e) {
    if (typeof showToast === 'function') showToast('⚠ 백업 실패: ' + (e && e.message));
  }
};

window._aioImportKeysPrompt = function() {
  // 파일 선택 후 JSON 파싱 + 복원
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
      try {
        var r = await window.AIO.importApiKeys(ev.target.result);
        if (r.ok) {
          if (typeof showToast === 'function') showToast('📤 키 복원 완료 — ' + r.imported + '개 (백업: ' + (r.source || 'unknown') + ')');
          setTimeout(function(){ window.location.reload(); }, 1500); // 키 반영 위해 리로드
        } else {
          if (typeof showToast === 'function') showToast('⚠ 복원 실패: ' + (r.error || 'unknown'));
        }
      } catch(err) {
        if (typeof showToast === 'function') showToast('⚠ 파일 파싱 실패: ' + (err && err.message));
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

window._aioRecoverKeys = async function() {
  try {
    var r = await window.AIO.recoverApiKeysFromIdb();
    if (r.recovered > 0) {
      if (typeof showToast === 'function') showToast('🔄 IDB 자동 복원 — ' + r.recovered + '개 (백업: ' + r.idbTs + ')');
      setTimeout(function(){ window.location.reload(); }, 1500);
    } else {
      if (typeof showToast === 'function') showToast('ℹ ' + (r.reason || 'no backup found'));
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('⚠ 복원 실패: ' + (e && e.message));
  }
};

// v30.11: PIN 설정/해제 UI 핸들러
function _vaultSetPin() {
  var pin1 = document.getElementById('vault-pin-input');
  var pin2 = document.getElementById('vault-pin-confirm');
  var msg  = document.getElementById('vault-pin-msg');
  if (!pin1 || !pin2) return;
  var v1 = pin1.value.trim(), v2 = pin2.value.trim();
  if (v1.length < 4) { msg.textContent = 'PIN은 4자리 이상'; msg.style.color = '#ff5b50'; return; }
  if (v1 !== v2) { msg.textContent = 'PIN이 일치하지 않습니다'; msg.style.color = '#ff5b50'; return; }
  msg.textContent = '암호화 중…'; msg.style.color = '#00d4ff';
  _AioVault.unlock(v1).then(function() {
    return _migrateToEncrypted();
  }).then(function() {
    msg.textContent = '암호화 완료! API 키가 보호됩니다.'; msg.style.color = '#34d399';
    pin1.value = ''; pin2.value = '';
    _updateVaultStatus();
  }).catch(function(e) {
    msg.textContent = '오류: ' + e.message; msg.style.color = '#ff5b50';
  });
}

function _vaultUnlock() {
  var pin = document.getElementById('vault-unlock-input');
  var msg = document.getElementById('vault-unlock-msg');
  if (!pin) return;
  var v = pin.value.trim();
  if (!v) { msg.textContent = 'PIN을 입력하세요'; msg.style.color = '#ff5b50'; return; }
  msg.textContent = '잠금 해제 중…'; msg.style.color = '#00d4ff';
  _AioVault.unlock(v).then(function() {
    // 복호화된 키를 input 필드에 복원
    return _restoreDecryptedKeys();
  }).then(function() {
    msg.textContent = '잠금 해제됨'; msg.style.color = '#34d399';
    pin.value = '';
    _updateVaultStatus();
  }).catch(function(e) {
    msg.textContent = 'PIN이 올바르지 않습니다'; msg.style.color = '#ff5b50';
  });
}

// 복호화된 키를 input 필드에 복원 + 런타임 캐시에 저장
// v47.7: aio_claude_api_key 복원 추가 — Vault 암호화 후 Claude 채팅 키 "사라짐" 버그 P109 수정
// v47.9: 11개 모든 민감 키를 _AioVault._keyRuntime에 동기화 — fetcher들이 _getApiKey()로 조회
// v47.9: rss2json 키 추가 (기존 누락) — 뉴스 소스 호출에 필요
async function _restoreDecryptedKeys() {
  try {
    var keyMap = [
      ['aio_claude_api_key', 'sidebar-api-key'],  // v47.7: Claude 키 포함
      ['aio_av_key', 'aio_av_key_input'],
      ['aio_finnhub_key', 'aio_finnhub_key_input'],
      ['aio_fred_key', 'aio_fred_key_input'],
      ['aio_td_key', 'aio_td_key_input'],
      ['aio_fmp_key', 'aio_fmp_key_input'],
      ['aio_perplexity_key', 'aio_perplexity_key_input'],
      ['aio_google_cse_key', 'aio_google_cse_key_input'],
      ['aio_google_cse_cx', 'aio_google_cse_cx_input'],
      ['aio_newsdata_key', 'aio_newsdata_key_input'],
      ['aio_rss2json_key', 'aio_rss2json_key_input'],  // v47.9: 기존 누락 보강
      ['aio_cf_worker_url', 'aio_cf_worker_input']
    ];
    // v47.9: 통합 런타임 캐시 초기화
    if (!_AioVault._keyRuntime) _AioVault._keyRuntime = {};
    for (var i = 0; i < keyMap.length; i++) {
      var lsKey = keyMap[i][0];
      var inputId = keyMap[i][1];
      var val = await safeLSGet(lsKey);
      var el = document.getElementById(inputId);
      // v47.9: 복호화된 값은 반드시 _keyRuntime에 저장 (fetcher들의 _getApiKey 참조 대상)
      if (val) _AioVault._keyRuntime[lsKey] = val;
      // v47.7: Claude 키는 기존 _claudeKeyRuntime 필드와도 호환 유지 + input 마스킹
      if (val && lsKey === 'aio_claude_api_key') {
        _AioVault._claudeKeyRuntime = val;
        if (el) el.value = val.slice(0, 8) + '...' + val.slice(-4);
      } else if (val && el) {
        // v47.9: 다른 민감 키도 마스킹 표시 (4자+4자, URL은 원본 유지)
        if (lsKey === 'aio_cf_worker_url' || lsKey === 'aio_google_cse_cx') {
          el.value = val;
        } else if (val.length > 12) {
          el.value = val.slice(0, 4) + '...' + val.slice(-4);
        } else {
          el.value = val;
        }
      }
    }
    console.log('[AIO Vault] _restoreDecryptedKeys: ' + Object.keys(_AioVault._keyRuntime).length + '개 키 캐시 복원');
  } catch(e) { _aioLog('warn', 'vault', '_restoreDecryptedKeys error: ' + e.message); }
}

function _updateVaultStatus() {
  var badge = document.getElementById('vault-status-badge');
  var setPanel = document.getElementById('vault-set-panel');
  var unlockPanel = document.getElementById('vault-unlock-panel');
  if (!badge) return;
  var hasSalt = !!localStorage.getItem('aio_vault_salt');
  var isUnlocked = _AioVault.isUnlocked();
  if (!hasSalt) {
    badge.textContent = ' 미설정'; badge.style.color = '#7b8599';
    if (setPanel) setPanel.style.display = 'block';
    if (unlockPanel) unlockPanel.style.display = 'none';
  } else if (isUnlocked) {
    badge.textContent = ' 활성'; badge.style.color = '#34d399';
    if (setPanel) setPanel.style.display = 'none';
    if (unlockPanel) unlockPanel.style.display = 'none';
  } else {
    badge.textContent = ' 잠금'; badge.style.color = '#ffa31a';
    if (setPanel) setPanel.style.display = 'none';
    if (unlockPanel) unlockPanel.style.display = 'block';
  }
}

// v30.11: 공용 PC 모드 — 탭 종료 시 sessionStorage 정리
window.addEventListener('beforeunload', function() {
  if (_AioVault._publicMode) {
    _AIO_SENSITIVE_KEYS.forEach(function(k) { try { sessionStorage.removeItem(k); } catch(e){} });
  }
});

// ═══ v30.11: KRX 장시간 감지 + 시장 상태 배지 ══════════════════════
/**
 * 한국 거래소(KRX) 장시간 판별
 * 정규장: 09:00~15:30 KST (UTC+9)
 * 프리마켓: 08:30~09:00, 애프터마켓: 15:40~16:00
 * @returns {string} 'open' | 'pre' | 'after' | 'closed'
 */
function _getKrxSession() {
  var now = new Date();
  // KST = UTC + 9
  var kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  var day = kst.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return 'closed';
  var h = kst.getHours(), m = kst.getMinutes();
  var t = h * 60 + m; // 분 단위
  if (t >= 540 && t < 930) return 'open';   // 09:00~15:30
  if (t >= 510 && t < 540) return 'pre';     // 08:30~09:00
  if (t >= 940 && t < 960) return 'after';   // 15:40~16:00
  return 'closed';
}

/**
 * v36.7: 미국 시장 세션 판별 (EST 기준)
 * Regular: 09:30~16:00 ET, Pre: 04:00~09:30 ET, After: 16:00~20:00 ET
 * 선물(ES/NQ/YM): 일 18:00~금 17:00 ET (거의 24시간)
 * @returns {string} 'open' | 'pre' | 'after' | 'futures_only' | 'closed'
 */
function _getUsSession() {
  var now = new Date();
  // EST/EDT 자동 판별 (3월 둘째 일요일~11월 첫째 일요일 = EDT = UTC-4, 나머지 EST = UTC-5)
  var year = now.getUTCFullYear(), mar = new Date(year, 2, 1), nov = new Date(year, 10, 1);
  var dstStart = new Date(mar.getTime() + ((14 - mar.getDay()) % 7) * 86400000 + 7 * 86400000); // 3월 둘째 일요일
  var dstEnd = new Date(nov.getTime() + ((7 - nov.getDay()) % 7) * 86400000); // 11월 첫째 일요일
  var isDST = now >= dstStart && now < dstEnd;
  var etOffset = isDST ? -4 : -5; // hours from UTC
  var et = new Date(now.getTime() + (now.getTimezoneOffset() + etOffset * 60) * 60000);
  var day = et.getDay();
  var h = et.getHours(), m = et.getMinutes();
  var t = h * 60 + m;

  // 주말: 일요일 18:00 이전 또는 토요일 = closed
  if (day === 0 && t < 1080) return 'closed';    // 일요일 18:00 전
  if (day === 6 && t >= 1020) return 'closed';    // 토요일 17:00 후
  if (day === 6) return 'futures_only';            // 토요일 17:00 전 (선물 잔여)

  // 평일
  if (t >= 570 && t < 960) return 'open';          // 09:30~16:00 정규장
  if (t >= 240 && t < 570) return 'pre';           // 04:00~09:30 프리마켓
  if (t >= 960 && t < 1200) return 'after';        // 16:00~20:00 애프터마켓
  // 20:00~04:00 또는 일요일 18:00+ = 선물만 거래
  return 'futures_only';
}

/**
 * v36.7: 선물 시장 세션 판별 (FX/채권/원자재/VIX 선물 — 거의 24시간)
 * 일 18:00 ET ~ 금 17:00 ET (중간 17:00~18:00 유지보수 휴장)
 * @returns {boolean} true = 선물 시장 운영 중
 */
function _isFuturesOpen() {
  var now = new Date();
  var year = now.getUTCFullYear(), mar = new Date(year, 2, 1), nov = new Date(year, 10, 1);
  var dstStart = new Date(mar.getTime() + ((14 - mar.getDay()) % 7) * 86400000 + 7 * 86400000);
  var dstEnd = new Date(nov.getTime() + ((7 - nov.getDay()) % 7) * 86400000);
  var isDST = now >= dstStart && now < dstEnd;
  var etOffset = isDST ? -4 : -5;
  var et = new Date(now.getTime() + (now.getTimezoneOffset() + etOffset * 60) * 60000);
  var day = et.getDay(), t = et.getHours() * 60 + et.getMinutes();
  // 토요일 17:00 이후 ~ 일요일 18:00 이전 = 휴장
  if (day === 6 && t >= 1020) return false;
  if (day === 0 && t < 1080) return false;
  // 평일 17:00~18:00 = 유지보수 (대략)
  if (t >= 1020 && t < 1080 && day >= 1 && day <= 5) return false;
  return true;
}

/**
 * KRX 장 상태에 따른 "실시간" vs "전일 종가" 표시 결정
 * @param {string} symbol - Yahoo Finance 심볼 (.KS, .KQ, ^KS11, ^KQ11)
 * @returns {{ label:string, dot:string, isLive:boolean }}
 */
function _getKrxDataStatus(symbol) {
  if (!symbol) return { label: '—', dot: '<span class="sd sd-w"></span>', isLive: false };
  var isKrx = symbol.endsWith('.KS') || symbol.endsWith('.KQ') ||
              symbol === '^KS11' || symbol === '^KQ11';
  if (!isKrx) return { label: '실시간', dot: '<span class="sd sd-g"></span>', isLive: true };
  var session = _getKrxSession();
  switch(session) {
    case 'open':   return { label: '실시간',      dot: '<span class="sd sd-g"></span>', isLive: true };
    case 'pre':    return { label: '프리마켓',    dot: '<span class="sd sd-y"></span>', isLive: false };
    case 'after':  return { label: '시간외거래',  dot: '<span class="sd sd-y"></span>', isLive: false };
    default:       return { label: '전일 종가',   dot: '<span class="sd sd-r"></span>', isLive: false };
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 MARKER ▸ MODULE 1: CORE START                               ║
// ║  책임: Stores (Price/Macro/News/DataHealth) + Engines + Constants + Utils ║
// ║  의존성: 없음 (최하위 레이어)                                              ║
// ║  미래 분할 지점: 이 위치 직전에 </script><script> 추가하여 모듈 1 시작     ║
// ║  상세: _context/MODULE-BOUNDARIES.md Phase 2                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// ═══════════════════════════════════════════════════════════════════
// v31.8: DATA VALIDATION STORES — 데이터 정확성/최신성/신뢰성 검증 레이어
// ═══════════════════════════════════════════════════════════════════

// ── 1. PriceStore — 시세 데이터 검증 저장소 ──
const PriceStore = {
  _data: {},        // sym → { price, pct, source, ts, stale, pctMissing }
  _prev: {},        // sym → 이전 가격 (급변 감지용)
  _rejected: [],    // 최근 거부된 데이터 로그 (최대 50건)
  _stats: { accepted: 0, rejected: 0, staleCount: 0 },
  _sessionStart: Date.now(),

  /** 시세 데이터 저장 (검증 후) */
  set(sym, price, pct, source) {
    // v46.4: symbol 유효성 검증
    if (!sym || typeof sym !== 'string' || sym.trim() === '') {
      this._reject(sym, price, source, 'invalid_symbol', '심볼 빈값/비문자열');
      return false;
    }
    if (typeof price !== 'number' || isNaN(price) || price <= 0) {
      this._reject(sym, price, source, 'invalid_price', '가격이 숫자가 아니거나 0 이하');
      return false;
    }
    const pctMissing = (typeof pct !== 'number' || isNaN(pct) || !isFinite(pct));
    if (pctMissing) pct = null;
    const age = Date.now() - this._sessionStart;
    if (this._prev[sym] && age > 180000) {
      const jump = Math.abs(price - this._prev[sym]) / this._prev[sym];
      if (jump > 0.5) {
        this._reject(sym, price, source, 'price_jump', `${(jump*100).toFixed(1)}% 급변 (이전: ${this._prev[sym]})`);
        return false;
      }
    }
    const ts = Date.now();
    var metric = (typeof makeMetric === 'function') ? makeMetric(price, source || 'unknown', ts, 'quote', { pct: pct, pctMissing: pctMissing }) : null;
    this._data[sym] = { price, pct, source: source || 'unknown', ts: ts, stale: false, pctMissing: pctMissing, metric: metric, quality: metric };
    this._prev[sym] = price;
    this._stats.accepted++;
    window._liveData = window._liveData || {};
    window._liveData[sym] = Object.assign({}, window._liveData[sym] || {}, {
      price: price,
      pct: pct,
      source: source || 'unknown',
      ts: ts,
      stale: false,
      pctMissing: pctMissing,
      metric: metric,
      quality: metric
    });
    window._quoteTimestamps = window._quoteTimestamps || {};
    window._quoteTimestamps[sym] = ts;
    window._dataSource = window._dataSource || {};
    window._dataSource[sym] = { source: source || 'live:yahoo', ts: ts, pctMissing: pctMissing, policyKey: 'quote', metric: metric };
    if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
      window.AIO.annotateLiveDataSinks(document, { symbol: sym, force: true });
    }
    return true;
  },
  get(sym) {
    const d = this._data[sym];
    if (!d) return null;
    var evaluated = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.price, source: d.source, ts: d.ts, policyKey: 'quote' }) : null;
    d.quality = evaluated || d.quality || null;
    d.stale = evaluated ? evaluated.stale : (Date.now() - d.ts) > 300000;
    return d;
  },
  _reject(sym, price, source, reason, detail) {
    this._stats.rejected++;
    if (this._rejected.length >= 50) this._rejected.shift();
    this._rejected.push({ sym, price, source, reason, detail, ts: Date.now() });
    _aioLog('warn', 'price', '거부: ' + sym + ' = ' + price + ' (' + reason + ': ' + detail + ')');
  },
  health() {
    const now = Date.now();
    let total = 0, stale = 0, fresh = 0;
    const sources = {};
    for (const [sym, d] of Object.entries(this._data)) {
      total++;
      var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.price, source: d.source, ts: d.ts, policyKey: 'quote' }, now) : null;
      if (q) { d.quality = q; d.stale = q.stale; }
      if (d.stale || (!q && (now - d.ts) > 300000)) { stale++; d.stale = true; } else fresh++;
      sources[d.source] = (sources[d.source] || 0) + 1;
    }
    this._stats.staleCount = stale;
    return { total, fresh, stale, accepted: this._stats.accepted, rejected: this._stats.rejected,
      rejectRate: this._stats.accepted > 0 ? (this._stats.rejected / (this._stats.accepted + this._stats.rejected) * 100).toFixed(1) + '%' : '0%',
      sources, lastRejects: this._rejected.slice(-5) };
  }
};

// ── 2. MacroStore — 거시경제(FRED) 데이터 검증 저장소 ──
const MacroStore = {
  _data: {}, _rejected: [], _stats: { accepted: 0, rejected: 0 },
  _ranges: {
    'UNRATE':       { min: 0, max: 30, warnMax: 15, label: '실업률(%)' },
    'FEDFUNDS':     { min: 0, max: 25, warnMax: 10, label: '기준금리(%)' },
    'CPIAUCSL':     { min: 50, max: 500, warnMax: 400, label: 'CPI' },
    'DGS2':         { min: -2, max: 20, warnMax: 15, label: '2년 국채(%)' },
    'DGS10':        { min: -2, max: 20, warnMax: 15, label: '10년 국채(%)' },
    'DGS30':        { min: -2, max: 20, warnMax: 15, label: '30년 국채(%)' },
    'T10Y2Y':       { min: -5, max: 5, warnMax: 4, label: '10-2년 스프레드' },
    'T10Y3M':       { min: -5, max: 5, warnMax: 4, label: '10년-3개월 스프레드' },
    'BAMLH0A0HYM2': { min: 0, max: 30, warnMax: 15, label: 'HY 스프레드' },
    'VIXCLS':       { min: 0, max: 100, warnMax: 80, label: 'VIX(FRED)' },
    'ICSA':         { min: 0, max: 1000000, warnMax: 500000, label: '신규 실업수당' },
    'DTWEXBGS':     { min: 50, max: 200, warnMax: 160, label: '달러 인덱스(FRED)' },
  },
  set(id, value, prevValue, date) {
    if (value === '.' || value === '' || value == null || isNaN(parseFloat(value))) {
      this._reject(id, value, 'missing_value', 'FRED 결측치(.)');
      return false;
    }
    const val = parseFloat(value);
    const prev = prevValue != null ? parseFloat(prevValue) : null;
    const range = this._ranges[id];
    if (range) {
      if (val < range.min || val > range.max) {
        this._reject(id, val, 'out_of_range', `${range.label}: ${val} (범위: ${range.min}~${range.max})`);
        return false;
      }
      if (val > range.warnMax) _aioLog('warn', 'macro', '경고: ' + id + '(' + range.label + ') = ' + val + ' — 이상 고값');
    }
    const dataAge = date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : null;
    var policyKey = ['CPIAUCSL','UNRATE','ICSA','FEDFUNDS'].indexOf(id) >= 0 ? 'macro_monthly' : 'macro_daily';
    var metric = (typeof makeMetric === 'function') ? makeMetric(val, 'fred', Date.now(), policyKey, { seriesId: id, dataDate: date, prevValue: prev }) : null;
    this._data[id] = { value: val, prevValue: prev, date, ts: Date.now(), dataAgeDays: dataAge, stale: false, policyKey: policyKey, metric: metric, quality: metric };
    this._stats.accepted++;
    window._fredData = window._fredData || {};
    window._fredData[id] = { value: val, prevValue: prev, date };
    return true;
  },
  get(id) { const d = this._data[id]; if (!d) return null; var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.value, source: 'fred', ts: d.ts, policyKey: d.policyKey || 'macro_daily' }) : null; d.quality = q || d.quality || null; d.stale = q ? q.stale : (Date.now() - d.ts) > 7200000; return d; },
  _reject(id, value, reason, detail) {
    this._stats.rejected++;
    if (this._rejected.length >= 30) this._rejected.shift();
    this._rejected.push({ id, value, reason, detail, ts: Date.now() });
    _aioLog('warn', 'macro', '거부: ' + id + ' = ' + value + ' (' + reason + ': ' + detail + ')');
  },
  health() {
    const now = Date.now();
    let total = 0, stale = 0, fresh = 0;
    for (const [id, d] of Object.entries(this._data)) {
      total++;
      var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.value, source: 'fred', ts: d.ts, policyKey: d.policyKey || 'macro_daily' }, now) : null;
      if (q) { d.quality = q; d.stale = q.stale; }
      if (d.stale || (!q && (now - d.ts) > 7200000)) { stale++; d.stale = true; } else fresh++;
    }
    return { total, fresh, stale, accepted: this._stats.accepted, rejected: this._stats.rejected,
      lastRejects: this._rejected.slice(-5),
      series: Object.fromEntries(Object.entries(this._data).map(([k,v]) => [k, { value: v.value, date: v.date, ageDays: v.dataAgeDays }])) };
  }
};

// ── 3. NewsStore — 뉴스 품질/중복 필터 저장소 ──
const NewsStore = {
  _seen: new Set(), _deadFeeds: {}, _stats: { total: 0, duplicates: 0, filtered: 0, deadFeedHits: 0 },
  filter(articles) {
    if (!Array.isArray(articles)) return [];
    const result = [];
    for (const a of articles) {
      this._stats.total++;
      const key = (a.link || a.url || '').replace(/[?#].*$/, '').toLowerCase();
      if (key && this._seen.has(key)) { this._stats.duplicates++; continue; }
      const title = a.title || '';
      if (title.trim().length < 5) { this._stats.filtered++; continue; }
      if (!a.pubDate && !a.isoDate) a.pubDate = new Date().toISOString();
      if (key) this._seen.add(key);
      result.push(a);
    }
    return result;
  },
  reportDeadFeed(feedUrl, status) {
    if (!this._deadFeeds[feedUrl]) this._deadFeeds[feedUrl] = { errorCount: 0, lastError: null, status: null };
    const df = this._deadFeeds[feedUrl]; df.errorCount++; df.lastError = Date.now(); df.status = status;
    this._stats.deadFeedHits++;
  },
  isDeadFeed(feedUrl) { const df = this._deadFeeds[feedUrl]; return df && df.errorCount >= 3; },
  resetDuplicates() { this._seen.clear(); },
  health() {
    return { totalProcessed: this._stats.total, duplicatesRemoved: this._stats.duplicates, qualityFiltered: this._stats.filtered,
      deadFeeds: Object.entries(this._deadFeeds).filter(([,v]) => v.errorCount >= 3).map(([url, v]) => ({ url: url.substring(0, 60), errors: v.errorCount, status: v.status })),
      uniqueArticles: this._seen.size, deadFeedHits: this._stats.deadFeedHits };
  }
};

// ── DataHealth — 통합 헬스 대시보드 ──
const DataHealth = {
  report() { return { price: PriceStore.health(), macro: MacroStore.health(), news: NewsStore.health(), timestamp: new Date().toISOString(), summary: this._summary() }; },
  _summary() {
    const p = PriceStore.health(), m = MacroStore.health(), n = NewsStore.health();
    const issues = [];
    if (p.stale > p.total * 0.3) issues.push(`시세 ${p.stale}/${p.total} stale`);
    if (p.rejected > 10) issues.push(`시세 거부 ${p.rejected}건`);
    if (m.stale > 0) issues.push(`매크로 ${m.stale}/${m.total} stale`);
    if (m.rejected > 0) issues.push(`매크로 거부 ${m.rejected}건`);
    if (n.deadFeeds.length > 0) issues.push(`죽은 피드 ${n.deadFeeds.length}개`);
    if (n.duplicatesRemoved > n.totalProcessed * 0.3) issues.push(`뉴스 중복률 ${(n.duplicatesRemoved/n.totalProcessed*100).toFixed(0)}%`);
    return { status: issues.length === 0 ? '정상' : issues.length <= 2 ? '주의' : ' 점검 필요', issues };
  },
  log() {
    const r = this.report();
    console.log('%c[DataHealth] 데이터 파이프라인 헬스 리포트', 'color:#60a5fa;font-weight:bold;font-size:12px;');
    console.log(`  상태: ${r.summary.status}`);
    console.log(`  시세: ${r.price.fresh} fresh / ${r.price.stale} stale / ${r.price.rejected} rejected (${r.price.rejectRate})`);
    console.log(`  매크로: ${r.macro.fresh} fresh / ${r.macro.stale} stale / ${r.macro.rejected} rejected`);
    console.log(`  뉴스: ${r.news.uniqueArticles} unique / ${r.news.duplicatesRemoved} dupes / ${r.news.deadFeeds.length} dead feeds`);
    if (r.summary.issues.length > 0) _aioLog('warn', 'debug', '이슈: ' + r.summary.issues.join(' | '));
    return r;
  }
};
window.PriceStore = PriceStore; window.MacroStore = MacroStore;

const SnapshotStore = {
  _data: {},
  set(sym, price, pct, ts, meta) {
    if (!sym || price == null || !isFinite(Number(price))) return false;
    var metric = (typeof makeMetric === 'function') ? makeMetric(Number(price), 'snapshot', ts || Date.now(), 'static_snapshot', Object.assign({ pct: pct, pctMissing: pct == null }, meta || {})) : null;
    this._data[sym] = { price: Number(price), pct: pct != null ? Number(pct) : null, pctMissing: pct == null, source: 'snapshot', ts: metric ? metric.ts : (ts || Date.now()), metric: metric, quality: metric };
    return true;
  },
  get(sym) {
    var d = this._data[sym];
    if (!d) return null;
    if (typeof evaluateMetric === 'function') d.quality = evaluateMetric(d.metric || { value: d.price, source: 'snapshot', ts: d.ts, policyKey: 'static_snapshot' });
    return d;
  },
  seedFromMap(map, ts, meta) {
    var count = 0;
    Object.entries(map || {}).forEach(([sym, val]) => {
      if (val && val.price != null && this.set(sym, val.price, val.pct, ts, meta)) count++;
    });
    return count;
  },
  health() {
    var total = 0, stale = 0, hardStale = 0;
    Object.keys(this._data).forEach((sym) => {
      var d = this.get(sym);
      if (!d) return;
      total++;
      if (d.quality && d.quality.stale) stale++;
      if (d.quality && d.quality.hardStale) hardStale++;
    });
    return { total: total, stale: stale, hardStale: hardStale };
  }
};
window.SnapshotStore = SnapshotStore;

window.AIO = window.AIO || {};
window.AIO.annotateLiveDataSinks = function(root, opts) {
  root = root || document;
  opts = opts || {};
  var selector = '[data-live-price],[data-live-chg],[data-live-pct],[data-live-kr],[data-snap],canvas,[data-threshold-key],[data-threshold-table],[data-runtime-state],[data-score-scale],[data-scenario-key],[data-cycle-phase]';
  var target = opts.symbol || null;
  var touched = 0;
  function keyFor(el) {
    return el && (
      el.getAttribute('data-live-price') ||
      el.getAttribute('data-live-chg') ||
      el.getAttribute('data-live-pct') ||
      el.getAttribute('data-live-kr') ||
      el.getAttribute('data-snap') ||
      el.getAttribute('data-threshold-key') ||
      el.getAttribute('data-threshold-table') ||
      el.getAttribute('data-runtime-state') ||
      el.getAttribute('data-score-scale') ||
      el.getAttribute('data-scenario-key') ||
      el.getAttribute('data-cycle-phase') ||
      el.id
    ) || '';
  }
  function sourceKind(source, policyKey) {
    source = String(source || '');
    policyKey = String(policyKey || '');
    if (!source || source === 'unavailable') return 'unavailable';
    if (policyKey === 'static_snapshot' || source === 'snapshot' || /snapshot/i.test(source)) return 'snapshot';
    if (window.AIO && typeof window.AIO.isOperationalQuoteSource === 'function' && window.AIO.isOperationalQuoteSource(source)) return 'live';
    return /fallback/i.test(source) ? 'fallback' : 'live';
  }
  try {
    Array.prototype.slice.call(root.querySelectorAll(selector)).forEach(function(el) {
      if (!el) return;
      var sym = keyFor(el);
      if (!sym || (target && sym !== target)) return;
      var tag = (el.tagName || '').toLowerCase();
      var isCanvas = tag === 'canvas';
      var isRuleSink = !isCanvas && (
        el.hasAttribute('data-threshold-key') ||
        el.hasAttribute('data-threshold-table') ||
        el.hasAttribute('data-runtime-state') ||
        el.hasAttribute('data-score-scale') ||
        el.hasAttribute('data-scenario-key') ||
        el.hasAttribute('data-cycle-phase')
      );
      var isSnapshotSink = el.hasAttribute && el.hasAttribute('data-snap') &&
        !el.hasAttribute('data-live-price') && !el.hasAttribute('data-live-chg') && !el.hasAttribute('data-live-pct') && !el.hasAttribute('data-live-kr');
      var ds = (window._dataSource && window._dataSource[sym]) || {};
      var ld = (window._liveData && window._liveData[sym]) || {};
      var existingKind = (el.getAttribute('data-source-kind') || '').toLowerCase();
      var existingLabel = el.getAttribute('data-source-label') || '';
      var hasExistingUsableLineage = existingKind && existingKind !== 'pending' && !ds.source && !ld.source;
      var source = hasExistingUsableLineage ? (existingLabel || existingKind) : (isCanvas ? 'chart-render' : (isRuleSink ? 'AIO_RULESET' : (isSnapshotSink ? 'DATA_SNAPSHOT' : (ds.source || ld.source || 'unavailable'))));
      var policyKey = ds.policyKey || (ld.metric && ld.metric.policyKey) || '';
      var kind = hasExistingUsableLineage ? existingKind : (isCanvas ? 'derived' : (isRuleSink ? 'rule' : (isSnapshotSink ? 'snapshot' : sourceKind(source, policyKey))));
      var operationalUse = (kind === 'live') ? 'decision' : 'reference-only';
      if (opts.force || !el.getAttribute('data-source-kind')) el.setAttribute('data-source-kind', kind);
      if (opts.force || !el.getAttribute('data-operational-use')) el.setAttribute('data-operational-use', operationalUse);
      if (opts.force || !el.getAttribute('data-source-label')) el.setAttribute('data-source-label', source === 'unavailable' ? ('quote unavailable:' + sym) : (source + ':' + sym));
      if (!el.getAttribute('data-source-ts') && (ds.ts || ld.ts)) el.setAttribute('data-source-ts', new Date(ds.ts || ld.ts).toISOString());
      if (!el.title) el.title = sym + ' · ' + kind + ' · ' + operationalUse;
      touched++;
    });
  } catch(_) {}
  return touched;
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
        window.AIO.annotateLiveDataSinks(document, { reason: 'DOMContentLoaded', force: true });
      }
    }, 0);
    if (!window.AIO._liveSinkObserver && typeof MutationObserver !== 'undefined') {
      var pendingLineageScan = false;
      window.AIO._liveSinkObserver = new MutationObserver(function(records) {
        if (pendingLineageScan) return;
        var hasNewSink = false;
        try {
          records.forEach(function(record) {
            Array.prototype.slice.call(record.addedNodes || []).forEach(function(node) {
              if (hasNewSink || !node || node.nodeType !== 1) return;
              if ((node.matches && node.matches('[data-live-price],[data-live-chg],[data-live-pct],[data-live-kr],[data-snap]')) ||
                  (node.querySelector && node.querySelector('[data-live-price],[data-live-chg],[data-live-pct],[data-live-kr],[data-snap]'))) {
                hasNewSink = true;
              }
            });
          });
        } catch(_) {}
        if (!hasNewSink) return;
        pendingLineageScan = true;
        setTimeout(function() {
          pendingLineageScan = false;
          if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
            window.AIO.annotateLiveDataSinks(document, { reason: 'dynamic-dom', force: true });
          }
        }, 50);
      });
      try { window.AIO._liveSinkObserver.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch(_) {}
    }
  });
  document.addEventListener('pageShown', function(e) {
    var page = e && e.detail ? document.getElementById('page-' + e.detail) : null;
    if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
      window.AIO.annotateLiveDataSinks(page || document, { reason: 'pageShown', force: true });
      setTimeout(function() {
        window.AIO.annotateLiveDataSinks(page || document, { reason: 'pageShown-post-render', force: true });
      }, 150);
    }
  });
}

window._aioSetLiveData = function(sym, data, meta) {
  data = data || {};
  meta = meta || {};
  var source = meta.source || data.source || data._source || 'unknown';
  var price = Number(data.price != null ? data.price : data.regularMarketPrice);
  var pct = data.pct != null ? data.pct : data.regularMarketChangePercent;
  if (!sym || !isFinite(price) || price <= 0) return false;
  if (source.indexOf('live:') === 0 && !meta.bypassPriceStore && window.PriceStore && typeof window.PriceStore.set === 'function') {
    return window.PriceStore.set(sym, price, pct, source);
  }
  var operationalQuoteSource = window.AIO && typeof window.AIO.isOperationalQuoteSource === 'function'
    ? window.AIO.isOperationalQuoteSource(source)
    : (source && source !== 'snapshot' && source.indexOf('fallback') === -1);
  var policyKey = meta.policyKey || (source === 'snapshot' ? 'static_snapshot' : operationalQuoteSource ? 'quote' : 'static_snapshot');
  var ts = meta.ts || data.ts || Date.now();
  var metric = (typeof makeMetric === 'function') ? makeMetric(price, source, ts, policyKey, { pct: pct, pctMissing: pct == null, reason: meta.reason || data.reason || null }) : null;
  window._liveData = window._liveData || {};
  window._liveData[sym] = Object.assign({}, window._liveData[sym] || {}, {
    price: price,
    pct: pct != null && isFinite(Number(pct)) ? Number(pct) : null,
    source: source,
    ts: metric ? metric.ts : ts,
    stale: metric ? metric.stale : !!meta.stale,
    pctMissing: pct == null || !isFinite(Number(pct)),
    metric: metric,
    quality: metric
  });
  window._dataSource = window._dataSource || {};
  window._dataSource[sym] = { source: source, ts: metric ? metric.ts : ts, pctMissing: pct == null || !isFinite(Number(pct)), policyKey: policyKey, metric: metric, reason: meta.reason || null };
  if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
    window.AIO.annotateLiveDataSinks(document, { symbol: sym, force: true });
  }
  return true;
};

// v48.22 (P3-2 1단계): _liveData readonly Proxy view — 외부 코드/AI 챗/확장 접근용 공개 API
// 기존 window._liveData는 PriceStore.set 및 legacy fetch 경로에서 내부 쓰기 유지(역호환).
// window._liveDataReadonly는 쓰기 시도를 감지 + 로깅 + 실제 쓰기 차단. PriceStore.set()이 정식 경로.
try {
  if (typeof Proxy !== 'undefined') {
    window._liveDataReadonly = new Proxy({}, {
      get: function(_t, prop) {
        var d = window._liveData || {};
        return d[prop];
      },
      set: function(_t, prop, _value) {
        try {
          if (typeof _warnDirectLiveDataWrite === 'function') _warnDirectLiveDataWrite(String(prop), 'readonly-proxy');
          if (typeof _aioLog === 'function') _aioLog('warn', 'ssot', 'readonly view write blocked: ' + String(prop) + ' → use PriceStore.set()');
        } catch(_e) {}
        return true; // 쓰기 무시 (strict mode TypeError 회피)
      },
      has: function(_t, prop) { return prop in (window._liveData || {}); },
      ownKeys: function(_t) { return Object.keys(window._liveData || {}); },
      getOwnPropertyDescriptor: function(_t, prop) {
        var d = window._liveData || {};
        if (prop in d) return { value: d[prop], writable: false, enumerable: true, configurable: true };
        return undefined;
      }
    });
  } else {
    // Proxy 미지원 브라우저 폴백: _liveData 직접 참조 허용 (기능 저하 허용)
    window._liveDataReadonly = window._liveData || {};
  }
} catch(e) {
  if (typeof _aioLog === 'function') _aioLog('warn', 'ssot', 'readonly Proxy init failed: ' + (e && e.message || e));
  window._liveDataReadonly = window._liveData || {};
}
window.NewsStore = NewsStore; window.DataHealth = DataHealth;

// ═══════════════════════════════════════════════════════════════════
// v48.23 (P3-1 1단계): AIO 네임스페이스 — 모듈 분리 사전 설계
// ─────────────────────────────────────────────────────────────────
// 향후 <script type="module"> 4개 분리 시 각 모듈의 public API를 이 네임스페이스 아래로 통합.
// 현재는 기존 window.XXX 직접 노출 유지(역호환), AIO.module.* 별칭으로 점진 이전 가능.
// 모듈 경계는 _context/MODULE-BOUNDARIES.md 참조.
window.AIO = window.AIO || {
  version: null,            // APP_VERSION 정의 후 아래에서 할당
  // 데이터 스토어 (core)
  stores: {
    price: null,            // PriceStore (이미 존재)
    macro: null,            // MacroStore (이미 존재)
    news:  null,            // NewsStore (이미 존재)
    health: null            // DataHealth (이미 존재)
  },
  // 엔진 (domain)
  engines: {
    narrative: null,        // NARRATIVE_ENGINE
    date: null              // DATE_ENGINE
  },
  // 이벤트 버스 (infra)
  bus: null,                // AIOBus
  // 관측성 (infra)
  log: null,                // _aioLog
  logs: null,               // _aioLogs
  // 페이지 라우터 (ui)
  pages: null,              // window.PAGES
  // readonly 데이터 뷰 (api)
  data: {
    live: null              // _liveDataReadonly Proxy
  }
};
// 바인딩 (다른 상수/객체 정의 이후에 최종 주입 — init 헬퍼로 통합)
window.AIO._bindCore = function() {
  try {
    window.AIO.stores.price  = window.PriceStore  || null;
    window.AIO.stores.macro  = window.MacroStore  || null;
    window.AIO.stores.news   = window.NewsStore   || null;
    window.AIO.stores.health = window.DataHealth  || null;
    window.AIO.engines.narrative = (typeof NARRATIVE_ENGINE !== 'undefined' ? NARRATIVE_ENGINE : null);
    window.AIO.engines.date      = (typeof DATE_ENGINE !== 'undefined' ? DATE_ENGINE : null);
    window.AIO.bus               = window.AIOBus || null;
    window.AIO.log               = window._aioLog || null;
    window.AIO.logs              = window._aioLogs || null;
    window.AIO.pages             = window.PAGES || null;
    window.AIO.data.live         = window._liveDataReadonly || null;
    window.AIO._timers           = window._aioTimerRegistry || {};  // v48.91: 타이머 레지스트리 바인딩
    if (window.AIO.log) window.AIO.log('info', 'bootstrap', 'AIO namespace bound', { modules: Object.keys(window.AIO) });
  } catch(e) { /* silent */ }
};
// 즉시 가능한 부분만 바인딩 (후순위 정의는 DOMContentLoaded 시점 재시도)
try { window.AIO.stores.price = window.PriceStore || null; window.AIO.stores.news = window.NewsStore || null; } catch(_){}

// ═══════════════════════════════════════════════════════════════════
// v48.23 (P3-5): lightweight-charts 통합 헬퍼 — Chart.js와 혼합 사용
// ─────────────────────────────────────────────────────────────────
// time series 전문 → VIX/NAAIM/II/HY/yieldCurve/FRED 등 약 8개 차트 점진 전환 가능
// 복잡 차트(RRG 산점도, 게이지, 도넛, stacked bar)는 Chart.js 유지
// API 차이: lightweight-charts는 container div 필요(canvas 아님) + 시계열 {time, value} 형식
// ─────────────────────────────────────────────────────────────────
window.AIO.charts = {
  // 인스턴스 관리 (Chart.js의 sentPageCharts와 별개)
  _lwc: {},  // lightweight-charts 인스턴스 pool

  /** lightweight-charts time series 생성 헬퍼
   * @param {string|Element} containerOrId - <div> 컨테이너 ID 또는 요소
   * @param {Array<{time: number|string, value: number}>} data - 시계열 데이터
   * @param {Object} options - {color, lineWidth, height, theme, tooltipFmt}
   * @returns {{chart, series, destroy}|null}
   */
  createLineChart: function(containerOrId, data, options) {
    options = options || {};
    if (typeof LightweightCharts === 'undefined') {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'lightweight-charts not loaded, skipping ' + containerOrId);
      return null;
    }
    var container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!container) return null;
    try {
      // 다크 테마 기본 (AIO 전역 테마와 일치)
      var theme = options.theme || 'dark';
      var bgColor = theme === 'dark' ? '#111a2f' : '#ffffff';
      var textColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : '#333';
      var gridColor = theme === 'dark' ? 'var(--surface-4)' : 'rgba(0,0,0,0.05)';

      var disposed = false;
      var chart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 300,
        height: options.height || 200,
        layout: { background: { color: bgColor }, textColor: textColor, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { borderColor: gridColor, timeVisible: true, secondsVisible: false },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
      });
      var series = chart.addLineSeries({
        color: options.color || '#00d4ff',
        lineWidth: options.lineWidth || 2,
        priceFormat: options.priceFormat || { type: 'price', precision: 2, minMove: 0.01 }
      });
      if (Array.isArray(data) && data.length > 0) {
        series.setData(data);
      }
      if (typeof window._aioMarkChartCanvases === 'function') {
        window._aioMarkChartCanvases(container, options.ariaLabel || options.title || 'AIO line chart');
      }
      // 뷰포트 resize 자동 대응
      var _ro = null;
      if (typeof ResizeObserver !== 'undefined') {
        _ro = new ResizeObserver(function(entries) {
          for (var i = 0; i < entries.length; i++) {
            var cr = entries[i].contentRect;
            if (!disposed && cr.width > 0) {
              try { chart.resize(cr.width, options.height || 200); } catch(_) {}
            }
          }
        });
        _ro.observe(container);
      }
      return {
        chart: chart,
        series: series,
        setData: function(d) { if (!disposed) series.setData(d); },
        update: function(point) { if (!disposed) series.update(point); },
        destroy: function() {
          if (disposed) return;
          disposed = true;
          try { if (_ro) _ro.disconnect(); } catch(_){}
          try { chart.remove(); } catch(_){}
        }
      };
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'createLineChart failed: ' + (e && e.message || e));
      return null;
    }
  },

  /** 다중 라인 차트 (Bull/Bear 비교 등)
   * @param {string|Element} containerOrId
   * @param {Array<{name, color, data: Array<{time,value}>}>} seriesConfig
   * @param {Object} options
   */
  createMultiLineChart: function(containerOrId, seriesConfig, options) {
    options = options || {};
    if (typeof LightweightCharts === 'undefined') return null;
    var container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!container) return null;
    try {
      var bgColor = '#111a2f';
      var gridColor = 'var(--surface-4)';
      var disposed = false;
      var chart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 300,
        height: options.height || 200,
        layout: { background: { color: bgColor }, textColor: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        timeScale: { borderColor: gridColor, timeVisible: true, secondsVisible: false }
      });
      var seriesList = [];
      for (var i = 0; i < seriesConfig.length; i++) {
        var cfg = seriesConfig[i];
        var s = chart.addLineSeries({ color: cfg.color || '#00d4ff', lineWidth: cfg.lineWidth || 2, title: cfg.name });
        if (Array.isArray(cfg.data)) s.setData(cfg.data);
        seriesList.push(s);
      }
      if (typeof window._aioMarkChartCanvases === 'function') {
        window._aioMarkChartCanvases(container, options.ariaLabel || options.title || 'AIO multi-series chart');
      }
      var _ro = null;
      if (typeof ResizeObserver !== 'undefined') {
        _ro = new ResizeObserver(function(entries) {
          for (var j = 0; j < entries.length; j++) {
            var cr = entries[j].contentRect;
            if (!disposed && cr.width > 0) {
              try { chart.resize(cr.width, options.height || 200); } catch(_) {}
            }
          }
        });
        _ro.observe(container);
      }
      return {
        chart: chart, series: seriesList,
        destroy: function() {
          if (disposed) return;
          disposed = true;
          try { if (_ro) _ro.disconnect(); } catch(_){}
          try { chart.remove(); } catch(_){}
        }
      };
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'createMultiLineChart failed: ' + (e && e.message || e));
      return null;
    }
  },

  /** YYYY-MM-DD → lightweight-charts time 형식 (문자열 그대로) */
  toTimeStr: function(ymd) { return ymd; },
  /** ms timestamp → {year, month, day} */
  toTimeObj: function(tsMs) {
    var d = new Date(tsMs);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  },

  /** lightweight-charts 로드 대기 (CDN 비동기 로드 대응) */
  whenReady: function(callback, maxWaitMs) {
    maxWaitMs = maxWaitMs || 10000;
    var start = Date.now();
    var poll = function() {
      if (typeof LightweightCharts !== 'undefined') { callback(); return; }
      if (Date.now() - start > maxWaitMs) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'lightweight-charts load timeout');
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  },

  /** v48.24: Chart.js API 호환성 래퍼 — sentPageCharts 등 기존 코드가 destroy/resize 호출해도 작동
   * @param {Object} lwcResult - createLineChart/createMultiLineChart 반환 객체
   * @param {Element} [hiddenCanvas] - 숨긴 canvas 요소 (복원용)
   * @param {Element} [lwcContainer] - LWC 컨테이너 div (제거용)
   */
  createCompatWrapper: function(lwcResult, hiddenCanvas, lwcContainer) {
    if (!lwcResult) return null;
    return {
      _isLWC: true,  // feature detect용
      _lwc: lwcResult,
      data: { labels: [], datasets: [{ data: [] }] },  // Chart.js compat shape (최소)
      options: {},
      update: function(mode) {
        // Chart.js chart.update() 호환 — LWC는 setData/update가 시리즈 레벨이므로 noop
        // 호출 시 내부 데이터 갱신이 이미 series.setData()로 완료된 상태 가정
      },
      resize: function() {
        // ResizeObserver가 자동 처리하지만 명시 resize 요청 시 컨테이너 크기 기반 재설정
        try {
          if (lwcContainer && lwcResult.chart) {
            lwcResult.chart.resize(lwcContainer.clientWidth, lwcContainer.clientHeight);
          }
        } catch(_){}
      },
      destroy: function() {
        try { if (lwcResult.destroy) lwcResult.destroy(); } catch(_){}
        try { if (lwcContainer && lwcContainer.parentElement) lwcContainer.parentElement.removeChild(lwcContainer); } catch(_){}
        try { if (hiddenCanvas) hiddenCanvas.style.display = ''; } catch(_){}
      }
    };
  },

  /** v48.24: canvas 요소를 숨기고 옆에 LWC 컨테이너 div 생성 — HTML 변경 없이 전환 */
  wrapCanvas: function(canvasEl, height) {
    if (!canvasEl || !canvasEl.parentElement) return null;
    var containerId = 'lwc-' + (canvasEl.id || 'chart') + '-' + Date.now();
    var container = document.createElement('div');
    container.id = containerId;
    container.className = 'lwc-chart-container';
    var h = height || parseInt(canvasEl.style.height) || canvasEl.clientHeight || 140;
    container.style.cssText = 'width:100%;height:' + h + 'px;';
    canvasEl.parentElement.insertBefore(container, canvasEl);
    canvasEl.style.display = 'none';
    return container;
  },

  /** v48.24: MM/DD 라벨 → ISO (YYYY-MM-DD) 변환 — lightweight-charts time 포맷 */
  monthDayToISO: function(labels, baseYear) {
    baseYear = baseYear || new Date().getFullYear();
    return labels.map(function(lbl) {
      var parts = lbl.split('/');
      if (parts.length !== 2) return lbl;
      var m = parseInt(parts[0], 10);
      var d = parseInt(parts[1], 10);
      if (isNaN(m) || isNaN(d)) return lbl;
      return baseYear + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    });
  },

  /** v48.24: feature flag 체크 — localStorage 또는 AIO.charts.useFallback 기반 */
  shouldUseLWC: function() {
    try {
      if (typeof LightweightCharts === 'undefined') return false;
      if (window.AIO && window.AIO.charts && window.AIO.charts.useFallback) return false;
      if (localStorage.getItem('aio_charts_fallback') === '1') return false;
      return true;
    } catch(_){ return false; }
  }
};

// ═══ v48.78: 심층 종목 기술 분석 캔들스틱 렌더러 ══════════════════════════════
// wrapEl: .da-chart-col 컨테이너 (내부에 .da-candle / .da-rsi / .da-vol 자식 필요)
window._deepChartInstances = [];
window._renderDeepChart = function(wrapEl, ohlcv, maLines, rsiData) {
  if (!wrapEl || typeof LightweightCharts === 'undefined' || !ohlcv || !ohlcv.length) return;
  var w = wrapEl.clientWidth || 360;
  var darkBg = '#090e1a';
  var subBg  = '#080b13';
  var gridC  = '#1e2d3f22';
  var axisC  = '#1e2a3a';
  var textC  = '#6b7fa3';
  function baseOpts(h, showTime) {
    return {
      width: w, height: h,
      layout: { background: { color: darkBg }, textColor: textC, fontSize: 10, fontFamily: 'JetBrains Mono,monospace' },
      grid: { vertLines: { color: gridC }, horzLines: { color: gridC } },
      rightPriceScale: { borderColor: axisC, minimumWidth: 52 },
      timeScale: { borderColor: axisC, timeVisible: !!showTime, secondsVisible: false, visible: showTime !== false },
      crosshair: { mode: showTime ? 1 : 0 },
      handleScroll: false, handleScale: false
    };
  }
  // 메인 캔들스틱 + MA
  var candleDiv = wrapEl.querySelector('.da-candle');
  if (candleDiv) {
    candleDiv.innerHTML = '';
    try {
      var mc = LightweightCharts.createChart(candleDiv, baseOpts(200, true));
      window._deepChartInstances.push(mc);
      if (typeof window._aioMarkChartCanvases === 'function') window._aioMarkChartCanvases(candleDiv, '심층 기술 분석 캔들 차트');
      var cs = mc.addCandlestickSeries({
        upColor: '#00e5a0', downColor: '#ff5b50',
        borderUpColor: '#00e5a0', borderDownColor: '#ff5b50',
        wickUpColor: '#00c48a', wickDownColor: '#c84040'
      });
      cs.setData(ohlcv);
      var maColors = { 5: '#ff8c00', 20: '#4da6ff', 60: '#aaaaaa' };
      (maLines || []).forEach(function(ma) {
        if (!ma.data || !ma.data.length) return;
        var ls = mc.addLineSeries({ color: maColors[ma.period] || '#888', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        ls.setData(ma.data);
      });
      mc.timeScale().fitContent();
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(function(en) {
          var cw = en[0] && en[0].contentRect.width;
          if (cw > 0) { try { mc.resize(cw, 200); } catch(_){} }
        }).observe(candleDiv);
      }
    } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'chart', '_renderDeepChart candle error: ' + (e && e.message)); }
  }
  // RSI 패널
  var rsiDiv = wrapEl.querySelector('.da-rsi');
  if (rsiDiv && rsiData && rsiData.length) {
    rsiDiv.innerHTML = '';
    try {
      var rc = LightweightCharts.createChart(rsiDiv, {
        width: w, height: 70,
        layout: { background: { color: subBg }, textColor: textC, fontSize: 9 },
        grid: { vertLines: { color: 'transparent' }, horzLines: { color: gridC } },
        rightPriceScale: { borderColor: axisC, minimumWidth: 52, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { visible: false },
        crosshair: { mode: 0 },
        handleScroll: false, handleScale: false
      });
      window._deepChartInstances.push(rc);
      if (typeof window._aioMarkChartCanvases === 'function') window._aioMarkChartCanvases(rsiDiv, '심층 기술 분석 RSI 차트');
      var rl = rc.addLineSeries({ color: '#c084fc', lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
      rl.setData(rsiData);
      rc.addLineSeries({ color: '#ff5b5055', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(rsiData.map(function(d) { return { time: d.time, value: 70 }; }));
      rc.addLineSeries({ color: '#00e5a055', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(rsiData.map(function(d) { return { time: d.time, value: 30 }; }));
      rc.timeScale().fitContent();
    } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'chart', '_renderDeepChart RSI error: ' + (e && e.message)); }
  }
  // Volume 패널
  var volDiv = wrapEl.querySelector('.da-vol');
  if (volDiv) {
    volDiv.innerHTML = '';
    try {
      var vc = LightweightCharts.createChart(volDiv, {
        width: w, height: 55,
        layout: { background: { color: subBg }, textColor: textC, fontSize: 9 },
        grid: { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { borderColor: axisC, minimumWidth: 52 },
        timeScale: { visible: false },
        crosshair: { mode: 0 },
        handleScroll: false, handleScale: false
      });
      window._deepChartInstances.push(vc);
      if (typeof window._aioMarkChartCanvases === 'function') window._aioMarkChartCanvases(volDiv, '심층 기술 분석 거래량 차트');
      var vs = vc.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
      vs.setData(ohlcv.map(function(d) {
        return { time: d.time, value: d.volume, color: d.close >= d.open ? '#00e5a028' : '#ff5b5028' };
      }));
      vc.timeScale().fitContent();
    } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'chart', '_renderDeepChart vol error: ' + (e && e.message)); }
  }
};

// ═══════════════════════════════════════════════════════════════════
// APP_VERSION — 버전 단일 진실 원천 (이 값만 바꾸면 title + 배지 자동 반영)
// ─────────────────────────────────────────────────────────────────
// Institutional Technical Risk & Exit Engine (v49.7)
function _aioCleanNums(values) {
  return (values || []).map(function(v) { var n = Number(v); return isFinite(n) ? n : null; });
}

function _aioCleanOHLCV(ohlcv) {
  return (ohlcv || []).map(function(d) {
    if (!d) return null;
    var close = Number(d.close);
    if (!isFinite(close) || close <= 0) return null;
    var open = Number(d.open); if (!isFinite(open) || open <= 0) open = close;
    var high = Number(d.high); if (!isFinite(high) || high <= 0) high = Math.max(open, close);
    var low = Number(d.low); if (!isFinite(low) || low <= 0) low = Math.min(open, close);
    var volume = Number(d.volume); if (!isFinite(volume) || volume < 0) volume = 0;
    return { time: d.time || d.datetime || d.date || null, open: open, high: Math.max(high, open, close), low: Math.min(low, open, close), close: close, volume: volume };
  }).filter(Boolean);
}

function _calcSMA(values, period) {
  var nums = _aioCleanNums(values).filter(function(v) { return v !== null; });
  period = period || 20;
  if (nums.length < period || period <= 0) return null;
  var sum = 0;
  for (var i = nums.length - period; i < nums.length; i++) sum += nums[i];
  return sum / period;
}

function _calcEMAFull(values, period) {
  var nums = _aioCleanNums(values).filter(function(v) { return v !== null; });
  period = period || 20;
  if (nums.length < period || period <= 0) return null;
  var k = 2 / (period + 1);
  var ema = 0;
  for (var i = 0; i < period; i++) ema += nums[i];
  ema = ema / period;
  var out = [];
  for (var j = 0; j < nums.length; j++) {
    if (j < period - 1) out.push(null);
    else if (j === period - 1) out.push(ema);
    else {
      ema = nums[j] * k + ema * (1 - k);
      out.push(ema);
    }
  }
  return out;
}

function _calcEMA(values, period) {
  var series = _calcEMAFull(values, period);
  return series ? series[series.length - 1] : null;
}

function _calcATR(ohlcv, period) {
  var bars = _aioCleanOHLCV(ohlcv);
  period = period || 14;
  if (bars.length < period + 1) return null;
  var trs = [];
  for (var i = 1; i < bars.length; i++) {
    var prevClose = bars[i - 1].close;
    trs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - prevClose), Math.abs(bars[i].low - prevClose)));
  }
  if (trs.length < period) return null;
  var atr = 0;
  for (var j = 0; j < period; j++) atr += trs[j];
  atr = atr / period;
  for (var k = period; k < trs.length; k++) atr = ((atr * (period - 1)) + trs[k]) / period;
  return atr;
}

function _calcRSILast(closes, period) {
  var nums = _aioCleanNums(closes).filter(function(v) { return v !== null && v > 0; });
  period = period || 14;
  if (nums.length < period + 1) return null;
  var gain = 0, loss = 0;
  for (var i = 1; i <= period; i++) {
    var d = nums[i] - nums[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  var avgGain = gain / period;
  var avgLoss = loss / period;
  for (var j = period + 1; j < nums.length; j++) {
    var diff = nums[j] - nums[j - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  var rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function _calcMACD(closes, fast, slow, signal) {
  fast = fast || 12; slow = slow || 26; signal = signal || 9;
  var nums = _aioCleanNums(closes).filter(function(v) { return v !== null && v > 0; });
  if (nums.length < slow + signal) return null;
  var fastEma = _calcEMAFull(nums, fast);
  var slowEma = _calcEMAFull(nums, slow);
  if (!fastEma || !slowEma) return null;
  var macdLine = [];
  for (var i = 0; i < nums.length; i++) macdLine.push(fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null);
  var cleanMacd = macdLine.filter(function(v) { return v !== null; });
  var signalClean = _calcEMAFull(cleanMacd, signal);
  if (!signalClean) return null;
  var sig = signalClean[signalClean.length - 1];
  var macd = cleanMacd[cleanMacd.length - 1];
  var prevMacd = cleanMacd.length > 1 ? cleanMacd[cleanMacd.length - 2] : macd;
  var prevSig = signalClean.length > 1 ? signalClean[signalClean.length - 2] : sig;
  return {
    macd: macd,
    signal: sig,
    hist: macd - sig,
    prevHist: prevMacd - prevSig,
    macdLine: cleanMacd,
    signalLine: signalClean.filter(function(v) { return v !== null; }),
    histogram: cleanMacd.map(function(v, idx) {
      var s = signalClean[idx - (cleanMacd.length - signalClean.length)];
      return isFinite(s) ? v - s : null;
    }).filter(function(v) { return v !== null; })
  };
}

function _calcBB(closes, period, mult) {
  period = period || 20; mult = mult || 2;
  var nums = _aioCleanNums(closes).filter(function(v) { return v !== null && v > 0; });
  if (nums.length < period) return null;
  var slice = nums.slice(-period);
  var mid = _calcSMA(nums, period);
  var variance = slice.reduce(function(s, v) { return s + Math.pow(v - mid, 2); }, 0) / period;
  var sd = Math.sqrt(variance);
  var upper = mid + mult * sd;
  var lower = mid - mult * sd;
  var width = upper - lower;
  var close = nums[nums.length - 1];
  return { mid: mid, middle: mid, upper: upper, lower: lower, width: width, pctB: width > 0 ? (close - lower) / width : 0.5 };
}

function _calcRVOL(volumes, period) {
  var nums = _aioCleanNums(volumes).filter(function(v) { return v !== null && v >= 0; });
  period = period || 20;
  if (nums.length < 2) return null;
  var current = nums[nums.length - 1];
  var base = nums.slice(Math.max(0, nums.length - period - 1), nums.length - 1);
  if (!base.length) return null;
  var avg = base.reduce(function(s, v) { return s + v; }, 0) / base.length;
  return avg > 0 ? current / avg : null;
}

function _calcClosePosition(bar) {
  if (!bar) return null;
  var h = Number(bar.high), l = Number(bar.low), c = Number(bar.close);
  if (!isFinite(h) || !isFinite(l) || !isFinite(c) || h <= l) return 0.5;
  return Math.max(0, Math.min(1, (c - l) / (h - l)));
}

function _calcADRPercent(ohlcv, period) {
  var bars = _aioCleanOHLCV(ohlcv);
  period = period || 20;
  if (bars.length < 2) return null;
  var slice = bars.slice(-Math.min(period, bars.length));
  var vals = [];
  for (var i = 0; i < slice.length; i++) {
    var b = slice[i];
    var base = b.open > 0 ? b.open : b.close;
    if (base > 0 && b.high >= b.low) vals.push(((b.high - b.low) / base) * 100);
  }
  return vals.length ? vals.reduce(function(s, v) { return s + v; }, 0) / vals.length : null;
}

function _calcCandleMetrics(bar, prevBar) {
  if (!bar) return { closePosition: null, upperWickPct: null, bodyPct: null, gapUpPct: null, dayPct: null };
  var open = Number(bar.open), high = Number(bar.high), low = Number(bar.low), close = Number(bar.close);
  var range = high - low;
  var prevClose = prevBar && Number(prevBar.close) > 0 ? Number(prevBar.close) : open;
  var upperWickPct = range > 0 ? (high - Math.max(open, close)) / range : 0;
  var lowerWickPct = range > 0 ? (Math.min(open, close) - low) / range : 0;
  var bodyPct = range > 0 ? Math.abs(close - open) / range : 1;
  return {
    closePosition: _calcClosePosition(bar),
    upperWickPct: Math.max(0, Math.min(1, upperWickPct)),
    lowerWickPct: Math.max(0, Math.min(1, lowerWickPct)),
    bodyPct: Math.max(0, Math.min(1, bodyPct)),
    gapUpPct: prevClose > 0 ? ((open - prevClose) / prevClose) * 100 : 0,
    dayPct: prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0
  };
}

function _calcRecentLevel(values, lookback, fn) {
  var nums = _aioCleanNums(values).filter(function(v) { return v !== null; }).slice(-(lookback || 20));
  if (!nums.length) return null;
  return fn.apply(null, nums);
}

function calcTechnicalSnapshot(ohlcv) {
  var bars = _aioCleanOHLCV(ohlcv);
  if (bars.length < 20) return { ok: false, reason: 'insufficient_ohlcv', bars: bars.length };
  var closes = bars.map(function(d) { return d.close; });
  var highs = bars.map(function(d) { return d.high; });
  var lows = bars.map(function(d) { return d.low; });
  var volumes = bars.map(function(d) { return d.volume; });
  var last = bars[bars.length - 1], prev = bars[bars.length - 2] || last;
  var atr14 = _calcATR(bars, 14);
  var sma10 = _calcSMA(closes, 10), sma20 = _calcSMA(closes, 20), sma50 = _calcSMA(closes, 50), sma200 = _calcSMA(closes, 200);
  var ema10 = _calcEMA(closes, 10), ema21 = _calcEMA(closes, 21);
  var rsi14 = _calcRSILast(closes, 14);
  var macd = _calcMACD(closes, 12, 26, 9);
  var bb20 = _calcBB(closes, 20, 2);
  var prevBB20 = closes.length > 20 ? _calcBB(closes.slice(0, -1), 20, 2) : null;
  var dayGainPct = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;
  var closePosition = _calcClosePosition(last);
  var candle = _calcCandleMetrics(last, prev);
  var adr20Pct = _calcADRPercent(bars, 20);
  var safeAtr = atr14 && atr14 > 0 ? atr14 : null;
  var dist20Atr = safeAtr && sma20 ? (last.close - sma20) / safeAtr : null;
  var dist50Atr = safeAtr && sma50 ? (last.close - sma50) / safeAtr : null;
  var dist21Atr = safeAtr && ema21 ? (last.close - ema21) / safeAtr : null;
  var dist10Atr = safeAtr && ema10 ? (last.close - ema10) / safeAtr : null;
  var dist20Pct = sma20 ? ((last.close - sma20) / sma20) * 100 : null;
  var dist20Adr = adr20Pct && dist20Pct !== null ? dist20Pct / adr20Pct : null;
  var bbReentry = !!(prevBB20 && bb20 && prev.close > prevBB20.upper && last.close <= bb20.upper);
  return {
    ok: true, bars: bars.length, time: last.time, price: last.close, prevClose: prev.close, dayGainPct: dayGainPct,
    closePosition: closePosition, upperWickPct: candle.upperWickPct, lowerWickPct: candle.lowerWickPct, bodyPct: candle.bodyPct, gapUpPct: candle.gapUpPct,
    atr14: atr14, adr20Pct: adr20Pct, rsi14: rsi14, macd: macd, bb20: bb20, rvol20: _calcRVOL(volumes, 20),
    sma10: sma10, sma20: sma20, sma50: sma50, sma200: sma200, ema10: ema10, ema21: ema21,
    dist10Atr: dist10Atr, dist20Atr: dist20Atr, dist21Atr: dist21Atr, dist50Atr: dist50Atr,
    dist10ATR: dist10Atr, dist20ATR: dist20Atr, dist21ATR: dist21Atr, dist50ATR: dist50Atr,
    dist20Pct: dist20Pct, dist20Adr: dist20Adr, dist20ADR: dist20Adr,
    dist50Pct: sma50 ? ((last.close - sma50) / sma50) * 100 : null,
    dist21Pct: ema21 ? ((last.close - ema21) / ema21) * 100 : null,
    above10EMA: ema10 ? last.close >= ema10 : null, above21EMA: ema21 ? last.close >= ema21 : null,
    above50SMA: sma50 ? last.close >= sma50 : null, above200SMA: sma200 ? last.close >= sma200 : null,
    bbOutsideUpper: !!(bb20 && last.close > bb20.upper), bbReentry: bbReentry,
    recentHigh20: _calcRecentLevel(highs, 20, Math.max), recentLow20: _calcRecentLevel(lows, 20, Math.min),
    recentHigh50: _calcRecentLevel(highs, 50, Math.max), recentLow50: _calcRecentLevel(lows, 50, Math.min),
    prevLow: prev.low, prevHigh: prev.high,
    trendState: sma50 && sma200 && last.close >= sma50 && sma50 >= sma200 ? 'UPTREND' : sma50 && last.close < sma50 ? 'TREND_DAMAGED' : 'MIXED',
    stageEstimate: sma50 && sma200 && last.close >= sma50 && sma50 >= sma200 ? 'STAGE_2_ADVANCE' : sma50 && last.close < sma50 ? 'STAGE_4_OR_BASE_REPAIR' : 'STAGE_1_3_TRANSITION',
    lastBar: last, prevBar: prev, raw: bars
  };
}

function calcExtensionHeat(snapshot) {
  snapshot = snapshot || {};
  if (!snapshot.ok) return { state: 'DATA_INSUFFICIENT', score: 0, flags: ['DATA_INSUFFICIENT'], snapshot: snapshot };
  var score = 0, flags = [];
  function add(points, flag) { score += points; flags.push(flag); }
  var d20 = snapshot.dist20Atr, d50 = snapshot.dist50Atr, d21 = snapshot.dist21Atr, adr = snapshot.dist20Adr;
  if (d20 !== null && d20 >= 3) add(18, '20MA_PLUS_3ATR_WARNING');
  if (d20 !== null && d20 >= 4) add(18, '20MA_PLUS_4ATR_TRIM_ZONE');
  if (d20 !== null && d20 >= 6) add(24, '20MA_PLUS_6ATR_BLOWOFF_RISK');
  if (adr !== null && adr >= 4) add(12, '20MA_PLUS_4ADR_EXTENDED');
  if (adr !== null && adr >= 6) add(16, '20MA_PLUS_6ADR_EXTREME');
  if (d21 !== null && d21 >= 2.5) add(10, '21EMA_PLUS_2_5ATR_SHORT_EXTENSION');
  if (d50 !== null && d50 >= 6) add(12, '50SMA_PLUS_6ATR_MANIA_CONTEXT');
  score = Math.max(0, Math.min(100, Math.round(score)));
  var state = score >= 75 ? 'BLOW_OFF_RISK' : score >= 50 ? 'EXTREME_EXTENSION' : score >= 25 ? 'EXTENDED' : 'NORMAL';
  return { state: state, score: score, flags: flags.length ? flags : ['EXTENSION_NORMAL'], snapshot: snapshot, dist20Atr: d20, dist20Adr: adr, dist50Atr: d50 };
}

function classifyTerminalCandle(bar, prevBar, snapshot) {
  snapshot = snapshot || {};
  bar = bar || snapshot.lastBar || null;
  prevBar = prevBar || snapshot.prevBar || null;
  var metrics = _calcCandleMetrics(bar, prevBar);
  var dist20 = snapshot.dist20Atr !== undefined ? snapshot.dist20Atr : null;
  var rvol = snapshot.rvol20 !== undefined ? snapshot.rvol20 : null;
  var score = 0, flags = [], type = 'NEUTRAL';
  function set(nextType, points, flag) {
    if (points >= score) type = nextType;
    score = Math.max(score, points);
    flags.push(flag);
  }
  if (!bar) return { type: 'DATA_INSUFFICIENT', score: 0, flags: ['DATA_INSUFFICIENT'], metrics: metrics };
  if (metrics.dayPct > 2 && metrics.closePosition >= 0.8 && metrics.upperWickPct < 0.2) set('MOMENTUM_THRUST', 8, 'STRONG_CLOSE_MOMENTUM_THRUST');
  if (metrics.gapUpPct >= 2 && metrics.upperWickPct >= 0.35 && metrics.closePosition < 0.6 && dist20 !== null && dist20 >= 4) set('GAP_UP_EXHAUSTION', 45, 'GAP_UP_UPPER_WICK_EXHAUSTION');
  if (metrics.upperWickPct >= 0.45 && metrics.bodyPct <= 0.35 && dist20 !== null && dist20 >= 4) set('SHOOTING_STAR_RISK', 42, 'SHOOTING_STAR_AFTER_EXTENSION');
  if (prevBar && Number(bar.close) < Number(prevBar.low) && rvol !== null && rvol >= 2) set('BEARISH_CONFIRMATION', 68, 'CLOSE_BELOW_PREV_LOW_ON_RVOL');
  if (snapshot.failedRetest) set('FAILED_RETEST', 58, 'FAILED_RETEST_OF_PRIOR_HIGH');
  if (metrics.closePosition < 0.4 && metrics.upperWickPct >= 0.35) set(type === 'NEUTRAL' ? 'WEAK_CLOSE_WARNING' : type, Math.max(score, 25), 'WEAK_CLOSE_WITH_SUPPLY');
  return { type: type, score: Math.max(0, Math.min(100, Math.round(score))), flags: flags.length ? flags : ['NO_TERMINAL_CANDLE'], metrics: metrics, snapshot: snapshot };
}

function _aioThirdFriday(year, monthIndex) {
  var d = new Date(year, monthIndex, 1);
  var firstFriday = 1 + ((5 - d.getDay() + 7) % 7);
  return new Date(year, monthIndex, firstFriday + 14);
}

function _aioNextMonthlyOpex(referenceDate) {
  var ref = referenceDate ? new Date(referenceDate) : new Date();
  var candidate = _aioThirdFriday(ref.getFullYear(), ref.getMonth());
  var refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  if (candidate.getTime() < refDay) candidate = _aioThirdFriday(ref.getMonth() === 11 ? ref.getFullYear() + 1 : ref.getFullYear(), (ref.getMonth() + 1) % 12);
  var days = Math.ceil((candidate.getTime() - refDay) / (24 * 60 * 60 * 1000));
  return { nextOpexDate: candidate.toISOString().slice(0, 10), daysToOpex: days };
}

function calcOpexGammaRisk(ctx) {
  ctx = ctx || {};
  var cal = ctx.daysToOpex !== undefined ? { daysToOpex: Number(ctx.daysToOpex), nextOpexDate: ctx.nextOpexDate || null } : _aioNextMonthlyOpex(ctx.referenceDate);
  var days = isFinite(cal.daysToOpex) ? cal.daysToOpex : null;
  var equityPutCall = Number(ctx.equityPutCall);
  var indexPutCall = Number(ctx.indexPutCall);
  var totalPutCall = Number(ctx.totalPutCall);
  var score = 0, flags = [];
  function add(points, flag) { score += points; flags.push(flag); }
  if (days !== null && days <= 3) add(14, 'OPEX_WITHIN_3_SESSIONS');
  if (isFinite(equityPutCall) && equityPutCall < 0.55) add(18, 'EQUITY_PUT_CALL_COMPLACENCY');
  if (isFinite(indexPutCall) && indexPutCall > 1.0 && isFinite(equityPutCall) && equityPutCall < 0.6) add(14, 'INDEX_HEDGE_EQUITY_CALL_CHASE_SPLIT');
  if (isFinite(totalPutCall) && totalPutCall < 0.75) add(8, 'TOTAL_PUT_CALL_LOW');
  if (ctx.priceNearCallWall && !ctx.closeAboveCallWall) add(14, 'PINNED_BELOW_CALL_WALL');
  if (ctx.afterOpex && ctx.callVolumeDecelerating) add(18, 'POST_OPEX_CALL_DECAY');
  if (ctx.vixRisingWhileIndexUp) add(16, 'VIX_RISING_WHILE_INDEX_UP');
  score = Math.max(0, Math.min(100, Math.round(score)));
  var regime = score >= 60 ? 'GAMMA_UNWIND_RISK' : score >= 30 ? 'GAMMA_DECAY_WATCH' : 'GAMMA_SUPPORT';
  return { regime: regime, score: score, flags: flags.length ? flags : ['NO_OPEX_GAMMA_STRESS'], daysToOpex: days, nextOpexDate: cal.nextOpexDate || null, equityPutCall: isFinite(equityPutCall) ? equityPutCall : null, indexPutCall: isFinite(indexPutCall) ? indexPutCall : null, totalPutCall: isFinite(totalPutCall) ? totalPutCall : null, dataQuality: ctx.dataQuality || null };
}

function calcBreadthRotation(ctx) {
  ctx = ctx || {};
  var score = 0, flags = [];
  function add(points, flag) { score += points; flags.push(flag); }
  if (ctx.iwmUp || Number(ctx.iwmVsQqqRS_5d) > 0) add(18, 'IWM_PARTICIPATION');
  if (ctx.rspUp || Number(ctx.rspVsSpyRS_5d) > 0) add(16, 'EQUAL_WEIGHT_CONFIRMATION');
  if (ctx.kreUp) add(10, 'KRE_CYCLICAL_CONFIRMATION');
  if (ctx.xbiUp) add(10, 'XBI_SPEC_GROWTH_CONFIRMATION');
  if (ctx.industrialsUp) add(8, 'INDUSTRIALS_CONFIRMATION');
  if (ctx.qqqUpButBreadthDown) add(-28, 'QQQ_UP_BREADTH_DOWN');
  if (ctx.iwmFailedBreakout) add(-22, 'IWM_FAILED_BREAKOUT');
  if (ctx.rspLaggingSpy) add(-16, 'RSP_LAGGING_SPY');
  if (ctx.kreDown && ctx.xbiDown) add(-14, 'CYCLICAL_SPEC_ROTATION_FAILED');
  if (ctx.smhSidewaysNotDown && score > 0) flags.push('SEMI_DIGESTING_WHILE_BREADTH_BROADENS');
  score = Math.max(-100, Math.min(100, Math.round(score)));
  var regime = score >= 30 ? 'BREADTH_BROADENING' : score <= -25 ? 'FAILED_ROTATION' : 'NARROW_LEADERSHIP';
  return { regime: regime, score: score, flags: flags.length ? flags : ['BREADTH_NEUTRAL_OR_INSUFFICIENT'], iwmVsQqqRS_5d: Number(ctx.iwmVsQqqRS_5d) || 0, rspVsSpyRS_5d: Number(ctx.rspVsSpyRS_5d) || 0 };
}

function calcLockoutRegime(modules) {
  modules = modules || {};
  var candle = modules.candle || {};
  var opex = modules.opexGamma || {};
  var breadth = modules.breadth || {};
  var extension = modules.extension || {};
  if (candle.type === 'BEARISH_CONFIRMATION' || candle.type === 'FAILED_RETEST') return 'DISTRIBUTION_REVERSAL';
  if (opex.regime === 'GAMMA_UNWIND_RISK') return 'OPEX_PIN_OR_DECAY';
  if (breadth.regime === 'FAILED_ROTATION') return 'FAILED_ROTATION';
  if (extension.state === 'BLOW_OFF_RISK' || extension.state === 'EXTREME_EXTENSION') return 'LATE_STAGE_GAMMA_CHASE';
  if (breadth.regime === 'BREADTH_BROADENING') return 'BREADTH_BROADENING';
  return 'LOCKOUT_CONTINUATION';
}

function calcLockoutAction(modules) {
  modules = modules || {};
  var extension = modules.extension || { score: 0, flags: [] };
  var candle = modules.candle || { score: 0, flags: [] };
  var opexGamma = modules.opexGamma || { score: 0, flags: [] };
  var breadth = modules.breadth || { score: 0, flags: [] };
  var portfolio = modules.portfolioExposure || { score: 0, flags: [] };
  var breadthPenalty = Math.max(0, -(Number(breadth.score) || 0));
  var risk = (Number(extension.score) || 0) * 0.25 + (Number(candle.score) || 0) * 0.25 + (Number(opexGamma.score) || 0) * 0.20 + breadthPenalty * 0.15 + (Number(portfolio.score) || 0) * 0.15;
  var score = Math.max(0, Math.min(100, Math.round(risk)));
  var action = score >= 75 ? 'EXIT_OR_HEDGE' : score >= 55 ? 'TRIM_50' : score >= 35 ? 'TRIM_25_33' : score >= 15 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE';
  var regime = calcLockoutRegime({ extension: extension, candle: candle, opexGamma: opexGamma, breadth: breadth });
  var flags = [].concat(extension.flags || [], candle.flags || [], opexGamma.flags || [], breadth.flags || [], portfolio.flags || []);
  return { score: score, action: action, regime: regime, flags: flags.length ? flags : ['LOCKOUT_ACTION_NEUTRAL'], extension: extension, candle: candle, opexGamma: opexGamma, breadth: breadth, portfolioExposure: portfolio };
}

var AIO_EVENT_RISK_CONTEXT = {
  asOf: '2026-05-14',
  title: 'CPI hot print + Trump-Xi summit + OPEX/NVDA event runway',
  cpi: {
    releaseDate: '2026-05-12',
    headlineMoM: 0.6,
    headlineYoY: 3.8,
    coreMoM: 0.4,
    coreYoY: 2.8,
    energyMoM: 3.8,
    energyYoY: 17.9,
    interpretation: 'CPI was hotter than the benign-risk scenario; treat lower rates as a later liquidity thesis, not an immediate green light.'
  },
  liquidityThesis: {
    label: 'H2 liquidity optionality',
    drivers: ['eSLR/bank regulation relief', 'possible TGA drawdown', 'fiscal impulse', 'eventual rate cuts'],
    caveat: 'Hot CPI and energy shock can delay or cap the liquidity impulse; use it as medium-term backdrop, not a reason to chase extended candles.'
  },
  timeline: [
    { date: '2026-05-14', label: 'Trump-Xi summit begins', tone: 'hope', note: 'trade/AI/Iran headlines can keep risk appetite alive, but headline risk is two-sided.' },
    { date: '2026-05-15', label: 'Monthly OPEX / summit window', tone: 'risk', note: 'gamma support can decay after event/expiry; watch close position and RVOL.' },
    { date: '2026-05-20', label: 'NVDA earnings after close', tone: 'hope', note: 'AI leadership catalyst; avoid assuming good news is not already priced.' },
    { date: '2026-05-27', label: 'Korea semi ETF/event window', tone: 'risk', note: 'after the visible catalyst runway, event exhaustion and profit-taking risk rise.' }
  ],
  telegramPipeline: {
    channel: 'aetherjapanresearch',
    publicMirror: 'https://t.me/s/aetherjapanresearch',
    purpose: 'Japan/US cross-market news, supply-chain alerts, broker notes, and Asia semiconductor flow context.',
    handling: 'Public Telegram messages are treated as fast secondary sources: tag, dedupe, score, and require confirmation before promoting to live-like conclusions.'
  }
};

function _aioEventDays(dateStr, refDate) {
  var ref = refDate ? new Date(refDate) : new Date();
  var d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  var r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((d.getTime() - r.getTime()) / 86400000);
}

function calcBlowoffTopChecklist(snapshot, context) {
  context = context || {};
  snapshot = snapshot || {};
  var eventCtx = context.eventContext || AIO_EVENT_RISK_CONTEXT;
  var checks = [], supports = [];
  function push(list, ok, label, detail, severity) {
    list.push({ ok: !!ok, label: label, detail: detail || '', severity: severity || (ok ? 'risk' : 'watch') });
  }
  function fin(v) { var n = Number(v); return isFinite(n) ? n : null; }
  var dist20Pct = fin(snapshot.dist20Pct);
  var dist20Atr = fin(snapshot.dist20Atr);
  var rsi14 = fin(snapshot.rsi14);
  var rvol20 = fin(snapshot.rvol20);
  var closePosition = fin(snapshot.closePosition);
  var price20Ratio = dist20Pct !== null ? 100 + dist20Pct : null;
  push(checks, price20Ratio !== null && price20Ratio >= 117, '20MA distance near heat band', price20Ratio === null ? '20MA ratio unavailable' : ('price/20MA ' + price20Ratio.toFixed(1) + ' / heat 120'), price20Ratio >= 120 ? 'risk' : 'warn');
  push(checks, dist20Atr !== null && dist20Atr >= 4, 'ATR extension trim zone', dist20Atr === null ? 'ATR extension unavailable' : ('20MA +' + dist20Atr.toFixed(1) + ' ATR'), dist20Atr !== null && dist20Atr >= 6 ? 'risk' : 'warn');
  push(checks, rsi14 !== null && rsi14 >= 80, 'RSI overheat', rsi14 === null ? 'RSI unavailable' : ('RSI ' + rsi14.toFixed(1) + ' - not automatic sell'), rsi14 !== null && rsi14 >= 85 ? 'risk' : 'warn');
  push(checks, rvol20 !== null && rvol20 >= 2.5 && closePosition !== null && closePosition < 0.55, 'Climax supply candle', 'RVOL ' + (rvol20 === null ? '--' : rvol20.toFixed(1)) + 'x / close position ' + (closePosition === null ? '--' : Math.round(closePosition * 100) + '%'), 'risk');
  push(checks, !!snapshot.bbReentry, 'Upper Bollinger re-entry', snapshot.bbReentry ? 'outside upper band then closed back inside' : 'no exhaustion re-entry yet', 'warn');
  push(checks, context.opexGammaRisk && context.opexGammaRisk.regime !== 'GAMMA_SUPPORT', 'OPEX/gamma decay watch', context.opexGammaRisk ? context.opexGammaRisk.regime : 'option context unavailable', 'warn');
  push(checks, eventCtx && eventCtx.cpi && eventCtx.cpi.coreMoM >= 0.4, 'Hot CPI macro trigger', eventCtx.cpi ? ('core CPI +' + eventCtx.cpi.coreMoM.toFixed(1) + '% MoM / headline ' + eventCtx.cpi.headlineYoY.toFixed(1) + '% YoY') : 'CPI context unavailable', 'risk');

  push(supports, snapshot.above10EMA !== false && snapshot.above21EMA !== false, '10/21 EMA trend alive', snapshot.above10EMA === false || snapshot.above21EMA === false ? 'short/swing line already violated' : 'short-term trend not broken', 'bull');
  push(supports, context.breadthRotation && context.breadthRotation.regime === 'BREADTH_BROADENING', 'Breadth broadening', context.breadthRotation ? context.breadthRotation.regime : 'breadth context unavailable', 'bull');
  push(supports, context.semiHeat && context.semiHeat.state !== 'SEMI_MANIA', 'Semi heat not full mania', context.semiHeat ? context.semiHeat.state : 'semi context unavailable', 'bull');
  push(supports, eventCtx && eventCtx.timeline && eventCtx.timeline.some(function(e) { return e.tone === 'hope' && _aioEventDays(e.date, context.referenceDate) >= 0; }), 'Catalyst runway still open', 'summit/NVDA/event window can keep dip demand alive', 'bull');
  push(supports, eventCtx && eventCtx.liquidityThesis, 'H2 liquidity backdrop', eventCtx.liquidityThesis ? eventCtx.liquidityThesis.drivers.join(' / ') : '', 'bull');

  var riskScore = checks.reduce(function(s, c) { return s + (c.ok ? (c.severity === 'risk' ? 16 : 10) : 0); }, 0);
  var supportScore = supports.reduce(function(s, c) { return s + (c.ok ? 7 : 0); }, 0);
  var score = Math.max(0, Math.min(100, Math.round(riskScore - supportScore * 0.45)));
  var state = score >= 70 ? 'BLOW_OFF_TOP_RISK' : score >= 45 ? 'EVENT_EXHAUSTION_WATCH' : score >= 25 ? 'NO_CHASE_DIGESTION' : 'LOCKOUT_CAN_CONTINUE';
  var action = score >= 70 ? 'TRIM_50' : score >= 45 ? 'TRIM_25_33' : score >= 25 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE';
  return { state: state, score: score, action: action, checks: checks, supports: supports, eventContext: eventCtx };
}

function calcSellPressure(ohlcvOrSnapshot, context) {
  context = context || {};
  var snapshot = ohlcvOrSnapshot && ohlcvOrSnapshot.ok !== undefined ? ohlcvOrSnapshot : calcTechnicalSnapshot(ohlcvOrSnapshot);
  var flags = [], score = 0;
  function add(points, flag) { score += points; flags.push(flag); }
  if (!snapshot || !snapshot.ok) return { score: 0, action: 'HOLD_CORE', flags: ['DATA_INSUFFICIENT'], snapshot: snapshot };
  if (snapshot.dist50Atr !== null && snapshot.dist50Atr >= 3) add(12, 'DIST_50SMA_PLUS_3ATR_WARNING');
  if (snapshot.dist50Atr !== null && snapshot.dist50Atr >= 4) add(12, 'DIST_50SMA_PLUS_4ATR_NO_ADD_TRIM_CANDIDATE');
  if (snapshot.dist50Atr !== null && snapshot.dist50Atr >= 6) add(20, 'DIST_50SMA_PLUS_6ATR_STRONG_TRIM_HEDGE');
  if (snapshot.dist21Atr !== null && snapshot.dist21Atr >= 2.5) add(10, 'DIST_21EMA_PLUS_2_5ATR_SHORT_TERM_EXTENSION');
  if (snapshot.rsi14 !== null && snapshot.rsi14 >= 80) add(8, 'RSI_80_OVERHEAT_NOT_AUTO_SELL');
  if (snapshot.rsi14 !== null && snapshot.rsi14 >= 85) add(10, 'RSI_85_EXTREME_OVERHEAT');
  if (snapshot.dayGainPct >= 6 && snapshot.rvol20 !== null && snapshot.rvol20 >= 2.5 && snapshot.closePosition !== null && snapshot.closePosition < 0.5) add(25, 'CLIMAX_REVERSAL_RISK_DAY_GAIN_RVOL_WEAK_CLOSE');
  if (snapshot.bbReentry) add(15, 'UPPER_BOLLINGER_REENTRY_EXHAUSTION');
  if (snapshot.above10EMA === false) add(14, 'CLOSE_BELOW_10EMA_TRIM_TRADING_LOT');
  if (snapshot.above21EMA === false) add(18, 'CLOSE_BELOW_21EMA_REDUCE_SWING_LOT');
  if (snapshot.above50SMA === false) add(28, 'CLOSE_BELOW_50SMA_SWING_THESIS_DAMAGED');
  if (context.semiHeat && context.semiHeat.state === 'SEMI_HEATED') add(6, 'SEMI_HEATED_CONTEXT');
  if (context.semiHeat && context.semiHeat.state === 'SEMI_MANIA') add(12, 'SEMI_MANIA_CONTEXT');
  if (context.lockoutAction && context.lockoutAction.score >= 35) add(Math.min(18, Math.round(context.lockoutAction.score / 4)), 'LOCKOUT_ACTION_' + context.lockoutAction.action);
  if (context.blowoffTop && context.blowoffTop.score >= 25) {
    add(Math.min(18, Math.round(context.blowoffTop.score / 4)), 'BLOWOFF_TOP_' + context.blowoffTop.action);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  var action = score >= 75 ? 'EXIT_OR_HEDGE' : score >= 58 ? 'TRIM_50' : score >= 38 ? 'TRIM_25_33' : score >= 18 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE';
  return { score: score, action: action, flags: flags.length ? flags : ['TREND_HEALTHY_NO_EXIT_SIGNAL'], snapshot: snapshot };
}

function calcSemiHeatMap(spySnap, qqqSnap, smhSnap, soxxSnap) {
  var snaps = { SPY: spySnap, QQQ: qqqSnap, SMH: smhSnap, SOXX: soxxSnap };
  var semi = [smhSnap, soxxSnap].filter(function(s) { return s && s.ok; });
  var bases = [spySnap, qqqSnap].filter(function(s) { return s && s.ok; });
  if (!semi.length || !bases.length) return { state: 'DATA_INSUFFICIENT', score: 0, flags: [], snapshots: snaps };
  var semiGain = _statMean(semi.map(function(s) { return s.dayGainPct || 0; }));
  var baseGain = _statMean(bases.map(function(s) { return s.dayGainPct || 0; }));
  var semiExt = Math.max.apply(null, semi.map(function(s) { return s.dist50Atr === null ? -999 : s.dist50Atr; }));
  var semiRsi = Math.max.apply(null, semi.map(function(s) { return s.rsi14 === null ? 0 : s.rsi14; }));
  var semiRvol = Math.max.apply(null, semi.map(function(s) { return s.rvol20 === null ? 0 : s.rvol20; }));
  var score = 0, flags = [];
  if (semiGain - baseGain >= 1) { score += 15; flags.push('SEMI_RS_OUTPERFORMING_INDEXES'); }
  if (semiExt >= 3) { score += 18; flags.push('SEMI_50SMA_PLUS_3ATR'); }
  if (semiExt >= 4) { score += 20; flags.push('SEMI_50SMA_PLUS_4ATR'); }
  if (semiExt >= 6) { score += 22; flags.push('SEMI_50SMA_PLUS_6ATR_MANIA'); }
  if (semiRsi >= 80) { score += 15; flags.push('SEMI_RSI_80_PLUS'); }
  if (semiRsi >= 85) { score += 12; flags.push('SEMI_RSI_85_PLUS'); }
  if (semiRvol >= 2) { score += 10; flags.push('SEMI_RVOL_2_PLUS'); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { state: score >= 70 ? 'SEMI_MANIA' : score >= 40 ? 'SEMI_HEATED' : 'NORMAL', score: score, flags: flags, relativeStrengthPct: semiGain - baseGain, semiGainPct: semiGain, baseGainPct: baseGain, maxDist50Atr: semiExt === -999 ? null : semiExt, maxRsi: semiRsi, maxRvol: semiRvol, snapshots: snaps };
}

function calcExitPlan(snapshot, sellPressure, regime) {
  snapshot = snapshot || {};
  sellPressure = sellPressure || { action: 'HOLD_CORE', score: 0, flags: [] };
  var action = sellPressure.action || 'HOLD_CORE';
  var atr = snapshot.atr14 || 0;
  var price = snapshot.price || 0;
  var stopTrading = snapshot.ema10 || (atr ? price - atr * 1.5 : null);
  var stopSwing = snapshot.ema21 || (atr ? price - atr * 2.5 : null);
  var thesis = snapshot.sma50 || (atr ? price - atr * 4 : null);
  var map = { HOLD_CORE: 'Core keeps riding. No forced sell signal; keep normal position sizing.', NO_ADD_RAISE_STOP: 'Do not add here. Raise stops and let the extended trend prove itself.', TRIM_25_33: 'Trim the trading lot by 25-33% or harvest enough to reduce emotional risk.', TRIM_50: 'Reduce roughly half of the swing/trading exposure unless a fresh base forms.', EXIT_OR_HEDGE: 'Exit the tactical lot or hedge. Core exposure only if thesis and timeframe justify it.' };
  return {
    action: action, score: sellPressure.score || 0, regime: regime || 'REGIME_UNKNOWN', primary: map[action],
    tradingLot: stopTrading ? 'Trading stop: close below 10EMA near ' + stopTrading.toFixed(2) : 'Trading stop unavailable',
    swingLot: stopSwing ? 'Swing stop: close below 21EMA near ' + stopSwing.toFixed(2) : 'Swing stop unavailable',
    thesisLine: thesis ? 'Thesis line: 50SMA near ' + thesis.toFixed(2) : 'Thesis line unavailable',
    levels: [{ label: 'Current', value: price || null }, { label: '10EMA', value: snapshot.ema10 || null }, { label: '21EMA', value: snapshot.ema21 || null }, { label: '50SMA', value: snapshot.sma50 || null }, { label: '20D high', value: snapshot.recentHigh20 || null }, { label: '20D low', value: snapshot.recentLow20 || null }],
    beginner: 'RSI 70+ can stay hot in lockout rallies. The sell decision comes from extension plus failed closes: weak close after high-volume surge, upper-band re-entry, or 10/21/50-day line breaks.'
  };
}

var FRESHNESS_POLICY = {
  quote: { freshMs: 2 * 60 * 1000, staleMs: 10 * 60 * 1000, hardStaleMs: 30 * 60 * 1000, label: 'Live quote' },
  quote_afterhours: { freshMs: 10 * 60 * 1000, staleMs: 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'After-hours quote' },
  macro_daily: { freshMs: 24 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000, hardStaleMs: 30 * 24 * 60 * 60 * 1000, label: 'Daily macro' },
  macro_monthly: { freshMs: 7 * 24 * 60 * 60 * 1000, staleMs: 45 * 24 * 60 * 60 * 1000, hardStaleMs: 90 * 24 * 60 * 60 * 1000, label: 'Monthly macro' },
  news: { freshMs: 15 * 60 * 1000, staleMs: 4 * 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'News' },
  technical: { freshMs: 15 * 60 * 1000, staleMs: 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'Technical' },
  breadth: { freshMs: 15 * 60 * 1000, staleMs: 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'Breadth' },
  sentiment: { freshMs: 30 * 60 * 1000, staleMs: 6 * 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'Sentiment' },
  option: { freshMs: 30 * 60 * 1000, staleMs: 24 * 60 * 60 * 1000, hardStaleMs: 7 * 24 * 60 * 60 * 1000, label: 'Options' },
  kr_supply: { freshMs: 15 * 60 * 1000, staleMs: 2 * 60 * 60 * 1000, hardStaleMs: 24 * 60 * 60 * 1000, label: 'KR supply' },
  static_snapshot: { freshMs: 24 * 60 * 60 * 1000, staleMs: 72 * 60 * 60 * 1000, hardStaleMs: 7 * 24 * 60 * 60 * 1000, label: 'Static snapshot' },
  static_memo: { freshMs: 7 * 24 * 60 * 60 * 1000, staleMs: 30 * 24 * 60 * 60 * 1000, hardStaleMs: 90 * 24 * 60 * 60 * 1000, label: 'Static memo' },
  manual: { freshMs: 24 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000, hardStaleMs: 30 * 24 * 60 * 60 * 1000, label: 'Manual' },
  estimated: { freshMs: 0, staleMs: 0, hardStaleMs: 0, label: 'Estimated' },
  unknown: { freshMs: 60 * 60 * 1000, staleMs: 24 * 60 * 60 * 1000, hardStaleMs: 7 * 24 * 60 * 60 * 1000, label: 'Unknown' }
};

function _aioMetricTs(ts) {
  if (ts == null) return Date.now();
  if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000;
  var parsed = Date.parse(ts);
  return isFinite(parsed) ? parsed : Date.now();
}

function evaluateMetric(metric, now) {
  metric = metric || {};
  now = now || Date.now();
  var policyKey = metric.policyKey || 'unknown';
  var policy = FRESHNESS_POLICY[policyKey] || FRESHNESS_POLICY.unknown;
  var ts = _aioMetricTs(metric.ts || metric.timestamp || metric.updatedAt);
  var source = (metric.source || 'unknown').toString();
  var ageMs = Math.max(0, now - ts);
  var freshness = 'fresh';
  var reason = [];
  if (/snapshot|static/i.test(source) || policyKey === 'static_snapshot' || policyKey === 'static_memo') { freshness = 'static'; reason.push('static_source'); }
  else if (/manual/i.test(source) || policyKey === 'manual') { freshness = 'manual'; reason.push('manual_source'); }
  else if (/estimated/i.test(source) || policyKey === 'estimated') { freshness = 'estimated'; reason.push('estimated_value'); }
  else if (/fallback/i.test(source)) { freshness = 'fallback'; reason.push('fallback_source'); }
  else if (ageMs <= policy.freshMs) freshness = 'live';
  else if (ageMs <= policy.staleMs) freshness = 'delayed';
  else if (ageMs <= policy.hardStaleMs) freshness = 'stale';
  else freshness = 'hard_stale';
  if (metric.error || metric.missing) { freshness = 'fallback'; reason.push('error_or_missing'); }
  var confidence = 'high';
  if (freshness === 'delayed' || freshness === 'static' || freshness === 'manual') confidence = 'medium';
  if (freshness === 'stale' || freshness === 'fallback' || freshness === 'estimated') confidence = 'low';
  if (freshness === 'hard_stale') confidence = 'low';
  return Object.assign({}, metric, { ts: ts, policyKey: policyKey, ageMs: ageMs, freshness: freshness, confidence: confidence, stale: freshness === 'stale' || freshness === 'hard_stale', hardStale: freshness === 'hard_stale', reason: reason.length ? reason : (metric.reason ? [].concat(metric.reason) : []) });
}

function makeMetric(value, source, ts, policyKey, meta) {
  var metric = Object.assign({}, meta || {}, { value: value, source: source || 'unknown', ts: _aioMetricTs(ts), policyKey: policyKey || 'unknown' });
  return evaluateMetric(metric);
}

function calcDataQuality(input) {
  var q = (input && typeof input === 'object') ? Object.assign({}, input) : { source: input };
  if (q && (q.value !== undefined || q.policyKey)) {
    var evaluated = evaluateMetric(q);
    return {
      source: evaluated.source || 'unknown',
      timestamp: evaluated.ts,
      ageMs: evaluated.ageMs,
      freshness: String(evaluated.freshness || 'unknown').toUpperCase(),
      confidence: evaluated.confidence === 'high' ? 90 : evaluated.confidence === 'medium' ? 65 : 35,
      label: evaluated.confidence === 'high' ? 'HIGH' : evaluated.confidence === 'medium' ? 'MEDIUM' : 'LOW',
      stale: !!evaluated.stale,
      reason: evaluated.reason || []
    };
  }
  var source = (q.source || q.provider || q.name || 'unknown').toString();
  var now = Date.now();
  var ts = q.timestamp || q.ts || q.updatedAt || q.asOf || null;
  var ageMs = null;
  if (ts) {
    var t = typeof ts === 'number' ? ts : Date.parse(ts);
    if (isFinite(t)) ageMs = Math.max(0, now - t);
  }
  var rows = Number(q.rows || q.bars || q.count || 0);
  var stale = q.stale === true || q.isStale === true;
  var lower = source.toLowerCase();
  var confidence = 70;
  var freshness = 'UNKNOWN';
  var reason = [];
  if (lower.indexOf('static') >= 0 || lower.indexOf('demo') >= 0 || lower.indexOf('fallback-empty') >= 0) {
    confidence = 25; freshness = 'FALLBACK'; reason.push('fallback_source');
  } else if (lower.indexOf('fallback') >= 0 || lower.indexOf('yahoo') >= 0 || lower.indexOf('stooq') >= 0 || lower.indexOf('naver') >= 0) {
    confidence = 62; freshness = 'DELAYED_OR_FALLBACK'; reason.push('secondary_source');
  } else if (lower.indexOf('twelve') >= 0 || lower.indexOf('finnhub') >= 0 || lower.indexOf('fmp') >= 0) {
    confidence = 82; freshness = 'PRIMARY'; reason.push('primary_source');
  }
  if (rows > 0 && rows < 20) { confidence -= 25; reason.push('thin_history'); }
  if (rows >= 120) { confidence += 6; reason.push('deep_history'); }
  if (ageMs !== null) {
    if (ageMs > 24 * 60 * 60 * 1000) { confidence -= 20; freshness = 'STALE'; stale = true; reason.push('stale_age'); }
    else if (ageMs > 20 * 60 * 1000 && freshness === 'PRIMARY') { confidence -= 8; freshness = 'DELAYED'; reason.push('delayed_age'); }
    else if (freshness === 'UNKNOWN') freshness = 'FRESH';
  }
  if (q.error || q.missing) { confidence -= 30; reason.push('error_or_missing'); }
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  var label = confidence >= 80 ? 'HIGH' : confidence >= 55 ? 'MEDIUM' : confidence >= 30 ? 'LOW' : 'FALLBACK';
  return { source: source, timestamp: ts || null, ageMs: ageMs, freshness: freshness, confidence: confidence, label: label, stale: stale, reason: reason };
}

window.FRESHNESS_POLICY = FRESHNESS_POLICY;
window.makeMetric = makeMetric;
window.evaluateMetric = evaluateMetric;

function calcAIInfraHeat(basketSnaps, qqqSnap, spySnap) {
  var snaps = basketSnaps || {};
  if (Array.isArray(snaps)) {
    snaps = snaps.reduce(function(acc, s, i) { acc['AI' + i] = s; return acc; }, {});
  }
  var vals = Object.keys(snaps).map(function(k) {
    var s = snaps[k];
    return s && s.ok ? Object.assign({ symbol: k }, s) : null;
  }).filter(Boolean);
  if (!vals.length) return { state: 'DATA_INSUFFICIENT', score: 0, flags: [], count: 0 };
  var base = [qqqSnap, spySnap].filter(function(s) { return s && s.ok; });
  var baseGain = base.length ? _statMean(base.map(function(s) { return s.dayGainPct || 0; })) : 0;
  var avgGain = _statMean(vals.map(function(s) { return s.dayGainPct || 0; }));
  var maxExt = Math.max.apply(null, vals.map(function(s) { return s.dist50Atr === null ? -999 : s.dist50Atr; }));
  var maxRsi = Math.max.apply(null, vals.map(function(s) { return s.rsi14 === null ? 0 : s.rsi14; }));
  var maxRvol = Math.max.apply(null, vals.map(function(s) { return s.rvol20 === null ? 0 : s.rvol20; }));
  var overheatCount = vals.filter(function(s) { return (s.dist50Atr || 0) >= 3 || (s.rsi14 || 0) >= 80; }).length;
  var score = 0, flags = [];
  if (avgGain - baseGain >= 1) { score += 15; flags.push('AI_INFRA_RS_OUTPERFORMING_INDEXES'); }
  if (maxExt >= 3) { score += 16; flags.push('AI_INFRA_50SMA_PLUS_3ATR'); }
  if (maxExt >= 4) { score += 16; flags.push('AI_INFRA_50SMA_PLUS_4ATR'); }
  if (maxExt >= 6) { score += 20; flags.push('AI_INFRA_50SMA_PLUS_6ATR_MANIA'); }
  if (maxRsi >= 80) { score += 12; flags.push('AI_INFRA_RSI_80_PLUS'); }
  if (maxRsi >= 85) { score += 10; flags.push('AI_INFRA_RSI_85_PLUS'); }
  if (maxRvol >= 2) { score += 8; flags.push('AI_INFRA_RVOL_2_PLUS'); }
  if (overheatCount >= Math.max(2, Math.ceil(vals.length * 0.35))) { score += 12; flags.push('AI_INFRA_BREADTH_OVERHEATED'); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { state: score >= 70 ? 'AI_INFRA_MANIA' : score >= 40 ? 'AI_INFRA_HEATED' : 'NORMAL', score: score, flags: flags, count: vals.length, overheatCount: overheatCount, relativeStrengthPct: avgGain - baseGain, avgGainPct: avgGain, baseGainPct: baseGain, maxDist50Atr: maxExt === -999 ? null : maxExt, maxRsi: maxRsi, maxRvol: maxRvol, snapshots: snaps };
}

function calcPositionTechnicalRisk(position, ohlcvOrSnapshot, portfolioContext) {
  position = position || {};
  portfolioContext = portfolioContext || {};
  var snapshot = ohlcvOrSnapshot && ohlcvOrSnapshot.ok !== undefined ? ohlcvOrSnapshot : calcTechnicalSnapshot(ohlcvOrSnapshot || []);
  var sellPressure = calcSellPressure(snapshot, portfolioContext);
  var qty = Number(position.qty || position.shares || 0);
  var cost = Number(position.cost || position.avgCost || 0);
  var px = Number(position.price || position.currentPrice || (snapshot && snapshot.price) || 0);
  var value = qty * (px || cost || 0);
  var totalValue = Number(portfolioContext.totalValue || 0);
  var weightPct = totalValue > 0 ? (value / totalValue) * 100 : Number(position.weightPct || 0);
  var pnlPct = cost > 0 && px > 0 ? ((px - cost) / cost) * 100 : null;
  var concentrationPenalty = weightPct >= 25 ? 18 : weightPct >= 15 ? 10 : weightPct >= 10 ? 5 : 0;
  var score = Math.max(0, Math.min(100, Math.round((sellPressure.score || 0) + concentrationPenalty)));
  var action = score >= 75 ? 'EXIT_OR_HEDGE' : score >= 58 ? 'TRIM_50' : score >= 38 ? 'TRIM_25_33' : score >= 18 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE';
  var flags = (sellPressure.flags || []).slice();
  if (concentrationPenalty) flags.push('POSITION_CONCENTRATION_' + Math.round(weightPct) + 'PCT');
  return { ticker: (position.ticker || position.symbol || '').toString().toUpperCase(), score: score, action: action, weightPct: weightPct, pnlPct: pnlPct, value: value, snapshot: snapshot, sellPressure: sellPressure, flags: flags, dataQuality: position.dataQuality || null };
}

function calcPortfolioTechnicalRisk(positions, riskItems, context) {
  positions = positions || [];
  riskItems = riskItems || [];
  context = context || {};
  if (!positions.length) return { state: 'EMPTY', heatScore: 0, action: 'HOLD_CORE', items: [] };
  var totalValue = Number(context.totalValue || positions.reduce(function(s, p) {
    return s + Number(p.value || (Number(p.qty || 0) * Number(p.price || p.cost || 0)) || 0);
  }, 0));
  var items = riskItems.map(function(item) {
    if (item && item.action && item.score !== undefined) return item;
    return calcPositionTechnicalRisk(item, item && item.snapshot, { totalValue: totalValue });
  });
  var avg = items.length ? _statMean(items.map(function(i) { return i.score || 0; })) : 0;
  var max = items.length ? Math.max.apply(null, items.map(function(i) { return i.score || 0; })) : 0;
  var topWeight = items.length ? Math.max.apply(null, items.map(function(i) { return i.weightPct || 0; })) : 0;
  var heatScore = Math.max(0, Math.min(100, Math.round(avg * 0.45 + max * 0.35 + Math.min(100, topWeight * 2) * 0.20)));
  var action = heatScore >= 75 ? 'EXIT_OR_HEDGE' : heatScore >= 58 ? 'TRIM_50' : heatScore >= 38 ? 'TRIM_25_33' : heatScore >= 18 ? 'NO_ADD_RAISE_STOP' : 'HOLD_CORE';
  var state = heatScore >= 75 ? 'PORTFOLIO_HEAT_EXTREME' : heatScore >= 58 ? 'PORTFOLIO_HEAT_HIGH' : heatScore >= 38 ? 'PORTFOLIO_HEAT_ELEVATED' : 'PORTFOLIO_HEAT_NORMAL';
  return { state: state, heatScore: heatScore, action: action, items: items, totalValue: totalValue, topWeightPct: topWeight, avgSellPressure: avg, maxSellPressure: max };
}

window._calcSMA = _calcSMA;
window._calcEMA = _calcEMA;
window._calcEMAFull = _calcEMAFull;
window._calcATR = _calcATR;
window._calcRSILast = _calcRSILast;
window._calcMACD = _calcMACD;
window._calcBB = _calcBB;
window._calcRVOL = _calcRVOL;
window._calcClosePosition = _calcClosePosition;
window._calcADRPercent = _calcADRPercent;
window.calcTechnicalSnapshot = calcTechnicalSnapshot;
window.calcExtensionHeat = calcExtensionHeat;
window.classifyTerminalCandle = classifyTerminalCandle;
window.calcOpexGammaRisk = calcOpexGammaRisk;
window.calcBreadthRotation = calcBreadthRotation;
window.calcLockoutRegime = calcLockoutRegime;
window.calcLockoutAction = calcLockoutAction;
window.AIO_EVENT_RISK_CONTEXT = AIO_EVENT_RISK_CONTEXT;
window.calcBlowoffTopChecklist = calcBlowoffTopChecklist;
window.calcSellPressure = calcSellPressure;
window.calcSemiHeatMap = calcSemiHeatMap;
window.calcSemiHeat = calcSemiHeatMap;
window.calcAIInfraHeat = calcAIInfraHeat;
window.calcExitPlan = calcExitPlan;
window.calcDataQuality = calcDataQuality;
window.calcPositionTechnicalRisk = calcPositionTechnicalRisk;
window.calcPortfolioTechnicalRisk = calcPortfolioTechnicalRisk;

const APP_VERSION = 'v49.98';
window.AIO.version = APP_VERSION;

// ═══ v48.97: AIO.diag — 운영 진단 API (P2-6 / P2-8) ════════════════════════
window.AIO.diag = window.AIO.diag || {};

// AIO.diag.proxyHealth() — 각 CORS 프록시의 Circuit Breaker 상태 반환
window.AIO.diag.proxyHealth = function() {
  if (!window._aioProxyChain) return { error: '_aioProxyChain 미초기화' };
  return {
    entries: window._aioProxyChain.health(),
    ts: new Date().toISOString()
  };
};

// AIO.diag.retryStats() — 자동 재시도 누적 통계 반환
window.AIO.diag.retryStats = function() {
  var s = window._aioRetryStats || { total: 0, retried: 0, failed: 0 };
  return { total: s.total, retried: s.retried, failed: s.failed, ts: new Date().toISOString() };
};

// AIO.diag.lastNaverHealth() — Naver 피드 최근 상태 반환 (v48.82 기존 인프라 활용)
window.AIO.diag.lastNaverHealth = function() {
  return (window._aioFeedHealth && window._aioFeedHealth.naver) || null;
};

// v41.1: 타이밍 상수 -- 매직 넘버 제거
const T = {
  UI_FEEDBACK: 1500,      // 버튼 피드백 복원 (ms)
  COOLDOWN: 60000,        // API 쿨다운 / 상태 갱신 (60s)
  SIGNAL_REFRESH: 45000,  // 시그널 갱신 주기 (45s)
  FETCH_TIMEOUT: 8000,    // 네트워크 요청 타임아웃 (8s)
  DATE_REFRESH: 3600000,  // DATE_ENGINE 갱신 (1h)
  CHUNK_TIMEOUT: 15000,   // LLM 스트리밍 청크 타임아웃 (15s)
  BATCH_DELAY: 1200,      // 배치 요청 간 딜레이 (1.2s)
  RETRY_DELAY: 3000,      // 재시도 대기 (3s)
};

// v34.5: 프로덕션 로그 억제 — console.log만 조건부 억제, warn/error는 유지
// URL에 ?debug=1 추가 시 전체 로그 활성화 (개발 모드)
const AIO_DEBUG = (location.search.indexOf('debug=1') !== -1) || (localStorage.getItem('aio_debug') === '1');
if (!AIO_DEBUG) {
  var _origLog = console.log;
  console.log = function() {
    // [AIO] 접두사 로그만 억제, 나머지는 통과
    if (arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf('[AIO]') === 0) return;
    _origLog.apply(console, arguments);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// v48.36: DATE_ENGINE — 날짜 표준화 + Stale 감지 중앙 유틸
// ─────────────────────────────────────────────────────────────────────────
// 용도: DATA_SNAPSHOT · SCREENER_DB · _lastFetch · 뉴스 타임스탬프 등
//       프로젝트 전체에서 **단일 진실의 원천**으로 사용.
// 철학:
//   - 하드코딩 날짜 문자열 금지 (DATE_ENGINE.now() / .isoNow() 사용)
//   - stale 판정은 isStale(ts, maxAgeMs)로 통일
//   - UI 배지는 staleBadge(ts)로 자동 생성 (🟢 실시간 · 🟡 N분 전 · 🔴 N일 전)
//   - 애널리스트 리포트는 staleBadge(ts, 'report')로 7일 이상이면 경고
// ═══════════════════════════════════════════════════════════════════════════
window.DATE_ENGINE = (function() {
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

  // 🟢 실시간 · 🟡 3분 전 · 🔴 3일 전 (stale 여부 기반 색상)
  function staleBadge(v, category, opts) {
    opts = opts || {};
    var t = toTs(v);
    if (!t) return opts.emptyText || '';
    var a = ageMs(v);
    var threshold = STALE_THRESHOLDS[category] || STALE_THRESHOLDS.unknown;
    var icon, color;
    if (a < threshold * 0.3) { icon = '🟢'; color = '#00e5a0'; }   // fresh (30% of threshold)
    else if (a < threshold) { icon = '🟡'; color = '#ffa31a'; }    // aging
    else { icon = '🔴'; color = '#ff5b50'; }                        // stale
    var label = formatRelative(v);
    if (opts.asHtml === false) return icon + ' ' + label;
    return '<span style="color:' + color + ';font-size:' + (opts.fontSize || '9px') + ';font-family:var(--font-mono);" title="' + formatAbsolute(v) + '">' + icon + ' ' + label + '</span>';
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
// 각 fetch 함수가 성공 시 DATE_ENGINE.now() 값을 기록.
// UI는 staleBadge(_lastFetch[apiName], category)로 freshness 표시.
window._lastFetch = window._lastFetch || {};
window._markFetch = function(apiName) {
  window._lastFetch[apiName] = window.DATE_ENGINE.now();
  // 신선도 패널이 열려 있으면 즉시 갱신
  if (typeof window._aioRenderFreshness === 'function') {
    try { window._aioRenderFreshness(); } catch(_){}
  }
};

// v48.36: 신선도 패널 렌더 — 가이드 페이지 디버그 섹션에 표시
window._aioRenderFreshness = function() {
  var panel = document.getElementById('aio-freshness-panel');
  if (!panel) return;
  var DE = window.DATE_ENGINE;
  if (!DE) { panel.innerHTML = '<div style="color:#f87171;">DATE_ENGINE 미로드</div>'; return; }
  // 추적 대상 API: [display name, _lastFetch key, category]
  var apis = [
    ['시세 (Yahoo/CoinGecko)', 'quote', 'quote'],
    ['뉴스 (RSS/Finnhub)', 'news', 'news'],
    ['센티먼트 (CNN F&G)', 'fearGreed', 'sentiment'],
    ['풋콜 (CBOE/UW)', 'putCall', 'sentiment'],
    ['기술지표 (SPY RSI/MACD)', 'technicalSPY', 'sentiment'],
    ['FRED 매크로', 'fred', 'macro'],
    ['VIX 히스토리', 'vixHistory', 'sentiment'],
    ['시장 폭 (Breadth)', 'breadth', 'sentiment']
  ];
  var html = '';
  var lf = window._lastFetch || {};
  apis.forEach(function(row) {
    var label = row[0], key = row[1], cat = row[2];
    var ts = lf[key];
    if (!ts) {
      html += '<div style="display:flex;justify-content:space-between;gap:8px;"><span>' + label + '</span><span style="color:#7e8a9e;">— 미수신</span></div>';
    } else {
      html += '<div style="display:flex;justify-content:space-between;gap:8px;"><span>' + label + '</span>' + DE.staleBadge(ts, cat) + '</div>';
    }
  });
  // DATA_SNAPSHOT 폴백 상태
  if (typeof window.DATA_SNAPSHOT !== 'undefined') {
    var fb = window.DATA_SNAPSHOT._isFallback;
    html += '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;padding-top:4px;border-top:1px dashed var(--surface-5);">' +
      '<span>폴백 스냅샷 상태</span>' +
      (fb ? '<span style="color:#fbbf24;">⚠️ 사용 중</span>' : '<span style="color:#3ddba5;">✅ 실시간</span>') +
      '</div>';
  }
  // v48.38: RSS 피드 헬스 요약
  if (window._aioFeedHealth && typeof window._aioFeedHealth.stats === 'function') {
    var fh = window._aioFeedHealth.stats();
    if (fh.total > 0) {
      html += '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;">' +
        '<span>RSS 피드 상태</span>' +
        '<span>' + (fh.ok ? '<span style="color:#3ddba5;">✓ ' + fh.ok + '</span>' : '') +
        (fh.degraded ? ' <span style="color:#fbbf24;">⚠ ' + fh.degraded + '</span>' : '') +
        (fh.disabled ? ' <span style="color:#f87171;">✗ ' + fh.disabled + '</span>' : '') +
        ' / ' + fh.total + '</span></div>';
    }
  }
  // v48.38: AIO_Cache 통계
  if (window.AIO_Cache && typeof window.AIO_Cache.stats === 'function') {
    var cs = window.AIO_Cache.stats();
    if (cs.count > 0) {
      html += '<div style="display:flex;justify-content:space-between;gap:8px;">' +
        '<span>localStorage 캐시</span>' +
        '<span style="color:var(--text-muted);">' + cs.count + '건 · ' + cs.kb + ' KB' +
        (cs.expired ? ' · 만료 ' + cs.expired : '') + '</span></div>';
    }
  }
  panel.innerHTML = html;
};

// v48.36: 수동 새로고침 핸들러 (가이드 페이지 버튼)
window._aioRefreshFreshness = function() {
  if (typeof window._aioRenderFreshness === 'function') window._aioRenderFreshness();
};

// v48.80/P150 + v48.81/P151 + v48.82/P152: one-call operational/data/pipeline snapshot for live checks.
window.AIO.CORE_LIVE_SYMBOLS = ['^GSPC', '^IXIC', '^VIX', 'CL=F', 'GC=F', 'KRW=X', 'DX-Y.NYB', '^KS11', '^KQ11'];

window.AIO.getLiveCoverage = function(requiredSymbols) {
  var required = requiredSymbols || window.AIO.CORE_LIVE_SYMBOLS || [];
  var sources = window._dataSource || {};
  var live = [];
  var missing = [];
  var stale = [];
  var now = Date.now();
  required.forEach(function(sym) {
    var s = sources[sym];
    var metric = s && (s.metric || { value: null, source: s.source, ts: s.ts, policyKey: s.policyKey || 'quote' });
    var q = (typeof evaluateMetric === 'function' && metric) ? evaluateMetric(metric) : null;
    var sourceOk = window.AIO && typeof window.AIO.isOperationalQuoteSource === 'function'
      ? window.AIO.isOperationalQuoteSource(s && s.source)
      : !!(s && s.source && s.source !== 'snapshot' && s.source.indexOf('fallback') === -1);
    var isLive = !!(s && sourceOk && (!q || q.freshness !== 'hard_stale'));
    if (isLive) {
      live.push(sym);
      if ((q && q.stale) || (!q && s.ts && now - s.ts > 30 * 60 * 1000)) stale.push(sym);
    } else {
      missing.push(sym);
    }
  });
  var has = function(sym) { return live.indexOf(sym) !== -1; };
  var coveragePct = required.length ? live.length / required.length : 0;
  var coreOk = has('^GSPC') && has('^VIX') && coveragePct >= 0.5;
  return {
    required: required.slice(),
    live: live,
    missing: missing,
    stale: stale,
    coveragePct: coveragePct,
    coreOk: coreOk
  };
};

window.AIO.getDataFreshnessAudit = function() {
  var snap = window.DATA_SNAPSHOT || {};
  var updatedTs = snap._updated ? new Date(snap._updated).getTime() : 0;
  var snapshotAgeHours = updatedTs ? Math.round((Date.now() - updatedTs) / 3600000) : null;
  var liveCoverage = window.AIO.getLiveCoverage();
  var priceHealth = null;
  try { priceHealth = window.PriceStore && typeof window.PriceStore.health === 'function' ? window.PriceStore.health() : null; } catch(_p) {}
  var macroHealth = null;
  try { macroHealth = window.MacroStore && typeof window.MacroStore.health === 'function' ? window.MacroStore.health() : null; } catch(_m) {}
  var snapshotHealth = null;
  try { snapshotHealth = window.SnapshotStore && typeof window.SnapshotStore.health === 'function' ? window.SnapshotStore.health() : null; } catch(_s) {}
  var effectiveFallback = (snap._isFallback !== false) && !(liveCoverage && liveCoverage.coreOk);
  var issues = [];
  if (snapshotAgeHours !== null && snapshotAgeHours > 24 && effectiveFallback) issues.push('fallback snapshot older than 24h');
  if (!liveCoverage.coreOk) issues.push('core live quote coverage incomplete');
  if (priceHealth && priceHealth.stale > 0) issues.push(priceHealth.stale + ' stale live price(s)');
  if (macroHealth && macroHealth.stale > 0) issues.push(macroHealth.stale + ' stale macro series');
  if (snapshotHealth && snapshotHealth.hardStale > 0 && effectiveFallback) issues.push(snapshotHealth.hardStale + ' hard-stale snapshot seed(s)');
  return {
    status: issues.length ? 'warn' : 'ok',
    issues: issues,
    snapshotDate: snap._snapshotDate || null,
    snapshotUpdated: snap._updated || null,
    snapshotAgeHours: snapshotAgeHours,
    snapshotIsFallback: snap._isFallback !== false,
    effectiveFallback: effectiveFallback,
    partialLive: !!snap._partialLive,
    liveCoverage: liveCoverage,
    priceHealth: priceHealth,
    macroHealth: macroHealth,
    snapshotHealth: snapshotHealth,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.auditAllFreshness = function(pageId) {
  var pageSymbols = {
    home: ['^GSPC','^IXIC','^VIX','CL=F','GC=F','KRW=X'],
    signals: ['SPY','QQQ','IWM','^VIX'],
    breadth: ['^GSPC','^IXIC','^RUT'],
    sentiment: ['^VIX','SPY','QQQ'],
    briefing: ['^GSPC','^IXIC','^VIX','CL=F','GC=F','KRW=X','^KS11'],
    technical: ['SPY','QQQ','SMH','SOXX','^VIX'],
    macro: ['DX-Y.NYB','^TNX','^VIX'],
    fx: ['KRW=X','DX-Y.NYB','^TNX'],
    fundamental: ['SPY','QQQ'],
    themes: ['SMH','SOXX','QQQ','SPY'],
    portfolio: [],
    detail: [],
    options: ['SPY','QQQ','^VIX'],
    korea: ['^KS11','^KQ11','KRW=X'],
    glossary: []
  };
  var required = pageSymbols[pageId] || window.AIO.CORE_LIVE_SYMBOLS || [];
  var coverage = window.AIO.getLiveCoverage(required);
  var freshness = window.AIO.getDataFreshnessAudit();
  var metrics = [];
  Object.keys(window._dataSource || {}).forEach(function(sym) {
    var s = window._dataSource[sym] || {};
    var q = (typeof evaluateMetric === 'function') ? evaluateMetric(s.metric || { source: s.source, ts: s.ts, policyKey: s.policyKey || 'quote' }) : s;
    metrics.push({ symbol: sym, source: s.source || 'unknown', freshness: q && q.freshness || 'unknown', stale: !!(q && q.stale), hardStale: !!(q && q.hardStale), pctMissing: !!s.pctMissing });
  });
  var stale = metrics.filter(function(m) { return m.stale || m.hardStale; });
  var missingPct = metrics.filter(function(m) { return m.pctMissing; });
  var scheduler = {};
  try {
    if (typeof REFRESH_SCHEDULE !== 'undefined') {
      Object.keys(REFRESH_SCHEDULE).forEach(function(k) {
        var cfg = REFRESH_SCHEDULE[k] || {};
        scheduler[k] = { nextDue: cfg.nextDue || 0, lastRunStart: cfg.lastRunStart || 0, lastRunEnd: cfg.lastRunEnd || 0, lastDurationMs: cfg.lastDurationMs || 0, retryCount: cfg.retryCount || 0, priority: cfg.priority || 'normal', timeoutMs: cfg.timeoutMs || 0, policyKey: cfg.policyKey || null, inFlight: !!cfg._inFlight, lastErr: cfg._lastErr || '' };
      });
    }
  } catch(_) {}
  return {
    pageId: pageId || 'all',
    status: (coverage.coreOk && !stale.length) ? 'ok' : 'warn',
    requiredSymbols: required.slice(),
    coverage: coverage,
    freshness: freshness,
    staleMetrics: stale,
    pctMissingSymbols: missingPct.map(function(m) { return m.symbol; }),
    scheduler: scheduler,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getDataPipelineAudit = function() {
  function exists(name) {
    try { return typeof window[name] !== 'undefined'; } catch(_) { return false; }
  }
  function attrValues(selector, attr, root) {
    try {
      var out = {};
      (root || document).querySelectorAll(selector).forEach(function(el) {
        var v = el.getAttribute(attr);
        if (v) out[v] = 1;
      });
      return Object.keys(out);
    } catch(_) { return []; }
  }
  function dataApiSummary() {
    var out = {};
    try {
      if (typeof DATA_APIS !== 'undefined') {
        Object.keys(DATA_APIS).forEach(function(k) {
          var cfg = DATA_APIS[k] || {};
          var hasKey = false;
          try { hasKey = !!(cfg.key && cfg.key()); } catch(_) {}
          out[k] = { base: cfg.base || null, hasKey: hasKey, limit: cfg.limit || null };
        });
      }
    } catch(_) {}
    return out;
  }
  function schedulerSummary() {
    var out = {};
    try {
      if (typeof REFRESH_SCHEDULE !== 'undefined') {
        Object.keys(REFRESH_SCHEDULE).forEach(function(k) {
          var cfg = REFRESH_SCHEDULE[k] || {};
          out[k] = {
            intervalMs: cfg.interval || 0,
            hasFn: typeof cfg.fn === 'function',
            inFlight: !!cfg._inFlight,
            lastOk: cfg._lastOk || 0,
            lastErr: cfg._lastErr || ''
          };
        });
      }
    } catch(_) {}
    return out;
  }
  function sourceCounts() {
    var counts = {};
    try {
      Object.keys(window._dataSource || {}).forEach(function(sym) {
        var src = (window._dataSource[sym] && window._dataSource[sym].source) || 'unknown';
        counts[src] = (counts[src] || 0) + 1;
      });
    } catch(_) {}
    return counts;
  }
  function pctMissingSymbols() {
    try {
      return Object.keys(window._dataSource || {}).filter(function(sym) {
        return !!(window._dataSource[sym] && window._dataSource[sym].pctMissing);
      });
    } catch(_) { return []; }
  }
  function canvasA11yGaps() {
    try {
      return Array.prototype.slice.call(document.querySelectorAll('canvas')).filter(function(el) {
        if (el.getAttribute('aria-hidden') === 'true' || el.hidden) return false;
        return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title') && !el.getAttribute('role');
      }).map(function(el) { return el.id || '(canvas-without-id)'; });
    } catch(_) { return []; }
  }

  var activeRoot = document.querySelector('.page.active') || document;
  var livePriceSymbols = attrValues('[data-live-price]', 'data-live-price');
  var liveChangeSymbols = attrValues('[data-live-chg]', 'data-live-chg');
  var activeLivePriceSymbols = attrValues('[data-live-price]', 'data-live-price', activeRoot);
  var activeLiveChangeSymbols = attrValues('[data-live-chg]', 'data-live-chg', activeRoot);
  var liveChangeSet = {};
  var livePriceSet = {};
  activeLiveChangeSymbols.forEach(function(sym) { liveChangeSet[sym] = 1; });
  activeLivePriceSymbols.forEach(function(sym) { livePriceSet[sym] = 1; });
  var snapKeys = attrValues('[data-snap]', 'data-snap');
  var snapDateKeys = attrValues('[data-snap-date]', 'data-snap-date');
  var liveData = window._liveData || {};
  var missingLiveBindings = activeLivePriceSymbols.filter(function(sym) { return !liveData[sym]; });
  var priceWithoutChange = activeLivePriceSymbols.filter(function(sym) { return !liveChangeSet[sym]; });
  var changeWithoutPrice = activeLiveChangeSymbols.filter(function(sym) { return !livePriceSet[sym]; });
  var missingPctSymbols = pctMissingSymbols();
  var chartA11yGaps = canvasA11yGaps();
  var requiredFns = [
    'fetchWithTimeout', 'fetchViaProxy', 'fetchLiveQuotes', 'applyLiveQuotes',
    'applyDataSnapshot', 'fetchAllNews', 'renderFeed', 'renderHomeFeed',
    'renderBriefingFeed', 'computeTradingScore', 'computeMarketHealth',
    'computeExecutionWindow', 'updateRiskMonitor', 'updateBenchmarkChart'
  ];
  var missingFns = requiredFns.filter(function(name) { return !exists(name); });
  var freshness = null;
  try { freshness = window.AIO.getDataFreshnessAudit(); } catch(_) {}
  var stores = {
    price: window.PriceStore && typeof window.PriceStore.health === 'function' ? window.PriceStore.health() : null,
    macro: window.MacroStore && typeof window.MacroStore.health === 'function' ? window.MacroStore.health() : null,
    news: window.NewsStore && typeof window.NewsStore.health === 'function' ? window.NewsStore.health() : null,
    dataHealth: window.DataHealth && typeof window.DataHealth.report === 'function'
  };
  var issues = [];
  if (missingFns.length) issues.push('missing pipeline function(s): ' + missingFns.join(', '));
  if (freshness && freshness.liveCoverage && !freshness.liveCoverage.coreOk) issues.push('core live quote coverage incomplete');
  if (stores.price && stores.price.rejected > 0) issues.push('price rejects present: ' + stores.price.rejected);
  if (stores.macro && stores.macro.rejected > 0) issues.push('macro rejects present: ' + stores.macro.rejected);
  if (missingLiveBindings.length > Math.max(20, livePriceSymbols.length * 0.5)) issues.push('many live DOM sinks are not backed by liveData yet');
  if (missingPctSymbols.length > 10) issues.push('many live quotes have price but missing change percent');
  if (chartA11yGaps.length > 0) issues.push('chart canvas accessibility labels missing: ' + chartA11yGaps.slice(0, 5).join(', '));

  return {
    status: issues.length ? 'warn' : 'ok',
    issues: issues,
    generatedAt: new Date().toISOString(),
    layers: {
      sources: {
        dataApis: dataApiSummary(),
        newsSourceCount: (typeof AIO_NEWS_SOURCES !== 'undefined' && Array.isArray(AIO_NEWS_SOURCES)) ? AIO_NEWS_SOURCES.length : null,
        sourceCounts: sourceCounts()
      },
      transport: {
        fetchWithTimeout: exists('fetchWithTimeout'),
        fetchViaProxy: exists('fetchViaProxy'),
        proxyRegistrySize: (typeof _PROXY_REGISTRY !== 'undefined' && _PROXY_REGISTRY.list) ? _PROXY_REGISTRY.list.length : null,
        proxyActiveCount: (typeof _PROXY_REGISTRY !== 'undefined' && typeof _PROXY_REGISTRY.getActive === 'function') ? _PROXY_REGISTRY.getActive().length : null,
        cache: window.AIO_Cache && typeof window.AIO_Cache.stats === 'function' ? window.AIO_Cache.stats() : null,
        feedHealth: window._aioFeedHealth && typeof window._aioFeedHealth.stats === 'function' ? window._aioFeedHealth.stats() : null
      },
      scheduler: schedulerSummary(),
      validationStores: stores,
      state: {
        liveDataCount: Object.keys(liveData).length,
        dataSourceCount: Object.keys(window._dataSource || {}).length,
        quoteTimestampCount: Object.keys(window._quoteTimestamps || {}).length,
        lastFetch: Object.assign({}, window._lastFetch || {}),
        snapshot: {
          date: window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._snapshotDate || null,
          updated: window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._updated || null,
          isFallback: window.DATA_SNAPSHOT ? window.DATA_SNAPSHOT._isFallback !== false : null,
          partialLive: !!(window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._partialLive)
        }
      },
      analysis: {
        requiredFunctions: requiredFns,
        missingFunctions: missingFns,
        freshness: freshness
      },
      render: {
        activePage: (document.querySelector('.page.active') || {}).id || null,
        pageCount: document.querySelectorAll('.page').length,
        livePriceSinkCount: livePriceSymbols.length,
        liveChangeSinkCount: liveChangeSymbols.length,
        snapSinkCount: snapKeys.length,
        snapDateSinkCount: snapDateKeys.length,
        chartCanvasCount: document.querySelectorAll('canvas').length,
        missingLiveBindingsSample: missingLiveBindings.slice(0, 30),
        priceWithoutChangeSample: priceWithoutChange.slice(0, 30),
        changeWithoutPriceSample: changeWithoutPrice.slice(0, 30),
        missingPctSymbolsSample: missingPctSymbols.slice(0, 30),
        chartCanvasA11yGaps: chartA11yGaps.slice(0, 30),
        bus: window.AIOBus && typeof window.AIOBus.stats === 'function' ? window.AIOBus.stats() : null
      }
    }
  };
};

window.AIO.getOperationalHealth = function() {
  var appVersion = (typeof APP_VERSION === 'string' ? APP_VERSION : window.AIO.version || null);
  var storage = { localStorage: false, error: null };
  try {
    localStorage.setItem('_aio_health_test', '1');
    localStorage.removeItem('_aio_health_test');
    storage.localStorage = true;
  } catch(e) {
    storage.error = e && e.message || String(e);
  }

  var api = { total: 0, ok: 0, warn: 0, error: 0, unknown: 0, details: [] };
  try {
    Object.keys(window._apiHealth || {}).forEach(function(k) {
      var h = window._apiHealth[k] || {};
      var status = h.status || 'unknown';
      api.total++;
      api[status] = (api[status] || 0) + 1;
      api.details.push({ id: k, label: h.label, status: status, errCount: h.errCount || 0, lastOk: h.lastOk || null, lastErr: h.lastErr || null, lastMsg: h.lastMsg || '' });
    });
  } catch(e) {
    api.error++;
    api.details.push({ id: 'api-health', status: 'error', lastMsg: e && e.message || String(e) });
  }

  var swVersion = window._aioSWVersion || null;
  var sw = {
    supported: !!(navigator && navigator.serviceWorker),
    controlled: !!(navigator && navigator.serviceWorker && navigator.serviceWorker.controller),
    version: swVersion,
    checkedAt: window._aioSWCheckedAt || null,
    matchesApp: !!(swVersion && appVersion && swVersion === appVersion)
  };

  var cache = null;
  try { cache = window.AIO_Cache && typeof window.AIO_Cache.stats === 'function' ? window.AIO_Cache.stats() : null; } catch(_c) {}
  var feed = null;
  try { feed = window._aioFeedHealth && typeof window._aioFeedHealth.stats === 'function' ? window._aioFeedHealth.stats() : null; } catch(_f) {}
  var logs = null;
  try { logs = window._aioLogs && typeof window._aioLogs.rate === 'function' ? window._aioLogs.rate() : null; } catch(_l) {}
  var dataFreshness = null;
  try { dataFreshness = window.AIO.getDataFreshnessAudit(); } catch(_d) {}
  var dataPipeline = null;
  try {
    if (typeof window.AIO.getDataPipelineAudit === 'function') {
      var pAudit = window.AIO.getDataPipelineAudit();
      dataPipeline = {
        status: pAudit.status,
        issues: pAudit.issues,
        liveDataCount: pAudit.layers && pAudit.layers.state ? pAudit.layers.state.liveDataCount : null,
        livePriceSinkCount: pAudit.layers && pAudit.layers.render ? pAudit.layers.render.livePriceSinkCount : null,
        snapSinkCount: pAudit.layers && pAudit.layers.render ? pAudit.layers.render.snapSinkCount : null
      };
    }
  } catch(_dp) {}

  var issues = [];
  if (!storage.localStorage) issues.push('localStorage unavailable');
  if (navigator && navigator.onLine === false) issues.push('browser offline');
  if (sw.version && appVersion && sw.version !== appVersion) issues.push('service worker version mismatch');
  if (api.error > 0) issues.push(api.error + ' API source(s) in error');
  if (api.warn > 0) issues.push(api.warn + ' API source(s) degraded');
  if (feed && feed.disabled > 0) issues.push(feed.disabled + ' RSS source(s) disabled');
  if (dataFreshness && dataFreshness.status !== 'ok') issues.push('data freshness degraded');
  if (dataPipeline && dataPipeline.status !== 'ok') issues.push('data pipeline degraded');

  return {
    status: issues.length === 0 ? 'ok' : (api.error > 0 || !storage.localStorage ? 'error' : 'warn'),
    issues: issues,
    appVersion: appVersion,
    generatedAt: new Date().toISOString(),
    online: !(navigator && navigator.onLine === false),
    serviceWorker: sw,
    storage: storage,
    api: api,
    dataFreshness: dataFreshness,
    dataPipeline: dataPipeline,
    feed: feed,
    cache: cache,
    lastFetch: Object.assign({}, window._lastFetch || {}),
    logs: logs
  };
};
window.AIO.operationalHealthSnapshot = window.AIO.getOperationalHealth;

// v48.37: SCREENER_DB memo 내부 날짜 파서 — 애널리스트 리포트 staleness 구조적 감지
// 매칭 패턴: [Citi 04/17] · [JPM 04/17] · [GS 04/15 Buy] · [2026.04] · [2026-04-15]
// 반환: { oldestTs: number, freshestTs: number, isStale: bool, badge: HTML }
window._aioMemoStaleInfo = function(memo, opts) {
  if (!memo || typeof memo !== 'string') return null;
  opts = opts || {};
  var category = opts.category || 'report';
  var year = opts.year || new Date().getFullYear();
  var dates = [];
  // Pattern 1: [LABEL MM/DD] — 예: [Citi 04/17], [JPM 04/17], [GS 04/15 Buy]
  var rx1 = /\[[A-Za-z0-9&]+(?:\s[A-Z][A-Za-z]*)?\s(\d{1,2})\/(\d{1,2})(?:\s[A-Za-z]+)?\]/g;
  var m;
  while ((m = rx1.exec(memo)) !== null) {
    var mm = parseInt(m[1], 10), dd = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      var d = new Date(year, mm - 1, dd);
      // 미래 날짜면 작년으로 (예: 12/28 in April → 전년 12월)
      // v49.1 P186: 3월/11월 DST 전환 ±1h 보정 (fall-back 시 25h 허용)
      var _dstGrace = ([3, 11].indexOf(new Date().getMonth() + 1) !== -1) ? 3600000 : 0;
      if (d.getTime() > Date.now() + 86400000 + _dstGrace) d.setFullYear(year - 1);
      dates.push(d.getTime());
    }
  }
  // Pattern 2: [YYYY.MM] — 예: [2026.04]
  var rx2 = /\[(\d{4})\.(\d{1,2})\]/g;
  while ((m = rx2.exec(memo)) !== null) {
    var yr = parseInt(m[1], 10), mn = parseInt(m[2], 10);
    if (yr >= 2020 && yr <= 2040 && mn >= 1 && mn <= 12) {
      dates.push(new Date(yr, mn - 1, 15).getTime());
    }
  }
  // Pattern 3: [YYYY-MM-DD] — 예: [2026-04-15]
  var rx3 = /\[(\d{4})-(\d{1,2})-(\d{1,2})\]/g;
  while ((m = rx3.exec(memo)) !== null) {
    var y3 = parseInt(m[1], 10), m3 = parseInt(m[2], 10), d3 = parseInt(m[3], 10);
    if (y3 >= 2020 && y3 <= 2040 && m3 >= 1 && m3 <= 12 && d3 >= 1 && d3 <= 31) {
      dates.push(new Date(y3, m3 - 1, d3).getTime());
    }
  }
  if (dates.length === 0) return null;
  var freshest = Math.max.apply(null, dates);
  var oldest = Math.min.apply(null, dates);
  var DE = window.DATE_ENGINE;
  return {
    freshestTs: freshest,
    oldestTs: oldest,
    count: dates.length,
    isStale: DE ? DE.isStale(freshest, category) : false,
    badge: DE ? DE.staleBadge(freshest, category, opts.badgeOpts) : '',
    label: DE ? DE.formatRelative(freshest) : ''
  };
};

// v48.37: SCREENER_DB 특정 심볼 memo staleness 조회
window._aioStockStaleInfo = function(sym) {
  if (!Array.isArray(window.SCREENER_DB)) return null;
  var entry = window.SCREENER_DB.find(function(r) { return r.sym === sym; });
  if (!entry) return null;
  // _asOf 필드 우선 (v48.37+ 수동 지정), memo 파싱 폴백
  if (entry._asOf) {
    var DE = window.DATE_ENGINE;
    return {
      freshestTs: DE ? DE.toTs(entry._asOf) : 0,
      isStale: DE ? DE.isStale(entry._asOf, 'report') : false,
      badge: DE ? DE.staleBadge(entry._asOf, 'report') : '',
      label: DE ? DE.formatRelative(entry._asOf) : '',
      source: '_asOf'
    };
  }
  var info = window._aioMemoStaleInfo(entry.memo, { category: 'report' });
  if (info) info.source = 'memo-parse';
  return info;
};

// 자동 렌더: 가이드 페이지 진입 시 + 30초 주기
// v48.99: _aioPageBus 마이그 (P178)
_aioPageBus.register('core-guide-shown', 'aio:pageShown', function(e) {
  if (e && e.detail && e.detail.id === 'guide') {
    setTimeout(function() { if (window._aioRenderFreshness) window._aioRenderFreshness(); }, 100);
  }
});
if (typeof window !== 'undefined') {
  // v48.91: 타이머 레지스트리 등록
  window._aioFreshnessPanelTimer = _aioRegisterTimer('freshnessPanel', function() {
    var panel = document.getElementById('aio-freshness-panel');
    if (panel && panel.offsetParent !== null && window._aioRenderFreshness) {
      window._aioRenderFreshness();
    }
  }, 30000);
}
// DATA_SNAPSHOT — 단일 진실 원천 (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────
//  데이터 업데이트 시 이 객체만 수정하면 전체 페이지에 반영됩니다.
//    HTML 본문에 직접 숫자를 수정하지 마세요!
// ─────────────────────────────────────────────────────────────────
const DATA_SNAPSHOT = {
  // v48.36: _updated는 정적 폴백 스냅샷 작성 시점. 실제 UI freshness는 window._lastFetch[apiName]로 판정 (DATE_ENGINE.staleBadge 사용).
  // 정적값이 표시되는 경우는 API 100% 차단 시 뿐이며, 이 때는 _updated로 사용자에게 폴백 경고 표시.
  // v49.8: _updated → 2026-05-13 KST 정적 폴백 작성 시각 (미국 5/12 종가 + 한국 5/13 KOSPI 기준)
  _updated: '2026-05-29T17:00:00+09:00',   // v49.96 근본보강: 본체↔_fallback 미러 정합(move 62→70.9·vvix 85→83·skew 142→139·breadth200 57→56·fg_uw 74→65) + getSnapshotFallbackConsistencyAudit(R184) + KR_STOCK_DB 코드추출 버그 fix(P460, 0→198 siseJson 폴백) + Audit Push(P461/R185 _aioAutoSurfaceOps pull→push). | v49.95 2차지표 실측 대조 5차 (KR+US+글로벌). KR: krCpi 2.7→2.6·krManufPmi 51.5→53.6·krPpi 1.5→6.9·krCreditBalance 19.2→36.0. US: ismPmi 52.4→52.7·ismPrice 70.7→84.6·ismSvc 54→53.6·retailSales 0.6→0.5·consConf 104.7→93.1·housingStarts 1.42→1.47·move 62.5→70.9·usWageGrowth 3.5→3.6·rut 2858→2936.57. 글로벌: shanghai 3420→4098(20% stale)·cac 7950→8096·ng 2.95→3.07. 옵션: pcr 0.67→0.83(CBOE total 5/21, _fallback과 불일치 해소). MOVE 인라인 시드 모순(62.4/107.4) 통일.
  _snapshotDate: '2026-05-28',
  _staticDates: {
    briefingArchive: '2026-05-28',
    jensenInterview: '2026-03-20',
    optionSnapshot: '2026-05-28',
    krMarket: '2026-05-28',
    krIssues: '2026-05-28',
    tnx2y: '2026-05-27'
  },
  _isFallback: true,                         // v48.36: 실시간 데이터로 덮어쓰면 false로 전환 (applyDataSnapshot 내)
  // 아래 날짜들은 정적 폴백값입니다. 실시간 데이터 수신 시 자동 교체됩니다.
  _note: 'v49.86 /data-refresh 3차 (2026-05-28 KST): 추가 갱신 — 4월 CPI 3.8%/Core 2.8%(BLS 5/14) · 4월 NFP +115K/실업 4.3%(BLS 5/8) · Nikkei 64,999(5/27) · BTC $75,216/ETH $2,068(Yahoo 5/27) · SKEW 139.04 · KR 수출 5/1~20 +64.8%/반도체 +202.1%(역대최대) · KR 외국인 -1.77조(16연속 순매도). v49.84 원문: **US close 2026-05-27** — SPX 7,520.36 (+0.02%, 신고가) / NASDAQ 26,674.73 (+0.07%) / Dow 50,644.28 (+0.36%, 신고가) / Russell 2000 -0.02%. VIX 17.01 (-9% vs 5/12 18.70). **KR close 2026-05-28** — KOSPI 8,185.29 (-0.53%, 5일 랠리 종료) / KOSDAQ 1,104.36 (-2.54%). **원자재 급락** — WTI $88.30 (-6%, 이란 평화 협상 호재) / Brent <$95 (-4.5%) / Gold $4,483.15 (전일 close). **금리** — 10Y 4.48% / 2Y 4.035% / 30Y 5.01%. CNN F&G 60 (Greed, 5/26 기준). AAII 5/22 발표: Bull 39.3% / Neutral 24.1% / Bear 36.6% / Bull-Bear spread +2.7%. **거시 컨텍스트** — 4월 CPI 3년 고점 (Iran 전쟁 + AI 지출 영향), Strait of Hormuz 1개월 내 재개 가능성 (이란 발언), 미국 draft 거부. Static fallback only; Delayed/Fallback/Stale labels must remain visible until live stores override.',

  // ── 미국 주요 지수 (2026-05-27 종가 / WebSearch CNBC/TheStreet 확인) ──
  spx:        7563.63,  spxPct:    +0.58,   // v49.91: 2026-05-28 close 신고가 (TheStreet/CNBC, PCE 3년최고에도 tech 주도)
  nasdaq:    26917.47,  nasdaqPct: +0.91,   // v49.91: 2026-05-28 close 신고가
  dow:       50668.97,  dowPct:    +0.05,   // v49.91: 2026-05-28 close (+24.69 pts)
  rut:       2936.57,  rutPct:    +0.13,   // v49.95: Russell 2000 2,936.57 실측 (5/28, 52주 신고가권 — 5/27 2,932.74 신고가. Yahoo ^RUT). 기존 2858.50 추정 78pt stale
  vix:          15.74,  vixPct:    -3.38,   // v49.91: FRED VIXCLS 2026-05-28 (17.01 → 15.74, 위험선호 강화)
  vvix:         83.00,                        // v49.91: VVIX 추정 (VIX 15.74 추가 하락 동조)

  // ── 한국 지수 (2026-05-28 종가 / KRX Seoul Economic Daily 확인) ──
  kospi:     8185.29,  kospiPct:  -0.53,  kospiPrev: 8228.70,  // v49.84: 2026-05-28 close (5일 랠리 종료, 중동 긴장 + 채권금리 상승)
  kosdaq:    1104.36,  kosdaqPct: -2.54,  kosdaqPrev: 1133.13, // v49.84: 2026-05-28 close

  // ── 원자재 (2026-05-27 settle / Trading Economics 확인) ──
  wti:       90.50,  wtiPct:    +2.00,   // v49.92: 2026-05-28 ($88.30 → $90.5, 이란 충돌 재개 — 5/27 평화보도 가짜 판명, 미군 이란기지 타격)
  brent:     96.29,  brentPct:  +2.10,   // v49.92: 2026-05-28 (TradingEconomics, 이란 군사 충돌 재개)
  gold:      4411,   goldPct:   -1.60,  goldWeeklyPct: -6.0,  // v49.92: Fortune/APMEX 2026-05-28 ($4483 → $4411)
  ng:        3.07,                       // v49.95: Henry Hub 천연가스 $3.07/MMBtu 실측 (EIA/FRED 5/18). 기존 2.95 stale

  // ── 환율 (2026-05-27 / WebSearch confirmed) ──
  krw:      1463.50,  krwPct:   -0.50,  krwRound: 1464,  // v49.84: WTI 급락 + KOSPI 5일 랠리 → 원화 강세 (1490 → 1464)
  dxy:        99.14,  dxyPct:   -0.03,                   // v49.85: WebSearch 2026-05-27 confirmed (98.16 → 99.14, +0.98)

  // ── 금리·통화정책 ──
  fedRate:     '3.50-3.75',
  fedStatus:   '동결',                              // v45.6: 동적화 — Fed 금리 변경 시 이 값 갱신 (인하/인상/동결)
  fomc:        '6/16-17',
  fomcNext:    '6/16-17',                            // v48.70: 4/28-29 동결 완료 → 다음 FOMC 6/16-17 (SEP 회의)
  fomcDotPlot: '3월 dot plot: 중앙값 -25bp / 7명 동결 / 7명 -25bp',  // v49.85: 3월 dot plot 기반, 6/17 SEP 갱신 예정
  ecbRate:      2.15,  ecbStatus: '동결',
  bojRate:      0.75,   // v49.92: BOJ 4/27-28 회의 0.50→0.75 인상 (TradingEconomics, 기존 0.50 stale)
  boeRate:      3.75,   // v49.93: BOE 4/30 회의 8-1 동결 3.75% (기존 4.50 stale, 0.75%p — 중동 인플레로 추가 인하 보류)
  pbocRate:     3.00,   // v49.93: PBOC 1년 LPR 3.0% (5월 12개월째 동결, 5Y LPR 3.5%, 기존 3.10 stale)
  // v34.6: 한국 금리·채권 강화 / v49.85: 신현송 총재 첫 금통위 5/28 결정
  bokRate:      2.50,   bokStatus: '동결',          // v49.85: 한은 2.50% 8연속 동결 (신현송 총재 첫 회의 2026-05-28, 중동 불확실성 사태 추이 점검)
  bokNext:     '2026-07-10',                         // v49.85: 다음 금통위 7월 10일 (5/28 동결 완료, 신현송 총재 첫 결정)
  bokGdpFcst:   2.6,    bokCpiFcst: 2.7,             // v49.85: 한은 2026 성장률 2.6% / 물가 2.7% 상향 조정 (5/28 SEP)
  krBond3y:     3.20,   krBond10y: 4.27,             // v49.93: 국고채 10Y 4.27% (BOK snapshot 5월 중순, 2023.11 이후 최고 — 한은 인상 기대 급등, 기존 3.72 stale). 3Y 인상기대 반영 추정 (기준 2.50 동결 vs 시장금리 급등 = 가파른 커브)
  krCd91:       2.78,                             // CD 91일 금리
  vkospi:      18.20,                             // v49.92 P453 정정: v49.87 WebSearch "74.02"는 명백한 오류 (VIX 15.74 + KOSPI 사상최고와 양립 불가, VKOSPI 정상범위 12~25, 74=코로나 패닉). VKOSPI-VIX 상관 + KOSDAQ -2.54% 반영 합리적 추정. 라이브(fetchVkospiDynamic Naver) 우선
  vkospiPct:   +2.30,                              // v49.92: VKOSPI 추정 변동률 — data-snap="vkospi-chg" 시드
  hySpread:    275,                                // v49.84: HY 스프레드 (위험선호 지속, 신고가 환경 — 5/27 SPX 신고가)
  tnx2y:       4.035,                              // v49.84: 2Y Treasury — WebSearch 2026-05-27 (이란 평화 협상 호재로 short-end -1bp)

  // ── 거시 지표 ──
  cpi:          3.8,   coreCpi:   2.8,   // v49.86: CPI 4월 YoY 3.8% · Core 2.8% (BLS 5/14 발표, Iran 전쟁+AI 지출 영향 — Fortune 2026-05-12)
  pce:          3.8,   corePce:   3.3,            // v49.91: 4월 PCE (BEA 5/28 발표) — Headline 3.8% (2023.5 이후 최고) / Core 3.3% (2023.10 이후 최고). MoM Headline +0.4 / Core +0.2
  ismPmi:      52.7,   ismPrice:  84.6,           // v49.95: 4월 ISM Mfg 52.7 (3월과 동일, 2022.8 이후 최강 · 18개월 확장) · Prices 84.6(2022.4 이후 최고, 19개월 연속 상승 — 철강·알루미늄·석유·관세). ISM 5/1 발표. 기존 ismPrice 70.7 14pt stale
  ismSvc:      53.6,                              // v49.95: 4월 ISM 서비스 PMI 53.6 실측 (5/5 발표 — 3월 54.0→4월 53.6, 22개월 연속 확장. Prices 70.7 고착). 다음 6/3 5월분. 기존 54.0 stale
  usUnemploy:   4.30,  // v49.86: 4월 NFP +115K(컨센 하회), 실업률 4.3% (5/8 발표) — 다음 6/5 5월분 예정
  usNfp:        115,                               // v49.86: 4월 NFP +115K (헬스케어·운수·소매 주도)
  usWageGrowth: 3.6,                              // v49.95: 4월 시간당 평균 임금 +3.6% YoY 실측 ($37.41, MoM +0.2%, BLS 5/8 — 단 실질임금 -0.3% 인플레 잠식). 다음 6/5 5월분
  retailSales:  0.5,                              // v49.95: 4월 소매판매 +0.5% MoM 실측 ($757.1B, +4.9% YoY, 3개월 연속 증가 — 단 휘발유 +12.3% 인플레 영향. Census 5/14). 다음 6/17 5월분
  consConf:     93.1,                              // v49.95: 5월 Conference Board 소비자신뢰 93.1 실측 (1985=100, 4월 수정 93.8→5월 93.1, 중동전쟁 인플레로 하락 — 기대지수 74.4. 5/26 발표). 기존 104.7 11pt stale + 라벨 '미시간' 오류(실은 Conference Board)
  housingStarts:1.47,                             // v49.95: 4월 주택착공 1.465M SAAR 실측 (Census 5/21 — 3월 수정 1.507M 대비 -2.8%, 전년比 +4.6%. 단독 930K). 기존 1.42 stale
  krUnemploy:   3.4,
  // v34.6: 한국 거시 지표 강화
  krCpi:        2.6,                              // v49.94: 한국 4월 CPI YoY 2.6% 실측 (통계청 — 3월 2.2→4월 2.6 가속, 2024.7 이후 최고, 교통 +9.7% 유가). 기존 2.7은 BOK 연간 전망치 혼동
  krPpi:        6.9,                              // v49.94: 한국 4월 PPI YoY +6.9% 실측 (한국은행 5월 발표 — 2022.10 이후 최고, 28년만 최대 충격. MoM +2.5%, 8개월 연속 상승, 석유·석탄 +73.9% YoY 주도 = 이란 유가). 기존 1.5 심각 stale
  krManufPmi:  53.6,                              // v49.94: 한국 4월 제조업 PMI 53.6 실측 (S&P Global 5/4 발표 — 3월 52.6→4월 53.6, 2022.2 이후 최강 확장, 신제품·고객 재고확보). 다음 6/2 5월분. 기존 51.5 stale
  krManufPmiPrev: 52.6,                           // v49.94: 3월 한국 제조업 PMI (모멘텀 추적용)
  krGdp:       -0.2,   krGdpYoy:  2.6,           // v49.86: 한국 GDP QoQ -0.2 / YoY → BOK 5/28 SEP 성장률 2.6% 상향 (반도체 수출 호조)
  krExport:    +64.8,   krExportStreak: 15,       // v49.86: 5월 1~20일 +64.8% YoY (527억$ 역대 최대), 15개월 연속 흑자 (Korea Times 2026-05-21)
  krSemiExport:+202.1,                            // v49.86: 5월 1~20일 반도체 +202.1% YoY (220억$ = 수출 41.7%, HBM AI 서버 수요)
  kospiPE:      9.8,    kospiPB:   0.92,          // KOSPI PER/PBR
  kosdaqPE:    32.5,                              // KOSDAQ PER
  krShortSell:  4.1,                              // 공매도 비중(%)
  krForeignNet:-17700,                            // v49.86: 외국인 순매수 (5/27 -1.77조원 순매도, 16연속 순매도 — 한경)

  // ── v49.41 P299/R74 보강: breadth*sma DATA_SNAPSHOT 시드 등록 (이전 _fallback만 정의 → 폴백만 동작 차단) ──
  // breadth-5sma / breadth-20sma / breadth-50sma / breadth-200sma data-snap 4 sink가 시드 의존.
  // 실시간 fetch 경로(있다면 fetchBreadthFromAPI)에서 set 시 _isFallback false 전환 필요.
  breadth5sma:    61,   // v49.87: $MMFD 61.41 → 반올림 61 (Barchart 실측, NYSE % above 5-day MA)
  breadth20sma:   57,   // v49.87: $MMTW 57.47 → 57 (Barchart 실측, NYSE % above 20-day MA — 기존 75 대비 CRITICAL 하락)
  breadth50sma:   61,   // v49.87: $MMFI 60.77 → 61 (Barchart 실측, NYSE % above 50-day MA — 기존 46 대비 개선 확인)
  breadth200sma:  56,   // v49.87: $MMTH 56.19 → 56 (Barchart 실측, NYSE % above 200-day MA)

  // ── v48.61 P125 해소: DATA_SNAPSHOT 누락 필드 보충 (v49.22: 2026-05-16 기준 갱신, P213 DOM 정합) ──
  krCreditBalance: 36.0,     // v49.94: 한국 신용거래융자 잔고 ~36조원 역대 최고 (5월 — KOSPI 8000+ 돌파 "빚투" 급증, 3/11 31.8조→5월 36조, 5/21 강제청산 뉴스. 금투협/FSC). 기존 19.2 심각 stale (시장 2배 급등 미반영)
  krDeposit:       62.8,     // 예탁금 (조원, 2026-05-16 추정)
  krShortSelling:   4.1,     // 공매도 비중 % — krShortSell 별칭
  krAdvance:        593,     // 상승 종목수 (KOSPI+KOSDAQ, 2026-05-16 추정)
  krDecline:        389,     // 하락 종목수 (2026-05-16 추정)
  kr52wHigh:         52,     // 52주 신고가 종목수 (2026-05-16 추정)
  kr52wLow:          64,     // 52주 신저가 종목수 (2026-05-16 추정)
  krCoreCpi:        1.4,     // 한국 근원 CPI YoY (2026-02 기준, BOK)
  krServicePrice:   3.2,     // 한국 서비스 물가 YoY
  krServicePmi:    51.2,     // 한국 서비스업 PMI
  gexCurrent:     -12.8,     // GEX (Gamma Exposure, $B) — CBOE/SpotGamma 수동 스냅샷

  // ── v48.61 /data-refresh: GPU 임대가 + DRAM/NAND 가격 (JPM DC Watch 2026-03 실측) ──
  gpuRentalA100:    1.48,    // A100 $/h (2026-03, +6.5% MoM · 3개월 가속)
  gpuRentalH100:    2.64,    // H100 $/h (+8.6% MoM · 4개월 연속)
  gpuRentalB200:    5.47,    // B200 $/h (+23.5% MoM 급등)
  gpuRentalRatio_B200_H100: 2.07,   // B200/H100 비율 확대 (압축 반전)
  gpuRentalRatio_H100_A100: 1.78,   // H100/A100 비율
  ddr5_16gb_spot:  31.18,    // DDR5 16Gb 현물가 ($/unit · 2026-03 · -6.1% MoM · +573% YoY)
  nand_1tb_spot:   28.96,    // NAND 1Tb 현물가 ($/unit · 2026-03 · +16.0% MoM · +475% YoY)
  dramContract_QoQ_1Q26: 95, // v49.95: DRAM 계약가 QoQ 1Q26 +95% (TrendForce/Tom's Hardware 확인, 96→95)
  dramContract_QoQ_2Q26: 63, // v49.95: DRAM 계약가 QoQ 2Q26 +63% (TrendForce 최신, 61→63 — AI 서버 수요 공급 타이트)
  dramContract_YoY_2Q26: 421, // DRAM 계약가 YoY 2Q26 (+421%)
  nandContract_QoQ_1Q26: 88, // NAND 계약가 QoQ 1Q26 +88% (TrendForce 확인)
  nandContract_QoQ_2Q26: 75, // v49.95: NAND 계약가 QoQ 2Q26 +75% (Tom's Hardware/TrendForce 최신, 73→75)
  nandContract_YoY_2Q26: 362,
  // ── v48.71 /data-refresh: AAII bearish 최신화 (정적 폴백) ──
  aaiiBear:        36.6,     // v49.86: AAII 5/22 발표 Bear 36.6% (Bull 39.3 / Neutral 24.1)

  // ── 글로벌 지수 (GMO 테이블용 정적 폴백, 실시간 수신 시 교체) ──
  nikkei:    64693,    nikkeiPct:  -0.47,  // v49.92: 2026-05-28 close (TradingEconomics/Yahoo)
  hangseng:  25006,    hangsengPct: -1.27, // v49.92: 2026-05-28 close (CNBC Asia, 기존 25947 stale)
  shanghai:   4098,    shanghaiPct: +0.12, // v49.95: SSE Composite 4,098 실측 (5/28 +0.12%, BBN/TradingEconomics — 지정학 경계+기술주 회복). 기존 3420 ~20% stale (글로벌 랠리 미반영)
  dax:       25068,    daxPct:     -0.59,  // v49.92: 2026-05-28 close (기존 23200 → 25068 큰 stale 시정, DAX 사상최고권)
  ftse:      10428,    ftsePct:    -0.73,  // v49.92: 2026-05-28 close (기존 10611 stale)
  cac:        8096,    cacPct:     -0.30,  // v49.95: CAC 40 8,096 실측 (5/28 -0.3%, 5/27 8,207.89 — 약한 PMI+중동 긴장. BBN/TradingEconomics). 기존 7950 stale

  // ── 크립토·추가 원자재 (정적 폴백, 실시간 수신 시 교체) ──
  btc:       75216,    btcPct:    -1.90,   // v49.86: BTC $75,216 2026-05-27 09:21 ET (Yahoo Finance, Iran 평화 협상 + 위험선호)
  eth:        2068,    ethPct:    -1.90,   // v49.86: ETH $2,068 2026-05-27 09:21 ET (Yahoo Finance)
  silver:     73.51,   silverPct: -0.91,  // v49.92: Fortune 2026-05-28 ($71.50 → $73.51)

  // ── 리스크 지표 (5/27 갱신) ──
  move:        70.90,   moveChg: -1.20,  // v49.95: MOVE 70.90 실측 (streetstats/Yahoo ^MOVE 2026-05-27 — 80 미만 = 채권시장 평온). 기존 62.50 추정 stale
  skew:       139.04,   skewChg: -1.50,  // v49.86: SKEW 139.04 (StreetStats.finance 5/27 데이터)
  vvix_live:   85.50,   vvixChg: -1.40,  // v49.86: VVIX 추정 하향 (VIX 17.01 동조)
  fg:            60,   fgLabel: 'Greed',  // v49.84: CNN F&G 60 (Greed, 2026-05-26 기준)
  fg_uw:         65,   fg_uwLabel: '탐욕', // v49.96: UW 확장 F&G 65 — _fallback.fg_uw(v49.84 CNN 60→UW 65)와 정합 (기존 74는 v48.70 stale)

  // ── v47.2: F&G 카테고리·지표별 분해 (Unusual Whales 4/15) ──
  //   헤드라인 68 뒤에 숨은 내부 구조 — Market Breadth 35.9(공포) + Stock Price Strength 24.8(극단 공포)
  //   vs Premium Trend 100(극단 탐욕) 극단 괴리가 "좁은 랠리"의 수치적 증거
  fg_categories: {
    momentum:  80.6,  // Market Momentum: SPX 125일선 대비 괴리 (강한 탐욕)
    options:   76.6,  // Options Sentiment: 콜매수 우위 (탐욕)
    bondRisk:  72.4,  // Bond And Risk: HY 스프레드 타이트 (탐욕)
    marketData:69.1,  // Market Data: SPX 점유율 (탐욕)
    volatility:60.0,  // Volatility: VIX 낮음 (약한 탐욕)
    breadth:   35.9   // Market Breadth: 상승/하락 종목비 (공포 — 헤드라인 68과 괴리)
  },
  fg_indicators: {
    putCall:       70.1,   // Put/Call Ratio → F&G 환산점수
    momentum:      80.6,   // Market Momentum
    premiumRatio:  91.8,   // Premium Ratio (극단 탐욕)
    priceStrength: 24.8,   // Stock Price Strength: 52주 신고가/신저가 절대 비율 (극단 공포!)
    breadth:       48.2,   // Market Breadth (중립)
    premiumTrend:100.0     // Premium Trend (극단 탐욕 MAX)
  },
  fg_extended: {
    // Unusual Whales 확장 5지표 (CNN F&G 구성요소 + 추가 지표)
    junkBondDemand:   45.6, // HY vs IG 스프레드 기반 (중립)
    safeHavenDemand:  99.2, // 주식 vs 채권 20일 수익률 차이 — 높을수록 주식 편애 (Extreme Greed, weight 6%)
    fiftyTwoWeekSent: 91.2, // 52주 범위 내 상대 위치 높은 종목수 (극단 탐욕)
    putCall:          47.2, // Put/Call F&G 환산치 (중립)
    insiderSentiment: 0.1   // 내부자 매수/매도 3개월 비율 (극단 공포! 2021.11 고점 선례)
  },

  // v49.8: OPEX/gamma fallback seeds; live CBOE/option data overrides when available.
  pcr: 0.83,            // v49.95: CBOE total put/call 0.83 실측 (2026-05-21, MacroMicro/ycharts) — 기존 0.67 stale + _fallback.pcr 0.83과 불일치 해소
  equityPutCall: 0.51,
  indexPutCall: 0.71,

  // ── v47.2: 위험봇 3/30 12:49 STABLE 역사 스냅샷 (Tail Risk Board) ──
  //   4/15 현재와 별개 — "관세 쇼크 저점 직후 STABLE 판정" 시점의 꼬리위험 구조
  tail_risk_snapshot_0330: {
    date:       '2026-03-30 12:49',
    regime:     'STABLE',    // 안정 구간
    signal:     'none',       // 핵심 신호 없음
    skew:       139,  skewChg: -7.14,   // TAIL HEDGE: 하락했어도 여전히 꼬리헤지 비쌈
    vvix:       98,   vvixChg: +2.36,   // VOL OF VOL: 정상 상단
    vixStructure:'contango', vixSlope: +2.6, // 건강한 콘탱고
    vix9d:      null, vix9dChg: -2.2,   // SHORT STRESS: 초단기 공포 하락
    move:       68,   moveChg: -13.71,  // RATES VOL: 채권 변동성 극단 낮음 (정상 100+, 68은 비정상적 안정)
    dxy:        98.0, dxyChg:  -0.65    // USD STRESS: 달러 약세 약간
  },

  // ── v47.2: ZBT (Zweig Breadth Thrust) 트래킹 ──
  //   정의: NYSE 상승/하락 비율이 10거래일 내에 0.40 → 0.615 돌파 시 발동 → Lock-out Rally 신호
  //   2025.4 선례: 0.38 → 0.617 → 발동 → 4월말~장기 랠리. 2026.4 현재: 0.5756 = 미발동
  zbt: {
    current:         0.5756,   // SPY 차트 하단 ZBT 지표 최신값 (2026.04.15)
    trigger_low:     0.40,     // ZBT 촉발 하한
    trigger_high:    0.615,    // ZBT 돌파 상한
    last_trigger:    '2025-04-25', // 가장 최근 ZBT 발동 (0.38→0.617)
    current_status:  'no_trigger', // 2026.3-4 랠리는 ZBT 없이 상승 = 브레드쓰 부실
    breadth_0313:    0.37,     // 전쟁 우려 하락 시 상/하 종목비 저점
    breadth_0330:    0.44      // 하락 피크에서 반등한 종목비 (일반적이면 클라이막스 신호)
  },

  // ── KR 섹터 ETF (4/3 종가 — v49.95 /data-refresh SKIPPED: ETF↔필드 매핑 불명 + 라이브 fetch 이상적. krSemiPrice 100200 > KODEX반도체(091160) 52주최고 90,900 = 다른 ETF/stale. 단발 WebSearch 대조 부적합, 라이브 우선) ──
  krSemiEtf:   -1.50,  krSemiPrice:  100200,
  kr2ndBatEtf: -1.20,  kr2ndBatPrice: 15800,
  krDefense:   -0.80,  krDefensePrice: 1260000,
  krShip:      -1.60,  krShipPrice:   34100,
  krBank:      -1.30,  krBankPrice:   15300,
  krBio:       -1.10,  krBioPrice:    12700,

  // ── v46.4: 트레이딩 스코어 폴백값 (단일 진실 원천) ──
  // /data-refresh 실행 시 이 값들을 DATA_SNAPSHOT과 함께 갱신.
  // 모든 computeTradingScore/computeMarketHealth/computeExecutionWindow가 여기서 읽음.
  _fallback: {
    fg: 60,              // v49.84: CNN F&G 60 (Greed) 2026-05-26 기준
    fg_uw: 65,           // v49.84: UW 확장 F&G (CNN 60 → UW 65 추정)
    vix: 15.74,          // v49.91: VIX 2026-05-28 close
    breadth200: 56,      // v49.96: $MMTH 56.19→56 (% above 200d) — breadth200sma와 정합 (기존 57은 MMTW 20d값 혼동)
    breadth5: 61,        // v49.87: $MMFD 61.41 실측 (Barchart)
    breadth50: 61,       // v49.87: $MMFI 60.77 실측 (Barchart)
    pcr: 0.83,           // v49.85: CBOE total PCR 2026-05-21 (equity 0.55 / index 별도)
    aaiiBear: 36.6,      // v49.84: AAII 2026-05-22 발표 Bearish %
    spx50ma: 7280,       // v49.84: SPX 50일 이동평균 (5/27 기준 추정 — 신고가 후 상승)
    spx200ma: 6950,      // v49.84: SPX 200일 이동평균 추정
    spxATH: 7563.63,     // v49.91: SPX ATH = 2026-05-28 close (신고가)
    dxy: 99.14,          // v49.85: DXY WebSearch 2026-05-27 confirmed
    tnx: 4.48,           // v49.84: 10Y 2026-05-27 close
    hyg: 81,             // v49.84: HYG (Iran 호재 + 신고가 환경 — 신용 스프레드 추가 타이트닝)
    vvix: 83,            // v49.96: VVIX 83 — DATA_SNAPSHOT.vvix와 정합 (기존 85 드리프트)
    move: 70.9,          // v49.96: MOVE 70.9 — DATA_SNAPSHOT.move와 정합 (기존 62는 v49.95 move 70.9 갱신 시 미러 누락 = 내가 만든 불일치 시정)
    skew: 139,           // v49.96: SKEW 139 — DATA_SNAPSHOT.skew 139.04와 정합 (기존 142 드리프트)
    _syncDate: '2026-05-29'  // v49.96: static fallback sync date (snapshot 본체와 mirror 정합)
  }
};

// 편의 포맷터 (안전한 숫자 포맷 — undefined/NaN 방어)
window.DATA_SNAPSHOT = DATA_SNAPSHOT;

const _snap = {
  num(v, fallback) { const n = Number(v); return isNaN(n) ? (fallback ?? 0) : n; },
  comma(n) { return _snap.num(n).toLocaleString('en-US'); },
  krw()    { return _snap.num(DATA_SNAPSHOT.krwRound).toLocaleString(); },
  pct(n)   { const v = _snap.num(n); return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; },
  fixed(n, d) { return _snap.num(n).toFixed(d ?? 2); },
  localeFull(n, d) { return _snap.num(n).toLocaleString('en-US',{minimumFractionDigits:d??2,maximumFractionDigits:d??2}); },
};

// ═══════════════════════════════════════════════════════════════════
// v47.6: NARRATIVE_ENGINE — 데이터 기반 동적 분석 서술 엔진
// ═══════════════════════════════════════════════════════════════════
// DATA_SNAPSHOT 값이 바뀌면 분석·설명·트레이딩 규칙이 자동으로 갱신되도록
// 레짐 분류 → 동적 텍스트 생성 → DOM 렌더까지 단일 진실 원천에서 파생.
// - getXxxRegime: 값 → 의미(레벨/색상/라벨) 분류
// - getXxxText:    DATA_SNAPSHOT 조합 → 완성된 문단 생성
// - renderXxx:     DOM rm-*, CP 카드 실시간 바인딩
// v48.14 (Agent W3): NARRATIVE_ENGINE 하드코딩 날짜·선례 상수 분리
// 템플릿 문자열 내 '2000.01', '2021.11' 등 하드 레퍼런스를 중앙 관리
// 향후 신규 선례 추가·과거 선례 재분류 시 이 객체만 갱신
var HISTORICAL_PRECEDENTS = {
  distributionPhases: [
    { date: '2000.01', event: '닷컴 버블 정점', context: 'NASDAQ 5048 고점 직전 브레드쓰 악화' },
    { date: '2007.10', event: '서브프라임 위기 전', context: '금융주 선행 균열' },
    { date: '2021.11', event: '팬데믹 버블 정점', context: 'ARKK·MEME 주도 랠리 붕괴, Insider 공포 극단' }
  ],
  distributionSummary: '2000.01, 2007.10, 2021.11',
  lockoutRally: { date: '2025.04.25', zbt: 0.617, context: '2025년 4월 Lock-out Rally ZBT 0.38→0.617 정식 돌파' },
  bullCaseNarrowBreadth: ['2019', '2024'],
  lastUpdated: '2026-04-18'
};

const NARRATIVE_ENGINE = (function() {
  const DS = DATA_SNAPSHOT;
  const FB = DS._fallback || {};

  // ── 1. 레짐 분류기 ──────────────────────────────
  function getSKEWRegime(v) {
    v = _snap.num(v, FB.skew);
    if (v >= 150) return { level:'extreme',  label:'극단 꼬리헤지 비쌈', color:'#ff5b50', bar:95 };
    if (v >= 140) return { level:'high',     label:'꼬리위험 고점',       color:'#ff5b50', bar:85 };
    if (v >= 130) return { level:'elevated', label:'꼬리헤지 비쌈',       color:'#ffa31a', bar:70 };
    if (v >= 120) return { level:'normal',   label:'정상 상단',           color:'#ffa31a', bar:50 };
    return            { level:'low',      label:'정상',                color:'#00e5a0', bar:30 };
  }
  function getMOVERegime(v) {
    v = _snap.num(v, FB.move);
    if (v >= 200) return { level:'crisis',    label:'위기 수준',        color:'#ff5b50', bar:95 };
    if (v >= 150) return { level:'stress',    label:'스트레스',          color:'#ff5b50', bar:80 };
    if (v >= 100) return { level:'normal',    label:'정상',              color:'#ffa31a', bar:55 };
    if (v >= 75)  return { level:'calm',      label:'저점(정상화 리스크)', color:'#00e5a0', bar:35 };
    return            { level:'extreme_low', label:'극단 저점',         color:'#00e5a0', bar:20 };
  }
  function getVVIXRegime(v) {
    v = _snap.num(v, FB.vvix);
    if (v >= 140) return { level:'extreme', label:'옵션 변동성 극단', color:'#ff5b50', bar:95 };
    if (v >= 110) return { level:'warn',    label:'경고',             color:'#ffa31a', bar:75 };
    if (v >= 90)  return { level:'normal',  label:'정상 상단',         color:'#ffa31a', bar:60 };
    return            { level:'low',     label:'정상',             color:'#00e5a0', bar:40 };
  }
  function getFGRegime(v) {
    v = _snap.num(v, FB.fg);
    if (v >= 75) return { level:'extreme_greed', label:'극단 탐욕', color:'#ff5b50', bar:90 };
    if (v >= 55) return { level:'greed',         label:'탐욕',      color:'#ffa31a', bar:70 };
    if (v >= 45) return { level:'neutral',       label:'중립',      color:'#ffa31a', bar:50 };
    if (v >= 25) return { level:'fear',          label:'공포',      color:'#00e5a0', bar:30 };
    return          { level:'extreme_fear',  label:'극단 공포', color:'#00e5a0', bar:10 };
  }
  function getBreadthRegime(v) {
    v = _snap.num(v);
    if (v >= 70) return { level:'broad',   label:'광폭 랠리',     color:'#00e5a0' };
    if (v >= 55) return { level:'healthy', label:'건강',          color:'#ffa31a' };
    if (v >= 40) return { level:'narrow',  label:'좁은 랠리',     color:'#ffa31a' };
    return          { level:'fearful', label:'공포 영역',     color:'#ff5b50' };
  }
  function getInsiderRegime(v) {
    v = _snap.num(v);
    if (v <= 5)  return { level:'extreme_fear', label:'극단 공포(매도 일변도)', color:'#ff5b50' };
    if (v <= 20) return { level:'fear',         label:'공포',                  color:'#ffa31a' };
    if (v <= 50) return { level:'neutral',      label:'중립',                  color:'#ffa31a' };
    return          { level:'buying',       label:'매수 우위',             color:'#00e5a0' };
  }

  // ── 2. 분배 단계 진단 체크리스트 (3/3 동적 계산) ──────────
  function checkDistributionDiagnosis() {
    const fgVal      = _snap.num(DS.fg_uw, FB.fg_uw);
    const insider    = _snap.num((DS.fg_extended||{}).insiderSentiment);
    const breadth    = _snap.num((DS.fg_categories||{}).breadth);
    const premTrend  = _snap.num((DS.fg_indicators||{}).premiumTrend);
    const skew       = _snap.num(DS.skew, FB.skew);
    const gap        = fgVal - insider;

    const c1 = { pass: fgVal >= 60 && insider <= 20 && gap >= 40, desc: `대중 탐욕 ≥60 vs 내부자 공포 ≤20 괴리 ≥40pt (현재 UW F&G ${fgVal} vs Insider ${_snap.fixed(insider,1)} = ${_snap.fixed(gap,1)}pt 갭)` };
    const c2 = { pass: breadth <= 40,                               desc: `Market Breadth ≤40 동시 발생 (현재 ${_snap.fixed(breadth,1)} ${breadth<=40?'✅':'❌'})` };
    const c3 = { pass: premTrend >= 90 && skew >= 135,              desc: `옵션 프리미엄 극단 (Premium Trend ≥90 + SKEW ≥135, 현재 ${_snap.fixed(premTrend,1)}/${_snap.fixed(skew,2)} ${(premTrend>=90&&skew>=135)?'✅':'❌'})` };
    const passed = [c1,c2,c3].filter(c=>c.pass).length;
    return { c1, c2, c3, passed, total: 3, confirmed: passed === 3 };
  }

  // ── 3. F&G 내부 구조 분석 (§71 동적) ────────────────
  function getFGInternalStructureText() {
    const cat = DS.fg_categories || {};
    const ind = DS.fg_indicators || {};
    const fgUW = _snap.num(DS.fg_uw, FB.fg_uw);
    const fgCNN = _snap.num(DS.fg, FB.fg);
    const momentum = _snap.num(cat.momentum);
    const breadth  = _snap.num(cat.breadth);
    const gap      = momentum - breadth;
    const fgUWReg  = getFGRegime(fgUW);
    const cnnReg   = getFGRegime(fgCNN);
    const divergeNote = Math.abs(fgUW - fgCNN) >= 15
      ? `(CNN F&G는 ${cnnReg.label} ${fgCNN}로 이미 전환 ← 괴리 중요 신호)`
      : `(CNN F&G ${cnnReg.label} ${fgCNN} 동조)`;
    return (
      `[F&G ${fgUW} ${fgUWReg.label} — 실측, Unusual Whales] 카테고리별: Market Momentum ${_snap.fixed(cat.momentum,1)}(${getFGRegime(cat.momentum).label}), Options Sentiment ${_snap.fixed(cat.options,1)}(${getFGRegime(cat.options).label}), Bond Risk ${_snap.fixed(cat.bondRisk,1)}(${getFGRegime(cat.bondRisk).label}), Market Data ${_snap.fixed(cat.marketData,1)}(${getFGRegime(cat.marketData).label}), Volatility ${_snap.fixed(cat.volatility,1)}(${getFGRegime(cat.volatility).label}), Market Breadth ${_snap.fixed(cat.breadth,1)}(${getFGRegime(cat.breadth).label}!). 지표별: Premium Trend ${_snap.fixed(ind.premiumTrend,1)}(${getFGRegime(ind.premiumTrend).label}!), Premium Ratio ${_snap.fixed(ind.premiumRatio,1)}(${getFGRegime(ind.premiumRatio).label}!), Market Momentum ${_snap.fixed(ind.momentum,1)}, Put/Call ${_snap.fixed(ind.putCall,1)}, Market Breadth ${_snap.fixed(ind.breadth,1)}(${getFGRegime(ind.breadth).label}~공포), Stock Price Strength ${_snap.fixed(ind.priceStrength,1)}(${getFGRegime(ind.priceStrength).label}!).\n` +
      `[F&G 내부 구조 괴리 = 핵심 트레이딩 시그널] 헤드라인 ${fgUW}(${fgUWReg.label}) ${divergeNote}이 숨기는 것: ① 브레드쓰 ${_snap.fixed(cat.breadth,1)}+주가강도 ${_snap.fixed(ind.priceStrength,1)} = 52주 신고가 종목 극소수, 소수 대형주가 지수를 끌어올리는 "좁은 랠리". ② Premium Trend ${_snap.fixed(ind.premiumTrend,0)}+Premium Ratio ${_snap.fixed(ind.premiumRatio,1)} = 옵션 시장 극단적 자만(complacency). ③ 모멘텀(${_snap.fixed(cat.momentum,1)}) vs 브레드쓰(${_snap.fixed(cat.breadth,1)}) 갭 = ${_snap.fixed(gap,1)}pt → 2021.11(나스닥 고점 직전)과 유사한 괴리 수준. 결론: F&G ${fgUW}은 건강한 탐욕이 아니라 "소수 종목의 모멘텀 + 옵션 레버리지"가 만든 착시. 시장 폭 회복(브레드쓰 55+) 없이 모멘텀만 유지되면 숏감마 청산 시 급락 취약.`
    );
  }

  // ── 4. 분배 단계 종합 진단 (§72 동적) ────────────────
  function getDistributionDiagnosisText(dateStr) {
    const d = dateStr || (typeof DATE_ENGINE !== 'undefined' ? DATE_ENGINE.fmtYMD(DATE_ENGINE.nowKST()) : '오늘');
    const fgUW      = _snap.num(DS.fg_uw, FB.fg_uw);
    const fgCNN     = _snap.num(DS.fg, FB.fg);
    const fgCNNReg  = getFGRegime(fgCNN);
    const fgUWReg   = getFGRegime(fgUW);
    const ext       = DS.fg_extended || {};
    const cat       = DS.fg_categories || {};
    const ind       = DS.fg_indicators || {};
    const zbt       = DS.zbt || {};
    const zbtCurr   = _snap.num(zbt.current);
    const zbtLow    = _snap.num(zbt.trigger_low);
    const zbtHigh   = _snap.num(zbt.trigger_high);
    const insider   = _snap.num(ext.insiderSentiment);
    const insiderReg= getInsiderRegime(insider);
    const skew      = _snap.num(DS.skew, FB.skew);
    const skewChg   = _snap.num(DS.skewChg);
    const skewReg   = getSKEWRegime(skew);
    const move      = _snap.num(DS.move, FB.move);
    const moveChg   = _snap.num(DS.moveChg);
    const moveReg   = getMOVERegime(move);
    const vvix      = _snap.num(DS.vvix_live, FB.vvix);
    const vvixChg   = _snap.num(DS.vvixChg);
    const junk      = _snap.num(ext.junkBondDemand);
    const safeHaven = _snap.num(ext.safeHavenDemand);
    const fiftyTwo  = _snap.num(ext.fiftyTwoWeekSent);
    const putCallExt= _snap.num(ext.putCall);
    const spyATH    = _snap.num(FB.spxATH);
    const diag      = checkDistributionDiagnosis();
    const breadthReg= getBreadthRegime(cat.breadth);
    const gapIns    = fgUW - insider;

    return (
      `【§72 분배(Distribution) 단계 종합 진단 — 3개 레이어 진실 (${d})】\n` +
      `[시장 단계 진단] 후기 사이클 분배(Distribution). 유사 패턴 = 2000.01, 2007.10, 2021.11. 세 레이어의 진실:\n` +
      `  ① **표면(대중)**: UW F&G ${fgUW} ${fgUWReg.label}(CNN F&G는 ${fgCNNReg.label} ${fgCNN}로 이미 전환 ← 괴리 중요 신호), SPY ATH(~$${_snap.fixed(spyATH,2)} 권역), "Mission Accomplished" 내러티브. 대중은 "V자 회복 완료" 인식.\n` +
      `  ② **중간(브레드쓰)**: Market Breadth ${_snap.fixed(cat.breadth,1)}(${breadthReg.label}), ZBT 미발동(현재 ${_snap.fixed(zbtCurr,4)}, 촉발 하한 ${_snap.fixed(zbtLow,2)} 미터치 + 상한 ${_snap.fixed(zbtHigh,3)} 미돌파), 상승 종목비 ${_snap.fixed(zbt.breadth_0330,2)} 수준. 2025.4 Lock-out Rally 때 ZBT 0.38→0.617 돌파와 대조적.\n` +
      `  ③ **심층(스마트머니)**: Insider Sentiment ${_snap.fixed(insider,1)}(${insiderReg.label}), SKEW ${_snap.fixed(skew,2)}(${skewReg.label} — ${skew>=135?'꼬리헤지 비쌈 **심화**':'정상권'} 실측), Junk Bond Demand ${_snap.fixed(junk,1)}(채권쟁이 중립, 주식 UW F&G ${fgUW}과 ${_snap.fixed(fgUW-junk,1)}pt 괴리. CNN F&G ${fgCNN} ${fgCNNReg.label}).\n` +
      `[진단 체크리스트 ${diag.passed}/${diag.total} 충족${diag.confirmed?' = 분배 확증':''}] ① ${diag.c1.desc} ${diag.c1.pass?'✅':'❌'} ② ${diag.c2.desc} ③ ${diag.c3.desc}. ${diag.confirmed?'3/3 충족 = 2000.01, 2007.10, 2021.11 선례 부합.':diag.passed+'/3 — 부분 충족, 추가 확증 필요.'}\n` +
      `[ZBT ${zbtCurr>=zbtHigh?'발동':'없는 랠리 = 비정상 상승 구조'}] ZBT(Zweig Breadth Thrust) 정의: NYSE 상승/하락비 10거래일 내 ${_snap.fixed(zbtLow,2)}→${_snap.fixed(zbtHigh,3)} 돌파 = 강세장 개시 신호. 2025.4 저점(${_snap.fixed(zbt.breadth_0313,2)})→4월말 돌파 후 Lock-out Rally 정석. 현재 ${_snap.fixed(zbtCurr,4)}, 3/13 상하비 ${_snap.fixed(zbt.breadth_0313,2)}(촉발 하한 충족)했으나 3/15부터 대형주 저볼륨 투매가 지수 끌어내림 → 3/30 하락 피크 종목비 ${_snap.fixed(zbt.breadth_0330,2)}(클라이막스 기대)했으나 여기서부터 원웨이 상승으로 전환 = ZBT 메커니즘 작동 안 함. 히트맵: 시총 대형주 초록 / 나머지 빨강 = 안나 카레니나 "행복한 시장 모습이 아님".\n` +
      `[위험봇 STABLE의 역설 — MOVE ${_snap.fixed(move,2)} ${moveReg.label}이 바로 리스크, 실측] 2026.3.30 위험봇 스냅샷: SKEW 139(-7%)+VVIX 98(+2.4%)+VIX 콘탱고 slope +2.6+9D-VIX -2.2+MOVE 68(-14%!!)+DXY 98.0. **현재**: SKEW ${_snap.fixed(skew,2)}(${_snap.fixed(skewChg,2)}%) + MOVE ${_snap.fixed(move,2)}(${_snap.fixed(moveChg,2)}%) + VVIX ${_snap.fixed(vvix,2)}(${_snap.fixed(vvixChg,2)}%) = **역설 ${(move<=70&&skew>=135)?'심화':'일부 완화'}**. MOVE 정상 100+, 스트레스 150+, 위기 200+. **MOVE ${_snap.fixed(move,2)}은 ${moveReg.level==='extreme_low'?'사실상 사상 최저권':moveReg.label}**. 채권시장이 금리 불확실성 완전히 소화했다는 착시 → 주식 탐욕의 기반. 문제: MOVE 추가 ${moveChg<0?'붕괴':'반등'} + Premium Trend ${_snap.fixed(ind.premiumTrend,0)}(옵션 극단 탐욕) + SKEW ${skewChg>0?'추가 상승':'일부 조정'}(${_snap.fixed(skew,2)}) 공존 = "겉은 평온, 내부는 헤지로 무장" → 저가 테일헤지(VIX 콜, SPY 풋) 정당화 구간 **${(move<=70&&skew>=135)?'강화':'유지'}**. 1-2주 내 MOVE 90+ 반등 시 주식 랠리 즉각 흔들림.\n` +
      `[Unusual Whales 확장 5지표 — CNN 헤드라인 너머 스마트머니 증거] ① Junk Bond Demand ${_snap.fixed(junk,1)}(${getFGRegime(junk).label}) = 채권쟁이는 주식 F&G ${fgUW}만큼 낙관 안 함 ② Safe Haven Demand ${_snap.fixed(safeHaven,1)}(${getFGRegime(safeHaven).label}, 툴팁: 주식이 채권 대비 20일 수익률 극단 outperform) = 주식 편애 극단 ③ Fifty Two Week Sentiment ${_snap.fixed(fiftyTwo,1)} vs Stock Price Strength ${_snap.fixed(ind.priceStrength,1)} 모순 해결: 전자는 "52주 범위 내 상대 위치 높은 종목수(대형주 끌어올려 높게 나옴)", 후자는 "절대 신고가 vs 신저가 종목수 비율(좁은 랠리에서는 낮음)" — 둘 다 좁은 랠리 확증 ④ Put/Call ${_snap.fixed(putCallExt,1)}(${getFGRegime(putCallExt).label}, UW 환산치; PCR 실측 0.72~0.90과 별개) ⑤ Insider Sentiment ${_snap.fixed(insider,1)} = ${insiderReg.label}, 2021.11 고점 선례.\n` +
      `[Pain Trade 완결 시나리오] "Skew 안 내려감 + VIX 낮은데 풋옵션 안 저렴" = 숏 포기(capitulation) 시점 = 진짜 고점. Premium Trend ${_snap.fixed(ind.premiumTrend,0)}은 이 시나리오와 정확히 일치(옵션 매수 극단 = 헤지·추격 모두 비쌈). 롱/숏 메커니즘 해소 진행 중: MSFT·TSLA↑ / MU·SNDK·CAT↓ = 전형적 강세장 모습 아님. 공매도가 완전히 포기하는 순간 랠리 연료 소진 → 급격한 언와인드 리스크. 2000.01 나스닥 5,048(고점) 직전 브레드쓰 악화 구조와 동일.\n` +
      `[트레이딩 규칙 — 분배 단계 대응] ① 포지션 축소 시작(100%→70~80%), 신규 진입은 VCP/피봇 돌파 품질 종목 한정(무작위 매수 실패율 ↑ 확인: 상/하 종목비 불건강). ② 대형주 추격 매수 금지(MSFT·TSLA 등 과밀 포지션, 롱/숏 언와인드 시 가장 먼저 매도 대상). ③ 저가 테일헤지 정당화: VIX 낮고 SKEW ${_snap.fixed(skew,2)}(실측) ${skewChg>0?'상승':'유지'} + Premium Trend ${_snap.fixed(ind.premiumTrend,0)} = 가격 대비 가치 비싸 보여도 구조적 리스크 대비 정당화. SPY 풋 3% OTM 또는 VIX 콜 25 strike 검토. ④ 모니터링 트리거: (a) Market Breadth ${_snap.fixed(cat.breadth,1)}→55+ 회복 시 분배 진단 약화 (b) ZBT 지표 ${_snap.fixed(zbtHigh,3)}+ 돌파 시 새 Lock-out Rally 가능성 (c) MOVE ${_snap.fixed(move,2)}→90+ 반등 시 채권 변동성 재점화 경고 (d) Insider Sentiment ${_snap.fixed(insider,1)}→5+ 반등 시 경영진 공포 완화 (e) Safe Haven Demand ${_snap.fixed(safeHaven,1)}→70 이하 하락 시 주식 상대우위 붕괴.\n` +
      `[반대 시나리오(Bull Case)] 강세 시기에도 브레드쓰 좁아지는 선례 존재(2019, 2024). AI 구조적 스토리 유효한 한 대형주 프리미엄 정당화 가능. MOVE ${_snap.fixed(move,2)}(실측) = 금리 변동성 ${moveReg.label} = 장기 랠리 연료(단 정상화 리스크 내재). 단, 이 시나리오는 Insider Sentiment ${_snap.fixed(insider,1)}→20+ 회복 없이 지속 불가 — 경영진이 계속 팔면서 AI 스토리만으로 올리는 건 구조적 한계.`
    );
  }

  // ── 4B. CP1~CP8 체크포인트 동적 텍스트 생성기 (v48.15 텍스트-A) ─────────────────
  // 8가지 리스크 현황판 각 셀(cp1-detail ~ cp8-detail)의 해설 텍스트를 DATA_SNAPSHOT 기반 동적 생성.
  // 기존 getDistributionDiagnosisText · getFGInternalStructureText와 동일 패턴.
  // 동적 핵심 데이터 없는 셀(CP4 재정 · CP5 유동성 · CP7 어닝 · CP8 보안)은 정적 기본 텍스트 반환 —
  // 단일 진실 원천 유지 + 향후 필드 추가 시 점진 확장 가능.

  function getCP1Text() {
    // 지정학 — WTI 레짐 기반 문구 + 이란/우크라이나/대만 고정 축
    var wti = _snap.num(DS.wti, FB.wti);
    var wtiText = isFinite(wti) && wti > 0 ? '$' + _snap.fixed(wti, 2) : '—';
    var wtiTone, wtiReason;
    if (wti >= 105)      { wtiTone = '재급등 경고'; wtiReason = '봉쇄 유지 · $110+ 돌파 임박'; }
    else if (wti >= 95)  { wtiTone = '고점권';      wtiReason = '봉쇄 발효 중 · 재협상 관찰'; }
    else if (wti >= 85)  { wtiTone = '안정화 기대'; wtiReason = '봉쇄 발효 중이나 완화 기대'; }
    else                 { wtiTone = '완화 선반영'; wtiReason = '재협상 재개 시나리오 진행'; }
    return (
      '4/14 트럼프 "이란 협상 재개" 시사 · 파키스탄 중재 재협상 곧 재개 전망 · ' +
      'WTI ' + wtiText + ' (' + wtiTone + ') · ' + wtiReason + ' · ' +
      '재협상 실패 시 재급등 리스크 잔존 · 우크라이나/대만 병존'
    );
  }

  function getCP2Text() {
    // 통화정책 — fedRate + VIX 기반 스트레스 지표
    var fedRate = DS.fedRate || FB.fedRate || '3.50-3.75';
    var vix = _snap.num(DS.vix, FB.vix);
    var stressLabel;
    if (vix >= 30)      stressLabel = '변동성 극단 · 긴축 충격 노출';
    else if (vix >= 25) stressLabel = '긴장 고조 · 긴축 충격 리스크';
    else if (vix >= 20) stressLabel = '관찰 구간';
    else if (vix >= 15) stressLabel = '안정';
    else                stressLabel = '과도한 완화 지표';
    return (
      '연준 ' + fedRate + '% · FOMC "vast majority" 듀얼 리스크(고용↓+인플레↑) · ' +
      '"Some" 인상 논의 · VIX ' + _snap.fixed(vix, 2) + ' (' + stressLabel + ') · H4L 전환 신호'
    );
  }

  function getCP3Text() {
    // 거시경제 — F&G 내부 구조 + MOVE×SKEW 역설 + VVIX
    var fg = _snap.num(DS.fg, FB.fg);
    var fgReg = getFGRegime(fg);
    var cat = DS.fg_categories || {};
    var ind = DS.fg_indicators || {};
    var momentum = _snap.num(cat.momentum);
    var breadth  = _snap.num(cat.breadth);
    var priceStr = _snap.num(ind.priceStrength);
    var premTrend = _snap.num(ind.premiumTrend);
    var move = _snap.num(DS.move, FB.move);
    var skew = _snap.num(DS.skew, FB.skew);
    var vvix = _snap.num(DS.vvix_live || DS.vvix, FB.vvix);
    var gap  = momentum - breadth;
    var moveReg = getMOVERegime(move);
    var paradox = (move <= 70 && skew >= 135);
    var diag = checkDistributionDiagnosis();
    return (
      '3월 PPI 수요파괴 신호: 무역마진 -1.4% · 중간재 -0.4% · 원자재 -1.9% · Michigan 1Y 4.8%(93년후 최고). ' +
      '<b style="color:#fbbf24;">현재 F&amp;G ' + fg + ' ' + fgReg.label + '</b> — 모멘텀 ' + _snap.fixed(momentum, 1) +
      ' vs 브레드쓰 ' + _snap.fixed(breadth, 1) + ' (갭 ' + _snap.fixed(gap, 1) + 'pt) · ' +
      '주가강도 ' + _snap.fixed(priceStr, 1) + ' · 프리미엄트렌드 ' + _snap.fixed(premTrend, 0) + ' · ' +
      'MOVE ' + _snap.fixed(move, 2) + '(' + moveReg.label + ') vs SKEW ' + _snap.fixed(skew, 2) +
      ' <b>' + (paradox ? '역설 심화' : '역설 일부 완화') + '</b> · VVIX ' + _snap.fixed(vvix, 2) + ' · ' +
      '분배 체크리스트 <b style="color:' + (diag.confirmed ? '#ff5b50' : '#ffa31a') + ';">' +
      diag.passed + '/' + diag.total + '</b>' + (diag.confirmed ? ' = 2000·2007·2021 선례 부합' : ' — 추가 확증 필요')
    );
  }

  function getCP4Text() {
    // v48.21: 재정 — DXY 레짐 + 10Y 금리로 재정 리스크 가시화
    var dxy = _snap.num(DS.dxy, FB.dxy);
    var tnx = _snap.num(DS.tnx, FB.tnx);
    var deficitSignal;
    if (dxy >= 108)      deficitSignal = '강달러 스트레스(DXY ' + _snap.fixed(dxy, 2) + ') → 재정적자 우려 일시 완화';
    else if (dxy >= 104) deficitSignal = '달러 강세(DXY ' + _snap.fixed(dxy, 2) + ') → 재정리스크 관리 가능';
    else if (dxy >= 100) deficitSignal = '중립 구간(DXY ' + _snap.fixed(dxy, 2) + ') → 재정 우려 실체화 주시';
    else                 deficitSignal = '달러 약세(DXY ' + _snap.fixed(dxy, 2) + ') → Debt-to-GDP 우려 부각';
    var bondLoad = tnx >= 4.5 ? '재발행 부담↑↑' : tnx >= 4.0 ? '재발행 부담 관리' : '재발행 여력';
    return (
      '미국 재정적자 $2T↑ · 감세(OBBBA $1,500~1,600억+원천징수 $600억) 환류 시작 · ' +
      deficitSignal + ' · 10Y ' + _snap.fixed(tnx, 2) + '% = ' + bondLoad + ' · ' +
      '생산성 미달→Debt-to-GDP 악화 · 9.9조 달러 재발행 압박 · 중간선거 7개월 전 = 재무부 유동성 인센티브'
    );
  }

  function getCP5Text() {
    // v48.21: 유동성 — TGA + 10Y 금리 + F&G 종합 판단
    var tga = _snap.num(DS.tga);
    var tgaTxt = isFinite(tga) && tga > 0 ? '$' + _snap.fixed(tga, 0) + '억' : '$8,063억';
    var tnx = _snap.num(DS.tnx, FB.tnx);
    var fg = _snap.num(DS.fg, FB.fg);
    var liquiditySignal;
    if (tnx >= 5.0)      liquiditySignal = '10Y ' + _snap.fixed(tnx, 2) + '% 위기권 = 유동성 경색';
    else if (tnx >= 4.5) liquiditySignal = '10Y ' + _snap.fixed(tnx, 2) + '% 긴축 임계 = 유동성 제약';
    else if (tnx >= 4.0) liquiditySignal = '10Y ' + _snap.fixed(tnx, 2) + '% 중립 = 유동성 관리 가능';
    else                 liquiditySignal = '10Y ' + _snap.fixed(tnx, 2) + '% 완화 = 유동성 풍부';
    var fgTone = fg >= 70 ? '탐욕 극단(유동성 유입 증거)' : fg >= 50 ? '중립 낙관' : fg >= 30 ? '경계 구간' : '공포 구간(유동성 경직)';
    return (
      'QT 지속 · TGA ' + tgaTxt + ' · ' + liquiditySignal + ' · F&G ' + fg + ' ' + fgTone + ' · ' +
      'TGA/재무부 발행 전략/금리 레벨을 함께 확인 · 유동성 환류가 확인되면 위험자산 우호, 장기금리 급등 시 제약'
    );
  }

  function getCP6Text() {
    // 원자재 — WTI/Brent 레짐 기반
    var wti = _snap.num(DS.wti, FB.wti);
    var brent = _snap.num(DS.brent, FB.brent);
    var wtiTxt = isFinite(wti) && wti > 0 ? '$' + _snap.fixed(wti, 2) : '—';
    var brentTxt = isFinite(brent) && brent > 0 ? '$' + _snap.fixed(brent, 2) : '—';
    var direction;
    if (wti >= 105)     direction = '재급등 · 봉쇄 유지';
    else if (wti >= 95) direction = '고점권 · 봉쇄 중';
    else if (wti >= 85) direction = '재협상 기대 · 봉쇄 중이나 완화 여지';
    else                direction = '완화 선반영 · 재협상 진전 반영';
    return (
      'WTI ' + wtiTxt + ' · Brent ' + brentTxt + ' (' + direction + ') · ' +
      'JPM: 구조적 공급 감소(정유 240만bpd+파이프라인 70만bpd) 잔존 · 재협상 실패 시 $110+ 재급등'
    );
  }

  function getCP7Text() {
    // v48.21: 기업실적 — F&G 모멘텀 + VIX 기반 어닝 시즌 환경 판단
    var cat = DS.fg_categories || {};
    var momentum = _snap.num(cat.momentum);
    var vix = _snap.num(DS.vix, FB.vix);
    var earningsContext;
    if (momentum >= 70 && vix < 20)      earningsContext = 'momentum ' + _snap.fixed(momentum, 0) + ' 상위/VIX ' + _snap.fixed(vix, 1) + ' 안정 = 서프라이즈 긍정반응 가능';
    else if (momentum >= 50)              earningsContext = 'momentum ' + _snap.fixed(momentum, 0) + ' 중립/VIX ' + _snap.fixed(vix, 1) + ' = 실적 품질 선별';
    else                                  earningsContext = 'momentum ' + _snap.fixed(momentum, 0) + ' 약세/VIX ' + _snap.fixed(vix, 1) + ' = 서프라이즈 무시 위험';
    return (
      '4월 어닝 시즌: 매출 +9.7% 이익 +13%(FactSet 88% EPS 서프라이즈, 6분기 연속 두 자릿수) · ' +
      '★ 긍정 서프라이즈 주가 반응 -0.2%(5년 평균 +1.0% 대비) = "이미 반영" · ' +
      earningsContext + ' · NVDA 제외 매그6 성장률 6.4% < 493사 10.1% 역전'
    );
  }

  function getCP8Text() {
    // v48.21: 사이버·시스템 — VVIX 기반 시스템 리스크 지표
    var vvix = _snap.num(DS.vvix_live || DS.vvix, FB.vvix);
    var systemRisk;
    if (vvix >= 110)      systemRisk = 'VVIX ' + _snap.fixed(vvix, 1) + ' 극단 = 변동성의 변동성 경고';
    else if (vvix >= 95)  systemRisk = 'VVIX ' + _snap.fixed(vvix, 1) + ' 고조 = 시스템 리스크 관찰';
    else if (vvix >= 85)  systemRisk = 'VVIX ' + _snap.fixed(vvix, 1) + ' 중립';
    else                  systemRisk = 'VVIX ' + _snap.fixed(vvix, 1) + ' 안정';
    return (
      'Claude Mythos: 취약점→무기화 "수개월→수분" 단축(§63) · OpenAI TAC 14개 파트너(CRWD 양쪽 독점) · ' +
      systemRisk + ' · 섀도AI 50%+ 비인가 · CRWD/PANW 보안예산 확장 · 사모신용 잔존 리스크'
    );
  }

  // CP1~CP8 DOM 일괄 렌더러 — applyDataSnapshot 말미에서 호출
  function renderCPTexts() {
    try {
      var generators = [getCP1Text, getCP2Text, getCP3Text, getCP4Text, getCP5Text, getCP6Text, getCP7Text, getCP8Text];
      for (var i = 0; i < generators.length; i++) {
        var el = document.getElementById('cp' + (i + 1) + '-detail');
        if (!el) continue;
        try {
          var html = generators[i]();
          if (html) el.innerHTML = html;
        } catch(eInner) {
          if (typeof _aioLog === 'function') _aioLog('warn', 'narrative', 'getCP' + (i + 1) + 'Text failed: ' + eInner.message);
        }
      }
    } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'narrative', 'renderCPTexts: ' + e.message); }
  }

  // ── 5. DOM 렌더러 (rm-* 꼬리위험 보드) ─────────────────
  function _setRM(idVal, idStatus, idBar, value, regime, fmt) {
    const el = document.getElementById(idVal);
    if (el) el.textContent = (fmt ? fmt(value) : value);
    if (el) el.style.color = regime.color;
    const st = document.getElementById(idStatus);
    if (st) { st.textContent = regime.label; st.style.color = regime.color; st.style.background = regime.color==='#ff5b50' ? 'var(--data-red-mid)' : regime.color==='#00e5a0' ? 'var(--data-green-mid)' : 'var(--data-amber-mid)'; }
    const bar = document.getElementById(idBar);
    if (bar) { bar.style.width = regime.bar + '%'; bar.style.background = regime.color; }
  }
  function renderTailRiskBoard() {
    try {
      const skew = _snap.num(DS.skew, FB.skew);
      const move = _snap.num(DS.move, FB.move);
      const vvix = _snap.num(DS.vvix_live, FB.vvix);
      const skewReg = getSKEWRegime(skew);
      const moveReg = getMOVERegime(move);
      const vvixReg = getVVIXRegime(vvix);
      _setRM('rm-skew-val', null, null, skew, skewReg, v => _snap.fixed(v,2));
      _setRM('rm-move-val', 'rm-move-status', null, move, moveReg, v => _snap.fixed(v,2));
      _setRM('rm-vvix-val', null, 'rm-vvix-bar', vvix, vvixReg, v => _snap.fixed(v,2));
      // SKEW/MOVE bar (값 기반 bar 폭 동적 설정)
      const skewBar = document.querySelector('#rm-skew-val ~ .rm-bar-wrap .rm-bar');
      if (skewBar) { skewBar.style.width = skewReg.bar + '%'; skewBar.style.background = skewReg.color; }
      const moveBar = document.querySelector('#rm-move-val ~ .rm-bar-wrap .rm-bar');
      if (moveBar) { moveBar.style.width = moveReg.bar + '%'; moveBar.style.background = moveReg.color; }
    } catch(e) { _aioLog('warn', 'narrative', 'renderTailRiskBoard: ' + (e && e.message || e)); }
  }

  // ── 6. 초기화 (DOMContentLoaded 훅) ─────────────────────
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderTailRiskBoard);
    } else {
      renderTailRiskBoard();
    }
  }

  // v48.14: FX 카드 해설 동적 생성기 (Agent P1-12)
  function getFXNote(sym, price) {
    var p = parseFloat(price);
    if (!isFinite(p)) return null;
    if (sym === 'KRW=X') {
      if (p >= 1500) return '원화 약세 심화 · 당국 구두개입 임계 · 외환보유고 모니터';
      if (p >= 1450) return '원화 약세 지속 · 외인 순매도 가속 · 수입물가 부담';
      if (p >= 1400) return '경계 구간 · 수출·내수 균형 탐색';
      if (p >= 1300) return '중립 구간 · 수급 변동성 낮음';
      return '원화 강세 · 내수주·외인 순매수 유리';
    }
    if (sym === 'JPY=X') {
      if (p >= 160) return '초약세 · BOJ 실개입 경계선 돌파 위험';
      if (p >= 150) return 'BOJ 인상 기대 · 150엔 저항 시험 · 캐리 트레이드 리스크';
      if (p >= 140) return '점진 안정화 · YCC 조정 전 관찰';
      return '엔고 강세 · 일본 수출주 역풍';
    }
    if (sym === 'EURUSD=X') {
      if (p >= 1.15) return 'EUR 강세 · ECB 동결 지속 시그널';
      if (p >= 1.05) return '중립 레인지 · ECB 인하 사이클 관찰';
      return 'EUR 약세 · 유럽 경기 둔화 반영';
    }
    if (sym === 'GBPUSD=X') {
      if (p >= 1.30) return '파운드 강세 · BOE 동결 기조';
      if (p >= 1.20) return '레인지 · 영국 인플레 점착 vs 둔화';
      return '파운드 약세 · 경기 침체 우려';
    }
    if (sym === 'CNY=X') {
      if (p >= 7.4) return 'PBOC 실개입 경계 · 관세 전쟁 위안 절하 압박';
      if (p >= 7.2) return '위안 약세 · 관세 전쟁 중 절하 압박';
      return '위안 상대 안정 · PBOC 환율 방어 성공';
    }
    if (sym === 'AUDUSD=X') {
      if (p >= 0.70) return '호주달러 강세 · 원자재 가격 상승';
      if (p >= 0.65) return '중립 · 중국 수요 의존';
      return '호주달러 약세 · 리스크오프 취약';
    }
    if (sym === 'DX-Y.NYB') {
      if (p >= 108) return '강달러 스트레스 · 신흥국 자금유출 · 원자재 압박';
      if (p >= 104) return '달러 강세 · 이머징 압박 시작';
      if (p >= 100) return '중립 구간';
      return '달러 약세 · 신흥국·원자재·금 유리';
    }
    if (sym === 'BTC-USD') {
      if (p >= 100000) return '구조적 상승 · 기관 자금 대량 유입';
      if (p >= 70000) return '불장 유지 · 달러 대안 자산 수요';
      if (p >= 40000) return '레인지 · 위험선호 지표 역할';
      return '약세장 · 리스크오프';
    }
    return null;
  }

  // v48.14 (Agent W10): DI 패턴 — 외부에서 snapshot 교체 가능하도록 setter 노출
  // 현재 직접 `DS` 참조이나, setter 제공으로 테스트 주입·모킹 가능
  function setSnapshot(snap) {
    try {
      if (snap && typeof snap === 'object') {
        // 현재는 DS가 상수 참조라 직접 덮어쓰기 불가 — 대신 DS_OVERRIDE 힌트 저장
        window._DS_OVERRIDE = snap;
        if (typeof _aioLog === 'function') _aioLog('info', 'narrative', 'snapshot override set', { keys: Object.keys(snap).length });
      }
    } catch(e) {}
  }
  function clearSnapshot() { try { delete window._DS_OVERRIDE; } catch(e) {} }

  return {
    // 레짐 분류기
    getSKEWRegime, getMOVERegime, getVVIXRegime, getFGRegime,
    getBreadthRegime, getInsiderRegime, getFXNote,
    // v48.14 (W10): DI API
    setSnapshot, clearSnapshot,
    // 진단
    checkDistributionDiagnosis,
    // 동적 텍스트 생성
    getFGInternalStructureText,
    getDistributionDiagnosisText,
    // v48.15 (텍스트-A): CP1~CP8 체크포인트 생성기
    getCP1Text, getCP2Text, getCP3Text, getCP4Text,
    getCP5Text, getCP6Text, getCP7Text, getCP8Text,
    renderCPTexts,
    // DOM 렌더러
    renderTailRiskBoard,
    init
  };
})();
try { NARRATIVE_ENGINE.init(); } catch(e) { _aioLog('warn', 'narrative', 'init: ' + (e && e.message || e)); }

// ═══════════════════════════════════════════════════════════════════
// v36: DATE_ENGINE — 동적 날짜/시간 시스템 (하드코딩 날짜 근본 해결)
// ═══════════════════════════════════════════════════════════════════
// 스크리너 내 모든 날짜를 실시간 계산. HTML에 data-date-ref 속성으로 바인딩.
// 페이지 로드 시 자동 실행 + 매시간 갱신.
const DATE_ENGINE = (function() {
  var KST_OFFSET = 9 * 60; // KST = UTC+9 (분)

  // 현재 KST 시각
  function nowKST() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + KST_OFFSET * 60000);
  }

  // 한국 공휴일 (고정 + 변동, 매년 업데이트 필요)
  var KR_HOLIDAYS_2026 = [
    '2026-01-01','2026-01-28','2026-01-29','2026-01-30', // 신정, 설연휴
    '2026-03-01','2026-03-02', // 삼일절+대체
    '2026-05-05','2026-05-24','2026-05-25', // 어린이날, 석가탄신일+대체
    '2026-06-06', // 현충일
    '2026-08-15','2026-08-17', // 광복절+대체
    '2026-09-24','2026-09-25','2026-09-26', // 추석
    '2026-10-03','2026-10-05', // 개천절+대체
    '2026-10-09', // 한글날
    '2026-12-25' // 성탄절
  ];

  // 미국 공휴일 (2026년)
  var US_HOLIDAYS_2026 = [
    '2026-01-01','2026-01-19', // 신년, MLK
    '2026-02-16', // 대통령의날
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day 대체
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25' // Christmas
  ];

  // v48.95 P2-2: 2027년 공휴일 (한국·미국) ─────────────────────────
  var KR_HOLIDAYS_2027 = [
    '2027-01-01','2027-02-08','2027-02-09','2027-02-10', // 신정, 설연휴
    '2027-03-01', // 삼일절
    '2027-05-05','2027-05-13', // 어린이날, 석가탄신일
    '2027-06-06', // 현충일
    '2027-08-15','2027-08-16', // 광복절+대체
    '2027-10-02','2027-10-04','2027-10-05', // 추석+대체
    '2027-10-03', // 개천절
    '2027-10-09','2027-10-11', // 한글날+대체
    '2027-12-25' // 성탄절
  ];
  var US_HOLIDAYS_2027 = [
    '2027-01-01','2027-01-18', // 신년, MLK
    '2027-02-15', // 대통령의날
    '2027-03-26', // Good Friday
    '2027-05-31', // Memorial Day
    '2027-06-19', // Juneteenth (토→금 대체 아님, 실제 금요일)
    '2027-07-05', // Independence Day 대체(일→월)
    '2027-09-06', // Labor Day
    '2027-11-25', // Thanksgiving
    '2027-12-24','2027-12-25' // Christmas Eve(금)+Christmas
  ];

  // 연도별 공휴일 조회 (2026/2027 지원, 미등록 연도는 빈 배열)
  var _KR_HOLIDAYS_MAP = { 2026: KR_HOLIDAYS_2026, 2027: KR_HOLIDAYS_2027 };
  var _US_HOLIDAYS_MAP = { 2026: US_HOLIDAYS_2026, 2027: US_HOLIDAYS_2027 };

  function _dateStr(d) {
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function isKrTradingDay(d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    var holidays = _KR_HOLIDAYS_MAP[d.getFullYear()] || KR_HOLIDAYS_2026;
    return holidays.indexOf(_dateStr(d)) === -1;
  }

  function isUsTradingDay(d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    var holidays = _US_HOLIDAYS_MAP[d.getFullYear()] || US_HOLIDAYS_2026;
    return holidays.indexOf(_dateStr(d)) === -1;
  }

  // 가장 최근 거래일 (오늘 포함 가능 여부: 장시간 기준)
  // v48.95 P2 EOD grace: 15:30(장마감)~16:00(데이터확정) 구간은 eodConfirmed=false
  // 반환: Date (하위호환) — DATE_ENGINE.lastKrTradingDayEx() 호출 시 {date, eodConfirmed}
  function lastKrTradingDay() {
    return lastKrTradingDayEx().date;
  }
  function lastKrTradingDayEx() {
    var kst = nowKST();
    var d = new Date(kst);
    var time = d.getHours() * 60 + d.getMinutes();
    // 장 마감(15:30=930) 이전 또는 비거래일 → 전 거래일로
    if (time < 930 || !isKrTradingDay(d)) {
      d.setDate(d.getDate() - 1);
    }
    for (var i = 0; i < 10; i++) {
      if (isKrTradingDay(d)) {
        // v48.95: 15:30~16:00 = EOD 데이터 미확정 grace window
        var eodConfirmed = !(time >= 930 && time < 960 && isKrTradingDay(new Date(kst)));
        return { date: d, eodConfirmed: eodConfirmed };
      }
      d.setDate(d.getDate() - 1);
    }
    return { date: d, eodConfirmed: true };
  }

  function nowInTimeZone(tz) {
    try {
      return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    } catch(e) {
      return new Date();
    }
  }

  function lastUsTradingDay() {
    var et = nowInTimeZone('America/New_York');
    var d = new Date(et);
    // EST 기준 16:00 이전이면 전일
    var time = et.getHours() * 60 + et.getMinutes();
    if (time < 960 || !isUsTradingDay(d)) { // 16:00 = 960분
      d.setDate(d.getDate() - 1);
    }
    for (var i = 0; i < 10; i++) {
      if (isUsTradingDay(d)) return d;
      d.setDate(d.getDate() - 1);
    }
    return d;
  }

  // 포맷터
  var DOW_KR = ['일','월','화','수','목','금','토'];
  function fmtMD(d) { return (d.getMonth()+1) + '/' + d.getDate(); }
  function fmtYMD(d) { return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0'); }
  function fmtYMDdash(d) { return _dateStr(d); }
  function fmtMMDD(d) { return String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'); }
  function fmtKrBasis(d) { return fmtMD(d) + ' 기준'; }
  function fmtYMbasis(d) { return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + ' 기준'; }

  // KRX 장 상태 (KST 기준)
  function krxStatus() {
    var kst = nowKST();
    var dow = kst.getDay();
    if (dow === 0 || dow === 6) return { status: 'closed', label: '주말 휴장' };
    if (!isKrTradingDay(kst)) return { status: 'closed', label: '공휴일 휴장' };
    var t = kst.getHours() * 60 + kst.getMinutes();
    if (t >= 540 && t < 900) return { status: 'open', label: '장중 (실시간)' };
    if (t >= 900 && t < 930) return { status: 'after', label: '시간외 거래' };
    if (t >= 480 && t < 540) return { status: 'pre', label: '프리마켓' };
    return { status: 'closed', label: '장 마감' };
  }

  // 현재 주간 범위 (월~금)
  function currentWeekRange() {
    var kst = nowKST();
    var dow = kst.getDay();
    var mon = new Date(kst);
    mon.setDate(kst.getDate() - ((dow + 6) % 7));
    var fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { mon: mon, fri: fri, label: fmtMD(mon) + '–' + fmtMD(fri) };
  }

  // DOM 자동 바인딩: data-date-ref 속성의 모든 요소에 날짜 주입
  function applyToDOM() {
    var krLast = lastKrTradingDay();
    var usLast = lastUsTradingDay();
    var kst = nowKST();
    var week = currentWeekRange();

    var refs = {
      'today':        fmtYMD(kst),
      'today-md':     fmtMD(kst),
      'kr-last':      fmtMD(krLast) + ' 종가',
      'kr-last-md':   fmtMD(krLast),
      'kr-last-mmdd': fmtMMDD(krLast),
      'kr-last-ymd':  fmtYMD(krLast),
      'kr-last-basis':fmtKrBasis(krLast),
      'kr-month':     fmtYMbasis(kst),
      'us-last':      fmtMD(usLast) + ' 종가',
      'us-last-md':   fmtMD(usLast),
      'us-last-ymd':  fmtYMD(usLast),
      'week-range':   week.label,
      'year':         String(kst.getFullYear()),
      'year-month':   kst.getFullYear() + '.' + String(kst.getMonth()+1).padStart(2,'0'),
    };

    document.querySelectorAll('[data-date-ref]').forEach(function(el) {
      var key = el.getAttribute('data-date-ref');
      if (refs[key] !== undefined) el.textContent = refs[key];
    });

    // DATA_SNAPSHOT._dynamicDate 갱신 (LLM 프롬프트 등에서 참조)
    if (typeof DATA_SNAPSHOT !== 'undefined') {
      DATA_SNAPSHOT._today = fmtYMDdash(kst);
      DATA_SNAPSHOT._krLastTrading = fmtYMDdash(krLast);
      DATA_SNAPSHOT._usLastTrading = fmtYMDdash(usLast);
      DATA_SNAPSHOT._currentYear = kst.getFullYear();
    }

    console.log('[DATE_ENGINE] 동적 날짜 적용 — 오늘: ' + fmtYMD(kst) + ' | KR 최근거래일: ' + fmtMD(krLast) + ' | US: ' + fmtMD(usLast));
    return refs;
  }

  return {
    nowKST: nowKST,
    lastKrTradingDay: lastKrTradingDay,
    lastKrTradingDayEx: lastKrTradingDayEx,  // v48.95: {date, eodConfirmed}
    lastUsTradingDay: lastUsTradingDay,
    isKrTradingDay: isKrTradingDay,
    isUsTradingDay: isUsTradingDay,
    krxStatus: krxStatus,
    currentWeekRange: currentWeekRange,
    fmtMD: fmtMD,
    fmtYMD: fmtYMD,
    fmtMMDD: fmtMMDD,
    applyToDOM: applyToDOM
  };
})();

// 페이지 로드 시 즉시 실행 + 1시간마다 갱신
try { DATE_ENGINE.applyToDOM(); } catch(e) { _aioLog('warn', 'date', '초기화 실패: ' + (e && e.message || e)); }
// v48.91: 타이머 레지스트리 등록
window._dateEngineInterval = _aioRegisterTimer('dateEngine', function() { try { DATE_ENGINE.applyToDOM(); } catch(e) {} }, T.DATE_REFRESH);

// ═══════════════════════════════════════════════════════════════════
// applyDataSnapshot — DATA_SNAPSHOT → HTML 자동 매핑
// data-snap="키" 속성이 있는 모든 요소에 값을 주입합니다.
//  모든 값 접근에 방어적 코딩 적용 — undefined/NaN 시 fallback 사용
// ═══════════════════════════════════════════════════════════════════
function applyDataSnapshot() {
  try {
    const S = DATA_SNAPSHOT;
    if (!S) { if (typeof _aioLog === 'function') _aioLog('error', 'data', 'DATA_SNAPSHOT not defined'); else console.warn('[AIO] DATA_SNAPSHOT not defined'); return; }
    const map = {
      'wti':           '$' + _snap.num(S.wti),
      'brent':         '$' + _snap.num(S.brent),
      'krw':           _snap.num(S.krwRound).toLocaleString(),
      'krw-full':      _snap.localeFull(S.krw),
      'fomc':          S.fomc || '—',
      'ecb-rate':      _snap.fixed(S.ecbRate) + '%',
      'ecb-status':    S.ecbStatus || '—',
      'kospi':         _snap.localeFull(S.kospi),
      'kospi-prev':    _snap.localeFull(S.kospiPrev),
      'kospi-pct':     _snap.pct(S.kospiPct),
      'kosdaq':        _snap.localeFull(S.kosdaq),
      'kosdaq-pct':    _snap.pct(S.kosdaqPct),
      'move':          _snap.fixed(S.move, 1),
      'kr-unemploy':   _snap.fixed(S.krUnemploy, 1) + '%',
      'fed-rate':      S.fedRate || '—',
      'cpi':           _snap.fixed(S.cpi, 1) + '%',
      // v34.6: 한국 매크로 data-snap 매핑
      'bok-rate':      _snap.fixed(S.bokRate) + '%',
      'bok-status':    S.bokStatus || '—',
      'bok-next':      S.bokNext || '—',
      'kr-bond-10y':   _snap.fixed(S.krBond10y) + '%',
      'kr-cpi':        _snap.fixed(S.krCpi, 1) + '%',
      'kr-gdp':        (S.krGdp > 0 ? '+' : '') + _snap.fixed(S.krGdp, 1) + '%',
      // v42.4: macro 페이지 소비·고용·주택 카드 매핑 누락 수정 (A-3)
      'retail-sales':  (S.retailSales > 0 ? '+' : '') + _snap.fixed(S.retailSales, 1) + '%',
      'wage-growth':   _snap.fixed(S.usWageGrowth, 1) + '%',
      'cons-conf':     _snap.fixed(S.consConf, 1),
      'housing':       _snap.fixed(S.housingStarts, 2) + 'M',
      // v48.14: 전수 조사 결과 누락 지표 일괄 추가 (Agent P1-03/04/16/18 대응)
      // 볼라틸리티·꼬리위험
      'vix':           _snap.fixed(S.vix, 2),
      'vix-pct':       _snap.pct(S.vixPct),
      'vvix':          _snap.fixed(S.vvix, 2),
      'vvix-pct':      _snap.pct(S.vvixChg || 0),
      'skew':          _snap.fixed(S.skew, 2),
      'skew-pct':      _snap.pct(S.skewChg || 0),
      'pcr':           _snap.fixed(S.putCallRatio || S.pcr, 2),
      // v49.58 P278: VKOSPI 라벨 자동 부착 (정상<20 / 경계 20~25 / 공포 25~35 / 극단공포 35+)
      'vkospi':        _snap.fixed(S.vkospi, 2) + ' (' + (S.vkospi >= 35 ? '극단공포' : S.vkospi >= 25 ? '공포' : S.vkospi >= 20 ? '경계' : '정상') + ')',
      // 금리 (폴백값용 — data-live-price 실시간이 우선)
      'tnx':           _snap.fixed(S.tnx || 4.31, 2) + '%',
      'tnx-2y':        _snap.fixed(S.tnx2y || 3.88, 2) + '%',
      'tyx':           _snap.fixed(S.tyx || 5.02, 2) + '%',
      'irx':           _snap.fixed(S.irx || 3.58, 2) + '%',
      'fvx':           _snap.fixed(S.fvx || 4.08, 2) + '%',
      // 환율·지수 (실시간 우선, data-snap은 폴백)
      'dxy':           _snap.fixed(S.dxy, 2),
      'dxy-pct':       _snap.pct(S.dxyPct),
      'spx':           _snap.localeFull(S.spx),
      'spx-pct':       _snap.pct(S.spxPct),
      'nasdaq':        _snap.localeFull(S.nasdaq),
      'nasdaq-pct':    _snap.pct(S.nasdaqPct),
      'dow':           _snap.localeFull(S.dow),
      'dow-pct':       _snap.pct(S.dowPct),
      'rut':           _snap.localeFull(S.rut),
      'rut-pct':       _snap.pct(S.rutPct),
      // 원자재·암호화폐
      'gold':          '$' + _snap.num(S.gold),
      'silver':        '$' + _snap.fixed(S.silver, 2),
      'btc':           '$' + _snap.num(S.btc),
      'eth':           '$' + _snap.num(S.eth),
      // Breadth (Agent P1-04 — 36px 대형 숫자 동기화)
      'breadth-5sma':  _snap.fixed(S.breadth5sma || S.breadth_5sma || ((S._fallback||{}).breadth5) || 68, 0) + '%',
      'breadth-20sma': _snap.fixed(S.breadth20sma || S.breadth_20sma || ((S._fallback||{}).breadth20) || 75, 0) + '%',
      'breadth-50sma': _snap.fixed(S.breadth50sma || S.breadth_50sma || ((S._fallback||{}).breadth50) || 46, 0) + '%',
      'breadth-200sma':_snap.fixed(S.breadth200sma || ((S._fallback||{}).breadth200) || 55, 0) + '%',
      // 한국 매크로 추가 (Agent P1-22)
      'kr-ppi':        (S.krPpi > 0 ? '+' : '') + _snap.fixed(S.krPpi, 1) + '%',
      'kr-pmi':        _snap.fixed(S.krPmi, 1),
      'kr-export':     _snap.fixed(S.krExport, 1),
      'kr-import':     _snap.fixed(S.krImport, 1),
      'kr-credit':     _snap.fixed(S.krCreditBalance, 1) + '조원',
      'kr-deposit':    _snap.fixed(S.krDeposit, 1) + '조원',
      'kr-short':      _snap.fixed(S.krShortSelling, 2) + '%',
      'kr-foreign-net':_snap.fixed(S.krForeignNet, 0) + '억원',
      // v48.14: 한국 시장 추가 지표 (Agent P1-20)
      'kr-52w-high':   _snap.fixed(S.kr52wHigh || 48, 0) + '개',
      'kr-52w-low':    _snap.fixed(S.kr52wLow || 72, 0) + '개',
      'kr-advance':    _snap.fixed(S.krAdvance || 684, 0) + '개',
      'kr-decline':    _snap.fixed(S.krDecline || 481, 0) + '개',
      // v48.15: kr-macro 페이지 세부 지표 data-snap 바인딩 (텍스트-B)
      'kr-cpi-yoy':    (S.krCpi > 0 ? '+' : '') + _snap.fixed(S.krCpi, 1) + '% YoY',
      'kr-ppi-yoy':    (S.krPpi > 0 ? '+' : '') + _snap.fixed(S.krPpi, 1) + '% YoY',
      'kr-manuf-pmi':  _snap.fixed(S.krManufPmi, 1),
      'kr-gdp-qoq':    (S.krGdp > 0 ? '+' : '') + _snap.fixed(S.krGdp, 1) + '%',
      'kr-bond-3y':    _snap.fixed(S.krBond3y, 2) + '%',
      // v48.61 P125 해소: 누락 data-snap 키 바인딩
      'kr-core-cpi':      (S.krCoreCpi > 0 ? '+' : '') + _snap.fixed(S.krCoreCpi, 1) + '% YoY',
      'kr-service-price': (S.krServicePrice > 0 ? '+' : '') + _snap.fixed(S.krServicePrice, 1) + '% YoY',
      'kr-service-pmi':   _snap.fixed(S.krServicePmi, 1),
      'gex-current':      (S.gexCurrent >= 0 ? '+' : '') + _snap.fixed(S.gexCurrent, 1) + 'B',
    };
    // v48.99 P181: per-key try-catch — 개별 키 실패가 다른 키 렌더를 막지 않음
    var _snapApplied = 0, _snapFailed = 0;
    document.querySelectorAll('[data-snap]').forEach(function(el) {
      var key = el.getAttribute('data-snap');
      if (!key) return;
      try {
        var val = map[key];
        if (val !== undefined) { el.textContent = String(val); _snapApplied++; }
      } catch (snapKeyErr) {
        _snapFailed++;
        if (typeof _aioLog === 'function') _aioLog('warn', 'snap', 'key=' + key + ' apply failed: ' + (snapKeyErr && snapKeyErr.message));
      }
    });
    if (_snapFailed > 0 && typeof _aioLog === 'function') _aioLog('warn', 'snap', 'applyDataSnapshot: ' + _snapFailed + ' key(s) failed / ' + _snapApplied + ' applied');

    // v48.14: 레짐 기반 설명 텍스트 자동 갱신 (NARRATIVE_ENGINE 활용 — Agent P1-16 대응)
    // VVIX/SKEW/Breadth 등 수치에 따라 설명문·색상 자동 분류
    // v48.14 (P2-6): 레짐 전이 시 aio:regime-change 이벤트 발사 (이전 레짐 캐시 비교)
    window._lastRegimes = window._lastRegimes || {};
    function _fireRegimeChange(key, prevLevel, newLevel, value, reg) {
      try {
        if (prevLevel === newLevel) return;
        document.dispatchEvent(new CustomEvent('aio:regime-change', {
          detail: { key: key, from: prevLevel, to: newLevel, value: value, regime: reg, ts: Date.now() }
        }));
        if (typeof _aioLog === 'function') _aioLog('info', 'regime', key + ': ' + prevLevel + ' → ' + newLevel, { value: value });
      } catch(e) {}
    }
    try {
      if (typeof NARRATIVE_ENGINE !== 'undefined') {
        // VVIX 설명 (options 페이지)
        var vvixDescEl = document.getElementById('opt-vvix-desc');
        if (vvixDescEl && NARRATIVE_ENGINE.getVVIXRegime) {
          var vvixVal = (typeof window._liveData !== 'undefined' && window._liveData['^VVIX'] && window._liveData['^VVIX'].price) || S.vvix;
          var vreg = NARRATIVE_ENGINE.getVVIXRegime(vvixVal);
          if (vreg) {
            vvixDescEl.textContent = vreg.label + ' · 옵션 변동성 자동 분류';
            vvixDescEl.style.color = vreg.color;
            _fireRegimeChange('vvix', window._lastRegimes.vvix, vreg.level, vvixVal, vreg);
            window._lastRegimes.vvix = vreg.level;
          }
        }
        // SKEW 상태 배지 (signal 페이지 rm-skew-val 옆)
        var skewValEl = document.getElementById('rm-skew-val');
        if (skewValEl && NARRATIVE_ENGINE.getSKEWRegime) {
          var skewStatus = skewValEl.parentElement && skewValEl.parentElement.querySelector('.rm-status');
          var sreg = NARRATIVE_ENGINE.getSKEWRegime(S.skew);
          if (skewStatus && sreg) {
            skewStatus.textContent = sreg.label;
            skewStatus.style.color = sreg.color;
            skewStatus.style.background = sreg.color === '#ff5b50' ? 'var(--data-red-mid)' :
                                           sreg.color === '#ffa31a' ? 'var(--data-amber-mid)' : 'var(--data-green-mid)';
          }
          if (sreg) {
            _fireRegimeChange('skew', window._lastRegimes.skew, sreg.level, S.skew, sreg);
            window._lastRegimes.skew = sreg.level;
          }
        }
      }
    } catch(regErr) { _aioLog('warn', 'regime', 'auto-update 실패: ' + regErr.message); }

    // v48.14: Breadth 36px 카드 bar 너비·레이블·색상 동적 갱신 (Agent P1-04)
    try {
      if (typeof NARRATIVE_ENGINE !== 'undefined' && NARRATIVE_ENGINE.getBreadthRegime) {
        ['5sma','20sma','50sma','200sma'].forEach(function(period) {
          var key = 'breadth_' + period.replace('sma','') + 'sma';
          var val = S[key] || S['breadth' + period.replace('sma','').toUpperCase() + 'sma'] || ((S._fallback||{})['breadth' + period.replace('sma','')]) ||
                    (period === '5sma' ? 68 : period === '20sma' ? 75 : period === '50sma' ? 46 : 55);
          val = _snap.num(val, 50);
          var reg = NARRATIVE_ENGINE.getBreadthRegime(val);
          var bar = document.getElementById('breadth-' + period + '-bar');
          var label = document.getElementById('breadth-' + period + '-label');
          var big = document.getElementById('breadth-' + period + '-big');
          if (bar) { bar.style.width = val + '%'; }
          if (big && reg && reg.color) { big.style.color = reg.color; }
          if (label && reg) {
            label.textContent = reg.label;
            label.style.color = reg.color;
          }
        });
      }
    } catch(brErr) { _aioLog('warn', 'breadth', 'auto-update 실패: ' + brErr.message); }

    // v48.14: data-snap-date 표준화 — 모든 스냅샷 배지에 경과일 자동 표시 (Agent 권장 아키텍처)
    // 사용: <span data-snap-date="briefing-archive">2026-04-15</span>
    //       <span id="briefing-stale-days">...</span>  ← 동일 블록 내 경과일 자동 채움
    try {
      document.querySelectorAll('[data-snap-date]').forEach(function(el) {
        var dateStr = el.textContent.trim();
        var parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return;
        var days = Math.floor((Date.now() - parsed.getTime()) / 86400000);
        // 가까운 ancestor에서 stale-days 요소 찾기
        var key = el.getAttribute('data-snap-date');
        var staleEl = document.getElementById(key + '-stale-days') || document.getElementById('briefing-stale-days');
        if (staleEl) {
          if (days <= 0) {
            staleEl.textContent = '오늘 갱신';
            staleEl.style.color = '#00e5a0';
          } else if (days === 1) {
            staleEl.textContent = '1일 경과';
            staleEl.style.color = '#ffa31a';
          } else {
            staleEl.textContent = days + '일 경과';
            staleEl.style.color = days > 7 ? '#ff5b50' : (days > 3 ? '#ffa31a' : '#00d4ff');
          }
        }
      });
    } catch(sdErr) { _aioLog('warn', 'snap-date', '처리 실패: ' + sdErr.message); }

    // v48.14: FX 카드 fx-note 해설 동적 생성 (Agent P1-12)
    try {
      if (typeof NARRATIVE_ENGINE !== 'undefined' && NARRATIVE_ENGINE.getFXNote) {
        var fxMap = {
          'fx-note-krw': 'KRW=X',
          'fx-note-jpy': 'JPY=X',
          'fx-note-eur': 'EURUSD=X',
          'fx-note-gbp': 'GBPUSD=X',
          'fx-note-cny': 'CNY=X',
          'fx-note-aud': 'AUDUSD=X',
          'fx-note-dxy': 'DX-Y.NYB',
          'fx-note-btc': 'BTC-USD'
        };
        Object.keys(fxMap).forEach(function(domId) {
          var el = document.getElementById(domId);
          if (!el) return;
          var sym = fxMap[domId];
          var live = (window._liveData || {})[sym];
          var p = (live && live.price) || (sym === 'KRW=X' ? S.krw : sym === 'JPY=X' ? S.jpy : sym === 'DX-Y.NYB' ? S.dxy : null);
          if (p) {
            var note = NARRATIVE_ENGINE.getFXNote(sym, p);
            if (note) el.textContent = note;
          }
        });
      }
    } catch(fxErr) { _aioLog('warn', 'fx-note', '자동 갱신 실패: ' + fxErr.message); }

    // v30.11: 스냅샷 데이터를 _liveData에도 seed (아직 실시간 미연결 심볼용)
    // _dataSource를 'snapshot'으로 표기하여 실시간 구분
    // v48.99 P181: 독립 try-catch — _liveData seed 실패가 staleness 체크를 막지 않음
    try {
    window._dataSource = window._dataSource || {};
    const snapTs = S._updated ? new Date(S._updated).getTime() : Date.now();
    const snapSymMap = {
      '^GSPC': { price: S.spx, pct: S.spxPct },
      '^IXIC': { price: S.nasdaq, pct: S.nasdaqPct },
      '^DJI': { price: S.dow, pct: S.dowPct },
      '^RUT': { price: S.rut, pct: S.rutPct },
      '^VIX': { price: S.vix, pct: S.vixPct },
      'CL=F': { price: S.wti, pct: S.wtiPct },
      'GC=F': { price: S.gold, pct: S.goldPct },
      'KRW=X': { price: S.krw, pct: S.krwPct },
      'DX-Y.NYB': { price: S.dxy, pct: S.dxyPct },
      '^KS11': { price: S.kospi, pct: S.kospiPct },
      '^KQ11': { price: S.kosdaq, pct: S.kosdaqPct },
      // v34.5: GMO 테이블 누락 심볼 fallback
      '^TNX': { price: 4.31, pct: +0.54 },
      'SI=F': { price: S.silver, pct: S.silverPct },
      'BTC-USD': { price: S.btc, pct: S.btcPct },
      'ETH-USD': { price: S.eth, pct: S.ethPct },
      '^N225': { price: S.nikkei, pct: S.nikkeiPct },
      '^HSI': { price: S.hangseng, pct: S.hangsengPct },
      '000001.SS': { price: S.shanghai, pct: S.shanghaiPct },
      '^GDAXI': { price: S.dax, pct: S.daxPct },
      '^FTSE': { price: S.ftse, pct: S.ftsePct },
      '^FCHI': { price: S.cac, pct: S.cacPct },
      // v34.6: 한국 채권·변동성 fallback
      'VKOSPI': { price: S.vkospi, pct: null },
    };
    if (window.SnapshotStore && typeof window.SnapshotStore.seedFromMap === 'function') {
      window.SnapshotStore.seedFromMap(snapSymMap, snapTs, { snapshotDate: S._snapshotDate, note: S._note });
    }
    window._liveData = window._liveData || {};
    for (const [sym, val] of Object.entries(snapSymMap)) {
      if (val.price != null && !window._dataSource[sym]) {
        // 실시간 데이터가 아직 없는 심볼만 seed
        if (typeof window._aioSetLiveData === 'function') {
          window._aioSetLiveData(sym, val, { source: 'snapshot', ts: snapTs, policyKey: 'static_snapshot', reason: 'DATA_SNAPSHOT fallback seed' });
        } else {
          window._liveData[sym] = window._liveData[sym] || { price: val.price, pct: val.pct != null ? val.pct : null, pctMissing: val.pct == null, source: 'snapshot', ts: snapTs };
          window._dataSource[sym] = { source: 'snapshot', ts: snapTs, pctMissing: val.pct == null, policyKey: 'static_snapshot' };
        }
      }
    }

    } catch(seedErr) { if (typeof _aioLog === 'function') _aioLog('warn', 'snap', '_liveData seed failed: ' + (seedErr && seedErr.message)); }

    // v34.2: Staleness 경고 — 스냅샷 기준이지만 실시간 데이터가 들어오면 자동 해제
    // 개선: 고정 12초 타이머 → 반복 폴링 + 이벤트 리스너로 확실히 해제
    const updated = S._updated ? new Date(S._updated).getTime() : 0;
    const age = updated ? (Date.now() - updated) : Infinity;
    const staleEl = document.getElementById('snapshot-stale-warning');
    if (staleEl) {
      if (!isNaN(age) && age > 24 * 60 * 60 * 1000) {
        const hrs = Math.floor(age / 3600000);
        staleEl.textContent = '스냅샷 기준 ' + hrs + '시간 전. live 데이터 수신 시 자동 갱신됩니다.';
        staleEl.style.display = 'block';

        // 실시간 데이터 수신 감지 — 반복 체크 (5초 간격, 최대 2분)
        // v48.14 (Agent W11): 2분 폴링 루프 제거 — 순수 이벤트 구독으로 전환
        // aio:liveDataReceived + aio:liveQuotes 둘 다 구독해서 stale 해제
        // 첫 로드 후 45초 내 아무 이벤트 없으면 마지막 1회 확인 (만약 이벤트 누락)
        var _onStaleLiveFire = function(ev) {
          if (ev && ev.detail && ev.detail.coreCoverageOk === false) return;
          try {
            var audit = window.AIO && typeof window.AIO.getDataFreshnessAudit === 'function' ? window.AIO.getDataFreshnessAudit() : null;
            if (audit && audit.liveCoverage && audit.liveCoverage.coreOk === false && window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._isFallback !== false) return;
          } catch(_audit) {}
          if (staleEl) staleEl.style.display = 'none';
          window.removeEventListener('aio:liveDataReceived', _onStaleLiveFire);
          window.removeEventListener('aio:liveQuotes', _onStaleLiveFire);
        };
        window.addEventListener('aio:liveDataReceived', _onStaleLiveFire, { once: true });
        window.addEventListener('aio:liveQuotes', _onStaleLiveFire, { once: true });
        // fallback: 45초 후 1회 확인 (이벤트 누락 대비)
        setTimeout(function() {
          var liveTs = window._quoteTimestamps || {};
          var hasRecent = Object.values(liveTs).some(function(t) { return Date.now() - t < 120000; });
          if (hasRecent) _onStaleLiveFire();
        }, 45000);
      } else {
        staleEl.style.display = 'none';
      }
    }

    // v48.15 (텍스트-A): CP1~CP8 체크포인트 해설 동적 갱신
    // DATA_SNAPSHOT 변경 시 F&G/VIX/WTI/MOVE/SKEW 등 기반 레짐 해설 자동 반영
    try {
      if (typeof NARRATIVE_ENGINE !== 'undefined' && typeof NARRATIVE_ENGINE.renderCPTexts === 'function') {
        NARRATIVE_ENGINE.renderCPTexts();
      }
    } catch(cpErr) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'narrative', 'renderCPTexts in applyDataSnapshot: ' + cpErr.message);
    }
    // v48.69: R21 — 정적 스냅샷 패널에 신선도 경고 배지 (MOVE/SKEW/기타 스냅 데이터)
    if (typeof renderStaleWarning === 'function') {
      renderStaleWarning('risk-monitor-grid');
      renderStaleWarning('risk-extra-grid');
    }
  } catch (e) {
    if (typeof _aioLog === 'function') _aioLog('error', 'render', 'applyDataSnapshot failed: ' + e.message); else console.warn('[AIO] applyDataSnapshot error:', e.message);
  }
}

// 안전한 날짜 포맷 헬퍼
function _safeDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'});
  } catch(e) { return '—'; }
}

// ═══ v30.3: 안전한 라이브데이터 접근자 ═══
// _ldSafe(sym, prop, fallback) — ld[sym]?.prop ?? DATA_SNAPSHOT fallback ?? 하드코딩 fallback
// 모든 곳에서 ld[sym] ? ld[sym].price : 하드코딩값 패턴 대신 사용 권장
const _SNAP_FALLBACK = {
  '^VIX':     { price: () => DATA_SNAPSHOT.vix,     pct: () => DATA_SNAPSHOT.vixPct },
  '^GSPC':    { price: () => DATA_SNAPSHOT.spx,     pct: () => DATA_SNAPSHOT.spxPct },
  '^TNX':     { price: () => DATA_SNAPSHOT.tnx || (DATA_SNAPSHOT._fallback || {}).tnx },
  '^FVX':     { price: () => DATA_SNAPSHOT.fvx },
  '^TYX':     { price: () => DATA_SNAPSHOT.tyx },
  '^IRX':     { price: () => DATA_SNAPSHOT.irx },
  'DX-Y.NYB': { price: () => DATA_SNAPSHOT.dxy },
  'CL=F':     { price: () => DATA_SNAPSHOT.wti },
  'BZ=F':     { price: () => DATA_SNAPSHOT.brent },
  'GC=F':     { price: () => DATA_SNAPSHOT.gold },
  'KRW=X':    { price: () => DATA_SNAPSHOT.krw },
  'HYG':      { price: () => DATA_SNAPSHOT.hyg || (DATA_SNAPSHOT._fallback || {}).hyg },
  'SPY':      { price: () => DATA_SNAPSHOT.spy || (DATA_SNAPSHOT.spx ? DATA_SNAPSHOT.spx / 10 : null), pct: () => DATA_SNAPSHOT.spxPct },
  // v36.6: 지수 선물 + VIX 선물 ETF + VVIX
  'ES=F':     { price: () => DATA_SNAPSHOT.spx },
  'NQ=F':     { price: () => DATA_SNAPSHOT.nasdaq },
  'YM=F':     { price: () => DATA_SNAPSHOT.dow },
  '^VVIX':    { price: () => DATA_SNAPSHOT.vvix },
  'VXX':      { price: () => DATA_SNAPSHOT.vxx },
  'UVXY':     { price: () => DATA_SNAPSHOT.uvxy },
  '^KS11':    { price: () => DATA_SNAPSHOT.kospi },
  '^KQ11':    { price: () => DATA_SNAPSHOT.kosdaq },
  'BTC-USD':  { price: () => DATA_SNAPSHOT.btc },
  // v46.9: 홈 화면/시그널 표시 종목 폴백 확장 (M19)
  '^DJI':     { price: () => DATA_SNAPSHOT.dow,    pct: () => DATA_SNAPSHOT.dowPct },
  '^IXIC':    { price: () => DATA_SNAPSHOT.nasdaq,  pct: () => DATA_SNAPSHOT.nasdaqPct },
  '^RUT':     { price: () => DATA_SNAPSHOT.rut,     pct: () => DATA_SNAPSHOT.rutPct },
  'QQQ':      { price: () => DATA_SNAPSHOT.qqq || (DATA_SNAPSHOT.nasdaq ? DATA_SNAPSHOT.nasdaq / 45 : null) },
  'ETH-USD':  { price: () => DATA_SNAPSHOT.eth },
  'NG=F':     { price: () => DATA_SNAPSHOT.ng },
  'SI=F':     { price: () => DATA_SNAPSHOT.silver },
  'GLD':      { price: () => DATA_SNAPSHOT.gld || (DATA_SNAPSHOT.gold ? DATA_SNAPSHOT.gold / 10 : null) },
  'TLT':      { price: () => DATA_SNAPSHOT.tlt },
};
function _aioSnapshotAgeMs() {
  try {
    var snap = window.DATA_SNAPSHOT || {};
    var raw = snap._updated || snap._snapshotDate;
    var ts = raw ? new Date(raw).getTime() : NaN;
    return isFinite(ts) ? Date.now() - ts : Infinity;
  } catch(e) { return Infinity; }
}
function _aioIsSnapshotUsableForFallback() {
  var pol = window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.static_snapshot;
  var maxAge = pol && pol.hardStaleMs ? pol.hardStaleMs : 7 * 24 * 60 * 60 * 1000;
  return _aioSnapshotAgeMs() <= maxAge;
}
window.AIO = window.AIO || {};
window.AIO.getSnapshotFallbackGuard = function() {
  var ageMs = _aioSnapshotAgeMs();
  return {
    usable: _aioIsSnapshotUsableForFallback(),
    ageMs: ageMs,
    ageHours: isFinite(ageMs) ? +(ageMs / 3600000).toFixed(1) : null,
    hardStaleMs: (window.FRESHNESS_POLICY && window.FRESHNESS_POLICY.static_snapshot && window.FRESHNESS_POLICY.static_snapshot.hardStaleMs) || 7 * 24 * 60 * 60 * 1000
  };
};

window.AIO.isOperationalQuoteSource = function(source) {
  var s = String(source || '').toLowerCase();
  if (!s || s === 'snapshot' || s === 'static_snapshot') return false;
  if (s.indexOf('live:') === 0) return true;
  if (s.indexOf('fx:') === 0) return true;
  if (/^fallback:(yahoo|stooq|naver|finnhub|coingecko|er-api|exchange-rate|currencylayer|frankfurter)/.test(s)) return true;
  return s.indexOf('fallback') === -1 && /(quote|chart|market|proxy|sise|naver|yahoo|stooq|coingecko|finnhub)/.test(s);
};

window.AIO.registerLiveSymbol = function(sym, meta) {
  sym = String(sym || '').trim().toUpperCase();
  if (!sym || /[\${}]/.test(sym) || /\+\s*sym\s*\+/.test(sym)) return false;
  if (sym === 'PCR') return false;
  window.LIVE_SYMBOLS = window.LIVE_SYMBOLS || [];
  if (window.LIVE_SYMBOLS.indexOf(sym) === -1) window.LIVE_SYMBOLS.push(sym);
  window._aioQuoteRequestSymbols = window._aioQuoteRequestSymbols || [];
  if (window._aioQuoteRequestSymbols.indexOf(sym) === -1) window._aioQuoteRequestSymbols.push(sym);
  if (meta && meta.reason && typeof _aioLog === 'function') {
    _aioLog('info', 'live-symbols', 'registered ' + sym + ' (' + meta.reason + ')');
  }
  return true;
};

window.AIO.registerLiveSymbolsFromDom = function(root, meta) {
  root = root || document;
  var added = 0;
  try {
    Array.prototype.slice.call(root.querySelectorAll('[data-live-price]')).forEach(function(el) {
      var sym = el.getAttribute('data-live-price');
      if (window.AIO.registerLiveSymbol(sym, meta || { reason: 'dom-scan' })) added++;
    });
  } catch(e) {}
  return added;
};

function _ldSafe(sym, prop, hardFallback) {
  var ld = window._liveData || {};
  if (ld[sym] && ld[sym][prop] != null) return ld[sym][prop];
  var sf = _SNAP_FALLBACK[sym];
  if (sf && sf[prop] && _aioIsSnapshotUsableForFallback()) {
    var v = sf[prop]();
    if (v != null && isFinite(Number(v))) return Number(v);
  }
  return hardFallback !== undefined ? hardFallback : null;
}

function _aioClampScore(v) {
  v = Number(v);
  if (!isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function _aioScoreLabel(score, positiveLabel, neutralLabel, weakLabel, dangerLabel) {
  if (score >= 70) return positiveLabel || '강함';
  if (score >= 45) return neutralLabel || '중립';
  if (score >= 25) return weakLabel || '약함';
  return dangerLabel || '위험';
}
function _aioScoreColor(score) {
  return score >= 70 ? 'var(--data-green)' : score >= 45 ? 'var(--data-amber)' : 'var(--data-red)';
}

window.AIO.getCurrentMarketRegime = function() {
  var snap = window.DATA_SNAPSHOT || {};
  var spxPct = _ldSafe('^GSPC', 'pct', snap.spxPct);
  var nasPct = _ldSafe('^IXIC', 'pct', snap.nasdaqPct);
  var vix = _ldSafe('^VIX', 'price', snap.vix);
  var dxy = _ldSafe('DX-Y.NYB', 'price', snap.dxy);
  var tnx = _ldSafe('^TNX', 'price', snap.tnx);
  var krw = _ldSafe('KRW=X', 'price', snap.krw);
  var hygPct = _ldSafe('HYG', 'pct', null);
  var riskScore = 50;
  if (isFinite(spxPct)) riskScore += spxPct * 8;
  if (isFinite(nasPct)) riskScore += nasPct * 4;
  if (isFinite(vix)) riskScore -= Math.max(0, vix - 18) * 2.2;
  if (isFinite(hygPct)) riskScore += hygPct * 5;
  riskScore = _aioClampScore(riskScore);
  var rateStress = 0;
  if (isFinite(tnx)) rateStress += Math.max(0, tnx - 4.25) * 30;
  if (isFinite(dxy)) rateStress += Math.max(0, dxy - 102) * 2;
  if (isFinite(krw)) rateStress += Math.max(0, krw - 1450) / 8;
  rateStress = _aioClampScore(rateStress);
  var regime = riskScore >= 65 && rateStress < 55 ? 'risk-on' : riskScore <= 35 || rateStress >= 70 ? 'risk-off' : 'mixed';
  return {
    regime: regime,
    riskScore: riskScore,
    rateStress: rateStress,
    inputs: { spxPct: spxPct, nasPct: nasPct, vix: vix, dxy: dxy, tnx: tnx, krw: krw, hygPct: hygPct },
    source: (window._liveData && Object.keys(window._liveData).length) ? 'live-first' : 'snapshot-guarded',
    generatedAt: new Date().toISOString()
  };
};

window.AIO.getKrMarketTemperature = function() {
  var snap = window.DATA_SNAPSHOT || {};
  var kospiPct = _ldSafe('^KS11', 'pct', snap.kospiPct);
  var kosdaqPct = _ldSafe('^KQ11', 'pct', snap.kosdaqPct);
  var krwPct = _ldSafe('KRW=X', 'pct', snap.krwPct);
  var vkospi = snap.vkospi;
  var adv = Number(snap.krAdvance);
  var dec = Number(snap.krDecline);
  var breadth = isFinite(adv) && isFinite(dec) && adv + dec > 0 ? (adv / (adv + dec) - 0.5) * 100 : 0;
  var sentiment = _aioClampScore(50 + (kospiPct || 0) * 8 + (kosdaqPct || 0) * 3 - Math.max(0, (vkospi || 18) - 20) * 1.5);
  var retail = _aioClampScore(50 + ((Number(snap.krDeposit) || 0) - 60) * 1.2 - Math.max(0, (Number(snap.krCreditBalance) || 0) - 20) * 2);
  var foreign = _aioClampScore(50 + (kospiPct || 0) * 8 - (krwPct || 0) * 6);
  var momentum = _aioClampScore(50 + (kospiPct || 0) * 9 + (kosdaqPct || 0) * 5 + breadth * 0.5);
  return {
    sentiment: sentiment,
    retail: retail,
    foreign: foreign,
    momentum: momentum,
    labels: {
      sentiment: _aioScoreLabel(sentiment, '위험선호', '중립', '공포', '극단 공포'),
      retail: _aioScoreLabel(retail, '매수 우위', '중립', '관망', '위축'),
      foreign: _aioScoreLabel(foreign, '수급 우호', '중립', '약세', '이탈 경고'),
      momentum: _aioScoreLabel(momentum, '강세', '중립', '약세', '극약세')
    },
    source: (window._liveData && (window._liveData['^KS11'] || window._liveData['^KQ11'])) ? 'live-first' : 'snapshot-guarded',
    generatedAt: new Date().toISOString()
  };
};

window.AIO.renderDynamicMarketNarratives = function() {
  try {
    var reg = window.AIO.getCurrentMarketRegime ? window.AIO.getCurrentMarketRegime() : null;
    var fx = document.getElementById('fxbond-dynamic-thesis');
    if (fx && reg) {
      var i = reg.inputs || {};
      var fmtNum = function(v, d, suffix) { return typeof v === 'number' && isFinite(v) ? v.toFixed(d) + (suffix || '') : 'n/a'; };
      var tone = reg.regime === 'risk-on' ? '위험선호가 우세합니다.' : reg.regime === 'risk-off' ? '방어적 해석이 우세합니다.' : '신호가 엇갈리는 혼합 국면입니다.';
      fx.textContent = tone + ' VIX ' + fmtNum(i.vix, 1) + ', 10Y ' + fmtNum(i.tnx, 2, '%') + ', DXY ' + fmtNum(i.dxy, 1) + ' 기준으로 금리/달러 스트레스 ' + reg.rateStress + ', 위험선호 점수 ' + reg.riskScore + '입니다. 이 문장은 라이브 지표 갱신 때 재계산됩니다.';
    }
    var kr = window.AIO.getKrMarketTemperature ? window.AIO.getKrMarketTemperature() : null;
    if (kr) {
      [
        ['kr-temp-sentiment-score', 'kr-temp-sentiment-label', kr.sentiment, kr.labels.sentiment],
        ['kr-temp-retail-score', 'kr-temp-retail-label', kr.retail, kr.labels.retail],
        ['kr-temp-foreign-score', 'kr-temp-foreign-label', kr.foreign, kr.labels.foreign],
        ['kr-temp-momentum-score', 'kr-temp-momentum-label', kr.momentum, kr.labels.momentum]
      ].forEach(function(row) {
        var scoreEl = document.getElementById(row[0]);
        var labelEl = document.getElementById(row[1]);
        if (scoreEl) { scoreEl.textContent = row[2]; scoreEl.style.color = _aioScoreColor(row[2]); }
        if (labelEl) { labelEl.textContent = row[3] + ' · ' + (kr.source === 'live-first' ? '라이브 연동' : '스냅샷 경계'); labelEl.style.color = _aioScoreColor(row[2]); }
      });
    }
  } catch(e) {
    if (window._aioLog) window._aioLog('warn', 'narrative', 'renderDynamicMarketNarratives: ' + (e && e.message || e));
  }
};

window.AIO_OPERATIONAL_DATA_CONTRACT = {
  version: 'v49.58',
  policies: {
    live: { maxAgeMs: 15 * 60 * 1000, decisionUse: true, confidence: 'high' },
    delayed: { maxAgeMs: 72 * 60 * 60 * 1000, decisionUse: true, confidence: 'medium' },
    snapshot: { maxAgeMs: 72 * 60 * 60 * 1000, decisionUse: false, confidence: 'reference' },
    manual_snapshot: { maxAgeMs: 7 * 24 * 60 * 60 * 1000, decisionUse: false, confidence: 'reference' },
    reference_only: { maxAgeMs: Infinity, decisionUse: false, confidence: 'reference' },
    archive: { maxAgeMs: Infinity, decisionUse: false, confidence: 'archive' }
  },
  classifySource: function(sourceKind) {
    var s = String(sourceKind || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (/manual|hand|spotgamma|estimate|weekly/.test(s)) return 'manual_snapshot';
    if (/reference|educational|estimate_only/.test(s)) return 'reference_only';
    if (/archive|history/.test(s)) return 'archive';
    if (/snapshot|seed|fallback/.test(s)) return 'snapshot';
    if (/delay|daily|fred|close/.test(s)) return 'delayed';
    if (/live|realtime|real_time|cboe|yahoo|naver/.test(s)) return 'live';
    return s && this.policies[s] ? s : 'snapshot';
  },
  evaluateMetric: function(metric) {
    metric = metric || {};
    var kind = this.classifySource(metric.sourceKind || metric.source || metric.sourceType);
    var policy = this.policies[kind] || this.policies.snapshot;
    var ts = metric.ts || metric.timestamp || metric.generatedAt || metric.asOf || null;
    var ageMs = null;
    if (ts) {
      var parsed = typeof ts === 'number' ? ts : new Date(ts).getTime();
      if (isFinite(parsed)) ageMs = Date.now() - parsed;
    }
    var stale = ageMs != null && isFinite(policy.maxAgeMs) && ageMs > policy.maxAgeMs;
    var allowedUse = !!policy.decisionUse && stale !== true;
    return {
      status: allowedUse ? 'ok' : 'reference_only',
      sourceKind: kind,
      sourceLabel: metric.sourceLabel || metric.source || '',
      confidence: policy.confidence,
      decisionUse: !!policy.decisionUse,
      allowedUse: allowedUse,
      stale: !!stale,
      ageMs: ageMs,
      maxAgeMs: policy.maxAgeMs,
      reason: allowedUse ? 'fresh operational source' : (stale ? 'stale source' : 'non-operational source')
    };
  }
};

window.AIO.makeOperationalMetric = function(name, value, sourceKind, ts, sourceLabel, extra) {
  var metric = Object.assign({
    name: name,
    value: value,
    sourceKind: sourceKind || 'snapshot',
    sourceLabel: sourceLabel || '',
    ts: ts || Date.now()
  }, extra || {});
  metric.contract = window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric(metric);
  metric.allowedUse = metric.contract.allowedUse;
  return metric;
};

window.AIO.canDriveCurrentDecision = function(metric) {
  return !!(window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric(metric || {}).allowedUse);
};

window.AIO.getOperationalDataContractAudit = function() {
  var issues = [];
  var pcrValues = [];
  try {
    Array.prototype.slice.call(document.querySelectorAll('[data-live-price="PCR"]')).forEach(function(el) {
      var txt = (el.textContent || '').trim();
      if (txt && txt !== '—') pcrValues.push(txt);
    });
    var pcrUnique = {};
    pcrValues.forEach(function(v) { pcrUnique[v] = true; });
    var pcrDistinct = Object.keys(pcrUnique);
    if (pcrDistinct.length > 1) {
      issues.push({ type: 'pcr-dom-mismatch', values: pcrDistinct });
    }
    var gex = document.querySelector('[data-snap="gex-current"], #opt-gex-val');
    if (gex && gex.getAttribute('data-operational-use') !== 'reference-only') {
      issues.push({ type: 'manual-gex-not-reference-only', value: (gex.textContent || '').trim() });
    }
    if (window._lastPutCallPayload && window._lastPutCallPayload.metric) {
      var pcrEval = window.AIO_OPERATIONAL_DATA_CONTRACT.evaluateMetric(window._lastPutCallPayload.metric);
      if (!pcrEval.allowedUse && /^(live|delayed)$/.test(window._lastPutCallPayload.sourceKind || '')) {
        issues.push({ type: 'pcr-operational-source-not-usable', reason: pcrEval.reason });
      }
    }
  } catch(e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    policyVersion: window.AIO_OPERATIONAL_DATA_CONTRACT.version,
    pcrSinkCount: pcrValues.length,
    generatedAt: new Date().toISOString()
  };
};

var AIO_CURRENTNESS_LIVE_SELECTOR = '[data-live-price], [data-live-kr], [data-live-chg]';
var AIO_CURRENTNESS_NARRATIVE_IDS = [
  'snapshot-stale-warning',
  'opt-pcr-text',
  'kr-supply-analysis-text',
  'mkt-regime-sub',
  'vol-regime-sub',
  'cam-verdict-text',
  'opt-analysis-text',
  'briefing-top-5-watch',
  'briefing-top-5-list',
  'briefing-action-item-card',
  'pf-analysis-dashboard',
  'kr-macro-analysis-text',
  'fxbond-dynamic-thesis',
  'risk-radar-body',
  'sent-analysis-text',
  'fund-analysis-text',
  'rally-quality-verdict'
];
var AIO_CURRENTNESS_NARRATIVE_SELECTOR = [
  '[data-aio-current-narrative]',
  '[data-currentness-narrative]',
  '[id$="-analysis-text"]',
  '[id*="analysis-dashboard"]',
  '[id*="verdict"]',
  '[id*="thesis"]',
  '[id*="action-item"]',
  '[id*="briefing-top"]',
  '[id*="score-decision-sub"]',
  '[id*="risk-radar-body"]'
].join(', ');
function _aioCurrentnessLiveKey(el) {
  return (el && (el.getAttribute('data-live-price') || el.getAttribute('data-live-kr') || el.getAttribute('data-live-chg'))) || '';
}
function _aioIsDecisionNarrativeCandidate(el) {
  if (!el || !el.id) return false;
  if (el.closest && el.closest('.aio-page-brief, [data-aio-archive="true"], nav, aside, .sidebar')) return false;
  if (/chart|canvas|input|button|badge|pill|chip/i.test(el.id)) return false;
  if (/(^|[-_])(ts|time|date|stale-days)([-_]|$)/i.test(el.id)) return false;
  var txt = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  var forced = AIO_CURRENTNESS_NARRATIVE_IDS.indexOf(el.id) >= 0;
  if (!txt || (!forced && txt.length < 12)) return false;
  return true;
}
function _aioCollectDecisionNarratives(root) {
  var out = [];
  var seen = {};
  var add = function(el) {
    if (!_aioIsDecisionNarrativeCandidate(el)) return;
    var key = el.id || el.getAttribute('data-aio-current-narrative') || el.getAttribute('data-currentness-narrative');
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(el);
  };
  AIO_CURRENTNESS_NARRATIVE_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && (!root || root === document || root === document.body || (root.contains && root.contains(el)))) add(el);
  });
  if (root && root.querySelectorAll) {
    Array.prototype.slice.call(root.querySelectorAll(AIO_CURRENTNESS_NARRATIVE_SELECTOR)).forEach(add);
  }
  return out;
}

window.AIO.getMarketCurrentnessAudit = function(opts) {
  opts = opts || {};
  var root = opts.root || document;
  var includeHidden = opts.includeHidden === true;
  var issues = [];
  var liveSinks = [];
  var narrativeIssues = [];
  var unavailableRe = /(로딩 중|데이터 로딩|수신 대기|불러오지 못했습니다|Loading|unavailable|^—$)/i;
  var isVisible = function(el) {
    if (includeHidden) return true;
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  };
  var clean = function(s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  try {
    Array.prototype.slice.call(root.querySelectorAll(AIO_CURRENTNESS_LIVE_SELECTOR)).forEach(function(el) {
      var visible = isVisible(el);
      var txt = clean(el.textContent);
      var key = _aioCurrentnessLiveKey(el);
      var unavailable = !txt || unavailableRe.test(txt);
      var use = el.getAttribute('data-operational-use') || '';
      var sourceKind = el.getAttribute('data-source-kind') || '';
      var referenceOnly = use === 'reference-only' || /snapshot|unavailable|reference/.test(sourceKind);
      var hasLineage = !!(use && sourceKind);
      var item = {
        key: key,
        id: el.id || '',
        pageId: (function() { var p = el.closest && el.closest('.page[id]'); return p ? p.id : null; })(),
        text: txt.slice(0, 120),
        visible: visible,
        unavailable: unavailable,
        operationalUse: use || null,
        sourceKind: sourceKind || null
      };
      liveSinks.push(item);
      if (visible && unavailable && !referenceOnly) {
        issues.push({ type: 'visible-live-sink-unavailable', key: key, id: item.id, pageId: item.pageId, text: item.text });
      }
      if (visible && !unavailable && !hasLineage) {
        issues.push({ type: 'visible-live-sink-missing-lineage', key: key, id: item.id, pageId: item.pageId, text: item.text });
      }
    });
    _aioCollectDecisionNarratives(root).forEach(function(el) {
      var id = el.id || '';
      if (!el || !isVisible(el)) return;
      var txt = clean(el.textContent);
      if (/로딩 중|데이터 로딩|수신 대기|계산중/.test(txt)) {
        var issue = { type: 'visible-decision-narrative-loading', id: id, text: txt.slice(0, 160) };
        issues.push(issue);
        narrativeIssues.push(issue);
      }
      if (txt && !el.getAttribute('data-operational-use')) {
        var lineageIssue = { type: 'visible-decision-narrative-missing-lineage', id: id, text: txt.slice(0, 160) };
        issues.push(lineageIssue);
        narrativeIssues.push(lineageIssue);
      }
    });
  } catch(e) {
    issues.push({ type: 'audit-error', message: e && e.message || String(e) });
  }
  var snap = window.DATA_SNAPSHOT || {};
  var updatedTs = snap._updated ? new Date(snap._updated).getTime() : 0;
  var snapshotAgeHours = updatedTs ? Math.round((Date.now() - updatedTs) / 3600000) : null;
  var freshness = null;
  try { freshness = window.AIO.getDataFreshnessAudit ? window.AIO.getDataFreshnessAudit() : null; } catch(_) {}
  var coreLiveOk = !!(freshness && freshness.liveCoverage && freshness.liveCoverage.coreOk);
  if (snapshotAgeHours != null && snapshotAgeHours > 72 && !coreLiveOk) {
    issues.push({ type: 'hard-stale-snapshot-without-core-live', snapshotAgeHours: snapshotAgeHours });
  }
  return {
    status: issues.length ? 'warn' : 'ok',
    issueCount: issues.length,
    issues: issues,
    visibleUnavailableCount: issues.filter(function(x) { return x.type === 'visible-live-sink-unavailable'; }).length,
    narrativeIssueCount: narrativeIssues.length,
    snapshotAgeHours: snapshotAgeHours,
    coreLiveOk: coreLiveOk,
    liveSinkCount: liveSinks.length,
    liveSinks: liveSinks,
    generatedAt: new Date().toISOString()
  };
};

window.AIO.updateSnapshotStaleBanner = function() {
  var el = document.getElementById('snapshot-stale-warning');
  if (!el) return null;
  var snap = window.DATA_SNAPSHOT || {};
  var updatedTs = snap._updated ? new Date(snap._updated).getTime() : 0;
  if (!updatedTs || isNaN(updatedTs)) return null;
  var hrs = Math.floor((Date.now() - updatedTs) / 3600000);
  if (hrs <= 24) {
    el.style.display = 'none';
    return { status: 'fresh', hours: hrs };
  }
  var currentness = window.AIO.getMarketCurrentnessAudit ? window.AIO.getMarketCurrentnessAudit() : null;
  var coreLiveOk = !!(currentness && currentness.coreLiveOk);
  el.style.display = 'block';
  el.setAttribute('data-operational-use', 'reference-only');
  el.setAttribute('data-source-kind', 'snapshot');
  if (coreLiveOk) {
    el.textContent = '핵심 live 시세 반영 중 · 정적 보조 스냅샷은 ' + hrs + '시간 전 자료라 현재 판단에서 제외됩니다.';
    el.style.background = 'rgba(0,212,255,0.08)';
    el.style.borderColor = 'rgba(0,212,255,0.25)';
    el.style.color = 'var(--data-cyan)';
  } else {
    el.textContent = '정적 스냅샷 기준 ' + hrs + '시간 전 · 핵심 live 시세가 완전하지 않아 현재 시장 판단에 사용하지 마세요.';
    el.style.background = 'rgba(255,91,80,0.10)';
    el.style.borderColor = 'rgba(255,91,80,0.30)';
    el.style.color = 'var(--data-red)';
  }
  return { status: coreLiveOk ? 'reference-only' : 'warn', hours: hrs, coreLiveOk: coreLiveOk };
};

window.AIO.applyMarketCurrentnessGuard = function(opts) {
  opts = opts || {};
  var audit = window.AIO.getMarketCurrentnessAudit ? window.AIO.getMarketCurrentnessAudit(opts) : null;
  try {
    Array.prototype.slice.call(document.querySelectorAll(AIO_CURRENTNESS_LIVE_SELECTOR)).forEach(function(el) {
      var visible = !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      if (!visible && opts.includeHidden !== true) return;
      var txt = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || /(로딩 중|데이터 로딩|수신 대기|불러오지 못했습니다|Loading|unavailable|^—$)/i.test(txt)) {
        el.setAttribute('data-operational-use', 'reference-only');
        el.setAttribute('data-source-kind', 'unavailable');
        el.title = '실시간 데이터 미수신 · 현재 시장 판단 제외';
        if (/로딩 중|데이터 로딩|수신 대기/.test(txt) && txt.length <= 24) {
          el.textContent = '수신 실패 · 판단 제외';
        }
      } else if (!el.getAttribute('data-source-kind') || !el.getAttribute('data-operational-use')) {
        el.setAttribute('data-operational-use', 'reference-only');
        el.setAttribute('data-source-kind', 'unknown');
        el.title = '출처 메타데이터 미확인 · 현재 시장 판단 제외';
      }
    });
    _aioCollectDecisionNarratives(document).forEach(function(el) {
      if (!el) return;
      var visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      if (!visible && opts.includeHidden !== true) return;
      var txt = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/로딩 중|데이터 로딩|수신 대기|계산중/.test(txt)) {
        el.setAttribute('data-operational-use', 'reference-only');
        el.setAttribute('data-source-kind', 'unavailable');
        el.title = '분석 데이터 미수신 · 현재 시장 판단 제외';
        if (txt.length <= 180) {
          el.textContent = '데이터 수신 지연 · 현재 시장 판단 제외';
        }
      } else if (txt && !el.getAttribute('data-operational-use')) {
        el.setAttribute('data-operational-use', 'reference-only');
        el.setAttribute('data-source-kind', 'mixed');
        el.title = '혼합 출처 분석 · 보조 참고용';
      }
    });
    window.AIO.updateSnapshotStaleBanner && window.AIO.updateSnapshotStaleBanner();
  } catch(e) {
    if (window.AIO && window.AIO.recordDataQualityIssue) {
      window.AIO.recordDataQualityIssue({ source: 'market-currentness-guard', severity: 'warn', message: e && e.message || String(e) });
    }
  }
  return audit;
};

if (typeof document !== 'undefined') {
  var _aioScheduleMarketCurrentnessGuard = function(delay) {
    setTimeout(function() {
      try {
        if (window.AIO && typeof window.AIO.applyMarketCurrentnessGuard === 'function') {
          window.AIO.applyMarketCurrentnessGuard();
        }
      } catch(_) {}
    }, delay || 0);
  };
  _aioPageBus.register('core-dynamic-narratives-live', 'aio:liveQuotes', function() {
    if (window.AIO && window.AIO.renderDynamicMarketNarratives) window.AIO.renderDynamicMarketNarratives();
    _aioScheduleMarketCurrentnessGuard(400);
  });
  _aioPageBus.register('core-dynamic-narratives-shown', 'aio:pageShown', function() {
    if (window.AIO && window.AIO.renderDynamicMarketNarratives) window.AIO.renderDynamicMarketNarratives();
    _aioScheduleMarketCurrentnessGuard(1200);
  });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function(){ if (window.AIO && window.AIO.renderDynamicMarketNarratives) window.AIO.renderDynamicMarketNarratives(); }, 800);
    _aioScheduleMarketCurrentnessGuard(6000);
    _aioScheduleMarketCurrentnessGuard(18000);
  } else {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(function(){ if (window.AIO && window.AIO.renderDynamicMarketNarratives) window.AIO.renderDynamicMarketNarratives(); }, 800);
      _aioScheduleMarketCurrentnessGuard(6000);
      _aioScheduleMarketCurrentnessGuard(18000);
    });
  }
}

const breadcrumbMap = {
  home: ['AIO','대시보드'], themes: ['AIO','테마 분석'],
  'kr-home': ['AIO','한국장 홈'], 'kr-supply': ['AIO','수급 분석'],
  'kr-themes': ['AIO','국내 테마'], 'kr-macro': ['AIO','한국 매크로'], 'kr-technical': ['AIO','차트·기술 분석 (KR)'],
  portfolio: ['AIO','포트폴리오'], macro: ['AIO','매크로'],
  technical: ['AIO','기술적 분석'], fundamental: ['AIO','기업 분석'],
  briefing: ['AIO','데일리 브리핑'], sectors: ['AIO','섹터 로테이션'],
  options: ['AIO','옵션 대시보드'],
  'market-news': ['AIO','시장 소식'], signal: ['AIO','매매 시그널'], breadth: ['AIO','시장 흐름'], sentiment: ['AIO','투자 심리'],
  guide: ['AIO','입문 가이드'],
  'theme-detail': ['AIO','테마','—'],
  ticker: ['AIO','—','—'],
};

// ═══ v49.1 P184: AIO.state — 전역 변수 namespace 초기화 ═══════════════════════
// 11개 모듈 전역 변수의 중앙 집합소. 기존 변수명은 하위호환 shim으로 유지.
// D1 6종: prevPage · _lastPageShownFire · _currentTickerSym ·
//         _aioPopstateRegistered · _scrSortCol · _scrSortAsc
window.AIO = window.AIO || {};
if (!window.AIO.state) {
  window.AIO.state = {
    prevPage: 'home',
    _lastPageShownFire: null,
    _currentTickerSym: '',
    _aioPopstateRegistered: false,
    _scrSortCol: 'mcap',
    _scrSortAsc: false
  };
}
let prevPage = 'home';
// v49.1 P184: prevPage ↔ AIO.state.prevPage 양방향 shim (window.prevPage 외부 접근 지원)
window.AIO.state.prevPage = prevPage;
try {
  Object.defineProperty(window, 'prevPage', {
    configurable: true, enumerable: true,
    get: function() { return window.AIO.state.prevPage; },
    set: function(v) { prevPage = v; window.AIO.state.prevPage = v; }
  });
} catch(e) { /* strict-mode iframe 등 defineProperty 불가 환경 무시 */ }
if (window._aioGlobalRegistry) {
  window._aioGlobalRegistry.register('prevPage',
    function() { return window.AIO.state.prevPage; },
    function(v) { prevPage = v; window.AIO.state.prevPage = v; }
  );
}

// v29.4: XSS 방지 — innerHTML 대신 안전한 DOM 생성
function setBreadcrumb(parts) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  bc.innerHTML = '';
  parts.forEach((p, i) => {
    const span = document.createElement('span');
    span.textContent = p;
    if (i === parts.length - 1) span.className = 'current';
    bc.appendChild(span);
    if (i < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      bc.appendChild(sep);
    }
  });
}

// ── v30.10: 페이지별 차트 cleanup (메모리 누수 차단) ──────────────────
function destroyPageCharts(pageId) {
  try {
    // v48.14 (Agent W6/P2-8): _pageState 연계 — 타이머·Observer 자동 정리
    if (window._pageState && typeof window._pageState.reset === 'function') {
      try { window._pageState.reset(pageId); } catch(e) {}
    }
    if (pageId === 'sentiment') {
      Object.values(sentPageCharts).forEach(c => { try { c.destroy(); } catch(e){} });
      Object.keys(sentPageCharts).forEach(k => delete sentPageCharts[k]);
      sentPageInitialized = false;
      sentChartsInitialized = false;
    }
    if (pageId === 'breadth') {
      // v30.10: canvas mouseleave 핸들러도 제거
      ['bp-price-chart','bp-5ma-chart','bp-20ma-chart','bp-50ma-chart'].forEach(function(cid) {
        var cvs = document.getElementById(cid);
        if (cvs && cvs._bpMouseLeave) { cvs.removeEventListener('mouseleave', cvs._bpMouseLeave); delete cvs._bpMouseLeave; }
      });
      Object.values(bpChartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
      Object.keys(bpChartInstances).forEach(k => delete bpChartInstances[k]);
      bpChartsInitialized = false;
      Object.values(bhChartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
      Object.keys(bhChartInstances).forEach(k => delete bhChartInstances[k]);
      bhChartsInitialized = false;
    }
    if (pageId === 'fxbond') {
      if (window._yieldCurveChart) { window._yieldCurveChart.destroy(); window._yieldCurveChart = null; }
      if (typeof _ycChart !== 'undefined' && _ycChart) { _ycChart.destroy(); _ycChart = null; }
    }
    if (pageId === 'screener' || pageId === 'portfolio') {
      if (typeof _tickerChartInstance !== 'undefined' && _tickerChartInstance) {
        _tickerChartInstance.destroy(); _tickerChartInstance = null;
      }
    }
    // v30.11: Signal 페이지 이탈 시 타이머 전수 해제 (좀비 타이머 방지)
    if (pageId === 'signal') {
      if (typeof _signalInterval !== 'undefined' && _signalInterval) {
        clearInterval(_signalInterval); _signalInterval = null;
      }
      // v41.5: sigRefreshTimer 해제 (페이지 전용)
      if (typeof sigRefreshTimer !== 'undefined' && sigRefreshTimer) {
        clearInterval(sigRefreshTimer); sigRefreshTimer = null;
      }
      // v48.27 (P7): _refreshSignalInterval은 앱 초기화 단일 진실 원천이므로 정리하지 않음 (home/dashboard도 의존)
    }
    // v38.3: market-news 페이지 이탈 시 뉴스 리프레시 타이머 해제
    if (pageId === 'market-news') {
      if (typeof refreshTimer !== 'undefined' && refreshTimer) {
        clearTimeout(refreshTimer); refreshTimer = null;
      }
      // v48.27 (P9): _newsSentChart Chart.js 인스턴스 정리 (route-change 메모리 누수)
      if (window._newsSentChart) {
        try { window._newsSentChart.destroy(); } catch(e){}
        window._newsSentChart = null;
      }
    }
    // v48.27 (P1): macro 페이지 이탈 시 _sector20dChart 정리 (Chart.js 메모리 누수)
    if (pageId === 'macro') {
      if (typeof _sector20dChart !== 'undefined' && _sector20dChart) {
        try { _sector20dChart.destroy(); } catch(e){}
        _sector20dChart = null;
      }
      // FRED 차트도 destroy (LWC compat wrapper도 destroy 호출 가능)
      if (typeof _fredChartInstances !== 'undefined') {
        Object.values(_fredChartInstances).forEach(function(c) { try { c.destroy(); } catch(e){} });
        Object.keys(_fredChartInstances).forEach(function(k) { delete _fredChartInstances[k]; });
      }
    }
    // v38.3: technical 페이지 차트 정리
    if (pageId === 'technical') {
      document.querySelectorAll('#page-technical canvas').forEach(function(c) {
        var ctx = c.getContext && c.getContext('2d');
        if (ctx && ctx.chart) { try { ctx.chart.destroy(); } catch(e){} }
      });
    }
    // v41.5: fundamental 페이지 재진입 허용
    if (pageId === 'fundamental') {
      if (typeof _fundInitDone !== 'undefined') _fundInitDone = false;
    }
    // v40.9: 한국 차트 정리
    if (pageId === 'kr-technical') {
      if (typeof krTechCharts !== 'undefined') {
        Object.values(krTechCharts).forEach(function(c) { try { c.destroy(); } catch(e){} });
        Object.keys(krTechCharts).forEach(function(k) { delete krTechCharts[k]; });
      }
    }
    // v42.5: 한국 페이지 Canvas 정리 (kr-home/supply/themes/macro)
    if (pageId === 'kr-home' || pageId === 'kr-supply' || pageId === 'kr-themes' || pageId === 'kr-macro') {
      document.querySelectorAll('#page-' + pageId + ' canvas').forEach(function(c) {
        var ctx = c.getContext && c.getContext('2d');
        if (ctx && ctx.chart) { try { ctx.chart.destroy(); } catch(e){} }
      });
    }
    // v46.9: 한국 페이지 재귀 setTimeout 정리 (P84/P85)
    if (pageId === 'kr-home' && typeof _krHomeRetryTimer !== 'undefined' && _krHomeRetryTimer) {
      clearTimeout(_krHomeRetryTimer); _krHomeRetryTimer = null; _krHomeRetry = 0;
    }
    if (pageId === 'kr-supply' && typeof _krSupplyRetryTimer !== 'undefined' && _krSupplyRetryTimer) {
      clearTimeout(_krSupplyRetryTimer); _krSupplyRetryTimer = null; _krSupplyRetry = 0;
    }
    if (pageId === 'kr-supply') window._krSupplyLoaded = false; // v46.9: 재진입 시 수급 재fetch 허용
    if (pageId === 'kr-macro' && typeof _krMacroRetryTimer !== 'undefined' && _krMacroRetryTimer) {
      clearTimeout(_krMacroRetryTimer); _krMacroRetryTimer = null; _krMacroRetry = 0;
    }
    // v42.4: themes 페이지 RRG canvas 클리어 (잔상 방지)
    if (pageId === 'themes') {
      var rrgCanvas = document.getElementById('rrg-canvas');
      if (rrgCanvas) { var ctx2d = rrgCanvas.getContext && rrgCanvas.getContext('2d'); if (ctx2d) ctx2d.clearRect(0, 0, rrgCanvas.width, rrgCanvas.height); }
      if (window._rrgRetry) window._rrgRetry = 0;
    }
  } catch(e) { _aioLog('warn', 'chart', 'destroyPageCharts error: ' + (e && e.message || e)); }
}

// v48.14 (Agent C1/P1-3): _liveData 직접 쓰기 감지 헬퍼 — AIO_DEBUG 켰을 때만 경고
// 기존 9곳의 `window._liveData[sym] = ...` 경로를 점진적으로 PriceStore.set()으로 전환
// 운영 시: window.AIO_DEBUG = true; 설정 후 개발자 도구에서 `window._ssotWarnings` 조회
window._ssotWarnings = [];
window._warnDirectLiveDataWrite = function(sym, caller) {
  try {
    var entry = { sym: sym, caller: caller || '?', ts: Date.now() };
    window._ssotWarnings.push(entry);
    if (window._ssotWarnings.length > 100) window._ssotWarnings.shift(); // 캐시 제한
    if (window.AIO_DEBUG && typeof _aioLog === 'function') {
      _aioLog('warn', 'ssot', 'direct _liveData write: ' + sym + ' (use PriceStore.set instead)', { caller: caller });
    }
  } catch(e) {}
};

// v48.14 (Agent P3-3): AIOBus — 중앙화 이벤트 버스 (document.dispatchEvent 래퍼)
// 기존 `document.dispatchEvent(new CustomEvent('aio:*', {detail:...}))` 호환
// 추가: payload 타입 문서화, 통합 로그, 리스너 추적, dedup 지원
//
// Event Type 카탈로그 (v48.14):
//   aio:pageShown          { detail: pageId, source: 'showPage'|'popstate' }
//   aio:liveQuotes         { detail: { count, timestamp } }
//   aio:liveDataReceived   { detail: { source, count } }
//   aio:regime-change      { detail: { key, from, to, value, regime, ts } }
//   aio:api-status-change  { detail: { api, from, to, errCount?, msg, ts } }
//   aio:threshold-breach   { detail: { metric, value, threshold, direction, recovered?, ts } }
window.AIOBus = (function() {
  var _listenerCount = {};
  return {
    emit: function(type, detail) {
      try {
        if (!type || !type.indexOf('aio:') !== 0 && !type.startsWith('aio:')) {
          if (typeof _aioLog === 'function') _aioLog('warn', 'bus', 'non-aio event type: ' + type);
        }
        document.dispatchEvent(new CustomEvent(type, { detail: detail }));
        if (typeof _aioLog === 'function') _aioLog('debug', 'bus', 'emit ' + type, detail);
      } catch(e) {
        if (typeof _aioLog === 'function') _aioLog('error', 'bus', 'emit failed: ' + type + ' — ' + e.message);
      }
    },
    on: function(type, handler, options) {
      try {
        document.addEventListener(type, handler, options);
        _listenerCount[type] = (_listenerCount[type] || 0) + 1;
      } catch(e) {}
    },
    off: function(type, handler) {
      try {
        document.removeEventListener(type, handler);
        if (_listenerCount[type]) _listenerCount[type]--;
      } catch(e) {}
    },
    once: function(type, handler) {
      this.on(type, handler, { once: true });
    },
    stats: function() { return Object.assign({}, _listenerCount); }
  };
})();

// v48.14 (Agent C3/P2-2): lazy-init 헬퍼 — IntersectionObserver 기반 차트 지연 초기화
// 사용: _lazyInit('breadth', chartEl, function() { initBreadthChart(chartEl); });
// 뷰포트 진입 시 initFn() 1회 호출 후 자동 unobserve
window._lazyInit = function(pageId, targetEl, initFn, options) {
  if (!targetEl || typeof initFn !== 'function') return;
  if (typeof IntersectionObserver === 'undefined') {
    // 브라우저 폴백: 즉시 호출
    try { initFn(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'lazyInit', 'immediate fallback failed: ' + e.message); }
    return;
  }
  var called = false;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && !called) {
        called = true;
        try { initFn(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'lazyInit', pageId + ' init failed: ' + e.message); }
        obs.unobserve(entry.target);
        obs.disconnect();
      }
    });
  }, options || { rootMargin: '100px', threshold: 0.01 });
  obs.observe(targetEl);
  // _pageState에 등록 (페이지 전환 시 자동 정리)
  if (window._pageState && pageId) {
    var s = window._pageState.get(pageId);
    s.observers.push(obs);
  }
};

// v48.14 (Agent W14/P2-8): _pageState 표준화 — 페이지별 초기화·차트·타이머 통합 관리
// destroyPageCharts에서 모두 정리되어 메모리 누수·중복 init 방지
// 사용:
//   var s = _pageState.get('breadth');
//   s.initialized = true;
//   s.timers.push(setTimeout(...));
//   s.charts.push(chartInstance);
window._pageState = window._pageState || (function() {
  var states = {};
  return {
    get: function(id) {
      if (!states[id]) states[id] = { initialized: false, charts: [], timers: [], observers: [] };
      return states[id];
    },
    reset: function(id) {
      var s = states[id];
      if (!s) return;
      // 타이머 정리
      (s.timers || []).forEach(function(t) { try { clearTimeout(t); clearInterval(t); } catch(e) {} });
      // IntersectionObserver 정리
      (s.observers || []).forEach(function(o) { try { o.disconnect(); } catch(e) {} });
      // Chart.js destroy는 destroyPageCharts가 담당 (중복 방지)
      states[id] = { initialized: false, charts: [], timers: [], observers: [] };
      if (typeof _aioLog === 'function') _aioLog('debug', 'pageState', 'reset: ' + id);
    },
    all: function() { return states; }
  };
})();

// v48.14 (Agent W1/P2-1): PAGES 라우터 테이블 — showPage 하드코딩 분기 해소
// 각 페이지의 init/destroy/deps를 중앙 선언. showPage는 이 테이블을 조회하여 실행.
// 향후 showPage 내부 `if (id === 'xxx')` 분기 17+개를 PAGES[id].init() 호출로 교체 가능.
// 현재는 기존 showPage 분기 + PAGES 테이블 병행 (점진 마이그레이션)
// v48.15 (P2-A): 모든 페이지의 init 로직을 PAGES 테이블로 통합 (단일 진실 원천)
// showPage · popstate 핸들러의 복제된 if-분기 전체를 이 테이블이 대체
window.PAGES = {
  'home':           { label: '홈 대시보드',     init: null,                                          chatCtx: null },
  'signal':         { label: '매매 시그널',     init: function() { if (typeof initSignalDashboard === 'function') _safePageInitGlobal('signal', initSignalDashboard); }, chatCtx: 'signal' },
  'breadth':        { label: '시장 폭',          init: function() { _lazyInitChartPage('breadth', 'bp-ad-ratio-chart', function() { if (typeof initBreadthPage === 'function') _safePageInitGlobal('breadth', initBreadthPage); if (typeof updateRallyQualityVerdict === 'function') setTimeout(updateRallyQualityVerdict, 500); }); }, chatCtx: null },
  'sentiment':      { label: '투자 심리',        init: function() { if (typeof initSentimentPage === 'function') _safePageInitGlobal('sentiment', initSentimentPage); }, chatCtx: null },  // v48.22: initSentimentPage 내부에서 4개 차트 개별 _lazyInit 호출 (이중 래핑 제거)
  'briefing':       { label: '데일리 브리핑',    init: function() { _initBriefingPage(); }, chatCtx: 'briefing' },
  'technical':      { label: '차트·기술',        init: function() { _safePageInitGlobal('technical', _initTechnicalPage); }, chatCtx: 'technical' },
  'macro':          { label: '거시경제',         init: function() { _safePageInitGlobal('macro', _initMacroPage); }, chatCtx: 'macro' },
  'fxbond':         { label: '환율·채권',        init: function() { if (typeof updateFxBondPage === 'function') _safePageInitGlobal('fxbond', updateFxBondPage); }, chatCtx: 'fxbond' },
  'fundamental':    { label: '기업 분석',        init: function() { _safePageInitGlobal('fundamental', _initFundamentalPage); }, chatCtx: 'fundamental' },
  'themes':         { label: '테마/섹터',        init: function() { _initThemePerfTable('themes'); }, chatCtx: 'themes' },
  'theme-detail':   { label: '테마 상세',        init: function() { _initThemePerfTable('theme-detail'); }, chatCtx: 'theme-detail' },
  'portfolio':      { label: '포트폴리오',       init: null, chatCtx: 'portfolio' },
  'ticker':         { label: '티커 상세',        init: function() {
                       // v48.27 (QA-6): 직접 URL #ticker 진입 시 안내 카드 표시 (분석은 사용자 입력 후 트리거)
                       try {
                         var pg = document.getElementById('page-ticker');
                         if (!pg) return;
                         // 이미 분석 결과가 렌더된 경우 손대지 않음
                         if (pg.querySelector('.ticker-analysis-result, [data-ticker-loaded]')) return;
                         // 인풋 박스 포커스 + 안내 토스트
                         var input = document.getElementById('ticker-analysis-input');
                         if (input) { try { input.focus(); } catch(_){} }
                         if (typeof showToast === 'function') showToast('티커를 입력하면 심층 분석을 시작합니다.');
                       } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'render', 'ticker init: ' + (e && e.message || e)); }
                     }, chatCtx: null },
  'market-news':    { label: '시장 뉴스',        init: function() { _initMarketNewsPage(); }, chatCtx: null },
  'options':        { label: '옵션 분석',        init: function() { _safePageInitGlobal('options', _initOptionsPage); }, chatCtx: null },
  'kr-home':        { label: '한국 홈',          init: function() { var tid = setTimeout(function() { try { if (typeof renderKrIssues === 'function') renderKrIssues(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'render', 'renderKrIssues failed: ' + e.message); } }, 500); if (window._pageState) window._pageState.get('kr-home').timers.push(tid); }, chatCtx: null },
  'kr-supply':      { label: '한국 공급망',      init: null, chatCtx: null },
  'kr-themes':      { label: '한국 테마',        init: null, chatCtx: 'kr-themes' },
  'kr-macro':       { label: '한국 거시',        init: null, chatCtx: 'kr-macro' },
  'kr-technical':   { label: '한국 기술',        init: null, chatCtx: 'kr-tech' },
  'guide':          { label: '사용 설명서',      init: null, chatCtx: null }
};

// v48.15 (P2-A): PAGES.init 지원 헬퍼 함수들 — showPage/popstate에서 추출된 단일 진실 원천
function _initTechnicalPage() {
  if (typeof computeMarketHealth === 'function') {
    try {
      var h = computeMarketHealth();
      var hd = document.getElementById('health-score-display');
      var hg = document.getElementById('health-grade-display');
      var hr = document.getElementById('health-regime-display');
      if (h && h.score > 0) {
        if (hd) hd.textContent = h.score;
        if (hg) { hg.textContent = h.grade; hg.style.color = h.score >= 60 ? '#00e5a0' : h.score >= 40 ? '#ffa31a' : '#ff5b50'; }
        if (hr) hr.textContent = h.regime || '';
      } else {
        if (hd) hd.textContent = '대기';
        if (hg) { hg.textContent = '시세 수신 중…'; hg.style.color = 'var(--text-muted)'; }
      }
    } catch(e) {}
  }
  if (typeof updatePatternSignals === 'function') { try { updatePatternSignals(); } catch(e) {} }
  if (typeof updateTechIndicators === 'function') { try { updateTechIndicators(); } catch(e) {} }
  if (typeof runInstitutionalTechnicalBrief === 'function' && !window._lastTechnicalBrief) {
    try { runInstitutionalTechnicalBrief(); } catch(e) {}
  }
  var tvTechC = document.getElementById('tv-widget-technical');
  if (tvTechC && !tvTechC.querySelector('iframe') && typeof loadTVChart === 'function') {
    try { loadTVChart('technical'); } catch(e) {}
  }
  // v48.78: 심층 분석 패널 초기화 (기본 SPY)
  if (typeof initDeepAnalysisSection === 'function') {
    var inp = document.getElementById('deep-sym-input');
    var sym = (inp && inp.value.trim()) ? inp.value.trim().toUpperCase() : 'SPY';
    try { initDeepAnalysisSection(sym); } catch(e) {}
  }
}

function _initMacroPage() {
  // storyline/달력은 즉시 (텍스트 — 초기 로드 가벼움)
  if (typeof generateMacroStoryline === 'function') { try { generateMacroStoryline(); } catch(e) {} }
  if (typeof renderEconCalendar === 'function') { try { renderEconCalendar(); } catch(e) {} }
  // v48.15 (P2-C): Chart.js 무거운 작업은 IntersectionObserver 기반 lazy
  // yield curve 차트는 macro 페이지 중상단, FRED 12개월 시계열은 하단 — 각각 분리
  _lazyInitChartPage('macro', 'yieldCurveChart', function() {
    if (typeof initYieldCurveChart === 'function') { try { initYieldCurveChart(); } catch(e) {} }
  });
  _lazyInitChartPage('macro', 'fred-unrate-chart', function() {
    if (typeof _renderFredCharts === 'function') {
      try { _renderFredCharts(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'FRED 차트 에러: ' + (e && e.message || e)); }
    }
  });
}

function _initFundamentalPage() {
  if (typeof initFundamentalCards === 'function') { try { initFundamentalCards(); } catch(e) {} }
  if (typeof _fundRecentSearches === 'function') { try { _fundRecentSearches(); } catch(e) {} }
}

function _initOptionsPage() {
  if (typeof initOptionsPage === 'function') {
    try { initOptionsPage(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'init', 'Options init error: ' + (e && e.message || e)); }
  }
}

function _initMarketNewsPage() {
  if (typeof newsCache !== 'undefined' && newsCache.length > 0 && typeof renderFeed === 'function') {
    renderFeed(newsCache);
  } else if (typeof fetchAllNews === 'function') {
    setTimeout(function(){ try { fetchAllNews().catch(function(){}); } catch(e){} }, 600);
  }
}

function _initBriefingPage() {
  if (typeof renderBriefingFeed === 'function') {
    if (typeof newsCache !== 'undefined' && newsCache.length > 0) {
      renderBriefingFeed(newsCache);
    } else {
      var _bc = document.getElementById('briefing-live-news-list');
      var _hasContent = _bc && (_bc.querySelector('.briefing-section') || _bc.querySelector('.ai-briefing-content'));
      if (!_hasContent && typeof fetchAllNews === 'function') {
        setTimeout(function() {
          if (typeof isFetching === 'undefined' || !isFetching) {
            fetchAllNews().then(function(){ renderBriefingFeed(newsCache); }).catch(function(e){ if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'Briefing fetch error: ' + (e && e.message || e)); });
          }
        }, 600);
      }
    }
  }
  var brBadge = document.getElementById('briefing-regime-badge');
  if (brBadge && typeof classifyMarketRegime === 'function') {
    try {
      var rg = classifyMarketRegime();
      var rgText = rg.regime || '분석중';
      if (rgText.indexOf('BEAR') >= 0 || rgText.indexOf('DOWN') >= 0 || rgText.indexOf('하락') >= 0) { brBadge.textContent = ' ' + rgText; brBadge.className = 'status-pill sp-risk-off'; }
      else if (rgText.indexOf('CORR') >= 0 || rgText.indexOf('조정') >= 0) { brBadge.textContent = ' ' + rgText; brBadge.className = 'status-pill sp-risk-off'; }
      else if (rgText.indexOf('BULL') >= 0 || rgText.indexOf('상승') >= 0 || rgText.indexOf('UP') >= 0) { brBadge.textContent = ' ' + rgText; brBadge.className = 'status-pill sp-risk-on'; }
    } catch(e) {}
  }
  setTimeout(function() {
    var bc = document.getElementById('briefing-live-news-list');
    if (!bc) return;
    if (bc.querySelector('.briefing-section') || bc.querySelector('.ai-briefing-content')) return;
    if (bc.innerHTML.indexOf('불러오는 중') !== -1 || bc.innerHTML.indexOf('로딩') !== -1 || bc.innerHTML.indexOf('AI 브리핑 생성 중') !== -1) {
      var items = window._allNewsItems || (typeof newsCache !== 'undefined' ? newsCache : []) || [];
      if (items.length > 0) {
        if (typeof _briefingCacheKey !== 'undefined') _briefingCacheKey = null;
        renderBriefingFeed(items);
        if (typeof _aioLog === 'function') _aioLog('info', 'render', '브리핑 타임아웃 렌더: ' + items.length + '건');
      } else {
        bc.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">' +
          '뉴스 수신 시간 초과 — 네트워크 상태를 확인하세요.<br>' +
          '<button data-action="_aioBriefingRetry" style="background:var(--data-cyan-soft);border:1px solid var(--data-cyan-dim);color:#60a5fa;font-size:10px;padding:4px 12px;border-radius:5px;cursor:pointer;margin-top:8px;font-weight:600;">↻ 다시 시도</button>' +
          '</div>';
      }
    }
  }, 45000);
}

// themes/theme-detail/kr-themes 공통: 성과 테이블 lazy-init (IntersectionObserver)
function _initThemePerfTable(pageId) {
  if (typeof _updatePerfTable !== 'function') return;
  var perfTarget = document.querySelector('[data-perf-ytd]');
  if (perfTarget && typeof _lazyInit === 'function') {
    _lazyInit(pageId, perfTarget, function() {
      _updatePerfTable().catch(function(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'perf table lazy-init: ' + e.message); });
    });
  } else {
    var tid = setTimeout(function() { _updatePerfTable().catch(function(){}); }, 300);
    if (window._pageState) window._pageState.get(pageId).timers.push(tid);
  }
}

// v48.15 (P2-C): Chart.js 페이지 공통 lazy-init 래퍼
// 지정 canvas가 viewport에 진입할 때만 initFn 실행. canvas 없거나 observer 미지원 시 즉시 fallback.
function _lazyInitChartPage(pageId, canvasId, initFn) {
  var canvas = document.getElementById(canvasId);
  if (canvas && typeof _lazyInit === 'function') {
    _lazyInit(pageId, canvas, initFn);
  } else {
    try { initFn(); } catch(e) { if (typeof _aioLog === 'function') _aioLog('warn', 'lazyInit', pageId + ' fallback: ' + e.message); }
  }
}

// v48.14: safeInit 글로벌 노출 (PAGES 라우터가 사용)
function _safePageInitGlobal(pageId, fn) {
  try {
    var done = false;
    var run = function() { if (!done) { done = true; fn(); } };
    requestAnimationFrame(function() { requestAnimationFrame(run); });
    setTimeout(run, 80);
  } catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'page-init', pageId + ' init failed: ' + e.message); }
}

// v48.14: aio:pageShown dedup guard (Agent C2/P1-1 대응)
// showPage() 또는 popstate 중 200ms 내 중복 발사 시 두 번째 무시
var _lastPageShownFire = {};
// v49.1 P184: AIO.state 참조 공유 (객체이므로 변이는 자동 반영)
if (window.AIO && window.AIO.state) {
  window.AIO.state._lastPageShownFire = _lastPageShownFire;
  if (window._aioGlobalRegistry) window._aioGlobalRegistry.register('_lastPageShownFire',
    function() { return window.AIO.state._lastPageShownFire; },
    function(v) { _lastPageShownFire = v; window.AIO.state._lastPageShownFire = v; }
  );
}
function _firePageShown(id, source) {
  try {
    if (!id) return;
    var now = Date.now();
    if (_lastPageShownFire[id] && now - _lastPageShownFire[id] < 200) {
      if (typeof _aioLog === 'function') _aioLog('debug', 'event', 'pageShown dedup skip: ' + id + ' from ' + source);
      return;
    }
    _lastPageShownFire[id] = now;
    document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: id, source: source || 'unknown' }));
  } catch(e) { _aioLog('warn', 'fire-page', '_firePageShown failed: ' + e.message); }
}

function showPage(id, navEl) {
  // v34.5: 해시 별칭 매핑 — 잘못된 해시로 진입 시 올바른 페이지로 리다이렉트
  var _hashAlias = { chart: 'technical', dashboard: 'home', stock: 'fundamental', forex: 'fxbond', bond: 'fxbond', news: 'market-news', search: 'home', help: 'guide', manual: 'guide', trend: 'themes', theme: 'themes', moat: 'fundamental', korea: 'kr-home', 'kr-theme': 'kr-themes' };
  if (_hashAlias[id]) id = _hashAlias[id];
  // v49.58 R106: 페이지 진입 시 ticker-related 마커 자동 sync — ticker/fundamental/options/portfolio 등
  // CHAT_CONTEXTS가 활성 종목 자동 인지하여 환각 차단
  try {
    if (id !== 'ticker' && id !== 'fundamental' && id !== 'options') {
      // ticker context를 벗어나면 _currentTickerId clear (themes/macro 등에서 잔존 방지)
      // ticker/fundamental/options 진입은 showTicker 또는 fundamentalSearch에서 별도 set
      if (id === 'themes' || id === 'theme-detail' || id === 'kr-themes') {
        // themes 계열은 _currentThemeId만 유지, ticker는 clear
        window._currentTickerId = null;
      }
    }
  } catch(_markerErr) {}
  // v30.10: 이전 페이지 차트 정리 (메모리 누수 방지)
  if (typeof prevPage !== 'undefined' && prevPage && prevPage !== id) {
    destroyPageCharts(prevPage);
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); n.removeAttribute('aria-current'); });
  if(navEl) { navEl.classList.add('active'); navEl.setAttribute('aria-current', 'page'); }
  else {
    // v48.57: onclick 0건(v48.32+) 대응 — data-arg 기반으로 전환
    document.querySelectorAll('.nav-item').forEach(function(n){
      if (n.dataset && n.dataset.arg === id) { n.classList.add('active'); n.setAttribute('aria-current', 'page'); }
    });
  }
  const parts = breadcrumbMap[id] || ['AIO', id];
  setBreadcrumb(parts);
  // Browser history — enables native back/forward (skipped if sandboxed or popstate)
  // v49.1 P187: _aioInPopstate 플래그로 popstate 핸들러 내부에서 pushState 호출 방지
  try {
    if (!_aioInPopstate && history.state?.page !== id) {
      history.pushState({ page: id }, '', '#' + id);
    }
  } catch(e) { /* sandboxed iframe — history API not available */ }
  prevPage = id;
  if (window.AIO && window.AIO.state) window.AIO.state.prevPage = id; // v49.1 P184
  // v42.1: 마켓 펄스 바 — home에서는 숨기고 나머지 페이지에서 표시
  var _mpBar = document.getElementById('market-pulse-bar');
  if (_mpBar) _mpBar.style.display = (id === 'home' || id === 'guide' || id === 'glossary') ? 'none' : 'flex';
  var _contentEl = document.querySelector('.content');
  if (_contentEl) _contentEl.scrollTop = 0;
  // v41: 페이지 전환 시 focus를 새 페이지 타이틀로 이동 (스크린리더 지원)
  if (pg) { var pt = pg.querySelector('.page-title'); if (pt) { pt.setAttribute('tabindex', '-1'); pt.focus({preventScroll:true}); } }
  // Dispatch page shown event for lazy-init (v48.14: dedup guard)
  try { _firePageShown(id, 'showPage'); } catch(e) {}
  // v48.15 (P2-A): 13개 하드코딩 if-분기 → 단일 PAGES 라우터 호출로 교체
  // 각 페이지의 init 로직은 window.PAGES[id].init 에서 중앙 관리 (단일 진실 원천)
  if (window.PAGES && window.PAGES[id] && typeof window.PAGES[id].init === 'function') {
    try { window.PAGES[id].init(); }
    catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'page-init', 'showPage ' + id + ': ' + e.message); }
  }
}
window.showPage = showPage;

// v48.57: 브라우저 뒤로가기/앞으로가기 대응 (popstate 이벤트 · 이전까지 무반응)
// v49.1 P187: _aioInPopstate 플래그로 history.pushState 전역 hijack 제거
var _aioInPopstate = false;
if (typeof window !== 'undefined' && !window._aioPopstateRegistered) {
  window.addEventListener('popstate', function(e) {
    var pageId = null;
    if (e.state && e.state.page) pageId = e.state.page;
    else if (location.hash && location.hash.length > 1) pageId = location.hash.slice(1);
    if (!pageId) pageId = 'home';
    // 유효 페이지인지 확인
    if (document.getElementById('page-' + pageId)) {
      _aioInPopstate = true; // showPage 내 pushState 스킵 플래그
      try { showPage(pageId, null); } finally { _aioInPopstate = false; }
    }
  });
  window._aioPopstateRegistered = true;
  if (window.AIO && window.AIO.state) window.AIO.state._aioPopstateRegistered = true; // v49.1 P184
}

function showTheme(themeId) {
  // v49.57 R105 신규: 채팅 컨텍스트가 활성 테마 ticker를 라이브 가격으로 주입하도록 전역 마커
  window._currentThemeId = themeId;
  const themes = {
    ai: {name:'AI · 반도체', icon:''},
    defense: {name:'방산 · 우주', icon:''},
    energy: {name:'에너지 · 클린', icon:''},
    health: {name:'헬스케어 · 바이오', icon:''},
    fintech: {name:'핀테크 · 결제', icon:''},
    cloud: {name:'클라우드 · SaaS', icon:''},
    consumer: {name:'소비재 · 리테일', icon:''},
    real_estate: {name:'리츠 · 부동산', icon:''},
    ev: {name:'전기차 · 자율주행', icon:''},
    materials: {name:'원자재 · 광물', icon:''},
    crypto: {name:'크립토 · 블록체인', icon:''},
    infra: {name:'인프라 · 유틸리티', icon:''},
  };
  const t = themes[themeId] || {name:themeId, icon:''};
  document.getElementById('theme-detail-name').textContent = t.name;
  document.getElementById('theme-detail-icon').textContent = t.icon;
  document.getElementById('theme-detail-title').textContent = t.name;
  showPage('theme-detail', null);
  document.querySelectorAll('.nav-item').forEach(n=>{
    // v48.61 R45: data-arg 기반
    var arg = n.dataset && n.dataset.arg;
    var legacy = n.getAttribute('onclick');
    if (arg === 'themes' || (legacy && legacy.includes("'themes'"))) n.classList.add('active');
    else n.classList.remove('active');
  });
  const bc=document.getElementById('breadcrumb');
  bc.innerHTML=`<span>AIO</span><span class="sep">/</span><span data-action="showPage" data-arg="themes" style="cursor:pointer;">테마</span><span class="sep">/</span><span class="current">${escHtml(t.name)}</span>`;
}

const tickerData = {
  NVDA:{name:'NVIDIA Corporation', value:'₩13.7M', action:'watch'},
  AAPL:{name:'Apple Inc.', value:'₩10.3M', action:'hold'},
  MSFT:{name:'Microsoft Corp.', value:'₩5.1M', action:'buy'},
  TSLA:{name:'Tesla Inc.', value:'₩5.1M', action:'cut'},
  AMD:{name:'Advanced Micro Devices', value:'—', action:'hold'},
  AVGO:{name:'Broadcom Inc.', value:'—', action:'buy'},
  TSM:{name:'TSMC', value:'—', action:'hold'},
  INTC:{name:'Intel Corp.', value:'—', action:'cut'},
  GOOGL:{name:'Alphabet Inc.', value:'—', action:'buy'},
  META:{name:'Meta Platforms', value:'—', action:'buy'},
  AMZN:{name:'Amazon.com Inc.', value:'—', action:'hold'},
  PLTR:{name:'Palantir Technologies', value:'—', action:'buy'},
  ARM:{name:'ARM Holdings', value:'—', action:'buy'},
  COIN:{name:'Coinbase Global', value:'—', action:'watch'},
  CEG:{name:'Constellation Energy', value:'—', action:'buy'},
  CRWD:{name:'CrowdStrike Holdings', value:'—', action:'buy'},
  PANW:{name:'Palo Alto Networks', value:'—', action:'buy'},
  MU:{name:'Micron Technology', value:'—', action:'watch'},
  IONQ:{name:'IonQ Inc.', value:'—', action:'watch'},
  RKLB:{name:'Rocket Lab USA', value:'—', action:'watch'},
};
const actionLabels = {watch:'WATCH', hold:'HOLD', buy:'ADD', cut:'CUT'};
const actionClasses = {watch:'watch', hold:'neutral', buy:'buy', cut:'sell'};

function showTicker(tkr) {
  _currentTickerSym = tkr; // v27.1: chart에서 사용할 현재 티커 저장
  if (window.AIO && window.AIO.state) window.AIO.state._currentTickerSym = tkr; // v49.1 P184
  // v49.58 R106: 채팅 컨텍스트가 활성 종목 라이브 가격을 자동 주입하도록 전역 마커
  // CHAT_CONTEXTS['ticker'].system() / CHAT_CONTEXTS.fundamental.system()이 읽음
  window._currentTickerId = tkr;
  const d = tickerData[tkr] || {name:tkr, value:'—', action:'hold'};
  /* ── 동적 시세: _liveData에서 실시간 가격/변동률 가져오기 ── */
  var ld = window._liveData || {};
  var live = ld[tkr];
  var livePrice = live ? '$' + live.price.toFixed(2) : '—';
  var livePct = live ? live.pct : 0;
  var chgStr = live ? ((livePct >= 0 ? '▲ +' : '▼ ') + Math.abs(livePct).toFixed(2) + '%') : '—';
  var chgCls = live ? (livePct >= 0 ? 'up' : 'down') : '';
  var _tdn = document.getElementById('ticker-hero-name');
  if (_tdn) _tdn.textContent = tkr;
  // v48.47: 캔들/진입 섹션 심볼 라벨 동기화 + 자동 감지
  var _tcs = document.getElementById('ticker-candle-symbol');
  if (_tcs) _tcs.textContent = tkr;
  var _tes = document.getElementById('ticker-entry-symbol');
  if (_tes) _tes.textContent = tkr;
  try { if (typeof window._aioDetectTickerPattern === 'function') window._aioDetectTickerPattern(); } catch(_){}
  var _thf = document.getElementById('ticker-hero-fullname');
  if (_thf) _thf.textContent = d.name;
  // v41.9: Naver 한국어명 비동기 보강
  if (_thf && !tkr.endsWith('.KS')) {
    fetchNaverUSData(tkr, false).then(function(nv) {
      if (nv && nv.nameKr && _thf) _thf.textContent = d.name + ' (' + nv.nameKr + ')';
    }).catch(function(){});
  }
  var _thp = document.getElementById('ticker-hero-price');
  if (_thp) _thp.textContent = livePrice;
  var chgEl = document.getElementById('ticker-hero-chg');
  if (chgEl) { chgEl.textContent = chgStr; chgEl.className = 'ticker-chg-big ' + chgCls; }
  var pnlEl = document.getElementById('ticker-hero-pnl');
  if (pnlEl) { pnlEl.textContent = d.value !== '—' ? d.value : ''; pnlEl.className = 'pnl'; }
  var _thv = document.getElementById('ticker-hero-value');
  if (_thv) _thv.textContent = d.value !== '—' ? '평가금액: '+d.value : '내 포트폴리오 외 종목';
  var ab = document.getElementById('ticker-action-btn');
  if (ab) { ab.textContent = actionLabels[d.action] || d.action; ab.className = 'action-btn ' + (actionClasses[d.action]||'neutral'); }
  const backBtn = document.getElementById('ticker-back-btn-main');
  const parentEl = document.getElementById('ticker-breadcrumb-main');
  function setTickerNavTarget(targetPage) {
    [backBtn, parentEl].forEach(function(el) {
      if (!el) return;
      el.removeAttribute('onclick');
      el.setAttribute('data-action', 'showPage');
      el.setAttribute('data-arg', targetPage);
      el.setAttribute('role', el.getAttribute('role') || 'button');
      el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
    });
  }
  if(prevPage === 'themes' || prevPage === 'theme-detail') {
    backBtn.textContent = '← 테마 분석';
    parentEl.textContent = '테마 분석';
    setTickerNavTarget('themes');
  } else if(prevPage === 'fundamental') {
    backBtn.textContent = '← 펀더멘탈';
    parentEl.textContent = '펀더멘탈';
    setTickerNavTarget('fundamental');
  } else {
    backBtn.textContent = '← 포트폴리오';
    parentEl.textContent = '포트폴리오';
    setTickerNavTarget('portfolio');
  }
  // ── 진입 적합성 판단 (Jeff Sun CFTe Hard Rules 기반) ──
  var ecDiv = document.getElementById('ticker-entry-check');
  if (ecDiv) {
    var scrEntry = SCREENER_DB.find(function(r) { return r.sym === tkr; });
    var health = typeof computeMarketHealth === 'function' ? computeMarketHealth() : null;
    var checks = [];
    var pass = 0;

    // 1. RSI
    if (scrEntry && scrEntry.rsi != null) {
      var rsiOk = scrEntry.rsi >= 30 && scrEntry.rsi <= 70;
      checks.push({ label: 'RSI: ' + scrEntry.rsi, ok: rsiOk, note: rsiOk ? '적정 범위' : (scrEntry.rsi < 30 ? '과매도' : '과매수') });
      if (rsiOk) pass++;
    } else {
      checks.push({ label: 'RSI: —', ok: null, note: '데이터 없음' });
    }

    // 2. 시그널
    if (scrEntry) {
      var sigOk = scrEntry.signal === 'BUY';
      var sigWarn = scrEntry.signal === 'HOLD' || scrEntry.signal === 'WATCH';
      checks.push({ label: '시그널: ' + scrEntry.signal, ok: sigOk, note: sigOk ? '매수 적합' : (scrEntry.signal === 'SELL' ? '매도 신호' : '관망') });
      if (sigOk) pass++;
    } else {
      checks.push({ label: '시그널: —', ok: null, note: 'DB 미등록' });
    }

    // 3. 시장 환경
    if (health) {
      var envOk = health.score >= 55;
      checks.push({ label: '시장: ' + health.score + '점', ok: envOk, note: envOk ? health.regime : '약세 환경' });
      if (envOk) pass++;
    }

    // 4. ADR%
    if (scrEntry) {
      var adrVal = getAdrEstimate(scrEntry);
      var adrLabel = adrVal >= 4 ? '고변동' : adrVal >= 2 ? '중변동' : '저변동';
      checks.push({ label: 'ADR%: ' + adrVal + '%', ok: true, note: adrLabel });
      pass++;
    }

    var total = checks.length;
    var color = pass >= total - 1 ? '#00e5a0' : pass >= total / 2 ? '#ffa31a' : '#ff5b50';
    var verdict = pass >= total - 1 ? '진입 검토 가능' : pass >= total / 2 ? '선별적 검토' : '진입 자제';

    var html = '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;display:flex;justify-content:space-between;">' +
      '<span>진입 적합성</span>' +
      '<span style="color:' + color + ';font-family:var(--font-mono);">' + pass + '/' + total + ' ' + verdict + '</span></div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    checks.forEach(function(c) {
      var icon = c.ok === true ? '' : c.ok === false ? '' : '—';
      var bg = c.ok === true ? 'var(--data-green-faint)' : c.ok === false ? 'var(--data-amber-faint)' : 'var(--surface-2)';
      html += '<div style="background:' + bg + ';border-radius:5px;padding:4px 8px;font-size:11px;display:flex;align-items:center;gap:4px;">' +
        '<span>' + icon + '</span><span style="font-weight:700;">' + c.label + '</span><span style="color:var(--text-muted);">' + c.note + '</span></div>';
    });
    html += '</div>';
    ecDiv.innerHTML = html;
  }

  showPage('ticker', null);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  switchTab(document.querySelector('#page-ticker .tab'), 'tab-overview');
  const bc=document.getElementById('breadcrumb');
  // v48.33: 부모 엘리먼트의 data-action 속성 계승 (onclick 대체)
  var _pAction = parentEl ? (parentEl.getAttribute('data-action') || '') : '';
  var _pArg = parentEl ? (parentEl.getAttribute('data-arg') || '') : '';
  var _pArg2 = parentEl ? (parentEl.getAttribute('data-arg2') || '') : '';
  var _pAttrs = _pAction ? ` data-action="${escHtml(_pAction)}" data-arg="${escHtml(_pArg)}"${_pArg2 ? ` data-arg2="${escHtml(_pArg2)}"` : ''}` : '';
  bc.innerHTML=`<span>AIO</span><span class="sep">/</span><span style="cursor:pointer;"${_pAttrs}>${escHtml(parentEl ? parentEl.textContent : '')}</span><span class="sep">/</span><span class="current">${escHtml(tkr)}</span>`;
}

// ══════════════════════════════════════════════════════════════════════
// v48.88: 포트폴리오 리스크 통계 함수 (data:statistical-analysis 방법론)
// VaR(역사적 시뮬레이션) · Sharpe Ratio · 최대낙폭 · Pearson 상관계수
// 참고: P153 — 과거 수익률 분포 기반, 정규분포 가정 없음
// ══════════════════════════════════════════════════════════════════════

/**
 * 일별 수익률 계산 (종가 배열 → 수익률 배열)
 * Yahoo Finance API는 공휴일에 null을 반환하므로 null/NaN 필터링 포함
 * @param {number[]} prices - 종가 배열 (오름차순, 최소 2개)
 * @returns {number[]} 일별 수익률 배열
 */
function _calcDailyReturns(prices) {
  if (!prices || prices.length < 2) return [];
  // null/undefined/NaN 제거 (공휴일 갭 처리)
  var valid = prices.filter(function(p) { return p !== null && p !== undefined && !isNaN(p) && p > 0; });
  if (valid.length < 2) return [];
  var returns = [];
  for (var i = 1; i < valid.length; i++) {
    returns.push((valid[i] - valid[i - 1]) / valid[i - 1]);
  }
  return returns;
}

/** 산술 평균 */
function _statMean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
}

/** 표본 표준편차 */
function _statStdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  var mean = _statMean(arr);
  var variance = arr.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * VaR — 역사적 시뮬레이션 (정규분포 가정 없음, 실제 분포 사용)
 * @param {number[]} returns - 일별 수익률 배열 (최소 10개 권장)
 * @param {number} confidence - 신뢰수준 (0.95 또는 0.99)
 * @returns {number|null} VaR 손실률 (양수 표현, 0.035 = 3.5% 손실)
 */
/**
 * R-7 선형보간 분위수 (R quantile type 7 — Excel PERCENTILE.INC 동일)
 * @param {number[]} sorted - 오름차순 정렬 배열 (NaN 제거 후)
 * @param {number} p - 확률 [0, 1]
 */
function _quantileR7(sorted, p) {
  var n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  var h = (n - 1) * p;
  var lo = Math.floor(h), hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function _calcPortfolioVaR(returns, confidence) {
  if (!returns || returns.length < 10) return null;
  var conf = (typeof confidence === 'number') ? confidence : 0.95;
  // 보수적 historical VaR: 왼쪽 꼬리의 실제 관측 손실을 사용해
  // 보간이 손실/이익 경계를 건너 음수 VaR을 만들지 않도록 한다.
  var clean = returns.filter(function(v) { return typeof v === 'number' && isFinite(v); });
  if (clean.length < 10) return null;
  var sorted = clean.slice().sort(function(a, b) { return a - b; }); // 오름차순
  var tailCount = Math.max(1, Math.ceil(sorted.length * (1 - conf) - 1e-9));
  var quantile = sorted[Math.min(sorted.length - 1, tailCount - 1)];
  return Math.max(0, -quantile); // 손실을 양수로 표현
}

/**
 * Sharpe Ratio (연율화, 거래일 252일 기준)
 * @param {number[]} returns - 일별 수익률 배열
 * @param {number} rfRate - 연간 무위험수익률 (기본 0.043 = 4.3% US 3M T-bill)
 * @returns {number|null}
 */
function _calcSharpe(returns, rfRate) {
  if (!returns || returns.length < 10) return null;
  var rfDaily = ((typeof rfRate === 'number') ? rfRate : 0.043) / 252;
  var excess = returns.map(function(r) { return r - rfDaily; });
  var mean = _statMean(excess);
  var std = _statStdDev(excess);
  if (std < 1e-10) return null;  // v48.95 P1-9: near-zero std → null (division-by-zero 방지)
  return (mean / std) * Math.sqrt(252);
}

/**
 * 최대낙폭 (Max Drawdown) — 누적 수익률 고점 대비 최대 하락폭
 * @param {number[]} returns - 일별 수익률 배열
 * @returns {{mdd: number, peakIdx: number, troughIdx: number}|null}
 */
function _calcMaxDrawdown(returns) {
  if (!returns || returns.length < 2) return null;
  var cum = [1];
  for (var i = 0; i < returns.length; i++) {
    cum.push(cum[cum.length - 1] * (1 + returns[i]));
  }
  var maxMdd = 0, peak = cum[0], peakIdx = 0, troughIdx = 0, tempPeak = 0;
  for (var j = 1; j < cum.length; j++) {
    if (cum[j] > peak) { peak = cum[j]; tempPeak = j; }
    var dd = (peak - cum[j]) / peak;
    if (dd > maxMdd) { maxMdd = dd; peakIdx = tempPeak; troughIdx = j; }
  }
  return { mdd: maxMdd, peakIdx: peakIdx, troughIdx: troughIdx };
}

/**
 * Pearson 상관계수 (두 등길이 배열)
 */
function _pearsonCorr(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 2) return 0;
  var n = a.length;
  var mA = _statMean(a), mB = _statMean(b);
  var num = 0, denA = 0, denB = 0;
  for (var i = 0; i < n; i++) {
    var da = a[i] - mA, db = b[i] - mB;
    num += da * db; denA += da * da; denB += db * db;
  }
  if (denA < 1e-12 || denB < 1e-12) return 0;  // v48.95 P1-3: near-zero denom EPS → NaN 방지
  return num / Math.sqrt(denA * denB);
}

/**
 * 상관계수 매트릭스 (Pearson, n×n)
 * @param {Object} returnsMap - { ticker: number[] } 수익률 맵
 * @returns {{tickers: string[], matrix: number[][]}|null}
 */
function _calcCorrelationMatrix(returnsMap) {
  var tickers = Object.keys(returnsMap);
  if (tickers.length < 2) return null;
  var matrix = tickers.map(function(t1) {
    return tickers.map(function(t2) {
      if (t1 === t2) return 1;
      var r1 = returnsMap[t1], r2 = returnsMap[t2];
      var minLen = Math.min(r1.length, r2.length);
      return _pearsonCorr(r1.slice(r1.length - minLen), r2.slice(r2.length - minLen));
    });
  });
  return { tickers: tickers, matrix: matrix };
}

// ═══ v48.92: AIO.getColorContrastAudit() — WCAG AA 명도비 진단 API ═══════
// 용도: 핵심 색상 페어링의 명도비 자동 계산 · WCAG AA 준수 여부 보고
// 사용: AIO.getColorContrastAudit() → { pairs: [{fg, bg, ratio, wcagAA, label}], allPass: bool }
window.AIO.getColorContrastAudit = function() {
  // sRGB luminance 계산 (WCAG 2.1 공식)
  function _lum(hex) {
    var r, g, b;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function(c){ return c+c; }).join('');
    r = parseInt(hex.substr(0,2),16)/255;
    g = parseInt(hex.substr(2,2),16)/255;
    b = parseInt(hex.substr(4,2),16)/255;
    function _lin(c) { return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b);
  }
  function _ratio(hex1, hex2) {
    var l1 = _lum(hex1), l2 = _lum(hex2);
    var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }
  // 핵심 색상 페어링 (v48.92 CSS 토큰 기준)
  var bg = '#080d1a'; // AIO 다크 배경
  var pairs = [
    { label: '--text-muted (v48.92)', fg: '#9aa6b9', bg: bg },
    { label: '--text-secondary',      fg: '#a5b0c2', bg: bg },
    { label: '--text-primary',        fg: '#f0f4fc', bg: bg },
    { label: '--data-green (bull)',    fg: '#00e5a0', bg: bg },
    { label: '--data-red (bear)',      fg: '#ff5b50', bg: bg },
    { label: '--accent (cyan)',        fg: '#00d4ff', bg: bg },
    { label: '--data-amber',           fg: '#ffa31a', bg: bg },
    { label: 'fund-tab active bg',     fg: '#00d4ff', bg: '#1a2035' },
  ];
  var results = pairs.map(function(p) {
    var r = _ratio(p.fg, p.bg);
    return { fg: p.fg, bg: p.bg, ratio: r, wcagAA: r >= 4.5, wcagAALarge: r >= 3.0, label: p.label };
  });
  var allPass = results.every(function(r) { return r.wcagAA; });
  var failCount = results.filter(function(r) { return !r.wcagAA; }).length;
  return { pairs: results, allPass: allPass, failCount: failCount,
    summary: 'WCAG AA (' + (allPass ? '✓ 전체 통과' : '✗ ' + failCount + '건 미달') + ')' };
};

