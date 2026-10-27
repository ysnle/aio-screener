// v59.22 (roadmap 11, layer 3 providers): the relay transport moved out of js/aio-data.js unchanged — the Worker URL
// and /relay helpers (_cfWorkerUrl, _aioRelayUrl, _aioRelayFetch), the shared-Worker host mirror, the proxy registry
// (_PROXY_REGISTRY), the proxy response checks and cache, and fetchViaProxy, which every provider fetch goes through.
// The names stay window globals for the classic callers. src/app/compatibility-globals.js installs this before
// DOMContentLoaded; the registry is built at install as it was when aio-data.js loaded.
// scripts/ci-proxy-continuity-check.mjs runs this file in its offline harness.
export function installProxyTransport(window = globalThis) {
  const _cfWorkerUrl = () => {
    var personal = typeof _getApiKey === 'function' ? _getApiKey('aio_cf_worker_url') : '';
    var config = window.AIO_PUBLIC_CONFIG || {};
    // The public address is not a credential. Data routing is independent of AI
    // entitlement/health; a temporarily unavailable AI model must not disable quotes.
    var address = personal || (config.marketData && config.marketData.workerUrl) || '';
    try {
      var parsed = new URL(address);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return '';
      return parsed.href.replace(/\/+$/, '');
    } catch (_) { return ''; }
  };

  // ── v56: 서버측 키 릴레이 경로 ──────────────────────────────────────────
  // FRED/BOK/KOSIS는 브라우저에서 CORS로 막히므로(FRED) 또는 애초에 CORS 헤더가
  // 없어서(BOK/KOSIS) 개인 키만으로는 살아나지 않는다. Worker의 /relay 는 운영자
  // 키로 대신 조회하므로 클라이언트는 키를 보내지 않는다 — URL에 비밀이 없으므로
  // 제3자 프록시로 새지 않고, 캐시 경로도 민감 분기와 무관하다.
  // Worker 미설정이면 ''를 반환해 호출자가 다음 폴백으로 넘어가게 한다.
  const _aioRelayUrl = (provider, params) => {
    const worker = _cfWorkerUrl();
    if (!worker || !provider) return '';
    let url;
    try { url = new URL(worker + '/relay'); } catch (_) { return ''; }
    url.searchParams.set('provider', provider);
    Object.keys(params || {}).forEach(function(k) {
      const v = params[k];
      if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
    return url.toString();
  };

  // The relay destination is the AIO Worker itself, never a third-party relay, so a
  // direct fetch with the shared app token is the correct transport.
  function _aioRelayFetch(url, timeoutMs) {
    const headers = {};
    try { if (typeof _aioAppToken === 'function') headers['X-AIO-App-Token'] = _aioAppToken(); } catch (_) {}
    return fetchWithTimeout(url, { headers }, timeoutMs || 8000);
  }

  // P1756: the shared Worker relays only these upstream hosts (ALLOWED_DOMAINS in cloudflare-worker-proxy.js; exact host
  // or a subdomain of one). It answered 403 to every other host, so a 4-minute idle on 오늘 spent dozens of requests
  // on feeds it would never relay. scripts/ci-proxy-continuity-check.mjs fails if this copy drifts from the Worker's.
  const _AIO_SHARED_WORKER_HOSTS = [
    'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'finance.yahoo.com',
    'api.rss2json.com', 'rss2json.com',
    'efts.sec.gov', 'data.sec.gov',
    'rsshub.app', 't.me',
    'm.stock.naver.com', 'api.stock.naver.com', 'polling.finance.naver.com', 'api.finance.naver.com', 'fchart.stock.naver.com',
    'api.fear-and-greed.com', 'production.dataviz.cnn.io', 'api.alternative.me',
    'api.coingecko.com',
    'open.er-api.com', 'api.exchangerate-api.com',
    'cdn.cboe.com',
    'translate.googleapis.com', 'translate.google.com'
  ];
  function _aioSharedWorkerRelays(url) {
    var host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (_) { return false; }
    return _AIO_SHARED_WORKER_HOSTS.some(function(d) { return host === d || host.slice(-(d.length + 1)) === '.' + d; });
  }

  const _PROXY_REGISTRY = {
    list: [],
    init: function() {
      var cf = _cfWorkerUrl();
      var previous = this.list;
      var next = [];
      function add(id, label, tier, endpoint, mkUrl) {
        var existing = previous.find(function(p) { return p.id === id && p.endpoint === endpoint; });
        var entry = existing || { id:id, label:label, tier:tier, endpoint:endpoint, mkUrl:mkUrl,
          fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false, retryAt:0, scopes:{} };
        next.push(entry);
        return entry;
      }
      // Tier 0: CF Worker (최우선). 출처를 엔트리에 기록한다 — _cfWorkerUrl() 은 공유 URL도
      // 돌려주지만 개인 키를 실어 보낼 수 있는 것은 사용자가 직접 소유한 Worker뿐이다.
      // v56 이전에는 이 판정이 등록 시점과 전송 시점에 서로 다른 소스를 읽어, 레지스트리가
      // cf-worker 라우트를 광고하면서도 민감 요청을 조용히 버리는 불일치가 있었다.
      if (cf) {
        var personalWorker = typeof _getApiKey === 'function' ? (_getApiKey('aio_cf_worker_url') || '') : '';
        add('cf-worker', 'CF Worker', 0, cf, function(u){ return cf+'?url='+encodeURIComponent(u); }).userOwned = !!personalWorker;
      }
      // 2026-10-13 network audit: corsproxy.io answers 403 to this production origin on every request (its free tier
      // rejects non-development origins), so it only added a failed hop after each Worker miss. Removed from the chain.
      // Tier 2: 보조 프록시
      add('allorigins-raw', 'allorigins/raw', 2, 'https://api.allorigins.win/raw', function(u){ return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u); });
      add('allorigins-get', 'allorigins/get', 2, 'https://api.allorigins.win/get', function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); });
      add('codetabs', 'codetabs.com', 2, 'https://api.codetabs.com/v1/proxy/', function(u){ return 'https://api.codetabs.com/v1/proxy/?quest='+encodeURIComponent(u); });
      this.list = next;
    },
    state: function(p, url) {
      if (!url) return p; // legacy health diagnostics
      var host;
      try { host = new URL(url).hostname; } catch (_) { host = 'invalid'; }
      if (!p.scopes) p.scopes = {};
      return p.scopes[host] || (p.scopes[host] = { fails:0, okCount:0, failCount:0, lastOk:0, lastFail:0, disabled:false, retryAt:0 });
    },
    claim: function(p, url) {
      var state = this.state(p, url);
      if (state.disabled) {
        if (Date.now() < state.retryAt || state.probing) return false;
        state.probing = true; // exactly one half-open probe, no recovery timers
      }
      return true;
    },
    release: function(p, url) { this.state(p, url).probing = false; },
    markOk: function(id, url) {
      var p = this.list.find(function(x){ return x.id === id; });
      if (p) {
        var state = this.state(p, url);
        state.fails = 0; state.okCount = (state.okCount || 0) + 1; state.lastOk = Date.now();
        state.disabled = false; state.cooldownLevel = 0; state.retryAt = 0; state.probing = false;
      }
      if (typeof _reportApiOk === 'function') _reportApiOk('proxy-primary', id + ' 성공');
    },
    markFail: function(id, reason, url, retryAfterMs) {
      var p = this.list.find(function(x){ return x.id === id; });
      if (p) {
        p = this.state(p, url);
        // Concurrent requests already in flight cannot escalate an open circuit.
        if (p.disabled && !p.probing) return;
        var wasProbe = !!p.probing;
        p.probing = false;
        p.fails++;
        p.failCount = (p.failCount || 0) + 1;
        p.lastFail = Date.now();
        // P784/SA-01: three consecutive chart-proxy failures open cooldown.
        if (p.fails >= 3 || wasProbe || reason === 429) {
          p.disabled = true;
          // v48.14 (W13): exponential backoff + jitter — 60s → 120s → 240s → 480s → max 1800s
          p.cooldownLevel = (p.cooldownLevel || 0) + 1;
          var baseDelay = T.COOLDOWN * Math.pow(2, Math.min(p.cooldownLevel - 1, 5)); // 최대 32x
          var jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter (thundering herd 방지)
          var actualDelay = Math.min(Math.max(baseDelay + jitter, Number(retryAfterMs) || 0), 1800000);
          p.retryAt = Date.now() + actualDelay;
          if (typeof _aioLog === 'function') {
            _aioLog('warn', 'proxy', 'proxy ' + id + ' disabled (level ' + p.cooldownLevel + ', cooldown ' + Math.round(actualDelay/1000) + 's)', { fails: p.fails });
          }
        }
      }
    },
    getScore: function(p) {
      if (!p) return 0;
      var ok = p.okCount || 0;
      var fail = p.failCount || 0;
      var attempts = ok + fail;
      var rate = attempts ? ok / attempts : 0.5;
      var recency = p.lastOk ? Math.max(0, 1 - ((Date.now() - p.lastOk) / Math.max(1, T.COOLDOWN * 5))) : 0;
      var tierBias = Math.max(0, 3 - (p.tier == null ? 3 : p.tier)) * 0.08;
      return (rate * 10) + recency + tierBias - ((p.fails || 0) * 0.35);
    },
    getActive: function(url) {
      var self = this;
      return this.list.filter(function(p){ var state = self.state(p, url); return !state.disabled || (Date.now() >= state.retryAt && !state.probing); }).sort(function(a,b){
        // Our controlled route stays first; random rotation never demotes tier 0.
        if (a.tier === 0 || b.tier === 0) return a.tier - b.tier;
        var scoreDiff = self.getScore(b) - self.getScore(a);
        if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
        var tierDiff = (a.tier == null ? 9 : a.tier) - (b.tier == null ? 9 : b.tier);
        if (tierDiff) return tierDiff;
        return (b.lastOk || 0) - (a.lastOk || 0);
      });
    },
    // 하위 호환: mkUrl 함수 배열 반환 (기존 PROXY_LIST 형태)
    getMkUrls: function(url) { return this.getActive(url).map(function(p){ return p.mkUrl; }); },
    // v35.7 CF Worker 부하 분산: 라운드로빈 카운터
    _rrIndex: 0,
    getRotated: function(url) { return this.getActive(url); }
  };
  _PROXY_REGISTRY.init();
  window.addEventListener('aio:publicConfig', function() { _PROXY_REGISTRY.init(); });


  function _aioProxyUrlExpectsJson(url) {
    url = String(url || '');
    return /\/api\/|\/v\d+\/finance\/chart|finance\/chart|query[12]\.finance\.yahoo\.com|m\.stock\.naver\.com|polling\.finance\.naver\.com|api\.stock\.naver\.com|production\.dataviz\.cnn\.io|api\.fear-and-greed\.com|api\.alternative\.me|api\.stlouisfed\.org|financialmodelingprep\.com|finnhub\.io|alphavantage\.co|twelvedata\.com/i.test(url);
  }

  function _aioProxyResponseLooksHtml(txt) {
    txt = String(txt || '').trimStart();
    return /^<!doctype\s+html/i.test(txt) || /^<html[\s>]/i.test(txt) || /<title>.*(captcha|access denied|forbidden|blocked|error).*<\/title>/i.test(txt.slice(0, 800));
  }

  function _aioProxyUnwrapJsonText(txt) {
    var obj = JSON.parse(txt);
    if (obj && typeof obj.contents === 'string') {
      var nested = obj.contents.trim();
      if (_aioProxyResponseLooksHtml(nested)) {
        var err = new Error('proxy returned HTML inside JSON wrapper');
        err.aioProxyBlockedHtml = true;
        throw err;
      }
      try { return JSON.parse(nested); } catch(_) { return obj; }
    }
    return obj;
  }

  async function _aioValidateProxyResponse(url, response, opts) {
    opts = opts || {};
    var expectJson = !!opts.expectJson || !!opts.parseJson || _aioProxyUrlExpectsJson(url);
    var txt = await response.clone().text();
    var probe = txt;
    try {
      var wrapped = JSON.parse(txt);
      if (wrapped && typeof wrapped.contents === 'string') probe = wrapped.contents;
    } catch(_) {}
    if (expectJson && _aioProxyResponseLooksHtml(probe)) {
      var e = new Error('proxy returned HTML for JSON endpoint');
      e.aioProxyBlockedHtml = true;
      throw e;
    }
    var json = expectJson ? _aioProxyUnwrapJsonText(txt) : null;
    if (/\/v8\/finance\/chart\//.test(url)) {
      var requestUrl = new URL(url);
      var symbol = decodeURIComponent(requestUrl.pathname.split('/').pop()).toUpperCase();
      var result = json && json.chart && json.chart.result && json.chart.result[0];
      var meta = result && result.meta, interval = requestUrl.searchParams.get('interval');
      // P1758: a well-formed answer for the wrong identity is the upstream's verdict, not a relay fault.
      var mismatch = !meta || String(meta.symbol || '').toUpperCase() !== symbol ? 'chart symbol mismatch' : (interval && meta.dataGranularity && meta.dataGranularity !== interval ? 'chart interval mismatch' : '');
      if (mismatch) throw Object.assign(new Error(mismatch), { aioUpstreamVerdict: true });
    }
    return { jsonReady: expectJson, json: json, body: expectJson ? JSON.stringify(json) : probe };
  }

  // P1006: exact request identity; deliberately never read the old truncated-key cache.
  function _aioProxyCacheKey(url) {
    return 'aio_proxy_v2_' + encodeURIComponent(url);
  }
  function _aioSensitiveProxyUrl(url) {
    try {
      var parsed = new URL(url);
      return !!(parsed.username || parsed.password) || Array.from(parsed.searchParams.keys()).some(function(key) {
        return /^(?:api[-_]?key|key|token|access[-_]?token|client[-_]?secret|auth|authorization|signature|url|crtfc_key|service_?key|cert_?key)$/i.test(key); // v58.82: DART crtfc_key, data.go.kr serviceKey, KOSIS certkey
      });
    } catch (_) { return true; }
  }
  function _aioProxyReadCache(url) {
    try {
      var entry = JSON.parse(localStorage.getItem(_aioProxyCacheKey(url)) || 'null');
      var age = entry && Date.now() - entry.collectedAt;
      return entry && entry.schema === 2 && entry.url === url && Number.isFinite(age) && age >= 0 && age <= 21600000 && typeof entry.body === 'string' ? entry : null;
    } catch (_) { return null; }
  }
  function _aioProxyWriteCache(entry) {
    if (entry.body.length > 262144 || entry.url.length > 2048) return;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('aio_proxy_v2_') === 0) keys.push(key);
      }
      // Bounded last-good store; remove only this transport's own entries.
      keys.sort(function(a, b) {
        try { return JSON.parse(localStorage.getItem(a)).collectedAt - JSON.parse(localStorage.getItem(b)).collectedAt; } catch (_) { return 0; }
      });
      var target = _aioProxyCacheKey(entry.url);
      keys = keys.filter(function(key) { return key !== target; });
      while (keys.length >= 32) localStorage.removeItem(keys.shift());
      localStorage.setItem(target, JSON.stringify(entry));
    } catch (_) { /* storage failure must not discard a valid network response */ }
  }
  async function _aioProxyDeliver(entry, opts, cacheState) {
    var provenance = { provider:entry.provider, sourceUrl:entry.url, collectedAt:entry.collectedAt,
      cacheState:cacheState, stale:cacheState === 'stale-cache' };
    var response = new Response(entry.body, { status:200, headers:{
      'Content-Type':entry.contentType || 'text/plain', 'X-AIO-Source':entry.provider,
      'X-AIO-Cache':cacheState, 'X-AIO-Collected-At':String(entry.collectedAt),
      'X-AIO-Stale':provenance.stale ? 'true' : 'false'
    } });
    var validation = await _aioValidateProxyResponse(entry.url, response, opts);
    var payload = opts.parseJson ? validation.json : opts.parseText ? validation.body : new Response(validation.body, { status:200, headers:response.headers });
    if (typeof opts.accept === 'function' && !await opts.accept(payload)) throw Object.assign(new Error('invalid-payload'), { aioUpstreamVerdict: validation.jsonReady });
    if (payload && typeof payload === 'object') Object.defineProperty(payload, '_aioTransport', { value:provenance, configurable:true });
    return payload;
  }

  async function fetchViaProxy(url, timeout) {
    var opts = (timeout && typeof timeout === 'object') ? timeout : {};
    timeout = (opts.timeout || opts.ms || (typeof timeout === 'number' ? timeout : 8000));
    url = new URL(String(url)).href;
    var sensitive = _aioSensitiveProxyUrl(url);
    var active = _PROXY_REGISTRY.getRotated(url);
    // A public proxy must never receive personal provider keys. Only a Worker this
    // user owns (entry.userOwned, recorded at registration from the personal setting)
    // may relay credential-bearing requests; the shared public Worker is rejected even
    // though _cfWorkerUrl() happily returns it for anonymous traffic.
    if (sensitive) active = active.filter(function(p) { return p.id === 'cf-worker' && p.userOwned === true; });
    // P1756: the shared Worker refuses hosts outside its allowlist (403), so such a URL goes straight to the next relay.
    // A Worker the user deployed may allow more, so it is still tried.
    else if (!_aioSharedWorkerRelays(url)) active = active.filter(function(p) { return !(p.id === 'cf-worker' && p.userOwned !== true); });
    // Per-proxy timeouts are not enough when the registry falls back sequentially.
    // A shared deadline aborts the current attempt and prevents a 5× timeout hang.
    var deadlineCtrl = new AbortController();
    var externalSignal = opts.signal;
    var relayAbort = function() { try { deadlineCtrl.abort(); } catch(_) {} };
    if (externalSignal) {
      if (externalSignal.aborted) relayAbort();
      else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayAbort, { once: true });
    }
    var totalTimeout = Number(opts.totalTimeout || opts.deadline || 0);
    if (!isFinite(totalTimeout) || totalTimeout <= 0) totalTimeout = Math.max(timeout, Math.min(timeout * Math.max(1, active.length), 15000));
    var deadlineTimer = setTimeout(relayAbort, totalTimeout);
    var errors = [], upstreamVerdict = false;
    try {
      for (var i = 0; i < active.length; i++) {
        // P1758: once the Worker relayed a definitive upstream answer (missing symbol, unauthorized, wrong identity), a
        // public relay would fetch the same answer — the chain stops; it continues only for relay faults (5xx/403/429/timeout).
        if (deadlineCtrl.signal.aborted || upstreamVerdict) break;
        var proxy = active[i];
        if (!_PROXY_REGISTRY.claim(proxy, url)) continue;
        var attemptCtrl = new AbortController();
        var attemptAbort = function() { attemptCtrl.abort(); };
        deadlineCtrl.signal.addEventListener('abort', attemptAbort, { once:true });
        var attemptTimer = setTimeout(attemptAbort, timeout);
        try {
          var r = await fetch(proxy.mkUrl(url), { signal:attemptCtrl.signal, credentials:'omit' });
          if (!r.ok) {
            var retryHeader = r.headers.get('retry-after');
            var retryMs = /^\d+$/.test(retryHeader || '') ? Number(retryHeader) * 1000 : Date.parse(retryHeader || '') - Date.now();
            errors.push({ provider:proxy.id, status:r.status });
            upstreamVerdict = proxy.tier === 0 && [400, 401, 404, 410, 422].indexOf(r.status) >= 0;
            // A missing ticker/endpoint is not proof the entire relay is broken.
            if ([400, 401, 404, 410, 422].indexOf(r.status) === -1) _PROXY_REGISTRY.markFail(proxy.id, r.status, url, retryMs);
            continue;
          }
          // The attempt timer stays alive while the body is read and validated.
          var validated = await _aioValidateProxyResponse(url, r, opts);
          var entry = { schema:2, url:url, body:validated.body, collectedAt:Date.now(), provider:proxy.id,
            contentType:validated.jsonReady ? 'application/json' : r.headers.get('content-type') };
          var payload = await _aioProxyDeliver(entry, opts, 'network');
          if (attemptCtrl.signal.aborted) throw new Error('response deadline exceeded');
          _PROXY_REGISTRY.markOk(proxy.id, url);
          if (!sensitive && opts.cache !== false) _aioProxyWriteCache(entry);
          return payload;
        } catch(e) {
          upstreamVerdict = proxy.tier === 0 && !attemptCtrl.signal.aborted && !!(e && e.aioUpstreamVerdict);
          if (!deadlineCtrl.signal.aborted && !upstreamVerdict) _PROXY_REGISTRY.markFail(proxy.id, e && e.aioProxyBlockedHtml ? 'html' : 'network-or-payload', url);
          errors.push({ provider:proxy.id, reason:attemptCtrl.signal.aborted ? 'timeout' : upstreamVerdict ? 'upstream-verdict' : 'network-or-payload' });
        } finally {
          clearTimeout(attemptTimer);
          deadlineCtrl.signal.removeEventListener('abort', attemptAbort);
          _PROXY_REGISTRY.release(proxy, url);
        }
      }
    } finally {
      clearTimeout(deadlineTimer);
      if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayAbort);
    }
    if (externalSignal && externalSignal.aborted) {
      var callerAbort = new Error('proxy request aborted by caller');
      callerAbort.name = 'AbortError';
      throw callerAbort;
    }
    if (!upstreamVerdict && typeof _reportApiError === 'function') _reportApiError('proxy-primary', '전체 프록시 실패');
    // Cached research is opt-in. Legacy callers must not label an old response LIVE.
    if (!sensitive && opts.allowStale === true) {
      var cached = _aioProxyReadCache(url);
      if (cached) { try { return await _aioProxyDeliver(cached, opts, 'stale-cache'); } catch (_) {} }
    }
    var failure = new Error('시세/자료 연결 실패: 사용 가능한 중계 경로 없음');
    failure.code = upstreamVerdict ? 'UPSTREAM_REJECTED' : sensitive && !active.length ? 'PRIVATE_ROUTE_REQUIRED' : 'PROXY_UNAVAILABLE';
    // Distinguish the two reasons a credential-bearing URL has no route, so the UI
    // and logs stop implying "the shared Worker is broken" when it is simply not
    // trusted with personal keys.
    if (failure.code === 'PRIVATE_ROUTE_REQUIRED') {
      failure.hint = '이 요청은 개인 키를 URL에 포함하므로 사용자가 직접 소유한 Worker로만 중계할 수 있습니다. 공유 Worker는 개인 키를 받지 않습니다 — 운영자 키를 쓰는 소스(BOK/KOSIS)는 /relay 경로를 사용하세요.';
    }
    failure.attempts = errors;
    throw failure;
  }

  window._cfWorkerUrl = _cfWorkerUrl;
  window._aioRelayUrl = _aioRelayUrl;
  window._aioRelayFetch = _aioRelayFetch;
  window._AIO_SHARED_WORKER_HOSTS = _AIO_SHARED_WORKER_HOSTS;
  window._aioSharedWorkerRelays = _aioSharedWorkerRelays;
  window._PROXY_REGISTRY = _PROXY_REGISTRY;
  window._aioProxyUrlExpectsJson = _aioProxyUrlExpectsJson;
  window._aioProxyResponseLooksHtml = _aioProxyResponseLooksHtml;
  window._aioProxyUnwrapJsonText = _aioProxyUnwrapJsonText;
  window._aioValidateProxyResponse = _aioValidateProxyResponse;
  window._aioProxyCacheKey = _aioProxyCacheKey;
  window._aioSensitiveProxyUrl = _aioSensitiveProxyUrl;
  window._aioProxyReadCache = _aioProxyReadCache;
  window._aioProxyWriteCache = _aioProxyWriteCache;
  window._aioProxyDeliver = _aioProxyDeliver;
  window.fetchViaProxy = fetchViaProxy;
  return window;
}
