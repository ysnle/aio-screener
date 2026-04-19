// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 3: UI START (실제 분할 적용 v48.26)                ║
// ║  책임: Render + Page Router + Charts (18개) + Filters + Gauges            ║
// ║  의존성: MODULE 1 (stores) + MODULE 2 (data fetch/score/translate)        ║
// ║  Chart instances: sentPageCharts/bpChartInstances/bhChartInstances 등 11개 ║
// ║  주의: MODULE 1/2의 함수 호출은 모두 이벤트/타이머 콜백 내부 (즉시 호출 X) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// AAII Chart.js stacked bar + P/C sparkline
// ── Sentiment Page (dedicated) ────────────────────────────────────────
let sentPageInitialized = false;
const sentPageCharts = {};

// v40.4: 센티먼트 차트 데이터 동적 교체 (VIX, HYG → Yahoo Finance chart API)
async function _refreshSentimentChartData() {
  try {
    // VIX 차트 동적 교체
    var vixChart = sentPageCharts['vix'];
    if (vixChart && typeof _fetchYahooChartData === 'function') {
      var vixData = await _fetchYahooChartData('^VIX', '1mo');
      if (vixData && vixData.closes && vixData.closes.length >= 5) {
        var last20 = vixData.closes.slice(-20).filter(function(v) { return v != null; });
        var last20ts = vixData.timestamps.slice(-20);
        var labels = last20ts.map(function(ts) {
          var d = new Date(ts * 1000);
          return (d.getMonth() + 1) + '/' + d.getDate();
        }).slice(-last20.length);
        vixChart.data.labels = labels;
        vixChart.data.datasets[0].data = last20;
        vixChart.data.datasets[1].data = Array(labels.length).fill(20);
        vixChart.update('none');
        // 경고 배지 제거 (실시간 데이터 로드 성공)
        var badge = document.querySelector('#page-sentiment .stale-badge');
        if (badge) badge.textContent = 'VIX/HYG 실시간 차트 · ' + labels[labels.length - 1] + ' 기준';
        if (badge) { badge.style.background = 'rgba(61,219,165,0.1)'; badge.style.borderColor = 'rgba(61,219,165,0.3)'; badge.style.color = '#3ddba5'; }
      }
    }
    // HY OAS 프록시: HYG ETF 가격을 반전 사용 (HYG↓ = 스프레드↑)
    var hyChart = sentPageCharts['hy'];
    if (hyChart && typeof _fetchYahooChartData === 'function') {
      var hygData = await _fetchYahooChartData('HYG', '1mo');
      if (hygData && hygData.closes && hygData.closes.length >= 5) {
        var last12 = hygData.closes.slice(-12).filter(function(v) { return v != null; });
        var last12ts = hygData.timestamps.slice(-12);
        var hygLabels = last12ts.map(function(ts) {
          var d = new Date(ts * 1000);
          return (d.getMonth() + 1) + '/' + d.getDate();
        }).slice(-last12.length);
        // HYG 가격 → OAS 추정: 높은 HYG = 낮은 스프레드. 간이 변환: OAS ≈ (85 - HYG) * 20 + 250
        var oasEstimate = last12.map(function(p) { return Math.round((85 - p) * 20 + 250); });
        hyChart.data.labels = hygLabels;
        hyChart.data.datasets[0].data = oasEstimate;
        hyChart.update('none');
      }
    }
  } catch(e) { _aioLog('warn', 'chart', 'Sentiment chart refresh error: ' + (e && e.message || e)); }
}

// v48.22 (P2-C 2단계): initSentimentPage 4개 차트 개별 분리 — 공통 상수 모듈 수준 승격
var _SENT_COMMON = {
  tip: {
    backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    titleColor: '#9ca3af', bodyColor: '#e8ecf4',
    titleFont: { size: 9 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
    padding: 8
  },
  gridColor: 'rgba(255,255,255,0.05)',
  tickColor: 'rgba(255,255,255,0.3)',
  labels20: ['2/20','2/24','2/26','2/27','3/3','3/5','3/6','3/10','3/12','3/13','3/17','3/19','3/20','3/24','3/26','3/31','4/2','4/3','4/6','4/7','4/8','4/9','4/10','4/13','4/14','4/15']
};

// ── v48.22: VIX sparkline (개별 함수 — _lazyInit 래핑 가능)
// ── v48.24: lightweight-charts dual-path — AIO.charts.shouldUseLWC()이 true이면 LWC 경로, 아니면 Chart.js
function _initSentVixChart() {
  var vixCtx = document.getElementById('vix-chart');
  if (!vixCtx) return;
  var tip = _SENT_COMMON.tip, gridColor = _SENT_COMMON.gridColor, tickColor = _SENT_COMMON.tickColor, labels20 = _SENT_COMMON.labels20;
  var vixData = [19.09, 19.55, 18.63, 19.86, 23.57, 23.75, 29.49, 24.93, 27.29, 27.19, 22.37, 24.06, 25.50, 26.95, 30.20, 34.10, 23.87, 23.87, 24.17, 25.78, 21.04, 31.50, 31.10, 29.80, 18.36, 18.36];
  var _gVix = chartDataGate('vix-chart', labels20, [vixData], { minPoints: 3, chartName: 'VIX' });
  if (!_gVix) return;

  // v48.24 (P3-5 Phase 2 실제 전환): lightweight-charts 경로 시도
  if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
    try {
      var container = window.AIO.charts.wrapCanvas(vixCtx, 140);
      if (container) {
        var isoLabels = window.AIO.charts.monthDayToISO(labels20, new Date().getFullYear());
        var lwcData = vixData.map(function(v, i) { return { time: isoLabels[i], value: v }; });
        var lwcResult = window.AIO.charts.createLineChart(container, lwcData, {
          color: '#f97316',
          lineWidth: 2,
          height: 140,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
        });
        if (lwcResult && lwcResult.series) {
          // 20 (Fear) 참조선 추가
          try {
            lwcResult.series.createPriceLine({
              price: 20,
              color: 'rgba(248,113,113,0.5)',
              lineWidth: 1,
              lineStyle: 2, // dashed
              axisLabelVisible: true,
              title: 'Fear 20'
            });
          } catch(_){}
          sentPageCharts['vix'] = window.AIO.charts.createCompatWrapper(lwcResult, vixCtx, container);
          if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'VIX chart: lightweight-charts 경로 사용');
          return;
        }
      }
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC VIX 전환 실패, Chart.js 폴백: ' + (e && e.message || e));
    }
  }

  // Chart.js 경로 (폴백 or LWC 미지원)
  if (typeof Chart === 'undefined') return;
  sentPageCharts['vix'] = new Chart(vixCtx, {
    type: 'line',
    data: {
      labels: labels20,
      datasets: [{
        label: 'VIX', data: vixData,
        borderColor: '#f97316',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(249,115,22,0.25)'); g.addColorStop(1, 'rgba(249,115,22,0)');
          return g;
        },
        borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 3, tension: 0.3, fill: true
      }, {
        label: '20 (Fear)', data: Array(labels20.length).fill(20),
        borderColor: 'rgba(248,113,113,0.3)', borderWidth: 1, borderDash: [3,3],
        pointRadius: 0, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' ' + i.dataset.label + ': ' + i.formattedValue; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 7 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { min: 10, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 8 } }, border: { display: false } }
      }
    }
  });
}

// ── v48.22: NAAIM Exposure Index (개별 함수)
// ── v48.25: lightweight-charts dual-path (P3-5 Phase 2)
function _initSentNaaimChart() {
  var naaimCtx = document.getElementById('naaim-chart');
  if (!naaimCtx) return;
  var tip = _SENT_COMMON.tip, gridColor = _SENT_COMMON.gridColor, tickColor = _SENT_COMMON.tickColor;
  var naaimLabels = ['1/22','1/29','2/5','2/12','2/19','2/26','3/5','3/12','3/19','3/26','4/1','4/8'];
  var naaimData = [82.1, 79.3, 72.8, 68.4, 64.2, 63.5, 67.1, 67.0, 60.2, 62.5, 68.36, 69.38];
  var _gNaaim = chartDataGate('naaim-chart', naaimLabels, [naaimData], { minPoints: 3, chartName: 'NAAIM' });
  if (!_gNaaim) return;

  // v48.25 (P3-5 Phase 2): lightweight-charts 경로 시도
  if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
    try {
      var container = window.AIO.charts.wrapCanvas(naaimCtx, 140);
      if (container) {
        var isoLabels = window.AIO.charts.monthDayToISO(naaimLabels, new Date().getFullYear());
        var lwcData = naaimData.map(function(v, i) { return { time: isoLabels[i], value: v }; });
        var lwcResult = window.AIO.charts.createLineChart(container, lwcData, {
          color: '#5ba8ff',
          lineWidth: 2,
          height: 140,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
        });
        if (lwcResult && lwcResult.series) {
          // 62 (Avg) 참조선 추가
          try {
            lwcResult.series.createPriceLine({
              price: 62,
              color: 'rgba(255,255,255,0.3)',
              lineWidth: 1,
              lineStyle: 2, // dashed
              axisLabelVisible: true,
              title: 'Avg 62'
            });
          } catch(_){}
          sentPageCharts['naaim'] = window.AIO.charts.createCompatWrapper(lwcResult, naaimCtx, container);
          if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'NAAIM chart: lightweight-charts 경로 사용');
          return;
        }
      }
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC NAAIM 전환 실패, Chart.js 폴백: ' + (e && e.message || e));
    }
  }

  // Chart.js 경로 (폴백 or LWC 미지원)
  if (typeof Chart === 'undefined') return;
  sentPageCharts['naaim'] = new Chart(naaimCtx, {
    type: 'line',
    data: {
      labels: naaimLabels,
      datasets: [{
        label: 'NAAIM', data: naaimData,
        borderColor: '#5ba8ff',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(91,168,255,0.2)'); g.addColorStop(1, 'rgba(91,168,255,0)');
          return g;
        },
        borderWidth: 1.8, pointRadius: 2, pointHoverRadius: 4, tension: 0.3, fill: true
      }, {
        label: 'Avg (62)', data: Array(naaimLabels.length).fill(62),
        borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [3,3],
        pointRadius: 0, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' ' + i.dataset.label + ': ' + i.formattedValue + '%'; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 7 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { min: 0, max: 100, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 8 }, callback: function(v){ return v + '%'; } }, border: { display: false } }
      }
    }
  });
}

// ── v48.22: Investors Intelligence Bull/Bear (개별 함수)
// ── v48.25: lightweight-charts dual-path (P3-5 Phase 2) — multi-line
function _initSentIIChart() {
  var iiCtx = document.getElementById('ii-chart');
  if (!iiCtx) return;
  var tip = _SENT_COMMON.tip, gridColor = _SENT_COMMON.gridColor, tickColor = _SENT_COMMON.tickColor;
  var iiLabels = ['1/8','1/22','2/5','2/12','2/19','2/26','3/5','3/12','3/19','3/26','4/2','4/9'];
  var iiBull = [49.3, 46.7, 44.1, 40.8, 37.2, 33.5, 31.2, 29.4, 28.2, 26.5, 25.1, 24.0];
  var iiBear = [22.8, 25.3, 27.9, 30.4, 33.1, 36.8, 38.5, 40.2, 41.5, 43.2, 44.8, 46.0];
  var _gII = chartDataGate('ii-chart', iiLabels, [iiBull, iiBear], { minPoints: 3, chartName: 'II Bull/Bear' });
  if (!_gII) return;

  // v48.25 (P3-5 Phase 2): lightweight-charts 경로 시도 — multi-line (Bull + Bear)
  if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
    try {
      var container = window.AIO.charts.wrapCanvas(iiCtx, 140);
      if (container) {
        var isoLabels = window.AIO.charts.monthDayToISO(iiLabels, new Date().getFullYear());
        var bullData = iiBull.map(function(v, i) { return { time: isoLabels[i], value: v }; });
        var bearData = iiBear.map(function(v, i) { return { time: isoLabels[i], value: v }; });
        var lwcResult = window.AIO.charts.createMultiLineChart(container, [
          { name: 'Bulls', color: '#3ddba5', lineWidth: 2, data: bullData },
          { name: 'Bears', color: '#f87171', lineWidth: 2, data: bearData }
        ], { height: 140 });
        if (lwcResult && lwcResult.series) {
          sentPageCharts['ii'] = window.AIO.charts.createCompatWrapper(lwcResult, iiCtx, container);
          if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'II chart: lightweight-charts 경로 사용 (multi-line)');
          return;
        }
      }
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC II 전환 실패, Chart.js 폴백: ' + (e && e.message || e));
    }
  }

  // Chart.js 경로 (폴백 or LWC 미지원)
  if (typeof Chart === 'undefined') return;
  sentPageCharts['ii'] = new Chart(iiCtx, {
    type: 'line',
    data: {
      labels: iiLabels,
      datasets: [{
        label: 'Bulls', data: iiBull,
        borderColor: '#3ddba5', borderWidth: 1.8, pointRadius: 2, pointHoverRadius: 4, tension: 0.3, fill: false
      }, {
        label: 'Bears', data: iiBear,
        borderColor: '#f87171', borderWidth: 1.8, borderDash: [4,2], pointRadius: 2, pointHoverRadius: 4, tension: 0.3, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' ' + i.dataset.label + ': ' + i.formattedValue + '%'; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 7 } }, border: { display: false } },
        y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 8 }, callback: function(v){ return v + '%'; } }, border: { display: false } }
      }
    }
  });
}

// ── v48.22: HY Credit Spread (개별 함수)
// ── v48.25: lightweight-charts dual-path (P3-5 Phase 2)
function _initSentHYChart() {
  var hyCtx = document.getElementById('hy-chart');
  if (!hyCtx) return;
  var tip = _SENT_COMMON.tip, gridColor = _SENT_COMMON.gridColor, tickColor = _SENT_COMMON.tickColor, labels20 = _SENT_COMMON.labels20;
  var hyData = [278, 285, 282, 290, 305, 312, 340, 325, 335, 338, 310, 328, 335, 348, 362, 385, 316, 316, 317, 324, 301, 310, 294, 308, 285, 284];
  var _gHY = chartDataGate('hy-chart', labels20, [hyData], { minPoints: 3, chartName: 'HY OAS' });
  if (!_gHY) return;

  // v48.25 (P3-5 Phase 2): lightweight-charts 경로 시도
  if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
    try {
      var container = window.AIO.charts.wrapCanvas(hyCtx, 160);
      if (container) {
        var isoLabels = window.AIO.charts.monthDayToISO(labels20, new Date().getFullYear());
        var lwcData = hyData.map(function(v, i) { return { time: isoLabels[i], value: v }; });
        var lwcResult = window.AIO.charts.createLineChart(container, lwcData, {
          color: '#fb923c',
          lineWidth: 2,
          height: 160,
          priceFormat: { type: 'price', precision: 0, minMove: 1 }
        });
        if (lwcResult && lwcResult.series) {
          sentPageCharts['hy'] = window.AIO.charts.createCompatWrapper(lwcResult, hyCtx, container);
          if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'HY chart: lightweight-charts 경로 사용');
          return;
        }
      }
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC HY 전환 실패, Chart.js 폴백: ' + (e && e.message || e));
    }
  }

  // Chart.js 경로 (폴백 or LWC 미지원)
  if (typeof Chart === 'undefined') return;
  sentPageCharts['hy'] = new Chart(hyCtx, {
    type: 'line',
    data: {
      labels: labels20,
      datasets: [{
        label: 'HY OAS', data: hyData,
        borderColor: '#fb923c',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(251,146,60,0.2)'); g.addColorStop(1, 'rgba(251,146,60,0)');
          return g;
        },
        borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 3, tension: 0.3, fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' HY OAS: ' + i.formattedValue + 'bp'; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 7 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 8 }, callback: function(v){ return v + 'bp'; } }, border: { display: false } }
      }
    }
  });
}

function initSentimentPage(forceReinit) {
  if (typeof Chart === 'undefined') return;
  renderStaleWarning('page-sentiment');
  if (sentPageInitialized && !forceReinit) {
    try { Object.values(sentPageCharts).forEach(c => c.resize()); } catch(e) {}
    return;
  }
  Object.values(sentPageCharts).forEach(c => { try { c.destroy(); } catch(e){ _aioLog('warn', 'chart', 'Chart destroy error: ' + (e && e.message || e)); } });
  sentPageInitialized = true;
  sentChartsInitialized = false;

  initSentimentCharts();

  if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 300);

  _refreshSentimentChartData();

  // v48.22 (P2-C 2단계): 4개 차트 개별 _lazyInit — 뷰포트 진입 시에만 Chart.js 생성
  // 뷰포트 진입 관찰 대상이 각 canvas 자체 → 섹션별로 개별 트리거 (스크롤 아래 차트는 진짜 lazy)
  if (typeof _lazyInitChartPage === 'function') {
    _lazyInitChartPage('sentiment', 'vix-chart', _initSentVixChart);
    _lazyInitChartPage('sentiment', 'naaim-chart', _initSentNaaimChart);
    _lazyInitChartPage('sentiment', 'ii-chart', _initSentIIChart);
    _lazyInitChartPage('sentiment', 'hy-chart', _initSentHYChart);
  } else {
    _initSentVixChart(); _initSentNaaimChart(); _initSentIIChart(); _initSentHYChart();
  }

  fgUpdateNeedle((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 15);
  fetchFearGreed();
  fetchPutCall();
}

let sentChartsInitialized = false;

function initSentimentCharts() {
  if (typeof Chart === 'undefined') return;
  if (sentChartsInitialized) return;
  // v30.10: Destroy previous AAII/PC charts if any
  ['aaii','pc'].forEach(k => { if (sentPageCharts[k]) { try { sentPageCharts[k].destroy(); } catch(e){} } });
  sentChartsInitialized = true;

  // ─ AAII stacked horizontal bar ─────────────────────────────────────
  const aaiiCtx = document.getElementById('aaii-chart');
  if (aaiiCtx) {
    const aaiiLabels = ['4/8', '4/1', '3/25', '3/18']; // v46.6: 4/8(4/10 발표) 추가
    // Bull / Neutral / Bear — v45.0: aaii.com 실데이터 검증 완료 (3/25 중립 18.1→수정, 약세 49.8→수정)
    // v46.6: 4/8(4/10 발표) Bull 35.7 Neutral 21.3 Bear 43.0
    const aaiiDatasets = [[35.7, 33.6, 32.1, 30.4], [21.3, 15.0, 18.1, 17.6], [43.0, 51.4, 49.8, 52.0]];
    // v31.9: 텍스트 폴백 동적 업데이트
    var _aaiiBearEl = document.getElementById('aaii-bear-val');
    var _aaiiBullEl = document.getElementById('aaii-bull-val');
    var _aaiiSignal = document.getElementById('aaii-signal-badge');
    var latestBear = aaiiDatasets[2][0]; // 최신 약세 비율
    var latestBull = aaiiDatasets[0][0]; // 최신 강세 비율
    if (_aaiiBearEl) _aaiiBearEl.textContent = latestBear.toFixed(1) + '%';
    if (_aaiiBullEl) _aaiiBullEl.textContent = latestBull.toFixed(1) + '%';
    window._aaiiBearish = latestBear;
    // v46.10: signal 페이지 regime-aaii 동적 연결
    var _regAaii = document.getElementById('regime-aaii');
    if (_regAaii) {
      _regAaii.textContent = latestBear.toFixed(1) + '%';
      _regAaii.style.color = latestBear > 50 ? '#f87171' : latestBear > 40 ? '#fbbf24' : '#3ddba5';
    }
    var _regAaiiSub = _regAaii ? _regAaii.nextElementSibling : null;
    if (_regAaiiSub) _regAaiiSub.textContent = latestBear > 50 ? '극단 비관 (역발상)' : latestBear > 40 ? '비관 우세' : '정상 범위';
    if (_aaiiSignal) {
      if (latestBear > 50) _aaiiSignal.innerHTML = '<span style="font-size:8px;font-weight:700;color:#f87171;">● 극단적 비관</span><span style="font-size:9px;color:var(--text-muted);margin-left:4px;">(역발상 매수 시그널)</span>';
      else if (latestBear > 40) _aaiiSignal.innerHTML = '<span style="font-size:8px;font-weight:700;color:#fbbf24;">● 비관 우세</span>';
      else _aaiiSignal.innerHTML = '<span style="font-size:8px;font-weight:700;color:#3ddba5;">● 정상 범위</span>';
    }
    var _gAaii = chartDataGate('aaii-chart', aaiiLabels, aaiiDatasets, { minPoints: 3, chartName: 'AAII' }); if (_gAaii)
    sentPageCharts['aaii'] = new Chart(aaiiCtx, {
      type: 'bar',
      data: {
        labels: aaiiLabels,
        datasets: [
          { label: '강세', data: aaiiDatasets[0],
            backgroundColor: 'rgba(61,219,165,0.7)', borderRadius: 2 },
          { label: '중립', data: aaiiDatasets[1],
            backgroundColor: 'rgba(107,114,128,0.6)', borderRadius: 2 },
          { label: '약세', data: aaiiDatasets[2],
            backgroundColor: 'rgba(248,113,113,0.75)', borderRadius: 2 },
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            titleColor: '#9ca3af', bodyColor: '#e8ecf4',
            titleFont: { size: 9 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
            callbacks: { label: i => ' ' + i.dataset.label + ': ' + i.formattedValue + '%' }
          }
        },
        scales: {
          x: { stacked: true, max: 100,
               grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 }, callback: v => v + '%' },
               border: { display: false } },
          y: { stacked: true,
               grid: { display: false },
               ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 8 } },
               border: { display: false } }
        }
      }
    });
  }

  // ─ Put/Call 1M sparkline ─────────────────────────────────────────
  // ── v48.26: lightweight-charts dual-path (P3-5 Phase 5) — priceLine 활용 (중립선 0.7)
  const pcCtx = document.getElementById('pc-chart');
  if (pcCtx) {
    // CBOE Equity P/C Ratio (추정치, 실거래일 기준)
    const pcLabels = ['2/20','2/24','2/26','2/27','3/3','3/5','3/6','3/10','3/12','3/13','3/17','3/19','3/22','3/23','3/25','3/27','3/30','4/1','4/2','4/3','4/6','4/7','4/8','4/9','4/10','4/13','4/14','4/15']; // v47.3: 4/15 연장 (S&P 7000 돌파 동반 PCR 추가 하락)
    // v46.10: 4/14(0.58 재협상 기대→풋 감소 추정)
    const pcData   = [0.72,0.75,0.74,0.78,0.82,0.80,0.92,0.85,0.88,0.90,0.82,0.88,1.08,1.02,0.92,0.82,0.66,0.62,0.59,0.65,0.68,0.74,0.61,0.55,0.51,0.72,0.58,0.55]; // v47.3: 4/15 PCR 0.55 (콜옵션 과매수 심화)
    var _gPC = chartDataGate('pc-chart', pcLabels, [pcData], { minPoints: 3, chartName: 'Put/Call Ratio' });
    if (_gPC && window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _pcContainer = window.AIO.charts.wrapCanvas(pcCtx, 160);
        if (_pcContainer) {
          var _pcIso = window.AIO.charts.monthDayToISO(pcLabels, new Date().getFullYear());
          var _pcLwcData = pcData.map(function(v, i) { return { time: _pcIso[i], value: v }; });
          var _pcLwc = window.AIO.charts.createLineChart(_pcContainer, _pcLwcData, {
            color: '#fbbf24',
            lineWidth: 2,
            height: 160,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
          });
          if (_pcLwc && _pcLwc.series) {
            try {
              _pcLwc.series.createPriceLine({
                price: 0.7,
                color: 'rgba(255,255,255,0.3)',
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: '중립 0.7'
              });
            } catch(_){}
            sentPageCharts['pc'] = window.AIO.charts.createCompatWrapper(_pcLwc, pcCtx, _pcContainer);
            if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'PC chart: lightweight-charts 경로 사용 (priceLine 0.7)');
          }
        }
      } catch(_pcE) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC PC 전환 실패, Chart.js 폴백: ' + (_pcE && _pcE.message || _pcE));
      }
    }
    if (_gPC && !sentPageCharts['pc'])
    sentPageCharts['pc'] = new Chart(pcCtx, {
      type: 'line',
      data: {
        labels: pcLabels,
        datasets: [{
          label: 'P/C', data: pcData,
          borderColor: '#fbbf24',
          backgroundColor: (ctx2) => {
            const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
            g.addColorStop(0, 'rgba(251,191,36,0.2)'); g.addColorStop(1, 'rgba(251,191,36,0)');
            return g;
          },
          borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 3, tension: 0.3, fill: true,
        }, {
          label: '중립선(0.7)', data: Array(pcLabels.length).fill(0.7),
          borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [3,3],
          pointRadius: 0, fill: false, tension: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            titleColor: '#9ca3af', bodyColor: '#e8ecf4',
            titleFont: { size: 8 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
            filter: i => i.datasetIndex === 0,
            callbacks: { label: i => ' P/C: ' + i.formattedValue }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 7 }, maxTicksLimit: 5 }, border: { display: false } },
          y: { min: 0.5, max: 1.2,
               grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 7 }, maxTicksLimit: 4 },
               border: { display: false } }
        }
      }
    });
  }
}


// ── Weinstein Stage Analysis Update ──────────────────────────────────
function updateWSAnalysis() {
  var el = document.getElementById('ws-analysis');
  if (!el) return;
  var ld = window._liveData || {};
  var spy = ld['SPY'], rsp = ld['RSP'];

  var spyPct = spy ? (spy.pct != null ? spy.pct : 0) : 0;
  var breadth = (typeof window._breadth200 === 'number') ? window._breadth200 : ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.breadth200 : 75);

  var stage, color, advice;
  if (breadth > 65 && spyPct > 0) {
    stage = 'Stage 2 (상승)'; color = '#3ddba5';
    advice = '건강한 상승 추세. 강한 RS 종목 매수 유지. 추세 추종 전략 유효.';
  } else if (breadth > 45 && breadth <= 65) {
    stage = 'Stage 3 (천장 형성)'; color = '#fbbf24';
    advice = '시장 폭 축소 중. 이익 실현 고려. 손절선 타이트하게 관리. 신규 매수 축소.';
  } else if (breadth > 25 && breadth <= 45) {
    stage = 'Stage 4 (하락)'; color = '#f87171';
    advice = '약세 시장. 현금 비중 확대. 방어 섹터(유틸·헬스케어) 위주. 공격적 매수 자제.';
  } else {
    stage = 'Stage 1 (바닥 형성)'; color = '#60a5fa';
    advice = '극단적 약세 후 바닥 탐색 중. 역발상 매수 기회 탐색. 소량 분할 매수 고려.';
  }

  el.innerHTML = '<div style="margin-bottom:8px;"><span style="font-size:15px;font-weight:700;color:' + color + ';">' + stage + '</span></div>' +
    '<div style="color:#a0aab8;font-size:13px;line-height:1.5;">' + advice + '</div>' +
    '<div style="margin-top:8px;font-size:11px;color:#7e8a9e;">200일선 위 종목: ' + breadth.toFixed(1) + '% | SPY 일간: ' + spyPct.toFixed(2) + '%</div>';
}

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
  if (!b5) { el.textContent = '시장폭 데이터 로딩 대기 중...'; return; }

  var verdict = '', color = '', bg = '';
  if (b5 > 70 && b50 > 60) {
    verdict = ' <b>브레드스 쓰러스트 수준</b> — 5SMA ' + b5.toFixed(0) + '% · 50SMA ' + b50.toFixed(0) + '%. 극히 높은 참여율. 진짜 바닥 확인 가능성. 리더주 셋업 완성 시 적극 매수.';
    color = '#3ddba5'; bg = 'rgba(61,219,165,0.08)';
  } else if (b5 > 50 && b20 > 40) {
    verdict = ' <b>고품질 랠리</b> — 5SMA ' + b5.toFixed(0) + '% · 20SMA ' + b20.toFixed(0) + '%. 광범위 참여. Follow-through 진행 중. 리테스트 대기하며 선별 매수 가능.';
    color = '#60a5fa'; bg = 'rgba(96,165,250,0.08)';
  } else if (b5 > 30) {
    verdict = ' <b>품질 미확인 랠리</b> — 5SMA ' + b5.toFixed(0) + '%. 제한적 참여. 숏커버링 주도 가능성. 첫 며칠은 노이즈 — 후속 확인 필요. 관망 유지.';
    color = '#fbbf24'; bg = 'rgba(251,191,36,0.08)';
  } else {
    verdict = ' <b>과매도/숏커버링</b> — 5SMA ' + b5.toFixed(0) + '%. 소수 종목만 반등. 가장 많이 빠진 종목이 가장 많이 오르는 저품질 패턴. 신규 매수 중단. RS 상위 종목 워치리스트만 구축.';
    color = '#f87171'; bg = 'rgba(248,113,113,0.08)';
  }
  el.innerHTML = verdict;
  el.style.borderColor = color;
  el.style.background = bg;
}

// v42.4: 브레드쓰 바 동적 갱신 — signal 페이지 + breadth 페이지 NDX 카드
function updateBreadthBars() {
  function _bbColor(v) { return v >= 50 ? '#3ddba5' : v >= 30 ? '#fbbf24' : '#f87171'; }
  function _bbBg(v)    { return v >= 50 ? 'rgba(61,219,165,0.1)' : v >= 30 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)'; }
  function _bbLbl(v)   { return v >= 60 ? '강세' : v >= 50 ? '중립↑' : v >= 35 ? '중립↓' : '약세'; }
  var rows = [
    { bar:'bb-5sma-bar',  val:'bb-5sma-val',  badge:'bb-5sma-badge',  v: window._breadth5 },
    { bar:'bb-20sma-bar', val:'bb-20sma-val', badge:'bb-20sma-badge', v: window._breadth200 },
    { bar:'bb-50sma-bar', val:'bb-50sma-val', badge:'bb-50sma-badge', v: window._breadth50 },
  ];
  rows.forEach(function(r) {
    if (r.v == null) return;
    var c = _bbColor(r.v), bg = _bbBg(r.v), lbl = _bbLbl(r.v);
    var barEl = document.getElementById(r.bar), valEl = document.getElementById(r.val), bdgEl = document.getElementById(r.badge);
    if (barEl)  { barEl.style.width = r.v + '%'; barEl.style.background = c; }
    if (valEl)  { valEl.textContent = r.v + '%'; valEl.style.color = c; }
    if (bdgEl)  { bdgEl.textContent = lbl; bdgEl.style.color = c; bdgEl.style.background = bg; }
  });
  // breadth 페이지 NDX 카드
  [ ['bp-ndx5-val', window._breadthNDX5], ['bp-ndx20-val', window._breadthNDX20], ['bp-ndx50-val', window._breadthNDX50] ]
    .forEach(function(p) {
      var el = document.getElementById(p[0]);
      if (el && p[1] != null) { el.textContent = p[1] + '%'; el.style.color = _bbColor(p[1]); }
    });
}

function initBreadthPage(forceReinit) {
  if (typeof Chart === 'undefined') return;
  // v40.4: 날만 데이터 경고
  renderStaleWarning('page-breadth');
  if (bpChartsInitialized && !forceReinit) {
    try { Object.values(bpChartInstances).forEach(c => c.resize()); } catch(e) {}
    return;
  }
  // Destroy existing if reinit
  Object.values(bpChartInstances).forEach(c => { try { c.destroy(); } catch(e){ _aioLog('warn', 'chart', 'BP chart destroy error: ' + (e && e.message || e)); } });
  bpChartsInitialized = true;

  // Yahoo Finance SPY/QQQ 종가 기반 (v42.4: 2026-03-06 ~ 04-02, 20거래일. 4/3 Good Friday 휴장)
  const bpLabels = ['3/6','3/9','3/10','3/11','3/12','3/13',
    '3/16','3/17','3/18','3/19','3/20','3/23','3/24','3/25','3/26','3/27',
    '3/30','3/31','4/1','4/2','4/3','4/6','4/7','4/8']; // v45.2: 4/8 연장 (휴전 후 위험선호 확산)

  const bpSPY   = [640,635,638,633,628,631,635,643,648,655,651,647,650,644,640,636,639,634,629,622,620,623,638,648];
  const bpQQQ   = [556,550,554,548,544,547,551,558,563,569,565,561,564,558,554,549,552,547,542,534,532,535,551,563];
  // v45.4: 사용자 제공 SPY+S5TW+S5FI+S5TH+NDFI+R2TH 차트(4/8) 기반 실값 정정
  // S5TW=75.49(20SMA), S5FI=46.41(50SMA), S5TH=54.98(200SMA), NDFI=48.51(NDX 50SMA), R2TH=56.00(R2K 200SMA)
  const bpSPX5  = [42, 40, 41, 39, 37, 38, 40, 43, 44, 43, 42, 40, 41, 39, 38, 36, 37, 39, 38, 37.8, 37.5, 39.0, 55, 68];   // $SPXA5R — 4/7=55(중간 회복), 4/8=68(추가 랠리, 5SMA가 가장 빠름)
  const bpNDX5  = [38, 36, 37, 35, 33, 35, 37, 39, 40, 40, 38, 36, 37, 35, 34, 32, 33, 36, 35, 33.4, 33.2, 35.0, 50, 65];   // MNFD — 4/7=50, 4/8=65(NDX 5SMA)
  const bpSPX20 = [36, 35, 34, 33, 32, 33, 34, 35, 36, 37, 36, 35, 34, 33, 32, 31, 32, 33, 32, 32.0, 31.8, 32.5, 58, 75];   // $SPXA20R / S5TW — 4/8=75.49(이미지)
  // ── v14: Breadth200 최신값을 전역 변수에 캐싱 (computeTradingScore 참조용) ──
  const bpNDX20 = [28, 27, 26, 25, 24, 25, 26, 27, 28, 28, 27, 26, 25, 24, 23, 22, 23, 24, 23, 23.2, 23.0, 23.8, 55, 72];   // MNTW — 4/7=55, 4/8=72(NDX 20SMA, S5TW와 비슷한 패턴)
  const bpSPX50 = [38, 37, 36, 35, 34, 34, 35, 36, 37, 38, 37, 36, 35, 34, 33, 32, 32, 33, 32, 31.8, 31.5, 32.2, 38, 46];   // $SPXA50R / S5FI — 4/8=46.41(이미지 확정값) — 50SMA는 가장 느림
  const bpNDX50 = [34, 33, 32, 31, 30, 30, 31, 32, 33, 33, 32, 31, 30, 29, 28, 28, 29, 29, 28, 27.6, 27.4, 28.2, 40, 49];   // MNFI / NDFI — 4/8=48.51(이미지 확정값)
  // ── 전역 캐싱: computeTradingScore + updateRallyQualityVerdict 참조용 ──
  window._breadth200 = bpSPX20[bpSPX20.length - 1]; // 20SMA above %
  window._breadth5 = bpSPX5[bpSPX5.length - 1];     // 5SMA above %
  window._breadth50 = bpSPX50[bpSPX50.length - 1];   // 50SMA above %
  // v42.4: NDX 전역 캐싱 추가 — updateBreadthBars() 참조용
  window._breadthNDX5  = bpNDX5[bpNDX5.length - 1];
  window._breadthNDX20 = bpNDX20[bpNDX20.length - 1];
  window._breadthNDX50 = bpNDX50[bpNDX50.length - 1];
  const n       = bpLabels.length;

  Chart.defaults.font.family = "'Inter', 'Noto Sans KR', sans-serif";

  // ─ Shared style helpers ──────────────────────────────────────────
  const xScale = (showLabels) => ({
    grid:   { color: 'rgba(255,255,255,0.05)', drawBorder: false },
    ticks:  { color: 'rgba(255,255,255,0.3)', font: { size: 8 },
              maxTicksLimit: 7, display: showLabels, maxRotation: 0 },
    border: { display: false }
  });
  const tip = {
    backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, titleColor: '#9ca3af', bodyColor: '#e8ecf4',
    padding: 8, titleFont: { size: 9 },
    bodyFont: { family: 'JetBrains Mono, monospace', size: 10 }
  };

  // Cross-panel sync: draw vertical cursor line on all breadth charts
  // v30.10: 중복 등록 방지 — 이미 등록된 플러그인이면 스킵
  const crosshairPlugin = {
    id: 'bpCrosshair',
    afterDraw(chart) {
      if (!chart._cursorX) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(chart._cursorX, chart.chartArea.top);
      ctx.lineTo(chart._cursorX, chart.chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };
  // v30.10: 중복 등록 방지
  if (!Chart.registry.plugins.get('bpCrosshair')) {
    Chart.register(crosshairPlugin);
  }

  function syncCursor(sourceChart, x) {
    Object.values(bpChartInstances).forEach(c => {
      if (c === sourceChart) return;
      c._cursorX = x;
      c.draw();
    });
  }

  // ─ Helper: build a breadth line chart ────────────────────────────
  function makeBreadthPanel(canvasId, spxData, ndxData, spxColor, gradAlpha) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    // v30.11: 차트 데이터 검증 게이트
    var _gBp = chartDataGate(canvasId, bpLabels, [spxData, ndxData], { minPoints: 3, chartName: canvasId });
    if (!_gBp) return null;
    const ref80 = Array(n).fill(80);
    const ref50 = Array(n).fill(50);
    const ref20 = Array(n).fill(20);
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: bpLabels,
        datasets: [
          // Reference lines (hidden from tooltip)
          { label: '_80', data: ref80, borderColor: 'rgba(61,219,165,0.2)',  borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          { label: '_50', data: ref50, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          { label: '_20', data: ref20, borderColor: 'rgba(248,113,113,0.25)', borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          // SPX (solid blue + fill)
          { label: 'SPX', data: spxData, borderColor: spxColor,
            backgroundColor: (ctx2) => {
              const g = ctx2.chart.ctx.createLinearGradient(0,0,0,ctx2.chart.height);
              // spxColor is hex (#rrggbb); convert to rgba
              const hex = spxColor.replace('#','');
              const r=parseInt(hex.slice(0,2),16),gv=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
              g.addColorStop(0, `rgba(${r},${gv},${b},${gradAlpha})`);
              g.addColorStop(1, `rgba(${r},${gv},${b},0)`);
              return g;
            },
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: true },
          // NDX (dashed red)
          { label: 'NDX', data: ndxData, borderColor: '#f87171',
            borderWidth: 1.6, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { ...tip,
            filter: i => !i.dataset.label.startsWith('_'),
            callbacks: { label: i => ' ' + i.dataset.label + ': ' + i.formattedValue + '%' }
          }
        },
        scales: {
          x: xScale(true),
          y: { min: 0, max: 100,
               grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 },
                        callback: v => v + '%', stepSize: 20 },
               border: { display: false } }
        },
        onHover(e, els, chart) {
          if (e.native && chart.chartArea) {
            const rect = chart.canvas.getBoundingClientRect();
            const x = e.native.clientX - rect.left;
            if (x >= chart.chartArea.left && x <= chart.chartArea.right) {
              chart._cursorX = x;
              syncCursor(chart, x);
            }
          }
        }
      }
    });
    // v30.10: named handler for cleanup
    function bpMouseLeave() {
      Object.values(bpChartInstances).forEach(c => { c._cursorX = null; c.draw(); });
    }
    if (ctx._bpMouseLeave) ctx.removeEventListener('mouseleave', ctx._bpMouseLeave);
    ctx._bpMouseLeave = bpMouseLeave;
    ctx.addEventListener('mouseleave', bpMouseLeave);
    return chart;
  }

  // ─ Panel 0: Price ────────────────────────────────────────────────
  // ── v48.26: lightweight-charts dual-path (P3-5 Phase 4) — LWC 모드는 syncCursor 무력화
  const priceCtx = document.getElementById('bp-price-chart');
  if (priceCtx) {
    var _gBpPrice = chartDataGate('bp-price-chart', bpLabels, [bpSPY, bpQQQ], { minPoints: 3, chartName: 'Breadth: SPY/QQQ' });
    if (_gBpPrice && window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _bpContainer = window.AIO.charts.wrapCanvas(priceCtx, 180);
        if (_bpContainer) {
          var _bpIso = window.AIO.charts.monthDayToISO(bpLabels, new Date().getFullYear());
          var _bpSpyData = bpSPY.map(function(v, i) { return { time: _bpIso[i], value: v }; });
          var _bpQqqData = bpQQQ.map(function(v, i) { return { time: _bpIso[i], value: v }; });
          var _bpLwc = window.AIO.charts.createMultiLineChart(_bpContainer, [
            { name: 'SPY', color: '#5ba8ff', lineWidth: 2, data: _bpSpyData },
            { name: 'QQQ', color: '#f87171', lineWidth: 2, data: _bpQqqData }
          ], { height: 180 });
          if (_bpLwc && _bpLwc.series) {
            bpChartInstances['price'] = window.AIO.charts.createCompatWrapper(_bpLwc, priceCtx, _bpContainer);
            if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'bp-price chart: lightweight-charts 경로 사용 (multi-line, syncCursor 무력화)');
          }
        }
      } catch(_bpE) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC bp-price 전환 실패, Chart.js 폴백: ' + (_bpE && _bpE.message || _bpE));
      }
    }
    if (_gBpPrice && !bpChartInstances['price'])
    bpChartInstances['price'] = new Chart(priceCtx, {
      type: 'line',
      data: {
        labels: bpLabels,
        datasets: [
          { label: 'SPY', data: bpSPY, borderColor: '#5ba8ff',
            backgroundColor: (ctx2) => {
              const g = ctx2.chart.ctx.createLinearGradient(0,0,0,ctx2.chart.height);
              g.addColorStop(0,'rgba(91,168,255,0.2)'); g.addColorStop(1,'rgba(91,168,255,0)'); return g;
            },
            borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: true },
          { label: 'QQQ', data: bpQQQ, borderColor: '#f87171',
            borderWidth: 1.6, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { ...tip, callbacks: { label: i => ' ' + i.dataset.label + ': $' + i.formattedValue } }
        },
        scales: {
          x: xScale(false),
          y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 },
                        callback: v => '$' + v, maxTicksLimit: 5 },
               border: { display: false } }
        },
        onHover(e, els, chart) {
          if (e.native && chart.chartArea) {
            const rect = chart.canvas.getBoundingClientRect();
            const x = e.native.clientX - rect.left;
            if (x >= chart.chartArea.left && x <= chart.chartArea.right) {
              chart._cursorX = x;
              syncCursor(chart, x);
            }
          }
        }
      }
    });
    // v30.10: named handler for cleanup
    function bpPriceMouseLeave() {
      Object.values(bpChartInstances).forEach(c => { c._cursorX = null; c.draw(); });
    }
    priceCtx._bpMouseLeave = bpPriceMouseLeave;
    priceCtx.addEventListener('mouseleave', bpPriceMouseLeave);
  }

  // ─ Panels 1-3: Breadth ──────────────────────────────────────────
  bpChartInstances['5ma']  = makeBreadthPanel('bp-5ma-chart',  bpSPX5,  bpNDX5,  '#5ba8ff', 0.18);
  bpChartInstances['20ma'] = makeBreadthPanel('bp-20ma-chart', bpSPX20, bpNDX20, '#5ba8ff', 0.15);
  bpChartInstances['50ma'] = makeBreadthPanel('bp-50ma-chart', bpSPX50, bpNDX50, '#fb923c', 0.15);

  // Update Weinstein analysis
  updateWSAnalysis();

  // v27.2: bh-* 히스토리 차트도 초기화 (Section 5-B)
  initBreadthCharts();

  // v40.4: SPY/QQQ 가격 차트 동적 교체 (Yahoo Finance)
  _refreshBreadthPriceChart();
  // v46.6: A-D ratio 시계열 차트 (bpSPX5 데이터 활용)
  // ── v48.26: lightweight-charts dual-path (P3-5 Phase 5) — 점별 색상 손실 수용, priceLine 50%
  var adCanvas = document.getElementById('bp-ad-ratio-chart');
  if (adCanvas && bpSPX5 && bpLabels) {
    if (bpChartInstances['ad-ratio']) { try { bpChartInstances['ad-ratio'].destroy(); } catch(_){} }
    // A-D ratio = 5SMA above % (상승 비율과 동일 의미)
    var adColors = bpSPX5.map(function(v) { return v >= 50 ? '#3ddba5' : v >= 35 ? '#fbbf24' : '#f87171'; });

    // LWC 경로 시도
    var _adLwcOk = false;
    if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _adContainer = window.AIO.charts.wrapCanvas(adCanvas, 140);
        if (_adContainer) {
          var _adIso = window.AIO.charts.monthDayToISO(bpLabels, new Date().getFullYear());
          var _adLwcData = bpSPX5.map(function(v, i) { return { time: _adIso[i], value: v }; });
          var _adLwc = window.AIO.charts.createLineChart(_adContainer, _adLwcData, {
            color: '#60a5fa',
            lineWidth: 2,
            height: 140,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
          });
          if (_adLwc && _adLwc.series) {
            try {
              _adLwc.series.createPriceLine({
                price: 50,
                color: 'rgba(61,219,165,0.4)',
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: '50%'
              });
            } catch(_){}
            bpChartInstances['ad-ratio'] = window.AIO.charts.createCompatWrapper(_adLwc, adCanvas, _adContainer);
            if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'AD-ratio chart: lightweight-charts 경로 사용 (priceLine 50%, 점별 색상 손실)');
            _adLwcOk = true;
          }
        }
      } catch(_adE) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC AD-ratio 전환 실패, Chart.js 폴백: ' + (_adE && _adE.message || _adE));
      }
    }
    if (!_adLwcOk)
    bpChartInstances['ad-ratio'] = new Chart(adCanvas, {
      type: 'line',
      data: {
        labels: bpLabels,
        datasets: [{
          label: '상승 비율 (%)', data: bpSPX5,
          borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)',
          borderWidth: 2, pointRadius: 3, pointBackgroundColor: adColors,
          fill: true, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0b4c8', font: { size: 8 }, callback: function(v) { return v + '%'; } } },
          x: { grid: { display: false }, ticks: { color: '#a0b4c8', font: { size: 7 }, maxTicksLimit: 8 } }
        },
        plugins: {
          legend: { display: false },
          annotation: { annotations: { fiftyLine: { type: 'line', yMin: 50, yMax: 50, borderColor: 'rgba(61,219,165,0.3)', borderWidth: 1, borderDash: [4,4], label: { display: true, content: '50%', position: 'end', color: '#3ddba5', font: { size: 8 } } } } }
        }
      }
    });
  }
  // v42.4: signal 페이지 브레드쓰 바 + breadth 페이지 NDX 카드 동기 갱신
  updateBreadthBars();
}

async function _refreshBreadthPriceChart() {
  try {
    var priceChart = bpChartInstances['price'];
    if (!priceChart || typeof _fetchYahooChartData !== 'function') return;
    var [spyData, qqqData] = await Promise.all([
      _fetchYahooChartData('SPY', '1mo'),
      _fetchYahooChartData('QQQ', '1mo')
    ]);
    if (spyData && spyData.closes && spyData.closes.length >= 5 &&
        qqqData && qqqData.closes && qqqData.closes.length >= 5) {
      var len = Math.min(spyData.closes.length, qqqData.closes.length, 20);
      var spyCloses = spyData.closes.slice(-len).map(function(v) { return v != null ? Math.round(v) : null; });
      var qqqCloses = qqqData.closes.slice(-len).map(function(v) { return v != null ? Math.round(v) : null; });
      var labels = spyData.timestamps.slice(-len).map(function(ts) {
        var d = new Date(ts * 1000);
        return (d.getMonth() + 1) + '/' + d.getDate();
      });
      priceChart.data.labels = labels;
      priceChart.data.datasets[0].data = spyCloses;
      priceChart.data.datasets[1].data = qqqCloses;
      priceChart.update('none');
      // 경고 배지 업데이트
      var badge = document.querySelector('#page-breadth .stale-badge');
      if (badge) {
        badge.textContent = 'SPY/QQQ 실시간 차트 · ' + labels[labels.length - 1] + ' 기준';
        badge.style.background = 'rgba(61,219,165,0.1)';
        badge.style.borderColor = 'rgba(61,219,165,0.3)';
        badge.style.color = '#3ddba5';
      }
    }
  } catch(e) { _aioLog('warn', 'chart', 'Breadth price chart refresh error: ' + (e && e.message || e)); }
}

// v41.2: bh-price 히스토리 차트도 Yahoo Finance 동적 교체
async function _refreshBreadthHistoryCharts() {
  try {
    var priceChart = bhChartInstances['price'];
    if (!priceChart || typeof _fetchYahooChartData !== 'function') return;
    var [spyData, qqqData] = await Promise.all([
      _fetchYahooChartData('SPY', '1mo'),
      _fetchYahooChartData('QQQ', '1mo')
    ]);
    if (spyData && spyData.closes && spyData.closes.length >= 5 &&
        qqqData && qqqData.closes && qqqData.closes.length >= 5) {
      var len = Math.min(spyData.closes.length, qqqData.closes.length, 20);
      var spyCloses = spyData.closes.slice(-len).map(function(v) { return v != null ? Math.round(v) : null; });
      var qqqCloses = qqqData.closes.slice(-len).map(function(v) { return v != null ? Math.round(v) : null; });
      var labels = spyData.timestamps.slice(-len).map(function(ts) {
        var d = new Date(ts * 1000);
        return (d.getMonth() + 1) + '/' + d.getDate();
      });
      priceChart.data.labels = labels;
      priceChart.data.datasets[0].data = spyCloses;
      priceChart.data.datasets[1].data = qqqCloses;
      priceChart.update('none');
    }
  } catch(e) { _aioLog('warn', 'chart', 'Breadth history price chart refresh error: ' + (e && e.message || e)); }
}

// ── Market Breadth Charts (Chart.js) ─────────────────────────────────
let bhChartsInitialized = false;
const bhChartInstances = {};

function initBreadthCharts() {
  if (typeof Chart === 'undefined') return;
  if (bhChartsInitialized) {
    // Already created — just resize to fit newly visible panel
    try { Object.values(bhChartInstances).forEach(c => c.resize()); } catch(e) {}
    return;
  }
  // v30.10: Destroy previous instances before reinit
  Object.values(bhChartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  Object.keys(bhChartInstances).forEach(k => delete bhChartInstances[k]);
  bhChartsInitialized = true;

  // v42.4: bh 히스토리 차트도 bp 패널과 동일 범위 (2026-03-06 ~ 04-02) 동기화
  const bhLabels = ['3/6','3/9','3/10','3/11','3/12','3/13',
    '3/16','3/17','3/18','3/19','3/20','3/23','3/24','3/25','3/26','3/27',
    '3/30','3/31','4/1','4/2'];

  const bhSPY   = [640,635,638,633,628,631,635,643,648,655,651,647,650,644,640,636,639,634,629,622];
  const bhQQQ   = [556,550,554,548,544,547,551,558,563,569,565,561,564,558,554,549,552,547,542,534];
  // 5MA: 단기 이동평균 위 비율
  const bhSPX5   = [42, 40, 41, 39, 37, 38, 40, 43, 44, 43, 42, 40, 41, 39, 38, 36, 37, 39, 38, 37.8];  // $SPXA5R est.
  const bhNDX5   = [38, 36, 37, 35, 33, 35, 37, 39, 40, 40, 38, 36, 37, 35, 34, 32, 33, 36, 35, 33.4];  // MNFD actual
  // 20MA: 단기 추세 위 비율
  const bhSPX20  = [36, 35, 34, 33, 32, 33, 34, 35, 36, 37, 36, 35, 34, 33, 32, 31, 32, 33, 32, 32.0];  // $SPXA20R est.
  const bhNDX20  = [28, 27, 26, 25, 24, 25, 26, 27, 28, 28, 27, 26, 25, 24, 23, 22, 23, 24, 23, 23.2];  // MNTW actual
  // 50MA: 중기 추세 위 비율
  const bhSPX50  = [38, 37, 36, 35, 34, 34, 35, 36, 37, 38, 37, 36, 35, 34, 33, 32, 32, 33, 32, 31.8];  // $SPXA50R est.
  const bhNDX50  = [34, 33, 32, 31, 30, 30, 31, 32, 33, 33, 32, 31, 30, 29, 28, 28, 29, 29, 28, 27.6];  // MNFI actual

  Chart.defaults.font.family = "'Inter', 'Noto Sans KR', sans-serif";
  Chart.defaults.color = 'rgba(255,255,255,0.28)';

  const xScale = {
    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
    ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 }, maxRotation: 0, maxTicksLimit: 7 },
    border: { display: false }
  };

  const tipStyle = {
    backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    titleColor: '#9ca3af', bodyColor: '#e8ecf4', padding: 8,
    titleFont: { family: 'Inter', size: 9 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 10 }
  };

  // ── Price chart ──────────────────────────────────────────────────────
  // ── v48.26: lightweight-charts dual-path (P3-5 Phase 4) — multi-line SPY/QQQ
  const priceCtx = document.getElementById('bh-price-chart');
  if (priceCtx) {
    var _gBhPrice = chartDataGate('bh-price-chart', bhLabels, [bhSPY, bhQQQ], { minPoints: 3, chartName: 'Breadth History: SPY/QQQ' });
    if (_gBhPrice && window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _bhContainer = window.AIO.charts.wrapCanvas(priceCtx, 180);
        if (_bhContainer) {
          var _bhIso = window.AIO.charts.monthDayToISO(bhLabels, new Date().getFullYear());
          var _bhSpyData = bhSPY.map(function(v, i) { return { time: _bhIso[i], value: v }; });
          var _bhQqqData = bhQQQ.map(function(v, i) { return { time: _bhIso[i], value: v }; });
          var _bhLwc = window.AIO.charts.createMultiLineChart(_bhContainer, [
            { name: 'SPY', color: '#5ba8ff', lineWidth: 2, data: _bhSpyData },
            { name: 'QQQ', color: '#fb923c', lineWidth: 2, data: _bhQqqData }
          ], { height: 180 });
          if (_bhLwc && _bhLwc.series) {
            bhChartInstances['price'] = window.AIO.charts.createCompatWrapper(_bhLwc, priceCtx, _bhContainer);
            if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'bh-price chart: lightweight-charts 경로 사용 (multi-line)');
          }
        }
      } catch(_bhE) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC bh-price 전환 실패, Chart.js 폴백: ' + (_bhE && _bhE.message || _bhE));
      }
    }
    if (_gBhPrice && !bhChartInstances['price'])
    bhChartInstances['price'] = new Chart(priceCtx, {
      type: 'line',
      data: {
        labels: bhLabels,
        datasets: [
          { label: 'SPY', data: bhSPY, borderColor: '#5ba8ff',
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
              g.addColorStop(0, 'rgba(91,168,255,0.15)'); g.addColorStop(1, 'rgba(91,168,255,0)');
              return g;
            },
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: true },
          { label: 'QQQ', data: bhQQQ, borderColor: '#fb923c',
            borderWidth: 1.6, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tipStyle,
          callbacks: { label: i => ' ' + i.dataset.label + ': $' + i.formattedValue }
        }},
        scales: {
          x: xScale,
          y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 },
              callback: v => '$' + v, maxTicksLimit: 5 },
            border: { display: false } }
        }
      }
    });
  }

  // ── Shared breadth scale options ────────────────────────────────────
  function maScale(min, max) {
    return {
      grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 8 },
        callback: v => v + '%', maxTicksLimit: 5 },
      border: { display: false }, min, max,
      afterDataLimits: scale => { scale.min = min; scale.max = max; }
    };
  }

  function makeBreadthChart(canvasId, spxData, ndxData, refLine50, spxColor, gradColor) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    // v30.11: 차트 데이터 검증 게이트
    var _gBh = chartDataGate(canvasId, bhLabels, [spxData, ndxData], { minPoints: 3, chartName: canvasId });
    if (!_gBh) return null;
    const n = spxData.length;
    const ref50 = Array(n).fill(50);
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: bhLabels,
        datasets: [
          // 50% 기준선
          { label: '50% 기준선', data: ref50, borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          // SPX
          { label: 'SPX', data: spxData, borderColor: spxColor,
            backgroundColor: (ctx2) => {
              const g = ctx2.chart.ctx.createLinearGradient(0,0,0,ctx2.chart.height);
              g.addColorStop(0, gradColor + '0.18)'); g.addColorStop(1, gradColor + '0)');
              return g;
            },
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: true },
          // NDX
          { label: 'NDX', data: ndxData, borderColor: '#f87171',
            borderWidth: 1.6, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tipStyle,
          filter: item => item.datasetIndex > 0,
          callbacks: { label: i => ' ' + i.dataset.label + ': ' + i.formattedValue + '%' }
        }},
        scales: { x: xScale, y: maScale(0, 100) }
      }
    });
  }

  bhChartInstances['5ma']  = makeBreadthChart('bh-5ma-chart',   bhSPX5,   bhNDX5,   true, '#5ba8ff', 'rgba(91,168,255,');
  bhChartInstances['20ma'] = makeBreadthChart('bh-20ma-chart',  bhSPX20,  bhNDX20,  true, '#5ba8ff', 'rgba(91,168,255,');
  bhChartInstances['50ma'] = makeBreadthChart('bh-50ma-chart',  bhSPX50,  bhNDX50,  true, '#60d394', 'rgba(96,211,148,');

  // v41.2: SPY/QQQ 히스토리 가격 차트 동적 교체 (Yahoo Finance)
  _refreshBreadthHistoryCharts();
}

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
  const todayDisp = new Date().toISOString().slice(0,10).replace(/-/g,'.');
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
      if (w) { w.textContent = '현재 브라우저 설정에서 데이터 저장이 차단되어 있습니다. 포트폴리오·API 키가 저장되지 않습니다. 시크릿/개인정보보호 모드를 해제하세요.'; w.style.display = 'block'; }
    }
  })();

  // v46.10: 신규 사용자 API 키 미설정 시 온보딩 배너
  (function() {
    var hasKey = !!(_getApiKey('aio_finnhub_key') || _getApiKey('aio_fmp_key') || _getApiKey('aio_fred_key') || _getApiKey('aio_claude_api_key'));
    var dismissed = localStorage.getItem('aio_onboard_dismissed');
    var banner = document.getElementById('api-key-onboarding');
    if (banner && !hasKey && !dismissed) banner.style.display = 'block';
  })();

  // v17: 정적 기본값 즉시 로드 (API 연결 전에 빈칸/— 없애기)
  applyStaticFallbacks();
  // v40.4: 홈 핵심뉴스 정적 큐레이션 즉시 표시 (뉴스 수집 대기 불필요)
  if (typeof renderHomeFeed === 'function') renderHomeFeed([]);
  // v30.3: DATA_SNAPSHOT → HTML 매핑 (단일 진실 원천)
  if (typeof applyDataSnapshot === 'function') applyDataSnapshot();
  // v42.7: _lastFG 초기값 — fetchFearGreed() 응답 전 DATA_SNAPSHOT.fg 사용 (API 실패 시 18 폴백)
  if (!window._lastFG) window._lastFG = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.fg) || 35;
  // 실시간 시세 (성공 시 기본값 교체)
  fetchLiveQuotes();
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
  // initBreadthCharts() 제거 — initBreadthPage()가 breadth 페이지 진입 시 초기화
  // v31.9: AAII/PC 차트 즉시 + 재시도 (Chart.js CDN 로딩 완료 보장)
  try { initSentimentCharts(); } catch(e) { _aioLog('warn', 'init', 'initSentimentCharts: ' + e.message); }
  // 2초 후 재시도 — Chart.js 미로드 시 대비 (canvas 빈 화면 방지)
  setTimeout(function() {
    if (typeof Chart !== 'undefined' && !sentPageCharts['aaii']) {
      sentChartsInitialized = false;
      try { initSentimentCharts(); console.log('[AIO v31.9] AAII/PC 차트 재시도 성공'); } catch(e) {}
    }
  }, 2000);
  try { fetchFearGreed().catch(function(){}); } catch(e) {}
  fetchPutCall(); // 1분마다 시세 갱신
  fetchHYSpread(); // FRED HY Spread (6시간 캐시)
  // v30.11: T3 _hySpreadInterval 삭제 — REFRESH_SCHEDULE.hySpread가 6h 지터 포함 단일 경로

  // Trading Signal 45초 자동 갱신 타이머 (페이지가 활성일 때 경과 시간 카운터 시작)
  refreshSignal();
  if (window._refreshSignalInterval) clearInterval(window._refreshSignalInterval);
  window._refreshSignalInterval = setInterval(refreshSignal, T.SIGNAL_REFRESH);

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
// Anthropic API Pricing (2026.03):
//   Sonnet 4.6: Input $3/MTok,  Output $15/MTok  (~$0.020/query)
// v31.3: 적응형 모델 시스템 — 기본 Haiku, 복잡한 질문은 Sonnet+Thinking 자동 승격
//   Haiku 4.5:  Input $1/MTok,  Output $5/MTok   (~$0.007/query) — 기본
//   Sonnet 4.6: Input $3/MTok,  Output $15/MTok  (~$0.020/query) — 심층 분석 시만
//   Extended Thinking: Output 토큰 요금과 동일 (thinking 토큰도 output으로 과금)
// Haiku 기본 전환으로 비용 ~67% 절감 (동일 일일 한도 기준 3배 더 많은 질문 가능)
const LLM_MODELS = {
  haiku: {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    inputPerMTok: 1,
    outputPerMTok: 5,
    avgInputTokens: 2500,
    avgOutputTokens: 800,
    get costPerQuery() { return (this.avgInputTokens * this.inputPerMTok + this.avgOutputTokens * this.outputPerMTok) / 1e6; }
    // ~$0.0065/query (기본)
  },
  sonnet: {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    inputPerMTok: 3,
    outputPerMTok: 15,
    avgInputTokens: 2500,
    avgOutputTokens: 800,
    get costPerQuery() { return (this.avgInputTokens * this.inputPerMTok + this.avgOutputTokens * this.outputPerMTok) / 1e6; }
    // ~$0.0195/query (심층 분석 전용)
  },
  'sonnet-thinking': {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6 Thinking',
    inputPerMTok: 3,
    outputPerMTok: 15,
    avgInputTokens: 2500,
    avgOutputTokens: 3000, // thinking 토큰 포함
    thinking: true,
    thinkingBudget: 5000,
    get costPerQuery() { return (this.avgInputTokens * this.inputPerMTok + this.avgOutputTokens * this.outputPerMTok) / 1e6; }
    // ~$0.0525/query (추론 모드)
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
  totalUSD: 50,               // v30.13: 총 크레딧 $50
  users: 5,                   // 동시 사용자 수
  exchangeRate: 1500,         // KRW per USD (2026.03 환율 반영)
  get perUserUSD() { return this.totalUSD / this.users; },        // $10/인
  get monthlyUSD() { return this.perUserUSD; },                   // $10/인/월
  get monthlyKRW() { return Math.round(this.monthlyUSD * this.exchangeRate); }, // ~₩14,500
  get dailyUSD() { return this.monthlyUSD / 30; },               // ~$0.33/일
};

function getSelectedModel() {
  return 'haiku'; // v31.3: 기본 Haiku (질문별 자동 승격은 chatSend에서 처리)
}

function getModelConfig(modelKey) {
  return LLM_MODELS[modelKey || getSelectedModel()] || LLM_MODELS.haiku;
}

function calcDailyLimit() {
  const model = getModelConfig();
  return Math.floor(LLM_BUDGET.dailyUSD / model.costPerQuery);
}

function getLLMState() {
  return document.getElementById('llm-switch-track')?.classList.contains('on') ?? true;
}

function getQuota() {
  const today = new Date().toISOString().slice(0, 10);
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
  // 단가 추출 — 기존 LLM_MODELS는 inputPerMTok/outputPerMTok 필드명 사용 ($/1M tokens)
  var inputRate = modelCfg.inputPerMTok != null ? modelCfg.inputPerMTok : modelCfg.inputCostPer1M;
  var outputRate = modelCfg.outputPerMTok != null ? modelCfg.outputPerMTok : modelCfg.outputCostPer1M;
  if (inputRate == null || outputRate == null) return;
  // cache_read는 input 단가의 10% (Anthropic 공식)
  var nonCacheInput = Math.max(0, (totalInputTokens || 0) - (cacheReadTokens || 0));
  var actualCost = (nonCacheInput * inputRate + (cacheReadTokens || 0) * inputRate * 0.1 + (outputTokens || 0) * outputRate) / 1e6;
  // 추정 비용과 차이를 quota에 반영
  var est = modelCfg.costPerQuery || 0;
  var delta = actualCost - est;
  if (Math.abs(delta) < 1e-6) return;  // 무시할 수준
  var q = getQuota();
  q.costUSD = Math.max(0, (q.costUSD || 0) + delta);
  // tokensRead/tokensCreate 통계 누적 (분석용)
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

  if (track)   { track.classList.toggle('on', isOn); }
  if (swLabel) { swLabel.textContent = isOn ? 'ON' : 'OFF'; swLabel.className = 'llm-switch-label' + (isOn ? ' on' : ''); }
  if (capEl)   capEl.textContent = dailyLimit + '회';
  if (modelEl) modelEl.textContent = '기본 Haiku · 심층 Sonnet · 번역 Haiku';

  if (!isOn) {
    if (remEl)   { remEl.textContent = '∞'; remEl.className = 'llm-quota-val'; }
    if (progEl)  { progEl.style.width = '0%'; progEl.className = 'llm-prog-fill'; }
    if (badge)   badge.textContent = '∞';
    if (costEl)  costEl.textContent = '';
    if (hdrBadge){ hdrBadge.textContent = 'AI OFF'; hdrBadge.style.color = 'var(--text-muted)'; hdrBadge.style.borderColor = 'var(--border)'; hdrBadge.style.background = 'rgba(255,255,255,0.04)'; }
    return;
  }

  const quota     = getQuota();
  const used      = quota.used;
  const remaining = Math.max(0, dailyLimit - used);
  const pct       = Math.min(100, Math.round(used / dailyLimit * 100));
  const overBudget= quota.overBudget || 0;
  const costKRW   = Math.round((quota.costUSD || 0) * LLM_BUDGET.exchangeRate);

  const grade = remaining === 0 ? (overBudget > 0 ? 'over' : 'empty') : remaining <= Math.ceil(dailyLimit * 0.2) ? 'warn' : 'green';

  if (remEl)  { remEl.textContent = remaining + '회' + (overBudget > 0 ? ' (초과 ' + overBudget + '회)' : ''); remEl.className = 'llm-quota-val ' + grade; }
  if (progEl) { progEl.style.width = Math.min(pct, 100) + '%'; progEl.className = 'llm-prog-fill' + (grade !== 'green' ? ' ' + grade : ''); }
  if (costEl) costEl.textContent = '오늘 사용: W' + costKRW.toLocaleString() + ' / 일 예산 W' + Math.round(LLM_BUDGET.monthlyKRW / 30).toLocaleString() + ' (5명 분배)';

  if (badge)    badge.textContent = remaining + '/' + dailyLimit;
  if (hdrBadge) {
    const hdrText = overBudget > 0
      ? '예산 초과 · +' + overBudget + '회'
      : model.label + ' · ' + remaining + '/' + dailyLimit;
    hdrBadge.textContent = hdrText;
    hdrBadge.style.color = grade === 'green' ? '#5ba8ff' : grade === 'warn' ? '#f59e0b' : '#f87171';
    hdrBadge.style.borderColor = grade === 'green' ? 'rgba(91,168,255,0.3)' : grade === 'warn' ? 'rgba(245,158,11,0.3)' : 'rgba(248,113,113,0.3)';
    hdrBadge.style.background  = grade === 'green' ? 'rgba(91,168,255,0.12)' : grade === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)';
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
  if (!getLLMState()) return true; // OFF → always allowed, unlimited
  const quota = getQuota();
  const dailyLimit = calcDailyLimit();
  const model = getModelConfig();

  if (quota.used >= dailyLimit) {
    const extraCostKRW = Math.round(model.costPerQuery * LLM_BUDGET.exchangeRate);
    return new Promise(function(resolve) {
      showConfirmModal('일일 한도 초과',
        '일일 무료 한도(' + dailyLimit + '회)를 모두 사용했습니다.\n추가 질문 시 약 ' + extraCostKRW + '원/회 비용이 사용자 본인에게 귀속됩니다.\n(' + model.label + ' 모델 기준, 월 예산 ₩' + LLM_BUDGET.monthlyKRW.toLocaleString() + ' 초과분)\n계속 질문하시겠습니까?',
        function() {
          quota.overBudget = (quota.overBudget || 0) + 1;
          quota.used += 1;
          quota.costUSD = (quota.costUSD || 0) + model.costPerQuery;
          resolve(true);
        }, '');
      // Cancel case — modal close without confirm
      var cancelBtn = document.getElementById('aio-confirm-cancel');
      if (cancelBtn) { var _orig = cancelBtn.onclick; cancelBtn.onclick = function() { if (_orig) _orig(); resolve(false); }; }
    });
  }
  quota.used += 1;
  quota.costUSD = (quota.costUSD || 0) + model.costPerQuery;
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

  // ── 확장 API 키 자동 복원 (safeLSGetSync → input 필드) ──
  // v30.11: safeLSGetSync 사용 — 암호화된 키는 PIN 해제 후 복원됨
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
    ['aio_cf_worker_url', 'aio_cf_worker_input']
  ];
  _keyMap.forEach(function(pair) {
    var saved = safeLSGetSync(pair[0]);
    var el = document.getElementById(pair[1]);
    if (saved && el) el.value = saved;
  });
  // v30.11: Vault 상태 배지 초기화
  if (typeof _updateVaultStatus === 'function') _updateVaultStatus();
  // Auto-reset check every minute (for midnight rollover)
  if (window._quotaBadgeInterval) clearInterval(window._quotaBadgeInterval);
  window._quotaBadgeInterval = setInterval(updateQuotaBadge, T.COOLDOWN);

// ── Dynamic date labels ─────────────────────────────────────────
(function updateDateLabels() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const dateStr = kst.toISOString().slice(0,10).replace(/-/g,'.');
  const timeStr = kst.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  const dayNames = ['일','월','화','수','목','금','토'];
  const dayStr = dayNames[kst.getDay()];
  const fullLabel = dateStr + ' (' + dayStr + ') KST';
  
  // Update home date label
  const dlEl = document.getElementById('home-date-label');
  if (dlEl) dlEl.textContent = fullLabel + ' · 실시간 시세 자동갱신';
  
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
  if (!url) { setGhStatus('경로 오류', '#f59e0b'); return; }

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
        setGhStatus('Rate limit · ' + resetIn + '분 후 재시도', '#f59e0b');
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
      setGhStatus('✓ ' + ver + (built ? ' · ' + built : ''), '#3ddba5');
    } else if (ver !== _ghCurrentVersion) {
      // 버전 변경 감지!
      setGhStatus(' ' + ver + ' (신규)', '#f59e0b');
      showUpdateBanner(ver, data.built);
    } else {
      // 최신 상태
      setGhStatus('✓ ' + ver + ' 최신', '#3ddba5');
    }
  } catch(e) {
    _ghFailCount++;
    const isOffline = !navigator.onLine;
    const errMsg = isOffline ? ' 오프라인' : (' 연결 실패 (' + _ghFailCount + ')');
    setGhStatus(errMsg, '#f87171');
    // v30.11: 지수 백오프 — 연속 실패 시 폴링 간격 증가
    _rescheduleGhPoll();
  }
}

// v30.11: 지수 백오프 폴링 간격 재조정
function _rescheduleGhPoll() {
  if (_ghPollTimer) clearInterval(_ghPollTimer);
  const backoff = Math.min(GH_POLL_MS * Math.pow(2, _ghFailCount), GH_POLL_MAX);
  _ghPollTimer = setInterval(ghPollOnce, backoff);
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
  if (_ghPollTimer) clearInterval(_ghPollTimer);
  _ghCurrentVersion = null; // 저장소 바뀌면 버전 초기화

  const repo = loadGhRepo();
  if (!repo) { setGhStatus('— 미설정', ''); return; }

  ghPollOnce(); // 즉시 1회 실행
  _ghPollTimer = setInterval(ghPollOnce, GH_POLL_MS);
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
  setGhStatus(' 오프라인', '#f87171');
});


// ── Browser back/forward support ──────────────────────────────────────
// popstate only available outside sandboxed iframes
// v30.14: popstate 핸들러 — 전체 9개 페이지 reinit (기존 3개만 있어서 6개 누락 수정)
try { window.addEventListener('popstate', (e) => {
  var id = e.state?.page || (location.hash.slice(1)) || 'home';
  // v34.5: 해시 별칭 매핑
  var _ha = { chart: 'technical', dashboard: 'home', stock: 'fundamental', forex: 'fxbond', bond: 'fxbond', news: 'market-news', search: 'home', help: 'guide', manual: 'guide', trend: 'themes', theme: 'themes', moat: 'fundamental', korea: 'kr-home', 'kr-theme': 'kr-themes' };
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
    n.classList.toggle('active',
      n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + id + "'"));
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
  const hash = location.hash.slice(1);
  if (hash) {
    const navEl = document.querySelector(`[onclick*="'${hash}'"]`);
    showPage(hash, navEl);
  } else {
    // Push initial state so popstate fires correctly on first back press
    try { history.replaceState({ page: 'home' }, '', '#home'); } catch(e) {}
  }
})();

// ── Global refresh: all data sources ──────────────────────────────────
async function globalRefresh() {
  const btn = document.getElementById('topbar-refresh-btn');
  if (btn) { btn.textContent = '↻ 갱신 중...'; btn.disabled = true; }
  try {
  const tasks = [];
  if (typeof fetchLiveQuotes  === 'function') tasks.push(fetchLiveQuotes());
  if (typeof fetchFearGreed   === 'function') tasks.push(fetchFearGreed());
  if (typeof fetchPutCall     === 'function') tasks.push(fetchPutCall());
  if (typeof fetchHYSpread    === 'function') tasks.push(fetchHYSpread());
  if (typeof fetchAllNews     === 'function') tasks.push(fetchAllNews(true));
  if (typeof refreshSignal    === 'function') tasks.push(Promise.resolve(refreshSignal()));
  // Sentiment 뱃지 + 홈 상태 업데이트
  Promise.allSettled(tasks).then(() => {
    const fgEl = document.getElementById('fg-score-val');
    const fgScore = fgEl ? parseInt(fgEl.textContent) : 50;
    const badge = document.getElementById('sent-overall-badge');
    if (badge && !isNaN(fgScore)) {
      if (fgScore >= 75) { badge.textContent = '심리: 극단 탐욕'; badge.className = 'status-pill sp-risk-on'; }
      else if (fgScore >= 55) { badge.textContent = '심리: 탐욕'; badge.className = 'status-pill sp-risk-on'; }
      else if (fgScore >= 45) { badge.textContent = '심리: 중립'; badge.className = 'status-pill sp-neutral'; }
      else if (fgScore >= 25) { badge.textContent = '심리: 공포'; badge.className = 'status-pill sp-risk-off'; }
      else { badge.textContent = '심리: 극단 공포'; badge.className = 'status-pill sp-risk-off'; }
    }
  });

  // Re-init charts on current page
  const activePage = document.querySelector('.page.active');
  const activeId = activePage ? activePage.id.replace('page-','') : prevPage;
  if (activeId === 'breadth')   { initBreadthPage(true); setTimeout(updateRallyQualityVerdict, 300); }
  if (activeId === 'sentiment') initSentimentPage(true);
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


// ═══════════════════════════════════════════════════════════════════════
//  FEEDBACK SYSTEM
// ═══════════════════════════════════════════════════════════════════════
const FEEDBACK_EMAIL = 'dydyd007@naver.com';
let fbSelectedType = 'bug';

function openFeedback() {
  const overlay = document.getElementById('feedback-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const pageEl = document.getElementById('fb-page-info');
  const timeEl = document.getElementById('fb-time-info');
  if (pageEl) pageEl.textContent = prevPage || 'home';
  if (timeEl) timeEl.textContent = new Date().toLocaleString('ko-KR');
  document.getElementById('fb-desc')?.focus();
  renderFBHistory();
}

function closeFeedback() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay) overlay.style.display = 'none';
  const s = document.getElementById('fb-status');
  if (s) s.textContent = '';
}

function selectFBType(btn) {
  document.querySelectorAll('.fb-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fbSelectedType = btn.dataset.type;
}

function buildFeedbackText() {
  const labels = { bug: 'Bug/Error', data: 'Data Issue', realtime: 'Realtime Issue', feature: 'Feature Request' };
  const desc = document.getElementById('fb-desc')?.value?.trim() || '';
  const page = document.getElementById('fb-page-info')?.textContent || '';
  const time = document.getElementById('fb-time-info')?.textContent || '';
  return ['[AIO Feedback]', 'Type: ' + (labels[fbSelectedType] || fbSelectedType),
    'Page: ' + page, 'Time: ' + time, '', desc].join('\n');
}

function submitFeedback() {
  const desc = document.getElementById('fb-desc')?.value?.trim() || '';
  if (!desc) {
    const s = document.getElementById('fb-status');
    if (s) { s.style.color = 'var(--red)'; s.textContent = '내용을 입력해주세요.'; }
    return;
  }
  saveFeedbackToHistory();
  const typeKo = { bug: '[버그]', data: '[데이터]', realtime: '[실시간]', feature: '[건의]' };
  const subj = encodeURIComponent('[AIO] ' + (typeKo[fbSelectedType] || '') + ' ' +
    desc.slice(0, 40) + (desc.length > 40 ? '...' : ''));
  const body = encodeURIComponent(buildFeedbackText());
  const link  = document.createElement('a');
  link.href   = 'mailto:' + FEEDBACK_EMAIL + '?subject=' + subj + '&body=' + body;
  link.click();
  const s = document.getElementById('fb-status');
  if (s) { s.style.color = '#3ddba5'; s.textContent = '메일 앱이 열립니다. 전송 후 창을 닫아주세요.'; }
}

function copyFeedback() {
  const desc = document.getElementById('fb-desc')?.value?.trim();
  if (!desc) {
    const s = document.getElementById('fb-status');
    if (s) { s.style.color = 'var(--red)'; s.textContent = '내용을 입력해주세요.'; }
    return;
  }
  navigator.clipboard.writeText(buildFeedbackText()).then(() => {
    const s = document.getElementById('fb-status');
    if (s) { s.style.color = '#3ddba5'; s.textContent = '클립보드에 복사됐습니다.'; }
    saveFeedbackToHistory();
  }).catch(() => {
    const s = document.getElementById('fb-status');
    if (s) { s.style.color = 'var(--red)'; s.textContent = '복사 실패.'; }
  });
}

function saveFeedbackToHistory() {
  let list;
  try { list = JSON.parse(localStorage.getItem('aio_feedback') || '[]'); } catch(e) { list = []; }
  list.unshift({
    type: fbSelectedType,
    desc: (document.getElementById('fb-desc')?.value?.trim() || '').slice(0, 120),
    page: document.getElementById('fb-page-info')?.textContent || '',
    time: new Date().toISOString()
  });
  try { localStorage.setItem('aio_feedback', JSON.stringify(list.slice(0, 20))); } catch(e) {}
  renderFBHistory();
}

function renderFBHistory() {
  const el = document.getElementById('fb-history-list');
  if (!el) return;
  let list;
  try { list = JSON.parse(localStorage.getItem('aio_feedback') || '[]'); } catch(e) { list = []; }
  if (!list.length) {
    el.innerHTML = '<div style="font-size:9px;color:var(--text-muted);padding:4px;">제출 내역 없음</div>';
    return;
  }
  const icons = { bug: 'BUG', data: 'DATA', realtime: 'RT', feature: 'REQ' };
  el.innerHTML = list.map(f => {
    const d = new Date(f.time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return '<div style="font-size:9px;padding:5px 6px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:6px;">' +
      '<span>' + (icons[f.type] || '') + '</span>' +
      '<span style="flex:1;color:var(--text-secondary);">' + escHtml(f.desc) + '</span>' +
      '<span style="color:var(--text-muted);white-space:nowrap;">' + d + '</span></div>';
  }).join('');
}



