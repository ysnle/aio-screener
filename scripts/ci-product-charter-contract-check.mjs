#!/usr/bin/env node
// Product charter and the human-validation boundary. v58.86 gate consolidation: the sections below were separate gates until v58.86. They check one subject, so one gate
// runs them in order; every section runs even when an earlier one fails, and the failure names the section.
import { runSections } from './lib/gate-sections.mjs';

await runSections('product-charter', [
// ── section product-charter (was ci-product-charter-contract-check.mjs) ──
['product-charter', async () => {
const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const fail = (message) => { throw new Error(`[product-charter] ${message}`); };
const requireValues = (actual, expected, label) => {
  if (!Array.isArray(actual)) fail(`${label} must be an array`);
  for (const value of expected) if (!actual.includes(value)) fail(`${label} missing ${value}`);
};

const charter = json('architecture/product-charter.json');
const readiness = json('architecture/public-readiness.json');
const qa = json('architecture/qa-pipeline.json');
const document = read(charter.canonicalDocument);

if (charter.schemaVersion !== 'aio-product-charter.v1' || charter.status !== 'ACTIVE') fail('active v1 charter required');
if (charter.productIdentity?.category !== 'self-directed-investment-research-and-decision-support') fail('product identity widened');
if (charter.productIdentity?.executionCapability !== 'NONE') fail('execution capability must remain NONE');
if (charter.productIdentity?.stage !== readiness.currentStage) fail('charter/readiness stage drift');
requireValues(charter.allowedOutcomes, ['observe-market-state', 'screen-and-triage', 'compare-evidence', 'explain-uncertainty-and-limitations'], 'allowedOutcomes');
requireValues(charter.nonGoals, [
  'brokerage-order-routing-or-trade-execution',
  'individualized-buy-sell-sizing-or-timing-instructions-without-suitability-and-current-decision-evidence',
  'licensed-professional-real-time-terminal-parity',
  'claiming-real-time-from-best-effort-public-data',
  'general-purpose-chatbot'
], 'nonGoals');
if (JSON.stringify(charter.evidencePolicy?.allowedUseOrder) !== JSON.stringify(['none', 'reference', 'decision'])) fail('allowed-use order drift');
if (charter.evidencePolicy?.monotonicRestriction !== true) fail('evidence use must only become more restrictive');
if (charter.evidencePolicy?.claimRules?.missingObservation !== 'UNKNOWN_NOT_ZERO') fail('missing observation policy drift');
if (!String(charter.evidencePolicy?.claimRules?.realTime).startsWith('FORBIDDEN_UNLESS')) fail('real-time claim is not fail-closed');
const planeIds = (charter.trustPlanes || []).map((plane) => plane.id);
requireValues(planeIds, ['public-shell', 'durable-current-data', 'fast-market-reference', 'research-corpus', 'personal-vault', 'ai-synthesis', 'operations-evidence'], 'trustPlanes');
if (charter.aiBoundary?.personalizedDirectActionDefault !== 'BLOCKED' || charter.aiBoundary?.autoTrading !== false) fail('AI action boundary widened');
requireValues(charter.architecturePrinciples, [
  'bulk-artifacts-are-projected-before-browser-delivery',
  'personal-state-is-opt-in-minimized-and-encrypted-before-vault-claims',
  'release-evidence-is-bound-to-an-immutable-sha-and-artifact'
], 'architecturePrinciples');
const requiredAuditDomains = [
  'product-intent-and-strategy',
  'system-topology-and-trust-planes',
  'frontend-layers-route-and-runtime-ownership',
  'design-ui-and-ux',
  'data-provenance-freshness-and-rights',
  'ai-privacy-and-security',
  'performance-loading-and-runtime-lifecycle',
  'accessibility',
  'qa-verification-and-test-economics',
  'internal-automation-loop',
  'knowledge-skills-and-workspace',
  'github-ci-pages-delivery',
  'cloudflare-edge-and-provider-plane',
  'release-operations-and-feedback-loop'
];
const auditedDomains = (charter.auditCoverage || []).map((entry) => entry.domain);
requireValues(auditedDomains, requiredAuditDomains, 'auditCoverage');
for (const entry of charter.auditCoverage || []) {
  if (entry.reviewStatus !== 'AUDITED') fail(`audit domain is not reviewed: ${entry.domain}`);
  if (!entry.implementationStatus || !Array.isArray(entry.evidence) || entry.evidence.length === 0) {
    fail(`audit domain lacks implementation status/evidence: ${entry.domain}`);
  }
  for (const rel of entry.evidence.filter((value) => /[/.]/.test(value))) {
    if (!fs.existsSync(path.join(root, rel))) fail(`audit evidence missing (${entry.domain}): ${rel}`);
  }
}
for (const [name, rel] of Object.entries(charter.canonicalContracts || {})) {
  if (!fs.existsSync(path.join(root, rel))) fail(`canonical contract missing (${name}): ${rel}`);
}
for (const marker of ['# AIO 현재 제품·아키텍처 헌장', '## 객관적 판정', '## 유지·재정의·폐기', '## 목표 아키텍처', '## 전수 역설계 범위와 구현 상태', '## 단계별 구조 개편']) {
  if (!document.includes(marker)) fail(`canonical document missing marker: ${marker}`);
}
const reachable = Object.values(qa.groups || {}).flatMap((group) => group.gates || []).some((gate) => gate.script === 'scripts/ci-product-charter-contract-check.mjs');
if (!reachable) fail('product-charter gate is not reachable from QA manifest');

console.log(`Product charter OK: ${charter.productIdentity.category}, ${planeIds.length} trust planes, ${auditedDomains.length} audited domains, execution=${charter.productIdentity.executionCapability}.`);
}],
// ── section human-validation (was ci-human-validation-contract-check.mjs) ──
['human-validation', async () => {
const { readFileSync } = await import('node:fs');

const artifact = JSON.parse(readFileSync(new URL('../architecture/human-validation.json', import.meta.url), 'utf8'));
const fail = (message) => { throw new Error(`[human-validation] ${message}`); };
const study = artifact.minimumStudy || {};
const acceptance = artifact.acceptance || {};
const sessions = artifact.sessions || [];
const requiredDimensions = ['screen-reader-reading-order', 'keyboard-only', 'computed-contrast', '200-percent-zoom-reflow', 'dialog-focus-trap-and-return'];
if (artifact.schemaVersion !== 'human-validation.v1' || study.participantsPerPersona < 5 || study.personas?.length !== 3 || study.tasks?.length < 6 || requiredDimensions.some((dimension) => !study.manualAccessibilityDimensions?.includes(dimension))) fail('study topology is incomplete');
// v57.83 codex audit F23: the study covers phone and tablet as well as desktop, and the household pilot (the real readers)
// is declared without ever certifying anything.
if (!['desktop', 'phone', 'tablet'].every((platform) => study.platforms?.includes(platform))) fail('study must cover desktop, phone and tablet');
const pilot = artifact.householdPilot || {};
if (!Array.isArray(pilot.tasks) || pilot.tasks.length < 4 || !['phone', 'tablet', 'desktop'].every((platform) => pilot.platforms?.includes(platform)) || !/never sets certification/.test(pilot.purpose || '')) fail('household pilot must name its tasks, devices and that it never certifies');
if (acceptance.taskCompletionRateMin < 0.9 || acceptance.criticalMisunderstandingRateMax > 0.05 || acceptance.accessibilityCriticalFailuresMax !== 0) fail('acceptance thresholds are weaker than the product boundary');
for (const session of sessions) {
  for (const field of acceptance.requiredFieldsPerSession || []) if (session[field] == null || session[field] === '') fail(`session ${session.evidenceId || 'unknown'} missing ${field}`);
  if (!study.personas.includes(session.persona) || !study.platforms.includes(session.platform) || !study.tasks.includes(session.taskId)) fail(`session ${session.evidenceId} is outside the declared study topology`);
  if (Number.isNaN(Date.parse(session.observedAt)) || Number.isNaN(Date.parse(session.signedAt))) fail(`session ${session.evidenceId} has invalid timestamps`);
}
const participantsByPersona = Object.fromEntries(study.personas.map((persona) => [persona, new Set(sessions.filter((session) => session.persona === persona).map((session) => session.participantAlias)).size]));
const completeCoverage = study.personas.every((persona) => participantsByPersona[persona] >= study.participantsPerPersona)
  && study.tasks.every((task) => sessions.some((session) => session.taskId === task))
  && study.assistiveTechnology.every((technology) => sessions.some((session) => session.assistiveTechnology === technology));
const taskCompletionRate = sessions.length ? sessions.filter((session) => session.completed === true).length / sessions.length : null;
const misunderstandingRate = sessions.length ? sessions.filter((session) => session.criticalMisunderstanding === true).length / sessions.length : null;
const qualified = completeCoverage && taskCompletionRate >= acceptance.taskCompletionRateMin && misunderstandingRate <= acceptance.criticalMisunderstandingRateMax && artifact.aggregate?.accessibilityCriticalFailures === 0;
if ((artifact.status === 'USER_VALIDATED' || artifact.certification === 'PASS') && !qualified) fail('artifact promoted human validation without complete qualified evidence');
if (!sessions.length && (artifact.status !== 'NOT_EXECUTED' || artifact.certification !== 'OPERATOR_REQUIRED')) fail('empty study must remain operator-required');
console.log(JSON.stringify({ ok: true, contract: artifact.schemaVersion, sessions: sessions.length, participantsByPersona, qualified, certification: artifact.certification }));
}],
]);
