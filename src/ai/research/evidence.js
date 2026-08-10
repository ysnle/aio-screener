export const AI_RESEARCH_EVIDENCE_VERSION = 'research-evidence.v1';

const CONTENT_DEPTH = Object.freeze(['FULL_TEXT', 'EXCERPT', 'SNIPPET', 'SUMMARY']);
const RIGHTS = Object.freeze(['REVIEW_REQUIRED', 'PUBLIC_REFERENCE', 'LICENSED', 'BLOCKED']);
const PRIMARY_OFFICIAL_SUFFIXES = Object.freeze([
  'sec.gov', 'federalreserve.gov', 'bls.gov', 'bea.gov', 'fred.stlouisfed.org',
  'cboe.com', 'nasdaq.com', 'nyse.com', 'bok.or.kr', 'kosis.kr', 'krx.co.kr'
]);
const TIER_1_SUFFIXES = Object.freeze(['reuters.com', 'apnews.com', 'bbc.com']);

function text(value) { return String(value == null ? '' : value).trim(); }

function canonicalUrl(value) {
  try {
    const url = new URL(String(value));
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'oc'].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, '');
  } catch (_) { return text(value); }
}

function publisherFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; }
}

function hostMatches(host, suffixes) {
  const normalized = String(host || '').replace(/^www\./, '').toLowerCase();
  return suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

function sourceTier(url, source = '') {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
  if (hostMatches(host, PRIMARY_OFFICIAL_SUFFIXES)) return 'PRIMARY_OFFICIAL';
  if (hostMatches(host, TIER_1_SUFFIXES) || /reuters|associated press|ap news/i.test(source)) return 'TIER_1_WIRE';
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
    sourceTier: canonical ? derivedTier : input.sourceTier || derivedTier,
    sourceType: text(input.sourceType) || 'web-search',
    primaryOrSecondary: canonical ? (derivedTier === 'PRIMARY_OFFICIAL' ? 'PRIMARY' : 'SECONDARY') :
      input.primaryOrSecondary || (derivedTier === 'PRIMARY_OFFICIAL' ? 'PRIMARY' : 'SECONDARY'),
    rights,
    contentDepth,
    locale: text(input.locale) || null,
    entities: Object.freeze(Array.isArray(input.entities) ? input.entities.map(text).filter(Boolean) : []),
    eventTime: input.eventTime || input.publishedAt || null,
    status: input.status || (canonical ? 'RESULTS_FOUND' : 'INVALID')
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
  const documents = Array.isArray(evidence?.documents) ? evidence.documents.filter((doc) => ids.has(doc.documentId)) : [];
  if (currentSensitive && documents.length === 0) errors.push('current_claim_evidence_missing');
  if (documents.some((doc) => doc.contentDepth === 'SNIPPET' || doc.contentDepth === 'SUMMARY')) errors.push('snippet_or_summary_not_sufficient_alone');
  if (documents.some((doc) => doc.rights === 'BLOCKED' || doc.allowedUse === 'none')) errors.push('rights_blocked');
  const independent = new Set(documents.map((doc) => doc.publisher || doc.canonicalUrl).filter(Boolean)).size;
  const primary = documents.filter((doc) => doc.primaryOrSecondary === 'PRIMARY').length;
  if (independent < minimumIndependentSources) errors.push('independent_source_floor_missing');
  if (primary < minimumPrimarySources) errors.push('primary_source_floor_missing');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)], documentCount: documents.length, independentSourceCount: independent, primarySourceCount: primary });
}

function uniqueCitations(citations = []) {
  const seen = new Set();
  return (Array.isArray(citations) ? citations : []).filter((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
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
  const primarySourceCount = documents.filter((document) =>
    document?.primaryOrSecondary === 'PRIMARY' || document?.sourceTier === 'PRIMARY_OFFICIAL'
  ).length;
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
      sourceType: 'claude-native-web-search'
    });
  }));
}

function evidenceFloor(documents, citations, stop, { requireCurrentClaims = false, currentClaimsAllowed = false } = {}) {
  const independent = new Set(documents.map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;
  const primary = documents.filter((document) =>
    document.primaryOrSecondary === 'PRIMARY' || document.sourceTier === 'PRIMARY_OFFICIAL'
  ).length;
  const snippetFree = documents.length > 0 && documents.every((document) =>
    document.contentDepth !== 'SNIPPET' && document.contentDepth !== 'SUMMARY'
  );
  return citations.length > 0 && documents.length > 0 && snippetFree &&
    independent >= Number(stop.minimumIndependentSources || 0) &&
    primary >= Number(stop.minimumPrimarySources || 0) &&
    (!requireCurrentClaims || currentClaimsAllowed === true);
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
  const externalReady = evidenceFloor(externalDocuments, externalCitations, stop, {
    requireCurrentClaims: true,
    currentClaimsAllowed: external.researchEvidence.currentClaimsAllowed
  });
  const nativeReady = evidenceFloor(nativeDocuments, nativeCitations, stop);
  const ready = externalReady || nativeReady;
  const documents = externalReady ? externalDocuments : nativeReady ? nativeDocuments :
    (externalDocuments.length ? externalDocuments : nativeDocuments);
  const citations = externalReady ? externalCitations : nativeReady ? nativeCitations :
    (externalCitations.length ? externalCitations : nativeCitations);
  const independentSourceCount = new Set(documents.map((document) => document.publisher || document.canonicalUrl).filter(Boolean)).size;
  const primarySourceCount = documents.filter((document) =>
    document.primaryOrSecondary === 'PRIMARY' || document.sourceTier === 'PRIMARY_OFFICIAL'
  ).length;

  return Object.freeze({
    required: true,
    ready,
    reason: ready ? 'research-evidence-floor-met' : input.error ? 'research-provider-error' : 'research-evidence-floor-not-met',
    evidenceDocuments: Object.freeze([...documents]),
    citationCount: citations.length,
    independentSourceCount,
    primarySourceCount,
    currentClaimsAllowed: externalReady || nativeReady,
    source: externalReady ? 'external-research' : nativeReady ? 'claude-native' : 'none'
  });
}
