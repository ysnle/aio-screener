import { readFile, writeFile } from 'node:fs/promises';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);
const ROUTE_OWNERS_PATH = new URL('../architecture/route-owners.json', import.meta.url);
const SEC_FUNDAMENTALS_PATH = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const WORKER_ENDPOINTS_PATH = new URL('../architecture/worker-endpoints.json', import.meta.url);

export function deriveOperationalState({ configured = false, healthy = false, stale = false, rightsReview = false } = {}) {
  if (rightsReview) return 'RIGHTS_REVIEW_REQUIRED';
  if (!configured) return 'NOT_CONFIGURED';
  if (stale) return 'STALE';
  return healthy ? 'CONFIGURED_HEALTHY' : 'CONFIGURED_BROKEN';
}

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

async function observeProxyHealth(baseUrl, fallback = {}) {
  if (process.env.AIO_OBSERVE_PROXY_HEALTH !== '1' || !baseUrl) return fallback;
  const observedAt = new Date().toISOString();
  try {
    const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}/health`, {
      headers: { Origin: 'https://ysnle.github.io' },
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.json();
    return {
      ...fallback,
      proxyHealthStatus: response.status,
      proxyHealthObserved: observedAt,
      proxyHealthRevision: body?.revision || null,
      proxyAiConfigured: body?.ai?.configured === true,
      proxyQuotaConfigured: body?.ai?.quotaConfigured === true,
      proxyAuthorityReady: body?.ai?.authorityReady === true,
      proxyAuthorityJurisdiction: body?.ai?.authorityJurisdiction || null,
      proxyAiReady: body?.ai?.ready === true,
      proxyHealthNote: response.ok ? 'Live deep health observed; provider smoke is certified separately by the pinned deploy workflow.' : `Live health HTTP ${response.status}`
    };
  } catch (error) {
    return { ...fallback, proxyHealthObserved: observedAt, proxyHealthNote: `Live health unavailable: ${String(error?.name || 'network-error')}` };
  }
}

export async function writeOperationsStatus({ data, marketSnapshot, reconciliation, secFundamentals, now = new Date().toISOString() } = {}) {
  const version = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8'));
  const routeOwners = await readRouteOwners();
  let workerEndpoints = {};
  try { workerEndpoints = JSON.parse(await readFile(WORKER_ENDPOINTS_PATH, 'utf8')); } catch (_) {}
  let sec = secFundamentals;
  if (!sec) {
    try { sec = JSON.parse(await readFile(SEC_FUNDAMENTALS_PATH, 'utf8')); } catch (_) { sec = null; }
  }
  const secCoverage = deriveSecCoverage(sec, data?.meta?.fundamentalCoveragePct);
  const ownership = deriveRouteOwnership(routeOwners);
  const fastConfig = workerEndpoints.fastQuotes || {};
  const fastEvidence = await observeProxyHealth(workerEndpoints.proxy?.baseUrl, workerEndpoints.evidence || {});
  const fastEndpoint = String(process.env.AIO_FAST_QUOTES_URL || fastConfig.baseUrl || '').trim() || 'not-configured';
  const snapshot = marketSnapshot || {};
  const coverage = snapshot.coverage || { tier0Required: 0, tier0Observed: 0 };
  const durableOk = snapshot.status === 'published' && coverage.tier0Observed === coverage.tier0Required && coverage.tier0Required > 0;
  const scheduledAnalysisOk = data?.meta?.marketAnalysisOk === true;
  const fastConfigured = fastEndpoint !== 'not-configured';
  const fastHealthy = Number(fastEvidence.fastHealthStatus) === 200 && Number(fastEvidence.fastSoakObservedDays || 0) >= 7;
  const proxyConfigured = !!workerEndpoints.proxy?.baseUrl;
  const providerSmokeCurrent = Number(fastEvidence.proxyProviderSmokeStatus) === 200
    && fastEvidence.proxyProviderSmokeRevision === fastEvidence.proxyHealthRevision;
  const proxyHealthy = Number(fastEvidence.proxyHealthStatus) === 200
    && fastEvidence.proxyAiReady === true
    && fastEvidence.proxyAuthorityReady === true
    && fastEvidence.proxyAuthorityJurisdiction === 'us'
    && providerSmokeCurrent;
  const fredObserved = data?.meta?.fredFetchOk === true;
  const blockers = [];
  if (!durableOk) blockers.push('durable_tier0_publish_blocked');
  blockers.push('fast_plane_cloudflare_credentials_and_soak_required');
  blockers.push('provider_rights_review_required');
  if (!proxyHealthy) blockers.push('ai_proxy_deploy_or_readiness_required');
  if (secCoverage.coveragePct < 80) blockers.push('sec_fundamentals_coverage_below_80_percent');
  const status = createOperationsStatus({
    generatedAt: now,
    appRevision: version.version,
    dataRevision: snapshot.revision || `public-data:${data?.meta?.generatedAt || 'unknown'}`,
    evidenceRevision: 'evidence-contract:v1+inferred-claim:v1+reconciliation:v2+page-timeline:v1',
    overall: durableOk ? 'OPERATOR_REQUIRED' : 'BLOCKED',
    planes: {
      durable: {
        status: durableOk ? 'CURRENT' : 'BLOCKED', statusCode: deriveOperationalState({ configured: true, healthy: durableOk }), source: 'github-actions', lastSuccessfulAt: snapshot.lastSuccessfulAt || null, coverage,
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: 'CURRENT', lastCallSucceeded: durableOk ? 'CURRENT' : 'BLOCKED', dataCurrent: durableOk ? 'CURRENT' : 'BLOCKED', licensedForUse: 'REVIEW_REQUIRED' }
      },
      fast: {
        status: 'OPERATOR_REQUIRED', statusCode: deriveOperationalState({ configured: fastConfigured, healthy: fastHealthy }), scheduler: 'cloudflare-cron', endpoint: fastEndpoint,
        health: {
          status: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'OPERATOR_REQUIRED',
          statusCode: Number.isFinite(Number(fastEvidence.fastHealthStatus)) ? Number(fastEvidence.fastHealthStatus) : null,
          coverage: fastEvidence.fastCoverage || null,
          revision: fastEvidence.fastRevision || null,
          observedAt: fastEvidence.fastHealthObserved || null,
          source: 'operator-provided-runtime-evidence'
        },
        soak: { requiredDays: 7, observedDays: Number(fastEvidence.fastSoakObservedDays || 0), targetSuccessRate: 0.99 },
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: fastEndpoint === 'not-configured' ? 'OPERATOR_REQUIRED' : 'CURRENT', lastCallSucceeded: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'UNKNOWN', dataCurrent: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'UNKNOWN', licensedForUse: 'REVIEW_REQUIRED' }
      },
      browser: { status: 'CURRENT', statusCode: deriveOperationalState({ configured: true, healthy: true }), source: 'static-pages+service-worker', revision: version.version }
    },
    ai: {
      scheduledAnalysis: { status: scheduledAnalysisOk ? 'CURRENT' : 'BLOCKED', statusCode: deriveOperationalState({ configured: true, healthy: scheduledAnalysisOk }), source: 'github-actions', lastCallSucceeded: scheduledAnalysisOk ? 'CURRENT' : 'BLOCKED', evidence: { marketAnalysisOk: scheduledAnalysisOk, generatedAt: data?.meta?.generatedAt || null } },
      publicChat: {
        status: proxyHealthy ? 'CURRENT' : 'NO_ROUTE', statusCode: deriveOperationalState({ configured: proxyConfigured, healthy: proxyHealthy }),
        personalKey: 'EXPLICIT_USER_CONFIG',
        sharedWorker: proxyHealthy ? 'CURRENT' : (proxyConfigured ? 'OPERATOR_REQUIRED' : 'NOT_CONFIGURED'),
        workerEndpoint: workerEndpoints.proxy?.baseUrl || null,
        health: {
          status: proxyHealthy ? 'CURRENT' : 'OPERATOR_REQUIRED',
          statusCode: Number(fastEvidence.proxyHealthStatus ?? fastEvidence.proxyHealthPathObserved) || null,
          observedAt: fastEvidence.proxyHealthObserved || null,
          revision: fastEvidence.proxyHealthRevision || null,
          configured: fastEvidence.proxyAiConfigured === true,
          quotaConfigured: fastEvidence.proxyQuotaConfigured === true,
          authorityReady: fastEvidence.proxyAuthorityReady === true,
          authorityJurisdiction: fastEvidence.proxyAuthorityJurisdiction || null,
          providerSmokeStatus: Number(fastEvidence.proxyProviderSmokeStatus) || null,
          providerSmokeObservedAt: fastEvidence.proxyProviderSmokeObserved || null,
          providerSmokeRevision: fastEvidence.proxyProviderSmokeRevision || null,
          ready: fastEvidence.proxyAiReady === true,
          note: fastEvidence.proxyHealthNote || null
        },
        scheduledAnalysisDoesNotImplyChat: true
      }
    },
    providers: {
      yahoo: { rights: 'REVIEW_REQUIRED', statusCode: 'RIGHTS_REVIEW_REQUIRED', use: 'reference', lastFetchAt: data?.meta?.generatedAt || null },
      fred: {
        rights: (process.env.FRED_API_KEY || fredObserved) ? 'REVIEW_REQUIRED' : 'OPERATOR_REQUIRED', statusCode: (process.env.FRED_API_KEY || fredObserved) ? 'RIGHTS_REVIEW_REQUIRED' : 'NOT_CONFIGURED',
        use: 'official-series',
        status: data?.meta?.fredFetchOk ? 'CURRENT' : 'UNAVAILABLE',
        lastAttemptAt: data?.meta?.fredAttemptedAt || data?.meta?.generatedAt || null,
        lastFetchAt: data?.meta?.fredFetchOk ? (data?.meta?.fredLastSuccessfulAt || data?.meta?.generatedAt || null) : null
      },
      sec: { rights: 'REVIEW_REQUIRED', statusCode: 'RIGHTS_REVIEW_REQUIRED', use: 'filing-evidence', coveragePct: secCoverage.coveragePct, stored: secCoverage.stored, eligible: secCoverage.eligible }
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
