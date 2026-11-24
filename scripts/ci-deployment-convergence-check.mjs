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

// Exact identity checks and current-main guards cover retries and manual redeploys.
if (!pages.includes('Recheck main head immediately before Pages mutation') || !pages.includes('Recheck main head before Pages retry') || !pages.includes("steps.retry-main.outputs.safe == 'true'")) fail('P1351 Pages lacks latest-main mutation/retry guards');
if (!external.includes('resolveProvenanceRun') || !external.includes('verification-unavailable')) fail('P1351 observer lacks exact-run fallback or unavailable-evidence boundary');
for (const workflow of [pages, proxyWorkflow, fastWorkflow]) {
  if (!workflow.includes('EXPECTED_RUN_ID') || !workflow.includes('attestation.repository') && !workflow.includes('a.repository')) fail('P1351 deployment attestation is not bound to its run and repository');
}

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
// v60.19 (Codex audit convergence-proof): a dispatched CI run reports the branch head at dispatch as head_sha, not the
// commit it tested. Pages compared that head with the expectation, so a dispatch whose head had moved could not hand
// over. The rule now lives in one block of the Validate step (attestation validation included); run it as the runner
// would (bash, through deployment-provenance.mjs runAttestedReleaseRule) on the audit's scenes.
{
  const { attestedReleaseRule, ciReleaseTrust, runAttestedReleaseRule } = await import('./deployment-provenance.mjs');
  let rule = null;
  try { rule = attestedReleaseRule(pages); } catch (error) { fail(`v60.19 ${error.message}`); }
  if (!/aio-release-attestation\.v1/.test(rule)) fail('v60.21 the attested-release-rule block does not include the attestation validation it shares with the watchdog');
  if (/\[ "\$ci_sha" = "\$expected_sha" \] \|\|/.test(pages.split('# v60.19 (Codex audit convergence-proof)')[0] || '')) fail('v60.19 the resolve step still compares a dispatched run head with the expectation');
  const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
  const repository = 'ysnle/aio-screener';
  const attestation = (testedSha, runId = '123') => ({ schemaVersion: 'aio-release-attestation.v1', testedSha, runId, repository });
  const scene = ({ sha, ...rest }) => runAttestedReleaseRule({ attestation: attestation(sha), runId: 123, repository, ...rest }, rule);
  const implicit = scene({ sha: A, workflowSha: B, ciEvent: 'workflow_dispatch', ciHeadSha: B });
  const explicitOther = scene({ sha: A, workflowSha: C, explicitSha: C, ciEvent: 'workflow_dispatch', ciHeadSha: B });
  const explicitSame = scene({ sha: A, workflowSha: A, explicitSha: A, ciEvent: 'workflow_dispatch', ciHeadSha: B });
  const pushOther = scene({ sha: A, workflowSha: B, ciEvent: 'push', ciHeadSha: B });
  if (!implicit.ok || implicit.sha !== A) fail(`v60.19 a dispatched CI run whose head moved must deploy its attested SHA: ${implicit.output}`);
  if (explicitOther.ok || !explicitOther.output.includes(A) || !explicitOther.output.includes(C)) fail(`v60.19 a dispatch asking for another SHA must fail naming both: ${explicitOther.output}`);
  if (!explicitSame.ok) fail(`v60.19 a dispatch asking for the attested SHA deploys it: ${explicitSame.output}`);
  if (pushOther.ok) fail('v60.19 a push CI run whose attestation differs from its head must not deploy');
  if (runAttestedReleaseRule({ attestation: attestation(A, '999'), runId: 123, repository, ciEvent: 'push', ciHeadSha: A }, rule).ok) fail('v60.21 an attestation from another CI run must not release');

  // The watchdog's CI trust (pages-source-matches-attested-ci) is the same rule with the deployed SHA as the
  // required SHA. The run's head_sha alone called a correct dispatched release untrusted and an unattested one trusted.
  const ciRun = (event, headSha) => ({ id: 123, name: 'CI', head_branch: 'main', head_repository: { full_name: repository }, head_sha: headSha, event, status: 'completed', conclusion: 'success' });
  const trust = (event, headSha, attestedSha, deployedSha) => ciReleaseTrust({ run: ciRun(event, headSha), runId: 123, repository, attestation: attestedSha ? attestation(attestedSha) : null, unavailable: attestedSha ? '' : 'artifact expired', deployedSha }, rule);
  const scenes = [
    ['push CI, attested head deployed', trust('push', A, A, A), true],
    ['push CI whose attestation differs from its head', trust('push', B, A, A), false],
    ['dispatched CI, head unchanged', trust('workflow_dispatch', A, A, A), true],
    ['dispatched CI, head moved, attested SHA deployed', trust('workflow_dispatch', B, A, A), true],
    ['dispatched CI, head moved, unattested head deployed', trust('workflow_dispatch', B, A, B), false],
    ['dispatched CI, another SHA deployed', trust('workflow_dispatch', A, A, C), false],
    ['missing attestation', trust('workflow_dispatch', A, null, A), false],
    ['failed CI run', ciReleaseTrust({ run: { ...ciRun('push', A), conclusion: 'failure' }, runId: 123, repository, attestation: attestation(A), deployedSha: A }, rule), false]
  ];
  for (const [name, verdict, expected] of scenes) if (verdict.trusted !== expected) fail(`v60.21 watchdog CI trust, ${name}: expected ${expected ? 'trusted' : 'untrusted'}, got ${verdict.reason}`);
  if (!/attestation-unavailable[^\n]*artifact expired/.test(scenes[6][1].reason)) fail(`v60.21 a missing attestation must name why: ${scenes[6][1].reason}`);
}
console.log(JSON.stringify({ ok: true, status: policy.status, planes: Object.keys(policy.planes), liveCertification: 'OPERATOR_REQUIRED' }));
