import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
