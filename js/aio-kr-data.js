// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-kr-data.js — P1134/R620: index.html 인라인 블록 C(3,473줄)에서 추출한 KR/SEC 데이터 플레인.
// KR 테마 카드·심층분석(filterKrThemes/initKoreaThemes/showKrThemeDetail/_buildKrThemeDeepAnalysis),
// KR 수급(fetchKrSupplyData/updateKrSupplyDOM/_renderKrWeeklySupplyFallback), VKOSPI 동적 수집과
// 이력(AIO_VKOSPI_HIST_KEY/fetchVkospiDynamic/_aioAppendVkospiHistory), KR 투자자 TOP10과 캐시
// (_krInvestorCache/_renderInvestorTop10), KR_STOCK_DB/KR_THEME_MAP/_KR_SECTOR_MAP,
// SEC 공시·재무(fetchSECFilings/fetchSECFinancials/SEC_TICKER_CIK).
//
// 왜 새 파일인가: 이 블록을 aio-data.js에 접어넣으면 그 파일이 20k가 되어 index.html의 모놀리스를
// 데이터 파일로 옮기는 것에 그친다(R620(3) — 압력의 측면 이동). 렌더러가 아니라 수집·정규화 계층이라
// aio-ui.js/aio-pages.js와도 책임이 다르다.
// ═══════════════════════════════════════════════════════════════════════════════

// Korea page chat chips only. Evidence-first contexts are defined in js/aio-chat.js.
(function() {
  if (!window.CHAT_DEFAULT_CHIPS) return;
  window.CHAT_DEFAULT_CHIPS['kr-themes'] = ['국내 테마 데이터 상태','테마 수급 확인','주도주 근거 확인'];
  window.CHAT_DEFAULT_CHIPS['kr-macro'] = ['한은 공식 일정','환율·금리 확인','물가 원천 확인'];
  window.CHAT_DEFAULT_CHIPS['kr-tech'] = ['한국 기술 데이터 상태','추세 확인','수급 교차검증'];
})();
function filterKrThemes(btn, heat) {
  var tabBar = btn.parentElement;
  if (tabBar) tabBar.querySelectorAll('.kr-tab').forEach(function(t){ t.classList.remove('active'); });
  btn.classList.add('active');
  var cards = document.querySelectorAll('#kr-theme-container .kr-theme-card');
  cards.forEach(function(card) {
    if (heat === 'all') { card.style.display = ''; return; }
    var h = card.getAttribute('data-heat');
    card.style.display = (h === heat) ? '' : 'none';
  });
}

// v35.5: 카탈리스트 데이터 JS 분리 — 한 곳에서 업데이트 가능
var KR_THEME_CATALYSTS = Object.freeze({});
var KR_THEME_CATALYSTS_META = Object.freeze({ status:'unavailable', reason:'정적 카탈리스트 제거 — 최신 뉴스 증거만 허용' });
function _krCatalystReferenceText() { return ''; }
window.AIO = window.AIO || {};
window.AIO.evaluateKrThemeQuoteCoverage = function(ld, themeMap) {
  ld = ld || {};
  themeMap = themeMap || {};
  var totalWeight = 0, observedWeight = 0, validThemes = [], themeCount = 0;
  Object.keys(themeMap).forEach(function(tid) {
    var rows = themeMap[tid] || [];
    var requiredWeight = 0, seenWeight = 0, seenCount = 0;
    rows.forEach(function(row) {
      var weight = Number(row.w) > 0 ? Number(row.w) : 0;
      requiredWeight += weight;
      var d = ld[krTickerToYahoo(row.code)];
      if (d && d.pct != null && Number.isFinite(Number(d.pct))) { seenWeight += weight; seenCount++; }
    });
    totalWeight += requiredWeight;
    observedWeight += seenWeight;
    themeCount++;
    var coverage = requiredWeight > 0 ? seenWeight / requiredWeight : 0;
    if (coverage >= 0.6 && seenCount >= Math.min(2, rows.length)) validThemes.push({ id: tid, coverage: coverage, seenCount: seenCount, requiredCount: rows.length });
  });
  var weightedCoverage = totalWeight > 0 ? observedWeight / totalWeight : 0;
  var minThemes = Math.ceil(themeCount * 0.6);
  return {
    weightedCoverage: weightedCoverage,
    validThemes: validThemes,
    validThemeIds: validThemes.map(function(row) { return row.id; }),
    validThemeCount: validThemes.length,
    themeCount: themeCount,
    sufficient: weightedCoverage >= 0.7 && validThemes.length >= minThemes
  };
};

// v35.5: 섹터 카테고리 필터
var _KR_SECTOR_MAP = {
  'tech':     ['semi','ai-sw','robot','photonics_kr','quantum'],
  'industry': ['defense','shipbuilding','power-grid','nuclear','battery','auto','construction','steel_chem','logistics','energy_kr','wind_solar','hydrogen','uam','space'],
  'consumer': ['bio','kbeauty','kcontent','kfood','crypto','retail','medtech_kr'],
  'finance':  ['finance','telecom']
};
function filterKrSector(btn, sector) {
  var tabBar = btn.parentElement;
  if (tabBar) tabBar.querySelectorAll('.kr-sector-tab').forEach(function(t){ t.classList.remove('active'); });
  btn.classList.add('active');
  var cards = document.querySelectorAll('#kr-theme-container .kr-theme-card');
  var allowed = sector === 'all' ? null : _KR_SECTOR_MAP[sector];
  cards.forEach(function(card) {
    if (!allowed) { card.style.display = ''; return; }
    var tid = card.getAttribute('data-theme-id');
    card.style.display = allowed.indexOf(tid) >= 0 ? '' : 'none';
  });
}

// v53.7 (P725): krSupplyTab 퇴역 — kr-supply 페이지 삭제

// ── Korea Home: live data update ────────────────────────────────
// v53.7 (P725): initKoreaHome 퇴역 — kr-home 페이지가 통합으로 삭제됨 (지수/배지/ETF 갱신은 이관 대상 아님)
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿).
// v53.7 (P725): KR 전용 5페이지를 themes/macro/technical 통합 섹션으로 이관 —
// 트리거를 통합 대상 페이지로 재배선. kr-home/kr-supply는 퇴역(전용 init 삭제),
// 공유 데이터 fetch(수급/VKOSPI/동적)는 _aioEnsureKrDataLoaded()로 1회 보장.
function _aioEnsureKrDataLoaded() {
  if (window._krSupplyLoaded) return;
  window._krSupplyLoaded = true;
  if (typeof fetchKrSupplyData === 'function') { try { fetchKrSupplyData(); } catch(_e) {} }
  if (typeof fetchKrDynamicData === 'function') { try { fetchKrDynamicData(); } catch(_e) {} }
}
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-kr-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'themes') initKoreaThemes();
  if (e.detail === 'macro') { _aioEnsureKrDataLoaded(); initKoreaMacro(); }
  if (e.detail === 'technical') { _aioEnsureKrDataLoaded(); initKoreaTechnical(); }
});
_aioPageBus.register('html-kr-live', 'aio:liveQuotes', function() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var pid = activePage.id.replace('page-','');
  if (pid === 'themes') initKoreaThemes();
  if (pid === 'macro') initKoreaMacro();
  if (pid === 'technical') initKoreaTechnical();
});
});

// v53.7 (P725): initKoreaSupply 퇴역 — kr-supply 페이지 삭제. 수급/동적 fetch는 _aioEnsureKrDataLoaded()가 담당.

function initKoreaThemes() {
  let ld = window._liveData || {};
  // v53.7 (P725): 테마 progressive 접기 버튼 — 통합 섹션에서 idempotent 보장
  if (typeof window._aioEnsureKrThemeProgressive === 'function') { try { window._aioEnsureKrThemeProgressive(); } catch(_e) {} }
  refreshKrThemeRuntimeWeights();
  var quoteCoverage = window.AIO && typeof window.AIO.evaluateKrThemeQuoteCoverage === 'function'
    ? window.AIO.evaluateKrThemeQuoteCoverage(ld, KR_THEME_MAP) : { validThemeIds: [] };
  // v40.4: 카드를 KR_THEME_MAP에서 동적 생성 (정적 HTML 제거됨 — 단일 진실 원천)
  if (typeof renderKrThemeCardsFromMap === 'function') renderKrThemeCardsFromMap();
  // 1. pill: 종목명 · 가격 · 등락률 명확 표시
  document.querySelectorAll('#kr-integrated-themes .kr-ticker-pill[data-live-symbol]').forEach(function(pill) {
    var sym = pill.getAttribute('data-live-symbol'), d = ld[sym];
    if (d && d.price !== undefined) {
      var priceEl = pill.querySelector('.pill-price');
      if (priceEl) { priceEl.textContent = d.price >= 1000 ? Math.round(d.price).toLocaleString() : d.price.toLocaleString(); }
      var pctEl = pill.querySelector('.pill-pct');
      if (pctEl && d.pct !== undefined) {
        pctEl.textContent = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%';
        pctEl.style.color = d.pct >= 0 ? 'var(--green)' : 'var(--red)';
      }
      // 행 전체 배경 틴트
      var a = Math.min(Math.abs(d.pct != null ? d.pct : 0)*3,12)/100;
      pill.style.background = (d.pct>=0)?'rgba(34,117,76,'+a+')':'rgba(177,58,48,'+a+')';
      pill.style.borderColor = (d.pct>=0)?'rgba(34,117,76,0.15)':'rgba(177,58,48,0.15)';
    }
  });

  // 2. v30: 테마별 ETF 가중평균 수익률 → heat 자동 결정
  var themeCards = document.querySelectorAll('#kr-integrated-themes .kr-theme-card');
  themeCards.forEach(function(card) {
    var themeId = card.getAttribute('data-theme-id');
    var tmap = (typeof KR_THEME_MAP !== 'undefined') && KR_THEME_MAP[themeId];

    var avg = 0;
    if (tmap && tmap.length) {
      // ETF 기반 가중평균 사용
      var wSum = 0, vSum = 0;
      tmap.forEach(function(t) {
        var sym = krTickerToYahoo(t.code);
        var d = ld[sym];
        if (d && d.pct !== undefined) { vSum += d.pct * t.w; wSum += t.w; }
      });
      if (quoteCoverage.validThemeIds.indexOf(themeId) >= 0 && wSum > 0) avg = vSum / wSum;
      else return; // 데이터 없음
    } else {
      // fallback: 카드 내 ticker 단순 평균
      var tickers = card.querySelectorAll('[data-live-price]');
      var pcts = [];
      tickers.forEach(function(t) {
        var sym = t.getAttribute('data-live-price');
        var d = ld[sym];
        if (d && d.pct !== undefined) pcts.push(d.pct);
      });
      if (pcts.length === 0) return;
      avg = pcts.reduce(function(a,b){return a+b;}, 0) / pcts.length;
    }

    // heat 결정: 일간 평균 기준
    var heat, heatLabel;
    if (avg >= 3) { heat = 'hot'; heatLabel = 'HOT'; }
    else if (avg >= 1) { heat = 'warm'; heatLabel = '강세'; }
    else if (avg >= -1) { heat = 'cool'; heatLabel = '중립'; }
    else { heat = 'cold'; heatLabel = avg <= -3 ? '급락' : '조정'; }

    // DOM 업데이트
    card.setAttribute('data-heat', heat);
    var heatEl = card.querySelector('.kr-theme-heat');
    if (heatEl) {
      heatEl.className = 'kr-theme-heat heat-' + heat;
      heatEl.textContent = heatLabel;
    }

    // 수익률 표시 업데이트
    var statEl = card.querySelector('.kr-theme-stat span:first-child b');
    if (statEl) {
      statEl.textContent = (avg >= 0 ? '+' : '') + avg.toFixed(1) + '%';
      statEl.style.color = avg >= 0 ? 'var(--green)' : 'var(--red)';
    }

    // v35.5: 카탈리스트 텍스트 JS 변수에서 동적 주입
    var catalyst = _krCatalystReferenceText(KR_THEME_CATALYSTS[themeId] || '');
    var catalystLead = catalyst.length > 260 ? catalyst.slice(0, 260).replace(/\s+\S*$/, '') + '…' : catalyst;
    var catEl = card.querySelector('.kr-theme-catalyst');
    if (catEl) catEl.textContent = catalystLead;
    var catFullEl = card.querySelector('.kr-theme-memo-full');
    if (catFullEl) catFullEl.textContent = catalyst;
    if (!card._krBound) { card._krBound = true;
      card.addEventListener('click', function(e) { if (e.target.closest('.kr-ticker-pill, details, summary, [data-stop]')) return; showKrThemeDetail(themeId); });
    }
  });
  renderKrThemePerfBars(ld);
  if (typeof _generateKrThemesAnalysis === 'function') _generateKrThemesAnalysis(ld);
}
// v40.4: KR_THEME_MAP 기반 테마 카드 동적 생성 — 단일 진실 원천(Single Source of Truth)
// 정적 HTML 카드 제거. KR_THEME_MAP + KR_STOCK_DB + KR_THEME_CATALYSTS에서 자동 생성.
function renderKrThemeCardsFromMap() {
  var container = document.getElementById('kr-theme-container');
  if (!container || typeof KR_THEME_MAP === 'undefined' || typeof KR_STOCK_DB === 'undefined') return;
  let ld = window._liveData || {};
  refreshKrThemeRuntimeWeights();
  var quoteCoverage = window.AIO && typeof window.AIO.evaluateKrThemeQuoteCoverage === 'function'
    ? window.AIO.evaluateKrThemeQuoteCoverage(ld, KR_THEME_MAP) : { validThemeIds: [] };

  // 테마 메타데이터 (이모지, 한글명, 영문명, 아이콘 배경색)
  var META = {
    'defense':      {emoji:'',name:'K-방산 / 항공우주',en:'K-DEFENSE · AEROSPACE · MISSILE',bg:'rgba(177,58,48,0.12)'},
    'semi':         {emoji:'',name:'반도체 / HBM',en:'SEMICONDUCTOR · HBM · FOUNDRY',bg:'rgba(33,29,22,0.12)'},
    'shipbuilding': {emoji:'',name:'조선 / 해양',en:'SHIPBUILDING · LNG · SUBMARINE',bg:'rgba(33,29,22,0.12)'},
    'ai-sw':        {emoji:'',name:'AI / 소프트웨어',en:'AI · SW · LLM · CLOUD',bg:'rgba(33,29,22,0.12)'},
    'power-grid':   {emoji:'',name:'전력기기 / 변압기',en:'TRANSFORMER · GRID · CABLE',bg:'rgba(33,29,22,0.12)'},
    'nuclear':      {emoji:'',name:'원전 / SMR',en:'NUCLEAR · SMR · REACTOR',bg:'rgba(34,117,76,0.12)'},
    'battery':      {emoji:'',name:'2차전지 / 배터리',en:'BATTERY · CATHODE · EV',bg:'rgba(33,29,22,0.12)'},
    'bio':          {emoji:'',name:'바이오 / 제약',en:'BIO · CDMO · GLP-1 · ADC',bg:'rgba(34,117,76,0.12)'},
    'kbeauty':      {emoji:'',name:'K-뷰티 / 화장품',en:'K-BEAUTY · COSMETICS · ODM',bg:'rgba(33,29,22,0.12)'},
    'kcontent':     {emoji:'',name:'K-콘텐츠 / 엔터',en:'K-POP · DRAMA · GAME',bg:'rgba(33,29,22,0.12)'},
    'auto':         {emoji:'',name:'자동차 / EV',en:'HYUNDAI · KIA · EV · PARTS',bg:'rgba(33,29,22,0.12)'},
    'robot':        {emoji:'',name:'로봇 / 자동화',en:'ROBOTICS · HUMANOID · COBOT',bg:'rgba(33,29,22,0.12)'},
    'finance':      {emoji:'',name:'금융',en:'BANK · INSURANCE · FINTECH',bg:'rgba(33,29,22,0.12)'},
    'kfood':        {emoji:'',name:'K-푸드 / 식품',en:'K-FOOD · F&B · EXPORT',bg:'rgba(33,29,22,0.12)'},
    'crypto':       {emoji:'',name:'크립토 / 블록체인',en:'CRYPTO · WEB3 · BLOCKCHAIN',bg:'rgba(33,29,22,0.12)'},
    'telecom':      {emoji:'',name:'통신',en:'TELECOM · 5G · IDC',bg:'rgba(33,29,22,0.12)'},
    'construction': {emoji:'',name:'건설 / 인프라',en:'CONSTRUCTION · SOC · REDEVELOPMENT',bg:'rgba(33,29,22,0.12)'},
    'retail':       {emoji:'',name:'유통 / 리테일',en:'RETAIL · DEPT STORE · CVS',bg:'rgba(33,29,22,0.12)'},
    'steel_chem':   {emoji:'',name:'철강 / 화학 / 소재',en:'STEEL · CHEMICAL · MATERIALS',bg:'rgba(33,29,22,0.12)'},
    'logistics':    {emoji:'',name:'물류 / 운송 / 항공',en:'LOGISTICS · AIRLINE · FREIGHT',bg:'rgba(33,29,22,0.12)'},
  'medtech_kr':   {emoji:'',name:'의료기기 / 디지털헬스',en:'AI DIAGNOSIS · MED DEVICE · SURGICAL ROBOT',bg:'rgba(33,29,22,0.12)'},
    'energy_kr':    {emoji:'',name:'에너지 / 정유',en:'OIL REFINERY · LNG · ENERGY',bg:'rgba(34,117,76,0.12)'},
    'photonics_kr': {emoji:'',name:'광 / 포토닉스',en:'PHOTONICS · OPTICAL · CPO · FIBER',bg:'rgba(33,29,22,0.12)'},
    'wind_solar':   {emoji:'',name:'풍력 / 태양광 / 신재생',en:'WIND · SOLAR · RENEWABLE ENERGY',bg:'rgba(34,117,76,0.12)'},
    'quantum':      {emoji:'',name:'양자컴퓨팅 / 양자암호',en:'QUANTUM COMPUTING · QKD · PQC',bg:'rgba(33,29,22,0.12)'},
    'uam':          {emoji:'',name:'UAM / 도심항공',en:'UAM · eVTOL · VERTIPORT',bg:'rgba(33,29,22,0.12)'},
    'hydrogen':     {emoji:'',name:'수소에너지',en:'HYDROGEN · FUEL CELL · GREEN H2',bg:'rgba(33,29,22,0.12)'},
    'space':        {emoji:'',name:'우주항공 / 위성',en:'SPACE · SATELLITE · LAUNCH VEHICLE',bg:'rgba(177,58,48,0.12)'}
  };

  // 테마 순서 (사용자에게 보이는 순서)
  var ORDER = ['defense','semi','shipbuilding','ai-sw','power-grid','nuclear','battery','bio','kbeauty','kcontent','auto','robot','finance','kfood','crypto','telecom','construction','retail','steel_chem','logistics','medtech_kr','energy_kr','photonics_kr','wind_solar','quantum','uam','hydrogen','space'];

  var html = '';
  ORDER.forEach(function(tid) {
    var tmap = KR_THEME_MAP[tid];
    if (!tmap) return;
    var meta = META[tid] || {emoji:'',name:tid,en:tid.toUpperCase(),bg:'rgba(33,29,22,0.12)'};
    var catalyst = _krCatalystReferenceText((typeof KR_THEME_CATALYSTS !== 'undefined' && KR_THEME_CATALYSTS[tid]) || '');

    // 종목별 가중평균 수익률 계산 + heat 판별
    var ws = 0, vs = 0;
    tmap.forEach(function(s) {
      var sym = krTickerToYahoo(s.code);
      var d = ld[sym];
      if (d && d.pct != null && s.w > 0) { vs += d.pct * s.w; ws += s.w; }
    });
    var avg = quoteCoverage.validThemeIds.indexOf(tid) >= 0 && ws > 0 ? vs / ws : null;
    var heat, heatLabel;
    if (avg == null)   { heat = 'pending'; heatLabel = '시세 미수신'; }
    else if (avg >= 3) { heat = 'hot';  heatLabel = 'HOT'; }
    else if (avg >= 1) { heat = 'warm'; heatLabel = '강세'; }
    else if (avg >= -1){ heat = 'cool'; heatLabel = '중립'; }
    else               { heat = 'cold'; heatLabel = avg <= -3 ? '급락' : '조정'; }

    // 종목 pill 생성 (비중 내림차순 = 시총/대장주 순)
    var sorted = tmap.slice().sort(function(a, b) { return b.w - a.w; });
    var pillsHtml = '', extraPillsHtml = '';
    sorted.forEach(function(s, stockIdx) {
      var sym = krTickerToYahoo(s.code);
      var info = KR_STOCK_DB[s.code] || {};
      var name = info.name || s.code;
      var d = ld[sym];
      var pctStr = '', pctColor = 'var(--text-muted)';
      if (d && d.pct != null) {
        pctStr = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + '%';
        pctColor = d.pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      }
      var priceStr = d && d.price ? d.price.toLocaleString() : '';
      var barC = d && d.pct != null ? (d.pct >= 0 ? 'rgba(34,117,76,0.12)' : 'rgba(177,58,48,0.10)') : 'transparent';
      var pillHtml = '<span class="kr-ticker-pill" data-live-symbol="' + sym + '" style="--bar-w:' + s.w + '%;--bar-c:' + barC + ';cursor:pointer;" data-action="showTicker" data-arg="' + sym + '" data-stop="1" title="' + (info.name||s.code) + ' ↗">' +
        '<span class="pill-code">' + s.code + '</span> ' +
        '<span class="pill-name">' + name + '</span> ' +
        '<span class="pill-wt">' + s.w + '%</span> ' +
        '<span class="pill-price" data-live-price="' + sym + '">' + priceStr + '</span> ' +
        '<span class="pill-pct" data-live-chg="' + sym + '" style="color:' + pctColor + ';">' + pctStr + '</span>' +
        '</span>';
      if (stockIdx < 5) pillsHtml += pillHtml;
      else extraPillsHtml += pillHtml;
    });

    if (extraPillsHtml) {
      pillsHtml += '<details class="kr-theme-card-more" data-stop="1"><summary>' + (sorted.length - 5) + '개 구성 종목 더 보기</summary><div class="kr-theme-tickers" style="margin-top:6px;">' + extraPillsHtml + '</div></details>';
    }
    var catalystLead = catalyst.length > 260 ? catalyst.slice(0, 260).replace(/\s+\S*$/, '') + '…' : catalyst;
    var catalystHtml = catalyst ? '<div class="kr-theme-catalyst">' + escHtml(catalystLead) + '</div>' +
      (catalyst.length > catalystLead.length ? '<details class="kr-theme-card-more kr-theme-memo-more" data-stop="1"><summary>근거 메모 전체 보기</summary><div class="kr-theme-memo-full">' + escHtml(catalyst) + '</div></details>' : '') : '';

    // 카드 HTML 조립
    html += '<div class="kr-theme-card" data-heat="' + heat + '" data-theme-id="' + tid + '">' +
      '<div class="kr-theme-header">' +
        '<span class="kr-theme-icon" style="background:' + meta.bg + ';"></span>' +
        '<div><div class="kr-theme-name">' + meta.name + '</div><div class="kr-theme-en">' + meta.en + '</div></div>' +
        '<span class="kr-theme-heat heat-' + heat + '">' + heatLabel + '</span>' +
      '</div>' +
      '<div class="kr-theme-tickers">' + pillsHtml + '</div>' +
      '<div class="kr-theme-stat" data-theme-stat="' + tid + '">' +
        (avg == null ? '<span><b style="color:var(--text-muted);">시세 미수신 · 구성 비중만 표시</b></span>' : '<span>일간 수익률 <b style="color:' + (avg >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' + (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%</b></span>') +
      '</div>' +
      catalystHtml +
    '</div>';
  });

  container.innerHTML = html;
  if (window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
    window.AIO.annotateLiveDataSinks(container, { reason: 'kr-theme-render', force: true });
  }
  var addedLiveSymbols = 0;
  if (window.AIO && typeof window.AIO.registerLiveSymbolsFromDom === 'function') {
    addedLiveSymbols = window.AIO.registerLiveSymbolsFromDom(container, { reason: 'kr-theme-render' });
  }
  if (addedLiveSymbols > 0 && typeof fetchLiveQuotes === 'function' && typeof _aioBootPhase !== 'undefined' && _aioBootPhase.quoteReady === true && !window._aioQuoteInFlight) {
    setTimeout(function() { fetchLiveQuotes(window._aioQuoteRequestSymbols || []); }, 50);
  }

  // 클릭 핸들러 연결
  var cards = container.querySelectorAll('.kr-theme-card');
  cards.forEach(function(card) {
    var themeId = card.getAttribute('data-theme-id');
    card.addEventListener('click', function(e) {
      if (e.target.closest('.kr-ticker-pill') || e.target.closest('.kr-theme-card-more')) return;
      if (typeof showKrThemeDetail === 'function') showKrThemeDetail(themeId);
    });
  });
}

function renderKrThemePerfBars(ld) {
  refreshKrThemeRuntimeWeights();
  var c = document.getElementById('kr-theme-perf-bars'); if (!c||!ld||Object.keys(ld).length<5) return;
  var N={'defense':' 방산','semi':'반도체','shipbuilding':' 조선','ai-sw':'AI/SW','power-grid':'전력기기','nuclear':' 원전','battery':' 2차전지','bio':' 바이오','kbeauty':' K뷰티','kcontent':' K콘텐츠','auto':' 자동차','robot':' 로봇','finance':' 금융','kfood':' K푸드','crypto':' 크립토','telecom':'통신','construction':' 건설','retail':' 유통','steel_chem':' 철강/화학','logistics':' 물류','medtech_kr':' 의료기기','energy_kr':' 에너지'};
  var res=[];for(var tid in KR_THEME_MAP){var t=KR_THEME_MAP[tid],ws=0,vs=0;t.forEach(function(s){var d=ld[krTickerToYahoo(s.code)];if(d&&d.pct!==undefined&&s.w>0){vs+=d.pct*s.w;ws+=s.w;}});if(ws>0)res.push({id:tid,name:N[tid]||tid,perf:vs/ws});}
  if(!res.length)return;res.sort(function(a,b){return b.perf-a.perf;});var mx=Math.max.apply(null,res.map(function(r){return Math.abs(r.perf);}));if(mx<0.01)mx=1;
  var h='';res.forEach(function(r,i){var p=r.perf>=0,bw=Math.min(Math.abs(r.perf)/mx*100,100),cl=p?'var(--data-green)':'var(--data-red)',rk=i<3?'<b style="color:'+cl+';">'+(i+1)+'</b> ':'';
    h+='<div style="display:grid;grid-template-columns:105px 1fr 58px;align-items:center;gap:5px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,'+(i%2===0?'0.015':'0')+');cursor:pointer;" data-action="showKrThemeDetail" data-arg="'+escHtml(r.id)+'"><div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+rk+r.name+'</div><div style="height:12px;background:var(--surface-2);border-radius:3px;overflow:hidden;position:relative;">'+(p?'<div style="position:absolute;left:50%;height:100%;width:'+(bw/2)+'%;background:'+cl+';border-radius:0 3px 3px 0;opacity:0.7;"></div>':'<div style="position:absolute;right:50%;height:100%;width:'+(bw/2)+'%;background:'+cl+';border-radius:3px 0 0 3px;opacity:0.7;"></div>')+'<div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(33,29,22,0.12);"></div></div><div style="font-size:11px;font-weight:900;font-family:var(--font-mono);text-align:right;color:'+cl+';">'+(p?'+':'')+r.perf.toFixed(2)+'%</div></div>';});
  c.innerHTML=h;var ts=document.getElementById('kr-theme-rank-ts');if(ts)ts.textContent=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' 갱신';
}
function showKrThemeDetail(themeId) {
  refreshKrThemeRuntimeWeights();
  var panel=document.getElementById('kr-theme-detail-panel'),content=document.getElementById('kr-theme-detail-content');
  if(!panel||!content)return;var tmap=KR_THEME_MAP[themeId];if(!tmap)return;var ld=window._liveData||{};
  var CN={'defense':' K-방산/항공우주','semi':'반도체/HBM','shipbuilding':' 조선/해양','ai-sw':'AI/소프트웨어','power-grid':'전력기기/변압기','nuclear':' 원전/SMR','battery':' 2차전지/배터리','bio':' 바이오/제약','kbeauty':' K뷰티','kcontent':' K콘텐츠','auto':' 자동차/EV','robot':' 로봇/자동화','finance':' 금융','kfood':' K푸드','crypto':' 크립토','telecom':'통신','construction':' 건설/인프라','retail':' 유통','steel_chem':' 철강/화학','logistics':' 물류/운송','medtech_kr':' 의료기기','energy_kr':' 에너지/정유'};
  var cat=_krCatalystReferenceText(KR_THEME_CATALYSTS[themeId]||'');
  // 테마 통계 계산
  var ws=0,vs=0,upCnt=0,dnCnt=0,topStock=null,topPct=-999,botStock=null,botPct=999;
  tmap.forEach(function(t){
    var info=KR_STOCK_DB[t.code]||{},sym=krTickerToYahoo(t.code),d=ld[sym];
    if(d&&d.pct!==undefined&&t.w>0){vs+=d.pct*t.w;ws+=t.w;if(d.pct>=0)upCnt++;else dnCnt++;}
    if(d&&d.pct!==undefined){if(d.pct>topPct){topPct=d.pct;topStock=info.name||t.code;}if(d.pct<botPct){botPct=d.pct;botStock=info.name||t.code;}}
  });
  var avg=ws>0?vs/ws:0,ip=avg>=0,cc=ip?'var(--data-green)':'var(--data-red)';
  var totalStocks=tmap.length,upRatio=totalStocks>0?Math.round(upCnt/totalStocks*100):0;

  // 테마 강도 판단
  var strength='',strengthCol='';
  if(avg>=3){strength='매우 강세';strengthCol='var(--data-green)';}
  else if(avg>=1){strength='강세';strengthCol='var(--data-green)';}
  else if(avg>=0){strength=' 보합·소폭강세';strengthCol='var(--text-muted)';}
  else if(avg>=-1){strength=' 보합·소폭약세';strengthCol='var(--text-muted)';}
  else if(avg>=-3){strength='약세';strengthCol='var(--data-red)';}
  else{strength=' 급락';strengthCol='var(--data-red)';}

  // 종목 테이블 (등락률 순 정렬)
  var sorted=tmap.slice().sort(function(a,b){var da=ld[krTickerToYahoo(a.code)],db=ld[krTickerToYahoo(b.code)];return(db?db.pct!=null?db.pct:0:0)-(da?da.pct!=null?da.pct:0:0);});
  var rows='';sorted.forEach(function(t,idx){
    var info=KR_STOCK_DB[t.code]||{},sym=krTickerToYahoo(t.code),d=ld[sym];
    var price=d&&d.price!=null&&isFinite(Number(d.price))?Number(d.price):null,pct=d&&d.pct!=null?d.pct:null,pCol=pct!==null?(pct>=0?'var(--data-green)':'var(--data-red)'):'var(--text-muted)';
    var ps=price==null?'—':price>=1000?Math.round(price).toLocaleString()+'원':price+'원';
    var pcs=pct!==null?((pct>=0?'+':'')+pct.toFixed(2)+'%'):'—';
    var lt=d?'<span style="color:var(--data-green);font-size:11px;">● 수신</span>':'<span style="color:var(--text-muted);font-size:11px;">○</span>';
    var rankIcon=idx===0?' ':idx===1?' ':idx===2?' ':'';
    rows+='<tr style="background:'+(idx%2===0?'rgba(33,29,22,0.015)':'transparent')+';border-bottom:1px solid var(--surface-2);"><td style="padding:7px 8px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;" data-action="showTicker" data-arg="'+sym+'" title="'+(info.name||t.code)+' 분석 →">'+rankIcon+'<span style="color:var(--accent);">'+(info.name||t.code)+'</span> <span style="font-size:10px;opacity:0.6;">↗</span><div style="font-size:11px;color:var(--text-muted);font-weight:400;">'+(info.sector||'')+' · '+t.code+'</div></td><td style="padding:7px 8px;font-size:13px;font-weight:800;font-family:var(--font-mono);text-align:right;">'+ps+'</td><td style="padding:7px 8px;font-size:13px;font-weight:900;font-family:var(--font-mono);text-align:right;color:'+pCol+';">'+pcs+'</td><td style="padding:7px 8px;font-size:10px;text-align:center;color:var(--text-muted);">'+(info.mcap||'—')+'</td><td style="padding:7px 8px;font-size:10px;text-align:center;">'+t.w+'%</td><td style="padding:7px 8px;text-align:center;">'+lt+'</td></tr>';
  });

  var tn=(CN[themeId]||themeId).replace(/[^가-힣a-zA-Z0-9\/\s]/g,'').trim();

  content.innerHTML=
    // 헤더: 테마명 + 수익률 + 강도
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">'+
      '<div><div style="font-size:18px;font-weight:900;">'+(CN[themeId]||themeId)+'</div>'+
        '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">구성종목 '+totalStocks+'개 · 상승 '+upCnt+' · 하락 '+dnCnt+'</div></div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:'+cc+';">'+(ip?'+':'')+avg.toFixed(2)+'%</div>'+
        '<div style="font-size:11px;color:'+strengthCol+';font-weight:700;">'+strength+'</div></div></div>'+

    // 요약 카드 4개
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">'+
      '<div style="background:var(--surface-2);border-radius:4px;padding:10px;text-align:center;border:1px solid var(--surface-4);">'+
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">상승 비율</div>'+
        '<div style="font-size:18px;font-weight:900;color:'+(upRatio>=60?'var(--data-green)':upRatio<=40?'var(--data-red)':'var(--text-muted)')+';">'+upRatio+'%</div></div>'+
      '<div style="background:var(--surface-2);border-radius:4px;padding:10px;text-align:center;border:1px solid var(--surface-4);">'+
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">최고 종목</div>'+
        '<div style="font-size:12px;font-weight:800;color:var(--data-green);">'+(topStock||'—')+'</div><div style="font-size:10px;color:var(--data-green);">'+(topStock?(topPct>=0?'+':'')+topPct.toFixed(2)+'%':'—')+'</div></div>'+
      '<div style="background:var(--surface-2);border-radius:4px;padding:10px;text-align:center;border:1px solid var(--surface-4);">'+
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">최저 종목</div>'+
        '<div style="font-size:12px;font-weight:800;color:var(--data-red);">'+(botStock||'—')+'</div><div style="font-size:10px;color:var(--data-red);">'+(botStock?(botPct>=0?'+':'')+botPct.toFixed(2)+'%':'—')+'</div></div>'+
      '<div style="background:var(--surface-2);border-radius:4px;padding:10px;text-align:center;border:1px solid var(--surface-4);">'+
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">가중평균</div>'+
        '<div style="font-size:18px;font-weight:900;font-family:var(--font-mono);color:'+cc+';">'+(ip?'+':'')+avg.toFixed(2)+'%</div></div>'+
    '</div>'+

    // 촉매
    (cat?'<div style="background:rgba(33,29,22,0.06);border-left:3px solid rgba(33,29,22,0.4);border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:14px;">'+
      '<div style="font-size:10px;font-weight:700;color:var(--accent);margin-bottom:4px;">촉매 / 핵심 이슈</div>'+
      '<div style="font-size:11px;color:var(--text-secondary);line-height:1.6;">'+cat+'</div></div>':'')+

    // 종목 테이블
    '<div style="overflow-x:auto;border:1px solid rgba(33,29,22,0.06);border-radius:4px;">'+
      '<table style="width:100%;border-collapse:collapse;">'+
        '<thead><tr style="background:var(--surface-2);border-bottom:2px solid var(--surface-5);">'+
          '<th style="padding:8px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:700;">종목</th>'+
          '<th style="padding:8px;text-align:right;font-size:10px;color:var(--text-muted);font-weight:700;">현재가</th>'+
          '<th style="padding:8px;text-align:right;font-size:10px;color:var(--text-muted);font-weight:700;">등락률</th>'+
          '<th style="padding:8px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;">시총</th>'+
          '<th style="padding:8px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;">비중</th>'+
          '<th style="padding:8px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:700;">소스</th>'+
        '</tr></thead><tbody>'+rows+'</tbody></table></div>'+

    // 심층 분석 섹션
    _buildKrThemeDeepAnalysis(themeId, avg, upCnt, dnCnt, totalStocks, topStock, topPct, botStock, botPct, sorted, ld, tmap) +

    // AI 분석 버튼
    '<div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap;">'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 심층 분석: 현재 모멘텀, 수급, 밸류에이션, 리스크 종합 판단해줘" class="aio-btn-table" style="font-size:10px;padding:6px 12px;">AI 심층 분석</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 외국인·기관 수급 흐름과 향후 전망 분석해줘" class="aio-btn-table" style="font-size:10px;padding:6px 12px;">수급 분석</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 대장주와 후발주 비교 분석하고 진입 전략 알려줘" class="aio-btn-table" style="font-size:10px;padding:6px 12px;">진입 전략</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 리스크 요인과 주의할 점 분석해줘" class="aio-btn-table" style="font-size:10px;padding:6px 12px;">리스크</button>'+
    '</div>';

  panel.style.display='block';panel.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══ 한국 테마 심층 분석 생성 ═══
function _buildKrThemeDeepAnalysis(themeId, avg, upCnt, dnCnt, total, topStock, topPct, botStock, botPct, sorted, ld, tmap) {
  var h = '<div style="margin-top:14px;padding:14px;background:rgba(33,29,22,0.05);border:1px solid rgba(33,29,22,0.15);border-radius:4px;">';
  h += '<div style="font-size:13px;font-weight:900;color:var(--accent);margin-bottom:10px;">심층 분석</div>';
  var ss = [];

  // 1) 테마 온도 진단
  if (avg >= 3) ss.push('<b>매우 강세</b> — 시장에서 가장 뜨거운 테마 중 하나입니다. 외국인·기관 동반 매수가 집중될 수 있으나, 단기 과열에 따른 차익실현 압력도 경계가 필요합니다.');
  else if (avg >= 1) ss.push('<b>강세</b> — 모멘텀이 살아있는 테마입니다. 실적 발표, 정책 수혜, 수주 등 펀더멘털 촉매가 주가를 떠받치고 있을 가능성이 높습니다.');
  else if (avg >= 0) ss.push(' <b>보합</b> — 방향성 탐색 구간입니다. 시장이 이 테마에 대해 뚜렷한 확신을 갖지 못하고 있으며, 새로운 촉매가 필요합니다.');
  else if (avg >= -2) ss.push('<b>약세</b> — 차익실현 매물 또는 섹터 로테이션 매도가 출회되고 있습니다. 펀더멘털이 훼손된 것인지 일시적 수급 이탈인지 구분이 핵심입니다.');
  else ss.push(' <b>급락</b> — 시장에서 외면받고 있는 테마입니다. 구조적 악재(정책 변경, 수요 급감, 경쟁 심화)가 있는지 점검이 필요합니다.');

  // 2) 종목 간 퍼포먼스 격차
  if (topPct !== undefined && botPct !== undefined && topStock && botStock) {
    var spread = topPct - botPct;
    if (spread > 5) ss.push('<b>종목 간 편차 ' + spread.toFixed(1) + '%p — 극심</b>: 대장주와 후발주의 퍼포먼스 차이가 매우 큽니다. 같은 테마라도 옥석 가리기가 핵심입니다. 테마 선두는 <b>' + topStock + '</b>이고, 후발은 <b>' + botStock + '</b>입니다. 후발 종목은 개별 악재나 밸류에이션 부담을 따로 확인해야 합니다.');
    else if (spread > 2) ss.push('<b>종목 간 편차 ' + spread.toFixed(1) + '%p</b>: 적절한 수준. 테마 전반이 유사하게 움직이고 있어 ETF 접근도 유효합니다.');
    else ss.push('<b>종목 간 편차 ' + spread.toFixed(1) + '%p</b>: 매우 좁습니다. 테마 전체가 동일 재료에 반응하고 있으며, 개별 종목 차별화보다 테마 방향성이 더 중요한 구간입니다.');
  }

  // 3) 상승 비율 기반 건강도 — v38.3: 데이터 수신 종목 수 기준으로 계산 (미수신 종목 제외)
  var dataCounted = upCnt + dnCnt;
  var upRatio = dataCounted > 0 ? Math.round(upCnt / dataCounted * 100) : 0;
  if (upRatio >= 70) ss.push(' <b>테마 건강도 우수</b> — 구성종목 중 ' + upRatio + '%가 상승. 광범위한 매수세가 테마 전체를 지지하고 있어 추세 지속 가능성이 높습니다.');
  else if (upRatio >= 50) ss.push(' <b>테마 건강도 보통</b> — 상승 ' + upCnt + '개 vs 하락 ' + dnCnt + '개. 대장주 위주로만 오르고 있다면 폭이 좁은 랠리로, 후발주 확산 여부를 모니터링해야 합니다.');
  else ss.push('<b>테마 건강도 취약</b> — 하락 종목(' + dnCnt + '개)이 상승 종목(' + upCnt + '개)보다 많습니다. 테마 모멘텀이 꺾이는 신호일 수 있어 추격 매수는 자제가 권장됩니다.');

  // 4) 대장주 vs 후발주 분석 — v38.3: 6종목 미만 테마에서 top3/bot3 겹침 버그 수정
  if (sorted.length >= 6) {
    var top3Avg = 0, bot3Avg = 0, top3Cnt = 0, bot3Cnt = 0;
    for (var ti = 0; ti < 3; ti++) {
      var td = ld[krTickerToYahoo(sorted[ti].code)];
      if (td && td.pct !== undefined) { top3Avg += td.pct; top3Cnt++; }
    }
    for (var bi = sorted.length - 3; bi < sorted.length; bi++) {
      var bd = ld[krTickerToYahoo(sorted[bi].code)];
      if (bd && bd.pct !== undefined) { bot3Avg += bd.pct; bot3Cnt++; }
    }
    if (top3Cnt > 0 && bot3Cnt > 0) {
      top3Avg /= top3Cnt;
      bot3Avg /= bot3Cnt;
      var gap = top3Avg - bot3Avg;
      if (gap > 3) ss.push('<b>대장주 독주:</b> 상위 3종목 평균 ' + (top3Avg>=0?'+':'') + top3Avg.toFixed(2) + '% vs 하위 3종목 ' + (bot3Avg>=0?'+':'') + bot3Avg.toFixed(2) + '%. 대장주에 자금이 집중되고 있으며, 후발주 진입 시 대장주 추세 확인 후 접근하는 것이 안전합니다.');
      else if (gap < 1) ss.push(' <b>동반 움직임:</b> 상위·하위 종목 편차가 ' + gap.toFixed(1) + '%p로 작습니다. 테마 내 종목들이 함께 움직이고 있어 테마 자체의 방향성에 베팅하는 전략이 유효합니다.');
    }
  }

  // 5) 비중 집중도 분석
  if (tmap.length >= 3) {
    var maxW = 0, maxWName = '';
    tmap.forEach(function(t) { if (t.w > maxW) { maxW = t.w; maxWName = (KR_STOCK_DB[t.code] || {}).name || t.code; } });
    if (maxW >= 30) ss.push(' <b>비중 집중:</b> ' + maxWName + '이(가) ' + maxW + '%로 테마 비중이 높습니다. 이 종목의 등락이 테마 전체 수익률을 좌우하므로, 해당 종목의 개별 이벤트(실적, 수주, 규제)에 주의가 필요합니다.');
  }

  // 6) v38.3: 레퍼런스 기반 한국 테마 맞춤 인사이트
  var kti = KR_THEME_INSIGHTS[themeId];
  if (kti) {
    ss.push('');
    ss.push(' <b>테마 인사이트</b>');
    if (kti.macro) ss.push('<b>매크로 조건:</b> ' + kti.macro);
    if (kti.foreignFlow) ss.push(' <b>외국인 수급:</b> ' + kti.foreignFlow);
    if (kti.linkedUS) ss.push(' <b>미국 연동:</b> ' + kti.linkedUS);
    if (kti.breakSignals && kti.breakSignals.length) {
      ss.push('<b>깨지는 신호:</b> ' + kti.breakSignals.map(function(s,i){return (i+1)+') '+s;}).join(' · '));
    }
  }

  // v48.14: 한국 구조적 내러티브 (KR_THEME_NARRATIVES는 kr_* ID 체계 → KR_INSIGHT_MAP 역매핑)
  var krNarrKey = null;
  if (typeof KR_INSIGHT_MAP !== 'undefined' && typeof KR_THEME_NARRATIVES !== 'undefined') {
    krNarrKey = Object.keys(KR_INSIGHT_MAP).find(function(k){ return KR_INSIGHT_MAP[k] === themeId; });
  }
  var kn = (krNarrKey && typeof KR_THEME_NARRATIVES !== 'undefined') ? KR_THEME_NARRATIVES[krNarrKey] : null;
  if (kn) {
    // stale 배지
    var _knStaleDays = 0, _knIsStale = false;
    if (typeof KR_THEME_NARRATIVES_META !== 'undefined' && KR_THEME_NARRATIVES_META.lastUpdated) {
      try {
        _knStaleDays = Math.round((Date.now() - new Date(KR_THEME_NARRATIVES_META.lastUpdated).getTime()) / 86400000);
        _knIsStale = _knStaleDays > (KR_THEME_NARRATIVES_META.staleDays || 90);
      } catch(e) {}
    }
    var _krStaleBadge = ' <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:3px;margin-left:6px;background:' + (_knIsStale ? 'rgba(177,58,48,0.15);color:var(--data-red);border:1px solid rgba(177,58,48,0.3)' : 'rgba(33,29,22,0.1);color:var(--data-cyan);border:1px solid rgba(33,29,22,0.2)') + ';">' + (_knIsStale ? 'STALE ' : '') + (KR_THEME_NARRATIVES_META && KR_THEME_NARRATIVES_META.lastUpdated || 'N/A') + ' · 경과 ' + _knStaleDays + '일</span>';

    ss.push('');
    ss.push(' <b>테마 스토리 · 밸류체인 (기관 리서치 톤)</b>' + _krStaleBadge);
    if (_knIsStale) {
      ss.push('<span style="color:var(--data-red);font-size:10px;">narrative 작성일부터 ' + _knStaleDays + '일 경과 — 구체 수치는 AI 채팅/웹검색으로 crosscheck 권장</span>');
    }
    if (kn.why) ss.push('<b>왜 지금 HOT한가:</b> ' + kn.why);
    if (kn.valueChain) ss.push('<b>밸류체인 구조:</b> ' + kn.valueChain);
    if (kn.playerRoles && typeof kn.playerRoles === 'object') {
      var krRolesHtml = Object.keys(kn.playerRoles).map(function(t){
        return '&nbsp;&nbsp;<b>' + t + ':</b> ' + kn.playerRoles[t];
      }).join('<br>');
      ss.push('<b>핵심 플레이어 포지션:</b><br>' + krRolesHtml);
    }

    // 최근 7일 뉴스 자동 표시 (KR_SUB_THEMES의 tickers 활용)
    if (typeof _getThemeNews === 'function' && typeof KR_SUB_THEME_INDEX !== 'undefined') {
      var krTheme = KR_SUB_THEMES[KR_SUB_THEME_INDEX[krNarrKey]];
      if (krTheme && krTheme.tickers) {
        var krRecentNews = _getThemeNews(krTheme.tickers, krTheme.name, 5);
        if (krRecentNews.length > 0) {
          var krNewsHtml = krRecentNews.map(function(n) {
            var dt = n.pubDate ? new Date(n.pubDate) : null;
            var dtStr = dt ? (dt.getMonth()+1) + '/' + dt.getDate() : '';
            return '&nbsp;&nbsp;<span style="color:var(--data-cyan);">[' + dtStr + ']</span> ' + (n.title || '').substring(0, 140) + (n.source ? ' <span style="color:var(--text-muted);font-size:11px;">(' + n.source + ')</span>' : '');
          }).join('<br>');
          ss.push('<b>최근 7일 뉴스 (최근 수집, ' + krRecentNews.length + '건):</b><br>' + krNewsHtml);
        }
      }
    }
  }

  h += ss.map(function(s) {
    if (!s) return '<hr style="border:none;border-top:1px solid var(--surface-4);margin:6px 0;">';
    return '<div style="font-size:11px;color:var(--text-secondary);line-height:1.7;margin-bottom:6px;">' + s + '</div>';
  }).join('');
  h += '</div>';
  return h;
}

// v29.4: Naver Finance 수급 데이터 가져오기 (CORS 프록시 경유)
async function _aioReadKrJsonResponse(r, label) {
  var txt = await r.text();
  var probe = String(txt || '').trimStart();
  if (/^<!doctype\s+html/i.test(probe) || /^<html[\s>]/i.test(probe)) throw new Error((label || 'KR API') + ' HTML block page');
  var data = JSON.parse(txt);
  if (data && typeof data.contents === 'string') {
    var nested = data.contents.trim();
    if (/^<!doctype\s+html/i.test(nested) || /^<html[\s>]/i.test(nested)) throw new Error((label || 'KR API') + ' proxy HTML block page');
    try { data = JSON.parse(nested); } catch(_) {}
  }
  return data;
}

// v52.42 (P657/EF-18): Naver 응답 {bizdate,personalValue,foreignValue,institutionalValue}(단일 당일
// 순매수 스냅샷)을 updateKrSupplyDOM이 기대하는 {xxxBuy,xxxSell} 쌍 형태로 변환 — 순매수값을 Buy에,
// Sell은 0으로 둬 기존 'Buy - Sell' 계산식을 그대로 재사용(다운스트림 포맷팅/코멘트 로직 무변경).
function _aioAdaptKrTrendResponse(raw) {
  if (!raw) return null;
  var num = function(v) {
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(/[,+\s]/g, ''));
    return isFinite(n) ? n : null;
  };
  var foreign = num(raw.foreignValue);
  var institution = num(raw.institutionalValue);
  var individual = num(raw.personalValue);
  if (foreign == null && institution == null && individual == null) return null;
  return {
    foreignBuy: foreign, foreignSell: 0,
    institutionBuy: institution, institutionSell: 0,
    individualBuy: individual, individualSell: 0,
    bizdate: raw.bizdate || null
  };
}

async function fetchKrSupplyData() {
  window._krSupplyFetchState = window._krSupplyFetchState || { inFlight: false, lastAttempt: 0, ok: false };
  var _supplyState = window._krSupplyFetchState;
  if (_supplyState.inFlight) return;
  if (Date.now() - _supplyState.lastAttempt < 10 * 60 * 1000) return;
  _supplyState.inFlight = true;
  _supplyState.lastAttempt = Date.now();
  try {
    // v52.42 (P657/EF-18): 실측(curl) 결과 기존 /investorTrend 경로는 Naver 서버에서 404(프록시/차단이
    // 아니라 경로 자체가 없음) — 개별종목 /api/stock/{code}/trend와 동일 패턴인 /api/index/{시장}/trend가
    // 실제 살아있는 경로임을 확인(200, {bizdate,personalValue,foreignValue,institutionalValue} 반환).
    // 단, 이 경로는 일별 배열이 아니라 당일 스냅샷 1건만 제공 — 아래 kospiHistory엔 null 전달(기존
    // "N거래일 연속" 코멘트는 다일 이력이 없으면 자동 생략되도록 이미 가드돼 있음).
    var kospiUrl = 'https://m.stock.naver.com/api/index/KOSPI/trend';
    var kosdaqUrl = 'https://m.stock.naver.com/api/index/KOSDAQ/trend';

    var kospiData = null, kosdaqData = null;

    // KOSPI fetch — v38.7: 직접 fetch 먼저 시도 (CORS 허용 시), 실패하면 프록시
    try {
      var r1 = null;
      try { r1 = await fetchWithTimeout(kospiUrl, { headers: {'Accept':'application/json'} }, 6000); } catch(e1) {}
      if (!r1 || !r1.ok) r1 = await fetchViaProxy(kospiUrl, 8000);
      if (r1 && r1.ok) {
        var d1 = await _aioReadKrJsonResponse(r1, 'KOSPI trend');
        if (d1 && (d1.foreignValue != null || d1.institutionalValue != null || d1.personalValue != null)) {
          kospiData = _aioAdaptKrTrendResponse(d1);
          window._krSupplyData = kospiData;
        }
      }
    } catch(e) { _aioLog('warn', 'fetch', 'KR KOSPI 수급 fetch 실패 — 프록시 차단 가능: ' + e.message); }

    // KOSDAQ fetch — v38.7: 직접 fetch 먼저 시도
    try {
      var r2 = null;
      try { r2 = await fetchWithTimeout(kosdaqUrl, { headers: {'Accept':'application/json'} }, 6000); } catch(e2) {}
      if (!r2 || !r2.ok) r2 = await fetchViaProxy(kosdaqUrl, 8000);
      if (r2 && r2.ok) {
        var d2 = await _aioReadKrJsonResponse(r2, 'KOSDAQ trend');
        if (d2 && (d2.foreignValue != null || d2.institutionalValue != null || d2.personalValue != null)) {
          kosdaqData = _aioAdaptKrTrendResponse(d2);
          window._krSupplyDataKosdaq = kosdaqData;
        }
      }
    } catch(e) { _aioLog('warn', 'fetch', 'KR KOSDAQ 수급 fetch 실패 — 프록시 차단 가능: ' + e.message); }

    if (kospiData || kosdaqData) {
      _supplyState.ok = true;
      updateKrSupplyDOM(
        kospiData || null,
        kosdaqData || null,
        null
      );
      if (!kospiData) _ensureKrSupplyAnalysisResolved('KOSPI 수급 API가 지연되어 해당 시장의 판단을 보류합니다.');
      console.log('[KR] 수급 데이터 로드 성공 (KOSPI:' + (kospiData?'O':'X') + ', KOSDAQ:' + (kosdaqData?'O':'X') + ')');
      return;
    }

    _aioLog('warn', 'fetch', 'KR 프록시 차단으로 수급 데이터 수집 실패 — 폴백 데이터 사용 중');
    _supplyState.ok = false;
    _showKrSupplyFailureState('Naver index trend 수신 실패 — 프록시 차단 또는 HTML 응답');
    _renderKrWeeklySupplyFallback('KR index trend unavailable');
  } catch(e) {
    _supplyState.ok = false;
    _aioLog('warn', 'fetch', 'KR 프록시 차단으로 수급 데이터 수집 실패 — 폴백 데이터 사용 중: ' + e.message);
    _showKrSupplyFailureState(e && e.message || 'KR supply fetch failed');
    _renderKrWeeklySupplyFallback(e && e.message || 'KR supply fetch failed');
  } finally { _supplyState.inFlight = false; }
  _ensureKrSupplyAnalysisResolved('현재 수급 데이터를 불러오지 못해 판단을 보류합니다.');
}

// v35.5: 수급 데이터 폴백 안내 표시
function _showKrSupplyFallbackNotice() {
  document.querySelectorAll('.kr-supply-fallback-notice').forEach(function(el) { el.remove(); });
  // 실패 설명은 분석 영역 한 곳만 소유한다. 각 표에 같은 경고를 반복하지 않는다.
  var analysisEl = document.getElementById('kr-supply-analysis-text');
  if (analysisEl) analysisEl.innerHTML = '<b style="color:var(--text-primary);">수급 원천 미수신</b> · 값을 표시하거나 현재 판단에 사용하지 않습니다. 최신 값은 Naver 투자자별 매매동향에서 확인하세요.';
}

function _showKrSupplyFailureState(reason) {
  reason = reason || 'KR supply fetch failed';
  window._krCurrentSupplyEvidence = null;
  _showKrSupplyFallbackNotice();
  _renderInvestorFallback(reason);
  var dateEl = document.getElementById('kr-investor-top10-date');
  if (dateEl) dateEl.textContent = '수신 실패';
  // v52.42 (P657/EF-07): kr-home "최근 수급 (KOSPI) — N/D 기준" 제목의 날짜는 DATE_ENGINE의 범용
  // data-date-ref="kr-last-basis"(항상 "마지막 거래일"을 계산해 채움)라 실패 상태와 무관하게 확정 날짜처럼
  // 보였다 — 바로 옆 폴백 경고와 동시에 보이면 "실패인지 N/D 확정치인지" 판단 불가(실측 재현). 실패 시
  // 이 제목의 날짜 부분만 정직하게 대체(다른 화면의 kr-last-basis 사용처는 건드리지 않음).
  document.querySelectorAll('#page-kr-home .kr-supply-title [data-date-ref="kr-last-basis"]').forEach(function(titleDateEl) {
    titleDateEl.textContent = '폴백 데이터';
    titleDateEl.removeAttribute('data-date-ref');
    titleDateEl.style.color = 'var(--data-amber)';
  });
  var analysisEl = document.getElementById('kr-supply-analysis-text');
  if (analysisEl) {
    analysisEl.innerHTML = '수급 데이터 수신 실패 — <span style="color:var(--text-muted);">프록시 차단 또는 Naver HTML 응답 가능성. 아래 값은 참고 폴백이며 실시간 판단 전 원천 확인이 필요합니다.</span>';
  }
  var bannerEl = document.getElementById('kr-supply-alert-banner');
  if (bannerEl) {
    bannerEl.innerHTML = '수급 데이터 수신 실패 · <span style="color:var(--text-muted);">' + escHtml(reason) + '</span>';
    bannerEl.style.color = 'var(--data-amber)';
  }
  // 미수신을 0원/매도 우위로 해석하지 않는다. 정적 숫자는 의사결정 화면에서 제거한다.
  [
    'kr-home-kospi-foreign','kr-home-kospi-inst','kr-home-kospi-retail',
    'kr-home-kosdaq-foreign','kr-home-kosdaq-inst','kr-home-kosdaq-retail',
    'kr-supply-kospi-foreign','kr-supply-kospi-inst','kr-supply-kospi-retail',
    'kr-supply-kosdaq-foreign','kr-supply-kosdaq-inst','kr-supply-kosdaq-retail'
  ].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = '—';
    el.style.color = 'var(--text-muted)';
    var row = el.closest('.kr-investor-row');
    if (!row) return;
    var bar = row.querySelector('.kr-bar-fill');
    if (bar) {
      bar.style.width = '0%';
      bar.classList.remove('kr-bar-buy', 'kr-bar-sell');
      bar.setAttribute('aria-label', '수급 미수신');
      bar.title = '수급 미수신';
    }
    var direction = row.querySelector('.kr-investor-amt');
    if (direction) {
      direction.textContent = '미수신';
      direction.style.color = 'var(--text-muted)';
    }
  });
  var streakEl = document.getElementById('kr-health-foreign-streak');
  if (streakEl) { streakEl.textContent = '수급 미수신'; streakEl.style.color = 'var(--text-muted)'; }
  // 라이브 실패 화면 아래에 정적 기관/프로그램 수치가 현재값처럼 남지 않게 표 자체를 상태행으로 교체한다.
  var instTable = document.getElementById('kr-supply-inst-detail');
  if (instTable) instTable.innerHTML = '<tr><th>기관 유형</th><th>순매수</th><th>비고</th></tr><tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">기관 세부 수급 미수신 · 원천에서 확인</td></tr>';
  var programTable = document.getElementById('kr-supply-program-table');
  if (programTable) programTable.innerHTML = '<tr><th>구분</th><th>매수</th><th>매도</th><th>순매수</th></tr><tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:14px;">프로그램 매매 미수신 · 원천에서 확인</td></tr>';
}

function _ensureKrSupplyAnalysisResolved(reason) {
  var analysisEl = document.getElementById('kr-supply-analysis-text');
  if (!analysisEl) return;
  var txt = (analysisEl.textContent || '').trim();
  if (txt && txt.indexOf('로딩') === -1) return;
  analysisEl.innerHTML = reason || '현재 수급 데이터가 지연되어 판단을 보류합니다.';
  _showKrSupplyFallbackNotice();
}

function updateKrSupplyDOM(kospiTrend, kosdaqTrend, kospiHistory) {
  // v35.8: KOSPI + KOSDAQ + 동적 코멘트 생성

  function formatAmt(v) {
    var abs = Math.abs(v);
    if (abs >= 1e12) return (v > 0 ? '+' : '') + (v/1e12).toFixed(1) + '조';
    if (abs >= 1e8) return (v > 0 ? '+' : '') + Math.round(v/1e8).toLocaleString() + '억';
    return (v > 0 ? '+' : '') + Math.round(v/1e4).toLocaleString() + '만';
  }
  function _updateEl(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatAmt(val);
    el.style.color = val >= 0 ? 'var(--green)' : 'var(--red)';
  }
  function _updateBar(id, val, maxAbs) {
    var el = document.getElementById(id);
    if (!el) return;
    var pct = Math.min(Math.round(Math.abs(val) / maxAbs * 100), 100);
    el.style.width = pct + '%';
    el.className = 'kr-bar-fill ' + (val >= 0 ? 'kr-bar-buy' : 'kr-bar-sell');
  }

  // ── KOSPI 수급 ──
  if (kospiTrend) {
    var fNet = (kospiTrend.foreignBuy || 0) - (kospiTrend.foreignSell || 0);
    var iNet = (kospiTrend.institutionBuy || 0) - (kospiTrend.institutionSell || 0);
    var pNet = (kospiTrend.individualBuy || 0) - (kospiTrend.individualSell || 0);
    var maxAbs = Math.max(Math.abs(fNet), Math.abs(iNet), Math.abs(pNet), 1);
    window._krCurrentSupplyEvidence = { foreignNet: fNet, institutionNet: iNet, retailNet: pNet, observedAt: Date.now(), source: 'Naver investor trend' };
    // kr-home + kr-supply 동시 업데이트
    _updateEl('kr-home-kospi-foreign', fNet);
    _updateEl('kr-home-kospi-inst', iNet);
    _updateEl('kr-home-kospi-retail', pNet);
    _updateEl('kr-supply-kospi-foreign', fNet);
    _updateEl('kr-supply-kospi-inst', iNet);
    _updateEl('kr-supply-kospi-retail', pNet);
    _updateBar('kr-home-kospi-foreign-bar', fNet, maxAbs);
    _updateBar('kr-home-kospi-inst-bar', iNet, maxAbs);
    _updateBar('kr-home-kospi-retail-bar', pNet, maxAbs);
    _updateBar('kr-supply-kospi-foreign-bar', fNet, maxAbs);
    _updateBar('kr-supply-kospi-inst-bar', iNet, maxAbs);
    _updateBar('kr-supply-kospi-retail-bar', pNet, maxAbs);

    // ── KOSPI 동적 코멘트 생성 ──
    var kospiComment = '';
    var foreignStreakDays = 0;
    if (kospiHistory && kospiHistory.length > 1) {
      for (var si = 0; si < kospiHistory.length && si < 20; si++) {
        var ht = kospiHistory[si];
        var hfNet = (ht.foreignBuy || 0) - (ht.foreignSell || 0);
        if ((fNet < 0 && hfNet < 0) || (fNet > 0 && hfNet > 0)) foreignStreakDays++;
        else break;
      }
    }
    if (fNet < 0) {
      kospiComment = '외국인 ' + (foreignStreakDays > 1 ? foreignStreakDays + '거래일 연속 ' : '') + '순매도 (' + formatAmt(fNet) + ')';
    } else {
      kospiComment = '외국인 ' + (foreignStreakDays > 1 ? foreignStreakDays + '거래일 연속 ' : '') + '순매수 (' + formatAmt(fNet) + ')';
    }
    var comment2 = '';
    if (pNet > 0 && fNet < 0 && iNet < 0) comment2 = '개인이 홀로 매수 방어';
    else if (fNet > 0 && iNet > 0) comment2 = '외국인·기관 동반 매수';
    else if (fNet < 0 && iNet < 0) comment2 = '외국인·기관 동반 매도';
    else if (iNet > 0) comment2 = '기관 매수 우세';

    var c1 = document.getElementById('kr-home-kospi-comment');
    if (c1) { c1.textContent = kospiComment; c1.style.color = fNet < 0 ? 'var(--red)' : 'var(--green)'; c1.style.fontWeight = '700'; }
    var c2 = document.getElementById('kr-home-kospi-comment2');
    if (c2 && comment2) c2.textContent = comment2;
    var c3 = document.getElementById('kr-idx-kospi-comment');
    if (c3) c3.textContent = (fNet < 0 ? '외국인 순매도' : '외국인 순매수') + ' · ' + formatAmt(fNet);
    // 외국인 연속매매 건강지표
    var streakEl = document.getElementById('kr-health-foreign-streak');
    if (streakEl) {
      streakEl.textContent = foreignStreakDays + '일 연속 ' + (fNet < 0 ? '매도' : '매수');
      streakEl.style.color = fNet < 0 ? 'var(--red)' : 'var(--green)';
    }
    // 수급 종합 분석 텍스트
    var analysisEl = document.getElementById('kr-supply-analysis-text');
    if (analysisEl) {
      var parts = [];
      // 1) 주체별 수급 요약
      var mainBuyer = fNet > 0 && iNet > 0 ? '외국인·기관 동반 매수' :
                      fNet > 0 ? '외국인 주도 매수' :
                      iNet > 0 ? '기관 주도 매수' :
                      pNet > 0 ? '개인 주도 매수 (역방향 주의)' : '전 주체 매도 우위';
      parts.push('<b>오늘의 수급:</b> ' + mainBuyer);
      parts.push('외국인 ' + formatAmt(fNet) + ' · 기관 ' + formatAmt(iNet) + ' · 개인 ' + formatAmt(pNet));
      // 2) 연속성 분석
      if (foreignStreakDays > 1) {
        var streakSignal = foreignStreakDays >= 5 ? '강한 추세 형성' : foreignStreakDays >= 3 ? '방향성 확인' : '초기 단계';
        parts.push(' 외국인 <b>' + foreignStreakDays + '거래일 연속 ' + (fNet < 0 ? '순매도' : '순매수') + '</b> — ' + streakSignal);
      }
      // 3) 수급 시그널 해석
      if (fNet > 0 && iNet > 0) {
        parts.push(' <b>긍정 시그널:</b> 외국인+기관 동반 매수는 강한 상승 신호. 개인만 반대로 움직이면 시장 방향은 기관 쪽을 따를 가능성 높음.');
      } else if (fNet < 0 && iNet < 0) {
        parts.push(' <b>경고 시그널:</b> 외국인+기관 동시 매도. 개인이 사고 있지만, 스마트머니의 이탈은 하락 리스크를 시사.');
      } else if (fNet > 0 && iNet < 0) {
        parts.push(' <b>혼조:</b> 외국인 매수 vs 기관 매도 — 외국인은 중장기, 기관은 단기 차익실현 가능성.');
      } else if (fNet < 0 && iNet > 0) {
        parts.push(' <b>혼조:</b> 기관 매수 vs 외국인 매도 — 환율 영향 또는 글로벌 리스크오프 가능성.');
      }
      // 4) 개인 비중 경고
      var totalAbs = Math.abs(fNet) + Math.abs(iNet) + Math.abs(pNet);
      if (totalAbs > 0 && pNet > 0 && Math.abs(pNet) / totalAbs > 0.6) {
        parts.push('개인 순매수 비중이 높음 — 역사적으로 개인 편중 매수 후 단기 조정 확률 상승.');
      }
      analysisEl.innerHTML = parts.join('<br>');
    }
    // 알림 배너
    var bannerEl = document.getElementById('kr-supply-alert-banner');
    if (bannerEl) {
      var bannerText = '' + kospiComment;
      if (window._vkospiLiveOk && typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.vkospi) bannerText += ' · VKOSPI ' + DATA_SNAPSHOT.vkospi.toFixed(1);
      bannerEl.innerHTML = bannerText + ' · <span data-date-ref="kr-last-basis">종가 기준</span> 실시간';
      bannerEl.style.color = fNet < 0 ? 'var(--red)' : 'var(--green)';
    }
  }

  // ── KOSDAQ 수급 ──
  if (kosdaqTrend) {
    var kqF = (kosdaqTrend.foreignBuy || 0) - (kosdaqTrend.foreignSell || 0);
    var kqI = (kosdaqTrend.institutionBuy || 0) - (kosdaqTrend.institutionSell || 0);
    var kqP = (kosdaqTrend.individualBuy || 0) - (kosdaqTrend.individualSell || 0);
    var kqMax = Math.max(Math.abs(kqF), Math.abs(kqI), Math.abs(kqP), 1);
    // kr-home KOSDAQ
    _updateEl('kr-home-kosdaq-foreign', kqF);
    _updateEl('kr-home-kosdaq-inst', kqI);
    _updateEl('kr-home-kosdaq-retail', kqP);
    _updateBar('kr-home-kosdaq-foreign-bar', kqF, kqMax);
    _updateBar('kr-home-kosdaq-inst-bar', kqI, kqMax);
    _updateBar('kr-home-kosdaq-retail-bar', kqP, kqMax);
    // kr-supply KOSDAQ
    _updateEl('kr-supply-kosdaq-foreign', kqF);
    _updateEl('kr-supply-kosdaq-inst', kqI);
    _updateEl('kr-supply-kosdaq-retail', kqP);
    _updateBar('kr-supply-kosdaq-foreign-bar', kqF, kqMax);
    _updateBar('kr-supply-kosdaq-inst-bar', kqI, kqMax);
    _updateBar('kr-supply-kosdaq-retail-bar', kqP, kqMax);
    // KOSDAQ 코멘트
    var kqComment = '';
    if (kqF < 0 && kqI < 0) kqComment = '외국인/기관 동반 매도 · 개인 ' + (kqP > 0 ? '방어' : '동반 매도');
    else if (kqF > 0 && kqI > 0) kqComment = '외국인·기관 동반 매수';
    else if (kqP > 0) kqComment = '개인 매수 우세 · ' + formatAmt(kqP);
    else kqComment = '외국인 ' + formatAmt(kqF) + ' · 기관 ' + formatAmt(kqI);
    var kqC = document.getElementById('kr-home-kosdaq-comment');
    if (kqC) kqC.textContent = kqComment;
    var kqIdxC = document.getElementById('kr-idx-kosdaq-comment');
    if (kqIdxC) kqIdxC.textContent = (kqF < 0 ? '외국인 순매도' : '외국인 순매수') + ' · ' + formatAmt(kqF);
  }

  // ── 기관 세분화 테이블 동적 업데이트 ──
  // Naver investorTrend는 기관 총합만 제공 — 세분화(투신/연기금/보험/은행)는 제공 안 됨
  // kospiTrend에 세부 필드가 있을 때만 업데이트, 없으면 데이터 날짜 표시
  if (kospiTrend) {
    var instTable = document.getElementById('kr-supply-inst-detail');
    if (instTable) {
      var hasDetail = kospiTrend.investmentTrustBuy || kospiTrend.pensionBuy || kospiTrend.insuranceBuy;
      if (hasDetail) {
        var itNet = (kospiTrend.investmentTrustBuy || 0) - (kospiTrend.investmentTrustSell || 0);
        var penNet = (kospiTrend.pensionBuy || 0) - (kospiTrend.pensionSell || 0);
        var insNet = (kospiTrend.insuranceBuy || 0) - (kospiTrend.insuranceSell || 0);
        var bankNet = (kospiTrend.bankBuy || 0) - (kospiTrend.bankSell || 0);
        function _instRow(name, val, note) {
          var c = val >= 0 ? 'var(--green)' : 'var(--red)';
          return '<tr><td>' + name + '</td><td style="color:' + c + '">' + formatAmt(val) + '</td><td style="color:var(--text-muted);">' + note + '</td></tr>';
        }
        instTable.innerHTML = '<tr><th>기관 유형</th><th>순매수</th><th>비고</th></tr>'
          + _instRow('투신(펀드)', itNet, itNet < 0 ? '환매 압박' : '유입')
          + _instRow('연기금', penNet, penNet > 0 ? '저점 매수' : '매도')
          + _instRow('보험', insNet, insNet < 0 ? '포지션 축소' : '매수')
          + _instRow('은행', bankNet, Math.abs(bankNet) < 5e9 ? '소규모' : '활발');
      }
      // 세부 데이터 없어도 기관 합계는 표시
      else {
        var iNetTotal = (kospiTrend.institutionBuy || 0) - (kospiTrend.institutionSell || 0);
        var iColor = iNetTotal >= 0 ? 'var(--green)' : 'var(--red)';
        instTable.innerHTML = '<tr><th>기관 유형</th><th>순매수</th><th>비고</th></tr>'
          + '<tr><td>기관 합계</td><td style="color:' + iColor + '">' + formatAmt(iNetTotal) + '</td><td style="color:var(--text-muted);">세부 분류: 장 마감 후 반영</td></tr>';
      }
    }

    // ── 프로그램 매매 테이블 동적 업데이트 ──
    var progTable = document.getElementById('kr-supply-program-table');
    if (progTable) {
      var hasProg = kospiTrend.programBuy || kospiTrend.arbitrageBuy;
      if (hasProg) {
        var arbBuy = kospiTrend.arbitrageBuy || 0, arbSell = kospiTrend.arbitrageSell || 0;
        var nonArbBuy = kospiTrend.nonArbitrageBuy || 0, nonArbSell = kospiTrend.nonArbitrageSell || 0;
        var arbNet = arbBuy - arbSell, nonArbNet = nonArbBuy - nonArbSell, progNet = arbNet + nonArbNet;
        function _progTd(val) { return '<td style="color:' + (val >= 0 ? 'var(--green)' : 'var(--red)') + '">' + formatAmt(val) + '</td>'; }
        progTable.innerHTML = '<tr><th>구분</th><th>매수</th><th>매도</th><th>순매수</th></tr>'
          + '<tr><td>차익거래</td>' + _progTd(arbBuy) + _progTd(-arbSell) + _progTd(arbNet) + '</tr>'
          + '<tr><td>비차익거래</td>' + _progTd(nonArbBuy) + _progTd(-nonArbSell) + _progTd(nonArbNet) + '</tr>'
          + '<tr><td style="font-weight:600">합계</td><td></td><td></td>' + _progTd(progNet).replace('>', ' font-weight:600">') + '</tr>';
      } else {
        // 프로그램 데이터 없으면 총합만 표시
        var progNet2 = (kospiTrend.programBuy || 0) - (kospiTrend.programSell || 0);
        if (kospiTrend.programBuy || kospiTrend.programSell) {
          var pc = progNet2 >= 0 ? 'var(--green)' : 'var(--red)';
          progTable.innerHTML = '<tr><th>구분</th><th>매수</th><th>매도</th><th>순매수</th></tr>'
            + '<tr><td>프로그램 합계</td><td>—</td><td>—</td><td style="color:' + pc + ';font-weight:600">' + formatAmt(progNet2) + '</td></tr>';
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// v35.7: 한국 시장 동적 데이터 fetch 모듈
// VKOSPI · 거래대금 · 외국인 TOP · 주간 수급 · 공매도 (네이버 API + 프록시 체인)
// ══════════════════════════════════════════════════════════════════

// FABLE-LIVE-AUDIT-2026-07-07 F3/L4: kr-vkospi-chart는 2026-05-08~06-05 20거래일이 하드코딩된
// 정적 배열(initKrVkospiChart 내부)이라 시간이 지나도 절대 갱신되지 않는다(다른 히스토리 차트와
// 달리 public-data/history.json에 vkospi 필드 자체가 없음 — 서버 크론에 신규 Naver 호출을 추가하는
// 것은 무인 프로덕션 파이프라인에 새 실패 지점을 만드는 리스크가 커 이번엔 배제). 서버 대신
// 이미 정상 동작 중인 이 함수의 성공 시점마다 클라이언트 localStorage에 날짜별로 upsert 누적하고,
// 아래 initKrVkospiChart()가 실데이터가 충분(>=3일)하면 하드코딩 배열 대신 그걸 우선 사용하도록 배선.
var AIO_VKOSPI_HIST_KEY = 'aio_vkospi_hist_v1';
var AIO_VKOSPI_HIST_CAP = 60; // ~3개월치 상한
function _aioAppendVkospiHistory(val) {
  try {
    var today = new Date().toISOString().slice(0, 10);
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem(AIO_VKOSPI_HIST_KEY) || '[]'); if (!Array.isArray(hist)) hist = []; } catch(_) { hist = []; }
    var idx = hist.findIndex(function(h) { return h && h.date === today; });
    if (idx >= 0) hist[idx].value = val; else hist.push({ date: today, value: val });
    hist.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (hist.length > AIO_VKOSPI_HIST_CAP) hist = hist.slice(hist.length - AIO_VKOSPI_HIST_CAP);
    localStorage.setItem(AIO_VKOSPI_HIST_KEY, JSON.stringify(hist));
  } catch(_) { /* localStorage 미지원/쿼터 초과 — 조용히 스킵, 차트는 기존 시드로 폴백 */ }
}
function _aioGetVkospiHistorySeries(minPoints) {
  try {
    var hist = JSON.parse(localStorage.getItem(AIO_VKOSPI_HIST_KEY) || '[]');
    if (!Array.isArray(hist) || hist.length < (minPoints || 3)) return null;
    return {
      labels: hist.map(function(h) { var p = h.date.split('-'); return Number(p[1]) + '/' + Number(p[2]); }),
      data: hist.map(function(h) { return h.value; })
    };
  } catch(_) { return null; }
}

// v52.34 P649: VKOSPI 실패 상태 추적 (FABLE-UIUX-DEEP-AUDIT-2026-07-08 §5 V1 Failure UI contract).
// N회 연속 실패 시 정지된 시드/직전값을 "정상"처럼 계속 보여주는 대신 수신 실패를 명시한다.
var AIO_VKOSPI_FAIL_THRESHOLD = 3;
var _vkospiFailCount = 0;
var _vkospiLastOkTs = null;
function _vkospiIsFailedState() { return _vkospiFailCount >= AIO_VKOSPI_FAIL_THRESHOLD; }
function _showVkospiFailureState(reason) {
  // P1142: 실패 상태 진입 시 라이브 플래그를 해제한다 — 성공 시 켜진 _vkospiLiveOk가
  // 실패 후에도 true로 남아 배너/채팅이 정지된 스냅샷 값을 현재값처럼 인용하는 것을 방지(P713 계약 유지).
  window._vkospiLiveOk = false;
  var lastOkText = _vkospiLastOkTs ? ('마지막 성공 ' + new Date(_vkospiLastOkTs).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })) : '성공 이력 없음';
  var fullReason = (reason || '프록시/데이터 실패') + ' · ' + lastOkText;
  var vEl = document.getElementById('kr-vkospi-val');
  var hEl = document.getElementById('kr-health-vkospi');
  if (vEl) window._aioRenderValueSlot(vEl, 'failed', null, { reason: fullReason });
  if (hEl) window._aioRenderValueSlot(hEl, 'failed', null, { reason: fullReason });
}

// ── 1. VKOSPI 실시간 값 + 차트 데이터 ──
async function fetchVkospiDynamic() {
  try {
    var url = 'https://m.stock.naver.com/api/index/VKOSPI/basic';
    var r = await fetchViaProxy(url, 8000);
    if (!r || !r.ok) { _vkospiFailCount++; if (_vkospiIsFailedState()) _showVkospiFailureState('프록시 응답 실패'); return; }
    var d = await _aioReadKrJsonResponse(r, 'VKOSPI basic');
    var val = parseFloat(d.closePrice || d.now || d.indexValue);
    if (!val || isNaN(val)) { _vkospiFailCount++; if (_vkospiIsFailedState()) _showVkospiFailureState('응답 값 파싱 실패'); return; }
    _vkospiFailCount = 0;
    _vkospiLastOkTs = Date.now();
    // DOM 업데이트 — VKOSPI 값 표시 요소들
    var vEl = document.getElementById('kr-vkospi-val');
    if (vEl) window._aioRenderValueSlot(vEl, 'value', val.toFixed(2), { color: val >= 35 ? 'var(--red)' : val >= 25 ? 'var(--data-amber)' : val >= 15 ? 'var(--data-amber)' : 'var(--green)' });
    var hEl = document.getElementById('kr-health-vkospi');
    // v49.58 P278: 임계값 표준화 (정상<20 / 경계 20~25 / 공포 25~35 / 극단공포 35+) — calcKrHealth 정합
    if (hEl) { var label = val >= 35 ? '극단공포' : val >= 25 ? '공포' : val >= 20 ? '경계' : '정상'; window._aioRenderValueSlot(hEl, 'value', val.toFixed(2) + ' (' + label + ')', { color: val >= 35 ? 'var(--red)' : val >= 25 ? 'var(--data-red)' : val >= 20 ? 'var(--data-amber)' : 'var(--green)' }); }
    // DATA_SNAPSHOT 동기화 — live 성공 플래그(P713): 배너/채팅 컨텍스트는 이 플래그가
    // true일 때만 vkospi를 현재값으로 사용한다(시드 16.00이 라벨 없이 노출되는 것 방지).
    if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT.vkospi = val;
    window._vkospiLiveOk = true;
    _aioAppendVkospiHistory(val);
    console.log('[KR] VKOSPI 동적 업데이트:', val);
  } catch(e) {
    _vkospiFailCount++;
    if (_vkospiIsFailedState()) _showVkospiFailureState('fetch 예외: ' + e.message);
    _aioLog('warn', 'fetch', 'KR VKOSPI fetch 실패: ' + e.message);
  }
}

// ── 3. 외국인/기관 순매수 TOP 10 (종목별 trend API 기반) ──
// v41.9: 죽은 investorBuyRanking 엔드포인트 → 개별 종목 trend 배치 fetch로 교체
var _krInvestorCache = { data: null, ts: 0 };
var _KR_INVESTOR_CACHE_TTL = 600000; // 10분 캐시

async function fetchKrInvestorTop10() {
  window._krInvestorFetchState = window._krInvestorFetchState || { inFlight: false, lastAttempt: 0 };
  var _investorState = window._krInvestorFetchState;
  if (_krInvestorCache.data && Date.now() - _krInvestorCache.ts < _KR_INVESTOR_CACHE_TTL) {
    _renderInvestorTop10(_krInvestorCache.data);
    return;
  }
  if (_investorState.inFlight) return;
  if (Date.now() - _investorState.lastAttempt < _KR_INVESTOR_CACHE_TTL) {
    _renderInvestorFallback('10분 재시도 대기 중');
    return;
  }
  _investorState.inFlight = true;
  _investorState.lastAttempt = Date.now();
  try {
    // 캐시 유효하면 재사용
    if (_krInvestorCache.data && Date.now() - _krInvestorCache.ts < _KR_INVESTOR_CACHE_TTL) {
      _renderInvestorTop10(_krInvestorCache.data);
      return;
    }

    window._krInvestorCircuit = window._krInvestorCircuit || { failUntil: 0, attempts: 0 };
    if (Date.now() < window._krInvestorCircuit.failUntil) {
      _renderInvestorFallback('브라우저 요청 제한 중');
      return;
    }
    // 브라우저에서 100+30건을 연쇄 호출하던 경로를 상위 24건으로 제한한다.
    var codes = Object.keys(KR_STOCK_DB);
    var sorted = codes.map(function(c) {
      var d = KR_STOCK_DB[c];
      var m = String(d.mcap || '0');
      var val = parseFloat(m.replace(/[^0-9.]/g, '')) || 0;
      if (m.indexOf('조') !== -1) val *= 1e12;
      else if (m.indexOf('억') !== -1) val *= 1e8;
      return { code: c, mcapVal: val, name: d.name };
    }).sort(function(a, b) { return b.mcapVal - a.mcapVal; });
    var top100 = sorted.slice(0, 24);

    // 6개씩 4배치. 알려진 CORS 실패 뒤에는 세션 회로를 열어 요청 폭주를 막는다.
    var results = [];
    var BATCH = 6;
    for (var i = 0; i < top100.length; i += BATCH) {
      var batch = top100.slice(i, i + BATCH);
      var promises = batch.map(function(s) {
        var url = 'https://m.stock.naver.com/api/stock/' + s.code + '/trend';
        return fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 2500)
          .then(function(r) { return r && r.ok ? r.json() : null; })
          .catch(function() { return null; });
      });
      var batchResults = await Promise.allSettled(promises);
      batchResults.forEach(function(r, idx) {
        var item = batch[idx];
        var d = r.status === 'fulfilled' ? r.value : null;
        if (!d || !Array.isArray(d) || d.length === 0) return;
        var today = d[0]; // 최신 거래일 데이터
        var fQuant = _parseKrNum(today.foreignerPureBuyQuant);
        var oQuant = _parseKrNum(today.organPureBuyQuant);
        var price = _parseKrNum(today.closePrice);
        var fHold = today.foreignerHoldRatio || '—';
        if (price <= 0) return;
        results.push({
          code: item.code,
          name: item.name,
          fQuant: fQuant,
          oQuant: oQuant,
          fAmt: fQuant * price,
          oAmt: oQuant * price,
          price: price,
          fHold: fHold,
          bizdate: today.bizdate || ''
        });
      });
    }

    if (results.length === 0) {
      // 종목 24건 뒤 공용 프록시를 종목별로 재순회하면 실패 요청이 5배 증폭된다.
      // 종목 수급은 직접 CORS 성공만 채택하고, 실패 시 서버 캐시 도입 전까지 명시적 폴백으로 종료한다.
      _aioLog('warn', 'fetch', 'KR 투자자 TOP10: 유효 데이터 없음 — 종목별 공용 프록시 연쇄 호출 생략');
    }

    if (results.length > 0) {
      _krInvestorCache = { data: results, ts: Date.now() };
      _renderInvestorTop10(results);
      console.log('[KR] 투자자 TOP10 완료 (' + results.length + '종목 수집, 기준일: ' + (results[0].bizdate || '?') + ')');
    } else {
      _aioLog('warn', 'fetch', 'KR 투자자 TOP10: 데이터 수집 실패');
      window._krInvestorCircuit.failUntil = Date.now() + 10 * 60 * 1000;
      window._krInvestorCircuit.attempts += top100.length;
      _renderInvestorFallback();
    }
  } catch(e) {
    _aioLog('warn', 'fetch', 'KR fetchKrInvestorTop10 실패: ' + e.message);
    _renderInvestorFallback();
  } finally { _investorState.inFlight = false; }
}

// v48.57: kr-investor 3개 테이블 fallback (API 실패 시 "로딩 중..." 영구 잔존 방지)
function _renderInvestorFallback(reason) {
  var msg = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:11px;line-height:1.6;">네이버 수급 데이터 수신 실패<br><span style="font-size:10px;opacity:0.7;">' + escHtml(reason || '장 마감 후 또는 API 장애') + ' · 최신 Naver/거래소 원천 확인 필요</span></div>';
  ['kr-investor-foreign-buy','kr-investor-organ-buy','kr-foreign-hold-top10'].forEach(function(id){
    var el = document.getElementById(id);
    if (el && (!el.children.length || /로딩 중|수신 대기/.test(el.textContent || ''))) el.innerHTML = msg;
  });
}

// 네이버 숫자 문자열 파서: "+516,352" → 516352, "-1,400,484" → -1400484
function _parseKrNum(s) {
  if (s == null) return 0;
  return parseInt(String(s).replace(/,/g, '').replace(/\+/g, ''), 10) || 0;
}

// 금액 포맷: 원 → 억/조 표시
function _fmtKrAmt(v) {
  var abs = Math.abs(v);
  if (abs >= 1e12) return (v > 0 ? '+' : '') + (v / 1e12).toFixed(2) + '조';
  if (abs >= 1e8) return (v > 0 ? '+' : '') + Math.round(v / 1e8).toLocaleString() + '억';
  if (abs >= 1e4) return (v > 0 ? '+' : '') + Math.round(v / 1e4).toLocaleString() + '만';
  return (v > 0 ? '+' : '') + Math.round(v).toLocaleString();
}

// 수량 포맷: 만주/천주 표시
function _fmtKrQuant(v) {
  var abs = Math.abs(v);
  var sign = v >= 0 ? '+' : '';
  if (abs >= 10000) return sign + Math.round(v / 10000).toLocaleString() + '만주';
  if (abs >= 1000) return sign + (v / 1000).toFixed(1) + '천주';
  return sign + v.toLocaleString() + '주';
}

function _renderInvestorTop10(results) {
  // 외국인 순매수 TOP 10 (금액 기준 내림차순)
  var fBuy = results.filter(function(r) { return r.fAmt > 0; })
    .sort(function(a, b) { return b.fAmt - a.fAmt; }).slice(0, 10);
  _fillInvestorTable('kr-investor-foreign-buy', fBuy, 'foreign', 'buy');

  // 기관 순매수 TOP 10
  var oBuy = results.filter(function(r) { return r.oAmt > 0; })
    .sort(function(a, b) { return b.oAmt - a.oAmt; }).slice(0, 10);
  _fillInvestorTable('kr-investor-organ-buy', oBuy, 'organ', 'buy');

  // 외국인 보유비중 TOP 10 (fHold 기준 내림차순)
  var fHoldTop = results.filter(function(r) { return r.fHold && r.fHold !== '—'; })
    .map(function(r) { var pct = parseFloat(String(r.fHold).replace('%', '')) || 0; return { code: r.code, name: r.name, fHoldPct: pct, fAmt: r.fAmt, fQuant: r.fQuant }; })
    .sort(function(a, b) { return b.fHoldPct - a.fHoldPct; }).slice(0, 10);
  _fillHoldTable('kr-foreign-hold-top10', fHoldTop);

  // 기준일 표시
  var dateEl = document.getElementById('kr-investor-top10-date');
  if (dateEl && results.length > 0 && results[0].bizdate) {
    var bd = results[0].bizdate;
    dateEl.textContent = bd.substring(0, 4) + '.' + bd.substring(4, 6) + '.' + bd.substring(6, 8);
  }
}

function _fillHoldTable(tableId, items) {
  var tbl = document.getElementById(tableId);
  if (!tbl) return;
  var rows = '<tr><th>#</th><th>종목</th><th>외인비중</th><th>순매수 금액</th></tr>';
  items.forEach(function(item, idx) {
    var amtColor = item.fAmt >= 0 ? 'var(--green)' : 'var(--red)';
    rows += '<tr>'
      + '<td style="color:var(--text-muted);width:24px;">' + (idx + 1) + '</td>'
      + '<td style="font-weight:600;">' + escHtml(item.name) + '</td>'
      + '<td style="font-family:var(--font-mono);text-align:right;">' + item.fHoldPct.toFixed(1) + '%</td>'
      + '<td style="color:' + amtColor + ';font-family:var(--font-mono);text-align:right;">' + _fmtKrAmt(item.fAmt) + '</td>'
      + '</tr>';
  });
  tbl.innerHTML = rows;
}

function _fillInvestorTable(tableId, items, investorType, direction) {
  var tbl = document.getElementById(tableId);
  if (!tbl) return;
  var isForeign = investorType === 'foreign';
  var label = isForeign ? '순매수 금액' : '순매수 금액';
  var rows = '<tr><th>#</th><th>종목</th><th>' + label + '</th><th>순매수 수량</th></tr>';
  if (items.length === 0) {
    rows += '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;font-size:11px;">실시간 순매수 데이터 없음 또는 수신 실패</td></tr>';
  }
  items.forEach(function(item, idx) {
    var amt = isForeign ? item.fAmt : item.oAmt;
    var quant = isForeign ? item.fQuant : item.oQuant;
    var amtColor = amt >= 0 ? 'var(--green)' : 'var(--red)';
    rows += '<tr>'
      + '<td style="color:var(--text-muted);width:24px;">' + (idx + 1) + '</td>'
      + '<td style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">' + escHtml(item.name) + ' <span style="color:var(--text-muted);font-weight:400;font-size:10px;">' + item.code + '</span></td>'
      + '<td style="color:' + amtColor + ';font-family:var(--font-mono);text-align:right;font-weight:600;">' + _fmtKrAmt(amt) + '</td>'
      + '<td style="color:var(--text-muted);font-family:var(--font-mono);text-align:right;font-size:11px;">' + _fmtKrQuant(quant) + '</td>'
      + '</tr>';
  });
  tbl.innerHTML = rows;
}

function _renderKrWeeklySupplyFallback(reason) {
  var tbl = document.getElementById('kr-weekly-supply-table');
  if (tbl) {
    tbl.setAttribute('data-runtime-state', 'unavailable');
    tbl.setAttribute('data-source-kind', 'runtime');
    tbl.setAttribute('data-operational-use', 'blocked');
    tbl.setAttribute('data-source-label', 'KR weekly supply runtime unavailable');
    tbl.setAttribute('title', 'API 미수신 상태에서는 값을 표시하지 않습니다.');
    tbl.innerHTML = '<tr><th>날짜</th><th>외국인</th><th>기관</th><th>개인</th><th>프로그램</th><th>KOSPI</th></tr>'
      + '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px;font-size:11px;line-height:1.6;">주간 수급 데이터 수신 실패<br><span style="font-size:10px;opacity:.72;">' + escHtml(reason || 'API unavailable') + ' · 최신 Naver/거래소 데이터 확인 필요</span></td></tr>';
  }
  var weeklyComment = document.getElementById('kr-weekly-supply-comment');
  if (weeklyComment) {
    weeklyComment.textContent = '주간 수급 API 수신 실패 · 값과 판단을 표시하지 않음 · 최신 Naver/거래소 데이터 확인 필요';
    weeklyComment.style.color = 'var(--text-muted)';
    weeklyComment.style.background = 'rgba(33,29,22,0.08)';
  }
}

window.AIO = window.AIO || {};
window.AIO.getKrSupplyRuntimeAudit = function() {
  var issues = [];
  var state = window._krSupplyFetchState || null;
  var evidence = window._krCurrentSupplyEvidence || null;
  var ageMs = evidence && evidence.observedAt ? Date.now() - Number(evidence.observedAt) : null;
  var valid = !!(evidence && Number.isFinite(Number(evidence.foreignNet)) && Number.isFinite(Number(evidence.institutionNet)) && ageMs >= 0 && ageMs < 86400000);
  if (state && state.lastAttempt && !state.inFlight && !valid) {
    issues.push({ type: 'kr-supply-evidence-unavailable', lastAttempt: state.lastAttempt, ok: state.ok === true });
  }
  return {
    status: state && state.inFlight ? 'pending' : (issues.length ? 'warn' : 'ok'),
    issueCount: issues.length,
    issues: issues,
    evidenceAvailable: valid,
    evidenceAgeMs: ageMs,
    generatedAt: new Date().toISOString()
  };
};

// ── 5. 시가총액 동적 추출 (fetchKrNaverQuotes 결과에서 확장) ──
// fetchKrNaverQuotes의 개별 종목 응답에서 marketCap 필드를 추출하여 KR_STOCK_DB에 반영
function _enrichMarketCap(code, data) {
  if (!data) return;
  // v46.4: 쉼표/공백 포함 문자열 파싱 방어
  var mcapRaw = String(data.marketCap || data.marketCapitalization || '0').replace(/[,\s]/g, '');
  var mcap = parseFloat(mcapRaw);
  if (!isFinite(mcap) || mcap <= 0) return;
  // KR_STOCK_DB에서 해당 종목 찾아 시총 업데이트
  if (typeof KR_STOCK_DB !== 'undefined') {
    var sym = code + (code.length === 6 ? '.KS' : '');
    for (var i = 0; i < KR_STOCK_DB.length; i++) {
      if (KR_STOCK_DB[i].code === code || KR_STOCK_DB[i].sym === sym) {
        KR_STOCK_DB[i].mcap = Math.round(mcap / 1e12 * 10) / 10; // 조원 단위
        break;
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// v29.4: Korean Market Data — 대폭 강화
// ══════════════════════════════════════════════════════════════════
// Naver Finance API + Yahoo Finance .KS/.KQ + 동적 테마 계산
// ──────────────────────────────────────────────────────────────────

// ── 1. 한국 종목 DB (2026-03-27 종가 기준 반영) ──
var KR_STOCK_DB = {
  // ════════ 반도체 (12) ════════
  '005930': {name:'삼성전자', sector:'반도체', themes:['semi','ai-sw']},
  '000660': {name:'SK하이닉스', sector:'반도체', themes:['semi']},
  '042700': {name:'한미반도체', sector:'반도체장비', themes:['semi']},
  '403870': {name:'HPSP', sector:'반도체장비', themes:['semi']},
  '039030': {name:'이오테크닉스', sector:'반도체장비', themes:['semi']},
  '000990': {name:'DB하이텍', sector:'파운드리', themes:['semi']},
  '009150': {name:'삼성전기', sector:'MLCC', themes:['semi']},
  '058470': {name:'리노공업', sector:'반도체장비', themes:['semi']},
  '240810': {name:'원익IPS', sector:'반도체장비', themes:['semi']},
  '036930': {name:'주성엔지니어링', sector:'반도체장비', themes:['semi']},
  '131970': {name:'테크윙', sector:'반도체장비', themes:['semi']},
  '005290': {name:'동진쎄미켐', sector:'반도체소재', themes:['semi']},
  '007660': {name:'이수페타시스', sector:'서버용PCB', themes:['semi']},
  '095340': {name:'ISC', sector:'반도체테스트', themes:['semi']},
  // ════════ 방산 (7) ════════
  '012450': {name:'한화에어로스페이스', sector:'방산', themes:['defense']},
  '047810': {name:'한국항공우주(KAI)', sector:'방산', themes:['defense']},
  '079550': {name:'LIG넥스원', sector:'방산', themes:['defense']},
  '064350': {name:'현대로템', sector:'방산', themes:['defense']},
  '272210': {name:'한화시스템', sector:'방산IT', themes:['defense']},
  '000880': {name:'한화', sector:'방산지주', themes:['defense']},
  '103140': {name:'풍산', sector:'탄약', themes:['defense']},
  // ════════ 조선 (8) ════════
  '329180': {name:'HD현대중공업', sector:'조선', themes:['shipbuilding']},
  '042660': {name:'한화오션', sector:'조선', themes:['shipbuilding']},
  '010140': {name:'삼성중공업', sector:'조선', themes:['shipbuilding']},
  '010620': {name:'HD현대미포', sector:'조선', themes:['shipbuilding']},
  '267250': {name:'HD현대', sector:'조선지주', themes:['shipbuilding']},
  '009540': {name:'HD한국조선해양', sector:'조선지주', themes:['shipbuilding']},
  '082740': {name:'한화엔진', sector:'엔진', themes:['shipbuilding']},
  '011200': {name:'HMM', sector:'해운', themes:['logistics']},
  '071970': {name:'HD현대마린엔진', sector:'선박엔진', themes:['shipbuilding']},
  // ════════ AI / 소프트웨어 (7) ════════
  '035420': {name:'NAVER', sector:'IT플랫폼', themes:['ai-sw','telecom']},
  '035720': {name:'카카오', sector:'IT플랫폼', themes:['ai-sw','crypto']},
  '041020': {name:'폴라리스오피스', sector:'SW', themes:['ai-sw']},
  '012510': {name:'더존비즈온', sector:'ERP', themes:['ai-sw']},
  '030520': {name:'한글과컴퓨터', sector:'SW', themes:['ai-sw']},
  '018260': {name:'삼성SDS', sector:'IT서비스', themes:['ai-sw']},
  '304100': {name:'솔트룩스', sector:'AI', themes:['ai-sw']},
  // ════════ 전력기기 (8) ════════
  '298040': {name:'효성중공업', sector:'전력기기', themes:['power-grid']},
  '010120': {name:'LS일렉트릭', sector:'전력기기', themes:['power-grid']},
  '267260': {name:'HD현대일렉트릭', sector:'전력기기', themes:['power-grid']},
  '103590': {name:'일진전기', sector:'전력기기', themes:['power-grid']},
  '229640': {name:'LS에코에너지', sector:'전선', themes:['power-grid']},
  '006260': {name:'LS', sector:'전력지주', themes:['power-grid']},
  '000500': {name:'가온전선', sector:'전선', themes:['power-grid']},
  '033100': {name:'제룡전기', sector:'배전', themes:['power-grid']},
  '001440': {name:'대한전선', sector:'전력케이블', themes:['power-grid']},
  '062040': {name:'산일전기', sector:'변압기', themes:['power-grid']},
  // ════════ 원전 / SMR (6) ════════
  '034020': {name:'두산에너빌리티', sector:'원전', themes:['nuclear']},
  '051600': {name:'한전KPS', sector:'원전정비', themes:['nuclear']},
  '052690': {name:'한전기술', sector:'원전설계', themes:['nuclear']},
  '000720': {name:'현대건설', sector:'건설', themes:['nuclear','construction']},
  '092200': {name:'디아이씨', sector:'원전기자재', themes:['nuclear']},
  '083650': {name:'비에이치아이', sector:'보일러', themes:['nuclear']},
  // ════════ 2차전지 (9) ════════
  '373220': {name:'LG에너지솔루션', sector:'2차전지', themes:['battery']},
  '006400': {name:'삼성SDI', sector:'2차전지', themes:['battery']},
  '096770': {name:'SK이노베이션', sector:'2차전지', themes:['battery','energy_kr']},
  '247540': {name:'에코프로비엠', sector:'양극재', themes:['battery']},
  '005490': {name:'POSCO홀딩스', sector:'소재', themes:['battery','steel_chem']},
  '004020': {name:'현대제철', sector:'소재', themes:['steel_chem']},
  '086520': {name:'에코프로', sector:'양극재', themes:['battery']},
  '003670': {name:'포스코퓨처엠', sector:'소재', themes:['battery']},
  '051910': {name:'LG화학', sector:'화학', themes:['battery','steel_chem']},
  '066970': {name:'엘앤에프', sector:'양극재', themes:['battery']},
  // ════════ 바이오 (8) ════════
  '207940': {name:'삼성바이오로직스', sector:'CDMO', themes:['bio']},
  '068270': {name:'셀트리온', sector:'바이오시밀러', themes:['bio']},
  '128940': {name:'한미약품', sector:'제약', themes:['bio']},
  '000100': {name:'유한양행', sector:'제약', themes:['bio']},
  '326030': {name:'SK바이오팜', sector:'CNS', themes:['bio']},
  '196170': {name:'알테오젠', sector:'바이오', themes:['bio']},
  '028300': {name:'HLB', sector:'항암제', themes:['bio']},
  '145020': {name:'휴젤', sector:'보톡스', themes:['bio','kbeauty']},
  '141080': {name:'리가켐바이오사이언스', sector:'ADC항암제', themes:['bio','medtech_kr']},
  // ════════ K-뷰티 (8) ════════
  '090430': {name:'아모레퍼시픽', sector:'화장품', themes:['kbeauty']},
  '051900': {name:'LG생활건강', sector:'생활건강', themes:['kbeauty']},
  '044820': {name:'코스맥스BTI', sector:'ODM', themes:['kbeauty']},
  '192820': {name:'코스맥스', sector:'ODM', themes:['kbeauty']},
  '161890': {name:'한국콜마', sector:'ODM', themes:['kbeauty']},
  '237880': {name:'클리오', sector:'색조', themes:['kbeauty']},
  '257720': {name:'실리콘투', sector:'유통', themes:['kbeauty']},
  '278470': {name:'에이피알(APR)', sector:'뷰티브랜드', themes:['kbeauty']},
  // ════════ K-컨텐츠 (8) ════════
  '352820': {name:'하이브', sector:'엔터', themes:['kcontent']},
  '041510': {name:'SM', sector:'엔터', themes:['kcontent']},
  '035900': {name:'JYP Ent.', sector:'엔터', themes:['kcontent']},
  '122870': {name:'YG엔터테인먼트', sector:'엔터', themes:['kcontent']},
  '259960': {name:'크래프톤', sector:'게임', themes:['kcontent']},
  '253450': {name:'스튜디오드래곤', sector:'드라마', themes:['kcontent']},
  '035760': {name:'CJ ENM', sector:'미디어', themes:['kcontent']},
  '251270': {name:'넷마블', sector:'게임', themes:['kcontent']},
  // ════════ 자동차 (7) ════════
  '005380': {name:'현대차', sector:'자동차', themes:['auto']},
  '000270': {name:'기아', sector:'자동차', themes:['auto']},
  '012330': {name:'현대모비스', sector:'자동차부품', themes:['auto']},
  '086280': {name:'현대글로비스', sector:'물류', themes:['auto','logistics']},
  '011210': {name:'현대위아', sector:'엔진', themes:['auto']},
  '204320': {name:'HL만도', sector:'전장', themes:['auto']},
  '018880': {name:'한온시스템', sector:'열관리', themes:['auto']},
  // ════════ 로봇 (6) ════════
  '277810': {name:'레인보우로보틱스', sector:'로봇', themes:['robot']},
  '315640': {name:'뉴로메카', sector:'협동로봇', themes:['robot']},
  '178320': {name:'서진시스템', sector:'통신장비/ESS', themes:['telecom','wind_solar']},
  '454910': {name:'두산로보틱스', sector:'협동로봇', themes:['robot']},
  '056080': {name:'유진로봇', sector:'서비스로봇', themes:['robot']},
  '108320': {name:'LX세미콘', sector:'팹리스', themes:['semi']},
  // ════════ 금융 (7) ════════
  '105560': {name:'KB금융', sector:'금융', themes:['finance']},
  '055550': {name:'신한지주', sector:'금융', themes:['finance']},
  '086790': {name:'하나금융', sector:'금융', themes:['finance']},
  '316140': {name:'우리금융지주', sector:'금융', themes:['finance']},
  '138040': {name:'메리츠금융지주', sector:'금융', themes:['finance']},
  '032830': {name:'삼성생명', sector:'보험', themes:['finance']},
  '000810': {name:'삼성화재', sector:'보험', themes:['finance']},
  // ════════ K-푸드 (7) ════════
  '003230': {name:'삼양식품', sector:'식품', themes:['kfood']},
  '271560': {name:'오리온', sector:'식품', themes:['kfood']},
  '004370': {name:'농심', sector:'식품', themes:['kfood']},
  '097950': {name:'CJ제일제당', sector:'식품', themes:['kfood']},
  '280360': {name:'롯데웰푸드', sector:'식품', themes:['kfood']},
  '005180': {name:'빙그레', sector:'유제품', themes:['kfood']},
  '000080': {name:'하이트진로', sector:'음료', themes:['kfood']},
  // ════════ 크립토 (5) ════════
  '112040': {name:'위메이드', sector:'게임/블록체인', themes:['crypto','kcontent']},
  '094480': {name:'갤럭시아머니트리', sector:'핀테크', themes:['crypto']},
  // ════════ 통신 (5) ════════
  '017670': {name:'SK텔레콤', sector:'통신', themes:['telecom']},
  '030200': {name:'KT', sector:'통신', themes:['telecom']},
  '032640': {name:'LG유플러스', sector:'통신', themes:['telecom']},
  '066570': {name:'LG전자', sector:'가전/전장', themes:['auto']},
  // ════════ 지주·대형 (4) ════════
  '034730': {name:'SK', sector:'지주', themes:[]},
  '003550': {name:'LG', sector:'지주', themes:[]},
  '028260': {name:'삼성물산', sector:'지주/건설', themes:['construction']},
  '402340': {name:'SK스퀘어', sector:'투자지주', themes:['semi']},
  // ════════ 전력·에너지 (2) ════════
  '015760': {name:'한국전력', sector:'전력', themes:['power-grid']},
  '009830': {name:'한화솔루션', sector:'화학/에너지', themes:['battery','steel_chem']},
  // ════════ 금융 (1) ════════
  '323410': {name:'카카오뱅크', sector:'인터넷은행', themes:['finance']},
  '047040': {name:'대우건설', sector:'건설', themes:['construction']},
  '006360': {name:'GS건설', sector:'건설', themes:['construction']},
  '375500': {name:'DL이앤씨', sector:'건설', themes:['construction']},
  '028050': {name:'삼성E&A', sector:'플랜트', themes:['construction']},
  '294870': {name:'HDC현대산업개발', sector:'건설', themes:['construction']},
  '139480': {name:'이마트', sector:'대형마트', themes:['retail']},
  '004170': {name:'신세계', sector:'백화점', themes:['retail']},
  '069960': {name:'현대백화점', sector:'백화점', themes:['retail']},
  '007070': {name:'GS리테일', sector:'편의점', themes:['retail']},
  '282330': {name:'BGF리테일', sector:'편의점', themes:['retail']},
  '030000': {name:'제일기획', sector:'광고', themes:[]},
  '011170': {name:'롯데케미칼', sector:'석유화학', themes:['steel_chem']},
  '010950': {name:'S-Oil', sector:'정유', themes:['energy_kr']},
  '000120': {name:'CJ대한통운', sector:'물류', themes:['logistics']},
  '003490': {name:'대한항공', sector:'항공', themes:['logistics']},
  '180640': {name:'한진칼', sector:'항공지주', themes:['logistics']},
  '023530': {name:'롯데쇼핑', sector:'유통', themes:['consumer']},
  '006800': {name:'미래에셋증권', sector:'증권', themes:['finance']},
  '357780': {name:'솔브레인', sector:'반도체소재', themes:['semi']},
  '006910': {name:'보성파워텍', sector:'원전기자재', themes:['nuclear']},
  '008770': {name:'호텔신라', sector:'면세/호텔', themes:['travel']},
  '010820': {name:'퍼스텍', sector:'방산/무인기', themes:['defense','drone']},
  '024060': {name:'흥구석유', sector:'석유유통', themes:['energy_kr']},
  '032820': {name:'우리기술', sector:'원전제어', themes:['nuclear']},
  '036570': {name:'엔씨소프트', sector:'게임', themes:['kcontent']},
  '039130': {name:'하나투어', sector:'여행', themes:['travel']},
  '049950': {name:'미래컴퍼니', sector:'수술로봇', themes:['medtech_kr']},
  '089590': {name:'제주항공', sector:'항공', themes:['travel']},
  '090360': {name:'로보스타', sector:'산업로봇', themes:['robot']},
  '090710': {name:'휴림로봇', sector:'산업로봇', themes:['robot']},
  '108490': {name:'로보티즈', sector:'로봇액추에이터', themes:['robot']},
  '140910': {name:'에이리츠', sector:'리츠', themes:['reit']},
  '145720': {name:'덴티움', sector:'임플란트', themes:['medtech_kr']},
  '161390': {name:'한국타이어앤테크놀로지', sector:'타이어', themes:['auto']},
  '214150': {name:'클래시스', sector:'미용의료기기', themes:['medtech_kr']},
  '263750': {name:'펄어비스', sector:'게임', themes:['kcontent']},
  '272290': {name:'이녹스첨단소재', sector:'반도체/디스플레이소재', themes:['semi']},
  '272450': {name:'진에어', sector:'항공', themes:['travel']},
  '293490': {name:'카카오게임즈', sector:'게임', themes:['kcontent']},
  '293940': {name:'신한알파리츠', sector:'리츠', themes:['reit']},
  '322510': {name:'제이엘케이', sector:'의료AI', themes:['medtech_kr']},
  '328130': {name:'루닛', sector:'의료AI', themes:['medtech_kr']},
  '330590': {name:'롯데리츠', sector:'리츠', themes:['reit']},
  '338220': {name:'뷰노', sector:'의료AI', themes:['medtech_kr']},
  '357430': {name:'마스턴프리미어리츠', sector:'리츠', themes:['reit']},
  '365550': {name:'ESR켄달스퀘어리츠', sector:'리츠', themes:['reit']},
  '388720': {name:'유일로보틱스', sector:'산업로봇', themes:['robot']},
  '448730': {name:'삼성FN리츠', sector:'리츠', themes:['reit']},
  '078930': {name:'GS', sector:'에너지지주', themes:['energy_kr']},
  '041190': {name:'우리기술투자', sector:'크립토투자', themes:['crypto']},
  '047080': {name:'한빛소프트', sector:'크립토게임', themes:['crypto']},
  // ════════ v35.8 신규: 의료기기/디지털헬스 재구성 ════════
  '047820': {name:'삼천당제약', sector:'GLP-1 제약', themes:['medtech_kr']},
  '018670': {name:'SK가스', sector:'에너지', themes:['energy_kr']},
  // ════════ v41.9 신규: 신재생/양자/UAM/수소/우주 테마 종목 ════════
  '112610': {name:'씨에스윈드', sector:'풍력타워', themes:['wind_solar']},
  '336260': {name:'두산퓨얼셀', sector:'연료전지', themes:['wind_solar','hydrogen']},
  '281740': {name:'SK에코엔지니어링', sector:'환경에너지', themes:['wind_solar']},
  '017390': {name:'서울가스', sector:'가스유틸리티', themes:['wind_solar','hydrogen']},
  '003830': {name:'대한화섬', sector:'신재생', themes:['wind_solar']},
  '060900': {name:'KH바텍', sector:'태양광', themes:['wind_solar']},
  '050890': {name:'쏠리드', sector:'광중계기', themes:['photonics_kr','quantum']},
  '032500': {name:'케이엠더블유', sector:'통신장비', themes:['photonics_kr','quantum']},
  '218410': {name:'RFHIC', sector:'RF반도체', themes:['photonics_kr','quantum']},
  '138080': {name:'오이솔루션', sector:'광모듈', themes:['photonics_kr']},
  // v46.10: KR_THEME_MAP 누락 종목 보충 (8건)
  '001800': {name:'오뚜기', sector:'식품', themes:['kfood']},
  '018290': {name:'브이티', sector:'뷰티', themes:['kbeauty']},
  '950130': {name:'엑시큐어', sector:'바이오', themes:['bio']},
  '439090': {name:'마녀공장', sector:'뷰티', themes:['kbeauty']},
  '114570': {name:'아이패밀리SC', sector:'뷰티', themes:['kbeauty']},
  '085660': {name:'차바이오텍', sector:'바이오', themes:['medtech_kr']},
  '950160': {name:'코오롱티슈진', sector:'바이오', themes:['medtech_kr']},
  '322310': {name:'오로스테크놀로지', sector:'의료기기', themes:['medtech_kr']},
};

// v35.8: 테마별 종목 매핑 + 비중(w) 합계 100
// 테마 구성만 정적으로 보관한다. 비중은 런타임 시총 커버리지가 충분하면 시총가중,
// 그렇지 않으면 동일가중으로 계산한다.
var KR_THEME_MAP = {
// 정적 구성(코드·테마 소속)만 보관한다. 시총·주도주 서술·가중치는 런타임 산출물로만
// 채운다 — 주석에 시점 박힌 수치를 남기면 현재값으로 오해된다. 시점 박힌 시총
// 서술은 제거하고 역할 서술(예: "K방산 절대 대장")만 남긴다(R604).
  'defense': [
    {code:'012450'}, // 한화에어로스페이스 (K방산 절대 대장, 수출 주도)
    {code:'047810'}, // KAI (경공격기/KF-21)
    {code:'079550'}, // LIG넥스원 (미사일/정밀유도)
    {code:'064350'}, // 현대로템 (전차/철도)
    {code:'272210'}, // 한화시스템 (C4I/레이더)
    {code:'000880'},  // 한화 (방산 지주)
    {code:'103140'}   // 풍산 (탄약 독점)
  ],
  'semi': [
    {code:'005930'}, // 삼성전자 (메모리+파운드리 절대 1위)
    {code:'000660'}, // SK하이닉스 (HBM 세계 1위)
    {code:'042700'},  // 한미반도체 (HBM TC본더 독점)
    {code:'009150'},  // 삼성전기 (MLCC)
    {code:'007660'},  // 이수페타시스 (HBM4 패키지 기판)
    {code:'095340'},  // ISC (반도체 테스트 소켓 1위)
    {code:'039030'},  // 이오테크닉스 (레이저 장비)
    {code:'403870'},  // HPSP (High Pressure)
    {code:'058470'},  // 리노공업 (IC 테스트소켓)
    {code:'240810'},  // 원익IPS (CVD 장비)
    {code:'036930'},  // 주성엔지니어링 (ALD 장비)
    {code:'131970'},  // 테크윙 (테스트핸들러)
    {code:'000990'},  // DB하이텍 (파운드리)
    {code:'005290'},  // 동진쎄미켐 (포토레지스트)
    {code:'402340'}   // SK스퀘어 (SK하이닉스 지주)
  ],
  'shipbuilding': [
    {code:'329180'}, // HD현대중공업 (조선 시총 1위)
    {code:'042660'}, // 한화오션 (잠수함+특수선)
    {code:'009540'}, // HD한국조선해양 (지주)
    {code:'010140'}, // 삼성중공업 (LNG선)
    {code:'010620'},  // HD현대미포 (중형선)
    {code:'267250'},  // HD현대 (지주)
    {code:'082740'},  // 한화엔진 (엔진 독과점)
    {code:'071970'}   // HD현대마린엔진
  ],
  'ai-sw': [
    {code:'035420'}, // NAVER (HyperCLOVA X, AI 대장)
    {code:'018260'}, // 삼성SDS (AI ERP/Brity)
    {code:'035720'}, // 카카오 (카나나/AI)
    {code:'012510'}, // 더존비즈온 (AI ERP)
    {code:'030520'},  // 한글과컴퓨터 (한컴AI)
    {code:'041020'},  // 폴라리스오피스 (글로벌 오피스)
    {code:'304100'}   // 솔트룩스 (한국어 LLM)
  ],
  'power-grid': [
    {code:'267260'}, // HD현대일렉트릭 (변압기 글로벌 수주 1위)
    {code:'298040'}, // 효성중공업 (변압기/중전기)
    {code:'010120'}, // LS일렉트릭 (배전/자동화)
    {code:'015760'},  // 한국전력 (이나 공기업 특성상 테마 주도주 아님)
    {code:'103590'},  // 일진전기
    {code:'006260'},  // LS
    {code:'001440'},  // 대한전선
    {code:'062040'},  // 산일전기
    {code:'229640'},  // LS에코에너지
    {code:'000500'},  // 가온전선
    {code:'033100'}   // 제룡전기
  ],
  'nuclear': [
    {code:'034020'}, // 두산에너빌리티 (원전 핵심기기 독과점 대장)
    {code:'000720'}, // 현대건설 (원전 시공 1위)
    {code:'052690'}, // 한전기술 (원전 설계 독점, NSSS)
    {code:'051600'}, // 한전KPS (원전 정비 독점)
    {code:'092200'},  // 디아이씨 (원전 계측제어)
    {code:'083650'}   // 비에이치아이 (보일러/열교환기)
  ],
  'battery': [
    {code:'373220'}, // LG에너지솔루션 (배터리 셀 세계 2위, 대장)
    {code:'006400'}, // 삼성SDI (전고체 기술)
    {code:'005490'}, // POSCO홀딩스 (양극재 수직계열)
    {code:'096770'}, // SK이노베이션 (SK온)
    {code:'051910'},  // LG화학 (분리막)
    {code:'247540'},  // 에코프로비엠 (양극재 대장)
    {code:'086520'},  // 에코프로 (지주)
    {code:'003670'},  // 포스코퓨처엠 (양극재/음극재)
    {code:'066970'},  // 엘앤에프 (양극재)
    {code:'009830'}   // 한화솔루션 (수소·태양광)
  ],
  'bio': [
    {code:'207940'}, // 삼성바이오로직스 (CDMO 글로벌 1위)
    {code:'068270'}, // 셀트리온 (바이오시밀러 1위)
    {code:'196170'}, // 알테오젠 (피하주사 플랫폼)
    {code:'141080'},  // 리가켐바이오 (ADC 글로벌 기술수출)
    {code:'028300'},  // HLB
    {code:'000100'},  // 유한양행 ()
    {code:'128940'},  // 한미약품
    {code:'326030'},  // SK바이오팜
    {code:'145020'}   // 휴젤
  ],
  'kbeauty': [
    {code:'090430'}, // 아모레퍼시픽 (한국 뷰티 1위)
    {code:'051900'}, // LG생활건강 (럭셔리 뷰티)
    {code:'192820'}, // 코스맥스 (ODM 글로벌 1위, 독과점)
    {code:'278470'}, // 에이피알(APR) — 메디큐브 브랜드, 북미 고성장 대장
    {code:'257720'}, // 실리콘투 (K-뷰티 글로벌 유통 대장)
    {code:'161890'},  // 한국콜마 (ODM 2위)
    {code:'018290'},  // 브이티 (리들샷 글로벌 히트)
    {code:'237880'},  // 클리오 (세포라 입점)
    {code:'214150'},  // 클래시스 (미용의료기기)
    {code:'439090'},  // 마녀공장 (아마존 스킨케어 1위)
    {code:'114570'},  // 아이패밀리SC (Purito)
    {code:'044820'}   // 코스맥스BTI
  ],
  'kcontent': [
    {code:'259960'}, // 크래프톤 (배그/게임 절대 대장)
    {code:'352820'}, // 하이브 (K-pop 1위)
    {code:'041510'}, // SM ()
    {code:'035900'}, // JYP ()
    {code:'122870'},  // YG ()
    {code:'253450'},  // 스튜디오드래곤 (드라마 제작 1위)
    {code:'035760'},  // CJ ENM (콘텐츠 플랫폼)
    {code:'251270'},  // 넷마블 (게임)
    {code:'112040'}   // 위메이드 (블록체인 게임)
  ],
  'auto': [
    {code:'005380'}, // 현대차 (글로벌 3위, 보스턴다이내믹스)
    {code:'000270'}, // 기아 (글로벌 4위, EV6/EV9)
    {code:'012330'}, // 현대모비스 (부품 독과점)
    {code:'086280'},  // 현대글로비스 (완성차 물류)
    {code:'011210'},  // 현대위아 (방산+자동차부품)
    {code:'204320'},  // HL만도 (ADAS/자율주행)
    {code:'018880'},  // 한온시스템 (열관리)
    {code:'066570'}   // LG전자 (전장부품)
  ],
  'robot': [
    {code:'454910'}, // 두산로보틱스 (협동로봇)
    {code:'277810'}, // 레인보우로보틱스 (삼성전자 투자, 휴머노이드)
    {code:'108490'}, // 로보티즈 (로봇 액추에이터)
    {code:'090360'}, // 로보스타 (산업로봇)
    {code:'388720'},  // 유일로보틱스 (산업로봇)
    {code:'090710'}   // 휴림로봇 (산업로봇)
  ],
  'finance': [
    {code:'105560'}, // KB금융 (금융지주 1위)
    {code:'055550'}, // 신한지주 (2위)
    {code:'138040'}, // 메리츠금융지주 (성장 대장주, ROE 최고)
    {code:'086790'}, // 하나금융 ()
    {code:'316140'}, // 우리금융지주 ()
    {code:'032830'},  // 삼성생명 ()
    {code:'000810'},  // 삼성화재 ()
    {code:'323410'}   // 카카오뱅크 (핀테크)
  ],
  'kfood': [
    {code:'003230'}, // 삼양식품 (불닭)
    {code:'097950'}, // CJ제일제당
    {code:'271560'}, // 오리온
    {code:'004370'}, // 농심
    {code:'001800'}, // 오뚜기 — v40.4 추가
    {code:'280360'},  // 롯데웰푸드
    {code:'005180'},  // 빙그레
    {code:'000080'}   // 하이트진로
  ],
  'crypto': [
    {code:'112040'}, // 위메이드 (위믹스) — 게임+토큰 대장, 가장 순수한 크립토 노출
    {code:'094480'}, // 갤럭시아머니트리 — 블록체인 투자
    {code:'035720'}, // 카카오 (Klaytn/Ground X) — IT플랫폼 본업, 크립토 비중 극소
    {code:'041190'}, // 우리기술투자 — 크립토 VC
    {code:'047080'}  // 한빛소프트 — 블록체인 게임
  ],
  'telecom': [
    {code:'017670'}, // SK텔레콤 (시총 19조, AI DC 확장)
    {code:'030200'}, // KT (시총 8.4조, 클라우드/AI 분사)
    {code:'032640'}  // LG유플러스 (시총 5.6조, IDC 투자)
  ],
  'construction': [
    {code:'000720'}, {code:'028260'}, {code:'047040'},
    {code:'006360'}, {code:'375500'}, {code:'028050'}
  ],
  'retail': [
    {code:'139480'}, // 이마트 (시총 3.0조, 대형마트)
    {code:'004170'}, // 신세계 (시총 3.1조, 백화점)
    {code:'069960'}, // 현대백화점 (시총 1.8조)
    {code:'007070'}, // GS리테일 (시총 2.3조, 편의점)
    {code:'282330'}  // BGF리테일 (시총 2.5조, 편의점)
  ],
  'steel_chem': [
    {code:'005490'}, // POSCO홀딩스 (시총 21조, 2차전지 소재 수직계열화)
    {code:'004020'}, // 현대제철 (시총 5.5조, H-Form 철강)
    {code:'051910'}, // LG화학 (시총 17조, 분리막/양극재)
    {code:'011170'}, // 롯데케미칼 (시총 3.5조, 석유화학)
    {code:'009830'}  // 한화솔루션 (시총 6.1조, 태양광/케미칼)
  ],
  'logistics': [
    {code:'000120'}, // CJ대한통운 (시총 5.8조, 택배/물류 1위)
    {code:'003490'}, // 대한항공 (시총 11조, 아시아나 합병)
    {code:'086280'}, // 현대글로비스 (시총 12조, 자동차 물류)
    {code:'180640'}  // 한진칼 (시총 3.8조, 항공 지주)
  ],
  'medtech_kr': [
    {code:'214150'}, // 클래시스 (미용의료기기)
    {code:'328130'}, // 루닛 (의료AI)
    {code:'338220'}, // 뷰노 (의료AI)
    {code:'322510'}, // 제이엘케이 (의료AI)
    {code:'049950'}, // 미래컴퍼니 (수술로봇)
    {code:'145720'}   // 덴티움 (임플란트)
  ],
  'energy_kr': [
    {code:'096770'}, // SK이노베이션 (정유+배터리, 대장)
    {code:'010950'}, // S-Oil (사우디아람코, 정제 마진)
    {code:'078930'}, // GS (GS칼텍스 지주)
    {code:'018670'}  // SK가스 (LNG/LPG)
  ],
  'photonics_kr': [
    {code:'050890'}, // 쏠리드 (광중계기/DAS 1위, 대장)
    {code:'032500'}, // 케이엠더블유 (5G/광통신 장비)
    {code:'218410'}, // RFHIC (RF/광 반도체 GaN)
    {code:'138080'}  // 오이솔루션 (광모듈)
  ],
  'wind_solar': [
    {code:'112610'}, // 씨에스윈드 (풍력타워 글로벌 1위, 대장)
    {code:'009830'}, // 한화솔루션 (태양광+케미칼, 규모 1위)
    {code:'336260'}, // 두산퓨얼셀 (연료전지 발전)
    {code:'281740'}, // SK에코엔지니어링 — 폐자원 에너지
    {code:'017390'}, // 서울가스 (수소충전 인프라)
    {code:'003830'}, // 대한화섬 (풍력발전단지 개발)
    {code:'060900'}   // KH바텍 (태양광 인버터)
  ],
  'quantum': [
    {code:'017670'}, // SK텔레콤 (IDQ 양자암호 자회사, 양자통신 대장)
    {code:'030200'}, // KT (양자암호통신 실증, 통신인프라)
    {code:'050890'}, // 쏠리드 (양자통신 광중계기 인프라)
    {code:'032500'}, // 케이엠더블유 (양자/5G 통신장비)
    {code:'218410'}  // RFHIC (양자/광 RF 반도체)
  ],
  'uam': [
    {code:'272210'}, // 한화시스템 (버티포트/항공전자, UAM 대장)
    {code:'012450'}, // 한화에어로스페이스 (eVTOL 엔진/전장)
    {code:'047810'}, // KAI (KF-21/항공, UAM 기체)
    {code:'064350'}, // 현대로템 (PBV/무인기)
    {code:'082740'}, // 한화엔진 (eVTOL 동력)
    {code:'298040'}  // 효성중공업 (UAM 충전 인프라)
  ],
  'hydrogen': [
    {code:'009830'}, // 한화솔루션 (수소 그린수소 대장)
    {code:'336260'}, // 두산퓨얼셀 (수소연료전지 발전 1위)
    {code:'034020'}, // 두산에너빌리티 (수소터빈/액화 설비)
    {code:'298040'}, // 효성중공업 (수소충전소 1위, 린데 JV)
    {code:'096770'}, // SK이노베이션 (수소 생산/유통)
    {code:'003490'},  // 대한항공 (수소항공기 연구)
    {code:'017390'},  // 서울가스 (수소충전 인프라)
    {code:'005380'}   // 현대차 (수소차 NEXO, 수소 상용차)
  ],
  'space': [
    {code:'012450'}, // 한화에어로스페이스 (누리호 엔진, 대장)
    {code:'047810'}, // KAI (위성/항공기)
    {code:'272210'}, // 한화시스템 (위성통신/SAR)
    {code:'064350'}, // 현대로템 (발사대/지상장비)
    {code:'079550'}, // LIG넥스원 (위성탑재체/유도무기)
    {code:'298040'},  // 효성중공업 (발사체 부품)
    {code:'000880'}   // 한화 (그룹 우주사업 지주)
  ]
};

function refreshKrThemeRuntimeWeights() {
  if (typeof KR_THEME_MAP === 'undefined') return;
  var live = window._liveData || {};
  Object.keys(KR_THEME_MAP).forEach(function(themeId) {
    var rows = KR_THEME_MAP[themeId] || [];
    if (!rows.length) return;
    var caps = rows.map(function(row) {
      var item = live[krTickerToYahoo(row.code)];
      var cap = item && item.marketCap != null ? Number(item.marketCap) : null;
      return Number.isFinite(cap) && cap > 0 ? cap : null;
    });
    var observed = caps.filter(function(v) { return v != null; });
    var useCapWeight = observed.length >= Math.ceil(rows.length * 0.7);
    var total = useCapWeight ? observed.reduce(function(sum, v) { return sum + v; }, 0) : rows.length;
    rows.forEach(function(row, i) {
      row.w = useCapWeight && caps[i] != null ? caps[i] / total * 100 : (useCapWeight ? 0 : 100 / rows.length);
      row._weightSource = useCapWeight ? 'live-market-cap' : 'equal-weight';
    });
  });
}

// Helper: resolve Korean stock code to Yahoo Finance symbol
function krTickerToYahoo(code) {
  // KOSDAQ stocks (v35.6: SCREENER_DB 전체 KOSDAQ 종목 동기화 — 40종목)
  var kosdaq = {
    '003670':1,'028300':1,'030520':1,'033100':1,'035900':1,'036930':1,'039030':1,'041020':1,
    '042700':1,'044820':1,'056080':1,'058470':1,'066970':1,'069960':1,'086520':1,'092200':1,
    '094480':1,'112040':1,'122870':1,'131970':1,'141080':1,'145020':1,'161890':1,'178320':1,'192820':1,
    '196170':1,'229640':1,'237880':1,'240810':1,'247540':1,'253450':1,'257720':1,'263750':1,
    '277810':1,'278470':1,'302440':1,'304100':1,'315640':1,'323410':1,'357780':1,
    '403870':1,'950130':1,'047080':1,'047820':1,
    '095340':1,'062040':1,'108320':1,'108490':1,'090360':1,'090710':1,'388720':1,
    '214150':1,'328130':1,'338220':1,'322510':1,'049950':1,'145720':1,
    '069540':1,'032500':1,'138080':1,'327260':1,'010170':1,'062970':1,'368770':1,'100590':1,'218410':1,'050890':1,
    '439090':1,'114570':1,'085660':1,'950160':1,'322310':1,'041190':1,
    '060900':1
  };
  return code + (kosdaq[code] ? '.KQ' : '.KS');
}

// Helper: get Korean stock info from DB
// ══════════════════════════════════════════════════════════════════
// SEC EDGAR API — SEC 공시/재무데이터 (무료, 공식 API)
// ══════════════════════════════════════════════════════════════════
// SEC EDGAR Full-Text Search: https://efts.sec.gov/LATEST/search-index?q=TICKER
// Company Filing: https://data.sec.gov/submissions/CIK{cik}.json
// Financial Statements: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
// NOTE: SEC requires User-Agent header (email) — no API key needed
// v47.10: SEC_CIK_CACHE 제거 — 변수 선언만 있고 읽기/쓰기 0건 (dead variable P112)

// Ticker → CIK mapping (주요 종목)
var SEC_TICKER_CIK = {
  'AAPL':'0000320193','MSFT':'0000789019','GOOGL':'0001652044','AMZN':'0001018724',
  'META':'0001326801','NVDA':'0001045810','TSLA':'0001318605','JPM':'0000019617',
  'V':'0001403161','JNJ':'0000200406','WMT':'0000104169','PG':'0000080424',
  'UNH':'0000731766','HD':'0000354950','MRK':'0000310158','ABBV':'0001551152',
  'KO':'0000021344','PEP':'0000077476','COST':'0000909832','MCD':'0000063908',
  'CRM':'0001108524','AMD':'0000002488','INTC':'0000050863','BA':'0000012927',
  'GS':'0000886982','CAT':'0000018230','IBM':'0000051143','GE':'0000040545',
  'NFLX':'0001065280','DIS':'0001744489','XOM':'0000034088','CVX':'0000093410',
  'LMT':'0000936468','RTX':'0000101829','BAC':'0000070858','WFC':'0000072971',
  'AVGO':'0001649338','MU':'0000723125','QCOM':'0000804328','ADBE':'0000796343',
  'ORCL':'0001341439','NOW':'0001373715','PANW':'0001327567','CRWD':'0001535527',
  'LLY':'0000059478','TMO':'0000097745','ISRG':'0001035267','GILD':'0000882095',
  'AMGN':'0000318154','VRTX':'0000875320','REGN':'0000589689','PFE':'0000078003',
  'BRK.B':'0001067983','BLK':'0001364742','SPGI':'0000064040','INTU':'0000896878',
  'ASML':'0000937966','AMAT':'0000006951','LRCX':'0000707549','KLAC':'0000319201',
  'SNPS':'0000883241','CDNS':'0000813672','MRVL':'0001058290'
};

// SEC EDGAR: Get company filings
async function fetchSECFilings(ticker, formType) {
  var cik = SEC_TICKER_CIK[ticker];
  if (!cik) {
    // Try to resolve CIK via SEC search
    try {
      var startDt = new Date(); startDt.setFullYear(startDt.getFullYear() - 1); var searchUrl = 'https://efts.sec.gov/LATEST/search-index?q=%22' + ticker + '%22&dateRange=custom&startdt=' + startDt.toISOString().slice(0,10) + '&forms=' + (formType || '10-K,10-Q,8-K');
      var r = await fetchWithTimeout(searchUrl, {headers:{'Accept':'application/json'}}, 10000);
      if (r.ok) { var d = await r.json(); return d; }
    } catch(e) { _aioLog('warn', 'fetch', 'SEC search error: ' + e.message); }
    return null;
  }
  var url = 'https://data.sec.gov/submissions/CIK' + cik + '.json';
  var data = null;
  // 1차: 직접 호출
  try {
    var r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, 10000);
    if (r.ok) data = await r.json();
  } catch(e) { _aioLog('warn', 'fetch', 'SEC filing direct fetch failed: ' + e.message); }
  // 2차: CORS 프록시 경유
  if (!data) {
    try {
      var r2 = await fetchViaProxy(url, 8000); // v48.27 (P4): 12s → 8s
      if (r2.ok) {
        data = await r2.json();
        if (data.contents && typeof data.contents === 'string') {
          try { data = JSON.parse(data.contents); } catch(e2) { /* malformed */ }
        }
      }
    } catch(e) { _aioLog('warn', 'fetch', 'SEC filing proxy fetch failed: ' + e.message); }
  }
  if (!data) return null;
  return {
    name: data.name,
    cik: cik,
    sic: data.sic,
    sicDescription: data.sicDescription,
    filings: data.filings ? data.filings.recent : null,
    website: data.website || '',
    exchanges: data.exchanges || [],
    tickers: data.tickers || []
  };
}

// SEC EDGAR: Get company financial facts (XBRL)
async function fetchSECFinancials(ticker) {
  var cik = SEC_TICKER_CIK[ticker];
  if (!cik) return null;
  var url = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json';
  var data = null;
  // 1차: 직접 호출
  try {
    var r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, 8000); // v48.27 (P4): 12s → 8s
    if (r.ok) data = await r.json();
  } catch(e) { _aioLog('warn', 'fetch', 'SEC XBRL direct fetch failed (CORS): ' + e.message); }
  // 2차: CORS 프록시 경유
  if (!data) {
    try {
      var r2 = await fetchViaProxy(url, 15000);
      if (r2.ok) {
        data = await r2.json();
        if (data.contents && typeof data.contents === 'string') {
          try { data = JSON.parse(data.contents); } catch(e2) { /* malformed */ }
        }
      }
    } catch(e) { _aioLog('warn', 'fetch', 'SEC XBRL proxy fetch failed: ' + e.message); }
  }
  if (!data || !data.facts) return null;
  // 원시 XBRL 데이터 그대로 반환 → _parseSECFinancials()에서 파싱
  data._ticker = ticker;
  data._cik = cik;
  return data;
}

// ══════════════════════════════════════════════════════════════════
// v48.5: SEC EDGAR XBRL Frames API — 특정 분기의 전 기업 concept 값 일괄 조회 (무료)
// ══════════════════════════════════════════════════════════════════
// Endpoint: https://data.sec.gov/api/xbrl/frames/{taxonomy}/{concept}/USD/{period}.json
// 예: /frames/us-gaap/Revenues/USD/CY2024Q4I.json — 2024 Q4 시점 Revenues 보고 전 기업 스냅샷
// 응답: { taxonomy, tag, ccp(period), uom, label, description, pts, data:[{accn, cik, entityName, loc, start, end, val, fy, fp, form, filed}] }
// 용도: 섹터 내 백분위 순위, 업계 평균/중위수, 특정 concept 모든 기업 비교
// 주의: 응답 크기 수백KB~수MB (concept별 보고 기업 수). CF Worker 5MB 제한 내.

// 세션 단위 캐시 — 같은 (concept, period, taxonomy) 조합 재요청 시 네트워크 생략
window._secFrames = window._secFrames || {};

async function fetchSECFrame(concept, period, taxonomy) {
  taxonomy = taxonomy || 'us-gaap';
  var cacheKey = taxonomy + '::' + concept + '::' + period;
  if (window._secFrames[cacheKey] && (Date.now() - window._secFrames[cacheKey]._ts < 3600000)) {
    // 1시간 TTL 캐시 — 분기 데이터는 자주 바뀌지 않음
    return window._secFrames[cacheKey].data;
  }
  var url = 'https://data.sec.gov/api/xbrl/frames/' + encodeURIComponent(taxonomy) + '/' + encodeURIComponent(concept) + '/USD/' + encodeURIComponent(period) + '.json';
  var data = null;
  // 1차: 직접 호출 (SEC는 User-Agent 필수, CORS 차단 가능성 있음)
  try {
    var r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, 8000); // v48.27 (P4): 12s → 8s
    if (r.ok) data = await r.json();
  } catch(e) { /* CORS → 프록시로 폴백 */ }
  // 2차: CF Worker 프록시 경유
  if (!data) {
    try {
      var r2 = await fetchViaProxy(url, 15000);
      if (r2.ok) {
        data = await r2.json();
        if (data.contents && typeof data.contents === 'string') {
          try { data = JSON.parse(data.contents); } catch(pe) {}
        }
      }
    } catch(e) { _aioLog('warn', 'fetch', 'SEC Frame ' + concept + '/' + period + ' proxy 실패: ' + e.message); }
  }
  if (!data || !Array.isArray(data.data)) return null;
  // 캐시 저장 (크기 제한: 요소 5000개 이상이면 상위 5000개만 유지 → 메모리 보호)
  var sliced = data.data.length > 5000 ? data.data.slice(0, 5000) : data.data;
  window._secFrames[cacheKey] = {
    concept: concept,
    period: period,
    taxonomy: taxonomy,
    label: data.label || concept,
    uom: data.uom || 'USD',
    pts: data.pts || data.data.length,
    data: sliced,
    _ts: Date.now()
  };
  console.log('[SEC Frame] ' + concept + ' ' + period + ': ' + sliced.length + '개 기업 스냅샷 저장');
  return window._secFrames[cacheKey];
}

// 백분위 순위 계산 helper — fetchSECFrame 결과에서 특정 CIK의 percentile + 섹터 평균/중위수 요약
function _secFrameRank(frame, cik, cikList) {
  if (!frame || !Array.isArray(frame.data)) return null;
  var items = cikList && cikList.length > 0
    ? frame.data.filter(function(d){ return cikList.indexOf(String(d.cik).padStart(10,'0')) >= 0 || cikList.indexOf(Number(d.cik)) >= 0; })
    : frame.data;
  if (items.length === 0) return null;
  var vals = items.map(function(d){ return d.val; }).filter(function(v){ return typeof v === 'number' && isFinite(v); });
  if (vals.length === 0) return null;
  vals.sort(function(a,b){ return a-b; });
  var targetCikPadded = String(cik).padStart(10,'0');
  var mine = items.find(function(d){ return String(d.cik).padStart(10,'0') === targetCikPadded; });
  var myVal = mine ? mine.val : null;
  var rank = myVal != null ? vals.filter(function(v){ return v < myVal; }).length : null;
  var pctile = rank != null && vals.length > 1 ? (rank / (vals.length - 1)) * 100 : null;
  var sum = vals.reduce(function(a,b){ return a+b; }, 0);
  var avg = sum / vals.length;
  var mid = vals[Math.floor(vals.length/2)];
  return {
    concept: frame.concept,
    period: frame.period,
    n: vals.length,
    myVal: myVal,
    rank: rank != null ? rank + 1 : null,   // 1-indexed (낮은 것부터)
    pctile: pctile,                          // 0~100 (100 = 상위)
    avg: avg,
    median: mid,
    max: vals[vals.length-1],
    min: vals[0]
  };
}

// ══════════════════════════════════════════════════════════════════
// FRED API — Federal Reserve Economic Data (무료, API Key 방식)
// ══════════════════════════════════════════════════════════════════
// Endpoint: https://api.stlouisfed.org/fred/series/observations
// Key series: GDP, UNRATE, CPIAUCSL, FEDFUNDS, T10Y2Y, DGS10, VIXCLS
// NOTE: Requires free API key from https://fred.stlouisfed.org/docs/api/api_key.html
// For demo/prototype, we use publicly accessible FRED data

// v47.10: FRED_SERIES_EXT / fetchFREDData / fetchFREDBatch 제거 — 중복 구현 dead code (P112)
// 실제 사용 중인 것: FRED_SERIES (L12887 근처) + fetchFredSeries (L12900) + fetchAllFredData (L12946)
// FRED 시리즈 확장은 v47.11에서 FRED_SERIES 단일 원천으로 병합 예정

// ══════════════════════════════════════════════════════════════════
// Dynamic Ticker Lookup — 어떤 US 주식이든 실시간 조회
// ══════════════════════════════════════════════════════════════════
// SCREENER_DB에 없는 종목도 Yahoo Finance API로 동적 조회 가능

async function dynamicTickerLookup(ticker, opts) {
  opts = opts || {};
  var lookupSignal = opts.signal || null;
  var throwIfLookupAborted = function() {
    if (lookupSignal && lookupSignal.aborted) {
      var abortError = new Error('dynamic ticker lookup aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }
  };
  throwIfLookupAborted();
  ticker = ticker.toUpperCase().trim();
  let ld = window._liveData || {};
  var cachedTs = window._quoteTimestamps && window._quoteTimestamps[ticker];
  var cachedAgeMs = cachedTs ? Date.now() - cachedTs : Infinity;
  // 1. 이미 _liveData에 있으면 바로 반환
  if (!opts.forceFresh && ld[ticker] && ld[ticker].price) {
    return { ticker: ticker, price: ld[ticker].price, pct: ld[ticker].pct, source: 'cache', cacheAgeMs: isFinite(cachedAgeMs) ? cachedAgeMs : null };
  }
  // 2. Yahoo Finance Chart API (v49.78 C1/P415: 5 proxy 병렬 race + 3.5s timeout)
  // CRITICAL FIX: v49.76 sequential 5 proxy × 8s × 2 retry = 최악 80s hang → 병렬 race = 최악 3.5s
  window._aioTickerLookupDiag = window._aioTickerLookupDiag || {};
  window._aioTickerLookupDiag[ticker] = { attempts: [], finalSource: null, startTime: Date.now(), strategy: opts.forceFresh ? 'force-fresh-parallel-race-v49.105' : 'parallel-race-v49.78' };
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=5d';
    var proxies = [
      // P1142: thingproxy.freeboard.io(서비스 종료) 제거 — 응답 불가 프록시가 매 조회마다
      // 반드시 실패하는 시도 하나를 보장하고, 레지스트리 추적 밖의 트래픽을 만들었다.
      { name: 'codetabs',   fn: function(u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); } },
      { name: 'allorigins', fn: function(u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); } },
      { name: 'corsproxy',  fn: function(u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); } },
      { name: 'cors-sh',    fn: function(u) { return 'https://proxy.cors.sh/' + u; } }
    ];
    var _PROXY_TIMEOUT = 3500; // 8s → 3.5s
    var _raceAbort = new AbortController();
    var relayLookupAbort = function() { try { _raceAbort.abort(); } catch(_) {} };
    if (lookupSignal && typeof lookupSignal.addEventListener === 'function') lookupSignal.addEventListener('abort', relayLookupAbort, { once: true });
    // 모든 proxy 병렬 race — 첫 성공 즉시 반환
    var proxyAttempts = proxies.map(function(p) {
      var _attemptStart = Date.now();
      return fetchWithTimeout(p.fn(url), { signal: _raceAbort.signal }, _PROXY_TIMEOUT).then(function(r) {
        window._aioTickerLookupDiag[ticker].attempts.push({ proxy: p.name, status: r.status, ok: r.ok, durationMs: Date.now() - _attemptStart });
        if (!r.ok) throw new Error(p.name + ' status ' + r.status);
        return r.json();
      }).then(function(raw) {
        if (raw && raw.contents) { try { raw = JSON.parse(raw.contents); } catch(_) {} }
        var meta = raw && raw.chart && raw.chart.result && raw.chart.result[0] && raw.chart.result[0].meta;
        if (!meta || !meta.regularMarketPrice) throw new Error(p.name + ' invalid meta');
        return { proxyName: p.name, meta: meta };
      }).catch(function(err) {
        window._aioTickerLookupDiag[ticker].attempts.push({ proxy: p.name, error: String(err && err.message || err).slice(0, 80), durationMs: Date.now() - _attemptStart });
        throw err;
      });
    });
    var winner = null;
    if (typeof Promise.any === 'function') {
      try { winner = await Promise.any(proxyAttempts); }
      catch(_aggErr) { /* 모두 실패 — Stooq 진입 */ }
    } else {
      // Promise.any polyfill (구형 브라우저)
      winner = await new Promise(function(resolve) {
        var pending = proxyAttempts.length;
        var resolved = false;
        proxyAttempts.forEach(function(p) {
          p.then(function(v) { if (!resolved) { resolved = true; resolve(v); } },
                 function() { pending--; if (pending === 0 && !resolved) resolve(null); });
        });
      });
    }
    if (winner && winner.meta) {
      // Promise.any returns the first valid response; cancel losing proxy fetches
      // so a hidden failure cannot continue consuming sockets after the UI moved on.
      try { _raceAbort.abort(); } catch(_) {}
      var meta = winner.meta;
      var _proxyName = winner.proxyName;
      var _dynPrice = meta.regularMarketPrice;
      var _dynPrev = meta.chartPreviousClose || meta.previousClose || 0;
      var _dynPct = meta.regularMarketChangePercent;
      if (_dynPct == null && _dynPrev > 0) _dynPct = ((_dynPrice - _dynPrev) / _dynPrev) * 100;
      if (typeof window._aioSetLiveData === 'function') {
        window._aioSetLiveData(ticker, { price: _dynPrice, pct: _dynPct != null ? _dynPct : null, observedAt: meta.regularMarketTime || null }, { source: 'yahoo:' + _proxyName, policyKey: 'quote_afterhours', reason: 'parallel race winner v49.78' });
      } else {
        if (!window._liveData) window._liveData = {};
        window._liveData[ticker] = { price: _dynPrice, pct: _dynPct != null ? _dynPct : null, pctMissing: _dynPct == null };
      }
      window._aioTickerLookupDiag[ticker].finalSource = 'yahoo:' + _proxyName;
      window._aioTickerLookupDiag[ticker].totalMs = Date.now() - window._aioTickerLookupDiag[ticker].startTime;
      return {
        ticker: ticker,
        price: _dynPrice,
        pct: _dynPct != null ? _dynPct : null,
        name: meta.shortName || meta.longName || ticker,
        exchange: meta.exchangeName || '',
        currency: meta.currency || 'USD',
        source: 'yahoo:' + _proxyName
      };
    }
    try { _raceAbort.abort(); } catch(_) {}
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[AIO v49.78 C1] dynamicTickerLookup 5 proxy 병렬 race 모두 실패:', ticker, window._aioTickerLookupDiag[ticker]);
    }
  } catch(e) {
    if (lookupSignal && lookupSignal.aborted) throw e;
    _aioLog('warn', 'fetch', 'Dynamic lookup error: ' + e.message);
  } finally {
    if (lookupSignal && typeof lookupSignal.removeEventListener === 'function') lookupSignal.removeEventListener('abort', relayLookupAbort);
  }

  throwIfLookupAborted();

  // v46.3: Stooq 폴백 — Yahoo 실패 시 미국 주식/ETF/원자재
  var _noStooq = {'^GSPC':1,'^DJI':1,'^IXIC':1,'^RUT':1,'^VIX':1,'^VVIX':1,'^TNX':1,'^TYX':1,'^IRX':1,'^FVX':1,'BTC-USD':1,'ETH-USD':1};
  if (!_noStooq[ticker] && !ticker.includes('=X') && !ticker.endsWith('.KS') && !ticker.endsWith('.KQ')) {
    var stSym;
    if (ticker === 'CL=F') stSym = 'cl.f';
    else if (ticker === 'BZ=F') stSym = 'bz.f';
    else if (ticker === 'GC=F') stSym = 'gc.f';
    else if (ticker === 'SI=F') stSym = 'si.f';
    else if (ticker === 'NG=F') stSym = 'ng.f';
    else if (ticker === 'HG=F') stSym = 'hg.f';
    else if (ticker === 'DX-Y.NYB') stSym = 'dx.f';
    else if (ticker.includes('=F')) stSym = null; // 지수 선물(ES=F/NQ=F/YM=F) Stooq 미지원
    else { var cl = ticker.replace(/[^A-Z0-9]/gi,''); if (cl.length >= 1 && cl.length <= 5) stSym = cl.toLowerCase() + '.us'; }
    if (stSym) {
      try {
        var stUrl = 'https://stooq.com/q/l/?s=' + stSym + '&f=sd2t2ohlcv&h&e=csv';
        var stR;
        try { stR = await fetchWithTimeout(stUrl, { signal: lookupSignal }, 5000); } catch(e2) { stR = await fetchViaProxy(stUrl, { timeout: 6000, signal: lookupSignal }); }
        if (stR.ok) {
          var stTxt = await stR.text();
          if (stTxt.startsWith('{')) try { stTxt = JSON.parse(stTxt).contents || stTxt; } catch(e3){}
          var stLines = stTxt.trim().split('\n');
          if (stLines.length >= 2) {
            var cols = stLines[1].split(',');
            if (cols.length >= 8 && cols[1] !== 'N/D') {
              // Stooq CSV: Symbol,Date,Time,Open,High,Low,Close,Volume → cols[6]=Close, cols[3]=Open
              var stPrice = parseFloat(cols[6]) || parseFloat(cols[7]); // v46.9: Close 우선, Volume 폴백 방어
              var stOpen = parseFloat(cols[3]) || parseFloat(cols[4]);  // Open 우선, High 폴백
              if (stPrice > 0) {
                var stPct = stOpen > 0 ? ((stPrice - stOpen) / stOpen * 100) : 0;
                if (typeof window._aioSetLiveData === 'function') {
                  window._aioSetLiveData(ticker, { price: stPrice, pct: +stPct.toFixed(2) }, { source: 'fallback:stooq', policyKey: 'quote_afterhours', reason: 'ticker detail Stooq fallback' });
                } else {
                  if (!window._liveData) window._liveData = {};
                  window._liveData[ticker] = { price: stPrice, pct: +stPct.toFixed(2) };
                }
                return { ticker: ticker, price: stPrice, pct: +stPct.toFixed(2), name: ticker, source: 'stooq' };
              }
            }
          }
        }
      } catch(e4) {}
    }
  }

  // 한국 종목: siseJson 폴백
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) {
    throwIfLookupAborted();
    var krCode = ticker.replace('.KS','').replace('.KQ','');
    var today = new Date();
    var yd = new Date(today); yd.setDate(yd.getDate()-2);
    var df = function(d){return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');};
    try {
      var sUrl = 'https://api.finance.naver.com/siseJson.naver?symbol=' + krCode + '&requestType=1&startTime=' + df(yd) + '&endTime=' + df(today) + '&timeframe=day';
      var sR;
       try { sR = await fetchWithTimeout(sUrl, { signal: lookupSignal }, 5000); } catch(e5) { sR = await fetchViaProxy(sUrl, { timeout: 6000, signal: lookupSignal }); }
      if (sR.ok) {
        var sTxt = await sR.text();
        var rows = [];
        var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\]/g;
        var mm;
        while ((mm = rx.exec(sTxt)) !== null) rows.push({close:+mm[5], prev:rows.length > 0 ? rows[rows.length-1].close : 0});
        if (rows.length > 0) {
          var last = rows[rows.length-1];
          var prev = rows.length >= 2 ? rows[rows.length-2].close : last.close;
          var kPct = prev > 0 ? ((last.close - prev) / prev * 100) : null;
          if (typeof window._aioSetLiveData === 'function') {
            window._aioSetLiveData(ticker, { price: last.close, pct: kPct != null ? +kPct.toFixed(2) : null }, { source: 'fallback:naver-sise', policyKey: 'quote_afterhours', reason: 'KR ticker detail fallback' });
          } else {
            if (!window._liveData) window._liveData = {};
            window._liveData[ticker] = { price: last.close, pct: kPct != null ? +kPct.toFixed(2) : null, pctMissing: kPct == null };
          }
          return { ticker: ticker, price: last.close, pct: kPct != null ? +kPct.toFixed(2) : null, name: krCode, source: 'naver-sise' };
        }
      }
    } catch(e6) {}
  }

  // v49.67 P352 R122: Finnhub /quote 4번째 폴백 (US/ADR 종목 — Yahoo+Stooq 실패 시)
  var _isUSorADR = !ticker.endsWith('.KS') && !ticker.endsWith('.KQ') && !ticker.includes('=X') && !ticker.includes('=F') && !ticker.startsWith('^') && !ticker.includes('-USD');
  if (_isUSorADR) {
    throwIfLookupAborted();
    try {
      var _fhKey = (typeof _getApiKey === 'function') ? _getApiKey('aio_finnhub_key') : '';
      if (_fhKey) {
        var fhUrl = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(ticker) + '&token=' + _fhKey;
        var fhR = await fetchWithTimeout(fhUrl, { signal: lookupSignal }, 5000);
        if (fhR && fhR.ok) {
          var fhData = await fhR.json();
          if (fhData && fhData.c > 0) {
            var fhPct = fhData.dp != null ? fhData.dp : (fhData.pc > 0 ? ((fhData.c - fhData.pc) / fhData.pc * 100) : null);
            if (typeof window._aioSetLiveData === 'function') {
              window._aioSetLiveData(ticker, { price: fhData.c, pct: fhPct != null ? +Number(fhPct).toFixed(2) : null }, { source: 'fallback:finnhub-quote', policyKey: 'quote_afterhours', reason: 'ticker detail Finnhub 4th fallback' });
            } else {
              if (!window._liveData) window._liveData = {};
              window._liveData[ticker] = { price: fhData.c, pct: fhPct != null ? +Number(fhPct).toFixed(2) : null, pctMissing: fhPct == null };
            }
            return { ticker: ticker, price: fhData.c, pct: fhPct != null ? +Number(fhPct).toFixed(2) : null, name: ticker, source: 'finnhub' };
          }
        }
      }
    } catch(_fhErr) {}
  }

  // v49.67 P352 R122: 모든 폴백 실패 → 구조화된 진단 응답 반환 (이전 null → reason/suggestedAction 명시)
  var _ftType = ticker.endsWith('.KS') || ticker.endsWith('.KQ') ? 'KR 종목 (.KS/.KQ)' :
                ticker.includes('=X') ? '환율' :
                ticker.includes('=F') ? '선물' :
                ticker.startsWith('^') ? '지수' :
                ticker.includes('-USD') ? '암호화폐' :
                ticker.length <= 5 ? '미국/ADR' : '국제';
  var _suggestion = _ftType === 'KR 종목 (.KS/.KQ)'
    ? 'Naver 금융 (finance.naver.com/item/main.naver?code=' + ticker.replace(/\.(KS|KQ)$/, '') + ') 직접 확인 권장'
    : _ftType === '미국/ADR'
    ? 'Yahoo Finance (finance.yahoo.com/quote/' + ticker + ') 또는 Finnhub API key 등록 후 재시도 권장'
    : '외부 도구로 직접 확인 권장';
  return {
    ticker: ticker,
    available: false,
    fetchFailed: true,
    tickerType: _ftType,
    reason: 'Yahoo 3 프록시 + Stooq + Naver + Finnhub 4단계 폴백 모두 실패',
    suggestedAction: _suggestion,
    source: 'none'
  };
}

var _krMacroRetry = 0;
var _krMacroRetryTimer = null; // v46.9: 페이지 이탈 시 clearTimeout용 (P85)
function initKoreaMacro() {
  let ld = window._liveData || {};
  // Check if required data is available, if not retry (max 20 attempts = 10s)
  if (!ld['KRW=X'] || !ld['^TNX']) {
    if (_krMacroRetry++ < 20) { _krMacroRetryTimer = setTimeout(initKoreaMacro, 500); return; }
    _aioLog('warn', 'init', 'initKoreaMacro: 한국 매크로 데이터 로딩 타임아웃');
    return;
  }
  _krMacroRetry = 0;

  // Update KRW exchange rate
  var krw = ld['KRW=X'];
  if (krw && krw.price !== undefined) {
    var el = document.getElementById('kr-macro-krw');
    if (el) {
      el.textContent = krw.price.toFixed(2);
      var chgEl = el.parentElement && el.parentElement.querySelector('.kr-idx-chg');
      if (chgEl && krw.pct !== undefined) {
        chgEl.textContent = (krw.pct >= 0 ? '+' : '') + krw.pct.toFixed(2) + '%';
        chgEl.className = krw.pct >= 0 ? 'pnl pos' : 'pnl neg';
      }
    }
  }

  // Update US 10Y bond yield
  var tnx = ld['^TNX'];
  if (tnx && tnx.price !== undefined) {
    var el = document.getElementById('kr-macro-us10y');
    if (el) {
      el.textContent = tnx.price.toFixed(2) + '%';
      var chgEl = el.parentElement && el.parentElement.querySelector('.kr-idx-chg');
      if (chgEl && tnx.pct !== undefined) {
        chgEl.textContent = (tnx.pct >= 0 ? '+' : '') + tnx.pct.toFixed(2) + '%';
        chgEl.className = tnx.pct >= 0 ? 'pnl pos' : 'pnl neg';
      }
    }
  }

  // 한국 3Y는 관측된 현재 원천만 허용한다. 과거/추정 snapshot을 현재 금리처럼 승격하지 않는다.
  var kr3y = ld['^KR3Y'];
  var kr3yEl = document.getElementById('kr-macro-kr3y');
  var kr3ySourceEl = document.getElementById('kr-macro-kr3y-source');
  if (kr3y && kr3y.price !== undefined) {
    if (kr3yEl) {
      kr3yEl.textContent = kr3y.price.toFixed(2) + '%';
      kr3yEl.style.color = 'var(--text-primary)';
      var chgEl = kr3yEl.parentElement && kr3yEl.parentElement.querySelector('.kr-idx-chg');
      if (chgEl && kr3y.pct !== undefined) {
        chgEl.textContent = (kr3y.pct >= 0 ? '+' : '') + kr3y.pct.toFixed(2) + '%';
        chgEl.className = kr3y.pct >= 0 ? 'pnl pos' : 'pnl neg';
      }
    }
    if (kr3ySourceEl) kr3ySourceEl.textContent = '현재 시세 원천 수신';
  } else {
    if (kr3yEl) { kr3yEl.textContent = '—'; kr3yEl.style.color = 'var(--text-muted)'; }
    if (kr3ySourceEl) kr3ySourceEl.textContent = '현재 금리 원천 미수신 · 과거 추정값 미사용';
  }
  _generateKrMacroAnalysis(ld);
}

// ═══ v37.8: 동적 분석 텍스트 생성 함수 모음 ═══

// ── 1) 한국 매크로 분석 ──
function _generateKrMacroAnalysis(ld) {
  var el = document.getElementById('kr-macro-analysis-text'); if (!el) return;
  var krw = ld['KRW=X'], tnx = ld['^TNX'], vix = ld['^VIX'], kospi = ld['^KS11'] || ld['KOSPI'];
  var dxy = ld['DX-Y.NYB'], wti = ld['CL=F'];
  var t = '';
  // 환율 판단
  if (krw && krw.price) {
    var kp = krw.price;
    t += '<b style="color:var(--accent);">원/달러 ' + kp.toFixed(0) + '원</b> — ';
    t += kp > 1450 ? '<span style="color:var(--red);">1,450원 상회 구간입니다. 전일 등락·외국인 수급·수입물가·정책 발언을 별도 확인하며 원인이나 업종 수혜를 단정하지 않습니다.</span>' :
         kp > 1380 ? '<span style="color:var(--yellow);">1,380원 상회 구간입니다. 환율 수준과 당일 방향을 구분하고 수급·금리차를 교차 확인합니다.</span>' :
         kp > 1300 ? '<span style="color:var(--text-secondary);">1,300~1,380원 구간입니다. 수준 자체를 시장 안정이나 외국인 수급으로 환산하지 않습니다.</span>' :
         '<span style="color:var(--green);">1,300원 미만 구간입니다. 내수 회복이나 외국인 유입 신호로 단독 해석하지 않습니다.</span>';
    t += '<br>';
  }
  // 미국 금리 판단
  if (tnx && tnx.price) {
    var tp = tnx.price;
    t += '<b>미 10Y 금리 ' + tp.toFixed(2) + '%</b> — ';
    t += tp > 4.8 ? '<span style="color:var(--red);">4.8% 상회 구간입니다. 할인율·달러·신용 스프레드 민감도를 함께 확인합니다.</span>' :
         tp > 4.3 ? '<span style="color:var(--yellow);">4.3~4.8% 구간입니다. 성장주 밸류에이션 민감도를 관찰하되 자금 유출을 단정하지 않습니다.</span>' :
         tp > 3.8 ? '<span style="color:var(--text-secondary);">3.8~4.3% 구간입니다. 인하 기대와 물가 경로를 후속 지표로 확인합니다.</span>' :
         '<span style="color:var(--green);">3.8% 미만 구간입니다. 유동성 완화나 주가 상승을 자동 추론하지 않습니다.</span>';
    t += '<br>';
  }
  // VIX 판단 (한국 영향)
  if (vix && vix.price) {
    var vp = vix.price;
    t += '<b>VIX ' + vp.toFixed(1) + '</b> — ';
    t += vp > 30 ? '<span style="color:var(--red);">30 상회 고변동 구간입니다. KOSPI 방향은 수급·환율과 별도 확인합니다.</span>' :
         vp > 22 ? '<span style="color:var(--yellow);">22~30 변동성 경계 구간입니다. 방향 신호가 아니라 예상 변동 범위 확대를 뜻합니다.</span>' :
         vp > 16 ? '<span style="color:var(--text-secondary);">16~22 통상 범위입니다. 한국 시장의 수급·실적을 별도 확인합니다.</span>' :
         '<span style="color:var(--green);">16 미만 저변동 구간입니다. 안정이나 상승을 단독 예측하지 않습니다.</span>';
    t += '<br>';
  }
  // v38.5: 환율 스트레스 인덱스 (KRW 등락률 + VIX 조합)
  if (krw && krw.pct !== undefined && vix && vix.price) {
    var krwStress = Math.abs(krw.pct != null ? krw.pct : 0) * 1.5 + (vix.price > 20 ? (vix.price - 20) * 0.3 : 0);
    var stressLevel = krwStress > 5 ? '위험' : krwStress > 2.5 ? '주의' : '안정';
    var stressColor = krwStress > 5 ? 'var(--red)' : krwStress > 2.5 ? 'var(--yellow)' : 'var(--green)';
    t += '<br><b>【환율 스트레스 인덱스】 <span style="color:' + stressColor + ';">' + stressLevel + ' (' + krwStress.toFixed(1) + ')</span></b> — ';
    t += '<span style="font-size:11px;color:var(--text-muted);">산출: |원/달러 등락률|×1.5 + VIX 초과분×0.3</span>';
    if (krwStress > 5) {
      t += '<br><span style="color:var(--red);">원/달러 절대 등락과 VIX가 함께 높은 관측입니다. 외국인 수급과 헤지 비용을 별도 확인합니다.</span>';
    } else if (krwStress > 2.5) {
      t += '<br><span style="color:var(--yellow);">중간 수준 관측입니다. 환율·VIX의 관측시각과 외국인 수급을 교차 확인합니다.</span>';
    } else {
      t += '<br><span style="color:var(--green);">현재 입력상 낮은 수준입니다. 향후 안정이나 자산 성과를 보장하지 않습니다.</span>';
    }
    t += '<br>';
  }

  // v38.5: 수출 경기 서프라이즈 (KOSPI vs 원/달러 역상관 깨짐 감지)
  if (kospi && kospi.pct !== undefined && krw && krw.pct !== undefined) {
    var kospiChg = kospi.pct != null ? kospi.pct : 0;
    var krwChg = krw.pct != null ? krw.pct : 0; // 양수 = 원화 약세(달러 강세)
    t += '<br><b>【수출 경기 서프라이즈 진단】</b> ';
    if (krwChg > 0.3 && kospiChg < -0.3) {
      // 원화 약세 + KOSPI 하락 = 정상 역상관 깨짐 → 진짜 위험
      t += '<span style="color:var(--red);font-weight:700;">경고: 원화 약세(+' + krwChg.toFixed(1) + '%)인데 KOSPI도 하락(' + kospiChg.toFixed(1) + '%). ';
      t += '두 자산이 같은 방향으로 약세를 보인 관측입니다. 원인은 외국인 순매매·신용·실적 데이터로 별도 검증합니다.</span>';
    } else if (krwChg < -0.3 && kospiChg > 0.3) {
      t += '<span style="color:var(--green);">원화 강세 + KOSPI 상승 동행입니다. 외국인 유입이나 실적 기대를 원인으로 단정하지 않습니다.</span>';
    } else if (krwChg > 0.3 && kospiChg > 0.3) {
      t += '<span style="color:var(--text-secondary);">원화 약세 + KOSPI 상승 동행입니다. 환차익 수혜 여부는 업종·기업별 실적으로 확인합니다.</span>';
    } else {
      t += '<span style="color:var(--text-secondary);">KOSPI ' + (kospiChg >= 0 ? '+' : '') + kospiChg.toFixed(1) + '% / 원/달러 ' + (krwChg >= 0 ? '+' : '') + krwChg.toFixed(1) + '%. 특이 디커플링 미감지.</span>';
    }
    t += '<br>';
  }

  // v38.5: 한국 시장 체력 진단 (KOSPI/KOSDAQ 디커플링)
  var kosdaq = ld['^KQ11'] || ld['KOSDAQ'];
  if (kospi && kospi.pct !== undefined && kosdaq && kosdaq.pct !== undefined) {
    var kspChg = kospi.pct != null ? kospi.pct : 0;
    var ksdqChg = kosdaq.pct != null ? kosdaq.pct : 0;
    var gapPct = kspChg - ksdqChg;
    t += '<br><b>【한국 시장 체력 진단】</b> KOSPI ' + (kspChg >= 0 ? '+' : '') + kspChg.toFixed(2) + '% / KOSDAQ ' + (ksdqChg >= 0 ? '+' : '') + ksdqChg.toFixed(2) + '% (갭 ' + (gapPct >= 0 ? '+' : '') + gapPct.toFixed(2) + '%p) — ';
    if (kspChg < 0 && ksdqChg < kspChg - 0.5) {
      t += '<span style="color:var(--red);">KOSDAQ이 KOSPI보다 더 크게 하락했습니다. 소형주 수급·신용잔고·거래대금을 별도 확인합니다.</span>';
    } else if (ksdqChg > kspChg + 0.5) {
      t += '<span style="color:var(--green);">KOSDAQ이 KOSPI 대비 강세입니다. 개인 수급이나 성장주 선호를 원인으로 단정하지 않습니다.</span>';
    } else {
      t += '<span style="color:var(--text-secondary);">대형/소형주 동조. 시장 전반 방향성 일치. 특이 체력 괴리 없음.</span>';
    }
    t += '<br>';
  }

  // 한미 금리차는 양쪽 공식/실시간 관측치가 모두 있을 때만 계산한다.
  var krRate = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.bokRate != null) ? Number(DATA_SNAPSHOT.bokRate) : null;
  if (tnx && tnx.price && krw && krw.price && Number.isFinite(krRate)) {
    var rateDiff = tnx.price - krRate;
    t += '<br><b>한미 금리차 ' + rateDiff.toFixed(1) + '%p</b> — ';
    if (rateDiff > 2.0) {
      t += '<span style="color:var(--red);">극심한 금리차. 달러캐리 트레이드 유인 → 외국인 한국 채권 매도 + 주식 자금 유출. 원화 약세 가속 요인. ';
      t += '→ 한은의 정책 딜레마: 금리 올리면 내수 충격, 안 올리면 자본 유출.</span>';
    } else if (rateDiff > 1.0) {
      t += '<span style="color:var(--yellow);">금리차 확대 구간. 외국인 수급 불안정. 환헤지 비용 상승으로 외국인 채권 투자 매력 감소.</span>';
    } else {
      t += '<span style="color:var(--green);">금리차 안정. 외국인 자금 흐름 중립. 환율 변동성 제한적.</span>';
    }
    t += '<br>';
    // v38.5: 금리 인하/인상 시나리오별 영향 분석
    t += '<br><b>【금리 시나리오 분석】</b> 현재 한은 기준금리 ' + krRate.toFixed(2) + '% / 미 10Y ' + tnx.price.toFixed(2) + '%<br>';
    var cutRate = krRate - 0.25;
    var hikeRate = krRate + 0.25;
    t += '<span style="font-size:11px;"><b>한은 25bp 인하(' + cutRate.toFixed(2) + '%)시:</b> ';
    t += '한미 금리차 ' + (tnx.price - cutRate).toFixed(1) + '%p로 확대 → 원화 약세 압력↑, ';
    t += '단 내수·건설·중소형주 수혜. 대출금리↓ 소비회복 기대. ';
    if (tnx.price - cutRate > 2.0) {
      t += '<span style="color:var(--red);">자본유출 위험 경계 수준 진입.</span>';
    } else {
      t += '<span style="color:var(--yellow);">관리 가능한 수준.</span>';
    }
    t += '</span><br>';
    t += '<span style="font-size:11px;"><b>한은 25bp 인상(' + hikeRate.toFixed(2) + '%)시:</b> ';
    t += '한미 금리차 ' + (tnx.price - hikeRate).toFixed(1) + '%p로 축소 → 원화 방어 효과, ';
    t += '단 내수 위축·가계부채 부담↑·중소기업 이자부담 가중. ';
    if (krw.price > 1400) {
      t += '<span style="color:var(--yellow);">현 환율 수준에선 인상 압력 존재.</span>';
    } else {
      t += '<span style="color:var(--text-secondary);">환율 안정적이라 인상 필요성 낮음.</span>';
    }
    t += '</span><br>';
  }

  // v38.4: WTI 한국 영향 체인 (인과 체인 확장)
  if (wti && wti.price) {
    var wp = wti.price;
    t += '<b>WTI $' + wp.toFixed(0) + ' → 한국 인과 체인</b> — ';
    if (wp > 90) {
      t += '<span style="color:var(--red);">유가↑ → 수입물가↑ → CPI↑ → 한은 인하 지연 → 내수 약화 → 소비재·항공·운송 약세. ';
      t += '단, 정유(SK이노)·해운(HMM) 마진 확대 구간.</span>';
    } else if (wp > 75) {
      t += '<span style="color:var(--yellow);">적정 범위이나 중동 변수 주시. 한국 무역수지에 중립.</span>';
    } else {
      t += '<span style="color:var(--green);">저유가 → 수입물가↓ → 무역수지 개선 → 한은 인하 여력↑ → 내수·건설·소비 수혜.</span>';
    }
    t += '<br>';
  }

  // v38.4: 상수/변수 분리 (한국 맥락)
  t += '<br><b>【상수 vs 변수 (한국)】</b><br>';
  var krConstants = [], krVariables = [];
  if (tnx && tnx.price > 4.0) krConstants.push('미국 고금리 기조 (Fed 인하 전까지)');
  if (krw && krw.price > 1350) krConstants.push('원화 약세 기조 (한미 금리차 구조적)');
  krVariables.push('외국인 수급 (선물 포지션, ETF 유출입)');
  krVariables.push('중국 경기 (PMI, 부양책 규모)');
  if (vix && vix.price > 20) krVariables.push('글로벌 리스크 심리 (VIX ' + vix.price.toFixed(0) + ')');
  if (krConstants.length) t += ' 상수: ' + krConstants.join(' · ') + '<br>';
  if (krVariables.length) t += ' 변수: ' + krVariables.join(' · ') + '<br>';

  // 종합 판단 (v38.4 강화)
  var krwRisk = (krw && krw.price > 1400) ? 1 : 0;
  var rateRisk = (tnx && tnx.price > 4.5) ? 1 : 0;
  var vixRisk = (vix && vix.price > 25) ? 1 : 0;
  var riskSum = krwRisk + rateRisk + vixRisk;
  t += '<br><b>【종합 판단】</b> ';
  t += riskSum >= 3 ? '<span style="color:var(--red);font-weight:700;"> 삼중 악재 (환율↑ 금리↑ 변동성↑). 현금비중 50% 이상 유지, 방산·필수소비재 방어 전략.</span>' :
       riskSum === 2 ? '<span style="color:var(--yellow);font-weight:700;"> 이중 부담. 선별적 매매 필요. 고배당·수출주 중심 포트폴리오 추천.</span>' :
       riskSum === 1 ? '<span style="color:var(--text-secondary);font-weight:700;"> 일부 리스크 존재. 업종별 차별화 예상. 실적 모멘텀 기반 종목 선별.</span>' :
       '<span style="color:var(--green);font-weight:700;"> 매크로 환경 양호! 환율 안정+금리 적정+변동성 낮음. 성장테마 적극 비중 확대 구간.</span>';

  // v40.4: 교차변수 심화 진단
  if (wti && wti.price && krw && krw.price && vix && vix.price) {
    t += '<br><br><b>【교차변수 심화 진단】</b><br>';
    var wp2 = wti.price, kp2 = krw.price, vp2 = vix.price;
    // 유가↑+원화↓ = 수입물가 이중 타격
    if (wp2 > 90 && kp2 > 1400) {
      t += '<span style="color:var(--red);">유가 $' + wp2.toFixed(0) + ' + 원화 ' + Math.round(kp2) + '원 = 수입물가 이중 타격. 달러 기준 유가와 원화 약세가 결합하면 원화 기준 유가는 더 비쌈. 정유·에너지 수혜이나 물가↑→한은 인하 지연→내수 약화 연쇄.</span><br>';
    }
    // VIX↑+원화↓ = 외국인 이탈 가속
    if (vp2 > 25 && kp2 > 1400) {
      t += '<span style="color:var(--red);">VIX ' + vp2.toFixed(0) + ' + 원화 약세 = 외국인 이중 이탈 압력. 글로벌 리스크오프 + 환손실 우려 동시 작용 → KOSPI 하락 압력 극대화.</span><br>';
    }
    // 금리↑+원화↓ = 한은 딜레마 심화
    if (tnx && tnx.price > 4.5 && kp2 > 1400) {
      t += '<span style="color:var(--yellow);">미국 고금리(' + tnx.price.toFixed(1) + '%) + 원화 약세 = 한은 정책 딜레마 심화. 인하하면 자본유출, 동결하면 내수 침체. "진퇴양난" 국면.</span><br>';
    }
    // 긍정 조합: VIX↓+원화↑
    if (vp2 < 18 && kp2 < 1350) {
      t += '<span style="color:var(--green);">VIX ' + vp2.toFixed(0) + ' + 원화 강세(' + Math.round(kp2) + '원) = 과거 외국인 유입에 우호적이었던 조합(관측). 매수 타이밍 근거로는 사용하지 마세요.</span><br>';
    }
  }

  // v40.4: 트레이딩 스코어 연동
  var krMacroTs = null;
  try { if (typeof computeTradingScore === 'function') krMacroTs = computeTradingScore().score; } catch(e) {}
  if (krMacroTs != null && isFinite(Number(krMacroTs))) {
    t += '<br><b>【글로벌 시장 환경】</b> 트레이딩 스코어 <b style="color:' + (krMacroTs >= 55 ? 'var(--green)' : krMacroTs >= 35 ? 'var(--yellow)' : 'var(--red)') + ';">' + krMacroTs + '/100</b> — ';
    t += krMacroTs >= 55 ? '글로벌 환경 양호. 한국 시장 동반 상승 기대.' :
         krMacroTs >= 35 ? '글로벌 환경 혼조. 한국 고유 재료(수급·실적)가 방향 결정.' :
         '글로벌 환경 약세. 코스피 하방 압력 지속. 방어적 포지션 유지.';
  } else t += '<br><b>【글로벌 시장 환경】</b> 필수 입력 미수신으로 점수 산출 보류.';

  el.innerHTML = t || '데이터 대기 중...';
}

// ── 2) 한국 테마 동향 분석 ──
function _generateKrThemesAnalysis(ld) {
  var el = document.getElementById('kr-themes-analysis-text'); if (!el) return;
  if (typeof KR_THEME_MAP === 'undefined') { el.textContent = '테마 데이터 없음'; return; }
  refreshKrThemeRuntimeWeights();
  var coverage = window.AIO && typeof window.AIO.evaluateKrThemeQuoteCoverage === 'function'
    ? window.AIO.evaluateKrThemeQuoteCoverage(ld, KR_THEME_MAP) : null;
  if (!coverage || !coverage.sufficient) {
    var pct = coverage ? Math.round(coverage.weightedCoverage * 100) : 0;
    var count = coverage ? coverage.validThemeCount : 0;
    var total = coverage ? coverage.themeCount : Object.keys(KR_THEME_MAP).length;
    el.innerHTML = '<b style="color:var(--data-amber);">테마 종합판정 보류</b> — 유효 테마 ' + count + '/' + total + ', 구성종목 가중 커버리지 ' + pct + '%. 결측 테마를 0% 또는 중립으로 간주하지 않습니다.';
    return;
  }
  var validIds = coverage.validThemeIds;
  var CN = {'defense':'방산','semi':'반도체','shipbuilding':'조선','ai-sw':'AI/SW','power-grid':'전력기기','nuclear':'원전','battery':'2차전지','bio':'바이오','kbeauty':'K뷰티','kcontent':'K콘텐츠','auto':'자동차','robot':'로봇','finance':'금융','kfood':'K푸드','crypto':'크립토','telecom':'통신','construction':'건설','retail':'유통','steel_chem':'철강/화학','logistics':'물류','medtech_kr':'의료기기','energy_kr':'에너지','photonics_kr':'광/포토닉스'};
  var perfs = [];
  for (var tid in KR_THEME_MAP) {
    var t = KR_THEME_MAP[tid], ws = 0, vs = 0;
    t.forEach(function(s) { var d = ld[krTickerToYahoo(s.code)]; if (d && d.pct !== undefined && s.w > 0) { vs += d.pct * s.w; ws += s.w; } });
    if (validIds.indexOf(tid) >= 0 && ws > 0) perfs.push({ id: tid, name: CN[tid] || tid, perf: vs / ws });
  }
  if (!perfs.length) { el.textContent = '실시간 데이터 대기 중...'; return; }
  perfs.sort(function(a, b) { return b.perf - a.perf; });
  var top3 = perfs.slice(0, 3), bot3 = perfs.slice(-3).reverse();
  var hotCount = perfs.filter(function(p) { return p.perf >= 1; }).length;
  var coldCount = perfs.filter(function(p) { return p.perf <= -1; }).length;
  var avgPerf = perfs.reduce(function(s, p) { return s + p.perf; }, 0) / perfs.length;

  var h = '<b style="color:var(--green);">상승 주도:</b> ' + top3.map(function(p) { return p.name + ' <b style="color:var(--green);">' + (p.perf >= 0 ? '+' : '') + p.perf.toFixed(1) + '%</b>'; }).join(', ') + '<br>';
  h += '<b style="color:var(--red);">하락 주도:</b> ' + bot3.map(function(p) { return p.name + ' <b style="color:var(--red);">' + (p.perf >= 0 ? '+' : '') + p.perf.toFixed(1) + '%</b>'; }).join(', ') + '<br>';
  h += '<br>';

  // 시장 폭 판단
  h += '<b>【테마 폭 판단】</b> ';
  if (hotCount >= perfs.length * 0.6) h += '<span style="color:var(--green);">유효 표본 내 강세 확산 ('+hotCount+'/'+perfs.length+' 상승). 진입 판단은 거래량·외국인/기관 수급·시장 지수 추세를 추가 확인.</span>';
  else if (coldCount >= perfs.length * 0.6) h += '<span style="color:var(--red);">유효 표본 내 약세 확산 ('+coldCount+'/'+perfs.length+' 하락). 헤지는 보유 위험과 추세 확인 후 판단.</span>';
  else h += '<span style="color:var(--yellow);">테마 차별화 장세. 순위는 관찰 신호이며 단독 매수·회피 지시가 아닙니다.</span>';
  h += '<br>';

  // 방어 vs 성장 판단
  var defThemes = ['defense','nuclear','telecom','finance','kfood'];
  var growThemes = ['semi','ai-sw','battery','robot','bio'];
  var defAvg = 0, growAvg = 0, defN = 0, growN = 0;
  perfs.forEach(function(p) {
    if (defThemes.indexOf(p.id) >= 0) { defAvg += p.perf; defN++; }
    if (growThemes.indexOf(p.id) >= 0) { growAvg += p.perf; growN++; }
  });
  if (defN > 0) defAvg /= defN;
  if (growN > 0) growAvg /= growN;
  h += '<b>【스타일 판단】</b> ';
  if (growAvg > defAvg + 0.5) h += '<span style="color:var(--green);">성장 테마 상대우위 (성장 ' + growAvg.toFixed(1) + '% vs 방어 ' + defAvg.toFixed(1) + '%). 비중 변경 전 추세 지속성과 수급을 확인.</span>';
  else if (defAvg > growAvg + 0.5) h += '<span style="color:var(--yellow);">방어 테마 상대우위 (방어 ' + defAvg.toFixed(1) + '% vs 성장 ' + growAvg.toFixed(1) + '%). 하루 수익률만으로 리스크오프를 확정하지 않음.</span>';
  else h += '<span>성장·방어 균형. 모멘텀 추종보다 실적 기반 종목 선별 유효.</span>';
  h += '<br>';

  // v38.4: 미국 연동 테마 분석 (매크로 시그널 레퍼런스)
  var usLd = window._liveData || {};
  // v38.4d: ETF 매핑 검증 완료 + 누락 6개 추가. 모든 티커는 _liveData에서 수신 확인됨.
  var usThemeLinks = {
    'semi': { us: 'SOXX', name: '미국 반도체(SOXX)' },
    'ai-sw': { us: 'IGV', name: '미국 소프트웨어(IGV)' },   // v38.4d: QQQM→IGV (AI/SW 테마에 소프트웨어 ETF가 더 정확)
    'battery': { us: 'LIT', name: '미국 리튬(LIT)' },
    'bio': { us: 'XBI', name: '미국 바이오(XBI)' },
    'energy_kr': { us: 'XLE', name: '미국 에너지(XLE)' },
    'robot': { us: 'BOTZ', name: '미국 로봇(BOTZ)' },
    'defense': { us: 'ITA', name: '미국 방산(ITA)' },         // v38.4d 추가
    'nuclear': { us: 'URA', name: '미국 우라늄(URA)' },       // v38.4d 추가
    'finance': { us: 'XLF', name: '미국 금융(XLF)' },         // v38.4d 추가
    'steel_chem': { us: 'XLB', name: '미국 소재(XLB)' },      // v38.4d 추가
    'crypto': { us: 'BITO', name: '미국 비트코인(BITO)' }     // v38.4d 추가
  };
  var linkAnalysis = [];
  perfs.forEach(function(p) {
    var link = usThemeLinks[p.id];
    if (link) {
      var usD = usLd[link.us];
      if (usD && usD.pct !== undefined) {
        var gap = p.perf - usD.pct;
        if (Math.abs(gap) > 1.5) {
          linkAnalysis.push({ kr: p.name, us: link.name, krPct: p.perf, usPct: usD.pct, gap: gap });
        }
      }
    }
  });
  if (linkAnalysis.length > 0) {
    h += '<br><b>【한미 테마 연동 괴리】</b> ';
    linkAnalysis.forEach(function(la) {
      h += la.kr + ' ' + (la.krPct >= 0 ? '+' : '') + la.krPct.toFixed(1) + '% vs ' + la.us + ' ' + (la.usPct >= 0 ? '+' : '') + la.usPct.toFixed(1) + '% (괴리 ' + (la.gap >= 0 ? '+' : '') + la.gap.toFixed(1) + '%p) — ';
      if (la.gap > 2) h += '<span style="color:var(--green);">한국 아웃퍼폼. 외국인 매수 또는 한국 고유 모멘텀(정책·수급). 지속성 확인 필요.</span>';
      else if (la.gap < -2) h += '<span style="color:var(--red);">한국 언더퍼폼. 미국 대비 할인 — 외국인 매도 또는 원화 약세 디스카운트. 반등 시 캐치업 기회.</span>';
      h += '<br>';
    });
  }

  // v38.4: 테마 순환매 사이클 프레임
  if (perfs.length >= 5) {
    h += '<br><b>【순환매 사이클 진단】</b> ';
    var topPerf = perfs[0].perf, botPerf = perfs[perfs.length - 1].perf;
    var perfRange = topPerf - botPerf;
    if (perfRange > 4) {
      h += '<span style="color:var(--yellow);">테마 간 격차 ' + perfRange.toFixed(1) + '%p → 극단적 쏠림. 과열 테마에서 소외 테마로 순환매 전환 임박 가능. ';
      h += '하위 테마 중 펀더멘털 양호한 종목 관심.</span>';
    } else if (perfRange < 1.5) {
      h += '<span style="color:var(--accent);">테마 간 격차 ' + perfRange.toFixed(1) + '%p → 동반 등락. 테마 선별보다 시장 방향성이 중요한 국면.</span>';
    } else {
      h += '<span>정상적 차별화. 상위 테마 추종 + 하위 테마 역발상 병행.</span>';
    }
  }

  // v40.4: 매크로 환경 연동 테마 진단
  var krMacroVix = usLd['^VIX'] ? usLd['^VIX'].price : null;
  var krMacroWti = usLd['CL=F'] ? usLd['CL=F'].price : null;
  var krMacroKrw = usLd['KRW=X'] ? usLd['KRW=X'].price : null;
  if (krMacroVix || krMacroWti || krMacroKrw) {
    h += '<br><br><b>【매크로 환경 → 테마 영향】</b><br>';
    if (krMacroWti && krMacroWti > 100) {
      h += '<span style="color:var(--red);">유가 $' + krMacroWti.toFixed(0) + ' → 에너지·정유 수혜, 항공·운송·2차전지 역풍. 원자재 비용 부담이 테마 전반에 영향.</span><br>';
    }
    if (krMacroKrw && krMacroKrw > 1400) {
      h += '<span style="color:var(--yellow);">원화 약세(' + Math.round(krMacroKrw) + '원) → 수출테마(반도체·조선·자동차) 환율수혜 vs 수입의존(바이오원료·2차전지소재) 비용↑.</span><br>';
    }
    if (krMacroVix && krMacroVix > 25) {
      h += '<span style="color:var(--red);">VIX ' + krMacroVix.toFixed(0) + '+ → 글로벌 공포 확산. 외국인 이탈 가속 → 소형주·테마주 변동성 극대화. 대형 방어테마(방산·원전·통신) 선호.</span><br>';
    }
    // 복합 시나리오
    if (krMacroWti && krMacroWti > 100 && krMacroKrw && krMacroKrw > 1400 && krMacroVix && krMacroVix > 25) {
      h += '<span style="color:var(--red);font-weight:700;"> 삼중 악재(유가↑+원화↓+VIX↑) 동시 발생. 방어테마 집중 + 현금비중 확대 필수.</span><br>';
    }
  }

  // v40.4: 트레이딩 스코어 연동
  var krTsVal = null;
  try { if (typeof computeTradingScore === 'function') krTsVal = computeTradingScore().score; } catch(e) {}
  if (krTsVal != null && isFinite(Number(krTsVal))) {
    h += '<br><b>【시장 환경】</b> 트레이딩 스코어 <b style="color:' + (krTsVal >= 55 ? 'var(--green)' : krTsVal >= 35 ? 'var(--yellow)' : 'var(--red)') + ';">' + krTsVal + '/100</b> — ';
    h += krTsVal >= 55 ? '역사적으로 테마 순환매가 활발하던 환경(환경 설명값, 예측 아님).' :
         krTsVal >= 35 ? '역사적으로 실적 뒷받침 없는 테마의 성과가 부진하던 환경.' :
         '역사적으로 테마 전반이 부진하고 방어적 대응이 우선시되던 환경.';
  } else h += '<br><b>【시장 환경】</b> 필수 입력 미수신으로 점수 산출 보류.';

  el.innerHTML = h;
}

// ── 3) 포트폴리오 자동 진단 ──
function _generatePortfolioAnalysis(positions, ld, stats) {
  var el = document.getElementById('pf-analysis-text'); if (!el) return;
  if (!positions || positions.length === 0) { el.textContent = '포트폴리오를 추가하면 자동 분석됩니다'; return; }
  var h = '';
  // 집중도 분석
  var vals = positions.map(function(p) { var d = ld[p.ticker]; return { ticker: p.ticker, val: (d ? d.price : p.cost) * p.qty }; });
  vals.sort(function(a, b) { return b.val - a.val; });
  var topPct = stats.totalValue > 0 ? (vals[0].val / stats.totalValue * 100) : 0;
  h += '<b>집중도:</b> 최대 비중 ' + vals[0].ticker + ' <b>' + topPct.toFixed(0) + '%</b>';
  h += topPct > 40 ? ' <span style="color:var(--red);">— 과집중 위험! 해당 종목 급락 시 포트폴리오 전체 타격. 30% 이하로 분산 권장.</span>' :
       topPct > 25 ? ' <span style="color:var(--yellow);">— 비중 높음. 리스크 관리 필요.</span>' :
       ' <span style="color:var(--green);">— 적정 분산.</span>';
  h += '<br>';
  // 일간 손익 판단
  var dpct = stats.totalValue > 0 ? (stats.totalDailyChg / stats.totalValue * 100) : 0;
  h += '<b>오늘:</b> ' + (dpct >= 0 ? '+' : '') + dpct.toFixed(2) + '% ';
  h += Math.abs(dpct) > 3 ? '<span style="color:var(--red);">— 변동 과대. 리밸런싱 검토.</span>' :
       dpct > 1 ? '<span style="color:var(--green);">— 양호한 수익. 추세 지속 확인.</span>' :
       dpct < -1 ? '<span style="color:var(--yellow);">— 하락 압력. 손절/추매 기준 점검.</span>' :
       '<span>— 보합권.</span>';
  h += '<br>';
  // 총 손익
  h += '<b>누적 P&L:</b> ' + (stats.totalPnlPct >= 0 ? '+' : '') + stats.totalPnlPct.toFixed(1) + '% ';
  h += stats.totalPnlPct > 20 ? '<span style="color:var(--green);">— 고수익 구간. 일부 이익 실현 고려.</span>' :
       stats.totalPnlPct > 0 ? '<span style="color:var(--green);">— 수익 중. 손절선 관리 유지.</span>' :
       stats.totalPnlPct > -10 ? '<span style="color:var(--yellow);">— 소폭 손실. 종목별 원인 분석 필요.</span>' :
       '<span style="color:var(--red);">— 큰 손실 구간. 전체 전략 재검토 필요. 손절 기준 즉시 점검.</span>';
  h += '<br>';

  // v38.5: 섹터 분산도 진단
  if (positions.length >= 2) {
    var sectorWeights = {};
    var _aioScreenerRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    var totalVal = stats.totalValue || 1;
    positions.forEach(function(p) {
      var d = ld[p.ticker];
      var val = (d ? d.price : p.cost) * p.qty;
      // SCREENER_DB에서 섹터 조회
      var sec = 'Unknown';
      if (Array.isArray(_aioScreenerRows)) {
        for (var si = 0; si < _aioScreenerRows.length; si++) {
          if (_aioScreenerRows[si].sym === p.ticker) { sec = _aioScreenerRows[si].sector || 'Unknown'; break; }
        }
      }
      if (!sectorWeights[sec]) sectorWeights[sec] = 0;
      sectorWeights[sec] += val;
    });
    var sectorEntries = [];
    for (var sk in sectorWeights) { sectorEntries.push({ name: sk, weight: sectorWeights[sk] / totalVal * 100 }); }
    sectorEntries.sort(function(a, b) { return b.weight - a.weight; });
    h += '<br><b>【섹터 분산도 진단】</b> ';
    var secLabels = sectorEntries.map(function(s) { return s.name + ' ' + s.weight.toFixed(0) + '%'; });
    h += secLabels.join(' · ');
    if (sectorEntries.length > 0 && sectorEntries[0].weight > 50) {
      h += '<br><span style="color:var(--red);font-weight:700;">경고: ' + sectorEntries[0].name + ' 섹터에 ' + sectorEntries[0].weight.toFixed(0) + '% 집중. ';
      h += '해당 섹터 악재 시 포트폴리오 전체 타격. 다른 섹터로 20%p 이상 분산 권장.</span>';
    } else if (sectorEntries.length > 0 && sectorEntries[0].weight > 35) {
      h += '<br><span style="color:var(--yellow);">' + sectorEntries[0].name + ' 비중 높음(' + sectorEntries[0].weight.toFixed(0) + '%). 섹터 리스크 모니터링 필요.</span>';
    } else if (sectorEntries.length >= 3) {
      h += '<br><span style="color:var(--green);">양호한 섹터 분산. 특정 섹터 충격에 대한 버퍼 확보.</span>';
    }
    h += '<br>';
  }

  // v38.5: 매크로 민감도 프로파일 (VIX/금리/달러 변동 시 포트폴리오 예상 영향)
  var macroLd = window._liveData || {};
  var vixNow = macroLd['^VIX'] ? macroLd['^VIX'].price : 0;
  var tnxNow = macroLd['^TNX'] ? macroLd['^TNX'].price : 0;
  var dxyNow = macroLd['DX-Y.NYB'] ? macroLd['DX-Y.NYB'].price : 0;
  if (positions.length >= 2 && (vixNow > 0 || tnxNow > 0)) {
    h += '<br><b>【매크로 민감도 프로파일】</b><br>';
    // VIX 민감도
    var techCount = 0, defCount = 0;
    if (Array.isArray(_aioScreenerRows)) {
      positions.forEach(function(p) {
        for (var si = 0; si < _aioScreenerRows.length; si++) {
          if (_aioScreenerRows[si].sym === p.ticker) {
            var sec = _aioScreenerRows[si].sector || '';
            if (sec === 'Technology' || sec === 'Consumer') techCount++;
            if (sec === 'Healthcare' || sec === 'Utilities' || sec === 'Consumer Defensive') defCount++;
            break;
          }
        }
      });
    }
    var vixSensitivity = techCount > defCount ? '높음' : techCount < defCount ? '낮음' : '중립';
    var rateSensitivity = techCount > positions.length * 0.4 ? '높음' : '중립';
    h += '<span style="font-size:11px;">VIX 급등(+10) 시 예상 영향: <b style="color:' + (vixSensitivity === '높음' ? 'var(--red)' : vixSensitivity === '낮음' ? 'var(--green)' : 'var(--yellow)') + ';">' + vixSensitivity + '</b>';
    h += ' (성장주 ' + techCount + '개 / 방어주 ' + defCount + '개)</span><br>';
    h += '<span style="font-size:11px;">금리 +25bp 시 예상 영향: <b style="color:' + (rateSensitivity === '높음' ? 'var(--red)' : 'var(--yellow)') + ';">' + rateSensitivity + '</b>';
    if (rateSensitivity === '높음') h += ' — 성장주 비중 40%+ → 금리 민감도 높음. 듀레이션 리스크 주의.';
    h += '</span><br>';
    if (dxyNow > 0) {
      h += '<span style="font-size:11px;">달러 +2% 시 예상 영향: ';
      if (dxyNow > 106) h += '<b style="color:var(--yellow);">이미 강달러 구간</b> — 추가 강세 시 다국적 기업 실적 역풍.';
      else h += '<b style="color:var(--text-secondary);">제한적</b> — 달러 중립 구간.';
      h += '</span><br>';
    }
    // 종합 매크로 리스크
    var riskFlags = [];
    if (vixNow > 25) riskFlags.push('고변동성(VIX ' + vixNow.toFixed(0) + ')');
    if (tnxNow > 4.5) riskFlags.push('고금리(10Y ' + tnxNow.toFixed(1) + '%)');
    if (dxyNow > 106) riskFlags.push('강달러(DXY ' + dxyNow.toFixed(0) + ')');
    if (riskFlags.length >= 2) {
      h += '<span style="color:var(--red);">복합 매크로 리스크: ' + riskFlags.join(' + ') + '. 현금비중↑ 또는 방어주 리밸런싱 검토.</span>';
    } else if (riskFlags.length === 1) {
      h += '<span style="color:var(--yellow);">' + riskFlags[0] + ' 주의.</span>';
    } else {
      h += '<span style="color:var(--green);">매크로 환경 양호. 공격적 포지셔닝 유지 가능.</span>';
    }
    h += '<br>';
  }

  // v38.5: 승자-패자 분석 강화 (보유기간 대비 수익률 효율성 추가)
  if (positions.length >= 3) {
    var posPerfs = positions.map(function(p) {
      var d = ld[p.ticker];
      var curVal = d ? d.price * p.qty : p.cost * p.qty;
      var costVal = p.cost * p.qty;
      var pnlPct = costVal > 0 ? ((curVal - costVal) / costVal * 100) : 0;
      var holdDays = p.addedAt ? Math.max(1, Math.floor((Date.now() - p.addedAt) / 86400000)) : null;
      var efficiency = holdDays ? (pnlPct / holdDays) : null; // 일평균 수익률
      return { ticker: p.ticker, pnl: pnlPct, dailyChg: d ? (d.pct != null ? d.pct : 0) : 0, holdDays: holdDays, efficiency: efficiency };
    });
    posPerfs.sort(function(a, b) { return b.pnl - a.pnl; });
    var topPerf = posPerfs[0], botPerf = posPerfs[posPerfs.length - 1];
    h += '<br><b>【승자-패자 분석】</b><br>';
    h += '<span style="color:var(--green);">최고: ' + topPerf.ticker + ' ' + (topPerf.pnl >= 0 ? '+' : '') + topPerf.pnl.toFixed(1) + '%</span>';
    if (topPerf.holdDays) h += ' (' + topPerf.holdDays + '일 보유, 일평균 ' + (topPerf.efficiency >= 0 ? '+' : '') + topPerf.efficiency.toFixed(2) + '%/일)';
    h += '<br>';
    h += '<span style="color:var(--red);">최저: ' + botPerf.ticker + ' ' + (botPerf.pnl >= 0 ? '+' : '') + botPerf.pnl.toFixed(1) + '%</span>';
    if (botPerf.holdDays) h += ' (' + botPerf.holdDays + '일 보유, 일평균 ' + (botPerf.efficiency >= 0 ? '+' : '') + botPerf.efficiency.toFixed(2) + '%/일)';
    h += '<br>';
    // 효율성 기반 인사이트
    var effSorted = posPerfs.filter(function(p) { return p.efficiency !== null; });
    if (effSorted.length >= 2) {
      effSorted.sort(function(a, b) { return (b.efficiency || 0) - (a.efficiency || 0); });
      var bestEff = effSorted[0], worstEff = effSorted[effSorted.length - 1];
      if (worstEff.efficiency !== null && worstEff.efficiency < -0.5 && worstEff.holdDays > 30) {
        h += '<span style="color:var(--red);font-size:11px;">' + worstEff.ticker + ': ' + worstEff.holdDays + '일간 일평균 ' + worstEff.efficiency.toFixed(2) + '%/일 손실. 장기 하락 추세 → 손절 또는 전략 재검토 시급.</span><br>';
      }
    }
    if (topPerf.pnl - botPerf.pnl > 30) {
      h += '<span style="color:var(--yellow);">승패 격차 ' + (topPerf.pnl - botPerf.pnl).toFixed(0) + '%p. 과도한 비대칭 → 승자 일부 이익실현, 저평가 종목 또는 현금으로 재배치 검토.</span><br>';
    }
  }

  // v38.5: 목표가 대비 포지셔닝
  var targetPositions = positions.filter(function(p) { return p.target && p.target > 0; });
  if (targetPositions.length > 0) {
    h += '<br><b>【목표가 대비 포지셔닝】</b><br>';
    targetPositions.forEach(function(p) {
      var d = ld[p.ticker];
      var curPrice = d ? d.price : p.cost;
      var distPct = ((p.target - curPrice) / curPrice * 100);
      var progressPct = p.cost > 0 ? ((curPrice - p.cost) / (p.target - p.cost) * 100) : 0;
      progressPct = Math.max(0, Math.min(progressPct, 200));
      var color = distPct <= 0 ? 'var(--green)' : distPct < 10 ? 'var(--accent)' : distPct < 30 ? 'var(--yellow)' : 'var(--text-muted)';
      h += '<span style="font-size:11px;">' + p.ticker + ': 현재 $' + curPrice.toFixed(2) + ' → 목표 $' + p.target.toFixed(2) + ' (';
      if (distPct <= 0) {
        h += '<b style="color:var(--green);">목표 달성!</b> +' + Math.abs(distPct).toFixed(1) + '% 초과';
      } else {
        h += '<b style="color:' + color + ';">잔여 ' + distPct.toFixed(1) + '%</b>';
        if (distPct < 5) h += ' — 목표가 부근. 프레임워크상 이익 보호가 논의되는 지점(지시 아님)';
        else if (distPct < 15) h += ' — 접근 중, 목표 도달 시 매도 계획 준비';
      }
      h += ')</span><br>';
    });
  }

  // v38.5: 리스크 스코어카드 (집중도+변동성+매크로노출 종합)
  if (positions.length >= 2) {
    h += '<br><b>【리스크 스코어카드】</b> ';
    var riskScore = 0;
    // 1. 집중도 리스크 (0~2)
    if (topPct > 40) riskScore += 2;
    else if (topPct > 25) riskScore += 1;
    // 2. 변동성 리스크 (0~2) - 일간 변동 기반
    var avgAbsChg = 0;
    var chgCount = 0;
    positions.forEach(function(p) {
      var d = ld[p.ticker];
      if (d && d.pct !== undefined) { avgAbsChg += Math.abs(d.pct); chgCount++; }
    });
    avgAbsChg = chgCount > 0 ? avgAbsChg / chgCount : 0;
    if (avgAbsChg > 3) riskScore += 2;
    else if (avgAbsChg > 1.5) riskScore += 1;
    // 3. 매크로 노출 (0~1)
    if (vixNow > 25 || tnxNow > 4.5 || dxyNow > 106) riskScore += 1;
    // 등급 산출
    var riskGrade, riskColor, riskLabel;
    if (riskScore >= 4) { riskGrade = 5; riskColor = 'var(--red)'; riskLabel = '매우 높음'; }
    else if (riskScore === 3) { riskGrade = 4; riskColor = '#b13a30'; riskLabel = '높음'; }
    else if (riskScore === 2) { riskGrade = 3; riskColor = 'var(--yellow)'; riskLabel = '보통'; }
    else if (riskScore === 1) { riskGrade = 2; riskColor = 'var(--accent)'; riskLabel = '낮음'; }
    else { riskGrade = 1; riskColor = 'var(--green)'; riskLabel = '매우 낮음'; }
    h += '<b style="color:' + riskColor + ';font-size:14px;">등급 ' + riskGrade + '/5 (' + riskLabel + ')</b><br>';
    h += '<span style="font-size:11px;color:var(--text-muted);">산출근거: 집중도(' + (topPct > 40 ? '2' : topPct > 25 ? '1' : '0') + ') + 변동성(' + (avgAbsChg > 3 ? '2' : avgAbsChg > 1.5 ? '1' : '0') + ') + 매크로(' + (vixNow > 25 || tnxNow > 4.5 || dxyNow > 106 ? '1' : '0') + ')</span>';
    if (riskGrade >= 4) {
      h += '<br><span style="color:var(--red);">현금비중 30%+ 권장. 손절선 엄격 관리. 신규 진입 자제.</span>';
    } else if (riskGrade === 3) {
      h += '<br><span style="color:var(--yellow);">정상 리스크. 포지션 사이즈 조절로 관리 가능.</span>';
    }
  }
  // v39.2: 포트폴리오 베타 추정 + MDD 시나리오 + 상관계수 + 스트레스 테스트
  if (positions.length >= 2 && Array.isArray(_aioScreenerRows)) {
    // 섹터별 평균 베타 테이블
    var _SECTOR_BETA = { 'Technology': 1.3, 'Semiconductors': 1.4, 'Consumer': 1.1, 'Communication': 1.15,
      'Financials': 1.1, 'Industrials': 1.0, 'Energy': 0.9, 'Materials': 0.95,
      'Healthcare': 0.8, 'Utilities': 0.5, 'Consumer Defensive': 0.6, 'Real Estate': 0.75 };
    // 섹터간 상관 매트릭스 (근사)
    var _SECTOR_CORR = {
      'Technology_Technology': 0.85, 'Technology_Semiconductors': 0.80, 'Technology_Consumer': 0.55,
      'Technology_Healthcare': 0.25, 'Technology_Utilities': -0.05, 'Technology_Energy': 0.20,
      'Technology_Financials': 0.45, 'Technology_Industrials': 0.50,
      'Semiconductors_Semiconductors': 0.85, 'Energy_Energy': 0.80, 'Healthcare_Healthcare': 0.70,
      'Financials_Financials': 0.75, 'Utilities_Utilities': 0.65,
      'Healthcare_Utilities': 0.35, 'Energy_Utilities': 0.15, 'Energy_Technology': 0.20
    };
    function _getSectorCorr(s1, s2) {
      if (s1 === s2) return _SECTOR_CORR[s1 + '_' + s1] || 0.75;
      var key1 = s1 + '_' + s2, key2 = s2 + '_' + s1;
      return _SECTOR_CORR[key1] || _SECTOR_CORR[key2] || 0.30;
    }
    // 포지션별 섹터+비중+베타 계산
    var pfBeta = 0, totalW = 0;
    var posInfo = positions.map(function(p) {
      var d = ld[p.ticker]; var val = (d ? d.price : p.cost) * p.qty;
      var sec = 'Unknown';
      for (var si = 0; si < _aioScreenerRows.length; si++) {
        if (_aioScreenerRows[si].sym === p.ticker) { sec = _aioScreenerRows[si].sector || 'Unknown'; break; }
      }
      var beta = _SECTOR_BETA[sec] || 1.0;
      var w = stats.totalValue > 0 ? val / stats.totalValue : 0;
      pfBeta += beta * w; totalW += w;
      return { ticker: p.ticker, sector: sec, beta: beta, weight: w, val: val };
    });
    pfBeta = totalW > 0 ? pfBeta / totalW : 1.0; // v46.9: 가중평균 베타 수정 (이전 /totalW*totalW noop)

    h += '<br><b>【포트폴리오 베타 & 상관계수 분석】</b><br>';
    h += '<span style="font-size:11px;">포트폴리오 가중평균 베타: <b style="color:' + (pfBeta > 1.2 ? 'var(--red)' : pfBeta > 0.8 ? 'var(--yellow)' : 'var(--green)') + ';">' + pfBeta.toFixed(2) + '</b>';
    h += pfBeta > 1.2 ? ' — 시장보다 공격적. S&P -10% 시 약 -' + (pfBeta * 10).toFixed(0) + '% 예상.' :
         pfBeta < 0.8 ? ' — 방어적 포트폴리오. 시장 하락 시 완충.' : ' — 시장과 유사한 변동성.';
    h += '</span><br>';

    // 상관계수 다양화 점수 (0~100, 높을수록 분산)
    if (posInfo.length >= 2) {
      var totalCorr = 0, corrPairs = 0;
      for (var ci = 0; ci < posInfo.length; ci++) {
        for (var cj = ci + 1; cj < posInfo.length; cj++) {
          totalCorr += _getSectorCorr(posInfo[ci].sector, posInfo[cj].sector);
          corrPairs++;
        }
      }
      var avgCorr = corrPairs > 0 ? totalCorr / corrPairs : 0;
      var divScore = Math.round((1 - avgCorr) * 100);
      h += '<span style="font-size:11px;">종목간 평균 상관계수: <b>' + avgCorr.toFixed(2) + '</b> → 분산화 점수: <b style="color:' + (divScore > 60 ? 'var(--green)' : divScore > 40 ? 'var(--yellow)' : 'var(--red)') + ';">' + divScore + '/100</b>';
      h += divScore > 60 ? ' — 양호한 분산. 개별 종목 리스크 상호 완충.' :
           divScore > 40 ? ' — 보통. 비상관 섹터 추가 시 개선 가능.' :
           ' — 높은 동조성. 같은 방향으로 동시 하락 위험.';
      h += '</span><br>';
    }

    // MDD 시나리오 (VIX 기반)
    h += '<br><b>【스트레스 테스트 시나리오】</b><br>';
    var scenarios = [
      { name: 'VIX 40 급등 시', factor: pfBeta * 0.12, color: 'var(--red)' },
      { name: '금리 +50bp 시', factor: (techCount > defCount ? 0.06 : 0.03), color: 'var(--yellow)' },
      { name: '유가 $150 시', factor: 0.05 + (techCount > positions.length * 0.5 ? 0.03 : 0), color: '#b13a30' }
    ];
    scenarios.forEach(function(sc) {
      var loss = stats.totalValue * sc.factor;
      h += '<span style="font-size:11px;color:' + sc.color + ';">' + sc.name + ': 예상 손실 약 <b>-' + (sc.factor * 100).toFixed(1) + '%</b> ($' + Math.round(loss).toLocaleString() + ')</span><br>';
    });

    // 손절 자동 판별
    var cutLossCandidates = positions.filter(function(p) {
      var d = ld[p.ticker]; if (!d) return false;
      var pnlPct = p.cost > 0 ? ((d.price - p.cost) / p.cost * 100) : 0;
      return pnlPct <= -7;
    });
    if (cutLossCandidates.length > 0) {
      h += '<br><span style="color:var(--red);font-weight:700;"> 손절 검토 대상 (' + cutLossCandidates.length + '개):</span><br>';
      cutLossCandidates.forEach(function(p) {
        var d = ld[p.ticker];
        var pnlPct = ((d.price - p.cost) / p.cost * 100);
        h += '<span style="font-size:11px;color:var(--red);">' + p.ticker + ': ' + pnlPct.toFixed(1) + '% (미너비니 -7~8% 손절 기준 초과)</span><br>';
      });
    }
  }

  el.innerHTML = h;
}


// ── 5) 심리지표 복합 분석 ──
// W01-B: retired — native ViewModel owns sent-analysis-text from one revision.

// ── 6) 옵션 환경 분석 ──
function _generateOptionsAnalysis(vix, vvix, vixPctile, ivRank) {
  var el = document.getElementById('opt-analysis-text'); if (!el) return;
  var lines = [];
  if (vix > 0) lines.push('VIX ' + vix.toFixed(1) + ' — S&P 500 옵션에서 산출한 향후 약 30일의 연율화 변동성 기대입니다. 개별 종목 IV가 아닙니다.');
  if (vvix > 0) lines.push('VVIX ' + vvix.toFixed(1) + ' — VIX 자체의 변동성 기대를 관찰합니다.');
  var evidence = window._vixIvRankEvidence;
  if (evidence && evidence.sampleCount >= 20 && Number.isFinite(ivRank)) {
    lines.push('수신 ' + evidence.sampleCount + '일 VIX 범위 내 위치 ' + ivRank + '% · 표본 백분위 ' + vixPctile + '%. 1년 IV Rank로 해석하지 않습니다.');
  }
  lines.push('옵션 체인·만기별 IV·미결제약정 근거가 없어 딜러 감마, CTA 주문 방향, 옵션 전략의 우열은 산출하지 않습니다.');
  el.textContent = lines.join(' ');
}

// ── 7) 펀더멘털 분석 ──
 var _generateFundamentalAnalysis = function(fallback, ld) {
  // P815: the bounded SEC-derived summary is now rendered by src/ui/pages/entity.js.
  // Keep this legacy compatibility entry point inert so the former aggregate report
  // cannot race the native fundamental surface.
  return;
  var el = null;
  if (!fallback || Object.keys(fallback).length === 0) { el.textContent = '기업 데이터 대기 중...'; return; }
  var h = '', items = [];
  for (var sym in fallback) {
    var fb = fallback[sym], d = ld[sym];
    var chg = d ? (d.pct != null ? d.pct : 0) : 0;
    items.push({ sym: sym, pe: fb.pe, roe: fb.roe, eps: fb.eps, epsGrowth: fb.epsGrowth, mcap: fb.mcap, sector: fb.sector, signal: fb.signal, chg: chg });
 };
  // PE 분포
  var pes = items.filter(function(i) { return i.pe > 0; });
  var avgPe = pes.length > 0 ? pes.reduce(function(s, i) { return s + i.pe; }, 0) / pes.length : 0;
  h += '<b>평균 P/E ' + avgPe.toFixed(1) + '</b> — ';
  h += avgPe > 35 ? '<span style="color:var(--red);">고평가 구간. 실적 성장률이 뒷받침되지 않으면 밸류에이션 조정 위험. PEG 비율 확인 필수.</span>' :
       avgPe > 22 ? '<span style="color:var(--yellow);">적정~다소 높음. 성장주 프리미엄 반영. 실적 서프라이즈 여부가 주가 방향 결정.</span>' :
       avgPe > 0 ? '<span style="color:var(--green);">합리적 밸류에이션. 실적 대비 저평가 종목 탐색 기회.</span>' : '';
  h += '<br>';
  // 최고 ROE
  var roes = items.filter(function(i) { return i.roe > 0; }).sort(function(a, b) { return b.roe - a.roe; });
  if (roes.length > 0) {
    h += '<b>최고 ROE:</b> ' + roes.slice(0, 3).map(function(r) { return r.sym + ' <b>' + r.roe + '%</b>'; }).join(', ');
    h += ' — 자본 수익성 우수. 장기 복리 효과 기대.<br>';
  }
  // 오늘 등락 상위/하위
  var sorted = items.slice().sort(function(a, b) { return b.chg - a.chg; });
  if (sorted.length > 2) {
    h += '<b>오늘 강세:</b> ' + sorted.slice(0, 2).map(function(r) { return r.sym + ' <span style="color:var(--green);">' + (r.chg >= 0 ? '+' : '') + r.chg.toFixed(1) + '%</span>'; }).join(', ') + ' · ';
    h += '<b>약세:</b> ' + sorted.slice(-2).map(function(r) { return r.sym + ' <span style="color:var(--red);">' + (r.chg >= 0 ? '+' : '') + r.chg.toFixed(1) + '%</span>'; }).join(', ') + '<br>';
  }

  // v38.5: PEG 비율 분석 — 올바른 공식: PEG = P/E ÷ EPS 성장률(%)
  // 이전 버그: i.pe / Math.max(i.eps, 1) → EPS 달러 금액으로 나눠 PEG가 아닌 무의미한 값 산출
  var pegValid = [], pegNoData = [];
  items.forEach(function(i) {
    if (i.pe <= 0) return; // 적자 기업 제외
    var growth = (i.epsGrowth != null) ? i.epsGrowth : null;
    if (growth != null && growth !== 0) {
      var peg = i.pe / growth;
      i._peg = peg;
      i._epsGrowth = growth;
      pegValid.push(i);
    } else {
      pegNoData.push(i);
    }
  });
  if (pegValid.length >= 1) {
    h += '<br><b>【PEG 비율 분석 (P/E ÷ EPS 성장률%)】</b><br>';
    var pegUnder = [], pegFair = [], pegOver = [], pegNeg = [];
    pegValid.forEach(function(i) {
      if (i._peg < 0) pegNeg.push(i);
      else if (i._peg < 1) pegUnder.push(i);
      else if (i._peg <= 2) pegFair.push(i);
      else pegOver.push(i);
    });
    if (pegUnder.length > 0) {
      h += '<span style="color:var(--green);">PEG &lt; 1 (성장 대비 저평가): ' + pegUnder.map(function(i) { return i.sym + ' <b>' + i._peg.toFixed(2) + '</b>'; }).join(', ') + '</span><br>';
    }
    if (pegFair.length > 0) {
      h += '<span style="color:var(--yellow);">PEG 1~2 (적정 범위): ' + pegFair.map(function(i) { return i.sym + ' <b>' + i._peg.toFixed(2) + '</b>'; }).join(', ') + '</span><br>';
    }
    if (pegOver.length > 0) {
      h += '<span style="color:var(--red);">PEG &gt; 2 (성장 대비 고평가): ' + pegOver.map(function(i) { return i.sym + ' <b>' + i._peg.toFixed(2) + '</b>'; }).join(', ') + ' — 실적 서프라이즈 없으면 밸류에이션 조정 위험</span><br>';
    }
    if (pegNeg.length > 0) {
      h += '<span style="color:var(--red);">PEG &lt; 0 (수익 감소 중): ' + pegNeg.map(function(i) { return i.sym + ' (EPS 성장률 ' + i._epsGrowth.toFixed(0) + '%)'; }).join(', ') + ' — 적자 전환 가능성 주의</span><br>';
    }
    if (pegNoData.length > 0) {
      h += '<span style="color:var(--text-muted);font-size:11px;">PEG 데이터 부족: ' + pegNoData.map(function(i) { return i.sym; }).join(', ') + '</span><br>';
    }
  }

  // v38.5: 밸류에이션 트랩 경고 (저PE + 하락추세 + 수익성 악화 조합)
  var valTraps = items.filter(function(i) {
    return i.pe > 0 && i.pe < 15 && i.chg < -1 && (i.roe < 5 || (i._epsGrowth != null && i._epsGrowth < 0));
  });
  if (valTraps.length > 0) {
    h += '<br><b>【밸류에이션 트랩 경고】</b> ';
    valTraps.forEach(function(i) {
      var reasons = [];
      reasons.push('PE ' + i.pe.toFixed(1));
      if (i.chg < -1) reasons.push('오늘 ' + i.chg.toFixed(1) + '%');
      if (i.roe < 5) reasons.push('ROE ' + i.roe + '%');
      if (i._epsGrowth != null && i._epsGrowth < 0) reasons.push('EPS 성장률 ' + i._epsGrowth.toFixed(0) + '%');
      h += '<span style="color:var(--red);">' + i.sym + ' (' + reasons.join(' · ') + ')</span> — 저PE가 저평가가 아닌 실적 악화 반영일 수 있음. ';
    });
    h += '<br>';
  }

  // v38.5: 성장-수익성 매트릭스 (Growth x Profitability)
  var matrixItems = items.filter(function(i) { return i.pe > 0 && i.roe != null && i._epsGrowth != null; });
  if (matrixItems.length >= 3) {
    var highGrowthHighMargin = [], highGrowthLowMargin = [], lowGrowthHighMargin = [], lowGrowthLowMargin = [];
    var growthThreshold = 20; // EPS 성장률 20% 기준
    var roeThreshold = 20;   // ROE 20% 기준
    matrixItems.forEach(function(i) {
      var hg = i._epsGrowth >= growthThreshold, hr = i.roe >= roeThreshold;
      if (hg && hr) highGrowthHighMargin.push(i);
      else if (hg && !hr) highGrowthLowMargin.push(i);
      else if (!hg && hr) lowGrowthHighMargin.push(i);
      else lowGrowthLowMargin.push(i);
    });
    h += '<br><b>【성장-수익성 매트릭스】</b><br>';
    if (highGrowthHighMargin.length > 0) {
      h += '<span style="color:var(--green);"> 고성장+고마진: ' + highGrowthHighMargin.map(function(i) { return i.sym + '(G:' + i._epsGrowth.toFixed(0) + '% R:' + i.roe + '%)'; }).join(', ') + '</span> — 최우선 관심 종목<br>';
    }
    if (highGrowthLowMargin.length > 0) {
      h += '<span style="color:var(--yellow);">고성장+저마진: ' + highGrowthLowMargin.map(function(i) { return i.sym + '(G:' + i._epsGrowth.toFixed(0) + '% R:' + i.roe + '%)'; }).join(', ') + '</span> — 수익성 개선 여부 주시<br>';
    }
    if (lowGrowthHighMargin.length > 0) {
      h += '<span style="color:var(--accent);">저성장+고마진: ' + lowGrowthHighMargin.map(function(i) { return i.sym + '(G:' + i._epsGrowth.toFixed(0) + '% R:' + i.roe + '%)'; }).join(', ') + '</span> — 캐시카우, 배당/자사주 매입 기대<br>';
    }
    if (lowGrowthLowMargin.length > 0) {
      h += '<span style="color:var(--text-muted);">저성장+저마진: ' + lowGrowthLowMargin.map(function(i) { return i.sym + '(G:' + i._epsGrowth.toFixed(0) + '% R:' + i.roe + '%)'; }).join(', ') + '</span> — 턴어라운드 촉매 필요<br>';
    }
  }

  // v38.5: 섹터별 밸류에이션 비교 (표준편차 기반 판단)
  var sectorData = {};
  items.forEach(function(i) {
    if (i.pe > 0 && i.sector) {
      if (!sectorData[i.sector]) sectorData[i.sector] = { pes: [], items: [] };
      sectorData[i.sector].pes.push(i.pe);
      sectorData[i.sector].items.push(i);
    }
  });
  var sectorStats = [];
  for (var s in sectorData) {
    var sd = sectorData[s];
    if (sd.pes.length >= 2) {
      var sAvg = sd.pes.reduce(function(a, b) { return a + b; }, 0) / sd.pes.length;
      var variance = sd.pes.reduce(function(a, b) { return a + (b - sAvg) * (b - sAvg); }, 0) / sd.pes.length;
      var stddev = Math.sqrt(variance);
      sectorStats.push({ name: s, avgPe: sAvg, stddev: stddev, items: sd.items });
    }
  }
  if (sectorStats.length >= 1) {
    h += '<br><b>【섹터별 밸류에이션 비교】</b><br>';
    sectorStats.sort(function(a, b) { return b.avgPe - a.avgPe; });
    sectorStats.forEach(function(ss) {
      h += '<b>' + ss.name + '</b>: 평균 PE ' + ss.avgPe.toFixed(1) + ' (표준편차 ' + ss.stddev.toFixed(1) + ') — ';
      // 섹터 평균 대비 극단값 종목 표시
      var outliers = ss.items.filter(function(i) { return Math.abs(i.pe - ss.avgPe) > ss.stddev * 1.2; });
      if (outliers.length > 0) {
        outliers.forEach(function(o) {
          var zScore = (o.pe - ss.avgPe) / (ss.stddev || 1);
          if (zScore > 1.2) {
            h += '<span style="color:var(--red);">' + o.sym + ' PE ' + o.pe.toFixed(0) + '(+' + zScore.toFixed(1) + 'σ)</span> ';
          } else if (zScore < -1.2) {
            h += '<span style="color:var(--green);">' + o.sym + ' PE ' + o.pe.toFixed(0) + '(' + zScore.toFixed(1) + 'σ)</span> ';
          }
        });
      } else {
        h += '<span style="color:var(--text-secondary);">종목 간 밸류에이션 균질</span>';
      }
      h += '<br>';
    });
    // 섹터 간 괴리 경고
    if (sectorStats.length >= 2) {
      var ratio = sectorStats[0].avgPe / sectorStats[sectorStats.length - 1].avgPe;
      if (ratio > 3) {
        h += '<span style="color:var(--accent);">섹터 간 밸류에이션 괴리 ' + ratio.toFixed(1) + '배 — 고PE 섹터 → 저PE 섹터 로테이션 가능성 주시.</span><br>';
      }
    }
  }

  // v38.5: 실적 vs 주가 괴리 프레임
  var earningsGap = items.filter(function(i) {
    return i.pe > 0 && i.roe > 0 && Math.abs(i.chg) > 2;
  });
  if (earningsGap.length > 0) {
    h += '<br><b>【실적 vs 주가 괴리 종목】</b> ';
    earningsGap.forEach(function(i) {
      if (i.chg < -2 && i.roe > 15) {
        h += i.sym + ': ROE ' + i.roe + '%(양호) but 오늘 ' + i.chg.toFixed(1) + '%(급락) — <span style="color:var(--accent);">실적과 주가 괴리. 센티먼트 과잉 반응 가능, 바닥 확인 후 매수 기회.</span> ';
      } else if (i.chg > 2 && i.pe > 40) {
        h += i.sym + ': PE ' + i.pe.toFixed(0) + '(고평가) + 오늘 +' + i.chg.toFixed(1) + '%(급등) — <span style="color:var(--yellow);">모멘텀 과열. 이익실현 검토.</span> ';
      }
    });
    h += '<br>';
  }

  // v40.4: 금리 환경 연동 밸류에이션 코멘트
  var tnxVal = _ldSafe('^TNX','price') || 0;
  if (tnxVal > 0 && pes.length > 0) {
    h += '<br><b>【금리 환경 연동 분석】</b> ';
    var avgEY = avgPe > 0 ? (100 / avgPe).toFixed(2) : 0; // Earnings Yield = 1/PE (%)
    h += '10Y 금리 <b>' + tnxVal.toFixed(2) + '%</b> | 평균 Earnings Yield(1/PE) <b>' + avgEY + '%</b> — ';
    if (parseFloat(avgEY) > tnxVal + 2) {
      h += '<span style="color:var(--green);">주식 매력도 우위 (EY가 10Y+2%p 초과). 밸류에이션 지지력 충분.</span>';
    } else if (parseFloat(avgEY) > tnxVal) {
      h += '<span style="color:var(--yellow);">주식-채권 매력도 접전 구간. 실적 성장이 프리미엄 정당화 필수.</span>';
    } else {
      h += '<span style="color:var(--red);">채권 대비 주식 매력도 열위 (EY < 10Y 금리). 고PE 종목 밸류에이션 압축 위험.</span>';
    }
    // 고PE+고금리 이중 위험 종목
    var dualRisk = items.filter(function(i) { return i.pe > 35 && tnxVal > 4.3; });
    if (dualRisk.length > 0) {
      h += '<br><span style="color:var(--red);font-size:11px;">고PE+고금리 이중 위험: ' + dualRisk.map(function(i) { return i.sym + '(PE ' + i.pe.toFixed(0) + ')'; }).join(', ') + ' — 금리 환경에서 밸류에이션 압축 가능성.</span>';
    }
    h += '<br>';
  }

  // v40.4: 트레이딩 스코어 연동 시장 환경 코멘트
  var tsVal = null;
  try { if (typeof computeTradingScore === 'function') { tsVal = computeTradingScore().score; } } catch(e) {}
  if (tsVal != null && isFinite(Number(tsVal))) {
    h += '<br><b>【시장 환경】</b> 트레이딩 스코어 <b style="color:' + (tsVal >= 55 ? 'var(--green)' : tsVal >= 35 ? 'var(--yellow)' : 'var(--red)') + ';">' + tsVal + '/100</b> — ';
    h += tsVal >= 75 ? '시장 환경 우수. 개별 종목 펀더멘털 강점이 주가에 반영되기 좋은 환경.' :
         tsVal >= 55 ? '시장 환경 양호. 실적 뒷받침되는 종목 선별적 접근.' :
         tsVal >= 35 ? '시장 환경 중립~약세. 시장 역풍에 개별 종목이 눌릴 수 있음. 방어적 포지션 우선.' :
         '시장 환경 약세. 펀더멘털과 무관하게 센티먼트로 하락 가능. 현금 비중 확대 고려.';
  } else h += '<br><b>【시장 환경】</b> 필수 입력 미수신으로 점수 산출 보류.';
  h += '<br>';

  void h;
 };

