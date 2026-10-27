// v59.20 (roadmap 11, layer 2 quality/evidence): every writer of the two data-status surfaces moved here unchanged, so
// one module owns #data-status-panel and #snapshot-stale-warning (AG-DOM-WRITER): showDataError, the source dashboard
// (_renderApiDashboard) and the stale-source banner (_checkAllDeadBanner) and AIO.updateSnapshotStaleBanner from
// js/aio-core.js, updateDataStatusError/updateDataStatus from js/aio-data.js, and the three inline writes that stay in
// their callers as calls: the snapshot-age warning of applyDataSnapshot (_aioApplySnapshotStaleWarning), the storage
// warning at boot (_aioShowStorageBlockedWarning) and the _aioLog error-surge notice (_aioShowErrorSurge). The inline
// span styles became the .dsp-msg classes in src/ui/styles/legacy-data.css with the same values.
// src/app/compatibility-globals.js installs this before DOMContentLoaded, as the classic definitions were.
export function installDataStatusSurface(window = globalThis, document = globalThis.document) {
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
      try {
        var refreshState = window.AIO && typeof window.AIO.getRefreshState === 'function' ? window.AIO.getRefreshState() : null;
        if (refreshState && refreshState.active && severity !== 'error') {
          _aioLog('warn', area, msg);
          return;
        }
      } catch(_) {}
      var icon = severity === 'error' ? '<span class="sd sd-r"></span>' : severity === 'info' ? '<span class="sd sd-g"></span>' : '<span class="sd sd-y"></span>';
      var tone = severity === 'error' ? 'error' : severity === 'info' ? 'info' : 'warn';
      panel.innerHTML = '<span class="dsp-msg dsp-msg--' + tone + '">' + icon + ' ' + escHtml(area) + ': ' + escHtml(msg) + '</span>';
      setTimeout(function() {
        if (panel.innerHTML.indexOf(msg) !== -1) {
          panel.innerHTML = '<span class="dsp-msg dsp-msg--muted">데이터 갱신 중...</span>';
        }
      }, ttl);
    }
    _aioLog('warn', area, msg);
  }

  var _lastDashRender = 0;
  function _renderApiDashboard() {
    try {
      var refreshState = window.AIO && typeof window.AIO.getRefreshState === 'function' ? window.AIO.getRefreshState() : null;
      if (refreshState && refreshState.active) return;
    } catch(_) {}
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
        '<button id="btn-retry-all-apis" data-action="_retryAllFailedApis" class="lco-retry lco-retry-dead"> 수동 재연결</button>';
      banner.style.display = 'block';
      banner.style.background = 'var(--red-4)';
      banner.style.borderColor = 'var(--red-6)';
      banner.style.color = 'var(--orange-11)';
    } else if (deadCount >= 1 || warnCount >= 2) {
      banner.innerHTML = '일부 데이터 소스(' + deadCount + '개 실패, ' + warnCount + '개 불안정)가 응답하지 않습니다. 해당 항목은 마지막 수신 데이터를 표시합니다.' +
        (deadCount >= 1 ? ' <button id="btn-retry-all-apis" data-action="_retryAllFailedApis" class="lco-retry lco-retry-warn"> 재연결</button>' : '');
      banner.style.display = 'block';
      banner.style.background = 'var(--gold-3)';
      banner.style.borderColor = 'var(--amber-6)';
      banner.style.color = 'var(--amber-11)';
    } else {
      banner.style.display = 'none';
    }
  }

  window.AIO.updateSnapshotStaleBanner = function() {
    var el = document.getElementById('snapshot-stale-warning');
    if (!el) return null;
    var snap = window.DATA_SNAPSHOT || {};
    var marketUpdated = snap._marketDataUpdated || snap._updated;
    var updatedTs = marketUpdated ? new Date(marketUpdated).getTime() : 0;
    if (!updatedTs || isNaN(updatedTs)) return null;
    var hrs = Math.floor((Date.now() - updatedTs) / 3600000);
    var marketDate = snap._marketDataDate || snap._snapshotDate || '날짜 확인 불가';
    var digestDate = snap._telegramDigestDate || (snap._telegramDigestUpdated ? String(snap._telegramDigestUpdated).slice(0, 10) : '날짜 확인 불가');
    if (hrs <= 24) {
      el.style.display = 'none';
      return { status: 'fresh', hours: hrs, marketDataDate: marketDate, telegramDigestDate: digestDate };
    }
    var currentness = window.AIO.getMarketCurrentnessAudit ? window.AIO.getMarketCurrentnessAudit() : null;
    var coreLiveOk = !!(currentness && currentness.coreLiveOk);
    var baseText = '시장 자료는 ' + marketDate + ' 기준(' + hrs + '시간 전), 뉴스·테마 요약은 ' + digestDate + ' 기준입니다. ';
    el.style.display = 'block';
    el.setAttribute('data-operational-use', 'reference-only');
    el.setAttribute('data-source-kind', 'snapshot');
    if (coreLiveOk) {
      el.textContent = baseText + '실시간 시세가 들어오고 있어 이 자료는 참고용입니다.';
      el.style.background = 'var(--green-3)';
      el.style.borderColor = 'var(--blue-6)';
      el.style.color = 'var(--data-cyan)';
    } else {
      el.textContent = baseText + '실시간 시세를 일부 받지 못해 화면 숫자가 이 기준일 값일 수 있습니다.';
      el.style.background = 'var(--red-3)';
      el.style.borderColor = 'var(--red-6)';
      el.style.color = 'var(--data-red)';
    }
    return { status: coreLiveOk ? 'reference-only' : 'warn', hours: hrs, coreLiveOk: coreLiveOk, marketDataDate: marketDate, telegramDigestDate: digestDate };
  };

  function updateDataStatusError(status, msg) {
    var panel = document.getElementById('data-status-panel');
    if (!panel) return;
    var colors = {ok:'#3dd68c', warn:'#ffa057', error:'#e5484d'};
    panel.style.color = colors[status] || 'var(--gold-11)';
    panel.innerHTML = (status === 'ok' ? '<span class="sd sd-g"></span>' : status === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-r"></span>') + ' ' + escHtml(msg);
  }

  function updateDataStatus() {
    try {
      if (window.AIO && typeof window.AIO.getRefreshState === 'function') {
        var refreshState = window.AIO.getRefreshState();
        if (refreshState && refreshState.active) return;
      }
    } catch(_) {}
    const el = document.getElementById('data-status-panel');
    if (!el) return;
    const now = Date.now();
    // v38.3: stale 감지 — 마지막 시세 갱신이 10분 이상 경과하면 경고
    const lastQuoteTs = window._quoteTimestamps ? Math.max(0, ...Object.values(window._quoteTimestamps)) : 0;
    const staleMin = lastQuoteTs > 0 ? Math.floor((now - lastQuoteTs) / 60000) : -1;

    // 프록시 stale 캐시 사용 중 표시
    const proxyStale = window._aioProxyStaleSince
      ? ', <span class="lda-st-stale">stale ' + (window._aioProxyStaleAgeMin || '?') + '분</span>'
      : '';

    // SW 버전 툴팁용 — 비동기 쿼리이므로 마지막으로 수신한 값 캐시
    const swVer = window._aioSWVersion || '';
    const titleExtra = swVer ? `, SW ${swVer}` : '';

    const appVer = (typeof APP_VERSION === 'string' ? APP_VERSION : (window.AIO && window.AIO.version) || '');
    const swMismatch = !!(swVer && appVer && swVer !== appVer);
    const swBadge = swMismatch
      ? ', <span class="lda-st-swbad">SW ' + escHtml(swVer) + '≠' + escHtml(appVer) + '</span>'
      : (swVer ? ', <span class="lda-st-sw">SW ' + escHtml(swVer) + '</span>' : '');
    if (swMismatch && window._aioSWMismatchLogged !== swVer + ':' + appVer) {
      window._aioSWMismatchLogged = swVer + ':' + appVer;
      if (typeof _aioLog === 'function') _aioLog('warn', 'sw', 'Service worker version mismatch: ' + swVer + ' vs app ' + appVer);
      if (typeof showDataError === 'function') showDataError('SW', 'service worker version mismatch - refresh will rotate cache', 'warn');
    }

    if (staleMin > 10) {
      el.innerHTML = `<span class="dsp-msg dsp-msg--late">시세 ${staleMin}분 전 갱신</span>${proxyStale}`;
      el.title = `마지막 시세 갱신: ${new Date(lastQuoteTs).toLocaleTimeString('ko-KR')} — ${staleMin}분 경과${titleExtra}`;
    } else if (staleMin >= 0) {
      const t = new Date(lastQuoteTs).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
      el.innerHTML = `<span class="dsp-msg dsp-msg--muted">시세 ${t} 갱신</span>${proxyStale}`;
      el.title = `정상 갱신 중${titleExtra}`;
    } else {
      el.innerHTML = `<span class="dsp-msg dsp-msg--muted">데이터 갱신 중...</span>${proxyStale}`;
      el.title = `연결 중${titleExtra}`;
    }
    if (swBadge) el.innerHTML += swBadge;
  }

  function _aioApplySnapshotStaleWarning(S) {
      // v34.2: Staleness 경고 — 스냅샷 기준이지만 실시간 데이터가 들어오면 자동 해제
      // 개선: 고정 12초 타이머 → 반복 폴링 + 이벤트 리스너로 확실히 해제
      const updated = (S._marketDataUpdated || S._updated) ? new Date(S._marketDataUpdated || S._updated).getTime() : 0;
      const age = updated ? (Date.now() - updated) : Infinity;
      const staleEl = document.getElementById('snapshot-stale-warning');
      if (staleEl) {
        if (updated && !isNaN(age) && age > 24 * 60 * 60 * 1000) { // v58.80 (first-users R2-29): no stamp read "Infinityh old"
          const hrs = Math.floor(age / 3600000);
          var mdDate = S._marketDataDate || S._snapshotDate || '날짜 확인 불가';
          var tgDate = S._telegramDigestDate || (S._telegramDigestUpdated ? String(S._telegramDigestUpdated).slice(0, 10) : '날짜 확인 불가');
          staleEl.textContent = '시장 자료는 ' + mdDate + ' 기준(' + hrs + '시간 전), 뉴스·테마 요약은 ' + tgDate + ' 기준입니다. 실시간 시세가 들어오면 자동으로 바뀝니다.';
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
  }

  function _aioShowStorageBlockedWarning() {
    var w = document.getElementById('snapshot-stale-warning');
    if (w) { w.textContent = '브라우저 저장이 차단되어 포트폴리오·설정이 저장되지 않습니다.'; w.style.display = 'block'; }
  }

  function _aioShowErrorSurge(sum, error, warn) {
    var panel = document.getElementById('data-status-panel');
    if (panel) {
      panel.innerHTML = '<span class="dsp-msg dsp-msg--surge">에러 급증 — 최근 1분 ' + sum + '건 (error ' + error + ', warn ' + warn + ')</span>';
    }
  }

  window.showDataError = showDataError;
  window._renderApiDashboard = _renderApiDashboard;
  window._checkAllDeadBanner = _checkAllDeadBanner;
  window.updateDataStatusError = updateDataStatusError;
  window.updateDataStatus = updateDataStatus;
  window._aioApplySnapshotStaleWarning = _aioApplySnapshotStaleWarning;
  window._aioShowStorageBlockedWarning = _aioShowStorageBlockedWarning;
  window._aioShowErrorSurge = _aioShowErrorSurge;
  return window;
}
