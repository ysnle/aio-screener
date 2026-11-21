import { splitAnswerSentences, isConditionalNumericSentence } from './publication.js';
import { rememberField } from '../session/reader-notes.js';
import { splitAnswerText } from './answer-envelope.js';
import { numericFieldsMissing } from '../../domain/shared/figure-agreement.js';

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
    // P1688 live check: a model label such as "market_data" on a claim with a metric and a numeric value is a metric
    // claim; normalising the label keeps one validation path (it was dropped as untyped numeric content).
    type: !NUMERIC_TYPES.has(text(claim?.type)) && text(claim?.type) !== 'text' && text(claim?.metric) && typeof claim?.value === 'number' && Number.isFinite(claim.value) ? 'metric' : text(claim?.type) || 'text',
    text: text(claim?.text) || '',
    metric: text(claim?.metric),
    entity: text(claim?.entity),
    scale: text(claim?.scale) || 'raw',
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
      for (const missing of numericFieldsMissing(claim)) errors.push(`${prefix}:${missing}`);
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

// `remember`: optional notes about the reader for later answers (src/ai/session/reader-notes.js); never rendered.
export function createAnswerPlan({ questionPlan = null, summary = '', claims = [], sections = [], citations = [], followUps = [], scenario = null, remember = [] } = {}) {
  return Object.freeze({
    schemaVersion: 'answer-plan.v1',
    queryId: questionPlan?.queryId || null,
    intent: questionPlan?.intent?.primary || null,
    summary: String(summary || ''),
    claims: createClaimLedger(claims),
    sections: freezeRows(sections),
    citations: freezeRows(citations),
    followUps: Object.freeze((Array.isArray(followUps) ? followUps : []).map((value) => String(value == null ? '' : value)).filter(Boolean)),
    remember: rememberField(remember),
    scenario: scenario && typeof scenario === 'object' ? Object.freeze({ ...scenario, calibration: freezeRecord(scenario.calibration), probabilities: scenario.calibration?.modelId ? freezeRecord(scenario.probabilities) : null }) : null
  });
}

export function validateAnswerPlan(plan, options = {}) {
  const errors = [];
  if (plan?.schemaVersion !== 'answer-plan.v1') errors.push('schema_version_invalid');
  const prose = [plan?.summary, ...(Array.isArray(plan?.sections) ? plan.sections.map((section) => typeof section === 'string' ? section : `${section?.title || ''} ${section?.body || ''}`) : [])].join(' ');
  // P1172 (05 A04): 수치 조건을 해제하는 것은 **수치를 추적하는 타입의 claim**뿐이다. 이전에는 claim이
  // 하나라도 있으면(예: 텍스트 claim) untracked numeric prose 조건이 꺼져, 근거가 연결되지 않은 현재
  // 사실 숫자가 그대로 공개될 수 있었다.
  const planClaims = plan?.claims?.claims || [];
  const numericClaims = planClaims.filter((claim) => NUMERIC_TYPES.has(claim?.type));
  // P1740: a threshold inside a condition ("VIX가 20을 넘으면") is a rule, not an untracked current value.
  const UNTRACKED = /(?:[$₩€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:%|bp|bps|원|달러|USD|배|포인트|pt|지수)|(?:VIX|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익)\s*(?:는|은|이|:)?\s*\d[\d,.]*|\b(?:19|20)\d{2}-\d{2}-\d{2}\b)/i;
  const hasUntrackedNumericContent = options.currentSensitive === true
    && prose.split('\n').flatMap((line) => splitAnswerSentences(line)).some((sentence) => UNTRACKED.test(sentence) && !isConditionalNumericSentence(sentence))
    && numericClaims.length === 0;
  const ledger = validateClaimLedger(plan?.claims, { ...options, requireClaims: hasUntrackedNumericContent });
  if (!ledger.ok) errors.push(...ledger.errors);
  if (hasUntrackedNumericContent) errors.push('untracked_numeric_content');
  if (plan?.scenario?.probabilities && !plan.scenario.calibration?.modelId) errors.push('uncalibrated_scenario_probabilities');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]), claimAudit: ledger });
}

export function parseAnswerPlanText(text, { questionPlan = null, currentSensitive = false, unfinished = false } = {}) {
  const { body, meta, metaState } = splitAnswerText(text, { unfinished });
  if (!body) return Object.freeze({ status: 'not-structured', plan: null, audit: Object.freeze({ ok: false, errors: Object.freeze(['answer_body_missing']) }) });
  const claims = Array.isArray(meta.claims) ? meta.claims : [];
  const plan = createAnswerPlan({ ...answerBodyParts(body), claims, citations: meta.citations, followUps: meta.followUps, remember: meta.remember,
    questionPlan: { queryId: questionPlan?.queryId || null, intent: { primary: questionPlan?.intent?.primary || null } } });
  const audit = validateAnswerPlan(plan, { currentSensitive });
  // The plan is always available once there is a body: the publication boundary removes an unsafe claim or sentence
  // instead of the whole answer, and a body whose trailing block was cut off or malformed still publishes.
  // An answer with no trailing block is complete text with no claims to bind; a block that was opened and then cut off
  // or malformed is reported.
  const metaOk = metaState === 'ok' || metaState === 'missing';
  const errors = metaOk ? audit.errors : Object.freeze([...audit.errors, `answer_meta_${metaState}`]);
  return Object.freeze({ status: audit.ok && metaOk ? 'valid' : 'invalid', plan, audit: Object.freeze({ ...audit, ok: audit.ok && metaOk, errors }) });
}

// The lead (everything before the first "### " heading) is the direct answer; each heading opens a section.
function answerBodyParts(body) {
  const blocks = String(body).split(/^(?=###\s)/m);
  const lead = /^###\s/.test(blocks[0]) ? '' : blocks.shift().trim();
  const sections = blocks.map((block) => {
    const [head, ...rest] = block.split('\n');
    return { title: head.replace(/^###\s*/, '').trim(), body: rest.join('\n').trim() };
  }).filter((section) => section.title && section.body);
  return { summary: lead, sections };
}
