import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { load } from 'js-yaml';

const read = (path) => readFileSync(path, 'utf8');
const manifest = JSON.parse(read('architecture/qa-pipeline.json'));
const ciSource = read('.github/workflows/ci.yml');
const pagesSource = read('.github/workflows/pages-deploy.yml');
const watchdogSource = read('.github/workflows/data-watchdog.yml');
const refreshDataSource = read('.github/workflows/refresh-data.yml');
const refreshScreenerSource = read('.github/workflows/refresh-screener.yml');
const runnerSource = read('scripts/qa-runner.mjs');
const headlessSource = read('scripts/ci-headless-tests.mjs');
const knowledgeParitySource = read('scripts/ci-knowledge-generated-parity-check.mjs');
const continuitySource = read('scripts/ci-data-continuity-check.mjs');
const dataRefreshAuditSource = read('scripts/ci-data-refresh-audit.mjs');
const workflowSyntaxSource = read('scripts/ci-control-char-check.mjs');
const convergenceSource = read('scripts/ensure-live-convergence.mjs');
const reportQaFailuresSource = read('scripts/report-qa-failures.mjs');
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
check('knowledge parity tracks domain dossier outputs without depth-audit workspace writes', knowledgeParitySource.includes("'public-data/knowledge/domain-dossiers.json'")
  && knowledgeParitySource.includes("'public-data/knowledge/domain-dossiers'")
  && !/audit-knowledge-encyclopedia-depth\.mjs',\s*'--write'/.test(knowledgeParitySource));
check('data continuity temp writes are isolated from the workspace cache', continuitySource.includes('process.env.AIO_QA_CACHE_DIR ? path.resolve(process.env.AIO_QA_CACHE_DIR) : os.tmpdir()')
  && !continuitySource.includes("path.join(ROOT, '.cache')"));
check('data refresh audit uses published snapshot lineage instead of attempted metadata', dataRefreshAuditSource.includes("json('public-data/market-snapshot-status.json')")
  && dataRefreshAuditSource.includes('snapshotAudit.publishedAt')
  && dataRefreshAuditSource.includes('snapshotAudit.publishedRevision')
  && dataRefreshAuditSource.includes('snapshotAudit.currentCyclePublished')
  && dataRefreshAuditSource.includes('failed attempt was promoted over the published LKG artifact'));

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

const gateById = new Map(Object.values(manifest.groups || {}).flatMap((group) => group.gates || []).map((gate) => [gate.id, gate]));
const gateInputContracts = [
  {
    id: 'data-continuity',
    group: 'core',
    inputs: ['js/aio-data.js', 'public-data/data.json', 'public-data/history.json', 'public-data/market-snapshot.json', 'public-data/reconciliation-status.json', 'public-data/screener.json', 'public-data/structural-data-research.json', 'public-data/telegram-digest.json', 'public-config.json', '.github/workflows/refresh-data.yml', '.github/workflows/refresh-screener.yml', 'scripts/fetch-data.mjs', 'scripts/backtest-trading-score.mjs', 'scripts/build-market-snapshot.mjs', 'scripts/build-operations-status.mjs', 'scripts/build-reconciliation-status.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/build-masters-runtime-artifacts.mjs', 'scripts/lib/refresh-continuity.mjs', 'scripts/lib/atomic-write.mjs', 'src/ai/time/market-session.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/operations.js', 'src/data/contracts/reconciliation.js', 'src/data/contracts/source-registry.js', 'src/domain/signal/trading-score.js'],
    impactPaths: ['js/aio-data.js', 'public-data/data.json', 'public-data/history.json', 'public-data/market-snapshot.json', 'public-data/reconciliation-status.json', 'public-data/screener.json', 'public-data/structural-data-research.json', 'public-data/telegram-digest.json', 'public-config.json', '.github/workflows/refresh-data.yml', '.github/workflows/refresh-screener.yml', 'scripts/fetch-data.mjs', 'scripts/backtest-trading-score.mjs', 'scripts/build-market-snapshot.mjs', 'scripts/build-operations-status.mjs', 'scripts/build-reconciliation-status.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/build-masters-runtime-artifacts.mjs', 'scripts/lib/refresh-continuity.mjs', 'scripts/lib/atomic-write.mjs', 'src/ai/time/market-session.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/operations.js', 'src/data/contracts/reconciliation.js', 'src/data/contracts/source-registry.js', 'src/domain/signal/trading-score.js']
  },
  {
    id: 'release-manifest',
    group: 'core',
    inputs: ['architecture/asset-manifest.json', 'version.json', 'architecture/release-manifest.json', 'public-data/market-snapshot.json', 'sw.js'],
    impactPaths: ['architecture/asset-manifest.json', 'version.json', 'architecture/release-manifest.json', 'public-data/market-snapshot.json', 'sw.js']
  },
  {
    id: 'deployment-convergence',
    group: 'core',
    inputs: ['architecture/deployment-convergence.json', '.github/workflows/pages-deploy.yml', '.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml', 'cloudflare-worker-proxy.js', 'worker/data-plane.js', 'scripts/ci-external-pipeline-check.mjs', 'scripts/ci-live-invariant-check.mjs', 'scripts/build-operations-status.mjs'],
    impactPaths: ['architecture/deployment-convergence.json', '.github/workflows/pages-deploy.yml', '.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml', 'cloudflare-worker-proxy.js', 'worker/data-plane.js', 'scripts/ci-external-pipeline-check.mjs', 'scripts/ci-live-invariant-check.mjs', 'scripts/build-operations-status.mjs']
  }
];
const sameSet = (left, right) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
const impactPatternCovers = (pattern, file) => {
  const escaped = (value) => value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = `^${pattern.split('**').map((part) => escaped(part).replaceAll('*', '[^/]*')).join('.*')}$`;
  return new RegExp(regex).test(file);
};
for (const contract of gateInputContracts) {
  const gate = gateById.get(contract.id);
  check(`${contract.id} declares exact cache inputs`, Boolean(gate) && sameSet(gate.inputs || [], contract.inputs));
  check(`${contract.id} inputs have core impact coverage`, contract.impactPaths.every((file) => manifest.impactRules.some((rule) => rule.groups?.includes(contract.group) && (rule.patterns || []).some((pattern) => impactPatternCovers(pattern, file)))));
}

const literalDependencyContracts = [
  { id: 'market-snapshot', paths: ['src/ai/time/market-session.js', 'src/data/market-snapshot-loader.js', 'src/legacy/market-snapshot-bridge.js', '.github/workflows/refresh-data.yml'] },
  { id: 'operator-readiness', paths: ['_headers'] },
  { id: 'data-lineage', paths: ['src/ai/time/market-session.js'] },
  { id: 'data-refresh', paths: ['index.html'] },
  { id: 'release-revision', paths: ['index.html', 'js/aio-core.js', 'sw.js', 'public-artifact-manifest.json', 'public-config.json', '.github/workflows/pages-deploy.yml'] },
  { id: '13f-currentness', paths: ['index.html', '.github/workflows/refresh-data.yml'] }
];
for (const contract of literalDependencyContracts) {
  const gate = gateById.get(contract.id);
  check(`${contract.id} declares literal read dependencies`, Boolean(gate) && contract.paths.every((file) => (gate.inputs || []).includes(file)));
  check(`${contract.id} literal dependencies trigger its data group`, contract.paths.every((file) => manifest.impactRules.some((rule) => rule.groups?.includes('data') && (rule.patterns || []).some((pattern) => impactPatternCovers(pattern, file)))));
}

// ── P1173 (06 O01 / W06-A): 게이트 입력과 impactRules의 일치 ────────────────────────────────────
// canary 목록은 registry에서 파생한다(복제된 문서 목록을 정본으로 삼지 않는다). 선언된 입력 파일을
// 바꿨을 때 그 게이트의 그룹이 선택되지 않으면, 게이트는 그 파일에 의존한다고 선언해 놓고 실제로는
// 실행되지 않는다. preflight는 affected가 항상 앞에 붙이고, external 그룹은 affected가 실행하지
// 않으며, 게이트 자신의 script 변경은 runner가 직접 선택하므로 셋 다 canary에서 제외한다.
const literalCanaries = [];
for (const [groupName, group] of Object.entries(manifest.groups || {})) {
  if (groupName === 'preflight' || groupName === 'external') continue;
  for (const gate of group.gates || []) {
    if (gate.kind === 'external') continue;
    for (const input of gate.inputs || group.inputs || []) {
      if (input.includes('*') || input.includes('{') || input.includes('?')) continue;
      if (input === gate.script) continue;
      literalCanaries.push({ gate: gate.id, group: groupName, input });
    }
  }
}
check('P1173 the canary list is derived from the registry rather than a duplicated document list',
  literalCanaries.length >= 40 && new Set(literalCanaries.map((entry) => entry.input)).size >= 15,
  `${literalCanaries.length} literal inputs across ${new Set(literalCanaries.map((entry) => entry.input)).size} files`);
const unreachableInputs = literalCanaries.filter((entry) => !manifest.impactRules.some((rule) => rule.groups?.includes(entry.group)
  && (rule.patterns || []).some((pattern) => impactPatternCovers(pattern, entry.input))));
check(`P1173 every declared gate input can select the gate that depends on it (${literalCanaries.length} canaries)`, unreachableInputs.length === 0,
  `${unreachableInputs.length} unreachable: ${[...new Set(unreachableInputs.map((entry) => `${entry.input}->${entry.group}`))].slice(0, 12).join(', ')}`);
// The doc's own case, kept as a named canary: a producer of the data plane whose edit selects only browser
// groups means the data gates that declare it never run for that change.
check('P1173 a data producer edit selects the gates that declare it', manifest.impactRules.some((rule) => rule.groups?.includes('data')
  && (rule.patterns || []).some((pattern) => impactPatternCovers(pattern, 'js/aio-kr-data.js'))), 'js/aio-kr-data.js must reach the data group');

const browserPortOwners = new Map();
for (const [groupName, group] of Object.entries(manifest.groups || {})) {
  if (group.kind !== 'browser') continue;
  for (const gate of group.gates || []) {
    const source = read(gate.script);
    const defaultPort = source.match(/process\.env\.[A-Z0-9_]+\s*\|\|\s*(\d+)/)?.[1] || null;
    const ownsLocalServer = gate.script !== 'scripts/ci-headless-tests.mjs' && gate.usesLocalServer !== false;
    if (gate.usesLocalServer === false) check(`${groupName}/${gate.id} is a serverless DOM fixture`, source.includes('.setContent(') && !/start-local-node|createServer\(/.test(source));
    check(`${groupName}/${gate.id} declares an isolated default port`, !ownsLocalServer || defaultPort !== null);
    if (defaultPort) browserPortOwners.set(defaultPort, [...(browserPortOwners.get(defaultPort) || []), gate.id]);
  }
}
const duplicateBrowserPorts = [...browserPortOwners.entries()].filter(([, owners]) => owners.length > 1);
check(`browser gate default ports are unique: ${JSON.stringify(duplicateBrowserPorts)}`, duplicateBrowserPorts.length === 0);

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
// R606: GITHUB_TOKEN-dispatched CI runs emit no workflow_run event, so the
// producer hands the exact run id over explicitly. The hand-over must not become
// a bypass, so the deploy workflow re-asserts the same conditions and keeps
// validating the attestation artifact.
check('Pages explicit hand-over re-asserts attestation conditions',
  /workflow_dispatch:[\s\S]*?ci_run_id/.test(pagesSource)
  && /workflow_dispatch:[\s\S]*?expected_sha/.test(pagesSource)
  && /actions\/runs\/\$run_id/.test(pagesSource)
  && /aio-release-attestation\.v1/.test(pagesSource)
  && /test "\$sha" = "\$WORKFLOW_SHA"/.test(pagesSource));
check('convergence driver cannot bypass attestation or mutate repository state',
  /pages-deploy\.yml/.test(convergenceSource)
  && /aio-release-attestation/.test(convergenceSource)
  && !/deploy-pages@/.test(convergenceSource)
  && !/writeFileSync\([^)]*'\.\//.test(convergenceSource)
  && !/git\s+push/.test(convergenceSource));
check('CI accepts exact refresh SHA and emits immutable attestation', /release_sha:/.test(ciSource) && /aio-release-attestation\.v1/.test(ciSource) && /actions\/upload-artifact@[0-9a-f]{40}/.test(ciSource));
check('refresh workflows dispatch exact produced SHA', ['refresh-data.yml', 'refresh-screener.yml'].every((file) => { const source = read(`.github/workflows/${file}`); return /git rev-parse HEAD/.test(source) && /gh workflow run ci\.yml/.test(source) && /release_sha=/.test(source); }));
const refreshSources = [['refresh-data.yml', refreshDataSource], ['refresh-screener.yml', refreshScreenerSource]];
check('refresh workflows converge the live revision through the attested hand-over',
  refreshSources.every(([, source]) => /ensure-live-convergence\.mjs/.test(source) && /--await-sha/.test(source)));
// P1085: a single unavailable quote plane used to skip the Telegram, 13F and
// release-manifest lanes plus every gate, so one provider outage looked like a
// total pipeline outage. Lanes are isolated now, but publication must stay
// fail-closed — this pins both halves so neither can drift alone.
check('refresh-data isolates producer lanes without loosening the publish boundary',
  /id:\s*fetch-market/.test(refreshDataSource)
  && /id:\s*fetch-telegram/.test(refreshDataSource)
  && /id:\s*masters/.test(refreshDataSource)
  && /steps\.fetch-market\.outcome == 'success'/.test(refreshDataSource)
  && /steps\.fetch-telegram\.outcome == 'success'/.test(refreshDataSource)
  && /steps\.masters\.outcome == 'success' \|\| steps\.masters\.outcome == 'skipped'/.test(refreshDataSource)
  && (refreshDataSource.match(/if: \$\{\{ !cancelled\(\) \}\}/g) || []).length >= 6);
check('refresh-screener owns only screener/SEC validation', !/ci-web-research-contract-check\.mjs/.test(refreshScreenerSource)
  && !/ci-data-refresh-audit\.mjs/.test(refreshScreenerSource)
  && /ci-screener-workbench-contract\.mjs/.test(refreshScreenerSource));
const refreshDataOrder = ['Fetch market data', 'Fetch Telegram digest', 'Promote one data release revision', 'Reject silent artifact degradation', 'Validate source-to-consumer data continuity'];
check('refresh-data runs all producers before rebuild/integrity gates', refreshDataOrder.every((step, index, steps) => {
  const position = refreshDataSource.indexOf(`name: ${step}`);
  return position >= 0 && (index === 0 || position > refreshDataSource.indexOf(`name: ${steps[index - 1]}`));
}));
const refreshScreenerOrder = ['Refresh bounded SEC companyfacts batch', 'Build bounded SEC runtime projection', 'Refresh screener independently', 'Validate semantic artifact contract'];
check('refresh-screener runs SEC producer, projection, screener producer, then validation', refreshScreenerOrder.every((step, index, steps) => {
  const position = refreshScreenerSource.indexOf(`name: ${step}`);
  return position >= 0 && (index === 0 || position > refreshScreenerSource.indexOf(`name: ${steps[index - 1]}`));
}));
for (const [name, source] of refreshSources) {
  const dispatchAt = source.indexOf('gh workflow run ci.yml');
  const commitAt = source.indexOf('git commit -m');
  const pushAt = source.indexOf('until git push');
  const prePushAt = source.indexOf('Fail-closed promotion candidate gate before push');
  const producerGateTokens = name === 'refresh-data.yml'
    ? ['ci-refresh-artifact-integrity-check.mjs', 'ci-data-continuity-check.mjs', 'ci-data-refresh-audit.mjs']
    : ['ci-sec-runtime-projection-check.mjs', 'validate-screener-artifact.mjs', 'ci-screener-workbench-contract.mjs'];
  check(`${name} has a fail-closed producer gate before publish`, prePushAt >= 0
    && producerGateTokens.every((token) => source.slice(prePushAt, commitAt >= 0 ? commitAt : source.length).includes(token))
    && commitAt > prePushAt
    && pushAt > prePushAt
    && !/continue-on-error:\s*true/.test(source.slice(prePushAt, commitAt)));
  // Workspace state is produced by its own producer and must not be coupled
  // to a 30-minute data revision. The exact pushed SHA remains the CI input;
  // Pages still waits for that CI attestation before deployment.
  check(`${name} keeps generated workspace state out of the data promotion commit`, !/generate-workspace-state\.mjs\s+--write/.test(source)
    && !/git add[^\n]*_context\/(?:CURRENT-STATE|CONTEXT-CATALOG)/.test(source));
  const summaryBlock = source.slice(source.indexOf('Pipeline status summary'), dispatchAt >= 0 ? dispatchAt : source.length);
  check(`${name} summary does not mark Generated/Elapsed unconditionally OK`, !/Generated\s*\([^\n]*\)\s*\|\s*OK\s*\|/.test(summaryBlock) && !/\|\s*Elapsed\s*\|\s*OK\s*\|/.test(summaryBlock));
  check(`${name} summary failure is not swallowed as non-fatal`, !/summary generation failed \(non-fatal\)/.test(summaryBlock));
}
check('Pages downloads and validates the CI attestation', /actions\/download-artifact@[0-9a-f]{40}/.test(pagesSource) && /aio-release-attestation\.v1/.test(pagesSource) && /steps\.release\.outputs\.sha/.test(pagesSource));
check('Pages has no mutable branch checkout or refresh-deploy bypass', !/ref:\s*\$\{\{[^\r\n]*head_branch/.test(pagesSource) && !/--mode refresh-deploy/.test(pagesSource));
check('Pages has post-deploy external verification', /--mode release/.test(pagesSource));
check('external workflow observations use scoped Actions read token', [pagesSource, watchdogSource].every((source) => /actions:\s*read/.test(source) && /GITHUB_TOKEN:\s*\$\{\{ github\.token \}\}/.test(source)));
check('Pages deployment is serialized without cancellation', /concurrency:[\s\S]*?cancel-in-progress:\s*false/.test(pagesSource));
check('watchdog uses aggregate watchdog profile', /qa-runner\.mjs watchdog --no-cache/.test(watchdogSource));
check('watchdog preserves failure while uploading rolling SLO evidence', /continue-on-error:\s*true/.test(watchdogSource) && /build-operations-slo-window\.mjs/.test(watchdogSource) && /retention-days:\s*90/.test(watchdogSource) && /steps\.qa\.outcome != 'success'/.test(watchdogSource));
check('watchdog captures failed gate ids and details before final failure', /AIO_QA_CACHE_DIR:\s*\$\{\{ runner\.temp \}\}\/aio-qa/.test(watchdogSource) && /report-qa-failures\.mjs/.test(watchdogSource) && /Summarize failed watchdog gates/.test(watchdogSource) && /Failed gates:/.test(reportQaFailuresSource) && /Failed gate details:/.test(reportQaFailuresSource) && /steps\.qa\.outcome != 'success'/.test(watchdogSource));

// P1083: the summarize step used to inline a JS template literal into `node -e`,
// so bash expanded `${...}` first and every run published an empty summary. Keep
// the shell-expansion-hostile form out of workflows entirely.
check('no workflow inlines a JS template literal through node -e', !/\$\{.*\.map\(/.test(watchdogSource));

// R607: GitHub's default job ceiling is 360 minutes, and refresh-data /
// refresh-screener share a non-cancelling concurrency group — one hung job would
// block every later scheduled cycle behind it and silently freeze live data.
const unboundedJobs = [];
const workflowDir = (await import('node:fs')).readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name));
for (const file of workflowDir) {
  const parsed = load(read(`.github/workflows/${file}`));
  for (const [jobName, job] of Object.entries(parsed?.jobs || {})) {
    if (!Number.isInteger(job?.['timeout-minutes'])) unboundedJobs.push(`${file}:${jobName}`);
  }
}
check(`every workflow job declares timeout-minutes: ${unboundedJobs.join(', ')}`, unboundedJobs.length === 0);

check('viewport matrix executes real route lifecycle by default', /FULL_INIT\s*=\s*process\.env\.AIO_VIEWPORT_FULL_INIT\s*!==\s*['"]0['"]/.test(read('scripts/ci-viewport-matrix-check.mjs')));
// Scheduler/cache behavior is executed by ci-qa-runner-behavior-check.mjs.
check('timing-sensitive browser gates remain exclusive', ['browser-boot', 'browser-sa04', 'artifact-budget'].every((id) => Object.values(manifest.groups).flatMap((group) => group.gates).find((gate) => gate.id === id)?.exclusive === true));
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
check('headless failures keep exact test details in stdout and a local report',
  headlessSource.includes('FAILURE_LEDGER_JSON=')
  && headlessSource.includes('writeQaReport')
  && headlessSource.includes('groupResults'));
check('runner streams long-gate progress and terminates Windows child trees', /\[qa-progress\]/.test(runnerSource) && /taskkill\.exe/.test(runnerSource) && /['"]\/T['"]/.test(runnerSource));

if (errors.length) {
  console.error('QA pipeline contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`QA pipeline contract OK: ${ids.length} gates, phased aggregation, impact cache, isolated Pages and external watchdog.`);
