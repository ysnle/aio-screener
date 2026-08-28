import { readFile, rename, writeFile } from 'node:fs/promises';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);
const ROUTE_OWNERS_PATH = new URL('../architecture/route-owners.json', import.meta.url);
const SEC_FUNDAMENTALS_PATH = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const WORKER_ENDPOINTS_PATH = new URL('../architecture/worker-endpoints.json', import.meta.url);
const PUBLIC_READINESS_PATH = new URL('../architecture/public-readiness.json', import.meta.url);
const PUBLIC_CONFIG_PATH = new URL('../public-config.json', import.meta.url);
const WORKER_HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
  const nativeLifecycleOwner = routeIds.filter((route) => routes[route].lifecycleOwner === 'native');
  const nativeRendererOwner = routeIds.filter((route) => routes[route].rendererOwner === 'native');
  const nativeDataOwner = routeIds.filter((route) => routes[route].dataOwner === 'native');
  const nativeChartOwner = routeIds.filter((route) => routes[route].chartOwner === 'native');
  const nativeNarrativeOwner = routeIds.filter((route) => routes[route].narrativeOwner === 'native');
  const declaredNotApplicable = (owner, field) => owner[`${field}Owner`] === 'not-applicable'
    && owner.notApplicableFields?.includes(`${field}Owner`);
  const nativeLazyOwner = routeIds.filter((route) => routes[route].loadingStrategy === 'route-dynamic-import');
  const nativeOwner = routeIds.filter((route) => {
    const owner = routes[route];
    return owner.lifecycleOwner === 'native'
      && owner.rendererOwner === 'native'
      && owner.dataOwner === 'native'
      && ['chart', 'narrative'].every((field) => owner[`${field}Owner`] === 'native' || declaredNotApplicable(owner, field))
      && nativeLazyOwner.includes(route)
      && (owner.contestedIds || []).length === 0
      && (owner.legacyWriterEvidence || []).length === 0;
  });
  return {
    supported: routeIds.length,
    nativeLifecycleOwner,
    nativeRendererOwner,
    nativeDataOwner,
    nativeChartOwner,
    nativeNarrativeOwner,
    nativeLazyOwner,
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

async function fetchHealth(baseUrl, healthPath = '/health', headers = {}) {
  if (!baseUrl) throw new Error('endpoint-not-configured');
  const response = await fetch(`${String(baseUrl).replace(/\/$/, '')}${healthPath}`, {
    headers: { 'cache-control': 'no-cache', ...headers },
    signal: AbortSignal.timeout(8000)
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

export function derivePublicAiConfig(previous = {}, {
  appRevision = 'unknown',
  workerEndpoint = null,
  proxyHealthy = false,
  proxyEvidence = {},
  now = new Date().toISOString()
} = {}) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  const priorAi = prior.ai && typeof prior.ai === 'object' ? prior.ai : {};
  const endpoint = String(workerEndpoint || '').trim().replace(/\/+$/, '') || null;
  const endpointUsable = /^https:\/\/[^\s]+$/i.test(endpoint || '') ? endpoint : null;
  const published = Boolean(endpointUsable && proxyHealthy);
  const failureReason = endpoint && !endpointUsable
    ? 'WORKER_ENDPOINT_INVALID'
    : proxyEvidence.proxyObservationStatus === 'FAILED'
      ? 'WORKER_HEALTH_UNAVAILABLE'
      : proxyEvidence.proxyObservationStatus === 'HTTP_ERROR'
      ? 'WORKER_HEALTH_HTTP_ERROR'
      : proxyEvidence.proxyEvidenceFresh === false && proxyEvidence.proxyHealthStatus != null
        ? 'WORKER_HEALTH_STALE'
      : proxyEvidence.proxyHealthStatus == null
        ? 'WORKER_HEALTH_UNOBSERVED'
        : 'WORKER_NOT_READY';
  return {
    schemaVersion: 'ai-public-config.v1',
    appRevision: String(appRevision),
    ai: {
      chatPolicy: published ? 'personal-key-or-public-worker' : 'personal-key-only',
      workerUrl: published ? endpointUsable : null,
      serverMode: published ? 'shared-worker-fallback' : 'personal-key-only',
      healthPath: priorAi.healthPath || '/health',
      maxTokens: priorAi.maxTokens || 'worker-advertised',
      routeStatus: published ? 'PUBLISHED' : 'DISABLED',
      routeReason: published ? null : failureReason,
      routeEvidence: {
        status: published ? 'CURRENT' : 'OPERATOR_REQUIRED',
        source: proxyEvidence.proxyEvidenceSource || proxyEvidence.evidenceSource || 'periodic-live-health',
        observedAt: proxyEvidence.proxyHealthObserved || now,
        observationStatus: proxyEvidence.proxyObservationStatus || 'UNKNOWN'
      }
    },
    privacy: prior.privacy || {
      clientKeysStayBrowserLocal: true,
      networkTransmission: 'provider-or-explicit-worker'
    }
  };
}

async function syncPublicAiConfig({ appRevision, workerEndpoint, proxyHealthy, proxyEvidence, now } = {}) {
  let previous = {};
  try { previous = JSON.parse(await readFile(PUBLIC_CONFIG_PATH, 'utf8')); } catch (_) {}
  const config = derivePublicAiConfig(previous, { appRevision, workerEndpoint, proxyHealthy, proxyEvidence, now });
  const temp = new URL(`${PUBLIC_CONFIG_PATH.pathname}.tmp`, PUBLIC_CONFIG_PATH);
  await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`);
  await rename(temp, PUBLIC_CONFIG_PATH);
  return config;
}

export function deriveDurableFreshness({ data = {}, marketSnapshot = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = data?.meta?.generatedAt || marketSnapshot?.generatedAt || null;
  const generatedMs = Date.parse(generatedAt || '');
  const nowMs = Date.parse(now || '');
  const ageHours = Number.isFinite(generatedMs) && Number.isFinite(nowMs) ? (nowMs - generatedMs) / 3_600_000 : null;
  const maxAgeHours = Number(data?.meta?.marketCycleFreshnessSlaHours || 12);
  const coverage = marketSnapshot?.coverage || {};
  const coverageComplete = Number(coverage.tier0Required) > 0
    && Number(coverage.tier0Observed) === Number(coverage.tier0Required)
    && (!Array.isArray(marketSnapshot?.errors) || marketSnapshot.errors.length === 0);
  const utcDay = Number.isFinite(nowMs) ? new Date(nowMs).getUTCDay() : null;
  const marketClosedGrace = (utcDay === 0 || utcDay === 6)
    && marketSnapshot?.status === 'published'
    && data?.meta?.cycleStatus === 'PUBLISHED'
    && coverageComplete;
  const withinSla = ageHours != null && ageHours >= 0 && ageHours <= maxAgeHours;
  return Object.freeze({
    fresh: withinSla || marketClosedGrace,
    withinSla,
    marketClosedGrace,
    generatedAt,
    ageHours: ageHours == null ? null : Math.round(ageHours * 100) / 100,
    maxAgeHours,
    reason: withinSla || marketClosedGrace ? null : (ageHours == null ? 'generatedAt-missing-or-invalid' : 'market-cycle-freshness-sla-exceeded')
  });
}

export async function syncFredReadinessCriterion(data = {}) {
  let readiness = null;
  try { readiness = JSON.parse(await readFile(PUBLIC_READINESS_PATH, 'utf8')); } catch (_) { return null; }
  const fredSuccess = data?.meta?.fredHasKey === true && data?.meta?.fredFetchOk === true && data?.meta?.fredOk === true;
  const criteria = Array.isArray(readiness.criteria) ? readiness.criteria : [];
  const next = criteria.map((criterion) => criterion?.id === 'fred-success-branch' ? {
    ...criterion,
    status: fredSuccess ? 'PASS' : 'OPERATOR_REQUIRED',
    evidence: fredSuccess
      ? 'public-data/data.json reports fredHasKey:true, fredFetchOk:true and fredOk:true; SA-04 remains release-required.'
      : `public-data/data.json reports fredHasKey:${data?.meta?.fredHasKey === true}, fredFetchOk:${data?.meta?.fredFetchOk === true}, fredOk:${data?.meta?.fredOk === true}; current official-series success is not certified.`
  } : criterion);
  if (!next.some((criterion) => criterion?.id === 'fred-success-branch')) return null;
  const updated = { ...readiness, criteria: next };
  await writeFile(PUBLIC_READINESS_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}

export function reuseWorkerHealthEvidence(previous = {}, now = new Date().toISOString()) {
  const proxy = previous?.ai?.publicChat?.health || {};
  const fast = previous?.planes?.fast?.health || {};
  const freshness = (observedAt) => {
    const ageMs = Date.parse(now) - Date.parse(observedAt);
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= WORKER_HEALTH_MAX_AGE_MS;
  };
  const proxyFresh = freshness(proxy.observedAt);
  const fastFresh = freshness(fast.observedAt);
  return {
    observationAttempted: false,
    evidenceSource: 'last-observed-live-health',
    proxyHealthStatus: Number.isFinite(Number(proxy.statusCode)) ? Number(proxy.statusCode) : null,
    proxyHealthObserved: proxy.observedAt || null,
    proxyHealthRevision: proxy.revision || null,
    proxySourceSha: proxy.sourceSha || null,
    proxyEvidenceSource: 'last-observed-live-health',
    proxyObservationStatus: 'NOT_ATTEMPTED',
    proxyAiConfigured: proxy.configured === true,
    proxyQuotaConfigured: proxy.quotaConfigured === true,
    proxyAuthorityReady: proxy.authorityReady === true,
    proxyAuthorityJurisdiction: proxy.authorityJurisdiction || null,
    proxyAiReady: proxy.ready === true,
    proxyHealthNote: proxy.note || null,
    proxyEvidenceFresh: proxyFresh,
    fastHealthStatus: Number.isFinite(Number(fast.statusCode)) ? Number(fast.statusCode) : null,
    fastHealthObserved: fast.observedAt || null,
    fastCoverage: fast.coverage || null,
    fastRevision: fast.revision || null,
    fastSourceSha: fast.sourceSha || null,
    fastEvidenceSource: 'last-observed-live-health',
    fastObservationStatus: 'NOT_ATTEMPTED',
    fastEvidenceFresh: fastFresh
  };
}

export async function observeWorkerHealth(workerEndpoints = {}, now = new Date().toISOString()) {
  const observedAt = now;
  const [proxy, fast] = await Promise.allSettled([
    fetchHealth(workerEndpoints.proxy?.baseUrl, workerEndpoints.proxy?.healthPath, { Origin: 'https://ysnle.github.io' }),
    fetchHealth(workerEndpoints.fastQuotes?.baseUrl, workerEndpoints.fastQuotes?.healthPath)
  ]);
  const evidence = { observationAttempted: true, evidenceSource: 'periodic-live-health' };
  if (proxy.status === 'fulfilled') {
    const { response, body } = proxy.value;
    Object.assign(evidence, {
      proxyHealthStatus: response.status,
      proxyHealthObserved: observedAt,
      proxyHealthRevision: body?.revision || null,
      proxySourceSha: body?.sourceSha || null,
      proxyAiConfigured: body?.ai?.configured === true,
      proxyQuotaConfigured: body?.ai?.quotaConfigured === true,
      proxyAuthorityReady: body?.ai?.authorityReady === true,
      proxyAuthorityJurisdiction: body?.ai?.authorityJurisdiction || null,
      proxyAiReady: body?.ai?.ready === true,
      proxyEvidenceSource: 'periodic-live-health',
      proxyEvidenceFresh: true,
      proxyObservationStatus: response.ok ? 'SUCCESS' : 'HTTP_ERROR',
      proxyHealthNote: response.ok ? 'Periodic live health observed; provider smoke remains a blocking deployment-workflow gate.' : `Live health HTTP ${response.status}`
    });
  } else {
    Object.assign(evidence, {
      proxyHealthObserved: observedAt,
      proxyEvidenceSource: 'periodic-live-health',
      proxyEvidenceFresh: false,
      proxyObservationStatus: 'FAILED',
      proxyObservationError: String(proxy.reason?.name || proxy.reason?.message || 'network-error'),
      proxyHealthNote: `Live health unavailable: ${String(proxy.reason?.name || 'network-error')}`
    });
  }
  if (fast.status === 'fulfilled') {
    const { response, body } = fast.value;
    const coverage = body?.coverage || body?.heartbeat?.coverage || {};
    const observed = Number(coverage.tier0Observed ?? coverage.observed);
    const required = Number(coverage.tier0Required ?? coverage.required);
    Object.assign(evidence, {
      fastHealthStatus: response.status,
      fastHealthObserved: observedAt,
      fastCoverage: Number.isFinite(observed) && Number.isFinite(required) ? `${observed}/${required}` : null,
      fastRevision: body?.revision || null,
      fastSourceSha: body?.sourceSha || null,
      fastEvidenceSource: 'periodic-live-health',
      fastObservationStatus: response.ok ? 'SUCCESS' : 'HTTP_ERROR',
      fastEvidenceFresh: true
    });
  } else {
    Object.assign(evidence, {
      fastHealthObserved: observedAt,
      fastEvidenceSource: 'periodic-live-health',
      fastObservationStatus: 'FAILED',
      fastObservationError: String(fast.reason?.name || fast.reason?.message || 'network-error'),
      fastEvidenceFresh: false
    });
  }
  return evidence;
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
  const shouldObserveWorkerHealth = process.env.AIO_OBSERVE_PROXY_HEALTH === '1';
  let previousStatus = {};
  if (!shouldObserveWorkerHealth) {
    try { previousStatus = JSON.parse(await readFile(OPERATIONS_STATUS_OUT, 'utf8')); } catch (_) {}
  }
  const fastEvidence = shouldObserveWorkerHealth
    ? await observeWorkerHealth(workerEndpoints, now)
    : reuseWorkerHealthEvidence(previousStatus, now);
  const fastEndpoint = String(process.env.AIO_FAST_QUOTES_URL || fastConfig.baseUrl || '').trim() || 'not-configured';
  const snapshot = marketSnapshot || {};
  const coverage = snapshot.coverage || { tier0Required: 0, tier0Observed: 0 };
  const durableFreshness = deriveDurableFreshness({ data, marketSnapshot: snapshot, now });
  const durableOk = snapshot.status === 'published'
    && data?.meta?.cycleStatus === 'PUBLISHED'
    && coverage.tier0Observed === coverage.tier0Required
    && coverage.tier0Required > 0
    && durableFreshness.fresh;
  const scheduledAnalysisOk = data?.meta?.marketAnalysisOk === true;
  const fastConfigured = fastEndpoint !== 'not-configured';
  const [fastObserved, fastRequired] = String(fastEvidence.fastCoverage || '').split('/').map(Number);
  const fastHealthy = fastEvidence.fastEvidenceFresh === true && Number(fastEvidence.fastHealthStatus) === 200 && Number.isFinite(fastObserved) && fastObserved === fastRequired && fastRequired === 16;
  const proxyConfigured = !!workerEndpoints.proxy?.baseUrl;
  const proxyHealthStatus = Number(fastEvidence.proxyHealthStatus ?? fastEvidence.proxyHealthPathObserved);
  const proxyHealthy = fastEvidence.proxyEvidenceFresh === true && proxyHealthStatus === 200
    && fastEvidence.proxyAiReady === true
    && fastEvidence.proxyAuthorityReady === true
    && fastEvidence.proxyAuthorityJurisdiction === 'us';
  const fredObserved = data?.meta?.fredFetchOk === true;
  const blockers = [];
  if (!durableOk) blockers.push('durable_tier0_publish_blocked');
  if (!durableFreshness.fresh) blockers.push('durable_market_cycle_stale');
  blockers.push('fast_plane_soak_and_rights_review_required');
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
        freshness: durableFreshness,
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: 'CURRENT', lastCallSucceeded: durableOk ? 'CURRENT' : 'BLOCKED', dataCurrent: durableOk ? 'CURRENT' : 'BLOCKED', licensedForUse: 'REVIEW_REQUIRED' }
      },
      fast: {
        status: 'OPERATOR_REQUIRED', statusCode: deriveOperationalState({ configured: fastConfigured, healthy: fastHealthy, stale: fastConfigured && fastEvidence.fastHealthStatus != null && fastEvidence.fastEvidenceFresh !== true }), scheduler: 'cloudflare-cron', endpoint: fastEndpoint,
        health: {
          status: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'OPERATOR_REQUIRED',
          statusCode: Number.isFinite(Number(fastEvidence.fastHealthStatus)) ? Number(fastEvidence.fastHealthStatus) : null,
          coverage: fastEvidence.fastCoverage || null,
          revision: fastEvidence.fastRevision || null,
          sourceSha: fastEvidence.fastSourceSha || null,
          observedAt: fastEvidence.fastHealthObserved || null,
          source: fastEvidence.fastEvidenceSource || fastEvidence.evidenceSource || 'periodic-live-health',
          observationStatus: fastEvidence.fastObservationStatus || (fastEvidence.observationAttempted ? 'UNKNOWN' : 'NOT_ATTEMPTED'),
          observationError: fastEvidence.fastObservationError || null
        },
        soak: { requiredDays: 7, observedDays: Number(fastEvidence.fastSoakObservedDays || 0), targetSuccessRate: 0.99 },
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: fastEndpoint === 'not-configured' ? 'OPERATOR_REQUIRED' : 'CURRENT', lastCallSucceeded: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'UNKNOWN', dataCurrent: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'UNKNOWN', licensedForUse: 'REVIEW_REQUIRED' }
      },
      browser: { status: 'CURRENT', statusCode: deriveOperationalState({ configured: true, healthy: true }), source: 'static-pages+service-worker', revision: version.version }
    },
    ai: {
      scheduledAnalysis: { status: scheduledAnalysisOk ? 'CURRENT' : 'BLOCKED', statusCode: deriveOperationalState({ configured: true, healthy: scheduledAnalysisOk }), source: 'github-actions', lastCallSucceeded: scheduledAnalysisOk ? 'CURRENT' : 'BLOCKED', evidence: { marketAnalysisOk: scheduledAnalysisOk, generatedAt: data?.meta?.generatedAt || null } },
      publicChat: {
        status: proxyHealthy ? 'CURRENT' : 'NO_ROUTE', statusCode: deriveOperationalState({ configured: proxyConfigured, healthy: proxyHealthy, stale: proxyConfigured && fastEvidence.proxyHealthStatus != null && fastEvidence.proxyEvidenceFresh !== true }),
        personalKey: 'EXPLICIT_USER_CONFIG',
        sharedWorker: proxyHealthy ? 'CURRENT' : (proxyConfigured ? 'OPERATOR_REQUIRED' : 'NOT_CONFIGURED'),
        workerEndpoint: workerEndpoints.proxy?.baseUrl || null,
        health: {
          status: proxyHealthy ? 'CURRENT' : 'OPERATOR_REQUIRED',
          statusCode: proxyHealthStatus || null,
          observedAt: fastEvidence.proxyHealthObserved || null,
          revision: fastEvidence.proxyHealthRevision || null,
          sourceSha: fastEvidence.proxySourceSha || null,
          configured: fastEvidence.proxyAiConfigured === true,
          quotaConfigured: fastEvidence.proxyQuotaConfigured === true,
          authorityReady: fastEvidence.proxyAuthorityReady === true,
          authorityJurisdiction: fastEvidence.proxyAuthorityJurisdiction || null,
          providerSmokeBoundary: 'blocking-deployment-workflow-only',
          ready: fastEvidence.proxyAiReady === true,
          note: fastEvidence.proxyHealthNote || null,
          source: fastEvidence.proxyEvidenceSource || fastEvidence.evidenceSource || 'periodic-live-health',
          observationStatus: fastEvidence.proxyObservationStatus || (fastEvidence.observationAttempted ? 'UNKNOWN' : 'NOT_ATTEMPTED'),
          observationError: fastEvidence.proxyObservationError || null
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
      nativeLazyOwner: ownership.nativeLazyOwner,
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
  await syncPublicAiConfig({
    appRevision: version.version,
    workerEndpoint: workerEndpoints.proxy?.baseUrl || null,
    proxyHealthy,
    proxyEvidence: fastEvidence,
    now
  });
  await syncFredReadinessCriterion(data);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const data = JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const marketSnapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  let reconciliation = null;
  try { reconciliation = JSON.parse(await readFile(new URL('../public-data/reconciliation-status.json', import.meta.url), 'utf8')); } catch (_) {}
  console.log(JSON.stringify(await writeOperationsStatus({ data, marketSnapshot, reconciliation })));
}
