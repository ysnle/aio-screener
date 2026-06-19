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
    ctx.strokeStyle = s.color || '#00d4ff';
    ctx.lineWidth = s.width || 2;
    ctx.beginPath();
    data.forEach(function(v, i) {
      var x = padL + (data.length === 1 ? plotW : i / (data.length - 1) * plotW);
      var y = yFor(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    var last = data[data.length - 1];
    ctx.fillStyle = s.color || '#00d4ff';
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
  _drawSentimentFallbackLine(document.getElementById('naaim-chart'), [{ data: [63.5,67.1,67.0,60.2,62.5,68.36,69.38,79.49,94.15,96.2,92.5,95.1,97.8,96.4,89.5], color: '#00d4ff' }], { label: 'NAAIM', min: 0, max: 100 }); // v50.15: 6/3 연장
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
          color: '#00d4ff',
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
        borderColor: '#00d4ff',
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
    try { if (typeof fgUpdateNeedle === 'function') fgUpdateNeedle((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 15); } catch(_) {}
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

  fgUpdateNeedle((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 15);
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
  var breadth = (typeof window._breadth200 === 'number') ? window._breadth200 : ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.breadth200 : 75);

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
    stage = 'Stage 1 (바닥 형성)'; color = '#00d4ff';
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
    verdict = ' <b>브레드스 쓰러스트 수준</b> — 5SMA ' + b5.toFixed(0) + '% · 50SMA ' + b50.toFixed(0) + '%. 극히 높은 참여율. 진짜 바닥 확인 가능성. 리더주 셋업 완성 시 적극 매수.';
    color = '#00e5a0'; bg = 'var(--data-green-faint)';
  } else if (b5 > 50 && b20 > 40) {
    verdict = ' <b>고품질 랠리</b> — 5SMA ' + b5.toFixed(0) + '% · 20SMA ' + b20.toFixed(0) + '%. 광범위 참여. Follow-through 진행 중. 리테스트 대기하며 선별 매수 가능.';
    color = '#00d4ff'; bg = 'var(--data-cyan-light)';
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
  function _bbColor(v) { return v >= 50 ? '#00e5a0' : v >= 30 ? '#ffa31a' : '#ff5b50'; }
  function _bbBg(v)    { return v >= 50 ? 'var(--data-green-mid)' : v >= 30 ? 'var(--data-amber-mid)' : 'var(--data-red-mid)'; }
  function _bbLbl(v)   { return v >= 60 ? '강세' : v >= 50 ? '중립↑' : v >= 35 ? '중립↓' : '약세'; }
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
  // v50.17: breadth 페이지 50SMA 막대(width) + 해석 readout 동적 갱신
  // (큰 숫자 breadth-50sma-big은 data-snap으로 갱신되나 막대 width·readout 텍스트는 정적 46% 잔존 → 카드 52%와 모순 시정)
  var b50r = (typeof window._breadth50 === 'number') ? window._breadth50 :
             ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.breadth50sma != null) ? DATA_SNAPSHOT.breadth50sma : null);
  if (b50r != null && !isNaN(b50r)) {
    var b50Bar = document.getElementById('breadth-50sma-bar');
    if (b50Bar) b50Bar.style.width = b50r + '%';
    var b50Read = document.getElementById('breadth-50sma-readout');
    if (b50Read) {
      var over50 = b50r >= 50;
      var strength = b50r >= 60 ? '건강한 상승 구간' : (over50 ? '50% 상회(약)' : '50% 미탈환');
      b50Read.textContent = '50일선 ' + Math.round(b50r) + '% — ' + strength + '. 60% 돌파 시 건강한 상승장 확인. 미너비니 바닥 2단계(리테스트) 관찰 구간.';
    }
  }
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
            { name: 'SPY', color: '#00d4ff', lineWidth: 2, data: _bpSpyData },
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
          { label: 'SPY', data: bpSPY, borderColor: '#00d4ff',
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
    priceCtx._bpMouseLeave = bpPriceMouseLeave;
    priceCtx.addEventListener('mouseleave', bpPriceMouseLeave);
  }

  // ─ Panels 1-3: Breadth ──────────────────────────────────────────
  bpChartInstances['5ma']  = makeBreadthPanel('bp-5ma-chart',  bpSPX5,  bpNDX5,  '#00d4ff', 0.18);
  bpChartInstances['20ma'] = makeBreadthPanel('bp-20ma-chart', bpSPX20, bpNDX20, '#00d4ff', 0.15);
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
            color: '#00d4ff',
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
          borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)',
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
            { name: 'SPY', color: '#00d4ff', lineWidth: 2, data: _bhSpyData },
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
          { label: 'SPY', data: bhSPY, borderColor: '#00d4ff',
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

  bhChartInstances['5ma']  = makeBreadthChart('bh-5ma-chart',   bhSPX5,   bhNDX5,   true, '#00d4ff', 'rgba(0,212,255,');
  bhChartInstances['20ma'] = makeBreadthChart('bh-20ma-chart',  bhSPX20,  bhNDX20,  true, '#00d4ff', 'rgba(0,212,255,');
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
    hdrBadge.style.color = grade === 'green' ? '#00d4ff' : grade === 'warn' ? '#ffa31a' : '#ff5b50';
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
    layer.style.cssText = 'display:none;position:fixed;right:14px;top:58px;z-index:99998;width:min(360px,calc(100vw - 28px));background:var(--surface-2,#111827);border:1px solid var(--border,#2b3440);border-radius:8px;box-shadow:0 14px 34px rgba(0,0,0,.35);padding:10px 12px;color:var(--text-primary,#e5edf5);font-family:var(--font-sans,system-ui);';
    layer.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;"><div id="aio-refresh-progress-title" style="font-size:12px;font-weight:800;">전체 데이터 최신화</div><div id="aio-refresh-progress-count" style="font-size:11px;font-family:var(--font-mono,monospace);color:var(--data-cyan,#00d4ff);">0/0</div></div><div style="height:4px;background:var(--surface-4,#253040);border-radius:4px;overflow:hidden;margin-bottom:8px;"><div id="aio-refresh-progress-bar" style="height:100%;width:0%;background:var(--data-cyan,#00d4ff);transition:width .25s ease;"></div></div><div id="aio-refresh-progress-current" style="font-size:11px;color:var(--text-muted,#8b98a5);margin-bottom:8px;">대기 중</div><div id="aio-refresh-progress-list" style="display:grid;gap:4px;max-height:190px;overflow:auto;"></div>';
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
    if (text === '진행 중') return 'var(--data-cyan,#00d4ff)';
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
      bar.style.background = failed ? 'var(--data-amber,#ffa31a)' : 'var(--data-cyan,#00d4ff)';
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
  // 5. v48.96 P1-6: 숨김 상태에서 초기화된 차트 width=0 → resize 보정
  //    Chart.js: _aioChartRegistry.resizeAll(), lightweight-charts: applyOptions({width})
  setTimeout(function() {
    if (window._aioChartRegistry) { window._aioChartRegistry.resizeAll(); }
    // lightweight-charts 인스턴스 재조정 (fund 섹션 내 lw-chart 컨테이너)
    var lwContainers = document.querySelectorAll('[data-fund-tab="' + tab + '"] [id$="-lw-chart"]');
    lwContainers.forEach(function(container) {
      var chart = container._lwChart;
      if (chart && typeof chart.applyOptions === 'function') {
        var w = container.clientWidth;
        if (w > 0) { try { chart.applyOptions({ width: w }); } catch(e) {} }
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

function _itbEsc(v) {
  if (typeof escHtml === 'function') return escHtml(v);
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); });
}

function _itbNum(v, digits) {
  if (v === null || v === undefined || !isFinite(Number(v))) return '--';
  return Number(v).toFixed(digits == null ? 2 : digits);
}

function _itbBadge(label, tone) {
  var color = tone === 'risk' ? 'var(--data-red)' : tone === 'warn' ? 'var(--data-amber)' : tone === 'bull' ? 'var(--data-green)' : 'var(--data-cyan)';
  return '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;background:' + color + '1f;color:' + color + ';border:1px solid ' + color + '55;font-size:10px;font-weight:800;">' + _itbEsc(label) + '</span>';
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
  return _itbBadge('Data ' + label + conf, tone) + '<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">' + _itbEsc((quality.freshness || 'UNKNOWN') + source) + '</span>';
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
      '<td style="padding:6px 4px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbEsc(item.ticker || '-') + '</td>' +
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
  el.innerHTML = '<div style="height:22px;padding:5px 7px;font-size:10px;font-weight:800;color:var(--text-muted);display:flex;justify-content:space-between;"><span>' + _itbEsc(label) + '</span><span>OHLCV</span></div><div class="itb-chart-body" style="height:166px;"></div>';
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
    body.innerHTML = '<svg role="img" aria-label="' + _itbEsc(label) + ' fallback OHLC chart" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="166" style="display:block;background:#0b1222;">' +
      '<path d="' + line + '" fill="none" stroke="#00d4ff" stroke-width="1.4" opacity=".75"/>' + candles +
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
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:7px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Action</div><div style="margin-top:4px;">' + _itbBadge(sp.action || 'HOLD_CORE', _itbActionTone(sp.action)) + '</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:7px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Sell Pressure</div><div style="font-size:18px;font-weight:900;color:var(--text-primary);font-family:var(--font-mono);">' + _itbNum(sp.score, 0) + '/100</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:7px;padding:8px;">' +
      '<div style="font-size:10px;color:var(--text-muted);font-weight:700;">Trend Regime</div><div style="margin-top:4px;">' + _itbBadge((s.above50SMA === false ? 'Below 50SMA' : 'Above key MAs'), regimeTone) + '</div></div>' +
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:7px;padding:8px;">' +
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
    '<div style="font-size:11px;color:var(--text-primary);line-height:1.5;font-weight:700;margin-bottom:7px;">' + _itbEsc(plan.primary || 'No plan available') + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;">' + _itbEsc(plan.tradingLot || '') + '<br>' + _itbEsc(plan.swingLot || '') + '<br>' + _itbEsc(plan.thesisLine || '') + '</div>';
}

function renderBeginnerExplanation(result) {
  var el = document.getElementById('tech-brief-beginner');
  if (!el || !result) return;
  var s = result.snapshot || {}, sp = result.sellPressure || {}, plan = result.exitPlan || {};
  el.innerHTML = '<b style="color:var(--data-cyan);">Beginner translation:</b> RSI 70+ 자체는 매도 버튼이 아닙니다. 강한 장에서는 과열이 오래 유지될 수 있습니다. 지금 엔진은 50일선 대비 ATR 이격(' + _itbNum(s.dist50Atr, 1) + 'x), RVOL(' + _itbNum(s.rvol20, 1) + 'x), 종가 위치(' + _itbNum((s.closePosition || 0) * 100, 0) + '%), 볼린저 재진입, 10/21/50선 이탈을 함께 보고 <b>' + _itbEsc(sp.action || 'HOLD_CORE') + '</b>로 결론냅니다. ' + _itbEsc(plan.beginner || '');
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
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Lockout Action</div><div style="margin-top:5px;">' + _itbBadge(lock.action || 'HOLD_CORE', _itbActionTone(lock.action)) + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Regime</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + _itbEsc(lock.regime || 'LOCKOUT_CONTINUATION') + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Risk</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbNum(lock.score, 0) + '/100</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">OPEX</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + _itbEsc(opex.daysToOpex == null ? 'n/a' : ('D-' + opex.daysToOpex)) + '</div></div>' +
    '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:8px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Candle</div><div style="font-size:11px;font-weight:900;color:var(--text-primary);margin-top:5px;">' + _itbEsc(candle.type || 'NEUTRAL') + '</div></div>' +
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
      '<span><b style="color:' + color + ';">' + _itbEsc(item && item.label || '--') + '</b><br><span style="color:var(--text-muted);">' + _itbEsc(item && item.detail || '') + '</span></span>' +
    '</div>';
  }
  var timeline = (eventCtx.timeline || []).map(function(e) {
    var etone = e.tone === 'risk' ? 'risk' : e.tone === 'hope' ? 'bull' : 'warn';
    return '<div style="border-left:2px solid ' + (etone === 'risk' ? '#ff5b50' : etone === 'bull' ? '#5cff95' : '#f6c85f') + ';padding:4px 0 5px 8px;">' +
      '<div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);">' + _itbEsc(e.date || '') + '</div>' +
      '<div style="font-size:11px;font-weight:800;color:var(--text-primary);">' + _itbEsc(e.label || '') + '</div>' +
    '</div>';
  }).join('');
  el.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<div><div style="font-size:10px;font-weight:900;color:var(--data-cyan);letter-spacing:.18em;">BLOW-OFF TOP CHECKLIST</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">이격 과열, CPI/유가, OPEX, 이벤트 소진을 한 화면에서 확인합니다.</div></div>' +
      '<div style="display:flex;gap:6px;align-items:center;">' + _itbBadge(blowoffTop.state || 'DATA', tone) + _itbBadge(blowoffTop.action || 'HOLD_CORE', tone) + '<span style="font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _itbNum(blowoffTop.score, 0) + '/100</span></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">' +
      '<div style="background:#0e1622;border:1px solid rgba(255,91,80,0.28);border-radius:6px;padding:10px;border-left:3px solid #ff5b50;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:5px;">현재 충족 조건 (위험 신호)</div>' +
        checks.map(function(c) { return renderLine(c, false); }).join('') +
      '</div>' +
      '<div style="background:#0e1622;border:1px solid rgba(92,255,149,0.24);border-radius:6px;padding:10px;border-left:3px solid #5cff95;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:5px;">아직 미충족 조건 (상승 유지 근거)</div>' +
        supports.map(function(c) { return renderLine(c, true); }).join('') +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:10px;">' +
      '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:10px;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:7px;">Event Runway</div>' + (timeline || '<div style="font-size:11px;color:var(--text-muted);">No event context</div>') +
      '</div>' +
      '<div style="background:#0b1222;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:10px;">' +
        '<div style="font-size:10px;font-weight:900;color:var(--text-muted);margin-bottom:7px;">Beginner Translation</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);line-height:1.65;">상승장이 강해도 가격이 20일선·50일선에서 너무 멀고, 거래량 급증 뒤 종가가 약하거나 이벤트가 끝나면 추격매수보다 스탑 상향과 일부 익절이 먼저입니다. 반대로 10/21EMA와 수급 확산이 살아 있으면 전량 매도 신호로 보지 않습니다.</div>' +
      '</div>' +
    '</div>';
}

function renderExtensionHeatPanel(extensionHeat) {
  var el = document.getElementById('tech-lockout-extension');
  if (!el) return;
  extensionHeat = extensionHeat || {};
  var tone = extensionHeat.score >= 50 ? 'risk' : extensionHeat.score >= 25 ? 'warn' : 'bull';
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Extension Heat</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' + _itbBadge(extensionHeat.state || 'NORMAL', tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(extensionHeat.score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:7px;">20MA ATR: ' + _itbNum(extensionHeat.dist20Atr, 1) + 'x<br>20MA ADR: ' + _itbNum(extensionHeat.dist20Adr, 1) + 'x<br>50SMA ATR: ' + _itbNum(extensionHeat.dist50Atr, 1) + 'x</div>' +
    _renderFlagList(extensionHeat.flags);
}

function renderOpexGammaPanel(opexGamma) {
  var el = document.getElementById('tech-lockout-opex');
  if (!el) return;
  opexGamma = opexGamma || {};
  var tone = opexGamma.regime === 'GAMMA_UNWIND_RISK' ? 'risk' : opexGamma.regime === 'GAMMA_DECAY_WATCH' ? 'warn' : 'bull';
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">OPEX / Gamma</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' + _itbBadge(opexGamma.regime || 'GAMMA_SUPPORT', tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(opexGamma.score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:7px;">Next OPEX: ' + _itbEsc(opexGamma.nextOpexDate || '--') + '<br>Equity PCR: ' + _itbNum(opexGamma.equityPutCall, 2) + '<br>Index PCR: ' + _itbNum(opexGamma.indexPutCall, 2) + '</div>' +
    _renderFlagList(opexGamma.flags);
}

function renderBreadthRotationPanel(breadthRotation) {
  var el = document.getElementById('tech-lockout-breadth');
  if (!el) return;
  breadthRotation = breadthRotation || {};
  var tone = breadthRotation.regime === 'FAILED_ROTATION' ? 'risk' : breadthRotation.regime === 'BREADTH_BROADENING' ? 'bull' : 'warn';
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Breadth / Rotation</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' + _itbBadge(breadthRotation.regime || 'NARROW_LEADERSHIP', tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(breadthRotation.score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:7px;">IWM vs QQQ: ' + _itbNum(breadthRotation.iwmVsQqqRS_5d, 2) + '%<br>RSP vs SPY: ' + _itbNum(breadthRotation.rspVsSpyRS_5d, 2) + '%</div>' +
    _renderFlagList(breadthRotation.flags);
}

function renderCandleRiskBadge(candleRisk) {
  var el = document.getElementById('tech-lockout-candle');
  if (!el) return;
  candleRisk = candleRisk || {};
  var m = candleRisk.metrics || {};
  var tone = candleRisk.score >= 55 ? 'risk' : candleRisk.score >= 25 ? 'warn' : 'bull';
  el.innerHTML = '<div style="font-size:10px;font-weight:900;color:var(--text-secondary);margin-bottom:7px;">Terminal Candle</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' + _itbBadge(candleRisk.type || 'NEUTRAL', tone) + '<span style="font-size:18px;font-weight:900;font-family:var(--font-mono);">' + _itbNum(candleRisk.score, 0) + '</span></div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-top:7px;">Close position: ' + _itbNum((m.closePosition || 0) * 100, 0) + '%<br>Upper wick: ' + _itbNum((m.upperWickPct || 0) * 100, 0) + '%<br>Gap: ' + _itbNum(m.gapUpPct, 2) + '%</div>' +
    _renderFlagList(candleRisk.flags);
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
  if (row) row.innerHTML = '<div style="grid-column:1/-1;padding:10px;color:var(--text-muted);font-size:11px;">Institutional technical brief input pending for ' + _itbEsc(symbol) + '...</div>';
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
    green:  '#50c87a', amber:  '#ffb43c', red:    '#ff5b50',
    cyan:   '#00d4ff', blue:   '#4ca0ff', muted:  '#5a7080',
    text:   '#dce6f0', bg:     '#0d0f14', surface:'#131820', border: '#1e2736',
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
      ' style="width:100%;max-width:' + w + 'px;display:block;font-family:\'JetBrains Mono\',monospace"' +
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
    out += _o(cx, cy, r, _alphaRgb(C.bg, 0.6), col, 2.5);
    out += _t(cx, cy - 3, _n(total), col, 26, 900, 'middle');
    out += _t(cx, cy + 14, '/ 100', C.muted, 9, 400, 'middle');
    var band = total >= 75 ? 'SEPA Zone' : total >= 60 ? 'Buy Ready' : total >= 45 ? 'Neutral' : total >= 30 ? '주의' : 'Avoid';
    out += _r(cx - 32, cy + 22, 64, 15, _alphaRgb(col, 0.14), 4, col, 1);
    out += _t(cx, cy + 33, band, col, 8, 700, 'middle');
    var y0 = 34;
    comps.forEach(function (c, i) {
      var y = y0 + i * 30;
      var pct = _cl(c.value / (c.max || 20), 0, 1);
      var cc = _scoreCol(pct * 100);
      out += _t(14, y + 11, c.label, C.muted, 8.5);
      out += _r(90, y + 3, 190, 10, 'rgba(255,255,255,0.05)', 3);
      out += _r(90, y + 3, Math.round(190 * pct), 10, _alphaRgb(cc, 0.65), 3);
      out += _t(286, y + 12, _n(c.value, 0) + '/' + c.max, cc, 8.5, 700);
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
    out += _t(qx + qw / 2, qy - 5, '위험선호', C.muted, 7.5, 600, 'middle');
    out += _t(qx + qw / 2, qy + qh + 12, '위험회피', C.muted, 7.5, 600, 'middle');
    out += _t(qx + qw / 4, qy + 11, 'Bear Rally', C.red, 7.5, 600, 'middle');
    out += _t(qx + qw * 3 / 4, qy + 11, 'Bull Trend', C.green, 7.5, 600, 'middle');
    out += _t(qx + qw / 4, qy + qh - 6, '방어 포지션', C.amber, 7.5, 600, 'middle');
    out += _t(qx + qw * 3 / 4, qy + qh - 6, '회복 추세', C.cyan, 7.5, 600, 'middle');
    var dotX = qx + _cl((spyPct / 100) * qw, 8, qw - 8);
    var dotY = qy + _cl(((100 - vixPct) / 100) * qh, 8, qh - 8);
    var col = _scoreCol(score);
    out += _o(dotX, dotY, 9, _alphaRgb(col, 0.18), col, 2);
    out += _o(dotX, dotY, 3.5, col);
    var rx = 332, ry = 56;
    out += _r(rx, ry, 94, 68, _alphaRgb(col, 0.10), 6, col, 1);
    out += _t(rx + 47, ry + 16, regime, col, 9, 700, 'middle');
    out += _t(rx + 47, ry + 31, '점수 ' + _n(score), C.muted, 8, 600, 'middle');
    out += _t(rx + 47, ry + 47, 'VIX ' + _n(vix, 1), vix >= 25 ? C.red : vix >= 18 ? C.amber : C.green, 10, 700, 'middle');
    out += _t(rx + 47, ry + 61, vix >= 25 ? '고변동 경계' : vix >= 18 ? '주의 구간' : '저변동 안정', C.muted, 7.5, 400, 'middle');
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
      out += _t(lx.toFixed(1), (ly + 3).toFixed(1), ax.label, C.muted, 8, 600, 'middle');
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
      out += _t(W - 37, H - 14, '랭크 ' + d.rank, rc, 8.5, 700, 'middle');
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
    out += _t(W - 14, 19, ageMin != null ? ageMin + '분 전' : '—', ageCol, 8.5, 600, 'end');
    items.forEach(function (it, i) {
      var col2 = i % 2, row = Math.floor(i / 2);
      var x = 14 + col2 * 204, y = 34 + row * 42;
      out += _r(x, y, 196, 34, 'rgba(255,255,255,0.025)', 5, it.ok ? _alphaRgb(C.green, 0.22) : _alphaRgb(C.red, 0.18), 1);
      out += _t(x + 10, y + 13, it.label, C.muted, 8.5, 600);
      out += _t(x + 10, y + 27, it.val, it.ok ? C.green : C.red, 9, 700);
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
      out += _t(lx.toFixed(1), (ly + 3).toFixed(1), stageNames[i], active ? col : C.muted, 7.5, active ? 700 : 400, 'middle');
    }
    out += _o(cx, cy, inner, _alphaRgb(C.bg, 0.8));
    out += _t(cx, cy + 4, stage, stageCols[stageMap[stage] || 0], 8.5, 900, 'middle');
    var indicators = [
      ['CPI',  _n(d.cpi || 3.0, 1) + '%',  (d.cpi || 3) > 3.5 ? C.red : (d.cpi || 3) > 2 ? C.amber : C.green],
      ['금리', _n(d.fedRate || 4.5, 2) + '%', (d.fedRate || 4.5) > 4.5 ? C.red : C.amber],
      ['실업', _n(d.unemployment || 4.0, 1) + '%', (d.unemployment || 4) > 4.5 ? C.red : C.green],
    ];
    indicators.forEach(function (row, i) {
      var ry = 30 + i * 54;
      out += _r(225, ry, 146, 46, 'rgba(255,255,255,0.03)', 5, _alphaRgb(row[2], 0.2), 1);
      out += _t(233, ry + 15, row[0], C.muted, 8, 600);
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
    var tx = function (v) { return 18 + Math.min(((v - lo) / range) * 366, 366); };
    var slY = 48;
    out += _r(18, slY, 366, 8, 'rgba(255,255,255,0.05)', 4);
    out += _r(18, slY, _cl(tx(sma200) - 18, 0, 366), 8, _alphaRgb(C.red, 0.18), 4);
    out += _r(tx(sma200), slY, _cl(tx(sma50) - tx(sma200), 0, 366), 8, _alphaRgb(C.amber, 0.22));
    out += _r(tx(sma50), slY, _cl(tx(ath) - tx(sma50), 0, 366), 8, _alphaRgb(C.green, 0.22));
    [[sma200, '200MA', C.amber], [sma50, '50MA', C.cyan], [ath, 'ATH', C.green]].forEach(function (m) {
      var mx = tx(m[0]);
      out += _l(mx, slY - 2, mx, slY + 10, m[2], 1.5);
      out += _t(mx, slY + 21, m[1], m[2], 7.5, 600, 'middle');
      out += _t(mx, slY + 31, '$' + _n(m[0]), m[2], 7, 400, 'middle');
    });
    var prx = tx(price);
    out += _r(prx - 7, slY - 6, 14, 20, C.text, 3, C.text, 1.5);
    out += _t(prx, slY + 5, '$' + _n(price), C.bg, 7.5, 900, 'middle');
    out += _t(prx, slY - 10, sym, C.text, 7.5, 700, 'middle');
    var stats = [
      ['3M 수익', _n(ret3m, 1) + '%', _pctCol(ret3m)],
      ['RSI', _n(rsi, 1), rsi >= 70 ? C.red : rsi <= 30 ? C.green : C.cyan],
      ['vs 50MA', _n((price / (sma50 || 1) - 1) * 100, 1) + '%', price > sma50 ? C.green : C.red],
      ['vs ATH', _n((price / (ath || 1) - 1) * 100, 1) + '%', price >= ath * 0.97 ? C.green : price >= ath * 0.9 ? C.amber : C.red],
    ];
    stats.forEach(function (s, i) {
      var x = 14 + i * 100;
      out += _r(x, H - 50, 92, 40, 'rgba(255,255,255,0.025)', 4, C.border, 1);
      out += _t(x + 6, H - 34, s[0], C.muted, 8);
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
      out += _t((x + r).toFixed(0), (cy2 - 4).toFixed(0), s.name || '?', C.text, 7.5, 700, 'middle');
      out += _t((x + r).toFixed(0), (cy2 + 8).toFixed(0), Math.round(s.weight || 0) + '%', col, 8, 700, 'middle');
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
      out += _t(cX - 4, (+y + 3).toFixed(0), (minR + t * (maxR - minR)).toFixed(1) + '%', C.muted, 7.5, 400, 'end');
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
      out += _t(p.x, (+p.y - 7).toFixed(0), p.term, C.muted, 7.5, 600, 'middle');
      out += _t(p.x, (+p.y + 14).toFixed(0), p.rate.toFixed(2), C.cyan, 7.5, 700, 'middle');
    });
    var inverted = d.twoY && d.tnx && d.twoY > d.tnx;
    var shape = inverted ? '역전 Inverted' : '정상 Normal';
    var shapeCol = inverted ? C.red : C.green;
    out += _r(W - 104, H - 24, 96, 18, _alphaRgb(shapeCol, 0.12), 4, shapeCol, 1);
    out += _t(W - 56, H - 11, shape, shapeCol, 8, 700, 'middle');
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
      out += _t(14, y + 13, g.label, C.muted, 8.5, 600);
      out += _r(120, y + 2, 224, 10, 'rgba(255,255,255,0.05)', 3);
      out += _r(120, y + 2, Math.round(224 * 0.40), 10, _alphaRgb(C.green, 0.28), 3);
      out += _r(120 + Math.round(224 * 0.40), y + 2, Math.round(224 * 0.33), 10, _alphaRgb(C.amber, 0.28));
      out += _r(120 + Math.round(224 * 0.73), y + 2, Math.round(224 * 0.27), 10, _alphaRgb(C.red, 0.28));
      var nx = 120 + Math.round(224 * _cl(norm, 0, 1));
      out += _r(nx - 1, y - 1, 3, 14, col, 1);
      out += _t(350, y + 13, _n(g.v, g.unit === '%' ? 1 : 1) + g.unit, col, 9, 700);
      out += _t(120, y + 25, g.lo, C.muted, 7.5);
      out += _t(344, y + 25, g.hi, C.muted, 7.5, 400, 'end');
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
    out += _t(W - 14, 18, 'n=' + n, C.muted, 8.5, 400, 'end');
    factors.forEach(function (f, i) {
      var v = ic[f.key] || 0;
      var y = 28 + i * 36;
      var col = v > 0.05 ? C.green : v > 0 ? C.cyan : v > -0.05 ? C.amber : C.red;
      var barW = Math.round(Math.abs(v) * 700);
      var midX = 182;
      out += _t(14, y + 13, f.label, C.muted, 8.5, 600);
      out += _r(70, y + 3, 224, 12, 'rgba(255,255,255,0.04)', 2);
      out += _l(midX, y, midX, y + 18, 'rgba(255,255,255,0.14)');
      if (v >= 0) {
        out += _r(midX, y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      } else {
        out += _r(Math.max(midX - Math.min(barW, 112), 70), y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      }
      out += _t(300, y + 13, 'IC ' + _n(v, 3), col, 8.5, 700);
    });
    out += _r(14, H - 46, 180, 36, 'rgba(255,255,255,0.025)', 4, C.border, 1);
    out += _t(20, H - 29, '분위 스프레드', C.muted, 8);
    out += _t(20, H - 13, _n(spread, 2) + '%', spread > 2 ? C.green : spread > 0 ? C.amber : C.red, 12, 700);
    out += _r(204, H - 46, 180, 36, 'rgba(255,255,255,0.025)', 4, C.border, 1);
    out += _t(210, H - 29, '방향 적중률', C.muted, 8);
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
    return {
      fg:       _cl(window._lastFG != null ? window._lastFG : (snap.fearGreed || 50), 0, 100),
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
    var fg = window._lastFG != null ? window._lastFG : (snap.fearGreed != null ? snap.fearGreed : null);
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
    return { sym: 'SPY', price: price, sma50: sma50, sma200: sma200, ath: ath, ret3m: snap.spy3m || 0, rsi: snap.spyRsi || 50 };
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

  function _render(elId, type, data) {
    var el = document.getElementById(elId);
    if (el && window._aioDiagram) window._aioDiagram.render(type, el, data);
  }

  function _aioRenderPageDiagram(pid) {
    try {
      switch (pid) {
        case 'home':
          _render('vis-home-score',  'score-breakdown', _buildScore());
          _render('vis-home-regime', 'market-regime',   _buildRegime());
          break;
        case 'signal':
          _render('vis-signal-score', 'score-breakdown', _buildScore());
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
      }
    } catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ui', 'vis-phase2 render err:' + pid + ' ' + (e && e.message));
    }
  }

  var VIS_PAGES = ['home','signal','breadth','sentiment','briefing','technical','macro','fxbond','screener'];

  // 페이지 전환 훅
  if (window._aioPageBus) {
    _aioPageBus.register('vis-phase2', 'aio:pageShown', function (e) {
      var pid = e && e.detail;
      if (pid && VIS_PAGES.indexOf(pid) !== -1) _aioRenderPageDiagram(pid);
    });
  }

  // 시장 상태 갱신 시 현재 페이지 재렌더
  document.addEventListener('aio:marketStateUpdated', function () {
    try {
      var active = document.querySelector('[id^="page-"].page-active') || document.querySelector('.page[id^="page-"]');
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
