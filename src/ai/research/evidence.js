import { companyEntitySymbols } from '../orchestrator/question-planner.js';

export const AI_RESEARCH_EVIDENCE_VERSION = 'research-evidence.v1';

const CONTENT_DEPTH = Object.freeze(['FULL_TEXT', 'EXCERPT', 'SNIPPET', 'SUMMARY']);
const RIGHTS = Object.freeze(['REVIEW_REQUIRED', 'PUBLIC_REFERENCE', 'LICENSED', 'BLOCKED']);
const PRIMARY_OFFICIAL_SUFFIXES = Object.freeze([
  'sec.gov', 'federalreserve.gov', 'bls.gov', 'bea.gov', 'fred.stlouisfed.org',
  'cboe.com', 'nasdaq.com', 'nyse.com', 'bok.or.kr', 'kosis.kr', 'krx.co.kr',
  // 2026-10-19 data audit: official sources the answers already cite (Treasury yields and auctions, ECB/BoJ/BoE policy,
  // EIA oil inventories, DART filings, the KR statistics office) were graded as ordinary web pages.
  'treasury.gov', 'treasurydirect.gov', 'ecb.europa.eu', 'boj.or.jp', 'bankofengland.co.uk', 'eia.gov', 'dart.fss.or.kr', 'customs.go.kr'
]);
// The news screen's tier-1 publishers (scripts/lib/news-selection.mjs SERVER_NEWS_TIER1_SOURCE_RE), by domain.
const TIER_1_SUFFIXES = Object.freeze(['reuters.com', 'apnews.com', 'bbc.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'cnbc.com']);

function text(value) { return String(value == null ? '' : value).trim(); }

function canonicalUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'oc'].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, '');
  } catch (_) { return ''; }
}

function publisherFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; }
}

function hostMatches(host, suffixes) {
  const normalized = String(host || '').replace(/^www\./, '').toLowerCase();
  return suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

function sourceTier(url) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
  if (hostMatches(host, PRIMARY_OFFICIAL_SUFFIXES)) return 'PRIMARY_OFFICIAL';
  if (hostMatches(host, TIER_1_SUFFIXES)) return 'TIER_1_WIRE';
  if (host) return 'SECONDARY';
  return 'UNKNOWN';
}

export function createEvidenceDocument(input = {}) {
  const canonical = canonicalUrl(input.canonicalUrl || input.url);
  const contentDepth = CONTENT_DEPTH.includes(input.contentDepth) ? input.contentDepth : 'SNIPPET';
  const rights = RIGHTS.includes(input.rights) ? input.rights : 'REVIEW_REQUIRED';
  const derivedTier = sourceTier(canonical, input.source);
  const document = {
    schemaVersion: AI_RESEARCH_EVIDENCE_VERSION,
    documentId: text(input.documentId) || `doc:${canonical || text(input.title)}`,
    canonicalUrl: canonical || null,
    title: text(input.title),
    publisher: publisherFromUrl(canonical) || text(input.publisher),
    author: text(input.author) || null,
    publishedAt: input.publishedAt || null,
    updatedAt: input.updatedAt || null,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
    sourceTier: derivedTier,
    sourceType: text(input.sourceType) || 'web-search',
    primaryOrSecondary: derivedTier === 'PRIMARY_OFFICIAL' ? 'PRIMARY' : 'SECONDARY',
    rights,
    contentDepth,
    locale: text(input.locale) || null,
    entities: Object.freeze(Array.isArray(input.entities) ? input.entities.map(text).filter(Boolean) : []),
    eventTime: input.eventTime || input.publishedAt || null,
    status: canonical ? text(input.status || 'RESULTS_FOUND').toUpperCase() : 'INVALID',
    // P1172 (05 A05): the request context a document was collected for. Without it a later question
    // cannot tell this set from another request's set, so the floor had to treat "official domain"
    // as "this question is answered". Declared here (not in the caller) so normalization keeps it.
    requestId: text(input.requestId) || null,
    queryId: text(input.queryId) || text(input.requestId) || null,
    entity: text(input.entity) || null
  };
  document.allowedUse = rights === 'BLOCKED' ? 'none' : contentDepth === 'SNIPPET' || contentDepth === 'SUMMARY' ? 'reference-only' : 'research-reference';
  return Object.freeze(document);
}

export function createEvidenceChunk(input = {}) {
  const chunk = {
    chunkId: text(input.chunkId) || `chunk:${text(input.documentId)}:${text(input.text).slice(0, 32)}`,
    documentId: text(input.documentId),
    text: text(input.text),
    section: text(input.section) || null,
    citedText: text(input.citedText) || null,
    extractionMethod: text(input.extractionMethod) || 'provider-result',
    integrityHash: text(input.integrityHash) || null
  };
  return Object.freeze(chunk);
}

export function normalizeSearchResult(result = {}, options = {}) {
  const document = createEvidenceDocument({
    ...result,
    fetchedAt: result.fetchedAt || options.fetchedAt,
    locale: result.locale || options.locale,
    contentDepth: result.contentDepth || (result.snippet ? 'SNIPPET' : 'SUMMARY')
  });
  const textValue = text(result.content || result.snippet || result.answer || result.title);
  const chunk = createEvidenceChunk({ documentId: document.documentId, text: textValue, citedText: result.citedText });
  return Object.freeze({ document, chunks: Object.freeze([chunk]) });
}

export function normalizeSearchResults(results = [], options = {}) {
  const byUrl = new Map();
  for (const result of Array.isArray(results) ? results : []) {
    const normalized = normalizeSearchResult(result, options);
    const key = normalized.document.canonicalUrl || normalized.document.documentId;
    if (!byUrl.has(key)) byUrl.set(key, normalized);
  }
  const items = [...byUrl.values()];
  const independenceKeys = new Set(items.map((item) => item.document.publisher || item.document.canonicalUrl).filter(Boolean));
  return Object.freeze({
    schemaVersion: AI_RESEARCH_EVIDENCE_VERSION,
    documents: Object.freeze(items.map((item) => item.document)),
    chunks: Object.freeze(items.flatMap((item) => item.chunks)),
    independentSourceCount: independenceKeys.size,
    duplicateCount: Math.max(0, (Array.isArray(results) ? results.length : 0) - items.length)
  });
}

export function validateClaimEvidenceBinding(claim, evidence, { currentSensitive = false, minimumIndependentSources = 0, minimumPrimarySources = 0 } = {}) {
  const errors = [];
  const ids = new Set(Array.isArray(claim?.evidenceIds) ? claim.evidenceIds.map(String) : []);
  const documents = Array.isArray(evidence?.documents) ? evidence.documents.filter((doc) => ids.has(doc?.documentId)).map(createEvidenceDocument) : [];
  if ([...ids].some((id) => !documents.some((doc) => doc.documentId === id))) errors.push('claim_evidence_id_unbound');
  if (documents.some((doc) => !usableDocument(doc))) errors.push('claim_evidence_unavailable');
  if (![minimumIndependentSources, minimumPrimarySources].every((value) => Number.isInteger(value) && value >= 0)) errors.push('source_floor_invalid');
  if (currentSensitive && documents.length === 0) errors.push('current_claim_evidence_missing');
  if (documents.some((doc) => doc.contentDepth === 'SNIPPET' || doc.contentDepth === 'SUMMARY')) errors.push('snippet_or_summary_not_sufficient_alone');
  if (documents.some((doc) => doc.rights === 'BLOCKED' || doc.allowedUse === 'none')) errors.push('rights_blocked');
  const usable = documents.filter(usableDocument);
  const independent = new Set(usable.map((doc) => doc.publisher || doc.canonicalUrl).filter(Boolean)).size;
  const primary = new Set(usable.filter((doc) => doc.primaryOrSecondary === 'PRIMARY').map((doc) => doc.publisher)).size;
  if (independent < minimumIndependentSources) errors.push('independent_source_floor_missing');
  if (primary < minimumPrimarySources) errors.push('primary_source_floor_missing');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]), documentCount: documents.length, independentSourceCount: independent, primarySourceCount: primary });
}

function uniqueCitations(citations = []) {
  const seen = new Set();
  return (Array.isArray(citations) ? citations : []).filter((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    const canonical = canonicalUrl(url);
    if (!canonical || seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  }).map((item) => typeof item === 'string' ? canonicalUrl(item) : Object.freeze({ ...item, url: canonicalUrl(item.url) }));
}

function normalizeDocuments(documents = []) {
  const seen = new Set();
  return (Array.isArray(documents) ? documents : []).map((document) => createEvidenceDocument({
    ...document,
    canonicalUrl: document?.canonicalUrl,
    source: document?.publisher || document?.source || '',
    contentDepth: document?.contentDepth,
    rights: document?.rights || 'PUBLIC_REFERENCE'
  })).filter((document) => {
    const key = document.documentId || document.canonicalUrl;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Canonical result boundary shared by the legacy provider adapter and the ESM
 * response gate. `researchEvidence.evidenceDocuments` is the single source of
 * truth; the top-level field is accepted only as an input compatibility shape.
 */
export function normalizeResearchExecutionResult(result = {}) {
  const nested = result && typeof result.researchEvidence === 'object' ? result.researchEvidence : {};
  const { evidenceDocuments: legacyEvidenceDocuments, researchEvidence: legacyResearchEvidence, ...rest } = result || {};
  const documents = normalizeDocuments(
    Array.isArray(nested.evidenceDocuments) ? nested.evidenceDocuments : legacyEvidenceDocuments
  );
  const citations = uniqueCitations(result.citations);
  const independentSourceCount = new Set(
    documents.map((document) => document?.publisher || document?.canonicalUrl).filter(Boolean)
  ).size;
  const primarySourceCount = new Set(documents.filter((document) =>
    document?.primaryOrSecondary === 'PRIMARY' || document?.sourceTier === 'PRIMARY_OFFICIAL'
  ).map((document) => document?.publisher || document?.canonicalUrl).filter(Boolean)).size;
  return Object.freeze({
    ...rest,
    citations: Object.freeze(citations),
    researchEvidence: Object.freeze({
      ...nested,
      evidenceDocuments: Object.freeze(documents),
      independentSourceCount,
      primarySourceCount,
      currentClaimsAllowed: nested.currentClaimsAllowed === true
    })
  });
}

export function normalizeNativeResearchCitations(citations = []) {
  return Object.freeze(uniqueCitations(citations).map((item, index) => {
    const url = typeof item === 'string' ? item : item.url;
    return createEvidenceDocument({
      documentId: `native-web:${index}:${publisherFromUrl(url)}`,
      canonicalUrl: url,
      title: typeof item === 'string' ? '' : item.title,
      publisher: publisherFromUrl(url),
      contentDepth: 'EXCERPT',
      rights: 'PUBLIC_REFERENCE',
      sourceType: 'openai-native-web-search',
      requestId: typeof item === 'string' ? null : item.requestId,
      queryId: typeof item === 'string' ? null : item.queryId,
      entity: typeof item === 'string' ? null : item.entity,
      publishedAt: typeof item === 'string' ? null : item.publishedAt,
      eventTime: typeof item === 'string' ? null : item.eventTime
    });
  }));
}

function usableDocument(document) {
  return !!document?.canonicalUrl && document.status === 'RESULTS_FOUND' &&
    document.rights !== 'BLOCKED' && document.allowedUse !== 'none' &&
    document.contentDepth !== 'SNIPPET' && document.contentDepth !== 'SUMMARY';
}

function eligibleEvidenceDocuments(documents, citations) {
  const citationSet = new Set((Array.isArray(citations) ? citations : [])
    .map((citation) => canonicalUrl(typeof citation === 'string' ? citation : citation?.url)).filter(Boolean));
  // Rights-blocked/invalid documents must never satisfy the source floor, but a
  // single restricted result must not erase otherwise usable evidence from a
  // multi-provider response. Keep the exclusion observable through the caller's
  // document list while evaluating only eligible, citation-bound documents.
  return documents.filter((document) =>
    usableDocument(document) && citationSet.has(canonicalUrl(document.canonicalUrl))
  );
}

// v59.45 (pipeline review P12-RESEARCH-01): the research plan says which domains are primary for this question
// (company-primary: SEC filings and registry-verified issuer IR; Nasdaq and investors.com are secondary aggregation), but the
// floor counted the document's general tier, so one Nasdaq article met a company-primary floor. When the plan carries a
// source policy, only its primary domains count as primary; a plan without one keeps the general tier.
function planPrimaryDomains(questionPlan) {
  const queries = Array.isArray(questionPlan?.researchPlan?.subQueries) ? questionPlan.researchPlan.subQueries : [];
  const policies = queries.map((query) => query?.sourcePolicy?.primary).filter((primary) => primary && Array.isArray(primary.domains));
  if (!policies.length) return null;
  return [...new Set(policies.flatMap((primary) => [...primary.domains, ...(Array.isArray(primary.verifiedIssuerDomains) ? primary.verifiedIssuerDomains : [])])
    .map((domain) => String(domain || '').toLowerCase()).filter(Boolean))];
}

function isPrimaryDocument(document, primaryDomains) {
  if (Array.isArray(primaryDomains)) return hostMatches(publisherFromUrl(document?.canonicalUrl), primaryDomains);
  return document?.primaryOrSecondary === 'PRIMARY' || document?.sourceTier === 'PRIMARY_OFFICIAL';
}

function evidenceFloor(documents, citations, stop, { requireCurrentClaims = false, currentClaimsAllowed = false, primaryDomains = null } = {}) {
  const minimumIndependentSources = stop?.minimumIndependentSources;
  const minimumPrimarySources = stop?.minimumPrimarySources;
  if (!Number.isInteger(minimumIndependentSources) || minimumIndependentSources < 0 || !Number.isInteger(minimumPrimarySources) || minimumPrimarySources < 0) return false;
  const eligible = eligibleEvidenceDocuments(documents, citations);
  const independent = new Set(eligible.map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;
  const primary = new Set(eligible.filter((document) => isPrimaryDocument(document, primaryDomains))
    .map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;
  const snippetFree = eligible.length > 0 && eligible.every((document) =>
    document.contentDepth !== 'SNIPPET' && document.contentDepth !== 'SUMMARY'
  );
  return citations.length > 0 && eligible.length > 0 && snippetFree &&
    independent >= minimumIndependentSources &&
    primary >= minimumPrimarySources &&
    (!requireCurrentClaims || currentClaimsAllowed === true);
}

/**
 * P1172 (05 A05): a citation set must belong to the request it is used for.
 *
 * The floor checks domains, counts and content depth, so a cross-question set with an official
 * domain and enough independent primary sources satisfied it — "this URL is official" became
 * "this question is answered". Citations and documents are therefore bound to a request/query id
 * (and entity, where the question names one). An unbound set cannot be distinguished from another
 * request's set, so it is reported as unchecked instead of being silently promoted.
 */
export function verifyEvidenceBinding({ citations = [], documents = [], expectedQueryId = null, expectedQueryIds = null, expectedEntity = null, expectedEntities = null } = {}) {
  const rows = [...(Array.isArray(citations) ? citations : []), ...(Array.isArray(documents) ? documents : [])];
  const declaredOf = (row) => (row && typeof row === 'object' ? row.queryId || row.requestId || null : null);
  const declared = rows.map(declaredOf).filter(Boolean).map(String);
  const entities = rows.map((row) => (row && typeof row === 'object' ? row.entity || row.instrumentId || null : null)).filter(Boolean).map(String);
  const expected = [...(Array.isArray(expectedQueryIds) ? expectedQueryIds : []), ...(expectedQueryId == null ? [] : [expectedQueryId])]
    .filter(Boolean).map(String);
  // v59.45 (P12-RESEARCH-03): a comparison names several companies; a citation may belong to any of them.
  const entitySet = [...(Array.isArray(expectedEntities) ? expectedEntities : []), ...(expectedEntity == null ? [] : [expectedEntity])]
    .filter(Boolean).map((value) => String(value).toUpperCase());
  const entity = entitySet.length ? entitySet[0] : null;
  // v59.45 (pipeline review P12-RESEARCH-02): one declared id made the whole set BOUND, so an SEC citation for this request
  // plus a Reuters citation with no request id met a two-source floor as "verified". Binding is judged per document (a URL is
  // bound when its citation or its document declares an id); a mix is PARTIAL and only the bound documents may verify.
  const byUrl = new Map();
  rows.forEach((row, index) => {
    const url = canonicalUrl(typeof row === 'string' ? row : row?.canonicalUrl || row?.url);
    const key = url || `row:${index}`;
    if (!byUrl.has(key)) byUrl.set(key, { url, ids: [] });
    const id = declaredOf(row);
    if (id) byUrl.get(key).ids.push(String(id));
  });
  const boundUrls = [...byUrl.values()].filter((item) => item.url && item.ids.length && item.ids.every((id) => expected.includes(id))).map((item) => item.url);
  const unboundUrls = [...byUrl.values()].filter((item) => item.url && !item.ids.length).map((item) => item.url);
  if (!expected.length) {
    return Object.freeze({
      ok: true, checked: false, status: 'UNVERIFIABLE',
      reason: 'the caller did not declare which request this answer belongs to, so a citation binding cannot be judged'
    });
  }
  if (!declared.length) {
    return Object.freeze({
      ok: true, checked: false, status: 'UNBOUND',
      reason: 'no citation declares a request binding, so a set collected for another question is indistinguishable from this one'
    });
  }
  if (declared.some((value) => !expected.includes(value))) {
    return Object.freeze({ ok: false, checked: true, status: 'MISMATCHED_QUERY', reason: 'citation belongs to another request' });
  }
  if (entity && entities.length && entities.some((value) => !entitySet.includes(value.toUpperCase()))) {
    return Object.freeze({ ok: false, checked: true, status: 'MISMATCHED_ENTITY', reason: 'citation belongs to another entity' });
  }
  if (unboundUrls.length) {
    return Object.freeze({
      ok: true, checked: false, status: 'PARTIAL', boundUrls: Object.freeze(boundUrls), unboundUrls: Object.freeze(unboundUrls),
      reason: 'some citations declare no request binding'
    });
  }
  return Object.freeze({ ok: true, checked: true, status: 'BOUND', reason: null });
}

/** Execute the actual producer -> consumer contract instead of checking names. */
export function evaluateResearchEvidenceFloor(input = {}) {
  const questionPlan = input.questionPlan || {};
  const decision = questionPlan.researchDecision || {};
  const required = input.required === true || decision.requirement === 'REQUIRED';
  if (!required) return Object.freeze({ required: false, ready: true, reason: 'research-not-required', evidenceDocuments: Object.freeze([]) });

  const stop = questionPlan.researchPlan?.stopConditions || {};
  const external = normalizeResearchExecutionResult(input.externalResult || {});
  const externalDocuments = external.researchEvidence.evidenceDocuments;
  const externalCitations = external.citations;
  const nativeCitations = uniqueCitations(input.nativeCitations);
  const nativeDocuments = normalizeNativeResearchCitations(nativeCitations);
  const primaryDomains = planPrimaryDomains(questionPlan);
  const externalReady = evidenceFloor(externalDocuments, externalCitations, stop, {
    requireCurrentClaims: true,
    currentClaimsAllowed: external.researchEvidence.currentClaimsAllowed,
    primaryDomains
  });
  const nativeReady = evidenceFloor(nativeDocuments, nativeCitations, stop, { primaryDomains });
  // P1172 (05 A05): 도메인·개수·깊이가 충족돼도 그 출처가 **이 질문의 것**인지는 별개다. 취소·재시도·
  // 늦은 응답의 citation이 다른 요청의 답을 채우지 못하도록 요청 결속을 함께 판정한다.
  const binding = verifyEvidenceBinding({
    citations: [...externalCitations, ...nativeCitations],
    documents: [...externalDocuments, ...nativeDocuments],
    expectedQueryIds: [questionPlan.queryId, input.queryId, input.requestId].filter(Boolean),
    // v59.45 (pipeline review P12-RESEARCH-03): the question planner hands entities as the resolver object
    // `{ entities: [...] }`, which this check never read, so an MSFT citation passed an AAPL question.
    expectedEntity: questionPlan.entity || (Array.isArray(questionPlan.entities) ? questionPlan.entities[0] : null) || input.entity || null,
    expectedEntities: Array.isArray(questionPlan.entities?.entities) ? companyEntitySymbols(questionPlan) : null
  });
  // E6/A05: P1172 deliberately keeps an unjudgeable binding as `UNVERIFIABLE`/`UNBOUND` rather than a
  // failure, so a legitimate producer that has not stamped a request id is not reported as an error.
  // What was still missing is the distinction between "floor met with a verified binding" and "floor met
  // with an unchecked binding": both published `ready: true` and nothing separated them. `bindingVerified`
  // carries that boundary, so no consumer has to read `ready` as though the binding were confirmed.
  const ready = (externalReady || nativeReady) && binding.ok;
  const documents = externalReady ? externalDocuments : nativeReady ? nativeDocuments :
    (externalDocuments.length ? externalDocuments : nativeDocuments);
  const citations = externalReady ? externalCitations : nativeReady ? nativeCitations :
    (externalCitations.length ? externalCitations : nativeCitations);
  const eligibleDocuments = eligibleEvidenceDocuments(documents, citations);
  // v59.45 P12-RESEARCH-02: with a PARTIAL binding only the documents bound to this request can verify the answer;
  // the unbound ones stay as reference (ready) but never count toward the current-claim floor.
  const boundUrls = new Set(binding.status === 'PARTIAL' ? binding.boundUrls || [] : []);
  const verifiable = binding.status === 'PARTIAL' ? eligibleDocuments.filter((document) => boundUrls.has(canonicalUrl(document.canonicalUrl))) : eligibleDocuments;
  const bindingVerified = binding.ok === true && (binding.checked === true
    || (binding.status === 'PARTIAL' && evidenceFloor(verifiable, citations, stop, { primaryDomains })));
  // P1608: citation availability is not publication/event-time verification.
  // Search collection time and dates guessed from URLs never establish recency.
  const asOf = Date.parse(decision.decidedAt || questionPlan.researchPlan?.eventWindow?.asOf || '');
  const days = questionPlan.researchPlan?.eventWindow?.lookbackDays;
  const validWindow = Number.isFinite(asOf) && Number.isFinite(days) && days > 0;
  const dated = verifiable.filter(doc => Number.isFinite(Date.parse(doc.eventTime || doc.publishedAt || '')));
  const recent = validWindow ? dated.filter(doc => {
    const observed = Date.parse(doc.eventTime || doc.publishedAt);
    return observed <= asOf + 60000 && observed >= asOf - days * 86400000;
  }) : [];
  const freshnessVerified = ready && bindingVerified && evidenceFloor(recent, citations, stop, { primaryDomains });
  const freshnessStatus = !bindingVerified ? 'UNCHECKED_BINDING' : !validWindow ? 'INVALID_WINDOW'
    : freshnessVerified ? 'VERIFIED' : !dated.length ? 'UNDATED'
      : dated.some(doc => Date.parse(doc.eventTime || doc.publishedAt) > asOf + 60000) ? 'FUTURE' : 'STALE';
  const independentSourceCount = new Set(eligibleDocuments.map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;
  const primarySourceCount = new Set(eligibleDocuments.filter((document) => isPrimaryDocument(document, primaryDomains))
    .map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;

  return Object.freeze({
    required: true,
    ready,
    reason: ready
      ? 'research-evidence-floor-met'
      : !binding.ok ? `research-evidence-binding-${String(binding.status).toLowerCase()}`
        : input.error ? 'research-provider-error' : 'research-evidence-floor-not-met',
    evidenceBinding: binding,
    bindingChecked: binding.checked,
    // E6/A05: `ready` can be true with an unchecked binding. Only `bindingVerified` means the source set
    // was confirmed to belong to this request.
    bindingVerified,
    evidenceDocuments: Object.freeze([...documents]),
    eligibleEvidenceCount: eligibleDocuments.length,
    excludedEvidenceCount: Math.max(0, documents.length - eligibleDocuments.length),
    citationCount: citations.length,
    independentSourceCount,
    primarySourceCount,
    referenceClaimsAllowed: ready,
    freshnessVerified,
    freshnessStatus,
    currentClaimsAllowed: ready && freshnessVerified,
    source: externalReady ? 'external-research' : nativeReady ? 'openai-native' : 'none'
  });
}
