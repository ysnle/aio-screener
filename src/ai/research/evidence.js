export const AI_RESEARCH_EVIDENCE_VERSION = 'research-evidence.v1';

const CONTENT_DEPTH = Object.freeze(['FULL_TEXT', 'EXCERPT', 'SNIPPET', 'SUMMARY']);
const RIGHTS = Object.freeze(['REVIEW_REQUIRED', 'PUBLIC_REFERENCE', 'LICENSED', 'BLOCKED']);

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
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch (_) { return ''; }
}

function sourceTier(url, source = '') {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
  if (/sec\.gov|federalreserve\.gov|bls\.gov|bea\.gov|fred\.stlouisfed\.org|cboe\.com|bok\.or\.kr|kosis\.kr|krx\.co\.kr/.test(host)) return 'PRIMARY_OFFICIAL';
  if (/reuters\.com|apnews\.com|bbc\.com/.test(host) || /reuters|associated press|ap news/i.test(source)) return 'TIER_1_WIRE';
  if (host) return 'SECONDARY';
  return 'UNKNOWN';
}

export function createEvidenceDocument(input = {}) {
  const canonical = canonicalUrl(input.canonicalUrl || input.url);
  const contentDepth = CONTENT_DEPTH.includes(input.contentDepth) ? input.contentDepth : 'SNIPPET';
  const rights = RIGHTS.includes(input.rights) ? input.rights : 'REVIEW_REQUIRED';
  const document = {
    schemaVersion: AI_RESEARCH_EVIDENCE_VERSION,
    documentId: text(input.documentId) || `doc:${canonical || text(input.title)}`,
    canonicalUrl: canonical || null,
    title: text(input.title),
    publisher: text(input.publisher) || publisherFromUrl(canonical),
    author: text(input.author) || null,
    publishedAt: input.publishedAt || null,
    updatedAt: input.updatedAt || null,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
    sourceTier: input.sourceTier || sourceTier(canonical, input.source),
    sourceType: text(input.sourceType) || 'web-search',
    primaryOrSecondary: input.primaryOrSecondary || (sourceTier(canonical, input.source) === 'PRIMARY_OFFICIAL' ? 'PRIMARY' : 'SECONDARY'),
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
