// v59.33 (roadmap 11, layer 4 boot sequence): the data refresh scheduler moved out of js/aio-data.js unchanged — the
// task table (REFRESH_SCHEDULE) and its timers, the page on-enter refresh with its page map, the visibility pause and
// resume, and AIO.runScheduledRefresh with its audits. The scheduler state (_schedulerPaused, _lastVisibleTime) stays
// in this one scope with every function that reads it. Top-level functions and vars stay window globals as they were
// in the classic script; src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installRefreshScheduler(window = globalThis) {
  // ═══ 9. 데이터 갱신 스케줄러 (중앙 관리) ═══════════════════════
  // v21: 5명 동시 접속 기준 rate limit 안전 간격
  // ────────────────────────────────────────────────────
  // API별 한도 분석 (5명 기준):
  //   rss2json    : 10,000/일 → 소스50 × 갱신횟수 × 5명 → 45분 간격이면 ~5,300/일 (안전)
  //   Finnhub     : 60/분     → 시세 1콜 × 5명 = 5/분 (여유)
  //   NewsData.io : 200/일    → 갱신당 1콜 × 5명 → 45분이면 ~160/일 (안전)
  //   Twelve Data : 8/분      → 1콜 × 5명 = 5/분 (여유, 단 동시 호출 피해야)
  //   FRED        : 120/일    → 2시간 간격 × 5명 = ~60/일 (안전)
  //   Claude(번역) : 유료      → 45분 간격이면 일 ~80콜 × 5명 = 비용 감소
  //   Yahoo(프록시): 무제한    → 프록시 부하만 주의
  //   CoinGecko   : 10~30/분  → 60초 간격 × 5명 = 5/분 (안전)
  // ────────────────────────────────────────────────────
  const REFRESH_SCHEDULE = {
    quotes:     { fn: null, interval: 180000,     label: '시세 (3분)',          timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    news:       { fn: null, interval: 2700000,    label: '뉴스 (45분)',          timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    sentiment:  { fn: null, interval: 600000,     label: '센티먼트 (10분)',       timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    breadth:    { fn: null, interval: 600000,     label: '시장 폭 (10분)',        timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    fred:       { fn: null, interval: 7200000,    label: 'FRED (2시간)',         timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    technicals: { fn: null, interval: 900000,     label: '기술 지표 (15분)',      timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    vixHistory: { fn: null, interval: 1800000,    label: 'VIX 히스토리 (30분)',   timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    hySpread:   { fn: null, interval: 21600000,   label: 'HY 스프레드 (6시간)',   timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    maUpdate:   { fn: null, interval: 21600000,   label: 'MA 갱신 (6시간)',       timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
    krDynamic:  { fn: null, interval: 1800000,    label: 'KR 동적 (30분)',        timer: null, _inFlight: false, _lastOk: 0, _lastErr: '' },
  };

  // v30.11: Page Visibility API — 백그라운드 탭 타이머 절약
  window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
  _normalizeRefreshSchedule();

  let _schedulerPaused = false;
  let _lastVisibleTime = Date.now();

  function _aioRefreshTaskLabel(key, cfg) {
    return (cfg && cfg.label) || key;
  }

  function _aioEmitRefreshEvent(type, detail) {
    try {
      window.AIO = window.AIO || {};
      var state = Object.assign({
        type: type,
        active: type !== 'done',
        generatedAt: new Date().toISOString()
      }, detail || {});
      window.AIO.refreshState = state;
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('aio:refresh:' + type, { detail: state }));
        window.dispatchEvent(new CustomEvent('aio:refresh', { detail: state }));
      }
    } catch (_) {}
  }

  function _aioMarkSchedulerFetch(key, result) {
    if (result && result.updated === false) return;
    if (typeof window._markFetch !== 'function') return;
    var map = {
      quotes: 'quote',
      news: 'news',
      sentiment: 'sentiment',
      breadth: 'breadth',
      fred: 'fred',
      technicals: 'technicals',
      vixHistory: 'vixHistory',
      hySpread: 'hySpread',
      maUpdate: 'maUpdate',
      krDynamic: 'krDynamic'
    };
    window._markFetch(map[key] || key);
  }

  window.AIO = window.AIO || {};
  window.AIO.getRefreshState = function() {
    return window.AIO.refreshState || { active: false, generatedAt: new Date().toISOString() };
  };

  function _normalizeRefreshSchedule() {
    Object.entries(REFRESH_SCHEDULE || {}).forEach(([key, cfg]) => {
      cfg.key = cfg.key || key;
      cfg.priority = cfg.priority || (key === 'quotes' ? 'high' : key === 'news' || key === 'sentiment' ? 'medium' : 'normal');
      cfg.timeoutMs = cfg.timeoutMs || Math.min(Math.max(Math.round((cfg.interval || 60000) * 0.35), 8000), 60000);
      cfg.retryCount = cfg.retryCount || 0;
      cfg.nextDue = cfg.nextDue || 0;
      cfg.lastRunStart = cfg.lastRunStart || 0;
      cfg.lastRunEnd = cfg.lastRunEnd || 0;
      cfg.lastDurationMs = cfg.lastDurationMs || 0;
      cfg.policyKey = cfg.policyKey || (key === 'quotes' ? 'quote' : key === 'news' ? 'news' : key === 'fred' ? 'macro_daily' : key === 'technicals' ? 'technical' : 'sentiment');
    });
  }

  async function _runScheduledTask(key, cfg, showError, opts) {
    opts = opts || {};
    if (!cfg || typeof cfg.fn !== 'function') return { key: key, ok: false, skipped: true, error: 'scheduler function not assigned' };
    if (_schedulerPaused) return { key: key, ok: false, skipped: true, error: 'scheduler paused' };
    if (cfg._inFlight) return { key: key, ok: false, skipped: true, error: 'scheduler task already in flight' };
    cfg._inFlight = true;
    cfg.lastRunStart = Date.now();
    cfg._attemptedAt = new Date(cfg.lastRunStart).toISOString();
    cfg._status = 'loading';
    cfg._failureReason = '';
    var resolved;
    var taskPromise = null;
    var taskSettled = true;
    var taskTimer = null;
    var taskController = new AbortController();
    var externalSignal = opts.signal;
    var externalAbortReject = null;
    var runFinished = false;
    var finishRun = function() {
      if (runFinished) return;
      runFinished = true;
      cfg.lastRunEnd = Date.now();
      cfg.lastDurationMs = cfg.lastRunEnd - cfg.lastRunStart;
      cfg._inFlight = false;
      cfg._activeRun = null;
    };
    var relayExternalAbort = function() {
      try { taskController.abort(externalSignal && externalSignal.reason); } catch (_) { try { taskController.abort(); } catch (_) {} }
      if (externalAbortReject) externalAbortReject(new Error('scheduler aborted by caller: ' + key));
    };
    if (externalSignal) {
      if (externalSignal.aborted) relayExternalAbort();
      else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayExternalAbort, { once: true });
    }
    cfg._activeRun = { key: key, startedAt: cfg.lastRunStart, controller: taskController };
    try {
      var taskResult = cfg.fn(Object.assign({}, opts, { signal: taskController.signal }));
      if (taskResult && typeof taskResult.then === 'function') {
        taskSettled = false;
        taskPromise = Promise.resolve(taskResult);
        taskPromise.then(function() { taskSettled = true; finishRun(); }, function() { taskSettled = true; finishRun(); });
        var timeoutMs = Math.max(3000, cfg.timeoutMs || 30000);
        var timeoutPromise = new Promise(function(_, reject) {
          taskTimer = setTimeout(function() {
            try { taskController.abort('timeout'); } catch (_) {}
            reject(new Error('scheduler timeout: ' + key + ' (' + timeoutMs + 'ms)'));
          }, timeoutMs);
        });
        var abortPromise = externalSignal ? new Promise(function(_, reject) { externalAbortReject = reject; }) : null;
        resolved = await Promise.race([taskPromise, timeoutPromise, abortPromise].filter(Boolean));
      } else {
        resolved = taskResult;
      }
      if (resolved && typeof resolved === 'object' && resolved.ok === false) {
        cfg._lastErr = resolved.error || resolved.reason || 'scheduler task returned no update';
        cfg._status = resolved.status || (resolved.skipped ? 'missing' : 'failed');
        cfg._failureReason = cfg._lastErr;
        return {
          key: key,
          ok: false,
          skipped: !!resolved.skipped,
          updated: resolved.updated === true,
          error: cfg._lastErr,
          result: resolved
        };
      }
      // v59.45 (R2-01): an explicit null means the task is unavailable or retired (the wrappers below and the retired
      // fetchAllFredData return it), so it does not stamp a success time. A Promise.allSettled batch whose every job
      // rejected (or that ran no job) is a failure, not 'partial' at 100% coverage with a fresh success time.
      if (resolved === null) {
        cfg._lastErr = 'scheduler task unavailable';
        cfg._status = 'missing';
        cfg._failureReason = cfg._lastErr;
        return { key: key, ok: false, skipped: true, updated: false, error: cfg._lastErr, result: null };
      }
      var settledRows = Array.isArray(resolved) && resolved.every(function(row) { return row && (row.status === 'fulfilled' || row.status === 'rejected'); });
      if (settledRows && !resolved.some(function(row) { return row.status === 'fulfilled'; })) {
        cfg._lastErr = resolved.length ? 'every scheduled job failed' : 'no scheduled job ran';
        cfg._status = resolved.length ? 'failed' : 'missing';
        cfg._failureReason = cfg._lastErr;
        return { key: key, ok: false, skipped: !resolved.length, updated: false, error: cfg._lastErr, result: resolved };
      }
      if (resolved && typeof resolved === 'object' && resolved.updated === false && resolved.skipped) {
        cfg._lastErr = resolved.error || resolved.reason || 'scheduler task skipped without update';
        cfg._status = resolved.status || 'missing';
        cfg._failureReason = cfg._lastErr;
        return {
          key: key,
          ok: false,
          skipped: true,
          updated: false,
          error: cfg._lastErr,
          result: resolved
        };
      }
      cfg._lastOk = Date.now();
      cfg._lastSuccessfulAt = new Date(cfg._lastOk).toISOString();
      cfg._lastErr = '';
      cfg._failureReason = '';
      cfg.retryCount = 0;
      var settledFailure = Array.isArray(resolved) && resolved.some(function(row) { return row && row.status === 'rejected'; });
      cfg._status = (resolved && resolved.status) || (settledFailure ? 'partial' : 'loaded');
      var settledCoverage = settledRows && resolved.length ? Math.round(100 * resolved.filter(function(row) { return row && row.status === 'fulfilled'; }).length / resolved.length) : null;
      cfg._coverage = resolved && typeof resolved.coverage === 'number' ? resolved.coverage : (resolved && typeof resolved.coveragePct === 'number' ? resolved.coveragePct : (settledCoverage != null ? settledCoverage : (cfg._coverage != null ? cfg._coverage : 100)));
      cfg._evidenceIds = resolved && Array.isArray(resolved.evidenceIds) ? resolved.evidenceIds.slice() : (cfg._evidenceIds || []);
      cfg._sourceKind = resolved && resolved.sourceKind || cfg._sourceKind || null;
      cfg._allowedUse = resolved && resolved.allowedUse || cfg._allowedUse || null;
      _aioMarkSchedulerFetch(key, resolved);
      return { key: key, ok: !settledFailure, skipped: false, updated: !(resolved && resolved.updated === false), status: cfg._status, lastSuccessfulAt: cfg._lastSuccessfulAt, error: '', result: resolved };
    } catch(e) {
      cfg._lastErr = e && e.message || String(e);
      cfg._status = 'failed';
      cfg._failureReason = cfg._lastErr;
      cfg.retryCount = (cfg.retryCount || 0) + 1;
      if (showError) showDataError(cfg.label, 'auto refresh failed; retrying on next cycle', 'warn');
      return { key: key, ok: false, skipped: false, updated: false, error: cfg._lastErr };
    } finally {
      if (taskTimer) clearTimeout(taskTimer);
      if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayExternalAbort);
      if (!taskPromise || taskSettled) finishRun();
    }
  }

  function _assignRefreshScheduleFunctions() {
    REFRESH_SCHEDULE.quotes.fn     = (opts) => { return (typeof fetchLiveQuotes === 'function') ? fetchLiveQuotes(opts && opts.symbols) : null; };
    REFRESH_SCHEDULE.news.fn       = (opts) => { return (typeof fetchAllNews === 'function') ? fetchAllNews(!!(opts && opts.forceRefresh)) : null; };
    REFRESH_SCHEDULE.sentiment.fn  = () => {
      var jobs = [];
      if (typeof fetchFearGreed === 'function') jobs.push(fetchFearGreed());
      if (typeof fetchPutCall === 'function') jobs.push(fetchPutCall());
      return Promise.allSettled(jobs);
    };
    REFRESH_SCHEDULE.breadth.fn    = fetchBreadthData;
    REFRESH_SCHEDULE.fred.fn       = fetchAllFredData;
    // v57.76: Twelve Data indicators needed a personal key (retired v57.67); the producer stays registered and reports skipped.
    REFRESH_SCHEDULE.technicals.fn = () => Promise.resolve({ ok: false, skipped: true, updated: false, reason: 'technical indicators unavailable' });
    REFRESH_SCHEDULE.vixHistory.fn = fetchSentimentHistory;
    REFRESH_SCHEDULE.hySpread.fn   = () => { return (typeof fetchHYSpread === 'function') ? fetchHYSpread() : null; };
    REFRESH_SCHEDULE.maUpdate.fn   = () => { return (typeof autoUpdateMA === 'function') ? autoUpdateMA() : null; };
    REFRESH_SCHEDULE.krDynamic.fn  = () => { return (typeof fetchKrDynamicData === 'function') ? fetchKrDynamicData() : null; };
    window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
    _normalizeRefreshSchedule();
  }

  _assignRefreshScheduleFunctions();

  function startDataScheduler() {
    console.log('[AIO v21] ═══ Data Scheduler Starting (5명 동시접속 최적화) ═══');

    // v21: 랜덤 지터 함수 — 각 유저가 약간 다른 시간에 호출하도록
    // interval의 ±15% 범위 내에서 랜덤화
    function jitteredInterval(baseMs) {
      const jitter = baseMs * 0.15; // ±15%
      return baseMs + Math.floor(Math.random() * jitter * 2 - jitter);
    }

    // Assign functions
    _assignRefreshScheduleFunctions();
    // v30.11: 중앙 스케줄러 편입 (T3, T7 독립 타이머 → 여기로 통합)
    REFRESH_SCHEDULE.hySpread.fn   = () => { return (typeof fetchHYSpread === 'function') ? fetchHYSpread() : null; };
    REFRESH_SCHEDULE.maUpdate.fn   = () => { return (typeof autoUpdateMA === 'function') ? autoUpdateMA() : null; };
    REFRESH_SCHEDULE.krDynamic.fn  = () => { return (typeof fetchKrDynamicData === 'function') ? fetchKrDynamicData() : null; };
    window.REFRESH_SCHEDULE = REFRESH_SCHEDULE;
    _normalizeRefreshSchedule();

    // v21: 지터가 적용된 타이머 시작 (5명이 동시 호출하는 것 방지)
    Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
      if (cfg.fn && cfg.interval > 0) {
        // 첫 실행도 랜덤 딜레이 후 시작 (0~30초)
        const initialDelay = Math.floor(Math.random() * 30000);
        const scheduleEpoch = (cfg._scheduleEpoch || 0) + 1;
        cfg._scheduleEpoch = scheduleEpoch;
        cfg.nextDue = Date.now() + initialDelay;
        cfg.timer = setTimeout(() => {
          cfg.timer = null;
          if (_schedulerPaused || cfg._scheduleEpoch !== scheduleEpoch) return;
          // setInterval 대신 재귀 setTimeout으로 매번 지터 적용
          function scheduleNext() {
            if (_schedulerPaused || cfg._scheduleEpoch !== scheduleEpoch || cfg.timer) return;
            const nextInterval = jitteredInterval(cfg.interval);
            cfg.nextDue = Date.now() + nextInterval;
            cfg.timer = setTimeout(async () => {
              cfg.timer = null;
              if (_schedulerPaused || cfg._scheduleEpoch !== scheduleEpoch) return;
              await _runScheduledTask(key, cfg, true);
              if (!_schedulerPaused && cfg._scheduleEpoch === scheduleEpoch) scheduleNext();
            }, nextInterval);
          }
          scheduleNext();
        }, initialDelay);
        console.log(`  ✓ ${cfg.label} — ~${Math.round(cfg.interval / 1000)}s (±15% jitter, 시작 +${Math.round(initialDelay/1000)}s)`);
      }
    });

    // Update status display
    updateDataStatus();
    // v48.91: 타이머 레지스트리 등록
    window._dataStatusInterval = _aioRegisterTimer('dataStatus', updateDataStatus, T.COOLDOWN);

    console.log('[AIO v20] ═══ All schedulers active ═══');
  }

  // ─────────────────────────────────────────────────────────────────
  // v49.98 P463/R187: 종합 5 페이지 on-enter 즉시 갱신 (매매 핵심 페이지 stale 차단)
  // 갭: 스케줄러는 주기(10분 등)로만 돌아 페이지 진입 시점에 stale할 수 있음.
  //     실제 매매에 쓰는 종합 5페이지(대시보드/시그널/시장폭/심리/브리핑)는
  //     진입 즉시 의존 태스크가 stale(½ interval 초과)이면 강제 재fetch해 최신 반영.
  // 디바운스: 동일 태스크 동시 진입 폭주 방지 (cfg._inFlight + per-task 최소 간격).
  // ─────────────────────────────────────────────────────────────────
  var AIO_PAGE_REFRESH_MAP = {
    home:        ['quotes', 'news', 'sentiment', 'breadth', 'technicals'],
    signal:      ['quotes', 'sentiment', 'breadth', 'technicals', 'vixHistory', 'hySpread'],
    breadth:     ['quotes', 'breadth', 'technicals'],
    sentiment:   ['quotes', 'sentiment', 'vixHistory', 'hySpread'],
    briefing:    ['quotes', 'news', 'sentiment', 'breadth', 'fred', 'technicals'],
    technical:   ['quotes', 'technicals', 'breadth', 'sentiment', 'vixHistory', 'krDynamic'],
    macro:       ['quotes', 'fred', 'news', 'sentiment', 'krDynamic'],
    fxbond:      ['quotes', 'fred', 'hySpread', 'news'],
    fundamental: ['quotes', 'news', 'technicals'],
    themes:      ['quotes', 'news', 'technicals', 'krDynamic'],
    screener:    ['quotes', 'technicals'],
    portfolio:   ['quotes', 'technicals'],
    'market-news': ['quotes', 'news'],
    // v53.7 (P725): KR 라우트 퇴역 — themes/macro/technical가 KR 섹션 갱신을 겸함
    // P1321: options route retired — its VIX/PCR/SKEW live on sentiment
  };
  window.AIO_PAGE_REFRESH_MAP = AIO_PAGE_REFRESH_MAP;
  // P1129/R619: AIO_CRITICAL_10_PAGE_IDS 하드코딩 제거 — aio-core가 CRITICAL_5+ANALYSIS_5로 파생한다.
  try {
    if (window.AIO && typeof window.AIO.applyPageContractCompatibility === 'function') {
      window.AIO.applyPageContractCompatibility();
    }
  } catch(_) {}

  function _aioGetRefreshProfile(pageId) {
    try {
      if (window.AIO && typeof window.AIO.getDataRequirementProfile === 'function') {
        return window.AIO.getDataRequirementProfile({ pageId: pageId, reason: 'page-onenter', forceFresh: true });
      }
    } catch(_) {}
    var raw = window.AIO && window.AIO.DATA_REQUIREMENT_PROFILES ? window.AIO.DATA_REQUIREMENT_PROFILES[pageId] : null;
    return {
      pageId: pageId,
      tasks: (raw && raw.tasks) || AIO_PAGE_REFRESH_MAP[pageId] || [],
      symbols: (raw && raw.symbols) || []
    };
  }

  function _aioGetComprehensiveSymbols() {
    var out = [];
    ['home','signal','breadth','sentiment','briefing'].forEach(function(pageId) {
      var p = _aioGetRefreshProfile(pageId);
      (p.symbols || []).forEach(function(sym) { out.push(sym); });
    });
    return Array.from(new Set(out.map(function(sym) { return String(sym || '').trim().toUpperCase(); }).filter(Boolean)));
  }

  function _aioGetCritical10Symbols() {
    var out = [];
    (window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes']).forEach(function(pageId) {
      var p = _aioGetRefreshProfile(pageId);
      (p.symbols || []).forEach(function(sym) { out.push(sym); });
    });
    return Array.from(new Set(out.map(function(sym) { return String(sym || '').trim().toUpperCase(); }).filter(Boolean)));
  }
  window._aioGetCritical10Symbols = _aioGetCritical10Symbols;

  var _aioPageRefreshLast = {};   // key -> 마지막 on-enter 강제 fetch ts (per-task 최소 간격 가드)
  var _aioPageRefreshControllers = globalThis._aioPageRefreshControllers || {};
  globalThis._aioPageRefreshControllers = _aioPageRefreshControllers;

  // v49.99 연계점①: HOME_WEEKLY_NEWS 만료 감지 → news 태스크 강제 pre-warm
  // 문제: news interval 45분, stale threshold 22.5분 — HOME_WEEKLY_NEWS 만료 시점에
  //       마지막 news 실행이 22.5분 미만이면 on-enter refresh가 스킵 → "수집 중..." 공백.
  // 해결: HOME_WEEKLY_NEWS가 만료됐거나 24h 이내 만료 예정이면 news 태스크를 stale 무관하게 강제 실행.
  function _aioIsWeeklyNewsExpiring() {
    var src = window.HOME_WEEKLY_NEWS || (typeof HOME_WEEKLY_NEWS !== 'undefined' ? HOME_WEEKLY_NEWS : null);
    if (!src || !src.length) return true; // 비어있으면 만료로 간주
    var now = Date.now();
    var maxAgeMs = 72 * 60 * 60 * 1000;   // 72h 만료 기준
    var warnMs   = 24 * 60 * 60 * 1000;   // 24h 전부터 pre-warm
    var currentCount = (typeof _aioGetCurrentHomeWeeklyNews === 'function') ? _aioGetCurrentHomeWeeklyNews(now).length : 0;
    if (currentCount < Math.min(3, src.length)) return true;
    return src.some(function(n) {
      if (!n || !n.date) return true;
      var t = new Date(String(n.date) + 'T23:59:59+09:00').getTime();
      if (isNaN(t)) return true;
      return (now - t) >= (maxAgeMs - warnMs); // 만료됐거나 24h 이내 만료 예정
    });
  }
  window._aioIsWeeklyNewsExpiring = _aioIsWeeklyNewsExpiring;

  function _aioRefreshPageData(pageId) {
    try {
      if (_schedulerPaused) return;
      // During the initial snapshot/server-data window, the central phase
      // coordinator owns quote/sentiment/breadth work. Avoid a duplicate
      // on-enter provider fan-out before the quote phase is ready.
      if (_aioBootPhase.quoteReady === false) return;
      _assignRefreshScheduleFunctions();
      var profile = _aioGetRefreshProfile(pageId);
      var keys = (profile && profile.tasks && profile.tasks.length) ? profile.tasks : AIO_PAGE_REFRESH_MAP[pageId];
      if (!keys || !keys.length || !window.REFRESH_SCHEDULE) return;
      var symbols = Array.isArray(profile.symbols) ? profile.symbols.slice() : [];
      Object.keys(_aioPageRefreshControllers).forEach(function(activePageId) {
        if (activePageId !== pageId && _aioPageRefreshControllers[activePageId]) {
          try { _aioPageRefreshControllers[activePageId].abort('route-changed'); } catch (_) {}
          delete _aioPageRefreshControllers[activePageId];
        }
      });
      if (_aioPageRefreshControllers[pageId]) {
        try { _aioPageRefreshControllers[pageId].abort('superseded'); } catch (_) {}
      }
      var pageController = new AbortController();
      _aioPageRefreshControllers[pageId] = pageController;
      var now = Date.now();
      // v49.99 연계점①: home/briefing 진입 시 주간뉴스 만료 여부 사전 체크
      var weeklyNewsExpiring = (pageId === 'home' || pageId === 'briefing') && _aioIsWeeklyNewsExpiring();
      var dueKeys = [];
      var options = {};
      keys.forEach(function(key) {
        var cfg = REFRESH_SCHEDULE[key];
        if (!cfg || typeof cfg.fn !== 'function' || cfg._inFlight) return;
        // stale 판정: 마지막 성공이 ½ interval 초과 (아직 fresh면 스킵 — 불필요 호출 방지)
        var lastOk = cfg._lastOk || 0;
        var staleThreshold = Math.max((cfg.interval || 600000) * 0.5, 60000);
        // 연계점①: news 태스크이고 주간뉴스 만료 임박 — stale 기준 무시하고 강제 실행
        var forceRefresh = (key === 'news' && weeklyNewsExpiring);
        if (!forceRefresh && lastOk && (now - lastOk) < staleThreshold) return;
        // per-task on-enter 최소 간격 30초 (페이지 빠른 전환 폭주 차단)
        if (_aioPageRefreshLast[key] && (now - _aioPageRefreshLast[key]) < 30000) return;
        _aioPageRefreshLast[key] = now;
        dueKeys.push(key);
        options[key] = { pageId: pageId, forceRefresh: forceRefresh, reason: forceRefresh ? 'weekly-news-expiring' : 'page-onenter-stale', symbols: symbols };
      });
      if (dueKeys.length && window.AIO && typeof window.AIO.runScheduledRefresh === 'function') {
        setTimeout(function(){
          var activePageId = String((window.AIO && typeof window.AIO.getActivePage === 'function' && window.AIO.getActivePage()) || document.querySelector('.page.active')?.id || '').replace(/^page-/, '');
          if (pageController.signal.aborted || (activePageId && activePageId !== pageId)) return;
          window.AIO.runScheduledRefresh({ keys: dueKeys, options: options, pageId: pageId, symbols: symbols, reason: 'page-onenter', signal: pageController.signal }).catch(function(e) {
            if (typeof _aioLog === 'function') _aioLog('warn', 'refresh', 'page refresh failed: ' + pageId + ' ' + (e && e.message || e));
          }).finally(function() {
            if (_aioPageRefreshControllers[pageId] === pageController) delete _aioPageRefreshControllers[pageId];
          });
        }, 0);
      }
    } catch (e) {}
  }
  window._aioRefreshPageData = _aioRefreshPageData;

  // aio:pageShown 구독 — 종합 5 페이지 진입 시 on-enter 갱신
  try {
    // aio:pageShown payload: CustomEvent { detail: id(문자열) } — showPage(aio-core L17499)
    function _onPageShown(e) {
      var d = e && e.detail;
      var pageId = (typeof d === 'string') ? d : (d && (d.pageId || d.id));
      if (pageId && (AIO_PAGE_REFRESH_MAP[pageId] || (_aioGetRefreshProfile(pageId).tasks || []).length)) _aioRefreshPageData(pageId);
    }
    if (window._aioPageBus && window._aioPageBus.register) {
      window._aioPageBus.register('data-page-onenter-refresh', 'aio:pageShown', _onPageShown);
    } else {
      document.addEventListener('aio:pageShown', _onPageShown);
    }
  } catch (e) {}

  // v30.11: 스케줄러 재시작 함수 (Page Visibility 복귀용)
  function restartScheduler() {
    Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
      if (cfg.fn && cfg.interval > 0 && !cfg.timer) {
        var scheduleEpoch = (cfg._scheduleEpoch || 0) + 1;
        cfg._scheduleEpoch = scheduleEpoch;
        function jit(base) { var j = base * 0.15; return base + Math.floor(Math.random() * j * 2 - j); }
        function scheduleNext() {
          if (_schedulerPaused || cfg._scheduleEpoch !== scheduleEpoch || cfg.timer) return;
          var delay = jit(cfg.interval);
          cfg.nextDue = Date.now() + delay;
          cfg.timer = setTimeout(async () => {
            cfg.timer = null;
            if (_schedulerPaused || cfg._scheduleEpoch !== scheduleEpoch) return;
            await _runScheduledTask(key, cfg, false);
            if (!_schedulerPaused && cfg._scheduleEpoch === scheduleEpoch) scheduleNext();
          }, delay);
        }
        scheduleNext();
      }
    });
  }

  // v30.11: Page Visibility API — 백그라운드 탭에서 스케줄러 일시정지 (P1756: dataStatus·serverDataReload 등 named interval은 aio-core 타이머 레지스트리가 멈춤/재개)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _schedulerPaused = true;
      _lastVisibleTime = Date.now(); // v46.9: 숨김 시점 기록 → 복귀 시 정확한 elapsed 계산 (P92)
      Object.values(REFRESH_SCHEDULE).forEach(cfg => {
        cfg._scheduleEpoch = (cfg._scheduleEpoch || 0) + 1;
        if (cfg.timer) { clearTimeout(cfg.timer); cfg.timer = null; }
      });
      console.log('[AIO] Tab hidden — scheduler paused');
    } else {
      _schedulerPaused = false;
      const elapsed = Date.now() - _lastVisibleTime;
      // stale 데이터만 즉시 갱신
      var resumeKeys = [];
      Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
        if (cfg.fn && elapsed >= cfg.interval) {
          resumeKeys.push(key);
        }
      });
      if (resumeKeys.length && window.AIO && typeof window.AIO.runScheduledRefresh === 'function') {
        try { setTimeout(function(){ window.AIO.runScheduledRefresh({ keys: resumeKeys, reason: 'visibility-resume', symbols: _aioGetComprehensiveSymbols() }).catch(function(){}); }, 0); } catch(e) {}
      }
      restartScheduler();
      _lastVisibleTime = Date.now();
      console.log('[AIO] Tab visible — scheduler resumed (elapsed ' + Math.round(elapsed/1000) + 's)');
    }
  });

  window.AIO = window.AIO || {};

  window.AIO.getRefreshSchedulerAudit = function() {
    _assignRefreshScheduleFunctions();
    _normalizeRefreshSchedule();
    var now = Date.now();
    var tasks = {};
    var tasksWithoutFn = [];
    var inFlight = [];
    var staleOk = [];
    Object.entries(REFRESH_SCHEDULE || {}).forEach(function(entry) {
      var key = entry[0];
      var cfg = entry[1] || {};
      var hasFn = typeof cfg.fn === 'function';
      if (!hasFn) tasksWithoutFn.push(key);
      if (cfg._inFlight) inFlight.push(key);
      if (cfg._lastOk && now - cfg._lastOk <= Math.max(cfg.interval || 0, 60000) * 2) staleOk.push(key);
      tasks[key] = {
        label: cfg.label || key,
        intervalMs: cfg.interval || 0,
        priority: cfg.priority || 'normal',
        policyKey: cfg.policyKey || null,
        hasFn: hasFn,
        inFlight: !!cfg._inFlight,
        lastOk: cfg._lastOk || 0,
        attemptedAt: cfg._attemptedAt || null,
        lastSuccessfulAt: cfg._lastSuccessfulAt || (cfg._lastOk ? new Date(cfg._lastOk).toISOString() : null),
        status: cfg._status || (cfg._lastOk ? 'loaded' : 'missing'),
        coverage: cfg._coverage != null ? cfg._coverage : null,
        evidenceIds: Array.isArray(cfg._evidenceIds) ? cfg._evidenceIds.slice() : [],
        failureReason: cfg._failureReason || cfg._lastErr || null,
        lastErr: cfg._lastErr || '',
        retryCount: cfg.retryCount || 0,
        nextDue: cfg.nextDue || 0,
        overdueMs: cfg.nextDue && cfg.nextDue < now ? now - cfg.nextDue : 0,
        timeoutMs: cfg.timeoutMs || 0,
        lastDurationMs: cfg.lastDurationMs || 0
      };
    });
    // v49.98 R187: 종합 5페이지 on-enter refresh 매핑 무결성 — 매핑된 태스크가 실존 스케줄 키인지 검증
    var pageRefreshIssues = [];
    var prMap = window.AIO_PAGE_REFRESH_MAP || {};
    Object.keys(prMap).forEach(function(pg) {
      (prMap[pg] || []).forEach(function(k) {
        if (!REFRESH_SCHEDULE[k]) pageRefreshIssues.push(pg + '→' + k + ' (unknown task)');
      });
    });
    var pageRefreshWired = typeof window._aioRefreshPageData === 'function';
    return {
      status: (tasksWithoutFn.length || pageRefreshIssues.length || !pageRefreshWired) ? 'warn' : 'ok',
      paused: !!_schedulerPaused,
      totalTasks: Object.keys(tasks).length,
      tasksWithoutFn: tasksWithoutFn,
      inFlight: inFlight,
      recentlyOk: staleOk,
      tasks: tasks,
      pageRefreshMap: prMap,                    // v49.98: 페이지→태스크 매핑 (R187)
      pageRefreshWired: pageRefreshWired,
      pageRefreshIssues: pageRefreshIssues,     // 매핑이 가리키는 unknown 태스크
      generatedAt: new Date(now).toISOString()
    };
  };


  // v58.20: AIO.refreshAllComprehensivePages (v49.102) had no product caller — refreshes go through AIO.runScheduledRefresh.

  window.AIO.refreshAllCriticalPages = async function() {
    var pages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
    var taskSet = {};
    pages.forEach(function(pageId) {
      var profile = _aioGetRefreshProfile(pageId);
      (profile.tasks || AIO_PAGE_REFRESH_MAP[pageId] || []).forEach(function(task) { taskSet[task] = true; });
    });
    var tasks = Object.keys(taskSet);
    var refresh = await window.AIO.runScheduledRefresh({
      keys: tasks,
      forceRefresh: true,
      pageId: 'critical-10',
      reason: 'critical-10-pages-force-refresh',
      symbols: _aioGetCritical10Symbols()
    });
    try { if (typeof applyDataSnapshot === 'function') applyDataSnapshot(); } catch(_) {}
    try { if (window.AIO && typeof window.AIO.applyLiveDataToDom === 'function') window.AIO.applyLiveDataToDom({ reason: 'critical-10-refresh', force: true }); } catch(_) {}
    try { if (window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function') window.AIO.renderStaticDataGovernanceBadges(); } catch(_) {}
    return {
      status: refresh.status,
      refresh: refresh,
      audit: window.AIO.getCritical10PageFreshnessAudit ? window.AIO.getCritical10PageFreshnessAudit({ symbolLimit: 999 }) : null,
      binding: window.AIO.verifyCritical10LiveBindings ? window.AIO.verifyCritical10LiveBindings() : null,
      generatedAt: new Date().toISOString()
    };
  };

  window.AIO.getComprehensivePageDataFreshnessAudit = function() {
    _assignRefreshScheduleFunctions();
    _normalizeRefreshSchedule();
    var pages = window.AIO_CRITICAL_10_PAGE_IDS || ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','fundamental','themes'];
    var now = Date.now();
    var critical10MarketSurface = null;
    var critical10MarketSituation = null;
    var critical10EvidenceMatrix = null;
    var marketSurfaceByPage = {};
    var marketSituationByPage = {};
    var evidenceByPage = {};
    try {
      critical10MarketSurface = window.AIO.getCritical10MarketSurfaceAudit ? window.AIO.getCritical10MarketSurfaceAudit({ pages: pages }) : null;
      if (critical10MarketSurface && Array.isArray(critical10MarketSurface.pages)) {
        critical10MarketSurface.pages.forEach(function(row) { marketSurfaceByPage[row.pageId] = row; });
      }
    } catch(e) {
      critical10MarketSurface = { status: 'error', issuePageCount: pages.length, error: e && e.message || String(e), pages: [] };
    }
    try {
      critical10MarketSituation = window.AIO.getCritical10MarketSituationAudit ? window.AIO.getCritical10MarketSituationAudit({ pages: pages, sampleLimit: 40 }) : null;
      if (critical10MarketSituation && Array.isArray(critical10MarketSituation.pages)) {
        critical10MarketSituation.pages.forEach(function(row) { marketSituationByPage[row.pageId] = row; });
      }
    } catch(e3) {
      critical10MarketSituation = { status: 'error', issuePageCount: pages.length, error: e3 && e3.message || String(e3), pages: [] };
    }
    try {
      critical10EvidenceMatrix = window.AIO.getCritical10ContentEvidenceMatrix ? window.AIO.getCritical10ContentEvidenceMatrix({ pages: pages, includeItems: false }) : null;
      if (critical10EvidenceMatrix && Array.isArray(critical10EvidenceMatrix.pages)) {
        critical10EvidenceMatrix.pages.forEach(function(row) { evidenceByPage[row.pageId] = row; });
      }
    } catch(e4) {
      critical10EvidenceMatrix = { status: 'error', error: e4 && e4.message || String(e4), pages: [] };
    }
    var details = pages.map(function(pageId) {
      var profile = _aioGetRefreshProfile(pageId);
      var tasks = profile.tasks || AIO_PAGE_REFRESH_MAP[pageId] || [];
      var symbols = profile.symbols || [];
      var pageEl = null;
      try { pageEl = document.getElementById('page-' + pageId); } catch(_) {}
      var missingTasks = tasks.filter(function(task) { return !REFRESH_SCHEDULE[task] || typeof REFRESH_SCHEDULE[task].fn !== 'function'; });
      var staleTasks = tasks.filter(function(task) {
        var cfg = REFRESH_SCHEDULE[task] || {};
        return !cfg._lastOk || (now - cfg._lastOk) > Math.max(cfg.interval || 600000, 60000) * 2;
      });
      var liveMissing = symbols.filter(function(sym) { return !(window._liveData && window._liveData[String(sym).toUpperCase()]); });
      var sinks = pageEl ? pageEl.querySelectorAll('[data-live-price],[data-live-pct],[data-live-field],[data-snap],[data-snap-date]').length : 0;
      var chartLike = pageEl ? pageEl.querySelectorAll('canvas,[id*="chart"],[id*="widget"]').length : 0;
      var bindingAudit = null;
      try { bindingAudit = window.AIO.verifyPageLiveDataBinding ? window.AIO.verifyPageLiveDataBinding({ pageId: pageId }) : null; } catch(e2) { bindingAudit = { status: 'error', error: e2 && e2.message || String(e2), sourceMissingCount: 0, bindingMissingCount: 0, truthBlockedCount: 0 }; }
      var marketRow = marketSurfaceByPage[pageId] || null;
      var situationRow = marketSituationByPage[pageId] || null;
      var evidenceRow = evidenceByPage[pageId] || null;
      var issues = [];
      if (!pageEl) issues.push('missing page DOM');
      if (missingTasks.length) issues.push('missing task fn: ' + missingTasks.join(','));
      if (staleTasks.length) issues.push('stale task: ' + staleTasks.join(','));
      if (!tasks.length) issues.push('no refresh tasks');
      if (!symbols.length) issues.push('no symbol profile');
      if (bindingAudit && bindingAudit.sourceMissingCount) issues.push('visible live source missing: ' + bindingAudit.sourceMissingCount);
      if (bindingAudit && bindingAudit.bindingMissingCount) issues.push('visible live binding missing: ' + bindingAudit.bindingMissingCount);
      if (bindingAudit && bindingAudit.truthBlockedCount) issues.push('truth-blocked visible live sink: ' + bindingAudit.truthBlockedCount);
      if (marketRow && marketRow.marketIssueCount) issues.push('market surface issue: ' + marketRow.marketIssueCount);
      if (marketRow && marketRow.staleSnapDates && marketRow.staleSnapDates.length) issues.push('stale snap-date: ' + marketRow.staleSnapDates.length);
      if (situationRow && situationRow.status !== 'ok') issues.push('market situation mismatch/coverage: ' + situationRow.issues.join('|'));
      if (evidenceRow && evidenceRow.status !== 'pass') issues.push('content evidence review: ' + JSON.stringify(evidenceRow.counts));
      return {
        pageId: pageId,
        status: issues.length ? 'warn' : 'ok',
        issues: issues,
        tasks: tasks,
        missingTasks: missingTasks,
        staleTasks: staleTasks,
        symbols: symbols,
        symbolCount: symbols.length,
        liveMissingSample: liveMissing.slice(0, 12),
        liveMissingCount: liveMissing.length,
        dataSinkCount: sinks,
        chartLikeCount: chartLike,
        bindingAudit: bindingAudit ? {
          status: bindingAudit.status,
          total: bindingAudit.total || 0,
          sourceMissingCount: bindingAudit.sourceMissingCount || 0,
          bindingMissingCount: bindingAudit.bindingMissingCount || 0,
          truthBlockedCount: bindingAudit.truthBlockedCount || 0
        } : null,
        marketSurface: marketRow ? {
          status: marketRow.status,
          issueCount: marketRow.issueCount || 0,
          marketIssueCount: marketRow.marketIssueCount || 0,
          visibleUnavailableCount: marketRow.visibleUnavailableCount || 0,
          visibleReferenceOnlyCount: marketRow.visibleReferenceOnlyCount || 0,
          visibleTruthBlockedCount: marketRow.visibleTruthBlockedCount || 0,
          staleSnapDateCount: marketRow.staleSnapDates ? marketRow.staleSnapDates.length : 0,
          marketIssueSample: marketRow.marketIssueSample || []
        } : null,
        marketSituation: situationRow ? {
          status: situationRow.status,
          issues: situationRow.issues || [],
          referenceMissingCount: situationRow.referenceMissingCount || 0,
          valueMismatchCount: situationRow.valueMismatchCount || 0,
          sourceIssueCount: situationRow.sourceIssueCount || 0,
          staleDateCount: situationRow.staleDateCount || 0,
          narrativeConflictCount: situationRow.narrativeConflictCount || 0
        } : null,
        evidenceMatrix: evidenceRow ? {
          status: evidenceRow.status,
          counts: evidenceRow.counts || {}
        } : null
      };
    });
    var issues = details.filter(function(d) { return d.issues.length; });
    return {
      status: issues.length ? 'warn' : 'ok',
      pagesChecked: details.length,
      issueCount: issues.length,
      totalSymbols: _aioGetCritical10Symbols().length,
      unionTasks: Array.from(new Set(details.reduce(function(acc, d) { return acc.concat(d.tasks); }, []))),
      pages: details,
      surfaceIntegrity: window.AIO.getComprehensiveSurfaceIntegrityAudit ? window.AIO.getComprehensiveSurfaceIntegrityAudit({ symbolLimit: 999 }) : null,
      critical10MarketSurface: critical10MarketSurface,
      critical10MarketSituation: critical10MarketSituation,
      critical10EvidenceMatrix: critical10EvidenceMatrix,
      generatedAt: new Date(now).toISOString()
    };
  };

  window.AIO.runScheduledRefresh = async function(keys) {
    _assignRefreshScheduleFunctions();
    _normalizeRefreshSchedule();
    var forceAll = false;
    var optsByKey = {};
    var runSymbols = [];
    var runPageId = '';
    var runReason = '';
    var runSignal = null;
    var list = Array.isArray(keys) && keys.length ? keys : Object.keys(REFRESH_SCHEDULE || {});
    if (keys && !Array.isArray(keys) && typeof keys === 'object') {
      list = Array.isArray(keys.keys) && keys.keys.length ? keys.keys : Object.keys(REFRESH_SCHEDULE || {});
      forceAll = !!keys.forceRefresh;
      optsByKey = keys.options || {};
      runSymbols = Array.isArray(keys.symbols) ? keys.symbols.slice() : [];
      runPageId = keys.pageId || '';
      runReason = keys.reason || '';
      runSignal = keys.signal || null;
    }
    if (!runSymbols.length && runPageId) {
      var runProfile = _aioGetRefreshProfile(runPageId);
      runSymbols = Array.isArray(runProfile.symbols) ? runProfile.symbols.slice() : [];
    }
    var out = [];
    var wasPaused = _schedulerPaused;
    var prevQuoteRequestSymbols = window._aioQuoteRequestSymbols;
    var runId = 'refresh-' + Date.now() + '-' + Math.round(Math.random() * 100000);
    var startedAt = Date.now();
    if (runSymbols.length) window._aioQuoteRequestSymbols = runSymbols.slice();
    _aioEmitRefreshEvent('start', {
      runId: runId,
      keys: list.slice(),
      pageId: runPageId,
      reason: runReason,
      symbols: runSymbols.slice(),
      total: list.length,
      done: 0,
      currentKey: '',
      currentLabel: '',
      forceRefresh: forceAll,
      results: []
    });
    _schedulerPaused = false;
    try {
      for (var i = 0; i < list.length; i++) {
        if (runSignal && runSignal.aborted) {
          out.push({ key: list[i], ok: false, skipped: true, error: 'refresh aborted by caller', durationMs: 0, lastOk: 0 });
          break;
        }
        var key = list[i];
        var cfg = REFRESH_SCHEDULE && REFRESH_SCHEDULE[key];
        var started = Date.now();
        _aioEmitRefreshEvent('progress', {
          runId: runId,
          phase: 'running',
          key: key,
          label: _aioRefreshTaskLabel(key, cfg),
          currentKey: key,
          currentLabel: _aioRefreshTaskLabel(key, cfg),
          index: i + 1,
          done: i,
          total: list.length,
          keys: list.slice(),
          pageId: runPageId,
          reason: runReason,
          symbols: runSymbols.slice(),
          forceRefresh: forceAll,
          results: out.slice()
        });
        if (!cfg) {
          out.push({ key: key, ok: false, skipped: true, error: 'unknown scheduler key', durationMs: Date.now() - started, lastOk: 0 });
          _aioEmitRefreshEvent('progress', { runId: runId, phase: 'skipped', key: key, label: key, index: i + 1, done: i + 1, total: list.length, keys: list.slice(), pageId: runPageId, reason: runReason, symbols: runSymbols.slice(), forceRefresh: forceAll, result: out[out.length - 1], results: out.slice() });
          continue;
        }
        if (typeof cfg.fn !== 'function') {
          out.push({ key: key, ok: false, skipped: true, error: 'scheduler function not assigned', durationMs: Date.now() - started, lastOk: cfg._lastOk || 0 });
          _aioEmitRefreshEvent('progress', { runId: runId, phase: 'skipped', key: key, label: _aioRefreshTaskLabel(key, cfg), index: i + 1, done: i + 1, total: list.length, keys: list.slice(), pageId: runPageId, reason: runReason, symbols: runSymbols.slice(), forceRefresh: forceAll, result: out[out.length - 1], results: out.slice() });
          continue;
        }
        var keyOpts = optsByKey[key] || {};
        var opts = Object.assign({}, keyOpts, {
          pageId: runPageId || keyOpts.pageId || '',
          reason: runReason || keyOpts.reason || '',
          symbols: runSymbols.length ? runSymbols.slice() : (Array.isArray(keyOpts.symbols) ? keyOpts.symbols.slice() : []),
          forceRefresh: !!(forceAll || keyOpts.forceRefresh),
          signal: runSignal
        });
        var taskRun = await _runScheduledTask(key, cfg, true, opts);
        out.push({ key: key, ok: !!(taskRun && taskRun.ok), skipped: !!(taskRun && taskRun.skipped), updated: !!(taskRun && taskRun.updated), error: (taskRun && taskRun.error) || cfg._lastErr || '', durationMs: Date.now() - started, lastOk: cfg._lastOk || 0 });
        _aioEmitRefreshEvent('progress', {
          runId: runId,
          phase: (taskRun && taskRun.ok) ? (taskRun.skipped ? 'skipped' : 'ok') : 'error',
          key: key,
          label: _aioRefreshTaskLabel(key, cfg),
          index: i + 1,
          done: i + 1,
          total: list.length,
          keys: list.slice(),
          pageId: runPageId,
          reason: runReason,
          symbols: runSymbols.slice(),
          forceRefresh: forceAll,
          result: out[out.length - 1],
          results: out.slice()
        });
      }
    } finally {
      _schedulerPaused = wasPaused;
      if (prevQuoteRequestSymbols == null) delete window._aioQuoteRequestSymbols;
      else window._aioQuoteRequestSymbols = prevQuoteRequestSymbols;
    }
    var result = {
      status: out.some(function(x) { return !x.ok && !x.skipped; }) ? 'warn' : 'ok',
      results: out,
      scheduler: window.AIO.getRefreshSchedulerAudit(),
      generatedAt: new Date().toISOString()
    };
    _aioEmitRefreshEvent('done', {
      runId: runId,
      status: result.status,
      total: list.length,
      done: out.length,
      keys: list.slice(),
      pageId: runPageId,
      reason: runReason,
      symbols: runSymbols.slice(),
      forceRefresh: forceAll,
      durationMs: Date.now() - startedAt,
      results: out.slice()
    });
    return result;
  };

  window._aioRefreshTaskLabel = _aioRefreshTaskLabel;
  window._aioEmitRefreshEvent = _aioEmitRefreshEvent;
  window._aioMarkSchedulerFetch = _aioMarkSchedulerFetch;
  window._normalizeRefreshSchedule = _normalizeRefreshSchedule;
  window._runScheduledTask = _runScheduledTask;
  window._assignRefreshScheduleFunctions = _assignRefreshScheduleFunctions;
  window.startDataScheduler = startDataScheduler;
  window._aioGetRefreshProfile = _aioGetRefreshProfile;
  window._aioGetComprehensiveSymbols = _aioGetComprehensiveSymbols;
  window.restartScheduler = restartScheduler;
  window._aioPageRefreshLast = _aioPageRefreshLast;
  window._aioPageRefreshControllers = _aioPageRefreshControllers;
  return window;
}
