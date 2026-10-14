// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-pages.js — P1133/R620: index.html 인라인 블록 D(3,748줄)에서 추출한 페이지 렌더러.
// 신호 대시보드 호환 렌더러(결정 헤더·국면 파생·리스크 모니터 스냅샷 바인딩), FX/채권 페이지, 크로스에셋 매트릭스,
// 기업분석 레거시 위젯·어닝 캘린더·리스크 레이더, RRG/섹터/테마 맵, showThemeDetail 네이티브
// 브리지, 서브테마 상세, 가격 이력·RRG 하이드레이션, ETF/서브테마 그리드.
//
// 왜 새 파일인가: R620(3)은 "커버리지를 빠뜨리면 압력이 옆으로 샌다"고 못박는다. 남은 인라인을
// 기존 aio-ui.js에 계속 접어넣으면 index.html이 줄어드는 대신 aio-ui.js가 새 모놀리스가 된다.
// 이 파일은 등록 6곳(asset-manifest·public-artifact-manifest·sw.js·pages-deploy·RUNTIME_SCRIPT_FILES
// 2곳)과 래칫 measuredFiles에 함께 등재되어, 등록 누락이 게이트에서 조용히 지나갈 수 없다.
// ═══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// v8 Signal Dashboard — Should I Be Trading? Engine
// ══════════════════════════════════════════════════════════════════

// ── Chat context: signal — 메인 CHAT_CONTEXTS에서 동적 정의됨 (중복 제거) ──

// P831: sector allocation is owned by src/ui/pages/portfolio.js.
// v40.4: 포지션 기반 도넛 차트 (portfolio-donut과 별도)
function drawPositionDonut() {
  var c = document.getElementById('pf-position-donut');
  if (!c) return;
  if (c.dataset.aioPortfolioChartRenderer === 'native') return; // P1592 (F16): native marks the canvas, not the page — the old selector never matched, so this cost-basis, mixed-currency donut kept drawing
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.clearRect(0,0,W,H);
  var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 6, ri = r * 0.55;
  var positions = typeof getPortfolioData === 'function' ? getPortfolioData() : [];
  let ld = window._liveData || {};
  var TICKER_COLORS = ['#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16'];

  if (positions.length === 0) {
    // v48.3: 빈 상태 안내 폰트 10→12px 상향
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#8a8271';
    ctx.textAlign = 'center';
    ctx.fillText('종목을 추가하면', cx, cy - 6);
    ctx.fillText('비중이 표시됩니다', cx, cy + 12);
    var legendEl = document.getElementById('pf-donut-legend');
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  var items = [], totalVal = 0;
  positions.forEach(function(p) {
    var live = ld[p.ticker];
    var price = (live && isFinite(live.price) && live.price > 0) ? live.price : p.cost;
    var val = price * p.qty;
    var sector = 'Unknown';
    if (typeof _aioGetCanonicalScreenerRows === 'function') {
      var found = _aioGetCanonicalScreenerRows().find(function(s) { return s.sym === p.ticker; });
      if (found && found.sector) sector = found.sector;
    }
    items.push({ ticker: p.ticker, val: val, sector: sector, pct: 0 });
    totalVal += val;
  });
  var cashVal = 0;
  try { cashVal = parseFloat(localStorage.getItem('aio_portfolio_cash') || '0'); } catch(e) {}
  if (cashVal > 0) {
    items.push({ ticker: 'CASH', val: cashVal, sector: 'CASH', pct: 0 });
    totalVal += cashVal;
  }
  items.forEach(function(it) { it.pct = totalVal > 0 ? it.val / totalVal : 0; });
  items.sort(function(a, b) { return b.pct - a.pct; });

  // Draw donut
  var start = -Math.PI / 2;
  items.forEach(function(d, i) {
    if (d.pct <= 0) return;
    var end = start + Math.PI * 2 * d.pct;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = d.ticker === 'CASH' ? 'var(--text-muted)' : TICKER_COLORS[i % TICKER_COLORS.length];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(start), cy + r * Math.sin(start));
    ctx.strokeStyle = '#fbf9f5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    start = end;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = '#fbf9f5';
  ctx.fill();
  // v48.3: 중앙 텍스트 11px→13px, 보조 9px→11px (170 캔버스 기준 확대)
  ctx.font = 'bold 13px JetBrains Mono, monospace';
  ctx.fillStyle = '#8a8271';
  ctx.textAlign = 'center';
  ctx.fillText(items.length + '종목', cx, cy - 3);
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#8a8271'; /* v48.61: R43 Canvas hex */
  ctx.fillText('$' + (totalVal >= 1e6 ? (totalVal/1e6).toFixed(1)+'M' : totalVal >= 1e3 ? (totalVal/1e3).toFixed(1)+'K' : totalVal.toFixed(0)), cx, cy + 14);

  // Legend
  // v48.3: 범례 폰트 9px→11px + 라벨 폰트 명시 + 색상 점 크기 확대
  var legendEl = document.getElementById('pf-donut-legend');
  if (legendEl) {
    var lh = '';
    items.slice(0, 8).forEach(function(d, i) {
      var col = d.ticker === 'CASH' ? 'var(--text-muted)' : TICKER_COLORS[i % TICKER_COLORS.length];
      lh += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:11px;">';
      lh += '<span style="font-weight:600;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + col + ';margin-right:6px;vertical-align:middle;"></span>' + d.ticker + '</span>';
      lh += '<span style="font-family:var(--font-mono);color:' + col + ';font-weight:700;">' + (d.pct * 100).toFixed(1) + '%</span>';
      lh += '</div>';
    });
    if (items.length > 8) lh += '<div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:4px;">+' + (items.length - 8) + '개 더</div>';
    legendEl.innerHTML = lh;
  }

  // P831: sector allocation is owned by src/ui/pages/portfolio.js.
}

// v40.4: 현금 포지션 저장
function saveCashPosition(val) {
  var cash = parseFloat(val) || 0;
  try { localStorage.setItem('aio_portfolio_cash', cash > 0 ? cash.toString() : '0'); } catch(e) {}
  drawPositionDonut();
  renderPortfolio();
}

// ── Update Risk Monitor ───────────────────────────────────────────
function updateRiskMonitor() {
  let ld = window._liveData || {};

  // P1672: the rm-* / bb-rsp-* risk cards left the page (P1010/P1392); only the [data-snap]
  // bindings below still have sinks.

  // v38.8: Risk Heatmap CP1/CP6 data-snap 동적 업데이트
  // v48.51: NARRATIVE_ENGINE 실시간 바인딩 — CP1~CP8 stale 데이터 자동 갱신
  var wti = ld['CL=F'] ? ld['CL=F'].price : null;
  var brent = ld['BZ=F'] ? ld['BZ=F'].price : null;
  var gold = ld['GC=F'] ? ld['GC=F'].price : null;
  var vix = ld['^VIX'] ? ld['^VIX'].price : null;
  var vvix = ld['^VVIX'] ? ld['^VVIX'].price : null;
  var move = ld['^MOVE'] ? ld['^MOVE'].price : null;
  var spx = ld['^GSPC'] ? ld['^GSPC'].price : null;
  var snapWti = document.querySelectorAll('[data-snap="wti"]');
  var snapBrent = document.querySelectorAll('[data-snap="brent"]');
  var snapGold = document.querySelectorAll('[data-snap="gold"]');
  if (wti) snapWti.forEach(function(el) { el.textContent = '$' + wti.toFixed(0); });
  if (brent) snapBrent.forEach(function(el) { el.textContent = '$' + brent.toFixed(0); });
  if (gold) snapGold.forEach(function(el) { el.textContent = '$' + gold.toLocaleString('en-US', {maximumFractionDigits:0}); });
  if (vix != null) document.querySelectorAll('[data-snap="vix"]').forEach(function(el){ el.textContent = vix.toFixed(1); });
  if (vvix != null) document.querySelectorAll('[data-snap="vvix"]').forEach(function(el){ el.textContent = vvix.toFixed(1); });
  if (move != null) document.querySelectorAll('[data-snap="move"]').forEach(function(el){
    if (el.closest && el.closest('#page-fxbond[data-aio-architecture-renderer="native"]')) return;
    el.textContent = move.toFixed(1);
  });
  if (spx != null) document.querySelectorAll('[data-snap="spx"]').forEach(function(el){ el.textContent = spx.toLocaleString('en-US', {maximumFractionDigits:0}); });
  // v48.53: Yahoo 직접 매핑 9종 추가 자동화 (tnx/tnx-2y/skew/kospi/kosdaq/krw/dxy)
  var tnx = ld['^TNX'] ? ld['^TNX'].price : null;
  var kospi = ld['^KS11'] ? ld['^KS11'].price : null;
  var kospiPct = ld['^KS11'] ? ld['^KS11'].pct : null;
  var kosdaq = ld['^KQ11'] ? ld['^KQ11'].price : null;
  var kosdaqPct = ld['^KQ11'] ? ld['^KQ11'].pct : null;
  var krw = ld['KRW=X'] ? ld['KRW=X'].price : null;
  var dxy = ld['DX-Y.NYB'] ? ld['DX-Y.NYB'].price : null;
  if (tnx != null) document.querySelectorAll('[data-snap="tnx"]').forEach(function(el){ el.textContent = tnx.toFixed(2) + '%'; });
  if (kospi != null) document.querySelectorAll('[data-snap="kospi"]').forEach(function(el){ el.textContent = kospi.toLocaleString('en-US', {maximumFractionDigits:2}); });
  if (kospiPct != null) document.querySelectorAll('[data-snap="kospi-pct"]').forEach(function(el){ el.textContent = (kospiPct >= 0 ? '+' : '') + kospiPct.toFixed(2) + '%'; });
  if (kosdaq != null) document.querySelectorAll('[data-snap="kosdaq"]').forEach(function(el){ el.textContent = kosdaq.toLocaleString('en-US', {maximumFractionDigits:2}); });
  if (kosdaqPct != null) document.querySelectorAll('[data-snap="kosdaq-pct"]').forEach(function(el){ el.textContent = (kosdaqPct >= 0 ? '+' : '') + kosdaqPct.toFixed(2) + '%'; });
  if (krw != null) document.querySelectorAll('[data-snap="krw"]').forEach(function(el){ el.textContent = krw.toLocaleString('en-US', {maximumFractionDigits:0}); });
  if (krw != null) document.querySelectorAll('[data-snap="krw-full"]').forEach(function(el){ el.textContent = krw.toFixed(2); });
  if (dxy != null) document.querySelectorAll('[data-snap="dxy"]').forEach(function(el){ el.textContent = dxy.toFixed(2); });

  if (typeof window._aioRenderSnapshotDateBindings === 'function') window._aioRenderSnapshotDateBindings();
}

var _signalMode = 'swing';
var _signalInterval = null;

function initSignalDashboard() {
  // E2/LC-26: restore the declared mode into the pill/description. Static markup defaults to
  // swing, so a persisted day mode must be re-applied on entry or the pill would lie.
  try {
    var declaredMode = (window.AIO_ARCH && window.AIO_ARCH.signalScoreMode && typeof window.AIO_ARCH.signalScoreMode.get === 'function')
      ? window.AIO_ARCH.signalScoreMode.get() : _signalMode;
    if (typeof toggleSignalMode === 'function') toggleSignalMode(declaredMode);
  } catch(_) {}
  refreshSignalDashboard();
  // v48.91: 타이머 레지스트리 등록
  _signalInterval = _aioRegisterTimer('signalDashboard', refreshSignalDashboard, T.SIGNAL_REFRESH);

  // Init chat
  if (window.CHAT_DEFAULT_CHIPS) {
    chatRenderChips('signal', window.CHAT_DEFAULT_CHIPS['signal']);
  }
  // Fetch fresh quotes for signal page
  if (typeof fetchLiveQuotes === 'function') fetchLiveQuotes();
}

function refreshSignalDashboard() {
  // P1670: the legacy signal widgets this painted (canvas gauge, decision badge, score bars, hero
  // factor bars, advice box, execution-window score, metric pills, phase label, timestamps) have
  // left the page; src/ui/pages/analysis.js owns the signal hero. Keep the shared decision
  // header and the snapshot/pulse writers that still have live sinks (the execution-window and
  // regime-badge derivations were retired: their ew-*/regime-* sinks are gone and nothing read
  // their return values).
  try { if (typeof window._aioRenderPageDecisionHeader === 'function') window._aioRenderPageDecisionHeader('signal'); } catch(_) {}

  // Risk monitor (its [data-snap] writers still reach the macro/market pages)
  updateRiskMonitor();

  // v42.1: 마켓 펄스 바 업데이트
  try { updateMarketPulse(); } catch(e) {}
}

// v42.1: 마켓 펄스 바 — 전 페이지 상단 시장 상태 요약
// v45.5: 데이터 미수신 시 폴백 사용 (로딩 영구 정체 방지) + 매크로 아이콘 색상 동기화
function updateMarketPulse() {
  var bar = document.getElementById('market-pulse-bar');
  if (!bar) return;

  // 1) 시그널 스코어
  try {
    var sc = computeTradingScore('swing');
    var t = (sc && typeof sc.total === 'number' && isFinite(sc.total)) ? sc.total : null; // P1352
    var sColor = t == null ? 'var(--text-muted)' : t >= 70 ? 'var(--data-green)' : t >= 50 ? 'var(--data-cyan)' : t >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
    var sLabel = t == null ? '산출 보류' : t >= 75 ? '스트레스 신호 적음' : t >= 60 ? '스트레스 신호 일부' : t >= 45 ? '중립 · 신호 혼재' : t >= 30 ? '주의 · 부담 점검' : '위험 · 방어 조건 점검';
    var el1 = document.getElementById('mp-signal-score');
    var el1b = document.getElementById('mp-signal-label');
    if (el1) { el1.textContent = t == null ? '—' : t; el1.style.color = sColor; }
    if (el1b) { el1b.textContent = sLabel; el1b.style.color = sColor; }
  } catch(e) { ['mp-signal-score','mp-signal-label'].forEach(function(id, i) { var el = document.getElementById(id); if (el) { el.textContent = i ? '산출 보류' : '—'; el.style.color = 'var(--text-muted)'; } }); }

  // P1267: 시장폭은 timestamp가 확인된 canonical AIO 5/20/50SMA evidence만 사용한다.
  // 20SMA, 스냅샷, 섹터 ETF 일간 등락률은 모집단·기간·현재성이 달라 50SMA 대신 쓰지 않는다.
  try {
    var breadthEvidence = window.AIO && typeof window.AIO.getCurrentBreadthEvidence === 'function'
      ? window.AIO.getCurrentBreadthEvidence() : { available:false };
    var breadth50 = breadthEvidence.available ? Number(breadthEvidence.sma50) : null;
    var bVal = breadth50 != null && Number.isFinite(breadth50) && breadth50 >= 0 && breadth50 <= 100 ? Math.round(breadth50) : null;
    var el2 = document.getElementById('mp-breadth-val');
    var el2b = document.getElementById('mp-breadth-label');
    if (bVal !== null && !isNaN(bVal)) {
      // v52.40 (P655/EF-02b, R287): 독자 60/30 임계값 대신 breadth 페이지·signal bb-* 카드와 동일한
      // canonical NARRATIVE_ENGINE.getBreadthRegime()로 통일 — 같은 %가 표면마다 다른 색/라벨을 갖지 않게.
      var bReg = (typeof NARRATIVE_ENGINE !== 'undefined' && NARRATIVE_ENGINE.getBreadthRegime) ? NARRATIVE_ENGINE.getBreadthRegime(bVal) : null;
      var bColor = bReg ? bReg.color : (bVal >= 60 ? 'var(--data-green)' : bVal >= 30 ? 'var(--data-amber)' : 'var(--data-red)');
      var bLabel = bReg ? bReg.label : (bVal >= 60 ? '건강' : bVal >= 30 ? '주의' : '약세');
      if (el2) window._aioRenderValueSlot(el2, 'value', bVal + '%', { color: bColor });
      if (el2b) window._aioRenderValueSlot(el2b, 'value', bLabel, { color: bColor });
    } else {
      window._aioRenderValueSlot(el2, 'pending', null, { text: '수신 대기', reason: '기준 시각이 확인된 AIO 50SMA 시장폭 미수신' });
      window._aioRenderValueSlot(el2b, 'pending', null, { text: '판정 보류', reason: '기준 시각이 확인된 AIO 50SMA 시장폭 미수신' });
    }
  } catch(e) {
    window._aioRenderValueSlot(document.getElementById('mp-breadth-val'), 'pending', null, { text: '수신 대기', reason: '현재성 확인 실패' });
    window._aioRenderValueSlot(document.getElementById('mp-breadth-label'), 'pending', null, { text: '판정 보류', reason: '현재성 확인 실패' });
  }

  // 3) 심리 (Fear & Greed) — canonical currentness selector
  try {
    var _fgPulseMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    var fv = _fgPulseMetric && _fgPulseMetric.value != null && !isNaN(_fgPulseMetric.value) ? _fgPulseMetric.value : null;
    var el3 = document.getElementById('mp-sentiment-val');
    var el3b = document.getElementById('mp-sentiment-label');
    if (fv !== null && !isNaN(fv)) {
      var _fgZonePulse = window._aioFgZoneIndex(fv); // P1564/P1753: one zone index for colour and label (label spelled as src)
      var fColor = ['var(--data-red)', 'var(--data-amber)', 'var(--data-cyan)', 'var(--data-green)', '#22754c'][_fgZonePulse];
      var fLabel = ['극단 공포', '공포', '중립', '탐욕', '극단 탐욕'][_fgZonePulse];
      if (el3) window._aioRenderValueSlot(el3, 'value', fv, { color: fColor });
      if (el3b) window._aioRenderValueSlot(el3b, 'value', fLabel, { color: fColor });
    } else {
      window._aioRenderValueSlot(el3, 'pending', null, { text: '수신 대기', reason: 'Fear & Greed live/snapshot 미수신' });
      window._aioRenderValueSlot(el3b, 'pending', null, { text: '대기', reason: 'Fear & Greed live/snapshot 미수신' });
    }
  } catch(e) {}

  // 4) 매크로 국면 — v57.60: the #home-market-regime source card left index.html (v57.50 I16), so the slot stays pending.
  try {
    var elIcon = document.getElementById('mp-macro-icon');
    var elM = document.getElementById('mp-macro-val');
    if (elIcon) { elIcon.style.color = 'var(--text-muted)'; }
    window._aioRenderValueSlot(elM, 'pending', null, { text: '대기', reason: '시장 국면 산출 대기' });
  } catch(e) {}

  // v48.62: 결론 바 업데이트
  try { _updateAllConclusionBars(); } catch(e) {}
}

// v48.62: 페이지 결론 바 렌더 유틸 — 결론·액션·업데이트 3열
function _renderConclusionBar(id, opts) {
  var el = document.getElementById(id);
  if (!el) return;
  var lf = window._lastFetch || {};
  var ts = opts.fetchKey ? lf[opts.fetchKey] : null;
  var DE = window.DATE_ENGINE;
  var upd = (ts && DE) ? DE.formatRelative(ts) : '—';
  el.innerHTML = '<div class="page-conclusion-bar">' +
    '<div class="pcb-conclusion"><div class="pcb-label">오늘 결론</div>' +
    '<div class="pcb-value" style="color:' + (opts.conclusionColor || 'var(--text-primary)') + '">' + (typeof escHtml === 'function' ? escHtml(opts.conclusion || '—') : (opts.conclusion || '—')) + '</div></div>' +
    '<div class="pcb-action"><div class="pcb-label">즉시 행동</div>' +
    '<div class="pcb-value">' + (typeof escHtml === 'function' ? escHtml(opts.action || '—') : (opts.action || '—')) + '</div></div>' +
    '<div class="pcb-updated"><div class="pcb-label">업데이트</div>' +
    '<div class="pcb-value">' + upd + '</div></div></div>';
}

// v48.62: 결론 바 업데이트 — v57.60: only #home-conclusion-bar remains (signal/sentiment/macro bars and macro-regime-pill retired).
function _updateAllConclusionBars() {
  try {
    var sc = (typeof computeTradingScore === 'function') ? computeTradingScore('swing') : null;
    var t = (sc && typeof sc.total === 'number' && isFinite(sc.total)) ? sc.total : null;
    if (t !== null) {
      var sColor = t >= 70 ? 'var(--data-green)' : t >= 50 ? 'var(--data-cyan)' : t >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
      var sLabel = t >= 75 ? '스트레스 신호 적음' : t >= 60 ? '스트레스 신호 일부' : t >= 45 ? '중립 · 신호 혼재' : t >= 30 ? '주의 · 부담 점검' : '위험 · 방어 조건 점검';
      var sAction = t >= 60 ? '환경 설명값(예측 신호 아님) — 종목 근거·손익비는 별도로 확인할 항목' :
                    t >= 45 ? '신호 혼재 — 점수 단독 판단 금지' :
                    '역사적으로 방어적 대응이 우선시되던 환경(지시 아님)';
      var sOpts = { conclusion: t + '점 · ' + sLabel, conclusionColor: sColor, action: sAction, fetchKey: 'quote' };
      _renderConclusionBar('home-conclusion-bar', sOpts);
    }
  } catch(e) {}
}

// Signal page live update hook
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-signal-live', 'aio:liveQuotes', function() {
  var sigPage = document.getElementById('page-signal');
  if (sigPage && sigPage.classList.contains('active')) {
    updateRiskMonitor();
    refreshSignalDashboard();
  }
  // v42.1: 어떤 페이지에서든 마켓 펄스 업데이트
  try { updateMarketPulse(); } catch(e) {}
});
_aioPageBus.register('html-signal-shown', 'aio:pageShown', function(e) { if (e.detail === 'signal') setTimeout(function() { try { updateRiskMonitor(); refreshSignalDashboard(); } catch(_) {} }, 0); }); // P1368: native navigation skips initSignalDashboard
});

// P1425: the legacy FX/bond page writers (updateFxBondPage, the 10Y/JPY trend charts, the
// cross-asset 4-axis matrix and its risk pill) were retired with their DOM; the 금리 · 환율 board in
// src/ui/components/macro-board.js renders that route.

// ═══════════════════════════════════════════════════════════════
//  FUNDAMENTAL PAGE — Live Data + Earnings Calendar
// ═══════════════════════════════════════════════════════════════
async function initFundamentalLegacyWidgets() {
  try {
  // The earnings calendar keeps its provider boundary; the SEC card surface is native-owned.
  loadEarningsCalendar();
  } catch(e) { _aioLog('warn', 'fund', 'initFundamentalLegacyWidgets error: ' + e.message); }
}

// v48.56: 어닝 캘린더 주간 shift 상태
window._aioEarnCalWeekOffset = 0;
window._aioEarnCalWeekShift = function(offset) {
  window._aioEarnCalWeekOffset = parseInt(offset, 10) || 0;
  loadEarningsCalendar();
};

// 무키 폴백: refresh-screener가 주간으로 만드는 public-data/earnings-calendar.json을
// 읽는다. 이 파일은 오랫동안 소비자가 없어 "무키 시 스냅샷"이라는 화면 문구가 사실이
// 아니었다(P1102). 스냅샷은 창(weekStart~weekEnd)을 함께 표기하고, 범위 밖 날짜는
// 렌더러가 자연히 걸러낸다.
async function _fetchEarningsCalendarSnapshot() {
  try {
    var res = typeof fetchWithTimeout === 'function'
      ? await fetchWithTimeout('public-data/earnings-calendar.json?v=' + Date.now(), { cache: 'no-cache' }, 6000)
      : null;
    if (!res || !res.ok) return null;
    var d = await res.json();
    if (!d || !Array.isArray(d.earnings)) return null;
    return {
      earnings: d.earnings,
      ipos: Array.isArray(d.ipos) ? d.ipos : [],
      weekStart: d.weekStart || null,
      weekEnd: d.weekEnd || null,
      generatedAt: d.generatedAt || null,
      // v57.51 N19: large caps the provider window does not list are 'schedule unconfirmed', never "no report".
      unconfirmed: d.largeCapCoverage && Array.isArray(d.largeCapCoverage.unconfirmed) ? d.largeCapCoverage.unconfirmed : []
    };
  } catch (e) {
    _aioLog('warn', 'fetch', 'earnings calendar snapshot error: ' + e.message);
    return null;
  }
}

async function loadEarningsCalendar() {
  var body = document.getElementById('earnings-calendar-body');
  if (!body) return;

  // 주간 범위 계산 (Mon~Fri + 주 shift)
  var weekOffset = window._aioEarnCalWeekOffset || 0;
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  var daysToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  var monday = new Date(now.getTime() + (daysToMon + weekOffset * 7) * 86400000);
  var friday = new Date(monday.getTime() + 4 * 86400000);
  var fromStr = monday.toISOString().slice(0, 10);
  var toStr = friday.toISOString().slice(0, 10);

  body.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--text-muted);font-size:10px;"><span class="aio-spinner" style="margin-right:8px;"></span>어닝 캘린더 요청 중… (' + fromStr + ' ~ ' + toStr + ')</div>';

  var finnhubKey = _getApiKey('aio_finnhub_key');
  var fmpKey = _getApiKey('aio_fmp_key');
  var earnings = [], ipos = [];

  try {
    if (finnhubKey && typeof fetchFinnhubEarningsCalendar === 'function') {
      earnings = await fetchFinnhubEarningsCalendar(fromStr, toStr);
      if (typeof fetchFinnhubIpoCalendar === 'function') ipos = await fetchFinnhubIpoCalendar(fromStr, toStr);
    } else if (fmpKey) {
      await _fetchEarningsCalendarFMP(body, fmpKey);
      return;
    } else {
      var snapshot = await _fetchEarningsCalendarSnapshot();
      if (snapshot && (snapshot.earnings.length > 0 || snapshot.ipos.length > 0)) {
        _renderEarningsCalendarWeekly(body, snapshot.earnings, snapshot.ipos, monday, friday);
        var snapSt = document.getElementById('earn-cal-status');
        if (snapSt) {
          snapSt.textContent = snapshot.earnings.length + '건 어닝 + ' + snapshot.ipos.length + 'IPO · '
            + fromStr.slice(5) + '~' + toStr.slice(5)
            + ' (저장 스냅샷 ' + String(snapshot.weekStart || '—').slice(5) + '~' + String(snapshot.weekEnd || '—').slice(5) + ')';
          // Most listed large caps simply do not report in a given week, so the gap list is hover context only:
          // it lets a reader see that a name like ASML/TSM is absent from the provider window, without a weekly count.
          snapSt.title = snapshot.unconfirmed.length ? '이 목록에 없는 대형주(이번 주 발표가 없거나 공급자 목록에서 빠졌을 수 있음 — 날짜는 추정하지 않음): ' + snapshot.unconfirmed.join(', ') : '';
        }
        return;
      }
      body.innerHTML = '<div style="grid-column:1/-1;padding:26px;text-align:center;color:var(--text-muted);font-size:10px;line-height:1.7;">Finnhub 또는 FMP API 키 설정 시 주간 어닝 캘린더 표시<br><span style="font-size:11px;">Settings → API Keys → Finnhub (60 req/min 무료) 권장</span></div>';
      var st = document.getElementById('earn-cal-status'); if (st) st.textContent = 'API 키 필요';
      return;
    }
    _renderEarningsCalendarWeekly(body, earnings, ipos, monday, friday);
    var st = document.getElementById('earn-cal-status');
    if (st) st.textContent = earnings.length + '건 어닝 + ' + ipos.length + 'IPO · ' + fromStr.slice(5) + '~' + toStr.slice(5) + ' (Finnhub)';
  } catch(e) {
    _aioLog('warn', 'fetch', 'earnings calendar error: ' + e.message);
    body.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-muted);font-size:10px;">어닝 캘린더 수신 실패 · API 키 확인 필요</div>';
  }
}

// v48.56: 주간 어닝 캘린더 렌더러 (EarningsHub 스타일)
function _renderEarningsCalendarWeekly(body, earnings, ipos, monday, friday) {
  // 정렬: 날짜 + BMO/AMC + marketCap
  earnings.sort(function(a, b) {
    if (a.date !== b.date) return a.date > b.date ? 1 : -1;
    var tA = (a.hour || '').toLowerCase(), tB = (b.hour || '').toLowerCase();
    if (tA !== tB) return tA === 'bmo' ? -1 : 1;
    return (b.marketCap || 0) - (a.marketCap || 0);
  });
  // 요일별 그룹화
  var dayLabels = ['일','월','화','수','목','금','토'];
  var days = [];
  for (var i = 0; i < 5; i++) {
    var d = new Date(monday.getTime() + i * 86400000);
    var ymd = d.toISOString().slice(0,10);
    var dayEarn = earnings.filter(function(e) { return e.date === ymd; });
    var dayIpo = ipos.filter(function(p) { return p.date === ymd; });
    days.push({ date: d, ymd: ymd, bmo: dayEarn.filter(function(e){return (e.hour||'').toLowerCase()==='bmo';}),
                amc: dayEarn.filter(function(e){return (e.hour||'').toLowerCase()==='amc';}),
                ipos: dayIpo });
  }

  var MAX_VISIBLE = 9; // 섹션당 표시 개수
  var html = '';
  days.forEach(function(day, idx) {
    var isToday = new Date().toISOString().slice(0,10) === day.ymd;
    var dayColor = isToday ? 'var(--data-green)' : 'var(--text-muted)';
    var dayLabel = dayLabels[day.date.getDay()] + ' ' + day.date.getDate();

    html += '<div class="aio-earn-day" style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:6px;display:flex;flex-direction:column;gap:6px;">';
    html += '<div style="text-align:center;padding:4px 6px;background:' + (isToday ? 'rgba(34,117,76,0.1)' : 'var(--surface-2)') + ';border-radius:3px;font-size:10px;font-weight:700;color:' + dayColor + ';font-family:var(--font-mono);">' + dayLabel + (isToday ? ' · 오늘' : '') + '</div>';

    // IPO 섹션 (있을 때만)
    if (day.ipos.length > 0) {
      html += '<div style="background:rgba(var(--ink-rgb),0.08);border:1px solid rgba(var(--ink-rgb),0.25);border-radius:3px;padding:4px 6px;">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--data-purple);margin-bottom:3px;">IPO · ' + day.ipos.length + '건</div>';
      day.ipos.slice(0, 3).forEach(function(p) {
        html += '<div style="font-size:11px;color:var(--text-primary);font-family:var(--font-mono);line-height:1.4;">' + escHtml(p.symbol || '?') + ' <span style="color:var(--text-muted);font-size:11px;">' + escHtml((p.name||'').slice(0,18)) + '</span></div>';
      });
      if (day.ipos.length > 3) html += '<div style="font-size:11px;color:var(--text-muted);">+' + (day.ipos.length - 3) + '</div>';
      html += '</div>';
    }

    // BMO (Before Open)
    if (day.bmo.length > 0) {
      html += _renderEarnSection('', 'Before Open', day.bmo, MAX_VISIBLE, 'rgba(var(--ink-rgb),0.08)', 'rgba(var(--ink-rgb),0.25)', 'var(--data-amber)');
    }
    // AMC (After Close)
    if (day.amc.length > 0) {
      html += _renderEarnSection('', 'After Close', day.amc, MAX_VISIBLE, 'rgba(var(--ink-rgb),0.08)', 'rgba(var(--ink-rgb),0.2)', 'var(--data-cyan)');
    }
    // 빈 날
    if (day.bmo.length === 0 && day.amc.length === 0 && day.ipos.length === 0) {
      html += '<div style="padding:20px 4px;text-align:center;color:var(--text-muted);font-size:11px;opacity:0.5;">(발표 없음)</div>';
    }
    html += '</div>';
  });
  body.innerHTML = html;
}

// v48.56: 어닝 섹션 (BMO/AMC) 렌더러
function _renderEarnSection(icon, label, items, maxVisible, bgColor, borderColor, titleColor) {
  var html = '<div style="background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:3px;padding:4px 5px;">';
  html += '<div style="font-size:11px;font-weight:700;color:' + titleColor + ';margin-bottom:3px;">' + icon + ' ' + label + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;">';
  items.slice(0, maxVisible).forEach(function(e) {
    var sym = e.symbol || '?';
    var logoUrl = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(sym) + '.png';
    var epsEst = e.epsEstimate != null ? '$' + parseFloat(e.epsEstimate).toFixed(2) : '';
    html += '<div class="aio-earn-card" data-action="_aioNewsTickerClick" data-arg="' + escHtml(sym) + '" role="button" tabindex="0" style="background:var(--surface-4);border:1px solid var(--border);border-radius:4px;padding:3px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;transition:border-color var(--dur-fast);" title="' + escHtml(sym) + ' 어닝 ' + epsEst + '">';
    html += '<img src="' + escHtml(logoUrl) + '" alt="' + escHtml(sym) + '" loading="lazy" data-logo-fallback="1" style="width:22px;height:22px;object-fit:contain;border-radius:3px;background:#ffffff;">';
    html += '<span style="display:none;font-size:11px;font-weight:800;color:var(--text-primary);">' + escHtml(sym.slice(0,4)) + '</span>';
    html += '<span style="font-size:11px;font-weight:700;color:var(--text-secondary);font-family:var(--font-mono);">' + escHtml(sym) + '</span>';
    html += '</div>';
  });
  if (items.length > maxVisible) {
    html += '<div style="background:var(--surface-3);border:1px solid var(--border);border-radius:4px;padding:3px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--text-muted);">+' + (items.length - maxVisible) + '</div>';
  }
  html += '</div></div>';
  return html;
}

async function _fetchEarningsCalendarFMP(body, fmpKey) {
  try {
    var today = new Date();
    var from = today.toISOString().split('T')[0];
    var toDate = new Date(today.getTime() + 90 * 86400000);
    var to = toDate.toISOString().split('T')[0];
    var url = 'https://financialmodelingprep.com/api/v3/earning_calendar?from=' + from + '&to=' + to + '&apikey=' + fmpKey;
    var r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    // PRIORITY_SYMS에 포함된 종목만 필터
    var priSyms = new Set();
    if (typeof PRIORITY_SYMS !== 'undefined') {
      PRIORITY_SYMS.forEach(function(grp) { grp.forEach(function(s) { priSyms.add(s); }); });
    }
    var filtered = data.filter(function(e) { return priSyms.has(e.symbol); });
    filtered.sort(function(a, b) { return a.date > b.date ? 1 : -1; });
    if (filtered.length === 0) {
      // 모든 종목으로 폴백 (주요 종목만)
      var majorSyms = ['NVDA','AAPL','MSFT','GOOGL','AMZN','META','TSLA','MU','AMD','NFLX','CRM','BAC','JPM','COST'];
      var majorSet = new Set(majorSyms);
      filtered = data.filter(function(e) { return majorSet.has(e.symbol); });
      filtered.sort(function(a, b) { return a.date > b.date ? 1 : -1; });
    }
    var eHtml = '';
    filtered.slice(0, 12).forEach(function(e) {
      var d = new Date(e.date + 'T00:00:00');
      var dayOfWeek = ['일','월','화','수','목','금','토'][d.getDay()];
      var time = (e.time || '').toUpperCase();
      var timeColor = time === 'BMO' ? 'var(--data-cyan)' : 'var(--data-amber)';
      var timeLabel = time === 'BMO' ? '장전' : time === 'AMC' ? '장후' : '미정';
      var estStr = e.epsEstimated != null ? '$' + parseFloat(e.epsEstimated).toFixed(2) : '—';
      eHtml += '<div style="display:flex;padding:8px 10px;border-bottom:1px solid var(--border);align-items:center;gap:12px;">';
      eHtml += '<span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);width:80px;">' + e.date.slice(5) + '(' + dayOfWeek + ')</span>';
      eHtml += '<span style="font-size:13px;font-weight:700;color:var(--accent);width:50px;">' + e.symbol + '</span>';
      eHtml += '<span style="font-size:12px;color:var(--text-primary);flex:1;">' + (e.symbol || '') + '</span>';
      eHtml += '<span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);width:70px;text-align:right;">' + estStr + '</span>';
      eHtml += '<span style="font-size:11px;color:' + timeColor + ';width:40px;text-align:center;">' + timeLabel + '</span>';
      eHtml += '</div>';
    });
    body.innerHTML = eHtml;
    var st = document.getElementById('earn-cal-status');
    if (st) st.textContent = filtered.length + '건 · ' + from + '~' + to + ' (FMP source 확인)';
    console.log('[AIO] FMP 실적 캘린더 ' + filtered.length + '건 로드');
  } catch(e) {
    _aioLog('warn', 'fetch', 'FMP 캘린더 fetch 실패: ' + e.message);
    body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:11px;">실적 캘린더 수신 실패 · FMP API 확인 필요</div>';
  }
}

// The SEC watchlist grid is owned by src/ui/pages/entity.js. Do not rebuild it from live quotes:
// quote observations and annual filing facts have different clocks and must stay visibly separate.

// Init fundamental page on first visit
var _fundInitDone = false;
// v41.5: fundamental 페이지 첫 방문 시 초기화
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-fundamental-init-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'fundamental' && !_fundInitDone) {
    _fundInitDone = true;
    setTimeout(initFundamentalLegacyWidgets, 100);
  }
});
});

// Also init on page load if fundamental is active
setTimeout(function() {
  var fp = document.getElementById('page-fundamental');
  if (fp && fp.classList.contains('active') && !_fundInitDone) {
    _fundInitDone = true;
    initFundamentalLegacyWidgets();
  }
}, 2000);

// ═══════════════════════════════════════════════════════════════
//  COMPREHENSIVE THEME & SECTOR SYSTEM (screener_pro.py 통합)
// ═══════════════════════════════════════════════════════════════

// ── GICS 11 섹터 ETF (RRG 기본) ─────────────────────────────────
var RRG_SECTORS = [
  { sym:'XLK', name:'기술',     color:'var(--data-red)', emoji:'' },
  { sym:'XLF', name:'금융',     color:'var(--data-amber)', emoji:'' },
  { sym:'XLE', name:'에너지',   color:'var(--data-green)', emoji:'' },
  { sym:'XLV', name:'헬스케어', color:'#211d16', emoji:'' },
  { sym:'XLI', name:'산업재',   color:'var(--data-cyan)', emoji:'' },
  { sym:'XLY', name:'소비재',   color:'#57513f', emoji:'' },
  { sym:'XLP', name:'필수소비', color:'#211d16', emoji:'' },
  { sym:'XLRE',name:'부동산',   color:'#211d16', emoji:'' },
  { sym:'XLB', name:'원자재',   color:'#22754c', emoji:'' },
  { sym:'XLU', name:'유틸리티', color:'#211d16', emoji:'' },
  { sym:'XLC', name:'통신',     color:'#211d16', emoji:'' },
];

// ── 서브섹터 ETF (RRG 확장) ──────────────────────────────────────
var RRG_SUBSECTORS = [
  { sym:'SMH', name:'반도체',     color:'var(--data-purple)', emoji:'' },
  { sym:'IGV', name:'소프트웨어', color:'#b13a30', emoji:'' },
  { sym:'XBI', name:'바이오텍',   color:'var(--data-purple)', emoji:'' },
  { sym:'ITA', name:'방산/항공',  color:'#22754c', emoji:'' },
  { sym:'OIH', name:'오일서비스', color:'#8a8271', emoji:'' },
  { sym:'AMLP',name:'MLP/파이프', color:'#8a8271', emoji:'' },
  { sym:'URA', name:'우라늄/원전',color:'#22754c', emoji:'' },
  { sym:'XOP', name:'E&P',       color:'#b13a30', emoji:'' },
  { sym:'HACK',name:'사이버보안', color:'#211d16', emoji:'' },
  { sym:'GDX', name:'금광',      color:'#8a8271', emoji:'' },
  { sym:'BOTZ',name:'로보틱스',  color:'#211d16', emoji:'' },
  { sym:'ICLN',name:'클린에너지',color:'#22754c', emoji:'' },
  { sym:'LIT', name:'리튬/배터리',color:'#b13a30', emoji:'' },
  { sym:'KRE', name:'지역은행', color:'#8a8271', emoji:'' }, { sym:'ITB', name:'주택건설', color:'#57513f', emoji:'' }, { sym:'XRT', name:'소매', color:'#b13a30', emoji:'' }, { sym:'IYT', name:'운송', color:'#211d16', emoji:'' }, // P1590: core industry groups (CIBR duplicated HACK)
  { sym:'JETS',name:'항공', color:'#57513f', emoji:'' }, { sym:'COPX',name:'구리 광산', color:'#22754c', emoji:'' }, { sym:'KWEB',name:'중국 인터넷', color:'#b13a30', emoji:'' },
];

// ── 종합 테마 맵 (screener_pro.py SECTOR_LEADERS 기반 + 확장) ────
// P1588 구성 기준: 하위 테마 = 산업·사업 모델 분류, 공개 수익률이 있는 유니버스 종목만, 분류는 실제 사업 역할을 따르고 수익률 순위만 3개 이상 표본에서 계산, 테마 안 중복 없음. leaders = 전체 구성 종목(목록 순서는 시가총액 순위가 아님), leaderHighlight = 상위 4개, 편집 비중 없음(동일가중·중앙값).
var THEME_MEMBERSHIP_POLICY = Object.freeze({
  version:'theme-membership.v2',
  source:'AIO curated taxonomy',
  sourceKind:'REFERENCE',
  observedAt:'2026-10-13',
  allowedUse:'reference',
  status:'reviewed',
  note:'구성 종목은 산업·사업 모델 기준의 편집 분류(2026-10-13 검토)이며 공식 지수 구성이 아닙니다. 테마 수익률은 동일가중·중앙값으로 계산합니다.'
});
window.THEME_MEMBERSHIP_POLICY = THEME_MEMBERSHIP_POLICY;
var THEME_MAP = [
  { id:'defense', nameKr:'방산/항공우주', emoji:'', color:'#22754c', etf:'ITA', etfName:'iShares Defense',
    leaders:['GE','RTX','PLTR','BA','LMT','HWM','GD','NOC','TDG','RKLB','LHX','AXON','ASTS','LDOS','TXT','HII','HEI','RDW','IRDM','LUNR','KTOS','AVAV'], leaderHighlight:['GE','RTX','PLTR','BA'],
    subThemes:[
      { name:'방산 프라임', tickers:['LMT','RTX','NOC','GD','HII','LHX'] },
      { name:'우주/위성', tickers:['RKLB','ASTS','LUNR','RDW','IRDM'] },
      { name:'항공기/부품', tickers:['BA','GE','HWM','TDG','HEI','TXT'] },
      { name:'방산 기술/드론', tickers:['PLTR','AXON','LDOS','KTOS','AVAV'] }
    ] },
  { id:'staples', nameKr:'필수소비재', emoji:'', color:'#211d16', etf:'XLP', etfName:'Consumer Staples',
    leaders:['WMT','COST','KO','PG','PM','PEP','MO','MDLZ','CL','TGT','MNST','KDP','KR','SYY','HSY','KVUE','KMB','DG','DLTR','CHD','KHC','GIS','BTI','CLX'], leaderHighlight:['WMT','COST','KO','PG'],
    subThemes:[
      { name:'음료', tickers:['KO','PEP','MNST','KDP'] },
      { name:'식품', tickers:['MDLZ','HSY','GIS','KHC','SYY'] },
      { name:'생활용품', tickers:['PG','CL','CLX','CHD','KMB','KVUE'] },
      { name:'할인/식료품 유통', tickers:['COST','WMT','TGT','KR','DG','DLTR'] },
      { name:'담배', tickers:['PM','MO','BTI'] }
    ] },
  { id:'healthcare', nameKr:'헬스케어/제약', emoji:'', color:'#211d16', etf:'XLV', etfName:'Healthcare',
    leaders:['LLY','JNJ','ABBV','MRK','UNH','TMO','AMGN','GILD','ABT','PFE','DHR','ISRG','MRNA','VRTX','BMY','MDT','MCK','CVS','SYK','HCA','ELV','CI','REGN','BSX','COR','CAH','BDX','EW','A','HUM','VEEV','WAT','IDXX','RMD','DXCM','BIIB','ZTS','ALNY','GEHC','NVO','TEM','AZN','NVS','CNC','DVA','ARGX','HIMS','VKTX'], leaderHighlight:['LLY','JNJ','ABBV','MRK'],
    subThemes:[
      { name:'대형 제약', tickers:['LLY','JNJ','MRK','PFE','ABBV','BMY','NVO','AZN','NVS','ZTS'] },
      { name:'바이오텍', tickers:['VRTX','REGN','AMGN','GILD','MRNA','BIIB','ALNY','ARGX','VKTX'] },
      { name:'디지털 헬스/의료 데이터', tickers:['VEEV','HIMS','TEM'] },
      { name:'관리의료/보험', tickers:['UNH','ELV','CI','CVS','HUM','CNC'] },
      { name:'의료기기', tickers:['ISRG','ABT','SYK','BSX','MDT','EW','BDX','DXCM','RMD','GEHC'] },
      { name:'병원/유통/서비스', tickers:['HCA','MCK','COR','CAH','DVA'] },
      { name:'생명과학/진단', tickers:['TMO','DHR','A','WAT','IDXX'] }
    ] },
  { id:'utilities', nameKr:'유틸리티', emoji:'', color:'#211d16', etf:'XLU', etfName:'Utilities',
    leaders:['BE','NEE','CEG','SO','DUK','AEP','D','VST','SRE','ETR','XEL','EXC','PEG','PCG','ATO','FE','ES','NRG','EIX','FSLR','EVRG','LNT','OKLO','TLN','PNW','CCJ','SMR','ENPH','SEDG','RUN','NXT','ARRY','SHLS','BWXT','LEU','NNE','PLUG','FCEL','FLNC'], leaderHighlight:['BE','NEE','CEG','SO'],
    subThemes:[
      { name:'원전/독립발전', tickers:['CEG','VST','NRG','TLN','SMR','OKLO'] },
      { name:'규제 유틸리티', tickers:['SO','DUK','AEP','D','EXC','SRE','PCG','PEG','ETR','XEL','EIX','ES','FE','EVRG','LNT','PNW','ATO'] },
      { name:'재생에너지/태양광', tickers:['NEE','FSLR','NXT','ENPH','SEDG','RUN','ARRY','SHLS'] },
      { name:'원전 연료/설비', tickers:['CCJ','BWXT','LEU','NNE'] },
      { name:'수소/연료전지/ESS', tickers:['BE','PLUG','FCEL','FLNC'] }
    ] },
  { id:'energy', nameKr:'에너지', emoji:'', color:'var(--data-green)', etf:'XLE', etfName:'Energy',
    leaders:['CVX','COP','MPC','PSX','XOM','WMB','EOG','EPD','SLB','KMI','TRGP','VLO','OXY','OKE','BKR','FANG','DVN','TPL','HAL','CNQ','SU','ET','FTI','NOV','WHD','DK','SHEL','ENB'], leaderHighlight:['CVX','COP','MPC','PSX'],
    subThemes:[
      { name:'통합 메이저', tickers:['XOM','CVX','SU','SHEL'] },
      { name:'E&P(탐사/생산)', tickers:['COP','EOG','CNQ','OXY','DVN','FANG','TPL'] },
      { name:'미드스트림', tickers:['EPD','ET','WMB','KMI','OKE','TRGP','ENB'] },
      { name:'오일서비스', tickers:['SLB','BKR','HAL','FTI','NOV','WHD'] },
      { name:'정유', tickers:['MPC','PSX','VLO','DK'] }
    ] },
  { id:'semiconductor', nameKr:'반도체', emoji:'', color:'var(--data-purple)', etf:'SMH', etfName:'VanEck Semiconductor',
    leaders:['NVDA','AVGO','MU','AMD','INTC','AMAT','LRCX','ARM','TXN','KLAC','MRVL','SNDK','ADI','QCOM','TSM','STX','WDC','ASML','TER','NXPI','MCHP','ON','UMC','GFS','ENTG','ACLS','UCTT','ONTO','AMKR','MPWR','FORM','COHU','KLIC'], leaderHighlight:['NVDA','AVGO','MU','AMD'],
    subThemes:[
      { name:'AI 칩/커스텀 ASIC', tickers:['NVDA','AVGO','AMD','MRVL','ARM'] },
      { name:'메모리/스토리지', tickers:['MU','SNDK','WDC','STX'] },
      { name:'장비/소재', tickers:['ASML','AMAT','LRCX','KLAC','ENTG','ACLS','UCTT','ONTO'] },
      { name:'테스트/패키징', tickers:['TER','AMKR','FORM','COHU','KLIC'] },
      { name:'아날로그/전원 IC·MCU/RF', tickers:['TXN','ADI','QCOM','NXPI','MCHP','ON','MPWR'] },
      { name:'파운드리', tickers:['TSM','INTC','GFS','UMC'] }
    ] },
  { id:'software', nameKr:'소프트웨어/클라우드', emoji:'', color:'#b13a30', etf:'IGV', etfName:'iShares Software',
    leaders:['MSFT','AMZN','ORCL','GOOGL','PANW','CRM','PLTR','NOW','FTNT','CRWD','ADBE','SNPS','CDNS','INTU','SNOW','SHOP','APP','ADSK','MDB','NET','WDAY','DDOG','ZS','TEAM','TTD','ESTC','AI','S','RBRK','PATH','APPN','PEGA'], leaderHighlight:['MSFT','AMZN','ORCL','GOOGL'],
    subThemes:[
      { name:'엔터프라이즈 SaaS', tickers:['ORCL','CRM','NOW','INTU','ADBE','WDAY','TEAM'] },
      { name:'사이버보안', tickers:['PANW','CRWD','FTNT','ZS','NET','S','RBRK'] },
      { name:'데이터/AI 플랫폼', tickers:['PLTR','SNOW','DDOG','MDB','ESTC','AI'] },
      { name:'광고/커머스 소프트웨어', tickers:['APP','SHOP','TTD'] },
      { name:'설계 소프트웨어(EDA·CAD)', tickers:['SNPS','CDNS','ADSK'] },
      { name:'클라우드 인프라', tickers:['MSFT','AMZN','GOOGL'] },
      { name:'업무 자동화 소프트웨어', tickers:['PATH','APPN','PEGA'] }
    ] },
  { id:'industrials', nameKr:'산업재/물류', emoji:'', color:'var(--data-cyan)', etf:'XLI', etfName:'Industrials',
    leaders:['CAT','GEV','DE','UNP','ETN','HON','PH','ADP','TT','PWR','JCI','EMR','CSX','MMM','WM','CTAS','ITW','NSC','FDX','UPS','RSG','URI','GWW','FAST','PCAR','AME','WAB','CARR','PAYX','CPRT','HUBB','JBHT','NDSN','ODFL','GNRC','LII'], leaderHighlight:['CAT','GEV','DE','UNP'],
    subThemes:[
      { name:'철도/화물/물류', tickers:['UNP','CSX','NSC','UPS','FDX','ODFL','JBHT'] },
      { name:'건설·농기계/장비', tickers:['CAT','DE','PCAR','URI'] },
      { name:'전력장비/그리드', tickers:['GEV','ETN','PWR','HUBB','GNRC'] },
      { name:'공조/빌딩', tickers:['TT','CARR','JCI','LII'] },
      { name:'다각화 산업재', tickers:['HON','MMM','ITW','EMR','PH','AME','WAB','NDSN'] },
      { name:'기업서비스/유통/환경', tickers:['ADP','PAYX','CTAS','GWW','FAST','CPRT','WM','RSG'] }
    ] },
  { id:'financials', nameKr:'금융', emoji:'', color:'var(--data-amber)', etf:'XLF', etfName:'Financials',
    leaders:['JPM','BAC','MS','WFC','C','AXP','V','SCHW','BLK','CB','PGR','COF','SPGI','BNY','PNC','USB','ICE','MRSH','BX','MCO','TRV','KKR','GS','MA','AON','NDAQ','PYPL','NU','AIG','MSCI','SOFI','CME','AFRM','TFC','XYZ','BRK-B'], leaderHighlight:['JPM','BAC','MS','WFC'],
    subThemes:[
      { name:'대형 은행', tickers:['JPM','BAC','WFC','C'] },
      { name:'투자은행/브로커', tickers:['GS','MS','SCHW'] },
      { name:'지역·소비자 은행', tickers:['PNC','USB','TFC','COF'] },
      { name:'자산운용/수탁', tickers:['BLK','BX','KKR','BNY'] },
      { name:'보험', tickers:['BRK-B','PGR','CB','TRV','AIG','MRSH','AON'] },
      { name:'거래소/금융데이터', tickers:['SPGI','MCO','ICE','CME','NDAQ','MSCI'] },
      { name:'결제/핀테크', tickers:['V','MA','AXP','PYPL','XYZ','SOFI','AFRM','NU'] }
    ] },
  { id:'reits', nameKr:'리츠/부동산', emoji:'', color:'#211d16', etf:'XLRE', etfName:'Real Estate',
    leaders:['WELL','PLD','EQIX','AMT','DLR','O','PSA','VTR','IRM','CCI','SBAC','KIM','REG','SPG','STAG'], leaderHighlight:['WELL','PLD','EQIX','AMT'],
    subThemes:[
      { name:'데이터센터', tickers:['EQIX','DLR','IRM'] },
      { name:'통신탑', tickers:['AMT','CCI','SBAC'] },
      { name:'물류/스토리지', tickers:['PLD','PSA','STAG'] },
      { name:'리테일/헬스케어', tickers:['WELL','SPG','O','VTR','KIM','REG'] }
    ] },
  { id:'consumer_disc', nameKr:'임의소비재', emoji:'', color:'#57513f', etf:'XLY', etfName:'Consumer Disc',
    leaders:['AMZN','TSLA','TM','HD','MCD','TJX','UBER','SBUX','LOW','MAR','MELI','GM','HLT','ROST','ORLY','BKNG','EBAY','AZO','CMG','YUM','ABNB','DASH','NKE','F','SE','RIVN','CPNG','DPZ','LULU','GRAB','ETSY','CAVA','MBLY','LYFT','DKNG','FLUT','PENN'], leaderHighlight:['AMZN','TSLA','TM','HD'],
    subThemes:[
      { name:'이커머스', tickers:['AMZN','MELI','SE','CPNG','EBAY','ETSY'] },
      { name:'EV/자동차', tickers:['TSLA','TM','GM','F','RIVN','MBLY'] },
      { name:'여행/레저', tickers:['BKNG','ABNB','MAR','HLT'] },
      { name:'외식', tickers:['MCD','SBUX','CMG','YUM','DPZ','CAVA'] },
      { name:'홈·자동차부품 리테일', tickers:['HD','LOW','ORLY','AZO'] },
      { name:'의류/할인 리테일', tickers:['TJX','ROST','NKE','LULU'] },
      { name:'모빌리티/딜리버리', tickers:['UBER','DASH','GRAB','LYFT'] },
      { name:'스포츠 베팅', tickers:['DKNG','FLUT','PENN'] }
    ] },
  { id:'materials', nameKr:'원자재', emoji:'', color:'#22754c', etf:'XLB', etfName:'Materials',
    leaders:['LIN','SCCO','NEM','FCX','SHW','ECL','NUE','CRH','ADM','VMC','MLM','AEM','PPG','B','APD','AA','WPM','ALB','MP','CTVA','IFF','LAC','KGC'], leaderHighlight:['LIN','SCCO','NEM','FCX'],
    subThemes:[
      { name:'산업가스/화학/도료', tickers:['LIN','APD','SHW','ECL','PPG'] },
      { name:'광업/금속', tickers:['SCCO','FCX','NUE','AA'] },
      { name:'금 광산', tickers:['NEM','AEM','B','WPM','KGC'] },
      { name:'건자재', tickers:['VMC','MLM','CRH'] },
      { name:'농업/식품소재', tickers:['CTVA','ADM','IFF'] },
      { name:'전략 광물', tickers:['MP','ALB','LAC'] }
    ] },
  { id:'comm', nameKr:'통신서비스', emoji:'', color:'#211d16', etf:'XLC', etfName:'Comm Services',
    leaders:['META','NTES','GOOGL','NFLX','VZ','DIS','TMUS','T','CMCSA','SPOT','RDDT','TTWO','RBLX','CHTR','PINS','SNAP','SKYD'], leaderHighlight:['META','NTES','GOOGL','NFLX'],
    subThemes:[
      { name:'검색/소셜/광고', tickers:['GOOGL','META','RDDT','PINS','SNAP'] },
      { name:'스트리밍/미디어', tickers:['NFLX','DIS','SPOT','SKYD'] },
      { name:'통신·케이블', tickers:['TMUS','T','VZ','CMCSA','CHTR'] },
      { name:'게임', tickers:['NTES','TTWO','RBLX'] }
    ] },
  { id:'photonics', nameKr:'광통신/포토닉스', emoji:'', color:'#8a8271', etf:null, etfName:'(커스텀 합산)', isComposite: true,
    leaders:['AVGO','ANET','MRVL','LITE','GLW','CIEN','COHR','ALAB','AAOI','VIAV','FN'], leaderHighlight:['AVGO','ANET','MRVL','LITE'],
    subThemes:[
      { name:'광부품/모듈', tickers:['LITE','COHR','AAOI','VIAV','FN'] },
      { name:'광섬유/광네트워크', tickers:['CIEN','GLW','ANET'] },
      { name:'광전자 플랫폼', tickers:['AVGO','MRVL','ALAB'] }
    ] },
  { id:'crypto', nameKr:'크립토/블록체인', emoji:'', color:'var(--data-amber)', etf:null, etfName:'(BTC-USD 기준)', compositeBase: 'BTC-USD',
    leaders:['MSTR','HOOD','IBIT','COIN','IREN','BITO','MARA','RIOT','CLSK'], leaderHighlight:['MSTR','HOOD','IBIT','COIN'],
    subThemes:[
      { name:'거래소/브로커', tickers:['COIN','HOOD'] },
      { name:'채굴/AI 호스팅', tickers:['MARA','RIOT','CLSK','IREN'] },
      { name:'BTC 보유/ETF', tickers:['MSTR','IBIT','BITO'] }
    ] },
  { id:'ai_infra', nameKr:'AI 인프라/데이터센터', emoji:'', color:'var(--data-purple)', etf:null, etfName:'(커스텀 합산)', isComposite: true,
    leaders:['NVDA','AVGO','AMD','CSCO','INTC','ORCL','ARM','GEV','ANET','MRVL','DELL','ETN','NBIS','APH','PWR','HPE','VRT','CRWV','ALAB','IREN','CLS','CRDO','EME','SMCI','CORZ','WULF','CIFR','APLD','NVT'], leaderHighlight:['NVDA','AVGO','AMD','CSCO'],
    subThemes:[
      { name:'AI 칩/CPU', tickers:['NVDA','AVGO','AMD','ARM','INTC'] },
      { name:'서버/HW', tickers:['DELL','SMCI','HPE','CLS'] },
      { name:'네트워킹/인터커넥트', tickers:['ANET','CSCO','ALAB','CRDO','MRVL'] },
      { name:'DC 전력/냉각/건설', tickers:['VRT','ETN','GEV','APH','EME','PWR','NVT'] },
      { name:'GPU 클라우드/AI 호스팅', tickers:['CRWV','NBIS','ORCL','IREN','WULF','CIFR','APLD','CORZ'] }
    ] },
  { id:'robotics', nameKr:'로보틱스/자동화', emoji:'', color:'#211d16', etf:'BOTZ', etfName:'Global Robotics',
    leaders:['TSLA','ISRG','EMR','KEYS','TER','ROK','SYM','PRCT','GMED'], leaderHighlight:['TSLA','ISRG','EMR','KEYS'],
    subThemes:[
      { name:'산업 자동화/물류·휴머노이드 로봇', tickers:['ROK','EMR','TER','KEYS','SYM','TSLA'] },
      { name:'의료 로봇', tickers:['ISRG','PRCT','GMED'] }
    ] },
  { id:'global_adr', nameKr:'해외 대형 ADR', emoji:'', color:'#57513f', etf:null, etfName:'(커스텀 합산)', isComposite: true,
    leaders:['TM','NTES','BABA','HDB','ASML','MELI','NU','NVO','PDD','AZN','SAP','NVS','BIDU','JD','IBN','SONY'], leaderHighlight:['TM','NTES','BABA','HDB'],
    subThemes:[
      { name:'중국 플랫폼', tickers:['BABA','PDD','JD','BIDU','NTES'] },
      { name:'유럽 대형주', tickers:['ASML','SAP','NVO','AZN','NVS'] },
      { name:'일본·신흥국', tickers:['TM','SONY','HDB','IBN','NU','MELI'] }
    ] }
];

// ── 테마 ID → 인덱스 빠른 조회 ──────────────────────────────────
var THEME_INDEX = {};
THEME_MAP.forEach(function(t, i){ THEME_INDEX[t.id] = i; });

// ── 전체 섹터+서브섹터 ETF 목록 (RRG 확장 뷰용) ─────────────────
var ALL_RRG_ETFS = RRG_SECTORS.concat(RRG_SUBSECTORS);

// ══════════════════════════════════════════════════════════════════
//  RS (Relative Strength) 계산 시스템 — screener_pro.py 방법론
// ══════════════════════════════════════════════════════════════════
// 스크리너 공식: rs_comp = 0.40×rs252 + 0.20×rs126 + 0.20×rs63 + 0.20×rs21
// RRG: RS_Ratio = 100 × (Sector/SPY) / MA(Sector/SPY, 13wk)
//      RS_Momentum = 100 × RS_Ratio / MA(RS_Ratio, 13wk)

// 히스토리컬 가격 데이터 저장소 (심볼별)
var _priceHistory = {};
// P721: 심볼별 히스토리 종류 마커 — true면 실제 일봉 종가 시계열(hydrateRRGDailyHistory가 채움).
// collectPriceHistory의 세션 내 틱 push가 일봉 시계열을 밀어내며 오염시키는 것을 차단한다.
var _priceHistoryDaily = {};

// 라이브 데이터 기반 RS 근사 계산
function calcLiveRS(sym) {
  let ld = window._liveData || {};
  var d = ld[sym], spy = ld['SPY'];

  // P721: 일봉 종가 시계열(hydrateRRGDailyHistory)이 있으면 라이브 틱 존재와 무관하게 판정한다
  // — RRG는 일봉 기반 지표이며, 종전의 틱 선행 게이트는 시세 지연 환경에서 히스토리가 있어도
  // 전면 보류시키는 불필요한 결합이었다. 틱 기반 레거시 경로만 라이브 시세를 요구한다.
  // RM-03 item 2: single-implementation call — RRG math (RS-Ratio/RS-Momentum/quadrant) lives in
  // src/domain/themes/rrg.js (computeRelativeRotation), exposed via window.AIO_ARCH so this legacy
  // wrapper and any native consumer share one model (R352/F-03: no parallel formula here).
  var _rrgFn = window.AIO_ARCH && typeof window.AIO_ARCH.computeRelativeRotation === 'function' ? window.AIO_ARCH.computeRelativeRotation : null;
  if (_rrgFn) {
    return _rrgFn({ history: _priceHistory[sym] || null, benchmarkHistory: _priceHistory['SPY'] || null, hasQuote: !!d, hasBenchmarkQuote: !!spy });
  }
  // Fail-closed fallback for the (unexpected) case the ESM architecture runtime never mounted —
  // mirrors the model's own "insufficient data" shape instead of duplicating the RRG formula here.
  return { rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'quote_missing' };
}

// ══════════════════════════════════════════════════════════════════
//  커스텀 테마 합산 (ETF 없는 테마: 정규화 수익률 기반)
// ══════════════════════════════════════════════════════════════════
// 주의: 단순 가격 합산 아님! 기준일 대비 정규화 수익률(normalized returns) 사용

function calcCompositePerf(tickers, weights) {
  tickers = tickers || [];
  let ld = window._liveData || {};
  var total = 0, count = 0, weighted = 0, totalWeight = 0;
  tickers.forEach(function(t) {
    var d = ld[t];
    if (!d || !d.price || d.pct == null || !isFinite(d.pct)) return;
    var chg = d.pct;
    var w;
    if (weights && weights[t]) {
      // v36.4: ETF 추종 정적 비중 (정확한 섹터 대표성)
      w = weights[t];
    } else {
      // 시가총액 근거가 없으면 가격 프록시를 만들지 않고 동일가중한다.
      var _dbRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
      var _dbE = _dbRows.find(function(e){ return e.sym === t; }) || null;
      w = (_dbE && _dbE.mcap > 0) ? _dbE.mcap : 1;
    }
    weighted += chg * w;
    totalWeight += w;
    count++;
  });
  return {
    chgPct: totalWeight > 0 ? weighted / totalWeight : null,
    count: count,
    total: tickers.length
  };
}

function _isCurrentQuoteData(sym) {
  var d = (window._liveData || {})[sym];
  var s = (window._dataSource || {})[sym];
  if (!d || d.price == null || d.pct == null || !isFinite(d.pct)) return false;
  if (!s || !s.source) return true;
  var src = String(s.source || '').toLowerCase();
  if (src === 'snapshot' || src.indexOf('fallback') >= 0 || src.indexOf('stale-cache') >= 0) return false;
  if (s.metric && typeof evaluateMetric === 'function') {
    var q = evaluateMetric(s.metric);
    if (q && q.hardStale) return false;
  }
  return true;
}

// 테마별 퍼포먼스 계산
function getThemePerf(theme) {
  let ld = window._liveData || {};
  var totalCandidates = (theme.leaders || theme.tickers || []).length || 1;
  if (theme.etf && _isCurrentQuoteData(theme.etf)) {
    return { chgPct: ld[theme.etf].pct, source: theme.etf, count: 1, total: 1, quality: 'live' };
  }
  if (theme.compositeBase && _isCurrentQuoteData(theme.compositeBase)) {
    return { chgPct: ld[theme.compositeBase].pct, source: theme.compositeBase, count: 1, total: 1, quality: 'live' };
  }
  // 커스텀 합산 (정규화) — v36.4: weights 전달
  var sourceTickers = theme.tickers && theme.tickers.length ? theme.tickers : theme.leaders;
  var comp = calcCompositePerf(sourceTickers || [], theme.weights);
  if (comp.count <= 0 || comp.chgPct == null) {
    return { chgPct: null, source: 'LIVE_REQUIRED', count: 0, total: totalCandidates, quality: 'missing' };
  }
  return { chgPct: comp.chgPct, source: theme.weights ? 'live-weighted(' + comp.count + '/' + comp.total + ')' : 'live-composite(' + comp.count + '/' + comp.total + ')', count: comp.count, total: comp.total, quality: comp.count / Math.max(1, comp.total) >= 0.5 ? 'live' : 'partial' };
}

// ══════════════════════════════════════════════════════════════════
//  시장 브레드스 (Market Breadth) — screener compute_breadth 기반
// ══════════════════════════════════════════════════════════════════
function calcSectorBreadth(tickers) {
  // v36.9: 종가 기준 pct 사용 (장중 변동으로 폭 흔들림 방지)
  let ld = window._liveData || {};
  var above = 0, total = 0;
  tickers.forEach(function(t) {
    var d = ld[t];
    if (!d || !d.price) return;
    total++;
    // 간이 브레드스: 금일 양봉 비율 (종가 기준 pct)
    if ((d.pct != null ? d.pct : 0) > 0) above++;
  });
  return total >= Math.max(2, Math.ceil(tickers.length * 0.6)) ? Math.round(above / total * 100) : null;
}

var _rrgViewMode = 'sectors'; // 'sectors' or 'subsectors' or 'all'

function setRRGView(mode, btn) {
  _rrgViewMode = mode;
  document.querySelectorAll('#rrg-view-tabs .news-sort-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  drawRRG();
  try { document.dispatchEvent(new CustomEvent('aio:themesViewChanged', { detail: { mode: _rrgViewMode } })); } catch (_) {}
}

// ── RRG 4분면 텍스트 카드 — v52.71 아이보리 3g: 시안 구조(산점도 대신 사분면별 섹터 칩 목록),
// 기존 calcLiveRS()/classifyRRG() 재사용, 신규 알고리즘 없음 ──
function drawRRG() {
  if (!window._rrgRetry) window._rrgRetry = 0;
  // P799: native themes owns the RRG canvas from normalized quadrant evidence.
  if (document.querySelector('[id="rrg-canvas"]')?.dataset.aioRrgChartRenderer === 'native') return;
  let ld = window._liveData || {};
  // v45.5: SPY가 없으면 시드 기반 RRG 그리기 불가 → 로딩 상태 표시 + 짧은 재시도
  if (!ld['SPY']) {
    var stWait = document.querySelector('[id="rrg-chart-status"]');
    if (stWait && stWait.dataset.aioRrgStatusRenderer !== 'native') stWait.textContent = '시세 수신 대기... (' + Object.keys(ld).length + '개 수신)';
    window._rrgRetry++;
    if (window._rrgRetry < 40) { // 최대 20초 (500ms x 40)
      setTimeout(drawRRG, 500);
    } else {
      if (stWait && stWait.dataset.aioRrgStatusRenderer !== 'native') stWait.textContent = '시세 연결 지연 — 잠시 후 자동 갱신됩니다';
    }
    return;
  }
  window._rrgRetry = 0;
  var canvas = document.querySelector('[id="rrg-canvas"]');
  if (!canvas) return;
  // v30.13d: 컨테이너 기반 동적 캔버스 크기 — 비율 왜곡 방지
  var containerW = canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 900;
  if (containerW < 300) containerW = 900;
  var targetH = Math.round(containerW * 0.52); // 약 1.92:1 비율
  if (targetH > 520) targetH = 520;
  if (canvas.width !== containerW || canvas.height !== targetH) {
    canvas.width = containerW;
    canvas.height = targetH;
  }
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var spy = ld['SPY'] ? ld['SPY'].price : null;

  ctx.clearRect(0, 0, W, H);

  // v48.43: Background quadrants — 새 팔레트 (cyan/magenta/amber/red 대응)
  var cx = W/2, cy = H/2, inkRgb = (getComputedStyle(document.body).getPropertyValue('--ink-rgb').trim() || '33,29,22'); // canvas cannot resolve var(): themed ink read once
  // Leading (right-top) = green
  ctx.fillStyle = 'rgba(34,117,76,0.08)'; ctx.fillRect(cx, 0, W/2, cy);
  // Improving (left-top) = cyan
  ctx.fillStyle = 'rgba(' + inkRgb + ',0.08)'; ctx.fillRect(0, 0, cx, cy);
  // Weakening (right-bottom) = amber
  ctx.fillStyle = 'rgba(' + inkRgb + ',0.06)'; ctx.fillRect(cx, cy, W/2, H/2);
  // Lagging (left-bottom) = red
  ctx.fillStyle = 'rgba(177,58,48,0.06)'; ctx.fillRect(0, cy, cx, H/2);

  // v48.43: Grid lines — 토큰 기반
  ctx.strokeStyle = 'rgba(' + inkRgb + ',0.10)'; ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(W,cy); ctx.stroke();
  ctx.setLineDash([]);

  // v48.43: Axis labels — Inter + muted
  ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#8a8271';
  ctx.fillText('RS-Ratio →', W/2, H-8);
  ctx.save(); ctx.translate(16, H/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('RS-Momentum ↑', 0, 0);
  ctx.restore();

  // v48.43: Quadrant labels — 새 팔레트 hex (canvas는 CSS var 미지원)
  ctx.font = 'bold 12px Inter, sans-serif'; ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#22754c'; ctx.textAlign = 'center'; ctx.fillText('선도 Leading', W*3/4, 22);
  ctx.fillStyle = 'rgb(' + inkRgb + ')'; ctx.textAlign = 'center'; ctx.fillText('개선 Improving', W/4, 22);
  ctx.fillStyle = 'rgb(' + inkRgb + ')'; ctx.textAlign = 'center'; ctx.fillText('약화 Weakening', W*3/4, H-14);
  ctx.fillStyle = '#b13a30'; ctx.textAlign = 'center'; ctx.fillText('후행 Lagging', W/4, H-14);
  ctx.globalAlpha = 1;

  // RS 기반 포지션 계산 (screener_pro.py compute_sector_rrg 방법론)
  var activeSectors = _rrgViewMode === 'subsectors' ? RRG_SUBSECTORS :
                      _rrgViewMode === 'all' ? ALL_RRG_ETFS : RRG_SECTORS;

  var positions = [];
  var quadrantCounts = { Leading:0, Improving:0, Weakening:0, Lagging:0 };

  activeSectors.forEach(function(sec) {
    var d = ld[sec.sym];
    if (!d) { positions.push(null); return; }

    var rs = calcLiveRS(sec.sym);
    if (rs.quadrant === 'unknown' || rs.rsRatio === null || rs.rsMom === null) { positions.push(null); return; }
    quadrantCounts[rs.quadrant] = (quadrantCounts[rs.quadrant] || 0) + 1;

    // v30.13d: 동적 레인지 스케일링 — 실제 데이터 범위에 맞춰 확대 (기존 고정 /5 → /3.5)
    var rsNorm = (rs.rsRatio - 100) / 3.5; // 더 넓은 스프레드
    var momNorm = (rs.rsMom - 100) / 3.5;
    // 클램프 to ±0.95 for visual margin
    rsNorm = Math.max(-0.95, Math.min(0.95, rsNorm));
    momNorm = Math.max(-0.95, Math.min(0.95, momNorm));
    var x = cx + rsNorm * (W/2 - 40);
    var y = cy - momNorm * (H/2 - 40);
    x = Math.max(25, Math.min(W-25, x));
    y = Math.max(25, Math.min(H-25, y));
    positions.push({ x:x, y:y, rs:rs.rsRatio, mom:rs.rsMom, q:rs.quadrant });
  });

  // Draw sector dots + labels
  activeSectors.forEach(function(sec, i) {
    var pos = positions[i];
    if (!pos) return;

    // Quadrant-based glow
    var glowColor = pos.q === 'Leading' ? 'rgba(34,117,76,0.3)' :
                    pos.q === 'Improving' ? 'rgba(' + inkRgb + ',0.3)' :
                    pos.q === 'Weakening' ? 'rgba(' + inkRgb + ',0.3)' : 'rgba(177,58,48,0.3)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 14, 0, Math.PI*2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 7, 0, Math.PI*2);
    ctx.fillStyle = sec.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = sec.color;
    ctx.textAlign = 'center';
    ctx.fillText(sec.sym, pos.x, pos.y - 9);
    if (_rrgViewMode !== 'all') {
      ctx.font = '11px system-ui'; /* v48.61 P37: 9px→11px */
      ctx.fillStyle = '#8a8271'; /* v48.61 R43 Canvas hex */
      ctx.fillText(sec.name, pos.x, pos.y + 14);
    }
  });

  // RRG 분면 분포 표시
  var st = document.querySelector('[id="rrg-chart-status"]');
  // P798: RRG chart-status is owned by the native themes state projection; the canvas remains legacy.
  if (st && st.dataset.aioRrgStatusRenderer !== 'native') {
    var lc = quadrantCounts.Leading||0, ic = quadrantCounts.Improving||0;
    var wc = quadrantCounts.Weakening||0, lac = quadrantCounts.Lagging||0;
    var txt = spy ? 'SPY $' + spy.toFixed(2) + ' | ' : '';
    // P1686/M08: counts only — the quadrant mix is not a market-health grade.
    st.textContent = txt + '선도 ' + lc + ' · 개선 ' + ic + ' · 약화 ' + wc + ' · 후행 ' + lac;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTOR PERFORMANCE BARS (확장: 11 섹터 + 서브섹터)
// ═══════════════════════════════════════════════════════════════
var _sectorPerfMode = '1d';
var _sectorPerfView = 'sectors'; // 'sectors' or 'all'

// v45.5: 1주 모드 weekly 캐시 (Yahoo Finance range=5d 사용)
var _sectorWeeklyCache = {}; // sym -> pct
var _sectorWeeklyFetching = false;
var _sectorWeeklyTs = 0;

// Current sector/theme rankings must be live/delayed only. Static fallback pct values
// are intentionally disabled so old market snapshots cannot look tradable.
var _SECTOR_PCT_FALLBACK = {};

function setSectorPerfMode(mode, btn) {
  _sectorPerfMode = mode;
  document.querySelectorAll('#sector-perf-tabs .news-sort-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // v45.5: 1주 모드면 미확보 섹터에 대해 fetch (캐시 일부만 채워진 경우 재시도)
  if (mode === '1w' && !_sectorWeeklyFetching) {
    var src = _sectorPerfView === 'all' ? (typeof ALL_RRG_ETFS !== 'undefined' ? ALL_RRG_ETFS : RRG_SECTORS) : RRG_SECTORS;
    var missing = src.some(function(s) { return _sectorWeeklyCache[s.sym] == null; });
    if (missing) fetchSectorWeeklyPerf();
  }
  renderSectorPerfBars();
  try { document.dispatchEvent(new CustomEvent('aio:sectorPerfChanged', { detail: { mode: _sectorPerfMode, view: _sectorPerfView } })); } catch (_) {}
}

function setSectorPerfView(view, btn) {
  _sectorPerfView = view;
  document.querySelectorAll('#sector-perf-view-tabs .news-sort-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // v45.5: view 변경 시 weekly 캐시도 확장 fetch
  if (_sectorPerfMode === '1w' && !_sectorWeeklyFetching) {
    fetchSectorWeeklyPerf();
  }
  renderSectorPerfBars();
  try { document.dispatchEvent(new CustomEvent('aio:sectorPerfChanged', { detail: { mode: _sectorPerfMode, view: _sectorPerfView } })); } catch (_) {}
}

// v45.5: Yahoo Finance 5일 차트로 주간 수익률 계산 (CORS 프록시 경유)
async function _fetchOneSectorWeekly(sym) {
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d';
    var r = await fetchViaProxy(url, 8000);
    var raw = await r.text();
    if (raw.trimStart().startsWith('<')) return null;
    var data;
    try { data = JSON.parse(raw); } catch(e) { return null; }
    // allorigins wrapper 해제
    if (data && data.contents) {
      try { data = JSON.parse(data.contents); } catch(e) { return null; }
    }
    var parsed = (typeof _parseYFChartResponse === 'function') ? _parseYFChartResponse(data) : null;
    var closes = parsed && parsed.closes ? parsed.closes.filter(function(v){return v!=null && isFinite(v);}) : null;
    if (!closes || closes.length < 2) return null;
    var first = closes[0], last = closes[closes.length - 1];
    if (first <= 0) return null;
    return (last - first) / first * 100;
  } catch(e) {}

  // P1756: the Stooq fallback was removed — every Stooq request answered 404 (direct and via the Worker).
  return null;
}

function fetchSectorWeeklyPerf() {
  if (_sectorWeeklyFetching) return;
  _sectorWeeklyFetching = true;
  var source = _sectorPerfView === 'all' ? (typeof ALL_RRG_ETFS !== 'undefined' ? ALL_RRG_ETFS : RRG_SECTORS) : RRG_SECTORS;
  var todo = source.filter(function(s) { return _sectorWeeklyCache[s.sym] == null; });
  if (todo.length === 0) { _sectorWeeklyFetching = false; return; }
  // 동시 요청 최대 4개로 제한 (프록시 부하 분산)
  var queue = todo.slice();
  var inFlight = 0, MAX = 4;
  function pump(resolve) {
    if (queue.length === 0 && inFlight === 0) { resolve(); return; }
    while (inFlight < MAX && queue.length > 0) {
      var sec = queue.shift();
      inFlight++;
      (function(s) {
        _fetchOneSectorWeekly(s.sym).then(function(pct) {
          if (pct != null && isFinite(pct)) _sectorWeeklyCache[s.sym] = pct;
          inFlight--;
          pump(resolve);
        });
      })(sec);
    }
  }
  new Promise(function(resolve) { pump(resolve); }).then(function() {
    _sectorWeeklyFetching = false;
    _sectorWeeklyTs = Date.now();
    if (_sectorPerfMode === '1w') {
      try { renderSectorPerfBars(); } catch(e) {}
      try { document.dispatchEvent(new CustomEvent('aio:sectorPerfChanged', { detail: { mode: _sectorPerfMode, view: _sectorPerfView, source: 'weekly-cache' } })); } catch (_) {}
    }
  });
}

function renderSectorPerfBars() {
  var container = document.getElementById('sector-perf-bars');
  if (!container) return;
  // P859: native themes owns the bounded sector-performance bars from the
  // normalized themes slice; this compatibility writer must not repaint them.
  if (container.dataset.aioThemePerformanceBarsRenderer === 'native') return;
  let ld = window._liveData || {};
  var source = _sectorPerfView === 'all' ? ALL_RRG_ETFS : RRG_SECTORS;
  var isWeekly = (_sectorPerfMode === '1w');

  var sectors = source.map(function(sec) {
    var d = ld[sec.sym];
    var chg;
    if (isWeekly) {
      // 1주 모드: weekly 캐시 → 라이브 daily 임시. 정적 fallback은 현재 랭킹에 쓰지 않는다.
      if (_sectorWeeklyCache[sec.sym] != null) {
        chg = _sectorWeeklyCache[sec.sym];
      } else if (d && d.pct != null) {
        chg = d.pct; // fetch 미완료 — 라이브 daily로 임시 표시
      } else {
        chg = null;
      }
    } else {
      chg = (d && d.pct != null) ? d.pct : null;
    }
    var rs = calcLiveRS(sec.sym);
    return { sym: sec.sym, name: sec.name, chg: chg, color: sec.color, q: rs.quadrant };
  });

  sectors.sort(function(a,b) {
    if (a.chg == null && b.chg == null) return 0;
    if (a.chg == null) return 1;
    if (b.chg == null) return -1;
    return b.chg - a.chg;
  });

  var maxAbs = Math.max.apply(null, sectors.map(function(s){ return Math.abs(s.chg||0); }));
  if (maxAbs < 0.5) maxAbs = 0.5;

  var html = '';
  sectors.forEach(function(s) {
    var chgVal = s.chg != null ? s.chg : 0;
    var isPos = chgVal >= 0;
    var barColor = s.chg != null ? (isPos ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var barWidth = Math.abs(chgVal) / maxAbs * 45;
    var qBadge = s.chg == null ? '<span style="color:var(--text-muted);font-size:10px;">●대기</span>' :
                 s.q === 'Leading' ? '<span style="color:var(--data-green);font-size:10px;">●선도</span>' :
                 s.q === 'Improving' ? '<span style="color:var(--data-cyan);font-size:10px;">●개선</span>' :
                 s.q === 'Weakening' ? '<span style="color:var(--data-amber);font-size:10px;">●약화</span>' :
                 '<span style="color:var(--data-red);font-size:10px;">●후행</span>';
    html += '<div style="display:flex;align-items:center;gap:3px;height:20px;">' +
      '<span style="width:35px;font-size:11px;font-weight:700;color:var(--text-secondary);text-align:right;">' + s.sym + '</span>' +
      '<span style="width:45px;font-size:10px;color:var(--text-muted);text-align:right;">' + s.name + '</span>' +
      '<div style="flex:1;display:flex;align-items:center;position:relative;">' +
        '<div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(var(--ink-rgb),0.1);"></div>' +
        (isPos ?
          '<div style="margin-left:50%;height:12px;width:' + barWidth + '%;background:' + barColor + ';border-radius:0 3px 3px 0;min-width:2px;"></div>' :
          '<div style="margin-left:calc(50% - ' + barWidth + '%);height:12px;width:' + barWidth + '%;background:' + barColor + ';border-radius:3px 0 0 3px;min-width:2px;"></div>'
        ) +
      '</div>' +
      '<span style="width:62px;text-align:right;font-size:12px;font-weight:700;font-family:var(--font-mono);color:' + barColor + ';flex-shrink:0;">' + (s.chg != null ? ((isPos?'+':'') + s.chg.toFixed(2) + '%') : '—') + '</span>' +
      '<span style="width:36px;text-align:center;flex-shrink:0;">' + qBadge + '</span>' +
    '</div>';
  });
  container.innerHTML = html;
  generateSectorAnalysis(sectors);
}

function generateSectorAnalysis(sectors) {
  var el = document.querySelector('[id="sector-perf-analysis"]');
  // P1267: the fallback may describe observed sector returns, but not infer breadth, cycle, flows, or strategy from them.
  if (!el || el.dataset.aioThemePerformanceRenderer === 'native' || !Array.isArray(sectors)) return;
  var rows = sectors.filter(function(row) { return row && row.chg != null && Number.isFinite(Number(row.chg)); })
    .map(function(row) { return { name: String(row.name || row.sym || '섹터'), symbol: String(row.sym || ''), change: Number(row.chg) }; })
    .sort(function(a, b) { return b.change - a.change; });
  if (rows.length < 2) {
    el.textContent = '섹터 성과 요약 보류 · 비교 가능한 등락률이 2개 이상 수신되면 표시합니다.';
    return;
  }
  var format = function(row) { return row.name + (row.symbol ? ' (' + row.symbol + ')' : '') + ' ' + (row.change >= 0 ? '+' : '') + row.change.toFixed(2) + '%'; };
  el.textContent = '현재 선택 기간의 섹터 등락률 · 강세 ' + format(rows[0]) + ' · 약세 ' + format(rows[rows.length - 1]) + ' · 단일 등락률은 시장폭·사이클·자금 흐름을 입증하지 않습니다.';
}

function _themeFinitePct(v) {
  return v != null && isFinite(Number(v));
}
function _themeFmtPct(v, dec, fallback) {
  if (!_themeFinitePct(v)) return fallback || 'LIVE REQUIRED';
  v = Number(v);
  return (v >= 0 ? '+' : '') + v.toFixed(dec == null ? 2 : dec) + '%';
}
function _themeSafeFixed(v, dec, fallback) {
  if (window._aioSafeFixed) return window._aioSafeFixed(v, dec, fallback || '—');
  var n = Number(v);
  return Number.isFinite(n) ? n.toFixed(dec == null ? 2 : dec) : (fallback || '—');
}

function showThemeDetail(themeId) {
  var idx = THEME_INDEX[themeId];
  if (idx === undefined) return;
  var theme = THEME_MAP[idx];
  var container = document.getElementById('theme-detail-panel');
  var themesPage = document.getElementById('page-themes');
  var themesPageActive = !!(themesPage && themesPage.classList.contains('active'));
  // Related-theme controls can be rendered on the ticker page, while the
  // detail surface is mounted only on the themes page. Preserve the user's
  // selection and route to the owning surface instead of silently no-oping.
  if (!container || !themesPageActive) {
    window._currentThemeId = themeId;
    window._aioOpenThemeDetailOnThemes = themeId;
    if (typeof window.showPage === 'function') window.showPage('theme-detail');
    return;
  }
  var legacyContainer = document.getElementById('theme-detail-legacy-content') || container;
  let ld = window._liveData || {};

  var perf = getThemePerf(theme);
  var hasPerf = perf.chgPct != null && isFinite(perf.chgPct);
  var isPos = hasPerf && perf.chgPct >= 0;
  var chgColor = hasPerf ? (isPos ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';

  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
    '<div><span style="font-size:13px;font-weight:900;">' + theme.nameKr + '</span>' +
    (theme.etf ? ' <span style="font-size:13px;font-family:var(--font-mono);color:var(--text-muted);">' + theme.etf + '</span>' : '') +
    '</div>' +
    '<div style="text-align:right;">' +
      '<span style="font-size:14px;font-weight:900;font-family:var(--font-mono);color:' + chgColor + ';">' + (hasPerf ? ((isPos?'+':'') + perf.chgPct.toFixed(2) + '%') : 'LIVE REQUIRED') + '</span>' +
      '<div style="font-size:11px;color:var(--text-muted);">via ' + perf.source + (perf.count != null && perf.total ? ' · ' + perf.count + '/' + perf.total : '') + '</div>' +
    '</div>' +
  '</div>';

  // P790: detailed leader cards are owned by the native child surface.

  // P789: sub-theme composition and breadth are owned by the native child surface.
  var breadth = calcSectorBreadth(theme.leaders);

  // P797: all visible theme-detail content is owned by the native child surfaces.
  legacyContainer.replaceChildren();
  window._currentThemeId = themeId;
  try {
    document.dispatchEvent(new CustomEvent('aio:themeDetailShown', { detail: {
      themeId: themeId,
      themeDetail: {
        id: String(theme.id || themeId),
        label: String(theme.nameKr || theme.name || theme.id || themeId),
         etf: theme.etf || null,
         compositeBase: theme.compositeBase || null,
         insight: (function() {
           var insight = THEME_INSIGHTS[theme.id] || {};
           return {
             macro: insight.macro || '',
             paradox: insight.paradox || '',
             chainEffect: insight.chainEffect || '',
             sentiment: insight.sentiment || '',
             breakSignals: Array.isArray(insight.breakSignals) ? insight.breakSignals.slice() : []
           };
         }()),
        pct: _themeFinitePct(perf.chgPct) ? Number(perf.chgPct) : null,
        breadth: _themeFinitePct(breadth) ? Number(breadth) : null,
        source: perf.source || 'quote-missing',
        membershipPolicy: THEME_MEMBERSHIP_POLICY,
        leaders: Array.isArray(theme.leaders) ? theme.leaders.slice() : [],
        leaderHighlight: Array.isArray(theme.leaderHighlight) ? theme.leaderHighlight.slice() : [],
        quotes: (function() {
          var symbols = [];
          var addSymbol = function(symbol) { if (symbol && symbols.indexOf(symbol) < 0) symbols.push(symbol); };
          addSymbol(theme.etf);
          addSymbol(theme.compositeBase);
          (theme.leaders || []).forEach(addSymbol);
          (theme.leaderHighlight || []).forEach(addSymbol);
          (theme.subThemes || []).forEach(function(sub) {
            addSymbol(sub && sub.etf);
            (sub && sub.tickers || []).forEach(addSymbol);
          });
          return symbols.reduce(function(out, symbol) {
            var quote = ld[symbol] || {};
            out[symbol] = {
              price: quote.price != null && isFinite(Number(quote.price)) ? Number(quote.price) : null,
              pct: quote.pct != null && isFinite(Number(quote.pct)) ? Number(quote.pct) : null,
              currency: quote.currency ? String(quote.currency).trim().toUpperCase() : null
            };
            return out;
          }, {});
        }()),
        subThemes: Array.isArray(theme.subThemes) ? theme.subThemes.map(function(sub) {
          return {
            name: sub && sub.name,
            tickers: Array.isArray(sub && sub.tickers) ? sub.tickers.slice() : [],
            etf: sub && sub.etf || null,
            weights: sub && sub.weights && typeof sub.weights === 'object' ? Object.assign({}, sub.weights) : null
          };
        }) : []
      }
    } }));
  } catch(_) {}
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (container.scrollIntoView) container.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  } catch(_) {}
}
// Keep the delegated data-action contract valid even when this legacy script
// is evaluated in a scoped host rather than as a classic global script.
window.showThemeDetail = showThemeDetail;

function closeThemeDetail() {
  var p = document.getElementById('theme-detail-panel');
  try { document.dispatchEvent(new CustomEvent('aio:themeDetailClosed')); } catch(_) {}
}

// ═══════════════════════════════════════════════════════════════
//  v38.3: 세분화 테마(SUB_THEMES) 심층 분석
// ═══════════════════════════════════════════════════════════════
function showSubThemeDetail(subThemeId) {
  var idx = SUB_THEME_INDEX[subThemeId];
  if (idx === undefined) return;
  var st = SUB_THEMES[idx];
  var container = document.getElementById('sub-theme-detail-panel');
  if (!container) return;
  let ld = window._liveData || {};

  // 테마 퍼포먼스 계산
  var perf;
  if (st.etf && ld[st.etf]) {
    perf = { chgPct: (ld[st.etf].pct != null ? ld[st.etf].pct : 0), source: st.etf };
  } else {
    var comp = calcCompositePerf(st.tickers, st.weights);
    perf = { chgPct: comp.chgPct, source: st.weights ? '설정가중(참고 ' + comp.count + ')' : '합산(' + comp.count + ')' };
  }
  var hasPerf = _themeFinitePct(perf.chgPct);
  var isPos = hasPerf && perf.chgPct >= 0;
  var chgColor = hasPerf ? (isPos ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';

  // ── 헤더 ──
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
    '<div><span style="font-size:15px;font-weight:900;">' + st.name + '</span>' +
    (st.etf ? ' <span style="font-size:13px;font-family:var(--font-mono);color:var(--accent);">' + st.etf + '</span>' : '') +
    '</div>' +
    '<div style="text-align:right;">' +
      '<span style="font-size:16px;font-weight:900;font-family:var(--font-mono);color:' + chgColor + ';">' + _themeFmtPct(perf.chgPct, 2, 'LIVE REQUIRED') + '</span>' +
      '<div style="font-size:10px;color:var(--text-muted);">via ' + perf.source + '</div>' +
    '</div>' +
  '</div>';

  // ── 테마 설명 ──
  html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;padding:8px 10px;background:var(--surface-1);border-radius:3px;">' + st.desc + '</div>';

  // ── 전 종목 상세 테이블 ──
  html += '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">전 종목 상세 (All ' + st.tickers.length + ' Stocks)</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:4px;margin-bottom:12px;">';

  // 종목별 데이터 수집 및 정렬
  var tickerData = st.tickers.map(function(t) {
    var d = ld[t];
    var pctVal = d && _themeFinitePct(d.pct);
    var priceVal = d && d.price != null && isFinite(Number(d.price));
    var hasData = Boolean(pctVal && priceVal);
    return { ticker: t, price: hasData ? Number(d.price) : null, pct: hasData ? Number(d.pct) : null, hasData: hasData };
  });
  tickerData.sort(function(a,b) {
    if (!a.hasData && !b.hasData) return 0;
    if (!a.hasData) return 1;
    if (!b.hasData) return -1;
    return b.pct - a.pct;
  });

  tickerData.forEach(function(td) {
    var tcol = !td.hasData ? 'var(--text-muted)' : (td.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)');
    var pctStr = !td.hasData ? '—' : ((td.pct >= 0 ? '+' : '') + td.pct.toFixed(2) + '%');
    var priceStr = !td.hasData ? '' : ('$' + (td.price >= 1000 ? td.price.toLocaleString(undefined,{maximumFractionDigits:0}) : td.price.toFixed(2)));
    var w = (st.weights && st.weights[td.ticker]) ? st.weights[td.ticker] : null;
    var wStr = w ? '<span style="font-size:11px;color:var(--text-muted);"> ' + w + '%</span>' : '';
    html += '<div style="background:var(--surface-1);border:1px solid var(--surface-4);border-radius:3px;padding:5px 6px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:12px;font-weight:800;font-family:var(--font-mono);">' + td.ticker + wStr + '</span>' +
        '<span style="font-size:11px;font-weight:700;font-family:var(--font-mono);color:' + tcol + ';">' + pctStr + '</span>' +
      '</div>' +
      (priceStr ? '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + priceStr + '</div>' : '') +
    '</div>';
  });
  html += '</div>';

  // ── 데이터 커버리지 표시 ──
  var dataCount = tickerData.filter(function(td) { return td.hasData; }).length;
  var coveragePct = Math.round(dataCount / st.tickers.length * 100);
  if (coveragePct < 100) {
    html += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">데이터 수신: ' + dataCount + '/' + st.tickers.length + ' (' + coveragePct + '%) — ' +
      (coveragePct < 50 ? '<span style="color:var(--data-amber);">장 마감 또는 데이터 지연으로 일부 종목 미수신</span>' : '대부분 수신 완료') + '</div>';
  }

  // ── 브레드스 ──
  var tickers = st.tickers;
  var above = 0, below = 0, flat = 0, totalValid = 0;
  tickers.forEach(function(t) {
    var d = ld[t];
    if (!d || d.pct == null) return;
    totalValid++;
    if (d.pct > 0) above++;
    else if (d.pct < 0) below++;
    else flat++;
  });
  if (totalValid > 0) {
    var breadth = Math.round(above / totalValid * 100);
    html += '<div style="margin-bottom:10px;">' +
      '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">브레드스 (종목 건강도)</div>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;height:6px;background:var(--surface-4);border-radius:3px;overflow:hidden;display:flex;">' +
          '<div style="width:' + breadth + '%;background:var(--data-green);"></div>' +
          '<div style="width:' + Math.round(flat/totalValid*100) + '%;background:#888;"></div>' +
          '<div style="width:' + Math.round(below/totalValid*100) + '%;background:var(--data-red);"></div>' +
        '</div>' +
        '<span style="font-size:11px;color:' + (breadth>50?'var(--data-green)':'var(--data-red)') + ';font-weight:700;">' + breadth + '% 상승(전일 대비)</span>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">상승 ' + above + ' · 보합 ' + flat + ' · 하락 ' + below + ' / ' + totalValid + '종목</div>' +
    '</div>';
  }

  // ── 심층 분석 ──
  html += '<div style="margin-top:10px;padding:14px;background:rgba(var(--ink-rgb),0.05);border:1px solid rgba(var(--ink-rgb),0.15);border-radius:4px;">';
  html += '<div style="font-size:13px;font-weight:900;color:var(--accent);margin-bottom:10px;">심층 분석 — ' + st.name + '</div>';
  var sections = [];

  // 1) 온도 진단
  var pct = hasPerf ? Number(perf.chgPct) : 0;
  if (!hasPerf) sections.push('<b>Live data required</b> - this sub-theme is connected, but current quotes have not loaded yet. Read the constituent list first and refresh data before using momentum.');
  if (pct >= 3) sections.push('<b>매우 강세</b> — 시장에서 가장 뜨거운 테마 중 하나. 단기 과열 가능성 점검 필요. 모멘텀 추세 추종(trend-following) 전략에 적합하되, 급반전 리스크에도 대비하세요.');
  else if (pct >= 1) sections.push('<b>강세</b> — 기관·헤지펀드 자금이 유입되고 있을 가능성 높음. 테마 ETF(' + (st.etf||'—') + ')와 대장주를 비교해 알파가 어디서 나오는지 파악하세요.');
  else if (pct >= 0) sections.push(' <b>보합</b> — 시장이 이 테마에 대해 아직 방향을 정하지 못함. 카탈리스트(실적 발표, 정책 변화, 기술 진전) 대기 구간. 지금은 관망하되 핵심 종목의 기술적 지지선을 체크하세요.');
  else if (pct >= -2) sections.push('<b>약세</b> — 차익실현 또는 섹터 로테이션 매도 진행 중. 이것이 펀더멘털 훼손인지(구조적 하락) 단순 조정인지(일시적) 구분이 핵심입니다.');
  else sections.push(' <b>급락</b> — 시장에서 외면받는 테마. 구조적 문제(규제, 기술 대체, 수요 감소)가 있는지 반드시 확인하세요. 역발상 진입 시 리스크 관리가 필수.');

  // 2) 종목 간 격차
  var topTk = null, topV = -Infinity, botTk = null, botV = Infinity;
  tickerData.forEach(function(td) {
    if (!td.hasData) return;
    if (td.pct > topV) { topV = td.pct; topTk = td.ticker; }
    if (td.pct < botV) { botV = td.pct; botTk = td.ticker; }
  });
  if (topTk && botTk && topTk !== botTk) {
    var spread = topV - botV;
    if (spread > 5) sections.push('종목 간 등락 편차 <b>' + spread.toFixed(1) + '%p</b> — 매우 큼. 테마 내에서 승자/패자가 명확히 갈리고 있어 개별 종목 선정(stock picking)이 핵심입니다. ETF 매매보다 핵심 대장주에 집중하세요.');
    else if (spread > 2) sections.push('종목 간 편차 <b>' + spread.toFixed(1) + '%p</b> — 적절. 테마 전반이 비슷하게 움직이고 있어 ETF 접근도 유효합니다.');
    else sections.push('종목 간 편차 <b>' + spread.toFixed(1) + '%p</b> — 매우 좁음. 테마 전체가 동일 재료에 반응 중. ETF 매매가 가장 효율적입니다.');
    sections.push(' <b>최강:</b> ' + topTk + ' (' + (topV>=0?'+':'') + _themeSafeFixed(topV, 2, '—') + '%) — 테마 리더, 시장 관심 집중');
    sections.push(' <b>최약:</b> ' + botTk + ' (' + (botV>=0?'+':'') + _themeSafeFixed(botV, 2, '—') + '%) — 개별 악재 또는 밸류에이션 부담 가능');
  }

  // 3) 비중 분석 (weights가 있는 경우)
  if (st.weights) {
    var weightKeys = Object.keys(st.weights).sort(function(a,b) { return st.weights[b] - st.weights[a]; });
    var top3 = weightKeys.slice(0, 3).map(function(t) { return t + '(' + st.weights[t] + '%)'; }).join(', ');
    sections.push(' <b>비중 상위:</b> ' + top3 + ' — ETF ' + (st.etf||'합산') + ' 추종 기준. 이 종목들의 움직임이 테마 전체 수익률을 좌우합니다.');
  }

  // 4) v38.3: 테마별 맞춤 인사이트 (레퍼런스 기반, 고정 텍스트 제거)
  var sti = SUB_THEME_INSIGHTS[subThemeId];
  sections.push('');
  sections.push(' <b>테마 인사이트:</b>');
  if (sti) {
    sections.push('<b>핵심 거시 변수 [' + sti.macroKey + ']:</b> ' + sti.upCondition);
    sections.push('<b>깨지는 신호:</b> ' + sti.breakSignal);
    sections.push('<b>비직관적 인사이트:</b> ' + sti.insight);
  } else {
    sections.push('• 이 테마의 핵심 거시 변수와 깨지는 신호를 AI 분석에서 확인해보세요.');
  }

  // v48.14: 구조적 내러티브 (기관 애널리스트 스타일 — why/valueChain/playerRoles)
  var sn = (typeof THEME_NARRATIVES !== 'undefined') ? THEME_NARRATIVES[subThemeId] : null;
  if (sn) {
    // stale 배지 (narrative 작성일 기준 경과일)
    var _snStaleDays = 0;
    var _snIsStale = false;
    if (typeof THEME_NARRATIVES_META !== 'undefined' && THEME_NARRATIVES_META.lastUpdated) {
      try {
        _snStaleDays = Math.round((Date.now() - new Date(THEME_NARRATIVES_META.lastUpdated).getTime()) / 86400000);
        _snIsStale = _snStaleDays > (THEME_NARRATIVES_META.staleDays || 90);
      } catch(e) {}
    }
    var _staleBadge = ' <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:3px;margin-left:6px;background:' + (_snIsStale ? 'rgba(177,58,48,0.15);color:var(--data-red);border:1px solid rgba(177,58,48,0.3)' : 'rgba(var(--ink-rgb),0.1);color:var(--data-cyan);border:1px solid rgba(var(--ink-rgb),0.2)') + ';">' + (_snIsStale ? 'STALE ' : '') + (THEME_NARRATIVES_META && THEME_NARRATIVES_META.lastUpdated || 'N/A') + ' · 경과 ' + _snStaleDays + '일</span>';

    sections.push('');
    sections.push(' <b>테마 스토리 · 밸류체인 (기관 리서치 톤)</b>' + _staleBadge);
    if (_snIsStale) {
      sections.push('<span style="color:var(--data-red);font-size:10px;">narrative 작성일부터 ' + _snStaleDays + '일 경과 — 구체 수치(매출·수주·시총·가이던스)는 AI 채팅/웹검색으로 crosscheck 권장</span>');
    }
    if (sn.why) sections.push('<b>왜 지금 HOT한가:</b> ' + sn.why);
    if (sn.valueChain) sections.push('<b>밸류체인 구조:</b> ' + sn.valueChain);
    if (sn.playerRoles && typeof sn.playerRoles === 'object') {
      var rolesHtml = Object.keys(sn.playerRoles).map(function(t) {
        return '&nbsp;&nbsp;<b>' + t + ':</b> ' + sn.playerRoles[t];
      }).join('<br>');
      sections.push('<b>핵심 플레이어 포지션:</b><br>' + rolesHtml);
    }

    // 최근 7일 뉴스 자동 표시 (newsCache 기반)
    if (typeof _getThemeNews === 'function' && st && st.tickers) {
      var recentNews = _getThemeNews(st.tickers, st.name, 5);
      if (recentNews.length > 0) {
        var newsHtml = recentNews.map(function(n) {
          var dt = n.pubDate ? new Date(n.pubDate) : null;
          var dtStr = dt ? (dt.getMonth()+1) + '/' + dt.getDate() : '';
          return '&nbsp;&nbsp;<span style="color:var(--data-cyan);">[' + dtStr + ']</span> ' + (n.title || '').substring(0, 140) + (n.source ? ' <span style="color:var(--text-muted);font-size:11px;">(' + n.source + ')</span>' : '');
        }).join('<br>');
        sections.push('<b>최근 7일 뉴스 (최근 수집, ' + recentNews.length + '건):</b><br>' + newsHtml);
      }
    }
  }

  html += sections.map(function(s) {
    if (!s) return '<hr style="border:none;border-top:1px solid var(--surface-4);margin:6px 0;">';
    return '<div style="font-size:11px;color:var(--text-secondary);line-height:1.7;margin-bottom:4px;">' + s + '</div>';
  }).join('');
  html += '</div>';

  container.innerHTML = html;
  container.style.display = 'block';
  container.dataset.currentSubTheme = subThemeId;

  // 패널로 스크롤
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeSubThemeDetail() {
  var p = document.getElementById('sub-theme-detail-panel');
  if (p) p.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
//  누적 히스토리 수집 (RS 정밀도 향상)
// ═══════════════════════════════════════════════════════════════
function collectPriceHistory() {
  let ld = window._liveData || {};
  Object.keys(ld).forEach(function(sym) {
    var d = ld[sym];
    if (!d || !d.price) return;
    // P721: 일봉 시계열로 수화된 심볼은 틱 push로 오염시키지 않는다(혼합 금지 — R14 계열).
    if (_priceHistoryDaily[sym]) return;
    if (!_priceHistory[sym]) _priceHistory[sym] = [];
    _priceHistory[sym].push(d.price);
    // 최대 100개 유지
    if (_priceHistory[sym].length > 100) _priceHistory[sym].shift();
  });
}

// ── P721: RRG 일봉 종가 수화 ─────────────────────────────────────
// 왜: RRG(calcLiveRS)가 세션 내 30초 틱 누적(_priceHistory, >20 샘플 필요)에 의존해
//     새로 접속한 모든 방문자에게 "판정 보류 · 근거 0/11"로 영구 공백이었다(라이브 실측).
//     방법론적으로도 RRG는 일봉/주봉 종가 기반(13wk MA) 지표다. 기존 검증된 클라 경로
//     (fetchViaProxy + _parseYFChartResponse, fetchSentimentHistory와 동일 패턴)로
//     11섹터+SPY의 실제 6개월 일봉 종가를 받아 채운다. 실패 심볼은 채우지 않는다(추측 금지)
//     — 그 심볼은 기존과 동일하게 판정 보류로 남는다. 서브섹터 뷰는 요청 예산상 이번 범위 밖
//     (기존 틱 경로 유지, 보류 라벨 정직 표시 유지).
var _rrgDailyHydratedAt = 0;
var _rrgDailyHydrating = false;
async function hydrateRRGDailyHistory() {
  if (_rrgDailyHydrating) return;
  if (Date.now() - _rrgDailyHydratedAt < 6 * 3600 * 1000) return; // 6h 내 재수화 불필요(일봉)
  _rrgDailyHydrating = true;
  try {
    // SPY(분모)를 1차 배치에 포함 — SPY 없이는 어떤 섹터도 판정 불가
    var syms = ['SPY'].concat(RRG_SECTORS.map(function(s){ return s.sym; }));
    var okCount = 0;
    var rerender = function() {
      var tp = document.getElementById('page-themes');
      if (!tp || !tp.classList.contains('active')) return;
      try { drawRRG(); } catch(_e) {}
      try { document.dispatchEvent(new CustomEvent('aio:themesViewChanged')); } catch(_e) {}
      try { renderSectorPerfBars(); } catch(_e) {} // 사이클 pill(generateSectorAnalysis) 포함
    };
    // 동시 3개 제한 — 프록시/Yahoo 부하 억제. 배치마다 점진 재렌더(부분 실패에도 확보분은 표시).
    for (var i = 0; i < syms.length; i += 3) {
      var batchOk = 0;
      var batch = syms.slice(i, i + 3).map(async function(sym) {
        try {
          var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=6mo';
          var r = await fetchViaProxy(url, 8000);
          var raw = await r.text();
          if (raw.trimStart().startsWith('<')) return; // HTML 에러페이지 (유령 데이터 방지)
          var data; try { data = JSON.parse(raw); } catch(_e) { return; }
          if (data && data.contents) { try { data = JSON.parse(data.contents); } catch(_e) {} } // allorigins 래퍼
          var parsed = _parseYFChartResponse(data);
          if (parsed && parsed.closes && parsed.closes.length >= 30) {
            _priceHistory[sym] = parsed.closes.slice(-100);
            _priceHistoryDaily[sym] = true;
            okCount++; batchOk++;
          }
        } catch(_e) { /* 해당 심볼만 보류 유지 */ }
      });
      await Promise.all(batch);
      if (batchOk > 0 && _priceHistoryDaily['SPY']) {
        rerender();
        try { document.dispatchEvent(new CustomEvent('aio:themesHistoryLoaded', { detail: { source: 'yahoo-1d', count: okCount } })); } catch(_e) {}
      }
    }
    if (okCount > 0) _rrgDailyHydratedAt = Date.now();
  } finally {
    _rrgDailyHydrating = false;
  }
}
window.hydrateRRGDailyHistory = hydrateRRGDailyHistory;

// ═══════════════════════════════════════════════════════════════
//  세분화 테마 (Sub-Themes) — 시장 핵심 트렌드 & 대장주
// ═══════════════════════════════════════════════════════════════
// 각 세분화 테마: 고유 색상, 대장주(리더), 관련 종목, 커스텀 합산
var SUB_THEMES = [
  // ═══ AI · 반도체 (9) ═══
  {id:'bigtech',name:'빅테크 M7',emoji:'',color:'var(--data-purple)',desc:'시장 시총 38% 메가캡 리더',leaders:['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA'],tickers:['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA'],etf:'QQQ',weights:{AAPL:18,MSFT:17,NVDA:16,AMZN:14,GOOGL:12,META:13,TSLA:10}},
  {id:'ai_chip',name:'AI 반도체/가속기',emoji:'',color:'#211d16',desc:'GPU·ASIC·커스텀 칩 경쟁',leaders:['NVDA','AMD','AVGO','ARM'],tickers:['NVDA','AMD','AVGO','ARM','QCOM','MRVL'],etf:'SMH'},
  {id:'memory',name:'메모리 반도체',emoji:'',color:'#211d16',desc:'HBM·DDR5·NAND SCA 슈퍼사이클 · SK하이닉스/삼성전자는 KRX 보통주(.KS) 기준',leaders:['MU','SNDK','000660.KS','STX'],tickers:['MU','SNDK','000660.KS','005930.KS','STX','WDC'],etf:null,weights:{MU:30,SNDK:25,'000660.KS':12,'005930.KS':8,STX:15,WDC:10}},
  {id:'semi_equip',name:'반도체 장비/EDA',emoji:'',color:'#22754c',desc:'EUV·증착·검사·설계자동화(EDA)',leaders:['ASML','AMAT','LRCX','KLAC'],tickers:['ASML','AMAT','LRCX','KLAC','TER','ONTO','ACLS','ENTG','UCTT','CDNS','SNPS'],etf:null,weights:{ASML:20,AMAT:16,LRCX:14,KLAC:12,CDNS:10,SNPS:10,TER:6,ONTO:4,ENTG:4,ACLS:2,UCTT:2}},
  {id:'foundry',name:'파운드리',emoji:'',color:'var(--text-muted)',desc:'첨단 파운드리(TSM) + 성숙 공정(UMC/GFS) + 종합반도체(INTC Foundry)',leaders:['TSM','INTC','GFS','UMC'],tickers:['TSM','INTC','UMC','GFS'],etf:null,weights:{TSM:44,INTC:22,UMC:18,GFS:16}},
  {id:'photonics',name:'광통신/포토닉스',emoji:'',color:'#8a8271',desc:'AI DC 광인터커넥트 폭증 · 레이저 병목(2025~2027) · 순수 광통신 플레이 (AVGO는 ai_chip 주력)',leaders:['LITE','COHR','CIEN','AAOI'],tickers:['LITE','COHR','CIEN','AAOI','GLW','VIAV','ANET','MRVL','POET','FN'],etf:null},
  {id:'dc_network',name:'DC 네트워킹',emoji:'',color:'#211d16',desc:'DC 초고속 연결·CXL·이더넷 (AVGO는 ai_chip 주력으로 비중 축소)',leaders:['ALAB','CRDO','ANET','CSCO'],tickers:['ALAB','CRDO','ANET','CSCO','MRVL','AVGO'],etf:null,weights:{ALAB:24,CRDO:22,ANET:18,CSCO:18,MRVL:10,AVGO:8}},
  {id:'dc_infra',name:'DC 인프라/전력·냉각',emoji:'',color:'#57513f',desc:'AI DC 전력·냉각·서버 OEM · GPU TDP 700W→2300W · 800V DC 전환 (EQIX/DLR은 reit_dc)',leaders:['VRT','ETN','PWR','EME'],tickers:['VRT','ETN','PWR','EME','POWL','CLS','DELL','HPE','MOD','NVT','SMCI'],etf:null},
  {id:'neocloud',name:'네오클라우드/AI호스팅',emoji:'',color:'#211d16',desc:'GPU 클라우드·채굴→AI 전환',leaders:['CRWV','IREN','CORZ','NBIS','WULF'],tickers:['CRWV','IREN','CORZ','NBIS','WULF','CIFR','CLSK','MARA'],etf:null,weights:{CRWV:24,IREN:18,CORZ:15,NBIS:14,WULF:10,CIFR:8,CLSK:6,MARA:5}},
  // ═══ SW · 클라우드 (3) ═══
  {id:'cloud_saas',name:'클라우드/SaaS',emoji:'',color:'#b13a30',desc:'엔터프라이즈 SaaS·디지털 전환',leaders:['CRM','NOW','ADBE','ORCL'],tickers:['CRM','NOW','ADBE','ORCL','INTU','WDAY','SNOW','DDOG','MDB'],etf:'IGV',weights:{CRM:16,NOW:14,ADBE:13,ORCL:12,INTU:10,WDAY:10,SNOW:9,DDOG:8,MDB:8}},
  {id:'ai_platform',name:'AI 플랫폼/에이전트',emoji:'',color:'var(--data-purple)',desc:'AI 플랫폼·에이전트·MLOps (C3.ai/PATH는 실적 부진으로 비중 축소)',leaders:['PLTR','DDOG','SNOW','TTD'],tickers:['PLTR','DDOG','SNOW','TTD','MDB','PATH','AI'],etf:null,weights:{PLTR:30,DDOG:18,SNOW:16,TTD:12,MDB:12,PATH:6,AI:6}},
  {id:'cybersec',name:'사이버보안',emoji:'',color:'var(--data-red)',desc:'AI 위협·제로트러스트 확산',leaders:['PANW','CRWD','ZS','FTNT'],tickers:['PANW','CRWD','ZS','FTNT','NET','S','RBRK'],etf:'HACK'},
  // ═══ 에너지 (7) ═══
  {id:'oil_major',name:'에너지 메이저/E&P',emoji:'',color:'var(--data-green)',desc:'통합 석유 메이저 + E&P 탐사생산 (정유는 oil_refine 분리)',leaders:['XOM','CVX','COP','EOG'],tickers:['XOM','CVX','COP','EOG','OXY','DVN','FANG','TPL','SHEL'],etf:'XLE'},
  {id:'oil_refine',name:'정유/다운스트림',emoji:'',color:'#8a8271',desc:'정유 마진·크랙 스프레드·유가 하락 수혜',leaders:['VLO','MPC','PSX'],tickers:['VLO','MPC','PSX','DINO','DK'],etf:'CRAK',weights:{VLO:38,MPC:30,PSX:22,DINO:6,DK:4}},
  {id:'oil_service',name:'오일서비스/시추',emoji:'',color:'#b13a30',desc:'시추·유정 서비스·장비',leaders:['SLB','HAL','BKR','FTI'],tickers:['SLB','HAL','BKR','FTI','NOV','WHD'],etf:'OIH',weights:{SLB:30,BKR:22,HAL:20,FTI:12,NOV:10,WHD:6}},
  {id:'mlp_pipe',name:'미드스트림/파이프라인',emoji:'',color:'#8a8271',desc:'에너지 운송·미드스트림 사업. 법적 MLP와 일반 법인이 함께 있으며 배당·과세 구조는 종목별로 다릅니다.',leaders:['WMB','TRGP','ET','KMI'],tickers:['WMB','TRGP','ET','KMI','EPD','OKE','ENB'],etf:'AMLP'},
  {id:'nuclear_util',name:'원전/원자력',emoji:'',color:'#22754c',desc:'AI 전력 수요·SMR·원전 부활 (NRG는 원전 비중 낮아 축소, NNE 추가)',leaders:['CEG','VST','CCJ','GEV','SMR'],tickers:['CEG','VST','NRG','CCJ','GEV','LEU','SMR','OKLO','BWXT','NNE'],etf:'URA',weights:{CCJ:16,CEG:15,GEV:15,VST:12,BWXT:9,LEU:8,SMR:8,OKLO:7,NRG:5,NNE:5}},
  {id:'solar_renew',name:'태양광/재생에너지',emoji:'',color:'var(--data-amber)',desc:'태양광·트래커·인버터 · IRA 개편 리스크 주의 (NEE는 grid_util)',leaders:['FSLR','ENPH','NXT'],tickers:['FSLR','ENPH','NXT','ARRY','SHLS','RUN','SEDG'],etf:'ICLN',weights:{FSLR:30,ENPH:28,NXT:18,ARRY:10,SHLS:6,RUN:5,SEDG:3}},
  {id:'hydrogen_ess',name:'수소/ESS',emoji:'',color:'#211d16',desc:'그린수소·연료전지·ESS (PLUG/FCEL 재무 위기 — leader 제외)',leaders:['FLNC','BE'],tickers:['FLNC','BE','PLUG','FCEL'],etf:null,weights:{FLNC:45,BE:30,PLUG:15,FCEL:10}},
  {id:'grid_util',name:'전력 유틸리티',emoji:'',color:'var(--data-cyan)',desc:'유틸리티·송배전·그리드 현대화',leaders:['NEE','DUK','AEP','EXC'],tickers:['NEE','DUK','AEP','EXC','ETR','ES','FE','EVRG','XEL','EIX'],etf:'XLU',weights:{NEE:18,DUK:14,AEP:12,EXC:11,ETR:9,ES:8,FE:8,EVRG:7,XEL:7,EIX:6}},
  // ═══ 금융 (5) ═══
  {id:'big_bank',name:'대형 은행',emoji:'',color:'var(--data-amber)',desc:'미국 6대 은행·금리 수혜',leaders:['JPM','GS','MS','BAC'],tickers:['JPM','GS','MS','BAC','WFC','C'],etf:'XLF',weights:{JPM:26,BAC:18,WFC:15,GS:15,MS:14,C:12}},
  {id:'asset_mgmt',name:'자산운용/PE',emoji:'',color:'#8a8271',desc:'대체투자·PE·자산운용',leaders:['BX','KKR','APO','BLK'],tickers:['BX','KKR','APO','BLK','SCHW'],etf:null,weights:{BLK:24,BX:20,KKR:20,APO:18,SCHW:18}},
  {id:'insurance',name:'보험',emoji:'',color:'#8a8271',desc:'손보·생보·재보험·금리 수혜',leaders:['BRK-B','PGR','ALL','MET'],tickers:['BRK-B','PGR','ALL','MET','TRV','CB'],etf:null,weights:{'BRK-B':28,PGR:18,TRV:14,CB:14,ALL:14,MET:12}},
  {id:'fintech_crypto',name:'핀테크/크립토',emoji:'',color:'var(--data-amber)',desc:'디지털 결제·거래소·스테이블코인 (마이닝주는 btc_etf 참조)',leaders:['COIN','HOOD','PYPL','XYZ'],tickers:['COIN','XYZ','PYPL','AFRM','SOFI','HOOD','MSTR','NU'],etf:null,weights:{COIN:18,PYPL:15,XYZ:13,HOOD:13,SOFI:12,NU:10,MSTR:10,AFRM:9},compositeBase:'BTC-USD'},
  {id:'btc_etf',name:'BTC 현물·선물 ETF',emoji:'',color:'var(--data-amber)',desc:'비트코인 ETF: IBIT·FBTC·ARKB·BITB·HODL은 현물, BITO는 선물·스왑 노출이며 비트코인을 직접 보유하지 않습니다.',leaders:['IBIT','FBTC','ARKB'],tickers:['IBIT','FBTC','ARKB','BITB','BITO','HODL'],etf:null,weights:{IBIT:40,FBTC:25,ARKB:12,BITB:10,BITO:8,HODL:5},compositeBase:'BTC-USD'},
  // ═══ 헬스케어 (4) ═══
  {id:'pharma',name:'대형 제약',emoji:'',color:'#211d16',desc:'블록버스터 신약·고배당',leaders:['LLY','JNJ','MRK','ABBV'],tickers:['LLY','JNJ','MRK','ABBV','PFE','BMY','AZN'],etf:'XLV',weights:{LLY:24,JNJ:16,MRK:14,ABBV:14,PFE:12,BMY:10,AZN:10}},
  {id:'biotech',name:'바이오텍',emoji:'',color:'var(--data-purple)',desc:'유전자치료·항체·RNAi·유전자편집 (MRNA/BIIB는 실적 부진으로 비중 축소)',leaders:['VRTX','REGN','AMGN','GILD'],tickers:['VRTX','REGN','AMGN','GILD','ALNY','CRSP','MRNA','BIIB'],etf:'XBI',weights:{VRTX:22,REGN:20,AMGN:16,GILD:16,ALNY:10,CRSP:4,MRNA:6,BIIB:6}},
  {id:'glp1',name:'GLP-1/비만치료',emoji:'',color:'#22754c',desc:'GLP-1 작용제 시장 폭발 성장',leaders:['LLY','NVO','AMGN'],tickers:['LLY','NVO','AMGN','VKTX','AZN','PFE'],etf:null,weights:{LLY:35,NVO:28,AMGN:12,VKTX:10,AZN:8,PFE:7}},
  {id:'medtech',name:'의료기기/서비스',emoji:'',color:'#8a8271',desc:'수술로봇·진단·의료 혁신',leaders:['ABT','ISRG','BSX','SYK'],tickers:['ABT','ISRG','BSX','SYK','MDT','EW','GEHC'],etf:null,weights:{ABT:20,ISRG:18,BSX:15,SYK:14,MDT:12,EW:11,GEHC:10}},
  // ═══ 산업 · 방산 (5) ═══
  {id:'defense',name:'방산/국방',emoji:'',color:'#22754c',desc:'지정학 긴장·국방비 증가 · 드론/무인기 신흥주 포함 (PLTR은 SW로 분리)',leaders:['RTX','LMT','GD','GE','AXON'],tickers:['RTX','LMT','GD','GE','NOC','LHX','HWM','HII','LDOS','AXON','KTOS','AVAV'],etf:'ITA',weights:{RTX:20,LMT:14,GD:12,GE:10,NOC:10,LHX:7,HWM:5,HII:4,LDOS:3,AXON:7,KTOS:5,AVAV:3}},
  {id:'space',name:'우주/항공',emoji:'',color:'#211d16',desc:'우주 인터넷·발사체·위성 (순수 우주주 중심, FLR 제외)',leaders:['RKLB','ASTS','LUNR','IRDM'],tickers:['RKLB','ASTS','LUNR','IRDM','PL','RDW','BA','LMT'],etf:null,weights:{RKLB:24,ASTS:20,LUNR:14,IRDM:12,PL:10,RDW:8,BA:8,LMT:4}},
  {id:'industrial',name:'산업재/건설장비',emoji:'',color:'var(--data-cyan)',desc:'건설 중장비·물류·인프라',leaders:['CAT','DE','HON','UNP'],tickers:['CAT','DE','HON','UNP','FDX','UPS','WAB','PH','EMR'],etf:'XLI',weights:{CAT:16,DE:14,HON:14,UNP:12,FDX:12,UPS:10,PH:8,EMR:8,WAB:6}},
  {id:'robotics_auto',name:'로보틱스/자동화',emoji:'',color:'#211d16',desc:'AI 로봇·산업자동화·물류자동화 (TSLA Optimus는 ev_auto·bigtech 참조)',leaders:['ISRG','ROK','TER','SYM'],tickers:['ISRG','ROK','TER','SYM','EMR','FANUY'],etf:'BOTZ',weights:{ISRG:28,ROK:22,TER:18,SYM:14,EMR:10,FANUY:8}},
  {id:'quantum',name:'양자컴퓨팅',emoji:'',color:'#8a8271',desc:'양자우위·오류보정 진전 · 순수 양자주 중심 (MSFT/GOOGL은 bigtech 주력)',leaders:['IONQ','QBTS','RGTI','IBM'],tickers:['IONQ','RGTI','QUBT','QBTS','GOOGL','IBM','MSFT'],etf:null,weights:{IONQ:26,QBTS:18,RGTI:20,IBM:18,GOOGL:8,MSFT:6,QUBT:4}},
  // ═══ 소비 · 유통 (5) ═══
  {id:'ecommerce',name:'이커머스/리테일',emoji:'',color:'#57513f',desc:'온라인 쇼핑·옴니채널',leaders:['AMZN','SHOP','WMT','COST'],tickers:['AMZN','WMT','COST','SHOP','CPNG','TGT','EBAY'],etf:null,weights:{AMZN:34,WMT:16,COST:12,SHOP:12,CPNG:10,TGT:8,EBAY:8}},
  {id:'consumer_brand',name:'소비재 브랜드',emoji:'',color:'#211d16',desc:'필수(PG/KO/PEP) + 임의(NKE/LULU/SBUX/MCD) 혼합 (단일 ETF 미매칭)',leaders:['PG','KO','MCD','NKE'],tickers:['NKE','LULU','SBUX','MCD','KO','PEP','PG','MNST','DG'],etf:null,weights:{PG:16,KO:14,PEP:14,MCD:12,NKE:12,SBUX:10,LULU:8,MNST:8,DG:6}},
  {id:'ev_auto',name:'EV/자율주행',emoji:'',color:'#211d16',desc:'전기차·자율주행·SDV · MBLY(Mobileye)·LCID(Lucid) 반영 · ETF 교체(LIT→DRIV)',leaders:['TSLA','RIVN','GM','MBLY'],tickers:['TSLA','RIVN','GM','F','LCID','MBLY','APTV','ON'],etf:'DRIV',weights:{TSLA:30,GM:17,F:12,RIVN:10,MBLY:10,LCID:5,APTV:8,ON:8}},
  {id:'travel',name:'여행/레저/항공',emoji:'',color:'#211d16',desc:'여행 수요·호텔·항공',leaders:['BKNG','ABNB','DAL','MAR'],tickers:['BKNG','ABNB','MAR','HLT','DAL','UAL','LUV','CCL','RCL'],etf:'JETS',weights:{BKNG:18,MAR:14,HLT:14,ABNB:12,DAL:12,UAL:10,RCL:8,CCL:7,LUV:5}},
  {id:'delivery',name:'플랫폼/딜리버리',emoji:'',color:'#211d16',desc:'라이드셰어·음식배달 (CPNG는 ecommerce 주력, LYFT 추가)',leaders:['UBER','DASH','LYFT'],tickers:['UBER','DASH','LYFT','SE','GRAB','TOST','CPNG'],etf:null,weights:{UBER:35,DASH:25,LYFT:10,SE:10,GRAB:8,TOST:7,CPNG:5}},
  // ═══ 미디어 · 통신 (4) ═══
  {id:'streaming',name:'스트리밍/미디어',emoji:'',color:'#211d16',desc:'OTT·콘텐츠 전쟁 · Skydance(WBD 인수 완료)',leaders:['NFLX','DIS','SPOT','SKYD'],tickers:['NFLX','DIS','SPOT','ROKU','SKYD'],etf:null,weights:{NFLX:40,DIS:22,SPOT:16,ROKU:10,SKYD:12}},
  {id:'social_ad',name:'소셜/디지털광고',emoji:'',color:'#b13a30',desc:'소셜미디어·디지털광고',leaders:['META','GOOGL','TTD','APP'],tickers:['META','GOOGL','TTD','APP','SNAP','PINS','RDDT'],etf:null,weights:{META:30,GOOGL:28,TTD:12,APP:10,SNAP:8,PINS:6,RDDT:6}},
  {id:'gaming',name:'게이밍/e스포츠',emoji:'',color:'#211d16',desc:'AAA 게임·e스포츠·메타버스 (스포츠 베팅은 sports_betting 분리)',leaders:['TTWO','RBLX','NTDOY'],tickers:['TTWO','RBLX','NTDOY'],etf:null,weights:{TTWO:40,RBLX:36,NTDOY:24}},
  {id:'sports_betting',name:'스포츠 베팅/카지노',emoji:'',color:'#b13a30',desc:'온라인 스포츠 베팅·iGaming·카지노 리오프닝',leaders:['DKNG','FLUT','MGM'],tickers:['DKNG','FLUT','MGM','PENN','CZR','WYNN'],etf:null,weights:{DKNG:30,FLUT:25,MGM:15,PENN:10,CZR:10,WYNN:10}},
  {id:'telecom_us',name:'미국 통신',emoji:'',color:'var(--text-muted)',desc:'5G·광대역·ARPU · 무선통신 3사 (XLC는 META/GOOGL ETF라 IYZ로 교체)',leaders:['T','VZ','TMUS'],tickers:['T','VZ','TMUS'],etf:'IYZ',weights:{TMUS:38,T:30,VZ:32}},
  // ═══ 부동산 · 원자재 (3) ═══
  {id:'reit_dc',name:'디지털 인프라 리츠',emoji:'',color:'#211d16',desc:'DC 리츠(EQIX/DLR) + 통신타워 리츠(AMT/CCI/SBAC) · AI 인프라 임대',leaders:['EQIX','DLR','AMT'],tickers:['EQIX','DLR','AMT','CCI','SBAC'],etf:'XLRE',weights:{EQIX:28,DLR:22,AMT:20,CCI:16,SBAC:14}},
  {id:'gold_mining',name:'금/은 광산',emoji:'',color:'#8a8271',desc:'금값 사상최고·인플레 헷지',leaders:['AEM','NEM','B','WPM'],tickers:['AEM','NEM','B','WPM','FNV','GFI','KGC'],etf:'GDX',weights:{AEM:18,NEM:16,B:16,WPM:14,FNV:14,GFI:12,KGC:10}},
  {id:'materials',name:'원자재/광업',emoji:'',color:'#22754c',desc:'구리·리튬·전략 광물',leaders:['FCX','LIN','APD','MP'],tickers:['FCX','LIN','APD','AA','MP','LAC','ALB','CTVA','ADM'],etf:'XLB',weights:{LIN:18,APD:14,FCX:14,CTVA:12,ADM:10,ALB:10,AA:8,MP:8,LAC:6}}
];

// 세분화 테마 인덱스
var SUB_THEME_INDEX = {};
SUB_THEMES.forEach(function(st, i) { SUB_THEME_INDEX[st.id] = i; });

// ═══════════════════════════════════════════════════════════════
// 한국 22개 세분화 테마 DB (미국 SUB_THEMES와 동일 구조 — leaders/tickers/weights/etf)
// 각 테마 weights 합계 = 100 (가중평균 계산용)
// ═══════════════════════════════════════════════════════════════
var KR_SUB_THEMES = [
  // ═══ HOT 그룹 (4) ═══
  {id:'kr_semi_hbm',name:'반도체/HBM',emoji:'',color:'#211d16',desc:'HBM3E·HBM4 · NAND SCA 수혜 · 삼성/하이닉스 양강 (KOSPI .KS + KOSDAQ .KQ 정식)',leaders:['005930.KS','000660.KS','042700.KS'],tickers:['005930.KS','000660.KS','042700.KS','403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ'],etf:'091160.KS',weights:{'005930.KS':30,'000660.KS':30,'042700.KS':12,'403870.KQ':8,'058470.KQ':6,'357780.KQ':6,'240810.KQ':4,'039030.KQ':4}},
  {id:'kr_robotics',name:'로봇/자동화',emoji:'',color:'#211d16',desc:'휴머노이드·산업 자동화·서빙로봇 · 두산로보틱스(KOSPI) + KOSDAQ 로봇 부품/플랫폼',leaders:['454910.KS','277810.KQ','108490.KQ'],tickers:['454910.KS','277810.KQ','108490.KQ','090360.KQ','388720.KQ','090710.KQ'],etf:null,weights:{'454910.KS':34,'277810.KQ':28,'108490.KQ':14,'090360.KQ':10,'388720.KQ':8,'090710.KQ':6}},
  {id:'kr_ai_sw',name:'AI/소프트웨어',emoji:'',color:'var(--data-purple)',desc:'HyperCLOVA X · AI 에이전트 · SaaS',leaders:['035420.KS','018260.KS','035720.KS'],tickers:['035420.KS','018260.KS','035720.KS','030520.KQ','304100.KQ'],etf:null,weights:{'035420.KS':32,'018260.KS':24,'035720.KS':22,'030520.KQ':12,'304100.KQ':10}},
  {id:'kr_medtech',name:'의료기기/AI진단',emoji:'',color:'#8a8271',desc:'수술로봇·AI 영상진단·K-의료기기 (대부분 KOSDAQ)',leaders:['214150.KQ','328130.KQ','338220.KQ'],tickers:['214150.KQ','328130.KQ','338220.KQ','322510.KQ','049950.KQ','145720.KQ'],etf:null,weights:{'214150.KQ':28,'328130.KQ':24,'338220.KQ':18,'322510.KQ':12,'049950.KQ':10,'145720.KQ':8}},
  // ═══ 강세 그룹 (5) ═══
  {id:'kr_shipbuild',name:'조선/해양',emoji:'',color:'#211d16',desc:'LNG선·암모니아선 · 선가 상승 사이클',leaders:['009540.KS','010140.KS','329180.KS'],tickers:['009540.KS','010140.KS','329180.KS','042660.KS'],etf:null,weights:{'009540.KS':28,'329180.KS':25,'010140.KS':22,'042660.KS':25}},
  {id:'kr_power_eq',name:'전력기기/변압기',emoji:'',color:'#57513f',desc:'AI DC 전력 수요 · 미국 그리드 교체 · 2024~25 한국장 주도',leaders:['298040.KS','267260.KS','010120.KS'],tickers:['298040.KS','267260.KS','010120.KS','062040.KS','033100.KQ','103590.KS'],etf:null,weights:{'298040.KS':26,'267260.KS':22,'010120.KS':20,'062040.KS':14,'033100.KQ':10,'103590.KS':8}},
  {id:'kr_nuclear',name:'원전/SMR',emoji:'',color:'#22754c',desc:'체코·폴란드 수주 · 미국 SMR 법안 · AI 전력 · 시공/정비 밸류체인 포함',leaders:['034020.KS','052690.KS','000720.KS'],tickers:['034020.KS','052690.KS','000720.KS','051600.KS','006910.KQ','032820.KQ','083650.KQ'],etf:null,weights:{'034020.KS':32,'052690.KS':20,'000720.KS':16,'051600.KS':12,'006910.KQ':8,'032820.KQ':7,'083650.KQ':5}},
  {id:'kr_kbeauty',name:'K-뷰티',emoji:'',color:'#211d16',desc:'미국·일본·인도 확장 · 인디브랜드 수출 폭증 · 에이피알(APR)·실리콘투 신흥 대장',leaders:['278470.KS','257720.KQ','090430.KS'],tickers:['278470.KS','257720.KQ','090430.KS','192820.KS','051900.KS','237880.KQ'],etf:null,weights:{'278470.KS':28,'257720.KQ':22,'090430.KS':18,'192820.KS':14,'051900.KS':10,'237880.KQ':8}},
  {id:'kr_kfood',name:'K-푸드',emoji:'',color:'var(--data-amber)',desc:'수출액 역대 최고 · 불닭·라면 글로벌 · 4사 라면 경쟁',leaders:['003230.KS','097950.KS','271560.KS','004370.KS'],tickers:['003230.KS','097950.KS','271560.KS','004370.KS','280360.KS'],etf:null,weights:{'003230.KS':33,'097950.KS':22,'271560.KS':18,'004370.KS':10,'280360.KS':17}},
  // ═══ 중립→개선 (3) ═══
  {id:'kr_finance',name:'금융/밸류업',emoji:'',color:'var(--data-amber)',desc:'PBR 0.5x · 밸류업 프로그램 · 자사주 소각 · 지주+보험+증권',leaders:['105560.KS','055550.KS','086790.KS'],tickers:['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','006800.KS'],etf:null,weights:{'105560.KS':22,'055550.KS':20,'086790.KS':16,'316140.KS':13,'138040.KS':13,'032830.KS':10,'006800.KS':6}},
  {id:'kr_auto',name:'자동차/SDV',emoji:'',color:'#211d16',desc:'현대차·기아 SDV 전환 · 완성차+부품',leaders:['005380.KS','000270.KS','012330.KS'],tickers:['005380.KS','000270.KS','012330.KS','204320.KS','161390.KS'],etf:null,weights:{'005380.KS':32,'000270.KS':28,'012330.KS':22,'204320.KS':10,'161390.KS':8}},
  {id:'kr_bio',name:'바이오/제약',emoji:'',color:'#211d16',desc:'CDMO · GLP-1 · 세노바메이트 미국 성장 · 삼성바이오로직스 + 알테오젠/리가켐(KOSDAQ)',leaders:['207940.KS','068270.KS','000100.KS','326030.KS'],tickers:['207940.KS','068270.KS','000100.KS','326030.KS','128940.KS','196170.KQ','141080.KQ'],etf:null,weights:{'207940.KS':30,'068270.KS':22,'000100.KS':15,'326030.KS':10,'128940.KS':10,'196170.KQ':8,'141080.KQ':5}},
  // ═══ 조정/약세 (4) ═══
  {id:'kr_defense',name:'방산/항공우주',emoji:'',color:'#22754c',desc:'K-방산 글로벌 수출 · 이란 재협상 프리미엄 축소',leaders:['012450.KS','047810.KS','272210.KS'],tickers:['012450.KS','047810.KS','272210.KS','079550.KS','064350.KS','103140.KS'],etf:null,weights:{'012450.KS':32,'047810.KS':22,'079550.KS':18,'272210.KS':12,'064350.KS':10,'103140.KS':6}},
  {id:'kr_energy',name:'에너지/정유',emoji:'',color:'var(--data-green)',desc:'유가 변동성 · 정유 마진 (이란 재협상 리스크)',leaders:['010950.KS','096770.KS','078930.KS'],tickers:['010950.KS','096770.KS','078930.KS','024060.KQ'],etf:null,weights:{'010950.KS':40,'096770.KS':30,'078930.KS':20,'024060.KQ':10}},
  {id:'kr_battery',name:'2차전지',emoji:'',color:'#211d16',desc:'EV 둔화 + CATL 경쟁 · 셀 3사 + 양극재 4사',leaders:['373220.KS','006400.KS','051910.KS'],tickers:['373220.KS','006400.KS','051910.KS','005490.KS','247540.KQ','066970.KS','086520.KQ','003670.KS'],etf:null,weights:{'373220.KS':25,'006400.KS':18,'051910.KS':15,'005490.KS':12,'247540.KQ':12,'066970.KS':6,'086520.KQ':6,'003670.KS':6}},
  {id:'kr_content',name:'K-엔터/콘텐츠',emoji:'',color:'#211d16',desc:'아이돌 피로감 · 스튜디오 실적 부진 · 하이브(KOSPI) + 엔터 4사(KOSDAQ)',leaders:['352820.KS','041510.KQ','035900.KQ'],tickers:['352820.KS','041510.KQ','035900.KQ','122870.KQ','035760.KQ','253450.KQ'],etf:null,weights:{'352820.KS':30,'041510.KQ':20,'035900.KQ':18,'035760.KQ':15,'253450.KQ':10,'122870.KQ':7}},
  // ═══ 추가 테마 (6) ═══
  {id:'kr_gaming',name:'게임',emoji:'',color:'#211d16',desc:'PUBG·MMORPG·서브컬처 · 크래프톤/엔씨/넷마블(KOSPI) + 카겜/펄어비스/위메이드(KOSDAQ)',leaders:['259960.KS','036570.KS','251270.KS'],tickers:['259960.KS','036570.KS','251270.KS','293490.KQ','263750.KQ','112040.KQ'],etf:null,weights:{'259960.KS':35,'036570.KS':20,'251270.KS':15,'293490.KQ':12,'263750.KQ':10,'112040.KQ':8}},
  {id:'kr_semi_equip',name:'반도체 소부장',emoji:'',color:'#22754c',desc:'장비·부품·소재 · HBM 수혜 · 전원 KOSDAQ',leaders:['403870.KQ','058470.KQ','357780.KQ'],tickers:['403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ','272290.KQ'],etf:null,weights:{'403870.KQ':22,'058470.KQ':20,'357780.KQ':18,'240810.KQ':15,'039030.KQ':15,'272290.KQ':10}},
  {id:'kr_drone',name:'드론/무인기·UAM',emoji:'',color:'#211d16',desc:'군용 드론·미사일 유도·무인기 (방산 테마와 일부 중첩)',leaders:['079550.KS','047810.KS','010820.KS'],tickers:['079550.KS','047810.KS','272210.KS','010820.KS','064350.KS'],etf:null,weights:{'079550.KS':40,'047810.KS':25,'272210.KS':15,'010820.KS':12,'064350.KS':8}},
  {id:'kr_reit',name:'리츠/부동산',emoji:'',color:'#211d16',desc:'상장 리츠 · 물류/오피스/리테일 · 5개 주요 리츠',leaders:['293940.KS','357430.KS','365550.KS'],tickers:['293940.KS','357430.KS','365550.KS','330590.KS','448730.KS'],etf:null,weights:{'293940.KS':32,'357430.KS':22,'365550.KS':14,'330590.KS':18,'448730.KS':14}},
  {id:'kr_construction',name:'건설/인프라',emoji:'',color:'var(--text-muted)',desc:'해외 플랜트·인프라 투자',leaders:['000720.KS','375500.KS','028260.KS'],tickers:['000720.KS','375500.KS','028260.KS','006360.KS','047040.KS'],etf:null,weights:{'000720.KS':30,'375500.KS':22,'028260.KS':20,'006360.KS':15,'047040.KS':13}},
  {id:'kr_travel',name:'여행/항공',emoji:'',color:'#211d16',desc:'항공·호텔·여행 플랫폼 (020560 아시아나 합병폐지 제외)',leaders:['003490.KS','008770.KS','089590.KS'],tickers:['003490.KS','008770.KS','089590.KS','272450.KS','039130.KS'],etf:null,weights:{'003490.KS':32,'008770.KS':25,'089590.KS':18,'272450.KS':15,'039130.KS':10}}
];

var KR_SUB_THEME_INDEX = {};
KR_SUB_THEMES.forEach(function(st, i) { KR_SUB_THEME_INDEX[st.id] = i; });

// KR_SUB_THEMES kr_* ID ↔ KR_THEME_INSIGHTS short ID 매핑
// (KR_THEME_INSIGHTS는 기존 UI themeId 체계 유지, 신규 kr_* 체계와 연결하는 브릿지)
var KR_INSIGHT_MAP = {
  'kr_semi_hbm':'semi', 'kr_semi_equip':'semi', 'kr_robotics':'robot',
  'kr_ai_sw':'ai-sw', 'kr_medtech':'medtech_kr', 'kr_shipbuild':'shipbuilding',
  'kr_power_eq':'power-grid', 'kr_nuclear':'nuclear', 'kr_kbeauty':'kbeauty',
  'kr_kfood':'kfood', 'kr_finance':'finance', 'kr_auto':'auto',
  'kr_bio':'bio', 'kr_defense':'defense', 'kr_energy':'energy_kr',
  'kr_battery':'battery', 'kr_content':'kcontent', 'kr_gaming':'gaming',
  'kr_drone':'drone', 'kr_reit':'reit', 'kr_construction':'construction',
  'kr_travel':'travel'
};

// ═══════════════════════════════════════════════════════════════
//  v38.3: 테마별 맞춤 인사이트 데이터 (레퍼런스 기반)
// ═══════════════════════════════════════════════════════════════
var THEME_INSIGHTS = Object.freeze({});
var SUB_THEME_INSIGHTS = Object.freeze({});

var THEME_NARRATIVES_META = Object.freeze({ status:'unavailable', reason:'정적 기업·산업 수치 제거 — 시세·뉴스 증거만 허용' });
var THEME_NARRATIVES = Object.freeze({});
// ═══════════════════════════════════════════════════════════════
// 한국 22개 테마 구조적 내러티브 (why / valueChain / playerRoles)
// kr-theme 상세 페이지 + Top 3 한국 핫테마 AI 프롬프트 주입용
// 한국 테마 역시 검증된 시세·뉴스 증거가 없으면 제공하지 않는다.
// ═══════════════════════════════════════════════════════════════
var KR_THEME_NARRATIVES_META = Object.freeze({ status:'unavailable', reason:'정적 한국 테마 수치 제거 — 시세·뉴스 증거만 허용' });
var KR_THEME_NARRATIVES = Object.freeze({});
var _subThemeRetries = 0;
function renderSubThemesGrid() {
  let ld = window._liveData || {};
  if (Object.keys(ld).length < 5) {
    _subThemeRetries++;
    if (_subThemeRetries < 60) { // v46.6: 최대 30초 대기
      setTimeout(renderSubThemesGrid, 500);
      return;
    }
    _aioLog('warn', 'render', '세분화 테마: 라이브 데이터 30초 초과 — 정적 데이터로 렌더');
  }
  var container = document.getElementById('sub-themes-grid');
  if (!container) return;
  ld = window._liveData || {}; // v46.9: 중복 var 제거, 최신 참조 갱신

  // 각 서브테마 퍼포먼스 계산 후 정렬
  var items = SUB_THEMES.map(function(st) {
    var perf;
    if (st.etf && ld[st.etf]) {
      perf = { chgPct: (ld[st.etf].pct != null ? ld[st.etf].pct : 0), source: st.etf };
    } else if (st.compositeBase && ld[st.compositeBase]) {
      perf = { chgPct: (ld[st.compositeBase].pct != null ? ld[st.compositeBase].pct : 0), source: st.compositeBase };
    } else {
      // v36.4: weights 있으면 ETF 추종 가중평균 사용
      var comp = calcCompositePerf(st.tickers, st.weights);
      perf = { chgPct: comp.chgPct, source: st.weights ? '설정가중(참고 ' + comp.count + ')' : '합산(' + comp.count + ')' };
    }
    return { theme: st, perf: perf };
  });

  // 퍼포먼스 순 정렬
  items.sort(function(a,b) { return b.perf.chgPct - a.perf.chgPct; });

  // If no items, show placeholder
  if (items.length === 0) {
    container.innerHTML = '<div style="grid-column:span 4;text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">서브테마 데이터 준비 중…</div>';
    return;
  }

  var html = '';
  items.forEach(function(item) {
    var st = item.theme;
    var chg = Number(item && item.perf ? item.perf.chgPct : 0);
    if (!isFinite(chg)) chg = 0;
    var isPos = chg >= 0;
    var chgColor = isPos ? 'var(--data-green)' : 'var(--data-red)';
    var bgAlpha = Math.min(Math.abs(chg) * 6, 20);
    var bgColor = isPos ? 'rgba(34,117,76,' + (bgAlpha/100) + ')' : 'rgba(177,58,48,' + (bgAlpha/100) + ')';

    // v39.2: 테마 모멘텀 지표 — 참여폭(breadth) + 상대강도 신호
    var thUp = 0, thDown = 0, thTotal = 0;
    st.tickers.forEach(function(t) { var d = ld[t]; if (d && d.pct != null) { thTotal++; if (d.pct > 0) thUp++; else thDown++; } });
    var breadthPct = thTotal > 0 ? Math.round(thUp / thTotal * 100) : 0;
    var spyChg = ld['SPY'] && ld['SPY'].pct != null ? ld['SPY'].pct : 0;
    var rsVsSpy = chg - spyChg; // 테마 상대강도 vs SPY
    var momSignal = breadthPct >= 70 && rsVsSpy > 0 ? '강세' : breadthPct >= 50 && rsVsSpy > -0.5 ? '↑양호' : breadthPct < 30 ? '약세' : '→중립';
    var momColor = momSignal.indexOf('강세') >= 0 ? 'var(--data-green)' : momSignal.indexOf('양호') >= 0 ? 'var(--data-cyan)' : momSignal.indexOf('약세') >= 0 ? 'var(--data-red)' : 'var(--data-amber)';

    // 대장주 (최대 3개, 콤팩트) — v38.3: 데이터 없는 종목 "—" 표시
    var leadersHtml = '';
    var sl = st.leaders.slice(0, 3);
    sl.forEach(function(t) {
      var d = ld[t];
      var hasData = d && d.price != null && d.pct != null;
      var tc = hasData ? d.pct : null;
      var tcol = tc === null ? 'var(--text-muted)' : (tc >= 0 ? 'var(--data-green)' : 'var(--data-red)');
      var tcStr = tc === null ? '—' : ((tc >= 0 ? '+' : '') + tc.toFixed(1) + '%');
      leadersHtml += '<div data-action="showTicker" data-arg="'+t+'" data-stop="1" style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--surface-2);cursor:pointer;" title="'+t+' 분석 →">' +
        '<span style="font-size:11px;font-weight:800;font-family:var(--font-mono);color:var(--accent);">' + t + ' <span style="font-size:10px;opacity:0.5;">↗</span></span>' +
        '<span style="font-size:10px;font-weight:700;font-family:var(--font-mono);color:' + tcol + ';">' + tcStr + '</span></div>';
    });
    if (st.leaders.length > 3) leadersHtml += '<div style="font-size:11px;color:var(--text-muted);padding-top:1px;">+' + (st.leaders.length - 3) + '개 더</div>';

    var barMax = 5; var barW = Math.min(Math.abs(chg) / barMax * 100, 100);

    // v38.3: onclick 핸들러 추가 — 세분화 테마 클릭 시 심층 분석
    html += '<div class="aio-hover-scale-subtle" style="background:' + bgColor + ';border:1px solid rgba(var(--ink-rgb),0.06);border-radius:4px;padding:10px;transition:transform var(--dur-fast),border-color var(--dur-fast);cursor:pointer;--hover-border-color:' + st.color + '50;" data-action="showSubThemeDetail" data-arg="' + escHtml(st.id) + '">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
        '<div style="display:flex;align-items:center;gap:4px;"><span style="font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">' + st.name + '</span></div>' +
        '<span style="font-size:12px;font-weight:900;font-family:var(--font-mono);color:' + chgColor + ';">' + (isPos ? '+' : '') + chg.toFixed(2) + '%</span>' +
      '</div>' +
      '<div style="height:3px;background:var(--surface-4);border-radius:2px;margin-bottom:5px;overflow:hidden;"><div style="height:100%;width:' + barW + '%;background:' + chgColor + ';border-radius:2px;transition:width 0.5s;"></div></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">' + st.desc + (st.etf ? ' · ' + st.etf : '') + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:' + momColor + ';">' + momSignal + ' ' + breadthPct + '%</span>' +
      '</div>' +
      leadersHtml +
    '</div>';
  });

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
//  THEMES PAGE INIT & EVENT WIRING
// ═══════════════════════════════════════════════════════════════
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿) — 아래 html-themes-live까지.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-themes-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'themes') {
    // P721: 실제 일봉 종가로 RRG 근거 수화 (완료 시 스스로 재렌더, 실패 심볼은 보류 유지)
    try { hydrateRRGDailyHistory(); } catch(_e) {}
    setTimeout(function() {
      drawRRG();
      document.dispatchEvent(new CustomEvent('aio:themesViewChanged'));
      renderSectorPerfBars();
      renderSubThemesGrid();
      // v45.5: 1주 캐시 백그라운드 프리페치 (사용자가 1주 탭 클릭 시 즉각 표시)
      if (Object.keys(_sectorWeeklyCache).length === 0 && !_sectorWeeklyFetching) {
        try { fetchSectorWeeklyPerf(); } catch(_e) {}
      }
    }, 200);
  }
});

_aioPageBus.register('html-themes-live', 'aio:liveQuotes', function() {
  collectPriceHistory();
  var tp = document.getElementById('page-themes');
  if (tp && tp.classList.contains('active')) {
    drawRRG();
    document.dispatchEvent(new CustomEvent('aio:themesViewChanged'));
    renderSectorPerfBars();
    renderSubThemesGrid();
    // 열려있는 상세 패널 자동 갱신
    var dp = document.getElementById('theme-detail-panel');
    if (dp && dp.style.display !== 'none' && dp.dataset.currentTheme) {
      showThemeDetail(dp.dataset.currentTheme);
    }
    // v38.3: 열려있는 세분화 테마 상세 패널 자동 갱신
    var sp = document.getElementById('sub-theme-detail-panel');
    if (sp && sp.style.display !== 'none' && sp.dataset.currentSubTheme) {
      showSubThemeDetail(sp.dataset.currentSubTheme);
    }
  }
});
});

// Theme chips only. No point-in-time FX, rates, policy, or market prose is embedded here.
(function() {
  if (window.CHAT_DEFAULT_CHIPS) {
    window.CHAT_DEFAULT_CHIPS.themes = ['주도 섹터 근거','테마 데이터 상태','무효화 조건'];
  }
})();
