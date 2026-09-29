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
const macroCalendarReviewSource = read('.github/workflows/macro-calendar-review.yml');
const knowledgeCandidateSource = read('.github/workflows/knowledge-build-candidate.yml');
const knowledgeLintWorkflowSource = read('.github/workflows/knowledge-lint.yml');
const exchangeCalendarReviewSource = read('.github/workflows/exchange-calendar-review.yml');
const exchangeCalendarReviewBuilderSource = read('scripts/build-exchange-calendar-review.mjs');
const operationsAlertPolicyConfig = JSON.parse(read('architecture/operations-alert-policy.json'));
const operationsAlertPolicySource = read('scripts/lib/operations-alert-policy.mjs');
const operationsAlertPolicyCheckSource = read('scripts/ci-operations-alert-policy-check.mjs');
const operationsAlertSource = read('scripts/operations-alert/collect-observations.mjs');
const operationsAlertSourceCheck = read('scripts/ci-operations-alert-source-check.mjs');
const operationsStatusSource = read('scripts/build-operations-status.mjs');
const operationsStatusCheckSource = read('scripts/ci-operations-status-check.mjs');
const runnerSource = read('scripts/qa-runner.mjs');
const headlessSource = read('scripts/ci-headless-tests.mjs');
const knowledgeParitySource = read('scripts/ci-knowledge-generated-parity-check.mjs');
const principlesLessonParitySource = read('scripts/ci-principles-lesson-parity-contract-check.mjs');
const macroCalendarReviewContractSource = read('scripts/ci-macro-calendar-review-contract-check.mjs');
const knowledgeCandidateWorkflowContract = (manifest.workflowContracts || []).find((contract) => contract.workflow === '.github/workflows/knowledge-build-candidate.yml');
const knowledgeCandidateParityImpactRule = (manifest.impactRules || []).find((rule) => rule.gates?.includes('knowledge-generated-parity'));
const knowledgeLintWorkflowContract = (manifest.workflowContracts || []).find((contract) => contract.workflow === '.github/workflows/knowledge-lint.yml');
const exchangeCalendarReviewWorkflowContract = (manifest.workflowContracts || []).find((contract) => contract.workflow === '.github/workflows/exchange-calendar-review.yml');
const continuitySource = read('scripts/ci-data-continuity-check.mjs');
const dataRefreshAuditSource = read('scripts/ci-data-refresh-audit.mjs');
const workflowSyntaxSource = read('scripts/ci-control-char-check.mjs');
const convergenceSource = read('scripts/ensure-live-convergence.mjs');
const reportQaFailuresSource = read('scripts/report-qa-failures.mjs');
const errors = [];
const check = (label, ok) => { if (!ok) errors.push(label); };

for (const path of ['.github/workflows/ci.yml', '.github/workflows/pages-deploy.yml', '.github/workflows/data-watchdog.yml', '.github/workflows/macro-calendar-review.yml', '.github/workflows/knowledge-build-candidate.yml', '.github/workflows/knowledge-lint.yml', '.github/workflows/exchange-calendar-review.yml', '.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml']) {
  try { load(read(path)); } catch (error) { errors.push(`${path} YAML parse: ${error.message}`); }
}

check('manifest schema version', manifest.schemaVersion === 'aio-qa-pipeline.v1');
check('fast profile is preflight-only', JSON.stringify(manifest.profiles?.fast) === JSON.stringify(['preflight']));
check('preflight contains no browser startup', (manifest.groups?.preflight?.gates || []).every((gate) => !/(?:from ['"]playwright['"]|chromium\.launch|start-local-node)/.test(read(gate.script))));
check('full profile contains every browser shard', ['browser-unit', 'browser-runtime', 'browser-knowledge', 'browser-resilience', 'browser-viewport', 'browser-surface'].every((group) => manifest.profiles?.full?.includes(group)));
check('watchdog profile covers local and external state', ['watchdog-local', 'external'].every((group) => manifest.profiles?.watchdog?.includes(group)));
const principlesLessonParityGate = (manifest.groups?.knowledge?.gates || []).find((gate) => gate.id === 'principles-lesson-parity');
const macroCalendarReviewGate = (manifest.groups?.data?.gates || []).find((gate) => gate.id === 'macro-calendar-review');
const thirteenFSemanticGate = (manifest.groups?.data?.gates || []).find((gate) => gate.id === '13f-semantic-noop');
const operationsAlertPolicyGate = (manifest.groups?.data?.gates || []).find((gate) => gate.id === 'operations-alert-policy');
const operationsAlertSourceGate = (manifest.groups?.cloudflare?.gates || []).find((gate) => gate.id === 'operations-alert-source');
const thirteenFSemanticSource = read('scripts/ci-13f-semantic-hash-check.mjs');
const macroCalendarReviewWorkflowContract = (manifest.workflowContracts || []).find((contract) => contract.workflow === '.github/workflows/macro-calendar-review.yml');
const macroCalendarReviewImpactRule = (manifest.impactRules || []).find((rule) => rule.gates?.includes('macro-calendar-review'));
const principlesLessonBuilderIndex = knowledgeParitySource.indexOf("['scripts/build-principles-lessons.mjs']");
const sourceLessonEnrichmentIndex = knowledgeParitySource.indexOf("['scripts/enrich-knowledge-source-lessons.mjs']");
// This inventory mirrors the parity builders that directly read lesson-library.json.
const principlesLessonConsumerScripts = [
  'scripts/build-knowledge-evidence-registry.mjs',
  'scripts/enrich-knowledge-source-lessons.mjs',
  'scripts/build-integrated-market-ai-framework-knowledge.mjs',
  'scripts/build-knowledge-articles-and-learning-graph.mjs',
  'scripts/audit-knowledge-encyclopedia-depth.mjs',
  'scripts/build-knowledge-route-targets.mjs',
  'scripts/build-ai-knowledge-retrieval-index.mjs',
  'scripts/build-knowledge-coverage-matrix.mjs'
];
const principlesLessonConsumerIndexes = principlesLessonConsumerScripts.map((script) => knowledgeParitySource.indexOf(`['${script}']`));
const principlesLessonConsumerInputsPresent = principlesLessonConsumerScripts.every((script) => /public-data\/principles\/lesson-library\.json/.test(read(script)));
const nathanKnowledgeBuilderIndex = knowledgeParitySource.indexOf("['scripts/build-nathan-framework-knowledge.mjs']");
const conceptManifestBuilderIndex = knowledgeParitySource.indexOf("['scripts/build-knowledge-concept-manifest.mjs']");
const integratedFrameworkBuilderIndex = knowledgeParitySource.indexOf("['scripts/build-integrated-market-ai-framework-knowledge.mjs']");
const mastersRefreshStep = refreshDataSource.match(/      - name: Refresh weekly SEC 13F and daily 13D-G discovery[\s\S]*?(?=\n      - name: )/)?.[0] || '';
check('P1303/R560/QA-DATA-47 Principles lesson builder is inventoried before enrichment and directly gated',
  principlesLessonBuilderIndex >= 0
    && sourceLessonEnrichmentIndex > principlesLessonBuilderIndex
    && knowledgeParitySource.includes("'public-data/principles/lesson-library.json'")
    && principlesLessonParityGate?.script === 'scripts/ci-principles-lesson-parity-contract-check.mjs'
    && principlesLessonParitySource.includes('isDeepStrictEqual(generatedD6, canonicalD6)'));
check('P1304/R605/QA-DATA-48 macro candidate workflow and report builder have a direct data gate and workflow contract',
  macroCalendarReviewGate?.script === 'scripts/ci-macro-calendar-review-contract-check.mjs'
    && macroCalendarReviewWorkflowContract?.mode === 'direct'
    && macroCalendarReviewWorkflowContract.requiredScripts?.includes('scripts/build-macro-calendar-review.mjs')
    && macroCalendarReviewContractSource.includes('No automatic apply is enabled'));
check('P1310/R655/QA-DATA-52 knowledge candidate workflow is read-only, exact-checkout, review-only and uses the shared builder inventory',
  knowledgeCandidateWorkflowContract?.mode === 'direct'
    && knowledgeCandidateWorkflowContract.requiredScripts?.includes('scripts/ci-knowledge-generated-parity-check.mjs')
    && knowledgeCandidateSource.includes('contents: read')
    && /ref:\s*\$\{\{\s*github\.sha\s*\}\}/.test(knowledgeCandidateSource)
    && knowledgeCandidateSource.includes('persist-credentials: false')
    && knowledgeCandidateSource.includes("node-version: '24'")
    && knowledgeCandidateSource.includes('CANDIDATE_DIR: ${{ runner.temp }}/')
    && knowledgeCandidateSource.includes('--candidate-dir "$CANDIDATE_DIR"')
    && knowledgeCandidateSource.includes("'public-data/masters/index.json'")
    && knowledgeCandidateSource.includes("'src/ui/pages/principles.js'")
    && knowledgeCandidateSource.includes("'src/ui/pages/atlas.js'")
    && knowledgeCandidateSource.includes("'src/ui/knowledge/learning-controls.js'")
    && knowledgeCandidateSource.includes("'src/app/knowledge-route-state.js'")
    && knowledgeCandidateSource.includes("'scripts/lib/atomic-write.mjs'")
    && knowledgeCandidateSource.includes("'scripts/lib/13f-semantic-hash.mjs'")
    && /actions\/checkout@[0-9a-f]{40}/.test(knowledgeCandidateSource)
    && /actions\/setup-node@[0-9a-f]{40}/.test(knowledgeCandidateSource)
    && /actions\/upload-artifact@[0-9a-f]{40}/.test(knowledgeCandidateSource)
    && knowledgeCandidateSource.includes('retention-days: 30')
    && !knowledgeCandidateSource.includes('pull_request_target')
    && !/secrets\.|contents:\s*write|git\s+(?:commit|push)|deploy-pages|wrangler deploy/i.test(knowledgeCandidateSource)
    && knowledgeParitySource.includes('--candidate-dir')
    && knowledgeParitySource.includes('candidateIsInsideWorkspace')
    && knowledgeParitySource.includes('requires a clean checkout')
    && knowledgeParitySource.includes('AIO_SOURCE_SHA must equal the checked-out HEAD SHA')
    && knowledgeParitySource.includes('testedCheckoutSha')
    && knowledgeParitySource.includes('pullRequestHeadSha')
    && knowledgeParitySource.includes('candidateArtifactSha256')
    && knowledgeParitySource.includes('snapshotHashNormalization')
    && knowledgeParitySource.includes('canonicalWorkspaceModified: false'));
check('P1314/R660/QA-DATA-54 isolated knowledge builders reject symlink escapes and helper edits select parity QA',
  knowledgeParitySource.includes('function assertSymlinkFreeTree')
    && knowledgeParitySource.includes('lstatSync')
    && knowledgeParitySource.includes('symlinkGuardFixturePasses')
    && knowledgeParitySource.indexOf('cpSync(root, isolatedRoot') < knowledgeParitySource.indexOf('assertSymlinkFreeTree(isolatedRoot)')
    && knowledgeParitySource.indexOf('assertSymlinkFreeTree(isolatedRoot)') < knowledgeParitySource.lastIndexOf('for (const [script, ...args] of builders)')
    && ['scripts/ci-knowledge-generated-parity-check.mjs', '.github/workflows/knowledge-build-candidate.yml', 'scripts/lib/atomic-write.mjs', 'scripts/lib/13f-semantic-hash.mjs'].every((path) => knowledgeCandidateParityImpactRule?.patterns?.includes(path))
    && knowledgeCandidateParityImpactRule?.groups?.includes('knowledge')
    && knowledgeCandidateParityImpactRule?.gates?.includes('knowledge-generated-parity'));
check('R656/QA-WORKSPACE-13 all six CI meta gates have a weekly strict backstop before any severity downgrade',
  knowledgeLintWorkflowContract?.mode === 'direct'
    && knowledgeLintWorkflowContract.requiredScripts?.length === 6
    && knowledgeLintWorkflowContract.requiredScripts.every((script) => knowledgeLintWorkflowSource.includes(`node ${script}`))
    && knowledgeLintWorkflowSource.includes("cron: '13 4 * * 1'")
    && knowledgeLintWorkflowSource.includes('contents: read')
    && knowledgeLintWorkflowSource.includes('persist-credentials: false'));
check('R605/QA-DATA-53 annual exchange calendar reminder is source-bound, fail-closed and least-privilege',
  exchangeCalendarReviewWorkflowContract?.mode === 'direct'
    && exchangeCalendarReviewWorkflowContract.requiredScripts?.includes('scripts/build-exchange-calendar-review.mjs')
    && exchangeCalendarReviewSource.includes("cron: '0 9 1 11 *'")
    && exchangeCalendarReviewSource.includes('workflow_dispatch:')
    && exchangeCalendarReviewSource.includes('ref: ${{ github.sha }}')
    && exchangeCalendarReviewSource.includes('persist-credentials: false')
    && !exchangeCalendarReviewSource.split('jobs:')[0].includes('issues: write')
    && /report:[\s\S]*?permissions:\s*\n\s+contents: read/.test(exchangeCalendarReviewSource)
    && /issue:[\s\S]*?needs: report[\s\S]*?permissions:\s*\n\s+issues: write/.test(exchangeCalendarReviewSource)
    && exchangeCalendarReviewSource.includes('GH_TOKEN: ${{ github.token }}')
    && exchangeCalendarReviewSource.includes('leaving it closed')
    && /actions\/checkout@[0-9a-f]{40}/.test(exchangeCalendarReviewSource)
    && /actions\/setup-node@[0-9a-f]{40}/.test(exchangeCalendarReviewSource)
    && exchangeCalendarReviewBuilderSource.includes('MARKET_CALENDAR_REGISTRY')
    && exchangeCalendarReviewBuilderSource.includes('unknown and fail-closed')
    && !/writeFileSync|fetch\(/.test(exchangeCalendarReviewBuilderSource));
check('P1311/R657/QA-OPS-01 alert policies use 24h, two completed exchange sessions and 80% of the UTC-day Anthropic request cap without relaxing the 12h freshness SLA',
  operationsAlertPolicyGate?.script === 'scripts/ci-operations-alert-policy-check.mjs'
    && [...(operationsAlertPolicyGate.inputs || [])].sort().join('|') === [
      'architecture/operations-alert-policy.json',
      'scripts/lib/operations-alert-policy.mjs',
      'scripts/ci-operations-alert-policy-check.mjs',
      'src/ai/time/market-session.js',
      'scripts/build-operations-status.mjs',
      'scripts/ci-operations-status-check.mjs'
    ].sort().join('|')
    && operationsAlertPolicyConfig.alerts.siteUnavailable.thresholdMs === 24 * 60 * 60 * 1000
    && operationsAlertPolicyConfig.alerts.siteUnavailable.requiredEvidence.join('|') === 'explicitSiteState|now'
    && operationsAlertPolicyConfig.alerts.siteUnavailable.conditionalEvidence.whenSiteStateIs === 'UNAVAILABLE'
    && operationsAlertPolicyConfig.alerts.siteUnavailable.conditionalEvidence.required.join('|') === 'outageStartedAt'
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.staleCompletedSessionsThreshold === 2
    && operationsAlertPolicyConfig.alerts.aiDailyUsage.thresholdPercent === 80
    && operationsAlertPolicyConfig.alerts.aiDailyUsage.capVariable === 'ANTHROPIC_DAILY_CAP'
    && operationsAlertPolicyConfig.alerts.aiDailyUsage.unit === 'requests'
    && operationsAlertPolicyConfig.alerts.aiDailyUsage.dayTimeZone === 'UTC'
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.doesNotChangeExistingFreshnessGateHours === 12
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.publicationTimestampFallbackOrder.join('|') === 'public-data/market-snapshot.json.generatedAt|public-data/market-snapshot.json.lastSuccessfulAt|public-data/data.json.meta.marketSnapshotLastSuccessfulAt'
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.prohibitedTimestampSources.includes('public-data/data.json.meta.generatedAt')
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.prohibitedTimestampSources.includes('public-data/data.json.meta.marketSnapshotPublishedAt')
    && operationsAlertPolicyConfig.alerts.coreArtifactStaleness.prohibitedTimestampSources.includes('public-data/operations-status.json.generatedAt')
    && ['siteUnavailable', 'coreArtifactStaleness', 'aiDailyUsage'].every((id) => operationsAlertPolicyConfig.alerts[id].unknownWhen.includes('now-missing-or-invalid'))
    && operationsAlertPolicySource.includes('artifactPublishedAt')
    && operationsAlertPolicySource.includes('resolveMarketCalendarSession')
    && operationsAlertPolicySource.includes("'UNKNOWN'")
    && operationsAlertPolicySource.includes('market-calendar-year-unknown')
    && operationsAlertPolicyCheckSource.includes('one completed session is below the two-session threshold')
    && operationsAlertPolicyCheckSource.includes('DST-adjusted close')
    && operationsAlertPolicyCheckSource.includes('registered Thanksgiving holiday')
    && operationsAlertPolicyCheckSource.includes('registered 2026-10-05 holiday')
    && operationsAlertPolicyCheckSource.includes('unregistered 2028 calendar year must remain unknown')
    && operationsAlertPolicyCheckSource.includes('must leave input objects unchanged')
    && operationsAlertPolicyCheckSource.includes('missing actual daily request cap is unknown')
    && /MARKET_CYCLE_FRESHNESS_SLA_MS\s*=\s*12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(operationsStatusSource)
    && operationsStatusCheckSource.includes('exact 12-hour cycle boundary was not accepted'));
check('P1311/R657/P1312/R658/P1313/R659/QA-OPS-03 registers private alert source collection with redirect rejection, both exchanges, and summary-only output',
  operationsAlertSourceGate?.script === 'scripts/ci-operations-alert-source-check.mjs'
    && ['scripts/operations-alert/collect-observations.mjs', 'scripts/ci-operations-alert-source-check.mjs', 'scripts/lib/operations-alert-policy.mjs', 'architecture/operations-alert-policy.json', 'architecture/worker-endpoints.json'].every((path) => (operationsAlertSourceGate.inputs || []).includes(path))
    && operationsAlertSource.includes("redirect: 'error'")
    && operationsAlertSource.includes("markets = ['NYSE', 'KRX']")
    && operationsAlertSource.includes('one-or-more-markets-two-session-stale')
    && operationsAlertSourceCheck.includes('private Worker usage fetch rejects redirects')
    && operationsAlertSourceCheck.includes('default collection evaluates both registered NYSE and KRX markets')
    && operationsAlertSourceCheck.includes('output stays summary-only'));
check('P1306/R651/QA-DATA-47 Principles lesson sources precede every direct generated consumer in one build pass',
  principlesLessonBuilderIndex >= 0
    && principlesLessonConsumerInputsPresent
    && principlesLessonConsumerIndexes.every((index) => index > principlesLessonBuilderIndex)
    && nathanKnowledgeBuilderIndex < integratedFrameworkBuilderIndex
    && conceptManifestBuilderIndex < integratedFrameworkBuilderIndex
    && sourceLessonEnrichmentIndex < integratedFrameworkBuilderIndex);
check('P1309/R654/QA-DATA-51 13D/G remains daily while the complete 13F chain runs in filing season, on an unconnected HR/HR-A filing, or by explicit dispatch',
  /cron:\s*'13 7 \* \* \*'/.test(refreshDataSource)
    && mastersRefreshStep.includes('collect-13f-discovery.mjs --ownership-only')
    && /GITHUB_EVENT_NAME.*schedule/.test(mastersRefreshStep)
    && /pending_13f_hr.*-gt 0/.test(mastersRefreshStep)
    && /in_filing_season.*true/.test(mastersRefreshStep)
    && /date -u \+%u/.test(mastersRefreshStep)
    && /run_full_13f\(\)\s*\{[\s\S]*collect-13f-discovery\.mjs[\s\S]*collect-13f-reference\.mjs[\s\S]*collect-13f-history-rows\.mjs[\s\S]*build-masters-runtime-artifacts\.mjs/.test(mastersRefreshStep)
    && /else[\s\S]*run_full_13f/.test(mastersRefreshStep)
    && mastersRefreshStep.includes('ci-13f-currentness-check.mjs')
    && mastersRefreshStep.includes('ci-masters-contract-check.mjs'));
check('P1309/R654/QA-DATA-51 SEC semantic no-op gate covers volatile clocks, meaningful filing changes, exact raw bytes and all 13F projections',
  thirteenFSemanticGate?.script === 'scripts/ci-13f-semantic-hash-check.mjs'
    && thirteenFSemanticSource.includes('raw-byte-and-semantic-digests-are-independent')
    && thirteenFSemanticSource.includes('semantic-no-op-preserves-existing-bytes')
    && thirteenFSemanticSource.includes('13f-nt-only-does-not-trigger-row-import')
    && thirteenFSemanticSource.includes('13f-filing-window-covers-quarter-end-through-day-45-only')
    && ['accession', 'form', 'amendment', 'rows', 'status', 'coverage', 'last-known-good', 'blocked-state'].every((name) => thirteenFSemanticSource.includes(`['${name}',`))
    && thirteenFSemanticGate.inputs?.includes('scripts/lib/13f-discovery.mjs')
    && ['scripts/build-masters-runtime-artifacts.mjs', 'scripts/reconcile-13f-prior-from-history.mjs'].every((file) => thirteenFSemanticGate.inputs?.includes(file)));
check('P1305/R605/QA-DATA-48 workflow contract requires scoped tokens and exact-title issue fallback',
  macroCalendarReviewWorkflowContract?.requiredTokens?.includes('GH_TOKEN: ${{ github.token }}')
    && macroCalendarReviewWorkflowContract.requiredTokens.includes('in:title')
    && macroCalendarReviewWorkflowContract.requiredTokens.includes('select(.title == $title)'));
check('P1305/R605/QA-DATA-48 data-gate impact rule covers the macro candidate fetcher and preview transformer',
  macroCalendarReviewImpactRule?.patterns?.includes('scripts/fetch-fred-calendar-candidates.mjs')
    && macroCalendarReviewImpactRule.patterns.includes('scripts/preview-macro-calendar.mjs'));
check('knowledge parity tracks domain dossier outputs without depth-audit workspace writes', knowledgeParitySource.includes("'public-data/knowledge/domain-dossiers.json'")
  && knowledgeParitySource.includes("'public-data/knowledge/domain-dossiers'")
  && !/audit-knowledge-encyclopedia-depth\.mjs',\s*'--write'/.test(knowledgeParitySource));
check('data continuity temp writes are isolated from the workspace cache', continuitySource.includes('process.env.AIO_QA_CACHE_DIR ? path.resolve(process.env.AIO_QA_CACHE_DIR) : os.tmpdir()')
  && !continuitySource.includes("path.join(ROOT, '.cache')"));
check('P1290/R640 data refresh audit promotes only fresh published snapshot lineage', dataRefreshAuditSource.includes("json('public-data/market-snapshot-status.json')")
  && dataRefreshAuditSource.includes('snapshotAudit.publishedAt')
  && dataRefreshAuditSource.includes('snapshotAudit.publishedRevision')
  && dataRefreshAuditSource.includes('snapshotPromotionReady')
  && dataRefreshAuditSource.includes("auditState.A1 === 'OK'")
  && dataRefreshAuditSource.includes('MARKET_SNAPSHOT_MAX_AGE_DAYS')
  && dataRefreshAuditSource.includes('failed attempt was promoted over the published LKG artifact'));

const fetchMarketStepAt = refreshDataSource.indexOf('name: Fetch market data');
const snapshotDiagnosticStepAt = refreshDataSource.indexOf('name: Capture redacted market snapshot diagnostics');
const snapshotDiagnosticUploadAt = refreshDataSource.indexOf('name: Upload failed market snapshot diagnostics');
const fetchTelegramStepAt = refreshDataSource.indexOf('name: Fetch Telegram digest');
check('P1289/R639 refresh-data captures and uploads bounded snapshot diagnostics before independent lanes', fetchMarketStepAt >= 0
  && snapshotDiagnosticStepAt > fetchMarketStepAt
  && snapshotDiagnosticUploadAt > snapshotDiagnosticStepAt
  && snapshotDiagnosticUploadAt < fetchTelegramStepAt
  && /AIO_MARKET_FETCH_OUTCOME:\s*\$\{\{\s*steps\.fetch-market\.outcome\s*\}\}/.test(refreshDataSource)
  && /--write-snapshot-diagnostic/.test(refreshDataSource)
  && /steps\.snapshot-diagnostic\.outputs\.capture\s*==\s*'true'/.test(refreshDataSource)
  && /actions\/upload-artifact@[0-9a-f]{40}/.test(refreshDataSource)
  && /retention-days:\s*7/.test(refreshDataSource));

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
    id: 'operations-alert-policy',
    group: 'data',
    inputs: ['architecture/operations-alert-policy.json', 'scripts/lib/operations-alert-policy.mjs', 'scripts/ci-operations-alert-policy-check.mjs', 'src/ai/time/market-session.js', 'scripts/build-operations-status.mjs', 'scripts/ci-operations-status-check.mjs'],
    impactPaths: ['architecture/operations-alert-policy.json', 'scripts/lib/operations-alert-policy.mjs', 'scripts/ci-operations-alert-policy-check.mjs', 'src/ai/time/market-session.js', 'scripts/build-operations-status.mjs', 'scripts/ci-operations-status-check.mjs']
  },
  {
    id: 'operations-alert-source',
    group: 'cloudflare',
    inputs: ['scripts/operations-alert/collect-observations.mjs', 'scripts/ci-operations-alert-source-check.mjs', 'scripts/lib/operations-alert-policy.mjs', 'architecture/operations-alert-policy.json', 'architecture/worker-endpoints.json'],
    impactPaths: ['scripts/operations-alert/collect-observations.mjs', 'scripts/lib/operations-alert-policy.mjs', 'architecture/operations-alert-policy.json', 'architecture/worker-endpoints.json']
  },
  {
    id: 'static-db-expiry',
    group: 'data',
    inputs: ['js/aio-core.js', 'js/aio-data.js', 'js/aio-kr-data.js', 'index.html', 'public-data/screener-universe.json', 'scripts/build-universe-review.mjs'],
    impactPaths: ['scripts/build-universe-review.mjs']
  },
  {
    id: 'data-continuity',
    group: 'core',
    inputs: ['js/aio-data.js', 'public-data/data.json', 'public-data/history.json', 'public-data/market-snapshot.json', 'public-data/reconciliation-status.json', 'public-data/screener.json', 'public-data/structural-data-research.json', 'public-data/telegram-digest.json', 'public-config.json', '.github/workflows/refresh-data.yml', '.github/workflows/refresh-screener.yml', 'scripts/fetch-data.mjs', 'scripts/backtest-trading-score.mjs', 'scripts/build-market-snapshot.mjs', 'scripts/build-operations-status.mjs', 'scripts/build-reconciliation-status.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/build-masters-runtime-artifacts.mjs', 'scripts/lib/refresh-continuity.mjs', 'scripts/lib/atomic-write.mjs', 'src/ai/time/market-session.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/operations.js', 'src/data/contracts/reconciliation.js', 'src/data/contracts/source-registry.js', 'src/domain/signal/trading-score.js'],
    impactPaths: ['js/aio-data.js', 'public-data/data.json', 'public-data/history.json', 'public-data/market-snapshot.json', 'public-data/reconciliation-status.json', 'public-data/screener.json', 'public-data/structural-data-research.json', 'public-data/telegram-digest.json', 'public-config.json', '.github/workflows/refresh-data.yml', '.github/workflows/refresh-screener.yml', 'scripts/fetch-data.mjs', 'scripts/backtest-trading-score.mjs', 'scripts/build-market-snapshot.mjs', 'scripts/build-operations-status.mjs', 'scripts/build-reconciliation-status.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/build-masters-runtime-artifacts.mjs', 'scripts/lib/refresh-continuity.mjs', 'scripts/lib/atomic-write.mjs', 'src/ai/time/market-session.js', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/operations.js', 'src/data/contracts/reconciliation.js', 'src/data/contracts/source-registry.js', 'src/domain/signal/trading-score.js']
  },
  {
    id: '13f-semantic-noop',
    group: 'data',
    inputs: ['public-data/masters/**', 'public-data/objects/masters/**', 'scripts/lib/13f-semantic-hash.mjs', 'scripts/lib/13f-discovery.mjs', 'scripts/ci-13f-semantic-hash-check.mjs', 'scripts/collect-13f-discovery.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/build-masters-runtime-artifacts.mjs', '.github/workflows/refresh-data.yml'],
    impactPaths: ['public-data/masters/index.json', 'public-data/objects/masters/fixture.json', 'scripts/lib/13f-semantic-hash.mjs', 'scripts/lib/13f-discovery.mjs', 'scripts/ci-13f-semantic-hash-check.mjs', 'scripts/collect-13f-discovery.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/build-13f-issuer-aggregates.mjs', 'scripts/build-13f-reference-ticker-index.mjs', 'scripts/reconcile-13f-prior-from-history.mjs', 'scripts/build-masters-runtime-artifacts.mjs', '.github/workflows/refresh-data.yml']
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
    inputs: ['architecture/deployment-convergence.json', '.github/workflows/ci.yml', '.github/workflows/pages-deploy.yml', '.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml', 'cloudflare-worker-proxy.js', 'worker/data-plane.js', 'worker/wrangler.proxy.toml', 'worker/wrangler.example.toml', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/source-kind.js', 'scripts/resolve-worker-rollback-version.mjs', 'scripts/worker-deploy-impact.mjs', 'scripts/ci-external-pipeline-check.mjs', 'scripts/ci-live-invariant-check.mjs', 'scripts/build-operations-status.mjs'],
    impactPaths: ['architecture/deployment-convergence.json', '.github/workflows/ci.yml', '.github/workflows/pages-deploy.yml', '.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml', 'cloudflare-worker-proxy.js', 'worker/data-plane.js', 'worker/wrangler.proxy.toml', 'worker/wrangler.example.toml', 'src/data/contracts/market-snapshot.js', 'src/data/contracts/source-kind.js', 'scripts/resolve-worker-rollback-version.mjs', 'scripts/worker-deploy-impact.mjs', 'scripts/ci-external-pipeline-check.mjs', 'scripts/ci-live-invariant-check.mjs', 'scripts/build-operations-status.mjs']
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
  { id: '13f-semantic-noop', paths: ['scripts/lib/13f-semantic-hash.mjs', 'scripts/lib/13f-discovery.mjs', '.github/workflows/refresh-data.yml'] },
  { id: 'data-refresh', paths: ['index.html'] },
  { id: 'release-revision', paths: ['index.html', 'js/aio-core.js', 'sw.js', 'public-artifact-manifest.json', 'public-config.json', '.github/workflows/pages-deploy.yml'] },
  { id: '13f-currentness', paths: ['index.html', '.github/workflows/refresh-data.yml', 'src/ui/pages/masters.js'] }
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

const workflowJobBlock = (jobName) => {
  const lines = ciSource.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) return '';
  const next = lines.findIndex((line, index) => index > start && /^  [a-z][a-z0-9_-]*:\s*$/.test(line));
  return lines.slice(start, next < 0 ? lines.length : next).join('\n');
};
const workflowStepBlock = (jobSource, stepName) => {
  const lines = jobSource.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  if (start < 0) return '';
  const next = lines.findIndex((line, index) => index > start && /^      - name:/.test(line));
  return lines.slice(start, next < 0 ? lines.length : next).join('\n');
};
const qaFailureUploadSha = 'ea165f8d65b6e75b540449e92b4886f43607fa02';
for (const jobName of ['preflight', 'contracts', 'browser']) {
  const source = workflowJobBlock(jobName);
  const qaRunStepName = jobName === 'preflight' ? 'Run aggregate preflight' : 'Run all gates in shard';
  const qaRunStep = workflowStepBlock(source, qaRunStepName);
  const uploadStep = workflowStepBlock(source, 'Upload redacted QA failure output');
  const artifactName = jobName === 'preflight'
    ? /aio-qa-failure-output-preflight-\$\{\{ github\.run_attempt \}\}/
    : new RegExp(`aio-qa-failure-output-${jobName}-\\$\\{\\{ matrix\\.group \\}\\}-\\$\\{\\{ github\\.run_attempt \\}\\}`);
  check(`P1286 CI ${jobName} job uses the shared runner-temp QA cache`,
    /AIO_QA_CACHE_DIR:\s*\$\{\{\s*runner\.temp\s*\}\}\/aio-qa/.test(qaRunStep)
    && /run:\s*node scripts\/qa-runner\.mjs/.test(qaRunStep));
  check(`P1286 CI ${jobName} uploads only redacted run-scoped QA failures after failure`,
    /^        if: failure\(\)\s*$/m.test(uploadStep)
    && new RegExp(`^        uses: actions/upload-artifact@${qaFailureUploadSha.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+#.*)?\\s*$`, 'm').test(uploadStep)
    && /^          path: \$\{\{\s*runner\.temp\s*\}\}\/aio-qa\/runs\/\*\/failure-output\/\*\.txt\s*$/m.test(uploadStep)
    && /^          if-no-files-found: ignore\s*$/m.test(uploadStep)
    && /^          retention-days: 7\s*$/m.test(uploadStep)
    && artifactName.test(uploadStep)
    && !/failure-output-staging/.test(uploadStep));
}

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
const releaseUploadStep = ciSource.match(/- name: Upload release attestation([\s\S]*?)(?=\n      - name:|\n\n  [a-z]|$)/)?.[1] || '';
check('P1308/R653/QA-DATA-50 release attestation includes its hidden directory in the artifact',
  /path:\s*\.release\/aio-release-attestation\.json/.test(releaseUploadStep)
  && /include-hidden-files:\s*true/.test(releaseUploadStep)
  && /if-no-files-found:\s*error/.test(releaseUploadStep));
const dataPlaneDeploySource = read('.github/workflows/deploy-data-plane.yml');
const aiProxyDeploySource = read('.github/workflows/deploy-ai-proxy.yml');
check('P1307/R652/QA-DATA-49 strict CI attests per-Worker main-push changes for the exact release SHA',
  /fetch-depth:\s*0/.test(ciSource)
  && /AUTO_WORKER_DEPLOY/.test(ciSource)
  && /PUSH_BEFORE_SHA/.test(ciSource)
  && /getWorkerChangesBetween/.test(ciSource)
  && /workerDeploy,/.test(ciSource));
check('P1307/R652/QA-DATA-49 Worker deploys require successful exact-SHA CI and per-plane attestation',
  [dataPlaneDeploySource, aiProxyDeploySource].every((source) => /workflow_run:[\s\S]*?workflows:\s*\['CI'\]/.test(source)
    && /workflow_dispatch:[\s\S]*?ci_run_id/.test(source)
    && /aio-release-attestation\.v1/.test(source)
    && /steps\.release\.outputs\.sha/.test(source))
  && /workerDeploy\?\.dataPlane/.test(dataPlaneDeploySource)
  && /workerDeploy\?\.aiProxy/.test(aiProxyDeploySource));
check('P1308/R653/QA-DATA-50 Worker deployments reconcile cancelled or replaced CI runs against current live source SHA',
  [dataPlaneDeploySource, aiProxyDeploySource].every((source) => /fetch-depth:\s*0/.test(source)
    && /convergence-health\.json/.test(source)
    && /getWorkerChangesBetween\(liveSha, process\.env\.EXPECTED_SHA\)/.test(source)
    && /shouldDeployWorker/.test(source)
    && /steps\.convergence\.outputs\.should_deploy/.test(source)));
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
const mastersRecordAt = refreshDataSource.indexOf('Refresh weekly SEC 13F and daily 13D-G discovery');
const candidateRecordAt = refreshDataSource.indexOf('verify-refresh-candidate.mjs --record');
const dataCommitAt = refreshDataSource.indexOf('Commit refreshed public data if changed');
const exactDispatchAt = refreshDataSource.indexOf('Dispatch exact produced commit to CI');
check('P1309/R654/QA-DATA-51 the split SEC lane remains before candidate hashing, fail-closed commit and exact-SHA CI dispatch',
  mastersRecordAt >= 0 && candidateRecordAt > mastersRecordAt && dataCommitAt > candidateRecordAt && exactDispatchAt > dataCommitAt
    && refreshDataSource.includes('node scripts/verify-refresh-candidate.mjs --expect "$RUNNER_TEMP/aio-refresh-data-candidate.json"')
    && refreshDataSource.includes('final_sha="$(git rev-parse HEAD)"')
    && refreshDataSource.includes('release_sha="$final_sha"'));
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
  const recordAt = source.indexOf('verify-refresh-candidate.mjs --record');
  const expectAt = source.indexOf('verify-refresh-candidate.mjs --expect');
  const stagedAt = source.indexOf('verify-refresh-candidate.mjs --expect-staged');
  const committedAt = source.indexOf('verify-refresh-candidate.mjs --expect-commit');
  const rebaseAt = source.indexOf('git rebase origin/main');
  const lastProducerAt = source.indexOf(name === 'refresh-data.yml' ? 'name: Promote one data release revision' : 'name: Refresh screener independently');
  const producerGateTokens = name === 'refresh-data.yml'
    ? ['ci-refresh-artifact-integrity-check.mjs', 'ci-data-continuity-check.mjs', 'ci-data-refresh-audit.mjs']
    : ['ci-sec-runtime-projection-check.mjs', 'validate-screener-artifact.mjs', 'ci-screener-workbench-contract.mjs'];
  // P1270/P1289: strict producer checks run before recording the exact candidate; the second
  // data-audit invocation only captures bounded diagnostics and cannot replace that producer gate.
  // Promotion re-hashes the candidate after all assembly writes. Repeating heavy checks there only masks drift/cost.
  check(`${name} has a fail-closed producer gate before publish`, prePushAt >= 0
    && producerGateTokens.every((token) => source.slice(0, recordAt).includes(token))
    && producerGateTokens.every((token) => (source.match(new RegExp(token.replaceAll('.', '\\.'), 'g')) || []).length
      === (name === 'refresh-data.yml' && token === 'ci-data-refresh-audit.mjs' ? 2 : 1))
    && (name !== 'refresh-data.yml' || source.includes('--write-snapshot-diagnostic'))
    && lastProducerAt >= 0 && recordAt > lastProducerAt
    && expectAt > recordAt && expectAt > prePushAt
    && stagedAt > expectAt && stagedAt < commitAt
    && committedAt > commitAt && committedAt < pushAt
    && rebaseAt > pushAt && source.indexOf('verify-refresh-candidate.mjs --expect-commit', rebaseAt) > rebaseAt
    && commitAt > expectAt && pushAt > expectAt
    && /git diff --check/.test(source.slice(prePushAt, expectAt))
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
