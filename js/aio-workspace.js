// ═══════════════════════════════════════════════════════════════════════════════
// js/aio-workspace.js — P1136/R620: index.html 인라인 블록 A(1,992줄)에서 추출한 사용자 상태·워크스페이스 계층.
// 포트폴리오(updatePortfolioSummary/refreshPortfolioPrices/refreshPortfolioRisk/_pfPearson/
// share·MDD 라벨/shapre 라벨/exportPortfolio/importPortfolio), 백테스트 랩(_aioRenderPortfolioBacktestLab/
// runPortfolioBacktestLab), 워치리스트(getWatchlists/saveWatchlists/createWatchlist/switchWatchlist/
// addToWatchlist/updateWatchlistButtons), 투자 일지와 채팅 이력(PF_JOURNAL_KEY/CHAT_HISTORY_LS/
// CHAT_DEFAULT_CHIPS/_aioBuildPortfolioActionPrompt), 공용 헬퍼(showToast/_escHtmlSafe/fmtN).
//
// 왜 이 파일이 defer 그룹의 첫 번째인가: 원래 이 블록은 core·data·ui보다 먼저 실행되는 인라인이었고,
// 다른 런타임이 자기 평가 시점에 이 블록의 전역을 읽는다. 실행 위치를 보존하지 않으면 파일 하나가
// 통째로 ReferenceError로 죽는다(P1135에서 aio-ui.js가 그렇게 죽었다 — R622).
// ═══════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════
// AI Chat Engine — callClaude · chatSend · chatClear · chatFromChip
// ════════════════════════════════════════════════════════════════════════

// ── API key helpers ────────────────────────────────────────────────────
const CLAUDE_KEY_LS = 'aio_claude_api_key';

// v29: API 키 유효성 검증 및 sanitize
function _sanitizeApiKey(raw) {
  if (!raw) return '';
  // 비-ASCII 문자 제거 (BOM, zero-width space, 말줄임표 등)
  return raw.replace(/[^\x20-\x7E]/g, '').trim();
}
function _isValidApiKey(key) {
  // Claude API 키: sk-ant- 접두사, 최소 40자 이상
  if (!key || key.length < 40) return false;
  if (!/^sk-ant-/.test(key)) return false;
  if (/[…·]/.test(key)) return false; // 마스킹된 키 감지
  return true;
}
function getApiKey() {
  // v47.7: Vault 잠금 해제 시 복호화된 메모리 캐시 우선 (P109 수정)
  if (typeof _AioVault !== 'undefined' && _AioVault._claudeKeyRuntime && _isValidApiKey(_AioVault._claudeKeyRuntime)) {
    return _AioVault._claudeKeyRuntime;
  }
  const raw = typeof _getApiKey === 'function' ? (_getApiKey(CLAUDE_KEY_LS) || '') : (localStorage.getItem(CLAUDE_KEY_LS) || '');
  if (!raw && typeof _aioProviderStatusForKey === 'function') {
    var _claudeState = _aioProviderStatusForKey(CLAUDE_KEY_LS);
    if (_claudeState.storage === 'LOCKED') _aioLog('warn', 'vault', 'Claude API 키가 Vault에 암호화되어 있음. 사이드바에서 PIN 입력으로 잠금 해제 필요.');
  }
  // v47.7: 암호화된 키 감지 — Vault PIN 입력 필요
  if (raw && raw.startsWith('aio_enc::')) {
    _aioLog('warn', 'vault', 'Claude API 키가 Vault에 암호화되어 있음. 사이드바에서 PIN 입력으로 잠금 해제 필요.');
    return '';
  }
  const clean = _sanitizeApiKey(raw);
  // v29: 마스킹/오염된 키 자동 감지 → 경고
  if (raw && !_isValidApiKey(clean)) {
    _aioLog('warn', 'vault', '저장된 API 키가 손상됨 (마스킹 버전이 저장됨?). 키를 다시 입력하세요.');
    return '';
  }
  return clean;
}
async function setApiKey(key) {
  try {
    const clean = _sanitizeApiKey(key);
    if (!clean) {
      return typeof _aioSaveCredential === 'function'
        ? await _aioSaveCredential(CLAUDE_KEY_LS, '')
        : { ok: false, state: 'KEYSTORE_UNAVAILABLE' };
    }
    // v29: 마스킹된 키 저장 방지
    if (!_isValidApiKey(clean)) {
      _aioLog('warn', 'vault', '유효하지 않은 API 키 — 저장 거부: ' + clean.slice(0, 15) + '...');
      return { ok: false, state: 'INVALID_FORMAT' };
    }
    return typeof _aioSaveCredential === 'function'
      ? await _aioSaveCredential(CLAUDE_KEY_LS, clean)
      : { ok: false, state: 'KEYSTORE_UNAVAILABLE' };
  } catch(e) {
    _aioLog('warn', 'vault', 'localStorage 저장 실패 (Safari 개인정보 보호 모드?): ' + (e && e.message || e));
    return { ok: false, state: 'PERSISTENCE_FAILED', error: e && e.message || e };
  }
}

// ── 사이드바 API 키 저장/로드 ──────────────────────────────
async function saveSidebarApiKey() {
  const input = document.getElementById('sidebar-api-key');
  if (!input) return;
  const key = input.value.trim();
  // v29: 마스킹된 값이 다시 저장되는 것 방지
  if (key && !_isValidApiKey(_sanitizeApiKey(key))) {
    showToast('유효하지 않은 API 키입니다.\nClaude API 키는 sk-ant- 로 시작하는 긴 문자열이어야 합니다.\n다시 입력해주세요.');
    input.value = '';
    input.focus();
    return;
  }
  const result = await setApiKey(key);
  if (!result || !result.ok) {
    showToast('API 키 저장에 실패했습니다.\n브라우저 저장소 쓰기·재읽기를 확인하지 못했습니다.');
    return result;
  }
  // 저장 피드백
  const btn = input.nextElementSibling;
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = key ? '저장됨' : '삭제됨';
    btn.style.color = 'var(--data-green)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, T.UI_FEEDBACK);
  }
  // 부분 문자열도 접근성 트리에 남기지 않는다.
  if (key) { input.value = '••••••••'; input.dataset.secretStored = 'true'; input.setAttribute('aria-label', 'Claude API 키 · 저장됨'); }
  else { input.value = ''; input.dataset.secretStored = ''; input.setAttribute('aria-label', 'Claude API 키 · 미저장'); }
  return result;
}

function loadSidebarApiKey() {
  const input = document.getElementById('sidebar-api-key');
  if (!input) return;
  const key = getApiKey();
  if (key) { input.value = '••••••••'; input.dataset.secretStored = 'true'; }
}
async function saveRss2jsonKey() {
  const inp = document.getElementById('rss2json-api-key');
  if (!inp) return;
  const key = inp.value.trim();
  const btn = inp.nextElementSibling;
  const result = typeof _saveApiKey === 'function' ? await _saveApiKey('aio_rss2json_key', 'rss2json-api-key', btn) : { ok: false, state: 'KEYSTORE_UNAVAILABLE' };
  if (!result.ok) { showToast('RSS2JSON 키 저장에 실패했습니다.'); return result; }
  if (key) { inp.value = '••••••••'; inp.dataset.secretStored = 'true'; }
  else { inp.value = ''; inp.dataset.secretStored = ''; }
  return result;
}
function loadRss2jsonKey() {
  const inp = document.getElementById('rss2json-api-key');
  const key = _getApiKey('aio_rss2json_key') || '';
  if (inp && key) { inp.value = '••••••••'; inp.dataset.secretStored = 'true'; }
}


// Enter 키로 저장
/* v20: DOMContentLoaded Handler #4 - Enter Key Binding */
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('sidebar-api-key');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveSidebarApiKey(); });
  // 포커스 시에도 실제 키를 DOM에 복원하지 않는다.
  if (inp) inp.addEventListener('focus', () => {
    inp.select();
  });
  if (inp) inp.addEventListener('blur', () => {
    const key = getApiKey();
    if (key) { inp.value = '••••••••'; inp.dataset.secretStored = 'true'; }
  });
});

/* v46.6: 글로벌 로딩 워치독 — 60초 후 "로딩 중" 영구 고정 방지
 * 프록시 전면 장애 시 10+ 페이지에서 "로딩 중..."이 영구 표시되는 문제 해결.
 * 실제 데이터가 로드되면 이미 교체됐으므로 워치독은 잔존 로딩만 처리. */
setTimeout(function() {
  // 현재 활성 페이지의 "로딩 중" 요소만 처리 (비활성 페이지는 진입 시 init에서 처리)
  var _loadingPatterns = ['로딩 중...','로딩 중…','분석 로딩 중…','분석 로딩 중...','데이터 로딩 중...','데이터 로딩 중…','데이터 로딩 중'];
  // v46.10: API 키 미설정 감지 → 맞춤 안내
  var hasAnyKey = !!(_getApiKey('aio_finnhub_key') || _getApiKey('aio_fmp_key') || _getApiKey('aio_fred_key'));
  var _fallbackMsg = hasAnyKey ? '데이터 연결 지연 — 새로고침(R키) 시도' : '사이드바 하단에서 API 키를 설정하면 실시간 데이터가 표시됩니다';
  var replaced = 0;
  document.querySelectorAll('.page.active *').forEach(function(el) {
    if (el.children.length > 0) return;
    var txt = el.textContent.trim();
    if (_loadingPatterns.some(function(p) { return txt === p; })) {
      el.textContent = _fallbackMsg;
      el.style.color = 'var(--text-muted)';
      el.style.fontStyle = 'italic';
      el.style.fontSize = '11px';
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
        el.style.fontSize = '11px';
        total++;
      }
    });
    if (total > 0) console.log('[AIO v46.10] 로딩 워치독 (비활성): ' + total + '개 대체');
  }, 10000); // 비활성 페이지는 40초 후
}, 30000); // v46.10: 60초→30초 (사용자 대기 시간 단축)

function openApiKeyConfig() {
  // v46.10: prompt() → 사이드바 API 키 입력란으로 포커스 (R6 준수)
  var sb = document.querySelector('.sidebar');
  if (sb && sb.classList.contains('collapsed')) {
    sb.classList.remove('collapsed');
    var toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = '';
  }
  var apiInput = document.getElementById('sidebar-api-key');
  if (apiInput) {
    apiInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function() { apiInput.focus(); apiInput.select(); }, 300);
    showToast('사이드바에서 Claude API 키를 입력하세요');
  }
}

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
function savePortfolioData(positions) {
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
      if (adapter) adapter.set(PF_STORAGE_KEY, json);
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
  'pf-cash-currency-input': { key: 'cashCurrency', kind: 'currency' },
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
function getPortfolioLedger() { var store = _pfDeclarations(); return store ? store.read(PF_LEDGER_KEY) : null; }
function _pfDeclarationWrite(key, value) {
  var store = _pfDeclarations();
  return store ? store.write(key, value) : Promise.resolve({ ok: false, reason: 'declaration-store-unavailable' });
}
function savePortfolioLedger(ledger) { return _pfDeclarationWrite(PF_LEDGER_KEY, ledger); }
function getPortfolioFxLegs() { var store = _pfDeclarations(); var legs = store ? store.read(PF_FX_KEY) : null; return Array.isArray(legs) ? legs : []; }
function savePortfolioFxLegs(legs) { return _pfDeclarationWrite(PF_FX_KEY, Array.isArray(legs) ? legs : []); }
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
  return _pfLedgerApply(api.setFlowTiming(_pfLedgerRead(), value), '현금흐름 시점 규약을 저장했습니다.');
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
  }), 'FX leg를 저장했습니다.').then(function(result) {
    if (result.ok) _pfClearFields('fx');
    return result;
  });
}
function removeFxLeg(index) {
  var api = _pfFxApi();
  if (!api) return Promise.resolve({ ok: false, reason: 'fx-api-unavailable' });
  return _pfFxApply(api.removeLeg(_pfFxRead(), index), 'FX leg를 삭제했습니다.');
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
    var hasProtection = !!localStorage.getItem('aio_vault_salt') || !!localStorage.getItem(PF_PIN_KEY);
    if (!hasProtection) return false;
    return !(typeof _AioVault !== 'undefined' && _AioVault.isUnlocked());
  } catch(e) { return false; }
}
async function unlockPortfolio() {
  const input = document.getElementById('pf-pin-input');
  if (!input) return;
  const pin = input.value.trim();
  if (!/^\d{4,}$/.test(pin)) {
    input.style.borderColor = 'var(--data-red)';
    setTimeout(() => input.style.borderColor = '', T.UI_FEEDBACK);
    return;
  }
  if (typeof _AioVault === 'undefined') { showPortfolioMain(); return; }
  const hadVault = !!localStorage.getItem('aio_vault_salt');
  await _AioVault.unlock(pin);
  if (hadVault) {
    // 기존 Vault 존재 — 저장된 암호문 복호화로 PIN 정확성 검증(틀린 PIN이면 AES-GCM 인증 실패로 null)
    const raw = localStorage.getItem(PF_STORAGE_KEY);
    if (raw && raw.indexOf('aio_enc::') === 0) {
      const dec = await _AioVault.decrypt(raw);
      if (dec === null) {
        _AioVault.lock();
        input.style.borderColor = 'var(--data-red)';
        setTimeout(() => input.style.borderColor = '', T.UI_FEEDBACK);
        showToast('PIN이 올바르지 않습니다.');
        return;
      }
      if (!_AioVault._keyRuntime) _AioVault._keyRuntime = {};
      _AioVault._keyRuntime[PF_STORAGE_KEY] = dec;
    }
    if (typeof _restoreDecryptedKeys === 'function') { try { await _restoreDecryptedKeys(); } catch(_e){} }
  } else {
    // Vault 최초 생성 — 기존 평문 데이터(있다면)를 그대로 암호화로 승격
    const raw = localStorage.getItem(PF_STORAGE_KEY);
    if (raw && raw.indexOf('aio_enc::') !== 0) {
      await safeLS(PF_STORAGE_KEY, raw);
      if (!_AioVault._keyRuntime) _AioVault._keyRuntime = {};
      _AioVault._keyRuntime[PF_STORAGE_KEY] = raw;
    }
    if (typeof _migrateToEncrypted === 'function') { try { await _migrateToEncrypted(); } catch(_e){} }
  }
  try { localStorage.removeItem(PF_PIN_KEY); } catch(e) {} // 레거시 평문 PIN은 이제 무의미
  input.value = '';
  showPortfolioMain();
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
  pinInput.placeholder = localStorage.getItem('aio_vault_salt') ? '기존 PIN 입력' : '새 PIN(4자리+)';
  pinInput.focus();
}
function resetPortfolioPin() {
  var hasProtection = !!localStorage.getItem('aio_vault_salt') || !!localStorage.getItem(PF_PIN_KEY);
  if (!hasProtection) { showToast('설정된 PIN이 없습니다.'); return; }
  var isUnlocked = typeof _AioVault !== 'undefined' && _AioVault.isUnlocked();
  var warnMsg = isUnlocked
    ? '포트폴리오를 다시 평문으로 저장하고 PIN 보호를 해제합니다. (사이드바의 API 키 Vault 자체는 영향받지 않습니다.) 계속하시겠습니까?'
    : 'PIN을 모르는 상태에서 초기화하면 암호화된 기존 포트폴리오 데이터는 복구할 수 없습니다(실제 암호화이므로 복호화 없이 초기화 시 데이터 자체가 사라집니다). 계속하시겠습니까?';
  showConfirmModal('PIN 보호 해제', warnMsg, function() {
    if (isUnlocked && _AioVault._keyRuntime && _AioVault._keyRuntime[PF_STORAGE_KEY] !== undefined) {
      try { localStorage.setItem(PF_STORAGE_KEY, _AioVault._keyRuntime[PF_STORAGE_KEY]); } catch(e) {}
    } else if (!isUnlocked) {
      try { localStorage.removeItem(PF_STORAGE_KEY); } catch(e) {} // 복호화 불가 — 암호문 자체 제거(빈 포트폴리오로 재시작)
    }
    try {
      var adapter = window.AIO && window.AIO.storageAdapter;
      if (adapter) adapter.set(PF_VAULT_OPTOUT_KEY, '1');
      else localStorage.setItem(PF_VAULT_OPTOUT_KEY, '1');
    } catch(e) {}
    try {
      var adapter2 = window.AIO && window.AIO.storageAdapter;
      if (adapter2) adapter2.remove(PF_PIN_KEY);
      else localStorage.removeItem(PF_PIN_KEY);
    } catch(e) {}
    if (typeof _AioVault !== 'undefined') _AioVault.lock();
    showToast('포트폴리오 PIN 보호를 해제했습니다.');
    showPortfolioMain();
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
async function addPortfolioPosition() {
  const ticker = (document.getElementById('pf-add-ticker').value || '').trim().toUpperCase();
  const qty = parseFloat(document.getElementById('pf-add-qty').value) || 0;
  const cost = parseFloat(document.getElementById('pf-add-cost').value) || 0;
  // P1176 (22 PFR01): 빈 칸을 0으로 직렬화하면 화면이 '목표 $0.00 · -100%'를 만든다 — 미설정은 null로 남긴다.
  const parsedTarget = parseFloat((document.getElementById('pf-add-target').value || '').trim());
  const target = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;
  const memo = (document.getElementById('pf-add-memo').value || '').trim();
  // E3/P1187 (11 P11-02): 원가 통화는 합산의 단위다 — 이 경로에 writer가 없어서 사용자는 통화를
  // 선언할 방법이 없었고, 선언은 import로만 들어왔다. 선언이 비면 null로 남기고 티커·시세·locale로
  // 추정하지 않는다(11 §23). 선언했는데 형식이 틀리면 조용히 버리지 않고 거부한다(R628).
  const costCurrencyEl = document.getElementById('pf-add-cost-currency');
  const costCurrencyRaw = (costCurrencyEl ? costCurrencyEl.value : '').trim().toUpperCase();
  if (costCurrencyRaw && !/^[A-Z]{3}$/.test(costCurrencyRaw)) {
    showToast('원가 통화는 3자리 코드(예: USD, KRW)로 입력하거나 비워 두세요.');
    return;
  }
  const costCurrency = costCurrencyRaw || null;
  if (!ticker || qty <= 0 || cost <= 0) { showToast('티커, 수량, 매수 단가를 모두 입력하세요.'); return; }

  // v38.8: 티커 유효성 검증 — KNOWN_TICKERS 또는 _SNAP_FALLBACK에 존재하는지 확인
  var knownTickers = (typeof KNOWN_TICKERS !== 'undefined') ? KNOWN_TICKERS : [];
  var snapFb = (typeof _SNAP_FALLBACK !== 'undefined') ? _SNAP_FALLBACK : {};
  let ld = window._liveData || {};
  // v46.6: KNOWN_TICKERS가 Set이므로 .has() 사용 (기존 .indexOf()는 Set에서 TypeError)
  var isKnown = (knownTickers.has ? knownTickers.has(ticker) : (knownTickers.indexOf ? knownTickers.indexOf(ticker) >= 0 : false)) || snapFb[ticker] || ld[ticker] || /^\d{6}$/.test(ticker);
  if (!isKnown) {
    showToast('"' + ticker + '" 검증되지 않은 티커라 저장하지 않았습니다. 정확한 심볼인지 확인하세요. (예: AAPL, NVDA, 005930)');
    return;
  }

  const positions = getPortfolioData();
  var pfMain = document.getElementById('pf-main');
  if (pfMain) pfMain.classList.toggle('is-empty', positions.length === 0);
  const existing = positions.findIndex(p => p.ticker === ticker);
  if (existing >= 0) {
    showConfirmModal('종목 중복', ticker + ' 이미 존재합니다. 업데이트하시겠습니까?', async function() {
      // E3/P1187: 통째 교체는 import로 들어온 sector·targetWeight·note·시세 통화를 지웠다 —
      // 폼이 소유한 필드만 덮어쓰고 나머지는 보존한다.
      positions[existing] = { ...positions[existing], ticker, qty, cost, target, memo, costCurrency, updatedAt: Date.now() };
      const saved = await savePortfolioData(positions);
      clearPortfolioForm();
      renderPortfolio();
      window._aioTogglePortfolioEntry(false);
      showToast(saved.ok ? ticker + ' 업데이트 완료' : '영구 저장 실패 — ' + ticker + ' 변경은 이 화면에만 반영됐습니다. 새로고침 전 다시 시도하세요.');
    }, '');
    return;
  } else {
    positions.push({ ticker, qty, cost, target, memo, costCurrency, addedAt: Date.now(), updatedAt: Date.now() });
  }
  const saved = await savePortfolioData(positions);
  clearPortfolioForm();
  renderPortfolio();
  window._aioTogglePortfolioEntry(false);
  // v48.3 신규 추가 토스트 → E3/P1181: 완료 문구는 durable ack 성공 뒤에만 노출된다.
  if (typeof showToast === 'function') {
    showToast(saved.ok
      ? ticker + ' 포지션 추가 완료 · 브라우저에 저장됨'
      : '영구 저장 실패 — ' + ticker + ' 변경은 이 화면에만 반영됐습니다. 새로고침 전 다시 시도하세요.');
  }
}
function removePosition(ticker) {
  showConfirmModal(
    ticker + ' 포지션 삭제',
    ticker + ' 종목이 포트폴리오에서 삭제됩니다. 계속하시겠습니까?',
    async function() {
      const positions = getPortfolioData().filter(p => p.ticker !== ticker);
      const saved = await savePortfolioData(positions);
      renderPortfolio();
      if (typeof showToast === 'function' && !saved.ok) {
        showToast('영구 저장 실패 — 삭제가 확정되지 않았습니다. 새로고침 시 되돌아올 수 있습니다.');
      }
    },
    ''
  );
}
function editPosition(ticker) {
  const positions = getPortfolioData();
  const p = positions.find(pos => pos.ticker === ticker);
  if (!p) return;
  var tkEl = document.getElementById('pf-add-ticker');
  var qtyEl = document.getElementById('pf-add-qty');
  var costEl = document.getElementById('pf-add-cost');
  var tEl = document.getElementById('pf-add-target');
  var ccEl = document.getElementById('pf-add-cost-currency');
  var memoEl = document.getElementById('pf-add-memo');
  if (tkEl) tkEl.value = p.ticker;
  if (qtyEl) qtyEl.value = p.qty;
  if (costEl) costEl.value = p.cost;
  if (tEl) tEl.value = p.target || '';
  if (ccEl) ccEl.value = p.costCurrency || '';
  if (memoEl) memoEl.value = p.memo || '';
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
    if (el) el.value = '';
  });
}
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
  modal.style.display = 'flex';
  modal._aioTrapCleanup = typeof window._aioModalTrap === 'function' ? window._aioModalTrap(modal, function() { closeConfirmModal('trap'); }) : null;
  okBtn.focus();
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
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML = '<div style="background:var(--bg-card,#fbf9f5);border:1px solid var(--border,rgba(33,29,22,0.1));border-radius:4px;padding:20px;max-width:420px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.5);">' +
    '<div id="aio-prompt-title" style="font-size:14px;font-weight:700;color:var(--text-primary,#fff);margin-bottom:6px;">' + escHtml(title || '입력') + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted,var(--text-muted));margin-bottom:10px;line-height:1.5;white-space:pre-wrap;">' + escHtml(label || '') + '</div>' +
    '<input id="aio-prompt-input" type="text" aria-label="값 입력" placeholder="값을 입력하세요" style="width:100%;padding:8px 10px;background:var(--surface-5);border:1px solid rgba(33,29,22,0.15);border-radius:3px;color:var(--text-primary,#fff);font-size:12px;font-family:inherit;box-sizing:border-box;" maxlength="' + (opts.maxLength || 200) + '" />' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">' +
    '<button id="aio-prompt-cancel" style="padding:7px 14px;background:transparent;border:1px solid rgba(33,29,22,0.2);color:var(--text-muted,var(--text-muted));border-radius:3px;cursor:pointer;font-size:11px;">취소</button>' +
    '<button id="aio-prompt-ok" style="padding:7px 14px;background:rgba(33,29,22,0.2);border:1px solid var(--data-cyan);color:var(--data-cyan);border-radius:3px;cursor:pointer;font-size:11px;font-weight:700;">확인</button>' +
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
    if (e.key === 'Escape') _close(null);
    else if (e.key === 'Enter') _close(input.value);
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
      const saved = await savePortfolioData([]);
      renderPortfolio();
      if (typeof showToast === 'function' && !saved.ok) {
        showToast('영구 저장 실패 — 전체 삭제가 확정되지 않았습니다. 새로고침 시 되돌아올 수 있습니다.');
      }
    },
    ''
  );
}

// Render Portfolio
function renderPortfolio() {
  // v52.46 WO-1A: 실제 잠금 게이트 — 이전엔 이 자리를 지키던 checkPortfolioPin()이
  // 어디서도 호출되지 않는 고아 함수라 PIN이 설정돼도 진입 시 잠금화면이 뜬 적이 없었다(R294).
  if (typeof isPortfolioLocked === 'function' && isPortfolioLocked()) {
    var lock = document.getElementById('pf-lock-screen');
    var main = document.getElementById('pf-main');
    if (lock) lock.style.display = 'block';
    if (main) main.style.display = 'none';
    return;
  }
  const positions = getPortfolioData();
  let ld = window._liveData || {};
  const tbody = document.getElementById('pf-positions-tbody');
  if (!tbody) return;
  var _nativePortfolioTable = tbody.dataset.aioPortfolioTableRenderer === 'native';
  var _pfEmpty = positions.length === 0;
  var _pfMain = document.getElementById('pf-main');
  if (_pfMain) _pfMain.classList.toggle('is-empty', _pfEmpty);
  ['pf-risk-section','pf-allocation-section','pf-benchmark-section','pf-holdings-analysis-section','pf-risk-panel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = _pfEmpty;
  });
  // v48.47: R:R 계산기 포지션 드롭다운 동기화
  try { if (typeof window._aioRRPopulateSelect === 'function') window._aioRRPopulateSelect(); } catch(_){}
  try { if (typeof window._aioSyncPortfolioAiWorkbench === 'function') window._aioSyncPortfolioAiWorkbench(); } catch(_){}

  if (positions.length === 0) {
    // v48.3: 빈 상태 안내 강화 — 폰트 크기 상향 + 명확한 3단계 가이드
    if (!_nativePortfolioTable) tbody.innerHTML = '<tr class="pf-empty-state"><td colspan="9" style="padding:28px 16px;text-align:center;color:var(--text-muted);font-size:12px;line-height:1.8;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">포트폴리오가 비어 있습니다</div>' +
      '<div><b style="color:var(--text-primary);">티커 · 수량 · 매수 단가</b>를 입력하면 보유 현황과 리스크 분석이 시작됩니다.</div>' +
      '<button class="aio-btn-table primary" data-action="_aioTogglePortfolioEntry" style="margin-top:10px;min-height:36px;padding:7px 16px;">첫 종목 추가</button>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">데이터는 브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다. PIN 설정 후 저장 시 AES-256 암호화.</div>' +
      '</td></tr>';
    updatePortfolioSummary(positions, ld);
    // v48.3: 빈 상태에서도 도넛 리셋(이전 데이터 잔존 방지)
    if (typeof drawPositionDonut === 'function') drawPositionDonut();
    try { if (typeof window._aioSyncPortfolioAiWorkbench === 'function') window._aioSyncPortfolioAiWorkbench(); } catch(_){}
    return;
  }

  let totalValue = 0, totalCost = 0, totalDailyChg = 0;
  const rows = positions.map(p => {
    const live = ld[p.ticker];
    const currentPrice = live && isFinite(live.price) && live.price > 0 ? live.price : null;
    const dailyPct = live ? (live.pct != null ? live.pct : 0) : 0;
    const posValue = currentPrice != null ? currentPrice * p.qty : null;
    const posCost = p.cost * p.qty;
    const pnl = posValue != null ? posValue - posCost : null;
    const pnlPct = pnl != null && posCost > 0 ? (pnl / posCost * 100) : null;
    const dailyChg = posValue != null ? posValue * (dailyPct / 100) : 0;
    if (posValue != null) { totalValue += posValue; totalCost += posCost; }
    totalDailyChg += dailyChg;

    const pnlColor = pnl == null ? 'var(--text-muted)' : pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlSign = pnl != null && pnl >= 0 ? '+' : '';
    const priceColor = live ? (dailyPct >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)';
    const liveTag = live ? '' : ' <span style="font-size:11px;color:var(--text-muted);">(시세 미수신)</span>';

    var _eTk = escHtml(p.ticker); // v46.9: XSS 방어
    // v48.3 CRITICAL FIX: 기존 return `<tr...>`; 세미콜론+닫기 backtick 조기 종료로 이하 <td> 라인이 JS SyntaxError
    //                     → <script> 블록 전체 로드 실패 → save/render/add/edit/remove 전부 undefined
    //                     → 사용자 체감 "저장 안 됨 / 초기화". 단일 template literal로 재구성 + font-size 9px→11px/12px (R17/P37).
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer;" data-action="showTicker" data-arg="${_eTk}">
      <td headers="pf-th-ticker" style="padding:8px 10px;font-size:12px;"><b style="color:var(--text-primary);">${escHtml(p.ticker)}</b>${p.memo ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">'+escHtml(p.memo)+'</div>' : ''}</td>
      <td headers="pf-th-qty" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;">${p.qty}</td>
      <td headers="pf-th-cost" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;">$${p.cost.toFixed(2)}</td>
      <td headers="pf-th-price" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;color:${priceColor};">${currentPrice == null ? '—' : '$'+currentPrice.toFixed(2)}${liveTag}</td>
      <td headers="pf-th-pnl" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;font-weight:700;color:${pnlColor};">${pnl == null ? '—' : pnlSign+'$'+Math.abs(pnl).toLocaleString('en',{maximumFractionDigits:0})}</td>
      <td headers="pf-th-pct" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;font-weight:700;color:${pnlColor};">${pnlPct == null ? '—' : pnlSign+pnlPct.toFixed(1)+'%'}</td>
      <td headers="pf-th-target" style="text-align:center;padding:8px 6px;font-family:var(--font-mono);font-size:11px;">${p.target && p.target > 0 ? (currentPrice != null ? (function(){ var upside = ((p.target - currentPrice)/currentPrice*100); var uColor = upside >= 0 ? 'var(--green)' : 'var(--red)'; return '$'+p.target.toFixed(0)+'<div style="font-size:10px;color:'+uColor+';font-weight:600;">'+(upside>=0?'+':'')+upside.toFixed(1)+'%</div>'; })() : '$'+p.target.toFixed(0)+'<div style="font-size:10px;color:var(--text-muted);">상승여력 대기</div>') : '<span style="color:var(--text-muted);font-size:10px;">미설정</span>'}</td>
      <td headers="pf-th-weight" style="text-align:center;padding:8px 6px;font-size:11px;font-weight:700;" id="pf-weight-${_eTk}">—</td>
      <td headers="pf-th-manage" style="text-align:center;padding:8px 6px;white-space:nowrap;">
        <button data-action="_aioTechnicalTicker" data-arg="${_eTk}" data-stop="1" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;" title="차트 분석" aria-label="차트 분석">차트</button>
        <button data-action="_aioEditPosition" data-arg="${_eTk}" data-stop="1" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;" title="수정" aria-label="수정">수정</button>
        <button data-action="_aioRemovePosition" data-arg="${_eTk}" data-stop="1" aria-label="${_eTk} 포지션 삭제" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;" title="삭제">삭제</button>
      </td>
    </tr>`;
  });
  if (!_nativePortfolioTable) tbody.innerHTML = rows.join('');

  // Update weights
  if (!_nativePortfolioTable) positions.forEach(p => {
    const live = ld[p.ticker];
    const val = (live ? live.price : p.cost) * p.qty;
    const wt = totalValue > 0 ? (val / totalValue * 100).toFixed(1) : 0;
    const el = document.getElementById('pf-weight-' + p.ticker);
    if (el) el.textContent = wt + '%';
  });

  updatePortfolioSummary(positions, ld, totalValue, totalCost, totalDailyChg);
  // v40.4: 포지션 도넛 + 섹터 브레이크다운 갱신
  drawPositionDonut();
  // 현금 입력 필드 복원
  var cashInp = document.getElementById('pf-cash-input');
  if (cashInp) { try { cashInp.value = localStorage.getItem('aio_portfolio_cash') || ''; } catch(e) {} }
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
      policyEl.title = strategyPathSelected ? '' : '현재 구성 소급 경로에서는 리밸런싱 정책이 쓰이지 않습니다.';
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
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px;">포지션을 추가하면 종목별 차트 분석이 표시됩니다</div>';
    return;
  }
  if (typeof window._fetchYahooChartData !== 'function') {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px;">차트 데이터 유틸 미로드 — 잠시 후 다시 시도하세요</div>';
    return;
  }
  // 종목당 외부 fetch 1회씩 발생 — 카드 밀도/요청 수를 함께 고려해 최대 6종목으로 제한
  var tickers = positions.map(function(p) { return p.ticker; }).slice(0, 6);
  container.innerHTML = tickers.map(function(t) {
    var tEsc = escHtml(t);
    return '<div class="aio-widget" id="pf-hc-' + tEsc + '" data-action="_aioTechnicalTicker" data-arg="' + tEsc +
      '" role="button" tabindex="0" aria-label="' + tEsc + ' 차트·기술 분석으로 이동" style="padding:16px 18px;cursor:pointer;display:flex;flex-direction:column;">' +
      '<div style="font-size:12px;color:var(--text-muted);">' + tEsc + ' 차트 로딩 중…</div></div>';
  }).join('');

  tickers.forEach(function(ticker) {
    var live = ld[ticker] || {};
    window._fetchYahooChartData(ticker, '3mo', '1d').then(function(data) {
      var card = document.getElementById('pf-hc-' + ticker);
      if (!card) return;
      var closes = data && data.closes ? data.closes.filter(function(v) { return v != null && isFinite(v); }) : [];
      if (closes.length < 10) {
        card.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">' + escHtml(ticker) + ' — 차트 데이터 수신 실패</div>';
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
      var chgColor = chg != null ? (chg >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
      card.innerHTML =
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;">' +
          '<span style="font-size:14px;font-weight:700;color:var(--text-primary);">' + escHtml(ticker) + '</span>' +
          '<span style="font-size:11px;font-weight:600;color:' + verdictColor + ';border:1px solid var(--border);border-radius:999px;padding:2px 9px;">' + verdict + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">' +
          '<span style="font-family:var(--font-display);font-size:22px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums;">' + price.toFixed(2) + '</span>' +
          (chg != null ? '<span style="font-size:12px;font-weight:600;color:' + chgColor + ';font-variant-numeric:tabular-nums;">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>' : '') +
        '</div>' +
        '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="display:block;overflow:visible;" role="img" aria-label="' + escHtml(ticker) + ' 최근 3개월 가격 추이">' +
          '<polyline points="' + pathPts + '" fill="none" stroke="#211d16" stroke-width="1.6"></polyline>' +
        '</svg>' +
        '<div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;border-top:1px solid var(--border-subtle);padding-top:8px;">' +
          '<div style="display:flex;justify-content:space-between;"><span style="font-size:11px;color:var(--text-muted);">MA5 / MA20 / MA50</span><span style="font-size:11px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums;">' +
            (ma5 != null ? ma5.toFixed(1) : '—') + ' / ' + (ma20 != null ? ma20.toFixed(1) : '—') + ' / ' + (ma50 != null ? ma50.toFixed(1) : '—') + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;"><span style="font-size:11px;color:var(--text-muted);">20일 저항 / 지지</span><span style="font-size:11px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums;">' +
            resistance.toFixed(1) + ' / ' + support.toFixed(1) + '</span></div>' +
        '</div>' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-primary);margin-top:10px;">차트·기술 분석에서 상세 보기 →</div>';
    }).catch(function() {
      var card = document.getElementById('pf-hc-' + ticker);
      if (card) card.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">' + escHtml(ticker) + ' — 차트 데이터 수신 실패</div>';
    });
  });
}
window._aioRenderPortfolioHoldingCharts = _aioRenderPortfolioHoldingCharts;

function updatePortfolioSummary(positions, ld, totalValue, totalCost, totalDailyChg) {
  totalValue = totalValue || 0;
  totalCost = totalCost || 0;
  totalDailyChg = totalDailyChg || 0;
  var cashValue = 0;
  try { cashValue = Math.max(0, parseFloat(localStorage.getItem('aio_portfolio_cash') || '0') || 0); } catch(e) {}
  const totalAssets = totalValue + cashValue;
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;
  const dailyPct = totalAssets > 0 ? (totalDailyChg / totalAssets * 100) : 0;

  // Allocation summary
  const alloc = {};
  positions.forEach(p => {
    const tag = p.memo || 'etc';
    const live = ld[p.ticker];
    const val = (live ? live.price : p.cost) * p.qty;
    alloc[tag] = (alloc[tag] || 0) + val;
  });
  const allocEl = document.getElementById('pf-allocation');
  if (allocEl && positions.length > 0) {
    const sorted = Object.entries(alloc).sort((a,b) => b[1]-a[1]);
    allocEl.innerHTML = sorted.slice(0,4).map(([k,v]) => {
      const pct = totalValue > 0 ? (v/totalValue*100).toFixed(0) : 0;
      return `<span style="color:var(--text-secondary);font-size:11px;">${escHtml(k)} ${pct}%</span>`;
    }).join(' · ');
  }
  // v37.8: 동적 포트폴리오 진단
  if (typeof _generatePortfolioAnalysis === 'function') {
    _generatePortfolioAnalysis(positions, ld, { totalValue: totalValue, totalCost: totalCost, totalDailyChg: totalDailyChg, totalPnl: totalPnl, totalPnlPct: totalPnlPct });
  }
}

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

async function refreshPortfolioRisk() {
  const el = document.getElementById('pf-risk-metrics');
  if (!el) return;
  const positions = getPortfolioData();
  if (positions.length < 1) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">포지션을 먼저 추가하세요.</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">가격 데이터 요청 중...</div>';

  const tickers = positions.map(function(p) { return p.ticker; });
  const returnsMap = {};
  const historyMap = {};

  // 각 종목 Yahoo Finance 3개월 가격 기록 fetch
  await Promise.allSettled(tickers.map(async function(t) {
    try {
      if (typeof _fetchYahooChartData === 'function') {
        const d = await _fetchYahooChartData(t, '3mo');
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

  const validTickers = positions.map(function(p) { return p.ticker; }).filter(function(t) { return historyMap[t]; });
  const missingHistory = tickers.filter(function(t) { return !historyMap[t]; });
  if (missingHistory.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--data-amber);padding:8px 0;">조정주가·날짜 이력이 없는 종목이 있어 리스크 계산을 보류합니다: ' + _escHtmlSafe(missingHistory.join(', ')) + '.</div>';
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
    el.innerHTML = '<div style="font-size:11px;color:var(--data-amber);padding:8px 0;">종목 간 공통 거래일이 6일 미만이라 리스크 계산을 보류합니다.</div>';
    return;
  }

  // Cost is historical context, never a current-value fallback. Require a
  // timestamped decision-authorized quote for each live portfolio weight.
  var currentValueMap = {};
  var priceEvidenceMap = {};
  var missingCurrent = [];
  positions.forEach(function(p) {
    var evidence = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
    priceEvidenceMap[p.ticker] = evidence;
    var price = evidence && evidence.allowedUse === true ? evidence.value : null;
    if (price == null || !isFinite(price) || price <= 0) missingCurrent.push(p.ticker);
    else currentValueMap[p.ticker] = price * Number(p.qty);
  });
  if (missingCurrent.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--data-amber);padding:8px 0;">현재 시세가 없는 종목은 원가로 평가액을 대체하지 않습니다. 갱신 후 다시 시도하세요: ' + _escHtmlSafe(missingCurrent.join(', ')) + '.</div>';
    return;
  }
  var totalCurrentValue = positions.reduce(function(s, p) { return s + (currentValueMap[p.ticker] || 0); }, 0);
  if (!(totalCurrentValue > 0)) {
    el.innerHTML = '<div style="font-size:11px;color:var(--data-amber);padding:8px 0;">현재 평가액을 산출할 수 없어 리스크 계산을 보류합니다.</div>';
    return;
  }
  var minLen = commonDates.length - 1;
  validTickers.forEach(function(t) {
    var values = commonDates.map(function(day) { return historyMap[t][day]; });
    returnsMap[t] = values.slice(1).map(function(value, idx) { return (value / values[idx]) - 1; });
  });

  // 22:PFR02/PFR09/PFR10 (E4): publish a DECLARED risk path instead of an
  // implied one. Weights are frozen into one immutable composition snapshot;
  // cash is declared or held (never dropped into a stock-only denominator and
  // then called "account risk"); the estimate carries exposure path, rebalance
  // policy, denominator, RF state and sample facts for the renderer.
  var cashValue = 0;
  try { cashValue = Math.max(0, parseFloat(localStorage.getItem('aio_portfolio_cash') || '0') || 0); } catch(e) {}
  // E3/E4/P1188: 선언된 계좌·현금 통화와 현금 수익률·RF만 쓴다. 현금 통화가 없거나 기준 통화와
  // 다르면 계좌 전체 분모를 만들 수 없으므로 주식 부분만 게시하고 계좌 뷰는 보류한다.
  var declarations = readPortfolioAssumptionDeclarations();
  var cashDeclarable = cashValue === 0
    || (declarations.cashCurrency != null && declarations.baseCurrency != null && declarations.cashCurrency === declarations.baseCurrency);
  var snapshot = (typeof window._pfCreateCompositionSnapshot === 'function') ? window._pfCreateCompositionSnapshot({
    members: positions.map(function(p) {
      var ev = priceEvidenceMap[p.ticker] || null;
      return {
        ticker: p.ticker,
        qty: Number(p.qty),
        price: ev ? ev.value : null,
        priceObservedAt: ev && ev.ts != null ? new Date(ev.ts).toISOString() : null,
        priceSource: ev && ev.source != null ? String(ev.source) : null
      };
    }),
    cash: { amount: cashValue, currency: declarations.cashCurrency },
    asOf: new Date().toISOString(),
    weightBasis: cashDeclarable ? 'whole_account' : 'invested_sleeve',
    baseCurrency: declarations.baseCurrency
  }) : null;
  // E4/P1193: 측정 경로와 리밸런싱 정책도 선언 입력이다. 전략 경로는 포지션이 선언한 목표비중
  // (폼 단위 %)이 합 100%일 때만 성립하고, 아니면 엔진이 `strategy-target-weights-invalid`로 보류한다.
  // P1198: 선언된 정책만 넘긴다 — 셸이 'daily'를 지어내면 미선언이 선언으로 게시된다(ledger P1198).
  var exposurePath = declarations.exposurePath || 'current_composition_retrospective';
  var rebalancePolicy = declarations.rebalancePolicy;
  var strategyTargetWeights;
  if (exposurePath === 'fixed_target_weight_strategy') {
    var declaredWeightSum = 0;
    var weightComplete = positions.length > 0;
    strategyTargetWeights = {};
    positions.forEach(function(p) {
      var declaredWeight = Number(p.targetWeight);
      if (!isFinite(declaredWeight) || declaredWeight < 0) { weightComplete = false; return; }
      strategyTargetWeights[p.ticker] = declaredWeight / 100;
      declaredWeightSum += declaredWeight;
    });
    // P1200: 합이 100% 미만이면 나머지는 현금 목표비중이다(계좌 범위 선언). 100% 초과만 무효다.
    if (!weightComplete || declaredWeightSum > 100 + 1e-6) strategyTargetWeights = {};
  }
  var estimate = (snapshot && typeof window._pfDeriveRiskEstimate === 'function') ? window._pfDeriveRiskEstimate({
    snapshot: snapshot,
    returnsMap: returnsMap,
    cashReturn: declarations.cashReturn != null ? { mode: 'explicit_assumption', annualRate: declarations.cashReturn } : { mode: 'unresolved' },
    rfAnnual: declarations.riskFreeRate,
    exposureHistoryMode: exposurePath,
    rebalancePolicy: rebalancePolicy,
    targetWeights: strategyTargetWeights,
    sampleDates: commonDates.slice(1)
  }) : null;
  if (!estimate || estimate.status !== 'ready') {
    el.innerHTML = '<div style="font-size:11px;color:var(--data-amber);padding:8px 0;">위험 추정 입력을 확정하지 못해 보류합니다: ' +
      _escHtmlSafe((estimate && estimate.code) || (snapshot && snapshot.blocked && snapshot.blocked.code) || 'composition-snapshot-unavailable') + '.</div>';
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

  // E4/P1191: 원장이 선언되면 실제 계좌 성과를 계산한다. 없거나 규약이 미선언이면 엔진이
  // 자기 사유로 보류하고, 패널은 그 사유를 그대로 게시한다 — 없는 성과를 만들지 않는다.
  var accountLedger = (typeof getPortfolioLedger === 'function') ? getPortfolioLedger() : null;
  var accountPerf = (typeof window._pfAssessAccountPerformance === 'function')
    ? window._pfAssessAccountPerformance({
      ledger: accountLedger ? { ...accountLedger, currency: accountLedger.currency || declarations.baseCurrency || null } : null
    }) : null;
  window._lastPortfolioRiskEstimate = { estimate: estimate, snapshot: snapshot, accountPerformance: accountPerf, rfAnnual: rfAnnual, checkedAt: Date.now() };
  _renderRiskMetrics(el, { var95: var95, var99: var99, sharpe: sharpe, mddRes: mddRes,
    corrRes: corrRes, validTickers: validTickers, n: minLen, rfAnnual: rfAnnual,
    estimate: estimate, accountPerf: accountPerf });
  try { _aioRenderPortfolioExposure(positions, returnsMap); } catch(_) {}   // v50.54 3D
  try { _aioRenderPortfolioStress(positions); } catch(_) {}                 // v50.54 3E
  try { refreshPortfolioTechnicalRisk(); } catch(_) {}
}

// v50.54 3D: 포트폴리오 리스크 귀속 + 익스포저 한도 — 섹터/종목 집중도·팩터 익스포저·상관 클러스터.
function _pfPearson(a, b) {
  var n = Math.min(a.length, b.length); if (n < 3) return null;
  a = a.slice(-n); b = b.slice(-n);
  var ma = 0, mb = 0, i; for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  var num = 0, da = 0, dbb = 0; for (i = 0; i < n; i++) { var x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; dbb += y * y; }
  return (da > 0 && dbb > 0) ? num / Math.sqrt(da * dbb) : null;
}
function _aioRenderPortfolioExposure(positions, returnsMap) {
  var el = document.getElementById('pf-exposure-panel'); if (!el) return;
  if (!positions || !positions.length) { el.innerHTML = ''; return; }
  var ld = window._liveData || {}, db = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  var find = function(s){ for (var i=0;i<db.length;i++) if (db[i].sym===s) return db[i]; return null; };
  var rows = positions.map(function(p){
    var evidence = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
    var px = evidence && evidence.allowedUse === true ? evidence.value : null;
    return { sym:p.ticker, value:px != null ? px*p.qty : null, stock:find(p.ticker) };
  }).filter(function(r) { return r.value != null && isFinite(r.value) && r.value >= 0; });
  var total = rows.reduce(function(s,r){return s+(r.value||0);},0);
  if (total <= 0) { el.innerHTML = ''; return; }
  rows.forEach(function(r){ r.w = r.value/total; });
  var bySec = {}; rows.forEach(function(r){ var sec=(r.stock&&r.stock.sector)||'기타'; bySec[sec]=(bySec[sec]||0)+r.w; });
  var secArr = Object.keys(bySec).map(function(k){return [k,bySec[k]];}).sort(function(a,b){return b[1]-a[1];});
  var topSorted = rows.slice().sort(function(a,b){return b.w-a.w;});
  var top3 = topSorted.slice(0,3).reduce(function(s,r){return s+r.w;},0);
  var ranked = rows.filter(function(r){ return r.stock && typeof r.stock.rank==='number'; });
  var wr = ranked.reduce(function(s,r){return s+r.w;},0);
  var avgRank = wr>0 ? Math.round(ranked.reduce(function(s,r){return s+r.stock.rank*r.w;},0)/wr) : null;
  // 평균 쌍별 상관
  var tk = Object.keys(returnsMap||{}); var cs=0, cn=0, hi=0;
  for (var a=0;a<tk.length;a++) for (var b=a+1;b<tk.length;b++){ var c=_pfPearson(returnsMap[tk[a]], returnsMap[tk[b]]); if (c!=null){ cs+=c; cn++; if (c>0.7) hi++; } }
  var avgCorr = cn>0 ? cs/cn : null;
  var warns = [];
  if (secArr.length && secArr[0][1] > 0.40) warns.push(secArr[0][0]+' 섹터 '+Math.round(secArr[0][1]*100)+'% 집중(>40%)');
  if (top3 > 0.60) warns.push('상위 3종목 '+Math.round(top3*100)+'% 집중(>60%)');
  if (avgCorr != null && avgCorr > 0.7) warns.push('평균 상관 '+avgCorr.toFixed(2)+' — 분산효과 약함(>0.70)');
  var secHtml = secArr.slice(0,5).map(function(s){ var pct=Math.round(s[1]*100); var col=s[1]>0.4?'var(--data-red)':s[1]>0.25?'var(--data-amber)':'var(--text-secondary)'; return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0;"><span style="color:var(--text-secondary);">'+_escHtmlSafe(s[0])+'</span><span style="color:'+col+';font-weight:700;">'+pct+'%</span></div>'; }).join('');
  el.innerHTML =
    '<div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">익스포저 · 집중도</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">' +
      '<div>' + secHtml + '</div>' +
      '<div style="font-size:11px;">' +
        '<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--text-secondary);">상위3 집중</span><span style="font-weight:700;color:'+(top3>0.6?'var(--data-red)':'var(--text-primary)')+';">'+Math.round(top3*100)+'%</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--text-secondary);">평균 상관</span><span style="font-weight:700;">'+(avgCorr!=null?avgCorr.toFixed(2):'—')+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--text-secondary);">평균 퀀트 랭크</span><span style="font-weight:700;">'+(avgRank!=null?avgRank:'—')+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--text-secondary);">종목/섹터 수</span><span style="font-weight:700;">'+rows.length+'/'+secArr.length+'</span></div>' +
      '</div>' +
    '</div>' +
    (warns.length ? '<div style="margin-top:6px;font-size:10px;color:var(--data-amber);line-height:1.5;">'+warns.map(_escHtmlSafe).join(' · ')+'</div>' : '<div style="margin-top:6px;font-size:10px;color:var(--data-green);">집중도·상관 한도 내</div>');
}
// v50.54 3E: 포트폴리오 스트레스 시나리오 — 섹터 베타(주식/금리/유가) 기반 가상 충격 손익.
function _aioRenderPortfolioStress(positions) {
  var el = document.getElementById('pf-stress-panel'); if (!el) return;
  if (!positions || !positions.length) { el.innerHTML = ''; return; }
  var ld = window._liveData || {}, db = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  var find = function(s){ for (var i=0;i<db.length;i++) if (db[i].sym===s) return db[i]; return null; };
  var SECTOR_RISK = {
    'Technology':{eq:1.25,rate:-0.8,oil:0.0}, 'Communication Services':{eq:1.10,rate:-0.5,oil:0.0},
    'Consumer':{eq:1.15,rate:-0.6,oil:-0.2}, 'Consumer Defensive':{eq:0.60,rate:-0.2,oil:-0.1},
    'Financials':{eq:1.10,rate:0.5,oil:0.0}, 'Healthcare':{eq:0.80,rate:-0.3,oil:0.0},
    'Energy':{eq:1.00,rate:0.1,oil:1.2}, 'Industrials':{eq:1.10,rate:-0.2,oil:-0.3},
    'Materials':{eq:1.10,rate:-0.2,oil:0.3}, 'Utilities':{eq:0.50,rate:-1.0,oil:-0.2}, 'Real Estate':{eq:0.90,rate:-1.2,oil:0.0}
  };
  var DEF = {eq:1.0,rate:-0.4,oil:0.0};
  var rows = positions.map(function(p){
    var evidence = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
    var px = evidence && evidence.allowedUse === true ? evidence.value : null;
    var st=find(p.ticker); var sr=(st&&SECTOR_RISK[st.sector])||DEF;
    return { sym:p.ticker, value:px != null ? px*p.qty : null, sr:sr };
  }).filter(function(r) { return r.value != null && isFinite(r.value) && r.value >= 0; });
  var total = rows.reduce(function(s,r){return s+(r.value||0);},0); if (total<=0){ el.innerHTML=''; return; }
  rows.forEach(function(r){ r.w=r.value/total; });
  // 시나리오: 주식충격(eq)·금리+100bp(rate)·유가+30%(oil×0.30)
  var SCEN = [
    { name:'2008 금융위기 (시장 −50%)', f:function(sr){ return sr.eq * -0.50; } },
    { name:'2020 코로나 (시장 −34%)',   f:function(sr){ return sr.eq * -0.34; } },
    { name:'금리 +100bp',               f:function(sr){ return sr.rate * 0.01; } },
    { name:'유가 +30%',                 f:function(sr){ return sr.oil * 0.30; } },
  ];
  var lines = SCEN.map(function(sc){
    var port=0, worst=null;
    rows.forEach(function(r){ var imp=sc.f(r.sr); port += r.w*imp; if (worst===null || imp<worst.imp) worst={sym:r.sym, imp:imp}; });
    var col = port<-0.15?'var(--data-red)':port<0?'var(--data-amber)':'var(--data-green)';
    return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0;"><span style="color:var(--text-secondary);">'+_escHtmlSafe(sc.name)+'</span><span style="font-weight:700;color:'+col+';">'+(port>=0?'+':'')+(port*100).toFixed(1)+'%'+(worst&&worst.imp<0?' <span style="color:var(--text-muted);font-weight:400;">('+_escHtmlSafe(worst.sym)+')</span>':'')+'</span></div>';
  }).join('');
  el.innerHTML =
    '<div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">스트레스 시나리오 <span style="font-weight:400;color:var(--text-muted);">— 섹터 베타 기반 추정</span></div>' +
    lines +
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">섹터 주식/금리/유가 베타 휴리스틱 추정치 — 실제 손익과 다를 수 있음.</div>';
}
function _escHtmlSafe(s){ return (typeof escHtml==='function') ? escHtml(String(s)) : String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

async function refreshPortfolioTechnicalRisk() {
  var el = document.getElementById('pf-technical-risk');
  if (!el) return;
  var positions = getPortfolioData();
  if (!positions.length) {
    if (typeof renderPortfolioTechnicalRisk === 'function') renderPortfolioTechnicalRisk({ items: [] });
    return;
  }
  let ld = window._liveData || {};
  var enriched = positions.map(function(p) {
    var evidence = typeof _aioDecisionMetric === 'function' ? _aioDecisionMetric(p.ticker, 'price', null) : null;
    var price = evidence && evidence.allowedUse === true ? evidence.value : null;
    return Object.assign({}, p, {
      price: price,
      value: price != null ? price * p.qty : null,
      currentQuoteAllowedUse: evidence && evidence.allowedUse === true,
      quoteSourceKind: evidence && evidence.allowedUse === true ? 'live-quote' : 'unavailable',
      quoteObservedAt: evidence && evidence.allowedUse === true ? evidence.ts : null
    });
  });
  var totalValue = enriched.every(function(p) { return p.value != null && isFinite(p.value) && p.value >= 0; })
    ? enriched.reduce(function(s, p) { return s + p.value; }, 0) : null;
  var tickers = enriched.slice().sort(function(a, b) { return (b.value || 0) - (a.value || 0); }).slice(0, 12);
  el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">포지션별 OHLCV와 기술 리스크를 산출하는 중입니다...</div>';
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

function _renderRiskMetrics(el, data) {
  var var95 = data.var95, var99 = data.var99, sharpe = data.sharpe,
      mddRes = data.mddRes, corrRes = data.corrRes, n = data.n;
  var est = data.estimate || null;
  var rfAnnual = data.rfAnnual != null ? data.rfAnnual : null;
  // 22:PFR02/PFR09 (E4): every number on this panel belongs to a declared
  // scope. The title carries the denominator so a sleeve figure can never read
  // as account risk, and the declaration block states path/cash/RF/snapshot.
  var scopeToken = est ? est.publishedScope : null;
  var scopeLabel = scopeToken === 'whole_account' ? '계좌 전체' : scopeToken === 'invested_sleeve' ? '주식 부분' : null;
  var scopeSuffix = scopeLabel ? ' · ' + scopeLabel : '';

  function fmtLoss(v) { return (v !== null && v !== undefined) ? '-' + (v * 100).toFixed(2) + '%' : '—'; } // v50.22: null일 때 "-—" 대신 "—"
  function fmtN(v, d) { return (v !== null && v !== undefined) ? v.toFixed(d !== undefined ? d : 2) : '—'; }
  function sharpeColor(v) {
    if (v === null || v === undefined) return 'var(--text-muted)';
    return v >= 2 ? 'var(--data-green)' : v >= 1 ? '#211d16' : v >= 0 ? 'var(--text-secondary)' : 'var(--data-red)';
  }
  function sharpeLabel(v) {
    if (v === null || v === undefined) return '';
    return v >= 2 ? '우수' : v >= 1 ? '양호' : v >= 0 ? '보통' : '부진';
  }
  function mddColor(v) {
    if (v === null || v === undefined) return 'var(--text-muted)';
    return v >= 0.3 ? 'var(--data-red)' : v >= 0.15 ? 'var(--data-amber)' : 'var(--data-green)';
  }
  function mddLabel(v) {
    if (v === null || v === undefined) return '';
    return v >= 0.3 ? '위험' : v >= 0.15 ? '주의' : '양호';
  }

  // 선언 블록 — 계좌 성과 보류 + 측정 경로/분모/RF/표본/snapshot.
  var declLines = [];
  if (data.accountPerf && data.accountPerf.status === 'ready') {
    // E4/P1191: 원장 계약을 통과한 실제 계좌 성과 — 규약·기간·표본을 수치와 함께 게시한다.
    var perf = data.accountPerf;
    var perfPct = function(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; };
    declLines.push('<b>실제 계좌 성과 TWR ' + _escHtmlSafe(perfPct(perf.twr)) + ' · MWR ' +
      (perf.mwr == null ? '보류' : _escHtmlSafe(perfPct(perf.mwr))) + '</b> — ' +
      _escHtmlSafe(perf.currency + ' · ' + perf.flowTiming + ' · ' + perf.sample.periods + '기간 ' + perf.sample.from + '~' + perf.sample.to) +
      (perf.mwr == null ? ' · ' + _escHtmlSafe((perf.warnings && perf.warnings[0]) || 'MWR 계산 불가') : ''));
  } else if (data.accountPerf) {
    declLines.push('<b>실제 계좌 성과(TWR/MWR) 보류</b> — ' + _escHtmlSafe(data.accountPerf.message || '원장 없음') +
      ' 아래 지표는 현재 구성을 과거에 적용한 참고도입니다.');
  }
  if (est) {
    var declParts = [
      '경로 ' + est.exposureHistoryMode,
      'rebalance ' + (est.rebalancePolicyApplied ? est.rebalancePolicy : (est.rebalancePolicyDeclared ? est.rebalancePolicyDeclared + '(미사용)' : '미선언')),
      '분모 ' + (scopeToken || '—') + (scopeLabel ? '(' + scopeLabel + ')' : ''),
      'RF ' + (est.rf && est.rf.status === 'accepted' ? '입력' : '미입력 — Sharpe 보류'),
      '표본 ' + (est.sample && est.sample.n != null ? est.sample.n : n) + '일',
      'snapshot ' + est.compositionSnapshotId + ' @ ' + (est.valuationCut || '—')
    ];
    if (est.pathLineage === 'legacy-risk-path') declParts.push('legacy-risk-path · 실제 계좌 이력 아님' + (est.rebalancePolicyDeclared ? ' · 선언 정책 ' + _escHtmlSafe(est.rebalancePolicyDeclared) + ' 미사용' : '')); // P1197: 소비되지 않는 선언을 화면이 말한다
    if (est.pathLineage === 'fixed-target-weight-strategy') {
      var declaredTargets = est.strategy && est.strategy.targetWeights ? Object.keys(est.strategy.targetWeights) : [];
      declParts.push('고정 목표비중 전략 · 실제 계좌 이력 아님' + (est.strategy && est.strategy.cashWeight > 0 ? ' · 현금 ' + (est.strategy.cashWeight * 100).toFixed(1) + '%' : '') + (declaredTargets.length
        ? ' · 목표 ' + declaredTargets.map(function(ticker) { return ticker + ' ' + (est.strategy.targetWeights[ticker] * 100).toFixed(1) + '%'; }).join('/')
        : ''));
    }
    declLines.push(_escHtmlSafe(declParts.join(' · ')));
    if (est.wholeAccountHold) {
      // E3/E4/P1188: 보류 사유를 구분해 말한다 — 통화 미선언/수익률 미입력/전략 경로 미선언.
      var holdReason = est.wholeAccountHold === 'cash-declaration-unresolved' ? '현금 통화 미선언'
        : est.wholeAccountHold === 'strategy-account-scope-not-declared' ? '전략 경로의 계좌 범위 미선언'
        : '현금 수익률 미입력';
      declLines.push('현금 보류: ' + holdReason + ' — 계좌 전체 위험은 게시하지 않습니다(주식 부분만 게시).');
    }
  }
  var declHtml = declLines.length
    ? '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;padding:6px 8px;margin-bottom:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;">' + declLines.join('<br>') + '</div>'
    : '';

  // 지표 카드
  var mdd = mddRes ? mddRes.mdd : null;
  var cards = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:10px;margin-bottom:14px;">';

  cards += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:4px;">1일 VaR (95%)' + scopeSuffix + '</div>' +
    '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:var(--data-red);">' + fmtLoss(var95) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">95% 최대 손실 · 표본 ' + n + '일 · 인증 보류</div></div>';

  cards += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:4px;">1일 VaR (99%)' + scopeSuffix + '</div>' +
    '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:var(--data-red);">' + fmtLoss(var99) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">99% 최대 손실 · 표본 ' + n + '일 · 인증 보류</div></div>';

  var sharpeSub = sharpe !== null && sharpe !== undefined
    ? sharpeLabel(sharpe) + ' (RF 입력, ' + n + '일)'
    : (rfAnnual == null && est ? 'RF 미입력 — 보류 (' + n + '일)' : '데이터 부족');
  cards += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:4px;">Sharpe Ratio' + scopeSuffix + '</div>' +
    '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + sharpeColor(sharpe) + ';">' + fmtN(sharpe) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + sharpeSub + '</div></div>';

  cards += '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:4px;padding:10px 12px;">' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-bottom:4px;">최대낙폭 (MDD)' + scopeSuffix + '</div>' +
    '<div style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:' + mddColor(mdd) + ';">' + fmtLoss(mdd) + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + (mdd !== null ? mddLabel(mdd) + ' (기간: ' + n + '일)' : '데이터 부족') + '</div></div>';

  cards += '</div>';

  // 상관계수 히트맵 (HTML 테이블 + 냉온색)
  var heatHtml = '';
  if (corrRes && corrRes.tickers && corrRes.tickers.length >= 2) {
    var ts = corrRes.tickers;
    heatHtml = '<div style="margin-bottom:12px;">' +
      '<div style="font-size:11px;color:var(--text-secondary);font-weight:700;margin-bottom:8px;">종목 간 상관계수 매트릭스</div>' +
      '<div style="overflow-x:auto;"><table style="border-collapse:separate;border-spacing:3px;font-size:11px;font-family:var(--font-mono);">';

    // 헤더
    heatHtml += '<tr><td style="padding:4px 8px;"></td>';
    ts.forEach(function(t) {
      heatHtml += '<td style="padding:4px 8px;text-align:center;font-size:10px;font-weight:700;color:var(--text-secondary);">' + t + '</td>';
    });
    heatHtml += '</tr>';

    // 데이터 행
    corrRes.matrix.forEach(function(row, i) {
      heatHtml += '<tr><td style="padding:4px 8px;font-size:10px;font-weight:700;color:var(--text-secondary);">' + ts[i] + '</td>';
      row.forEach(function(val) {
        var abs = Math.abs(val);
        var bg, textC;
        if (val >= 0.99) {
          bg = 'rgba(33,29,22,0.4)'; textC = 'var(--text-muted)';
        } else if (val > 0) {
          bg = 'rgba(' + Math.round(210 * abs) + ',' + Math.round(50 * (1 - abs)) + ',' + Math.round(50 * (1 - abs)) + ',0.4)';
          textC = abs > 0.5 ? '#fff' : 'var(--text-secondary)';
        } else {
          bg = 'rgba(' + Math.round(40 * (1 - abs)) + ',' + Math.round(80 * (1 - abs)) + ',' + Math.round(50 + 150 * abs) + ',0.4)';
          textC = abs > 0.5 ? '#fff' : 'var(--text-secondary)';
        }
        heatHtml += '<td style="padding:5px 10px;background:' + bg + ';text-align:center;border-radius:3px;font-weight:600;color:' + textC + ';">' +
          (Math.abs(val - 1) < 0.001 ? '1.00' : val.toFixed(2)) + '</td>';
      });
      heatHtml += '</tr>';
    });
    heatHtml += '</table></div>';
    heatHtml += '<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">빨강=정상관(분산 효과↓) · 파랑=역상관(분산 효과↑) · 기간: ' + n + '거래일</div>';
    heatHtml += '</div>';
  }

  var note = '<div style="font-size:10px;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border);">' +
    '역사적 시뮬레이션 VaR — ' + (scopeLabel ? _escHtmlSafe(scopeLabel) + ' 범위' : '선언된 범위') +
    '의 과거 수익률 분포 기반 참고값이며 인증 보류 상태입니다. 실제 손실은 이를 초과할 수 있습니다. 투자 결정 참고용으로만 활용하세요.</div>';

  el.innerHTML = declHtml + cards + heatHtml + note;
}

function _aioFmtBtPct(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(d == null ? 2 : d) + '%';
}
function _aioFmtBtNum(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return Number(v).toFixed(d == null ? 2 : d);
}
// E4/P1190: 인증 문구는 실제 판정을 따른다 — '인증 보류'를 고정 라벨로 두면 인증된 표본도
// 보류로 보이고, 왜 보류인지 소비자가 알 수 없다.
var PF_VAR_REASON_LABELS = {
  'sample-below-declared-minimum': '표본 부족',
  'tail-below-declared-minimum': '꼬리 부족',
  'bootstrap-band-exceeds-declared-maximum': '부트스트랩 변동 큼',
  'estimator-sensitivity-exceeds-declared-maximum': '추정량 민감',
  'tail-sample-single-observation': '꼬리 1개'
};
function _aioBtVarCertLabel(cert) {
  if (!cert || typeof cert !== 'object') return '인증 보류';
  if (cert.certification === 'certified') return '인증';
  var reasons = (cert.stability && Array.isArray(cert.stability.certificationReasons)) ? cert.stability.certificationReasons : [];
  if (!reasons.length && Array.isArray(cert.certificationReasons)) reasons = cert.certificationReasons;
  return reasons.length ? '인증 보류 — ' + reasons.map(function(reason) { return PF_VAR_REASON_LABELS[reason] || reason; }).join(', ') : '인증 보류';
}
function _aioFmtBtMoney(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function _aioBtTd(value, cls) {
  return '<td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);' + (cls || '') + '">' + value + '</td>';
}
function _aioRenderPortfolioBacktestLab(model) {
  var el = document.getElementById('pf-backtest-output');
  if (!el) return;
  if (!model || !model.ok) {
    var reason = model && model.warnings && model.warnings.length ? model.warnings.join(' · ') : '백테스트를 계산할 수 없습니다.';
    el.innerHTML = '<div style="color:var(--data-amber);font-size:11px;padding:8px 0;">' + _escHtmlSafe(reason) + '</div>';
    return;
  }
  var p = model.performance || {};
  var tone = function(v) { return v < 0 ? 'color:var(--data-red);' : 'color:var(--data-green);'; };
  var metricRows = [
    ['Start Balance', _aioFmtBtMoney(p.startBalance), _aioFmtBtMoney(p.startBalance)],
    ['End Balance', _aioFmtBtMoney(p.endBalance), _aioFmtBtMoney(p.benchmarkEndBalance)],
    ['CAGR', _aioFmtBtPct(p.cagr), _aioFmtBtPct(p.benchmarkCagr)],
    ['Stdev', _aioFmtBtPct(p.stdev), _aioFmtBtPct(p.benchmarkStdev)],
    ['Best Year', _aioFmtBtPct(p.bestYear), '—'],
    ['Worst Year', _aioFmtBtPct(p.worstYear), '—'],
    ['Max Drawdown', _aioFmtBtPct(-p.maxDrawdown), '—'],
    ['Sharpe / Sortino', _aioFmtBtNum(p.sharpe) + ' / ' + _aioFmtBtNum(p.sortino), '—'],
    ['Active / Tracking Error / IR', _aioFmtBtPct(p.activeReturn) + ' / ' + _aioFmtBtPct(p.trackingError) + ' / ' + _aioFmtBtNum(p.informationRatio), '—'],
    ['Beta / Alpha / Corr', _aioFmtBtNum(p.beta) + ' / ' + _aioFmtBtPct(p.alpha) + ' / ' + _aioFmtBtNum(p.benchmarkCorrelation), '—'],
    ['VaR / CVaR 5% monthly' + (p.varCertification ? ' (표본 ' + p.varCertification.sampleN + '·꼬리 ' + p.varCertification.tailN + ' · ' + _aioBtVarCertLabel(p.varCertification) + ')' : ''), _aioFmtBtPct(-p.historicalVar5) + ' / ' + _aioFmtBtPct(-p.conditionalVar5), '—'],
    ['Up / Down Capture', _aioFmtBtPct(p.upsideCapture) + ' / ' + _aioFmtBtPct(p.downsideCapture), '—']
  ];
  var metricHtml = metricRows.map(function(r) {
    return '<tr><td style="padding:6px 8px;color:var(--text-secondary);">' + _escHtmlSafe(r[0]) + '</td>' +
      _aioBtTd(r[1]) + _aioBtTd(r[2]) + '</tr>';
  }).join('');
  var annualHtml = (model.annualRows || []).slice(-12).reverse().map(function(r) {
    return '<tr><td style="padding:6px 8px;font-family:var(--font-mono);">' + _escHtmlSafe(r.year) + '</td>' +
      _aioBtTd(_aioFmtBtPct(r.return), tone(r.return)) +
      _aioBtTd(_aioFmtBtMoney(r.balance)) +
      _aioBtTd(_aioFmtBtPct(r.benchmarkReturn), tone(r.benchmarkReturn)) +
      _aioBtTd(_aioFmtBtMoney(r.benchmarkBalance)) + '</tr>';
  }).join('');
  var ddHtml = (model.drawdowns || []).slice(0, 6).map(function(d, i) {
    return '<tr><td style="padding:6px 8px;text-align:center;">' + (i + 1) + '</td>' +
      '<td style="padding:6px 8px;font-family:var(--font-mono);">' + _escHtmlSafe(d.start || '—') + '</td>' +
      '<td style="padding:6px 8px;font-family:var(--font-mono);">' + _escHtmlSafe(d.end || '—') + '</td>' +
      '<td style="padding:6px 8px;font-family:var(--font-mono);">' + _escHtmlSafe(d.recoveryBy || '—') + '</td>' +
      _aioBtTd(d.recoveryMonths == null ? '—' : d.recoveryMonths + 'm') +
      _aioBtTd(d.underwaterMonths == null ? '—' : d.underwaterMonths + 'm') +
      _aioBtTd(_aioFmtBtPct(-d.drawdown), 'color:var(--data-red);font-weight:800;') + '</tr>';
  }).join('');
  var compHtml = (model.components || []).slice(0, 8).map(function(c) {
    return '<tr><td style="padding:6px 8px;font-family:var(--font-mono);font-weight:800;">' + _escHtmlSafe(c.ticker) + '</td>' +
      _aioBtTd(_aioFmtBtPct(c.weight, 1)) +
      _aioBtTd(_aioFmtBtPct(c.standaloneReturn)) +
      _aioBtTd(_aioFmtBtMoney(c.returnContribution)) +
      _aioBtTd(c.riskContribution == null ? '—' : _aioFmtBtPct(c.riskContribution, 1)) + '</tr>';
  }).join('');
  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">' +
      '<div style="font-size:11px;color:var(--text-muted);">기간 <b style="color:var(--text-primary);font-family:var(--font-mono);">' + _escHtmlSafe(model.settings.startMonth) + ' ~ ' + _escHtmlSafe(model.settings.endMonth) + '</b> · ' +
      '리밸런싱 <b style="color:var(--text-primary);">' + _escHtmlSafe(model.settings.rebalanceType) + '</b> · 벤치마크 <b style="color:var(--text-primary);font-family:var(--font-mono);">' + _escHtmlSafe(model.settings.benchmarkSymbol) + '</b><br>' +
      '조정주가 · 현재 구성 소급 · 배분 basis ' + _escHtmlSafe(model.settings.targetWeightBasis || '—') + ' · 거래비용 미모형 · RF ' + (model.settings.rfAnnual == null ? '미입력' : _aioFmtBtPct(model.settings.rfAnnual, 2)) + '</div>' +
      '<span class="aio-source-badge is-delayed">REFERENCE-ONLY · delayed monthly backtest</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;">' +
      '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:10px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">CAGR</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:' + (p.cagr >= p.benchmarkCagr ? 'var(--data-green)' : 'var(--data-amber)') + ';">' + _aioFmtBtPct(p.cagr) + '</div><div style="font-size:10px;color:var(--text-muted);">bench ' + _aioFmtBtPct(p.benchmarkCagr) + '</div></div>' +
      '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:10px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Max Drawdown</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:var(--data-red);">' + _aioFmtBtPct(-p.maxDrawdown) + '</div><div style="font-size:10px;color:var(--text-muted);">worst underwater path</div></div>' +
      '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:10px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Sharpe / Sortino</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:var(--text-primary);">' + _aioFmtBtNum(p.sharpe) + ' / ' + _aioFmtBtNum(p.sortino) + '</div><div style="font-size:10px;color:var(--text-muted);">RF ' + _aioFmtBtPct(model.settings.rfAnnual, 1) + '</div></div>' +
      '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:10px;"><div style="font-size:10px;color:var(--text-muted);font-weight:800;">Active / IR</div><div style="font-size:18px;font-family:var(--font-mono);font-weight:900;color:' + (p.activeReturn >= 0 ? 'var(--data-green)' : 'var(--data-red)') + ';">' + _aioFmtBtPct(p.activeReturn) + ' / ' + _aioFmtBtNum(p.informationRatio) + '</div><div style="font-size:10px;color:var(--text-muted);">tracking error ' + _aioFmtBtPct(p.trackingError) + '</div></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px;">' +
      '<div style="overflow-x:auto;"><div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">Performance Summary</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text-muted);"><th style="text-align:left;padding:6px 8px;">Metric</th><th style="text-align:right;padding:6px 8px;">Portfolio</th><th style="text-align:right;padding:6px 8px;">Benchmark</th></tr></thead><tbody>' + metricHtml + '</tbody></table></div>' +
      '<div style="overflow-x:auto;"><div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">Annual Returns</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text-muted);"><th style="text-align:left;padding:6px 8px;">Year</th><th style="text-align:right;padding:6px 8px;">Return</th><th style="text-align:right;padding:6px 8px;">Balance</th><th style="text-align:right;padding:6px 8px;">Bench</th><th style="text-align:right;padding:6px 8px;">Bench Bal</th></tr></thead><tbody>' + annualHtml + '</tbody></table></div>' +
      '<div style="overflow-x:auto;"><div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">Worst Drawdowns</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text-muted);"><th style="padding:6px 8px;">#</th><th style="text-align:left;padding:6px 8px;">Start</th><th style="text-align:left;padding:6px 8px;">Trough</th><th style="text-align:left;padding:6px 8px;">Recovery</th><th style="text-align:right;padding:6px 8px;">Recover</th><th style="text-align:right;padding:6px 8px;">Underwater</th><th style="text-align:right;padding:6px 8px;">DD</th></tr></thead><tbody>' + ddHtml + '</tbody></table></div>' +
      '<div style="overflow-x:auto;"><div style="font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;">Return / Risk Attribution</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text-muted);"><th style="text-align:left;padding:6px 8px;">Ticker</th><th style="text-align:right;padding:6px 8px;">Weight</th><th style="text-align:right;padding:6px 8px;">Standalone</th><th style="text-align:right;padding:6px 8px;">Return $</th><th style="text-align:right;padding:6px 8px;">Risk</th></tr></thead><tbody>' + compHtml + '</tbody></table></div>' +
    '</div>' +
    '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-top:10px;border-top:1px solid var(--border);padding-top:8px;">' + model.warnings.map(_escHtmlSafe).join(' · ') + '</div>';
}

async function runPortfolioBacktestLab() {
  var out = document.getElementById('pf-backtest-output');
  if (!out) return;
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  if (!positions || !positions.length) {
    out.innerHTML = '<div style="color:var(--data-amber);font-size:11px;padding:8px 0;">보유 종목을 먼저 추가하세요.</div>';
    return;
  }
  var initial = Number((document.getElementById('pf-bt-initial') || {}).value) || 10000;
  var startYear = Number((document.getElementById('pf-bt-start-year') || {}).value) || 2017;
  var rebalance = String((document.getElementById('pf-bt-rebalance') || {}).value || 'annual');
  var benchmark = String((document.getElementById('pf-bt-benchmark') || {}).value || 'SPY').trim().toUpperCase();
  var tickers = positions.map(function(p) { return String(p.ticker || '').trim().toUpperCase(); }).filter(Boolean);
  if (benchmark && tickers.indexOf(benchmark) < 0) tickers.push(benchmark);
  out.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;">월말 가격 이력을 수집하는 중입니다... (' + tickers.map(_escHtmlSafe).join(', ') + ')</div>';
  var priceMap = {};
  var settled = await Promise.allSettled(tickers.map(async function(t) {
    var d = (typeof _fetchYahooChartData === 'function') ? await _fetchYahooChartData(t, '10y', '1d') : null;
     if (d && d.timestamps && d.closes && (Array.isArray(d.adjustedCloses) || Array.isArray(d.adjCloses)) && d.backtestEligible !== false) priceMap[t] = d;
  }));
  var failed = tickers.filter(function(t) { return !priceMap[t]; });
  var model = window.AIO && typeof window.AIO.buildPortfolioBacktestLab === 'function'
    ? window.AIO.buildPortfolioBacktestLab(priceMap, positions, {
        initialAmount: initial,
        startYear: startYear,
        endYear: new Date().getFullYear(),
        rebalanceType: rebalance,
        benchmarkSymbol: benchmark || 'SPY',
        // No time-varying RF series is loaded here.  Keep RF-dependent
        // statistics unavailable instead of silently applying a fixed 4.3%.
        rfAnnual: null
      })
    : { ok: false, warnings: ['백테스트 엔진을 찾을 수 없습니다.'] };
  if (model && failed.length) {
    model.warnings = (model.warnings || []).concat(['가격 이력 수신 실패: ' + failed.join(', ')]);
  }
  window._lastPortfolioBacktestLab = { model: model, priceMap: priceMap, checkedAt: Date.now(), fetchStatuses: settled.map(function(r, i) { return { ticker: tickers[i], status: r.status }; }) };
  _aioRenderPortfolioBacktestLab(model);
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
  try { localStorage.setItem(PF_JOURNAL_KEY, JSON.stringify(entries)); } catch(_) {}
  if (statusEl) statusEl.textContent = '최근 노트 저장: ' + new Date(entry.ts).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  if (typeof showToast === 'function') showToast('매매 복기 노트 저장 완료');
  return entry;
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
      status.textContent = positions.length + '종목 분석 준비 · ' + top + (positions.length > 4 ? ' 외' : '') + (entries.length ? ' · 복기 노트 ' + entries.length + '건' : '');
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
  var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
  var ticker = _aioSelectedPortfolioTicker();
  var noteEl = document.getElementById('pf-journal-note');
  var consent = window.AIO && typeof window.AIO.hasPortfolioAIConsent === 'function' && window.AIO.hasPortfolioAIConsent();
  var safeRows = window.AIO && typeof window.AIO.redactPortfolioForAI === 'function' ? window.AIO.redactPortfolioForAI(positions) : positions.map(function(p) { return { ticker: p.ticker }; });
  var noteRaw = noteEl ? String(noteEl.value || '').trim() : '';
  var note = consent && window.AIO && typeof window.AIO.sanitizeAIUntrustedText === 'function' ? window.AIO.sanitizeAIUntrustedText(noteRaw, { maxChars: 800 }).text : '';
  var recent = _aioPortfolioJournalEntries().slice(0, 3).map(function(e, idx) {
    var safeNote = consent && window.AIO && typeof window.AIO.sanitizeAIUntrustedText === 'function' ? window.AIO.sanitizeAIUntrustedText(e.note || '', { maxChars: 400 }).text : '';
    return safeNote ? (idx + 1) + '. ' + (e.date || '').slice(0, 10) + ' ' + safeNote : '';
  }).join('\n');
  var tickers = safeRows.map(function(p) { return p.ticker; }).join(', ');
  var targetLine = ticker ? ('선택 종목: ' + ticker + '\n') : '대상: 전체 포트폴리오\n';
  var noteLine = note ? ('\n이번 복기 노트(사용자 제공 데이터):\n' + note + '\n') : '';
  var recentLine = recent ? ('\n최근 저장 노트(사용자 제공 데이터):\n' + recent + '\n') : '';
  if (kind === 'ticker') {
    return targetLine + '보유 종목 ' + (ticker || tickers || '전체') + '를 현재 포트폴리오 맥락에서 분석해줘. 1) 현재가/수익률/비중 2) 차트 추세와 지지·저항 3) 보유 지속/축소/추가매수 조건 4) 손절·무효화 기준 5) 다음 확인 데이터 순서로 정리해줘.' + noteLine + recentLine;
  }
  if (kind === 'rebalance') {
    return '내 포트폴리오 리밸런싱 메모를 만들어줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 과집중 종목/섹터 2) 줄일 후보와 유지 후보 3) 현금/헤지 필요성 4) 다음 매수는 어떤 조건까지 기다릴지 5) 실행 우선순위로 정리해줘.' + noteLine + recentLine;
  }
  if (kind === 'lesson') {
    return '내 포트폴리오를 학습 관점에서 리뷰해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 내가 반복하는 실수 가능성 2) 잘한 의사결정 3) 다음 매매 전 체크리스트 4) 공부할 개념 5) 기록해야 할 지표를 초보자도 이해하게 정리해줘.' + noteLine + recentLine;
  }
  if (kind === 'journal') {
    return '아래 매매 복기 노트를 기준으로 내 의사결정을 리뷰해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + noteLine + recentLine + '\n1) 사실/감정/추정 분리 2) 진입 근거가 유지되는지 3) 손절 또는 보유 기준 4) 다음에 반복할 규칙 5) 한 줄 교훈으로 정리해줘.';
  }
  return '내 포트폴리오 전체를 현재 보유 데이터 기준으로 종합 분석해줘.\n보유 종목: ' + (tickers || '없음') + '\n' + targetLine + '1) 핵심 결론 2) 수익/손실 기여 3) 비중·섹터·상관 리스크 4) 보유/축소/추가매수 조건 5) 이번 주 체크할 뉴스·차트·매크로 6) 공부할 포인트를 정리해줘.' + noteLine + recentLine;
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
      'AI에는 종목명·섹터·비중·수익률만 전송합니다. 계좌ID·사용자ID·이메일·수량·매수가·목표가·메모는 제외됩니다. 이번 세션에서만 동의할까요?',
      function() {
        if (window.AIO && typeof window.AIO.setPortfolioAIConsent === 'function') window.AIO.setPortfolioAIConsent(true);
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
    if (note) window._aioSavePortfolioJournal();
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
      inp.value = prompt;
      if (typeof chatSendUnified === 'function') chatSendUnified();
    } catch(e) {
      if (typeof showToast === 'function') showToast('AI 패널 실행 오류: ' + (e && e.message || e));
    }
  }, 120);
};

function exportPortfolio() {
  const data = getPortfolioData();
  if (!data.length) { showToast('내보낼 포지션이 없습니다.'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aio-portfolio-' + new Date().toISOString().split('T')[0] + '.json';
  a.click(); URL.revokeObjectURL(url);
}
function importPortfolio(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      // v46.9: 스키마 검증 + XSS 정제
      data = data.filter(function(p) {
        return p && typeof p.ticker === 'string' && /^[A-Z0-9.\-^=]{1,12}$/i.test(p.ticker.trim());
      }).map(function(p) {
        p.ticker = p.ticker.trim().toUpperCase();
        if (p.memo) p.memo = String(p.memo).slice(0, 200);
        if (p.note) p.note = String(p.note).slice(0, 200);
        p.qty = Number(p.qty) || 0; p.cost = Number(p.cost) || 0;
        return p;
      });
      if (data.length === 0) throw new Error('유효한 포지션 없음');
      showConfirmModal('데이터 가져오기', data.length + '개 포지션을 가져오시겠습니까? 기존 데이터가 대체됩니다.', async function() {
        // E3/P1187 (11 P11-01): 가져오기도 durable ack 뒤에만 '완료'를 말한다 — persist가 거부되면
        // 기존 데이터가 남아 있으므로 성공 문구는 거짓이 된다.
        const saved = await savePortfolioData(data);
        renderPortfolio();
        showToast(saved.ok
          ? data.length + '개 포지션 가져오기 완료'
          : '영구 저장 실패 — 가져오기가 확정되지 않았습니다. 새로고침 시 이전 데이터로 되돌아올 수 있습니다.');
      }, '');
    } catch(err) { showToast('파일 형식이 올바르지 않습니다.'); }
  });
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════════════════
// 다중 워치리스트 시스템 — localStorage CRUD + Live Price + SCREENER_DB 연동
// ══════════════════════════════════════════════════════════════════════
var WL_STORAGE_KEY = 'aio_watchlists';
var WL_ACTIVE_KEY = 'aio_watchlist_active';

function getWatchlists() {
  try {
    var raw = localStorage.getItem(WL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch(e) { return []; }
}
function saveWatchlists(lists) {
  try { localStorage.setItem(WL_STORAGE_KEY, JSON.stringify(lists)); } catch(e) {}
}
function getActiveWatchlistId() {
  return localStorage.getItem(WL_ACTIVE_KEY) || '';
}
function setActiveWatchlistId(id) {
  try { localStorage.setItem(WL_ACTIVE_KEY, id); } catch(e) {}
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
    '워치리스트 삭제',
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
  var sel = document.getElementById('wl-select');
  if (!sel) return;
  setActiveWatchlistId(sel.value);
  renderWatchlistContent();
  updateWatchlistButtons();
}

function addToWatchlist(ticker, note) {
  var activeId = getActiveWatchlistId();
  if (!activeId) { showToast('먼저 워치리스트를 선택하세요.'); return; }
  // 인자 없으면 입력 필드에서 가져오기
  if (!ticker) {
    var inp = document.getElementById('wl-add-ticker');
    ticker = (inp ? inp.value : '').trim().toUpperCase();
    var noteInp = document.getElementById('wl-add-note');
    note = noteInp ? noteInp.value.trim() : '';
  }
  if (!ticker) { showToast('티커를 입력하세요.'); return; }
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) return;
  // 중복 체크
  if (wl.tickers.some(function(t) { return t.sym === ticker; })) {
    showToast(ticker + '는 이미 이 리스트에 있습니다.');
    return;
  }
  wl.tickers.push({ sym: ticker, note: note || '', addedAt: Date.now() });
  saveWatchlists(lists);
  // 입력 필드 초기화
  var inp = document.getElementById('wl-add-ticker');
  if (inp) inp.value = '';
  var noteInp = document.getElementById('wl-add-note');
  if (noteInp) noteInp.value = '';
  renderWatchlistContent();
}

function removeFromWatchlist(ticker) {
  var activeId = getActiveWatchlistId();
  if (!activeId) return;
  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) return;
  wl.tickers = wl.tickers.filter(function(t) { return t.sym !== ticker; });
  saveWatchlists(lists);
  renderWatchlistContent();
}


// 간단 토스트 알림
function showToast(msg) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(34,117,76,0.95);color:#000;padding:8px 18px;border-radius:4px;font-size:11px;font-weight:700;z-index:99998;pointer-events:none;opacity:0;transition:opacity 0.3s;';
  document.body.appendChild(toast);
  requestAnimationFrame(function() { toast.style.opacity = '1'; });
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 400);
  }, 2000);
}

function updateWatchlistButtons() {
  var hasActive = !!getActiveWatchlistId();
  var renBtn = document.getElementById('wl-rename-btn');
  var delBtn = document.getElementById('wl-delete-btn');
  var addRow = document.getElementById('wl-add-row');
  if (renBtn) renBtn.disabled = !hasActive;
  if (delBtn) delBtn.disabled = !hasActive;
  if (addRow) addRow.style.display = hasActive ? 'block' : 'none';
}

function refreshWatchlistUI() {
  var sel = document.getElementById('wl-select');
  if (!sel) return;
  var lists = getWatchlists();
  var activeId = getActiveWatchlistId();
  sel.innerHTML = '<option value="">리스트 ' + lists.length + '개</option>';
  lists.forEach(function(l) {
    var opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name + ' (' + l.tickers.length + '종목)';
    if (l.id === activeId) opt.selected = true;
    sel.appendChild(opt);
  });
  updateWatchlistButtons();
  renderWatchlistContent();
}

function renderWatchlistContent() {
  var activeId = getActiveWatchlistId();
  var emptyMsg = document.getElementById('wl-empty-msg');
  var table = document.getElementById('wl-table');
  var tbody = document.getElementById('wl-tbody');
  if (!emptyMsg || !table || !tbody) return;

  if (!activeId) {
    emptyMsg.style.display = 'block';
    table.style.display = 'none';
    emptyMsg.textContent = '리스트를 선택하거나 새로 만들어주세요. 관심 종목을 그룹별로 관리할 수 있습니다.';
    return;
  }

  var lists = getWatchlists();
  var wl = lists.find(function(l) { return l.id === activeId; });
  if (!wl) {
    emptyMsg.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  if (wl.tickers.length === 0) {
    emptyMsg.style.display = 'block';
    table.style.display = 'none';
    emptyMsg.textContent = '"' + wl.name + '" 리스트가 비어있습니다. 위에서 티커를 추가하거나 스크리너에서  버튼을 눌러주세요.';
    return;
  }

  emptyMsg.style.display = 'none';
  table.style.display = 'table';

  let ld = window._liveData || {};
  // SCREENER_DB에서 신호 정보 가져오기
  var dbMap = {};
  var screenerRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  if (Array.isArray(screenerRows)) {
    screenerRows.forEach(function(s) { dbMap[s.sym] = s; });
  }

  var html = '';
  wl.tickers.forEach(function(t) {
    var d = ld[t.sym];
    var db = dbMap[t.sym];
    var price = d && d.price ? d.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
    var chg = d && d.pct != null ? d.pct : null;
    var cc = chg !== null ? (chg >= 0 ? 'var(--data-green)' : 'var(--data-red)') : 'var(--text-muted)';
    var chgStr = chg !== null ? ((chg >= 0 ? '+' : '') + chg.toFixed(2) + '%') : '—';
    var signal = db ? db.signal : '—';
    var sc = signal === 'BUY' ? 'var(--data-green)' : signal === 'SELL' ? 'var(--data-red)' : signal === 'WATCH' ? 'var(--data-amber)' : 'var(--text-muted)';
    var sb = signal === 'BUY' ? 'rgba(34,117,76,0.15)' : signal === 'SELL' ? 'rgba(177,58,48,0.15)' : signal === 'WATCH' ? 'rgba(33,29,22,0.15)' : 'rgba(33,29,22,0.15)';
    var nameStr = db ? db.name : '';

    var _eSym = escHtml(t.sym); // v46.9: XSS 방어
    html += '<tr class="aio-hover-row" style="border-bottom:1px solid var(--surface-4);cursor:pointer;" data-action="_aioPortfolioTicker" data-arg="' + escHtml(_eSym) + '">' +
      '<td style="padding:6px 8px;"><b style="color:var(--text-primary);font-family:var(--font-mono);font-size:11px;">' + _eSym + '</b>' + (nameStr ? '<div style="font-size:11px;color:var(--text-muted);">' + escHtml(nameStr) + '</div>' : '') + '</td>' +
      '<td style="text-align:right;padding:6px;font-family:var(--font-mono);font-weight:700;font-size:10px;">' + price + '</td>' +
      '<td style="text-align:right;padding:6px;font-family:var(--font-mono);font-weight:700;font-size:10px;color:' + cc + ';">' + chgStr + '</td>' +
      '<td style="text-align:center;padding:6px;">' + (signal !== '—' ? '<span style="background:' + sb + ';color:' + sc + ';padding:1px 6px;border-radius:3px;font-size:11px;font-weight:700;">' + (typeof _scrSignalLabel === 'function' ? _scrSignalLabel(signal) : signal) + '</span>' : '<span style="color:var(--text-muted);font-size:11px;">—</span>') + '</td>' +
      '<td style="padding:6px;color:var(--text-muted);font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(t.note || '') + '</td>' +
      '<td style="text-align:center;padding:6px;">' +
        '<button data-action="removeFromWatchlist" data-arg="' + escHtml(_eSym) + '" data-stop="1" aria-label="' + escHtml(_eSym) + ' 관심 종목에서 삭제" style="background:none;border:none;cursor:pointer;font-size:11px;" title="삭제"></button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

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
    try { renderWatchlistContent(); } catch(err) {}
  }
});
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

// ── v29.1: Default suggestion chips — 심도 높은 전문 질문 ──────────────
const CHAT_DEFAULT_CHIPS = {
  // v35.4 B6: 기존 빈 페이지에 자연스러운 질문 추가
  home: [
    '오늘 시장 종합 분석해줘',
    '현재 국면에서 역사적으로 어떤 패턴이 있었어?',
    '지금 매수/관망 중 뭐가 나을까 데이터로 보여줘',
    '시장 스코어 기반 대응 전략은?'
  ],
  sentiment: [
    '지금 F&G 수준에서 역사적으로 어땠어?',
    '현재 공포/탐욕 구간의 과거 수익률 데이터는?',
    'VIX 이 수준에서 과거에 어떤 일이 있었어?',
    '심리 지표 종합 분석해줘'
  ],
  breadth: [
    '시장폭이 이 수준이면 어떤 의미야?',
    '지금 상승 종목 비율로 보면 시장 건강한 거야?',
    '과거 비슷한 시장폭에서 어떻게 됐어?',
    'McClellan 지표 해석해줘'
  ],
  signal: [
    '지금 트레이딩 스코어와 시장 건강도 기반으로 진입 타이밍 어때?',
    '현재 VIX 수준에서 최적의 포지션 사이징 전략은?',
    '시장 국면(상승/조정/하락)별 섹터 배분 어떻게 가져가야 해?',
    '풋콜 비율과 공포탐욕 지수가 지금 뭘 시사하고 있어?'
  ],
  macro: [
    '현재 Yield Curve 역전 해소 속도가 경기침체 타이밍에 대해 뭘 시사해?',
    '연준 QT 종료와 유동성 전환이 자산별 수급에 미칠 영향 분석해줘',
    'ISM 제조업 vs 서비스업 괴리가 커지는데, 이게 스태그 시그널이야?',
    '달러 약세 전환 시 EM·원자재·Gold 포지션 어떻게 잡아야 해?',
    '국채 공급·term premium·HY OAS·시장폭을 하나의 위험 전이 사슬로 분석해줘',
    'AI CAPEX와 기업채 발행이 장기금리·신용·주식 변동성에 미치는 경로를 검증해줘'
  ],
  technical: [
    '현재 시장 폭(Breadth) 지표들이 200MA 대비 어떤 시그널 주고 있어?',
    'VIX Term Structure 콘탱고/백워데이션 상태에서 최적 헤지 전략은?',
    'NVDA의 볼린저밴드+MACD+거래량 종합 분석으로 진입 시점 잡아줘',
    'S&P 섹터 로테이션 흐름 보고 다음 주도 섹터 어디인지 판단해줘'
  ],
  fundamental: [
    'Mag7 실적 성장률 둔화 추세에서 PEG 기준 가장 매력적인 종목은?',
    'AI capex 사이클에서 수혜-피해 밸류체인을 FCF 기준으로 정리해줘',
    'TSMC vs 삼성 파운드리 점유율 전쟁에서 투자자가 봐야 할 핵심 지표는?',
    '현재 HY 스프레드와 기업 부도율 추세가 Credit Cycle 어디쯤이야?'
  ],
  themes: [
    'AI 인프라(전력·쿨링·HBM) vs AI 소프트웨어, 지금 어디에 베팅해야 해?',
    'AI 추론 효율에서 메모리 근접성과 하드웨어 특화도의 trade-off를 설명해줘',
    'Bloomberg AI 거래 순환도에서 서비스·투자·하드웨어 연결을 역할별로 분해해줘',
    '방산 테마가 구조적 성장인지 이벤트 드리븐인지 판단 근거 줘',
    '원전 르네상스 테마의 수혜 밸류체인과 시장 규모 전망해줘',
    'GLP-1 비만치료제 시장 확대가 식품·보험·헬스케어에 미칠 2차 파급효과는?',
    '위성통신·우주산업 테마의 현재 성숙도와 핵심 수혜 기업 분석해줘',
    '리쇼어링·공급망 재편 수혜 섹터와 관세 리스크 분석해줘'
  ],
  'theme-detail': [
    '이 테마의 TAM 성장률과 현재 침투율 기준으로 투자 매력도 평가해줘',
    '대장주 vs 후발주자 밸류에이션 갭이 정당한지 분석해줘',
    '이 테마에 대한 기관 포지셔닝(13F, 숏Interest) 현황은?',
    '관련 ETF의 구성종목·비용·추적오차 비교해줘'
  ],
  briefing: [
    '오늘 시장 데이터를 종합해서 Bull/Bear/Base 시나리오별 확률 매겨줘',
    '현재 포지셔닝 데이터(Put/Call, AAII, 기관 플로우)가 뭘 시사해?',
    '지금 시장 국면에서 Risk/Reward 비율이 가장 좋은 트레이드는?',
    '최근 뉴스 흐름과 가격 움직임 사이에 디버전스가 있어?'
  ],
  portfolio: [
    '내 포트폴리오의 팩터 노출도(성장·가치·모멘텀·변동성) 분석해줘',
    '현 시장에서 내 포트폴리오의 최대 예상 손실(VaR 95%) 추정해줘',
    '섹터별 비중과 상관관계 기반으로 최적 리밸런싱 제안해줘',
    '내 종목들 중 어닝 시즌에 가장 리스크 높은 포지션은?'
  ]
};
window.CHAT_DEFAULT_CHIPS = CHAT_DEFAULT_CHIPS;

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

function openChatHistory(ctxId) {
  // 기존 오버레이 제거
  let overlay = document.getElementById('chat-history-overlay');
  if (overlay) { if (overlay._aioClose) overlay._aioClose(); else overlay.remove(); }
  const previousFocus = document.activeElement;

  const history = _getChatHistory().filter(h => !ctxId || h.ctx === ctxId).reverse();

  overlay = document.createElement('div');
  overlay.id = 'chat-history-overlay';
  overlay.className = 'chat-history-overlay open';
  overlay._aioClose = function() {
    overlay.remove();
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
  };
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay._aioClose(); });
  overlay.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); overlay._aioClose(); }
    if (e.key !== 'Tab') return;
    const controls = Array.from(overlay.querySelectorAll('button:not([disabled]),[tabindex="0"]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  const ctxLabel = ctxId ? ((window.CHAT_CONTEXTS && window.CHAT_CONTEXTS[ctxId] && window.CHAT_CONTEXTS[ctxId].label) || ctxId) : '전체';
  overlay.innerHTML = `
    <div class="chat-history-panel" role="dialog" aria-modal="true" aria-labelledby="chat-history-title">
      <div class="ch-header">
        <span class="ch-title" id="chat-history-title">대화 기록 (${escHtml(ctxLabel)}) - ${history.length}건</span>
        <div style="display:flex;gap:6px;">
          ${history.length > 0 ? '<button data-action="_aioChatHistoryClear" style="background:none;border:1px solid rgba(177,58,48,0.3);color:var(--data-red);font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">전체 삭제</button>' : ''}
          <button data-action="_aioChatHistoryToggle" style="background:none;border:1px solid rgba(120,140,160,0.35);color:var(--text-muted);font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">${window.AIO && typeof window.AIO.getChatHistoryPolicy === 'function' && window.AIO.getChatHistoryPolicy().enabled === false ? '기록 켜기 (선택)' : '기록 끄기·삭제'}</button>
          <button class="ch-close" aria-label="대화 기록 닫기" data-action="_aioChatHistoryClose" data-pass-el="1">X</button>
        </div>
      </div>
      <div class="ch-list">
        ${history.length === 0 ? '<div class="ch-empty">저장된 대화 기록이 없습니다.<br>기록은 기본 OFF이며, 직접 켠 이후 대화만 민감정보를 가린 뒤 저장합니다.</div>' :
          history.map((h, i) => {
            const dt = new Date(h.ts);
            const timeStr = dt.toLocaleDateString('ko-KR', {month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
            const ctxBadge = h.ctx ? '<span style="font-size:11px;background:rgba(33,29,22,0.1);color:var(--data-cyan);padding:1px 5px;border-radius:3px;margin-right:6px;">' + escHtml(h.ctx) + '</span>' : '';
            return '<div class="ch-item" data-action="_aioToggleWhiteSpace" data-pass-el="1">' +
              '<div class="ch-item-q">' + ctxBadge + escHtml(h.q || '') + '</div>' +
              '<div class="ch-item-a">' + (h.a ? escHtml(h.a) : '(응답 없음)') + '</div>' +
              '<div class="ch-item-time">' + timeStr + '</div>' +
            '</div>';
          }).join('')
        }
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.ch-close').focus();
}

// ── System prompts per context ─────────────────────────────────────────
// ═══ 글로벌 라이브데이터 주입 헬퍼 ═════════════════════════════════
function _ld(sym, field) {
  const d = (window._liveData || {})[sym];
  if (!d) return null;
  return field === 'pct' ? d.pct : d.price;
}
function _fmt(v, dec) { return v != null ? Number(v).toFixed(dec || 0) : '—'; }
/**
 * v36.7: 세션 인식 실시간 스냅샷 (UI 표시용)
 * - 한국: 장중→실시간, 장마감→최신종가
 * - 미국: 본장→실시간, 프리/애프터→시간외시세, 여백→최신종가
 * - FX/채권/VIX: 선물시장 운영 중→실시간, 아니면→최신종가
 */
// ── 데이터 날만 경고 유틸 (v40.4) ──
function getDataAge() {
  var snapDate = DATA_SNAPSHOT._updated ? new Date(DATA_SNAPSHOT._updated) : null;
  if (!snapDate) return { days: 999, label: '알 수 없음', stale: true };
  var now = new Date();
  var days = Math.floor((now - snapDate) / (1000 * 60 * 60 * 24));
  var label = days === 0 ? '오늘' : days === 1 ? '어제' : days + '일 전';
  return { days: days, label: label, stale: days > 1 }; // v42.4: R21 — 2일 이상 경과 시 stale 배지 표시
}
function renderStaleWarning(containerId) {
  var age = getDataAge();
  if (!age.stale) return;
  var el = document.getElementById(containerId);
  if (!el) return;
  var existing = el.querySelector('.stale-badge');
  if (existing) return;
  var badge = document.createElement('div');
  badge.className = 'stale-badge';
  // grid-column:1/-1 — 컨테이너가 CSS grid일 때 이 배지가 셀 하나를 차지해 열 수를 밀어내지 않도록
  // 전체 너비 배너로 스팬(v52.65, risk-monitor-grid 6열 고정화로 발견). flex/block 컨테이너에선 무시되는 안전한 속성.
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(33,29,22,0.15);border:1px solid rgba(33,29,22,0.3);border-radius:4px;font-size:11px;color:var(--data-amber);font-weight:700;margin-bottom:6px;grid-column:1/-1;width:fit-content;';
  badge.textContent = '정적 데이터 · ' + age.label + ' 기준 · 실시간 아님';
  el.insertBefore(badge, el.firstChild);
}

function _liveSnap() {
  let ld = window._liveData || {};
  var stale = [];
  if (!_ld('^GSPC','price')) stale.push('S&P500');
  if (!_ld('^VIX','price')) stale.push('VIX');
  if (!_ld('CL=F','price')) stale.push('유가');
  var _fgLiveSnapMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null;
  if (!_fgLiveSnapMetric || _fgLiveSnapMetric.status !== 'VALID') stale.push('F&G');
  if (!window._tradingScore) stale.push('트레이딩스코어');
  if (!(window._spxMA && window._spxMA[50])) stale.push('이동평균');
  var liveCoreCount = 0;
  ['^GSPC','^VIX','CL=F','DX-Y.NYB','^TNX'].forEach(function(sym) {
    var row = ld[sym];
    if (row && row.price != null && !/snapshot|fallback|static/i.test(String(row.source || row.sourceKind || ''))) liveCoreCount++;
  });

  // 세션 상태
  var usSession = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
  var krSession = (typeof _getKrxSession === 'function') ? _getKrxSession() : 'open';
  var futOpen = (typeof _isFuturesOpen === 'function') ? _isFuturesOpen() : true;

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

/**
 * v36.7: 분석/해석/근거용 종가 스냅샷 (LLM 분석 전용)
 * 항상 "전일 종가" 기준 — 장중이어도 실시간 데이터가 아닌 가장 최근 확정 종가 사용
 * 이유: 분석의 일관성·재현성 확보 (장중 변동에 분석이 흔들리지 않음)
 */
function _closeSnap() {
  let ld = window._liveData || {};
  // ═══ v37.2: 이원화 원칙을 _closeSnap에도 완전 적용 ═══
  // 주가/지수 → chartPreviousClose(종가), 시장환경 → 실시간(_ld)
  function _close(sym) {
    var d = ld[sym];
    if (!d) return null;
    return d.chartPreviousClose || d.previousClose || d.price || null;
  }
  function _closeFmt(sym, dec) {
    var v = _close(sym);
    return v != null ? Number(v).toFixed(dec || 0) : '—';
  }
  // 시장환경 데이터는 실시간 (VIX, DXY, TNX, 유가 등은 24시간/선물 거래)
  function _liveFmt(sym, dec) {
    var v = _ld(sym, 'price');
    return v != null ? Number(v).toFixed(dec || 0) : '—';
  }
  return {
    // ── 주가·지수: 종가 (확정 데이터) ──
    stockBasis: '전일 종가 (확정)',
    spx: _closeFmt('^GSPC'), nasdaq: _closeFmt('^IXIC'),
    dow: _closeFmt('^DJI'), rut: _closeFmt('^RUT'),
    // ── 시장환경: 실시간 (24h/선물 거래) ──
    envBasis: '실시간',
    vix: _liveFmt('^VIX',1), vvix: _liveFmt('^VVIX',1),
    vvixVixRatio: (function() {
      var vix = _ld('^VIX','price'), vvix = _ld('^VVIX','price');
      if (vix && vvix && vix > 0) {
        var r = vvix / vix;
        var label = r < 5 ? '과잉 안도' : r < 6 ? '정상' : r < 7 ? '긴장 감지' : '고위험';
        return r.toFixed(2) + ' (' + label + ')';
      }
      return '—';
    })(),
    dxy: _liveFmt('DX-Y.NYB',1),
    tnx: _liveFmt('^TNX',2), tyx: _liveFmt('^TYX',2),
    wti: _liveFmt('CL=F',1), brent: _liveFmt('BZ=F',1),
    gold: _liveFmt('GC=F'), krw: _liveFmt('KRW=X'),
    fg: (function() { var _fgCloseMetric = window.AIO && typeof window.AIO.getCanonicalMetric === 'function' ? window.AIO.getCanonicalMetric('fg') : null; return _fgCloseMetric && _fgCloseMetric.value != null ? _fgCloseMetric.value : '데이터 없음'; })(),
    score: window._tradingScore || '산출 대기',
    spx50ma: (window._spxMA && window._spxMA[50]) || '—',
    spx200ma: (window._spxMA && window._spxMA[200]) || '—',
  };
}

/**
 * v36.9: 분석용 종가 데이터 접근 헬퍼
 * chartPreviousClose가 있으면 종가, 없으면 현재 price를 폴백
 *
 * ═══ v37.2: 분석 데이터 소스 이원화 원칙 (분석함수 + LLM 답변 완전 적용) ═══
 * ┌─────────────────┬───────────┬──────────────────────────────────────────┐
 * │ 데이터 유형      │ 소스      │ 사용 함수/위치                            │
 * ├─────────────────┼───────────┼──────────────────────────────────────────┤
 * │ 주가 (SPX,SPY,  │ _closingVal│ computeTradingScore(SPX,RSP,SPY)        │
 * │ QQQ,RSP,개별종목)│ (종가)     │ computeMarketHealth(SPY,QQQ)            │
 * │                 │           │ classifyMarketRegime(SPX)               │
 * │                 │           │ CHAT: home(분석기준), technical, macro   │
 * │                 │           │ CHAT: kr-themes, kr-macro, kr-tech,     │
 * │                 │           │       kr-supply (종가 기준)              │
 * ├─────────────────┼───────────┼──────────────────────────────────────────┤
 * │ 시장 환경       │ _ldSafe   │ computeTradingScore(VIX,VVIX,DXY,TNX,   │
 * │ (VIX,DXY,TNX,   │ _ld       │   HYG,유가)                             │
 * │ HYG,CL=F,환율)  │ (source)   │ computeMarketHealth(VIX)                │
 * │                 │           │ classifyMarketRegime(VIX)               │
 * │                 │           │ CHAT: _closeSnap().envBasis=실시간       │
 * │                 │           │ CHAT: 모든 컨텍스트에서 VIX/DXY/TNX/환율 │
 * │                 │           │       = _liveSnap() 또는 _liveFmt() 사용 │
 * └─────────────────┴───────────┴──────────────────────────────────────────┘
 * 이유: 주가는 장 마감까지 봐야 정확한 분석 → 종가 고정
 *       시장 환경은 실시간성이 중요 → 선물/24시간 거래 데이터 즉각 반영
 *
 * @param {string} sym - Yahoo Finance 심볼
 * @param {string} [field='price'] - 'price' | 'pct'
 * @returns {number|null}
 */
function _closingVal(sym, field) {
  let ld = window._liveData || {};
  var d = ld[sym];
  if (!d) {
    // _SNAP_FALLBACK에서 폴백
    var sf = (typeof _SNAP_FALLBACK !== 'undefined') ? _SNAP_FALLBACK[sym] : null;
    if (sf && sf[field || 'price']) return sf[field || 'price']();
    return null;
  }
  if (field === 'pct') {
    // 종가 기준 변동률: chartPreviousClose 대비 현재 price
    // 하지만 분석에서는 "전일 종가" 자체가 기준이므로 pct=0 (당일 종가 ↔ 전일 종가 변동률은 의미 없음)
    // 실제로는 "직전 거래일의 일간 변동률"이 필요하지만 이건 별도 계산 필요
    // → 기존 pct를 그대로 사용하되, _closingVal 취지는 "가격" 안정성 확보
    return d.pct != null ? d.pct : null;
  }
  // 가격: chartPreviousClose → previousClose → price 순
  return d.chartPreviousClose || d.previousClose || d.price || null;
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

// ═══ 시장 주도 섹터·테마·주도주 랭킹 (시장 중심 컨텍스트에 주입) ════════
// 마지막 본장 마감 기준 window._liveData(전일 대비 pct)로 정량 랭킹 블록 생성.
// 섹터 ETF 11개 + SUB_THEMES 45개 가중평균 + 대형주($50B+) Top/Bottom 10.
// 포토닉스·메모리·양자·우주 등 ETF 없는 순수 테마까지 leaders/tickers/weights 기반으로 커버.
function _buildMarketLeadersSnapshot() {
  try {
    let ld = window._liveData || {};
    var out = '\n\n【오늘의 주도 섹터·테마·주도주 랭킹 (마지막 본장 마감 기준)】\n';

    // 1) 섹터 ETF 11개 1일 변화율 랭킹
    var sectors = [
      {sym:'XLK',name:'기술'},{sym:'XLV',name:'헬스케어'},{sym:'XLF',name:'금융'},
      {sym:'XLY',name:'임의소비재'},{sym:'XLP',name:'필수소비재'},{sym:'XLI',name:'산업재'},
      {sym:'XLE',name:'에너지'},{sym:'XLU',name:'유틸리티'},{sym:'XLB',name:'소재'},
      {sym:'XLRE',name:'리츠'},{sym:'XLC',name:'통신'}
    ];
    var secData = sectors.map(function(s){
      var d = ld[s.sym];
      return (d && d.pct != null) ? {name:s.name, sym:s.sym, pct:d.pct} : null;
    }).filter(Boolean).sort(function(a,b){return b.pct - a.pct;});

    if (secData.length) {
      out += '\n▶ 섹터 ETF 11개 1일 변화율 랭킹\n';
      secData.forEach(function(s, i) {
        var last = secData.length - 1;
        var tag = i === 0 ? '주도1위' : i === 1 ? '주도2위' : i === 2 ? '주도3위'
                : i === last ? '부진1위' : i === last-1 ? '부진2위' : '';
        out += '  ' + (i+1) + '. ' + s.name + '(' + s.sym + '): ' + (s.pct>=0?'+':'') + s.pct.toFixed(2) + '%' + tag + '\n';
      });
    } else {
      out += '\n▶ 섹터 ETF 데이터 요청 중 — 실시간 연결 후 재질문\n';
    }

    // 2) 45개 세분화 테마 가중평균 랭킹 (ETF 없는 순수 테마까지 커버)
    if (typeof SUB_THEMES !== 'undefined' && Array.isArray(SUB_THEMES)) {
      var themes = SUB_THEMES.map(function(th) {
        var w = th.weights || {};
        var tot = 0, sum = 0, cnt = 0;
        (th.tickers || []).forEach(function(t) {
          var d = ld[t];
          if (d && d.pct != null) {
            var wt = w[t] || 1;
            sum += d.pct * wt;
            tot += wt;
            cnt++;
          }
        });
        if (tot === 0 || cnt < 2) return null;
        return {
          id: th.id,
          name: th.name,
          pct: sum / tot,
          leaders: (th.leaders || []).slice(0, 4),
          tickers: th.tickers || [],
          coverage: cnt + '/' + (th.tickers || []).length
        };
      }).filter(Boolean).sort(function(a,b){return b.pct - a.pct;});

      if (themes.length) {
        out += '\n▶ 47개 세분화 테마 가중평균 1일 랭킹 (Top 15 + Bottom 5)\n';
        out += '  (메모리·포토닉스·양자·우주·원전·바이오·방산·네오클라우드·정유·스포츠베팅 등 ETF 없는 테마 포함)\n';
        var topN = Math.min(15, themes.length);
        for (var i = 0; i < topN; i++) {
          var th = themes[i];
          var ldr = th.leaders.map(function(t) {
            var d = ld[t];
            return d && d.pct != null ? t + '(' + (d.pct>=0?'+':'') + d.pct.toFixed(1) + '%)' : t;
          }).join(', ');
          var tag = i < 3 ? '핫테마' : '';
          out += '  ' + (i+1) + '. ' + th.name + ': ' + (th.pct>=0?'+':'') + th.pct.toFixed(2) + '% [대장주: ' + ldr + ']' + tag + '\n';
        }
        if (themes.length > topN) {
          out += '\n▶ 부진 테마 Bottom 5\n';
          var bStart = Math.max(topN, themes.length - 5);
          for (var j = bStart; j < themes.length; j++) {
            out += '  ' + (j+1) + '. ' + themes[j].name + ': ' + themes[j].pct.toFixed(2) + '%\n';
          }
        }

        // Top 3 핫테마의 심층 인사이트 자동 주입 (SUB_THEME_INSIGHTS + THEME_NARRATIVES)
        if (typeof SUB_THEME_INSIGHTS !== 'undefined') {
          var hotTop3 = themes.slice(0, 3);
          var insightsOut = '';
          // stale 체크 — narrative 작성일로부터 며칠 경과했는지
          var _staleDays = 0;
          if (typeof THEME_NARRATIVES_META !== 'undefined' && THEME_NARRATIVES_META.lastUpdated) {
            try {
              _staleDays = Math.round((Date.now() - new Date(THEME_NARRATIVES_META.lastUpdated).getTime()) / 86400000);
            } catch(e) {}
          }
          var _isStale = _staleDays > (THEME_NARRATIVES_META && THEME_NARRATIVES_META.staleDays || 90);
          hotTop3.forEach(function(t, i) {
            var sti = SUB_THEME_INSIGHTS[t.id];
            var sn = (typeof THEME_NARRATIVES !== 'undefined') ? THEME_NARRATIVES[t.id] : null;
            if (sti || sn) {
              insightsOut += '\n' + (i+1) + '. ' + t.name + ' (' + (t.pct>=0?'+':'') + t.pct.toFixed(2) + '% 오늘 가중평균)\n';
              if (sti) {
                insightsOut += '  • 핵심 매크로 [' + sti.macroKey + ']: ' + sti.upCondition + '\n';
                insightsOut += '  • 깨지는 신호: ' + sti.breakSignal + '\n';
                insightsOut += '  • 비직관적 인사이트: ' + sti.insight + '\n';
              }
              if (sn) {
                if (sn.why) insightsOut += '  • 왜 HOT(구조적): ' + sn.why + '\n';
                if (sn.valueChain) insightsOut += '  • 밸류체인: ' + sn.valueChain + '\n';
                if (sn.playerRoles && typeof sn.playerRoles === 'object') {
                  var topRoles = Object.keys(sn.playerRoles).slice(0, 5).map(function(tk){
                    return tk + '=' + sn.playerRoles[tk].split(' — ')[0].split(',')[0];
                  }).join(' / ');
                  if (topRoles) insightsOut += '  • 플레이어 포지션: ' + topRoles + '\n';
                }
              }
            }
          });
          if (insightsOut) {
            out += '\n▶ Top 3 핫테마 심층 인사이트 + 구조적 내러티브';
            out += ' (narrative 작성일: ' + (THEME_NARRATIVES_META && THEME_NARRATIVES_META.lastUpdated || 'unknown') + ', 경과 ' + _staleDays + '일' + (_isStale ? ' — STALE: 구체 수치는 반드시 웹 검색/실시간 데이터로 crosscheck' : '') + ')';
            out += '\n실시간 우선 원칙: narrative 내 구체 수치(매출·수주·시총·가이던스)는 작성 시점 기준. 답변 시 ① 위 "오늘 가중평균 pct" 실시간 값 우선 인용 ② 하드코딩된 수치는 "당시 기준 ~"으로 시점 명시 ③ 최신 뉴스·실적 발표는 웹검색 결과 우선 반영.';
            out += insightsOut;

            // v48.14: Top 3 테마 각각의 최근 7일 뉴스 자동 매칭 (narrative stale 보완)
            if (typeof _getThemeNews === 'function') {
              var newsOut = '';
              hotTop3.forEach(function(t, i) {
                var news = _getThemeNews(t.tickers || [], t.name, 3);
                if (news.length > 0) {
                  newsOut += '\n' + (i+1) + '. ' + t.name + ' — 최근 7일 주요 뉴스:\n';
                  news.forEach(function(n) {
                    var dt = n.pubDate ? new Date(n.pubDate) : null;
                    var dtStr = dt ? (dt.getMonth()+1) + '/' + dt.getDate() : '';
                    newsOut += '  • [' + dtStr + '] ' + (n.title || '').substring(0, 120) + (n.source ? ' (' + n.source + ')' : '') + '\n';
                  });
                }
              });
              if (newsOut) {
                out += '\n\n▶ Top 3 핫테마 최근 7일 뉴스 (수집 결과 — narrative의 정적 수치와 기준시각을 함께 확인)';
                out += newsOut;
              }
            }
          }
        }
      }
    }

    // 3) 대형주(시총 $50B+) 1일 Top/Bottom 10
    var screenerRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
    if (Array.isArray(screenerRows)) {
      var movers = [];
      for (var k = 0; k < screenerRows.length; k++) {
        var st = screenerRows[k];
        if (!st || !st.mcap || st.mcap < 50) continue;
        var d = ld[st.sym];
        if (d && d.pct != null) {
          movers.push({sym:st.sym, name:st.name, sector:st.sector||'-', pct:d.pct});
        }
      }
      if (movers.length) {
        var topG = movers.slice().sort(function(a,b){return b.pct - a.pct;}).slice(0, 10);
        var topL = movers.slice().sort(function(a,b){return a.pct - b.pct;}).slice(0, 10);

        out += '\n▶ 대형주(시총 $50B+) 1일 상승 Top10 — 오늘의 주도주\n';
        topG.forEach(function(m, i) {
          out += '  ' + (i+1) + '. ' + m.sym + '(' + m.name + ', ' + m.sector + '): +' + m.pct.toFixed(2) + '%\n';
        });

        if (topL.length && topL[0].pct < 0) {
          out += '\n▶ 대형주(시총 $50B+) 1일 하락 Top10 — 자금이탈 종목\n';
          topL.forEach(function(m, i) {
            out += '  ' + (i+1) + '. ' + m.sym + '(' + m.name + ', ' + m.sector + '): ' + m.pct.toFixed(2) + '%\n';
          });
        }
      }
    }

    out += '\n위 랭킹은 마지막 본장 마감 시점 데이터. 답변 시 "오늘 주도 테마/섹터/주도주가 무엇인가"를 반드시 위 랭킹 1~3위로 특정하라. 막연히 "AI 테마 강세"라고 하지 말고 "광통신/포토닉스 가중평균 +2.3%로 테마 1위, 대장주 LITE +3.1%·COHR +2.8%·CIEN +2.1%가 견인" 식으로 정량 기반 답변. 주입 데이터가 부족한 테마는 언급 자체 금지.\n';

    return out;
  } catch(e) {
    _aioLog('warn', 'render', '_buildMarketLeadersSnapshot 실패: ' + e.message);
    return '';
  }
}

// ═══ 한국 주도 테마·주도주 랭킹 (kr-themes/kr-macro/kr-technical에 주입) ═══
// 마지막 본장 마감 기준 window._liveData를 사용해 KR_SUB_THEMES 22개 가중평균 랭킹 생성.
function _buildKoreaLeadersSnapshot() {
  try {
    let ld = window._liveData || {};
    var out = '\n\n【한국 시장 주도 테마·주도주 랭킹 (마지막 본장 마감 기준)】\n';

    if (typeof KR_SUB_THEMES !== 'undefined' && Array.isArray(KR_SUB_THEMES)) {
      var themes = KR_SUB_THEMES.map(function(th) {
        var w = th.weights || {};
        var tot = 0, sum = 0, cnt = 0;
        (th.tickers || []).forEach(function(t) {
          var d = ld[t];
          if (d && d.pct != null) {
            var wt = w[t] || 1;
            sum += d.pct * wt;
            tot += wt;
            cnt++;
          }
        });
        if (tot === 0 || cnt < 2) return null;
        return {
          id: th.id,
          name: th.name,
          pct: sum / tot,
          leaders: (th.leaders || []).slice(0, 4),
          tickers: th.tickers || [],
          coverage: cnt + '/' + (th.tickers || []).length
        };
      }).filter(Boolean).sort(function(a,b){return b.pct - a.pct;});

      if (themes.length) {
        out += '\n▶ 22개 한국 세분화 테마 가중평균 1일 랭킹 (Top 10 + Bottom 3)\n';
        out += '  (반도체HBM·전력기기·K-뷰티·K-푸드·로봇·원전·조선·방산·2차전지·K-엔터·게임·리츠·여행·드론 등)\n';
        var topN = Math.min(10, themes.length);
        for (var i = 0; i < topN; i++) {
          var th = themes[i];
          var ldr = th.leaders.map(function(t) {
            var d = ld[t];
            return d && d.pct != null ? t + '(' + (d.pct>=0?'+':'') + d.pct.toFixed(1) + '%)' : t;
          }).join(', ');
          var tag = i < 3 ? '핫테마' : '';
          out += '  ' + (i+1) + '. ' + th.name + ': ' + (th.pct>=0?'+':'') + th.pct.toFixed(2) + '% [대장주: ' + ldr + ']' + tag + '\n';
        }
        if (themes.length > topN) {
          out += '\n▶ 부진 테마 Bottom 3\n';
          var bStart = Math.max(topN, themes.length - 3);
          for (var j = bStart; j < themes.length; j++) {
            out += '  ' + (j+1) + '. ' + themes[j].name + ': ' + themes[j].pct.toFixed(2) + '%\n';
          }
        }

        // Top 3 핫테마의 심층 인사이트 + 구조적 내러티브 자동 주입
        if (typeof KR_THEME_INSIGHTS !== 'undefined' && typeof KR_INSIGHT_MAP !== 'undefined') {
          var hotTop3 = themes.slice(0, 3);
          var insightsOut = '';
          // stale 체크
          var _krStaleDays = 0;
          if (typeof KR_THEME_NARRATIVES_META !== 'undefined' && KR_THEME_NARRATIVES_META.lastUpdated) {
            try {
              _krStaleDays = Math.round((Date.now() - new Date(KR_THEME_NARRATIVES_META.lastUpdated).getTime()) / 86400000);
            } catch(e) {}
          }
          var _krIsStale = _krStaleDays > (KR_THEME_NARRATIVES_META && KR_THEME_NARRATIVES_META.staleDays || 90);
          hotTop3.forEach(function(t, i) {
            var insightKey = KR_INSIGHT_MAP[t.id];
            var kti = insightKey ? KR_THEME_INSIGHTS[insightKey] : null;
            var kn = (typeof KR_THEME_NARRATIVES !== 'undefined') ? KR_THEME_NARRATIVES[t.id] : null;
            if (kti || kn) {
              insightsOut += '\n' + (i+1) + '. ' + t.name + ' (' + (t.pct>=0?'+':'') + t.pct.toFixed(2) + '% 오늘 가중평균)\n';
              if (kti) {
                if (kti.macro) insightsOut += '  • 매크로 조건: ' + kti.macro + '\n';
                if (kti.breakSignals && kti.breakSignals.length) {
                  insightsOut += '  • 깨지는 신호: ' + kti.breakSignals.join(' / ') + '\n';
                }
                if (kti.foreignFlow) insightsOut += '  • 외국인 수급 패턴: ' + kti.foreignFlow + '\n';
                if (kti.linkedUS) insightsOut += '  • 미국 연동 테마: ' + kti.linkedUS + '\n';
              }
              if (kn) {
                if (kn.why) insightsOut += '  • 왜 HOT(구조적): ' + kn.why + '\n';
                if (kn.valueChain) insightsOut += '  • 밸류체인: ' + kn.valueChain + '\n';
                if (kn.playerRoles && typeof kn.playerRoles === 'object') {
                  var topRoles = Object.keys(kn.playerRoles).slice(0, 5).map(function(tk){
                    return tk + '=' + kn.playerRoles[tk].split(' — ')[0].split(',')[0];
                  }).join(' / ');
                  if (topRoles) insightsOut += '  • 플레이어 포지션: ' + topRoles + '\n';
                }
              }
            }
          });
          if (insightsOut) {
            out += '\n▶ Top 3 한국 핫테마 심층 인사이트 + 구조적 내러티브';
            out += ' (narrative 작성일: ' + (KR_THEME_NARRATIVES_META && KR_THEME_NARRATIVES_META.lastUpdated || 'unknown') + ', 경과 ' + _krStaleDays + '일' + (_krIsStale ? ' — STALE: 실적·수주 수치는 웹검색으로 crosscheck 필수' : '') + ')';
            out += '\n실시간 우선 원칙: narrative 내 구체 수치(수주잔고·OP마진·매출 가이던스)는 작성 시점 기준. ① 위 "오늘 가중평균 pct" 실시간 값을 1차 근거로 ② 하드코딩 수치는 "당시 기준 ~"으로 명시 ③ 최신 공시·실적은 웹검색 + 뉴스 컨텍스트 우선 반영.';
            out += insightsOut;

            // v48.14: 한국 Top 3 테마 각각의 최근 7일 뉴스 자동 매칭
            if (typeof _getThemeNews === 'function') {
              var krNewsOut = '';
              hotTop3.forEach(function(t, i) {
                var news = _getThemeNews(t.tickers || [], t.name, 3);
                if (news.length > 0) {
                  krNewsOut += '\n' + (i+1) + '. ' + t.name + ' — 최근 7일 주요 뉴스:\n';
                  news.forEach(function(n) {
                    var dt = n.pubDate ? new Date(n.pubDate) : null;
                    var dtStr = dt ? (dt.getMonth()+1) + '/' + dt.getDate() : '';
                    krNewsOut += '  • [' + dtStr + '] ' + (n.title || '').substring(0, 120) + (n.source ? ' (' + n.source + ')' : '') + '\n';
                  });
                }
              });
              if (krNewsOut) {
                out += '\n\n▶ Top 3 한국 핫테마 최근 7일 뉴스 (수집 결과 — narrative와 기준시각을 함께 확인)';
                out += krNewsOut;
              }
            }
          }
        }
      } else {
        out += '\n▶ 한국 테마 데이터 요청 중 — 실시간 연결 후 재질문\n';
      }
    }

    out += '\n위 랭킹은 한국 마지막 본장 마감 시점 데이터. 답변 시 "한국 주도 테마"를 반드시 위 랭킹 1~3위로 정량 특정하라. 예: "전력기기 가중평균 +3.1%로 테마 1위, 효성중공업·HD현대일렉트릭·LS일렉트릭 동시 견인". 주입 데이터 부족 테마는 언급 금지.\n';

    return out;
  } catch(e) {
    _aioLog('warn', 'render', '_buildKoreaLeadersSnapshot 실패: ' + e.message);
    return '';
  }
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

