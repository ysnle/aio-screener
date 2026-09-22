// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-pages.js — P1133/R620: index.html 인라인 블록 D(3,748줄)에서 추출한 페이지 렌더러.
// 신호 대시보드(실행 창·점수 게이지·도넛·리스크 모니터), FX/채권 페이지, 크로스에셋 매트릭스,
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

// ── Execution Window Score ────────────────────────────────────────
function getExecutionWindowScore() {
  const now = new Date();
  // Convert to ET: 자동으로 EDT(UTC-4)/EST(UTC-5) 구분
  // DST: 3월 두 번째 일요일 ~ 11월 첫 번째 일요일
  function isEDT(d) {
    const y = d.getUTCFullYear();
    // 3월 두 번째 일요일 (EDT 시작)
    const marchSecondSun = new Date(Date.UTC(y, 2, 8));
    marchSecondSun.setUTCDate(8 + (7 - marchSecondSun.getUTCDay()) % 7);
    marchSecondSun.setUTCHours(7, 0, 0, 0); // 02:00 EST = 07:00 UTC
    // 11월 첫 번째 일요일 (EST 복귀)
    const novFirstSun = new Date(Date.UTC(y, 10, 1));
    novFirstSun.setUTCDate(1 + (7 - novFirstSun.getUTCDay()) % 7);
    novFirstSun.setUTCHours(6, 0, 0, 0); // 02:00 EDT = 06:00 UTC
    return d >= marchSecondSun && d < novFirstSun;
  }
  const etOffset = isEDT(now) ? -4 * 60 : -5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + etOffset * 60000);
  const h = et.getHours(), m = et.getMinutes();
  const hm = h * 60 + m;
  const day = et.getDay(); // 0=Sun, 6=Sat

  if (day === 0 || day === 6) return { score: 10, label: '주말 — 시장 휴장', color: 'var(--text-muted)' };

  // Pre-market: 4am-9:30am ET
  if (hm < 9*60+30) return { score: 40, label: '프리마켓 — 유동성 낮음', color: 'var(--data-amber)' };
  // Open: 9:30-10:00 — high vol
  if (hm < 10*60) return { score: 88, label: '개장 직후 — 최고 유동성 · 변동성↑', color: 'var(--data-green)' };
  // Morning: 10:00-11:30
  if (hm < 11*60+30) return { score: 80, label: '오전 주요 시간 — 좋음', color: 'var(--data-green)' };
  // Midday slump: 11:30-14:00
  if (hm < 14*60) return { score: 52, label: '정오 슬럼프 — 유동성 감소', color: 'var(--data-amber)' };
  // Afternoon: 14:00-15:30
  if (hm < 15*60+30) return { score: 75, label: '오후 회복 — 양호', color: 'var(--data-green)' };
  // Power Hour: 15:30-16:00
  if (hm < 16*60) return { score: 90, label: '파워아워 — 최고 거래량 · 방향성↑', color: 'var(--data-green)' };
  // After-hours
  return { score: 35, label: '장 마감 · 애프터마켓 — 제한적', color: 'var(--text-muted)' };
}


// ── Draw Score Gauge (Canvas) ─────────────────────────────────────
function drawScoreGauge(canvasId, score, colorHex) {
  var c = document.getElementById(canvasId);
  if (!c) return;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 6;
  var startAngle = -Math.PI * 0.8;
  var fullArc    = Math.PI * 1.6;
  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + fullArc);
  ctx.strokeStyle = 'rgba(33,29,22,0.08)';  // v48.54 fix: canvas ctx는 CSS var 미해석 (Phase H sed 치환 revert)
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Score arc
  var pct = Math.max(0, Math.min(1, score / 100));
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + fullArc * pct);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ── Draw Portfolio Donut ──────────────────────────────────────────
function drawPortfolioDonut() {
  var c = document.getElementById('portfolio-donut');
  if (!c) return;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.clearRect(0,0,W,H);
  var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 8, ri = r * 0.55;

  // v40.4: 실제 포지션 데이터 기반 동적 도넛 차트
  var positions = typeof getPortfolioData === 'function' ? getPortfolioData() : [];
  let ld = window._liveData || {};
  var SECTOR_COLORS = {'Technology':'#211d16','Healthcare':'#57513f','Financial Services':'#8a8271','Financials':'#8a8271','Consumer Cyclical':'#6f695e','Consumer':'#6f695e','Energy':'#a29a89','Industrials':'#3d3830','Consumer Defensive':'#57513f','Communication Services':'#3d3830','Utilities':'#8a8271','Real Estate':'#6f695e','Basic Materials':'#211d16','CASH':'var(--text-muted)'};
  var TICKER_COLORS = ['#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16'];

  var data = [];
  var totalVal = 0;
  var legendEl = document.getElementById('pf-donut-legend');

  if (positions.length === 0) {
    // 포지션 없으면 안내 메시지
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#8a8271';
    ctx.textAlign = 'center';
    ctx.fillText('종목을 추가하면', cx, cy - 6);
    ctx.fillText('비중이 표시됩니다', cx, cy + 10);
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  // 포지션별 현재 가치 계산
  var items = [];
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

  // 현금 포지션 체크 (CASH 티커 or localStorage)
  var cashVal = 0;
  try { cashVal = parseFloat(localStorage.getItem('aio_portfolio_cash') || '0'); } catch(e) {}
  if (cashVal > 0) {
    items.push({ ticker: 'CASH', val: cashVal, sector: 'CASH', pct: 0 });
    totalVal += cashVal;
  }

  // 비중 계산
  items.forEach(function(it) { it.pct = totalVal > 0 ? it.val / totalVal : 0; });
  items.sort(function(a, b) { return b.pct - a.pct; });

  // 도넛 그리기
  var start = -Math.PI / 2;
  items.forEach(function(d, i) {
    if (d.pct <= 0) return;
    var end = start + Math.PI * 2 * d.pct;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = d.ticker === 'CASH' ? 'var(--text-muted)' : (TICKER_COLORS[i % TICKER_COLORS.length]);
    ctx.fill();
    // 구분선
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(start), cy + r * Math.sin(start));
    ctx.strokeStyle = '#fbf9f5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    start = end;
  });
  // Inner circle cutout
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = '#fbf9f5';
  ctx.fill();
  // Center text
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.fillStyle = '#8a8271';
  ctx.textAlign = 'center';
  ctx.fillText(items.length + '종목', cx, cy - 2);
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#8a8271'; /* v48.61: Canvas는 CSS var 미해석 — hex 직접 (R43) */
  ctx.fillText('$' + (totalVal >= 1e6 ? (totalVal/1e6).toFixed(1)+'M' : totalVal >= 1e3 ? (totalVal/1e3).toFixed(1)+'K' : totalVal.toFixed(0)), cx, cy + 12);

  // 범례 생성 (도넛 아래)
  if (legendEl) {
    var lh = '';
    items.slice(0, 8).forEach(function(d, i) {
      var col = d.ticker === 'CASH' ? 'var(--text-muted)' : TICKER_COLORS[i % TICKER_COLORS.length];
      lh += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:11px;">';
      lh += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + col + ';margin-right:4px;"></span>' + d.ticker + '</span>';
      lh += '<span style="font-family:var(--font-mono);color:' + col + ';font-weight:700;">' + (d.pct * 100).toFixed(1) + '%</span>';
      lh += '</div>';
    });
    if (items.length > 8) lh += '<div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:4px;">+' + (items.length - 8) + '개 더</div>';
    legendEl.innerHTML = lh;
  }

  // P831: sector allocation is owned by src/ui/pages/portfolio.js.
}

// v40.4: 포지션 기반 도넛 차트 (portfolio-donut과 별도)
function drawPositionDonut() {
  var c = document.getElementById('pf-position-donut');
  if (!c) return;
  if (c.closest && c.closest('#page-portfolio[data-aio-portfolio-chart-renderer="native"]')) return;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.clearRect(0,0,W,H);
  var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 6, ri = r * 0.55;
  var positions = typeof getPortfolioData === 'function' ? getPortfolioData() : [];
  let ld = window._liveData || {};
  var TICKER_COLORS = ['#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16','#57513f','#8a8271','#6f695e','#a29a89','#3d3830','#b8b0a0','#211d16'];
  var SECTOR_COLORS = {'Technology':'#211d16','Healthcare':'#57513f','Financial Services':'#8a8271','Financials':'#8a8271','Consumer Cyclical':'#6f695e','Consumer':'#6f695e','Energy':'#a29a89','Industrials':'#3d3830','Consumer Defensive':'#57513f','Communication Services':'#3d3830','Utilities':'#8a8271','Real Estate':'#6f695e','Basic Materials':'#211d16','CASH':'var(--text-muted)'};

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

  // VIX
  var vix = ld['^VIX'] ? ld['^VIX'].price : null;
  var rmVixStatus = document.getElementById('rm-vix-status');
  var rmVixBar = document.getElementById('rm-vix-bar');
  if (vix !== null) {
    var vixColor = vix < 15 ? 'var(--data-green)' : vix < 20 ? 'var(--data-cyan)' : vix < 25 ? 'var(--data-amber)' : 'var(--data-red)';
    var vixLabel = vix < 15 ? '안정 (Low)' : vix < 20 ? '주의 (Normal)' : vix < 25 ? '경계 (Elevated)' : vix < 30 ? '공포 (High)' : '극단공포 (Crisis)';
    if (rmVixStatus) { rmVixStatus.textContent = vixLabel; rmVixStatus.style.color = vixColor; rmVixStatus.style.background = vixColor.replace(')',',0.1)').replace('rgb','rgba'); }
    if (rmVixBar) { rmVixBar.style.width = Math.min(100, (vix/40)*100) + '%'; rmVixBar.style.background = vixColor; }
  }

  // VVIX
  var vvix = ld['^VVIX'] ? ld['^VVIX'].price : null;
  var rmVvixStatus = document.getElementById('rm-vvix-status');
  var rmVvixBar = document.getElementById('rm-vvix-bar');
  if (vvix !== null) {
    var vvixColor = vvix < 85 ? 'var(--data-green)' : vvix < 100 ? 'var(--data-amber)' : 'var(--data-red)';
    var vvixLabel = vvix < 85 ? 'Low' : vvix < 100 ? 'Elevated' : 'Crisis';
    if (rmVvixStatus) { rmVvixStatus.textContent = vvixLabel; rmVvixStatus.style.color = vvixColor; }
    if (rmVvixBar) { rmVvixBar.style.width = Math.min(100, (vvix/140)*100) + '%'; rmVvixBar.style.background = vvixColor; }
  }

  // P1010: retired VXX/spot term-structure inference and dead options writers.
  // Futures curves require maturity-specific futures quotes, not ETP returns.

  // DXY
  var dxy = ld['DX-Y.NYB'] ? ld['DX-Y.NYB'].price : null;
  var rmDxyStatus = document.getElementById('rm-dxy-status');
  var rmDxyBar = document.getElementById('rm-dxy-bar');
  if (dxy !== null) {
    var dxyColor = dxy < 100 ? 'var(--data-green)' : dxy < 104 ? 'var(--data-amber)' : 'var(--data-red)';
    var dxyLabel = dxy < 100 ? '달러 약세' : dxy < 104 ? '보통' : dxy < 108 ? '강달러 경고' : '강달러 위험';
    if (rmDxyStatus) { rmDxyStatus.textContent = dxyLabel; rmDxyStatus.style.color = dxyColor; }
    if (rmDxyBar) { rmDxyBar.style.width = Math.min(100, ((dxy-90)/30)*100) + '%'; rmDxyBar.style.background = dxyColor; }
  }

  // HY 신용스프레드 — P576/P713 계열 4번째 표면(2026-07-18): HYG 달러 가격 대신 FRED HY OAS(bp) 실측만 사용
  var hyOasBp = Number(window._hySpreadBp);
  var hyOasOk = isFinite(hyOasBp);
  var rmHygStatus = document.getElementById('rm-hyg-status');
  var rmHygBar = document.getElementById('rm-hyg-bar');
  if (hyOasOk) {
    var hygColor = hyOasBp < 350 ? 'var(--data-green)' : hyOasBp < 450 ? 'var(--data-amber)' : 'var(--data-red)';
    var hygLabel = hyOasBp < 350 ? '안정' : hyOasBp < 450 ? '주의' : 'HY 스트레스';
    if (rmHygStatus) { rmHygStatus.textContent = hygLabel; rmHygStatus.style.color = hygColor; }
    if (rmHygBar) { rmHygBar.style.width = Math.min(100, Math.max(0, ((650-hyOasBp)/400)*100)) + '%'; rmHygBar.style.background = hygColor; }
  } else {
    if (rmHygStatus) { rmHygStatus.textContent = '미수신'; rmHygStatus.style.color = 'var(--text-muted)'; }
    if (rmHygBar) { rmHygBar.style.width = '0%'; }
  }

  // TNX
  var tnx = ld['^TNX'] ? ld['^TNX'].price : null;
  var rmTnxStatus = document.getElementById('rm-tnx-status');
  var rmTnxBar = document.getElementById('rm-tnx-bar');
  if (tnx !== null) {
    var tnxColor = tnx < 4.0 ? 'var(--data-green)' : tnx < 4.5 ? 'var(--data-amber)' : 'var(--data-red)';
    var tnxLabel = tnx < 4.0 ? '낮음' : tnx < 4.5 ? '주의' : '밸류에이션 압박';
    if (rmTnxStatus) { rmTnxStatus.textContent = tnxLabel; rmTnxStatus.style.color = tnxColor; }
    if (rmTnxBar) { rmTnxBar.style.width = Math.min(100, (tnx/6)*100) + '%'; rmTnxBar.style.background = tnxColor; }
  }

  // Fear & Greed
  var _fgRiskMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  var fg = _fgRiskMetric && _fgRiskMetric.value != null ? _fgRiskMetric.value : null;
  var rmFgVal = document.getElementById('rm-fg-val');
  var rmFgStatus = document.getElementById('rm-fg-status');
  var rmFgBar = document.getElementById('rm-fg-bar');
  if (fg !== null) {
    var fgColor = fg <= 25 ? 'var(--data-red)' : fg <= 45 ? 'var(--data-amber)' : fg <= 55 ? 'var(--data-cyan)' : fg <= 75 ? '#22754c' : 'var(--data-green)';
    var fgLabel = fg <= 25 ? '극단적 공포' : fg <= 45 ? '공포' : fg <= 55 ? '중립' : fg <= 75 ? '탐욕' : '극단적 탐욕';
    if (rmFgVal) { rmFgVal.textContent = fg; rmFgVal.style.color = fgColor; }
    if (rmFgStatus) { rmFgStatus.textContent = fgLabel; rmFgStatus.style.color = fgColor; }
    if (rmFgBar) { rmFgBar.style.width = fg + '%'; rmFgBar.style.background = fgColor; }
  }

  // RSP/SPY Ratio
  var rsp = ld['RSP'] ? ld['RSP'].price : null;
  var spy = ld['SPY'] ? ld['SPY'].price : null;
  var rmRspStatus = document.getElementById('rm-rspratio-status');
  var rmRspVal = document.getElementById('rm-rspratio-val');
  var rmRspBar = document.getElementById('rm-rspratio-bar');
  var bbRspVal = document.getElementById('bb-rsp-val');
  var bbRspBadge = document.getElementById('bb-rsp-badge');
  var bbRspBar = document.getElementById('bb-rsp-bar');
  if (rsp && spy) {
    var ratio = rsp / spy;
    var ratioStr = ratio.toFixed(4);
    // 단순 가격비율은 기준시점 정규화가 없으면 시장폭·집중도를 뜻하지 않는다.
    var rspColor = 'var(--text-secondary)';
    var rspLabel = '가격비율 참고 · 정규화된 상대강도 아님';
    if (rmRspVal) { rmRspVal.textContent = ratioStr; rmRspVal.style.color = rspColor; }
    if (rmRspStatus) { rmRspStatus.textContent = rspLabel; rmRspStatus.style.color = rspColor; }
    if (rmRspBar) { rmRspBar.style.width = Math.min(100, ratio * 300) + '%'; rmRspBar.style.background = rspColor; }
    if (bbRspVal) { bbRspVal.textContent = ratioStr; bbRspVal.style.color = rspColor; }
    if (bbRspBadge) { bbRspBadge.textContent = rspLabel; bbRspBadge.style.color = rspColor; }
    if (bbRspBar) { bbRspBar.style.width = Math.min(100, ratio * 300) + '%'; bbRspBar.style.background = rspColor; }
  } else if (rmRspStatus && typeof window._aioRenderValueSlot === 'function' && rmRspStatus.getAttribute('data-value-state') !== 'pending') {
    // v52.41 (P656/EF-11): RSP/SPY 라이브 미수신 시 정적 "수신 대기" 시드가 무기한 잔존하던 것을 정직화.
    window._aioRenderValueSlot(rmRspStatus, 'pending', null, { text: '수신 대기', reason: 'RSP 또는 SPY 라이브 시세 미수신' });
  }

  // P1010: individual risk observations remain; the unvalidated composite and
  // its VIX substitution for absent HY/10Y observations are retired.

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
  var tnx2y = ld['^IRX'] ? ld['^IRX'].price : null;
  var skew = ld['^SKEW'] ? ld['^SKEW'].price : null;
  var kospi = ld['^KS11'] ? ld['^KS11'].price : null;
  var kospiPct = ld['^KS11'] ? ld['^KS11'].pct : null;
  var kosdaq = ld['^KQ11'] ? ld['^KQ11'].price : null;
  var kosdaqPct = ld['^KQ11'] ? ld['^KQ11'].pct : null;
  var krw = ld['KRW=X'] ? ld['KRW=X'].price : null;
  var dxy = ld['DX-Y.NYB'] ? ld['DX-Y.NYB'].price : null;
  if (tnx != null) document.querySelectorAll('[data-snap="tnx"]').forEach(function(el){ el.textContent = tnx.toFixed(2) + '%'; });
  if (tnx2y != null) document.querySelectorAll('[data-snap="tnx-2y"]').forEach(function(el){ el.textContent = tnx2y.toFixed(2) + '%'; });
  if (skew != null) document.querySelectorAll('[data-snap="skew"]').forEach(function(el){ el.textContent = skew.toFixed(1); });
  if (kospi != null) document.querySelectorAll('[data-snap="kospi"]').forEach(function(el){ el.textContent = kospi.toLocaleString('en-US', {maximumFractionDigits:2}); });
  if (kospiPct != null) document.querySelectorAll('[data-snap="kospi-pct"]').forEach(function(el){ el.textContent = (kospiPct >= 0 ? '+' : '') + kospiPct.toFixed(2) + '%'; });
  if (kosdaq != null) document.querySelectorAll('[data-snap="kosdaq"]').forEach(function(el){ el.textContent = kosdaq.toLocaleString('en-US', {maximumFractionDigits:2}); });
  if (kosdaqPct != null) document.querySelectorAll('[data-snap="kosdaq-pct"]').forEach(function(el){ el.textContent = (kosdaqPct >= 0 ? '+' : '') + kosdaqPct.toFixed(2) + '%'; });
  if (krw != null) document.querySelectorAll('[data-snap="krw"]').forEach(function(el){ el.textContent = krw.toLocaleString('en-US', {maximumFractionDigits:0}); });
  if (krw != null) document.querySelectorAll('[data-snap="krw-full"]').forEach(function(el){ el.textContent = krw.toFixed(2); });
  if (dxy != null) document.querySelectorAll('[data-snap="dxy"]').forEach(function(el){ el.textContent = dxy.toFixed(2); });

  // 내러티브 stale 일수 자동 계산 (data-snap-date + sibling [id$="-stale-days"])
  // v50.51 A1: aio-core 핸들러와 동일한 단일 포맷터(_aioStaleDaysLabel) 경유 — 두 writer가
  //   같은 #KEY-stale-days span에 다른 포맷/기준일로 경쟁 기재하던 문제 해소.
  try {
    document.querySelectorAll('[data-snap-date]').forEach(function(sd) {
      var dateStr = sd.textContent || sd.getAttribute('data-snap-date-value');
      var key = sd.getAttribute('data-snap-date');
      if (!dateStr || !key) return;
      var target = document.getElementById(key + '-stale-days');
      if (!target) return;
      var lbl = (typeof window._aioStaleDaysLabel === 'function') ? window._aioStaleDaysLabel(dateStr) : null;
      if (!lbl || lbl.days == null) return;
      target.textContent = lbl.text;
      target.style.color = lbl.color;
    });
  } catch(_e){}
}

// ── Update Sector Heatmap Colors ──────────────────────────────────
// v48.50: #sector-heatmap + #themes-sector-mirror 동시 업데이트
function updateSectorHeatmap() {
  document.querySelectorAll('#sector-heatmap .sec-tile, #themes-sector-mirror .sec-tile').forEach(function(tile) {
    var sym = tile.dataset.sym;
    var chgEl = tile.querySelector('.sec-chg');
    if (!chgEl) return;
    var txt = chgEl.textContent;
    var num = parseFloat(txt);
    if (isNaN(num)) return;
    var intensity = Math.min(Math.abs(num) / 3, 1);
    if (num >= 0) {
      tile.style.background = 'rgba(34,117,76,' + (0.05 + intensity * 0.25) + ')';
      tile.style.borderColor = 'rgba(34,117,76,' + (0.15 + intensity * 0.25) + ')';
      chgEl.style.color = 'var(--data-green)';
    } else {
      tile.style.background = 'rgba(177,58,48,' + (0.05 + intensity * 0.25) + ')';
      tile.style.borderColor = 'rgba(177,58,48,' + (0.15 + intensity * 0.25) + ')';
      chgEl.style.color = 'var(--data-red)';
    }
  });
}

// ── Render Score Bars ──────────────────────────────────────────────
function renderScoreBars(scores) {
  var container = document.getElementById('score-bars-container');
  if (!container) return;
  var components = [
    { key: 'volScore',    label: '변동성',    weight: 25, score: scores.volScore,     page: 'sentiment' },
    { key: 'momScore',    label: '모멘텀',    weight: 25, score: scores.momScore,     page: 'technical' },
    { key: 'trendScore',  label: '추세',      weight: 20, score: scores.trendScore,   page: 'technical' },
    { key: 'breadthScore',label: '시장폭',    weight: 20, score: scores.breadthScore, page: 'breadth' },
    { key: 'macroScore',  label: '매크로',    weight: 10, score: scores.macroScore,   page: 'macro' },
  ];
  container.innerHTML = components.map(function(c) {
    if (c.score == null || !isFinite(Number(c.score))) {
      return '<div class="score-bar-row">' +
        '<div class="sb-label cross-link" data-action="showPage" data-arg="' + escHtml(c.page) + '" title="' + c.label + ' 상세 분석 →">' + c.label + ' →</div>' +
        '<div class="sb-wrap"><div class="sb-fill" style="width:0%;background:var(--border);"></div></div>' +
        '<div class="sb-val" style="color:var(--text-muted);">—</div>' +
        '<div class="sb-wt">' + c.weight + '%</div></div>';
    }
    var color = c.score >= 70 ? 'var(--data-green)' : c.score >= 50 ? 'var(--data-cyan)' : c.score >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
    return '<div class="score-bar-row">' +
      '<div class="sb-label cross-link" data-action="showPage" data-arg="' + escHtml(c.page) + '" title="' + c.label + ' 상세 분석 →">' + c.label + ' →</div>' +
      '<div class="sb-wrap"><div class="sb-fill" style="width:' + c.score + '%;background:' + color + ';"></div></div>' +
      '<div class="sb-val" style="color:' + color + ';">' + c.score + '</div>' +
      '<div class="sb-wt">' + c.weight + '%</div>' +
    '</div>';
  }).join('');
}

// ── Main: Init Signal Dashboard ───────────────────────────────────
// ── 미너비니 4단계 바닥 프로세스 동적 판별 (v38.9) ──
function updateBottomProcess() {
  let ld = window._liveData || {};
  var vix = ld['^VIX'] ? ld['^VIX'].price : null;
  var spx = ld['^GSPC'] ? ld['^GSPC'].price : (ld['SPY'] ? ld['SPY'].price : null);
  var _fgBottomMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  var fg = _fgBottomMetric && _fgBottomMetric.value != null ? _fgBottomMetric.value : null;
  var score = 0;
  try { score = computeTradingScore('swing').total; } catch(e) {}

  // 시장폭 데이터 (전역 캐시에서 읽기)
  var b5 = (typeof window._breadth5 === 'number') ? window._breadth5 : null;
  var b50 = (typeof window._breadth50 === 'number') ? window._breadth50 : null;

  // 200SMA 관계
  var spx200 = null;
  var sma200El = document.querySelector('[data-field="spx200sma"]');
  if (sma200El) spx200 = parseFloat(sma200El.textContent.replace(/,/g,''));
  if (!spx200) {
    var rawSma = ld['^GSPC'] ? ld['^GSPC'].sma200 : null;
    if (rawSma) spx200 = rawSma;
  }

  var stageEl = document.getElementById('bottom-process-stage');
  var s1 = document.getElementById('bp-step1');
  var s2 = document.getElementById('bp-step2');
  var s3 = document.getElementById('bp-step3');
  var s4 = document.getElementById('bp-step4');
  var c1 = document.getElementById('bp-step1-check');
  var c2 = document.getElementById('bp-step2-check');
  var c3 = document.getElementById('bp-step3-check');
  var c4 = document.getElementById('bp-step4-check');
  var actionEl = document.getElementById('bp-action-guide');

  if (!stageEl) return;

  // 판별 로직 — v46.9: b5/b50 null 안전 처리 (P91)
  var isOversold = (vix && vix > 25) || (fg != null && fg < 30) || (score < 35) || (b5 != null && b5 < 25) || (b5 == null && score < 50);
  var isRallying = score >= 35 && score < 60 && (b5 != null ? b5 > 30 : true);
  var isHealthyRally = b5 != null && b5 > 50 && (b50 != null ? b50 > 40 : true);
  var isBreadthThrust = b5 != null && b5 > 70 && (b50 != null ? b50 > 60 : true) && score >= 60;
  var belowSma200 = spx && spx200 && spx < spx200;

  var stage = 0;
  var stageLabel = '', stageColor = '', stageBg = '';

  if (isBreadthThrust) {
    stage = 4;
    stageLabel = '4단계: 브레드쓰 스러스트 (Breadth Thrust)';
    stageColor = 'var(--data-green)'; stageBg = 'rgba(34,117,76,0.15)';
  } else if (isHealthyRally) {
    stage = 3;
    stageLabel = '3단계: 리테스트 관찰';
    stageColor = 'var(--data-cyan)'; stageBg = 'rgba(33,29,22,0.15)';
  } else if (isRallying) {
    stage = 2;
    stageLabel = '2단계: 랠리 품질 관찰';
    stageColor = 'var(--data-amber)'; stageBg = 'rgba(33,29,22,0.15)';
  } else if (isOversold) {
    stage = 1;
    stageLabel = '1단계: 과매도';
    stageColor = 'var(--data-red)'; stageBg = 'rgba(177,58,48,0.15)';
  } else {
    stage = 0;
    stageLabel = '정상 환경';
    stageColor = 'var(--data-green)'; stageBg = 'rgba(34,117,76,0.15)';
  }

  stageEl.textContent = stageLabel;
  stageEl.style.color = stageColor;
  stageEl.style.background = stageBg;

  // 각 단계 카드 강조
  var activeStyle = function(el, active) {
    if (!el) return;
    el.style.opacity = active ? '1' : '0.5';
    el.style.transform = active ? 'scale(1.02)' : 'scale(1)';
  };
  activeStyle(s1, stage === 1);
  activeStyle(s2, stage === 2);
  activeStyle(s3, stage === 3);
  activeStyle(s4, stage === 4);

  // 체크 사항 표시
  if (c1) c1.innerHTML = (vix ? '• VIX: ' + vix.toFixed(1) + (vix > 25 ? ' ' : ' ') : '') +
    (fg ? ' • F&G: ' + fg + (fg < 30 ? ' ' : ' ') : '') +
    (b5 ? ' • 5SMA: ' + b5.toFixed(0) + '%' + (b5 < 25 ? ' ' : ' ') : '');
  if (c2) c2.innerHTML = (b5 ? '• 5SMA 위: ' + b5.toFixed(0) + '%' + (b5 > 50 ? ' (광범위)' : b5 > 30 ? ' (제한적)' : ' (숏커버링 의심)') : '—') +
    (belowSma200 ? '<br>• SPX < 200SMA → 반추세(countertrend) 행동' : '');
  if (c3) c3.innerHTML = b50 ? '• 50SMA 위: ' + b50.toFixed(0) + '%' + (b50 > 40 ? ' (매도 압력 감소)' : ' (매도 지속)') : '—';
  if (c4) c4.innerHTML = isBreadthThrust ? '시장폭 확인 — 광범위 참여' : '⏳ 대기 중';

  // 행동 가이드 동적 업데이트
  if (actionEl) {
    if (stage <= 1) {
      actionEl.innerHTML = ' <b>현재 행동:</b> 신규 매수 중단. 최고의 상대강도(RS)와 타이트한 가격 움직임 종목을 워치리스트에 추가. 이들이 전환 시 미래 리더. 트레이딩은 점진적으로만.';
      actionEl.style.borderColor = 'var(--data-red)';
    } else if (stage === 2) {
      actionEl.innerHTML = ' <b>현재 행동:</b> 랠리 품질 관찰 중. Follow-through 확인 전까지 관망. 리더십 종목이 적절한 셋업(VCP, 돌파)을 형성하는지 모니터링. 소량 테스트 매수만.';
      actionEl.style.borderColor = 'var(--data-amber)';
    } else if (stage === 3) {
      actionEl.innerHTML = ' <b>현재 관측:</b> 리테스트 진행 구간. 프레임워크상 매도 압력 감소 여부와 리더주 셋업 완성 여부가 다음 관찰 포인트입니다(지시 아님).';
      actionEl.style.borderColor = 'var(--data-cyan)';
    } else {
      actionEl.innerHTML = ' <b>현재 행동:</b> 바닥 확인. 리더주 셋업 완성 시 분할 진입 검토. 트레일링 스탑으로 수익 보호. 시장폭 유지 여부 지속 모니터링.';
      actionEl.style.borderColor = 'var(--data-green)';
    }
  }
}

// ── Exit Triggers 동적 수치 업데이트 (v38.8) ──
function updateExitTriggers() {
  var spx = _ldSafe('^GSPC','price') || _ldSafe('SPY','price');
  var dxy = _ldSafe('DX-Y.NYB','price') || _ldSafe('UUP','price');
  var hyg = _ldSafe('HYG','price');
  var elSpx = document.getElementById('exit-spx-level');
  var elDxy = document.getElementById('exit-dxy-level');
  var elHyg = document.getElementById('exit-hyg-level');
  if (elSpx && spx) {
    // v50.19: 단순 -10% → 실제 기술적 손절. 200일선(주요 추세 지지)이 현재가 아래면 그 레벨, 이미 하회/미가용 시 50일선→-10% 폴백
    var _fbX = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) || {};
    var spx200 = (window._spxMA && window._spxMA[200]) || _fbX.spx200ma || null;
    var spx50  = (window._spxMA && window._spxMA[50])  || _fbX.spx50ma  || null;
    var spxTrigger, spxBasis;
    if (spx200 && spx200 < spx * 0.995) { spxTrigger = Math.round(spx200 / 10) * 10; spxBasis = '200일선(추세 지지)'; }
    else if (spx50 && spx50 < spx * 0.995) { spxTrigger = Math.round(spx50 / 10) * 10; spxBasis = '50일선(중기 지지)'; }
    else { spxTrigger = Math.round(spx * 0.9 / 50) * 50; spxBasis = '-10%(이평선 폴백)'; }
    elSpx.textContent = spxTrigger.toLocaleString();
    var elSpxBasis = document.getElementById('exit-spx-basis');
    if (elSpxBasis) elSpxBasis.textContent = spxBasis;
  }
  if (elDxy && dxy) {
    var dxyTrigger = (Math.ceil((dxy * 1.05) * 10) / 10).toFixed(1); // +5%, 소수점 1자리
    elDxy.textContent = dxyTrigger;
  }
  if (elHyg && hyg) {
    var hygTrigger = (Math.floor((hyg * 0.95) * 100) / 100).toFixed(2); // -5%
    elHyg.textContent = '$' + hygTrigger;
  }
}

var _signalMode = 'swing';
var _signalInterval = null;

// ── 진입 체크리스트 실시간 업데이트 (Jeff Sun Hard Rules) ──
function updateEntryChecklist() {
  let ld = window._liveData || {};
  var vixD = ld['^VIX'];
  var spyD = ld['SPY'];
  var health = typeof computeMarketHealth === 'function' ? computeMarketHealth() : null;
  var passed = 0, total = 5;

  // 섹터 ETF 상승 비율
  var sectorETFs = ['XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC'];
  var upCount = 0, totalSectors = 0;
  sectorETFs.forEach(function(s) { var d = ld[s]; if (d && d.pct != null) { totalSectors++; if (d.pct >= 0) upCount++; } });
  var breadthPct = totalSectors > 0 ? Math.round(upCount / totalSectors * 100) : 0;

  function setCheck(id, ok, val) {
    var el = document.getElementById(id);
    if (!el) return;
    var icon = el.querySelector('.ec-icon');
    var valEl = el.querySelector('.ec-val');
    if (icon) {
      icon.textContent = ok ? '통과' : (ok === null ? '대기' : '미충족');
      icon.style.color = ok ? 'var(--data-green)' : (ok === null ? 'var(--text-muted)' : 'var(--data-red)');
    }
    if (valEl) valEl.textContent = val;
    // v52.65 아이보리 2a: 셀 좌측 컬러 스트라이프 제거(원칙 §3) — 통과/미충족은 텍스트 색만으로 표시
    if (ok) passed++;
  }

  // 1. VIX < 25
  if (vixD && vixD.price != null) {
    setCheck('ec-vix', vixD.price < 25, vixD.price.toFixed(1));
  }

  // 2. 시장 스코어 55+ — P715: fail-closed로 score가 null일 수 있음(서버 시세 백스톱 제거 후
  // 오프라인/미수신 부팅에서 "null점" 노출 실증). 유한값일 때만 표기, 아니면 명시적 미수신.
  if (health && typeof health.score === 'number' && isFinite(health.score)) {
    setCheck('ec-score', health.score >= 55, health.score + '점');
  } else if (health) {
    setCheck('ec-score', null, '미수신');
  }

  // 3. 섹터 폭 50%+
  if (totalSectors > 0) {
    setCheck('ec-breadth', breadthPct >= 50, upCount + '/' + totalSectors + ' (' + breadthPct + '%)');
  }

  // 4. 연속 상승 경고 (SPY 당일 변동으로 간이 판단)
  if (spyD && spyD.pct != null) {
    var streak = spyD.pct >= 0;
    setCheck('ec-streak', !streak || spyD.pct < 1.5, spyD.pct >= 0 ? '+' + spyD.pct.toFixed(1) + '%' : spyD.pct.toFixed(1) + '%');
  }

  // 5. FOMC/CPI 48시간 이내 — v46.9: 동적 FOMC + 미래 이벤트만 (P89)
  // P1164/B01: 일정 원천이 없거나 형식을 해석할 수 없는 상태를 '이벤트 없음' 통과로 바꾸지 않는다.
  // 수집된 일정에서 48h 안에 이벤트가 없을 때만 통과이고, 원천 부재·형식 불명은 대기(미수신)다.
  var eventSnap = window.DATA_SNAPSHOT || {};
  var eventDates = [];
  var eventFieldsPresent = 0;
  var eventFieldsParsed = 0;
  var _collectEventField = function(raw, rangeForm) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return;
    eventFieldsPresent++;
    var range = rangeForm ? s.match(/^(\d{4}-\d{2}-)(\d{2})~(\d{2})$/) : null;
    if (range) { eventDates.push(range[1] + range[2], range[1] + range[3]); eventFieldsParsed++; return; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { eventDates.push(s); eventFieldsParsed++; }
  };
  _collectEventField(eventSnap.fomcNext, true);
  _collectEventField(eventSnap.cpiNext, false);
  _collectEventField(eventSnap.bokNext, false);
  if (eventFieldsParsed === 0) {
    setCheck('ec-event', null, eventFieldsPresent > 0 ? '일정 형식 확인 불가' : '경제 일정 미수신');
  } else {
    var now = new Date();
    var nearEvent = false;
    eventDates.forEach(function(ds) {
      var d = new Date(ds + 'T00:00:00');
      var diff = (d - now) / (1000 * 60 * 60);
      if (diff > -24 && diff < 48) nearEvent = true;
    });
    setCheck('ec-event', !nearEvent, nearEvent ? '48h 이내 이벤트' : '48h 이내 일정 없음');
  }

  // 요약
  var sumEl = document.getElementById('entry-check-summary');
  if (sumEl) {
    var color = passed >= 4 ? 'var(--data-green)' : passed >= 3 ? 'var(--data-amber)' : 'var(--data-red)';
    // P720: 시스템 발화형 판정("진입 검토 가능/자제")을 관측형(조건 충족도)으로 전환 — P714 정합.
    var label = passed >= 4 ? '조건 대부분 충족' : passed >= 3 ? '조건 일부 충족' : '조건 미충족 다수';
    sumEl.textContent = passed + '/' + total + ' ' + label;
    sumEl.style.color = color;
  }
}

// aio:liveQuotes 이벤트에서 체크리스트 + 브레드쓰 바 업데이트
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-signal-checklist-live', 'aio:liveQuotes', function() {
  if (document.getElementById('page-signal') && document.getElementById('page-signal').classList.contains('active')) {
    updateEntryChecklist();
    // v42.7: signal 페이지의 시장 폭 바(bb-5sma-bar 등) 갱신 — breadth 페이지 미방문 시에도 최신값 표시
    if (typeof updateBreadthBars === 'function') try { updateBreadthBars(); } catch(e) {}
  }
});
});

function initSignalDashboard() {
  // Draw portfolio donut once
  drawPortfolioDonut();
  // 진입 체크리스트 초기 업데이트
  setTimeout(updateEntryChecklist, 500);

  // Init ticker bar duplication for seamless loop
  var track = document.getElementById('sig-ticker-track');
  if (track && !track.dataset.duped) {
    track.innerHTML += track.innerHTML;
    track.dataset.duped = '1';
  }

  refreshSignalDashboard();
  updateExitTriggers();
  updateBottomProcess();
  // v48.91: 타이머 레지스트리 등록
  _signalInterval = _aioRegisterTimer('signalDashboard', refreshSignalDashboard, T.SIGNAL_REFRESH);
  // v46.9: signal 페이지 재진입 시 refreshSignal 즉시 1회 호출 (P83)
  // v48.27 (P7): _refreshSignalInterval 이중 등록 race 방지 — 앱 초기화(23748)에서 등록한 단일 interval 유지
  refreshSignal();

  // Init chat
  if (window.CHAT_DEFAULT_CHIPS) {
    chatRenderChips('signal', window.CHAT_DEFAULT_CHIPS['signal']);
  }
  // Fetch fresh quotes for signal page
  if (typeof fetchLiveQuotes === 'function') fetchLiveQuotes();
}

function _aioIsNativeSignalHero() {
  var page = document.getElementById('page-signal');
  return !!(page && page.dataset && page.dataset.aioSignalRenderer === 'native');
}
window._aioIsNativeSignalHero = _aioIsNativeSignalHero;

function refreshSignalDashboard() {
  var mode = _signalMode;
  var scores = computeTradingScore(mode);
  var total = scores.total;
  var totalFinite = typeof total === 'number' && isFinite(total);
  var displayTotal = totalFinite ? Math.round(total) : null;

  // Decision — 5-tier system
  var decision, decColor, decBg, decSub;
  if (!totalFinite || scores.partial) {
    decision = !totalFinite ? '판정 보류 — 필수 입력 미수신' : '판정 보류 — 부분 데이터 점수';
    decColor = 'var(--text-muted)'; decBg = 'transparent';
    decSub = !totalFinite ? '필수 시장 입력이 없어 점수와 실행 판단을 표시하지 않습니다.' : '미수신 구성요소(' + (scores.componentMissing || []).join(', ') + ')는 중립값으로만 계산했습니다. 현재 진입 판단에는 사용하지 않습니다.';
  } else if (total >= 75) {
    decision = '환경 우호 — 종목별 근거 별도 확인';
    decColor = '#22754c'; decBg = 'rgba(34,117,76,0.15)';
    decSub = '현재 시장 입력 조합이 우호적입니다. 점수는 예측 신호가 아니며(부분 백테스트에서는 선행수익률과 음의 상관 관측) 종목별 거래량·손익비·무효화 가격을 별도로 확인하세요.';
  } else if (total >= 60) {
    decision = '환경 양호 — 단독 진입 신호 아님';
    decColor = 'var(--data-green)'; decBg = 'rgba(34,117,76,0.15)';
    decSub = '현재 시장 여건은 양호합니다. 단, 2016~2026 부분 백테스트(입력 가중치 55%)에서 이 점수와 21·63일 선행수익률은 유의한 음(−)의 상관이 관측되어, 점수를 매수/매도 타이밍 근거로 사용하지 마세요.';
  } else if (total >= 45) {
    decision = '중립 — 관망 우선';
    decColor = 'var(--data-cyan)'; decBg = 'rgba(33,29,22,0.15)';
    decSub = '시장 신호가 혼재된 환경입니다. 점수는 예측 신호가 아니므로 진입/비중 결정은 종목별 근거와 본인 리스크 한도로 판단하세요.';
  } else if (total >= 30) {
    decision = '주의 — 비중 축소 검토';
    decColor = 'var(--data-amber)'; decBg = 'rgba(33,29,22,0.15)';
    decSub = '리스크 증가. 기존 포지션의 방어선, 현금 비중, 헤지 조건 점검.';
  } else {
    decision = '위험 — 방어 우선';
    decColor = '#b13a30'; decBg = 'rgba(177,58,48,0.15)';
    decSub = '극단 리스크. 신규 진입 중단, 현금·헤지·VIX 추적 우선.';
  }

  // Update the compatibility canvas only when the legacy hero owns the surface.
  // The native analysis renderer owns the visible score sinks; drawing its hidden
  // 110px canvas on every route/quote refresh was an avoidable first-paint cost.
  var _nativeSignalHero = _aioIsNativeSignalHero();
  if (!_nativeSignalHero) drawScoreGauge('score-gauge-canvas', totalFinite ? displayTotal : null, decColor);
  // v52.65 아이보리 2a: 히어로 스코어/판단문은 시안처럼 항상 잉크색 텍스트 — decColor는 캔버스 게이지(숨김)에만 사용
  // P786: analysis.js owns the three signal decision hero sinks. Keep this
  // function as a compatibility/secondary renderer, but never let it win a
  // native signal render through last-writer-wins ordering.
  if (!_nativeSignalHero) {
    var gv = document.querySelector('#score-gauge-val');
    if (gv) { gv.textContent = totalFinite ? displayTotal + (scores.partial ? '*' : '') : '—'; }
    var badge = document.querySelector('#score-decision-badge');
    if (badge) { badge.textContent = decision; }
    var dsub = document.querySelector('#score-decision-sub');
    if (dsub) { dsub.textContent = decSub; }
  }
  var ts = document.getElementById('score-ts');
  if (ts) ts.textContent = '갱신: ' + new Date().toLocaleTimeString('ko-KR');
  var lr = document.getElementById('sig-last-refresh');
  if (lr) lr.textContent = '⟳ ' + new Date().toLocaleTimeString('ko-KR');

  // P559/R250: force the shared decision header to re-render in lockstep with this gauge,
  // same fix as refreshHomeDashboard (P553) — otherwise the header (built by _aioDefaultDecision,
  // now reading the same 'swing' mode via AIO_PAGE_SCORE_MODE) could still momentarily lag
  // this widget's own refresh cadence.
  try { if (typeof window._aioRenderPageDecisionHeader === 'function') window._aioRenderPageDecisionHeader('signal'); } catch(_) {}

  // Render score bars
  renderScoreBars(scores);

  // v52.65 아이보리 2a: 히어로 인라인 5팩터 미니바 — "가중 기여도/만점" 표기(시안과 동일 포맷)
  var heroFactorsEl = document.getElementById('signal-hero-factors');
  if (heroFactorsEl) {
    // P1164/B01: 미수신 구성요소를 0점으로 만들지 않는다. renderScoreBars()는 같은
    // 구성요소의 null을 '—'로 표시하는데 이 미니바만 Number(null)=0으로 '0/25'를 만들었다.
    var _hfClamp = function(v) { var n = Number(v); return (v == null || !isFinite(n)) ? null : Math.max(0, Math.min(100, n)); };
    var _hfVal = function(v, weight) { var c = _hfClamp(v); return c == null ? null : Math.round(c * weight); };
    var hfComps = [
      { label: '변동성', v: _hfVal(scores.volScore, 0.25), max: 25 },
      { label: '모멘텀', v: _hfVal(scores.momScore, 0.25), max: 25 },
      { label: '추세',   v: _hfVal(scores.trendScore, 0.20), max: 20 },
      { label: '시장폭', v: _hfVal(scores.breadthScore, 0.20), max: 20 },
      { label: '거시',   v: _hfVal(scores.macroScore, 0.10), max: 10 }
    ];
    heroFactorsEl.innerHTML = hfComps.map(function(c) {
      var pct = c.v == null ? 0 : Math.round((c.v / c.max) * 100);
      return '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:12px;color:var(--text-muted);width:40px;flex-shrink:0;">' + c.label + '</span>' +
        '<div style="flex:1;height:3px;background:var(--border-subtle);border-radius:2px;min-width:60px;"><div style="width:' + pct + '%;height:100%;background:var(--text-primary);border-radius:2px;"></div></div>' +
        '<span style="font-size:12px;font-weight:600;color:' + (c.v == null ? 'var(--text-muted)' : 'var(--text-primary)') + ';font-variant-numeric:tabular-nums;width:44px;text-align:right;flex-shrink:0;">' + (c.v == null ? '—' : c.v) + '/' + c.max + '</span>' +
        '</div>';
    }).join('');
  }

  // ── Render Action Guidance (Signal Advice) — v31.2: grid 바깥 전용 컨테이너 사용
  var adviceContainer = document.getElementById('signal-advice-container');
  if (adviceContainer) {
    var adv = scores.partial ? { action:'판정 보류', text:'현재 추세·시장 폭 원천이 완전하지 않아 참고 점수만 표시합니다.', color:'var(--text-muted)' } : getScoreAdvice(total);
    adviceContainer.innerHTML = '<div style="padding:12px 16px;border-radius:4px;font-size:13px;line-height:1.5;background:' + adv.color + '15;border:1px solid ' + adv.color + '30;color:#8a8271;"><strong style="color:' + adv.color + '">[' + adv.action + ']</strong> ' + adv.text + '</div>';
  }

  // Execution window (enhanced v20+)
  var ew = getExecutionWindowScore();
  var ewScoreEl = document.getElementById('exec-window-score');
  var ewLabel = document.getElementById('exec-window-label');
  if (ewScoreEl) { ewScoreEl.textContent = ew.score; ewScoreEl.style.color = ew.color; }
  if (ewLabel) { ewLabel.textContent = ew.label; ewLabel.style.color = ew.color; }

  // v20+: Execution Window 상세 계산 (셋업 실현율)
  try { computeExecutionWindow(); } catch(e) { _aioLog('warn', 'render', 'ExecutionWindow error: ' + (e && e.message || e)); }

  // v20+: 시장 국면 분류
  try { classifyMarketRegime(); } catch(e) { _aioLog('warn', 'regime', 'MarketRegime error: ' + (e && e.message || e)); }

  // Risk monitor
  updateRiskMonitor();

  // Sector heatmap colors
  setTimeout(updateSectorHeatmap, 500);

  // v42.1: 마켓 펄스 바 업데이트
  try { updateMarketPulse(); } catch(e) {}

  // v50.77: Minervini-style 메트릭 필 + 매수 국면 레이블 업데이트
  try {
    var mvStrip = document.getElementById('signal-mv-strip');
    var phaseEl = document.getElementById('signal-phase-label');
    if (mvStrip) {
      var ld77 = window._liveData || {};
      var vixVal = (ld77['^VIX'] && ld77['^VIX'].price) ? ld77['^VIX'].price : 20;
      // v52.7 P607/R261: window._fearGreedValue phantom global 시정 — window._lastFG로 전환 (aio-core.js:23234 동일 수정)
      var _fg77m = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
      var fg77 = _fg77m && _fg77m.value != null ? _fg77m.value : null;
      var ts77 = totalFinite ? displayTotal : null;
      var vixCol77 = vixVal < 20 ? 'var(--data-green)' : vixVal < 25 ? 'var(--data-amber)' : 'var(--data-red)';
      var fgCol77 = fg77 != null ? (fg77 >= 60 ? 'var(--data-green)' : fg77 >= 40 ? 'var(--data-amber)' : 'var(--data-red)') : 'var(--text-muted)';
      var tsGrade77 = ts77 == null ? '—' : ts77 >= 75 ? 'A' : ts77 >= 60 ? 'B' : ts77 >= 45 ? 'C' : ts77 >= 30 ? 'D' : 'F';
      var m7Up77 = 0, m7Tot77 = 0;
      ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA'].forEach(function(t){ var d = ld77[t]; if(d){m7Tot77++;if(d.pct != null && d.pct > 0)m7Up77++;} });
      var m7Col77 = m7Tot77 > 0 ? (m7Up77/m7Tot77 >= 0.7 ? 'var(--data-green)' : m7Up77/m7Tot77 >= 0.4 ? 'var(--data-amber)' : 'var(--data-red)') : 'var(--text-muted)';
      var spyChg77 = (ld77['SPY'] && ld77['SPY'].pct != null) ? ld77['SPY'].pct : null;
      var spyStr77 = spyChg77 != null ? ((spyChg77 >= 0 ? '+' : '') + spyChg77.toFixed(2) + '%') : '—';
      var spyCol77 = spyChg77 != null ? (spyChg77 >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
      mvStrip.innerHTML =
        '<span class="mv-pill"><span class="mv-pill-lbl">VIX</span><span style="color:' + vixCol77 + ';">' + vixVal.toFixed(1) + '</span></span>' +
        '<span class="mv-pill"><span class="mv-pill-lbl">F&amp;G</span><span style="color:' + fgCol77 + ';">' + (fg77 != null ? fg77 : '—') + '</span></span>' +
        '<span class="mv-pill"><span class="mv-pill-lbl">SPY</span><span style="color:' + spyCol77 + ';">' + spyStr77 + '</span></span>' +
        '<span class="mv-pill-sep"></span>' +
         '<span class="mv-pill"><span class="mv-pill-lbl">SCORE</span><span style="color:' + (ts77 == null ? 'var(--text-muted)' : 'var(--data-cyan)') + ';font-weight:900;">' + (ts77 == null ? '—' : ts77) + '</span></span>' +
         '<span class="mv-pill"><span class="mv-pill-lbl">TPR</span><span class="mv-grade mv-grade-' + tsGrade77 + '">' + tsGrade77 + '</span></span>' +
        '<span class="mv-pill-sep"></span>' +
        '<span class="mv-pill"><span class="mv-pill-lbl">M7</span><span style="color:' + m7Col77 + ';">' + m7Up77 + '/' + m7Tot77 + '</span></span>';
    }
    if (phaseEl) {
      var phaseClass77, phaseText77;
       if (!totalFinite) { phaseClass77 = 'mv-phase-alert'; phaseText77 = '○ 입력 대기'; }
       else if (total >= 75) { phaseClass77 = 'mv-phase-sepa'; phaseText77 = '● 환경 우호'; }
      else if (total >= 60) { phaseClass77 = 'mv-phase-ready'; phaseText77 = '● 환경 양호'; }
      else if (total >= 45) { phaseClass77 = 'mv-phase-alert'; phaseText77 = '○ 중립'; }
      else { phaseClass77 = 'mv-phase-avoid'; phaseText77 = '주의'; }
      phaseEl.innerHTML = '<span class="mv-phase-lbl ' + phaseClass77 + '">' + phaseText77 + '</span>';
    }
  } catch(_) {}
}

// v42.1: 마켓 펄스 바 — 전 페이지 상단 시장 상태 요약
// v45.5: 데이터 미수신 시 폴백 사용 (로딩 영구 정체 방지) + 매크로 아이콘 색상 동기화
function updateMarketPulse() {
  var bar = document.getElementById('market-pulse-bar');
  if (!bar) return;

  // 1) 시그널 스코어
  try {
    var sc = computeTradingScore('swing');
    var t = (sc && typeof sc.total === 'number' && isFinite(sc.total)) ? sc.total : 50;
    var sColor = t >= 70 ? 'var(--data-green)' : t >= 50 ? 'var(--data-cyan)' : t >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
    var sLabel = t >= 75 ? '환경 우호' : t >= 60 ? '환경 양호' : t >= 45 ? '중립' : t >= 30 ? '환경 불리' : '환경 극단';
    var el1 = document.getElementById('mp-signal-score');
    var el1b = document.getElementById('mp-signal-label');
    if (el1) { el1.textContent = t; el1.style.color = sColor; }
    if (el1b) { el1b.textContent = sLabel; el1b.style.color = sColor; }
  } catch(e) {}

  // 2) 시장폭 — 50일선 위 종목 % (breadth 페이지·스코어링 정의와 정합). v50.16: 제거된 _breadth200 대신 _breadth50 우선
  try {
    var bVal = (typeof window._breadth50 === 'number') ? Math.round(window._breadth50) :
              (window._breadthLiveData && window._breadthLiveData.abv50 != null) ? Math.round(window._breadthLiveData.abv50) :
              (typeof window._breadth20 === 'number') ? Math.round(window._breadth20) :
              (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.breadth50sma != null) ? Math.round(window.DATA_SNAPSHOT.breadth50sma) : null;
    // 최후 폴백 — 11 섹터 ETF 당일 양봉 비율(일간 폭, 50SMA 폭과 다름 — 참고용)
    if (bVal === null || isNaN(bVal)) {
      try {
        var _sectETFs = ['XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC'];
        var _br = (typeof calcSectorBreadth === 'function') ? calcSectorBreadth(_sectETFs) : null;
        if (_br != null && !isNaN(_br)) bVal = _br;
      } catch(_e) {}
    }
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
      window._aioRenderValueSlot(el2, 'pending', null, { text: '수신 대기', reason: '시장폭 live/snapshot 미수신' });
      window._aioRenderValueSlot(el2b, 'pending', null, { text: '대기', reason: '시장폭 live/snapshot 미수신' });
    }
  } catch(e) {}

  // 3) 심리 (Fear & Greed) — canonical currentness selector
  try {
    var _fgPulseMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    var fv = _fgPulseMetric && _fgPulseMetric.value != null && !isNaN(_fgPulseMetric.value) ? _fgPulseMetric.value : null;
    var el3 = document.getElementById('mp-sentiment-val');
    var el3b = document.getElementById('mp-sentiment-label');
    if (fv !== null && !isNaN(fv)) {
      var fColor = fv <= 25 ? 'var(--data-red)' : fv <= 45 ? 'var(--data-amber)' : fv <= 55 ? 'var(--data-cyan)' : fv <= 75 ? 'var(--data-green)' : '#22754c';
      var fLabel = fv <= 25 ? '극단공포' : fv <= 45 ? '공포' : fv <= 55 ? '중립' : fv <= 75 ? '탐욕' : '극단탐욕';
      if (el3) window._aioRenderValueSlot(el3, 'value', fv, { color: fColor });
      if (el3b) window._aioRenderValueSlot(el3b, 'value', fLabel, { color: fColor });
    } else {
      window._aioRenderValueSlot(el3, 'pending', null, { text: '수신 대기', reason: 'Fear & Greed live/snapshot 미수신' });
      window._aioRenderValueSlot(el3b, 'pending', null, { text: '대기', reason: 'Fear & Greed live/snapshot 미수신' });
    }
  } catch(e) {}

  // 4) 매크로 국면 — home-market-regime 동기화 + 아이콘/라벨 분리 (v45.5: 정렬 통일)
  try {
    var regEl = document.getElementById('home-market-regime');
    var elIcon = document.getElementById('mp-macro-icon');
    var elM = document.getElementById('mp-macro-val');
    var regText = (regEl && regEl.textContent) ? regEl.textContent.trim() : '';
    if (regText && regText !== '—') {
      var regColor = (regEl && regEl.style && regEl.style.color) ? regEl.style.color : 'var(--data-amber)';
      if (elIcon) { elIcon.style.color = regColor; }
      if (elM)    window._aioRenderValueSlot(elM, 'value', regText, { color: regColor });
    } else {
      if (elIcon) { elIcon.style.color = 'var(--text-muted)'; }
      window._aioRenderValueSlot(elM, 'pending', null, { text: '대기', reason: '시장 국면 산출 대기' });
    }
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

// v48.62: 4개 우선 페이지 결론 바 일괄 업데이트
function _updateAllConclusionBars() {
  // 1) 시그널 (홈·시그널 공유)
  try {
    var sc = (typeof computeTradingScore === 'function') ? computeTradingScore('swing') : null;
    var t = (sc && typeof sc.total === 'number' && isFinite(sc.total)) ? sc.total : null;
    if (t !== null) {
      var sColor = t >= 70 ? 'var(--data-green)' : t >= 50 ? 'var(--data-cyan)' : t >= 35 ? 'var(--data-amber)' : 'var(--data-red)';
      var sLabel = t >= 75 ? '환경 우호' : t >= 60 ? '환경 양호' : t >= 45 ? '중립' : t >= 30 ? '환경 불리' : '환경 극단';
      var sAction = t >= 60 ? '환경 설명값(예측 신호 아님) — 진입 판단은 종목 근거·손익비로 별도 확인' :
                    t >= 45 ? '신호 혼재 — 점수 단독 판단 금지' :
                    '역사적으로 방어적 대응이 우선시되던 환경(지시 아님)';
      var sOpts = { conclusion: t + '점 · ' + sLabel, conclusionColor: sColor, action: sAction, fetchKey: 'quote' };
      _renderConclusionBar('home-conclusion-bar', sOpts);
      _renderConclusionBar('signal-conclusion-bar', sOpts);
    }
  } catch(e) {}

  // 2) 투자 심리 (Fear & Greed)
  try {
    var _fgPulseMetric2 = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
    var fv = _fgPulseMetric2 && _fgPulseMetric2.value != null ? _fgPulseMetric2.value : null;
    if (fv != null && !isNaN(fv)) {
      var fColor = fv <= 25 ? 'var(--data-red)' : fv <= 45 ? 'var(--data-amber)' : fv <= 55 ? 'var(--text-secondary)' : fv <= 75 ? 'var(--data-green)' : '#22754c';
      var fLabel = fv <= 25 ? '극단 공포' : fv <= 45 ? '공포' : fv <= 55 ? '중립' : fv <= 75 ? '탐욕' : '극단 탐욕';
      var fAction = fv <= 25 ? '역발상 프레임 주목 구간(예측 검증 없음) — 종목 근거 별도 확인' :
                    fv <= 45 ? '심리 위축 구간 — 분할 접근이 논의되는 환경(지시 아님)' :
                    fv <= 55 ? '심리 중립 — 뚜렷한 쏠림 없음' :
                    fv <= 75 ? '심리 과열 초입 — 추격 진입 성과가 불안정하던 구간' :
                    '심리 극단 — 역발상 프레임워크가 위험 축적을 경고해온 구간';
      _renderConclusionBar('sentiment-conclusion-bar', { conclusion: 'F&G ' + fv + ' · ' + fLabel, conclusionColor: fColor, action: fAction, fetchKey: 'fearGreed' });
    }
  } catch(e) {}

  // 3) 거시경제 (레짐 pill 동기화)
  try {
    var mEl = document.getElementById('macro-regime-pill');
    var mText = mEl ? mEl.textContent.trim().replace(/^—\s*/, '').replace(/\s*레짐\s*분석\s*중$/, '') : '';
    if (mText && mText.length > 2) {
      var mCls = mEl ? mEl.className : '';
      var mColor = mCls.indexOf('sp-risk-on') > -1 ? 'var(--data-green)' :
                   mCls.indexOf('sp-risk-off') > -1 ? 'var(--data-red)' : 'var(--data-amber)';
      var mAction = (mText.indexOf('Early') > -1 || mText.indexOf('회복') > -1) ? '성장주·소형주 비중 확대 (Early Cycle)' :
                    (mText.indexOf('Mid') > -1 || mText.indexOf('중반') > -1) ? '섹터 로테이션 주시, 기술→산업재 점검' :
                    (mText.indexOf('Late') > -1 || mText.indexOf('후반') > -1) ? 'Defensive 섹터 이동, 비중 점진 축소' :
                    (mText.indexOf('Recession') > -1 || mText.indexOf('침체') > -1) ? '현금·단기채·금 위주, 주식 최소화' :
                    'FRED 데이터 수신 후 재확인';
      _renderConclusionBar('macro-conclusion-bar', { conclusion: mText, conclusionColor: mColor, action: mAction, fetchKey: 'fred' });
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
    updateSectorHeatmap();
    refreshSignalDashboard();
    updateExitTriggers();
    updateBottomProcess();
  }
  // v42.1: 어떤 페이지에서든 마켓 펄스 업데이트
  try { updateMarketPulse(); } catch(e) {}
});
});


// ══════════════════════════════════════════════════════════════════
// v9 FX & Bond Market JS
// ══════════════════════════════════════════════════════════════════

function updateFxBondPage() {
  let ld = window._liveData || {};

  // DXY signal
  var dxy = ld['DX-Y.NYB'] ? ld['DX-Y.NYB'].price : null;
  var dxySignal = document.getElementById('dxy-signal');
  var dxyCardSignal = document.getElementById('dxy-card-signal');
  if (dxy !== null) {
    var sig, sigColor;
    if (dxy < 100)      { sig = '달러 약세'; sigColor = 'var(--data-green)'; }
    else if (dxy < 103) { sig = '중립권';    sigColor = 'var(--data-cyan)'; }
    else if (dxy < 106) { sig = '강달러 경고'; sigColor = 'var(--data-amber)'; }
    else                { sig = '강달러 위험'; sigColor = 'var(--data-red)'; }
    if (dxySignal) { dxySignal.textContent = sig; dxySignal.style.color = sigColor; }
    if (dxyCardSignal) { dxyCardSignal.textContent = sig; dxyCardSignal.style.color = sigColor; }
  }

  // v30.13d: _ldSafe 사용 → 폴백값 보장 (기존 null 반환 → 차트/스프레드 빈 화면 원인)
  var tnx = _ldSafe('^TNX','price');
  var tyx = _ldSafe('^TYX','price');
  var fvx = _ldSafe('^FVX','price');
  var irx = _ldSafe('^IRX','price');

  function setYCBar(id, rate, maxRate) {
    var el = document.getElementById(id);
    if (el && rate) {
      var pct = Math.min(95, Math.max(10, (rate / maxRate) * 100));
      el.style.height = pct + '%';
    }
  }
  if (irx) setYCBar('yc-bar-3m', irx, 6);
  if (fvx) setYCBar('yc-bar-5y', fvx, 6);
  if (tnx) setYCBar('yc-bar-10y', tnx, 6);
  if (tyx) setYCBar('yc-bar-30y', tyx, 6);

  // Spreads
  var curveEvidence = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function' ? window.AIO.getUsTreasuryCurveEvidence() : null;
  var yc2y = curveEvidence && curveEvidence.values ? curveEvidence.values.y2 : null;
  if (typeof yc2y === 'number' && isFinite(yc2y)) setYCBar('yc-bar-2y', yc2y, 6);
  if (tnx && irx) {
    var s3m10y = tnx - irx;
    var sc3m10y = document.getElementById('sc-3m10y');
    if (sc3m10y) {
      sc3m10y.textContent = (s3m10y >= 0 ? '+' : '') + s3m10y.toFixed(2) + '%';
      sc3m10y.style.color = s3m10y < 0 ? 'var(--data-red)' : 'var(--data-green)';
    }
  }
  if (tnx && fvx) {
    var s5s30 = tyx ? (tyx - fvx) : null;
    if (s5s30 !== null) {
      var sc5s30 = document.getElementById('sc-5s30s');
      if (sc5s30) {
        sc5s30.textContent = (s5s30 >= 0 ? '+' : '') + s5s30.toFixed(2) + '%';
        sc5s30.style.color = s5s30 > 0 ? 'var(--data-green)' : 'var(--data-amber)';
      }
    }
  }

  // 2s10s spread — 명시적 2Y·10Y 관측치만 사용
  var s2s10 = curveEvidence && curveEvidence.spread2s10s != null ? curveEvidence.spread2s10s : null;
  if (s2s10 !== null) {
    var sc2s10 = document.getElementById('sc-2s10s');
    if (sc2s10) {
      sc2s10.textContent = (s2s10 >= 0 ? '+' : '') + s2s10.toFixed(2) + '%';
      sc2s10.style.color = s2s10 < 0 ? 'var(--data-red)' : s2s10 < 0.1 ? 'var(--data-amber)' : 'var(--data-green)';
    }
  } else {
    var sc2s10Missing = document.getElementById('sc-2s10s');
    if (sc2s10Missing) { sc2s10Missing.textContent = '—'; sc2s10Missing.title = '2Y 또는 10Y 관측값 미수신'; }
  }

  // Credit spread — HYG/LQD 가격을 OAS로 환산하지 않고 FRED 관측값만 사용
  var spreadBp = (typeof window._hySpreadBp === 'number' && isFinite(window._hySpreadBp)) ? window._hySpreadBp : null;
  var hySpreadBar = document.getElementById('hy-spread-bar');
  var hySpreadEst = document.getElementById('hy-spread-est');
  if (hySpreadBar) hySpreadBar.style.width = spreadBp != null ? Math.min(90, (spreadBp / 800) * 100) + '%' : '0%';
  if (hySpreadEst) {
    var sColor = spreadBp == null ? 'var(--text-muted)' : spreadBp < 300 ? 'var(--data-green)' : spreadBp < 500 ? 'var(--data-amber)' : 'var(--data-red)';
    hySpreadEst.textContent = spreadBp != null ? Math.round(spreadBp) + 'bp · FRED' : '— · FRED OAS 미수신';
    hySpreadEst.style.color = sColor;
  }

  // v53.8/P727: v52.71에서 제거된 fx-dc-*/bond-dc-* 해설 경로는 폐기하고,
  // 현재 DOM에 남아 있는 상태 배지만 canonical fxbond updater에서 갱신한다.
  var dxyLive = dxy != null && isFinite(Number(dxy)) ? Number(dxy) : null;
  var tnxLive = ld['^TNX'] && ld['^TNX'].price != null && isFinite(Number(ld['^TNX'].price)) ? Number(ld['^TNX'].price) : null;
  var irxLive = ld['^IRX'] && ld['^IRX'].price != null && isFinite(Number(ld['^IRX'].price)) ? Number(ld['^IRX'].price) : null;
  var pill = document.getElementById('fxbond-risk-pill');
  if (pill && pill.dataset.aioFxbondRiskRenderer !== 'native' && dxyLive != null && tnxLive != null) {
    if (dxyLive >= 107 || tnxLive >= 5.0) { pill.className = 'status-pill sp-risk-off'; pill.textContent = ' 관측 · 높은 달러·금리 수준'; }
    else if (dxyLive >= 104 || tnxLive >= 4.5) { pill.className = 'status-pill sp-risk-off'; pill.textContent = ' 관측 · 달러·금리 수준 확인'; }
    else if (dxyLive >= 100) { pill.className = 'status-pill sp-neutral'; pill.textContent = ' 관측 · 달러·금리 모니터링'; }
    else { pill.className = 'status-pill sp-neutral'; pill.textContent = ' 관측 · 달러·금리 수준'; }
  }
  var invBadge = document.getElementById('yc-inversion-badge');
  if (invBadge && invBadge.dataset.aioFxbondCurveRenderer !== 'native' && tnxLive != null && irxLive != null) {
    var live3m10y = tnxLive - irxLive;
    if (live3m10y < -0.2) { invBadge.textContent = ' 깊은 역전 · 경기침체 경고'; invBadge.style.background = 'rgba(177,58,48,0.15)'; invBadge.style.color = 'var(--data-red)'; }
    else if (live3m10y < 0) { invBadge.textContent = '역전 지속 · 주의'; invBadge.style.color = 'var(--data-amber)'; }
    else if (live3m10y < 0.3) { invBadge.textContent = ' 역전 해소 중 · 위험 구간'; invBadge.style.color = 'var(--data-amber)'; }
    else { invBadge.textContent = ' 정상 곡선 · 안정'; invBadge.style.background = 'rgba(34,117,76,0.12)'; invBadge.style.color = 'var(--data-green)'; }
  }

  try { updateCrossAssetMatrix(); } catch(e) { _aioLog('warn', 'render', 'CAM error: ' + (e && e.message || e)); }
}

// ── 10Y금리·엔화 3개월 추이 미니 라인차트 — v52.71 아이보리 3e: 시안 구조(단일 지표 히스토리,
// 만기별 수익률곡선과는 다른 차트 종류라 신규 작성 — fetchOHLCVWithFallback 재사용, 별도 알고리즘 없음) ──
async function loadFxBondTrendCharts() {
  var nativeFxbondPage = document.getElementById('page-fxbond');
  if (nativeFxbondPage && nativeFxbondPage.dataset.aioFxbondRenderer === 'native') return;
  var tnxCvs = document.getElementById('fxbond-tnx-trend');
  var jpyCvs = document.getElementById('fxbond-jpy-trend');
  if (!tnxCvs && !jpyCvs) return;
  var cs = getComputedStyle(document.documentElement);
  var lineColor = cs.getPropertyValue('--text-primary').trim() || '#211d16';
  var gridColor = cs.getPropertyValue('--border-subtle').trim() || 'rgba(0,0,0,0.08)';
  var tickColor = cs.getPropertyValue('--text-muted').trim() || '#8a8271';

  async function draw(canvas, symbol, chartId) {
    if (!canvas || typeof fetchOHLCVWithFallback !== 'function') return;
    var rows = null;
    try { rows = await fetchOHLCVWithFallback(symbol, '1day', 66); } catch (e) { rows = null; }
    rows = (rows || []).filter(function(r) { return r && r.time && isFinite(r.close); });
    if (rows.length < 10) return;
    var labels = rows.map(function(r) { return r.time.slice(5); });
    var closes = rows.map(function(r) { return r.close; });
    if (window._aioChartRegistry) window._aioChartRegistry.destroyIfExists(chartId);
    var chart = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: [{ data: closes, borderColor: lineColor, backgroundColor: 'transparent', borderWidth: 1.8, pointRadius: 0, tension: 0.15 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
          y: { ticks: { color: tickColor, maxTicksLimit: 4 }, grid: { color: gridColor } }
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: function(items) { return rows[items[0].dataIndex].time; } } } }
      }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register(chartId, chart);
  }
  await draw(tnxCvs, '^TNX', 'fxbond-tnx-trend');
  await draw(jpyCvs, 'JPY=X', 'fxbond-jpy-trend');
}
window.loadFxBondTrendCharts = loadFxBondTrendCharts;

// FX/Bond page live update hook
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-fxbond-live', 'aio:liveQuotes', function() {
  var fxPage = document.getElementById('page-fxbond');
  if (fxPage && fxPage.classList.contains('active')) {
    updateFxBondPage();
  }
});
});

// ═══════════════════════════════════════════════════════════════
//  YIELD CURVE CHART (Chart.js Canvas)
// ═══════════════════════════════════════════════════════════════
var _ycChart = null;   // legacy 호환
var _ycCharts = {};    // v50.16: per-canvas 인스턴스 — koreaCurveChart(fxbond)/yieldCurveChart(macro) 공유 _ycChart destroy 충돌 차단
function initYieldCurveChart(targetId) {
  // v50.16 근본 수정: targetId 명시 우선. 미지정 시 활성 페이지 기준 선택
  // (이전 `koreaCurveChart || yieldCurveChart`는 koreaCurveChart가 항상 DOM에 존재 → macro 호출도 fxbond 캔버스로 오렌더 + fxbond는 자체 init 호출 없어 "수집 대기" 멈춤)
  var ctx = targetId ? document.getElementById(targetId)
          : (document.querySelector('#page-fxbond.active') ? document.getElementById('koreaCurveChart')
             : (document.getElementById('yieldCurveChart') || document.getElementById('koreaCurveChart')));
  if (!ctx || typeof Chart === 'undefined') return;
  if (ctx.id === 'koreaCurveChart' && ctx.dataset.aioFxbondChartRenderer === 'native') return;
  if (ctx.id === 'yieldCurveChart' && ctx.closest('#page-macro[data-aio-macro-chart-renderer="native"]')) return;
  var _cid = ctx.id;
  if (_ycCharts[_cid]) { try { _ycCharts[_cid].destroy(); } catch(e){} _ycCharts[_cid] = null; }

  let ld = window._liveData || {};
  var irx = _ldSafe('^IRX','price');
  var y2 = window._live2Y || 3.88;
  var fvx = _ldSafe('^FVX','price');
  var tnx = _ldSafe('^TNX','price');
  var tyx = _ldSafe('^TYX','price');

  var labels = ['3개월', '2년', '5년', '10년', '30년'];
  var rates = [irx, y2, fvx, tnx, tyx];
  var isInverted = irx > tnx || y2 > tnx;

  // v30.11: 차트 데이터 검증 게이트
  // v30.13d: 실제 캔버스 ID 사용
  var gated = chartDataGate(ctx.id, labels, [rates], { minPoints: 3, chartName: '수익률 곡선 (FX/Bond)', fillMode: 'prev' });
  if (!gated) return;
  rates = gated.datasets[0];

  // Create gradient
  var gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  if (isInverted) {
    gradient.addColorStop(0, 'rgba(177,58,48,0.3)');
    gradient.addColorStop(1, 'rgba(177,58,48,0.02)');
  } else {
    gradient.addColorStop(0, 'rgba(33,29,22,0.3)');
    gradient.addColorStop(1, 'rgba(33,29,22,0.02)');
  }

  _ycCharts[_cid] = _ycChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '미 국채 수익률 (%)',
        data: rates,
        borderColor: isInverted ? 'var(--data-red)' : 'var(--data-cyan)',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: rates.map(function(r,i){
          if (i > 0 && r < rates[i-1]) return 'var(--data-red)';
          return isInverted ? 'var(--data-amber)' : 'var(--data-cyan)';
        }),
        pointBorderColor: '#fbf9f5',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
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
          backgroundColor: 'rgba(251,249,245,0.97)',
          titleColor: '#211d16',
          bodyColor: '#57513f',
          borderColor: 'rgba(33,29,22,0.3)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              return ctx.parsed.y.toFixed(2) + '%';
            },
            afterLabel: function(ctx) {
              var notes = ['단기 자금 금리 (Fed 직결)','시장 금리인하 기대 반영','중기 성장·인플레 기대','글로벌 벤치마크 금리','장기 인플레·재정 위험'];
              return notes[ctx.dataIndex] || '';
            }
          }
        }
      },
      scales: {
        y: {
          min: Math.floor(Math.min.apply(null, rates) * 10 - 2) / 10,
          max: Math.ceil(Math.max.apply(null, rates) * 10 + 2) / 10,
          ticks: { color: '#8a8271', font: { size: 9, family: 'SF Mono, monospace' }, callback: function(v){ return v.toFixed(1)+'%'; } },
          grid: { color: 'var(--surface-3)' }
        },
        x: {
          ticks: { color: '#8a8271', font: { size: 11 } },
          grid: { color: 'var(--surface-3)' }
        }
      }
    }
  });

}

// v48.50: Cross-Asset Matrix — 4축 정렬 판정 (FX × Yield × Credit)
function updateCrossAssetMatrix() {
  let ld = window._liveData || {};
  var dxy = ld['DX-Y.NYB'] || {};
  var y10 = ld['^TNX'] || {};
  var curveEvidence = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function' ? window.AIO.getUsTreasuryCurveEvidence() : {};
  var hyg = ld['HYG'] || {};

  // DXY 판정
  var dxyPct = dxy.pct;
  var dxySignalEl = document.getElementById('cam-dxy-signal');
  if (dxySignalEl) {
    if (dxyPct == null) dxySignalEl.textContent = '판정: —';
    else if (dxyPct >= 0.3) { dxySignalEl.textContent = '관측: 달러 당일 상승'; dxySignalEl.style.color = 'var(--data-red)'; }
    else if (dxyPct <= -0.3) { dxySignalEl.textContent = '관측: 달러 당일 하락'; dxySignalEl.style.color = 'var(--data-green)'; }
    else { dxySignalEl.textContent = '판정: 중립 보합'; dxySignalEl.style.color = 'var(--text-muted)'; }
  }

  // 10Y 판정
  var y10Val = y10.price;
  var y10SigEl = document.getElementById('cam-10y-signal');
  if (y10SigEl) {
    if (y10Val == null) y10SigEl.textContent = '판정: —';
    else if (y10Val >= 4.7) { y10SigEl.textContent = '판정: 금리 상방 (주식 압박)'; y10SigEl.style.color = 'var(--data-red)'; }
    else if (y10Val <= 3.5) { y10SigEl.textContent = '판정: 금리 하방 (Growth 유리)'; y10SigEl.style.color = 'var(--data-green)'; }
    else { y10SigEl.textContent = '판정: 레인지 중립'; y10SigEl.style.color = 'var(--text-muted)'; }
  }

  // 2Y-10Y 곡선 (장단 스프레드)
  var spreadEl = document.getElementById('cam-yieldspread-val');
  var spreadSigEl = document.getElementById('cam-yieldspread-signal');
  var spreadBp = null;
  if (curveEvidence.available && curveEvidence.spread2s10s != null) {
    spreadBp = Math.round(curveEvidence.spread2s10s * 100);
    if (spreadEl) spreadEl.textContent = (spreadBp >= 0 ? '+' : '') + spreadBp;
    if (spreadSigEl) {
      if (spreadBp < -20) { spreadSigEl.textContent = '곡선: 역전 (경기 침체 선행)'; spreadSigEl.style.color = 'var(--data-red)'; }
      else if (spreadBp < 20) { spreadSigEl.textContent = '곡선: 평탄화 경계'; spreadSigEl.style.color = 'var(--data-amber)'; }
      else { spreadSigEl.textContent = '곡선: 양(+) 기울기 · 단독 경기판정 금지'; spreadSigEl.style.color = 'var(--data-amber)'; }
    }
  } else if (spreadEl) {
    spreadEl.textContent = '—';
  }

  // HYG 판정
  var hygPct = hyg.pct;
  var hygSigEl = document.getElementById('cam-hyg-signal');
  if (hygSigEl) {
    if (hygPct == null) hygSigEl.textContent = '판정: —';
    else if (hygPct >= 0.3) { hygSigEl.textContent = '관측: HYG 가격 상승 · OAS 별도 확인'; hygSigEl.style.color = 'var(--data-green)'; }
    else if (hygPct <= -0.3) { hygSigEl.textContent = '관측: HYG 가격 하락 · OAS 별도 확인'; hygSigEl.style.color = 'var(--data-red)'; }
    else { hygSigEl.textContent = '관측: HYG 가격 보합 · OAS 별도 확인'; hygSigEl.style.color = 'var(--text-muted)'; }
  }

  // P813: cam-verdict-text is owned by native market.js; the remaining matrix
  // signal cells stay legacy-owned for their separate quote/prose boundaries.
}

// ═══════════════════════════════════════════════════════════════
//  FUNDAMENTAL PAGE — Live Data + Earnings Calendar
// ═══════════════════════════════════════════════════════════════
async function initFundamentalLegacyWidgets() {
  try {
  // Remaining earnings widgets retain their existing provider boundary; the SEC card surface is native-owned.
  loadEarningsSurprises();
  loadEarningsCalendar();
  } catch(e) { _aioLog('warn', 'fund', 'initFundamentalLegacyWidgets error: ' + e.message); }
}

function loadEarningsSurprises() {
  var body = document.getElementById('earnings-surprise-body');
  if (!body) return;

  // v35.8: FMP API 동적 호출
  var fmpKey = _getApiKey('aio_fmp_key');
  if (fmpKey) {
    _fetchEarningsSurprisesFMP(body, fmpKey);
    return;
  }
  // API 키 없으면 안내 표시
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">FMP API 키 설정 시 실시간 실적 서프라이즈 표시<br><span style="font-size:11px;">Settings → API Keys → FMP Key</span></div>';
}

async function _fetchEarningsSurprisesFMP(body, fmpKey) {
  try {
    // 최근 실적 서프라이즈 — PRIORITY_SYMS 중 주요 종목
    var targets = ['NVDA','AAPL','MSFT','GOOGL','AMZN','META','TSLA','MU','CRM','COST','NFLX','FDX','LULU','AMD','AVGO'];
    var results = [];
    // 3개씩 배치 fetch (API rate limit 고려)
    for (var i = 0; i < Math.min(targets.length, 9); i += 3) {
      var batch = targets.slice(i, i + 3);
      var fetches = batch.map(function(sym) {
        return fetch('https://financialmodelingprep.com/api/v3/earnings-surprises/' + sym + '?apikey=' + fmpKey)
          .then(function(r) { return r.ok ? r.json() : []; })
          .catch(function() { return []; });
      });
      var batchResults = await Promise.all(fetches);
      batchResults.forEach(function(data, idx) {
        if (data && data.length > 0) {
          var latest = data[0];
          var surp = latest.actualEarningResult && latest.estimatedEarning
            ? ((latest.actualEarningResult - latest.estimatedEarning) / Math.abs(latest.estimatedEarning) * 100)
            : 0;
          results.push({
            sym: batch[idx],
            actual: '$' + (latest.actualEarningResult || 0).toFixed(2),
            est: '$' + (latest.estimatedEarning || 0).toFixed(2),
            surprise: (surp >= 0 ? '+' : '') + surp.toFixed(1) + '%',
            positive: surp >= 0,
            date: latest.date || ''
          });
        }
      });
    }
    // 서프라이즈 크기순 정렬
    results.sort(function(a, b) { return Math.abs(parseFloat(b.surprise)) - Math.abs(parseFloat(a.surprise)); });
    if (results.length === 0) {
      // v52.41 (P656/EF-09c): FMP earnings-surprises 엔드포인트는 실측상 상시 403(플랜 제한 추정)이라
      // "잠시 후 재시도"는 곧 해결될 것처럼 오도한다 — Finnhub 대체 경로가 없는 구조적 한계임을 정직하게 표기.
      body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:11px;line-height:1.6;">실적 서프라이즈 데이터 미수신(FMP 플랜 제한 추정 — 구조적, 재시도로 해결 안 될 수 있음)<br>개별 종목의 다음 어닝 일정·컨센서스는 위 검색창에서 티커 검색 시 확인 가능</div>';
      return;
    }
    var sHtml = '';
    results.slice(0, 8).forEach(function(s) {
      sHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);">';
      sHtml += '<span style="font-size:13px;font-weight:600;color:var(--text-primary);width:60px;">' + s.sym + '</span>';
      sHtml += '<span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);">' + s.actual + '</span>';
      sHtml += '<span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">' + s.est + '</span>';
      sHtml += '<span style="font-size:12px;font-weight:600;color:' + (s.positive ? 'var(--data-green)' : 'var(--data-red)') + ';">' + s.surprise + '</span>';
      sHtml += '</div>';
    });
    body.innerHTML = sHtml;
    console.log('[AIO] FMP 실적 서프라이즈 ' + results.length + '건 로드');
  } catch(e) {
    _aioLog('warn', 'fetch', 'FMP 서프라이즈 fetch 실패: ' + e.message);
    body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:11px;">실적 데이터 수신 실패</div>';
  }
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
      generatedAt: d.generatedAt || null
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
      html += '<div style="background:rgba(33,29,22,0.08);border:1px solid rgba(33,29,22,0.25);border-radius:3px;padding:4px 6px;">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--data-purple);margin-bottom:3px;">IPO · ' + day.ipos.length + '건</div>';
      day.ipos.slice(0, 3).forEach(function(p) {
        html += '<div style="font-size:11px;color:var(--text-primary);font-family:var(--font-mono);line-height:1.4;">' + escHtml(p.symbol || '?') + ' <span style="color:var(--text-muted);font-size:11px;">' + escHtml((p.name||'').slice(0,18)) + '</span></div>';
      });
      if (day.ipos.length > 3) html += '<div style="font-size:11px;color:var(--text-muted);">+' + (day.ipos.length - 3) + '</div>';
      html += '</div>';
    }

    // BMO (Before Open)
    if (day.bmo.length > 0) {
      html += _renderEarnSection('', 'Before Open', day.bmo, MAX_VISIBLE, 'rgba(33,29,22,0.08)', 'rgba(33,29,22,0.25)', 'var(--data-amber)');
    }
    // AMC (After Close)
    if (day.amc.length > 0) {
      html += _renderEarnSection('', 'After Close', day.amc, MAX_VISIBLE, 'rgba(33,29,22,0.08)', 'rgba(33,29,22,0.2)', 'var(--data-cyan)');
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

// v48.56: 리스크 레이더 렌더러 (Finnhub Economic Calendar + 정적 상위 이벤트)
window._aioCurrentRiskFilter = 'all';
window._aioRiskRadarFilter = function(el) {
  window._aioCurrentRiskFilter = el && el.value || 'all';
  loadRiskRadar();
};

async function loadRiskRadar() {
  var body = document.getElementById('risk-radar-body');
  if (!body) return;

  var now = new Date();
  var fromStr = now.toISOString().slice(0, 10);
  var to = new Date(now.getTime() + 90 * 86400000);
  var toStr = to.toISOString().slice(0, 10);

  body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:10px;"><span class="aio-spinner" style="margin-right:8px;"></span>이벤트 수집 중…</div>';

  // 1. 공식 일정 레지스트리. 소스 없는 정치·실적·루머 일정은 현재 이벤트로 승격하지 않는다.
  var officialEvents = [];
  var releases = window.AIO_MACRO_CALENDAR && window.AIO_MACRO_CALENDAR.releases || {};
  var seenOfficial = {};
  Object.keys(releases).forEach(function(key) {
    var r = releases[key];
    if (!r || !r.nextRelease || seenOfficial[r.name + '|' + r.nextRelease]) return;
    seenOfficial[r.name + '|' + r.nextRelease] = true;
    officialEvents.push({
      date: r.nextRelease,
      impact: key === 'us-fomc' || key === 'kr-bok' ? 'critical' : 'high',
      category: key.indexOf('fomc') >= 0 || key.indexOf('fed-rate') >= 0 || key === 'kr-bok' ? 'fomc' : 'economic',
      event: r.name + (r.source ? ' · ' + r.source : ''),
      flag: key.indexOf('kr-') === 0 ? '🇰🇷' : '🇺🇸',
      sourceKind: 'official-calendar'
    });
  });

  // 2. Finnhub 경제 이벤트 (CPI/PPI/NFP/GDP/PMI 등) — API 키 있으면
  var finnhubKey = _getApiKey('aio_finnhub_key');
  var finnhubEvents = [];
  if (finnhubKey && typeof fetchFinnhubEconomicCalendar === 'function') {
    try {
      var ecoRaw = await fetchFinnhubEconomicCalendar(fromStr, toStr);
      // high/medium impact만 필터 (noise 제거)
      finnhubEvents = (ecoRaw || []).filter(function(e) {
        var imp = (e.impact || '').toLowerCase();
        return imp === 'high' || imp === 'medium';
      }).map(function(e) {
        var country = (e.country || 'US').toUpperCase();
        var flag = country === 'US' ? '🇺🇸' : country === 'EU' ? '🇪🇺' : country === 'CN' ? '🇨🇳' : country === 'JP' ? '🇯🇵' : country === 'KR' ? '🇰🇷' : '';
        return {
          date: (e.time || '').slice(0, 10),
          impact: (e.impact || '').toLowerCase() === 'high' ? 'high' : 'medium',
          category: 'economic',
          event: (e.event || '?') + (e.actual != null ? ' (실측: ' + e.actual + ')' : (e.estimate != null ? ' (예상: ' + e.estimate + ')' : '')),
          flag: flag
        };
      });
    } catch(e) { /* silent */ }
  }

  // 3. 병합 + 정렬
  var allEvents = officialEvents.concat(finnhubEvents).filter(function(e) {
    return e.date >= fromStr && e.date <= toStr;
  });
  allEvents.sort(function(a, b) { return a.date > b.date ? 1 : -1; });

  // 4. 필터 적용
  var filter = window._aioCurrentRiskFilter || 'all';
  var filtered = allEvents;
  if (filter === 'high') filtered = allEvents.filter(function(e) { return e.impact === 'critical' || e.impact === 'high'; });
  else if (filter === 'fomc') filtered = allEvents.filter(function(e) { return e.category === 'fomc' || e.category === 'economic'; });
  else if (filter === 'earnings') filtered = allEvents.filter(function(e) { return e.category === 'earnings'; });
  else if (filter === 'geopolitical') filtered = allEvents.filter(function(e) { return e.category === 'geopolitical'; });

  // 5. 렌더 (v49.64 P337/T394: lineage 메타 갱신 — pending → decision)
  if (filtered.length === 0) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:10px;">해당 필터에 맞는 이벤트 없음</div>';
    body.setAttribute('data-operational-use', 'reference-only');
    body.setAttribute('data-source-kind', 'mixed');
    body.setAttribute('data-source-label', 'risk-radar-empty');
  } else {
    var html = '';
    filtered.forEach(function(e) {
      var d = new Date(e.date + 'T00:00:00');
      var dow = ['일','월','화','수','목','금','토'][d.getDay()];
      var mmdd = (d.getMonth()+1) + '월 ' + d.getDate() + '일';
      var daysFromNow = Math.round((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
      var dStr = daysFromNow === 0 ? '오늘' : daysFromNow === 1 ? '내일' : 'D-' + daysFromNow;

      var impactColor = e.impact === 'critical' ? 'var(--data-red)' : e.impact === 'high' ? 'var(--data-amber)' : 'var(--text-muted)';
      var impactBg = e.impact === 'critical' ? 'rgba(177,58,48,0.08)' : e.impact === 'high' ? 'rgba(33,29,22,0.06)' : 'var(--surface-1)';
      var impactLabel = e.impact === 'critical' ? 'CRITICAL' : e.impact === 'high' ? 'HIGH' : 'MED';

      html += '<div class="aio-risk-event" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:' + impactBg + ';border:1px solid var(--border-subtle);border-left:3px solid ' + impactColor + ';border-radius:3px;">';
      html += '<span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);flex-shrink:0;min-width:70px;">' + mmdd + '(' + dow + ')</span>';
      html += '<span style="font-size:11px;color:' + impactColor + ';font-weight:700;font-family:var(--font-mono);flex-shrink:0;min-width:40px;">' + dStr + '</span>';
      html += '<span style="font-size:13px;flex-shrink:0;">' + e.flag + '</span>';
      html += '<span style="font-size:11px;color:var(--text-primary);flex:1;line-height:1.5;">' + escHtml(e.event) + '</span>';
      html += '<span style="font-size:11px;color:' + impactColor + ';font-weight:700;padding:2px 6px;background:' + impactBg + ';border:1px solid ' + impactColor + ';border-radius:3px;font-family:var(--font-mono);flex-shrink:0;">' + impactLabel + '</span>';
      html += '</div>';
    });
    body.innerHTML = html;
    // 공식 레지스트리와 Finnhub 동적 일정만 사용한다.
    body.setAttribute('data-operational-use', 'decision');
    body.setAttribute('data-source-kind', 'official+dynamic');
    body.setAttribute('data-source-label', 'AIO_MACRO_CALENDAR+Finnhub');
    body.setAttribute('data-source-ts', new Date().toISOString());
  }

  var st = document.getElementById('risk-radar-status');
  if (st) st.textContent = filtered.length + '건 · 공식 ' + officialEvents.length + ' + Finnhub ' + finnhubEvents.length + ' (' + fromStr.slice(5) + '~' + toStr.slice(5) + ')';
}

// 리스크 레이더 페이지 진입 시 자동 로드 (v48.57: briefing 제거 — DOM 미존재 불필요 실행)
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-fundamental-risk-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'fundamental') {
    setTimeout(function() {
      if (typeof loadRiskRadar === 'function') loadRiskRadar();
    }, 200);
  }
});
});

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
  if (e.detail === 'fxbond') {
    setTimeout(function() {
      try { updateFxBondPage(); } catch(e) {}
      try { if (typeof loadFxBondTrendCharts === 'function') loadFxBondTrendCharts(); } catch(e) {}
    }, 200);
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
  // Check for fxbond active
  var fxp = document.getElementById('page-fxbond');
  if (fxp && fxp.classList.contains('active')) {
    setTimeout(updateFxBondPage, 500);
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
  { sym:'CIBR',name:'사이버ETF', color:'#211d16', emoji:'' },
  { sym:'BOTZ',name:'로보틱스',  color:'#211d16', emoji:'' },
  { sym:'ICLN',name:'클린에너지',color:'#22754c', emoji:'' },
  { sym:'LIT', name:'리튬/배터리',color:'#b13a30', emoji:'' },
];

// ── 종합 테마 맵 (screener_pro.py SECTOR_LEADERS 기반 + 확장) ────
// 대장주 선정 기준: 주가 퍼포먼스 + 시장 관심도 + 유망 전망 + 합리적 시총
// (시총이 크다고 대장주가 아님! RKLB, ASTS 같은 퍼포먼스 리더 우선)
var THEME_MEMBERSHIP_POLICY = Object.freeze({
  version:'theme-membership.v1',
  source:'AIO curated taxonomy',
  sourceKind:'REFERENCE',
  observedAt:null,
  allowedUse:'reference',
  status:'as-of-unverified',
  note:'구성 종목은 편집 분류이며 기준일이 검증되기 전에는 현재 지수·공식 분류로 해석하지 않습니다.'
});
window.THEME_MEMBERSHIP_POLICY = THEME_MEMBERSHIP_POLICY;
var THEME_MAP = [
  {
    id:'defense', nameKr:'방산/항공우주', emoji:'', color:'#22754c',
    etf:'ITA', etfName:'iShares Defense',
    leaders:['LMT','RTX','GD','NOC','HII','RKLB','ASTS','HWM','LHX','GE','TXT'],
    // RKLB, ASTS = 소형주지만 퍼포먼스·전망·시장관심 폭발적 → 대장주
    leaderHighlight:['RKLB','ASTS','LMT','RTX'],
    subThemes:[
      { name:'전통 방산', tickers:['LMT','RTX','NOC','GD','HII','LHX','PLTR','LDOS'] },
      { name:'우주/위성', tickers:['RKLB','ASTS','BA','LUNR','RDW'] },
      { name:'항공 부품', tickers:['HWM','GE','TXT'] }
    ]
  },
  {
    id:'staples', nameKr:'필수소비재', emoji:'', color:'#211d16',
    etf:'XLP', etfName:'Consumer Staples',
    leaders:['KO','PEP','COST','PG','MCD','MNST','CL','CLX','DG','CHD','MO','PM','SYY'],
    leaderHighlight:['COST','MNST','KO','PG'],
    subThemes:[
      { name:'F&B/식음료', tickers:['KO','PEP','MNST','SYY','MCD'] },
      { name:'생활용품', tickers:['PG','CL','CLX','CHD'] },
      { name:'할인/유통', tickers:['COST','DG','WMT'] },
      { name:'담배', tickers:['MO','PM'] }
    ]
  },
  {
    id:'healthcare', nameKr:'헬스케어/제약', emoji:'', color:'#211d16',
    etf:'XLV', etfName:'Healthcare',
    leaders:['ABBV','AMGN','GILD','MRNA','REGN','VRTX','BMY','JNJ','MRK','LLY','DVA','MCK'],
    leaderHighlight:['LLY','VRTX','ABBV','REGN'],
    subThemes:[
      { name:'대형 제약', tickers:['LLY','JNJ','MRK','PFE','ABBV','BMY'] },
      { name:'바이오텍', tickers:['VRTX','REGN','AMGN','GILD','MRNA','BIIB'], etf:'XBI' },
      { name:'의료기기/서비스', tickers:['DVA','MCK','ISRG','MDT'] },
      { name:'생명과학 장비', tickers:['TMO','DHR','A','WAT'] }
    ]
  },
  {
    id:'utilities', nameKr:'유틸리티', emoji:'', color:'#211d16',
    etf:'XLU', etfName:'Utilities',
    leaders:['NEE','CEG','DUK','AEP','EXC','VST','NRG','ETR','EVRG','ES','FE','LNT','PNW','ATO','XEL','EIX'],
    leaderHighlight:['CEG','VST','NEE','NRG'],
    // CEG, VST, NRG = 원전/전력 트레이딩 퍼포먼스 폭발
    subThemes:[
      { name:'원전/핵발전', tickers:['CEG','VST','NRG','SMR','CCJ'], etf:'URA' },
      { name:'재생에너지', tickers:['NEE','ENPH','SEDG','FSLR','RUN'], etf:'ICLN' },
      { name:'전통 유틸', tickers:['DUK','AEP','EXC','ETR','ES','EVRG','FE','LNT','PNW','ATO','XEL','EIX'] }
    ]
  },
  {
    id:'energy', nameKr:'에너지', emoji:'', color:'var(--data-green)',
    etf:'XLE', etfName:'Energy',
    leaders:['COP','CVX','DVN','KMI','OXY','TPL','TRGP','VLO','WMB','XOM','BKR','HAL','SLB','FANG'],
    leaderHighlight:['TPL','TRGP','WMB','FANG'],
    subThemes:[
      { name:'통합 메이저', tickers:['XOM','CVX','COP'] },
      { name:'E&P(탐사/생산)', tickers:['DVN','FANG','OXY','TPL'], etf:'XOP' },
      { name:'MLP/파이프라인', tickers:['KMI','WMB','TRGP','ET'], etf:'AMLP' },
      { name:'오일서비스', tickers:['SLB','HAL','BKR'], etf:'OIH' },
      { name:'정유', tickers:['VLO','MPC','PSX'] }
    ]
  },
  {
    id:'semiconductor', nameKr:'반도체', emoji:'', color:'var(--data-purple)',
    etf:'SMH', etfName:'VanEck Semiconductor',
    leaders:['NVDA','AMD','AVGO','QCOM','MRVL','ADI','AMAT','LRCX','MU','TER','KLAC','TSM','ASML','ARM'],
    leaderHighlight:['NVDA','AVGO','ARM','AMAT'],
    subThemes:[
      { name:'AI 칩/GPU', tickers:['NVDA','AMD','AVGO','ARM'] },
      { name:'메모리', tickers:['MU','STX','WDC'] },
      { name:'장비/소재', tickers:['AMAT','LRCX','KLAC','TER','ASML'] },
      { name:'아날로그/RF', tickers:['ADI','QCOM','MRVL','TXN','NXPI','ON'] },
      { name:'파운드리/성숙공정', tickers:['INTC','GFS','TSM','UMC'] }
    ]
  },
  {
    id:'software', nameKr:'소프트웨어/클라우드', emoji:'', color:'#b13a30',
    etf:'IGV', etfName:'iShares Software',
    leaders:['CRM','NOW','ADBE','ORCL','PANW','CRWD','ZS','FTNT','DDOG','SNOW','PLTR','NET'],
    leaderHighlight:['PLTR','CRWD','NOW','PANW'],
    // PLTR = AI 플랫폼 리더, 퍼포먼스 폭발적 | SaaSpocalypse/AI 대체 관련 키워드
    subThemes:[
      { name:'엔터프라이즈 SaaS', tickers:['CRM','NOW','ADBE','ORCL','WDAY'] },
      { name:'사이버보안', tickers:['PANW','CRWD','ZS','FTNT','NET'], etf:'HACK' },
      { name:'데이터/AI플랫폼', tickers:['PLTR','SNOW','DDOG','MDB','ESTC','AI','TTD'] },
      { name:'클라우드 인프라', tickers:['AMZN','MSFT','GOOGL'] }
    ]
  },
  {
    id:'industrials', nameKr:'산업재/물류', emoji:'', color:'var(--data-cyan)',
    etf:'XLI', etfName:'Industrials',
    leaders:['CAT','HON','UNP','FDX','UPS','CSX','JBHT','NSC','ODFL','PCAR','PH','WAB','AME','GNRC','JCI','NDSN'],
    leaderHighlight:['CAT','UNP','HON','WAB'],
    subThemes:[
      { name:'화물/물류', tickers:['FDX','UPS','CSX','JBHT','NSC','ODFL','UNP'] },
      { name:'건설/중장비', tickers:['CAT','PCAR','PH','NDSN'] },
      { name:'항공/인프라', tickers:['HON','WAB','AME','JCI','GNRC'] }
    ]
  },
  {
    id:'financials', nameKr:'금융', emoji:'', color:'var(--data-amber)',
    etf:'XLF', etfName:'Financials',
    leaders:['JPM','GS','MS','BLK','WFC','BAC','C','SCHW','AXP','V','MA'],
    leaderHighlight:['JPM','GS','AXP','V'],
    subThemes:[
      { name:'대형 은행', tickers:['JPM','BAC','WFC','C','GS','MS'] },
      { name:'자산운용', tickers:['BLK','SCHW','BX','KKR'] },
      { name:'결제/핀테크', tickers:['V','MA','AXP','XYZ','PYPL','SOFI','AFRM'] }
    ]
  },
  {
    id:'reits', nameKr:'리츠/부동산', emoji:'', color:'#211d16',
    etf:'XLRE', etfName:'Real Estate',
    leaders:['PLD','VTR','KIM','O','REG','SPG','EQIX'],
    leaderHighlight:['EQIX','PLD','SPG','O'],
    // EQIX = 데이터센터 리츠, AI 인프라 수요로 퍼포먼스 우수
    subThemes:[
      { name:'데이터센터', tickers:['EQIX','DLR','AMT'] },
      { name:'물류/산업', tickers:['PLD','STAG'] },
      { name:'리테일/헬스', tickers:['SPG','O','VTR','KIM','REG'] }
    ]
  },
  {
    id:'consumer_disc', nameKr:'임의소비재', emoji:'', color:'#57513f',
    etf:'XLY', etfName:'Consumer Disc',
    leaders:['AMZN','TSLA','HD','NKE','SBUX','TJX','BKNG','ABNB'],
    leaderHighlight:['AMZN','TSLA','BKNG','TJX'],
    subThemes:[
      { name:'이커머스', tickers:['AMZN','EBAY','ETSY','CPNG'] },
      { name:'EV/자동차', tickers:['TSLA','F','GM','RIVN'], etf:'LIT' },
      { name:'여행/레저', tickers:['BKNG','ABNB','MAR','HLT'], etf:'JETS' },
      { name:'리테일', tickers:['HD','NKE','TJX','SBUX','LULU'] },
      { name:'플랫폼/딜리버리', tickers:['UBER','DASH','CPNG'] }
    ]
  },
  {
    id:'materials', nameKr:'원자재', emoji:'', color:'#22754c',
    etf:'XLB', etfName:'Materials',
    leaders:['LIN','ECL','IFF','CTVA','ADM','FCX','NEM','APD'],
    leaderHighlight:['LIN','FCX','NEM','APD'],
    subThemes:[
      { name:'산업가스', tickers:['LIN','APD'] },
      { name:'광업/금속', tickers:['FCX','NEM','AA'], etf:'GDX' },
      { name:'농업/화학', tickers:['CTVA','ADM','IFF','ECL'] },
      { name:'전략 광물', tickers:['MP','LAC','ALB'] }
    ]
  },
  {
    id:'comm', nameKr:'통신서비스', emoji:'', color:'#211d16',
    etf:'XLC', etfName:'Comm Services',
    leaders:['META','GOOGL','NFLX','DIS','T','VZ','TMUS'],
    leaderHighlight:['META','GOOGL','NFLX','TMUS'],
    subThemes:[
      { name:'빅테크/광고', tickers:['META','GOOGL'] },
      { name:'스트리밍', tickers:['NFLX','DIS','PSKY'] },
      { name:'통신사', tickers:['T','VZ','TMUS'] }
    ]
  },
  {
    id:'photonics', nameKr:'광통신/포토닉스', emoji:'', color:'#8a8271',
    etf:null, etfName:'(커스텀 합산)',
    leaders:['LITE','COHR','AVGO','GLW','CIEN','AAOI','VIAV','ANET','MRVL'],
    leaderHighlight:['LITE','COHR','CIEN','AAOI'],
    weights:{LITE:18,COHR:16,CIEN:14,AVGO:12,AAOI:10,GLW:8,ANET:8,MRVL:8,VIAV:6},
    subThemes:[
      { name:'광부품/장비', tickers:['LITE','COHR','AAOI','VIAV'] },
      { name:'광섬유/네트워크', tickers:['CIEN','GLW','ANET'] },
      { name:'광전자 플랫폼', tickers:['AVGO','MRVL'] }
    ],
    isComposite: true
  },
  {
    id:'crypto', nameKr:'크립토/블록체인', emoji:'', color:'var(--data-amber)',
    etf:null, etfName:'(BTC-USD 기준)',
    leaders:['COIN','MARA','RIOT','MSTR','HOOD'],
    leaderHighlight:['COIN','MSTR','MARA','HOOD'],
    weights:{COIN:25,MSTR:22,MARA:18,HOOD:18,RIOT:17},
    subThemes:[
      { name:'거래소/핀테크', tickers:['COIN','HOOD'] },
      { name:'채굴', tickers:['MARA','RIOT','CLSK'] },
      { name:'BTC 보유', tickers:['MSTR'] },
      { name:'BTC ETF', tickers:['IBIT','BITO'] }
    ],
    compositeBase: 'BTC-USD'
  },
  {
    id:'ai_infra', nameKr:'AI 인프라/데이터센터', emoji:'', color:'var(--data-purple)',
    etf:null, etfName:'(커스텀 합산)',
    leaders:['NVDA','AVGO','AMD','ANET','VRT','ALAB','CRDO','MRVL','APH','CLS','EME','SMCI','DELL','HPE','ETN'],
    leaderHighlight:['NVDA','VRT','ANET','ALAB'],
    weights:{NVDA:18,AVGO:12,ANET:10,VRT:8,AMD:8,ALAB:7,CRDO:6,MRVL:5,APH:5,CLS:4,EME:4,SMCI:4,DELL:3,HPE:3,ETN:3},
    subThemes:[
      { name:'AI 칩/가속기', tickers:['NVDA','AMD','AVGO'] },
      { name:'에이전트 인프라(CPU)', tickers:['AMD','INTC','ARM','AVGO'] },
      { name:'서버/HW', tickers:['SMCI','DELL','HPE','CLS'] },
      { name:'냉각/전력', tickers:['VRT','ETN'] },
      { name:'네트워킹', tickers:['ANET','CSCO','ALAB','CRDO','MRVL'] },
      { name:'DC 건설/커넥터', tickers:['APH','EME'] }
    ],
    isComposite: true
  },
  {
    id:'robotics', nameKr:'로보틱스/자동화', emoji:'', color:'#211d16',
    etf:'BOTZ', etfName:'Global Robotics',
    leaders:['ISRG','ROK','TER','FANUY','ABB'],
    leaderHighlight:['ISRG','ROK','TER'],
    subThemes:[
      { name:'수술 로봇', tickers:['ISRG','MASI'] },
      { name:'산업 자동화', tickers:['ROK','ABB','EMR','PATH'] },
      { name:'테스트/검사', tickers:['TER','KEYS'] },
      { name:'AI/휴머노이드', tickers:['TSLA','FANUY'] }
    ]
  }
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
var _rsLastCalc = 0;

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

// ══════════════════════════════════════════════════════════════════
//  핫/이머징 테마 감지
// ══════════════════════════════════════════════════════════════════
function detectHotThemes() {
  var results = [];
  THEME_MAP.forEach(function(theme) {
    var perf = getThemePerf(theme);
    var breadth = calcSectorBreadth(theme.leaders);
    var hasPerf = perf.chgPct != null && isFinite(perf.chgPct);
    var rs = theme.etf ? calcLiveRS(theme.etf) : { rsRatio: null, rsMom: null, quadrant: 'unknown', reason: 'theme_etf_missing' };
    var complete = hasPerf && breadth !== null && perf.quality !== 'missing';
    results.push({
      theme: theme,
      perf: perf.chgPct,
      perfMeta: perf,
      breadth: breadth,
      rsRatio: rs.rsRatio,
      rsMom: rs.rsMom,
      quadrant: rs.quadrant,
      score: complete ? perf.chgPct * 2 + (breadth - 50) * 0.05 + (rs.rsRatio !== null ? (rs.rsRatio - 100) * 0.3 : 0) : -999,
      complete: complete
    });
  });
  results.sort(function(a,b) { return b.score - a.score; });
  return results;
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
  var cx = W/2, cy = H/2;
  // Leading (right-top) = green
  ctx.fillStyle = 'rgba(34,117,76,0.08)'; ctx.fillRect(cx, 0, W/2, cy);
  // Improving (left-top) = cyan
  ctx.fillStyle = 'rgba(33,29,22,0.08)'; ctx.fillRect(0, 0, cx, cy);
  // Weakening (right-bottom) = amber
  ctx.fillStyle = 'rgba(33,29,22,0.06)'; ctx.fillRect(cx, cy, W/2, H/2);
  // Lagging (left-bottom) = red
  ctx.fillStyle = 'rgba(177,58,48,0.06)'; ctx.fillRect(0, cy, cx, H/2);

  // v48.43: Grid lines — 토큰 기반
  ctx.strokeStyle = 'rgba(33,29,22,0.10)'; ctx.lineWidth = 1;
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
  ctx.fillStyle = '#211d16'; ctx.textAlign = 'center'; ctx.fillText('개선 Improving', W/4, 22);
  ctx.fillStyle = '#211d16'; ctx.textAlign = 'center'; ctx.fillText('약화 Weakening', W*3/4, H-14);
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
                    pos.q === 'Improving' ? 'rgba(33,29,22,0.3)' :
                    pos.q === 'Weakening' ? 'rgba(33,29,22,0.3)' : 'rgba(177,58,48,0.3)';
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
    txt += '선도:' + lc + ' 개선:' + ic + ' 약화:' + wc + ' 후행:' + lac;
    // v39.2: 시장 건강도 요약 판단
    var healthRatio = (lc + ic) / Math.max(lc + ic + wc + lac, 1);
    if (healthRatio >= 0.6) txt += ' · 건강한 로테이션';
    else if (healthRatio <= 0.3) txt += ' · 약세 주도 ';
    else txt += ' · 혼재 (방향 탐색 중)';
    st.textContent = txt;
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

  // v46.3: Stooq 폴백 — Yahoo 5일 차트 실패 시
  var _noSt = {'^GSPC':1,'^DJI':1,'^IXIC':1,'^RUT':1,'^VIX':1,'^VVIX':1,'^TNX':1,'^TYX':1,'^IRX':1,'^FVX':1};
  if (!_noSt[sym] && !sym.endsWith('.KS') && !sym.endsWith('.KQ') && !sym.includes('=X')) {
    var stSym = null;
    if (sym === 'CL=F') stSym = 'cl.f';
    else if (sym === 'BZ=F') stSym = 'bz.f';
    else if (sym === 'GC=F') stSym = 'gc.f';
    else if (sym === 'DX-Y.NYB') stSym = 'dx.f';
    else if (sym.includes('=F')) stSym = null; // 지수 선물 Stooq 미지원
    else { var _cl = sym.replace(/[^A-Z0-9]/gi,''); if (_cl.length >= 1 && _cl.length <= 5) stSym = _cl.toLowerCase() + '.us'; }
    if (stSym) {
    try {
      var stUrl = 'https://stooq.com/q/l/?s=' + stSym + '&f=sd2t2ohlcv&h&e=csv';
      var stR;
      try { stR = await fetchWithTimeout(stUrl, {}, 5000); } catch(e2) { stR = await fetchViaProxy(stUrl, 6000); }
      if (stR && stR.ok) {
        var stTxt = await stR.text();
        if (stTxt.startsWith('{')) try { stTxt = JSON.parse(stTxt).contents || stTxt; } catch(e3){}
        var cols = stTxt.trim().split('\n')[1];
        if (cols) {
          var c = cols.split(',');
          if (c.length >= 8 && c[1] !== 'N/D') {
            var stOpen = parseFloat(c[4]), stClose = parseFloat(c[7]);
            if (stOpen > 0 && stClose > 0) return ((stClose - stOpen) / stOpen) * 100; // 당일 시가→종가 (1주 근사)
          }
        }
      }
    } catch(e4) {}
    } // if (stSym)
  } // if (!_noSt)
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

async function _loadSector20dChart() {
  var statusEl = document.getElementById('sector-20d-status');
  if (statusEl) statusEl.textContent = '데이터 수집 중...';
  var sectorETFs = [
    {sym:'XLK',name:'기술',color:'var(--data-cyan)'}, {sym:'XLE',name:'에너지',color:'var(--data-red)'},
    {sym:'XLF',name:'금융',color:'var(--data-green)'}, {sym:'XLV',name:'헬스',color:'var(--data-purple)'},
    {sym:'XLI',name:'산업',color:'var(--data-amber)'}
  ];
  var datasets = [];
  var labels = null;
  var fallbackUsed = false;
  for (var i = 0; i < sectorETFs.length; i++) {
    var etf = sectorETFs[i];
    try {
      var data = await _fetchYahooChartData(etf.sym, '1mo');
      if (data && data.closes && data.closes.length >= 5) {
        var closes = data.closes.slice(-20).filter(function(v) { return v != null && isFinite(v) && v > 0; });
        var ts = data.timestamps.slice(-20);
        // 수익률 기준으로 정규화 (첫날 = 0%)
        var base = closes[0];
        if (!isFinite(base) || base <= 0) continue;
        var pctData = closes.map(function(c) { return ((c - base) / base * 100); });
        if (!labels) {
          labels = ts.map(function(t) {
            var d = new Date(t * 1000);
            return (d.getMonth()+1) + '/' + d.getDate();
          });
        }
        datasets.push({
          label: etf.name + '(' + etf.sym + ')', data: pctData,
          borderColor: etf.color, borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false
        });
      }
    } catch(e) { _aioLog('warn', 'fetch', 'Sector 20d error: ' + etf.sym + ' ' + e.message); }
  }
  if (!labels || datasets.length === 0) {
    if (statusEl) statusEl.textContent = '실시간 수집 실패 · 정적 대체 곡선 미사용';
    var emptyCanvas = document.getElementById('sector-20d-chart');
    if (emptyCanvas && typeof _showChartFallback === 'function') {
      _showChartFallback(emptyCanvas, 'Sector 20D', '라이브 차트 데이터 부족 · 정적 곡선은 현재 분석에 쓰지 않음');
    }
    return;
  }
  var canvas = document.getElementById('sector-20d-chart');
  if (!canvas) return;
  if (_sector20dChart) _sector20dChart.destroy();
  _sector20dChart = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { grid: { color: 'var(--surface-4)' }, ticks: { color: '#8a8271', font: { size: 11 }, callback: function(v) { return v.toFixed(1) + '%'; } } },
        x: { grid: { display: false }, ticks: { color: '#8a8271', font: { size: 11 }, maxTicksLimit: 8 } }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#8a8271', font: { size: 11 }, boxWidth: 12, padding: 8 } },
        annotation: { annotations: { zeroLine: { type: 'line', yMin: 0, yMax: 0, borderColor: 'rgba(33,29,22,0.2)', borderWidth: 1, borderDash: [4,4] } } }
      }
    }
  });
  if (statusEl) statusEl.textContent = '갱신: ' + new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
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
        '<div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(33,29,22,0.1);"></div>' +
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
  // P802: normalized themes owns the bounded sector-performance narrative.
  if (!el || el.dataset.aioThemePerformanceRenderer === 'native' || !sectors || sectors.length === 0) return; // v46.9: 빈 배열 방어
  var validSectors = sectors.filter(function(s) { return s && s.chg != null && isFinite(s.chg); });
  if (validSectors.length === 0) {
    el.innerHTML = '섹터 시세가 아직 최신으로 수신되지 않았습니다. 정적 fallback 수익률은 현재 랭킹/판단에 쓰지 않습니다.';
    return;
  }

  var best = validSectors[0];
  var worst = validSectors[validSectors.length-1];
  var defensive = ['XLE','XLP','XLU','XLV'];
  var cyclical = ['XLK','XLY','XLF','XLI','XLRE'];
  // v38.5: 경기 사이클 매핑 (섹터 → 사이클 국면)
  var earlyRecovery = ['XLF','XLY','XLRE','XLI'];  // 초기회복: 금융·소비재·부동산·산업
  var expansion = ['XLK','XLY','XLI','XLB'];         // 확장기: 기술·소비재·산업·소재
  var lateCycle = ['XLE','XLB','XLI'];                // 둔화기: 에너지·소재·산업
  var recession = ['XLP','XLU','XLV'];                // 침체기: 필수소비·유틸·헬스케어

  var defCount = 0, cycCount = 0;
  var leadingSectors = [], improvingSectors = [], weakeningSectors = [], laggingSectors = [];
  validSectors.slice(0, 4).forEach(function(s) {
    if (defensive.indexOf(s.sym) !== -1) defCount++;
    if (cyclical.indexOf(s.sym) !== -1) cycCount++;
  });
  sectors.forEach(function(s) {
    if (s.q === 'Leading') leadingSectors.push(s.sym);
    if (s.q === 'Improving') improvingSectors.push(s.sym);
    if (s.q === 'Weakening') weakeningSectors.push(s.sym);
    if (s.q === 'Lagging') laggingSectors.push(s.sym);
  });

  // v45.5: null chg 방어 — 1주 모드에서 fetch 미완료 시 크래시 방지
  var _bestChg = (best && best.chg != null) ? best.chg : 0;
  var _worstChg = (worst && worst.chg != null) ? worst.chg : 0;
  var text = '';
  text += '최강: <b style="color:var(--data-green);">' + best.name + '(' + best.sym + ') ' + (_bestChg>=0?'+':'') + _bestChg.toFixed(2) + '%</b> · ';
  text += '최약: <b style="color:var(--data-red);">' + worst.name + '(' + worst.sym + ') ' + _worstChg.toFixed(2) + '%</b>';

  if (leadingSectors.length > 0) {
    text += '<br><span style="color:var(--data-green);font-size:11px;">선도:</span> <b style="color:var(--data-green);font-size:11px;">' + leadingSectors.join(', ') + '</b>';
  }
  if (improvingSectors.length > 0) {
    text += ' <span style="color:var(--data-cyan);font-size:11px;">개선:</span> <b style="color:var(--data-cyan);font-size:11px;">' + improvingSectors.join(', ') + '</b>';
  }

  if (defCount >= 3) {
    text += '<br><b style="color:var(--data-red);">방어 섹터 상위 독점</b> — 리스크오프 심화. 돈이 "안전한 곳"으로 도망 중. ';
    text += '인과 체인: 불확실성↑ → 성장주 매도 → 배당·안정 섹터 매수 → 경기 후반 신호. ';
    text += '성장주 축소, 현금·방어주 확대 고려.';
  } else if (cycCount >= 3) {
    text += '<br><b style="color:var(--data-green);">성장 섹터 주도</b> — 리스크온. 시장이 "미래가 밝다"에 베팅 중. ';
    text += '특히 금융(XLF) 강세는 신용 확장 신호 — 은행이 잘되면 대출↑ 경제 성장↑ 선순환.';
  } else {
    text += '<br><b style="color:var(--data-amber);">혼재된 리더십</b> — 방향성 탐색 구간. 방어주도 성장주도 확실한 주도권을 못 잡고 있습니다. ';
    text += '이런 "과도기"에서는 포지션을 줄이고 주도 섹터가 확정될 때까지 관망이 현명합니다.';
  }

  // v38.5: 섹터 로테이션 시계 (경기 사이클 위치 추정)
  var earlyScore = 0, expScore = 0, lateScore = 0, recScore = 0;
  validSectors.slice(0, 5).forEach(function(s) {
    if (earlyRecovery.indexOf(s.sym) !== -1) earlyScore++;
    if (expansion.indexOf(s.sym) !== -1) expScore++;
    if (lateCycle.indexOf(s.sym) !== -1) lateScore++;
    if (recession.indexOf(s.sym) !== -1) recScore++;
  });
  var cyclePhase, cycleColor, cycleFavored;
  if (recScore >= 2 && defCount >= 2) {
    cyclePhase = '침체/둔화기'; cycleColor = 'var(--data-red)';
    cycleFavored = '필수소비(XLP), 헬스케어(XLV), 유틸리티(XLU), 금(GDX)';
  } else if (lateScore >= 2) {
    cyclePhase = '경기 후반(Late Cycle)'; cycleColor = 'var(--data-amber)';
    cycleFavored = '에너지(XLE), 소재(XLB), 고배당주, 원자재';
  } else if (expScore >= 2) {
    cyclePhase = '확장기(Expansion)'; cycleColor = 'var(--data-green)';
    cycleFavored = '기술(XLK), 소비재(XLY), 산업재(XLI), 소형주';
  } else if (earlyScore >= 2) {
    cyclePhase = '초기 회복(Early Recovery)'; cycleColor = 'var(--data-cyan)';
    cycleFavored = '금융(XLF), 부동산(XLRE), 소비재(XLY), 소형주';
  } else {
    cyclePhase = '과도기(Transition)'; cycleColor = 'var(--data-amber)';
    cycleFavored = '현금 + 핵심 대형주 중심 방어';
  }
  text += '<br><br><b>【섹터 로테이션 시계】</b> 추정 국면: <b style="color:' + cycleColor + ';">' + cyclePhase + '</b>';
  text += '<br><span style="font-size:11px;">현 국면 유리 섹터: ' + cycleFavored + '</span>';
  text += '<br><span style="font-size:10px;color:var(--text-muted);">산출: 상위 5개 섹터의 경기 사이클 분류 기반 추정 (earlyRec:' + earlyScore + ' exp:' + expScore + ' late:' + lateScore + ' rec:' + recScore + ')</span>';

  // v38.5: 섹터간 상관 깨짐 감지
  // 통상 같이 움직이는 쌍: XLK-SMH(반도체), XLF-XLRE(금리민감), XLE-XOP(에너지체인), XLP-XLV(방어)
  var correlatedPairs = [
    { a: 'XLK', b: 'SMH', label: '기술-반도체' },
    { a: 'XLF', b: 'XLRE', label: '금융-부동산' },
    { a: 'XLE', b: 'XOP', label: '에너지-E&P' },
    { a: 'XLP', b: 'XLV', label: '필수소비-헬스케어' }
  ];
  var sectorChgMap = {};
  // v45.5: null chg 제외 (1주 모드 fetch 미완료 대응)
  sectors.forEach(function(s) { if (s.chg != null) sectorChgMap[s.sym] = s.chg; });
  // RRG_SUBSECTORS에서도 가져오기
  let ld = window._liveData || {};
  ['SMH','XOP'].forEach(function(sym) {
    if (ld[sym] && ld[sym].pct != null) sectorChgMap[sym] = ld[sym].pct;
  });
  var divergences = [];
  correlatedPairs.forEach(function(pair) {
    var chgA = sectorChgMap[pair.a], chgB = sectorChgMap[pair.b];
    if (chgA != null && chgB != null) {
      var gap = Math.abs(chgA - chgB);
      if (gap > 2.0) {
        divergences.push({ label: pair.label, a: pair.a, chgA: chgA, b: pair.b, chgB: chgB, gap: gap });
      }
    }
  });
  if (divergences.length > 0) {
    text += '<br><br><b>【섹터간 상관 깨짐 감지】</b> <span style="font-size:10px;color:var(--text-muted);">통상 동조 섹터 쌍의 괴리 >2%p</span>';
    divergences.forEach(function(dv) {
      text += '<br><span style="color:var(--yellow);font-size:11px;"><b>' + dv.label + '</b> 괴리: ' + dv.a + ' ' + (dv.chgA >= 0 ? '+' : '') + dv.chgA.toFixed(1) + '% vs ' + dv.b + ' ' + (dv.chgB >= 0 ? '+' : '') + dv.chgB.toFixed(1) + '% (갭 ' + dv.gap.toFixed(1) + '%p) — 구조적 변화 시그널. 괴리 원인 분석 필요.</span>';
    });
  }

  // v38.5: 방어/공격 밸런스 지표 (v45.5: null chg 제외)
  var defChgSum = 0, defN = 0, atkChgSum = 0, atkN = 0;
  sectors.forEach(function(s) {
    if (s.chg == null) return;
    if (defensive.indexOf(s.sym) !== -1) { defChgSum += s.chg; defN++; }
    if (cyclical.indexOf(s.sym) !== -1) { atkChgSum += s.chg; atkN++; }
  });
  if (defN > 0 && atkN > 0) {
    var defAvg = defChgSum / defN;
    var atkAvg = atkChgSum / atkN;
    var balanceRatio = atkAvg !== 0 ? (defAvg / atkAvg) : 0;
    text += '<br><br><b>【방어/공격 밸런스】</b> ';
    text += '방어섹터 평균 ' + (defAvg >= 0 ? '+' : '') + defAvg.toFixed(2) + '% / 성장섹터 평균 ' + (atkAvg >= 0 ? '+' : '') + atkAvg.toFixed(2) + '%';
    if (defAvg > 0 && atkAvg < 0) {
      text += '<br><span style="color:var(--data-red);font-weight:700;">Risk-Off 확실. 방어섹터 상승 + 성장섹터 하락 = 자금이 안전자산으로 이동 중. 공격적 포지션 축소, 현금·채권·금 비중 확대.</span>';
    } else if (defAvg < 0 && atkAvg > 0) {
      text += '<br><span style="color:var(--data-green);font-weight:700;">Risk-On 확실. 성장섹터가 방어섹터 아웃퍼폼. 모멘텀 팔로우 전략 유효. 기술·소비재·금융 매수 확대 구간.</span>';
    } else if (defAvg > atkAvg && defAvg > 0) {
      text += '<br><span style="color:var(--data-amber);">방어 우위. 시장 전반 상승이나 방어주가 더 강함 → 불확실성 잔존. 균형 포트폴리오 유지.</span>';
    } else if (atkAvg > defAvg && atkAvg > 0) {
      text += '<br><span style="color:var(--data-green);">성장 우위. 리스크 선호 분위기. 성장주 모멘텀 추종 유효.</span>';
    } else {
      text += '<br><span style="color:var(--data-amber);">양 측 모두 약세. 시장 전반 매도 압력. 현금 비중 확대, 반등 시그널 대기.</span>';
    }
  }

  // 브레드스 요약
  var breadthGood = 0, breadthBad = 0;
  RRG_SECTORS.forEach(function(sec) {
    var b = calcSectorBreadth(THEME_MAP.filter(function(t){ return t.etf === sec.sym; }).length > 0 ?
      THEME_MAP.filter(function(t){ return t.etf === sec.sym; })[0].leaders : [sec.sym]);
    if (b > 60) breadthGood++;
    if (b < 40) breadthBad++;
  });
  if (breadthGood > 6) text += '<br><span style="font-size:11px;color:var(--data-green);">시장 브레드스 양호 — 다수 섹터 양봉 우세</span>';
  else if (breadthBad > 6) text += '<br><span style="font-size:11px;color:var(--data-red);">시장 브레드스 악화 — 다수 섹터 음봉 우세</span>';

  // v52.7 P606/R276: 섹터 리더십(defCount/cycCount) 독립 집계 대신 _aioRenderThemesCycle과 동일한
  // 단일 사이클 소스(marketState.cycleFull → getCycleFromMacro)를 읽어 본문 "동적 사이클 판정"과의
  // 모순(예: 칩 "Late Cycle" vs 본문 "Mid Cycle")을 구조적으로 제거.
  var pill = document.querySelector('[id="theme-cycle-pill"]');
  // P801: the RRG-derived cycle pill is native; legacy sector prose must not overwrite it.
  if (pill && pill.dataset.aioThemeCycleRenderer !== 'native') {
    var _rrgEvidenceCount = RRG_SECTORS.filter(function(sec) {
      var read = calcLiveRS(sec.sym);
      return read && read.quadrant !== 'unknown' && read.rsRatio !== null && read.rsMom !== null;
    }).length;
    if (_rrgEvidenceCount < 6) {
      pill.className = 'status-pill sp-neutral';
      pill.textContent = '사이클 판정 보류 · RRG 근거 ' + _rrgEvidenceCount + '/11';
      el.innerHTML = text;
      return;
    }
    var _cycPill = null;
    try {
      var _msPill = window.AIO && window.AIO.marketState;
      if (_msPill && _msPill.cycleFull && (Date.now() - (_msPill.ts || 0) < 15 * 60 * 1000)) _cycPill = _msPill.cycleFull;
      else if (window.AIO && window.AIO.getCycleFromMacro) _cycPill = window.AIO.getCycleFromMacro({});
    } catch (_ePill) { _cycPill = null; }
    var _phasePill = _cycPill && _cycPill.phase;
    if (_phasePill === 'Late Cycle (Peak)' || _phasePill === 'Recession Risk' || _phasePill === 'Bear Market') {
      pill.className = 'status-pill sp-risk-off';
      pill.textContent = ' ' + _phasePill + ' · 방어 주도';
    } else if (_phasePill === 'Mid Cycle (Expansion)' || _phasePill === 'Early Cycle (Recovery)') {
      pill.className = 'status-pill sp-risk-on';
      pill.textContent = ' ' + _phasePill + ' · 성장 주도';
    } else {
      pill.className = 'status-pill sp-neutral';
      pill.textContent = _phasePill ? ' ' + _phasePill : ' Transition';
    }
  }

  el.innerHTML = text;
}

// ═══════════════════════════════════════════════════════════════
//  테마 히트맵 & 핫 테마 패널 동적 렌더
// ═══════════════════════════════════════════════════════════════
var _themeHeatmapRetries = 0;
function renderThemeHeatmap() {
  let ld = window._liveData || {};
  if (Object.keys(ld).length < 5) {
    _themeHeatmapRetries++;
    if (_themeHeatmapRetries < 60) {
      setTimeout(renderThemeHeatmap, 500);
      return;
    }
    _aioLog('warn', 'render', '테마 히트맵: 라이브 데이터 30초 초과 — 정적 현재값 대체 금지');
  }
  var container = document.getElementById('theme-heatmap');
  if (!container) return;
  var results = detectHotThemes();

  // If no results yet, show placeholder
  if (!results || results.length === 0) {
    container.innerHTML = '<div style="grid-column:span 4;text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">테마 데이터 준비 중…</div>';
    return;
  }

  var html = '';
  results.forEach(function(r) {
    var theme = r.theme;
    var chg = r.perf;
    var hasPerf = chg != null && isFinite(chg);
    var isPos = hasPerf && chg >= 0;
    var bgIntensity = hasPerf ? Math.min(Math.abs(chg) * 8, 30) : 0;
    var bgColor = hasPerf ? (isPos ? 'rgba(34,117,76,' + (bgIntensity/100) + ')' : 'rgba(177,58,48,' + (bgIntensity/100) + ')') : 'rgba(33,29,22,0.08)';
    var chgColor = hasPerf ? (isPos ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var qLabel = !hasPerf ? '대기' : r.quadrant === 'Leading' ? '선도' : r.quadrant === 'Improving' ? '개선' : r.quadrant === 'Weakening' ? '약화' : '후행';
    var qColor = !hasPerf ? 'var(--text-muted)' : r.quadrant === 'Leading' ? 'var(--data-green)' : r.quadrant === 'Improving' ? 'var(--data-cyan)' : r.quadrant === 'Weakening' ? 'var(--data-amber)' : 'var(--data-red)';
    var perfMeta = r.perfMeta || {};
    var coverageLabel = perfMeta.count != null && perfMeta.total ? perfMeta.count + '/' + perfMeta.total : '';

    html += '<div class="aio-hover-scale" data-action="showThemeDetail" data-arg="' + escHtml(theme.id) + '" style="background:' + bgColor + ';border:1px solid rgba(33,29,22,0.06);border-radius:4px;padding:8px;cursor:pointer;transition:transform var(--dur-fast);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">' +
        '<span style="font-size:10px;font-weight:800;">' + theme.nameKr + '</span>' +
        '<span style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:' + chgColor + ';">' + (hasPerf ? ((isPos?'+':'') + chg.toFixed(2) + '%') : 'LIVE') + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:11px;color:var(--text-muted);">' + (hasPerf ? (theme.etf || '합산') : '수집 대기') + (coverageLabel ? ' · ' + coverageLabel : '') + '</span>' +
        '<span style="font-size:10px;color:' + qColor + ';font-weight:700;">● ' + qLabel + '</span>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        theme.leaderHighlight.slice(0,4).map(function(t){return '<span data-action="showTicker" data-arg="'+t+'" data-stop="1" style="cursor:pointer;color:var(--accent);font-family:var(--font-mono);font-weight:700;" title="'+t+' 분석 →">'+t+'</span>';}).join('<span style="color:var(--surface-5);"> · </span>') +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
//  테마 상세 패널 (서브테마 + 대장주 + 라이브 가격)
// ═══════════════════════════════════════════════════════════════
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
    perf = { chgPct: comp.chgPct, source: st.weights ? 'ETF가중(' + comp.count + ')' : '합산(' + comp.count + ')' };
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
        '<span style="font-size:11px;color:' + (breadth>50?'var(--data-green)':'var(--data-red)') + ';font-weight:700;">' + breadth + '% 양봉</span>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">상승 ' + above + ' · 보합 ' + flat + ' · 하락 ' + below + ' / ' + totalValid + '종목</div>' +
    '</div>';
  }

  // ── 심층 분석 ──
  html += '<div style="margin-top:10px;padding:14px;background:rgba(33,29,22,0.05);border:1px solid rgba(33,29,22,0.15);border-radius:4px;">';
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
    sections.push('<b>핵심 매크로 변수 [' + sti.macroKey + ']:</b> ' + sti.upCondition);
    sections.push('<b>깨지는 신호:</b> ' + sti.breakSignal);
    sections.push('<b>비직관적 인사이트:</b> ' + sti.insight);
  } else {
    sections.push('• 이 테마의 핵심 매크로 변수와 깨지는 신호를 AI 분석에서 확인해보세요.');
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
    var _staleBadge = ' <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:3px;margin-left:6px;background:' + (_snIsStale ? 'rgba(177,58,48,0.15);color:var(--data-red);border:1px solid rgba(177,58,48,0.3)' : 'rgba(33,29,22,0.1);color:var(--data-cyan);border:1px solid rgba(33,29,22,0.2)') + ';">' + (_snIsStale ? 'STALE ' : '') + (THEME_NARRATIVES_META && THEME_NARRATIVES_META.lastUpdated || 'N/A') + ' · 경과 ' + _snStaleDays + '일</span>';

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
//  ALL-ETF GRID 렌더 (섹터+서브 ETF 전체 시세)
// ═══════════════════════════════════════════════════════════════
// v48.57: 무한 재귀 가드 — 60회(30초) 재시도 후 폴백 메시지
window._renderAllEtfGridRetries = 0;
function renderAllEtfGrid() {
  let ld = window._liveData || {};
  if (Object.keys(ld).length < 5) {
    if (++window._renderAllEtfGridRetries > 60) {
      var fallbackEl = document.getElementById('all-etf-grid');
      if (fallbackEl) fallbackEl.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-muted);font-size:11px;">ETF 시세 수신 실패 · API 키 확인 필요 (Settings)</div>';
      return;
    }
    setTimeout(renderAllEtfGrid, 500);
    return;
  }
  window._renderAllEtfGridRetries = 0;
  var container = document.getElementById('all-etf-grid');
  if (!container) return;
  var allEtfs = ALL_RRG_ETFS;
  var html = '';
  allEtfs.forEach(function(e) {
    var d = ld[e.sym];
    var chg = d && d.pct != null ? d.pct : null;
    var price = d ? (d.price||0) : 0;
    var isPos = chg !== null ? chg >= 0 : true;
    var col = chg !== null ? (isPos ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var bg = isPos ? 'rgba(34,117,76,0.06)' : 'rgba(177,58,48,0.06)';
    html += '<div style="background:' + bg + ';border:1px solid var(--surface-4);border-radius:3px;padding:5px;text-align:center;cursor:pointer;" data-action="showThemeByEtf" data-arg="' + escHtml(e.sym) + '">' +
      '<div style="font-size:12px;font-weight:800;font-family:var(--font-mono);">' + e.sym + '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);">' + e.name + '</div>' +
      '<div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:' + col + ';">' + (chg !== null ? ((isPos?'+':'') + chg.toFixed(2) + '%') : '—') + '</div>' +
    '</div>';
  });
  container.innerHTML = html;
}

function showThemeByEtf(etfSym) {
  for (var i = 0; i < THEME_MAP.length; i++) {
    if (THEME_MAP[i].etf === etfSym) {
      showThemeDetail(THEME_MAP[i].id);
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  세분화 테마 (Sub-Themes) — 시장 핵심 트렌드 & 대장주
// ═══════════════════════════════════════════════════════════════
// 각 세분화 테마: 고유 색상, 대장주(리더), 관련 종목, 커스텀 합산
var SUB_THEMES = [
  // ═══ AI · 반도체 (9) ═══
  {id:'bigtech',name:'빅테크 M7',emoji:'',color:'var(--data-purple)',desc:'시장 시총 38% 메가캡 리더',leaders:['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA'],tickers:['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA'],etf:'QQQ',weights:{AAPL:18,MSFT:17,NVDA:16,AMZN:14,GOOGL:12,META:13,TSLA:10}},
  {id:'ai_chip',name:'AI 반도체/가속기',emoji:'',color:'#211d16',desc:'GPU·ASIC·커스텀 칩 경쟁',leaders:['NVDA','AMD','AVGO','ARM'],tickers:['NVDA','AMD','AVGO','ARM','QCOM','MRVL','SMCI'],etf:'SMH',weights:{NVDA:28,AVGO:16,AMD:14,QCOM:12,ARM:11,MRVL:10,SMCI:9}},
  {id:'memory',name:'메모리 반도체',emoji:'',color:'#211d16',desc:'HBM·DDR5·NAND SCA 슈퍼사이클 · SK하이닉스/삼성전자는 KRX 보통주(.KS) 기준',leaders:['MU','SNDK','000660.KS','STX'],tickers:['MU','SNDK','000660.KS','005930.KS','STX','WDC'],etf:null,weights:{MU:30,SNDK:25,'000660.KS':12,'005930.KS':8,STX:15,WDC:10}},
  {id:'semi_equip',name:'반도체 장비/EDA',emoji:'',color:'#22754c',desc:'EUV·증착·검사·설계자동화(EDA)',leaders:['ASML','AMAT','LRCX','KLAC'],tickers:['ASML','AMAT','LRCX','KLAC','TER','ONTO','ACLS','ENTG','UCTT','CDNS','SNPS'],etf:null,weights:{ASML:20,AMAT:16,LRCX:14,KLAC:12,CDNS:10,SNPS:10,TER:6,ONTO:4,ENTG:4,ACLS:2,UCTT:2}},
  {id:'foundry',name:'파운드리',emoji:'',color:'var(--text-muted)',desc:'첨단 파운드리(TSM) + 성숙 공정(UMC/GFS) + 종합반도체(INTC Foundry)',leaders:['TSM','INTC','GFS','UMC'],tickers:['TSM','INTC','UMC','GFS'],etf:null,weights:{TSM:44,INTC:22,UMC:18,GFS:16}},
  {id:'photonics',name:'광통신/포토닉스',emoji:'',color:'#8a8271',desc:'AI DC 광인터커넥트 폭증 · 레이저 병목(2025~2027) · 순수 광통신 플레이 (AVGO는 ai_chip 주력)',leaders:['LITE','COHR','CIEN','AAOI'],tickers:['LITE','COHR','CIEN','AAOI','GLW','VIAV','ANET','MRVL','POET'],etf:null,weights:{LITE:24,COHR:22,CIEN:16,AAOI:10,GLW:8,ANET:8,MRVL:5,VIAV:4,POET:3}},
  {id:'dc_network',name:'DC 네트워킹',emoji:'',color:'#211d16',desc:'DC 초고속 연결·CXL·이더넷 (AVGO는 ai_chip 주력으로 비중 축소)',leaders:['ALAB','CRDO','ANET','CSCO'],tickers:['ALAB','CRDO','ANET','CSCO','MRVL','AVGO'],etf:null,weights:{ALAB:24,CRDO:22,ANET:18,CSCO:18,MRVL:10,AVGO:8}},
  {id:'dc_infra',name:'DC 인프라/전력·냉각',emoji:'',color:'#57513f',desc:'AI DC 전력·냉각·서버 OEM · GPU TDP 700W→2300W · 800V DC 전환 (EQIX/DLR은 reit_dc)',leaders:['VRT','ETN','PWR','EME'],tickers:['VRT','ETN','PWR','EME','POWL','CLS','DELL','HPE','MOD','NVT'],etf:null,weights:{VRT:22,ETN:18,PWR:14,EME:12,POWL:8,CLS:8,DELL:6,HPE:5,MOD:4,NVT:3}},
  {id:'neocloud',name:'네오클라우드/AI호스팅',emoji:'',color:'#211d16',desc:'GPU 클라우드·채굴→AI 전환',leaders:['CRWV','IREN','CORZ','NBIS','WULF'],tickers:['CRWV','IREN','CORZ','NBIS','WULF','CIFR','CLSK','MARA'],etf:null,weights:{CRWV:24,IREN:18,CORZ:15,NBIS:14,WULF:10,CIFR:8,CLSK:6,MARA:5}},
  // ═══ SW · 클라우드 (3) ═══
  {id:'cloud_saas',name:'클라우드/SaaS',emoji:'',color:'#b13a30',desc:'엔터프라이즈 SaaS·디지털 전환',leaders:['CRM','NOW','ADBE','ORCL'],tickers:['CRM','NOW','ADBE','ORCL','INTU','WDAY','SNOW','DDOG','MDB'],etf:'IGV',weights:{CRM:16,NOW:14,ADBE:13,ORCL:12,INTU:10,WDAY:10,SNOW:9,DDOG:8,MDB:8}},
  {id:'ai_platform',name:'AI 플랫폼/에이전트',emoji:'',color:'var(--data-purple)',desc:'AI 플랫폼·에이전트·MLOps (C3.ai/PATH는 실적 부진으로 비중 축소)',leaders:['PLTR','DDOG','SNOW','TTD'],tickers:['PLTR','DDOG','SNOW','TTD','MDB','PATH','AI'],etf:null,weights:{PLTR:30,DDOG:18,SNOW:16,TTD:12,MDB:12,PATH:6,AI:6}},
  {id:'cybersec',name:'사이버보안',emoji:'',color:'var(--data-red)',desc:'AI 위협·제로트러스트 확산',leaders:['PANW','CRWD','ZS','FTNT'],tickers:['PANW','CRWD','ZS','FTNT','NET','S','CYBR'],etf:'HACK',weights:{PANW:20,CRWD:18,ZS:16,FTNT:14,NET:12,S:10,CYBR:10}},
  // ═══ 에너지 (7) ═══
  {id:'oil_major',name:'에너지 메이저/E&P',emoji:'',color:'var(--data-green)',desc:'통합 석유 메이저 + E&P 탐사생산 (정유는 oil_refine 분리)',leaders:['XOM','CVX','COP','EOG'],tickers:['XOM','CVX','COP','EOG','OXY','DVN','FANG','TPL'],etf:'XLE',weights:{XOM:22,CVX:17,COP:13,EOG:11,OXY:11,DVN:9,FANG:9,TPL:8}},
  {id:'oil_refine',name:'정유/다운스트림',emoji:'',color:'#8a8271',desc:'정유 마진·크랙 스프레드·유가 하락 수혜',leaders:['VLO','MPC','PSX'],tickers:['VLO','MPC','PSX','DINO','DK'],etf:'CRAK',weights:{VLO:38,MPC:30,PSX:22,DINO:6,DK:4}},
  {id:'oil_service',name:'오일서비스/시추',emoji:'',color:'#b13a30',desc:'시추·유정 서비스·장비',leaders:['SLB','HAL','BKR','FTI'],tickers:['SLB','HAL','BKR','FTI','NOV','WHD'],etf:'OIH',weights:{SLB:30,BKR:22,HAL:20,FTI:12,NOV:10,WHD:6}},
  {id:'mlp_pipe',name:'MLP/파이프라인',emoji:'',color:'#8a8271',desc:'천연가스 운송·배당 인컴',leaders:['WMB','TRGP','ET','KMI'],tickers:['WMB','TRGP','ET','KMI','EPD','OKE'],etf:'AMLP',weights:{WMB:20,TRGP:18,ET:18,KMI:16,EPD:14,OKE:14}},
  {id:'nuclear_util',name:'원전/원자력',emoji:'',color:'#22754c',desc:'AI 전력 수요·SMR·원전 부활 (NRG는 원전 비중 낮아 축소, NNE 추가)',leaders:['CEG','VST','CCJ','GEV','SMR'],tickers:['CEG','VST','NRG','CCJ','GEV','LEU','SMR','OKLO','BWXT','NNE'],etf:'URA',weights:{CCJ:16,CEG:15,GEV:15,VST:12,BWXT:9,LEU:8,SMR:8,OKLO:7,NRG:5,NNE:5}},
  {id:'solar_renew',name:'태양광/재생에너지',emoji:'',color:'var(--data-amber)',desc:'태양광·트래커·인버터 · IRA 개편 리스크 주의 (NEE는 grid_util)',leaders:['FSLR','ENPH','NXT'],tickers:['FSLR','ENPH','NXT','ARRY','SHLS','RUN','SEDG'],etf:'ICLN',weights:{FSLR:30,ENPH:28,NXT:18,ARRY:10,SHLS:6,RUN:5,SEDG:3}},
  {id:'hydrogen_ess',name:'수소/ESS',emoji:'',color:'#211d16',desc:'그린수소·연료전지·ESS (PLUG/FCEL 재무 위기 — leader 제외)',leaders:['FLNC','BE'],tickers:['FLNC','BE','PLUG','FCEL'],etf:null,weights:{FLNC:45,BE:30,PLUG:15,FCEL:10}},
  {id:'grid_util',name:'전력 유틸리티',emoji:'',color:'var(--data-cyan)',desc:'유틸리티·송배전·그리드 현대화',leaders:['NEE','DUK','AEP','EXC'],tickers:['NEE','DUK','AEP','EXC','ETR','ES','FE','EVRG','XEL','EIX'],etf:'XLU',weights:{NEE:18,DUK:14,AEP:12,EXC:11,ETR:9,ES:8,FE:8,EVRG:7,XEL:7,EIX:6}},
  // ═══ 금융 (5) ═══
  {id:'big_bank',name:'대형 은행',emoji:'',color:'var(--data-amber)',desc:'미국 6대 은행·금리 수혜',leaders:['JPM','GS','MS','BAC'],tickers:['JPM','GS','MS','BAC','WFC','C'],etf:'XLF',weights:{JPM:26,BAC:18,WFC:15,GS:15,MS:14,C:12}},
  {id:'asset_mgmt',name:'자산운용/PE',emoji:'',color:'#8a8271',desc:'대체투자·PE·자산운용',leaders:['BX','KKR','APO','BLK'],tickers:['BX','KKR','APO','BLK','SCHW'],etf:null,weights:{BLK:24,BX:20,KKR:20,APO:18,SCHW:18}},
  {id:'insurance',name:'보험',emoji:'',color:'#8a8271',desc:'손보·생보·재보험·금리 수혜',leaders:['BRK-B','PGR','ALL','MET'],tickers:['BRK-B','PGR','ALL','MET','TRV','CB'],etf:null,weights:{'BRK-B':28,PGR:18,TRV:14,CB:14,ALL:14,MET:12}},
  {id:'fintech_crypto',name:'핀테크/크립토',emoji:'',color:'var(--data-amber)',desc:'디지털 결제·거래소·스테이블코인 (마이닝주는 btc_etf 참조)',leaders:['COIN','HOOD','PYPL','XYZ'],tickers:['COIN','XYZ','PYPL','AFRM','SOFI','HOOD','MSTR','NU'],etf:null,weights:{COIN:18,PYPL:15,XYZ:13,HOOD:13,SOFI:12,NU:10,MSTR:10,AFRM:9},compositeBase:'BTC-USD'},
  {id:'btc_etf',name:'BTC 현물 ETF',emoji:'',color:'var(--data-amber)',desc:'비트코인 현물 ETF 순수 · 기관 유입 (MSTR/COIN은 fintech_crypto, MARA/CORZ는 neocloud)',leaders:['IBIT','FBTC','ARKB'],tickers:['IBIT','FBTC','ARKB','BITB','BITO','HODL'],etf:null,weights:{IBIT:40,FBTC:25,ARKB:12,BITB:10,BITO:8,HODL:5},compositeBase:'BTC-USD'},
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
  {id:'streaming',name:'스트리밍/미디어',emoji:'',color:'#211d16',desc:'OTT·콘텐츠 전쟁 · WBD(Max) 추가',leaders:['NFLX','DIS','SPOT','WBD'],tickers:['NFLX','DIS','WBD','SPOT','ROKU','PSKY'],etf:null,weights:{NFLX:38,DIS:20,SPOT:16,WBD:10,ROKU:10,PSKY:6}},
  {id:'social_ad',name:'소셜/디지털광고',emoji:'',color:'#b13a30',desc:'소셜미디어·디지털광고',leaders:['META','GOOGL','TTD','APP'],tickers:['META','GOOGL','TTD','APP','SNAP','PINS','RDDT'],etf:null,weights:{META:30,GOOGL:28,TTD:12,APP:10,SNAP:8,PINS:6,RDDT:6}},
  {id:'gaming',name:'게이밍/e스포츠',emoji:'',color:'#211d16',desc:'AAA 게임·e스포츠·메타버스 (스포츠 베팅은 sports_betting 분리)',leaders:['EA','TTWO','RBLX','NTDOY'],tickers:['EA','TTWO','RBLX','NTDOY'],etf:null,weights:{EA:32,TTWO:28,RBLX:24,NTDOY:16}},
  {id:'sports_betting',name:'스포츠 베팅/카지노',emoji:'',color:'#b13a30',desc:'온라인 스포츠 베팅·iGaming·카지노 리오프닝',leaders:['DKNG','FLUT','MGM'],tickers:['DKNG','FLUT','MGM','PENN','CZR','WYNN'],etf:null,weights:{DKNG:30,FLUT:25,MGM:15,PENN:10,CZR:10,WYNN:10}},
  {id:'telecom_us',name:'미국 통신',emoji:'',color:'var(--text-muted)',desc:'5G·광대역·ARPU · 무선통신 3사 (XLC는 META/GOOGL ETF라 IYZ로 교체)',leaders:['T','VZ','TMUS'],tickers:['T','VZ','TMUS'],etf:'IYZ',weights:{TMUS:38,T:30,VZ:32}},
  // ═══ 부동산 · 원자재 (3) ═══
  {id:'reit_dc',name:'디지털 인프라 리츠',emoji:'',color:'#211d16',desc:'DC 리츠(EQIX/DLR) + 통신타워 리츠(AMT/CCI/SBAC) · AI 인프라 임대',leaders:['EQIX','DLR','AMT'],tickers:['EQIX','DLR','AMT','CCI','SBAC'],etf:'XLRE',weights:{EQIX:28,DLR:22,AMT:20,CCI:16,SBAC:14}},
  {id:'gold_mining',name:'금/은 광산',emoji:'',color:'#8a8271',desc:'금값 사상최고·인플레 헷지',leaders:['AEM','NEM','GOLD','WPM'],tickers:['AEM','NEM','GOLD','WPM','FNV','GFI','KGC'],etf:'GDX',weights:{AEM:18,NEM:16,GOLD:16,WPM:14,FNV:14,GFI:12,KGC:10}},
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
  {id:'kr_semi_hbm',name:'반도체/HBM',emoji:'',color:'#211d16',desc:'HBM3E·HBM4 · NAND SCA 수혜 · 삼성/하이닉스 양강 (KOSPI .KS + KOSDAQ .KQ 정식)',leaders:['005930.KS','000660.KS','042700.KQ'],tickers:['005930.KS','000660.KS','042700.KQ','403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ'],etf:'091160.KS',weights:{'005930.KS':30,'000660.KS':30,'042700.KQ':12,'403870.KQ':8,'058470.KQ':6,'357780.KQ':6,'240810.KQ':4,'039030.KQ':4}},
  {id:'kr_robotics',name:'로봇/자동화',emoji:'',color:'#211d16',desc:'휴머노이드·산업 자동화·서빙로봇 · 두산로보틱스(KOSPI) + KOSDAQ 로봇 부품/플랫폼',leaders:['454910.KS','277810.KQ','108490.KQ'],tickers:['454910.KS','277810.KQ','108490.KQ','090360.KQ','388720.KQ','090710.KQ'],etf:null,weights:{'454910.KS':34,'277810.KQ':28,'108490.KQ':14,'090360.KQ':10,'388720.KQ':8,'090710.KQ':6}},
  {id:'kr_ai_sw',name:'AI/소프트웨어',emoji:'',color:'var(--data-purple)',desc:'HyperCLOVA X · AI 에이전트 · SaaS',leaders:['035420.KS','018260.KS','012510.KS'],tickers:['035420.KS','018260.KS','012510.KS','035720.KS','030520.KQ','304100.KQ'],etf:null,weights:{'035420.KS':28,'018260.KS':22,'035720.KS':20,'012510.KS':12,'030520.KQ':10,'304100.KQ':8}},
  {id:'kr_medtech',name:'의료기기/AI진단',emoji:'',color:'#8a8271',desc:'수술로봇·AI 영상진단·K-의료기기 (대부분 KOSDAQ)',leaders:['214150.KQ','328130.KQ','338220.KQ'],tickers:['214150.KQ','328130.KQ','338220.KQ','322510.KQ','049950.KQ','145720.KQ'],etf:null,weights:{'214150.KQ':28,'328130.KQ':24,'338220.KQ':18,'322510.KQ':12,'049950.KQ':10,'145720.KQ':8}},
  // ═══ 강세 그룹 (5) ═══
  {id:'kr_shipbuild',name:'조선/해양',emoji:'',color:'#211d16',desc:'LNG선·암모니아선 · 선가 상승 사이클',leaders:['009540.KS','010140.KS','329180.KS'],tickers:['009540.KS','010140.KS','329180.KS','042660.KS','010620.KS'],etf:null,weights:{'009540.KS':28,'329180.KS':25,'010140.KS':22,'042660.KS':15,'010620.KS':10}},
  {id:'kr_power_eq',name:'전력기기/변압기',emoji:'',color:'#57513f',desc:'AI DC 전력 수요 · 미국 그리드 교체 · 2024~25 한국장 주도',leaders:['298040.KS','267260.KS','010120.KS'],tickers:['298040.KS','267260.KS','010120.KS','062040.KS','033100.KQ','103590.KS'],etf:null,weights:{'298040.KS':26,'267260.KS':22,'010120.KS':20,'062040.KS':14,'033100.KQ':10,'103590.KS':8}},
  {id:'kr_nuclear',name:'원전/SMR',emoji:'',color:'#22754c',desc:'체코·폴란드 수주 · 미국 SMR 법안 · AI 전력 · 시공/정비 밸류체인 포함',leaders:['034020.KS','052690.KS','000720.KS'],tickers:['034020.KS','052690.KS','000720.KS','051600.KS','006910.KQ','032820.KQ','083650.KQ'],etf:null,weights:{'034020.KS':32,'052690.KS':20,'000720.KS':16,'051600.KS':12,'006910.KQ':8,'032820.KQ':7,'083650.KQ':5}},
  {id:'kr_kbeauty',name:'K-뷰티',emoji:'',color:'#211d16',desc:'미국·일본·인도 확장 · 인디브랜드 수출 폭증 · 에이피알(APR)·실리콘투 신흥 대장',leaders:['278470.KQ','257720.KQ','090430.KS'],tickers:['278470.KQ','257720.KQ','090430.KS','192820.KS','051900.KS','237880.KQ'],etf:null,weights:{'278470.KQ':28,'257720.KQ':22,'090430.KS':18,'192820.KS':14,'051900.KS':10,'237880.KQ':8}},
  {id:'kr_kfood',name:'K-푸드',emoji:'',color:'var(--data-amber)',desc:'수출액 역대 최고 · 불닭·라면 글로벌 · 4사 라면 경쟁',leaders:['003230.KS','097950.KS','271560.KS','004370.KS'],tickers:['003230.KS','097950.KS','271560.KS','004370.KS','280360.KS'],etf:null,weights:{'003230.KS':33,'097950.KS':22,'271560.KS':18,'004370.KS':10,'280360.KS':17}},
  // ═══ 중립→개선 (3) ═══
  {id:'kr_finance',name:'금융/밸류업',emoji:'',color:'var(--data-amber)',desc:'PBR 0.5x · 밸류업 프로그램 · 자사주 소각 · 지주+보험+증권',leaders:['105560.KS','055550.KS','086790.KS'],tickers:['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','006800.KS'],etf:null,weights:{'105560.KS':22,'055550.KS':20,'086790.KS':16,'316140.KS':13,'138040.KS':13,'032830.KS':10,'006800.KS':6}},
  {id:'kr_auto',name:'자동차/SDV',emoji:'',color:'#211d16',desc:'현대차·기아 SDV 전환 · 완성차+부품',leaders:['005380.KS','000270.KS','012330.KS'],tickers:['005380.KS','000270.KS','012330.KS','204320.KS','161390.KS'],etf:null,weights:{'005380.KS':32,'000270.KS':28,'012330.KS':22,'204320.KS':10,'161390.KS':8}},
  {id:'kr_bio',name:'바이오/제약',emoji:'',color:'#211d16',desc:'CDMO · GLP-1 · 세노바메이트 미국 성장 · 삼성바이오로직스 + 알테오젠/리가켐(KOSDAQ)',leaders:['207940.KS','068270.KS','000100.KS','326030.KS'],tickers:['207940.KS','068270.KS','000100.KS','326030.KS','128940.KS','196170.KQ','141080.KQ'],etf:null,weights:{'207940.KS':30,'068270.KS':22,'000100.KS':15,'326030.KS':10,'128940.KS':10,'196170.KQ':8,'141080.KQ':5}},
  // ═══ 조정/약세 (4) ═══
  {id:'kr_defense',name:'방산/항공우주',emoji:'',color:'#22754c',desc:'K-방산 글로벌 수출 · 이란 재협상 프리미엄 축소',leaders:['012450.KS','047810.KS','272210.KS'],tickers:['012450.KS','047810.KS','272210.KS','079550.KS','064350.KS','103140.KS'],etf:null,weights:{'012450.KS':32,'047810.KS':22,'079550.KS':18,'272210.KS':12,'064350.KS':10,'103140.KS':6}},
  {id:'kr_energy',name:'에너지/정유',emoji:'',color:'var(--data-green)',desc:'유가 변동성 · 정유 마진 (이란 재협상 리스크)',leaders:['010950.KS','096770.KS','078930.KS'],tickers:['010950.KS','096770.KS','078930.KS','024060.KQ'],etf:null,weights:{'010950.KS':40,'096770.KS':30,'078930.KS':20,'024060.KQ':10}},
  {id:'kr_battery',name:'2차전지',emoji:'',color:'#211d16',desc:'EV 둔화 + CATL 경쟁 · 셀 3사 + 양극재 4사',leaders:['373220.KS','006400.KS','051910.KS'],tickers:['373220.KS','006400.KS','051910.KS','005490.KS','247540.KQ','066970.KQ','086520.KQ','003670.KS'],etf:null,weights:{'373220.KS':25,'006400.KS':18,'051910.KS':15,'005490.KS':12,'247540.KQ':12,'066970.KQ':6,'086520.KQ':6,'003670.KS':6}},
  {id:'kr_content',name:'K-엔터/콘텐츠',emoji:'',color:'#211d16',desc:'아이돌 피로감 · 스튜디오 실적 부진 · 하이브(KOSPI) + 엔터 4사(KOSDAQ)',leaders:['352820.KS','041510.KQ','035900.KQ'],tickers:['352820.KS','041510.KQ','035900.KQ','122870.KQ','035760.KQ','253450.KQ'],etf:null,weights:{'352820.KS':30,'041510.KQ':20,'035900.KQ':18,'035760.KQ':15,'253450.KQ':10,'122870.KQ':7}},
  // ═══ 추가 테마 (6) ═══
  {id:'kr_gaming',name:'게임',emoji:'',color:'#211d16',desc:'PUBG·MMORPG·서브컬처 · 크래프톤/엔씨/넷마블(KOSPI) + 카겜/펄어비스/위메이드(KOSDAQ)',leaders:['259960.KS','036570.KS','251270.KS'],tickers:['259960.KS','036570.KS','251270.KS','293490.KQ','263750.KQ','112040.KQ'],etf:null,weights:{'259960.KS':35,'036570.KS':20,'251270.KS':15,'293490.KQ':12,'263750.KQ':10,'112040.KQ':8}},
  {id:'kr_semi_equip',name:'반도체 소부장',emoji:'',color:'#22754c',desc:'장비·부품·소재 · HBM 수혜 · 전원 KOSDAQ',leaders:['403870.KQ','058470.KQ','357780.KQ'],tickers:['403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ','272290.KQ'],etf:null,weights:{'403870.KQ':22,'058470.KQ':20,'357780.KQ':18,'240810.KQ':15,'039030.KQ':15,'272290.KQ':10}},
  {id:'kr_drone',name:'드론/무인기·UAM',emoji:'',color:'#211d16',desc:'군용 드론·미사일 유도·무인기 (방산 테마와 일부 중첩)',leaders:['079550.KS','047810.KS','010820.KS'],tickers:['079550.KS','047810.KS','272210.KS','010820.KS','064350.KS'],etf:null,weights:{'079550.KS':40,'047810.KS':25,'272210.KS':15,'010820.KS':12,'064350.KS':8}},
  {id:'kr_reit',name:'리츠/부동산',emoji:'',color:'#211d16',desc:'상장 리츠 · 물류/오피스/리테일 · 6개 주요 리츠 (에이리츠는 KOSDAQ)',leaders:['293940.KS','357430.KS','365550.KS'],tickers:['293940.KS','357430.KS','365550.KS','330590.KS','140910.KQ','448730.KS'],etf:null,weights:{'293940.KS':28,'357430.KS':20,'365550.KS':12,'330590.KS':16,'140910.KQ':12,'448730.KS':12}},
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
var THEME_INSIGHTS_META = Object.freeze({ status:'unavailable', reason:'검증되지 않은 정적 테마 해설 제거' });
var THEME_INSIGHTS = Object.freeze({});
var SUB_THEME_INSIGHTS_META = Object.freeze({ status:'unavailable', reason:'검증되지 않은 정적 하위 테마 해설 제거' });
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
      perf = { chgPct: comp.chgPct, source: st.weights ? 'ETF가중(' + comp.count + ')' : '합산(' + comp.count + ')' };
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
    html += '<div class="aio-hover-scale-subtle" style="background:' + bgColor + ';border:1px solid rgba(33,29,22,0.06);border-radius:4px;padding:10px;transition:transform var(--dur-fast),border-color var(--dur-fast);cursor:pointer;--hover-border-color:' + st.color + '50;" data-action="showSubThemeDetail" data-arg="' + escHtml(st.id) + '">' +
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
      renderThemeHeatmap();
      renderAllEtfGrid();
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
    renderThemeHeatmap();
    renderAllEtfGrid();
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
