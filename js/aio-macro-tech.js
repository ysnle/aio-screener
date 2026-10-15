// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-macro-tech.js — P1135/R620: index.html 인라인 블록 B(1,174줄)에서 추출한 매크로/기술 렌더 계층.
// computeMarketHealth 인라인 구현(및 _aioIsNativeTechnicalHealth/_aioLegacyHealthElement/
// _aioRenderLegacyMarketHealth 네이티브 fence) (v57.76: the SPY indicator/stage/MTF/pattern writers were deleted)
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
// P785: the formula lives in src/domain/market/health.js. This wrapper preserves the
// legacy callable API for entry-check consumers but never writes the technical primary
// surface while the native route renderer owns it.
function _aioIsNativeTechnicalHealth() {
  var page = document.getElementById('page-technical');
  return !!(page && page.dataset.aioTechnicalRenderer === 'native');
}
window._aioIsNativeTechnicalHealth = _aioIsNativeTechnicalHealth;

function _aioLegacyHealthElement(id) {
  return document.querySelector('#' + id);
}

function _aioRenderLegacyMarketHealth(model) {
  var color = model.score >= 65 ? 'var(--data-green)' : model.score >= 50 ? 'var(--data-amber)' : model.score >= 35 ? '#57513f' : 'var(--data-red)';
  var el = _aioLegacyHealthElement('health-score-display');
  if (el) { el.textContent = model.score; el.style.color = color; }
  el = _aioLegacyHealthElement('health-grade-display');
  if (el) { el.textContent = model.grade; el.style.color = color; }
  el = _aioLegacyHealthElement('health-regime-display');
  if (el) { el.textContent = model.regime; el.style.color = color; }
  var ld = window._liveData || {};
  var spyPct = Number(ld.SPY && ld.SPY.pct);
  var qqqPct = Number(ld.QQQ && ld.QQQ.pct);
  var vix = Number(ld['^VIX'] && ld['^VIX'].price);
  var bars = model.bars || {};
  var sb = _aioLegacyHealthElement('hc-spy-bar'); if (sb) { sb.style.width = (bars.spy || 0) + '%'; sb.style.background = spyPct >= 0 ? 'var(--data-green)' : 'var(--data-red)'; }
  var qb = _aioLegacyHealthElement('hc-qqq-bar'); if (qb) { qb.style.width = (bars.qqq || 0) + '%'; qb.style.background = qqqPct >= 0 ? 'var(--data-green)' : 'var(--data-red)'; }
  var vb = _aioLegacyHealthElement('hc-vix-bar'); if (vb) { vb.style.width = (bars.vix || 0) + '%'; vb.style.background = vix < 25 ? 'var(--data-green)' : vix < 32 ? 'var(--data-amber)' : 'var(--data-red)'; } // P1564: 18/25/32 bands
  el = _aioLegacyHealthElement('tech-health-pill');
  if (el) { el.textContent = model.regime; el.className = 'status-pill ' + (model.score >= 50 ? 'sp-risk-on' : 'sp-risk-off'); }
  el = _aioLegacyHealthElement('health-interpretation');
  if (el) {
    var compositeScore = null;
    try { if (typeof computeTradingScore === 'function') compositeScore = Number(computeTradingScore().total); else if (window._tradingScore != null) compositeScore = Number(window._tradingScore); } catch(_) {}
    var strategy = model.score >= 65 ? '기술 환경은 우호적입니다. 단독 매수 신호가 아니며 시그널 점수 60+와 시장폭 확산 여부를 함께 확인합니다.' : model.score >= 40 ? '선별이 필요한 환경입니다. 섹터 로테이션과 종합 시그널을 확인합니다.' : '방어적 환경입니다. 현금 비중·손절 기준·반등 강도를 점검합니다.';
    var conflict = model.score >= 65 && isFinite(compositeScore) && compositeScore < 60 ? ' 현재 종합 시그널 ' + Math.round(compositeScore) + '/100과 충돌하므로 신규 진입 근거를 더 확인해야 합니다.' : '';
    el.textContent = '시장 건강 진단 결과\n점수 ' + model.score + '/100 (' + model.grade + ') — ' + model.regime + '\n' + (model.details || []).join(' · ') + '\n\n전략: ' + strategy + conflict;
  }
}

function computeMarketHealth(options) {
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
  if (!_aioIsNativeTechnicalHealth() && (!options || options.render !== false) && model.available) _aioRenderLegacyMarketHealth(model);
  return model;
}

// v57.76: the 차트 tab no longer shows market-level (SPY) copies of the 시장 상태 judgement. The SPY indicator card
// writer (updateTechIndicators), the SPY moving-average-order and multi-timeframe writers (updateWeinsteinStage/updateMTF)
// and the SPY/VIX pattern-signal writer (updatePatternSignals) were deleted with their DOM. The classification models
// stay in src/domain/technical/stage.js (pinned by architecture/fixtures/weinstein-mtf-golden.json).
// P1425: the 거시 storyline, economic calendar, legacy yield-curve chart, economic thermometer, regime pill and WTI-Brent
// card were retired with their DOM; src/ui/components/macro-board.js renders the 거시 경제 and 금리 · 환율 boards.

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS: Technical & Macro Pages
// ═══════════════════════════════════════════════════════════════

// Technical page init — v57.76: only the compatibility health model refresh remains (the SPY card writers were deleted).
// v48.99: _aioPageBus 마이그 (P180) · v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-technical-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'technical') setTimeout(function() { computeMarketHealth(); }, 300);
});

// Live quote updates for the technical page
_aioPageBus.register('html-tech-macro-live', 'aio:liveQuotes', function() {
  var techPage = document.getElementById('page-technical');
  if (techPage && techPage.classList.contains('active')) computeMarketHealth();
});
});

// ═══════════════════════════════════════════════════════════════
// Page chat chips only. Persona/system prompts are owned by js/aio-chat.js.
(function() {
  if (!window.CHAT_DEFAULT_CHIPS) return;
  window.CHAT_DEFAULT_CHIPS.technical = ['기술적 구조 확인','추세 무효화 조건','변동성 점검'];
  window.CHAT_DEFAULT_CHIPS.macro = ['금리·물가 확인','공식 발표 일정','환율 영향 점검'];
  window.CHAT_DEFAULT_CHIPS.options = ['옵션 데이터 상태','변동성 구조 확인','헤지 조건 점검'];
})();

