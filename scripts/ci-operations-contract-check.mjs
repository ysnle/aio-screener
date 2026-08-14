// Wave 5 deterministic operations boundary.
// This checks repository contracts only: workflow pinning/install policy,
// route/state observability, revision coherence, and the declared security
// header/public-readiness posture. It does not certify live headers, provider
// rights, or a 30-day SLO window.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERTICAL_SLICE_CONTRACTS } from '../src/app/vertical-slices.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(`${label}${detail ? `: ${detail}` : ''}`);
};
const sameSet = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && [...left].sort().join('|') === [...right].sort().join('|');

const version = json('version.json').version;
const routeOwners = json('architecture/route-owners.json');
const visual = json('architecture/visual-state-matrix.json');
const slo = json('architecture/operations-slo.json');
const readiness = json('architecture/public-readiness.json');
const operations = json('public-data/operations-status.json');
const publicConfig = json('public-config.json');
const snapshot = json('public-data/market-snapshot.json');
const allowlist = json('public-artifact-manifest.json');
const ci = read('.github/workflows/ci.yml');
const aiProxyWorkflow = read('.github/workflows/deploy-ai-proxy.yml');
const aiProxyWrangler = read('worker/wrangler.proxy.toml');
const worker = read('cloudflare-worker-proxy.js');
const headers = read('_headers');
const workflowDir = join(root, '.github', 'workflows');
const workflowFiles = readdirSync(workflowDir)
  .filter((file) => /\.ya?ml$/i.test(file))
  .map((file) => join(workflowDir, file));
const workflowText = workflowFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const routeIds = Object.keys(routeOwners.routes || {});
const declaredSliceRoutes = VERTICAL_SLICE_CONTRACTS.flatMap((slice) => slice.routes);
const requiredStates = ['loaded', 'reference', 'blocked', 'stale-reference', 'empty'];
const requiredHeaders = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'X-Frame-Options: DENY',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy: default-src \'self\';'
];

check('canonical version format', /^v\d{1,3}(?:\.\d{2})?$/.test(version), version);
for (const file of ['architecture/asset-manifest.json', 'architecture/release-manifest.json', 'architecture/visual-state-matrix.json', 'architecture/operations-slo.json', 'architecture/public-readiness.json', 'public-data/operations-status.json']) {
  check(`${file} appRevision`, json(file).appRevision === version, `${json(file).appRevision} != ${version}`);
}
check('asset manifest worker revision', json('architecture/asset-manifest.json').workerRevision === `sw:${version}`);
check('release manifest worker revision', json('architecture/release-manifest.json').workerRevision === `sw:${version}`);
check('release/asset/operations data revision coherence', [json('architecture/asset-manifest.json').dataRevision, json('architecture/release-manifest.json').dataRevision, operations.dataRevision].every((value) => value === snapshot.revision), `${snapshot.revision}`);

check('vertical slice route coverage', sameSet(declaredSliceRoutes, routeIds), `${declaredSliceRoutes.length} != ${routeIds.length}`);
check('visual matrix route coverage', sameSet(visual.routes, routeIds));
check('visual matrix state coverage', sameSet(visual.states, requiredStates));
check('visual matrix required surface', Array.isArray(visual.requiredSurface) && visual.requiredSurface.length >= 4);
check('visual matrix is blocking', visual.blocking === true);
check('visual matrix live certification is explicit', visual.liveProviderCertification === 'operator-required');

const requiredTargets = {
  artifactSuccessRate30d: 0.995,
  watchdogSuccessRate30d: 0.995,
  consecutiveFailureAlertAt: 2,
  cachedScreenSettleMs: 3000,
  degradedScreenSettleMs: 8000,
  routeWriteAfterLeave: 0,
  browserUncaughtErrors: 0,
  chartInstanceGrowthAfterSoak: 0,
  canvasOverflow: 0,
  crossPageMetricMismatch: 0
};
for (const [key, value] of Object.entries(requiredTargets)) check(`SLO target ${key}`, slo.targets?.[key] === value, `${slo.targets?.[key]} != ${value}`);
check('route soak declaration', ['pending', 'pass'].includes(slo.localBoundary?.routeSoak?.status));
check('route soak topology', slo.localBoundary?.routeSoak?.laps === 3 && slo.localBoundary?.routeSoak?.routes === 20);
check('security header gate is explicit', slo.localBoundary?.securityHeaders?.status === 'edge-required' && slo.localBoundary?.securityHeaders?.manifest === '_headers');
check('public readiness decision is conservative', readiness.publicBetaDecision === 'BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE');
check('public readiness route soak mirror', readiness.criteria?.find((criterion) => criterion.id === 'route-soak')?.status === (slo.localBoundary?.routeSoak?.status === 'pass' ? 'PASS' : 'PENDING_LOCAL_GATE'));
check('public readiness boot-performance mirror', readiness.criteria?.find((criterion) => criterion.id === 'boot-performance')?.status === (slo.latestMeasuredBoot?.status === 'TARGET_COMPLIANT' ? 'PASS' : 'BLOCKED'));
check('latest boot measurement is target-compliant before release', slo.latestMeasuredBoot?.status === 'TARGET_COMPLIANT', `status=${slo.latestMeasuredBoot?.status || 'missing'}`);

for (const header of requiredHeaders) check(`security header ${header}`, headers.includes(header));
check('Pages allowlist includes _headers', allowlist.publicRootAllowlist?.includes('_headers'));
check('Pages staging copies _headers', /cp\s+[^\r\n]*_headers[^\r\n]*pages-dist/.test(ci));
check('CI runs npm ci', /npm ci\s+--no-audit\s+--no-fund/.test(ci));
check('CI does not use mutable npm install', !/\bnpm install\b/.test(ci));
check('route soak is a blocking CI step', ci.includes('node scripts/ci-route-soak-check.mjs'));
check('vertical slice browser gate is wired', ci.includes('node scripts/ci-vertical-slice-browser-check.mjs'));
check('live invariant watchdog is wired', read('.github/workflows/data-watchdog.yml').includes('ci-live-invariant-check.mjs'));

const uses = [...workflowText.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
check('all GitHub Actions refs are SHA pinned', uses.length > 0 && uses.every((ref) => /@[0-9a-f]{40}$/i.test(ref)), uses.join(', '));
check('Wrangler install is exact-versioned', /npm install --global wrangler@\d+\.\d+\.\d+/.test(read('.github/workflows/deploy-data-plane.yml')));
check('AI proxy Wrangler install is exact-versioned', /npm install --global wrangler@\d+\.\d+\.\d+/.test(aiProxyWorkflow));
check('AI proxy deploy owns canonical source and atomic quota binding', aiProxyWrangler.includes('main = "../cloudflare-worker-proxy.js"') && aiProxyWrangler.includes('name = "AIO_QUOTA_DO"') && aiProxyWrangler.includes('class_name = "AIOQuotaDurableObject"'));
check('AI provider outbound is executed by the guaranteed US Durable Object authority', worker.includes("jurisdiction('us')") && worker.includes("getByName('anthropic-authority-v1')") && worker.includes("'X-AIO-Upstream-Authority': 'durable-object-us'") && worker.includes('fetchAnthropicThroughDurableObject') && !worker.includes("locationHint: 'enam'"));
check('AI proxy deploy requires secrets and blocks on executed US readiness/upstream', ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'ANTHROPIC_API_KEY', 'aio-worker-health.v1', 'quotaConfigured', 'authorityReady', 'authorityJurisdiction', 'durable-object-us', 'ai_proxy_origin_gate_failed', 'ai_proxy_upstream_failed'].every((token) => aiProxyWorkflow.includes(token)));
check('operations producer combines periodic deep health with revision-matched provider smoke', ['AIO_OBSERVE_PROXY_HEALTH', 'proxyAuthorityReady', 'proxyAuthorityJurisdiction', 'proxyProviderSmokeStatus', 'proxyProviderSmokeRevision', 'providerSmokeCurrent'].every((token) => read('scripts/build-operations-status.mjs').includes(token)) && read('.github/workflows/refresh-data.yml').includes("AIO_OBSERVE_PROXY_HEALTH: '1'"));
check('public AI route policy is revision-bound and any published route matches operations evidence', publicConfig.appRevision === version
  && (!publicConfig.ai?.workerUrl
    || (operations.ai?.publicChat?.statusCode === 'CONFIGURED_HEALTHY'
      && publicConfig.ai.workerUrl === operations.ai.publicChat.workerEndpoint)));
check('lockfile exists', existsSync(join(root, 'package-lock.json')));

const routeSoakReportPath = join(root, '_artifacts', 'route-soak-report.json');
if (slo.localBoundary?.routeSoak?.status === 'pass') {
  check('route soak report exists', existsSync(routeSoakReportPath));
  if (existsSync(routeSoakReportPath)) {
    const report = JSON.parse(readFileSync(routeSoakReportPath, 'utf8'));
    check('route soak report passed', report.ok === true && Array.isArray(report.errors) && report.errors.length === 0);
    check('route soak report topology', report.routes === 20 && report.laps === 3);
  }
}

const result = {
  ok: errors.length === 0,
  version,
  workflowCount: workflowFiles.length,
  actionCount: uses.length,
  routeCount: routeIds.length,
  stateCount: visual.states?.length || 0,
  routeSoak: slo.localBoundary?.routeSoak?.status,
  errors
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
