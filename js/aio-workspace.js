// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-workspace.js — P1136/R620: index.html 인라인 블록 A(1,992줄)에서 추출한 사용자 상태·워크스페이스 계층.
// 포트폴리오(refreshPortfolioPrices/refreshPortfolioRisk/_pfPearson/
// share·MDD 라벨/shapre 라벨/exportPortfolio/importPortfolio), 백테스트 랩(runPortfolioBacktestLab;
// 결과 렌더러는 src/ui/components/portfolio-backtest-lab.js), 워치리스트(getWatchlists/saveWatchlists/createWatchlist/switchWatchlist/
// addToWatchlist; 화면은 src/ui/components/portfolio-watchlist.js), 투자 일지와 채팅 이력(PF_JOURNAL_KEY/CHAT_HISTORY_LS/
// _aioBuildPortfolioActionPrompt), 공용 헬퍼(showToast/_escHtmlSafe/fmtN).
//
// 왜 이 파일이 defer 그룹의 첫 번째인가: 원래 이 블록은 core·data·ui보다 먼저 실행되는 인라인이었고,
// 다른 런타임이 자기 평가 시점에 이 블록의 전역을 읽는다. 실행 위치를 보존하지 않으면 파일 하나가
// 통째로 ReferenceError로 죽는다(P1135에서 aio-ui.js가 그렇게 죽었다 — R622).
// ═══════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════
// AI Chat Engine — callSharedAi · chatSendUnified · chatFromChip
// ════════════════════════════════════════════════════════════════════════

// AI credentials are server-only; these compatibility helpers never read a saved key.
function getApiKey() { return ''; }


// v57.77: the #sidebar-api-key listener was deleted with its input (P1421: AI keys are server-only).

/* v46.6: 글로벌 로딩 워치독 — 60초 후 "로딩 중" 영구 고정 방지
 * 프록시 전면 장애 시 10+ 페이지에서 "로딩 중..."이 영구 표시되는 문제 해결.
 * 실제 데이터가 로드되면 이미 교체됐으므로 워치독은 잔존 로딩만 처리. */
setTimeout(function() {
  // 현재 활성 페이지의 "로딩 중" 요소만 처리 (비활성 페이지는 진입 시 init에서 처리)
  var _loadingPatterns = ['로딩 중...','로딩 중…','분석 로딩 중…','분석 로딩 중...','데이터 로딩 중...','데이터 로딩 중…','데이터 로딩 중'];
  // v57.75: personal API keys are retired (v57.67), so the old "API 키를 설정하면" hint pointed at a removed setting.
  var _fallbackMsg = '데이터 연결 지연 — 새로고침(R키) 시도';
  var replaced = 0;
  document.querySelectorAll('.page.active *').forEach(function(el) {
    if (el.children.length > 0) return;
    var txt = el.textContent.trim();
    if (_loadingPatterns.some(function(p) { return txt === p; })) {
      el.textContent = _fallbackMsg;
      el.style.color = 'var(--text-muted)';
      el.style.fontStyle = 'italic';
      el.style.fontSize = '12px';
      replaced++;
    }
  });
  if (replaced > 0) console.log('[AIO v46.10] 로딩 워치독: ' + replaced + '개 로딩 상태 대체');

  // 비활성 페이지도 순회
  setTimeout(function() {
    var total = 0;
    document.querySelectorAll('.page:not(.active) *').forEach(function(el) {
      if (el.children.length > 0) return;
      var txt = el.textContent.trim();
      if (_loadingPatterns.some(function(p) { return txt === p; })) {
        el.textContent = _fallbackMsg;
        el.style.color = 'var(--text-muted)';
        el.style.fontStyle = 'italic';
        el.style.fontSize = '12px';
        total++;
      }
    });
    if (total > 0) console.log('[AIO v46.10] 로딩 워치독 (비활성): ' + total + '개 대체');
  }, 10000); // 비활성 페이지는 40초 후
}, 30000); // v46.10: 60초→30초 (사용자 대기 시간 단축)

// v58.74: openApiKeyConfig() left with its last button (the news translation status line); AI is always on.

// ══════════════════════════════════════════════════════════════════════
// Portfolio Management — localStorage CRUD + PIN Lock + Real-time Sync
// ══════════════════════════════════════════════════════════════════════
const PF_STORAGE_KEY = 'aio_portfolio_data';
const PF_PIN_KEY = 'aio_portfolio_pin'; // v52.46: 레거시 평문 PIN — 공유 Vault로 마이그레이션 후 제거 대상
const PF_VAULT_OPTOUT_KEY = 'aio_portfolio_vault_optout';

// v52.46 WO-1A/P661/R294: 포트폴리오를 API 키와 동일한 _AioVault(AES-GCM-256+PBKDF2)로 보호.
// UI가 "PIN 설정 후 저장 시 AES-256 암호화"라고 명시해왔으나 실제로는 완전히 별개의 평문
// localStorage 경로였다(Codex P0-2, PIN도 평문 비교). 이제 _AIO_SENSITIVE_KEYS에 편입해
// safeLS 계약을 그대로 따른다 — PIN을 설정하지 않은 사용자는 기존과 동일하게 평문(계약 변경 없음).
// 동기 읽기가 필요한 기존 호출부 수십 곳을 async로 바꾸지 않기 위해 API 키가 이미 쓰는
// _AioVault._keyRuntime 동기 캐시 패턴을 그대로 재사용한다.
function _pfVaultOptedOut() {
  try {
    var adapter = window.AIO && window.AIO.storageAdapter;
    return (adapter ? adapter.get(PF_VAULT_OPTOUT_KEY, '') : localStorage.getItem(PF_VAULT_OPTOUT_KEY)) === '1';
  } catch(e) { return false; }
}
function getPortfolioData() {
  try {
    if (isPortfolioLocked()) return []; // P1350: a failed locked write cannot expose its runtime cache.
    if (!_pfVaultOptedOut() && typeof _AioVault !== 'undefined' && _AioVault._keyRuntime && _AioVault._keyRuntime[PF_STORAGE_KEY] !== undefined) {
      return JSON.parse(_AioVault._keyRuntime[PF_STORAGE_KEY] || '[]');
    }
    var adapter = window.AIO && window.AIO.storageAdapter;
    const raw = adapter ? adapter.get(PF_STORAGE_KEY, '') : localStorage.getItem(PF_STORAGE_KEY);
    if (!raw) return [];
    if (raw.indexOf('aio_enc::') === 0) return []; // 암호화된 상태 + 이번 세션 미해제 — 평문 노출 금지
    return JSON.parse(raw);
  } catch(e) { return []; }
}
// v58.82: 다른 탭이 보유 종목을 바꾸면 이 탭의 오래된 사본으로 덮지 않는다(편집 거절). 가져오기·전체 삭제는 { replace: true }.
window.addEventListener('storage', function(e) { if (e.key === PF_STORAGE_KEY) window.__aioPfOtherTab = true; });
function _pfSaveFailText(saved, text) {
  return saved.reason === 'other-tab' ? '다른 탭에서 포트폴리오가 바뀌어 저장하지 않았습니다. 다시 불러온 뒤 입력하세요.' : text;
}
function savePortfolioData(positions, opts) {
  var replace = !!(opts && opts.replace);
  if (window.__aioPfOtherTab && !replace) return Promise.resolve({ ok: false, reason: 'other-tab' });
  if (replace) window.__aioPfOtherTab = false;
  var json = JSON.stringify(positions);
  var memoryOk = true;
  try {
    if (typeof _AioVault !== 'undefined') {
      if (!_AioVault._keyRuntime) _AioVault._keyRuntime = {};
      _AioVault._keyRuntime[PF_STORAGE_KEY] = json; // 동기 read가 항상 최신값을 보게 즉시 갱신
    }
  } catch(e) { memoryOk = false; }
  // E3/P1181 (11 P11-01): 메모리 반영과 영구 저장 성공은 서로 다른 사건이다. 이전에는 지연 persist가
  // 실패해도 호출자가 즉시 '완료'를 알렸다 — 이제 persist 결과를 반환해 호출자가 성공/실패를 구분한다.
  var persist;
  if (_pfVaultOptedOut() || typeof safeLS !== 'function') {
    try {
      var adapter = window.AIO && window.AIO.storageAdapter;
      if (adapter) { if (adapter.set(PF_STORAGE_KEY, json) === false) throw new Error('storage-write-failed'); }
      else localStorage.setItem(PF_STORAGE_KEY, json);
      persist = Promise.resolve({ ok: true });
    } catch(e) { persist = Promise.resolve({ ok: false, reason: 'storage-write-failed' }); }
  } else {
    persist = safeLS(PF_STORAGE_KEY, json).then(function() { return { ok: true }; }).catch(function(e) {
      _aioLog('warn', 'portfolio', '저장 확인 실패: ' + (e && e.message || e));
      return { ok: false, reason: 'persist-rejected' };
    });
  }
  try { document.dispatchEvent(new CustomEvent('aio:portfolioChanged')); } catch(e) {}
  return persist.then(function(result) {
    var durable = !!memoryOk && result.ok === true;
    return { ok: durable, durable: durable, memoryApplied: !!memoryOk, reason: memoryOk ? (result.reason || null) : 'memory-write-failed' };
  });
}

// ══════════════════════════════════════════════════════════════════════
// E3/E4/P1188: 통화·현금 수익률·RF 선언의 단일 writer.
// 통화/수익률은 입력이지 추정값이 아니다 — 선언이 없으면 키를 만들지 않고, 잘못된 형식은
// 저장하지 않는다(빈 값 = 삭제). reader(runtime-readers)가 같은 키를 읽으므로 키·정규화는
// bootstrap이 노출한 `_pfPortfolioAssumptions` 한 곳에서 온다(R632).
// ══════════════════════════════════════════════════════════════════════
var PF_ASSUMPTION_FIELDS = {
  'pf-base-currency-input': { key: 'baseCurrency', kind: 'currency' },
  // v57.81: cash-currency field retired — each cash balance carries its currency; the old key only places legacy cash.
  'pf-cash-return-input': { key: 'cashReturn', kind: 'rate' },
  'pf-rf-input': { key: 'riskFreeRate', kind: 'rate' },
  'pf-exposure-path-input': { key: 'exposurePath', kind: 'path' },
  'pf-rebalance-policy-input': { key: 'rebalancePolicy', kind: 'policy' }
};
function _pfAssumptionApi() {
  return (typeof window !== 'undefined' && window._pfPortfolioAssumptions) ? window._pfPortfolioAssumptions : null;
}
function readPortfolioAssumptionDeclarations() {
  // 키·정규화·저장 읽기는 portfolio-assumptions.js 한 곳이 소유한다 — 셸은 위임만 한다(R632).
  var api = _pfAssumptionApi();
  if (!api || typeof api.read !== 'function') return { baseCurrency: null, cashCurrency: null, cashReturn: null, riskFreeRate: null };
  try { return api.read(localStorage); } catch(e) { return { baseCurrency: null, cashCurrency: null, cashReturn: null, riskFreeRate: null }; }
}
function savePortfolioAssumption(fieldId, value) {
  var field = PF_ASSUMPTION_FIELDS[fieldId];
  var api = _pfAssumptionApi();
  if (!field || !api || !api.keys) return;
  var key = api.keys[field.key];
  var normalized;
  if (field.kind === 'currency') normalized = api.normalizeCurrencyCode ? api.normalizeCurrencyCode(value) : null;
  else if (field.kind === 'rate') normalized = api.normalizeAnnualRate ? api.normalizeAnnualRate(value) : null;
  else if (field.kind === 'path') normalized = api.normalizeExposurePath ? api.normalizeExposurePath(value) : null;
  else normalized = api.normalizeRebalancePolicy ? api.normalizeRebalancePolicy(value) : null;
  try {
    // 유효하지 않은 선언은 남기지 않는다 — 3자리 코드·범위 밖 수익률·인식할 수 없는 열거형은 이전
    // 선언까지 지운다(P1198: 열거형도 예외가 아니다 — 지어낸 기본값을 저장하지 않는다). 비율만 입력
    // 원문을 보존해 화면이 그대로 되돌릴 수 있게 한다.
    if (normalized == null) localStorage.removeItem(key);
    else localStorage.setItem(key, field.kind === 'rate' ? String(value).trim() : normalized);
  } catch(e) {}
  renderPortfolio();
  if (typeof refreshPortfolioRisk === 'function') { try { refreshPortfolioRisk(); } catch(e) {} }
}
window.savePortfolioAssumption = savePortfolioAssumption;

// ══════════════════════════════════════════════════════════════════════
// E4/P1191: 계좌 원장(입출금·기간 평가액) 입력.
// TWR/MWR은 원장 없이 계산되지 않으므로(assessAccountPerformance) 원장 자체가 입력이어야 한다.
// 원장은 사용자 금융 데이터다 — 포지션과 같은 Vault 경로(safeLS + `_keyRuntime` 동기 캐시)로
// 저장하고 별도 평문 키를 만들지 않는다.
// ══════════════════════════════════════════════════════════════════════
var PF_LEDGER_KEY = 'aio_portfolio_ledger';
// E3/P1194: FX leg도 같은 저장 규약을 쓴다 — 목록형 선언은 한 경로(safeLS + 동기 캐시 + ack)로 통일한다.
var PF_FX_KEY = 'aio_portfolio_fx_legs';
function _pfLedgerApi() {
  return (typeof window !== 'undefined' && window._pfPortfolioLedger) ? window._pfPortfolioLedger : null;
}
function _pfFxApi() {
  return (typeof window !== 'undefined' && window._pfPortfolioFx) ? window._pfPortfolioFx : null;
}
// P1199: 저장 *정책*(safeLS ack + Vault 동기 캐시 + 자체 평문 키 없음)은 셸이 소유하되, 그 *형태*는
// 네이티브 모듈이 가진다 — ack가 "메모리 반영"과 "영구 저장"을 분리해 보고하는 계약이 브라우저 없이
// 테스트된다(이 블록이 ratchet에서 조용히 자라던 자리다).
var _pfDeclarationStore = null;
function _pfVaultRuntime() {
  if (typeof _AioVault === 'undefined') return null;
  if (!_AioVault._keyRuntime) _AioVault._keyRuntime = {};
  return _AioVault._keyRuntime;
}
function _pfDeclarations() {
  if (_pfDeclarationStore) return _pfDeclarationStore;
  var api = (typeof window !== 'undefined' && window._pfDeclarationsStore) ? window._pfDeclarationsStore : null;
  if (!api || typeof api.create !== 'function') return null;
  _pfDeclarationStore = api.create({
    getRuntimeCache: _pfVaultRuntime,
    getAdapter: function() { return (window.AIO && window.AIO.storageAdapter) || null; },
    getLocalStorage: function() { return typeof localStorage !== 'undefined' ? localStorage : null; },
    optedOut: _pfVaultOptedOut,
    secureSet: function(key, json) {
      return typeof safeLS === 'function' ? safeLS(key, json) : Promise.reject(new Error('safeLS-unavailable'));
    },
    warn: function(message) { _aioLog('warn', 'portfolio', message); }
  });
  return _pfDeclarationStore;
}
function getPortfolioLedger() { var store = _pfDeclarations(); return !isPortfolioLocked() && store ? store.read(PF_LEDGER_KEY) : null; }
function _pfDeclarationWrite(key, value) {
  var store = _pfDeclarations();
  return store ? store.write(key, value) : Promise.resolve({ ok: false, reason: 'declaration-store-unavailable' });
}
function savePortfolioLedger(ledger) { return _pfDeclarationWrite(PF_LEDGER_KEY, ledger); }
function getPortfolioFxLegs() { var store = _pfDeclarations(); var legs = !isPortfolioLocked() && store ? store.read(PF_FX_KEY) : null; return Array.isArray(legs) ? legs : []; }
function savePortfolioFxLegs(legs) { return _pfDeclarationWrite(PF_FX_KEY, Array.isArray(legs) ? legs : []); }
var PF_TRADES_KEY = 'aio_portfolio_trades'; // v58.52 매매일지·내 원칙: 같은 Vault 경로 (src/ui/panels/portfolio-trade-journal.js)
function getPortfolioTrades() { var store = _pfDeclarations(), value = !isPortfolioLocked() && store ? store.read(PF_TRADES_KEY) : null; return value && typeof value === 'object' ? value : null; }
window._aioPortfolioTrades = { read: getPortfolioTrades, write: function(value) { return _pfDeclarationWrite(PF_TRADES_KEY, value); } };
function _pfLedgerRead() {
  var api = _pfLedgerApi();
  return api ? api.normalize(getPortfolioLedger()) : null;
}
function _pfFxRead() {
  var api = _pfFxApi();
  return api ? api.normalize(getPortfolioFxLegs()) : [];
}
// P1195: 마크업·문구는 네이티브 패널(src/ui/panels/portfolio-declarations.js)이 소유한다 —
// 셸은 저장 경로와 핸들러, ack 순서만 남긴다(이 블록이 ratchet에서 가장 빨리 자라던 부분이었다).
var PF_FIELD_IDS = {
  transaction: ['pf-ledger-date', 'pf-ledger-kind', 'pf-ledger-amount'],
  valuation: ['pf-ledger-valuation-date', 'pf-ledger-valuation-amount'],
  fx: ['pf-fx-from', 'pf-fx-to', 'pf-fx-rate', 'pf-fx-date']
};
function _pfPanels() {
  return (typeof window !== 'undefined' && window._pfDeclarationPanels) ? window._pfDeclarationPanels : null;
}
function _pfShowStatus(statusId, kind, phase, result, okMessage) {
  var panels = _pfPanels();
  if (panels) panels.showDeclarationStatus({ documentRef: document, statusId: statusId, kind: kind, phase: phase, result: result, okMessage: okMessage });
}
function _pfReadFields(kind) {
  var panels = _pfPanels();
  return panels ? panels.readDeclaredFields(document, PF_FIELD_IDS[kind]) : {};
}
function _pfClearFields(kind) {
  var panels = _pfPanels();
  if (panels) panels.clearDeclaredFields(document, PF_FIELD_IDS[kind]);
}
function _pfVaultListPersist(options) {
  _pfShowStatus(options.statusId, options.kind, 'pending');
  return _pfDeclarationWrite(options.key, options.value).then(function(result) {
    _pfShowStatus(options.statusId, options.kind, 'persist', result, options.okMessage);
    if (typeof options.rerender === 'function') options.rerender();
    if (typeof refreshPortfolioRisk === 'function') { try { refreshPortfolioRisk(); } catch(e) {} }
    return result;
  });
}
// 유효성·병합은 portfolio-ledger.js와 fx.js가 소유한다 — 셸은 값을 읽어 넘기고 결과를 게시만 한다.
function _pfApply(kind, statusId, key, result, okMessage) {
  if (!result || result.ok !== true) {
    _pfShowStatus(statusId, kind, 'apply', result);
    return Promise.resolve(result || { ok: false, reason: kind + '-apply-failed' });
  }
  return _pfVaultListPersist({
    kind: kind,
    key: key,
    statusId: statusId,
    rerender: kind === 'fx' ? renderPortfolioFxLegs : renderPortfolioLedger,
    value: kind === 'fx' ? result.legs : result.ledger,
    okMessage: okMessage
  });
}
function _pfLedgerApply(result, okMessage) { return _pfApply('ledger', 'pf-ledger-status', PF_LEDGER_KEY, result, okMessage); }
function _pfFxApply(result, okMessage) { return _pfApply('fx', 'pf-fx-status', PF_FX_KEY, result, okMessage); }
function addLedgerEntry(kind) {
  var api = _pfLedgerApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'ledger-api-unavailable' });
  var values = _pfReadFields(kind === 'valuation' ? 'valuation' : 'transaction');
  if (kind === 'valuation') {
    return _pfLedgerApply(api.appendValuation(_pfLedgerRead(), {
      date: values['pf-ledger-valuation-date'], amount: values['pf-ledger-valuation-amount']
    }), '기간 평가액을 저장했습니다.').then(function(result) {
      if (result.ok) _pfClearFields('valuation');
      return result;
    });
  }
  var kindValue = values['pf-ledger-kind'] === 'withdrawal' ? 'withdrawal' : 'deposit';
  return _pfLedgerApply(api.appendTransaction(_pfLedgerRead(), {
    date: values['pf-ledger-date'], kind: kindValue, amount: values['pf-ledger-amount']
  }), (kindValue === 'deposit' ? '입금' : '출금') + ' 거래를 저장했습니다.').then(function(result) {
    if (result.ok) _pfClearFields('transaction');
    return result;
  });
}
function removeLedgerEntry(kind, index) {
  var api = _pfLedgerApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'ledger-api-unavailable' });
  return _pfLedgerApply(api.remove(_pfLedgerRead(), kind, index), '원장 항목을 삭제했습니다.');
}
function setLedgerCoverage(field, checked) {
  var api = _pfLedgerApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'ledger-api-unavailable' });
  return _pfLedgerApply(api.setCoverage(_pfLedgerRead(), field, checked), '원장 포함 범위를 저장했습니다.');
}
function setLedgerFlowTiming(value) {
  var api = _pfLedgerApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'ledger-api-unavailable' });
  return _pfLedgerApply(api.setFlowTiming(_pfLedgerRead(), value), '입출금 반영 시점을 저장했습니다.');
}
function renderPortfolioLedger() {
  var panels = _pfPanels();
  if (!panels) return;
  var api = _pfLedgerApi();
  var ledger = _pfLedgerRead();
  panels.applyLedgerPanel({
    documentRef: document,
    ledger: ledger,
    coverageState: api && typeof api.coverageState === 'function' ? api.coverageState(ledger) : { inputs: [] }
  });
  // P1449: ledger·규약이 바뀌면 계좌 성과 요약도 같은 epoch에서 다시 계산한다.
  try { refreshPortfolioLedgerPerformance(); } catch(e) {}
}
window._aioAddLedgerEntry = function() { return addLedgerEntry('transaction'); };
window._aioAddLedgerValuation = function() { return addLedgerEntry('valuation'); };
window._aioRemoveLedgerEntry = function(arg) {
  var parts = String(arg == null ? '' : arg).split(':');
  return removeLedgerEntry(parts[0] === 'valuation' ? 'valuation' : 'transaction', Number(parts[1]));
};
window._aioSetLedgerCoverage = function(el) { return setLedgerCoverage(el && el.dataset ? el.dataset.field : null, !!(el && el.checked)); };
window._aioSaveLedgerConvention = function(el) { return setLedgerFlowTiming(el ? el.value : ''); };
function renderPortfolioFxLegs() {
  var panels = _pfPanels();
  var api = _pfFxApi();
  if (!panels || !api || typeof api.legsState !== 'function') return;
  panels.applyFxPanel({ documentRef: document, legsState: api.legsState(_pfFxRead(), { asOfMs: Date.now() }), maxAgeMs: api.maxAgeMs });
}
function addFxLeg() {
  var api = _pfFxApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'fx-api-unavailable' });
  var values = _pfReadFields('fx');
  return _pfFxApply(api.appendLeg(_pfFxRead(), {
    from: values['pf-fx-from'], to: values['pf-fx-to'], rate: values['pf-fx-rate'], observedAt: values['pf-fx-date']
  }), '환율 기록을 저장했습니다.').then(function(result) {
    if (result.ok) _pfClearFields('fx');
    return result;
  });
}
function removeFxLeg(index) {
  var api = _pfFxApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'fx-api-unavailable' });
  return _pfFxApply(api.removeLeg(_pfFxRead(), index), '환율 기록을 삭제했습니다.');
}
window._aioAddFxLeg = function() { return addFxLeg(); };
window._aioRemoveFxLeg = function(arg) { return removeFxLeg(Number(arg)); };
window.getPortfolioFxLegs = getPortfolioFxLegs;
window.savePortfolioFxLegs = savePortfolioFxLegs;
window.getPortfolioLedger = getPortfolioLedger;
window.savePortfolioLedger = savePortfolioLedger;
window.addLedgerEntry = addLedgerEntry;
window.removeLedgerEntry = removeLedgerEntry;
window.setLedgerCoverage = setLedgerCoverage;
window.setLedgerFlowTiming = setLedgerFlowTiming;

// PIN Lock — v52.46: 독자 PIN 저장을 폐기하고 공유 _AioVault 상태를 단일 진실 원천으로 사용
function isPortfolioLocked() {
  if (_pfVaultOptedOut()) return false;
  try {
    var storage = typeof _AioVault !== 'undefined' ? _AioVault.getStorage() : localStorage;
    var hasProtection = !!storage.getItem('aio_vault_salt') || !!storage.getItem(PF_PIN_KEY);
    if (!hasProtection) return false;
    return !(typeof _AioVault !== 'undefined' && _AioVault.isUnlocked());
  } catch(e) { return false; }
}
async function unlockPortfolio() {
  const input = document.getElementById('pf-pin-input');
  if (!input) return;
  const pin = input.value.trim();
  if (pin.length < 4 || pin.length > 20) { showToast('PIN은 4~20자로 입력하세요.'); return; } // P1399: same contract as the vault setup
  if (typeof _AioVault === 'undefined') { showToast('보안 모듈을 불러오지 못했습니다.'); return; }
  var optedOut = _pfVaultOptedOut();
  var storage = _AioVault.getStorage();
  try {
    await _AioVault.unlock(pin);
    storage.removeItem(PF_VAULT_OPTOUT_KEY);
    await _migrateToEncrypted();
    await _restoreDecryptedKeys();
    storage.removeItem(PF_PIN_KEY);
    input.value = '';
    showPortfolioMain();
  } catch (error) {
    if (error && error.message === 'vault-operation-cancelled') return; _AioVault.lock(); // P1350: do not re-lock a newer unlock operation.
    if (optedOut) { try { storage.setItem(PF_VAULT_OPTOUT_KEY, '1'); } catch (_) {} }
    showToast('PIN 또는 저장된 암호문을 확인할 수 없습니다.');
  }
}
function setupPortfolioPin() {
  var pinInput = document.getElementById('pf-pin-input');
  if (!pinInput) return;
  var lockScreen = document.getElementById('pf-lock-screen');
  var mainEl = document.getElementById('pf-main');
  if (lockScreen) lockScreen.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';
  pinInput.value = '';
  // v52.46: 별도 keydown 핸들러 제거 — input의 data-on-enter="unlockPortfolio"가 이미 동일 로직 처리
  // (신규 Vault 생성/기존 Vault 잠금해제 모두 unlockPortfolio() 한 경로로 통합)
  pinInput.placeholder = _AioVault.getStorage().getItem('aio_vault_salt') ? '기존 PIN 입력' : '새 PIN(4~20자)';
  pinInput.focus();
}
function resetPortfolioPin() {
  var storage = _AioVault.getStorage(), hasProtection = !!storage.getItem('aio_vault_salt') || !!storage.getItem(PF_PIN_KEY);
  if (!hasProtection) { showToast('설정된 PIN이 없습니다.'); return; }
  var isUnlocked = typeof _AioVault !== 'undefined' && _AioVault.isUnlocked();
  var warnMsg = isUnlocked ? '포지션·원장·환율 거래·매매일지를 평문으로 저장하고 PIN 보호를 해제합니다. 자체 프록시 주소의 PIN 보호는 유지합니다. 계속하시겠습니까?' : 'PIN을 모르면 포지션·원장·환율 거래·매매일지를 복구할 수 없어 모두 삭제합니다. 자체 프록시 주소의 PIN 보호는 유지합니다. 계속하시겠습니까?';
  showConfirmModal('PIN 보호 해제', warnMsg, async function() {
    try {
      var storage = _AioVault.getStorage(), originals = {}, values = {};
      for (var key of _AIO_PORTFOLIO_VAULT_KEYS) { var raw = storage.getItem(key); originals[key] = raw; if (isUnlocked && raw) { values[key] = raw.startsWith('aio_enc::') ? await _AioVault.decrypt(raw) : raw; if (values[key] === null) throw new Error('vault-auth-failed'); } }
      try { for (var key of _AIO_PORTFOLIO_VAULT_KEYS) { if (isUnlocked && values[key] != null) storage.setItem(key, values[key]); else storage.removeItem(key); } storage.setItem(PF_VAULT_OPTOUT_KEY, '1'); storage.removeItem(PF_PIN_KEY); }
      catch (error) { for (var key of _AIO_PORTFOLIO_VAULT_KEYS) { try { if (originals[key] == null) storage.removeItem(key); else storage.setItem(key, originals[key]); } catch (_) {} } throw error; }
      _AioVault.lock(); showToast('포트폴리오 PIN 보호를 해제했습니다.'); showPortfolioMain();
    } catch (error) { showToast('보호 해제를 저장하지 못했습니다. 기존 자료를 확인하세요.'); }
  }, '');
}
function showPortfolioMain() {
  const lock = document.getElementById('pf-lock-screen');
  const main = document.getElementById('pf-main');
  if (lock) lock.style.display = 'none';
  if (main) main.style.display = 'flex';
  renderPortfolio();
}

// v52.87 P702: 시안의 조용한 기본 화면을 유지하면서 입력 폼은 명시적 CTA로 연다.
window._aioTogglePortfolioEntry = function(forceOpen) {
  var section = document.getElementById('pf-entry-section');
  if (!section) return;
  var open = forceOpen == null ? !section.classList.contains('is-open') : !!forceOpen;
  section.classList.toggle('is-open', open);
  if (open) {
    try { section.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(_) {}
    try { document.getElementById('pf-add-ticker').focus(); } catch(_) {}
  }
};

// Add/Edit Position
// E3/P1181 (11 P11-01): 완료 알림은 durable ack 뒤에 온다 — persist가 거부되면 '완료'를 말하지 않는다.
// v58.64 (BND01 class): the unlisted-ticker check awaits the network; a reader who typed the next holding meanwhile
// lost it, because the form was cleared after the save. The form is cleared (and the entry panel closed) only while it
// still holds what was submitted.
function _pfFormSnapshot() { return JSON.stringify(['pf-add-ticker', 'pf-add-qty', 'pf-add-cost', 'pf-add-target', 'pf-add-cost-currency', 'pf-add-memo'].map(function(id) { var el = document.getElementById(id); return el ? String(el.value) : ''; })); }
var _pfConfirmedAdd = null; async function addPortfolioPosition() { // v57.55 review (B4-F2/F6): one-shot confirm for an unlisted six-digit code or a won-sized USD cost
  const pfFormAtSubmit = _pfFormSnapshot();
  // P1592 (F14): '005930.KS' / '000660.KQ' (the screener's own format) is the same listed code — keep the six digits.
  const pfRawTicker = (document.getElementById('pf-add-ticker').value || '').trim(), pfHolding = typeof window._aioResolveHoldingInput === 'function' ? window._aioResolveHoldingInput(pfRawTicker) : null; // v57.81: shared symbol owner with the ticker route — ticker-shaped input kept as typed; only a name ("스엑") resolves, by exact registry match (P1339)
  let ticker = ((pfHolding && pfHolding.symbol) || pfRawTicker.toUpperCase()).replace(/^(\d{6})\.K[SQ]$/, '$1');
  var pfCheckPending = typeof window._aioReadHoldingInputs === 'function' ? window._aioReadHoldingInputs().catch(function() { return null; }) : Promise.resolve(null); // v58.80 F06/F25: input-check.js checks the values taken now; every field is read before the first await
  // P1176 (22 PFR01): 빈 칸을 0으로 직렬화하면 화면이 '목표 $0.00 · -100%'를 만든다 — 미설정은 null로 남긴다.
  const pfTargetEl = document.getElementById('pf-add-target'), parsedTarget = parseFloat(pfTargetEl.value);
  if (pfTargetEl.validity?.badInput || (pfTargetEl.value.trim() && !(parsedTarget > 0))) { showToast('목표가는 0보다 큰 숫자로 입력하거나 비워 두세요.'); return; } // v58.82: 말없이 미설정 저장하지 않음
  const target = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;
  const memo = (document.getElementById('pf-add-memo').value || '').trim();
  // E3/P1187 (11 P11-02): 원가 통화는 합산의 단위다 — 이 경로에 writer가 없어서 사용자는 통화를
  // 선언할 방법이 없었고, 선언은 import로만 들어왔다. 선언이 비면 null로 남기고 티커·시세·locale로
  // 추정하지 않는다(11 §23). 선언했는데 형식이 틀리면 조용히 버리지 않고 거부한다(R628).
  const costCurrencyEl = document.getElementById('pf-add-cost-currency');
  const costCurrencyRaw = (costCurrencyEl ? costCurrencyEl.value : '').trim().toUpperCase();
  if (costCurrencyRaw && !/^[A-Z]{3}$/.test(costCurrencyRaw)) {
    showToast('원가 통화는 3자리 코드(예: USD, KRW)로 입력하거나 비워 두세요.'); window._aioMarkField?.('pf-add-cost-currency', 'currency');
    return;
  } else window._aioMarkField?.('pf-add-cost-currency');
  // v58.80 F18: the default currency follows the resolved ticker, the same rule as the cost label.
  const costCurrency = costCurrencyRaw || (/^\d{6}$/.test(ticker) ? 'KRW' : null);
  var pfCheck = await pfCheckPending; if (!pfCheck || !pfCheck.ok) { showToast(pfCheck ? pfCheck.reason : '입력 확인 도구를 아직 불러오지 못했습니다. 잠시 뒤 다시 추가하세요.'); return; }
  const qty = pfCheck.qty, cost = pfCheck.cost;
  var knownTickers = (typeof KNOWN_TICKERS !== 'undefined') ? KNOWN_TICKERS : [], snapFb = (typeof _SNAP_FALLBACK !== 'undefined') ? _SNAP_FALLBACK : {};
  let ld = window._liveData || {};
  var isKnown = (knownTickers.has ? knownTickers.has(ticker) : (knownTickers.indexOf ? knownTickers.indexOf(ticker) >= 0 : false)) || snapFb[ticker] || ld[ticker] || /^\d{6}$/.test(ticker) || !!(pfHolding && pfHolding.known); // v46.6: KNOWN_TICKERS is a Set — .has(); v57.81: + screener universe / name registry
  // v57.81: unknown to every registry -> the lazy official US listing decides (exact symbol; only BRK.B -> BRK-B). Listed: saved with its official name; not listed: rejected below; unavailable: never saved.
  var pfListing = null, pfListingSym = typeof window._aioUsListingSymbol === 'function' ? window._aioUsListingSymbol(ticker) : ticker; if (!isKnown && typeof window._aioCheckUsListing === 'function') { try { pfListing = await window._aioCheckUsListing(pfListingSym); } catch (_) { pfListing = null; } if (!pfListing || pfListing.listed == null) { showToast('"' + (pfRawTicker || ticker) + '"는 AIO 종목 목록에 없어 미국 상장 목록과 대조해야 하는데, 지금 상장 목록을 불러오지 못해 저장하지 않았습니다. 잠시 후 다시 시도하세요.'); return; } if (pfListing.listed === true) { ticker = pfListingSym; isKnown = true; } }
  var krCode = /^\d{6}$/.test(ticker), krListed = krCode && typeof window._aioIsKnownTicker === 'function' && (window._aioIsKnownTicker(ticker) || window._aioIsKnownTicker(ticker + '.KS') || window._aioIsKnownTicker(ticker + '.KQ')), pfRefPrice = (ld[ticker] && +ld[ticker].price) || 0, pfWarn = krCode && !krListed ? '"' + ticker + '"는 AIO 한국 종목 목록에 없는 코드입니다. 시세·차트를 받지 못할 수 있어요. 코드가 맞으면 그대로 저장할까요?' : (!krCode && (costCurrency || 'USD') === 'USD' && (pfRefPrice > 0 ? cost > pfRefPrice * 10 : cost >= 50000 && ticker !== 'BRK-A')) ? '매수 단가(' + cost.toLocaleString() + ')는 달러로 저장됩니다' + (pfRefPrice > 0 ? '(현재가 $' + pfRefPrice.toFixed(2) + '의 10배 이상)' : '') + '. 원화로 산 금액이라면 원가 통화 칸에 KRW를 적어 주세요. 그대로 저장할까요?' : ''; if (isKnown && pfWarn && _pfConfirmedAdd !== ticker + '|' + cost) { showConfirmModal('입력값 확인', pfWarn, function() { _pfConfirmedAdd = ticker + '|' + cost; addPortfolioPosition(); }); return; } _pfConfirmedAdd = null;
  if (!isKnown) {
    window._aioMarkField?.('pf-add-ticker', 'ticker'); await window._aioToastWithNameHint(pfRawTicker || ticker, '"' + (pfRawTicker || ticker) + '" 검증되지 않은 티커라 저장하지 않았습니다. AIO 종목 목록에 정확히 같은 심볼이나 등록된 이름이 없습니다 — 거래소 심볼(예: AAPL, 005930)이나 회사 이름(예: 엔비디아)으로 다시 입력하세요. 미국 상장 목록에도 같은 심볼이 없습니다.'); // v57.81
    return;
  }

  const positions = getPortfolioData();
  var pfMain = document.getElementById('pf-main');
  if (pfMain) pfMain.classList.toggle('is-empty', positions.length === 0);
  const existing = positions.findIndex(p => p.ticker === ticker);
  if (existing >= 0) {
    const editing = document.getElementById('pf-add-ticker')?.dataset.editing === ticker; // P1592 (F15): an edit is not a duplicate
    showConfirmModal(editing ? '보유 내역 변경' : '이미 보유 중인 종목', editing ? ticker + ' 보유 내역을 이 값으로 변경할까요?' : '보유 목록에 이미 ' + ticker + ' 종목이 있습니다. 입력한 값으로 바꿀까요?', async function() {
      // E3/P1187: 통째 교체는 import로 들어온 sector·targetWeight·note·시세 통화를 지웠다 —
      // 폼이 소유한 필드만 덮어쓰고 나머지는 보존한다.
      positions[existing] = { ...positions[existing], ticker, qty, cost, target, memo, costCurrency, updatedAt: Date.now() };
      const saved = await savePortfolioData(positions);
      if (saved.reason !== 'other-tab' && _pfFormSnapshot() === pfFormAtSubmit) { clearPortfolioForm(); window._aioTogglePortfolioEntry(false); }
      renderPortfolio();
      showToast(saved.ok ? ticker + ' 업데이트 완료' : _pfSaveFailText(saved, '영구 저장 실패 — ' + ticker + ' 변경은 이 화면에만 반영됐습니다. 새로고침 전 다시 시도하세요.'));
    }, '');
    return;
  } else {
    positions.push({ ticker, qty, cost, target, memo, costCurrency, addedAt: Date.now(), updatedAt: Date.now() });
  }
  const saved = await savePortfolioData(positions);
  if (saved.reason !== 'other-tab' && _pfFormSnapshot() === pfFormAtSubmit) { clearPortfolioForm(); window._aioTogglePortfolioEntry(false); }
  window._aioRevealHolding = ticker; renderPortfolio(); // v58.80 run-5: portfolio.js scrolls to the new row
  // v48.3 신규 추가 토스트 → E3/P1181: 완료 문구는 durable ack 성공 뒤에만 노출된다.
  if (typeof showToast === 'function') {
    showToast(saved.ok
      ? ticker + ' 포지션 추가 완료' + (pfHolding && pfHolding.resolvedFrom ? ' ("' + pfHolding.resolvedFrom + '" = ' + ticker + ')' : '') + (pfListing && pfListing.listed === true && pfListing.name ? ', ' + pfListing.name : '') + ', 브라우저에 저장됨'
      : _pfSaveFailText(saved, '영구 저장 실패 — ' + ticker + ' 변경은 이 화면에만 반영됐습니다. 새로고침 전 다시 시도하세요.'));
  }
}
function removePosition(ticker) {
  showConfirmModal(
    ticker + ' 포지션 삭제',
    ticker + ' 종목이 포트폴리오에서 삭제됩니다. 계속하시겠습니까?',
    async function() {
      const positions = getPortfolioData().filter(p => p.ticker !== ticker);
      const saved = await savePortfolioData(positions);
      renderPortfolio(); window._aioFocusPortfolioAfterDelete?.(); // v57.81: focus left <body> (src/ui/components/shell-overlays.js)
      if (typeof showToast === 'function' && !saved.ok) {
        showToast(_pfSaveFailText(saved, '영구 저장 실패 — 삭제가 확정되지 않았습니다. 새로고침 시 되돌아올 수 있습니다.'));
      }
    },
    ''
  );
}
function editPosition(ticker) {
  const positions = getPortfolioData();
  const p = positions.find(pos => pos.ticker === ticker);
  if (!p) return;
  // P1449: "수정"은 안내만 던지지 않는다 — 편집 입력 폼이 닫혀 있으면 열어 준다.
  // (그렇지 않으면 스크롤+포커스가 접힌 섹션을 목표로 하고, 사용자는 어디를 편집하는지 못 본다.)
  try { if (typeof window._aioTogglePortfolioEntry === 'function') window._aioTogglePortfolioEntry(true); } catch(e) {}
  var tkEl = document.getElementById('pf-add-ticker');
  var qtyEl = document.getElementById('pf-add-qty');
  var costEl = document.getElementById('pf-add-cost');
  var tEl = document.getElementById('pf-add-target');
  var ccEl = document.getElementById('pf-add-cost-currency');
  var memoEl = document.getElementById('pf-add-memo');
  if (tkEl) { tkEl.value = p.ticker; tkEl.dataset.editing = p.ticker; }
  if (qtyEl) qtyEl.value = p.qty;
  if (costEl) costEl.value = p.cost;
  if (tEl) tEl.value = p.target || '';
  if (ccEl) ccEl.value = p.costCurrency || '';
  if (memoEl) memoEl.value = p.memo || '';
  _pfSyncEntryCurrencyLabels();
  // v48.3: 편집 UX 개선 — 폼으로 스크롤 + 포커스 + 토스트 안내 (사용자가 어디서 편집 중인지 명확화)
  if (tkEl) {
    try { tkEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) { tkEl.scrollIntoView(); }
    setTimeout(function(){ if (qtyEl) qtyEl.focus(); }, 400);
  }
  if (typeof showToast === 'function') showToast(ticker + ' 편집 모드 — 값 수정 후 "추가/업데이트" 버튼 클릭');
}
function clearPortfolioForm() {
  ['pf-add-ticker','pf-add-qty','pf-add-cost','pf-add-target','pf-add-memo','pf-add-cost-currency'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; delete el.dataset.editing; }
  });
  _pfSyncEntryCurrencyLabels();
}
// Codex browser audit H49: the price labels said "$" after KRW was chosen. They follow the declared cost
// currency, else the currency the ticker trades in (6-digit or .KS/.KQ = KRW), else USD.
function _pfEntryCurrency() {
  var ccEl = document.getElementById('pf-add-cost-currency');
  var tkEl = document.getElementById('pf-add-ticker');
  var cc = String(ccEl && ccEl.value || '').trim().toUpperCase();
  var raw = String(tkEl && tkEl.value || '').trim(), held = raw && typeof window._aioResolveHoldingInput === 'function' ? window._aioResolveHoldingInput(raw) : null;
  var tk = String((held && held.symbol) || raw).toUpperCase();
  return /^[A-Z]{3}$/.test(cc) ? cc : (/^\d{6}$/.test(tk) || /\.K[SQ]$/.test(tk) ? 'KRW' : 'USD');
}
function _pfSyncEntryCurrencyLabels() {
  var currency = _pfEntryCurrency();
  var costLabel = document.getElementById('pf-add-cost-label');
  var targetLabel = document.getElementById('pf-add-target-label');
  if (costLabel) costLabel.textContent = '매수 단가 (' + currency + ')';
  if (targetLabel) targetLabel.textContent = '내 목표가 (' + currency + ', 선택)';
}
if (typeof document !== 'undefined') document.addEventListener('input', function(event) {
  var id = event && event.target && event.target.id;
  if (id === 'pf-add-cost-currency' || id === 'pf-add-ticker') _pfSyncEntryCurrencyLabels();
});
// v58.80 F25: Enter submits the add form (not while composing Korean).
if (typeof document !== 'undefined') document.addEventListener('keydown', function(event) {
  var id = event && event.target && event.target.id;
  if (event.key !== 'Enter' || event.isComposing || !/^pf-add-(ticker|qty|cost|target|cost-currency|memo)$/.test(id || '')) return;
  event.preventDefault();
  addPortfolioPosition();
});
// ═══ Confirmation Modal 시스템 ═══════════════════════════════════════
var _confirmCallback = null;
var _confirmCancelCallback = null;
var _confirmSettled = true;
var _confirmPreviousFocus = null;
function showConfirmModal(title, msg, onConfirm, icon, onCancel) {
  // P1070/R592: replacing or dismissing a confirmation must settle the
  // previous caller exactly once; quota prompts rely on this for Promise
  // liveness when ESC, backdrop, or the delegated cancel action is used.
  if (!_confirmSettled && typeof _confirmCancelCallback === 'function') {
    var previousCancel = _confirmCancelCallback;
    _confirmSettled = true;
    _confirmCallback = null;
    _confirmCancelCallback = null;
    try { previousCancel('replaced'); } catch (_) {}
  }
  _confirmCallback = onConfirm;
  _confirmCancelCallback = typeof onCancel === 'function' ? onCancel : null;
  _confirmSettled = false;
  document.getElementById('aio-confirm-title').textContent = title;
  document.getElementById('aio-confirm-msg').textContent = msg;
  document.getElementById('aio-confirm-icon').textContent = icon || '';
  var okBtn = document.getElementById('aio-confirm-ok');
  if (okBtn._aioConfirmHandler) okBtn.removeEventListener('click', okBtn._aioConfirmHandler);
  okBtn._aioConfirmHandler = function() {
    if (_confirmSettled) return;
    var callback = _confirmCallback;
    _confirmSettled = true;
    closeConfirmModal('confirm');
    if (callback) callback();
  };
  okBtn.addEventListener('click', okBtn._aioConfirmHandler);
  var modal = document.getElementById('aio-confirm-modal');
  _confirmPreviousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  if (modal._aioTrapCleanup) modal._aioTrapCleanup();
  modal.style.display = 'flex'; modal.dataset.tone = /삭제|지우|초기화|제거|비우|덮어/.test(title + ' ' + msg) ? 'danger' : 'neutral'; // run-4: only removals are red
  modal._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(modal, function() { closeConfirmModal('trap'); }) : null;
  (document.getElementById('aio-confirm-cancel') || okBtn).focus(); // v58.80 run-5: Enter on arrival kept the old value; it no longer overwrote a holding
  // ESC 키로 닫기
  if (modal._escHandler) document.removeEventListener('keydown', modal._escHandler); // v46.9: 중복 등록 방지
  modal._escHandler = function(e) { if (e.key === 'Escape') closeConfirmModal('escape'); };
  document.addEventListener('keydown', modal._escHandler);
}
function closeConfirmModal(reason) {
  var modal = document.getElementById('aio-confirm-modal');
  var cancelCallback = !_confirmSettled && reason !== 'confirm' ? _confirmCancelCallback : null;
  _confirmSettled = true;
  modal.style.display = 'none';
  _confirmCallback = null;
  _confirmCancelCallback = null;
  if (modal._aioTrapCleanup) { modal._aioTrapCleanup(); modal._aioTrapCleanup = null; }
  if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
  var previousFocus = _confirmPreviousFocus;
  _confirmPreviousFocus = null;
  if (previousFocus && document.contains(previousFocus) && !previousFocus.disabled) { try { previousFocus.focus(); } catch (_) {} }
  if (cancelCallback) { try { cancelCallback(reason || 'dismissed'); } catch (_) {} }
}

// v48.14: showPromptModal — 네이티브 prompt() 대체 (Agent C5/P1-2 대응, R6 준수)
// 사용: showPromptModal('제목', '라벨', '기본값', function(value){ ... })
// value === null이면 취소, string이면 입력값 (빈 문자열 포함)
function showPromptModal(title, label, defaultValue, onSubmit, opts) {
  opts = opts || {};
  var previousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  // 기존 모달 있으면 제거
  var old = document.getElementById('aio-prompt-modal');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var modal = document.createElement('div');
  modal.id = 'aio-prompt-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'aio-prompt-title');
  // 오버레이·패널 스타일: src/ui/styles/legacy-workspace.css (#aio-prompt-modal)
  modal.innerHTML = '<div class="wsl-pm-box">' +
    '<div id="aio-prompt-title">' + escHtml(title || '입력') + '</div>' +
    '<div class="wsl-pm-label" style="font-size:12px;">' + escHtml(label || '') + '</div>' +
    '<input id="aio-prompt-input" type="text" aria-label="값 입력" placeholder="값을 입력하세요" maxlength="' + (opts.maxLength || 200) + '" />' +
    '<div class="wsl-pm-actions">' +
    '<button id="aio-prompt-cancel" style="font-size:12px;">취소</button>' +
    '<button id="aio-prompt-ok" style="font-size:12px;">확인</button>' +
    '</div></div>';
  document.body.appendChild(modal);
  var input = document.getElementById('aio-prompt-input');
  input.value = defaultValue || '';
  modal._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(modal, function() { _close(null); }) : null;
  input.focus();
  input.select();
  var closed = false;
  function _close(val) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', _esc);
    if (modal._aioTrapCleanup) { modal._aioTrapCleanup(); modal._aioTrapCleanup = null; }
    if (modal.parentNode) modal.parentNode.removeChild(modal);
    if (previousFocus && document.contains(previousFocus) && !previousFocus.disabled) { try { previousFocus.focus(); } catch (_) {} }
    try { if (typeof onSubmit === 'function') onSubmit(val); } catch(e) { if (typeof _aioLog === 'function') _aioLog('error', 'modal', 'prompt onSubmit failed: ' + e.message); }
  }
  function _esc(e) {
    if (e.key === 'Escape') { e.preventDefault(); _close(null); }
    else if (e.key === 'Enter') { e.preventDefault(); _close(input.value); } // v58.80 B18: stop the Enter from reopening the prompt
  }
  document.addEventListener('keydown', _esc);
  document.getElementById('aio-prompt-cancel').addEventListener('click', function() { _close(null); });
  document.getElementById('aio-prompt-ok').addEventListener('click', function() { _close(input.value); });
  modal.addEventListener('click', function(e) { if (e.target === modal) _close(null); });
}

function clearAllPositions() {
  showConfirmModal(
    '포트폴리오 전체 삭제',
    '모든 포지션이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?',
    // E3/P1187 (11 P11-01): 이 경로는 savePortfolioData의 반환을 버려 persist가 거부돼도 조용히
    // 성공한 것처럼 보였다 — 삭제도 durable ack 뒤에만 확정으로 말한다.
    async function() {
      const saved = await savePortfolioData([], { replace: true });
      renderPortfolio(); window._aioFocusPortfolioAfterDelete?.(); // v57.81: focus left <body> (src/ui/components/shell-overlays.js)
      if (typeof showToast === 'function' && !saved.ok) {
        showToast('영구 저장 실패 — 전체 삭제가 확정되지 않았습니다. 새로고침 시 되돌아올 수 있습니다.');
      }
    },
    ''
  );
}

// Render Portfolio
function renderPortfolio() {
  // Codex review 2026-10-05: after deleting the last holding the table emptied but the sector concentration
  // bubble kept "Technology 100%" until a reload — it was drawn only on page entry. It follows every render.
  try { if (document.getElementById('page-portfolio')?.classList.contains('active') && typeof window._aioRenderPageDiagram === 'function') window._aioRenderPageDiagram('portfolio'); } catch (_) {}
  // v52.46 WO-1A: 실제 잠금 게이트 — 이전엔 이 자리를 지키던 checkPortfolioPin()이
  // 어디서도 호출되지 않는 고아 함수라 PIN이 설정돼도 진입 시 잠금화면이 뜬 적이 없었다(R294).
  if (typeof isPortfolioLocked === 'function' && isPortfolioLocked()) {
    var lock = document.getElementById('pf-lock-screen');
    var main = document.getElementById('pf-main');
    if (lock) lock.style.display = 'block';
    if (main) main.style.display = 'none';
    return;
  }
  const positions = getPortfolioData(); try { window._pfPortfolioBackup.renderReminder(positions.length); } catch (_) {} // v58.84 backup reminder
  let ld = window._liveData || {};
  const tbody = document.getElementById('pf-positions-tbody');
  if (!tbody) return;
  var _nativePortfolioTable = tbody.dataset.aioPortfolioTableRenderer === 'native';
  var _pfEmpty = positions.length === 0;
  var _pfMain = document.getElementById('pf-main');
  if (_pfMain) _pfMain.classList.toggle('is-empty', _pfEmpty);
  ['pf-benchmark-section','pf-holdings-analysis-section','pf-risk-panel'].forEach(function(id) { // v57.81: 비중·섹터 stays visible when empty (it holds the cash boxes)
    var el = document.getElementById(id);
    if (el) el.hidden = _pfEmpty;
  });
  // v48.47: R:R 계산기 포지션 드롭다운 동기화
  try { if (typeof window._aioRRPopulateSelect === 'function') window._aioRRPopulateSelect(); } catch(_){}
  try { if (typeof window._aioSyncPortfolioAiWorkbench === 'function') window._aioSyncPortfolioAiWorkbench(); } catch(_){}

  if (positions.length === 0) {
    // v59.42: the empty-state row is the native page's (src/ui/pages/portfolio.js renderPortfolioTable); this one was
    // replaced within ~1.4 s of every portfolio entry.
    // v48.3: 빈 상태에서도 도넛 리셋(이전 데이터 잔존 방지)
    if (typeof drawPositionDonut === 'function') drawPositionDonut();
    try { if (typeof window._aioSyncPortfolioAiWorkbench === 'function') window._aioSyncPortfolioAiWorkbench(); } catch(_){}
    return;
  }

  // v59.42: the holdings rows are built by the native page only (renderPortfolioTable, which flags the tbody 'native').
  // The legacy row builder painted first on every portfolio entry and showed each holding as "(시세 미수신)" with no
  // price, P&L or weight for ~0.7-1.4 s until native replaced it, so before native mounts a neutral row stands in.
  if (!_nativePortfolioTable) tbody.innerHTML = '<tr><td colspan="10" class="pfp-empty">보유 ' + positions.length + '종목을 불러오는 중입니다</td></tr>';

  // v40.4: 포지션 도넛 + 섹터 브레이크다운 갱신
  drawPositionDonut();
  // v57.81: the per-currency cash boxes are restored by the native portfolio page from the same balances it totals.
  // E3/E4/P1188: 선언 필드 복원 — 저장된 원문(코드/퍼센트)을 그대로 되돌린다.
  var _pfApi = _pfAssumptionApi();
  if (_pfApi && _pfApi.keys) {
    Object.keys(PF_ASSUMPTION_FIELDS).forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      try { el.value = localStorage.getItem(_pfApi.keys[PF_ASSUMPTION_FIELDS[id].key]) || ''; } catch(e) { el.value = ''; }
    });
    // P1201: 정책은 전략 경로에서만 소비된다 — 회고 경로에서는 비활성으로 그 사실을 드러낸다(선언은 보존).
    var pathEl = document.getElementById('pf-exposure-path-input');
    var policyEl = document.getElementById('pf-rebalance-policy-input');
    if (pathEl && policyEl) {
      var strategyPathSelected = pathEl.value === 'fixed_target_weight_strategy';
      policyEl.disabled = !strategyPathSelected;
      policyEl.setAttribute('aria-disabled', strategyPathSelected ? 'false' : 'true');
      policyEl.title = strategyPathSelected ? '' : '지금 구성 그대로 방식에서는 리밸런싱 정책이 쓰이지 않습니다.';
    }
  }
  // E4/P1191: 원장 입력도 같은 화면 복원 주기에 함께 수화한다.
  try { renderPortfolioLedger(); } catch(e) {}
  // E3/P1194: FX leg 목록도 같은 주기에 수화한다(사용 가능/창 초과 표시 포함).
  try { renderPortfolioFxLegs(); } catch(e) {}
  try { if (typeof window._aioSyncPortfolioAiWorkbench === 'function') window._aioSyncPortfolioAiWorkbench(); } catch(_){}
  try { if (typeof _aioRenderPortfolioHoldingCharts === 'function') _aioRenderPortfolioHoldingCharts(positions, ld); } catch(_){}
}

// v52.65 아이보리 리디자인 4a: 보유 종목 AI 차트 분석 — 시안의 "보유 종목별 미니차트+MA+지지저항" 카드.
// 기존 window._fetchYahooChartData(범용 OHLCV 유틸, v50.38 복구분)를 재사용해 신규 데이터 경로 없이 구현.
function _aioRenderPortfolioHoldingCharts(positions, ld) {
  var container = document.getElementById('pf-holdings-charts');
  if (!container) return;
  positions = positions || (typeof getPortfolioData === 'function' ? getPortfolioData() : []);
  ld = ld || window._liveData || {};
  if (!positions.length) {
    container.innerHTML = '<div class="wsl-hc-empty">포지션을 추가하면 종목별 차트 분석이 표시됩니다</div>';
    return;
  }
  if (typeof window._fetchYahooChartData !== 'function') {
    container.innerHTML = '<div class="wsl-hc-empty">차트 데이터 유틸 미로드 — 잠시 후 다시 시도하세요</div>';
    return;
  }
  // 종목당 외부 fetch 1회씩 발생 — 카드 밀도/요청 수를 함께 고려해 최대 6종목으로 제한
  var tickers = positions.map(function(p) { return p.ticker; }).slice(0, 6);
  container.innerHTML = tickers.map(function(t) {
    var tEsc = escHtml(t);
    return '<div class="aio-widget wsl-hc" id="pf-hc-' + tEsc + '" data-action="_aioTechnicalTicker" data-arg="' + tEsc +
      '" role="button" tabindex="0" aria-label="' + tEsc + ' 종목, 차트로 이동">' +
      '<div class="wsl-hc-wait">' + tEsc + ' 차트 로딩 중…</div></div>';
  }).join('');

  tickers.forEach(function(ticker) {
    var live = ld[ticker] || {};
    window._fetchYahooChartData(/^\d{6}$/.test(ticker) && typeof krTickerToYahoo === 'function' ? krTickerToYahoo(ticker) : ticker, '3mo', '1d').then(function(data) { // v57.55 B4-F5: 105560 -> 105560.KS
      var card = document.getElementById('pf-hc-' + ticker);
      if (!card) return;
      var closes = data && data.closes ? data.closes.filter(function(v) { return v != null && isFinite(v); }) : [];
      if (closes.length < 10) {
        card.innerHTML = '<div class="wsl-hc-wait">' + escHtml(ticker) + ' — 차트 데이터 수신 실패</div>';
        return;
      }
      function sma(period) {
        if (closes.length < period) return null;
        var s = 0; for (var j = closes.length - period; j < closes.length; j++) s += closes[j];
        return s / period;
      }
      var price = (live.price != null && isFinite(live.price)) ? live.price : closes[closes.length - 1];
      var chg = (live.pct != null && isFinite(live.pct)) ? live.pct : null;
      var ma5 = sma(5), ma20 = sma(20), ma50 = sma(50);
      var recent = closes.slice(-20);
      var resistance = Math.max.apply(null, recent);
      var support = Math.min.apply(null, recent);
      var aligned = ma5 != null && ma20 != null && ma50 != null && ma5 > ma20 && ma20 > ma50;
      var bearish = ma5 != null && ma20 != null && ma50 != null && ma5 < ma20 && ma20 < ma50;
      var verdict = aligned ? '정배열' : bearish ? '역배열' : '혼조';
      var verdictColor = aligned ? 'var(--data-green)' : bearish ? 'var(--data-red)' : 'var(--text-secondary)';
      var w = 240, h = 60;
      var lo = Math.min.apply(null, closes), hi = Math.max.apply(null, closes);
      var span = (hi - lo) || 1;
      var pathPts = closes.map(function(c, idx) {
        return (idx / (closes.length - 1) * w).toFixed(1) + ',' + (h - ((c - lo) / span * h)).toFixed(1);
      }).join(' ');
      var chgColor = chg != null ? (chg >= 0 ? 'var(--dir-up)' : 'var(--dir-down)') : 'var(--text-muted)';
      card.innerHTML =
        '<div class="wsl-hc-head">' +
          '<span class="wsl-hc-ticker">' + escHtml(ticker) + '</span>' +
          '<span class="wsl-hc-verdict" style="color:' + verdictColor + ';">' + verdict + '</span>' +
        '</div>' +
        '<div class="wsl-hc-quote">' +
          '<span class="wsl-hc-last">' + price.toFixed(2) + '</span>' +
          (chg != null ? '<span class="wsl-hc-move" style="color:' + chgColor + ';">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>' : '') +
        '</div>' +
        '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="wsl-hc-spark" role="img" aria-label="' + escHtml(ticker) + ' 최근 3개월 가격 추이">' +
          '<polyline points="' + pathPts + '" fill="none" stroke="#1b1a17" class="wsl-hc-line" stroke-width="1.6"></polyline>' +
        '</svg>' +
        '<div class="wsl-hc-levels">' +
          '<div class="wsl-hc-level"><span class="wsl-note">MA5 / MA20 / MA50</span><span class="wsl-hc-level-v">' +
            (ma5 != null ? ma5.toFixed(1) : '—') + ' / ' + (ma20 != null ? ma20.toFixed(1) : '—') + ' / ' + (ma50 != null ? ma50.toFixed(1) : '—') + '</span></div>' +
          '<div class="wsl-hc-level"><span class="wsl-note">20일 저항 / 지지</span><span class="wsl-hc-level-v">' +
            resistance.toFixed(1) + ' / ' + support.toFixed(1) + '</span></div>' +
        '</div>' +
        '<div class="wsl-hc-more">종목, 차트에서 상세 보기 →</div>';
    }).catch(function() {
      var card = document.getElementById('pf-hc-' + ticker);
      if (card) card.innerHTML = '<div class="wsl-hc-wait">' + escHtml(ticker) + ' — 차트 데이터 수신 실패</div>';
    });
  });
}
window._aioRenderPortfolioHoldingCharts = _aioRenderPortfolioHoldingCharts;

// v59.42: _pfLegacyMoney / _pfLegacyCurrencyOf (P1449) left with the legacy row builder; native rows format money per currency.
// v57.77: updatePortfolioSummary() only fed the retired 포트폴리오 자동 진단 (#pf-analysis-text) and left with it.

function refreshPortfolioPrices() {
  const positions = getPortfolioData();
  if (!positions.length) return;
  // v48.27 (QA-2): fetchYahooQuotes 미정의 무음 실패 → 정상 경로 복구
  // (1) fetchLiveQuotes 우선 (KNOWN_TICKERS 글로벌 갱신, 검증된 함수)
  // (2) 포트폴리오 전용 종목(KNOWN_TICKERS 미포함)은 _fetchYahooChartData로 개별 보강
  const tickers = positions.map(p => p.ticker);
  const _portfolioRefreshFlow = (async function() {
    try {
      if (typeof fetchLiveQuotes === 'function') {
        await fetchLiveQuotes();
      }
      // 보강: _liveData에 누락된 종목만 개별 fetch
      if (typeof _fetchYahooChartData === 'function' && typeof window._liveData === 'object') {
        const missing = tickers.filter(function(t) { return !window._liveData[t]; });
        if (missing.length) {
          await Promise.allSettled(missing.slice(0, 10).map(async function(t) {
            try {
              const d = await _fetchYahooChartData(t, '5d');
              if (d && d.closes && d.closes.length >= 2) {
                const last = d.closes[d.closes.length - 1];
                const prev = d.closes[d.closes.length - 2];
                const pct = prev > 0 ? ((last - prev) / prev) * 100 : null;
                if (typeof window._aioSetLiveData === 'function') {
                  window._aioSetLiveData(t, { price: last, pct: pct }, { source: 'fallback:yahoo-chart', policyKey: 'quote_afterhours', reason: 'portfolio missing quote chart fallback' });
                } else {
                  window._liveData[t] = { price: last, pct: pct, pctMissing: pct === null };
                }
              }
            } catch(_){}
          }));
        }
      }
    } catch(e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'refreshPortfolioPrices 실패: ' + (e && e.message || e));
    }
    renderPortfolio();
  });
  _portfolioRefreshFlow();
}

// ══ v48.88: 포트폴리오 리스크 분석 (data:statistical-analysis 방법론) ══

// E4/P1191 + P1449: 원장 계좌 성과(TWR/MWR)는 ledger·규약 선언만으로 계산되는 자체 엔진이다.
// Yahoo 시세 이력 게이트(조정주가·공통 거래일)와 무관하게 도달해야 하므로, 시세 기반 리스크
// refresh에서 분리해 별도 요약으로 렌더한다 — 보류 사유도 이 엔진 자신의 message를 그대로 쓴다.
function refreshPortfolioLedgerPerformance() {
  var host = document.getElementById('pf-ledger-performance');
  if (!host) return null;
  var accountLedger = (typeof getPortfolioLedger === 'function') ? getPortfolioLedger() : null;
  var declarations = (typeof readPortfolioAssumptionDeclarations === 'function') ? readPortfolioAssumptionDeclarations() : {};
  var accountPerf = (typeof window._pfAssessAccountPerformance === 'function')
    ? window._pfAssessAccountPerformance({
      ledger: accountLedger ? Object.assign({}, accountLedger, { currency: accountLedger.currency || declarations.baseCurrency || null }) : null
    }) : null;
  window._lastPortfolioLedgerPerformance = accountPerf || null;
  if (!accountPerf) { host.hidden = true; return null; }
  var perfPct = function(v) { return v == null ? '보류' : (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; };
  var html;
  if (accountPerf.status === 'ready') {
    // v57.92: a TWR whose flows fall between valuations is a boundary approximation — named as such, with the engine's reason.
    var twrApprox = accountPerf.twrExact === false;
    html = '<b>실제 계좌 성과 TWR(기간 누적' + (twrApprox ? ', 근사' : '') + ') ' + _escHtmlSafe(perfPct(accountPerf.twr)) + ', MWR(연율) ' + _escHtmlSafe(perfPct(accountPerf.mwr)) + '</b> — ' // #6: different units, both named
      + _escHtmlSafe(accountPerf.currency + ', ' + (accountPerf.flowTiming === 'start-of-period' ? '입출금 기간 시작 반영' : '입출금 기간 끝 반영') + ', ' + accountPerf.sample.periods + '기간 ' + accountPerf.sample.from + '~' + accountPerf.sample.to)
      + ((accountPerf.warnings || []).length ? ', ' + _escHtmlSafe(accountPerf.warnings.join(' ')) : '')
      + ' (시세 이력 검증과 무관하게 원장 규약 선언만으로 계산됩니다)';
  } else {
    html = '<b>실제 계좌 성과(TWR/MWR) 보류</b> — ' + _escHtmlSafe(accountPerf.message || '원장 규약이 선언되지 않았습니다') + '. 원장 항목·규약을 선언하면 시세 이력과 무관하게 계산됩니다.';
  }
  host.innerHTML = html;
  host.hidden = false;
  return accountPerf;
}

// v58.63 (architecture audit LEGACY03): a calculation for holdings A that finished after the holdings changed to B
// replaced B's hold message with A's metrics and _lastPortfolioRiskEstimate. Each run takes a number and the holdings it
// read; after the history wait it publishes only if it is still the latest run for the same holdings.
var _pfRiskEpoch = 0;
async function refreshPortfolioRisk() {
  // P1449: 원장 계좌 성과는 시세 이력 게이트와 독립 계산 — 어떤 보류에서도 항상 갱신한다.
  try { refreshPortfolioLedgerPerformance(); } catch(e) {}
  // v59.05: the panel is src/ui/components/portfolio-risk-metrics.js. A run before that module is installed is
  // remembered and repeated on install.
  if (typeof window._aioRenderPortfolioRiskStatus !== 'function') { window._aioPortfolioRiskPending = true; return; }
  var status = function(text, warn) { return window._aioRenderPortfolioRiskStatus(text, warn); };
  const positions = getPortfolioData();
  if (positions.length < 1) {
    status('포지션을 먼저 추가하세요.');
    return;
  }
  if (!status('가격 데이터 요청 중...')) return;
  const riskEpoch = ++_pfRiskEpoch;
  const riskHoldings = JSON.stringify(positions);

  const tickers = positions.map(function(p) { return p.ticker; });
  const historyMap = {};

  // 각 종목 Yahoo Finance 1년 가격 기록 fetch — v57.50 D03: 3개월(~62일) 표본은 99% 꼬리·Sharpe·MDD를 말하기에
  // 짧았다. 요청 수는 같고(종목당 1회) 응답만 ~250행으로 늘어난다.
  await Promise.allSettled(tickers.map(async function(t) {
    try {
      if (typeof _fetchYahooChartData === 'function') {
        const d = await _fetchYahooChartData(t, '1y');
        var adjusted = d && (Array.isArray(d.adjustedCloses) ? d.adjustedCloses : d.adjCloses);
        var timestamps = d && Array.isArray(d.timestamps) ? d.timestamps : [];
        if (!d || !Array.isArray(adjusted) || adjusted.length !== timestamps.length || d.backtestEligible === false) return;
        var byDate = {};
        for (var i = 0; i < timestamps.length; i++) {
          var ts = Number(timestamps[i]);
          var close = Number(adjusted[i]);
          if (!isFinite(ts) || !isFinite(close) || close <= 0) continue;
          if (ts < 1e12) ts *= 1000;
          var day = new Date(ts);
          if (isNaN(day.getTime())) continue;
          byDate[day.toISOString().slice(0, 10)] = close;
        }
        if (Object.keys(byDate).length >= 6) historyMap[t] = byDate;
      }
    } catch(_) {}
  }));
  // Everything after this wait is synchronous, so one check covers every hold and publish below.
  if (riskEpoch !== _pfRiskEpoch || JSON.stringify(getPortfolioData()) !== riskHoldings) return;

  const validTickers = positions.map(function(p) { return p.ticker; }).filter(function(t) { return historyMap[t]; });
  const missingHistory = tickers.filter(function(t) { return !historyMap[t]; });
  if (missingHistory.length) {
    status('조정주가·날짜 이력이 없는 종목이 있어 리스크 계산을 보류합니다: ' + missingHistory.join(', ') + '.', true);
    return;
  }

  // Align by the actual date intersection. Tail-slicing each array can pair
  // different trading sessions around holidays and produces false covariance.
  var commonDates = validTickers.reduce(function(acc, ticker) {
    var dates = Object.keys(historyMap[ticker]);
    if (!acc) return dates;
    var set = {}; dates.forEach(function(day) { set[day] = true; });
    return acc.filter(function(day) { return set[day]; });
  }, null) || [];
  commonDates.sort();
  if (commonDates.length < 6) {
    status('종목 간 공통 거래일이 6일 미만이라 리스크 계산을 보류합니다.', true);
    return;
  }

  // P1258: 위험 입력 조립(입력 자격·구성 스냅샷·returnsMap·estimate 호출)은 네이티브
  // src/ui/panels/portfolio-risk-input.js가 소유한다 — 셸은 증거 수집(_aioDecisionMetric),
  // 사유별 문구, 렌더만 남긴다(P1195/P1199 선례의 분해 잔여 해소).
  var priceEvidenceMap = {};
  positions.forEach(function(p) {
    priceEvidenceMap[p.ticker] = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
  });
  var cashValue = 0, _pfCash = window._pfPortfolioCash || null; // v57.81: the per-currency balances below are the cash input
  var cashBalances = _pfCash ? _pfCash.read().balances : null;
  var declarations = readPortfolioAssumptionDeclarations();
  var assembled = (typeof window._pfAssembleRiskEstimateInput === 'function') ? window._pfAssembleRiskEstimateInput({
    positions: positions,
    priceEvidenceMap: priceEvidenceMap,
    historyMap: historyMap,
    validTickers: validTickers,
    commonDates: commonDates,
    cashValue: cashValue,
    cashBalances: cashBalances, cashFx: _pfCash ? _pfCash.appFx() : null, // v57.81: one balance per currency, app USD/KRW close
    declarations: declarations, fxLegs: getPortfolioFxLegs(), // P1407: one base currency for weights
    // P1445: completed USD/KRW closes so foreign holdings' returns include the currency move
    fxHistory: (window._aioHistory || []).map(function(r) { var m = r && r.fieldMeta && r.fieldMeta.usdkrw; return { date: String((m && m.observedAt) || (r && r.date) || '').slice(0, 10), value: r && r.usdkrw }; })
  }) : null;
  if (!assembled || !assembled.ok) {
    var holdCode = (assembled && assembled.code) || 'risk-input-unavailable';
    status((
      holdCode === 'missing-current'
        ? '현재 시세가 없는 종목은 원가로 평가액을 대체하지 않습니다. 갱신 후 다시 시도하세요: ' + ((assembled && assembled.tickers) || []).join(', ') + '.'
        : holdCode === 'no-current-value' ? '현재 평가액을 산출할 수 없어 리스크 계산을 보류합니다.'
          : holdCode === 'common-dates-insufficient' ? '종목 간 공통 거래일이 6일 미만이라 리스크 계산을 보류합니다.' : holdCode === 'currency-mixed-no-base' ? '통화가 다른 종목이 섞여 있어 기준 통화를 선언해야 비중·위험을 계산할 수 있습니다.' : holdCode === 'currency-unconverted' ? '환율 근거가 없거나 오래돼(' + ((assembled && assembled.pairs) || []).join(', ') + ') 비중·위험 계산을 보류합니다. 포트폴리오 설정에서 환율을 선언하세요.'
            : '위험 추정 입력을 확정하지 못해 보류합니다: ' + holdCode + '.'
    ), true);
    return;
  }
  var returnsMap = assembled.returnsMap;
  var snapshot = assembled.snapshot;
  var estimate = assembled.estimate;
  var minLen = assembled.minLen;
  if (!estimate || estimate.status !== 'ready') {
    status('위험 추정 입력을 확정하지 못해 보류합니다: ' +
      ((estimate && estimate.code) || (snapshot && snapshot.blocked && snapshot.blocked.code) || 'composition-snapshot-unavailable') + '.', true);
    return;
  }
  var pfReturns = estimate.publishedReturns;

  // 각 지표 계산
  const var95  = (typeof _calcPortfolioVaR === 'function') ? _calcPortfolioVaR(pfReturns, 0.95) : null;
  const var99  = (typeof _calcPortfolioVaR === 'function') ? _calcPortfolioVaR(pfReturns, 0.99) : null;
  // 22:PFR03 (E4): RF는 선언 입력에서만 온다. 미선언·무효면 Sharpe를 보류한다 —
  // 고정 상수를 라벨 뒤에 숨기지 않는다(P1182에서 제거).
  const rfAnnual = (estimate.rf && estimate.rf.status === 'accepted') ? estimate.rf.annualRate : null;
  const sharpe = (typeof _calcSharpe === 'function') ? _calcSharpe(pfReturns, rfAnnual) : null;
  const mddRes = (typeof _calcMaxDrawdown === 'function') ? _calcMaxDrawdown(pfReturns) : null;
  const corrRes = (validTickers.length >= 2 && typeof _calcCorrelationMatrix === 'function')
    ? _calcCorrelationMatrix(returnsMap) : null;
  // v57.50 D04: a Korean and a US close on the same calendar date are ~16 hours apart, so pairing them day by day
  // understates their co-movement. Mixed-market cells use 5-session (weekly) returns from the same common dates;
  // fewer than 8 weekly pairs leaves the cell as '비동시' instead of a number.
  if (corrRes && Array.isArray(corrRes.tickers) && Array.isArray(corrRes.matrix)) {
    var _mktOfPf = function(sym) { return /\.(KS|KQ)$/i.test(String(sym || '')) ? 'KR' : 'US'; };
    var _weeklyPf = function(sym) {
      var px = historyMap[sym]; if (!px) return null;
      var out = [];
      for (var k = commonDates.length - 1; k - 5 >= 0; k -= 5) {
        var a = px[commonDates[k - 5]], b = px[commonDates[k]];
        if (!(a > 0) || !(b > 0)) return null;
        out.unshift(b / a - 1);
      }
      return out;
    };
    corrRes.mixedMarket = corrRes.tickers.map(function(a) { return corrRes.tickers.map(function(b) { return _mktOfPf(a) !== _mktOfPf(b); }); });
    corrRes.weeklyN = null;
    corrRes.tickers.forEach(function(a, i) {
      corrRes.tickers.forEach(function(b, j) {
        if (i === j || !corrRes.mixedMarket[i][j]) return;
        var wa = _weeklyPf(a), wb = _weeklyPf(b);
        corrRes.matrix[i][j] = wa && wb && wa.length >= 8 ? _pfPearson(wa, wb) : null;
        if (wa) corrRes.weeklyN = wa.length;
      });
    });
  }

  // E4/P1191 → P1449: 원장 계좌 성과는 시세 이력과 무관한 자체 패널(pf-ledger-performance)로
  // 분리됐다(refreshPortfolioLedgerPerformance) — 시세 이력이 없어도 TWR/MWR에 도달한다.
  var accountPerf = window._lastPortfolioLedgerPerformance || null;
  window._lastPortfolioRiskEstimate = { estimate: estimate, snapshot: snapshot, accountPerformance: accountPerf, rfAnnual: rfAnnual, checkedAt: Date.now() };
  window._aioRenderPortfolioRiskMetrics({ var95: var95, var99: var99, sharpe: sharpe, mddRes: mddRes,
    corrRes: corrRes, validTickers: validTickers, n: minLen, rfAnnual: rfAnnual,
    estimate: estimate, fxExcluded: !!(assembled && assembled.fxIncluded === false) }); // P1445
  try { window._aioRenderPortfolioExposure(positions, returnsMap); } catch(_) {}   // v50.54 3D
  try { window._aioRenderPortfolioStress(positions, historyMap, commonDates); } catch(_) {} // v50.54 3E
  try { refreshPortfolioTechnicalRisk(); } catch(_) {}
}

// Pearson correlation for the risk matrix and the exposure panel's mean pairwise correlation (window._pfPearson).
function _pfPearson(a, b) {
  var n = Math.min(a.length, b.length); if (n < 3) return null;
  a = a.slice(-n); b = b.slice(-n);
  var ma = 0, mb = 0, i; for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  var num = 0, da = 0, dbb = 0; for (i = 0; i < n; i++) { var x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; dbb += y * y; }
  return (da > 0 && dbb > 0) ? num / Math.sqrt(da * dbb) : null;
}
// v59.04: the exposure panel and the stress panel placement moved to src/ui/components/portfolio-exposure.js
// (window._aioRenderPortfolioExposure / _aioRenderPortfolioStress, installed by src/app/legacy-screen-bridges.js).
function _escHtmlSafe(s){ return (typeof escHtml==='function') ? escHtml(String(s)) : String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

async function refreshPortfolioTechnicalRisk() {
  var el = document.getElementById('pf-technical-risk');
  if (!el) return;
  var positions = getPortfolioData();
  if (!positions.length) {
    if (typeof renderPortfolioTechnicalRisk === 'function') renderPortfolioTechnicalRisk({ items: [] });
    return;
  }
  var _sf = window._aioPortfolioSurface, _sr = {}, _costOk = !!_sf && !(_sf.conversion && _sf.conversion.costHeld && _sf.conversion.costHeld.length); if (_sf && _sf.currencyState !== 'mixed-without-conversion') (_sf.rows || []).forEach(function(r) { _sr[r.symbol] = r; }); // #2: weights from the surface's base-currency values, not price × qty in each listing currency
  var enriched = positions.map(function(p) {
    var evidence = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
    var row = _sr[String(p.ticker || '').toUpperCase()], q = Number(p.qty), price = evidence && evidence.allowedUse === true && row && row.value > 0 && q > 0 ? row.value / q : null; // per-share base value; calcPositionTechnicalRisk multiplies it back by qty
    return Object.assign({}, p, {
      price: price, cost: price != null && _costOk && row.cost != null ? row.cost / q : null,
      value: price != null ? row.value : null,
      currentQuoteAllowedUse: evidence && evidence.allowedUse === true,
      quoteSourceKind: evidence && evidence.allowedUse === true ? 'live-quote' : 'unavailable',
      quoteObservedAt: evidence && evidence.allowedUse === true ? evidence.ts : null
    });
  });
  var totalValue = enriched.every(function(p) { return p.value != null && isFinite(p.value) && p.value >= 0; })
    ? enriched.reduce(function(s, p) { return s + p.value; }, 0) : null;
  var tickers = enriched.slice().sort(function(a, b) { return (b.value || 0) - (a.value || 0); }).slice(0, 12);
  el.innerHTML = '<div class="wsl-msg">포지션별 OHLCV와 기술 리스크를 산출하는 중입니다...</div>';
  var settled = await Promise.allSettled(tickers.map(async function(p) {
    var data = [];
    try {
      data = (typeof fetchOHLCVWithFallback === 'function') ? await fetchOHLCVWithFallback(p.ticker, '1day', 260) : [];
    } catch(_) { data = []; }
    var item = (typeof calcPositionTechnicalRisk === 'function')
      ? calcPositionTechnicalRisk(Object.assign({}, p, { dataQuality: data && data.dataQuality }), data, { totalValue: totalValue })
      : { ticker: p.ticker, score: null, action: 'WAIT', state: 'DATA_INSUFFICIENT', weightPct: null };
    return item;
  }));
  var items = settled.map(function(r) { return r.status === 'fulfilled' ? r.value : null; }).filter(Boolean);
  var result = (typeof calcPortfolioTechnicalRisk === 'function')
    ? calcPortfolioTechnicalRisk(enriched, items, { totalValue: totalValue })
    : { state: 'PORTFOLIO_HEAT_UNKNOWN', heatScore: null, action: 'WAIT', items: items, totalValue: totalValue };
  window._lastPortfolioTechnicalRisk = { result: result, ts: Date.now() };
  if (typeof renderPortfolioTechnicalRisk === 'function') renderPortfolioTechnicalRisk(result);
}
window.refreshPortfolioTechnicalRisk = refreshPortfolioTechnicalRisk;

// v59.05: the 리스크 지표 panel renderer and its status lines moved to src/ui/components/portfolio-risk-metrics.js.

// v59.03: the backtest lab result renderer and its formatters moved to src/ui/components/portfolio-backtest-lab.js
// (window._aioRenderPortfolioBacktestLab and window._aioBtVarCertLabel, installed by src/app/legacy-screen-bridges.js).

async function runPortfolioBacktestLab() {
  var status = function(text, warn) { if (typeof window._aioRenderPortfolioBacktestStatus === 'function') window._aioRenderPortfolioBacktestStatus(text, warn); };
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  if (!positions || !positions.length) {
    status('보유 종목을 먼저 추가하세요.', true);
    return;
  }
  // v58.80 (first-users bundle 6): -1000, 1800/3000 and 1e309 ran on silently; src/ui/components/input-check.js reads the form.
  var form = typeof window._aioReadBacktestInputs === 'function' ? await window._aioReadBacktestInputs().catch(function() { return null; }) : null; if (!form) form = { ok: false, reason: '입력 확인 도구를 아직 불러오지 못했습니다. 잠시 뒤 다시 실행하세요.' }; // run 4 breaker #6
  if (!form.ok) { status(form.reason, true); return; }
  var initial = form.initial, startYear = form.startYear, rebalance = form.rebalance, benchmark = form.benchmark;
  var tickers = positions.map(function(p) { return String(p.ticker || '').trim().toUpperCase(); }).filter(Boolean);
  if (benchmark && tickers.indexOf(benchmark) < 0) tickers.push(benchmark);
  status('월말 가격 이력을 수집하는 중입니다... (' + tickers.join(', ') + ')', false);
  var priceMap = {};
  var settled = await Promise.allSettled(tickers.map(async function(t) {
    var d = (typeof _fetchYahooChartData === 'function') ? await _fetchYahooChartData(t, '10y', '1d') : null;
     if (d && d.timestamps && d.closes && (Array.isArray(d.adjustedCloses) || Array.isArray(d.adjCloses)) && d.backtestEligible !== false) priceMap[t] = d;
  }));
  var failed = tickers.filter(function(t) { return !priceMap[t]; });
  // P1259 (QA-FX-SERIES): 기준 통화 수익률은 월말 관측 FX 시계열을 요구한다 — 랩과 같은 chart 경로로
  // KRW=X를 관측해 넘기고, 못 얻으면 엔진이 현지 통화 결과만 게시한다(추정하지 않음).
  var fxSeries = null;
  try {
    var fxD = (typeof _fetchYahooChartData === 'function') ? await _fetchYahooChartData('KRW=X', '10y', '1d') : null;
    if (fxD && fxD.timestamps && fxD.closes && fxD.closes.length) fxSeries = { usdkrw: { timestamps: fxD.timestamps, closes: fxD.closes } };
  } catch (e) { fxSeries = null; }
  var model = window.AIO && typeof window.AIO.buildPortfolioBacktestLab === 'function'
    ? window.AIO.buildPortfolioBacktestLab(priceMap, positions, {
        initialAmount: initial,
        startYear: startYear,
        endYear: new Date().getFullYear(),
        rebalanceType: rebalance,
        benchmarkSymbol: benchmark || 'SPY',
        // No time-varying RF series is loaded here.  Keep RF-dependent
        // statistics unavailable instead of silently applying a fixed 4.3%.
        rfAnnual: null,
        // P1247 (E3/E4): 랩의 시작 구성도 환산 주장이다. 평가 화면(surface)과 **같은** 선언(기준 통화 +
        // 관측 FX leg)을 넘긴다 — 넘기지 않으면 혼합 통화 구성은 1:1 합산 대신 보류된다.
        baseCurrency: (readPortfolioAssumptionDeclarations() || {}).baseCurrency || null,
        fxLegs: getPortfolioFxLegs(),
        fxSeries: fxSeries
      })
    : { ok: false, warnings: ['백테스트 엔진을 찾을 수 없습니다.'] };
  if (model && failed.length) {
    model.warnings = (model.warnings || []).concat(['가격 이력 수신 실패: ' + failed.join(', ')]);
  }
  if (model && model.baseCurrencyReturns && model.baseCurrencyReturns.disclosure) {
    model.warnings = (model.warnings || []).concat([model.baseCurrencyReturns.disclosure]);
  }
  window._lastPortfolioBacktestLab = { model: model, priceMap: priceMap, checkedAt: Date.now(), fetchStatuses: settled.map(function(r, i) { return { ticker: tickers[i], status: r.status }; }) };
  if (typeof window._aioRenderPortfolioBacktestLab === 'function') window._aioRenderPortfolioBacktestLab(model);
}
window.runPortfolioBacktestLab = runPortfolioBacktestLab;

var PF_JOURNAL_KEY = 'aio_portfolio_journal_v1';

function _aioPortfolioJournalEntries() {
  try {
    var raw = localStorage.getItem(PF_JOURNAL_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch(_) { return []; }
}

window._aioSavePortfolioJournal = function() {
  var noteEl = document.getElementById('pf-journal-note');
  var statusEl = document.getElementById('pf-journal-status');
  var note = noteEl ? String(noteEl.value || '').trim() : '';
  if (!note) {
    if (statusEl) statusEl.textContent = '저장할 노트가 없습니다.';
    if (typeof showToast === 'function') showToast('매매 복기 노트를 입력하세요.');
    return null;
  }
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  var entries = _aioPortfolioJournalEntries();
  var entry = {
    ts: Date.now(),
    date: new Date().toISOString(),
    note: note.slice(0, 2000),
    tickers: positions.map(function(p) { return p.ticker; }).filter(Boolean)
  };
  entries.unshift(entry);
  entries = entries.slice(0, 80);
  // P1350: a failed durable write is never reported as a saved journal.
  try { var json = JSON.stringify(entries); localStorage.setItem(PF_JOURNAL_KEY, json); if (localStorage.getItem(PF_JOURNAL_KEY) !== json) throw new Error('write-readback-failed'); }
  catch (_) { if (statusEl) statusEl.textContent = '노트를 저장하지 못했습니다. 작성 내용은 입력란에 남아 있습니다.'; if (typeof showToast === 'function') showToast('매매 복기 노트 저장 실패'); return { ok: false, entry: entry }; }
  if (statusEl) statusEl.textContent = '최근 노트 저장: ' + new Date(entry.ts).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  if (typeof showToast === 'function') showToast('매매 복기 노트 저장 완료');
  return { ok: true, entry: entry };
};

window._aioSyncPortfolioAiWorkbench = function() {
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  var sel = document.getElementById('pf-ai-ticker-select');
  if (sel) {
    var current = sel.value;
    var opts = ['<option value="">전체 포트폴리오</option>'].concat(positions.map(function(p) {
      var tk = escHtml(String(p.ticker || '').toUpperCase());
      return '<option value="' + tk + '">' + tk + '</option>';
    }));
    sel.innerHTML = opts.join('');
    if (current && positions.some(function(p) { return p.ticker === current; })) sel.value = current;
  }
  var entries = _aioPortfolioJournalEntries();
  var status = document.getElementById('pf-ai-status');
  if (status) {
    if (!positions.length) status.textContent = '포지션 등록 후 AI 분석을 실행할 수 있습니다.';
    else {
      var top = positions.slice(0, 4).map(function(p) { return p.ticker; }).join(', ');
      status.textContent = positions.length + '종목 분석 준비, ' + top + (positions.length > 4 ? ' 외' : '') + (entries.length ? ', 복기 노트 ' + entries.length + '건' : '');
    }
  }
  var journalStatus = document.getElementById('pf-journal-status');
  if (journalStatus && entries.length) {
    journalStatus.textContent = '최근 노트: ' + new Date(entries[0].ts).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }
};

function _aioSelectedPortfolioTicker() {
  var sel = document.getElementById('pf-ai-ticker-select');
  return sel ? String(sel.value || '').trim().toUpperCase() : '';
}

function _aioBuildPortfolioActionPrompt(kind) {
  var ticker = _aioSelectedPortfolioTicker();
  var noteEl = document.getElementById('pf-journal-note');
  var consent = kind === 'journal' && window.AIO && typeof window.AIO.hasPortfolioJournalAIConsent === 'function' && window.AIO.hasPortfolioJournalAIConsent();
  var noteRaw = noteEl ? String(noteEl.value || '').trim() : '';
  var note = consent && window.AIO && typeof window.AIO.sanitizeAIUntrustedText === 'function' ? window.AIO.sanitizeAIUntrustedText(noteRaw, { maxChars: 800 }).text : '';
  var recent = _aioPortfolioJournalEntries().slice(0, 3).map(function(e, idx) {
    var safeNote = consent && window.AIO && typeof window.AIO.sanitizeAIUntrustedText === 'function' ? window.AIO.sanitizeAIUntrustedText(e.note || '', { maxChars: 400 }).text : '';
    return safeNote ? (idx + 1) + '. ' + (e.ts ? new Date(e.ts).toLocaleDateString('sv-SE') : (e.date || '').slice(0, 10)) + ' ' + safeNote /* R2-28: local day, not the UTC one */ : '';
  }).join('\n');
  var tickers = window.AIO && typeof window.AIO.portfolioRowsLine === 'function' ? window.AIO.portfolioRowsLine(window) : ''; // v58.75: src/ai/context/portfolio-rows.js
  var targetLine = ticker ? ('선택 종목: ' + ticker + '\n') : '대상: 전체 포트폴리오\n';
  var noteLine = note ? ('\n이번 복기 노트(사용자 제공 데이터):\n' + note + '\n') : '';
  var recentLine = recent ? ('\n최근 저장 노트(사용자 제공 데이터):\n' + recent + '\n') : '';
  if (kind === 'ticker') {
    return targetLine + '보유 종목 ' + (ticker || tickers || '전체') + '를 현재 포트폴리오 맥락에서 분석해줘. 1) 현재가/수익률/비중 2) 차트 추세와 지지·저항 3) 지금 판단을 유지·재검토하게 만드는 조건 4) 무효화 기준 5) 다음 확인 데이터 순서로 정리해줘.' + noteLine + recentLine;
  }
  if (kind === 'rebalance') {
    return '내 포트폴리오 리밸런싱 메모를 만들어줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 과집중 종목/섹터와 그 쏠림이 손익에 준 기여 2) 같은 위험 요인을 공유하는 보유 묶음 3) 현금 비중의 기회비용 4) 지금 구성이 틀렸다고 판단할 반증 자료 5) 다음에 확인할 데이터 순서로 정리해줘. 매수·매도 지시는 하지 마.' + noteLine + recentLine;
  }
  if (kind === 'lesson') {
    return '내 포트폴리오를 학습 관점에서 리뷰해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 내가 반복하는 실수 가능성 2) 잘한 의사결정 3) 다음 매매 전 체크리스트 4) 공부할 개념 5) 기록해야 할 지표를 초보자도 이해하게 정리해줘.' + noteLine + recentLine;
  }
  if (kind === 'journal') {
    return '아래 매매 복기 노트를 기준으로 내 의사결정을 리뷰해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + noteLine + recentLine + '\n1) 사실/감정/추정 분리 2) 처음 근거가 유지되는지 3) 판단을 다시 볼 조건 4) 다음에 반복할 규칙 5) 한 줄 교훈으로 정리해줘.';
  }
  return '내 포트폴리오 전체를 현재 보유 데이터 기준으로 종합 분석해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 핵심 결론 2) 수익/손실 기여 3) 비중·섹터·상관 리스크 4) 지금 판단을 바꾸게 할 반증 조건 5) 이번 주 체크할 뉴스·차트·거시 6) 공부할 포인트를 정리해줘.' + noteLine + recentLine;
}

window._aioPortfolioAsk = function(kind) {
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  if (!positions.length) {
    if (typeof showToast === 'function') showToast('먼저 보유 종목을 추가하세요.');
    var tickerInput = document.getElementById('pf-add-ticker');
    if (tickerInput) tickerInput.focus();
    return;
  }
  var privacyPreview = window.AIO && typeof window.AIO.getPortfolioAIPrivacyPreview === 'function'
    ? window.AIO.getPortfolioAIPrivacyPreview(positions, { consent: false, includeJournal: kind === 'journal' }) : { sendable: true };
  if (!privacyPreview.sendable) {
    if (typeof showConfirmModal !== 'function') {
      if (typeof showToast === 'function') showToast('포트폴리오 AI 전송 동의 창을 열 수 없습니다.');
      return;
    }
    showConfirmModal('포트폴리오 AI 전송 미리보기',
      'AI에는 종목명·섹터·검증 가능한 비중·수익률만 전송합니다. 계좌ID·사용자ID·이메일·수량·매수가·목표가·메모는 제외됩니다.' + (kind === 'journal' ? ' 이번 복기 요청에는 현재 작성 노트와 최근 저장 노트 최대 3개도 전송합니다. 노트의 개인정보는 직접 확인하세요.' : '') + ' 이 기기에서 한 번만 동의하면 다음부터 묻지 않습니다(공용 PC 모드에서는 이번 세션만). 동의할까요?',
      function() {
        if (window.AIO && typeof window.AIO.setPortfolioAIConsent === 'function') window.AIO.setPortfolioAIConsent(true);
        if (kind === 'journal' && window.AIO && typeof window.AIO.setPortfolioJournalAIConsent === 'function') window.AIO.setPortfolioJournalAIConsent(true);
        window._aioPortfolioAsk(kind);
      }, '취소');
    return;
  }
  if (kind === 'journal') {
    var noteEl = document.getElementById('pf-journal-note');
    var note = noteEl ? String(noteEl.value || '').trim() : '';
    var savedNotes = _aioPortfolioJournalEntries();
    if (!note && !savedNotes.length) {
      if (typeof showToast === 'function') showToast('복기 노트를 먼저 입력하세요.');
      if (noteEl) noteEl.focus();
      return;
    }
    // P1350: send the explicitly previewed notes; saving now would duplicate the current
    // note and change the set of recent notes after the consent preview.
  }
  var prompt = _aioBuildPortfolioActionPrompt(kind || 'overview');
  if (typeof updateAIPanelContext === 'function') updateAIPanelContext('portfolio');
  var panel = document.getElementById('ai-panel');
  if (panel && !panel.classList.contains('open') && typeof toggleAIPanel === 'function') toggleAIPanel();
  setTimeout(function() {
    try {
      if (typeof updateAIPanelContext === 'function') updateAIPanelContext('portfolio');
      var inp = document.getElementById('ai-panel-inp');
      if (!inp) return;
      inp.value = prompt; if (typeof window._aioMarkPortfolioPrompt === 'function') window._aioMarkPortfolioPrompt(prompt); // v58.75: this turn carries the consented rows
      if (typeof chatSendUnified === 'function') chatSendUnified();
    } catch(e) {
      if (typeof showToast === 'function') showToast('AI 패널 실행 오류: ' + (e && e.message || e));
    }
  }, 120);
};

// P1316/R661: 전체 백업(포지션·원장·FX·현금·가정·일지·관심목록) — 묶음 형태·검증은 src/data/portfolio-backup.js가, 셸은 복호화 스냅샷과 저장 ack만 맡는다.
function _pfBackupSnapshot() { // v57.81: cash travels as per-currency balances (legacy single cash read as one by the bridge)
  var keys = (_pfAssumptionApi() || {}).keys || {}, assumptions = {}, cashRead = null; try { Object.keys(keys).forEach(function(n) { var v = localStorage.getItem(keys[n]); if (v != null) assumptions[n] = v; }); cashRead = window._pfPortfolioCash ? window._pfPortfolioCash.read() : null; } catch(e) {}
  return { positions: getPortfolioData(), ledger: getPortfolioLedger(), fxLegs: getPortfolioFxLegs(), cash: null, cashBalances: cashRead && cashRead.known ? cashRead.balances : null, assumptions: assumptions, journal: _aioPortfolioJournalEntries(), trades: getPortfolioTrades(), watchlists: getWatchlists(), activeWatchlistId: getActiveWatchlistId() || null }; }
function exportPortfolio() {
  var api = window._pfPortfolioBackup, rt = _pfVaultRuntime() || {}; // 잠긴(암호화·미해제) 섹션은 빈 값으로 읽혀 불완전한 백업이 되므로 거부한다.
  var locked = [PF_STORAGE_KEY, PF_LEDGER_KEY, PF_FX_KEY, PF_TRADES_KEY].some(function(k) { try { var raw = _AioVault.getStorage().getItem(k); return !!raw && raw.indexOf('aio_enc::') === 0 && rt[k] === undefined; } catch(e) { return false; } });
  if (!api || locked) { showToast(!api ? '백업 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.' : 'PIN 잠금을 해제한 뒤 내보내세요 — 잠긴 데이터는 백업에 넣을 수 없습니다.'); return; }
  var bundle = api.build(_pfBackupSnapshot(), { appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : null, origin: location.origin }), a = document.createElement('a');
  if (!bundle.counts.total) { showToast('내보낼 데이터가 없습니다.'); return; }
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })); a.download = 'aio-backup-' + bundle.exportedAt.slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(a.href);
  try { localStorage.setItem('aio_last_backup_at', bundle.exportedAt); window._pfPortfolioBackup.renderReminder(1); } catch(e) {}
  showToast('전체 백업 저장 (' + api.describe(bundle.counts) + ') — 암호화되지 않은 파일이니 안전한 곳에 보관하세요.');
}
// v59.45 (PASS27 P27-RESTORE-01): every ack names its section. saveWatchlists' false was dropped (and the active-list write
// swallowed its error), so a restore whose watchlists were not kept still ended in '전체 백업 가져오기 완료'. A local step that
// throws reports the section it was on; the sections before it are already replaced (browser storage has no multi-key
// transaction), which the failure message says.
function _pfRestoreBackupSections(c) { var keys = (_pfAssumptionApi() || {}).keys || {}, section = 'assumptions', local = [];
  try { Object.keys(keys).forEach(function(n) { if (c.assumptions[n] != null) localStorage.setItem(keys[n], c.assumptions[n]); else localStorage.removeItem(keys[n]); }); section = 'cash'; if (c.cashBalances != null && window._pfPortfolioCash) { if (!window._pfPortfolioCash.write(c.cashBalances).ok) throw new Error('cash-write-failed'); } else { localStorage.removeItem('aio_portfolio_cash_balances'); localStorage.removeItem('aio_portfolio_cash'); } section = 'journal'; localStorage.setItem(PF_JOURNAL_KEY, JSON.stringify(c.journal)); section = 'watchlists'; local.push({ ok: saveWatchlists(c.watchlists) === true, section: 'watchlists' }, { ok: setActiveWatchlistId(c.activeWatchlistId || '') !== false, section: 'watchlists' }); } catch(e) { return Promise.resolve([{ ok: false, reason: 'local-restore-failed', section: section }]); }
  var sections = ['ledger', 'fxLegs'].concat(c.trades ? ['trades'] : []);
  return Promise.all([savePortfolioLedger(c.ledger), savePortfolioFxLegs(c.fxLegs)].concat(c.trades ? [_pfDeclarationWrite(PF_TRADES_KEY, c.trades)] : [])).then(function(acks) { try { document.dispatchEvent(new CustomEvent('aio:portfolioChanged')); } catch(e) {} [renderPortfolioLedger, renderPortfolioFxLegs, window.refreshWatchlistUI].forEach(function(fn) { try { if (typeof fn === 'function') fn(); } catch(e) {} }); return local.concat(acks.map(function(ack, i) { return Object.assign({ section: sections[i] }, ack || { ok: false }); })); });
}
var _PF_SECTION_LABEL = { positions: '포지션', assumptions: '가정', cash: '현금', journal: '일지', watchlists: '관심목록', ledger: '원장', fxLegs: '환율', trades: '매매일지' };
function importPortfolio(event) {
  const file = event.target.files[0], reader = new FileReader();
  if (!file) return;
  reader.addEventListener('load', function(e) { // 구형 포지션 배열(포지션만 대체)과 aio-backup v1 묶음(모든 섹션 대체)을 모두 받는다.
    var api = window._pfPortfolioBackup, parsed = api ? api.parse(e.target.result) : { ok: false }, c = parsed.contents, bundle = parsed.kind === 'bundle';
    if (!parsed.ok) { showToast('파일 형식이 올바르지 않습니다.'); return; }
    // v59.45 (PASS27 P27-IMPORT-01): what the import changed on the way in is named before the reader confirms.
    var adj = parsed.adjustments || {}, adjText = [adj.positionsDropped > 0 ? '읽을 수 없는 포지션 ' + adj.positionsDropped + '개 제외' : '', adj.positionsCostUnknown > 0 ? '매수 단가 없는 포지션 ' + adj.positionsCostUnknown + '개는 단가 미확인' : '', adj.ledgerDropped > 0 ? '읽을 수 없는 원장 항목 ' + adj.ledgerDropped + '개 제외(포함 범위 선언 해제)' : ''].filter(Boolean).join(', ');
    showConfirmModal('데이터 가져오기', (bundle ? '전체 백업(' + api.describe(parsed.counts) + ')을' : c.positions.length + '개 포지션을') + ' 가져오시겠습니까? 기존 데이터가 대체됩니다.' + (adjText ? ' 파일에서 바뀐 점: ' + adjText + '.' : ''), async function() {
      // E3/P1187: 가져오기도 durable ack 뒤에만 '완료'를 말한다 — P1316: 묶음은 모든 섹션 ack를 합산한다.
      var acks = [Object.assign({ section: 'positions' }, await savePortfolioData(c.positions, { replace: true }))].concat(bundle ? await _pfRestoreBackupSections(c) : []);
      renderPortfolio();
      var failed = acks.filter(function(r) { return !(r && r.ok); }).map(function(r) { return _PF_SECTION_LABEL[r && r.section] || '일부 항목'; }).filter(function(name, i, all) { return all.indexOf(name) === i; });
      showToast(!failed.length ? (bundle ? '전체 백업 가져오기 완료' : c.positions.length + '개 포지션 가져오기 완료') : '영구 저장 실패 — 가져오기가 확정되지 않았습니다(' + failed.join('·') + ' 저장 안 됨). 다른 항목은 이미 새 데이터로 바뀌었을 수 있고, 새로고침 시 이전 데이터로 되돌아올 수 있습니다.');
    }, '');
  });
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════════════════
// 다중 워치리스트 시스템 — localStorage CRUD + Live Price + SCREENER_DB 연동
// ══════════════════════════════════════════════════════════════════════
var WL_ACTIVE_KEY = 'aio_watchlist_active';

// v59.42: one store — src/data/watchlist-store.js (window._aioWatchlistStore, installed at boot) reads and writes the
// lists. This copy dropped a list with no tickers array on read, so the next save deleted it; the store repairs it.
// Every caller is a user action or a render that waits for the same boot, so before it nothing is read or written.
function getWatchlists() {
  try { return window._aioWatchlistStore ? window._aioWatchlistStore.read() : []; } catch(e) { return []; }
}
function saveWatchlists(lists) {
  var ok = false;
  try { ok = !!(window._aioWatchlistStore && window._aioWatchlistStore.write(lists)); } catch(e) { ok = false; }
  if (!ok) showToast(window._aioWatchlistStore ? '관심목록을 저장하지 못했습니다(브라우저 저장 공간 부족).' : '관심목록을 아직 불러오는 중입니다. 잠시 뒤 다시 시도하세요.');
  return ok;
}
function getActiveWatchlistId() {
  return localStorage.getItem(WL_ACTIVE_KEY) || '';
}
function setActiveWatchlistId(id) { // v59.45: false when the write was refused (the restore reports it)
  try { localStorage.setItem(WL_ACTIVE_KEY, id); return true; } catch(e) { return false; }
}

function createWatchlist() {
  showPromptModal('새 관심 종목 리스트', '리스트 이름을 입력하세요 (예: 반도체 관심주, 배당 모니터링, AI 테마)', '', function(name) {
    if (name === null || !name.trim()) return;
    name = name.trim();
    var lists = getWatchlists();
    if (lists.some(function(l) { return l.name === name; })) {
      showToast('이미 같은 이름의 리스트가 있습니다.');
      return;
    }
    var id = 'wl_' + Date.now();
    lists.push({ id: id, name: name, tickers: [], createdAt: Date.now() });
    saveWatchlists(lists);
    setActiveWatchlistId(id);
    refreshWatchlistUI();
  }, { maxLength: 50 });
}

function renameWatchlist() {
  var activeId = getActiveWatchlistId();
  if (!activeId) return;
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) return;
  showPromptModal('리스트 이름 변경', '새 이름을 입력하세요', wl.name, function(newName) {
    if (newName === null || !newName.trim() || newName.trim() === wl.name) return;
    newName = newName.trim();
    if (lists.some(function(l) { return l.name === newName && l.id !== activeId; })) {
      showToast('이미 같은 이름의 리스트가 있습니다.');
      return;
    }
    wl.name = newName;
    saveWatchlists(lists);
    refreshWatchlistUI();
  }, { maxLength: 50 });
}

function deleteWatchlist() {
  var activeId = getActiveWatchlistId();
  if (!activeId) return;
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) return;
  showConfirmModal(
    '관심 종목 리스트 삭제',
    '"' + wl.name + '" 리스트와 ' + wl.tickers.length + '개 종목이 삭제됩니다. 계속하시겠습니까?',
    function() {
      var updated = lists.filter(function(l) { return l.id !== activeId; });
      saveWatchlists(updated);
      setActiveWatchlistId('');
      refreshWatchlistUI();
    },
    ''
  );
}

function switchWatchlist() {
  var value = typeof window._aioReadWatchlistSelect === 'function' ? window._aioReadWatchlistSelect() : null;
  if (value == null) return;
  setActiveWatchlistId(value);
  _aioRenderWatchlistView('view');
}

// v58.63 (architecture audit BND01): the symbol check is asynchronous. The retry used to re-read the active list and
// clear the inputs, so a request made on list A landed on list B (selected meanwhile) and wiped B's draft. The request
// now carries the list it was made on and what was typed; it writes only to that list (cancelled if the list was
// deleted) and clears the inputs only while they still show that request.
function addToWatchlist(ticker, note, accepted, request) {
  var activeId = request ? request.listId : getActiveWatchlistId();
  // v58.80 F16: a stock-page add with no chosen list goes to the first list (or a new one).
  if (!activeId && ticker && !request) {
    var wlAll = getWatchlists();
    if (!wlAll.length) { wlAll.push({ id: 'wl_' + Date.now(), name: '관심 종목', tickers: [], createdAt: Date.now() }); saveWatchlists(wlAll); }
    activeId = wlAll[0].id;
    setActiveWatchlistId(activeId);
    try { refreshWatchlistUI(); } catch (_) {}
  }
  if (!activeId) { showToast('먼저 관심 종목 리스트를 고르세요.'); return; }
  var fromInputs = request ? request.fromInputs : false;
  var typed = request ? request.typed : null;
  // 인자 없으면 입력 필드에서 가져오기
  if (!ticker) {
    if (typeof window._aioReadWatchlistInputs !== 'function') { showToast('종목 확인 도구를 아직 불러오지 못했습니다. 잠시 뒤 다시 추가하세요.'); return; }
    typed = window._aioReadWatchlistInputs();
    ticker = typed.ticker.trim().toUpperCase();
    note = typed.note.trim();
    fromInputs = true;
  }
  if (!ticker) { showToast('티커를 입력하세요.'); return; }
  var pending = { listId: activeId, fromInputs: fromInputs, typed: typed };
  if (accepted !== true && typeof window._aioAcceptSymbol !== 'function') { showToast('종목 확인 도구를 아직 불러오지 못했습니다. 잠시 뒤 다시 추가하세요.'); return; } // run-4 #5
  if (accepted !== true) { window._aioAcceptSymbol(ticker).then(function(r) { if (r.ok) addToWatchlist(r.id || ticker, note, true, pending); else if (r.reason === 'listing-unavailable') showToast(String(ticker).slice(0, 24) + ': 미국 상장 목록을 받지 못해 확인할 수 없습니다. 잠시 뒤 다시 추가하세요.'); else window._aioToastWithNameHint(ticker, ticker + ': 등록 종목·미국 상장 목록에서 찾지 못한 티커입니다. 철자를 확인하세요.'); }); return; } // like the holding form, an unchecked symbol is not saved // v57.81: known or US-listed (listing directory) symbols only; accepted ones join the quote request set
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) { if (request) showToast(ticker + ': 추가하려던 워치리스트가 삭제되어 추가하지 않았습니다.'); return; }
  // 중복 체크
  if (wl.tickers.some(function(t) { return t.sym === ticker; })) {
    showToast(ticker + ': 이미 이 리스트에 있습니다.');
    return;
  }
  wl.tickers.push({ sym: ticker, note: note || '', addedAt: Date.now() });
  saveWatchlists(lists);
  if (activeId !== getActiveWatchlistId() || !fromInputs) showToast(ticker + ': "' + (wl.name || '이전 목록') + '" 목록에 추가했습니다.');
  // 입력 필드 초기화 — 이 요청을 입력한 그대로일 때만
  if (fromInputs && activeId === getActiveWatchlistId() && typeof window._aioClearWatchlistInputs === 'function') window._aioClearWatchlistInputs(typed);
  refreshWatchlistUI(); // run-4 #12
}

function removeFromWatchlist(ticker) {
  var activeId = getActiveWatchlistId();
  if (!activeId) return;
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) return;
  wl.tickers = wl.tickers.filter(function(t) { return t.sym !== ticker; });
  saveWatchlists(lists);
  refreshWatchlistUI(); // run-4 #12
}


// 간단 토스트 알림
function showToast(msg) {
  var toast = document.createElement('div');
  toast.className = 'aio-toast wsl-toast'; toast.textContent = String(msg == null ? '' : msg).replace(/\S{33,}/g, function(w) { return w.slice(0, 24) + '…'; }).slice(0, 320); // run-4 #10 // v57.81: .aio-toast stacks above the first-visit disclaimer; look: legacy-workspace.css
  document.body.appendChild(toast);
  requestAnimationFrame(function() { toast.style.opacity = '1'; });
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 400);
  }, 2000);
}

// v59.06: the list view (select, buttons, table) is drawn by src/ui/components/portfolio-watchlist.js through
// window._aioRenderWatchlist (src/app/legacy-screen-bridges.js); a call before that module loaded is repeated on install.
// Its rows open a ticker and its 삭제 buttons call removeFromWatchlist by data-action.
function _aioRenderWatchlistView(mode) {
  if (typeof window._aioRenderWatchlist !== 'function') { window._aioWatchlistPending = true; return; }
  window._aioRenderWatchlist(getWatchlists(), getActiveWatchlistId(), mode);
}
function refreshWatchlistUI() { _aioRenderWatchlistView('full'); }

// 포트폴리오 페이지 진입 시 워치리스트도 렌더
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: wrapped in DOMContentLoaded (P556/R247 template) — _aioPageBus.register is a
// bare top-level call, which would throw before js/aio-core.js has defined it once that script is
// `defer`red. DOMContentLoaded always fires after all deferred scripts have run.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-portfolio-watchlist-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'portfolio') {
    try { refreshWatchlistUI(); } catch(err) { _aioLog('warn', 'init', 'Watchlist init error: ' + (err && err.message || err)); }
  }
});
// 실시간 시세 갱신 시 워치리스트도 갱신
_aioPageBus.register('html-portfolio-watchlist-live', 'aio:liveQuotes', function() {
  var pfPage = document.getElementById('page-portfolio');
  if (pfPage && pfPage.classList.contains('active')) {
    try { _aioRenderWatchlistView('live'); } catch(err) {}
  }
});
var pfShownAtLoad = document.getElementById('page-portfolio'); if (pfShownAtLoad && pfShownAtLoad.classList.contains('active')) { try { refreshWatchlistUI(); } catch (_) {} } // the initial route's pageShown can fire before this listener
});

// Hook: refresh portfolio on live data update
// v48.99: _aioPageBus 마이그 (P180)
// v51.99/Phase3[A2]: DOMContentLoaded 래핑(P556/R247 템플릿) — 아래 참조.
document.addEventListener('DOMContentLoaded', function() {
_aioPageBus.register('html-portfolio-render-live', 'aio:liveQuotes', function() {
  const pfPage = document.getElementById('page-portfolio');
  if (pfPage && pfPage.classList.contains('active')) { renderPortfolio(); }
});

// v31.9: Portfolio pageShown — 페이지 진입 시 즉시 렌더 + 리스크 자동 계산
_aioPageBus.register('html-portfolio-render-shown', 'aio:pageShown', function(e) {
  if (e.detail === 'portfolio') {
    try { renderPortfolio(); } catch(err) { _aioLog('warn', 'init', 'Portfolio init error: ' + (err && err.message || err)); }
    // 포지션이 있을 때만 리스크 자동 계산 (500ms 지연 — renderPortfolio 완료 후)
    setTimeout(function() {
      try {
        var _pfPos = getPortfolioData ? getPortfolioData() : [];
        if (_pfPos && _pfPos.length >= 1 && typeof refreshPortfolioRisk === 'function') {
          refreshPortfolioRisk();
        }
      } catch(_pfe) {}
    }, 500);
  }
});
// P734: a hard reload can restore an encrypted portfolio before the pageShown
// event registration runs; render the active route once so the lock gate owns
// the visible surface immediately instead of leaving the unlocked shell open.
if (document.getElementById('page-portfolio') && document.getElementById('page-portfolio').classList.contains('active')) {
  try { renderPortfolio(); } catch(err) { _aioLog('warn', 'init', 'Portfolio reload gate error: ' + (err && err.message || err)); }
}
});

// v59.42: CHAT_DEFAULT_CHIPS is deleted. Its only reader, chatRenderChips, wrote into per-page #chat-<ctx>-chips
// containers that no markup has; the AI panel's chips come from aio-chat.js _aiDefaultChips.

// ═══ v29.1: 대화 기록 localStorage 저장/열람 시스템 ═══════════════════
// v48.27 (P8): 200→100건 + 응답 300→200자 truncate (한글 UTF-8 3bytes 고려, ~100KB 한도)
const CHAT_HISTORY_LS = 'aio_chat_history';
const CHAT_HISTORY_MAX = 50; // v52.79/WP-AI4: 30일 retention/off policy

function _getChatHistory() {
  var policy = window.AIO && typeof window.AIO.getChatHistoryPolicy === 'function' ? window.AIO.getChatHistoryPolicy() : { enabled: false, retentionDays: 30 };
  if (policy.enabled === false) return [];
  try {
    var now = Date.now();
    var days = Number(policy.retentionDays);
    var cutoff = now - (Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 30) * 86400000;
    var stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_LS) || '[]');
    var filtered = Array.isArray(stored) ? stored.filter(function(row) {
      return row && typeof row === 'object' && typeof row.q === 'string' && typeof row.a === 'string' &&
        Number.isFinite(Number(row.ts)) && Number(row.ts) >= cutoff && Number(row.ts) <= now;
    }).slice(-CHAT_HISTORY_MAX) : [];
    // A failed cleanup write must not hide otherwise valid records.
    if (!Array.isArray(stored) || filtered.length !== stored.length) {
      try { localStorage.setItem(CHAT_HISTORY_LS, JSON.stringify(filtered)); } catch (_) {}
    }
    return filtered;
  }
  catch(e) { return []; }
}

function _saveChatHistory(history) {
  var policy = window.AIO && typeof window.AIO.getChatHistoryPolicy === 'function' ? window.AIO.getChatHistoryPolicy() : { enabled: false };
  if (policy.enabled === false) return false;
  // 최대 개수 초과 시 오래된 것부터 삭제
  while (history.length > CHAT_HISTORY_MAX) history.shift();
  try { localStorage.setItem(CHAT_HISTORY_LS, JSON.stringify(history)); return true; }
  catch(e) {
    // v49.79 P424/R161: QuotaExceededError 강화 처리 — 자동 prune + 사용자 toast 알림 (silent fail 차단)
    var isQuotaExceeded = (e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(String(e.message || ''))));
    try {
      while (history.length > 50) history.shift();
      localStorage.setItem(CHAT_HISTORY_LS, JSON.stringify(history));
      if (isQuotaExceeded && !window._aioQuotaWarningShown) {
        window._aioQuotaWarningShown = true;
        if (typeof showToast === 'function') showToast('채팅 기록 용량 초과 — 자동 정리 (50건 유지). 키 백업 권장 (AIO.exportApiKeys())', 6000);
        if (typeof console !== 'undefined' && console.warn) console.warn('[AIO v49.79 P424] localStorage quota exceeded — chat history pruned to 50.');
      }
      return true;
    } catch(e2) {
      try {
        while (history.length > 10) history.shift();
        localStorage.setItem(CHAT_HISTORY_LS, JSON.stringify(history));
        if (typeof showToast === 'function') showToast('저장공간 심각 부족 — 채팅 기록 10건만 유지. AIO.exportApiKeys() 즉시 실행!', 10000);
        if (typeof console !== 'undefined' && console.error) console.error('[AIO v49.79 P424] localStorage critical — backup API keys NOW.');
      } catch(e3) {
        if (typeof showToast === 'function') showToast('저장공간 완전 소진 — 채팅 저장 불가. localStorage 수동 정리 필요.', 15000);
        if (typeof console !== 'undefined' && console.error) console.error('[AIO v49.79 P424] localStorage save failed completely.', e3);
      }
      return false;
    }
  }
}

// v46.6: AI 응답 피드백 저장
function _aiFeedback(fbId, score) {
  try {
    var fb = JSON.parse(localStorage.getItem('aio_ai_feedback') || '[]');
    var sample = window.AIO && typeof window.AIO.createAIFeedbackSample === 'function'
      ? window.AIO.createAIFeedbackSample(score, { feedbackId: fbId })
      : { feedbackId: fbId, score: score, recordedAt: new Date().toISOString() };
    fb.push(sample);
    if (fb.length > 100) fb = fb.slice(-100);
    localStorage.setItem('aio_ai_feedback', JSON.stringify(fb));
  } catch(e) {}
}

function saveChatEntry(ctxId, question, answer) {
  var policy = window.AIO && typeof window.AIO.getChatHistoryPolicy === 'function' ? window.AIO.getChatHistoryPolicy() : { enabled: false };
  if (policy.enabled === false) return false;
  const history = _getChatHistory();
  var entry = {
    ctx: ctxId,
    q: question.slice(0, 200),
    a: (answer || '').replace(/<[^>]+>/g, '').slice(0, 300),
    ts: Date.now(),
  };
  history.push(window.AIO && typeof window.AIO.prepareChatHistoryEntry === 'function' ? window.AIO.prepareChatHistoryEntry(entry) : entry);
  return _saveChatHistory(history);
}

// v59.42: openChatHistory (the 대화 기록 overlay) is deleted. Its only opener was a header button injected into
// .aio-chat .acp-header panels that no markup has, so the overlay could not be reached.

// ── System prompts per context ─────────────────────────────────────────
// ═══ 글로벌 라이브데이터 주입 헬퍼 ═════════════════════════════════
function _ld(sym, field) {
  const d = (window._liveData || {})[sym];
  if (!d) return null;
  return field === 'pct' ? d.pct : d.price;
}
function _fmt(v, dec) { return v != null ? Number(v).toFixed(dec || 0) : '—'; }
// v57.77: getDataAge / renderStaleWarning retired (their only sinks, the risk-monitor grids, are gone).
/**
 * v36.7: 세션 인식 실시간 스냅샷 (UI 표시용)
 * - 한국: 장중→실시간, 장마감→최신종가
 * - 미국: 본장→실시간, 프리/애프터→시간외시세, 여백→최신종가
 * - FX/채권/VIX: 선물시장 운영 중→실시간, 아니면→최신종가
 */
function _liveSnap() {
  let ld = window._liveData || {};
  var stale = [];
  if (!_ld('^GSPC','price')) stale.push('S&P500');
  if (!_ld('^VIX','price')) stale.push('VIX');
  if (!_ld('CL=F','price')) stale.push('유가');
  var _fgLiveSnapMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  // v57.50 C06: F&G is a daily close figure; the snapshot carries the home card's completed-close reading.
  var _fgCloseRead = typeof window._aioFgCloseReading === 'function' ? window._aioFgCloseReading() : undefined;
  if (_fgCloseRead !== undefined) _fgLiveSnapMetric = _fgCloseRead && _fgCloseRead.value != null ? { value: _fgCloseRead.value, status: 'VALID', asOf: _fgCloseRead.date } : null;
  if (!_fgLiveSnapMetric || _fgLiveSnapMetric.status !== 'VALID') stale.push('F&G');
  if (!window._tradingScore) stale.push('트레이딩스코어');
  if (!(window._spxMA && window._spxMA[50])) stale.push('이동평균');
  var liveCoreCount = 0;
  ['^GSPC','^VIX','CL=F','DX-Y.NYB','^TNX'].forEach(function(sym) {
    var row = ld[sym];
    if (row && row.price != null && !/snapshot|fallback|static/i.test(String(row.source || row.sourceKind || ''))) liveCoreCount++;
  });

  // 세션 상태
  var usSession = (typeof _getUsSession === 'function') ? _getUsSession() : 'unknown';
  var krSession = (typeof _getKrxSession === 'function') ? _getKrxSession() : 'unknown';
  var futOpen = (typeof _isFuturesOpen === 'function') ? _isFuturesOpen() : false;

  // 시간외 정보
  var _ext = window._extHoursData || {};
  var extInfo = '';
  if (usSession === 'pre' || usSession === 'after') {
    if (_ext['ES=F'] || _ext['^GSPC']) {
      var e = _ext['ES=F'] || _ext['^GSPC'];
      extInfo = (e.session === 'pre' ? '프리마켓' : '애프터마켓') + ' ES ' + _fmt(e.price) + ' (' + (e.pct >= 0 ? '+' : '') + _fmt(e.pct,2) + '%)';
    }
  }

  // VVIX/VIX 비율
  var vvixVixRatio = (window._vvixVixRatio && window._vvixVixRatio.ratio) ? window._vvixVixRatio : null;

  // v36.8: 지수는 항상 현물(종가) 표시, 선물은 별도 참고
  var indexBasis = usSession === 'open' ? '정규장 live 우선/source 확인' : '종가 기준';

  // v48.60: FRED/BOK/KOSIS 매크로 지표 AI 채팅 주입 (R37 준수 — 수집-AI 주입 페어링)
  var fredD = window._fredData || {};
  var bokD = window._bokData || {};
  var kosisD = window._kosisData || {};
  var macroBlock = {
    fedRate: (fredD.FEDFUNDS && fredD.FEDFUNDS.value != null) ? _fmt(fredD.FEDFUNDS.value, 2) + '%' : '—',
    unemployment: (fredD.UNRATE && fredD.UNRATE.value != null) ? _fmt(fredD.UNRATE.value, 1) + '%' : '—',
    housing: (fredD.HOUST && fredD.HOUST.value != null) ? Math.round(fredD.HOUST.value) + 'K' : '—',
    // v51.97/P593: consConf = Conference Board(index.html data-snap="cons-conf" 라벨·임계값 기준).
    // FRED엔 Conference Board 무료 시리즈가 없어 라이브 소스 없음 — UMCSENT(미시간대, 별개 지표)를
    // 대신 넣던 기존 로직 제거하고 DATA_SNAPSHOT 폴백만 사용 (cpiYoY 등 형제 필드와 동일 패턴).
    consConf: (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.consConf != null) ? _fmt(window.DATA_SNAPSHOT.consConf, 1) + ' [스냅샷]' : '—',
    retailSalesMoM: (fredD.RSAFS && fredD.RSAFS.value != null && fredD.RSAFS.prevValue) ? _fmt((fredD.RSAFS.value - fredD.RSAFS.prevValue) / fredD.RSAFS.prevValue * 100, 2) + '% MoM' : '—',
    wageGrowth: (fredD.CES0500000003 && fredD.CES0500000003.value != null) ? '$' + _fmt(fredD.CES0500000003.value, 2) : '—',
    t10y2y: (fredD.T10Y2Y && fredD.T10Y2Y.value != null) ? _fmt(fredD.T10Y2Y.value, 2) + '%' : '—',
    hyOAS: (fredD.BAMLH0A0HYM2 && fredD.BAMLH0A0HYM2.value != null) ? '+' + Math.round(fredD.BAMLH0A0HYM2.value * 100) + 'bp' : '—',
    // v50.8: US 인플레·고용 YoY — live FRED(v50.5 CPI/Core/PCE 시리즈) 우선 + DATA_SNAPSHOT 폴백.
    // 기존 macroBlock은 Fed/실업률만 노출하고 CPI/PCE는 누락 → 채팅이 인플레 수치를 못 받던 갭 해소.
    cpiYoY:     (fredD.CPIAUCNS && typeof fredD.CPIAUCNS.yoy === 'number') ? _fmt(fredD.CPIAUCNS.yoy, 1) + '% [BLS/FRED NSA]' : ((window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.cpi != null) ? window.DATA_SNAPSHOT.cpi + '% [BLS NSA 스냅샷]' : '—'),
    coreCpiYoY: (fredD.CPILFENS && typeof fredD.CPILFENS.yoy === 'number') ? _fmt(fredD.CPILFENS.yoy, 1) + '% [BLS/FRED NSA]' : ((window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.coreCpi != null) ? window.DATA_SNAPSHOT.coreCpi + '% [BLS NSA 스냅샷]' : '—'),
    pceYoY:     (fredD.PCEPI && typeof fredD.PCEPI.yoy === 'number') ? _fmt(fredD.PCEPI.yoy, 1) + '% [FRED]' : ((window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.pce != null) ? window.DATA_SNAPSHOT.pce + '% [스냅샷]' : '—'),
    corePceYoY: (fredD.PCEPILFE && typeof fredD.PCEPILFE.yoy === 'number') ? _fmt(fredD.PCEPILFE.yoy, 1) + '% [FRED]' : ((window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.corePce != null) ? window.DATA_SNAPSHOT.corePce + '% [스냅샷]' : '—'),
    nfp: (fredD.PAYEMS && fredD.PAYEMS.value != null && fredD.PAYEMS.prevValue != null) ? ((fredD.PAYEMS.value - fredD.PAYEMS.prevValue >= 0 ? '+' : '') + Math.round(fredD.PAYEMS.value - fredD.PAYEMS.prevValue) + 'K [FRED]') : ((window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.nfp != null) ? ('+' + window.DATA_SNAPSHOT.nfp + 'K [스냅샷]') : '—'),
    // BOK 한국은행
    bokRate: (bokD.bokRate && bokD.bokRate.value != null) ? _fmt(bokD.bokRate.value, 2) + '%' : '—',
    bokStatus: (bokD.bokRate && bokD.bokRate.prev != null) ? (Math.abs(bokD.bokRate.value - bokD.bokRate.prev) < 0.01 ? '동결' : (bokD.bokRate.value > bokD.bokRate.prev ? '인상' : '인하')) : '—',
    // KOSIS 통계청
    krCpi: (kosisD.krCpi && kosisD.krCpi.value != null) ? _fmt(kosisD.krCpi.value, 1) : '—'
  };

  return {
    spx: _fmt(_ld('^GSPC','price')), spxPct: _fmt(_ld('^GSPC','pct'),2),
    nasdaq: _fmt(_ld('^IXIC','price')), nasdaqPct: _fmt(_ld('^IXIC','pct'),2),
    dow: _fmt(_ld('^DJI','price')), dowPct: _fmt(_ld('^DJI','pct'),2),
    indexBasis: indexBasis,
    vix: _fmt(_ld('^VIX','price'),1), vvix: _fmt(_ld('^VVIX','price'),1),
    vvixVixRatio: vvixVixRatio ? _fmt(vvixVixRatio.ratio, 2) + ' (' + vvixVixRatio.label + ')' : '—',
    dxy: _fmt(_ld('DX-Y.NYB','price'),1),
    tnx: _fmt(_ld('^TNX','price'),2), wti: _fmt(_ld('CL=F','price'),1),
    brent: _fmt(_ld('BZ=F','price'),1), gold: _fmt(_ld('GC=F','price')),
    krw: _fmt(_ld('KRW=X','price')), fg: _fgLiveSnapMetric && _fgLiveSnapMetric.value != null ? _fgLiveSnapMetric.value : '데이터 없음',
    // 지수 선물 (별도 참조용)
    esFut: _fmt(_ld('ES=F','price')), esPct: _fmt(_ld('ES=F','pct'),2),
    nqFut: _fmt(_ld('NQ=F','price')), nqPct: _fmt(_ld('NQ=F','pct'),2),
    ymFut: _fmt(_ld('YM=F','price')), ymPct: _fmt(_ld('YM=F','pct'),2),
    rtyFut: _fmt(_ld('RTY=F','price')), rtyPct: _fmt(_ld('RTY=F','pct'),2),
    // v48.58: VIX 기간구조 (sentiment 페이지 연동)
    vix9d: _fmt(_ld('^VIX9D','price'),1),
    vix3m: _fmt(_ld('^VIX3M','price'),1),
    vix6m: _fmt(_ld('^VIX6M','price'),1),
    skew: _fmt(_ld('^SKEW','price'),1),
    // 한국 지수 (AI 채팅에 누락됐던 것)
    kospi: _fmt(_ld('^KS11','price')), kospiPct: _fmt(_ld('^KS11','pct'),2),
    kosdaq: _fmt(_ld('^KQ11','price')), kosdaqPct: _fmt(_ld('^KQ11','pct'),2),
    extHours: extInfo || '해당없음',
    vxx: _fmt(_ld('VXX','price'),2), vxxPct: _fmt(_ld('VXX','pct'),2),
    score: window._tradingScore || '산출 대기',
    spx50ma: (window._spxMA && window._spxMA[50]) || '데이터 없음',
    spx200ma: (window._spxMA && window._spxMA[200]) || '데이터 없음',
    // 세션 상태
    usSession: usSession, krSession: krSession, futuresOpen: futOpen,
    // v48.60: 매크로 지표 AI 주입 (FRED + BOK + KOSIS 전 소스)
    macro: macroBlock,
    _stale: stale,
    _liveCoreCount: liveCoreCount,
    _freshness: liveCoreCount >= 4 && stale.length <= 1 ? 'live 우선/source 확인' : (stale.length <= 2 ? 'live+snapshot 혼합' : '대부분 snapshot/fallback')
  };
}

// ═══ v48.14: 한국 주요 이슈 카드 자동 렌더링 (Agent P1-21 — newsCache 재사용) ═══
// kr-home 진입 시 호출. 08:00 KST 완료 24h 한국 관련 뉴스 Top 4 자동 추출해 카드 교체.
// v53.7 (P725): renderKrIssues 퇴역 — kr-home 이슈 컨테이너가 페이지와 함께 삭제됨

// ═══ 테마별 최신 뉴스 자동 매칭 (newsCache에서 테마 구성종목·이름 기반 필터) ═══
// 테마 Top 3에 대해 최근 7일 뉴스 최대 3건 자동 주입 — narrative의 정적 수치 보완용
function _getThemeNews(themeTickers, themeName, maxItems) {
  if (typeof newsCache === 'undefined' || !newsCache || newsCache.length === 0) return [];
  maxItems = maxItems || 3;
  var now = Date.now();
  var DAYS7 = 7 * 24 * 3600000;

  // 티커 매칭 세트 (.KS/.KQ 접미사 제거 버전 포함)
  var tickerSet = {};
  (themeTickers || []).forEach(function(t) {
    if (!t) return;
    var u = t.toUpperCase();
    tickerSet[u] = true;
    var base = u.replace(/\.(KS|KQ)$/, '');
    if (base !== u) tickerSet[base] = true;
  });
  var tickerKeys = Object.keys(tickerSet).filter(function(k){ return k.length >= 3; });

  var matched = [];
  for (var i = 0; i < newsCache.length && matched.length < maxItems * 4; i++) {
    var it = newsCache[i];
    if (!it || !it.pubDate) continue;
    var age = now - new Date(it.pubDate).getTime();
    if (age < 0 || age > DAYS7) continue;
    var text = ((it.title || '') + ' ' + (it.desc || '') + ' ' + (it.summary || '')).toUpperCase();
    var hit = false;
    // 테마명 직접 매칭 (예: "HBM", "광통신")
    if (themeName && themeName.length >= 2 && text.indexOf(themeName.toUpperCase()) !== -1) hit = true;
    // 티커 매칭
    if (!hit) {
      for (var k = 0; k < tickerKeys.length; k++) {
        if (text.indexOf(tickerKeys[k]) !== -1) { hit = true; break; }
      }
    }
    if (hit) matched.push(it);
  }
  // 최신순 정렬 + top N
  matched.sort(function(a, b) { return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(); });
  return matched.slice(0, maxItems);
}


// ═══ 공통 응답 규칙 (모든 컨텍스트에 주입) ════════════════════════════
function _getChatRules() {
  var now = new Date();
  var snap = window.DATA_SNAPSHOT || {};
  var freshness = snap._updated || snap._marketDataUpdated || null;
  return '\n\n【데이터 사용 규칙】\n' +
    '• 현재 시각: ' + now.toLocaleString('ko-KR', { hour12:false }) + '\n' +
    '• 서버 산출물 시각: ' + (freshness || '미수신') + '\n' +
    '• 라이브/공식 산출물/출처·시점이 명시된 공식 참고값만 현재값으로 인용합니다.\n' +
    '• —, null, 미수신 값은 0·중립·이전 수치로 보정하지 않고 판단을 보류합니다.\n' +
    '• 정적 테마 해설, 과거 리포트 수치, 목표가, 컨센서스, 사건 확률을 현재 사실로 사용하지 않습니다.\n' +
    '• 가격·수급·거시지표를 답할 때 출처와 관측 시각을 함께 밝히고 투자 권유가 아님을 명시합니다.\n';
}

function _getInstitutionalFrameworkContext(pageFocus) {
  return '\n【분석 프레임워크】\n' +
    '1. 관측치와 해석을 분리합니다.\n' +
    '2. 가격·거래량·시장폭·변동성·금리·달러의 교차 확인이 없으면 확신도를 낮춥니다.\n' +
    '3. 기본/상방/하방 조건과 각 시나리오를 깨는 신호를 함께 제시합니다.\n' +
    '4. 종목 분석은 현재 OHLCV·공시·검증된 펀더멘털이 없으면 정량 결론을 보류합니다.\n' +
    '5. 페이지 초점: ' + (pageFocus || 'general') + '.\n';
}

function _getV48IntegratedContext(pageFocus) {
  var profile = typeof _buildUserProfileContext === 'function' ? _buildUserProfileContext() : '';
  return '\n【현재 증거 우선 계약】\n' +
    '내장된 과거 리서치·날짜별 시장 서사는 사용하지 않습니다. 현재 런타임 데이터와 공식 원천만 사용하고, 부족하면 웹 확인 또는 판단 보류를 선택합니다.\n' +
    _getInstitutionalFrameworkContext(pageFocus) + profile;
}
