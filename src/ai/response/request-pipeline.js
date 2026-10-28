// Legacy unification (2026-10-27, roadmap item 11, layer 1 채팅): the public AI request and response pipeline moved here
// unchanged from js/aio-chat.js, so news translation (js/aio-data.js autoTranslateNews) no longer needs the chat file.
// It covers the request object and its per-request stream, the research gate, the claim evidence binding, the answer
// plan publication, the action gate and the disclosure. The window names are the ones the classic scripts already
// call; installCompatibilityGlobals installs them. The disclosure box takes the lch-disc class (src/ has no inline
// styles); its look is unchanged.

export function installAIRequestPipeline(window = globalThis, document = globalThis.document) {
  // v52.75/WP-AI0: public AI contract. This is intentionally shared by the
  // embedded and unified chat surfaces so a retry or alternate entry point
  // cannot silently bypass the public beta disclosure/action gate.
  var _AIO_PUBLIC_AI_POLICY = {
    label: 'AI 도우미, 교육/리서치 보조',
    status: 'beta-research',
    actionGate: 'read-only-conditional-analysis'
  };

  // v52.76/WP-AI1: all public AI entry points share one request/response
  // envelope. The envelope records provenance for the pipeline; the actual
  // action validator remains _aioApplyAIActionGate so there is no parallel gate.
  var _AIO_AI_PIPELINE_VERSION = 'wp-ai1.v1';
  var _AIO_AI_VALIDATOR_VERSION = 'wp-ai0.action-gate.v1';
  var _AIO_AI_BLOCK_POLICY_VERSION = 'read-only-conditional-analysis.v2';

  function _aioCreateAIRequestObject(entrypoint, meta) {
    meta = meta || {};
    var stamp = Date.now();
    var entropy = Math.random().toString(36).slice(2, 8);
    var requestId = 'aio-ai-' + stamp + '-' + entropy;
    var conversation = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.createAIConversationState === 'function')
      ? window.AIO.createAIConversationState({ sessionId: meta.sessionId, route: meta.route || meta.ctxId, ctxId: meta.ctxId, entityKey: meta.entityKey }) : null;
    if (conversation && window.AIO && typeof window.AIO.beginAIConversationTurn === 'function') conversation = window.AIO.beginAIConversationTurn(conversation, { requestId: requestId, route: meta.route || meta.ctxId, entityKey: meta.entityKey });
    var idempotencyKey = meta.idempotencyKey || requestId;
    var questionPlan = meta.questionPlan || null;
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
      sampling: meta.sampling || null,
      questionPlan: questionPlan
    };
    if (window.AIO && typeof window.AIO.beginAIIdempotentRequest === 'function') window.AIO.beginAIIdempotentRequest(idempotencyKey, { requestId: requestId });
    return request;
  }

  // P1245 (05 A05): 수집된 native citation과 research tool 오류는 **그것을 만든 스트림의 요청**에 속한다.
  // 종전에는 단일 전역(`_aioLastClaudeCitations`·`_aioLastClaudeResearchError`)에 저장되고 모든 스트림이
  // 시작 시 리셋했으며, request id도 `_aioActiveAIRequestId`라는 전역을 응답 파이프라인이 쓰고 수집기가
  // 읽었다. 그래서 ① 두 요청이 겹치면(per-page + unified, 또는 재시도) 한 스트림이 다른 스트림의 인용을
  // 지우고, ② 수집 시점의 전역은 아직 이 요청으로 설정되지 않아 직전 요청의 id가 찍혔고, ③ onDone의
  // evidence floor가 그 전역을 *기대값*으로 읽어 다른 질문의 출처를 이 답변의 검증된 근거로 승격할 수
  // 있었다. 요청 id별 저장소로 바꾸고, 스트림은 시작 시 받은 불변 id만 사용한다.
  var _AIO_AI_REQUEST_STREAM_LIMIT = 8;
  function _aioAIRequestStream(requestId) {
    if (typeof window === 'undefined' || !requestId) return null;
    var key = String(requestId);
    var store = window._aioAIRequestStreams = window._aioAIRequestStreams || {};
    var order = window._aioAIRequestStreamOrder = window._aioAIRequestStreamOrder || [];
    var record = store[key];
    if (!record) {
      record = store[key] = { requestId: key, citations: [], researchError: null, startedAt: new Date().toISOString() };
      order.push(key);
      while (order.length > _AIO_AI_REQUEST_STREAM_LIMIT) {
        var stale = order[0];
        if (stale === key) break;
        order.shift();
        delete store[stale];
      }
    }
    return record;
  }
  function _aioAIRequestCitations(requestId) {
    if (!requestId || typeof window === 'undefined' || !window._aioAIRequestStreams) return [];
    var record = window._aioAIRequestStreams[String(requestId)];
    return record && Array.isArray(record.citations) ? record.citations : [];
  }
  function _aioAIRequestResearchError(requestId) {
    if (!requestId || typeof window === 'undefined' || !window._aioAIRequestStreams) return null;
    var record = window._aioAIRequestStreams[String(requestId)];
    return record ? record.researchError : null;
  }
  function _aioLatestAIRequestStream() {
    var order = typeof window !== 'undefined' ? window._aioAIRequestStreamOrder : null;
    if (!Array.isArray(order) || !order.length) return null;
    return _aioAIRequestStream(order[order.length - 1]);
  }

  // P897: the ESM evidence module is the only producer/consumer contract for
  // both chat surfaces. If bootstrap has not exposed it, fail closed instead of
  // keeping a second legacy implementation that can drift again.
  function _aioEvaluateAIResearchGate(input) {
    input = input || {};
    // P1172 (05 A05): 이 요청의 id를 함께 넘겨 출처 결속을 판정 가능하게 한다. questionPlan.queryId와
    // chat 요청 id는 서로 다른 이름공간이므로 둘 다 기대값으로 넘긴다(없으면 UNVERIFIABLE로 남는다).
    // P1245: 여기서 공유 전역(`_aioActiveAIRequestId`)으로 기대값을 채우지 않는다. 그 전역은 응답
    // 파이프라인이 쓰고 수집기가 읽어 동시 요청에서 다른 요청의 id가 이 요청의 기대값으로 둔갑했다.
    // 호출자가 자기 id를 말하지 않으면 UNVERIFIABLE로 남는 것이 맞다 — 모르는 것을 아는 것처럼 채우지 않는다.
    if (window.AIO_ARCH && typeof window.AIO_ARCH.evaluateAIResearchEvidenceFloor === 'function') {
      return window.AIO_ARCH.evaluateAIResearchEvidenceFloor(input);
    }
    var decision = input.questionPlan && input.questionPlan.researchDecision || {};
    var required = input.required === true || decision.requirement === 'REQUIRED';
    return required
      ? { required: true, ready: false, reason: 'research-contract-unavailable', evidenceDocuments: [], citationCount: 0, independentSourceCount: 0, primarySourceCount: 0, currentClaimsAllowed: false, source: 'none' }
      : { required: false, ready: true, reason: 'research-not-required', evidenceDocuments: [], source: 'none' };
  }

  if (typeof window !== 'undefined') {
    var _researchGateDescriptor = Object.getOwnPropertyDescriptor(window, '_aioEvaluateAIResearchGate');
    if (!_researchGateDescriptor || _researchGateDescriptor.configurable) {
      Object.defineProperty(window, '_aioEvaluateAIResearchGate', { value: _aioEvaluateAIResearchGate, configurable: true });
    }
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

  function _aioAIClaimEvidenceId(row) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.claimEvidenceId(row) : '';
  }

  function _aioAIClaimEvidenceTuple(row) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.claimEvidenceTuple(row) : '';
  }

  function _aioCollectAIClaimEvidence(meta) {
    meta = meta || {};
    var collected = [];
    function addRows(rows) {
      (Array.isArray(rows) ? rows : []).forEach(function(row) {
        if (!row || typeof row !== 'object') return;
        var isDocument = !!row.documentId;
        var normalized = (!isDocument && window.AIO && typeof window.AIO.normalizeAIChatEvidenceRow === 'function')
          ? window.AIO.normalizeAIChatEvidenceRow(row) : Object.assign({}, row);
        var evidenceId = _aioAIClaimEvidenceId(normalized);
        if (!evidenceId) return;
        if (isDocument) {
          normalized = Object.assign({}, normalized, {
            evidenceId: evidenceId,
            metric: normalized.metric || 'research-document',
            value: normalized.value == null ? null : normalized.value,
            unit: normalized.unit || 'document',
            asOf: normalized.asOf || normalized.publishedAt || normalized.retrievedAt || null,
            source: normalized.source || normalized.publisher || normalized.canonicalUrl || 'web-research',
            sourceKind: normalized.sourceKind || 'REFERENCE',
            status: normalized.status || 'reference'
          });
        }
        collected.push(normalized);
      });
    }
    addRows(meta.evidence); addRows(typeof window._aioScreenBasisEvidence === 'function' ? window._aioScreenBasisEvidence() : []); // v57.48 #7: completed-close reference rows on every surface
    addRows(meta.provenanceBundle && meta.provenanceBundle.rows);
    addRows(meta.chatEvidence && meta.chatEvidence.tickers);
    addRows(meta.researchResult && meta.researchResult.researchEvidence && meta.researchResult.researchEvidence.evidenceDocuments);
    addRows(meta.researchGate && meta.researchGate.evidenceDocuments);
    var byId = new Map();
    var tuples = new Map();
    var conflicts = new Set();
    collected.forEach(function(row) {
      var id = _aioAIClaimEvidenceId(row);
      if (!id) return;
      var tuple = _aioAIClaimEvidenceTuple(row);
      if (!byId.has(id)) {
        byId.set(id, row);
        tuples.set(id, tuple);
        return;
      }
      if (!conflicts.has(id) && tuples.get(id) !== tuple) {
        byId.set(id, Object.assign({}, byId.get(id), {
          status: 'conflict',
          truthStatus: 'conflict',
          crossSourceStatus: 'conflict',
          conflict: true
        }));
        conflicts.add(id);
      }
    });
    return Array.from(byId.values());
  }
  function _aioEvidenceCanPublish(row) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.evidenceCanPublish(row) : false;
  }

  function _aioHasCurrentNumericContent(value) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.hasCurrentNumericContent(value) : true;
  }

  // v58.77: the "웹검색 중" status line turns into what happened once the answer (or its failure) arrives.
  function _aioSettleWebSearchStatus(text) {
    var lines = document.querySelectorAll('#ai-panel-msgs .ai-websearch-status:not([data-settled])');
    var line = lines[lines.length - 1];
    if (line) { line.textContent = text; line.dataset.settled = '1'; }
  }

  function _aioExtractAIAnswerFallback(rawText, currentSensitive, options) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.extractAnswerFallback(rawText, currentSensitive, options) : '';
  }

  function _aioBuildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive) {
    var publication = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication;
    return publication ? publication.buildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive) : { plan: null, droppedClaims: plan ? [{ claimId: null, reasons: ['publication-unavailable'] }] : [], unboundEvidenceIds: [] };
  }

  function _aioRunAIResponsePipeline(rawText, meta) {
    meta = meta || {};
    var request = meta.request || _aioCreateAIRequestObject(meta.entrypoint, meta);
    var questionPlan = meta.questionPlan || request.questionPlan || null;
    var currentSensitive = meta.currentSensitive === true || !!(questionPlan && questionPlan.currentSensitive === true);
    var researchRequired = meta.researchRequired === true || !!(questionPlan && questionPlan.researchDecision && questionPlan.researchDecision.requirement === 'REQUIRED');
    var isPartialStream = meta.streamPhase === 'partial';
    var raw = String(rawText == null ? '' : rawText);
    var answerPlanAudit = (typeof window !== 'undefined' && window.AIO_ARCH && typeof window.AIO_ARCH.parseAIAnswerPlan === 'function')
      ? window.AIO_ARCH.parseAIAnswerPlan(raw, { questionPlan: questionPlan, currentSensitive: currentSensitive })
      : { status: 'unavailable', plan: null, audit: { ok: false, errors: ['orchestrator-unavailable'] } };
    var bindingEvidence = _aioCollectAIClaimEvidence(meta);
    var bindingIds = new Set(bindingEvidence.filter(_aioEvidenceCanPublish).map(_aioAIClaimEvidenceId));
    var publishablePlan = _aioBuildPublishableAnswerPlan(answerPlanAudit.plan, bindingEvidence, currentSensitive);
    var answerPlanBindingAudit = {
      ok: publishablePlan.droppedClaims.length === 0,
      evidenceCount: bindingIds.size,
      unboundEvidenceIds: publishablePlan.unboundEvidenceIds,
      droppedClaims: publishablePlan.droppedClaims
    };
    // Structured control JSON is never exposed while streaming. At completion,
    // render every safe part and drop only invalid/unbound claims.
    var visible = '';
    if (publishablePlan.plan && window.AIO_ARCH && typeof window.AIO_ARCH.renderAIAnswerPlan === 'function') {
      visible = window.AIO_ARCH.renderAIAnswerPlan(publishablePlan.plan, { format: 'text' });
    } else if (isPartialStream) {
      visible = 'AI 답변을 구성하고 근거를 검증하는 중…';
    } else {
      visible = _aioExtractAIAnswerFallback(raw, currentSensitive, { evidenceCount: bindingIds.size, evidenceRows: bindingEvidence.filter(_aioEvidenceCanPublish) });
    }
    if (!visible && !isPartialStream) visible = '답변 형식이 완성되지 않아 검증 가능한 문장을 복구하지 못했습니다. 같은 질문을 다시 보내면 간결한 형식으로 재시도합니다.';
    if (meta.stripChips !== false && typeof stripChips === 'function') visible = stripChips(visible);
    var gate = (typeof _aioApplyAIActionGate === 'function')
      ? _aioApplyAIActionGate(visible, meta)
      : { blocked: true, text: 'AI 도우미 안전 모드\n\n공통 안전 검증을 사용할 수 없어 답변을 표시하지 않습니다.', reasons: ['validator-unavailable'] };
    var claimAudit = publishablePlan.plan
      ? { status: publishablePlan.droppedClaims.length ? 'partial' : 'pass', blocked: false, claims: publishablePlan.plan.claims.claims, validCount: publishablePlan.plan.claims.claims.length, issues: publishablePlan.droppedClaims, source: 'answer-plan.v1' }
      : (typeof window !== 'undefined' && window.AIO && typeof window.AIO.validateAIResponseClaims === 'function')
      ? window.AIO.validateAIResponseClaims(raw, {
        evidence: bindingEvidence,
        currentSensitive: currentSensitive
      })
       : { status: 'unavailable', blocked: false, claims: [], validCount: 0, issues: [] };
    var conductAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.evaluateAIActionPermission === 'function')
      ? window.AIO.evaluateAIActionPermission({
        query: meta.query || (request && request.query) || '',
        text: visible,
        ctxId: meta.ctxId || (request && request.ctxId) || '',
        evidence: bindingEvidence,
        suitabilityProfile: meta.suitabilityProfile || null,
        calibrated: meta.calibrated === true
      })
      : { status: 'unavailable', blocked: false, reasons: [] };
    var publishAudit = (typeof window !== 'undefined' && window.AIO && typeof window.AIO.validateAIAutomatedPublish === 'function' && /^(?:auto-|market-analysis)/.test(String(meta.entrypoint || request.entrypoint || '')))
      ? window.AIO.validateAIAutomatedPublish({
        entrypoint: meta.entrypoint || request.entrypoint,
        text: visible,
        evidence: meta.evidence || [],
         currentSensitive: currentSensitive,
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
          ? window.AIO.buildDeterministicEvidenceSummary(bindingEvidence, { label: 'Automated publish fallback' })
          : '자동 생성 결과를 검증할 수 없어 결정론적 근거 요약으로 대체합니다.',
        reasons: (gate.reasons || []).concat(publishAudit.issues || ['automated-publish-gate'])
      };
    }
    // P1120: a typed-claim mismatch used to replace the whole answer with a refusal. The
    // answer-plan renderer already drops unbound claims, so the recoverable prose is kept and
    // the dropped numeric scope is disclosed instead of the entire answer being withheld.
    var claimAuditBlocked = claimAudit.blocked === true;
    // v57.48 #19: each limitation keeps its detailed Korean note for the folded answer-evidence panel; the answer itself
    // opens with one Korean line (answerPublication.summarizeAnswerLimitations) instead of a stack of "※" notices.
    var limitationNotes = [];
    function applyLimitation(reason, notice) {
      if (gate.blocked === true) return;
      var existing = Array.isArray(gate.limitations) ? gate.limitations : [];
      if (existing.indexOf(reason) >= 0) return;
      limitationNotes.push(String(notice).replace(/^※\s*/, ''));
      gate = Object.assign({}, gate, { blocked: false, degraded: true, reasons: (gate.reasons || []).concat([reason]), limitations: existing.concat([reason]) });
    }
    // P1120: the personalized-action and typed-claim boundaries are disclosures now, not
    // refusals. The answer is kept; the scope that could not be verified is named.
    var conductLimitations = Array.isArray(conductAudit && conductAudit.limitations) ? conductAudit.limitations : [];
    if (!isPartialStream && conductLimitations.indexOf('suitability-context-missing') >= 0) {
      applyLimitation('suitability-context-missing', '투자 성향·적합성 정보가 없어 개인화된 매수·매도·비중 지시가 아니라 조건부 분석으로 표시합니다.');
    }
    if (!isPartialStream && conductLimitations.indexOf('current-evidence-limited') >= 0) {
      applyLimitation('current-evidence-limited', '현재 결정용 근거(1차 출처·현재 시각·허용 지연 이내)가 부족합니다. 아래 내용은 참고·조건부 분석이며 실행 지시가 아닙니다.');
    }
    if (!isPartialStream && claimAuditBlocked) {
      applyLimitation('typed-claim-validation', '출처와 대조되지 않은 수치 주장은 제외했습니다. 표시된 설명은 근거가 확인된 범위입니다.');
    }
    // Current-data gaps degrade only the affected claim scope. They must not
    // erase educational, legal/tax, or conditional analysis that remains useful.
    var sessionEvidence = questionPlan && questionPlan.sessionEvidence;
    var publishedClaims = publishablePlan.plan ? publishablePlan.plan.claims.claims : [];
    var sessionReady = !!(sessionEvidence && sessionEvidence.verified === true && sessionEvidence.observedAt && /^(open|closed|pre|post)$/.test(sessionEvidence.status));
    // v57.48 #7: completed closes do not depend on the live session, so an answer whose values all bind to close-basis rows needs no session notice.
    if (!isPartialStream && currentSensitive && !sessionReady && !(publishedClaims.length && publishedClaims.every(function(claim) { return claim.source === 'close-basis'; }))) {
      applyLimitation('market-session-evidence-unavailable', '시장 세션 근거 미수신: 장중·장외 상태와 최신 수치는 확인 보류하며, 아래 내용은 확인된 기존 근거와 조건부 분석 범위입니다.');
    }
    if (!isPartialStream && publishablePlan.droppedClaims.length) applyLimitation('answer-plan-claim-degraded', '출처나 관측 시각을 확인할 수 없는 주장은 제외했습니다. 확인 가능한 설명을 아래에 제공합니다.');
    if (!isPartialStream && currentSensitive && _aioHasCurrentNumericContent(raw) && answerPlanAudit.status !== 'valid') {
      applyLimitation('current-numeric-claim-unverified', '최신 수치의 근거를 확인하지 못했습니다. 숫자를 활용하기 전에 관측 시각과 원문을 확인하세요.');
    } else if (!isPartialStream && gate.blocked !== true && claimAudit && claimAudit.status === 'not-structured' && /(현재|지금|오늘|현시점|방금|as of)/i.test(visible) && /\d/.test(visible)) {
      limitationNotes.push('이 답변의 수치는 자동 검증되지 않았습니다. 관측 시각과 원문을 직접 확인하세요.');
      gate = Object.assign({}, gate, { unverifiedNumericNotice: true });
    }
    if (!isPartialStream && researchRequired && (!meta.researchGate || meta.researchGate.ready !== true)) {
      applyLimitation('research-evidence-unavailable', '웹 검색 근거 미수신: 최신 사실·수치·원인 단정은 확인 보류합니다. 아래 답변은 주입된 데이터, 기존 검증 근거와 일반 원리에 기반한 조건부 분석입니다.');
    }
    if (!isPartialStream && researchRequired && meta.researchGate?.ready === true && meta.researchGate.currentClaimsAllowed !== true) {
      applyLimitation('research-freshness-unverified', '검색 출처를 바탕으로 설명합니다. 자료의 발행·사건 시점을 확인하지 못한 부분은 최신 사실로 확정하지 않았습니다.');
    }
    if (!isPartialStream && meta.completion && meta.completion.truncated === true) {
      applyLimitation('model-output-truncated', '응답 길이 한도 도달: 완결되지 않은 구조에서 복구 가능한 설명만 표시했습니다. 누락된 항목은 후속 질문으로 나눠 확인하세요.');
    }
    var premiseState = questionPlan && questionPlan.premise;
    var premiseStatus = String(premiseState && premiseState.status || '').toUpperCase();
    if (!isPartialStream && premiseState && Array.isArray(premiseState.assertions) && premiseState.assertions.length &&
        ['CONTRADICTED', 'CONFLICT', 'UNVERIFIED'].indexOf(premiseStatus) >= 0) {
      var premiseNotice = premiseStatus === 'CONTRADICTED' ? '질문의 전제와 반대인 관측이 확인되었습니다. 전제를 사실로 단정하지 않고 조건부로 설명합니다.'
        : premiseStatus === 'CONFLICT' ? '질문의 전제를 판정하는 관측이 서로 충돌합니다. 전제를 확인되지 않은 상태로 두고 조건부로 설명합니다.' : '질문의 전제를 확인할 근거가 부족합니다. 전제를 확인되지 않은 상태로 두고 조건부로 설명합니다.';
      applyLimitation('premise-' + premiseStatus.toLowerCase(), premiseNotice);
    }
    if (limitationNotes.length && gate.blocked !== true) {
      var limitationSummary = window.AIO_ARCH && typeof window.AIO_ARCH.getAIOrchestrator === 'function' && window.AIO_ARCH.getAIOrchestrator()?.answerPublication?.summarizeAnswerLimitations;
      var limitationLine = (limitationSummary ? limitationSummary((gate.limitations || []).concat(gate.unverifiedNumericNotice ? ['current-numeric-claim-unverified'] : []), { publishedClaimCount: publishedClaims.length }) : '') || '※ 확인 안 된 부분이 있어 조건부로 설명합니다';
      gate = Object.assign({}, gate, { text: limitationLine + '\n\n' + gate.text, limitationNotes: limitationNotes });
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
      limitations: gate.limitations || [], limitationNotes: gate.limitationNotes || [], closeBasisDates: publishedClaims.filter(function(claim) { return claim && claim.source === 'close-basis' && claim.asOf; }).map(function(claim) { return String(claim.asOf).slice(0, 10); }).sort(), // review: only published close-basis claims label the answer
      otherPublishedClaims: publishedClaims.filter(function(claim) { return claim && claim.source !== 'close-basis' && typeof claim.value === 'number'; }).length, // QA-VERIFY-16: numbers that are not closes
      actionGate: gate,
      claimAudit: claimAudit,
      conductAudit: conductAudit,
      publishAudit: publishAudit,
      conversationAudit: conversationAudit,
      streamAudit: streamAudit,
      toolAudit: toolAudit,
      rightsAudit: rightsAudit,
      analysisAudit: meta.analysisAudit || null,
      evidence: bindingEvidence,
      evidenceStatus: meta.evidenceStatus || null,
      asOf: meta.asOf || null,
      retrievalAudit: meta.retrievalAudit || null,
      contextBudgetAudit: meta.contextBudgetAudit || null,
      questionPlan: questionPlan,
      answerPlanAudit: answerPlanAudit,
      answerPlanBindingAudit: answerPlanBindingAudit,
      followUps: answerPlanAudit.status === 'valid' ? (answerPlanAudit.plan.followUps || []) : [],
      citations: answerPlanAudit.status === 'valid' ? (answerPlanAudit.plan.citations || []) : []
    };
    if (meta.record !== false) _aioRecordAIResponseManifest(result);
    return result;
  }

  function _aioPublicAIActionPolicyPrompt() {
    return '\n\n【공개 AI 도우미 분석·행동 경계 — 최우선】\n' +
      '이 AI는 "AI 도우미, 교육/리서치 보조"이며 독립 투자자문·검증 시스템·실시간 주문 도구가 아니다.\n' +
      '교육·시장 원리·상품 구조·규제 영향·법률/세무의 일반 또는 사용자 맥락 분석을 회피하지 마라. 관할·사실관계가 부족하면 합리적 전제를 밝히고 공식 원문·기준일·추가 확인 항목을 제시하라.\n' +
      '가격 범위·무효화 수준·손절 기준·포트폴리오 비중은 시나리오와 계산 입력으로 분석할 수 있다. 다만 "매수하세요"·"매도를 추천"·"비중 N% 확대"처럼 특정 종목에 대한 행동 지시 문장은 쓰지 말고(쓰면 화면에서 문장이 대체된다), 적합성 정보나 근거가 있어도 개인화된 단일 행동 지시로 확정하지 말고 조건별 선택지와 의사결정 체크리스트로 전환하라.\n' +
      '불법 행위의 구체적 실행법, 실제 주문·계정 변경·외부 전송, 수익 보장만 차단한다. 그 밖의 질문은 답변 전체를 안전 모드로 바꾸지 말고 부족한 현재 주장만 제한하라.\n' +
      '조건, 데이터의 한계, 위험요인, 확인해야 할 원문과 재검증 절차를 설명하라. 현재성 주장은 주입된 근거 블록만 사용하고 기준시각과 Evidence 상태를 명시하라.\n' +
      '현재 수치·출처·기준시각이 주입되지 않았으면 그 수치를 현재 사실로 단정하지 마라. 다만 답변을 거부하거나 "확인 필요"로 끝내지 말고, 일반 원리·조건·시나리오·확인 방법으로 끝까지 답하며 어느 부분이 미확인인지 밝혀라. 학습 기억을 현재 관측값처럼 제시하는 것만 금지한다.\n' +
      '최종 판단을 대신하지 마라. 근거·조건·반대 시나리오·무효화 신호를 정리해 사용자가 스스로 결정하도록 넘기고, 어떤 결론도 확정된 지시가 아니라 검토 대상으로 제시하라.\n' +
      '보정(calibration) 모델 ID와 검증된 calibration 메타데이터가 주입되지 않은 경우 Bull/Base/Bear·상승/하락 확률을 숫자(%)로 만들거나 추정하지 마라. 확률 대신 조건·반대 가설·확인할 신호를 제시하라.\n';
  }

  // One response contract for every public entry point. The previous producer
  // requested AI_CLAIMS_JSON while the consumer required AI_ANSWER_PLAN.
  var _aioBasePublicAIActionPolicyPrompt = _aioPublicAIActionPolicyPrompt;
  _aioPublicAIActionPolicyPrompt = function() {
    var base = _aioBasePublicAIActionPolicyPrompt();
    // P1740: the shape is chosen per question (【이번 답변의 형태】); this contract fixes only the envelope, voice and
    // number rules. The old fixed "summary ≤2 sentences, ≤4 sections × ≤3 sentences, 1,500 tokens" made every answer the
    // same short generic memo.
    return base + '\n\n【AI AnswerPlan v1 — 출력 계약】\n' +
      '답변 전체를 아래 블록 하나로 출력하라. 블록 밖에는 어떤 문장도 쓰지 마라.\n' +
      '형태: 섹션 수와 길이는 질문이 정한다(【이번 답변의 형태】를 따른다). 고정 템플릿을 반복하지 말고, 섹션 제목은 "핵심 근거" 같은 범용어 대신 그 섹션의 주장을 담아 지어라(예: "금리 상승이 성장주 밸류에이션을 누르는 경로"). section body에는 markdown 목록·굵게·표(열 5개 이하)를 쓸 수 있다. 전체는 질문 범위 안에서 완결되게, 길어도 한국어 2,500자 안팎에서 끝내라.\n' +
      '목소리: 시장 경험이 많은 리서치 애널리스트처럼 정확하고 중립적으로 쓴다. 결론을 먼저 말하고, 근거는 지표 이름·기간·기준일로 구체적으로 대며, 관측된 사실·해석·추정을 구분한다. 낙관과 비관을 공정하게 다루고, 상투적 문구("투자에는 위험이 따릅니다", "다양한 요인이 있습니다")와 같은 면책 문장의 반복을 피한다. 자연스러운 한국어로 쓴다.\n' +
      '수치: 현재성 수치(지금의 가격·지표값·최근 변화)는 claims에만 넣고, 각 수치 claim은 type, text, metric, entity, value, unit, scale, asOf, source, evidenceIds, status를 채운다. metric/entity/scale은 주입된 evidence registry에서 그대로 복사하고 entity가 비어 있으면 빈 문자열로 둔다. summary/sections 본문에서는 현재 수치를 반복하지 말고 "아래 종가 기준 값"처럼 claims를 가리켜라. 조건·임계값("VIX가 20을 넘으면")과 개념 설명용 예시 숫자는 본문에 써도 된다. 근거가 없는 현재 수치는 생략하고 무엇이 확인되지 않았는지 밝혀라.\n' +
      'followUps: 이 답변 다음에 실제로 이어질 만한 구체적 질문 2~3개(이번 답변과 사용 가능한 데이터에 연결된 것).\n' +
      '[AI_ANSWER_PLAN]{"schemaVersion":"answer-plan.v1","summary":"질문에 대한 직접 답과 핵심 판단","claims":[],"sections":[{"title":"이 섹션의 주장을 담은 제목","body":"근거·해석·조건"}],"citations":[],"followUps":[]}[\/AI_ANSWER_PLAN]\n';
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
      var ts = row.observedAt || row.asOf || row.quoteAsOf || row.sourceTs;
      if (ts) asOfValues.push(ts);
      if (row.source) sources.push(String(row.source));
    });
    var latestAsOf = asOfValues.map(function(v) { return new Date(v).getTime(); }).filter(isFinite).sort(function(a,b){ return b-a; })[0];
    var asOf = latestAsOf ? _aioPublicAIFormatAsOf(latestAsOf) : (asOfValues[0] ? _aioPublicAIFormatAsOf(asOfValues[0]) : '미확인');
    var blocked = freshness.status === 'fail' || freshness.status === 'blocked' || freshness.strictFailed === true || rows.some(function(row) {
      var truth = String(row && row.truthStatus || '').toLowerCase();
      var observedAt = row && (row.observedAt || row.asOf || row.quoteAsOf || row.sourceTs);
      var observationTime = observedAt ? new Date(observedAt).getTime() : NaN;
      return !row || row.hasLivePrice === false || row.decisionUse !== true || !/^(verified|current)$/.test(truth) || !Number.isFinite(observationTime) || observationTime > Date.now() + 60000 || !String(row.source || '').trim() || (row.truthIssues && row.truthIssues.length > 0);
    });
    // v57.48 #7/#19: an answer bound to the screen's completed closes says so (date, not "미확인"), and the detailed
    // limitation notes the answer no longer stacks at its top are listed here, in Korean.
    var closeDates = Array.isArray(meta.closeBasisDates) ? meta.closeBasisDates : []; // published close-basis claims only, not every collected row
    // QA-VERIFY-16 live check (2026-10-13): an answer whose only published numbers are completed closes is labelled by
    // those closes, even when page quote rows were collected (live rows it never cited cannot make it "확인 필요").
    var closeOnly = closeDates.length > 0 && !(meta.otherPublishedClaims > 0);
    var evidenceStatus = closeOnly ? '종가 기준 근거' : rows.length ? (blocked ? '확인 필요' : '주입 근거 확인됨') : '확인 필요';
    if (closeOnly) asOf = closeDates[closeDates.length - 1] + ' 종가';
    var sourceLabel = closeOnly ? '완료된 종가 기록' : sources.length ? Array.from(new Set(sources)).slice(0, 2).join(' / ') : '원천 확인 필요';
    var notes = meta.actionGate && Array.isArray(meta.actionGate.limitationNotes) ? meta.actionGate.limitationNotes : [];
    return {
      label: _AIO_PUBLIC_AI_POLICY.label,
      status: evidenceStatus,
      asOf: asOf,
      source: sourceLabel,
      text: _AIO_PUBLIC_AI_POLICY.label + ', 기준시각: ' + asOf + ', 근거 상태: ' + evidenceStatus + ', 원천: ' + sourceLabel + ', 원문 재확인 필요' + (notes.length ? '\n' + notes.map(function(note) { return '- ' + note; }).join('\n') : '')
    };
  }

  // P1539 (owner decision: no trade instructions; show facts such as the pivot and the invalidation price): the gate used to detect
  // concrete instructions and then let every one through. A research answer may still analyse price levels, invalidation levels and
  // allocations as scenarios, so the gate no longer blocks the answer; it replaces only the sentence that is an unmistakable personal
  // directive (a recommendation or imperative to buy, sell, stop out or resize) with a plain notice. Patterns are narrow on purpose:
  // a number or a bare action word is analysis, a recommendation or imperative form is an instruction.
  var _AIO_DIRECTIVE_NOTICE = '[개별 매매 지시는 제공하지 않습니다. 조건과 근거를 확인해 직접 판단하세요.]';
  function _aioApplyAIActionGate(text, meta) {
    var raw = String(text || '');
    var action = '(?:매수|매도|추가\\s*매수|분할\\s*매수|손절|익절|청산|(?:신규|매수)\\s*진입|포지션\\s*정리)'; // v57.84: bare 진입/정리 replaced "근거를 정리하세요"
    var recommend = new RegExp(action + '\\s*(?:을|를)?\\s*(?:추천|권고|권장|제안)(?!\\s*(?:하지|드리지|이\\s*아|은\\s*아))');
    var imperative = new RegExp(action + '\\s*(?:하세요|하십시오|하라|하시기\\s*바랍니다|해야\\s*(?:합니다|한다|해요))');
    var colloquial = /(?:사세요|파세요|담으세요|사야\s*(?:합니다|한다)|팔아야\s*(?:합니다|한다))/;
    var tickerAction = /(?:^|[\s:：(])[A-Z]{1,5}\s*(?:비중\s*)?\$?\d[\d,.]*\s*(?:달러|원|%)?\s*(?:매수|매도|확대|축소)\s*[.!)]?\s*$/;
    // v57.48 #13: a weight imperative and a "buy/sell opportunity" call are directives too; a past-tense attribution
    // ("오닐은 … 손절해야 한다고 봤습니다"), a named rule, or the reason a practice exists ("권장하는 이유") is education.
    var weight = /비중\s*(?:을|를)?\s*(?:(?:늘리|줄이|확대하|축소하|높이|낮추)(?:세요|십시오|시기\s*바랍니다)|(?:늘려|줄여|확대해|축소해|높여|낮춰)(?:야\s*(?:합니다|한다)|라))/;
    var opportunity = /(?:매수|매도|진입|매집|저가\s*매수|추가\s*매수)\s*(?:의\s*)?(?:기회|적기|타이밍)\s*(?:로|으로|입니다|이다|라고|가\s*될|일\s*수)/;
    var indirect = /(?:다는|라는)\s*것(?:이|은)\s*[^,.]{0,30}(?:원칙|규칙|격언|주장|철학|방식)|(?:한다|하라|해라|하세요|된다|합니다)\s*(?:고|라고|는|라는)\s*(?:봤|보았|했|말했|주장했|강조했|설명했|조언했|권했|가르쳤|규칙|원칙|격언)|(?:라는|이라는|다는)\s*(?:규칙|원칙|격언)|(?:하는|한|권장하는|추천하는|권하는)\s*(?:이유|까닭|배경)/;
    var negated = /(?:아닙니다|아니다|않습니다|않는다|금지|하지\s*마|하지\s*않|제공하지|드리지|지시가\s*아|지시 아님)/;
    // v58.63 (architecture audit A15): English directives are directives too ("You should buy NVDA now." passed untouched).
    var english = /\b(?:you\s+(?:should|must|need\s+to|ought\s+to)|i\s+(?:recommend|suggest|advise)(?:\s+(?:you|that\s+you))?|we\s+recommend(?:\s+(?:you|that\s+you))?|it(?:'s|\s+is)\s+time\s+to)\s+(?:buy|sell|short|add\s+to|trim|dump|load\s+up\s+on|go\s+long|go\s+short|exit)\b|(?:^|[.!?]\s*)(?:buy|sell|short)\s+(?:[A-Z]{1,5}\b|shares|the\s+stock|it\s+now|now)|\bstrong\s+(?:buy|sell)\b/i;
    var englishIndirect = /\b(?:said|argued|wrote|believed|taught|advised|warned)\s+(?:that\s+)?(?:you|investors|traders)\b|\bthe\s+(?:rule|principle|maxim)\s+(?:is|says)\b/i;
    var pricedImperative = new RegExp('(?:' + action + '|손절가|목표가|매수가|매도가|진입가|익절가)\\s*(?:은|는|을|를)?\\s*\\$?\\d[\\d,.]*\\s*(?:달러|원)?\\s*(?:에서|에|으로|로|부근에서|근처에서)\\s*(?:하세요|하십시오|하라|두세요|잡으세요|거세요|설정하세요|정하세요|하시기\\s*바랍니다)'); // v58.75: priced imperatives ("손절은 178달러에서 하세요")
    var patterns = [recommend, imperative, colloquial, weight, opportunity, tickerAction, english, pricedImperative];
    // v58.63 (A15): a negation exempts a directive only when it binds to that directive — inside the matched words or right
    // after/before them ("매수를 추천하지 않습니다", "not a buy"). A negation elsewhere in the sentence ("매수하세요 그리고 손절하지
    // 마세요") no longer clears the buy instruction beside it.
    var bound = function(clause, re) {
      var m = re.exec(clause);
      if (!m) return false;
      var tail = clause.slice(m.index + m[0].length, m.index + m[0].length + 16);
      var next = tail.search(new RegExp(action)); // the window ends where the next action word starts
      if (next >= 0) tail = tail.slice(0, next);
      var head = clause.slice(Math.max(0, m.index - 12), m.index);
      return negated.test(m[0]) || negated.test(tail) || /^\s*(?:is\s+not|isn't|not)\b/i.test(tail) || /\b(?:not|never|don't|do\s+not)\s+$/i.test(head);
    };
    // P2114: a decimal point ("177.50달러") does not end a sentence; splitting there let a priced imperative with cents through.
    var sentences = raw.match(/(?:[^.!?。\n]|\.(?=\d))+(?:[.!?。]+|\n|$)\s*/g) || [raw];
    var replaced = 0;
    var out = sentences.map(function(sentence) {
      // A negation counts only inside the clause that carries the directive ("지금 매수하세요, 이것은 지시가 아닙니다" is replaced).
      var directive = sentence.trim().split(/[,，;；]+|\s(?:그러나|하지만|다만|그리고|또한|그러면서|그다음|그\s*후)\s|\s(?:and|but|then)\s/i).some(function(clause) {
        clause = clause.trim();
        return !!clause && !indirect.test(clause) && !englishIndirect.test(clause) && patterns.some(function(re) { return re.test(clause) && !bound(clause, re); });
      });
      if (!directive) return sentence;
      replaced += 1;
      return _AIO_DIRECTIVE_NOTICE + (/\n\s*$/.test(sentence) ? '\n' : ' ');
    }).join('');
    if (!replaced) return { blocked: false, text: raw, reasons: [] };
    return { blocked: false, text: out.replace(/(?:\[개별 매매 지시는 제공하지 않습니다\. 조건과 근거를 확인해 직접 판단하세요\.\]\s*){2,}/g, _AIO_DIRECTIVE_NOTICE + ' ').trim(), reasons: ['directive-sentence-replaced'], replacedSentences: replaced };
  }

  function _aioAppendAIPublicDisclosure(parent, meta) {
    if (!parent || typeof document === 'undefined') return null;
    try {
      var old = parent.querySelector('[data-ai-public-disclosure]');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var info = _aioBuildAIResponseDisclosure(meta);
      var el = document.createElement('details');
      el.setAttribute('data-ai-public-disclosure', _AIO_PUBLIC_AI_POLICY.status);
      el.setAttribute('data-evidence-status', info.status);
      el.setAttribute('data-as-of', info.asOf);
      el.className = 'lch-disc';
      var summary = document.createElement('summary');
      summary.textContent = '답변 근거, ' + info.status;
      summary.className = 'lch-disc-sum';
      el.appendChild(summary);
      var detail = document.createElement('div');
      detail.textContent = info.text;
      detail.className = 'lch-disc-body';
      el.appendChild(detail);
      parent.appendChild(el);
      return info;
    } catch(_) { return null; }
  }

  window._AIO_PUBLIC_AI_POLICY = _AIO_PUBLIC_AI_POLICY;
  window._aioPublicAIActionPolicyPrompt = _aioPublicAIActionPolicyPrompt;
  window._aioApplyAIActionGate = _aioApplyAIActionGate;
  window._aioCreateAIRequestObject = _aioCreateAIRequestObject;
  window._aioBeginAIRequestAttempt = _aioBeginAIRequestAttempt;
  window._aioRunAIResponsePipeline = _aioRunAIResponsePipeline;
  window._aioBuildAIResponseDisclosure = _aioBuildAIResponseDisclosure;
  window._aioAppendAIPublicDisclosure = _aioAppendAIPublicDisclosure;
  window.AIO = window.AIO || {};
  window.AIO.getAIResponsePipelineAudit = function() {
    return (window._aioAiPipelineAudit || []).slice();
  };
  // P1245 (05 A05): 진단은 "가장 최근 스트림"의 기록을 읽는다. 게이트/공개 경로는 이 접근자를 쓰지 않고
  // 각자 자기 요청 id로 `_aioAIRequestCitations(requestId)`를 읽어 동시 요청에서 섞이지 않는다.
  window.AIO.getLatestAIRequestStream = function() { return _aioLatestAIRequestStream(); };

  window._aioAIRequestStream = _aioAIRequestStream;
  window._aioAIRequestCitations = _aioAIRequestCitations;
  window._aioAIRequestResearchError = _aioAIRequestResearchError;
  window._aioCollectAIClaimEvidence = _aioCollectAIClaimEvidence;
  window._aioPublicAIFormatAsOf = _aioPublicAIFormatAsOf;
  window._aioSettleWebSearchStatus = _aioSettleWebSearchStatus;
  return window;
}
