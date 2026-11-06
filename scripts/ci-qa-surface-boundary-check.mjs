// v59.70 P2 (legacy core wave 2): the classic boot scripts define only the audits a runtime path still calls.
// Audits whose only callers are QA entry points (the audit registry, the page deep-audit table, tests) live in
// js/aio-qa-audits.js, which AIO.loadQaAudits() loads on demand and the Pages artifact leaves out. The allowlist
// below is the set that stayed because a user-facing path calls it (epoch sync, public readiness in dev mode, the
// data-status panel, chat, AIO.diagnose) or because it sits inside an IIFE whose helpers it shares. It only shrinks:
// a new audit in a boot script fails here and belongs in js/aio-qa-audits.js.
import { readFileSync } from 'node:fs';

const BOOT_SCRIPTS = ['js/aio-core.js', 'js/aio-data.js'];
const STAYING = new Set([
  'assertChatAnswerQualityAudit', 'assertChatEvidenceReferences', 'assertChatFunctionCoverage', 'assertChatPanelDomAudit',
  'assertChatResponseAccuracy', 'assertTickerFetchHealth', 'collectCritical10MarketContentInventory', 'getAIRetrievalAudit',
  'getAuditRegistryAudit', 'getCellLevelDataAudit', 'getChatAnswerFreshnessAudit', 'getCrossPageIndicatorConsistencyAudit',
  'getDataFreshnessAudit', 'getDataQualityIssueAudit', 'getDeploymentGateAudit', 'getEvidenceStoreAudit',
  'getHardcodedQuoteFallbackAudit', 'getKrMacroReleaseAudit', 'getLiveSymbolsCoverageAudit', 'getMacroReleaseStaleAudit',
  'getManualReferenceAudit', 'getMarketCurrentnessAudit', 'getMarketStateCoherenceAudit', 'getNarrativeRegimeDriftAudit',
  'getPageContractAudit', 'getPageEvidenceCurrentnessAudit', 'getPageMarketEpochAudit', 'getRuntimeContractAudit',
  'getShareReadinessAudit', 'getSnapshotConsistencyAudit', 'getSnapshotDateSourceAudit', 'getSourceAdapterAudit',
  'getStaticDataGovernanceAudit', 'getStaticSeedFallbackAudit', 'getTextSurfaceAudit', 'getThemeFetchCoverageAudit',
  'getThresholdLabelAudit', 'getTickerRegistryEntryAudit', 'getTradingDecisionLogicAudit', 'getUserResearchPipelineAudit'
]);
const AUDIT_DEFINITION = /^\s*window\.AIO\.([A-Za-z0-9_]*(?:Audit|Inventory)|assert[A-Za-z0-9_]*)\s*=/gm;

const failures = [];
const found = new Set();
for (const file of BOOT_SCRIPTS) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const match of source.matchAll(AUDIT_DEFINITION)) {
    found.add(match[1]);
    if (!STAYING.has(match[1])) failures.push(`${file} defines AIO.${match[1]}; QA-only audits belong in js/aio-qa-audits.js`);
  }
}
const qa = readFileSync(new URL('../js/aio-qa-audits.js', import.meta.url), 'utf8');
for (const name of ['getFullSurfaceAudit', 'getThemeTrendDeepAudit', 'getCritical10HumanSurfaceAudit', 'getElementLineageInventory', 'getTelegramPageCoverageAudit']) {
  if (!new RegExp(`window\\.AIO\\.${name}\\s*=`).test(qa)) failures.push(`js/aio-qa-audits.js lost AIO.${name}`);
}
const stale = [...STAYING].filter((name) => !found.has(name));
if (stale.length) failures.push(`allowlist names no longer in a boot script (remove them so the list keeps shrinking): ${stale.join(', ')}`);
if (failures.length) {
  console.error(`[qa-surface-boundary] FAIL\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`[qa-surface-boundary] PASS ${found.size} runtime audits stay in boot scripts; QA-only audits load with AIO.loadQaAudits()`);
