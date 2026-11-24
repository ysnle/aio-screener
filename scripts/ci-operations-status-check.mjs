#!/usr/bin/env node
// Operations status and operator readiness. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('operations-status', [
// ── section operations-status (was ci-operations-status-check.mjs) ──
['operations-status', async () => {
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { OPERATIONS_STATUS, DOMAIN_RECEIPT_PUBLICATION_STATUS, createOperationsStatus, validateOperationsStatus } = await import('../src/data/contracts/operations.js');
const { deriveDurableFreshness, deriveDomainStatus, deriveFastQuoteAvailability, deriveFredProviderStatus, deriveFundamentalRankingAvailability, reuseWorkerHealthEvidence, deriveOverall } = await import('./build-operations-status.mjs');
// A later market refresh cannot renew the independent SEC observation.
const secObserved = '2026-11-16T22:36:15.988Z';
const secReceipt = { lastSuccessfulObservation: secObserved };
const coveredSec = { coveragePct: 80 };
const ranking = deriveFundamentalRankingAvailability(coveredSec, secReceipt, false);
if (ranking.asOf !== secObserved || ranking.availability !== 'DEGRADED' || !ranking.missingReason) throw new Error('[operations-status] v60.25 retained SEC observation or degraded reason lost');
if (deriveFundamentalRankingAvailability(coveredSec, null, true).asOf !== null) throw new Error('[operations-status] v60.25 unobserved SEC ranking was dated');
// Overall follows the blockers (it was OPERATOR_REQUIRED all week with blockers []); every combination of the two inputs.
for (const durableOk of [true, false]) for (const blockers of [[], ['ai_proxy_deploy_or_readiness_required']]) {
  const expected = !durableOk ? 'BLOCKED' : blockers.length ? 'OPERATOR_REQUIRED' : 'CURRENT';
  if (deriveOverall({ durableOk, blockers }) !== expected) throw new Error(`[operations-status] v60.18 overall for durableOk=${durableOk} blockers=${blockers.length} must be ${expected}`);
}
const { buildDomainReceipt } = await import('./lib/domain-receipt.mjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const status = JSON.parse(read('public-data/operations-status.json'));
const data = JSON.parse(read('public-data/data.json'));
const validation = validateOperationsStatus(status);
if (!validation.ok) throw new Error(`[operations-status] ${validation.errors.join(',')}`);
// Every status literal the builder can publish is in the declared vocabulary. A retained AI analysis wrote
// 'STALE' (a statusCode, not a status), the contract rejected the artifact, and that refresh failed outright.
// PASS (readiness criteria) and MATCH (reconciliation tier) belong to other contracts outside the walked surface.
const builderStatusLiterals = [...read('scripts/build-operations-status.mjs').matchAll(/\bstatus:\s*([^,\n]+)/g)]
  .flatMap((match) => [...match[1].matchAll(/'([A-Z_]+)'/g)].map((literal) => literal[1]))
  .filter((literal) => !OPERATIONS_STATUS.includes(literal) && !['PASS', 'MATCH'].includes(literal));
if (builderStatusLiterals.length) throw new Error(`[operations-status] v57.54 builder publishes undeclared status: ${[...new Set(builderStatusLiterals)].join(',')}`);
// A healthy endpoint without rights/soak must not become an AVAILABLE quote feature in operations-status.
// Whether the browser reads the plane is the operator's promotion in public-config.json (ci-fast-plane-consumer-gate).
const healthyUncertified = deriveFastQuoteAvailability({ configured: true, healthy: true, rightsReviewed: false, soakObservedDays: 0 });
if (healthyUncertified.availability !== 'UNAVAILABLE' || healthyUncertified.missingReason !== 'fast-quote-provider-rights-not-reviewed') throw new Error('[operations-status] uncertified fast quotes were promoted');
if (deriveFastQuoteAvailability({ configured: true, healthy: true, rightsReviewed: true, soakObservedDays: 6 }).availability !== 'UNAVAILABLE') throw new Error('[operations-status] incomplete fast quote soak was promoted');
if (deriveFastQuoteAvailability({ configured: true, healthy: true, rightsReviewed: true, soakObservedDays: 7 }).availability !== 'AVAILABLE') throw new Error('[operations-status] certified healthy fast quotes were blocked');
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
const futureCycle = deriveDurableFreshness({ data: { meta: { ...durableData.meta, generatedAt: '2026-08-28T01:00:00.001Z' } }, marketSnapshot: durableSnapshot, now: '2026-08-28T01:00:00.000Z' });
if (futureCycle.fresh || futureCycle.reason !== 'market-cycle-generatedAt-in-future') throw new Error('[operations-status] future cycle timestamp was promoted');
const extendedSlaData = { meta: { ...durableData.meta, marketCycleFreshnessSlaHours: 48 } };
const cycleAtSlaBoundary = deriveDurableFreshness({
  data: extendedSlaData,
  marketSnapshot: durableSnapshot,
  now: '2026-08-28T12:00:00.000Z'
});
if (!cycleAtSlaBoundary.fresh || !cycleAtSlaBoundary.withinSla || cycleAtSlaBoundary.maxAgeHours !== 12) {
  throw new Error('[P1291/R641 operations-status] exact 12-hour cycle boundary was not accepted under the canonical SLA');
}
const cycleOneMsPastSla = deriveDurableFreshness({
  data: extendedSlaData,
  marketSnapshot: durableSnapshot,
  now: '2026-08-28T12:00:00.001Z'
});
if (cycleOneMsPastSla.ageHours !== 12 || cycleOneMsPastSla.fresh || cycleOneMsPastSla.withinSla || cycleOneMsPastSla.reason !== 'market-cycle-freshness-sla-exceeded') {
  throw new Error('[P1291/R641 operations-status] artifact SLA override promoted a cycle 1 ms beyond 12 hours');
}
const weekendStaleCycle = deriveDurableFreshness({
  data: { meta: { ...durableData.meta, generatedAt: '2026-08-30T00:00:00.000Z' } },
  marketSnapshot: durableSnapshot,
  now: '2026-08-30T13:00:00.000Z'
});
if (weekendStaleCycle.fresh || weekendStaleCycle.withinSla || weekendStaleCycle.reason !== 'market-cycle-freshness-sla-exceeded') {
  throw new Error('[P1291/R641 operations-status] weekend stale market cycle bypassed the wall-clock freshness SLA');
}
const lkgFixture = {
  ai: { publicChat: { health: { statusCode: 200, observedAt: '2026-08-25T00:00:00.000Z', revision: 'v-test', sourceSha: 'a'.repeat(40), configured: true, quotaConfigured: true, authorityReady: true, authorityJurisdiction: 'us', ready: true } } },
  planes: { fast: { health: { statusCode: 200, observedAt: '2026-08-25T00:00:00.000Z', coverage: '16/16', revision: 'v-test', sourceSha: 'b'.repeat(40) } } }
};
const freshLkg = reuseWorkerHealthEvidence(lkgFixture, '2026-08-25T12:00:00.000Z');
const staleLkg = reuseWorkerHealthEvidence(lkgFixture, '2026-08-27T00:00:00.000Z');
if (freshLkg.observationAttempted !== false || freshLkg.evidenceSource !== 'last-observed-live-health' || !freshLkg.proxyEvidenceFresh || !freshLkg.fastEvidenceFresh) throw new Error('[operations-status] fresh last-observed health is not safely reusable');
if (staleLkg.proxyEvidenceFresh || staleLkg.fastEvidenceFresh) throw new Error('[operations-status] stale last-observed health was promoted to current');
if (status.planes.fast.status !== 'OPERATOR_REQUIRED' && status.planes.fast.status !== 'CURRENT') throw new Error('[operations-status] fast plane status is not explicit');
if (!/^https:\/\/aio-screener-data-plane\.[^/]+\.workers\.dev$/.test(String(status.planes.fast.endpoint || ''))) throw new Error('[operations-status] fast plane endpoint is missing or includes a path suffix');

// v60.46 (static-dynamic audit rec. 8): the published status carries no copy of code state. Its route-ownership block
// mirrored architecture/route-owners.json, so data built on newer code and shipped on older code (a data overlay release)
// failed this gate 43 times on 11/19-20 (nativeLazyOwner) while nothing read the block. Route ownership is checked
// against the code by ci-retirement-contract.mjs.
if (Object.hasOwn(createOperationsStatus({ routes: { supported: 1, nativeLazyOwner: ['home'] } }), 'routes')) throw new Error('[operations-status] v60.46 the published status must not copy route ownership (code state) from route-owners.json');if (status.overall === 'VERIFIED_LIVE') throw new Error('[operations-status] invalid unsupported overall status');
// A retained previous analysis is not a successful call this run.
const scheduledAnalysisOk = data.meta?.marketAnalysisOk === true && !data.meta?.marketAnalysisRetained;
if ((status.ai?.scheduledAnalysis?.status === 'CURRENT') !== scheduledAnalysisOk) throw new Error('[operations-status] scheduledAnalysis status does not match data.meta.marketAnalysisOk');
if ((status.ai?.scheduledAnalysis?.lastCallSucceeded === 'CURRENT') !== scheduledAnalysisOk) throw new Error('[operations-status] scheduledAnalysis lastCallSucceeded does not match data.meta.marketAnalysisOk');
const expectedFredAttempt = data.meta?.fredAttemptedAt || data.meta?.generatedAt || null;
if (status.providers?.fred?.lastAttemptAt !== expectedFredAttempt) throw new Error('[operations-status] FRED lastAttemptAt must use explicit provider attempt evidence');
if (data.meta?.fredFetchOk === true && status.providers?.fred?.lastFetchAt !== (data.meta?.fredLastSuccessfulAt || data.meta?.generatedAt || null)) throw new Error('[operations-status] FRED lastFetchAt must use explicit successful-fetch evidence');

// FRED provider status is an operational claim and must come from
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
// 도메인 receipt 일반화 픽스처 — SEC 외 도메인도 전부 실패·일부 실패·
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
}, 'data'],
// ── section operator-readiness (was ci-operator-readiness-check.mjs) ──
['operator-readiness', async () => {
const { default: fs } = await import('node:fs');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (message) => { throw new Error(`[operator-readiness] ${message}`); };
const operations = read('public-data/operations-status.json');
const reconciliation = read('public-data/reconciliation-status.json');
const readiness = read('architecture/public-readiness.json');
const headers = fs.readFileSync('_headers', 'utf8');

// Durable data may be correctly marked BLOCKED/STALE when the market-cycle
// freshness SLA or reconciliation gate is open. This gate verifies that the
// state is explicit and conservative; it must not require stale data to be
// mislabeled CURRENT merely to let downstream browser gates run.
if (!['CURRENT', 'OPERATOR_REQUIRED', 'BLOCKED', 'STALE'].includes(operations.planes?.durable?.status)) fail('durable plane status is not explicit');
if (operations.planes?.fast?.status !== 'OPERATOR_REQUIRED') fail('fast plane must remain operator-required until endpoint and soak evidence exist');
if (!/^https:\/\/aio-screener-data-plane\.[^/]+\.workers\.dev$/.test(String(operations.planes?.fast?.endpoint || ''))) fail('fast plane endpoint must identify the deployed data-plane base URL without a path suffix');
if (operations.planes.fast.health?.status === 'CURRENT' && operations.planes.fast.health?.statusCode !== 200) fail('fast plane current health evidence must be HTTP 200');
// The blockers close once the owner's rights decision and the quote feature are both in place
// (ci-fast-plane-consumer-gate checks the promoted side); until then they must stay published.
if (operations.featureAvailability?.quotes?.availability !== 'AVAILABLE') {
  if (!operations.blockers?.includes('fast_plane_soak_and_rights_review_required')) fail('missing blocker fast_plane_soak_and_rights_review_required');
}
if (JSON.parse(fs.readFileSync(new URL('../architecture/worker-endpoints.json', import.meta.url), 'utf8')).fastQuotes?.rightsReviewed !== true) {
  if (!operations.blockers?.includes('provider_rights_review_required')) fail('missing blocker provider_rights_review_required');
}
const unresolved = reconciliation.categories.filter((category) => category.status !== 'MATCH').map((category) => category.categoryId).sort();
// v58.63 (architecture audit A24/GV03): the rule is "no completion while categories are unresolved"; it used to refuse
// completion unconditionally, so a fully reconciled state (every category MATCH) could never pass.
if ((reconciliation.overall === 'MATCH' || reconciliation.closure?.complete === true) && unresolved.length) fail('reconciliation cannot report complete while unresolved categories exist');
if (JSON.stringify(unresolved) !== JSON.stringify([...(reconciliation.closure?.unresolvedCategories || [])].sort())) fail('reconciliation closure drift');
const operatorCriteria = readiness.criteria?.filter((criterion) => ['live-revision', 'edge-security-headers', 'thirty-day-slo', 'provider-rights'].includes(criterion.id)) || [];
if (operatorCriteria.length !== 4 || operatorCriteria.some((criterion) => !['OPERATOR_REQUIRED', 'REVIEW_REQUIRED', 'PASS'].includes(criterion.status))) fail('public readiness operator criteria are not explicit');
for (const marker of ['X-Content-Type-Options', 'X-Frame-Options', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (!headers.toLowerCase().includes(marker.toLowerCase())) fail(`_headers missing ${marker}`);
}
if (readiness.publicBetaDecision !== 'BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE') fail('public beta must remain blocked until operator criteria close');
console.log(JSON.stringify({ ok: true, durable: operations.planes.durable.status, fast: operations.planes.fast.status, unresolvedCategories: unresolved.length, publicBetaDecision: readiness.publicBetaDecision }));
}, 'data'],
]);
