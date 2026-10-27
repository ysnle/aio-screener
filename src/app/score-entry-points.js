// v59.41 (roadmap 11, layer 5 score): the score entry points moved out of the classic scripts unchanged —
// computeTradingScore (js/aio-core.js), computeNewsSentimentScore/computeNewsRiskSignals (js/aio-data.js) and
// AIO.diagnoseBreadthConsensus (js/aio-core.js; its body is src/domain/market/breadth-consensus.js). The models
// themselves already live in src/domain (signal/trading-score.js, news/scoring.js). newsCache and _aioLog stay
// declared in the classic scripts; a module resolves those names in the shared global scope.
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
import { diagnoseBreadthConsensus } from '../domain/market/breadth-consensus.js';

export function installScoreEntryPoints(window = globalThis) {
  /* ── 뉴스→시그널 통합: 뉴스 감성 집계 ─────────────────────── */
  // RM-03 (continued): single-implementation calls — scoring formulas live in
  // src/domain/news/scoring.js (computeNewsSentimentScore/computeNewsRiskSignals), exposed via
  // window.AIO_ARCH so these legacy wrappers and any native consumer share one model (R352/F-03).
  function computeNewsSentimentScore(items) {
    var sourceItems = Array.isArray(items) ? items : newsCache;
    var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsSentimentScore === 'function' ? window.AIO_ARCH.computeNewsSentimentScore : null;
    if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
    // P1285/R635: without the shared eligibility/minimum-sample model, legacy
    // compatibility must not publish its old neutral baseline as an observation.
    return { score: null, label: '분석 엔진 준비 중', bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0, sampleSufficient: false };
  }

  /* ── 뉴스→시그널 통합: 매크로 리스크 집계 ──────────────────── */
  function computeNewsRiskSignals(items) {
    var sourceItems = Array.isArray(items) ? items : newsCache;
    var _fn = window.AIO_ARCH && typeof window.AIO_ARCH.computeNewsRiskSignals === 'function' ? window.AIO_ARCH.computeNewsRiskSignals : null;
    if (_fn) return _fn({ items: sourceItems || [], now: Date.now() });
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // v51.98/Phase 3 [A3]: 매매 알고리즘 핵심 — index.html 인라인에서 이관
  // (FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md §7 A3, _context/BUG-POSTMORTEM.md P594).
  // 왜: 이 앱의 중심 알고리즘이 모듈이 아닌 index.html 인라인에 있어 aio-core.js/aio-data.js/
  //     aio-ui.js 5곳이 `typeof computeTradingScore === 'function'` 방어 호출로 역참조하는
  //     구조적 역전이 있었다(_ldSafe 등 이 코드가 의존하는 헬퍼는 이미 이 파일에 있었음).
  //     순수 재배치 — 로직/가중치 변경 없음. 유일한 예외: computeTradingScore의 4순위(죽은)
  //     DOM 텍스트 파싱 폴백 제거(아래 주석 참조, A5 발견사항).
  // ═══════════════════════════════════════════════════════════════════
  // ── Trading Score Computation ─────────────────────────────────────
  function computeTradingScore(mode, opts) {
    opts = opts || {};
    // R670/P1357: 점수는 직전 미국장 종가 기준이며 장중 참고 관측과 분리한다.
    // P553/R244: 호출부 16곳(헤더 텍스트·게이지·카드 등)이 각자 다른 이벤트(aio:liveQuotes vs
    // aio:marketStateUpdated)에서 독립적으로 이 함수를 재호출하면, 그 사이 실시간 입력값
    // (breadth200/putCallRatio/뉴스감성 등)이 바뀌어 같은 화면에 서로 다른 점수가 동시에 노출되는
    // 문제가 있었다(52 vs 64). 짧은 TTL 캐시로 "동시에 보이는 모든 표시가 항상 같은 값"을 보장하면서,
    // 실제 라이브 갱신 주기(30~60s)보다 훨씬 짧아 신선도 손실은 없다.
    var _cacheKey = mode || 'default';
    window._aioScoreCache = window._aioScoreCache || {};
    var _cached = window._aioScoreCache[_cacheKey];
    var _canonicalScore = window.AIO_ARCH && window.AIO_ARCH.getState ? window.AIO_ARCH.getState('analysis.tradingScore') || null : null; // P1755: path read, no full-store clone
    if (!opts.forceFresh && _cached && _cached.canonicalScore === _canonicalScore && (Date.now() - _cached.ts) < 20000) return _cached.result;
    // P1328/R670: one input path. The native reader (src/data/runtime-readers.js decisionInputs)
    // selects decision-grade evidence first and otherwise the latest completed US regular close
    // ("직전 미국장 종가 기준", the v37.1 intent), so this wrapper no longer assembles its own copy.
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
