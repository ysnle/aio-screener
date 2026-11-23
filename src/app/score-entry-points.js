import { diagnoseBreadthConsensus } from '../domain/market/breadth/breadth-consensus.js';

export function installScoreEntryPoints(window = globalThis) {
  /* ── 뉴스→시그널 통합: 뉴스 감성 집계 ─────────────────────── */
  // RM-03 (continued): single-implementation calls — scoring formulas live in
  // src/domain/news/scoring.js (computeNewsSentimentScore/computeNewsRiskSignals), exposed via
  // window.AIO_ARCH so these legacy wrappers and any native consumer share one model (R352/F-03).
  function computeNewsSentimentScore(items) {
    var sourceItems = Array.isArray(items) ? items : newsCache;
    var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsSentimentScore === 'function' ? window.AIO_ARCH.computeNewsSentimentScore : null;
    if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
    return { score: null, label: '분석 엔진 준비 중', bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0, sampleSufficient: false };
  }

  /* ── 뉴스→시그널 통합: 매크로 리스크 집계 ──────────────────── */
  function computeNewsRiskSignals(items) {
    var sourceItems = Array.isArray(items) ? items : newsCache;
    var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsRiskSignals === 'function' ? window.AIO_ARCH.computeNewsRiskSignals : null;
    if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
    return [];
  }

  function computeTradingScore(mode, opts) {
    opts = opts || {};
    var _cacheKey = mode || 'default';
    window._aioScoreCache = window._aioScoreCache || {};
    var _cached = window._aioScoreCache[_cacheKey];
    var _canonicalScore = window.AIO_ARCH && window.AIO_ARCH.getState ? window.AIO_ARCH.getState('analysis.tradingScore') || null : null;
    if (!opts.forceFresh && _cached && _cached.canonicalScore === _canonicalScore && (Date.now() - _cached.ts) < 20000) return _cached.result;
    var _fgMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg', { maxAgeMs: 4 * 60 * 60 * 1000 }) : null;
    var _modelFn = window.AIO_ARCH && typeof window.AIO_ARCH.computeTradingScoreModel === 'function' ? window.AIO_ARCH.computeTradingScoreModel : null;
    var _readInputs = typeof window._aioReadTradingScoreInputs === 'function' ? window._aioReadTradingScoreInputs : null;
    var _nativeInputs = null;
    try { _nativeInputs = _readInputs ? _readInputs() : null; } catch (e) { _aioLog('warn', 'render', 'score inputs unavailable: ' + (e && e.message || e)); }
    var modelResult = _modelFn && _nativeInputs ? _modelFn(Object.assign({}, _nativeInputs, mode ? { mode: mode } : {})) : {
      // Fail-closed fallback when the ESM architecture runtime never mounted.
      total: null, score: null, volScore: null, momScore: null, trendScore: null, breadthScore: null, macroScore: null,
      componentCoveragePct: 0, componentMissing: ['volatility','momentum','trend','breadth','macro'], partial: true,
      decisionBlocked: true, decisionCoverageThreshold: 80
    };

    var evidenceAudit = (window.AIO && window.AIO.getTradingDecisionInputEvidence) ? window.AIO.getTradingDecisionInputEvidence() : null;
    var provenanceBundle = opts.provenanceBundle || ((window.AIO && window.AIO.getDecisionEvidenceBundle) ? window.AIO.getDecisionEvidenceBundle() : null);
    var _result = Object.assign({}, modelResult, { neutralizedMissing: [], evidenceStatus: evidenceAudit && evidenceAudit.status || 'unknown', evidenceAudit: evidenceAudit,
      fgEvidenceStatus: _fgMetric ? _fgMetric.status : 'UNAVAILABLE', fgEvidenceAllowedUse: _fgMetric ? (_fgMetric.allowedUse === 'decision' ? 'decision' : 'reference') : 'none',
      evidenceId: provenanceBundle && provenanceBundle.bundleId || '', provenanceBundle: provenanceBundle });
    window._aioScoreCache[_cacheKey] = { result: _result, ts: Date.now(), canonicalScore: _canonicalScore };
    return _result;
  }

  window.computeNewsSentimentScore = computeNewsSentimentScore;
  window.computeNewsRiskSignals = computeNewsRiskSignals;
  window.computeTradingScore = computeTradingScore;
  window.AIO = window.AIO || {};
  window.AIO.diagnoseBreadthConsensus = function(signals) {
    return diagnoseBreadthConsensus(signals, window.AIO_THRESHOLD_REGISTRY);
  };
  return window;
}
