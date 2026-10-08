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
check('P1312/R658/QA-OPS-02 private AI usage route and Durable Object query are explicit without changing public health requirements',
  workerEndpoints.proxy?.operatorAiUsagePath === '/_ops/ai-usage'
  && workerEndpoints.security?.operatorObservationRequires?.includes('AIO_OPERATOR_TOKEN')
  && workerEndpoints.security?.proxyQuotaContract?.operations?.join('|') === 'reserve|release|usage|start|settle'
  && /operation === 'settle'/.test(worker)
  && /operation === 'start'/.test(worker)
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

{
  // P1341: an identity-less legacy Worker is recorded as a sentinel and rollback verification accepts the
  // sentinel only when the restored Worker again has no sourceSha — it never waives a real SHA comparison.
  const dataPlaneWorkflow = read('.github/workflows/deploy-data-plane.yml');
  check('P1341 data-plane baseline records an identity-less Worker as legacy-unidentified and rejects malformed SHAs',
    /h\.sourceSha==null\?'legacy-unidentified':'invalid'/.test(dataPlaneWorkflow) && /rollback baseline sourceSha is malformed/.test(dataPlaneWorkflow));
  check('P1341 rollback verification accepts the legacy sentinel only for a Worker without sourceSha',
    /e==='legacy-unidentified'\?h\.sourceSha!=null:h\.sourceSha!==e/.test(dataPlaneWorkflow));
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

// P1351: main advancing only by data-refresh commits must not strand the Worker planes. Observed 2026-10-07: the merge
// push's CI run finished after the refresh bot's next commit, the exact-HEAD guard skipped every deploy step, bot CI runs
// are workflow_dispatch (no workflow_run event, R606), so nothing re-drove the proxy and Pages release checks failed on
// the revision drift for nine runs. A newer main is ignorable only when no commit in between touches the plane's inputs.
{
  const sha = (char) => char.repeat(40);
  const base = { attestedChanged: true, liveSha: sha('1'), testedSha: sha('2'), latestMainSha: sha('3'), isAncestor: () => true };
  const untouched = { dataPlane: false, aiProxy: false };
  const deploys = (plane, patch) => workerImpact.shouldDeployWorker({ ...base, plane, ...patch });
  check('P1351 a main advance that leaves the plane untouched still deploys the tested Worker', deploys('aiProxy', { newerMainChanges: untouched }) === true && deploys('dataPlane', { newerMainChanges: untouched }) === true);
  check('P1351 a main advance that changes the same plane stays a stale skip', deploys('aiProxy', { newerMainChanges: { dataPlane: false, aiProxy: true } }) === false && deploys('dataPlane', { newerMainChanges: { dataPlane: true, aiProxy: false } }) === false);
  check('P1351 a main advance that changes only the other plane does not block this plane', deploys('aiProxy', { newerMainChanges: { dataPlane: true, aiProxy: false } }) === true);
  check('P1351 a main advance without change evidence fails closed', deploys('aiProxy', {}) === false && deploys('aiProxy', { newerMainChanges: {} }) === false && deploys('aiProxy', { newerMainChanges: { aiProxy: undefined } }) === false);
  check('P1351 a newer main that is not a descendant of the tested SHA fails closed', deploys('aiProxy', { newerMainChanges: untouched, isAncestor: () => false }) === false);
  check('P1351 a git ancestry failure while judging the advance fails closed instead of crashing the release', deploys('aiProxy', { newerMainChanges: untouched, isAncestor: () => { throw new Error('unknown revision'); } }) === false);
  check('P1351 a manual redeploy follows the same rule and still refuses a Worker-changing main', deploys('aiProxy', { manual: true, newerMainChanges: untouched }) === true && deploys('aiProxy', { manual: true, newerMainChanges: { dataPlane: false, aiProxy: true } }) === false);
  check('P1351 the advance classifier yields nothing for equal, malformed, or unreachable commits',
    workerImpact.getMainAdvanceWorkerChanges(sha('2'), sha('2')) === undefined
    && workerImpact.getMainAdvanceWorkerChanges('bad', sha('3')) === undefined
    && workerImpact.getMainAdvanceWorkerChanges(sha('2'), sha('3'), () => { throw new Error('not an ancestor'); }) === undefined
    && workerImpact.getMainAdvanceWorkerChanges(sha('2'), sha('3'), () => untouched) === untouched);
  for (const [name, workflow, plane] of [['AI proxy', proxyWorkflow, 'aiProxy'], ['fast data plane', dataWorkflow, 'dataPlane']]) {
    const convergence = workflow.slice(workflow.indexOf('id: convergence'), workflow.indexOf('Require Cloudflare operating configuration'));
    const guardStart = workflow.indexOf('Recheck main head immediately before Worker mutation');
    const guard = workflow.slice(guardStart, workflow.indexOf('      - name: Deploy', guardStart));
    check(`P1351 ${name} convergence fetches the newer main and passes its Worker changes to the decision`,
      /git fetch --no-tags --quiet origin "\$CURRENT_MAIN_SHA"/.test(convergence)
      && /getMainAdvanceWorkerChanges\(process\.env\.EXPECTED_SHA, process\.env\.CURRENT_MAIN_SHA\)/.test(convergence)
      && new RegExp(`newerMainChanges\\?\\.${plane} === false`).test(convergence)
      && /cumulativeChanges, newerMainChanges \}/.test(convergence));
    check(`P1351 ${name} pre-mutation guard asks the shared classifier instead of requiring an exact HEAD match`,
      guard.includes(`--main-advance ${plane} "$EXPECTED_SHA" "$current_main_sha"`)
      && /git fetch --no-tags --quiet origin "\$current_main_sha"/.test(guard)
      && !/\[ "\$current_main_sha" = "\$EXPECTED_SHA" \]/.test(guard));
  }
}

const activeVersionId = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';
let rejectsSplitRollback = false;
try {
  (await import('./resolve-worker-rollback-version.mjs')).resolveActiveWorkerVersionId({
    deployments: [{ created_on: '2026-09-30T00:00:00Z', versions: [{ percentage: 50, version_id: activeVersionId }, { percentage: 50, version_id: 'b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2' }] }]
  });
} catch { rejectsSplitRollback = true; }
let resolvesSingleActiveRollback = false;
try {
  resolvesSingleActiveRollback = (await import('./resolve-worker-rollback-version.mjs')).resolveActiveWorkerVersionId({
    deployments: [{ created_on: '2026-09-30T00:00:00Z', versions: [{ percentage: 100, version_id: activeVersionId }] }]
  }) === activeVersionId;
} catch { /* the contract below reports a fixture failure */ }
check('P1307/R652/QA-DATA-49 rollback resolver accepts a single active version and rejects a split baseline',
  resolvesSingleActiveRollback && rejectsSplitRollback && rollbackResolver.includes('percentage !== 100'));

// P1351: ordering and exact-ID provenance fixtures prevent a list/array fallback becoming release authority.
const { resolveActiveWorkerVersionId } = await import('./resolve-worker-rollback-version.mjs');
const record = (created_on, version_id = activeVersionId) => ({ created_on, versions: [{ percentage: 100, version_id }] });
for (const [name, records] of [
  ['missing date', [record(undefined)]], ['invalid date', [record('garbage')]],
  ['ambiguous latest', [record('2026-09-30T00:00:00Z'), record('2026-09-30T00:00:00Z')]],
  ['unordered unknown', [record('2026-09-30T00:00:00Z'), record(undefined)]]
]) {
  let rejected = false;
  try { resolveActiveWorkerVersionId(records); } catch { rejected = true; }
  check(`P1351 rollback rejects ${name}`, rejected);
}
check('P1351 rollback orders valid oldest-first records', resolveActiveWorkerVersionId([
  record('2026-09-29T00:00:00Z', 'b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2'), record('2026-09-30T00:00:00Z')
]) === activeVersionId);
check('P1351 manual redeploy refuses stale main', !workerImpact.shouldDeployWorker({ plane: 'aiProxy', manual: true, testedSha: '2'.repeat(40), latestMainSha: '3'.repeat(40) }));
let missingMainRejected = false;
try { workerImpact.shouldDeployWorker({ plane: 'aiProxy', manual: true, testedSha: '2'.repeat(40) }); } catch { missingMainRejected = true; }
check('P1351 manual redeploy fails closed when main API identity is unavailable', missingMainRejected);

const { isTrustedDeploymentRun, resolveProvenanceRun } = await import('./deployment-provenance.mjs');
const expected = { repository: 'ysnle/aio-screener', name: 'CI', sha: '2'.repeat(40), runId: 123 };
const exact = { id: 123, name: 'CI', head_branch: 'main', head_repository: { full_name: expected.repository }, head_sha: expected.sha, event: 'workflow_dispatch', status: 'completed', conclusion: 'success' };
let exactCalls = 0;
const recovered = await resolveProvenanceRun([{ ...exact, id: 122 }], 123, async () => { exactCalls++; return exact; });
check('P1351 stale bounded list recovers exact run ID', exactCalls === 1 && isTrustedDeploymentRun(recovered, expected));
await resolveProvenanceRun([exact], 123, async () => { throw new Error('unexpected exact lookup'); });
for (const [name, patch] of [['fork', { head_repository: { full_name: 'fork/aio' } }], ['wrong branch', { head_branch: 'feature' }], ['wrong SHA', { head_sha: '3'.repeat(40) }], ['wrong name', { name: 'Untrusted' }], ['failed CI', { conclusion: 'failure' }], ['PR', { event: 'pull_request' }]]) {
  check(`P1351 exact provenance rejects ${name}`, !isTrustedDeploymentRun({ ...exact, ...patch }, expected));
}
let unavailableRejected = false;
try { await resolveProvenanceRun([], 123, async () => { throw new Error('HTTP 403'); }); } catch { unavailableRejected = true; }
check('P1351 unavailable exact provenance never becomes success', unavailableRejected);
let invalidIdRejected = false;
try { await resolveProvenanceRun([], '../other', async () => exact); } catch { invalidIdRejected = true; }
check('P1351 exact provenance rejects malformed run ID before lookup', invalidIdRejected);
const running = { ...exact, name: 'Deploy GitHub Pages', status: 'in_progress', conclusion: null };
const pagesExpected = { ...expected, name: running.name };
check('P1351 only explicit current Pages release may be in progress', !isTrustedDeploymentRun(running, pagesExpected) && isTrustedDeploymentRun(running, { ...pagesExpected, allowInProgress: true }));
check('P1351 in-progress exception never accepts another Pages run', !isTrustedDeploymentRun(running, { ...pagesExpected, runId: 124, allowInProgress: true }));
for (const workflow of [proxyWorkflow, dataWorkflow]) {
  const guard = workflow.slice(workflow.indexOf('Recheck main head immediately before Worker mutation'), workflow.indexOf('      - name: Deploy', workflow.indexOf('Recheck main head immediately before Worker mutation')));
  check('P1351 Worker mutation guard has no manual bypass', guard.includes('branches/main') && !guard.includes("then echo 'safe=true'"));
}
const pagesWorkflow = read('.github/workflows/pages-deploy.yml');
check('P1351 Pages mutation and release verification require latest-main guard', pagesWorkflow.includes('Recheck main head immediately before Pages mutation') && /id: deployment\s+if: steps\.latest-main\.outputs\.safe == 'true'/.test(pagesWorkflow) && /Verify released Pages and all external planes\s+if: steps\.latest-main\.outputs\.safe == 'true'/.test(pagesWorkflow));

// P1334/R674: a fork PR can name its branch 'main'; workflow_run deploys must require a push from this repository.
for (const wf of ['.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml']) {
  const text = readFileSync(wf, 'utf8');
  check(wf + ' deploys only from a push to this repository, never a fork workflow_run (P1334/R674)', text.includes("github.event.workflow_run.event == 'push'") && text.includes('github.event.workflow_run.head_repository.full_name == github.repository') && text.includes(`[ "$ci_event" = 'push' ]`) && text.includes('[ "$ci_repo" = "$GITHUB_REPOSITORY" ]'));
}
if (errors.length) {
  console.error('Cloudflare deployment contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log('Cloudflare deployment contract OK: exact-CI auto-deploy, independent Worker identity, captured-version smoke rollback, source gate and health verification.');
