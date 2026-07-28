import { createQuestionPlan } from './question-planner.js';
import { createCapabilityPlan } from './capability-planner.js';
import { createAnswerPlan, validateAnswerPlan, parseAnswerPlanText } from '../response/claim-ledger.js';
import { createDomainAnalysisRegistry } from '../analysis/registry.js';
import { validateResearchDecision } from '../research/decision.js';
import { validateResearchPlan } from '../research/plan.js';
import { createResearchCapability, validateResearchCapability } from '../research/capability.js';

export const AI_ANSWER_ORCHESTRATOR_VERSION = 'answer-orchestrator.v1';

export function createAIAnswerOrchestrator({ root = globalThis, now = () => new Date() } = {}) {
  let lastPlan = null;
  const audit = [];
  const domainAnalysis = createDomainAnalysisRegistry();
  const plan = (input = {}) => {
    const questionPlan = createQuestionPlan({ ...input, root, now: input.now || now() });
    lastPlan = questionPlan;
    if (root) root._aioActiveQuestionPlan = questionPlan;
    audit.push({ queryId: questionPlan.queryId, route: questionPlan.route, intent: questionPlan.intent.primary, research: questionPlan.researchDecision?.requirement || 'UNKNOWN', generatedAt: questionPlan.generatedAt });
    if (audit.length > 100) audit.splice(0, audit.length - 100);
    return questionPlan;
  };
  const execute = async (input = {}) => {
    const questionPlan = input.questionPlan || plan(input);
    if (typeof input.legacyRunner !== 'function') return Object.freeze({ ok: false, status: 'blocked', reason: 'runner-missing', plan: questionPlan });
    try {
      const result = await input.legacyRunner(questionPlan);
      return Object.freeze({ ok: true, status: 'dispatched-through-ui-adapter', plan: questionPlan, result: result ?? null });
    } catch (error) {
      return Object.freeze({ ok: false, status: 'runner-error', plan: questionPlan, error: error?.message || 'legacy_runner_failed' });
    }
  };
  const analyze = (questionPlan, inputs = {}) => domainAnalysis.analyze(questionPlan || lastPlan || {}, inputs);
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
    validateResearch,
    getResearchCapability,
    validateResearchCapability,
    getLastPlan: () => lastPlan,
    getAudit: () => audit.slice(),
    createAnswerPlan,
    validateAnswerPlan,
    parseAnswerPlanText,
    createCapabilityPlan
  });
}
