import { readFile, rename, writeFile } from 'node:fs/promises';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);
const ROUTE_OWNERS_PATH = new URL('../architecture/route-owners.json', import.meta.url);
const SEC_FUNDAMENTALS_PATH = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const WORKER_ENDPOINTS_PATH = new URL('../architecture/worker-endpoints.json', import.meta.url);
const PUBLIC_READINESS_PATH = new URL('../architecture/public-readiness.json', import.meta.url);
const PUBLIC_CONFIG_PATH = new URL('../public-config.json', import.meta.url);
const SLO_WINDOW_PATH = new URL('../public-data/operations-slo-window.json', import.meta.url);
const WORKER_HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DURABLE_QUOTE_QUALITIES = new Set(['CURRENT', 'CLOSED_CURRENT', 'DELAYED']);

// P1166 (17 작업 단위 3 / 06 O05): `configured`는 설정의 존재이고 `healthy`는 관측 결과다. 관측을
// 하지 않았으면 configured=true·healthy=true로 CONFIGURED_HEALTHY를 만들지 않고 NOT_OBSERVED로 닫는다.
export function deriveOperationalState({ configured = false, healthy = false, stale = false, rightsReview = false, observed = true } = {}) {
  if (rightsReview) return 'RIGHTS_REVIEW_REQUIRED';
  if (!configured) return 'NOT_CONFIGURED';
  if (!observed) return 'NOT_OBSERVED';
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

// The browser may only read the fast quote plane once the evidence that justifies it
// exists. `enabled` is derived here instead of being hand-edited into the published
// config, so a promotion cannot silently outrun the soak/rights evidence behind it —
// and so a config-only repair (no fresh observation) cannot revoke a valid promotion.
export function deriveFastQuotesConfig({ prior = null, endpoint = null, evidence = null, now = new Date().toISOString() } = {}) {
  const carried = prior && typeof prior === 'object' ? prior : {
    baseUrl: null,
    healthPath: '/health',
    quotesPath: '/quotes',
    enabled: false,
    certification: { soakRequiredDays: 7, soakObservedDays: 0, rightsReviewed: false, certifiedAt: null }
  };
  const usable = (() => {
    try {
      const parsed = new URL(String(endpoint || '').trim().replace(/\/+$/, ''));
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
    } catch (_) { return null; }
  })();
  // No observation was made: this is a configuration repair, not a health probe. Keep the
  // promotion decision exactly as published and only refresh the address it points at.
  if (!evidence) return { ...carried, baseUrl: usable ?? carried.baseUrl ?? null };
  const soakRequiredDays = Number(evidence.soakRequiredDays ?? 7);
  const soakObservedDays = Number(evidence.soakObservedDays ?? 0);
  const rightsReviewed = evidence.rightsReviewed === true;
  const enabled = Boolean(usable)
    && evidence.healthy === true
    && evidence.coverageComplete === true
    && rightsReviewed
    && soakObservedDays >= soakRequiredDays;
  return {
    baseUrl: usable,
    healthPath: carried.healthPath || '/health',
    quotesPath: carried.quotesPath || '/quotes',
    enabled,
    certification: {
      soakRequiredDays,
      soakObservedDays,
      rightsReviewed,
      certifiedAt: enabled ? (carried.certification?.certifiedAt || now) : null
    }
  };
}

export function derivePublicAiConfig(previous = {}, {
  appRevision = 'unknown',
  workerEndpoint = null,
  proxyHealthy = false,
  proxyEvidence = {},
  fastQuotesEndpoint = null,
  fastQuotesEvidence = null,
  now = new Date().toISOString()
} = {}) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  const priorAi = prior.ai && typeof prior.ai === 'object' ? prior.ai : {};
  const endpoint = String(workerEndpoint || '').trim().replace(/\/+$/, '') || null;
  const endpointUsable = (() => {
    try {
      const parsed = new URL(endpoint);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? endpoint : null;
    } catch (_) { return null; }
  })();
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
    // Market-data relay availability is a separate concern from the AI
    // entitlement/health branch.  A transient AI health failure must not
    // erase a configured public-reference route for quote requests, and a
    // configured endpoint is not evidence that the route is healthy.
    marketData: {
      workerUrl: endpointUsable,
      routeStatus: endpointUsable ? 'CONFIGURED' : 'UNAVAILABLE',
      healthPath: '/health',
      policy: 'public-reference',
      availability: 'verify-per-request',
      // Bounded Tier-0 quote plane. Independent of the AI branch: a temporary AI
      // outage must not disable quote routing, and vice versa.
      fastQuotes: deriveFastQuotesConfig({
        prior: prior.marketData?.fastQuotes,
        endpoint: fastQuotesEndpoint,
        evidence: fastQuotesEvidence,
        now
      })
    },
    privacy: prior.privacy || {
      clientKeysStayBrowserLocal: true,
      networkTransmission: 'provider-or-explicit-worker'
    }
  };
}

async function syncPublicAiConfig({ appRevision, workerEndpoint, proxyHealthy, proxyEvidence, fastQuotesEndpoint, fastQuotesEvidence, now } = {}) {
  let previous = {};
  try { previous = JSON.parse(await readFile(PUBLIC_CONFIG_PATH, 'utf8')); } catch (_) {}
  const config = derivePublicAiConfig(previous, { appRevision, workerEndpoint, proxyHealthy, proxyEvidence, fastQuotesEndpoint, fastQuotesEvidence, now });
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
    && marketSnapshot?.quality?.gate === 'QG-01_PASS'
    && (!Array.isArray(marketSnapshot?.errors) || marketSnapshot.errors.length === 0);
  const quotes = Array.isArray(marketSnapshot?.quotes) ? marketSnapshot.quotes : [];
  const blockedQuotes = quotes.filter((quote) => !DURABLE_QUOTE_QUALITIES.has(quote?.quality)
    || ['SOURCE_UNAVAILABLE', 'STALE_UNEXPECTED', 'UNKNOWN'].includes(String(quote?.session || 'UNKNOWN')));
  const quoteQualityComplete = Number(coverage.tier0Required) > 0
    && quotes.length === Number(coverage.tier0Required)
    && blockedQuotes.length === 0;
  const utcDay = Number.isFinite(nowMs) ? new Date(nowMs).getUTCDay() : null;
  const marketClosedGrace = (utcDay === 0 || utcDay === 6)
    && marketSnapshot?.status === 'published'
    && data?.meta?.cycleStatus === 'PUBLISHED'
    && coverageComplete
    && quoteQualityComplete;
  const withinSla = ageHours != null && ageHours >= 0 && ageHours <= maxAgeHours;
  const timeFresh = withinSla || marketClosedGrace;
  return Object.freeze({
    fresh: timeFresh && coverageComplete && quoteQualityComplete,
    withinSla,
    marketClosedGrace,
    coverageComplete,
    quoteQualityComplete,
    blockedQuotes: Object.freeze(blockedQuotes.map((quote) => Object.freeze({
      instrumentId: quote?.instrumentId || null,
      quality: quote?.quality || null,
      session: quote?.session || null
    }))),
    generatedAt,
    ageHours: ageHours == null ? null : Math.round(ageHours * 100) / 100,
    maxAgeHours,
    // P1092: ageHours/fresh/withinSla are evaluated at build time and then frozen
    // into the published artifact, which keeps serving them long after they stop
    // being true. `evaluatedAt` makes the evaluation instant explicit so a consumer
    // can tell a point-in-time judgement from a live one and recompute from
    // `generatedAt` when it needs current state.
    evaluatedAt: now,
    reason: !coverageComplete
      ? 'market-snapshot-quality-gate-blocked'
      : !quoteQualityComplete
        ? 'market-snapshot-quote-quality-blocked'
        : timeFresh
          ? null
          : (ageHours == null
            ? 'generatedAt-missing-or-invalid'
            : ageHours < 0
              ? 'market-cycle-generatedAt-in-future'
              : 'market-cycle-freshness-sla-exceeded')
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
  await atomicWriteFile(PUBLIC_READINESS_PATH, `${JSON.stringify(updated, null, 2)}\n`);
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
  // Soak days are measured by the watchdog SLO window (distinct scheduled days observed),
  // not by a health probe. Reading it here keeps planes.fast.soak, the blocker list and the
  // published consumer gate backed by the same number instead of three independent guesses.
  let sloWindow = null;
  try { sloWindow = JSON.parse(await readFile(SLO_WINDOW_PATH, 'utf8')); } catch (_) {}
  const measuredSoakDays = Number(sloWindow?.windows?.['7d']?.observedDays);
  if (Number.isFinite(measuredSoakDays)) fastEvidence.fastSoakObservedDays = measuredSoakDays;
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
    // P1173 (17 작업 단위 5): `overall`은 durable 한 축에서만 파생되므로 browser가 UNKNOWN이어도 바뀌지
    // 않는다. 그 사실을 숨기지 않도록 집계의 범위를 명시하고, 기능별로 사용 가능 범위·관측시각·누락
    // 이유를 따로 발행한다. 전역 정상 배지 대신 "무엇을 지금 쓸 수 있고 무엇이 왜 비었는지"를 남긴다.
    overallBasis: {
      planes: ['durable'],
      excludes: ['fast', 'browser'],
      note: 'overall is derived from the durable data plane only; the fast quote plane and the browser shell plane are published separately and can be UNKNOWN while overall is unchanged'
    },
    featureAvailability: {
      'market-breadth': {
        availability: durableOk ? 'AVAILABLE' : 'UNAVAILABLE',
        asOf: data?.meta?.generatedAt || null,
        missingReason: durableOk ? null : (!durableFreshness.fresh ? 'durable-market-cycle-stale' : 'durable-tier0-publish-blocked'),
        sources: ['durable']
      },
      'fundamental-ranking': {
        availability: secCoverage.coveragePct >= 80 ? (durableOk ? 'AVAILABLE' : 'DEGRADED') : 'UNAVAILABLE',
        asOf: data?.meta?.generatedAt || null,
        missingReason: secCoverage.coveragePct >= 80 ? null : `sec-fundamentals-coverage-${secCoverage.coveragePct}pct-below-80`,
        sources: ['durable']
      },
      quotes: {
        availability: fastHealthy ? 'AVAILABLE' : fastConfigured ? 'DEGRADED' : 'UNAVAILABLE',
        asOf: fastEvidence.fastHealthObserved || null,
        missingReason: fastHealthy ? null : !fastConfigured ? 'fast-quote-endpoint-not-configured'
          : fastEvidence.fastEvidenceFresh === true ? 'fast-quote-health-not-200' : 'fast-quote-observation-not-fresh',
        sources: ['fast']
      },
      'ai-chat': {
        availability: proxyHealthy ? 'AVAILABLE' : proxyConfigured ? 'DEGRADED' : 'UNAVAILABLE',
        asOf: fastEvidence.proxyHealthObserved || null,
        missingReason: proxyHealthy ? null : !proxyConfigured ? 'ai-shared-proxy-not-configured' : 'ai-shared-proxy-not-ready',
        sources: ['fast']
      },
      // 브라우저 평면은 이 producer가 관측하지 않는다. 정상이 아니라 UNKNOWN이고, 그 이유가 사용자에게
      // 전달된다 — `overall`이 이 평면을 포함하지 않는다는 사실도 overallBasis.excludes가 말한다.
      'browser-shell': {
        availability: 'UNKNOWN',
        asOf: null,
        missingReason: 'browser-plane-not-observed',
        sources: ['browser']
      }
    },
    planes: {
      durable: {
        status: durableOk ? 'CURRENT' : 'BLOCKED', statusCode: deriveOperationalState({ configured: true, healthy: durableOk }), source: 'github-actions', lastSuccessfulAt: snapshot.lastSuccessfulAt || null, coverage,
        freshness: durableFreshness,
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: 'CURRENT', lastCallSucceeded: durableOk ? 'CURRENT' : 'BLOCKED', dataCurrent: durableOk ? 'CURRENT' : 'BLOCKED', licensedForUse: 'REVIEW_REQUIRED' }
      },
      fast: {
        status: 'OPERATOR_REQUIRED', statusCode: deriveOperationalState({ configured: fastConfigured, healthy: fastHealthy, stale: fastConfigured && fastEvidence.fastHealthStatus != null && fastEvidence.fastEvidenceFresh !== true }), scheduler: 'cloudflare-cron', endpoint: fastEndpoint,
        health: {
          // P1166 (17 작업 단위 3 / 06 O05): 오래된 성공은 성공 시각(observedAt)을 유지하되 현재 건강
          // 상태로 승격하지 않는다. 재사용 창(P1104)을 벗어난 관측은 200이어도 CURRENT가 아니다.
          status: Number(fastEvidence.fastHealthStatus) === 200
            ? (fastEvidence.fastEvidenceFresh === true ? 'CURRENT' : 'UNKNOWN')
            : 'OPERATOR_REQUIRED',
          statusCode: Number.isFinite(Number(fastEvidence.fastHealthStatus)) ? Number(fastEvidence.fastHealthStatus) : null,
          coverage: fastEvidence.fastCoverage || null,
          revision: fastEvidence.fastRevision || null,
          sourceSha: fastEvidence.fastSourceSha || null,
          observedAt: fastEvidence.fastHealthObserved || null,
          source: fastEvidence.fastEvidenceSource || fastEvidence.evidenceSource || 'periodic-live-health',
          observationStatus: fastEvidence.fastObservationStatus || (fastEvidence.observationAttempted ? 'UNKNOWN' : 'NOT_ATTEMPTED'),
          observationError: fastEvidence.fastObservationError || null,
          // P1104: a carried-over observation is only usable while it is inside
          // the reuse window. Publishing the decision (and when it was made) lets
          // a consumer tell "CURRENT" from "CURRENT as of the last attempt".
          evidenceFresh: fastEvidence.fastEvidenceFresh === true,
          evidenceEvaluatedAt: now
        },
        soak: { requiredDays: 7, observedDays: Number(fastEvidence.fastSoakObservedDays || 0), targetSuccessRate: 0.99 },
        readiness: { secretConfigured: 'OPERATOR_REQUIRED', workflowWired: fastEndpoint === 'not-configured' ? 'OPERATOR_REQUIRED' : 'CURRENT', lastCallSucceeded: Number(fastEvidence.fastHealthStatus) === 200 ? 'CURRENT' : 'UNKNOWN', dataCurrent: Number(fastEvidence.fastHealthStatus) === 200 && fastEvidence.fastEvidenceFresh === true ? 'CURRENT' : 'UNKNOWN', licensedForUse: 'REVIEW_REQUIRED' }
      },
      // P1166 (17 작업 단위 3 / 06 O05): 이 producer는 브라우저 실행·Pages 도달·SW revision 일치를
      // 관측하지 않는다. 정적 셸과 서비스워커 설정의 존재를 CURRENT/healthy로 승격하지 않고,
      // configured / observed / lastAttempt / lastSuccess / dataQuality / evidenceAge를 분리한다.
      browser: {
        status: 'UNKNOWN',
        statusCode: deriveOperationalState({ configured: true, observed: false }),
        source: 'static-pages+service-worker',
        revision: version.version,
        configured: true,
        observed: 'NOT_OBSERVED',
        lastAttemptAt: null,
        lastSuccessfulAt: null,
        dataQuality: 'NOT_MEASURED',
        deliveryObserved: 'NOT_OBSERVED',
        revisionMatch: 'NOT_OBSERVED',
        evidenceAge: null,
        note: '정적 셸·서비스워커 revision은 배포 계약이며, 브라우저 실행·Pages 도달·SW revision 일치의 실측 근거가 아닙니다.'
      }
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
          observationError: fastEvidence.proxyObservationError || null,
          evidenceFresh: fastEvidence.proxyEvidenceFresh === true,
          evidenceEvaluatedAt: now
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
  await atomicWriteFile(OPERATIONS_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  await syncPublicAiConfig({
    appRevision: version.version,
    workerEndpoint: workerEndpoints.proxy?.baseUrl || null,
    proxyHealthy,
    proxyEvidence: fastEvidence,
    fastQuotesEndpoint: fastEndpoint === 'not-configured' ? null : fastEndpoint,
    fastQuotesEvidence: {
      healthy: fastHealthy,
      coverageComplete: Number.isFinite(fastObserved) && fastObserved === fastRequired && fastRequired === 16,
      // Declared by the operator in architecture/worker-endpoints.json after the
      // provider-rights review — never inferred from a healthy probe.
      rightsReviewed: workerEndpoints.fastQuotes?.rightsReviewed === true,
      soakRequiredDays: Number(workerEndpoints.fastQuotes?.soakRequiredDays ?? 7),
      soakObservedDays: fastEvidence.fastSoakObservedDays || 0
    },
    now
  });
  await syncFredReadinessCriterion(data);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  if (process.argv.includes('--config-only')) {
    const previous = JSON.parse(await readFile(PUBLIC_CONFIG_PATH, 'utf8'));
    const endpoints = JSON.parse(await readFile(WORKER_ENDPOINTS_PATH, 'utf8'));
    const version = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8'));
    const derived = derivePublicAiConfig(previous, {
      workerEndpoint: endpoints.proxy?.baseUrl,
      fastQuotesEndpoint: endpoints.fastQuotes?.baseUrl || null
    });
    // Configuration repair is not a health probe. Preserve existing AI evidence
    // and every observation timestamp when no live observation was made.
    await atomicWriteFile(PUBLIC_CONFIG_PATH, `${JSON.stringify({ ...previous, appRevision: version.version, marketData: derived.marketData }, null, 2)}\n`);
    console.log('Public market-data configuration regenerated; health evidence unchanged.');
  } else {
  const data = JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const marketSnapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  let reconciliation = null;
  try { reconciliation = JSON.parse(await readFile(new URL('../public-data/reconciliation-status.json', import.meta.url), 'utf8')); } catch (_) {}
  console.log(JSON.stringify(await writeOperationsStatus({ data, marketSnapshot, reconciliation })));
  }
}
