export const AI_RESEARCH_DECISION_VERSION = 'research-decision.v1';

export const RESEARCH_REQUIREMENTS = Object.freeze([
  'REQUIRED',
  'OPTIONAL',
  'NOT_NEEDED',
  'FORBIDDEN'
]);

const CURRENT_RE = /(지금|현재|오늘|장중|장전|장후|방금|최근|실시간|최신|현황|동향|시세|업데이트|이번\s*주|latest|recent|today|now|current|live|breaking|update)/i;
const CAUSAL_RE = /(왜|원인|이유|무슨\s*이유|때문|영향|driven\s*by|because|why|cause)/i;
const CONCEPT_RE = /(무엇|뭐야|뜻|개념|설명|배워|초보|what\s+is|how\s+does|explain)/i;
const EXPLICIT_SEARCH_RE = /(검색|찾아|찾아봐|조사|리서치|search|look\s*up|research|verify|확인해)/i;
const DOMAIN_RE = /(주식|증시|시장|종목|티커|주가|시세|섹터|업종|산업|기업|실적|공시|뉴스|금리|채권|국채|환율|달러|원화|유가|원유|금|VIX|F\s*&?\s*G|공포|탐욕|반도체|AI|나스닥|S&P|코스피|코스닥|포트폴리오|스크리너|규제|법률|세법|세금|SEC|금융위원회|금감원|stock|market|sector|company|earnings|filing|rate|bond|yield|fx|oil|semiconductor|portfolio|screener|regulation|legal|tax)/i;
const TICKER_RE = /\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/;

function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }

function validDate(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

function sourcePolicyId(primary, { currentSensitive, causalSensitive, outOfScope }) {
  if (outOfScope) return 'out-of-scope-current';
  if (causalSensitive || primary === 'MARKET_CAUSAL') return 'market-causal';
  if (primary === 'ENTITY_ANALYSIS' || primary === 'ENTITY_FACT') return 'company-primary';
  if (primary === 'MACRO_ANALYSIS' || primary === 'FX_ANALYSIS') return 'official-macro';
  if (currentSensitive || primary === 'MARKET_STATUS' || primary === 'OUTLOOK') return 'market-current';
  if (primary === 'NEWS_SUMMARY') return 'news-evidence';
  if (primary === 'SECTOR_ANALYSIS') return 'sector-reference';
  return 'education-reference';
}

function questionClass(primary, { concept, currentSensitive, causalSensitive, outOfScope }) {
  if (outOfScope) return 'OUT_OF_SCOPE_RESEARCH';
  if (causalSensitive) return 'CAUSE_ATTRIBUTION';
  if (concept && !currentSensitive) return 'CONCEPT_EXPLANATION';
  if (currentSensitive) return 'CURRENT_STATE';
  if (primary === 'ENTITY_ANALYSIS' || primary === 'ENTITY_FACT') return 'ENTITY_FACT';
  if (primary === 'SECTOR_ANALYSIS') return 'SECTOR_REFERENCE';
  if (primary === 'NEWS_SUMMARY') return 'EVENT_SUMMARY';
  return 'STATIC_ANALYSIS';
}

function freezeDecision(decision) {
  return Object.freeze({
    ...decision,
    reasons: Object.freeze([...new Set(decision.reasons || [])]),
    minimumIndependentSources: Number(decision.minimumIndependentSources) || 0,
    minimumPrimarySources: Number(decision.minimumPrimarySources) || 0
  });
}

/**
 * Decide whether research is needed from the question alone. Provider keys,
 * quotas, and worker health are deliberately not read here; they belong to
 * the separate ResearchCapability contract.
 */
export function createResearchDecision({ questionPlan = {}, userOptOut = false, now = new Date() } = {}) {
  const decidedAt = validDate(now);
  const query = text(questionPlan.query);
  const primary = questionPlan.intent?.primary || 'UNKNOWN';
  const eventCurrent = /(이번|최근|최신|latest|recent).*(실적|발표|가이던스|공시|뉴스|earnings|filing|guidance|release)/i.test(query);
  const currentSensitive = Boolean(questionPlan.currentSensitive || CURRENT_RE.test(query) || eventCurrent);
  const causalSensitive = primary === 'MARKET_CAUSAL' || CAUSAL_RE.test(query);
  const concept = CONCEPT_RE.test(query);
  const requestedByUser = EXPLICIT_SEARCH_RE.test(query);
  const intentNames = Array.isArray(questionPlan.intent?.intents) ? questionPlan.intent.intents : [primary];
  const hasFinanceDomainIntent = intentNames.some((name) => ['SECTOR_ANALYSIS', 'ENTITY_ANALYSIS', 'ENTITY_FACT', 'COMPARISON', 'TECHNICAL_ANALYSIS', 'OPTIONS_ANALYSIS', 'MACRO_ANALYSIS', 'FX_ANALYSIS', 'SCREENING', 'PORTFOLIO_ACTION'].includes(name));
  const hasDomain = DOMAIN_RE.test(query) || Boolean(questionPlan.entities?.entities?.length) || hasFinanceDomainIntent;
  const outOfScope = currentSensitive && !hasDomain && !TICKER_RE.test(query);
  const snapshotEligible = currentSensitive && !causalSensitive && !eventCurrent && !requestedByUser &&
    intentNames.some((name) => ['MARKET_STATUS', 'OUTLOOK', 'SECTOR_ANALYSIS', 'ENTITY_ANALYSIS', 'ENTITY_FACT', 'TECHNICAL_ANALYSIS', 'OPTIONS_ANALYSIS', 'MACRO_ANALYSIS', 'FX_ANALYSIS'].includes(name));
  const reasons = [];

  let requirement = 'NOT_NEEDED';
  if (outOfScope) {
    requirement = 'REQUIRED';
    reasons.push('current question is outside the screener evidence domain');
  } else if (snapshotEligible) {
    requirement = 'OPTIONAL';
    reasons.push('verified in-app snapshot can answer the current state; web research is enrichment');
  } else if (currentSensitive || causalSensitive) {
    requirement = 'REQUIRED';
    if (currentSensitive) reasons.push('question contains current-sensitive language');
    if (causalSensitive) reasons.push('causal attribution requires event evidence');
  } else if (concept && !requestedByUser) {
    requirement = 'NOT_NEEDED';
    reasons.push('concept explanation can use validated internal knowledge');
  } else if (['ENTITY_ANALYSIS', 'ENTITY_FACT', 'COMPARISON', 'OPTIONS_ANALYSIS', 'SECTOR_ANALYSIS', 'NEWS_SUMMARY'].includes(primary) || requestedByUser) {
    requirement = 'OPTIONAL';
    reasons.push('research can improve a non-current reference answer');
  } else {
    reasons.push('no current or causal evidence requirement detected');
  }

  if (userOptOut && requirement === 'REQUIRED') {
    reasons.push('user disabled web research; current claims remain blocked');
  }

  const policyId = sourcePolicyId(primary, { currentSensitive, causalSensitive, outOfScope });
  const isRequired = requirement === 'REQUIRED';
  const minimumIndependentSources = causalSensitive ? 2 : isRequired ? 1 : 0;
  const minimumPrimarySources = causalSensitive || currentSensitive || outOfScope ? 1 : 0;
  const freshnessSlo = currentSensitive ? 'same-session-or-explicit-delayed' : causalSensitive ? 'event-window-72h' : 'reference-30d';
  const maxResearchBudget = questionPlan.requestedDepth === 'deep' ? 5 : isRequired ? 3 : 2;
  const failureMode = isRequired
    ? (userOptOut ? 'REQUIRED_BUT_DISABLED' : 'FAIL_CLOSED_CURRENT_CLAIMS')
    : requirement === 'OPTIONAL' ? 'DEGRADE_TO_REFERENCE' : 'NO_RESEARCH';

  return freezeDecision({
    schemaVersion: AI_RESEARCH_DECISION_VERSION,
    requirement,
    reasons,
    questionClass: questionClass(primary, { concept, currentSensitive, causalSensitive, outOfScope }),
    currentSensitive,
    causalSensitive,
    outOfScope,
    requestedByUser,
    freshnessSlo,
    sourcePolicyId: policyId,
    minimumIndependentSources,
    minimumPrimarySources,
    maxResearchBudget,
    failureMode,
    userOptOut: Boolean(userOptOut),
    decidedAt: decidedAt.toISOString()
  });
}

export function validateResearchDecision(decision) {
  const errors = [];
  if (!decision || decision.schemaVersion !== AI_RESEARCH_DECISION_VERSION) errors.push('schema_version_invalid');
  if (!RESEARCH_REQUIREMENTS.includes(decision?.requirement)) errors.push('requirement_invalid');
  if (!decision?.questionClass) errors.push('question_class_missing');
  if (!decision?.sourcePolicyId) errors.push('source_policy_missing');
  if (!decision?.failureMode) errors.push('failure_mode_missing');
  if (decision?.requirement === 'REQUIRED' && Number(decision?.minimumIndependentSources) < 1) errors.push('required_source_floor_missing');
  if (decision?.userOptOut && decision?.requirement === 'REQUIRED' && decision?.failureMode !== 'REQUIRED_BUT_DISABLED') errors.push('optout_failure_mode_invalid');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}
