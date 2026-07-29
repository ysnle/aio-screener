import { readFile, writeFile } from 'node:fs/promises';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);
const ROUTE_OWNERS_PATH = new URL('../architecture/route-owners.json', import.meta.url);
const SEC_FUNDAMENTALS_PATH = new URL('../public-data/sec-fundamentals.json', import.meta.url);

export async function readRouteOwners() {
  return JSON.parse(await readFile(ROUTE_OWNERS_PATH, 'utf8'));
}

export function deriveRouteOwnership(routeOwners) {
  const routes = routeOwners?.routes || {};
  const routeIds = Object.keys(routes);
  const columns = Object.keys(routeOwners?.columnDefinitions || {});
  const nativeLifecycleOwner = routeIds.filter((route) => routes[route].lifecycleOwner === 'native');
  const nativeRendererOwner = routeIds.filter((route) => routes[route].rendererOwner === 'native');
  const nativeDataOwner = routeIds.filter((route) => routes[route].dataOwner === 'native');
  const nativeChartOwner = routeIds.filter((route) => routes[route].chartOwner === 'native');
  const nativeNarrativeOwner = routeIds.filter((route) => routes[route].narrativeOwner === 'native');
  const nativeOwner = routeIds.filter((route) => columns.every((column) => routes[route][column] === 'native'));
  return {
    supported: routeIds.length,
    nativeLifecycleOwner,
    nativeRendererOwner,
    nativeDataOwner,
    nativeChartOwner,
    nativeNarrativeOwner,
    nativeOwner,
    legacyOwner: routeIds.length - nativeRendererOwner.length
  };
}

export function deriveSecCoverage(secFundamentals, fallbackPct = 0) {
  const eligible = Number(secFundamentals?.eligible);
  const stored = Number(secFundamentals?.stored ?? Object.keys(secFundamentals?.data || {}).length);
  if (Number.isFinite(eligible) && eligible > 0 && Number.isFinite(stored)) {
    return { stored, eligible, coveragePct: Math.round(stored / eligible * 1000) / 10 };
  }
  return { stored: null, eligible: null, coveragePct: Number(fallbackPct) || 0 };
}

export async function writeOperationsStatus({ data, marketSnapshot, reconciliation, secFundamentals, now = new Date().toISOString() } = {}) {
  const version = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8'));
  const routeOwners = await readRouteOwners();
  let sec = secFundamentals;
  if (!sec) {
    try { sec = JSON.parse(await readFile(SEC_FUNDAMENTALS_PATH, 'utf8')); } catch (_) { sec = null; }
  }
  const secCoverage = deriveSecCoverage(sec, data?.meta?.fundamentalCoveragePct);
  const ownership = deriveRouteOwnership(routeOwners);
  const snapshot = marketSnapshot || {};
  const coverage = snapshot.coverage || { tier0Required: 0, tier0Observed: 0 };
  const durableOk = snapshot.status === 'published' && coverage.tier0Observed === coverage.tier0Required && coverage.tier0Required > 0;
  const blockers = [];
  if (!durableOk) blockers.push('durable_tier0_publish_blocked');
  blockers.push('fast_plane_cloudflare_credentials_and_soak_required');
  blockers.push('provider_rights_review_required');
  if (secCoverage.coveragePct < 80) blockers.push('sec_fundamentals_coverage_below_80_percent');
  const status = createOperationsStatus({
    generatedAt: now,
    appRevision: version.version,
    dataRevision: snapshot.revision || `public-data:${data?.meta?.generatedAt || 'unknown'}`,
    evidenceRevision: 'evidence-contract:v1+inferred-claim:v1+reconciliation:v1',
    overall: durableOk ? 'OPERATOR_REQUIRED' : 'BLOCKED',
    planes: {
      durable: {
        status: durableOk ? 'CURRENT' : 'BLOCKED', source: 'github-actions', lastSuccessfulAt: snapshot.lastSuccessfulAt || null, coverage,
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: 'CURRENT', lastCallSucceeded: durableOk ? 'CURRENT' : 'BLOCKED', dataCurrent: durableOk ? 'CURRENT' : 'BLOCKED', licensedForUse: 'REVIEW_REQUIRED' }
      },
      fast: {
        status: 'OPERATOR_REQUIRED', scheduler: 'cloudflare-cron', endpoint: 'not-configured', soak: { requiredDays: 7, observedDays: 0, targetSuccessRate: 0.99 },
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: 'OPERATOR_REQUIRED', lastCallSucceeded: 'UNKNOWN', dataCurrent: 'UNKNOWN', licensedForUse: 'REVIEW_REQUIRED' }
      },
      browser: { status: 'CURRENT', source: 'static-pages+service-worker', revision: version.version }
    },
    ai: {
      scheduledAnalysis: { status: durableOk ? 'CURRENT' : 'BLOCKED', source: 'github-actions', lastCallSucceeded: durableOk ? 'CURRENT' : 'BLOCKED' },
      publicChat: { status: 'NO_ROUTE', personalKey: 'EXPLICIT_USER_CONFIG', sharedWorker: 'NOT_CONFIGURED', scheduledAnalysisDoesNotImplyChat: true }
    },
    providers: {
      yahoo: { rights: 'REVIEW_REQUIRED', use: 'reference', lastFetchAt: data?.meta?.generatedAt || null },
      fred: { rights: process.env.FRED_API_KEY ? 'REVIEW_REQUIRED' : 'OPERATOR_REQUIRED', use: 'official-series', lastFetchAt: data?.meta?.generatedAt || null },
      sec: { rights: 'REVIEW_REQUIRED', use: 'filing-evidence', coveragePct: secCoverage.coveragePct, stored: secCoverage.stored, eligible: secCoverage.eligible }
    },
    reconciliation: {
      tier0: { status: durableOk ? 'MATCH' : 'BLOCKED', artifact: snapshot.revision || null, uiEvidence: durableOk ? 'same-revision-contract' : null, observedAtComplete: durableOk },
      artifact: 'public-data/reconciliation-status.json',
      categoryCount: reconciliation?.categories?.length || 0,
      overall: reconciliation?.overall || 'BLOCKED',
      counts: reconciliation?.counts || {},
      closure: reconciliation?.closure || null,
      routeCount: ownership.supported,
      rawProducerClaimGate: 'not_applicable_for_quote_plane'
    },
    routes: {
      supported: ownership.supported,
      nativeOwner: ownership.nativeOwner,
      legacyOwner: ownership.legacyOwner,
      nativeLifecycleOwner: ownership.nativeLifecycleOwner,
      nativeRendererOwner: ownership.nativeRendererOwner,
      nativeDataOwner: ownership.nativeDataOwner,
      nativeChartOwner: ownership.nativeChartOwner,
      nativeNarrativeOwner: ownership.nativeNarrativeOwner,
      // Verified 2026-07-19 (RM-00): bootstrap.js registers a dedicated module for all 17 ROUTE_IDS,
      // so createLegacyObserverPage/defaultPage() is never reached. Re-derive if that ever changes.
      observerOwner: 0,
      cutoverStatus: 'MIGRATION_IN_PROGRESS',
      routeOwnersManifest: 'architecture/route-owners.json'
    },
    blockers
  });
  const validation = validateOperationsStatus(status);
  if (!validation.ok) throw new Error(`OPERATIONS_STATUS_INVALID:${validation.errors.join(',')}`);
  await writeFile(OPERATIONS_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const data = JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const marketSnapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  let reconciliation = null;
  try { reconciliation = JSON.parse(await readFile(new URL('../public-data/reconciliation-status.json', import.meta.url), 'utf8')); } catch (_) {}
  console.log(JSON.stringify(await writeOperationsStatus({ data, marketSnapshot, reconciliation })));
}
