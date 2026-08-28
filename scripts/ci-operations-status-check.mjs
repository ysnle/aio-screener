import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOperationsStatus } from '../src/data/contracts/operations.js';
import { derivePublicAiConfig, deriveRouteOwnership, reuseWorkerHealthEvidence } from './build-operations-status.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const status = JSON.parse(read('public-data/operations-status.json'));
const data = JSON.parse(read('public-data/data.json'));
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
const validation = validateOperationsStatus(status);
if (!validation.ok) throw new Error(`[operations-status] ${validation.errors.join(',')}`);
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
console.log(JSON.stringify({ ok: true, overall: status.overall, durable: status.planes.durable.status, fast: status.planes.fast.status, blockers: status.blockers }));
