import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const policy = JSON.parse(read('architecture/deployment-convergence.json'));
const pages = read('.github/workflows/pages-deploy.yml');
const proxyWorkflow = read('.github/workflows/deploy-ai-proxy.yml');
const fastWorkflow = read('.github/workflows/deploy-data-plane.yml');
const rollbackResolver = read('scripts/resolve-worker-rollback-version.mjs');
const workerImpact = read('scripts/worker-deploy-impact.mjs');
const proxy = read('cloudflare-worker-proxy.js');
const fast = read('worker/data-plane.js');
const external = read('scripts/ci-external-pipeline-check.mjs');
const live = read('scripts/ci-live-invariant-check.mjs');
const operations = read('scripts/build-operations-status.mjs');
const fail = (message) => { throw new Error(`[deployment-convergence] ${message}`); };

if (policy.schemaVersion !== 'deployment-convergence.v1' || policy.evidenceBoundary?.localCannotCertifyLive !== true) fail('policy identity/evidence boundary drifted');
if (!/schemaVersion:'aio-deployment\.v1'/.test(pages) || !/AIO_SOURCE_SHA:\s*\$\{\{ steps\.release\.outputs\.sha \}\}/.test(pages) || !/AIO_EXPECTED_SHA:\s*\$\{\{ steps\.release\.outputs\.sha \}\}/.test(pages)) fail('Pages does not publish and verify the exact attested SHA');
for (const [name, workflow] of [['aiProxy', proxyWorkflow], ['fastDataPlane', fastWorkflow]]) {
  if (!/steps\.release\.outputs\.sha/.test(workflow) || !/sourceSha/.test(workflow)) fail(`${name} workflow does not render and verify its exact CI-attested SHA`);
}
if (!/sourceSha: env && env\.AIO_SOURCE_SHA/.test(proxy) || !/sourceSha: env\?\.AIO_SOURCE_SHA/.test(fast)) fail('Worker health endpoints do not expose deployment source identity');
for (const [name, workflow] of [['aiProxy', proxyWorkflow], ['fastDataPlane', fastWorkflow]]) {
  const plane = policy.planes?.[name];
  if (plane?.releaseCoupling !== 'INDEPENDENT_CI_ATTESTED_AUTO_DEPLOYMENT') fail(`${name} is not contracted for independent CI-attested automatic deployment`);
  if (!plane?.automaticTrigger || !plane?.manualRedeploy?.includes('successful main CI run id') || !plane?.rollback?.includes('failed smoke')) fail(`${name} automatic trigger/manual CI/rollback contract is incomplete`);
  if (!plane?.automaticTrigger?.includes('cumulative changes from the live sourceSha')
    || !plane?.convergenceRule?.includes('coalesced or canceled runs')
    || !plane?.convergenceRule?.includes('current main head')
    || !plane?.convergenceRule?.includes('rechecked immediately before deployment')) fail(`${name} does not contract coalesced recovery and stale-event rejection`);
  if (!/workflow_run:[\s\S]*?workflows:\s*\['CI'\]/.test(workflow) || !/ci_run_id/.test(workflow) || !/aio-release-attestation/.test(workflow)) fail(`${name} does not require exact CI evidence for automatic/manual deployment`);
  if (!/getWorkerChangesBetween\(liveSha, process\.env\.EXPECTED_SHA\)/.test(workflow)
    || !/shouldDeployWorker/.test(workflow)
    || !/convergence-health\.json/.test(workflow)
    || !/branches\/main/.test(workflow)
    || !/Recheck main head immediately before Worker mutation/.test(workflow)) fail(`${name} does not compare live/current-main identity with cumulative exact-SHA changes`);
  if (!/deployments list --json/.test(workflow) || !/wrangler rollback/.test(workflow) || !/rollback source identity/.test(workflow)) fail(`${name} does not retain and verify its prior live rollback target`);
  if (!/steps\.release\.outputs\.sha/.test(workflow) || !/sourceSha/.test(workflow)) fail(`${name} deployment is not pinned to its attested source SHA`);
}
if (!/collectStaticModuleGraph/.test(workerImpact) || !/src\/data\/contracts\/market-snapshot\.js/.test(read('scripts/ci-cloudflare-deployment-contract-check.mjs'))) fail('Worker deploy scope is not derived from its local bundle import graph and regression fixtures');
if (!/percentage !== 100/.test(rollbackResolver) || !/version_id/.test(rollbackResolver)) fail('rollback resolver does not fail closed on non-single-version active deployment');
for (const token of ['pages-deployment-identity', 'pages-exact-expected-sha', 'pages-source-matches-attested-ci', 'proxy-exact-source-identity', 'fast-plane-exact-source-identity']) if (!external.includes(token)) fail(`external convergence evidence missing: ${token}`);
if (!live.includes('live deployment exposes an exact source SHA') || !live.includes('live public AI Worker exposes its exact source SHA')) fail('standing live invariant lacks exact source identity');
if (!operations.includes('proxySourceSha') || !operations.includes('fastSourceSha')) fail('operations status does not preserve independently deployed Worker identities');
console.log(JSON.stringify({ ok: true, status: policy.status, planes: Object.keys(policy.planes), liveCertification: 'OPERATOR_REQUIRED' }));
