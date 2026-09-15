import { createResearchDecision } from './decision.js';

export const AI_RESEARCH_PLAN_VERSION = 'research-plan.v1';

const BLOCKED_DOMAINS = Object.freeze([
  'investing.com',
  'macromicro.me',
  'marketwatch.com',
  'wsj.com'
]);

/**
 * Search allowlists are not source authority.  Keep candidate domains and
 * the evidence tier/purpose required for a claim in one immutable policy so
 * a media or exchange aggregator cannot satisfy a company-primary floor by
 * merely appearing in `allowedDomains`.
 */
export const RESEARCH_SOURCE_POLICIES = Object.freeze({
  'market-current': Object.freeze({
    allowedDomains: Object.freeze(['fred.stlouisfed.org', 'cboe.com', 'finance.yahoo.com', 'sec.gov']),
    primaryDomains: Object.freeze(['fred.stlouisfed.org', 'cboe.com', 'sec.gov']),
    secondaryDomains: Object.freeze(['finance.yahoo.com']),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'official-market-observation-or-filing',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'public-market-context'
  }),
  'market-causal': Object.freeze({
    allowedDomains: Object.freeze(['federalreserve.gov', 'fred.stlouisfed.org', 'cboe.com', 'sec.gov']),
    primaryDomains: Object.freeze(['federalreserve.gov', 'fred.stlouisfed.org', 'cboe.com', 'sec.gov']),
    secondaryDomains: Object.freeze([]),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'official-event-or-market-observation',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'independent-causal-context'
  }),
  'company-primary': Object.freeze({
    // SEC filings are primary by default. Issuer IR may be added only from a
    // verified issuer registry; a URL that merely contains `ir.` or
    // `investor.` is never enough to grant primary authority.
    allowedDomains: Object.freeze(['sec.gov', 'investors.com', 'nasdaq.com']),
    primaryDomains: Object.freeze(['sec.gov']),
    secondaryDomains: Object.freeze(['investors.com', 'nasdaq.com']),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'sec-filing-or-issuer-ir-announcement',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'media-or-exchange-aggregation-context'
  }),
  'official-macro': Object.freeze({
    allowedDomains: Object.freeze(['federalreserve.gov', 'bls.gov', 'bea.gov', 'fred.stlouisfed.org', 'bok.or.kr', 'kosis.kr']),
    primaryDomains: Object.freeze(['federalreserve.gov', 'bls.gov', 'bea.gov', 'fred.stlouisfed.org', 'bok.or.kr', 'kosis.kr']),
    secondaryDomains: Object.freeze([]),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'official-macro-release',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'macro-context'
  }),
  'news-evidence': Object.freeze({
    allowedDomains: Object.freeze(['reuters.com', 'apnews.com', 'bbc.com']),
    primaryDomains: Object.freeze([]),
    secondaryDomains: Object.freeze(['reuters.com', 'apnews.com', 'bbc.com']),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'official-event-record',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'independent-news-report'
  }),
  'sector-reference': Object.freeze({
    allowedDomains: Object.freeze(['sec.gov', 'bea.gov', 'bls.gov']),
    primaryDomains: Object.freeze(['sec.gov', 'bea.gov', 'bls.gov']),
    secondaryDomains: Object.freeze([]),
    primaryTier: 'T1_OFFICIAL',
    primaryPurpose: 'official-sector-or-company-reference',
    secondaryTier: 'T3_PUBLIC_DELAYED',
    secondaryPurpose: 'sector-context'
  }),
  'out-of-scope-current': Object.freeze({ allowedDomains: Object.freeze([]), primaryDomains: Object.freeze([]), secondaryDomains: Object.freeze([]), primaryTier: 'T1_OFFICIAL', primaryPurpose: 'out-of-scope', secondaryTier: 'T3_PUBLIC_DELAYED', secondaryPurpose: 'out-of-scope' }),
  'education-reference': Object.freeze({ allowedDomains: Object.freeze([]), primaryDomains: Object.freeze([]), secondaryDomains: Object.freeze([]), primaryTier: 'T1_OFFICIAL', primaryPurpose: 'education-reference', secondaryTier: 'T3_PUBLIC_DELAYED', secondaryPurpose: 'education-reference' })
});

function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }

function normalizeDomain(value) {
  const raw = text(value).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(raw) ? raw : null;
}

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

function verifiedIssuerDomains(questionPlan, issuerRegistry) {
  const registry = issuerRegistry && typeof issuerRegistry === 'object' ? issuerRegistry : {};
  const entities = Array.isArray(questionPlan?.entities?.entities) ? questionPlan.entities.entities : [];
  return unique(entities.flatMap((entity) => {
    const symbol = text(entity?.symbol).toUpperCase();
    const record = symbol ? registry[symbol] : null;
    if (!record || record.verification !== 'sec-registrant-issuer-ir' || record.verified !== true) return [];
    return (Array.isArray(record.issuerIrDomains) ? record.issuerIrDomains : []).map(normalizeDomain).filter(Boolean);
  }));
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
  const policy = options.sourcePolicy;
  return Object.freeze({
    queryId: `rq-${options.index + 1}`,
    purpose,
    query: text(query),
    claimTypes: Object.freeze([...claimTypes]),
    locale: options.locale,
    allowedDomains: Object.freeze([...options.allowedDomains]),
    blockedDomains: Object.freeze([...BLOCKED_DOMAINS]),
    recency: options.recency.mode,
    lookbackDays: options.recency.lookbackDays,
    primaryRequired: Boolean(options.primaryRequired),
    sourcePolicyId: options.sourcePolicyId,
    sourcePolicy: Object.freeze({
      primary: Object.freeze({
        tier: policy.primaryTier,
        purpose: policy.primaryPurpose,
        domains: Object.freeze([...policy.primaryDomains]),
        verifiedIssuerDomains: Object.freeze([...(policy.verifiedIssuerDomains || [])]),
        issuerRegistryVerification: options.sourcePolicyId === 'company-primary' ? 'sec-registrant-issuer-ir' : null
      }),
      secondary: Object.freeze({
        tier: policy.secondaryTier,
        purpose: policy.secondaryPurpose,
        domains: Object.freeze([...policy.secondaryDomains])
      })
    })
  });
}

export function createResearchPlan({ questionPlan = {}, decision = null, now = new Date(), issuerRegistry = null } = {}) {
  const planNow = new Date(now);
  const safeNow = Number.isFinite(planNow.getTime()) ? planNow : new Date(0);
  const researchDecision = decision || createResearchDecision({ questionPlan, now: safeNow });
  const query = text(questionPlan.query);
  const date = dateOnly(safeNow);
  const locale = localeFor(questionPlan);
  const recency = recencyFor(researchDecision);
  const entities = entityTokens(questionPlan);
  const subject = entities.length ? `${entities.join(' ')} ${query}` : query;
  const sourcePolicyId = researchDecision.sourcePolicyId || 'education-reference';
  const basePolicy = RESEARCH_SOURCE_POLICIES[sourcePolicyId] || RESEARCH_SOURCE_POLICIES['education-reference'];
  const verifiedDomains = sourcePolicyId === 'company-primary' ? verifiedIssuerDomains(questionPlan, issuerRegistry) : [];
  const sourcePolicy = Object.freeze({
    ...basePolicy,
    primaryDomains: Object.freeze(unique([...basePolicy.primaryDomains, ...verifiedDomains])),
    allowedDomains: Object.freeze(unique([...basePolicy.allowedDomains, ...verifiedDomains])),
    verifiedIssuerDomains: Object.freeze(verifiedDomains)
  });
  const allowedDomains = sourcePolicy.allowedDomains;
  const claimTypes = researchDecision.causalSensitive ? ['current-state', 'event', 'causal'] : researchDecision.currentSensitive ? ['current-state', 'metric'] : ['reference'];
  const subQueries = [];
  const add = (value, purpose, types = claimTypes, primaryRequired = false) => {
    const candidate = text(value);
    if (!candidate || subQueries.some((item) => item.query.toLowerCase() === candidate.toLowerCase())) return;
    subQueries.push(querySpec(candidate, purpose, types, { index: subQueries.length, locale, allowedDomains, recency, primaryRequired, sourcePolicyId, sourcePolicy }));
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

  const requestedBudget = researchDecision.maxResearchBudget;
  const maxQueries = Number.isInteger(requestedBudget) && requestedBudget >= 0 ? Math.min(requestedBudget, 10) : 0;
  const boundedQueries = subQueries.slice(0, maxQueries);
  return Object.freeze({
    schemaVersion: AI_RESEARCH_PLAN_VERSION,
    planId: `research:${questionPlan.queryId || date}`,
    questionId: questionPlan.queryId || null,
    market: questionPlan.market || 'UNKNOWN',
    entities: Object.freeze(entities),
    eventWindow: Object.freeze({ asOf: date, lookbackDays: recency.lookbackDays }),
    priceReactionWindow: researchDecision.causalSensitive ? Object.freeze({ beforeHours: 2, afterHours: 8 }) : null,
    referenceContext: Object.freeze({
      frameworkIds: Object.freeze([...(questionPlan.referenceContext?.frameworkIds || [])]),
      conceptIds: Object.freeze([...(questionPlan.referenceContext?.conceptIds || [])]),
      stages: Object.freeze([...(questionPlan.referenceContext?.stages || [])]),
      evidenceSeparation: Object.freeze([...(questionPlan.referenceContext?.separation || [])]),
      currentClaimsAllowed: false,
      rankingUse: 'none'
    }),
    subQueries: Object.freeze(boundedQueries),
    stopConditions: Object.freeze({
      minimumIndependentSources: researchDecision.minimumIndependentSources,
      minimumPrimarySources: researchDecision.minimumPrimarySources,
      failClosed: researchDecision.requirement === 'REQUIRED',
      blockedDomains: Object.freeze([...BLOCKED_DOMAINS])
    }),
    budget: Object.freeze({ maxSubQueries: maxQueries, maxResultsPerQuery: 5, providerAttempts: 2 }),
    generatedAt: safeNow.toISOString()
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
    if (!query.sourcePolicy?.primary?.tier || !query.sourcePolicy?.primary?.purpose || !Array.isArray(query.sourcePolicy.primary.domains)
      || !query.sourcePolicy?.secondary?.tier || !query.sourcePolicy?.secondary?.purpose || !Array.isArray(query.sourcePolicy.secondary.domains)) errors.push('subquery_source_tier_policy_missing');
    if (query.primaryRequired && query.sourcePolicy.primary.domains.length === 0) errors.push('primary_floor_without_primary_domain');
    if (query.sourcePolicyId === 'company-primary'
      && (query.sourcePolicy.primary.domains.includes('investors.com') || query.sourcePolicy.primary.domains.includes('nasdaq.com'))) errors.push('company_aggregator_misclassified_as_primary');
    if (query.sourcePolicyId === 'company-primary') {
      const verifiedDomains = new Set(Array.isArray(query.sourcePolicy.primary.verifiedIssuerDomains) ? query.sourcePolicy.primary.verifiedIssuerDomains : []);
      if ((query.sourcePolicy.primary.domains || []).some((domain) => domain !== 'sec.gov' && !verifiedDomains.has(domain))) errors.push('company_primary_domain_without_issuer_registry');
      if ((query.sourcePolicy.primary.verifiedIssuerDomains || []).some((domain) => !query.sourcePolicy.primary.domains.includes(domain))) errors.push('issuer_registry_domain_not_in_primary_allowlist');
      if (query.sourcePolicy.primary.issuerRegistryVerification !== 'sec-registrant-issuer-ir') errors.push('issuer_registry_verification_missing');
    }
    if (query.query && /\b20\d{2}\b/.test(query.query) && !query.query.includes(plan.eventWindow.asOf)) errors.push('hardcoded_year_without_current_date');
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}
