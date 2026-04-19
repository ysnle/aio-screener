
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
  var _colorMap = { debug: '#94a3b8', info: '#60a5fa', warn: '#fbbf24', error: '#f87171' };

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
    var color = severity === 'error' ? '#ef4444' : severity === 'info' ? '#3ddba5' : '#fbbf24';
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
  var lastValid = 0;
  return arr.map(function(v, i) {
    if (v == null || typeof v !== 'number' || !isFinite(v)) {
      if (fillMode === 'zero') return 0;
      if (fillMode === 'prev') return lastValid;
      return null; // 'skip'
    }
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
    while (clean.length < labels.length) clean.push(fillMode === 'zero' ? 0 : clean[clean.length - 1] || 0);
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
    '<div style="font-size:9px;color:var(--text-muted);margin-top:4px;">데이터 갱신 시 자동 복구됩니다</div>' +
    '<button onclick="if(typeof fetchLiveQuotes===\'function\')fetchLiveQuotes()" style="background:rgba(91,168,255,0.1);border:1px solid rgba(91,168,255,0.2);color:#60a5fa;font-size:8px;padding:3px 10px;border-radius:4px;cursor:pointer;margin-top:6px;">↻ 데이터 재시도</button>';
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
      '<button id="btn-retry-all-apis" onclick="_retryAllFailedApis()" style="' +
      'background:rgba(220,38,38,0.25);border:1px solid rgba(220,38,38,0.5);color:#fca5a5;' +
      'font-size:9px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:8px;font-weight:600;' +
      'font-family:var(--font-mono);transition:all 0.2s;"> 수동 재연결</button>';
    banner.style.display = 'block';
    banner.style.background = 'rgba(220,38,38,0.15)';
    banner.style.borderColor = 'rgba(220,38,38,0.3)';
    banner.style.color = '#f87171';
  } else if (deadCount >= 1 || warnCount >= 2) {
    banner.innerHTML = '일부 데이터 소스(' + deadCount + '개 실패, ' + warnCount + '개 불안정)가 응답하지 않습니다. 해당 항목은 마지막 수신 데이터를 표시합니다.' +
      (deadCount >= 1 ? ' <button id="btn-retry-all-apis" onclick="_retryAllFailedApis()" style="' +
      'background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.4);color:#fbbf24;' +
      'font-size:9px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:8px;font-weight:600;' +
      'font-family:var(--font-mono);transition:all 0.2s;"> 재연결</button>' : '');
    banner.style.display = 'block';
    banner.style.background = 'rgba(234,179,8,0.12)';
    banner.style.borderColor = 'rgba(234,179,8,0.3)';
    banner.style.color = '#fbbf24';
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
      localStorage.setItem('aio_vault_salt', btoa(String.fromCharCode.apply(null, this._salt)));
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
  }).catch(function() {
    // 폴백: 평문 저장 + 런타임 캐시 동기화
    localStorage.setItem(lsKey, val);
    if (_AioVault && _AioVault._keyRuntime) { if (val) _AioVault._keyRuntime[lsKey] = val; else delete _AioVault._keyRuntime[lsKey]; }
    btnEl.textContent = '✓';
    setTimeout(function(){ btnEl.textContent = '저장'; }, T.UI_FEEDBACK);
  });
}

// v30.11: PIN 설정/해제 UI 핸들러
function _vaultSetPin() {
  var pin1 = document.getElementById('vault-pin-input');
  var pin2 = document.getElementById('vault-pin-confirm');
  var msg  = document.getElementById('vault-pin-msg');
  if (!pin1 || !pin2) return;
  var v1 = pin1.value.trim(), v2 = pin2.value.trim();
  if (v1.length < 4) { msg.textContent = 'PIN은 4자리 이상'; msg.style.color = '#f87171'; return; }
  if (v1 !== v2) { msg.textContent = 'PIN이 일치하지 않습니다'; msg.style.color = '#f87171'; return; }
  msg.textContent = '암호화 중…'; msg.style.color = '#60a5fa';
  _AioVault.unlock(v1).then(function() {
    return _migrateToEncrypted();
  }).then(function() {
    msg.textContent = '암호화 완료! API 키가 보호됩니다.'; msg.style.color = '#34d399';
    pin1.value = ''; pin2.value = '';
    _updateVaultStatus();
  }).catch(function(e) {
    msg.textContent = '오류: ' + e.message; msg.style.color = '#f87171';
  });
}

function _vaultUnlock() {
  var pin = document.getElementById('vault-unlock-input');
  var msg = document.getElementById('vault-unlock-msg');
  if (!pin) return;
  var v = pin.value.trim();
  if (!v) { msg.textContent = 'PIN을 입력하세요'; msg.style.color = '#f87171'; return; }
  msg.textContent = '잠금 해제 중…'; msg.style.color = '#60a5fa';
  _AioVault.unlock(v).then(function() {
    // 복호화된 키를 input 필드에 복원
    return _restoreDecryptedKeys();
  }).then(function() {
    msg.textContent = '잠금 해제됨'; msg.style.color = '#34d399';
    pin.value = '';
    _updateVaultStatus();
  }).catch(function(e) {
    msg.textContent = 'PIN이 올바르지 않습니다'; msg.style.color = '#f87171';
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
    badge.textContent = ' 미설정'; badge.style.color = '#94a3b8';
    if (setPanel) setPanel.style.display = 'block';
    if (unlockPanel) unlockPanel.style.display = 'none';
  } else if (isUnlocked) {
    badge.textContent = ' 활성'; badge.style.color = '#34d399';
    if (setPanel) setPanel.style.display = 'none';
    if (unlockPanel) unlockPanel.style.display = 'none';
  } else {
    badge.textContent = ' 잠금'; badge.style.color = '#f59e0b';
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
  _data: {},        // sym → { price, pct, source, ts, stale }
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
    if (typeof pct !== 'number' || isNaN(pct)) pct = 0;
    const age = Date.now() - this._sessionStart;
    if (this._prev[sym] && age > 180000) {
      const jump = Math.abs(price - this._prev[sym]) / this._prev[sym];
      if (jump > 0.5) {
        this._reject(sym, price, source, 'price_jump', `${(jump*100).toFixed(1)}% 급변 (이전: ${this._prev[sym]})`);
        return false;
      }
    }
    this._data[sym] = { price, pct, source: source || 'unknown', ts: Date.now(), stale: false };
    this._prev[sym] = price;
    this._stats.accepted++;
    window._liveData = window._liveData || {};
    window._liveData[sym] = { price, pct };
    window._quoteTimestamps = window._quoteTimestamps || {};
    window._quoteTimestamps[sym] = Date.now();
    window._dataSource = window._dataSource || {};
    window._dataSource[sym] = { source: source || 'live:yahoo', ts: Date.now() };
    return true;
  },
  get(sym) {
    const d = this._data[sym];
    if (!d) return null;
    d.stale = (Date.now() - d.ts) > 300000;
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
      if ((now - d.ts) > 300000) { stale++; d.stale = true; } else fresh++;
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
    this._data[id] = { value: val, prevValue: prev, date, ts: Date.now(), dataAgeDays: dataAge, stale: false };
    this._stats.accepted++;
    window._fredData = window._fredData || {};
    window._fredData[id] = { value: val, prevValue: prev, date };
    return true;
  },
  get(id) { const d = this._data[id]; if (!d) return null; d.stale = (Date.now() - d.ts) > 7200000; return d; },
  _reject(id, value, reason, detail) {
    this._stats.rejected++;
    if (this._rejected.length >= 30) this._rejected.shift();
    this._rejected.push({ id, value, reason, detail, ts: Date.now() });
    _aioLog('warn', 'macro', '거부: ' + id + ' = ' + value + ' (' + reason + ': ' + detail + ')');
  },
  health() {
    const now = Date.now();
    let total = 0, stale = 0, fresh = 0;
    for (const [id, d] of Object.entries(this._data)) { total++; if ((now - d.ts) > 7200000) { stale++; d.stale = true; } else fresh++; }
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
      var bgColor = theme === 'dark' ? '#0d1117' : '#ffffff';
      var textColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : '#333';
      var gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

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
        color: options.color || '#60a5fa',
        lineWidth: options.lineWidth || 2,
        priceFormat: options.priceFormat || { type: 'price', precision: 2, minMove: 0.01 }
      });
      if (Array.isArray(data) && data.length > 0) {
        series.setData(data);
      }
      // 뷰포트 resize 자동 대응
      var _ro = null;
      if (typeof ResizeObserver !== 'undefined') {
        _ro = new ResizeObserver(function(entries) {
          for (var i = 0; i < entries.length; i++) {
            var cr = entries[i].contentRect;
            if (cr.width > 0) chart.resize(cr.width, options.height || 200);
          }
        });
        _ro.observe(container);
      }
      return {
        chart: chart,
        series: series,
        setData: function(d) { series.setData(d); },
        update: function(point) { series.update(point); },
        destroy: function() {
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
      var bgColor = '#0d1117';
      var gridColor = 'rgba(255,255,255,0.05)';
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
        var s = chart.addLineSeries({ color: cfg.color || '#60a5fa', lineWidth: cfg.lineWidth || 2, title: cfg.name });
        if (Array.isArray(cfg.data)) s.setData(cfg.data);
        seriesList.push(s);
      }
      var _ro = null;
      if (typeof ResizeObserver !== 'undefined') {
        _ro = new ResizeObserver(function(entries) {
          for (var j = 0; j < entries.length; j++) {
            var cr = entries[j].contentRect;
            if (cr.width > 0) chart.resize(cr.width, options.height || 200);
          }
        });
        _ro.observe(container);
      }
      return {
        chart: chart, series: seriesList,
        destroy: function() { try { if (_ro) _ro.disconnect(); } catch(_){}
                              try { chart.remove(); } catch(_){} }
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

// ═══════════════════════════════════════════════════════════════════
// APP_VERSION — 버전 단일 진실 원천 (이 값만 바꾸면 title + 배지 자동 반영)
// ─────────────────────────────────────────────────────────────────
const APP_VERSION = 'v48.30';
window.AIO.version = APP_VERSION;

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
// DATA_SNAPSHOT — 단일 진실 원천 (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────
//  데이터 업데이트 시 이 객체만 수정하면 전체 페이지에 반영됩니다.
//    HTML 본문에 직접 숫자를 수정하지 마세요!
// ─────────────────────────────────────────────────────────────────
const DATA_SNAPSHOT = {
  _updated: '2026-04-16T15:20:00+09:00',   // ISO 타임스탬프 — v47.4 /data-refresh 재검증: v47.3 "위험봇 3/30 이미지 값(VVIX 98/MOVE 68/SKEW 139)을 4/15로 오기재" 버그 P106 수정 + CNN F&G 중립 전환 분리(47) + UW F&G 68 별도 필드 + WTI/HY OAS 소량 정정
  // 아래 날짜들은 정적 폴백값입니다. 실시간 데이터 수신 시 자동 교체됩니다.
  _note: 'v47.4 — /data-refresh 재검증 (사용자 지적 후): v47.2-v47.3 핵심 버그 P106 수정 — 위험봇 3/30 이미지 값(VVIX 98/MOVE 68/SKEW 139)을 4/15 DATA_SNAPSHOT에 오기재. 4/15 실측: VVIX 90.10(-2.77%)/MOVE 62.36(-2.50%)/SKEW 141.86(-4.60%) → 꼬리위험 역설 **심화**(MOVE↓ SKEW↑) = 분배 진단 강화. CNN F&G 47 Neutral 전환(UW F&G 68 탐욕은 유지, fg_uw로 분리). WTI 91.62→91.29 정정. HY OAS 282→284bp. 주가지수/환율은 v47.3 확인 일치(SPX 7022.95 ATH, NASDAQ 24016 ATH, KOSPI 6091, VIX 18.36, DXY 98.05)',

  // ── 미국 주요 지수 (4/15 화 종가 실측) ──
  spx:        7022.95,  spxPct:    +0.80,   // v47.3: 역사상 최초 7000 돌파, 10/11 상승 세션
  nasdaq:    24016.02,  nasdaqPct: +1.59,   // v47.3: 11일 연속 상승 ATH
  dow:       48463.72,  dowPct:    -0.15,   // v47.3: 소폭 조정 (Caterpillar -3.62% 등)
  rut:        2710.00,  rutPct:    +1.30,
  vix:          18.36,  vixPct:    -3.97,   // v47.3: 4/15 VIX 18.36 유지 (이란 휴전 연장 관측)
  vvix:         90.10,                        // v47.4: VVIX 4/15 실제 종가 90.10 (-2.77%) — v47.3은 3/30 스냅샷값(98) 오기재

  // ── 한국 지수 (4/15 종가 실측) ── v47.3 반영
  kospi:     6091.39,  kospiPct:  +2.07,  kospiPrev: 5968.31,  // v47.3: 6000 재돌파 (4/15 close)
  kosdaq:    1215.00,  kosdaqPct: +2.10,  kosdaqPrev: 1190.00, // v47.3: KOSDAQ 동반 강세 추정

  // ── 원자재 (4/15 종가 — 이란 휴전 연장 관측) ──
  wti:      91.29,   wtiPct:   +0.04,   // v47.4: WTI $91.29 (4/15 close, TradingEconomics — v47.3 오기재 91.62 → 91.29 정정)
  brent:    95.00,   brentPct: +0.22,   // v47.3: Brent $95 near
  gold:   4826,      goldPct:   +0.08,  goldWeeklyPct: +1.8,  // v47.3: Gold $4,826 (USAGOLD 4/15)
  ng:       3.00,

  // ── 환율 (4/15) ──
  krw:      1473.00,  krwPct:   -0.80,  krwRound: 1473,  // v47.3: KRW 강세 (KOSPI 6000 돌파 동반)
  dxy:        98.05,  dxyPct:   -0.08,                   // v47.3: DXY 98.05 (TradingEconomics 4/15)

  // ── 금리·통화정책 ──
  fedRate:     '3.50-3.75',
  fedStatus:   '동결',  // v45.6: 동적화 — Fed 금리 변경 시 이 값 갱신 (인하/인상/동결)
  fomc:        '4/28-29',
  fomcNext:    '4/28-29',                    // v46.9: 다음 FOMC는 4/28-29 (비SEP 회의)
  ecbRate:      2.15,  ecbStatus: '동결',
  bojRate:      0.50,
  boeRate:      4.50,
  pbocRate:     3.10,
  // v34.6: 한국 금리·채권 강화
  bokRate:      2.50,   bokStatus: '동결',       // 한은 기준금리 (2025.05 인하 후 2.50% → 2026.03까지 7연속 동결)
  bokNext:     '2026-05-29',                     // 다음 금통위 일정
  krBond3y:     2.82,   krBond10y: 3.72,         // 국고채 3년/10년 수익률 (<span data-date-ref="kr-last-basis">기준</span>, 10Y 월중 최고)
  krCd91:       2.78,                             // CD 91일 금리
  vkospi:      20.50,                             // v47.3: VKOSPI 20.5 (KOSPI 6000 재돌파로 추가 하락 추정), 20↑=경계 30↑=공포

  // ── 거시 지표 ──
  cpi:          2.4,   coreCpi:   2.5,
  pce:          2.7,   corePce:   2.7,            // PCE Core YoY — v46.3: Fed 3월 전망 상향 (2.4/2.5→2.7/2.7)
  ismPmi:      52.4,   ismPrice:  70.7,   // v45.2: 4/6 ISM 실데이터 70.7% (2022년 10월 이후 최고)
  ismSvc:      54.0,                              // ISM 서비스업 PMI (3월, 4/3 발표)
  usUnemploy:   4.30,  // 3월 NFP: +228K(컨센 135K 상회), 실업률 4.3% (4/3 발표)
  usWageGrowth: 3.5,                              // 시간당 평균 임금 YoY 3.5% (4/3 NFP)
  retailSales:  0.6,                              // 소매판매 MoM (소비 체력)
  consConf:    104.7,                              // 미시간 소비자심리 (100↑=낙관)
  housingStarts:1.42,                             // 주택착공 (백만건, 연환산)
  krUnemploy:   3.4,
  // v34.6: 한국 거시 지표 강화
  krCpi:        2.1,                              // 한국 CPI YoY (2026.02 기준, BOK 전망 2.1%)
  krGdp:       -0.2,   krGdpYoy:  1.8,           // 한국 GDP QoQ / YoY (BOK 2026 성장률 전망 1.8%)
  krExport:    +28.7,   krExportStreak: 13,       // 2월 수출 +28.7% YoY (673억$), 13개월 연속 흑자
  krSemiExport:+157.9,                            // 2월 반도체 수출 +157.9% YoY (역대 최대)
  kospiPE:      9.8,    kospiPB:   0.92,          // KOSPI PER/PBR
  kosdaqPE:    32.5,                              // KOSDAQ PER
  krShortSell:  4.1,                              // 공매도 비중(%)
  krForeignNet:-17939,                            // 외국인 순매수 (억원, 4/3 — 연속 순매도)

  // ── 글로벌 지수 (GMO 테이블용, 4/15 종가) ──
  nikkei:    57816,    nikkeiPct:  +2.32,
  hangseng:  25947,    hangsengPct: +0.29,
  shanghai:   3420,    shanghaiPct: +1.20,
  dax:       23200,    daxPct:     +1.80,
  ftse:      10611,    ftsePct:    +0.01,
  cac:        7950,    cacPct:     +1.50,

  // ── 크립토·추가 원자재 (4/15 종가) ──
  btc:       74286,    btcPct:    -0.21,   // v47.3: BTC $74,286 (4/15 close, 횡보 조정 — $76K 돌파 실패 후)
  eth:        2368,    ethPct:    -0.30,   // v47.3: ETH 소폭 조정
  silver:     71.50,   silverPct: +2.64,

  // ── 리스크 지표 ──
  move:        62.36,   moveChg: -2.50,  // v47.4: MOVE 4/15 실제 62.36 — v47.3은 잔존 115.0 오류 (채권 변동성 극단 저점 유지, 꼬리위험 역설 심화)
  skew:       141.86,   skewChg: -4.60,  // v47.4: SKEW 4/15 실제 141.86 (-4.60%) — v47.3은 3/30 스냅샷값 139 오기재. 꼬리위험 고점 지속
  vvix_live:   90.10,   vvixChg: -2.77,  // v47.4: VVIX 4/15 실제 90.10 (-2.77%) — 위와 vvix 필드 동일
  fg:            47,   fgLabel: '중립',  // v47.4: CNN F&G 4/15 실측 47 Neutral (WebSearch feargreedmeter 교차검증) — v47.1의 68 탐욕은 UW 확장 F&G였음. CNN은 Neutral 전환. UW F&G 68은 fg_uw 별도 필드로 분리
  fg_uw:         68,   fg_uwLabel: '탐욕', // v47.4: Unusual Whales 확장 F&G 4/15 68 (v47.2 카테고리별 분해와 동기화)

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

  // ── KR 섹터 ETF (4/3 종가) ──
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
    fg: 47,              // v47.4: CNN F&G Neutral 47 (4/15 실측) — v47.3의 68은 UW F&G 였음(오기재)
    fg_uw: 68,           // v47.4 신설: Unusual Whales 확장 F&G 68 탐욕 (4/16 KST 04:36 실측)
    vix: 18,             // VIX (4/15: 18.36)
    breadth200: 75,      // 20SMA Above % (bpSPX20 마지막 값과 동기화)
    breadth5: 68,        // 5SMA Above %
    breadth50: 46,       // 50SMA Above %
    pcr: 0.72,           // Put/Call Ratio
    aaiiBear: 43,        // AAII Bearish % (4/10 발표: 43.0%)
    spx50ma: 6820,       // v47.4: SPX 50일 이동평균 (4/15 기준 근사)
    spx200ma: 6720,      // v47.4: SPX 200일 이동평균 (4/15 기준 근사)
    spxATH: 7022,        // v47.4: SPX 사상 최고가 (4/15 종가 7022.95 — ATH 경신)
    dxy: 98,             // v47.4: 달러 인덱스 (4/15: 98.05)
    tnx: 4.3,            // 10년 금리
    hyg: 80,             // HYG ETF 가격 (신용 스프레드 완화)
    vvix: 90,            // v47.4: VVIX (4/15 실측 90.10, v47.3 오기재 95 정정)
    move: 62,            // v47.4 신설: MOVE 4/15 실측 62.36 (채권 변동성 극단 저점)
    skew: 142,           // v47.4 신설: SKEW 4/15 실측 141.86 (꼬리헤지 고점)
    _syncDate: '2026-04-15'  // v47.4: 마지막 동기화 날짜
  }
};

// 편의 포맷터 (안전한 숫자 포맷 — undefined/NaN 방어)
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
    if (v >= 150) return { level:'extreme',  label:'극단 꼬리헤지 비쌈', color:'#f87171', bar:95 };
    if (v >= 140) return { level:'high',     label:'꼬리위험 고점',       color:'#f87171', bar:85 };
    if (v >= 130) return { level:'elevated', label:'꼬리헤지 비쌈',       color:'#fbbf24', bar:70 };
    if (v >= 120) return { level:'normal',   label:'정상 상단',           color:'#fbbf24', bar:50 };
    return            { level:'low',      label:'정상',                color:'#3ddba5', bar:30 };
  }
  function getMOVERegime(v) {
    v = _snap.num(v, FB.move);
    if (v >= 200) return { level:'crisis',    label:'위기 수준',        color:'#f87171', bar:95 };
    if (v >= 150) return { level:'stress',    label:'스트레스',          color:'#f87171', bar:80 };
    if (v >= 100) return { level:'normal',    label:'정상',              color:'#fbbf24', bar:55 };
    if (v >= 75)  return { level:'calm',      label:'저점(정상화 리스크)', color:'#3ddba5', bar:35 };
    return            { level:'extreme_low', label:'극단 저점',         color:'#3ddba5', bar:20 };
  }
  function getVVIXRegime(v) {
    v = _snap.num(v, FB.vvix);
    if (v >= 140) return { level:'extreme', label:'옵션 변동성 극단', color:'#f87171', bar:95 };
    if (v >= 110) return { level:'warn',    label:'경고',             color:'#fbbf24', bar:75 };
    if (v >= 90)  return { level:'normal',  label:'정상 상단',         color:'#fbbf24', bar:60 };
    return            { level:'low',     label:'정상',             color:'#3ddba5', bar:40 };
  }
  function getFGRegime(v) {
    v = _snap.num(v, FB.fg);
    if (v >= 75) return { level:'extreme_greed', label:'극단 탐욕', color:'#f87171', bar:90 };
    if (v >= 55) return { level:'greed',         label:'탐욕',      color:'#fbbf24', bar:70 };
    if (v >= 45) return { level:'neutral',       label:'중립',      color:'#fbbf24', bar:50 };
    if (v >= 25) return { level:'fear',          label:'공포',      color:'#3ddba5', bar:30 };
    return          { level:'extreme_fear',  label:'극단 공포', color:'#3ddba5', bar:10 };
  }
  function getBreadthRegime(v) {
    v = _snap.num(v);
    if (v >= 70) return { level:'broad',   label:'광폭 랠리',     color:'#3ddba5' };
    if (v >= 55) return { level:'healthy', label:'건강',          color:'#fbbf24' };
    if (v >= 40) return { level:'narrow',  label:'좁은 랠리',     color:'#fbbf24' };
    return          { level:'fearful', label:'공포 영역',     color:'#f87171' };
  }
  function getInsiderRegime(v) {
    v = _snap.num(v);
    if (v <= 5)  return { level:'extreme_fear', label:'극단 공포(매도 일변도)', color:'#f87171' };
    if (v <= 20) return { level:'fear',         label:'공포',                  color:'#fbbf24' };
    if (v <= 50) return { level:'neutral',      label:'중립',                  color:'#fbbf24' };
    return          { level:'buying',       label:'매수 우위',             color:'#3ddba5' };
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
      '분배 체크리스트 <b style="color:' + (diag.confirmed ? '#f87171' : '#fbbf24') + ';">' +
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
      '세금 시즌(4/15) 일시 축소→환류 · 베센트(소로스 출신) 발행 전략 조절 가능 · 중간선거 7개월 전 = 정치적 유동성 인센티브'
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
    if (st) { st.textContent = regime.label; st.style.color = regime.color; st.style.background = `rgba(${regime.color==='#f87171'?'248,113,113':regime.color==='#3ddba5'?'61,219,165':'251,191,36'},0.1)`; }
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

  function _dateStr(d) {
    var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function isKrTradingDay(d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    return KR_HOLIDAYS_2026.indexOf(_dateStr(d)) === -1;
  }

  function isUsTradingDay(d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    return US_HOLIDAYS_2026.indexOf(_dateStr(d)) === -1;
  }

  // 가장 최근 거래일 (오늘 포함 가능 여부: 장시간 기준)
  function lastKrTradingDay() {
    var kst = nowKST();
    var d = new Date(kst);
    // 장 마감 전(15:30 이전)이면 전 거래일, 이후면 오늘
    var time = d.getHours() * 60 + d.getMinutes();
    if (time < 930 || !isKrTradingDay(d)) { // 15:30 = 930분, 또는 비거래일
      d.setDate(d.getDate() - 1);
    }
    // 거래일 찾을 때까지 역추적 (최대 10일)
    for (var i = 0; i < 10; i++) {
      if (isKrTradingDay(d)) return d;
      d.setDate(d.getDate() - 1);
    }
    return d;
  }

  function lastUsTradingDay() {
    var now = new Date();
    var d = new Date(now);
    // EST 기준 16:00 이전이면 전일
    var est = new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 5 * 3600000);
    var time = est.getHours() * 60 + est.getMinutes();
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
if (window._dateEngineInterval) clearInterval(window._dateEngineInterval);
window._dateEngineInterval = setInterval(function() { try { DATE_ENGINE.applyToDOM(); } catch(e) {} }, T.DATE_REFRESH);

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
      'vkospi':        _snap.fixed(S.vkospi, 2),
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
      'kr-manuf-pmi':  _snap.fixed(S.krPmi, 1),
      'kr-gdp-qoq':    (S.krGdp > 0 ? '+' : '') + _snap.fixed(S.krGdp, 1) + '%',
      'kr-bond-3y':    _snap.fixed(S.krBond3y, 2) + '%',
    };
    document.querySelectorAll('[data-snap]').forEach(el => {
      const key = el.getAttribute('data-snap');
      if (key && map[key] !== undefined) {
        el.textContent = String(map[key]);
      }
    });

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
            skewStatus.style.background = sreg.color === '#f87171' ? 'rgba(248,113,113,0.1)' :
                                           sreg.color === '#fbbf24' ? 'rgba(251,191,36,0.1)' : 'rgba(61,219,165,0.1)';
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
            staleEl.style.color = '#3ddba5';
          } else if (days === 1) {
            staleEl.textContent = '1일 경과';
            staleEl.style.color = '#fbbf24';
          } else {
            staleEl.textContent = days + '일 경과';
            staleEl.style.color = days > 7 ? '#f87171' : (days > 3 ? '#fbbf24' : '#60a5fa');
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
      'VKOSPI': { price: S.vkospi, pct: 0 },
    };
    window._liveData = window._liveData || {};
    for (const [sym, val] of Object.entries(snapSymMap)) {
      if (val.price != null && !window._dataSource[sym]) {
        // 실시간 데이터가 아직 없는 심볼만 seed
        window._liveData[sym] = window._liveData[sym] || { price: val.price, pct: val.pct != null ? val.pct : 0 };
        window._dataSource[sym] = { source: 'snapshot', ts: snapTs };
      }
    }

    // v34.2: Staleness 경고 — 스냅샷 기준이지만 실시간 데이터가 들어오면 자동 해제
    // 개선: 고정 12초 타이머 → 반복 폴링 + 이벤트 리스너로 확실히 해제
    const updated = S._updated ? new Date(S._updated).getTime() : 0;
    const age = updated ? (Date.now() - updated) : Infinity;
    const staleEl = document.getElementById('snapshot-stale-warning');
    if (staleEl) {
      if (!isNaN(age) && age > 24 * 60 * 60 * 1000) {
        const hrs = Math.floor(age / 3600000);
        staleEl.textContent = '스냅샷 기준 ' + hrs + '시간 전. 실시간 데이터 수신 시 자동 갱신됩니다.';
        staleEl.style.display = 'block';

        // 실시간 데이터 수신 감지 — 반복 체크 (5초 간격, 최대 2분)
        // v48.14 (Agent W11): 2분 폴링 루프 제거 — 순수 이벤트 구독으로 전환
        // aio:liveDataReceived + aio:liveQuotes 둘 다 구독해서 stale 해제
        // 첫 로드 후 45초 내 아무 이벤트 없으면 마지막 1회 확인 (만약 이벤트 누락)
        var _onStaleLiveFire = function() {
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
  '^TNX':     { price: () => 4.31 },
  '^FVX':     { price: () => 4.08 },
  '^TYX':     { price: () => 4.96 },
  '^IRX':     { price: () => 3.62 },
  'DX-Y.NYB': { price: () => DATA_SNAPSHOT.dxy },
  'CL=F':     { price: () => DATA_SNAPSHOT.wti },
  'BZ=F':     { price: () => DATA_SNAPSHOT.brent },
  'GC=F':     { price: () => DATA_SNAPSHOT.gold },
  'KRW=X':    { price: () => DATA_SNAPSHOT.krw },
  'HYG':      { price: () => 78.92 },
  'SPY':      { price: () => 648.57, pct: () => DATA_SNAPSHOT.spxPct },
  // v36.6: 지수 선물 + VIX 선물 ETF + VVIX
  'ES=F':     { price: () => DATA_SNAPSHOT.spx },
  'NQ=F':     { price: () => DATA_SNAPSHOT.nasdaq },
  'YM=F':     { price: () => DATA_SNAPSHOT.dow },
  '^VVIX':    { price: () => DATA_SNAPSHOT.vvix || 135 },
  'VXX':      { price: () => 45.0 },
  'UVXY':     { price: () => 28.0 },
  '^KS11':    { price: () => DATA_SNAPSHOT.kospi || 2500 },
  '^KQ11':    { price: () => DATA_SNAPSHOT.kosdaq || 700 },
  'BTC-USD':  { price: () => DATA_SNAPSHOT.btc || 85000 },
  // v46.9: 홈 화면/시그널 표시 종목 폴백 확장 (M19)
  '^DJI':     { price: () => DATA_SNAPSHOT.dow,    pct: () => DATA_SNAPSHOT.dowPct },
  '^IXIC':    { price: () => DATA_SNAPSHOT.nasdaq,  pct: () => DATA_SNAPSHOT.nasdaqPct },
  '^RUT':     { price: () => DATA_SNAPSHOT.rut,     pct: () => DATA_SNAPSHOT.rutPct },
  'QQQ':      { price: () => (DATA_SNAPSHOT.nasdaq || 25448) / 40 },
  'ETH-USD':  { price: () => DATA_SNAPSHOT.eth || 2054 },
  'NG=F':     { price: () => DATA_SNAPSHOT.ng || 3.0 },
  'SI=F':     { price: () => DATA_SNAPSHOT.silver || 69.66 },
  'GLD':      { price: () => (DATA_SNAPSHOT.gold || 4750) / 10 },
  'TLT':      { price: () => 85.0 },
};
function _ldSafe(sym, prop, hardFallback) {
  var ld = window._liveData || {};
  if (ld[sym] && ld[sym][prop] != null) return ld[sym][prop];
  var sf = _SNAP_FALLBACK[sym];
  if (sf && sf[prop]) return sf[prop]();
  return hardFallback ?? 0;
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
let prevPage = 'home';

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
        if (hg) { hg.textContent = h.grade; hg.style.color = h.score >= 60 ? '#3ddba5' : h.score >= 40 ? '#fbbf24' : '#f87171'; }
        if (hr) hr.textContent = h.regime || '';
      } else {
        if (hd) hd.textContent = '대기';
        if (hg) { hg.textContent = '시세 수신 중…'; hg.style.color = 'var(--text-muted)'; }
      }
    } catch(e) {}
  }
  if (typeof updatePatternSignals === 'function') { try { updatePatternSignals(); } catch(e) {} }
  if (typeof updateTechIndicators === 'function') { try { updateTechIndicators(); } catch(e) {} }
  var tvTechC = document.getElementById('tv-widget-technical');
  if (tvTechC && !tvTechC.querySelector('iframe') && typeof loadTVChart === 'function') {
    try { loadTVChart('technical'); } catch(e) {}
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
          '뉴스 로딩 시간 초과 — 네트워크 상태를 확인하세요.<br>' +
          '<button onclick="_briefingCacheKey=null;isFetching=false;fetchAllNews(true)" style="background:rgba(91,168,255,0.1);border:1px solid rgba(91,168,255,0.2);color:#60a5fa;font-size:10px;padding:4px 12px;border-radius:5px;cursor:pointer;margin-top:8px;font-weight:600;">↻ 다시 시도</button>' +
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
    document.querySelectorAll('.nav-item').forEach(n=>{
      if(n.getAttribute('onclick') && n.getAttribute('onclick').includes("'"+id+"'")) { n.classList.add('active'); n.setAttribute('aria-current', 'page'); }
    });
  }
  const parts = breadcrumbMap[id] || ['AIO', id];
  setBreadcrumb(parts);
  // Browser history — enables native back/forward (skipped if sandboxed)
  try {
    if (history.state?.page !== id) {
      history.pushState({ page: id }, '', '#' + id);
    }
  } catch(e) { /* sandboxed iframe — history API not available */ }
  prevPage = id;
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

function showTheme(themeId) {
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
    if(n.getAttribute('onclick') && n.getAttribute('onclick').includes("'themes'")) n.classList.add('active');
    else n.classList.remove('active');
  });
  const bc=document.getElementById('breadcrumb');
  bc.innerHTML=`<span>AIO</span><span class="sep">/</span><span onclick="showPage('themes',null)" style="cursor:pointer;">테마</span><span class="sep">/</span><span class="current">${escHtml(t.name)}</span>`;
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
  if(prevPage === 'themes' || prevPage === 'theme-detail') {
    backBtn.textContent = '← 테마 분석';
    backBtn.setAttribute('onclick', "showPage('themes',null)");
    parentEl.textContent = '테마 분석';
    parentEl.setAttribute('onclick', "showPage('themes',null)");
  } else if(prevPage === 'fundamental') {
    backBtn.textContent = '← 펀더멘탈';
    backBtn.setAttribute('onclick', "showPage('fundamental',null)");
    parentEl.textContent = '펀더멘탈';
    parentEl.setAttribute('onclick', "showPage('fundamental',null)");
  } else {
    backBtn.textContent = '← 포트폴리오';
    backBtn.setAttribute('onclick', "showPage('portfolio',null)");
    parentEl.textContent = '포트폴리오';
    parentEl.setAttribute('onclick', "showPage('portfolio',null)");
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
    var color = pass >= total - 1 ? '#3ddba5' : pass >= total / 2 ? '#fbbf24' : '#f87171';
    var verdict = pass >= total - 1 ? '진입 검토 가능' : pass >= total / 2 ? '선별적 검토' : '진입 자제';

    var html = '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;display:flex;justify-content:space-between;">' +
      '<span>진입 적합성</span>' +
      '<span style="color:' + color + ';font-family:var(--font-mono);">' + pass + '/' + total + ' ' + verdict + '</span></div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    checks.forEach(function(c) {
      var icon = c.ok === true ? '' : c.ok === false ? '' : '—';
      var bg = c.ok === true ? 'rgba(61,219,165,0.08)' : c.ok === false ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)';
      html += '<div style="background:' + bg + ';border-radius:5px;padding:4px 8px;font-size:9px;display:flex;align-items:center;gap:4px;">' +
        '<span>' + icon + '</span><span style="font-weight:700;">' + c.label + '</span><span style="color:var(--text-muted);">' + c.note + '</span></div>';
    });
    html += '</div>';
    ecDiv.innerHTML = html;
  }

  showPage('ticker', null);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  switchTab(document.querySelector('#page-ticker .tab'), 'tab-overview');
  const bc=document.getElementById('breadcrumb');
  bc.innerHTML=`<span>AIO</span><span class="sep">/</span><span style="cursor:pointer;" onclick="${escHtml(parentEl.getAttribute('onclick'))}">${escHtml(parentEl.textContent)}</span><span class="sep">/</span><span class="current">${escHtml(tkr)}</span>`;
}

