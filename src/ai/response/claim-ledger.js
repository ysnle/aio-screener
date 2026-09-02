export const AI_CLAIM_LEDGER_VERSION = 'claim-ledger.v1';

const NUMERIC_TYPES = new Set(['numeric', 'metric', 'percentage', 'probability']);

function text(value) { return value == null ? null : String(value).trim() || null; }

function freezeRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.freeze({ ...value }) : null;
}

function freezeRows(values) {
  return Object.freeze((Array.isArray(values) ? values : []).map((value) => value && typeof value === 'object' ? Object.freeze({ ...value }) : value));
}

export function createClaimLedger(claims = []) {
  const normalized = (Array.isArray(claims) ? claims : []).map((claim, index) => Object.freeze({
    claimId: text(claim?.claimId) || `claim:${index + 1}`,
    type: text(claim?.type) || 'text',
    text: text(claim?.text) || '',
    value: claim?.value ?? null,
    unit: text(claim?.unit),
    asOf: text(claim?.asOf),
    source: text(claim?.source),
    evidenceIds: Object.freeze(Array.isArray(claim?.evidenceIds) ? claim.evidenceIds.map(String) : []),
    allowedUse: text(claim?.allowedUse) || 'reference',
    status: text(claim?.status) || 'unverified',
    calibration: freezeRecord(claim?.calibration)
  }));
  return Object.freeze({ schemaVersion: AI_CLAIM_LEDGER_VERSION, claims: Object.freeze(normalized) });
}

export function validateClaimLedger(ledger, { currentSensitive = false, requireClaims = false } = {}) {
  const errors = [];
  if (!ledger || ledger.schemaVersion !== AI_CLAIM_LEDGER_VERSION) errors.push('schema_version_invalid');
  const claims = Array.isArray(ledger?.claims) ? ledger.claims : [];
  if (requireClaims && !claims.length) errors.push('claims_missing');
  claims.forEach((claim, index) => {
    const prefix = `claim_${index + 1}`;
    if (!claim?.claimId || !claim?.text) errors.push(`${prefix}:identity_missing`);
    if (NUMERIC_TYPES.has(claim?.type)) {
      if (typeof claim.value !== 'number' || !Number.isFinite(claim.value)) errors.push(`${prefix}:numeric_value_missing`);
      if (!claim.unit) errors.push(`${prefix}:unit_missing`);
      if (!claim.asOf) errors.push(`${prefix}:as_of_missing`);
      if (!claim.source) errors.push(`${prefix}:source_missing`);
      if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) errors.push(`${prefix}:evidence_missing`);
    }
    if (currentSensitive && (!claim.asOf || !claim.source || !claim.evidenceIds?.length)) errors.push(`${prefix}:current_traceability_missing`);
    if (claim.type === 'probability' && !claim.calibration?.modelId) errors.push(`${prefix}:uncalibrated_probability`);
    if (claim.allowedUse === 'decision' && (!claim.evidenceIds?.length || claim.status !== 'verified')) errors.push(`${prefix}:decision_use_not_verified`);
  });
  const invalidClaims = new Set(errors.map((error) => error.match(/^claim_(\d+):/)?.[1]).filter(Boolean));
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]), validCount: Math.max(0, claims.length - invalidClaims.size) });
}

export function createAnswerPlan({ questionPlan = null, summary = '', claims = [], sections = [], citations = [], followUps = [], scenario = null } = {}) {
  return Object.freeze({
    schemaVersion: 'answer-plan.v1',
    queryId: questionPlan?.queryId || null,
    intent: questionPlan?.intent?.primary || null,
    summary: String(summary || ''),
    claims: createClaimLedger(claims),
    sections: freezeRows(sections),
    citations: freezeRows(citations),
    followUps: Object.freeze((Array.isArray(followUps) ? followUps : []).map((value) => String(value == null ? '' : value)).filter(Boolean)),
    scenario: scenario && typeof scenario === 'object' ? Object.freeze({ ...scenario, calibration: freezeRecord(scenario.calibration), probabilities: scenario.calibration?.modelId ? freezeRecord(scenario.probabilities) : null }) : null
  });
}

export function validateAnswerPlan(plan, options = {}) {
  const errors = [];
  if (plan?.schemaVersion !== 'answer-plan.v1') errors.push('schema_version_invalid');
  const prose = [plan?.summary, ...(Array.isArray(plan?.sections) ? plan.sections.map((section) => typeof section === 'string' ? section : `${section?.title || ''} ${section?.body || ''}`) : [])].join(' ');
  const hasUntrackedNumericContent = options.currentSensitive === true && /(?:[$₩€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:%|bp|bps|원|달러|USD|배|포인트|pt|지수)|(?:VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익)\s*(?:는|은|이|:)?\s*\d[\d,.]*|\b(?:19|20)\d{2}-\d{2}-\d{2}\b)/i.test(prose) && !(plan?.claims?.claims || []).length;
  const ledger = validateClaimLedger(plan?.claims, { ...options, requireClaims: hasUntrackedNumericContent });
  if (!ledger.ok) errors.push(...ledger.errors);
  if (hasUntrackedNumericContent) errors.push('untracked_numeric_content');
  if (plan?.scenario?.probabilities && !plan.scenario.calibration?.modelId) errors.push('uncalibrated_scenario_probabilities');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]), claimAudit: ledger });
}

export function parseAnswerPlanText(text, { questionPlan = null, currentSensitive = false } = {}) {
  const source = String(text == null ? '' : text);
  const match = source.match(/\[AI_ANSWER_PLAN\]([\s\S]*?)\[\/AI_ANSWER_PLAN\]/i);
  if (!match) return Object.freeze({ status: 'not-structured', plan: null, audit: Object.freeze({ ok: false, errors: Object.freeze(['answer_plan_missing']) }) });
  try {
    const payload = JSON.parse(match[1]);
    const claims = Array.isArray(payload.claims)
      ? payload.claims
      : payload.claims?.schemaVersion === AI_CLAIM_LEDGER_VERSION
        ? payload.claims.claims
        : [];
    const plan = createAnswerPlan({ ...payload, claims, questionPlan: { queryId: payload.queryId || questionPlan?.queryId || null, intent: { primary: payload.intent || questionPlan?.intent?.primary || null } } });
    const audit = validateAnswerPlan(plan, { currentSensitive });
    // Keep a syntactically valid plan available even when one claim or prose
    // field fails validation. The publication boundary can then remove only
    // the unsafe claim instead of erasing the whole otherwise useful answer.
    return Object.freeze({ status: audit.ok ? 'valid' : 'invalid', plan, audit });
  } catch (_) {
    return Object.freeze({ status: 'invalid', plan: null, audit: Object.freeze({ ok: false, errors: Object.freeze(['answer_plan_json_invalid']) }) });
  }
}
