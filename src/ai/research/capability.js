export const AI_RESEARCH_CAPABILITY_VERSION = 'research-capability.v1';

const STATES = Object.freeze(['READY', 'NOT_READY', 'UNKNOWN', 'BLOCKED']);

function state(value, fallback = 'UNKNOWN') {
  const normalized = String(value || '').toUpperCase();
  return STATES.includes(normalized) ? normalized : fallback;
}

function capabilityStatus(dimensions) {
  const values = Object.values(dimensions);
  if (values.some((value) => value === 'BLOCKED')) return 'UNAVAILABLE';
  if (values.some((value) => value === 'NOT_READY')) return 'DEGRADED';
  if (values.every((value) => value === 'READY')) return 'READY';
  return 'UNKNOWN';
}

/**
 * Research readiness is deliberately separate from the question's
 * ResearchDecision and from ordinary Chat readiness. A question can require
 * research even when no provider, route, quota, or citation-capable tool is
 * available.
 */
export function createResearchCapability({
  provider = 'UNKNOWN',
  routeReady = 'UNKNOWN',
  authReady = 'UNKNOWN',
  toolReady = 'UNKNOWN',
  quotaReady = 'UNKNOWN',
  originReady = 'UNKNOWN',
  supportsCitations = false,
  supportsFullContent = false,
  supportsDomainControl = false,
  checkedAt = new Date()
} = {}) {
  const dimensions = Object.freeze({
    routeReady: state(routeReady),
    authReady: state(authReady),
    toolReady: state(toolReady),
    quotaReady: state(quotaReady),
    originReady: state(originReady)
  });
  const blockers = [];
  Object.entries(dimensions).forEach(([key, value]) => {
    if (value === 'NOT_READY' || value === 'BLOCKED') blockers.push(key);
  });
  if (!supportsCitations) blockers.push('supportsCitations');
  const baseStatus = capabilityStatus(dimensions);
  const status = !supportsCitations && baseStatus === 'READY' ? 'DEGRADED' : baseStatus;
  return Object.freeze({
    schemaVersion: AI_RESEARCH_CAPABILITY_VERSION,
    provider: String(provider || 'UNKNOWN'),
    chatReadiness: 'SEPARATE_CAPABILITY',
    status,
    routeReady: dimensions.routeReady,
    authReady: dimensions.authReady,
    toolReady: dimensions.toolReady,
    quotaReady: dimensions.quotaReady,
    supportsCitations: Boolean(supportsCitations),
    supportsFullContent: Boolean(supportsFullContent),
    supportsDomainControl: Boolean(supportsDomainControl),
    originReady: dimensions.originReady,
    blockers: Object.freeze(blockers),
    checkedAt: new Date(checkedAt).toISOString()
  });
}

export function validateResearchCapability(capability) {
  const errors = [];
  if (!capability || capability.schemaVersion !== AI_RESEARCH_CAPABILITY_VERSION) errors.push('schema_version_invalid');
  if (!capability?.provider) errors.push('provider_missing');
  for (const field of ['routeReady', 'authReady', 'toolReady', 'quotaReady', 'originReady']) {
    if (!STATES.includes(capability?.[field])) errors.push(`${field}_invalid`);
  }
  if (!capability?.checkedAt || Number.isNaN(new Date(capability.checkedAt).getTime())) errors.push('checked_at_invalid');
  return Object.freeze({ ok: errors.length === 0, errors: [...new Set(errors)] });
}
