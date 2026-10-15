// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-macro-tech.js — P1135/R620: index.html 인라인 블록 B(1,174줄)에서 추출한 매크로/기술 렌더 계층.
// computeMarketHealth 순수 호환 wrapper (v57.77: legacy health renderer와 native fence 삭제;
// v57.76: the SPY indicator/stage/MTF/pattern writers were deleted)
// (P1425: the 거시 writers moved to native ESM boards).
//
// 왜 별도 파일이고 왜 aio-pages.js보다 앞에 로드되는가: js/aio-ui.js가 자기 모듈 평가 시점에
// computeMarketHealth를 호출한다(ui:5047 → ui:5087). 원래 이 블록은 core보다 먼저 실행되는 인라인이었고,
// aio-pages.js 뒤로 밀자 ui가 ReferenceError로 죽어 _aioRenderTickerOverview가 정의되지 않았다(실브라우저 검출).
// 추출은 실행 "위치"를 보존해야 한다 — 그래서 이 파일은 defer로 core 앞에 놓인다.
// ═══════════════════════════════════════════════════════════════════════════════

// P1135/R620: index.html 인라인 블록 B(매크로/기술 렌더 1,175줄)를 여기로 접었다.
// 이 블록은 렌더러 계층이므로 새 파일을 만들지 않고 페이지 렌더러 홈(aio-pages.js)에
// 넣는다 — 추출 모듈은 이미 등록돼 있고, 새 파일은 등록 7곳을 다시 요구한다.
// 포함: computeMarketHealth 인라인 구현 (v57.76: SPY 지표·패턴 writer 퇴역).
// ───────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
//  TECHNICAL ANALYSIS & MACRO — DYNAMIC JS ENGINE
// ═══════════════════════════════════════════════════════════════

// ── Market Health Score compatibility wrapper ──
// P785: the formula lives in src/domain/market/health.js. v57.77: this wrapper is pure. The legacy
// renderer (health-score/grade/regime displays, hc-*-bar, health-interpretation) and its native fence
// were deleted with their DOM; tech-health-pill is written by src/ui/pages/analysis.js. Callers
// (aio-core ticker gate, src/data/runtime-readers.js) read only the returned model.
function computeMarketHealth() {
  var rawQuotes = window._liveData || {};
  var currentQuotes = {};
  // The pure model intentionally has no runtime freshness policy.  The
  // compatibility adapter must therefore pass only quote rows whose source,
  // observation time, quality and explicit decision grant all pass the same
  // envelope used by the trading score.
  Object.keys(rawQuotes).forEach(function(sym) {
    var priceMetric = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(sym, 'price', null) : null;
    var pctMetric = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(sym, 'pct', null) : null;
    if ((priceMetric && priceMetric.allowedUse === true) || (pctMetric && pctMetric.allowedUse === true)) {
      currentQuotes[sym] = {
        price: priceMetric && priceMetric.allowedUse === true ? priceMetric.value : null,
        pct: pctMetric && pctMetric.allowedUse === true ? pctMetric.value : null,
        observedAt: priceMetric && priceMetric.allowedUse === true ? priceMetric.ts : pctMetric && pctMetric.ts,
        sourceKind: priceMetric && priceMetric.allowedUse === true ? priceMetric.sourceKind : pctMetric && pctMetric.sourceKind,
        allowedUse: 'decision'
      };
    }
  });
  var model = window.AIO_ARCH && typeof window.AIO_ARCH.computeMarketHealth === 'function'
    ? window.AIO_ARCH.computeMarketHealth({ quotes: currentQuotes, spxMA: window._spxMA || {}, spxATH: window._spxATH })
    : { available: false, score: null, grade: '—', regime: '판정 보류', missing: ['아키텍처 모델'] };
  return model;
}

// v57.76: the 차트 tab no longer shows market-level (SPY) copies of the 시장 상태 judgement. The SPY indicator card
// writer (updateTechIndicators), the SPY moving-average-order and multi-timeframe writers (updateWeinsteinStage/updateMTF)
// and the SPY/VIX pattern-signal writer (updatePatternSignals) were deleted with their DOM. The classification models
// stay in src/domain/technical/stage.js (pinned by architecture/fixtures/weinstein-mtf-golden.json).
// P1425: the 거시 storyline, economic calendar, legacy yield-curve chart, economic thermometer, regime pill and WTI-Brent
// card were retired with their DOM; src/ui/components/macro-board.js renders the 거시 경제 and 금리 · 환율 boards.

// v57.77: the technical page-shown and live-quote hooks that re-ran computeMarketHealth for the
// legacy renderer were deleted with it; the native technical route renders its own summary.

// ═══════════════════════════════════════════════════════════════
// Page chat chips only. Persona/system prompts are owned by js/aio-chat.js.
(function() {
  if (!window.CHAT_DEFAULT_CHIPS) return;
  window.CHAT_DEFAULT_CHIPS.technical = ['기술적 구조 확인','추세 무효화 조건','변동성 점검'];
  window.CHAT_DEFAULT_CHIPS.macro = ['금리·물가 확인','공식 발표 일정','환율 영향 점검'];
  window.CHAT_DEFAULT_CHIPS.options = ['옵션 데이터 상태','변동성 구조 확인','헤지 조건 점검'];
})();

