import { FIELD_STATUS, createObservationEnvelope, createProviderCapability } from '../../data/contracts/screener.js';

export const CAPABILITY_CATALOG_VERSION = 'capability-catalog.v1';

export function createCapabilityCatalog(capabilities = []) {
  const values = (Array.isArray(capabilities) ? capabilities : []).map((value) => createProviderCapability(value));
  const byProvider = new Map(values.map((value) => [value.providerId, value]));
  return Object.freeze({ version: CAPABILITY_CATALOG_VERSION, providers: Object.freeze(values), get: (providerId) => byProvider.get(providerId) || null });
}

export function selectProviderForField({ catalog, fieldId, market, preferred = [], excluded = [] } = {}) {
  const blocked = new Set(excluded);
  const candidates = (catalog?.providers || []).filter((provider) => !blocked.has(provider.providerId) && provider.fields.includes(fieldId) && provider.markets.includes(market));
  const order = new Map(preferred.map((providerId, index) => [providerId, index]));
  candidates.sort((left, right) => (order.has(left.providerId) ? order.get(left.providerId) : 999) - (order.has(right.providerId) ? order.get(right.providerId) : 999) || left.providerId.localeCompare(right.providerId));
  return candidates[0] || null;
}

export function reconcileFieldObservations(observations = [], { tolerance = null, preferredSourceIds = [], rightsRequired = true, maxObservationSkewMs = 0 } = {}) {
  const list = Array.isArray(observations) ? observations : [];
  const usable = list.filter((observation) => observation && observation.value != null && (!rightsRequired || observation.rightsId === 'VERIFIED'));
  if (!usable.length) return Object.freeze({ status: 'MISSING', selected: null, candidates: Object.freeze(list), reason: 'no_usable_observation' });
  const dimensions = new Set(usable.map((observation) => `${observation.instrumentId || ''}|${observation.fieldId || ''}|${observation.unit || ''}`));
  if (dimensions.size !== 1) return Object.freeze({ status: 'CONFLICT', selected: null, candidates: Object.freeze(usable), reason: 'incompatible_observation_dimensions' });
  const times = usable.map((observation) => Date.parse(observation.observedAt || '')).filter(Number.isFinite);
  if (times.length !== usable.length) return Object.freeze({ status: 'CONFLICT', selected: null, candidates: Object.freeze(usable), reason: 'observation_time_missing_or_invalid' });
  const allowedSkew = typeof maxObservationSkewMs === 'number' && Number.isFinite(maxObservationSkewMs) && maxObservationSkewMs >= 0 ? maxObservationSkewMs : 0;
  if (Math.max(...times) - Math.min(...times) > allowedSkew) return Object.freeze({ status: 'CONFLICT', selected: null, candidates: Object.freeze(usable), reason: 'observation_epochs_incompatible' });
  const priority = new Map(preferredSourceIds.map((id, index) => [id, index]));
  const numeric = usable.every((observation) => typeof observation.value === 'number' && Number.isFinite(observation.value));
  if (numeric && tolerance != null) {
    const values = usable.map((observation) => observation.value);
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > tolerance) return Object.freeze({ status: 'CONFLICT', selected: null, candidates: Object.freeze(usable), reason: `spread_exceeds_tolerance:${spread}` });
  }
  const sorted = usable.slice().sort((left, right) => (priority.has(left.sourceId) ? priority.get(left.sourceId) : 999) - (priority.has(right.sourceId) ? priority.get(right.sourceId) : 999) || String(right.observedAt || '').localeCompare(String(left.observedAt || '')) || left.sourceId.localeCompare(right.sourceId));
  const selected = sorted[0];
  const status = selected.qualityStatus === 'CURRENT' || selected.qualityStatus === 'DELAYED' ? selected.qualityStatus : FIELD_STATUS.includes(selected.qualityStatus) ? selected.qualityStatus : 'MISSING';
  return Object.freeze({ status, selected, candidates: Object.freeze(usable), reason: status === 'CURRENT' ? 'preferred_current_observation' : `selected_${String(status).toLowerCase()}` });
}

export const DEFAULT_SCREENER_CAPABILITY_CATALOG = createCapabilityCatalog([
  { providerId: 'sec-edgar', independenceGroup: 'official-filing', tier: 'T1_OFFICIAL', markets: ['US'], fields: ['quality.roe', 'quality.margin', 'quality.revGrowth', 'fundamental.filedAt', 'fundamental.availableAt', 'fundamental.source'], cadence: 'filing-event', revisionPolicy: 'preserve-revisions', rights: 'VERIFIED', cost: 'free', fallbackProviderIds: [] },
  { providerId: 'dart-krx', independenceGroup: 'official-filing', tier: 'T1_OFFICIAL', markets: ['KR'], fields: ['quality.roe', 'quality.margin', 'quality.revGrowth', 'fundamental.filedAt', 'fundamental.availableAt', 'fundamental.source'], cadence: 'filing-event', revisionPolicy: 'preserve-revisions', rights: 'VERIFIED', cost: 'free', fallbackProviderIds: [] },
  { providerId: 'aio-yahoo-eod', independenceGroup: 'exchange-eod', tier: 'T3_PUBLIC_DELAYED', markets: ['US', 'KR'], fields: ['price.close', 'price.ret1m', 'price.ret3m', 'price.ret6m', 'price.volatility', 'price.rsi14', 'price.pctSma50', 'price.pctSma200', 'price.rvol20', 'price.dollarVolume30d', 'technical.kalmanVelocity', 'technical.kalmanConfidence', 'technical.vcpScore', 'technical.vcpStage', 'technical.ema8', 'technical.ema21', 'technical.ema60'], cadence: 'close+buffer', revisionPolicy: 'last-known-good', rights: 'REVIEW_REQUIRED', cost: 'free', fallbackProviderIds: ['aio-local-snapshot'] },
  { providerId: 'aio-local-snapshot', independenceGroup: 'aio-snapshot', tier: 'T4_REFERENCE', markets: ['US', 'KR'], fields: ['price.close', 'price.ret1m', 'price.ret3m', 'price.ret6m', 'price.volatility', 'price.rsi14', 'price.pctSma50', 'price.pctSma200', 'price.rvol20', 'technical.kalmanVelocity', 'technical.kalmanConfidence', 'technical.vcpScore', 'technical.vcpStage', 'technical.ema8', 'technical.ema21', 'technical.ema60'], cadence: 'snapshot', revisionPolicy: 'immutable', rights: 'VERIFIED', cost: 'none', fallbackProviderIds: [] }
]);

export function capabilityHealth(catalog = DEFAULT_SCREENER_CAPABILITY_CATALOG, observed = {}) {
  const providers = (catalog.providers || []).map((provider) => ({ providerId: provider.providerId, independenceGroup: provider.independenceGroup, status: observed[provider.providerId]?.status || 'UNKNOWN', lastSuccessAt: observed[provider.providerId]?.lastSuccessAt || null, errorType: observed[provider.providerId]?.errorType || null, rights: provider.rights, fields: provider.fields.length }));
  return Object.freeze({ catalogVersion: catalog.version, providers: Object.freeze(providers), independentGroups: new Set(providers.map((provider) => provider.independenceGroup)).size });
}

export function observationFromProvider({ provider, instrumentId, fieldId, value, unit, observedAt, fetchedAt, revisionId, qualityStatus = 'CURRENT', rightsId } = {}) {
  return createObservationEnvelope({ providerId: provider?.providerId, sourceId: provider?.providerId, sourceKind: provider?.tier, instrumentId, fieldId, value, unit, observedAt, fetchedAt, revisionId, qualityStatus, rightsId: rightsId || provider?.rights || 'UNKNOWN', allowedUse: provider?.tier === 'T1_OFFICIAL' ? 'research-relative-ranking-only' : 'reference-only' });
}
