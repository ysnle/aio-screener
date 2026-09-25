import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPERATIONS_STATUS, DOMAIN_RECEIPT_PUBLICATION_STATUS, createOperationsStatus, validateOperationsStatus } from '../src/data/contracts/operations.js';
import { deriveDurableFreshness, deriveDomainStatus, deriveFredProviderStatus, derivePublicAiConfig, deriveRouteOwnership, reuseWorkerHealthEvidence } from './build-operations-status.mjs';
import { buildDomainReceipt } from './lib/domain-receipt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const status = JSON.parse(read('public-data/operations-status.json'));
const data = JSON.parse(read('public-data/data.json'));
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
const validation = validateOperationsStatus(status);
if (!validation.ok) throw new Error(`[operations-status] ${validation.errors.join(',')}`);
const durableQuotes = Array.from({ length: 16 }, (_, index) => ({ instrumentId: `Q${index}`, quality: 'CURRENT', session: 'CURRENT_SESSION' }));
const durableSnapshot = {
  status: 'published',
  coverage: { tier0Required: 16, tier0Observed: 16 },
  quality: { gate: 'QG-01_PASS' },
  errors: [],
  quotes: durableQuotes
};
const durableData = { meta: { generatedAt: '2026-08-28T00:00:00.000Z', marketCycleFreshnessSlaHours: 12, cycleStatus: 'PUBLISHED' } };
const durableFresh = deriveDurableFreshness({ data: durableData, marketSnapshot: durableSnapshot, now: '2026-08-28T01:00:00.000Z' });
if (!durableFresh.fresh || !durableFresh.coverageComplete || !durableFresh.quoteQualityComplete) throw new Error('[operations-status] valid durable quote set did not become current');
const staleQuoteFreshness = deriveDurableFreshness({ data: durableData, marketSnapshot: { ...durableSnapshot, quotes: durableQuotes.map((row, index) => index === 0 ? { ...row, quality: 'STALE', session: 'STALE_UNEXPECTED' } : row) }, now: '2026-08-28T01:00:00.000Z' });
if (staleQuoteFreshness.fresh || staleQuoteFreshness.reason !== 'market-snapshot-quote-quality-blocked') throw new Error('[operations-status] fresh build timestamp promoted a stale quote set');
const futureCycle = deriveDurableFreshness({ data: { meta: { ...durableData.meta, generatedAt: '2026-08-28T02:00:00.000Z' } }, marketSnapshot: durableSnapshot, now: '2026-08-28T01:00:00.000Z' });
if (futureCycle.fresh || futureCycle.reason !== 'market-cycle-generatedAt-in-future') throw new Error('[operations-status] future cycle timestamp was promoted');
const lkgFixture = {
  ai: { publicChat: { health: { statusCode: 200, observedAt: '2026-08-25T00:00:00.000Z', revision: 'v-test', sourceSha: 'a'.repeat(40), configured: true, quotaConfigured: true, authorityReady: true, authorityJurisdiction: 'us', ready: true } } },
  planes: { fast: { health: { statusCode: 200, observedAt: '2026-08-25T00:00:00.000Z', coverage: '16/16', revision: 'v-test', sourceSha: 'b'.repeat(40) } } }
};
const freshLkg = reuseWorkerHealthEvidence(lkgFixture, '2026-08-25T12:00:00.000Z');
const staleLkg = reuseWorkerHealthEvidence(lkgFixture, '2026-08-27T00:00:00.000Z');
if (freshLkg.observationAttempted !== false || freshLkg.evidenceSource !== 'last-observed-live-health' || !freshLkg.proxyEvidenceFresh || !freshLkg.fastEvidenceFresh) throw new Error('[operations-status] fresh last-observed health is not safely reusable');
if (staleLkg.proxyEvidenceFresh || staleLkg.fastEvidenceFresh) throw new Error('[operations-status] stale last-observed health was promoted to current');
const publishedConfig = derivePublicAiConfig({}, {
  appRevision: 'v-test',
  workerEndpoint: 'https://proxy.example.test/',
  proxyHealthy: true,
  proxyEvidence: {
    proxyHealthStatus: 200,
    proxyHealthObserved: '2026-08-27T00:00:00.000Z',
    proxyObservationStatus: 'SUCCESS',
    proxyEvidenceSource: 'periodic-live-health'
  },
  now: '2026-08-27T00:01:00.000Z'
});
if (publishedConfig.appRevision !== 'v-test' || publishedConfig.ai.workerUrl !== 'https://proxy.example.test' || publishedConfig.ai.routeStatus !== 'PUBLISHED' || publishedConfig.ai.routeEvidence.status !== 'CURRENT') throw new Error('[operations-status] healthy Worker evidence did not publish a normalized public route');
const disabledConfig = derivePublicAiConfig(publishedConfig, {
  appRevision: 'v-test',
  workerEndpoint: 'https://proxy.example.test/',
  proxyHealthy: false,
  proxyEvidence: {
    proxyHealthObserved: '2026-08-27T00:02:00.000Z',
    proxyObservationStatus: 'FAILED',
    proxyEvidenceSource: 'periodic-live-health'
  },
  now: '2026-08-27T00:02:00.000Z'
});
if (disabledConfig.ai.workerUrl !== null || disabledConfig.ai.serverMode !== 'personal-key-only' || disabledConfig.ai.chatPolicy !== 'personal-key-only' || disabledConfig.ai.routeStatus !== 'DISABLED' || disabledConfig.ai.routeReason !== 'WORKER_HEALTH_UNAVAILABLE' || disabledConfig.ai.routeEvidence.status !== 'OPERATOR_REQUIRED') throw new Error('[operations-status] failed Worker observation left a public route published');
const staleConfig = derivePublicAiConfig({}, {
  appRevision: 'v-test',
  workerEndpoint: 'https://proxy.example.test/',
  proxyHealthy: false,
  proxyEvidence: { proxyHealthStatus: 200, proxyEvidenceFresh: false, proxyObservationStatus: 'NOT_ATTEMPTED', proxyHealthObserved: '2026-08-25T00:00:00.000Z' },
  now: '2026-08-27T00:00:00.000Z'
});
if (staleConfig.ai.workerUrl !== null || staleConfig.ai.routeReason !== 'WORKER_HEALTH_STALE') throw new Error('[operations-status] stale Worker evidence did not disable the public route');
const invalidEndpointConfig = derivePublicAiConfig({}, {
  appRevision: 'v-test',
  workerEndpoint: 'http://proxy.example.test/',
  proxyHealthy: true,
  proxyEvidence: { proxyHealthStatus: 200, proxyEvidenceFresh: true, proxyObservationStatus: 'SUCCESS' },
  now: '2026-08-27T00:00:00.000Z'
});
if (invalidEndpointConfig.ai.workerUrl !== null || invalidEndpointConfig.ai.routeReason !== 'WORKER_ENDPOINT_INVALID') throw new Error('[operations-status] non-HTTPS Worker endpoint was published');
if (status.planes.fast.status !== 'OPERATOR_REQUIRED' && status.planes.fast.status !== 'CURRENT') throw new Error('[operations-status] fast plane status is not explicit');
if (!/^https:\/\/aio-screener-data-plane\.[^/]+\.workers\.dev$/.test(String(status.planes.fast.endpoint || ''))) throw new Error('[operations-status] fast plane endpoint is missing or includes a path suffix');

// RM-00/F-07 ratchet: route ownership published here must reconcile with the code-derived
// route-owners.json ledger. A hardcoded "required native routes" list (the pre-remediation
// design) can silently diverge from measurement; equality with the ledger cannot.
const measured = deriveRouteOwnership(routeOwners);
const sameSet = (a, b) => {
  const left = [...(a || [])].sort();
  const right = [...(b || [])].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
};
if (status.routes.supported !== measured.supported) throw new Error('[operations-status] supported route count does not match route-owners.json');
if (!sameSet(status.routes.nativeLifecycleOwner, measured.nativeLifecycleOwner)) throw new Error('[operations-status] nativeLifecycleOwner does not match route-owners.json');
if (!sameSet(status.routes.nativeRendererOwner, measured.nativeRendererOwner)) throw new Error('[operations-status] nativeRendererOwner does not match route-owners.json');
if (!sameSet(status.routes.nativeLazyOwner, measured.nativeLazyOwner)) throw new Error('[operations-status] nativeLazyOwner does not match route-owners.json');
if (!sameSet(status.routes.nativeOwner, measured.nativeOwner)) throw new Error('[operations-status] nativeOwner does not match route-owners.json');
if (status.routes.legacyOwner !== measured.legacyOwner) throw new Error('[operations-status] legacyOwner does not match route-owners.json');

const nativeRendererOwner = status.routes.nativeRendererOwner || [];
const nativeOwner = status.routes.nativeOwner || [];
if (status.routes.legacyOwner + nativeRendererOwner.length !== status.routes.supported) throw new Error('[operations-status] renderer ownership does not reconcile');
if (status.routes.legacyOwner + nativeOwner.length > status.routes.supported) throw new Error('[operations-status] complete ownership exceeds supported routes');
if (nativeOwner.some((route) => !nativeRendererOwner.includes(route))) throw new Error('[operations-status] complete native owner must also own the renderer');
if (nativeRendererOwner.some((route) => typeof route !== 'string' || route.length === 0)) throw new Error('[operations-status] native renderer owner entry is invalid');
if (status.overall === 'VERIFIED_LIVE') throw new Error('[operations-status] invalid unsupported overall status');
const scheduledAnalysisOk = data.meta?.marketAnalysisOk === true;
if ((status.ai?.scheduledAnalysis?.status === 'CURRENT') !== scheduledAnalysisOk) throw new Error('[operations-status] scheduledAnalysis status does not match data.meta.marketAnalysisOk');
if ((status.ai?.scheduledAnalysis?.lastCallSucceeded === 'CURRENT') !== scheduledAnalysisOk) throw new Error('[operations-status] scheduledAnalysis lastCallSucceeded does not match data.meta.marketAnalysisOk');
const expectedFredAttempt = data.meta?.fredAttemptedAt || data.meta?.generatedAt || null;
if (status.providers?.fred?.lastAttemptAt !== expectedFredAttempt) throw new Error('[operations-status] FRED lastAttemptAt must use explicit provider attempt evidence');
if (data.meta?.fredFetchOk === true && status.providers?.fred?.lastFetchAt !== (data.meta?.fredLastSuccessfulAt || data.meta?.generatedAt || null)) throw new Error('[operations-status] FRED lastFetchAt must use explicit successful-fetch evidence');

// P1189: FRED provider status is an operational claim and must come from
// OPERATIONS_STATUS. It used to publish 'UNAVAILABLE' — a rights/feature word
// (P1091 two-axes confusion) — so validateOperationsStatus rejected the whole
// artifact and fetch-data.mjs aborted before writing operations-status, which
// killed every cycle where FRED was not fully fetched, including the explicit
// LKG cycle ci-refresh-artifact-integrity-check allows.
const fredStatusFixtures = [
  [{ fetchOk: true, keyPresent: true }, 'CURRENT'],
  [{ fetchOk: false, keyPresent: true }, 'BLOCKED'],
  [{ fetchOk: false, keyPresent: false }, 'OPERATOR_REQUIRED']
];
for (const [input, expected] of fredStatusFixtures) {
  const derived = deriveFredProviderStatus(input);
  if (derived !== expected) throw new Error(`[operations-status] FRED provider status drifted for ${JSON.stringify(input)}: ${derived}`);
  if (!OPERATIONS_STATUS.includes(derived)) throw new Error(`[operations-status] FRED provider status ${derived} is outside the declared operations vocabulary`);
}
if (fredStatusFixtures.some(([input]) => deriveFredProviderStatus(input) === 'UNAVAILABLE')) throw new Error('[operations-status] the retired rights word leaked back into an operations status');
const builderSource = read('scripts/build-operations-status.mjs');
if (!/status: fredProviderStatus/.test(builderSource)) throw new Error('[operations-status] the FRED provider status must be derived, not written inline');
// P1256 (E5 O06 / 06 O06): 도메인 receipt 일반화 픽스처 — SEC 외 도메인도 전부 실패·일부 실패·
// 미수집을 구분하고, 소비자는 "기존값 유지"를 "새 수집 성공"으로 말하지 않아야 한다.
// 이 픽스처는 구 P1169의 SEC 전용 판정을 모든 도메인의 공통 계약으로 고정한다.
const receiptAt = '2026-09-25T00:00:00.000Z';
const receiptPrior = { lastSuccessfulObservation: '2026-09-24T00:00:00.000Z' };
const receiptRows = (count, status) => Array.from({ length: count }, (unused, index) => ({ symbol: `S${index}`, status, attemptedAt: receiptAt }));
const retainedReceipt = buildDomainReceipt({ domain: 'market-quotes', attemptedAt: receiptAt, priorReceipt: receiptPrior, eligible: 5, attempted: 5, updated: 0, stored: 5, failures: receiptRows(5, 'TRANSIENT_PROVIDER_FAILURE') });
const partialReceipt = buildDomainReceipt({ domain: 'news', attemptedAt: receiptAt, priorReceipt: receiptPrior, eligible: 5, attempted: 5, updated: 3, stored: 5, failures: receiptRows(2, 'TRANSIENT_PROVIDER_FAILURE') });
const successReceipt = buildDomainReceipt({ domain: 'macro-fred', attemptedAt: receiptAt, priorReceipt: receiptPrior, eligible: 5, attempted: 5, updated: 5, stored: 5, failures: [] });
const idleReceipt = buildDomainReceipt({ domain: 'options-put-call', attemptedAt: receiptAt, priorReceipt: receiptPrior, eligible: 5, attempted: 0, updated: 0, stored: 5, failures: [] });
const derived = deriveDomainStatus({ 'market-quotes': retainedReceipt, news: partialReceipt, 'macro-fred': successReceipt, 'options-put-call': idleReceipt });
if (derived['market-quotes'].publicationStatus !== 'NO_REFRESH_RETAINED') throw new Error(`[operations-status] a total-failure domain must not read as success: ${derived['market-quotes'].publicationStatus}`);
if (!derived['market-quotes'].userCopy.includes('기존값 유지') || derived['market-quotes'].userCopy.includes('새 수집 성공')) throw new Error('[operations-status] retained values must not be described as a fresh collection success');
if (derived['market-quotes'].lastSuccessfulObservation !== receiptPrior.lastSuccessfulObservation) throw new Error('[operations-status] lastSuccessfulObservation advanced without a single update');
if (derived.news.publicationStatus !== 'PARTIAL' || !derived.news.userCopy.includes('일부만 갱신')) throw new Error('[operations-status] a partial domain must say which part stayed at the previous value');
if (derived['macro-fred'].publicationStatus !== 'SUCCESS' || !derived['macro-fred'].userCopy.includes('새 수집 성공')) throw new Error('[operations-status] a fully updated domain must read as a fresh collection success');
if (derived['macro-fred'].lastSuccessfulObservation !== receiptAt) throw new Error('[operations-status] an updating batch must advance lastSuccessfulObservation');
if (derived['options-put-call'].publicationStatus !== 'NOT_ATTEMPTED' || !derived['options-put-call'].userCopy.includes('미수집')) throw new Error('[operations-status] a domain with nothing due is not a collection result');
for (const entry of Object.values(derived)) {
  if (!DOMAIN_RECEIPT_PUBLICATION_STATUS.includes(entry.publicationStatus)) throw new Error(`[operations-status] domain receipt status outside the declared vocabulary: ${entry.publicationStatus}`);
}
const withReceipts = createOperationsStatus({
  generatedAt: new Date().toISOString(),
  appRevision: 'test', dataRevision: 'test', evidenceRevision: 'test',
  overall: 'BLOCKED',
  planes: { durable: { status: 'BLOCKED' }, fast: { status: 'OPERATOR_REQUIRED' } },
  providers: { fred: { status: 'OPERATOR_REQUIRED' } },
  reconciliation: { categoryCount: 22 },
  domainReceipts: derived
});
const receiptValidation = validateOperationsStatus(withReceipts);
if (!receiptValidation.ok) throw new Error(`[operations-status] domain receipt surface failed contract validation: ${receiptValidation.errors.join(',')}`);
if (!withReceipts.domainReceipts['market-quotes'] || withReceipts.domainReceipts['market-quotes'].publicationStatus !== 'NO_REFRESH_RETAINED') throw new Error('[operations-status] the domain receipt surface must survive contract normalization');

console.log(JSON.stringify({ ok: true, overall: status.overall, durable: status.planes.durable.status, fast: status.planes.fast.status, blockers: status.blockers, domainReceiptFixtures: 4 }));
