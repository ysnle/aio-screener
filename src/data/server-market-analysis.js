// Server market analysis gate (public-data/data.json `marketAnalysis`). Legacy unification (2026-10-17): moved from
// js/aio-data.js _aioLoadServerData.
// v52.75/WP-AI0: generated-but-unverified LLM prose never reaches a public sink. P846/P847: metadata alone never
// certifies current-sensitive prose; the producer must supply typed metric identity/value/unit/asOf/source evidence and
// every claim must cite an evidence id.

function metricEvidenceValid(rows) {
  return rows.length >= 2 && rows.every((row) => row && row.metricId && row.unit && row.source && row.asOf && Number.isFinite(Number(row.value)) && !Number.isNaN(new Date(row.asOf).getTime()));
}

function claimsValid(analysis, metricRows) {
  const metricIds = metricRows.map((row) => row.evidenceId).filter(Boolean);
  const newsRows = Array.isArray(analysis.newsEvidence) ? analysis.newsEvidence : [];
  return analysis.schemaVersion === 'market-analysis.v2' && Array.isArray(analysis.claims)
    && analysis.claims.every((claim) => claim && claim.text && Array.isArray(claim.evidenceIds) && claim.evidenceIds.length > 0
      && claim.evidenceIds.every((id) => metricIds.includes(id) || newsRows.some((row) => row.evidenceId === id)));
}

// Returns { analysis, meta }: `analysis` is the verified sink record or null; `meta` is the _serverDataMeta.marketAnalysis
// record (null when the artifact carries no analysis text). The legacy publish gate, scope line and source label are
// passed in because they still live in the classic bundle.
export function verifyServerMarketAnalysis(marketAnalysis, { fallbackGeneratedAt = null, validatePublish = null, describeScope = () => null, sourceLabelFor = null } = {}) {
  const ma = marketAnalysis;
  if (!ma || !(ma.full || ma.oneLine)) return { analysis: null, meta: null };
  const metricRows = Array.isArray(ma.metricEvidence) ? ma.metricEvidence : [];
  const evidenceOk = metricEvidenceValid(metricRows);
  const semanticIssues = Array.isArray(ma.semanticIssues) ? ma.semanticIssues : [];
  const semanticContract = ma.semanticStatus === 'verified' && semanticIssues.length === 0 && evidenceOk && claimsValid(ma, metricRows);
  const publishAudit = typeof validatePublish === 'function'
    ? validatePublish({ entrypoint: 'market-analysis', text: ma.full || ma.oneLine, currentSensitive: true, requiresStructuredClaims: false, evidence: metricRows })
    : { blocked: false, sourceLabel: 'AI_GENERATED' };
  const verified = semanticContract && !publishAudit.blocked;
  const generatedAt = ma.generatedAt || fallbackGeneratedAt;
  const source = ma.source || ma.model || 'github-actions-market-analysis';
  // P1719/P1729: this run's text was blocked and the previous verified analysis is shown (<= 12h old).
  const retained = ma.retained && typeof ma.retained === 'object' ? ma.retained : null;
  // P1122: the narrative is published with its boundary, not instead of one.
  const disclosure = typeof ma.disclosure === 'string' ? ma.disclosure : null;
  const analysis = verified ? {
    status: 'verified',
    full: ma.full || ma.oneLine,
    oneLine: ma.oneLine || ma.full,
    generatedAt,
    source,
    disclosure,
    scope: describeScope(ma, generatedAt),
    semanticWarnings: Array.isArray(ma.semanticWarnings) ? ma.semanticWarnings : [],
    retained,
    publishAudit,
    sourceLabel: typeof sourceLabelFor === 'function' ? sourceLabelFor('AI_GENERATED', publishAudit) : 'AI_GENERATED'
  } : null;
  const meta = {
    status: verified ? 'verified' : 'blocked-unverified',
    generatedAt,
    source,
    fullLength: String(ma.full || ma.oneLine || '').length,
    metricEvidenceCount: metricRows.length,
    reason: verified ? null : publishAudit.blocked ? 'automated-publish-gate' : evidenceOk ? 'semantic-gate-required' : 'metric-evidence-required',
    retained,
    disclosure,
    publishAudit,
    fallback: 'AIO.synthesizeMarketAnalysis'
  };
  return { analysis, meta };
}
