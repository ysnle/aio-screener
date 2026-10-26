// Legacy unification (2026-10-26, roadmap item 11, layer 1 채팅): the shared AI transport moved here unchanged from
// js/aio-chat.js, so the boot code that checks or calls the shared Worker route (the quota badge, translation, the
// feedback form, the connections panel) no longer needs the chat file. It covers the v54.69 chat cancellation helpers,
// the route target, the app token, the Worker health check with its cache, the route notices and the single paid
// fetch. The window names are the ones the classic scripts already call; installCompatibilityGlobals installs them.

export function installSharedRoute(window = globalThis) {
  // v54.69 chat-resilience: every per-page turn owns a cancellation token and
  // epoch.  Network promises cannot always be cancelled (for example a legacy
  // data helper may not accept AbortSignal), so the epoch guard is the second
  // boundary that prevents stale callbacks from publishing into a newer turn.
  function _aioChatAbortError(reason) {
    var error = new Error(String(reason || 'aborted'));
    error.name = 'AbortError';
    error.code = 'ABORTED';
    return error;
  }

  function _aioThrowIfChatAborted(signal) {
    if (signal && signal.aborted) throw _aioChatAbortError(signal.reason || 'aborted');
  }

  async function _aioRunChatTask(task, options) {
    options = options || {};
    _aioThrowIfChatAborted(options.signal);
    var controller = new AbortController();
    var unlink = _aioLinkChatAbortSignal(options.signal, controller);
    var timer, abortListener;
    try {
      return await Promise.race([
        Promise.resolve().then(function() { return task(controller.signal); }),
        new Promise(function(_, reject) {
          abortListener = function() { reject(_aioChatAbortError(controller.signal.reason)); };
          controller.signal.addEventListener('abort', abortListener, { once: true });
          timer = setTimeout(function() {
            var error = new Error('RESEARCH_TIMEOUT'); error.code = 'RESEARCH_TIMEOUT';
            reject(error); controller.abort('timeout');
          }, Math.max(1, Number(options.timeoutMs) || 12000));
        })
      ]);
    } finally {
      clearTimeout(timer); unlink();
      controller.signal.removeEventListener('abort', abortListener);
    }
  }

  function _aioLinkChatAbortSignal(source, target) {
    if (!source || !target || typeof target.abort !== 'function') return function() {};
    var onAbort = function() {
      try { target.abort(source.reason || 'aborted'); } catch (_) { try { target.abort(); } catch (_) {} }
    };
    if (source.aborted) onAbort();
    else if (typeof source.addEventListener === 'function') source.addEventListener('abort', onAbort, { once: true });
    return function() { if (typeof source.removeEventListener === 'function') source.removeEventListener('abort', onAbort); };
  }

  // Responses streaming uses the published shared Worker route and budget.
  // Legacy function names remain the compatibility boundary; personal AI keys are inactive.
  function _aioClaudeTarget() {
    try {
      var publicCfg = window.AIO && typeof window.AIO.getPublicConfig === 'function' ? window.AIO.getPublicConfig() : null;
      if (publicCfg && publicCfg.ai && publicCfg.ai.routeStatus === 'DISABLED') return null; // P1424: a held route is not a generation entitlement.
      var publicWorker = publicCfg && publicCfg.ai && typeof publicCfg.ai.workerUrl === 'string' ? publicCfg.ai.workerUrl.trim().replace(/\/+$/, '') : '';
      var healthPath = (publicCfg && publicCfg.ai && publicCfg.ai.healthPath) || '/health';
      if (publicWorker) return { url: publicWorker + '/openai', healthUrl: publicWorker + healthPath, workerUrl: publicWorker, serverKey: true, source: 'public-config' };
    } catch(_) {}
    return null;
  }
  window._aioClaudeTarget = _aioClaudeTarget;

  // v52.47 WO-1B: Worker /anthropic 라우트에 실어보내는 공유 앱 토큰. 공개 클라이언트 JS에
  // 그대로 노출되므로 진짜 비밀이 아니다 — Worker(cloudflare-worker-proxy.js)가 이 값과 동일한
  // env.AIO_APP_TOKEN을 설정했을 때만 "URL만 아는" curl/스크립트 남용을 거르는 최소 방어선으로
  // 쓰인다(운영자가 설정 안 하면 Worker가 이 헤더를 아예 검사하지 않음 — 하위호환).
  function _aioAppToken() { return 'aio-screener-app-v1'; }
  window._aioAppToken = _aioAppToken;

  function _aioHasClaudeRoute(apiKey) {
    var target = _aioClaudeTarget(apiKey);
    return !!(target && target.serverKey);
  }
  window._aioHasClaudeRoute = _aioHasClaudeRoute;

  var _aioWorkerHealthCache = window._aioWorkerHealthCache || {};
  var _aioWorkerHealthInFlight = {};
  function _aioSetChatRuntimeState(name, value) {
    try { window[name] = value; } catch (_) {}
    if (name === '_aioLastClaudeRouteState') {
      try { window.dispatchEvent(new CustomEvent('aio:workerHealth')); } catch (_) {}
    }
    return value;
  }
  // v58.63 (architecture audit A16): one health lifetime. The fetch (and its one quiet retry) aborts at this bound, and the
  // wait around it lasts slightly longer, so an 8.5s healthy answer on a slow phone is no longer a RESEARCH_TIMEOUT that
  // the cache then records as READY a moment later.
  var _AIO_HEALTH_TIMEOUT_MS = 12000;
  async function _aioEnsureClaudeRoute(apiKey) {
    var routeOptions = arguments.length > 1 ? arguments[1] || {} : {};
    var routeSignal = routeOptions.signal;
    _aioThrowIfChatAborted(routeSignal);
    if (window.AIO && typeof window.AIO.loadPublicConfig === 'function') await window.AIO.loadPublicConfig();
    _aioThrowIfChatAborted(routeSignal);
    var target = _aioClaudeTarget(apiKey);
    if (!target || !target.serverKey) {
      _aioSetChatRuntimeState('_aioLastClaudeRouteState', { ok: false, target: target, reason: 'NO_ROUTE', checkedAt: Date.now() });
      return window._aioLastClaudeRouteState;
    }
    var now = Date.now();
    var cached = _aioWorkerHealthCache[target.workerUrl];
    var cacheTtl = cached && cached.ok ? 60000 : 5000;
    if (cached && now - cached.checkedAt < cacheTtl) {
      _aioSetChatRuntimeState('_aioLastClaudeRouteState', cached);
      return cached;
    }
    if (!_aioWorkerHealthInFlight[target.workerUrl]) {
      _aioWorkerHealthInFlight[target.workerUrl] = (async function() {
        var ctrl = new AbortController();
        var timer = setTimeout(function() { ctrl.abort(); }, _AIO_HEALTH_TIMEOUT_MS); // P1653: slow mobile networks timed out at 7s and refused the question
        try {
          var _healthInit = { method: 'GET', cache: 'no-store', credentials: 'omit', headers: { 'X-AIO-App-Token': _aioAppToken() }, signal: ctrl.signal }; var response = await fetch(target.healthUrl, _healthInit).catch(async function(firstError) { if (ctrl.signal.aborted) throw firstError; await new Promise(function(resolve) { setTimeout(resolve, 1200); }); return fetch(target.healthUrl, _healthInit); }); // one quiet retry for a dropped mobile connection
          var payload = await response.json().catch(function() { return null; });
          var access = window.AIO && window.AIO.describeSharedConnection ? window.AIO.describeSharedConnection(payload, response.ok) : { ok: false, reason: 'WORKER_NOT_READY' };
          var ready = access.ok;
          var result = { ok: ready, reason: access.reason, target: target, checkedAt: Date.now(), health: payload };
          _aioWorkerHealthCache[target.workerUrl] = result;
          if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') window.AIO.updateProviderStatus('aio_cf_worker_url', { connection: ready ? 'READY' : 'NOT_READY', lastError: ready ? null : result.reason });
          return result;
        } catch (e) {
          var failed = { ok: false, reason: 'WORKER_NOT_READY', target: target, checkedAt: Date.now(), error: e && e.message || 'health_failed' };
          _aioWorkerHealthCache[target.workerUrl] = failed;
          if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') window.AIO.updateProviderStatus('aio_cf_worker_url', { connection: 'NOT_READY', lastError: failed.error });
          return failed;
        } finally {
          clearTimeout(timer);
          delete _aioWorkerHealthInFlight[target.workerUrl];
        }
      })();
    }
    var checked;
    try { checked = await _aioRunChatTask(function() { return _aioWorkerHealthInFlight[target.workerUrl]; }, { signal: routeSignal, timeoutMs: _AIO_HEALTH_TIMEOUT_MS + 500 }); }
    catch (error) { if (routeSignal && routeSignal.aborted) throw _aioChatAbortError(routeSignal.reason || 'aborted'); throw error; }
    _aioThrowIfChatAborted(routeSignal);
    _aioSetChatRuntimeState('_aioLastClaudeRouteState', checked);
    return checked;
  }
  window._aioEnsureClaudeRoute = _aioEnsureClaudeRoute;
  Object.defineProperty(window, '_aioRouteNotice', {
    value: function(reason) {
    return ({
      NO_ROUTE: '현재 사용할 수 있는 AI 연결이 없습니다. 운영자가 공용 AI 연결을 설정한 뒤 다시 시도해 주세요. 작성한 질문은 유지됩니다.',
      VAULT_LOCKED: '공용 AI 연결을 확인하고 다시 시도하세요.',
      WORKER_NOT_READY: '공용 AI 연결이 현재 응답할 준비가 되지 않았습니다. 잠시 후 다시 시도해 주세요. 작성한 질문은 유지됩니다.',
      RATE_LIMIT: 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
      AUTH_FAILED: 'AI 인증에 실패했습니다. 운영자에게 공용 연결 확인을 요청하세요.'
    })[reason] || 'AI 라우트를 확인하지 못했습니다. 잠시 후 다시 시도하세요.';
    },
    configurable: true,
    writable: true
  });

  // An interrupted paid response may already be billed: no blind retry.
  async function _aioFetchClaudeWithRetry(url, fetchOpts, serverKey, maxRetries, options) {
    _aioThrowIfChatAborted(options && options.signal || fetchOpts && fetchOpts.signal);
    return fetch(url, fetchOpts);
  }
  window._aioFetchClaudeWithRetry = _aioFetchClaudeWithRetry;

  window._aioChatAbortError = _aioChatAbortError;
  window._aioThrowIfChatAborted = _aioThrowIfChatAborted;
  window._aioRunChatTask = _aioRunChatTask;
  window._aioLinkChatAbortSignal = _aioLinkChatAbortSignal;
  window._aioWorkerHealthCache = _aioWorkerHealthCache;
  window._aioSetChatRuntimeState = _aioSetChatRuntimeState;
  return window;
}
