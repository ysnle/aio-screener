export const CANONICAL_SOURCE_TIERS = Object.freeze([
  'T1_OFFICIAL',
  'T2_LICENSED',
  'T3_PUBLIC_DELAYED',
  'T4_REFERENCE'
]);

const aliases = new Map();

function register(tier, values) {
  for (const value of values) aliases.set(String(value).trim().toUpperCase(), tier);
}

register('T1_OFFICIAL', [
  // Only provider/registry identities may map to the official tier. Generic
  // freshness or authority adjectives deliberately stay unmapped: a label
  // such as "official", "primary", or "verified-current" is not evidence of
  // who observed or licensed a value.
  'T1_OFFICIAL', 'exchange', 'official-regulator', 'official-government',
  'official-government-relay', 'official-central-bank', 'official-central-banks',
  'official-exchange'
]);
register('T2_LICENSED', [
  'T2_LICENSED', 'T1_LICENSED', 'licensed', 'licensed-api', 'licensed-market-data', 'licensed-quote-provider'
]);
register('T3_PUBLIC_DELAYED', [
  'T3_PUBLIC_DELAYED', 'delayed', 'delayed-eod', 'snapshot', 'market-snapshot',
  'legacy-runtime', 'legacy-projection', 'runtime-quote', 'runtime-quote-set',
  'live-quote', 'public-api', 'public-api-plan', 'public-information-service',
  'publisher-public-web', 'publisher-public-web-via-reader-relay',
  'public-text-relay', 'secondary-headline', 'secondary-index',
  'independent-secondary', 'server-artifact', 'server-history',
  'licensed-or-public-release'
]);
register('T4_REFERENCE', [
  'T4_REFERENCE', 'reference', 'derived-research', 'derived-current-snapshot',
  'field-observation-set', 'partial-field-observation-set', 'local-state',
  'portfolio-state', 'portfolio-state+live-quote', 'native-runtime'
]);

/**
 * Convert historical/provider-specific source labels into the four evidence
 * authority tiers. Unknown labels return null so callers fail closed instead
 * of silently granting public-data or decision-use authority.
 */
export function canonicalSourceTier(value) {
  const key = String(value ?? '').trim().toUpperCase();
  return key ? aliases.get(key) || null : null;
}

export function isRecognizedSourceKind(value) {
  return canonicalSourceTier(value) !== null;
}

export function isReferenceEligibleSourceKind(value) {
  return canonicalSourceTier(value) !== null;
}

export function isDecisionEligibleSourceKind(value) {
  const tier = canonicalSourceTier(value);
  return tier === 'T1_OFFICIAL' || tier === 'T2_LICENSED';
}
