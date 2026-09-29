import endpoints from '../architecture/worker-endpoints.json' with { type: 'json' };
import { collectOperationsAlertObservations } from './operations-alert/collect-observations.mjs';

const TRACE = 'P1311/R657/P1312/R658/P1313/R659/QA-OPS-03';
let assertionCount = 0;
function check(label, condition) {
  assertionCount += 1;
  if (!condition) throw new Error(`${TRACE} ${label}`);
}

const BASE = 'https://fixture.example/aio-screener';
const ROOT = `${BASE}/`;
const MARKET_URL = `${BASE}/public-data/market-snapshot.json`;
const DATA_URL = `${BASE}/public-data/data.json`;
const USAGE_URL = new URL(endpoints.proxy.operatorAiUsagePath, endpoints.proxy.baseUrl).href;
const NOW = '2026-11-04T21:00:00.000Z';
const CLOCK = () => new Date(NOW);
const STALE = '2026-11-02T22:00:00.000Z';
const FRESH = '2026-11-03T22:00:00.000Z';
const PRIVATE_TOKEN = 'fixture-operator-token-never-return-this';
const PRIVATE_BODY_MARKER = 'fixture-private-response-body-never-return-this';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function fixtureFetch({
  siteStatus = 200,
  siteThrows = false,
  marketSnapshot = { generatedAt: FRESH },
  marketResponse,
  data = { meta: {} },
  dataResponse,
  usage,
  usageResponse,
  usageStatus = 200,
  onCall
} = {}) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const headers = new Headers(init.headers || {});
    const call = { url, method: init.method, cache: init.cache, redirect: init.redirect, headers };
    calls.push(call);
    onCall?.(call);
    if (url === ROOT) {
      if (siteThrows) throw new Error('fixture network failure');
      return new Response(PRIVATE_BODY_MARKER, { status: siteStatus });
    }
    if (url === MARKET_URL) {
      if (marketResponse instanceof Response) return marketResponse;
      return marketResponse ?? jsonResponse(marketSnapshot);
    }
    if (url === DATA_URL) {
      if (dataResponse instanceof Response) return dataResponse;
      return dataResponse ?? jsonResponse(data);
    }
    if (url === USAGE_URL) {
      if (usageResponse instanceof Response) return usageResponse;
      return usageResponse ?? jsonResponse(usage, usageStatus);
    }
    throw new Error('unregistered fixture URL');
  };
  return { fetchImpl, calls };
}

function outputContainsOnlySummaries(result) {
  const expectedAlerts = ['aiDailyUsage', 'coreArtifactStaleness', 'siteUnavailable'];
  if (!result || Object.keys(result).sort().join('|') !== expectedAlerts.join('|')) return false;
  return expectedAlerts.every((key) => {
    const summary = result[key];
    return summary
      && Object.keys(summary).sort().join('|') === 'reason|status'
      && ['ALERT', 'CLEAR', 'UNKNOWN'].includes(summary.status)
      && typeof summary.reason === 'string';
  });
}

const defaultFixture = fixtureFetch();
const noTokenResult = await collectOperationsAlertObservations({
  fetchImpl: defaultFixture.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 collector fetches site and both deployed artifacts with injected dependencies',
  defaultFixture.calls.map((call) => call.url).sort().join('|') === [ROOT, MARKET_URL, DATA_URL].sort().join('|'));
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 collector without an operator token never requests the private Worker endpoint',
  !defaultFixture.calls.some((call) => call.url === USAGE_URL));
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 collector without an operator token leaves AI usage unknown',
  noTokenResult.aiDailyUsage.status === 'UNKNOWN' && noTokenResult.aiDailyUsage.reason === 'operator-token-missing');
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 collector returns only the three status and safe-reason summaries', outputContainsOnlySummaries(noTokenResult));

const preferredFallback = fixtureFetch({
  marketSnapshot: { generatedAt: STALE, lastSuccessfulAt: FRESH },
  data: { meta: { marketSnapshotLastSuccessfulAt: FRESH, generatedAt: FRESH } }
});
const preferredFallbackResult = await collectOperationsAlertObservations({
  fetchImpl: preferredFallback.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 configured first publication timestamp takes precedence over later fallback candidates',
  preferredFallbackResult.coreArtifactStaleness.status === 'ALERT');

const secondFallback = fixtureFetch({
  marketSnapshot: { generatedAt: '2026-02-30T00:00:00.000Z', lastSuccessfulAt: FRESH },
  data: { meta: { marketSnapshotLastSuccessfulAt: STALE } }
});
const secondFallbackResult = await collectOperationsAlertObservations({
  fetchImpl: secondFallback.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 malformed first timestamp is missing evidence and the next configured fallback is used',
  secondFallbackResult.coreArtifactStaleness.status === 'CLEAR');

const thirdFallback = fixtureFetch({
  marketSnapshot: { attemptedAt: STALE, generatedAt: null },
  data: { meta: { marketSnapshotLastSuccessfulAt: STALE, generatedAt: FRESH, marketSnapshotPublishedAt: FRESH } }
});
const thirdFallbackResult = await collectOperationsAlertObservations({
  fetchImpl: thirdFallback.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 third configured publication timestamp is used after missing earlier sources',
  thirdFallbackResult.coreArtifactStaleness.status === 'ALERT');

const rejectedSources = fixtureFetch({
  marketResponse: new Response(PRIVATE_BODY_MARKER, { status: 503 }),
  dataResponse: new Response('{malformed', { status: 200 })
});
const rejectedSourcesResult = await collectOperationsAlertObservations({
  fetchImpl: rejectedSources.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 failed and malformed artifact sources become missing publication evidence',
  rejectedSourcesResult.coreArtifactStaleness.status === 'UNKNOWN'
  && rejectedSourcesResult.coreArtifactStaleness.reason === 'one-or-more-markets-unknown');

const noOutageStart = fixtureFetch({ siteStatus: 503 });
const noOutageStartResult = await collectOperationsAlertObservations({
  fetchImpl: noOutageStart.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 unavailable site without explicit outage start remains unknown',
  noOutageStartResult.siteUnavailable.status === 'UNKNOWN'
  && noOutageStartResult.siteUnavailable.reason === 'outage-start-missing');

const explicitOutage = fixtureFetch({ siteStatus: 503 });
const explicitOutageResult = await collectOperationsAlertObservations({
  fetchImpl: explicitOutage.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  outageStartedAt: '2026-11-03T20:00:00.000Z'
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 an explicit valid outage start permits the 24-hour site threshold evaluation',
  explicitOutageResult.siteUnavailable.status === 'ALERT');

const unobservedSite = fixtureFetch({ siteThrows: true });
const unobservedSiteResult = await collectOperationsAlertObservations({
  fetchImpl: unobservedSite.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  outageStartedAt: '2026-11-03T20:00:00.000Z'
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 failed site probe remains unknown even when an outage start was supplied',
  unobservedSiteResult.siteUnavailable.status === 'UNKNOWN');

let observedOperatorHeader = false;
const privateUsage = fixtureFetch({
  usage: {
    schemaVersion: 'aio-operator-ai-usage.v1',
    usageDayUtc: '2026-11-04',
    requestCount: 4,
    anthropicDailyCap: 5,
    privateMarker: PRIVATE_BODY_MARKER
  },
  onCall: (call) => {
    if (call.url === USAGE_URL) observedOperatorHeader = call.method === 'GET' && call.headers.get('X-AIO-Operator-Token') === PRIVATE_TOKEN;
  }
});
const privateUsageResult = await collectOperationsAlertObservations({
  fetchImpl: privateUsage.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  operatorToken: PRIVATE_TOKEN
});
const serializedPrivateUsageResult = JSON.stringify(privateUsageResult);
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 the authenticated Worker usage endpoint is fetched with the private header only when supplied',
  observedOperatorHeader && privateUsage.calls.filter((call) => call.url === USAGE_URL).length === 1);
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 private AI usage evaluates successfully without returning metric fields, response body, or token',
  privateUsageResult.aiDailyUsage.status === 'ALERT'
  && !/(requestCount|anthropicDailyCap|usagePercent|fixture-operator-token-never-return-this|fixture-private-response-body-never-return-this)/.test(serializedPrivateUsageResult));
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 collector output stays summary-only with an authenticated usage observation',
  outputContainsOnlySummaries(privateUsageResult));

const malformedUsage = fixtureFetch({ usageResponse: new Response('not-json', { status: 200 }) });
const malformedUsageResult = await collectOperationsAlertObservations({
  fetchImpl: malformedUsage.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  operatorToken: PRIVATE_TOKEN
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 malformed private usage response becomes unknown without exposing its body',
  malformedUsageResult.aiDailyUsage.status === 'UNKNOWN'
  && malformedUsageResult.aiDailyUsage.reason === 'usage-source-unavailable'
  && !JSON.stringify(malformedUsageResult).includes(PRIVATE_TOKEN));

const unavailableUsage = fixtureFetch({
  usage: { schemaVersion: 'aio-operator-ai-usage.v1', requestCount: 5, anthropicDailyCap: 5 },
  usageStatus: 503
});
const unavailableUsageResult = await collectOperationsAlertObservations({
  fetchImpl: unavailableUsage.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  operatorToken: PRIVATE_TOKEN
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 non-success private usage response becomes unknown without parsing or returning it',
  unavailableUsageResult.aiDailyUsage.status === 'UNKNOWN'
  && unavailableUsageResult.aiDailyUsage.reason === 'usage-source-unavailable');

const unsupportedMarket = fixtureFetch();
const unsupportedMarketResult = await collectOperationsAlertObservations({
  fetchImpl: unsupportedMarket.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['US']
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 unsupported market remains unknown instead of inferring an exchange calendar',
  unsupportedMarketResult.coreArtifactStaleness.status === 'UNKNOWN'
  && unsupportedMarketResult.coreArtifactStaleness.reason === 'market-evidence-invalid');

const bothMarkets = fixtureFetch({ marketSnapshot: { generatedAt: '2026-11-02T00:00:00.000Z' } });
const bothMarketsResult = await collectOperationsAlertObservations({
  fetchImpl: bothMarkets.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 default collection evaluates both registered NYSE and KRX markets and reports a safe aggregate',
  bothMarketsResult.coreArtifactStaleness.status === 'ALERT'
  && bothMarketsResult.coreArtifactStaleness.reason === 'one-or-more-markets-two-session-stale');

let rejectedPrivateRedirect = false;
const redirectFixture = fixtureFetch({
  usage: { schemaVersion: 'aio-operator-ai-usage.v1', usageDayUtc: '2026-11-04', requestCount: 4, anthropicDailyCap: 5 },
  onCall: (call) => {
    if (call.url === USAGE_URL) rejectedPrivateRedirect = call.redirect === 'error';
  }
});
await collectOperationsAlertObservations({
  fetchImpl: redirectFixture.fetchImpl,
  clock: CLOCK,
  pagesBaseUrl: BASE,
  markets: ['NYSE'],
  operatorToken: PRIVATE_TOKEN
});
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 private Worker usage fetch rejects redirects so the operator token cannot be forwarded', rejectedPrivateRedirect);

console.log(`[operations-alert-source] PASS — ${assertionCount} traced assertions; injected fetch/clock only; no evidence persisted`);
