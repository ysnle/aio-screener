// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 4: CHAT START (실제 분할 적용 v48.26)              ║
// ║  책임: CHAT_CONTEXTS (10 personas) + Briefing + Chip + Helpers            ║
// ║  의존성: MODULE 1 + MODULE 2 + MODULE 3 (전체 맥락 접근, 가장 상위 레이어)  ║
// ║  분할 효과: 외부 .js 파일 분리 1차 후보 (Phase 3에서 활용)                  ║
// ║  안전: 의존만 받고 의존 없음, 톱-레벨 즉시 호출 없음                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// v52.75/WP-AI0: public AI contract. This is intentionally shared by the
// embedded and unified chat surfaces so a retry or alternate entry point
// cannot silently bypass the public beta disclosure/action gate.
var _AIO_PUBLIC_AI_POLICY = {
  label: 'AI 베타 · 교육/리서치 보조',
  status: 'beta-research',
  actionGate: 'concrete-trade-instructions-blocked'
};

// v52.76/WP-AI1: all public AI entry points share one request/response
// envelope. The envelope records provenance for the pipeline; the actual
// action validator remains _aioApplyAIActionGate so there is no parallel gate.
var _AIO_AI_PIPELINE_VERSION = 'wp-ai1.v1';
var _AIO_AI_VALIDATOR_VERSION = 'wp-ai0.action-gate.v1';
var _AIO_AI_BLOCK_POLICY_VERSION = 'concrete-trade-instructions-blocked.v1';

function _aioCreateAIRequestObject(entrypoint, meta) {
  meta = meta || {};
  var stamp = Date.now();
  var entropy = Math.random().toString(36).slice(2, 8);
  var requestId = 'aio-ai-' + stamp + '-' + entropy;
  var conversation = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.createAIConversationState === 'function')
    ? window.AIO.createAIConversationState({ sessionId: meta.sessionId, route: meta.route || meta.ctxId, ctxId: meta.ctxId, entityKey: meta.entityKey }) : null;
  if (conversation && window.AIO && typeof window.AIO.beginAIConversationTurn === 'function') conversation = window.AIO.beginAIConversationTurn(conversation, { requestId: requestId, route: meta.route || meta.ctxId, entityKey: meta.entityKey });
  var idempotencyKey = meta.idempotencyKey || requestId;
  var isolationKey = (window.AIO && typeof window.AIO.buildAIIsolationCacheKey === 'function')
    ? window.AIO.buildAIIsolationCacheKey({ tenantId: meta.tenantId || meta.tenantKey, sessionId: conversation && conversation.sessionId, route: conversation && conversation.route || meta.route || meta.ctxId, entityKey: conversation && conversation.entityKey || meta.entityKey, evidence: meta.evidence || [], model: meta.model, promptVersion: meta.promptVersion }) : null;
  var request = {
    requestId: requestId,
    entrypoint: String(entrypoint || 'unknown'),
    ctxId: meta.ctxId || null,
    query: meta.query ? String(meta.query).slice(0, 160) : '',
    pipelineVersion: _AIO_AI_PIPELINE_VERSION,
    validatorVersion: _AIO_AI_VALIDATOR_VERSION,
    blockPolicyVersion: _AIO_AI_BLOCK_POLICY_VERSION,
    conversationId: conversation && conversation.sessionId || null,
    turnId: conversation && conversation.turnId || 0,
    route: conversation && conversation.route || meta.route || meta.ctxId || null,
    entityKey: conversation && conversation.entityKey || meta.entityKey || null,
    conversationState: conversation,
    createdAt: new Date(stamp).toISOString(),
    attempt: 0,
    lastModel: meta.model || null,
    lastAttemptAt: null,
    idempotencyKey: idempotencyKey,
    isolationKey: isolationKey,
    promptVersion: meta.promptVersion || null,
    sampling: meta.sampling || null
  };
  if (window.AIO && typeof window.AIO.beginAIIdempotentRequest === 'function') window.AIO.beginAIIdempotentRequest(idempotencyKey, { requestId: requestId });
  return request;
}

function _aioBeginAIRequestAttempt(request, model) {
  if (!request || typeof request !== 'object') return request;
  request.attempt = (Number(request.attempt) || 0) + 1;
  request.lastModel = model || request.lastModel || null;
  request.lastAttemptAt = new Date().toISOString();
  return request;
}

function _aioRecordAIResponseManifest(result) {
  if (typeof window === 'undefined' || !result || !result.request) return;
  var audit = window._aioAiPipelineAudit = window._aioAiPipelineAudit || [];
  var replayManifest = (window.AIO && typeof window.AIO.recordAIReplayManifest === 'function')
    ? window.AIO.recordAIReplayManifest({
      request: result.request,
      outputText: result.text,
      evidence: result.evidence || [],
      status: result.blocked ? 'blocked' : 'complete',
      modelId: result.request.lastModel,
      promptVersion: result.request.promptVersion,
      validatorVersion: result.validatorVersion,
      retrieverVersion: result.retrievalAudit && result.retrievalAudit.retrieverVersion
    }) : null;
  audit.push({
    requestId: result.request.requestId,
    entrypoint: result.request.entrypoint,
    ctxId: result.request.ctxId,
    attempt: result.request.attempt,
    pipelineVersion: result.pipelineVersion,
    validatorVersion: result.validatorVersion,
    blockPolicyVersion: result.blockPolicyVersion,
    model: result.request.lastModel || null,
    promptVersion: result.request.promptVersion || null,
    isolationKey: result.request.isolationKey || null,
    idempotencyKey: result.request.idempotencyKey || null,
    replayManifest: replayManifest,
    blocked: result.blocked === true,
    evidenceStatus: result.evidenceStatus || 'unknown',
    asOf: result.asOf || null,
    recordedAt: new Date().toISOString()
  });
  if (window.AIO && typeof window.AIO.finalizeAIIdempotentRequest === 'function' && result.request.idempotencyKey) {
    window.AIO.finalizeAIIdempotentRequest(result.request.idempotencyKey, { requestId: result.request.requestId, responseText: result.text });
  }
  if (audit.length > 100) audit.splice(0, audit.length - 100);
}

function _aioRunAIResponsePipeline(rawText, meta) {
  meta = meta || {};
  var request = meta.request || _aioCreateAIRequestObject(meta.entrypoint, meta);
  if (typeof window !== 'undefined' && request && request.requestId) window._aioActiveAIRequestId = request.requestId;
  var visible = String(rawText == null ? '' : rawText);
  if (meta.stripChips !== false && typeof stripChips === 'function') visible = stripChips(visible);
  var gate = (typeof _aioApplyAIActionGate === 'function')
    ? _aioApplyAIActionGate(visible, meta)
    : { blocked: true, text: 'AI 베타 안전 모드\n\n공통 안전 검증을 사용할 수 없어 답변을 표시하지 않습니다.', reasons: ['validator-unavailable'] };
  var claimAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.validateAIResponseClaims === 'function')
    ? window.AIO.validateAIResponseClaims(visible, {
      evidence: meta.evidence || [],
      currentSensitive: meta.currentSensitive === true
    })
     : { status: 'unavailable', blocked: false, claims: [], validCount: 0, issues: [] };
  var conductAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.evaluateAIActionPermission === 'function')
    ? window.AIO.evaluateAIActionPermission({
      query: meta.query || (request && request.query) || '',
      text: visible,
      ctxId: meta.ctxId || (request && request.ctxId) || '',
      evidence: meta.evidence || [],
      suitabilityProfile: meta.suitabilityProfile || null,
      calibrated: meta.calibrated === true
    })
    : { status: 'unavailable', blocked: false, reasons: [] };
  var publishAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.validateAIAutomatedPublish === 'function' && /^(?:auto-|market-analysis)/.test(String(meta.entrypoint || request.entrypoint || '')))
    ? window.AIO.validateAIAutomatedPublish({
      entrypoint: meta.entrypoint || request.entrypoint,
      text: visible,
      evidence: meta.evidence || [],
      currentSensitive: meta.currentSensitive === true,
      requiresStructuredClaims: meta.requiresStructuredClaims === true
    }) : null;
  var conversationAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.isCurrentAIResponse === 'function' && request.conversationState)
    ? { version: 'wp-ai11.conversation.v1', current: window.AIO.isCurrentAIResponse(request.conversationState, { requestId: request.requestId, turnId: request.turnId }), requestId: request.requestId, turnId: request.turnId, route: request.route, entityKey: request.entityKey } : null;
  var streamAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.finalizeAIStream === 'function' && meta.streamPhase)
    ? window.AIO.finalizeAIStream({ streamId: request.requestId, status: meta.streamPhase, done: meta.streamPhase === 'complete', outputText: visible }) : null;
  var toolAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.evaluateAIToolPermission === 'function')
    ? window.AIO.evaluateAIToolPermission({ capability: meta.toolCapability, operation: meta.toolOperation, mutation: meta.toolMutation === true, consent: meta.toolConsent === true }) : null;
  var rightsAudit = (meta.rights && typeof window !== 'undefined' && window.AIO && typeof window.AIO.evaluateAIDataRights === 'function')
    ? window.AIO.evaluateAIDataRights(meta.rights) : null;
  if (conductAudit.blocked === true) {
    gate = {
      blocked: true,
      text: conductAudit.safeText || 'AI 안전 모드\n\n현재 답변은 안전 정책을 통과하지 못해 표시하지 않습니다.',
      reasons: (gate.reasons || []).concat(conductAudit.reasons || ['conduct-policy'])
    };
  }
  if (toolAudit && toolAudit.blocked === true) {
    gate = { blocked: true, text: 'AI 안전 모드\n\n이 AI는 읽기 전용 보조 도구이며 주문·계정·외부 전송 등 상태 변경을 수행하지 않습니다.', reasons: (gate.reasons || []).concat(toolAudit.reasons || ['non-agentic-boundary']) };
  }
  if (publishAudit && publishAudit.blocked === true) {
    gate = {
      blocked: true,
      text: (typeof window !== 'undefined' && window.AIO && typeof window.AIO.buildDeterministicEvidenceSummary === 'function')
        ? window.AIO.buildDeterministicEvidenceSummary(meta.evidence || [], { label: 'Automated publish fallback' })
        : '자동 생성 결과를 검증할 수 없어 결정론적 근거 요약으로 대체합니다.',
      reasons: (gate.reasons || []).concat(publishAudit.issues || ['automated-publish-gate'])
    };
  }
  if (claimAudit.blocked === true) {
    gate = {
      blocked: true,
      text: 'AI 베타 안전 모드\n\nTyped claim/Evidence 검증을 통과하지 못한 현재성 수치는 표시하지 않습니다.\n\n주입된 데이터와 원문을 직접 재확인하세요.',
      reasons: (gate.reasons || []).concat(['typed-claim-validation'])
    };
  }
  // P714: typed-claim 게이트의 옵트인 공백 완화 — 모델이 claim envelope를 아예 제출하지
  // 않으면(status 'not-structured') 검증 자체가 스킵된다. 차단하면 대화형 응답 대부분이
  // 막히므로, 현재성 표현+숫자를 담은 비구조 응답에는 "자동 검증 미통과" 고지를 비차단으로
  // 덧붙여 사용자가 검증된 수치와 구별할 수 있게 한다.
  if (gate.blocked !== true && claimAudit && claimAudit.status === 'not-structured' &&
      /(현재|지금|오늘|현시점|방금|as of)/i.test(visible) && /\d/.test(visible)) {
    gate = Object.assign({}, gate, {
      text: gate.text + '\n\n※ 이 답변의 수치는 typed-claim 자동 검증을 거치지 않았습니다(모델이 claim envelope 미제출). 기준시각과 원문을 직접 확인하세요.',
      unverifiedNumericNotice: true
    });
  }
  var result = {
    request: request,
    pipelineVersion: request.pipelineVersion || _AIO_AI_PIPELINE_VERSION,
    validatorVersion: request.validatorVersion || _AIO_AI_VALIDATOR_VERSION,
    blockPolicyVersion: request.blockPolicyVersion || _AIO_AI_BLOCK_POLICY_VERSION,
    entrypoint: request.entrypoint,
    text: gate.text,
    blocked: gate.blocked === true,
    reasons: gate.reasons || [],
    actionGate: gate,
    claimAudit: claimAudit,
    conductAudit: conductAudit,
    publishAudit: publishAudit,
    conversationAudit: conversationAudit,
    streamAudit: streamAudit,
    toolAudit: toolAudit,
    rightsAudit: rightsAudit,
    evidence: meta.evidence || [],
    evidenceStatus: meta.evidenceStatus || null,
    asOf: meta.asOf || null,
    retrievalAudit: meta.retrievalAudit || null,
    contextBudgetAudit: meta.contextBudgetAudit || null
  };
  if (meta.record !== false) _aioRecordAIResponseManifest(result);
  return result;
}

function _aioPublicAIActionPolicyPrompt() {
  return '\n\n【공개 AI 베타 안전 정책 — 최우선】\n' +
    '이 AI는 "AI 베타 · 교육/리서치 보조"이며 독립 투자자문·검증 시스템·실시간 주문 도구가 아니다.\n' +
    '현재 답변에서는 구체적인 매수·매도·진입·청산 지시, 가격 목표/손절가, 포트폴리오 비중·수량·포지션을 권고하거나 지시하지 마라.\n' +
    '대신 조건, 데이터의 한계, 위험요인, 확인해야 할 원문과 재검증 절차를 설명하라. 현재성 주장은 주입된 근거 블록만 사용하고 기준시각과 Evidence 상태를 명시하라.\n' +
    '수치·출처·기준시각이 없거나 Evidence가 확인되지 않으면 "확인 필요"로 답하고, 학습 기억이나 정적 문구를 현재 사실처럼 보완하지 마라.\n';
}

// v52.77/WP-AI2: append the typed-claim contract to the shared prompt so every
// public entry point receives the same schema instruction without a second path.
var _aioBasePublicAIActionPolicyPrompt = _aioPublicAIActionPolicyPrompt;
_aioPublicAIActionPolicyPrompt = function() {
  var base = _aioBasePublicAIActionPolicyPrompt();
  var claimPrompt = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.getAIClaimSchemaPrompt === 'function')
    ? window.AIO.getAIClaimSchemaPrompt() : '';
  return base + claimPrompt;
};

function _aioPublicAIFormatAsOf(value) {
  if (!value) return '미확인';
  try {
    var d = new Date(value);
    if (!isFinite(d.getTime())) return String(value).slice(0, 40);
    var parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d).reduce(function(out, p) { out[p.type] = p.value; return out; }, {});
    return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute + ' KST';
  } catch(_) { return String(value).slice(0, 40); }
}

function _aioBuildAIResponseDisclosure(meta) {
  meta = meta || {};
  var freshness = meta.freshness || {};
  var after = freshness.after || {};
  var rows = Array.isArray(after.quoteRows) ? after.quoteRows : [];
  var asOfValues = [];
  var sources = [];
  rows.forEach(function(row) {
    if (!row) return;
    var ts = row.asOf || row.quoteAsOf || row.sourceTs || row.fetchedAt || row.generatedAt;
    if (ts) asOfValues.push(ts);
    if (row.source) sources.push(String(row.source));
  });
  if (!asOfValues.length && window._serverDataMeta && window._serverDataMeta.generatedAt) asOfValues.push(window._serverDataMeta.generatedAt);
  var latestAsOf = asOfValues.map(function(v) { return new Date(v).getTime(); }).filter(isFinite).sort(function(a,b){ return b-a; })[0];
  var asOf = latestAsOf ? _aioPublicAIFormatAsOf(latestAsOf) : (asOfValues[0] ? _aioPublicAIFormatAsOf(asOfValues[0]) : '미확인');
  var blocked = freshness.status === 'fail' || freshness.status === 'blocked' || freshness.strictFailed === true || rows.some(function(row) {
    var truth = String(row && row.truthStatus || '').toLowerCase();
    return !row || row.hasLivePrice === false || /blocked|missing|unknown|mismatch|stale|invalid/.test(truth) || (row.truthIssues && row.truthIssues.length > 0);
  });
  var evidenceStatus = rows.length ? (blocked ? '확인 필요' : '주입 근거 확인됨') : '확인 필요';
  var sourceLabel = sources.length ? Array.from(new Set(sources)).slice(0, 2).join(' / ') : '원천 확인 필요';
  return {
    label: _AIO_PUBLIC_AI_POLICY.label,
    status: evidenceStatus,
    asOf: asOf,
    source: sourceLabel,
    text: _AIO_PUBLIC_AI_POLICY.label + ' · 기준시각: ' + asOf + ' · Evidence: ' + evidenceStatus + ' · 원천: ' + sourceLabel + ' · 원문 재확인 필요'
  };
}

function _aioApplyAIActionGate(text, meta) {
  var raw = String(text || '');
  // Educational mentions remain allowed; concrete instruction requires a
  // directive, an allocation/price/level, or an explicit action label nearby.
  var number = '(?:[$₩€]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:원|달러|USD|%|배|bp)?';
  var action = '(?:매수|매도|추가매수|진입|청산|손절|익절|목표가|진입가|손절가|비중|포지션|헤지)';
  var directive = '(?:하세요|하라|해야|권고|추천|제안|고려(?:하라|하세요)?|적절|유효|가능|우호|유리|불리|시점|타이밍|판단|기회|적극|확대|축소|유지|정리|사세요|파세요|들어가|나가)';
  var concrete = new RegExp('(?:' + action + ').{0,32}(?:' + number + '|' + directive + ')|(?:' + number + '|' + directive + ').{0,32}(?:' + action + ')', 'i');
  var labeled = new RegExp('(?:목표가|진입가|손절가|비중|포지션).{0,24}(?:' + number + '|확대|축소|유지|정리)', 'i');
  var blocked = concrete.test(raw) || labeled.test(raw);
  if (!blocked) return { blocked: false, text: raw, reasons: [] };
  return {
    blocked: true,
    text: 'AI 베타 안전 모드\n\n구체적인 매수·매도·비중·손절·목표가 지시는 현재 제공하지 않습니다.\n\n주입된 데이터의 조건·위험요인과 Evidence 상태를 참고하되, 기준시각과 원문을 직접 재확인한 뒤 판단하세요.',
    reasons: ['concrete-trade-instruction']
  };
}

function _aioAppendAIPublicDisclosure(parent, meta) {
  if (!parent || typeof document === 'undefined') return null;
  try {
    var old = parent.querySelector('[data-ai-public-disclosure]');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var info = _aioBuildAIResponseDisclosure(meta);
    var el = document.createElement('div');
    el.setAttribute('data-ai-public-disclosure', _AIO_PUBLIC_AI_POLICY.status);
    el.setAttribute('data-evidence-status', info.status);
    el.setAttribute('data-as-of', info.asOf);
    el.style.cssText = 'margin:5px 0;padding:5px 7px;border-left:2px solid var(--data-amber);background:rgba(255,163,26,0.07);color:var(--text-muted);font-size:10px;line-height:1.45;';
    el.textContent = info.text;
    parent.appendChild(el);
    return info;
  } catch(_) { return null; }
}

if (typeof window !== 'undefined') {
  window._AIO_PUBLIC_AI_POLICY = _AIO_PUBLIC_AI_POLICY;
  window._aioPublicAIActionPolicyPrompt = _aioPublicAIActionPolicyPrompt;
  window._aioApplyAIActionGate = _aioApplyAIActionGate;
  window._aioCreateAIRequestObject = _aioCreateAIRequestObject;
  window._aioBeginAIRequestAttempt = _aioBeginAIRequestAttempt;
  window._aioRunAIResponsePipeline = _aioRunAIResponsePipeline;
  window._aioBuildAIResponseDisclosure = _aioBuildAIResponseDisclosure;
  window._aioAppendAIPublicDisclosure = _aioAppendAIPublicDisclosure;
  window.AIO = window.AIO || {};
  window.AIO.getAIResponsePolicy = function() { return _AIO_PUBLIC_AI_POLICY; };
  window.AIO.getAIResponsePipelineAudit = function() {
    return (window._aioAiPipelineAudit || []).slice();
  };
}

function _getImportedResearchContext(ctxId) {
  try {
    if (window.AIO && typeof window.AIO.buildAIRetrievalContext === 'function') {
      return window.AIO.buildAIRetrievalContext(window._aioActiveAIQuery || '', ctxId, { topK: 4, budgetTokens: 2400 });
    }
    var map = {
      home:'home', briefing:'home', macro:'macro', fxbond:'fxbond',
      technical:'technical', signal:'technical', screener:'screener',
      ticker:'ticker', fundamental:'fundamental', themes:'themes',
      'theme-detail':'theme-detail', portfolio:'portfolio',
      'kr-market':'macro', 'kr-home':'macro', 'kr-supply':'macro',
      'kr-themes':'themes', 'kr-macro':'macro', 'kr-tech':'technical',
      'kr-technical':'technical'
    };
    var key = map[ctxId] || ctxId;
    var modules = window.AIO_USER_RESEARCH_PAGE_MODULES || {};
    var digest = window.AIO_USER_RESEARCH_DIGEST || null;
    var mod = modules[key];
    if (!mod && window.AIO_IMPORTED_RESEARCH_20260618 && window.AIO_IMPORTED_RESEARCH_20260618.pageModules) {
      mod = window.AIO_IMPORTED_RESEARCH_20260618.pageModules[key];
      digest = window.AIO_IMPORTED_RESEARCH_20260618;
    }
    if (!mod) return '';
    var cards = Array.isArray(mod.cards) ? mod.cards : [];
    var lines = cards.slice(0, 6).map(function(c) {
      if (Array.isArray(c)) return '- ' + c[0] + ': ' + c[1];
      return '- ' + (c.title || c.id || 'reference') + ': ' + (c.thesis || c.automationHint || '');
    }).join('\n');
    return '\n\n[User supplied research digest | sourceKind=REFERENCE | asOf=' + ((digest && (digest.generatedAt || digest.asOf)) || 'unspecified') + ']\n' +
      'page=' + key + ' | items=' + cards.length + '\n' +
      lines + '\n' +
      'Rule: use this as a decision framework and UI pattern, not as live market data. For current prices, fundamentals, macro numbers, or trade decisions, cite only LIVE/SNAPSHOT/verified data blocks already injected into the prompt.\n' +
      'Visual report rule: if the user asks for an image, infographic, report card, one-page memo, or visual material, AIO can create an in-browser PNG-style visual report from the current page via _aioCreateVisualReport("' + key + '") when that function is available. The visual must show sourceKind/asOf and must not make stale REFERENCE material look live.\n';
  } catch(_) { return ''; }
}
if (typeof window !== 'undefined') window._getImportedResearchContext = _getImportedResearchContext;

function _aioTacticalTraderFrameworkContext(ctxId, q) {
  try {
    var relevant = {
      home:1, signal:1, briefing:1, 'market-news':1, technical:1, screener:1,
      ticker:1, fundamental:1, themes:1, 'theme-detail':1, portfolio:1
    };
    var ask = String(q || '').toLowerCase();
    var keywordHit = /smh|igv|qqq|spy|semi|semiconductor|software|short.?cover|failed breakdown|volume profile|support|reclaim|rotation/.test(ask);
    if (!relevant[ctxId] && !keywordHit) return '';
    var f = (window.AIO && typeof window.AIO.getTacticalTraderFramework === 'function') ? window.AIO.getTacticalTraderFramework() : window.AIO_TACTICAL_TRADER_FRAMEWORK;
    if (!f || !Array.isArray(f.rules)) return '';
    var lines = f.rules.map(function(r) {
      return '- ' + r.id + ': ' + r.meaning + ' Evidence=' + (r.requiredEvidence || []).join('/');
    }).join('\n');
    return '\n\n[User supplied trader tactical framework | sourceKind=' + (f.sourceKind || 'REFERENCE') + ' | asOf=' + (f.asOf || 'unspecified') + ']\n' +
      'Use this as a durable trading-decision framework, not as live market data.\n' +
      lines + '\n' +
      'Required answer discipline: separate (1) volume-backed buying vs low-volume short-cover rally, (2) support/reclaim vs confirmed breakdown, (3) IGV-to-SMH rotation vs real semiconductor thesis break. Exact SPX/QQQ levels from the screenshot are historical examples only; current levels must come from injected live/snapshot technical data.\n';
  } catch(_) { return ''; }
}
if (typeof window !== 'undefined') window._aioTacticalTraderFrameworkContext = _aioTacticalTraderFrameworkContext;

// v53.43 / integrate 2026-07-20: the user supplied AI-infrastructure material is
// stored as a durable REFERENCE framework. It is deliberately separated from
// live values so the two competing capex theses can guide questions without
// turning an essay, screenshot, or X link into current market data.
var AIO_AI_INFRA_CYCLE_REFERENCE = {
  id: 'ai-infrastructure-cycle-20260720',
  version: 'v53.43',
  sourceKind: 'REFERENCE',
  asOf: '2026-07-20',
  sourceLabel: 'User-supplied market analysis, essay, X links, and chart images',
  handling: 'Use as a reusable debate and monitoring framework only. Exact historical figures, chart levels, and external-link claims require current/official evidence before they can affect a decision.',
  questions: [
    { id: 'Q1', label: 'Capex lag or structural trap?', meaning: 'Is current AI capex cash outflow mainly a timing gap before contracted revenue, or does depreciation and recurring reinvestment prevent a durable harvest period?' },
    { id: 'Q2', label: 'What changed in the market model?', meaning: 'Memory behaves as a P/ASP-and-multiple cycle, while neocloud behaves as a Q/utilization, spread, depreciation, and capital-access cycle.' },
    { id: 'Q3', label: 'Which variables decide the debate?', meaning: 'Track capex growth versus revenue growth, backlog conversion versus depreciation, price/margin momentum, utilization and rental spread, funding runway, credit spreads, breadth, and real yields.' },
    { id: 'Q4', label: 'What is the transmission mechanism?', meaning: 'Demand and backlog drive capacity spending; spending becomes depreciation and financing needs; falling compute/token prices can compress spread; breadth, rates, and credit decide whether the shock stays selective or becomes systemic.' },
    { id: 'Q5', label: 'Where do spillovers appear?', meaning: 'Power, cooling, optics, networking, storage, energy inflation, Korea/EWY semiconductor leadership, and index breadth can confirm or weaken the AI-infrastructure thesis.' }
  ],
  lenses: [
    { id: 'memory-p-game', label: 'Memory = P game', meaning: 'Price/ASP acceleration and the multiple matter; a low P/E is not automatically cheap for a cyclical memory producer.' },
    { id: 'neocloud-q-capital-game', label: 'Neocloud = Q·capital game', meaning: 'Quantity/utilization must outrun falling rental prices while funding cost, GPU depreciation, lease obligations, and runway remain survivable.' },
    { id: 'breadth-confirmation', label: 'Narrow index stability is not broad stabilization', meaning: 'Separate mega-cap support from market-wide participation using advance ratio, equal-weight/benchmark relative strength, moving-average breadth, volume, VIX term structure, and credit spreads.' }
  ],
  chartReadingProtocol: [
    'Context: compare cap-weighted leadership with equal-weight, small-cap, sector, and cross-market participation before reading a single pattern.',
    'Trend: classify higher-high/higher-low, lower-high/lower-low, moving-average slope, and location inside the larger time-series structure.',
    'Structure: mark support, resistance, channel, Fibonacci/confluence, and the level that would invalidate the visible setup.',
    'Retest: a reclaim or failed retest matters more than the first touch; require price acceptance rather than a single wick or candle.',
    'Participation: confirm with volume, advance ratio, breadth above moving averages, relative strength, and credit/volatility context.',
    'Momentum: use RSI/oscillator divergence as context, never as a standalone reversal signal.',
    'Decision: finish with confirmation, invalidation, missing evidence, and the next observation window.'
  ],
  behaviorPlaybook: [
    { id: 'wait', trigger: 'Breadth remains narrow, a rebound lacks volume, or the reference thesis cannot be reconciled with current evidence.', response: 'Do not chase; preserve optionality and identify the missing observation.' },
    { id: 'probe', trigger: 'At least two independent confirmations align: breadth expansion, earnings/estimate improvement, and price/volume reclaim.', response: 'Treat as a staged hypothesis test only; sizing and execution remain user-controlled, never an automatic order.' },
    { id: 'hold', trigger: 'Backlog conversion or demand evidence improves while depreciation, rental spread, funding, and credit remain contained.', response: 'Maintain the thesis conditionally and monitor the next earnings, utilization, and financing checkpoints.' },
    { id: 'protect', trigger: 'VIX/HY OAS/real yields/oil stress combine with breadth deterioration, capex cuts, contract breaks, or funding blockage.', response: 'Reduce leverage and reassess exposure according to the user mandate; state the invalidation rather than rationalizing the thesis.' }
  ],
  communicationContract: [
    'Lead with the verdict and regime, then separate observed evidence, reference evidence, and inference.',
    'State what changed, what did not change, what would change the view, and what evidence is missing.',
    'Close with confirmation, invalidation, time horizon, and the next check instead of a pattern-only conclusion.'
  ],
  invalidation: [
    'Capex growth stays above revenue growth while backlog conversion fails to accelerate.',
    'Depreciation and financing costs rise faster than revenue or rental spread.',
    'Broad participation deteriorates together with VIX, HY OAS, real yields, or oil-inflation pressure.',
    'Neocloud contracts, funding access, or utilization fail before Q can offset price deflation.'
  ]
};

function _aioAIInfraCycleContext(ctxId, q) {
  try {
    var relevant = {
      home:1, briefing:1, macro:1, fxbond:1, technical:1, signal:1, breadth:1,
      sentiment:1, themes:1, 'theme-detail':1, fundamental:1, screener:1,
      ticker:1, portfolio:1, options:1, 'market-news':1,
      'kr-home':1, 'kr-supply':1, 'kr-themes':1, 'kr-macro':1, 'kr-tech':1, 'kr-technical':1
    };
    var ask = String(q || '').toLowerCase();
    var hit = /capex|depreciation|neocloud|coreweave|nebius|iren|memory|dram|hbm|gpu|tpu|breadth|kospi|ewy|soxx|smh|oil|real yield|credit|backlog|utilization|funding|multiple/.test(ask);
    if (!relevant[ctxId] && !hit) return '';
    var f = AIO_AI_INFRA_CYCLE_REFERENCE;
    var lines = [
      '\n\n[User-supplied AI infrastructure cycle framework | sourceKind=' + f.sourceKind + ' | asOf=' + f.asOf + ']',
      'This is a durable REFERENCE framework, not a live quote/fundamental block. Do not promote its figures, chart levels, scenario dates, or external-link claims to current facts.',
      'Source handling: the supplied essay, X links, and eight chart images were read as reference material; current claims must be reconciled with injected LIVE/SNAPSHOT/official evidence.'
    ];
    f.questions.forEach(function(item) { lines.push('- ' + item.id + ' ' + item.label + ': ' + item.meaning); });
    f.lenses.forEach(function(item) { lines.push('- Lens ' + item.label + ': ' + item.meaning); });
    lines.push('Chart-reading protocol: ' + f.chartReadingProtocol.join(' → '));
    lines.push('Behavior playbook: ' + f.behaviorPlaybook.map(function(item) { return item.id + '=' + item.trigger + ' => ' + item.response; }).join(' | '));
    lines.push('Communication contract: ' + f.communicationContract.join(' | '));
    lines.push('Required cross-check: compare the 2026-07-20 reference window with the latest available time series, then state what changed, what did not change, and which evidence is still missing.');
    lines.push('Required answer split: (1) memory P/ASP/multiple, (2) neocloud Q/spread/capital, (3) capex/backlog/depreciation, (4) breadth/rates/credit/oil, (5) confirmation and invalidation conditions.');
    lines.push('Do not infer a bottom from one-day rebound, a low P/E, a backlog headline, or a chart pattern alone.');

    var root = typeof window !== 'undefined' ? window : {};
    var snap = root.DATA_SNAPSHOT || {};
    var live = {};
    try { live = typeof _liveSnap === 'function' ? (_liveSnap() || {}) : {}; } catch(_) { live = {}; }
    var finite = function(v) { return typeof v === 'number' && isFinite(v); };
    var pick = function(a, b) { return finite(a) ? a : (finite(b) ? b : null); };
    var obs = [];
    var vix = pick(live.vix, snap.vix);
    var tnx = pick(live.tnx, snap.tnx);
    var hy = pick(snap.hyOAS, root._hySpreadBp != null ? Number(root._hySpreadBp) / 100 : null);
    var wti = pick(snap.wti, root._liveData && root._liveData['CL=F'] ? Number(root._liveData['CL=F'].price) : null);
    var breadth = root._breadthLiveData || null;
    var asOf = snap._updated || snap._marketDataUpdated || null;
    if (finite(vix)) obs.push('VIX=' + vix + (snap._fieldTs && snap._fieldTs.vix ? ' @' + snap._fieldTs.vix : ''));
    if (finite(tnx)) obs.push('US10Y=' + tnx + '%');
    if (finite(hy)) obs.push('HY OAS=' + hy + '%');
    if (finite(wti)) obs.push('WTI=' + wti);
    if (breadth && finite(breadth.advanceRatio)) obs.push('AIO US advance ratio=' + Math.round(breadth.advanceRatio * 1000) / 10 + '% @' + (breadth.observedAt || 'unknown'));
    if (breadth && finite(breadth.sma20) && finite(breadth.sma50) && finite(breadth.above200)) obs.push('breadth above 20/50/200=' + breadth.sma20 + '/' + breadth.sma50 + '/' + breadth.above200 + '%');
    lines.push(obs.length ? 'Runtime comparison (source-aware only): ' + obs.join(' · ') + (asOf ? ' · artifact=' + asOf : '') : 'Runtime comparison: current macro/breadth evidence is not injected; do not fill the gap with the reference figures.');
    lines.push('Reference invalidation checklist: ' + f.invalidation.join(' | '));
    return lines.join('\n');
  } catch(_) { return ''; }
}
if (typeof window !== 'undefined') {
  window.AIO_AI_INFRA_CYCLE_REFERENCE = AIO_AI_INFRA_CYCLE_REFERENCE;
  window._aioAIInfraCycleContext = _aioAIInfraCycleContext;
  window.AIO = window.AIO || {};
  window.AIO.getAIInfraCycleReference = function() { return AIO_AI_INFRA_CYCLE_REFERENCE; };
}

function _aioCreateEvidenceContext(title, focus) {
  return {
    title: title,
    referenceFrameworks: ['ai-infrastructure-cycle'],
    system: function() {
      var snap = typeof _liveSnap === 'function' ? _liveSnap() : {};
      var lines = [
        '역할: ' + title + ' · 페이지 초점: ' + focus,
        '현재 검증된 런타임 관측치만 사용합니다.',
        'S&P ' + (snap.spx == null ? '—' : snap.spx) + ' · VIX ' + (snap.vix == null ? '—' : snap.vix) + ' · US10Y ' + (snap.tnx == null ? '—' : snap.tnx),
        'DXY ' + (snap.dxy == null ? '—' : snap.dxy) + ' · USD/KRW ' + (snap.krw == null ? '—' : snap.krw),
        '값이 —이면 추정·보간·과거 수치 대입 없이 판단을 보류합니다.',
        '현재형 뉴스·목표가·확률·컨센서스는 내장 텍스트에서 가져오지 않습니다.',
        '답변 가이드: 관측 → 해석 → 무효화 조건 → 사용자가 확인할 다음 증거 순서로 씁니다.',
        '매매·포지션 질문은 실행 지시 대신 HOLD_CORE / NO_ADD_RAISE_STOP / TRIM_25_33 / EXIT_OR_HEDGE 같은 위험관리 선택지를 조건부로 설명합니다.',
        'OPEX·감마·Lockout/LOCKOUT_CONTINUATION·시나리오는 해당 런타임 증거가 주입된 경우에만 사용합니다.',
        'RATIO/DISTANCE thresholds are calibration constants, NOT absolute prices.'
      ];
      if (focus === 'themes') {
        var themeId = window._currentThemeId || null;
        var aliases = window.SCR_KEYWORD_ALIASES || {};
        lines.push('현재 테마: ' + (themeId || '미선택') + ' · 키워드 별칭 ' + Object.keys(aliases).length + '개');
      }
      if (focus === 'ticker' && !window._currentTicker && !window._currentTickerId) {
        lines.push('현재 종목이 미선택 상태입니다. 예: NVDA처럼 티커를 먼저 선택해야 종목별 분석이 가능합니다.');
        lines.push('HARD STOP: 시세 미수신 상태에서는 가격 인용·진입가·목표가 계산을 하지 않습니다.');
      }
      var framework = typeof _getV48IntegratedContext === 'function' ? _getV48IntegratedContext(focus) : '';
      var aiInfra = typeof _aioAIInfraCycleContext === 'function' ? _aioAIInfraCycleContext(focus) : '';
      var rules = typeof _getChatRules === 'function' ? _getChatRules() : '';
      return lines.join('\n') + framework + aiInfra + rules;
    }
  };
}

const CHAT_CONTEXTS = {
  technical:_aioCreateEvidenceContext('AI 기술적 분석가','technical'),
  macro:_aioCreateEvidenceContext('AI 매크로 분석가','macro'),
  fundamental:_aioCreateEvidenceContext('AI 펀더멘털 분석가','fundamental'),
  themes:_aioCreateEvidenceContext('AI 테마 분석가','themes'),
  'theme-detail':_aioCreateEvidenceContext('AI 테마 상세 분석가','themes'),
  portfolio:_aioCreateEvidenceContext('AI 포트폴리오 분석가','portfolio'),
  fxbond:_aioCreateEvidenceContext('AI 금리·환율 분석가','fxbond'),
  signal:_aioCreateEvidenceContext('AI 매매환경 분석가','signal'),
  breadth:_aioCreateEvidenceContext('AI 시장폭 분석가','breadth'),
  sentiment:_aioCreateEvidenceContext('AI 심리 분석가','sentiment'),
  screener:_aioCreateEvidenceContext('AI 스크리너 분석가','screener'),
  ticker:_aioCreateEvidenceContext('AI 종목 분석가','ticker'),
  home:_aioCreateEvidenceContext('AI 시장 분석가','home'),
  briefing:_aioCreateEvidenceContext('AI 브리핑 분석가','briefing'),
  'market-news':_aioCreateEvidenceContext('AI 뉴스 분석가','market-news'),
  options:_aioCreateEvidenceContext('AI 옵션 분석가','options'),
  'kr-themes':_aioCreateEvidenceContext('AI 한국 테마 분석가','themes'),
  'kr-macro':_aioCreateEvidenceContext('AI 한국 매크로 분석가','macro'),
  'kr-home':_aioCreateEvidenceContext('AI 한국시장 분석가','home'),
  'kr-supply':_aioCreateEvidenceContext('AI 한국 수급 분석가','kr-supply'),
  'kr-tech':_aioCreateEvidenceContext('AI 한국 기술적 분석가','technical'),
  'kr-technical':_aioCreateEvidenceContext('AI 한국 기술적 분석가','technical')
};

if (typeof window !== 'undefined') {
  // v51.99/Phase3[A2]: was a plain overwrite, unlike every `window.AIO = window.AIO || {}` merge
  // elsewhere in this codebase. index.html inline blocks add page-specific contexts (home/
  // market-news/options exist ONLY there, plus enhanced technical/macro/themes/... overrides) via
  // `window.CHAT_CONTEXTS = window.CHAT_CONTEXTS || {}` + per-key assignment — that pattern is
  // already order-independent. This was the one order-DEPENDENT half: today aio-chat.js loads
  // before those inline blocks so the accident-of-ordering worked, but it would silently discard
  // everything index.html built if aio-chat.js ever loaded after them (e.g. under `defer`).
  // Merging makes this correct regardless of load order — whatever's already in
  // window.CHAT_CONTEXTS (index.html's page-specific entries) wins over this file's generic base.
  window.CHAT_CONTEXTS = Object.assign({}, CHAT_CONTEXTS, window.CHAT_CONTEXTS || {});
  window._chatMultiTurnStats = window._chatMultiTurnStats || {
    trimEvents: 0,
    summaryInsertions: 0,
    maxTurnsBeforeTrim: 0,
    lastTrimmedChars: 0
  };
}

function _aioNormalizeChatFreshnessLanguage(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/\[실시간\]/g, '[live 우선/source 확인]')
    .replace(/실시간 값 사용/g, 'source label과 신선도를 확인한 값만 사용')
    .replace(/실시간 데이터 블록/g, 'live 우선/source 확인 데이터 블록')
    .replace(/실시간 데이터가 주입된 경우/g, 'live/source 확인 데이터가 주입된 경우')
    .replace(/실시간 데이터·뉴스·웹검색/g, 'live/source 확인 데이터·뉴스·웹검색')
    .replace(/실시간 데이터/g, 'live 우선/source 확인 데이터')
    .replace(/실시간 시세 조회 실패/g, '현재 시세 조회 실패')
    .replace(/실시간 시세/g, 'live 우선/source 확인 시세')
    .replace(/실시간 조회/g, 'live 우선/source 확인 조회')
    .replace(/실시간 스냅샷/g, 'source-aware 스냅샷')
    .replace(/실시간 한국시장/g, 'source-aware 한국시장')
    .replace(/실시간 등락률/g, 'live 우선/source 확인 등락률')
    .replace(/실시간 밸류에이션/g, 'live 우선/source 확인 밸류에이션')
    .replace(/실시간 가격/g, 'live 우선/source 확인 가격')
    .replace(/실시간 연결/g, 'live 연결')
    .replace(/_liveSnap\(\) 실시간/g, '_liveSnap() live 우선/source 확인')
    .replace(/\[실시간 시세\]/g, '[live 우선/source 확인 시세]');
}

if (typeof window !== 'undefined') {
  window._aioNormalizeChatFreshnessLanguage = _aioNormalizeChatFreshnessLanguage;
}

// ── Per-context state ──────────────────────────────────────────────────
const chatState = {};
function getChatState(ctxId) {
  if (!chatState[ctxId]) chatState[ctxId] = { messages: [], streaming: false };
  return chatState[ctxId];
}

// ── Text processing helpers ────────────────────────────────────────────
function stripChips(text) {
  return text.replace(/\[Q:[^\]]+\]/g, '').trim();
}

function extractChips(text) {
  if (!text) return [];
  const m = text.match(/\[Q:([^\]]+)\]/);
  if (!m) return [];
  return m[1].split('||').map(function(s) { return s.trim(); }).filter(Boolean).slice(0, 4);
}

function renderMarkdownLight(text) {
  // v30.14→v33.4: 마크다운 테이블·헤더·리스트·코드블록 완전 렌더링
  // v33.4: 코드 펜스(```) 처리 추가
  var lines = text.split('\n');
  var html = [];
  var inTable = false;
  var tableRows = [];
  var inCodeBlock = false;
  var codeLines = [];

  function escLine(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function inlineFmt(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.88em">$1</code>');
  }
  function isTableSep(s) { return /^\|[\s\-:|]+\|$/.test(s.trim()); }
  function isTableRow(s) { return /^\|.+\|$/.test(s.trim()); }
  function parseTableCells(s) {
    return s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(function(c){ return inlineFmt(escLine(c.trim())); });
  }
  function flushTable() {
    if (tableRows.length === 0) return;
    var hdr = tableRows[0];
    // v31.1: 5컬럼 초과 시 테이블 대신 리스트로 변환 (가로 깨짐 방지)
    if (hdr.length > 5) {
      for (var r = 1; r < tableRows.length; r++) {
        var item = '<div style="margin:6px 0;padding:8px 10px;background:var(--surface-2);border-radius:3px;border:1px solid var(--border);">';
        for (var c = 0; c < hdr.length; c++) {
          if (tableRows[r][c]) item += '<div style="margin:2px 0;"><strong style="color:var(--text-muted);font-size:0.9em;">' + hdr[c] + ':</strong> ' + tableRows[r][c] + '</div>';
        }
        item += '</div>';
        html.push(item);
      }
      tableRows = []; inTable = false; return;
    }
    var t = '<div class="chat-table-wrap"><table class="chat-tbl"><thead><tr>';
    for (var h = 0; h < hdr.length; h++) t += '<th>' + hdr[h] + '</th>';
    t += '</tr></thead><tbody>';
    for (var r = 1; r < tableRows.length; r++) {
      t += '<tr>';
      for (var c = 0; c < tableRows[r].length; c++) t += '<td>' + (tableRows[r][c] || '') + '</td>';
      t += '</tr>';
    }
    t += '</tbody></table></div>';
    html.push(t);
    tableRows = [];
    inTable = false;
  }

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var esc = escLine(raw);
    // v33.4: 코드 펜스(```) 처리
    if (raw.trim().startsWith('```')) {
      if (inTable) flushTable();
      if (inCodeBlock) {
        html.push('<pre>' + codeLines.join('\n') + '</pre>');
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(esc);
      continue;
    }
    // 테이블 감지
    if (isTableRow(raw)) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (isTableSep(raw)) continue; // 구분선 스킵
      tableRows.push(parseTableCells(raw));
      continue;
    }
    if (inTable) flushTable();
    // 헤더 (### → h5, ## → h4, # → h3)
    var hm = raw.match(/^(#{1,4})\s+(.+)$/);
    if (hm) {
      var lvl = Math.min(hm[1].length + 2, 6);
      html.push('<h' + lvl + ' class="chat-h">' + inlineFmt(escLine(hm[2])) + '</h' + lvl + '>');
      continue;
    }
    // 리스트 (- item, * item, N. item)
    var lm = raw.match(/^(\s*)([-*•]|\d+[.)]) (.+)$/);
    if (lm) {
      html.push('<div class="chat-li">' + inlineFmt(escLine(lm[3])) + '</div>');
      continue;
    }
    // 빈 줄
    if (raw.trim() === '') { html.push('<br>'); continue; }
    // 일반 텍스트
    html.push(inlineFmt(esc) + '<br>');
  }
  if (inTable) flushTable();
  if (inCodeBlock && codeLines.length) html.push('<pre>' + codeLines.join('\n') + '</pre>');
  return html.join('');
}

// ── Render suggestion chips ────────────────────────────────────────────
function chatRenderChips(ctxId, chips) {
  var el = document.getElementById('chat-' + ctxId + '-chips');
  if (!el) return;
  if (!chips || chips.length === 0) {
    chips = (window.CHAT_DEFAULT_CHIPS && window.CHAT_DEFAULT_CHIPS[ctxId]) || [];
  }
  el.innerHTML = chips.map(function(q) {
    var safeQ = escHtml(q).replace(/'/g, '&#39;');
    return '<div class="q-chip" data-action="chatFromChip" data-arg="' + escHtml(ctxId) + '" data-arg2="' + safeQ + '" title="' + escHtml(q) + '">' + escHtml(q) + '</div>';
  }).join('');
}

// ── v33.4: 채팅 확장/축소 토글 ────────────────────────────────────────────
function toggleChatExpand(ctxId) {
  var chat = document.getElementById('chat-' + ctxId);
  if (!chat) return;
  var isExpanded = chat.classList.toggle('chat-expanded');
  var btn = chat.querySelector('.acp-expand-btn');
  if (btn) btn.textContent = isExpanded ? '↙ 축소' : '↗ 확장';
  // 확장 시 메시지 영역 끝으로 자동 스크롤
  var msgs = document.getElementById('chat-' + ctxId + '-msgs');
  if (msgs) setTimeout(function() { msgs.scrollTop = msgs.scrollHeight; }, 100);
}

// ── Append a message bubble ────────────────────────────────────────────
function chatAppendMsg(ctxId, role, html, id) {
  var container = document.getElementById('chat-' + ctxId + '-msgs');
  if (!container) return null;
  var wrap = document.createElement('div');
  wrap.className = 'acp-msg ' + role;
  var bubble = document.createElement('div');
  bubble.className = 'acp-bubble';
  if (id) bubble.id = id;
  bubble.innerHTML = html;
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

// ── Loading dots ───────────────────────────────────────────────────────
function chatShowLoading(ctxId) {
  return chatAppendMsg(ctxId, 'ai',
    '<span class="chat-dots"><span>·</span><span>·</span><span>·</span></span>',
    'chat-' + ctxId + '-loading'
  );
}

// ── Claude API streaming ───────────────────────────────────────────────
// v31.3: opts = { modelKey: 'haiku'|'sonnet'|'sonnet-thinking' }
// v50.52 B5: Claude 호출 엔드포인트 결정 — 서버 키 모드(CF Worker /anthropic) vs 직접 호출.
//   운영자가 Worker URL + 서버 키 토글(aio_claude_server_mode) 설정 시 개인 키 없이 Worker 경유
//   (키는 Cloudflare 시크릿). 개인 키가 있으면 개인 키 직접 호출 우선(존중). 기본=직접(무회귀).
function _aioClaudeTarget(apiKey) {
  try {
    var localWorker = (typeof _getApiKey === 'function' ? (_getApiKey('aio_cf_worker_url') || '') : '').trim().replace(/\/+$/, '');
    var publicCfg = window.AIO && typeof window.AIO.getPublicConfig === 'function' ? window.AIO.getPublicConfig() : null;
    var publicWorker = publicCfg && publicCfg.ai && typeof publicCfg.ai.workerUrl === 'string' ? publicCfg.ai.workerUrl.trim().replace(/\/+$/, '') : '';
    var wurl = localWorker || publicWorker;
    var serverMode = false;
    try { serverMode = localStorage.getItem('aio_claude_server_mode') === '1'; } catch(_) {}
    if (publicWorker && publicCfg.ai.serverMode === 'shared-worker') serverMode = true;
    if (wurl && (serverMode || !apiKey)) return { url: wurl + '/anthropic', healthUrl: wurl + ((publicCfg && publicCfg.ai && publicCfg.ai.healthPath) || '/health'), workerUrl: wurl, serverKey: true, source: localWorker ? 'local-config' : 'public-config' };
  } catch(_) {}
  return { url: 'https://api.anthropic.com/v1/messages', serverKey: false, source: 'personal-key' };
}
window._aioClaudeTarget = _aioClaudeTarget;

// v52.47 WO-1B: Worker /anthropic 라우트에 실어보내는 공유 앱 토큰. 공개 클라이언트 JS에
// 그대로 노출되므로 진짜 비밀이 아니다 — Worker(cloudflare-worker-proxy.js)가 이 값과 동일한
// env.AIO_APP_TOKEN을 설정했을 때만 "URL만 아는" curl/스크립트 남용을 거르는 최소 방어선으로
// 쓰인다(운영자가 설정 안 하면 Worker가 이 헤더를 아예 검사하지 않음 — 하위호환).
function _aioAppToken() { return 'aio-screener-app-v1'; }
window._aioAppToken = _aioAppToken;

function _aioHasClaudeRoute(apiKey) {
  var target = _aioClaudeTarget(apiKey);
  return !!(apiKey || (target && target.serverKey));
}
window._aioHasClaudeRoute = _aioHasClaudeRoute;

var _aioWorkerHealthCache = window._aioWorkerHealthCache || {};
async function _aioEnsureClaudeRoute(apiKey) {
  if (window.AIO && typeof window.AIO.loadPublicConfig === 'function') await window.AIO.loadPublicConfig();
  var target = _aioClaudeTarget(apiKey);
  if (apiKey) {
    if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') window.AIO.updateProviderStatus('aio_claude_api_key', { authentication: 'CONFIGURED', connection: 'NOT_CHECKED' });
    return { ok: true, target: target, reason: 'PERSONAL_KEY' };
  }
  if (!target || !target.serverKey) {
    var locked = typeof _aioProviderStatusForKey === 'function' && _aioProviderStatusForKey('aio_claude_api_key').storage === 'LOCKED';
    return { ok: false, reason: locked ? 'VAULT_LOCKED' : 'NO_ROUTE', target: target };
  }
  var now = Date.now();
  var cached = _aioWorkerHealthCache[target.workerUrl];
  if (cached && now - cached.checkedAt < 30000) return cached;
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 2500);
    var response = await fetch(target.healthUrl, { method: 'GET', cache: 'no-store', credentials: 'omit', headers: { 'X-AIO-App-Token': _aioAppToken() }, signal: ctrl.signal });
    clearTimeout(timer);
    var payload = await response.json().catch(function() { return null; });
    var ready = response.ok && !!(payload && payload.ai && payload.ai.ready === true);
    var result = { ok: ready, reason: ready ? 'SHARED_WORKER' : 'WORKER_NOT_READY', target: target, checkedAt: now, health: payload };
    _aioWorkerHealthCache[target.workerUrl] = result;
    if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') window.AIO.updateProviderStatus('aio_cf_worker_url', { connection: ready ? 'READY' : 'NOT_READY', lastError: ready ? null : result.reason });
    return result;
  } catch (e) {
    var failed = { ok: false, reason: 'WORKER_NOT_READY', target: target, checkedAt: now, error: e && e.message || 'health_failed' };
    _aioWorkerHealthCache[target.workerUrl] = failed;
    if (window.AIO && typeof window.AIO.updateProviderStatus === 'function') window.AIO.updateProviderStatus('aio_cf_worker_url', { connection: 'NOT_READY', lastError: failed.error });
    return failed;
  }
}
window._aioEnsureClaudeRoute = _aioEnsureClaudeRoute;
window._aioRouteNotice = function(reason) {
  return ({
    NO_ROUTE: 'AI 라우트가 없습니다. Claude 개인 키를 저장하거나 운영자가 공개 Worker를 명시적으로 연결해야 합니다.',
    VAULT_LOCKED: 'Claude 키가 Vault에 잠겨 있습니다. 사이드바에서 PIN으로 잠금 해제한 뒤 다시 시도하세요.',
    WORKER_NOT_READY: '공유 AI Worker가 준비되지 않았습니다. 운영자 설정·키·쿼터·허용 Origin을 확인하세요.',
    RATE_LIMIT: 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
    AUTH_FAILED: 'AI 인증에 실패했습니다. 키 형식과 공급자 권한을 확인하세요.'
  })[reason] || 'AI 라우트를 확인하지 못했습니다. 잠시 후 다시 시도하세요.';
};

// v52.44 B8: Cloudflare Workers 무료 플랜은 리전 고정이 불가해 anycast 라우팅이 요청마다 다른 엣지
// 데이터센터를 탈 수 있다 — 그중 홍콩(HKG) 경유 요청을 Anthropic이 정책상 403(forbidden)으로 거부하는
// 사례를 curl로 3회 재현 확인(도쿄 NRT 경유는 200, 홍콩 HKG 경유는 403, 응답 포맷이 Worker 자체
// errorResponse()의 {error,status}가 아니라 Anthropic이 직접 반환하는 {error:{type,message}} 형태임을
// 확인해 확정). 레포·시크릿·배포는 전부 정상이라 코드로 완전히 없앨 수는 없지만, 새 인바운드 요청은
// 매번 새로 anycast 라우팅되므로 즉시 재시도하면 다른(정상) 데이터센터로 갈 가능성이 높다.
// 서버 키 모드(Worker 경유)일 때만, 그리고 Anthropic 자체 403 forbidden 포맷일 때만 재시도 —
// 키 만료 등 다른 원인의 실패는 재시도해도 무의미하므로 그대로 통과시켜 기존 에러 처리로 넘긴다.
async function _aioFetchClaudeWithRetry(url, fetchOpts, serverKey, maxRetries) {
  maxRetries = (typeof maxRetries === 'number') ? maxRetries : 2;
  var res = await fetch(url, fetchOpts);
  var attempt = 0;
  while (serverKey && res.status === 403 && attempt < maxRetries) {
    var isRegionBlock = false;
    try {
      var _peek = await res.clone().json();
      isRegionBlock = !!(_peek && _peek.error && _peek.error.type === 'forbidden');
    } catch(_) {}
    if (!isRegionBlock) break;
    attempt++;
    if (typeof _aioLog === 'function') _aioLog('warn', 'fetch', 'Worker anycast 403(forbidden) 감지 — 재시도 ' + attempt + '/' + maxRetries + ' (다른 엣지 데이터센터 기대)');
    res = await fetch(url, fetchOpts);
  }
  return res;
}
window._aioFetchClaudeWithRetry = _aioFetchClaudeWithRetry;

function _aioChatError(error, status) {
  var normalized = typeof window._aioSetLastAiError === 'function'
    ? window._aioSetLastAiError(Object.assign({}, (typeof error === 'object' ? error : { message: error }), status ? { status: status } : {}), { source: 'chat' })
    : { userMessage: String(error || 'AI 요청 실패'), nextAction: '잠시 후 다시 시도하세요.' };
  return normalized;
}

async function callClaude(system, messages, onChunk, onDone, onError, opts) {
  var apiKey = getApiKey();
  var routeState = await _aioEnsureClaudeRoute(apiKey);
  var _claudeTarget = routeState.target || _aioClaudeTarget(apiKey);   // v50.52 B5: 서버 키 모드면 개인 키 불요
  if (!routeState.ok) {
    var missingCreds = _aioChatError({ message: routeState.reason, status: routeState.reason === 'NO_ROUTE' || routeState.reason === 'VAULT_LOCKED' ? 401 : 503 });
    onError(window._aioRouteNotice(routeState.reason) || missingCreds.displayMessage || (missingCreds.userMessage + ' ' + missingCreds.nextAction));
    return;
  }
  opts = opts || {};
  var modelCfg = getModelConfig(opts.modelKey);
  var _aiStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // v51.04: systemPrompt + messages 크기 모니터링 + 자동 트리밍 (90K+ 시 oldest 제거, system 보존)
  var _sysLen = (system || '').length;
  var _trimmedMessages = messages.slice();
  var _totalChars = _sysLen + _trimmedMessages.reduce(function(s,m){return s+(m.content||'').length;},0);
  if (_totalChars > 90000 && _trimmedMessages.length > 2) {
    while (_totalChars > 90000 && _trimmedMessages.length > 2) {
      var _oldest = _trimmedMessages.shift();
      _totalChars -= (_oldest.content || '').length;
    }
    _aioLog('warn', 'fetch', '⚠ 프롬프트 자동 트리밍: ' + messages.length + '→' + _trimmedMessages.length + '턴, ' + Math.round(_totalChars/1000) + 'K자');
  }
  console.log('[AIO] callClaude: system=' + Math.round(_sysLen/1000) + 'K + msgs=' + Math.round((_totalChars-_sysLen)/1000) + 'K = ' + Math.round(_totalChars/1000) + 'K자 (' + modelCfg.label + ')');

  // v30.5: AbortController — 연결 30초 + 청크 간 15초 타임아웃
  // v31.3: thinking 모드는 60초 (추론 시간 필요)
  var timeoutMs = modelCfg.thinking ? 60000 : 30000;
  var ctrl = new AbortController();
  var connectTimer = setTimeout(function() { ctrl.abort(); }, timeoutMs);

  // v48.0: 시스템 프롬프트를 정적/동적 2블록으로 분할하여 cache_control 적용
  //   정적 블록: CHAT_CONTEXTS 기본 지시문 + 응답 형식 + 금지 조항 (반복 재사용 → cache hit 시 input -90%)
  //   동적 블록: DATA_SNAPSHOT · _liveData · 뉴스 컨텍스트 · 티커 데이터 (매 요청마다 달라짐)
  //   분할 기준: '【데이터 검증 상태 — 반드시 준수】' 이후를 동적 블록으로 취급
  //   Anthropic 공식: 최소 1024토큰 이상이어야 cache 효력, 미달 시 일반 요청으로 폴백
  var _sysStr = system || '';
  var _systemField;
  var _CACHE_SPLIT_MARKER = '【데이터 검증 상태';
  var _splitIdx = _sysStr.indexOf(_CACHE_SPLIT_MARKER);
  if (_splitIdx > 2000 && _splitIdx < _sysStr.length - 100) {
    // 정적 부분이 최소 길이 이상 + 이후 동적 부분 존재
    var _staticPart = _sysStr.slice(0, _splitIdx);
    var _dynamicPart = _sysStr.slice(_splitIdx);
    _systemField = [
      { type: 'text', text: _staticPart, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: _dynamicPart }
    ];
  } else {
    _systemField = _sysStr;  // 짧거나 마커 없음 → 캐싱 생략
  }
  var reqBody = {
    model: modelCfg.id,
    max_tokens: opts.maxTokens || (modelCfg.thinking ? 16000 : 12000),
    stream: true,
    system: _systemField,
    messages: _trimmedMessages
  };
  // Extended Thinking 설정
  if (modelCfg.thinking) {
    reqBody.thinking = {
      type: 'enabled',
      budget_tokens: modelCfg.thinkingBudget || 5000
    };
  }
  // v49.57 P318: Claude web_search 조건부 활성화 — opts.webSearch === true 일 때만
  if (opts.webSearch === true) {
    reqBody.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
    // 통계 추적
    window._aioWebSearchStats = window._aioWebSearchStats || { calls: 0, lastUsedAt: null };
    window._aioWebSearchStats.calls++;
    window._aioWebSearchStats.lastUsedAt = new Date().toISOString();
    // v50.10: 공유 유료 키 일일 사용량 카운트 (80% 경고/도달 로그는 _bumpApiCounter 기존 동작)
    try { if (typeof _bumpApiCounter === 'function') _bumpApiCounter('claudeWebSearch'); } catch(e) {}
  }

  // v48.8: anthropic-beta 헤더 호환성 — 2024년 11월 이후 prompt caching이 정식 기능으로 승격되어
  //        beta 헤더 없이도 cache_control 필드만으로 동작. 구버전 SDK 호환 위해 헤더는 유지하되
  //        400 에러 시 자동 폴백 (beta 헤더 제거 후 재시도).
  // v50.52 B5: 서버 키 모드면 키 헤더 생략(Worker가 x-api-key/anthropic-version 부여). 직접 호출이면 개인 키.
  var _claudeHeaders = { 'Content-Type': 'application/json' };
  if (!_claudeTarget.serverKey) {
    _claudeHeaders['x-api-key'] = apiKey;
    _claudeHeaders['anthropic-version'] = '2023-06-01';
    _claudeHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    // v52.47 WO-1B: Worker가 env.AIO_APP_TOKEN을 설정했을 때만 실제로 검사(미설정 배포는 무시) —
    // 공개 JS라 진짜 비밀은 아니지만 "URL만 아는" curl/스크립트 남용을 거르는 최소 방어선.
    _claudeHeaders['X-AIO-App-Token'] = _aioAppToken();
  }
  // cache_control 사용 시에만 beta 헤더 포함 (array system field 감지)
  if (Array.isArray(_systemField) && _systemField.some(function(b){ return b.cache_control; })) {
    _claudeHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31';
  }
  try {
    var res = await _aioFetchClaudeWithRetry(_claudeTarget.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: _claudeHeaders,
      body: JSON.stringify(reqBody)
    }, _claudeTarget.serverKey);
    // v48.8: beta 헤더 400 에러 자동 폴백 (서버가 beta를 정식 기능으로 대체한 경우)
    if (res.status === 400 && _claudeHeaders['anthropic-beta']) {
      var _errTxt = await res.text();
      if (/beta|cache.*control|invalid.*header/i.test(_errTxt)) {
        _aioLog('warn', 'fetch', 'anthropic-beta 헤더 호환성 오류 — beta 제거 후 재시도');
        delete _claudeHeaders['anthropic-beta'];
        res = await _aioFetchClaudeWithRetry(_claudeTarget.url, {
          method: 'POST', signal: ctrl.signal, headers: _claudeHeaders, body: JSON.stringify(reqBody)
        }, _claudeTarget.serverKey);
      } else {
        // beta 관련 아닌 400 — 원래 에러 흐름 유지
        var badRequest = _aioChatError({ message: _errTxt.slice(0, 200), status: 400 }, 400);
        onError(badRequest.displayMessage || badRequest.userMessage);
        clearTimeout(connectTimer);
        return;
      }
    }
    clearTimeout(connectTimer);

    if (!res.ok) {
      var errText = await res.text();
      var errMsg = 'API 오류 (' + res.status + ')';
      try {
        var j = JSON.parse(errText);
        var workerAiError = j && j.aioAiError;
        errMsg += ': ' + (workerAiError && workerAiError.rawMessage ? workerAiError.rawMessage : (j.error && j.error.message ? j.error.message : (typeof j.error === 'string' ? j.error : errText.slice(0, 200))));
      } catch(e) { errMsg += ': ' + errText.slice(0, 200); }
      var httpError = _aioChatError({ message: errMsg, status: res.status }, res.status);
      onError(httpError.displayMessage || httpError.userMessage);
      return;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var fullText = '';

    // v50.10: native web_search 인용/검색결과 수집 (사용자 출처 표면화). 요청 시작 시 리셋.
    if (opts.webSearch === true) window._aioLastClaudeCitations = [];
    function _pushWebCite(url, title) {
      if (!url || typeof url !== 'string') return;
      if (!window._aioLastClaudeCitations) window._aioLastClaudeCitations = [];
      var arr = window._aioLastClaudeCitations;
      for (var _ci = 0; _ci < arr.length; _ci++) { if (arr[_ci].url === url) return; }
      if (arr.length >= 12) return;  // 과다 누적 방지
      arr.push({ url: url, title: (title || '') });
    }

    try {
      while (true) {
        // v30.5: 청크 간 15초 타임아웃 — 서버가 멈추면 자동 중단
        // v49.78 C4 P418: T 객체 미정의 가능성 방어 — typeof 체크 + 명시적 15000ms fallback
        var _chunkTimeoutMs = (typeof T !== 'undefined' && T && T.CHUNK_TIMEOUT) ? T.CHUNK_TIMEOUT : 15000;
        var chunkTimer;
        var chunkPromise = Promise.race([
          reader.read(),
          new Promise(function(_, rej) { chunkTimer = setTimeout(function(){ rej(new Error('chunk_timeout')); }, _chunkTimeoutMs); })
        ]);
        var result;
        try { result = await chunkPromise; } finally { clearTimeout(chunkTimer); }
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line.startsWith('data: ')) continue;
          var data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            var evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta) {
              // v31.3: text_delta만 수집 (thinking_delta는 무시 — 사용자에게 불필요)
              if (evt.delta.type === 'text_delta') {
                fullText += evt.delta.text;
                // v48.14 (W12): 50KB 초과 시 truncated 마지막 chunk 보장 + 취소
                if (fullText.length > 50000) {
                  fullText = fullText.slice(0, 50000) + '\n\n[응답이 50,000자를 초과하여 잘렸습니다]';
                  try { onChunk(fullText); } catch(e) {}  // 마지막 truncated 텍스트도 반드시 렌더
                  if (typeof _aioLog === 'function') _aioLog('warn', 'ai', 'response truncated at 50KB', { model: opts && opts.model });
                  try { reader.cancel(); } catch(e) {}
                  break;
                }
                onChunk(fullText);
              }
              // v50.10: web_search 인용 (Claude가 실제 인용한 출처) 수집
              else if (evt.delta.type === 'citations_delta' && evt.delta.citation) {
                _pushWebCite(evt.delta.citation.url, evt.delta.citation.title);
              }
              // thinking_delta는 의도적으로 건너뜀 — 내부 추론 과정이므로 표시하지 않음
            }
            // v50.10: web_search_tool_result 블록 (Claude가 검색해 찾은 결과 목록) 수집
            else if (evt.type === 'content_block_start' && evt.content_block && evt.content_block.type === 'web_search_tool_result') {
              var _wsr = evt.content_block.content;
              if (Array.isArray(_wsr)) {
                for (var _wi = 0; _wi < _wsr.length; _wi++) {
                  if (_wsr[_wi] && _wsr[_wi].url) _pushWebCite(_wsr[_wi].url, _wsr[_wi].title);
                }
              }
            }
            // v48.0: usage 추적 — message_start에는 input/cache_creation/cache_read_input_tokens, message_delta에는 output_tokens
            else if (evt.type === 'message_start' && evt.message && evt.message.usage) {
              window._lastClaudeUsage = Object.assign({}, evt.message.usage);
            }
            else if (evt.type === 'message_delta' && evt.usage) {
              window._lastClaudeUsage = Object.assign(window._lastClaudeUsage || {}, evt.usage);
            }
          } catch(e) {}
        }
      }
      // v48.0: usage 기반 실제 쿼터 정산 + cache hit rate 로그
      if (window._lastClaudeUsage) {
        var _u = window._lastClaudeUsage;
        var _inp = _u.input_tokens || 0;
        var _out = _u.output_tokens || 0;
        var _cacheR = _u.cache_read_input_tokens || 0;
        var _cacheC = _u.cache_creation_input_tokens || 0;
        var _totalInput = _inp + _cacheR + _cacheC;
        var _hitRate = _totalInput > 0 ? Math.round(_cacheR / _totalInput * 100) : 0;
        console.log('[AIO] usage: input=' + _inp + ' / cache_read=' + _cacheR + ' / cache_create=' + _cacheC + ' / output=' + _out + ' / cache-hit=' + _hitRate + '%');
        // 실제 토큰 기반 비용 계산 (modelCfg.inputCostPer1M / outputCostPer1M 필드 존재 시)
        if (typeof _refineQuotaByUsage === 'function') {
          try { _refineQuotaByUsage(modelCfg, _totalInput, _out, _cacheR); } catch(e) {}
        }
        // v49.79 P427/R164: 누적 비용 추적 (AIO.getApiUsage() 조회 가능)
        try {
          if (typeof window._aioTrackApiUsage === 'function') {
            window._aioTrackApiUsage({ model: (modelCfg && modelCfg.key) || selectedModelKey || 'sonnet', inputTokens: _totalInput, outputTokens: _out });
          }
        } catch(_) {}
      }
      if (window.AIO && typeof window.AIO.recordAISLOSample === 'function') {
        var _aiEndedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        var _sloUsage = window._lastClaudeUsage || {};
        window.AIO.recordAISLOSample({
          requestId: window._aioActiveAIRequestId || null,
          entrypoint: opts.entrypoint || 'chat',
          model: (modelCfg && modelCfg.key) || opts.modelKey || 'unknown',
          status: 'success', latencyMs: Math.round(_aiEndedAt - _aiStartedAt),
          inputTokens: (_sloUsage.input_tokens || 0) + (_sloUsage.cache_read_input_tokens || 0) + (_sloUsage.cache_creation_input_tokens || 0),
          outputTokens: _sloUsage.output_tokens || 0
        });
      }
      onDone(fullText);
    } catch(streamErr) {
      try { reader.cancel(); } catch(e) {}
      if (streamErr.message === 'chunk_timeout') {
        if (fullText) onDone(fullText);  // 일부 수신된 텍스트가 있으면 그대로 완료
        else {
          var chunkTimeout = _aioChatError({ message: 'chunk_timeout', status: 408 }, 408);
          onError(chunkTimeout.displayMessage || chunkTimeout.userMessage);
        }
      } else {
        var streamError = _aioChatError({ message: 'stream error: ' + streamErr.message, status: 502 }, 502);
        onError(streamError.displayMessage || streamError.userMessage);
      }
    }
  } catch(err) {
    clearTimeout(connectTimer);
    if (err.name === 'AbortError') {
      var abortError = _aioChatError({ message: 'AbortError timeout', status: 408 }, 408);
      onError(abortError.displayMessage || abortError.userMessage);
    } else {
      var networkError = _aioChatError({ message: 'network error: ' + err.message }, 0);
      onError(networkError.displayMessage || networkError.userMessage);
    }
  }
}

// ── 스크리너 함수 — aio-data.js로 이동됨 (v51.17). window.* 전역 alias ──
// P512: var _SECTOR_KEYWORDS 제거 — aio-data.js const와 충돌해 line 1847 이후 chatSend 등 미실행 (v51.30 수정)
var _detectSectorQuery = window._detectSectorQuery;
var _aioIsBroadRecommendationQuery = window._aioIsBroadRecommendationQuery;
var _aioInferTickerMarket = window._aioInferTickerMarket;
var _aioCapBucket = window._aioCapBucket;
var _aioExtractRecentRecommendationTickers = window._aioExtractRecentRecommendationTickers;
var _aioBuildDiversifiedRecommendationRows = window._aioBuildDiversifiedRecommendationRows;
var _aioRunScreenerQuery = window._aioRunScreenerQuery;
var _formatScreenerResultPrompt = window._formatScreenerResultPrompt;

// FMP API 다중 종목 밸류에이션 일괄 조회 (PER, PBR, 매출성장, FCF Yield, ROE 등)
async function _fetchSectorCompareData(stocks) {
  var fmpKey = _getApiKey('aio_fmp_key') || '';
  var results = [];

  // v47.11: FMP profile 쉼표 구분 배치 호출 — N종목 개별 호출(N회) → 1회 배치
  // 예: /v3/profile/AAPL,MSFT,GOOGL — 응답 배열 순서 보장되지 않으므로 symbol 키로 맵핑
  var profileMap = {};
  if (fmpKey && stocks.length > 1) {
    try {
      var syms = stocks.map(function(s){ return s.sym; }).join(',');
      var urlBatch = 'https://financialmodelingprep.com/api/v3/profile/' + encodeURIComponent(syms) + '?apikey=' + fmpKey;
      var rBatch = await fetchWithTimeout(urlBatch, {}, 8000);
      if (rBatch.ok) {
        var batch = await rBatch.json();
        if (Array.isArray(batch)) batch.forEach(function(p){ if (p && p.symbol) profileMap[p.symbol] = p; });
      }
    } catch(e) { _aioLog('warn', 'fetch', 'FMP profile batch error: ' + e.message); }
  }

  for (var i = 0; i < stocks.length; i++) {
    var s = stocks[i];
    var sym = s.sym;
    var line = { ticker: sym, name: s.name, sector: s.sector, mcap: s.mcap, signal: s.signal, memo: s.memo || '' };

    // _liveData에서 현재가
    var ld = (window._liveData || {})[sym];
    if (ld && ld.price) { line.price = ld.price; line.pct = ld.pct != null ? ld.pct : null; }

    // FMP에서 밸류에이션 + 재무 데이터 (키가 있을 때만)
    if (fmpKey) {
      // 1. Ratios TTM (PER, PBR, PEG, PSR, ROE, ROA, 마진, 부채, 배당, FCF)
      try {
        var url = 'https://financialmodelingprep.com/api/v3/ratios-ttm/' + sym + '?apikey=' + fmpKey;
        var r = await fetchWithTimeout(url, {}, 6000);
        if (r.ok) {
          var d = await r.json();
          if (Array.isArray(d) && d[0]) {
            var rt = d[0];
            line.peRatio = rt.peRatioTTM;
            line.pbRatio = rt.priceToBookRatioTTM;
            line.pegRatio = rt.pegRatioTTM;
            line.psRatio = rt.priceToSalesRatioTTM;
            line.evToEbitda = rt.enterpriseValueOverEBITDATTM;
            line.evToRev = null; // v35.4: evToSales는 key-metrics-ttm에서 별도 조회
            line.roe = rt.returnOnEquityTTM;
            line.roa = rt.returnOnAssetsTTM;
            line.grossMargin = rt.grossProfitMarginTTM;
            line.operatingMargin = rt.operatingProfitMarginTTM;
            line.netMargin = rt.netProfitMarginTTM;
            line.debtEquity = rt.debtEquityRatioTTM;
            line.currentRatio = rt.currentRatioTTM;
            line.dividendYield = rt.dividendYieldTTM;
            line.payoutRatio = rt.payoutRatioTTM;
            line.fcfYield = rt.freeCashFlowPerShareTTM && line.price ? (rt.freeCashFlowPerShareTTM / line.price * 100) : null;
          }
        }
      } catch(e) {}

      // 2. Key Metrics TTM (EV/EBITDA, EV/Revenue, FCF per share 보완)
      try {
        var urlKm = 'https://financialmodelingprep.com/api/v3/key-metrics-ttm/' + sym + '?apikey=' + fmpKey;
        var rKm = await fetchWithTimeout(urlKm, {}, 6000);
        if (rKm.ok) {
          var km = await rKm.json();
          if (Array.isArray(km) && km[0]) {
            var k = km[0];
            if (!line.evToEbitda && k.enterpriseValueOverEBITDATTM) line.evToEbitda = k.enterpriseValueOverEBITDATTM;
            if (k.evToSalesTTM) line.evToRev = k.evToSalesTTM; // v35.4: 정확한 EV/Sales
            line.revenuePerShare = k.revenuePerShareTTM;
            line.netIncomePerShare = k.netIncomePerShareTTM;
            line.bookValuePerShare = k.bookValuePerShareTTM;
            line.fcfPerShare = k.freeCashFlowPerShareTTM;
            if (k.marketCapTTM) line.mcapLive = k.marketCapTTM;
          }
        }
      } catch(e) {}

      // 3. Income Statement (최근 2년 → 매출성장률 + EPS성장률 + 분기 실적)
      try {
        var urlInc = 'https://financialmodelingprep.com/api/v3/income-statement/' + sym + '?limit=3&apikey=' + fmpKey;
        var rInc = await fetchWithTimeout(urlInc, {}, 6000);
        if (rInc.ok) {
          var inc = await rInc.json();
          if (Array.isArray(inc) && inc.length >= 2 && inc[1].revenue > 0) {
            line.revGrowth = ((inc[0].revenue - inc[1].revenue) / inc[1].revenue * 100);
            line.latestRev = inc[0].revenue;
            line.latestEps = inc[0].epsdiluted;
            line.latestEbitda = inc[0].ebitda;
            if (inc[1].epsdiluted && inc[1].epsdiluted > 0) {
              line.epsGrowth = ((inc[0].epsdiluted - inc[1].epsdiluted) / Math.abs(inc[1].epsdiluted) * 100);
            }
            // 2개년 매출 CAGR (inc[0] vs inc[2] = 2년 간격)
            if (inc.length >= 3 && inc[2].revenue > 0 && inc[0].revenue > 0) {
              line.rev2yCagr = (Math.pow(inc[0].revenue / inc[2].revenue, 0.5) - 1) * 100;
            }
          }
        }
      } catch(e) {}

      // 4. Profile (52주 고저, 베타, 산업분류)
      // v47.11: profileMap(배치 결과) 우선 사용 — 없을 때만 개별 호출 폴백
      if (profileMap[sym]) {
        var pB = profileMap[sym];
        line.range52w = pB.range;
        line.beta = pB.beta;
        line.industry = pB.industry;
        line.employees = pB.fullTimeEmployees;
        if (!line.price && pB.price) { line.price = pB.price; line.pct = pB.changes; }
        if (pB.mktCap) line.mcapLive = pB.mktCap;
      } else {
        try {
          var urlProf = 'https://financialmodelingprep.com/api/v3/profile/' + sym + '?apikey=' + fmpKey;
          var rProf = await fetchWithTimeout(urlProf, {}, 6000);
          if (rProf.ok) {
            var prof = await rProf.json();
            if (Array.isArray(prof) && prof[0]) {
              var p = prof[0];
              line.range52w = p.range;
              line.beta = p.beta;
              line.industry = p.industry;
              line.employees = p.fullTimeEmployees;
              if (!line.price && p.price) { line.price = p.price; line.pct = p.changes; }
              if (p.mktCap) line.mcapLive = p.mktCap;
            }
          }
        } catch(e) {}
      }

      // 5. Analyst Consensus (목표가, 추천 등급)
      try {
        var urlAn = 'https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/' + sym + '?limit=1&apikey=' + fmpKey;
        var rAn = await fetchWithTimeout(urlAn, {}, 6000);
        if (rAn.ok) {
          var an = await rAn.json();
          if (Array.isArray(an) && an[0]) {
            line.analystBuy = an[0].analystRatingsbuy || 0;
            line.analystHold = an[0].analystRatingsHold || 0;
            line.analystSell = an[0].analystRatingsSell || 0;
            line.analystStrong = an[0].analystRatingsStrongBuy || 0;
          }
        }
      } catch(e) {}

      try {
        var urlTgt = 'https://financialmodelingprep.com/api/v3/price-target-consensus/' + sym + '?apikey=' + fmpKey;
        var rTgt = await fetchWithTimeout(urlTgt, {}, 6000);
        if (rTgt.ok) {
          var tgt = await rTgt.json();
          if (Array.isArray(tgt) && tgt[0]) {
            line.targetHigh = tgt[0].targetHigh;
            line.targetLow = tgt[0].targetLow;
            line.targetConsensus = tgt[0].targetConsensus;
            if (line.price && line.targetConsensus) {
              line.upside = ((line.targetConsensus - line.price) / line.price * 100);
            }
          }
        }
      } catch(e) {}
    }
    // v41.9: Naver 컨센서스/한국어명 보충
    try {
      var naverD = await fetchNaverUSData(sym, false);
      if (naverD) {
        if (naverD.nameKr) line.nameKr = naverD.nameKr;
        if (naverD.industryKr) line.industryKr = naverD.industryKr;
        if (naverD.consensus) {
          line.naverTarget = naverD.consensus.targetMean;
          line.naverTargetHigh = naverD.consensus.targetHigh;
          line.naverTargetLow = naverD.consensus.targetLow;
          line.naverRecomm = naverD.consensus.recommMean;
        }
      }
    } catch(e) {}
    results.push(line);
  }
  return results;
}

// 비교 데이터를 프롬프트 문자열로 포맷 (v34.2 확장: 섹터 평균 + 순위 + 풍부한 데이터)
function _formatSectorComparePrompt(sectorLabel, compareData) {
  if (!compareData || compareData.length === 0) return '';
  var _f = function(v, dec) { return v != null && !isNaN(v) ? Number(v).toFixed(dec || 1) : 'N/A'; };
  var _fm = function(v) { if (!v) return 'N/A'; if (v >= 1e12) return '$' + (v/1e12).toFixed(1) + 'T'; if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B'; if (v >= 1e6) return '$' + (v/1e6).toFixed(0) + 'M'; return '$' + v; };
  var _pct = function(v) { return v != null && !isNaN(v) ? (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%' : 'N/A'; };

  // 섹터 평균 계산
  function _avg(arr, key, mult) {
    var vals = arr.map(function(d) { var v = d[key]; return (mult && v != null) ? v * mult : v; }).filter(function(v) { return v != null && !isNaN(v); });
    return vals.length > 0 ? vals.reduce(function(a,b){return a+b;},0) / vals.length : null;
  }
  var avgPE = _avg(compareData, 'peRatio');
  var avgPB = _avg(compareData, 'pbRatio');
  var avgPEG = _avg(compareData, 'pegRatio');
  var avgEVE = _avg(compareData, 'evToEbitda');
  var avgROE = _avg(compareData, 'roe', 100);
  var avgNetM = _avg(compareData, 'netMargin', 100);
  var avgRevG = _avg(compareData, 'revGrowth');
  var avgFCFY = _avg(compareData, 'fcfYield');

  var lines = [];
  lines.push('═══════════════════════════════════════════════════');
  lines.push('【섹터 비교 분석 — "' + sectorLabel + '" 관련 주요 종목 실시간 밸류에이션】');
  lines.push('FMP API + Yahoo Finance 실시간 조회 데이터. 학습 데이터의 과거 수치 사용 금지.');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  // 섹터 평균 요약
  lines.push('--- 섹터 평균 (비교 기준선) ---');
  lines.push('PER: ' + _f(avgPE) + 'x | PBR: ' + _f(avgPB) + 'x | PEG: ' + _f(avgPEG) + ' | EV/EBITDA: ' + _f(avgEVE) + 'x');
  lines.push('ROE: ' + _f(avgROE) + '% | 순이익률: ' + _f(avgNetM) + '% | 매출성장: ' + _f(avgRevG) + '% | FCF Yield: ' + _f(avgFCFY) + '%');
  lines.push('');

  compareData.forEach(function(d, idx) {
    var mcapStr = d.mcapLive ? _fm(d.mcapLive) : (d.mcap ? '$' + d.mcap + 'B' : 'N/A');
    lines.push('──────────────────────────────────');
    lines.push((idx+1) + '. ' + d.ticker + ' (' + d.name + (d.nameKr ? ' / ' + d.nameKr : '') + ')');
    lines.push('   산업: ' + (d.industry || d.sector) + (d.industryKr ? ' (' + d.industryKr + ')' : '') + ' | 시그널: ' + (d.signal||'N/A') + ' | 직원: ' + (d.employees ? Number(d.employees).toLocaleString() + '명' : 'N/A'));
    if (d.memo) lines.push('   참고: ' + d.memo);
    lines.push('');

    // 가격 & 시가총액
    lines.push('   현재가: ' + (d.price ? '$' + _f(d.price,2) : 'N/A') + ' (' + (d.pct != null ? _pct(d.pct) : 'N/A') + ') | 시가총액: ' + mcapStr);
    if (d.range52w) lines.push('   52주 범위: ' + d.range52w + (d.beta ? ' | 베타: ' + _f(d.beta,2) : ''));
    lines.push('');

    // 밸류에이션
    lines.push('   [밸류에이션]');
    lines.push('   PER: ' + _f(d.peRatio) + 'x' + (avgPE && d.peRatio ? (d.peRatio < avgPE ? ' (평균↓)' : ' (평균↑)') : '') +
               ' | PBR: ' + _f(d.pbRatio) + 'x | PEG: ' + _f(d.pegRatio) + ' | PSR: ' + _f(d.psRatio) + 'x');
    lines.push('   EV/EBITDA: ' + _f(d.evToEbitda) + 'x' + (avgEVE && d.evToEbitda ? (d.evToEbitda < avgEVE ? ' (평균↓)' : ' (평균↑)') : ''));
    lines.push('');

    // 수익성
    lines.push('   [수익성]');
    lines.push('   ROE: ' + _f(d.roe ? d.roe*100 : null) + '% | ROA: ' + _f(d.roa ? d.roa*100 : null) + '%');
    lines.push('   총이익률: ' + _f(d.grossMargin ? d.grossMargin*100 : null) + '% | 영업이익률: ' + _f(d.operatingMargin ? d.operatingMargin*100 : null) + '% | 순이익률: ' + _f(d.netMargin ? d.netMargin*100 : null) + '%');
    lines.push('');

    // 성장
    lines.push('   [성장]');
    lines.push('   매출성장(YoY): ' + _pct(d.revGrowth) + (d.rev2yCagr != null ? ' | 매출 2Y CAGR: ' + _pct(d.rev2yCagr) : ''));
    lines.push('   EPS성장(YoY): ' + _pct(d.epsGrowth) + ' | 최근EPS: ' + (d.latestEps != null ? '$' + _f(d.latestEps,2) : 'N/A'));
    lines.push('   최근매출: ' + _fm(d.latestRev) + (d.latestEbitda ? ' | EBITDA: ' + _fm(d.latestEbitda) : ''));
    lines.push('');

    // 재무건전성
    lines.push('   [재무건전성 & 주주환원]');
    lines.push('   부채비율: ' + _f(d.debtEquity) + ' | 유동비율: ' + _f(d.currentRatio) +
               ' | 배당수익률: ' + _f(d.dividendYield ? d.dividendYield*100 : null) + '% | 배당성향: ' + _f(d.payoutRatio ? d.payoutRatio*100 : null) + '%');
    lines.push('   FCF Yield: ' + _f(d.fcfYield) + '%' + (d.fcfPerShare ? ' | FCF/주: $' + _f(d.fcfPerShare,2) : ''));
    lines.push('');

    // 애널리스트
    if (d.targetConsensus || d.analystBuy) {
      lines.push('   [애널리스트]');
      if (d.targetConsensus) {
        lines.push('   목표가: $' + _f(d.targetConsensus,2) + ' (범위: $' + _f(d.targetLow,2) + '~$' + _f(d.targetHigh,2) + ') | 업사이드: ' + _pct(d.upside));
      }
      if (d.analystBuy != null) {
        var total = (d.analystStrong||0) + (d.analystBuy||0) + (d.analystHold||0) + (d.analystSell||0);
        lines.push('   추천: Strong Buy ' + (d.analystStrong||0) + ' / Buy ' + (d.analystBuy||0) + ' / Hold ' + (d.analystHold||0) + ' / Sell ' + (d.analystSell||0) + (total ? ' (총 ' + total + '명)' : ''));
      }
      // v41.9: Naver 컨센서스 교차 검증
      if (d.naverTarget) {
        lines.push('   [Naver 컨센서스] 목표가: $' + _f(d.naverTarget,2) + ' ($' + _f(d.naverTargetLow,2) + '~$' + _f(d.naverTargetHigh,2) + ') | 추천: ' + _f(d.naverRecomm,2) + '/5');
      }
      lines.push('');
    }
  });

  // 밸류에이션 순위
  lines.push('──────────────────────────────────');
  lines.push('--- 밸류에이션 순위 (낮을수록 "싼" 종목) ---');
  var ranked = compareData.filter(function(d) { return d.peRatio != null && d.peRatio > 0; }).sort(function(a,b) { return a.peRatio - b.peRatio; });
  if (ranked.length > 0) {
    lines.push('PER 순위: ' + ranked.map(function(d,i) { return (i+1) + '.' + d.ticker + '(' + _f(d.peRatio) + 'x)'; }).join(' > '));
  }
  var rankedPEG = compareData.filter(function(d) { return d.pegRatio != null && d.pegRatio > 0; }).sort(function(a,b) { return a.pegRatio - b.pegRatio; });
  if (rankedPEG.length > 0) {
    lines.push('PEG 순위: ' + rankedPEG.map(function(d,i) { return (i+1) + '.' + d.ticker + '(' + _f(d.pegRatio) + ')'; }).join(' > '));
  }
  var rankedEVE = compareData.filter(function(d) { return d.evToEbitda != null && d.evToEbitda > 0; }).sort(function(a,b) { return a.evToEbitda - b.evToEbitda; });
  if (rankedEVE.length > 0) {
    lines.push('EV/EBITDA 순위: ' + rankedEVE.map(function(d,i) { return (i+1) + '.' + d.ticker + '(' + _f(d.evToEbitda) + 'x)'; }).join(' > '));
  }
  var rankedUpside = compareData.filter(function(d) { return d.upside != null; }).sort(function(a,b) { return b.upside - a.upside; });
  if (rankedUpside.length > 0) {
    lines.push('업사이드 순위: ' + rankedUpside.map(function(d,i) { return (i+1) + '.' + d.ticker + '(' + _pct(d.upside) + ')'; }).join(' > '));
  }
  lines.push('');

  lines.push('분석 지침:');
  lines.push('  — 위 실시간 데이터를 반드시 인용하여 종목 간 비교 분석하라.');
  lines.push('  — "섹터 평균"과 각 종목 수치를 대조하여 상대적 위치를 평가할 것.');
  lines.push('  — 밸류에이션(PER/PEG/EV/EBITDA) + 수익성(ROE/마진) + 성장(매출/EPS) + 건전성(부채) + 애널리스트 목표가를 종합적으로 교차 검증.');
  lines.push('  — PER/PBR이 낮다고 무조건 저평가 아님: 밸류 트랩(성장 정체, 구조적 문제) 가능성 반드시 언급.');
  lines.push('  — 최종 추천 시 "왜 이 종목인지" 다차원 근거(밸류+성장+수익성+모멘텀) 제시.');
  lines.push('  — "N/A"인 항목은 데이터 미수집 — "확인 필요"로 표기.');

  return '\n\n' + lines.join('\n') + '\n';
}

// ── v30.15: 사용자 질문에서 티커 자동 감지 + 실시간 데이터 주입 ─────
function _extractTickers(text) {
  // 1. 명시적 US 티커 패턴: 대문자 1~5글자 (단독 또는 $ 접두사)
  var tickers = [];
  var seen = {};
  // $AAPL 형식
  var m1 = text.match(/\$([A-Z]{1,5})\b/g);
  if (m1) m1.forEach(function(t) { var s = t.slice(1); if (!seen[s]) { seen[s]=1; tickers.push(s); } });
  // 대문자 티커 (2~5글자, 문장 내에서 독립적으로 등장)
  var m2 = text.match(/\b([A-Z]{2,5})\b/g);
  var skipWords = {'AI':1,'OR':1,'AM':1,'AT':1,'BE':1,'BY':1,'DO':1,'GO':1,'IF':1,'IN':1,'IS':1,'IT':1,'MY':1,'NO':1,'OF':1,'ON':1,'SO':1,'TO':1,'UP':1,'US':1,'WE':1,
    'ALL':1,'AND':1,'ARE':1,'BUT':1,'CAN':1,'DID':1,'FOR':1,'GET':1,'GOT':1,'HAS':1,'HAD':1,'HER':1,'HIM':1,'HIS':1,'HOW':1,'ITS':1,'LET':1,'MAY':1,'NEW':1,'NOT':1,'NOW':1,'OLD':1,'ONE':1,'OUR':1,'OUT':1,'OWN':1,'RUN':1,'SAY':1,'SET':1,'SHE':1,'THE':1,'TOO':1,'TRY':1,'TWO':1,'USE':1,'WAY':1,'WHO':1,'WHY':1,'WIN':1,'WON':1,'YES':1,'YET':1,'YOU':1,
    'ALSO':1,'BEEN':1,'BEST':1,'BOTH':1,'BULL':1,'BEAR':1,'CALL':1,'COME':1,'EACH':1,'FROM':1,'GOOD':1,'HAVE':1,'HERE':1,'HIGH':1,'JUST':1,'KNOW':1,'LAST':1,'LIKE':1,'LONG':1,'LOOK':1,'MADE':1,'MAKE':1,'MORE':1,'MOST':1,'MUCH':1,'MUST':1,'NEED':1,'NEXT':1,'ONLY':1,'OVER':1,'SELL':1,'SOME':1,'SUCH':1,'TAKE':1,'TELL':1,'THAN':1,'THAT':1,'THEM':1,'THEN':1,'THEY':1,'THIS':1,'TIME':1,'VERY':1,'WANT':1,'WEEK':1,'WELL':1,'WENT':1,'WERE':1,'WHAT':1,'WHEN':1,'WILL':1,'WITH':1,'WORK':1,'YOUR':1,
    'ABOUT':1,'AFTER':1,'COULD':1,'EVERY':1,'FIRST':1,'GREAT':1,'OTHER':1,'SHORT':1,'SINCE':1,'STILL':1,'THEIR':1,'THERE':1,'THESE':1,'THINK':1,'THOSE':1,'THREE':1,'TODAY':1,'UNDER':1,'WHERE':1,'WHICH':1,'WHILE':1,'WOULD':1,
    'ETF':1,'IPO':1,'RSI':1,'MACD':1,'VIX':1,'ATR':1,'EMA':1,'SMA':1,'VCP':1,'SEPA':1,'VWAP':1,'FOMC':1,'GDP':1,'CPI':1,'PPI':1,'NFP':1,'PCE':1,'PMI':1,'ISM':1,'YOY':1,'MOM':1,'QOQ':1,'EPS':1,'PER':1,'PBR':1,'ROE':1,'ROA':1,'FCF':1,'DCF':1,'DDM':1,'NAV':1,'PEG':1,'FFR':1,'QE':1,'QT':1};
  if (m2) m2.forEach(function(t) { if (!seen[t] && !skipWords[t]) { seen[t]=1; tickers.push(t); } });
  // 한국 종목코드 (6자리 숫자)
  var m3 = text.match(/\b(\d{6})\b/g);
  if (m3) m3.forEach(function(c) { var s = c + '.KS'; if (!seen[s]) { seen[s]=1; tickers.push(s); } });
  return tickers.slice(0, 5); // v34.4: 최대 5개 (기본 데이터), 심층 비교는 chatSend에서 3개로 재제한
}

// v48.11: 주가 추이 자동 분석 — 5D/20D/3M 변동 + 추세 라벨 + 52주 위치
// Yahoo chart range=3mo 1회 호출로 추세 전환 감지용 핵심 지표 산출.
// "긍정 뉴스 + 하락 추세" 같은 시간 불일치 상황을 AI가 반드시 인식하도록 프롬프트에 주입.
async function _fetchTickerTrend(ticker) {
  try {
    // window._tickerTrendCache 10분 TTL
    if (!window._tickerTrendCache) window._tickerTrendCache = {};
    var c = window._tickerTrendCache[ticker];
    if (c && (Date.now() - c._ts < 600000)) return c.text;
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=3mo';
    var r;
    try { r = await fetchViaProxy(url, 6000); } catch(e) { return null; }
    if (!r || !r.ok) return null;
    var d = await r.json();
    var result = d && d.chart && d.chart.result && d.chart.result[0];
    if (!result) return null;
    var closes = ((result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || []).filter(function(v){ return v != null && !isNaN(v); });
    if (closes.length < 20) return null;
    var now = closes[closes.length - 1];
    var d5 = closes[Math.max(0, closes.length - 6)];
    var d20 = closes[Math.max(0, closes.length - 21)];
    var d60 = closes[0];
    var pct5 = ((now - d5) / d5) * 100;
    var pct20 = ((now - d20) / d20) * 100;
    var pct60 = ((now - d60) / d60) * 100;
    // 추세 라벨 — 5D/20D 조합으로 전환 상황 식별
    var label;
    if (pct5 > 2 && pct20 > 5) label = '단기·중기 상승 추세';
    else if (pct5 > 2 && pct20 < -3) label = '반등 초기 (중기는 하락)';
    else if (pct5 < -2 && pct20 < -5) label = '단기·중기 하락 추세';
    else if (pct5 < -2 && pct20 > 3) label = '조정 중 (중기는 상승)';
    else if (Math.abs(pct5) < 2 && Math.abs(pct20) < 3) label = '횡보';
    else if (pct20 > 10) label = '강세 유지';
    else if (pct20 < -10) label = '약세 지속';
    else label = '혼조';
    // 52주 위치 (3개월 범위 기준 근사치)
    var hi = Math.max.apply(null, closes);
    var lo = Math.min.apply(null, closes);
    var pos = hi > lo ? Math.round(((now - lo) / (hi - lo)) * 100) : 50;
    var text = label + ' (5D ' + (pct5>=0?'+':'') + pct5.toFixed(1) + '% · 20D ' + (pct20>=0?'+':'') + pct20.toFixed(1) + '% · 3M ' + (pct60>=0?'+':'') + pct60.toFixed(1) + '% · 3M 범위 ' + pos + '% 위치)';
    window._tickerTrendCache[ticker] = { text: text, _ts: Date.now() };
    return text;
  } catch(e) { return null; }
}

// ─────────────────────────────────────────────────────────────────
// v49.58 P321 R107 신규: _withTimeout — promise를 N ms 후 강제 fallback
// 채팅 fetch가 hang 시 응답 30초+ 지연 차단. 11 fetch 모두 graceful degradation.
// 사용: _withTimeout(promise, 2500, null) — 2.5초 내 미해결 시 null 반환
// ─────────────────────────────────────────────────────────────────
function _withTimeout(promise, ms, fallback) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(fallback);
  var waitMs = ms == null ? 2500 : Math.max(0, Number(ms) || 0);
  var to;
  var timeoutPromise = new Promise(function(resolve) {
    to = setTimeout(function() { resolve(fallback); }, waitMs);
  });
  return Promise.race([
    promise.then(function(v) { clearTimeout(to); return v; }).catch(function() { clearTimeout(to); return fallback; }),
    timeoutPromise
  ]);
}
window._withTimeout = _withTimeout;

// v49.66 P350 R121: _chatTickerCache 통계 — hit/miss/eviction/size 가시화
window.AIO = window.AIO || {};
window.AIO.getChatTickerCacheStats = function() {
  var c = window._chatTickerCache || {};
  var s = window._chatTickerCacheStats || { hits: 0, misses: 0, evictions: 0 };
  var size = Object.keys(c).length;
  var total = s.hits + s.misses;
  var hitRate = total > 0 ? Math.round(s.hits / total * 100) : 0;
  return {
    size: size,
    maxSize: 50,
    ttlMinutes: 5,
    hits: s.hits,
    misses: s.misses,
    evictions: s.evictions,
    totalLookups: total,
    hitRatePct: hitRate,
    cachedTickers: Object.keys(c).sort(),
    generatedAt: new Date().toISOString()
  };
};

// v50.9 R116/R117: 저신뢰(고위험) 자동데이터 관점 통합 고지 헬퍼 — 모듈 최상위 정의(캐시-hit 답변에도 안정 적용).
// 리스트는 하드코딩 금지 — AIO_ANALYSIS_FRAMEWORK_REGISTRY.highRiskFields(true)(aio-core.js)에서 동적 생성.
window._aioLowConfPerspectives = window._aioLowConfPerspectives || function() {
  try {
    var reg = window.AIO_ANALYSIS_FRAMEWORK_REGISTRY;
    if (!reg || typeof reg.highRiskFields !== 'function') return null;
    var labels = reg.highRiskFields(true).map(function(k){ return (reg.fields[k] && reg.fields[k].label) || k; });
    if (!labels.length) return null;
    return {
      labels: labels,
      promptLine: '⚠️ [저신뢰 자동데이터 관점 — 수동확인 권장] ' + labels.join(' · ') + ' : 이 관점들은 placeholder/정적테이블/휴리스틱/연차필링 기반이므로 단정 금지. 답변에 "저신뢰 · 외부 직접확인 권장"을 반드시 명시 (R116/R117).',
      badge: '🔸 고급 분석(' + labels.slice(0, 4).join('·') + ' 등)은 자동데이터 한계로 <b>저신뢰</b> — 수동 확인 권장'
    };
  } catch (_) { return null; }
};

// v50.12: 기술적 분석 채팅용 종목별 실측 기술지표 fetch — 기존 엔진 재사용(fetchOHLCVWithFallback + calcTechnicalSnapshot + calcExtensionHeat).
// technical/signal/ticker 컨텍스트에서 RSI/MACD/MA정배열/추세/Weinstein Stage/ATR 이격/확장도를 주입 (방법론만 있고 종목별 데이터 없던 갭 해소).
async function _fetchTechnicalDataForChat(tickers, opts) {
  if (!tickers || !tickers.length) return '';
  opts = opts || {};
  var fetcher = window.fetchOHLCVWithFallback || window.fetchOHLCV;
  var calc = window.calcTechnicalSnapshot;
  if (typeof fetcher !== 'function' || typeof calc !== 'function') return '';
  var list = tickers.slice(0, 3);
  // 병렬 OHLCV fetch (종목별 6s timeout) — 순차 대기 방지
  var settled = await Promise.all(list.map(function(t) {
    var p = Promise.resolve(fetcher(t, '1day', 260)).catch(function(){ return null; });
    return (typeof _withTimeout === 'function') ? _withTimeout(p, 6000, null) : p;
  }));
  var blocks = [];
  for (var i = 0; i < list.length; i++) {
    var t = list[i], snap = null;
    try {
      var ohlcv = settled[i];
      if (ohlcv && ohlcv.length) snap = calc(ohlcv);
    } catch (_) { snap = null; }
    if (!snap || !snap.ok) {
      blocks.push('━━ [' + t + ' 기술적 데이터] ━━\n❌ OHLCV 미수신 — 실시간 기술지표 계산 불가. 추측 금지, "기술 데이터 수신 대기"로 답하라.');
      continue;
    }
    // v50.38 트랙1b: snapshot stash — chatSend onDone가 초보자 "차트 읽기" 카드 렌더에 재사용 (재계산 회피)
    try { window._aioLastTechSnap = window._aioLastTechSnap || {}; window._aioLastTechSnap[t] = { snap: snap, ts: Date.now() }; } catch(_) {}
    var ext = window.calcExtensionHeat ? window.calcExtensionHeat(snap) : null;
    var f = function(v, d) { return (v != null && !isNaN(v)) ? Number(v).toFixed(d == null ? 2 : d) : 'N/A'; };
    var q = settled[i] && settled[i].dataQuality ? settled[i].dataQuality : null;
    var qLine = q ? ('• 데이터 품질: ' + (q.label || q.confidence || 'UNKNOWN') + ' · source ' + (q.source || 'unknown') + (q.rows != null ? ' · rows ' + q.rows : '') + (q.timestamp ? ' · fetched ' + new Date(q.timestamp).toISOString() : '') + '\n') : '';
    var maAlign = snap.fullMAState === 'FULL_BULL_STACK_5_10_20_50_100_200' ? '완전 정배열(5>10>20>50>100>200)' :
                  snap.fullMAState === 'FULL_BEAR_STACK_5_10_20_50_100_200' ? '완전 역배열(5<10<20<50<100<200)' :
                  snap.shortMAState === 'SHORT_BULL_STACK_5_10_20' && snap.longMAState === 'LONG_BULL_STACK_50_100_200' ? '단기·장기 정배열' :
                  snap.shortMAState === 'SHORT_BULL_STACK_5_10_20' ? '단기 정배열 / 장기 확인 필요' :
                  snap.longMAState === 'LONG_BULL_STACK_50_100_200' ? '장기 정배열 / 단기 혼조' :
                  (snap.above50SMA === false) ? '50일선 이탈(추세 훼손)' : '혼조';
    var stageKr = snap.stageEstimate === 'STAGE_2_ADVANCE' ? 'Stage 2(상승추세·매수 국면)' :
                  snap.stageEstimate === 'STAGE_4_OR_BASE_REPAIR' ? 'Stage 4 또는 바닥 다지기(회피/관망)' : 'Stage 1/3 전환 구간';
    var hi20 = snap.recentHigh20, lo20 = snap.recentLow20;
    var posVs20 = (hi20 && lo20 && hi20 > lo20) ? Math.round((snap.price - lo20) / (hi20 - lo20) * 100) : null;
    var lines = '━━ [' + t + ' 기술적 데이터 · OHLCV ' + snap.bars + '봉 일봉 실측] ━━\n';
    lines += '• 종가 $' + f(snap.price) + ' (' + (snap.dayGainPct >= 0 ? '+' : '') + f(snap.dayGainPct) + '%) · RSI(14) ' + f(snap.rsi14, 1) + (snap.rsi14 >= 70 ? ' 과매수' : snap.rsi14 <= 30 ? ' 과매도' : ' 중립') + '\n';
    lines += '• 이동평균: 5SMA ' + f(snap.sma5) + ' · 10SMA ' + f(snap.sma10) + ' · 20SMA ' + f(snap.sma20) + ' · 50SMA ' + f(snap.sma50) + ' · 100SMA ' + f(snap.sma100) + ' · 200SMA ' + f(snap.sma200) + ' → ' + maAlign + ' (배열점수 ' + (snap.maStackScore != null ? snap.maStackScore : 'N/A') + '/100)\n';
    lines += '• 추세/Stage: ' + snap.trendState + ' · ' + stageKr + '\n';
    lines += '• 50SMA 이격 ' + (snap.dist50Atr != null ? f(snap.dist50Atr, 1) + ' ATR' : 'N/A') + ' · 20SMA 이격 ' + (snap.dist20Atr != null ? f(snap.dist20Atr, 1) + ' ATR' : 'N/A') + ' · ATR(14) $' + f(snap.atr14) + '\n';
    lines += '• MACD 히스토그램 ' + (snap.macd && snap.macd.hist != null ? f(snap.macd.hist) + (snap.macd.hist > 0 ? ' 상승모멘텀' : ' 하락모멘텀') : 'N/A') + ' · 볼린저 ' + (snap.bbReentry ? '상단 재진입(소진주의)' : snap.bbOutsideUpper ? '상단 돌파' : '밴드 내') + ' · RVOL20 ' + f(snap.rvol20, 1) + 'x\n';
    lines += '• 20일 고/저 $' + f(snap.recentHigh20) + '/$' + f(snap.recentLow20) + (posVs20 != null ? ' (레인지 ' + posVs20 + '% 위치)' : '') + ' · 50일 고/저 $' + f(snap.recentHigh50) + '/$' + f(snap.recentLow50) + '\n';
    if (snap.vcp) {
      var vcpLabel = snap.vcpStage === 'breakout' ? '돌파' : snap.vcpStage === 'near_pivot' ? '피벗 근접' : snap.vcpStage === 'contracting' ? '수축 진행' : snap.vcpStage === 'basing' ? '베이스' : snap.vcpStage === 'stage2_only' ? 'Stage2 단독' : snap.vcpStage === 'not_stage2' ? 'Stage2 미충족' : '데이터 부족';
      lines += '• VCP: ' + vcpLabel + ' · 점수 ' + (snap.vcpScore != null ? snap.vcpScore : 'N/A') + '/100' + (snap.vcpPivot ? ' · 피벗 $' + f(snap.vcpPivot) : '') + (snap.vcp.volumeDrying ? ' · 거래량 고갈 확인' : '') + '\n';
    }
    if (snap.fibNearest || snap.volProfile) {
      var fibLine = snap.fibNearest ? (snap.fibNearest.label + ' $' + f(snap.fibNearest.price) + ' (' + (snap.fibNearest.distPct >= 0 ? '+' : '') + f(snap.fibNearest.distPct, 1) + '%)') : 'N/A';
      var vp = snap.volProfile || {};
      var va = vp.valueArea ? ('$' + f(vp.valueArea.lo) + '~$' + f(vp.valueArea.hi)) : 'N/A';
      var vpLine = (vp.poc ? 'POC $' + f(vp.poc.mid) : 'POC N/A') + ' · VA ' + va +
        (vp.nearestResistance ? ' · 위 매물 $' + f(vp.nearestResistance.mid) : '') +
        (vp.nearestSupport ? ' · 아래 방어 $' + f(vp.nearestSupport.mid) : '');
      lines += '• 피보나치/매물대: 근접 Fib ' + fibLine + ' · ' + vpLine + '\n';
    }
    if (snap.rsiDiv || snap.weeklyCtx) {
      var divSignal = snap.rsiDivSignal || (snap.rsiDiv && snap.rsiDiv.signal) || 'none';
      var divLabel = divSignal === 'bullish' ? '강세(가격LL+RSIHL)' : divSignal === 'bearish' ? '약세(가격HH+RSILH)' : divSignal === 'hidden_bullish' ? '히든강세(가격HL+RSILL)' : divSignal === 'hidden_bearish' ? '히든약세(가격LH+RSIHH)' : '없음';
      var wc = snap.weeklyCtx || {};
      var wClose = wc.wClose != null ? wc.wClose : wc.lastWeekClose;
      var wRsi = wc.wRsi14 != null ? wc.wRsi14 : wc.wRsi;
      var wTrendLabel = wc.wTrend === 'bullish' ? '주봉 상승' : wc.wTrend === 'bearish' ? '주봉 하락' : '주봉 혼조/부족';
      lines += '• RSI 다이버전스: ' + divLabel + ' · 주봉 컨텍스트: ' + wTrendLabel + (wClose != null ? ' 종가 $' + f(wClose) : '') + (wc.wSma20 != null ? ' / W20 $' + f(wc.wSma20) : '') + (wc.wSma50 != null ? ' / W50 $' + f(wc.wSma50) : '') + (wRsi != null ? ' / W-RSI ' + f(wRsi, 1) : '') + '\n';
    }
    if (ext) lines += '• 확장도(Blow-off Risk): ' + ext.state + ' (' + ext.score + '/100' + (ext.flags && ext.flags.length ? ', ' + ext.flags.slice(0, 3).join('/') : '') + ')\n';
    lines += qLine;
    lines += '※ 위는 라이브 OHLCV 실측 계산값. 피봇/손절/목표는 이 수치 기준으로 제시하고 학습데이터 추측 금지.';
    blocks.push(lines);
  }
  if (!blocks.length) return '';
  var scope = opts.autoMarket ? '시장 대표 차트' : '종목';
  return '\n\n【' + scope + ' 기술적 실측 데이터 (calcTechnicalSnapshot — 라이브 OHLCV)】\n' + blocks.join('\n\n') + '\n';
}

function _aioTechnicalSymbolsForChat(ctxId, query, detectedTickers) {
  if (Array.isArray(detectedTickers) && detectedTickers.length) return detectedTickers.slice(0, 3);
  var q = String(query || '').toLowerCase();
  var intent = (typeof _classifyChatIntent === 'function') ? _classifyChatIntent(query, ctxId) : { intents: [] };
  var wantsTechnical = ctxId === 'technical' || ctxId === 'signal' || ctxId === 'ticker' || ctxId === 'kr-tech' || ctxId === 'kr-technical' ||
    (intent.intents || []).indexOf('TECHNICAL_SETUP') >= 0 ||
    /차트|기술|rsi|macd|atr|이동평균|지지|저항|돌파|추세|technical|chart|setup|support|resistance|breakout|trend/.test(q);
  if (!wantsTechnical) return [];
  if (/한국|코스피|코스닥|kr|kospi|kosdaq/.test(q) || ctxId === 'kr-tech' || ctxId === 'kr-technical') return ['^KS11', '^KQ11', 'KRW=X'];
  if (/반도체|세미|semi|chip|smh|soxx/.test(q)) return ['SMH', 'SOXX', 'QQQ'];
  if (/소형|러셀|중소형|iwm|rsp|breadth|폭/.test(q)) return ['IWM', 'RSP', 'SPY'];
  return ['SPY', 'QQQ', 'SMH'];
}
window._aioTechnicalSymbolsForChat = _aioTechnicalSymbolsForChat;

// v50.38 트랙2: 매크로/외환/채권/테마 채팅에 페이지 도메인 라이브 데이터 주입 (시세 너머 정성+정량).
//   기존 compute/스냅샷 재사용 — 네트워크 비의존(라이브 캐시 + DATA_SNAPSHOT FRED값 + 내부 compute 함수).
//   _fetchTechnicalDataForChat 패턴 미러. 도메인 무관 ctx면 '' 반환(자기 게이팅).
function _fetchDomainContextForChat(ctxId) {
  try {
    var snap = window.DATA_SNAPSHOT || {};
    var live = window._liveData || {};
    var num = function(v) { return (v != null && isFinite(Number(v))) ? Number(v) : null; };
    var pick = function() { for (var i = 0; i < arguments.length; i++) { var v = snap[arguments[i]]; if (v != null && v !== '') return v; } return null; };
    var liveNum = function(sym, field) { var d = live[sym]; return (d && d[field] != null && isFinite(Number(d[field]))) ? Number(d[field]) : null; };
    var ts = ''; try { var n = new Date(); var p = function(x) { return String(x).padStart(2, '0'); }; ts = n.getFullYear() + '-' + p(n.getMonth()+1) + '-' + p(n.getDate()) + ' ' + p(n.getHours()) + ':' + p(n.getMinutes()) + ' KST'; } catch(_) {}
    var reg = (typeof window._aioRegimeNow === 'function') ? (function(){ try { return window._aioRegimeNow(); } catch(_){ return null; } })() : null;
    var tnx = liveNum('^TNX', 'price');                                  // 10Y (%)
    var twoY = num(pick('tnx2y', 'us2y', 'twoYear'));                    // 2Y 무료 라이브 없음 → 스냅샷
    var spread = (tnx != null && twoY != null) ? (tnx - twoY) : null;    // 2s10s (% 단위)
    var spxPct = liveNum('^GSPC', 'pct');
    var br50 = num(pick('breadth50sma', 'breadth50'));
    var lines = [];

    if (ctxId === 'macro' || ctxId === 'kr-macro') {
      if (reg && (reg.vix != null || reg.fg != null)) lines.push('• 시장 레짐: VIX ' + (reg.vix != null ? Number(reg.vix).toFixed(1) : '—') + ' · F&G ' + (reg.fg != null ? Math.round(reg.fg) : '—'));
      var cpi = num(pick('cpi','cpiYoy')), core = num(pick('coreCpi','coreCpiYoy')), pce = num(pick('pce','pceYoy')), cpce = num(pick('corePce','corePceYoy'));
      var infl = []; if (cpi != null) infl.push('CPI ' + cpi + '%'); if (core != null) infl.push('Core CPI ' + core + '%'); if (pce != null) infl.push('PCE ' + pce + '%'); if (cpce != null) infl.push('Core PCE ' + cpce + '%');
      if (infl.length) lines.push('• 인플레(FRED/스냅샷): ' + infl.join(' · '));
      var fed = pick('fedRate','fed-rate'), nfp = pick('nfp'), unemp = num(pick('unemployment')), fomc = pick('fomc');
      var pol = []; if (fed != null) pol.push('Fed ' + fed + (String(fed).indexOf('%') < 0 ? '%' : '')); if (nfp != null) pol.push('NFP ' + nfp); if (unemp != null) pol.push('실업률 ' + unemp + '%'); if (fomc) pol.push('다음 FOMC ' + fomc);
      if (pol.length) lines.push('• 정책/고용: ' + pol.join(' · '));
      if (tnx != null || twoY != null) lines.push('• 금리: ' + (tnx != null ? '10Y ' + tnx.toFixed(2) + '%' : '') + (twoY != null ? ' · 2Y ' + twoY.toFixed(2) + '%' : '') + (spread != null ? ' · 2s10s ' + (spread >= 0 ? '+' : '') + (spread * 100).toFixed(0) + 'bp' + (spread < 0 ? ' (역전·침체 선행)' : ' (정상)') : ''));
      try { if (window.AIO && typeof window.AIO.getCycleFromMacro === 'function') { var cyc = window.AIO.getCycleFromMacro({ vix: reg && reg.vix, breadth50: br50, yield2s10s: spread, spxTrend: (spxPct || 0) >= 0 ? 'up' : 'down' }); if (cyc && cyc.phase) lines.push('• 경기 사이클 국면(동적): ' + cyc.phase + (cyc.label ? ' — ' + cyc.label : '')); } } catch(_) {}
      if (lines.length) { lines.unshift('【매크로 도메인 라이브 데이터 (FRED 스냅샷 + 라이브 금리/레짐 + 동적 사이클) · ' + ts + '】'); }
    } else if (ctxId === 'fxbond') {
      var dxy = liveNum('DX-Y.NYB', 'price'); if (dxy == null) dxy = num(pick('dxy'));
      var hyg = liveNum('HYG', 'price');
      // P576/P713 계열 표면(2026-07-18): AI 컨텍스트는 HYG 달러 가격 대신 FRED HY OAS(bp) 실측을 우선 인용 —
      // HYG 가격은 듀레이션(금리) 노출이 섞여 있어 AI가 신용 레벨로 오인용할 위험이 있음.
      var hyOasBpChat = Number(window._hySpreadBp);
      if (dxy != null) lines.push('• 달러(DXY): ' + dxy.toFixed(2) + (dxy >= 100 ? ' (강세권·EM 압박)' : ' (약세권·원자재/EM 우호)'));
      if (tnx != null || twoY != null) lines.push('• 미 국채: ' + (tnx != null ? '10Y ' + tnx.toFixed(2) + '%' : '') + (twoY != null ? ' · 2Y ' + twoY.toFixed(2) + '%' : '') + (spread != null ? ' · 2s10s ' + (spread >= 0 ? '+' : '') + (spread * 100).toFixed(0) + 'bp' + (spread < 0 ? ' (역전)' : '') : ''));
      if (isFinite(hyOasBpChat)) lines.push('• 크레딧(HY OAS): ' + Math.round(hyOasBpChat) + 'bp' + (hyg != null ? ' · HYG $' + hyg.toFixed(2) + '(참고 가격)' : ''));
      else if (hyg != null) lines.push('• 크레딧(HYG 가격, OAS 미수신): ' + hyg.toFixed(2) + ' — 절대 스프레드 수준 아님, 방향 참고만');
      var kr3 = num(pick('krBond3y','kr-bond-3y','krBond3Y')), kr10 = num(pick('krBond10y','kr-bond-10y','krBond10Y'));
      if (kr3 != null || kr10 != null) lines.push('• 한국 금리(스냅샷): ' + (kr3 != null ? '3Y ' + kr3 + '%' : '') + (kr10 != null ? (kr3 != null ? ' · ' : '') + '10Y ' + kr10 + '%' : ''));
      try { if (window.AIO && typeof window.AIO.computeCrossAssetCorrelation === 'function') { var ca = window.AIO.computeCrossAssetCorrelation(); if (ca && (ca.regime || ca.verdict)) lines.push('• Cross-Asset 레짐: ' + (ca.regime || ca.verdict)); } } catch(_) {}
      if (lines.length) { lines.unshift('【외환·채권 도메인 라이브 데이터 (DXY/금리/크레딧 라이브 + KR 금리 스냅샷 + Cross-Asset) · ' + ts + '】'); }
    } else if (ctxId === 'themes' || ctxId === 'theme-detail' || ctxId === 'kr-themes') {
      var secNames = { XLK:'기술', XLF:'금융', XLE:'에너지', XLV:'헬스케어', XLI:'산업재', XLY:'임의소비', XLP:'필수소비', XLRE:'부동산', XLB:'소재', XLU:'유틸', XLC:'커뮤니케이션' };
      var rows = Object.keys(secNames).map(function(s) { return { s: s, pct: liveNum(s, 'pct') }; }).filter(function(x) { return x.pct != null; }).sort(function(a, b) { return b.pct - a.pct; });
      if (rows.length >= 3) {
        lines.push('• 섹터 리더(당일): ' + rows.slice(0, 3).map(function(x) { return secNames[x.s] + '(' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(2) + '%)'; }).join(' · '));
        lines.push('• 섹터 하위(당일): ' + rows.slice(-3).map(function(x) { return secNames[x.s] + '(' + (x.pct >= 0 ? '+' : '') + x.pct.toFixed(2) + '%)'; }).join(' · '));
      }
      try { if (window.AIO && typeof window.AIO.getCycleFromMacro === 'function') { var cyc2 = window.AIO.getCycleFromMacro({ vix: reg && reg.vix, breadth50: br50, yield2s10s: spread, spxTrend: (spxPct || 0) >= 0 ? 'up' : 'down' }); if (cyc2 && cyc2.phase) lines.push('• 경기 사이클 국면(섹터 로테이션 기준): ' + cyc2.phase + (cyc2.leaders ? ' → 주도: ' + cyc2.leaders : (cyc2.label ? ' — ' + cyc2.label : ''))); } } catch(_) {}
      try { if (window.AIO && typeof window.AIO.diagnoseBreadthConsensus === 'function') { var bc = window.AIO.diagnoseBreadthConsensus(); if (bc && (bc.verdict || bc.signal || bc.label)) lines.push('• 시장 폭 합의: ' + (bc.verdict || bc.signal || bc.label)); } } catch(_) {}
      if (lines.length) { lines.unshift('【테마·섹터 도메인 라이브 데이터 (섹터 ETF 등락 + 동적 사이클 + 시장 폭) · ' + ts + '】'); }
    }

    if (!lines.length) return '';
    lines.push('※ 위는 라이브 시세 캐시 + FRED/스냅샷 + 내부 compute 실측. 시점성 수치는 이 값 기준으로 답하고 학습데이터 추측 금지.');
    return '\n\n' + lines.join('\n') + '\n';
  } catch (e) { return ''; }
}
window._fetchDomainContextForChat = _fetchDomainContextForChat;

// v50.37 트랙2: 채팅 데이터 소스 레지스트리 — 종목 답변에 주입되는 모든 데이터 소스의 단일 선언 카탈로그.
//   목적: (1) 확장성 — 새 소스 추가 시 여기 1줄 + _fetchTickerDataForChat 배선 (2) 출처 투명성 매니페스트 기반
//   (3) getChatSourceRegistryAudit로 레지스트리↔코드 드리프트 자동 감지(R121 패턴).
//   fn = window.AIO.<fn> 또는 모듈 내 함수명. tier = quote/fundamental/qualitative/sentiment/screen.
//   bespoke 렌더는 _fetchTickerDataForChat에 유지(전면 실행엔진 재작성은 고위험 — 카탈로그+감사+매니페스트 레이어).
var AIO_CHAT_SOURCE_REGISTRY = [
  // 시세·추세 (in-function 호출)
  { key:'quote',        label:'실시간 시세',         fn:'dynamicTickerLookup',           tier:'quote',       free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'trend',        label:'주가 추이(5D/20D/3M)', fn:'_fetchTickerTrend',             tier:'quote',       free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'technicalOHLCV', label:'OHLCV 기술지표(RSI/MACD/MA/ATR)', fn:'_fetchTechnicalDataForChat', tier:'technical', free:true, requiresKey:null, appliesTo:function(){return true;} },
  { key:'analystRec',   label:'애널리스트 컨센서스',  fn:'fetchFinnhubRecommendation',    tier:'sentiment',   free:false, requiresKey:'aio_finnhub_key', appliesTo:function(){return true;} },
  { key:'nextEarnings', label:'다음 어닝 일정',       fn:'fetchFinnhubEarningsCalendar',  tier:'fundamental', free:false, requiresKey:'aio_finnhub_key', appliesTo:function(){return true;} },
  // 펀더멘털 (window.AIO.*)
  { key:'secBusiness',  label:'SEC 10-K 사업개요',    fn:'fetchSECBusinessDescription',   tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'wikipedia',    label:'Wikipedia 기업개요',   fn:'fetchWikipediaCompany',         tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'sec8K',        label:'SEC 8-K 최근공시',     fn:'fetchSECRecentFilings',         tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'fhNews',       label:'Finnhub 기업뉴스(14일)', fn:'fetchFinnhubCompanyNews',     tier:'sentiment',   free:false, requiresKey:'aio_finnhub_key', appliesTo:function(){return true;} },
  { key:'insider',      label:'내부자 거래',          fn:'fetchFinnhubInsider',           tier:'sentiment',   free:false, requiresKey:'aio_finnhub_key', appliesTo:function(){return true;} },
  { key:'thirteenF',    label:'13F 기관보유',         fn:'fetchSEC13F',                   tier:'sentiment',   free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'fcf',          label:'FCF Yield',           fn:'computeFcfYield',               tier:'fundamental', free:false, requiresKey:'aio_fmp_key', appliesTo:function(){return true;} },
  { key:'balance',      label:'대차대조표 비율',      fn:'computeBalanceSheetRatios',     tier:'fundamental', free:false, requiresKey:'aio_fmp_key', appliesTo:function(){return true;} },
  { key:'evEbitda',     label:'EV/EBITDA',           fn:'computeEvEbitda',               tier:'fundamental', free:false, requiresKey:'aio_fmp_key', appliesTo:function(){return true;} },
  { key:'macroBeta',    label:'매크로 민감도(베타)',  fn:'computeMacroBeta',              tier:'fundamental', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'shortInterest',label:'공매도 비중',          fn:'fetchFinnhubShortInterest',     tier:'sentiment',   free:false, requiresKey:'aio_finnhub_key', appliesTo:function(){return true;} },
  { key:'riskFactors',  label:'SEC 리스크요인(1A)',   fn:'fetchSECRiskFactors',           tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'supplyChain',  label:'공급망(10-K)',         fn:'fetchSECSupplyChain',           tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'partnership',  label:'파트너십(8-K)',        fn:'fetchPartnershipAlerts',        tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'platform',     label:'플랫폼/생태계',        fn:'fetchPlatformEcosystem',        tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'moat',         label:'경제적 해자(Moat)',    fn:'computeMoatScore',              tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'fmpSegments',  label:'FMP 사업 세그먼트',    fn:'fetchFMPSegments',              tier:'fundamental', free:false, requiresKey:'aio_fmp_key', appliesTo:function(){return true;} },
  { key:'tam',          label:'TAM/시장규모 추정',    fn:'computeTAMEstimate',            tier:'qualitative', free:true,  requiresKey:null,         appliesTo:function(){return true;} },
  { key:'earningsCall', label:'어닝콜 전사(ASP/로드맵)', fn:'fetchFMPEarningsCallTranscript', tier:'fundamental', free:false, requiresKey:'aio_fmp_key', appliesTo:function(){return true;} },
  // 확장점(미배선) — KR DART: .KS/.KQ 종목 재무. OpenDART 키 + 프록시 필요. wired:false로 카탈로그에 명시.
  { key:'dartFinancials', label:'KR DART 재무(.KS/.KQ)', fn:'fetchDartFinancials',         tier:'fundamental', free:true, requiresKey:'aio_dart_key', wired:false, planned:true, appliesTo:function(t){return /\.(KS|KQ)$/i.test(t||'');} }
];
window.AIO_CHAT_SOURCE_REGISTRY = AIO_CHAT_SOURCE_REGISTRY;

// v50.60: AIO 채팅이 일반 LLM과 달라야 하는 이유를 데이터/페이지 파이프라인으로 명시한다.
// 실제 답변은 아래 _buildAioIntegratedAnswerContext()가 이 레지스트리를 읽어 정량+정성+현재 시장+페이지 연결 계약으로 주입한다.
var AIO_CHAT_PIPELINE_REGISTRY = [
  { key:'marketState', label:'현재 시장 현황', tier:'current', kind:'quant', pages:['home','market-news','briefing'] },
  { key:'quotes', label:'실시간/검증 시세', tier:'current', kind:'quant', pages:['home','technical','signal','fundamental','portfolio'] },
  { key:'technicalOHLCV', label:'차트·기술 지표', tier:'analysis', kind:'quant', pages:['technical','signal'] },
  { key:'screener', label:'퀀트 스크리너 후보군', tier:'analysis', kind:'quant', pages:['screener','themes','kr-themes'] },
  { key:'breadthSentiment', label:'시장 폭·심리', tier:'context', kind:'quant', pages:['breadth','sentiment'] },
  { key:'macroRatesFx', label:'매크로·금리·환율', tier:'context', kind:'quant', pages:['macro','fxbond','kr-macro'] },
  { key:'companyFundamentals', label:'기업 펀더멘털·밸류에이션', tier:'analysis', kind:'mixed', pages:['fundamental'] },
  { key:'newsFilings', label:'뉴스·공시·촉매·리스크', tier:'current', kind:'qual', pages:['market-news','briefing','fundamental'] },
  { key:'themes', label:'테마·섹터 로테이션', tier:'context', kind:'mixed', pages:['themes','theme-detail','kr-themes'] },
  { key:'portfolio', label:'보유종목·비중·리스크', tier:'user', kind:'mixed', pages:['portfolio'] }
];
window.AIO_CHAT_PIPELINE_REGISTRY = AIO_CHAT_PIPELINE_REGISTRY;

async function _fetchTickerDataForChat(tickers, opts) {
  if (!tickers || tickers.length === 0) return '';
  opts = opts || {};
  var _tickerPolicy = (typeof _aioChatAnswerPolicy === 'function') ? _aioChatAnswerPolicy(opts.query || '', opts.ctxId || 'ticker', tickers, null) : { needsFullStockMemo: true, asksDecision: true };
  var _forceScenarioAnswer = !!(_tickerPolicy.needsFullStockMemo || _tickerPolicy.asksDecision);
  var _f = function(v, dec) { return v != null && !isNaN(v) ? Number(v).toFixed(dec || 1) : 'N/A'; };
  var _fm = function(v) { if (!v) return 'N/A'; if (v >= 1e12) return '$' + (v/1e12).toFixed(1) + 'T'; if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B'; if (v >= 1e6) return '$' + (v/1e6).toFixed(0) + 'M'; return '$' + v; };
  var fmpKey = _getApiKey('aio_fmp_key') || '';
  var results = [];

  // v50.37 트랙2: 출처 매니페스트 — 이번 질의에서 시도(가용) 가능한 소스 카탈로그 기록 (provenance/디버깅/감사 기반).
  //   available = 함수 정의 존재 + appliesTo(ticker) 통과 + (requiresKey면) 키 보유. wired:false(미배선) 소스는 제외.
  try {
    var _manifestTs = new Date().toISOString();
    var _manifestSources = (AIO_CHAT_SOURCE_REGISTRY || []).filter(function(s){ return s.wired !== false; }).map(function(s){
      var _fnOk = (s.fn && (typeof window[s.fn] === 'function' || (window.AIO && typeof window.AIO[s.fn] === 'function')));
      var _applies = tickers.some(function(t){ try { return s.appliesTo ? s.appliesTo(t) : true; } catch(_){ return true; } });
      var _keyOk = !s.requiresKey || !!_getApiKey(s.requiresKey);
      return { key:s.key, label:s.label, tier:s.tier, available: !!(_fnOk && _applies && _keyOk), requiresKey:s.requiresKey || null };
    });
    window._aioLastChatSources = { ts:_manifestTs, tickers:tickers.slice(), sources:_manifestSources, availableCount:_manifestSources.filter(function(x){return x.available;}).length };
  } catch(_mfErr) {}
  // v49.66 P350 R121: _chatTickerCache 실 구현 — 5분 TTL, 동일 종목 재질의 시 ~0.5초 응답 + 외부 API 쿼터 절약
  window._chatTickerCache = window._chatTickerCache || {};
  window._chatTickerCacheStats = window._chatTickerCacheStats || { hits: 0, misses: 0, evictions: 0 };
  var _CC_TTL = 5 * 60 * 1000;
  var _CC_MAX = 50;
  var _bypassChatTickerCache = !!(opts.forceFresh || opts.bypassCache || opts.reason === 'chat-answer' || opts.reason === 'chat-preflight');
  var _forceQuoteLookup = !!(opts.forceFresh || opts.bypassLiveCache || opts.reason === 'chat-answer' || opts.reason === 'chat-preflight');
  // 사전 캐시 조회 — 만료되지 않은 종목은 캐시 결과 재사용, miss만 새로 fetch
  var cacheMissTickers = [];
  var cachedBlocks = [];
  for (var _ci = 0; _ci < tickers.length; _ci++) {
    var _ct = tickers[_ci];
    var _cached = window._chatTickerCache[_ct];
    if (!_bypassChatTickerCache && _cached && (Date.now() - _cached.ts < _CC_TTL) && typeof _cached.block === 'string') {
      cachedBlocks.push(_cached.block);
      window._chatTickerCacheStats.hits++;
    } else {
      cacheMissTickers.push(_ct);
      window._chatTickerCacheStats.misses++;
    }
  }
  // 전부 cache hit이면 즉시 반환 (수신/취합 완전 회피)
  if (cacheMissTickers.length === 0 && cachedBlocks.length > 0) {
    // v49.67 P353: cache hit 경로에도 시장 환경 헤더 주입 (R122 일관성)
    var _ccHeader = '';
    try {
      var _ccS = (typeof _liveSnap === 'function') ? _liveSnap() : null;
      // v50.43: cache-hit 경로도 marketState 단일 두뇌 우선(레짐/심리 라벨 일관) + _liveSnap 폴백.
      var _ccM = (window.AIO && window.AIO.marketState && (Date.now() - (window.AIO.marketState.ts || 0) < 15 * 60 * 1000)) ? window.AIO.marketState : null;
      if (_ccS || _ccM) {
        var _ccVix = (_ccM && _ccM.vix != null) ? _ccM.vix : ((_ccS && _ccS.vix) || '—');
        var _ccFg = (_ccM && _ccM.fg != null) ? _ccM.fg : ((_ccS && _ccS.fg != null) ? _ccS.fg : '—');
        var _ccFgL = (_ccM && _ccM.fgZoneLabel) ? _ccM.fgZoneLabel : (_ccFg === '—' ? '—' : (_ccFg <= 25 ? '극단 공포' : _ccFg <= 45 ? '공포' : _ccFg <= 55 ? '중립' : _ccFg <= 75 ? '탐욕' : '극단 탐욕'));
        _ccHeader = '【현재 시장 환경】 VIX ' + _ccVix + ' · F&G ' + _ccFg + ' (' + _ccFgL + ') · 트레이딩 스코어 ' + (_ccS && _ccS.score != null ? _ccS.score : '—') + '/100\n\n';
      }
    } catch(_) {}
    return '\n\n' + _ccHeader + '【사용자가 물어본 종목 실시간 데이터 (cache hit · 5분 이내)】\n' + cachedBlocks.join('\n') + '\n\n⚠️ ABSOLUTE RULES (R122): 종목 답변은 위 "현재 시장 환경" 인용으로 시작. 데이터는 5분 이내 캐시이나 시세 자체는 실시간 비교 권장.\n';
  }
  // miss만 처리 (기존 흐름 유지)
  tickers = cacheMissTickers;

  // v50.9: 저신뢰 자동데이터 관점 통합 고지 1줄 (산발 라벨 → 한눈에). 헬퍼는 모듈 최상위 정의.
  try { var _lcSummary = window._aioLowConfPerspectives(); if (_lcSummary) results.push(_lcSummary.promptLine); } catch(_lcErr) {}

  for (var i = 0; i < tickers.length; i++) {
    var t = tickers[i];
    var _tickerBlockStart = results.length; // 캐시 저장용 — 이 종목의 결과 라인 시작 인덱스
    // v49.73 P389 R142: 데이터 블록 fetched 시각 헤더 — 모든 라벨에 통합 출처/기준일 명시 (출처 괄호 의무 R142)
    try {
      if (typeof window._aioFetchLabel === 'function') {
        var _bn = new Date();
        var _bp = function(n){ return String(n).padStart(2, '0'); };
        var _bts = _bn.getFullYear() + '-' + _bp(_bn.getMonth()+1) + '-' + _bp(_bn.getDate()) + ' ' + _bp(_bn.getHours()) + ':' + _bp(_bn.getMinutes()) + ' KST';
        results.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        results.push('【' + t + ' 데이터 블록 · 일괄 fetched ' + _bts + ' (각 라벨에 개별 source 명시)】');
        results.push('AI 답변 시 모든 정량 인용에 (출처 · 기준일) 괄호 동반 의무 — ABSOLUTE RULES 16조 (R142).');
      }
    } catch(_hdrErr) {}
    var data = null;
    // 1. _liveData 캐시 확인
    var ld = (window._liveData || {})[t];
    if (!_forceQuoteLookup && ld && ld.price) {
      data = { ticker: t, price: ld.price, pct: ld.pct != null ? ld.pct : null, source: 'cache' };
    } else {
      // 2. 실시간 Yahoo 조회 (v49.67: 폴백 체인 4단계 후 fetchFailed:true 구조화 응답)
      try { data = await dynamicTickerLookup(t, { forceFresh: _forceQuoteLookup, reason: opts.reason || 'chat-ticker-data' }); } catch(e) {}
      // v49.67 P352: dynamicTickerLookup가 fetchFailed 객체 반환하면 data = null로 변환 (HARD GUARDRAIL 경로 진입)
      if (data && data.fetchFailed) {
        var _failData = data;
        data = null;
        // 진단 정보 추가 push — 사용자가 왜 실패했는지 즉시 인지
        results.push('• ' + t + ' (' + _failData.tickerType + '): ❌ 시세 조회 실패 — ' + _failData.reason);
        results.push('  💡 ' + _failData.suggestedAction);
      }
    }
    // v49.34 신규: SEC 10-K + Wikipedia 사전 fetch (병렬)
    // v49.57 P317 R104 보강: SEC 8-K + Finnhub news + Insider + 13F 추가 — 6 소스 병렬
    // v49.58 P320 R104 보강: FCF/Balance/EV/Macro/Short 5 신규 — 11 소스 병렬
    // v49.58 P321 R107 보강: 모든 fetch에 _withTimeout 2.5초 — hang 시 graceful degradation
    var _T = 2500; // 개별 fetch timeout
    var secPromise         = window.AIO && window.AIO.fetchSECBusinessDescription ? _withTimeout(window.AIO.fetchSECBusinessDescription(t).catch(function(){return null;}), _T, null) : null;
    var wikiPromise        = window.AIO && window.AIO.fetchWikipediaCompany      ? _withTimeout(window.AIO.fetchWikipediaCompany(t).catch(function(){return null;}), _T, null) : null;
    var sec8KPromise       = window.AIO && window.AIO.fetchSECRecentFilings      ? _withTimeout(window.AIO.fetchSECRecentFilings(t).catch(function(){return null;}), _T, null) : null;
    var fhNewsPromise      = window.AIO && window.AIO.fetchFinnhubCompanyNews    ? _withTimeout(window.AIO.fetchFinnhubCompanyNews(t, 14).catch(function(){return null;}), _T, null) : null;
    var insiderPromise     = window.AIO && window.AIO.fetchFinnhubInsider        ? _withTimeout(window.AIO.fetchFinnhubInsider(t).catch(function(){return null;}), _T, null) : null;
    var thirteenFPromise   = window.AIO && window.AIO.fetchSEC13F                ? _withTimeout(window.AIO.fetchSEC13F(t).catch(function(){return null;}), _T, null) : null;
    // v49.58 신규 5: v49.35 Roadmap 미연결 함수 채팅 통합
    var fcfPromise         = window.AIO && window.AIO.computeFcfYield            ? _withTimeout(window.AIO.computeFcfYield(t).catch(function(){return null;}), _T, null) : null;
    var balancePromise     = window.AIO && window.AIO.computeBalanceSheetRatios  ? _withTimeout(window.AIO.computeBalanceSheetRatios(t).catch(function(){return null;}), _T, null) : null;
    var evEbitdaPromise    = window.AIO && window.AIO.computeEvEbitda            ? _withTimeout(window.AIO.computeEvEbitda(t).catch(function(){return null;}), _T, null) : null;
    // v50.9 P482: computeMacroBeta는 동기 함수(plain object 반환) — Promise.resolve로 감싸야 .catch 가능. 미감쌈 시 TypeError로 _fetchTickerDataForChat 전체 reject(펀더멘털 블록 silent 누락).
    var macroBetaPromise   = window.AIO && window.AIO.computeMacroBeta           ? _withTimeout(Promise.resolve(window.AIO.computeMacroBeta(t)).catch(function(){return null;}), _T, null) : null;
    var shortPromise       = window.AIO && window.AIO.fetchFinnhubShortInterest  ? _withTimeout(window.AIO.fetchFinnhubShortInterest(t).catch(function(){return null;}), _T, null) : null;
    // v49.66 P348 R121: fetchSECRiskFactors Dead code 해소 (#16 리스크 SEC 10-K Item 1A 직접 URL 인용)
    var riskFactorsPromise = window.AIO && window.AIO.fetchSECRiskFactors        ? _withTimeout(window.AIO.fetchSECRiskFactors(t).catch(function(){return null;}), _T, null) : null;
    // v49.65 P340/P341 R116: 17 관점 분석 프레임워크 완성 — 6 신규 promise
    var supplyChainPromise = window.AIO && window.AIO.fetchSECSupplyChain        ? _withTimeout(window.AIO.fetchSECSupplyChain(t).catch(function(){return null;}), _T, null) : null;
    var partnershipPromise = window.AIO && window.AIO.fetchPartnershipAlerts     ? _withTimeout(window.AIO.fetchPartnershipAlerts(t, 6).catch(function(){return null;}), _T, null) : null;
    var platformPromise    = window.AIO && window.AIO.fetchPlatformEcosystem     ? _withTimeout(window.AIO.fetchPlatformEcosystem(t).catch(function(){return null;}), _T, null) : null;
    var moatPromise        = window.AIO && window.AIO.computeMoatScore           ? _withTimeout(window.AIO.computeMoatScore(t).catch(function(){return null;}), _T, null) : null;
    var fmpSegPromise      = window.AIO && window.AIO.fetchFMPSegments           ? _withTimeout(window.AIO.fetchFMPSegments(t).catch(function(){return null;}), _T, null) : null;
    var tamPromise         = window.AIO && window.AIO.computeTAMEstimate         ? _withTimeout(window.AIO.computeTAMEstimate(t).catch(function(){return null;}), _T, null) : null;
    // v49.83 P446/R175 신규 (#4): FMP earnings call transcript — ASP/제품 로드맵/고객 commentary 정성 분석용
    var earningsCallPromise = window.AIO && window.AIO.fetchFMPEarningsCallTranscript ? _withTimeout(window.AIO.fetchFMPEarningsCallTranscript(t).catch(function(){return null;}), _T, null) : null;

    if (data) {
      var line = '• ' + data.ticker + (data.name ? ' (' + data.name + ')' : '') + ': $' + Number(data.price).toFixed(2) + (data.pct != null ? (' (' + (data.pct >= 0 ? '+' : '') + Number(data.pct).toFixed(2) + '%)') : '');
      if (data.exchange) line += ' [' + data.exchange + ']';
      if (data.currency && data.currency !== 'USD') line += ' ' + data.currency;
      results.push(line);

      // v48.11: 주가 추이 라인 자동 주입 — "긍정 뉴스 + 하락 추세" 같은 시간 불일치 감지 필수 근거
      try {
        var trendText = await _fetchTickerTrend(data.ticker);
        if (trendText) results.push('  [주가 추이] ' + trendText);
      } catch(e) {}

      // v48.12: Finnhub 애널리스트 추천 + 향후 어닝 일정 자동 주입 — 기관 뷰 반영
      try {
        var _fhRec = await fetchFinnhubRecommendation(data.ticker);
        if (_fhRec) {
          var _total = (_fhRec.strongBuy||0) + (_fhRec.buy||0) + (_fhRec.hold||0) + (_fhRec.sell||0) + (_fhRec.strongSell||0);
          if (_total > 0) {
            var _bull = (_fhRec.strongBuy||0) + (_fhRec.buy||0);
            var _bear = (_fhRec.sell||0) + (_fhRec.strongSell||0);
            var _verdict = _bull/_total >= 0.6 ? '매수 우세' : _bull/_total >= 0.4 ? '완만 매수' : _bear/_total >= 0.4 ? '매도 우세' : '중립';
            results.push('  [애널리스트 컨센서스] ' + _total + '명 · StrongBuy ' + (_fhRec.strongBuy||0) + '/Buy ' + (_fhRec.buy||0) + '/Hold ' + (_fhRec.hold||0) + '/Sell ' + (_fhRec.sell||0) + '/StrongSell ' + (_fhRec.strongSell||0) + ' → ' + _verdict + ' (Finnhub · ' + (_fhRec.period||'') + ')');
          }
        }
      } catch(e) {}
      try {
        var _today = new Date().toISOString().slice(0,10);
        var _60d = new Date(Date.now() + 60*86400000).toISOString().slice(0,10);
        var _fhEarn = await fetchFinnhubEarningsCalendar(_today, _60d, data.ticker);
        if (_fhEarn && _fhEarn.length > 0) {
          var _e = _fhEarn[0];
          var _hour = _e.hour === 'bmo' ? '장전' : _e.hour === 'amc' ? '장후' : _e.hour === 'dmh' ? '장중' : '미정';
          results.push('  [다음 어닝] ' + (_e.date||'미정') + ' ' + _hour + ' · 예상 EPS $' + (_e.epsEstimate != null ? Number(_e.epsEstimate).toFixed(2) : 'N/A') + (_e.revenueEstimate ? ' · 예상 매출 ' + _fm(_e.revenueEstimate) : ''));
        }
      } catch(e) {}

      // v34.2: FMP 키가 있으면 핵심 밸류에이션도 조회하여 추가
      if (fmpKey) {
        try {
          var [ratioRes, profRes, incRes, tgtRes] = await Promise.all([
            fetchWithTimeout('https://financialmodelingprep.com/api/v3/ratios-ttm/' + t + '?apikey=' + fmpKey, {}, 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
            fetchWithTimeout('https://financialmodelingprep.com/api/v3/profile/' + t + '?apikey=' + fmpKey, {}, 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
            fetchWithTimeout('https://financialmodelingprep.com/api/v3/income-statement/' + t + '?limit=2&apikey=' + fmpKey, {}, 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
            fetchWithTimeout('https://financialmodelingprep.com/api/v3/price-target-consensus/' + t + '?apikey=' + fmpKey, {}, 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
          ]);
          var extras = [];
          if (ratioRes && Array.isArray(ratioRes) && ratioRes[0]) {
            var rt = ratioRes[0];
            extras.push('  PER: ' + _f(rt.peRatioTTM) + 'x | PBR: ' + _f(rt.priceToBookRatioTTM) + 'x | PEG: ' + _f(rt.pegRatioTTM) + ' | EV/EBITDA: ' + _f(rt.enterpriseValueOverEBITDATTM) + 'x | PSR: ' + _f(rt.priceToSalesRatioTTM) + 'x');
            extras.push('  ROE: ' + _f(rt.returnOnEquityTTM ? rt.returnOnEquityTTM*100 : null) + '% | 순이익률: ' + _f(rt.netProfitMarginTTM ? rt.netProfitMarginTTM*100 : null) + '% | 부채비율: ' + _f(rt.debtEquityRatioTTM) + ' | 배당: ' + _f(rt.dividendYieldTTM ? rt.dividendYieldTTM*100 : null) + '%');
          }
          if (profRes && Array.isArray(profRes) && profRes[0]) {
            var p = profRes[0];
            extras.push('  시가총액: ' + _fm(p.mktCap) + ' | 52주: ' + (p.range||'N/A') + ' | 베타: ' + _f(p.beta,2) + ' | 산업: ' + (p.industry||'N/A'));
          }
          if (incRes && Array.isArray(incRes) && incRes.length >= 2 && incRes[1].revenue > 0) {
            var revG = ((incRes[0].revenue - incRes[1].revenue) / incRes[1].revenue * 100);
            extras.push('  매출: ' + _fm(incRes[0].revenue) + ' (YoY ' + (revG >= 0 ? '+' : '') + _f(revG) + '%) | EPS: $' + _f(incRes[0].epsdiluted,2) + ' | EBITDA: ' + _fm(incRes[0].ebitda));
          }
          if (tgtRes && Array.isArray(tgtRes) && tgtRes[0] && tgtRes[0].targetConsensus) {
            var tg = tgtRes[0];
            var up = data.price ? ((tg.targetConsensus - data.price) / data.price * 100) : null;
            extras.push('  애널리스트 목표가: $' + _f(tg.targetConsensus,2) + ' ($' + _f(tg.targetLow,2) + '~$' + _f(tg.targetHigh,2) + ') | 업사이드: ' + (up != null ? (up>=0?'+':'') + _f(up) + '%' : 'N/A'));
          }
          if (extras.length > 0) results.push(extras.join('\n'));
        } catch(e) { /* FMP 조회 실패 무시 */ }
      }

      // v41.9: Naver 보충 데이터 (한국어명, 업종, 컨센서스, 기업개요)
      try {
        var naverD = await fetchNaverUSData(t, false);
        if (naverD) {
          var ne = [];
          if (naverD.nameKr) ne.push('  [Naver] ' + naverD.nameKr + (naverD.industryKr ? ' | ' + naverD.industryKr : '') + (naverD.exchange ? ' (' + naverD.exchange + ')' : ''));
          if (naverD.consensus) {
            var nc = naverD.consensus;
            var nUp = data.price && nc.targetMean ? ((nc.targetMean - data.price) / data.price * 100) : null;
            ne.push('  [Naver 컨센서스] 목표가: $' + _f(nc.targetMean,2) + ' ($' + _f(nc.targetLow,2) + '~$' + _f(nc.targetHigh,2) + ') | 추천: ' + _f(nc.recommMean,2) + '/5' + (nUp != null ? ' | 업사이드: ' + (nUp>=0?'+':'') + _f(nUp) + '%' : ''));
          }
          if (naverD.overview) ne.push('  [기업개요] ' + naverD.overview.substring(0, 250));
          if (ne.length > 0) results.push(ne.join('\n'));
        }
      } catch(e) {}

      // v49.34 신규: SEC 10-K Item 1 + Wikipedia intro 통합 (15 분석 분야 정성 출처)
      try {
        var sec = secPromise ? await secPromise : null;
        if (sec && sec.available) {
          results.push('  [SEC 10-K · source data.sec.gov/submissions] ' + (sec.companyName || t) + ' · SIC: ' + (sec.sicDescription || sec.sic || 'N/A') + ' · Filed: ' + (sec.latest10K && sec.latest10K.filingDate) + ' · ' + (sec.businessDescriptionUrl || ''));
          results.push('  [SEC 10-K 사용 가이드] Item 1 (Business) + Item 1A (Risk Factors)는 위 URL에서 직접 fetch 가능. 비즈니스 구조/사업 모델/공급망/리스크/경쟁 등 정성 분석은 이 출처를 인용하여 답변. AI 학습 데이터로 환각 금지.');
        }
      } catch(_secErr) {}
      try {
        var wiki = wikiPromise ? await wikiPromise : null;
        if (wiki && wiki.available && wiki.extract) {
          results.push('  [Wikipedia · source en.wikipedia.org/w/api.php] ' + wiki.url);
          results.push('  [기업 개요 (Wiki intro)] ' + wiki.extract.substring(0, 600));
        }
      } catch(_wikiErr) {}

      // v49.57 P317 R104 신규: SEC 8-K (최근 5건 event-driven)
      try {
        var sec8k = sec8KPromise ? await sec8KPromise : null;
        if (sec8k && sec8k.available && sec8k.recent8KList && sec8k.recent8KList.length > 0) {
          var _8kLines = sec8k.recent8KList.map(function(f) {
            return '    · ' + (f.filingDate || '?') + ' · Items: ' + (f.items || 'N/A') + ' · ' + (f.url || '');
          }).join('\n');
          results.push('  [SEC 8-K · source data.sec.gov · 최근 ' + sec8k.recent8KCount + '건 event-driven]\n' + _8kLines);
          results.push('  [SEC 8-K 가이드] Items 코드 — 1.01=신규계약 · 2.02=실적사전공시 · 5.02=임원변경 · 7.01=Reg FD · 8.01=기타. M&A/CEO변경/사이버사고 등 환각 차단용. URL 직접 fetch 가능.');
        }
      } catch(_8kErr) {}

      // v49.57 P317 R104 신규: Finnhub 종목 뉴스 (최근 14일)
      try {
        var fhNews = fhNewsPromise ? await fhNewsPromise : null;
        if (fhNews && fhNews.available && fhNews.topHeadlines && fhNews.topHeadlines.length > 0) {
          var _newsLines = fhNews.topHeadlines.map(function(n) {
            return '    · ' + (n.datetime || '?') + ' [' + (n.source || 'unknown') + '] ' + (n.headline || '');
          }).join('\n');
          results.push('  [News · source Finnhub /company-news · ' + fhNews.period + ' · 총 ' + fhNews.articleCount + '건 · Top ' + fhNews.topHeadlines.length + ']\n' + _newsLines);
        }
      } catch(_newsErr) {}

      // v50.15 (사용자 지적: 개별 기업 뉴스 약함): RSS/텔레그램 자동수집 캐시(60+ 소스·기관 리포트 포함)를 종목별로 필터 주입 — API 키 불요
      try {
        var _cacheNews = (typeof _aioTickerNewsFromCache === 'function') ? _aioTickerNewsFromCache(t, { windowHours: 168, max: 6 }) : '';
        if (_cacheNews) results.push(_cacheNews);
      } catch(_cnErr) {}

      // v49.57 P317 R104 신규: Finnhub 임원 매수/매도 (12주)
      try {
        var insider = insiderPromise ? await insiderPromise : null;
        if (insider && insider.available) {
          results.push('  [Insider · source Finnhub /insider-transactions · 12주 ' + insider.period + '] 거래 ' + insider.transactionCount + '건 · 매수 ' + insider.buyCount + ' / 매도 ' + insider.sellCount + ' · Net ' + (insider.netShares >= 0 ? '+' : '') + insider.netShares + '주 → ' + insider.verdict + ' (' + insider.note + ')');
        }
      } catch(_inErr) {}

      // v49.57 P317 R104 신규: SEC 13F 기관 보유 URL
      try {
        var f13 = thirteenFPromise ? await thirteenFPromise : null;
        if (f13 && f13.available) {
          results.push('  [13F 기관 보유] ' + (f13.queryUrl || '') + ' · WhaleWisdom: ' + (f13.whaleWisdomUrl || ''));
          results.push('  [13F 가이드] 분기 발표 (45일 lag). 종목별 정밀 institutional holdings는 WhaleWisdom 또는 위 SEC full-text URL 직접 조회. 학습 데이터로 "버크셔/타이거글로벌 보유" 등 환각 절대 금지.');
        }
      } catch(_13fErr) {}

      // v49.58 P320 R104 신규: FCF Yield (Free Cash Flow / Market Cap)
      try {
        var fcf = fcfPromise ? await fcfPromise : null;
        if (fcf && fcf.available && fcf.fcfYieldPct != null) {
          results.push('  [FCF Yield] ' + Number(fcf.fcfYieldPct).toFixed(2) + '% · ' + fcf.verdict + ' (' + fcf.source + ') — ' + fcf.note);
        }
      } catch(_fcfErr) {}

      // v49.58 P320 R104 신규: Balance Sheet (Net Debt/EBITDA + Interest Coverage)
      try {
        var bal = balancePromise ? await balancePromise : null;
        if (bal && bal.available) {
          var bLine = '  [Balance Sheet]';
          if (bal.netDebtToEbitda != null) bLine += ' Net Debt/EBITDA ' + Number(bal.netDebtToEbitda).toFixed(2) + 'x';
          if (bal.interestCoverage != null) bLine += ' · Interest Coverage ' + Number(bal.interestCoverage).toFixed(1) + 'x';
          bLine += ' · ' + bal.healthScore;
          results.push(bLine);
          if (bal.note) results.push('  [Balance 가이드] ' + bal.note);
        }
      } catch(_balErr) {}

      // v49.58 P320 R104 신규: EV/EBITDA + sector peer comparison
      try {
        var ev = evEbitdaPromise ? await evEbitdaPromise : null;
        if (ev && ev.available && ev.evEbitda != null) {
          var evLine = '  [EV/EBITDA] ' + Number(ev.evEbitda).toFixed(1) + 'x';
          if (ev.sectorMedian != null) evLine += ' (sector median ' + Number(ev.sectorMedian).toFixed(1) + 'x)';
          if (ev.verdict) evLine += ' · ' + ev.verdict;
          results.push(evLine);
        }
      } catch(_evErr) {}

      // v49.58 P320 R104 신규: Macro Beta (rate / dxy / oil 회귀)
      try {
        var mb = macroBetaPromise ? await macroBetaPromise : null;
        if (mb && mb.available) {
          var mbLine = '  [Macro Beta]';
          if (mb.rateBeta != null) mbLine += ' rate ' + Number(mb.rateBeta).toFixed(2);
          if (mb.dxyBeta != null) mbLine += ' · dxy ' + Number(mb.dxyBeta).toFixed(2);
          if (mb.oilBeta != null) mbLine += ' · oil ' + Number(mb.oilBeta).toFixed(2);
          if (mb.diversificationVerdict) mbLine += ' → ' + mb.diversificationVerdict;
          results.push(mbLine);
        }
      } catch(_mbErr) {}

      // v49.58 P320 R104 신규: Short Interest (% float)
      try {
        var sh = shortPromise ? await shortPromise : null;
        if (sh && sh.available && sh.shortInterestPct != null) {
          results.push('  [Short Interest] ' + Number(sh.shortInterestPct).toFixed(2) + '% float · ' + sh.verdict + (sh.note ? ' (' + sh.note + ')' : ''));
        }
      } catch(_shErr) {}

      // v49.71 P377 R135 신규: SCREENER_DB.memo + 신선도 자동 주입 (사용자 정직 질의 "MEMO 활용 + 신선도" 시정)
      try {
        var _memoData = (typeof _aioGetMemoForTicker === 'function') ? _aioGetMemoForTicker(t) : null;
        if (_memoData) {
          if (_memoData.hasMemo) {
            results.push('  [SCREENER_DB Memo · ' + _memoData.freshness.label + (_memoData.freshness.dateStr ? ' · ' + _memoData.freshness.dateStr : '') + ']');
            results.push('    ' + _memoData.memo);
            if (_memoData.freshness.confidence === 'stale' || _memoData.freshness.confidence === 'low') {
              results.push('  ⚠️ [Memo 가이드] 위 memo는 ' + _memoData.freshness.days + '일 전 작성 — AI 답변 시 "이 memo는 ' + _memoData.freshness.days + '일 전 데이터이므로 최근 변경 확인 권장" 명시 의무 (R135). [SEC 8-K] / [News] 최신 데이터 우선 인용.');
            } else if (_memoData.freshness.confidence === 'unknown') {
              results.push('  ⚠️ [Memo 가이드] memo 헤더에 날짜 패턴 없음 — 신선도 불명. AI 답변 시 "memo 작성일 미상" 명시 + [News] 최신 데이터 우선.');
            }
          } else {
            results.push('  [SCREENER_DB Memo] ❌ ' + _memoData.fallback);
            results.push('  ⚠️ [Memo 가이드] 위 종목은 수동 memo 미작성 — [SEC 10-K] / [Wikipedia] / [Naver] 3 소스 폴백만으로 분석. dataConfidence: medium. AI 답변 시 "정성 분석 한계 — 외부 직접 확인 권장" 경고 (R135/R136).');
          }
        }
      } catch(_memoErr) {}

      // v49.66 P348 R121 신규 (#16 리스크): Risk Factors — SEC 10-K Item 1A 직접 URL (fetchSECRiskFactors Dead code 해소)
      try {
        var rf = riskFactorsPromise ? await riskFactorsPromise : null;
        if (rf && rf.available) {
          results.push('  [Risk Factors · source SEC 10-K Item 1A] ' + (rf.riskFactorsUrl || '') + ' · SIC: ' + (rf.sicDescription || 'N/A'));
          results.push('  [Risk Factors 가이드] Item 1A 섹션은 동일 10-K 문서 내 (위 [SEC 10-K] URL과 동일 파일). 종목별 사업/규제/매크로/경쟁/소송/사이버 리스크 정성 분석 시 위 URL 직접 fetch + Item 1A 섹션 인용. 학습 데이터로 "주요 리스크" 추정 절대 금지 (R117).');
        }
      } catch(_rfErr) {}

      // v49.83 P446 R175 신규 (#4 earnings call transcript): FMP /earning_call_transcript
      try {
        var ec = earningsCallPromise ? await earningsCallPromise : null;
        if (ec && ec.available) {
          results.push('  [Earnings Call (Q' + (ec.quarter || '?') + ' ' + (ec.year || '') + ' · ' + (ec.date || '') + ') · source FMP /earning_call_transcript] excerpt ' + ec.excerptLength + '자');
          var snip = (ec.excerpt || '').slice(0, 600).replace(/\s+/g, ' ').trim();
          if (snip) results.push('  [Earnings Call 발췌] ' + snip + (ec.excerpt.length > 600 ? '...' : ''));
          results.push('  [Earnings Call 가이드] ASP/제품 로드맵/고객 commentary 정성 분석 시 위 발췌 직접 인용. 인용 부분 외 추측 금지.');
        } else if (ec && !ec.available && ec.reason && /key/i.test(ec.reason)) {
          results.push('  [Earnings Call] FMP API key 미설정 — 사이드바 → API 설정 등록 시 분기 transcript 자동 주입');
        }
      } catch(_ecErr) {}

      // v49.65 P340 R116 신규 (#12 공급망): Supply Chain — SEC 10-K Item 1/1C 가이드
      try {
        var sc = supplyChainPromise ? await supplyChainPromise : null;
        if (sc && sc.available) {
          results.push('  [Supply Chain] SIC: ' + (sc.sicDescription || 'N/A') + ' · 10-K Item 1+1C: ' + (sc.businessDescriptionUrl || '') + ' · sourceMode: ' + (sc.sourceMode || 'filing-link+keyword-guide') + ' · dataConfidence: ' + sc.dataConfidence);
          results.push('  [Supply Chain 가이드] 현재는 공급사·고객명 자동 추출이 아니라 10-K 링크+키워드 가이드입니다. supplier/concentration/single source/foundry/customer concentration/tariff 문구를 직접 인용할 수 있을 때만 구체명 사용. 학습 데이터 환각 금지 (R117).');
        }
      } catch(_scErr) {}

      // v49.65 P340 R116 신규 (#14 협력/파트너십): Partnership Alerts — SEC 8-K Item 1.01/7.01
      try {
        var pa = partnershipPromise ? await partnershipPromise : null;
        if (pa && pa.available) {
          if (pa.partnershipCount > 0) {
            var _paLines = pa.recentPartnerships.map(function(p) {
              return '    · ' + (p.filingDate || '?') + ' · Items ' + (p.items || 'N/A') + ' · ' + p.eventGuess + ' · ' + (p.url || '');
            }).join('\n');
            results.push('  [Partnerships (' + pa.period + ' · 총 ' + pa.partnershipCount + '건 · inspected 8-K ' + (pa.inspected8KCount || '?') + '/' + (pa.inspected8KLimit || '?') + ')]\n' + _paLines);
          } else {
            results.push('  [Partnerships] 최근 ' + pa.monthsBack + '개월 8-K Item 1.01/7.01 공시 없음 (inspected 8-K ' + (pa.inspected8KCount || '?') + '/' + (pa.inspected8KLimit || '?') + ', browse: ' + (pa.browseUrl || '') + ')');
          }
          results.push('  [Partnerships 가이드] 협력/M&A/파트너십은 8-K Item 1.01 (Material Definitive Agreement) + 7.01 (Reg FD)로 의무 공시. 학습 데이터에서 "XX 파트너십" 환각 금지.');
        }
      } catch(_paErr) {}

      // v49.65 P340 R116 신규 (#13 플랫폼/생태계): Platform Ecosystem — 3 소스 합성 score
      try {
        var pe = platformPromise ? await platformPromise : null;
        if (pe && pe.available) {
          results.push('  [Platform Eco] score ' + pe.ecosystemScore + '/100 · ' + pe.verdict + ' · dataConfidence: ' + pe.dataConfidence + (pe.indicators && pe.indicators.length > 0 ? ' · indicators: ' + pe.indicators.length : ''));
          results.push('  [Platform Eco 가이드] 정성 분석 한계 — 외부 API 없음. 위 ecosystemScore (SCREENER_DB.memo + FMP segments + Finnhub news 합성) 결과만 인용. "구체적 플랫폼 규모/사용자 수/MAU 추정 절대 금지" (R117).');
        }
      } catch(_peErr) {}

      // v49.65 P341 R116 신규 (#7 기술력/해자): Moat Score — Morningstar 대체 자동 채점
      try {
        var mo = moatPromise ? await moatPromise : null;
        if (mo && mo.available) {
          var moLine = '  [Moat Score] ' + mo.verdict + ' (score ' + mo.score + '/' + mo.maxScore + ') · dataConfidence: ' + mo.dataConfidence;
          if (mo.evidence && mo.evidence.length > 0) {
            moLine += '\n    Evidence:\n' + mo.evidence.map(function(e) { return '      · ' + e.moat + ': ' + e.signal + ' (' + e.weight + ')'; }).join('\n');
          }
          results.push(moLine);
          results.push('  [Moat 가이드] Wide(7+) / Narrow(3~6) / None(<3). SCREENER_DB + Naver financials 자동 채점. Morningstar 공식 등급 추정 금지 (R117).');
        }
      } catch(_moErr) {}

      // v49.65 P341 R116 신규 (#6 제품 포트폴리오 + #8 수익 구조): FMP Segments
      try {
        var seg = fmpSegPromise ? await fmpSegPromise : null;
        if (seg && seg.available && Array.isArray(seg.segments) && seg.segments.length > 0) {
          var _segLines = seg.segments.slice(0, 8).map(function(s) {
            var rev = s.revenue ? _fm(s.revenue) : 'N/A';
            return '    · ' + (s.name || 'segment') + ': ' + rev + (s.year ? ' (' + s.year + ')' : '');
          }).join('\n');
          results.push('  [Segments] (FMP /revenue-product-segmentation)\n' + _segLines);
          results.push('  [Segments 가이드] 세그먼트별 매출 비중 — 제품 포트폴리오/수익 구조 정량 분석 시 위 데이터만 인용. Wiki 학습 데이터로 신규 제품 환각 금지.');
        }
      } catch(_segErr) {}

      // v49.65 P341 R116 신규 (#11 TAM/시장 분석): TAM Estimate — SEC SIC + memo grep
      try {
        var tam = tamPromise ? await tamPromise : null;
        if (tam && tam.available) {
          var tamLine = '  [TAM]';
          if (tam.industryName) tamLine += ' ' + tam.industryName;
          if (tam.tamEstimate) tamLine += ' · TAM ' + tam.tamEstimate;
          if (tam.cagrEstimate) tamLine += ' · CAGR ' + tam.cagrEstimate;
          if (tam.sicCode) tamLine += ' · SIC ' + tam.sicCode;
          tamLine += ' · dataConfidence: ' + tam.dataConfidence;
          if (tam.indicators && tam.indicators.length > 0) tamLine += ' · indicators: ' + tam.indicators.map(function(x){ return x.source + (x.extracted ? '=' + x.extracted : ''); }).slice(0, 3).join(' / ');
          results.push(tamLine);
          results.push('  [TAM 가이드] 자동 산출 한계 — SEC SIC 매핑 + SCREENER_DB.memo 의존. "회사별 정확한 TAM/시장점유율 추정 금지" — confidence: ' + tam.dataConfidence + ' 명시 필수 (R117).');
        }
      } catch(_tamErr) {}
    } else {
      // v49.32 B2/R82 HARD GUARDRAIL — fetch 실패 시 환각 절대 차단
      results.push('• ' + t + ': ❌ 실시간 시세 조회 실패 (Yahoo Finance + 프록시 모두 fail)');
      results.push('  ⛔ HARD GUARDRAIL: 이 종목에 대해 절대로 가격/등락률/시가총액/PER 등 정량 수치를 추측하거나 인용하지 마세요. 학습 데이터(2024~2025)의 과거 수치는 이미 stale 입니다.');
      results.push('  ✅ 허용된 답변: "현재 ' + t + ' 실시간 데이터를 받아오지 못했습니다. Yahoo Finance(finance.yahoo.com/quote/' + t + ') 또는 Finnhub 등 외부 도구로 직접 확인을 권장합니다."');
      results.push('  ✅ 허용된 분석: 가격을 인용하지 않는 일반론적 사업 모델/경쟁사 비교/섹터 트렌드 (수치 없이) 만 답변하세요.');
    }
    // v49.66 P350 + v49.67 P354: 이 종목 처리 결과를 5분 TTL 캐시에 저장 (실패 fetch는 캐시 금지)
    try {
      var _tickerLines = results.slice(_tickerBlockStart);
      // v49.67 P354 R122: 시세 조회 실패 종목 (data === null 경로 — ❌ 표시 포함)은 캐시 저장 금지 (stale 응답 5분 반복 방지)
      var _isFailedFetch = !data || (_tickerLines.length > 0 && /❌\s*시세 조회 실패/.test(_tickerLines[0]));
      if (_tickerLines.length > 0 && !_isFailedFetch) {
        window._chatTickerCache[t] = { block: _tickerLines.join('\n'), ts: Date.now() };
        // v49.67 P354: TTL-based eviction 강화 — 매 save 시 만료 종목 자동 제거 (이전 LRU만 의존)
        var _now = Date.now();
        Object.keys(window._chatTickerCache).forEach(function(k) {
          if (_now - window._chatTickerCache[k].ts >= _CC_TTL) {
            delete window._chatTickerCache[k];
            window._chatTickerCacheStats.evictions++;
          }
        });
        // LRU eviction — 50 종목 초과 시 가장 오래된 10개 삭제 (TTL 후에도 50 초과 시)
        var _ckeys = Object.keys(window._chatTickerCache);
        if (_ckeys.length > _CC_MAX) {
          _ckeys.sort(function(a, b) { return window._chatTickerCache[a].ts - window._chatTickerCache[b].ts; })
            .slice(0, 10).forEach(function(k) {
              delete window._chatTickerCache[k];
              window._chatTickerCacheStats.evictions++;
            });
        }
      }
    } catch(_ccErr) {}
  }
  // v49.66 P350: 캐시된 종목 결과를 신규 fetch 결과와 병합
  if (cachedBlocks.length > 0) results = cachedBlocks.concat(results);
  if (results.length === 0) return '';
  // v49.67 P353 R122: 응답 첫 줄에 "현재 시장 환경" 자동 헤더 주입 — 모든 종목 답변에 시장 흐름 유기적 도입 의무
  var _mktHeader = '';
  try {
    var _s = (typeof _liveSnap === 'function') ? _liveSnap() : null;
    // v50.43: 단일 두뇌(AIO.marketState) 우선 — 채팅 시장환경 레짐/심리 라벨을 앱 전체(home/페이지 배너)와 동일 출처로 통일.
    //   marketState 미계산/구버전이면 _liveSnap 기반 독립 계산으로 폴백(무회귀).
    var _ms = (window.AIO && window.AIO.marketState && (Date.now() - (window.AIO.marketState.ts || 0) < 15 * 60 * 1000)) ? window.AIO.marketState : null;
    if (_s || _ms) {
      var _vix = (_ms && _ms.vix != null) ? _ms.vix : ((_s && _s.vix) || '—');
      var _fg = (_ms && _ms.fg != null) ? _ms.fg : ((_s && _s.fg != null) ? _s.fg : '—');
      var _spx = (_s && _s.spx) || (_ms && _ms.spx) || '—';
      var _tnx = (_s && _s.tnx) || '—';
      var _score = (_s && _s.score != null) ? _s.score : '—';
      var _regime = (_ms && _ms.vixBandLabel) ? _ms.vixBandLabel : ((_s && _s.regime) || (_vix !== '—' && Number(_vix) >= 25 ? '경계' : _vix !== '—' && Number(_vix) >= 20 ? '주의' : '안정'));
      var _fgLabel = (_ms && _ms.fgZoneLabel) ? _ms.fgZoneLabel : (_fg === '—' ? '—' : (_fg <= 25 ? '극단 공포' : _fg <= 45 ? '공포' : _fg <= 55 ? '중립' : _fg <= 75 ? '탐욕' : '극단 탐욕'));
      // v49.68 R128 시각 단서 표준 — VIX/F&G 이모지 자동 적용
      var _vixEmoji = _vix === '—' ? '⚪' : Number(_vix) >= 25 ? '🔴' : Number(_vix) >= 20 ? '🟡' : '🟢';
      var _fgEmoji = _fg === '—' ? '⚪' : (_fg <= 25 || _fg >= 75) ? '🔴' : (_fg <= 45 || _fg >= 55) ? '🟡' : '🟢';
      var _scoreEmoji = _score === '—' ? '⚪' : Number(_score) >= 65 ? '🟢' : Number(_score) >= 40 ? '🟡' : '🔴';
      var _nowStamp = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
      _mktHeader = '【현재 시장 환경 (v49.68 자동 헤더 · 기준일: ' + _nowStamp + ')】\n' +
        '• **SPX**: ' + _spx + ' · **VIX**: ' + _vixEmoji + ' ' + _vix + ' (' + _regime + ') · **10Y**: ' + _tnx + '% · **F&G**: ' + _fgEmoji + ' ' + _fg + ' (' + _fgLabel + ') · **트레이딩 스코어**: ' + _scoreEmoji + ' ' + _score + '/100\n' +
        (_forceScenarioAnswer
          ? '⚠️ **답변 가이드 (R122/R127/R128)**: 매매 판단·전망·추천 질문이면 위 시장 환경을 연결하고, **Bull (X%) / Base (Y%) / Bear (Z%)** 3 시나리오와 확신도를 제시하라. 데이터 출처 [Source · 기준일]과 필요한 시각 단서 🔴🟡🟢를 사용한다. 기관급 프레임은 도움이 될 때 1~2개만 인용한다.\n\n'
          : 'ℹ️ **답변 가이드 (R122/R128)**: 단순 사실·용어·요약 질문이면 시장 환경은 배경으로만 짧게 쓰고, Bull/Base/Bear·기관 프레임을 강제하지 말라. 질문에 바로 답하고 필요한 출처·기준일만 붙인다.\n\n');
    }
  } catch(_hdrErr) {}
  var _flexScope = _forceScenarioAnswer ? '' : '\n\n【우선 적용: 답변 형식 완화】\n아래 ABSOLUTE RULES의 9~11번(시나리오·액션 구조·기관 프레임)은 매매 판단/전망/추천 질문에만 적용한다. 단순 사실·용어·요약 질문은 질문에 바로 답하고, 필요한 데이터 출처·기준일·한계만 짧게 붙인다.\n';
  return '\n\n' + _mktHeader + _flexScope + '【사용자가 물어본 종목 실시간 데이터】\n' + results.join('\n') + '\n\n⚠️ ABSOLUTE RULES (v49.32 R82/R83/R84 + v49.34 R90 + v49.35 R91 + v49.57 R104 + v49.65 R116/R117):\n1. 위 실시간 데이터 블록의 수치만 인용. 학습 데이터의 과거 수치 절대 금지.\n2. "데이터 조회 실패"로 표시된 종목은 가격/PER/PBR/시총 등 정량 수치 답변 금지 — "실시간 데이터 미수신"으로만 응답.\n3. system 프롬프트의 다른 위치에 박힌 임계값/배수(예: "20MA distance 147-150")는 가격이 아닌 calibration 상수임. 종목 가격으로 인용 금지.\n4. 응답 후 AIO.assertChatResponseAccuracy() 자동 검증으로 ±10% 이상 괴리 시 차단됨.\n5. [SEC 8-K] / [News] / [Insider] / [13F] 블록 데이터만 인용. 학습 데이터(2024~2025)에서 "XX 회사 인수 발표/CEO 사임/실적 가이던스 상향" 등 거시 사건 환각 절대 금지. 블록이 비어 있거나 available:false면 "최근 이벤트 데이터 없음 — 사용자 직접 확인 권장"으로 응답.\n6. [Supply Chain] / [Partnerships] / [Platform Eco] / [Moat Score] / [Segments] / [TAM] 6 신규 라벨 (v49.65 17 관점 보강) 데이터만 인용. AI 학습 데이터에서 공급사/파트너십/플랫폼 사용자수/MAU/TAM 등 추정 절대 금지 (R116).\n7. dataConfidence: "low" 또는 "low-medium" 표시 분야 (Supply Chain / Platform Eco / TAM / Moat 일부)는 답변에 "정성 분석 한계 — 외부 확인 권장" 경고 의무. "Strong/Wide/Large" 등 강한 형용 사용 금지 (R117).\n8. 종목 답변 도입은 반드시 위 【현재 시장 환경】 헤더 인용 — "지금 VIX X · F&G Y 환경에서 [종목]은..." 패턴 사용. 시장 환경과 무관한 정적 분석 금지 (R122 시장 흐름 유기적 도입 의무). 시세 조회 실패 종목은 ❌ 표시 + suggestedAction 인용 후 "실시간 데이터 미수신 — 일반론적 분석만 가능" 답변.\n9. 종목/시장 분석 답변은 반드시 **Bull/Base/Bear 3 시나리오 분기 + 각각 확신도(확률 %)** 명시 의무 (R127). 형식: "**📈 Bull (확신도 X%)**: [트리거 조건] → [목표 시나리오] / **🟡 Base (Y%)**: [현재 환경 유지 시] → [예상] / **📉 Bear (Z%)**: [악화 트리거] → [하방 시나리오]". X+Y+Z = 100. 단일 시나리오만 답변 금지.\n10. **시각 단서 표준 (R128)**: 이모지 규칙 — VIX/F&G/위험 신호는 🔴(공포·위험·매도) / 🟡(중립·주의) / 🟢(안정·기회·매수). 핵심 결론은 **굵게**. 데이터 출처는 [Source: SEC/Yahoo/FMP · 기준일: YYYY-MM-DD] 형식 명시 의무. 한 줄 결론 → 3 핵심 → 시나리오 분기 → 액션 구조 강제.\n11. **기관급 프레임 인용 의무 (R126)**: 답변에 위 【기관급 분석 프레임워크】 8개 중 페이지 주제와 가장 관련 깊은 1~3개 명시 인용. "Bridgewater 4-Quadrant 기준 현재 위치는 ~ / Druckenmiller Overlay 유동성 시그널은 ~ / 따라서 ~" 패턴.\n12. **데이터 소스 우선순위 명문화 (R128)**: 모든 수치 인용 시 출처 우선순위 — **1순위: _liveSnap() 실시간** (시세/VIX/금리/달러/유가, < 5분) → **2순위: _closeSnap() 일별 종가** (SPX/NASDAQ/DOW 분석 기준) → **3순위: DATA_SNAPSHOT 폴백** (실시간/종가 미수신 시 정적, 신선도 명시 의무) → **4순위: SEC/FMP/Naver/Finnhub fetched** (종목별 5분 캐시). 데이터 인용 시 "Source: [layer] · 기준일: YYYY-MM-DD" 명시 의무. 폴백값 인용 시 "(폴백)" 명시 + 학습 데이터 추정 금지.\n13. **[SCREENER_DB Memo] 신선도 인용 의무 (R135)**: 답변에 SCREENER_DB Memo 인용 시 반드시 위 [SCREENER_DB Memo · X일 전] 라벨의 일수 표기. 30일+ stale memo는 "이 memo는 N일 전 데이터 — 최근 [SEC 8-K]/[News]로 검증 후 인용" 경고 의무. 90일+ stale 또는 confidence:stale 표시 시 "memo만으로 결론 금지 — 외부 확인 필수" 강제. 날짜 미상 (unknown) memo는 "작성일 불명 — 보조 데이터로만 활용" 명시.\n14. **[SCREENER_DB Memo 없음] 종목 fallback 의무 (R136)**: SCREENER_DB.memo가 없는 종목 (위 ❌ 표시)은 [SEC 10-K]/[Wikipedia]/[Naver]/[News] 4 소스 폴백만 사용. 답변에 "이 종목은 수동 memo 미작성 — dataConfidence:medium" 명시 의무 + "memo 등록 종목 (예: NVDA/AAPL) 대비 정성 분석 한계 — 외부 확인 권장" 경고 강제.\n\n📋 17 분석 관점 출처 매핑 (v49.65 R116 — 출처/함수 매핑 완료, low-confidence 분야는 한계 고지 필수):\n1) 기업 개요: [Wikipedia] + [기업 개요 (Wiki intro)]\n2) 창립 배경 & 성장 과정: [Wikipedia] (founded/IPO) + [News] (성장 마일스톤)\n3) CEO/경영진 분석: [Wikipedia] CEO/management 섹션 + [Insider] (자기자본 매수)\n4) 비즈니스 모델: [SEC 10-K Item 1] + [Wikipedia]\n5) 사업 구조: [SEC 10-K Item 1] + [Segments] (FMP segments)\n6) 제품 포트폴리오: [Segments] 우선 + [Wikipedia] 보조 (Wiki 단독 환각 차단)\n7) 기술력 & 해자: [Moat Score] (휴리스틱 자동 채점 — Morningstar 공식 등급 아님)\n8) 수익 구조: [Segments] + [Naver] + FMP 손익\n9) 재무제표 분석: FMP /income/balance/cashflow + [Balance Sheet] + [FCF Yield]\n10) 밸류에이션: FMP /ratios-ttm + [EV/EBITDA] + [애널리스트 컨센서스]\n11) TAM/시장 분석: [TAM] (SEC SIC + memo) — confidence 명시 의무\n12) 밸류체인/공급망: [Supply Chain] (SEC 10-K 링크+키워드 가이드 — 자동 추출 아님)\n13) 플랫폼/생태계: [Platform Eco] (3-source synthesis) — dataConfidence 명시 의무\n14) 협력/파트너십: [Partnerships] (SEC 8-K Item 1.01/7.01, 최근 8-K 40건 검사)\n15) 경쟁 구조: [SEC 10-K Item 1] + [Wikipedia] competitors 섹션 + peers\n16) 리스크: [Risk Factors (SEC 10-K Item 1A)] (v49.66 SEC URL 직접 인용) + [Short Interest]\n17) 투자 포인트: [애널리스트 컨센서스] + [Naver 컨센서스] + 위 16 관점 종합\n\n- 데이터 출처가 없는 분야는 "현재 검증된 데이터 없음 — 외부 도구 권장" 답변. 학습 데이터로 채우기 금지.\n\n📋 fundamental 페이지 17 관점 가용성 (v49.65 R116):\n- ✓ 출처/함수 매핑 17/17: 17 관점 모두 최소 데이터 경로 또는 명시적 가이드 보유\n- ⚠ 부분/한계 고지 필수: Supply Chain(10-K 링크+키워드 가이드), TAM(SIC+memo), Platform Eco(합성 score), Moat(휴리스틱), FMP Segments(API key 의존), 일부 SEC/Wiki 미등록 해외·KR 종목\n- 위 17 관점 라벨은 채팅 응답에 직접 인용. 미수신 라벨은 "데이터 fetch 실패 — 외부 직접 확인 권장" 답변. AI 학습 데이터로 채우기 금지.\n';
}

// ── v34.2: 기업 내부 비교 분석 — 비즈니스 모델·수익 구조·해자 심층 데이터 ──

// 기업 내부 비교 의도 감지 (비즈니스 모델, 수익 구조, 해자, 경쟁력 등)
// v34.4: 심층 키워드 배열을 공유 함수로 분리
var _DEEP_ANALYSIS_KW = [
    '비즈니스 모델','비즈니스모델','사업 모델','사업모델','수익 모델','수익모델',
    '수익 구조','수익구조','매출 구조','매출구조','사업 구조','사업구조','revenue structure','business model',
    '해자','moat','경쟁 우위','경쟁우위','competitive advantage','경쟁력',
    '기술력','기술 경쟁','tech','technology','R&D','연구개발','연구 개발',
    '전환비용','switching cost','네트워크 효과','network effect',
    '브랜드 파워','brand','규모의 경제','economies of scale',
    '진입 장벽','진입장벽','barrier','사업 포트폴리오','포트폴리오',
    '세그먼트','segment','사업부','사업 부문','지역별 매출',
    '경영진','CEO','리더십','leadership','내부자','insider',
    '공급망','supply chain','밸류체인','value chain',
    '핵심 역량','core competence','차별화','differentiation',
    '종합 분석','종합분석','심층 분석','심층분석','딥다이브','deep dive','기업 분석','기업분석',
    // v50.70: 기본 분석 요청도 17개 관점 자동 적용 — 티커 + 아래 키워드 조합 시 트리거
    '분석해','분석 해','분석좀','분석 좀','분석하','분석 하','분석을','분석 을',
    '알려줘','알려 줘','알려주','알려 주','설명해','설명 해','설명좀','설명 좀',
    '어때','어떄','어떻게 생각','어떻게 봐','어떻게봐','전망','투자','매수','매도',
    '살만','살 만','사도 될','사도될','괜찮','좋아','좋은가','어떤 회사','어떤회사',
    'analyze','analysis','tell me','explain','overview','invest','buy','sell',
    '리포트','report','리서치','research','조사','평가','검토','review',
    '재무','실적','펀더멘털','fundamental','적정가','목표가','밸류','valuation'
];
function _hasDeepAnalysisKw(text) {
  return _DEEP_ANALYSIS_KW.some(function(k) { return text.indexOf(k) !== -1; });
}
function _detectDeepCompareIntent(text) {
  var compareKw = [
    '비교','compare','vs','VS','대비','차이','다른점','다른 점','어떻게 다','뭐가 다','무엇이 다',
    '분석','analysis','어느 쪽','어디가','누가 더','어떤 게','둘 다','둘다','각각',
    '장단점','장점','단점','강점','약점','우위','열위','좋은 점','나쁜 점',
    '뭐가 좋','뭘 사','어떤 걸','어떤 게 더','뭐가 낫','뭐가 나',
    'pros','cons','advantage','disadvantage','strength','weakness',
    'better','worse','pick','choose','prefer','which'
  ];
  var hasDeep = _hasDeepAnalysisKw(text);
  var hasCompare = compareKw.some(function(k) { return text.indexOf(k) !== -1; });
  return hasDeep && hasCompare;
}

// 기업 내부 심층 데이터 조회 (비즈니스 모델, 수익 세그먼트, 해자 추론 지표)
async function _fetchDeepCompareData(tickers) {
  var fmpKey = _getApiKey('aio_fmp_key') || '';
  if (!fmpKey) return null;
  var results = {};

  for (var i = 0; i < tickers.length; i++) {
    var t = tickers[i];
    try {
      var _fmpUrl = 'https://financialmodelingprep.com/api/';
      var _fmpGet = function(ep) { return fetchWithTimeout(_fmpUrl + ep + (ep.indexOf('?')>-1?'&':'?') + 'apikey=' + fmpKey, {}, 6000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}); };
      var [profRes, revSegRes, revGeoRes, incRes, cfRes, growthRes, execRes, insiderRes, instRes, ratioRes,
           balRes, metricsRes, metricsTTMRes, peersRes, surprisesRes, evRes, estimatesRes, tgtRes, dcfRes] = await Promise.all([
        _fmpGet('v3/profile/' + t),
        _fmpGet('v4/revenue-product-segmentation?symbol=' + t + '&structure=flat&period=annual'),
        _fmpGet('v4/revenue-geographic-segmentation?symbol=' + t + '&structure=flat&period=annual'),
        _fmpGet('v3/income-statement/' + t + '?limit=3'),
        _fmpGet('v3/cash-flow-statement/' + t + '?limit=3'),
        _fmpGet('v3/financial-growth/' + t + '?limit=3'),
        _fmpGet('v3/key-executives/' + t),
        _fmpGet('v4/insider-trading?symbol=' + t + '&limit=15'),
        _fmpGet('v3/institutional-holder/' + t),
        _fmpGet('v3/ratios-ttm/' + t),
        // v34.2: 누락된 8개 엔드포인트 추가 — fundamentalSearch() 18개 완전 정합
        _fmpGet('v3/balance-sheet-statement/' + t + '?limit=3'),
        _fmpGet('v3/key-metrics/' + t + '?limit=3'),  // Annual (추이용)
        _fmpGet('v3/key-metrics-ttm/' + t),  // v35.4: TTM 추가
        _fmpGet('v4/stock_peers?symbol=' + t),
        _fmpGet('v3/earnings-surprises/' + t),
        _fmpGet('v3/enterprise-values/' + t + '?limit=1'),
        _fmpGet('v3/analyst-estimates/' + t + '?limit=4'),
        _fmpGet('v4/price-target-consensus?symbol=' + t),
        _fmpGet('v3/discounted-cash-flow/' + t)
      ]);
      results[t] = {
        profile: (profRes && profRes[0]) || null,
        revSegment: revSegRes || null,
        revGeo: revGeoRes || null,
        income: incRes || null,
        cashflow: cfRes || null,
        growth: growthRes || null,
        executives: execRes || null,
        insider: insiderRes || null,
        institutional: instRes || null,
        ratios: (ratioRes && ratioRes[0]) || null,
        balance: balRes || null,
        metrics: metricsRes || null,
        metricsTTM: (metricsTTMRes && metricsTTMRes[0]) || null,
        peers: (peersRes && peersRes[0] && peersRes[0].peersList) ? peersRes[0].peersList : null,
        surprises: surprisesRes ? (surprisesRes.slice ? surprisesRes.slice(0, 8) : null) : null,
        ev: (evRes && evRes[0]) || null,
        estimates: estimatesRes || null,
        priceTarget: (tgtRes && tgtRes[0]) || null,
        dcf: (dcfRes && dcfRes[0]) || null
      };
      // v41.9: Naver 보충 (한국어명, 기업개요, 컨센서스, 재무, 동종업종)
      try {
        var naverD = await fetchNaverUSData(t, true);
        if (naverD) {
          results[t].naver = naverD;
        }
      } catch(e2) {}
    } catch(e) {
      _aioLog('warn', 'fetch', '심층 데이터 조회 실패: ' + t + ' ' + e.message);
      results[t] = null;
    }
  }
  return results;
}

// 기업 내부 비교 데이터 → LLM 프롬프트 포맷
// v34.4: 단일 기업 심층 분석 포맷 함수 추가
function _formatSingleDeepPrompt(ticker, deepData) {
  if (!deepData || !deepData[ticker]) return '';
  // 데이터 블록은 _formatDeepComparePrompt와 동일 로직 재사용
  var dataPrompt = _formatDeepComparePrompt([ticker], deepData);
  if (!dataPrompt) return '';
  // 비교 분석 지침 → 단일 기업 심층 분석 지침으로 교체
  var cutIdx = dataPrompt.indexOf('【기업 비교 분석 지침');
  if (cutIdx > 0) dataPrompt = dataPrompt.slice(0, cutIdx);
  dataPrompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  dataPrompt += '【단일 기업 심층 분석 지침 — 17개 관점 프레임워크 (임원급 깊이)】\n';
  dataPrompt += '위 데이터를 기반으로, 기업 내부 전략기획팀이 이사회에 보고하는 수준의 깊이와 디테일로 분석하라.\n';
  dataPrompt += '17개 관점(기업 개요/설립 배경/경영진/비즈니스 모델/제품 포트폴리오/기술력&해자/수익 구조/재무제표/밸류에이션/시장 TAM/수요&공급망/파트너십/경쟁 구조/리스크/촉매·실적수정/포트폴리오 적합성/투자포인트) 전부 커버.\n';
  dataPrompt += '해자 7유형 판정(기술독점/네트워크효과/전환비용/브랜드/규모의경제/무형자산/FCF전환) 필수.\n';
  dataPrompt += '제공된 실제 숫자(세그먼트별 매출·R&D/매출·마진 추이·FCF마진·D/E·내부자 매매·DCF 적정가 등)를 반드시 인용.\n';
  dataPrompt += '시계열 트렌드를 읽어라 — "방향"이 "현재 값"보다 중요. 3개년 추이의 가속/감속을 반드시 언급.\n';
  dataPrompt += 'Bull Case(낙관) / Base Case(기본) / Bear Case(비관) 시나리오 + 깨지는 신호 필수.\n';
  dataPrompt += '단답·요약 절대 금지. 전문 리서치 리포트 수준의 깊이 있는 분석.\n';
  return dataPrompt;
}
function _formatDeepComparePrompt(tickers, deepData) {
  if (!deepData) return '';
  var _f = function(v, d) { return v != null && !isNaN(v) ? Number(v).toFixed(d||1) : 'N/A'; };
  var _fm = function(v) { if (!v) return 'N/A'; if (v >= 1e12) return '$' + (v/1e12).toFixed(1) + 'T'; if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B'; if (v >= 1e6) return '$' + (v/1e6).toFixed(0) + 'M'; return '$' + v; };
  var _pct = function(v) { return v != null && !isNaN(v) ? (v >= 0 ? '+' : '') + (v*100).toFixed(1) + '%' : 'N/A'; };

  var out = '\n\n【 기업 내부 비교 분석 데이터 (실시간 FMP)】\n';
  out += '비교 대상: ' + tickers.join(' vs ') + '\n\n';

  for (var i = 0; i < tickers.length; i++) {
    var t = tickers[i];
    var d = deepData[t];
    if (!d) { out += '━━━ ' + t + ': 데이터 조회 실패 ━━━\n\n'; continue; }

    out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    out += ' ' + t;
    var nv = d.naver || {};

    // 1. Profile — 비즈니스 모델 설명
    if (d.profile) {
      var p = d.profile;
      out += ' (' + (p.companyName||'') + (nv.nameKr ? ' / ' + nv.nameKr : '') + ')\n';
      out += '섹터: ' + (p.sector||'N/A') + ' | 산업: ' + (p.industry||'N/A') + (nv.industryKr ? ' (' + nv.industryKr + ')' : '') + ' | 시총: ' + _fm(p.mktCap) + ' | 직원: ' + (p.fullTimeEmployees ? Number(p.fullTimeEmployees).toLocaleString() + '명' : 'N/A') + '\n';
      out += 'IPO: ' + (p.ipoDate||'N/A') + ' | 국가: ' + (p.country||'N/A') + '\n';
      out += '\n【비즈니스 모델 설명】\n' + (p.description ? p.description.slice(0, 2000) : 'N/A') + '\n';
      if (nv.overview) out += '\n【기업개요 (한국어, Naver)】\n' + nv.overview.substring(0, 600) + '\n';
    } else { out += '\n'; }

    // 2. Revenue Segmentation — 사업부별 매출 구조
    if (d.revSegment && Array.isArray(d.revSegment) && d.revSegment.length > 0) {
      out += '\n【제품/사업부별 매출 구조】\n';
      var latest = d.revSegment[0] || {};
      var entries = Object.entries(latest);
      if (entries.length > 0) {
        var dateKey = entries[0];
        if (typeof dateKey[1] === 'object') {
          var segs = dateKey[1];
          var total = Object.values(segs).reduce(function(a,b){return a+(Number(b)||0);}, 0);
          Object.entries(segs).sort(function(a,b){return (Number(b[1])||0)-(Number(a[1])||0);}).forEach(function(s) {
            var pct = total > 0 ? ((Number(s[1])||0)/total*100).toFixed(1) : '?';
            out += '  • ' + s[0] + ': ' + _fm(Number(s[1])) + ' (' + pct + '%)\n';
          });
        }
      }
    }

    // 3. Revenue Geographic — 지역별 매출 분포
    if (d.revGeo && Array.isArray(d.revGeo) && d.revGeo.length > 0) {
      out += '\n【지역별 매출 분포】\n';
      var latestGeo = d.revGeo[0] || {};
      var geoEntries = Object.entries(latestGeo);
      if (geoEntries.length > 0) {
        var geoDateKey = geoEntries[0];
        if (typeof geoDateKey[1] === 'object') {
          var geos = geoDateKey[1];
          var gTotal = Object.values(geos).reduce(function(a,b){return a+(Number(b)||0);}, 0);
          Object.entries(geos).sort(function(a,b){return (Number(b[1])||0)-(Number(a[1])||0);}).forEach(function(g) {
            var pct = gTotal > 0 ? ((Number(g[1])||0)/gTotal*100).toFixed(1) : '?';
            out += '  • ' + g[0] + ': ' + _fm(Number(g[1])) + ' (' + pct + '%)\n';
          });
        }
      }
    }

    // 4. 손익 구조 (3개년) — 마진 추이 + R&D/SG&A 비중
    if (d.income && Array.isArray(d.income) && d.income.length > 0) {
      out += '\n【손익 구조 (3개년 추이)】\n';
      d.income.forEach(function(inc) {
        var rev = inc.revenue || 0;
        var gm = rev ? (inc.grossProfit / rev * 100) : 0;
        var rd = rev ? ((inc.researchAndDevelopmentExpenses || 0) / rev * 100) : 0;
        var sga = rev ? ((inc.sellingGeneralAndAdministrativeExpenses || 0) / rev * 100) : 0;
        var om = rev ? (inc.operatingIncome / rev * 100) : 0;
        var nm = rev ? (inc.netIncome / rev * 100) : 0;
        out += '  ' + (inc.calendarYear || inc.date || '?') + ': 매출 ' + _fm(rev) + ' | GM ' + _f(gm) + '% | R&D/매출 ' + _f(rd) + '% | SG&A/매출 ' + _f(sga) + '% | OM ' + _f(om) + '% | NM ' + _f(nm) + '%\n';
      });
    }

    // 5. 현금흐름 — FCF + CAPEX 강도
    if (d.cashflow && Array.isArray(d.cashflow) && d.cashflow.length > 0) {
      out += '\n【현금흐름 & 투자 강도 (3개년)】\n';
      d.cashflow.forEach(function(cf) {
        var opCF = cf.operatingCashFlow || 0;
        var capex = cf.capitalExpenditure || 0;
        var fcf = cf.freeCashFlow || (opCF + capex);
        var rev = (d.income && d.income.find(function(ic){return ic.calendarYear === cf.calendarYear;}) || {}).revenue || 0;
        var capexRev = rev ? (Math.abs(capex) / rev * 100) : 0;
        var fcfMargin = rev ? (fcf / rev * 100) : 0;
        out += '  ' + (cf.calendarYear || cf.date || '?') + ': OpCF ' + _fm(opCF) + ' | CAPEX ' + _fm(Math.abs(capex)) + ' (' + _f(capexRev) + '% of rev) | FCF ' + _fm(fcf) + ' (FCF마진 ' + _f(fcfMargin) + '%) | 자사주매입 ' + _fm(Math.abs(cf.commonStockRepurchased||0)) + ' | 배당 ' + _fm(Math.abs(cf.dividendsPaid||0)) + '\n';
      });
    }

    // 6. 성장률 추이
    if (d.growth && Array.isArray(d.growth) && d.growth.length > 0) {
      out += '\n【성장률 추이】\n';
      d.growth.slice(0, 3).forEach(function(g) {
        out += '  ' + (g.calendarYear || g.date || '?') + ': 매출성장 ' + _pct(g.revenueGrowth) + ' | EPS성장 ' + _pct(g.epsgrowth || g.epsdilutedGrowth) + ' | 순이익성장 ' + _pct(g.netIncomeGrowth) + ' | FCF성장 ' + _pct(g.freeCashFlowGrowth) + '\n';
      });
    }

    // 7. 경영진 (상위 5명)
    if (d.executives && Array.isArray(d.executives) && d.executives.length > 0) {
      out += '\n【핵심 경영진】\n';
      d.executives.slice(0, 5).forEach(function(ex) {
        out += '  • ' + (ex.name||'?') + ' — ' + (ex.title||'?') + (ex.pay ? ' | 보상: ' + _fm(ex.pay) : '') + '\n';
      });
    }

    // 8. 내부자 거래 (최근 10건 요약)
    if (d.insider && Array.isArray(d.insider) && d.insider.length > 0) {
      var buys = d.insider.filter(function(tr){return tr.acquistionOrDisposition === 'A' || (tr.transactionType||'').indexOf('Purchase') !== -1;});
      var sells = d.insider.filter(function(tr){return tr.acquistionOrDisposition === 'D' || (tr.transactionType||'').indexOf('Sale') !== -1;});
      out += '\n【내부자 거래 (최근)】 매수 ' + buys.length + '건 | 매도 ' + sells.length + '건';
      if (buys.length > sells.length) out += ' → 매수 우위 (경영진 자신감 시그널)';
      else if (sells.length > buys.length * 2) out += ' → 매도 우위 (경계 시그널)';
      out += '\n';
    }

    // 9. 기관 투자자 (상위 5곳)
    if (d.institutional && Array.isArray(d.institutional) && d.institutional.length > 0) {
      out += '\n【주요 기관 투자자】\n';
      d.institutional.slice(0, 5).forEach(function(inst) {
        out += '  • ' + (inst.holder||'?') + ': ' + (inst.shares ? Number(inst.shares).toLocaleString() + '주' : 'N/A') + (inst.dateReported ? ' (' + inst.dateReported.slice(0,10) + ')' : '') + '\n';
      });
    }

    // 10. 핵심 밸류에이션 (비교 기준용)
    if (d.ratios) {
      var rt = d.ratios;
      out += '\n【밸류에이션 요약】 PER ' + _f(rt.peRatioTTM) + 'x | PBR ' + _f(rt.priceToBookRatioTTM) + 'x | PEG ' + _f(rt.pegRatioTTM) + ' | EV/EBITDA ' + _f(rt.enterpriseValueOverEBITDATTM) + 'x | ROE ' + _f(rt.returnOnEquityTTM ? rt.returnOnEquityTTM*100 : null) + '% | ROIC ' + _f(rt.returnOnCapitalEmployedTTM ? rt.returnOnCapitalEmployedTTM*100 : null) + '%\n';
    }

    // 11. 대차대조표 핵심 (재무 건전성)
    if (d.balance && Array.isArray(d.balance) && d.balance.length > 0) {
      out += '\n【재무 건전성 (대차대조표)】\n';
      d.balance.slice(0, 2).forEach(function(bs) {
        var de = bs.totalStockholdersEquity ? (bs.totalDebt / bs.totalStockholdersEquity) : null;
        var cr = bs.totalCurrentLiabilities ? (bs.totalCurrentAssets / bs.totalCurrentLiabilities) : null;
        out += '  ' + (bs.calendarYear || bs.date || '?') + ': 총자산 ' + _fm(bs.totalAssets) + ' | 총부채 ' + _fm(bs.totalDebt) + ' | 자기자본 ' + _fm(bs.totalStockholdersEquity) + ' | D/E ' + _f(de,2) + ' | 유동비율 ' + _f(cr,2) + ' | 현금 ' + _fm(bs.cashAndCashEquivalents) + ' | Goodwill ' + _fm(bs.goodwill) + '\n';
      });
    }

    // 12. 핵심 투자 지표 — TTM 우선 + Annual 추이
    if (d.metricsTTM) {
      var _kmt = d.metricsTTM;
      out += '\n【핵심 투자 지표 (TTM)】 EV/EBITDA ' + _f(_kmt.enterpriseValueOverEBITDATTM) + 'x | FCF Yield ' + _f(_kmt.freeCashFlowYieldTTM ? _kmt.freeCashFlowYieldTTM*100 : null) + '% | ROIC ' + _f(_kmt.roicTTM ? _kmt.roicTTM*100 : null) + '% | 배당수익률 ' + _f(_kmt.dividendYieldTTM ? _kmt.dividendYieldTTM*100 : null) + '%\n';
    }
    if (d.metrics && Array.isArray(d.metrics) && d.metrics.length > 0) {
      out += '【핵심 투자 지표 (Annual 추이)】\n';
      d.metrics.slice(0, 2).forEach(function(km) {
        out += '  ' + (km.calendarYear || km.date || '?') + ': EV/EBITDA ' + _f(km.enterpriseValueOverEBITDA) + 'x | FCF Yield ' + _f(km.freeCashFlowYield ? km.freeCashFlowYield*100 : null) + '% | ROIC ' + _f(km.roic ? km.roic*100 : null) + '% | 배당수익률 ' + _f(km.dividendYield ? km.dividendYield*100 : null) + '%\n';
      });
    }

    // 13. 실적 서프라이즈
    if (d.surprises && Array.isArray(d.surprises) && d.surprises.length > 0) {
      var beats = d.surprises.filter(function(s){return s.actualEarningResult && s.estimatedEarning && s.actualEarningResult > s.estimatedEarning;}).length;
      out += '\n【실적 서프라이즈】 최근 ' + d.surprises.length + '분기 중 ' + beats + '회 비트';
      if (beats >= d.surprises.length * 0.75) out += ' (일관된 실적 상회 → 경영 실행력 강점)';
      out += '\n';
    }

    // 14. 애널리스트 추정치
    if (d.estimates && Array.isArray(d.estimates) && d.estimates.length > 0) {
      out += '\n【애널리스트 추정 (향후 전망)】\n';
      d.estimates.slice(0, 2).forEach(function(est) {
        out += '  ' + (est.date||'?') + ': EPS추정 $' + _f(est.estimatedEpsAvg,2) + ' (Low $' + _f(est.estimatedEpsLow,2) + ' ~ High $' + _f(est.estimatedEpsHigh,2) + ') | 매출추정 ' + _fm(est.estimatedRevenueAvg) + '\n';
      });
    }

    // 15. 목표가 컨센서스 + DCF 적정가
    if (d.priceTarget || d.dcf) {
      out += '\n【밸류에이션 앵커】';
      if (d.priceTarget) {
        var tg = d.priceTarget;
        out += ' 목표가: $' + _f(tg.targetConsensus,2) + ' ($' + _f(tg.targetLow,2) + '~$' + _f(tg.targetHigh,2) + ')';
      }
      if (d.dcf) {
        out += ' | DCF 적정가: $' + _f(d.dcf.dcf,2) + ' (현재가 $' + _f(d.dcf.Stock_Price || d.dcf.stockPrice,2) + ')';
      }
      out += '\n';
    }

    // 16. Naver 컨센서스 교차 검증 + 재무 + 동종업종
    if (nv.consensus) {
      var nc = nv.consensus;
      out += '\n【Naver 컨센서스 (교차 검증)】 목표가: $' + _f(nc.targetMean,2) + ' ($' + _f(nc.targetLow,2) + '~$' + _f(nc.targetHigh,2) + ') | 추천: ' + _f(nc.recommMean,2) + '/5\n';
    }
    if (nv.financials && Object.keys(nv.financials).length > 0) {
      out += '\n【Naver 재무 데이터' + (nv.finUnit ? ' (' + nv.finUnit + ')' : '') + '】\n';
      Object.entries(nv.financials).slice(0, 15).forEach(function(kv) { out += '  ' + kv[0] + ': ' + kv[1] + '\n'; });
    }
    if (nv.peers && nv.peers.length > 0) {
      out += '\n【Naver 동종업종 비교】\n';
      nv.peers.forEach(function(peer) { out += '  ' + peer.sym + ' ' + peer.name + ': $' + peer.price + ' (' + (peer.chg>=0?'+':'') + peer.chg + '%) | 시총 ' + (peer.mcap||'N/A') + '\n'; });
    }

    // 17. 경쟁사 목록
    if (d.peers && Array.isArray(d.peers) && d.peers.length > 0) {
      out += '\n【경쟁사 그룹】 ' + d.peers.slice(0, 8).join(', ') + '\n';
    }

    out += '\n';
  }

  // 비교 분석 지침 — 17개 관점 완전 커버 (기업 내부 임원급 깊이)
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  out += '【기업 비교 분석 지침 — 17개 관점 프레임워크 (임원급 심층 분석)】\n';
  out += '위 데이터를 기반으로, 기업 내부 임원이 이사회에서 경쟁사 대비 분석을 발표하는 수준의 깊이와 디테일로 비교하라.\n';
  out += '단답·요약 금지. 각 관점에서 구체적 숫자를 인용하고, 그 숫자가 "왜 중요한지"까지 해석하라.\n\n';

  out += '1. 【기업 개요 비교】 각 기업의 한 문장 정의 → 시총·매출·직원·섹터 나란히 비교. "규모의 차이가 의미하는 것"까지 해석. 데이터: profile(companyName, sector, industry, mktCap, fullTimeEmployees)\n\n';

  out += '2. 【설립 배경 & 성장 과정 비교】 각 기업의 창업 스토리 → 핵심 피벗 포인트 → 현재 위치. 성장 궤적의 유사점과 차이점. IPO 시점 대비 현재 규모 성장 비교. 데이터: profile(ipoDate, description)\n\n';

  out += '3. 【경영진 분석 비교】 CEO/핵심 경영진의 이력·직급·보상구조 비교. 주주 친화도(자사주매입+배당 정책) 비교. 내부자 매매 패턴(매수 우위 vs 매도 우위) 비교 → "어느 쪽 경영진이 자기 회사에 더 자신감을 보이는가?" 내부자 매수 증가=자신감 시그널, 대량 매도=경계. CEO 보상/직원 평균 임금 비율로 거버넌스 문화 추론. 데이터: executives + insider + cashflow(commonStockRepurchased, dividendsPaid)\n\n';

  out += '4. 【비즈니스 모델 비교】 각 기업이 돈을 버는 메커니즘 대조. 구독형 vs 거래형 vs 플랫폼 vs 하드웨어+서비스. 반복매출(recurring revenue) 비중 추정. 단위경제(LTV/CAC 프록시: SG&A/매출 추이로 고객 획득 효율 추론). "누가 더 예측 가능한 매출 구조를 가졌는가?" 데이터: profile.description + income(SG&A 추이) + revSegment\n\n';

  out += '5. 【제품 & 서비스 포트폴리오 비교】 세그먼트별 매출 비중 나란히 비교. 각 세그먼트의 성장성과 수익성 추정. 매출 집중도 비교 — 한 세그먼트에 50%+ 의존 시 리스크 명시. 신규 세그먼트 확장 여부와 매출 다각화 수준 비교. "누가 더 건강한 포트폴리오를 가졌는가?" 데이터: revSegment(제품별 매출 비중%)\n\n';

  out += '6. 【기술력 & 경쟁 우위(Moat) 비교】 7가지 해자 유형별 비교 판정:\n';
  out += '  ① 기술 독점: R&D/매출 비교 (15%+ = 기술 집약). R&D 3년 추이 비교 — 누가 더 공격적으로 투자하나?\n';
  out += '  ② 네트워크 효과: 매출성장률 > SG&A 증가율 = 유기적 성장(네트워크 효과). SG&A/매출 하락 추세 비교\n';
  out += '  ③ 전환비용: GM 60%+ 안정 유지 = 전환비용 존재. 구독/SaaS 모델이면 내재적 전환비용\n';
  out += '  ④ 브랜드 파워: GM 50%+ + SG&A/매출 하락 = 브랜드 인지도로 마케팅 효율 확보\n';
  out += '  ⑤ 규모의 경제: OpMargin 3년 연속 개선 + 매출 성장 = 규모의 경제 작동 중. CAPEX/매출 하락 = 고정비 레버리지\n';
  out += '  ⑥ 무형자산: description에서 라이선스/규제 허가/정부 계약/독점 데이터 키워드 탐지\n';
  out += '  ⑦ FCF 전환: FCF마진 20%+ = 이익이 실제 현금으로 전환(이익의 질 높음)\n';
  out += '  → 각 기업의 해자 강도 판정: Wide(3개+ 충족) / Narrow(1~2개) / None. "누가 더 넓은 해자를 보유하고 있는가?"\n';
  out += '  해자 약화 경고: R&D/매출 하락 + 마진 축소 + 성장률 저하 = 해자 침식 중\n';
  out += '  데이터: income(R&D/SG&A/OpMargin) + cashflow(CAPEX/FCF) + profile.description + growth\n\n';

  out += '7. 【수익 구조 비교】 지역별 매출 분포 나란히 비교 → 지정학 리스크 노출도 비교. 세그먼트별+지역별 교차 분석. GM→OM→NM 마진 폭포(waterfall) 비교 — "어디서 마진이 새는가?" 마진 3개년 추이의 방향(개선/악화/안정) 비교. 데이터: revGeo + revSegment + income(마진 추이)\n\n';

  out += '8. 【재무제표 심층 비교】\n';
  out += '  • 손익: 매출·이익 성장 트렌드 나란히 비교. EPS 성장 방향(가속 vs 감속)\n';
  out += '  • 대차대조표: D/E 비율, 유동비율, 현금/총자산 비율, Goodwill/총자산 비율 비교. Red Flags(재고 급증/매출채권 급증/Goodwill 과다) 점검\n';
  out += '  • 현금흐름: 영업CF vs 순이익(이익의 질) 비교. FCF 마진 비교. 자사주매입+배당(주주환원) 비교\n';
  out += '  • Dupont ROE 분해: 순이익률 × 자산회전 × 레버리지 → "같은 ROE라도 어떤 경로로 달성했는가?"\n';
  out += '  데이터: income + balance + cashflow + ratios + metrics\n\n';

  out += '9. 【밸류에이션 비교】 현재 PER/PBR/PEG/EV-EBITDA 나란히 비교 → "누가 더 싼가?" 그리고 "왜 그 밸류에이션을 받는가?" 밸류에이션 삼중 비교: 현재 멀티플 vs 애널리스트 목표가 vs DCF 적정가. 셋 다 저평가 시 = 진정한 저평가. 하나만 저평가 시 = 밸류 트랩 주의. 데이터: ratios + priceTarget + dcf + estimates + ev\n\n';

  out += '10. 【시장 분석 (TAM/SAM/SOM) 비교】 각 기업이 겨냥하는 시장 규모 추정. 시장 점유율과 침투율 비교. 시장 확대 트리거(메가트렌드) 비교. "누가 더 큰 시장 기회를 가졌는가?" 데이터: profile.description + revSegment + growth에서 추론\n\n';

  out += '11. 【수요 & 공급망 비교】 수요 드라이버(어떤 메가트렌드가 수요를 만드는가) 비교. 공급망 구조와 핵심 부품/원자재 의존도. 지역별 매출로 지정학 공급 리스크 판단. 데이터: revGeo + profile.description + income(매출총이익률 변동으로 원자재 영향 추론)\n\n';

  out += '12. 【협력 & 파트너십 비교】 주요 고객 집중도(상위 고객 매출 비중 추정). 밸류체인에서의 포지션. 기관 투자자 구성으로 "어떤 펀드가 주목하는지" 비교 — 기관 Top5의 유사성/차이점. 데이터: institutional + profile.description\n\n';

  out += '13. 【경쟁 구조 비교】 경쟁사 그룹 겹침 분석 — 공통 경쟁사가 있는가? 포터의 5가지 경쟁력 기준 비교. 차별화 포인트 비교. 밸류에이션·성장률·마진을 경쟁사 대비 포지셔닝. 데이터: peers + ratios + growth\n\n';

  out += '14. 【리스크 비교】 각 리스크의 가능성(H/M/L)과 영향도(H/M/L) 매트릭스 비교:\n';
  out += '  • 사업 리스크: 경쟁 심화, 기술 대체, 매출 집중도\n';
  out += '  • 재무 리스크: 부채 수준(D/E), 유동성, 이자보상배율\n';
  out += '  • 규제 리스크: 독점 규제, 수출 규제, 환경 규제\n';
  out += '  • 매크로 리스크: 금리·환율·경기 민감도(베타로 추정)\n';
  out += '  → "어느 기업이 더 리스크가 높은가? 어떤 유형의 리스크인가?"\n';
  out += '  데이터: balance(D/E) + profile(beta) + revGeo(지정학) + income(마진 변동성)\n\n';

  out += '15. 【투자 포인트 종합 — 최종 비교 판정】\n';
  out += '  • Bull/Base/Bear 시나리오별 비교: 각 기업의 낙관/기본/비관 시나리오\n';
  out += '  • 핵심 카탈리스트 비교: 실적 서프라이즈 이력, 신제품, M&A 가능성\n';
  out += '  • 내부자 매매 방향이 시사하는 바 비교\n';
  out += '  • 종합 비교표: 17개 관점의 핵심 수치와 결측 데이터를 한 눈에 볼 수 있는 비교표\n';
  out += '  • 최종 판정: "A는 ___에서 확실한 우위, B는 ___에서 확실한 우위. 투자자 유형별 추천: 성장 투자자라면 A, 가치 투자자라면 B"\n';
  out += '  데이터: 위 모든 데이터 종합\n\n';

  out += '【응답 프레임워크 — "기업을 하나의 이야기로 비교"】\n';
  out += '• 17개 관점을 기계적으로 나열하지 마라. 두 기업의 핵심 차이가 무엇인지를 축으로, "왜 이 둘이 다른 길을 걸어왔는가"의 서사로 연결하라.\n';
  out += '• 실제 수집된 데이터의 구체적 숫자를 반드시 인용하라 — 학습 데이터의 과거 수치 사용 금지.\n';
  out += '• 팩트(숫자로 확인된 사실)와 전망(검증되지 않은 기대)을 명확히 구분하라.\n';
  out += '• 시계열 트렌드를 읽어라 — "방향"이 "현재 값"보다 중요. 3개년 추이의 가속/감속을 반드시 언급.\n';
  out += '• 17개 관점을 모두 다루되, 해당 기업들의 핵심 차별점이 되는 2~3개 관점은 특히 깊이 있게 다뤄라.\n';
  out += '• 단답·요약 금지. 기업 내부 전략기획팀이 이사회에 보고하는 수준의 깊이와 디테일로 분석하라.\n';

  return out;
}

// ═══ v36.2: Perplexity Sonar AI 웹검색 엔진 ═══════════════════════════
// 사용자 질문을 분석하여 최신 정보가 필요하면 Perplexity API로 웹검색 후
// 검색 결과를 시스템 프롬프트에 주입 — AI가 최신 이벤트/뉴스/전망 기반 답변 가능

/**
 * 웹검색이 필요한 질문인지 자동 판단
 * @returns {string|null} 검색 쿼리 또는 null
 */
// ── 뉴스 컨텍스트 파이프라인 계약 ──────────────────────────────────────────────
// 공급원 → 소비자 흐름:
//   newsCache(aio-data.js fetchNews 24h) → _buildNewsContext → LLM 시스템 프롬프트
//   AIO_TELEGRAM_WEEKLY_DIGEST → _buildTelegramContext → 동일 파이프라인
//   native screener state + identity/memo boundary → _formatScreenerResultPrompt
//
// _CTX_TOPIC_MAP: 페이지ID → topic 배열. _buildNewsContext가 newsCache를 topic 필터로 선별.
//   topic 값은 aio-data.js fetchNews의 item.topics 배열과 일치해야 함(계약 지점).
//   새 페이지 추가 시 이 맵에도 등록 필요.
var _CTX_TOPIC_MAP = {
  // ── 미국 시장 ──
  'home':        ['macro','geo','energy','semi','earnings','equity','healthcare','defense'],
  'signal':      ['macro','equity','semi','earnings','healthcare'],
  'breadth':     ['macro','equity'],
  'sentiment':   ['macro','equity','geo','energy'],
  'briefing':    ['macro','geo','energy','semi','earnings','equity','healthcare','defense','space','quantum'],
  'technical':   ['macro','equity','semi'],
  'macro':       ['macro','geo','energy','bond','fx'],
  'fundamental': ['earnings','equity','semi','energy','healthcare'],
  'themes':      ['semi','energy','crypto','defense','equity','healthcare','shipbuilding','space','quantum'],
  'screener':    ['earnings','equity','semi','energy','healthcare','defense','shipbuilding'],
  'options':     ['macro','equity','semi'],
  'portfolio':   ['macro','equity','semi','earnings','energy','geo','healthcare','defense'],
  'fxbond':      ['fx','bond','macro','geo','energy'],
  'mentor':      ['macro','equity','semi','earnings','healthcare'],
  // ── 한국 시장 ──
  'kr-macro':    ['macro','geo','energy','fx','bond','equity'],
  'kr-tech':     ['semi','earnings','equity','quantum'],
  'kr-supply':   ['macro','equity','semi','fx'],
  'kr-themes':   ['semi','energy','defense','equity','earnings','healthcare','shipbuilding','space']
};

function _buildNewsContext(ctxId, query) {
  if (!newsCache || newsCache.length === 0) return '';

  var topics = _CTX_TOPIC_MAP[ctxId] || ['macro','geo','energy'];
  var q = (query || '').toLowerCase();
  var now = Date.now();
  var H24 = 24 * 3600000;

  // 24시간 이내 뉴스만
  var recent = newsCache.filter(function(it) {
    if (!it.pubDate) return false;
    return (now - new Date(it.pubDate).getTime()) < H24;
  });

  // 관련도 스코어링: 토픽 매칭 + 질문 키워드 매칭 + 기존 score
  var scored = recent.map(function(it) {
    var rel = 0;
    // 토픽 매칭
    if (topics.indexOf(it.topic) !== -1) rel += 10;
    // 질문 키워드가 제목에 포함
    var title = (it.title || '').toLowerCase();
    var words = q.split(/\s+/).filter(function(w) { return w.length > 2; });
    words.forEach(function(w) { if (title.indexOf(w) !== -1) rel += 5; });
    // 기존 뉴스 중요도 점수 반영
    rel += Math.min((it.score || 0) / 10, 5);
    // 신선도 보너스 (6시간 이내 +3)
    if (it.pubDate && (now - new Date(it.pubDate).getTime()) < 6 * 3600000) rel += 3;
    return { item: it, rel: rel };
  });

  // 토픽 매칭 또는 질문 키워드 매칭된 것만
  scored = scored.filter(function(s) { return s.rel >= 10; });
  scored.sort(function(a, b) { return b.rel - a.rel; });

  // 상위 5건 (토큰 절약)
  var top = scored.slice(0, 5);
  if (top.length === 0) return '';

  // v48.12: 제목 + 본문 요약(desc 또는 summary) 120자까지 주입 — "왜 올랐나/내렸나" 맥락 제공
  //         기관 리서치처럼 '이유와 근거'를 AI가 설명하려면 헤드라인만으로 부족
  // v48.55: 뉴스 언급 티커 배열 구조화 주입 (사용자 지적 "뉴스/소식 파이프라인에서 관련 기업 정보 있으면 가져오고")
  var mentionedTickers = new Set();
  var lines = top.map(function(s, idx) {
    var it = s.item;
    var age = it.pubDate ? Math.round((now - new Date(it.pubDate).getTime()) / 3600000) : '?';
    var tr = (window._aioGetNewsTranslation && typeof window._aioGetNewsTranslation === 'function') ? window._aioGetNewsTranslation(it) : null;
    var title = ((tr && tr.ko_title) || it.title || '').substring(0, 120);
    var descRaw = ((tr && (tr.ko_rewrite || tr.ko_summary || tr.ko_desc)) || it.desc || it.summary || it.description || '').toString().replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    var explainRaw = tr && tr.ko_explain ? String(tr.ko_explain).replace(/\s+/g, ' ').trim() : '';
    var impactRaw = tr && tr.ko_impact ? String(tr.ko_impact).replace(/\s+/g, ' ').trim() : '';
    var actionRaw = tr && tr.ko_action ? String(tr.ko_action).replace(/\s+/g, ' ').trim() : '';
    var marketRaw = tr && tr.ko_market ? String(tr.ko_market).replace(/\s+/g, ' ').trim() : '';
    var descShort = descRaw ? descRaw.substring(0, 140) + (descRaw.length > 140 ? '…' : '') : '';
    // v48.55: 각 뉴스 item의 티커 수집 (extractTickers + cached 티커 병합)
    descShort = descRaw ? descRaw.substring(0, 160) + (descRaw.length > 160 ? '...' : '') : '';
    var itemTickers = [];
    try {
      if (typeof getDisplayTickers === 'function') itemTickers = getDisplayTickers(it) || [];
      else if (it.tickers && Array.isArray(it.tickers)) itemTickers = it.tickers;
      else if (typeof extractTickers === 'function') itemTickers = (extractTickers(it) || []).map(function(t){ return '$' + t; });
    } catch(_){}
    itemTickers.forEach(function(t) { mentionedTickers.add(t.replace('$','').toUpperCase()); });
    var tickerTag = itemTickers.length > 0 ? ' [' + itemTickers.slice(0, 3).join(' ') + ']' : '';
    var line = (idx + 1) + '. [' + (it.source || '?') + ' · ' + age + 'h전]' + tickerTag + ' ' + title;
    if (descShort) line += '\n   └ ' + descShort;
    if (marketRaw) line += '\n   시장 의미: ' + marketRaw.substring(0, 130) + (marketRaw.length > 130 ? '...' : '');
    if (explainRaw) line += '\n   해석: ' + explainRaw.substring(0, 150) + (explainRaw.length > 150 ? '...' : '');
    if (impactRaw) line += '\n   영향: ' + impactRaw.substring(0, 130) + (impactRaw.length > 130 ? '...' : '');
    if (actionRaw) line += '\n   확인: ' + actionRaw.substring(0, 130) + (actionRaw.length > 130 ? '...' : '');
    return line;
  });

  // v48.55: 뉴스 언급 티커 집계 (별도 섹션으로 프롬프트 주입 → AI가 관련 종목 추적 가능)
  var tickerSummary = '';
  if (mentionedTickers.size > 0) {
    var tkrList = Array.from(mentionedTickers).slice(0, 15).join(', ');
    tickerSummary = '【뉴스 언급 티커 (상위 ' + Math.min(15, mentionedTickers.size) + ')】\n' + tkrList + '\n\n';
  }

  return '\n\n【최근 시장 뉴스 (자동 수집, 24h 이내)】\n' +
    '아래는 스크리너가 자동 수집한 관련 뉴스 헤드라인 + 요약이다. 각 뉴스의 시간(Nh전)을 확인하고, 주가 추이와 교차 검증 후 답변하라. 제목만으로 과도한 해석 금지, 단 요약의 사실 근거(숫자·기관명·인용)는 적극 활용. 각 뉴스의 [$TICKER] 태그로 관련 기업 식별 가능.\n' +
    lines.join('\n') + '\n\n' +
    tickerSummary;
}

// v50.15 (사용자 지적: 개별 기업 뉴스/소식 약함 → 개별 기업 분석 시 RSS/텔레그램 캐시를 종목별로 연결)
// newsCache(60+ 소스 · 텔레그램 기관 리포트 포함, scoreItem이 이미 extractTickers로 티커 검출)를 특정 종목으로 필터.
// _buildNewsContext는 토픽 기반 일반 24h 뉴스 — 이 함수는 종목 타겟 + 7일 윈도우(기업 분석 맥락). API 키 불요.
function _aioTickerNewsFromCache(ticker, opts) {
  opts = opts || {};
  try {
    var cache = (typeof newsCache !== 'undefined' && newsCache && newsCache.length) ? newsCache
              : ((window._allNewsItems && window._allNewsItems.length) ? window._allNewsItems : []);
    if (!cache || !cache.length) return '';
    var now = Date.now();
    var windowH = opts.windowHours || 168; // 기본 7일
    var sym = String(ticker || '').toUpperCase().replace(/\.(KS|KQ|KO)$/, '').trim();
    if (!sym || sym.length < 1) return '';
    // 종목명 별칭 수집 — KR 코드→한글명(KR_STOCK_DB 기존 인프라) + 레지스트리 역매핑 + 원본
    var aliases = [];
    var rawUpper = String(ticker || '').toUpperCase().trim();
    function _addAlias(a) { a = String(a || '').toUpperCase().trim(); if (a && aliases.indexOf(a) === -1) aliases.push(a); }
    _addAlias(sym); _addAlias(rawUpper);
    try {
      var _krCode = sym.replace(/\D/g, '');
      var _kdb = window.KR_STOCK_DB;
      if (_kdb && /^\d{6}$/.test(_krCode) && _kdb[_krCode] && _kdb[_krCode].name) _addAlias(_kdb[_krCode].name); // 005930 → 삼성전자 (뉴스는 한글명으로 표기)
    } catch (_k) {}
    try {
      var reg = window.AIO_TICKER_NAME_REGISTRY;
      if (reg) {
        Object.keys(reg).forEach(function(name) {
          var v = String(reg[name] || '').toUpperCase().replace(/\.(KS|KQ|KO)$/, '');
          if (v === sym && name && name.length >= 2) _addAlias(name);
        });
      }
    } catch (_a) {}
    var matched = [];
    for (var i = 0; i < cache.length; i++) {
      var it = cache[i];
      if (!it) continue;
      if (it.pubDate && (now - new Date(it.pubDate).getTime()) > windowH * 3600000) continue;
      var hit = false;
      // 1) 구조화된 티커 매칭 — extractTickers 결과(US 심볼·KR 한글명 모두)를 전 별칭과 대조
      try {
        var its = [];
        if (it.tickers && Array.isArray(it.tickers)) its = it.tickers;
        else if (typeof extractTickers === 'function') its = extractTickers(it) || [];
        for (var k = 0; k < its.length && !hit; k++) {
          var ts = String(its[k]).toUpperCase().replace(/^\$/, '').replace(/\.(KS|KQ|KO)$/, '');
          if (aliases.indexOf(ts) !== -1) hit = true;
        }
      } catch (_t) {}
      // 2) 제목/본문 별칭 매칭 — CJK 한글명(부분일치) OR 6자리 코드 OR 영문 길이≥4(단어경계).
      //    영문 2~3자(ON/AI/AMD/ARM 등)는 일반 단어 오탐 위험 → blob 스킵하고 구조화 extractTickers만 신뢰.
      if (!hit) {
        var blob = ((it.title || '') + ' ' + (it.desc || it.summary || it.description || '')).toUpperCase();
        for (var a = 0; a < aliases.length && !hit; a++) {
          var al = aliases[a];
          var isCJK = /[가-힯一-鿿぀-ヿ]/.test(al);
          if (isCJK) {
            if (al.length >= 2 && blob.indexOf(al) !== -1) hit = true;
          } else if (/^\d{6}$/.test(al)) {
            if (blob.indexOf(al) !== -1) hit = true; // 6자리 종목코드는 변별력 충분
          } else if (al.length >= 4) {
            var re = new RegExp('(^|[^A-Z0-9])' + al.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z0-9]|$)');
            if (re.test(blob)) hit = true;
          }
        }
      }
      if (hit) matched.push(it);
    }
    if (!matched.length) return '';
    matched.sort(function(a, b) {
      var ds = (b.score || 0) - (a.score || 0);
      if (ds) return ds;
      var fa = a.pubDate ? (now - new Date(a.pubDate).getTime()) : 9e15;
      var fb = b.pubDate ? (now - new Date(b.pubDate).getTime()) : 9e15;
      return fa - fb;
    });
    var top = matched.slice(0, opts.max || 6);
    var lines = top.map(function(it, idx) {
      var age = it.pubDate ? Math.round((now - new Date(it.pubDate).getTime()) / 3600000) + 'h전' : '?';
      var tr = (window._aioGetNewsTranslation && typeof window._aioGetNewsTranslation === 'function') ? window._aioGetNewsTranslation(it) : null;
      var title = ((tr && tr.ko_title) || it.title || '').toString().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').substring(0, 120);
      var descRaw = ((tr && (tr.ko_rewrite || tr.ko_summary || tr.ko_desc)) || it.desc || it.summary || it.description || '').toString().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      var descShort = descRaw ? '\n     └ ' + descRaw.substring(0, 150) + (descRaw.length > 150 ? '…' : '') : '';
      return '    ' + (idx + 1) + '. [' + (it.source || '?') + ' · ' + age + '] ' + title + descShort;
    });
    return '  [' + sym + ' 종목 뉴스 · source RSS/텔레그램 자동수집 캐시(60+ 소스·기관 리포트 포함) · 최근 ' + Math.round(windowH / 24) + '일 · ' + matched.length + '건 중 Top ' + top.length + ']\n' + lines.join('\n');
  } catch (e) { return ''; }
}

function _aioChatTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣$.\s]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w && w.length >= 2; })
    .slice(0, 120);
}

function _classifyChatIntent(query, ctxId) {
  var q = String(query || '').toLowerCase();
  var intents = [];
  function hit(name, re) { if (re.test(q)) intents.push(name); }
  hit('ACTION_DECISION', /매수|매도|보유|손절|익절|추가매수|비중|trim|exit|hold|buy|sell|hedge|entry|stop/);
  hit('LATEST_CHECK', /최신|최근|오늘|지금|방금|이번\s*주|현재|상황|뉴스|소식|latest|recent|today|now|this week/);
  hit('DEEP_RESEARCH', /심층|자세|상세|분석|리서치|기관|펀드|bull|bear|시나리오|카탈리스트|리스크|valuation|밸류|재무|moat|해자/);
  hit('COMPARE_SCREEN', /비교|추천|골라|찾아|스크리닝|순위|top|best|compare|screen|rank|undervalued|overvalued/);
  hit('EXPLAIN_BEGINNER', /초보|쉽게|설명|무슨 뜻|뭐야|개념|용어|how to|explain|beginner/);
  hit('TECHNICAL_SETUP', /technical|chart|rsi|macd|bollinger|support|resistance|breakout|breakdown|trend|setup|손절|익절|진입|저항|지지|차트|기술/);
  hit('VALUATION_MODEL', /valuation|dcf|multiple|per|pbr|ev\/ebitda|fair value|intrinsic|owner earnings|밸류|가치평가|적정가|멀티플/);
  hit('EARNINGS_REVIEW', /earnings|eps|revenue|margin|guidance|surprise|beat|miss|실적|어닝|매출|마진|가이던스|컨센서스/);
  hit('PORTFOLIO_RISK', /portfolio|position|weight|rebalance|allocation|drawdown|risk budget|포트폴리오|비중|리밸런싱|헤지|위험|손실/);
  hit('MACRO_LINKAGE', /macro|fed|fomc|cpi|pce|rates?|yield|dollar|oil|fx|bond|매크로|금리|환율|달러|유가|채권|인플레/);
  hit('CATALYST_RISK', /catalyst|risk|event|lawsuit|regulation|approval|launch|conference|카탈리스트|리스크|이벤트|규제|소송|승인|발표/);
  hit('DATA_VALIDATION', /source|citation|as of|timestamp|fresh|stale|verify|근거|출처|기준일|최신화|검증|데이터/);
  if (!intents.length) intents.push(ctxId === 'technical' ? 'TECHNICAL_READ' : 'GENERAL_ANALYSIS');
  return {
    primary: intents[0],
    intents: intents.slice(0, 7),
    wantsFresh: intents.indexOf('LATEST_CHECK') >= 0 || /전망|어때|어떻게/.test(q),
    wantsAction: intents.indexOf('ACTION_DECISION') >= 0,
    wantsDeep: intents.indexOf('DEEP_RESEARCH') >= 0 || intents.indexOf('VALUATION_MODEL') >= 0 || intents.indexOf('EARNINGS_REVIEW') >= 0,
    wantsCompare: intents.indexOf('COMPARE_SCREEN') >= 0,
    wantsCoverage: intents
  };
}

function _aioChatAnswerPolicy(query, ctxId, detectedTickers, screenerResult) {
  var intent = _classifyChatIntent(query, ctxId);
  var q = String(query || '').toLowerCase();
  var tickers = Array.isArray(detectedTickers) ? detectedTickers : [];
  var hasTicker = tickers.length > 0;
  var hasScreener = !!(screenerResult && screenerResult.matched);
  var isBroadRecommendation = !!(screenerResult && screenerResult.mode === 'diversified-recommendation');
  var asksDecision = intent.wantsAction || /추천|골라|뽑아|사도|살까|매수|매도|보유|손절|익절|비중|전망|목표|entry|exit|buy|sell|hold|trim|target|outlook/.test(q);
  var asksSimple = intent.intents.indexOf('EXPLAIN_BEGINNER') >= 0 || /간단|요약|한줄|뜻|뭐야|무슨\s*의미|정의|per|pbr|roe|용어/.test(q);
  var asksFreshMarket = intent.wantsFresh || intent.intents.indexOf('MACRO_LINKAGE') >= 0;
  return {
    intent: intent,
    hasTicker: hasTicker,
    hasScreener: hasScreener,
    isBroadRecommendation: isBroadRecommendation,
    asksDecision: asksDecision,
    asksSimple: asksSimple,
    asksFreshMarket: asksFreshMarket,
    needsFullStockMemo: hasTicker && asksDecision && !asksSimple,
    needsTickerFactAnswer: hasTicker && (!asksDecision || asksSimple),
    needsScreenerGuide: hasScreener,
    needsGeneralGuide: !hasTicker && !hasScreener
  };
}
window._aioChatAnswerPolicy = _aioChatAnswerPolicy;

function _buildChatAnswerCoverageContext(ctxId, query, flags) {
  flags = flags || {};
  var intent = _classifyChatIntent(query, ctxId);
  var intents = intent.wantsCoverage || intent.intents || [];
  var has = {
    quote: !!flags.tickerData,
    trend: !!(flags.trendData || flags.technicalData),
    technical: !!flags.technicalData,
    screener: !!flags.screenerData,
    domain: !!flags.domainData,
    company: !!flags.deepData,
    web: !!flags.webSearch,
    news: !!flags.news,
    portfolio: !!flags.portfolioData,
    freshness: !!flags.freshness
  };
  var required = ['quote/source', 'as-of timestamp'];
  if (intents.indexOf('TECHNICAL_SETUP') >= 0 || ctxId === 'technical') required.push('trend/levels');
  if (intents.indexOf('VALUATION_MODEL') >= 0 || intents.indexOf('EARNINGS_REVIEW') >= 0 || intent.wantsDeep) required.push('fundamentals/valuation');
  if (intents.indexOf('LATEST_CHECK') >= 0 || intents.indexOf('CATALYST_RISK') >= 0) required.push('news/web/filings');
  if (intents.indexOf('PORTFOLIO_RISK') >= 0 || ctxId === 'portfolio') required.push('position/weight/risk');
  if (intents.indexOf('MACRO_LINKAGE') >= 0 || ctxId === 'macro' || ctxId === 'fxbond') required.push('macro cross-asset context');

  var mode = 'balanced analysis';
  if (intent.wantsAction) mode = 'decision memo';
  else if (intent.wantsCompare) mode = 'ranked comparison';
  else if (intents.indexOf('EXPLAIN_BEGINNER') >= 0) mode = 'beginner explanation';
  else if (intents.indexOf('TECHNICAL_SETUP') >= 0) mode = 'technical setup';
  else if (intents.indexOf('VALUATION_MODEL') >= 0) mode = 'valuation memo';
  else if (intents.indexOf('EARNINGS_REVIEW') >= 0) mode = 'earnings review';
  else if (intents.indexOf('PORTFOLIO_RISK') >= 0) mode = 'portfolio risk note';

  var missing = [];
  if (required.indexOf('trend/levels') >= 0 && !has.trend) missing.push('trend/levels');
  if (required.indexOf('fundamentals/valuation') >= 0 && !has.company) missing.push('fundamentals/valuation');
  if (required.indexOf('news/web/filings') >= 0 && !(has.news || has.web)) missing.push('news/web/filings');
  if (required.indexOf('position/weight/risk') >= 0 && !has.portfolio) missing.push('position/weight/risk');
  // v51.05: 누락됐던 3개 axes 검사 추가
  if (required.indexOf('macro cross-asset context') >= 0 && !has.domain) missing.push('macro cross-asset context');
  if (required.indexOf('quote/source') >= 0 && !has.quote && Array.isArray(flags.tickers) && flags.tickers.length > 0) missing.push('quote/source');

  return '\n\n[AI Answer Coverage + Current Data Contract v49.108]\n' +
    'mode=' + mode + ' | ctx=' + ctxId + ' | intents=' + intents.join(',') + '\n' +
    'required_axes=' + required.join(' / ') + '\n' +
    'available_axes=' + Object.keys(has).filter(function(k){ return has[k]; }).join(',') + '\n' +
    (missing.length ? 'missing_axes=' + missing.join(',') + ' -> state these as unavailable; do not fill them with model memory.\n' : 'missing_axes=none detected from injected context.\n') +
    'truth_gate_rule: current quote numbers are decision-usable only when DataTruthGate returns verified/warn with decisionUse=true. If status=blocked, stale, out-of-range, or source-mismatched, state data not verified and omit the number for trading judgment.\n' +
    'response_diversity_rule: choose the structure that fits the mode. decision memo = verdict first + sizing/trigger/invalidation; ranked comparison = table + rank rationale; valuation memo = drivers + multiples/DCF only if injected; earnings review = reported/guidance/revision/catalyst; technical setup = trend/levels/risk; beginner explanation = plain-language concept + concrete injected-data example.\n' +
    'current_data_rule: never use Claude/model training data for current price, market cap, earnings, guidance, analyst targets, ratings, news, filings, macro releases, or dates after the training cutoff. Use only injected live quote, FMP/SEC/Naver/Finnhub, news, web-search, DATA_SNAPSHOT with age label, and explicitly cited prompt blocks. If data is missing or stale, say \"데이터 미수집/확인 불가\" and omit the number.\n';
}

function _buildAioIntegratedAnswerContext(ctxId, query, flags) {
  try {
    flags = flags || {};
    var intent = (typeof _classifyChatIntent === 'function') ? _classifyChatIntent(query, ctxId) : {};
    var nav = (typeof _autoNavigatePage === 'function') ? _autoNavigatePage(query, ctxId) : null;
    var registry = Array.isArray(window.AIO_CHAT_PIPELINE_REGISTRY) ? window.AIO_CHAT_PIPELINE_REGISTRY : [];
    var lowerCtx = String(ctxId || 'home');
    var tickers = Array.isArray(flags.tickers) ? flags.tickers : [];
    var active = [];
    var addActive = function(cond, key) { if (cond && active.indexOf(key) < 0) active.push(key); };

    addActive(true, 'marketState');
    addActive(!!flags.tickerData || tickers.length > 0, 'quotes');
    addActive(!!flags.technicalData || lowerCtx === 'technical' || lowerCtx === 'signal', 'technicalOHLCV');
    addActive(!!flags.screenerData || lowerCtx === 'screener', 'screener');
    addActive(!!flags.domainData || /^(macro|kr-macro|fxbond)$/.test(lowerCtx), 'macroRatesFx');
    addActive(!!flags.deepData || lowerCtx === 'fundamental', 'companyFundamentals');
    addActive(!!flags.news || !!flags.webSearch || lowerCtx === 'market-news' || lowerCtx === 'briefing', 'newsFilings');
    addActive(/^(themes|theme-detail|kr-themes)$/.test(lowerCtx), 'themes');
    addActive(lowerCtx === 'breadth' || lowerCtx === 'sentiment', 'breadthSentiment');
    addActive(!!flags.portfolioData || lowerCtx === 'portfolio', 'portfolio');

    var q = String(query || '');
    if (/추천|후보|종목|screen|screener|퀀트|랭킹/i.test(q)) addActive(true, 'screener');
    if (/차트|기술|추세|돌파|지지|저항|rsi|macd|이평|setup/i.test(q)) addActive(true, 'technicalOHLCV');
    if (/뉴스|공시|촉매|리스크|이슈|최신|왜 지금/i.test(q)) addActive(true, 'newsFilings');
    if (/금리|환율|달러|채권|유가|인플레|매크로|fed|fomc/i.test(q)) addActive(true, 'macroRatesFx');
    if (/폭|브레드스|심리|fear|greed|vix/i.test(q)) addActive(true, 'breadthSentiment');

    var pageHints = [];
    var pushPage = function(label) { if (label && pageHints.indexOf(label) < 0) pageHints.push(label); };
    active.forEach(function(key) {
      var row = registry.filter(function(r) { return r.key === key; })[0];
      (row && row.pages || []).forEach(function(p) {
        if (p === 'technical') pushPage('차트·기술 분석');
        else if (p === 'signal') pushPage('매매 시그널');
        else if (p === 'screener') pushPage('퀀트 스크리너');
        else if (p === 'breadth') pushPage('시장 폭');
        else if (p === 'sentiment') pushPage('투자 심리');
        else if (p === 'macro' || p === 'kr-macro') pushPage('매크로');
        else if (p === 'fxbond') pushPage('환율·채권');
        else if (p === 'fundamental') pushPage('기업 분석');
        else if (p === 'themes' || p === 'theme-detail' || p === 'kr-themes') pushPage('테마·섹터');
        else if (p === 'portfolio') pushPage('포트폴리오');
        else if (p === 'market-news' || p === 'briefing') pushPage('시장 뉴스·브리핑');
        else if (p === 'home') pushPage('시장 현황');
      });
    });
    if (nav && nav.target && nav.target !== lowerCtx) pushPage('관련 페이지: ' + nav.label);

    var injected = registry.filter(function(r) { return active.indexOf(r.key) >= 0; }).map(function(r) {
      return r.key + '(' + r.kind + '/' + r.tier + ')';
    });
    var available = [];
    if (flags.tickerData) available.push('시세/추세');
    if (flags.technicalData) available.push('OHLCV 기술지표');
    if (flags.screenerData) available.push('퀀트 후보군');
    if (flags.domainData) available.push('도메인 페이지 데이터');
    if (flags.deepData) available.push('기업 심층 데이터');
    if (flags.news) available.push('뉴스 컨텍스트');
    if (flags.webSearch) available.push('웹 검색');
    if (flags.freshness) available.push('신선도 검증');
    if (flags.portfolioData) available.push('포트폴리오 맥락');

    var tg = window.AIO_TELEGRAM_WEEKLY_DIGEST || null;
    var tgLines = '';
    if (tg && Array.isArray(tg.themes) && tg.themes.length) {
      tgLines += 'telegram_weekly_digest=' + (tg.window || '') + ' | posts=' + ((tg.counts && tg.counts.total) || 'unknown') + ' | sources=' + (tg.sources || []).join(',') + '\n';
      tgLines += 'telegram_topics=' + Object.keys(tg.topicCounts || {}).map(function(k) { return k + ':' + tg.topicCounts[k]; }).join(', ') + '\n';
      tgLines += 'telegram_core_themes=' + tg.themes.slice(0, 6).join(' / ') + '\n';
      tgLines += 'telegram_catalysts=' + (tg.catalysts || []).map(function(c) { return c.key + ': ' + c.text; }).slice(0, 9).join(' / ') + '\n';
      tgLines += 'telegram_category_registry=' + (tg.categories || []).map(function(c) { return c.id + '=' + (c.topics || []).join('+') + ':' + c.focus; }).slice(0, 10).join(' / ') + '\n';
      tgLines += 'telegram_page_map=' + lowerCtx + ':' + ((tg.pageMap && tg.pageMap[lowerCtx]) || (tg.pageMap && tg.pageMap.home) || []).join(',') + '\n';
      tgLines += 'telegram_pipeline_note=' + (tg.pipelineNote || 'public mirror secondary source; verify before hard trading claims') + '\n';
    }
    // broadItems 개별 항목 — 쿼리 관련 티커/태그 우선, 최대 25개
    try {
      var broadItems = window.AIO_TELEGRAM_BROAD_ITEMS || (tg && tg.rawBroadItems) || [];
      if (broadItems.length) {
        var qLower = String(query || '').toLowerCase();
        var scored = broadItems.map(function(it) {
          var rel = 0;
          if (Array.isArray(it.tickers)) it.tickers.forEach(function(t) { if (qLower.indexOf(t.toLowerCase()) >= 0) rel += 4; });
          if (Array.isArray(it.tags)) it.tags.forEach(function(tag) { if (qLower.indexOf(tag) >= 0) rel += 2; });
          var textLower = (it.text || it.summary || '').toLowerCase(); // P715: summary-only 호환
          ['반도체','메모리','mlcc','금리','코스피','ai','etf','목표주가','달러','엔','상향','하향'].forEach(function(kw) {
            if (qLower.indexOf(kw) >= 0 && textLower.indexOf(kw) >= 0) rel += 1;
          });
          return { it: it, rel: rel };
        }).sort(function(a, b) { return (b.rel - a.rel) || (b.it.score - a.it.score); });
        var picked = scored.slice(0, 25);
        if (picked.length) {
          tgLines += 'telegram_individual_items (' + broadItems.length + '건 중 관련 ' + picked.length + '건):\n';
          picked.forEach(function(x) {
            var it = x.it;
            var preview = (it.text || it.summary || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim(); // P715
            if (preview.length > 200) preview = preview.slice(0, 197) + '...';
            var tickers = (it.tickers || []).join(',');
            tgLines += '  [' + (it.localDateKst || '').slice(5) + ' ' + it.channel + ' score=' + (it.score || 0) + (tickers ? ' t=' + tickers : '') + '] ' + preview + '\n';
          });
        }
      }
    } catch(_) {}

    return '\n\n[AIO Integrated Answer Pipeline v50.60]\n' +
      'special_edge: This screener chat is not a generic LLM. It must combine AIO page data, 현재 시장(live/stale-labeled market context), quant screener/technical signals, qualitative news/filings, and user portfolio/page intent into one answer.\n' +
      'ctx=' + lowerCtx + ' | tickers=' + (tickers.length ? tickers.join(',') : 'none') + ' | intent=' + (intent.primary || intent.mode || 'mixed') + '\n' +
      'pipeline_layers=' + (injected.length ? injected.join(' / ') : 'marketState(current/quant)') + '\n' +
      'available_injected_data=' + (available.length ? available.join(', ') : 'none; explain what is missing before using any current number') + '\n' +
      tgLines +
      'answer_contract:\n' +
      '1. Begin with the user intent in one plain Korean sentence, then connect it to the current market regime when injected market/news/domain data exists.\n' +
      '2. Quantitative answer: use available price, trend, RSI/MACD/MA/ATR, screener rank, breadth, valuation, rates/FX, or portfolio metrics. Label source/freshness when numbers are current-sensitive.\n' +
      '3. Qualitative answer: add business quality, catalyst, risk, news/filing, sector rotation, and narrative fit only from injected context or clearly mark as general framework.\n' +
      '4. Synthesis: explain what changed, why it matters now, what would confirm/negate the view, and avoid repeating the same narrow names/themes unless the injected data ranks them.\n' +
      '5. Page linkage: when useful, point to the relevant AIO page/tool so the user can continue: ' + pageHints.slice(0, 8).join(' / ') + '.\n' +
      '6. If the user asks for recommendations, present a diversified candidate set by market/sector/cap/style, include alternatives and exclusion conditions, and say when more user preference is needed.\n';
  } catch(e) { return ''; }
}
window._buildAioIntegratedAnswerContext = _buildAioIntegratedAnswerContext;

function _buildChatMemoryContext(ctxId, query) {
  try {
    if (typeof _getChatHistory !== 'function') return '';
    var history = _getChatHistory().filter(function(h) { return h && (!ctxId || h.ctx === ctxId); }).slice(-8);
    if (!history.length) return '';
    var qTokens = _aioChatTokens(query);
    var qSet = {};
    qTokens.forEach(function(t) { qSet[t] = true; });
    var scored = history.map(function(h) {
      var text = (h.q || '') + ' ' + (h.a || '');
      var overlap = _aioChatTokens(text).reduce(function(n, t) { return n + (qSet[t] ? 1 : 0); }, 0);
      return { item: h, overlap: overlap };
    }).filter(function(x) { return x.overlap >= 3; });
    scored.sort(function(a, b) { return b.overlap - a.overlap || (b.item.ts || 0) - (a.item.ts || 0); });
    var picked = (scored.length ? scored : history.map(function(h) { return { item: h, overlap: 0 }; }).slice(-3)).slice(0, 3);
    if (!picked.length) return '';
    var lines = picked.map(function(x, idx) {
      var h = x.item;
      var ageMin = h.ts ? Math.max(0, Math.round((Date.now() - h.ts) / 60000)) : null;
      return (idx + 1) + '. Q: ' + String(h.q || '').slice(0, 120) +
        ' | A요지: ' + String(h.a || '').replace(/\s+/g, ' ').slice(0, 160) +
        (ageMin != null ? ' | ' + ageMin + '분 전' : '');
    });
    return '\n\n【이전 대화 중복 방지 메모】\n' +
      '아래는 같은 맥락의 최근 질문/답변 요지다. 사용자가 반복 설명을 요구하지 않았다면 같은 문장을 되풀이하지 말고, 새 데이터·새 판단·바뀐 조건만 보강하라.\n' +
      lines.join('\n') + '\n';
  } catch(e) { return ''; }
}

function _buildChatIntentContext(ctxId, query, flags) {
  var intent = _classifyChatIntent(query, ctxId);
  flags = flags || {};
  var tickers = flags.tickers || [];
  var missing = [];
  if (tickers.length && !flags.tickerData) missing.push('ticker quote/trend');
  if (intent.wantsFresh && !flags.webSearch) missing.push('web search');
  if ((intent.wantsDeep || intent.wantsCompare) && !flags.deepData) missing.push('deep fundamentals');
  if (!flags.news) missing.push('fresh news context');
  return '\n\n【질문 의도·답변 범위】\n' +
    '의도: ' + intent.intents.join(', ') + ' | 페이지맥락: ' + ctxId + (tickers.length ? ' | 감지티커: ' + tickers.join(', ') : '') + '\n' +
    '답변 규칙: 사용자의 질문 범위에 맞춰 바로 결론부터 말하고, 이미 말한 내용은 반복하지 말며, 새 판단에 필요한 데이터만 사용하라. ' +
    (intent.wantsAction ? '행동 결론(보유/추가매수 금지/비중축소/헤지/관망)을 명시하라. ' : '') +
    (intent.wantsCompare ? '비교 질문이면 표는 짧게, 최종 우선순위와 제외 사유를 함께 제시하라. ' : '') +
    (intent.wantsFresh ? '최신성 질문이면 기준시각·출처·미수집 항목을 먼저 분리하라. ' : '') + '\n' +
    '데이터 커버리지: ' +
    ['tickerData','deepData','webSearch','news'].map(function(k) { return k + '=' + (flags[k] ? 'OK' : 'MISS'); }).join(' · ') +
    (missing.length ? '\n미수집/제한: ' + missing.join(', ') + ' — 이 항목은 추측하지 말고 제한사항으로 밝혀라.' : '') + '\n';
}

function _shouldSingleDeepAnalyzeChat(ctxId, query, detectedTickers, deepCompareStr) {
  if (!detectedTickers || detectedTickers.length !== 1 || deepCompareStr) return false;
  var deepCtx = ctxId === 'fundamental' || ctxId === 'ticker' || ctxId === 'technical' || ctxId === 'options' || ctxId === 'themes' || ctxId === 'theme-detail' || ctxId === 'portfolio';
  return deepCtx || (typeof _hasDeepAnalysisKw === 'function' && _hasDeepAnalysisKw(query));
}
window._classifyChatIntent = _classifyChatIntent;
window._buildChatMemoryContext = _buildChatMemoryContext;
window._buildChatIntentContext = _buildChatIntentContext;
window._buildChatAnswerCoverageContext = _buildChatAnswerCoverageContext;
window._shouldSingleDeepAnalyzeChat = _shouldSingleDeepAnalyzeChat;

function _needsWebSearch(query, ctxId) {
  var pKey = _getApiKey('aio_perplexity_key') || '';
  var gKey = _getApiKey('aio_google_cse_key') || '';
  var gCx = _getApiKey('aio_google_cse_cx') || '';
  if (!pKey && !(gKey && gCx)) return null; // 검색 API 없으면 비활성

  var q = query.toLowerCase();
  var qLen = query.length;

  // ── 검색 불필요: 순수 교육/개념/용어 질문 ──
  var eduOnly = /^(PER|PBR|EPS|ROE|RSI|MACD|볼린저|이동평균|골든크로스|DCF|밸류에이션|배당|옵션|콜|풋|그릭스|델타|감마|세타|베가|캐리.*트레이드|공매도|시가총액|베타|샤프).*?(이란|뭐야|뭐지|설명|알려|개념|정의)/i;
  if (eduOnly.test(q)) return null;
  // 짧은 개념 질문 (15자 미만 + 순수 개념어만)
  if (qLen < 15 && /뭐야|뭐지|뭔가요|알려줘|설명|개념|정의/.test(q) && !/어때|어떻|전망|분석|지금|살까|팔까|매수|매도/.test(q)) return null;

  // v46.10: 티커/종목명 감지 시 항상 웹검색 (환각 방지 핵심)
  var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
  if (hasTicker) return _buildSearchQuery(query, ctxId);
  // 짧은 질문이라도 "어때/전망/분석/지금" 포함 시 검색
  if (/어때|어떻|전망|분석|지금|살까|팔까|매수|매도|상황/.test(q)) return _buildSearchQuery(query, ctxId);

  // ── 검색 필요 패턴 ──
  var searchPatterns = [
    /최근|최신|오늘|어제|이번\s*주|이번\s*달|금주|지난주|올해|방금|지금|현재.*상황|latest|recent|today|this week|what happened/,
    /(실적|어닝|earnings|분기|매출|revenue).*(발표|결과|서프라이즈|미스|beat|miss|guidance|가이던스)/,
    /전망|예상|예측|forecast|outlook|target|목표가|컨센서스|consensus|애널리스트|analyst|월가|wall street|향후|내년|다음\s*분기/,
    /(FOMC|연준|Fed|금리.*결정|파월|Powell|트럼프|관세|tariff|제재|sanction|전쟁|충돌|선거|법안).*(결과|발표|영향|반응|대응|어떻|어때|뭐|소식|상황)/,
    /IPO|상장|인수|합병|M&A|분할|스핀오프|구조조정|파산|bankruptcy|takeover|merger|acquisition/,
    /왜.*(올|떨|빠|상승|하락|급등|급락|폭락|폭등)|why.*(up|down|surge|crash|drop|rally|rise|fall|plunge)/,
    /규제|법안|SEC|금감원|금융위|공정위|반독점|antitrust|regulation|제재|ban|금지/,
    /(AI|인공지능|반도체|2차전지|방산|조선|바이오|우주|로봇|양자).*(트렌드|동향|전망|현황|최신|뉴스|소식|상황)/,
    /검색|찾아|search|look up|알아봐|조사|뉴스|news/,
    // v36.5: 시장 내러티브·이벤트·컨퍼런스 감지
    /내러티브|narrative|테마\s*플레이|theme\s*play|스토리|모멘텀\s*시프트|패러다임|게임\s*체인저|턴어라운드/i,
    /GTC|CES|MWC|WWDC|re:Invent|AWS\s*summit|Google\s*I\/O|Build|Ignite|F8|Galaxy\s*Unpacked|SEMICON|IEDM|Hot\s*Chips|OFC|Computex|E3|gamescom|IFA|NAB\s*Show|JPM\s*Healthcare|ASCO|AACR|RSA|Black\s*Hat|DEFCON|Davos|Jackson\s*Hole|OPEC/i,
    /사스포칼립스|SaaS.?ocalypse|turbo\s*quant|ARM\s*everywhere|magnificent\s*7|mag\s*7|AI\s*bubble|AI\s*winter|soft\s*landing|hard\s*landing|no\s*landing|골디락스|goldilocks|재팬니피케이션|japanification|디커플링|de.?coupling|리쇼어링|re.?shoring|프렌드쇼어링|friend.?shoring|차이나\s*리스크|china\s*risk/i,
    /밈\s*주|meme\s*stock|숏\s*스퀴즈|short\s*squeeze|감마\s*스퀴즈|gamma|데스\s*크로스|death\s*cross|골든\s*크로스|golden\s*cross|힌덴부르크|hindenburg|블랙\s*스완|black\s*swan|테일\s*리스크|tail\s*risk|VIX\s*spike|변동성\s*폭발/i,
    /컨퍼런스|conference|서밋|summit|키노트|keynote|발표회|런칭|launch|데모\s*데이|demo\s*day|IR\s*day|analyst\s*day|investor\s*day|capital\s*markets\s*day/i,
    /월가.*말|street.*says|sell.?side|buy.?side|헤지펀드|hedge\s*fund|골드만|morgan\s*stanley|jp\s*morgan|뱅크오브|bank\s*of\s*america|시타델|citadel|bridgewater|워런.*버핏|buffett|캐시.*우드|cathie|ark\s*invest|소로스|soros|달리오|dalio|드러켄밀러|druckenmiller|애크먼|ackman/i
  ];

  for (var i = 0; i < searchPatterns.length; i++) {
    if (searchPatterns[i].test(q)) return _buildSearchQuery(query, ctxId);
  }

  // 긴 질문(50자+)에서 기업명+이벤트 조합
  if (qLen > 50) {
    var hasTicker = typeof _extractTickers === 'function' && _extractTickers(query).length > 0;
    var hasEvent = /실적|뉴스|소식|이슈|리스크|촉매|카탈리스트|이벤트|변수|전망|타겟|목표|내러티브|테마|스토리/i.test(q);
    if (hasTicker && hasEvent) return _buildSearchQuery(query, ctxId);
  }

  // v36.5: 영어 고유명사(3글자+대문자 시작) + 시장 맥락어 → 외부 내러티브 가능성
  if (/[A-Z][a-zA-Z]{2,}\s+(effect|thesis|trade|play|rotation|rally|selloff|narrative|momentum|cycle)/i.test(q)) {
    return _buildSearchQuery(query, ctxId);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// v49.57 P318 신규: Claude web_search_20250305 조건부 활성화
// Perplexity/Google CSE 키 없이도 Anthropic API의 native web search 활용.
// 휴리스틱: 최근/오늘/뉴스/발표/실적/M&A/breaking 관련 질문일 때만 tool enable.
// 비용 가드: max_uses:3 + 사용자 토글 (localStorage.aio_web_search_enabled = 'off')
// ─────────────────────────────────────────────────────────────────
function _shouldUseClaudeWebSearch(query, ctxId, detectedTickers) {
  if (!query) return false;
  window._aioWebSearchCapped = false;
  // 사용자 명시 opt-out
  try {
    if (localStorage.getItem('aio_web_search_enabled') === 'off') return false;
  } catch(e) {}
  var q = String(query).toLowerCase();
  var _hasTicker = Array.isArray(detectedTickers) && detectedTickers.length > 0;
  var _want = false;
  // A: 시점 키워드
  if (/최근|최신|오늘|어제|이번\s*주|이번\s*달|금주|지난주|방금|지금|현재|latest|recent|today|just now|breaking/.test(q)) _want = true;
  // B: 페이지 컨텍스트 (뉴스성)
  if (!_want && (ctxId === 'market-news' || ctxId === 'briefing' || ctxId === 'macro')) {
    if (/뉴스|news|소식|발표|상황|동향/.test(q)) _want = true;
  }
  // C: 티커 + 이벤트
  if (!_want && _hasTicker) {
    if (/뉴스|news|발표|announce|실적|earnings|어닝|M&A|인수|합병|파트너십|partnership|소송|lawsuit|CEO|이사회|board|guidance|가이던스|investor\s*day|analyst\s*day/i.test(q)) _want = true;
  }
  // E (v50.10): 정성 분석 의도 → web research로 placeholder/정적/휴리스틱 데이터 보강.
  //   AIO_ANALYSIS_FRAMEWORK_REGISTRY 고위험 7관점(공급망/TAM/경쟁/해자/13F/CEO전략/사업구조)에 대응.
  //   (티커 有 OR 정성 컨텍스트) AND 정성 키워드. 순수 시세 키워드(주가/시세/얼마)만 있으면 qualIntent 미포함 → 미발화.
  if (!_want) {
    var _qualCtx = ctxId === 'fundamental' || ctxId === 'ticker' || ctxId === 'themes' || ctxId === 'theme-detail' || ctxId === 'market-news' || ctxId === 'briefing' || ctxId === 'macro';
    var _qualIntent = /공급망|supply\s*chain|밸류체인|value\s*chain|tam|시장\s*규모|시장규모|점유율|market\s*share|경쟁|competitor|경쟁사|competition|해자|moat|경쟁\s*우위|기관|13f|지분|institutional|holdings|사업\s*구조|사업구조|비즈니스\s*모델|business\s*model|수익\s*구조|수익구조|경영진|ceo|경영\s*전략|management|전략|strategy|파트너십|partnership|투자\s*포인트|투자포인트|thesis|전망|outlook|평가|왜\s|분석|analyze|analysis/i.test(q);
    if ((_hasTicker || _qualCtx) && _qualIntent) _want = true;
  }
  // D: 검색 의도 폴백 (Perplexity/Google 키 없을 때)
  if (!_want) {
    try {
      if (typeof _needsWebSearch === 'function') {
        var pKey = (typeof _getApiKey === 'function') ? _getApiKey('aio_perplexity_key') : '';
        var gKey = (typeof _getApiKey === 'function') ? _getApiKey('aio_google_cse_key') : '';
        var gCx = (typeof _getApiKey === 'function') ? _getApiKey('aio_google_cse_cx') : '';
        // 완성된 Perplexity/Google CSE 설정이 없을 때만 Claude native web_search 폴백.
        // Google API key만 있고 cx가 빠진 반쪽 설정은 _needsWebSearch가 실행하지 못하므로 여기서 막지 않는다.
        if (!pKey && !(gKey && gCx)) {
          if (/검색|찾아|search|look\s*up|알아봐|조사/i.test(q)) _want = true;
        }
      }
    } catch(e) {}
  }
  if (!_want) return false;
  // 비용 안전 상한 (v50.10) — 5명 공유 유료 Claude 키 보호. 일일 한도 도달 시 미발화 + UI note 플래그.
  try {
    if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('claudeWebSearch')) {
      window._aioWebSearchCapped = true;
      return false;
    }
  } catch(e) {}
  return true;
}
window._shouldUseClaudeWebSearch = _shouldUseClaudeWebSearch;

/** 검색 쿼리 최적화 — v36.5: 내러티브/이벤트 컨텍스트 강화 */
function _buildSearchQuery(query, ctxId) {
  var tickers = typeof _extractTickers === 'function' ? _extractTickers(query) : [];
  var tickerStr = tickers.length > 0 ? tickers.join(' ') + ' ' : '';
  var prefix = '';
  if (/^kr/.test(ctxId)) prefix = '한국 증시 ';
  var cleaned = query.replace(/해줘|해주세요|알려줘|알려주세요|설명해|분석해|어때|어떻게|좀|요$|인가요|인가$|줘$|주세요$/g, '').replace(/\s+/g, ' ').trim();

  // v36.5: 내러티브/이벤트 쿼리면 "시장 내러티브" 컨텍스트 추가
  var isNarrative = /내러티브|narrative|테마.*플레이|스토리|모멘텀|패러다임|게임.*체인저|컨퍼런스|summit|GTC|CES|WWDC|사스포칼립스|turbo|ARM.*every|mag.*7|골디락스|soft.*land|hard.*land/i.test(query);
  var isWallStreet = /월가|hedge.*fund|골드만|morgan|jp.*morgan|버핏|buffett|cathie|ark.*invest|소로스|달리오|드러켄밀러|애크먼/i.test(query);

  if (isNarrative) {
    prefix += '시장 내러티브 ';
  } else if (isWallStreet) {
    prefix += '월가 투자 견해 ';
  }

  var result = (prefix + tickerStr + cleaned).substring(0, 150);
  return result;
}

/** Perplexity Sonar API 호출 */
async function _perplexitySearch(searchQuery) {
  var apiKey = _getApiKey('aio_perplexity_key') || '';
  if (!apiKey) throw new Error('Perplexity API 키 없음');

  var now = new Date();
  var kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
  var dateStr = kst.getFullYear() + '-' + String(kst.getMonth()+1).padStart(2,'0') + '-' + String(kst.getDate()).padStart(2,'0');

  // v48.2: 웹검색 결과 5분 캐시 — 동일 쿼리 반복 시 Perplexity 호출 생략
  if (!window._pplxCache) window._pplxCache = {};
  var _cKey = searchQuery.trim().toLowerCase();
  var _cached = window._pplxCache[_cKey];
  if (_cached && (Date.now() - _cached._ts < 300000)) {
    console.log('[AIO] Perplexity 캐시 히트 (5분 내):', searchQuery.substring(0,40));
    return { answer: _cached.answer, citations: _cached.citations, searchQuery: searchQuery, _cached: true };
  }

  var res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: '오늘은 ' + dateStr + '이다. 금융/투자/시장 전문 리서치 어시스턴트로서, 아래 우선순위로 정보를 탐색·정리하라:\n① 시장 내러티브·테마 플레이 (사스포칼립스, turbo quant, ARM everywhere, AI 버블/윈터 등 월가에서 회자되는 투자 스토리)\n② 주요 컨퍼런스·이벤트 시사점 (GTC, CES, WWDC, Davos, Jackson Hole 등에서 발표된 내용과 시장 반응)\n③ 투자 대가·기관 포지션 변화 (버핏, 달리오, ARK, 골드만 등의 최근 매매·견해·리포트)\n④ 이벤트 드리븐 (실적 서프라이즈, 규제 변화, M&A, IPO, 지정학 리스크 등 시장 촉매)\n일반 뉴스보다 위 유형의 "외부에서만 알 수 있는 최신 정보"를 우선 추출하라. 출처 반드시 포함. 팩트 위주 600자 이내. 한국어로 정리.' },
        { role: 'user', content: searchQuery }
      ],
      max_tokens: 1024,
      temperature: 0.1,
      return_citations: true,
      // v48.2: 금융 도메인 화이트리스트 — 노이즈 제거 + 공신력 있는 출처 우선
      search_domain_filter: ['bloomberg.com','reuters.com','cnbc.com','wsj.com','ft.com','marketwatch.com','seekingalpha.com','barrons.com','yahoo.com','investing.com','economist.com','morningstar.com','mk.co.kr','hankyung.com','sedaily.com','chosun.com','mt.co.kr'],
      // v48.11: recency 동적 — "오늘/지금/금일/방금/현재/당일/today/now" 키워드 포함 시 day, 그 외 week
      search_recency_filter: /오늘|지금|금일|방금|현재|당일|today|now|just\s/i.test(searchQuery) ? 'day' : 'week',
      return_related_questions: false
    })
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error('Perplexity API (' + res.status + '): ' + errText.substring(0, 100));
  }

  var data = await res.json();
  var answer = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  var citations = data.citations || [];
  // v48.2: 캐시 저장 (최대 20개 유지, LRU 간이 관리)
  try {
    window._pplxCache[_cKey] = { answer: answer, citations: citations, _ts: Date.now() };
    var keys = Object.keys(window._pplxCache);
    if (keys.length > 20) {
      keys.sort(function(a,b){ return (window._pplxCache[a]._ts||0) - (window._pplxCache[b]._ts||0); });
      for (var i = 0; i < keys.length - 20; i++) delete window._pplxCache[keys[i]];
    }
  } catch(e) {}
  return { answer: answer, citations: citations, searchQuery: searchQuery };
}

/** 검색 결과 → 시스템 프롬프트 주입 문자열 — v36.5: 내러티브 중심 지시 강화 */
function _formatSearchForPrompt(sr) {
  if (!sr || !sr.answer) return '';
  var engineLabel = sr.engine === 'perplexity' ? 'Perplexity Sonar — AI 요약' : 'Google Search — 검색 결과';
  var out = '\n\n【웹검색 결과 (' + engineLabel + ')】\n';
  out += '검색어: "' + sr.searchQuery + '"\n';
  out += '───────────────────────────────\n';
  out += sr.answer + '\n';
  if (sr.citations && sr.citations.length > 0) {
    out += '\n 출처:\n';
    for (var i = 0; i < Math.min(sr.citations.length, 5); i++) {
      out += '  [' + (i+1) + '] ' + sr.citations[i] + '\n';
    }
  }
  out += '───────────────────────────────\n';
  if (sr.engine === 'google') {
    out += '위는 Google 검색 스니펫이다. 스니펫의 정보를 종합하여 핵심을 분석하고, 출처를 자연스럽게 언급하라. 스니펫이 불완전할 수 있으므로 학습 데이터와 교차검증하되, 검색 결과의 최신 날짜/숫자를 우선하라.\n';
  } else {
    out += '위 검색 결과는 실시간 웹에서 수집한 최신 정보이다. 이 정보를 답변에 적극 활용하되, 출처를 자연스럽게 언급하라. 학습 데이터의 과거 정보보다 검색 결과의 최신 정보를 우선하라.\n';
  }
  // v36.5: 내러티브/이벤트 중심 활용 지시
  out += '\n【외부 내러티브 활용 원칙】\n';
  out += '검색 결과에서 아래 유형의 정보를 우선적으로 추출하여 답변에 반영하라:\n';
  out += '① 시장 내러티브/테마: 월가에서 현재 유행하는 투자 테시스, 트레이드 아이디어, 내러티브 (예: "SaaS-ocalypse", "ARM everywhere", "Mag 7 rotation", "AI capex cycle", "soft landing trade")\n';
  out += '② 주요 컨퍼런스/이벤트 시사점: GTC, CES, WWDC, re:Invent, JPM Healthcare, ASCO 등에서 발표된 핵심 내용과 시장 반응\n';
  out += '③ 투자 대가/기관 포지션 변화: 버핏, 소로스, 달리오, ARK, 주요 헤지펀드의 최근 매매 동향과 투자 견해\n';
  out += '④ 이벤트 드리븐: 규제 변화, 지정학 이벤트, 정책 전환이 만드는 새로운 투자 기회/리스크\n';
  out += '이 정보들은 검색 API 없이는 LLM이 알 수 없는 "외부에서만 얻을 수 있는 정보"이다. 학습 데이터에 있는 일반 지식이 아닌, 검색으로 얻은 최신 외부 내러티브를 답변의 핵심 소재로 활용하라.\n';
  return out;
}

/** 검색 출처 → UI HTML */
function _searchCitationsHTML(sr) {
  if (!sr || !sr.citations || sr.citations.length === 0) return '';
  var html = '<div style="margin-top:6px;padding:6px 8px;background:rgba(168,85,247,0.08);border-left:2px solid #a78bfa;border-radius:0 4px 4px 0;font-size:11px;">';
  // v50.10: Claude native web_search 출처도 동일 렌더 (engine === 'claude')
  var engName = sr.engine === 'perplexity' ? 'Perplexity' : sr.engine === 'claude' ? 'Claude 웹검색' : 'Google';
  html += '<div style="color:#a78bfa;font-weight:600;margin-bottom:3px;">' + engName + ' 검색 출처</div>';
  for (var i = 0; i < Math.min(sr.citations.length, 5); i++) {
    var url = sr.citations[i];
    var domain = '';
    try { domain = new URL(url).hostname.replace('www.', ''); } catch(e) { domain = url.substring(0, 30); }
    // v48.91: escHtml() 적용 — API 응답 URL/domain XSS 방지
    html += '<a href="' + escHtml(url) + '" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none;display:block;margin:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">[' + (i+1) + '] ' + escHtml(domain) + '</a>';
  }
  html += '</div>';
  return html;
}

/** Google Custom Search API 호출 (무료 하루 100건) */
async function _googleSearch(searchQuery) {
  var apiKey = _getApiKey('aio_google_cse_key') || '';
  var cx = _getApiKey('aio_google_cse_cx') || '';
  if (!apiKey || !cx) throw new Error('Google Search API 키 또는 검색엔진 ID 없음');
  // v48.9: 공유 키 쿼터 사전 체크 (100/day 도달 시 차단)
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('googleCse')) throw new Error('Google Search 일일 한도(100/day) 도달 — 24h 후 리셋');

  var url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(apiKey) +
    '&cx=' + encodeURIComponent(cx) +
    '&q=' + encodeURIComponent(searchQuery) +
    '&num=5&lr=lang_ko&gl=kr';

  var res = await fetch(url);
  if (!res.ok) {
    var errText = await res.text();
    throw new Error('Google Search API (' + res.status + '): ' + errText.substring(0, 100));
  }
  if (typeof _bumpApiCounter === 'function') _bumpApiCounter('googleCse');

  var data = await res.json();
  var items = data.items || [];

  // 검색 결과를 Perplexity와 동일한 형태로 변환
  var answer = '';
  var citations = [];
  for (var i = 0; i < Math.min(items.length, 5); i++) {
    var item = items[i];
    citations.push(item.link || '');
    answer += '**[' + (i+1) + '] ' + (item.title || '') + '**\n';
    answer += (item.snippet || '') + '\n\n';
  }

  return { answer: answer, citations: citations, searchQuery: searchQuery, engine: 'google' };
}

/**
 * 통합 검색 디스패처 — 우선순위: Perplexity > Google > 없음
 * Perplexity 키 있으면 Perplexity 사용 (AI 요약+출처)
 * Google 키만 있으면 Google 사용 (스니펫+출처)
 * 둘 다 없으면 검색 비활성
 */
async function _aiWebSearch(searchQuery) {
  // 1순위: Perplexity Sonar (AI 요약 포함)
  var pKey = _getApiKey('aio_perplexity_key') || '';
  if (pKey) {
    try {
      var pResult = await _perplexitySearch(searchQuery);
      pResult.engine = 'perplexity';
      return pResult;
    } catch(e) {
      _aioLog('warn', 'fetch', 'Perplexity 실패, Google 폴백 시도: ' + e.message);
    }
  }

  // 2순위: Google Custom Search (스니펫만)
  var gKey = _getApiKey('aio_google_cse_key') || '';
  var gCx = _getApiKey('aio_google_cse_cx') || '';
  if (gKey && gCx) {
    try {
      var gResult = await _googleSearch(searchQuery);
      return gResult;
    } catch(e) {
      _aioLog('warn', 'fetch', 'Google Search 실패: ' + e.message);
    }
  }

  throw new Error('검색 API 키 없음 (Perplexity 키 또는 Google Search API 키+검색엔진 ID(cx)를 설정하세요)');
}

// v46.2: Deep Search — 복합 질문을 3~5개 하위 쿼리로 분해 + 병렬 검색 + 종합
async function _aiDeepSearch(query, ctxId) {
  var pKey = _getApiKey('aio_perplexity_key') || '';
  var gKey = _getApiKey('aio_google_cse_key') || '';
  var gCx = _getApiKey('aio_google_cse_cx') || '';
  if (!pKey && !(gKey && gCx)) return null;

  // 질문 분해: 메인 쿼리 + 관련 보조 쿼리 생성
  var subQueries = [query]; // 원본 쿼리는 항상 포함
  var q = query.toLowerCase();

  // 티커 감지 시 → 해당 종목 최신 뉴스 + 실적 + 전망 쿼리 추가
  var tickers = typeof _extractTickers === 'function' ? _extractTickers(query) : [];
  if (tickers.length > 0) {
    subQueries.push(tickers[0] + ' latest news earnings 2026');
    subQueries.push(tickers[0] + ' analyst price target consensus 2026');
  }

  // 매크로 질문 시 → 관련 지표 + 시장 반응 쿼리 추가
  if (/금리|FOMC|Fed|인플레|CPI|GDP|실업|고용/.test(q)) {
    subQueries.push('Federal Reserve latest policy outlook 2026');
  }
  if (/유가|WTI|원유|이란|호르무즈/.test(q)) {
    subQueries.push('crude oil price geopolitical risk latest 2026');
  }
  if (/반도체|AI|엔비디아|NVDA|칩/.test(q)) {
    subQueries.push('AI semiconductor investment trend latest 2026');
  }

  // 최대 4개로 제한 (API 비용/속도 고려)
  subQueries = subQueries.slice(0, 4);
  if (subQueries.length <= 1) return null; // 분해 불필요 시 일반 검색으로

  // 병렬 실행
  console.log('[AIO Deep Search] ' + subQueries.length + '개 쿼리 병렬 실행:', subQueries);
  var results = await Promise.allSettled(subQueries.map(function(sq) {
    return _aiWebSearch(sq);
  }));

  // 결과 종합
  var combined = { searchQuery: query, engine: 'deep-search', answer: '', citations: [], subResults: [] };
  results.forEach(function(r, i) {
    if (r.status === 'fulfilled' && r.value && r.value.answer) {
      combined.subResults.push({ query: subQueries[i], answer: r.value.answer });
      combined.answer += '\n[검색 ' + (i+1) + ': ' + subQueries[i] + ']\n' + r.value.answer + '\n';
      if (r.value.citations) combined.citations = combined.citations.concat(r.value.citations);
    }
  });

  if (!combined.answer) return null;
  combined.citations = combined.citations.slice(0, 8); // 출처 최대 8개
  console.log('[AIO Deep Search] 완료: ' + combined.subResults.length + '/' + subQueries.length + ' 성공');
  return combined;
}

// ── Send message ───────────────────────────────────────────────────────
// v49.70 P373 R134: 답변 데이터 다운로드 (CSV/JSON/Markdown export) + 클립보드 복사
// AI 응답 텍스트 + 종목 데이터 + 시뮬레이션 결과를 사용자가 직접 활용 가능
function _aioExportChatData(ctxId, fullText, detectedTickers, format) {
  format = (format || 'markdown').toLowerCase();
  var ld = window._liveData || {};
  var timestamp = new Date().toISOString();
  var payload = {
    version: 'v49.70',
    context: ctxId,
    exportedAt: timestamp,
    detectedTickers: detectedTickers || [],
    marketSnapshot: {},
    aiResponse: fullText || ''
  };
  // 시장 스냅샷 (라이브 데이터)
  ['^GSPC', '^VIX', '^TNX', 'DX-Y.NYB', 'CL=F', 'GC=F', 'BTC-USD', '^KS11', 'KRW=X'].forEach(function(sym) {
    if (ld[sym] && ld[sym].price) payload.marketSnapshot[sym] = { price: ld[sym].price, pct: ld[sym].pct };
  });
  if (window._lastFG != null) payload.marketSnapshot['CNN_FG'] = window._lastFG;
  if (window._tradingScore != null) payload.marketSnapshot['TradingScore'] = window._tradingScore;
  // 종목 라이브 데이터
  payload.tickerData = {};
  (detectedTickers || []).forEach(function(t) {
    if (ld[t]) payload.tickerData[t] = ld[t];
  });
  var content = '', mime = 'text/plain', filename = 'aio-chat-' + ctxId + '-' + timestamp.slice(0, 19).replace(/[:T]/g, '-') + '.';
  if (format === 'json') {
    content = JSON.stringify(payload, null, 2);
    mime = 'application/json';
    filename += 'json';
  } else if (format === 'csv') {
    var rows = ['key,value'];
    rows.push('context,' + payload.context);
    rows.push('exportedAt,' + payload.exportedAt);
    rows.push('detectedTickers,"' + payload.detectedTickers.join(';') + '"');
    Object.keys(payload.marketSnapshot).forEach(function(k) {
      var v = payload.marketSnapshot[k];
      rows.push('market_' + k + ',"' + (typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '""') : v) + '"');
    });
    Object.keys(payload.tickerData).forEach(function(k) {
      rows.push('ticker_' + k + ',"' + JSON.stringify(payload.tickerData[k]).replace(/"/g, '""') + '"');
    });
    rows.push('aiResponse,"' + String(payload.aiResponse).replace(/"/g, '""').replace(/\n/g, '\\n') + '"');
    content = rows.join('\n');
    mime = 'text/csv';
    filename += 'csv';
  } else { // markdown
    content = '# AIO Screener Chat Export\n\n';
    content += '- **Context**: ' + payload.context + '\n';
    content += '- **Exported**: ' + payload.exportedAt + '\n';
    content += '- **Tickers**: ' + (payload.detectedTickers.join(', ') || 'none') + '\n\n';
    content += '## Market Snapshot\n\n';
    Object.keys(payload.marketSnapshot).forEach(function(k) {
      var v = payload.marketSnapshot[k];
      content += '- **' + k + '**: ' + (typeof v === 'object' ? JSON.stringify(v) : v) + '\n';
    });
    if (Object.keys(payload.tickerData).length > 0) {
      content += '\n## Ticker Data\n\n```json\n' + JSON.stringify(payload.tickerData, null, 2) + '\n```\n';
    }
    content += '\n## AI Response\n\n' + payload.aiResponse + '\n';
    mime = 'text/markdown';
    filename += 'md';
  }
  // 다운로드 트리거
  try {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 500);
    return { success: true, filename: filename, format: format };
  } catch(e) {
    // 클립보드 폴백
    try { navigator.clipboard.writeText(content); return { success: true, fallback: 'clipboard', format: format }; } catch(_) {}
    return { success: false, error: e && e.message };
  }
}
window._aioExportChatData = _aioExportChatData;
window.AIO = window.AIO || {};
window.AIO.exportChatData = _aioExportChatData;
// 다운로드 버튼 핸들러 (data-action에서 호출)
window._aioExportFromBtn = function(dlId, format) {
  var ctx = window['_aioDlCtx_' + dlId];
  if (!ctx) return;
  _aioExportChatData(ctx.ctxId, ctx.fullText, ctx.tickers, format || 'markdown');
};

// v49.70 P374 R134: 금액 시뮬레이션 + SPX % 시나리오 — "1억 투자" / "SPX -5%" / "포트폴리오 +10%"
function _aioSimulateAmountOrPct(q, detectedTickers) {
  if (!q || typeof q !== 'string') return null;
  var lower = q.toLowerCase();
  var result = null;
  // 금액 시뮬레이션 (예: "1억 투자 시", "5000만원 분산")
  var amountMatch = q.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(억|천만|백만|만|원|usd|달러|\$)/i);
  if (amountMatch && /(투자|할당|매수|invest|allocate|buy)/i.test(lower)) {
    var rawAmount = Number(amountMatch[1].replace(/,/g, ''));
    var unit = amountMatch[2].toLowerCase();
    var krwAmount = 0;
    if (unit === '억') krwAmount = rawAmount * 1e8;
    else if (unit === '천만') krwAmount = rawAmount * 1e7;
    else if (unit === '백만') krwAmount = rawAmount * 1e6;
    else if (unit === '만' || unit === '원') krwAmount = rawAmount * (unit === '만' ? 1e4 : 1);
    else if (unit === 'usd' || unit === '달러' || unit === '$') krwAmount = rawAmount * 1380; // 대략 환율 1380원/달러
    if (krwAmount >= 1e5) {
      var usdAmount = Math.round(krwAmount / 1380);
      result = result || {};
      result.amount = {
        krw: Math.round(krwAmount),
        usd: usdAmount,
        note: krwAmount.toLocaleString() + '원 ≈ $' + usdAmount.toLocaleString() + ' (환율 1380원/달러)',
        allocation: {
          conservative: 'Bridgewater All Weather 4-Quadrant: SPX/QQQ 40% + 국채 30% + 금 15% + 단기채/현금 15%',
          balanced: 'GS GIR 균형: SPX 50% + 글로벌 ex-US 15% + 채권 25% + 원자재/대체 10%',
          aggressive: 'Ackman 집중: AAA 종목 5~7개 각 12~18% + 현금 10~15% (Margin of Safety 확보 시)'
        }
      };
    }
  }
  // SPX % 시나리오 (예: "SPX -5% 시", "SPX +10% 시")
  var spxPctMatch = q.match(/(spx|s&?p|코스피|kospi).*?([\+\-])?\s*(\d+\.?\d*)\s*(%|퍼센트)/i);
  if (spxPctMatch) {
    var index = /코스피|kospi/i.test(spxPctMatch[1]) ? 'KOSPI' : 'SPX';
    var sign = spxPctMatch[2] === '-' ? '-' : '+';
    var pct = Number(spxPctMatch[3]);
    if (pct >= 1 && pct <= 50) {
      result = result || {};
      result.indexScenario = {
        index: index,
        sign: sign,
        pct: pct,
        direction: sign === '-' ? '하락' : '상승',
        impacts: sign === '-' ? {
          VIX: '+' + Math.round(pct * 2.5) + '% (변동성 spike)',
          '10Y': '-' + Math.round(pct * 8) + 'bp (안전자산 도피)',
          Gold: '+' + Math.round(pct * 0.5) + '% (역상관)',
          Sector: 'Staples/Healthcare OW · Cyclicals UW (방어 로테이션)',
          Position: '확신도 낮으면 현금 비중 50%+ / Buffett Margin of Safety 매수 검토 (pct ' + pct + '% 이상이면 Bull case)'
        } : {
          VIX: '-' + Math.round(pct * 1.5) + '% (변동성 진정)',
          '10Y': '+' + Math.round(pct * 4) + 'bp (위험자산 선호)',
          Gold: '-' + Math.round(pct * 0.3) + '% (역상관)',
          Sector: 'Cyclicals/Tech OW · Defensive UW (위험자산 로테이션)',
          Position: 'FOMO 경계 — Howard Marks Pendulum 탐욕 극단 진입 확인 + Marks "Sell into strength"'
        }
      };
    }
  }
  return result;
}
window._aioSimulateAmountOrPct = _aioSimulateAmountOrPct;

// v49.70 P372 R133: 알람/임계값 트리거 — VIX/F&G/종목 가격 자동 모니터링 + 브라우저 Notification
// "VIX 30 도달 시 알림" / "NVDA $150 도달 시" 등 자연어 의도 감지 + localStorage 영속 + 페이지 로드 시 자동 점검
function _aioGetAlerts() {
  try {
    var raw = localStorage.getItem('aio_alerts_v1');
    if (raw) return JSON.parse(raw);
  } catch(_) {}
  return [];
}
function _aioSetAlerts(alerts) {
  try { localStorage.setItem('aio_alerts_v1', JSON.stringify(alerts || [])); return true; } catch(_) { return false; }
}
function _aioAddAlert(alert) {
  if (!alert || !alert.metric || alert.threshold == null) return null;
  var alerts = _aioGetAlerts();
  var id = 'alert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  var newAlert = Object.assign({ id: id, createdAt: Date.now(), triggered: false, triggerCount: 0 }, alert);
  alerts.push(newAlert);
  _aioSetAlerts(alerts);
  return newAlert;
}
function _aioRemoveAlert(id) {
  var alerts = _aioGetAlerts().filter(function(a) { return a.id !== id; });
  return _aioSetAlerts(alerts);
}
function _aioParseAlertIntent(q) {
  if (!q || typeof q !== 'string') return null;
  var lower = q.toLowerCase();
  if (!/(알림|알람|알려|notify|alert|notification)/i.test(lower)) return null;
  // VIX 임계값
  var vixMatch = lower.match(/vix.*?(\d+\.?\d*)\s*(이상|넘|도달|over|above|>=?)/i);
  if (vixMatch) return { metric: 'vix', tickerOrIndex: '^VIX', threshold: Number(vixMatch[1]), direction: 'above', label: 'VIX ≥ ' + vixMatch[1] };
  var vixBelow = lower.match(/vix.*?(\d+\.?\d*)\s*(이하|아래|미만|under|below|<=?)/i);
  if (vixBelow) return { metric: 'vix', tickerOrIndex: '^VIX', threshold: Number(vixBelow[1]), direction: 'below', label: 'VIX ≤ ' + vixBelow[1] };
  // F&G
  var fgMatch = lower.match(/(f&g|fear.?greed|공포.?탐욕).*?(\d+)\s*(이상|넘|over)/i);
  if (fgMatch) return { metric: 'fg', tickerOrIndex: 'CNN_FG', threshold: Number(fgMatch[2]), direction: 'above', label: 'F&G ≥ ' + fgMatch[2] };
  var fgBelow = lower.match(/(f&g|fear.?greed|공포.?탐욕).*?(\d+)\s*(이하|미만|under)/i);
  if (fgBelow) return { metric: 'fg', tickerOrIndex: 'CNN_FG', threshold: Number(fgBelow[2]), direction: 'below', label: 'F&G ≤ ' + fgBelow[2] };
  // 종목 가격 (예: "NVDA $150 도달" / "AAPL 200 이상")
  var tickerPriceMatch = q.match(/([A-Z]{1,5}(?:\.[A-Z]{2})?)\s*\$?(\d+\.?\d*)\s*(이상|넘|도달|over|above|>=?)/);
  if (tickerPriceMatch) return { metric: 'price', tickerOrIndex: tickerPriceMatch[1], threshold: Number(tickerPriceMatch[2]), direction: 'above', label: tickerPriceMatch[1] + ' ≥ $' + tickerPriceMatch[2] };
  var tickerPriceBelow = q.match(/([A-Z]{1,5}(?:\.[A-Z]{2})?)\s*\$?(\d+\.?\d*)\s*(이하|아래|미만|under|below|<=?)/);
  if (tickerPriceBelow) return { metric: 'price', tickerOrIndex: tickerPriceBelow[1], threshold: Number(tickerPriceBelow[2]), direction: 'below', label: tickerPriceBelow[1] + ' ≤ $' + tickerPriceBelow[2] };
  return null;
}
function _aioCheckAlerts() {
  var alerts = _aioGetAlerts();
  if (alerts.length === 0) return [];
  var ld = window._liveData || {};
  var triggered = [];
  alerts.forEach(function(a) {
    var current = null;
    if (a.metric === 'vix') current = (ld['^VIX'] && ld['^VIX'].price) || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.vix);
    else if (a.metric === 'fg') current = window._lastFG;
    else if (a.metric === 'price' && a.tickerOrIndex) current = (ld[a.tickerOrIndex] && ld[a.tickerOrIndex].price);
    if (current == null) return;
    var hit = a.direction === 'above' ? Number(current) >= Number(a.threshold) : Number(current) <= Number(a.threshold);
    if (hit && !a.triggered) {
      a.triggered = true;
      a.triggerCount = (a.triggerCount || 0) + 1;
      a.lastTriggeredAt = Date.now();
      a.currentValueAtTrigger = current;
      triggered.push(a);
    } else if (!hit && a.triggered) {
      // 조건 미충족 → reset (다음 도달 시 재 알림)
      a.triggered = false;
    }
  });
  if (triggered.length > 0) {
    _aioSetAlerts(alerts);
    // 브라우저 Notification (권한 있을 때)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      triggered.forEach(function(a) {
        try {
          new Notification('AIO Screener 알림', {
            body: a.label + ' 도달! 현재: ' + a.currentValueAtTrigger,
            icon: '/favicon.ico',
            tag: a.id
          });
        } catch(_) {}
      });
    }
  }
  return triggered;
}
window._aioGetAlerts = _aioGetAlerts;
window._aioAddAlert = _aioAddAlert;
window._aioRemoveAlert = _aioRemoveAlert;
window._aioParseAlertIntent = _aioParseAlertIntent;
window._aioCheckAlerts = _aioCheckAlerts;
window.AIO = window.AIO || {};
window.AIO.getAlerts = _aioGetAlerts;
window.AIO.addAlert = _aioAddAlert;
window.AIO.removeAlert = _aioRemoveAlert;
window.AIO.checkAlerts = _aioCheckAlerts;
window.AIO.getUserProfile = _aioGetUserProfile;
window.AIO.setUserProfile = _aioSetUserProfile;
// 자동 1분마다 점검 (페이지 로드 후 30초 지연)
if (typeof setTimeout !== 'undefined' && typeof window !== 'undefined') {
  setTimeout(function() {
    try { _aioCheckAlerts(); } catch(_) {}
    // v52.5x/WO-7: 기존 window._aioRegisterTimer(name, fn, ms) 레지스트리를 경유하도록 전환 —
    // 이전엔 이름 없는 raw setInterval이라 _aioTimerRegistry에 잡히지 않고, 같은 이름으로 중복
    // 실행돼도 clearInterval 자동 정리가 없었다(이 스크립트 블록이 두 번 실행될 경로는 현재
    // 없지만, 레지스트리 경유는 이 코드베이스의 다른 모든 named interval이 이미 따르는 표준
    // 패턴이라 통일).
    if (typeof window._aioRegisterTimer === 'function') {
      window._aioRegisterTimer('alerts-check', function() { try { _aioCheckAlerts(); } catch(_) {} }, 60 * 1000);
    }
  }, 30000);
}

// ─────────────────────────────────────────────────────────────────
// v49.73 P388 R140~R142: 답변 품질 3축 보강 (현재성·정확성·직관성) 헬퍼
// 사용자 정직 질의 "현재 시장/기업 상황 반영, 최신 데이터, 직관적 표현"
// ─────────────────────────────────────────────────────────────────

// _aioRelativeDate(target) — ISO 문자열 또는 monthsAgo number → 'YYYY년 M월 (N일 전)' 동적 문자열
// 정적 날짜 토큰 (예: "2026.04 FOMC") → 동적 마커로 치환하여 세션 시각에 따라 자동 갱신
function _aioRelativeDate(target) {
  var now = new Date();
  var ref;
  if (typeof target === 'number') { ref = new Date(); ref.setMonth(ref.getMonth() + target); }
  else if (typeof target === 'string' && target.length > 0) { ref = new Date(target); }
  else { ref = now; }
  if (isNaN(ref.getTime())) return '날짜 미상';
  var days = Math.round((now.getTime() - ref.getTime()) / (24 * 3600 * 1000));
  var ym = ref.getFullYear() + '년 ' + (ref.getMonth() + 1) + '월';
  if (Math.abs(days) <= 1) return ym + ' (오늘)';
  return ym + ' (' + (days > 0 ? days + '일 전' : Math.abs(days) + '일 후') + ')';
}
window._aioRelativeDate = _aioRelativeDate;

// _aioSessionContextHeader() — 모든 chat system 프롬프트 진입부에 자동 prepend
// 【세션 시각】 + 【시점 자동 인지】 + 【데이터 신선도】 3축으로 AI 환각 시점 인지 보강
function _aioSessionContextHeader() {
  var now = new Date();
  var pad = function(n){ return String(n).padStart(2, '0'); };
  var sessionTs = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' KST';
  var weekdays = ['일','월','화','수','목','금','토'];
  var today = now.getFullYear() + '년 ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 (' + weekdays[now.getDay()] + ')';
  var liveAge = '미수신';
  try {
    var lf = window._lastFetch || {};
    var lastQuoteTs = lf.quote || lf.liveQuotes || lf.live || null;
    if (lastQuoteTs) {
      var ageMin = Math.floor((Date.now() - (typeof lastQuoteTs === 'number' ? lastQuoteTs : new Date(lastQuoteTs).getTime())) / 60000);
      liveAge = (ageMin <= 0 ? '방금' : ageMin + '분 전');
    }
  } catch(_) {}
  var snapDate = '미상';
  try {
    if (window.DATA_SNAPSHOT) snapDate = window.DATA_SNAPSHOT.snapDate || window.DATA_SNAPSHOT.asOf || window.DATA_SNAPSHOT._asOf || '미상';
  } catch(_) {}
  return '【세션 시각: ' + sessionTs + '】\n' +
         '【시점 자동 인지】 오늘은 ' + today + '. 모든 "최근/현재/오늘" 표현은 이 시점 기준.\n' +
         '【데이터 신선도】 _liveData 마지막 갱신: ' + liveAge + ' / DATA_SNAPSHOT 기준일: ' + snapDate + '\n';
}
window._aioSessionContextHeader = _aioSessionContextHeader;

// v49.79 P425/R162: _aioValidateFetchResult — 17 promise 결과 schema 검증 (코드 단위 진단 #4)
// 외부 API schema 변경 시 graceful degradation. _fetchTickerDataForChat의 각 라벨 출력 전 호출.
// 사용자 정직 요구 — schema 변경 시 silent crash 차단.
function _aioValidateFetchResult(result, requiredFields, sourceName) {
  if (!result || typeof result !== 'object') {
    return { valid: false, reason: sourceName + ': result is null/non-object', degradeMsg: '[' + sourceName + ' · 데이터 미수신 또는 schema 오류]' };
  }
  if (result.error || result.fetchFailed) {
    return { valid: false, reason: sourceName + ': explicit error flag', degradeMsg: '[' + sourceName + ' · ' + (result.reason || result.error || 'fetch 실패') + ']' };
  }
  if (Array.isArray(requiredFields)) {
    var missing = requiredFields.filter(function(f) { return result[f] === undefined || result[f] === null; });
    if (missing.length === requiredFields.length) {
      return { valid: false, reason: sourceName + ': all required fields missing (' + missing.join(',') + ')', degradeMsg: '[' + sourceName + ' · schema 변경 가능 — 필수 필드 ' + missing.join(',') + ' 부재]' };
    }
    if (missing.length > 0) {
      // 일부 누락은 partial 처리
      return { valid: true, partial: true, missingFields: missing, warningMsg: '⚠ ' + sourceName + ' partial — ' + missing.join(',') + ' 누락' };
    }
  }
  return { valid: true, partial: false };
}
window._aioValidateFetchResult = _aioValidateFetchResult;

// _aioFetchLabel(name, source, ts) — 데이터 블록 라벨 표준화
// 출력: '[name · fetched YYYY-MM-DD HH:MM KST · source]'
// R142 (출처 + 기준일 괄호 필수) 정합. _fetchTickerDataForChat 16 라벨 일괄 적용.
function _aioFetchLabel(name, source, ts) {
  var t = ts ? (ts instanceof Date ? ts : new Date(ts)) : new Date();
  if (isNaN(t.getTime())) t = new Date();
  var pad = function(n){ return String(n).padStart(2, '0'); };
  var label = t.getFullYear() + '-' + pad(t.getMonth()+1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
  return '[' + name + ' · fetched ' + label + ' KST · ' + (source || 'source 미상') + ']';
}
window._aioFetchLabel = _aioFetchLabel;

// v49.71 P377 R135: SCREENER_DB.memo 신선도 파싱 — memo 헤더의 날짜 패턴 grep + days_since_update 계산
// 사용자 정직 질의 "MEMO가 있더라도 예전의 데이터면 어떡해?" 시정
function _aioParseMemoFreshness(memo) {
  if (!memo || typeof memo !== 'string') return { hasDate: false, days: null, confidence: 'low', label: '날짜 미상' };
  // 패턴: [04/21] / [2026-04-21] / 04/21 (Citi) / (2026-04-21) / [Citi+JPM 04/21] / (4/29 게시)
  var patterns = [
    /\[(\d{4}-\d{2}-\d{2})\]/,                  // [2026-04-21]
    /\((\d{4}-\d{2}-\d{2})\)/,                  // (2026-04-21)
    /(\d{4}\.\d{2}\.\d{2})/,                    // 2026.04.21
    /\[[^\]]*?(\d{1,2})\/(\d{1,2})[^\]]*?\]/,   // [Citi+JPM 04/21] or [04/21]
    /\((\d{1,2})\/(\d{1,2})\s*[게시발표]\)/,    // (4/29 게시)
    /(\d{1,2})\/(\d{1,2})\s*[게시발표]/         // 4/29 게시
  ];
  var year = new Date().getFullYear(); // 2026
  for (var i = 0; i < patterns.length; i++) {
    var m = memo.match(patterns[i]);
    if (m) {
      var dateStr;
      if (m[1] && m[1].length >= 8 && /\d{4}/.test(m[1])) {
        // ISO 형식 (2026-04-21 또는 2026.04.21)
        dateStr = m[1].replace(/\./g, '-');
      } else if (m[1] && m[2]) {
        // MM/DD 형식 — 현재 연도 가정
        dateStr = year + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
      }
      if (dateStr) {
        var parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          var days = Math.floor((Date.now() - parsedDate.getTime()) / 86400000);
          // 미래 날짜 (연도 추정 오류) → 1년 빼서 재계산
          if (days < 0) {
            parsedDate.setFullYear(parsedDate.getFullYear() - 1);
            days = Math.floor((Date.now() - parsedDate.getTime()) / 86400000);
          }
          var confidence = days <= 7 ? 'high' : days <= 30 ? 'medium' : days <= 90 ? 'low' : 'stale';
          var label = days <= 7 ? '🟢 신선 (' + days + '일 전)' :
                      days <= 30 ? '🟡 보통 (' + days + '일 전)' :
                      days <= 90 ? '🟠 오래됨 (' + days + '일 전)' :
                      '🔴 stale (' + days + '일 전 — 외부 확인 권장)';
          return { hasDate: true, dateStr: dateStr, days: days, confidence: confidence, label: label };
        }
      }
    }
  }
  return { hasDate: false, days: null, confidence: 'unknown', label: '⚪ 날짜 미상 (헤더 파싱 실패)' };
}
window._aioParseMemoFreshness = _aioParseMemoFreshness;

// v49.71 P378 R135: SCREENER_DB ticker row 자동 조회 + memo + 신선도 라벨 반환
function _aioGetMemoForTicker(ticker) {
  if (!ticker) return null;
  var db = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
  var row = Array.isArray(db) ? db.find(function(r) { return r && r.sym === ticker; }) : (db[ticker] || null);
  if (!row || !row.memo) {
    return { ticker: ticker, hasMemo: false, fallback: 'SCREENER_DB 미등록 또는 memo 부재 — SEC/Wikipedia/Naver 폴백 의존 (dataConfidence:medium)' };
  }
  var freshness = _aioParseMemoFreshness(row.memo);
  return {
    ticker: ticker,
    hasMemo: true,
    memo: row.memo,
    memoLength: row.memo.length,
    freshness: freshness,
    sector: row.sector || null,
    industry: row.industry || null,
    mcap: row.mcap || null
  };
}
window._aioGetMemoForTicker = _aioGetMemoForTicker;

// v49.70 P371 R132: 사용자 투자 프로필 — 위험성향 + 시간축 + 선호 자산 (localStorage 영속)
// 14 CHAT_CONTEXTS의 system prompt에 자동 주입 → AI가 개인화된 답변 제공
function _aioGetUserProfile() {
  var defaults = { riskTolerance: 'medium', timeHorizon: '1y', preferredAssets: [], excludedAssets: [], note: 'v49.70 신규 — 사용자 프로필 미설정 시 default' };
  try {
    var raw = localStorage.getItem('aio_user_profile_v1');
    if (raw) {
      var parsed = JSON.parse(raw);
      return Object.assign({}, defaults, parsed);
    }
  } catch(_) {}
  return defaults;
}
function _aioSetUserProfile(profile) {
  try {
    var merged = Object.assign({}, _aioGetUserProfile(), profile || {});
    localStorage.setItem('aio_user_profile_v1', JSON.stringify(merged));
    return merged;
  } catch(e) {
    return null;
  }
}
window._aioGetUserProfile = _aioGetUserProfile;
window._aioSetUserProfile = _aioSetUserProfile;

// 14 CHAT_CONTEXTS system prompt에 자동 주입할 사용자 프로필 텍스트
function _buildUserProfileContext() {
  var p = _aioGetUserProfile();
  var riskLabel = p.riskTolerance === 'low' ? '🟢 보수적 (위험 최소화 + 자본 보존 우선)' :
                  p.riskTolerance === 'high' ? '🔴 공격적 (높은 변동성 수용 + 성장 추구)' :
                  '🟡 중립 (균형 잡힌 위험/수익)';
  var horizonLabel = p.timeHorizon === '1d' ? '단기 (1일~1주 — 데이트레이딩/스윙)' :
                     p.timeHorizon === '1m' ? '단기 (1개월 — 모멘텀/이벤트)' :
                     p.timeHorizon === '1y' ? '중기 (1년 — 자산 배분)' :
                     p.timeHorizon === '5y' ? '장기 (5년 — 본질가치/복리)' :
                     p.timeHorizon === '10y' ? '초장기 (10년+ — Buffett 스타일)' :
                     '중기 (default)';
  var prefAssets = Array.isArray(p.preferredAssets) && p.preferredAssets.length > 0 ? p.preferredAssets.join(', ') : '미설정';
  var excAssets = Array.isArray(p.excludedAssets) && p.excludedAssets.length > 0 ? p.excludedAssets.join(', ') : '없음';
  return '\n\n【사용자 투자 프로필 (v49.70 R132 — 답변 시 자동 반영)】\n' +
    '• 위험 성향: ' + riskLabel + '\n' +
    '• 투자 시간축: ' + horizonLabel + '\n' +
    '• 선호 자산/섹터: ' + prefAssets + '\n' +
    '• 제외 자산/섹터: ' + excAssets + '\n' +
    '⚠️ 답변 의무 (R132): 위 프로필에 맞춰 (1) 위험 성향과 맞는 포지션 사이즈/레버리지 추천 (2) 시간축에 맞는 진입 전략 + 보유 기간 (3) 선호 자산 우선 + 제외 자산 회피 + (4) 프로필과 충돌 시 명시 ("프로필이 보수적이라 이 종목은 비중 제한 권장").\n';
}
window._buildUserProfileContext = _buildUserProfileContext;

// v49.69 P368 R131: 거시 시나리오 동적 시뮬레이션 — "Fed 50bp 인하 시" / "VIX 30 도달 시" 등 의도 감지 + 자산 영향 정량 추산
// Bridgewater All Weather + Druckenmiller Macro Overlay 휴리스틱 기반 (정확 회귀 아닌 정성+정량 가이드)
function _simulateMacroScenario(userQuery) {
  if (!userQuery || typeof userQuery !== 'string') return null;
  var q = userQuery.toLowerCase();
  var scenario = null;
  // 패턴 감지
  var fedCutMatch = q.match(/fed.*?(\d+)\s*(bp|basis|베이시스)?\s*(인하|cut|하락)/i) || q.match(/(\d+)\s*(bp|basis|베이시스)?\s*(인하|cut)/i);
  var fedHikeMatch = q.match(/fed.*?(\d+)\s*(bp|basis|베이시스)?\s*(인상|hike|상승)/i) || q.match(/(\d+)\s*(bp|basis|베이시스)?\s*(인상|hike)/i);
  var vixSpikeMatch = q.match(/vix.*?(\d+)\s*(이상|넘|over|spike|도달)/i);
  var spxCrashMatch = q.match(/(s&?p|spx|spy).*?-?(\d+)\s*(%|퍼센트)?\s*(하락|크래시|crash|drop)/i);
  var dxyMatch = q.match(/(dxy|달러|dollar).*?(\d+)\s*(이상|넘|over|돌파)/i);
  var oilMatch = q.match(/(유가|oil|wti|brent).*?\$?(\d+)\s*(이상|넘|over|돌파)/i);
  if (fedCutMatch) {
    var cutBp = Number(fedCutMatch[1]);
    if (cutBp >= 10 && cutBp <= 200) scenario = { type: 'fed-cut', magnitude: cutBp, framework: 'Druckenmiller Macro Overlay (유동성 시그널)' };
  } else if (fedHikeMatch) {
    var hikeBp = Number(fedHikeMatch[1]);
    if (hikeBp >= 10 && hikeBp <= 200) scenario = { type: 'fed-hike', magnitude: hikeBp, framework: 'Druckenmiller + Bridgewater 4-Quadrant' };
  } else if (vixSpikeMatch) {
    var vixLv = Number(vixSpikeMatch[1]);
    if (vixLv >= 15 && vixLv <= 80) scenario = { type: 'vix-spike', magnitude: vixLv, framework: 'Howard Marks Pendulum + Soros Reflexivity' };
  } else if (spxCrashMatch) {
    var spxPct = Number(spxCrashMatch[2]);
    if (spxPct >= 3 && spxPct <= 30) scenario = { type: 'spx-crash', magnitude: spxPct, framework: 'Marks Pendulum + Buffett Margin of Safety' };
  } else if (dxyMatch) {
    var dxyLv = Number(dxyMatch[2]);
    if (dxyLv >= 90 && dxyLv <= 130) scenario = { type: 'dxy-strong', magnitude: dxyLv, framework: 'Bridgewater 4-Quadrant + Druckenmiller' };
  } else if (oilMatch) {
    var oilLv = Number(oilMatch[2]);
    if (oilLv >= 50 && oilLv <= 200) scenario = { type: 'oil-spike', magnitude: oilLv, framework: 'Bridgewater (Stagflation) + MS Cyclical' };
  }
  if (!scenario) return null;
  // 자산별 영향 정량 추산 (휴리스틱 — 역사적 상관계수 기반)
  var impacts = null;
  switch (scenario.type) {
    case 'fed-cut':
      var cutMag = scenario.magnitude / 50;
      impacts = {
        SPX: { direction: '+' + (2 * cutMag).toFixed(1) + '~' + (5 * cutMag).toFixed(1) + '%', verdict: '🟢 우호 (성장주 듀레이션 확장)' },
        '10Y': { direction: '-' + (30 * cutMag).toFixed(0) + '~' + (50 * cutMag).toFixed(0) + 'bp', verdict: '🟢 채권 우호 (가격 상승)' },
        DXY: { direction: '-' + (1.5 * cutMag).toFixed(1) + '~' + (3 * cutMag).toFixed(1) + '%', verdict: '🟢 달러 약세 → EM 자산 우호' },
        Gold: { direction: '+' + (2 * cutMag).toFixed(1) + '~' + (4 * cutMag).toFixed(1) + '%', verdict: '🟢 금 우호 (실질금리 ↓)' },
        Sector: { direction: 'Tech/REIT/Utilities OW · Financials UW', verdict: '🟢 성장주 + 배당주 우호' }
      };
      break;
    case 'fed-hike':
      var hikeMag = scenario.magnitude / 50;
      impacts = {
        SPX: { direction: '-' + (2 * hikeMag).toFixed(1) + '~' + (5 * hikeMag).toFixed(1) + '%', verdict: '🔴 압박 (멀티플 압축)' },
        '10Y': { direction: '+' + (30 * hikeMag).toFixed(0) + '~' + (50 * hikeMag).toFixed(0) + 'bp', verdict: '🔴 채권 약세' },
        DXY: { direction: '+' + (1.5 * hikeMag).toFixed(1) + '~' + (3 * hikeMag).toFixed(1) + '%', verdict: '🔴 달러 강세 → EM 자금 유출' },
        Gold: { direction: '-' + (1 * hikeMag).toFixed(1) + '~' + (3 * hikeMag).toFixed(1) + '%', verdict: '🔴 금 약세 (실질금리 ↑)' },
        Sector: { direction: 'Financials/Energy OW · Tech/REIT UW', verdict: '🔴 성장주 압박, 금융주 수혜' }
      };
      break;
    case 'vix-spike':
      var vixDelta = scenario.magnitude - 18;
      impacts = {
        SPX: { direction: '-' + (vixDelta * 0.3).toFixed(1) + '~' + (vixDelta * 0.6).toFixed(1) + '%', verdict: '🔴 변동성 spike → 위험자산 매도' },
        '10Y': { direction: '-15~30bp', verdict: '🟢 안전자산 도피 → 채권 매수' },
        Gold: { direction: '+1~3%', verdict: '🟢 안전자산 수혜' },
        'Quality': { direction: 'Defensive OW · High-Beta UW', verdict: '🔴 방어주 OW, 베타↑ 종목 회피' },
        'Marks Pendulum': { direction: '비관 극단 진입 — Marks 프레임워크가 6~12개월 비대칭 구간으로 서술', verdict: '🟢 역발상 프레임 주목 구간(Marks 귀속, 지시 아님)' }
      };
      break;
    case 'spx-crash':
      impacts = {
        VIX: { direction: '+' + (scenario.magnitude * 1.5).toFixed(0) + '~' + (scenario.magnitude * 2.5).toFixed(0) + '%', verdict: '🔴 변동성 폭발' },
        '10Y': { direction: '-30~60bp', verdict: '🟢 채권 강한 매수' },
        Gold: { direction: '+2~5%', verdict: '🟢 안전자산 강한 수혜' },
        Sector: { direction: 'Staples/Healthcare/Utilities OW · Cyclicals UW', verdict: '🔴 방어주 로테이션' },
        'Buffett MoS': { direction: 'Margin of Safety 확보 시점 — 매수 검토', verdict: '🟢 역발상' }
      };
      break;
    case 'dxy-strong':
      impacts = {
        EM: { direction: '-5~15% (DXY ' + scenario.magnitude + ')', verdict: '🔴 EM 자산 강한 압박' },
        SPX: { direction: '-2~5%', verdict: '🔴 다국적 기업 환율 역풍' },
        Gold: { direction: '-3~7%', verdict: '🔴 달러 강세 → 금 약세' },
        KOSPI: { direction: '-3~8%', verdict: '🔴 외국인 자금 유출' }
      };
      break;
    case 'oil-spike':
      impacts = {
        Energy: { direction: '+10~25%', verdict: '🟢 에너지 섹터 강세' },
        Airlines: { direction: '-8~20%', verdict: '🔴 항공/운송 압박' },
        CPI: { direction: '+0.3~0.8%p', verdict: '🔴 인플레 압력 ↑' },
        'Stagflation': { direction: 'Bridgewater Quadrant: 성장↓+인플레↑', verdict: '🔴 스태그플레이션 리스크' }
      };
      break;
  }
  return {
    scenario: scenario,
    impacts: impacts,
    note: '휴리스틱 (역사적 상관계수 기반) — 정확 회귀 아닌 정성+정량 가이드. ' + scenario.framework + ' 프레임 적용.'
  };
}
window._simulateMacroScenario = _simulateMacroScenario;

// v49.69 P369 R131: 약어/별명 fuzzy match 강화 — "엔비" / "퀄컴" / "테슬라" / 본드 / 환율 등
function _resolveTickerFromFuzzy(input) {
  if (!input || typeof input !== 'string') return null;
  var q = String(input).trim().toLowerCase();
  var fuzzyMap = {
    '엔비': 'NVDA', '엔비디아': 'NVDA',
    '애플': 'AAPL',
    '구글': 'GOOGL', '알파벳': 'GOOGL',
    '아마존': 'AMZN',
    '마소': 'MSFT', '마이크로': 'MSFT', '마크': 'MSFT',
    '테슬': 'TSLA', '테슬라': 'TSLA',
    '메타': 'META', '페북': 'META', '페이스북': 'META',
    '퀄컴': 'QCOM',
    '인텔': 'INTC',
    '브로드컴': 'AVGO',
    '암드': 'AMD',
    '팔란티어': 'PLTR', '팔란': 'PLTR',
    '슈퍼마이크로': 'SMCI',
    '넷플': 'NFLX', '넷플릭스': 'NFLX',
    '디즈니': 'DIS',
    '삼성전자': '005930.KS', '삼전': '005930.KS',
    '하이닉스': '000660.KS',
    '에코프로': '086520.KQ', '에코프로비엠': '247540.KQ',
    '카카오': '035720.KS',
    '네이버': '035420.KS',
    'LG화학': '051910.KS',
    '현대차': '005380.KS',
    '코스피': '^KS11', 'kospi': '^KS11',
    '코스닥': '^KQ11', 'kosdaq': '^KQ11',
    '엔화': 'JPY=X', 'jpy': 'JPY=X',
    '원화': 'KRW=X', '원달러': 'KRW=X',
    '위안': 'CNY=X', '위안화': 'CNY=X',
    '비트코인': 'BTC-USD', '코인': 'BTC-USD',
    '이더리움': 'ETH-USD',
    '금': 'GC=F', 'gold': 'GC=F',
    '은': 'SI=F', 'silver': 'SI=F',
    '유가': 'CL=F', 'wti': 'CL=F', '원유': 'CL=F',
    '나스닥': '^IXIC', 'nasdaq': '^IXIC',
    'S&P': '^GSPC', '에스앤피': '^GSPC',
    '다우': '^DJI', '다우존스': '^DJI',
    '러셀': '^RUT', '러셀2000': '^RUT'
  };
  if (fuzzyMap[q]) return fuzzyMap[q];
  var keys = Object.keys(fuzzyMap);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i].toLowerCase();
    if (q.indexOf(k) >= 0 || (k.length >= 2 && k.indexOf(q) >= 0 && q.length >= 2)) {
      return fuzzyMap[keys[i]];
    }
  }
  return null;
}
window._resolveTickerFromFuzzy = _resolveTickerFromFuzzy;

// v49.69 P366 R130: 자동 페이지 이동 — 사용자 입력 의도 → 적합 페이지 자동 전환
// "차트 보여줘" / "포트폴리오 분석" / "옵션 전략" 키워드 감지 → showPage 자동 호출 + 안내 메시지
function _autoNavigatePage(userQuery, currentCtxId) {
  if (!userQuery || typeof userQuery !== 'string') return null;
  var q = userQuery.toLowerCase();
  var intent = null;
  // 키워드 패턴 → 페이지 매핑
  if (/(차트|chart|기술|technical|RSI|MACD|이동평균|MA|Weinstein)/i.test(q)) intent = { page: 'technical', label: '차트 분석', emoji: '📈' };
  else if (/(시그널|signal|매매|trade|점수|score|ACTION)/i.test(q)) intent = { page: 'signal', label: '매매 시그널', emoji: '🎯' };
  else if (/(시장 폭|breadth|McClellan|AD line|NHNL)/i.test(q)) intent = { page: 'breadth', label: '시장 폭', emoji: '📊' };
  else if (/(심리|sentiment|VIX|F&G|공포|탐욕|AAII|Put.?Call|PCR)/i.test(q)) intent = { page: 'sentiment', label: '투자 심리', emoji: '🧠' };
  else if (/(매크로|macro|Fed|CPI|PCE|유가|달러|환율|FOMC|금리)/i.test(q)) intent = { page: 'macro', label: '거시경제', emoji: '🌍' };
  else if (/(외환|FX|채권|bond|10Y|2Y|국채|금리)/i.test(q) && !/(macro|매크로)/i.test(q)) intent = { page: 'fxbond', label: '환율/채권', emoji: '💱' };
  else if (/(기업 분석|fundamental|재무|earnings|EPS|PER|밸류에이션|valuation|owner earnings|moat)/i.test(q)) intent = { page: 'fundamental', label: '기업 분석', emoji: '🏢' };
  else if (/(테마|theme|섹터|sector|RRG|rotation)/i.test(q)) intent = { page: 'themes', label: '테마/섹터', emoji: '🔄' };
  else if (/(포트폴리오|portfolio|보유|holdings|리밸런싱|rebalancing)/i.test(q)) intent = { page: 'portfolio', label: '포트폴리오', emoji: '💼' };
  else if (/(옵션|option|GEX|put|call|delta|gamma|theta|vega)/i.test(q)) intent = { page: 'options', label: '옵션 전략', emoji: '⚙️' };
  else if (/(브리핑|briefing|오늘|today|이번 주|this week)/i.test(q)) intent = { page: 'briefing', label: '데일리 브리핑', emoji: '📰' };
  else if (/(뉴스|news|헤드라인|headline)/i.test(q)) intent = { page: 'market-news', label: '실시간 뉴스', emoji: '🗞️' };
  else if (/(한국|KOSPI|KOSDAQ|KRX|코스피|코스닥|원화|BOK|한은|VKOSPI)/i.test(q)) intent = { page: 'macro', label: '한국 거시(거시경제 페이지 통합 섹션)', emoji: '🇰🇷' };
  // 현재 컨텍스트와 동일하면 이동 불필요
  if (intent && intent.page === currentCtxId) return null;
  return intent;
}
window._autoNavigatePage = _autoNavigatePage;

// v49.69 P367 R130: 포트폴리오 동적 시뮬레이션 — "AAPL 10% 추가 시" 의도 감지 + 가중치 변화 계산
// 답변에 시나리오 결과 자동 삽입 (보유 종목 라이브 가격 + 시뮬레이션 후 가중치)
function _simulatePortfolioAddition(userQuery, detectedTickers) {
  if (!userQuery || typeof userQuery !== 'string') return null;
  var q = userQuery.toLowerCase();
  // 의도 감지: "X% 추가" / "X 주 매수" / "X 만큼 늘리면"
  var addMatch = q.match(/(\d+\.?\d*)\s*(%|퍼센트|percent)\s*(추가|매수|늘리|increase|add|buy)/i);
  var percentToAdd = addMatch ? Number(addMatch[1]) : null;
  if (!percentToAdd || percentToAdd <= 0 || percentToAdd > 100) return null;
  var target = (Array.isArray(detectedTickers) && detectedTickers[0]) || null;
  if (!target) return null;
  // 현재 포트폴리오 holdings 조회
  var portfolio = null;
  try {
    if (typeof window.getPortfolioState === 'function') portfolio = window.getPortfolioState();
    if (!portfolio || !portfolio.holdings) {
      var pfRaw = localStorage.getItem('aio_portfolio_v1');
      if (pfRaw) portfolio = JSON.parse(pfRaw);
    }
  } catch(_) {}
  if (!portfolio || !Array.isArray(portfolio.holdings) || portfolio.holdings.length === 0) {
    return {
      target: target,
      percentToAdd: percentToAdd,
      available: false,
      note: '포트폴리오 비어 있음 — 보유 종목 추가 후 시뮬레이션 가능'
    };
  }
  // 현재 총 가치 + 가중치
  var ld = window._liveData || {};
  var currentTotal = portfolio.holdings.reduce(function(sum, h) {
    var price = (ld[h.symbol] && ld[h.symbol].price) || h.price || 0;
    return sum + (price * (h.quantity || 0));
  }, 0);
  if (currentTotal <= 0) return null;
  // 시뮬레이션: target ticker를 percentToAdd% 비중으로 추가
  var targetPrice = (ld[target] && ld[target].price) || null;
  if (!targetPrice) return { target: target, percentToAdd: percentToAdd, available: false, reason: '시세 미수신' };
  var addAmount = currentTotal * (percentToAdd / 100);
  var addQty = Math.floor(addAmount / targetPrice);
  var newTotal = currentTotal + (addQty * targetPrice);
  // 신규 가중치 계산
  var newWeights = portfolio.holdings.map(function(h) {
    var price = (ld[h.symbol] && ld[h.symbol].price) || h.price || 0;
    var currentValue = price * (h.quantity || 0);
    var newValue = h.symbol === target ? currentValue + (addQty * targetPrice) : currentValue;
    return {
      symbol: h.symbol,
      currentPct: +(currentValue / currentTotal * 100).toFixed(2),
      newPct: +(newValue / newTotal * 100).toFixed(2),
      change: +((newValue / newTotal * 100) - (currentValue / currentTotal * 100)).toFixed(2)
    };
  });
  // target이 holdings에 없으면 신규 추가
  var existsInHoldings = portfolio.holdings.some(function(h) { return h.symbol === target; });
  if (!existsInHoldings) {
    newWeights.push({
      symbol: target,
      currentPct: 0,
      newPct: +(addQty * targetPrice / newTotal * 100).toFixed(2),
      change: +(addQty * targetPrice / newTotal * 100).toFixed(2)
    });
  }
  return {
    target: target,
    percentToAdd: percentToAdd,
    available: true,
    targetPrice: targetPrice,
    addAmount: Math.round(addAmount),
    addQty: addQty,
    currentTotal: Math.round(currentTotal),
    newTotal: Math.round(newTotal),
    weights: newWeights,
    note: 'currentPct → newPct 가중치 변화. addQty = floor(addAmount / targetPrice)로 정수 주식 수만 시뮬레이션.'
  };
}
window._simulatePortfolioAddition = _simulatePortfolioAddition;

// v49.69 P365 R129: 후속 질문 3개 자동 제안 — 답변 내용 + 페이지 컨텍스트 + 감지된 ticker로 유기적 후속 질문 생성
// 사용자 정직 요구: "AI 채팅에서 활용할 수 있는 모든 답변/기능" — 대화 깊이 + 유기적 흐름
function _suggestFollowUpQuestions(ctxId, userQuery, aiResponse, detectedTickers) {
  if (!ctxId || !aiResponse) return [];
  var tickers = Array.isArray(detectedTickers) ? detectedTickers.filter(Boolean).slice(0, 2) : [];
  var primaryTicker = tickers[0] || null;
  var lowerResp = String(aiResponse || '').toLowerCase();
  var lowerQ = String(userQuery || '').toLowerCase();
  var suggestions = [];
  // 페이지별 후속 질문 패턴 (10 컨텍스트 + KR 4)
  if (primaryTicker) {
    // 종목 분석 후속 — 17 관점 중 일부 deep-dive
    suggestions.push(primaryTicker + ' 의 Bull/Base/Bear 3 시나리오 확신도와 트리거 조건은?');
    if (lowerResp.indexOf('moat') < 0 && lowerResp.indexOf('해자') < 0) suggestions.push(primaryTicker + ' 의 경제적 해자 (Moat) — Buffett Owner Earnings + Ackman 8 기준 평가');
    else if (lowerResp.indexOf('partnership') < 0 && lowerResp.indexOf('파트너') < 0) suggestions.push(primaryTicker + ' 의 최근 6개월 SEC 8-K 파트너십 + 경쟁사 비교');
    else suggestions.push(primaryTicker + ' 가 현재 매크로 환경(VIX/금리/DXY)에서 가지는 비대칭 리스크');
    suggestions.push(primaryTicker + ' 을 포트폴리오에 10% 추가 시 가중치/리스크/예상 수익 시뮬레이션');
  } else if (ctxId === 'macro' || ctxId === 'kr-macro') {
    suggestions.push('Bridgewater 4-Quadrant 기준 현재 시장 위치는? (성장 × 인플레)');
    suggestions.push('Fed가 다음 회의에서 50bp 인하 시 자산별 영향 (주식/채권/달러/금)');
    suggestions.push('Druckenmiller Macro Overlay — 18개월 선행 유동성 시그널 현재 점수');
  } else if (ctxId === 'sentiment') {
    suggestions.push('Howard Marks Pendulum 기준 현재 심리 위치 — 향후 6~12개월 비대칭');
    suggestions.push('VIX/F&G/AAII/Put-Call 6 지표 종합 결론 + 매수/매도 시그널');
    suggestions.push('극단 공포(F&G ≤ 25) 도달 시 역사적 6~12개월 평균 수익률');
  } else if (ctxId === 'technical') {
    suggestions.push('현재 SPX의 Weinstein Stage 판정 + 다음 단계 전환 트리거');
    suggestions.push('Soros Bubble 5단계 (Stealth/Awareness/Mania/Distribution/Panic) 위치');
    suggestions.push('차트 신뢰도 vs 매크로 환경 — 현재 패턴 신뢰도 가감');
  } else if (ctxId === 'fxbond') {
    suggestions.push('한국 3Y/10Y 금리 + USD/KRW + Fed 경로 교차 분석');
    suggestions.push('Bridgewater 4-Quadrant 기준 FX/채권 방향성 + Druckenmiller 시그널');
    suggestions.push('한국은행 다음 결정 시나리오 (동결/인하/인상) + 원화 영향');
  } else if (ctxId === 'signal' || ctxId === 'breadth') {
    suggestions.push('GS GIR Out of Consensus 알파 기회 — 현재 시장 미반영 시그널');
    suggestions.push('MS Cyclical Pendulum 섹터 위치 (Early/Mid/Late/Recession) + 추천');
    suggestions.push('현재 트레이딩 스코어 + ACTION_RULES 액션 + Bull/Base/Bear 확신도');
  } else if (ctxId === 'portfolio') {
    suggestions.push('보유 종목 4-Quadrant 분포 + 안전 마진 점검 (Bridgewater + Buffett)');
    suggestions.push('현재 포트폴리오 + 시장 환경 일치 여부 + 리밸런싱 액션');
    suggestions.push('포트폴리오에 방어주/에너지/금 5~10% 추가 시 리스크 감소 효과');
  } else if (ctxId === 'themes' || ctxId === 'theme-detail' || ctxId === 'kr-themes') {
    suggestions.push('Soros Reflexivity — 이 테마의 거품 단계 (Stealth/Mania/Panic)');
    suggestions.push('MS Cyclical 섹터 로테이션 — 이 테마의 현재 위치 + 다음 단계');
    suggestions.push('테마 등록 종목 중 최근 6개월 8-K 파트너십 다발 종목 Top 3');
  } else if (ctxId === 'market-news' || ctxId === 'briefing') {
    suggestions.push('오늘 핵심 이벤트 3개 + 각각 시장 영향 (Bull/Base/Bear)');
    suggestions.push('다음 주 FOMC + 어닝 + CPI 일정 + 포지셔닝 가이드');
    suggestions.push('현재 뉴스 흐름이 Howard Marks Pendulum에서 가리키는 위치');
  } else if (ctxId === 'fundamental') {
    suggestions.push('NVDA / AAPL / MSFT 3종 비교 — 17 관점 매트릭스');
    suggestions.push('Buffett 8 Criteria 모두 충족하는 현재 시장 종목 Top 5');
    suggestions.push('Owner Earnings + Margin of Safety 70% 이하 종목 스크리닝');
  } else if (ctxId === 'options') {
    suggestions.push('현재 VIX/Put-Call/GEX 기준 추천 옵션 전략 (3 시나리오)');
    suggestions.push('Howard Marks Pendulum — 옵션 IV 진자 위치 + 매도/매수 가이드');
  } else if (ctxId === 'kr-supply' || ctxId === 'kr-tech') {
    suggestions.push('한국 외국인/기관/개인 3주체 수급 + 다음 주 전망');
    suggestions.push('KOSPI Weinstein Stage + VKOSPI 극단 + 미너비니 바닥 3단계');
    suggestions.push('한국 vs 미국 디커플링 — 현재 강세/약세 + 트리거');
  }
  // 사용자 질의에서 키워드 추출 → 추가 후속 질문
  if (/(언제|when)/i.test(lowerQ) && suggestions.length < 4) {
    suggestions.push('다음 핵심 이벤트 (FOMC/CPI/어닝) D-Day 카운트 + 시장 영향 시나리오');
  }
  if (/(왜|why)/i.test(lowerQ) && suggestions.length < 4) {
    suggestions.push('이 결론의 반대 시나리오 (Bear case) — 무엇이 트리거인가?');
  }
  // 중복 제거 + 3개 한도
  var seen = {};
  return suggestions.filter(function(s) {
    if (seen[s]) return false;
    seen[s] = true;
    return true;
  }).slice(0, 3);
}
window._suggestFollowUpQuestions = _suggestFollowUpQuestions;

// chatSend + chatSendUnified 공통 freshness 계산 — 날짜(KST)·liveData stale·snapAge
window._aioChatFreshnessInfo = function() {
  var todayStr;
  try {
    var nowKst = new Date(new Date().getTime() + (9*60 - new Date().getTimezoneOffset()) * 60000);
    todayStr = nowKst.toISOString().slice(0,10) + ' (KST)';
  } catch(e) { todayStr = new Date().toISOString().slice(0,10); }
  var ldAgeMin = null;
  try {
    if (window._quoteTimestamps) {
      var ts = Object.values(window._quoteTimestamps);
      if (ts.length > 0) ldAgeMin = Math.round((Date.now() - Math.max.apply(null, ts)) / 60000);
    }
  } catch(e) {}
  var liveStatus;
  if (!isFinite(ldAgeMin) || Object.keys(window._liveData||{}).length <= 10)
    liveStatus = '✗ 미수신 — 가격 수치 인용 자체 금지. "실시간 연결 중" 안내만';
  else if (ldAgeMin >= 10) liveStatus = '⚠ ' + ldAgeMin + '분 전 데이터 — 가격 수치 인용 시 "약 N분 지연" 명시 필수';
  else if (ldAgeMin >= 5)  liveStatus = '⚠ ' + ldAgeMin + '분 지연 — 주의';
  else liveStatus = '✓ 정상 (' + ldAgeMin + '분 전 갱신)';
  var snapAge = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._updated)
    ? Math.round((Date.now() - new Date(DATA_SNAPSHOT._updated).getTime()) / 3600000) : 999;
  return { todayStr: todayStr, ldAgeMin: ldAgeMin, liveStatus: liveStatus, snapAge: snapAge };
};

async function chatSend(ctxId) {
  // v49.77 P410 R153: chatSend silent return 5+ 경로 모두 사용자 피드백 (사용자 좌절 시정)
  // 사용자 발견 — home 채팅 안 됨 등 silent fail 경험. 모든 early return에 toast/inline 안내.
  var ctx = CHAT_CONTEXTS[ctxId];
  if (!ctx) {
    if (typeof showToast === 'function') showToast('⚠ 채팅 컨텍스트 미정의: ' + ctxId + ' — 새로고침 후 재시도', 5000);
    if (typeof console !== 'undefined' && console.warn) console.warn('[AIO chatSend] CHAT_CONTEXTS[' + ctxId + '] undefined. 정의된 ctxIds:', Object.keys(CHAT_CONTEXTS || {}).join(','));
    return;
  }
  var state = getChatState(ctxId);
  if (state.streaming) {
    if (typeof showToast === 'function') showToast('⏳ 이전 답변 스트리밍 중 — 완료 후 재시도', 3000);
    return;
  }

  var inp = document.getElementById('chat-' + ctxId + '-inp');
  var btn = document.getElementById('chat-' + ctxId + '-btn');
  if (!inp) {
    // DOM 부재 — v49.74 P398/R146 케이스. 사용자에게 명확 안내.
    if (typeof showToast === 'function') showToast('⚠ 채팅 입력창 DOM 부재: chat-' + ctxId + '-inp — 페이지 새로고침 권장', 6000);
    if (typeof console !== 'undefined' && console.error) console.error('[AIO chatSend] DOM input missing for ctxId=' + ctxId + '. CHAT_CONTEXTS 등록 후 DOM 패널 누락 가능성 (P398/R146).');
    return;
  }

  var q = inp.value.trim();
  if (!q) {
    // 빈 입력 — inline 미세 안내 (toast는 spam되므로 input border 강조만)
    try {
      inp.style.transition = 'border-color 0.3s';
      inp.style.borderColor = '#ffa31a';
      setTimeout(function(){ inp.style.borderColor = ''; }, 800);
      inp.focus();
    } catch(_) {}
    return;
  }
  // v49.78 C4 P419: state.streaming atomic lock — 동시 클릭 race condition 차단
  // 기존 L4335 streaming=true 설정까지 60줄+ 거리 → 빠른 더블 클릭 시 race window 존재
  // 검증 통과 직후 즉시 atomic lock — 이후 모든 prep는 lock 보호 영역
  if (state.streaming) {
    if (typeof showToast === 'function') showToast('⏳ 이미 처리 중인 요청 있음 — 완료 후 재시도', 2500);
    return;
  }
  state._chatSendEntered = state._chatSendEntered || 0;
  state._chatSendEntered++;
  if (state._chatSendEntered > 1) {
    state._chatSendEntered--;
    if (typeof showToast === 'function') showToast('⏳ 중복 요청 차단 — 첫 번째 요청 완료 후 재시도', 2500);
    return;
  }

  // v48.94 P160: fundamental 자동 분석 재귀 상한 (fundamentalSearch → chatSend → ... loop)
  if (ctxId === 'fundamental') {
    state._fundDepth = (state._fundDepth || 0) + 1;
    if (state._fundDepth > 2) {
      state._fundDepth = 0;
      chatAppendMsg(ctxId, 'ai', '<div style="font-size:12px;color:#fbbf24;padding:4px 8px;background:rgba(251,191,36,0.08);border-radius:4px;">⚠ 자동 분석 재귀 상한(2회)에 도달했습니다. 새 종목을 검색하거나 직접 질문해주세요.</div>');
      return;
    }
  }

  // v29: API 키 확인 먼저 (횟수 차감 전에 체크)
  // v49.59 P329 R109: 키 미입력 시 사이드바 input 강조 + inline alert 강화
  var _chatApiKey = getApiKey();
  var _chatRoute = typeof _aioEnsureClaudeRoute === 'function'
    ? await _aioEnsureClaudeRoute(_chatApiKey)
    : { ok: typeof _aioHasClaudeRoute === 'function' ? _aioHasClaudeRoute(_chatApiKey) : !!_chatApiKey, reason: 'NO_ROUTE' };
  if (!_chatRoute.ok) {
    chatAppendMsg(ctxId, 'ai', '<div style="color:#f87171;padding:8px 12px;background:rgba(248,113,113,0.1);border-left:3px solid #f87171;border-radius:4px;">' +
      '<b>⚠ AI 라우트 확인 필요</b><br>' +
      (typeof _aioRouteNotice === 'function' ? _aioRouteNotice(_chatRoute.reason) : 'Claude 개인 키 또는 명시된 Worker 라우트가 필요합니다.') + '<br>' +
      '사이드바 → "Claude API 키" 입력란에 <code>sk-ant-...</code> 형식 키 입력 후 저장하세요.<br>' +
      '<a href="https://console.anthropic.com" target="_blank" style="color:#00d4ff;">→ console.anthropic.com에서 무료 발급 ($5 크레딧)</a>' +
      '</div>');
    // 사이드바 input 강조 (1회 pulse)
    try {
      var keyInput = document.getElementById('sidebar-api-key');
      if (keyInput) {
        var origBorder = keyInput.style.border;
        keyInput.style.transition = 'border 0.3s';
        keyInput.style.border = '2px solid #f87171';
        keyInput.focus();
        setTimeout(function(){ keyInput.style.border = origBorder; }, 3000);
      }
    } catch(_) {}
    return;
  }

  if (!consumeLLMQuery()) return;

  inp.value = '';
  state.streaming = true;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  // v31.3: 질문 복잡도 감지 → 모델 자동 선택
  var selectedModelKey = _detectQueryComplexity(q, ctxId);
  var selectedModelCfg = getModelConfig(selectedModelKey);

  // v30.15: 티커 감지 → 실시간 데이터 조회 → 시스템 프롬프트에 주입
  // v49.69 P369 R131: _extractTickers 0건일 때 fuzzy match 폴백 (약어/별명 매핑)
  var detectedTickers = _extractTickers(q);
  if (detectedTickers.length === 0 && typeof _resolveTickerFromFuzzy === 'function') {
    // 입력을 공백/조사로 토큰화 후 fuzzy 매칭
    var _qTokens = q.split(/[\s,;.!?·…\(\)\[\]]+/).filter(function(t) { return t.length >= 2; });
    var _fuzzyHits = [];
    _qTokens.forEach(function(tok) {
      var resolved = _resolveTickerFromFuzzy(tok);
      if (resolved && _fuzzyHits.indexOf(resolved) < 0) _fuzzyHits.push(resolved);
    });
    if (_fuzzyHits.length > 0) {
      detectedTickers = _fuzzyHits.slice(0, 3); // 최대 3개
    }
  }
  var chatFreshPreflight = null;
  if (window.AIO && typeof window.AIO.ensureFreshChatAnswerData === 'function') {
    try {
      chatFreshPreflight = await Promise.race([
        window.AIO.ensureFreshChatAnswerData({ ctxId: ctxId, query: q, tickers: detectedTickers, reason: 'chat-answer', forceFresh: detectedTickers.length > 0 }),
        new Promise(function(resolve) { setTimeout(function(){ resolve({ status: 'timeout', strict: detectedTickers.length > 0 }); }, 6500); })
      ]);
    } catch(_chatFreshErr) {
      chatFreshPreflight = { status: 'warn', error: _chatFreshErr && _chatFreshErr.message || String(_chatFreshErr), strict: detectedTickers.length > 0 };
    }
  } else if (window.AIO && typeof window.AIO.ensureFreshDataForUse === 'function') {
    try {
      await Promise.race([
        window.AIO.ensureFreshDataForUse({ ctxId: ctxId, query: q, tickers: detectedTickers, reason: 'chat' }),
        new Promise(function(resolve) { setTimeout(function(){ resolve(null); }, 4500); })
      ]);
    } catch(_freshErr) {}
  }
  var tickerDataStr = '';
  if (detectedTickers.length > 0) {
    try { tickerDataStr = await _fetchTickerDataForChat(detectedTickers, { forceFresh: true, reason: 'chat-answer', preflight: chatFreshPreflight, query: q, ctxId: ctxId }); } catch(e) {}
  }

  // v50.12: 기술적 분석 컨텍스트 — 종목별 실측 기술지표(RSI/MA/Stage/ATR 이격/확장도) 주입. 기존 OHLCV 엔진 재사용.
  var technicalDataStr = '';
  // v50.38 트랙3: 기술 데이터 컨텍스트 확장 — 티커 감지 시 전 컨텍스트에 기술 분석 자동 동반.
  //   (종목 무관 매크로/뉴스 질의는 detectedTickers 0이라 미발동 → 비용 통제). 초보자 차트 읽기 카드도 이 데이터 기반.
  if (detectedTickers.length > 0) {
    try { technicalDataStr = await _fetchTechnicalDataForChat(detectedTickers); } catch(e) {}
  } else {
    try {
      var defaultTechnicalTickers = (typeof _aioTechnicalSymbolsForChat === 'function') ? _aioTechnicalSymbolsForChat(ctxId, q, detectedTickers) : [];
      if (defaultTechnicalTickers && defaultTechnicalTickers.length) {
        technicalDataStr = await _fetchTechnicalDataForChat(defaultTechnicalTickers, { ctxId: ctxId, query: q, autoMarket: true });
      }
    } catch(e) {}
  }

  // v34.2: 섹터/카테고리 비교 질문 감지 → FMP 다중 종목 밸류에이션 일괄 조회
  var sectorCompareStr = '';
  if (detectedTickers.length === 0) {
    // 특정 티커 없이 섹터 질문인 경우에만 발동
    var sectorMatch = _detectSectorQuery(q);
    if (sectorMatch) {
      try {
        var compareData = await _fetchSectorCompareData(sectorMatch.stocks);
        sectorCompareStr = _formatSectorComparePrompt(sectorMatch.sectorLabel, compareData);
      } catch(e) { _aioLog('warn', 'fetch', '섹터 비교 데이터 조회 실패: ' + e.message); }
    }
  }

  // v50.37 트랙1: 자연어 스크리너 질의 — 실제 SCREENER_DB 필터(일반 LLM 불가 차별 기능). 특정 티커 없을 때만.
  var screenerStr = '';
  var screenerResult = null;
  if (detectedTickers.length === 0 && typeof _aioRunScreenerQuery === 'function') {
    try {
      var recentRecommendationTickers = (typeof _aioExtractRecentRecommendationTickers === 'function') ? _aioExtractRecentRecommendationTickers(state.messages) : [];
      screenerResult = _aioRunScreenerQuery(q, { recentTickers: recentRecommendationTickers });
      if (screenerResult && screenerResult.matched) screenerStr = _formatScreenerResultPrompt(screenerResult);
    } catch(e) { _aioLog('warn', 'fetch', '스크리너 질의 실패: ' + e.message); }
  }

  // v50.38 트랙2: 도메인 라이브 데이터 주입 — macro/fxbond/themes 채팅에 페이지 도메인 데이터(수익률곡선·DXY·사이클·섹터 리더 등) 주입.
  var domainDataStr = '';
  if (typeof _fetchDomainContextForChat === 'function' && /^(macro|kr-macro|fxbond|themes|theme-detail|kr-themes)$/.test(ctxId)) {
    try { domainDataStr = _fetchDomainContextForChat(ctxId); } catch(e) {}
  }

  // v34.2: 기업 내부 비교 분석 (비즈니스 모델, 수익 구조, 해자 등) — 티커 2~3개 + 내부 비교 의도 감지 시
  var deepCompareStr = '';
  if (detectedTickers.length >= 2 && _detectDeepCompareIntent(q)) {
    // v34.4: 심층 비교는 API 비용/속도 제한으로 최대 3개 — 초과 시 사용자 안내
    var deepTickers = detectedTickers.slice(0, 3);
    if (detectedTickers.length > 3) {
      showToast('심층 비교는 최대 3개 종목까지 가능합니다. ' + deepTickers.join(', ') + '로 분석합니다.');
    }
    try {
      var deepData = await _fetchDeepCompareData(deepTickers);
      if (deepData) deepCompareStr = _formatDeepComparePrompt(deepTickers, deepData);
    } catch(e) { _aioLog('warn', 'fetch', '기업 내부 비교 데이터 조회 실패: ' + e.message); }
  }

  // v50.70: 단일 기업 분석 — 티커 1개 감지 시 기본적으로 17개 관점 심층 분석 자동 적용
  // fundamental 컨텍스트에서는 키워드 없이도 자동 트리거
  // v48.55: themes/theme-detail ctx에서도 FMP 심층 수집 활성화 — 사용자 지적 반영
  //   "AI 채팅에서 테마/트렌드에 있는 모든 종목 상세 분석 가능해야" → 단일 티커 질의 시 재무 자동 포함
  //   portfolio ctx도 보유 종목 분석 시 심층 필요 — 자동 확장
  var singleDeepStr = '';
  var _isFundCtx = (ctxId === 'fundamental');
  var _shouldDeepAnalyze = _shouldSingleDeepAnalyzeChat(ctxId, q, detectedTickers, deepCompareStr);
  if (_shouldDeepAnalyze) {
    var fd = window._fundAnalysisData;
    var alreadyHasData = fd && fd.ticker && fd.ticker === detectedTickers[0];
    if (!alreadyHasData && (_getApiKey('aio_fmp_key') || '')) {
      try {
        var singleDeepData = await _fetchDeepCompareData(detectedTickers);
        if (singleDeepData) singleDeepStr = _formatSingleDeepPrompt(detectedTickers[0], singleDeepData);
      } catch(e) { _aioLog('warn', 'fetch', '단일 기업 심층 데이터 조회 실패: ' + e.message); }
    }
  }

  // v36.2: 웹검색 — 최신 정보가 필요한 질문이면 자동 검색 (Perplexity > Google 폴백)
  var webSearchResult = null;
  var webSearchStr = '';
  var searchQuery = _needsWebSearch(q, ctxId);
  if (searchQuery) {
    try {
      webSearchResult = await _aiWebSearch(searchQuery);
      webSearchStr = _formatSearchForPrompt(webSearchResult);
      if (webSearchStr && window.AIO && typeof window.AIO.buildAIUntrustedBlock === 'function') {
        webSearchStr = window.AIO.buildAIUntrustedBlock('WEB_SEARCH', webSearchStr);
      }
      console.log('[AIO] 웹검색 완료 [' + (webSearchResult.engine||'?') + ']:', searchQuery, '→', (webSearchResult.answer || '').length + '자');
    } catch(e) {
      _aioLog('warn', 'fetch', '웹검색 실패: ' + e.message);
      // 검색 실패해도 기존 답변은 정상 진행
    }
  }

  // v37.2: 뉴스 컨텍스트 주입 — newsCache에서 관련 뉴스 자동 추출
  var newsContextStr = _buildNewsContext(ctxId, q);
  if (newsContextStr && window.AIO && typeof window.AIO.buildAIUntrustedBlock === 'function') {
    newsContextStr = window.AIO.buildAIUntrustedBlock(newsContextStr.indexOf('텔레그램') >= 0 ? 'NEWS_TELEGRAM' : 'NEWS', newsContextStr);
  }
  var intentContextStr = _buildChatIntentContext(ctxId, q, {
    tickers: detectedTickers,
    tickerData: !!tickerDataStr,
    trendData: (tickerDataStr || '').indexOf('[주가 추이]') >= 0,
    technicalData: !!technicalDataStr,
    screenerData: !!screenerStr,
    domainData: !!domainDataStr,
    deepData: !!(deepCompareStr || singleDeepStr || sectorCompareStr),
    webSearch: !!webSearchStr,
    news: !!newsContextStr,
    freshness: !!chatFreshPreflight,
    portfolioData: ctxId === 'portfolio'
  });
  var coverageContextStr = (typeof _buildChatAnswerCoverageContext === 'function') ? _buildChatAnswerCoverageContext(ctxId, q, {
    tickers: detectedTickers,
    tickerData: !!tickerDataStr,
    trendData: (tickerDataStr || '').indexOf('[주가 추이]') >= 0,
    technicalData: !!technicalDataStr,
    screenerData: !!screenerStr,
    domainData: !!domainDataStr,
    deepData: !!(deepCompareStr || singleDeepStr || sectorCompareStr),
    webSearch: !!webSearchStr,
    news: !!newsContextStr,
    freshness: !!chatFreshPreflight,
    portfolioData: ctxId === 'portfolio'
  }) : '';
  var integratedContextStr = (typeof _buildAioIntegratedAnswerContext === 'function') ? _buildAioIntegratedAnswerContext(ctxId, q, {
    tickers: detectedTickers,
    tickerData: !!tickerDataStr,
    trendData: (tickerDataStr || '').indexOf('[주가 추이]') >= 0,
    technicalData: !!technicalDataStr,
    screenerData: !!screenerStr,
    domainData: !!domainDataStr,
    deepData: !!(deepCompareStr || singleDeepStr || sectorCompareStr),
    webSearch: !!webSearchStr,
    news: !!newsContextStr,
    freshness: !!chatFreshPreflight,
    portfolioData: ctxId === 'portfolio'
  }) : '';
  var memoryContextStr = _buildChatMemoryContext(ctxId, q);
  var tacticalTraderContextStr = (typeof _aioTacticalTraderFrameworkContext === 'function') ? _aioTacticalTraderFrameworkContext(ctxId, q) : '';

  // v52.78/WP-AI3: let page-scoped research retrieval see the active question.
  window._aioActiveAIQuery = q;
  // v20+: dynamic system prompts (portfolio injects live data)
  var systemPrompt = typeof ctx.system === 'function' ? ctx.system() : ctx.system;
  var chatProvenanceBundle = null;
  var chatProvenanceContextStr = '';
  try {
    chatProvenanceBundle = window.AIO && typeof window.AIO.getDecisionEvidenceBundle === 'function' ? window.AIO.getDecisionEvidenceBundle() : null;
    chatProvenanceContextStr = window.AIO && typeof window.AIO.getDecisionEvidencePromptContext === 'function'
      ? window.AIO.getDecisionEvidencePromptContext(chatProvenanceBundle) : '';
  } catch(_provenanceErr) {}
  if (chatProvenanceContextStr) systemPrompt += chatProvenanceContextStr;
  if (intentContextStr) systemPrompt += intentContextStr;
  if (coverageContextStr) systemPrompt += coverageContextStr;
  if (integratedContextStr) systemPrompt += integratedContextStr;
  if (memoryContextStr) systemPrompt += memoryContextStr;
  if (tacticalTraderContextStr) systemPrompt += tacticalTraderContextStr;
  if (tickerDataStr) systemPrompt += tickerDataStr;
  if (technicalDataStr) systemPrompt += technicalDataStr;  // v50.12: 기술적 실측 데이터 주입
  if (sectorCompareStr) systemPrompt += sectorCompareStr;
  if (screenerStr) systemPrompt += screenerStr;  // v50.37 트랙1: 스크리너 결과
  if (screenerResult && screenerResult.mode === 'diversified-recommendation') {
    systemPrompt += '\n\n【추천 다양성·반복 편향 방지 규칙】\n' +
      '이 질문은 넓은 종목 추천이다. 위 균형 추천 후보군을 1차 데이터로 사용하고, 앞부분의 고정 리서치 문단이나 최근 대화에서 자주 나온 CEG/전력/AVGO/AI 인프라 테마에 과도하게 끌리지 마라.\n' +
      '최종 추천은 섹터·시장·시총을 분산해 3~5개만 제시한다. 같은 테마는 최대 2개. 각 추천에는 "왜 지금", "왜 이 섹터", "대체 후보", "제외/보류 조건"을 붙인다.\n' +
      '사용자가 선호 시장·위험성향·기간을 말하지 않았다면 단일 정답처럼 말하지 말고 균형형 기본안과 공격형/방어형 변형을 함께 제시한다.\n';
  }
  if (domainDataStr) systemPrompt += domainDataStr;  // v50.38 트랙2: 도메인 라이브 데이터
  if (deepCompareStr) systemPrompt += deepCompareStr;
  if (singleDeepStr) systemPrompt += singleDeepStr;
  if (webSearchStr) systemPrompt += webSearchStr;
  if (newsContextStr) systemPrompt += newsContextStr;
  if (chatFreshPreflight && detectedTickers.length > 0) {
    var _cfAfter = chatFreshPreflight.after || {};
    var _cfRows = (_cfAfter.quoteRows || []).map(function(r) {
      return r.ticker + ': ' + (r.hasLivePrice ? 'quote-ok' : 'quote-missing') + (r.quoteAgeSec != null ? ' age=' + r.quoteAgeSec + 's' : '') + (r.source ? ' source=' + r.source : '') + (r.truthStatus ? ' truth=' + r.truthStatus : '') + (r.crossSourceStatus ? ' cross=' + r.crossSourceStatus + '/' + (r.crossSourceCount || 0) : '') + (r.truthIssues && r.truthIssues.length ? ' issues=' + r.truthIssues.slice(0,3).join('|') : '');
    }).join(' / ');
    systemPrompt += '\n\n[AI Chat Freshness + Truth/Cross-Source Preflight v50.0]\n' +
      'status=' + (chatFreshPreflight.status || 'unknown') + ' strict=' + !!chatFreshPreflight.strict + ' tickers=' + detectedTickers.join(',') + '\n' +
      'quotes=' + (_cfRows || 'not available') + '\n' +
      'rule: For these tickers, cite only the quote/company-analysis data blocks injected in this prompt or EvidenceStore verified/current items. If a ticker quote remains missing, stale, truth-blocked, cross-source mismatched, out-of-range, source-mismatched, or EvidenceStore-blocked after preflight, do not invent or use price, market cap, valuation, earnings, or target-price numbers for trading judgment. Say "현재 검증 데이터 없음" for blocked current claims.\n';
  }

  // v48.11: 환각 방지 5중 강화 (chatSend) — chatSendUnified와 완전 일치
  // 1) 오늘 날짜 + Claude 커트오프  2) 추세 해석 필수 규칙  3) [주가 추이] 주입 여부 체크
  // 4) _liveData 분 단위 stale 체크  5) DATA_SNAPSHOT 72h+ 수치 인용 금지

  var _fi = window._aioChatFreshnessInfo ? window._aioChatFreshnessInfo() : {};
  var _todayCS = _fi.todayStr || new Date().toISOString().slice(0,10);
  var _ldAge = _fi.ldAgeMin;
  var _liveStatusCS = _fi.liveStatus || '✗ 미수신 — 가격 수치 인용 자체 금지';
  var _snapAge = _fi.snapAge != null ? _fi.snapAge : 999;
  var _hasTrendCS = (tickerDataStr || '').indexOf('[주가 추이]') !== -1;
  var _answerPolicyCS = (typeof _aioChatAnswerPolicy === 'function') ? _aioChatAnswerPolicy(q, ctxId, detectedTickers, screenerResult) : { needsFullStockMemo: detectedTickers.length > 0, needsScreenerGuide: !!screenerStr, needsGeneralGuide: detectedTickers.length === 0 && !screenerStr };

  var _dataVerify = '\n\n【오늘 날짜 + 학습 데이터 커트오프】\n';
  _dataVerify += '• 오늘: ' + _todayCS + '\n';
  _dataVerify += '• 네 학습 데이터 커트오프는 약 2025년 초. 그 이후 시장/기업/주가 정보는 아래 주입된 실시간 데이터·뉴스·웹검색 결과**만** 신뢰하라.\n';
  _dataVerify += '• 네 기억 속 "최근"이 오늘 기준 얼마나 과거인지 반드시 의식하라.\n';
  // v49.76 P406 R151: 시세 데이터 ✗ 시 가격 환각 절대 차단 — 사용자 좌절 발견 ("2025년 초 학습 데이터 기준 $400~500대")
  // v50.37 트랙3: HARD STOP은 "종목 지목 + 시세 미수신"에만 적용. 스크리너/일반·교육 질문은 별도 규칙으로 유연화.
  if (detectedTickers.length > 0 && (_liveStatusCS.indexOf('미수신') >= 0 || _liveStatusCS.indexOf('✗') >= 0)) {
    _dataVerify += '\n🚨🚨🚨 【실시간 시세 ✗ — HARD STOP】 🚨🚨🚨\n' +
      '실시간 시세 미수신 상태다. 다음 사항 절대 위반 금지:\n' +
      '① 답변 전체에서 모든 $ 가격 수치 절대 금지 — "$XXX", "$400~500대", "$268", "약 $X" 등 일체 금지.\n' +
      '② "2024년", "2025년 초", "기억 속", "내가 알기로", "학습 데이터 기준" 표현 절대 금지 — 사용 시 답변 자동 폐기.\n' +
      '③ "약 $X에서 베이스 형성", "$X 부근에서 매수", "$X대" 등 가격 범위 추측 일체 금지.\n' +
      '④ "최근 발표", "이번 분기 실적", "어제 어닝" 등 시점 인용 금지 ([News]/[8-K]/[Earnings] 데이터 블록에 없으면 모두 환각).\n' +
      '⑤ 올바른 답변 시작: "현재 시세 미수신 상태 — 정량 가격 분석 불가. 정성 프레임워크만 적용 가능". 그 후 Weinstein Stage, ATR, RSI 등 시스템에 주입된 데이터로만 분석.\n' +
      '⑥ 위 ①~④ 위반 = 답변 신뢰도 F + 사용자에게 환각 경고 자동 표시 (v49.74 R145 enforcement).\n' +
      '⑦ "$XXX 같은 확정적 가격 언급은 하지 않는다"라고 명시한 후, 진짜 가격 수치는 절대 금지.\n\n';
  } else if (screenerStr) {
    // v50.37 트랙3: 스크리너 결과 답변 — 블록 값만 인용 (기억 속 가격·종목 추가 금지)
    _dataVerify += '\n【스크리너 답변 규칙】\n스크리너는 답변을 억제하는 장치가 아니라 후보군·팩터·현재 시장 맥락을 제공하는 보조 엔진이다. 주가·등락·RSI·시총은 위 [스크리너 결과] 또는 [균형 추천 후보] 블록의 값만 인용하고 (기준시각)을 붙여라. 후보군 밖 종목은 확정 추천/정량 근거로 섞지 말고, 필요 시 "추가 탐색 조건"으로만 제안하라. 블록에서 가격이 N/A면 "해당 종목 실시간 시세 미수신"이라 밝혀라.\n';
    if (screenerResult && screenerResult.mode === 'diversified-recommendation') {
      _dataVerify += '넓은 추천 질문에서는 특정 한 섹터·한 기업으로 몰아가지 말고 최소 3개 섹터 관점으로 나눠 답하라. CEG/전력/AVGO가 후보군에 있더라도 반복 추천 방지 규칙을 우선 적용하라. [주가 추이] 블록이 없어도 후보군의 3M·RSI·퀀트 랭크는 스크리너 근거로 사용할 수 있다.\n';
    }
    _dataVerify += '\n';
  } else if (detectedTickers.length === 0) {
    // v50.37 트랙3: 일반·교육·비종목 질문 유연성 — 개념·전략·시장 해석은 충실히, 시점성 수치만 주의
    _dataVerify += '\n【일반·교육 질문 유연성 규칙】\n이 질문은 특정 종목을 지목하지 않았다. 개념·투자 전략·시장 해석·용어·교육성 질문에는 너의 일반 지식 + 아래 주입된 현재 시장 맥락(VIX·F&G·지수·매크로)을 활용해 충실하고 구체적으로 답하라(일반 개념 설명을 막지 마라). 다만 (a) 특정 종목의 현재 주가·시총·목표가·실적 수치, (b) 학습 커트오프 이후의 날짜·사건·발표는 주입된 데이터에 없으면 단정하지 말고 "현재 데이터 미확인"이라 밝혀라.\n\n';
  }

  if (_answerPolicyCS.needsFullStockMemo) {
    _dataVerify += '\n【추세 해석 필수 규칙 — 종목 추천·매수·매도 판단 시 적용】\n';
    _dataVerify += '1. 긍정 뉴스가 있어도 [주가 추이] 라벨이 "하락 추세·약세 지속·조정 중"이면 → 호재 이미 반영됐거나 다른 부정 요인. **뉴스만으로 추천 금지**.\n';
    _dataVerify += '2. [주가 추이](5D/20D/3M) 또는 스크리너 3M/RSI/퀀트 랭크를 먼저 확인 후 답변.\n';
    _dataVerify += '3. 애널리스트 목표가는 "발표 시점" 확인 — 오래된 목표가는 "참고용"으로만.\n';
    _dataVerify += '4. "최근 상승세" 표현은 주입된 추이·스크리너 3M·실시간 등락으로 검증 후에만 사용.\n';
    _dataVerify += '5. 시간 불일치 탐지: 긍정 뉴스일 이후 주가 급락이면 "재료 소진/후속 악재" 가능성 언급.\n';
    _dataVerify += '6. 네 기억 속 주가/실적은 오래된 값일 수 있다. 주입된 [주가 추이]/[실시간 시세]/[웹검색]/[스크리너]만 현재값으로 취급.\n';

    _dataVerify += '\n【근거 중심 교육·리서치 답변 구조 — 전망 질문 시】\n';
    _dataVerify += '결론부터 말하고, ① 현재 상황 ② 투자 스토리 ③ 재무·밸류에이션 ④ Bull/Base/Bear 조건 ⑤ 카탈리스트 ⑥ 깨지는 신호 순으로 압축하라. 모든 숫자·시점·출처는 주입 데이터 기준으로 표시한다.\n';
  } else if (_answerPolicyCS.needsTickerFactAnswer) {
    _dataVerify += '\n【질문 맞춤 종목 답변 규칙】\n';
    _dataVerify += '사용자가 단순 사실·용어·요약을 물으면 6단계 리포트나 Bull/Base/Bear를 강제하지 말고, 질문에 바로 답한 뒤 필요한 데이터 출처와 한계만 짧게 붙여라. 매수/매도 판단으로 확장하지 않는다.\n';
  } else if (_answerPolicyCS.needsScreenerGuide) {
    _dataVerify += '\n【스크리너 보조 답변 규칙】\n';
    _dataVerify += '스크리너 후보군의 3M·RSI·퀀트 랭크·섹터/시장 분산을 활용해 직관적으로 설명하라. 개별 티커용 [주가 추이] 블록 부재를 이유로 스크리너 근거 설명을 막지 않는다.\n';
  } else {
    _dataVerify += '\n【답변 형식 유연성 규칙】\n';
    _dataVerify += '질문이 교육/개념/시장 해석이면 짧은 결론 → 핵심 이유 3개 → 현재 시장에 적용하는 방법 순으로 답하라. 종목 매매 리포트 양식, Bull/Base/Bear, 기관 프레임 인용을 자동으로 강제하지 않는다.\n';
  }

  _dataVerify += '\n【데이터 검증 상태 — 질문 범위별 준수】\n';
  _dataVerify += '• 실시간 시세: ' + _liveStatusCS + '\n';
  if (_answerPolicyCS.needsFullStockMemo || _answerPolicyCS.needsTickerFactAnswer) {
    _dataVerify += '• 주가 추이(5D/20D/3M): ' + (_hasTrendCS ? '✓ 주입됨 — 이 추이를 기준으로 추세 판단 가능' : '✗ 미주입 — 개별 종목의 현재 추세/진입가 판단은 보류') + '\n';
    _dataVerify += '• 기업 재무(FMP): ' + (tickerDataStr ? '✓ 수집 완료' : '✗ 미수집 — PER/ROE/마진 등 재무 수치를 추측하지 마라. "재무 데이터 미수집"이라고 밝혀라') + '\n';
  } else if (_answerPolicyCS.needsScreenerGuide) {
    _dataVerify += '• 스크리너 후보군: ✓ 주입됨 — 후보군의 3M·RSI·퀀트 랭크·섹터 분산은 설명 근거로 사용 가능\n';
  }
  _dataVerify += '• 뉴스 컨텍스트: ' + (newsContextStr ? '✓ ' + newsContextStr.split('\n').filter(function(l){return l.match(/^\d/);}).length + '건 주입됨 (시간 표기 포함)' : '✗ 관련 뉴스 없음 — "최근 뉴스에 따르면"이라고 시작하지 마라') + '\n';
  _dataVerify += '• 웹검색: ' + (webSearchStr ? '✓ 검색 완료' : '✗ 미실행 — 검증되지 않은 최신 정보를 확정적으로 말하지 마라') + '\n';
  if (_snapAge >= 72) _dataVerify += '• 정적 데이터: ⚠⚠ ' + _snapAge + '시간(' + Math.round(_snapAge/24) + '일) 경과 — **정적 수치 인용 자체 금지**. 실시간/웹검색만 사용\n';
  else if (_snapAge < 48) _dataVerify += '• 정적 데이터: ✓ ' + _snapAge + '시간 전 갱신\n';
  else _dataVerify += '• 정적 데이터: ⚠ ' + _snapAge + '시간 경과 — 수치 인용 시 "N시간 전 스냅샷" 명시\n';
  _dataVerify += '규칙: ✗ 또는 ⚠ 표시된 데이터는 "확인되지 않음"·"데이터 미수집"이라고 명시적으로 밝혀야 한다. 추측 금지.\n';
  systemPrompt += _dataVerify;
  systemPrompt = _aioNormalizeChatFreshnessLanguage(systemPrompt);

  // v49.74 P395 R144: messages 멀티턴 윈도잉 + 요약 — char-trim (v46.6) + turn-cap (24) + 요약 prepend
  // 사용자 정직 지적 — "멀티턴 대화 토큰 누적 정책 부재" 시정
  window._chatMultiTurnStats = window._chatMultiTurnStats || { trimEvents: 0, summaryInsertions: 0, maxTurnsBeforeTrim: 0 };
  var _msgTotalChars = state.messages.reduce(function(sum, m) { return sum + (m.content || '').length; }, 0);
  var _MAX_TURNS = 24;       // turn cap (user + assistant 한 쌍 = 2)
  var _CHAR_LIMIT = 60000;   // ~15K 토큰
  var _CHAR_TARGET = 40000;  // trim 후 목표
  var _SUMMARY_TRIGGER = 8;  // 요약 본문 삽입 시작 시점 (제거 메시지 8개+)
  if (_msgTotalChars > _CHAR_LIMIT || state.messages.length > _MAX_TURNS) {
    var _removedMsgs = [];
    var _trimCount = 0;
    while (state.messages.length > 2 && (_msgTotalChars > _CHAR_TARGET || state.messages.length > _MAX_TURNS - 2)) {
      var removed = state.messages.shift();
      _removedMsgs.push(removed);
      _msgTotalChars -= (removed.content || '').length;
      _trimCount++;
    }
    if (_trimCount > 0) {
      window._chatMultiTurnStats.trimEvents++;
      window._chatMultiTurnStats.maxTurnsBeforeTrim = Math.max(window._chatMultiTurnStats.maxTurnsBeforeTrim, _trimCount + state.messages.length);
      // _SUMMARY_TRIGGER 이상 제거 시 요약 메시지 prepend — 환각 누적 차단 + 이전 컨텍스트 핵심 보존
      if (_trimCount >= _SUMMARY_TRIGGER) {
        var _userTurns = _removedMsgs.filter(function(m){ return m.role === 'user'; }).map(function(m){ return (m.content||'').slice(0, 80); }).slice(0, 5);
        var _summaryMsg = '[이전 대화 요약 — ' + _trimCount + '개 메시지 정리] 사용자 주요 질문: ' + (_userTurns.length ? _userTurns.map(function(q,i){ return (i+1)+') ' + q; }).join(' / ') : '(질문 미상)') + '. 이 컨텍스트는 참고만 — 현재 답변은 새 [시스템 데이터]만 인용.';
        state.messages.unshift({ role: 'user', content: _summaryMsg });
        state.messages.unshift({ role: 'assistant', content: '이전 대화 요약 확인. 새 질문 정량/출처 데이터 우선.' });
        window._chatMultiTurnStats.summaryInsertions++;
      }
      console.log('[AIO v49.74 P395 R144] messages trim: ' + _trimCount + '개 제거 (남은 ' + state.messages.length + '개, ' + Math.round(_msgTotalChars/1000) + 'K자) · 요약삽입:' + (_trimCount >= _SUMMARY_TRIGGER));
      if (typeof showToast === 'function') showToast('이전 대화 길이 정리 — 최근 ' + state.messages.length + '턴 + 요약 유지');
    }
  }

  state.messages.push({ role: 'user', content: q });
  chatAppendMsg(ctxId, 'user', renderMarkdownLight(q));

  // v31.3: 사용 모델 표시
  var modelLabel = selectedModelCfg.label;
  var modelColor = selectedModelKey === 'sonnet-thinking' ? '#a855f7' : selectedModelKey === 'sonnet' ? '#00d4ff' : 'var(--text-muted)';
  var modelBadge = '<div style="font-size:11px;color:' + modelColor + ';font-family:var(--font-mono);text-align:right;margin:-4px 0 4px;opacity:0.7;">' + modelLabel + (selectedModelCfg.thinking ? ' (추론 중…)' : '') + '</div>';

  // v36.2: 웹검색 수행 시 검색 알림 배지
  if (webSearchResult) {
    var _engBadge = webSearchResult.engine === 'perplexity' ? 'Perplexity' : 'Google';
    chatAppendMsg(ctxId, 'ai', '<div style="font-size:11px;color:#a78bfa;padding:4px 8px;background:rgba(168,85,247,0.08);border-radius:4px;margin-bottom:4px;">' + _engBadge + ' 검색 완료 — 최신 정보 ' + (webSearchResult.citations ? webSearchResult.citations.length : 0) + '건 수집</div>');
  }

  // remove stale loading if any, add fresh one
  var staleLoad = document.getElementById('chat-' + ctxId + '-loading');
  if (staleLoad) { var sw = staleLoad.closest('.acp-msg') || staleLoad.parentNode; sw.parentNode.removeChild(sw); }
  chatShowLoading(ctxId);

  var aiBubble = null;

  // v49.57 P318: Claude web_search 조건부 활성화 휴리스틱 평가
  var _useClaudeWebSearch = false;
  try {
    _useClaudeWebSearch = typeof _shouldUseClaudeWebSearch === 'function' && _shouldUseClaudeWebSearch(q, ctxId, detectedTickers);
  } catch(_wsErr) { _useClaudeWebSearch = false; }
  if (_useClaudeWebSearch) {
    chatAppendMsg(ctxId, 'ai', '<div style="font-size:11px;color:#a78bfa;padding:4px 8px;background:rgba(168,85,247,0.08);border-radius:4px;margin-bottom:4px;">🔍 Claude 네이티브 웹 검색 활성화 — 최신 정보 보강 중 (max 3회)</div>');
    // v50.10 B: 정성 분석 web-research 지시 — placeholder/정적/휴리스틱 데이터 대신 검색으로 최신 사실+출처 확보
    systemPrompt += '\n\n【웹 리서치 지시 (정성 관점)】\n공급망/밸류체인·TAM/시장규모·경쟁구조·기술해자(Moat)·기관흐름(13F)·사업구조/비즈니스모델·경영진/CEO 전략 같은 정성 분석은 주입된 placeholder/정적테이블/휴리스틱 데이터에 의존하지 말고 web_search로 최신 사실을 확인하라. 각 핵심 주장에는 (출처·발행일)을 명시하고, 검색으로 확인하지 못한 항목은 "확인 불가"로 남겨라 — 학습데이터 기반 추측 금지.';
  } else if (window._aioWebSearchCapped) {
    // v50.10 E: 정성 질문이었으나 공유 키 일일 웹검색 한도 도달 → 기존 데이터로 답변 안내
    chatAppendMsg(ctxId, 'ai', '<div style="font-size:11px;color:var(--data-amber);padding:4px 8px;background:rgba(255,163,26,0.08);border-radius:4px;margin-bottom:4px;">🔍 오늘 웹검색 일일 한도 도달 — 정성 분석은 기존 데이터로 답변(저신뢰 관점 단정 주의). 내일 자동 재개.</div>');
  }

  // v52.75/WP-AI0: keep the public safety policy last after optional web-search instructions.
  if (typeof _aioPublicAIActionPolicyPrompt === 'function') systemPrompt += _aioPublicAIActionPolicyPrompt();

  // v52.78/WP-AI3: record the full prompt size while the reference block is
  // already bounded by the shared retriever. This provides a P95 input-token
  // sample without trimming live evidence or policy blocks.
  var _pageRetrievalAudit = (window.AIO && typeof window.AIO.getAIRetrievalAudit === 'function')
    ? window.AIO.getAIRetrievalAudit() : null;
  var _pageContextBudgetAudit = (window.AIO && typeof window.AIO.recordAIContextBudget === 'function')
    ? window.AIO.recordAIContextBudget(systemPrompt, {
      entrypoint: 'per-page-chat', ctxId: ctxId,
      intent: _pageRetrievalAudit && _pageRetrievalAudit.intent
    }) : null;

  // v52.76/WP-AI1: one request object survives initial call and retries.
  var _pageAIRequest = typeof _aioCreateAIRequestObject === 'function'
    ? _aioCreateAIRequestObject('per-page-chat', { ctxId: ctxId, query: q, model: selectedModelKey })
    : null;
  if (typeof _aioBeginAIRequestAttempt === 'function') _aioBeginAIRequestAttempt(_pageAIRequest, selectedModelKey);

  // onChunk — live update. The shared response pipeline owns chip stripping
  // and the public action gate for the initial request and every retry.
  var _pageOnChunk = function(fullText) {
      var loadEl = document.getElementById('chat-' + ctxId + '-loading');
      if (loadEl) { var loadWrap = loadEl.closest('.acp-msg') || loadEl.parentNode; if (loadWrap && loadWrap.parentNode) loadWrap.parentNode.removeChild(loadWrap); }

      if (!aiBubble) {
        aiBubble = chatAppendMsg(ctxId, 'ai', '', 'chat-' + ctxId + '-streaming');
      }
      var _pageChunkResult = (typeof _aioRunAIResponsePipeline === 'function')
         ? _aioRunAIResponsePipeline(fullText, { request: _pageAIRequest, entrypoint: 'per-page-chat', ctxId: ctxId, query: q, tickers: detectedTickers, freshness: chatFreshPreflight, evidence: (chatFreshPreflight && chatFreshPreflight.after && chatFreshPreflight.after.quoteRows) || [], retrievalAudit: _pageRetrievalAudit, contextBudgetAudit: _pageContextBudgetAudit, streamPhase: 'partial', record: false })
        : { blocked: true, text: 'AI 베타 안전 모드\n\n공통 안전 검증을 사용할 수 없어 답변을 표시하지 않습니다.', actionGate: { blocked: true } };
      var visible = _pageChunkResult.text;
      // v49.78 C2/C3 P417: aiBubble null 시 사용자에게 즉시 안내 (silent fail 차단) + _aioSafeMD fallback
      if (aiBubble) {
        var _safeRender = (typeof _aioSafeMD === 'function') ? _aioSafeMD(visible) :
                          (typeof escHtml === 'function') ? escHtml(visible).replace(/\n/g, '<br>') :
                          String(visible).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }).replace(/\n/g, '<br>');
        aiBubble.innerHTML = _safeRender + '<span class="chat-cursor">▌</span>';
      } else {
        // chatAppendMsg null 반환 — DOM 부재 silent fail 차단 (사용자 좌절 시정)
        if (typeof console !== 'undefined' && console.warn) console.warn('[AIO chatSend] aiBubble null — chat-' + ctxId + '-msgs DOM 부재. CHAT_CONTEXTS 등록 후 패널 누락 (P398/R146 일반화).');
        if (typeof showToast === 'function') showToast('⚠ 채팅 응답 렌더 영역 부재: chat-' + ctxId + '-msgs — 페이지 새로고침 권장', 6000);
      }
      // v34.1c: 긴 답변 시 자동 확장 (200자 이상이면 자동으로 채팅 영역 확장 — 일반 LLM 채팅처럼)
      if (fullText.length > 200) {
        var chatEl = document.getElementById('chat-' + ctxId);
        if (chatEl && !chatEl.classList.contains('chat-expanded')) {
          chatEl.classList.add('chat-expanded');
          var btn = chatEl.querySelector('.acp-expand-btn');
          if (btn) btn.textContent = '↙ 축소';
        }
      }
      var container = document.getElementById('chat-' + ctxId + '-msgs');
      if (container) container.scrollTop = container.scrollHeight;
    };

  // onDone — finalise. This is the same completion contract used by retry.
  var _pageOnDone = function(fullText) {
      state.streaming = false;
      state._chatSendEntered = 0;  // v49.78 C4 P419: atomic lock release
      if (btn) { btn.disabled = false; btn.textContent = '전송 ▶'; }

      var loadEl = document.getElementById('chat-' + ctxId + '-loading');
      if (loadEl) { var loadWrap = loadEl.closest('.acp-msg') || loadEl.parentNode; if (loadWrap && loadWrap.parentNode) loadWrap.parentNode.removeChild(loadWrap); }

      var streamEl = document.getElementById('chat-' + ctxId + '-streaming');
      var _pageDoneResult = (typeof _aioRunAIResponsePipeline === 'function')
         ? _aioRunAIResponsePipeline(fullText, { request: _pageAIRequest, entrypoint: 'per-page-chat', ctxId: ctxId, query: q, tickers: detectedTickers, freshness: chatFreshPreflight, evidence: (chatFreshPreflight && chatFreshPreflight.after && chatFreshPreflight.after.quoteRows) || [], retrievalAudit: _pageRetrievalAudit, contextBudgetAudit: _pageContextBudgetAudit, streamPhase: 'complete' })
        : { blocked: true, text: 'AI 베타 안전 모드\n\n공통 안전 검증을 사용할 수 없어 답변을 표시하지 않습니다.', actionGate: { blocked: true } };
      var visible = _pageDoneResult.text;
      var _publicGate = _pageDoneResult.actionGate;
      if (streamEl) {
        streamEl.id = '';
        streamEl.innerHTML = _aioSafeMD(visible);  // v48.94 P158: DOMPurify 2차
      } else if (!aiBubble) {
        aiBubble = chatAppendMsg(ctxId, 'ai', _aioSafeMD(visible));  // v48.94 P158
      }

      // v31.3: 응답 완료 후 사용 모델 배지 삽입
      if (aiBubble && aiBubble.parentNode) {
        var badgeEl = document.createElement('div');
        badgeEl.style.cssText = 'font-size:11px;color:' + modelColor + ';font-family:var(--font-mono);text-align:right;margin:2px 0 0;opacity:0.6;';
        badgeEl.textContent = modelLabel;
        aiBubble.parentNode.appendChild(badgeEl);
        if (typeof _aioAppendAIPublicDisclosure === 'function') {
          _aioAppendAIPublicDisclosure(aiBubble.parentNode, { ctxId: ctxId, tickers: detectedTickers, freshness: chatFreshPreflight, actionGate: _publicGate });
        }

        // v49.77 P413 R155: 데이터 ✗ 시 답변 위 액션 버튼 배너 자동 삽입
        try {
          var _liveMissing = _liveStatusCS && (_liveStatusCS.indexOf('미수신') >= 0 || _liveStatusCS.indexOf('✗') >= 0);
          var _financialMissing = !tickerDataStr;
          if ((_liveMissing || _financialMissing) && aiBubble && aiBubble.parentNode) {
            var _safeQ2 = escHtml(q).replace(/'/g, '&#39;');
            var _dataMissBox = document.createElement('div');
            _dataMissBox.className = 'aio-data-missing-banner';
            _dataMissBox.style.cssText = 'margin:6px 0;padding:8px 10px;background:rgba(255,163,26,0.10);border:1px solid var(--data-amber);border-radius:3px;color:var(--text-primary);font-size:12px;line-height:1.5;';
            var _missList = [];
            if (_liveMissing) _missList.push('실시간 시세');
            if (_financialMissing && detectedTickers && detectedTickers.length > 0) _missList.push('재무 데이터');
            _dataMissBox.innerHTML = '<div style="font-weight:700;color:var(--data-amber);margin-bottom:4px;">⚠ 데이터 부재 — ' + _missList.map(escHtml).join(' / ') + ' 미수신</div>' +
              '<div style="color:var(--text-muted);font-size:11px;margin-bottom:6px;">위 답변은 정성 프레임워크만 적용 — 정량 수치 인용 시 환각 위험. 데이터 새로고침 후 재질문 권장.</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '<button data-action="_aioRefreshAllData" style="font-size:11px;padding:4px 10px;background:rgba(61,219,165,0.15);border:1px solid var(--data-green);color:var(--data-green);border-radius:4px;cursor:pointer;font-weight:600;">🔄 데이터 새로고침</button>' +
              '<button data-action="chatFromChip" data-arg="' + escHtml(ctxId) + '" data-arg2="' + _safeQ2 + '" style="font-size:11px;padding:4px 10px;background:rgba(0,212,255,0.15);border:1px solid var(--data-cyan);color:var(--data-cyan);border-radius:4px;cursor:pointer;font-weight:600;">🔁 동일 질문 재시도</button>' +
              '</div>';
            aiBubble.parentNode.insertBefore(_dataMissBox, aiBubble);
          }
        } catch(_dmErr) {}
        // v46.6: 데이터 신뢰도 배지
        var _srcBadge = document.createElement('div');
        _srcBadge.style.cssText = 'font-size:11px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap;margin:4px 0;padding:3px 6px;background:var(--surface-1);border-radius:4px;';
        var _bItems = [];
        if (tickerDataStr) _bItems.push('<span style="color:#3ddba5;">📊 재무 ✓</span>');
        else _bItems.push('<span style="color:#7e8a9e;">📊 재무 ✗</span>');
        if (newsContextStr) _bItems.push('<span style="color:#3ddba5;">📰 뉴스 ✓</span>');
        else _bItems.push('<span style="color:#7e8a9e;">📰 뉴스 ✗</span>');
        if (webSearchStr) _bItems.push('<span style="color:#a78bfa;">🔍 웹검색 ✓</span>');
        if (singleDeepStr || deepCompareStr) _bItems.push('<span style="color:#60a5fa;">🔬 심층 ✓</span>');
        if (screenerResult && screenerResult.matched) _bItems.push('<span style="color:#fbbf24;" title="' + escHtml(screenerResult.criteria.join(' · ')) + '">📋 스크리너 ' + screenerResult.totalMatched + '종목</span>');  // v50.37 트랙1
        if (domainDataStr) _bItems.push('<span style="color:#7dd3fc;">🌐 도메인 데이터 ✓</span>');  // v50.38 트랙2
        _srcBadge.innerHTML = _bItems.join('');
        aiBubble.parentNode.appendChild(_srcBadge);

        // v50.10: Claude native web_search 출처 푸터 (인용 URL 표면화 — 검증성)
        var _claudeCites = (window._aioLastClaudeCitations || []);
        var _webCited = !!(_useClaudeWebSearch && _claudeCites.length > 0);
        if (_webCited) {
          try {
            var _citeWrap = document.createElement('div');
            _citeWrap.innerHTML = _searchCitationsHTML({ citations: _claudeCites.map(function(c){ return c.url; }), engine: 'claude' });
            if (_citeWrap.firstChild) aiBubble.parentNode.appendChild(_citeWrap.firstChild);
          } catch(_cfErr) {}
        }

        // v49.33 R83/R86 자동 검증 통합 — 응답 정확성 + 환각 패턴
        try {
          var _accBadge = document.createElement('div');
          _accBadge.className = 'aio-chat-accuracy-badge';
          _accBadge.style.cssText = 'font-size:10px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap;margin:3px 0;padding:3px 6px;background:var(--surface-1);border-radius:4px;';
          var _accItems = [];
          // 1. 응답 정확성 (detectedTickers 사용)
          if (typeof window.AIO !== 'undefined' && window.AIO.assertChatResponseAccuracy && Array.isArray(detectedTickers) && detectedTickers.length > 0) {
            var _acc = window.AIO.assertChatResponseAccuracy(visible, detectedTickers);
            if (_acc.priceCitations && _acc.priceCitations.length > 0) {
              if (_acc.accurate) {
                _accItems.push('<span style="color:#3ddba5;" title="모든 인용 가격이 실시간 ±20% 이내">✓ 가격 정확성</span>');
              } else {
                _accItems.push('<span style="color:#ff5b50;" title="severity=' + _acc.severity + ', max deviation ' + (_acc.deviation ? _acc.deviation.toFixed(1) : '?') + '%">⚠ 가격 괴리 ' + _acc.severity + '</span>');
                if (typeof console !== 'undefined' && console.warn) {
                  console.warn('[AIO/R83] Chat response price inaccuracy:', _acc);
                }
              }
            }
          }
          // 2. 환각 패턴
          if (typeof window.AIO !== 'undefined' && window.AIO.getChatHallucinationAudit) {
            var _hall = window.AIO.getChatHallucinationAudit(visible);
            if (_hall.suspicionScore > 0) {
              var _hColor = _hall.verdict === 'high-risk' ? '#ff5b50' : _hall.verdict === 'medium-risk' ? '#ffa31a' : '#7e8a9e';
              _accItems.push('<span style="color:' + _hColor + ';" title="패턴: ' + _hall.patterns.join(', ') + '">🧠 환각 ' + _hall.suspicionScore + '/10</span>');
              if (_hall.suspicionScore >= 7 && typeof console !== 'undefined' && console.warn) {
                console.warn('[AIO/R86] High hallucination risk:', _hall);
              }
              // v49.74 P397 R145 + v49.77 P412 R155: 학습 데이터 자기 인용 (self-confess) 패턴 검출 시 강제 빨간 경고 박스 + 액션 버튼
              if (_hall.requiresWarningBox && aiBubble && aiBubble.parentNode) {
                var _safeQ = escHtml(q).replace(/'/g, '\\\'');
                var _hallBox = document.createElement('div');
                _hallBox.className = 'aio-hallucination-warning';
                _hallBox.style.cssText = 'margin:6px 0;padding:10px 12px;background:rgba(255,91,80,0.12);border:1px solid #ff5b50;border-radius:3px;color:#ff5b50;font-size:12px;line-height:1.5;';
                _hallBox.innerHTML = '<div style="font-weight:700;margin-bottom:4px;">⚠️ 환각 경고 (v49.74 R145)</div>' +
                  '<div style="color:#f87171;font-weight:500;margin-bottom:4px;">AI 답변에 "학습 데이터" / "기억 속" / "2025년 초" 등 자기 환각 자백 표현이 감지됐습니다. 이 답변의 가격·시점 정량 정보는 신뢰하지 마세요.</div>' +
                  '<div style="color:var(--text-muted);font-weight:500;font-size:11px;">검출 패턴: ' + _hall.patterns.join(' · ') + '</div>' +
                  '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
                  '<button data-action="_aioRefreshAllData" style="font-size:11px;padding:4px 10px;background:rgba(61,219,165,0.15);border:1px solid var(--data-green);color:var(--data-green);border-radius:4px;cursor:pointer;font-weight:600;">🔄 시세 새로고침</button>' +
                  '<button data-action="chatFromChip" data-arg="' + escHtml(ctxId) + '" data-arg2="' + _safeQ + '" style="font-size:11px;padding:4px 10px;background:rgba(0,212,255,0.15);border:1px solid var(--data-cyan);color:var(--data-cyan);border-radius:4px;cursor:pointer;font-weight:600;">🔁 데이터 받고 재질문</button>' +
                  '</div>';
                aiBubble.parentNode.insertBefore(_hallBox, aiBubble);
              }
            } else {
              _accItems.push('<span style="color:#3ddba5;" title="환각 패턴 0">🧠 클린</span>');
            }
          }
          if (_accItems.length > 0) {
            _accBadge.innerHTML = '<span style="color:var(--text-muted);font-weight:600;">v49.33 검증:</span> ' + _accItems.join('');
            aiBubble.parentNode.appendChild(_accBadge);
          }
          // v50.9 R116/R117: 종목 답변 시 고위험(저신뢰) 관점 통합 고지 배지 — highRiskFields 레지스트리 재사용
          // v50.10: web_search 발화 시 "저신뢰" → "웹검색 출처 기반"으로 업그레이드 (3단계 신뢰도)
          try {
            if (Array.isArray(detectedTickers) && detectedTickers.length > 0 &&
                typeof window._aioLowConfPerspectives === 'function') {
              var _lcBadgeData = window._aioLowConfPerspectives();
              if (_lcBadgeData && _lcBadgeData.badge) {
                var _confBadge = document.createElement('div');
                _confBadge.className = 'aio-chat-confidence-badge';
                var _confHtml, _confCss, _confTitle;
                if (_webCited) {
                  // 웹검색 실제 발화 + 인용 ≥1 → 출처 기반 (cyan)
                  _confHtml = '🔍 고급 분석(' + _lcBadgeData.labels.slice(0, 4).join('·') + ' 등)을 <b>웹검색 출처 기반</b>으로 보강 — 출처 확인 권장';
                  _confCss = 'font-size:10px;color:var(--text-muted);margin:3px 0;padding:4px 6px;background:rgba(0,212,255,0.07);border-left:2px solid var(--data-cyan);border-radius:4px;line-height:1.5;';
                  _confTitle = '웹검색 출처 ' + _claudeCites.length + '건 · 보강 관점: ' + _lcBadgeData.labels.join(' · ');
                } else if (_useClaudeWebSearch) {
                  // 웹검색 시도했으나 인용 미확정 → 중간 상태 (amber)
                  _confHtml = '🔍 고급 분석 웹검색 시도 — <b>출처 미확정</b>, 단정 금지 (수동 확인 권장)';
                  _confCss = 'font-size:10px;color:var(--text-muted);margin:3px 0;padding:4px 6px;background:rgba(255,163,26,0.06);border-left:2px solid var(--data-amber);border-radius:4px;line-height:1.5;';
                  _confTitle = '저신뢰 관점 전체: ' + _lcBadgeData.labels.join(' · ');
                } else {
                  // 웹검색 미발화 → 기존 v50.9 저신뢰 배지 (amber)
                  _confHtml = _lcBadgeData.badge;
                  _confCss = 'font-size:10px;color:var(--text-muted);margin:3px 0;padding:4px 6px;background:rgba(255,163,26,0.06);border-left:2px solid var(--data-amber);border-radius:4px;line-height:1.5;';
                  _confTitle = '저신뢰 관점 전체: ' + _lcBadgeData.labels.join(' · ');
                }
                _confBadge.style.cssText = _confCss;
                _confBadge.innerHTML = _confHtml;
                _confBadge.title = _confTitle;
                aiBubble.parentNode.appendChild(_confBadge);
              }
            }
          } catch (_cbErr) {}
          // v49.75 P400 R148: R140~R142 답변 후처리 검증 (Pattern B 일반화)
          // — 시스템 프롬프트에만 정의된 ABSOLUTE RULES가 실제 답변에 적용되는지 자동 감지
          try {
            if (typeof window.AIO !== 'undefined' && window.AIO.assertChatAnswerStructureAudit) {
              var _struct = window.AIO.assertChatAnswerStructureAudit(visible);
              if (_struct && _struct.violations && _struct.violations.length > 0) {
                var _sBadge = document.createElement('div');
                _sBadge.className = 'aio-chat-structure-badge';
                _sBadge.style.cssText = 'font-size:10px;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap;margin:3px 0;padding:4px 6px;background:rgba(255,163,26,0.06);border-left:2px solid var(--data-amber);border-radius:4px;';
                var _sItems = _struct.violations.map(function(v) {
                  var _vc = v.severity === 'critical' ? '#ff5b50' : v.severity === 'high' ? '#ffa31a' : '#7e8a9e';
                  return '<span style="color:' + _vc + ';" title="' + escHtml(v.issue) + '">⚠ ' + v.rule + '</span>';
                });
                _sBadge.innerHTML = '<span style="color:var(--text-muted);font-weight:600;">v49.75 구조:</span> ' + _sItems.join(' · ') +
                  (_struct.passes && _struct.passes.length > 0 ? ' <span style="color:var(--data-green);">✓ ' + _struct.passes.length + '</span>' : '');
                aiBubble.parentNode.appendChild(_sBadge);
              }
            }
          } catch(_structErr) {}
        } catch(_validateErr) { /* validation 실패해도 응답 렌더는 차단 X */ }

        // v46.6: 피드백 버튼
        var _fbDiv = document.createElement('div');
        _fbDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin:2px 0;';
        var _fbId = 'fb-' + Date.now();
        _fbDiv.innerHTML = '<button data-action="_aioAiFeedback" data-arg="' + escHtml(_fbId) + '" data-arg2="1" data-pass-el="1" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 4px;" title="도움됨" aria-label="AI 응답이 도움됨으로 평가">👍</button>' +
          '<button data-action="_aioAiFeedback" data-arg="' + escHtml(_fbId) + '" data-arg2="-1" data-pass-el="1" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);padding:2px 4px;" title="부정확" aria-label="AI 응답이 부정확함으로 평가">👎</button>';
        aiBubble.parentNode.appendChild(_fbDiv);

        // v49.70 P374 R134: 금액/SPX % 시나리오 시뮬레이션 ("1억 투자" / "SPX -5% 시")
        try {
          var _amtSim = (typeof _aioSimulateAmountOrPct === 'function') ? _aioSimulateAmountOrPct(q, detectedTickers) : null;
          if (_amtSim) {
            var _asDiv = document.createElement('div');
            _asDiv.style.cssText = 'margin:8px 0;padding:8px 10px;background:rgba(168,85,247,0.06);border-left:3px solid #a855f7;border-radius:4px;font-size:11px;color:var(--text-primary);';
            var _asHTML = '';
            if (_amtSim.amount) {
              _asHTML += '<div style="font-weight:700;color:#a855f7;margin-bottom:6px;">💰 금액 시뮬레이션</div>';
              _asHTML += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">' + escHtml(_amtSim.amount.note) + '</div>';
              _asHTML += '<div style="display:grid;gap:3px;font-size:10px;">';
              _asHTML += '<div><strong>🟢 보수적</strong>: ' + escHtml(_amtSim.amount.allocation.conservative) + '</div>';
              _asHTML += '<div><strong>🟡 균형</strong>: ' + escHtml(_amtSim.amount.allocation.balanced) + '</div>';
              _asHTML += '<div><strong>🔴 공격적</strong>: ' + escHtml(_amtSim.amount.allocation.aggressive) + '</div>';
              _asHTML += '</div>';
            }
            if (_amtSim.indexScenario) {
              _asHTML += '<div style="font-weight:700;color:#a855f7;margin-top:6px;margin-bottom:6px;">📊 ' + escHtml(_amtSim.indexScenario.index) + ' ' + _amtSim.indexScenario.sign + _amtSim.indexScenario.pct + '% 시나리오 (' + _amtSim.indexScenario.direction + ')</div>';
              _asHTML += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:3px;font-size:10px;">';
              Object.keys(_amtSim.indexScenario.impacts).forEach(function(k) {
                _asHTML += '<div style="font-weight:600;">' + escHtml(k) + '</div><div>' + escHtml(_amtSim.indexScenario.impacts[k]) + '</div>';
              });
              _asHTML += '</div>';
            }
            _asDiv.innerHTML = _asHTML;
            aiBubble.parentNode.appendChild(_asDiv);
          }
        } catch(_asErr) {}

        // v49.70 P373 R134: 답변 데이터 다운로드 버튼 (CSV/JSON/MD)
        try {
          var _dlDiv = document.createElement('div');
          _dlDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin:4px 0;font-size:10px;';
          var _dlId = 'dl-' + Date.now();
          window['_aioDlCtx_' + _dlId] = { ctxId: ctxId, fullText: fullText, tickers: detectedTickers };
          _dlDiv.innerHTML = '<span style="color:var(--text-muted);">💾 다운로드:</span>' +
            '<button data-action="_aioExportFromBtn" data-arg="' + _dlId + '" data-arg2="markdown" style="cursor:pointer;background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px;color:var(--text-primary);" title="Markdown 다운로드">MD</button>' +
            '<button data-action="_aioExportFromBtn" data-arg="' + _dlId + '" data-arg2="json" style="cursor:pointer;background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px;color:var(--text-primary);" title="JSON 다운로드">JSON</button>' +
            '<button data-action="_aioExportFromBtn" data-arg="' + _dlId + '" data-arg2="csv" style="cursor:pointer;background:var(--surface-1);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px;color:var(--text-primary);" title="CSV 다운로드">CSV</button>';
          aiBubble.parentNode.appendChild(_dlDiv);
        } catch(_dlErr) {}

        // v49.70 P372 R133: 알람 의도 감지 + localStorage 영속 + 사용자 확인 chip
        try {
          var _alertIntent = (typeof _aioParseAlertIntent === 'function') ? _aioParseAlertIntent(q) : null;
          if (_alertIntent) {
            var _newAlert = _aioAddAlert(_alertIntent);
            if (_newAlert) {
              // 브라우저 Notification 권한 요청 (없을 때)
              if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                try { Notification.requestPermission(); } catch(_) {}
              }
              var _alDiv = document.createElement('div');
              _alDiv.style.cssText = 'margin:8px 0;padding:8px 10px;background:rgba(0,212,255,0.06);border-left:3px solid var(--data-cyan);border-radius:4px;font-size:11px;color:var(--text-primary);';
              _alDiv.innerHTML = '🔔 <strong>알람 등록 완료</strong>: ' + escHtml(_newAlert.label) + ' · 1분마다 자동 점검합니다.<br><span style="font-size:10px;color:var(--text-muted);">브라우저 알림 권한을 허용하면 조건 충족 시 알림을 받을 수 있습니다.</span>';
              aiBubble.parentNode.appendChild(_alDiv);
            }
          }
        } catch(_alErr) {}

        // v49.69 P368 R131: 거시 시나리오 동적 시뮬레이션 — "Fed 50bp 인하 시" / "VIX 30 도달" 등
        try {
          var _macro = (typeof _simulateMacroScenario === 'function') ? _simulateMacroScenario(q) : null;
          if (_macro && _macro.scenario && _macro.impacts) {
            var _mcDiv = document.createElement('div');
            _mcDiv.style.cssText = 'margin:8px 0;padding:8px 10px;background:rgba(255,163,26,0.06);border-left:3px solid var(--data-amber);border-radius:4px;font-size:11px;color:var(--text-primary);';
            var _mcHTML = '<div style="font-weight:700;color:var(--data-amber);margin-bottom:6px;">🌍 매크로 시나리오 시뮬레이션 (' + escHtml(_macro.scenario.type) + ' · 크기: ' + _macro.scenario.magnitude + ')</div>';
            _mcHTML += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">프레임: ' + escHtml(_macro.scenario.framework) + '</div>';
            _mcHTML += '<div style="display:grid;grid-template-columns:1fr 1.5fr 1.5fr;gap:4px;font-size:10px;">';
            _mcHTML += '<div style="color:var(--text-muted);font-weight:600;">자산</div><div style="color:var(--text-muted);font-weight:600;">예상 방향</div><div style="color:var(--text-muted);font-weight:600;">판정</div>';
            Object.keys(_macro.impacts).forEach(function(k) {
              var imp = _macro.impacts[k];
              _mcHTML += '<div style="font-weight:600;">' + escHtml(k) + '</div><div style="font-family:var(--font-mono);">' + escHtml(imp.direction) + '</div><div>' + escHtml(imp.verdict) + '</div>';
            });
            _mcHTML += '</div>';
            _mcHTML += '<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">⚠ ' + escHtml(_macro.note) + '</div>';
            _mcDiv.innerHTML = _mcHTML;
            aiBubble.parentNode.appendChild(_mcDiv);
          }
        } catch(_macroErr) {}

        // v49.69 P366 R130: 자동 페이지 이동 — 사용자 입력 의도 → 적합 페이지 자동 전환 + 안내 메시지
        try {
          var _navIntent = (typeof _autoNavigatePage === 'function') ? _autoNavigatePage(q, ctxId) : null;
          if (_navIntent && _navIntent.page) {
            var _navDiv = document.createElement('div');
            _navDiv.style.cssText = 'margin:6px 0;padding:6px 8px;background:rgba(168,85,247,0.08);border-left:3px solid #a855f7;border-radius:4px;cursor:pointer;font-size:11px;color:var(--text-primary);';
            _navDiv.innerHTML = _navIntent.emoji + ' <strong>' + escHtml(_navIntent.label) + ' 페이지로 이동</strong> — 자세한 라이브 데이터/차트/분석 도구 확인';
            _navDiv.setAttribute('data-action', 'showPage');
            _navDiv.setAttribute('data-arg', _navIntent.page);
            aiBubble.parentNode.appendChild(_navDiv);
          }
        } catch(_navErr) {}

        // v49.69 P367 R130: 포트폴리오 동적 시뮬레이션 — "AAPL 10% 추가 시" 의도 → 가중치 변화 계산 + 응답 삽입
        try {
          var _pfSim = (typeof _simulatePortfolioAddition === 'function') ? _simulatePortfolioAddition(q, detectedTickers) : null;
          if (_pfSim && _pfSim.available) {
            var _pfDiv = document.createElement('div');
            _pfDiv.style.cssText = 'margin:8px 0;padding:8px 10px;background:rgba(0,229,160,0.06);border-left:3px solid var(--data-green);border-radius:4px;font-size:11px;color:var(--text-primary);';
            var _pfHTML = '<div style="font-weight:700;color:var(--data-green);margin-bottom:6px;">💼 포트폴리오 시뮬레이션 — ' + escHtml(_pfSim.target) + ' ' + _pfSim.percentToAdd + '% 추가</div>';
            _pfHTML += '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">현재 총 가치: $' + _pfSim.currentTotal.toLocaleString() + ' → 신규 총 가치: $' + _pfSim.newTotal.toLocaleString() + ' (추가 ' + _pfSim.addQty + '주 × $' + _pfSim.targetPrice.toFixed(2) + ' = $' + _pfSim.addAmount.toLocaleString() + ')</div>';
            _pfHTML += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-family:var(--font-mono);font-size:10px;">';
            _pfHTML += '<div style="color:var(--text-muted);font-weight:600;">종목</div><div style="color:var(--text-muted);font-weight:600;text-align:right;">현재 %</div><div style="color:var(--text-muted);font-weight:600;text-align:right;">신규 %</div>';
            _pfSim.weights.forEach(function(w) {
              var changeColor = w.change > 0 ? 'var(--data-green)' : w.change < 0 ? 'var(--data-red)' : 'var(--text-muted)';
              var changeStr = (w.change > 0 ? '+' : '') + w.change.toFixed(2) + '%';
              _pfHTML += '<div>' + escHtml(w.symbol) + '</div><div style="text-align:right;">' + w.currentPct.toFixed(2) + '%</div><div style="text-align:right;color:' + changeColor + ';">' + w.newPct.toFixed(2) + '% (' + changeStr + ')</div>';
            });
            _pfHTML += '</div>';
            _pfDiv.innerHTML = _pfHTML;
            aiBubble.parentNode.appendChild(_pfDiv);
          }
        } catch(_pfErr) {}

        // v49.72 R139: 답변 종목 detect 시 "📊 [종목] 재무 차트 보기" 버튼 자동 삽입
        // — 7 섹션 5년 분기 (Growth/Profitability/Balance/CashFlow/Liquidity/WorkingCap/Valuation)
        try {
          if (detectedTickers && detectedTickers.length > 0) {
            var _seenChartBtn = {};
            var _chartBtnContainer = document.createElement('div');
            _chartBtnContainer.className = 'aio-financial-chart-buttons';
            _chartBtnContainer.style.cssText = 'margin:8px 0 4px;display:flex;flex-direction:column;gap:4px;';
            detectedTickers.forEach(function(t) {
              if (!t || _seenChartBtn[t]) return;
              _seenChartBtn[t] = true;
              var _btn = document.createElement('div');
              _btn.className = 'aio-financial-chart-btn';
              _btn.setAttribute('data-action', '_aioShowFundamentalChart');
              _btn.setAttribute('data-arg', t);
              _btn.style.cssText = 'cursor:pointer;padding:6px 8px;background:rgba(0,212,255,0.06);border-left:3px solid var(--data-cyan);border-radius:4px;font-size:11px;color:var(--text-primary);transition:background 0.15s;';
              _btn.innerHTML = '📊 <strong>' + escHtml(t) + ' 재무 차트 보기</strong> ↗ <span style="color:var(--text-muted);">— 7 섹션 5년 분기 (Growth/Profitability/Balance/CashFlow/Liquidity/WorkingCap/Valuation)</span>';
              _chartBtnContainer.appendChild(_btn);
            });
            if (_chartBtnContainer.children.length > 0) aiBubble.parentNode.appendChild(_chartBtnContainer);
          }
        } catch(_finChartBtnErr) {}

        // v50.38 트랙1b: 초보자 "차트 읽기" 카드 — 텍스트 지표 대신 평이한 한국어 추세/위치/모멘텀/한 줄 결론.
        //   _fetchTechnicalDataForChat가 stash한 calcTechnicalSnapshot 재사용(재계산·재fetch 0). 초보자 차트분석 핵심.
        try {
          var _tcP = detectedTickers && detectedTickers[0];
          var _tcStash = (window._aioLastTechSnap && _tcP) ? window._aioLastTechSnap[_tcP] : null;
          var _sn = (_tcStash && (Date.now() - _tcStash.ts < 10 * 60 * 1000)) ? _tcStash.snap : null;
          if (_sn && _sn.ok && aiBubble && aiBubble.parentNode) {
            var _f2 = function(v, d) { return (v != null && !isNaN(v)) ? Number(v).toFixed(d == null ? 2 : d) : '—'; };
            var _trendTxt, _trendColor;
            if (_sn.above50SMA && _sn.above200SMA && _sn.above10EMA && _sn.above21EMA) { _trendTxt = '상승 추세 (이동평균선 정배열 — 단기>중기>장기 위)'; _trendColor = '#3ddba5'; }
            else if (_sn.above50SMA && _sn.above200SMA) { _trendTxt = '중장기 상승 (50·200일선 위)'; _trendColor = '#3ddba5'; }
            else if (_sn.above50SMA === false) { _trendTxt = '추세 훼손 (50일선 아래로 이탈)'; _trendColor = '#ff5b50'; }
            else { _trendTxt = '방향 혼조 (추세 불명확)'; _trendColor = '#ffa31a'; }
            var _hi = _sn.recentHigh20, _lo = _sn.recentLow20;
            var _posPct = (_hi && _lo && _hi > _lo) ? Math.round((_sn.price - _lo) / (_hi - _lo) * 100) : null;
            var _posTxt = _posPct != null ? ('최근 20일 범위 ' + _posPct + '% 위치 (' + (_posPct >= 70 ? '고점권' : _posPct <= 30 ? '저점권' : '중간') + ') · 지지 $' + _f2(_lo) + ' / 저항 $' + _f2(_hi)) : '범위 데이터 부족';
            var _rsi = _sn.rsi14;
            var _rsiTxt = _rsi != null ? ('RSI ' + _f2(_rsi, 0) + ' (' + (_rsi >= 70 ? '과매수·단기 조정 주의' : _rsi <= 30 ? '과매도·반등 가능' : '중립') + ')') : 'RSI —';
            var _macdTxt = (_sn.macd && _sn.macd.hist != null) ? (_sn.macd.hist > 0 ? 'MACD 상승 모멘텀' : 'MACD 하락 모멘텀') : '';
            var _verdict;
            if (_sn.above50SMA === false) _verdict = '추세가 깨진 상태 — 반등 확인 전까지 신규 매수보다 관망이 안전.';
            else if (_posPct != null && _posPct >= 80) _verdict = '상승 추세지만 단기 고점권 — 추격보다 눌림목(50일선 $' + _f2(_sn.sma50) + ') 대기가 유리.';
            else if (_rsi != null && _rsi <= 35 && _sn.above200SMA) _verdict = '장기 상승 속 단기 과매도 — 분할 매수 관점 유효(손절 $' + _f2(_lo) + ').';
            else if (_sn.above50SMA && _sn.above200SMA) _verdict = '상승 추세 유지 중 — 지지($' + _f2(_sn.sma50) + ') 지키는 한 보유/눌림목 매수.';
            else _verdict = '방향 불명확 — 50일선 회복 여부 확인 후 대응.';
            var _bcDiv = document.createElement('div');
            _bcDiv.className = 'aio-beginner-chart-reading';
            _bcDiv.innerHTML = '<div style="margin:8px 0;padding:10px 12px;background:rgba(0,212,255,0.06);border-left:3px solid var(--data-cyan);border-radius:3px;font-size:12px;line-height:1.6;color:var(--text-primary);">' +
              '<div style="font-weight:800;color:var(--data-cyan);margin-bottom:6px;">📈 ' + escHtml(_tcP) + ' 차트 핵심 판독 <span style="font-weight:500;color:var(--text-muted);font-size:10px;">(라이브 OHLCV 실측)</span></div>' +
              '<div style="display:grid;gap:3px;">' +
                '<div><b style="color:' + _trendColor + ';">추세</b> · ' + escHtml(_trendTxt) + '</div>' +
                '<div><b style="color:var(--text-secondary);">위치</b> · ' + escHtml(_posTxt) + '</div>' +
                '<div><b style="color:var(--text-secondary);">모멘텀</b> · ' + escHtml(_rsiTxt) + (_macdTxt ? ' · ' + escHtml(_macdTxt) : '') + '</div>' +
                '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);"><b style="color:var(--accent);">한 줄 결론</b> · ' + escHtml(_verdict) + '</div>' +
              '</div>' +
              '<button data-action="_aioShowTechnicalChart" data-arg="' + escHtml(_tcP) + '" style="margin-top:6px;font-size:10px;padding:3px 10px;background:rgba(0,212,255,0.12);border:1px solid var(--data-cyan);color:var(--data-cyan);border-radius:4px;cursor:pointer;font-weight:600;">📊 ' + escHtml(_tcP) + ' 차트 자세히 보기 ↗ <span style="color:var(--text-muted);">— 캔들+MA+RSI</span></button>' +
              '</div>';
            aiBubble.parentNode.appendChild(_bcDiv);
          }
        } catch(_bcErr) {}

        // v49.83 P447/R176: 답변 종목별 30일 mini sparkline SVG 자동 인라인 삽입 (기관급 직관성 #8)
        try {
          if (detectedTickers && detectedTickers.length > 0 && typeof window._aioBuildSparklineSvg === 'function') {
            var _seenSpark = {};
            var _sparkContainer = document.createElement('div');
            _sparkContainer.className = 'aio-sparkline-container';
            _sparkContainer.style.cssText = 'margin:6px 0 4px;display:flex;flex-direction:column;gap:4px;';
            // 최대 3개 종목 (토큰/UI 절약)
            var _sparkTickers = detectedTickers.slice(0, 3);
            // 비동기 — 각 ticker별 sparkline 병렬 생성
            Promise.all(_sparkTickers.map(function(t) {
              if (!t || _seenSpark[t]) return Promise.resolve(null);
              _seenSpark[t] = true;
              return window._aioBuildSparklineSvg(t, { label: t, width: 240, height: 56 }).then(function(html) {
                if (html) {
                  var div = document.createElement('div');
                  div.innerHTML = html;
                  return div.firstElementChild;
                }
                return null;
              }).catch(function() { return null; });
            })).then(function(els) {
              els.forEach(function(el) { if (el) _sparkContainer.appendChild(el); });
              if (_sparkContainer.children.length > 0 && aiBubble && aiBubble.parentNode) {
                aiBubble.parentNode.appendChild(_sparkContainer);
              }
            }).catch(function(){});
          }
        } catch(_sparkErr) {}

        // v49.69 P365 R129: 후속 질문 3개 자동 제안 + chip 클릭 시 chatFromChip 자동 호출
        try {
          var _fuq = (typeof _suggestFollowUpQuestions === 'function') ? _suggestFollowUpQuestions(ctxId, q, fullText, detectedTickers) : null;
          if (_fuq && _fuq.length > 0) {
            var _fuqDiv = document.createElement('div');
            _fuqDiv.className = 'aio-followup-questions';
            _fuqDiv.style.cssText = 'margin:8px 0 4px;padding:6px 8px;background:rgba(0,212,255,0.06);border-left:3px solid var(--data-cyan);border-radius:4px;';
            var _fuqHTML = '<div style="font-size:11px;color:var(--data-cyan);font-weight:600;margin-bottom:4px;">💡 후속 질문 (클릭 시 자동 전송)</div>';
            _fuqHTML += '<div style="display:flex;flex-direction:column;gap:4px;">';
            _fuq.forEach(function(q) {
              var safeQ = escHtml(q).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              _fuqHTML += '<div class="q-chip aio-followup-chip" data-action="chatFromChip" data-arg="' + escHtml(ctxId) + '" data-arg2="' + safeQ + '" title="' + escHtml(q) + '" style="cursor:pointer;padding:4px 8px;background:var(--surface-1);border-radius:4px;font-size:11px;color:var(--text-primary);transition:background 0.15s;">[Q] ' + escHtml(q) + '</div>';
            });
            _fuqHTML += '</div>';
            _fuqDiv.innerHTML = _fuqHTML;
            aiBubble.parentNode.appendChild(_fuqDiv);
          }
        } catch(_fuqErr) { /* 후속 질문 실패해도 응답 렌더 차단 X */ }

        // v50.82 Phase 3: AI 채팅 자동 시각화 — 토픽 감지 → SVG 다이어그램 주입
        try {
          if (typeof window._aioChatAutoVis === 'function' && typeof window._aioDiagram !== 'undefined'
              && aiBubble && aiBubble.parentNode) {
            var _vis3 = window._aioChatAutoVis(q, visible, detectedTickers);
            if (_vis3) {
              var _vis3Svg = window._aioDiagram.getSvg(_vis3.type, _vis3.data);
              if (_vis3Svg) {
                var _vis3Div = document.createElement('div');
                _vis3Div.className = 'aio-chat-vis';
                _vis3Div.style.cssText = 'margin:8px 0 4px;background:var(--surface-2);border:1px solid rgba(0,212,255,0.18);border-left:3px solid var(--data-cyan);border-radius:var(--radius);padding:8px 10px;overflow:hidden;';
                var _vis3SvgSafe = (typeof DOMPurify !== 'undefined')
                  ? DOMPurify.sanitize(_vis3Svg, {USE_PROFILES: {svg: true}})
                  : _vis3Svg;
                _vis3Div.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">' +
                  escHtml(_vis3.label) + ' <span style="font-weight:400;opacity:.55;">· 자동 시각화</span></div>' + _vis3SvgSafe;
                aiBubble.parentNode.appendChild(_vis3Div);
              }
            }
          }
        } catch(_vis3Err) {}

        // v51.30 Maker-Checker: AI 추천 종목 → 퀀트 팩터 독립 검증 패널
        try {
          var _isRecoQuery = /추천|시그널|매수|buy|best|top|우량|퀀트|랭킹|screener/i.test(q) || !!screenerResult;
          if (_isRecoQuery && typeof window._aioMakerCheckerVerify === 'function') {
            var _mcTickers = [];
            var _addMcTicker = function(t) {
              t = String(t || '').toUpperCase();
              if (t && _mcTickers.indexOf(t) < 0 && _mcTickers.length < 5) _mcTickers.push(t);
            };
            var _answerTickers = (typeof _extractTickers === 'function') ? _extractTickers(fullText || '') : [];
            (_answerTickers || []).forEach(_addMcTicker);
            (detectedTickers || []).forEach(_addMcTicker);
            if (screenerResult && Array.isArray(screenerResult.rows)) {
              screenerResult.rows.slice(0, 5).forEach(function(r) { _addMcTicker(r && r.sym); });
            }
            var _mcr = _mcTickers.length ? window._aioMakerCheckerVerify(_mcTickers) : null;
            if (_mcr && _mcr.length > 0 && aiBubble && aiBubble.parentNode) {
              var _mcDiv = document.createElement('div');
              _mcDiv.className = 'aio-maker-checker';
              _mcDiv.style.cssText = 'margin:6px 0 4px;padding:6px 10px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-left:3px solid var(--text-muted);border-radius:var(--radius);';
              var _mcHTML = '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Maker-Checker · 퀀트 검증</div>';
              _mcHTML += '<div style="display:flex;flex-wrap:wrap;gap:5px;">';
              _mcr.forEach(function(r) {
                var col = r.verdict === 'CONFIRMED' ? '#22c55e' : r.verdict === 'CAUTION' ? '#f59e0b' : '#ef4444';
                var icon = r.verdict === 'CONFIRMED' ? '✓' : r.verdict === 'CAUTION' ? '⚠' : '✗';
                _mcHTML += '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:' + col + '18;border:1px solid ' + col + '44;border-radius:12px;font-size:11px;">' +
                  '<span style="color:' + col + ';font-weight:700;">' + icon + '</span>' +
                  '<b style="color:var(--text-primary);">' + escHtml(r.sym) + '</b>' +
                  '<span style="color:var(--text-muted);">' + escHtml(r.reasons.join(' · ')) + '</span>' +
                  '</span>';
              });
              _mcHTML += '</div>';
              _mcDiv.innerHTML = _mcHTML;
              aiBubble.parentNode.appendChild(_mcDiv);
            }
          }
        } catch(_mcErr) {}
      }

      // v36.2: 웹검색 출처 링크 추가
      if (webSearchResult && webSearchResult.citations && webSearchResult.citations.length > 0) {
        var citTarget = streamEl || aiBubble;
        if (citTarget) {
          var citDiv = document.createElement('div');
          citDiv.innerHTML = _searchCitationsHTML(webSearchResult);
          citTarget.parentNode.insertBefore(citDiv, citTarget.nextSibling);
        }
      }

      state.messages.push({ role: 'assistant', content: visible });
      if (ctxId === 'fundamental') state._fundDepth = 0;  // v48.94 P160: 완료 시 리셋

      // v29.1: 대화 기록 자동 저장
      saveChatEntry(ctxId, q, visible);

      var newChips = extractChips(visible);
      chatRenderChips(ctxId, newChips);
    };

  // onError — v46.6: 자동 재시도 + 모델 폴백
  var _pageOnError = function(errMsg) {
      var _retryable = /시간 초과|timeout|네트워크|AbortError|500|502|503|529|overloaded/i.test(errMsg);
      var _retried = state._retryCount || 0;
      var _fallbackOrder = ['sonnet-thinking','sonnet','haiku'];
      var _currentIdx = _fallbackOrder.indexOf(selectedModelKey);

      if (_retryable && _retried < 2) {
        state._retryCount = _retried + 1;
        var nextModel = selectedModelKey;
        // 2번째 재시도 → 하위 모델로 폴백
        if (_retried >= 1 && _currentIdx >= 0 && _currentIdx < _fallbackOrder.length - 1) {
          nextModel = _fallbackOrder[_currentIdx + 1];
          chatAppendMsg(ctxId, 'ai', '<div style="font-size:11px;color:#fbbf24;padding:4px 8px;background:rgba(255,163,26,0.08);border-radius:4px;">⟳ 응답 지연 — ' + getModelConfig(nextModel).label + '로 재시도 중...</div>');
        } else {
          chatAppendMsg(ctxId, 'ai', '<div style="font-size:11px;color:#fbbf24;padding:4px 8px;background:rgba(255,163,26,0.08);border-radius:4px;">⟳ 재시도 중... (' + (_retried+1) + '/2)</div>');
        }
        setTimeout(function() {
          if (typeof _aioBeginAIRequestAttempt === 'function') _aioBeginAIRequestAttempt(_pageAIRequest, nextModel);
          callClaude(systemPrompt, state.messages, _pageOnChunk, _pageOnDone,
            _pageOnError,
            { modelKey: nextModel, webSearch: _useClaudeWebSearch }
          );
        }, 5000);
        return;
      }
      state.streaming = false;
      state._retryCount = 0;
      state._chatSendEntered = 0;  // v49.78 C4 P419: atomic lock release (onError)
      if (ctxId === 'fundamental') state._fundDepth = 0;  // v48.94 P160: 재귀 카운터 리셋
      if (btn) { btn.disabled = false; btn.textContent = '전송 ▶'; }

      var loadEl = document.getElementById('chat-' + ctxId + '-loading');
      if (loadEl) { var loadWrap = loadEl.closest('.acp-msg') || loadEl.parentNode; if (loadWrap && loadWrap.parentNode) loadWrap.parentNode.removeChild(loadWrap); }

      // v49.77 P411 R154: callClaude 최종 실패 시 friendly 안내 + 자가 진단 가이드 (사용자 좌절 시정)
      // 에러 유형 분류: 401 API key / 429 rate limit / 5xx network / overloaded / other
      var _errCat, _errIcon, _errGuide;
      if (/401|unauthorized|invalid.*key|API.*key/i.test(errMsg)) {
        _errCat = 'API 키 무효'; _errIcon = '🔑';
        _errGuide = '<ul style="margin:6px 0 0 16px;padding:0;line-height:1.6;"><li>사이드바의 Claude API 키 입력란을 확인하세요.</li><li><a href="https://console.anthropic.com" target="_blank" style="color:#00d4ff;">Anthropic Console</a>에서 키 발급/만료 상태를 확인하세요.</li><li>키를 다시 저장한 뒤 같은 질문을 재시도하세요.</li></ul>';
      } else if (/429|rate.*limit|too many/i.test(errMsg)) {
        _errCat = 'API 사용량 한도 초과'; _errIcon = '⏱';
        _errGuide = '<ul style="margin:6px 0 0 16px;padding:0;line-height:1.6;"><li>1분 후 재시도 (Anthropic rate limit 회복 대기)</li><li>console.anthropic.com에서 사용량/한도 확인</li><li>모델 변경: Sonnet → Haiku (사이드바 모델 선택)</li></ul>';
      } else if (/500|502|503|529|overloaded|server.*error/i.test(errMsg)) {
        _errCat = 'Anthropic 서버 일시 오류'; _errIcon = '⚠';
        _errGuide = '<ul style="margin:6px 0 0 16px;padding:0;line-height:1.6;"><li>1~2분 후 재시도 (Anthropic 일시 부하)</li><li><a href="https://status.anthropic.com" target="_blank" style="color:#00d4ff;">status.anthropic.com</a> 상태 확인</li><li>모델 변경: Sonnet-Thinking → Sonnet → Haiku 순서로 fallback 권장</li></ul>';
      } else if (/network|fetch|cors/i.test(errMsg)) {
        _errCat = '네트워크 오류'; _errIcon = '📡';
        _errGuide = '<ul style="margin:6px 0 0 16px;padding:0;line-height:1.6;"><li>인터넷 연결을 확인하세요.</li><li>잠시 후 다시 시도하세요.</li><li>계속 실패하면 데이터 연결 상태를 새로고침하세요.</li></ul>';
      } else {
        _errCat = '알 수 없는 오류'; _errIcon = '❓';
        _errGuide = '<ul style="margin:6px 0 0 16px;padding:0;line-height:1.6;"><li>페이지를 새로고침한 뒤 다시 질문하세요.</li><li>다른 모델을 선택해 재시도하세요.</li><li>같은 문제가 반복되면 API 키와 네트워크 상태를 확인하세요.</li><li>브라우저 개발자 콘솔에서 <code style="background:rgba(0,0,0,0.25);padding:1px 4px;border-radius:2px;">AIO.diagnose()</code>를 실행하면 시세/채팅/데이터 상태를 한 번에 자가진단할 수 있습니다.</li></ul>';
      }
      var _errBox = '<div style="padding:10px 12px;background:rgba(248,113,113,0.08);border:1px solid #f87171;border-radius:3px;color:var(--text-primary);font-size:12px;line-height:1.5;">' +
        '<div style="font-size:13px;font-weight:700;color:#ff5b50;margin-bottom:4px;">' + _errIcon + ' ' + _errCat + ' — 답변 생성 실패</div>' +
        '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;margin-bottom:6px;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:3px;overflow-x:auto;">' + escHtml(errMsg).slice(0, 200) + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);">권장 조치:</div>' +
        _errGuide +
        '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button data-action="chatFromChip" data-arg="' + escHtml(ctxId) + '" data-arg2="' + escHtml(q).replace(/'/g, '\\\'') + '" style="font-size:11px;padding:4px 10px;background:rgba(0,212,255,0.12);border:1px solid var(--data-cyan);color:var(--data-cyan);border-radius:4px;cursor:pointer;">🔁 같은 질문 재시도</button>' +
        '<button data-action="_aioRefreshAllData" style="font-size:11px;padding:4px 10px;background:rgba(61,219,165,0.12);border:1px solid var(--data-green);color:var(--data-green);border-radius:4px;cursor:pointer;">🔄 데이터 새로고침</button>' +
        '</div>' +
        '</div>';
      chatAppendMsg(ctxId, 'ai', _errBox);
    };

  // opts — v31.3 적응형 모델 선택 + v34.5 심층 분석 토큰 확장 + v49.57 web_search
  callClaude(
    systemPrompt,
    state.messages,
    _pageOnChunk,
    _pageOnDone,
    _pageOnError,
    { modelKey: selectedModelKey, maxTokens: (singleDeepStr || deepCompareStr || _shouldDeepAnalyze) ? 16000 : undefined, webSearch: _useClaudeWebSearch }
  );
}

// ── Click a suggestion chip ────────────────────────────────────────────
function chatFromChip(ctxId, q) {
  var inp = document.getElementById('chat-' + ctxId + '-inp');
  if (inp) { inp.value = q; }
  chatSend(ctxId);
}

// ── Clear chat history ─────────────────────────────────────────────────
function chatClear(ctxId) {
  showConfirmModal('채팅 삭제', '채팅 기록을 모두 삭제할까요?', function() {
    var state = getChatState(ctxId);
    state.messages = [];
    state.streaming = false;
    state._chatSendEntered = 0;  // v49.78 C4 P419: clear 시에도 atomic lock release
    var msgsEl = document.getElementById('chat-' + ctxId + '-msgs');
    if (msgsEl) msgsEl.innerHTML = '';
    chatRenderChips(ctxId, null);
    var btn = document.getElementById('chat-' + ctxId + '-btn');
    if (btn) { btn.disabled = false; btn.textContent = '전송 ▶'; }
    var inp = document.getElementById('chat-' + ctxId + '-inp');
    if (inp) inp.value = '';
  }, '');
}

// v29.1: 모든 채팅 헤더에 "대화 기록" 버튼 자동 주입
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.acp-header').forEach(function(header) {
    // 해당 채팅의 ctxId 추출 (가장 가까운 acp-messages의 id에서)
    const chatPanel = header.closest('.aio-chat');
    if (!chatPanel) return;
    if (!header.querySelector('[data-ai-public-policy="beta-research"]')) {
      var policyTag = document.createElement('span');
      policyTag.setAttribute('data-ai-public-policy', 'beta-research');
      policyTag.textContent = 'BETA · 교육/리서치 보조';
      policyTag.title = '교육·리서치 보조. 수치/출처는 기준시각과 Evidence 상태를 확인하세요. 구체적 매매 지시는 제공하지 않습니다.';
      policyTag.style.cssText = 'font-size:10px;color:var(--data-amber);font-family:var(--font-mono);margin-left:auto;white-space:nowrap;';
      header.appendChild(policyTag);
    }
    const msgsEl = chatPanel.querySelector('.acp-messages');
    if (!msgsEl || !msgsEl.id) return;
    const ctxId = msgsEl.id.replace('chat-', '').replace('-msgs', '');
    // 이미 있으면 스킵
    if (header.querySelector('.acp-history-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'acp-history-btn';
    btn.textContent = '기록';
    btn.title = '이전 대화 기록 열람';
    btn.addEventListener('click', function() { openChatHistory(ctxId); });
    // clear 버튼 앞에 삽입
    const clearBtn = header.querySelector('.acp-clear');
    if (clearBtn) header.insertBefore(btn, clearBtn);
    else header.appendChild(btn);
  });
});

// ── Fundamental page: quick ticker search ─────────────────────────────
function fundSearchQuick(ticker) {
  if (!ticker) return;
  var t = ticker.toString().trim().toUpperCase();
  var searchInp = document.getElementById('fund-search-input');
  if (searchInp) searchInp.value = t;
  fundamentalSearch();
}

// ── Fundamental page: search handler ────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
//  COMPREHENSIVE FUNDAMENTAL ANALYSIS ENGINE v33
// SEC EDGAR XBRL + FMP API + Yahoo Finance → 실제 데이터 수집 → UI 렌더 + LLM 주입
// ══════════════════════════════════════════════════════════════════════════

// 글로벌 캐시: 마지막 검색 기업의 수집된 데이터 (LLM 프롬프트에 주입용)
window._fundAnalysisData = null;

// FMP API fetch helper
// v48.8: FMP 무료 250/day 쿼터 카운터 — 하루 단위 리셋. 200+ 시 UI 경고.
// v48.9: 범용 쿼터 카운터로 확장 — 공유 키 API 전체 커버 (Twelve Data/AV/Google CSE/NewsData/Perplexity)
//        각 API의 공식 무료 한도를 _QUOTA_LIMITS에 선언. localStorage aio_quota_{provider} 일일 키별 관리.
//        4명 공유 키 환경에서 개별 사용자가 다른 사용자의 쿼터 소진을 조기 인지 가능 (console 경고).
var _QUOTA_LIMITS = {
  fmp:        { daily: 250,  label: 'FMP 재무제표' },
  twelveData: { daily: 800,  label: 'Twelve Data 지표' },
  alphaVantage:{ daily: 25,  label: 'Alpha Vantage breadth' },
  googleCse:  { daily: 100,  label: 'Google CSE 검색' },
  newsdata:   { daily: 200,  label: 'NewsData.io 뉴스' },
  rss2json:   { daily: 10000,label: 'rss2json' },
  // v50.10: Claude native web_search 비용 안전 상한 (검색 1회당 과금 — 5명 공유 유료 키 보호).
  //   관대한 기본값. 운영자가 localStorage 'aio_quota_claudeWebSearch' 또는 본 daily 값으로 조정 가능.
  claudeWebSearch: { daily: 120, label: 'Claude 웹검색' }
};
function _bumpApiCounter(providerKey) {
  try {
    var lim = _QUOTA_LIMITS[providerKey];
    if (!lim) return 0;
    if (window.AIO && typeof window.AIO.tryAcquireAIQuota === 'function') {
      var atomicQuota = window.AIO.tryAcquireAIQuota(providerKey, lim.daily);
      if (atomicQuota && atomicQuota.handled) {
        if (!atomicQuota.allowed) _aioLog('error', 'fetch', lim.label + ' 일일 한도 도달 또는 quota lock — ' + providerKey + ' 호출 스킵');
        return atomicQuota.count;
      }
    }
    var today = new Date().toISOString().slice(0,10);
    var lsKey = 'aio_quota_' + providerKey;
    var raw = localStorage.getItem(lsKey);
    var q = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (q.date !== today) q = { date: today, count: 0 };
    q.count = (q.count || 0) + 1;
    localStorage.setItem(lsKey, JSON.stringify(q));
    var warnAt = Math.floor(lim.daily * 0.8);
    if (q.count === warnAt) _aioLog('warn', 'fetch', lim.label + ' 일일 한도(' + lim.daily + ') 80% 도달 — 남은 ' + (lim.daily - q.count) + '회');
    if (q.count >= lim.daily) _aioLog('error', 'fetch', lim.label + ' 일일 한도 도달! ' + providerKey + ' 호출 스킵 — 24h 후 리셋');
    return q.count;
  } catch(e) { return 0; }
}
function _isQuotaExceeded(providerKey) {
  try {
    var lim = _QUOTA_LIMITS[providerKey];
    if (!lim) return false;
    var raw = localStorage.getItem('aio_quota_' + providerKey);
    if (!raw) return false;
    var q = JSON.parse(raw);
    var today = new Date().toISOString().slice(0,10);
    return q.date === today && q.count >= lim.daily;
  } catch(e) { return false; }
}
// 하위 호환 — v48.8의 _bumpFmpCounter 호출하는 곳 유지
function _bumpFmpCounter() { return _bumpApiCounter('fmp'); }

async function _fmpFetch(endpoint) {
  var key = _getApiKey('aio_fmp_key') || '';
  if (!key) return null;
  // v48.8: 쿼터 사전 체크 — 한도 도달 시 즉시 중단 (네트워크 낭비 방지)
  try {
    var qRaw = localStorage.getItem('aio_fmp_quota');
    if (qRaw) {
      var q = JSON.parse(qRaw);
      var today = new Date().toISOString().slice(0,10);
      if (q.date === today && q.count >= 250) {
        _aioLog('warn', 'fetch', 'FMP 일일 한도 도달 — 호출 스킵: ' + endpoint);
        return null;
      }
    }
  } catch(e) {}
  try {
    var url = 'https://financialmodelingprep.com/api/' + endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') + 'apikey=' + key;
    var r = await fetchWithTimeout(url, {}, 10000);
    if (r.ok) {
      _bumpFmpCounter();  // 성공 호출만 카운트
      return await r.json();
    }
  } catch(e) { _aioLog('warn', 'fetch', 'FMP ' + endpoint + ': ' + e.message); }
  return null;
}

// SEC EDGAR XBRL → 핵심 재무 지표 파싱 (매출, 순이익, 자산, 자본, EPS, FCF)
function _parseSECFinancials(xbrlData) {
  if (!xbrlData || !xbrlData.facts) return null;
  // v40.4: IFRS 기업(ASML, TSM 등 ADR) 대응 — us-gaap 우선, 없으면 ifrs-full 폴백
  var gaap = xbrlData.facts['us-gaap'] || xbrlData.facts['ifrs-full'] || {};
  var result = {};

  // Helper: 특정 concept의 연간/분기 데이터 추출 (최근 N개)
  // P560/R251: this used to return on the FIRST alias in conceptNames that had ANY data at
  // all, regardless of how stale it was. Companies that switched XBRL tags mid-history (e.g.
  // Apple stopped reporting under "Revenues" around its 2018 ASC-606 transition and moved to
  // "RevenueFromContractWithCustomerExcludingAssessedTax") still have old entries under the
  // first, now-abandoned tag — so this always returned 2018-era data as "the latest revenue"
  // even though a newer tag with current data existed. Now every alias is evaluated and the
  // one whose latest entry is most recent wins. A duration filter (annual entries must span
  // ~300-400 days) also rejects stray stub/quarterly facts that slipped into a "10-K" filing,
  // which is what let mismatched-period figures (e.g. an annual gross profit paired with a
  // quarterly revenue) distort cross-concept ratios like gross margin above 100%.
  function extractSeries(conceptNames, formType, count) {
    var best = null;
    var bestEnd = '';
    for (var c = 0; c < conceptNames.length; c++) {
      var concept = gaap[conceptNames[c]];
      if (!concept || !concept.units) continue;
      var usdArr = concept.units['USD'] || concept.units['USD/shares'] || Object.values(concept.units)[0];
      if (!usdArr) continue;
      // v40.4: 20-F(외국발행인) 양식도 10-K와 동등하게 처리 (ASML, TSM 등 ADR 대응)
      var filtered = usdArr.filter(function(d) {
        if (!d.end) return false;
        if (formType === '10-K') return d.form === '10-K' || d.form === '20-F' || d.form === '20-F/A';
        return d.form === formType;
      });
      // P560: reject entries whose start-end span doesn't match the expected period length —
      // a stray quarterly/stub fact tagged under a 10-K filing would otherwise be treated as
      // a full-year figure and distort ratios against genuinely-annual concepts.
      if (formType === '10-K') {
        filtered = filtered.filter(function(d) {
          if (!d.start) return true; // instant (point-in-time) facts have no start/duration
          var days = (new Date(d.end) - new Date(d.start)) / 86400000;
          return days >= 300 && days <= 400;
        });
      }
      // 연간은 filed 기준, frame으로 중복 제거
      var seen = {};
      var unique = [];
      for (var i = filtered.length - 1; i >= 0; i--) {
        var key = filtered[i].end;
        if (!seen[key]) { seen[key] = true; unique.unshift(filtered[i]); }
      }
      if (unique.length > 0) {
        var thisEnd = unique[unique.length - 1].end;
        if (!best || thisEnd > bestEnd) { best = unique; bestEnd = thisEnd; }
      }
    }
    return best ? best.slice(-count) : [];
  }

  result.revenue = extractSeries(['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax','SalesRevenueNet'], '10-K', 5);
  result.netIncome = extractSeries(['NetIncomeLoss'], '10-K', 5);
  result.totalAssets = extractSeries(['Assets'], '10-K', 5);
  result.equity = extractSeries(['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], '10-K', 5);
  result.eps = extractSeries(['EarningsPerShareDiluted','EarningsPerShareBasic'], '10-K', 5);
  result.opCashFlow = extractSeries(['NetCashProvidedByOperatingActivities','CashProvidedByOperatingActivities'], '10-K', 5);
  result.capex = extractSeries(['PaymentsToAcquirePropertyPlantAndEquipment','CapitalExpenditure'], '10-K', 5);
  result.grossProfit = extractSeries(['GrossProfit'], '10-K', 5);
  result.opIncome = extractSeries(['OperatingIncomeLoss'], '10-K', 5);
  result.totalDebt = extractSeries(['LongTermDebt','LongTermDebtNoncurrent'], '10-K', 5);
  result.costOfRevenue = extractSeries(['CostOfRevenue','CostOfGoodsAndServicesSold'], '10-K', 5);
  // v48.0: 성장주 품질 분석 필수 — R&D 지출, SBC(주식기반보상), SG&A
  result.rd = extractSeries(['ResearchAndDevelopmentExpense','ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'], '10-K', 5);
  result.sbc = extractSeries(['ShareBasedCompensation','StockBasedCompensation'], '10-K', 5);
  result.sga = extractSeries(['SellingGeneralAndAdministrativeExpense','GeneralAndAdministrativeExpense'], '10-K', 5);
  // P560/R251: shares outstanding was never extracted, so the market-cap fallback
  // (`d.price * (d.sharesOut || 0)`) always multiplied by 0 whenever FMP was unavailable —
  // the concrete cause of "Market Cap: N/A" showing next to a live, non-null price.
  var sharesSeries = extractSeries(['CommonStockSharesOutstanding'], '10-K', 1);
  if (!sharesSeries.length) {
    var deiFacts = (xbrlData.facts['dei'] || {})['EntityCommonStockSharesOutstanding'];
    var deiArr = deiFacts && deiFacts.units && (deiFacts.units['shares'] || Object.values(deiFacts.units)[0]);
    if (deiArr && deiArr.length) sharesSeries = [deiArr[deiArr.length - 1]];
  }
  result.sharesOut = sharesSeries;
  // v48.0: 현금 포지션·운전자본 건전성
  result.cash = extractSeries(['CashAndCashEquivalentsAtCarryingValue','Cash'], '10-K', 5);
  result.inventory = extractSeries(['InventoryNet','Inventories'], '10-K', 5);
  result.receivables = extractSeries(['AccountsReceivableNetCurrent','ReceivablesNetCurrent'], '10-K', 5);
  result.currentDebt = extractSeries(['DebtCurrent','LongTermDebtCurrent'], '10-K', 5);

  // 분기 데이터 (최근 4분기)
  result.qRevenue = extractSeries(['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax'], '10-Q', 6);
  result.qNetIncome = extractSeries(['NetIncomeLoss'], '10-Q', 6);
  result.qEps = extractSeries(['EarningsPerShareDiluted'], '10-Q', 6);

  return result;
}

// _fmtNum / _fmtPct — aio-core.js로 이동됨 (v51.16). window.* 전역 alias.
var _fmtNum = window._fmtNum;
var _fmtPct = window._fmtPct;

// v33.4: 최근 검색 기록 관리
function _fundRecentSearches(ticker) {
  var key = 'aio_fund_recent';
  var arr = [];
  try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
  if (ticker) {
    arr = arr.filter(function(t) { return t !== ticker; });
    arr.unshift(ticker);
    if (arr.length > 8) arr = arr.slice(0, 8);
    localStorage.setItem(key, JSON.stringify(arr));
  }
  // 렌더링
  var el = document.getElementById('fund-recent-searches');
  if (!el) return;
  if (arr.length === 0) { el.innerHTML = ''; return; }
  // P566/R257: the visible label was inserted raw while the data-arg was escaped — ticker
  // input has no charset whitelist, so typing/persisting an HTML payload rendered unescaped
  // on next paint (stored self-XSS via this element's own localStorage-persisted history).
  el.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">최근:</span>' + arr.map(function(t) {
    return '<span class="aio-hover-fund-ticker" data-action="fundSearchQuick" data-arg="' + escHtml(t) + '" style="font-size:11px;color:var(--accent);border-radius:4px;padding:2px 7px;cursor:pointer;font-family:var(--font-mono);font-weight:600;">' + escHtml(t) + '</span>';
  }).join('');
}

// 메인 종합 분석 함수
// v46.4: FMP 데이터 검증 레이어 — ticker 불일치, 가격 괴리, 수치 범위, 데이터 결함 감지
function _validateFMPData(collected) {
  var warnings = [];
  var ticker = collected.ticker;

  // 1. Ticker 매칭: FMP profile.symbol vs 요청 ticker
  if (collected.fmpProfile && collected.fmpProfile.symbol) {
    var fmpSym = collected.fmpProfile.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    var reqSym = ticker.replace(/[^A-Z0-9]/g, '');
    if (fmpSym !== reqSym) {
      warnings.push('티커 불일치: 요청=' + ticker + ', FMP 응답=' + collected.fmpProfile.symbol + ' — 다른 종목 데이터일 수 있음');
      collected._tickerMismatch = true;
    }
  }

  // 2. 가격 괴리: Yahoo vs FMP (10% 이상이면 경고)
  if (collected.price && collected.fmpProfile && collected.fmpProfile.price && collected.fmpProfile.price > 0) {
    try {
      if (window.AIO && typeof window.AIO.recordCrossSourceQuote === 'function') {
        window.AIO.recordCrossSourceQuote(ticker, 'fmp:profile', collected.fmpProfile.price, null, Date.now(), {
          delayed: true,
          reason: 'fundamental-fmp-profile-price'
        });
      }
    } catch(_fmpCrossRecord) {}
    var priceDiff = Math.abs(collected.price - collected.fmpProfile.price) / collected.price * 100;
    if (priceDiff > 10) {
      warnings.push('가격 괴리 ' + priceDiff.toFixed(1) + '%: Yahoo $' + collected.price.toFixed(2) + ' vs FMP $' + collected.fmpProfile.price.toFixed(2));
    }
  }

  // 3. 매출 합리성: 최신 연도 매출이 0 또는 null
  if (collected.fmpIncome && collected.fmpIncome.length > 0) {
    var latestRev = collected.fmpIncome[0].revenue;
    if (latestRev === 0 || latestRev == null) {
      warnings.push('최신 매출 $0 또는 null — 데이터 결함 또는 프리 IPO 기업');
    }
    // 매출 급감 경고 (YoY -50% 이상)
    if (collected.fmpIncome.length >= 2) {
      var prevRev = collected.fmpIncome[1].revenue;
      if (prevRev > 0 && latestRev > 0 && (latestRev - prevRev) / prevRev < -0.5) {
        warnings.push('매출 YoY -' + (Math.abs((latestRev - prevRev) / prevRev) * 100).toFixed(0) + '% 급감 — 구조 변화 확인 필요');
      }
    }
  }

  // 4. PE 범위 경고
  var pe = null;
  if (collected.fmpRatiosTTM && collected.fmpRatiosTTM.peRatioTTM) pe = collected.fmpRatiosTTM.peRatioTTM;
  else if (collected.fmpMetricsTTM && collected.fmpMetricsTTM.peRatioTTM) pe = collected.fmpMetricsTTM.peRatioTTM;
  if (pe !== null && (pe < -100 || pe > 1000)) {
    warnings.push('P/E ' + pe.toFixed(1) + ' — 비정상 범위 (데이터 오류 가능)');
  }

  // 5. 시가총액 0 이하
  if (collected.fmpProfile && collected.fmpProfile.mktCap != null && collected.fmpProfile.mktCap <= 0) {
    warnings.push('시가총액 $0 — 상장폐지 또는 데이터 결함');
  }

  // 6. 이익의 질 경고 (순이익 > 영업CF = 발생액 기반)
  if (collected.fmpIncome && collected.fmpIncome[0] && collected.fmpCashflow && collected.fmpCashflow[0]) {
    var ni = collected.fmpIncome[0].netIncome || 0;
    var ocf = collected.fmpCashflow[0].operatingCashFlow || 0;
    if (ni > 0 && ocf > 0 && ni > ocf * 1.5) {
      warnings.push('이익의 질 경고: 순이익($' + _fmtNum(ni) + ') > 영업CF($' + _fmtNum(ocf) + ') × 1.5 — 발생액 기반 이익 비중 높음');
    }
  }

  // 7. 주식 희석 경고
  if (collected.fmpIncome && collected.fmpIncome.length >= 2) {
    var curShares = collected.fmpIncome[0].weightedAverageShsOutDil || 0;
    var prevShares = collected.fmpIncome[1].weightedAverageShsOutDil || 0;
    if (curShares > 0 && prevShares > 0) {
      var dilution = (curShares - prevShares) / prevShares * 100;
      if (dilution > 5) {
        warnings.push('주식 희석 ' + dilution.toFixed(1) + '% YoY — SBC 또는 유상증자 영향 확인');
      }
    }
  }

  collected._dataWarnings = warnings;
  if (warnings.length > 0) _aioLog('warn', 'fund', 'FMP-Validate ' + ticker + ': ' + warnings.join(' | '));
  return warnings;
}

// v48.8: 세션 단위 기업 분석 캐시 — FMP 무료 250/day 보호 (18 req/분석 × 4 사용자 소진 방지)
// 30분 TTL. 같은 티커 재검색 시 네트워크 생략 + 즉시 렌더 + AI 프롬프트 재주입.
window._fundCache = window._fundCache || {};

async function fundamentalSearch() {
  var inp = document.getElementById('fund-search-input');
  if (!inp) return;
  var ticker = inp.value.trim().toUpperCase();
  if (!ticker) return;
  // P566/R257: reject anything that doesn't look like a plausible ticker symbol before it is
  // persisted to localStorage / used as a search key — the display layer already escapes on
  // render, but validating at the input boundary means non-ticker payloads are never stored
  // or treated as a ticker in the first place. Covers US ("AAPL"), KR ("005930.KS"),
  // class-share ("BRK-A") and similar international formats.
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    var _earlyProgressEl = document.getElementById('fund-rpt-progress');
    var _earlyContainer = document.getElementById('fund-report-container');
    if (_earlyContainer) _earlyContainer.style.display = 'block';
    if (_earlyProgressEl) _earlyProgressEl.innerHTML = '<div style="color:#ff5b50;">올바른 티커 형식이 아닙니다 (예: AAPL, 005930.KS)</div>';
    return;
  }
  // v33.4: 검색 기록 추가
  _fundRecentSearches(ticker);

  var container = document.getElementById('fund-report-container');
  var progressEl = document.getElementById('fund-rpt-progress');
  var loadingEl = document.getElementById('fund-rpt-loading');
  if (container) container.style.display = 'block';
  if (loadingEl) loadingEl.style.display = 'block';

  // v48.8: 세션 캐시 히트 시 네트워크 생략하고 이전 결과 재렌더
  var _cached = window._fundCache[ticker];
  if (_cached && (Date.now() - _cached._ts < 30 * 60 * 1000)) {
    var _ageMin = Math.round((Date.now() - _cached._ts) / 60000);
    if (progressEl) progressEl.innerHTML = '<div style="color:#3ddba5;">캐시 사용: ' + _ageMin + '분 전 분석 결과 (FMP 무료 250/day 보호)</div>';
    var collected = _cached.data;
    window._fundAnalysisData = collected;
    // v49.58 R106: 채팅 컨텍스트가 활성 종목 자동 인지 (CHAT_CONTEXTS['ticker'] / .fundamental)
    if (collected && collected.ticker) window._currentTickerId = collected.ticker;
    try { _renderFundHeader(collected); _renderFundSEC(collected); _renderFundFinancials(collected); _renderFundStatements(collected); _renderFundValuation(collected); if (typeof _renderFundMultiPeriod === 'function') _renderFundMultiPeriod(collected); _renderFundPeers(collected); _renderFundEarnings(collected); if (typeof _renderFundVariance === 'function') _renderFundVariance(collected); if (typeof _renderFundNews === 'function') _renderFundNews(collected); _renderFundSources(collected); } catch(e) { _aioLog('warn', 'fund', '캐시 렌더 실패: ' + e.message); }
    // v49.72 R138: 7 차트 캐시 즉시 렌더 (별도 cache는 _fmpQuarterlyCache 5분 TTL)
    try {
      if (window.AIO && typeof window.AIO.fetchQuarterlyFinancials === 'function') {
        window.AIO.fetchQuarterlyFinancials(ticker).then(function(qd){ _renderFundamentalFinancialsCharts(qd); }).catch(function(){});
      }
    } catch(_qchErr) {}
    if (loadingEl) {
      var _srcList = (collected.sources || []).map(function(s){ return escHtml(String(s || '')); });
      loadingEl.innerHTML = '<div style="font-size:11px;font-weight:700;color:#3ddba5;margin-bottom:6px;">캐시 데이터 (' + _ageMin + '분 전) — ' + _srcList.length + '개 소스</div><div style="font-size:11px;color:var(--text-muted);">' + _srcList.join(' · ') + '</div>';
    }
    // AI 채팅 입력창 세팅 (기존 동작 유지)
    var _chatInpC = document.getElementById('chat-fundamental-inp');
    if (_chatInpC) _chatInpC.value = ticker + ' 종합 기업 분석해줘. 17개 관점과 데이터 가용성 매트릭스 적용.';
    try {
      if (typeof window._aioRenderFundamentalRadar === 'function') {
        var _scrRowsC = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
        var _scrRowC = _scrRowsC.find(function(r){ return r.sym === ticker; }) || null;
        window._aioRenderFundamentalRadar(ticker, _scrRowC || null);
      }
    } catch(_) {}
    return;
  }

  // 수집 결과 저장용
  var collected = { ticker: ticker, sources: [], ts: new Date().toISOString() };
  var _fundDeadline = Date.now() + 8000;
  function _fundRemaining(cap) { return Math.max(0, Math.min(cap, _fundDeadline - Date.now())); }
  function updateProgress(msg) { if (progressEl) progressEl.innerHTML += '<div>' + escHtml(msg) + '</div>'; }
  function updateFail(msg) { if (progressEl) progressEl.innerHTML += '<div>' + escHtml(msg) + '</div>'; }

  // ─── 1~2. Yahoo + SEC를 병렬·유한 시간으로 수집 ───
  // 한 소스의 CORS/프록시 체인이 멈춰도 확보된 데이터로 8초 안에 결과 화면을 완성한다.
  if (progressEl) progressEl.innerHTML = '<div>Yahoo Finance 시세 · SEC 공시/재무 병렬 조회 중...</div>';
  var _primaryResults = await Promise.all([
    _withTimeout(dynamicTickerLookup(ticker), _fundRemaining(5200), null),
    _withTimeout(fetchSECFilings(ticker), _fundRemaining(5200), null),
    _withTimeout(fetchSECFinancials(ticker), _fundRemaining(5200), null)
  ]);
  var liveData = _primaryResults[0];
  var secFilings = _primaryResults[1];
  var secFin = _primaryResults[2];
  if (liveData && liveData.price) {
    collected.price = liveData.price;
    collected.pct = liveData.pct != null ? liveData.pct : null;
    collected.name = liveData.name || ticker;
    collected.volume = liveData.volume;
    collected.sources.push('Yahoo Finance (실시간 시세)');
    updateProgress('실시간 시세: $' + liveData.price.toFixed(2) + ' (' + _fmtPct(liveData.pct) + ')');
  } else { updateFail('Yahoo Finance 응답 없음 — 확보된 데이터로 계속'); }
  if (secFilings) {
    collected.sec = secFilings;
    collected.sources.push('SEC EDGAR (공시 정보)');
    updateProgress('SEC 공시: ' + (secFilings.name || ticker) + ' | CIK: ' + (secFilings.cik || 'N/A') + ' | SIC: ' + (secFilings.sicDescription || 'N/A'));
    if (!collected.name || collected.name === ticker) collected.name = secFilings.name || ticker;
  } else { updateFail('SEC 공시 시간 제한 — 부분 데이터로 분석'); }
  if (secFin) {
    var parsed = _parseSECFinancials(secFin);
    if (parsed) {
      collected.secFin = parsed;
      collected.sources.push('SEC EDGAR XBRL (재무제표 원본)');
      var revCount = (parsed.revenue || []).length;
      updateProgress('XBRL 재무데이터: ' + revCount + '개년 재무 파싱 완료');
    }
  } else { updateFail('SEC XBRL 시간 제한 — 재무 원문 없이 계속'); }

  // v48.5: SEC Frames 섹터 순위 prefetch — 최신 완료 분기의 Revenues/NetIncomeLoss 백분위 계산
  // 전 US-GAAP 보고 기업 대비 상대적 위치를 AI 프롬프트 품질 향상에 활용
  try {
    var _cik = collected.sec && collected.sec.cik;
    if (_cik) {
      // 최신 완료 분기 — 현재 날짜 기준 2분기 전 (최신 10-Q 제출 여유)
      var _now = new Date();
      var _year = _now.getFullYear();
      var _m = _now.getMonth() + 1;
      var _q = Math.ceil(_m / 3) - 1;  // 현재 분기 - 1
      if (_q <= 0) { _q = 4; _year -= 1; }
      var _period = 'CY' + _year + 'Q' + _q + 'I';
      updateProgress('SEC Frames 섹터 순위 조회 중 (' + _period + ')...');
      var _frameResults = await _withTimeout(Promise.all([
        fetchSECFrame('Revenues', _period),
        fetchSECFrame('NetIncomeLoss', _period)
      ]), _fundRemaining(1400), [null, null]);
      var _frameRev = _frameResults[0];
      var _frameNI = _frameResults[1];
      var _rankSummary = {};
      if (_frameRev) {
        var revRank = _secFrameRank(_frameRev, _cik);
        if (revRank && revRank.myVal != null) {
          _rankSummary.revenue = revRank;
          updateProgress('Revenues 섹터 순위: ' + _period + ' · ' + revRank.n + '개 기업 중 상위 ' + (100 - (revRank.pctile||0)).toFixed(0) + '%');
        }
      }
      if (_frameNI) {
        var niRank = _secFrameRank(_frameNI, _cik);
        if (niRank && niRank.myVal != null) _rankSummary.netIncome = niRank;
      }
      if (Object.keys(_rankSummary).length > 0) {
        collected.secFrameRank = _rankSummary;
        collected.sources.push('SEC Frames (섹터 백분위)');
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'SEC Frames 조회 실패: ' + e.message); }

  // ─── 3. FMP API 데이터 (키가 있을 때만) ───
  // v47.12: 18개 엔드포인트 순차 await → Promise.allSettled 병렬화
  //         기존: 16×~1.5s ≈ 24s / 변경: ~2~3s (~85% 단축, FMP rate limit 250/day는 동일 소모)
  var fmpKey = _getApiKey('aio_fmp_key') || '';
  if (fmpKey) {
    updateProgress('FMP 18개 엔드포인트 병렬 조회 중...');
    var fmpJobs = [
      { url: 'v3/profile/' + ticker, handler: function(r){ if(r&&r[0]){collected.fmpProfile=r[0]; collected.sources.push('FMP (기업 프로필)'); updateProgress('프로필: '+(r[0].companyName||'')+' | CEO: '+(r[0].ceo||'N/A')+' | 직원: '+(r[0].fullTimeEmployees||'N/A')+'명 | 섹터: '+(r[0].sector||''));} } },
      { url: 'v3/income-statement/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpIncome=r; collected.sources.push('FMP (손익계산서)'); updateProgress('손익계산서: '+r.length+'개년 데이터');} } },
      { url: 'v3/balance-sheet-statement/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpBalance=r; collected.sources.push('FMP (대차대조표)'); updateProgress('대차대조표: '+r.length+'개년 데이터');} } },
      { url: 'v3/cash-flow-statement/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpCashflow=r; collected.sources.push('FMP (현금흐름표)'); updateProgress('현금흐름표: '+r.length+'개년 데이터');} } },
      { url: 'v3/ratios/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpRatios=r; collected.sources.push('FMP (재무비율·Annual)'); updateProgress('재무비율: '+r.length+'개년 데이터');} } },
      { url: 'v3/key-metrics/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpMetrics=r; collected.sources.push('FMP (핵심 지표·Annual)'); updateProgress('핵심 지표: PE/PB/EV/EBITDA/ROE/ROIC 등');} } },
      { url: 'v3/ratios-ttm/' + ticker, handler: function(r){ if(r&&r[0]){collected.fmpRatiosTTM=r[0]; updateProgress('재무비율 TTM 데이터 수집 완료');} } },
      { url: 'v3/key-metrics-ttm/' + ticker, handler: function(r){ if(r&&r[0]){collected.fmpMetricsTTM=r[0]; updateProgress('핵심 지표 TTM 데이터 수집 완료');} } },
      { url: 'v4/stock_peers?symbol=' + ticker, handler: function(r){ if(r&&r[0]&&r[0].peersList){collected.peers=r[0].peersList; collected.sources.push('FMP (경쟁사)'); updateProgress('경쟁사 그룹: '+r[0].peersList.join(', '));} } },
      { url: 'v3/earnings-surprises/' + ticker, handler: function(r){ if(r&&r.length){collected.fmpSurprises=r.slice(0,8); collected.sources.push('FMP (실적 서프라이즈)'); updateProgress('실적 서프라이즈: 최근 '+Math.min(8,r.length)+'분기');} } },
      { url: 'v3/enterprise-values/' + ticker + '?limit=3', handler: function(r){ if(r&&r.length){collected.fmpEV=r; updateProgress('Enterprise Value 데이터');} } },
      { url: 'v3/key-executives/' + ticker, handler: function(r){ if(r&&r.length){collected.fmpExecutives=r.slice(0,10); collected.sources.push('FMP (경영진)'); updateProgress('경영진: '+r.length+'명 데이터');} } },
      { url: 'v4/insider-trading?symbol=' + ticker + '&limit=20', handler: function(r){ if(r&&r.length){collected.fmpInsiderTrades=r.slice(0,15); collected.sources.push('FMP (내부자 거래)'); updateProgress('내부자 거래: 최근 '+Math.min(15,r.length)+'건');} } },
      { url: 'v3/institutional-holder/' + ticker, handler: function(r){ if(r&&r.length){collected.fmpInstitutional=r.slice(0,15); collected.sources.push('FMP (기관 보유)'); updateProgress('기관 투자자: 상위 '+Math.min(15,r.length)+'개 기관');} } },
      { url: 'v3/analyst-estimates/' + ticker + '?limit=4', handler: function(r){ if(r&&r.length){collected.fmpEstimates=r; collected.sources.push('FMP (애널리스트 추정)'); updateProgress('애널리스트 추정: '+r.length+'개 분기 전망');} } },
      { url: 'v4/price-target-consensus?symbol=' + ticker, handler: function(r){ if(r&&r[0]){collected.fmpPriceTarget=r[0]; collected.sources.push('FMP (목표가)'); updateProgress('목표가 컨센서스: $'+(r[0].targetConsensus||'N/A'));} } },
      { url: 'v4/revenue-product-segmentation?symbol=' + ticker + '&structure=flat&period=annual', handler: function(r){ if(r&&r.length){collected.fmpRevSegment=r.slice(0,3); collected.sources.push('FMP (매출 세그먼트)'); updateProgress('매출 세그먼트: 제품별 분해');} } },
      { url: 'v4/revenue-geographic-segmentation?symbol=' + ticker + '&structure=flat', handler: function(r){ if(r&&r.length){collected.fmpRevGeo=r.slice(0,3); collected.sources.push('FMP (지역별 매출)'); updateProgress('지역별 매출 분해');} } },
      { url: 'v3/financial-growth/' + ticker + '?limit=5', handler: function(r){ if(r&&r.length){collected.fmpGrowth=r; collected.sources.push('FMP (성장률)'); updateProgress('재무 성장률: '+r.length+'개년');} } },
      { url: 'v3/discounted-cash-flow/' + ticker, handler: function(r){ if(r&&r[0]){collected.fmpDCF=r[0]; collected.sources.push('FMP (DCF)'); updateProgress('DCF 적정가: $'+(typeof r[0].dcf==='number'?r[0].dcf.toFixed(2):'N/A'));} } },
      { url: 'v4/short-interest?symbol=' + ticker, handler: function(r){ if(r&&r.length){collected.fmpShortInterest=r.slice(0,5); collected.sources.push('FMP (공매도)'); updateProgress('공매도: '+((r[0].shortPercentOfFloat||0)*100).toFixed(1)+'% of Float');} } }
    ];
    // v48.8: concurrency 6 제한 — 18개 완전 병렬은 CF Worker rate limit 300/min 스파이크 유발 가능
    //        (4명 동시 분석 시 18×4=72 req 순간 부하). 6개씩 청크로 분할하여 안정화.
    //        총 레이턴시는 약간 증가(3라운드 ~4.5s)하나 안정성 우선.
    var _fmpChunks = [];
    for (var _fi = 0; _fi < fmpJobs.length; _fi += 6) _fmpChunks.push(fmpJobs.slice(_fi, _fi + 6));
    for (var _fc = 0; _fc < _fmpChunks.length; _fc++) {
      var _fmpRemain = _fundRemaining(1400);
      if (_fmpRemain < 250) { updateFail('FMP 추가 데이터는 시간 예산 초과로 생략'); break; }
      await _withTimeout(Promise.allSettled(_fmpChunks[_fc].map(function(j){
        return _fmpFetch(j.url).then(j.handler).catch(function(e){ _aioLog('warn', 'fetch', 'FMP ' + j.url + ' error: ' + e.message); });
      })), _fmpRemain, []);
    }
  } else {
    updateFail('FMP API 키 미설정 — SEC EDGAR + Finnhub 무료 데이터로 분석 진행');
  }

  // v48.1: Finnhub 무료 티어 통합 — FMP 미구독 사용자에게 유사 품질 보강
  //   /stock/metric (PE/PB/ROE/52W/beta/epsTTM/margin 통합)
  //   /stock/recommendation (애널리스트 buy/hold/sell)
  //   /calendar/earnings (다음 분기 어닝 일정)
  // FMP 키가 있어도 fmpMetricsTTM/fmpPriceTarget에 누락된 필드(beta/52W 등)가 있을 수 있으므로 보조 주입
  var _finnhubKey = _getApiKey('aio_finnhub_key') || '';
  if (_finnhubKey) {
    updateProgress('Finnhub 무료 보조 데이터 조회 중...');
    try {
      var _fhRemain = _fundRemaining(1200);
      if (_fhRemain < 250) throw new Error('전체 분석 시간 예산 초과');
      var _today = new Date().toISOString().slice(0,10);
      var _90d = new Date(Date.now() + 90*86400000).toISOString().slice(0,10);
      var _fhResults = await _withTimeout(Promise.allSettled([
        fetchFinnhubMetrics(ticker),
        fetchFinnhubRecommendation(ticker),
        fetchFinnhubEarningsCalendar(_today, _90d, ticker),
        fetchFinnhubCompanyNews(ticker, 14)  // v48.13: 최근 14일 기업 뉴스
      ]), _fhRemain, []);
      if (_fhResults[0].status === 'fulfilled' && _fhResults[0].value) {
        collected.finnhubMetrics = _fhResults[0].value;
        collected.sources.push('Finnhub (무료 밸류에이션)');
        var _fm = _fhResults[0].value;
        var _bits = [];
        if (_fm.peBasicExclExtraTTM != null) _bits.push('PE ' + Number(_fm.peBasicExclExtraTTM).toFixed(1));
        if (_fm['52WeekHigh'] != null) _bits.push('52W고 $' + Number(_fm['52WeekHigh']).toFixed(2));
        if (_fm['52WeekLow'] != null) _bits.push('52W저 $' + Number(_fm['52WeekLow']).toFixed(2));
        if (_fm.beta != null) _bits.push('β ' + Number(_fm.beta).toFixed(2));
        if (_bits.length > 0) updateProgress('Finnhub 지표: ' + _bits.join(' | '));
      }
      if (_fhResults[1].status === 'fulfilled' && _fhResults[1].value) {
        collected.finnhubRecommendation = _fhResults[1].value;
        collected.sources.push('Finnhub (애널리스트)');
        var _fr = _fhResults[1].value;
        updateProgress('애널리스트 추천: strongBuy ' + (_fr.strongBuy||0) + ' / buy ' + (_fr.buy||0) + ' / hold ' + (_fr.hold||0) + ' / sell ' + (_fr.sell||0) + ' / strongSell ' + (_fr.strongSell||0));
      }
      if (_fhResults[2].status === 'fulfilled' && _fhResults[2].value && _fhResults[2].value.length > 0) {
        collected.finnhubEarnings = _fhResults[2].value.slice(0, 5);
        collected.sources.push('Finnhub (어닝 일정)');
        updateProgress('어닝 일정: ' + collected.finnhubEarnings.length + '건 (향후 90일)');
      }
      // v48.13: 기업 뉴스 (최근 14일)
      if (_fhResults[3] && _fhResults[3].status === 'fulfilled' && _fhResults[3].value && _fhResults[3].value.length > 0) {
        collected.finnhubNews = _fhResults[3].value;
        collected.sources.push('Finnhub (기업 뉴스)');
        updateProgress('기업 뉴스: ' + collected.finnhubNews.length + '건 (최근 14일)');
      }
    } catch(e) { _aioLog('warn', 'fetch', 'Finnhub 보조 조회 실패: ' + e.message); }
  }

  // ─── 데이터 수집 완료 ───
  if (loadingEl) {
    var _progressHtml = progressEl ? progressEl.innerHTML : '';
    var loadHtml = '';
    if (collected.sources.length) {
      loadHtml = '<div style="font-size:11px;font-weight:700;color:#3ddba5;margin-bottom:6px;">데이터 수집 완료 — ' + collected.sources.length + '개 소스</div>';
      loadHtml += '<div style="font-size:11px;color:var(--text-muted);">' + collected.sources.join(' · ') + '</div>';
      if (_progressHtml) loadHtml += '<details style="margin-top:8px;"><summary style="font-size:10px;color:var(--text-muted);cursor:pointer;">수집 과정 보기</summary><div id="fund-rpt-progress" style="font-size:10px;color:var(--text-secondary);line-height:1.8;margin-top:5px;">' + _progressHtml + '</div></details>';
    } else {
      loadHtml = '<div style="font-size:11px;font-weight:700;color:var(--data-amber);margin-bottom:6px;">외부 데이터 수신 실패 — 빈 보고서로 단정하지 않습니다</div>';
      loadHtml += '<div style="font-size:11px;color:var(--text-secondary);line-height:1.65;margin-bottom:6px;">네트워크·공급자 응답을 확인한 뒤 다시 시도하세요. 확보된 데이터가 없어 현재 분석은 참고용으로도 생성하지 않습니다.</div>';
      loadHtml += '<div id="fund-rpt-progress" style="font-size:10px;color:var(--text-secondary);line-height:1.8;">' + _progressHtml + '</div>';
    }
    loadingEl.innerHTML = loadHtml;
  }

  // v46.4: FMP 데이터 검증 레이어 — 잘못된 데이터 감지 + AI에 경고 주입
  _validateFMPData(collected);

  // 글로벌에 저장 (LLM 프롬프트 주입용)
  window._fundAnalysisData = collected;
  // v49.58 R106: 채팅 컨텍스트가 활성 종목 자동 인지 (CHAT_CONTEXTS['ticker'] / .fundamental)
  if (collected && collected.ticker) window._currentTickerId = collected.ticker;
  // v48.8: 세션 캐시 저장 (30분 TTL) — 같은 티커 재검색 시 FMP 18 req 절약
  try {
    window._fundCache[ticker] = { data: collected, _ts: Date.now() };
    // 캐시 상한 10개 (LRU) — 메모리 보호
    var _cacheKeys = Object.keys(window._fundCache);
    if (_cacheKeys.length > 10) {
      _cacheKeys.sort(function(a,b){ return (window._fundCache[a]._ts||0) - (window._fundCache[b]._ts||0); });
      for (var _i = 0; _i < _cacheKeys.length - 10; _i++) delete window._fundCache[_cacheKeys[_i]];
    }
  } catch(e) {}

  // ─── UI 렌더링 ───
  _renderFundHeader(collected);
  if (typeof _renderFundQualitative === 'function') _renderFundQualitative(collected);
  _renderFundSEC(collected);
  _renderFundFinancials(collected);
  _renderFundStatements(collected);
  _renderFundValuation(collected);
  if (typeof _renderFundMultiPeriod === 'function') _renderFundMultiPeriod(collected);  // v48.89
  _renderFundPeers(collected);
  _renderFundEarnings(collected);
  if (typeof _renderFundVariance === 'function') _renderFundVariance(collected);    // v48.90
  if (typeof _renderFundNews === 'function') _renderFundNews(collected);            // v48.13
  _renderFundSources(collected);
  try {
    if (typeof window._aioRenderFundamentalRadar === 'function') {
      var _scrRows = typeof _aioGetCanonicalScreenerRows === 'function' ? _aioGetCanonicalScreenerRows() : [];
      var _scrRow = _scrRows.find(function(r){ return r.sym === ticker; }) || null;
      window._aioRenderFundamentalRadar(ticker, _scrRow || null);
    }
  } catch(_) {}

  // v49.72 R138: 7 차트 fundamental UI 자동 렌더 (FMP/Naver 5년 분기 데이터, 5분 캐시)
  try {
    if (window.AIO && typeof window.AIO.fetchQuarterlyFinancials === 'function') {
      var _qChartCard = document.getElementById('fund-rpt-fincharts');
      if (_qChartCard) {
        // 로딩 placeholder (R115: "수신 대기")
        var _qMeta = document.getElementById('fund-fin-meta');
        if (_qMeta) _qMeta.textContent = '분기 재무 수신 대기 (' + ticker + ')';
        _qChartCard.style.display = 'block';
      }
      window.AIO.fetchQuarterlyFinancials(ticker).then(function(qd){
        try { _renderFundamentalFinancialsCharts(qd); } catch(_rErr) { _aioLog('warn', 'fund', '7 차트 렌더 실패: ' + (_rErr && _rErr.message || _rErr)); }
      }).catch(function(){
        try { _renderFundamentalFinancialsCharts({ available: false, dataSource: 'fetch-error', reason: 'fetch 실패 (5초 timeout 또는 네트워크)', ticker: ticker }); } catch(_) {}
      });
    }
  } catch(_qFinErr) { _aioLog('warn', 'fund', '7 차트 fetch 진입 실패: ' + (_qFinErr && _qFinErr.message || _qFinErr)); }

  // ─── LLM에 실제 데이터 전달하여 종합 분석 요청 ───
  var _fundPrompt = ticker + ' 종합 기업 분석해줘. 아래 17개 관점과 데이터 가용성 매트릭스를 모두 다뤄줘:\n1)기업 개요 2)설립 배경&성장 과정 3)경영진 분석 4)비즈니스 모델 5)제품 포트폴리오 6)기술력&해자 7)수익 구조 8)재무제표 분석 9)밸류에이션 10)시장 분석(TAM) 11)수요·공급망 12)파트너십 13)경쟁 구조 14)리스크 15)촉매·실적수정 16)포트폴리오 적합성 17)투자 포인트';
  var chatInp = document.getElementById('chat-fundamental-inp');
  if (chatInp) {
    // per-page 채팅 패널이 있으면 자동 전송 (현재 per-page는 home만, fundamental은 통합 패널 사용)
    chatInp.value = _fundPrompt;
    chatSend('fundamental');
  } else {
    // v50.22 P497: fundamental은 통합 AI 패널(ai-panel-inp) 사용 — 존재하지 않는 chat-fundamental-inp로의
    // 무조건 자동 전송(매 검색마다 "DOM input missing" 에러 + 공유 Claude 쿼터 자동 소진) 제거.
    // 통합 입력창에 분석 프롬프트만 프리필 → 사용자 opt-in 전송. 수집 데이터는 window._fundAnalysisData/_currentTickerId에 보존.
    var _uInp = document.getElementById('ai-panel-inp');
    if (_uInp && !_uInp.value.trim()) _uInp.value = _fundPrompt;
  }
}

// ── 기업분석 렌더러 — aio-ui.js로 이동됨 (v51.17). window.* 전역 alias ──
var _renderFundHeader = window._renderFundHeader;
var _renderFundSEC = window._renderFundSEC;
var _renderFundFinancials = window._renderFundFinancials;
var _renderFundamentalFinancialsCharts = window._renderFundamentalFinancialsCharts;
var _renderFundStatements = window._renderFundStatements;
var _renderFundValuation = window._renderFundValuation;
var _renderFundPeers = window._renderFundPeers;
var _renderFundEarnings = window._renderFundEarnings;
var _renderFundNews = window._renderFundNews;
var _renderFundSources = window._renderFundSources;
var _renderFundMultiPeriod = window._renderFundMultiPeriod;
var _renderFundVariance = window._renderFundVariance;
