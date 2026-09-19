// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 3: UI START (실제 분할 적용 v48.26)                ║
// ║  책임: Render + Page Router + Charts + Filters + Gauges                   ║
// ║  의존성: MODULE 1 (stores) + MODULE 2 (data fetch/score/translate)        ║
// ║  Chart instances: 페이지별 레지스트리에서 생성·정리                      ║
// ║  주의: MODULE 1/2의 함수 호출은 모두 이벤트/타이머 콜백 내부 (즉시 호출 X) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// AAII Chart.js stacked bar + P/C sparkline
// ── Market Breadth 전용 페이지 Charts ─────────────────────────────────
let bpChartsInitialized = false;
const bpChartInstances = {};

// v38.9: 미너비니 랠리 품질 동적 판별
function updateRallyQualityVerdict() {
  var el = document.getElementById('rally-quality-verdict');
  if (!el) return;
  var b5 = (typeof window._breadth5 === 'number') ? window._breadth5 : null;
  var b20 = (typeof window._breadth200 === 'number') ? window._breadth200 : null;
  var b50 = (typeof window._breadth50 === 'number') ? window._breadth50 : null;
  if (!b5) { el.textContent = '시장폭 데이터 수신 대기 중...'; return; }

  var verdict = '', color = '', bg = '';
  if (b5 > 70 && b50 > 60) {
    verdict = ' <b>브레드스 쓰러스트 수준</b> — 5SMA ' + b5.toFixed(0) + '% · 50SMA ' + b50.toFixed(0) + '%. 극히 높은 참여율. 과거 바닥 확인 국면에서 관측되던 조합(예측 아님).';
    color = '#00e5a0'; bg = 'var(--data-green-faint)';
  } else if (b5 > 50 && b20 > 40) {
    verdict = ' <b>고품질 랠리</b> — 5SMA ' + b5.toFixed(0) + '% · 20SMA ' + b20.toFixed(0) + '%. 광범위 참여. Follow-through 진행 중 — 리테스트 통과 여부가 다음 관찰 포인트.';
    color = '#00bcd4'; bg = 'var(--data-cyan-light)';
  } else if (b5 > 30) {
    verdict = ' <b>품질 미확인 랠리</b> — 5SMA ' + b5.toFixed(0) + '%. 제한적 참여. 숏커버링 주도 가능성. 첫 며칠은 노이즈 — 후속 확인 필요. 관망 유지.';
    color = '#ffa31a'; bg = 'var(--data-amber-faint)';
  } else {
    verdict = ' <b>과매도/숏커버링</b> — 5SMA ' + b5.toFixed(0) + '%. 소수 종목만 반등. 가장 많이 빠진 종목이 가장 많이 오르는 저품질 패턴. 신규 매수 중단. RS 상위 종목 워치리스트만 구축.';
    color = '#ff5b50'; bg = 'var(--data-red-faint)';
  }
  el.innerHTML = verdict;
  el.style.borderColor = color;
  el.style.background = bg;
}

// v42.4: 브레드쓰 바 동적 갱신 — signal 페이지 + breadth 페이지 NDX 카드
// v49.64 Codex P332: 20-SMA 70%+ amber override (과열 신호 — v49.63 index.html 정적 변경의 동적 보강)
function updateBreadthBars() {
  var currentBreadth = window.AIO && typeof window.AIO.getCurrentBreadthEvidence === 'function' ? window.AIO.getCurrentBreadthEvidence() : { available:false };
  if (!currentBreadth.available) {
    var pendingText = '현재 원천 미수신';
    [['breadth-header-badge','판정 보류'],['breadth-diag-signal','판정 보류'],['breadth-5sma-big','—'],['breadth-20sma-big','—'],['breadth-50sma-big','—'],['breadth-5sma-label',pendingText],['breadth-20sma-label',pendingText],['breadth-50sma-label',pendingText],['breadth-5sma-freshness',pendingText],['breadth-20sma-freshness',pendingText],['breadth-50sma-freshness',pendingText],['breadth-advance-ratio','—'],['breadth-signal-val','—']].forEach(function(p){ var el=document.getElementById(p[0]); if(el && !(typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el))){ el.textContent=p[1]; el.style.color='var(--text-muted)'; } });
    ['breadth-5sma-bar','breadth-20sma-bar','breadth-50sma-bar','bb-5sma-bar','bb-20sma-bar','bb-50sma-bar'].forEach(function(id){ var el=document.getElementById(id); if(el && !(typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el))) el.style.width='0%'; });
    var stageEl = document.getElementById('breadth-stage-summary');
    if (stageEl && stageEl.dataset.aioBreadthStageRenderer !== 'native') { stageEl.textContent = '— 20·50일선 breadth 미수신'; stageEl.style.color = 'var(--text-muted)'; }
    var mcEl = document.getElementById('breadth-mcclellan-summary');
    if (mcEl && mcEl.dataset.aioBreadthMcclellanRenderer !== 'native') { mcEl.innerHTML = '— <span style="font-weight:500;color:var(--text-dim);">A/D 시계열 미수신</span>'; mcEl.setAttribute('data-mcclellan-signal','unavailable'); }
    var diagEl = document.getElementById('breadth-diag-text');
    if (diagEl && diagEl.dataset.aioBreadthDiagnosticRenderer !== 'native') diagEl.textContent = '현재 5/20/50일선 breadth 및 A/D 시계열 원천이 없어 종합 진단을 보류합니다.';
    if (typeof window._aioSyncBreadth50Readout === 'function') window._aioSyncBreadth50Readout();
    return;
  }
  window._breadth5 = currentBreadth.sma5;
  window._breadth20 = currentBreadth.sma20;
  window._breadth200 = currentBreadth.sma20;
  window._breadth50 = currentBreadth.sma50;
  var diagSummary = '5/20/50일선 상회 ' + Math.round(currentBreadth.sma5) + '/' + Math.round(currentBreadth.sma20) + '/' + Math.round(currentBreadth.sma50) + '%';
  var breadthHeader = document.getElementById('breadth-header-badge');
  if (breadthHeader) { breadthHeader.textContent = '현재 관측'; breadthHeader.style.color = 'var(--data-green)'; }
  var breadthDiagSignal = document.getElementById('breadth-diag-signal');
  if (breadthDiagSignal && breadthDiagSignal.dataset.aioBreadthDiagnosticRenderer !== 'native') { breadthDiagSignal.textContent = diagSummary; breadthDiagSignal.style.color = 'var(--text-primary)'; }
  // P746 후속(2026-07-21, Fable 어드바이저 2차 설계): breadth-stage-summary는 다일 breadth 이력이
  // 전혀 없어(history.json에 breadth 필드 자체가 없음 — reconciliation-status.json도 이 항목을
  // "BLOCKED"로 이미 기록 중) Weinstein류 추세국면 "Stage"를 만들 수 없다는 결론에 따라, 오늘
  // 시점의 참여 수준(level: broad/neutral/narrow) + 가능하면 1스텝 delta 방향만 정직하게 표시한다
  // (delta 없으면 방향 생략, 조작하지 않음). 그래서 UI 라벨도 "Weinstein Stage"에서 "시장 참여도"로
  // 바꿨다(index.html) — 아래 로직은 그 이름에 맞는 산식이다.
  var stageSummaryEl = document.getElementById('breadth-stage-summary');
  if (stageSummaryEl && stageSummaryEl.dataset.aioBreadthStageRenderer !== 'native') {
    var prevDeltaRef = (typeof _aioGetPrevDeltaRef === 'function') ? _aioGetPrevDeltaRef() : null;
    var sma20Delta = (prevDeltaRef && typeof currentBreadth.sma20 === 'number' && typeof prevDeltaRef.breadth20sma === 'number') ? currentBreadth.sma20 - prevDeltaRef.breadth20sma : null;
    var sma5Delta = (prevDeltaRef && typeof currentBreadth.sma5 === 'number' && typeof prevDeltaRef.breadth5sma === 'number') ? currentBreadth.sma5 - prevDeltaRef.breadth5sma : null;
    var participationFn = window.AIO_ARCH && typeof window.AIO_ARCH.classifyBreadthParticipation === 'function' ? window.AIO_ARCH.classifyBreadthParticipation : null;
    var participation = participationFn ? participationFn({ sma20: currentBreadth.sma20, sma50: currentBreadth.sma50, sma20Delta: sma20Delta, sma5Delta: sma5Delta }) : { available: false };
    if (!participation.available) {
      stageSummaryEl.textContent = '— 20·50일선 breadth 미수신';
      stageSummaryEl.style.color = 'var(--text-muted)';
    } else {
      var LEVEL_LABEL = { broad: '광범위 참여', neutral: '중립', narrow: '쏠림 장세' };
      var LEVEL_COLOR = { broad: 'var(--data-green)', neutral: 'var(--data-amber)', narrow: 'var(--data-red)' };
      var DIRECTION_SUFFIX = { rising: ' · 확대', falling: ' · 위축', flat: ' · 보합' };
      stageSummaryEl.textContent = LEVEL_LABEL[participation.level] + (participation.direction ? DIRECTION_SUFFIX[participation.direction] : '');
      stageSummaryEl.style.color = LEVEL_COLOR[participation.level];
    }
  }
  var breadthDiagText = document.getElementById('breadth-diag-text');
  if (breadthDiagText && breadthDiagText.dataset.aioBreadthDiagnosticRenderer !== 'native') breadthDiagText.textContent = diagSummary + ' · ' + (currentBreadth.source || 'AIO screener universe') + '의 현재 관측입니다. 시장 참여도는 오늘 수준(추세국면 아님), McClellan은 A/D 시계열이 없어 판정을 보류합니다.';
  var breadthAdvance = document.getElementById('breadth-advance-ratio');
  if (breadthAdvance && breadthAdvance.dataset.aioBreadthSignalRenderer !== 'native') breadthAdvance.textContent = currentBreadth.advanceRatio != null ? (currentBreadth.advanceRatio * 100).toFixed(1) + '%' : '—';
  var breadthSignal = document.getElementById('breadth-signal-val');
  if (breadthSignal && breadthSignal.dataset.aioBreadthSignalRenderer !== 'native') breadthSignal.textContent = '현재 5/20/50SMA 관측 · 방향 예측 아님';
  function _bbRegime(v) {
    if (typeof NARRATIVE_ENGINE !== 'undefined' && NARRATIVE_ENGINE.getBreadthRegime) {
      var reg = NARRATIVE_ENGINE.getBreadthRegime(v);
      if (reg && reg.color && reg.label) return reg;
    }
    return v >= 70 ? { level:'broad', label:'광폭 랠리', color:'#00e5a0' } :
           v >= 55 ? { level:'healthy', label:'건강', color:'#ffa31a' } :
           v >= 40 ? { level:'narrow', label:'좁은 랠리', color:'#ffa31a' } :
                     { level:'fearful', label:'공포 영역', color:'#ff5b50' };
  }
  function _bbToneBg(color) {
    if (color === '#00e5a0') return 'var(--data-green-mid)';
    if (color === '#ff5b50') return 'var(--data-red-mid)';
    return 'var(--data-amber-mid)';
  }
  function _bbColor(v) { return _bbRegime(v).color; }
  function _bbBg(v)    { return _bbToneBg(_bbRegime(v).color); }
  function _bbLbl(v)   { return _bbRegime(v).label; }
  // v49.64 Codex P332: 20-SMA 전용 라벨 — 70%+ "과열" amber override (강세/과열 구분)
  function _bb20smaLbl(v) {
    if (v >= 70) return '과열';
    if (v >= 60) return '강세';
    if (v >= 50) return '중립↑';
    if (v >= 35) return '중립↓';
    return '약세';
  }
  function _bb20smaColor(v) {
    if (v >= 70) return '#ffa31a';            // amber: 과열
    return _bbColor(v);
  }
  function _bb20smaBg(v) {
    if (v >= 70) return 'var(--data-amber-mid)';
    return _bbBg(v);
  }
  var rows = [
    { bar:'bb-5sma-bar',  val:'bb-5sma-val',  badge:'bb-5sma-badge',  v: window._breadth5 },
    { bar:'bb-20sma-bar', val:'bb-20sma-val', badge:'bb-20sma-badge', v: (window._breadth200 != null ? window._breadth200 : window._breadth20), is20Sma: true }, // v50.17: _breadth200(레거시 20일선) 미설정 시 _breadth20 폴백
    { bar:'bb-50sma-bar', val:'bb-50sma-val', badge:'bb-50sma-badge', v: window._breadth50 },
  ];
  rows.forEach(function(r) {
    if (r.v == null) return;
    // v49.64 Codex P332: 20-SMA는 amber override 적용 (70%+ 과열 신호)
    var c   = r.is20Sma ? _bb20smaColor(r.v) : _bbColor(r.v);
    var bg  = r.is20Sma ? _bb20smaBg(r.v)    : _bbBg(r.v);
    var lbl = r.is20Sma ? _bb20smaLbl(r.v)   : _bbLbl(r.v);
    var barEl = document.getElementById(r.bar), valEl = document.getElementById(r.val), bdgEl = document.getElementById(r.badge);
    if (barEl)  { barEl.style.width = r.v + '%'; barEl.style.background = c; }
    if (valEl)  { valEl.textContent = r.v + '%'; valEl.style.color = c; }
    if (bdgEl)  { bdgEl.textContent = lbl; bdgEl.style.color = c; bdgEl.style.background = bg; }
  });
  // breadth 페이지 NDX 카드
  [ ['bp-ndx5-val', window._breadthNDX5], ['bp-ndx20-val', window._breadthNDX20], ['bp-ndx50-val', window._breadthNDX50] ]
    .forEach(function(p) {
      var el = document.getElementById(p[0]);
      if (el && !(typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el)) && p[1] != null) { el.textContent = p[1] + '%'; el.style.color = _bbColor(p[1]); }
    });
  // v50.17→v52.40: breadth 페이지 50SMA 막대(width) + 해석 readout 동적 갱신.
  // P562/R253이 큰 숫자·막대·readout을 DATA_SNAPSHOT.breadth50sma 단일 소스로 통일했던 로직을
  // v52.40(P655/EF-02d)에서 window._aioSyncBreadth50Readout()(js/aio-core.js)로 추출 — applyDataSnapshot()도
  // 같은 함수를 호출해 Chart.js 로드 여부와 무관하게 항상 동기화되게 함(중복 정의 방지, R276 정신).
  if (typeof window._aioSyncBreadth50Readout === 'function') window._aioSyncBreadth50Readout();
}

function initBreadthPage(forceReinit) {
  if (typeof window._aioRenderValueSlot === 'function') {
    ['breadth-new-highs','breadth-new-lows','breadth-hl-ratio'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) window._aioRenderValueSlot(el, 'na', null, { text:'해당 없음', reason:'NYSE 신고가/신저가 검증 원천 미수신' });
    });
  }
  renderStaleWarning('page-breadth');
  var evidence = window.AIO && typeof window.AIO.getCurrentBreadthEvidence === 'function' ? window.AIO.getCurrentBreadthEvidence() : { available:false };
  if (!evidence.available) {
    window._breadth5 = window._breadth20 = window._breadth50 = window._breadth200 = null;
    window._breadthSeries = window._breadthLabels = null;
    updateBreadthBars();
    ['breadth-5sma','breadth-20sma','breadth-50sma'].forEach(function(key) {
      document.querySelectorAll('[data-snap="' + key + '"]').forEach(function(el) {
        if (typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el)) return;
        el.textContent = '—';
      });
    });
  } else {
    window._breadth5 = evidence.sma5;
    window._breadth20 = window._breadth200 = evidence.sma20;
    window._breadth50 = evidence.sma50;
    [['breadth-5sma-label',evidence.sma5,false],['breadth-20sma-label',evidence.sma20,true],['breadth-50sma-label',evidence.sma50,false]].forEach(function(p) {
      var el = document.getElementById(p[0]);
      if (!el || (typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el))) return;
      el.textContent = p[2] ? _bb20smaLbl(p[1]) : _bbLbl(p[1]);
      el.style.color = p[2] ? _bb20smaColor(p[1]) : _bbColor(p[1]);
    });
    var asOf = evidence.ts ? new Date(evidence.ts).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) : '현재';
    ['breadth-5sma-freshness','breadth-20sma-freshness','breadth-50sma-freshness'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !(typeof window._aioIsNativeBreadthElement === 'function' && window._aioIsNativeBreadthElement(el))) el.textContent = '관측: ' + asOf + ' · ' + (evidence.source || 'AIO screener universe');
    });
    updateBreadthBars();
    if (typeof window._aioSyncBreadth50Readout === 'function') window._aioSyncBreadth50Readout();
  }

  var nativeBreadthPage = document.getElementById('page-breadth');
  var nativeBreadthCharts = !!(nativeBreadthPage && nativeBreadthPage.dataset.aioArchitectureRenderer === 'native');
  if (!nativeBreadthCharts) Object.keys(bpChartInstances).forEach(function(k) { try { bpChartInstances[k].destroy(); } catch(_) {} delete bpChartInstances[k]; });
  ['bp-ad-ratio-chart','bp-5ma-chart','bp-20ma-chart','bp-50ma-chart'].forEach(function(id) {
    var canvas = document.getElementById(id);
    if (!canvas) return;
    if (canvas.dataset.aioBreadthChartRenderer === 'native') return;
    canvas.setAttribute('data-source-kind','unavailable');
    canvas.setAttribute('data-operational-use','blocked');
    canvas.setAttribute('title','브레드쓰 과거 시계열 미수신 — 현재 단면값만 표시');
  });
  if (!nativeBreadthCharts) window._breadthSeries = window._breadthLabels = null;

  var priceCanvas = document.getElementById('bp-price-chart');
  if (priceCanvas && priceCanvas.dataset.aioBreadthChartRenderer === 'native') { bpChartsInitialized = true; return; }
  var spxSeries = typeof _aioHistorySeries === 'function' ? _aioHistorySeries('spx', 5) : null;
  if (priceCanvas && spxSeries && typeof Chart === 'function') {
    var rows = spxSeries.slice(-60);
    priceCanvas.setAttribute('data-source-kind','server-history');
    priceCanvas.setAttribute('data-source-label','public-data/history.json:spx');
    bpChartInstances.price = new Chart(priceCanvas, {
      type:'line',
      data:{labels:rows.map(function(p){return String(p.date).slice(5).replace('-','/');}),datasets:[{label:'S&P 500',data:rows.map(function(p){return p.value;}),borderColor:'#00bcd4',borderWidth:2,pointRadius:0,tension:0.25,fill:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:7}},y:{ticks:{maxTicksLimit:5}}}}
    });
  } else if (priceCanvas) {
    priceCanvas.setAttribute('data-source-kind','unavailable');
    priceCanvas.setAttribute('title','S&P 500 히스토리 미수신');
  }
  bpChartsInitialized = true;
}

function _aioGetKstDateParts(input) {
  var date = input instanceof Date ? input : new Date(input == null ? Date.now() : input);
  var parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  var out = {};
  parts.forEach(function(part) {
    if (part.type !== 'literal') out[part.type] = part.value;
  });
  var dayMap = { Sun:'일', Mon:'월', Tue:'화', Wed:'수', Thu:'목', Fri:'금', Sat:'토' };
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    weekday: dayMap[out.weekday] || out.weekday,
    isoDate: out.year + '-' + out.month + '-' + out.day,
    dateStr: out.year + '.' + out.month + '.' + out.day
  };
}
window.AIO = window.AIO || {};
window.AIO.getKstDateParts = _aioGetKstDateParts;

// ── 앱 시작 시 시세 초기화 ────────────────────────────────────────
/* v20: DOMContentLoaded Handler #1 - Core Data Init */
document.addEventListener('DOMContentLoaded', () => {
  // v34.2: APP_VERSION 단일 소스 → title + 배지 자동 반영
  if (typeof APP_VERSION === 'string') {
    document.title = 'AIO Screener ' + APP_VERSION + ' — 올인원 투자 터미널';
    var vBadge = document.getElementById('app-version-badge');
    if (vBadge) vBadge.textContent = APP_VERSION;
  }

  // v48.23 (P3-1): AIO 네임스페이스 최종 바인딩 — 모든 모듈 정의 후
  try { if (window.AIO && typeof window.AIO._bindCore === 'function') window.AIO._bindCore(); } catch(_){}

  // 날짜 자동 업데이트
  const todayDisp = _aioGetKstDateParts(new Date()).dateStr;
  const dlEl = document.getElementById('home-date-label');
  if (dlEl) dlEl.textContent = todayDisp + ' KST · 실시간: 시세·뉴스·F&G  |  정적: MA·Breadth·CP리스크(주1회 갱신)';

  // v30.12 P4: 이전 번역 캐시 복원 (새로고침 시 재번역 방지)
  var _tcRestored = _tcLoadFromStorage();
  if (_tcRestored > 0) console.log('[AIO v30.12] 번역 캐시 ' + _tcRestored + '건 복원됨');

  // v46.10: localStorage 가용 여부 감지 (Safari 개인정보보호 모드)
  (function() {
    try { localStorage.setItem('_ls_test', '1'); localStorage.removeItem('_ls_test'); }
    catch(e) {
      var w = document.getElementById('snapshot-stale-warning');
      if (w) { w.textContent = '브라우저 저장이 차단되어 포트폴리오·API 키가 저장되지 않습니다.'; w.style.display = 'block'; }
    }
  })();

  // v17: 정적 기본값 즉시 로드 (API 연결 전에 빈칸/— 없애기)
  applyStaticFallbacks();
  // v40.4: 홈 핵심뉴스 정적 큐레이션 즉시 표시 (뉴스 수집 대기 불필요)
  if (typeof renderHomeFeed === 'function') renderHomeFeed([]);
  // v30.3: DATA_SNAPSHOT → HTML 매핑 (단일 진실 원천)
  if (typeof applyDataSnapshot === 'function') applyDataSnapshot();
  // v52.55/H3-A: 스냅샷을 _lastFG에 복사하지 않는다. 현재값과 참고값을
  // getCanonicalMetric()이 구분해야 점수/설명/배지가 같은 provenance를 소비한다.
  // 실시간 시세는 initV20DataEngine이 서버 artifact와 architecture snapshot
  // preflight를 끝낸 뒤 한 번만 시작한다.
  // v20: Adaptive refresh - slow down if repeatedly failing
  let _quoteFailCount = 0;
  const _origFetchQuotes = fetchLiveQuotes;
  fetchLiveQuotes = async function() {
    try {
      await _origFetchQuotes();
      _quoteFailCount = 0; // reset on success
    } catch(e) {
      _quoteFailCount++;
      _aioLog('warn', 'fetch', 'Quote fetch failed (attempt ' + _quoteFailCount + '): ' + e.message);
      if (_quoteFailCount >= 5) {
        _aioLog('warn', 'fetch', 'Too many failures, extending refresh interval');
      }
    }
  };
  // v30.11: T1 _liveQuoteInterval 삭제 — REFRESH_SCHEDULE.quotes가 60s 지터 포함 단일 경로
  // Pre-fetch news in background after 3s delay (non-blocking)
  setTimeout(function() {
    try { if (typeof fetchAllNews === 'function') { var p = fetchAllNews(false); if (p && p.catch) p.catch(function(){}); } } catch(e){}
  }, 3000);
  // sentiment/HY 초기 fetch도 initV20DataEngine의 서버 우선 phase가 단독 소유한다.
  // v30.11: T3 _hySpreadInterval 삭제 — REFRESH_SCHEDULE.hySpread가 6h 지터 포함 단일 경로

  // Trading Signal 45초 자동 갱신 타이머 (페이지가 활성일 때 경과 시간 카운터 시작)
  refreshSignal();
  // v48.91: 타이머 레지스트리 등록
  window._refreshSignalInterval = _aioRegisterTimer('refreshSignal', refreshSignal, T.SIGNAL_REFRESH);

  // v20: Initialize data engine with all real-time integrations
  initV20DataEngine();
});

// ═══════════════════════════════════════════════════════════════════════
//  LLM QUOTA SYSTEM
//  - ON: daily limit tracked in localStorage (resets at midnight)
//  - OFF: unlimited, no quota deducted
// ═══════════════════════════════════════════════════════════════════════
// v30.13: LLM 예산 관리 시스템 (Budget Management)
// v31.3: 적응형 모델 — 기본 Haiku 4.5, 복잡도별 Sonnet/Thinking 자동 승격
// 모델 가격과 환율은 시점 의존 데이터이므로 코드에 저장하지 않는다.
// 비용 표시는 공급자 청구 내역을 연결하기 전까지 unavailable로 유지한다.
const LLM_MODELS = {
  haiku: {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5'
  },
  sonnet: {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6'
  },
  'sonnet-thinking': {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6 Thinking',
    thinking: true,
    thinkingBudget: 5000
  }
};
// v31.3: 질문 복잡도 감지 → 모델 자동 선택
function _detectQueryComplexity(query, ctxId) {
  var q = query.toLowerCase();
  var qLen = query.length;

  // ─── 1단계: 컨텍스트별 특화 판단 ───────────────────────────
  // 포트폴리오: 기본 Sonnet, 심층 Thinking
  if (ctxId === 'portfolio') {
    var pfThinking = /리밸런싱|전체.*분석|리스크.*진단|상관관계|최적화|헤지.*전략|시나리오|백테스트|팩터|배분.*전략|변동성.*분석|샤프.*비율|드로다운|베타.*조정|수익률.*기여|attribution|rebalanc|optimize|drawdown|sharpe|risk.?parity/;
    if (pfThinking.test(q)) return 'sonnet-thinking';
    return 'sonnet';
  }
  // 기업분석(fundamental): 기본 Sonnet, 심층 분석은 Thinking
  if (ctxId === 'fundamental') {
    var fundThinking = /DCF|밸류에이션.*모델|적정.*주가|내재.*가치|WACC|잔여.*이익|EV\/EBITDA.*비교|피어.*그룹|산업.*비교.*분석|sum.?of.?parts|comp.*analysis|intrinsic.*value|free.?cash.?flow.*model|종합.*기업.*분석|종합.*분석.*해줘|15개.*관점|심층.*분석/;
    if (fundThinking.test(q)) return 'sonnet-thinking';
    // v34.5: fundamental 컨텍스트에서 티커가 감지되면 기본적으로 sonnet 사용 (15개 관점 분석 품질 보장)
    var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
    var fundSonnet = /재무.*분석|실적.*분석|매출.*성장|이익률|부채.*비율|경쟁.*우위|해자|moat|경영진|사업.*모델|revenue|earnings|margin|competitive|valuation|분석|어때|전망|투자|알려/;
    if (hasTicker || fundSonnet.test(q)) return 'sonnet';
    //  fall through to 범용 판단 (구조적 분석 포함)
  }
  // 기술적분석(technical): 전략 수립은 Sonnet, 멀티타임프레임 심층은 Thinking
  else if (ctxId === 'technical') {
    var techThinking = /멀티.*타임프레임|다중.*시간|엘리어트.*파동|피보나치.*되돌림.*정밀|와이코프|wyckoff|elliott|intermarket.*analysis|상호.*시장.*분석|divergence.*종합|다이버전스.*종합/;
    if (techThinking.test(q)) return 'sonnet-thinking';
    // v34.5: 티커 감지 시 기본 Sonnet (비교 분석 포함)
    var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
    var techSonnet = /진입.*시점|매수.*타이밍|손절.*설정|목표가|지지.*저항|추세.*분석|패턴.*분석|RSI|MACD|볼린저|이동평균|골든크로스|데드크로스|weinstein|stage.*분석|support|resistance|entry|stop.?loss|target|비교|vs|VS|분석|어때|전망/;
    if (hasTicker || techSonnet.test(q)) return 'sonnet';
  }
  // 매매시그널(signal): 스코어 해석은 Sonnet, 시나리오 분석은 Thinking
  else if (ctxId === 'signal') {
    var sigThinking = /시나리오.*분석|스코어.*변동.*예측|컴포넌트.*종합.*진단|포지션.*사이징|position.*sizing|scenario|전략.*수립.*해줘/;
    if (sigThinking.test(q)) return 'sonnet-thinking';
    var sigSonnet = /스코어.*해석|왜.*이.*점수|매매.*판단|매수.*매도|지금.*사도|지금.*팔아|진입|청산|비중.*조절|포지션|대응.*전략|지금.*어때|매수.*해도|매도.*해야|사도.*될까|팔아도.*될까|들어가도|나가야/;
    if (sigSonnet.test(q)) return 'sonnet';
  }
  // 매크로(macro): 금리/환율 영향 분석은 Sonnet, 멀티팩터 시나리오는 Thinking
  else if (ctxId === 'macro') {
    var macThinking = /금리.*인상.*시나리오|연준.*경로|다중.*시나리오|인플레.*디플레.*비교|경기.*침체.*확률|스태그플레이션|yield.*curve.*inversion|멀티팩터|macro.*scenario|recession.*probability/;
    if (macThinking.test(q)) return 'sonnet-thinking';
    var macSonnet = /금리.*영향|환율.*전망|달러.*방향|유가.*영향|인플레|디플레|연준|FOMC|CPI|고용|GDP|경기.*사이클|섹터.*로테이션|rate|inflation|fed|dollar|oil.*impact/;
    if (macSonnet.test(q)) return 'sonnet';
  }
  // 시장폭(breadth): 종합 진단은 Sonnet, 다이버전스 심층은 Thinking
  else if (ctxId === 'breadth') {
    var brThinking = /다이버전스.*심층|시장폭.*vs.*지수.*괴리.*분석|McClellan.*종합|과거.*비교.*분석|히스토리컬|역사적.*비교|breadth.*divergence.*deep/;
    if (brThinking.test(q)) return 'sonnet-thinking';
    var brSonnet = /시장폭.*해석|건강.*상태|참여.*종목|다이버전스|괴리|A\/D|McClellan|종합.*판단|지금.*건강|breadth.*analysis/;
    if (brSonnet.test(q)) return 'sonnet';
  }
  // 투자심리(sentiment): 종합 판단은 Sonnet, 역사적 비교 심층은 Thinking
  else if (ctxId === 'sentiment') {
    var senThinking = /공포.*단계.*비교|역사적.*패닉.*비교|바닥.*확인.*체크리스트|capitulation.*분석|항복.*매도.*분석|스마트머니.*vs.*덤머니|sentiment.*extreme.*analysis/;
    if (senThinking.test(q)) return 'sonnet-thinking';
    var senSonnet = /공포.*탐욕|지금.*바닥|바닥.*신호|VIX.*해석|AAII|NAAIM|풋콜|put.*call|심리.*분석|과매수|과매도|fear.*greed/;
    if (senSonnet.test(q)) return 'sonnet';
  }
  // v34.6: 한국 시장 컨텍스트 — 기본 Sonnet (한국 시장 분석 품질 보장)
  else if (ctxId === 'kr-tech') {
    var krTechThinking = /멀티.*타임프레임|엘리어트|와이코프|피보나치.*정밀|wyckoff|elliott|intermarket|상호.*시장/;
    if (krTechThinking.test(q)) return 'sonnet-thinking';
    return 'sonnet'; // kr-tech는 항상 Sonnet 이상
  }
  else if (ctxId === 'kr-themes') {
    var krThThinking = /교차.*분석|테마.*간.*상관|밸류.*체인|value.*chain|종합.*비교/;
    if (krThThinking.test(q)) return 'sonnet-thinking';
    return 'sonnet'; // kr-themes는 항상 Sonnet 이상
  }
  else if (ctxId === 'kr-macro') {
    var krMacThinking = /금리.*시나리오|다중.*시나리오|경기.*침체.*확률|스태그플레이션|환율.*시나리오|한미.*금리차.*시나리오/;
    if (krMacThinking.test(q)) return 'sonnet-thinking';
    return 'sonnet'; // kr-macro는 항상 Sonnet 이상
  }
  else if (ctxId === 'kr-supply') {
    var krSupThinking = /수급.*시나리오|외국인.*전환.*시나리오|공매도.*종합.*분석|프로그램.*매매.*심층/;
    if (krSupThinking.test(q)) return 'sonnet-thinking';
    return 'sonnet'; // kr-supply는 항상 Sonnet 이상
  }
  // 테마(themes, theme-detail): 섹터/테마 분석은 Sonnet, 교차 분석은 Thinking
  else if (ctxId === 'themes' || ctxId === 'theme-detail') {
    var thThinking = /교차.*분석|테마.*간.*상관|밸류.*체인.*분석|업스트림.*다운스트림|수혜주.*종합|value.*chain|cross.*theme|supply.*chain.*analysis/;
    if (thThinking.test(q)) return 'sonnet-thinking';
    var thSonnet = /테마.*분석|섹터.*전망|수혜주|관련주|성장.*동력|시장.*규모|트렌드|theme|sector.*outlook|beneficiary/;
    if (thSonnet.test(q)) return 'sonnet';
  }

  // ─── 2단계: 범용 심층 요청 패턴 (컨텍스트 무관) ─────────────
  // Thinking급: 깊은 추론이 필요한 패턴
  var thinkingKw = /심층.*분석|근본.*원인|시나리오.*확률|멀티팩터|DCF|밸류에이션.*모델|포지션.*사이징|감마.*익스포저|옵션.*전략.*설계|리스크.*관리.*전략|비교.*분석.*해줘|왜.*그런지.*자세히|깊이.*분석|종합.*진단|체계적.*분석|정밀.*분석|단계별.*분석/;
  var thinkingEn = /deep.?analysis|root.?cause|scenario.?model|multi.?factor|position.?sizing|risk.?management.?strategy|comprehensive.*diagnosis|systematic.*analysis|step.?by.?step.*analy/;
  if (thinkingKw.test(q) || thinkingEn.test(q)) return 'sonnet-thinking';

  // Sonnet급: 분석/전략/판단이 필요한 패턴
  var sonnetKw = /전략.*제안|매수.*타이밍|진입.*시점|손절|목표가.*설정|섹터.*로테이션|어떻게.*대응|포트폴리오|종합.*판단|비교.*해줘|분석.*해줘|전망.*해줘|평가.*해줘|진단.*해줘|추천.*해줘|왜.*그래|왜.*떨어|왜.*올라|원인.*뭐|이유.*뭐|어떻게.*해야|장단점|리스크.*뭐|영향.*분석/;
  var sonnetEn = /strategy|recommend|analyze|forecast|evaluate|diagnose|compare|pros.*cons|impact.*analysis|what.*should|why.*drop|why.*rise|how.*respond/;
  if (sonnetKw.test(q) || sonnetEn.test(q)) return 'sonnet';

  // ─── 3단계: 구조적 복잡도 분석 ─────────────────────────────
  // 질문이 길거나 여러 조건을 포함하면 Sonnet 승격
  var questionMarks = (q.match(/\?/g) || []).length;
  var conjunctions = (q.match(/그리고|또한|더불어|아울러|동시에|함께|and|also|additionally/g) || []).length;
  var conditions = (q.match(/만약|경우|가정|~면|한다면|된다면|if|when|assuming|suppose/g) || []).length;

  // 복합 질문 (여러 물음표 or 접속사+길이) → Sonnet
  if (questionMarks >= 2 || (conjunctions >= 2 && qLen > 80)) return 'sonnet';
  // 조건문 포함 → 시나리오 사고 필요 → Sonnet
  if (conditions >= 1 && qLen > 60) return 'sonnet';
  // 긴 질문 (150자+) → 복잡한 의도 가능성 → Sonnet
  if (qLen > 150) return 'sonnet';

  // ─── 기본: Haiku ───────────────────────────────────────────
  return 'haiku';
}

const LLM_BUDGET = {
  dailyQueryLimit: 20,
  pricingAvailable: false
};
function getSelectedModel() {
  return 'haiku'; // v31.3: 기본 Haiku (질문별 자동 승격은 chatSend에서 처리)
}

function getModelConfig(modelKey) {
  return LLM_MODELS[modelKey || getSelectedModel()] || LLM_MODELS.haiku;
}

function calcDailyLimit() {
  return LLM_BUDGET.dailyQueryLimit;
}

function getLLMState() {
  return document.getElementById('llm-switch-track')?.classList.contains('on') ?? true;
}

// v53.59 P855: quota is not capability.  The UI must not advertise available
// calls when neither a personal key nor a healthy shared Worker route exists.
function getLLMRouteReadiness() {
  var personalKey = '';
  try { personalKey = typeof _getApiKey === 'function' ? String(_getApiKey('aio_claude_api_key') || '').trim() : ''; } catch (_) {}
  var target = typeof _aioClaudeTarget === 'function' ? _aioClaudeTarget(personalKey) : null;
  if ((!target || !target.serverKey) && personalKey) return { ready: true, reason: 'PERSONAL_KEY', label: '개인 키 준비' };
  var workerUrl = target && target.serverKey ? target.workerUrl : '';
  if (!workerUrl) return { ready: false, reason: 'NO_ROUTE', label: '라우트 없음' };
  var health = window._aioLastClaudeRouteState;
  if (health && health.target && health.target.workerUrl === workerUrl && health.ok === true) {
    return { ready: true, reason: 'SHARED_WORKER', label: '공유 Worker 준비' };
  }
  if (health && health.target && health.target.workerUrl === workerUrl && health.reason === 'WORKER_NOT_READY') {
    return { ready: false, reason: 'WORKER_NOT_READY', label: 'Worker 준비 안 됨' };
  }
  return { ready: false, reason: 'WORKER_NOT_CHECKED', label: 'Worker 확인 필요' };
}

// P1070/R592: switch state, route readiness, and quota are independent
// dimensions. A missing route must never be represented by mutating the
// user's ON/OFF switch, and callers can use this snapshot for fail-closed
// dispatch decisions.
function getLLMAvailability() {
  var enabled = getLLMState();
  var route = getLLMRouteReadiness();
  return { enabled: enabled, routeReady: !!route.ready, usable: !!enabled && !!route.ready, route: route };
}
window._aioGetLLMAvailability = getLLMAvailability;
window._aioGetLLMRouteReadiness = getLLMRouteReadiness;

function getQuota() {
  const today = _aioGetKstDateParts(new Date()).isoDate;
  let stored;
  try { stored = JSON.parse(localStorage.getItem('llm_quota') || '{}'); } catch(e) { stored = {}; }
  if (stored.date !== today) {
    const fresh = { date: today, used: 0, costUSD: 0 };
    try { localStorage.setItem('llm_quota', JSON.stringify(fresh)); } catch(e) {}
    return fresh;
  }
  return stored;
}

function saveQuota(quota) {
  try { localStorage.setItem('llm_quota', JSON.stringify(quota)); } catch(e) {}
}

// v48.0: 실제 usage 토큰 기반 쿼터 정산 refinement.
//   기존 consumeLLMQuery()는 avgInputTokens/avgOutputTokens 고정 추정치로 미리 차감.
//   실응답 수신 후 이 함수가 (실제 비용) - (추정 비용) 차이를 quota.costUSD에 가감.
//   cache_read_input_tokens는 input 단가의 10%로 과금되므로 cache hit 시 큰 절감.
function _refineQuotaByUsage(modelCfg, totalInputTokens, outputTokens, cacheReadTokens) {
  if (!modelCfg || typeof modelCfg !== 'object') return;
  var q = getQuota();
  q._realInputTokens = (q._realInputTokens || 0) + totalInputTokens;
  q._realOutputTokens = (q._realOutputTokens || 0) + outputTokens;
  q._realCacheRead = (q._realCacheRead || 0) + (cacheReadTokens || 0);
  saveQuota(q);
  if (typeof updateQuotaBadge === 'function') updateQuotaBadge();
}

// v20: DOM element cache for performance
const _domCache = {};
function cachedEl(id) {
  if (!_domCache[id]) _domCache[id] = document.getElementById(id);
  return _domCache[id];
}

function updateQuotaBadge() {
  const track   = cachedEl('llm-switch-track');
  const swLabel = cachedEl('llm-switch-label');
  const capEl   = cachedEl('llm-daily-cap');
  const remEl   = cachedEl('llm-remaining');
  const progEl  = cachedEl('llm-prog-fill');
  const badge   = document.getElementById('llm-quota');
  const hdrBadge= cachedEl('llm-header-badge');
  const modelEl = cachedEl('llm-model-label');
  const costEl  = cachedEl('llm-daily-cost');

  const isOn = getLLMState();
  const dailyLimit = calcDailyLimit();
  const model = getModelConfig();
  const route = getLLMRouteReadiness();

  if (isOn && !route.ready) {
    // Keep the switch state intact: route health is not user intent.
    if (swLabel) { swLabel.textContent = route.label; swLabel.className = 'llm-switch-label'; }
    if (capEl) capEl.textContent = '—';
    if (remEl) { remEl.textContent = '—'; remEl.className = 'llm-quota-val empty'; }
    if (progEl) { progEl.style.width = '0%'; progEl.className = 'llm-prog-fill empty'; }
    if (badge) badge.textContent = route.reason === 'NO_ROUTE' ? 'NO ROUTE' : '확인 필요';
    if (costEl) costEl.textContent = route.reason === 'NO_ROUTE' ? '개인 Claude 키 또는 운영자 공유 Worker가 필요합니다.' : '공유 Worker 상태 확인 후 사용할 수 있습니다.';
    if (hdrBadge) { hdrBadge.textContent = 'AI · ' + route.label; hdrBadge.style.color = 'var(--text-muted)'; hdrBadge.style.borderColor = 'var(--border)'; hdrBadge.style.background = 'var(--surface-3)'; }
    return;
  }

  if (track)   { track.classList.toggle('on', isOn); }
  if (swLabel) { swLabel.textContent = isOn ? 'ON' : 'OFF'; swLabel.className = 'llm-switch-label' + (isOn ? ' on' : ''); }
  if (capEl)   capEl.textContent = dailyLimit + '회';
  if (modelEl) modelEl.textContent = '기본 Haiku · 심층 Sonnet · 번역 Haiku';

  if (!isOn) {
    if (remEl)   { remEl.textContent = '∞'; remEl.className = 'llm-quota-val'; }
    if (progEl)  { progEl.style.width = '0%'; progEl.className = 'llm-prog-fill'; }
    if (badge)   badge.textContent = '∞';
    if (costEl)  costEl.textContent = '';
    if (hdrBadge){ hdrBadge.textContent = 'AI OFF'; hdrBadge.style.color = 'var(--text-muted)'; hdrBadge.style.borderColor = 'var(--border)'; hdrBadge.style.background = 'var(--surface-3)'; }
    return;
  }

  const quota     = getQuota();
  const used      = quota.used;
  const remaining = Math.max(0, dailyLimit - used);
  const pct       = Math.min(100, Math.round(used / dailyLimit * 100));
  const overBudget= quota.overBudget || 0;

  const grade = remaining === 0 ? (overBudget > 0 ? 'over' : 'empty') : remaining <= Math.ceil(dailyLimit * 0.2) ? 'warn' : 'green';

  if (remEl)  { remEl.textContent = remaining + '회' + (overBudget > 0 ? ' (초과 ' + overBudget + '회)' : ''); remEl.className = 'llm-quota-val ' + grade; }
  if (progEl) { progEl.style.width = Math.min(pct, 100) + '%'; progEl.className = 'llm-prog-fill' + (grade !== 'green' ? ' ' + grade : ''); }
  if (costEl) costEl.textContent = '비용 정보: 공급자 청구 원천 미연결';

  if (badge)    badge.textContent = remaining + '/' + dailyLimit;
  if (hdrBadge) {
    // v50.13: 헤더 배지는 'AI · 모델'만 — 남은 횟수(remaining/dailyLimit)는 옆 #llm-quota가 단독 표시(중복 제거).
    const hdrText = overBudget > 0
      ? 'AI 예산 초과 · +' + overBudget + '회'
      : 'AI · ' + model.label;
    hdrBadge.textContent = hdrText;
    hdrBadge.style.color = grade === 'green' ? '#00bcd4' : grade === 'warn' ? '#ffa31a' : '#ff5b50';
    hdrBadge.style.borderColor = grade === 'green' ? 'var(--accent-border)' : grade === 'warn' ? 'rgba(245,158,11,0.3)' : 'var(--data-red-soft)';
    hdrBadge.style.background  = grade === 'green' ? 'var(--data-cyan-soft)' : grade === 'warn' ? 'rgba(245,158,11,0.12)' : 'var(--data-red-mid)';
  }
}

function toggleLLM() {
  // 내부 state는 llm-switch-track 의 'on' 클래스로 관리
  const track = document.getElementById('llm-switch-track');
  if (track) track.classList.toggle('on');
  updateQuotaBadge();
}

// Call this every time an LLM query is actually made
function consumeLLMQuery() {
  // Fail closed before the OFF/unlimited quota shortcut. OFF controls the
  // local budget policy; it cannot turn a missing provider route into a call.
  var route = getLLMRouteReadiness();
  if (!route.ready) {
    if (typeof updateQuotaBadge === 'function') updateQuotaBadge();
    return false;
  }
  if (!getLLMState()) return true; // OFF → no local quota charge
  const quota = getQuota();
  const dailyLimit = calcDailyLimit();
  const model = getModelConfig();

  if (quota.used >= dailyLimit) {
    return new Promise(function(resolve) {
      var settled = false;
      function settle(value) { if (settled) return; settled = true; resolve(value); }
      showConfirmModal('일일 한도 초과',
        '일일 사용 한도(' + dailyLimit + '회)를 모두 사용했습니다.\n공급자 가격·환율 원천이 연결되지 않아 추가 비용은 이 화면에서 계산하지 않습니다.\n계속 질문하시겠습니까?',
        function() {
          quota.overBudget = (quota.overBudget || 0) + 1;
          quota.used += 1;
          saveQuota(quota);
          updateQuotaBadge();
          settle(true);
        }, '', function() { settle(false); });
    });
  }
  quota.used += 1;
  saveQuota(quota);
  updateQuotaBadge();
  return true; // allowed
}

// Init on load
/* v20: DOMContentLoaded Handler #2 - UI Keys/Quota */
document.addEventListener('DOMContentLoaded', () => {
  loadSidebarApiKey();
  loadRss2jsonKey();
  // v31.3: 적응형 모델 — 기본 Haiku, 질문 복잡도에 따라 Sonnet/Thinking 자동 승격
  updateQuotaBadge();

  // ── 확장 API 키 상태 복원 ──
  // 실제 비밀값은 런타임 조회 경로만 사용한다. password input의 value에 원문을 넣으면
  // 접근성 트리/브라우저 자동화 스냅샷에서 노출될 수 있다.
  var _keyMap = [
    ['aio_av_key', 'aio_av_key_input'],
    ['aio_finnhub_key', 'aio_finnhub_key_input'],
    ['aio_fred_key', 'aio_fred_key_input'],
    ['aio_td_key', 'aio_td_key_input'],
    ['aio_fmp_key', 'aio_fmp_key_input'],
    ['aio_perplexity_key', 'aio_perplexity_key_input'],
    ['aio_google_cse_key', 'aio_google_cse_key_input'],
    ['aio_google_cse_cx', 'aio_google_cse_cx_input'],
    ['aio_newsdata_key', 'aio_newsdata_key_input'],
    ['aio_bok_key', 'aio_bok_key_input'],
    ['aio_kosis_key', 'aio_kosis_key_input'],
    ['aio_cf_worker_url', 'aio_cf_worker_input']
  ];
  _keyMap.forEach(function(pair) {
    var saved = safeLSGetSync(pair[0]);
    var el = document.getElementById(pair[1]);
    if (saved && el) {
      el.value = '••••••••';
      el.dataset.secretStored = 'true';
      el.setAttribute('aria-label', (el.getAttribute('placeholder') || 'API 키') + ' · 저장됨');
    }
  });
  // v30.11: Vault 상태 배지 초기화
  if (typeof _updateVaultStatus === 'function') _updateVaultStatus();
  if (typeof _aioRefreshProviderStatuses === 'function') _aioRefreshProviderStatuses();
  // Auto-reset check every minute (for midnight rollover)
  // v48.91: 타이머 레지스트리 등록
  window._quotaBadgeInterval = _aioRegisterTimer('quotaBadge', updateQuotaBadge, T.COOLDOWN);

// ── Dynamic date labels ─────────────────────────────────────────
(function updateDateLabels() {
  const kst = _aioGetKstDateParts(new Date());
  const dateStr = kst.dateStr;
  const timeStr = kst.hour + ':' + kst.minute;
  const fullLabel = dateStr + ' (' + kst.weekday + ') KST';
  
  // Update home date label
  const dlEl = document.getElementById('home-date-label');
  if (dlEl) dlEl.textContent = fullLabel + ' · 시세·뉴스 상태 확인 중';
  
  // Update version badge
  const vb = document.getElementById('app-version-badge');
  if (vb) vb.title = 'v29 · 빌드: ' + dateStr;
})();
});



// ═══════════════════════════════════════════════════════════════════════
//  GITHUB PAGES AUTO-UPDATE POLLING
//  동작: version.json을 5분마다 fetch → 버전 변경 시 상단 배너 표시
//  설정: GitHub 저장소 경로(username/repo)를 사이드바에서 입력 저장
//  배포: git push 후 GitHub Actions가 Pages 자동 빌드 (~30초~2분)
//  version.json 형식: {"version": "v29", "built": "2026-03-22T12:00:00Z"}
// ═══════════════════════════════════════════════════════════════════════

const GH_REPO_LS   = 'aio_gh_repo';          // localStorage key
const GH_POLL_MS   = 5 * 60 * 1000;          // 5분 기본 폴링
const GH_POLL_MAX  = 30 * 60 * 1000;         // 최대 30분 (백오프 한계)
const GH_VERSION_PATH = 'version.json';      // 저장소 루트의 파일
let   _ghCurrentVersion = null;
let   _ghPollTimer      = null;
let   _ghFailCount      = 0;                 // v30.11: 연속 실패 횟수 (지수 백오프용)

// ── 저장소 설정 저장/로드 ──────────────────────────────────
function saveGhRepo() {
  const inp = document.getElementById('gh-repo-url');
  if (!inp) return;
  const repo = inp.value.trim();
  try { if (repo) localStorage.setItem(GH_REPO_LS, repo); else localStorage.removeItem(GH_REPO_LS); } catch(e) {}
  // 폴링 재시작
  startGhPolling();
}

function loadGhRepo() {
  const inp = document.getElementById('gh-repo-url');
  const repo = localStorage.getItem(GH_REPO_LS) || '';
  if (inp && repo) inp.value = repo;
  return repo;
}

// ── version.json URL 빌드 ─────────────────────────────────
function getVersionUrl(repo) {
  // GitHub raw content URL
  // https://raw.githubusercontent.com/[user]/[repo]/main/version.json
  if (!repo || !repo.includes('/')) return null;
  return `https://raw.githubusercontent.com/${repo}/main/${GH_VERSION_PATH}?t=${Date.now()}`;
}

// ── 상태 표시 업데이트 ────────────────────────────────────
function setGhStatus(text, color) {
  const el = document.getElementById('gh-sync-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = color || '';
}

// ── 버전 폴링 1회 ────────────────────────────────────────
async function ghPollOnce() {
  const repo = loadGhRepo();
  if (!repo) { setGhStatus('— 미설정', ''); return; }

  const url = getVersionUrl(repo);
  if (!url) { setGhStatus('경로 오류', '#ffa31a'); return; }

  try {
    var _ghCtrl = new AbortController();
    var _ghTimer = setTimeout(function() { _ghCtrl.abort(); }, T.FETCH_TIMEOUT);
    const resp = await fetch(url, { cache: 'no-store', signal: _ghCtrl.signal });
    clearTimeout(_ghTimer);

    // v30.11: rate-limit 감지 (403 + x-ratelimit-remaining)
    if (resp.status === 403) {
      const remaining = resp.headers.get('x-ratelimit-remaining');
      const resetTs   = resp.headers.get('x-ratelimit-reset');
      if (remaining === '0' || remaining === 0) {
        const resetIn = resetTs ? Math.max(0, Math.ceil((Number(resetTs) * 1000 - Date.now()) / 60000)) : '?';
        setGhStatus('Rate limit · ' + resetIn + '분 후 재시도', '#ffa31a');
        _ghFailCount++;
        _rescheduleGhPoll();
        return;
      }
    }

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const ver  = data.version || data.v || String(data);

    // v30.11: 성공 시 실패 카운터 리셋 & 정상 간격 복원
    if (_ghFailCount > 0) {
      _ghFailCount = 0;
      _rescheduleGhPoll();
    }

    if (_ghCurrentVersion === null) {
      // 최초 로드 — 현재 버전 기록
      _ghCurrentVersion = ver;
      const built = data.built ? new Date(data.built).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      setGhStatus('✓ ' + ver + (built ? ' · ' + built : ''), '#00e5a0');
    } else if (ver !== _ghCurrentVersion) {
      // 버전 변경 감지!
      setGhStatus(' ' + ver + ' (신규)', '#ffa31a');
      showUpdateBanner(ver, data.built);
    } else {
      // 최신 상태
      setGhStatus('✓ ' + ver + ' 최신', '#00e5a0');
    }
  } catch(e) {
    _ghFailCount++;
    const isOffline = !navigator.onLine;
    const errMsg = isOffline ? ' 오프라인' : (' 연결 실패 (' + _ghFailCount + ')');
    setGhStatus(errMsg, '#ff5b50');
    // v30.11: 지수 백오프 — 연속 실패 시 폴링 간격 증가
    _rescheduleGhPoll();
  }
}

// v30.11: 지수 백오프 폴링 간격 재조정
function _rescheduleGhPoll() {
  const backoff = Math.min(GH_POLL_MS * Math.pow(2, _ghFailCount), GH_POLL_MAX);
  // v48.91: 타이머 레지스트리 등록 (_aioRegisterTimer가 기존 ID 정리 포함)
  _ghPollTimer = _aioRegisterTimer('ghPoll', ghPollOnce, backoff);
  if (_ghFailCount > 0) {
    console.log('[AIO] GH poll backoff: ' + Math.round(backoff/1000) + 's (fails=' + _ghFailCount + ')');
  }
}

// ── 업데이트 배너 표시 ────────────────────────────────────
function showUpdateBanner(newVer, builtTs) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  const textEl = banner.querySelector('.banner-text');
  const subEl  = banner.querySelector('.banner-sub');
  if (textEl) textEl.textContent = ' 새 버전' + (newVer ? ' (' + newVer + ')' : '') + ' 이 배포되었습니다 — 클릭하여 새로고침';
  if (subEl && builtTs) {
    const d = new Date(builtTs).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    subEl.textContent = `배포 시각 ${d} · 클릭하여 새로고침`;
  }
  banner.classList.add('show');
}

// v34.6: 강제 캐시 무효화 새로고침
function forceRefresh() {
  // 쿼리스트링으로 캐시 무시
  window.location.href = window.location.pathname + '?v=' + Date.now();
}

// ── 폴링 시작/재시작 ─────────────────────────────────────
function startGhPolling() {
  _ghCurrentVersion = null; // 저장소 바뀌면 버전 초기화

  const repo = loadGhRepo();
  if (!repo) { setGhStatus('— 미설정', ''); return; }

  ghPollOnce(); // 즉시 1회 실행
  // v48.91: 타이머 레지스트리 등록 (_aioRegisterTimer가 기존 ID 정리 포함)
  _ghPollTimer = _aioRegisterTimer('ghPoll', ghPollOnce, GH_POLL_MS);
}

// ── DOMContentLoaded 시 초기화 ───────────────────────────
/* v20: DOMContentLoaded Handler #3 - GitHub Polling */
document.addEventListener('DOMContentLoaded', () => {
  // v34.6: 캐시 버스트 쿼리스트링 제거 (URL 정리)
  if (window.location.search.includes('v=')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  loadGhRepo();
  startGhPolling();
  // Initialize home dashboard
  setTimeout(() => refreshHomeDashboard(), 500);
});

// v30.11: 네트워크 복구 시 즉시 재폴링 (오프라인→온라인 전환)
window.addEventListener('online', () => {
  if (loadGhRepo()) {
    _ghFailCount = 0;
    ghPollOnce();
    _rescheduleGhPoll(); // 정상 간격으로 복원
    console.log('[AIO] Network restored — GH poll resumed');
  }
});
window.addEventListener('offline', () => {
  setGhStatus(' 오프라인', '#ff5b50');
});


// ── Browser back/forward support ──────────────────────────────────────
// Knowledge route links use #route?knowledgeNode=... so the app shell and
// destination pages share one bookmarkable route-context grammar.
function _aioParseRouteHash(hashValue) {
  var raw = String(hashValue || '').replace(/^#/, '');
  var separator = raw.indexOf('?');
  var routeId = separator >= 0 ? raw.slice(0, separator) : raw;
  var query = separator >= 0 ? raw.slice(separator + 1) : '';
  return { routeId: routeId || 'home', params: new URLSearchParams(query) };
}
function _aioSyncKnowledgeRouteContext() {
  var parsed = _aioParseRouteHash(location.hash);
  var returnContext = null;
  try { returnContext = parsed.params.get('return') ? JSON.parse(parsed.params.get('return')) : null; } catch (_) {}
  var context = Object.freeze({
    routeId: parsed.routeId,
    knowledgeNode: parsed.params.get('knowledgeNode') || null,
    metric: parsed.params.get('metric') || null,
    timeframe: parsed.params.get('timeframe') || null,
    returnContext: returnContext,
    active: parsed.params.has('knowledgeNode') || parsed.params.has('metric') || parsed.params.has('timeframe') || parsed.params.has('return')
  });
  window.AIO_KNOWLEDGE_ROUTE_CONTEXT = context;
  if (window.AIO && window.AIO.state) window.AIO.state.knowledgeRouteContext = context;
  try { window.dispatchEvent(new CustomEvent('aio:knowledgeRouteContext', { detail: context })); } catch (_) {}
  return context;
}
window._aioParseRouteHash = _aioParseRouteHash;
window._aioSyncKnowledgeRouteContext = _aioSyncKnowledgeRouteContext;
// popstate only available outside sandboxed iframes
// v30.14: popstate 핸들러 — 전체 9개 페이지 reinit (기존 3개만 있어서 6개 누락 수정)
try { if (!window._aioPopstateRegistered) window.addEventListener('popstate', (e) => {
  var parsedRoute = _aioParseRouteHash(location.hash);
  var id = String(e.state?.page || parsedRoute.routeId || 'home').split('?')[0];
  _aioSyncKnowledgeRouteContext();
  // v34.5: 해시 별칭 매핑
  var _ha = { chart: 'technical', dashboard: 'home', stock: 'fundamental', forex: 'fxbond', bond: 'fxbond', news: 'market-news', search: 'home', help: 'guide', manual: 'guide', trend: 'themes', theme: 'themes', moat: 'fundamental', korea: 'macro', 'kr-theme': 'themes', 'kr-home': 'macro', 'kr-supply': 'macro', 'kr-themes': 'themes', 'kr-macro': 'macro', 'kr-technical': 'technical' }; // v53.7 (P725)
  if (_ha[id]) id = _ha[id];
  // 이전 페이지 차트 정리 (메모리 누수 방지)
  if (typeof prevPage !== 'undefined' && prevPage && prevPage !== id) {
    destroyPageCharts(prevPage);
  }
  // showPage without pushing another history entry
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    // v48.61 R45: data-arg 기반 (getAttribute('onclick') 잔존 제거)
    var arg = n.dataset && n.dataset.arg;
    var legacy = n.getAttribute('onclick');
    n.classList.toggle('active',
      arg === id || (legacy && legacy.includes("'" + id + "'")));
  });
  const parts = breadcrumbMap[id] || ['AIO', id];
  setBreadcrumb(parts);
  prevPage = id;
  var _cEl = document.querySelector('.content');
  if (_cEl) _cEl.scrollTop = 0;
  // v39.2: aio:pageShown 이벤트 발송 — v48.14 dedup guard 경유
  try { _firePageShown(id, 'popstate'); } catch(e) {}
  // v48.15 (P2-A): 9개 하드코딩 if-분기 → 단일 PAGES 라우터 호출로 교체
  // showPage와 동일 경로 재사용 (_firePageShown dedup guard가 200ms 내 중복 발사 차단)
  if (window.PAGES && window.PAGES[id] && typeof window.PAGES[id].init === 'function') {
    try { window.PAGES[id].init(); }
    catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'page-init', 'popstate ' + id + ': ' + e.message); }
  }
});
} catch(e) { /* sandboxed */ }

// Load page from URL hash on first visit (e.g. bookmark #signal)
(function initFromHash() {
  const rawHash = location.hash.slice(1);
  const parsedRoute = _aioParseRouteHash(location.hash);
  const hash = parsedRoute.routeId;
  _aioSyncKnowledgeRouteContext();
  if (rawHash) {
    try { history.replaceState(Object.assign({}, history.state || {}, { page: hash }), '', location.href); } catch(e) {}
    const navEl = document.querySelector(`[data-action="showPage"][data-arg="${hash}"]`);
    showPage(hash, navEl);
  } else {
    // Push initial state so popstate fires correctly on first back press
    try { history.replaceState({ page: 'home' }, '', '#home'); } catch(e) {}
  }
})();

// ── Global refresh: all data sources ──────────────────────────────────
// Unified refresh progress surface. It listens to the scheduler events emitted by aio-data.js.
(function bindAioRefreshProgressSurface() {
  var lastKeys = [];
  var labels = {
    quotes: '시세',
    news: '뉴스',
    sentiment: '심리',
    breadth: '시장폭',
    fred: 'FRED',
    technicals: '기술지표',
    vixHistory: 'VIX 히스토리',
    hySpread: 'HY 스프레드',
    maUpdate: 'MA 갱신',
    krSupply: 'KR 수급',
    krDynamic: 'KR 동적 데이터'
  };

  function ensureLayer() {
    var layer = document.getElementById('aio-refresh-progress-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'aio-refresh-progress-layer';
    layer.setAttribute('role', 'status');
    layer.setAttribute('aria-live', 'polite');
    layer.style.cssText = 'display:none;position:fixed;right:14px;top:58px;z-index:99998;width:min(360px,calc(100vw - 28px));background:var(--surface-2,#111827);border:1px solid var(--border,#2b3440);border-radius:4px;box-shadow:0 14px 34px rgba(0,0,0,.35);padding:10px 12px;color:var(--text-primary,#e5edf5);font-family:var(--font-sans,system-ui);';
    layer.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;"><div id="aio-refresh-progress-title" style="font-size:12px;font-weight:800;">전체 데이터 최신화</div><div id="aio-refresh-progress-count" style="font-size:11px;font-family:var(--font-mono,monospace);color:var(--data-cyan,#00bcd4);">0/0</div></div><div style="height:4px;background:var(--surface-4,#253040);border-radius:4px;overflow:hidden;margin-bottom:8px;"><div id="aio-refresh-progress-bar" style="height:100%;width:0%;background:var(--data-cyan,#00bcd4);transition:width .25s ease;"></div></div><div id="aio-refresh-progress-current" style="font-size:11px;color:var(--text-muted,#8b98a5);margin-bottom:8px;">대기 중</div><div id="aio-refresh-progress-list" style="display:grid;gap:4px;max-height:190px;overflow:auto;"></div>';
    document.body.appendChild(layer);
    return layer;
  }

  function statusText(key, detail, byKey) {
    var row = byKey[key];
    if (row) {
      if (row.ok && !row.skipped) return '완료';
      if (row.skipped) return '스킵';
      return '확인 필요';
    }
    if (detail.currentKey === key && detail.phase === 'running') return '진행 중';
    return '대기';
  }

  function statusColor(text) {
    if (text === '완료') return 'var(--data-green,#00e5a0)';
    if (text === '진행 중') return 'var(--data-cyan,#00bcd4)';
    if (text === '스킵') return 'var(--data-amber,#ffa31a)';
    if (text === '확인 필요') return 'var(--data-red,#ff5b50)';
    return 'var(--text-muted,#8b98a5)';
  }

  function render(detail) {
    detail = detail || {};
    if (Array.isArray(detail.keys) && detail.keys.length) lastKeys = detail.keys.slice();
    var total = detail.total || lastKeys.length || 0;
    var done = detail.done || 0;
    var pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    var active = detail.type !== 'done';
    // v50.31: 플로팅 진행 패널은 사용자가 직접 누른 전체 새로고침(forceRefresh)일 때만 표시.
    // 부팅/페이지 진입 등 백그라운드 갱신까지 자동 팝업 → 레짐 배너·콘텐츠 위 겹침(사용자 스크린샷).
    // 백그라운드 갱신 피드백은 topbar 버튼 텍스트("갱신 N/M")가 조용히 담당.
    var userRun = detail.forceRefresh === true;
    var layer = ensureLayer();
    var btn = document.getElementById('topbar-refresh-btn');
    var title = document.getElementById('aio-refresh-progress-title');
    var count = document.getElementById('aio-refresh-progress-count');
    var bar = document.getElementById('aio-refresh-progress-bar');
    var current = document.getElementById('aio-refresh-progress-current');
    var list = document.getElementById('aio-refresh-progress-list');
    var failed = (detail.results || []).filter(function(r) { return r && !r.ok && !r.skipped; }).length;

    if (userRun) layer.style.display = 'block';
    if (title) title.textContent = active ? '전체 데이터 최신화 중' : (failed ? '최신화 완료 - 확인 필요' : '최신화 완료');
    if (count) count.textContent = done + '/' + total;
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = failed ? 'var(--data-amber,#ffa31a)' : 'var(--data-cyan,#00bcd4)';
    }
    if (current) {
      current.textContent = active
        ? ((detail.currentLabel || labels[detail.currentKey] || detail.currentKey || '데이터') + ' 수신 중')
        : (failed ? failed + '개 소스 확인 필요' : '모든 요청이 정리되었습니다');
    }
    // v50.31: data-status-panel 칩 중복 기록 제거 — topbar에 "갱신 N/M"(버튼)과 "전체 최신화 N/M"(칩)이
    // 같은 정보를 나란히 표시하던 것 정리. 칩은 updateDataStatus(데이터 상태)가 단독 소유.
    if (btn) {
      btn.disabled = active;
      btn.textContent = active ? ('갱신 ' + done + '/' + total) : (failed ? '확인 필요' : '완료');
    }
    if (list) {
      var byKey = {};
      (detail.results || []).forEach(function(r) { if (r && r.key) byKey[r.key] = r; });
      list.innerHTML = '';
      (lastKeys.length ? lastKeys : Object.keys(byKey)).forEach(function(key) {
        var txt = statusText(key, detail, byKey);
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;border-top:1px solid rgba(255,255,255,.06);padding-top:4px;';
        var name = document.createElement('span');
        name.textContent = labels[key] || key;
        var state = document.createElement('span');
        state.textContent = txt;
        state.style.cssText = 'font-family:var(--font-mono,monospace);color:' + statusColor(txt) + ';';
        row.appendChild(name);
        row.appendChild(state);
        list.appendChild(row);
      });
    }
    if (!active) {
      setTimeout(function() {
        var latest = window.AIO && window.AIO.getRefreshState ? window.AIO.getRefreshState() : null;
        if (!latest || latest.runId === detail.runId) {
          layer.style.display = 'none';
          if (btn) { btn.disabled = false; btn.textContent = '새로고침'; }
        }
      }, failed ? 6000 : 2500);
    }
  }

  window.addEventListener('aio:refresh:start', function(e) { render(e.detail); });
  window.addEventListener('aio:refresh:progress', function(e) { render(e.detail); });
  window.addEventListener('aio:refresh:done', function(e) { render(e.detail); });
})();

async function globalRefresh() {
  const btn = document.getElementById('topbar-refresh-btn');
  if (window.AIO && (typeof window.AIO.forceRefreshAllData === 'function' || typeof window.AIO.runScheduledRefresh === 'function')) {
    if (btn) { btn.textContent = '갱신 준비'; btn.disabled = true; }
    try {
      var result = typeof window.AIO.forceRefreshAllData === 'function'
        ? await window.AIO.forceRefreshAllData()
        : await window.AIO.runScheduledRefresh({ forceRefresh: true });
      var activePage = document.querySelector('.page.active');
      var activeId = activePage ? activePage.id.replace('page-','') : (typeof prevPage !== 'undefined' ? prevPage : 'home');
      if (activeId === 'breadth' && typeof initBreadthPage === 'function') {
        initBreadthPage(true);
        if (typeof updateRallyQualityVerdict === 'function') setTimeout(updateRallyQualityVerdict, 300);
      }
      if (activeId === 'signal' && typeof initSignalDashboard === 'function') initSignalDashboard();
      if (activeId === 'fxbond' && typeof updateFxBondPage === 'function') updateFxBondPage();
      if (btn) {
        btn.textContent = result && result.status === 'warn' ? '확인 필요' : '완료';
        btn.disabled = false;
        setTimeout(function(){ btn.textContent = '새로고침'; }, result && result.status === 'warn' ? 6000 : 2500);
      }
      return result;
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'globalRefresh scheduler error: ' + (e && e.message || e));
      if (typeof showDataError === 'function') showDataError('새로고침', '전체 새로고침 중 오류 - 일부 데이터가 갱신되지 않았을 수 있습니다', 'warn');
      if (btn) { btn.textContent = '새로고침'; btn.disabled = false; }
      return null;
    }
  }
  if (btn) { btn.textContent = '↻ 갱신 중...'; btn.disabled = true; }
  try {
  const tasks = [];
  if (typeof fetchLiveQuotes  === 'function') tasks.push(fetchLiveQuotes());
  if (typeof fetchFearGreed   === 'function') tasks.push(fetchFearGreed());
  if (typeof fetchPutCall     === 'function') tasks.push(fetchPutCall());
  if (typeof fetchHYSpread    === 'function') tasks.push(fetchHYSpread());
  if (typeof fetchAllNews     === 'function') tasks.push(fetchAllNews(true));
  if (typeof refreshSignal    === 'function') tasks.push(Promise.resolve(refreshSignal()));
  // Re-init charts on current page
  const activePage = document.querySelector('.page.active');
  const activeId = activePage ? activePage.id.replace('page-','') : prevPage;
  if (activeId === 'breadth')   { initBreadthPage(true); setTimeout(updateRallyQualityVerdict, 300); }
  if (activeId === 'signal')    initSignalDashboard();
  if (activeId === 'fxbond')    updateFxBondPage();

  await Promise.allSettled(tasks);

  if (btn) {
    btn.textContent = '✓ 완료';
    btn.disabled = false;
    setTimeout(() => { btn.textContent = '↻ 새로고침'; }, 2000);
  }
  } catch(e) {
    _aioLog('warn', 'fetch', 'globalRefresh error: ' + (e && e.message || e));
    showDataError('새로고침', '전체 새로고침 중 오류 — 일부 데이터가 갱신되지 않았을 수 있습니다', 'warn');
    if (btn) { btn.textContent = '↻ 새로고침'; btn.disabled = false; }
  }
}

// v30.11: T4 _sentimentAutoInterval 삭제 — REFRESH_SCHEDULE.sentiment(10min)이 FG+PC 담당, HY는 hySpread(6h)로 이관
// (기존 5분 IIFE 제거 — 중앙 스케줄러 단일 경로화)


// v30.11 (분리 v48.64): WCAG 2.1 AA 접근성 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 1. 채팅 입력 필드에 aria-label 일괄 추가
  document.querySelectorAll('.acp-input-row input').forEach(function(inp) {
    if (!inp.getAttribute('aria-label')) {
      inp.setAttribute('aria-label', inp.placeholder || 'AI 채팅 입력');
    }
  });

  // 2. 채팅 전송 버튼에 aria-label 추가
  document.querySelectorAll('.acp-input-row button').forEach(function(btn) {
    if (!btn.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', '메시지 전송');
    }
  });

  // 3. 채팅 초기화 버튼에 aria-label 추가
  document.querySelectorAll('.acp-clear').forEach(function(btn) {
    if (!btn.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', '대화 초기화');
    }
  });

  // 4. 21개 페이지에 region landmark 추가
  document.querySelectorAll('.page[id]').forEach(function(pg) {
    pg.setAttribute('role', 'region');
    var title = pg.querySelector('.page-title');
    if (title) {
      var labelId = pg.id + '-label';
      // Preserve stable semantic IDs used by native route renderers (for
      // example #ticker-hero-name). Generate the page fallback only when the
      // title did not already provide an explicit ID.
      var resolvedLabelId = title.id || labelId;
      if (!title.id) title.id = resolvedLabelId;
      pg.setAttribute('aria-labelledby', resolvedLabelId);
    }
  });

  // 5. nav-item 키보드 접근성 보강 (Enter/Space 활성화)
  document.querySelectorAll('.nav-item[role="button"]').forEach(function(nav) {
    nav.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nav.click();
      }
    });
  });

  // 6. icon-only 버튼에 aria-label 추가
  document.querySelectorAll('button').forEach(function(btn) {
    if (btn.getAttribute('aria-label')) return;
    var text = btn.textContent.trim();
    if (text === '✕' || text === '✕') btn.setAttribute('aria-label', '닫기');
    else if (text === '☰') btn.setAttribute('aria-label', '메뉴 열기');
    else if (text === '↻' || text.includes('새로고침')) btn.setAttribute('aria-label', '새로고침');
  });

  // 7. API 키 입력 필드에 aria-label 추가
  document.querySelectorAll('input[type="password"]').forEach(function(inp) {
    if (!inp.getAttribute('aria-label')) {
      var label = inp.placeholder || 'API 키 입력';
      inp.setAttribute('aria-label', label);
    }
  });

  // 8. aria-live 영역 설정 (동적 업데이트 알림)
  var liveEls = ['pf-total-value', 'pf-total-pnl'];
  liveEls.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('aria-live', 'polite');
  });
  var signalScoreEl = document.querySelector('#score-gauge-val');
  if (signalScoreEl) signalScoreEl.setAttribute('aria-live', 'polite');

  // 9~23: 모든 DOM이 구성된 뒤 실행 (AI 패널/모달이 이 스크립트 뒤에 위치)
  setTimeout(function() {

  // 9. nav-item에 aria-label 추가 (이모지 + 라벨 텍스트 정리)
  document.querySelectorAll('.nav-item[role="button"]').forEach(function(nav) {
    if (nav.getAttribute('aria-label')) return;
    var label = nav.querySelector('.label');
    if (label) nav.setAttribute('aria-label', label.textContent.trim() + ' 페이지');
  });

  // 10. 주요 액션 버튼에 aria-label 추가
  var btnLabels = {
    'sidebar-toggle-btn': '사이드바 열기/닫기',
    'topbar-refresh-btn': '데이터 새로고침',
    'mobile-menu-btn': '모바일 메뉴'
  };
  Object.keys(btnLabels).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', btnLabels[id]);
  });

  // 11. 사이드바 input에 aria-label 추가
  document.querySelectorAll('.sidebar input:not([aria-label])').forEach(function(inp) {
    inp.setAttribute('aria-label', inp.placeholder || inp.title || 'API 키 입력');
  });

  // 12. onclick div에 role="button" + tabindex 보강
  document.querySelectorAll('[onclick]:not([role])').forEach(function(el) {
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
    el.setAttribute('role', 'button');
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });

  // 13. 빈 텍스트 인터랙티브 요소에 명시적 aria-label 추가
  var classLabels = {
    'mobile-overlay': '모바일 메뉴 닫기',
    'llm-switch-track': 'AI 도우미 전환',
    'ai-ph-close': 'AI 패널 닫기',
    'acp-history-btn': 'AI 대화 기록'
  };
  Object.keys(classLabels).forEach(function(cls) {
    document.querySelectorAll('.' + cls).forEach(function(el) {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', classLabels[cls]);
    });
  });

  // 14. skip-link: HTML에 .skip-link 하드코딩 완료 (L1942) — JS 중복 생성 제거 (v41.4)

  // 15. v40.9: main landmark 설정
  var contentEl = document.querySelector('.content');
  if (contentEl && !contentEl.getAttribute('role')) {
    contentEl.setAttribute('role', 'main');
    contentEl.setAttribute('aria-label', 'AIO Screener 메인 콘텐츠');
  }
  var sidebarEl = document.querySelector('.sidebar');
  if (sidebarEl) {
    if (!sidebarEl.getAttribute('aria-label')) {
      sidebarEl.setAttribute('aria-label', '메인 내비게이션');
    }
  }

  // 16. v54.47: 가격 셀 수백 개를 모두 aria-live로 만들면 시세 갱신마다
  // 스크린리더가 전체 숫자를 읽어 과도한 알림이 발생한다. 요약 상태 영역만
  // announce하고 개별 데이터 셀은 일반 텍스트로 남긴다.
  ['live-quote-ts-topbar','server-data-age','home-risk-regime-badge','score-gauge-val','pf-total-value','pf-total-pnl'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute('aria-live')) {
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
    }
  });

  // 17. v41: 모든 [role="button"]에 Enter/Space 키보드 핸들링
  document.querySelectorAll('[role="button"]:not(.nav-item)').forEach(function(el) {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });

  // 18. v41: 활성 nav-item에 aria-current="page" 설정
  var activeNav = document.querySelector('.nav-item.active');
  if (activeNav) activeNav.setAttribute('aria-current', 'page');

  // 19. 모든 인터랙티브 요소에 aria-label 일괄 보강
  var emojiLabel = {'Dark':'다크/라이트 테마 전환','Light':'다크/라이트 테마 전환','☰':'메뉴 열기','✕':'닫기','↻':'새로고침'};
  document.querySelectorAll('button:not([aria-label]), [role="button"]:not([aria-label]), [onclick]:not([aria-label])').forEach(function(el) {
    if (el.tagName === 'A') return;
    var text = el.textContent.trim();
    if (text.length <= 2 && emojiLabel[text]) { el.setAttribute('aria-label', emojiLabel[text]); return; }
    // Text-bearing controls already have an accessible name. Copying the
    // initial text into aria-label freezes prices and truncates later labels.
  });

  // 20. v41.2: 문서 구조 h1 추가 (스크린리더 페이지 제목)
  if (!document.querySelector('h1')) {
    var h1 = document.createElement('h1');
    h1.textContent = 'AIO Screener - 올인원 투자 터미널';
    h1.className = 'sr-only';
    h1.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    var mc = document.getElementById('main-content');
    if (mc) mc.insertBefore(h1, mc.firstChild);
  }

  // 21. v41.2: 동적 영역 aria-live 확장 (뉴스 티커, 상태 패널, 트레이딩 스코어)
  ['snapshot-stale-warning','data-status-panel','home-risk-regime-badge'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute('aria-live')) { el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true'); }
  });
  var signalDecisionSub = document.querySelector('#score-decision-sub');
  if (signalDecisionSub && !signalDecisionSub.getAttribute('aria-live')) {
    signalDecisionSub.setAttribute('aria-live', 'polite');
    signalDecisionSub.setAttribute('aria-atomic', 'true');
  }

  // 22. v41.2: 모달 포커스 트랩 (dialog 열릴 때 내부에 포커스 가둠)
  document.querySelectorAll('[role="dialog"]').forEach(function(dlg) {
    dlg.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;
      var focusable = dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
  });

  // 23. v54.47: route title is the page-level heading; nested widget titles stay
  // at level 2 so screen-reader navigation follows the visible hierarchy.
  document.querySelectorAll('.page[id]').forEach(function(pg) {
    var firstTitle = pg.querySelector('.page-title,h1');
    if (firstTitle && firstTitle.tagName !== 'H1') {
      firstTitle.setAttribute('role', 'heading');
      firstTitle.setAttribute('aria-level', '1');
    }
    Array.prototype.slice.call(pg.querySelectorAll('.page-title')).forEach(function(pt) {
      if (pt === firstTitle || pt.tagName === 'H1') return;
      if (pt.tagName !== 'H2') {
        pt.setAttribute('role', 'heading');
        pt.setAttribute('aria-level', '2');
      }
    });
  });

  }, 0);
});

// ── v48.92: Fund Analysis 탭 전환 핸들러 ─────────────────────────────────────
// 기업 분석 페이지 섹션 11개를 3개 탭으로 분류 (개요/재무상세/외부정보)
// data-fund-tab 속성으로 탭 그룹 지정, fund-tab-active 클래스로 가시성 제어
window._aioFundTabSwitch = function(tab) {
  if (!tab) return;
  // 1. 모든 섹션의 fund-tab-active 제거 (비활성)
  var allSections = document.querySelectorAll('[data-fund-tab]');
  allSections.forEach(function(el) { el.classList.remove('fund-tab-active'); });
  // 2. 선택된 탭의 섹션에 fund-tab-active 추가 (활성)
  var targetSections = document.querySelectorAll('[data-fund-tab="' + tab + '"]');
  targetSections.forEach(function(el) { el.classList.add('fund-tab-active'); });
  // 3. 탭 버튼 active 상태 갱신
  var allBtns = document.querySelectorAll('.fund-tab-btn');
  allBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // 4. 현재 탭 기억 (페이지 재진입 시 복원용)
  window._aioFundActiveTab = tab;
  // 5. v48.96 P1-6 + v52.28 P644: 현재 보이는 탭 차트만 resize.
  //    Hidden page/tab charts are resized lazily on their own page entry to avoid resize storms.
  setTimeout(function() {
    if (window._aioChartRegistry) { window._aioChartRegistry.resizeAllVisible(); }
    // lightweight-charts 인스턴스 재조정 (fund 섹션 내 lw-chart 컨테이너)
    var lwContainers = document.querySelectorAll('[data-fund-tab="' + tab + '"] [id$="-lw-chart"]');
    lwContainers.forEach(function(container) {
      var chart = container._lwChart;
      if (chart && typeof chart.applyOptions === 'function') {
        var w = container.clientWidth;
        if (w > 0 && container.offsetParent !== null) { try { chart.applyOptions({ width: w }); } catch(e) {} }
      }
    });
  }, 50);
};

// v49.2: Institutional Technical Brief renderers
window._techBriefChartInstances = window._techBriefChartInstances || [];
function _itbSafeRemoveChart(chart) {
  if (!chart || chart.__aioDisposed) return;
  chart.__aioDisposed = true;
  try { chart.remove(); } catch(e) {}
}

function _itbNum(v, digits) {
  if (v === null || v === undefined || !isFinite(Number(v))) return '--';
  return Number(v).toFixed(digits == null ? 2 : digits);
}

function _itbBadge(label, tone) {
  var color = tone === 'risk' ? 'var(--data-red)' : tone === 'warn' ? 'var(--data-amber)' : tone === 'bull' ? 'var(--data-green)' : 'var(--data-cyan)';
  return '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;background:' + color + '1f;color:' + color + ';border:1px solid ' + color + '55;font-size:10px;font-weight:800;">' + escHtml(label) + '</span>';
}

function _itbActionTone(action) {
  if (action === 'EXIT_OR_HEDGE' || action === 'TRIM_50') return 'risk';
  if (action === 'TRIM_25_33' || action === 'NO_ADD_RAISE_STOP') return 'warn';
  return 'bull';
}

function renderDataQualityBadge(quality) {
  quality = quality || {};
  if ((quality.policyKey || quality.value !== undefined) && window.calcDataQuality) {
    try { quality = window.calcDataQuality(quality); } catch(_) {}
  }
  var confNum = typeof quality.confidence === 'number' ? quality.confidence : (quality.confidence === 'high' ? 90 : quality.confidence === 'medium' ? 65 : quality.confidence === 'low' ? 35 : null);
  var label = quality.label || (confNum >= 80 ? 'HIGH' : confNum >= 55 ? 'MEDIUM' : confNum >= 30 ? 'LOW' : 'UNKNOWN');
  var tone = label === 'HIGH' ? 'bull' : label === 'MEDIUM' ? 'warn' : 'risk';
  var conf = confNum !== null ? ' ' + _itbNum(confNum, 0) + '%' : '';
  var source = quality.source ? ' · ' + quality.source : '';
  return _itbBadge('Data ' + label + conf, tone) + '<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">' + escHtml((quality.freshness || 'UNKNOWN') + source) + '</span>';
}

function renderNewsImpactBadge(vector) {
  vector = vector || {};
  var urgency = Number(vector.urgency || 0);
  var tone = urgency >= 70 || vector.technicalImpact === 'EXIT_RISK' ? 'risk' : urgency >= 45 ? 'warn' : 'bull';
  return _itbBadge((vector.factor || 'GENERAL') + ' ' + Math.round(urgency), tone);
}

function renderPortfolioTechnicalRisk(result) {
  var el = document.getElementById('pf-technical-risk');
  if (!el) return;
  result = result || {};
  if (!result.items || !result.items.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">포지션별 OHLCV가 확보되면 기술적 매도압력과 집중 리스크를 함께 계산합니다.</div>';
    return;
  }
  var tone = result.heatScore >= 58 ? 'risk' : result.heatScore >= 38 ? 'warn' : 'bull';
  var rows = result.items.slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); }).map(function(item) {
    var rowTone = _itbActionTone(item.action);
    return '<tr style="border-top:1px solid rgba(255,255,255,0.06);">' +
      '<td style="padding:6px 4px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + escHtml(item.ticker || '-') + '</td>' +
      '<td style="padding:6px 4px;text-align:right;font-family:var(--font-mono);">' + _itbNum(item.weightPct, 1) + '%</td>' +
      '<td style="padding:6px 4px;text-align:right;font-family:var(--font-mono);color:' + ((item.pnlPct || 0) >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' + _itbNum(item.pnlPct, 1) + '%</td>' +
      '<td style="padding:6px 4px;text-align:right;font-family:var(--font-mono);font-weight:900;">' + _itbNum(item.score, 0) + '</td>' +
      '<td style="padding:6px 4px;">' + _itbBadge(item.action || 'HOLD_CORE', rowTone) + '</td>' +
    '</tr>';
  }).join('');
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">' +
    '<div>' + _itbBadge(result.state || 'PORTFOLIO_HEAT_NORMAL', tone) + '<span style="margin-left:8px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbNum(result.heatScore, 0) + '/100</span></div>' +
    _itbBadge(result.action || 'HOLD_CORE', _itbActionTone(result.action)) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-bottom:8px;">통계 리스크(VaR/Sharpe/MDD)에 10EMA/21EMA/50SMA 이탈, ATR 과열, 보유 비중을 결합한 포지션 단위 기술 리스크입니다.</div>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text-muted);text-align:left;"><th style="padding:4px;">Ticker</th><th style="padding:4px;text-align:right;">Weight</th><th style="padding:4px;text-align:right;">P/L</th><th style="padding:4px;text-align:right;">Risk</th><th style="padding:4px;">Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function _itbRenderMiniChart(slotId, label, ohlcv) {
  var el = document.getElementById(slotId);
  if (!el) return;
  el.innerHTML = '<div style="height:22px;padding:5px 7px;font-size:10px;font-weight:800;color:var(--text-muted);display:flex;justify-content:space-between;"><span>' + escHtml(label) + '</span><span>OHLCV</span></div><div class="itb-chart-body" style="height:166px;"></div>';
  var body = el.querySelector('.itb-chart-body');
  var bars = (ohlcv || []).slice(-160);
  if (!body || !bars.length) {
    el.innerHTML += '<div style="padding:18px 8px;font-size:11px;color:var(--text-muted);">Chart data unavailable</div>';
    return;
  }
  if (typeof LightweightCharts === 'undefined') {
    var w = Math.max(240, body.clientWidth || 260), h = 166, pad = 10;
    var closes = bars.map(function(d) { return d.close; });
    var min = Math.min.apply(null, bars.map(function(d) { return d.low; }));
    var max = Math.max.apply(null, bars.map(function(d) { return d.high; }));
    var span = Math.max(0.0001, max - min);
    function x(i) { return pad + (i / Math.max(1, bars.length - 1)) * (w - pad * 2); }
    function y(v) { return h - pad - ((v - min) / span) * (h - pad * 2); }
    var line = closes.map(function(v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var step = Math.max(2, (w - pad * 2) / bars.length);
    var candles = bars.filter(function(_, i) { return i % Math.ceil(bars.length / 60) === 0 || i === bars.length - 1; }).map(function(d, i) {
      var idx = bars.indexOf(d), cx = x(idx), yo = y(d.open), yc = y(d.close), yh = y(d.high), yl = y(d.low);
      var up = d.close >= d.open, color = up ? '#00e5a0' : '#ff5b50';
      var top = Math.min(yo, yc), height = Math.max(1, Math.abs(yo - yc));
      return '<line x1="' + cx.toFixed(1) + '" y1="' + yh.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + yl.toFixed(1) + '" stroke="' + color + '" stroke-opacity=".65"/>' +
        '<rect x="' + (cx - step * 0.35).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + (step * 0.7).toFixed(1) + '" height="' + height.toFixed(1) + '" fill="' + color + '" opacity=".85"/>';
    }).join('');
    body.innerHTML = '<svg role="img" aria-label="' + escHtml(label) + ' fallback OHLC chart" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="166" style="display:block;background:#0b1222;">' +
      '<path d="' + line + '" fill="none" stroke="#00bcd4" stroke-width="1.4" opacity=".75"/>' + candles +
      '<text x="10" y="158" fill="#8fa3b5" font-size="10">SVG fallback</text></svg>';
    return;
  }
  try {
    var chart = LightweightCharts.createChart(body, {
      width: body.clientWidth || 260,
      height: 166,
      layout: { background: { color: '#0b1222' }, textColor: '#8fa3b5' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.08, bottom: 0.18 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: false },
      crosshair: { mode: 0 }
    });
    window._techBriefChartInstances.push(chart);
    var cs = chart.addCandlestickSeries({ upColor: '#00e5a0', downColor: '#ff5b50', borderUpColor: '#00e5a0', borderDownColor: '#ff5b50', wickUpColor: '#00e5a0', wickDownColor: '#ff5b50' });
    cs.setData(bars.map(function(d) { return { time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }; }));
    var closes = bars.map(function(d) { return d.close; });
    var ema10 = _calcEMAFull(closes, 10) || [];
    var ema21 = _calcEMAFull(closes, 21) || [];
    var l10 = chart.addLineSeries({ color: '#ffa31a', lineWidth: 1, priceLineVisible: false });
    var l21 = chart.addLineSeries({ color: '#4da6ff', lineWidth: 1, priceLineVisible: false });
    l10.setData(ema10.map(function(v, i) { return v ? { time: bars[i].time, value: v } : null; }).filter(Boolean));
    l21.setData(ema21.map(function(v, i) { return v ? { time: bars[i].time, value: v } : null; }).filter(Boolean));
    chart.timeScale().fitContent();
    if (typeof window._aioMarkChartCanvases === 'function') window._aioMarkChartCanvases(el, label + ' technical brief chart');
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'ITB chart failed: ' + (e && e.message || e));
  }
}

function renderTechnicalRegimeRow(result) {
  var el = document.getElementById('tech-brief-regime-row');
  if (!el || !result) return;
  var s = result.snapshot || {};
  var sp = result.sellPressure || {};
  var heat = result.semiHeat || {};
  var regimeTone = s.above50SMA === false ? 'risk' : sp.score >= 38 ? 'warn' : 'bull';
  el.innerHTML =
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Action</div><div style="margin-top:4px;">' + _itbBadge(sp.action || 'HOLD_CORE', _itbActionTone(sp.action)) + '</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Sell Pressure</div><div style="font-size:18px;font-weight:900;color:var(--text-primary);font-family:var(--font-mono);">' + _itbNum(sp.score, 0) + '/100</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Trend Regime</div><div style="margin-top:4px;">' + _itbBadge((s.above50SMA === false ? 'Below 50SMA' : 'Above key MAs'), regimeTone) + '</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Semi Heat</div><div style="margin-top:4px;">' + _itbBadge(heat.state || 'DATA', heat.state === 'SEMI_MANIA' ? 'risk' : heat.state === 'SEMI_HEATED' ? 'warn' : 'bull') + '</div></div>';
}

function renderKeyLevelsPanel(snapshot) {
  var el = document.getElementById('tech-brief-key-levels');
  if (!el) return;
  if (!snapshot || !snapshot.ok) { el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">Key levels unavailable</div>'; return; }
  var rows = [
    ['Price', snapshot.price],
    ['10EMA', snapshot.ema10],
    ['21EMA', snapshot.ema21],
    ['50SMA', snapshot.sma50],
    ['20D High', snapshot.recentHigh20],
    ['20D Low', snapshot.recentLow20],
    ['ATR(14)', snapshot.atr14]
  ];
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Key Levels</div>' +
    rows.map(function(r) { return '<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding:3px 0;font-size:11px;"><span style="color:var(--text-muted);">' + r[0] + '</span><span style="font-family:var(--font-mono);font-weight:800;color:var(--text-primary);">' + _itbNum(r[1], 2) + '</span></div>'; }).join('');
}

function renderSellPressurePanel(sellPressure) {
  var el = document.getElementById('tech-brief-sell-pressure');
  if (!el) return;
  sellPressure = sellPressure || {};
  var tone = _itbActionTone(sellPressure.action);
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Sell Pressure</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;"><span style="font-size:22px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(sellPressure.score, 0) + '</span>' + _itbBadge(sellPressure.action || 'HOLD_CORE', tone) + '</div>' +
    '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + (sellPressure.flags || []).slice(0, 6).map(function(f) { return _itbBadge(f.replace(/_/g, ' '), f.indexOf('DAMAGED') >= 0 || f.indexOf('CLIMAX') >= 0 ? 'risk' : 'warn'); }).join('') + '</div>';
}

function renderExitPlanPanel(plan) {
  var el = document.getElementById('tech-brief-exit-plan');
  if (!el) return;
  plan = plan || {};
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Exit Plan</div>' +
    '<div style="font-size:11px;color:var(--text-primary);line-height:1.5;font-weight:700;margin-bottom:7px;">' + escHtml(plan.primary || 'No plan available') + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;">' + escHtml(plan.tradingLot || '') + '<br>' + escHtml(plan.swingLot || '') + '<br>' + escHtml(plan.thesisLine || '') + '</div>';
}

function renderBeginnerExplanation(result) {
  var el = document.getElementById('tech-brief-beginner');
  if (!el || !result) return;
  var s = result.snapshot || {}, sp = result.sellPressure || {}, plan = result.exitPlan || {};
  el.innerHTML = '<b style="color:var(--data-cyan);">Beginner translation:</b> RSI 70+ 자체는 매도 버튼이 아닙니다. 강한 장에서는 과열이 오래 유지될 수 있습니다. 지금 엔진은 50일선 대비 ATR 이격(' + _itbNum(s.dist50Atr, 1) + 'x), RVOL(' + _itbNum(s.rvol20, 1) + 'x), 종가 위치(' + _itbNum((s.closePosition || 0) * 100, 0) + '%), 볼린저 재진입, 10/21/50선 이탈을 함께 보고 <b>' + escHtml(sp.action || 'HOLD_CORE') + '</b>로 결론냅니다. ' + escHtml(plan.beginner || '');
}

function _renderSemiHeatPanel(heat) {
  var el = document.getElementById('tech-brief-semi-heat');
  if (!el) return;
  heat = heat || {};
  var tone = heat.state === 'SEMI_MANIA' ? 'risk' : heat.state === 'SEMI_HEATED' ? 'warn' : 'bull';
  var ai = heat && heat.aiInfraHeat ? heat.aiInfraHeat : null;
  var aiTone = ai && ai.state === 'AI_INFRA_MANIA' ? 'risk' : ai && ai.state === 'AI_INFRA_HEATED' ? 'warn' : 'bull';
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Semiconductor Heat</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">' + _itbBadge(heat.state || 'DATA', tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(heat.score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;">RS vs SPY/QQQ: ' + _itbNum(heat.relativeStrengthPct, 2) + '%<br>Max 50SMA extension: ' + _itbNum(heat.maxDist50Atr, 1) + ' ATR<br>Max RSI: ' + _itbNum(heat.maxRsi, 1) + '</div>' +
    (ai ? '<div style="margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;"><span style="font-size:10px;font-weight:900;color:var(--text-secondary);">AI Infra Heat</span>' + _itbBadge(ai.state || 'DATA', aiTone) + '</div><div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:5px;">Basket: ' + _itbNum(ai.score, 0) + '/100 · overheated ' + _itbNum(ai.overheatCount, 0) + '/' + _itbNum(ai.count, 0) + '</div>' : '');
}

function _renderFlagList(flags, riskWords) {
  flags = flags || [];
  riskWords = riskWords || /RISK|FAILED|BELOW|UNWIND|EXHAUSTION|BLOWOFF|TRIM|EXIT/i;
  return '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px;">' +
    flags.slice(0, 8).map(function(f) {
      var tone = riskWords.test(String(f)) ? 'risk' : /WARNING|DECAY|EXTENDED|WATCH|PIN/i.test(String(f)) ? 'warn' : 'bull';
      return _itbBadge(String(f).replace(/_/g, ' '), tone);
    }).join('') + '</div>';
}

function renderLockoutDashboard(result) {
  result = result || {};
  var lock = result.lockoutAction || {};
  var ext = result.extensionHeat || {};
  var candle = result.candleRisk || {};
  var opex = result.opexGammaRisk || {};
  var breadth = result.breadthRotation || {};
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Lockout Action</div><div style="margin-top:5px;">' + _itbBadge(lock.action || 'HOLD_CORE', _itbActionTone(lock.action)) + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Regime</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + escHtml(lock.regime || 'LOCKOUT_CONTINUATION') + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Risk</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbNum(lock.score, 0) + '/100</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">OPEX</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + escHtml(opex.daysToOpex == null ? 'n/a' : ('D-' + opex.daysToOpex)) + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Candle</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + escHtml(candle.type || 'NEUTRAL') + '</div></div>' +
  '</div>' +
  '<div style="font-size:10px;color:var(--text-muted);line-height:1.55;margin-top:8px;">Lockout rallies do not end because RSI is hot. Risk rises when demand weakens, breakouts fail, OPEX gamma support decays, or price loses the 10/21/50-day lines.</div>' +
  _renderFlagList([].concat(lock.flags || [], ext.flags || [], breadth.flags || []).slice(0, 10));
  ['tech-lockout-dashboard', 'signal-lockout-dashboard'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function renderBlowoffTopPanel(blowoffTop) {
  var el = document.getElementById('tech-blowoff-top-panel');
  if (!el) return;
  blowoffTop = blowoffTop || {};
  var tone = blowoffTop.action === 'TRIM_50' || blowoffTop.action === 'EXIT_OR_HEDGE'
    ? 'risk'
    : blowoffTop.action === 'TRIM_25_33' || blowoffTop.action === 'NO_ADD_RAISE_STOP'
      ? 'warn'
      : 'bull';
  var checks = blowoffTop.checks || [];
  var supports = blowoffTop.supports || [];
  var eventCtx = blowoffTop.eventContext || {};
  function renderLine(item, positive) {
    var ok = !!(item && item.ok);
    var color = positive ? (ok ? '#5cff95' : '#8fa3b5') : (ok ? '#ff6b6b' : '#8fa3b5');
    var dot = positive ? (ok ? '●' : '○') : (ok ? '●' : '○');
    return '<div style="display:flex;gap:7px;align-items:flex-start;font-size:11px;line-height:1.55;margin:6px 0;color:var(--text-secondary);">' +
      '<span aria-hidden="true" style="color:' + color + ';font-size:12px;line-height:1.3;">' + dot + '</span>' +
      '<span><b style="color:' + color + ';">' + escHtml(item && item.label || '--') + '</b><br><span style="color:var(--text-muted);">' + escHtml(item && item.detail || '') + '</span></span>' +
    '</div>';
  }
  var timeline = (eventCtx.timeline || []).map(function(e) {
    var etone = e.tone === 'risk' ? 'risk' : e.tone === 'hope' ? 'bull' : 'warn';
    return '<div style="border-left:2px solid ' + (etone === 'risk' ? '#ff5b50' : etone === 'bull' ? '#5cff95' : '#f6c85f') + ';padding:4px 0 5px 8px;">' +
      '<div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);">' + escHtml(e.date || '') + '</div>' +
      '<div style="font-size:11px;font-weight:800;color:var(--text-primary);">' + escHtml(e.label || '') + '</div>' +
    '</div>';
  }).join('');
  el.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<div><div style="font-size:10px;font-weight:900;color:var(--data-cyan);letter-spacing:.18em;">BLOW-OFF TOP CHECKLIST</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">이격 과열, CPI/유가, OPEX, 이벤트 소진을 한 화면에서 확인합니다.</div></div>' +
      '<div style="display:flex;gap:6px;align-items:center;">' + _itbBadge(blowoffTop.state || 'DATA', tone) + _itbBadge(blowoffTop.action || 'HOLD_CORE', tone) + '<span style="font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbNum(blowoffTop.score, 0) + '/100</span></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">' +
      '<div style="background:#0e1622;border:1px solid rgba(255,91,80,0.28);border-radius:3px;padding:10px;border-left:3px solid #ff5b50;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:5px;">현재 충족 조건 (위험 신호)</div>' +
        checks.map(function(c) { return renderLine(c, false); }).join('') +
      '</div>' +
      '<div style="background:#0e1622;border:1px solid rgba(92,255,149,0.24);border-radius:3px;padding:10px;border-left:3px solid #5cff95;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:5px;">아직 미충족 조건 (상승 유지 근거)</div>' +
        supports.map(function(c) { return renderLine(c, true); }).join('') +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:10px;">' +
      '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.07);border-radius:3px;padding:10px;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:7px;">Event Runway</div>' + (timeline || '<div style="font-size:11px;color:var(--text-muted);">No event context</div>') +
      '</div>' +
      '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.07);border-radius:3px;padding:10px;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:7px;">Beginner Translation</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);line-height:1.65;">상승장이 강해도 가격이 20일선·50일선에서 너무 멀고, 거래량 급증 뒤 종가가 약하거나 이벤트가 끝나면 추격매수보다 스탑 상향과 일부 익절이 먼저입니다. 반대로 10/21EMA와 수급 확산이 살아 있으면 전량 매도 신호로 보지 않습니다.</div>' +
      '</div>' +
    '</div>';
}

function _renderMiniPanel(elId, title, badge, tone, score, metricsHtml, flags) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML =
    '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">' + title + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' + _itbBadge(badge, tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:7px;">' + metricsHtml + '</div>' +
    _renderFlagList(flags);
}

function renderExtensionHeatPanel(extensionHeat) {
  extensionHeat = extensionHeat || {};
  var tone = extensionHeat.score >= 50 ? 'risk' : extensionHeat.score >= 25 ? 'warn' : 'bull';
  _renderMiniPanel('tech-lockout-extension', 'Extension Heat', extensionHeat.state || 'NORMAL', tone, extensionHeat.score,
    '20MA ATR: ' + _itbNum(extensionHeat.dist20Atr, 1) + 'x<br>20MA ADR: ' + _itbNum(extensionHeat.dist20Adr, 1) + 'x<br>50SMA ATR: ' + _itbNum(extensionHeat.dist50Atr, 1) + 'x',
    extensionHeat.flags);
}

function renderOpexGammaPanel(opexGamma) {
  opexGamma = opexGamma || {};
  var tone = opexGamma.regime === 'GAMMA_UNWIND_RISK' ? 'risk' : opexGamma.regime === 'GAMMA_DECAY_WATCH' ? 'warn' : 'bull';
  _renderMiniPanel('tech-lockout-opex', 'OPEX / Gamma', opexGamma.regime || 'GAMMA_SUPPORT', tone, opexGamma.score,
    'Next OPEX: ' + escHtml(opexGamma.nextOpexDate || '--') + '<br>Equity PCR: ' + _itbNum(opexGamma.equityPutCall, 2) + '<br>Index PCR: ' + _itbNum(opexGamma.indexPutCall, 2),
    opexGamma.flags);
}

function renderBreadthRotationPanel(breadthRotation) {
  breadthRotation = breadthRotation || {};
  var tone = breadthRotation.regime === 'FAILED_ROTATION' ? 'risk' : breadthRotation.regime === 'BREADTH_BROADENING' ? 'bull' : 'warn';
  _renderMiniPanel('tech-lockout-breadth', 'Breadth / Rotation', breadthRotation.regime || 'NARROW_LEADERSHIP', tone, breadthRotation.score,
    'IWM vs QQQ: ' + _itbNum(breadthRotation.iwmVsQqqRS_5d, 2) + '%<br>RSP vs SPY: ' + _itbNum(breadthRotation.rspVsSpyRS_5d, 2) + '%',
    breadthRotation.flags);
}

function renderCandleRiskBadge(candleRisk) {
  candleRisk = candleRisk || {};
  var m = candleRisk.metrics || {};
  var tone = candleRisk.score >= 55 ? 'risk' : candleRisk.score >= 25 ? 'warn' : 'bull';
  _renderMiniPanel('tech-lockout-candle', 'Terminal Candle', candleRisk.type || 'NEUTRAL', tone, candleRisk.score,
    'Close position: ' + _itbNum((m.closePosition || 0) * 100, 0) + '%<br>Upper wick: ' + _itbNum((m.upperWickPct || 0) * 100, 0) + '%<br>Gap: ' + _itbNum(m.gapUpPct, 2) + '%',
    candleRisk.flags);
}

function renderTechnicalBrief(symbol, result) {
  result = result || {};
  var s = result.snapshot;
  renderTechnicalRegimeRow(result);
  var qEl = document.getElementById('tech-brief-data-quality');
  if (qEl) qEl.innerHTML = renderDataQualityBadge(result.dataQuality || (s && s.raw && s.raw.dataQuality));
  renderKeyLevelsPanel(s);
  renderSellPressurePanel(result.sellPressure);
  renderExitPlanPanel(result.exitPlan);
  _renderSemiHeatPanel(result.semiHeat);
  renderLockoutDashboard(result);
  renderBlowoffTopPanel(result.blowoffTop);
  renderExtensionHeatPanel(result.extensionHeat);
  renderOpexGammaPanel(result.opexGammaRisk);
  renderBreadthRotationPanel(result.breadthRotation);
  renderCandleRiskBadge(result.candleRisk);
  renderBeginnerExplanation(result);
  window._techBriefChartInstances.forEach(_itbSafeRemoveChart);
  window._techBriefChartInstances = [];
  _itbRenderMiniChart('tech-brief-chart-monthly', symbol + ' Monthly', result.monthly || []);
  _itbRenderMiniChart('tech-brief-chart-weekly', symbol + ' Weekly', result.weekly || []);
  _itbRenderMiniChart('tech-brief-chart-daily', symbol + ' Daily', result.daily || []);
  _itbRenderMiniChart('tech-brief-chart-zoom', symbol + ' Zoom', (result.daily || []).slice(-50));
}

async function runInstitutionalTechnicalBrief(arg) {
  var symbol = (typeof arg === 'string' ? arg : '').trim().toUpperCase();
  if (!symbol) {
    var input = document.getElementById('tech-brief-symbol');
    var signalInput = document.getElementById('signal-lockout-symbol');
    var techVal = input && input.value ? input.value : '';
    var signalVal = signalInput && signalInput.value ? signalInput.value : '';
    symbol = ((signalVal && (!techVal || techVal.toUpperCase() === 'NVDA')) ? signalVal : (techVal || signalVal || 'NVDA')).trim().toUpperCase();
  }
  if (!symbol || symbol === '[OBJECT HTMLBUTTONELEMENT]') symbol = 'NVDA';
  var row = document.getElementById('tech-brief-regime-row');
  if (row) row.innerHTML = '<div style="grid-column:1/-1;padding:10px;color:var(--text-muted);font-size:11px;">Institutional technical brief input pending for ' + escHtml(symbol) + '...</div>';
  try {
    var fetcher = window.fetchOHLCVWithFallback || window.fetchOHLCV;
    var settled = await Promise.allSettled([
      fetcher(symbol, '1month', 80),
      fetcher(symbol, '1week', 160),
      fetcher(symbol, '1day', 260),
      fetcher('SPY', '1day', 220),
      fetcher('QQQ', '1day', 220),
      fetcher('SMH', '1day', 220),
      fetcher('SOXX', '1day', 220),
      fetcher('IWM', '1day', 220),
      fetcher('RSP', '1day', 220),
      fetcher('KRE', '1day', 220),
      fetcher('XBI', '1day', 220)
    ]);
    var data = settled.map(function(r) { return r.status === 'fulfilled' ? (r.value || []) : []; });
    var aiSymbols = ['NVDA','AVGO','AMD','MU','TSM','ASML','MRVL','ARM','ALAB','CRDO'];
    var aiSettled = await Promise.allSettled(aiSymbols.map(function(t) { return fetcher(t, '1day', 160); }));
    var aiSnaps = {};
    aiSettled.forEach(function(r, i) { aiSnaps[aiSymbols[i]] = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(r.status === 'fulfilled' ? (r.value || []) : []) : { ok: false }; });
    var daily = data[2] || [];
    var snapshot = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(daily) : { ok: false };
    var spySnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[3] || []) : { ok: false };
    var qqqSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[4] || []) : { ok: false };
    var smhSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[5] || []) : { ok: false };
    var soxxSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[6] || []) : { ok: false };
    var iwmSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[7] || []) : { ok: false };
    var rspSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[8] || []) : { ok: false };
    var kreSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[9] || []) : { ok: false };
    var xbiSnap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(data[10] || []) : { ok: false };
    var semiHeat = window.calcSemiHeatMap ? window.calcSemiHeatMap(spySnap, qqqSnap, smhSnap, soxxSnap) : null;
    if (semiHeat && window.calcAIInfraHeat) semiHeat.aiInfraHeat = window.calcAIInfraHeat(aiSnaps, qqqSnap, spySnap);
    var extensionHeat = window.calcExtensionHeat ? window.calcExtensionHeat(snapshot) : null;
    var candleRisk = window.classifyTerminalCandle ? window.classifyTerminalCandle(snapshot && snapshot.lastBar, snapshot && snapshot.prevBar, snapshot) : null;
    var optionSentiment = window.fetchOptionSentiment ? await window.fetchOptionSentiment() : { opex: {}, putCall: {} };
    var opexGammaRisk = window.calcOpexGammaRisk ? window.calcOpexGammaRisk({
      daysToOpex: optionSentiment.opex && optionSentiment.opex.daysToOpex,
      nextOpexDate: optionSentiment.opex && optionSentiment.opex.nextOpexDate,
      equityPutCall: optionSentiment.putCall && optionSentiment.putCall.equityPutCall,
      indexPutCall: optionSentiment.putCall && optionSentiment.putCall.indexPutCall,
      totalPutCall: optionSentiment.putCall && optionSentiment.putCall.totalPutCall,
      vixRisingWhileIndexUp: false,
      dataQuality: optionSentiment.putCall && optionSentiment.putCall.dataQuality
    }) : null;
    var breadthRotation = window.calcBreadthRotation ? window.calcBreadthRotation({
      iwmUp: !!(iwmSnap && iwmSnap.ok && iwmSnap.dayGainPct > 0),
      rspUp: !!(rspSnap && rspSnap.ok && rspSnap.dayGainPct > 0),
      kreUp: !!(kreSnap && kreSnap.ok && kreSnap.dayGainPct > 0),
      xbiUp: !!(xbiSnap && xbiSnap.ok && xbiSnap.dayGainPct > 0),
      kreDown: !!(kreSnap && kreSnap.ok && kreSnap.dayGainPct < 0),
      xbiDown: !!(xbiSnap && xbiSnap.ok && xbiSnap.dayGainPct < 0),
      qqqUpButBreadthDown: !!(qqqSnap && qqqSnap.ok && qqqSnap.dayGainPct > 0 && iwmSnap && iwmSnap.ok && iwmSnap.dayGainPct < 0 && rspSnap && rspSnap.ok && rspSnap.dayGainPct < 0),
      iwmVsQqqRS_5d: (iwmSnap.dayGainPct || 0) - (qqqSnap.dayGainPct || 0),
      rspVsSpyRS_5d: (rspSnap.dayGainPct || 0) - (spySnap.dayGainPct || 0),
      smhSidewaysNotDown: !!(smhSnap && smhSnap.ok && smhSnap.dayGainPct > -1)
    }) : null;
    // Missing reference context must remain missing.  In particular, an
    // unavailable AI-infrastructure basket is not evidence of zero heat and
    // must not silently lower the lockout score or appear as a numeric signal.
    var semiScore = semiHeat && semiHeat.state !== 'DATA_INSUFFICIENT' && typeof semiHeat.score === 'number' && isFinite(semiHeat.score) ? semiHeat.score : null;
    var aiHeat = semiHeat && semiHeat.aiInfraHeat ? semiHeat.aiInfraHeat : null;
    var aiScore = aiHeat && aiHeat.scoreAvailable === true && typeof aiHeat.score === 'number' && isFinite(aiHeat.score) ? aiHeat.score : null;
    var portfolioExposureFlags = semiHeat && semiHeat.state ? ['SEMI_CONTEXT_' + semiHeat.state] : [];
    if (semiScore == null) portfolioExposureFlags.push('SEMI_DATA_INSUFFICIENT');
    if (aiHeat && aiScore == null) portfolioExposureFlags.push('AI_INFRA_DATA_INSUFFICIENT');
    var portfolioExposure = {
      score: semiScore == null ? null : Math.min(100, semiScore + (aiScore == null ? 0 : aiScore * 0.35)),
      scoreAvailable: semiScore != null,
      allowedUse: 'reference',
      referenceOnly: true,
      flags: portfolioExposureFlags
    };
    var lockoutAction = window.calcLockoutAction ? window.calcLockoutAction({ extension: extensionHeat, candle: candleRisk, opexGamma: opexGammaRisk, breadth: breadthRotation, portfolioExposure: portfolioExposure }) : null;
    var blowoffTop = window.calcBlowoffTopChecklist ? window.calcBlowoffTopChecklist(snapshot, {
      semiHeat: semiHeat,
      opexGammaRisk: opexGammaRisk,
      breadthRotation: breadthRotation,
      weeklyOhlcv: data[1] || [],
      referenceDate: window.AIO_EVENT_RISK_CONTEXT && window.AIO_EVENT_RISK_CONTEXT.asOf
    }) : null;
    var sellPressure = window.calcSellPressure ? window.calcSellPressure(snapshot, { semiHeat: semiHeat, lockoutAction: lockoutAction, blowoffTop: blowoffTop }) : null;
    var regime = snapshot && snapshot.above50SMA === false ? 'TREND_DAMAGED' : semiHeat && semiHeat.state === 'SEMI_MANIA' ? 'LOCKOUT_RALLY_RISK' : 'TREND_FOLLOW';
    var exitPlan = window.calcExitPlan ? window.calcExitPlan(snapshot, sellPressure, regime) : null;
    var result = { monthly: data[0] || [], weekly: data[1] || [], daily: daily, snapshot: snapshot, semiHeat: semiHeat, extensionHeat: extensionHeat, candleRisk: candleRisk, opexGammaRisk: opexGammaRisk, breadthRotation: breadthRotation, lockoutAction: lockoutAction, blowoffTop: blowoffTop, sellPressure: sellPressure, exitPlan: exitPlan, dataQuality: daily.dataQuality || null, optionSentiment: optionSentiment };
    window._lastTechnicalBrief = { symbol: symbol, result: result, ts: Date.now() };
    renderTechnicalBrief(symbol, result);
  } catch(e) {
    if (typeof _aioLog === 'function') _aioLog('error', 'render', 'runInstitutionalTechnicalBrief failed: ' + (e && e.message || e));
    if (row) row.innerHTML = '<div style="grid-column:1/-1;padding:10px;color:var(--data-red);font-size:11px;">Technical brief failed gracefully. Try another ticker.</div>';
  }
}

window.renderTechnicalBrief = renderTechnicalBrief;
window.renderTechnicalRegimeRow = renderTechnicalRegimeRow;
window.renderSellPressurePanel = renderSellPressurePanel;
window.renderExitPlanPanel = renderExitPlanPanel;
window.renderKeyLevelsPanel = renderKeyLevelsPanel;
window.renderBeginnerExplanation = renderBeginnerExplanation;
window.renderLockoutDashboard = renderLockoutDashboard;
window.renderBlowoffTopPanel = renderBlowoffTopPanel;
window.renderExtensionHeatPanel = renderExtensionHeatPanel;
window.renderOpexGammaPanel = renderOpexGammaPanel;
window.renderBreadthRotationPanel = renderBreadthRotationPanel;
window.renderCandleRiskBadge = renderCandleRiskBadge;
window.renderDataQualityBadge = renderDataQualityBadge;
window.renderNewsImpactBadge = renderNewsImpactBadge;
window.renderPortfolioTechnicalRisk = renderPortfolioTechnicalRisk;

// ──────────────────────────────────────────────────────────────────────────────
// v50.81 _aioDiagram — 10-type 인라인 SVG 다이어그램 엔진
// 외부 라이브러리 불필요. JS → SVG 문자열 생성 → innerHTML 주입.
// API: window._aioDiagram.render(type, el, data) / .getSvg(type, data)
// 용도: 10개 페이지 시각 패널(Phase2) + AI 채팅 자동 시각화(Phase3)
// ──────────────────────────────────────────────────────────────────────────────
window._aioDiagram = (function () {
  var C = {
    green:  '#10c98b', amber:  '#f59e0b', red:    '#ef4444',
    cyan:   '#00bcd4', blue:   '#3b82f6', muted:  'rgba(255,255,255,0.35)',
    text:   '#dce6f0', bg:     'transparent', bgSolid:'#0d1828', surface:'#0d1828', border: 'rgba(255,255,255,0.10)',
  };
  // P1126/R619: aio-data.js가 먼저 로드되므로 escHtml이 항상 존재한다. 여기서 따로
  // 재구현하지 않는다 — 3-char 버전과 4-char 정본이 갈라지면 SVG/오류 문구만
  // 다른 규칙으로 이스케이프되는 조용한 불일치가 된다.
  function _esc(s) {
    return escHtml(String(s || ''));
  }
  function _n(v, d) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(d || 0) : '—'; }
  function _cl(v, lo, hi) { return Math.max(lo, Math.min(hi, v || 0)); }
  function _pctCol(v) { return v > 0 ? C.green : v < 0 ? C.red : C.muted; }
  function _scoreCol(s) { return s >= 75 ? C.green : s >= 60 ? C.cyan : s >= 45 ? C.amber : C.red; }
  function _alphaRgb(hex, a) {
    // Convert #rrggbb → rgba(r,g,b,a)
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function _svg(w, h, body) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg"' +
      ' style="width:100%;max-width:' + w + 'px;display:block;font-family:\'JetBrains Mono\',\'Fira Code\',\'D2Coding\',\'Malgun Gothic\',\'맑은 고딕\',monospace"' +
      ' font-size="10">' + body + '</svg>';
  }
  function _r(x, y, w, h, fill, rx, stroke, sw) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' +
      (rx ? ' rx="' + rx + '"' : '') + ' fill="' + fill + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '') + '/>';
  }
  function _t(x, y, s, fill, fs, fw, anchor) {
    return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="' + (fs || 10) + '"' +
      (fw ? ' font-weight="' + fw + '"' : '') + (anchor ? ' text-anchor="' + anchor + '"' : '') +
      '>' + _esc(s) + '</text>';
  }
  function _l(x1, y1, x2, y2, stroke, sw) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"/>';
  }
  function _o(cx, cy, r, fill, stroke, sw) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (fill || 'none') + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '') + '/>';
  }

  // ── 1. score-breakdown: 거래 점수 분해 플로우 ─────────────────
  function _scoreBreakdown(d) {
    var total = _cl(d.total || 0, 0, 100);
    var comps = d.components || [
      { label: 'VIX 레짐',   value: d.vixScore || 0,  max: 20 },
      { label: 'SPX 추세',   value: d.spxScore || 0,  max: 20 },
      { label: '시장 폭',    value: d.breadth  || 0,  max: 20 },
      { label: 'F&G 심리',  value: d.fg       || 0,  max: 20 },
      { label: 'M7 모멘텀', value: d.m7       || 0,  max: 20 },
    ];
    var col = _scoreCol(total);
    var W = 460, H = 200, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 20, '거래 점수 분해', C.text, 10, 700);
    var cx = 390, cy = 100, r = 46;
    out += _o(cx, cy, r, _alphaRgb(C.bgSolid, 0.6), col, 2.5);
    out += _t(cx, cy - 3, _n(total), col, 26, 900, 'middle');
    out += _t(cx, cy + 14, '/ 100', C.muted, 10, 400, 'middle');
    var band = total >= 75 ? '환경 우호' : total >= 60 ? '환경 양호' : total >= 45 ? '중립' : total >= 30 ? '주의' : '위험';
    out += _r(cx - 32, cy + 22, 64, 15, _alphaRgb(col, 0.14), 4, col, 1);
    out += _t(cx, cy + 33, band, col, 10, 700, 'middle');
    var y0 = 34;
    comps.forEach(function (c, i) {
      var y = y0 + i * 30;
      var pct = _cl(c.value / (c.max || 20), 0, 1);
      var cc = _scoreCol(pct * 100);
      out += _t(14, y + 11, c.label, C.muted, 10);
      out += _r(90, y + 3, 190, 10, 'rgba(255,255,255,0.05)', 3);
      out += _r(90, y + 3, Math.round(190 * pct), 10, _alphaRgb(cc, 0.65), 3);
      out += _t(286, y + 12, _n(c.value, 0) + '/' + c.max, cc, 10, 700);
      if (i === 2) out += _l(310, y + 8, 352, cy, 'rgba(255,255,255,0.1)');
    });
    out += _l(310, 44, 348, cy, 'rgba(255,255,255,0.06)');
    out += _l(310, 164, 348, cy, 'rgba(255,255,255,0.06)');
    return _svg(W, H, out);
  }

  // ── 2. market-regime: 시장 레짐 포지셔닝 사분면 ──────────────
  function _marketRegime(d) {
    var regime = d.regime || 'NEUTRAL';
    var score = _cl(d.score || 50, 0, 100);
    var vix = Number(d.vix);
    var spyPct = _cl(d.spyScore || 50, 0, 100);
    var vixPct = _cl(d.vixScore || 50, 0, 100);
    var W = 440, H = 200, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '시장 레짐 포지셔닝', C.text, 10, 700);
    var qx = 110, qy = 26, qw = 200, qh = 155;
    out += _r(qx, qy, qw / 2, qh / 2, _alphaRgb(C.red, 0.07), 0, C.border, 0.5);
    out += _r(qx + qw / 2, qy, qw / 2, qh / 2, _alphaRgb(C.green, 0.07), 0, C.border, 0.5);
    out += _r(qx, qy + qh / 2, qw / 2, qh / 2, _alphaRgb(C.amber, 0.07), 0, C.border, 0.5);
    out += _r(qx + qw / 2, qy + qh / 2, qw / 2, qh / 2, _alphaRgb(C.cyan, 0.07), 0, C.border, 0.5);
    out += _l(qx + qw / 2, qy, qx + qw / 2, qy + qh, 'rgba(255,255,255,0.10)');
    out += _l(qx, qy + qh / 2, qx + qw, qy + qh / 2, 'rgba(255,255,255,0.10)');
    out += _t(qx + qw / 2, qy - 5, '위험선호', C.muted, 10, 600, 'middle');
    out += _t(qx + qw / 2, qy + qh + 12, '위험회피', C.muted, 10, 600, 'middle');
    out += _t(qx + qw / 4, qy + 11, 'Bear Rally', C.red, 10, 600, 'middle');
    out += _t(qx + qw * 3 / 4, qy + 11, 'Bull Trend', C.green, 10, 600, 'middle');
    out += _t(qx + qw / 4, qy + qh - 6, '방어 포지션', C.amber, 10, 600, 'middle');
    out += _t(qx + qw * 3 / 4, qy + qh - 6, '회복 추세', C.cyan, 10, 600, 'middle');
    var dotX = qx + _cl((spyPct / 100) * qw, 8, qw - 8);
    var dotY = qy + _cl(((100 - vixPct) / 100) * qh, 8, qh - 8);
    var col = _scoreCol(score);
    out += _o(dotX, dotY, 9, _alphaRgb(col, 0.18), col, 2);
    out += _o(dotX, dotY, 3.5, col);
    var rx = 332, ry = 56;
    out += _r(rx, ry, 94, 68, _alphaRgb(col, 0.10), 6, col, 1);
    out += _t(rx + 47, ry + 16, regime, col, 10, 700, 'middle');
    out += _t(rx + 47, ry + 31, '점수 ' + _n(score), C.muted, 10, 600, 'middle');
    out += _t(rx + 47, ry + 47, 'VIX ' + _n(vix, 1), vix >= 25 ? C.red : vix >= 18 ? C.amber : C.green, 10, 700, 'middle');
    out += _t(rx + 47, ry + 61, vix >= 25 ? '고변동 경계' : vix >= 18 ? '주의 구간' : '저변동 안정', C.muted, 10, 400, 'middle');
    return _svg(W, H, out);
  }

  // ── 3. factor-radar: 팩터 레이더 (6각형) ─────────────────────
  function _factorRadar(d) {
    var sym = d.sym || '—';
    var f = d.factors || {};
    var axes = [
      { label: '모멘텀', v: f.momentum },
      { label: '추세', v: f.trend },
      { label: '저변동', v: f.lowvol },
      { label: 'RSI', v: f.rsi },
      { label: '퀄리티', v: f.quality },
      { label: '밸류', v: f.value },
    ];
    axes.forEach(function(ax) {
      ax.v = typeof ax.v === 'number' && isFinite(ax.v) ? _cl(ax.v / 100, 0, 1) : null;
      if (ax.v == null) ax.label += ' —';
    });
    var W = 320, H = 240, cx = 160, cy = 130, R = 80, n = axes.length, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(W / 2, 16, sym + ' 팩터 레이더', C.text, 10, 700, 'middle');
    [0.25, 0.5, 0.75, 1].forEach(function (scale) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push((cx + R * scale * Math.cos(a)).toFixed(1) + ',' + (cy + R * scale * Math.sin(a)).toFixed(1));
      }
      out += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,' + (scale === 1 ? 0.12 : 0.05) + ')" stroke-width="1"/>';
    });
    axes.forEach(function (ax, i) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
      out += _l(cx, cy, ex.toFixed(1), ey.toFixed(1), 'rgba(255,255,255,0.07)');
      var lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
      out += _t(lx.toFixed(1), (ly + 3).toFixed(1), ax.label, C.muted, 10, 600, 'middle');
    });
    var pts = axes.map(function (ax, i) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return (cx + R * ax.v * Math.cos(a)).toFixed(1) + ',' + (cy + R * ax.v * Math.sin(a)).toFixed(1);
    });
    if (axes.every(function(ax) { return ax.v != null; })) out += '<polygon points="' + pts.join(' ') + '" fill="' + _alphaRgb(C.cyan, 0.12) + '" stroke="' + C.cyan + '" stroke-width="1.5"/>';
    axes.forEach(function (ax, i) {
      if (ax.v == null) return;
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var px = cx + R * ax.v * Math.cos(a), py = cy + R * ax.v * Math.sin(a);
      var fc = ax.v >= 0.7 ? C.green : ax.v >= 0.4 ? C.amber : C.red;
      out += _o(px.toFixed(1), py.toFixed(1), 3, fc);
    });
    if (d.rank != null) {
      var rc = _scoreCol(d.rank);
      out += _r(W - 66, H - 28, 58, 20, _alphaRgb(rc, 0.14), 4, rc, 1);
      out += _t(W - 37, H - 14, '랭크 ' + d.rank, rc, 10, 700, 'middle');
    }
    return _svg(W, H, out);
  }

  // ── 4. pipeline-status: 데이터 파이프라인 현황 ───────────────
  function _pipelineStatus(d) {
    var meta = d.meta || {};
    var items = [
      { label: 'Yahoo 시세',   ok: (meta.symbolsOk || 0) >= 60, val: (meta.symbolsOk || 0) + ' 심볼' },
      { label: 'Fear & Greed', ok: !!meta.fearGreedOk,           val: d.fg != null ? String(d.fg) : '—' },
      { label: 'FRED 매크로',  ok: !!meta.fredFetchOk,           val: meta.fredHasKey ? (meta.fredFetchOk ? (meta.macroKeyCount || '?') + '개' : '키↑실패') : 'Secret 미등록' },
      { label: '뉴스 RSS',     ok: !!meta.newsOk,                val: (meta.newsCount || 0) + '건' },
      { label: 'Telegram',     ok: !!d.telegramOk,               val: d.telegramCount ? d.telegramCount + '건' : '—' },
      { label: 'Screener',     ok: !!d.screenerOk,               val: d.screenerCount ? d.screenerCount + '/' + (d.screenerUniverse || '?') : '—' },
    ];
    var W = 420, H = 185, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 19, '데이터 파이프라인 현황', C.text, 10, 700);
    var ageMin = meta.ageMin;
    var ageCol = ageMin == null ? C.muted : ageMin < 60 ? C.green : ageMin < 180 ? C.amber : C.red;
    out += _t(W - 14, 19, ageMin != null ? ageMin + '분 전' : '—', ageCol, 10, 600, 'end');
    items.forEach(function (it, i) {
      var col2 = i % 2, row = Math.floor(i / 2);
      var x = 14 + col2 * 204, y = 34 + row * 42;
      out += _r(x, y, 196, 34, 'rgba(255,255,255,0.025)', 5, it.ok ? _alphaRgb(C.green, 0.22) : _alphaRgb(C.red, 0.18), 1);
      out += _t(x + 10, y + 13, it.label, C.muted, 10, 600);
      out += _t(x + 10, y + 27, it.val, it.ok ? C.green : C.red, 10, 700);
      out += _t(x + 186, y + 13, it.ok ? '✓' : '✗', it.ok ? C.green : C.red, 11, 900, 'end');
    });
    return _svg(W, H, out);
  }

  // ── 5. economic-cycle: 경기 사이클 위치 ──────────────────────
  function _economicCycle(d) {
    var stage = d.stage || 'MID';
    var W = 390, H = 210, cx = 130, cy = 115, R = 70, out = '';
    var stageMap = { EARLY: 0, MID: 1, LATE: 2, CONTRACTION: 3 };
    var stageNames = ['초기 확장', '중기 성장', '후기 사이클', '수축'];
    var stageCols = [C.green, C.cyan, C.amber, C.red];
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '경기 사이클 포지셔닝', C.text, 10, 700);
    for (var i = 0; i < 4; i++) {
      var a0 = (i / 4) * Math.PI * 2 - Math.PI / 2;
      var a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
      var active = (stageMap[stage] || 0) === i;
      var col = stageCols[i];
      var inner = R * 0.35;
      var x0 = cx + inner * Math.cos(a0), y0 = cy + inner * Math.sin(a0);
      var x1 = cx + R * Math.cos(a0),     y1 = cy + R * Math.sin(a0);
      var x2 = cx + R * Math.cos(a1),     y2 = cy + R * Math.sin(a1);
      var x3 = cx + inner * Math.cos(a1), y3 = cy + inner * Math.sin(a1);
      out += '<path d="M' + x0.toFixed(1) + ',' + y0.toFixed(1) +
        'L' + x1.toFixed(1) + ',' + y1.toFixed(1) +
        'A' + R + ',' + R + ',0,0,1,' + x2.toFixed(1) + ',' + y2.toFixed(1) +
        'L' + x3.toFixed(1) + ',' + y3.toFixed(1) +
        'A' + inner + ',' + inner + ',0,0,0,' + x0.toFixed(1) + ',' + y0.toFixed(1) + 'Z"' +
        ' fill="' + (active ? _alphaRgb(col, 0.25) : 'rgba(255,255,255,0.03)') + '"' +
        ' stroke="' + (active ? col : 'rgba(255,255,255,0.08)') + '" stroke-width="' + (active ? 2 : 0.5) + '"/>';
      var lam = (a0 + a1) / 2;
      var lx = cx + R * 0.66 * Math.cos(lam), ly = cy + R * 0.66 * Math.sin(lam);
      out += _t(lx.toFixed(1), (ly + 3).toFixed(1), stageNames[i], active ? col : C.muted, 10, active ? 700 : 400, 'middle');
    }
    out += _o(cx, cy, inner, _alphaRgb(C.bgSolid, 0.8));
    out += _t(cx, cy + 4, stage, stageCols[stageMap[stage] || 0], 10, 900, 'middle');
    var indicators = [
      ['CPI',  _n(Number(d.cpi), 1) + '%',  Number(d.cpi) > 3.5 ? C.red : Number(d.cpi) > 2 ? C.amber : C.green],
      ['금리', _n(Number(d.fedRate), 2) + '%', Number(d.fedRate) > 4.5 ? C.red : C.amber],
      ['실업', _n(Number(d.unemployment), 1) + '%', Number(d.unemployment) > 4.5 ? C.red : C.green],
    ];
    indicators.forEach(function (row, i) {
      var ry = 30 + i * 54;
      out += _r(225, ry, 146, 46, 'rgba(255,255,255,0.03)', 5, _alphaRgb(row[2], 0.2), 1);
      out += _t(233, ry + 15, row[0], C.muted, 10, 600);
      out += _t(233, ry + 34, row[1], row[2], 14, 900);
    });
    return _svg(W, H, out);
  }

  // ── 6. price-position: 가격 위치 (MA/ATH 슬라이더) ──────────
  function _pricePosition(d) {
    var sym = d.sym || '—';
    function observed(v) { return v == null || !isFinite(Number(v)) ? null : Number(v); }
    var price = observed(d.price), sma50 = observed(d.sma50), sma200 = observed(d.sma200);
    var ath = observed(d.ath), ret3m = observed(d.ret3m), rsi = observed(d.rsi);
    var W = 420, H = 170, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, sym + ' 가격 포지셔닝', C.text, 10, 700);
    if ([price, sma50, sma200, ath, ret3m, rsi].some(function(v) { return v == null; })) {
      out += _t(210, 88, 'OHLCV·MA·ATH·RSI 원천 미수신', C.muted, 12, 600, 'middle');
      return _svg(W, H, out);
    }
    var lo = Math.min(sma200, price) * 0.96, hi = Math.max(ath, price) * 1.03;
    var range = hi - lo || 1;
    // H2-03: clamp both ends so malformed/future values cannot place marker text
    // outside the SVG viewport; the observed label/value collision is covered by
    // T921 and the 390/768/1024/1440 matrix gate.
    var tx = function (v) { return 18 + Math.max(0, Math.min(((v - lo) / range) * 366, 366)); };
    var slY = 48;
    out += _r(18, slY, 366, 8, 'rgba(255,255,255,0.05)', 4);
    out += _r(18, slY, _cl(tx(sma200) - 18, 0, 366), 8, _alphaRgb(C.red, 0.18), 4);
    out += _r(tx(sma200), slY, _cl(tx(sma50) - tx(sma200), 0, 366), 8, _alphaRgb(C.amber, 0.22));
    out += _r(tx(sma50), slY, _cl(tx(ath) - tx(sma50), 0, 366), 8, _alphaRgb(C.green, 0.22));
    [[sma200, '200MA', C.amber], [sma50, '50MA', C.cyan], [ath, 'ATH', C.green]].forEach(function (m) {
      var mx = tx(m[0]);
      out += _l(mx, slY - 2, mx, slY + 10, m[2], 1.5);
      out += _t(mx, slY + 21, m[1], m[2], 10, 600, 'middle');
      // v52.5x/WO-4(F-01): label(baseline slY+21)과 값(이전 slY+31) 사이 10px 간격이 10px 폰트의
      // 실제 글리프 높이(대략 어센트+디센트 ~10px)와 거의 같아 브라우저 폰트 메트릭에 따라
      // bounding box가 겹칠 수 있었다(실측: mobile390/tablet768/laptop1024/desktop1440 4곳 전부
      // technical route에서 200MA/50MA/ATH 라벨-값 3쌍 전부 겹침 검출). 값 라인을 slY+35로 내려
      // 두 텍스트 baseline 간격을 14px로 넓혀 여유를 둠(SVG 높이 H=170, 하단 stats 행은 H-50=120
      // 부터 시작이라 4px 이동은 다른 요소와 충돌하지 않음).
      out += _t(mx, slY + 35, '$' + _n(m[0]), m[2], 10, 400, 'middle');
    });
    var prx = tx(price);
    out += _r(prx - 7, slY - 6, 14, 20, _alphaRgb(C.cyan, 0.18), 3, C.cyan, 1.5);
    out += _t(prx, slY + 5, '$' + _n(price), C.text, 10, 900, 'middle');
    out += _t(prx, slY - 10, sym, C.text, 10, 700, 'middle');
    var stats = [
      ['3M 수익', _n(ret3m, 1) + '%', _pctCol(ret3m)],
      ['RSI', _n(rsi, 1), rsi >= 70 ? C.red : rsi <= 30 ? C.green : C.cyan],
      ['vs 50MA', _n((price / (sma50 || 1) - 1) * 100, 1) + '%', price > sma50 ? C.green : C.red],
      ['vs ATH', _n((price / (ath || 1) - 1) * 100, 1) + '%', price >= ath * 0.97 ? C.green : price >= ath * 0.9 ? C.amber : C.red],
    ];
    stats.forEach(function (s, i) {
      var x = 14 + i * 100;
      out += _r(x, H - 50, 92, 40, 'rgba(255,255,255,0.025)', 4, C.border, 1);
      out += _t(x + 6, H - 34, s[0], C.muted, 10);
      out += _t(x + 6, H - 16, s[1], s[2], 11, 700);
    });
    return _svg(W, H, out);
  }

  // ── 7. sector-bubble: 섹터 배분 버블 ─────────────────────────
  function _sectorBubble(d) {
    var sectors = (d.sectors && d.sectors.length) ? d.sectors : [{ name: '데이터없음', weight: 100, perf: 0 }];
    var W = 430, H = 200, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '섹터 집중도 분석', C.text, 10, 700);
    var maxW = Math.max.apply(null, sectors.map(function (s) { return s.weight || 0; })) || 1;
    var x = 18;
    sectors.slice(0, 8).forEach(function (s, i) {
      var r = 14 + (s.weight / maxW) * 28;
      var col = (s.perf || 0) > 1 ? C.green : (s.perf || 0) < -1 ? C.red : C.amber;
      var cy2 = H / 2 + (i % 2 === 0 ? -10 : 10);
      out += _o((x + r).toFixed(0), cy2.toFixed(0), r.toFixed(0), _alphaRgb(col, 0.12), col, 1.5);
      out += _t((x + r).toFixed(0), (cy2 - 4).toFixed(0), s.name || '?', C.text, 10, 700, 'middle');
      out += _t((x + r).toFixed(0), (cy2 + 8).toFixed(0), Math.round(s.weight || 0) + '%', col, 10, 700, 'middle');
      x += r * 2 + 6;
    });
    return _svg(W, H, out);
  }

  // ── 8. yield-curve: 금리 기간구조 ────────────────────────────
  function _yieldCurve(d) {
    var pts = [
      { term: '1M',  rate: Number(d.irx) },
      { term: '2Y',  rate: Number(d.twoY) },
      { term: '5Y',  rate: Number(d.fvx) },
      { term: '10Y', rate: Number(d.tnx) },
      { term: '30Y', rate: Number(d.tyx) },
    ];
    var W = 380, H = 180, out = '';
    var minR = Math.min.apply(null, pts.map(function (p) { return p.rate; })) - 0.3;
    var maxR = Math.max.apply(null, pts.map(function (p) { return p.rate; })) + 0.3;
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '금리 기간구조 (수익률곡선)', C.text, 10, 700);
    var cX = 44, cY = 28, cW = 310, cH = 120;
    [0, 0.5, 1].forEach(function (t) {
      var y = (cY + cH - t * cH).toFixed(0);
      out += _l(cX, y, cX + cW, y, 'rgba(255,255,255,0.06)');
      out += _t(cX - 4, (+y + 3).toFixed(0), (minR + t * (maxR - minR)).toFixed(1) + '%', C.muted, 10, 400, 'end');
    });
    var mapped = pts.map(function (p, i) {
      var x = (cX + i * (cW / (pts.length - 1))).toFixed(1);
      var y = (cY + cH - ((p.rate - minR) / (maxR - minR)) * cH).toFixed(1);
      return { x: x, y: y, term: p.term, rate: p.rate };
    });
    var areaD = 'M' + mapped[0].x + ',' + mapped[0].y;
    mapped.slice(1).forEach(function (p) { areaD += 'L' + p.x + ',' + p.y; });
    areaD += 'L' + mapped[mapped.length - 1].x + ',' + (cY + cH) + 'L' + mapped[0].x + ',' + (cY + cH) + 'Z';
    out += '<path d="' + areaD + '" fill="' + _alphaRgb(C.cyan, 0.08) + '"/>';
    var lineD = 'M' + mapped[0].x + ',' + mapped[0].y;
    mapped.slice(1).forEach(function (p) { lineD += 'L' + p.x + ',' + p.y; });
    out += '<path d="' + lineD + '" fill="none" stroke="' + C.cyan + '" stroke-width="2"/>';
    mapped.forEach(function (p) {
      out += _o(p.x, p.y, 3.5, C.cyan);
      out += _t(p.x, (+p.y - 7).toFixed(0), p.term, C.muted, 10, 600, 'middle');
      out += _t(p.x, (+p.y + 14).toFixed(0), p.rate.toFixed(2), C.cyan, 10, 700, 'middle');
    });
    var inverted = d.twoY && d.tnx && d.twoY > d.tnx;
    var shape = inverted ? '역전 Inverted' : '정상 Normal';
    var shapeCol = inverted ? C.red : C.green;
    out += _r(W - 104, H - 24, 96, 18, _alphaRgb(shapeCol, 0.12), 4, shapeCol, 1);
    out += _t(W - 56, H - 11, shape, shapeCol, 10, 700, 'middle');
    return _svg(W, H, out);
  }

  // ── 9. sentiment-gauge: 다중 심리 게이지 ─────────────────────
  function _sentimentGauge(d) {
    var gauges = [
      { label: 'Fear & Greed', v: _cl(Number(d.fg), 0, 100), min: 0, max: 100, inv: false, lo: '공포', hi: '탐욕',   unit: '' },
      { label: 'VIX',          v: _cl(Number(d.vix), 0, 60),  min: 0, max: 60,  inv: true,  lo: '안정', hi: '극공포', unit: '' },
      { label: 'VVIX',         v: _cl(Number(d.vvix), 70, 180), min: 70, max: 180, inv: true, lo: '안정', hi: '극공포', unit: '' },
      { label: 'AAII Bear%',   v: _cl(Number(d.aaiiBear), 0, 70),  min: 0, max: 70,  inv: true,  lo: '낙관', hi: '비관',   unit: '%' },
    ];
    var W = 420, H = 192, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '시장 심리 게이지', C.text, 10, 700);
    gauges.forEach(function (g, i) {
      var y = 30 + i * 40;
      var norm = (g.v - g.min) / (g.max - g.min);
      if (g.inv) norm = 1 - norm;
      var col = norm >= 0.66 ? C.green : norm >= 0.33 ? C.amber : C.red;
      out += _t(14, y + 13, g.label, C.muted, 10, 600);
      out += _r(120, y + 2, 224, 10, 'rgba(255,255,255,0.05)', 3);
      out += _r(120, y + 2, Math.round(224 * 0.40), 10, _alphaRgb(C.green, 0.28), 3);
      out += _r(120 + Math.round(224 * 0.40), y + 2, Math.round(224 * 0.33), 10, _alphaRgb(C.amber, 0.28));
      out += _r(120 + Math.round(224 * 0.73), y + 2, Math.round(224 * 0.27), 10, _alphaRgb(C.red, 0.28));
      var nx = 120 + Math.round(224 * _cl(norm, 0, 1));
      out += _r(nx - 1, y - 1, 3, 14, col, 1);
      out += _t(350, y + 13, _n(g.v, g.unit === '%' ? 1 : 1) + g.unit, col, 10, 700);
      out += _t(120, y + 25, g.lo, C.muted, 10);
      out += _t(344, y + 25, g.hi, C.muted, 10, 400, 'end');
    });
    return _svg(W, H, out);
  }

  // ── 10. factor-backtest: 팩터 IC 백테스트 ────────────────────
  function _factorBacktest(d) {
    var bt = d.backtest || {};
    var ic = bt.ic || { momentum: 0, trend: 0, lowvol: 0, composite: 0 };
    var spread = bt.quantileSpread || 0, hit = bt.hitRate || 0, n = bt.n || 0;
    var factors = [
      { label: '모멘텀', key: 'momentum' },
      { label: '추세',   key: 'trend' },
      { label: '저변동', key: 'lowvol' },
      { label: '종합',   key: 'composite' },
    ];
    var W = 400, H = 192, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '팩터 IC 백테스트', C.text, 10, 700);
    out += _t(W - 14, 18, 'n=' + n, C.muted, 10, 400, 'end');
    factors.forEach(function (f, i) {
      var v = ic[f.key] || 0;
      var y = 28 + i * 36;
      var col = v > 0.05 ? C.green : v > 0 ? C.cyan : v > -0.05 ? C.amber : C.red;
      var barW = Math.round(Math.abs(v) * 700);
      var midX = 182;
      out += _t(14, y + 13, f.label, C.muted, 10, 600);
      out += _r(70, y + 3, 224, 12, 'rgba(255,255,255,0.04)', 2);
      out += _l(midX, y, midX, y + 18, 'rgba(255,255,255,0.14)');
      if (v >= 0) {
        out += _r(midX, y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      } else {
        out += _r(Math.max(midX - Math.min(barW, 112), 70), y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      }
      out += _t(300, y + 13, 'IC ' + _n(v, 3), col, 10, 700);
    });
    out += _r(14, H - 46, 180, 36, 'rgba(255,255,255,0.025)', 4, C.border, 1);
    out += _t(20, H - 29, '분위 스프레드', C.muted, 10);
    out += _t(20, H - 13, _n(spread, 2) + '%', spread > 2 ? C.green : spread > 0 ? C.amber : C.red, 12, 700);
    out += _r(204, H - 46, 180, 36, 'rgba(255,255,255,0.025)', 4, C.border, 1);
    out += _t(210, H - 29, '방향 적중률', C.muted, 10);
    out += _t(210, H - 13, _n(hit, 1) + '%', hit > 55 ? C.green : hit > 45 ? C.amber : C.red, 12, 700);
    return _svg(W, H, out);
  }

  var _fns = {
    'score-breakdown': _scoreBreakdown,
    'market-regime':   _marketRegime,
    'factor-radar':    _factorRadar,
    'pipeline-status': _pipelineStatus,
    'economic-cycle':  _economicCycle,
    'price-position':  _pricePosition,
    'sector-bubble':   _sectorBubble,
    'yield-curve':     _yieldCurve,
    'sentiment-gauge': _sentimentGauge,
    'factor-backtest': _factorBacktest,
  };

  return {
    // el: DOM element 또는 element ID
    render: function (type, el, data) {
      if (typeof el === 'string') el = document.getElementById(el);
      if (!el) return;
      if (data && data.available === false) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:12px">검증 입력 미수신 · 시각화 판정 보류</div>';
        el.setAttribute('data-source-kind', 'unavailable');
        el.setAttribute('data-operational-use', 'blocked');
        return;
      }
      var fn = _fns[type];
      if (!fn) {
        el.innerHTML = '<div style="color:#5a7080;font-size:11px;padding:8px">다이어그램 없음: ' + _esc(type) + '</div>';
        return;
      }
      try { el.innerHTML = fn(data || {}); }
      catch (e) { if (typeof _aioLog === 'function') _aioLog('warn', 'ui', '_aioDiagram.render 오류:' + type + ' ' + e.message); }
    },
    // AI 채팅용: SVG 문자열 반환
    getSvg: function (type, data) {
      var fn = _fns[type];
      if (!fn) return '';
      try { return fn(data || {}); } catch (e) { return ''; }
    },
    types: function () { return Object.keys(_fns); },
  };
})();
window.runInstitutionalTechnicalBrief = runInstitutionalTechnicalBrief;

// ──────────────────────────────────────────────────────────────────────────────
// v50.82 Phase 2: 페이지별 SVG 다이어그램 렌더러
// 각 페이지 진입(aio:pageShown) 시 _aioDiagram 엔진으로 시각화 주입
// ──────────────────────────────────────────────────────────────────────────────
(function () {
  function _snap() { return window.DATA_SNAPSHOT || {}; }
  function _ld(sym) {
    var live = window._liveData || {};
    var e = live[sym];
    return (e && typeof e.price === 'number') ? e.price : null;
  }
  function _cl(v, lo, hi) { return Math.max(lo, Math.min(hi, isFinite(v) ? v : lo)); }

  function _getScore() {
    try {
      if (typeof computeTradingScore === 'function') return computeTradingScore() || {};
    } catch (e) {}
    return {};
  }

  function _econStage(snap) {
    if ([snap.cpi,snap.fedRate,snap.usUnemploy].some(function(v){ return v == null || v === ''; })) return 'UNAVAILABLE';
    var cpi = Number(snap.cpi), rate = Number(snap.fedRate), u = Number(snap.usUnemploy);
    if (![cpi, rate, u].every(Number.isFinite)) return 'UNAVAILABLE';
    if (u >= 5.2 || (u >= 4.8 && cpi < 2.5)) return 'CONTRACTION';
    if (cpi >= 3.8 && rate >= 4.8) return 'LATE';
    if (cpi >= 2.5 || rate >= 3.0) return 'MID';
    return 'EARLY';
  }

  function _buildScore() {
    var s = _getScore();
    var rawRequired = [s.total,s.volScore,s.momScore,s.trendScore,s.breadthScore,s.macroScore];
    if (rawRequired.some(function(v) { return v == null || v === ''; })) return { available:false };
    var required = rawRequired.map(Number);
    if (!required.every(Number.isFinite)) return { available:false };
    var total = required[0];
    return {
      total: total,
      components: [
        { label: 'VIX 레짐',  value: Math.round(_cl(s.volScore    || 0, 0, 100) * 0.25), max: 25 },
        { label: 'F&G 심리', value: Math.round(_cl(s.momScore     || 0, 0, 100) * 0.25), max: 25 },
        { label: 'SPX 추세',  value: Math.round(_cl(s.trendScore  || 0, 0, 100) * 0.20), max: 20 },
        { label: '시장 폭',   value: Math.round(_cl(s.breadthScore|| 0, 0, 100) * 0.20), max: 20 },
        { label: '매크로',    value: Math.round(_cl(s.macroScore  || 0, 0, 100) * 0.10), max: 10 },
      ],
    };
  }

  function _buildRegime() {
    var s = _getScore();
    var snap = _snap();
    if (s.total == null) return { available:false };
    var total = Number(s.total);
    var vixRaw = _ld('^VIX') || snap.vix;
    if (vixRaw == null || vixRaw === '') return { available:false };
    var vix = Number(vixRaw);
    if (!Number.isFinite(total) || !Number.isFinite(vix) || vix <= 0) return { available:false };
    var regime = total >= 75 ? 'BULL' : total >= 60 ? '매수우호' : total >= 45 ? 'NEUTRAL' : total >= 30 ? '경계' : 'BEAR';
    var spyScore = _cl(s.trendScore || 50, 0, 100);
    var vixScore = vix >= 35 ? 8 : vix >= 25 ? 28 : vix >= 18 ? 55 : vix >= 14 ? 78 : 92;
    return { regime: regime, score: total, vix: vix, spyScore: spyScore, vixScore: vixScore };
  }

  function _buildSentiment() {
    var snap = _snap();
    var fgMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    var fgRaw = fgMetric && fgMetric.value;
    var vixRaw = _ld('^VIX') || snap.vix;
    var vvixRaw = _ld('^VVIX') || snap.vvix;
    var aaiiRaw = window._aaiiBearish;
    if ([fgRaw,vixRaw,vvixRaw,aaiiRaw].some(function(v){ return v == null || v === ''; })) return { available:false };
    var fg = Number(fgRaw), vix = Number(vixRaw), vvix = Number(vvixRaw), aaii = Number(aaiiRaw);
    if (![fg,vix,vvix,aaii].every(Number.isFinite) || vix <= 0 || vvix <= 0) return { available:false };
    return { fg:_cl(fg,0,100), vix:vix, vvix:vvix, aaiiBear:_cl(aaii,0,70) };
  }

  function _buildPipeline() {
    var snap = _snap();
    var live = window._liveData || {};
    var lk = Object.keys(live);
    var symOk = lk.filter(function (k) { return live[k] && typeof live[k].price === 'number'; }).length;
    var fgMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    var fg = fgMetric && fgMetric.value != null ? fgMetric.value : null;
    var ageMin = null;
    try {
      var ts = snap._snapshotDate || snap.ts;
      if (ts) ageMin = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    } catch (e) {}
    var scrRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    var scrLen = Array.isArray(scrRows) ? scrRows.length : 0;
    return {
      fg: fg,
      telegramOk: !!(window._telegramDigest),
      telegramCount: (window._telegramDigest && window._telegramDigest.posts) || 0,
      screenerOk: scrLen > 0,
      screenerCount: scrLen,
      screenerUniverse: scrLen || '?',
      meta: {
        symbolsOk: symOk,
        fearGreedOk: fg != null,
        fredFetchOk: !!(snap.cpi || snap.fedRate),
        fredHasKey: !!(snap.cpi),
        macroKeyCount: [snap.cpi, snap.fedRate, snap.usUnemploy, snap.tnx2y, snap.dxy].filter(Boolean).length,
        newsOk: !!(window._newsItems && window._newsItems.length > 0),
        newsCount: (window._newsItems && window._newsItems.length) || 0,
        ageMin: ageMin,
      },
    };
  }

  function _buildEcon() {
    var snap = _snap();
    if ([snap.cpi,snap.fedRate,snap.usUnemploy].some(function(v){ return v == null || v === ''; })) return { available:false };
    var cpi = Number(snap.cpi), rate = Number(snap.fedRate), unemployment = Number(snap.usUnemploy);
    if (![cpi,rate,unemployment].every(Number.isFinite)) return { available:false };
    return {
      stage:        _econStage(snap),
      cpi:          cpi,
      fedRate:      rate,
      unemployment: unemployment,
    };
  }

  function _buildPrice() {
    var snap = _snap();
    var price  = Number(_ld('SPY'));
    var sma50  = window._spxMA && Number(window._spxMA[50]) / 10;
    var sma200 = window._spxMA && Number(window._spxMA[200]) / 10;
    var ath = snap.spxATH == null || snap.spxATH === '' ? null : Number(snap.spxATH) / 10;
    // v52.16 P5l/P619: snap.spy3m/spyRsi는 어디서도 대입되지 않는 phantom field라 항상 0/50 기본값이었음 —
    // updateTechIndicators()(index.html)이 실계산해 저장하는 window._spyPositionStats로 전환.
    var posStats = window._spyPositionStats;
    var ret3m = posStats && Number(posStats.ret3m);
    var rsi = posStats && Number(posStats.rsi);
    if (![price,sma50,sma200,ath,ret3m,rsi].every(Number.isFinite) || price <= 0 || sma50 <= 0 || sma200 <= 0 || ath <= 0) return { available:false };
    return { sym: 'SPY', price: price, sma50: sma50, sma200: sma200, ath: ath, ret3m: ret3m, rsi: rsi };
  }

  function _buildYield() {
    var curve = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function' ? window.AIO.getUsTreasuryCurveEvidence() : null;
    if (!curve || !curve.complete) return { available:false };
    return {
      irx:curve.threeM, twoY:curve.twoY, fvx:curve.fiveY, tnx:curve.tenY, tyx:curve.thirtyY
    };
  }

  function _buildBacktest() {
    return { backtest: window._aioFactorBacktest || {} };
  }

  function _buildSectors() {
    var pf = [];
    try {
      var raw = (typeof safeLSGetJSON === 'function')
        ? safeLSGetJSON('aio_portfolio')
        : JSON.parse(localStorage.getItem('aio_portfolio') || 'null');
      if (Array.isArray(raw)) pf = raw;
    } catch (e) {}
    if (!pf.length) return { sectors: [] };
    var live = window._liveData || {};
    var db = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    var sMap = {};
    pf.forEach(function (entry) {
      var sym = (entry.sym || '').toUpperCase();
      var row = null;
      for (var i = 0; i < db.length; i++) {
        if ((db[i].sym || '').toUpperCase() === sym) { row = db[i]; break; }
      }
      var sector = (row && row.sector) ? row.sector : 'Other';
      var price = (live[sym] && typeof live[sym].price === 'number') ? live[sym].price : (entry.cost || 0);
      var mv = (entry.qty || 0) * price;
      if (!sMap[sector]) sMap[sector] = { mv: 0, perfSum: 0, count: 0 };
      sMap[sector].mv += mv;
      sMap[sector].perfSum += (row && row.ret3m != null) ? row.ret3m : 0;
      sMap[sector].count++;
    });
    var total = Object.keys(sMap).reduce(function (s, k) { return s + sMap[k].mv; }, 0);
    if (!total) return { sectors: [] };
    var sectors = Object.keys(sMap).map(function (k) {
      var s = sMap[k];
      return { name: k, weight: Math.round((s.mv / total) * 100), perf: s.count ? s.perfSum / s.count : 0 };
    }).sort(function (a, b) { return b.weight - a.weight; });
    return { sectors: sectors };
  }

  function _render(elId, type, data) {
    var el = document.getElementById(elId);
    if (el && window._aioDiagram) window._aioDiagram.render(type, el, data);
  }

  function _aioRenderPageDiagram(pid) {
    try {
      // The architecture bootstrap owns the home/signal decision surfaces.  The
      // legacy compatibility diagrams for those routes are hidden and would
      // otherwise perform a full score/canvas render before the native mount,
      // creating a duplicate first-paint workload and last-writer race.
      if ((pid === 'home' || pid === 'signal') && window.__AIO_ARCH_RUNTIME__) return;
      switch (pid) {
        case 'home':
          // P1010: the native analysis page exclusively owns the home score.
          break;
        case 'signal':
          // v52.65: vis-signal-score(원형게이지, 이미 DOM 부재) 대체 — 시안 2a 히어로(index.html
          // score-gauge-val 등)는 refreshSignalDashboard()가 렌더(js/aio-core.js 로드순서 의존이라
          // typeof 가드 후 호출). initSignalDashboard()가 이미 페이지 진입 시 호출하므로 중복 안전.
          try { if (typeof window.refreshSignalDashboard === 'function') window.refreshSignalDashboard(); } catch(_) {}
          break;
        case 'breadth':
          _render('vis-breadth-regime', 'market-regime', _buildRegime());
          break;
        case 'sentiment':
          _render('vis-sentiment-gauge', 'sentiment-gauge', _buildSentiment());
          break;
        case 'briefing':
          _render('vis-briefing-pipeline', 'pipeline-status', _buildPipeline());
          _render('vis-briefing-cycle',    'economic-cycle',   _buildEcon());
          break;
        case 'technical':
          _render('vis-technical-price', 'price-position', _buildPrice());
          break;
        case 'macro':
          _render('vis-macro-cycle', 'economic-cycle', _buildEcon());
          _render('vis-macro-yield', 'yield-curve',    _buildYield());
          break;
        case 'fxbond':
          _render('vis-fxbond-yield', 'yield-curve', _buildYield());
          break;
        case 'screener':
          _render('vis-screener-backtest', 'factor-backtest', _buildBacktest());
          break;
        case 'portfolio': {
          var _pfSec = _buildSectors();
          var _pfWrap = document.getElementById('vis-portfolio');
          if (_pfSec.sectors && _pfSec.sectors.length) {
            if (_pfWrap) _pfWrap.style.display = '';
            _render('vis-portfolio-sectors', 'sector-bubble', _pfSec);
          } else {
            if (_pfWrap) _pfWrap.style.display = 'none';
          }
          break;
        }
      }
    } catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ui', 'vis-phase2 render err:' + pid + ' ' + (e && e.message));
    }
  }

  var VIS_PAGES = ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','screener','portfolio'];

  // 페이지 전환 훅
  if (window._aioPageBus) {
    _aioPageBus.register('vis-phase2', 'aio:pageShown', function (e) {
      var pid = e && e.detail;
      if (pid && VIS_PAGES.indexOf(pid) !== -1) _aioRenderPageDiagram(pid);
    });
  }

  // 시장 상태 갱신 시 현재 페이지 재렌더 (window에서 dispatch됨 — document 아님)
  window.addEventListener('aio:marketStateUpdated', function () {
    try {
      var active = document.querySelector('.page.active[id^="page-"]');
      if (!active) return;
      var pid = (active.id || '').replace('page-', '');
      if (VIS_PAGES.indexOf(pid) !== -1) _aioRenderPageDiagram(pid);
    } catch (e) {}
  });

  // 펀더멘털 티커 검색 후 팩터 레이더 렌더 (외부 호출용)
  window._aioRenderFundamentalRadar = function (ticker, row) {
    var wrap = document.getElementById('vis-fundamental');
    var el   = document.getElementById('vis-fundamental-radar');
    if (!wrap || !el || !window._aioDiagram) return;
    if (!row || row.screenStatus === 'unavailable') { wrap.style.display = 'none'; el.textContent = ''; return; }
    wrap.style.display = '';
    window._aioDiagram.render('factor-radar', el, {
      sym: ticker,
      factors: Object.assign({}, row.factorScores || {}, { rsi: row.rsi }),
      rank: (row.quantRank != null) ? row.quantRank : (row.rank != null ? row.rank : null),
    });
  };

  window._aioRenderPageDiagram = _aioRenderPageDiagram;

  // ── Phase 3: AI 채팅 자동 시각화 ─────────────────────────────
  // 토픽 감지(q + response text) → 가장 관련 높은 다이어그램 반환 {type, data, label}
  function _findRow(sym) {
    var rows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    if (!Array.isArray(rows)) return null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].sym === sym) return rows[i];
    }
    return null;
  }

  window._aioChatAutoVis = function (question, responseText, tickers) {
    try {
      var q = ((question    || '') + ' ' + (responseText || '')).toLowerCase();
      // 우선순위 순으로 가장 명확한 매치만 반환 (과잉 삽입 방지)
      if (/매매 점수|거래 점수|trading score|점수 분해/.test(q)) {
        return { type: 'score-breakdown', data: _buildScore(),    label: '매매 점수 분해' };
      }
      if (/수익률 곡선|yield curve|장단기 금리|금리 역전|inverted yield|tyx/.test(q)) {
        return { type: 'yield-curve',     data: _buildYield(),    label: '수익률 곡선' };
      }
      if (/fear.*greed|공포.*탐욕|탐욕.*공포|심리 게이지|sentiment gauge|심리 지수/.test(q)) {
        return { type: 'sentiment-gauge', data: _buildSentiment(),label: '시장 심리 게이지' };
      }
      if (/경기 사이클|business cycle|침체 국면|recessio|확장 국면|후기 사이클|초기 확장/.test(q)) {
        return { type: 'economic-cycle',  data: _buildEcon(),     label: '경기 사이클' };
      }
      if (/시장 국면|market regime|레짐 포지셔닝|bull.*bear.*사분면/.test(q)) {
        return { type: 'market-regime',   data: _buildRegime(),   label: '시장 국면 레짐' };
      }
      if (/팩터 백테스트|factor backtest|정보계수|ic.*모멘텀|spearman/.test(q)) {
        return { type: 'factor-backtest', data: _buildBacktest(), label: '팩터 백테스트 IC' };
      }
      if (tickers && tickers.length > 0 && /팩터 레이더|factor radar|퀀트 랭크|quantrank|rsi.*팩터|팩터.*분석/.test(q)) {
        var row = _findRow(tickers[0]);
        if (row) {
          return {
            type: 'factor-radar',
            label: tickers[0] + ' 팩터 레이더',
            data: {
              sym: tickers[0],
              rank: row.quantRank != null ? row.quantRank : null,
              factors: Object.assign({}, row.factorScores || {}, { rsi: row.rsi }),
            },
          };
        }
      }
      if (/200일선|50일선|spy.*sma|sma.*spy|price position|가격 포지션|지지.*저항/.test(q)) {
        return { type: 'price-position',  data: _buildPrice(),    label: 'SPY 가격 포지션' };
      }
    } catch (e) {}
    return null;
  };
})();

// ── 기업분석 렌더러 — aio-chat.js에서 이동 (v51.17) ─────────────────────────────────
// _fmtNum/_fmtPct: aio-core.js window.* 공개됨 (v51.17)
var _fmtNum = window._fmtNum;
var _fmtPct = window._fmtPct;
// ── 렌더 함수들 ──────────────────────────────────────────────────

function _renderFundHeader(d) {
  var el = document.getElementById('fund-rpt-header');
  if (!el) return;
  var pctColor = d.pct != null ? (d.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
  var p = d.fmpProfile || {};
  // v52.73 아이보리 3f: 시안 구조(회사명+티커/섹터/거래소 좌 · 가격+등락 우, 한 줄 리포트 헤더)
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">';
  html += '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;min-width:0;">';
  html += '<span style="font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--text-primary);">' + escHtml(d.name || d.ticker) + '</span>';
  html += '<span style="font-size:12.5px;color:var(--text-muted);">' + escHtml(d.ticker) + (p.sector ? ' · ' + escHtml(p.sector) : '') + (p.exchangeShortName ? ' · ' + escHtml(p.exchangeShortName) : '') + '</span>';
  html += '</div>';
  html += '<div style="display:flex;align-items:baseline;gap:10px;flex-shrink:0;">';
  if (d.price) {
    html += '<span style="font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums;">$' + d.price.toFixed(2) + '</span>';
    html += '<span style="font-size:13px;font-weight:600;color:' + pctColor + ';font-variant-numeric:tabular-nums;">' + _fmtPct(d.pct) + '</span>';
  }
  html += '</div></div>';

  // 보조 행 — 시가총액 · 포트폴리오/차트 액션 · 리포트 노화 배지 (시안엔 없으나 실사용 기능이라 압축된 한 줄로 유지)
  html += '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;">';
  if (p.mktCap) html += '<span style="font-size:11px;color:var(--text-muted);">시가총액 $' + _fmtNum(p.mktCap) + '</span>';
  html += '<button data-action="_aioAddToPortfolio" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table" style="font-size:11px;">포트폴리오에 추가</button>';
  html += '<button data-action="_aioChartAnalyze" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table" style="font-size:11px;">차트 분석</button>';
  // v48.37: SCREENER_DB memo staleness 배지 (애널리스트 리포트 노화 경고)
  if (typeof window._aioStockStaleInfo === 'function') {
    var _staleInfo = window._aioStockStaleInfo(d.ticker);
    if (_staleInfo && _staleInfo.badge) {
      html += '<span style="font-size:11px;color:var(--text-muted);">리포트 코멘트: ' + _staleInfo.badge + (_staleInfo.isStale ? ' <span style="color:var(--data-red);">· 최신 정보 재검증 권장</span>' : '') + '</span>';
    }
  }
  html += '</div>';

  el.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundQualitative(d) {
  var sec = document.getElementById('fund-rpt-qualitative');
  var descEl = document.getElementById('fund-qual-desc');
  var rowsEl = document.getElementById('fund-qual-rows');
  var barsEl = document.getElementById('fund-qual-bars');
  if (!sec || !descEl || !rowsEl || !barsEl) return;
  var p = d.fmpProfile || {};

  // 좌측 — 정성 개요: FMP profile.description(실제 기업 공시 설명) + 섹터/경영진 실데이터 행
  // v48.91과 동일하게 escHtml() 적용 — FMP API 기업 설명 XSS 방지
  if (p.description) {
    var desc = p.description.length > 420 ? p.description.slice(0, 420) + '...' : p.description;
    descEl.innerHTML = escHtml(desc);
  } else {
    descEl.innerHTML = '<span style="color:var(--text-muted);">기업 설명 데이터 없음 (FMP profile.description 미제공)</span>';
  }

  function qrow(label, text) {
    return '<div style="display:flex;gap:14px;">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text-dim);flex-shrink:0;width:64px;padding-top:2px;">' + escHtml(label) + '</span>' +
      '<span style="font-size:12.5px;color:var(--text-secondary);line-height:1.7;">' + text + '</span></div>';
  }
  var rowsHtml = '';
  if (p.sector || p.industry) rowsHtml += qrow('섹터', escHtml(p.sector || '') + (p.industry ? ' · ' + escHtml(p.industry) : '') + (p.country ? ' · ' + escHtml(p.country) : ''));
  if (p.ceo) rowsHtml += qrow('경영진', 'CEO ' + escHtml(p.ceo) + (p.fullTimeEmployees ? ' · 직원 ' + Number(p.fullTimeEmployees).toLocaleString() + '명' : ''));
  if (p.ipoDate) rowsHtml += qrow('상장', escHtml(p.ipoDate) + ' 상장' + (p.exchangeShortName ? ' · ' + escHtml(p.exchangeShortName) : ''));
  rowsEl.innerHTML = rowsHtml;

  // 우측 — 가격 포지션 · 거래 강도: 시안의 막대-행 시각언어를 실제 52주 레인지/거래량 데이터로 채움
  //   (v48.6에서 이동 — 데이터 우선순위: _liveData(Yahoo v7/quote) > finnhubMetrics)
  var _ld = (window._liveData || {})[d.ticker] || {};
  var _fh = d.finnhubMetrics || {};
  var _w52High = _ld.fiftyTwoWeekHigh != null ? _ld.fiftyTwoWeekHigh : (_fh['52WeekHigh'] != null ? _fh['52WeekHigh'] : null);
  var _w52Low = _ld.fiftyTwoWeekLow != null ? _ld.fiftyTwoWeekLow : (_fh['52WeekLow'] != null ? _fh['52WeekLow'] : null);
  var _vol = _ld.regularMarketVolume != null ? _ld.regularMarketVolume : null;
  var _avgVol3M = _ld.averageDailyVolume3Month != null ? _ld.averageDailyVolume3Month : null;
  var _avgVol10D = _ld.averageDailyVolume10Day != null ? _ld.averageDailyVolume10Day : null;

  function barRow(label, pct, valueText, color) {
    return '<div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">' +
      '<span style="color:var(--text-muted);">' + escHtml(label) + '</span>' +
      '<span style="color:' + color + ';font-weight:700;">' + valueText + '</span></div>' +
      '<div style="height:6px;background:var(--border-subtle);border-radius:3px;overflow:hidden;">' +
      '<div style="height:100%;width:' + Math.max(2, Math.min(100, pct)) + '%;background:' + color + ';border-radius:3px;"></div></div></div>';
  }

  var barsHtml = '';
  if (d.price && _w52High && _w52Low && _w52High > _w52Low) {
    var _pos = ((d.price - _w52Low) / (_w52High - _w52Low)) * 100;
    _pos = Math.max(0, Math.min(100, _pos));
    var _posColor = _pos > 75 ? 'var(--data-green)' : _pos < 25 ? 'var(--data-red)' : 'var(--data-amber)';
    var _posLabel = _pos > 90 ? '52주 고가 근접' : _pos > 75 ? '상단 구간' : _pos < 10 ? '52주 저가 근접' : _pos < 25 ? '하단 구간' : '중간 구간';
    barsHtml += barRow('52주 레인지 ($' + _w52Low.toFixed(2) + ' ~ $' + _w52High.toFixed(2) + ')', _pos, _posLabel + ' · ' + _pos.toFixed(0) + '%', _posColor);
  }
  if (_vol && _avgVol3M && _avgVol3M > 0) {
    var _volRatio = _vol / _avgVol3M;
    var _volLabel, _volColor;
    if (_volRatio >= 2.0) { _volLabel = '거래량 폭증'; _volColor = 'var(--data-red)'; }
    else if (_volRatio >= 1.3) { _volLabel = '거래량 상승'; _volColor = 'var(--data-amber)'; }
    else if (_volRatio < 0.5) { _volLabel = '거래량 저조'; _volColor = 'var(--text-muted)'; }
    else { _volLabel = '거래량 정상'; _volColor = 'var(--data-green)'; }
    var _vol10dRatio = (_avgVol10D && _avgVol10D > 0) ? (_vol / _avgVol10D) : null;
    barsHtml += barRow('거래량 (3개월 평균 대비, 오늘 ' + Number(_vol).toLocaleString() + '주)', Math.min(100, _volRatio * 50), _volLabel + ' ' + _volRatio.toFixed(1) + 'x' + (_vol10dRatio != null ? ' · 10일 대비 ' + _vol10dRatio.toFixed(1) + 'x' : ''), _volColor);
  }
  if (p.mktCap) barsHtml += barRow('시가총액', 100, '$' + _fmtNum(p.mktCap), 'var(--text-primary)');
  barsEl.innerHTML = barsHtml || '<span style="font-size:12px;color:var(--text-muted);">가격 포지션 데이터 없음</span>';

  sec.style.display = 'block';
}

function _renderFundSEC(d) {
  var el = document.getElementById('fund-rpt-sec');
  var body = document.getElementById('fund-rpt-sec-body');
  if (!el || !body || !d.sec) return;
  var s = d.sec;
  // v48.91: SEC API 응답 escHtml() 처리 — XSS 방지
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
  html += '<div style="padding:6px 8px;background:var(--surface-1);border-radius:3px;font-size:10px;"><span style="color:var(--text-muted);">CIK:</span> ' + escHtml(s.cik||'N/A') + '</div>';
  html += '<div style="padding:6px 8px;background:var(--surface-1);border-radius:3px;font-size:10px;"><span style="color:var(--text-muted);">SIC:</span> ' + escHtml(s.sicDescription||'N/A') + '</div>';
  html += '<div style="padding:6px 8px;background:var(--surface-1);border-radius:3px;font-size:10px;"><span style="color:var(--text-muted);">거래소:</span> ' + escHtml((s.exchanges||[]).join(', ')||'N/A') + '</div>';
  html += '</div>';
  if (s.filings && s.filings.form) {
    html += '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">최근 주요 공시 (10-K/10-Q/8-K/DEF 14A)</div>';
    var shown = 0;
    for (var i = 0; i < s.filings.form.length && shown < 8; i++) {
      var form = s.filings.form[i];
      if (['10-K','10-Q','8-K','DEF 14A','S-1','13F-HR'].indexOf(form) < 0) continue;
      var date = s.filings.filingDate ? s.filings.filingDate[i] : '';
      var desc = s.filings.primaryDocDescription ? s.filings.primaryDocDescription[i] : '';
      var accession = s.filings.accessionNumber ? s.filings.accessionNumber[i] : '';
      var formColor = form === '10-K' ? '#00e5a0' : form === '10-Q' ? '#00bcd4' : form === '8-K' ? '#ffa31a' : '#c084fc';
      html += '<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--surface-2);display:flex;gap:8px;align-items:center;">';
      // v48.91: SEC 공시 데이터 escHtml() 적용
      html += '<span style="color:' + formColor + ';font-weight:700;width:60px;font-family:var(--font-mono);">' + escHtml(form) + '</span>';
      html += '<span style="color:var(--text-muted);width:80px;">' + escHtml(date) + '</span>';
      html += '<span style="color:var(--text-secondary);flex:1;">' + escHtml(desc||'') + '</span>';
      if (accession) {
        var secUrl = 'https://www.sec.gov/Archives/edgar/data/' + (s.cik||'').replace(/^0+/,'') + '/' + accession.replace(/-/g,'') + '/' + accession + '-index.htm';
        html += '<a href="' + secUrl + '" target="_blank" style="color:var(--accent);font-size:11px;text-decoration:none;">SEC ↗</a>';
      }
      html += '</div>';
      shown++;
    }
  }
  body.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundFinancials(d) {
  var el = document.getElementById('fund-rpt-financials');
  var grid = document.getElementById('fund-rpt-fin-grid');
  if (!el || !grid) return;
  var p = d.fmpProfile || {};
  var m = (d.fmpMetrics && d.fmpMetrics[0]) || {};
  var r = (d.fmpRatios && d.fmpRatios[0]) || {};
  var inc = (d.fmpIncome && d.fmpIncome[0]) || {};
  var ev = (d.fmpEV && d.fmpEV[0]) || {};

  // SEC XBRL 폴백 데이터 준비
  var sf = d.secFin || {};
  var lastRev = (sf.revenue && sf.revenue.length > 0) ? sf.revenue[sf.revenue.length - 1] : null;
  var lastNI = (sf.netIncome && sf.netIncome.length > 0) ? sf.netIncome[sf.netIncome.length - 1] : null;
  var lastEps = (sf.eps && sf.eps.length > 0) ? sf.eps[sf.eps.length - 1] : null;
  var lastAssets = (sf.totalAssets && sf.totalAssets.length > 0) ? sf.totalAssets[sf.totalAssets.length - 1] : null;
  var lastEquity = (sf.equity && sf.equity.length > 0) ? sf.equity[sf.equity.length - 1] : null;
  var lastGross = (sf.grossProfit && sf.grossProfit.length > 0) ? sf.grossProfit[sf.grossProfit.length - 1] : null;
  var lastOpCF = (sf.opCashFlow && sf.opCashFlow.length > 0) ? sf.opCashFlow[sf.opCashFlow.length - 1] : null;
  var lastCapex = (sf.capex && sf.capex.length > 0) ? sf.capex[sf.capex.length - 1] : null;
  var lastDebt = (sf.totalDebt && sf.totalDebt.length > 0) ? sf.totalDebt[sf.totalDebt.length - 1] : null;
  var lastShares = (sf.sharesOut && sf.sharesOut.length > 0) ? sf.sharesOut[sf.sharesOut.length - 1] : null;

  // SEC 값 헬퍼
  function sv(item) { return item ? (item.val || item.value || 0) : 0; }
  // v49.0 P183: API Infinity/NaN → 'N/A' 가드
  var _fn = window._aioFiniteNum || function(v) { return (v != null && isFinite(v)) ? v : null; };

  // SEC 기반 파생 지표 계산
  var secRevVal = sv(lastRev);
  var secNIVal = sv(lastNI);
  var secEpsVal = sv(lastEps);
  var secEquityVal = sv(lastEquity);
  var secAssetsVal = sv(lastAssets);
  var secGrossVal = sv(lastGross);
  var secOpCFVal = sv(lastOpCF);
  var secCapexVal = sv(lastCapex);
  var secDebtVal = sv(lastDebt);
  var secROE = (secEquityVal && secNIVal) ? secNIVal / secEquityVal : null;
  var secGrossMargin = (secRevVal && secGrossVal) ? secGrossVal / secRevVal : null;
  var secFCF = secOpCFVal - Math.abs(secCapexVal);
  var secDE = (secEquityVal && secDebtVal) ? secDebtVal / secEquityVal : null;
  // P560/R251: d.sharesOut was never set anywhere — this always multiplied by 0, which is why
  // Market Cap showed "N/A" even with a live, non-null price. sf.sharesOut (from
  // _parseSECFinancials' new CommonStockSharesOutstanding/dei extraction) is now used instead.
  var secSharesVal = sv(lastShares);
  var secMktCap = (d.price && secSharesVal) ? d.price * secSharesVal : 0;
  // PE from SEC
  var secPE = (secEpsVal && d.price) ? d.price / secEpsVal : null;

  function card(label, value, sub, color) {
    return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">' +
      '<div style="font-size:11px;color:var(--text-muted);">' + label + '</div>' +
      '<div style="font-size:16px;font-weight:800;color:' + (color||'var(--text-primary)') + ';font-family:var(--font-mono);margin-top:2px;">' + value + '</div>' +
      (sub ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + sub + '</div>' : '') + '</div>';
  }

  // 값 선택: FMP 우선, SEC XBRL 폴백
  var mktCap = p.mktCap || ev.marketCapitalization || secMktCap || 0;
  var peVal = m.peRatio || p.pe || secPE;
  var roeVal = r.returnOnEquity || secROE;
  var epsVal = inc.epsdiluted || secEpsVal;
  var revVal = inc.revenue || secRevVal;
  var niVal = inc.netIncome || secNIVal;
  var gmVal = r.grossProfitMargin || secGrossMargin;
  var deVal = r.debtEquityRatio || secDE;
  var revYear = inc.revenue ? (inc.calendarYear || inc.date || '').slice(0,4) : (lastRev ? (lastRev.end||'').slice(0,4) : '');
  var isSEC = !inc.revenue && secRevVal; // SEC 폴백 사용 여부

  var html = '';
  html += card('시가총액', mktCap > 0 ? '$' + _fmtNum(mktCap) : 'N/A', p.sector || (isSEC ? 'SEC XBRL' : ''));
  html += card('P/E (TTM)', _fn(peVal) !== null ? peVal.toFixed(1) + 'x' : 'N/A', peVal > 30 ? '고평가 영역' : peVal > 15 ? '적정' : (peVal ? '저평가 영역' : ''), peVal > 40 ? '#ff5b50' : peVal < 15 ? '#00e5a0' : '#ffa31a');
  html += card('ROE', _fn(roeVal) !== null ? (roeVal * 100).toFixed(1) + '%' : 'N/A', roeVal > 0.2 ? '우수' : roeVal > 0.1 ? '양호' : (roeVal ? '주의' : ''), roeVal > 0.2 ? '#00e5a0' : roeVal > 0.1 ? '#ffa31a' : '#ff5b50');
  html += card('EPS (TTM)', epsVal ? '$' + epsVal.toFixed(2) : 'N/A', '');
  html += card('매출', revVal ? '$' + _fmtNum(revVal) : 'N/A', revYear ? 'FY ' + revYear : '');
  html += card('순이익', niVal ? '$' + _fmtNum(niVal) : 'N/A', '', (niVal || 0) >= 0 ? '#00e5a0' : '#ff5b50');
  html += card('Gross Margin', gmVal ? (gmVal * 100).toFixed(1) + '%' : 'N/A', '매출총이익률');
  html += card('FCF Yield', m.freeCashFlowYield ? (m.freeCashFlowYield * 100).toFixed(1) + '%' : (secFCF && mktCap > 0 ? ((secFCF / mktCap) * 100).toFixed(1) + '%' : 'N/A'), '잉여현금흐름 수익률');
  html += card('EV/EBITDA', _fn(m.enterpriseValueOverEBITDA) !== null ? m.enterpriseValueOverEBITDA.toFixed(1) + 'x' : 'N/A', '기업가치 대비');
  html += card('P/B', _fn(m.pbRatio) !== null ? m.pbRatio.toFixed(2) + 'x' : (secEquityVal && d.price && secEquityVal > 0 ? (mktCap / secEquityVal).toFixed(2) + 'x' : 'N/A'), '주가순자산비율');
  html += card('부채비율', _fn(deVal) !== null ? deVal.toFixed(2) + 'x' : 'N/A', deVal > 2 ? '높음' : (deVal ? '안정' : ''), deVal > 2 ? '#ff5b50' : '#00e5a0');
  html += card('배당수익률', (p.lastDiv && d.price && d.price > 0) ? ((p.lastDiv / d.price) * 100).toFixed(2) + '%' : (p.lastDiv ? 'N/A' : '0%'), '연간 배당');

  if (isSEC) { html += '<div style="grid-column:1/-1;text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">SEC EDGAR XBRL 기반 데이터 (FMP API 키 설정 시 더 풍부한 지표 제공)</div>'; }

  // v48.1: SEC XBRL 신규 8필드 품질/건전성 카드 추가
  //   R&D Intensity (R&D/매출), SBC 희석 (SBC/매출), SG&A 비중, Cash 포지션, 운전자본(재고/매출채권/유동부채)
  var lastRd = (sf.rd && sf.rd.length > 0) ? sv(sf.rd[sf.rd.length - 1]) : 0;
  var lastSbc = (sf.sbc && sf.sbc.length > 0) ? sv(sf.sbc[sf.sbc.length - 1]) : 0;
  var lastSga = (sf.sga && sf.sga.length > 0) ? sv(sf.sga[sf.sga.length - 1]) : 0;
  var lastCash = (sf.cash && sf.cash.length > 0) ? sv(sf.cash[sf.cash.length - 1]) : 0;
  var lastInv = (sf.inventory && sf.inventory.length > 0) ? sv(sf.inventory[sf.inventory.length - 1]) : 0;
  var lastRcv = (sf.receivables && sf.receivables.length > 0) ? sv(sf.receivables[sf.receivables.length - 1]) : 0;
  var lastCurDebt = (sf.currentDebt && sf.currentDebt.length > 0) ? sv(sf.currentDebt[sf.currentDebt.length - 1]) : 0;
  var hasQuality = lastRd || lastSbc || lastSga || lastCash || lastInv || lastRcv || lastCurDebt;
  if (hasQuality) {
    var qHtml = '<div style="grid-column:1/-1;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:10px;color:var(--text-secondary);font-weight:600;">SEC XBRL — 성장주 품질 & 운전자본 (v48.1 신규)</div>';
    if (lastRd && secRevVal) {
      var rdRatio = (lastRd / secRevVal) * 100;
      qHtml += card('R&D 강도', rdRatio.toFixed(1) + '%', 'R&D / 매출' + (rdRatio > 15 ? ' · 고투자' : rdRatio > 5 ? ' · 양호' : ''), rdRatio > 15 ? '#00bcd4' : rdRatio > 5 ? '#00e5a0' : '#7b8599');
    }
    if (lastSbc && secRevVal) {
      var sbcRatio = (lastSbc / secRevVal) * 100;
      qHtml += card('SBC 희석', sbcRatio.toFixed(1) + '%', 'SBC / 매출' + (sbcRatio > 10 ? ' · 높은 희석' : sbcRatio > 3 ? ' · 중간' : ''), sbcRatio > 10 ? '#ff5b50' : sbcRatio > 3 ? '#ffa31a' : '#00e5a0');
    }
    if (lastSga && secRevVal) qHtml += card('SG&A 비중', ((lastSga / secRevVal) * 100).toFixed(1) + '%', '판매관리비 / 매출');
    if (lastCash) qHtml += card('현금 포지션', '$' + _fmtNum(lastCash), 'Cash & Equivalents');
    if (lastInv) qHtml += card('재고', '$' + _fmtNum(lastInv), '');
    if (lastRcv) qHtml += card('매출채권', '$' + _fmtNum(lastRcv), '');
    if (lastCurDebt) qHtml += card('유동부채', '$' + _fmtNum(lastCurDebt), '1년 내 상환');
    html += qHtml;
  }

  // v48.10: SEC XBRL Frames 섹터 백분위 순위 시각화 (수집만 하던 collected.secFrameRank UI 노출)
  //   전 US-GAAP 보고 기업 중 본 기업의 Revenues/NetIncomeLoss 순위 → 섹터 내 상대 위치 정량화
  var _sfr = d.secFrameRank || null;
  if (_sfr && (_sfr.revenue || _sfr.netIncome)) {
    var rankHtml = '<div style="grid-column:1/-1;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">';
    rankHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    rankHtml += '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);">SEC XBRL 섹터 백분위 (v48.10 신규)</div>';
    rankHtml += '<div style="font-size:10px;color:var(--text-muted);">전 US-GAAP 보고 기업 대비</div>';
    rankHtml += '</div>';
    function _rankCard(title, rr, unit) {
      if (!rr || rr.myVal == null) return '';
      var topPct = rr.pctile != null ? (100 - rr.pctile) : null;
      var topColor = topPct != null && topPct <= 5 ? '#10b981' : topPct != null && topPct <= 25 ? '#00e5a0' : topPct != null && topPct <= 50 ? '#ffa31a' : '#ff5b50';
      var topLabel = topPct != null ? ('상위 ' + topPct.toFixed(1) + '%') : '';
      var rankLabel = rr.rank != null ? ('Rank ' + rr.rank + ' / ' + rr.n) : '';
      var myValStr = (unit === 'USD' || !unit) ? '$' + _fmtNum(rr.myVal) : rr.myVal.toFixed(2) + (unit||'');
      var avgStr = '$' + _fmtNum(rr.avg);
      var medStr = '$' + _fmtNum(rr.median);
      var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">';
      html += '<div style="font-size:10px;color:var(--text-muted);font-weight:600;">' + title + ' (' + (rr.period||'') + ')</div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">';
      html += '<span style="font-size:15px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);">' + myValStr + '</span>';
      html += '<span style="font-size:11px;color:' + topColor + ';font-weight:700;">' + topLabel + '</span>';
      html += '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">' + rankLabel + '</div>';
      html += '<div style="display:flex;gap:8px;margin-top:6px;font-size:11px;color:var(--text-muted);">';
      html += '<span>평균 ' + avgStr + '</span>';
      html += '<span>중위수 ' + medStr + '</span>';
      html += '</div>';
      html += '</div>';
      return html;
    }
    rankHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;">';
    if (_sfr.revenue) rankHtml += _rankCard('Revenues', _sfr.revenue, 'USD');
    if (_sfr.netIncome) rankHtml += _rankCard('Net Income', _sfr.netIncome, 'USD');
    rankHtml += '</div>';
    rankHtml += '</div>';
    html += rankHtml;
  }

  // v48.7: Finnhub 애널리스트 추천 바 차트 + FMP 목표가 컨센서스 통합 섹션
  //   Finnhub /stock/recommendation: { strongBuy, buy, hold, sell, strongSell } — 5구간 누적 바
  //   FMP price-target-consensus: { targetConsensus, targetHigh, targetLow } — upside % 계산
  //   둘 다 없으면 섹션 생략. 하나만 있어도 해당 부분만 렌더.
  var _fhRec = d.finnhubRecommendation || null;
  var _ptC = d.fmpPriceTarget || null;
  if (_fhRec || _ptC) {
    var recHtml = '<div style="grid-column:1/-1;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">';
    recHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    recHtml += '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);">애널리스트 컨센서스 (v48.7 신규)</div>';
    if (_fhRec && _fhRec.period) recHtml += '<div style="font-size:10px;color:var(--text-muted);">Finnhub · ' + _fhRec.period + '</div>';
    recHtml += '</div>';

    if (_fhRec) {
      var _sb = _fhRec.strongBuy || 0;
      var _b = _fhRec.buy || 0;
      var _h = _fhRec.hold || 0;
      var _s = _fhRec.sell || 0;
      var _ss = _fhRec.strongSell || 0;
      var _total = _sb + _b + _h + _s + _ss;
      if (_total > 0) {
        // 5구간 누적 바 — Strong Buy / Buy / Hold / Sell / Strong Sell
        var _pSB = (_sb / _total * 100).toFixed(1);
        var _pB  = (_b  / _total * 100).toFixed(1);
        var _pH  = (_h  / _total * 100).toFixed(1);
        var _pS  = (_s  / _total * 100).toFixed(1);
        var _pSS = (_ss / _total * 100).toFixed(1);
        // 종합 판정: strongBuy+buy 비중이 우세면 Buy, sell+strongSell 우세면 Sell, 아니면 Hold
        var _bullish = _sb + _b;
        var _bearish = _s + _ss;
        var _verdict, _verdictColor;
        if (_bullish / _total >= 0.6) { _verdict = '매수 우세'; _verdictColor = '#10b981'; }
        else if (_bullish / _total >= 0.4) { _verdict = '완만 매수'; _verdictColor = '#00e5a0'; }
        else if (_bearish / _total >= 0.4) { _verdict = '매도 우세'; _verdictColor = '#ff5b50'; }
        else { _verdict = '중립'; _verdictColor = '#ffa31a'; }
        recHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11px;">';
        recHtml += '<span style="color:var(--text-muted);">총 ' + _total + '명 애널리스트</span>';
        recHtml += '<span style="padding:3px 10px;background:' + _verdictColor + '22;border:1px solid ' + _verdictColor + ';color:' + _verdictColor + ';border-radius:4px;font-weight:700;">' + _verdict + '</span>';
        recHtml += '</div>';
        // 누적 바 (height 22px)
        recHtml += '<div style="display:flex;height:22px;border-radius:3px;overflow:hidden;font-size:10px;font-weight:700;">';
        if (_sb > 0) recHtml += '<div style="width:' + _pSB + '%;background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center;" title="Strong Buy ' + _sb + '명">' + (parseFloat(_pSB) >= 8 ? _sb : '') + '</div>';
        if (_b > 0)  recHtml += '<div style="width:' + _pB  + '%;background:#3ddba5;color:#0f1623;display:flex;align-items:center;justify-content:center;" title="Buy ' + _b + '명">' + (parseFloat(_pB) >= 8 ? _b : '') + '</div>';
        if (_h > 0)  recHtml += '<div style="width:' + _pH  + '%;background:#fbbf24;color:#0f1623;display:flex;align-items:center;justify-content:center;" title="Hold ' + _h + '명">' + (parseFloat(_pH) >= 8 ? _h : '') + '</div>';
        if (_s > 0)  recHtml += '<div style="width:' + _pS  + '%;background:#f87171;color:#fff;display:flex;align-items:center;justify-content:center;" title="Sell ' + _s + '명">' + (parseFloat(_pS) >= 8 ? _s : '') + '</div>';
        if (_ss > 0) recHtml += '<div style="width:' + _pSS + '%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;" title="Strong Sell ' + _ss + '명">' + (parseFloat(_pSS) >= 8 ? _ss : '') + '</div>';
        recHtml += '</div>';
        // 범례
        recHtml += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--text-muted);font-weight:600;">';
        recHtml += '<span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:2px;margin-right:4px;"></span>Strong Buy ' + _sb + ' (' + _pSB + '%)</span>';
        recHtml += '<span><span style="display:inline-block;width:8px;height:8px;background:#3ddba5;border-radius:2px;margin-right:4px;"></span>Buy ' + _b + ' (' + _pB + '%)</span>';
        recHtml += '<span><span style="display:inline-block;width:8px;height:8px;background:#fbbf24;border-radius:2px;margin-right:4px;"></span>Hold ' + _h + ' (' + _pH + '%)</span>';
        recHtml += '<span><span style="display:inline-block;width:8px;height:8px;background:#f87171;border-radius:2px;margin-right:4px;"></span>Sell ' + _s + ' (' + _pS + '%)</span>';
        recHtml += '<span><span style="display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:2px;margin-right:4px;"></span>Strong Sell ' + _ss + ' (' + _pSS + '%)</span>';
        recHtml += '</div>';
      }
    }

    // FMP 목표가 컨센서스 (있으면) — 현재가 대비 upside 시각화
    if (_ptC) {
      var _tgtC = _ptC.targetConsensus != null ? _ptC.targetConsensus : null;
      var _tgtH = _ptC.targetHigh != null ? _ptC.targetHigh : null;
      var _tgtL = _ptC.targetLow != null ? _ptC.targetLow : null;
      if (_tgtC && d.price) {
        var _upside = ((_tgtC - d.price) / d.price * 100);
        var _upColor = _upside >= 15 ? '#10b981' : _upside >= 0 ? '#00e5a0' : _upside >= -10 ? '#ffa31a' : '#ff5b50';
        recHtml += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--surface-5);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px;">';
        recHtml += '<span style="font-weight:700;color:var(--text-secondary);">FMP 목표가 컨센서스</span>';
        recHtml += '<span style="font-family:var(--font-mono);font-size:14px;font-weight:800;color:' + _upColor + ';">$' + _tgtC.toFixed(2) + '</span>';
        recHtml += '<span style="padding:2px 8px;background:' + _upColor + '22;border:1px solid ' + _upColor + ';color:' + _upColor + ';border-radius:4px;font-weight:700;">' + (_upside >= 0 ? '+' : '') + _upside.toFixed(1) + '% upside</span>';
        if (_tgtH && _tgtL) recHtml += '<span style="color:var(--text-muted);">범위 $' + _tgtL.toFixed(2) + ' ~ $' + _tgtH.toFixed(2) + '</span>';
        recHtml += '</div>';
      }
    }

    recHtml += '</div>';
    html += recHtml;
  }

  grid.innerHTML = html;
  el.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────
// v49.72 신규: _renderFundamentalFinancialsCharts — DART Financials 스타일 7 차트 렌더
// 입력: { ticker, available, dataSource, period, latestQuarter, asOf, income[], balance[], cashflow[], ratios[] }
// 의존: window.Chart (Chart.js) + window._aioChartRegistry (v48.96 P167)
// R138: fundamental 종목 검색 시 7 차트 자동 렌더 의무
// ─────────────────────────────────────────────────────────────────
function _renderFundamentalFinancialsCharts(data) {
  var card = document.getElementById('fund-rpt-fincharts');
  if (!card) return;
  card.style.display = 'block';
  var meta = document.getElementById('fund-fin-meta');
  if (meta) {
    if (data && data.available) {
      meta.textContent = (data.dataSource || 'FMP') + ' · period=' + (data.period || 'quarter') + (data.latestQuarter ? (' · 기준일 ' + data.latestQuarter) : '');
    } else {
      meta.textContent = (data && data.dataSource) ? (data.dataSource + ' · ' + (data.reason || '데이터 부재')) : '데이터 부재 — 외부 확인 권장';
    }
  }

  // helper: 분기 시리즈 → {labels[], values[]} (오래된 → 최신 순으로 reverse)
  function _series(arr, field) {
    if (!Array.isArray(arr) || arr.length === 0) return { labels: [], values: [] };
    var slice = arr.slice(0, 5).reverse();  // 최근 5분기
    return {
      labels: slice.map(function(q){ return (q.date || q.period || '').slice(0, 7); }),
      values: slice.map(function(q){ var v = q[field]; return (v != null && isFinite(v)) ? Number(v) : null; })
    };
  }
  function _fmt(n) {
    if (n == null || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e12) return (n/1e12).toFixed(2) + 'T';
    if (abs >= 1e9)  return (n/1e9 ).toFixed(2) + 'B';
    if (abs >= 1e6)  return (n/1e6 ).toFixed(2) + 'M';
    if (abs >= 1e3)  return (n/1e3 ).toFixed(2) + 'K';
    return n.toFixed(2);
  }
  function _pct(n) { return (n != null && isFinite(n)) ? (n*100).toFixed(2) + '%' : '—'; }

  var canvasIds = [
    'fund-growth-chart', 'fund-profitability-chart', 'fund-balance-chart',
    'fund-cashflow-chart', 'fund-liquidity-chart', 'fund-curratio-donut', 'fund-workingcap-chart'
  ];
  // 기존 차트 destroy (재렌더 시 중복 방지)
  if (window._aioChartRegistry && typeof window._aioChartRegistry.destroyIfExists === 'function') {
    canvasIds.forEach(function(id){ window._aioChartRegistry.destroyIfExists(id); });
  }

  // Chart.js 부재 / 데이터 부재 → placeholder
  if (typeof window.Chart === 'undefined') {
    canvasIds.forEach(function(id){
      var cv = document.getElementById(id);
      if (cv) cv.setAttribute('data-fallback', 'chart-js-missing');
    });
    return;
  }
  if (!data || !data.available) {
    canvasIds.forEach(function(id){
      var cv = document.getElementById(id);
      if (cv) cv.setAttribute('data-operational-use', 'reference-only');
    });
    // 7번째 카드 (Valuation cards) 폴백
    var vc = document.getElementById('fund-valuation-cards');
    var cb = document.getElementById('fund-calc-basis');
    if (vc) vc.innerHTML = '<div style="grid-column:1/-1;color:var(--text-muted);font-size:10px;padding:8px;text-align:center;">5년 분기 데이터 부재 — 외부 확인 권장</div>';
    if (cb) cb.textContent = (data && data.reason) || '데이터 미수신';
    return;
  }

  var COLORS = {
    rev: '#00bcd4', op: '#ffa31a', net: '#00e5a0',
    opM: '#ffa31a', netM: '#00e5a0', roe: '#a855f7',
    assets: '#ffa31a', liab: '#ff5b50', equity: '#00e5a0',
    opCF: '#00e5a0', invCF: '#ff5b50', finCF: '#a855f7',
    cash: '#00e5a0', curLiab: '#ffa31a', totLiab: '#ff5b50',
    recv: '#7dd3fc', inv: '#00bcd4', curAssets: '#00e5a0'
  };

  // ① Growth — Revenue/OpIncome/NetIncome (bar)
  var gRev = _series(data.income, 'revenue');
  var gOp  = _series(data.income, 'operatingIncome');
  var gNI  = _series(data.income, 'netIncome');
  var cv1 = document.getElementById('fund-growth-chart');
  if (cv1) {
    var ctx1 = cv1.getContext('2d');
    var c1 = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: gRev.labels,
        datasets: [
          { label: 'Revenue', data: gRev.values, backgroundColor: COLORS.rev },
          { label: 'OpInc',   data: gOp.values,  backgroundColor: COLORS.op  },
          { label: 'NetInc',  data: gNI.values,  backgroundColor: COLORS.net }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-growth-chart', c1);
  }
  var tg = document.getElementById('fund-growth-table');
  if (tg) {
    tg.innerHTML = gRev.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>R ' + _fmt(gRev.values[i]) + ' · O ' + _fmt(gOp.values[i]) + ' · N ' + _fmt(gNI.values[i]) + '</span></div>';
    }).join('');
  }

  // ② Profitability — OpMargin/NetMargin/ROE (line)
  var pOpM  = _series(data.ratios, 'operatingProfitMargin');
  var pNetM = _series(data.ratios, 'netProfitMargin');
  var pROE  = _series(data.ratios, 'returnOnEquity');
  var cv2 = document.getElementById('fund-profitability-chart');
  if (cv2) {
    var ctx2 = cv2.getContext('2d');
    var c2 = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: pOpM.labels,
        datasets: [
          { label: 'OpMargin',  data: pOpM.values.map(function(v){return v!=null?v*100:null;}),  borderColor: COLORS.opM,  backgroundColor: 'transparent', tension: 0.3 },
          { label: 'NetMargin', data: pNetM.values.map(function(v){return v!=null?v*100:null;}), borderColor: COLORS.netM, backgroundColor: 'transparent', tension: 0.3 },
          { label: 'ROE',       data: pROE.values.map(function(v){return v!=null?v*100:null;}),  borderColor: COLORS.roe,  backgroundColor: 'transparent', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return v.toFixed(1) + '%'; } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-profitability-chart', c2);
  }
  var tp = document.getElementById('fund-profitability-table');
  if (tp) {
    tp.innerHTML = pOpM.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>OpM ' + _pct(pOpM.values[i]) + ' · NM ' + _pct(pNetM.values[i]) + ' · ROE ' + _pct(pROE.values[i]) + '</span></div>';
    }).join('');
  }

  // ③ Balance Sheet — Assets/Liab/Equity (bar)
  var bA = _series(data.balance, 'totalAssets');
  var bL = _series(data.balance, 'totalLiabilities');
  var bE = _series(data.balance, 'totalStockholdersEquity');
  var cv3 = document.getElementById('fund-balance-chart');
  if (cv3) {
    var ctx3 = cv3.getContext('2d');
    var c3 = new Chart(ctx3, {
      type: 'bar',
      data: { labels: bA.labels, datasets: [
        { label: 'Assets', data: bA.values, backgroundColor: COLORS.assets },
        { label: 'Liab',   data: bL.values, backgroundColor: COLORS.liab },
        { label: 'Equity', data: bE.values, backgroundColor: COLORS.equity }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-balance-chart', c3);
  }
  var tb = document.getElementById('fund-balance-table');
  if (tb) {
    tb.innerHTML = bA.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>A ' + _fmt(bA.values[i]) + ' · L ' + _fmt(bL.values[i]) + ' · E ' + _fmt(bE.values[i]) + '</span></div>';
    }).join('');
  }

  // ④ Cash Flow — Operating/Investing/Financing (bar)
  var cOp = _series(data.cashflow, 'operatingCashFlow');
  var cIn = _series(data.cashflow, 'netCashUsedForInvestingActivites');
  var cFi = _series(data.cashflow, 'netCashUsedProvidedByFinancingActivities');
  var cv4 = document.getElementById('fund-cashflow-chart');
  if (cv4) {
    var ctx4 = cv4.getContext('2d');
    var c4 = new Chart(ctx4, {
      type: 'bar',
      data: { labels: cOp.labels, datasets: [
        { label: 'Op CF',  data: cOp.values, backgroundColor: COLORS.opCF },
        { label: 'Inv CF', data: cIn.values, backgroundColor: COLORS.invCF },
        { label: 'Fin CF', data: cFi.values, backgroundColor: COLORS.finCF }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-cashflow-chart', c4);
  }
  var tc = document.getElementById('fund-cashflow-table');
  if (tc) {
    tc.innerHTML = cOp.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>Op ' + _fmt(cOp.values[i]) + ' · Inv ' + _fmt(cIn.values[i]) + ' · Fin ' + _fmt(cFi.values[i]) + '</span></div>';
    }).join('');
  }

  // ⑤ Liquidity — Cash / CurLiab / TotLiab (line) + Current Ratio (donut)
  var lCash = _series(data.balance, 'cashAndCashEquivalents');
  var lCL   = _series(data.balance, 'totalCurrentLiabilities');
  var lTL   = _series(data.balance, 'totalLiabilities');
  var cv5a = document.getElementById('fund-liquidity-chart');
  if (cv5a) {
    var ctx5a = cv5a.getContext('2d');
    var c5a = new Chart(ctx5a, {
      type: 'line',
      data: { labels: lCash.labels, datasets: [
        { label: 'Cash',     data: lCash.values, borderColor: COLORS.cash,    backgroundColor: 'transparent', tension: 0.3 },
        { label: 'Cur Liab', data: lCL.values,   borderColor: COLORS.curLiab, backgroundColor: 'transparent', tension: 0.3 },
        { label: 'Tot Liab', data: lTL.values,   borderColor: COLORS.totLiab, backgroundColor: 'transparent', tension: 0.3 }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-liquidity-chart', c5a);
  }
  // Current Ratio Donut — latest quarter
  var curRatio = data.ratios && data.ratios[0] && data.ratios[0].currentRatio;
  var cv5b = document.getElementById('fund-curratio-donut');
  if (cv5b && curRatio != null && isFinite(curRatio)) {
    var ratioColor = curRatio >= 2 ? COLORS.cash : curRatio >= 1 ? COLORS.curLiab : COLORS.totLiab;
    var ctx5b = cv5b.getContext('2d');
    var displayVal = Math.min(curRatio, 3);  // 3.0 cap for donut visualization
    var c5b = new Chart(ctx5b, {
      type: 'doughnut',
      data: { labels: ['Current Ratio', 'Remaining'], datasets: [{ data: [displayVal, Math.max(3 - displayVal, 0)], backgroundColor: [ratioColor, 'rgba(255,255,255,0.05)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c){ return c.dataIndex === 0 ? 'Current Ratio: ' + curRatio.toFixed(2) + 'x' : ''; } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-curratio-donut', c5b);
  }
  var tl = document.getElementById('fund-liquidity-table');
  if (tl) {
    tl.innerHTML = lCash.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>Cash ' + _fmt(lCash.values[i]) + ' · CL ' + _fmt(lCL.values[i]) + ' · TL ' + _fmt(lTL.values[i]) + '</span></div>';
    }).join('') + (curRatio != null ? '<div style="margin-top:4px;padding:4px;background:rgba(255,255,255,0.04);border-radius:4px;text-align:center;">Current Ratio: <strong>' + curRatio.toFixed(2) + 'x</strong> · ' + (curRatio >= 2 ? '강건' : curRatio >= 1 ? '정상' : '주의') + '</div>' : '');
  }

  // ⑥ Working Capital — Receivables/Inventory/CurAssets (line)
  var wR = _series(data.balance, 'netReceivables');
  var wI = _series(data.balance, 'inventory');
  var wA = _series(data.balance, 'totalCurrentAssets');
  var cv6 = document.getElementById('fund-workingcap-chart');
  if (cv6) {
    var ctx6 = cv6.getContext('2d');
    var c6 = new Chart(ctx6, {
      type: 'line',
      data: { labels: wR.labels, datasets: [
        { label: 'Recv',  data: wR.values, borderColor: COLORS.recv,      backgroundColor: 'transparent', tension: 0.3 },
        { label: 'Inv',   data: wI.values, borderColor: COLORS.inv,       backgroundColor: 'transparent', tension: 0.3 },
        { label: 'CurA',  data: wA.values, borderColor: COLORS.curAssets, backgroundColor: 'transparent', tension: 0.3 }
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 9 } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', font: { size: 9 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-workingcap-chart', c6);
  }
  var tw = document.getElementById('fund-workingcap-table');
  if (tw) {
    tw.innerHTML = wR.labels.map(function(lab, i){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted rgba(255,255,255,0.05);"><span>' + lab + '</span><span>R ' + _fmt(wR.values[i]) + ' · I ' + _fmt(wI.values[i]) + ' · CA ' + _fmt(wA.values[i]) + '</span></div>';
    }).join('');
  }

  // ⑦ Valuation Multiples — P/E, P/B, P/S cards + Calculation Basis
  var latestRatio = data.ratios && data.ratios[0] || {};
  var pe = latestRatio.priceEarningsRatio || latestRatio.peRatio || null;
  var pb = latestRatio.priceToBookRatio   || latestRatio.pbRatio || null;
  var ps = latestRatio.priceToSalesRatio  || latestRatio.psRatio || null;
  var vcards = document.getElementById('fund-valuation-cards');
  if (vcards) {
    function _vCard(label, val, color) {
      return '<div style="background:rgba(255,255,255,0.04);border-radius:3px;padding:6px 4px;text-align:center;">' +
        '<div style="font-size:11px;color:var(--text-muted);">' + label + '</div>' +
        '<div style="font-size:14px;font-weight:800;color:' + color + ';font-family:var(--font-mono);margin-top:2px;">' + (val != null && isFinite(val) ? Number(val).toFixed(2) + 'x' : '—') + '</div>' +
      '</div>';
    }
    vcards.innerHTML = _vCard('P/E', pe, '#00bcd4') + _vCard('P/B', pb, '#ffa31a') + _vCard('P/S', ps, '#00e5a0');
  }
  var basis = document.getElementById('fund-calc-basis');
  if (basis) {
    var ld = (window._liveData || {})[data.ticker] || {};
    var lastClose = ld.price != null ? ld.price : null;
    var latestEps = data.income && data.income[0] && (data.income[0].eps || data.income[0].epsdiluted);
    basis.innerHTML = '<div style="border-top:1px dashed rgba(255,255,255,0.08);padding-top:4px;margin-top:4px;">' +
      '<div>· Latest close: ' + (lastClose != null ? '$' + lastClose.toFixed(2) : '—') + '</div>' +
      '<div>· Latest quarter: ' + (data.latestQuarter || '—') + '</div>' +
      '<div>· Latest EPS (Q): ' + (latestEps != null ? '$' + Number(latestEps).toFixed(2) : '—') + '</div>' +
      '<div>· Data source: ' + (data.dataSource || 'FMP') + '</div>' +
      '</div>';
  }
}

function _renderFundStatements(d) {
  var el = document.getElementById('fund-rpt-statements');
  var body = document.getElementById('fund-rpt-stmt-body');
  if (!el || !body) return;

  // FMP 데이터 우선, 없으면 SEC XBRL
  var incomeData = d.fmpIncome || [];
  var html = '';

  if (incomeData.length > 0) {
    // 연도 역순 → 정순으로
    var years = incomeData.slice(0, 5).reverse();
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;">';
    html += '<tr style="border-bottom:1px solid var(--border);">';
    html += '<th style="text-align:left;padding:6px;color:var(--text-muted);font-weight:600;">항목</th>';
    years.forEach(function(y) { html += '<th style="text-align:right;padding:6px;color:var(--text-muted);font-weight:600;">' + (y.calendarYear || (y.date||'').slice(0,4)) + '</th>'; });
    html += '</tr>';

    function row(label, key, isCurrency) {
      var r = '<tr style="border-bottom:1px solid var(--surface-2);">';
      r += '<td style="padding:5px 6px;color:var(--text-secondary);">' + label + '</td>';
      years.forEach(function(y) {
        var v = y[key];
        var color = v != null && v < 0 ? '#ff5b50' : 'var(--text-primary)';
        r += '<td style="text-align:right;padding:5px 6px;color:' + color + ';font-family:var(--font-mono);">' + (isCurrency ? '$' : '') + _fmtNum(v) + '</td>';
      });
      r += '</tr>';
      return r;
    }

    html += row('매출 (Revenue)', 'revenue', true);
    html += row('매출원가', 'costOfRevenue', true);
    html += row('매출총이익', 'grossProfit', true);
    html += row('영업이익', 'operatingIncome', true);
    html += row('순이익', 'netIncome', true);
    html += row('EPS', 'epsdiluted', false);
    html += row('EBITDA', 'ebitda', true);

    // 성장률 행 추가
    html += '<tr style="border-top:2px solid var(--border);"><td style="padding:5px 6px;color:var(--accent);font-weight:700;">매출 성장률</td>';
    years.forEach(function(y, i) {
      if (i === 0) { html += '<td style="text-align:right;padding:5px 6px;color:var(--text-muted);">—</td>'; return; }
      var prev = years[i-1].revenue;
      var cur = y.revenue;
      var growth = prev ? ((cur - prev) / Math.abs(prev) * 100) : 0;
      var gc = growth >= 0 ? '#00e5a0' : '#ff5b50';
      html += '<td style="text-align:right;padding:5px 6px;color:' + gc + ';font-family:var(--font-mono);font-weight:700;">' + _fmtPct(growth) + '</td>';
    });
    html += '</tr>';

    html += '</table></div>';
  } else if (d.secFin && d.secFin.revenue && d.secFin.revenue.length > 0) {
    // SEC XBRL 폴백
    html += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">SEC EDGAR XBRL 기반 (10-K 연간)</div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;">';
    html += '<tr style="border-bottom:1px solid var(--border);">';
    html += '<th style="text-align:left;padding:6px;color:var(--text-muted);">항목</th>';
    d.secFin.revenue.forEach(function(r) { html += '<th style="text-align:right;padding:6px;color:var(--text-muted);">' + (r.end||'').slice(0,4) + '</th>'; });
    html += '</tr>';

    function secRow(label, arr) {
      var r = '<tr style="border-bottom:1px solid var(--surface-2);">';
      r += '<td style="padding:5px 6px;color:var(--text-secondary);">' + label + '</td>';
      (arr||[]).forEach(function(v) {
        var val = v.val || v.value || 0;
        var color = val < 0 ? '#ff5b50' : 'var(--text-primary)';
        r += '<td style="text-align:right;padding:5px 6px;color:' + color + ';font-family:var(--font-mono);">$' + _fmtNum(val) + '</td>';
      });
      r += '</tr>';
      return r;
    }
    html += secRow('매출', d.secFin.revenue);
    html += secRow('순이익', d.secFin.netIncome);
    html += secRow('총자산', d.secFin.totalAssets);
    html += secRow('자기자본', d.secFin.equity);
    html += secRow('영업CF', d.secFin.opCashFlow);
    html += '</table></div>';
  } else {
    html += '<div style="padding:15px;text-align:center;color:var(--text-muted);font-size:10px;">재무제표 데이터 없음 (FMP API 키를 설정하면 풍부한 데이터를 볼 수 있습니다)</div>';
  }

  body.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundValuation(d) {
  var el = document.getElementById('fund-rpt-valuation');
  var body = document.getElementById('fund-rpt-val-body');
  if (!el || !body) return;
  // v35.4: TTM 데이터 우선, Annual fallback
  var mt = d.fmpMetricsTTM || {};
  var rt = d.fmpRatiosTTM || {};
  var ma = (d.fmpMetrics && d.fmpMetrics[0]) || {};
  var ra = (d.fmpRatios && d.fmpRatios[0]) || {};
  var p = d.fmpProfile || {};
  var hasTTM = !!(mt.peRatioTTM || rt.peRatioTTM);
  if (!mt.peRatioTTM && !ma.peRatio && !ra.priceEarningsRatio) { el.style.display = 'none'; return; }
  // v49.0 P183: Infinity/NaN → 'N/A' 가드 (API 0-분모 비율 대비)
  var _fn = window._aioFiniteNum || function(v) { return (v != null && isFinite(v)) ? v : null; };
  function _fv(a, b) { return _fn(a) !== null ? a : (_fn(b) !== null ? b : null); }
  function _fv3(a, b, c) { return _fn(a) !== null ? a : (_fn(b) !== null ? b : (_fn(c) !== null ? c : null)); }

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

  // 좌측: 밸류에이션 지표 (TTM 우선)
  html += '<div>';
  html += '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">핵심 배수' + (hasTTM ? ' <span style="color:#3ddba5;font-size:11px;">TTM</span>' : ' <span style="color:#f59e0b;font-size:11px;">Annual</span>') + '</div>';
  function valRow(label, val, bench) {
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--surface-2);font-size:10px;">' +
      '<span style="color:var(--text-secondary);">' + label + '</span>' +
      '<span style="color:var(--text-primary);font-family:var(--font-mono);font-weight:600;">' + val + '</span></div>';
  }
  // v49.0 P183: _fv/_fn으로 || 0 패턴 제거 (0.0x 오표시·Infinityx 방지)
  var _pe = _fv(mt.peRatioTTM, ma.peRatio); html += valRow('P/E (TTM)', _pe !== null ? _pe.toFixed(1) + 'x' : 'N/A');
  html += valRow('Forward P/E', _fn(p.pe) !== null ? p.pe.toFixed(1) + 'x' : 'N/A');
  var _pb = _fv(mt.priceToBookRatioTTM, ma.pbRatio); html += valRow('P/B', _pb !== null ? _pb.toFixed(2) + 'x' : 'N/A');
  var _ps = _fv3(mt.priceToSalesRatioTTM, ma.priceToSalesRatio, ra.priceToSalesRatio); html += valRow('P/S', _ps !== null ? _ps.toFixed(2) + 'x' : 'N/A');
  var _eveb = _fv(mt.enterpriseValueOverEBITDATTM, ma.enterpriseValueOverEBITDA); html += valRow('EV/EBITDA', _eveb !== null ? _eveb.toFixed(1) + 'x' : 'N/A');
  var _evs = _fv(mt.evToSalesTTM, ma.evToSales); html += valRow('EV/Sales', _evs !== null ? _evs.toFixed(2) + 'x' : 'N/A');
  html += valRow('PEG', _fn(rt.pegRatioTTM) !== null ? rt.pegRatioTTM.toFixed(2) + 'x' : 'N/A');
  html += valRow('FCF Yield', _fn(mt.freeCashFlowYieldTTM) !== null ? (mt.freeCashFlowYieldTTM * 100).toFixed(1) + '%' : (_fn(ma.freeCashFlowYield) !== null ? (ma.freeCashFlowYield * 100).toFixed(1) + '%' : 'N/A'));
  html += '</div>';

  // 우측: 수익성 지표 (TTM 우선)
  html += '<div>';
  html += '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">수익성 & 효율성' + (hasTTM ? ' <span style="color:#3ddba5;font-size:11px;">TTM</span>' : ' <span style="color:#f59e0b;font-size:11px;">Annual</span>') + '</div>';
  html += valRow('Gross Margin', (rt.grossProfitMarginTTM || ra.grossProfitMargin) ? ((rt.grossProfitMarginTTM || ra.grossProfitMargin) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('Operating Margin', (rt.operatingProfitMarginTTM || ra.operatingProfitMargin) ? ((rt.operatingProfitMarginTTM || ra.operatingProfitMargin) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('Net Margin', (rt.netProfitMarginTTM || ra.netProfitMargin) ? ((rt.netProfitMarginTTM || ra.netProfitMargin) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('ROE', (rt.returnOnEquityTTM || ra.returnOnEquity) ? ((rt.returnOnEquityTTM || ra.returnOnEquity) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('ROA', (rt.returnOnAssetsTTM || ra.returnOnAssets) ? ((rt.returnOnAssetsTTM || ra.returnOnAssets) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('ROIC', (mt.roicTTM || ma.roic) ? ((mt.roicTTM || ma.roic) * 100).toFixed(1) + '%' : 'N/A');
  html += valRow('유동비율', (rt.currentRatioTTM || ra.currentRatio) ? (rt.currentRatioTTM || ra.currentRatio).toFixed(2) + 'x' : 'N/A');
  html += valRow('부채비율 (D/E)', (rt.debtEquityRatioTTM || ra.debtEquityRatio) ? (rt.debtEquityRatioTTM || ra.debtEquityRatio).toFixed(2) + 'x' : 'N/A');
  html += '</div>';

  html += '</div>';
  body.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundPeers(d) {
  var el = document.getElementById('fund-rpt-peers');
  var body = document.getElementById('fund-rpt-peers-body');
  if (!el || !body || !d.peers || !d.peers.length) return;
  var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
  d.peers.slice(0, 12).forEach(function(p) {
    html += '<div style="padding:6px 12px;background:var(--surface-3);border:1px solid var(--border);border-radius:3px;font-size:11px;color:var(--text-primary);cursor:pointer;font-weight:600;" data-action="_aioFundSearchFill" data-arg="' + escHtml(p) + '">' + p + '</div>';
  });
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">클릭하면 해당 기업 분석으로 이동합니다</div>';
  body.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundEarnings(d) {
  var el = document.getElementById('fund-rpt-earnings');
  var body = document.getElementById('fund-rpt-earn-body');
  if (!el || !body) return;
  var hasSurprises = d.fmpSurprises && d.fmpSurprises.length > 0;
  var hasUpcoming = d.finnhubEarnings && d.finnhubEarnings.length > 0;
  if (!hasSurprises && !hasUpcoming) return;

  var html = '';

  // v48.10: 향후 어닝 일정 (Finnhub /calendar/earnings) — 수집만 하던 collected.finnhubEarnings UI 노출
  if (hasUpcoming) {
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">향후 어닝 일정 (Finnhub · v48.10)</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;">';
    d.finnhubEarnings.slice(0, 5).forEach(function(e) {
      var hourLabel = e.hour === 'bmo' ? '장전' : e.hour === 'amc' ? '장후' : e.hour === 'dmh' ? '장중' : '';
      var quarter = (e.year && e.quarter) ? (e.year + ' Q' + e.quarter) : '';
      html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:3px;padding:8px 10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;">';
      html += '<span style="font-size:12px;font-weight:700;color:var(--accent);font-family:var(--font-mono);">' + (e.date || '-') + '</span>';
      if (hourLabel) html += '<span style="font-size:11px;color:var(--text-muted);padding:2px 6px;background:var(--surface-3);border-radius:4px;">' + hourLabel + '</span>';
      html += '</div>';
      if (quarter) html += '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">' + quarter + '</div>';
      if (e.epsEstimate != null) html += '<div style="font-size:10px;color:var(--text-secondary);margin-top:3px;">예상 EPS $' + Number(e.epsEstimate).toFixed(2) + '</div>';
      if (e.revenueEstimate != null) html += '<div style="font-size:10px;color:var(--text-secondary);">예상 매출 $' + _fmtNum(e.revenueEstimate) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 기존 서프라이즈 테이블 (FMP)
  if (hasSurprises) {
    if (hasUpcoming) html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin:10px 0 6px;padding-top:8px;border-top:1px solid var(--border);">과거 서프라이즈 (FMP)</div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:6px;color:var(--text-muted);font-size:10px;">분기</th><th style="text-align:right;padding:6px;color:var(--text-muted);font-size:10px;">실제 EPS</th><th style="text-align:right;padding:6px;color:var(--text-muted);font-size:10px;">예상 EPS</th><th style="text-align:right;padding:6px;color:var(--text-muted);font-size:10px;">서프라이즈</th></tr>';
    d.fmpSurprises.forEach(function(s) {
      var diff = s.actualEarningResult - s.estimatedEarning;
      var pct = s.estimatedEarning ? (diff / Math.abs(s.estimatedEarning) * 100) : 0;
      var c = diff >= 0 ? '#00e5a0' : '#ff5b50';
      var label = diff >= 0 ? 'Beat' : 'Miss';
      html += '<tr style="border-bottom:1px solid var(--surface-2);">';
      html += '<td style="padding:6px;color:var(--text-secondary);">' + (s.date||'') + '</td>';
      html += '<td style="text-align:right;padding:6px;color:var(--text-primary);font-family:var(--font-mono);">$' + (s.actualEarningResult||0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;padding:6px;color:var(--text-muted);font-family:var(--font-mono);">$' + (s.estimatedEarning||0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;padding:6px;color:' + c + ';font-weight:700;">' + label + ' ' + _fmtPct(pct) + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  body.innerHTML = html;
  el.style.display = 'block';
}

// v48.13: 최근 기업 뉴스 렌더 (Finnhub /company-news 14일) — 기존 _renderFund* 패턴 100% 준수
function _renderFundNews(d) {
  var el = document.getElementById('fund-rpt-news');
  var body = document.getElementById('fund-rpt-news-body');
  if (!el || !body || !d.finnhubNews || !d.finnhubNews.length) return;
  var now = Date.now();
  var html = '';
  d.finnhubNews.slice(0, 10).forEach(function(n) {
    var ageHours = n.datetime ? Math.round((now - n.datetime * 1000) / 3600000) : 0;
    var ageLabel = ageHours < 24 ? ageHours + '시간 전' : Math.round(ageHours / 24) + '일 전';
    var headlineSafe = escHtml((n.headline || '').substring(0, 140));
    var summarySafe = n.summary ? escHtml(n.summary.substring(0, 180)) + (n.summary.length > 180 ? '…' : '') : '';
    var sourceSafe = escHtml(n.source || '');
    var urlSafe = n.url && /^https?:\/\//.test(n.url) ? n.url : '#';
    html += '<div style="padding:8px 0;border-bottom:1px solid var(--surface-3);">';
    html += '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">';
    html += '<a href="' + escHtml(urlSafe) + '" target="_blank" rel="noopener" style="flex:1;font-size:12px;font-weight:700;color:var(--text-primary);text-decoration:none;line-height:1.4;">' + headlineSafe + '</a>';
    html += '<span style="font-size:10px;color:var(--text-muted);white-space:nowrap;font-family:var(--font-mono);">' + ageLabel + '</span>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:4px;">';
    html += '<span style="font-size:10px;color:var(--text-secondary);line-height:1.5;flex:1;">' + summarySafe + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">' + sourceSafe + ' · ' + (n.date || '') + '</div>';
    html += '</div>';
  });
  if (d.finnhubNews.length > 10) {
    html += '<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:6px 0;">+ ' + (d.finnhubNews.length - 10) + '건 더 (최신 14일)</div>';
  }
  body.innerHTML = html;
  el.style.display = 'block';
}

function _renderFundSources(d) {
  var el = document.getElementById('fund-rpt-sources');
  var body = document.getElementById('fund-rpt-sources-body');
  if (!el || !body) return;
  var html = '';
  d.sources.forEach(function(s) { html += '• ' + s + '<br>'; });
  html += '• <b>AI 분석:</b> 위 수집 데이터를 Claude에 전달하여 17개 관점 종합 분석';
  body.innerHTML = html;
  el.style.display = 'block';
}

// ══════════════════════════════════════════════════════════════════════
// v48.89: 다기간 재무 비교표 (finance:financial-statements 방법론)
// Annual 최대 5년 · P/E · P/B · ROE · 매출 · 매출총이익률 · 영업이익 · 순이익 · EPS · 성장률
// 데이터 소스: FMP (fmpIncome/fmpRatios/fmpGrowth) → SEC EDGAR (secFin) 폴백
// ══════════════════════════════════════════════════════════════════════
function _renderFundMultiPeriod(d) {
  var el = document.getElementById('fund-rpt-multiperiod');
  var body = document.getElementById('fund-rpt-mp-body');
  if (!el || !body) return;

  // FMP Annual 데이터 우선, 없으면 SEC EDGAR 폴백
  var income = (d.fmpIncome && d.fmpIncome.length) ? d.fmpIncome.slice(0, 5) : [];
  var ratios  = (d.fmpRatios  && d.fmpRatios.length)  ? d.fmpRatios.slice(0, 5)  : [];
  var growth  = (d.fmpGrowth  && d.fmpGrowth.length)  ? d.fmpGrowth.slice(0, 5)  : [];

  // 데이터가 전혀 없으면 패널 표시하지 않음
  if (!income.length && !(d.secFin && d.secFin.revenue && d.secFin.revenue.length)) return;

  // 연도 컬럼 목록 (income 기준, 없으면 ratios 기준)
  var years = income.length
    ? income.map(function(r) { return (r.date || '').slice(0, 4); })
    : ratios.map(function(r) { return (r.date || '').slice(0, 4); });
  if (!years.length && d.secFin && d.secFin.revenue) {
    years = d.secFin.revenue.slice(0, 5).map(function(r) { return String(r.year || ''); });
  }
  if (!years.length) return;

  // 헬퍼
  function fv(obj, key) { // obj에서 key 값 추출 (null/undefined → null)
    if (!obj) return null;
    var v = obj[key];
    return (v !== undefined && v !== null && !isNaN(Number(v))) ? Number(v) : null;
  }
  function fmtB(v) { // 매출/이익 → B/M/K
    if (v === null) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(0) + 'M';
    return (v / 1e3).toFixed(0) + 'K';
  }
  function fmtP(v) { // 퍼센트 (소수 → %)
    if (v === null) return '—';
    return (v * 100).toFixed(1) + '%';
  }
  function growthColor(v) {
    if (v === null) return 'var(--text-muted)';
    return v >= 0 ? 'var(--data-green)' : 'var(--data-red)';
  }

  // 행 데이터 정의
  var rows = [
    {
      label: '매출', sub: 'Revenue',
      vals: income.map(function(r) { return fv(r, 'revenue'); }),
      fmt: fmtB, colorFn: null
    },
    {
      label: '매출총이익률', sub: 'Gross Margin',
      vals: income.map(function(r) {
        var rev = fv(r, 'revenue'), gp = fv(r, 'grossProfit');
        return (rev && rev > 0 && gp !== null) ? gp / rev : null;
      }),
      fmt: fmtP, colorFn: null
    },
    {
      label: '영업이익', sub: 'Operating Income',
      vals: income.map(function(r) { return fv(r, 'operatingIncome'); }),
      fmt: fmtB, colorFn: null
    },
    {
      label: '순이익', sub: 'Net Income',
      vals: income.map(function(r) { return fv(r, 'netIncome'); }),
      fmt: fmtB, colorFn: function(v) { return v !== null ? (v >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)'; }
    },
    {
      label: '희석 EPS', sub: 'EPS (Diluted)',
      vals: income.map(function(r) { return fv(r, 'epsDiluted') !== null ? fv(r, 'epsDiluted') : fv(r, 'eps'); }),
      fmt: function(v) { return v === null ? '—' : '$' + v.toFixed(2); },
      colorFn: function(v) { return v !== null ? (v >= 0 ? 'var(--text-primary)' : 'var(--data-red)') : 'var(--text-muted)'; }
    },
    {
      label: '매출 성장률', sub: 'Revenue Growth YoY',
      vals: growth.map(function(r) { return fv(r, 'revenueGrowth'); }),
      fmt: function(v) { return v === null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'; },
      colorFn: growthColor
    },
    {
      label: 'P/E', sub: 'Price/Earnings',
      vals: ratios.map(function(r) { return fv(r, 'priceEarningsRatio'); }),
      fmt: function(v) { return v === null ? '—' : v.toFixed(1) + 'x'; }, colorFn: null
    },
    {
      label: 'P/B', sub: 'Price/Book',
      vals: ratios.map(function(r) { return fv(r, 'priceToBookRatio'); }),
      fmt: function(v) { return v === null ? '—' : v.toFixed(1) + 'x'; }, colorFn: null
    },
    {
      label: 'ROE', sub: 'Return on Equity',
      vals: ratios.map(function(r) { return fv(r, 'returnOnEquity'); }),
      fmt: function(v) { return v === null ? '—' : (v * 100).toFixed(1) + '%'; },
      colorFn: function(v) { return v !== null ? (v >= 0.15 ? 'var(--data-green)' : v >= 0 ? 'var(--text-secondary)' : 'var(--data-red)') : 'var(--text-muted)'; }
    },
    {
      label: '영업이익률', sub: 'Operating Margin',
      vals: ratios.map(function(r) { return fv(r, 'operatingProfitMargin'); }),
      fmt: fmtP, colorFn: null
    }
  ];

  // 모든 값이 null인 행 제외
  rows = rows.filter(function(row) {
    return row.vals.some(function(v) { return v !== null; });
  });

  if (!rows.length) return;

  // 테이블 렌더링
  var html = '<div style="overflow-x:auto;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';

  // 헤더 (연도)
  html += '<thead><tr style="border-bottom:2px solid var(--border);">';
  html += '<th style="text-align:left;padding:7px 10px;color:var(--text-muted);font-size:10px;font-weight:700;min-width:110px;">지표</th>';
  years.forEach(function(y) {
    html += '<th style="text-align:right;padding:7px 8px;color:var(--text-secondary);font-size:10px;font-weight:700;white-space:nowrap;">' + y + '</th>';
  });
  html += '</tr></thead><tbody>';

  // 행 렌더링
  rows.forEach(function(row, ri) {
    var bg = (ri % 2 === 0) ? 'var(--surface-1)' : 'transparent';
    html += '<tr style="background:' + bg + ';border-bottom:1px solid var(--surface-2);">';
    html += '<td style="padding:6px 10px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);">' + row.label + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);">' + row.sub + '</div>' +
      '</td>';
    // 최대 years.length 열
    for (var ci = 0; ci < years.length; ci++) {
      var val = (ci < row.vals.length) ? row.vals[ci] : null;
      var formatted = row.fmt(val);
      var color = row.colorFn ? row.colorFn(val) : 'var(--text-primary)';
      html += '<td style="text-align:right;padding:6px 8px;font-family:var(--font-mono);font-size:11px;font-weight:600;color:' + color + ';white-space:nowrap;">' + formatted + '</td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // 데이터 소스 표시
  var srcLabel = income.length ? 'FMP (Annual 손익계산서·재무비율·성장률)' : 'SEC EDGAR XBRL (폴백)';
  html += '<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">소스: ' + srcLabel + ' · 최신 기준 좌측 정렬 · FMP API 미설정 시 일부 항목 N/A</div>';

  body.innerHTML = html;
  el.style.display = 'block';
}

// ══════════════════════════════════════════════════════════════════════
// v48.90: 실적 분산 분석 (finance:variance-analysis 방법론)
// EPS Beat 요약 · 분기 흐름 테이블 · Chart.js EPS 차트 · YoY 재무 분해
// 데이터: fmpSurprises (분기 EPS) + fmpIncome (연간 손익계산서)
// ══════════════════════════════════════════════════════════════════════
function _renderFundVariance(d) {
  var el = document.getElementById('fund-rpt-variance');
  var body = document.getElementById('fund-rpt-var-body');
  var canvas = document.getElementById('fund-var-chart');
  if (!el || !body) return;

  var surprises = (d.fmpSurprises && d.fmpSurprises.length >= 2) ? d.fmpSurprises : [];
  var income = (d.fmpIncome && d.fmpIncome.length >= 2) ? d.fmpIncome : [];

  if (!surprises.length && !income.length) return;

  var html = '';

  // ── 1. Beat/Miss 요약 (서프라이즈 통계) ──
  if (surprises.length >= 2) {
    var beats = surprises.filter(function(s) { return s.actualEarningResult >= s.estimatedEarning; }).length;
    var beatRate = (beats / surprises.length * 100).toFixed(0);
    var validForAvg = surprises.filter(function(s) { return s.estimatedEarning && s.estimatedEarning !== 0; });
    var avgSurprise = validForAvg.length > 0
      ? validForAvg.reduce(function(sum, s) { return sum + (s.actualEarningResult - s.estimatedEarning) / Math.abs(s.estimatedEarning) * 100; }, 0) / validForAvg.length
      : 0;
    var beatRatio = beats / surprises.length;
    var beatColor = beatRatio >= 0.7 ? 'var(--data-green)' : beatRatio >= 0.5 ? 'var(--data-amber)' : 'var(--data-red)';
    var last = surprises[0];
    var lastDiff = last.actualEarningResult - last.estimatedEarning;
    var lastPct = last.estimatedEarning ? (lastDiff / Math.abs(last.estimatedEarning) * 100) : 0;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:12px;">';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:8px 10px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:3px;">EPS Beat율</div>' +
      '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + beatColor + ';">' + beatRate + '%</div>' +
      '<div style="font-size:10px;color:var(--text-muted);">최근 ' + surprises.length + '분기</div></div>';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:8px 10px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:3px;">평균 서프라이즈</div>' +
      '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + (avgSurprise >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' +
      (avgSurprise >= 0 ? '+' : '') + avgSurprise.toFixed(1) + '%</div>' +
      '<div style="font-size:10px;color:var(--text-muted);">EPS 컨센서스 대비</div></div>';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:8px 10px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:3px;">최근 서프라이즈</div>' +
      '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + (lastDiff >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' +
      (lastDiff >= 0 ? 'Beat' : 'Miss') + ' ' + (lastDiff >= 0 ? '+' : '') + lastPct.toFixed(1) + '%</div>' +
      '<div style="font-size:10px;color:var(--text-muted);">' + (last.date || '').slice(0, 7) + '</div></div>';
    html += '</div>';

    // ── 2. EPS 분기 흐름 테이블 ──
    var sorted = surprises.slice().reverse(); // 오름차순
    html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">EPS 분기별 흐름</div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">';
    html += '<tr style="border-bottom:1px solid var(--border);">' +
      '<th style="text-align:left;padding:5px 8px;color:var(--text-muted);font-size:10px;">분기</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">예상 EPS</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">실제 EPS</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">QoQ 변화</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">서프라이즈</th></tr>';
    sorted.forEach(function(s, idx) {
      var prev = idx > 0 ? sorted[idx - 1].actualEarningResult : null;
      var qoq = (prev !== null) ? s.actualEarningResult - prev : null;
      var diff = s.actualEarningResult - s.estimatedEarning;
      var diffPct = s.estimatedEarning ? (diff / Math.abs(s.estimatedEarning) * 100) : 0;
      var beatC = diff >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      var qoqC = qoq === null ? 'var(--text-muted)' : qoq >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      html += '<tr style="border-bottom:1px solid var(--surface-2);">';
      html += '<td style="padding:5px 8px;color:var(--text-secondary);">' + (s.date || '').slice(0, 7) + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);">$' + (s.estimatedEarning || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);font-weight:700;">$' + (s.actualEarningResult || 0).toFixed(2) + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);color:' + qoqC + ';">' +
        (qoq === null ? '—' : (qoq >= 0 ? '+' : '') + '$' + qoq.toFixed(2)) + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-weight:700;color:' + beatC + ';">' +
        (diff >= 0 ? 'Beat +' : 'Miss ') + diffPct.toFixed(1) + '%</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  // ── 3. YoY 재무 분해 테이블 ──
  if (income.length >= 2) {
    var cur = income[0], prev_yr = income[1];
    function diff_pct(a, b) { return (a != null && b != null && b !== 0) ? ((a - b) / Math.abs(b) * 100) : null; }
    function fmtChg(a, b) {
      var p = diff_pct(a, b);
      if (p === null) return '—';
      return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
    }
    function chgColor(a, b) {
      var p = diff_pct(a, b);
      if (p === null) return 'var(--text-muted)';
      return p >= 0 ? 'var(--data-green)' : 'var(--data-red)';
    }
    var curGM  = (cur.revenue && cur.grossProfit)     ? cur.grossProfit     / cur.revenue : null;
    var prevGM = (prev_yr.revenue && prev_yr.grossProfit)  ? prev_yr.grossProfit  / prev_yr.revenue : null;
    var curOM  = (cur.revenue && cur.operatingIncome)  ? cur.operatingIncome  / cur.revenue : null;
    var prevOM = (prev_yr.revenue && prev_yr.operatingIncome) ? prev_yr.operatingIncome / prev_yr.revenue : null;
    var curNM  = (cur.revenue && cur.netIncome)        ? cur.netIncome        / cur.revenue : null;
    var prevNM = (prev_yr.revenue && prev_yr.netIncome)    ? prev_yr.netIncome    / prev_yr.revenue : null;
    var curY  = (cur.date || cur.calendarYear || '').slice(0, 4);
    var prevY = (prev_yr.date || prev_yr.calendarYear || '').slice(0, 4);

    html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin:10px 0 6px;padding-top:10px;border-top:1px solid var(--border);">YoY 재무 분해 (' + prevY + ' → ' + curY + ')</div>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:5px 8px;color:var(--text-muted);font-size:10px;">항목</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">' + prevY + '</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">' + curY + '</th>' +
      '<th style="text-align:right;padding:5px 6px;color:var(--text-muted);font-size:10px;">YoY</th></tr>';
    var yoyRows = [
      { label: '매출', a: cur.revenue, b: prev_yr.revenue, isVal: true },
      { label: '매출총이익률', a: curGM, b: prevGM, isMargin: true },
      { label: '영업이익', a: cur.operatingIncome, b: prev_yr.operatingIncome, isVal: true },
      { label: '영업이익률', a: curOM, b: prevOM, isMargin: true },
      { label: '순이익', a: cur.netIncome, b: prev_yr.netIncome, isVal: true },
      { label: '순이익률', a: curNM, b: prevNM, isMargin: true },
      { label: '희석 EPS', a: cur.epsDiluted || cur.eps, b: prev_yr.epsDiluted || prev_yr.eps, isEps: true }
    ];
    yoyRows.forEach(function(row, ri) {
      var bg = (ri % 2 === 0) ? 'var(--surface-1)' : 'transparent';
      var aFmt, bFmt, chgStr, chgC;
      if (row.isMargin) {
        aFmt = row.a != null ? (row.a * 100).toFixed(1) + '%' : '—';
        bFmt = row.b != null ? (row.b * 100).toFixed(1) + '%' : '—';
        var bps = (row.a != null && row.b != null) ? (row.a - row.b) * 10000 : null;
        chgStr = bps !== null ? (bps >= 0 ? '+' : '') + bps.toFixed(0) + 'bps' : '—';
        chgC = bps !== null ? (bps >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
      } else if (row.isEps) {
        aFmt = row.a != null ? '$' + Number(row.a).toFixed(2) : '—';
        bFmt = row.b != null ? '$' + Number(row.b).toFixed(2) : '—';
        chgStr = fmtChg(row.a, row.b); chgC = chgColor(row.a, row.b);
      } else {
        aFmt = row.a ? '$' + _fmtNum(row.a) : '—';
        bFmt = row.b ? '$' + _fmtNum(row.b) : '—';
        chgStr = fmtChg(row.a, row.b); chgC = chgColor(row.a, row.b);
      }
      html += '<tr style="background:' + bg + ';border-bottom:1px solid var(--surface-2);">';
      html += '<td style="padding:5px 8px;font-size:11px;font-weight:700;color:var(--text-secondary);">' + row.label + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);color:var(--text-muted);">' + bFmt + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);font-weight:600;">' + aFmt + '</td>';
      html += '<td style="text-align:right;padding:5px 6px;font-family:var(--font-mono);font-weight:700;color:' + chgC + ';">' + chgStr + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
    html += '<div style="font-size:10px;color:var(--text-muted);margin-top:5px;">마진 변화: bps(1%=100bps) · 소스: FMP Annual 손익계산서</div>';
  }

  body.innerHTML = html;
  el.style.display = 'block';

  // ── 4. Chart.js EPS 차트 (예상 vs 실제) ──
  if (surprises.length >= 2 && canvas && typeof Chart !== 'undefined') {
    try {
      // v48.96 P1-5: _aioChartRegistry를 통한 destroy 보장 (메모리 누수 방지)
      if (window._aioChartRegistry) {
        window._aioChartRegistry.destroyIfExists('fund-variance');
      } else if (canvas._chartInstance) {
        canvas._chartInstance.destroy(); canvas._chartInstance = null;
      }
      canvas.style.display = 'block';
      var sorted2 = surprises.slice().reverse();
      var labels = sorted2.map(function(s) { return (s.date || '').slice(0, 7); });
      var actuals = sorted2.map(function(s) { return s.actualEarningResult || 0; });
      var estimates = sorted2.map(function(s) { return s.estimatedEarning || 0; });
      var diffs2 = sorted2.map(function(s) { return s.actualEarningResult - s.estimatedEarning; });
      var barColors = diffs2.map(function(dv) { return dv >= 0 ? 'rgba(0,229,160,0.75)' : 'rgba(255,91,80,0.75)'; });
      var ctx2 = (window._aioSetupCanvas) ? window._aioSetupCanvas(canvas, canvas.offsetWidth || 400, canvas.offsetHeight || 220) : canvas.getContext('2d');  // v48.96 P2-3: DPR
      var _newChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: '예상 EPS', data: estimates, type: 'line', borderColor: 'rgba(100,160,255,0.7)',
              backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3],
              pointRadius: 3, pointBackgroundColor: 'rgba(100,160,255,0.9)', tension: 0.3, order: 1 },
            { label: '실제 EPS', data: actuals, backgroundColor: barColors,
              borderColor: barColors.map(function(c) { return c.replace('0.75', '1'); }),
              borderWidth: 1, borderRadius: 3, order: 2 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } },
            tooltip: { callbacks: { label: function(ctx3) {
              var idx = ctx3.dataIndex;
              if (ctx3.datasetIndex === 1) {
                var dv = diffs2[idx];
                return ['실제 EPS: $' + actuals[idx].toFixed(2),
                        '서프라이즈: ' + (dv >= 0 ? '+' : '') + '$' + dv.toFixed(2) + ' (' + (dv >= 0 ? 'Beat' : 'Miss') + ')'];
              }
              return '예상 EPS: $' + estimates[idx].toFixed(2);
            }}}
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#94a3b8', font: { size: 9 },
                   callback: function(v) { return '$' + v.toFixed(2); } },
                 grid: { color: 'rgba(255,255,255,0.06)' } }
          }
        }
      });
      // v48.96 P1-5: 레지스트리에 등록 (재렌더 시 destroy 가능)
      if (window._aioChartRegistry) window._aioChartRegistry.register('fund-variance', _newChart);
      else canvas._chartInstance = _newChart;
    } catch(e) { if (canvas) canvas.style.display = 'none'; }
  }
}

// 기업분석 렌더러 개별 window 접근자 — v51.17: _fmtNum/_fmtPct aio-core.js 이동 완료, 물리 이동 전제 조건 충족
window._renderFundHeader = _renderFundHeader;
window._renderFundSEC = _renderFundSEC;
window._renderFundFinancials = _renderFundFinancials;
window._renderFundamentalFinancialsCharts = _renderFundamentalFinancialsCharts;
window._renderFundStatements = _renderFundStatements;
window._renderFundValuation = _renderFundValuation;
window._renderFundPeers = _renderFundPeers;
window._renderFundEarnings = _renderFundEarnings;
window._renderFundNews = _renderFundNews;
window._renderFundSources = _renderFundSources;
window._renderFundMultiPeriod = _renderFundMultiPeriod;
window._renderFundVariance = _renderFundVariance;
// AIO.FundPage: 기업분석 렌더링 함수 공개 API (aio-chat.js → aio-ui.js 물리 이동 대상)
window.AIO = window.AIO || {};
window.AIO.FundPage = {
  renderHeader:     _renderFundHeader,
  renderSEC:        _renderFundSEC,
  renderFinancials: _renderFundFinancials,
  renderCharts:     _renderFundamentalFinancialsCharts,
  renderStatements: _renderFundStatements,
  renderValuation:  _renderFundValuation,
  renderPeers:      _renderFundPeers,
  renderEarnings:   _renderFundEarnings,
  renderNews:       _renderFundNews,
  renderSources:    _renderFundSources,
  renderMultiPeriod: _renderFundMultiPeriod,
  renderVariance:   _renderFundVariance,
};

// ═══ v52.39 P654/R291: 페이지별 기초 교육 레이어 ════════════════════════════
// 콘텐츠 규칙: 불변 메커니즘·관계식만, 현재 레벨/날짜/방향 판정 금지(R291).
// 현재 시장 상황은 각 페이지의 라이브 카드가 담당 — 이 레지스트리는 정적 원리 설명 전용.
var AIO_PAGE_FUNDAMENTALS = {
  'home': {
    title: `대시보드 읽는 순서`,
    concept: [
      `홈은 '지금 위험을 얼마나 져도 되는가'를 30초 안에 판단하기 위한 조립 화면입니다 — 종목 선택 화면이 아닙니다.`,
      `상단 신호등/점수는 추세·시장폭·심리·매크로를 합성한 시장 전체의 건강 상태입니다.`
    ],
    why: [
      `개별 종목 수익의 상당 부분은 시장 전체 방향이 결정합니다 — 시장이 나쁠 때는 좋은 종목도 같이 빠집니다. 그래서 '시장 → 섹터 → 종목' 순서가 기본기입니다.`
    ],
    how: [
      `위에서 아래로: ① 결론 바와 '매매 점수 분해'·'시장 국면' 카드(오늘의 공격성) ② 액션 카드의 포지션·심리·폭(점수의 근거) ③ '글로벌 마켓' 표와 뉴스 하이라이트(무엇이 움직였나) 순서로 읽으세요.`
    ],
    action: [
      `아침 루틴 3분: 신호등 → 어제와 달라진 카드 → 뉴스 헤드라인. 달라진 게 없으면 포지션도 바꾸지 않는 것이 기본값입니다.`
    ],
    terms: `BUY/SELL/HOLD 시그널`
  },
  'signal': {
    title: `매매 점수의 구조`,
    concept: [
      `매매 점수는 변동성(VIX)·모멘텀(F&G·추세추종)·추세(MA)·시장폭(20일선)·거시 5개 축을 가중 합성한 '시장 타이밍 필터'입니다(가중치는 페이지 상단 부제에 명시). 단일 지표의 단독 판단을 피하기 위한 장치입니다.`,
      `점수의 각 서브스코어는 서로 다른 데이터 축에서 옵니다 — 축들이 합의할 때 신뢰도가 올라갑니다.`
    ],
    why: [
      `어떤 단일 지표도 모든 국면에서 맞지 않습니다. 독립된 축의 합의(confluence)가 오류를 상쇄한다는 것이 합성 점수의 원리입니다.`,
      `점수는 '무엇을 살까'가 아니라 '지금 얼마나 공격적이어도 되나'에 대한 답입니다 — 종목 선택은 스크리너/테마의 몫.`
    ],
    how: [
      `'② 팩터별 기여도' 섹션에서 어느 축이 점수를 깎는지 확인하세요 — 같은 60점이라도 '심리 과열형'과 '추세 훼손형'은 대응이 다릅니다.`,
      `'스윙 진입 체크리스트'는 점수를 행동으로 바꾸는 관문이고, 'Exit Triggers'는 반대 방향(청산·헷지)의 기계적 기준입니다 — 진입보다 먼저 읽어 두세요.`,
      `'바닥 프로세스 4단계'는 급락 후 저점이 만들어지는 순서(셀링 클라이맥스→자동 반등→2차 테스트→돌파)를 설명합니다 — 급락장에서 성급한 진입을 막는 지도입니다.`,
      `상단 종합 '시그널'과 티커 페이지의 '시장 건강도'는 다른 지표입니다(라벨 참조).`
    ],
    action: [
      `점수가 낮아지는 구간에서는 신규 진입 축소·현금 비중 확대가 우선이고, 보유 종목 손절 기준을 좁힙니다.`,
      `점수 급등 첫날 추격하기보다 점수가 2~3일 유지되는지 확인하는 관찰 절차를 둘 수 있습니다. 다만 이 절차가 승률을 높인다는 근거는 검증되지 않았으므로 성과 보장이나 매매 승인으로 해석하지 마세요.`
    ],
    terms: `ZBT (브레드쓰 스러스트)`
  },
  'breadth': {
    title: `시장 폭의 원리`,
    concept: [
      `시장 폭(breadth)은 '얼마나 많은 종목이 상승에 참여하는가'입니다. 대표 지표: 이동평균선 위 종목 비율, 상승/하락 종목 수, 신고가/신저가 수.`,
      `지수는 시가총액 가중이라 소수 대형주만 올라도 신고가를 만들 수 있습니다 — 폭은 그 착시를 벗겨냅니다.`
    ],
    why: [
      `지수 신고가 + 폭 축소(참여 종목 감소)는 상승의 기반이 좁아진다는 경고입니다 — 역사적으로 고점 부근에서 반복된 다이버전스 패턴.`,
      `반대로 폭의 급팽창(짧은 기간에 상승 종목 비율 급증)은 새 상승 사이클의 개시 신호로 신뢰도가 높습니다.`
    ],
    how: [
      `'SMA 비율 현황'의 5SMA(초단기 과열/침체)·20SMA(스윙 추세)·50SMA(중기 체력) 게이지 3종을 함께 보세요 — 5SMA만 꺾이면 눌림, 50SMA까지 꺾이면 중기 구조 훼손입니다.`,
      `'가격·폭 차트'에서 지수와 폭 지표의 방향이 갈리는지(다이버전스)가 이 페이지의 핵심 체크포인트입니다.`,
      `'상승/하락 비율 추이(A-D Ratio)'와 '52주 신고가/신저가 비율'은 같은 질문(참여의 폭)을 다른 데이터로 교차 검증하는 카드입니다.`
    ],
    action: [
      `지수만 보고 '시장이 좋다'고 판단하지 않기 — 폭이 따라오지 않는 랠리에서는 신규 매수 종목 수를 줄입니다.`,
      `폭 극단 침체(대부분 종목이 50SMA 아래) 후 첫 폭 급팽창은 놓치기 아까운 구간 — 분할 진입을 시작하는 트리거로 씁니다.`
    ],
    terms: `ZBT (브레드쓰 스러스트) · 52주 신고가/신저가`
  },
  'sentiment': {
    title: `심리 지표의 역발상 원리`,
    concept: [
      `심리 지표(Fear & Greed, VIX, 설문조사)는 시장 참여자들이 얼마나 쏠려 있는지를 잽니다.`,
      `VIX는 옵션 가격에 내재된 향후 30일 기대 변동성 — '공포를 사고파는 가격'입니다.`
    ],
    why: [
      `극단적 공포는 '팔 사람은 이미 판' 상태, 극단적 탐욕은 '살 사람은 이미 산' 상태를 뜻합니다 — 심리 지표가 역발상 지표로 쓰이는 이유입니다.`,
      `단, 역발상은 극단에서만 유효합니다. 중간값의 심리 지표는 추세 지속을 방해하지 않습니다 — '탐욕이니 곧 떨어진다'는 중간 구간 판단이 흔한 오용입니다.`
    ],
    how: [
      `F&G 게이지는 레벨보다 '극단 도달 후 방향 전환'을 보세요.`,
      `VIX 카드는 절대값과 함께 기간구조 카드를 같이 — 단기가 장기보다 비싸지는 역전은 당장의 패닉을 뜻합니다.`,
      `설문(AAII·II·NAAIM)은 '말하는 심리', HY 스프레드·풋콜비율은 '돈으로 표현된 심리'입니다 — 둘이 갈릴 때는 돈 쪽을 더 무겁게 보세요.`,
      `'뉴스 감성 추이'는 헤드라인 톤의 흐름입니다 — 가격과 반대로 움직이는 구간(악재 속 상승)이 오히려 강세 신호일 수 있습니다.`
    ],
    action: [
      `극단 공포 구간은 역발상 프레임워크에서 일괄 진입이 아닌 분할 접근의 논의 지점으로 서술됩니다 — 공포는 더 깊어질 수 있습니다.`,
      `극단 탐욕에서 숏이 아니라 이익 실현·신규 진입 절제로 대응 — 과열은 생각보다 오래갑니다.`
    ],
    terms: `VIX · Fear & Greed`
  },
  'briefing': {
    title: `브리핑 읽는 법`,
    concept: [
      `브리핑은 시그널·폭·심리·매크로·뉴스의 오늘자 상태를 한 페이지로 합친 요약입니다 — 각 상세 페이지의 목차 역할.`
    ],
    why: [
      `같은 데이터라도 매일 같은 틀로 보면 '어제와 달라진 것'이 도드라집니다 — 브리핑의 가치는 절대값이 아니라 변화 감지입니다.`
    ],
    how: [
      `6축 요약에서 어제와 달라진 축만 상세 페이지로 내려가 확인하는 것이 효율적인 사용법입니다.`
    ],
    action: [
      `브리핑에서 2개 축 이상이 동시에 나빠졌으면 그날은 신규 진입을 쉬는 것을 기본값으로.`
    ],
    terms: `Fear & Greed`
  },
  'technical': {
    title: `차트를 읽는 원리`,
    concept: [
      `이동평균선(MA)은 일정 기간 종가의 평균을 이은 선 — 그 기간에 산 사람들의 평균 단가 근사치입니다. 20일선=단기 수급, 50일선=중기 추세, 200일선=장기 체력.`,
      `캔들 1개는 시가·고가·저가·종가 4개 정보입니다. 몸통=시가↔종가(세력 균형의 결과), 꼬리=장중 시도했다가 밀린 흔적. 긴 아래꼬리=매수 방어, 긴 위꼬리=매도 압력.`,
      `거래량은 그 가격에 동의한 돈의 양입니다. 가격은 속일 수 있어도 거래량은 속이기 어렵습니다.`,
      `매물대(볼륨 프로파일)는 과거에 거래가 집중된 가격대 — 본전 심리가 몰려 있어 지지/저항으로 작동합니다.`
    ],
    why: [
      `주가가 MA 위에 있다는 건 평균 매수자가 이익 중이라는 뜻 — 조정 시 "본전 매도" 압력이 약해 지지가 됩니다. 아래면 반대로 반등마다 매물이 나옵니다. 골든/데드크로스가 의미 있는 이유입니다.`,
      `거래량 없는 상승은 매수세 유입이 아니라 매도세 부재(또는 숏커버)일 수 있습니다 — 추세의 지속성은 거래량이 확증합니다.`,
      `RSI 과열/과매도는 "가격이 평소 속도보다 빠르게 움직였다"는 뜻일 뿐 반전 보장이 아닙니다 — 다이버전스(가격 신고가+RSI 고점 하락)가 붙을 때 신뢰도가 올라갑니다.`
    ],
    how: [
      `상단 'SPY 가격 포지션 · 지지/저항' 카드에서 현재가가 어느 매물대/지지선 사이에 있는지부터 확인하세요.`,
      `'시장 건강도 종합 점수'와 Market Indicators 스트립(Pressure·Buy Risk·Trend)으로 지금이 돌파 추종 구간인지, 눌림 대기 구간인지 큰 판을 먼저 정하세요.`,
      `'S&P 500 실시간 기술 지표'의 RSI·MACD·스토캐스틱·ADX는 각 지표 단독이 아니라 서로 같은 방향을 가리키는지(합의) 보는 것이 핵심입니다.`,
      `'지지·저항 & Weinstein 4단계'로 추세의 국면(1단계 바닥~4단계 하락)을 먼저 정하고, '12가지 매매 셋업 패턴'에서 그 국면에 맞는 셋업만 고르세요 — 국면과 셋업의 불일치가 흔한 실패 원인입니다.`
    ],
    action: [
      `거래량 없는 돌파는 추격하지 않습니다 — 평균 거래량 대비 1.5~2배 이상이 붙은 돌파만 신뢰.`,
      `지지선 매수는 '지지 확인 후'(반등 캔들 마감)가 원칙 — 떨어지는 칼날에 지정가를 깔지 않습니다.`,
      `손절은 진입 근거가 무너지는 지점(직전 지지선 아래)에, 진입 전에 정합니다.`
    ],
    terms: `RSI · MACD · 이동평균선 · 볼린저밴드 · 골든크로스`
  },
  'macro': {
    title: `유가·금리·연준을 읽는 원리`,
    concept: [
      `매크로의 최상위 변수는 금리이고, 금리를 움직이는 건 인플레이션과 고용입니다(연준의 이중책무).`,
      `유가는 인플레이션의 가장 빠른 공급측 경로입니다 — 운송·제조·전기료를 타고 몇 달 시차로 물가에 스며듭니다.`,
      `CPI(소비자물가)·PCE(연준 선호 물가)·고용보고서(NFP)가 '연준의 다음 행동'을 결정하는 3대 지표입니다.`
    ],
    why: [
      `금리는 자산가격의 중력입니다 — 할인율이 오르면 같은 이익도 현재가치가 작아져 밸류에이션 전체가 눌립니다.`,
      `유가 급등은 '인플레 재점화 → 금리 인하 지연/인상 위험 → 밸류에이션 압박'의 연쇄를 만듭니다. 유가를 보는 건 유가 자체가 아니라 금리의 선행 신호를 보는 것입니다.`,
      `시장은 지표의 절대값이 아니라 '기대 대비 서프라이즈'에 반응합니다 — 좋은 수치도 기대보다 나쁘면 악재가 됩니다.`,
      `같은 뉴스도 국면에 따라 해석이 뒤집힙니다: 침체 공포 국면에선 나쁜 고용=금리 인하 기대=호재(bad news is good news), 인플레 공포 국면에선 그 반대.`
    ],
    how: [
      `'경제 지표 캘린더'와 다음 발표 표시를 먼저 확인 — 발표 전후는 이벤트 리스크 구간입니다.`,
      `'라이브 매크로 지표'의 WTI·10Y·DXY 카드를 세트로: 유가↑+금리↑+달러↑ 조합이 위험자산에 가장 부담스러운 조합입니다.`,
      `'인터커넥션 맵'이 이 페이지의 원리(유가→물가→금리→밸류에이션 인과)를 그림으로 보여줍니다 — 개별 카드가 헷갈리면 여기로 돌아오세요.`,
      `'수익률 곡선 분석기'와 '글로벌 경기 체온계'로 채권시장의 경기 판단을, '시나리오 트리'로 지금 갈림길이 무엇인지 확인하세요.`,
      `물가 지표는 '전월 대비 방향'과 '컨센서스 대비'를 함께 — 절대 레벨 단독으론 판단하지 않습니다.`
    ],
    action: [
      `CPI·FOMC·고용보고서 발표일엔 신규 포지션 진입을 발표 이후로 미루는 것이 기본기입니다.`,
      `유가가 급등 추세로 전환되면 '금리 인하 기대'에 기대는 포지션(고PER 성장주 등)의 근거를 재점검하세요.`,
      `매크로 해석이 헷갈리면 시장의 반응(금리·달러·지수)을 정답지로 삼으세요 — 내 해석보다 가격이 먼저 맞습니다.`
    ],
    terms: `CPI · PCE · FOMC · NFP(고용보고서)`
  },
  'fxbond': {
    title: `달러·엔·금리를 읽는 원리`,
    concept: [
      `달러는 세계 무역·부채의 결제 통화라서 '글로벌 유동성의 수도꼭지'입니다. 달러인덱스(DXY)는 주요 6개 통화 대비 달러의 상대 가격.`,
      `원/달러 환율은 원화의 가격이 아니라 '한국 자산에 대한 외국인의 수요' 온도계에 가깝습니다.`,
      `국채 금리는 '무위험 수익률' — 모든 자산의 할인율이자 기회비용의 기준입니다. 10년물은 성장+인플레 기대, 2년물은 통화정책 기대를 주로 반영합니다.`,
      `하이일드 스프레드(HY OAS)는 부실 기업이 국채 대비 얹어 줘야 하는 이자 — 신용시장의 공포 게이지입니다.`
    ],
    why: [
      `달러 강세는 신흥국(한국 포함)에서 자금을 빨아들입니다 — DXY와 원/달러가 동반 급등하면 외국인의 한국 주식 순매도가 따라오는 경향이 있습니다.`,
      `<strong>엔화가 요즘 특히 중요한 이유</strong>: 일본의 초저금리가 수십 년간 '엔을 빌려 해외 고수익 자산을 사는' 엔캐리 트레이드를 키웠습니다. 일본 금리가 오르거나 엔이 급등하면 이 포지션이 강제 청산되며 전세계 위험자산이 동시에 팔립니다 — 엔 급등은 그 자체로 글로벌 리스크오프 신호입니다.`,
      `금리가 오르면 미래 이익의 현재가치가 줄어듭니다 — 이익이 먼 미래에 몰린 성장주일수록 금리에 민감한 이유. 장단기 금리 역전(10Y&lt;2Y)은 '긴축이 성장을 꺾을 것'이라는 채권시장의 경고로 읽혀 왔습니다.`,
      `크레딧 스프레드가 확대되면 기업의 자금조달 비용이 올라 CAPEX(AI 투자 포함)의 지속 가능성이 흔들립니다 — 주식보다 채권이 먼저 냄새를 맡는 경우가 많습니다.`
    ],
    how: [
      `'Cross-Asset 신호 매트릭스'에서 DXY·10Y·수익률스프레드·HYG 네 축의 신호가 같은 방향인지부터 확인하세요 — 합의될 때만 강한 신호입니다.`,
      `'외환시장' 섹션의 원/달러·엔/달러와 DXY는 같은 시점의 방향을 비교하는 관찰값입니다. 단일 조합만으로 리스크온·오프나 포지션 청산을 판정하지 않습니다.`,
      `<strong>'엔캐리 관측 프록시'</strong>는 엔·금리차·VIX·HYG의 단순 규칙값입니다. 실제 캐리 포지션·청산 확률은 옵션·포지션·정책 자료로 별도 확인하세요.`,
      `'미 국채 수익률 곡선'에서 금리의 '레벨'보다 '변화 속도'와 역전 여부(2s10s·3m10y 배지)를 보세요 — 빠른 급등/급락이 주식시장을 흔듭니다.`,
      `'채권 변동성 · 크레딧 시장'의 HY 스프레드가 주식 급락과 함께 확대되는지 확인하세요 — 스프레드가 조용하면 주식만의 노이즈일 가능성, 같이 벌어지면 신용 문제로 승격.`
    ],
    action: [
      `지수 급락일엔 달러·엔·10Y 3개를 먼저 확인 — 원인(긴축 공포/신용 공포/캐리 청산)에 따라 대응이 다릅니다.`,
      `원/달러 급등 구간에서 외국인 수급 의존도가 높은 대형주 신규 진입은 보수적으로.`,
      `금리 급등기에 고PER 성장주 비중을 점검하고, 금리 하락 전환이 확인될 때까지 분할로만 접근.`
    ],
    terms: `DXY · 장단기 금리역전 · OAS / HY 스프레드 · 엔캐리`
  },
  'fundamental': {
    title: `기업 분석 기초`,
    concept: [
      `밸류에이션 배수는 '주가가 기업의 무엇(이익·매출·자산) 대비 몇 배인가'입니다 — PER=이익 대비, PSR=매출 대비, PBR=자산 대비.`,
      `어닝(실적 발표)은 분기마다 기업의 실제 성적과 다음 분기 가이던스를 확인하는 이벤트입니다.`
    ],
    why: [
      `배수는 업종·성장률에 따라 정상 범위가 다릅니다 — 절대값 비교가 아니라 같은 업종·자기 과거와 비교해야 의미가 생깁니다.`,
      `주가는 발표된 실적보다 가이던스(미래)에 더 크게 반응합니다 — 좋은 실적+나쁜 가이던스=급락이 흔한 이유.`
    ],
    how: [
      `종목 검색 후 성장·수익성 차트에서 매출 성장률과 마진의 '방향'을 먼저 보고, 밸류에이션 카드는 그 다음에 보세요.`,
      `'어닝 캘린더'에서 보유/관심 종목의 발표일을 미리 확인하고, '최근 실적 서프라이즈 현황'으로 시장 전반의 어닝 톤을 잡으세요.`,
      `'리스크 레이더'는 재무제표 기반 경고(유동성·부채·희석 등)를 모아 보여줍니다 — 매수 근거보다 매수 반대 근거를 먼저 찾는 습관에 맞는 도구입니다.`
    ],
    action: [
      `어닝 발표 직전 신규 진입은 실력이 아니라 동전 던지기입니다 — 발표 후 반응을 보고 들어가도 늦지 않습니다.`,
      `배수가 싸 보이는 이유(성장 둔화? 일회성 이익?)를 설명할 수 없으면 사지 않습니다.`
    ],
    terms: `PER (P/E Ratio) · EPS · 잉여현금흐름(FCF) · Forward PER`
  },
  'themes': {
    title: `섹터 로테이션의 원리`,
    concept: [
      `시장의 주도 섹터는 경기 사이클과 금리 국면에 따라 순환합니다 — 이를 추적하는 도구가 RRG(상대회전그래프)입니다.`,
      `RRG는 각 테마의 상대강도(가로)와 그 모멘텀(세로)을 4분면(주도/개선/지체/약화)으로 보여줍니다.`
    ],
    why: [
      `종목 수익의 큰 부분은 소속 섹터의 기류가 결정합니다 — 약한 섹터의 강한 종목보다 강한 섹터의 평범한 종목이 쉬운 경우가 많습니다.`,
      `분면의 이동은 벤치마크 대비 변화입니다. 시계방향 순환이 보장되지는 않으므로 위치와 이동 방향을 실제 수익률과 함께 보세요.`
    ],
    how: [
      `RRG에서 우상(Leading)에 새로 진입하는 테마, 좌상(Improving)에서 우상으로 향하는 꼬리 방향을 보세요.`,
      `'섹터 ETF 퍼포먼스'와 '20일 추이'로 RRG의 판정을 실제 수익률로 교차 확인하세요.`,
      `'경기 사이클 — 지금 어디?' 카드는 어떤 섹터가 다음 주도가 되기 쉬운지의 배경 지도입니다.`,
      `'테마 히트맵'과 세분화 테마에서 카드를 눌러 상세 패널의 주도/부진 종목 분해를 확인하세요.`
    ],
    action: [
      `Improving→Leading 전환은 비교 후보를 좁히는 관찰 조건이며, 개별 종목의 가격·거래량·실적 근거를 확인해야 합니다.`,
      `Weakening은 상대 모멘텀 약화를 뜻합니다. 보유 판단은 종목별 투자 가설과 무효화 조건을 따로 검토하세요.`
    ],
    terms: `RRG (상대회전그래프)`
  },
  'portfolio': {
    title: `포지션 사이징과 분산`,
    concept: [
      `포지션 사이징은 '한 번의 실패가 계좌에 주는 피해'를 설계하는 일입니다 — 종목 선택보다 생존에 더 중요합니다.`,
      `분산의 핵심은 종목 수가 아니라 상관관계입니다 — 같은 테마 10종목은 분산이 아닙니다.`,
      `리스크 지표 읽기: 샤프=위험 대비 수익 효율, 베타=시장 대비 민감도, MDD(최대낙폭)=최악 구간에서 실제로 겪었을 손실 깊이.`
    ],
    why: [
      `손실은 비대칭입니다: -50%를 복구하려면 +100%가 필요합니다 — 큰 손실을 피하는 것이 수익률 극대화보다 우선인 수학적 이유.`,
      `상관 높은 자산은 위기에 상관이 1로 수렴합니다 — 평시 분산이 위기 때 무너지는 이유라, 집중도를 평시에 관리해야 합니다.`
    ],
    how: [
      `'리스크 분석'의 샤프·베타·MDD·이탈도 카드로 계좌의 체질을 먼저 보고, '섹터 집중도 분석'에서 '몇 종목'이 아니라 '몇 개의 베팅'인지 세어 보세요.`,
      `'포트폴리오 vs SPY 수익률 비교'로 내 선택이 지수 대비 초과 성과인지 확인 — 지수에 지고 있다면 종목 수를 줄이는 것도 전략입니다.`,
      `R/R(리스크·리워드) 계산기에 진입가·손절가·투입 가능 자본을 넣으면 1R 손실액과 적정 수량이 나옵니다 — 아래 action의 수식을 자동화한 도구입니다.`
    ],
    action: [
      `1회 매매 손실 한도를 계좌의 1~2%로 고정하고, 손절폭이 크면 수량을 줄이는 식으로 사이징하세요(수량 = 허용손실 ÷ 주당 손절폭 — R/R 계산기가 이 계산을 대신합니다).`,
      `같은 방향 베팅(예: 전부 AI 관련)이 계좌의 절반을 넘으면 신규는 다른 축에서만 고릅니다.`
    ],
    terms: `샤프비율(Sharpe Ratio) · 베타(Beta) · 손절(Stop Loss)`
  },
  'ticker': {
    title: `종목을 보는 순서 (탑다운)`,
    concept: [
      `개별 종목 판단은 '시장 → 섹터/테마 → 종목' 순서의 탑다운이 기본기입니다. 이 페이지의 '진입 적합성' 체크가 그 순서를 강제합니다.`,
      `'시장 건강도' 점수는 상단 종합 시그널과 다른, 개별 진입 타이밍용 필터입니다.`
    ],
    why: [
      `아무리 좋은 종목도 시장·섹터의 역풍 속에서는 승률이 급감합니다 — 종목 분석에 앞서 환경 점검이 먼저인 이유.`
    ],
    how: [
      `티커 검색 후 진입 적합성 체크를 위에서부터: 시장 건강도 → 섹터 기류 → 종목 자체(추세/거래량/이벤트) 순서로 확인하세요.`,
      `'진입 품질 계산기'에 현재가·20EMA·RSI를 넣으면 진입 등급과 손절 후보가 나옵니다 — 탑다운 통과 후 타이밍을 재는 마지막 단계입니다.`,
      `'캔들 패턴 갤러리'는 개별 캔들 신호의 사전입니다 — 패턴 단독이 아니라 위치(지지/저항 근처인가)와 함께 읽으세요.`
    ],
    action: [
      `시장 건강도가 나쁜 날은 '좋은 종목 발견'이 곧 '매수 사유'가 되지 않습니다 — 관심 목록에 두고 환경이 풀릴 때 진입.`,
      `어닝 임박 종목은 체크리스트가 좋아도 이벤트 리스크를 별도로 감안하세요.`
    ],
    terms: `베타(Beta) · 52주 신고가/신저가`
  },
  'market-news': {
    title: `뉴스가 가격이 되는 원리`,
    concept: [
      `가격을 움직이는 건 뉴스 자체가 아니라 '기대와의 차이'입니다 — 알려진 호재는 이미 가격에 있습니다.`,
      `뉴스에는 시그널(구조를 바꾸는 것)과 노이즈(하루짜리 소음)가 섞여 있습니다 — 이 페이지의 중요도 점수·토픽 분류가 1차 필터입니다.`
    ],
    why: [
      `'뉴스에 팔아라'는 격언의 메커니즘: 루머/기대 단계에서 미리 산 자금이 확정 뉴스에 이익을 실현하기 때문입니다.`,
      `같은 뉴스에 대한 시장의 반응 방향이 해석보다 정확합니다 — 호재에 안 오르는 것 자체가 정보입니다.`
    ],
    how: [
      `국가/토픽 칩으로 오늘 뉴스가 어느 축에 몰리는지 보고, 해당 상세 페이지로 내려가세요.`,
      `중요도 정렬 버튼으로 점수 상위부터 읽고, 그 뉴스가 이미 가격에 반영됐는지(관련 종목 차트) 교차 확인하는 습관을 들이세요.`,
      `상단 뉴스 감성 점수와 리스크 신호 카운트는 피드 전체의 톤 요약입니다 — 개별 기사 전에 숲부터 보세요.`
    ],
    action: [
      `급등 후 나온 호재 기사로 추격 매수하지 않기 — 뉴스보다 먼저 움직인 가격이 이미 그 뉴스입니다.`,
      `보유 종목의 악재는 '일회성인가, 이익 체력을 바꾸는가'만 판단하고, 후자면 기계적으로 줄입니다.`
    ],
    terms: `어닝 서프라이즈`
  },
  'options': {
    title: `변동성 지표 읽기`,
    concept: [
      `VIX=향후 30일 기대변동성, PCR(풋/콜 비율)=하락 베팅과 상승 베팅의 비율, SKEW=극단 하락(테일) 보험의 상대 가격입니다.`
    ],
    why: [
      `옵션 시장은 '보험료'로 공포를 정량화합니다 — 주식 투자자에게도 심리·헤지 수요를 읽는 창입니다.`
    ],
    how: [
      `이 페이지의 대체 지표 카드(VIX·PCR·SKEW)를 심리 페이지의 F&G와 교차 확인하세요.`
    ],
    action: [
      `PCR 극단(과도한 풋 쏠림)은 바닥 부근에서 자주 나타나는 역발상 참고 — 단독 매매 신호로 쓰지 않습니다.`
    ],
    terms: `OPEX (옵션 만기일) · 맥스페인(Max Pain)`
  },
  'screener': {
    title: `팩터 스크리닝의 원리`,
    concept: [
      `스크리너는 모멘텀·밸류·퀄리티 같은 팩터(수익률을 설명하는 공통 특성) 기준으로 후보를 걸러내는 도구입니다.`,
      `결과는 '매수 목록'이 아니라 '조사 대상 목록'입니다.`
    ],
    why: [
      `팩터별로 잘 작동하는 국면이 다릅니다 — 상승 추세에선 모멘텀, 바닥 반전에선 밸류가 상대적으로 유리한 경향. 그래서 시장 국면(시그널 페이지)과 함께 써야 합니다.`
    ],
    how: [
      `상단 레짐 표시는 현재 시장 국면에 따른 가중 후보를 설명합니다. 표본 밖 검증·비용·유동성·라이브/백테스트 일치와 검토 승격 전에는 실제 순위가 중립 고정 가중치를 유지합니다.`,
      `헤더 클릭 정렬로 기준을 바꿔 가며 상위에 반복 등장하는 종목(멀티팩터 합의)을 관심 목록으로 올리세요.`,
      `'팩터 검증 · 백테스트 IC' 탭은 각 팩터의 과거 관계를 표본·기간·비용 조건과 함께 점검하는 참고 화면입니다 — 예측력이나 수익률 설명력을 인증하는 증거가 아니므로 랭킹을 맹신하지 마세요.`
    ],
    action: [
      `스크리너 상위 종목도 차트(진입 시점)와 어닝 일정(이벤트)을 확인한 뒤에만 진입 — 랭킹은 타이밍을 말해주지 않습니다.`,
      `진입을 정했으면 하단 포지션 사이저에 자본·리스크%·손절가를 넣어 수량부터 고정하세요.`
    ],
    terms: `피오트로스키 F-점수 · PEG Ratio`
  },
  // v53.7 (P725): KR 전용 5페이지 교육 블록 제거 — 페이지 퇴역(콘텐츠는 git 이력 보존)
  _krEduRetired: true
};

// P1130/R619: index.html 인라인 블록 E(용어사전 플로팅 버튼 드래그 + 옵션 페이지 연동)를 이 파일로 옮겼다.
// 새 js 파일을 만들면 매니페스트 4곳·RUNTIME_SCRIPT_FILES 2곳 등록이 필요해지고, 그 등록 누락이 과거
// P605(중복 전역 섀도잉이 수십 버전 동안 미탐지) 같은 사고의 원인이었다. 이미 등록된 이 파일에 접어넣으면
// 등록 비용이 0이다. 실행 시점은 파싱 시점 → defer(파싱 후·DOMContentLoaded 전)로 바뀌는데, 옮긴 코드는
// (a) 이미 파싱된 #glossary-btn에 리스너를 붙이고 (b) DOMContentLoaded에서 pageBus를 등록하므로
// 둘 다 defer가 더 안전하다. 파싱 시점에 이 블록의 심볼을 호출하는 경로가 없음을 확인했다.
(function(){
  var btn=document.getElementById('glossary-btn');
  if(!btn) return;
  var isDragging=false, hasMoved=false, startX=0, startY=0, origX=0, origY=0;
  function onStart(e){
    isDragging=true; hasMoved=false;
    var t=e.touches?e.touches[0]:e;
    startX=t.clientX; startY=t.clientY;
    var r=btn.getBoundingClientRect();
    origX=r.left; origY=r.top;
    btn.style.cursor='grabbing';
    btn.style.transition='box-shadow .2s';
    btn.style.boxShadow='0 6px 25px rgba(33,29,22,0.6)';
    e.preventDefault();
  }
  function onMove(e){
    if(!isDragging) return;
    var t=e.touches?e.touches[0]:e;
    var dx=t.clientX-startX, dy=t.clientY-startY;
    if(Math.abs(dx)>3||Math.abs(dy)>3) hasMoved=true;
    if(!hasMoved) return;
    var nx=origX+dx, ny=origY+dy;
    nx=Math.max(0,Math.min(window.innerWidth-52,nx));
    ny=Math.max(0,Math.min(window.innerHeight-52,ny));
    btn.style.left=nx+'px'; btn.style.top=ny+'px';
    btn.style.right='auto'; btn.style.bottom='auto';
    e.preventDefault();
  }
  function onEnd(){
    if(!isDragging) return;
    isDragging=false;
    btn.style.cursor='grab';
    btn.style.boxShadow='0 4px 15px rgba(33,29,22,0.4)';
    if(!hasMoved) openGlossary();
  }
  btn.addEventListener('mousedown',onStart);
  btn.addEventListener('touchstart',onStart,{passive:false});
  document.addEventListener('mousemove',onMove);
  document.addEventListener('touchmove',onMove,{passive:true}); /* v48.68 P139: 글로서리 버튼 display:none → isDragging 항상 false → preventDefault() 미호출 → passive:true 안전 (브라우저 터치 스크롤 최적화 허용) */
  document.addEventListener('mouseup',onEnd);
  document.addEventListener('touchend',onEnd);
})();

// ═══════════════ v31.9: OPTIONS 페이지 실시간 연동 ═══════════════
function initOptionsPage() {
  var vix = typeof _ldSafe === 'function' ? _ldSafe('^VIX','price') : 0;
  var vvix = typeof _ldSafe === 'function' ? _ldSafe('^VVIX','price') : 0;

  // ── VIX 기반 파생 지표 계산 ──
  if (vix > 0) {
    // Observed VIX window only: never invent a 52-week band or call this ticker IV.
    var _vixPoints = Array.isArray(window._vixHistory) ? window._vixHistory.filter(function(point) {
      return point && point.date && point.value != null && Number.isFinite(Number(point.value)) && Number(point.value) > 0;
    }) : [];
    var _vixSeries = _vixPoints.map(function(point) { return Number(point.value); });
    var _vixLow = _vixSeries.length ? Math.min.apply(null, _vixSeries) : null;
    var _vixHigh = _vixSeries.length ? Math.max.apply(null, _vixSeries) : null;
    var _vixWindowReady = _vixSeries.length >= 20 && _vixHigh > _vixLow;
    var vixPctile = _vixWindowReady ? Math.round(_vixSeries.filter(function(value) { return value <= vix; }).length / _vixSeries.length * 100) : null;
    var ivRank = _vixWindowReady ? Math.max(0, Math.min(100, Math.round((vix - _vixLow) / (_vixHigh - _vixLow) * 100))) : null;
    window._vixIvRankEvidence = {
      source: _vixWindowReady ? 'dated-vix-history-window' : 'unavailable',
      sampleCount: _vixSeries.length,
      low: _vixLow, high: _vixHigh,
      asOf: _vixPoints.length ? _vixPoints[_vixPoints.length - 1].date : null,
      decisionUse: 'reference-only'
    };
    ['opt-vix-pctile','opt-ivpct-val'].forEach(function(id) {
      var node = document.getElementById(id);
      if (node) { node.textContent = vixPctile == null ? '—' : vixPctile + '%'; node.title = '수신 VIX 표본 내 백분위 · 개별 종목 IV 아님'; }
    });
    var ivRankEl = document.getElementById('opt-ivrank-val');
    if (ivRankEl) { ivRankEl.textContent = ivRank == null ? '—' : ivRank + '%'; ivRankEl.title = '수신 VIX 표본의 고저 범위 내 위치 · 1년 IV Rank 아님'; }
    ['opt-ivrank-desc','opt-ivpct-desc'].forEach(function(id) {
      var node = document.getElementById(id);
      if (node) node.textContent = _vixWindowReady ? '수신 ' + _vixSeries.length + '일 VIX 참고값 · 개별 옵션 IV 미제공' : '날짜가 있는 VIX 이력 20일 필요 · 임의 추정 안 함';
    });

    // VVIX 설명 업데이트
    var vvixDesc = document.getElementById('opt-vvix-desc');
    if (vvixDesc && vvix > 0) {
      var vvixLevel = vvix >= 120 ? '매우 높음 · 변동성 급등 경고' :
                      vvix >= 100 ? '높음 · 시장 긴장' :
                      vvix >= 80 ? '보통 · 정상 범위' : '낮음 · 안정';
      var vvixColor = vvix >= 120 ? 'var(--data-red)' : vvix >= 100 ? 'var(--data-amber)' : vvix >= 80 ? 'var(--data-amber)' : 'var(--data-green)';
      vvixDesc.textContent = vvixLevel;
      vvixDesc.style.color = vvixColor;
    }

    // VVIX/VIX 비율 — v36.7: 연구 기반 임계값 적용
    var ratioEl = document.getElementById('opt-vvix-ratio');
    if (ratioEl && vvix > 0 && vix > 0) {
      var ratio = vvix / vix;
      var ratioStr = ratio.toFixed(2);
      var ratioColor, ratioLabel;
      ratioColor = 'var(--text-secondary)';
      ratioLabel = '관측 비율 · 감마·주문 방향 추정 안 함';
      ratioEl.innerHTML = ratioStr + ' <span style="font-size:11px;color:' + ratioColor + ';font-weight:400;">' + ratioLabel + '</span>';
      ratioEl.style.color = ratioColor;
      // 전역 저장 (Risk Monitor, LLM용)
      window._vvixVixRatio = { ratio: ratio, label: ratioLabel, color: ratioColor };
    }

    // VIX 수준별 상태 색상
    var vixColor = vix >= 30 ? 'var(--data-red)' : vix >= 20 ? 'var(--data-amber)' : vix >= 15 ? 'var(--data-amber)' : 'var(--data-green)';
    var vixSentiment = vix >= 30 ? '극도 긴장' : vix >= 25 ? '높은 긴장' : vix >= 20 ? '경계' : vix >= 15 ? '보통' : '안정';

    // Sentiment strip VIX 설명 업데이트
    var vixDescEls = document.querySelectorAll('#page-options div[style*="font-size:11px"][style*="color:#211d16"]');
    if (vixDescEls.length > 0) {
      vixDescEls[0].textContent = (vixPctile == null ? '표본 이력 미수신' : '수신 표본 ' + vixPctile + '%ile') + ' · ' + vixSentiment;
      vixDescEls[0].style.color = vixColor;
    }
  }

  // 업데이트 시간 표시
  var timeEl = document.getElementById('opt-update-time');
  if (timeEl) {
    var vixObservation = window._liveData && window._liveData['^VIX'];
    var observedAt = vixObservation && (vixObservation.observedAt || vixObservation.quoteEnvelope && vixObservation.quoteEnvelope.observedAt);
    timeEl.textContent = observedAt ? 'VIX 관측: ' + String(observedAt).slice(0, 16).replace('T', ' ') : 'VIX 관측시각 미수신';
  }

  // v38.8: PCR 동적 연결 — data-live-price="PCR" 요소에 실시간 값 반영
  var pcrVal = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.pcr) ? DATA_SNAPSHOT.pcr : null;
  if (pcrVal && !(window._lastPutCallPayload && window._lastPutCallPayload.metric && window._lastPutCallPayload.metric.allowedUse)) {
    if (typeof _aioUpdatePutCallDom === 'function') {
      _aioUpdatePutCallDom({
        totalPutCall: pcrVal,
        sourceKind: 'snapshot',
        sourceLabel: 'DATA_SNAPSHOT',
        asOf: (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._snapshotDate) || new Date().toISOString()
      });
    } else {
    var pcrEls = document.querySelectorAll('#page-options [data-live-price="PCR"]');
    pcrEls.forEach(function(el) {
      if (typeof _aioIsNativeMacroElement === 'function' && _aioIsNativeMacroElement(el)) return;
      el.textContent = parseFloat(pcrVal).toFixed(2);
      el.style.color = pcrVal > 1.2 ? 'var(--data-red)' : pcrVal > 0.9 ? 'var(--data-amber)' : 'var(--data-green)';
      el.setAttribute('data-operational-use', 'reference-only');
    });
    }
  }

  // v38.8: GEX 스냅샷 명시
  var gexEl = document.getElementById('opt-gex-val');
  var gexDesc = document.getElementById('opt-gex-desc');
  if (gexEl && gexEl.textContent !== '—' && !gexEl.dataset.marked) {
    gexEl.dataset.marked = '1';
  }
  if (gexDesc && !gexDesc.dataset.marked) {
    gexDesc.textContent = '실시간 API 미제공 · 참고용 스냅샷 · 의사결정 제외';
    gexDesc.dataset.marked = '1';
  }

  // v37.8: 동적 옵션 분석
  if (typeof _generateOptionsAnalysis === 'function') _generateOptionsAnalysis(vix, vvix, vixPctile, ivRank);
  console.log('[AIO] Options page init — VIX:', vix, 'VVIX:', vvix);
}

// Options 페이지 이벤트 리스너
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-options-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'options') {
    try { initOptionsPage(); } catch(err) { _aioLog('warn', 'init', 'Options pageShown error: ' + (err && err.message || err)); }
  }
});
_aioPageBus.register('html-options-live', 'aio:liveQuotes', function() {
  var optPage = document.getElementById('page-options');
  if (optPage && optPage.classList.contains('active')) {
    try { initOptionsPage(); } catch(err) {}
  }
});
});
// ═══════════════ END OPTIONS ═══════════════


// ═══════════════════════════════════════════════════════════════════════════════
// P1132/R619: index.html 인라인 블록 F(3,106줄 — 용어사전 시스템, 모바일 메뉴/스크롤탑,
// GMO 글로벌 개요, 키보드 단축키/내비, 티커 가격 차트, 종합 기술적 분석 엔진(Weinstein/추세/
// VCP/Minervini 등), analyzeTickerDeep + Yahoo 조회, KR VKOSPI·건강도·수급 차트, KR 기술
// 페이지, Phase-2 기능과 TradingView 위젯, McClellan·벤치마크 차트, 가격 알림, 접근성,
// 테마 토글, 서비스워커 등록, 면책/온보딩, 사이드바)를 이 파일로 옮겼다.
//
// 블록 G(직전 커밋에서 이관)가 빠진 뒤 이 블록이 **문서상 마지막 인라인 클래식 블록**이 되어,
// 뒤에 오는 인라인 블록이 이 블록의 전역을 파싱 시점에 읽는 경로가 없다 — 그래서 순서 위험이
// 가장 낮았다. 실행 시점은 파싱 → defer(파싱 후·DOMContentLoaded 전)로 바뀌는데, 이 블록은
// DOMContentLoaded에서 리스너를 등록하고 함수를 정의하는 형태이므로 defer가 더 안전하다.
// ═══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// GLOSSARY SYSTEM — 투자 용어 사전
// ══════════════════════════════════════════════════════════════════

var _glossaryCat = 'all';
var _glossaryPreviousFocus = null;

function openGlossary() {
  var modal = document.getElementById('glossary-modal');
  if (!modal) return;
  _glossaryPreviousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  if (modal._aioTrapCleanup) modal._aioTrapCleanup();
  modal.style.display = '';
  var searchInput = document.getElementById('glossary-search');
  searchInput.value = '';
  _glossaryCat = 'all';
  renderGlossaryCats();
  renderGlossaryItems('');
  var title = document.querySelector('#glossary-modal h2');
  if (title) title.textContent = '투자 용어 사전 · ' + GLOSSARY.length + '개';
  modal._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(modal, window._aioCloseGlossary) : null;
  searchInput.focus();
}

function renderGlossaryCats() {
  var cats = ['all','기초','기술적분석','경제','외환','채권','매크로','옵션','한국시장','전략','배경지식'];
  var labels = {'all':'전체','기초':' 기초','기술적분석':'차트분석','경제':'경제','외환':'외환','채권':' 채권','매크로':'매크로','옵션':'옵션','한국시장':' 한국시장','전략':'전략','배경지식':'배경지식'};
  var html = '';
  cats.forEach(function(c) {
    var active = c === _glossaryCat;
    html += '<button data-action="_aioGlossaryCat" data-arg="' + escHtml(c) + '" style="padding:5px 12px;border-radius:3px;border:1px solid ' + (active ? 'var(--data-purple)' : 'rgba(33,29,22,0.1)') + ';background:' + (active ? 'rgba(33,29,22,0.2)' : 'transparent') + ';color:' + (active ? '#211d16' : '#8a8271') + ';font-size:12px;cursor:pointer;">' + (labels[c]||c) + '</button>';
  });
  document.getElementById('glossary-cats').innerHTML = html;
}

function renderGlossaryItems(query) {
  var q = (query||'').toLowerCase();
  var filtered = GLOSSARY.filter(function(g) {
    if (_glossaryCat !== 'all' && g.cat !== _glossaryCat) return false;
    if (q && g.term.toLowerCase().indexOf(q) === -1 && g.def.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var html = '';
  if (filtered.length === 0) {
    html = '<div style="text-align:center;color:var(--text-muted);padding:40px;">검색 결과가 없습니다</div>';
  } else {
    filtered.forEach(function(g) {
      var catColors = {'기초':'var(--data-green)','기술적분석':'var(--data-cyan)','경제':'var(--data-amber)','외환':'#211d16','채권':'#211d16','매크로':'var(--data-amber)','옵션':'#211d16','한국시장':'var(--data-purple)','전략':'#57513f','배경지식':'var(--text-muted)'};
      html += '<div class="aio-glossary-item" style="padding:12px 0;border-bottom:1px solid var(--surface-4);">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
      html += '<span class="aio-glossary-term" style="font-weight:600;color:#8a8271;font-size:14px;">' + escHtml(g.term) + '</span>';
      html += '<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:' + (catColors[g.cat]||'var(--text-muted)') + '22;color:' + (catColors[g.cat]||'var(--text-muted)') + ';">' + escHtml(g.cat) + '</span>';
      html += '</div>';
      html += '<div style="color:var(--text-secondary);font-size:13px;line-height:1.5;">' + escHtml(g.def) + '</div>';
      html += '</div>';
    });
  }
  document.getElementById('glossary-body').innerHTML = html;
}

function filterGlossary(val) { renderGlossaryItems(val); }

// v33.0: 통합 분석 모드 — 레벨 선택 UI 없음, 항상 전문가급 통합 분석
// Insight box 펼침/접기 토글
document.querySelectorAll('.insight-box').forEach(function(el) {
  el.addEventListener('click', function() { this.classList.toggle('box-collapsed'); });
});
// v38.8: 첫 방문 시 insight-box를 펼친 상태로 표시 (핵심 설명 노출)
(function() {
  if (!localStorage.getItem('aio_visited')) {
    localStorage.setItem('aio_visited', '1');
    document.querySelectorAll('.insight-box.box-collapsed').forEach(function(el) {
      el.classList.remove('box-collapsed');
    });
  }
})();
// 이전 localStorage 키 정리
(function() {
  if (localStorage.getItem('aio_beginner')) localStorage.removeItem('aio_beginner');
  if (localStorage.getItem('aio_analysis_level')) localStorage.removeItem('aio_analysis_level');
})();

// v38.8: 로딩 상태 타임아웃 — 15초 후에도 "로딩 중"이면 안내 메시지 표시
// v48.57: 워치독 범위 확장 (earn-cal-body / risk-radar-body / kr-investor 3개 / last-fetch-time / home-quality-label / score-gauge-result)
setTimeout(function() {
  var loadingPatterns = ['로딩 중', '생성 중', 'Loading', '계산중', '계산 중', '분석 로딩', '데이터 로딩'];
  var candidates = document.querySelectorAll(
    '#macro-storyline, #earnings-calendar-body, #risk-radar-body, #home-news-highlights, ' +
    '#kr-supply-analysis-text, ' +
    '#kr-investor-foreign-buy, #kr-investor-organ-buy, #kr-foreign-hold-top10, ' +
    '#last-fetch-time, #home-quality-label'
  );
  candidates.forEach(function(el) {
    if (!el) return;
    var txt = (el.textContent || '').trim();
    var isLoading = loadingPatterns.some(function(p) { return txt.indexOf(p) !== -1; });
    if (isLoading && txt.length < 80) {
      el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;line-height:1.6;">' +
        '데이터를 불러오지 못했습니다.<br>' +
        '<span style="font-size:10px;">네트워크 연결을 확인하거나, <b>사용 설명서</b>에서 API 키 설정을 확인하세요.</span><br>' +
        '<button data-action="_aioReload" style="margin-top:6px;padding:4px 12px;font-size:10px;background:rgba(33,29,22,0.1);border:1px solid rgba(33,29,22,0.3);color:var(--data-cyan);border-radius:4px;cursor:pointer;"> 새로고침</button>' +
        '</div>';
    }
  });
  // status 스팬류 (텍스트 짧은 단일 라인)
  ['earn-cal-status','risk-radar-status'].forEach(function(id){
    var s = document.getElementById(id);
    if (s && /로딩 중|데이터 로딩/.test(s.textContent || '')) s.textContent = '연결 실패 · API 키 확인';
  });
  var krSupplyAnalysis = document.getElementById('kr-supply-analysis-text');
  if (krSupplyAnalysis && /로딩 중|데이터 로딩|데이터를 불러오지 못했습니다/.test(krSupplyAnalysis.textContent || '')) {
    krSupplyAnalysis.textContent = 'KR 수급 데이터 수신 지연 · 폴백 상태로 표시하며 현재 의사결정에는 사용하지 않음';
  }
}, 15000);

// ═══ v27: Mobile Menu Toggle ═══
var _aioMobileMenuOpener = null;
function toggleMobileMenu() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('mobile-overlay');
  var trigger = document.getElementById('mobile-menu-trigger');
  if (sidebar && overlay) {
    var opening = !sidebar.classList.contains('mobile-open');
    if (opening) _aioMobileMenuOpener = document.activeElement;
    sidebar.classList.toggle('mobile-open', opening);
    overlay.classList.toggle('show', opening);
    if (opening) {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('role', 'button');
      overlay.setAttribute('tabindex', '0');
      overlay.setAttribute('aria-label', '모바일 메뉴 닫기');
    } else {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeAttribute('role');
      overlay.removeAttribute('tabindex');
      overlay.removeAttribute('aria-label');
    }
    if (trigger) trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
  }
}
function closeMobileMenu() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('mobile-overlay');
  var trigger = document.getElementById('mobile-menu-trigger');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('show');
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeAttribute('role');
    overlay.removeAttribute('tabindex');
    overlay.removeAttribute('aria-label');
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  var opener = _aioMobileMenuOpener;
  _aioMobileMenuOpener = null;
  if (opener && document.contains(opener) && !opener.disabled) { try { opener.focus(); } catch (_) {} }
}
// Close mobile menu when a nav item is clicked
document.querySelectorAll('.nav-item').forEach(function(n) {
  n.addEventListener('click', closeMobileMenu);
});
var mobileOverlay = document.getElementById('mobile-overlay');
if (mobileOverlay) mobileOverlay.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeMobileMenu(); }
});

// ═══ v30.11: 모바일 키보드 가림 방지 (visualViewport API) ═══
(function() {
  if (!window.visualViewport) return;
  var chatInputs = document.querySelectorAll('.acp-input-row input');
  window.visualViewport.addEventListener('resize', function() {
    // 키보드가 열리면 viewport 높이가 줄어듦
    var keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
    document.body.classList.toggle('keyboard-open', keyboardOpen);
    if (keyboardOpen) {
      // 활성 입력 요소를 뷰포트 안으로 스크롤
      var active = document.activeElement;
      if (active && active.tagName === 'INPUT') {
        setTimeout(function() { active.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 100);
      }
    }
  });
})();

// ═══ v27: Scroll-to-top Button ═══
(function() {
  var contentEl = document.querySelector('.content');
  var scrollBtn = document.getElementById('scroll-top-btn');
  if (contentEl && scrollBtn) {
    // v46.4: throttle로 scroll 성능 최적화 (고빈도 이벤트 16ms 간격 제한)
    var _scrollTick = false;
    contentEl.addEventListener('scroll', function() {
      if (_scrollTick) return;
      _scrollTick = true;
      requestAnimationFrame(function() {
        if (contentEl.scrollTop > 400) {
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.classList.remove('visible');
        }
        _scrollTick = false;
      });
    });
  }
})();

// ═══ v34: Bloomberg-Style Global Market Overview ═══════════════════════
const GMO_MARKETS = [
  { region: '🇺🇸 Americas', items: [
    { sym: '^GSPC', label: 'S&P 500' },
    // v52.42 (P657/EF-17, 사용자 승인): 정규장 외(한국 아침 등) "오늘 미장 분위기" 첫 질문에 답하도록
    // ES=F/NQ=F 선물 2행 추가. renderGmoTable()이 정규장 시간대에는 이 2행을 시각적으로 절제하고
    // 정규장 외에만 강조(futures 전용 클래스)한다.
    { sym: 'ES=F', label: 'S&P Futures', isFutures: true },
    { sym: 'NQ=F', label: 'Nasdaq Futures', isFutures: true },
    { sym: '^IXIC', label: 'NASDAQ' },
    { sym: '^DJI',  label: 'DOW 30' },
    { sym: '^RUT',  label: 'Russell 2K' },
    { sym: 'BTC-USD', label: 'Bitcoin' },
    { sym: 'ETH-USD', label: 'Ethereum' },
  ]},
  { region: 'Rates & Commodities', items: [
    { sym: '^VIX',    label: 'VIX' },
    { sym: '^TNX',    label: 'US 10Y' },
    { sym: 'DX-Y.NYB', label: 'DXY' },
    { sym: 'GC=F',   label: 'Gold' },
    { sym: 'CL=F',   label: 'WTI Crude' },
    { sym: 'SI=F',   label: 'Silver' },
  ]},
  { region: 'Asia-Pacific', items: [
    { sym: '^N225',  label: 'Nikkei 225' },
    { sym: '^HSI',   label: 'Hang Seng' },
    { sym: '000001.SS', label: 'Shanghai' },
    { sym: '^KS11', label: 'KOSPI' },
  ]},
  { region: '🇪🇺 EMEA', items: [
    { sym: '^GDAXI', label: 'DAX' },
    { sym: '^FTSE',  label: 'FTSE 100' },
    { sym: '^FCHI',  label: 'CAC 40' },
  ]},
];

let _gmoExpanded = false;
let _gmoPrevData = {};

function toggleGmoExpand() {
  _gmoExpanded = !_gmoExpanded;
  const btn = document.getElementById('gmo-expand-btn');
  if (btn) btn.textContent = _gmoExpanded ? 'COMPACT' : 'EXPAND';
  renderGmoTable();
}

function getGmoSignal(pct) {
  if (pct == null || isNaN(pct)) return { text: '—', cls: 'gmo-flat' };
  if (pct > 1.5) return { text: '▲▲', cls: 'gmo-pos' };
  if (pct > 0.3) return { text: '▲', cls: 'gmo-pos' };
  if (pct > -0.3) return { text: '—', cls: 'gmo-flat' };
  if (pct > -1.5) return { text: '▼', cls: 'gmo-neg' };
  return { text: '▼▼', cls: 'gmo-neg' };
}

function renderGmoTable() {
  const tbody = document.getElementById('gmo-tbody');
  if (!tbody) return;
  let ld = window._liveData || {};
  let html = '';
  const regions = _gmoExpanded ? GMO_MARKETS : GMO_MARKETS.slice(0, 2);
  // v52.42 (P657/EF-17): 정규장(open)일 때는 현물 지수가 이미 실시간이라 선물 행이 정보 중복 —
  // 옅게 처리. 정규장 외(pre/after/closed/futures_only)일 때만 강조해 "오늘 미장 분위기"에 바로 답한다.
  var usSession = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
  var isRegularHours = usSession === 'open';

  for (const group of regions) {
    html += `<tr class="gmo-region-header"><td colspan="4">${group.region}</td></tr>`;
    for (const item of group.items) {
      const d = ld[item.sym];
      const price = d && d.price != null ? d.price : null;
      const pct = d && d.pct != null ? d.pct : null;
      const prevPrice = _gmoPrevData[item.sym];
      const flashCls = (prevPrice != null && price != null && prevPrice !== price) ? ' gmo-flash' : '';
      const priceFmt = price != null
        ? (price >= 10000 ? price.toLocaleString(undefined,{maximumFractionDigits:0}) :
           price >= 100 ? price.toLocaleString(undefined,{maximumFractionDigits:1}) :
           price >= 1 ? price.toFixed(2) : price.toFixed(4))
        : '—';
      const pctFmt = pct != null ? ((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%') : '—';
      const pctCls = pct != null ? (pct >= 0 ? 'gmo-pos' : 'gmo-neg') : 'gmo-flat';
      const sig = getGmoSignal(pct);
      const futuresRowStyle = item.isFutures
        ? (isRegularHours ? ' style="opacity:0.55;"' : ' style="background:rgba(33,29,22,0.08);"')
        : '';
      const futuresLabelSuffix = item.isFutures && !isRegularHours ? ' <span style="font-size:10px;color:var(--data-amber);">시간외</span>' : '';
      html += `<tr${futuresRowStyle}>
        <td style="padding:3px 10px;" class="gmo-sym">${item.label}${futuresLabelSuffix}</td>
        <td style="padding:3px 8px;" class="gmo-price${flashCls}">${priceFmt}</td>
        <td style="padding:3px 8px;" class="gmo-chg ${pctCls}">${pctFmt}</td>
        <td style="padding:3px 8px;" class="gmo-sig ${sig.cls}">${sig.text}</td>
      </tr>`;
      if (price != null) _gmoPrevData[item.sym] = price;
    }
  }
  tbody.innerHTML = html;

  // Update freshness dot
  updateGmoFreshness();
}

function updateGmoFreshness() {
  const dot = document.getElementById('gmo-freshness-dot');
  const timeEl = document.getElementById('gmo-update-time');
  if (!dot) return;
  const ts = window._liveQuoteTimestamp;
  if (!ts) { dot.style.background = 'var(--text-muted)'; return; }
  const age = (Date.now() - ts) / 1000;
  if (age < 15) { dot.style.background = 'var(--data-green)'; dot.classList.add('gmo-live'); }
  else if (age < 60) { dot.style.background = 'var(--data-amber)'; dot.classList.remove('gmo-live'); }
  else if (age < 180) { dot.style.background = 'var(--data-amber)'; dot.classList.remove('gmo-live'); }
  else { dot.style.background = 'var(--data-red)'; dot.classList.remove('gmo-live'); }
  if (timeEl) {
    const d = new Date(ts);
    timeEl.textContent = d.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

// Initialize GMO on page load + live data events
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: register() 호출만 DOMContentLoaded 래핑(P556/R247 템플릿) — 아래
// setTimeout(renderGmoTable, 2000)는 2초 지연이라 defer 완료 후에만 실행되므로 원래도 안전.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-gmo-live', 'aio:liveQuotes', renderGmoTable);
});
setTimeout(renderGmoTable, 2000);

// v50.5: 꼬리위험 지표(SKEW/MOVE) live→data-snap 브릿지.
// ^SKEW(기존 fetch)·^MOVE(v50.5 신규 fetch) 라이브 값을 data-snap 정적 sink에 흘리고
// DATA_SNAPSHOT 미러를 갱신해 NARRATIVE_ENGINE 레짐도 live 기준으로 분류.
// 미fetch(CORS 차단 등) 시 _liveData에 값이 없으므로 정적 폴백 유지 — 안전한 no-op.
function _aioBridgeVolIndicesLive() {
  try {
    var ld = window._liveData || {};
    var S = window.DATA_SNAPSHOT || {};
    function _bridge(sym, snapKey, mirrorKey, digits) {
      var e = ld[sym];
      if (!e || e.price == null || !isFinite(e.price)) return;
      var v = e.price;
      if (mirrorKey && S) S[mirrorKey] = v;
      document.querySelectorAll('[data-snap="' + snapKey + '"]').forEach(function(el) {
        if (el.closest('[data-aio-archive="true"]')) return;
        el.textContent = v.toFixed(digits);
        el.setAttribute('data-source-kind', 'live');
        el.setAttribute('data-operational-use', 'decision');
        el.setAttribute('data-source-label', 'yahoo:' + sym);
      });
    }
    _bridge('^SKEW', 'skew', 'skew', 2);
    _bridge('^MOVE', 'move', 'move', 2);
    _bridge('^VVIX', 'vvix', 'vvix', 2);
    if (typeof NARRATIVE_ENGINE !== 'undefined' && typeof NARRATIVE_ENGINE.renderTailRiskBoard === 'function') NARRATIVE_ENGINE.renderTailRiskBoard();
  } catch (e) { if (window._aioLog) window._aioLog('warn', 'render', 'vol-indices bridge: ' + (e && e.message)); }
}
// v51.99/Phase3[A2]: register() 호출만 DOMContentLoaded 래핑(P556/R247 템플릿) — 아래
// setTimeout(_aioBridgeVolIndicesLive, 2200)은 2.2초 지연이라 defer 완료 후에만 실행되므로 원래도 안전.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-vol-indices-live', 'aio:liveQuotes', _aioBridgeVolIndicesLive);
});
setTimeout(_aioBridgeVolIndicesLive, 2200);
window._aioBridgeVolIndicesLive = _aioBridgeVolIndicesLive;

// ═══ v34: Keyboard Shortcuts Help Modal ═══════════════════════════════
function openKbdHelp() {
  const m = document.getElementById('kbd-shortcuts-modal');
  if (m) {
    m._aioPreviousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if (m._aioTrapCleanup) m._aioTrapCleanup();
    m.classList.add('active');
    m._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(m, closeKbdHelp) : null;
    var fb = m.querySelector('button'); if (fb) fb.focus();
  }
}
function closeKbdHelp() {
  const m = document.getElementById('kbd-shortcuts-modal');
  if (m) {
    m.classList.remove('active');
    if (m._aioTrapCleanup) { m._aioTrapCleanup(); m._aioTrapCleanup = null; }
    var previousFocus = m._aioPreviousFocus;
    m._aioPreviousFocus = null;
    if (previousFocus && document.contains(previousFocus) && !previousFocus.disabled) { try { previousFocus.focus(); } catch (_) {} }
  }
}

// ═══ v34: Enhanced Keyboard Navigation ═══════════════════════════════
document.addEventListener('keydown', function(e) {
  // Don't fire shortcuts when typing in inputs
  const tag = (e.target.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

  // ESC always works — closes modals and mobile menu
  if (e.key === 'Escape') {
    closeKbdHelp();
    var glossary = document.getElementById('glossary-modal');
    if (glossary && glossary.style.display !== 'none') {
      if (typeof window._aioCloseGlossary === 'function') window._aioCloseGlossary();
      else glossary.style.display = 'none';
      return;
    }
    // AI 패널 Escape 닫기
    var aiPanel = document.getElementById('ai-panel');
    if (aiPanel && aiPanel.classList.contains('open')) {
      if (typeof toggleAIPanel === 'function') toggleAIPanel();
      return;
    }
    closeMobileMenu();
    return;
  }

  // Ctrl+K for quick search focus (works even in inputs)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var searchInput = document.querySelector('.search-bar input');
    if (searchInput) searchInput.focus();
    return;
  }

  // All other shortcuts only when NOT in input
  if (isInput) return;

  // ? = show shortcuts help
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault();
    const m = document.getElementById('kbd-shortcuts-modal');
    if (m && m.classList.contains('active')) closeKbdHelp();
    else openKbdHelp();
    return;
  }

  // Number keys 1-8 = page navigation
  const pageMap = { '1':'home', '2':'signal', '3':'briefing', '4':'macro', '5':'market-news', '6':'portfolio', '7':'screener', '8':'themes' }; // v53.7 (P725): kr-home 퇴역
  if (pageMap[e.key]) {
    e.preventDefault();
    if (typeof showPage === 'function') showPage(pageMap[e.key], null);
    return;
  }

  // G = toggle global market overview expand
  if (e.key === 'g' || e.key === 'G') {
    e.preventDefault();
    toggleGmoExpand();
    return;
  }

  // R = refresh live data
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    if (typeof fetchLiveQuotes === 'function') fetchLiveQuotes();
    return;
  }
});

// ═════════════════════════════════════════════════════════════════
// NEW FUNCTIONS: Enhanced Technical Analysis Features
// ═════════════════════════════════════════════════════════════════

// Enhance computeMarketHealth with M7 and Breadth rendering
(function() {
  var originalComputeMarketHealth = computeMarketHealth;
  computeMarketHealth = function() {
    var result = originalComputeMarketHealth.call(this);

    let ld = window._liveData || {};
    var m7 = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA'];
    var sectorETFs = ['XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC'];

    // Render M7 health dots
    var m7html = '';
    m7.forEach(function(t) {
      var d = ld[t];
      var chg = d && d.pct != null ? d.pct : null;
      var dotColor = chg !== null ? (chg > 0.5 ? 'var(--data-green)' : chg > 0 ? 'var(--data-amber)' : chg > -0.5 ? 'var(--data-red)' : '#b13a30') : '#8a8271';
      var title = chg !== null ? (t + ' ' + (chg > 0 ? '+' : '') + chg.toFixed(2) + '%') : (t + ' —');
      m7html += '<span title="' + title + '" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + dotColor + ';border:1px solid rgba(33,29,22,0.2);margin-right:4px;cursor:pointer;"></span>';
    });
    // v48.50: M7 리더십 technical + themes 미러 동시 업데이트
    document.querySelectorAll('#m7-health-row, #themes-m7-mirror, .m7-leadership-row').forEach(function(el){
      if (el) el.innerHTML = m7html;
    });

    // Render Market Breadth
    var secUp = 0, secTot = 0;
    sectorETFs.forEach(function(t) {
      var d = ld[t];
      if (d) { secTot++; if ((d.pct != null ? d.pct : 0) > 0) secUp++; }
    });
    // 이 값은 실제 50일선 상회율이 아니라 당일 섹터 ETF 상승 비율이다. 결측 시 50%를 만들지 않는다.
    var above50ma = secTot >= 6 ? Math.round((secUp / secTot) * 100) : null;
    // v48.50: breadth-bar + themes-breadth-bar 동시 동기화
    document.querySelectorAll('#breadth-bar, #themes-breadth-bar, .breadth-bar-sync').forEach(function(el){
      if (el) el.style.width = above50ma === null ? '0%' : above50ma + '%';
    });
    document.querySelectorAll('#breadth-pct, #themes-breadth-pct, .breadth-pct-sync').forEach(function(el){
      if (el) { el.textContent = above50ma === null ? '—' : above50ma + '%'; el.title = above50ma === null ? '섹터 ETF 현재값 부족' : '당일 섹터 ETF 상승 비율 · 50일선 상회율 아님'; }
    });

    return result;
  };
})();

// Ticker Analysis Deep Dive
// ═══ v27.1: Ticker Detail — Price Chart 렌더링 ═══════════════════
var _tickerChartInstance = null;
var _currentTickerSym = '';

function loadTickerChart(period, btn) {
  if (btn) {
    document.querySelectorAll('#ticker-chart-period-tabs .news-sort-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  }
  var sym = _currentTickerSym || 'NVDA';
  var daysMap = {'1m':30, '3m':90, '6m':180, '1y':365};
  var days = daysMap[period] || 90;
  var canvas = document.getElementById('ticker-price-chart');
  var loading = document.getElementById('ticker-chart-loading');
  if (!canvas) return;
  if (canvas.closest && canvas.closest('#page-ticker[data-aio-ticker-chart-renderer="native"]')) return;
  if (loading) loading.style.display = 'flex';

  // 시세 데이터 가져오기 시도
  (async function() {
    var chartData = null;
    try {
      chartData = await fetchStooqChart(sym, days);
    } catch(e) {}

    // 관측 이력이 없으면 차트를 보류한다. 현재가 주변의 난수 시계열은 실제 가격 이력처럼 보일 수 있어 금지.
    if (!chartData || !chartData.labels || chartData.labels.length < 2) {
      if (_tickerChartInstance) { _tickerChartInstance.destroy(); _tickerChartInstance = null; }
      if (loading) {
        loading.style.display = 'flex';
        loading.textContent = sym + ' 관측 가격 이력 미수신 · 합성 차트를 표시하지 않습니다';
      }
      return;
    }

    if (loading) loading.style.display = 'none';
    if (_tickerChartInstance) { _tickerChartInstance.destroy(); _tickerChartInstance = null; }

    // v30.11: 차트 데이터 검증 게이트
    var gated = chartDataGate('ticker-price-chart', chartData.labels, [chartData.prices], { minPoints: 5, chartName: sym + ' 가격차트', fillMode: 'prev' });
    if (!gated) return;
    chartData.labels = gated.labels;
    chartData.prices = gated.datasets[0];

    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.offsetHeight || 300);
    var lastP = chartData.prices[chartData.prices.length - 1];
    var firstP = chartData.prices[0];
    var isUp = lastP >= firstP;
    grad.addColorStop(0, isUp ? 'rgba(34,117,76,0.25)' : 'rgba(177,58,48,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    _tickerChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          data: chartData.prices,
          borderColor: isUp ? 'var(--data-green)' : 'var(--data-red)',
          backgroundColor: grad,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fbf9f5',
            titleColor: '#211d16',
            bodyColor: '#57513f',
            borderColor: 'rgba(33,29,22,0.15)',
            borderWidth: 1,
            callbacks: {
              label: function(c) { return '$' + c.parsed.y.toFixed(2); }
            }
          }
        },
        scales: {
          x: { display: true, grid: { color: 'var(--surface-3)' }, ticks: { color: '#8a8271', font: { size: 11 }, maxTicksLimit: 8 } },
          y: { display: true, grid: { color: 'var(--surface-3)' }, ticks: { color: '#8a8271', font: { size: 11 }, callback: function(v) { return '$' + v; } } }
        },
        interaction: { mode: 'index', intersect: false }
      }
    });
  })();
}

// v30.10: 빈 DOMContentLoaded 핸들러 제거 (메모리 절약)
// switchTab wrapping은 불필요 — showPage에서 이미 처리됨

// ═══════════════════════════════════════════════════════════════════════
// COMPREHENSIVE TECHNICAL ANALYSIS ENGINE v1.0
// Ports Python screener analysis functions to JavaScript
// ═══════════════════════════════════════════════════════════════════════

// Weinstein Stage Detection
function _detectStage(o, h, l, c, v) {
  if (c.length < 250) return { stage: 0, label: '데이터 부족', confidence: 0 };

  var sma150 = _calcSMA(c, 150);
  var sma50 = _calcSMA(c, 50);
  var sma20 = _calcSMA(c, 20);
  var currentPrice = c[c.length - 1];
  var sma150Prev = c.length > 250 ? _calcSMA(c.slice(0, -1), 150) : sma150;

  var isAbove150 = currentPrice > sma150;
  var is150Rising = sma150 > sma150Prev;
  // v46.9: 30주 MA 수평화 감지 (Stage 1 핵심 조건) — 기울기 < 0.5%이면 flat
  var is150Flat = Math.abs(sma150 - sma150Prev) / (sma150Prev || 1) < 0.005;
  var isAbove50 = currentPrice > sma50;
  var sma50Prev = _calcSMA(c.slice(0, -1), 50);
  var is50Rising = sma50 > sma50Prev;

  // Calculate higher lows (Stage 1) and higher highs (Stage 2) — v46.9: 0-falsy 방어
  var highs = h.slice(-50);
  var lows = l.slice(-50);
  var higherLows = true, higherHighs = true;
  for (var i = 1; i < Math.min(highs.length, 20); i++) {
    var li = lows.length - i - 5, lj = lows.length - i;
    var hi = highs.length - i - 5, hj = highs.length - i;
    if (li >= 0 && lj >= 0 && lows[li] != null && lows[lj] != null && lows[lj] <= lows[li]) higherLows = false;
    if (hi >= 0 && hj >= 0 && highs[hi] != null && highs[hj] != null && highs[hj] <= highs[hi]) higherHighs = false;
  }

  var stage, label, confidence;

  // v46.9: Stage 1에 MA 수평화 조건 추가 (와인스타인 표준)
  if (!isAbove150 && (is150Flat || !is150Rising) && higherLows) {
    stage = 1;
    label = '바닥 다지기';
    confidence = higherLows ? 0.8 : 0.5;
  } else if (isAbove150 && is150Rising && higherHighs) {
    stage = 2;
    label = '상승 추세';
    confidence = higherHighs && is150Rising ? 0.9 : 0.7;
  } else if (isAbove150 && !is150Rising && isAbove50) {
    stage = 3;
    label = '천장 형성';
    confidence = !is150Rising ? 0.8 : 0.5;
  } else if (!isAbove150 && !is150Rising) {
    stage = 4;
    label = '하락 추세';
    confidence = !is150Rising ? 0.85 : 0.6;
  } else {
    stage = 2;
    label = '상승 추세';
    confidence = 0.6;
  }

  return { stage: stage, label: label, confidence: confidence };
}

// Trend Position Detection
function _detectTrendPosition(o, h, l, c, v) {
  if (c.length < 50) return { position: '데이터부족', positionKo: '데이터 부족', alignment: 0, gapFrom20: 0 };

  var ema5 = _calcEMA(c, 5);
  var ema10 = _calcEMA(c, 10);
  var ema20 = _calcEMA(c, 20);
  var sma50 = _calcSMA(c, 50);
  var currentPrice = c[c.length - 1];

  // v46.9: 데이터 부족 시 52주 범위 과소평가 방지 — 최소 100일 필요
  var _52slice = c.slice(-252);
  var low52w = Math.min.apply(null, _52slice);
  var high52w = Math.max.apply(null, _52slice);
  var week52Range = high52w - low52w;
  var week52Position = (week52Range > 0 && _52slice.length >= 100) ? ((currentPrice - low52w) / week52Range) * 100 : 50;

  var fullAlign = ema5 > ema10 && ema10 > ema20 && ema20 > sma50;
  // v46.9: 부분 정배열 퍼센트 (0~100)
  var alignCount = (ema5 > ema10 ? 1 : 0) + (ema10 > ema20 ? 1 : 0) + (ema20 > sma50 ? 1 : 0);
  var alignPct = Math.round(alignCount / 3 * 100);
  var gapFrom20 = ((currentPrice - ema20) / ema20) * 100;

  var position;
  if (fullAlign && gapFrom20 > 5) {
    position = '과열';
  } else if (fullAlign && gapFrom20 > 2) {
    position = '후반';
  } else if (fullAlign && gapFrom20 > 0) {
    position = '중반';
  } else if (fullAlign) {
    position = '초반';
  } else if (!fullAlign && currentPrice < ema20) {
    position = '조정중';
  } else {
    position = '전환준비';
  }

  return {
    position: position,
    positionKo: position,
    alignment: alignPct, // v46.9: 0/33/67/100 (이전 이진 50/100)
    gapFrom20: gapFrom20,
    week52: Math.round(week52Position),
    ema5: ema5,
    ema10: ema10,
    ema20: ema20,
    sma50: sma50
  };
}

// Dip Classification
function _classifyDip(o, h, l, c, v) {
  if (c.length < 50) return { classification: '데이터부족', label: '데이터부족', score: 50, reasoning: '50일 미만 데이터 — 분류 보류' };

  var sma50 = _calcSMA(c, 50);
  var sma20 = _calcSMA(c, 20);
  var currentPrice = c[c.length - 1];
  var priceAbove50 = currentPrice > sma50;

  var score = 50;

  // Support check
  if (priceAbove50) score += 3;
  else score -= 4;

  // Volume shrinking
  var avgVol = 0;
  for (var i = 0; i < Math.min(20, v.length); i++) avgVol += v[v.length - 1 - i];
  avgVol = avgVol / Math.min(20, v.length);
  if (v[v.length - 1] < avgVol) score += 2;
  else score -= 2;

  // Higher lows
  var lows = l.slice(-10);
  var higherLows = true;
  for (var i = 1; i < lows.length - 1; i++) {
    if (lows[i] <= lows[i - 1]) higherLows = false;
  }
  if (higherLows) score += 2;
  else score -= 2;

  // Retracement depth
  var high20 = Math.max.apply(null, h.slice(-20));
  var retracePct = ((high20 - currentPrice) / high20) * 100;
  if (retracePct < 5) score += 1;
  else if (retracePct > 15) score -= 2;

  score = Math.max(0, Math.min(100, score));

  var classification;
  if (score >= 70) classification = '건전한조정';
  else if (score >= 50) classification = '조정(관망)';
  else if (score >= 30) classification = '주의';
  else classification = '추세전환위험';

  // v50.20: 표시 코드(label/reasoning) 대응 — 이전엔 {classification,score}만 반환해 'undefined' 렌더
  var reasoning = (priceAbove50 ? '50일선 위(추세 유지)' : '50일선 아래(추세 훼손 주의)')
    + ' · ' + (retracePct < 5 ? '얕은 조정' : retracePct > 15 ? '깊은 조정(>15%)' : '중간 조정 ' + retracePct.toFixed(1) + '%')
    + ' · ' + (higherLows ? '저점 높아짐' : '저점 낮아짐')
    + (v[v.length - 1] < avgVol ? ' · 거래량 감소' : ' · 거래량 증가');
  return { classification: classification, label: classification, score: score, reasoning: reasoning };
}

// Entry Quality Assessment
function _assessEntryQuality(o, h, l, c, v) {
  if (c.length < 50) return { grade: 'N/A', score: 0 };

  var trend = _detectTrendPosition(o, h, l, c, v);
  var price = c[c.length - 1];
  var ema20 = trend.ema20;
  var sma50 = trend.sma50;
  var rsi = _calcRSILast(c, 14) ?? 50; // null→50 폴백

  var gap20 = Math.abs(trend.gapFrom20);
  var score = 0;
  var reasoning = [];

  // Alignment score
  if (trend.alignment > 80) {
    score += 4;
    reasoning.push('정배열');
  }

  // Distance from 20EMA
  if (gap20 < 1.5) {
    score += 3;
    reasoning.push('20EMA 터치');
  } else if (gap20 < 3) {
    score += 2;
    reasoning.push('20EMA 근처');
  }

  // Volume
  var avgVol = 0;
  for (var i = 0; i < Math.min(10, v.length); i++) avgVol += v[v.length - 1 - i];
  avgVol = avgVol / Math.min(10, v.length);
  if (v[v.length - 1] < avgVol * 0.8) {
    score += 2;
    reasoning.push('거래량 위축');
  }

  // RSI
  if (rsi > 30 && rsi < 70) {
    score += 1;
    reasoning.push('RSI 정상');
  } else if (rsi > 70) {
    score -= 2;
    reasoning.push('과매수');
  }

  // Gap from entry
  if (trend.gapFrom20 > 8) {
    score -= 3;
    reasoning.push('조정 대기');
  }

  score = Math.max(0, Math.min(10, score));

  var grade;
  if (score >= 8) grade = 'A+';
  else if (score >= 6) grade = 'A';
  else if (score >= 5) grade = 'B';
  else if (score >= 3) grade = 'C';
  else grade = 'D';

  return { grade: grade, score: score, reasoning: reasoning.join(' / ') };
}

// Cross Signals Detection
function _detectCrossSignals(c) {
  if (c.length < 200) return { crossStatus: '데이터부족', gc20_50: null, gc50_200: null, pairs: [] };

  function sma(n, arr) { return _calcSMA(arr || c, n); }
  var mas = { 5: sma(5), 10: sma(10), 20: sma(20), 50: sma(50), 100: sma(100), 200: sma(200) };
  var prev = {};
  [5,10,20,50,100,200].forEach(function(n) { prev[n] = c.length > n + 1 ? sma(n, c.slice(0, -1)) : mas[n]; });
  function pair(shortN, longN) {
    var nowShort = mas[shortN], nowLong = mas[longN], prevShort = prev[shortN], prevLong = prev[longN];
    var signal = null;
    if (prevShort <= prevLong && nowShort > nowLong) signal = '골든크로스';
    else if (prevShort >= prevLong && nowShort < nowLong) signal = '데드크로스';
    return { pair: shortN + '/' + longN, shortN: shortN, longN: longN, signal: signal, spreadPct: nowLong ? (nowShort - nowLong) / nowLong * 100 : 0 };
  }
  var pairs = [pair(5,10), pair(10,20), pair(20,50), pair(50,100), pair(50,200), pair(100,200)];
  var liveSignals = pairs.filter(function(p) { return !!p.signal; });
  var crossStatus = liveSignals.length ? liveSignals.map(function(p) { return p.pair + ' ' + p.signal; }).join(' · ') : '평탄';

  return {
    crossStatus: crossStatus,
    gc20_50: pairs[2].signal,
    gc50_200: pairs[4].signal,
    gc50_100: pairs[3].signal,
    gc100_200: pairs[5].signal,
    pairs: pairs,
    sma5: mas[5],
    sma10: mas[10],
    sma20: mas[20],
    sma50: mas[50],
    sma100: mas[100],
    sma200: mas[200]
  };
}

// RSI Divergence Detection
function _detectDivergence(c) {
  if (c.length < 30) return { bearishDiv: false, bullishDiv: false };

  var rsis = [];
  for (var i = Math.max(0, c.length - 30); i < c.length; i++) {
    var windowPrices = c.slice(Math.max(0, i - 13), i + 1);
    if (windowPrices.length >= 14) rsis.push(_calcRSILast(windowPrices, 14));
  }

  var prices = c.slice(-30);
  var lastRsi = rsis[rsis.length - 1];
  var prevRsi = rsis.length > 1 ? rsis[rsis.length - 2] : lastRsi;

  var highIdx = prices.length - 1;
  var highRsiIdx = rsis.length - 1;
  for (var i = prices.length - 1; i >= Math.max(0, prices.length - 10); i--) {
    if (prices[i] >= prices[highIdx]) highIdx = i;
    if (rsis[i - (prices.length - rsis.length)] >= rsis[highRsiIdx]) highRsiIdx = i - (prices.length - rsis.length);
  }

  var bearishDiv = prices[prices.length - 1] > prices[highIdx] && lastRsi < prevRsi;
  var bullishDiv = prices[prices.length - 1] < Math.min.apply(null, prices.slice(-10)) && lastRsi > prevRsi;

  return { bearishDiv: bearishDiv, bullishDiv: bullishDiv, rsi: lastRsi };
}

function _fmtTechPrice(v) {
  return v != null && isFinite(v) ? Number(v).toFixed(Math.abs(v) >= 100 ? 2 : 2) : '—';
}

function _fmtTechPct(v) {
  return v != null && isFinite(v) ? (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%' : '—';
}

function _calcMinerviniMAStack(c) {
  var periods = [5, 10, 20, 50, 100, 200];
  if (!c || c.length < 200) return { status: '데이터 부족', periods: periods, mas: {}, score: 0, shortState: '단기 데이터 부족', longState: '장기 데이터 부족', aboveCount: 0, risingCount: 0, defects: ['200일 미만 데이터'] };
  var mas = {}, prev = {}, slopes = {};
  periods.forEach(function(p) {
    mas[p] = _calcSMA(c, p);
    prev[p] = c.length > p + 10 ? _calcSMA(c.slice(0, -10), p) : mas[p];
    slopes[p] = prev[p] ? (mas[p] - prev[p]) / prev[p] * 100 : 0;
  });
  var price = c[c.length - 1];
  var shortBull = mas[5] > mas[10] && mas[10] > mas[20];
  var shortBear = mas[5] < mas[10] && mas[10] < mas[20];
  var longBull = mas[50] > mas[100] && mas[100] > mas[200];
  var longBear = mas[50] < mas[100] && mas[100] < mas[200];
  var fullBull = shortBull && mas[20] > mas[50] && longBull;
  var fullBear = shortBear && mas[20] < mas[50] && longBear;
  var shortState = shortBull ? '단기 정배열 5>10>20' : shortBear ? '단기 역배열 5<10<20' : '단기 혼조';
  var longState = longBull ? '장기 정배열 50>100>200' : longBear ? '장기 역배열 50<100<200' : '장기 혼조';
  var fullState = fullBull ? '완전 정배열' : fullBear ? '완전 역배열' : '부분 정렬';
  var aboveCount = periods.reduce(function(n, p) { return n + (price > mas[p] ? 1 : 0); }, 0);
  var risingCount = periods.reduce(function(n, p) { return n + (slopes[p] > 0 ? 1 : 0); }, 0);
  var orderScore = (shortBull ? 20 : shortBear ? 0 : 10) + (longBull ? 25 : longBear ? 0 : 12) + (fullBull ? 20 : fullBear ? 0 : 8);
  var score = Math.round(Math.max(0, Math.min(100, orderScore + aboveCount * 4 + risingCount * 3)));
  var defects = [];
  if (!shortBull) defects.push(shortBear ? '단기 역배열' : '단기 배열 미완성');
  if (!longBull) defects.push(longBear ? '장기 역배열' : '장기 배열 미완성');
  if (price < mas[50]) defects.push('가격 50일선 하회');
  if (price < mas[200]) defects.push('가격 200일선 하회');
  return { status: fullState, periods: periods, mas: mas, slopes: slopes, score: score, shortState: shortState, longState: longState, fullBull: fullBull, fullBear: fullBear, aboveCount: aboveCount, risingCount: risingCount, defects: defects };
}

function _buildHorizontalVolumeZones(h, l, c, v, lookback, binsCount) {
  lookback = lookback || 160;
  binsCount = binsCount || 28;
  if (!h || !l || !c || !v || c.length < 40) return null;
  var start = Math.max(0, c.length - lookback);
  var rows = [];
  for (var i = start; i < c.length; i++) {
    var hi = h[i], lo = l[i], close = c[i], vol = v[i];
    if (hi == null || lo == null || close == null || !isFinite(hi) || !isFinite(lo) || !isFinite(close)) continue;
    rows.push({ hi: hi, lo: lo, close: close, vol: vol != null && isFinite(vol) ? Math.max(0, vol) : 0, price: (hi + lo + close) / 3 });
  }
  if (rows.length < 30) return null;
  var minP = Math.min.apply(null, rows.map(function(d) { return d.lo; }));
  var maxP = Math.max.apply(null, rows.map(function(d) { return d.hi; }));
  var span = maxP - minP;
  if (!(span > 0)) return null;
  var step = span / binsCount;
  var bins = [];
  for (var bi = 0; bi < binsCount; bi++) bins.push({ lo: minP + step * bi, hi: minP + step * (bi + 1), mid: minP + step * (bi + 0.5), vol: 0, count: 0 });
  rows.forEach(function(d) {
    var idx = Math.max(0, Math.min(binsCount - 1, Math.floor((d.price - minP) / step)));
    bins[idx].vol += d.vol || 1;
    bins[idx].count += 1;
  });
  var totalVol = bins.reduce(function(s, b) { return s + b.vol; }, 0) || 1;
  bins.forEach(function(b) { b.share = b.vol / totalVol; });
  var sorted = bins.slice().sort(function(a, b) { return b.vol - a.vol; });
  var poc = sorted[0];
  var vaVol = 0, vaBins = [];
  for (var vi = 0; vi < sorted.length && vaVol / totalVol < 0.7; vi++) {
    vaBins.push(sorted[vi]);
    vaVol += sorted[vi].vol;
  }
  var valueArea = {
    lo: Math.min.apply(null, vaBins.map(function(b) { return b.lo; })),
    hi: Math.max.apply(null, vaBins.map(function(b) { return b.hi; })),
    share: vaVol / totalVol
  };
  var current = c[c.length - 1];
  var zones = sorted.slice(0, 8).map(function(b) {
    return { lo: b.lo, hi: b.hi, mid: b.mid, share: b.share, count: b.count, distancePct: current ? (b.mid - current) / current * 100 : 0 };
  }).sort(function(a, b) { return a.mid - b.mid; });
  var support = zones.filter(function(z) { return z.hi <= current * 0.995; }).sort(function(a, b) { return b.mid - a.mid; });
  var resistance = zones.filter(function(z) { return z.lo >= current * 1.005; }).sort(function(a, b) { return a.mid - b.mid; });
  var inside = zones.filter(function(z) { return z.lo <= current && z.hi >= current; });
  var nearestSupport = support[0] || null;
  var nearestResistance = resistance[0] || null;
  var supplyPressure = nearestResistance ? Math.max(0, 100 - Math.abs(nearestResistance.distancePct) * 12) : inside.length ? 75 : 25;
  return {
    lookback: rows.length,
    poc: poc ? { lo: poc.lo, hi: poc.hi, mid: poc.mid, share: poc.share } : null,
    valueArea: valueArea,
    zones: zones,
    support: support.slice(0, 3),
    resistance: resistance.slice(0, 3),
    inside: inside,
    nearestSupport: nearestSupport,
    nearestResistance: nearestResistance,
    supplyPressure: Math.round(Math.max(0, Math.min(100, supplyPressure))),
    beginnerNote: 'POC는 거래량이 가장 많이 쌓인 가격대입니다. 현재가 위의 고거래량 구간은 본전 매도와 차익실현이 나올 수 있는 저항, 아래 구간은 방어와 손절 기준 후보입니다.'
  };
}

function _calcFibonacciConfluence(h, l, c, volumeZones) {
  if (!h || !l || !c || c.length < 60) return null;
  var start = Math.max(0, c.length - 160);
  var hs = h.slice(start), ls = l.slice(start);
  var swingHigh = Math.max.apply(null, hs);
  var swingLow = Math.min.apply(null, ls);
  var range = swingHigh - swingLow;
  if (!(range > 0)) return null;
  var current = c[c.length - 1];
  var ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
  var levels = ratios.map(function(r) {
    var price = swingHigh - range * r;
    var dist = current ? (price - current) / current * 100 : 0;
    return { ratio: r, label: Math.round(r * 1000) / 10 + '%', price: price, distancePct: dist };
  }).sort(function(a, b) { return Math.abs(a.distancePct) - Math.abs(b.distancePct); });
  var nearest = levels[0];
  var confluence = null;
  if (volumeZones && volumeZones.zones) {
    var allZones = volumeZones.zones.slice();
    var matches = allZones.filter(function(z) { return Math.abs((z.mid - nearest.price) / nearest.price * 100) <= 1.5; });
    if (matches.length) confluence = { level: nearest, zone: matches[0], note: '피보나치 되돌림과 수평 매물대가 1.5% 이내 중첩' };
  }
  return { swingHigh: swingHigh, swingLow: swingLow, nearest: nearest, levels: levels.slice(0, 3), confluence: confluence };
}

function _calcVcpQuality(h, l, c, v) {
  if (!h || !l || !c || c.length < 70) return { label: '데이터 부족', score: 0, ranges: { r60: 0, r30: 0, r15: 0 }, volDry: false, contracting: false, pivot: null, breakout: false };
  function rangePct(n) {
    var hs = h.slice(-n), ls = l.slice(-n);
    var hi = Math.max.apply(null, hs), lo = Math.min.apply(null, ls);
    return hi ? (hi - lo) / hi * 100 : 0;
  }
  function avgVol(n) {
    var arr = v.slice(-n).filter(function(x) { return x != null && isFinite(x); });
    return arr.length ? arr.reduce(function(s, x) { return s + x; }, 0) / arr.length : 0;
  }
  var r60 = rangePct(60), r30 = rangePct(30), r15 = rangePct(15);
  var vol10 = avgVol(10), vol50 = avgVol(50);
  var contracting = r15 < r30 && r30 < r60;
  var volDry = vol50 ? vol10 < vol50 * 0.85 : false;
  var pivot = Math.max.apply(null, h.slice(-20));
  var current = c[c.length - 1];
  var breakout = current > pivot * 0.995 && vol50 ? (v[v.length - 1] || 0) > vol50 * 1.25 : false;
  var score = (contracting ? 45 : 15) + (volDry ? 25 : 5) + (breakout ? 20 : 0) + (r15 < 8 ? 10 : 0);
  score = Math.round(Math.max(0, Math.min(100, score)));
  var label = score >= 75 ? 'VCP 우수' : score >= 55 ? 'VCP 관찰' : 'VCP 미완성';
  return { label: label, score: score, ranges: { r60: r60, r30: r30, r15: r15 }, volDry: volDry, contracting: contracting, pivot: pivot, breakout: breakout };
}

function _buildMinerviniTechnicalEngine(o, h, l, c, v) {
  var ma = _calcMinerviniMAStack(c);
  var stage = _detectStage(o, h, l, c, v);
  var entry = _assessEntryQuality(o, h, l, c, v);
  var crosses = _detectCrossSignals(c);
  var volumeZones = _buildHorizontalVolumeZones(h, l, c, v, 160, 28);
  var fib = _calcFibonacciConfluence(h, l, c, volumeZones);
  var vcp = _calcVcpQuality(h, l, c, v);
  var current = c[c.length - 1];
  var score = 0;
  score += Math.round(ma.score * 0.32);
  score += stage.stage === 2 ? 18 : stage.stage === 1 ? 8 : stage.stage === 3 ? 4 : 0;
  score += Math.round((entry.score || 0) * 1.2);
  score += Math.round((vcp.score || 0) * 0.18);
  if (volumeZones) {
    if (!volumeZones.nearestResistance || Math.abs(volumeZones.nearestResistance.distancePct) > 5) score += 10;
    if (volumeZones.nearestSupport && Math.abs(volumeZones.nearestSupport.distancePct) <= 8) score += 7;
    if (volumeZones.inside && volumeZones.inside.length) score -= 5;
  }
  if (fib && fib.confluence) score += 4;
  score = Math.round(Math.max(0, Math.min(100, score)));
  var riskFlags = [];
  (ma.defects || []).slice(0, 3).forEach(function(x) { riskFlags.push(x); });
  if (volumeZones && volumeZones.nearestResistance && Math.abs(volumeZones.nearestResistance.distancePct) <= 3) riskFlags.push('상단 수평 매물대 근접');
  if (vcp && !vcp.contracting) riskFlags.push('변동성 수렴 미흡');
  if (stage.stage >= 3) riskFlags.push('분배/하락 스테이지');
  var verdict = score >= 78 ? '기관급 후보' : score >= 62 ? '선별 관찰' : score >= 45 ? '조건부 관망' : '진입 보류';
  return { score: score, verdict: verdict, ma: ma, stage: stage, entry: entry, crosses: crosses, volumeZones: volumeZones, fib: fib, vcp: vcp, current: current, riskFlags: riskFlags };
}

// Fetch 1-year daily chart data from Yahoo Finance
// v48.14: 동적 ETF 성과 테이블 갱신 (Agent P1-13 대응)
// data-perf-ytd·data-perf-1y 속성이 있는 모든 DOM을 Yahoo API로 자동 갱신
async function _updatePerfTable(forceTickers) {
  try {
    var targets = Array.from(document.querySelectorAll('[data-perf-ytd],[data-perf-1y]'));
    var tickerSet = {};
    targets.forEach(function(el) {
      var t = el.getAttribute('data-perf-ytd') || el.getAttribute('data-perf-1y');
      if (t) tickerSet[t] = true;
    });
    if (forceTickers && Array.isArray(forceTickers)) {
      forceTickers.forEach(function(t) { tickerSet[t] = true; });
    }
    var tickers = Object.keys(tickerSet);
    for (var idx = 0; idx < tickers.length; idx++) {
      var sym = tickers[idx];
      try {
        var ytdData = await _fetchYahooChartData(sym, 'ytd');
        var y1Data = await _fetchYahooChartData(sym, '1y');
        var ytdPct = null, y1Pct = null;
        if (ytdData && ytdData.closes) {
          var cYtd = ytdData.closes.filter(function(v){return v!=null && isFinite(v);});
          if (cYtd.length >= 2) ytdPct = (cYtd[cYtd.length-1] - cYtd[0]) / cYtd[0] * 100;
        }
        if (y1Data && y1Data.closes) {
          var c1y = y1Data.closes.filter(function(v){return v!=null && isFinite(v);});
          if (c1y.length >= 2) y1Pct = (c1y[c1y.length-1] - c1y[0]) / c1y[0] * 100;
        }
        // DOM 갱신
        document.querySelectorAll('[data-perf-ytd="' + sym + '"]').forEach(function(el) {
          if (ytdPct != null) {
            el.textContent = (ytdPct >= 0 ? '+' : '') + ytdPct.toFixed(1) + '%';
            el.style.color = ytdPct >= 0 ? 'var(--green)' : 'var(--red)';
          } else {
            el.textContent = 'N/A';
            el.style.color = 'var(--text-muted)';
          }
        });
        document.querySelectorAll('[data-perf-1y="' + sym + '"]').forEach(function(el) {
          if (y1Pct != null) {
            el.textContent = (y1Pct >= 0 ? '+' : '') + y1Pct.toFixed(1) + '%';
            el.style.color = y1Pct >= 0 ? 'var(--green)' : 'var(--red)';
          } else {
            el.textContent = 'N/A';
            el.style.color = 'var(--text-muted)';
          }
        });
      } catch(e) { _aioLog('warn', 'render', '_updatePerfTable ticker 실패: ' + sym + ' ' + e.message); }
    }
  } catch(e) { _aioLog('warn', 'render', '_updatePerfTable 실패: ' + e.message); }
}

// P1132/R619: 여기 있던 3줄짜리 위임 래퍼를 제거했다. 이 래퍼는 index.html 인라인 시절에도
// **항상 덮어써지는 죽은 코드**였다 — aio-data.js(디퍼)가 `window._fetchYahooChartData =
// _aioFetchYahooChartData`로 전역을 재할당하는데, 인라인 선언은 파싱 시점이라 나중에 지워졌다.
// 이관으로 실행 순서가 뒤집혀(디퍼 core → data → ui) 래퍼가 오히려 승자가 되면서
// `range || '1y', interval || '1d'` 기본값이 호출자에게 새로 적용됐다 — headless T1041이
// 이를 잡았다(`fetchViaProxy` 부재). 래퍼를 지워 정본 생산자 하나만 남긴다.

// Main comprehensive analysis function
async function analyzeTickerDeep(ticker) {
  ticker = String(ticker || '').trim().toUpperCase();
  if (!/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(ticker)) {
    showToast('종목을 입력하세요 (예: AAPL, NVDA)');
    return;
  }

  var resultEl = document.getElementById('ticker-analysis-result');
  if (!resultEl) return;
  var requestEpoch = window._technicalSelectionEpoch = (window._technicalSelectionEpoch || 0) + 1;
  function isCurrent() { return requestEpoch === window._technicalSelectionEpoch && window._currentTickerId === ticker; }
  window._currentTickerId = ticker;
  window._currentTickerSym = ticker;
  window._currentTickerName = ticker;
  ['ticker-analysis-input', 'deep-sym-input'].forEach(function(id) {
    var input = document.getElementById(id);
    if (input) input.value = ticker;
  });
  document.dispatchEvent(new CustomEvent('aio:entityChanged', { detail: { id: ticker, source: 'technical-selection' } }));
  if (typeof updateSRLevels === 'function') updateSRLevels();
  initDeepAnalysisSection(ticker, requestEpoch).catch(function(error) {
    if (isCurrent()) _aioLog('warn', 'fetch', 'Deep timeframe analysis: ' + error.message);
  });

  resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><div style="font-size:12px;">분석 준비: ' + escHtml(ticker) + ' 기술적 분석...</div></div>';

  try {
  // Fetch chart data
  var chartData = await _fetchYahooChartData(ticker, '1y', '1d');
  if (!isCurrent()) return;
  if (!chartData || !chartData.closes || chartData.closes.length < 50) {
    resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">차트 데이터를 불러올 수 없습니다. 종목코드를 확인하세요.</div>';
    return;
  }

  // Extract data — v46.9: 인덱스 동기화 필터링 + NaN 방어
  var _raw = chartData.closes.map(function(v, i) { return { c: v, o: chartData.opens[i], h: chartData.highs[i], l: chartData.lows[i], v: chartData.volumes[i], ts: chartData.timestamps[i] }; })
    .filter(function(d) { return [d.c, d.o, d.h, d.l, d.ts].every(function(n) { return n != null && isFinite(n) && n > 0; }) && d.h >= Math.max(d.o, d.c) && d.l <= Math.min(d.o, d.c) && d.v != null && isFinite(d.v) && d.v >= 0; });
  if (_raw.length < 50) {
    resultEl.textContent = ticker + ' — 유효한 일봉이 50개 미만입니다. 충분한 이력 수신 후 분석합니다.';
    return;
  }
  window._technicalOHLCV = window._technicalOHLCV || {};
  window._technicalOHLCV[ticker] = _raw.map(function(d) {
    return { time: new Date(d.ts * 1000).toISOString().slice(0, 10), open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v };
  });
  document.dispatchEvent(new CustomEvent('aio:entityChanged', { detail: { id: ticker, source: 'technical-ohlcv' } }));
  if (typeof updateSRLevels === 'function') updateSRLevels();
  var c = _raw.map(function(d) { return d.c; });
  var o = _raw.map(function(d) { return d.o; });
  var h = _raw.map(function(d) { return d.h != null ? d.h : d.c; });
  var l = _raw.map(function(d) { return d.l != null ? d.l : d.c; });
  var v = _raw.map(function(d) { return d.v != null && isFinite(d.v) ? d.v : 0; });

  // Run all analyses
  var stageData = _detectStage(o, h, l, c, v);
  var trendData = _detectTrendPosition(o, h, l, c, v);
  var dipData = _classifyDip(o, h, l, c, v);
  var entryData = _assessEntryQuality(o, h, l, c, v);
  var crossData = _detectCrossSignals(c);
  var divData = _detectDivergence(c);
  var rsi = _calcRSILast(c, 14);
  var macd = _calcMACD(c);
  var bb = _calcBB(c, 20, 2);
  var instEngine = _buildMinerviniTechnicalEngine(o, h, l, c, v);

  // v51.70: calcTechnicalSnapshot 연동 — RSI다이버전스·주봉컨텍스트 상세화
  var snap = null;
  try {
    if (typeof window.calcTechnicalSnapshot === 'function' && _raw.length >= 60) {
      var _snapBars = _raw.map(function(d) { return { close: d.c, open: d.o, high: d.h || d.c, low: d.l || d.c, volume: d.v || 0 }; });
      snap = window.calcTechnicalSnapshot(_snapBars);
    }
  } catch(_e) { snap = null; }

  var currentPrice = c[c.length - 1];
  var priceChange = c.length > 1 ? ((c[c.length - 1] - c[c.length - 2]) / c[c.length - 2]) * 100 : 0;
  var marketScore = null, marketBand = '시장 점수 미확인';
  try {
    var _mScore = (typeof computeTradingScore === 'function') ? computeTradingScore('swing') : null;
    marketScore = _mScore && typeof _mScore.total === 'number' && isFinite(_mScore.total) ? _mScore.total : null;
    marketBand = marketScore == null ? '시장 점수 미확인' :
      marketScore >= 75 ? '환경 우호' :
      marketScore >= 60 ? '환경 양호' :
      marketScore >= 45 ? '중립' :
      marketScore >= 30 ? '주의' : '위험';
  } catch(_) {}
  // 시장 환경 점수는 설명용 필터이며 예측/매수 허가가 아니다. 미확인은 허용으로 승격하지 않는다.
  var marketAllowsEntry = marketScore != null && marketScore >= 60;
  var marketUnavailable = marketScore == null;
  var marketCaution = marketScore != null && marketScore < 60;

  // Color scheme
  var stageColors = ['#999', 'var(--data-cyan)', 'var(--data-green)', 'var(--data-amber)', 'var(--data-red)'];
  var stageColor = stageColors[stageData.stage] || '#999';
  var entryColor = entryData.grade === 'A+' ? 'var(--data-green)' : entryData.grade === 'A' ? 'var(--data-green)' : entryData.grade === 'B' ? 'var(--data-amber)' : 'var(--data-red)';
  var trendColor = trendData.alignment > 80 ? 'var(--data-green)' : 'var(--data-amber)';
  var instColor = instEngine.score >= 78 ? 'var(--data-green)' : instEngine.score >= 62 ? 'var(--data-cyan)' : instEngine.score >= 45 ? 'var(--data-amber)' : 'var(--data-red)';

  // Build HTML
  var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">' +
    // Stage
    '<div style="background:' + stageColor + '12;border:1px solid ' + stageColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Weinstein Stage</div>' +
      '<div style="font-size:18px;font-weight:900;color:' + stageColor + ';font-family:var(--font-mono);">' + stageData.stage + '단계</div>' +
      '<div style="font-size:11px;color:' + stageColor + ';margin-top:3px;">' + stageData.label + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">확도 ' + Math.round(stageData.confidence * 100) + '%</div>' +
    '</div>' +
    // Trend Position
    '<div style="background:' + trendColor + '12;border:1px solid ' + trendColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">추세 위치</div>' +
      '<div style="font-size:14px;font-weight:900;color:' + trendColor + ';">' + trendData.position + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">52W: ' + trendData.week52 + '% | Gap: ' + trendData.gapFrom20.toFixed(2) + '%</div>' +
    '</div>' +
    // RSI
    '<div style="background:#a78bba12;border:1px solid #a78bba30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">RSI (14)</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--data-purple);font-family:var(--font-mono);">' + rsi.toFixed(1) + '</div>' +
      '<div style="font-size:11px;color:var(--data-purple);margin-top:3px;">' + (rsi > 70 ? '과매수' : rsi < 30 ? '과매도' : '중립') + '</div>' +
    '</div>' +
    // Entry Grade
    '<div style="background:' + entryColor + '12;border:1px solid ' + entryColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">진입 등급</div>' +
      '<div style="font-size:18px;font-weight:900;color:' + entryColor + ';font-family:var(--font-mono);">' + entryData.grade + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;color:' + entryColor + ';">' + entryData.reasoning + '</div>' +
    '</div>' +
  '</div>';

  // Institutional Minervini engine row
  var maChain = instEngine.ma.periods.map(function(p) { return p + '일 ' + _fmtTechPrice(instEngine.ma.mas[p]); }).join(' · ');
  html += '<div style="background:' + instColor + '10;border:1px solid ' + instColor + '40;border-radius:3px;padding:12px;margin-bottom:8px;font-size:11px;border-left:3px solid ' + instColor + ';">' +
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px;">' +
      '<div><div style="font-weight:900;color:var(--text-bright);">기관급 미너비니 체크</div><div style="color:var(--text-muted);margin-top:2px;">가격·이평선·거래량·수평 매물대를 우선, RSI/MACD는 보조로만 반영</div></div>' +
      '<div style="font-family:var(--font-mono);font-size:16px;font-weight:900;color:' + instColor + ';">' + instEngine.score + '/100 · ' + instEngine.verdict + '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">' +
      '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;"><b style="color:var(--text-secondary);">단기 배열</b><br/><span style="color:' + (instEngine.ma.shortState.indexOf('정배열') >= 0 ? 'var(--data-green)' : instEngine.ma.shortState.indexOf('역배열') >= 0 ? 'var(--data-red)' : 'var(--data-amber)') + ';">' + instEngine.ma.shortState + '</span></div>' +
      '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;"><b style="color:var(--text-secondary);">장기 배열</b><br/><span style="color:' + (instEngine.ma.longState.indexOf('정배열') >= 0 ? 'var(--data-green)' : instEngine.ma.longState.indexOf('역배열') >= 0 ? 'var(--data-red)' : 'var(--data-amber)') + ';">' + instEngine.ma.longState + '</span></div>' +
      '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;"><b style="color:var(--text-secondary);">전체 상태</b><br/><span style="color:' + instColor + ';">' + instEngine.ma.status + ' · ' + instEngine.ma.aboveCount + '/6선 위</span></div>' +
    '</div>' +
    '<div style="color:var(--text-muted);margin-top:7px;line-height:1.55;">' + maChain + '</div>' +
  '</div>';

  // Cross signals row
  html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:4px;">이동평균 크로스</div>' +
    '<div style="color:var(--text-muted);">' +
      crossData.pairs.map(function(p) { return p.pair + ': ' + (p.signal || _fmtTechPct(p.spreadPct)); }).join(' | ') + '<br/>' +
      '핵심: 20/50 ' + (crossData.gc20_50 || '—') + ' · 50/200 ' + (crossData.gc50_200 || '—') + ' · 100/200 ' + (crossData.gc100_200 || '—') +
    '</div>' +
  '</div>';

  // Horizontal volume zones row
  if (instEngine.volumeZones) {
    var vz = instEngine.volumeZones;
    var resistanceText = vz.nearestResistance ? _fmtTechPrice(vz.nearestResistance.lo) + '~' + _fmtTechPrice(vz.nearestResistance.hi) + ' (' + _fmtTechPct(vz.nearestResistance.distancePct) + ')' : '상단 핵심 매물대 없음';
    var supportText = vz.nearestSupport ? _fmtTechPrice(vz.nearestSupport.lo) + '~' + _fmtTechPrice(vz.nearestSupport.hi) + ' (' + _fmtTechPct(vz.nearestSupport.distancePct) + ')' : '하단 핵심 매물대 없음';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:5px;"><div style="font-weight:900;color:var(--text-bright);">수평 매물대 · Volume Profile</div><div style="font-family:var(--font-mono);color:var(--data-cyan);">POC ' + _fmtTechPrice(vz.poc && vz.poc.mid) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:6px;">' +
        '<div style="background:rgba(177,58,48,0.08);border:1px solid rgba(177,58,48,0.22);border-radius:3px;padding:7px;"><b style="color:var(--data-red);">위 매물벽</b><br/><span style="color:var(--text-muted);">' + resistanceText + '</span></div>' +
        '<div style="background:rgba(34,117,76,0.08);border:1px solid rgba(34,117,76,0.22);border-radius:3px;padding:7px;"><b style="color:var(--data-green);">아래 방어선</b><br/><span style="color:var(--text-muted);">' + supportText + '</span></div>' +
        '<div style="background:rgba(33,29,22,0.08);border:1px solid rgba(33,29,22,0.22);border-radius:3px;padding:7px;"><b style="color:var(--data-amber);">Value Area</b><br/><span style="color:var(--text-muted);">' + _fmtTechPrice(vz.valueArea.lo) + '~' + _fmtTechPrice(vz.valueArea.hi) + '</span></div>' +
      '</div>' +
      '<div style="color:var(--text-muted);line-height:1.55;">' + escHtml(vz.beginnerNote) + '</div>' +
    '</div>';
  }

  // VCP and Fibonacci confluence row
  var fibText = instEngine.fib && instEngine.fib.nearest
    ? instEngine.fib.nearest.label + ' ' + _fmtTechPrice(instEngine.fib.nearest.price) + ' (' + _fmtTechPct(instEngine.fib.nearest.distancePct) + ')' + (instEngine.fib.confluence ? ' · 매물대 중첩' : '')
    : '데이터 부족';
  html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:4px;">VCP · 피보나치 보조 확인</div>' +
    '<div style="color:var(--text-muted);line-height:1.6;">' +
      'VCP: <b style="color:' + (instEngine.vcp.score >= 75 ? 'var(--data-green)' : instEngine.vcp.score >= 55 ? 'var(--data-amber)' : 'var(--data-red)') + ';">' + instEngine.vcp.label + ' ' + instEngine.vcp.score + '/100</b>' +
      ' · 수축폭 60/30/15일: ' + instEngine.vcp.ranges.r60.toFixed(1) + '% / ' + instEngine.vcp.ranges.r30.toFixed(1) + '% / ' + instEngine.vcp.ranges.r15.toFixed(1) + '%' +
      ' · 거래량 위축: ' + (instEngine.vcp.volDry ? '예' : '아니오') + '<br/>' +
      '피보나치 근접 레벨: ' + fibText +
    '</div>' +
  '</div>';

  // Dip classification row
  html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:4px;">조정 평가</div>' +
    '<div style="color:var(--text-muted);">' +
      dipData.classification + ' (스코어: ' + dipData.score + '%)' +
    '</div>' +
  '</div>';

  // MACD row
  if (macd) {
    var macdHist = macd.histogram[macd.histogram.length - 1] || 0;
    var macdStatus = macdHist > 0 ? '상승' : macdHist < 0 ? '하락' : '평탄';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
      '<div style="font-weight:900;color:var(--text-bright);margin-bottom:4px;">MACD</div>' +
      '<div style="color:var(--text-muted);">' +
        '라인: ' + macd.macdLine[macd.macdLine.length - 1].toFixed(2) + ' | ' +
        '신호: ' + macd.signalLine[macd.signalLine.length - 1].toFixed(2) + ' | ' +
        '상태: ' + macdStatus +
      '</div>' +
    '</div>';
  }

  // Bollinger Bands row
  if (bb) {
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
      '<div style="font-weight:900;color:var(--text-bright);margin-bottom:4px;">볼린저밴드</div>' +
      '<div style="color:var(--text-muted);">' +
        '상단: ' + bb.upper.toFixed(2) + ' | 중앙: ' + bb.middle.toFixed(2) + ' | 하단: ' + bb.lower.toFixed(2) + '<br/>' +
        '%B: ' + (bb.pctB * 100).toFixed(1) + '% | 폭: ' + bb.width.toFixed(2) +
      '</div>' +
    '</div>';
  }

  // RSI 다이버전스 (v51.70: calcTechnicalSnapshot 연동 상세화)
  var _rsiDivObj = (snap && snap.rsiDiv) ? snap.rsiDiv : null;
  var _rsiDivSig = _rsiDivObj ? _rsiDivObj.signal : (divData.bullishDiv ? 'bullish' : divData.bearishDiv ? 'bearish' : 'none');
  var _rsiDivColor = (_rsiDivSig === 'bullish' || _rsiDivSig === 'hidden_bullish') ? 'var(--data-green)' : (_rsiDivSig === 'bearish' || _rsiDivSig === 'hidden_bearish') ? 'var(--data-red)' : 'var(--text-muted)';
  var _rsiDivLabel = _rsiDivSig === 'bullish' ? '강세 다이버전스' : _rsiDivSig === 'bearish' ? '약세 다이버전스' : _rsiDivSig === 'hidden_bullish' ? '히든 강세 다이버전스' : _rsiDivSig === 'hidden_bearish' ? '히든 약세 다이버전스' : '없음';
  var _rsiDivNote = _rsiDivSig === 'bullish' ? '가격 저저(LL) + RSI 고저(HL) — 하방 모멘텀 약화, 반등 가능' :
    _rsiDivSig === 'bearish' ? '가격 고고(HH) + RSI 저고(LH) — 상승 모멘텀 약화, 조정 주의' :
    _rsiDivSig === 'hidden_bullish' ? '가격 고저(HL) + RSI 저저(LL) — 상승 추세 지속 강화 신호' :
    _rsiDivSig === 'hidden_bearish' ? '가격 저고(LH) + RSI 고고(HH) — 하락 추세 지속 경고' :
    'RSI와 가격 방향 일치 — 뚜렷한 다이버전스 없음';
  html += '<div style="background:var(--surface-1);border:1px solid ' + (_rsiDivSig !== 'none' ? _rsiDivColor : 'var(--border)') + '50;border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
      '<div style="font-weight:900;color:var(--text-bright);">RSI 다이버전스</div>' +
      '<div style="font-family:var(--font-mono);font-weight:900;font-size:12px;color:' + _rsiDivColor + ';">' + _rsiDivLabel + '</div>' +
    '</div>' +
    '<div style="color:var(--text-muted);">' + _rsiDivNote + '</div>' +
  '</div>';

  // 주봉 컨텍스트 (v51.70: calcTechnicalSnapshot weeklyCtx — 일봉 5일 집계 시뮬레이션)
  if (snap && snap.weeklyCtx) {
    var _wc = snap.weeklyCtx;
    var _wTrendColor = _wc.wTrend === 'bullish' ? 'var(--data-green)' : _wc.wTrend === 'bearish' ? 'var(--data-red)' : 'var(--text-muted)';
    var _wTrendLabel = _wc.wTrend === 'bullish' ? '주봉 상승' : _wc.wTrend === 'bearish' ? '주봉 하락' : '—';
    var _wClose = _wc.wClose != null ? _wc.wClose : _wc.lastWeekClose;
    var _wRsi = _wc.wRsi14 != null ? _wc.wRsi14 : _wc.wRsi;
    var _wSma20s = _wc.wSma20 ? '$' + _wc.wSma20.toFixed(2) : '—';
    var _wSma50s = _wc.wSma50 ? '$' + _wc.wSma50.toFixed(2) : '—';
    var _wRsis = _wRsi != null ? _wRsi.toFixed(1) : '—';
    var _wPrices = _wClose != null ? '$' + _wClose.toFixed(2) : '—';
    var _wSma20Col = (_wClose != null && _wc.wSma20) ? (_wClose >= _wc.wSma20 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var _wSma50Col = (_wClose != null && _wc.wSma50) ? (_wClose >= _wc.wSma50 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var _wRsiCol = _wRsi != null ? (_wRsi >= 70 ? 'var(--data-red)' : _wRsi <= 30 ? 'var(--data-green)' : 'var(--data-amber)') : 'var(--text-muted)';
    html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;font-size:11px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<div style="font-weight:900;color:var(--text-bright);">주봉 컨텍스트 <span style="font-size:10px;color:var(--text-muted);font-weight:400;">(일봉 5일 집계)</span></div>' +
        '<div style="font-family:var(--font-mono);font-weight:900;font-size:12px;color:' + _wTrendColor + ';">' + _wTrendLabel + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">' +
        '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;text-align:center;">' +
          '<div style="color:var(--text-muted);margin-bottom:3px;">주봉 종가</div>' +
          '<div style="font-family:var(--font-mono);font-weight:700;color:var(--text-bright);">' + _wPrices + '</div>' +
        '</div>' +
        '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;text-align:center;">' +
          '<div style="color:var(--text-muted);margin-bottom:3px;">주봉 SMA20</div>' +
          '<div style="font-family:var(--font-mono);font-weight:700;color:' + _wSma20Col + ';">' + _wSma20s + '</div>' +
        '</div>' +
        '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;text-align:center;">' +
          '<div style="color:var(--text-muted);margin-bottom:3px;">주봉 SMA50</div>' +
          '<div style="font-family:var(--font-mono);font-weight:700;color:' + _wSma50Col + ';">' + _wSma50s + '</div>' +
        '</div>' +
        '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:7px;text-align:center;">' +
          '<div style="color:var(--text-muted);margin-bottom:3px;">주봉 RSI</div>' +
          '<div style="font-family:var(--font-mono);font-weight:700;color:' + _wRsiCol + ';">' + _wRsis + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Overall assessment paragraph
  var verdict = '';
  if (instEngine.score >= 78 && instEngine.ma.fullBull && stageData.stage === 2) {
    verdict = marketAllowsEntry
      ? '미너비니 핵심 조건(상승 스테이지, 단기·장기 이평 정배열, 매물대 부담 제한)이 가장 깨끗한 구간입니다. 추격 매수보다 피벗·거래량·무효화 가격을 정해 분할 접근하세요.'
      : marketUnavailable
        ? '종목 셋업은 기관급 후보지만 시장 환경 입력이 미확인입니다. 점수가 복구되고 돌파 유지·거래량이 확인될 때까지 신규 비중 판단을 보류하세요.'
        : '종목 셋업은 기관급 후보지만 시장 점수가 낮습니다. 시장 회복과 돌파 유지가 확인될 때까지 신규 비중은 낮게 유지하세요.';
  } else if (instEngine.volumeZones && instEngine.volumeZones.nearestResistance && Math.abs(instEngine.volumeZones.nearestResistance.distancePct) <= 3) {
    verdict = '상단 수평 매물대가 가까워 단기 추격 효율이 낮습니다. 매물벽 소화, 거래량 동반 돌파, 돌파 후 지지 전환을 확인하는 편이 낫습니다.';
  } else if (stageData.stage === 2 && trendData.alignment > 80 && entryData.grade.charAt(0) === 'A') {
    verdict = marketAllowsEntry
      ? '상승 추세와 진입 품질이 모두 양호합니다. 다만 즉시 추격보다 분할 진입, ATR 손절, 이벤트 리스크 확인이 우선입니다.'
      : marketUnavailable
        ? '종목 셋업은 강하지만 시장 환경 입력이 미확인입니다. 점수가 복구될 때까지 신규 진입 판단을 보류하고 돌파 유지·거래량을 확인하세요.'
        : '종목 셋업은 강하지만 현재 시장 점수가 낮아 신규 진입은 보류하고 돌파 유지·거래량·시장 회복을 함께 확인하세요.';
  } else if (stageData.stage === 2 && trendData.alignment > 50) {
    verdict = '상승 추세이나 정렬도가 약합니다. 조정 후 재진입 후보로 관리하고, 20/50일선 회복과 거래량을 확인하세요.';
  } else if (stageData.stage === 1) {
    verdict = '바닥권 형성 중입니다. 상승 전환 신호가 확인되기 전까지는 관찰 후보로 두는 편이 안전합니다.';
  } else if (stageData.stage === 3 || stageData.stage === 4) {
    verdict = '약세 또는 분배 가능성이 큽니다. 신규 매수는 보류하고 보유분은 무효화 가격과 손절 조건을 우선 점검하세요.';
  } else {
    verdict = '전환점. 추가 신호 확인 필요.';
  }

  html += '<div style="background:var(--surface-4);border:1px solid var(--border);border-radius:3px;padding:12px;margin-top:12px;font-size:11px;line-height:1.6;border-left:3px solid ' + stageColor + ';">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:6px;">종합 판정</div>' +
    '<div style="color:var(--text-muted);">' +
      '<b>' + ticker + '</b>는 <b style="color:' + stageColor + ';">' + stageData.label + '</b> 중. ' +
      '<b style="color:' + trendColor + ';">' + trendData.position + '</b> 위치에서 ' +
      '<b style="color:' + instColor + ';">' + instEngine.verdict + ' ' + instEngine.score + '/100</b>, ' +
      '<b style="color:' + entryColor + ';">' + entryData.grade + '등급</b> 진입 품질. ' +
      verdict +
      (instEngine.riskFlags.length ? ' <b style="color:var(--data-amber);">체크: ' + instEngine.riskFlags.slice(0, 3).join(' · ') + '.</b>' : '') +
      (marketCaution ? ' <b style="color:var(--data-amber);">시장 점수 ' + marketScore + '/100(' + marketBand + ')이므로 포지션 크기와 타이밍을 보수적으로 잡으세요.</b>' : '') +
    '</div>' +
  '</div>';

  // Price info footer
  html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;margin-top:8px;font-size:11px;color:var(--text-muted);text-align:center;">' +
    '최근 일봉 종가: $' + currentPrice.toFixed(2) + ' (' + (priceChange > 0 ? '+' : '') + priceChange.toFixed(2) + '%) | ' +
    'Yahoo 일봉 ' + _raw.length + '개 · 관측일 ' + new Date(_raw[_raw.length - 1].ts * 1000).toISOString().slice(0, 10) + ' | 시장: ' + marketBand + (marketScore == null ? '' : ' ' + marketScore + '/100') +
  '</div>';

  if (isCurrent()) resultEl.innerHTML = html;
  } catch(e) {
    _aioLog('error', 'fetch', 'analyzeTickerDeep error: ' + (e && e.message || e));
    if (isCurrent()) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">기술적 분석 중 오류가 발생했습니다. 다시 시도해주세요.</div>';
  }
}

// ═══════════════════════════════════════════════════════════════
//  v35.6: 한국 시장 기술 분석 위젯 JS (VKOSPI 차트 · 건강점수 · 브레드스 · 금리스프레드)
// ═══════════════════════════════════════════════════════════════

var krTechCharts = {};

// ── VKOSPI Chart.js 스파크라인 ──────────────────────────────────
function _lockKrVkospiCanvasHeight(cvs) {
  if (!cvs) return;
  function apply() {
    if (cvs.style.height !== '160px') cvs.style.setProperty('height', '160px', 'important');
    if (cvs.getAttribute('height') !== '160') cvs.setAttribute('height', '160');
  }
  apply();
  if (!cvs._aioHeightGuard) {
    cvs._aioHeightGuard = true;
    try {
      new MutationObserver(function() { apply(); }).observe(cvs, { attributes: true, attributeFilter: ['style', 'height'] });
    } catch(_) {}
  }
}

function initKrVkospiChart() {
  var cvs = document.getElementById('kr-vkospi-chart');
  if (!cvs) return;
  cvs.style.width = '100%';
  _lockKrVkospiCanvasHeight(cvs);
  cvs.style.maxHeight = '180px';
  cvs.style.display = 'block';
  cvs.height = 160;

  // 기존 차트 파괴
  if (krTechCharts['vkospi'] && typeof krTechCharts['vkospi'].destroy === 'function') {
    krTechCharts['vkospi'].destroy();
  }

  // VKOSPI는 브라우저에서 성공적으로 수집·누적된 관측치만 표시한다.
  // 신규 사용자에게는 시계열이 없으므로 오래된 공통 시드를 보여주지 않고 결측으로 닫는다.
  var vkReal = typeof _aioGetVkospiHistorySeries === 'function' ? _aioGetVkospiHistorySeries(3) : null;
  var vkLabels = vkReal ? vkReal.labels : [];
  var vkData = vkReal ? vkReal.data : [];
  if (!vkReal) {
    cvs.setAttribute('data-source-kind', 'unavailable');
    cvs.setAttribute('data-operational-use', 'blocked');
    cvs.setAttribute('title', 'VKOSPI 실측 히스토리 3일 미만 — 차트 판정 보류');
  }

  var tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
  var gridColor = 'var(--surface-3)';

  var _gVk = chartDataGate('kr-vkospi-chart', vkLabels, [vkData], { minPoints: 3, chartName: 'VKOSPI' });
  if (!_gVk) return;

  krTechCharts['vkospi'] = new Chart(cvs, {
    type: 'line',
    data: {
      labels: vkLabels,
      datasets: [{
        label: 'VKOSPI', data: vkData,
        borderColor: 'var(--data-red)',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(177,58,48,0.30)');
          g.addColorStop(1, 'rgba(177,58,48,0)');
          return g;
        },
        borderWidth: 2, tension: 0.3, fill: true,
        // v38.3 D4: 스파이크 포인트 강조 (최대값에만 점 표시)
        pointRadius: vkData.map(function(v) { return v === Math.max.apply(null, vkData) ? 5 : 0; }),
        pointBackgroundColor: vkData.map(function(v) { return v === Math.max.apply(null, vkData) ? '#b13a30' : 'transparent'; }),
        pointBorderColor: vkData.map(function(v) { return v === Math.max.apply(null, vkData) ? '#fff' : 'transparent'; }),
        pointBorderWidth: vkData.map(function(v) { return v === Math.max.apply(null, vkData) ? 2 : 0; }),
        pointHoverRadius: 4
      }, {
        label: '25 (공포)', data: Array(vkLabels.length).fill(25),
        borderColor: 'rgba(177,58,48,0.35)', borderWidth: 1, borderDash: [3,3],
        pointRadius: 0, fill: false
      }, {
        label: '15 (안정)', data: Array(vkLabels.length).fill(15),
        borderColor: 'rgba(34,117,76,0.35)', borderWidth: 1, borderDash: [3,3],
        pointRadius: 0, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(251,249,245,0.95)', titleColor: '#211d16', bodyColor: '#57513f',
          titleFont: { size: 9 }, bodyFont: { size: 9 }, padding: 6, cornerRadius: 4,
          callbacks: { label: function(i) { return ' ' + i.dataset.label + ': ' + i.formattedValue; } }
        }
      },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 8 }, border: { display: false } },
        y: { min: 10, suggestedMax: Math.max.apply(null, vkData) * 1.1, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } }, border: { display: false } }
      }
    }
  });
  _lockKrVkospiCanvasHeight(cvs);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function() { _lockKrVkospiCanvasHeight(cvs); });
}

// ═══ v48.78: 심층 종목 기술 분석 — 계산 + 렌더 함수 ═════════════════════════

// OHLCV 배열 → SMA 시계열 [{time, value}] 반환 (lightweight-charts 형식)
function _daSMAFull(ohlcv, period) {
  if (!ohlcv || ohlcv.length < period) return [];
  var result = [];
  for (var si = period - 1; si < ohlcv.length; si++) {
    var sum = 0;
    for (var sj = 0; sj < period; sj++) sum += ohlcv[si - sj].close;
    result.push({ time: ohlcv[si].time, value: sum / period });
  }
  return result;
}

// OHLCV 배열 → RSI(14) 시계열 [{time, value}] 반환 (Wilder smoothing)
function _daRSIFull(ohlcv, period) {
  period = period || 14;
  if (!ohlcv || ohlcv.length < period + 1) return [];
  var closes = ohlcv.map(function(d) { return d.close; });
  var gAvg = 0, lAvg = 0;
  for (var ri = 1; ri <= period; ri++) {
    var rd = closes[ri] - closes[ri - 1];
    if (rd > 0) gAvg += rd; else lAvg += -rd;
  }
  gAvg /= period; lAvg /= period;
  var result = [];
  var rsi0 = lAvg === 0 ? 100 : 100 - (100 / (1 + gAvg / lAvg));
  result.push({ time: ohlcv[period].time, value: Math.round(rsi0 * 100) / 100 });
  for (var ri2 = period + 1; ri2 < ohlcv.length; ri2++) {
    var rd2 = closes[ri2] - closes[ri2 - 1];
    gAvg = (gAvg * (period - 1) + (rd2 > 0 ? rd2 : 0)) / period;
    lAvg = (lAvg * (period - 1) + (rd2 < 0 ? -rd2 : 0)) / period;
    var rsiV = lAvg === 0 ? 100 : 100 - (100 / (1 + gAvg / lAvg));
    result.push({ time: ohlcv[ri2].time, value: Math.round(rsiV * 100) / 100 });
  }
  return result;
}

// 일봉 OHLCV → 핵심 기술 레벨 계산
function _daKeyLevels(ohlcv) {
  if (!ohlcv || !ohlcv.length) return null;
  var closes = ohlcv.map(function(d) { return d.close; });
  var highs  = ohlcv.map(function(d) { return d.high; });
  var lows   = ohlcv.map(function(d) { return d.low; });
  var vols   = ohlcv.map(function(d) { return d.volume || 0; });
  var cur = closes[closes.length - 1];
  function sma(n) {
    if (closes.length < n) return null;
    var s = 0; for (var ki = closes.length - n; ki < closes.length; ki++) s += closes[ki];
    return s / n;
  }
  var ma5 = sma(5), ma10 = sma(10), ma20 = sma(20), ma50 = sma(50), ma100 = sma(100), ma200 = sma(200);
  var h52 = Math.max.apply(null, highs);
  var l52 = Math.min.apply(null, lows);
  var resistance = [], support = [];
  if (ma5  && ma5  > cur) resistance.push({ label: 'MA5',    value: ma5 });
  if (ma10 && ma10 > cur) resistance.push({ label: 'MA10',   value: ma10 });
  if (ma20 && ma20 > cur) resistance.push({ label: 'MA20',   value: ma20 });
  if (ma50 && ma50 > cur) resistance.push({ label: 'MA50',   value: ma50 });
  if (ma100 && ma100 > cur) resistance.push({ label: 'MA100', value: ma100 });
  if (ma200 && ma200 > cur) resistance.push({ label: 'MA200', value: ma200 });
  if (h52 > cur * 1.001)  resistance.push({ label: '기간 고점', value: h52 });
  if (ma5  && ma5  < cur) support.push({ label: 'MA5',    value: ma5 });
  if (ma10 && ma10 < cur) support.push({ label: 'MA10',   value: ma10 });
  if (ma20 && ma20 < cur) support.push({ label: 'MA20',   value: ma20 });
  if (ma50 && ma50 < cur) support.push({ label: 'MA50',   value: ma50 });
  if (ma100 && ma100 < cur) support.push({ label: 'MA100', value: ma100 });
  if (ma200 && ma200 < cur) support.push({ label: 'MA200', value: ma200 });
  if (l52 < cur * 0.999)  support.push({ label: '기간 저점', value: l52 });
  var volumeZones = (typeof _buildHorizontalVolumeZones === 'function') ? _buildHorizontalVolumeZones(highs, lows, closes, vols, 160, 28) : null;
  if (volumeZones && volumeZones.nearestResistance) resistance.push({ label: '수평 매물대', value: volumeZones.nearestResistance.mid });
  if (volumeZones && volumeZones.nearestSupport) support.push({ label: '수평 매물대', value: volumeZones.nearestSupport.mid });
  resistance.sort(function(a, b) { return a.value - b.value; });
  support.sort(function(a, b) { return b.value - a.value; });
  var lastRSI = (typeof _calcRSILast === 'function') ? _calcRSILast(closes, 14) : null;
  return { cur: cur, resistance: resistance, support: support, ma5: ma5, ma10: ma10, ma20: ma20, ma50: ma50, ma100: ma100, ma200: ma200, volumeZones: volumeZones, rsi: lastRSI, h52: h52, l52: l52 };
}

// 핵심 레벨 패널 HTML 생성
function _daLevelsHTML(levels) {
  if (!levels) return '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:10px;">데이터 없음</div>';
  var fmt = function(v) { return v != null ? v.toFixed(2) : '—'; };
  var html = '';
  // 저항
  html += '<div style="font-size:11px;font-weight:700;color:var(--data-red);margin-bottom:3px;letter-spacing:.5px;">▲ 저항</div>';
  if (levels.resistance.length) {
    levels.resistance.forEach(function(r) {
      var pct = '+' + ((r.value - levels.cur) / levels.cur * 100).toFixed(1) + '%';
      html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-subtle);">' +
        '<span style="font-size:11px;color:var(--text-muted);">' + r.label + '</span>' +
        '<span style="font-size:11px;font-family:var(--font-mono);color:#b13a30;">' + fmt(r.value) +
        ' <span style="font-size:11px;opacity:.65;">(' + pct + ')</span></span></div>';
    });
  } else {
    html += '<div style="font-size:11px;color:var(--text-muted);padding:2px 0;">저항 돌파 상태</div>';
  }
  // 현재가 중심박스
  html += '<div style="margin:6px 0;padding:6px;background:rgba(33,29,22,0.08);border:1px solid rgba(33,29,22,0.2);border-radius:3px;text-align:center;">' +
    '<div style="font-size:11px;color:var(--data-amber);">현재가</div>' +
    '<div style="font-size:15px;font-weight:900;font-family:var(--font-mono);color:var(--data-amber);">' + fmt(levels.cur) + '</div>' +
    (levels.rsi != null ? '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">RSI&nbsp;' + levels.rsi.toFixed(1) +
      (levels.rsi > 70 ? '&nbsp;과매수' : levels.rsi < 30 ? '&nbsp;과매도' : '') + '</div>' : '') +
  '</div>';
  if (levels.volumeZones && levels.volumeZones.poc) {
    html += '<div style="margin:5px 0 7px;padding:6px;background:rgba(33,29,22,0.08);border:1px solid rgba(33,29,22,0.2);border-radius:3px;">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;"><span style="color:var(--text-muted);">POC(최대 거래량 가격대)</span><span style="font-family:var(--font-mono);color:var(--data-cyan);">' + fmt(levels.volumeZones.poc.mid) + '</span></div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;line-height:1.45;">위에 있으면 저항, 아래에 있으면 지지 후보로 먼저 확인합니다.</div>' +
    '</div>';
  }
  // 지지
  html += '<div style="font-size:11px;font-weight:700;color:var(--data-green);margin-bottom:3px;letter-spacing:.5px;">▼ 지지</div>';
  if (levels.support.length) {
    levels.support.forEach(function(s) {
      var pct = ((s.value - levels.cur) / levels.cur * 100).toFixed(1) + '%';
      html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-subtle);">' +
        '<span style="font-size:11px;color:var(--text-muted);">' + s.label + '</span>' +
        '<span style="font-size:11px;font-family:var(--font-mono);color:#22754c;">' + fmt(s.value) +
        ' <span style="font-size:11px;opacity:.65;">(' + pct + ')</span></span></div>';
    });
  } else {
    html += '<div style="font-size:11px;color:var(--text-muted);padding:2px 0;">지지 붕괴 상태</div>';
  }
  return html;
}

// 전략 요약 HTML 생성
function _daStrategyHTML(levels, sym) {
  if (!levels) return '';
  var trend = '중립', tCol = 'var(--data-amber)';
  if (levels.ma5 && levels.ma10 && levels.ma20 && levels.ma50 && levels.ma100 && levels.ma200) {
    var shortBull = levels.ma5 > levels.ma10 && levels.ma10 > levels.ma20;
    var shortBear = levels.ma5 < levels.ma10 && levels.ma10 < levels.ma20;
    var longBull = levels.ma50 > levels.ma100 && levels.ma100 > levels.ma200;
    var longBear = levels.ma50 < levels.ma100 && levels.ma100 < levels.ma200;
    if (shortBull && longBull && levels.ma20 > levels.ma50) { trend = '단기·장기 정배열'; tCol = 'var(--data-green)'; }
    else if (shortBear && longBear && levels.ma20 < levels.ma50) { trend = '단기·장기 역배열'; tCol = 'var(--data-red)'; }
    else if (shortBull || longBull) { trend = (shortBull ? '단기 정배열' : '장기 정배열') + ' / 혼조'; tCol = 'var(--data-amber)'; }
  }
  var rsiLabel = '';
  if (levels.rsi != null) {
    if      (levels.rsi > 70) rsiLabel = 'RSI ' + levels.rsi.toFixed(0) + ' — 과매수, 단기 조정 경계';
    else if (levels.rsi < 30) rsiLabel = 'RSI ' + levels.rsi.toFixed(0) + ' — 과매도, 반등 가능성';
    else if (levels.rsi >= 50) rsiLabel = 'RSI ' + levels.rsi.toFixed(0) + ' — 상승 모멘텀 유지';
    else                       rsiLabel = 'RSI ' + levels.rsi.toFixed(0) + ' — 하락 모멘텀 우세';
  }
  var r1 = levels.resistance.length ? levels.resistance[0] : null;
  var s1 = levels.support.length    ? levels.support[0]    : null;
  var summary = (sym || '') + ': MA ' + trend +
    (rsiLabel ? ' · ' + rsiLabel : '') +
    (r1 ? ' · 1차 저항 ' + r1.value.toFixed(2) : '') +
    (s1 ? ' · 1차 지지 ' + s1.value.toFixed(2) : '') +
    (levels.volumeZones && levels.volumeZones.poc ? ' · POC ' + levels.volumeZones.poc.mid.toFixed(2) : '');
  return '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
    '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:4px 10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);">MA 배열</div>' +
      '<div style="font-size:11px;font-weight:700;color:' + tCol + ';">' + trend + '</div>' +
    '</div>' +
    (levels.rsi != null ? '<div style="background:rgba(33,29,22,0.04);border:1px solid var(--border-subtle);border-radius:3px;padding:4px 10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);">RSI(14)</div>' +
      '<div style="font-size:11px;font-weight:700;font-family:var(--font-mono);color:' +
        (levels.rsi > 70 ? 'var(--data-red)' : levels.rsi < 30 ? 'var(--data-green)' : 'var(--data-cyan)') + ';">' +
        levels.rsi.toFixed(1) + '</div>' +
    '</div>' : '') +
    '<div style="flex:1;font-size:10px;color:var(--text-muted);padding:4px 8px;border:1px solid var(--border-subtle);border-radius:3px;min-width:180px;">' +
      '<strong style="color:var(--text-secondary);">핵심 한 줄</strong>&nbsp;' + (typeof escHtml === 'function' ? escHtml(summary) : summary) +
    '</div>' +
  '</div>';
}

// 기존 deep chart 인스턴스 파괴 + 컨테이너 초기화
function _daDestroyCharts() {
  (window._deepChartInstances || []).forEach(function(c) {
    if (!c || c.__aioDisposed) return;
    c.__aioDisposed = true;
    try {
      if (c.__aioResizeObserver) c.__aioResizeObserver.disconnect();
      c.__aioResizeObserver = null;
    } catch(_){ }
    try { c.remove(); } catch(_){}
  });
  window._deepChartInstances = [];
}

// 메인 오케스트레이터
async function initDeepAnalysisSection(symbol, requestEpoch) {
  symbol = (symbol || 'SPY').toUpperCase().trim();
  if (requestEpoch == null) requestEpoch = window._technicalSelectionEpoch = (window._technicalSelectionEpoch || 0) + 1;
  function isCurrent() { return requestEpoch === window._technicalSelectionEpoch && window._currentTickerId === symbol; }
  var labelEl  = document.getElementById('deep-sym-label');
  var levelsEl = document.getElementById('deep-levels-content');
  var stratEl  = document.getElementById('deep-strategy-content');

  if (labelEl)  labelEl.textContent = symbol + ' — 데이터 요청 중…';
  if (levelsEl) levelsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:10px;">분석 중…</div>';
  if (stratEl)  stratEl.innerHTML  = '<div style="text-align:center;color:var(--text-muted);font-size:10px;">분석 중…</div>';

  _daDestroyCharts();
  ['da-col-m','da-col-w','da-col-d'].forEach(function(id) {
    var col = document.getElementById(id);
    if (!col) return;
    var cc = col.querySelector('.da-candle');
    if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:10px;">데이터 요청 중…</div>';
  });

  var deepFetchOHLCV = (typeof fetchOHLCVWithFallback === 'function') ? fetchOHLCVWithFallback : (typeof fetchOHLCV === 'function' ? fetchOHLCV : null);
  if (!deepFetchOHLCV) {
    if (labelEl) labelEl.textContent = 'OHLCV fetcher 미로드 — 페이지를 새로고침하세요';
    return;
  }

  var results = await Promise.all([
    deepFetchOHLCV(symbol, '1month', 60),
    deepFetchOHLCV(symbol, '1week',  104),
    deepFetchOHLCV(symbol, '1day',   120)
  ].map(function(request) { return Promise.resolve(request).catch(function() { return []; }); }));
  if (!isCurrent()) return;
  var monthly = results[0], weekly = results[1], daily = results[2];

  if (![monthly, weekly, daily].some(function(rows) { return rows && rows.length; })) {
    if (labelEl) labelEl.textContent = symbol + ' — OHLCV 미수신';
    if (levelsEl) levelsEl.textContent = '무료 데이터 경로에서 OHLCV를 가져오지 못했습니다. 잠시 후 다시 검색하세요.';
    if (stratEl) stratEl.innerHTML = '';
    return;
  }

  var colMap = [
    { id: 'da-col-m', data: monthly },
    { id: 'da-col-w', data: weekly  },
    { id: 'da-col-d', data: daily   }
  ];
  colMap.forEach(function(tf) {
    var col = document.getElementById(tf.id);
    if (!col) return;
    if (!tf.data || !tf.data.length) {
      var emptyCandle = col.querySelector('.da-candle');
      if (emptyCandle) emptyCandle.textContent = '해당 주기 데이터 미수신';
      return;
    }
    var ma5  = _daSMAFull(tf.data, 5);
    var ma20 = _daSMAFull(tf.data, 20);
    var ma60 = _daSMAFull(tf.data, 60);
    var rsi  = _daRSIFull(tf.data, 14);
    if (typeof window._renderDeepChart === 'function') {
      window._renderDeepChart(col, tf.data, [
        { period: 5,  data: ma5  },
        { period: 20, data: ma20 },
        { period: 60, data: ma60 }
      ], rsi);
    }
  });

  if (daily && daily.length >= 20) {
    var levels = _daKeyLevels(daily);
    if (levelsEl) levelsEl.innerHTML = _daLevelsHTML(levels);
    if (stratEl) stratEl.innerHTML = _daStrategyHTML(levels, symbol);
  } else {
    if (levelsEl) levelsEl.textContent = '일봉 20개 이상 수신 후 가격대를 계산합니다.';
    if (stratEl) stratEl.textContent = '';
  }
  var sources = results.filter(function(rows) { return rows && rows.length; }).map(function(rows) { return rows.dataQuality && rows.dataQuality.source || 'OHLCV'; });
  if (labelEl) labelEl.textContent = symbol + ' · ' + Array.from(new Set(sources)).join(' / ') + ' · 월/주/일봉 · MA(5/20/60) · RSI(14)';
}

window.runDeepAnalysis = function(sym) {
  if (typeof sym !== 'string' || !sym.trim()) {
    var inp = document.getElementById('deep-sym-input');
    sym = inp ? inp.value.trim() : '';
  }
  sym = sym.toUpperCase().trim();
  if (!sym) return;
  var inp2 = document.getElementById('deep-sym-input');
  if (inp2) inp2.value = sym;
  return analyzeTickerDeep(sym);
};

// ── 한국 시장 건강 점수 동적 계산 ────────────────────────────────
function calcKrHealthScore() {
  var snap = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : {};
  let ld = window._liveData || {};
  var score = 50; // 기본값

  // P712/R340: 결측을 0 또는 오래된 월간 스냅샷으로 중립화하지 않는다.
  var kospiLive = ld['^KS11'] && ld['^KS11'].pct != null && Number.isFinite(Number(ld['^KS11'].pct));
  var kosdaqLive = ld['^KQ11'] && ld['^KQ11'].pct != null && Number.isFinite(Number(ld['^KQ11'].pct));
  var vkospiLive = typeof _vkospiLastOkTs !== 'undefined' && _vkospiLastOkTs && (Date.now() - _vkospiLastOkTs < 86400000) && !(typeof _vkospiIsFailedState === 'function' && _vkospiIsFailedState());
  var supplyLive = window._krCurrentSupplyEvidence && (Date.now() - window._krCurrentSupplyEvidence.observedAt < 86400000) && window._krCurrentSupplyEvidence.foreignNet != null && Number.isFinite(Number(window._krCurrentSupplyEvidence.foreignNet));
  var currentInputs = [kospiLive, kosdaqLive, vkospiLive, supplyLive].filter(Boolean).length;
  if (currentInputs < 4) {
    var missing = [];
    if (!kospiLive) missing.push('KOSPI');
    if (!kosdaqLive) missing.push('KOSDAQ');
    if (!vkospiLive) missing.push('VKOSPI');
    if (!supplyLive) missing.push('외국인 수급');
    var blockedVal = document.getElementById('kr-health-val');
    var blockedLabel = document.getElementById('kr-health-label');
    var blockedTrend = document.getElementById('kr-health-trend');
    if (blockedVal) { blockedVal.textContent = '—'; blockedVal.style.color = 'var(--text-muted)'; }
    if (blockedLabel) { blockedLabel.textContent = '판정 보류 · 현재 입력 ' + currentInputs + '/4'; blockedLabel.style.color = 'var(--data-amber)'; }
    if (blockedTrend) { blockedTrend.textContent = '미수신: ' + missing.join(', '); blockedTrend.style.color = 'var(--text-muted)'; }
    return { score: null, grade: 'UNAVAILABLE', label: '현재 입력 불충분', missing: missing };
  }

  // 1) KOSPI 추세 (현재 관측만)
  var kospiPct = Number(ld['^KS11'].pct);
  if (kospiPct > 1)       { score += 10; }
  else if (kospiPct > 0)  { score += 5; }
  else if (kospiPct > -1) { score -= 5; }
  else if (kospiPct > -3) { score -= 10; }
  else                    { score -= 15; }

  // 2) KOSDAQ 추세
  var kosdaqPct = Number(ld['^KQ11'].pct);
  if (kosdaqPct > 1)       { score += 6; }
  else if (kosdaqPct > 0)  { score += 3; }
  else if (kosdaqPct > -1) { score -= 3; }
  else                     { score -= 6; }

  // 3) VKOSPI 변동성
  var vkospi = Number(snap.vkospi);
  if (vkospi < 15)      { score += 12; }
  else if (vkospi < 20) { score += 6; }
  else if (vkospi < 25) { score -= 4; }
  else if (vkospi < 35) { score -= 10; }
  else if (vkospi < 50) { score -= 16; }
  else                  { score -= 22; }

  // 4) 외국인 수급 (순매수 억원)
  var foreignNet = Number(window._krCurrentSupplyEvidence.foreignNet) / 100000000;
  if (foreignNet > 5000)       { score += 10; }
  else if (foreignNet > 1000)  { score += 5; }
  else if (foreignNet > -1000) { score += 0; }
  else if (foreignNet > -5000) { score -= 5; }
  else if (foreignNet > -15000){ score -= 10; }
  else                         { score -= 15; }

  // 정책금리는 수동 공식 참조값이므로 시장 건강 점수 입력에서 제외한다.

  score = Math.max(0, Math.min(100, score));

  // 등급 결정
  var grade, label, color;
  if (score >= 80)      { grade = 'A+'; label = '강한 상승장';  color = 'var(--data-green)'; }
  else if (score >= 65) { grade = 'A';  label = '상승 추세';    color = 'var(--data-green)'; }
  else if (score >= 50) { grade = 'B';  label = '중립 / 혼조';  color = 'var(--data-amber)'; }
  else if (score >= 35) { grade = 'C';  label = '약세 · 경계 필요'; color = '#57513f'; }
  else if (score >= 20) { grade = 'D';  label = '약세장';        color = 'var(--data-red)'; }
  else                  { grade = 'F';  label = '극심한 약세';   color = 'var(--data-red)'; }

  // DOM 업데이트
  var valEl = document.getElementById('kr-health-val');
  var lblEl = document.getElementById('kr-health-label');
  if (valEl) { valEl.textContent = score; valEl.style.color = color; }
  if (lblEl) { lblEl.textContent = grade + ' — ' + label; lblEl.style.color = color; }
  // KOSPI 추세 라벨 동적 업데이트
  var trendEl = document.getElementById('kr-health-trend');
  if (trendEl) {
    var trendTxt = kospiPct > 1 ? '상승 추세' : kospiPct > 0 ? '소폭 상승' : kospiPct > -1 ? '소폭 하락' : '하락 추세';
    var trendCol = kospiPct > 0 ? 'var(--data-green)' : kospiPct > -1 ? 'var(--data-amber)' : 'var(--data-red)';
    trendEl.textContent = trendTxt + ' (' + (kospiPct >= 0 ? '+' : '') + kospiPct.toFixed(2) + '%)';
    trendEl.style.color = trendCol;
    trendEl.parentElement.style.background = kospiPct > 0 ? 'rgba(34,117,76,0.08)' : 'rgba(177,58,48,0.08)';
  }

  // VKOSPI 서브 표시
  // v49.58 P278 보정: 임계값 표준화 — 정상(<20) / 경계(20~25) / 공포(25~35) / 극단공포(35+)
  // CHANGELOG L748 "VKOSPI 17.80 정상" 의도 반영 (이전 15 임계값 → 20)
  var vkEl = document.getElementById('kr-health-vkospi');
  // v52.34 P649: fetchVkospiDynamic()이 실패 상태를 렌더링한 뒤 kr-technical 페이지를 재방문하면
  // 이 함수가 정지된 snap.vkospi로 "정상"처럼 덮어쓰던 회귀 — 실패 상태 중엔 건너뛴다.
  if (vkEl && !(typeof _vkospiIsFailedState === 'function' && _vkospiIsFailedState())) {
    var vkLabel = vkospi >= 35 ? '극단공포' : vkospi >= 25 ? '공포' : vkospi >= 20 ? '경계' : '정상';
    vkEl.textContent = vkospi.toFixed(2) + ' (' + vkLabel + ')';
    vkEl.style.color = vkospi >= 25 ? 'var(--red)' : vkospi >= 20 ? 'var(--yellow)' : 'var(--green)';
  }

  return { score: score, grade: grade, label: label };
}

// ── 한국 금리 스프레드 동적 계산 ────────────────────────────────
function calcKrYieldSpreads() {
  var snap = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : {};
  var live = window._liveData || {};
  var bond3y = live['^KR3Y'] && Number(live['^KR3Y'].price);
  var bond10y = live['^KR10Y'] && Number(live['^KR10Y'].price);
  var bokRate = Number(snap.bokRate);
  var cd91 = live['^KRCD91'] && Number(live['^KRCD91'].price);

  // 장단기 스프레드 (10Y - 3Y)
  var spread3y10y = Number.isFinite(bond3y) && Number.isFinite(bond10y) ? Math.round((bond10y - bond3y) * 100) : null;
  // 기준금리 - 10년 스프레드 (10Y - BOK)
  var spreadBok10y = Number.isFinite(bond10y) && Number.isFinite(bokRate) ? Math.round((bond10y - bokRate) * 100) : null;
  // CD - 기준금리 스프레드 (CD91 - BOK)
  var spreadCd = Number.isFinite(cd91) && Number.isFinite(bokRate) ? Math.round((cd91 - bokRate) * 100) : null;

  function fmtBp(bp) { return bp == null ? '—' : (bp >= 0 ? '+' : '') + bp + 'bp'; }
  function spreadColor(bp) { return bp == null ? 'var(--text-muted)' : bp >= 0 ? 'var(--green)' : 'var(--red)'; }

  var el1 = document.getElementById('kr-spread-3y10y');
  var el2 = document.getElementById('kr-spread-bok10y');
  var el3 = document.getElementById('kr-spread-cd');

  if (el1) { el1.textContent = fmtBp(spread3y10y); el1.style.color = spreadColor(spread3y10y); }
  if (el2) { el2.textContent = fmtBp(spreadBok10y); el2.style.color = spreadColor(spreadBok10y); }
  if (el3) { el3.textContent = fmtBp(spreadCd);     el3.style.color = spreadColor(spreadCd); }
  return { available: spread3y10y != null && spreadBok10y != null && spreadCd != null, spread3y10y: spread3y10y, spreadBok10y: spreadBok10y, spreadCd: spreadCd };
}

// ── 한국 시장 브레드스 업데이트 ─────────────────────────────────
function updateKrBreadth() {
  var b = window._krBreadthLiveData;
  var available = !!(b && b.ts && Date.now() - b.ts <= 96 * 3600000 && b.coveragePct >= 85);
  function set(id, text, color, title) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = color || 'var(--text-muted)';
    if (title) el.title = title;
  }
  if (!available) {
    set('kr-breadth-adl', '—');
    set('kr-breadth-20ma', '—');
    document.querySelectorAll('[data-snap="kr-advance"],[data-snap="kr-decline"],[data-snap="kr-52w-high"],[data-snap="kr-52w-low"]').forEach(function(el) { el.textContent = '—'; });
    return { available: false, reason: 'fresh covered screener breadth unavailable' };
  }
  var ratio = b.declines > 0 ? b.advances / b.declines : null;
  var title = (b.label || 'AIO 한국 스크리너 유니버스') + ' · 커버리지 ' + b.coveragePct.toFixed(1) + '% · ' + String(b.observedAt || '').slice(0, 10);
  set('kr-breadth-adl', ratio == null ? '—' : ratio.toFixed(2), ratio != null && ratio >= 1 ? 'var(--green)' : 'var(--red)', title);
  set('kr-breadth-20ma', b.sma20.toFixed(1) + '%', b.sma20 >= 50 ? 'var(--green)' : 'var(--red)', title);
  document.querySelectorAll('[data-snap="kr-advance"]').forEach(function(el) { el.textContent = b.advances.toLocaleString(); el.title = title; });
  document.querySelectorAll('[data-snap="kr-decline"]').forEach(function(el) { el.textContent = b.declines.toLocaleString(); el.title = title; });
  document.querySelectorAll('[data-snap="kr-52w-high"],[data-snap="kr-52w-low"]').forEach(function(el) { el.textContent = '—'; el.title = '52주 신고·신저가 공식 원천 미수신'; });
  return { available: true, source: b.source, observedAt: b.observedAt, coveragePct: b.coveragePct };
}

// v33.0: Korean Technical Page init — KOSPI/KOSDAQ 자동 분석
function initKoreaTechnical() {
  // v40.4: 차트 자동 로드 (삼성전자 기본) / v52.27 P642: 캔들 캔버스 기준으로 직접 초기화
  var tvKrContainer = document.getElementById('tv-widget-kr');
  var krCandleCanvas = document.getElementById('kr-candle-chart');
  if ((krCandleCanvas || tvKrContainer) && !krTechCharts['krCandle']) {
    try {
      var krCode = ((document.getElementById('tv-kr-sym') || {}).value || '005930').replace(/\.(KS|KQ)$/i, '').trim();
      if (typeof loadKrCandleChart === 'function') loadKrCandleChart(krCode || '005930');
      else if (typeof loadTVChart === 'function') loadTVChart('kr');
    } catch(e) {}
  }
  // v35.6: 신규 위젯 초기화
  initKrVkospiChart();
  calcKrHealthScore();
  calcKrYieldSpreads();
  updateKrBreadth();

  // Auto-analyze KOSPI & KOSDAQ on page entry
  var kospiEl = document.getElementById('kr-kospi-tech-result');
  var kosdaqEl = document.getElementById('kr-kosdaq-tech-result');

  if (kospiEl && (!kospiEl.innerHTML || kospiEl.innerHTML.indexOf('로딩') === -1 && kospiEl.innerHTML.indexOf('Weinstein') === -1)) {
    analyzeKrIndex('^KS11', 'kr-kospi-tech-result', 'KOSPI');
  }
  if (kosdaqEl && (!kosdaqEl.innerHTML || kosdaqEl.innerHTML.indexOf('로딩') === -1 && kosdaqEl.innerHTML.indexOf('Weinstein') === -1)) {
    analyzeKrIndex('^KQ11', 'kr-kosdaq-tech-result', 'KOSDAQ');
  }
}

// Analyze Korean index (KOSPI/KOSDAQ) and render to a specific target
async function analyzeKrIndex(ticker, targetId, label) {
  var resultEl = document.getElementById(targetId);
  if (!resultEl) return;
  resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><div style="font-size:12px;">분석 준비: ' + escHtml(label) + ' 기술적 분석...</div></div>';

  try {
  var chartData = await _fetchYahooChartData(ticker);
  if (!chartData || !chartData.closes || chartData.closes.length < 50) {
    resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">' + escHtml(label) + ' 데이터를 불러올 수 없습니다.</div>';
    return;
  }

  var c = chartData.closes.filter(function(x){return x!==null;});
  var o = chartData.opens.filter(function(x){return x!==null;});
  var h = chartData.highs.filter(function(x){return x!==null;});
  var l = chartData.lows.filter(function(x){return x!==null;});
  var v = chartData.volumes.filter(function(x){return x!==null;});

  var stageData = _detectStage(o,h,l,c,v);
  var trendData = _detectTrendPosition(o,h,l,c,v);
  var dipData = _classifyDip(o,h,l,c,v);
  var entryData = _assessEntryQuality(o,h,l,c,v);
  var crossData = _detectCrossSignals(c);
  var divData = _detectDivergence(c);
  var rsi = _calcRSILast(c,14);
  var macd = _calcMACD(c);
  var bb = _calcBB(c,20,2);

  var currentPrice = c[c.length-1];
  var priceChange = c.length>1?((c[c.length-1]-c[c.length-2])/c[c.length-2])*100:0;

  var stageColors = ['#999','var(--data-cyan)','var(--data-green)','var(--data-amber)','var(--data-red)'];
  var stageColor = stageColors[stageData.stage]||'#999';
  var entryColor = entryData.grade==='A+'||entryData.grade==='A'?'var(--data-green)':entryData.grade==='B'?'var(--data-amber)':'var(--data-red)';
  var trendColor = trendData.alignment>80?'var(--data-green)':'var(--data-amber)';

  var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">' +
    '<div style="background:'+stageColor+'12;border:1px solid '+stageColor+'30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Weinstein Stage</div>' +
      '<div style="font-size:18px;font-weight:900;color:'+stageColor+';font-family:var(--font-mono);">'+stageData.stage+'단계</div>' +
      '<div style="font-size:11px;color:'+stageColor+';margin-top:3px;">'+escHtml(stageData.label)+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">확도 '+Math.round(stageData.confidence*100)+'%</div>' +
    '</div>' +
    '<div style="background:'+trendColor+'12;border:1px solid '+trendColor+'30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">추세 위치</div>' +
      '<div style="font-size:14px;font-weight:900;color:'+trendColor+';">'+escHtml(trendData.position)+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">52W: '+trendData.week52+'% | Gap: '+trendData.gapFrom20.toFixed(2)+'%</div>' +
    '</div>' +
    '<div style="background:#a78bba12;border:1px solid #a78bba30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">RSI (14)</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--data-purple);font-family:var(--font-mono);">'+rsi.toFixed(1)+'</div>' +
      '<div style="font-size:11px;color:var(--data-purple);margin-top:3px;">'+(rsi>70?'과매수':rsi<30?'과매도':'중립')+'</div>' +
    '</div>' +
    '<div style="background:'+entryColor+'12;border:1px solid '+entryColor+'30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">진입 등급</div>' +
      '<div style="font-size:18px;font-weight:900;color:'+entryColor+';font-family:var(--font-mono);">'+escHtml(entryData.grade)+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;color:'+entryColor+';">'+escHtml(entryData.reasoning)+'</div>' +
    '</div>' +
  '</div>';

  // Cross signals
  html += '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text-bright);margin-bottom:6px;">교차 신호 & 다이버전스</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;">' +
      '<span>20/50 SMA: <strong style="color:'+(crossData.gc20_50==='골든크로스'?'var(--data-green)':crossData.gc20_50==='데드크로스'?'var(--data-red)':'#999')+';">'+escHtml(crossData.gc20_50||'평탄')+'</strong></span>' +
      '<span>50/200 SMA: <strong style="color:'+(crossData.gc50_200==='골든크로스'?'var(--data-green)':crossData.gc50_200==='데드크로스'?'var(--data-red)':'#999')+';">'+escHtml(crossData.gc50_200||'평탄')+'</strong></span>' +
      '<span>RSI 다이버전스: <strong style="color:'+(divData.bullishDiv?'var(--data-green)':divData.bearishDiv?'var(--data-red)':'#999')+';">'+(divData.bullishDiv?'강세 다이버전스':divData.bearishDiv?'약세 다이버전스':'없음')+'</strong></span>' +
    '</div>' +
  '</div>';

  // MACD & BB — v46.9: macd null 가드 추가
  var _macdLine = (macd && macd.macdLine && macd.macdLine.length) ? macd.macdLine[macd.macdLine.length-1] : 0;
  var _sigLine = (macd && macd.signalLine && macd.signalLine.length) ? macd.signalLine[macd.signalLine.length-1] : 0;
  var _hist = (macd && macd.histogram && macd.histogram.length) ? macd.histogram[macd.histogram.length-1] : 0;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
    '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-bright);margin-bottom:4px;">MACD</div>' +
      '<div style="font-size:11px;color:var(--text-muted);">Line: '+_macdLine.toFixed(2)+' | Signal: '+_sigLine.toFixed(2)+'</div>' +
      '<div style="font-size:11px;color:'+(_hist>0?'var(--data-green)':'var(--data-red)')+';">Histogram: '+_hist.toFixed(2)+'</div>' +
    '</div>' +
    '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-bright);margin-bottom:4px;">볼린저 밴드</div>' +
      '<div style="font-size:11px;color:var(--text-muted);">Upper: '+bb.upper.toFixed(0)+' | Lower: '+bb.lower.toFixed(0)+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted);">%B: '+bb.pctB.toFixed(2)+' | Width: '+bb.width.toFixed(2)+'</div>' +
    '</div>' +
  '</div>';

  // Dip classification
  html += '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:8px;">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text-bright);margin-bottom:4px;">조정 분류</div>' +
    '<div style="font-size:11px;color:var(--text-muted);">'+escHtml(dipData.label)+' (점수: '+dipData.score+'/100)</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">'+escHtml(dipData.reasoning)+'</div>' +
  '</div>';

  // Verdict
  var verdict = escHtml(label) + ' 지수는 현재 Weinstein '+stageData.stage+'단계 ('+escHtml(stageData.label)+'). '+escHtml(trendData.position)+' 위치에서 RSI '+rsi.toFixed(1)+'. ';
  verdict += stageData.stage===2?'시장 상승세 진행 중.':stageData.stage===3?'고점 주의 구간.':stageData.stage===4?'하락 추세 주의.':'바닥 탐색 중.';

  html += '<div style="background:var(--surface-4);border:1px solid var(--border);border-radius:3px;padding:12px;margin-top:8px;font-size:11px;line-height:1.6;border-left:3px solid '+stageColor+';">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:6px;">'+escHtml(label)+' 종합 판정</div>' +
    '<div style="color:var(--text-muted);">'+verdict+'</div>' +
  '</div>';

  // Price footer
  html += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:8px;margin-top:8px;font-size:11px;color:var(--text-muted);text-align:center;">' +
    escHtml(label)+': '+currentPrice.toFixed(2)+' ('+(priceChange>0?'+':'')+priceChange.toFixed(2)+'%) | 데이터: 1년 일봉 | 업데이트: '+new Date().toLocaleTimeString('ko-KR') +
  '</div>';

  resultEl.innerHTML = html;
  } catch(e) {
    _aioLog('error', 'fetch', 'analyzeKrIndex error: ' + (e && e.message || e));
    if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">' + escHtml(label) + ' 분석 중 오류가 발생했습니다.</div>';
  }
}

// Korean ticker analysis (for Korean stock market)
async function analyzeKrTickerDeep(ticker) {
  if (!ticker || ticker.length === 0) {
    showToast('종목을 입력하세요 (예: 005930.KS, 000660.KS)');
    return;
  }

  var resultEl = document.getElementById('kr-ticker-analysis-result');
  if (!resultEl) resultEl = document.getElementById('ticker-analysis-result');
  if (!resultEl) return;

  resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><div style="font-size:12px;">분석 준비: ' + escHtml(ticker) + ' 기술적 분석...</div></div>';

  try {
  // Fetch chart data for Korean ticker
  var chartData = await _fetchYahooChartData(ticker);
  if (!chartData || !chartData.closes || chartData.closes.length < 50) {
    resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">차트 데이터를 불러올 수 없습니다. 종목코드를 확인하세요. (예: 005930.KS)</div>';
    return;
  }

  // Extract and analyze (same as US tickers)
  var c = chartData.closes.filter(function(x) { return x !== null; });
  var o = chartData.opens.filter(function(x) { return x !== null; });
  var h = chartData.highs.filter(function(x) { return x !== null; });
  var l = chartData.lows.filter(function(x) { return x !== null; });
  var v = chartData.volumes.filter(function(x) { return x !== null; });

  var stageData = _detectStage(o, h, l, c, v);
  var trendData = _detectTrendPosition(o, h, l, c, v);
  var dipData = _classifyDip(o, h, l, c, v);
  var entryData = _assessEntryQuality(o, h, l, c, v);
  var crossData = _detectCrossSignals(c);
  var divData = _detectDivergence(c);
  var rsi = _calcRSILast(c, 14);
  var macd = _calcMACD(c);
  var bb = _calcBB(c, 20, 2);

  var currentPrice = c[c.length - 1];
  var priceChange = c.length > 1 ? ((c[c.length - 1] - c[c.length - 2]) / c[c.length - 2]) * 100 : 0;

  var stageColors = ['#999', 'var(--data-cyan)', 'var(--data-green)', 'var(--data-amber)', 'var(--data-red)'];
  var stageColor = stageColors[stageData.stage] || '#999';
  var entryColor = entryData.grade === 'A+' ? 'var(--data-green)' : entryData.grade === 'A' ? 'var(--data-green)' : entryData.grade === 'B' ? 'var(--data-amber)' : 'var(--data-red)';
  var trendColor = trendData.alignment > 80 ? 'var(--data-green)' : 'var(--data-amber)';

  // Build result (same structure as US, just for Korean market)
  var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">' +
    '<div style="background:' + stageColor + '12;border:1px solid ' + stageColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Weinstein Stage</div>' +
      '<div style="font-size:18px;font-weight:900;color:' + stageColor + ';font-family:var(--font-mono);">' + stageData.stage + '단계</div>' +
      '<div style="font-size:11px;color:' + stageColor + ';margin-top:3px;">' + escHtml(stageData.label) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">확도 ' + Math.round(stageData.confidence * 100) + '%</div>' +
    '</div>' +
    '<div style="background:' + trendColor + '12;border:1px solid ' + trendColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">추세 위치</div>' +
      '<div style="font-size:14px;font-weight:900;color:' + trendColor + ';">' + escHtml(trendData.position) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">52W: ' + trendData.week52 + '% | Gap: ' + trendData.gapFrom20.toFixed(2) + '%</div>' +
    '</div>' +
    '<div style="background:#a78bba12;border:1px solid #a78bba30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">RSI (14)</div>' +
      '<div style="font-size:18px;font-weight:900;color:var(--data-purple);font-family:var(--font-mono);">' + rsi.toFixed(1) + '</div>' +
      '<div style="font-size:11px;color:var(--data-purple);margin-top:3px;">' + (rsi > 70 ? '과매수' : rsi < 30 ? '과매도' : '중립') + '</div>' +
    '</div>' +
    '<div style="background:' + entryColor + '12;border:1px solid ' + entryColor + '30;border-radius:3px;padding:10px;">' +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">진입 등급</div>' +
      '<div style="font-size:18px;font-weight:900;color:' + entryColor + ';font-family:var(--font-mono);">' + escHtml(entryData.grade) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;color:' + entryColor + ';">' + escHtml(entryData.reasoning) + '</div>' +
    '</div>' +
  '</div>';

  html += '<div style="background:var(--surface-4);border:1px solid var(--border);border-radius:3px;padding:12px;margin-top:12px;font-size:11px;line-height:1.6;border-left:3px solid ' + stageColor + ';">' +
    '<div style="font-weight:900;color:var(--text-bright);margin-bottom:6px;">종합 판정</div>' +
    '<div style="color:var(--text-muted);">' +
      '' + escHtml(ticker) + '는 ' + escHtml(stageData.label) + ' 중. ' +
      escHtml(trendData.position) + ' 위치에서 ' + escHtml(entryData.grade) + '등급 진입 기회. ' +
      (stageData.stage === 2 && trendData.alignment > 80 ? '강력한 상승 추세!' : '신호 확인 필요.') +
    '</div>' +
  '</div>';
  html += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">' +
    '<button data-action="showTicker" data-arg="' + escHtml(ticker) + '" style="padding:6px 14px;background:rgba(33,29,22,0.12);border:1px solid rgba(33,29,22,0.3);color:var(--data-cyan);font-size:11px;border-radius:3px;cursor:pointer;font-weight:700;">Ticker 상세 분석 → ↗</button>' +
  '</div>';

  resultEl.innerHTML = html;
  } catch(e) {
    _aioLog('error', 'fetch', 'analyzeKrTickerDeep error: ' + (e && e.message || e));
    if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">기술적 분석 중 오류가 발생했습니다. 다시 시도해주세요.</div>';
  }
}

// Entry Quality Calculator
function calculateEntryQualityLocal() {
  var price = parseFloat(document.getElementById('eq-price').value);
  var ema20 = parseFloat(document.getElementById('eq-ema20').value);
  var rsi = parseFloat(document.getElementById('eq-rsi').value);

  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ema20) || ema20 <= 0 || !Number.isFinite(rsi) || rsi < 0 || rsi > 100) {
    showToast('양수 가격·EMA와 0~100 RSI를 입력하세요');
    return;
  }

  var gap = (price - ema20) / ema20 * 100;
  var near20 = Math.abs(gap) <= 2.0;
  var above20 = gap >= 0;
  var neutralRSI = rsi >= 40 && rsi <= 70;
  var score = (near20 ? 1 : 0) + (above20 ? 1 : 0) + (neutralRSI ? 1 : 0);
  var grade = score === 3 ? '정렬 관찰' : score === 2 ? '혼합' : '주의';
  var gradeColor = score === 3 ? 'var(--data-green)' : score === 2 ? 'var(--data-amber)' : 'var(--data-red)';

  document.getElementById('entry-quality-result').style.display = 'block';
  document.getElementById('eq-grade-display').textContent = grade;
  document.getElementById('eq-grade-display').style.color = gradeColor;
  var barDiv = document.getElementById('eq-grade-bar').querySelector('div');
  if (barDiv) barDiv.style.width = (score / 3 * 100) + '%';
  document.getElementById('eq-fib-level').textContent = (gap >= 0 ? '+' : '') + gap.toFixed(2) + '%';
  document.getElementById('eq-stoploss').textContent = rsi < 40 ? '약한 모멘텀' : rsi > 70 ? '과열 관찰' : '중립 범위';

  document.getElementById('eq-explanation').textContent = '현재가와 20일 EMA의 거리, RSI만 비교한 관측값입니다. 거래량·변동성·시장 국면·무효화 가격이 없으므로 진입 승인이나 손절가를 산출하지 않습니다.';
}

// Risk/Reward Calculator
function calculateRR() {
  var entry = parseFloat(document.getElementById('rr-entry').value);
  var stop = parseFloat(document.getElementById('rr-stop').value);
  var capital = parseFloat(document.getElementById('rr-capital').value) || 10000;

  if (!entry || !stop || entry <= stop) {
    showToast('유효한 값을 입력하세요 (진입가 > 손절가)');
    return;
  }

  var risk = entry - stop;
  var riskPct = (risk / entry * 100).toFixed(1);
  var r1 = entry + risk;
  var r2 = entry + risk * 2;
  var r3 = entry + risk * 3;

  document.getElementById('rr-result').style.display = 'block';
  document.getElementById('rr-risk').textContent = '-$' + risk.toFixed(2) + ' (' + riskPct + '%)';
  document.getElementById('rr-1r').textContent = '$' + r1.toFixed(2);
  document.getElementById('rr-2r').textContent = '$' + r2.toFixed(2);
  document.getElementById('rr-3r').textContent = '$' + r3.toFixed(2);

  // Visual R:R bar
  var totalRange = risk * 4; // risk + 3R reward
  var riskWidth = (risk / totalRange * 100);
  var rewardWidth = (risk * 3 / totalRange * 100);
  document.getElementById('rr-risk-bar').style.width = riskWidth + '%';
  var rwBar = document.getElementById('rr-reward-bar');
  rwBar.style.left = riskWidth + '%';
  rwBar.style.width = rewardWidth + '%';
  document.getElementById('rr-ratio-text').textContent = '위험 1 : 보상 3 (R:R = 1:3)';

  // Position sizing (2% rule)
  var maxRisk = capital * 0.02;
  var shares = Math.floor(maxRisk / risk);
  var positionSize = (shares * entry).toFixed(0);
  document.getElementById('rr-position').textContent = '$' + Number(positionSize).toLocaleString();
  document.getElementById('rr-shares').textContent = shares + '주 (최대 손실 $' + (shares * risk).toFixed(0) + ')';
}

// ══════════════════════════════════════════════════════════════════
// v34.9: Phase 2-4 신규 기능 모음
// ══════════════════════════════════════════════════════════════════

// v52.13 P610/B7: TradingView KRX 임베드 하드 브레이크(FABLE-LIVE-AUDIT-2026-07-04.md P3) 대체.
// TradingView 무료 embed가 KRX 심볼에 "TradingView 에서만 제공되는 심볼입니다" 오류 모달을 반환하는
// 문제를 Naver 일봉 시세(fetchKrDailyCandles, js/aio-data.js) + Chart.js 자체 캔들/거래량 렌더로
// 완전 대체 — 외부 위젯 의존 제거. US technical/fundamental 페이지의 TradingView 임베드는 정상 작동 중이라 무변경.
function _krSma(closes, period) {
  var out = [];
  for (var i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) sum += closes[j];
    out.push(sum / period);
  }
  return out;
}

async function loadKrCandleChart(code) {
  code = String(code || '005930').replace(/\.(KS|KQ)$/i, '').trim();
  var priceCvs = document.getElementById('kr-candle-chart');
  var volCvs = document.getElementById('kr-candle-volume');
  var metaEl = document.querySelector('#kr-candle-meta [data-role="kr-candle-asof"]');
  if (!priceCvs || !volCvs) return;

  var existingFallback = priceCvs.parentElement && priceCvs.parentElement.querySelector('.aio-chart-fallback');
  if (existingFallback) existingFallback.remove();
  priceCvs.style.display = 'block'; volCvs.style.display = 'block';
  if (metaEl) metaEl.textContent = code + ' 일봉 데이터 수신 중...';

  var candles = null;
  try {
    candles = typeof fetchKrDailyCandles === 'function' ? await fetchKrDailyCandles(code, 120) : null;
  } catch (e) { candles = null; }

  if (!candles || candles.length < 5) {
    if (typeof _showChartFallback === 'function') {
      _showChartFallback(priceCvs, 'KR 일봉 차트(' + code + ')', 'Naver 시세 수신 실패 — 잠시 후 다시 시도하거나 종목코드를 확인하세요');
    }
    volCvs.style.display = 'none';
    if (metaEl) metaEl.textContent = code + ' 데이터 수신 실패';
    return;
  }

  var labels = candles.map(function(c) { return c.date.slice(5); });
  var closes = candles.map(function(c) { return c.close; });
  var sma20 = _krSma(closes, 20);
  var lows = candles.map(function(c) { return Number(c.low); }).filter(Number.isFinite);
  var highs = candles.map(function(c) { return Number(c.high); }).filter(Number.isFinite);
  var yMin = lows.length ? Math.min.apply(null, lows) : null;
  var yMax = highs.length ? Math.max.apply(null, highs) : null;
  var yPad = (yMin != null && yMax != null) ? Math.max((yMax - yMin) * 0.05, yMax * 0.005, 1) : 1;
  var ySuggestedMin = yMin != null ? Math.max(0, Math.floor(yMin - yPad)) : undefined;
  var ySuggestedMax = yMax != null ? Math.ceil(yMax + yPad) : undefined;
  var colors = candles.map(function(c) { return c.close >= c.open ? 'rgba(34,117,76,0.9)' : 'rgba(177,58,48,0.9)'; });
  var volColors = candles.map(function(c) { return c.close >= c.open ? 'rgba(34,117,76,0.5)' : 'rgba(177,58,48,0.5)'; });
  var tickColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
  var gridColor = 'var(--surface-3)';

  if (krTechCharts['krCandle'] && typeof krTechCharts['krCandle'].destroy === 'function') krTechCharts['krCandle'].destroy();
  if (krTechCharts['krCandleVol'] && typeof krTechCharts['krCandleVol'].destroy === 'function') krTechCharts['krCandleVol'].destroy();

  krTechCharts['krCandle'] = new Chart(priceCvs, {
    data: {
      labels: labels,
      datasets: [
        { type: 'bar', label: '고저', data: candles.map(function(c){ return [c.low, c.high]; }), backgroundColor: colors, barPercentage: 0.22, categoryPercentage: 0.9, borderWidth: 0 },
        { type: 'bar', label: '시-종', data: candles.map(function(c){ return [Math.min(c.open, c.close), Math.max(c.open, c.close)]; }), backgroundColor: colors, barPercentage: 0.7, categoryPercentage: 0.9, borderWidth: 0 },
        { type: 'line', label: 'MA20', data: sma20, borderColor: 'var(--data-cyan)', borderWidth: 1.3, pointRadius: 0, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { beginAtZero: false, suggestedMin: ySuggestedMin, suggestedMax: ySuggestedMax, ticks: { color: tickColor, callback: function(v){ return Number(v).toLocaleString(); } }, grid: { color: gridColor } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(items) { return candles[items[0].dataIndex].date; },
            label: function(item) {
              if (item.datasetIndex === 2) return 'MA20 ' + (item.raw != null ? Math.round(item.raw).toLocaleString() : '—');
              var c = candles[item.dataIndex];
              return ['시 ' + c.open.toLocaleString(), '고 ' + c.high.toLocaleString(), '저 ' + c.low.toLocaleString(), '종 ' + c.close.toLocaleString()];
            }
          }
        }
      }
    }
  });

  krTechCharts['krCandleVol'] = new Chart(volCvs, {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: candles.map(function(c){ return c.volume; }), backgroundColor: volColors, barPercentage: 0.8, categoryPercentage: 0.9, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { ticks: { color: tickColor, maxTicksLimit: 3, callback: function(v){ return (v >= 1e6) ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'K'; } }, grid: { color: gridColor } }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });

  var last = candles[candles.length - 1];
  if (metaEl) metaEl.textContent = code + ' 종가 ' + last.close.toLocaleString() + '원 (' + last.date + ' 기준) · Naver 일봉 ' + candles.length + '개';
}
window.loadKrCandleChart = loadKrCandleChart;

// ── Phase 2-1: TradingView 위젯 로드 ──
function loadTVChart(page) {
  var sym, containerId, ohlcSym;
  if (page === 'technical') {
    sym = (document.getElementById('tv-tech-sym') || {}).value || 'SPY';
    containerId = 'tv-widget-technical';
    ohlcSym = sym;
  } else if (page === 'fundamental') {
    sym = (document.getElementById('fund-search-input') || {}).value || 'AAPL';
    containerId = 'tv-widget-fundamental';
    var wrap = document.getElementById('tv-chart-fundamental');
    if (wrap) wrap.style.display = 'block';
    ohlcSym = sym;
  } else if (page === 'kr') {
    var krCode = (document.getElementById('tv-kr-sym') || {}).value || '005930';
    krCode = krCode.replace(/\.(KS|KQ)$/i, '').trim();
    if (typeof loadKrCandleChart === 'function') loadKrCandleChart(krCode);
    return;
  } else if (page === 'ticker') {
    // v53.6: ticker 종목 개요 대형 차트 — KR 종목은 P610(KRX 데이터 하드브레이크)으로 미지원
    sym = (window._currentTickerSym || 'NVDA').toUpperCase();
    if (/\.(KS|KQ)$/i.test(sym)) return;
    containerId = 'tv-widget-ticker';
    ohlcSym = sym;
  }
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  var widget = document.createElement('div');
  widget.innerHTML = '<iframe src="https://s.tradingview.com/widgetembed/?symbol=' + encodeURIComponent(sym) +
    '&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f7f4ee' +
    '&studies=MAExp%4020&studies=RSI%40defval&theme=light&style=1&timezone=Asia%2FSeoul' +
    '&withdateranges=1&showpopupbutton=1&locale=kr" style="width:100%;height:100%;border:none;" allowtransparency="true"></iframe>';
  container.appendChild(widget.firstChild);

  // v48.52→v52.41 (P656/EF-12): TradingView 하단 OHLC fallback strip 동기화
  if (page === 'technical') { try { _aioSyncTvOhlcFallback(ohlcSym); } catch(_e){} }
}

// v52.41 (P656/EF-12): 라이브 실측(Chrome MCP, v52.34) 결과 이 strip은 항상 "—"였다 — 원인은
// "차트가 안 보일 때 표시되는 대체 정보"라는 취지와 반대로, 이 sync 로직이 loadTVChart()(= "차트 로드"
// 버튼을 눌러 TradingView iframe을 실제로 로드할 때)의 부수효과로만 실행됐기 때문. 즉 대체 정보가
// 필요한 바로 그 상황(차트를 안 띄운 상태)에서는 절대 채워지지 않는 구조였다. 로직을 분리해
// technical 페이지 진입/라이브 시세 갱신 시에도 독립적으로 채우도록 함(차트 로드 여부와 무관).
function _aioSyncTvOhlcFallback(symOverride) {
  try {
    var sym = symOverride || (document.getElementById('tv-tech-sym') || {}).value || 'SPY';
    var ld = window._liveData || {};
    var live = ld[sym] || {};
    var strip = document.querySelector('#tv-tech-ohlc, .tv-ohlc-strip');
    if (!strip) return;
    var symEl = strip.querySelector('[data-tvohlc-sym]');
    var closeEl = strip.querySelector('[data-tvohlc-close]');
    var chgEl = strip.querySelector('[data-tvohlc-chg]');
    if (symEl) symEl.textContent = sym;
    if (closeEl) closeEl.textContent = (live.price != null) ? ('$' + live.price.toFixed(2)) : '—';
    if (chgEl) {
      if (live.pct != null) {
        chgEl.textContent = (live.pct >= 0 ? '+' : '') + live.pct.toFixed(2) + '%';
        chgEl.style.color = live.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      } else chgEl.textContent = '—';
    }
  } catch(_e) {}
}
try {
  if (typeof _aioPageBus !== 'undefined' && _aioPageBus.register) {
    _aioPageBus.register('html-tv-ohlc-fallback-shown', 'aio:pageShown', function(e) {
      if (e.detail !== 'technical') return;
      setTimeout(function() { _aioSyncTvOhlcFallback(); }, 200);
    });
    _aioPageBus.register('html-tv-ohlc-fallback-live', 'aio:liveQuotes', function() {
      var p = document.getElementById('page-technical');
      if (p && p.classList.contains('active')) _aioSyncTvOhlcFallback();
    });
  }
} catch(_registerTvOhlcErr) {}

// ═══ v53.6: ticker 종목 개요(밸리AI 참조 레이아웃) 렌더러 ═══════════════════
// 원칙: 실데이터만 표기(결측은 정직한 '—' + 사유 title), 새 병렬 계산 경로 없음(R276) —
// 시세는 _liveData, 수익률/팩터는 SCREENER_DB(스크리너 페이지와 동일 원천·동일 값)를 재사용.
window._aioRenderTickerOverview = function(tkr) {
  tkr = String(tkr || '').toUpperCase();
  if (!tkr) return;
  var isKr = /\.(KS|KQ)$/i.test(tkr);
  // 1) TradingView 대형 차트 — 동일 심볼이면 iframe 재로드하지 않음
  var tvC = document.getElementById('tv-widget-ticker');
  if (tvC) {
    if (isKr) {
      if (tvC.dataset.tvSym !== 'KR-UNSUPPORTED') {
        tvC.dataset.tvSym = 'KR-UNSUPPORTED';
        tvC.innerHTML = '<span style="font-size:12px;color:var(--text-muted);padding:12px;text-align:center;">한국 종목은 TradingView KRX 데이터 제한(P610)으로 미지원 — 한국 기술분석 페이지의 자체 캔들 차트를 이용하세요</span>';
      }
    } else if (tvC.dataset.tvSym !== tkr) {
      tvC.dataset.tvSym = tkr;
      try { loadTVChart('ticker'); } catch(_tvErr) {}
    }
  }
  // 2) 가격 정보 — 라이브 quote 결측 필드는 '—' 유지(합성 금지)
  var live = (window._liveData || {})[tkr] || {};
  var scrRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  var scr = Array.isArray(scrRows) ? (scrRows.find(function(r){ return r && r.sym === tkr; }) || null) : null;
  var cur = isKr ? '' : '$';
  function _set(id, txt, color, title) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    el.style.color = color || '';
    if (title) el.title = title; else el.removeAttribute('title');
  }
  var prev = Number(live.regularMarketPreviousClose || live.chartPreviousClose);
  _set('ticker-ov-prevclose', prev > 0 ? cur + prev.toFixed(2) : '—', null, prev > 0 ? null : '전일 종가 원천 미수신');
  var hi52 = Number(live.fiftyTwoWeekHigh), lo52 = Number(live.fiftyTwoWeekLow), price = Number(live.price);
  var bar = document.getElementById('ticker-ov-52wbar');
  if (hi52 > 0 && lo52 > 0 && hi52 > lo52) {
    _set('ticker-ov-52w', cur + lo52.toFixed(2) + ' ~ ' + cur + hi52.toFixed(2));
    if (bar && price > 0) {
      var pos = Math.max(0, Math.min(100, (price - lo52) / (hi52 - lo52) * 100));
      bar.style.display = 'block';
      var posEl = document.getElementById('ticker-ov-52wpos');
      if (posEl) posEl.style.left = pos.toFixed(1) + '%';
      bar.title = '52주 범위 내 현재가 위치: ' + pos.toFixed(0) + '%';
    } else if (bar) bar.style.display = 'none';
  } else {
    _set('ticker-ov-52w', '—', null, '52주 범위 원천 미수신');
    if (bar) bar.style.display = 'none';
  }
  function _fmtRet(v){ return (typeof v === 'number' && isFinite(v)) ? ((v >= 0 ? '+' : '') + v.toFixed(1) + '%') : '—'; }
  function _retCol(v){ return (typeof v === 'number' && isFinite(v)) ? (v >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)'; }
  ['1m','3m','6m'].forEach(function(k) {
    var v = scr ? scr['ret' + k] : null;
    _set('ticker-ov-ret' + k, _fmtRet(v), _retCol(v), (typeof v === 'number') ? '스크리너 관측 이력 기반 — 스크리너 페이지와 동일 값' : '스크리너 유니버스 외 종목 — 수익률 이력 미수신');
  });
  var prov = document.getElementById('ticker-ov-provenance');
  if (prov) {
    var srcs = [];
    var dsrc = window._dataSource && window._dataSource[tkr];
    if (price > 0) srcs.push('시세: ' + (live.source || (dsrc && dsrc.source) || 'live'));
    if (scr) srcs.push('수익률·팩터: 스크리너 아티팩트');
    prov.textContent = srcs.length ? srcs.join(' · ') : '원천 미수신 — 표시값 없음';
  }
  // 3) 관련 테마 칩 — THEME_MAP 소속 역조회 → theme-detail 이동
  var themesEl = document.getElementById('ticker-ov-themes');
  if (themesEl && typeof THEME_MAP !== 'undefined') {
    var hits = [];
    THEME_MAP.forEach(function(t) {
      var inLeaders = Array.isArray(t.leaders) && t.leaders.indexOf(tkr) >= 0;
      var subHit = null;
      (t.subThemes || []).forEach(function(st){ if (!subHit && Array.isArray(st.tickers) && st.tickers.indexOf(tkr) >= 0) subHit = st.name; });
      if (inLeaders || subHit) hits.push({ id: t.id, label: t.nameKr + (subHit ? ' · ' + subHit : '') });
    });
    themesEl.innerHTML = hits.length
      ? hits.map(function(h){ return '<span class="ticker-ov-theme-chip" role="button" tabindex="0" data-action="showThemeDetail" data-arg="' + escHtml(h.id) + '" title="' + escHtml(h.label) + ' 테마 상세 →">' + escHtml(h.label) + '</span>'; }).join('')
      : '<span style="font-size:11px;color:var(--text-muted);">테마 맵 미등록 종목</span>';
  }
  // 4) 팩터 프로파일 — SCREENER_DB factorScores(유니버스 내 상대 백분위, 서술적)
  var rowsEl = document.getElementById('ticker-ov-factor-rows');
  var radarC = document.getElementById('ticker-ov-factor-radar');
  var radarWrap = radarC && radarC.parentElement;
  if (scr && !scr.factorScores && typeof _aioComputeFactorRanks === 'function') { try { _aioComputeFactorRanks(); } catch(_frErr) {} }
  var fs = scr && scr.factorScores;
  var F_LBL = { momentum:'모멘텀', trend:'추세', lowvol:'저변동성', size:'사이즈', value:'밸류', quality:'퀄리티', kalman:'칼만추세' };
  if (fs && rowsEl) {
    var keys = Object.keys(fs).filter(function(k){ return typeof fs[k] === 'number' && isFinite(fs[k]); });
    rowsEl.innerHTML = keys.map(function(k) {
      return '<div class="ticker-ov-row"><span class="ov-lbl">' + escHtml(F_LBL[k] || k) + '</span><span class="ov-val">' + fs[k] + '</span></div>';
    }).join('');
    var sig = tkr + '|' + keys.map(function(k){ return k + ':' + fs[k]; }).join(',');
    if (radarC && typeof Chart !== 'undefined' && keys.length >= 3 && radarC.dataset.sig !== sig) {
      radarC.dataset.sig = sig;
      if (radarWrap) radarWrap.style.display = 'block';
      try {
        if (window._aioChartRegistry) window._aioChartRegistry.destroyIfExists('ticker-ov-factor-radar');
        var radarChart = new Chart(radarC.getContext('2d'), {
          type: 'radar',
          data: {
            labels: keys.map(function(k){ return F_LBL[k] || k; }),
            datasets: [{ data: keys.map(function(k){ return fs[k]; }), backgroundColor: 'rgba(34,117,76,0.12)', borderColor: '#22754c', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#22754c' }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 10 }, color: '#57513f' }, grid: { color: 'rgba(33,29,22,0.08)' }, angleLines: { color: 'rgba(33,29,22,0.08)' } } }
          }
        });
        if (window._aioChartRegistry) window._aioChartRegistry.register('ticker-ov-factor-radar', radarChart);
      } catch(_radarErr) {}
    } else if (radarWrap && (typeof Chart === 'undefined' || keys.length < 3)) {
      radarWrap.style.display = 'none';
    }
  } else if (rowsEl) {
    rowsEl.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">' + (scr ? '팩터 점수 미계산 — 스크리너 데이터 수신 대기' : '스크리너 유니버스 외 종목 — 팩터 백분위는 유니버스 내 상대값이라 제공되지 않습니다') + '</span>';
    if (radarWrap) radarWrap.style.display = 'none';
    if (radarC) radarC.dataset.sig = '';
    if (window._aioChartRegistry) window._aioChartRegistry.destroyIfExists('ticker-ov-factor-radar');
  }
};
try {
  if (typeof _aioPageBus !== 'undefined' && _aioPageBus.register) {
    _aioPageBus.register('html-ticker-overview-live', 'aio:liveQuotes', function() {
      var p = document.getElementById('page-ticker');
      if (p && p.classList.contains('active') && window._currentTickerSym) {
        try { window._aioRenderTickerOverview(window._currentTickerSym); } catch(_e) {}
      }
    });
  }
} catch(_registerTickerOvErr) {}

// ── Phase 2-2: McClellan Oscillator 계산 ──
var _mcData = { advEma19: null, advEma39: null, decEma19: null, decEma39: null, summation: 0, history: [] };
function calcMcClellan(advances, declines) {
  // EMA 계산 함수
  function ema(prev, val, period) {
    var k = 2 / (period + 1);
    return prev === null ? val : val * k + prev * (1 - k);
  }
  var adDiff = advances - declines;
  _mcData.advEma19 = ema(_mcData.advEma19, adDiff, 19);
  _mcData.advEma39 = ema(_mcData.advEma39, adDiff, 39);
  var oscillator = _mcData.advEma19 - _mcData.advEma39;
  _mcData.summation += oscillator;
  _mcData.history.push({ osc: oscillator, sum: _mcData.summation });
  if (_mcData.history.length > 100) _mcData.history.shift();
  return { oscillator: oscillator, summation: _mcData.summation };
}
function updateMcClellanUI() {
  // McClellan은 실제 일별 상승·하락 종목수 시계열이 필요하다. 50MA 상회율에서 역산하지 않는다.
  var breadthData = window._breadthLiveData || {};
  var advances = Number(breadthData.advances);
  var declines = Number(breadthData.declines);
  var historyOk = Array.isArray(breadthData.adHistory) && breadthData.adHistory.length >= 39;
  var mc = historyOk && isFinite(advances) && isFinite(declines) ? calcMcClellan(advances, declines) : null;
  var labels = document.querySelectorAll('.bb-label');
  labels.forEach(function(el) {
    if (el.textContent.indexOf('매클렐란') !== -1) {
      var row = el.closest('.breadth-bar-row');
      if (!row) return;
      var valEl = row.querySelector('.bb-val');
      var barEl = row.querySelector('.bb-bar');
      var badgeEl = row.querySelector('.bb-badge');
      if (!mc) {
        if (valEl) { valEl.textContent = '—'; valEl.style.color = 'var(--text-muted)'; valEl.title = '실제 일별 상승·하락 종목수 39일 시계열 미수신'; }
        if (barEl) { barEl.style.width = '0%'; barEl.style.background = 'var(--border)'; }
        if (badgeEl) { badgeEl.textContent = '판정 보류'; badgeEl.style.color = 'var(--text-muted)'; badgeEl.style.background = 'transparent'; }
        return;
      }
      var osc = mc.oscillator;
      var color = osc > 50 ? 'var(--data-green)' : osc > 0 ? 'var(--data-amber)' : osc > -50 ? 'var(--data-amber)' : 'var(--data-red)';
      var pct = Math.min(100, Math.max(5, 50 + osc / 2));
      var label = osc > 100 ? '강한 매수' : osc > 50 ? '매수 우세' : osc > 0 ? '약한 매수' : osc > -50 ? '약한 매도' : osc > -100 ? '매도 우세' : '강한 매도';
      if (valEl) { valEl.textContent = osc.toFixed(0); valEl.style.color = color; }
      if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = color; }
      if (badgeEl) { badgeEl.textContent = label; badgeEl.style.color = color; badgeEl.style.background = color.replace(')', ',0.1)').replace('rgb', 'rgba'); }
    }
  });
}

// ── Phase 2-4: 포트폴리오 SPY 벤치마크 비교 차트 ──
// v48.13: 포트폴리오 vs SPY 벤치마크 차트 — 기존 stub 수정 + SPY 30일 실데이터 + 필드명 교정
//   기존 버그: p.sym/p.avgCost/p.shares (getPortfolioData 실제 필드는 ticker/cost/qty) → 항상 0% 표시
//   수정: 올바른 필드 참조 + SPY Yahoo chart 1mo 실데이터 + 포트폴리오 종목 Yahoo chart 병렬(최대 10종목)
async function updateBenchmarkChart() {
  var canvas = document.getElementById('pf-benchmark-chart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width = canvas.parentElement.offsetWidth - 32;
  var H = canvas.height = 200;
  ctx.clearRect(0, 0, W, H);

  // 로딩 표시 — v48.61 R43 Canvas hex
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#8a8271'; ctx.textAlign = 'center';
  ctx.fillText('SPY 30일 실데이터 조회 중...', W/2, H/2);

  // 포트폴리오 데이터 수집 (v48.13: 실제 필드명 ticker/qty/cost 사용)
  var pfData = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  pfData = (pfData || []).filter(function(p){ return p && p.ticker && p.qty > 0 && p.cost > 0; });

  if (pfData.length === 0) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#8a8271'; ctx.textAlign = 'center';
    ctx.fillText('포트폴리오가 비어 있습니다', W/2, H/2 - 6);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('종목 추가 후 갱신 버튼 클릭', W/2, H/2 + 12);
    return;
  }

  // SPY 30일 실데이터 (Yahoo chart)
  var spySeries = null;
  try {
    var spyUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1mo';
    var r = await fetchViaProxy(spyUrl, 8000);
    if (r && r.ok) {
      var d = await r.json();
      var closes = ((((d||{}).chart||{}).result||[])[0]||{}).indicators;
      var arr = closes && closes.quote && closes.quote[0] && closes.quote[0].close;
      if (arr && arr.length > 0) {
        spySeries = arr.filter(function(v){ return v != null && !isNaN(v); });
      }
    }
  } catch(e) {}
  if (!spySeries || spySeries.length < 5) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#b13a30'; ctx.textAlign = 'center'; /* v48.61 R43 */
    ctx.fillText('SPY 시세 조회 실패 — 네트워크 확인', W/2, H/2);
    return;
  }
  var spyBase = spySeries[0];
  if (!isFinite(spyBase) || spyBase <= 0) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#b13a30'; ctx.textAlign = 'center';
    ctx.fillText('SPY 기준가 오류 — 데이터 소스 확인 필요', W/2, H/2);
    return;
  }
  var spyPct = spySeries.map(function(v){ return (v - spyBase) / spyBase * 100; });

  // 포트폴리오 30일 가중 수익률 (최대 10 종목 · 나머지는 현재 수익률 선형 분포)
  var topTickers = pfData.slice().sort(function(a,b){
    var ld_ = window._liveData || {};
    var vA = (ld_[a.ticker] && ld_[a.ticker].price ? ld_[a.ticker].price : a.cost) * a.qty;
    var vB = (ld_[b.ticker] && ld_[b.ticker].price ? ld_[b.ticker].price : b.cost) * b.qty;
    return vB - vA;
  }).slice(0, 10);
  var seriesPromises = topTickers.map(function(p){
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(p.ticker) + '?interval=1d&range=1mo';
    return fetchViaProxy(url, 6000).then(function(rr){
      if (!rr || !rr.ok) return null;
      return rr.json();
    }).then(function(dd){
      if (!dd || !dd.chart || !dd.chart.result || !dd.chart.result[0]) return null;
      var ind = dd.chart.result[0].indicators;
      var arr = ind && ind.quote && ind.quote[0] && ind.quote[0].close;
      if (!arr) return null;
      var clean = arr.filter(function(v){ return v != null && !isNaN(v); });
      if (clean.length < 5) return null;
      return { ticker: p.ticker, qty: p.qty, cost: p.cost, closes: clean };
    }).catch(function(){ return null; });
  });
  var tickerSeries = await Promise.all(seriesPromises);
  tickerSeries = tickerSeries.filter(function(s){ return s !== null; });
  var coveredSymSet = {};
  tickerSeries.forEach(function(s){ coveredSymSet[s.ticker] = true; });

  // 포트폴리오 현재가 기준 총 가치 (weight 계산용)
  let ld = window._liveData || {};
  var totalCurrentValue = 0;
  pfData.forEach(function(p){
    var cur = (ld[p.ticker] && ld[p.ticker].price > 0) ? ld[p.ticker].price : p.cost;
    totalCurrentValue += cur * p.qty;
  });
  if (totalCurrentValue <= 0) return;

  // 30일 포트폴리오 수익률 = top 종목들의 weighted daily % 합산 + 나머지는 현재 수익률 선형 분포
  var L = Math.min(30, spySeries.length);
  var pfPct = new Array(L).fill(0);
  var coveredWeight = 0;
  tickerSeries.forEach(function(s){
    var curPrice = (ld[s.ticker] && ld[s.ticker].price > 0) ? ld[s.ticker].price : s.closes[s.closes.length-1];
    var weight = (curPrice * s.qty) / totalCurrentValue;
    coveredWeight += weight;
    // 길이 맞추기 (종목별 거래일 달라질 수 있음)
    var arr = s.closes.slice(-L);
    var base = arr[0];
    if (!isFinite(base) || base <= 0) return;
    for (var i = 0; i < L; i++) {
      var pct = ((arr[Math.min(i, arr.length-1)] - base) / base) * 100;
      pfPct[i] += pct * weight;
    }
  });
  // 미커버 부분: 현재 누적 수익률 / 30일 선형 분포
  if (coveredWeight < 0.999) {
    var uncovTotal = 0, uncovInvested = 0;
    pfData.forEach(function(p){
      if (coveredSymSet[p.ticker]) return;
      var cur = (ld[p.ticker] && ld[p.ticker].price > 0) ? ld[p.ticker].price : p.cost;
      uncovTotal += cur * p.qty;
      uncovInvested += p.cost * p.qty;
    });
    var uncovReturn = uncovInvested > 0 ? ((uncovTotal - uncovInvested) / uncovInvested * 100) : 0;
    var uncovWeight = 1 - coveredWeight;
    for (var j = 0; j < L; j++) {
      pfPct[j] += uncovReturn * (j / (L - 1)) * uncovWeight;
    }
  }

  // 렌더
  ctx.clearRect(0, 0, W, H);
  var allVals = pfPct.concat(spyPct.slice(-L));
  var maxV = Math.max.apply(null, allVals);
  var minV = Math.min.apply(null, allVals);
  var range = Math.max(Math.abs(maxV), Math.abs(minV), 2);
  var padding = 20;
  var plotH = H - padding * 2;
  var yZero = padding + plotH / 2;
  var yScale = (plotH / 2) / range;

  // 0% 기준선
  ctx.strokeStyle = 'rgba(33,29,22,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0, yZero); ctx.lineTo(W, yZero); ctx.stroke(); ctx.setLineDash([]);

  // SPY 선 — v48.61 R43 Canvas hex (#211d16 = --data-cyan)
  var spyPlot = spyPct.slice(-L);
  ctx.strokeStyle = '#211d16'; ctx.lineWidth = 2; ctx.beginPath();
  for (var i = 0; i < L; i++) {
    var x = (i / (L - 1)) * W;
    var y = yZero - spyPlot[i] * yScale;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 포트폴리오 선 — v48.61 R43 Canvas hex (#22754c = data-green)
  ctx.strokeStyle = '#22754c'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (var i = 0; i < L; i++) {
    var x = (i / (L - 1)) * W;
    var y = yZero - pfPct[i] * yScale;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 레이블
  var pfFinal = pfPct[L-1];
  var spyFinal = spyPlot[L-1];
  var alpha = pfFinal - spyFinal;
  var alphaColor = alpha >= 0 ? '#22754c' : '#b13a30';
  ctx.textAlign = 'left';
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#22754c';
  ctx.fillText('내 포트폴리오: ' + (pfFinal>=0?'+':'') + pfFinal.toFixed(1) + '% (30일)', 10, 16);
  ctx.fillStyle = '#211d16';
  ctx.fillText('SPY: ' + (spyFinal>=0?'+':'') + spyFinal.toFixed(1) + '% (30일)', 10, 32);
  ctx.fillStyle = alphaColor;
  ctx.fillText('Alpha: ' + (alpha>=0?'+':'') + alpha.toFixed(1) + '%p', 10, 48);

  // 커버리지 표시 — v48.61 P37+R43
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#8a8271'; ctx.textAlign = 'right';
  ctx.fillText('일별 실데이터 커버리지: ' + (coveredWeight * 100).toFixed(0) + '% · Yahoo 30일', W - 10, H - 8);
}

// ── Phase 2-6: 가격 알림 시스템 ──
var _priceAlerts = JSON.parse(localStorage.getItem('aio_price_alerts') || '[]');
function removePriceAlert(idx) {
  _priceAlerts.splice(idx, 1);
  localStorage.setItem('aio_price_alerts', JSON.stringify(_priceAlerts));
  renderPriceAlerts();
}
function renderPriceAlerts() {
  var el = document.getElementById('price-alerts-list');
  if (!el) return;
  if (!_priceAlerts.length) { el.innerHTML = '<span style="color:var(--text-muted);">설정된 알림이 없습니다.</span>'; return; }
  var html = '';
  _priceAlerts.forEach(function(a, i) {
    var cLabel = a.cond === 'above' ? '≥' : '≤';
    var statusColor = a.active ? 'var(--data-green)' : 'var(--text-muted)';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--surface-4);">' +
      '<span style="color:' + statusColor + ';">●</span> ' +
      '<span style="font-family:var(--font-mono);font-weight:700;">' + a.sym + '</span> ' +
      cLabel + ' $' + a.price.toFixed(2) +
      ' <button data-action="removePriceAlert" data-arg="' + escHtml(i) + '" aria-label="가격 알림 삭제" style="background:none;border:none;color:var(--data-red);cursor:pointer;font-size:12px;margin-left:auto;" title="삭제"></button></div>';
  });
  el.innerHTML = html;
}
function checkPriceAlerts() {
  let ld = window._liveData || {};
  _priceAlerts.forEach(function(a) {
    if (!a.active) return;
    var d = ld[a.sym];
    if (!d || !d.price) return;
    var triggered = (a.cond === 'above' && d.price >= a.price) || (a.cond === 'below' && d.price <= a.price);
    if (triggered) {
      a.active = false;
      localStorage.setItem('aio_price_alerts', JSON.stringify(_priceAlerts));
      showToast(' 알림! ' + a.sym + ' 현재가 $' + d.price.toFixed(2) + ' → 목표가 $' + a.price.toFixed(2) + ' 도달');
      renderPriceAlerts();
    }
  });
}

function getNextBOK() {
  var schedule = [[0,16],[1,27],[3,17],[4,29],[6,10],[7,28],[9,16],[10,27]];
  var now = new Date(), year = now.getFullYear();
  for (var i = 0; i < schedule.length; i++) {
    var d = new Date(year, schedule[i][0], schedule[i][1]);
    if (d > now) return year + '-' + String(schedule[i][0]+1).padStart(2,'0') + '-' + String(schedule[i][1]).padStart(2,'0');
  }
  return (year+1) + '-01-16';
}

// ── Phase 4-1: 색각 이상 접근성 (▲/▼ 아이콘 병용) ──
function applyA11yIndicators() {
  // 등락 표시에 ▲/▼ 아이콘 추가
  document.querySelectorAll('[data-live-chg]').forEach(function(el) {
    var text = el.textContent.trim();
    if (!text || text === '—') return;
    var val = parseFloat(text);
    if (isNaN(val)) return;
    el.classList.remove('a11y-up', 'a11y-dn', 'a11y-hold');
    if (val > 0) el.classList.add('a11y-up');
    else if (val < 0) el.classList.add('a11y-dn');
    else el.classList.add('a11y-hold');
  });
}

// ── Phase 4-5: 다크/라이트 테마 전환 ──
// v52.62 아이보리 리디자인: 기본 테마가 dark→light(아이보리)로 반전되며 토글 클래스도
// light-theme→dark-theme로 롤네임(클래스 없음 = 기본 아이보리, 클래스 있음 = 그래파이트 다크).
// localStorage 값 의미는 기존과 동일('light'/'dark' = 현재 표시 중인 테마) — 마이그레이션 불필요:
// 과거 'light' 저장값을 가진 사용자는 클래스 미부착 상태(신규 기본 아이보리)로 자연 수렴한다.
function toggleTheme() {
  var body = document.body;
  var btn = document.getElementById('theme-toggle');
  body.classList.toggle('dark-theme');
  var isDark = body.classList.contains('dark-theme');
  if (btn) btn.textContent = isDark ? 'Dark' : 'Light';
  // v40.6: 사이드바 테마 버튼 라벨 동기화
  var sbLabel = document.getElementById('sidebar-theme-label');
  if (sbLabel) sbLabel.textContent = isDark ? '다크 모드' : '라이트 모드';
  localStorage.setItem('aio_theme', isDark ? 'dark' : 'light');
  // TradingView iframe 테마 업데이트
  document.querySelectorAll('iframe[src*="tradingview"]').forEach(function(f) {
    f.src = f.src.replace(/theme=(dark|light)/, 'theme=' + (isDark ? 'dark' : 'light'));
  });
}
// 테마 복원
(function() {
  var saved = localStorage.getItem('aio_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-theme');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = 'Dark';
    var sbLabel = document.getElementById('sidebar-theme-label');
    if (sbLabel) sbLabel.textContent = '다크 모드';
  }
})();

// ── v48.22 (P3-4): offline-first Service Worker 등록 ──
// 이전 v38.4 "완전 제거"에서 offline 지원으로 전환
// 전략: shell(index.html/manifest/version.json/Chart.js CDN)=Cache-First,
//       API(Yahoo/FRED/CBOE/CORS 프록시/RSS)=Network-First + 캐시 폴백
// 설치 실패해도 앱 자체는 정상 동작(PROGRESSIVE enhancement)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function() {
    // opt-out 플래그: localStorage.aio_sw_disabled = '1' 이면 SW 비활성
    try {
      if (localStorage.getItem('aio_sw_disabled') === '1') {
        // 이전 SW까지 완전 정리
        navigator.serviceWorker.getRegistrations().then(function(rs) { rs.forEach(function(r) { r.unregister(); }); });
        if (typeof caches !== 'undefined') { caches.keys().then(function(n) { n.forEach(function(k) { caches.delete(k); }); }); }
        return;
      }
    } catch(_e) {}
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function(reg) {
      if (typeof _aioLog === 'function') _aioLog('info', 'sw', 'SW registered, scope=' + (reg.scope || '/'));
      try { reg.update(); } catch(_updateErr) {}
      // 업데이트 감지
      if (reg.addEventListener) {
        reg.addEventListener('updatefound', function() {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function() {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // sw.js install의 skipWaiting + activate의 clients.claim이 현재 탭을 전환한다.
              if (typeof _aioLog === 'function') _aioLog('info', 'sw', '새 버전 설치됨 — 활성 controller 전환 대기');
            }
          });
        });
      }
    }).catch(function(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'sw', 'SW register failed: ' + (e && e.message || e));
    });
  });
}

// ── 주기적 업데이트 훅 ── v48.91: 타이머 레지스트리 등록
// v51.99/Phase3[A2]: _aioRegisterTimer(js/aio-core.js) 호출을 아래 기존 DOMContentLoaded 블록
// 안으로 이동(P556/R247 템플릿) — 이전엔 최상위 무방비 호출이라, defer 적용 시 예외가 나면 바로
// 다음 줄의 beforeunload 리스너 등록과 이 스크립트 블록의 나머지 전부가 등록되지 않는 가장 심각한
// 연쇄 실패 지점이었다(가격알림·접근성 인디케이터·McClellan 오실레이터·BOK 회의일 표시 전부 영향).
window.addEventListener('beforeunload', function() { _aioClearAllTimers(); }); // v48.91: 언로드 시 전체 정리

// ── P714: 첫 방문 투자 면책 고지 (1회, 확인 시까지 유지) ──
// 기존 면책은 guide 페이지 <details> 안에 접혀 있어 실질 도달률이 0에 가까웠다.
// 최초 방문 시 비차단 하단 바로 승격 — 확인 후 localStorage 플래그로 재표시 안 함.
(function() {
  try {
    if (localStorage.getItem('aio_disclaimer_ack_v1') === '1') return;
  } catch(_e) { return; } // storage 불가 환경(시크릿 등)에서는 매번 띄우는 대신 조용히 생략
  function mountDisclaimer() {
    if (document.getElementById('aio-first-visit-disclaimer')) return;
    var bar = document.createElement('div');
    bar.id = 'aio-first-visit-disclaimer';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', '투자 면책 고지');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99990;background:var(--bg-elevated,#f5f1e8);border-top:1px solid var(--border,#d8d2c4);box-shadow:0 -2px 12px rgba(33,29,22,0.12);padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;line-height:1.6;color:var(--text-secondary,#57513f);';
    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1;min-width:240px;';
    txt.innerHTML = '<b style="color:var(--text-primary);">투자 면책 고지</b> — 본 도구의 모든 수치·점수·시그널·AI 답변은 지연/스냅샷/참고용일 수 있으며 <b>투자 권유·자문·매매 지시가 아닙니다</b>. 내부 점수의 예측력은 검증되지 않았고 부분 백테스트에서는 음(−)의 상관이 관측됐습니다. 투자 결정과 그 결과는 이용자 본인에게 있습니다.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '확인했습니다';
    btn.style.cssText = 'flex-shrink:0;font-size:12.5px;font-weight:600;color:var(--text-primary,#211d16);background:var(--surface-2,#ece7db);border:1px solid var(--border,#d8d2c4);border-radius:6px;padding:7px 16px;cursor:pointer;';
    btn.addEventListener('click', function() {
      try { localStorage.setItem('aio_disclaimer_ack_v1', '1'); } catch(_e) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });
    bar.appendChild(txt);
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDisclaimer);
  else mountDisclaimer();
})();

// ── A-2 (2026-07-17, IA 잔여): 첫 방문 온보딩 — 브리핑/시장/학습 3버튼 ──
// v50.71 결정(첫 화면을 모달로 차단 금지)을 존중해 home 콘텐츠 상단의 비차단 인라인 카드로
// 1회 표시. 버튼 클릭(목적 달성) 또는 ✕로 닫으면 localStorage 플래그로 재표시 안 함.
(function() {
  try {
    if (localStorage.getItem('aio_onboarding_nav_v1') === '1') return;
  } catch(_e) { return; } // storage 불가 환경에서는 조용히 생략(P714 면책 바와 동일 정책)
  function dismissOnboarding() {
    try { localStorage.setItem('aio_onboarding_nav_v1', '1'); } catch(_e) {}
    var el = document.getElementById('aio-first-visit-onboarding');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function goPage(page) {
    dismissOnboarding();
    try {
      var navEl = document.querySelector('[data-action="showPage"][data-arg="' + page + '"]');
      if (typeof window.showPage === 'function') window.showPage(page, navEl);
    } catch(_e) {}
  }
  function mountOnboarding() {
    if (document.getElementById('aio-first-visit-onboarding')) return;
    var anchor = document.getElementById('home-score-hero');
    if (!anchor || !anchor.parentNode) return;
    var card = document.createElement('div');
    card.id = 'aio-first-visit-onboarding';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', '시작 안내');
    card.style.cssText = 'display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:var(--surface-1,#faf7f0);border:1px solid var(--border-strong,#c9c2b2);border-radius:6px;padding:14px 16px;margin-bottom:var(--space-3,16px);';
    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1;min-width:220px;font-size:12.5px;line-height:1.7;color:var(--text-secondary,#57513f);';
    txt.innerHTML = '<b style="color:var(--text-primary,#211d16);">처음 오셨나요?</b> — 어디서 시작할지 골라보세요. 이 카드는 한 번만 표시됩니다.';
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    [
      { label: '오늘 브리핑', desc: '시장 요약부터', page: 'briefing' },
      { label: '시장 환경', desc: '지표 한눈에', page: 'signal' },
      { label: '학습 가이드', desc: '용어·사용법', page: 'guide' }
    ].forEach(function(b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span style="font-weight:600;">' + b.label + '</span><span style="display:block;font-size:10.5px;font-weight:400;color:var(--text-muted,#8a8471);margin-top:2px;">' + b.desc + '</span>';
      btn.style.cssText = 'font-size:12.5px;color:var(--text-primary,#211d16);background:var(--surface-2,#ece7db);border:1px solid var(--border,#d8d2c4);border-radius:6px;padding:8px 14px;cursor:pointer;text-align:left;';
      btn.addEventListener('click', function() { goPage(b.page); });
      btnWrap.appendChild(btn);
    });
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', '시작 안내 닫기');
    closeBtn.textContent = '✕';
    // Keep the dismiss affordance keyboard/touch reachable even though the
    // visual glyph is intentionally compact (WCAG 2.5.8 target floor).
    closeBtn.style.cssText = 'flex-shrink:0;align-self:flex-start;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-muted,#8a8471);background:none;border:none;cursor:pointer;padding:2px 6px;';
    closeBtn.addEventListener('click', dismissOnboarding);
    card.appendChild(txt);
    card.appendChild(btnWrap);
    card.appendChild(closeBtn);
    anchor.parentNode.insertBefore(card, anchor);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountOnboarding);
  else mountOnboarding();
})();

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', function() {
  window._globalUpdateInterval = _aioRegisterTimer('globalUpdate', function() {
    checkPriceAlerts();
    applyA11yIndicators();
  }, 30000); // 30초마다 가격 알림 체크 + 접근성 아이콘 갱신
  renderPriceAlerts();
  applyA11yIndicators();
  updateMcClellanUI();
  // 경제 캘린더 동적 날짜 업데이트
  var bokEl = document.querySelector('[data-snap="bok-next"]');
  if (bokEl) bokEl.textContent = getNextBOK();
});