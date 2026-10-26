// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 3: UI START (실제 분할 적용 v48.26)                ║
// ║  책임: Render + Page Router + Charts + Filters + Gauges                   ║
// ║  의존성: MODULE 1 (stores) + MODULE 2 (data fetch/score/translate)        ║
// ║  Chart instances: 페이지별 레지스트리에서 생성·정리                      ║
// ║  주의: MODULE 1/2의 함수 호출은 모두 이벤트/타이머 콜백 내부 (즉시 호출 X) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// AAII Chart.js stacked bar + P/C sparkline
// v57.60: the legacy breadth-page DOM writers and their bp-* chart registry were removed;
// the breadth route is rendered by src/ui/pages/market.js and window._breadth* globals are set by the screener breadth producer.

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
    // P1499: keep a route title the first showPage already set; this ran after it and reset deep links.
    if (!/ · AIO Screener$/.test(document.title)) document.title = 'AIO Screener ' + APP_VERSION + ' — 올인원 투자 터미널';
    var vBadge = document.getElementById('app-version-badge');
    if (vBadge) vBadge.textContent = APP_VERSION;
  }

  // v48.23 (P3-1): AIO 네임스페이스 최종 바인딩 — 모든 모듈 정의 후
  try { if (window.AIO && typeof window.AIO._bindCore === 'function') window.AIO._bindCore(); } catch(_){}


  // v30.12 P4: 이전 번역 캐시 복원 (새로고침 시 재번역 방지)
  var _tcRestored = _tcLoadFromStorage();
  if (_tcRestored > 0) console.log('[AIO v30.12] 번역 캐시 ' + _tcRestored + '건 복원됨');

  // v46.10: localStorage 가용 여부 감지 (Safari 개인정보보호 모드)
  (function() {
    try { localStorage.setItem('_ls_test', '1'); localStorage.removeItem('_ls_test'); }
    catch(e) {
      var w = document.getElementById('snapshot-stale-warning');
      if (w) { w.textContent = '브라우저 저장이 차단되어 포트폴리오·설정이 저장되지 않습니다.'; w.style.display = 'block'; }
    }
  })();

  // v17: 정적 기본값 즉시 로드 (API 연결 전에 빈칸/— 없애기)
  applyStaticFallbacks();
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
  luna: { id: 'gpt-6-luna', label: 'GPT-6 Luna', reasoningEffort: 'none' }, 'luna-low': { id: 'gpt-6-luna', label: 'GPT-6 Luna, 심층', reasoningEffort: 'low', thinking: true },
  'luna-medium': { id: 'gpt-6-luna', label: 'GPT-6 Luna, 분석', reasoningEffort: 'medium', thinking: true } // v57.61: analysis/decision/comparison/outlook; medium reasoning adds ~2-5k output tokens (~$0.002)
};
// v31.3: 질문 복잡도 감지 → 모델 자동 선택
function _detectQueryComplexity(query, ctxId) {
  var q = query.toLowerCase();
  var qLen = query.length;

  // ─── 1단계: 컨텍스트별 특화 판단 ───────────────────────────
  // 포트폴리오: 기본 Sonnet, 심층 Thinking
  if (ctxId === 'portfolio') return 'luna-low';
  // 기업분석(fundamental): 기본 Sonnet, 심층 분석은 Thinking
  if (ctxId === 'fundamental') {
    var fundThinking = /DCF|밸류에이션.*모델|적정.*주가|내재.*가치|WACC|잔여.*이익|EV\/EBITDA.*비교|피어.*그룹|산업.*비교.*분석|sum.?of.?parts|comp.*analysis|intrinsic.*value|free.?cash.?flow.*model|종합.*기업.*분석|종합.*분석.*해줘|15개.*관점|심층.*분석/;
    if (fundThinking.test(q)) return 'luna-low';
    // v34.5: fundamental 컨텍스트에서 티커가 감지되면 기본적으로 sonnet 사용 (15개 관점 분석 품질 보장)
    var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
    var fundSonnet = /재무.*분석|실적.*분석|매출.*성장|이익률|부채.*비율|경쟁.*우위|해자|moat|경영진|사업.*모델|revenue|earnings|margin|competitive|valuation|분석|어때|전망|투자|알려/;
    if (hasTicker || fundSonnet.test(q)) return 'luna-low';
    //  fall through to 범용 판단 (구조적 분석 포함)
  }
  // 기술적분석(technical): 전략 수립은 Sonnet, 멀티타임프레임 심층은 Thinking
  else if (ctxId === 'technical') {
    var techThinking = /멀티.*타임프레임|다중.*시간|엘리어트.*파동|피보나치.*되돌림.*정밀|와이코프|wyckoff|elliott|intermarket.*analysis|상호.*시장.*분석|divergence.*종합|다이버전스.*종합/;
    if (techThinking.test(q)) return 'luna-low';
    // v34.5: 티커 감지 시 기본 Sonnet (비교 분석 포함)
    var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
    var techSonnet = /진입.*시점|매수.*타이밍|손절.*설정|목표가|지지.*저항|추세.*분석|패턴.*분석|RSI|MACD|볼린저|이동평균|골든크로스|데드크로스|weinstein|stage.*분석|support|resistance|entry|stop.?loss|target|비교|vs|VS|분석|어때|전망/;
    if (hasTicker || techSonnet.test(q)) return 'luna-low';
  }
  // 매매시그널(signal): 스코어 해석은 Sonnet, 시나리오 분석은 Thinking
  else if (ctxId === 'signal') {
    var sigThinking = /시나리오.*분석|스코어.*변동.*예측|컴포넌트.*종합.*진단|포지션.*사이징|position.*sizing|scenario|전략.*수립.*해줘/;
    if (sigThinking.test(q)) return 'luna-low';
    var sigSonnet = /스코어.*해석|왜.*이.*점수|매매.*판단|매수.*매도|지금.*사도|지금.*팔아|진입|청산|비중.*조절|포지션|대응.*전략|지금.*어때|매수.*해도|매도.*해야|사도.*될까|팔아도.*될까|들어가도|나가야/;
    if (sigSonnet.test(q)) return 'luna-low';
  }
  // 매크로(macro): 금리/환율 영향 분석은 Sonnet, 멀티팩터 시나리오는 Thinking
  else if (ctxId === 'macro') {
    var macThinking = /금리.*인상.*시나리오|연준.*경로|다중.*시나리오|인플레.*디플레.*비교|경기.*침체.*확률|스태그플레이션|yield.*curve.*inversion|멀티팩터|macro.*scenario|recession.*probability/;
    if (macThinking.test(q)) return 'luna-low';
    var macSonnet = /금리.*영향|환율.*전망|달러.*방향|유가.*영향|인플레|디플레|연준|FOMC|CPI|고용|GDP|경기.*사이클|섹터.*로테이션|rate|inflation|fed|dollar|oil.*impact/;
    if (macSonnet.test(q)) return 'luna-low';
  }
  // 시장폭(breadth): 종합 진단은 Sonnet, 다이버전스 심층은 Thinking
  else if (ctxId === 'breadth') {
    var brThinking = /다이버전스.*심층|시장폭.*vs.*지수.*괴리.*분석|McClellan.*종합|과거.*비교.*분석|히스토리컬|역사적.*비교|breadth.*divergence.*deep/;
    if (brThinking.test(q)) return 'luna-low';
    var brSonnet = /시장폭.*해석|건강.*상태|참여.*종목|다이버전스|괴리|A\/D|McClellan|종합.*판단|지금.*건강|breadth.*analysis/;
    if (brSonnet.test(q)) return 'luna-low';
  }
  // 투자심리(sentiment): 종합 판단은 Sonnet, 역사적 비교 심층은 Thinking
  else if (ctxId === 'sentiment') {
    var senThinking = /공포.*단계.*비교|역사적.*패닉.*비교|바닥.*확인.*체크리스트|capitulation.*분석|항복.*매도.*분석|스마트머니.*vs.*덤머니|sentiment.*extreme.*analysis/;
    if (senThinking.test(q)) return 'luna-low';
    var senSonnet = /공포.*탐욕|지금.*바닥|바닥.*신호|VIX.*해석|AAII|NAAIM|풋콜|put.*call|심리.*분석|과매수|과매도|fear.*greed/;
    if (senSonnet.test(q)) return 'luna-low';
  }
  // P1758/v57.54: 한국 기술·테마·거시 컨텍스트 퇴역 — 한국 섹션은 technical/themes/macro 화면 안에 있고 그 컨텍스트가 답한다
  // 테마(themes, theme-detail): 섹터/테마 분석은 Sonnet, 교차 분석은 Thinking
  else if (ctxId === 'themes' || ctxId === 'theme-detail') {
    var thThinking = /교차.*분석|테마.*간.*상관|밸류.*체인.*분석|업스트림.*다운스트림|수혜주.*종합|value.*chain|cross.*theme|supply.*chain.*analysis/;
    if (thThinking.test(q)) return 'luna-low';
    var thSonnet = /테마.*분석|섹터.*전망|수혜주|관련주|성장.*동력|시장.*규모|트렌드|theme|sector.*outlook|beneficiary/;
    if (thSonnet.test(q)) return 'luna-low';
  }

  // ─── 2단계: 범용 심층 요청 패턴 (컨텍스트 무관) ─────────────
  // Thinking급: 깊은 추론이 필요한 패턴
  var thinkingKw = /심층.*분석|근본.*원인|시나리오.*확률|멀티팩터|DCF|밸류에이션.*모델|포지션.*사이징|감마.*익스포저|옵션.*전략.*설계|리스크.*관리.*전략|비교.*분석.*해줘|왜.*그런지.*자세히|깊이.*분석|종합.*진단|체계적.*분석|정밀.*분석|단계별.*분석/;
  var thinkingEn = /deep.?analysis|root.?cause|scenario.?model|multi.?factor|position.?sizing|risk.?management.?strategy|comprehensive.*diagnosis|systematic.*analysis|step.?by.?step.*analy/;
  if (thinkingKw.test(q) || thinkingEn.test(q)) return 'luna-low';

  // Sonnet급: 분석/전략/판단이 필요한 패턴
  // P1740: colloquial trade questions ("사도 돼?", "살까", "팔까") reason on the deeper model like 매수 타이밍.
  var sonnetKw = /사도\s*(?:돼|될까|되나|괜찮)|살까|팔까|담아도|들어가도|전략.*제안|매수.*타이밍|진입.*시점|손절|목표가.*설정|섹터.*로테이션|어떻게.*대응|포트폴리오|종합.*판단|비교.*해줘|분석.*해줘|전망.*해줘|평가.*해줘|진단.*해줘|추천.*해줘|왜.*그래|왜.*떨어|왜.*올라|원인.*뭐|이유.*뭐|어떻게.*해야|장단점|리스크.*뭐|영향.*분석/;
  var sonnetEn = /strategy|recommend|analyze|forecast|evaluate|diagnose|compare|pros.*cons|impact.*analysis|what.*should|why.*drop|why.*rise|how.*respond/;
  if (sonnetKw.test(q) || sonnetEn.test(q)) return 'luna-low';

  // ─── 3단계: 구조적 복잡도 분석 ─────────────────────────────
  // 질문이 길거나 여러 조건을 포함하면 Sonnet 승격
  var questionMarks = (q.match(/\?/g) || []).length;
  var conjunctions = (q.match(/그리고|또한|더불어|아울러|동시에|함께|and|also|additionally/g) || []).length;
  var conditions = (q.match(/만약|경우|가정|~면|한다면|된다면|if|when|assuming|suppose/g) || []).length;

  // 복합 질문 (여러 물음표 or 접속사+길이) → Sonnet
  if (questionMarks >= 2 || (conjunctions >= 2 && qLen > 80)) return 'luna-low';
  // 조건문 포함 → 시나리오 사고 필요 → Sonnet
  if (conditions >= 1 && qLen > 60) return 'luna-low';
  // 긴 질문 (150자+) → 복잡한 의도 가능성 → Sonnet
  if (qLen > 150) return 'luna-low';

  // ─── 기본: Haiku ───────────────────────────────────────────
  return 'luna';
}

const LLM_BUDGET = {
  dailyQueryLimit: 20,
  pricingAvailable: false
};
function getSelectedModel() {
  return 'luna'; // v31.3: 기본 Haiku (질문별 자동 승격은 chatSend에서 처리)
}

function getModelConfig(modelKey) {
  return LLM_MODELS[modelKey || getSelectedModel()] || LLM_MODELS.luna;
}

function calcDailyLimit() {
  return LLM_BUDGET.dailyQueryLimit;
}

// v57.77: getLLMState() retired — the AI ON/OFF switch track left with P1653 (AI is always on),
// so the state read always returned true and every OFF branch was dead.

// v53.59 P855: quota is not capability.  The UI must not advertise available
// calls when neither a personal key nor a healthy shared Worker route exists.
function getLLMRouteReadiness() {
  var config = window.AIO && typeof window.AIO.getPublicConfig === 'function' ? window.AIO.getPublicConfig() : null;
  if (config && config.ai && config.ai.routeStatus === 'DISABLED') return { ready: false, reason: 'NO_ROUTE', label: '공용 연결 준비 중' }; // P1424
  var target = typeof _aioClaudeTarget === 'function' ? _aioClaudeTarget() : null;
  var workerUrl = target && target.serverKey ? target.workerUrl : '';
  if (!workerUrl) return { ready: false, reason: 'NO_ROUTE', label: '연결 없음' };
  var health = window._aioLastClaudeRouteState;
  if (health && health.target && health.target.workerUrl === workerUrl && health.ok === true) {
    return { ready: true, reason: 'SHARED_WORKER', label: (health.health && health.health.ai && health.health.ai.budgetSaver && health.health.ai.budgetSaver.active && health.health.ai.budgetSaver.label) || '사용 가능' }; // P1759: month's last 20% → '예산 절약 모드 · 웹 검색 없이'
  }
  if (health && health.target && health.target.workerUrl === workerUrl && health.reason === 'FAMILY_CODE_REQUIRED') return { ready: false, reason: 'FAMILY_CODE_REQUIRED', label: '가족 코드 필요, 질문하면 입력란이 열림' }; // v58.82
  if (health && health.target && health.target.workerUrl === workerUrl && health.reason === 'WORKER_NOT_READY') {
    return { ready: false, reason: 'WORKER_NOT_READY', label: 'AI 연결 안 됨, 잠시 뒤 다시 시도' };
  }
  return { ready: false, reason: 'WORKER_NOT_CHECKED', label: '연결 확인 중' };
}

// P1070/R592: switch state, route readiness, and quota are independent dimensions. A missing route must
// never be represented by mutating the user's ON/OFF switch (P1342: the unused combined snapshot was deleted).
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
  const swLabel = cachedEl('llm-switch-label');
  const capEl   = cachedEl('llm-daily-cap');
  const remEl   = cachedEl('llm-remaining');
  const progEl  = cachedEl('llm-prog-fill');
  const badge   = document.getElementById('llm-quota');
  const hdrBadge= cachedEl('llm-header-badge');
  const modelEl = cachedEl('llm-model-label');
  const costEl  = cachedEl('llm-daily-cost');

  const dailyLimit = calcDailyLimit();
  const model = getModelConfig();
  const route = getLLMRouteReadiness();

  // v57.77: AI is always on (P1653), so route readiness is the only gate — a missing route shows its label, never an OFF state.
  if (!route.ready) {
    // v58.56 (re-audit #26): the sidebar card is one line — the short state; the full sentence stays in the title.
    if (swLabel) { swLabel.textContent = String(route.label || '').split(/ · |, /)[0].replace(/^AI\s+/, ''); swLabel.title = route.label; swLabel.className = 'llm-switch-label'; }
    if (capEl) capEl.textContent = '—';
    if (remEl) { remEl.textContent = '—'; remEl.className = 'llm-quota-val empty'; }
    if (progEl) { progEl.style.width = '0%'; progEl.className = 'llm-prog-fill empty'; }
    if (badge) badge.textContent = route.reason === 'NO_ROUTE' ? 'NO ROUTE' : '확인 필요';
    if (costEl) costEl.textContent = route.reason === 'NO_ROUTE' ? '운영자의 공용 AI 연결이 필요합니다.' : '공유 Worker 상태 확인 후 사용할 수 있습니다.';
    if (hdrBadge) { hdrBadge.textContent = 'AI, ' + route.label; hdrBadge.style.color = 'var(--text-muted)'; hdrBadge.style.borderColor = 'var(--border)'; hdrBadge.style.background = 'var(--surface-3)'; }
    return;
  }

  if (swLabel) { swLabel.textContent = String(route.label || '사용 가능').split(/ · |, /)[0]; swLabel.title = route.label || '사용 가능'; swLabel.className = 'llm-switch-label on'; }
  if (capEl)   capEl.textContent = dailyLimit + '회';
  if (modelEl) modelEl.textContent = '채팅·심층·번역 GPT-6 Luna';

  const quota     = getQuota();
  const used      = quota.used;
  const remaining = Math.max(0, dailyLimit - used);
  const pct       = Math.min(100, Math.round(used / dailyLimit * 100));
  const overBudget= quota.overBudget || 0;

  const grade = remaining === 0 ? (overBudget > 0 ? 'over' : 'empty') : remaining <= Math.ceil(dailyLimit * 0.2) ? 'warn' : 'green';

  if (remEl)  { remEl.textContent = remaining + '회' + (overBudget > 0 ? ' (한도 초과 ' + overBudget + '회)' : ''); remEl.className = 'llm-quota-val ' + grade; }
  if (progEl) { progEl.style.width = Math.min(pct, 100) + '%'; progEl.className = 'llm-prog-fill' + (grade !== 'green' ? ' ' + grade : ''); }
  if (costEl) costEl.textContent = '비용 정보: 공급자 청구 원천 미연결';

  if (badge)    badge.textContent = remaining + '/' + dailyLimit;
  if (hdrBadge) {
    // v50.13: 헤더 배지는 'AI · 모델'만 — 남은 횟수(remaining/dailyLimit)는 옆 #llm-quota가 단독 표시(중복 제거).
    const hdrText = overBudget > 0
      ? 'AI 일일 한도 초과, +' + overBudget + '회'
      : 'AI, ' + model.label;
    hdrBadge.textContent = hdrText;
    hdrBadge.style.color = grade === 'green' ? 'var(--blue-11)' : grade === 'warn' ? 'var(--amber-11)' : 'var(--orange-11)';
    hdrBadge.style.borderColor = grade === 'green' ? 'var(--accent-border)' : grade === 'warn' ? 'var(--amber-6)' : 'var(--data-red-soft)';
    hdrBadge.style.background  = grade === 'green' ? 'var(--data-cyan-soft)' : grade === 'warn' ? 'var(--gold-3)' : 'var(--data-red-mid)';
  }
}

function toggleLLM() {
  // v57.77: AI is always on (P1653) — #llm-header-badge still dispatches this action, which now only refreshes
  // the connection/quota readout; there is no ON/OFF state to flip.
  updateQuotaBadge();
}

// Call this every time an LLM query is actually made
function consumeLLMQuery() {
  // Fail closed before any quota accounting: a missing provider route never becomes a call.
  // v57.77: the OFF/unlimited shortcut left with the AI switch (P1653) — every call is charged.
  var route = getLLMRouteReadiness();
  if (!route.ready) {
    if (typeof updateQuotaBadge === 'function') updateQuotaBadge();
    return false;
  }
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
  // v31.3: 적응형 모델 — 기본 Haiku, 질문 복잡도에 따라 Sonnet/Thinking 자동 승격
  updateQuotaBadge();

  // ── 확장 API 키 상태 복원 ──
  // P1424: readiness is checked even when cached news needs no translation.
  if (typeof _aioEnsureClaudeRoute === 'function') _aioEnsureClaudeRoute('').then(updateQuotaBadge).catch(updateQuotaBadge);
  // 실제 비밀값은 런타임 조회 경로만 사용한다. password input의 value에 원문을 넣으면
  // 접근성 트리/브라우저 자동화 스냅샷에서 노출될 수 있다.
  // v57.76: the personal data/AI key inputs left the shell (v57.67); only the self-proxy URL input remains.
  var _keyMap = [
    ['aio_cf_worker_url', 'aio_cf_worker_input']
  ];
  _keyMap.forEach(function(pair) {
    var saved = safeLSGetSync(pair[0]);
    var el = document.getElementById(pair[1]);
    if (saved && el) {
      el.value = '••••••••';
      el.dataset.secretStored = 'true';
      el.setAttribute('aria-label', (el.getAttribute('placeholder') || 'API 키') + ', 저장됨');
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
  // v58.55: the home kicker (#home-date-label, date · close basis) is written by src/ui/components/market-regime.js only.
  
  // Update version badge
  const vb = document.getElementById('app-version-badge');
  if (vb) vb.title = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : vb.textContent.trim()) + ', 확인: ' + dateStr; // P1624: identity tooltip must match the app, not a historical literal.
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
  if (!url) { setGhStatus('경로 오류', '#ffa057'); return; }

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
        setGhStatus('Rate limit, ' + resetIn + '분 후 재시도', '#ffa057');
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
      setGhStatus('✓ ' + ver + (built ? ', ' + built : ''), '#3dd68c');
    } else if (ver !== _ghCurrentVersion) {
      // 버전 변경 감지!
      setGhStatus(' ' + ver + ' (신규)', '#ffa057');
      showUpdateBanner(ver, data.built);
    } else {
      // 최신 상태
      setGhStatus('✓ ' + ver + ' 최신', '#3dd68c');
    }
  } catch(e) {
    _ghFailCount++;
    const isOffline = !navigator.onLine;
    const errMsg = isOffline ? ' 오프라인' : (' 연결 실패 (' + _ghFailCount + ')');
    setGhStatus(errMsg, '#ec5d5e');
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
    subEl.textContent = `배포 시각 ${d}, 클릭하여 새로고침`;
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
  setGhStatus(' 오프라인', '#ec5d5e');
});


// ── Browser back/forward support ──────────────────────────────────────
// Knowledge route links use #route?knowledgeNode=... so the app shell and
// destination pages share one bookmarkable route-context grammar.
function _aioParseRouteHash(hashValue) {
  var raw = String(hashValue || '').replace(/^#/, '');
  var separator = raw.indexOf('?');
  var path = (separator >= 0 ? raw.slice(0, separator) : raw).split('/'), routeId = path[0];
  var params = new URLSearchParams(separator >= 0 ? raw.slice(separator + 1) : ''); // v57.54: #ticker/NVDA reads as #ticker?sym=NVDA (was a blank page)
  if (routeId === 'ticker' && path[1] && !params.has('sym')) params.set('sym', path[1]); return { routeId: routeId || 'home', params: params };
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
// Back/forward: js/aio-core.js registers the one classic popstate handler (it loads first and sets
// _aioPopstateRegistered, so a second handler here never ran); src/app/router.js applies the address part.

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
    krDynamic: 'KR 동적 데이터'
  };

  function ensureLayer() {
    var layer = document.getElementById('aio-refresh-progress-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'aio-refresh-progress-layer';
    layer.setAttribute('role', 'status');
    layer.setAttribute('aria-live', 'polite');
    // layout lives in legacy-ui.css (#aio-refresh-progress-layer); display stays inline — T802 reads layer.style.display
    layer.style.display = 'none';
    layer.innerHTML = '<div class="lu-rp-head"><div id="aio-refresh-progress-title">전체 데이터 최신화</div><div id="aio-refresh-progress-count" style="font-size:12px;font-family:var(--font-mono,monospace);color:var(--data-cyan,#4ccce6);">0/0</div></div><div class="lu-rp-track"><div id="aio-refresh-progress-bar"></div></div><div id="aio-refresh-progress-current" style="font-size:12px;color:var(--text-muted,#a39073);margin-bottom:8px;">대기 중</div><div id="aio-refresh-progress-list"></div>';
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
    if (text === '완료') return 'var(--data-green,#3dd68c)';
    if (text === '진행 중') return 'var(--data-cyan,#4ccce6)';
    if (text === '스킵') return 'var(--data-amber,#ffa057)';
    if (text === '확인 필요') return 'var(--data-red,#ec5d5e)';
    return 'var(--text-muted,#a39073)';
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
      bar.style.background = failed ? 'var(--data-amber,#ffa057)' : 'var(--data-cyan,#4ccce6)';
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
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;border-top:0.5px solid var(--white-a1);padding-top:4px;';
        var name = document.createElement('span');
        name.textContent = labels[key] || key;
        var state = document.createElement('span');
        state.textContent = txt;
        state.className = 'lu-rp-state';
        state.style.color = statusColor(txt);
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
      if (activeId === 'signal' && typeof initSignalDashboard === 'function') initSignalDashboard();
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
  // Re-init charts on current page
  const activePage = document.querySelector('.page.active');
  const activeId = activePage ? activePage.id.replace('page-','') : prevPage;
  if (activeId === 'signal')    initSignalDashboard();

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
  // v57.77: #score-gauge-val retired with the score (P1392/P1670) — its aria-live hook was removed.

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
    'topbar-refresh-btn': '데이터 새로고침'
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
  ['live-quote-ts','server-data-age','pf-total-value','pf-total-pnl'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.getAttribute('aria-live')) {
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
    }
  });

  // 17. v41: 모든 [role="button"]에 Enter/Space 키보드 핸들링
  document.querySelectorAll('[role="button"]:not(.nav-item)').forEach(function(el) {
    el.addEventListener('keydown', function(e) {
      if (e.defaultPrevented || e.repeat || el.tagName === 'BUTTON' || el.tagName === 'A') return; // P1604: native controls already own keyboard activation.
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
    h1.className = 'sr-only'; // .sr-only (index.html) already sets the same clip box with !important
    var mc = document.getElementById('main-content');
    if (mc) mc.insertBefore(h1, mc.firstChild);
  }

  // 21. v41.2: 동적 영역 aria-live 확장 (뉴스 티커, 상태 패널, 트레이딩 스코어)
  ['snapshot-stale-warning','data-status-panel'].forEach(function(id) {
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

// v49.2: Institutional Technical Brief helpers. v57.76: the 차트 tab brief (runInstitutionalTechnicalBrief and its panel
// renderers) was deleted with its DOM; these label helpers stay for the portfolio technical-risk table.
function _itbNum(v, digits) {
  if (v === null || v === undefined || !isFinite(Number(v))) return '--';
  return Number(v).toFixed(digits == null ? 2 : digits);
}

function _itbBadge(label, tone) {
  var color = tone === 'risk' ? 'var(--data-red)' : tone === 'warn' ? 'var(--data-amber)' : tone === 'bull' ? 'var(--data-green)' : 'var(--data-cyan)';
  return '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;background:' + color + '1f;color:' + color + ';border:0.5px solid ' + color + '55;font-size:12px;font-weight:800;">' + escHtml(label) + '</span>';
}

function _itbActionTone(action) {
  if (action === 'EXIT_OR_HEDGE' || action === 'TRIM_50') return 'risk';
  if (action === 'TRIM_25_33' || action === 'NO_ADD_RAISE_STOP') return 'warn';
  if (action === 'HOLD_CORE') return 'bull';
  return 'info';
}

// P1535: the engines keep their internal action enums (unit tests and golden fixtures read them), but the reader sees
// the load level a score stands for, not a position instruction. An unknown or missing enum reads as withheld.
var _ITB_ACTION_LABELS = {
  HOLD_CORE: '부담 낮음', NO_ADD_RAISE_STOP: '부담 일부 확인', TRIM_25_33: '부담 높음', TRIM_50: '부담 매우 높음',
  EXIT_OR_HEDGE: '부담 최상위 구간', REDUCE: '부담 높음', WATCH: '관찰 필요', WAIT: '판단 보류', NO_ACTION: '판단 보류'
};
function _itbActionLabel(action) {
  return _ITB_ACTION_LABELS[action] || '판단 보류';
}

function _itbPortfolioObserved(result) {
  var items = (result && result.items) || [];
  if (!items.length || result.heatScore == null) return '판단 보류';
  var hot = items.filter(function(it) { return it && it.action && it.action !== 'HOLD_CORE' && it.action !== 'WAIT'; }).length;
  return '포지션 ' + items.length + '개 중 부담 신호 ' + hot + '개';
}

// P1546: the sell-pressure engine's 0-100 sum has no predictive validation, so the panel reports how many measured
// conditions are present (a count the reader can audit against the flag badges), not a score out of 100.
function _itbObservedCount(sp) {
  var flags = (sp && sp.flags) || [];
  if (!sp || sp.score == null || flags.indexOf('DATA_INSUFFICIENT') >= 0) return '판단 보류';
  var n = flags.filter(function(f) { return f !== 'TREND_HEALTHY_NO_EXIT_SIGNAL'; }).length;
  return n ? '확인된 조건 ' + n + '개' : '확인된 조건 없음';
}

// P1558 → v57.76: the Korean flag-label map (_itbFlagLabel) left with the brief panels that showed flag badges.

function renderDataQualityBadge(quality) {
  quality = quality || {};
  if ((quality.policyKey || quality.value !== undefined) && window.calcDataQuality) {
    try { quality = window.calcDataQuality(quality); } catch(_) {}
  }
  var confNum = typeof quality.confidence === 'number' ? quality.confidence : (quality.confidence === 'high' ? 90 : quality.confidence === 'medium' ? 65 : quality.confidence === 'low' ? 35 : null);
  var label = quality.label || (confNum >= 80 ? 'HIGH' : confNum >= 55 ? 'MEDIUM' : confNum >= 30 ? 'LOW' : 'UNKNOWN');
  var tone = label === 'HIGH' ? 'bull' : label === 'MEDIUM' ? 'warn' : 'risk';
  var conf = confNum !== null ? ' ' + _itbNum(confNum, 0) + '%' : '';
  var source = quality.source ? ', ' + quality.source : '';
  return _itbBadge('Data ' + label + conf, tone) + '<span style="font-size:12px;color:var(--text-muted);margin-left:6px;">' + escHtml((quality.freshness || 'UNKNOWN') + source) + '</span>';
}


function renderPortfolioTechnicalRisk(result) {
  var el = document.getElementById('pf-technical-risk');
  if (!el) return;
  result = result || {};
  if (!result.items || !result.items.length) {
    el.innerHTML = '<div class="lu-pf-empty">포지션별 OHLCV가 확보되면 기술적 매도압력과 집중 리스크를 함께 계산합니다.</div>';
    return;
  }
  var tone = result.heatScore >= 58 ? 'risk' : result.heatScore >= 38 ? 'warn' : 'bull';
  var rows = result.items.slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); }).map(function(item) {
    var rowTone = _itbActionTone(item.action);
    return '<tr class="lu-pf-tr">' +
      '<td class="lu-pf-tk">' + escHtml(item.ticker || '-') + '</td>' +
      '<td class="lu-pf-r">' + _itbNum(item.weightPct, 1) + '%</td>' +
      '<td class="lu-pf-r ' + ((item.pnlPct || 0) >= 0 ? 'lu-pf-up' : 'lu-pf-dn') + '">' + _itbNum(item.pnlPct, 1) + '%</td>' +
      '<td class="lu-pf-rb">' + _itbObservedCount(item) + '</td>' +
      '<td class="lu-pf-td">' + _itbBadge(_itbActionLabel(item.action), rowTone) + '</td>' +
    '</tr>';
  }).join('');
  el.innerHTML = '<div class="lu-pf-head">' +
    '<div>' + _itbBadge(_itbActionLabel(result.action), tone) + '<span class="lu-pf-obs">' + _itbPortfolioObserved(result) + '</span></div>' +
    '</div>' +
    '<div class="lu-pf-note">10EMA/21EMA/50SMA 이탈, ATR 과열, 보유 비중을 포지션별로 나열한 관측입니다. 합산 점수는 예측 검증이 없어 표시하지 않습니다.</div>' +
    '<div class="lu-pf-scroll"><table class="lu-pf-tbl"><thead><tr class="lu-pf-thr"><th class="lu-pf-th">종목</th><th class="lu-pf-th lu-pf-th-r">비중</th><th class="lu-pf-th lu-pf-th-r">손익</th><th class="lu-pf-th lu-pf-th-r">확인 조건</th><th class="lu-pf-th">부담 수준</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

window.renderDataQualityBadge = renderDataQualityBadge;
window.renderPortfolioTechnicalRisk = renderPortfolioTechnicalRisk;

// ──────────────────────────────────────────────────────────────────────────────
// v50.81 _aioDiagram — 10-type 인라인 SVG 다이어그램 엔진
// 외부 라이브러리 불필요. JS → SVG 문자열 생성 → innerHTML 주입.
// API: window._aioDiagram.render(type, el, data) / .getSvg(type, data)
// 용도: 10개 페이지 시각 패널(Phase2) + AI 채팅 자동 시각화(Phase3)
// ──────────────────────────────────────────────────────────────────────────────
window._aioDiagram = (function () {
  var C = {
    // P1591: theme tokens, not dark-only constants — the light theme drew white text on ivory (S05/E01).
    green:  'var(--data-green)', amber: 'var(--data-amber)', red: 'var(--data-red)', cyan: 'var(--data-cyan)', blue: 'var(--data-blue)', muted: 'var(--text-muted)',
    text:   'var(--text-primary)', bg: 'transparent', bgSolid: 'var(--surface-1)', surface: 'var(--surface-1)', border: 'var(--border)',
  };
  // P1126/R619: aio-data.js가 먼저 로드되므로 escHtml이 항상 존재한다. 여기서 따로
  // 재구현하지 않는다 — 3-char 버전과 4-char 정본이 갈라지면 SVG/오류 문구만
  // 다른 규칙으로 이스케이프되는 조용한 불일치가 된다.
  function _esc(s) {
    return escHtml(String(s || ''));
  }
  function _n(v, d) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(d || 0) : '—'; }
  function _cl(v, lo, hi) { return Math.max(lo, Math.min(hi, v || 0)); }
  function _pctCol(v) { return v > 0 ? 'var(--dir-up)' : v < 0 ? 'var(--dir-down)' : C.muted; }
  function _scoreCol(s) { return s >= 75 ? C.green : s >= 60 ? C.cyan : s >= 45 ? C.amber : C.red; }
  function _alphaRgb(hex, a) {
    // Convert #rrggbb → rgba(r,g,b,a)
    if (String(hex).charAt(0) !== '#') return 'color-mix(in srgb, ' + hex + ' ' + Math.round(a * 100) + '%, transparent)';
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
      { label: 'VIX 국면',   value: d.vixScore || 0,  max: 20 },
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
    var band = total >= 75 ? '스트레스 적음' : total >= 60 ? '스트레스 일부' : total >= 45 ? '중립' : total >= 30 ? '주의' : '위험';
    out += _r(cx - 32, cy + 22, 64, 15, _alphaRgb(col, 0.14), 4, col, 1);
    out += _t(cx, cy + 33, band, col, 10, 700, 'middle');
    var y0 = 34;
    comps.forEach(function (c, i) {
      var y = y0 + i * 30;
      var pct = _cl(c.value / (c.max || 20), 0, 1);
      var cc = _scoreCol(pct * 100);
      out += _t(14, y + 11, c.label, C.muted, 10);
      out += _r(90, y + 3, 190, 10, 'color-mix(in srgb, var(--text-primary) 8%, transparent)', 3);
      out += _r(90, y + 3, Math.round(190 * pct), 10, _alphaRgb(cc, 0.65), 3);
      out += _t(286, y + 12, _n(c.value, 0) + '/' + c.max, cc, 10, 700);
      if (i === 2) out += _l(310, y + 8, 352, cy, 'color-mix(in srgb, var(--text-primary) 16%, transparent)');
    });
    out += _l(310, 44, 348, cy, 'color-mix(in srgb, var(--text-primary) 10%, transparent)');
    out += _l(310, 164, 348, cy, 'color-mix(in srgb, var(--text-primary) 10%, transparent)');
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
    out += _t(14, 18, '시장 국면 포지셔닝', C.text, 10, 700);
    var qx = 110, qy = 26, qw = 200, qh = 155;
    out += _r(qx, qy, qw / 2, qh / 2, _alphaRgb(C.red, 0.07), 0, C.border, 0.5);
    out += _r(qx + qw / 2, qy, qw / 2, qh / 2, _alphaRgb(C.green, 0.07), 0, C.border, 0.5);
    out += _r(qx, qy + qh / 2, qw / 2, qh / 2, _alphaRgb(C.amber, 0.07), 0, C.border, 0.5);
    out += _r(qx + qw / 2, qy + qh / 2, qw / 2, qh / 2, _alphaRgb(C.cyan, 0.07), 0, C.border, 0.5);
    out += _l(qx + qw / 2, qy, qx + qw / 2, qy + qh, 'color-mix(in srgb, var(--text-primary) 16%, transparent)');
    out += _l(qx, qy + qh / 2, qx + qw, qy + qh / 2, 'color-mix(in srgb, var(--text-primary) 16%, transparent)');
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
    // v57.50 C13: the shared VIX bands (RULES.volatility 18/25/32 via _aioVixBandIndex), not a private 18/25 pair.
    var _vb = typeof window._aioVixBandIndex === 'function' ? window._aioVixBandIndex(vix) : (vix >= 32 ? 3 : vix >= 25 ? 2 : vix >= 18 ? 1 : 0);
    out += _t(rx + 47, ry + 47, 'VIX ' + _n(vix, 1), _vb >= 2 ? C.red : _vb === 1 ? C.amber : C.green, 10, 700, 'middle');
    out += _t(rx + 47, ry + 61, ['저변동 구간', '통상 범위', '변동성 경계 구간', '고변동 구간'][_vb] || '', C.muted, 10, 400, 'middle');
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
    out += _t(W / 2, 16, sym + ' 팩터 위치 (대상 내 백분위)', C.text, 10, 700, 'middle');
    [0.25, 0.5, 0.75, 1].forEach(function (scale) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push((cx + R * scale * Math.cos(a)).toFixed(1) + ',' + (cy + R * scale * Math.sin(a)).toFixed(1));
      }
      out += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="color-mix(in srgb, var(--text-primary) ' + (scale === 1 ? 18 : 8) + '%, transparent)" stroke-width="1"/>';
    });
    axes.forEach(function (ax, i) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
      out += _l(cx, cy, ex.toFixed(1), ey.toFixed(1), 'color-mix(in srgb, var(--text-primary) 11%, transparent)');
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
      // Codex browser audit H29: "랭크 70" beside "271위 / 931" read as 70th place. It is a 0–100 percentile.
      out += _r(W - 80, H - 28, 72, 20, _alphaRgb(rc, 0.14), 4, rc, 1);
      out += _t(W - 44, H - 14, '백분위 ' + d.rank, rc, 10, 700, 'middle');
    }
    return _svg(W, H, out);
  }

  // ── 4. pipeline-status: 데이터 파이프라인 현황 ───────────────
  function _pipelineStatus(d) {
    var meta = d.meta || {};
    var items = [
      { label: 'Yahoo 시세',   ok: (meta.symbolsOk || 0) >= 60, val: (meta.symbolsOk || 0) + ' 심볼' },
      { label: 'Fear & Greed', ok: !!meta.fearGreedOk,           val: d.fg != null ? String(d.fg) : '—' },
      { label: 'FRED 거시',  ok: !!meta.fredFetchOk,           val: meta.fredHasKey ? (meta.fredFetchOk ? (meta.macroKeyCount || '?') + '개' : '키↑실패') : 'Secret 미등록' },
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
      out += _r(x, y, 196, 34, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 5, it.ok ? _alphaRgb(C.green, 0.22) : _alphaRgb(C.red, 0.18), 1);
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
        ' fill="' + (active ? _alphaRgb(col, 0.25) : 'color-mix(in srgb, var(--text-primary) 6%, transparent)') + '"' +
        ' stroke="' + (active ? col : 'color-mix(in srgb, var(--text-primary) 13%, transparent)') + '" stroke-width="' + (active ? 2 : 0.5) + '"/>';
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
      out += _r(225, ry, 146, 46, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 5, _alphaRgb(row[2], 0.2), 1);
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
    out += _r(18, slY, 366, 8, 'color-mix(in srgb, var(--text-primary) 8%, transparent)', 4);
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
      out += _r(x, H - 50, 92, 40, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 4, C.border, 1);
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
      out += _l(cX, y, cX + cW, y, 'color-mix(in srgb, var(--text-primary) 10%, transparent)');
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
      out += _r(120, y + 2, 224, 10, 'color-mix(in srgb, var(--text-primary) 8%, transparent)', 3);
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
    // LC-41: null/미수신 값을 0으로 승격하지 않는다. 이전에는 quantileSpread·ic·hitRate·표본 수에
    // 폴백 0을 적용해, 표본이 없어도 IC 0.000·스프레드 0.00%가 '측정된 0'처럼 보였다.
    var num = function(v) { return (v == null || v === '' || typeof v === 'boolean' || !isFinite(Number(v))) ? null : Number(v); };
    var ic = bt.ic || {};
    var spread = num(bt.quantileSpread), hit = num(bt.hitRate), n = num(bt.n);
    var hasSample = n != null && n > 0;
    var factors = [
      { label: '모멘텀', key: 'momentum' },
      { label: '추세',   key: 'trend' },
      { label: '저변동', key: 'lowvol' },
      { label: '종합',   key: 'composite' },
    ];
    var W = 400, H = 192, out = '';
    out += _r(0, 0, W, H, C.bg, 8, C.border);
    out += _t(14, 18, '팩터 과거 검증, 순위와 수익률의 같은 방향 정도', C.text, 10, 700);
    out += _t(W - 14, 18, hasSample ? 'n=' + n : (n === 0 ? 'n=0, 표본 없음' : 'n 미수신'), C.muted, 10, 400, 'end');
    factors.forEach(function (f, i) {
      var v = num(ic[f.key]);
      var measured = hasSample && v != null;
      var y = 28 + i * 36;
      var col = !measured ? C.muted : v > 0.05 ? C.green : v > 0 ? C.cyan : v > -0.05 ? C.amber : C.red;
      var barW = Math.round(Math.abs(measured ? v : 0) * 700);
      var midX = 182;
      out += _t(14, y + 13, f.label, C.muted, 10, 600);
      out += _r(70, y + 3, 224, 12, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 2);
      out += _l(midX, y, midX, y + 18, 'color-mix(in srgb, var(--text-primary) 22%, transparent)');
      if (measured && v >= 0) {
        out += _r(midX, y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      } else if (measured) {
        out += _r(Math.max(midX - Math.min(barW, 112), 70), y + 3, Math.min(barW, 112), 12, _alphaRgb(col, 0.55), 2);
      }
      out += _t(300, y + 13, measured ? _n(v, 3) : '계산 불가', col, 10, 700);
    });
    out += _r(14, H - 46, 180, 36, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 4, C.border, 1);
    out += _t(20, H - 29, '분위 스프레드', C.muted, 10);
    out += _t(20, H - 13, hasSample && spread != null ? _n(spread, 2) + '%' : '계산 불가, 표본 없음', hasSample && spread != null ? (spread > 2 ? C.green : spread > 0 ? C.amber : C.red) : C.muted, hasSample && spread != null ? 12 : 10, 700);
    out += _r(204, H - 46, 180, 36, 'color-mix(in srgb, var(--text-primary) 6%, transparent)', 4, C.border, 1);
    out += _t(210, H - 29, '방향 적중률', C.muted, 10);
    out += _t(210, H - 13, hasSample && hit != null ? _n(hit, 1) + '%' : '계산 불가, 표본 없음', hasSample && hit != null ? (hit > 55 ? C.green : hit > 45 ? C.amber : C.red) : C.muted, hasSample && hit != null ? 12 : 10, 700);
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
        el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:12px">검증 입력 미수신, 시각화 판정 보류</div>';
        el.setAttribute('data-source-kind', 'unavailable');
        el.setAttribute('data-operational-use', 'blocked');
        return;
      }
      var fn = _fns[type];
      if (!fn) {
        el.innerHTML = '<div style="color:var(--cyan-11);font-size:12px;padding:8px">다이어그램 없음: ' + _esc(type) + '</div>';
        return;
      }
      try { el.innerHTML = fn(data || {}); }
      catch (e) { if (typeof _aioLog === 'function') _aioLog('warn', 'ui', '_aioDiagram.render 오류:' + type + ' ' + e.message); }
    },
    // AI 채팅용: SVG 문자열 반환
    getSvg: function (type, data) {
      var fn = _fns[type];
      if (!fn) return '';
      // P1551: the same unavailable guard as render() — a diagram with missing inputs draws defaults (score 0/100, MID cycle, calm VIX).
      if (data && data.available === false) return '';
      try { return fn(data || {}); } catch (e) { return ''; }
    },
    types: function () { return Object.keys(_fns); },
  };
})();

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
    var _vbr = typeof window._aioVixBandIndex === 'function' ? window._aioVixBandIndex(vix) : (vix >= 32 ? 3 : vix >= 25 ? 2 : vix >= 18 ? 1 : 0); // v57.50 C13: shared bands
    var vixScore = _vbr >= 3 ? 8 : _vbr === 2 ? 28 : _vbr === 1 ? 55 : vix >= 14 ? 78 : 92;
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

  // v57.76: _buildPrice (SPY 가격 포지션 card on the 차트 tab and its chat auto-visual) was deleted with the card; its only input
  // (window._spyPositionStats from the deleted updateTechIndicators) no longer exists.

  function _buildYield() {
    var curve = window.AIO && typeof window.AIO.getUsTreasuryCurveEvidence === 'function' ? window.AIO.getUsTreasuryCurveEvidence() : null;
    if (!curve || !curve.complete) return { available:false };
    return {
      irx:curve.threeM, twoY:curve.twoY, fvx:curve.fiveY, tnx:curve.tenY, tyx:curve.thirtyY
    };
  }

  function _buildBacktest() {
    return { backtest: (typeof _aioScreenerFactorBacktest === 'function' && _aioScreenerFactorBacktest()) || {} };
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
          // v58.80 (first-users F19): this legacy bubble drew "Technology 100%" (English, cost basis) above the native
          // 섹터 배분 card, which waits for a valuation and said "평가액이 확인되면 섹터 비중이 표시됩니다" — two answers to one
          // question (R619). The native card (src/ui/pages/portfolio.js) is the owner; the bubble stays hidden.
          var _pfWrap = document.getElementById('vis-portfolio');
          if (_pfWrap) _pfWrap.style.display = 'none';
          break;
        }
      }
    } catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ui', 'vis-phase2 render err:' + pid + ' ' + (e && e.message));
    }
  }

  var VIS_PAGES = ['home','signal','breadth','sentiment','briefing','macro','fxbond','screener','portfolio']; // v57.76: technical has no diagram slot

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

  // v58.19: Phase 3 AI 채팅 자동 시각화(_aioChatAutoVis/_autoVisRaw/_findRow)는 호출자가 0건이라 제거했다.
  // 채팅 답변 도표는 src/ui/components/ai-answer-visuals.js가 맡는다.
})();

// ── 기업분석 렌더러 — aio-chat.js에서 이동 (v51.17) ─────────────────────────────────
// _fmtNum/_fmtPct: aio-core.js window.* 공개됨 (v51.17)
var _fmtNum = window._fmtNum;
var _fmtPct = window._fmtPct;
// ── 렌더 함수들 ──────────────────────────────────────────────────

function _renderFundHeader(d) {
  var el = document.getElementById('fund-rpt-header');
  if (!el) return;
  var pctColor = d.pct != null ? (d.pct >= 0 ? 'var(--dir-up)' : 'var(--dir-down)') : 'var(--text-muted)';
  var p = d.fmpProfile || {};
  // v52.73 아이보리 3f: 시안 구조(회사명+티커/섹터/거래소 좌 · 가격+등락 우, 한 줄 리포트 헤더)
  var html = '<div class="lu-hd-row">';
  html += '<div class="lu-hd-name">';
  html += '<span class="lu-hd-title">' + escHtml(d.name || d.ticker) + '</span>';
  html += '<span class="lu-hd-sub">' + escHtml(d.ticker) + (p.sector ? ', ' + escHtml(p.sector) : '') + (p.exchangeShortName ? ', ' + escHtml(p.exchangeShortName) : '') + '</span>';
  html += '</div>';
  html += '<div class="lu-hd-quote">';
  if (d.price) {
    html += '<span class="lu-hd-last">$' + d.price.toFixed(2) + '</span>';
    html += '<span class="lu-hd-pct" style="color:' + pctColor + ';">' + _fmtPct(d.pct) + '</span>';
  }
  html += '</div></div>';

  // 보조 행 — 시가총액 · 포트폴리오/차트 액션 · 리포트 노화 배지 (시안엔 없으나 실사용 기능이라 압축된 한 줄로 유지)
  html += '<div class="lu-hd-aux">';
  if (p.mktCap) html += '<span class="lu-sm-mut">시가총액 $' + _fmtNum(p.mktCap) + '</span>';
  html += '<button data-action="_aioAddToPortfolio" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table lu-hd-btn">포트폴리오에 추가</button>';
  html += '<button data-action="_aioChartAnalyze" data-arg="' + escHtml(d.ticker) + '" class="aio-btn-table lu-hd-btn">차트 분석</button>';
  // v48.37: SCREENER_DB memo staleness 배지 (애널리스트 리포트 노화 경고)
  if (typeof window._aioStockStaleInfo === 'function') {
    var _staleInfo = window._aioStockStaleInfo(d.ticker);
    if (_staleInfo && _staleInfo.badge) {
      html += '<span class="lu-sm-mut">리포트 코멘트: ' + _staleInfo.badge + (_staleInfo.isStale ? ' <span class="lu-red">· 최신 정보 재검증 권장</span>' : '') + '</span>';
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
    descEl.innerHTML = '<span class="lu-mut">기업 소개를 아직 받지 못했습니다.</span>';
  }

  function qrow(label, text) {
    return '<div class="lu-q-row">' +
      '<span class="lu-q-lbl">' + escHtml(label) + '</span>' +
      '<span class="lu-q-txt">' + text + '</span></div>';
  }
  var rowsHtml = '';
  if (p.sector || p.industry) rowsHtml += qrow('섹터', escHtml(p.sector || '') + (p.industry ? ', ' + escHtml(p.industry) : '') + (p.country ? ', ' + escHtml(p.country) : ''));
  if (p.ceo) rowsHtml += qrow('경영진', 'CEO ' + escHtml(p.ceo) + (p.fullTimeEmployees ? ', 직원 ' + Number(p.fullTimeEmployees).toLocaleString() + '명' : ''));
  if (p.ipoDate) rowsHtml += qrow('상장', escHtml(p.ipoDate) + ' 상장' + (p.exchangeShortName ? ', ' + escHtml(p.exchangeShortName) : ''));
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
      '<div class="lu-bar-head">' +
      '<span class="lu-mut">' + escHtml(label) + '</span>' +
      '<span class="lu-bar-val" style="color:' + color + ';">' + valueText + '</span></div>' +
      '<div class="lu-bar-track">' +
      '<div class="lu-bar-fill" style="width:' + Math.max(2, Math.min(100, pct)) + '%;background:' + color + ';"></div></div></div>';
  }

  var barsHtml = '';
  if (d.price && _w52High && _w52Low && _w52High > _w52Low) {
    var _pos = ((d.price - _w52Low) / (_w52High - _w52Low)) * 100;
    _pos = Math.max(0, Math.min(100, _pos));
    var _posColor = _pos > 75 ? 'var(--data-green)' : _pos < 25 ? 'var(--data-red)' : 'var(--data-amber)';
    var _posLabel = _pos > 90 ? '52주 고가 근접' : _pos > 75 ? '상단 구간' : _pos < 10 ? '52주 저가 근접' : _pos < 25 ? '하단 구간' : '중간 구간';
    barsHtml += barRow('52주 레인지 ($' + _w52Low.toFixed(2) + ' ~ $' + _w52High.toFixed(2) + ')', _pos, _posLabel + ', ' + _pos.toFixed(0) + '%', _posColor);
  }
  if (_vol && _avgVol3M && _avgVol3M > 0) {
    var _volRatio = _vol / _avgVol3M;
    var _volLabel, _volColor;
    if (_volRatio >= 2.0) { _volLabel = '거래량 폭증'; _volColor = 'var(--data-red)'; }
    else if (_volRatio >= 1.3) { _volLabel = '거래량 상승'; _volColor = 'var(--data-amber)'; }
    else if (_volRatio < 0.5) { _volLabel = '거래량 저조'; _volColor = 'var(--text-muted)'; }
    else { _volLabel = '거래량 정상'; _volColor = 'var(--data-green)'; }
    var _vol10dRatio = (_avgVol10D && _avgVol10D > 0) ? (_vol / _avgVol10D) : null;
    barsHtml += barRow('거래량 (3개월 평균 대비, 오늘 ' + Number(_vol).toLocaleString() + '주)', Math.min(100, _volRatio * 50), _volLabel + ' ' + _volRatio.toFixed(1) + 'x' + (_vol10dRatio != null ? ', 10일 대비 ' + _vol10dRatio.toFixed(1) + 'x' : ''), _volColor);
  }
  if (p.mktCap) barsHtml += barRow('시가총액', 100, '$' + _fmtNum(p.mktCap), 'var(--text-primary)');
  barsEl.innerHTML = barsHtml || '<span class="lu-base-mut">가격 포지션 데이터 없음</span>';

  sec.style.display = 'block';
}

function _renderFundSEC(d) {
  var el = document.getElementById('fund-rpt-sec');
  var body = document.getElementById('fund-rpt-sec-body');
  if (!el || !body || !d.sec) return;
  var s = d.sec;
  // v48.91: SEC API 응답 escHtml() 처리 — XSS 방지
  var html = '<div class="lu-cols3">';
  html += '<div class="lu-fact"><span class="lu-mut">CIK:</span> ' + escHtml(s.cik||'N/A') + '</div>';
  html += '<div class="lu-fact"><span class="lu-mut">SIC:</span> ' + escHtml(s.sicDescription||'N/A') + '</div>';
  html += '<div class="lu-fact"><span class="lu-mut">거래소:</span> ' + escHtml((s.exchanges||[]).join(', ')||'N/A') + '</div>';
  html += '</div>';
  if (s.filings && s.filings.form) {
    html += '<div class="lu-h-xs4">최근 주요 공시 (10-K/10-Q/8-K/DEF 14A)</div>';
    var shown = 0;
    for (var i = 0; i < s.filings.form.length && shown < 8; i++) {
      var form = s.filings.form[i];
      if (['10-K','10-Q','8-K','DEF 14A','S-1','13F-HR'].indexOf(form) < 0) continue;
      var date = s.filings.filingDate ? s.filings.filingDate[i] : '';
      var desc = s.filings.primaryDocDescription ? s.filings.primaryDocDescription[i] : '';
      var accession = s.filings.accessionNumber ? s.filings.accessionNumber[i] : '';
      var formColor = form === '10-K' ? '#3dd68c' : form === '10-Q' ? '#4ccce6' : form === '8-K' ? '#ffa057' : '#baa7ff';
      html += '<div class="lu-filing">';
      // v48.91: SEC 공시 데이터 escHtml() 적용
      html += '<span class="lu-filing-form" style="color:' + formColor + ';">' + escHtml(form) + '</span>';
      html += '<span class="lu-filing-date">' + escHtml(date) + '</span>';
      html += '<span class="lu-filing-desc">' + escHtml(desc||'') + '</span>';
      if (accession) {
        var secUrl = 'https://www.sec.gov/Archives/edgar/data/' + (s.cik||'').replace(/^0+/,'') + '/' + accession.replace(/-/g,'') + '/' + accession + '-index.htm';
        html += '<a href="' + secUrl + '" target="_blank" class="lu-filing-link">SEC ↗</a>';
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

  // SEC XBRL 폴백 — 2026-10-17 (D8): 파생 지표는 ESM sec-statements가 한 기간·보고 통화·검증 주식 수로 계산한다.
  var sf = d.secFin || {}, sm = sf.metrics || {}, cur = sm.currency && sm.currency !== 'USD' ? sm.currency + ' ' : '$';
  function lastOf(a) { return a && a.length ? a[a.length - 1] : null; }
  var lastRev = lastOf(sf.revenue);
  function sv(item) { return item ? (item.val || item.value || 0) : 0; }
  // v49.0 P183: API Infinity/NaN → 'N/A' 가드
  var _fn = window._aioFiniteNum || function(v) { return (v != null && isFinite(v)) ? v : null; };
  var secRevVal = sv(lastRev), secNIVal = sv(lastOf(sf.netIncome)), secEpsVal = sm.eps || 0;

  var _missingCards = []; // P1591 (S09): unreceived metrics collapse into one line instead of a grid of N/A cards
  function card(label, value, sub, color) {
    if (value === 'N/A' || value === '미수신') { _missingCards.push(label); return ''; }
    return '<div class="lu-box">' +
      '<div class="lu-sm-mut">' + label + '</div>' +
      '<div class="lu-fin-v" style="color:' + (color||'var(--text-primary)') + ';">' + value + '</div>' +
      (sub ? '<div class="lu-sm-mut-t2">' + sub + '</div>' : '') + '</div>';
  }

  // 값 선택: FMP 우선, SEC XBRL 폴백
  var mktCap = p.mktCap || ev.marketCapitalization || sm.marketCap || 0;
  var peVal = m.peRatio || p.pe || sm.pe;
  var roeVal = r.returnOnEquity || sm.roe;
  var epsVal = inc.epsdiluted || secEpsVal;
  var revVal = inc.revenue || secRevVal;
  var niVal = inc.netIncome || secNIVal;
  var gmVal = r.grossProfitMargin || sm.grossMargin;
  var deVal = r.debtEquityRatio || sm.debtToEquity;
  var revYear = inc.revenue ? (inc.calendarYear || inc.date || '').slice(0,4) : (lastRev ? (lastRev.end||'').slice(0,4) : '');
  var isSEC = !inc.revenue && secRevVal; // SEC 폴백 사용 여부

  var html = '';
  html += card('시가총액', mktCap > 0 ? '$' + _fmtNum(mktCap) : 'N/A', p.sector || (isSEC ? 'SEC XBRL' : ''));
  html += card('P/E', _fn(peVal) !== null ? peVal.toFixed(1) + 'x' : 'N/A', (m.peRatio || p.pe) ? '공급자 기준' : sm.peBasis === 'ttm' ? '시가총액 ÷ 최근 4개 분기 순이익(' + String(sm.peThrough || '').slice(0, 7) + '까지)' : '시가총액 ÷ 최근 회계연도 순이익');
  html += card('ROE', _fn(roeVal) !== null ? (roeVal * 100).toFixed(1) + '%' : 'N/A', r.returnOnEquity ? '공급자 기준' : sm.roeBasis === 'average-equity' ? '순이익 ÷ 평균 자기자본(전년·당해 말)' : '순이익 ÷ 기말 자기자본');
  var vc = inc.revenue ? '$' : cur;
  html += card('EPS (최근 회계연도)', epsVal ? vc + epsVal.toFixed(2) : 'N/A', '');
  html += card('매출', revVal ? vc + _fmtNum(revVal) : 'N/A', revYear ? 'FY ' + revYear : '');
  html += card('순이익', niVal ? vc + _fmtNum(niVal) : 'N/A', '', (niVal || 0) >= 0 ? 'var(--data-green)' : 'var(--data-red)');
  html += card('Gross Margin', gmVal ? (gmVal * 100).toFixed(1) + '%' : 'N/A', '매출총이익률');
  html += card('FCF Yield', m.freeCashFlowYield ? (m.freeCashFlowYield * 100).toFixed(1) + '%' : (sm.fcfYield != null ? (sm.fcfYield * 100).toFixed(1) + '%' : 'N/A'), '잉여현금흐름 수익률');
  html += card('EV/EBITDA', _fn(m.enterpriseValueOverEBITDA) !== null ? m.enterpriseValueOverEBITDA.toFixed(1) + 'x' : 'N/A', '기업가치 대비');
  html += card('P/B', _fn(m.pbRatio) !== null ? m.pbRatio.toFixed(2) + 'x' : (sm.pb != null ? sm.pb.toFixed(2) + 'x' : 'N/A'), '주가순자산비율');
  html += card('부채비율', _fn(deVal) !== null ? deVal.toFixed(2) + 'x' : 'N/A', (!r.debtEquityRatio && sm.debtBasis === 'noncurrent+current' ? '장·단기 차입금' : '장기부채') + ' ÷ 자기자본, 업종마다 정상 범위가 다름');
  // P1164/B01: FMP profile이 없으면 배당 원천 자체가 미수신이다. 부재를 '0%'라는 실측값으로
  // 표시하지 않는다 — 실제 무배당(lastDiv===0)만 0.00%로 남는다.
  var hasDivValue = typeof p.lastDiv === 'number' && isFinite(p.lastDiv);
  var divYield = hasDivValue ? (d.price && d.price > 0 ? (p.lastDiv / d.price) * 100 : null) : null;
  html += card('배당수익률', divYield != null ? divYield.toFixed(2) + '%' : (hasDivValue ? 'N/A' : '미수신'), '연간 배당');
  if (_missingCards.length) html += '<div class="lu-span-note">아직 받지 못한 항목: ' + _missingCards.join(', ') + '</div>';

  // Codex browser audit H38: provider/setup notes (API keys, release tags) are operator information, not analysis.

  // v48.1: SEC XBRL 신규 8필드 품질/건전성 카드 추가
  //   R&D Intensity (R&D/매출), SBC 희석 (SBC/매출), SG&A 비중, Cash 포지션, 운전자본(재고/매출채권/유동부채)
  var lastRd = sv(lastOf(sf.rd)), lastSbc = sv(lastOf(sf.sbc)), lastSga = sv(lastOf(sf.sga)), lastCash = sv(lastOf(sf.cash));
  var lastInv = sv(lastOf(sf.inventory)), lastRcv = sv(lastOf(sf.receivables)), lastCurDebt = sv(lastOf(sf.currentDebt));
  var hasQuality = lastRd || lastSbc || lastSga || lastCash || lastInv || lastRcv || lastCurDebt;
  if (hasQuality) {
    var qHtml = '<div class="lu-span-h">공시 기반 — 비용 구조와 운전자본</div>';
    if (lastRd && secRevVal) {
      var rdRatio = (lastRd / secRevVal) * 100;
      qHtml += card('R&D 강도', rdRatio.toFixed(1) + '%', 'R&D / 매출' + (rdRatio > 15 ? ', 고투자' : rdRatio > 5 ? ', 양호' : ''), rdRatio > 15 ? '#4ccce6' : rdRatio > 5 ? '#3dd68c' : '#978365');
    }
    if (lastSbc && secRevVal) {
      var sbcRatio = (lastSbc / secRevVal) * 100;
      // Codex browser audit H40: SBC/revenue is an expense share, not dilution — the share count shows dilution.
      qHtml += card('주식 보상 비용 비중', sbcRatio.toFixed(1) + '%', '주식 보상 비용 ÷ 매출' + (sbcRatio > 10 ? ', 높음' : sbcRatio > 3 ? ', 중간' : '') + ' — 실제 희석은 주식 수 변화로 확인', sbcRatio > 10 ? '#ec5d5e' : sbcRatio > 3 ? '#ffa057' : '#3dd68c');
    }
    if (lastSga && secRevVal) qHtml += card('SG&A 비중', ((lastSga / secRevVal) * 100).toFixed(1) + '%', '판매관리비 / 매출');
    if (lastCash) qHtml += card('현금 포지션', cur + _fmtNum(lastCash), 'Cash & Equivalents');
    if (lastInv) qHtml += card('재고', cur + _fmtNum(lastInv), '');
    if (lastRcv) qHtml += card('매출채권', cur + _fmtNum(lastRcv), '');
    if (lastCurDebt) qHtml += card('단기 차입금', cur + _fmtNum(lastCurDebt), '1년 내 상환할 차입금');
    html += qHtml;
  }

  // v48.10: SEC XBRL Frames 섹터 백분위 순위 시각화 (수집만 하던 collected.secFrameRank UI 노출)
  //   전 US-GAAP 보고 기업 중 본 기업의 Revenues/NetIncomeLoss 순위 → 섹터 내 상대 위치 정량화
  var _sfr = d.secFrameRank || null;
  if (_sfr && (_sfr.revenue || _sfr.netIncome)) {
    var rankHtml = '<div class="lu-span-top">';
    rankHtml += '<div class="lu-split8">';
    rankHtml += '<div class="lu-h-base">공시 기업 내 순위</div>';
    rankHtml += '<div class="lu-xs-mut">전 US-GAAP 보고 기업 대비</div>';
    rankHtml += '</div>';
    function _rankCard(title, rr, unit) {
      if (!rr || rr.myVal == null) return '';
      var topPct = rr.pctile != null ? (100 - rr.pctile) : null;
      var topColor = topPct != null && topPct <= 5 ? '#33b074' : topPct != null && topPct <= 25 ? '#3dd68c' : topPct != null && topPct <= 50 ? '#ffa057' : '#ec5d5e';
      var topLabel = topPct != null ? ('상위 ' + topPct.toFixed(1) + '%') : '';
      var rankLabel = rr.rank != null ? ('Rank ' + rr.rank + ' / ' + rr.n) : '';
      var myValStr = (unit === 'USD' || !unit) ? '$' + _fmtNum(rr.myVal) : rr.myVal.toFixed(2) + (unit||'');
      var avgStr = '$' + _fmtNum(rr.avg);
      var medStr = '$' + _fmtNum(rr.median);
      var html = '<div class="lu-box">';
      html += '<div class="lu-xs-mut-b">' + title + ' (' + (rr.period||'') + ')</div>';
      html += '<div class="lu-split-base4">';
      html += '<span class="lu-rank-val">' + myValStr + '</span>';
      html += '<span class="lu-rank-top" style="color:' + topColor + ';">' + topLabel + '</span>';
      html += '</div>';
      html += '<div class="lu-xs-mut-t3">' + rankLabel + '</div>';
      html += '<div class="lu-rank-meta">';
      html += '<span>평균 ' + avgStr + '</span>';
      html += '<span>중위수 ' + medStr + '</span>';
      html += '</div>';
      html += '</div>';
      return html;
    }
    rankHtml += '<div class="lu-fit240">';
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
    var recHtml = '<div class="lu-span-top">';
    recHtml += '<div class="lu-split10">';
    recHtml += '<div class="lu-h-base">애널리스트 컨센서스</div>';
    if (_fhRec && _fhRec.period) recHtml += '<div class="lu-xs-mut">Finnhub, ' + _fhRec.period + '</div>';
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
        if (_bullish / _total >= 0.6) { _verdict = '매수 우세'; _verdictColor = '#33b074'; }
        else if (_bullish / _total >= 0.4) { _verdict = '완만 매수'; _verdictColor = '#3dd68c'; }
        else if (_bearish / _total >= 0.4) { _verdict = '매도 우세'; _verdictColor = '#ec5d5e'; }
        else { _verdict = '중립'; _verdictColor = '#ffa057'; }
        recHtml += '<div class="lu-split6-sm">';
        recHtml += '<span class="lu-mut">총 ' + _total + '명 애널리스트</span>';
        recHtml += '<span class="lu-verdict" style="background:' + _verdictColor + '22;border:0.5px solid ' + _verdictColor + ';color:' + _verdictColor + ';">' + _verdict + '</span>';
        recHtml += '</div>';
        // 누적 바 (height 22px)
        recHtml += '<div class="lu-rec-bar">';
        if (_sb > 0) recHtml += '<div class="lu-rec-seg lu-rec-sb" style="width:' + _pSB + '%;" title="Strong Buy ' + _sb + '명">' + (parseFloat(_pSB) >= 8 ? _sb : '') + '</div>';
        if (_b > 0)  recHtml += '<div class="lu-rec-seg lu-rec-b" style="width:' + _pB  + '%;" title="Buy ' + _b + '명">' + (parseFloat(_pB) >= 8 ? _b : '') + '</div>';
        if (_h > 0)  recHtml += '<div class="lu-rec-seg lu-rec-h" style="width:' + _pH  + '%;" title="Hold ' + _h + '명">' + (parseFloat(_pH) >= 8 ? _h : '') + '</div>';
        if (_s > 0)  recHtml += '<div class="lu-rec-seg lu-rec-s" style="width:' + _pS  + '%;" title="Sell ' + _s + '명">' + (parseFloat(_pS) >= 8 ? _s : '') + '</div>';
        if (_ss > 0) recHtml += '<div class="lu-rec-seg lu-rec-ss" style="width:' + _pSS + '%;" title="Strong Sell ' + _ss + '명">' + (parseFloat(_pSS) >= 8 ? _ss : '') + '</div>';
        recHtml += '</div>';
        // 범례
        recHtml += '<div class="lu-rec-legend">';
        recHtml += '<span><span class="lu-sw lu-rec-sb"></span>Strong Buy ' + _sb + ' (' + _pSB + '%)</span>';
        recHtml += '<span><span class="lu-sw lu-rec-b"></span>Buy ' + _b + ' (' + _pB + '%)</span>';
        recHtml += '<span><span class="lu-sw lu-rec-h"></span>Hold ' + _h + ' (' + _pH + '%)</span>';
        recHtml += '<span><span class="lu-sw lu-rec-s"></span>Sell ' + _s + ' (' + _pS + '%)</span>';
        recHtml += '<span><span class="lu-sw lu-rec-ss"></span>Strong Sell ' + _ss + ' (' + _pSS + '%)</span>';
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
        var _upColor = _upside >= 15 ? '#33b074' : _upside >= 0 ? '#3dd68c' : _upside >= -10 ? '#ffa057' : '#ec5d5e';
        recHtml += '<div class="lu-tgt-row">';
        recHtml += '<span class="lu-b-sec">FMP 목표가 컨센서스</span>';
        recHtml += '<span class="lu-tgt-v" style="color:' + _upColor + ';">$' + _tgtC.toFixed(2) + '</span>';
        recHtml += '<span class="lu-tgt-up" style="background:' + _upColor + '22;border:0.5px solid ' + _upColor + ';color:' + _upColor + ';">' + (_upside >= 0 ? '+' : '') + _upside.toFixed(1) + '% upside</span>';
        if (_tgtH && _tgtL) recHtml += '<span class="lu-mut">범위 $' + _tgtL.toFixed(2) + ' ~ $' + _tgtH.toFixed(2) + '</span>';
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
      meta.textContent = (data.dataSource || 'FMP') + ', period=' + (data.period || 'quarter') + (data.latestQuarter ? (', 기준일 ' + data.latestQuarter) : '');
    } else {
      meta.textContent = (data && data.dataSource) ? (data.dataSource + ', ' + (data.reason || '데이터 부재')) : '데이터 부재 — 외부 확인 권장';
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
    if (vc) vc.innerHTML = '<div class="lu-span-empty">5년 분기 데이터 부재 — 외부 확인 권장</div>';
    if (cb) cb.textContent = (data && data.reason) || '데이터 미수신';
    return;
  }

  var COLORS = {
    rev: '#4ccce6', op: '#ffa057', net: '#3dd68c',
    opM: '#ffa057', netM: '#3dd68c', roe: '#ab4aba',
    assets: '#ffa057', liab: '#ec5d5e', equity: '#3dd68c',
    opCF: '#3dd68c', invCF: '#ec5d5e', finCF: '#ab4aba',
    cash: '#3dd68c', curLiab: '#ffa057', totLiab: '#ec5d5e',
    recv: '#8ec8f6', inv: '#4ccce6', curAssets: '#3dd68c'
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-growth-chart', c1);
  }
  var tg = document.getElementById('fund-growth-table');
  if (tg) {
    tg.innerHTML = gRev.labels.map(function(lab, i){
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>R ' + _fmt(gRev.values[i]) + ', O ' + _fmt(gOp.values[i]) + ', N ' + _fmt(gNI.values[i]) + '</span></div>';
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return v.toFixed(1) + '%'; } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-profitability-chart', c2);
  }
  var tp = document.getElementById('fund-profitability-table');
  if (tp) {
    tp.innerHTML = pOpM.labels.map(function(lab, i){
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>OpM ' + _pct(pOpM.values[i]) + ', NM ' + _pct(pNetM.values[i]) + ', ROE ' + _pct(pROE.values[i]) + '</span></div>';
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-balance-chart', c3);
  }
  var tb = document.getElementById('fund-balance-table');
  if (tb) {
    tb.innerHTML = bA.labels.map(function(lab, i){
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>A ' + _fmt(bA.values[i]) + ', L ' + _fmt(bL.values[i]) + ', E ' + _fmt(bE.values[i]) + '</span></div>';
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-cashflow-chart', c4);
  }
  var tc = document.getElementById('fund-cashflow-table');
  if (tc) {
    tc.innerHTML = cOp.labels.map(function(lab, i){
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>Op ' + _fmt(cOp.values[i]) + ', Inv ' + _fmt(cIn.values[i]) + ', Fin ' + _fmt(cFi.values[i]) + '</span></div>';
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return _fmt(v); } } } } }
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
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>Cash ' + _fmt(lCash.values[i]) + ', CL ' + _fmt(lCL.values[i]) + ', TL ' + _fmt(lTL.values[i]) + '</span></div>';
    }).join('') + (curRatio != null ? '<div class="lu-ratio-note">Current Ratio: <strong>' + curRatio.toFixed(2) + 'x</strong>, ' + (curRatio >= 2 ? '강건' : curRatio >= 1 ? '정상' : '주의') + '</div>' : '');
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#d8d0bf', font: { size: 12 } } } }, scales: { x: { ticks: { color: '#b9a88d', font: { size: 12 } } }, y: { ticks: { color: '#b9a88d', font: { size: 12 }, callback: function(v){ return _fmt(v); } } } } }
    });
    if (window._aioChartRegistry) window._aioChartRegistry.register('fund-workingcap-chart', c6);
  }
  var tw = document.getElementById('fund-workingcap-table');
  if (tw) {
    tw.innerHTML = wR.labels.map(function(lab, i){
      return '<div class="lu-ln-dot"><span>' + lab + '</span><span>R ' + _fmt(wR.values[i]) + ', I ' + _fmt(wI.values[i]) + ', CA ' + _fmt(wA.values[i]) + '</span></div>';
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
      return '<div class="lu-val-tile">' +
        '<div class="lu-sm-mut">' + label + '</div>' +
        '<div class="lu-val-tile-v" style="color:' + color + ';">' + (val != null && isFinite(val) ? Number(val).toFixed(2) + 'x' : '—') + '</div>' +
      '</div>';
    }
    vcards.innerHTML = _vCard('P/E', pe, '#4ccce6') + _vCard('P/B', pb, '#ffa057') + _vCard('P/S', ps, '#3dd68c');
  }
  var basis = document.getElementById('fund-calc-basis');
  if (basis) {
    var ld = (window._liveData || {})[data.ticker] || {};
    var lastClose = ld.price != null ? ld.price : null;
    var latestEps = data.income && data.income[0] && (data.income[0].eps || data.income[0].epsdiluted);
    basis.innerHTML = '<div class="lu-basis-sep">' +
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
    html += '<div class="lu-scrollx"><table class="lu-tbl-xs">';
    html += '<tr class="lu-bb">';
    html += '<th class="lu-th-l6b">항목</th>';
    years.forEach(function(y) { html += '<th class="lu-th-r6b">' + (y.calendarYear || (y.date||'').slice(0,4)) + '</th>'; });
    html += '</tr>';

    function row(label, key, isCurrency) {
      var r = '<tr class="lu-bb2">';
      r += '<td class="lu-td-lbl">' + label + '</td>';
      years.forEach(function(y) {
        var v = y[key];
        var color = v != null && v < 0 ? '#ec5d5e' : 'var(--text-primary)';
        r += '<td class="lu-td56" style="color:' + color + ';">' + (isCurrency ? '$' : '') + _fmtNum(v) + '</td>';
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
    html += '<tr class="lu-bt2"><td class="lu-td-acc">매출 성장률</td>';
    years.forEach(function(y, i) {
      if (i === 0) { html += '<td class="lu-td-r-mut">—</td>'; return; }
      var prev = years[i-1].revenue;
      var cur = y.revenue;
      var growth = prev ? ((cur - prev) / Math.abs(prev) * 100) : 0;
      var gc = growth >= 0 ? '#3dd68c' : '#ec5d5e';
      html += '<td class="lu-td56-b" style="color:' + gc + ';">' + _fmtPct(growth) + '</td>';
    });
    html += '</tr>';

    html += '</table></div>';
  } else if (d.secFin && d.secFin.revenue && d.secFin.revenue.length > 0) {
    // SEC XBRL 폴백
    html += '<div class="lu-xs-mut-b6">SEC EDGAR XBRL 기반 (10-K 연간)</div>';
    html += '<div class="lu-scrollx"><table class="lu-tbl-xs">';
    html += '<tr class="lu-bb">';
    html += '<th class="lu-th-l6">항목</th>';
    d.secFin.revenue.forEach(function(r) { html += '<th class="lu-th-r6m">' + (r.year || (r.end||'').slice(0,4)) + '</th>'; });
    html += '</tr>';

    function secRow(label, arr) {
      var r = '<tr class="lu-bb2">';
      r += '<td class="lu-td-lbl">' + label + '</td>';
      // 2026-10-17 (D8): columns follow the revenue years; a year the field was not filed reads '—', amounts in the report currency.
      d.secFin.revenue.forEach(function(y) {
        var v = (arr || []).filter(function(x) { return x.end === y.end; })[0], val = v ? v.val : null;
        r += '<td class="lu-td56' + (val < 0 ? ' lu-neg' : ' lu-pri') + '">' + (val == null ? '—' : (d.secFin.currency && d.secFin.currency !== 'USD' ? d.secFin.currency + ' ' : '$') + _fmtNum(val)) + '</td>';
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
    html += '<div class="lu-empty15">재무제표 데이터 없음</div>';
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

  var html = '<div class="lu-cols2">';

  // 좌측: 밸류에이션 지표 (TTM 우선)
  html += '<div>';
  html += '<div class="lu-h-xs">핵심 배수' + (hasTTM ? ' <span class="lu-tag-ttm">TTM</span>' : ' <span class="lu-tag-ann">Annual</span>') + '</div>';
  function valRow(label, val, bench) {
    return '<div class="lu-val-row">' +
      '<span class="lu-sec">' + label + '</span>' +
      '<span class="lu-val-v">' + val + '</span></div>';
  }
  // v49.0 P183: _fv/_fn으로 || 0 패턴 제거 (0.0x 오표시·Infinityx 방지)
  var _pe = _fv(mt.peRatioTTM, ma.peRatio); html += valRow('P/E (TTM)', _pe !== null ? _pe.toFixed(1) + 'x' : 'N/A');
  // 2026-10-19: no 'Forward P/E' row — the profile pe is trailing; the forward multiple is on the consensus card.
  var _pb = _fv(mt.priceToBookRatioTTM, ma.pbRatio); html += valRow('P/B', _pb !== null ? _pb.toFixed(2) + 'x' : 'N/A');
  var _ps = _fv3(mt.priceToSalesRatioTTM, ma.priceToSalesRatio, ra.priceToSalesRatio); html += valRow('P/S', _ps !== null ? _ps.toFixed(2) + 'x' : 'N/A');
  var _eveb = _fv(mt.enterpriseValueOverEBITDATTM, ma.enterpriseValueOverEBITDA); html += valRow('EV/EBITDA', _eveb !== null ? _eveb.toFixed(1) + 'x' : 'N/A');
  var _evs = _fv(mt.evToSalesTTM, ma.evToSales); html += valRow('EV/Sales', _evs !== null ? _evs.toFixed(2) + 'x' : 'N/A');
  // Codex browser audit H39: two PEGs (here and the filing-based one above) use different growth inputs.
  html += valRow('PEG (공급자 계산, 성장률 기준 별도)', _fn(rt.pegRatioTTM) !== null ? rt.pegRatioTTM.toFixed(2) + 'x' : 'N/A');
  html += valRow('FCF Yield', _fn(mt.freeCashFlowYieldTTM) !== null ? (mt.freeCashFlowYieldTTM * 100).toFixed(1) + '%' : (_fn(ma.freeCashFlowYield) !== null ? (ma.freeCashFlowYield * 100).toFixed(1) + '%' : 'N/A'));
  html += '</div>';

  // 우측: 수익성 지표 (TTM 우선)
  html += '<div>';
  html += '<div class="lu-h-xs">수익성 & 효율성' + (hasTTM ? ' <span class="lu-tag-ttm">TTM</span>' : ' <span class="lu-tag-ann">Annual</span>') + '</div>';
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
  var html = '<div class="lu-wrap6">';
  d.peers.slice(0, 12).forEach(function(p) {
    html += '<div class="lu-peer" data-action="_aioFundSearchFill" data-arg="' + escHtml(p) + '">' + p + '</div>';
  });
  html += '</div>';
  html += '<div class="lu-sm-mut-t6">클릭하면 해당 기업 분석으로 이동합니다</div>';
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
    html += '<div class="lu-mb10">';
    html += '<div class="lu-h-sm">향후 어닝 일정 (Finnhub, v48.10)</div>';
    html += '<div class="lu-fit170">';
    d.finnhubEarnings.slice(0, 5).forEach(function(e) {
      var hourLabel = e.hour === 'bmo' ? '장전' : e.hour === 'amc' ? '장후' : e.hour === 'dmh' ? '장중' : '';
      var quarter = (e.year && e.quarter) ? (e.year + ' Q' + e.quarter) : '';
      html += '<div class="lu-earn-box">';
      html += '<div class="lu-split-base">';
      html += '<span class="lu-earn-date">' + (e.date || '-') + '</span>';
      if (hourLabel) html += '<span class="lu-earn-hour">' + hourLabel + '</span>';
      html += '</div>';
      if (quarter) html += '<div class="lu-xs-mut-t3">' + quarter + '</div>';
      if (e.epsEstimate != null) html += '<div class="lu-xs-sec-t3">예상 EPS $' + Number(e.epsEstimate).toFixed(2) + '</div>';
      if (e.revenueEstimate != null) html += '<div class="lu-xs-sec">예상 매출 $' + _fmtNum(e.revenueEstimate) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 기존 서프라이즈 테이블 (FMP)
  if (hasSurprises) {
    if (hasUpcoming) html += '<div class="lu-h-sm-sep8">과거 서프라이즈 (FMP)</div>';
    html += '<div class="lu-scrollx"><table class="lu-tbl-sm">';
    html += '<tr class="lu-bb"><th class="lu-th-l6x">분기</th><th class="lu-th-r6">실제 EPS</th><th class="lu-th-r6">예상 EPS</th><th class="lu-th-r6">서프라이즈</th></tr>';
    d.fmpSurprises.forEach(function(s) {
      var diff = s.actualEarningResult - s.estimatedEarning;
      var pct = s.estimatedEarning != null && isFinite(s.estimatedEarning) && s.estimatedEarning !== 0 ? (diff / Math.abs(s.estimatedEarning) * 100) : null; // no estimate: no figure, not 0%
      var c = diff >= 0 ? '#3dd68c' : '#ec5d5e';
      var label = diff >= 0 ? 'Beat' : 'Miss';
      html += '<tr class="lu-bb2">';
      html += '<td class="lu-td6-lbl">' + (s.date||'') + '</td>';
      html += '<td class="lu-td6-v">$' + (s.actualEarningResult||0).toFixed(2) + '</td>';
      html += '<td class="lu-td6-vm">$' + (s.estimatedEarning||0).toFixed(2) + '</td>';
      html += '<td class="lu-td6-b" style="color:' + c + ';">' + (pct === null ? '—' : label + ' ' + _fmtPct(pct)) + '</td>';
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
    html += '<div class="lu-news">';
    html += '<div class="lu-news-head">';
    html += '<a href="' + escHtml(urlSafe) + '" target="_blank" rel="noopener" class="lu-news-title">' + headlineSafe + '</a>';
    html += '<span class="lu-news-age">' + ageLabel + '</span>';
    html += '</div>';
    html += '<div class="lu-news-body">';
    html += '<span class="lu-news-sum">' + summarySafe + '</span>';
    html += '</div>';
    html += '<div class="lu-sm-mut-t3">' + sourceSafe + ', ' + (n.date || '') + '</div>';
    html += '</div>';
  });
  if (d.finnhubNews.length > 10) {
    html += '<div class="lu-news-more">+ ' + (d.finnhubNews.length - 10) + '건 더 (최신 14일)</div>';
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
  html += '• <b>AI 분석:</b> 위 수집 데이터를 GPT-6 Luna에 전달하여 17개 관점 종합 분석';
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
  var html = '<div class="lu-scrollx">';
  html += '<table class="lu-tbl-sm">';

  // 헤더 (연도)
  html += '<thead><tr class="lu-bb2x">';
  html += '<th class="lu-mp-th-l">지표</th>';
  years.forEach(function(y) {
    html += '<th class="lu-mp-th-r">' + y + '</th>';
  });
  html += '</tr></thead><tbody>';

  // 행 렌더링
  rows.forEach(function(row, ri) {
    var bg = (ri % 2 === 0) ? 'var(--surface-1)' : 'transparent';
    html += '<tr class="lu-bb2" style="background:' + bg + ';">';
    html += '<td class="lu-mp-td">' +
      '<div class="lu-sm-b-sec">' + row.label + '</div>' +
      '<div class="lu-sm-mut">' + row.sub + '</div>' +
      '</td>';
    // 최대 years.length 열
    for (var ci = 0; ci < years.length; ci++) {
      var val = (ci < row.vals.length) ? row.vals[ci] : null;
      var formatted = row.fmt(val);
      var color = row.colorFn ? row.colorFn(val) : 'var(--text-primary)';
      html += '<td class="lu-mp-td-v" style="color:' + color + ';">' + formatted + '</td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // 데이터 소스 표시
  // Codex browser audit H38: say what the table covers and why a cell is empty, not which key is unset.
  html += '<div class="lu-xs-mut-t6">연간 자료, 최신 연도가 왼쪽, 공시에서 얻지 못한 항목은 N/A</div>';

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
    html += '<div class="lu-tile">' +
      '<div class="lu-tile-lbl">EPS Beat율</div>' +
      '<div class="lu-tile-v" style="color:' + beatColor + ';">' + beatRate + '%</div>' +
      '<div class="lu-xs-mut">최근 ' + surprises.length + '분기</div></div>';
    html += '<div class="lu-tile">' +
      '<div class="lu-tile-lbl">평균 서프라이즈</div>' +
      '<div class="lu-tile-v ' + (avgSurprise >= 0 ? 'lu-up' : 'lu-dn') + '">' +
      (avgSurprise >= 0 ? '+' : '') + avgSurprise.toFixed(1) + '%</div>' +
      '<div class="lu-xs-mut">EPS 컨센서스 대비</div></div>';
    html += '<div class="lu-tile">' +
      '<div class="lu-tile-lbl">최근 서프라이즈</div>' +
      '<div class="lu-tile-v ' + (lastDiff >= 0 ? 'lu-up' : 'lu-dn') + '">' +
      (lastDiff >= 0 ? 'Beat' : 'Miss') + ' ' + (lastDiff >= 0 ? '+' : '') + lastPct.toFixed(1) + '%</div>' +
      '<div class="lu-xs-mut">' + (last.date || '').slice(0, 7) + '</div></div>';
    html += '</div>';

    // ── 2. EPS 분기 흐름 테이블 ──
    var sorted = surprises.slice().reverse(); // 오름차순
    html += '<div class="lu-h-sm">EPS 분기별 흐름</div>';
    html += '<div class="lu-scrollx"><table class="lu-tbl-sm-b8">';
    html += '<tr class="lu-bb">' +
      '<th class="lu-th-l58">분기</th>' +
      '<th class="lu-th-r56">예상 EPS</th>' +
      '<th class="lu-th-r56">실제 EPS</th>' +
      '<th class="lu-th-r56">QoQ 변화</th>' +
      '<th class="lu-th-r56">서프라이즈</th></tr>';
    sorted.forEach(function(s, idx) {
      var prev = idx > 0 ? sorted[idx - 1].actualEarningResult : null;
      var qoq = (prev !== null) ? s.actualEarningResult - prev : null;
      var diff = s.actualEarningResult - s.estimatedEarning;
      var diffPct = s.estimatedEarning ? (diff / Math.abs(s.estimatedEarning) * 100) : 0;
      var beatC = diff >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      var qoqC = qoq === null ? 'var(--text-muted)' : qoq >= 0 ? 'var(--data-green)' : 'var(--data-red)';
      html += '<tr class="lu-bb2">';
      html += '<td class="lu-td58-lbl">' + (s.date || '').slice(0, 7) + '</td>';
      html += '<td class="lu-td56">$' + (s.estimatedEarning || 0).toFixed(2) + '</td>';
      html += '<td class="lu-td56-b">$' + (s.actualEarningResult || 0).toFixed(2) + '</td>';
      html += '<td class="lu-td56" style="color:' + qoqC + ';">' +
        (qoq === null ? '—' : (qoq >= 0 ? '+' : '') + '$' + qoq.toFixed(2)) + '</td>';
      html += '<td class="lu-td56-beat" style="color:' + beatC + ';">' +
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

    html += '<div class="lu-h-sm-sep10">YoY 재무 분해 (' + prevY + ' → ' + curY + ')</div>';
    html += '<div class="lu-scrollx"><table class="lu-tbl-sm">';
    html += '<tr class="lu-bb"><th class="lu-th-l58">항목</th>' +
      '<th class="lu-th-r56">' + prevY + '</th>' +
      '<th class="lu-th-r56">' + curY + '</th>' +
      '<th class="lu-th-r56">YoY</th></tr>';
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
      html += '<tr class="lu-bb2" style="background:' + bg + ';">';
      html += '<td class="lu-td58-h">' + row.label + '</td>';
      html += '<td class="lu-td56-mut">' + bFmt + '</td>';
      html += '<td class="lu-td56-sb">' + aFmt + '</td>';
      html += '<td class="lu-td56-b" style="color:' + chgC + ';">' + chgStr + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
    html += '<div class="lu-xs-mut-t5">마진 변화: bps(1%=100bps), 소스: FMP Annual 손익계산서</div>';
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
      var barColors = diffs2.map(function(dv) { return dv >= 0 ? 'rgba(61,214,140,0.75)' : 'rgba(236,93,94,0.75)'; });
      var ctx2 = (window._aioSetupCanvas) ? window._aioSetupCanvas(canvas, canvas.offsetWidth || 400, canvas.offsetHeight || 220) : canvas.getContext('2d');  // v48.96 P2-3: DPR
      var _newChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: '예상 EPS', data: estimates, type: 'line', borderColor: 'rgba(59,158,255,0.7)',
              backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3],
              pointRadius: 3, pointBackgroundColor: 'rgba(59,158,255,0.9)', tension: 0.3, order: 1 },
            { label: '실제 EPS', data: actuals, backgroundColor: barColors,
              borderColor: barColors.map(function(c) { return c.replace('0.75', '1'); }),
              borderWidth: 1, borderRadius: 3, order: 2 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: '#b9a88d', font: { size: 12 }, boxWidth: 12 } },
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
            x: { ticks: { color: '#b9a88d', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#b9a88d', font: { size: 12 },
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
    startX=e.clientX; startY=e.clientY;
    var r=btn.getBoundingClientRect();
    origX=r.left; origY=r.top;
    btn.style.cursor='grabbing';
    btn.style.transition='box-shadow .2s';
    btn.style.boxShadow='0 6px 25px var(--black-a7)';
    e.preventDefault();
  }
  function onMove(e){
    if(!isDragging) return;
    var dx=e.clientX-startX, dy=e.clientY-startY;
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
    btn.style.boxShadow='0 4px 15px var(--black-a6)';
    if(!hasMoved) openGlossary();
  }
  btn.addEventListener('mousedown',onStart);
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onEnd);
})();


// ═══════════════════════════════════════════════════════════════════════════════
// P1132/R619: index.html 인라인 블록 F(3,106줄 — 용어사전 시스템, 스크롤탑,
// GMO 글로벌 개요, 키보드 단축키/내비, 티커 가격 차트, 종합 기술적 분석 엔진(Weinstein/추세/
// VCP/Minervini 등 — 미국 종목 심층 분석 analyzeTickerDeep는 P1753 퇴역), KR VKOSPI·건강도·수급 차트, KR 기술
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
var _GLOSSARY_GROUPS = [['기초·회계', ['기초', '금융수학·통계', '회계·재무제표']], ['거시·금리·외환', ['경제', '경제 기본', '거시·돈', '거시', '외환', '채권']], ['시장·차트·전략', ['기술적분석', '기술', '전략', '시장·밸류에이션']], ['옵션', ['옵션']], ['한국', ['한국시장', '한국 기업·시장']], ['산업', ['은행', '보험', '부동산·리츠', '소비·유통', '소프트웨어·플랫폼', '바이오·의료', '에너지·화학·소재', '운송·물류', '농업·식품', '반도체·AI 인프라']], ['배경·심화', ['배경지식', '심화']]];
function _glossaryGroupOf(cat) { for (var i = 0; i < _GLOSSARY_GROUPS.length; i++) if (_GLOSSARY_GROUPS[i][1].indexOf(cat) !== -1) return _GLOSSARY_GROUPS[i][0]; return '기타'; }
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
  if (title) title.textContent = '투자 용어 사전, ' + GLOSSARY.length + '개';
  modal._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(modal, window._aioCloseGlossary) : null;
  if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) searchInput.focus(); // run-3 phone #21: on touch the keyboard covered half the list
}

function renderGlossaryCats() {
  // P1248: 분류 버튼을 수동 목록이 아닌 GLOSSARY 레지스트리에서 생성한다 —
  // 데이터에만 있는 분류(기술/심화 등)가 필터에서 누락되지 않는다(구 LC-56).
  // P1599 (F113): 28 raw categories mixed subject, industry and difficulty on four rows; seven reader groups replace them (each item keeps its own category tag).
  var counts = {}; GLOSSARY.forEach(function(g) { var k = _glossaryGroupOf(g.cat); counts[k] = (counts[k] || 0) + 1; });
  var cats = ['all'].concat(_GLOSSARY_GROUPS.map(function(r) { return r[0]; }), ['기타']).filter(function(c) { return c === 'all' || counts[c]; });
  var html = '';
  cats.forEach(function(c) {
    var active = c === _glossaryCat;
    var label = (c === 'all' ? '전체' : c) + ' ' + (c === 'all' ? GLOSSARY.length : counts[c]);
    html += '<button data-action="_aioGlossaryCat" data-arg="' + escHtml(c) + '" aria-pressed="' + active + '" class="lu-gl-cat">' + escHtml(label) + '</button>';
  });
  document.getElementById('glossary-cats').innerHTML = html;
}

function renderGlossaryItems(query) {
  var q = (query||'').toLowerCase().trim();
  function matches(g) {
    if (!q) return true;
    if (g.term.toLowerCase().indexOf(q) !== -1) return true;
    if (g.alias && g.alias.toLowerCase().indexOf(q) !== -1) return true;
    return g.def.toLowerCase().indexOf(q) !== -1;
  }
  var filtered = GLOSSARY.filter(function(g) {
    if (_glossaryCat !== 'all' && _glossaryGroupOf(g.cat) !== _glossaryCat) return false;
    return matches(g);
  }); if (q) { var _rank = function(g) { var t = g.term.toLowerCase(); return t === q ? 0 : t.indexOf(q) === 0 ? 1 : t.indexOf(q) !== -1 ? 2 : 3; }; filtered.sort(function(a, b) { return _rank(a) - _rank(b); }); } // v57.55 (2b): the searched term itself first
  // P1248: 검색이 선택 분류 안에서만 이뤄진다는 사실을 드러내고, 선택 분류에서 0건이면
  // 전체 검색으로 자동 전환한다(구 LC-56 — "차트분석에서 RRG 검색 0건" 혼동 방지).
  var scopeNote = '';
  if (q && _glossaryCat !== 'all') {
    if (filtered.length === 0) {
      var global = GLOSSARY.filter(matches);
      if (global.length > 0) {
        scopeNote = '‘' + _glossaryCat + '’ 분류에서 0건이라 전체에서 검색한 결과입니다.';
        _glossaryCat = 'all';
        renderGlossaryCats();
        filtered = global;
      } else {
        scopeNote = '‘' + _glossaryCat + '’ 분류와 전체 모두에서 0건입니다.';
      }
    } else {
      scopeNote = '‘' + _glossaryCat + '’ 분류 안에서 검색 중입니다 — 전체 검색은 ‘전체’를 선택하세요.';
    }
  }
  var html = '';
  if (scopeNote) {
    html += '<div role="status" class="lu-gl-scope">' + escHtml(scopeNote) + '</div>';
  }
  if (filtered.length === 0) {
    html += '<div class="lu-gl-empty">검색 결과가 없습니다</div>';
  } else {
    // v58.53 개편 v2 (3h): each entry is a disclosure row (term · 분류 · 첫 문장); opened, it reads definition →
    // formula → 한계 → "이 개념이 쓰이는 화면" (parts from src/ui/knowledge/glossary-bridge.js, cut from the entry's own text).
    var partsOf = typeof window._aioGlossaryEntryParts === 'function' ? window._aioGlossaryEntryParts : null;
    filtered.forEach(function(g, index) {
      var parts = null;
      try { parts = partsOf ? partsOf(g) : null; } catch (_e) { parts = null; }
      var lead = parts && parts.lead.length ? parts.lead.join(' ') : g.def;
      html += '<details class="aio-glossary-item"' + (q && index === 0 ? ' open' : '') + '>';
      html += '<summary class="lu-gl-head">';
      html += '<span class="aio-glossary-term">' + escHtml(g.term) + '</span>';
      html += '<span class="lu-gl-tag">' + escHtml(g.cat) + '</span>';
      html += '<span class="lu-gl-first">' + escHtml(lead) + '</span>';
      html += '</summary>';
      html += '<div class="lu-gl-def">';
      html += '<p class="lu-gl-lead">' + escHtml(lead) + '</p>';
      if (parts) {
        parts.formulas.forEach(function(f) { html += '<div class="lu-gl-formula">' + escHtml(f) + '</div>'; });
        if (parts.limits.length) html += '<p class="lu-gl-limits"><b>한계, 주의</b> ' + escHtml(parts.limits.join(' ')) + '</p>';
        if (parts.screens.length || parts.conceptId) {
          html += '<div class="lu-gl-used"><span class="lu-gl-used-label">이 개념이 쓰이는 화면</span>';
          parts.screens.forEach(function(s) { html += '<button type="button" class="lu-gl-route" data-action="_aioGlossaryOpenScreen" data-arg="' + escHtml(s.route) + '">' + escHtml(s.label) + '</button>'; });
          if (parts.conceptId) html += '<button type="button" class="lu-gl-route" data-action="_aioGlossaryOpenConcept" data-arg="' + escHtml(parts.conceptId) + '">리서치, 개념 사전</button>';
          html += '</div>';
        }
        if (parts.basis) html += '<p class="lu-gl-basis">근거, ' + escHtml(parts.basis) + '</p>';
      }
      html += '</div>';
      html += '</details>';
    });
  }
  var body = document.getElementById('glossary-body');
  body.innerHTML = html;
  if (!body._aioSingleOpen) {
    body._aioSingleOpen = true;
    // single-open accordion: opening one entry folds the others (toggle does not bubble, so listen in capture)
    body.addEventListener('toggle', function(e) {
      var item = e.target;
      if (!item || !item.open || !item.classList || !item.classList.contains('aio-glossary-item')) return;
      body.querySelectorAll('details.aio-glossary-item[open]').forEach(function(other) { if (other !== item) other.open = false; });
    }, true);
  }
}

function filterGlossary(val) { renderGlossaryItems(val); }

// v33.0: 통합 분석 모드 — 레벨 선택 UI 없음, 항상 전문가급 통합 분석
// Insight box 펼침/접기 토글
document.querySelectorAll('.insight-box').forEach(function(el) {
  el.addEventListener('click', function() { this.classList.toggle('box-collapsed'); });
});
// v38.8: 첫 방문 시 insight-box를 펼친 상태로 표시 (핵심 설명 노출)
// v58.63 (architecture audit A19): a browser that refuses storage threw from this top-level IIFE and stopped the rest of
// the file — the keyboard listener, theme restore and _aioOpenStockSearch were never registered. Only the visit record
// and the old-key cleanup are skipped when storage is refused.
(function() {
  var firstVisit = false;
  try {
    firstVisit = !localStorage.getItem('aio_visited');
    if (firstVisit) localStorage.setItem('aio_visited', '1');
  } catch (_) { firstVisit = false; }
  if (firstVisit) {
    document.querySelectorAll('.insight-box.box-collapsed').forEach(function(el) {
      el.classList.remove('box-collapsed');
    });
  }
})();
// 이전 localStorage 키 정리
(function() {
  try {
    if (localStorage.getItem('aio_beginner')) localStorage.removeItem('aio_beginner');
    if (localStorage.getItem('aio_analysis_level')) localStorage.removeItem('aio_analysis_level');
  } catch (_) {}
})();

// v38.8: 로딩 상태 타임아웃 — 15초 후에도 "로딩 중"이면 안내 메시지 표시
// v48.57: 워치독 범위 확장 (earn-cal-body / risk-radar-body / kr-investor 3개 / last-fetch-time / home-quality-label / score-gauge-result)
setTimeout(function() {
  var loadingPatterns = ['로딩 중', '생성 중', 'Loading', '계산중', '계산 중', '분석 로딩', '데이터 로딩'];
  var candidates = document.querySelectorAll(
    '#macro-storyline, #earnings-calendar-body, #risk-radar-body, ' +
    '#last-fetch-time, #home-quality-label'
  );
  candidates.forEach(function(el) {
    if (!el) return;
    var txt = (el.textContent || '').trim();
    var isLoading = loadingPatterns.some(function(p) { return txt.indexOf(p) !== -1; });
    if (isLoading && txt.length < 80) {
      el.innerHTML = '<div class="lu-ld">' +
        '데이터를 불러오지 못했습니다.<br>' +
        '<span class="lu-ld-hint">잠시 뒤 새로고침해 주세요. 계속되면 네트워크 연결을 확인하세요.</span><br>' +
        '<button data-action="_aioReload" class="lu-ld-btn"> 새로고침</button>' +
        '</div>';
    }
  });
  // status 스팬류 (텍스트 짧은 단일 라인)
  ['earn-cal-status','risk-radar-status'].forEach(function(id){
    var s = document.getElementById(id);
    if (s && /로딩 중|데이터 로딩/.test(s.textContent || '')) s.textContent = '불러오지 못했습니다, 잠시 뒤 새로고침';
  });
}, 15000);

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

// v57.76: the home GMO table (GMO_MARKETS, renderGmoTable, toggleGmoExpand) is retired with its folded home
// section — a third price surface beside the KPI strip and the cross-asset row.

// v57.77: _aioBridgeVolIndicesLive (^MOVE/^VVIX live→data-snap bridge), its 'html-vol-indices-live' bus
// registration and 2.2s timer were deleted — the move/vvix data-snap sinks are gone and the ^VVIX
// DATA_SNAPSHOT mirror is written by js/aio-data.js on quote acceptance.

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

  // ESC always works — closes modals and panels
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
    return;
  }

  // Ctrl+K for quick search focus (works even in inputs)
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var searchInput = (document.querySelector('.page.active') || document).querySelector('#scr-text-search, #fund-search-input, #ticker-direct-search, #guide-search-input'); // P1315: .search-bar never existed
    if (searchInput && searchInput.offsetParent !== null) searchInput.focus(); else if (typeof window.openGlossary === 'function') { window.openGlossary(); setTimeout(function() { var g = document.getElementById('glossary-search'); if (g) g.focus(); }, 60); } // owner 2026-10-25: the sidebar search button is gone; only an on-screen search box takes focus; run-3 I#21: with none, 용어 사전 as the help row promises
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

  // Number keys 1-8 = the eight screens in menu order (v57.54: one table, src/ui/navigation/screen-shortcuts.js,
  // also draws the ? help rows). The G key toggled a home overview that no longer renders, so it is gone.
  const shortcutRoute = typeof window.AIO_SCREEN_SHORTCUT_ROUTE === 'function' ? window.AIO_SCREEN_SHORTCUT_ROUTE(e.key) : null;
  if (shortcutRoute && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (typeof showPage === 'function') showPage(shortcutRoute, null);
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

// v57.77: the market-health wrapper that painted #m7-health-row / #breadth-bar / #breadth-pct is retired — none of
// those sinks exist, and the wrapper dropped the call arguments.

// Ticker Analysis Deep Dive
// v30.10: 빈 DOMContentLoaded 핸들러 제거 (메모리 절약)
// Ticker tab/period state and chart lifecycle are native in entity.js.

// v57.77: the Stage/trend-position/dip/setup/cross/divergence engine (_detectStage … _detectDivergence) fed only the
// retired KR index and KR ticker Stage cards (analyzeKrIndex / the old analyzeKrTickerDeep) and was deleted with them.

// v58.76: the developer-only 한국 기술 widgets (VKOSPI chart, 현재 입력, KR spreads, KR breadth and initKoreaTechnical)
// are retired with their data-dev-only cards; the 한국 시장 fold keeps the native index trends and the news lane.

// v57.77: the KR ticker Stage·확도·셋업 analysis was retired. The input (Enter or _aioKrTickerSubmit) now only writes a
// link that hands the ticker to the 종목 screen through showTicker, which names the subject (aio:entityChanged ->
// setStockSubject) and opens the route. The name is kept for the existing data-on-enter / _aioKrTickerSubmit callers.
function analyzeKrTickerDeep(ticker) {
  var resultEl = document.getElementById('kr-ticker-analysis-result');
  if (!resultEl) return;
  var raw = String(ticker == null ? '' : ticker).trim();
  var sym = raw && typeof window._aioNormalizeTickerInput === 'function' ? window._aioNormalizeTickerInput(raw) : raw.toUpperCase();
  if (!sym || !/^[A-Z0-9.\-]{1,12}$/.test(sym)) {
    resultEl.innerHTML = '<p class="trend-card-note">종목코드 6자리(예: 005930)나 등록된 종목명을 입력하세요.</p>';
    return;
  }
  var code = sym.replace(/\.(KS|KQ)$/, '');
  var db = window.KR_STOCK_DB || {};
  var name = db[code] && db[code].name ? db[code].name : '';
  var known = typeof window._aioIsKnownTicker === 'function' ? !!window._aioIsKnownTicker(sym) : true;
  resultEl.innerHTML = '<button type="button" data-action="showTicker" data-arg="' + escHtml(sym) + '" class="aio-btn-table lu-kr-go">' +
      escHtml(name ? name + ' ' + sym : sym) + ' — 종목 화면에서 보기 →</button>' +
    (known ? '' : '<p class="trend-card-note lu-kr-note">등록된 종목 목록에 없는 코드입니다. 종목 화면에 시세가 없을 수 있습니다.</p>');
}

// P1430: calculateEntryQualityLocal retired with the ticker 가격·추세 위치 점검 calculator.

// v58.75 (owner 2026-10-24): '내 계획 점검' — the app proposes no price or size. It states facts about the plan the user
// typed: risk width, reward-to-risk multiple when a target is given, the loss at the stop and its share of total capital.
// The former 1R/2R/3R target prices and the 2%-rule share count were app-generated levels and sizes, so they are gone.
function calculateRR() {
  var num = function(id) { var el = document.getElementById(id); var v = el ? parseFloat(el.value) : NaN; return isFinite(v) && v > 0 ? v : null; };
  var entry = num('rr-entry'), stop = num('rr-stop'), target = num('rr-target'), amount = num('rr-capital'), total = num('rr-total');
  // v58.80 first-users run-2 (breaker): a refused input left the previous plan's lines on screen as if they were the new
  // plan, and a 20-digit amount printed "1e+22%". A refusal now hides the old result; amounts above 1e12 are refused.
  var refuse = function(message) { var old = document.getElementById('rr-result'); if (old) old.hidden = true; showToast(message); };
  if (entry == null || stop == null || stop >= entry) { refuse('가정 진입가와 그보다 낮은 손절 가격을 넣으세요'); return; }
  if (target != null && target <= entry) { refuse('목표 가격은 진입가보다 높게 넣거나 비워 두세요'); return; }
  if ([entry, stop, target, amount, total].some(function(v) { return v != null && v > 1e12; })) { refuse('1조보다 큰 값은 계산하지 않습니다. 단위를 확인해 주세요'); return; }
  var fmt = function(v, d) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d }); };
  var riskPct = (entry - stop) / entry * 100;
  var lines = ['위험 폭: 진입가에서 손절 가격까지 -' + riskPct.toFixed(1) + '% (' + fmt(entry - stop) + ')'];
  if (target != null) {
    var rewardPct = (target - entry) / entry * 100;
    lines.push('보상 폭: 목표 가격까지 +' + rewardPct.toFixed(1) + '%, 위험 1 대비 보상 ' + ((target - entry) / (entry - stop)).toFixed(2) + '배');
  } else lines.push('목표 가격을 넣지 않아 위험 대비 보상 배수는 계산하지 않았습니다.');
  if (amount != null) {
    var loss = amount * (entry - stop) / entry;
    lines.push('손절 가격에 닿으면 손실액: ' + fmt(loss, 0) + (total != null ? ' (전체 자본의 ' + (loss / total * 100).toFixed(1) + '%)' : ''));
    if (total != null) lines.push('투입 금액은 전체 자본의 ' + (amount / total * 100).toFixed(1) + '%입니다.');
  } else lines.push('투입 금액을 넣으면 손절 시 손실액을 계산합니다.');
  var list = document.getElementById('rr-lines');
  if (list) {
    list.innerHTML = '';
    lines.forEach(function(text) { var li = document.createElement('li'); li.textContent = text; list.appendChild(li); });
  }
  var box = document.getElementById('rr-result');
  if (box) box.hidden = false;
}

// ══════════════════════════════════════════════════════════════════
// v34.9: Phase 2-4 신규 기능 모음
// ══════════════════════════════════════════════════════════════════

// v58.76: the developer-only 한국 종목 일봉 chart (loadKrCandleChart / loadTVChart:kr) is retired; 종목 owns the KR chart.

// v57.76 (EF-12 retired): _aioSyncTvOhlcFallback and its page-bus hooks were deleted with the #tv-tech-ohlc strip.

// ═══ v53.6: ticker 종목 개요(밸리AI 참조 레이아웃) 렌더러 ═══════════════════
// 원칙: 실데이터만 표기(결측은 정직한 '—' + 사유 title), 새 병렬 계산 경로 없음(R276) —
// 시세는 _liveData, 수익률/팩터는 SCREENER_DB(스크리너 페이지와 동일 원천·동일 값)를 재사용.
window._aioRenderTickerOverview = function(tkr) {
  tkr = String(tkr || '').toUpperCase();
  if (!tkr) return;
  // 1) v57.77: the TradingView 대형 차트 block (#tv-widget-ticker) was deleted — the container left index.html and
  //    the native ticker price chart owns the 요약 tab.
  // 2) 가격 정보 — 라이브 quote 결측 필드는 '—' 유지(합성 금지)
  var live = (window._liveData || {})[tkr] || {};
  var scrRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  var scr = Array.isArray(scrRows) ? (scrRows.find(function(r){ return r && r.sym === tkr; }) || null) : null;
  var price = Number(live.price); // P1640: price/52-week/return rows retired (summary owns them)
  var prov = document.getElementById('ticker-ov-provenance');
  if (prov) {
    var srcs = [];
    var dsrc = window._dataSource && window._dataSource[tkr];
    if (price > 0) { srcs.push('시세: 실시간 관측'); prov.title = '시세 출처: ' + (live.source || (dsrc && dsrc.source) || 'live'); } // v57.54: provider id moved to hover (was "live:yahoo-proxy" on screen)
    if (scr) srcs.push('수익률·팩터: 확정 종가 기준');
    prov.textContent = srcs.length ? srcs.join(', ') : '원천 미수신 — 표시값 없음';
  }
  // 3) P1748: 관련 테마 칩 퇴역 — src/ui/components/company-analysis.js의 테마 버튼이 같은 연결(테마 단계 포함)을 맡는다.
  // 4) 팩터 프로파일 — 스크리너 순위 실행이 만든 canonical row factorScores(섹터 기준 정규화 점수 0~100, 서술적). W07-C/P1146: empirical percentile도 정규분포 누적확률도 아니며, 순위 percentile은 별도 composite rank다.
  var rowsEl = document.getElementById('ticker-ov-factor-rows');
  var radarC = document.getElementById('ticker-ov-factor-radar');
  var radarWrap = radarC && radarC.parentElement;
  var fs = scr && scr.factorScores;
  var F_LBL = { momentum:'모멘텀', trend:'추세', lowvol:'저변동성', size:'사이즈', value:'밸류', quality:'퀄리티', kalman:'칼만 추세' }, F_HINT = { kalman:'칼만 추세: 잡음을 걸러 낸 추세 추정' };
  if (fs && rowsEl) {
    var keys = Object.keys(fs).filter(function(k){ return typeof fs[k] === 'number' && isFinite(fs[k]); });
    rowsEl.innerHTML = keys.map(function(k) { // v57.54: 섹터 대비 위치(백분위·등급 아님) — 칼만 같은 용어는 hover 설명
      return '<div class="ticker-ov-row"' + (F_HINT[k] ? ' title="' + escHtml(F_HINT[k]) + '"' : '') + '><span class="ov-lbl">' + escHtml(F_LBL[k] || k) + '</span><span class="ov-val">' + fs[k] + '</span></div>';
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
            datasets: [{ data: keys.map(function(k){ return fs[k]; }), backgroundColor: 'rgba(47,124,87,0.12)', borderColor: '#2f7c57', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#2f7c57' }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 12 }, color: '#544f46' }, grid: { color: 'rgba(27,26,23,0.08)' }, angleLines: { color: 'rgba(27,26,23,0.08)' } } }
          }
        });
        if (window._aioChartRegistry) window._aioChartRegistry.register('ticker-ov-factor-radar', radarChart);
      } catch(_radarErr) {}
    } else if (radarWrap && (typeof Chart === 'undefined' || keys.length < 3)) {
      radarWrap.style.display = 'none';
    }
  } else if (rowsEl) {
    rowsEl.innerHTML = '<span class="lu-tk-empty">' + (scr ? '팩터 점수 미계산 — 스크리너 데이터 수신 대기' : '스크리너 유니버스 외 종목 — 팩터 정규화 점수는 섹터 상대값이라 제공되지 않습니다') + '</span>';
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

// v57.60: legacy McClellan row writer and its EMA state removed — no .bb-label rows and no A/D history source.

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
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#978365'; ctx.textAlign = 'center';
  ctx.fillText('SPY 30일 실데이터 조회 중...', W/2, H/2);

  // 포트폴리오 데이터 수집 (v48.13: 실제 필드명 ticker/qty/cost 사용)
  var pfData = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  pfData = (pfData || []).filter(function(p){ return p && p.ticker && p.qty > 0 && p.cost > 0; });

  if (pfData.length === 0) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#978365'; ctx.textAlign = 'center';
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
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#b54548'; ctx.textAlign = 'center'; /* v48.61 R43 */
    ctx.fillText('SPY 시세 조회 실패 — 네트워크 확인', W/2, H/2);
    return;
  }
  var spyBase = spySeries[0];
  if (!isFinite(spyBase) || spyBase <= 0) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#b54548'; ctx.textAlign = 'center';
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
  // v58.63 (architecture audit A20): holdings without a daily history used to get their whole cost-basis P&L spread in a
  // straight line over 30 days, so a position bought years ago printed as "+100% (30일)" and an Alpha. A period that was
  // not observed is not drawn: the line is the 30-day return of the holdings whose daily closes arrived (re-weighted to
  // that part), the label names that share, and with no history at all the comparison waits.
  ctx.clearRect(0, 0, W, H);
  if (!(coveredWeight > 0)) {
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#978365'; ctx.textAlign = 'left';
    ctx.fillText('보유 종목의 일별 가격 이력을 받지 못해 30일 비교를 보류합니다.', 10, 16);
    return;
  }
  for (var j = 0; j < L; j++) pfPct[j] = pfPct[j] / coveredWeight;
  var partial = coveredWeight < 0.999;

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
  ctx.strokeStyle = (getComputedStyle(document.body).getPropertyValue('--border-strong').trim() || 'rgba(27,26,23,0.15)'); ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0, yZero); ctx.lineTo(W, yZero); ctx.stroke(); ctx.setLineDash([]);

  // SPY 선 — v48.61 R43 Canvas hex (#1b1a17 = --data-cyan)
  var spyPlot = spyPct.slice(-L);
  ctx.strokeStyle = (getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1b1a17'); ctx.lineWidth = 2; ctx.beginPath(); // dark mode: the ink token, not a fixed near-black
  for (var i = 0; i < L; i++) {
    var x = (i / (L - 1)) * W;
    var y = yZero - spyPlot[i] * yScale;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 포트폴리오 선 — v48.61 R43 Canvas hex (#2f7c57 = data-green)
  ctx.strokeStyle = (getComputedStyle(document.body).getPropertyValue('--data-green').trim() || '#2f7c57'); ctx.lineWidth = 2.5; ctx.beginPath();
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
  var alphaColor = alpha >= 0 ? '#2f7c57' : '#b54548';
  ctx.textAlign = 'left';
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#2f7c57';
  ctx.fillText((partial ? '이력 확보 종목(' + (coveredWeight * 100).toFixed(0) + '% 비중): ' : '내 포트폴리오: ') + (pfFinal>=0?'+':'') + pfFinal.toFixed(1) + '% (30일)', 10, 16);
  ctx.fillStyle = (getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1b1a17');
  ctx.fillText('SPY: ' + (spyFinal>=0?'+':'') + spyFinal.toFixed(1) + '% (30일)', 10, 32);
  ctx.fillStyle = alphaColor;
  ctx.fillText('Alpha: ' + (alpha>=0?'+':'') + alpha.toFixed(1) + '%p', 10, 48);

  // 커버리지 표시 — v48.61 P37+R43
  ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = '#978365'; ctx.textAlign = 'right';
  ctx.fillText(partial ? '일별 이력 없는 종목은 제외 — 계좌 전체 수익률 아님' : '보유 종목 일별 종가 기준', W - 10, H - 8);
}


// P1736: this used to roll a hand-typed month/day list forward every year (10/16, 11/27 against the official 10/22,
// 11/26). The next meeting now comes only from the official kr-bok schedule; when it has none, nothing is guessed.
function getNextBOK() {
  var release = window.AIO_MACRO_CALENDAR && window.AIO_MACRO_CALENDAR.releases && window.AIO_MACRO_CALENDAR.releases['kr-bok'];
  return (release && release.nextRelease) || '일정 확인 필요';
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
  if (sbLabel) sbLabel.textContent = isDark ? '라이트 모드로 전환' : '다크 모드로 전환'; // P1591 (G07): the label names the action
  try { localStorage.setItem('aio_theme', isDark ? 'dark' : 'light'); } catch (_) {} // P1604: storage refusal cannot interrupt the visible action.
  document.dispatchEvent(new CustomEvent('aio:colorThemeChanged', { detail: { theme: isDark ? 'dark' : 'light' } }));
  // TradingView iframe 테마 업데이트
  document.querySelectorAll('iframe[src*="tradingview"]').forEach(function(f) {
    f.src = f.src.replace(/theme=(dark|light)/, 'theme=' + (isDark ? 'dark' : 'light'));
  });
}
// 테마 복원
(function() {
  var saved = null;
  try { saved = localStorage.getItem('aio_theme'); } catch (_) {}
  if (saved === 'dark' || (saved == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) { // v57.54: no saved choice follows the device setting
    document.body.classList.add('dark-theme');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = 'Dark';
    var sbLabel = document.getElementById('sidebar-theme-label');
    if (sbLabel) sbLabel.textContent = '라이트 모드로 전환';
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
// v58.53 개편 v2: 고정 하단 바 → 최초 1회 떠 있는 카드(비차단) + 페이지 하단 한 줄(.sx-page-foot)에서 다시 열기.
// v58.80 run-5 (phone #2): the notice is drawn by the static shell (index.html #aio-disclaimer-tpl) as the page parses —
// from this late classic script it landed at 39 s on slow 3G and pushed the reading down (CLS 0.74). The foot reopens it.
window._aioShowDisclaimer = function() { if (typeof window._aioMountDisclaimer === 'function') window._aioMountDisclaimer(true); };

// P1429 (owner 2026-10-04): the first-visit "처음 오셨나요?" onboarding card was removed — users are active traders; no how-to prompts.
// ── 초기화 ──
document.addEventListener('DOMContentLoaded', function() {
  window._globalUpdateInterval = _aioRegisterTimer('globalUpdate', function() {
    applyA11yIndicators();
  }, 30000); // 30초마다 접근성 아이콘 갱신
  applyA11yIndicators();
  // 경제 캘린더 동적 날짜 업데이트
  var bokEl = document.querySelector('[data-snap="bok-next"]');
  if (bokEl) bokEl.textContent = getNextBOK();
});
