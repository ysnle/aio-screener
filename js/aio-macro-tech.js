// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-macro-tech.js — P1135/R620: index.html 인라인 블록 B(1,174줄)에서 추출한 매크로/기술 렌더 계층.
// computeMarketHealth 인라인 구현(및 _aioIsNativeTechnicalHealth/_aioLegacyHealthElement/
// _aioRenderLegacyMarketHealth 네이티브 fence), updateTechIndicators/updateSRLevels/_aioTechSma/
// loadTechCandleChart/_aioTechSymSwitch/updatePatternSignals, renderEconCalendar/generateMacroStoryline/
// _macroLiveNumber, renderYieldCurve/destroyYieldCurveOwner, computeEconomicTemperature/_tempLive,
// updateMacroRegimePill, updateWtiBrentSpread, _aioSyncMacroLiveSpxMini, renderOfficialFutureCalendar.
//
// 왜 별도 파일이고 왜 aio-pages.js보다 앞에 로드되는가: js/aio-ui.js가 자기 모듈 평가 시점에
// computeMarketHealth를 호출한다(ui:5047 → ui:5087). 원래 이 블록은 core보다 먼저 실행되는 인라인이었고,
// aio-pages.js 뒤로 밀자 ui가 ReferenceError로 죽어 _aioRenderTickerOverview가 정의되지 않았다(실브라우저 검출).
// 추출은 실행 "위치"를 보존해야 한다 — 그래서 이 파일은 defer로 core 앞에 놓인다.
// ═══════════════════════════════════════════════════════════════════════════════

// P1135/R620: index.html 인라인 블록 B(매크로/기술 렌더 1,175줄)를 여기로 접었다.
// 이 블록은 렌더러 계층이므로 새 파일을 만들지 않고 페이지 렌더러 홈(aio-pages.js)에
// 넣는다 — 추출 모듈은 이미 등록돼 있고, 새 파일은 등록 7곳을 다시 요구한다.
// 포함: computeMarketHealth 인라인 구현, updateTechIndicators/updateSRLevels/
// loadTechCandleChart/updatePatternSignals, renderEconCalendar/generateMacroStoryline,
// renderYieldCurve/destroyYieldCurveOwner, computeEconomicTemperature, updateMacroRegimePill,
// updateWtiBrentSpread, _aioSyncMacroLiveSpxMini, renderOfficialFutureCalendar.
// ───────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
//  TECHNICAL ANALYSIS & MACRO — DYNAMIC JS ENGINE
// ═══════════════════════════════════════════════════════════════

function renderOfficialFutureCalendar() {
  var root = document.getElementById('official-future-calendar');
  if (!root) return;
  var snap = window.DATA_SNAPSHOT || {};
  var rows = [];
  function add(date, label, source, detail) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
    var ts = new Date(date + 'T23:59:59+09:00').getTime();
    if (ts < Date.now()) return;
    rows.push({ date: date, label: label, source: source, detail: detail });
  }
  add(snap.bokNext, '한국은행 금통위', 'BOK', '기준금리·원화·물가·수출 반응 확인');
  var fm = String(snap.fomcNext || '').match(/^(\d{4}-\d{2}-)(\d{2})~(\d{2})$/);
  if (fm) add(fm[1] + fm[2], 'FOMC 회의 시작 (' + fm[2] + '~' + fm[3] + '일)', 'Fed', '정책금리·성명·기자회견 확인');
  else add(snap.fomcNext, 'FOMC', 'Fed', '정책금리·성명 확인');
  add(snap.pceNext, 'BEA PCE', 'BEA', '헤드라인·근원 PCE와 소비 확인');
  add(snap.nfpNext, 'BLS 고용보고서', 'BLS', 'NFP·실업률·임금 확인');
  add(snap.cpiNext, 'BLS CPI', 'BLS', '헤드라인·근원 CPI 확인');
  // P875: the registry is the shared official-calendar owner. Snapshot fields
  // cover the highest-priority releases; registry rows add ISM/retail and any
  // future releases without inventing a browser-local cadence.
  var registry = window.AIO_MACRO_CALENDAR && window.AIO_MACRO_CALENDAR.releases;
  if (registry && typeof registry === 'object') {
    Object.keys(registry).forEach(function(key) {
      var item = registry[key] || {};
      add(item.nextRelease, item.name || key, item.source || '공식 일정 원천', item.detail || '공식 발표 원문과 실제 관측값 대조');
    });
  }
  // Avoid duplicate rows when a snapshot field and the registry describe the
  // same release; preserve the first (snapshot-backed) provenance.
  var seen = {};
  rows = rows.filter(function(row) {
    var k = row.date + '|' + row.label;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  rows.sort(function(a, b) { return a.date.localeCompare(b.date); });
  if (!rows.length) { root.innerHTML = '<div class="cal-row"><span style="color:var(--text-muted);">등록된 미래 공식 일정 없음 · 원천 캘린더 확인</span></div>'; return; }
  root.innerHTML = rows.map(function(row) {
    var d = new Date(row.date + 'T00:00:00+09:00');
    var md = (d.getMonth() + 1) + '/' + d.getDate();
    var day = ['일','월','화','수','목','금','토'][d.getDay()];
    return '<div class="cal-row"><span style="font-family:var(--font-mono);color:var(--text-muted);flex-shrink:0;min-width:52px;">' + md + '</span>' +
      '<span style="color:var(--text-muted);flex-shrink:0;min-width:32px;">' + day + '</span>' +
      '<span style="color:var(--text-muted);flex-shrink:0;min-width:88px;font-size:10px;">' + row.source + '</span>' +
      '<span><b style="color:var(--text-secondary);">' + row.label + '</b> — ' + row.detail + '</span></div>';
  }).join('');
}
document.addEventListener('DOMContentLoaded', renderOfficialFutureCalendar);

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
  var vb = _aioLegacyHealthElement('hc-vix-bar'); if (vb) { vb.style.width = (bars.vix || 0) + '%'; vb.style.background = vix < 20 ? 'var(--data-green)' : vix < 25 ? 'var(--data-amber)' : 'var(--data-red)'; }
  var pf = _aioLegacyHealthElement('ind-pressure-fill'); if (pf) { pf.style.width = (bars.pressure || 0) + '%'; pf.style.background = vix < 20 ? 'var(--data-green)' : vix < 25 ? 'var(--data-amber)' : 'var(--data-red)'; }
  var bf = _aioLegacyHealthElement('ind-buyrisk-fill'); if (bf) { bf.style.width = (bars.buyRisk || 0) + '%'; bf.style.background = bars.buyRisk > 60 ? 'var(--data-green)' : bars.buyRisk > 40 ? 'var(--data-amber)' : 'var(--data-red)'; }
  var tf = _aioLegacyHealthElement('ind-trend-fill'); if (tf) { tf.style.width = (bars.trend || 0) + '%'; tf.style.background = bars.trend >= 70 ? 'var(--data-cyan)' : bars.trend >= 50 ? 'var(--data-amber)' : 'var(--data-red)'; }
  el = _aioLegacyHealthElement('tech-health-pill');
  if (el) { el.textContent = model.grade + ' ' + model.regime; el.className = 'status-pill ' + (model.score >= 50 ? 'sp-risk-on' : 'sp-risk-off'); }
  el = _aioLegacyHealthElement('health-interpretation');
  if (el) {
    var compositeScore = null;
    try { if (typeof computeTradingScore === 'function') compositeScore = Number(computeTradingScore().total); else if (window._tradingScore != null) compositeScore = Number(window._tradingScore); } catch(_) {}
    var strategy = model.score >= 65 ? '기술 환경은 우호적입니다. 단독 매수 신호가 아니며 시그널 점수 60+와 시장폭 확산 확인 후 분할 접근.' : model.score >= 40 ? '선별적 매매. 섹터 로테이션과 종합 시그널을 확인하고 포지션 사이즈 축소 고려.' : '방어적 자세. 현금비중 확대, 손절 타이트, 반등 시 매도 고려.';
    var conflict = model.score >= 65 && isFinite(compositeScore) && compositeScore < 60 ? ' 현재 종합 시그널 ' + Math.round(compositeScore) + '/100과 충돌하므로 신규 진입은 관망 우선.' : '';
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

// ── Technical Indicators Table (S&P 500) ──
async function updateTechIndicators() {
  let ld = window._liveData || {};
  var spx = ld['^GSPC'];
  if (!spx) return;
  var snapshot = null;
  try {
    if (typeof fetchOHLCVWithFallback === 'function' && typeof calcTechnicalSnapshot === 'function') {
      var ohlcv = await fetchOHLCVWithFallback('SPY', '1day', 260);
      snapshot = calcTechnicalSnapshot(ohlcv || []);
    }
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'render', 'updateTechIndicators OHLCV failed: ' + (e && e.message || e));
  }
  // v52.16 P5l/P619: "SPY 포지셔닝" 카드(_buildPrice, js/aio-ui.js)가 읽던 DATA_SNAPSHOT.spy3m/spyRsi가
  // 어디서도 대입되지 않아 항상 0.0%/50.0 기본값만 뜨던 문제 — 여기서 실계산한 값을 공유 전역에 저장.
  if (snapshot && snapshot.ok) {
    window._spyPositionStats = { ret3m: snapshot.ret3m, rsi: snapshot.rsi14, ts: Date.now() };
    window._aioTechnicalPageSnapshot = { snapshot: snapshot, ts: Date.now(), source: 'observed-ohlcv' };
  } else {
    window._aioTechnicalPageSnapshot = null;
  }

  var rsi14 = snapshot && snapshot.ok && snapshot.rsi14 !== null ? snapshot.rsi14 : null;
  var macdHist = snapshot && snapshot.ok && snapshot.macd ? snapshot.macd.hist : null;
  var rsiColor = rsi14 === null ? 'var(--text-muted)' : rsi14 > 70 ? 'var(--data-red)' : rsi14 < 30 ? 'var(--data-green)' : 'var(--text-primary)';
  var macdValue = macdHist !== null ? ((macdHist >= 0 ? '+' : '') + macdHist.toFixed(1)) : '—';
  var macdColor = macdHist !== null ? (macdHist > 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';

  // v52.69: 시안 3c는 RSI/MACD/Stochastic/ADX 4카드만 요구 — 이 함수가 실계산하는 나머지(볼린저밴드·
  // 거래추세·VIX공포)는 카드 슬롯이 없어 표에서 제외(원시 계산 자체는 그대로 유지, 텍스트 렌더만 축소).
  // VIX는 건강도 hero에 이미 노출, 볼린저/거래추세는 Weinstein·MTF로 충분히 대체된다고 판단해 드롭 —
  // 데이터 손실이 아니라 동일 정보의 페이지 내 중복 렌더 제거.
  // v52.69 핵심 수정: 과거엔 <table> 전체를 innerHTML로 갈아끼워 Stochastic/ADX id까지 통째로 파괴했음
  // (applyTechIndicators()가 쓰는 tech-stoch-val/tech-adx-val이 이 함수 실행 직후 사라지는 버그) —
  // 이제 tech-rsi-val/tech-macd-val 두 셀만 외과적으로 갱신하고 컨테이너 자체는 건드리지 않는다.
  var rsiEl = document.getElementById('tech-rsi-val');
  if (rsiEl) { rsiEl.textContent = rsi14 === null ? '—' : rsi14.toFixed(1); rsiEl.style.color = rsiColor; rsiEl.title = rsi14 === null ? 'OHLCV 미수신 — 추정값을 생성하지 않음' : '관측 OHLCV 계산값'; }
  var macdEl = document.getElementById('tech-macd-val');
  if (macdEl) { macdEl.textContent = macdValue; macdEl.style.color = macdColor; macdEl.title = macdHist === null ? 'OHLCV 미수신 — 당일 등락률로 대체하지 않음' : '관측 OHLCV 계산값'; }
  if (snapshot && snapshot.ok) {
    updateWeinsteinStage(snapshot);
    updateMTF(snapshot);
  } else {
    updateWeinsteinStage(null);
    updateMTF(null);
  }
}

// ── Support/Resistance Levels ──
function updateSRLevels() {
  var container = document.getElementById('sr-levels-container');
  if (!container) return;
  var symbol = String(window._currentTickerId || '').toUpperCase();
  var history = (window._technicalOHLCV && window._technicalOHLCV[symbol]) || (window._tickerHistory && window._tickerHistory[symbol]) || [];
  var rows = history.filter(function(row) { return row && row.time && row.close != null && isFinite(row.close) && row.close > 0; });
  container.dataset.symbol = symbol;
  if (rows.length < 20) {
    container.textContent = (symbol || '선택 종목') + ' · 일봉 20개 이상 수신 후 가격 참고선을 표시합니다.';
    return;
  }
  var last = rows[rows.length - 1];
  var price = Number(last.close);
  var levels = [{ label: '최근 종가', value: price }];
  [20, 50, 200].forEach(function(period) {
    if (rows.length < period) return;
    var mean = rows.slice(-period).reduce(function(sum, row) { return sum + Number(row.close); }, 0) / period;
    levels.push({ label: 'MA' + period, value: mean });
  });
  var recent = rows.slice(-20);
  var highs = recent.map(function(row) { return row.high; }).filter(function(value) { return value != null && isFinite(value) && value > 0; });
  var lows = recent.map(function(row) { return row.low; }).filter(function(value) { return value != null && isFinite(value) && value > 0; });
  if (highs.length === 20) levels.push({ label: '20일 고가', value: Math.max.apply(null, highs) });
  if (lows.length === 20) levels.push({ label: '20일 저가', value: Math.min.apply(null, lows) });
  container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">' + escHtml(symbol) + ' · 관측일 ' + escHtml(last.time) + '</div>' +
    levels.map(function(level) {
      var distance = (level.value / price - 1) * 100;
      return '<div style="display:flex;gap:10px;font-size:12px;padding:4px 0;"><span>' + level.label + '</span><strong>' + level.value.toFixed(2) + '</strong><span style="margin-left:auto;color:var(--text-muted);">' + (distance > 0 ? '+' : '') + distance.toFixed(1) + '%</span></div>';
    }).join('');
}

// ── Native 캔들 차트 (US) — v52.69 아이보리 3c: TradingView 위젯을 details로 보존하고
// kr-technical의 loadKrCandleChart() 캔들 시뮬레이션 패턴(Chart.js bar-type)을 SPY/QQQ/개별 종목에 재적용.
// 매물대(volume profile) 히스토그램은 신규 알고리즘이 필요해 범위 밖으로 명시 제외 — 대신 표준 시간축 거래량 바 사용.
function _aioTechSma(closes, period) {
  var out = [];
  for (var i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    var sum = 0;
    for (var j = 0; j < period; j++) sum += closes[i - j];
    out.push(sum / period);
  }
  return out;
}

async function loadTechCandleChart(symbol) {
  symbol = (symbol || 'SPY').toString().trim().toUpperCase();
  window._aioTechCurrentSymbol = symbol;
  var priceCvs = document.getElementById('tech-candle-chart');
  var volCvs = document.getElementById('tech-candle-volume');
  // P833: the native technical route owns these canvas lifecycles.  This
  // function remains a compatibility action for non-native fallback entry
  // points but cannot overwrite a mounted native chart.
  if ((priceCvs && priceCvs.closest('#page-technical[data-aio-technical-chart-renderer="native"]')) ||
      (volCvs && volCvs.closest('#page-technical[data-aio-technical-chart-renderer="native"]'))) return;
  if (!priceCvs || !volCvs) return;
  priceCvs.setAttribute('aria-label', symbol + ' 일봉 캔들 및 이동평균 차트');
  volCvs.setAttribute('aria-label', symbol + ' 일별 거래량 차트');

  // 심볼 토글 활성 표시 (SPY/QQQ만 pill, 그 외 개별 티커는 둘 다 비활성)
  var toggleWrap = document.getElementById('tech-sym-toggle');
  if (toggleWrap) {
    Array.prototype.forEach.call(toggleWrap.children, function(el) {
      var active = el.getAttribute('data-arg') === symbol;
      el.style.color = active ? 'var(--bg-base)' : 'var(--text-secondary)';
      el.style.background = active ? 'var(--text-primary)' : 'transparent';
    });
  }

  var rows = null;
  try {
    rows = typeof fetchOHLCVWithFallback === 'function' ? await fetchOHLCVWithFallback(symbol, '1day', 260) : null;
  } catch (e) { rows = null; }
  rows = (rows || []).filter(function(r) { return r && r.time && isFinite(r.open) && isFinite(r.high) && isFinite(r.low) && isFinite(r.close); });

  if (rows.length < 20) {
    if (typeof _showChartFallback === 'function') {
      _showChartFallback(priceCvs, symbol + ' 일봉 차트', '데이터 수신 실패 — 잠시 후 다시 시도하거나 종목코드를 확인하세요');
    }
    volCvs.style.display = 'none';
    return;
  }
  priceCvs.style.display = 'block'; volCvs.style.display = 'block';
  var existingFallback = priceCvs.parentElement && priceCvs.parentElement.querySelector('.aio-chart-fallback');
  if (existingFallback) existingFallback.remove();

  // MA는 전체 수신 히스토리로 계산(MA200 확보) 후 최근 90거래일만 슬라이스해 표시
  var closesAll = rows.map(function(r) { return r.close; });
  var maAll = { 5: _aioTechSma(closesAll, 5), 10: _aioTechSma(closesAll, 10), 20: _aioTechSma(closesAll, 20), 50: _aioTechSma(closesAll, 50), 200: _aioTechSma(closesAll, 200) };
  var showBars = Math.min(90, rows.length);
  var start = rows.length - showBars;
  var candles = rows.slice(start);
  var ma5 = maAll[5].slice(start), ma10 = maAll[10].slice(start), ma20 = maAll[20].slice(start), ma50 = maAll[50].slice(start), ma200 = maAll[200].slice(start);

  var labels = candles.map(function(c) { return c.time.slice(5); });
  var lows = candles.map(function(c) { return Number(c.low); });
  var highs = candles.map(function(c) { return Number(c.high); });
  var yMin = Math.min.apply(null, lows), yMax = Math.max.apply(null, highs);
  var yPad = Math.max((yMax - yMin) * 0.06, yMax * 0.005, 0.5);

  // v52.69: canvas 2D fillStyle/strokeStyle은 var() cascade를 해석하지 않으므로 getComputedStyle로 사전 해석
  // (loadKrCandleChart의 borderColor:'var(--data-cyan)' 직접전달 패턴은 재사용하지 않음 — 신규 코드는 안전한 쪽 채택).
  var cs = getComputedStyle(document.documentElement);
  var greenC = cs.getPropertyValue('--data-green').trim() || '#22754c';
  var redC = cs.getPropertyValue('--data-red').trim() || '#b13a30';
  var tickColor = cs.getPropertyValue('--text-muted').trim() || '#8a8271';
  var gridColor = cs.getPropertyValue('--border-subtle').trim() || 'rgba(0,0,0,0.08)';
  var ma5Color = cs.getPropertyValue('--text-secondary').trim() || '#57513f';
  var ma10Color = cs.getPropertyValue('--text-muted').trim() || '#8a8271';
  var ma20Color = cs.getPropertyValue('--text-dim').trim() || '#a29a89';
  var ma50Color = cs.getPropertyValue('--border-strong').trim() || '#c8c0b0';
  var colors = candles.map(function(c) { return c.close >= c.open ? greenC : redC; });
  var volColors = candles.map(function(c) { return c.close >= c.open ? greenC + '80' : redC + '80'; });

  if (window._aioChartRegistry) {
    window._aioChartRegistry.destroyIfExists('tech-candle-chart');
    window._aioChartRegistry.destroyIfExists('tech-candle-volume');
  }

  var priceChart = new Chart(priceCvs, {
    data: {
      labels: labels,
      datasets: [
        { type: 'bar', label: '고저', data: candles.map(function(c) { return [c.low, c.high]; }), backgroundColor: colors, barPercentage: 0.2, categoryPercentage: 0.9, borderWidth: 0 },
        { type: 'bar', label: '시-종', data: candles.map(function(c) { return [Math.min(c.open, c.close), Math.max(c.open, c.close)]; }), backgroundColor: colors, barPercentage: 0.65, categoryPercentage: 0.9, borderWidth: 0 },
        { type: 'line', label: 'MA5', data: ma5, borderColor: ma5Color, borderWidth: 1.2, pointRadius: 0, spanGaps: true },
        { type: 'line', label: 'MA10', data: ma10, borderColor: ma10Color, borderWidth: 1.1, pointRadius: 0, spanGaps: true },
        { type: 'line', label: 'MA20', data: ma20, borderColor: ma20Color, borderWidth: 1.1, pointRadius: 0, spanGaps: true },
        { type: 'line', label: 'MA50', data: ma50, borderColor: ma50Color, borderWidth: 1, pointRadius: 0, spanGaps: true },
        { type: 'line', label: 'MA200', data: ma200, borderColor: ma50Color, borderDash: [3, 3], borderWidth: 1, pointRadius: 0, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 }, grid: { display: false } },
        y: { beginAtZero: false, suggestedMin: yMin - yPad, suggestedMax: yMax + yPad, ticks: { color: tickColor, callback: function(v) { return Number(v).toLocaleString(); } }, grid: { color: gridColor } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(items) { return candles[items[0].dataIndex].time; },
            label: function(item) {
              if (item.datasetIndex >= 2) { var v = item.raw; return item.dataset.label + ' ' + (v != null ? Number(v).toFixed(2) : '—'); }
              var c = candles[item.dataIndex];
              return ['시 ' + c.open.toFixed(2), '고 ' + c.high.toFixed(2), '저 ' + c.low.toFixed(2), '종 ' + c.close.toFixed(2)];
            }
          }
        }
      }
    }
  });
  var volChart = new Chart(volCvs, {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: candles.map(function(c) { return c.volume || 0; }), backgroundColor: volColors, barPercentage: 0.8, categoryPercentage: 0.9, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { ticks: { color: tickColor, maxTicksLimit: 2, callback: function(v) { return (v >= 1e6) ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K'; } }, grid: { display: false } }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
  if (window._aioChartRegistry) {
    window._aioChartRegistry.register('tech-candle-chart', priceChart);
    window._aioChartRegistry.register('tech-candle-volume', volChart);
  }

  var last = candles[candles.length - 1];
}
window.loadTechCandleChart = loadTechCandleChart;
function _aioTechSymSwitch(sym) { return analyzeTickerDeep(sym); }
window._aioTechSymSwitch = _aioTechSymSwitch;

// ── Pattern & Signal Detection ──
function updatePatternSignals() {
  let ld = window._liveData || {};
  var spy = ld['SPY'], vix = ld['^VIX'];
  if (!spy) return;
  // P1164/B02: 규칙 operand는 유한한 수일 때만 비교·표시에 쓴다. `_ldSafe`는 원천이 없으면 null을
  // 돌려주는데 `null < 73`이 0으로 강제되어 위기 조건을 만족시킨 뒤 이어지는 .toFixed가
  // TypeError를 던졌다(브라우저 콘솔 `updatePatternSignals` null.toFixed). 결측은 조건 불성립이다.
  var _fin = function(v) { var n = Number(v); return (v == null || !isFinite(n)) ? null : n; };
  var chg = _fin(spy.pct);
  if (chg == null) chg = 0;
  var vixP = _fin(vix && vix.price);
  var vixChg = _fin(vix && vix.pct);
  if (vixChg == null) vixChg = 0;
  var hygPrice = _fin(_ldSafe('HYG','price'));
  var hygChg = _fin(ld['HYG'] && ld['HYG'].pct);
  if (hygChg == null) hygChg = 0;

  var signals = [];

  // ── 1. 저변동성 구간 (기존 가짜 BB 스퀴즈 대체) ──
  if (Math.abs(chg) < 0.15 && vixP != null && vixP < 20) {
    signals.push({ name: '저변동성 압축 구간', type: 'setup', icon: '',
      color: 'var(--data-purple)',
      detail: 'SPY 일일 변동 ±0.15% 미만 + VIX 20 이하 = 변동성이 극도로 압축된 상태. 역사적으로 저변동성 기간 후 큰 방향성 움직임이 뒤따르는 경우가 많습니다. 돌파 방향에 따라 빠른 진입 준비.',
      why: '변동성은 평균 회귀 특성이 있어, 극단적 저변동성은 큰 움직임의 전조일 수 있습니다.',
      importance: 'HIGH' });
  } else if (Math.abs(chg) < 0.15 && vixP != null) {
    signals.push({ name: '저변동성 구간', type: 'setup', icon: '',
      color: 'var(--data-purple)',
      detail: 'SPY 일일 변동 ±0.15% 미만이지만 VIX '+vixP.toFixed(1)+'로 내재 변동성은 높음 → 표면은 잠잠하나 내부 긴장 존재. 갑작스러운 방향 전환 가능.',
      why: '현물 저변동 + 옵션 고변동 = "잠복 에너지" 상태. 촉매(뉴스/이벤트) 시 폭발적 움직임 가능.',
      importance: 'MED' });
  }

  // ── 2. VIX 스파이크 (세분화) ── (VIX 미수신이면 어느 구간도 주장하지 않는다)
  if (vixP != null && vixP > 35 && vixChg > 10) {
    signals.push({ name: 'VIX 패닉 스파이크', type: 'risk', icon: '',
      color: 'var(--data-red)',
      detail: 'VIX ' + vixP.toFixed(1) + ' (일일 +' + vixChg.toFixed(1) + '%) → 극심한 공포! 당일 VIX 급등 + 절대 레벨 35+ = 패닉 매도 진행 중. 역사적으로 VIX 급등 후 1~3일 내 단기 반등이 발생하는 경우가 많지만, 하락 추세 중 반등은 "Dead Cat Bounce"일 수 있으니 추세 확인 필수.',
      why: 'VIX 일일 10%+ 급등은 옵션 시장의 공포 가격 책정을 반영. 극단적 공포는 단기 과매도를 유발합니다.',
      importance: 'HIGH' });
  } else if (vixP != null && vixP > 30) {
    signals.push({ name: 'VIX 공포 영역', type: 'risk', icon: '',
      color: 'var(--data-red)',
      detail: 'VIX ' + vixP.toFixed(1) + ' → 공포 영역. 역사적으로 노출 축소·헤지가 논의되던 환경입니다(지시 아님). 역발상 프레임워크는 VIX 하락 반전 "이후" 구간을 주목해왔습니다.',
      why: 'VIX 30+는 시장이 향후 30일간 연환산 30% 이상 변동을 예상한다는 의미입니다.',
      importance: 'HIGH' });
  } else if (vixP != null && vixP > 25) {
    signals.push({ name: 'VIX 경계 상승', type: 'warning', icon: '',
      color: 'var(--data-amber)',
      detail: 'VIX ' + vixP.toFixed(1) + ' → 불안감 증가. 아직 공포는 아니지만 포지션 사이즈 축소 권장. 25~30 구간은 "주의" 영역.',
      why: 'VIX 25 이상에서는 옵션 프리미엄이 비싸져 헤지 비용이 상승합니다.',
      importance: 'MED' });
  } else if (vixP != null && vixP < 13) {
    signals.push({ name: 'VIX 극저점 경고', type: 'warning', icon: '',
      color: 'var(--data-amber)',
      detail: 'VIX ' + vixP.toFixed(1) + ' → 극도의 안일함(Complacency). 역설적이지만 VIX 13 미만은 시장이 리스크를 과소평가하고 있을 수 있다는 경고. 보호 풋(Put) 매수가 저렴한 시기.',
      why: 'VIX 역사적 저점 근처는 대개 "폭풍 전 고요"를 나타냅니다.',
      importance: 'MED' });
  }

  // ── 3. 갭 분석 (크기별 세분화) ──
  var absChg = Math.abs(chg);
  if (chg > 2) {
    signals.push({ name: '메가 갭 상승 (+2%↑)', type: 'bullish', icon: '',
      color: 'var(--data-green)',
      detail: 'SPY +' + chg.toFixed(2) + '% 메가 갭! 기관 매수 또는 매크로 이벤트 반응. 종가까지 갭을 메우지 않으면 "브레이크어웨이 갭"으로 추세 전환 신호 가능.',
      why: '2%+ 갭은 연간 3~5회 정도만 발생하는 희소한 이벤트로, 강한 방향성 신호입니다.',
      importance: 'HIGH' });
  } else if (chg > 1) {
    signals.push({ name: '갭 상승 (+1~2%)', type: 'bullish', icon: '',
      color: 'var(--data-green)',
      detail: 'SPY +' + chg.toFixed(2) + '% 갭 상승. 해외 시장 호재 또는 선물 매수세 반영. 장 중 갭 유지 여부가 핵심.',
      why: '1%+ 갭은 프리마켓에서 이미 매수 합의가 형성되었다는 의미입니다.',
      importance: 'MED' });
  } else if (chg > 0.5) {
    signals.push({ name: '미니 갭 상승 (+0.5~1%)', type: 'bullish', icon: '',
      color: '#22754c',
      detail: 'SPY +' + chg.toFixed(2) + '% 소폭 갭 상승. 일상적 수준이나 연속 발생 시 추세 가속 신호.',
      why: '소폭 갭이 3일 이상 연속되면 기관 매수 프로그램 가동 가능성.',
      importance: 'LOW' });
  } else if (chg < -2) {
    signals.push({ name: '메가 갭 하락 (-2%↓)', type: 'bearish', icon: '',
      color: 'var(--data-red)',
      detail: 'SPY ' + chg.toFixed(2) + '% 메가 갭 하락! 대형 악재 반응. 장 중 반전(Reversal)이 없으면 추가 하락 가능. 장 마감 후 갭 메움 여부 확인.',
      why: '2%+ 하락 갭은 기관 포트폴리오 리밸런싱이나 리스크 오프 촉발점입니다.',
      importance: 'HIGH' });
  } else if (chg < -1) {
    signals.push({ name: '갭 하락 (-1~2%)', type: 'bearish', icon: '',
      color: 'var(--data-red)',
      detail: 'SPY ' + chg.toFixed(2) + '% 갭 하락. 공포 매도 또는 해외 악재. 장 중 V자 반등이 나오면 "하락 갭 반전"으로 매수 기회 가능.',
      why: '장 중 갭을 완전히 메우는 "갭 필(Gap Fill)"은 단기 강세 신호입니다.',
      importance: 'MED' });
  } else if (chg < -0.5) {
    signals.push({ name: '미니 갭 하락 (-0.5~1%)', type: 'bearish', icon: '',
      color: '#b13a30',
      detail: 'SPY ' + chg.toFixed(2) + '% 소폭 갭 하락. 일상적 수준이나 연속 시 주의.',
      why: '소폭 하락 갭이 연속되면 점진적 분배(Distribution) 진행 신호.',
      importance: 'LOW' });
  }

  // ── 4. 섹터 로테이션 강도 (방어 vs 성장) ──
  var defETFs = ['XLP','XLU','XLV'];
  var offETFs = ['XLK','XLY','XLF'];
  var defAvg = 0, offAvg = 0, defCnt = 0, offCnt = 0;
  defETFs.forEach(function(t) { if (ld[t] && ld[t].pct != null) { defAvg += ld[t].pct; defCnt++; } });
  offETFs.forEach(function(t) { if (ld[t] && ld[t].pct != null) { offAvg += ld[t].pct; offCnt++; } });
  defAvg = defCnt > 0 ? defAvg / defCnt : 0;
  offAvg = offCnt > 0 ? offAvg / offCnt : 0;
  var rotationDiff = defAvg - offAvg; // 양수 = 방어주 리드

  if (rotationDiff > 0.8 && chg < 0) {
    signals.push({ name: '강한 방어 섹터 로테이션', type: 'warning', icon: '',
      color: 'var(--data-red)',
      detail: '방어섹터(필수소비·유틸·헬스) 평균 ' + (defAvg > 0 ? '+' : '') + defAvg.toFixed(2) + '% vs 성장섹터 ' + (offAvg > 0 ? '+' : '') + offAvg.toFixed(2) + '% → 자금이 "안전한 곳"으로 급속 이동 중. Late-cycle 패턴의 전형! 2007년 하반기, 2019년 하반기에 유사 패턴.',
      why: '기관 자금이 성장주에서 방어주로 대규모 이동하는 것은 경기 둔화를 선반영하는 시그널입니다.',
      importance: 'HIGH' });
  } else if (rotationDiff > 0.3 && chg < 0) {
    signals.push({ name: '방어 섹터 선호', type: 'warning', icon: '',
      color: 'var(--data-amber)',
      detail: '방어섹터가 시장 약세에서도 선방 중(차이 +' + rotationDiff.toFixed(2) + '%p). 위험회피 심리 증가.',
      why: '시장 하락 시 방어주가 강한 것은 기관이 "리스크 오프" 모드로 전환 중이라는 신호.',
      importance: 'MED' });
  } else if (rotationDiff < -0.5 && chg > 0) {
    signals.push({ name: '성장 섹터 리더십', type: 'bullish', icon: '',
      color: 'var(--data-green)',
      detail: '성장섹터(기술·소비재·금융)가 방어섹터를 ' + Math.abs(rotationDiff).toFixed(2) + '%p 아웃퍼폼 → 위험선호(Risk-On) 심리. 건강한 상승 랠리.',
      why: '성장 섹터가 상승을 주도하는 것은 투자자들이 경기 확장을 기대한다는 의미입니다.',
      importance: 'MED' });
  }

  // ── 5. 금융주 리더십 ──
  var xlf = ld['XLF'];
  if (xlf && (xlf.pct != null ? xlf.pct : 0) > 0.5 && chg > 0) {
    signals.push({ name: '금융주 리더십', type: 'bullish', icon: '',
      color: 'var(--data-green)',
      detail: 'XLF +' + (xlf.pct).toFixed(2) + '% — 금융 섹터(은행·보험)가 시장 상승을 주도! 금융주 강세 = 신용(대출) 확장 중 = 경제 체력 양호.',
      why: '은행주는 대출 수요(경기)와 금리 마진에 민감합니다. 금융주 주도 랠리는 실물 경제 회복과 동행하는 경우가 많습니다.',
      importance: 'HIGH' });
  } else if (xlf && (xlf.pct != null ? xlf.pct : 0) < -1 && chg < -0.5) {
    signals.push({ name: '금융주 급락', type: 'bearish', icon: '',
      color: 'var(--data-red)',
      detail: 'XLF ' + (xlf.pct).toFixed(2) + '% — 금융 섹터 급락은 신용 경색 우려의 선행 지표. 2023년 SVB 사태처럼 은행 리스크 확산 가능.',
      why: '금융주가 시장보다 더 크게 하락하면, 대출 부실이나 유동성 위기를 시장이 감지하고 있을 수 있습니다.',
      importance: 'HIGH' });
  }

  // ── 6. Gold+달러 동시 강세 (지정학 경고) ──
  var gold = ld['GC=F'], dxy = ld['DX-Y.NYB'];
  if (gold && dxy && (gold.pct != null ? gold.pct : 0) > 0.5 && (dxy.pct != null ? dxy.pct : 0) > 0.3) {
    signals.push({ name: 'Gold+달러 동시 강세', type: 'risk', icon: '',
      color: 'var(--data-amber)',
      detail: '금 +' + (gold.pct).toFixed(2) + '% & 달러 +' + (dxy.pct).toFixed(2) + '% 동시 강세 = 극심한 불확실성. 전 세계 자금이 "안전자산 아무 곳이나" 모드. 지정학 리스크(전쟁·제재) 반영 가능.',
      why: '정상적으로 금과 달러는 역상관입니다. 동시 상승은 "모든 위험자산을 팔고 싶다"는 극단적 공포의 표현입니다.',
      importance: 'HIGH' });
  }

  // ── 7. Brent-WTI 스프레드 이상 (지정학) ──
  var wtiD = ld['CL=F'], brentD = ld['BZ=F'];
  if (wtiD && brentD && wtiD.price != null && brentD.price != null && isFinite(Number(wtiD.price)) && isFinite(Number(brentD.price))) {
    var oilSpread = Number(brentD.price) - Number(wtiD.price);
    if (oilSpread > 8) {
      signals.push({ name: '유가 스프레드 급확대', type: 'risk', icon: '',
        color: 'var(--data-red)',
        detail: 'Brent-WTI 스프레드 $' + oilSpread.toFixed(1) + ' (정상 $2~5) → 국제유가에 "전쟁 프리미엄" 부착. 중동·홍해·호르무즈 해협 관련 공급 불안. 에너지주↑ 항공·운송↓.',
        why: 'Brent는 국제유가, WTI는 미국 내수유가. 스프레드 확대 = 국제 운송 리스크(해상 봉쇄, 지정학)가 미국 외 지역에 더 큰 영향.',
        importance: 'HIGH' });
    } else if (oilSpread > 5) {
      signals.push({ name: '유가 스프레드 확대', type: 'warning', icon: '',
        color: 'var(--data-amber)',
        detail: 'Brent-WTI 스프레드 $' + oilSpread.toFixed(1) + ' → 정상 범위 상단. 지정학 리스크 또는 글로벌 수급 불균형 모니터링 필요.',
        why: '스프레드 $5 이상은 글로벌 원유 공급 경로에 스트레스가 있다는 시그널입니다.',
        importance: 'MED' });
    }
  }

  // ── 8. 고수익채권(HYG) 가격 경계 ──
  // P1164/B02: HYG는 고수익채권 ETF '가격'이며 신용스프레드(OAS) 자체가 아니다. 이름·해석을
  // 측정 대상에 맞춘다. 가격 원천이 없으면 위기 조건을 만들지 않는다.
  if (hygPrice != null && hygPrice < 73) {
    signals.push({ name: '고수익채권 급락 (HYG 가격)', type: 'risk', icon: '',
      color: 'var(--data-red)',
      detail: 'HYG $' + hygPrice.toFixed(1) + ' → 고수익채권 가격 급락. 기업 부도 위험 급등을 시장이 가격에 반영 중. 2008, 2020년 위기 때와 유사한 수준.',
      why: 'HYG 가격 하락은 회사채 시장의 신용 경색을 시장이 반영한 대용 지표입니다. 공식 신용스프레드(OAS) 값이 아닙니다.',
      importance: 'HIGH' });
  } else if (hygPrice != null && hygPrice < 76 && hygChg < -0.3) {
    signals.push({ name: '고수익채권 약세 (HYG 가격)', type: 'warning', icon: '',
      color: 'var(--data-amber)',
      detail: 'HYG $' + hygPrice.toFixed(1) + ' (오늘 ' + hygChg.toFixed(2) + '%) → 고수익채권 하락은 기업 신용 환경 악화 신호. 주식보다 채권 시장이 먼저 위험을 감지합니다.',
      why: 'HYG 가격 하락은 향후 1~3개월 주식 약세의 선행 신호일 수 있다는 관측입니다. 스프레드 수치 자체가 아닙니다.',
      importance: 'MED' });
  }

  // ── 9. 일간 모멘텀 ──
  if (chg > 0.5 && chg <= 1) {
    signals.push({ name: '일간 상승 모멘텀', type: 'bullish', icon: '',
      color: 'var(--data-green)',
      detail: 'SPY +' + chg.toFixed(2) + '% 양봉 형성 중. 섹터 참여도(시장폭)와 함께 확인하면 추세 지속 가능성 판단 가능.',
      why: '건강한 상승은 대형주·중소형주 모두 참여할 때 지속력이 있습니다.',
      importance: 'LOW' });
  } else if (chg < -0.5 && chg >= -1) {
    signals.push({ name: '일간 하락 모멘텀', type: 'bearish', icon: '',
      color: 'var(--data-red)',
      detail: 'SPY ' + chg.toFixed(2) + '% 음봉 형성 중. 주요 지지선(50일선, 200일선) 이탈 여부를 주시하세요.',
      why: '이동평균선은 기관 투자자들의 매매 기준점입니다. 200일선 이탈은 중기 추세 전환의 핵심 신호.',
      importance: 'LOW' });
  }

  // ── default: 특이 신호 없음 ──
  if (signals.length === 0) {
    signals.push({ name: '특이 신호 없음', type: 'neutral', icon: '',
      color: 'var(--data-cyan)',
      detail: '현재 특별한 이벤트나 극단적 신호가 감지되지 않습니다. 정상적인 시장 환경에서는 기존 전략을 유지하세요.',
      why: '시그널 부재도 정보입니다 — 시장이 균형 상태라는 뜻입니다.',
      importance: 'LOW' });
  }

  // ── 렌더링 ──
  var html = '';
  signals.forEach(function(s) {
    html += '<div style="background:' + s.color + '08;border:1px solid ' + s.color + '25;border-radius:3px;padding:8px;">' +
      '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">' +
        '<span style="font-size:12px;">' + s.icon + '</span>' +
        '<span style="font-size:12px;font-weight:800;color:' + s.color + ';">' + s.name + '</span>' +
        '<span style="margin-left:auto;font-size:10px;font-weight:700;background:' + s.color + '22;color:' + s.color + ';padding:1px 4px;border-radius:2px;">' + s.importance + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);line-height:1.6;">' + s.detail + '</div>' +
      (s.why ? '<div style="font-size:10px;color:var(--text-secondary);line-height:1.5;margin-top:3px;padding-top:3px;border-top:1px solid var(--border);"><b>왜 중요한가:</b> ' + s.why + '</div>' : '') +
    '</div>';
  });

  var container = document.getElementById('pattern-signals');
  if (container) container.innerHTML = html;
}

// ── Official economic calendar ──
function renderEconCalendar() {
  var el = document.getElementById('macro-econ-calendar');
  if (!el) return;
  var releases = window.AIO_MACRO_CALENDAR && window.AIO_MACRO_CALENDAR.releases;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var events = releases ? Object.keys(releases).map(function(key) {
    var item = releases[key] || {};
    var date = /^\d{4}-\d{2}-\d{2}$/.test(item.nextRelease || '')
      ? new Date(item.nextRelease + 'T00:00:00+09:00') : null;
    return date && date >= today ? { key:key, item:item, date:date } : null;
  }).filter(Boolean).sort(function(a, b) { return a.date - b.date; }).slice(0, 8) : [];

  if (!events.length) {
    el.setAttribute('data-runtime-state', 'unavailable');
    el.setAttribute('data-operational-use', 'blocked');
    el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">검증된 공식 발표 일정이 없습니다. 임의 주기·요일로 일정을 생성하지 않습니다.</div>';
    return;
  }

  el.setAttribute('data-runtime-state', 'official-reference');
  el.setAttribute('data-operational-use', 'calendar-only');
  el.innerHTML = events.map(function(entry) {
    var item = entry.item;
    return '<div style="display:grid;grid-template-columns:92px 1fr minmax(120px,auto);gap:8px;padding:8px;border-bottom:1px solid var(--border);">'
      + '<span style="color:var(--data-cyan);font-weight:700;font-family:var(--font-mono);">' + escHtml(item.nextRelease) + '</span>'
      + '<span style="color:var(--text-secondary);font-weight:600;">' + escHtml(item.name || entry.key) + '</span>'
      + '<span style="font-size:10px;color:var(--text-muted);text-align:right;">' + escHtml(item.source || '공식 일정 원천') + '</span>'
      + '</div>';
  }).join('');
}

// ── Macro Storyline (immersive Korean narrative) ──
function generateMacroStoryline() {
  let ld = window._liveData || {};
  function _macroLiveNumber(sym, field) {
    var row = ld[sym];
    if (!row || row[field] == null) return null;
    var n = Number(row[field]);
    return isFinite(n) ? n : null;
  }
  var tnx = _macroLiveNumber('^TNX', 'price');
  var dxy = _macroLiveNumber('DX-Y.NYB', 'price');
  var wti = _macroLiveNumber('CL=F', 'price');
  var spyChg = _macroLiveNumber('SPY', 'pct');
  var dxyChg = _macroLiveNumber('DX-Y.NYB', 'pct');
  var oilPctNow = _macroLiveNumber('CL=F', 'pct');
  var required = { SPY:spyChg, '^TNX':tnx, 'DX-Y.NYB':dxy, 'CL=F':wti };
  var missing = Object.keys(required).filter(function(sym) { return required[sym] == null; });
  if (missing.length) {
    var blocked = '<div data-runtime-state="unavailable" data-operational-use="blocked" style="padding:10px;background:var(--surface-1);border:1px dashed var(--border);color:var(--text-muted);">'
      + '<b style="color:var(--text-primary);">거시 브리핑 판단 보류</b><br>필수 실시간 입력 미수신: ' + missing.map(escHtml).join(', ')
      + '</div>';
    var blockedContainer = document.getElementById('macro-storyline');
    if (blockedContainer) blockedContainer.innerHTML = blocked;
    var blockedSummary = document.getElementById('macro-summary-line');
    if (blockedSummary) blockedSummary.textContent = '필수 원천 수신 후 거시 결론을 생성합니다.';
    return;
  }

  var story = '';
  var summary = '';

  var _curveEv = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function'
    ? window.AIO.getUsTreasuryCurveEvidence() : {};
  var y2Now = _curveEv.twoY;
  var spyToneNow = spyChg > 0.6 ? '위험선호' : (spyChg < -0.6 ? '위험회피' : '관망');
  var ratePressureNow = (tnx >= 4.4 || (y2Now != null && y2Now >= 4.1));
  var oilReliefNow = (wti < 85 && oilPctNow <= 0.5);
  var dollarToneNow = dxyChg > 0.3 ? '달러 강세' : (dxyChg < -0.3 ? '달러 약세' : '달러 중립');
  var macroActionNow = ratePressureNow
    ? '높은 할인율의 성장주·장기채 민감도를 확인합니다. 매수·매도 판단은 실적·수급과 별도 검증합니다.'
    : '금리 부담 완화 가능성을 관찰하되 경기 둔화 원인인지 함께 확인합니다.';
  if (oilReliefNow) {
    macroActionNow += ' 유가 리스크는 완화 쪽이나 중동 헤드라인은 계속 확인.';
  } else if (wti >= 85 || oilPctNow > 1) {
    macroActionNow += ' 유가 상승은 인플레 재점화 리스크로 반영.';
  }
  // v52.88 P703: 시안 3d는 운영 카드 4장을 나열하지 않고 한 문단의 거시 연결로 시작한다.
  // 동일 실데이터를 금리→유가→달러→행동 순서의 짧은 서사로 통합한다.
  story = '<p style="margin:0 0 10px;font-size:14px;color:var(--text-secondary);line-height:1.9;">' +
    '<b style="color:var(--text-primary);">' + (ratePressureNow ? '금리 부담이 이어지는 가운데' : '금리 부담이 완화되는 가운데') + '</b> ' +
    (y2Now != null ? ('미 2년물 ' + y2Now.toFixed(2) + '%, 10년물 ' + tnx.toFixed(2) + '%입니다. ') : ('미 2년물 개별 금리는 원천 미수신이며, 10년물은 ' + tnx.toFixed(2) + '%입니다. ')) +
    'WTI는 $' + wti.toFixed(1) + ', DXY는 ' + dxy.toFixed(1) + '로 ' + dollarToneNow + ' 흐름이며, 시장 톤은 ' + spyToneNow + '입니다.</p>' +
    '<p style="margin:0;font-size:13.5px;color:var(--text-secondary);line-height:1.85;">' + macroActionNow + '</p>';
  summary = (ratePressureNow ? 'FOMC 이후 금리 경계' : '금리 부담 완화') + ' · ' +
    (oilReliefNow ? '유가 부담 완화' : '유가 리스크 확인') + ' · ' +
    spyToneNow + ' 대응';
  // R68: 현재 렌더 경로에 출처와 예상 시간을 함께 표시한다.
  var macroSourceParts = ['SPY','^VIX','DX-Y.NYB','CL=F','BZ=F','GC=F','HYG','^TNX'].map(function(sym) {
    var row = ld[sym];
    var source = row && (row.source || row._sourceLabel || row.provider);
    return source ? sym + ':' + source : null;
  }).filter(Boolean);
  story += '<div class="macro-provenance" style="margin-top:8px;padding:7px 9px;background:rgba(33,29,22,0.08);border-left:3px solid var(--border);border-radius:3px;font-size:10px;color:var(--text-muted);line-height:1.6;">'
    + '<b>출처</b>: ' + macroSourceParts.join(' · ')
    + '<br><b>미수신 정책</b>: 값과 결론을 표시하지 않음'
    + '</div>';
  var macroContainerNow = document.getElementById('macro-storyline');
  if (macroContainerNow) macroContainerNow.innerHTML = story;
  var macroSummaryNow = document.getElementById('macro-summary-line');
  if (macroSummaryNow) macroSummaryNow.innerHTML = '오늘 대응: ' + summary + ' - ' + macroActionNow;
  return;

}

// ── Render Yield Curve Chart ──
function renderYieldCurve() {
  // P875: the AR-01 native market slice owns the macro canvas whenever its
  // renderer marker is mounted. Legacy live-quote callbacks must not repaint
  // that canvas or Chart.js will report a reuse error on route transitions.
  var nativeMacroPage = document.getElementById('page-macro');
  if (nativeMacroPage && nativeMacroPage.dataset.aioMacroChartRenderer === 'native') return;
  let ld = window._liveData || {};
  var curve = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function'
    ? window.AIO.getUsTreasuryCurveEvidence() : {};
  var irx = curve.threeM;
  var y2 = curve.twoY;
  var fvx = curve.fiveY;
  var tnx = curve.tenY;
  var tyx = curve.thirtyY;

  var canvasEl = document.getElementById('yieldCurveChart');
  if (!canvasEl) return;

  // P875: one canvas may have been touched by a legacy route before the
  // native owner takes over. Destroy every known registry handle (including
  // Chart.js' own lookup) before creating the replacement instance.
  function destroyYieldCurveOwner() {
    try {
      if (window._yieldCurveChart) { window._yieldCurveChart.destroy(); delete window._yieldCurveChart; }
    } catch(_) { delete window._yieldCurveChart; }
    try {
      if (typeof _ycCharts !== 'undefined' && _ycCharts.yieldCurveChart) {
        _ycCharts.yieldCurveChart.destroy();
        _ycCharts.yieldCurveChart = null;
      }
    } catch(_) {}
    try {
      if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
        var existing = Chart.getChart(canvasEl);
        if (existing) existing.destroy();
      }
    } catch(_) {}
  }

  destroyYieldCurveOwner();
  if (!curve.complete) {
    var missing = [];
    [['3M',irx],['2Y',y2],['5Y',fvx],['10Y',tnx],['30Y',tyx]].forEach(function(pair) { if (pair[1] == null) missing.push(pair[0]); });
    var blockedSpread = document.getElementById('spread-status');
    if (blockedSpread && blockedSpread.dataset.aioMacroSpreadRenderer !== 'native') { blockedSpread.textContent = '— (10Y - 2Y)'; blockedSpread.style.color = 'var(--text-muted)'; }
    return;
  }

  var ctx = canvasEl.getContext('2d');
  var yields = [
    { maturity: '3M', rate: irx },
    { maturity: '2Y', rate: y2 },
    { maturity: '5Y', rate: fvx },
    { maturity: '10Y', rate: tnx },
    { maturity: '30Y', rate: tyx }
  ];

  // v30.11: 차트 데이터 검증 게이트
  var gateLabels = yields.map(function(y) { return y.maturity; });
  var gateData = yields.map(function(y) { return parseFloat(y.rate); });
  var gated = chartDataGate('yieldCurveChart', gateLabels, [gateData], { minPoints: 3, chartName: '수익률 곡선', fillMode: 'prev' });
  if (!gated) return;

  // Create new chart
  window._yieldCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: gated.labels,
      datasets: [{
        label: '수익률 곡선',
        data: gated.datasets[0].map(function(v) { return (+v).toFixed(2); }),
        borderColor: 'var(--data-purple)',
        backgroundColor: 'rgba(33,29,22,0.1)',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: 'var(--data-purple)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.4,
        fill: true,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 2,
          max: 6,
          ticks: { color: 'rgba(33,29,22,0.5)', font: { size: 11 } },
          grid: { color: 'var(--surface-4)' }
        },
        x: {
          ticks: { color: 'rgba(33,29,22,0.5)', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });

  var spread = curve.spread2s10s;
  var spreadEl = document.getElementById('spread-status');
  var nativeSpread = spreadEl && spreadEl.dataset.aioMacroSpreadRenderer === 'native';
  if (!nativeSpread && spreadEl) spreadEl.textContent = spread == null ? '— (10Y - 2Y)' : (spread >= 0 ? '+' : '') + spread.toFixed(2) + '%p (10Y - 2Y)';
}

// ── Compute Economic Temperature ──
function computeEconomicTemperature() {
  let ld = window._liveData || {};
  function _tempLive(sym) {
    if (typeof _aioDecisionMetric === 'function') {
      var envelope = _aioDecisionMetric(sym, 'price', null);
      return envelope && envelope.allowedUse === true ? envelope.value : null;
    }
    var row = ld[sym];
    if (!row || row.price == null) return null;
    if (typeof row.price === 'boolean' || (typeof row.price === 'string' && row.price.trim() === '')) return null;
    var n = Number(row.price);
    return isFinite(n) ? n : null;
  }
  // P576/P713 계열 4번째 표면(2026-07-18): HYG 달러 가격 대신 FRED HY OAS(bp) 실측만 사용.
  //   HYG 가격은 듀레이션(금리) 노출이 섞여 있어 신용 레벨 판정에 부적합(Weinstein/MTF와 동일 원칙).
  var hyEvidence = null;
  try {
    var hyAudit = window.AIO && typeof window.AIO.getTradingDecisionInputEvidence === 'function' ? window.AIO.getTradingDecisionInputEvidence() : null;
    hyEvidence = hyAudit && hyAudit.rows && hyAudit.rows.find(function(row) { return row.id === 'hy-spread-bp'; });
  } catch(_) {}
  var hyOasBp = hyEvidence && hyEvidence.status === 'verified_current' && hyEvidence.allowedUse === 'decision'
    ? Number(hyEvidence.value) : null;
  var inputs = {
    VIX:_tempLive('^VIX'), TNX:_tempLive('^TNX'), FVX:_tempLive('^FVX'),
    WTI:_tempLive('CL=F'), DXY:_tempLive('DX-Y.NYB'), 'HY OAS':isFinite(hyOasBp) ? hyOasBp : null
  };
  var missing = Object.keys(inputs).filter(function(key) { return inputs[key] == null; });
  if (missing.length) {
    var emptyFill = document.getElementById('thermometer-fill');
    var emptyLabel = document.getElementById('thermometer-label');
    var emptyScore = document.getElementById('temp-score');
    var emptyNarrative = document.getElementById('temp-narrative');
    if (emptyFill) emptyFill.style.height = '0';
    if (emptyLabel) emptyLabel.textContent = '—';
    if (emptyScore) emptyScore.textContent = '—';
    if (emptyNarrative) {
      emptyNarrative.setAttribute('data-runtime-state', 'unavailable');
      emptyNarrative.setAttribute('data-operational-use', 'blocked');
      emptyNarrative.textContent = '경제 온도 산출 보류 · 필수 원천 미수신: ' + missing.join(', ');
    }
    return null;
  }
  var vix = inputs.VIX, tnx = inputs.TNX, fvx = inputs.FVX;
  var wti = inputs.WTI, dxy = inputs.DXY;
  hyOasBp = inputs['HY OAS'];

  // Calculate component scores (0-100 each)
  var vixScore = Math.max(0, Math.min(100, (30 - vix) * 2 + 50));  // Lower VIX = higher score
  var curveScore = (tnx - fvx) > 0.3 ? 70 : (tnx - fvx) > -0.1 ? 50 : 30;
  var oilScore = wti > 100 ? 20 : wti > 90 ? 40 : wti > 70 ? 60 : 80;
  var dxyScore = dxy > 108 ? 30 : dxy > 104 ? 50 : dxy < 100 ? 70 : 55;
  var creditScore = hyOasBp < 350 ? 60 : hyOasBp < 450 ? 50 : 40;  // Lower HY OAS(bp) = better credit

  // Weighted average: VIX 30%, Curve 25%, Oil 20%, DXY 15%, Credit 10%
  var temp = (vixScore * 0.30 + curveScore * 0.25 + oilScore * 0.20 + dxyScore * 0.15 + creditScore * 0.10);

  // v40.4: 교차변수 보정 — 단순 합산이 아닌 "관계" 인식
  // 트리플 긴축: 금리↑ + 달러↑ + 유가↑ 동시 → 추가 페널티
  var tripleHawkCount = 0;
  if (tnx > 4.5) tripleHawkCount++;
  if (dxy > 107) tripleHawkCount++;
  if (wti > 100) tripleHawkCount++;
  if (tripleHawkCount >= 3) temp = Math.max(10, temp - 12); // 트리플 긴축 페널티
  else if (tripleHawkCount >= 2) temp = Math.max(10, temp - 5);

  // VIX-신용스프레드 동조: 둘 다 악화 = 시스템 리스크 → 추가 페널티
  if (vix > 30 && hyOasBp > 450) temp = Math.max(5, temp - 8); // 주식+신용 동시 스트레스

  // 유가↑ + 커브 역전 = 스태그플레이션 최악 시나리오 → 강한 페널티
  if (wti > 100 && (tnx - fvx) < -0.1) temp = Math.max(5, temp - 10);

  // 달러↓ + VIX↓ = 리스크온 환경 → 보너스
  if (dxy < 100 && vix < 16) temp = Math.min(95, temp + 5);

  temp = Math.round(temp);

  // Update thermometer
  var fillEl = document.getElementById('thermometer-fill');
  var labelEl = document.getElementById('thermometer-label');
  var scoreEl = document.getElementById('temp-score');
  var narrativeEl = document.getElementById('temp-narrative');

  // v52.62 아이보리: 무지개(5색) → 3계열(red/ink/green)로 수렴 (원칙 §1)
  var _tempTone = temp > 75 ? '#b13a30' : temp > 50 ? '#57513f' : temp > 35 ? '#22754c' : '#211d16';
  if (fillEl) {
    var fillHeight = (temp / 100) * 100;
    fillEl.style.height = fillHeight + '%';
    fillEl.style.background = _tempTone;
  }

  if (labelEl) {
    labelEl.textContent = temp;
    labelEl.style.color = _tempTone;
  }

  if (scoreEl) scoreEl.textContent = temp;

  if (narrativeEl) {
    narrativeEl.setAttribute('data-operational-use', 'reference-only');
    narrativeEl.setAttribute('data-source-kind', 'derived-reference');
    var narrative = '';
    var _details = 'VIX ' + vix.toFixed(1) + '(' + vixScore + '점) · 금리곡선 ' + (tnx-fvx>0?'+':'') + (tnx-fvx).toFixed(2) + '%(' + curveScore + '점) · WTI $' + wti.toFixed(0) + '(' + oilScore + '점) · DXY ' + dxy.toFixed(1) + '(' + dxyScore + '점) · HY OAS ' + Math.round(hyOasBp) + 'bp(' + creditScore + '점)';
    if (temp >= 85) {
      narrative = '<b>과열 경고 (' + temp + '점)</b> — VIX·금리·유가·달러 조합이 위험선호 쪽으로 치우친 관측입니다. 이 점수는 과거 패턴이나 미래 조정을 보장하지 않으며, <b>수익 실현·현금 비중을 지시하는 신호가 아닙니다</b>. breadth·실적·신용·추세 지속성을 별도 확인하세요.<br><span style="font-size:11px;color:var(--text-muted);">산출: ' + _details + '</span>';
    } else if (temp >= 70) {
      narrative = ' <b>뜨거움 (' + temp + '점)</b> — 경제 호황·시장 낙관 쪽의 관측 조합입니다. 온도는 방향이나 매매를 보장하지 않으며, 추세·손실 한도·Fed 금리 방향을 별도 확인할 참고 레이어입니다.<br><span style="font-size:11px;color:var(--text-muted);">산출: ' + _details + '</span>';
    } else if (temp >= 50) {
      narrative = ' <b>정상 온도 (' + temp + '점)</b> — 긍정·부정 지표가 혼재한 관측입니다. 특정 섹터·자산에 대한 집중 여부와 분산·적립식 정책은 별도 위험 한도와 목표를 확인한 뒤 검토할 참고 사항입니다.<br><span style="font-size:11px;color:var(--text-muted);">산출: ' + _details + '</span>';
    } else if (temp >= 30) {
      narrative = ' <b>차가움 (' + temp + '점)</b> — 경기 둔화 쪽의 관측 신호입니다. 방어적 자산·성장 자산의 상대위험과 현금 정책은 개인 제약을 반영해 검토하고, VIX·HY 스프레드·거래량의 개선 여부를 확인하세요.<br><span style="font-size:11px;color:var(--text-muted);">산출: ' + _details + '</span>';
    } else {
      narrative = ' <b>극도로 차가움 (' + temp + '점)</b> — 경기침체에 가까운 지표 조합의 관측입니다. 레버리지·포지션 규모·유동성 조건은 개인 위험 한도와 실행 가능성을 확인해 별도 검토하며, 바닥 확인 신호(VIX·HY 스프레드·거래량)를 관찰하는 참고 레이어입니다.<br><span style="font-size:11px;color:var(--text-muted);">산출: ' + _details + '</span>';
    }
    narrativeEl.innerHTML = '<div style="font-size:12px;line-height:1.7;">' + narrative + '</div>';
  }
}

// ── Macro Regime Pill ──
function updateMacroRegimePill() {
  let ld = window._liveData || {};
  var vix = _ldSafe('^VIX','price');
  var tnx = _ldSafe('^TNX','price');
  var curve = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function'
    ? window.AIO.getUsTreasuryCurveEvidence() : {};
  var spyChg = ld['SPY'] ? (ld['SPY'].pct != null ? ld['SPY'].pct : 0) : 0;
  var wti = _ldSafe('CL=F','price');
  var dxy = _ldSafe('DX-Y.NYB','price');

  var pill = document.getElementById('macro-regime-pill');
  if (!pill) return;

  var spread = curve.spread2s10s;
  var score = 50;  // Start at neutral

  // Score calculation (higher = more risk-on)
  score += (20 - vix) * 2;  // Lower VIX = higher score
  if (spread != null && spread > 0.5) score += 10;
  else if (spread != null && spread < -0.1) score -= 20;
  score += Math.max(-10, Math.min(10, (80 - wti)));  // Lower oil = higher score
  score += spyChg * 10;  // Trend matters
  if (dxy > 108) score -= 10;
  else if (dxy < 100) score += 10;

  // Determine regime based on score
  var regimeDetail = document.getElementById('macro-regime-detail');
  if (score > 75) {
    pill.textContent = ' Risk-On · 낙관 모드';
    pill.className = 'status-pill sp-risk-on';
    if (regimeDetail) regimeDetail.textContent = '관측 입력의 위험선호 성격이 상대적으로 강한 구간입니다. 매수 지시가 아니며 이익·수급·신용과 지속성을 별도 확인합니다.';
  } else if (score > 50) {
    pill.textContent = ' Mixed · 혼조세';
    pill.className = 'status-pill sp-risk-off';
    if (regimeDetail) regimeDetail.textContent = '긍정·부정 시그널이 혼재. 방향성 베팅보다 종목 선별이 중요한 국면. 분산투자 유지, 한쪽에 올인 금지.';
  } else if (score > 25) {
    pill.textContent = ' Cautious · 경계 모드';
    pill.className = 'status-pill sp-risk-off';
    if (regimeDetail) regimeDetail.textContent = '매크로 역풍이 불고 있습니다. 현금·방어주 비중↑. 공격적 매수는 변수(VIX·유가)가 호전될 때까지 보류. "인내가 수익"인 구간.';
  } else {
    pill.textContent = ' Risk-Off · 공포 확산';
    pill.className = 'status-pill sp-risk-off';
    if (regimeDetail) regimeDetail.textContent = '전면 방어 태세. 현금·금·장기국채가 최고 자산. 하지만 극단적 공포는 역설적으로 바닥의 전조 — 바닥확인 체크리스트(VIX 스파이크·거래량 클라이맥스·역전해소)를 주시하세요.';
  }
}

// ── WTI-Brent Spread (Enhanced with interpretation) ──
function updateWtiBrentSpread() {
  let ld = window._liveData || {};
  var wti = _ldSafe('CL=F','price');
  var brent = _ldSafe('BZ=F','price');
  var el = document.getElementById('wti-brent-spread');
  if (!el || !wti || !brent) return;
  var spread = parseFloat((brent - wti).toFixed(2));
  el.textContent = '$' + spread.toFixed(2);

  // Interpretation: Positive spread (Brent > WTI) typically means Europe premium or supply issues
  // Negative spread could mean US supply surplus
  if (spread > 8) {
    el.style.color = 'var(--data-red)';
    el.title = '심각한 스프레드($' + spread.toFixed(1) + ') · 지정학 프리미엄(호르무즈/홍해) 또는 유럽 공급 위기 · 에너지주↑ 항공운송↓ · 유가관리카드(SPR방출/이란제재완화) 발동 가능성 모니터링';
  } else if (spread > 5) {
    el.style.color = 'var(--data-red)';
    el.title = '높은 스프레드($' + spread.toFixed(1) + ') · 국제 공급 불안 반영 · 미국은 자체생산 완충 중 · OPEC+ 감산 영향';
  } else if (spread > 3) {
    el.style.color = 'var(--data-amber)';
    el.title = '중간 수준($' + spread.toFixed(1) + ') · 일반적 프리미엄 범위 · 수급 균형 상태';
  } else {
    el.style.color = 'var(--data-green)';
    el.title = '낮은 스프레드($' + spread.toFixed(1) + ') · 글로벌 공급 안정 · 지정학 프리미엄 해소 신호';
  }
}

// P712/R340: 기술 페이지의 Stage·멀티타임프레임 판정은 관측 OHLCV 스냅샷만 사용한다.
// 과거 구현은 현재가·당일 등락률·정적 breadth를 30주선/주간·월간 추세의 대용치로 사용했다.
updateWeinsteinStage = function(snapshot) {
  var snap = snapshot || (window._aioTechnicalPageSnapshot && window._aioTechnicalPageSnapshot.snapshot) || null;
  var complete = !!(snap && snap.ok && snap.bars >= 200 && snap.sma50 && snap.sma100 && snap.sma200 && snap.stageEstimate);
  var analysis = document.getElementById('ws-analysis');
  for (var i = 1; i <= 4; i++) {
    var row = document.getElementById('ws-stage' + i);
    if (!row) continue;
    row.style.background = 'transparent'; row.style.margin = '0'; row.style.paddingLeft = '0'; row.style.paddingRight = '0';
    var label = row.querySelector('span:nth-child(2)');
    if (label) label.textContent = label.textContent.replace(' — 현재', '');
  }
  if (!complete) {
    if (analysis) analysis.innerHTML = '<div style="font-weight:700;color:var(--text-muted);margin-bottom:4px;">Weinstein Stage 판정 보류</div>' +
      '<div style="font-size:12px;color:var(--text-muted);line-height:1.7;">최소 200거래일 OHLCV와 50·100·200일 이동평균이 모두 필요합니다. 현재가·당일 등락률·정적 시장폭으로 Stage를 추정하지 않습니다.</div>';
    return { available: false, reason: 'observed_ohlcv_200_required' };
  }
  var stageMap = {
    STAGE_2_ADVANCE: { stage: 2, desc: '상승 추세', color: 'var(--data-green)' },
    STAGE_3_TOPPING: { stage: 3, desc: '천장 형성 가능성', color: 'var(--data-amber)' },
    STAGE_4_DECLINE: { stage: 4, desc: '하락 추세', color: 'var(--data-red)' },
    STAGE_4_OR_BASE_REPAIR: { stage: 4, desc: '하락 또는 기반 복구 구간', color: 'var(--data-red)' },
    STAGE_1_OR_3_TRANSITION: { stage: 1, desc: '1·3단계 전환 구간', color: 'var(--data-cyan)' }
  };
  var state = stageMap[snap.stageEstimate] || { stage: 1, desc: '전환 구간', color: 'var(--text-muted)' };
  var active = document.getElementById('ws-stage' + state.stage);
  if (active) {
    active.style.background = 'var(--surface-2)'; active.style.borderRadius = '6px'; active.style.margin = '0 -12px'; active.style.paddingLeft = '12px'; active.style.paddingRight = '12px';
    var activeLabel = active.querySelector('span:nth-child(2)');
    if (activeLabel) activeLabel.textContent = activeLabel.textContent.replace(' — 현재', '') + ' — 현재';
  }
  if (analysis) analysis.innerHTML = '<div style="font-weight:700;color:' + state.color + ';margin-bottom:4px;">관측 OHLCV 기반: ' + state.stage + '단계 — ' + state.desc + '</div>' +
    '<div style="font-size:12px;color:var(--text-muted);line-height:1.7;">기준 ' + (snap.time || '최근 거래일') + ' · ' + snap.bars + '거래일 · 종가 ' + Number(snap.price).toFixed(2) + '<br>' +
    '50일선 ' + Number(snap.sma50).toFixed(2) + ' · 100일선 ' + Number(snap.sma100).toFixed(2) + ' · 200일선 ' + Number(snap.sma200).toFixed(2) + ' · 50일선 기울기 ' + (snap.sma50Rising ? '상승' : '비상승') + '<br>' +
    'Stage는 보조 분류이며 단독 매매 신호가 아닙니다.</div>';
  return { available: true, stage: state.stage, estimate: snap.stageEstimate, asOf: snap.time };
};

updateMTF = function(snapshot) {
  var snap = snapshot || (window._aioTechnicalPageSnapshot && window._aioTechnicalPageSnapshot.snapshot) || null;
  var root = document.getElementById('mtf-analysis');
  var verdictEl = document.getElementById('mtf-verdict-text');
  if (!root) return;
  if (!snap || !snap.ok) {
    root.innerHTML = '<div style="grid-column:1/-1;padding:16px 18px;color:var(--text-muted);font-size:12px;">멀티타임프레임 판정 보류 · 관측 OHLCV 미수신</div>';
    if (verdictEl) { verdictEl.style.color = 'var(--text-muted)'; verdictEl.textContent = '멀티타임프레임 판정 보류 · 관측 OHLCV 미수신'; }
    return { available: false };
  }
  // RM-03 item 2: single-implementation call — daily/weekly/medium trend classification lives in
  // src/domain/technical/stage.js (deriveMultiTimeframeView), exposed via window.AIO_ARCH so this
  // legacy renderer and any native consumer share one model (R352/F-03: no parallel formula).
  var _mtfFn = window.AIO_ARCH && typeof window.AIO_ARCH.deriveMultiTimeframeView === 'function' ? window.AIO_ARCH.deriveMultiTimeframeView : null;
  var view = _mtfFn ? _mtfFn(snap) : { available: true, daily: 'pending', weekly: 'pending', medium: 'pending' };
  var weeklyRaw = snap.weeklyCtx && snap.weeklyCtx.wTrend;
  var DAILY_LABELS = { up: '상승', down: '하락', neutral: '중립', pending: '판정 보류' };
  var TREND_LABELS = { up: '상승', down: '하락', mixed: '혼조', pending: '판정 보류' };
  var rows = [
    { label: '일간', value: DAILY_LABELS[view.daily] || '판정 보류', detail: '관측 일간 수익률 ' + snap.dayGainPct.toFixed(2) + '%' },
    { label: '주간', value: TREND_LABELS[view.weekly] || '판정 보류', detail: weeklyRaw ? '주봉 집계 ' + weeklyRaw : '주봉 집계 부족' },
    { label: '중기', value: TREND_LABELS[view.medium] || '판정 보류', detail: snap.bars >= 200 ? snap.longMAState : '200거래일 미만' },
    { label: '분기', value: '판정 보류', detail: '분기 시계열·분기 추세 근거 미수신' }
  ];
  root.innerHTML = rows.map(function(row, idx) {
    var color = row.value === '상승' ? 'var(--data-green)' : row.value === '하락' ? 'var(--data-red)' : 'var(--text-muted)';
    return '<div style="padding:16px 18px;' + (idx < rows.length - 1 ? 'border-right:1px solid var(--border-subtle);' : '') + '"><div style="font-size:12px;color:var(--text-dim);margin-bottom:5px;">' + row.label + '</div><div style="font-size:14px;font-weight:600;color:' + color + ';">' + row.value + '</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.4;">' + row.detail + '</div></div>';
  }).join('');
  // P746 후속(2026-07-21, 사용자 결정): mtf-verdict-text는 위 mtf-analysis 4열과 별개 위젯이지만
  // 데이터 소스는 새로 만들지 않는다 — 같은 view(daily/weekly/medium)에서 짧은 한줄 요약만 뽑는다.
  // quarterly는 deriveMultiTimeframeView가 항상 'pending'만 반환하므로(분기 시계열 미구현) 요약에서 제외.
  if (verdictEl) {
    var verdictText, verdictColor;
    // medium(중기)은 200거래일 미만이면 항상 'pending'(classifyMediumTrend) — 바로 위 Weinstein
    // Stage 위젯이 같은 200거래일 기준으로 판정을 보류하는 것과 동일한 문턱을 맞춘다. 일간·주간만
    // 있고 중기가 없는 상태로 "정렬" 문구를 내보내면 이 페이지의 다른 위젯과 다른 신뢰 기준을 쓰는
    // 셈이라 일부러 통일했다.
    if (view.medium === 'pending') {
      verdictText = '판정에 필요한 관측 데이터가 부족합니다(200거래일 이상 OHLCV 필요 — Weinstein Stage와 동일 기준).';
      verdictColor = 'var(--text-muted)';
    } else {
      var mtfDims = [view.daily, view.weekly, view.medium];
      var mtfUp = mtfDims.filter(function(d) { return d === 'up'; }).length;
      var mtfDown = mtfDims.filter(function(d) { return d === 'down'; }).length;
      if (mtfUp === mtfDims.length) {
        verdictText = '일간·주간·중기 추세가 모두 상승으로 정렬되어 있습니다.';
        verdictColor = 'var(--data-green)';
      } else if (mtfDown === mtfDims.length) {
        verdictText = '일간·주간·중기 추세가 모두 하락으로 정렬되어 있습니다.';
        verdictColor = 'var(--data-red)';
      } else {
        verdictText = '시간대별 추세가 엇갈립니다(일간·주간·중기 방향이 일치하지 않음) — 방향성이 확인되기 전까지 보수적 접근을 권장합니다.';
        verdictColor = 'var(--data-amber)';
      }
    }
    verdictEl.style.color = verdictColor;
    verdictEl.textContent = verdictText;
  }
  return { available: true, asOf: snap.time, rows: rows };
};

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS: Technical & Macro Pages
// ═══════════════════════════════════════════════════════════════

// Technical page init
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿) — 이 블록 끝(html-tech-macro-live)까지.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-technical-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'technical') {
    setTimeout(function() {
      computeMarketHealth();
      updateTechIndicators();
      updateSRLevels();
      updateWeinsteinStage();
      updateMTF();
      // P1164/B02: 한 분석 렌더의 예외가 같은 핸들러의 다음 렌더(차트 로드)를 취소하지 않게 경계를 둔다.
      try { updatePatternSignals(); } catch(e) { try { _aioLog('warn', 'technical', 'PatternSignals error: ' + (e && e.message || e)); } catch(_) {} }
      if (typeof loadTechCandleChart === 'function') loadTechCandleChart(window._aioTechCurrentSymbol || 'SPY');
    }, 300);
  }
});

// macro 페이지 "지금·라이브" Fed 정책 사이클 카드의 S&P.
function _aioSyncMacroLiveSpxMini() {
  var el = document.getElementById('macro-now-spx');
  if (!el) return;
  var live = window._liveData && window._liveData['^GSPC'];
  if (live && typeof live.price === 'number' && isFinite(live.price)) {
    el.textContent = live.price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    el.title = '';
  } else {
    el.textContent = '—';
    el.title = '라이브 원천 미수신';
  }
}

// Macro page init
_aioPageBus.register('html-macro-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'macro') {
    setTimeout(function() {
      generateMacroStoryline();
      updateMacroRegimePill();
      updateWtiBrentSpread();
      renderYieldCurve();
      computeEconomicTemperature();
      _aioSyncMacroLiveSpxMini();
    }, 300);
  }
});

// Live quote updates for technical/macro/breadth pages
_aioPageBus.register('html-tech-macro-live', 'aio:liveQuotes', function() {
  var techPage = document.getElementById('page-technical');
  if (techPage && techPage.classList.contains('active')) {
    computeMarketHealth();
    updateTechIndicators();
    updateSRLevels();
    updateWeinsteinStage();
    updateMTF();
    try { updatePatternSignals(); } catch(e) { try { _aioLog('warn', 'technical', 'PatternSignals error: ' + (e && e.message || e)); } catch(_) {} }
  }
  var macroPage = document.getElementById('page-macro');
  if (macroPage && macroPage.classList.contains('active')) {
    generateMacroStoryline();
    updateMacroRegimePill();
    updateWtiBrentSpread();
    renderYieldCurve();
    computeEconomicTemperature();
    _aioSyncMacroLiveSpxMini();
  }
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

