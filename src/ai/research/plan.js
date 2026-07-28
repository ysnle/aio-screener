import { createResearchDecision } from './decision.js';

export const AI_RESEARCH_PLAN_VERSION = 'research-plan.v1';

const BLOCKED_DOMAINS = Object.freeze([
  'investing.com',
  'macromicro.me',
  'marketwatch.com',
  'wsj.com'
]);

const PRIMARY_DOMAINS = Object.freeze({
  'market-current': ['fred.stlouisfed.org', 'cboe.com', 'finance.yahoo.com', 'sec.gov'],
  'market-causal': ['federalreserve.gov', 'fred.stlouisfed.org', 'cboe.com', 'sec.gov'],
  'company-primary': ['sec.gov', 'investors.com', 'nasdaq.com'],
  'official-macro': ['federalreserve.gov', 'bls.gov', 'bea.gov', 'fred.stlouisfed.org', 'bok.or.kr', 'kosis.kr'],
  'news-evidence': ['reuters.com', 'apnews.com', 'bbc.com'],
  'sector-reference': ['sec.gov', 'bea.gov', 'bls.gov'],
  'out-of-scope-current': [],
  'education-reference': []
});

function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function dateOnly(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function entityTokens(questionPlan) {
  return unique((questionPlan.entities?.entities || []).flatMap((entity) => [entity.symbol, entity.name, entity.alias])).slice(0, 6);
}

function localeFor(questionPlan) {
  return questionPlan.market === 'KR' ? 'ko-KR' : questionPlan.market === 'US' ? 'en-US' : 'ko-KR';
}

function recencyFor(decision) {
  if (decision.causalSensitive) return { mode: 'week', lookbackDays: 3 };
  if (decision.currentSensitive) return { mode: 'day', lookbackDays: 1 };
  return { mode: 'month', lookbackDays: 30 };
}

function querySpec(query, purpose, claimTypes, options) {
  return {
    queryId: `rq-${options.index + 1}`,
    purpose,
    query: text(query),
    claimTypes: Object.freeze([...claimTypes]),
    locale: options.locale,
    allowedDomains: Object.freeze([...options.allowedDomains]),
    blockedDomains: Object.freeze([...BLOCKED_DOMAINS]),
    recency: options.recency.mode,
    lookbackDays: options.recency.lookbackDays,
    primaryRequired: Boolean(options.primaryRequired)
  };
}

export function createResearchPlan({ questionPlan = {}, decision = null, now = new Date() } = {}) {
  const researchDecision = decision || createResearchDecision({ questionPlan, now });
  const query = text(questionPlan.query);
  const date = dateOnly(now);
  const locale = localeFor(questionPlan);
  const recency = recencyFor(researchDecision);
  const entities = entityTokens(questionPlan);
  const subject = entities.length ? `${entities.join(' ')} ${query}` : query;
  const allowedDomains = PRIMARY_DOMAINS[researchDecision.sourcePolicyId] || [];
  const claimTypes = researchDecision.causalSensitive ? ['current-state', 'event', 'causal'] : researchDecision.currentSensitive ? ['current-state', 'metric'] : ['reference'];
  const subQueries = [];
  const add = (value, purpose, types = claimTypes, primaryRequired = false) => {
    const candidate = text(value);
    if (!candidate || subQueries.some((item) => item.query.toLowerCase() === candidate.toLowerCase())) return;
    subQueries.push(querySpec(candidate, purpose, types, { index: subQueries.length, locale, allowedDomains, recency, primaryRequired }));
  };

  if (researchDecision.requirement === 'REQUIRED') {
    add(`${subject} official primary source as of ${date}`, 'premise-primary', ['current-state', 'metric'], true);
    if (researchDecision.causalSensitive) {
      add(`${subject} market moving event cause independent reporting ${date}`, 'event-news', ['event', 'causal'], false);
      add(`${subject} alternative explanation counter hypothesis ${date}`, 'counter-hypothesis', ['causal', 'alternative'], false);
    } else {
      add(`${subject} latest filing release or official announcement ${date}`, 'official-update', ['current-state', 'event'], true);
    }
  } else if (researchDecision.requirement === 'OPTIONAL') {
    add(`${subject} recent authoritative reference ${date}`, 'reference-refresh', ['reference'], false);
  }

  const maxQueries = Math.max(0, Number(researchDecision.maxResearchBudget) || 0);
  const boundedQueries = subQueries.slice(0, maxQueries);
  return Object.freeze({
    schemaVersion: AI_RESEARCH_PLAN_VERSION,
    planId: `research:${questionPlan.queryId || date}`,
    questionId: questionPlan.queryId || null,
    market: questionPlan.market || 'UNKNOWN',
    entities: Object.freeze(entities),
    eventWindow: Object.freeze({ asOf: date, lookbackDays: recency.lookbackDays }),
    priceReactionWindow: researchDecision.causalSensitive ? Object.freeze({ beforeHours: 2, afterHours: 8 }) : null,
    subQueries: Object.freeze(boundedQueries),
    stopConditions: Object.freeze({
      minimumIndependentSources: researchDecision.minimumIndependentSources,
      minimumPrimarySources: researchDecision.minimumPrimarySources,
      failClosed: researchDecision.requirement === 'REQUIRED',
      blockedDomains: Object.freeze([...BLOCKED_DOMAINS])
    }),
    budget: Object.freeze({ maxSubQueries: maxQueries, maxResultsPerQuery: 5, providerAttempts: 2 }),
    generatedAt: new Date(now).toISOString()
  });
}

export function validateResearchPlan(plan) {
  const errors = [];
  if (!plan || plan.schemaVersion !== AI_RESEARCH_PLAN_VERSION) errors.push('schema_version_invalid');
  if (!plan?.planId || !plan?.questionId) errors.push('identity_missing');
  if (!Array.isArray(plan?.subQueries)) errors.push('subqueries_missing');
  for (const query of plan?.subQueries || []) {
    if (!query.queryId || !query.query || !query.purpose) errors.push('subquery_identity_missing');
    if (!Array.isArray(query.allowedDomains) || !Array.isArray(query.blockedDomains)) errors.push('subquery_source_policy_missing');
    if (query.query && /\b20\d{2}\b/.test(query.query) && !query.query.includes(plan.eventWindow.asOf)) errors.push('hardcoded_year_without_current_date');
  }
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
