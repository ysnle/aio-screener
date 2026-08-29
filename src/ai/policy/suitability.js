export const AI_SUITABILITY_POLICY_VERSION = 'suitability-action.v1';

export function evaluateQuestionActionPermission({ questionPlan = {}, suitabilityProfile = null, evidenceComplete = false } = {}) {
  // New callers provide the narrow personalized/executable signal. Preserve
  // compatibility for older plans that only expose actionRequested.
  const actionRequested = Object.prototype.hasOwnProperty.call(questionPlan || {}, 'personalizedActionRequested')
    ? questionPlan.personalizedActionRequested === true
    : questionPlan?.actionRequested === true;
  if (!actionRequested) return Object.freeze({ version: AI_SUITABILITY_POLICY_VERSION, status: 'educational', allowed: true, reasons: [] });
  const reasons = [];
  if (!suitabilityProfile) reasons.push('suitability-profile-required');
  if (!evidenceComplete) reasons.push('current-evidence-required');
  return Object.freeze({ version: AI_SUITABILITY_POLICY_VERSION, status: reasons.length ? 'clarification-required' : 'conditional', allowed: reasons.length === 0, reasons });
}
