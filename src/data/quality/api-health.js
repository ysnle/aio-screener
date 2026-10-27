// v59.18 (roadmap 11, layer 2 quality/evidence): the source-health state moved out of js/aio-core.js unchanged — the
// per-API health registry (window._apiHealth), the external source state contract (AIO.normalizeExternalSourceState /
// AIO.setExternalSourceState) and the two reporters every fetch calls (_reportApiOk / _reportApiError). The data-status
// panel and the stale-source banner they repaint stay in js/aio-core.js (_renderApiDashboard, _checkAllDeadBanner) with
// the other writers of those elements. src/app/compatibility-globals.js installs this before any fetch runs.
export function installApiHealth(window = globalThis, document = globalThis.document) {
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


  // v52.56 H3-E: 외부 소스 상태 계약 — 성공/부분/타임아웃/형식오류를
  // 콘솔 로그와 분리해 UI·폴백·의사결정 계층이 동일하게 소비한다.
  window.AIO = window.AIO || {};
  window.AIO_EXTERNAL_STATES = window.AIO_EXTERNAL_STATES || {};
  window.AIO.normalizeExternalSourceState = function(input) {
    var x = input && typeof input === 'object' ? input : { status: input };
    var raw = String(x.status || x.state || '').toLowerCase();
    var msg = String(x.message || x.error || '').toLowerCase();
    var status = 'unavailable';
    if (raw === 'success' || raw === 'ok' || x.ok === true) status = 'success';
    else if (raw === 'partial' || (Number(x.count) > 0 && Number(x.expected) > Number(x.count))) status = 'partial';
    else if (raw === 'timeout' || /timeout|timed out|abort/.test(raw + ' ' + msg)) status = 'timeout';
    else if (raw === 'malformed' || raw === 'parse-error' || /malformed|parse|invalid|html|content-type/.test(raw + ' ' + msg)) status = 'malformed';
    var declaredUse = x.allowedUse != null ? x.allowedUse : x.decisionUse != null ? x.decisionUse : x.operationalUse;
    var explicitDecisionUse = _aioExplicitDecisionUse(declaredUse);
    var observedTs = _aioMetricTs(x.observedAt != null ? x.observedAt : x.asOf != null ? x.asOf : x.ts);
    var quality = x.quality || x.dataQuality || x.qualityEnvelope || null;
    var qualityReady = _aioDecisionQualityReady(quality);
    // A fetch-success status is transport evidence only.  It becomes a
    // decision-use state only when the producer supplies an explicit grant,
    // an observation timestamp/freshness envelope, and a passing quality gate.
    var successDecisionReady = status === 'success' && explicitDecisionUse && observedTs != null && qualityReady;
    var policy = {
      success:   { label: '정상 수신', allowedUse: successDecisionReady ? 'decision' : 'reference-only', usable: true },
      partial:   { label: '부분 수신', allowedUse: 'reference-only', usable: true },
      timeout:   { label: '응답 시간 초과', allowedUse: 'none', usable: false },
      malformed: { label: '응답 형식 오류', allowedUse: 'none', usable: false },
      unavailable:{ label: '외부 수집 실패', allowedUse: 'none', usable: false }
    }[status];
    return { status: status, label: policy.label, allowedUse: policy.allowedUse, usable: policy.usable,
      decisionUse: policy.allowedUse === 'decision', explicitDecisionUse: explicitDecisionUse,
      observedAt: observedTs != null ? new Date(observedTs).toISOString() : null,
      qualityReady: qualityReady, promotionBlocked: status === 'success' && !successDecisionReady,
      count: x.count != null && Number.isFinite(Number(x.count)) ? Number(x.count) : null,
      expected: x.expected != null && Number.isFinite(Number(x.expected)) ? Number(x.expected) : null,
      reason: x.reason || x.message || (status === 'success' && !successDecisionReady ? 'explicit decision authorization, observation freshness, and quality evidence are required' : null) };
  };
  window.AIO.setExternalSourceState = function(source, input, detail) {
    var key = String(source || 'unknown');
    var normalized = window.AIO.normalizeExternalSourceState(input);
    var prev = window.AIO_EXTERNAL_STATES[key];
    var next = Object.assign({}, normalized, detail || {}, { source: key, updatedAt: Date.now() });
    window.AIO_EXTERNAL_STATES[key] = next;
    try {
      document.dispatchEvent(new CustomEvent('aio:external-source-state', { detail: next, bubbles: false }));
    } catch(_) {}
    return next;
  };

  function _reportApiOk(apiKey, msg) {
    var h = window._apiHealth[apiKey];
    if (!h) return;
    var prevStatus = h.status;
    h.status = 'ok'; h.lastOk = Date.now(); h.errCount = 0; h.lastMsg = msg || '';
    if (window.AIO && typeof window.AIO.setExternalSourceState === 'function') window.AIO.setExternalSourceState('api:' + apiKey, { status: 'success', message: msg });
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
    if (window.AIO && typeof window.AIO.setExternalSourceState === 'function') window.AIO.setExternalSourceState('api:' + apiKey, { message: msg, status: /timeout|abort/i.test(String(msg || '')) ? 'timeout' : /parse|html|malformed|invalid/i.test(String(msg || '')) ? 'malformed' : 'unavailable' });
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

  window._reportApiOk = _reportApiOk;
  window._reportApiError = _reportApiError;
  return window;
}
