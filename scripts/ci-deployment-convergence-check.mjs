import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const policy = JSON.parse(read('architecture/deployment-convergence.json'));
const pages = read('.github/workflows/pages-deploy.yml');
const proxyWorkflow = read('.github/workflows/deploy-ai-proxy.yml');
const fastWorkflow = read('.github/workflows/deploy-data-plane.yml');
const proxy = read('cloudflare-worker-proxy.js');
const fast = read('worker/data-plane.js');
const external = read('scripts/ci-external-pipeline-check.mjs');
const live = read('scripts/ci-live-invariant-check.mjs');
const operations = read('scripts/build-operations-status.mjs');
const fail = (message) => { throw new Error(`[deployment-convergence] ${message}`); };

if (policy.schemaVersion !== 'deployment-convergence.v1' || policy.evidenceBoundary?.localCannotCertifyLive !== true) fail('policy identity/evidence boundary drifted');
if (!/schemaVersion:'aio-deployment\.v1'/.test(pages) || !/AIO_SOURCE_SHA:\s*\$\{\{ steps\.release\.outputs\.sha \}\}/.test(pages) || !/AIO_EXPECTED_SHA:\s*\$\{\{ steps\.release\.outputs\.sha \}\}/.test(pages)) fail('Pages does not publish and verify the exact attested SHA');
for (const [name, workflow] of [['aiProxy', proxyWorkflow], ['fastDataPlane', fastWorkflow]]) {
  if (!/GITHUB_SHA/.test(workflow) || !/sourceSha/.test(workflow)) fail(`${name} workflow does not render and verify its exact checkout SHA`);
}
if (!/sourceSha: env && env\.AIO_SOURCE_SHA/.test(proxy) || !/sourceSha: env\?\.AIO_SOURCE_SHA/.test(fast)) fail('Worker health endpoints do not expose deployment source identity');
for (const token of ['pages-deployment-identity', 'pages-exact-expected-sha', 'pages-source-matches-attested-ci', 'proxy-exact-source-identity', 'fast-plane-exact-source-identity']) if (!external.includes(token)) fail(`external convergence evidence missing: ${token}`);
if (!live.includes('live deployment exposes an exact source SHA') || !live.includes('live public AI Worker exposes its exact source SHA')) fail('standing live invariant lacks exact source identity');
if (!operations.includes('proxySourceSha') || !operations.includes('fastSourceSha')) fail('operations status does not preserve independently deployed Worker identities');
console.log(JSON.stringify({ ok: true, status: policy.status, planes: Object.keys(policy.planes), liveCertification: 'OPERATOR_REQUIRED' }));
