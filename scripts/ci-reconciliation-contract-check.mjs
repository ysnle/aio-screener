import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReconciliationStatus } from '../src/data/contracts/reconciliation.js';
import { buildReconciliationStatus } from './build-reconciliation-status.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const status = JSON.parse(fs.readFileSync(path.join(root, 'public-data/reconciliation-status.json'), 'utf8'));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, 'public-data', name), 'utf8'));
const validation = validateReconciliationStatus(status);
if (!validation.ok) throw new Error(`[reconciliation-contract] ${validation.errors.join(',')}`);
if (status.overall === 'MATCH') throw new Error('[reconciliation-contract] unresolved categories cannot report overall MATCH');
if (status.schemaVersion !== 'reconciliation-status-v2') throw new Error(`[reconciliation-contract] schema must be v2, got ${status.schemaVersion}`);
if (!Array.isArray(status.closure?.sourceArtifacts) || status.closure.sourceArtifacts.length !== 4) throw new Error('[reconciliation-contract] source artifact lineage missing');
for (const category of status.categories) {
  if (!Array.isArray(category.evidence?.checks) || category.evidence.checks.length !== category.evidence.required) {
    throw new Error(`[reconciliation-contract] ${category.categoryId} executable checks missing`);
  }
  const observed = category.evidence.checks.filter((check) => check.status === 'PASS').length;
  if (observed !== category.evidence.observed) throw new Error(`[reconciliation-contract] ${category.categoryId} observed count is not derived from checks`);
}

const statusAgeMs = Date.now() - Date.parse(status.generatedAt);
if (!Number.isFinite(statusAgeMs) || statusAgeMs < -15 * 60 * 1000 || statusAgeMs > 24 * 60 * 60 * 1000) {
  throw new Error(`[reconciliation-contract] artifact timestamp outside 24h operating window: ${status.generatedAt}`);
}
const rebuilt = buildReconciliationStatus({
  data: readJson('data.json'),
  marketSnapshot: readJson('market-snapshot.json'),
  screener: readJson('screener.json'),
  history: readJson('history.json'),
  now: status.generatedAt
});
const truthView = (value) => value.categories.map((category) => ({
  categoryId: category.categoryId,
  status: category.status,
  observed: category.evidence.observed,
  required: category.evidence.required,
  checks: category.evidence.checks.map((check) => [check.id, check.status, check.observedAt])
}));
if (JSON.stringify(truthView(rebuilt)) !== JSON.stringify(truthView(status))) {
  throw new Error('[reconciliation-contract] artifact does not match current source artifacts; rebuild required');
}
if (rebuilt.closure.sourceRevision !== status.closure.sourceRevision) {
  throw new Error('[reconciliation-contract] market snapshot source revision drift');
}

// Negative-path proof: the builder must react to missing runtime data instead
// of returning the historical hard-coded PARTIAL/MATCH table.
const degraded = buildReconciliationStatus({
  data: {},
  marketSnapshot: {},
  screener: {},
  history: [],
  now: '2026-08-13T00:00:00.000Z'
});
for (const categoryId of ['market-quotes', 'volatility', 'fear-greed', 'put-call', 'cpi-pce', 'employment-wages']) {
  const category = degraded.categories.find((row) => row.categoryId === categoryId);
  if (!category || category.status !== 'BLOCKED') throw new Error(`[reconciliation-contract] degraded ${categoryId} must be BLOCKED`);
  if (category.evidence.observed !== 0) throw new Error(`[reconciliation-contract] degraded ${categoryId} observed evidence must be zero`);
}
const policyBlocked = degraded.closure?.policyBlockedCategories || [];
const runtimeBlocked = degraded.closure?.runtimeBlockedCategories || [];
if (!policyBlocked.includes('aaii') || runtimeBlocked.includes('aaii')) throw new Error('[reconciliation-contract] policy/runtime blocked separation failed');
if (!runtimeBlocked.includes('market-quotes')) throw new Error('[reconciliation-contract] runtime outage classification failed');

// Missing samples are not numeric zeroes. Sixty null rows must never satisfy
// a sixty-observation history gate.
const nullHistory = Array.from({ length: 60 }, (_, index) => ({
  date: `2026-06-${String((index % 28) + 1).padStart(2, '0')}`,
  fg: null,
  btc: null
}));
const nullEvidence = buildReconciliationStatus({
  data: { fearGreed: { score: 50, asOf: '2026-08-13T00:00:00.000Z', _source: 'fixture' } },
  marketSnapshot: {},
  screener: {},
  history: nullHistory,
  now: '2026-08-13T00:00:00.000Z'
});
const nullFearGreed = nullEvidence.categories.find((row) => row.categoryId === 'fear-greed');
const nullHistoryCheck = nullFearGreed?.evidence?.checks?.find((check) => check.id === 'history-minimum-60');
if (nullHistoryCheck?.status !== 'FAIL' || nullFearGreed?.status !== 'PARTIAL') {
  throw new Error('[reconciliation-contract] null history samples were incorrectly counted as observations');
}

console.log(JSON.stringify({
  ok: true,
  overall: status.overall,
  categoryCount: status.categories.length,
  counts: status.counts,
  policyBlocked: status.closure.policyBlockedCategories?.length || 0,
  runtimeBlocked: status.closure.runtimeBlockedCategories?.length || 0,
  sourceTruthRebuild: 'PASS',
  negativePath: 'PASS',
  nullIsMissing: 'PASS'
}));
