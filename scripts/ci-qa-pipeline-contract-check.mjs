import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { load } from 'js-yaml';

const read = (path) => readFileSync(path, 'utf8');
const manifest = JSON.parse(read('architecture/qa-pipeline.json'));
const ciSource = read('.github/workflows/ci.yml');
const pagesSource = read('.github/workflows/pages-deploy.yml');
const watchdogSource = read('.github/workflows/data-watchdog.yml');
const runnerSource = read('scripts/qa-runner.mjs');
const headlessSource = read('scripts/ci-headless-tests.mjs');
const workflowSyntaxSource = read('scripts/ci-control-char-check.mjs');
const errors = [];
const check = (label, ok) => { if (!ok) errors.push(label); };

for (const path of ['.github/workflows/ci.yml', '.github/workflows/pages-deploy.yml', '.github/workflows/data-watchdog.yml']) {
  try { load(read(path)); } catch (error) { errors.push(`${path} YAML parse: ${error.message}`); }
}

check('manifest schema version', manifest.schemaVersion === 'aio-qa-pipeline.v1');
check('fast profile is preflight-only', JSON.stringify(manifest.profiles?.fast) === JSON.stringify(['preflight']));
check('preflight contains no browser startup', (manifest.groups?.preflight?.gates || []).every((gate) => !/(?:from ['"]playwright['"]|chromium\.launch|start-local-node)/.test(read(gate.script))));
check('full profile contains every browser shard', ['browser-unit', 'browser-runtime', 'browser-knowledge', 'browser-resilience', 'browser-viewport', 'browser-surface'].every((group) => manifest.profiles?.full?.includes(group)));
check('watchdog profile covers local and external state', ['watchdog-local', 'external'].every((group) => manifest.profiles?.watchdog?.includes(group)));

const reachableScriptsForProfile = (profileName, candidateManifest = manifest) => new Set(
  (candidateManifest.profiles?.[profileName] || []).flatMap((groupName) =>
    (candidateManifest.groups?.[groupName]?.gates || []).map((gate) => gate.script)
  )
);

function validateWorkflowContract(contract, source, candidateManifest = manifest) {
  const contractErrors = [];
  const requiredScripts = Array.isArray(contract?.requiredScripts) ? contract.requiredScripts : [];
  if (!contract?.workflow || !['direct', 'profile'].includes(contract?.mode) || requiredScripts.length === 0) {
    contractErrors.push('identity/mode/requiredScripts incomplete');
    return contractErrors;
  }
  for (const script of requiredScripts) {
    if (!existsSync(script)) contractErrors.push(`required script missing: ${script}`);
  }
  if (contract.mode === 'direct') {
    for (const script of requiredScripts) {
      if (!source.includes(script) && !source.includes(basename(script))) contractErrors.push(`direct gate missing: ${script}`);
    }
  } else {
    if (!contract.profile || !candidateManifest.profiles?.[contract.profile]) contractErrors.push(`profile missing: ${contract.profile || 'undefined'}`);
    if (!new RegExp(`qa-runner\\.mjs\\s+${String(contract.profile || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).test(source)) {
      contractErrors.push(`workflow does not invoke profile: ${contract.profile || 'undefined'}`);
    }
    const reachable = reachableScriptsForProfile(contract.profile, candidateManifest);
    for (const script of requiredScripts) if (!reachable.has(script)) contractErrors.push(`profile gate unreachable: ${script}`);
  }
  for (const token of contract.requiredTokens || []) if (!source.includes(token)) contractErrors.push(`required token missing: ${token}`);
  return contractErrors;
}

check('workflow contracts are declared', Array.isArray(manifest.workflowContracts) && manifest.workflowContracts.length >= 3);
for (const contract of manifest.workflowContracts || []) {
  check(`${contract.workflow || 'unknown workflow'} exists`, !!contract.workflow && existsSync(contract.workflow));
  if (!contract.workflow || !existsSync(contract.workflow)) continue;
  const contractErrors = validateWorkflowContract(contract, read(contract.workflow));
  check(`${contract.workflow} gate reachability`, contractErrors.length === 0, contractErrors.join('; '));
}
const directNegativeControl = validateWorkflowContract({
  workflow: '.github/workflows/negative-control.yml',
  mode: 'direct',
  requiredScripts: ['scripts/ci-source-registry-contract-check.mjs']
}, 'name: negative-control');
const profileNegativeControl = validateWorkflowContract({
  workflow: '.github/workflows/negative-control.yml',
  mode: 'profile',
  profile: 'watchdog',
  requiredScripts: ['scripts/__missing-gate-negative-control__.mjs']
}, 'run: node scripts/qa-runner.mjs watchdog --no-cache');
check('workflow contract negative controls reject missing direct/profile gates', directNegativeControl.length > 0 && profileNegativeControl.length > 0);

const ids = [];
for (const [groupName, group] of Object.entries(manifest.groups || {})) {
  check(`${groupName} declares phase`, Number.isInteger(group.phase));
  check(`${groupName} declares inputs`, Array.isArray(group.inputs) && group.inputs.length > 0);
  check(`${groupName} declares gates`, Array.isArray(group.gates) && group.gates.length > 0);
  for (const gate of group.gates || []) {
    ids.push(gate.id);
    check(`${groupName}/${gate.id} script exists`, existsSync(gate.script));
  }
}
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
check(`gate ids are globally unique: ${[...new Set(duplicateIds)].join(', ')}`, duplicateIds.length === 0);

const reachableScripts = new Set(Object.values(manifest.groups || {}).flatMap((group) => (group.gates || []).map((gate) => gate.script)));
const retiredScripts = new Map((manifest.retiredGateScripts || []).map((entry) => [entry.script, entry]));
for (const entry of manifest.retiredGateScripts || []) {
  check(`${entry.script} retired-gate declaration is complete`, existsSync(entry.script) && !!entry.status && !!entry.replacement && !!entry.reason);
  check(`${entry.script} is not both reachable and retired`, !reachableScripts.has(entry.script));
}
const ciScripts = (await import('node:fs')).readdirSync('scripts').filter((name) => /^ci-.*\.mjs$/.test(name)).map((name) => `scripts/${name}`);
const orphanScripts = ciScripts.filter((script) => !reachableScripts.has(script) && !retiredScripts.has(script));
check(`every ci-* script is reachable or explicitly retired: ${orphanScripts.join(', ')}`, orphanScripts.length === 0);

check('CI does not rerun for data workflow completion', !/workflow_run:/.test(ciSource));
check('workflow syntax gate includes untracked newly-created workflows', /readdirSync\(join\(root, '\.github', 'workflows'\)\)/.test(workflowSyntaxSource) && !/git ls-files \.github\/workflows/.test(workflowSyntaxSource));
check('CI does not deploy Pages', !/deploy-pages/.test(ciSource));
check('CI has cheap preflight job', /preflight:[\s\S]*?qa-runner\.mjs --group preflight --no-cache/.test(ciSource));
check('contract matrix waits for preflight', /contracts:[\s\S]*?needs:\s*preflight/.test(ciSource));
check('browser matrix waits for contracts', /browser:[\s\S]*?needs:\s*contracts/.test(ciSource));
check('contract matrix aggregates shard failures', /contracts:[\s\S]*?fail-fast:\s*false/.test(ciSource));
check('browser matrix aggregates shard failures', /browser:[\s\S]*?fail-fast:\s*false/.test(ciSource));

check('Pages waits only for CI attestation', /workflows:\s*\['CI'\]/.test(pagesSource) && !/Refresh market data|Refresh screener and SEC fundamentals/.test(pagesSource));
check('CI accepts exact refresh SHA and emits immutable attestation', /release_sha:/.test(ciSource) && /aio-release-attestation\.v1/.test(ciSource) && /actions\/upload-artifact@[0-9a-f]{40}/.test(ciSource));
check('refresh workflows dispatch exact produced SHA', ['refresh-data.yml', 'refresh-screener.yml'].every((file) => { const source = read(`.github/workflows/${file}`); return /git rev-parse HEAD/.test(source) && /gh workflow run ci\.yml/.test(source) && /release_sha=/.test(source); }));
check('Pages downloads and validates the CI attestation', /actions\/download-artifact@[0-9a-f]{40}/.test(pagesSource) && /aio-release-attestation\.v1/.test(pagesSource) && /steps\.release\.outputs\.sha/.test(pagesSource));
check('Pages has no mutable branch checkout or refresh-deploy bypass', !/ref:\s*\$\{\{[^\r\n]*head_branch/.test(pagesSource) && !/--mode refresh-deploy/.test(pagesSource));
check('Pages has post-deploy external verification', /--mode release/.test(pagesSource));
check('external workflow observations use scoped Actions read token', [pagesSource, watchdogSource].every((source) => /actions:\s*read/.test(source) && /GITHUB_TOKEN:\s*\$\{\{ github\.token \}\}/.test(source)));
check('Pages deployment is serialized without cancellation', /concurrency:[\s\S]*?cancel-in-progress:\s*false/.test(pagesSource));
check('watchdog uses aggregate watchdog profile', /qa-runner\.mjs watchdog --no-cache/.test(watchdogSource));
check('watchdog preserves failure while uploading rolling SLO evidence', /continue-on-error:\s*true/.test(watchdogSource) && /build-operations-slo-window\.mjs/.test(watchdogSource) && /retention-days:\s*90/.test(watchdogSource) && /steps\.qa\.outcome != 'success'/.test(watchdogSource));

check('runner fingerprints inputs', /gateFingerprint/.test(runnerSource) && /createHash/.test(runnerSource));
check('runner supports cached success', /success-cache\.json/.test(runnerSource) && /CACHED/.test(runnerSource));
check('runner supports failed-only reruns', /rerun-failed/.test(runnerSource));
check('runner has phase barriers', /blockedBy/.test(runnerSource) && /const phases/.test(runnerSource));
check('runner aggregates gates with a worker pool', /runPool/.test(runnerSource) && /Promise\.all/.test(runnerSource));
const headlessGates = manifest.groups?.['browser-unit']?.gates || [];
check('headless registry stays ordered until group isolation is proven',
  headlessGates.length === 1
  && headlessGates[0].args?.[0] === '--shard=1/1'
  && headlessGates[0].script === 'scripts/ci-headless-tests.mjs'
  && headlessGates[0].timeoutMs <= 180000);
check('failed headless groups have an independent rerun lifecycle',
  headlessSource.includes('AIO_FAILED_GROUPS=')
  && runnerSource.includes('`--groups=${failedGroups}`')
  && manifest.groups?.core?.gates?.some((gate) => gate.id === 'headless-group-lifecycle'));
check('runner streams long-gate progress and terminates Windows child trees', /\[qa-progress\]/.test(runnerSource) && /taskkill\.exe/.test(runnerSource) && /['"]\/T['"]/.test(runnerSource));

if (errors.length) {
  console.error('QA pipeline contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`QA pipeline contract OK: ${ids.length} gates, phased aggregation, impact cache, isolated Pages and external watchdog.`);
