// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-kr-data.js — P1134/R620: index.html 인라인 블록 C(3,473줄)에서 추출한 KR/SEC 데이터 플레인.
// KR 테마 카드·심층분석(filterKrThemes/initKoreaThemes/showKrThemeDetail/_buildKrThemeDeepAnalysis),
// VKOSPI 동적 수집(fetchVkospiDynamic; v58.76: 브라우저 이력과 개발자 전용 카드는 퇴역)
// (P1671: KR 수급·투자자 TOP10 수집은 표시 소비처가 없어 퇴역), KR_STOCK_DB/KR_THEME_MAP/_KR_SECTOR_MAP,
// SEC 공시·재무(fetchSECFilings/fetchSECFinancials/SEC_TICKER_CIK).
//
// 왜 새 파일인가: 이 블록을 aio-data.js에 접어넣으면 그 파일이 20k가 되어 index.html의 모놀리스를
// 데이터 파일로 옮기는 것에 그친다(R620(3) — 압력의 측면 이동). 렌더러가 아니라 수집·정규화 계층이라
// aio-ui.js/aio-pages.js와도 책임이 다르다.
// ═══════════════════════════════════════════════════════════════════════════════

// v53.7 (P725): the KR page chat chips left with their pages (no chat-kr-* chip container remains);
// evidence-first contexts are defined in js/aio-chat.js.
// v58.63 (architecture audit LEGACY02): the two filters only set inline display on the current cards, so a live-quote
// re-render brought every card back while the buttons still showed a selection, and the second filter overwrote the
// first. Both selections are state; one predicate (heat AND sector) runs after every card render.
var _krThemeFilter = { heat: 'all', sector: 'all' };
function _krApplyThemeFilter() {
  var allowed = _krThemeFilter.sector === 'all' ? null : _KR_SECTOR_MAP[_krThemeFilter.sector];
  document.querySelectorAll('#kr-theme-container .kr-theme-card').forEach(function(card) {
    var heatOk = _krThemeFilter.heat === 'all' || card.getAttribute('data-heat') === _krThemeFilter.heat;
    var sectorOk = !allowed || allowed.indexOf(card.getAttribute('data-theme-id')) >= 0;
    card.style.display = heatOk && sectorOk ? '' : 'none';
  });
}
function filterKrThemes(btn, heat) {
  var tabBar = btn.parentElement;
  if (tabBar) tabBar.querySelectorAll('.kr-tab').forEach(function(t){ t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); // v57.77 (a11y 4.1.2)
  _krThemeFilter.heat = heat || 'all';
  _krApplyThemeFilter();
}

// v57.77: the card badge, the filter key and the detail header name the weighted intraday move in plain bands.
// The ±1%/±3% cuts are display bands only (no back-tested basis), so the words describe the move, not a grade.
// data-heat keys stay (hot/warm/cool/cold) because the filter bar and the badge colours read them.
function _krThemeMoveBand(avg) {
  if (avg == null || !isFinite(avg)) return { heat: 'pending', label: '시세 미수신' };
  if (avg >= 3) return { heat: 'hot', label: '+3% 이상' };
  if (avg >= 1) return { heat: 'warm', label: '+1~3%' };
  if (avg > -1) return { heat: 'cool', label: '보합' };
  if (avg > -3) return { heat: 'cold', label: '-1~-3%' };
  return { heat: 'cold', label: '-3% 이하' };
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
  if (tabBar) tabBar.querySelectorAll('.kr-sector-tab').forEach(function(t){ t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); // v57.77 (a11y 4.1.2)
  _krThemeFilter.sector = sector || 'all';
  _krApplyThemeFilter();
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
  if (window._krDynamicLoaded) return;
  window._krDynamicLoaded = true;
  if (typeof fetchKrDynamicData === 'function') { try { fetchKrDynamicData(); } catch(_e) {} }
}
// v58.76: the developer-only KR macro/technical cards and their writers (initKoreaMacro/initKoreaTechnical) are retired.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-kr-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'themes') initKoreaThemes();
  if (e.detail === 'macro' || e.detail === 'technical') _aioEnsureKrDataLoaded();
});
_aioPageBus.register('html-kr-live', 'aio:liveQuotes', function() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var pid = activePage.id.replace('page-','');
  if (pid === 'themes') initKoreaThemes();
});
});

// v53.7 (P725): initKoreaSupply 퇴역 — kr-supply 페이지 삭제. P1671: 수급 fetch도 퇴역, 동적 fetch는 _aioEnsureKrDataLoaded()가 담당.

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
    if (d && d.price != null && isFinite(d.price)) { // v58.64 (A05 class): a null price threw in toFixed and stopped the render
      var priceEl = pill.querySelector('.pill-price');
      if (priceEl) { priceEl.textContent = d.price >= 1000 ? Math.round(d.price).toLocaleString() : d.price.toLocaleString(); }
      var pctEl = pill.querySelector('.pill-pct');
      if (pctEl && d.pct != null) {
        pctEl.textContent = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%';
        pctEl.style.color = d.pct >= 0 ? 'var(--green)' : 'var(--red)';
      }
      // 행 전체 배경 틴트
      var a = Math.min(Math.abs(d.pct != null ? d.pct : 0)*3,12)/100;
      pill.style.background = (d.pct>=0)?'rgba(34,117,76,'+a+')':'rgba(177,58,48,'+a+')';
      pill.style.borderColor = (d.pct>=0)?'var(--gold-6)':'var(--gold-6)';
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
        if (d && d.pct != null) { vSum += d.pct * t.w; wSum += t.w; }
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
        if (d && d.pct != null) pcts.push(d.pct);
      });
      if (pcts.length === 0) return;
      avg = pcts.reduce(function(a,b){return a+b;}, 0) / pcts.length;
    }

    // 일간 가중평균 등락 구간 (v57.77: 등급이 아니라 등락 폭 표기)
    var band = _krThemeMoveBand(avg), heat = band.heat, heatLabel = band.label;

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

  // 테마 메타데이터 (한글명, 아이콘 배경색 — v57.77: 영문 부제 제거)
  var META = {
    'defense':      {emoji:'',name:'K-방산 / 항공우주',bg:'rgba(181,69,72,0.12)'},
    'semi':         {emoji:'',name:'반도체 / HBM',bg:'rgba(var(--ink-rgb),0.12)'},
    'shipbuilding': {emoji:'',name:'조선 / 해양',bg:'rgba(var(--ink-rgb),0.12)'},
    'ai-sw':        {emoji:'',name:'AI / 소프트웨어',bg:'rgba(var(--ink-rgb),0.12)'},
    'power-grid':   {emoji:'',name:'전력기기 / 변압기',bg:'rgba(var(--ink-rgb),0.12)'},
    'nuclear':      {emoji:'',name:'원전 / SMR',bg:'rgba(47,124,87,0.12)'},
    'battery':      {emoji:'',name:'2차전지 / 배터리',bg:'rgba(var(--ink-rgb),0.12)'},
    'bio':          {emoji:'',name:'바이오 / 제약',bg:'rgba(47,124,87,0.12)'},
    'kbeauty':      {emoji:'',name:'K-뷰티 / 화장품',bg:'rgba(var(--ink-rgb),0.12)'},
    'kcontent':     {emoji:'',name:'K-콘텐츠 / 엔터',bg:'rgba(var(--ink-rgb),0.12)'},
    'auto':         {emoji:'',name:'자동차 / EV',bg:'rgba(var(--ink-rgb),0.12)'},
    'robot':        {emoji:'',name:'로봇 / 자동화',bg:'rgba(var(--ink-rgb),0.12)'},
    'finance':      {emoji:'',name:'금융',bg:'rgba(var(--ink-rgb),0.12)'},
    'kfood':        {emoji:'',name:'K-푸드 / 식품',bg:'rgba(var(--ink-rgb),0.12)'},
    'crypto':       {emoji:'',name:'크립토 / 블록체인',bg:'rgba(var(--ink-rgb),0.12)'},
    'telecom':      {emoji:'',name:'통신',bg:'rgba(var(--ink-rgb),0.12)'},
    'construction': {emoji:'',name:'건설 / 인프라',bg:'rgba(var(--ink-rgb),0.12)'},
    'retail':       {emoji:'',name:'유통 / 리테일',bg:'rgba(var(--ink-rgb),0.12)'},
    'steel_chem':   {emoji:'',name:'철강 / 화학 / 소재',bg:'rgba(var(--ink-rgb),0.12)'},
    'logistics':    {emoji:'',name:'물류 / 운송 / 항공',bg:'rgba(var(--ink-rgb),0.12)'},
  'medtech_kr':   {emoji:'',name:'의료기기 / 디지털헬스',bg:'rgba(var(--ink-rgb),0.12)'},
    'energy_kr':    {emoji:'',name:'에너지 / 정유',bg:'rgba(47,124,87,0.12)'},
    'photonics_kr': {emoji:'',name:'광통신 / 포토닉스',bg:'rgba(var(--ink-rgb),0.12)'},
    'wind_solar':   {emoji:'',name:'풍력 / 태양광 / 신재생',bg:'rgba(47,124,87,0.12)'},
    'quantum':      {emoji:'',name:'양자컴퓨팅 / 양자암호',bg:'rgba(var(--ink-rgb),0.12)'},
    'uam':          {emoji:'',name:'UAM / 도심항공',bg:'rgba(var(--ink-rgb),0.12)'},
    'hydrogen':     {emoji:'',name:'수소에너지',bg:'rgba(var(--ink-rgb),0.12)'},
    'space':        {emoji:'',name:'우주항공 / 위성',bg:'rgba(181,69,72,0.12)'}
  };

  // 테마 순서 (사용자에게 보이는 순서)
  var ORDER = ['defense','semi','shipbuilding','ai-sw','power-grid','nuclear','battery','bio','kbeauty','kcontent','auto','robot','finance','kfood','crypto','telecom','construction','retail','steel_chem','logistics','medtech_kr','energy_kr','photonics_kr','wind_solar','quantum','uam','hydrogen','space'];

  var html = '';
  ORDER.forEach(function(tid) {
    var tmap = KR_THEME_MAP[tid];
    if (!tmap) return;
    var meta = META[tid] || {emoji:'',name:tid,bg:'rgba(var(--ink-rgb),0.12)'};
    var catalyst = _krCatalystReferenceText((typeof KR_THEME_CATALYSTS !== 'undefined' && KR_THEME_CATALYSTS[tid]) || '');

    // 종목별 가중평균 수익률 계산 + heat 판별
    var ws = 0, vs = 0;
    tmap.forEach(function(s) {
      var sym = krTickerToYahoo(s.code);
      var d = ld[sym];
      if (d && d.pct != null && s.w > 0) { vs += d.pct * s.w; ws += s.w; }
    });
    var avg = quoteCoverage.validThemeIds.indexOf(tid) >= 0 && ws > 0 ? vs / ws : null;
    var band = _krThemeMoveBand(avg), heat = band.heat, heatLabel = band.label;

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
      var barC = d && d.pct != null ? (d.pct >= 0 ? 'rgba(47,124,87,0.12)' : 'rgba(181,69,72,0.1)') : 'transparent';
      var pillHtml = '<span class="kr-ticker-pill" data-live-symbol="' + sym + '" style="--bar-w:' + s.w + '%;--bar-c:' + barC + ';cursor:pointer;" data-action="showTicker" data-arg="' + sym + '" data-stop="1" title="' + (info.name||s.code) + ' ↗">' +
        '<span class="pill-code">' + s.code + '</span> ' +
        '<span class="pill-name">' + name + '</span> ' +
        '<span class="pill-wt">' + (s.wLabel || (Math.round(s.w * 10) / 10) + '%') + '</span> ' +
        '<span class="pill-price" data-live-price="' + sym + '">' + priceStr + '</span> ' +
        '<span class="pill-pct" data-live-chg="' + sym + '" style="color:' + pctColor + ';">' + pctStr + '</span>' +
        '</span>';
      if (stockIdx < 5) pillsHtml += pillHtml;
      else extraPillsHtml += pillHtml;
    });

    if (extraPillsHtml) {
      pillsHtml += '<details class="kr-theme-card-more" data-stop="1"><summary>' + (sorted.length - 5) + '개 구성 종목 더 보기</summary><div class="kr-theme-tickers krl-more-list">' + extraPillsHtml + '</div></details>';
    }
    var catalystLead = catalyst.length > 260 ? catalyst.slice(0, 260).replace(/\s+\S*$/, '') + '…' : catalyst;
    var catalystHtml = catalyst ? '<div class="kr-theme-catalyst">' + escHtml(catalystLead) + '</div>' +
      (catalyst.length > catalystLead.length ? '<details class="kr-theme-card-more kr-theme-memo-more" data-stop="1"><summary>근거 메모 전체 보기</summary><div class="kr-theme-memo-full">' + escHtml(catalyst) + '</div></details>' : '') : '';

    // 카드 HTML 조립
    html += '<div class="kr-theme-card" data-heat="' + heat + '" data-theme-id="' + tid + '">' +
      '<div class="kr-theme-header" role="button" tabindex="0" aria-label="' + escHtml(String(meta.name || tid) + ', ' + heatLabel + ' — 테마 자세히 보기') + '">' +
        '<span class="kr-theme-icon" style="background:' + meta.bg + ';"></span>' +
        '<div><div class="kr-theme-name">' + meta.name + '</div></div>' +
        '<span class="kr-theme-heat heat-' + heat + '">' + heatLabel + '</span>' +
      '</div>' +
      '<div class="kr-theme-tickers">' + pillsHtml + '</div>' +
      '<div class="kr-theme-stat" data-theme-stat="' + tid + '">' +
        (avg == null ? '<span><b class="krl-muted">시세 미수신, 구성 비중만 표시</b></span>' : '<span>일간 수익률 <b style="color:' + (avg >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' + (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%</b></span>') +
      '</div>' +
      catalystHtml +
    '</div>';
  });

  // v58.63 (LEGACY02): the re-render replaces every card; the focused control inside a card is found again by its theme
  // and role after the swap, and the reader's filter selection is re-applied.
  var focusedEl = document.activeElement && container.contains(document.activeElement) ? document.activeElement : null;
  var focusedCard = focusedEl && focusedEl.closest ? focusedEl.closest('[data-theme-id]') : null;
  var focusKey = focusedCard ? { id: focusedCard.getAttribute('data-theme-id'), self: focusedEl === focusedCard, cls: focusedEl.className, tag: focusedEl.tagName } : null;
  container.innerHTML = html;
  _krApplyThemeFilter();
  if (focusKey) {
    var newCard = container.querySelector('[data-theme-id="' + String(focusKey.id).replace(/"/g, '') + '"]');
    var target = newCard && (focusKey.self ? newCard : Array.prototype.find.call(newCard.querySelectorAll(focusKey.tag), function(node) { return node.className === focusKey.cls; }));
    if (target && typeof target.focus === 'function') target.focus();
  }
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
    var header = card.querySelector('.kr-theme-header'); // v57.61 WCAG 2.1.1: the header (no nested controls) is the keyboard entry
    if (header) header.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof showKrThemeDetail === 'function') showKrThemeDetail(themeId); } });
  });
}

function renderKrThemePerfBars(ld) {
  refreshKrThemeRuntimeWeights();
  var c = document.getElementById('kr-theme-perf-bars'); if (!c||!ld||Object.keys(ld).length<5) return;
  var N={};Object.keys(window.AIO_KR_THEME_LABELS||{}).forEach(function(k){N[k]=window.AIO_KR_THEME_LABELS[k].split(' / ')[0];}); // P1327: one label owner
  var res=[];for(var tid in KR_THEME_MAP){var t=KR_THEME_MAP[tid],ws=0,vs=0;t.forEach(function(s){var d=ld[krTickerToYahoo(s.code)];if(d&&d.pct != null&&s.w>0){vs+=d.pct*s.w;ws+=s.w;}});if(ws>0)res.push({id:tid,name:N[tid]||tid,perf:vs/ws});}
  if(!res.length)return;res.sort(function(a,b){return b.perf-a.perf;});var mx=Math.max.apply(null,res.map(function(r){return Math.abs(r.perf);}));if(mx<0.01)mx=1;
  var h='';res.forEach(function(r,i){var p=r.perf>=0,bw=Math.min(Math.abs(r.perf)/mx*100,100),cl=p?'var(--data-green)':'var(--data-red)',rk=i<3?'<b style="color:'+cl+';">'+(i+1)+'</b> ':'';
    h+='<div class="krl-pb-row'+(i%2===0?' is-alt':'')+'" data-action="showKrThemeDetail" data-arg="'+escHtml(r.id)+'"><div class="krl-pb-name">'+rk+r.name+'</div><div class="krl-pb-track">'+(p?'<div class="krl-pb-fill is-pos" style="width:'+(bw/2)+'%;background:'+cl+';"></div>':'<div class="krl-pb-fill is-neg" style="width:'+(bw/2)+'%;background:'+cl+';"></div>')+'<div class="krl-pb-mid"></div></div><div class="krl-pb-val" style="color:'+cl+';">'+(p?'+':'')+r.perf.toFixed(2)+'%</div></div>';});
  c.innerHTML=h;var ts=document.getElementById('kr-theme-rank-ts');if(ts)ts.textContent=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' 갱신';
}
function showKrThemeDetail(themeId) {
  refreshKrThemeRuntimeWeights();
  var panel=document.getElementById('kr-theme-detail-panel'),content=document.getElementById('kr-theme-detail-content');
  if(!panel||!content)return;var tmap=KR_THEME_MAP[themeId];if(!tmap)return;var ld=window._liveData||{};
  var CN=window.AIO_KR_THEME_LABELS||{}; // P1327: one label owner (src/domain/themes/kr-themes.js)
  var cat=_krCatalystReferenceText(KR_THEME_CATALYSTS[themeId]||'');
  // 테마 통계 계산
  // v58.63 (architecture audit A05): a stock without a received change (pct null/undefined) used to count as +0.00%, so a
  // theme with no quotes read "+0.00% · 상승 비율 0%" and the deep read diagnosed "하락 0개 > 상승 0개". A missing quote is
  // missing: it is left out of every count, the averages show "—" and the diagnosis waits.
  var hasPct=function(d){return !!d&&d.pct!=null&&isFinite(Number(d.pct));};
  var ws=0,vs=0,upCnt=0,dnCnt=0,topStock=null,topPct=-999,botStock=null,botPct=999;
  tmap.forEach(function(t){
    var info=KR_STOCK_DB[t.code]||{},sym=krTickerToYahoo(t.code),d=ld[sym];
    if(!hasPct(d))return;
    var p=Number(d.pct);
    if(t.w>0){vs+=p*t.w;ws+=t.w;}
    if(p>=0)upCnt++;else dnCnt++;
    if(p>topPct){topPct=p;topStock=info.name||t.code;}if(p<botPct){botPct=p;botStock=info.name||t.code;}
  });
  var avg=ws>0?vs/ws:null,ip=avg!=null&&avg>=0,cc=avg==null?'var(--text-muted)':ip?'var(--data-green)':'var(--data-red)';
  var avgText=avg==null?'—':(ip?'+':'')+avg.toFixed(2)+'%';
  var totalStocks=tmap.length,quoted=upCnt+dnCnt,upRatio=quoted>0?Math.round(upCnt/quoted*100):null;

  // v57.77: 등락 구간 표기 (카드와 같은 구간, 등급 아님)
  var strength=ws>0?_krThemeMoveBand(avg).label:'시세 미수신',strengthCol=ws>0&&avg>=1?'var(--data-green)':ws>0&&avg<=-1?'var(--data-red)':'var(--text-muted)';

  // 종목 테이블 (등락률 순 정렬)
  var sorted=tmap.slice().sort(function(a,b){var da=ld[krTickerToYahoo(a.code)],db=ld[krTickerToYahoo(b.code)],ha=hasPct(da),hb=hasPct(db);if(ha!==hb)return ha?-1:1;return ha?Number(db.pct)-Number(da.pct):0;});
  var rows='';sorted.forEach(function(t,idx){
    var info=KR_STOCK_DB[t.code]||{},sym=krTickerToYahoo(t.code),d=ld[sym];
    var price=d&&d.price!=null&&isFinite(Number(d.price))?Number(d.price):null,pct=d&&d.pct!=null?d.pct:null,pCol=pct!==null?(pct>=0?'var(--data-green)':'var(--data-red)'):'var(--text-muted)';
    var ps=price==null?'—':price>=1000?Math.round(price).toLocaleString()+'원':price+'원';
    var pcs=pct!==null?((pct>=0?'+':'')+pct.toFixed(2)+'%'):'—';
    var lt=d?'<span class="krl-live is-on">● 수신</span>':'<span class="krl-live">○</span>';
    var rankIcon=idx===0?' ':idx===1?' ':idx===2?' ':'';
    rows+='<tr class="krl-d-row'+(idx%2===0?' is-alt':'')+'"><td class="krl-d-c is-name" data-action="showTicker" data-arg="'+sym+'" title="'+(info.name||t.code)+' 분석 →">'+rankIcon+'<span class="krl-accent">'+(info.name||t.code)+'</span> <span class="krl-d-go">↗</span><div class="krl-d-meta">'+(info.sector||'')+', '+t.code+'</div></td><td class="krl-d-c is-fig">'+ps+'</td><td class="krl-d-c is-fig is-heavy" style="color:'+pCol+';">'+pcs+'</td><td class="krl-d-c is-ctr is-xs is-muted">'+(info.mcap||'—')+'</td><td class="krl-d-c is-ctr is-xs">'+(t.wLabel||(Math.round(t.w*10)/10)+'%')+'</td><td class="krl-d-c is-ctr">'+lt+'</td></tr>';
  });

  var tn=(CN[themeId]||themeId).replace(/[^가-힣a-zA-Z0-9\/\s]/g,'').trim();

  content.innerHTML=
    // 헤더: 테마명 + 수익률 + 강도
    '<div class="krl-d-head">'+
      '<div><div class="krl-d-title">'+escHtml(CN[themeId]||themeId)+'</div>'+
        '<div class="krl-d-sub">구성종목 '+totalStocks+'개, 상승 '+upCnt+', 하락 '+dnCnt+(quoted<totalStocks?', 시세 미수신 '+(totalStocks-quoted):'')+'</div></div>'+
      '<div class="krl-d-end">'+
        '<div class="krl-d-avg" style="color:'+cc+';">'+avgText+'</div>'+
        '<div class="krl-d-band" style="color:'+strengthCol+';">'+strength+'</div></div></div>'+

    // 요약 카드 4개
    '<div class="krl-d-stats">'+
      '<div class="krl-d-stat">'+
        '<div class="krl-d-stat-l">상승 비율</div>'+
        '<div class="krl-d-stat-v" style="color:'+(upRatio==null?'var(--text-muted)':upRatio>=60?'var(--data-green)':upRatio<=40?'var(--data-red)':'var(--text-muted)')+';">'+(upRatio==null?'—':upRatio+'%')+'</div></div>'+
      '<div class="krl-d-stat">'+
        '<div class="krl-d-stat-l">최고 종목</div>'+
        '<div class="krl-d-stat-name is-up">'+escHtml(topStock||'—')+'</div><div class="krl-d-stat-pct is-up">'+(topStock?(topPct>=0?'+':'')+topPct.toFixed(2)+'%':'—')+'</div></div>'+
      '<div class="krl-d-stat">'+
        '<div class="krl-d-stat-l">최저 종목</div>'+
        '<div class="krl-d-stat-name is-down">'+escHtml(botStock||'—')+'</div><div class="krl-d-stat-pct is-down">'+(botStock?(botPct>=0?'+':'')+botPct.toFixed(2)+'%':'—')+'</div></div>'+
      '<div class="krl-d-stat">'+
        '<div class="krl-d-stat-l">가중평균</div>'+
        '<div class="krl-d-stat-v is-fig" style="color:'+cc+';">'+avgText+'</div></div>'+
    '</div>'+

    // 촉매
    (cat?'<div class="krl-d-cat">'+
      '<div class="krl-d-cat-l">촉매 / 핵심 이슈</div>'+
      '<div class="krl-d-cat-t">'+escHtml(cat)+'</div></div>':'')+

    // 종목 테이블
    '<div style="overflow-x:auto;border:0.5px solid rgba(var(--ink-rgb),0.06);border-radius:4px;">'+
      '<table class="krl-d-tbl">'+
        '<thead><tr class="krl-d-hrow">'+
          '<th class="krl-d-th is-l">종목</th>'+
          '<th class="krl-d-th is-r">현재가</th>'+
          '<th class="krl-d-th is-r">등락률</th>'+
          '<th class="krl-d-th is-ctr">시총</th>'+
          '<th class="krl-d-th is-ctr">비중</th>'+
          '<th class="krl-d-th is-ctr">소스</th>'+
        '</tr></thead><tbody>'+rows+'</tbody></table></div>'+

    // 심층 분석 섹션
    _buildKrThemeDeepAnalysis(themeId, avg, upCnt, dnCnt, totalStocks, topStock, topPct, botStock, botPct, sorted, ld, tmap) +

    // AI 분석 버튼
    '<div class="krl-d-ask">'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 심층 분석: 현재 모멘텀, 수급, 밸류에이션, 리스크 종합 판단해줘" class="aio-btn-table krl-d-ask-btn">AI 심층 분석</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 외국인·기관 수급 흐름과 향후 전망 분석해줘" class="aio-btn-table krl-d-ask-btn">수급 분석</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 대장주와 후발주 비교 분석하고 확인할 지표와 무효화 조건 알려줘" class="aio-btn-table krl-d-ask-btn">확인 지표</button>'+
      '<button data-action="chatFromChip" data-arg="themes" data-arg2="'+escHtml(tn)+' 테마 리스크 요인과 주의할 점 분석해줘" class="aio-btn-table krl-d-ask-btn">리스크</button>'+
    '</div>';

  panel.style.display='block';panel.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══ 한국 테마 심층 분석 생성 ═══
function _buildKrThemeDeepAnalysis(themeId, avg, upCnt, dnCnt, total, topStock, topPct, botStock, botPct, sorted, ld, tmap) {
  var h = '<div class="krl-deep">';
  h += '<div class="krl-deep-t">심층 분석</div>';
  // v58.63 (A05): no received change, no diagnosis.
  if (avg == null || upCnt + dnCnt === 0) return h + '<div class="krl-deep-p">구성 종목 시세를 아직 받지 못해 테마 진단을 보류합니다. 시세가 들어오면 다시 계산합니다.</div></div>';
  var ss = [];

  // 1) 테마 온도 진단
  if (avg >= 3) ss.push('<b>매우 강세</b> — 시장에서 가장 뜨거운 테마 중 하나입니다. 외국인·기관 동반 매수가 집중될 수 있으나, 단기 과열에 따른 차익실현 압력도 경계가 필요합니다.');
  else if (avg >= 1) ss.push('<b>강세</b> — 모멘텀이 살아있는 테마입니다. 실적 발표·정책·수주 같은 펀더멘털 촉매가 있는지 공시와 뉴스로 확인할 구간입니다.');
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
  if (upRatio >= 70) ss.push(' <b>테마 건강도 우수</b> — 구성종목 중 ' + upRatio + '%가 상승. 오름세가 대장주에 그치지 않고 테마 전체로 퍼져 있습니다. 하루 비율이라 추세 지속을 뜻하지는 않습니다.');
  else if (upRatio >= 50) ss.push(' <b>테마 건강도 보통</b> — 상승 ' + upCnt + '개 vs 하락 ' + dnCnt + '개. 대장주 위주로만 오르고 있다면 폭이 좁은 랠리로, 후발주 확산 여부를 모니터링해야 합니다.');
  else ss.push('<b>테마 건강도 취약</b> — 하락 종목(' + dnCnt + '개)이 상승 종목(' + upCnt + '개)보다 많습니다. 테마 모멘텀이 꺾이는 신호일 수 있어 추격 진입의 위험이 커집니다.');

  // 4) 대장주 vs 후발주 분석 — v38.3: 6종목 미만 테마에서 top3/bot3 겹침 버그 수정
  if (sorted.length >= 6) {
    var top3Avg = 0, bot3Avg = 0, top3Cnt = 0, bot3Cnt = 0;
    for (var ti = 0; ti < 3; ti++) {
      var td = ld[krTickerToYahoo(sorted[ti].code)];
      if (td && td.pct != null) { top3Avg += td.pct; top3Cnt++; }
    }
    for (var bi = sorted.length - 3; bi < sorted.length; bi++) {
      var bd = ld[krTickerToYahoo(sorted[bi].code)];
      if (bd && bd.pct != null) { bot3Avg += bd.pct; bot3Cnt++; }
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
  var kti = (typeof KR_THEME_INSIGHTS !== 'undefined' && KR_THEME_INSIGHTS) ? KR_THEME_INSIGHTS[themeId] : null; // P1315: optional global — bare read threw and aborted every KR theme detail
  if (kti) {
    ss.push('');
    ss.push(' <b>테마 인사이트</b>');
    if (kti.macro) ss.push('<b>거시 조건:</b> ' + kti.macro);
    if (kti.foreignFlow) ss.push(' <b>외국인 수급:</b> ' + kti.foreignFlow);
    if (kti.linkedUS) ss.push(' <b>미국 연동:</b> ' + kti.linkedUS);
    if (kti.breakSignals && kti.breakSignals.length) {
      ss.push('<b>깨지는 신호:</b> ' + kti.breakSignals.map(function(s,i){return (i+1)+') '+s;}).join(', '));
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
    var _krStaleBadge = ' <span class="krl-stale' + (_knIsStale ? ' is-stale' : '') + '">' + (_knIsStale ? 'STALE ' : '') + (KR_THEME_NARRATIVES_META && KR_THEME_NARRATIVES_META.lastUpdated || 'N/A') + ', 경과 ' + _knStaleDays + '일</span>';

    ss.push('');
    ss.push(' <b>테마 스토리, 밸류체인 (기관 리서치 톤)</b>' + _krStaleBadge);
    if (_knIsStale) {
      ss.push('<span class="krl-stale-note">narrative 작성일부터 ' + _knStaleDays + '일 경과 — 구체 수치는 AI 채팅/웹검색으로 crosscheck 권장</span>');
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
            return '&nbsp;&nbsp;<span class="krl-cyan">[' + dtStr + ']</span> ' + (n.title || '').substring(0, 140) + (n.source ? ' <span class="krl-note">(' + n.source + ')</span>' : '');
          }).join('<br>');
          ss.push('<b>최근 7일 뉴스 (최근 수집, ' + krRecentNews.length + '건):</b><br>' + krNewsHtml);
        }
      }
    }
  }

  h += ss.map(function(s) {
    if (!s) return '<hr class="krl-deep-hr">';
    return '<div class="krl-deep-p">' + s + '</div>';
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

// ══════════════════════════════════════════════════════════════════
// v35.7: 한국 시장 동적 데이터 fetch 모듈
// VKOSPI · 거래대금 · 외국인 TOP · 주간 수급 · 공매도 (네이버 API + 프록시 체인)
// ══════════════════════════════════════════════════════════════════

// v58.76: the browser-side VKOSPI history (aio_vkospi_hist_v1) fed only the retired developer-only chart.
var AIO_VKOSPI_FAIL_THRESHOLD = 3;
var _vkospiFailCount = 0;
var _vkospiLastOkTs = null;
function _vkospiIsFailedState() { return _vkospiFailCount >= AIO_VKOSPI_FAIL_THRESHOLD; }
function _showVkospiFailureState(reason) {
  // P1142: 실패 상태 진입 시 라이브 플래그를 해제한다 — 성공 시 켜진 _vkospiLiveOk가
  // 실패 후에도 true로 남아 배너/채팅이 정지된 스냅샷 값을 현재값처럼 인용하는 것을 방지(P713 계약 유지).
  window._vkospiLiveOk = false;
  var lastOkText = _vkospiLastOkTs ? ('마지막 성공 ' + new Date(_vkospiLastOkTs).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })) : '성공 이력 없음';
  var fullReason = (reason || '프록시/데이터 실패') + ', ' + lastOkText;
  window._vkospiFailureReason = fullReason; // v58.76: the developer-only VKOSPI cards that showed it are retired
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
    // M11 (v57.48): the 15/20/25/35 colour bands and 정상/경계/공포 labels had no published basis — value and date only.
    var vDay = String(d.localTradedAt || d.tradedAt || '').slice(0, 10), vText = val.toFixed(2) + (/^\d{4}-\d{2}-\d{2}$/.test(vDay) ? ' (' + Number(vDay.slice(5, 7)) + '/' + Number(vDay.slice(8, 10)) + ')' : '');
    window._vkospiLastText = vText;
    // DATA_SNAPSHOT 동기화 — live 성공 플래그(P713): 배너/채팅 컨텍스트는 이 플래그가
    // true일 때만 vkospi를 현재값으로 사용한다(시드 16.00이 라벨 없이 노출되는 것 방지).
    if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT.vkospi = val;
    window._vkospiLiveOk = true;
    console.log('[KR] VKOSPI 동적 업데이트:', val);
  } catch(e) {
    _vkospiFailCount++;
    if (_vkospiIsFailedState()) _showVkospiFailureState('fetch 예외: ' + e.message);
    _aioLog('warn', 'fetch', 'KR VKOSPI fetch 실패: ' + e.message);
  }
}

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
  '131970': {name:'두산테스나', sector:'반도체테스트', themes:['semi']}, // 2026-10-13: KIND/KOSDAQ150 PDF name; was mislabelled 테크윙
  '089030': {name:'테크윙', sector:'반도체장비', themes:['semi']},
  '005290': {name:'동진쎄미켐', sector:'반도체소재', themes:['semi']},
  '007660': {name:'이수페타시스', sector:'서버용PCB', themes:['semi']},
  '095340': {name:'ISC', sector:'반도체테스트', themes:['semi']},
  // ════════ 방산 (7) ════════
  '012450': {name:'한화에어로스페이스', sector:'방산', themes:['defense']},
  '047810': {name:'한국항공우주(KAI)', sector:'방산', themes:['defense']},
  '079550': {name:'LIG디펜스앤에어로스페이스', sector:'방산', themes:['defense']},
  '064350': {name:'현대로템', sector:'방산', themes:['defense']},
  '272210': {name:'한화시스템', sector:'방산IT', themes:['defense']},
  '000880': {name:'한화', sector:'방산지주', themes:['defense']},
  '103140': {name:'풍산', sector:'탄약', themes:['defense']},
  // ════════ 조선 (8) ════════
  '329180': {name:'HD현대중공업', sector:'조선', themes:['shipbuilding']},
  '042660': {name:'한화오션', sector:'조선', themes:['shipbuilding']},
  '010140': {name:'삼성중공업', sector:'조선', themes:['shipbuilding']},
  '267250': {name:'HD현대', sector:'조선지주', themes:['shipbuilding']},
  '009540': {name:'HD한국조선해양', sector:'조선지주', themes:['shipbuilding']},
  '082740': {name:'한화엔진', sector:'엔진', themes:['shipbuilding']},
  '011200': {name:'HMM', sector:'해운', themes:['logistics']},
  '071970': {name:'HD현대마린엔진', sector:'선박엔진', themes:['shipbuilding']},
  // ════════ AI / 소프트웨어 (7) ════════
  '035420': {name:'NAVER', sector:'IT플랫폼', themes:['ai-sw','telecom']},
  '035720': {name:'카카오', sector:'IT플랫폼', themes:['ai-sw','crypto']},
  '041020': {name:'폴라리스오피스', sector:'SW', themes:['ai-sw']},
  '030520': {name:'한컴', sector:'SW', themes:['ai-sw']},
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
  '315640': {name:'딥노이드', sector:'의료AI', themes:[]}, // 2026-10-13: KIND name for 315640 (뉴로메카 is 348340, not in the universe)
  '178320': {name:'서진시스템', sector:'통신장비/ESS', themes:['telecom','wind_solar']},
  '454910': {name:'두산로보틱스', sector:'협동로봇', themes:['robot']},
  '056080': {name:'유진로봇', sector:'서비스로봇', themes:['robot']},
  '108320': {name:'LX세미콘', sector:'팹리스', themes:['semi']},
  // ════════ 금융 (7) ════════
  '105560': {name:'KB금융', sector:'금융', themes:['finance']}, '006800': {name:'미래에셋증권', sector:'증권', themes:['finance']}, '016360': {name:'삼성증권', sector:'증권', themes:['finance']},
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
  '294870': {name:'IPARK현대산업개발', sector:'건설', themes:['construction']},
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
  '036570': {name:'NC', sector:'게임', themes:['kcontent']},
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
  '000250': {name:'삼천당제약', sector:'GLP-1 제약', themes:['medtech_kr']}, // 2026-10-13: was keyed 047820 (초록뱀미디어 in KIND)
  '018670': {name:'SK가스', sector:'에너지', themes:['energy_kr']},
  // ════════ v41.9 신규: 신재생/양자/UAM/수소/우주 테마 종목 ════════
  '112610': {name:'씨에스윈드', sector:'풍력타워', themes:['wind_solar']},
  '336260': {name:'두산퓨얼셀', sector:'연료전지', themes:['wind_solar','hydrogen']},
  '017390': {name:'서울도시가스', sector:'가스유틸리티', themes:['wind_solar','hydrogen']},
  '003830': {name:'대한화섬', sector:'신재생', themes:['wind_solar']},
  '050890': {name:'쏠리드', sector:'광중계기', themes:['photonics_kr','quantum']},
  '032500': {name:'케이엠더블유', sector:'통신장비', themes:['photonics_kr','quantum']},
  '218410': {name:'RFHIC', sector:'RF반도체', themes:['photonics_kr','quantum']},
  '138080': {name:'오이솔루션', sector:'광모듈', themes:['photonics_kr']},
  // v46.10: KR_THEME_MAP 누락 종목 보충 (8건)
  '007310': {name:'오뚜기', sector:'식품', themes:['kfood']},
  '018290': {name:'브이티', sector:'뷰티', themes:['kbeauty']},
  '950130': {name:'엑세스바이오', sector:'진단키트', themes:['bio']}, // 2026-10-13: KIND name for 950130 (was mislabelled 엑시큐어)
  '439090': {name:'마녀공장', sector:'뷰티', themes:['kbeauty']},
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
    {code:'079550'}, // LIG디펜스앤에어로스페이스 (미사일/정밀유도)
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
    {code:'131970'},  // 두산테스나 (웨이퍼 테스트 외주)
    {code:'089030'},  // 테크윙 (테스트핸들러)
    {code:'000990'},  // DB하이텍 (파운드리)
    {code:'005290'},  // 동진쎄미켐 (포토레지스트)
    {code:'402340'}   // SK스퀘어 (SK하이닉스 지주)
  ],
  'shipbuilding': [
    {code:'329180'}, // HD현대중공업 (조선 시총 1위)
    {code:'042660'}, // 한화오션 (잠수함+특수선)
    {code:'009540'}, // HD한국조선해양 (지주)
    {code:'010140'}, // 삼성중공업 (LNG선)
    {code:'267250'},  // HD현대 (지주)
    {code:'082740'},  // 한화엔진 (엔진 독과점)
    {code:'071970'}   // HD현대마린엔진
  ],
  'ai-sw': [
    {code:'035420'}, // NAVER (HyperCLOVA X, AI 대장)
    {code:'018260'}, // 삼성SDS (AI ERP/Brity)
    {code:'035720'}, // 카카오 (카나나/AI)
    {code:'030520'},  // 한컴 (한컴AI)
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
    {code:'086790'}, // 하나금융
    {code:'316140'}, // 우리금융지주
    {code:'032830'},  // 삼성생명
    {code:'000810'},  // 삼성화재
    {code:'323410'},  // 카카오뱅크 (핀테크)
    {code:'006800'},  // 미래에셋증권 (P1589: 거래대금 상위 증권사)
    {code:'016360'}   // 삼성증권
  ],
  'kfood': [
    {code:'003230'}, // 삼양식품 (불닭)
    {code:'097950'}, // CJ제일제당
    {code:'271560'}, // 오리온
    {code:'004370'}, // 농심
    {code:'007310'}, // 오뚜기 (P1589: 001800은 오리온홀딩스였음)
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
    {code:'017390'}, // 서울도시가스 (수소충전 인프라)
    {code:'003830'}  // 대한화섬 (풍력발전단지 개발)
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
    {code:'017390'},  // 서울도시가스 (수소충전 인프라)
    {code:'005380'}   // 현대차 (수소차 NEXO, 수소 상용차)
  ],
  'space': [
    {code:'012450'}, // 한화에어로스페이스 (누리호 엔진, 대장)
    {code:'047810'}, // KAI (위성/항공기)
    {code:'272210'}, // 한화시스템 (위성통신/SAR)
    {code:'064350'}, // 현대로템 (발사대/지상장비)
    {code:'079550'}, // LIG디펜스앤에어로스페이스 (위성탑재체/유도무기)
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
      row._weightSource = useCapWeight ? 'live-market-cap' : 'equal-weight'; row.wLabel = useCapWeight ? (Math.round(row.w * 10) / 10) + '%' : '동일가중'; // P1327: an equal split is not a measured weight
    });
  });
}

// Helper: resolve Korean stock code to Yahoo Finance symbol
function krTickerToYahoo(code) {
  // KOSDAQ stocks (v35.6: SCREENER_DB 전체 KOSDAQ 종목 동기화 — 40종목)
  var kosdaq = {
    '028300':1,'030520':1,'033100':1,'035900':1,'036930':1,'039030':1,'041020':1,
    '056080':1,'058470':1,'086520':1,
    '094480':1,'112040':1,'122870':1,'131970':1,'089030':1,'141080':1,'145020':1,'178320':1,
    '196170':1,'237880':1,'240810':1,'247540':1,'253450':1,'257720':1,'263750':1,
    '277810':1,'304100':1,'315640':1,'357780':1,
    '403870':1,'950130':1,'047080':1,'000250':1,
    '095340':1,'108320':1,'108490':1,'090360':1,'090710':1,'388720':1,
    '214150':1,'328130':1,'338220':1,'322510':1,'049950':1,
    '069540':1,'032500':1,'138080':1,'327260':1,'010170':1,'062970':1,'368770':1,'100590':1,'218410':1,'050890':1,
    '439090':1,'085660':1,'950160':1,'322310':1,'041190':1,
    '005290':1,'083650':1,'018290':1,'041510':1,'035760':1 // P1589: corrected from listing exchange 2026-10-10
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
  // 원시 XBRL 데이터 그대로 반환 → window.AIO.parseSecStatements()에서 파싱
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
  // 2. Yahoo chart through the shared relay chain (P1758): the Worker first, a public relay only after the Worker failed
  // this request. The v49.78 race sent every lookup to four public relays at once and never tried the Worker; the
  // shared deadline keeps the worst case close to that race.
  window._aioTickerLookupDiag = window._aioTickerLookupDiag || {};
  window._aioTickerLookupDiag[ticker] = { attempts: [], finalSource: null, startTime: Date.now(), strategy: 'relay-chain-p1758' };
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=5d';
    var chartJson = await fetchViaProxy(url, { parseJson: true, timeout: 3500, totalTimeout: 7000, signal: lookupSignal,
      accept: function(p) { var m = p && p.chart && p.chart.result && p.chart.result[0] && p.chart.result[0].meta; return !!(m && m.regularMarketPrice); } });
    var meta = chartJson.chart.result[0].meta;
    var _proxyName = (chartJson._aioTransport && chartJson._aioTransport.provider) || 'relay';
    var _dynPrice = meta.regularMarketPrice;
    var _dynPrev = meta.chartPreviousClose || meta.previousClose || 0;
    var _dynPct = meta.regularMarketChangePercent;
    if (_dynPct == null && _dynPrev > 0) _dynPct = ((_dynPrice - _dynPrev) / _dynPrev) * 100;
    if (typeof window._aioSetLiveData === 'function') {
      window._aioSetLiveData(ticker, { price: _dynPrice, pct: _dynPct != null ? _dynPct : null, observedAt: meta.regularMarketTime || null }, { source: 'yahoo:' + _proxyName, policyKey: 'quote_afterhours', reason: 'relay chain P1758' });
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
  } catch(e) {
    if (lookupSignal && lookupSignal.aborted) throw e;
    window._aioTickerLookupDiag[ticker].attempts = (e && e.attempts) || [];
    _aioLog('warn', 'fetch', 'Dynamic lookup error: ' + e.message);
  }

  throwIfLookupAborted();

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

  // v57.79: the personal-key Finnhub /quote fallback (P352) was removed; personal provider keys are retired (v57.67).

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
    ? 'Yahoo Finance (finance.yahoo.com/quote/' + ticker + ') 직접 확인 권장'
    : '외부 도구로 직접 확인 권장';
  return {
    ticker: ticker,
    available: false,
    fetchFailed: true,
    tickerType: _ftType,
    reason: 'Yahoo 3 프록시 + Naver 폴백 모두 실패',
    suggestedAction: _suggestion,
    source: 'none'
  };
}


// ═══ v37.8: 동적 분석 텍스트 생성 함수 모음 ═══

// ── 1) 한국 매크로 분석 ──

// P1552: the KR analysis paragraphs used to turn the 0-100 market score into a narrative ("favourable environment", "keep a
// defensive position", "historically rotation was active"). The score has no recorded predictive validation, so the line states
// the value, its basis and that it is not a forecast, with no colour ladder and no conclusion.
function _krReferenceScoreLine(label) {
  var ts = null;
  try { if (typeof computeTradingScore === 'function') ts = computeTradingScore().score; } catch (e) {}
  if (ts == null || !isFinite(Number(ts))) return '<br><b>' + label + '</b> 실시간·검증된 입력이 없어 참고값 산출을 보류합니다.';
  return '<br><b>' + label + '</b> 시장 환경 참고값 <b>' + ts + '/100</b> (직전 미국장 종가 기준, 예측 검증 미확립). 한국 시장은 수급·환율·실적을 따로 확인합니다.';
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
    el.innerHTML = '<b class="krl-amber">테마 종합판정 보류</b> — 유효 테마 ' + count + '/' + total + ', 구성종목 가중 커버리지 ' + pct + '%. 결측 테마를 0% 또는 중립으로 간주하지 않습니다.';
    return;
  }
  var validIds = coverage.validThemeIds;
  var CN={};Object.keys(window.AIO_KR_THEME_LABELS||{}).forEach(function(k){CN[k]=window.AIO_KR_THEME_LABELS[k].split(' / ')[0];}); // P1327: one label owner
  var perfs = [];
  for (var tid in KR_THEME_MAP) {
    var t = KR_THEME_MAP[tid], ws = 0, vs = 0;
    t.forEach(function(s) { var d = ld[krTickerToYahoo(s.code)]; if (d && d.pct != null && s.w > 0) { vs += d.pct * s.w; ws += s.w; } });
    if (validIds.indexOf(tid) >= 0 && ws > 0) perfs.push({ id: tid, name: CN[tid] || tid, perf: vs / ws });
  }
  if (!perfs.length) { el.textContent = '실시간 데이터 대기 중...'; return; }
  perfs.sort(function(a, b) { return b.perf - a.perf; });
  var top3 = perfs.slice(0, 3), bot3 = perfs.slice(-3).reverse();
  var hotCount = perfs.filter(function(p) { return p.perf >= 1; }).length;
  var coldCount = perfs.filter(function(p) { return p.perf <= -1; }).length;
  var avgPerf = perfs.reduce(function(s, p) { return s + p.perf; }, 0) / perfs.length;

  var h = '<b class="krl-green">상승 주도:</b> ' + top3.map(function(p) { return p.name + ' <b class="krl-green">' + (p.perf >= 0 ? '+' : '') + p.perf.toFixed(1) + '%</b>'; }).join(', ') + '<br>';
  h += '<b class="krl-red">하락 주도:</b> ' + bot3.map(function(p) { return p.name + ' <b class="krl-red">' + (p.perf >= 0 ? '+' : '') + p.perf.toFixed(1) + '%</b>'; }).join(', ') + '<br>';
  h += '<br>';

  // 시장 폭 판단
  h += '<b>【테마 폭 판단】</b> ';
  if (hotCount >= perfs.length * 0.6) h += '<span class="krl-green">유효 표본 내 강세 확산 ('+hotCount+'/'+perfs.length+' 상승). 진입 판단은 거래량·외국인/기관 수급·시장 지수 추세를 추가 확인.</span>';
  else if (coldCount >= perfs.length * 0.6) h += '<span class="krl-red">유효 표본 내 약세 확산 ('+coldCount+'/'+perfs.length+' 하락). 헤지는 보유 위험과 추세 확인 후 판단.</span>';
  else h += '<span class="krl-yellow">테마 차별화 장세. 순위는 관찰 신호이며 단독 매수·회피 지시가 아닙니다.</span>';
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
  if (growAvg > defAvg + 0.5) h += '<span class="krl-green">성장 테마 상대우위 (성장 ' + growAvg.toFixed(1) + '% vs 방어 ' + defAvg.toFixed(1) + '%). 비중 변경 전 추세 지속성과 수급을 확인.</span>';
  else if (defAvg > growAvg + 0.5) h += '<span class="krl-yellow">방어 테마 상대우위 (방어 ' + defAvg.toFixed(1) + '% vs 성장 ' + growAvg.toFixed(1) + '%). 하루 수익률만으로 리스크오프를 확정하지 않음.</span>';
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
      if (usD && usD.pct != null) {
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
      if (la.gap > 2) h += '<span class="krl-green">한국 아웃퍼폼. 외국인 매수 또는 한국 고유 모멘텀(정책·수급). 지속성 확인 필요.</span>';
      else if (la.gap < -2) h += '<span class="krl-red">한국 언더퍼폼. 미국 대비 할인 — 외국인 매도 또는 원화 약세 디스카운트. 반등 시 캐치업 기회.</span>';
      h += '<br>';
    });
  }

  // v38.4: 테마 순환매 사이클 프레임
  if (perfs.length >= 5) {
    h += '<br><b>【순환매 사이클 진단】</b> ';
    var topPerf = perfs[0].perf, botPerf = perfs[perfs.length - 1].perf;
    var perfRange = topPerf - botPerf;
    if (perfRange > 4) {
      h += '<span class="krl-yellow">테마 간 격차 ' + perfRange.toFixed(1) + '%p → 극단적 쏠림. 과열 테마에서 소외 테마로 순환매 전환 임박 가능. ';
      h += '하위 테마 중 펀더멘털 양호한 종목 관심.</span>';
    } else if (perfRange < 1.5) {
      h += '<span class="krl-accent">테마 간 격차 ' + perfRange.toFixed(1) + '%p → 동반 등락. 테마 선별보다 시장 방향성이 중요한 국면.</span>';
    } else {
      h += '<span>정상적 차별화. 상위 테마 추종 + 하위 테마 역발상 병행.</span>';
    }
  }

  // v40.4: 매크로 환경 연동 테마 진단
  var krMacroVix = usLd['^VIX'] ? usLd['^VIX'].price : null;
  var krMacroWti = usLd['CL=F'] ? usLd['CL=F'].price : null;
  var krMacroKrw = usLd['KRW=X'] ? usLd['KRW=X'].price : null;
  if (krMacroVix || krMacroWti || krMacroKrw) {
    h += '<br><br><b>【거시 환경 → 테마 영향】</b><br>';
    if (krMacroWti && krMacroWti > 100) {
      h += '<span class="krl-red">유가 $' + krMacroWti.toFixed(0) + ' → 에너지·정유 수혜, 항공·운송·2차전지 역풍. 원자재 비용 부담이 테마 전반에 영향.</span><br>';
    }
    if (krMacroKrw && krMacroKrw > 1400) {
      h += '<span class="krl-yellow">원화 약세(' + Math.round(krMacroKrw) + '원) → 수출테마(반도체·조선·자동차) 환율수혜 vs 수입의존(바이오원료·2차전지소재) 비용↑.</span><br>';
    }
    if (krMacroVix && krMacroVix > 25) {
      h += '<span class="krl-red">VIX ' + krMacroVix.toFixed(0) + '+ → 글로벌 공포 확산. 외국인 이탈 가속 → 소형주·테마주 변동성 극대화. 대형 방어테마(방산·원전·통신) 선호.</span><br>';
    }
    // 복합 시나리오
    if (krMacroWti && krMacroWti > 100 && krMacroKrw && krMacroKrw > 1400 && krMacroVix && krMacroVix > 25) {
      h += '<span class="krl-red krl-b"> 삼중 부담(유가↑+원화↓+VIX↑)이 동시에 나타났습니다. 방어 테마와 현금 비중을 점검할 구간입니다.</span><br>';
    }
  }

  h += _krReferenceScoreLine('【시장 환경】');

  el.innerHTML = h;
}

// ── 3) 포트폴리오 자동 진단 ── v57.77: retired with #pf-analysis-text (the native #pf-read, 포트폴리오 점검 and the holdings
// table carry its observations; its sector-beta table and stress factors were fixed estimates).

// ── 5) 심리지표 복합 분석 ──
// W01-B: retired — native ViewModel owns sent-analysis-text from one revision.


