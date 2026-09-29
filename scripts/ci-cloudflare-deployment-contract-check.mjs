import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const proxyToml = read('worker/wrangler.proxy.toml');
const dataToml = read('worker/wrangler.example.toml');
const workerEndpoints = JSON.parse(read('architecture/worker-endpoints.json'));
const proxyWorkflow = read('.github/workflows/deploy-ai-proxy.yml');
const dataWorkflow = read('.github/workflows/deploy-data-plane.yml');
const ciWorkflow = read('.github/workflows/ci.yml');
const rollbackResolver = read('scripts/resolve-worker-rollback-version.mjs');
const worker = read('cloudflare-worker-proxy.js');
const workerImpact = await import('./worker-deploy-impact.mjs');
const errors = [];
const check = (label, ok) => { if (!ok) errors.push(label); };

for (const [name, toml] of [['proxy', proxyToml], ['data-plane', dataToml]]) {
  check(`${name} enables Workers Logs`, /\[observability\][\s\S]*?enabled\s*=\s*true/.test(toml));
  check(`${name} declares a bounded sampling rate`, /head_sampling_rate\s*=\s*(?:0(?:\.\d+)?|1(?:\.0+)?)/.test(toml));
}
check('proxy health exposes its deployment revision', /AIO_APP_REVISION/.test(proxyToml) && /env\.AIO_APP_REVISION/.test(worker));
check('P1312/R658/QA-OPS-02 private Anthropic usage route and Durable Object query are explicit without changing public health requirements',
  workerEndpoints.proxy?.operatorAiUsagePath === '/_ops/ai-usage'
  && workerEndpoints.security?.operatorObservationRequires?.includes('AIO_OPERATOR_TOKEN')
  && workerEndpoints.security?.proxyQuotaContract?.operations?.join('|') === 'reserve|release|usage'
  && /handleOperatorAiUsage/.test(worker)
  && /AIO_OPERATOR_TOKEN/.test(worker)
  && /operation === 'usage'/.test(worker));
check('both Workers expose an exact deployment source SHA', [proxyToml, dataToml].every((toml) => /AIO_SOURCE_SHA/.test(toml)) && /env\.AIO_SOURCE_SHA/.test(worker) && /sourceSha:\s*env\?\.AIO_SOURCE_SHA/.test(read('worker/data-plane.js')));
for (const [name, workflow, workerKey] of [['proxy', proxyWorkflow, 'aiProxy'], ['data-plane', dataWorkflow, 'dataPlane']]) {
  check(`P1307/R652/QA-DATA-49 ${name} deployment consumes successful main CI and explicit exact-CI dispatch`,
    /workflow_run:[\s\S]*?workflows:\s*\['CI'\]/.test(workflow)
    && /workflow_dispatch:[\s\S]*?ci_run_id/.test(workflow)
    && /actions:\s*read/.test(workflow)
    && /actions\/download-artifact@[0-9a-f]{40}/.test(workflow)
    && /aio-release-attestation\.v1/.test(workflow)
    && /testedSha/.test(workflow)
    && workflow.includes(`workerDeploy?.${workerKey}`));
  check(`${name} deployment has concurrency ownership`, /concurrency:[\s\S]*?cancel-in-progress:\s*false/.test(workflow));
  check(`${name} Wrangler is exact-versioned`, /wrangler@\d+\.\d+\.\d+/.test(workflow));
  check(`${name} deployment runs source contracts first`, /qa-runner\.mjs\s+--group\s+cloudflare\s+--no-cache/.test(workflow));
  check(`${name} deployment verifies live health`, /health/.test(workflow) && /curl/.test(workflow));
  // P1159: this gate used to accept any exact wrangler pin without checking the runtime it needs.
  // A version unification that looked purely cosmetic then failed the fast-plane deploy with
  // "Wrangler requires at least Node.js v22.0.0. You are using v20.20.2" — the old 4.44.0 pin was
  // load-bearing for Node 20, not a stale preference. Read both numbers, not just their shape.
  const wranglerPin = workflow.match(/wrangler@(\d+)\.(\d+)\.(\d+)/);
  const nodeVersion = workflow.match(/node-version:\s*'(\d+)'/);
  check(`P1159 ${name} deploy runs Wrangler on Node >= 22`, !!wranglerPin && !!nodeVersion && Number(nodeVersion[1]) >= 22);
  check(`P1307/R652/QA-DATA-49 ${name} deployment renders and verifies the attested source SHA`, /steps\.release\.outputs\.sha/.test(workflow) && /sourceSha/.test(workflow));
  const baselineAt = workflow.indexOf('Capture active rollback target and source identity');
  const deployAt = workflow.indexOf('      - name: Deploy');
  const smokeAt = workflow.indexOf('id: smoke');
  const rollbackAt = workflow.search(/^        id: rollback\s*$/m);
  const verifyRollbackAt = workflow.indexOf('rollback source identity');
  check(`P1307/R652/QA-DATA-49 ${name} captures a single active rollback version and prior SHA before deploy`,
    baselineAt >= 0 && deployAt > baselineAt && /deployments list --json/.test(workflow)
    && /resolve-worker-rollback-version\.mjs/.test(workflow)
    && /rollback baseline health endpoint/.test(workflow));
  check(`P1307/R652/QA-DATA-49 ${name} rolls back failed smoke to the captured version and verifies prior source`,
    smokeAt > deployAt && rollbackAt > smokeAt && verifyRollbackAt > rollbackAt
    && /failure\(\)[\s\S]*?steps\.deploy\.outcome == 'success'[\s\S]*?steps\.smoke\.outcome == 'failure'/.test(workflow)
    && /wrangler rollback/.test(workflow)
    && /EXPECTED_SHA: \$\{\{ steps\.rollback-baseline\.outputs\.source_sha \}\}/.test(workflow));
}

check('P1307/R652/QA-DATA-49 CI attests per-Worker runtime/config changes on the exact pushed SHA',
  /fetch-depth:\s*0/.test(ciWorkflow)
  && /PUSH_BEFORE_SHA/.test(ciWorkflow)
  && /getWorkerChangesBetween/.test(ciWorkflow)
  && /workerDeploy,/.test(ciWorkflow));

const uploadStep = ciWorkflow.match(/- name: Upload release attestation([\s\S]*?)(?=\n      - name:|\n\n  [a-z]|$)/)?.[1] || '';
check('P1308/R653/QA-DATA-50 hidden release attestation path is explicitly uploaded with narrow inclusion',
  /path:\s*\.release\/aio-release-attestation\.json/.test(uploadStep)
  && /include-hidden-files:\s*true/.test(uploadStep)
  && /if-no-files-found:\s*error/.test(uploadStep));

check('P1308/R653/QA-DATA-50 automatic deployment recovers coalesced or cancelled Worker runs from the live SHA',
  [proxyWorkflow, dataWorkflow].every((workflow) => /fetch-depth:\s*0/.test(workflow)
    && /convergence-health\.json/.test(workflow)
    && /sourceSha/.test(workflow)
    && /branches\/main/.test(workflow)
    && /latestMainSha/.test(workflow)
    && /getWorkerChangesBetween\(liveSha, process\.env\.EXPECTED_SHA\)/.test(workflow)
    && /shouldDeployWorker/.test(workflow)
    && /steps\.convergence\.outputs\.should_deploy/.test(workflow)
    && /Recheck main head immediately before Worker mutation/.test(workflow)
    && /steps\.latest-main\.outputs\.safe/.test(workflow)));

const deploymentInputs = workerImpact.getWorkerDeploymentInputs();
const dataPlaneFixture = workerImpact.classifyWorkerDeployChanges(['src/data/contracts/market-snapshot.js']);
const sourceKindFixture = workerImpact.classifyWorkerDeployChanges(['src/data/contracts/source-kind.js']);
const dataEntryFixture = workerImpact.classifyWorkerDeployChanges(['worker/data-plane.js']);
const proxyFixture = workerImpact.classifyWorkerDeployChanges(['cloudflare-worker-proxy.js']);
const skipCoalescedDeployment = workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: false, liveSha: '1'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), cumulativeChanges: { dataPlane: false, aiProxy: false }, isAncestor: () => true });
const recoverCoalescedDeployment = workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: false, liveSha: '1'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), cumulativeChanges: { dataPlane: true, aiProxy: false }, isAncestor: () => true });
const avoidCrossPlaneDeployment = workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: false, liveSha: '1'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), cumulativeChanges: { dataPlane: false, aiProxy: true }, isAncestor: () => true });
const alreadyConverged = workerImpact.shouldDeployWorker({ plane: 'dataPlane', attestedChanged: true, liveSha: '2'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), cumulativeChanges: { dataPlane: true, aiProxy: false } });
const staleCiRun = workerImpact.shouldDeployWorker({ plane: 'aiProxy', attestedChanged: true, liveSha: '1'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '3'.repeat(40) });
const liveWorkerIsNewer = workerImpact.shouldDeployWorker({ plane: 'aiProxy', attestedChanged: true, liveSha: '3'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), isAncestor: (ancestor, descendant) => ancestor === '2'.repeat(40) && descendant === '3'.repeat(40) });
const divergentLiveWorker = (() => { try { workerImpact.shouldDeployWorker({ plane: 'aiProxy', attestedChanged: true, liveSha: '3'.repeat(40), testedSha: '2'.repeat(40), latestMainSha: '2'.repeat(40), isAncestor: () => false }); return false; } catch { return true; } })();
check('P1308/R653/QA-DATA-50 import graph includes transitive bundled data-plane modules and their config',
  ['worker/data-plane.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/source-kind.js', 'worker/wrangler.example.toml'].every((file) => deploymentInputs.dataPlane.includes(file)));
check('P1308/R653/QA-DATA-50 Worker fixtures classify direct and transitive runtime edits independently',
  dataPlaneFixture.dataPlane && sourceKindFixture.dataPlane && dataEntryFixture.dataPlane
  && !dataPlaneFixture.aiProxy && !sourceKindFixture.aiProxy && proxyFixture.aiProxy && !proxyFixture.dataPlane);
check('P1308/R653/QA-DATA-50 cumulative reconciliation recovers only a still-missing Worker deployment',
  !skipCoalescedDeployment && recoverCoalescedDeployment && !avoidCrossPlaneDeployment && !alreadyConverged);
check('P1308/R653/QA-DATA-50 delayed CI events cannot overwrite a newer main/live Worker SHA or a divergent production identity', !staleCiRun && !liveWorkerIsNewer && divergentLiveWorker);

const activeVersionId = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';
let rejectsSplitRollback = false;
try {
  (await import('./resolve-worker-rollback-version.mjs')).resolveActiveWorkerVersionId({
    deployments: [{ versions: [{ percentage: 50, version_id: activeVersionId }, { percentage: 50, version_id: 'b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2' }] }]
  });
} catch { rejectsSplitRollback = true; }
let resolvesSingleActiveRollback = false;
try {
  resolvesSingleActiveRollback = (await import('./resolve-worker-rollback-version.mjs')).resolveActiveWorkerVersionId({
    deployments: [{ versions: [{ percentage: 100, version_id: activeVersionId }] }]
  }) === activeVersionId;
} catch { /* the contract below reports a fixture failure */ }
check('P1307/R652/QA-DATA-49 rollback resolver accepts a single active version and rejects a split baseline',
  resolvesSingleActiveRollback && rejectsSplitRollback && rollbackResolver.includes('percentage !== 100'));

if (errors.length) {
  console.error('Cloudflare deployment contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log('Cloudflare deployment contract OK: exact-CI auto-deploy, independent Worker identity, captured-version smoke rollback, source gate and health verification.');
