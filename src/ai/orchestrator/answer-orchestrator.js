import { createQuestionPlan } from './question-planner.js';
import { createCapabilityPlan } from './capability-planner.js';
import { createAnswerPlan, validateAnswerPlan, parseAnswerPlanText } from '../response/claim-ledger.js';
import { renderAnswerPlan } from '../response/renderer.js';
import { createDomainAnalysisRegistry } from '../analysis/registry.js';
import { buildEvidenceAnalysisInputs } from '../analysis/evidence-inputs.js';
import { createQuestionPremise } from './premise.js';
import { validateResearchDecision } from '../research/decision.js';
import { validateResearchPlan } from '../research/plan.js';
import { createResearchCapability, validateResearchCapability } from '../research/capability.js';

export const AI_ANSWER_ORCHESTRATOR_VERSION = 'answer-orchestrator.v1';

export function createAIAnswerOrchestrator({ root = globalThis, now = () => new Date(), knowledgeRetriever = null } = {}) {
  let lastPlan = null;
  const audit = [];
  const domainAnalysis = createDomainAnalysisRegistry();
  const plan = (input = {}) => {
    const questionPlan = createQuestionPlan({ ...input, root, now: input.now || now() });
    lastPlan = questionPlan;
    audit.push(Object.freeze({ queryId: questionPlan.queryId, route: questionPlan.route, intent: questionPlan.intent.primary, research: questionPlan.researchDecision?.requirement || 'UNKNOWN', generatedAt: questionPlan.generatedAt }));
    if (audit.length > 100) audit.splice(0, audit.length - 100);
    return questionPlan;
  };
  const execute = async (input = {}) => {
    const questionPlan = input.questionPlan || plan(input);
    const actionPermission = questionPlan?.actionPermission || null;
    if (actionPermission?.allowed === false) {
      try {
        const result = typeof input.blockedRunner === 'function'
          ? await input.blockedRunner(questionPlan, actionPermission)
          : null;
        return Object.freeze({
          ok: false,
          status: 'blocked-action-permission',
          reason: 'action-permission-denied',
          permission: actionPermission,
          plan: questionPlan,
          result: result ?? null
        });
      } catch (error) {
        return Object.freeze({
          ok: false,
          status: 'blocked-runner-error',
          reason: 'action-permission-denied',
          permission: actionPermission,
          plan: questionPlan,
          error: 'blocked_runner_failed'
        });
      }
    }
    if (typeof input.legacyRunner !== 'function') return Object.freeze({ ok: false, status: 'blocked', reason: 'runner-missing', plan: questionPlan });
    try {
      const result = await input.legacyRunner(questionPlan);
      return Object.freeze({ ok: true, status: 'dispatched-through-ui-adapter', plan: questionPlan, result: result ?? null });
    } catch (error) {
      return Object.freeze({ ok: false, status: 'runner-error', plan: questionPlan, error: 'legacy_runner_failed' });
    }
  };
  const analyze = (questionPlan, inputs = {}) => domainAnalysis.analyze(questionPlan || lastPlan || {}, inputs);
  const withPremiseEvidence = (questionPlan = lastPlan, { evidence = [], requestedPeriod = null, assertions = null } = {}) => {
    const base = questionPlan || {};
    const premise = createQuestionPremise({ query: base.query, entities: base.entities, timeframe: base.timeframe, currentSensitive: base.currentSensitive, evidence, requestedPeriod, assertions, now: now() });
    return Object.freeze({ ...base, premise });
  };
  const buildAnalysisContext = (questionPlan = lastPlan, { evidence = [] } = {}) => {
    const adapted = buildEvidenceAnalysisInputs(questionPlan || {}, { evidence, now: Number(new Date(now())) });
    const result = domainAnalysis.analyze(questionPlan || {}, adapted.inputs);
    const analysisAudit = Object.freeze({ ...adapted.audit, status: result.status });
    const context = result.status === 'not-applicable' ? '' : '\n\n[AI_DOMAIN_ANALYSIS reference-only]\n' +
      '교육·부분 분석입니다. 계산 결과를 현재 claim evidence로 자동 승격하지 마세요. 입력되지 않은 품질 점수, 인과 경로, 섹터 구성종목을 추정하지 마세요.\n' + JSON.stringify({ result, audit: analysisAudit });
    return Object.freeze({ result, audit: analysisAudit, context });
  };
  const validateResearch = (questionPlan = lastPlan) => Object.freeze({
    decision: validateResearchDecision(questionPlan?.researchDecision),
    plan: validateResearchPlan(questionPlan?.researchPlan)
  });
  const getResearchCapability = (input = {}) => createResearchCapability(input);
  return Object.freeze({
    version: AI_ANSWER_ORCHESTRATOR_VERSION,
    plan,
    execute,
    analyze,
    withPremiseEvidence,
    buildAnalysisContext,
    validateResearch,
    getResearchCapability,
    validateResearchCapability,
    getLastPlan: () => lastPlan,
    getAudit: () => Object.freeze(audit.slice()),
    createAnswerPlan,
    validateAnswerPlan,
    parseAnswerPlanText,
    renderAnswerPlan,
    createCapabilityPlan,
    buildAIKnowledgeContext: (query, options = {}) => knowledgeRetriever?.buildContext
      ? knowledgeRetriever.buildContext(query, options)
      : Promise.resolve(Object.freeze({ matches: [], context: '', audit: Object.freeze({ status: 'UNAVAILABLE', returned: 0 }) })),
    getAIKnowledgeRetrievalAudit: () => knowledgeRetriever?.getAudit?.() || Object.freeze({ status: 'UNAVAILABLE', returned: 0 })
  });
}
