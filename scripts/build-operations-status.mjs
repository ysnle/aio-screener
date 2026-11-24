import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';

import { describeDomainReceipt } from './lib/domain-receipt.mjs';
import { aiProviderRefusal } from './lib/operational-health.mjs';

export const OPERATIONS_STATUS_OUT = new URL('../public-data/operations-status.json', import.meta.url);
const SEC_FUNDAMENTALS_PATH = new URL('../public-data/sec-fundamentals.json', import.meta.url);
const SEC_FUNDAMENTALS_SUMMARY_PATH = new URL('../public-data/sec-fundamentals-summary.json', import.meta.url);
const WORKER_ENDPOINTS_PATH = new URL('../architecture/worker-endpoints.json', import.meta.url);
const SLO_WINDOW_PATH = new URL('../public-data/operations-slo-window.json', import.meta.url);
const SCREENER_EXTENDED_PATH = new URL('../public-data/screener-extended.json', import.meta.url); // v57.81
const WORKER_HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MARKET_CYCLE_FRESHNESS_SLA_MS = 12 * 60 * 60 * 1000;
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

// `overall` asks for an operator only while an operator blocker is open. It was the constant OPERATOR_REQUIRED
// whenever the durable plane published, so it read the same all week (11/09-11/15) with blockers [] and told nobody anything.
export function deriveOverall({ durableOk = false, blockers = [] } = {}) {
  if (!durableOk) return 'BLOCKED';
  return blockers.length ? 'OPERATOR_REQUIRED' : 'CURRENT';
}

export function deriveSecCoverage(secFundamentals, fallbackPct = 0) {
  const eligible = Number(secFundamentals?.eligible);
  const stored = Number(secFundamentals?.stored ?? Object.keys(secFundamentals?.data || {}).length);
  if (Number.isFinite(eligible) && eligible > 0 && Number.isFinite(stored)) {
    return { stored, eligible, coveragePct: Math.round(stored / eligible * 1000) / 10 };
  }
  return { stored: null, eligible: null, coveragePct: Number(fallbackPct) || 0 };
}

export function deriveFundamentalRankingAvailability(secCoverage, receipt, durableOk) {
  const covered = secCoverage.coveragePct >= 80;
  return {
    availability: covered ? (durableOk ? 'AVAILABLE' : 'DEGRADED') : 'UNAVAILABLE',
    asOf: receipt?.lastSuccessfulObservation || null,
    missingReason: covered ? (durableOk ? null : 'durable-market-cycle-unavailable') : `sec-fundamentals-coverage-${secCoverage.coveragePct}pct-below-80`,
    sources: ['durable']
  };
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

// Health alone cannot make the user-facing quote feature AVAILABLE.
// The public route is disabled until rights and the measured soak both close.
export function deriveFastQuoteAvailability({ configured = false, healthy = false, rightsReviewed = false, soakObservedDays = 0, soakRequiredDays = 7 } = {}) {
  if (!configured) return { availability: 'UNAVAILABLE', missingReason: 'fast-quote-endpoint-not-configured' };
  if (!rightsReviewed) return { availability: 'UNAVAILABLE', missingReason: 'fast-quote-provider-rights-not-reviewed' };
  if (soakObservedDays < soakRequiredDays) return { availability: 'UNAVAILABLE', missingReason: 'fast-quote-soak-incomplete' };
  if (!healthy) return { availability: 'DEGRADED', missingReason: 'fast-quote-health-not-current' };
  return { availability: 'AVAILABLE', missingReason: null };
}

/**
 * P1189: `providers.<name>.status` is validated against OPERATIONS_STATUS. This
 * field used to publish 'UNAVAILABLE' — a RIGHTS_STATUS/FEATURE_AVAILABILITY word
 * with no operations meaning (the P1091 two-axes confusion) — so
 * validateOperationsStatus rejected the artifact and fetch-data.mjs aborted
 * before writing operations-status. Every cycle where FRED was not
 * fully fetched died, including the keyless LKG cycle that
 * ci-refresh-artifact-integrity-check explicitly allows. An operator must
 * configure a missing key; a configured provider that did not fetch is BLOCKED.
 */
// 도메인 receipt 소비 — "새 수집 성공"과 "기존값 유지"를 같은 성공으로
// 말하지 않는다. 사용자 복구 설명은 내부 runId 대신 기능 수준 언어로 바꿔 발행한다(O05의 축).
export function deriveDomainStatus(domainReceipts = null) {
  const entries = domainReceipts && typeof domainReceipts === 'object' ? domainReceipts : {};
  return Object.fromEntries(Object.entries(entries).map(([domain, receipt]) => {
    const described = describeDomainReceipt(receipt);
    const counts = receipt && receipt.counts && typeof receipt.counts === 'object' ? receipt.counts : {};
    return [domain, {
      publicationStatus: described.publicationStatus,
      userCopy: described.userCopy,
      lastSuccessfulObservation: described.lastSuccessfulObservation,
      counts: {
        eligible: Number(counts.eligible) || 0,
        attempted: Number(counts.attempted) || 0,
        updated: Number(counts.updated) || 0,
        retained: Number(counts.retained) || 0
      }
    }];
  }));
}

// Availability of the extended screener shard. Absent → UNAVAILABLE (the screener offers only the core view's
// data then); older than two days, below its coverage floor, or built on a retained membership source → DEGRADED.
export const EXTENDED_SHARD_MAX_AGE_HOURS = 48;
export function deriveExtendedScreenerAvailability(shard, now = new Date().toISOString()) {
  if (!shard || shard.schemaVersion !== 'screener-extended.v1' || !shard.asOf) {
    return { availability: 'UNAVAILABLE', asOf: null, missingReason: 'extended-shard-not-produced', sources: ['durable'] };
  }
  const ageHours = (Date.parse(now) - Date.parse(shard.asOf)) / 3_600_000;
  const pricePct = Number(shard.coverage?.pricePct);
  const floorPct = Number(shard.coverage?.floorPct ?? 60);
  const retained = Object.entries(shard.membership?.status || {}).filter(([, status]) => status !== 'CURRENT').map(([id]) => id);
  const reason = !(ageHours <= EXTENDED_SHARD_MAX_AGE_HOURS) ? `extended-shard-${Math.round(ageHours)}h-old`
    : !(pricePct >= floorPct) ? `extended-price-coverage-${pricePct}pct-below-${floorPct}`
      : retained.length ? `membership-source-not-current:${retained.join('+')}` : null;
  return { availability: reason ? 'DEGRADED' : 'AVAILABLE', asOf: shard.asOf, missingReason: reason, sources: ['durable'] };
}

export function deriveFredProviderStatus({ fetchOk, keyPresent } = {}) {
  if (fetchOk === true) return 'CURRENT';
  return keyPresent === true ? 'BLOCKED' : 'OPERATOR_REQUIRED';
}

export function deriveDurableFreshness({ data = {}, marketSnapshot = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = data?.meta?.generatedAt || marketSnapshot?.generatedAt || null;
  const generatedMs = Date.parse(generatedAt || '');
  const nowMs = Date.parse(now || '');
  const ageMs = Number.isFinite(generatedMs) && Number.isFinite(nowMs) ? nowMs - generatedMs : null;
  const ageHours = ageMs == null ? null : ageMs / 3_600_000;
  // Artifact metadata cannot extend the canonical wall-clock freshness window.
  const maxAgeHours = MARKET_CYCLE_FRESHNESS_SLA_MS / 3_600_000;
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
  const withinSla = ageMs != null && ageMs >= 0 && ageMs <= MARKET_CYCLE_FRESHNESS_SLA_MS;
  // Operational freshness follows the same wall-clock SLA as browser decisions.
  return Object.freeze({
    fresh: withinSla && coverageComplete && quoteQualityComplete,
    withinSla,
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
        : withinSla
          ? null
          : (ageHours == null
            ? 'generatedAt-missing-or-invalid'
            : ageMs < 0
              ? 'market-cycle-generatedAt-in-future'
              : 'market-cycle-freshness-sla-exceeded')
  });
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
    proxyAiProvider: proxy.provider || null,
    proxyAiModel: proxy.model || null,
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
      proxyAiProvider: body?.ai?.provider || null,
      proxyAiModel: body?.ai?.model || null,
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
  let workerEndpoints = {};
  try { workerEndpoints = JSON.parse(await readFile(WORKER_ENDPOINTS_PATH, 'utf8')); } catch (_) {}
  let sec = secFundamentals;
  if (!sec) {
    try { sec = JSON.parse(await readFile(SEC_FUNDAMENTALS_PATH, 'utf8')); } catch (_) { sec = null; }
  }
  if (!sec) {
    // The full ledger is producer-only (data-store branch) and absent from the refresh-data checkout; the
    // published projection carries the same eligible/stored counters, so coverage never falls back to a guess.
    try { sec = JSON.parse(await readFile(SEC_FUNDAMENTALS_SUMMARY_PATH, 'utf8')); } catch (_) { sec = null; }
  }
  const secCoverage = deriveSecCoverage(sec, data?.meta?.fundamentalCoveragePct);
  let extendedShard = null;
  try { extendedShard = JSON.parse(await readFile(SCREENER_EXTENDED_PATH, 'utf8')); } catch (_) { extendedShard = null; }
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
  // A retained (previous verified) analysis is shown, but this run's call was blocked — not CURRENT.
  const scheduledAnalysisRetained = data?.meta?.marketAnalysisRetained || null;
  const scheduledAnalysisOk = data?.meta?.marketAnalysisOk === true && !scheduledAnalysisRetained;
  // A retained analysis is DEGRADED with statusCode STALE — 'STALE' is not an OPERATIONS_STATUS and made the
  // operations contract reject the artifact, failing the whole refresh whenever the analysis was retained.
  const fastConfigured = fastEndpoint !== 'not-configured';
  const [fastObserved, fastRequired] = String(fastEvidence.fastCoverage || '').split('/').map(Number);
  const fastHealthy = fastEvidence.fastEvidenceFresh === true && Number(fastEvidence.fastHealthStatus) === 200 && Number.isFinite(fastObserved) && fastObserved === fastRequired && fastRequired === 16;
  const quoteAvailability = deriveFastQuoteAvailability({
    configured: fastConfigured,
    healthy: fastHealthy,
    rightsReviewed: fastConfig.rightsReviewed === true,
    soakObservedDays: fastEvidence.fastSoakObservedDays || 0,
    soakRequiredDays: Number(fastConfig.soakRequiredDays ?? 7)
  });
  const proxyConfigured = !!workerEndpoints.proxy?.baseUrl;
  const proxyHealthStatus = Number(fastEvidence.proxyHealthStatus ?? fastEvidence.proxyHealthPathObserved);
  const proxyHealthy = fastEvidence.proxyEvidenceFresh === true && proxyHealthStatus === 200
    && fastEvidence.proxyAiProvider === 'openai'
    && fastEvidence.proxyAiModel === 'gpt-6-luna'
    && fastEvidence.proxyAiReady === true
    && fastEvidence.proxyAuthorityReady === true
    && fastEvidence.proxyAuthorityJurisdiction === 'us';
  const fredObserved = data?.meta?.fredFetchOk === true;
  const fredConfigured = !!(process.env.FRED_API_KEY || fredObserved);
  const fredProviderStatus = deriveFredProviderStatus({ fetchOk: data?.meta?.fredFetchOk === true, keyPresent: fredConfigured });
  const blockers = [];
  if (!durableOk) blockers.push('durable_tier0_publish_blocked');
  if (!durableFreshness.fresh) blockers.push('durable_market_cycle_stale');
  // The rights decision is recorded in worker-endpoints.json; once it is made and the
  // quote feature is available these are no longer open blockers.
  if (quoteAvailability.availability !== 'AVAILABLE') blockers.push('fast_plane_soak_and_rights_review_required');
  if (fastConfig.rightsReviewed !== true) blockers.push('provider_rights_review_required');
  if (!proxyHealthy) blockers.push('ai_proxy_deploy_or_readiness_required');
  // The Worker can be healthy while the provider refuses the shared account (11/10: credit_balance_exhausted, 11 h).
  if (aiProviderRefusal(data)) blockers.push('ai_provider_account_refused');
  if (secCoverage.coveragePct < 80) blockers.push('sec_fundamentals_coverage_below_80_percent');
  const status = createOperationsStatus({
    generatedAt: now,
    appRevision: version.version,
    dataRevision: snapshot.revision || `public-data:${data?.meta?.generatedAt || 'unknown'}`,
    evidenceRevision: 'evidence-contract:v1+inferred-claim:v1+reconciliation:v2+page-timeline:v1',
    overall: deriveOverall({ durableOk, blockers }),
    // planes/excludes describe direct plane status inputs. The blockers list is a separate input.
    overallBasis: {
      planes: ['durable'],
      excludes: ['fast', 'browser'],
      includesBlockers: true,
      note: 'A blocked durable data plane sets overall to BLOCKED. Otherwise any open blocker sets OPERATOR_REQUIRED, including fast quote and AI blockers. Browser observations are reported separately.'
    },
    featureAvailability: {
      'market-breadth': {
        availability: durableOk ? 'AVAILABLE' : 'UNAVAILABLE',
        asOf: data?.meta?.generatedAt || null,
        missingReason: durableOk ? null : (!durableFreshness.fresh ? 'durable-market-cycle-stale' : 'durable-tier0-publish-blocked'),
        sources: ['durable']
      },
      'fundamental-ranking': deriveFundamentalRankingAvailability(secCoverage, sec?.domainReceipt, durableOk),
      quotes: {
        availability: quoteAvailability.availability,
        asOf: fastEvidence.fastHealthObserved || null,
        missingReason: quoteAvailability.missingReason,
        sources: ['fast']
      },
      'ai-chat': {
        availability: proxyHealthy ? 'AVAILABLE' : proxyConfigured ? 'DEGRADED' : 'UNAVAILABLE',
        asOf: fastEvidence.proxyHealthObserved || null,
        missingReason: proxyHealthy ? null : !proxyConfigured ? 'ai-shared-proxy-not-configured' : 'ai-shared-proxy-not-ready',
        sources: ['fast']
      },
      // The extended screener shard (Russell 2000 + Nasdaq beyond the core) is published by its own job.
      'screener-extended': deriveExtendedScreenerAvailability(extendedShard, now),
      // 브라우저 평면은 이 producer가 관측하지 않는다. 정상이 아니라 UNKNOWN이고, 그 이유가 사용자에게
      // 전달된다 — `overall`이 이 평면을 포함하지 않는다는 사실도 overallBasis.excludes가 말한다.
      'browser-shell': {
        availability: 'UNKNOWN',
        asOf: null,
        missingReason: 'browser-plane-not-observed',
        sources: ['browser']
      }
    },
    // 도메인 receipt의 사용자 복구 설명 — "새 수집 성공"과 "기존값 유지 중"이 여기서 갈린다.
    domainReceipts: deriveDomainStatus(data?.meta?.domainReceipts),
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
          // 상태로 승격하지 않는다. 재사용 창 을 벗어난 관측은 200이어도 CURRENT가 아니다.
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
          // A carried-over observation is only usable while it is inside
          // the reuse window. Publishing the decision (and when it was made) lets
          // a consumer tell "CURRENT" from "CURRENT as of the last attempt".
          evidenceFresh: fastEvidence.fastEvidenceFresh === true,
          evidenceEvaluatedAt: now
        },
        soak: { requiredDays: Number(fastConfig.soakRequiredDays ?? 7), observedDays: Number(fastEvidence.fastSoakObservedDays || 0), targetSuccessRate: 0.99 },
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
      scheduledAnalysis: { status: scheduledAnalysisOk ? 'CURRENT' : (scheduledAnalysisRetained ? 'DEGRADED' : 'BLOCKED'), statusCode: deriveOperationalState({ configured: true, healthy: scheduledAnalysisOk, stale: !!scheduledAnalysisRetained }), source: 'github-actions', lastCallSucceeded: scheduledAnalysisOk ? 'CURRENT' : 'BLOCKED', evidence: { marketAnalysisOk: scheduledAnalysisOk, retainedFrom: scheduledAnalysisRetained?.from || null, generatedAt: data?.meta?.generatedAt || null } },
      publicChat: {
        status: proxyHealthy ? 'CURRENT' : 'NO_ROUTE', statusCode: deriveOperationalState({ configured: proxyConfigured, healthy: proxyHealthy, stale: proxyConfigured && fastEvidence.proxyHealthStatus != null && fastEvidence.proxyEvidenceFresh !== true }),
        personalKey: 'UNSUPPORTED',
        sharedWorker: proxyHealthy ? 'CURRENT' : (proxyConfigured ? 'OPERATOR_REQUIRED' : 'NOT_CONFIGURED'),
        workerEndpoint: workerEndpoints.proxy?.baseUrl || null,
        health: {
          status: proxyHealthy ? 'CURRENT' : 'OPERATOR_REQUIRED',
          statusCode: proxyHealthStatus || null,
          observedAt: fastEvidence.proxyHealthObserved || null,
          revision: fastEvidence.proxyHealthRevision || null,
          sourceSha: fastEvidence.proxySourceSha || null,
          configured: fastEvidence.proxyAiConfigured === true,
          provider: fastEvidence.proxyAiProvider || null,
          model: fastEvidence.proxyAiModel || null,
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
        rights: fredConfigured ? 'REVIEW_REQUIRED' : 'OPERATOR_REQUIRED', statusCode: fredConfigured ? 'RIGHTS_REVIEW_REQUIRED' : 'NOT_CONFIGURED',
        use: 'official-series',
        // FRED relays third-party series; the ICE BofA HY OAS carries ICE's own reproduction restriction.
        rightsNotes: ['BAMLH0A0HYM2: ICE Data Indices — reproduction requires ICE prior written permission (FRED series notice)'],
        status: fredProviderStatus,
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
      rawProducerClaimGate: 'not_applicable_for_quote_plane'
    },
    // No route-ownership block. It was a copy of architecture/route-owners.json (code state) inside a data
    // artifact; nothing read it, and a data overlay release (data built on newer code, shipped on older code) failed CI
    // on the copy 43 times on 11/19-20 (nativeLazyOwner). Route ownership is checked against the code by
    // ci-retirement-contract.mjs and ci-operations-contract-check.mjs.
    blockers
  });
  const validation = validateOperationsStatus(status);
  if (!validation.ok) throw new Error(`OPERATIONS_STATUS_INVALID:${validation.errors.join(',')}`);
  // This is the producer's only output. public-config.json (the AI route and the fast-plane promotion) is
  // release-scoped and changes only in code commits; the browser checks both Workers itself on every load. The FRED
  // fetch result lives here as providers.fred.status, not in architecture/public-readiness.json.
  await atomicWriteFile(OPERATIONS_STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const data = JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8'));
  const marketSnapshot = JSON.parse(await readFile(new URL('../public-data/market-snapshot.json', import.meta.url), 'utf8'));
  let reconciliation = null;
  try { reconciliation = JSON.parse(await readFile(new URL('../public-data/reconciliation-status.json', import.meta.url), 'utf8')); } catch (_) {}
  console.log(JSON.stringify(await writeOperationsStatus({ data, marketSnapshot, reconciliation })));
}
