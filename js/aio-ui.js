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
        if (badge) { badge.style.background = 'var(--data-green-mid)'; badge.style.borderColor = 'var(--data-green-dim)'; badge.style.color = '#00e5a0'; }
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
    backgroundColor: '#111a2f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    titleColor: '#a5b0c2', bodyColor: '#f0f4fc',
    titleFont: { size: 9 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
    padding: 8
  },
  gridColor: 'var(--surface-4)',
  tickColor: 'rgba(255,255,255,0.3)',
  labels20: ['2/20','2/24','2/26','2/27','3/3','3/5','3/6','3/10','3/12','3/13','3/17','3/19','3/20','3/24','3/26','3/31','4/2','4/3','4/6','4/7','4/8','4/9','4/10','4/13','4/14','4/15','4/16','4/17','4/21','4/22','4/23','4/24','4/25','4/28','4/29','4/30','5/1','5/8','5/15','5/22','5/28','6/4','6/5']  /* v50.15: 6/5 연장 — VIX/HY/PC 공유 라벨 (5/8~6/5 주간 앵커, 6/5 셀오프 반영) */
};

// v50.15 (사용자 지적: 시장 폭 차트 일자 라인 + "데이터 대기 중"): 모듈 로드 시 폭 시계열 기본값 설정.
// 원인: breadth Chart.js init(makeBreadthPanel)이 lazy(페이지 가시화 시)라, 폴백 렌더러가 먼저 실행되면 _breadthSeries 미정의 → 단일값 평탄선/메시지.
// 이 기본값으로 폴백이 항상 실제 추이(5월 신고가→6/5 셀오프)를 표시. initBreadthPage 실행 시 전체 47포인트 배열로 덮어씀.
if (typeof window !== 'undefined') {
  // v50.15 (사용자 지적: 차트 평탄·안 바뀜): 전체 사이클(3월 변동성 저점→4-5월 신고가 랠리→6/5 셀오프 급락)로 풍부화 — 평탄선 해소
  window._breadthSeries = window._breadthSeries || {
    'bp-5ma-chart':  [40,38,40,43,55,68,72,74,76,75,77,78,79,80,82,81,80,79,78,80,78,61],
    'bp-20ma-chart': [33,32,33,34,58,72,75,78,80,80,81,82,83,84,85,85,86,84,83,82,80,57],
    'bp-50ma-chart': [33,34,35,38,46,50,52,54,56,58,60,62,65,68,71,72,73,74,75,74,72,52],
    'bp-ad-ratio-chart': [40,38,40,43,55,68,72,74,76,75,77,78,79,80,82,81,80,79,78,80,78,61],
    'bp-price-chart': [620,623,638,655,678,692,702,710,713,715,717,719,721,728,735,742,748,752,756,758,752,738],
    'bp-price-chart-qqq': [534,540,560,585,610,640,652,658,662,665,668,671,678,690,700,705,710,713,716,717,710,687]
    // v50.51 A2: bh-* 히스토리 차트 제거 (bp-*로 통합) — 폴백 시리즈 엔트리도 삭제
  };
  window._breadthLabels = window._breadthLabels || ['3/13','3/19','3/26','4/2','4/8','4/14','4/18','4/23','4/28','4/30','5/6','5/12','5/15','5/20','5/22','5/27','5/28','5/29','6/2','6/3','6/4','6/5'];
  if (typeof window._breadth5 !== 'number')  window._breadth5  = 61;
  if (typeof window._breadth20 !== 'number') window._breadth20 = 57;
  if (typeof window._breadth50 !== 'number') window._breadth50 = 52;
}

// ─────────────────────────────────────────────────────────────────
// v49.63 통합 (Codex v49.61): sentiment Canvas fallback — Chart.js CDN 실패 시 8 차트 polyfill
// _drawSentimentFallbackLine: DPR-aware Canvas 라인 차트 (260x120 minimum, 그리드 + 범례)
// _renderSentimentCanvasFallbackCharts: 8 sentiment 차트 (VIX/Term/NAAIM/II/HY/AAII/PCR/News) 일괄 폴백
// ─────────────────────────────────────────────────────────────────
function _drawSentimentFallbackLine(canvas, seriesList, opts) {
  if (!canvas || !seriesList || !seriesList.length) return false;
  opts = opts || {};
  var rect = canvas.getBoundingClientRect();
  var width = Math.max(260, Math.round(rect.width || canvas.clientWidth || 300));
  var height = Math.max(120, Math.round(rect.height || canvas.clientHeight || 150));
  var dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  var ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  var padL = 28, padR = 10, padT = 14, padB = 22;
  var plotW = Math.max(1, width - padL - padR);
  var plotH = Math.max(1, height - padT - padB);
  var vals = [];
  seriesList.forEach(function(s) { (s.data || []).forEach(function(v) { v = Number(v); if (isFinite(v)) vals.push(v); }); });
  if (!vals.length) return false;
  var min = opts.min != null ? Number(opts.min) : Math.min.apply(null, vals);
  var max = opts.max != null ? Number(opts.max) : Math.max.apply(null, vals);
  if (!isFinite(min) || !isFinite(max) || min === max) { min -= 1; max += 1; }
  var yFor = function(v) { return padT + (max - v) / (max - min) * plotH; };
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  for (var g = 0; g < 4; g++) {
    var gy = padT + (plotH * g / 3);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(width - padR, gy); ctx.stroke();
  }
  seriesList.forEach(function(s, si) {
    var data = (s.data || []).map(Number).filter(function(v) { return isFinite(v); });
    if (!data.length) return;
    ctx.strokeStyle = s.color || '#00bcd4';
    ctx.lineWidth = s.width || 2;
    ctx.beginPath();
    data.forEach(function(v, i) {
      var x = padL + (data.length === 1 ? plotW : i / (data.length - 1) * plotW);
      var y = yFor(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    var last = data[data.length - 1];
    ctx.fillStyle = s.color || '#00bcd4';
    ctx.beginPath(); ctx.arc(width - padR - 3, yFor(last), 3, 0, Math.PI * 2); ctx.fill();
    if (si === 0 && opts.fill !== false) {
      ctx.lineTo(width - padR, padT + plotH);
      ctx.lineTo(padL, padT + plotH);
      ctx.closePath();
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
  ctx.fillStyle = 'rgba(226,232,240,0.72)';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText(opts.label || 'fallback', padL, 10);
  ctx.fillStyle = 'rgba(148,163,184,0.55)';
  ctx.fillText(String(Math.round(max * 10) / 10), 2, padT + 3);
  ctx.fillText(String(Math.round(min * 10) / 10), 2, padT + plotH);
  canvas.setAttribute('data-fallback-rendered', 'sentiment');
  canvas.setAttribute('data-source-kind', 'unavailable');
  canvas.setAttribute('data-operational-use', 'reference-only');
  return true;
}

function _renderSentimentCanvasFallbackCharts() {
  // 폴백 데이터 — 정적 시계열 (라이브 미수신 시 참고용 표시)
  var vixData = [19.09,19.55,18.63,19.86,23.57,23.75,29.49,24.93,27.29,27.19,22.37,24.06,25.50,26.95,30.20,34.10,23.87,23.87,24.17,25.78,21.04,31.50,31.10,29.80,18.36,18.36,17.82,17.48,17.95,18.40,19.60,20.10,19.50,18.92,17.83,17.50,16.99,15.80,15.20,14.90,15.74,15.40,19.38]; // v50.15: 6/5 연장
  var hyData = [278,285,282,290,305,312,340,325,335,338,310,328,335,348,362,385,316,316,317,324,301,310,294,308,285,284,281,279,282,286,292,297,294,291,296,294,290,285,280,276,278,275,289]; // v50.15: 6/5 연장
  var pcData = [0.72,0.75,0.74,0.78,0.82,0.80,0.92,0.85,0.88,0.90,0.82,0.88,1.08,1.02,0.92,0.82,0.66,0.62,0.59,0.65,0.68,0.74,0.61,0.55,0.51,0.72,0.58,0.55,0.52,0.54,0.57,0.60,0.62,0.59,0.57,0.61,0.64,0.69,0.78,0.60,0.62,0.58,0.60,0.55,0.57,0.83]; // v50.15: 6/5 연장
  _drawSentimentFallbackLine(document.getElementById('vix-chart'), [{ data: vixData, color: '#ffa31a' }], { label: 'VIX fallback', min: 10, max: 50 });
  _drawSentimentFallbackLine(document.getElementById('vix-term-chart'), [{ data: [2.4,2.1,1.8,1.4,0.9,0.6,0.3,0.1,-0.1,0.2,0.5,0.7], color: '#a78bfa' }], { label: 'Term structure' });
  _drawSentimentFallbackLine(document.getElementById('naaim-chart'), [{ data: [63.5,67.1,67.0,60.2,62.5,68.36,69.38,79.49,94.15,96.2,92.5,95.1,97.8,96.4,89.5], color: '#00bcd4' }], { label: 'NAAIM', min: 0, max: 100 }); // v50.15: 6/3 연장
  _drawSentimentFallbackLine(document.getElementById('ii-chart'), [{ data: [33.5,31.2,29.4,28.2,26.5,25.1,24.0,26.5,30.2,35.8,38.5,41.2,44.0,46.5,43.0], color: '#00e5a0', fill: false }, { data: [36.8,38.5,40.2,41.5,43.2,44.8,46.0,43.5,40.0,35.5,33.0,30.5,28.8,28.0,31.5], color: '#ff5b50', fill: false }], { label: 'II bull/bear', min: 0, max: 60, fill: false }); // v50.15: 6/4 연장
  _drawSentimentFallbackLine(document.getElementById('hy-chart'), [{ data: hyData, color: '#fb923c' }], { label: 'HY OAS', min: 250, max: 420 });
  _drawSentimentFallbackLine(document.getElementById('aaii-chart'), [{ data: [34.0,42.0,44.0,41.0,39.0,38.1], color: '#00e5a0', fill: false }, { data: [42.0,34.0,33.0,34.0,35.0,39.7], color: '#ff5b50', fill: false }], { label: 'AAII bull/bear', min: 0, max: 60, fill: false }); // v50.15: 6/5 정합
  _drawSentimentFallbackLine(document.getElementById('pc-chart'), [{ data: pcData, color: '#ffa31a' }], { label: 'Put/Call', min: 0.45, max: 1.15 });
  _drawSentimentFallbackLine(document.getElementById('news-sentiment-chart'), [{ data: [42,46,51,55,49,57,61,58,54,59,63,60], color: '#2dd4bf' }], { label: 'News tone', min: 0, max: 100 });
}
window._renderSentimentCanvasFallbackCharts = _renderSentimentCanvasFallbackCharts;
window._drawSentimentFallbackLine = _drawSentimentFallbackLine;

// ── v48.22: VIX sparkline (개별 함수 — _lazyInit 래핑 가능)
// ── v48.24: lightweight-charts dual-path — AIO.charts.shouldUseLWC()이 true이면 LWC 경로, 아니면 Chart.js
function _initSentVixChart() {
  var vixCtx = document.getElementById('vix-chart');
  if (!vixCtx) return;
  var tip = _SENT_COMMON.tip, gridColor = _SENT_COMMON.gridColor, tickColor = _SENT_COMMON.tickColor, labels20 = _SENT_COMMON.labels20;
  var vixData = [19.09, 19.55, 18.63, 19.86, 23.57, 23.75, 29.49, 24.93, 27.29, 27.19, 22.37, 24.06, 25.50, 26.95, 30.20, 34.10, 23.87, 23.87, 24.17, 25.78, 21.04, 31.50, 31.10, 29.80, 18.36, 18.36, 17.82, 17.48, 17.95, 18.40, 19.60, 20.10, 19.50, 18.92, 17.83, 17.50, 16.99, 15.80, 15.20, 14.90, 15.74, 15.40, 19.38]; /* v50.15: 6/5=19.38 — 5월 신고가 안정(14.9~15.8)→6/5 셀오프 급등. 라이브 fetch 우선, 이건 폴백 */
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
          color: '#ffa31a',
          lineWidth: 2,
          height: 140,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
        });
        if (lwcResult && lwcResult.series) {
          // 20 (Fear) 참조선 추가
          try {
            lwcResult.series.createPriceLine({
              price: 20,
              color: 'rgba(255,91,80,0.5)',
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
        borderColor: '#ffa31a',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(249,115,22,0.25)'); g.addColorStop(1, 'rgba(249,115,22,0)');
          return g;
        },
        borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 3, tension: 0.3, fill: true
      }, {
        label: '20 (Fear)', data: Array(labels20.length).fill(20),
        borderColor: 'rgba(255,91,80,0.3)', borderWidth: 1, borderDash: [3,3],
        pointRadius: 0, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' ' + i.dataset.label + ': ' + i.formattedValue; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { min: 10, max: 50, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, stepSize: 10 }, border: { display: false } }
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
  var naaimLabels = ['2/26','3/5','3/12','3/19','3/26','4/1','4/8','4/15','4/22','4/29','5/6','5/13','5/20','5/27','6/3']; // v50.15: 6/3까지 연장 (주간 서베이·무료 API 없음, 수동 갱신)
  var naaimData = [63.5, 67.1, 67.0, 60.2, 62.5, 68.36, 69.38, 79.49, 94.15, 96.2, 92.5, 95.1, 97.8, 96.4, 89.5]; // v50.15: 5월 신고가 구간 노출 고점(95~98)→6/3 6/5 셀오프 직전 소폭 경계. NAAIM 주간(수)
  window._sentHistUpdated = '2026-06-05'; // 심리 차트 히스토리 최종 갱신일 (data-refresh 시 갱신)
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
          color: '#00bcd4',
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
        borderColor: '#00bcd4',
        backgroundColor: function(ctx2) {
          var g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
          g.addColorStop(0, 'rgba(0,212,255,0.2)'); g.addColorStop(1, 'rgba(0,212,255,0)');
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
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { min: 0, max: 100, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, callback: function(v){ return v + '%'; } }, border: { display: false } }
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
  var iiLabels = ['2/26','3/5','3/12','3/19','3/26','4/2','4/9','4/16','4/23','4/30','5/7','5/14','5/21','5/28','6/4']; // v50.15: 6/4까지 연장 (주간 서베이·무료 API 없음)
  var iiBull = [33.5, 31.2, 29.4, 28.2, 26.5, 25.1, 24.0, 26.5, 30.2, 35.8, 38.5, 41.2, 44.0, 46.5, 43.0]; // v50.15: 5월 신고가 랠리에 낙관 회복(35.8→46.5)→6/4 셀오프 직전 소폭 경계
  var iiBear = [36.8, 38.5, 40.2, 41.5, 43.2, 44.8, 46.0, 43.5, 40.0, 35.5, 33.0, 30.5, 28.8, 28.0, 31.5]; // v50.15: 비관 완화(35.5→28.0)→6/4 셀오프 직전 소폭 반등
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
          { name: 'Bulls', color: '#00e5a0', lineWidth: 2, data: bullData },
          { name: 'Bears', color: '#ff5b50', lineWidth: 2, data: bearData }
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
        borderColor: '#00e5a0', borderWidth: 1.8, pointRadius: 2, pointHoverRadius: 4, tension: 0.3, fill: false
      }, {
        label: 'Bears', data: iiBear,
        borderColor: '#ff5b50', borderWidth: 1.8, borderDash: [4,2], pointRadius: 2, pointHoverRadius: 4, tension: 0.3, fill: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function(i){ return ' ' + i.dataset.label + ': ' + i.formattedValue + '%'; } } }) },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, callback: function(v){ return v + '%'; } }, border: { display: false } }
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
  var hyData = [278, 285, 282, 290, 305, 312, 340, 325, 335, 338, 310, 328, 335, 348, 362, 385, 316, 316, 317, 324, 301, 310, 294, 308, 285, 284, 281, 279, 282, 286, 292, 297, 294, 291, 296, 294, 290, 285, 280, 276, 278, 275, 289]; /* v50.15: 5월 타이트닝(~275)→6/5 셀오프 소폭 확대 289bp. DATA_SNAPSHOT.hySpread 정합 */
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
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 }, border: { display: false } },
        y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, callback: function(v){ return v + 'bp'; } }, border: { display: false } }
      }
    }
  });
}

function initSentimentPage(forceReinit) {
  // v49.63 통합 (Codex v49.61): Chart.js CDN 실패 시 Canvas fallback 렌더
  if (typeof Chart === 'undefined') {
    try {
      if (typeof _renderSentimentCanvasFallbackCharts === 'function') _renderSentimentCanvasFallbackCharts();
    } catch(_) {}
    // F&G + AI 분석은 Chart.js 무관하게 계속
    try { if (typeof fgUpdateNeedle === 'function') { var _fg0 = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null; fgUpdateNeedle(_fg0 && _fg0.value != null ? _fg0.value : 15); } } catch(_) {}
    try { if (typeof fetchFearGreed === 'function') fetchFearGreed(); } catch(_) {}
    try { if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 300); } catch(_) {}
    return;
  }
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

  var _fg1 = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  fgUpdateNeedle(_fg1 && _fg1.value != null ? _fg1.value : 15);
  fetchFearGreed();
  fetchPutCall();

  // v50.16: 지연 init 안전망 — IntersectionObserver(rootMargin 100px)가 내부 스크롤 컨테이너에서
  // 화면 밖 차트(naaim/ii/hy ~1300px+)를 못 띄우는 케이스 방지. 1.4s 후 미렌더 차트 강제 init.
  // 중복 방지: LWC 컨테이너(.lwc-chart-container) 존재 또는 캔버스 픽셀 있으면 스킵.
  try {
    var _sentChartGuard = [['vix-chart', _initSentVixChart], ['naaim-chart', _initSentNaaimChart], ['ii-chart', _initSentIIChart], ['hy-chart', _initSentHYChart]];
    setTimeout(function() {
      _sentChartGuard.forEach(function(pair) {
        try {
          var cv = document.getElementById(pair[0]);
          if (!cv || typeof pair[1] !== 'function') return;
          var par = cv.parentElement;
          var hasLWC = par && par.querySelector && par.querySelector('.lwc-chart-container, [class*=lightweight]');
          if (hasLWC) return;
          var blank = true;
          try {
            var ctx = cv.getContext('2d');
            var d = ctx.getImageData(0, 0, Math.min(cv.width, 200), Math.min(cv.height, 80)).data;
            var nz = 0; for (var j = 3; j < d.length; j += 60) { if (d[j] > 0) nz++; }
            blank = nz <= 3;
          } catch (e) {}
          if (blank) { try { pair[1](); } catch (e) { if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'sentiment guard reinit ' + pair[0] + ': ' + e.message); } }
        } catch (e) {}
      });
    }, 1400);
  } catch (e) {}
}

let sentChartsInitialized = false;

function initSentimentCharts() {
  if (typeof Chart === 'undefined') return;
  if (sentChartsInitialized) return;
  // v30.10: Destroy previous AAII/PC charts if any (v48.69: delete after destroy — 좀비 참조 방지)
  ['aaii','pc'].forEach(k => { if (sentPageCharts[k]) { try { sentPageCharts[k].destroy(); } catch(e){} delete sentPageCharts[k]; } });
  sentChartsInitialized = true;

  // ─ AAII stacked horizontal bar ─────────────────────────────────────
  const aaiiCtx = document.getElementById('aaii-chart');
  if (aaiiCtx) {
    const aaiiLabels = ['6/5', '5/28', '5/21', '5/14', '5/7', '4/29']; // v50.15: 6/5까지 (최신순, 주간·DATA_SNAPSHOT.aaiiBear가 최신값 덮어씀)
    // Bull / Neutral / Bear (합계 100) — v50.15: 5월 신고가 랠리 낙관(Bull 44)→6/5 셀오프 비관 급증(Bear 42, DATA_SNAPSHOT.aaiiBear 41.9 정합)
    const aaiiDatasets = [[34.0, 42.0, 44.0, 41.0, 39.0, 38.1], [24.0, 24.0, 23.0, 25.0, 26.0, 22.2], [42.0, 34.0, 33.0, 34.0, 35.0, 39.7]];
    // v31.9: 텍스트 폴백 동적 업데이트
    var _aaiiBearEl = document.getElementById('aaii-bear-val');
    var _aaiiBullEl = document.getElementById('aaii-bull-val');
    var _aaiiSignal = document.getElementById('aaii-signal-badge');
    var snapAaiiBear = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.aaiiBear != null) ? Number(DATA_SNAPSHOT.aaiiBear) : NaN;
    var latestBear = isFinite(snapAaiiBear) ? snapAaiiBear : aaiiDatasets[2][0];
    var latestBull = aaiiDatasets[0][0];
    if (isFinite(snapAaiiBear)) {
      aaiiDatasets[2][0] = snapAaiiBear;
      if (aaiiCtx.setAttribute) {
        aaiiCtx.setAttribute('data-source-kind', 'snapshot');
        aaiiCtx.setAttribute('data-operational-use', 'reference-only');
        aaiiCtx.setAttribute('data-source-label', 'DATA_SNAPSHOT:aaiiBear');
      }
    }
    if (_aaiiBearEl) _aaiiBearEl.textContent = latestBear.toFixed(1) + '%';
    if (_aaiiBullEl) _aaiiBullEl.textContent = latestBull.toFixed(1) + '%';
    window._aaiiBearish = latestBear;
    // v46.10: signal 페이지 regime-aaii 동적 연결
    var _regAaii = document.getElementById('regime-aaii');
    if (_regAaii) {
      _regAaii.textContent = latestBear.toFixed(1) + '%';
      _regAaii.style.color = latestBear > 50 ? '#ff5b50' : latestBear > 40 ? '#ffa31a' : '#00e5a0';
    }
    var _regAaiiSub = _regAaii ? _regAaii.nextElementSibling : null;
    if (_regAaiiSub) _regAaiiSub.textContent = latestBear > 50 ? '극단 비관 (역발상)' : latestBear > 40 ? '비관 우세' : '정상 범위';
    if (_aaiiSignal) {
      if (latestBear > 50) _aaiiSignal.innerHTML = '<span style="font-size:11px;font-weight:700;color:#f87171;">● 극단적 비관</span><span style="font-size:11px;color:var(--text-muted);margin-left:4px;">(역발상 매수 시그널)</span>';
      else if (latestBear > 40) _aaiiSignal.innerHTML = '<span style="font-size:11px;font-weight:700;color:#fbbf24;">● 비관 우세</span>';
      else _aaiiSignal.innerHTML = '<span style="font-size:11px;font-weight:700;color:#3ddba5;">● 정상 범위</span>';
    }
    var _gAaii = chartDataGate('aaii-chart', aaiiLabels, aaiiDatasets, { minPoints: 3, chartName: 'AAII' }); if (_gAaii)
    sentPageCharts['aaii'] = new Chart(aaiiCtx, {
      type: 'bar',
      data: {
        labels: aaiiLabels,
        datasets: [
          { label: '강세', data: aaiiDatasets[0],
            backgroundColor: 'rgba(0,229,160,0.7)', borderRadius: 2 },
          { label: '중립', data: aaiiDatasets[1],
            backgroundColor: 'rgba(107,114,128,0.6)', borderRadius: 2 },
          { label: '약세', data: aaiiDatasets[2],
            backgroundColor: 'rgba(255,91,80,0.75)', borderRadius: 2 },
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111a2f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            titleColor: '#a5b0c2', bodyColor: '#f0f4fc',
            titleFont: { size: 9 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
            callbacks: { label: i => ' ' + i.dataset.label + ': ' + i.formattedValue + '%' }
          }
        },
        scales: {
          x: { stacked: true, max: 100,
               grid: { color: 'var(--surface-4)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 }, callback: v => v + '%' },
               border: { display: false } },
          y: { stacked: true,
               grid: { display: false },
               ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
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
    const pcLabels = ['2/20','2/24','2/26','2/27','3/3','3/5','3/6','3/10','3/12','3/13','3/17','3/19','3/22','3/23','3/25','3/27','3/30','4/1','4/2','4/3','4/6','4/7','4/8','4/9','4/10','4/13','4/14','4/15','4/16','4/17','4/18','4/21','4/22','4/23','4/24','4/25','4/28','4/29','4/30','5/1','5/8','5/15','5/22','5/28','6/4','6/5']; // v50.15: 6/5 연장 (셀오프 풋 급증)
    // v50.15: 5월 안정/저복 풋콜(~0.55)→6/5 셀오프 풋 급증 0.83 (DATA_SNAPSHOT.pcr 정합)
    const pcData   = [0.72,0.75,0.74,0.78,0.82,0.80,0.92,0.85,0.88,0.90,0.82,0.88,1.08,1.02,0.92,0.82,0.66,0.62,0.59,0.65,0.68,0.74,0.61,0.55,0.51,0.72,0.58,0.55,0.52,0.54,0.57,0.60,0.62,0.59,0.57,0.61,0.64,0.69,0.78,0.60,0.62,0.58,0.60,0.55,0.57,0.83]; // reference scaffold; DATA_SNAPSHOT.pcr overrides latest point when available
    var snapPcr = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.pcr != null) ? Number(DATA_SNAPSHOT.pcr) : NaN;
    if (isFinite(snapPcr)) {
      pcData[pcData.length - 1] = snapPcr;
      if (pcCtx.setAttribute) {
        pcCtx.setAttribute('data-source-kind', 'snapshot');
        pcCtx.setAttribute('data-operational-use', 'reference-only');
        pcCtx.setAttribute('data-source-label', 'DATA_SNAPSHOT:pcr');
      }
    }
    var _gPC = chartDataGate('pc-chart', pcLabels, [pcData], { minPoints: 3, chartName: 'Put/Call Ratio' });
    if (_gPC && window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _pcContainer = window.AIO.charts.wrapCanvas(pcCtx, 160);
        if (_pcContainer) {
          var _pcIso = window.AIO.charts.monthDayToISO(pcLabels, new Date().getFullYear());
          var _pcLwcData = pcData.map(function(v, i) { return { time: _pcIso[i], value: v }; });
          var _pcLwc = window.AIO.charts.createLineChart(_pcContainer, _pcLwcData, {
            color: '#ffa31a',
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
          borderColor: '#ffa31a',
          backgroundColor: (ctx2) => {
            const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
            g.addColorStop(0, 'rgba(255,163,26,0.2)'); g.addColorStop(1, 'rgba(255,163,26,0)');
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
            backgroundColor: '#111a2f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            titleColor: '#a5b0c2', bodyColor: '#f0f4fc',
            titleFont: { size: 8 }, bodyFont: { family: 'JetBrains Mono, monospace', size: 9 },
            filter: i => i.datasetIndex === 0,
            callbacks: { label: i => ' P/C: ' + i.formattedValue }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 11 }, maxTicksLimit: 5 }, border: { display: false } },
          y: { min: 0.5, max: 1.2,
               grid: { color: 'var(--surface-4)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 11 }, maxTicksLimit: 4 },
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
  var breadth = (typeof window._breadth200 === 'number') ? window._breadth200 :
                (typeof window._breadth20 === 'number') ? window._breadth20 :
                ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.breadth20sma != null) ? DATA_SNAPSHOT.breadth20sma :
                ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback && DATA_SNAPSHOT._fallback.breadth200 != null) ? DATA_SNAPSHOT._fallback.breadth200 : 57));

  var stage, color, advice;
  if (breadth > 65 && spyPct > 0) {
    stage = 'Stage 2 (상승)'; color = '#00e5a0';
    advice = '건강한 상승 추세. 강한 RS 종목 매수 유지. 추세 추종 전략 유효.';
  } else if (breadth > 45 && breadth <= 65) {
    stage = 'Stage 3 (천장 형성)'; color = '#ffa31a';
    advice = '시장 폭 축소 중. 이익 실현 고려. 손절선 타이트하게 관리. 신규 매수 축소.';
  } else if (breadth > 25 && breadth <= 45) {
    stage = 'Stage 4 (하락)'; color = '#ff5b50';
    advice = '약세 시장. 현금 비중 확대. 방어 섹터(유틸·헬스케어) 위주. 공격적 매수 자제.';
  } else {
    stage = 'Stage 1 (바닥 형성)'; color = '#00bcd4';
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
  if (!b5) { el.textContent = '시장폭 데이터 수신 대기 중...'; return; }

  var verdict = '', color = '', bg = '';
  if (b5 > 70 && b50 > 60) {
    verdict = ' <b>브레드스 쓰러스트 수준</b> — 5SMA ' + b5.toFixed(0) + '% · 50SMA ' + b50.toFixed(0) + '%. 극히 높은 참여율. 진짜 바닥 확인 가능성. 리더주 셋업 완성 시 분할 진입 검토.';
    color = '#00e5a0'; bg = 'var(--data-green-faint)';
  } else if (b5 > 50 && b20 > 40) {
    verdict = ' <b>고품질 랠리</b> — 5SMA ' + b5.toFixed(0) + '% · 20SMA ' + b20.toFixed(0) + '%. 광범위 참여. Follow-through 진행 중. 리테스트 대기하며 선별 매수 가능.';
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
      if (el && p[1] != null) { el.textContent = p[1] + '%'; el.style.color = _bbColor(p[1]); }
    });
  // v50.17→v52.40: breadth 페이지 50SMA 막대(width) + 해석 readout 동적 갱신.
  // P562/R253이 큰 숫자·막대·readout을 DATA_SNAPSHOT.breadth50sma 단일 소스로 통일했던 로직을
  // v52.40(P655/EF-02d)에서 window._aioSyncBreadth50Readout()(js/aio-core.js)로 추출 — applyDataSnapshot()도
  // 같은 함수를 호출해 Chart.js 로드 여부와 무관하게 항상 동기화되게 함(중복 정의 방지, R276 정신).
  if (typeof window._aioSyncBreadth50Readout === 'function') window._aioSyncBreadth50Readout();
}

function initBreadthPage(forceReinit) {
  // v52.40 (P655/EF-02c, R284): NYSE 52주 신고가/신저가 카드는 무료 실시간 소스가 없어 이 코드베이스
  // 어디에도 값을 채우는 함수가 존재한 적이 없다(전수 grep 확인) — Chart.js 가드보다 먼저 실행해
  // Chart 로드 여부와 무관하게 항상 정직한 'na' 상태로 렌더(무한 '—' 금지, R284 4상태 계약).
  if (typeof window._aioRenderValueSlot === 'function') {
    ['breadth-new-highs', 'breadth-new-lows', 'breadth-hl-ratio'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && el.getAttribute('data-value-state') !== 'na') {
        window._aioRenderValueSlot(el, 'na', null, { text: '해당 없음', reason: 'NYSE 신고가/신저가 무료 실시간 소스 없음 — 자동 수집 미구현' });
      }
    });
  }
  // v52.58/P675: the local no-CDN fallback exposes a minimal Chart stub for
  // non-chart surfaces. Treat a partial stub as unavailable before touching
  // Chart.registry or Chart.register.
  if (typeof Chart === 'undefined' || typeof Chart !== 'function' || !Chart.registry || !Chart.registry.plugins || typeof Chart.register !== 'function') return;
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
    '3/30','3/31','4/1','4/2','4/3','4/6','4/7','4/8','4/9','4/10','4/13','4/14','4/15','4/16','4/17',
    '4/18','4/21','4/22','4/23','4/24','4/25','4/28','4/29','4/30','5/1','5/8','5/15','5/22','5/28','6/4','6/5']; // v50.15: 6/5 연장 (5월 신고가 SPX 7585→6/5 셀오프 -2.6% 7388)

  const bpSPY   = [640,635,638,633,628,631,635,643,648,655,651,647,650,644,640,636,639,634,629,622,620,623,638,648,655,663,678,692,702,702,710,712,713,710,714,715,717,716,718,719,721,728,740,748,752,758,738]; // v50.15: 5/1 $721→6/4 $758(SPX 7585)→6/5 $738(셀오프)
  const bpQQQ   = [556,550,554,548,544,547,551,558,563,569,565,561,564,558,554,549,552,547,542,534,532,535,551,563,570,578,585,593,595,593,649,652,654,651,655,657,660,659,662,665,671,678,692,705,712,717,687]; // v50.15: 5/1 $671→6/4 $717(NASDAQ 26831)→6/5 $687(셀오프)
  // v45.4: 사용자 제공 SPY+S5TW+S5FI+S5TH+NDFI+R2TH 차트(4/8) 기반 실값 정정
  // S5TW=75.49(20SMA), S5FI=46.41(50SMA), S5TH=54.98(200SMA), NDFI=48.51(NDX 50SMA), R2TH=56.00(R2K 200SMA)
  // v48.61 data-refresh: 4/9~4/17 breadth 확장 (SPX 11일 연속 상승 ATH 구간 + 위험선호 지속)
  const bpSPX5  = [42, 40, 41, 39, 37, 38, 40, 43, 44, 43, 42, 40, 41, 39, 38, 36, 37, 39, 38, 37.8, 37.5, 39.0, 55, 68, 70, 72, 74, 75, 76, 75, 77, 76, 77, 75, 78, 79, 77, 76, 79, 78, 78, 80, 82, 81, 80, 78, 61];   // $SPXA5R (v50.15: 5월 고점 80→6/5 셀오프 61, snapshot override)
  const bpNDX5  = [38, 36, 37, 35, 33, 35, 37, 39, 40, 40, 38, 36, 37, 35, 34, 32, 33, 36, 35, 33.4, 33.2, 35.0, 50, 65, 67, 69, 71, 72, 73, 72, 74, 73, 74, 72, 75, 76, 74, 73, 76, 75, 75, 76, 78, 77, 76, 74, 58];   // MNFD (v50.15: 6/5 셀오프 58)
  const bpSPX20 = [36, 35, 34, 33, 32, 33, 34, 35, 36, 37, 36, 35, 34, 33, 32, 31, 32, 33, 32, 32.0, 31.8, 32.5, 58, 75, 76, 78, 79, 80, 80, 80, 81, 82, 82, 82, 83, 83, 83, 83, 84, 84, 85, 85, 86, 85, 84, 82, 57];   // $SPXA20R / S5TW (v50.15: 5월 고점 85→6/5 셀오프 57, snapshot override)
  // ── v14: Breadth200 최신값을 전역 변수에 캐싱 (computeTradingScore 참조용) ──
  const bpNDX20 = [28, 27, 26, 25, 24, 25, 26, 27, 28, 28, 27, 26, 25, 24, 23, 22, 23, 24, 23, 23.2, 23.0, 23.8, 55, 72, 73, 75, 76, 77, 78, 78, 79, 80, 80, 80, 81, 81, 81, 81, 82, 82, 83, 83, 84, 83, 82, 80, 55];   // MNTW (v50.15: 6/5 셀오프 55)
  const bpSPX50 = [38, 37, 36, 35, 34, 34, 35, 36, 37, 38, 37, 36, 35, 34, 33, 32, 32, 33, 32, 31.8, 31.5, 32.2, 38, 46, 48, 50, 51, 52, 53, 54, 55, 57, 58, 59, 61, 62, 63, 65, 67, 69, 71, 72, 74, 75, 74, 72, 52];   // $SPXA50R / S5FI (v50.15: 5월 상승 75→6/5 셀오프 52, snapshot override)
  const bpNDX50 = [34, 33, 32, 31, 30, 30, 31, 32, 33, 33, 32, 31, 30, 29, 28, 28, 29, 29, 28, 27.6, 27.4, 28.2, 40, 49, 51, 52, 53, 54, 55, 55, 56, 58, 59, 60, 62, 63, 64, 66, 68, 70, 72, 73, 75, 76, 75, 73, 53];   // MNFI / NDFI (v50.15: 6/5 셀오프 53)
  // ── 전역 캐싱: computeTradingScore + updateRallyQualityVerdict 참조용 ──
  var snapBreadth = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : {};
  var snapB5 = Number(snapBreadth.breadth5sma);
  var snapB20 = Number(snapBreadth.breadth20sma);
  var snapB50 = Number(snapBreadth.breadth50sma);
  if (isFinite(snapB5)) bpSPX5[bpSPX5.length - 1] = snapB5;
  if (isFinite(snapB20)) bpSPX20[bpSPX20.length - 1] = snapB20;
  if (isFinite(snapB50)) bpSPX50[bpSPX50.length - 1] = snapB50;
  window._breadth200 = bpSPX20[bpSPX20.length - 1]; // 20SMA above % (레거시 오명 — 실제 20SMA)
  window._breadth20 = bpSPX20[bpSPX20.length - 1];  // v50.15 버그 수정: 폴백(_aioBreadthCanvasRender)이 _breadth20을 읽는데 미정의였음 → 20SMA "데이터 대기 중" 오류
  window._breadth5 = bpSPX5[bpSPX5.length - 1];     // 5SMA above %
  window._breadth50 = bpSPX50[bpSPX50.length - 1];   // 50SMA above %
  // v42.4: NDX 전역 캐싱 추가 — updateBreadthBars() 참조용
  window._breadthNDX5  = bpNDX5[bpNDX5.length - 1];
  window._breadthNDX20 = bpNDX20[bpNDX20.length - 1];
  window._breadthNDX50 = bpNDX50[bpNDX50.length - 1];
  // v50.15 (사용자 지적: 폭 차트 일자 라인/데이터 대기 중): 폴백 렌더러가 단일값 평탄선 대신 실제 시계열을 쓰도록 전역 저장.
  // 폭 %aboveMA는 무료 실시간 API가 없어(Yahoo 404·Stooq N/D) 이 하드코딩 시계열이 유일 소스 — "API 키 확인" 메시지는 오해.
  window._breadthSeries = {
    'bp-ad-ratio-chart': bpSPX5, 'bp-price-chart': bpSPY, 'bp-price-chart-qqq': bpQQQ,
    'bp-5ma-chart': bpSPX5, 'bp-20ma-chart': bpSPX20, 'bp-50ma-chart': bpSPX50,
    'bh-5ma-chart': bpNDX5, 'bh-20ma-chart': bpNDX20, 'bh-50ma-chart': bpNDX50, 'bh-price-chart': bpQQQ
  };
  window._breadthLabels = bpLabels;
  const n       = bpLabels.length;

  Chart.defaults.font.family = "'Inter', 'Noto Sans KR', sans-serif";

  // ─ Shared style helpers ──────────────────────────────────────────
  const xScale = (showLabels) => ({
    grid:   { color: 'var(--surface-4)', drawBorder: false },
    ticks:  { color: 'rgba(255,255,255,0.3)', font: { size: 11 },
              maxTicksLimit: 7, display: showLabels, maxRotation: 0 },
    border: { display: false }
  });
  const tip = {
    backgroundColor: '#111a2f', borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, titleColor: '#a5b0c2', bodyColor: '#f0f4fc',
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
      if (!c || typeof c.draw !== 'function') return;   // v50.15: LWC 래퍼/null은 .draw() 없음 → 가드 (c.draw is not a function 386건 에러 차단)
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
          { label: '_80', data: ref80, borderColor: 'rgba(0,229,160,0.2)',  borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          { label: '_50', data: ref50, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
          { label: '_20', data: ref20, borderColor: 'rgba(255,91,80,0.25)', borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0 },
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
          { label: 'NDX', data: ndxData, borderColor: '#ff5b50',
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
               grid: { color: 'var(--surface-4)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 },
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
      Object.values(bpChartInstances).forEach(c => { if (c && typeof c.draw === 'function') { c._cursorX = null; c.draw(); } });
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
            { name: 'SPY', color: '#00bcd4', lineWidth: 2, data: _bpSpyData },
            { name: 'QQQ', color: '#ff5b50', lineWidth: 2, data: _bpQqqData }
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
          { label: 'SPY', data: bpSPY, borderColor: '#00bcd4',
            backgroundColor: (ctx2) => {
              const g = ctx2.chart.ctx.createLinearGradient(0,0,0,ctx2.chart.height);
              g.addColorStop(0,'rgba(0,212,255,0.2)'); g.addColorStop(1,'rgba(0,212,255,0)'); return g;
            },
            borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: true },
          { label: 'QQQ', data: bpQQQ, borderColor: '#ff5b50',
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
          y: { grid: { color: 'var(--surface-4)', drawBorder: false },
               ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 },
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
      Object.values(bpChartInstances).forEach(c => { if (c && typeof c.draw === 'function') { c._cursorX = null; c.draw(); } });
    }
    // P568/R259: the sibling bp-chart canvas above guards re-registration with
    // `if (ctx._bpMouseLeave) ctx.removeEventListener(...)` before adding a new listener —
    // this canvas omitted that guard, so every revisit of the breadth page stacked one more
    // 'mouseleave' listener on priceCtx (initBreadthPage re-runs on each page (re)visit).
    if (priceCtx._bpMouseLeave) priceCtx.removeEventListener('mouseleave', priceCtx._bpMouseLeave);
    priceCtx._bpMouseLeave = bpPriceMouseLeave;
    priceCtx.addEventListener('mouseleave', bpPriceMouseLeave);
  }

  // ─ Panels 1-3: Breadth ──────────────────────────────────────────
  bpChartInstances['5ma']  = makeBreadthPanel('bp-5ma-chart',  bpSPX5,  bpNDX5,  '#00bcd4', 0.18);
  bpChartInstances['20ma'] = makeBreadthPanel('bp-20ma-chart', bpSPX20, bpNDX20, '#00bcd4', 0.15);
  bpChartInstances['50ma'] = makeBreadthPanel('bp-50ma-chart', bpSPX50, bpNDX50, '#fb923c', 0.15);

  // Update Weinstein analysis
  updateWSAnalysis();

  // v50.51 A2: SECTION 5-B(bh-* 히스토리 차트) 제거 — bp-*가 동일 시장폭을 일별 전체 사이클로 통합.
  //   initBreadthCharts() 호출 제거 (함수는 retired stub).

  // v40.4: SPY/QQQ 가격 차트 동적 교체 (Yahoo Finance)
  _refreshBreadthPriceChart();
  // v46.6: A-D ratio 시계열 차트 (bpSPX5 데이터 활용)
  // ── v48.26: lightweight-charts dual-path (P3-5 Phase 5) — 점별 색상 손실 수용, priceLine 50%
  var adCanvas = document.getElementById('bp-ad-ratio-chart');
  if (adCanvas && bpSPX5 && bpLabels) {
    if (bpChartInstances['ad-ratio']) { try { bpChartInstances['ad-ratio'].destroy(); } catch(_){} }
    // A-D ratio = 5SMA above % (상승 비율과 동일 의미)
    var adColors = bpSPX5.map(function(v) { return v >= 50 ? '#00e5a0' : v >= 35 ? '#ffa31a' : '#ff5b50'; });

    // LWC 경로 시도
    var _adLwcOk = false;
    if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
      try {
        var _adContainer = window.AIO.charts.wrapCanvas(adCanvas, 140);
        if (_adContainer) {
          var _adIso = window.AIO.charts.monthDayToISO(bpLabels, new Date().getFullYear());
          var _adLwcData = bpSPX5.map(function(v, i) { return { time: _adIso[i], value: v }; });
          var _adLwc = window.AIO.charts.createLineChart(_adContainer, _adLwcData, {
            color: '#00bcd4',
            lineWidth: 2,
            height: 140,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
          });
          if (_adLwc && _adLwc.series) {
            try {
              _adLwc.series.createPriceLine({
                price: 50,
                color: 'rgba(0,229,160,0.4)',
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
          borderColor: '#00bcd4', backgroundColor: 'rgba(0,212,255,0.08)',
          borderWidth: 2, pointRadius: 3, pointBackgroundColor: adColors,
          fill: true, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, grid: { color: 'var(--surface-4)' }, ticks: { color: '#a0b4c8', font: { size: 11 }, callback: function(v) { return v + '%'; } } },
          x: { grid: { display: false }, ticks: { color: '#a0b4c8', font: { size: 11 }, maxTicksLimit: 8 } }
        },
        plugins: {
          legend: { display: false },
          annotation: { annotations: { fiftyLine: { type: 'line', yMin: 50, yMax: 50, borderColor: 'rgba(0,229,160,0.3)', borderWidth: 1, borderDash: [4,4], label: { display: true, content: '50%', position: 'end', color: '#00e5a0', font: { size: 11 } } } } }
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
        badge.style.background = 'var(--data-green-mid)';
        badge.style.borderColor = 'var(--data-green-dim)';
        badge.style.color = '#00e5a0';
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
  // v50.51 A2: RETIRED — bh-* 히스토리 차트(Section 5-B)는 bp-*(Section 5)로 통합됨.
  //   호출 경로(initBreadthPage) 제거됨. no-op 가드로 잔존 호출 무해화. 아래 본문은 비활성.
  return;
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
  // v50.15 (사용자 지적: 히스토리 차트 평탄·안 바뀜): 전체 사이클(3월 변동성 저점→4-5월 신고가 랠리→6/5 셀오프 급락)로 교체.
  //   기존 최근 20일 윈도우는 5월 고점 구간만이라 평탄. 히스토리는 변화가 보이는 장기 뷰가 적합.
  const bhLabels = ['3/13','3/19','3/26','4/2','4/8','4/14','4/18','4/23','4/28','4/30','5/6',
    '5/12','5/15','5/20','5/22','5/27','5/28','5/29','6/2','6/3','6/4','6/5'];

  const bhSPY   = [620,623,638,655,678,692,702,710,713,715,717,719,721,728,735,742,748,752,756,758,752,738];
  const bhQQQ   = [534,540,560,585,610,640,652,658,662,665,668,671,678,690,700,705,710,713,716,717,710,687];
  // 5MA: 단기 이동평균 위 비율 (저점 40→랠리 82→6/5 급락 61)
  const bhSPX5   = [40,38,40,43,55,68,72,74,76,75,77,78,79,80,82,81,80,79,78,80,78,61];  // $SPXA5R
  const bhNDX5   = [37,35,38,41,52,65,69,71,73,72,74,75,76,77,79,78,77,76,75,77,75,58];  // MNFD
  // 20MA: 단기 추세 위 비율 (저점 33→랠리 86→6/5 급락 57)
  const bhSPX20  = [33,32,33,34,58,72,75,78,80,80,81,82,83,84,85,85,86,84,83,82,80,57];  // $SPXA20R
  const bhNDX20  = [31,30,31,32,55,70,73,76,78,78,79,80,81,82,83,83,84,82,81,80,78,55];  // MNTW
  // 50MA: 중기 추세 위 비율 (저점 33→랠리 75→6/5 급락 52)
  const bhSPX50  = [33,34,35,38,46,50,52,54,56,58,60,62,65,68,71,72,73,74,75,74,72,52];  // $SPXA50R
  const bhNDX50  = [31,32,33,36,44,48,50,52,54,56,58,60,63,66,69,70,71,72,73,72,70,53];  // MNFI

  Chart.defaults.font.family = "'Inter', 'Noto Sans KR', sans-serif";
  Chart.defaults.color = 'rgba(255,255,255,0.28)';

  const xScale = {
    grid: { color: 'var(--surface-4)', drawBorder: false },
    ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 }, maxRotation: 0, maxTicksLimit: 7 },
    border: { display: false }
  };

  const tipStyle = {
    backgroundColor: '#111a2f', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    titleColor: '#a5b0c2', bodyColor: '#f0f4fc', padding: 8,
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
            { name: 'SPY', color: '#00bcd4', lineWidth: 2, data: _bhSpyData },
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
          { label: 'SPY', data: bhSPY, borderColor: '#00bcd4',
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
              g.addColorStop(0, 'rgba(0,212,255,0.15)'); g.addColorStop(1, 'rgba(0,212,255,0)');
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
          y: { grid: { color: 'var(--surface-4)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 },
              callback: v => '$' + v, maxTicksLimit: 5 },
            border: { display: false } }
        }
      }
    });
  }

  // ── Shared breadth scale options ────────────────────────────────────
  function maScale(min, max) {
    return {
      grid: { color: 'var(--surface-4)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 },
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
          { label: 'NDX', data: ndxData, borderColor: '#ff5b50',
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

  bhChartInstances['5ma']  = makeBreadthChart('bh-5ma-chart',   bhSPX5,   bhNDX5,   true, '#00bcd4', 'rgba(0,212,255,');
  bhChartInstances['20ma'] = makeBreadthChart('bh-20ma-chart',  bhSPX20,  bhNDX20,  true, '#00bcd4', 'rgba(0,212,255,');
  bhChartInstances['50ma'] = makeBreadthChart('bh-50ma-chart',  bhSPX50,  bhNDX50,  true, '#60d394', 'rgba(96,211,148,');

  // v41.2: SPY/QQQ 히스토리 가격 차트 동적 교체 (Yahoo Finance)
  _refreshBreadthHistoryCharts();
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
    if (hdrBadge){ hdrBadge.textContent = 'AI OFF'; hdrBadge.style.color = 'var(--text-muted)'; hdrBadge.style.borderColor = 'var(--border)'; hdrBadge.style.background = 'var(--surface-3)'; }
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
      if (cancelBtn) cancelBtn.addEventListener('click', function() { resolve(false); }, { once: true });
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
// popstate only available outside sandboxed iframes
// v30.14: popstate 핸들러 — 전체 9개 페이지 reinit (기존 3개만 있어서 6개 누락 수정)
try { if (!window._aioPopstateRegistered) window.addEventListener('popstate', (e) => {
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
  const hash = location.hash.slice(1);
  if (hash) {
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
      if (activeId === 'sentiment' && typeof initSentimentPage === 'function') initSentimentPage(true);
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
// H2-07: the feedback overlay was retired with its DOM. Keep the legacy helpers
// inert for old bookmarks; the public contact path is the GitHub Issues link in Guide.
const FEEDBACK_EMAIL = '';
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
  if (!document.getElementById('feedback-overlay')) {
    if (typeof showToast === 'function') showToast('피드백 보드는 운영하지 않습니다. 가이드의 GitHub Issues 문의 경로를 이용하세요.');
    return false;
  }
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
  link.href   = 'https://github.com/ysnle/aio-screener/issues';
  link.click();
  const s = document.getElementById('fb-status');
  if (s) { s.style.color = '#00e5a0'; s.textContent = '메일 앱이 열립니다. 전송 후 창을 닫아주세요.'; }
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
    if (s) { s.style.color = '#00e5a0'; s.textContent = '클립보드에 복사됐습니다.'; }
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
    el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px;">제출 내역 없음</div>';
    return;
  }
  const icons = { bug: 'BUG', data: 'DATA', realtime: 'RT', feature: 'REQ' };
  el.innerHTML = list.map(f => {
    const d = new Date(f.time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return '<div style="font-size:11px;padding:5px 6px;border-bottom:1px solid var(--surface-4);display:flex;gap:6px;">' +
      '<span>' + (icons[f.type] || '') + '</span>' +
      '<span style="flex:1;color:var(--text-secondary);">' + escHtml(f.desc) + '</span>' +
      '<span style="color:var(--text-muted);white-space:nowrap;">' + d + '</span></div>';
  }).join('');
}



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
      title.id = labelId;
      pg.setAttribute('aria-labelledby', labelId);
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
  var liveEls = ['score-gauge-val', 'pf-total-value', 'pf-total-pnl'];
  liveEls.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('aria-live', 'polite');
  });

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

  // 16. v40.9: 동적 가격 업데이트 영역 aria-live 확장
  document.querySelectorAll('[data-live-price]').forEach(function(el) {
    if (!el.getAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
    if (!el.getAttribute('aria-atomic')) el.setAttribute('aria-atomic', 'true');
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
    if (text && text.length <= 40) { el.setAttribute('aria-label', text); return; }
    if (text) el.setAttribute('aria-label', text.substring(0, 30));
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
  ['snapshot-stale-warning','data-status-panel','home-risk-regime-badge','score-decision-sub'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute('aria-live')) { el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true'); }
  });

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

  // 23. v41.2: 페이지 타이틀에 heading role 보강 (.page-title -> h2)
  document.querySelectorAll('.page-title').forEach(function(pt) {
    if (pt.tagName !== 'H2') { pt.setAttribute('role', 'heading'); pt.setAttribute('aria-level', '2'); }
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
    var portfolioExposure = { score: semiHeat ? Math.min(100, (semiHeat.score || 0) + (semiHeat.aiInfraHeat ? (semiHeat.aiInfraHeat.score || 0) * 0.35 : 0)) : 0, flags: semiHeat && semiHeat.state ? ['SEMI_CONTEXT_' + semiHeat.state] : [] };
    var lockoutAction = window.calcLockoutAction ? window.calcLockoutAction({ extension: extensionHeat, candle: candleRisk, opexGamma: opexGammaRisk, breadth: breadthRotation, portfolioExposure: portfolioExposure }) : null;
    var blowoffTop = window.calcBlowoffTopChecklist ? window.calcBlowoffTopChecklist(snapshot, {
      semiHeat: semiHeat,
      opexGammaRisk: opexGammaRisk,
      breadthRotation: breadthRotation,
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
  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    var band = total >= 75 ? 'SEPA Zone' : total >= 60 ? 'Buy Ready' : total >= 45 ? 'Neutral' : total >= 30 ? '주의' : 'Avoid';
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
    var vix = d.vix || 20;
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
      { label: '모멘텀', v: _cl((f.momentum || 50) / 100, 0, 1) },
      { label: '추세',   v: _cl((f.trend    || 50) / 100, 0, 1) },
      { label: '저변동', v: _cl((f.lowvol   || 50) / 100, 0, 1) },
      { label: 'RSI',    v: _cl(1 - Math.abs((f.rsi || 50) - 50) / 50, 0, 1) },
      { label: '퀄리티', v: _cl((f.quality  || 50) / 100, 0, 1) },
      { label: '밸류',   v: _cl((f.value    || 50) / 100, 0, 1) },
    ];
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
    out += '<polygon points="' + pts.join(' ') + '" fill="' + _alphaRgb(C.cyan, 0.12) + '" stroke="' + C.cyan + '" stroke-width="1.5"/>';
    axes.forEach(function (ax, i) {
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
      ['CPI',  _n(d.cpi || 3.0, 1) + '%',  (d.cpi || 3) > 3.5 ? C.red : (d.cpi || 3) > 2 ? C.amber : C.green],
      ['금리', _n(d.fedRate || 4.5, 2) + '%', (d.fedRate || 4.5) > 4.5 ? C.red : C.amber],
      ['실업', _n(d.unemployment || 4.0, 1) + '%', (d.unemployment || 4) > 4.5 ? C.red : C.green],
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
    var sym = d.sym || '—', price = d.price || 0, sma50 = d.sma50 || price * 0.96;
    var sma200 = d.sma200 || price * 0.88, ath = d.ath || price * 1.10;
    var ret3m = d.ret3m || 0, rsi = d.rsi || 50;
    var W = 420, H = 170, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, sym + ' 가격 포지셔닝', C.text, 10, 700);
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
      { term: '1M',  rate: d.irx  || 5.2 },
      { term: '2Y',  rate: d.twoY || 4.8 },
      { term: '5Y',  rate: d.fvx  || 4.5 },
      { term: '10Y', rate: d.tnx  || 4.5 },
      { term: '30Y', rate: d.tyx  || 4.8 },
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
      { label: 'Fear & Greed', v: _cl(d.fg      || 50, 0, 100), min: 0, max: 100, inv: false, lo: '공포', hi: '탐욕',   unit: '' },
      { label: 'VIX',          v: _cl(d.vix     || 20, 0, 60),  min: 0, max: 60,  inv: true,  lo: '안정', hi: '극공포', unit: '' },
      { label: 'VVIX',         v: _cl(d.vvix    || 100, 70, 180), min: 70, max: 180, inv: true, lo: '안정', hi: '극공포', unit: '' },
      { label: 'AAII Bear%',   v: _cl(d.aaiiBear|| 40, 0, 70),  min: 0, max: 70,  inv: true,  lo: '낙관', hi: '비관',   unit: '%' },
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
    var cpi = snap.cpi || 3, rate = snap.fedRate || 4.5, u = snap.usUnemploy || 4.0;
    if (u >= 5.2 || (u >= 4.8 && cpi < 2.5)) return 'CONTRACTION';
    if (cpi >= 3.8 && rate >= 4.8) return 'LATE';
    if (cpi >= 2.5 || rate >= 3.0) return 'MID';
    return 'EARLY';
  }

  function _buildScore() {
    var s = _getScore();
    var total = s.total || 0;
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
    var total = s.total || 50;
    var vix = _ld('^VIX') || snap.vix || 20;
    var regime = total >= 75 ? 'BULL' : total >= 60 ? '매수우호' : total >= 45 ? 'NEUTRAL' : total >= 30 ? '경계' : 'BEAR';
    var spyScore = _cl(s.trendScore || 50, 0, 100);
    var vixScore = vix >= 35 ? 8 : vix >= 25 ? 28 : vix >= 18 ? 55 : vix >= 14 ? 78 : 92;
    return { regime: regime, score: total, vix: vix, spyScore: spyScore, vixScore: vixScore };
  }

  function _buildSentiment() {
    var snap = _snap();
    var fgMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    return {
      fg:       _cl(fgMetric && fgMetric.value != null ? fgMetric.value : 50, 0, 100),
      vix:      _ld('^VIX')  || snap.vix   || 20,
      vvix:     _ld('^VVIX') || 100,
      aaiiBear: _cl(window._aaiiBearish || 40, 0, 70),
    };
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
    var scrLen = (typeof SCREENER_DB !== 'undefined' && SCREENER_DB) ? SCREENER_DB.length : 0;
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
    return {
      stage:        _econStage(snap),
      cpi:          snap.cpi || snap.coreCpi || 3.0,
      fedRate:      snap.fedRate || 4.5,
      unemployment: snap.usUnemploy || 4.0,
    };
  }

  function _buildPrice() {
    var snap = _snap();
    var price  = _ld('SPY') || snap.spyClose || 550;
    // SPX MA를 10으로 나눠 SPY 근사. _spxMA 없으면 가격 기반 추정
    var sma50  = (window._spxMA && window._spxMA[50])  ? window._spxMA[50]  / 10 : price * 0.965;
    var sma200 = (window._spxMA && window._spxMA[200]) ? window._spxMA[200] / 10 : price * 0.89;
    var ath = snap.spxATH ? snap.spxATH / 10 : price * 1.03;
    if (ath < price) ath = price * 1.01;
    // v52.16 P5l/P619: snap.spy3m/spyRsi는 어디서도 대입되지 않는 phantom field라 항상 0/50 기본값이었음 —
    // updateTechIndicators()(index.html)이 실계산해 저장하는 window._spyPositionStats로 전환.
    var posStats = window._spyPositionStats;
    var ret3m = (posStats && posStats.ret3m != null) ? posStats.ret3m : (snap.spy3m || 0);
    var rsi = (posStats && posStats.rsi != null) ? posStats.rsi : (snap.spyRsi || 50);
    return { sym: 'SPY', price: price, sma50: sma50, sma200: sma200, ath: ath, ret3m: ret3m, rsi: rsi };
  }

  function _buildYield() {
    var snap = _snap();
    var tnx = _ld('^TNX') || snap.tnx || 4.5;
    return {
      irx:  snap.irx  || 5.2,
      twoY: snap.tnx2y || tnx * 0.97,
      fvx:  snap.fvx  || tnx * 0.98,
      tnx:  tnx,
      tyx:  snap.tyx  || tnx * 1.06,
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
    var db = (typeof SCREENER_DB !== 'undefined') ? SCREENER_DB : [];
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
      switch (pid) {
        case 'home':
          // v52.65: vis-home-score/vis-home-regime(원형게이지+2x2쿼드런트) DOM 제거 —
          // 시안 1b 히어로(index.html home-hero-*)로 대체, js/aio-data.js _aioRenderHomeHero()가 렌더.
          try { if (typeof window._aioRenderHomeHero === 'function') window._aioRenderHomeHero(); } catch(_) {}
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
    if (!row) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    window._aioDiagram.render('factor-radar', el, {
      sym: ticker,
      factors: {
        momentum: _cl(row.momentum || 50, 0, 100),
        trend:    _cl(row.trend    || 50, 0, 100),
        lowvol:   _cl(100 - (row.lowvol || 50), 0, 100),
        rsi:      _cl(row.rsi     || 50, 0, 100),
        quality:  _cl(row.quality || 50, 0, 100),
        value:    _cl(row.value   || 50, 0, 100),
      },
      rank: (row.quantRank != null) ? row.quantRank : (row.rank != null ? row.rank : null),
    });
  };

  window._aioRenderPageDiagram = _aioRenderPageDiagram;

  // ── Phase 3: AI 채팅 자동 시각화 ─────────────────────────────
  // 토픽 감지(q + response text) → 가장 관련 높은 다이어그램 반환 {type, data, label}
  function _findRow(sym) {
    if (typeof SCREENER_DB === 'undefined') return null;
    for (var i = 0; i < SCREENER_DB.length; i++) {
      if (SCREENER_DB[i].sym === sym) return SCREENER_DB[i];
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
              factors: {
                momentum: _cl(row.momentum || 50, 0, 100),
                trend:    _cl(row.trend    || 50, 0, 100),
                lowvol:   _cl(100 - (row.lowvol || 50), 0, 100),
                rsi:      _cl(row.rsi      || 50, 0, 100),
                quality:  _cl(row.quality  || 50, 0, 100),
                value:    _cl(row.value    || 50, 0, 100),
              },
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
  var pctColor = d.pct != null ? (d.pct >= 0 ? '#00e5a0' : '#ff5b50') : '#7b8599';
  var p = d.fmpProfile || {};
  // v48.44: Ticker initial avatar (Figma profile chip 스타일)
  var _initial = String(d.ticker || '?').slice(0, 2).toUpperCase();
  var _avatarTone = (d.pct || 0) >= 0 ? 'tone-green' : 'tone-red';
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">';
  html += '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">';
  html += '<div class="aio-avatar is-lg ' + _avatarTone + '" style="font-family:var(--font-mono);">' + escHtml(_initial) + '</div>';
  html += '<div style="min-width:0;flex:1;">';
  html += '<div style="font-size:var(--fs-2xl);font-weight:800;color:var(--text-primary);letter-spacing:var(--ls-tight);font-family:var(--font-mono);">' + escHtml(d.ticker) + '</div>';
  html += '<div style="font-size:var(--fs-md);color:var(--text-secondary);font-weight:600;">' + escHtml(d.name || '') + '</div>';
  if (p.sector) html += '<div style="font-size:var(--fs-xs);color:var(--text-muted);margin-top:3px;font-weight:500;">' + escHtml(p.sector) + ' · ' + escHtml(p.industry || '') + ' · ' + escHtml(p.country || 'US') + '</div>';
  if (p.ceo) html += '<div style="font-size:var(--fs-xs);color:var(--text-muted);">CEO: ' + escHtml(p.ceo) + ' · 직원: ' + (p.fullTimeEmployees ? Number(p.fullTimeEmployees).toLocaleString() : 'N/A') + '명</div>';
  html += '</div></div>';
  html += '<div style="text-align:right;">';
  if (d.price) {
    html += '<div style="font-size:24px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);">$' + d.price.toFixed(2) + '</div>';
    html += '<div style="font-size:14px;color:' + pctColor + ';font-weight:700;">' + _fmtPct(d.pct) + '</div>';
  }
  if (p.mktCap) html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">시가총액: $' + _fmtNum(p.mktCap) + '</div>';
  // v38.8: 포트폴리오 추가 + 차트분석 연결 버튼
  html += '<div style="display:flex;gap:6px;margin-top:6px;">';
  html += '<button data-action="_aioAddToPortfolio" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table" style="font-size:11px;">포트폴리오에 추가</button>';
  html += '<button data-action="_aioChartAnalyze" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table" style="font-size:11px;">차트 분석</button>';
  html += '</div>';
  // v48.37: SCREENER_DB memo staleness 배지 (애널리스트 리포트 노화 경고)
  if (typeof window._aioStockStaleInfo === 'function') {
    var _staleInfo = window._aioStockStaleInfo(d.ticker);
    if (_staleInfo && _staleInfo.badge) {
      html += '<div style="margin-top:4px;font-size:11px;color:var(--text-muted);">리포트 코멘트: ' + _staleInfo.badge + (_staleInfo.isStale ? ' <span style="color:#f87171;">· 최신 정보 재검증 권장</span>' : '') + '</div>';
    }
  }
  html += '</div></div>';

  // v48.6: 52주 위치 프로그레스 바 + 거래량 스파이크 배지 (Yahoo v7 배치 수집 필드 활용)
  //   데이터 우선순위: _liveData(Yahoo v7/quote) > finnhubMetrics(v48.0)
  //   52W 위치 0~100% — 저가 대비 현재가 백분위 / 거래량 = 오늘 거래량 ÷ 3개월 평균
  var _ld = (window._liveData || {})[d.ticker] || {};
  var _fh = d.finnhubMetrics || {};
  var _w52High = _ld.fiftyTwoWeekHigh != null ? _ld.fiftyTwoWeekHigh : (_fh['52WeekHigh'] != null ? _fh['52WeekHigh'] : null);
  var _w52Low = _ld.fiftyTwoWeekLow != null ? _ld.fiftyTwoWeekLow : (_fh['52WeekLow'] != null ? _fh['52WeekLow'] : null);
  var _vol = _ld.regularMarketVolume != null ? _ld.regularMarketVolume : null;
  var _avgVol3M = _ld.averageDailyVolume3Month != null ? _ld.averageDailyVolume3Month : null;
  var _avgVol10D = _ld.averageDailyVolume10Day != null ? _ld.averageDailyVolume10Day : null;

  if (d.price && _w52High && _w52Low && _w52High > _w52Low) {
    var _pos = ((d.price - _w52Low) / (_w52High - _w52Low)) * 100;
    _pos = Math.max(0, Math.min(100, _pos));
    var _posColor = _pos > 75 ? '#00e5a0' : _pos < 25 ? '#ff5b50' : '#ffa31a';
    var _posLabel = _pos > 90 ? '52주 고가 근접' : _pos > 75 ? '상단 구간' : _pos < 10 ? '52주 저가 근접' : _pos < 25 ? '하단 구간' : '중간 구간';
    html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">';
    html += '<span style="color:var(--text-muted);font-family:var(--font-mono);">52W저 $' + _w52Low.toFixed(2) + '</span>';
    html += '<span style="color:' + _posColor + ';font-weight:700;">' + _posLabel + ' · ' + _pos.toFixed(0) + '%</span>';
    html += '<span style="color:var(--text-muted);font-family:var(--font-mono);">52W고 $' + _w52High.toFixed(2) + '</span>';
    html += '</div>';
    html += '<div style="height:10px;background:var(--surface-5);border-radius:3px;position:relative;overflow:visible;">';
    html += '<div style="height:100%;width:100%;background:linear-gradient(90deg,#f87171 0%,#fbbf24 50%,#3ddba5 100%);border-radius:3px;opacity:0.35;"></div>';
    html += '<div style="position:absolute;top:-3px;left:' + _pos + '%;width:4px;height:16px;background:#fff;transform:translateX(-50%);box-shadow:0 0 6px rgba(255,255,255,0.8);border-radius:2px;"></div>';
    html += '</div>';
    html += '</div>';
  }

  if (_vol && _avgVol3M && _avgVol3M > 0) {
    var _volRatio = _vol / _avgVol3M;
    var _volLabel, _volColor;
    if (_volRatio >= 2.0) { _volLabel = '거래량 폭증'; _volColor = '#ef4444'; }
    else if (_volRatio >= 1.3) { _volLabel = '거래량 상승'; _volColor = '#ffa31a'; }
    else if (_volRatio < 0.5) { _volLabel = '거래량 저조'; _volColor = '#7b8599'; }
    else { _volLabel = '거래량 정상'; _volColor = '#00e5a0'; }
    var _vol10dRatio = (_avgVol10D && _avgVol10D > 0) ? (_vol / _avgVol10D) : null;
    html += '<div style="margin-top:8px;display:flex;gap:8px;font-size:11px;align-items:center;flex-wrap:wrap;">';
    html += '<span style="padding:3px 10px;background:' + _volColor + '22;border:1px solid ' + _volColor + ';color:' + _volColor + ';border-radius:4px;font-weight:700;">' + _volLabel + ' ' + _volRatio.toFixed(1) + 'x</span>';
    html += '<span style="color:var(--text-muted);">3개월 평균 대비 · 오늘 ' + Number(_vol).toLocaleString() + '주';
    if (_vol10dRatio != null) html += ' · 10일 평균 대비 ' + _vol10dRatio.toFixed(1) + 'x';
    html += '</span>';
    html += '</div>';
  }

  if (p.description) {
    // v48.91: escHtml() 적용 — FMP API 기업 설명 XSS 방지
    var desc = p.description.length > 300 ? p.description.slice(0, 300) + '...' : p.description;
    html += '<div style="margin-top:10px;font-size:11px;color:var(--text-secondary);line-height:1.6;border-top:1px solid var(--border);padding-top:8px;">' + escHtml(desc) + '</div>';
  }
  el.innerHTML = html;
  el.style.display = 'block';
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
  function fmtR(v, d2) { // 비율/EPS → 소수점
    if (v === null) return '—';
    return v.toFixed(d2 !== undefined ? d2 : 1);
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
      `점수 급등 첫날 추격보다, 점수가 유지되는지 2~3일 확인 후 비중을 올리는 편이 승률이 높습니다.`
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
      `극단 공포 구간은 일괄 매수가 아니라 분할 매수의 시작점 — 공포는 더 깊어질 수 있습니다.`,
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
      `'외환시장' 섹션의 원/달러·엔/달러 카드를 DXY와 한 세트로: 셋이 같은 방향(달러↑·원↓·엔↓)이면 정상 리스크오프, 엔만 급등하면 캐리 청산 경계.`,
      `<strong>'엔캐리 언와인드 위험도' 게이지</strong>가 위 원리(엔·금리차·VIX·HYG 합성)를 점수화한 것입니다 — 엔 급등이 보이면 이 게이지부터 확인하세요.`,
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
      `로테이션은 연속적입니다: 개선(Improving)→주도(Leading)→약화(Weakening)→지체(Lagging)의 시계방향 회전이 기본 경로라, 위치보다 회전 방향이 중요합니다.`
    ],
    how: [
      `RRG에서 우상(Leading)에 새로 진입하는 테마, 좌상(Improving)에서 우상으로 향하는 꼬리 방향을 보세요.`,
      `'섹터 ETF 퍼포먼스'와 '20일 추이'로 RRG의 판정을 실제 수익률로 교차 확인하세요.`,
      `'경기 사이클 — 지금 어디?' 카드는 어떤 섹터가 다음 주도가 되기 쉬운지의 배경 지도입니다.`,
      `'테마 히트맵'과 세분화 테마에서 카드를 눌러 상세 패널의 주도/부진 종목 분해를 확인하세요.`
    ],
    action: [
      `신규 매수는 Improving→Leading 전환 테마 안에서 고르는 것이 기본 전략입니다.`,
      `Weakening으로 꺾인 주도 테마의 보유 종목은 이익 보호(부분 익절·손절선 상향)를 먼저 겁니다.`
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
      `상단 레짐 표시(현재 시장 국면과 그에 따른 팩터 가중)를 먼저 확인하세요 — 이 스크리너는 국면에 따라 팩터 가중을 바꿉니다.`,
      `헤더 클릭 정렬로 기준을 바꿔 가며 상위에 반복 등장하는 종목(멀티팩터 합의)을 관심 목록으로 올리세요.`,
      `'팩터 검증 · 백테스트 IC' 탭은 각 팩터가 실제로 수익률을 설명해 왔는지의 증거입니다 — 랭킹을 맹신하기 전에 한 번 보세요.`
    ],
    action: [
      `스크리너 상위 종목도 차트(진입 시점)와 어닝 일정(이벤트)을 확인한 뒤에만 진입 — 랭킹은 타이밍을 말해주지 않습니다.`,
      `진입을 정했으면 하단 포지션 사이저에 자본·리스크%·손절가를 넣어 수량부터 고정하세요.`
    ],
    terms: `피오트로스키 F-점수 · PEG Ratio`
  },
  'kr-home': {
    title: `한국 시장의 구조적 특성`,
    concept: [
      `한국 증시는 수출 제조업(특히 반도체) 비중이 커서 글로벌 경기·달러·미국 기술주에 크게 연동됩니다.`,
      `외국인 자금 비중이 높아 환율(원/달러)이 수급의 핵심 변수입니다.`
    ],
    why: [
      `전일 미국 시장의 결과가 다음 날 한국 시장의 갭으로 반영되는 구조입니다 — 한국만 보면 반 박자 늦습니다.`,
      `원화 약세는 외국인 입장에서 '주가가 그대로여도 손실'을 뜻해 순매도를 부르는 되먹임이 있습니다.`
    ],
    how: [
      `'핵심 지수'의 코스피·코스닥·원/달러·VKOSPI를 한 세트로 읽으세요 — 지수 단독 해석은 절반짜리입니다(미국 지수·글로벌 지표는 홈/매크로 페이지에서 확인).`,
      `'투자자 수급 요약'의 외국인 막대가 환율과 같은 방향인지 보세요 — 외국인 순매도+원화 약세 동행이 가장 무거운 조합입니다.`,
      `'시장 체감 온도'(심리·개인·외국인·모멘텀)는 위 수급·지수 데이터를 초보자용 온도계로 합성한 카드입니다 — 세부가 헷갈리면 여기부터.`
    ],
    action: [
      `미국 급락+원화 급락이 겹친 날의 갭 하락 출발은 초반 추격 매도/매수 둘 다 자제하고 첫 1시간 방향을 확인.`
    ],
    terms: `DXY`
  },
  'kr-supply': {
    title: `수급 주체 읽는 법`,
    concept: [
      `한국 시장의 3대 주체: 외국인(글로벌 유동성·환율에 민감, 대형주 중심), 기관(연기금·금융투자 등 성격 상이), 개인(역발상 지표로 자주 인용).`,
      `'수급'은 누가 사고 파는가의 흐름 — 가격의 원인 측 데이터입니다.`
    ],
    why: [
      `외국인 순매수는 원화 자산 전체에 대한 베팅이라 환율과 동행하는 경향 — 외국인 연속 순매도+원화 약세 조합은 추세적 이탈 신호로 무겁게 봅니다.`,
      `같은 '기관 순매수'도 연기금(장기)과 금융투자(단기 차익)는 의미가 다릅니다 — 주체 분해가 필요한 이유.`
    ],
    how: [
      `일간 수급보다 '주간 수급' 표의 연속성(며칠째 같은 방향인가)을 보세요 — 하루 수급은 노이즈가 큽니다.`,
      `외국인 순매수와 환율 방향을 같이 보세요(환율 카드는 한국장 홈/한국 매크로에 있음) — 방향이 갈리면(순매수인데 원화 약세) 지속성을 의심합니다.`,
      `'프로그램 매매'와 공매도 현황(비중·잔고)은 수급의 질을 말합니다 — 지수 상승이 프로그램/숏커버 주도인지, 실매수 주도인지 구분하세요.`
    ],
    action: [
      `외국인이 연속 순매도 중인 대형주의 '싸 보이는' 반등은 짧게만 — 수급 주체가 돌아서기 전 추세 전환은 드뭅니다.`,
      `수급 데이터는 장 마감 후 확정치가 정확합니다 — 장중 잠정치로 과신하지 않기.`
    ],
    terms: `수급 · 프로그램 매매`
  },
  'kr-themes': {
    title: `한국 테마 장세의 특성`,
    concept: [
      `한국 시장은 테마 쏠림이 강하고 순환이 빠릅니다 — 정책·수주·기술 이벤트가 테마를 점화하고, 대장주가 테마 수명을 좌우합니다.`
    ],
    why: [
      `유동성이 소수 테마로 몰리는 구조라 '테마 밖 종목'은 좋은 실적에도 소외되는 기간이 깁니다 — 테마 확인이 종목 선택보다 먼저인 이유.`,
      `대장주가 꺾이면 후발주는 더 크게 꺾입니다 — 후발주 추격이 위험한 구조적 이유.`
    ],
    how: [
      `'테마별 일간 퍼포먼스 랭킹'에서 상위 테마를 고르고, 테마를 눌러 상세 패널에서 대장주의 추세를 함께 보세요 — 대장주가 살아 있는 테마만 유효한 테마로 취급합니다.`,
      `테마 필터로 관심 분야를 좁혀 두면 순환이 돌아왔을 때 빠르게 포착할 수 있습니다.`
    ],
    action: [
      `테마 진입은 대장주 우선, 후발주는 대장주 신고가 유지 조건에서만 짧게.`,
      `테마 뉴스가 지상파/포털 메인에 도달했을 때는 진입이 아니라 이익 실현을 검토할 시점인 경우가 많습니다.`
    ],
    terms: `주도주(대장주)`
  },
  'kr-macro': {
    title: `한국 거시 지표 읽기`,
    concept: [
      `한국 거시의 3축: 수출(경기 선행), 환율(자금 흐름), 기준금리/시장금리(유동성). 수출은 반도체 단가·물량에 크게 좌우됩니다.`
    ],
    why: [
      `수출 지표는 글로벌 수요의 조기 온도계라 코스피 이익 전망과 직결됩니다 — 월초 수출입 통계가 주목받는 이유.`,
      `한미 금리차는 원화 약세 압력의 구조 요인입니다 — 차가 벌어질수록 자금 유출 부담.`
    ],
    how: [
      `'수출입 동향'·'원/달러 환율 분석'·'주요 채권 금리' 표를 방향 위주로 읽고, 급변한 항목만 원인 뉴스를 확인하세요.`,
      `'기준금리 현황'과 한미 금리 캘린더에서 미 10Y와 한국 3Y의 차이(한미 금리차)를 보세요 — 이 차가 원화 약세 압력의 구조 배경입니다.`,
      `'한국 반도체' 섹션은 수출 지표와 코스피 이익 전망을 잇는 다리입니다 — 수출 해석이 헷갈리면 여기와 함께 읽으세요.`
    ],
    action: [
      `수출 개선+원화 안정 조합이 확인되기 전의 코스피 랠리는 수급 반등으로 간주하고 추격을 절제.`
    ],
    terms: `기준금리 · 무역수지`
  },
  'kr-technical': {
    title: `캔들·거래량·MA20 읽는 법`,
    concept: [
      `위 캔들 차트의 캔들 1개=하루의 시가·고가·저가·종가. 아래 막대=거래량, 겹친 선=20일 이동평균(약 한 달 평균 단가).`
    ],
    why: [
      `종가가 MA20 위/아래 어디서 유지되는가가 단기 수급의 우위를 말합니다 — 선 자체보다 '유지 여부'가 정보입니다.`,
      `거래량이 실린 장대 음봉/양봉은 세력의 실제 행동 흔적이라 이후 지지/저항으로 작동하기 쉽습니다.`
    ],
    how: [
      `캔들 몸통·꼬리(매수 방어/매도 압력) → 거래량(동의한 돈) → MA20(평균 단가) 순서로 읽는 습관을 들이세요.`,
      `'한국 시장 건강도' 스코어(VKOSPI·외국인 연속 수급 포함)로 개별 차트 판단 전에 시장 판을 먼저 정하세요 — 미국 페이지의 시장 건강도와 같은 역할의 한국판입니다.`,
      `KR 폭 지표(ADL·52주 신고저·20MA 위 비율)와 금리 스프레드 카드는 코스피 차트 하나로 안 보이는 내부 체력을 보여줍니다.`
    ],
    action: [
      `MA20 아래에서의 반등은 짧게, MA20 회복+거래량 동반일 때만 추세 관점으로 전환합니다.`
    ],
    terms: `이동평균선(MA) · 거래량(Volume)`
  }
};

// 렌더러: 페이지 헤더(.page-title 포함, sec 직계 자식 블록) 바로 다음에 삽입.
// 헤더 블록을 못 찾으면 섹션 최상단 prepend — 어느 경우든 렌더 자체는 항상 성공.
function _aioRenderPageFundamentals(pageId) {
  try {
    var spec = AIO_PAGE_FUNDAMENTALS[pageId];
    var sec = document.getElementById('page-' + pageId);
    if (!spec || !sec || sec.getAttribute('data-aio-fund-done') === '1') return;
    var li = function(arr){ return (arr||[]).map(function(t){ return '<li>' + t + '</li>'; }).join(''); };
    var el = document.createElement('details');
    el.className = 'aio-page-advanced-toggle aio-fund';
    el.innerHTML =
      '<summary>📚 기초 가이드 — ' + spec.title + '</summary>' +
      '<div class="aio-page-advanced-body aio-fund-body">' +
        '<div class="aio-fund-sec"><strong>핵심 개념</strong><ul>' + li(spec.concept) + '</ul></div>' +
        '<div class="aio-fund-sec"><strong>원리 — 왜 중요한가</strong><ul>' + li(spec.why) + '</ul></div>' +
        '<div class="aio-fund-sec"><strong>이 페이지에서 보는 법</strong><ul>' + li(spec.how) + '</ul></div>' +
        '<div class="aio-fund-sec"><strong>실전 적용</strong><ul>' + li(spec.action) + '</ul></div>' +
        (spec.terms ? '<div class="aio-fund-terms">용어 더 보기: 사용 설명서 → 용어사전에서 ' + spec.terms + ' 검색</div>' : '') +
      '</div>';
    // v52.39: border-bottom 인라인 스타일 하드코딩 대신, .page-title에서 sec의 직계 자식까지
    // 걸어 올라가 그 블록 바로 뒤에 삽입 — briefing/fundamental/market-news/kr-* 계열처럼
    // 헤더가 .aio-section으로 한 겹 더 감싸여 있거나 border-bottom 스타일이 없는 페이지도
    // "헤더 블록 바로 다음"에 정확히 배치된다(22페이지 헤더 구조가 제각각이라 일반화 필요).
    var head = sec.querySelector('.page-title');
    var anchor = null;
    if (head) {
      var node = head;
      while (node && node.parentElement && node.parentElement !== sec) node = node.parentElement;
      if (node && node.parentElement === sec) anchor = node;
    }
    if (anchor) anchor.insertAdjacentElement('afterend', el);
    else sec.insertBefore(el, sec.firstElementChild);
    sec.setAttribute('data-aio-fund-done', '1');
  } catch(_) {}
}
_aioPageBus.register('ui-page-fundamentals', 'aio:pageShown', function(e){
  _aioRenderPageFundamentals(e && e.detail);
});
// v52.39: this file's own initFromHash() (~line 2156) already ran and fired the *first*
// aio:pageShown before script execution reached this registration point — a bare load with no
// hash never calls showPage() for 'home' at all (it is .active from static HTML), and a
// hash-loaded page's one showPage() call fires before the listener above exists. Catch up once
// for whatever page is already active by now so the very first page a visitor sees isn't the
// one exception that never gets the block until they navigate away and back.
try {
  var _aioFundInitPage = document.querySelector('.page.active');
  if (_aioFundInitPage && _aioFundInitPage.id) _aioRenderPageFundamentals(_aioFundInitPage.id.replace(/^page-/, ''));
} catch(_) {}
