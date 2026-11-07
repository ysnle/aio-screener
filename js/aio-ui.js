// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 3: UI START (실제 분할 적용 v48.26)                ║
// ║  책임: Render + Page Router + Charts + Filters + Gauges                   ║
// ║  의존성: MODULE 1 (stores) + MODULE 2 (data fetch/score/translate)        ║
// ║  Chart instances: 페이지별 레지스트리에서 생성·정리                      ║
// ║  주의: MODULE 1/2의 함수 호출은 모두 이벤트/타이머 콜백 내부 (즉시 호출 X) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
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
      if (typeof _aioShowStorageBlockedWarning === 'function') _aioShowStorageBlockedWarning(); // v59.20: src/ui/components/data-status-surface.js
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
//  LLM QUOTA READOUT
//  - the shared Worker owns the daily cap; the browser shows its reported allowance
//  - localStorage keeps only a per-day usage count
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

function getSelectedModel() {
  return 'luna'; // v31.3: 기본 Haiku (질문별 자동 승격은 chatSend에서 처리)
}

function getModelConfig(modelKey) {
  return LLM_MODELS[modelKey || getSelectedModel()] || LLM_MODELS.luna;
}

// v59.42: the shared Worker owns the daily allowance (AI_PER_CLIENT_DAILY_CAP, 150 per connection by default) and
// reports it in /health as ai.client. The browser's own 20/day limit and its over-limit confirm contradicted that
// (AI is always on) and stopped questions the Worker would have answered, so the badge now shows the Worker's count.
function _aioWorkerClientQuota() {
  var state = window._aioLastClaudeRouteState;
  var client = state && state.ok === true && state.health && state.health.ai && state.health.ai.client;
  if (!client || !Number.isFinite(client.dailyLimit) || client.dailyLimit <= 0 || !Number.isFinite(client.remainingToday)) return null;
  return { dailyLimit: client.dailyLimit, remainingToday: Math.max(0, Math.min(client.dailyLimit, client.remainingToday)) };
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
  if (modelEl) modelEl.textContent = '채팅·심층·번역 GPT-6 Luna';

  // The Worker's count is the only allowance; without it (older Worker, health not read yet) the numbers stay '—'.
  const allowance = _aioWorkerClientQuota();
  const remaining = allowance ? allowance.remainingToday : null;
  const pct       = allowance ? Math.round((allowance.dailyLimit - remaining) / allowance.dailyLimit * 100) : 0;
  const grade = !allowance ? 'green' : remaining === 0 ? 'empty' : remaining <= Math.ceil(allowance.dailyLimit * 0.2) ? 'warn' : 'green';

  if (capEl)  capEl.textContent = allowance ? allowance.dailyLimit + '회' : '—';
  if (remEl)  { remEl.textContent = allowance ? remaining + '회' : '—'; remEl.className = 'llm-quota-val ' + grade; }
  if (progEl) { progEl.style.width = pct + '%'; progEl.className = 'llm-prog-fill' + (grade !== 'green' ? ' ' + grade : ''); }
  if (costEl) costEl.textContent = '비용 정보: 공급자 청구 원천 미연결';

  if (badge)    badge.textContent = allowance ? remaining + '/' + allowance.dailyLimit : '—';
  if (hdrBadge) {
    // v50.13: 헤더 배지는 'AI · 모델'만 — 남은 횟수는 옆 #llm-quota가 단독 표시(중복 제거).
    const hdrText = 'AI, ' + model.label;
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
  // The daily cap is the Worker's (it refuses past it); the local count is usage telemetry only.
  const quota = getQuota();
  quota.used += 1;
  saveQuota(quota);
  updateQuotaBadge();
  return true; // allowed
}

// Init on load
/* v20: DOMContentLoaded Handler #2 - UI Keys/Quota */
document.addEventListener('DOMContentLoaded', () => {
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

// Roadmap 11: forceRefresh() (v34.6) is deleted — nothing called it; the update banner reloads through _aioForceReload.

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
// Roadmap 11: the refresh progress surface (bindAioRefreshProgressSurface) moved to src/ui/components/refresh-progress.js,
// installed with the screen bridges (src/app/legacy-screen-bridges.js).

// Roadmap 11: globalRefresh (the topbar 새로고침 button) moved there too, so one module writes #topbar-refresh-btn. Its
// fallback branch for a shell without AIO.forceRefreshAllData / AIO.runScheduledRefresh is deleted — both always exist.
// That branch was the last js/ caller of fetchPutCall; v59.70 deleted the Cboe reader itself (owner 11/4).

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
    '<div class="lu-pf-note">10EMA/21EMA/50SMA 이탈, 50일선 대비 과열(일평균 변동폭 4배·7배), 보유 비중을 포지션별로 나열한 관측입니다. 합산 점수는 예측 검증이 없어 표시하지 않습니다.</div>' +
    '<div class="lu-pf-scroll"><table class="lu-pf-tbl"><thead><tr class="lu-pf-thr"><th class="lu-pf-th">종목</th><th class="lu-pf-th lu-pf-th-r">비중</th><th class="lu-pf-th lu-pf-th-r">손익</th><th class="lu-pf-th lu-pf-th-r">확인 조건</th><th class="lu-pf-th">부담 수준</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

window.renderDataQualityBadge = renderDataQualityBadge;
window.renderPortfolioTechnicalRisk = renderPortfolioTechnicalRisk;

// v59.51 (content audit): the _aioDiagram SVG engine (v50.81) drew its last type, factor-radar, into the retired
// 재무 공시 #vis-fundamental-radar; it was deleted with _aioRenderFundamentalRadar.

// ──────────────────────────────────────────────────────────────────────────────
// v50.82 Phase 2: 페이지별 SVG 다이어그램 렌더러
// 각 페이지 진입(aio:pageShown) 시 _aioDiagram 엔진으로 시각화 주입
// ──────────────────────────────────────────────────────────────────────────────
(function () {
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
        // v58.88 (legacy decomposition 2/8 시장 상태): the breadth/sentiment diagram slots (#vis-breadth-regime,
        // #vis-sentiment-gauge) are gone; src/ui/components/breadth-board.js and src/ui/pages/sentiment.js own those routes.
      }
    } catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'ui', 'vis-phase2 render err:' + pid + ' ' + (e && e.message));
    }
  }

  var VIS_PAGES = ['signal']; // v59.42: the briefing/macro/fxbond/screener diagram slots are gone; v59.51: #vis-portfolio too

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

  window._aioRenderPageDiagram = _aioRenderPageDiagram;

  // v58.19: Phase 3 AI 채팅 자동 시각화(_aioChatAutoVis/_autoVisRaw/_findRow)는 호출자가 0건이라 제거했다.
  // 채팅 답변 도표는 src/ui/components/ai-answer-visuals.js가 맡는다.
})();

// v59.51 (content audit): the legacy 기업분석 report renderers (_renderFundHeader … _renderFundVariance and
// _renderFundamentalFinancialsCharts, moved here from aio-chat.js in v51.17) were deleted with their #fund-rpt-* sinks;
// the native entity slice (src/ui/pages/entity.js) is the one company report.
window.AIO = window.AIO || {};

// Roadmap 11: the 용어 사전 floating-button drag handler (P1130, block E) is deleted with its #glossary-btn — the button
// was hidden (display:none) since v40.6, when the sidebar 용어 사전 row replaced it.


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

// Roadmap 11: the glossary modal (openGlossary, renderGlossaryCats, renderGlossaryItems, filterGlossary and the seven
// reader groups) moved to src/ui/knowledge/glossary-modal.js, installed at boot by src/app/compatibility-globals.js.

// v33.0 → roadmap 11: the .insight-box click toggle and the first-visit unfold (aio_visited) are deleted — no page has an
// .insight-box since v51.58, so neither ever matched an element.
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
  // Roadmap 11: #macro-storyline, #risk-radar-body, #home-quality-label and #risk-radar-status left the markup; the
  // watchdog keeps the two sinks that remain.
  var candidates = document.querySelectorAll('#earnings-calendar-body, #last-fetch-time');
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
  ['earn-cal-status'].forEach(function(id){
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

// Roadmap 11: the ? help modal (openKbdHelp / closeKbdHelp) and the keydown shortcuts (Escape, Ctrl/⌘K, ?, 1..8, R) moved
// to src/ui/navigation/screen-shortcuts.js beside the screen table they read; src/app/bootstrap.js installs them.

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

// v59.70 (D5): analyzeKrTickerDeep left with the 한국 시장 추세 fold (#kr-ticker-analysis-input); the global search opens 종목.

// P1430: calculateEntryQualityLocal retired with the ticker 가격·추세 위치 점검 calculator.

// v59.70 (S16/L6): '내 계획 점검' (calculateRR) moved to src/ui/components/portfolio-plan-check.js.

// ══════════════════════════════════════════════════════════════════
// v34.9: Phase 2-4 신규 기능 모음
// ══════════════════════════════════════════════════════════════════

// v58.76: the developer-only 한국 종목 일봉 chart (loadKrCandleChart / loadTVChart:kr) is retired; 종목 owns the KR chart.

// v57.76 (EF-12 retired): _aioSyncTvOhlcFallback and its page-bus hooks were deleted with the #tv-tech-ohlc strip.

// v59.51 (content audit): the 종목 요약 팩터 fold (window._aioRenderTickerOverview, v59.01 ticker-overview.js) was retired.

// v57.60: legacy McClellan row writer and its EMA state removed — no .bb-label rows and no A/D history source.

// v59.70 (S16/L6): updateBenchmarkChart (per-holding Yahoo calls behind 새로고침) is retired; 포트폴리오 ① draws the
// native trend chart from the published closes (src/ui/components/portfolio-value-trend.js).


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
// 전략: shell(index.html/manifest/version.json)=Cache-First,
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
