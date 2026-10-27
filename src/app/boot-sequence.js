// v59.36 (roadmap 11, layer 4 boot sequence): the master boot sequence moved out of js/aio-data.js unchanged —
// initV20DataEngine, which js/aio-ui.js calls on DOMContentLoaded: server data first, then the timed provider phases
// and the recurring scheduler. The boot-phase object (_aioBootPhase), newsCache and the server-ready lets it reads
// stay declared in the classic scripts; a module resolves those names in the shared global scope.
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installBootSequence(window = globalThis) {
  async function initV20DataEngine() {
    // The boot coordinator is the sole owner of the first live-data fetch.
    // Page-on-enter refreshes must not race it with a second provider fan-out.
    _aioBootPhase.quoteReady = false;
    // P858: translation is deliberately outside the 0-2s interactive boot
    // budget. Source-language/local fallback text remains visible until this
    // enrichment phase is released.
    _aioBootPhase.translationReady = false;
    console.log('[AIO v20] ═══════════════════════════════════════');
    console.log('[AIO v20] Data Engine v20 초기화 시작');
    // v50.23: 서버 데이터(data.json) 먼저 적용 — 프록시 실패와 무관하게 즉시 신선한 화면
    try { await _aioLoadServerData(); } catch(_) {}
    // v50.24/WO-4: 30분 주기 재로드 + 1분 나이 배지 갱신 시작 (boot-only 갭 해소)
    try { _aioStartServerDataPolling(); } catch(_) {}
    // v50.27/WO-7: 일별 히스토리 로드(차트 소비자 데이터 레이어, 충분히 누적 시 시드 대체)
    try { _aioLoadHistory(); } catch(_) {}
    try { _aioLoadOperatorNote(); } catch(_) {}
    console.log('[AIO v20] ═══════════════════════════════════════');

    cleanupProxyCache();

    // Phase 1: Immediate (0-2s) — Show cached/fallback data
    if (typeof applyStaticFallbacks === 'function') applyStaticFallbacks();

    // Phase 1b: IDB 캐시 뉴스 즉시 렌더 (fetchAllNews 완료 전 공백 제거)
    _idbLoadNews().then(function(cached) {
      if (cached && cached.length > 0 && newsCache.length === 0) {
        newsCache = cached;
        window._allNewsItems = cached;
        _aioNotifyNewsSurfaceInvalidated('news-idb-cache');
        if (typeof renderBriefingFeed === 'function') renderBriefingFeed(newsCache);
        if (typeof _aioUpdateNewsSummaryFromItems === 'function') _aioUpdateNewsSummaryFromItems(newsCache, { kind: 'idb-cache' });
        _aioLog('info', 'idb', 'IDB 캐시 뉴스 즉시 렌더: ' + cached.length + '건');
      }
    }).catch(function() {});

    // Phase 2: Fast APIs (2-5s) — CoinGecko, Exchange Rate, and live quote rescue.
    // P858: the previous 500ms timer contradicted this phase boundary and pushed
    // every provider into the boot request window. Keep snapshot/server data as
    // the first paint source, then start external quote work after the 2s boot
    // budget so request and long-task SLOs measure the actual interactive boot.
    _aioBootPhase.quoteReady = false;
    setTimeout(function() {
      _aioBootPhase.translationReady = true;
      _aioReleaseDeferredNewsTranslation();
    }, 2300);
    setTimeout(async () => {
      try {
        _aioBootPhase.quoteReady = true;
        var architectureReady = window.__AIO_ARCH_RUNTIME__ && window.__AIO_ARCH_RUNTIME__.ready;
        if (architectureReady && typeof architectureReady.then === 'function') {
          await Promise.race([
            architectureReady,
            new Promise(function(resolve) { setTimeout(resolve, 8000); })
          ]);
        }
        if (typeof fetchLiveQuotes === 'function') await fetchLiveQuotes();
      }
      catch(e) { showDataError('시세', '실시간 시세 수신 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-quote','Phase2 실패'); }
    }, 2500);

    // Phase 3: Sentiment APIs (3-8s)
    setTimeout(async () => {
      try {
        if (typeof fetchFearGreed === 'function') await fetchFearGreed();
        if (typeof fetchPutCall === 'function') await fetchPutCall();
        if(typeof _reportApiOk==='function') _reportApiOk('fear-greed','Phase3 성공');
        if(typeof window._markFetch==='function') { window._markFetch('sentiment'); window._markFetch('fearGreed'); window._markFetch('putCall'); }
      } catch(e) { showDataError('심리지표', '공포탐욕/풋콜 수신 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fear-greed','Phase3 실패'); }
    }, 3000);

    // Phase 4: Heavy APIs (5-15s) — FRED, Breadth, News
    setTimeout(async () => {
      try {
        var fredResult = _aioServerMacroReady ? { source: 'server-artifact' } : await fetchAllFredData();
        if (_aioServerMacroReady || (fredResult && Object.keys(fredResult).length > 0)) {
          if(typeof _reportApiOk==='function') _reportApiOk('fred','FRED 로딩 성공');
          if(typeof window._markFetch==='function') window._markFetch('fred');
        } else {
          if(typeof _reportApiError==='function') _reportApiError('fred','FRED fallback/no key');
        }
      }
      catch(e) { showDataError('FRED', 'FRED 거시 데이터 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fred','FRED 실패'); }
      try {
        if (!_aioServerHyReady && typeof fetchHYSpread === 'function') await fetchHYSpread();
      } catch(e) { showDataError('HY OAS', 'HY 스프레드 수신 실패', 'warn'); }
      try { await fetchBreadthData(); if(typeof window._markFetch==='function') window._markFetch('breadth'); }
      catch(e) { showDataError('시장폭', 'Breadth 데이터 수신 실패', 'warn'); }
      try { await fetchSentimentHistory(); if(typeof _reportApiOk==='function') _reportApiOk('yahoo-chart','VIX 차트 성공'); if(typeof window._markFetch==='function') window._markFetch('vixHistory'); }
      catch(e) { showDataError('VIX', 'VIX 히스토리 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-chart','VIX 차트 실패'); }
    }, 5000);

    // Phase 5: News & Content (8-20s)
    setTimeout(async () => {
      try { if (typeof fetchAllNews === 'function') await fetchAllNews(false); if(typeof _reportApiOk==='function') _reportApiOk('rss-news','뉴스 로딩 성공'); if(typeof window._markFetch==='function') window._markFetch('news'); }
      catch(e) { showDataError('뉴스', '뉴스 피드 수신 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('rss-news','뉴스 실패'); }
    }, 8000);

    // Phase 7: Start recurring scheduler
    setTimeout(() => { startDataScheduler(); }, 15000);

    // Phase 8: Data Health report (after all phases settle)
    setTimeout(() => {
      if (window.DataHealth) {
        console.log('[AIO] ═══ Data Pipeline Health Report ═══');
        DataHealth.log();
      }
    }, 20000);
  }

  window.initV20DataEngine = initV20DataEngine;
  return window;
}
