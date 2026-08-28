import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRITICAL_DATA_GAP_REGISTRY,
  DATA_SOURCE_REGISTRY,
  SOURCE_REGISTRY_CATEGORY_IDS
} from '../src/data/contracts/source-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const reconciliation = JSON.parse(read('public-data/reconciliation-status.json'));
const history = JSON.parse(read('public-data/history.json'));
const fail = (message) => { throw new Error(`[source-registry-contract] ${message}`); };

if (SOURCE_REGISTRY_CATEGORY_IDS.length !== 22) fail(`expected 22 categories, got ${SOURCE_REGISTRY_CATEGORY_IDS.length}`);
if (new Set(SOURCE_REGISTRY_CATEGORY_IDS).size !== SOURCE_REGISTRY_CATEGORY_IDS.length) fail('duplicate category ids');

const registryIds = [...SOURCE_REGISTRY_CATEGORY_IDS].sort();
const reconciliationIds = (reconciliation.categories || []).map((row) => row.categoryId).sort();
if (JSON.stringify(registryIds) !== JSON.stringify(reconciliationIds)) fail('registry and reconciliation category ids drift');
if (reconciliation.closure?.sourceRegistry?.categoryCount !== 22 || reconciliation.closure?.sourceRegistry?.dailyAuditCoverage !== 22) fail('published source registry coverage missing');
if (JSON.stringify(reconciliation.closure?.sourceRegistry?.criticalDataGaps || []) !== JSON.stringify(CRITICAL_DATA_GAP_REGISTRY)) fail('published critical gap ledger drift');

for (const [categoryId, contract] of Object.entries(DATA_SOURCE_REGISTRY)) {
  if (contract.dailyRefreshAudit !== true) fail(`${categoryId} is not enrolled in the daily audit`);
  if (!contract.cadence || !contract.refreshMode || !contract.producer) fail(`${categoryId} refresh ownership is incomplete`);
  if (!Array.isArray(contract.artifacts) || contract.artifacts.length === 0) fail(`${categoryId} artifacts missing`);
  if (!Array.isArray(contract.consumers) || contract.consumers.length === 0) fail(`${categoryId} consumers missing`);
  if (!Array.isArray(contract.origins) || contract.origins.length === 0) fail(`${categoryId} origins missing`);
  if (contract.allowedUseCeiling && !['decision', 'reference', 'none'].includes(contract.allowedUseCeiling)) fail(`${categoryId} allowed-use ceiling is invalid`);
  for (const origin of contract.origins) {
    for (const field of ['id', 'authority', 'sourceKind', 'access', 'url']) {
      if (!origin[field]) fail(`${categoryId}/${origin.id || 'unknown'} ${field} missing`);
    }
    if (!/^https:\/\//.test(origin.url)) fail(`${categoryId}/${origin.id} origin URL must be HTTPS`);
    if (!Array.isArray(origin.fields) || origin.fields.length === 0) fail(`${categoryId}/${origin.id} fields missing`);
  }
  if (contract.structuralLimit && (!contract.structuralLimit.kind || !contract.structuralLimit.reason || !contract.structuralLimit.remediation)) {
    fail(`${categoryId} structural limit is incomplete`);
  }
}
if (DATA_SOURCE_REGISTRY['fear-greed']?.allowedUseCeiling !== 'reference') fail('CNN Fear & Greed must remain reference-only until licensed rights are configured');

const breadthRows = history.filter((row) => row?.breadth20 != null || row?.breadth50 != null || row?.breadth200 != null);
for (const row of breadthRows) {
  for (const field of ['breadth20', 'breadth50', 'breadth200']) {
    if (row[field] == null) continue;
    const meta = row.fieldMeta?.[field];
    if (!meta || meta.sourceKind !== 'derived-research' || meta.universeScope !== 'aio-us-screener-universe-not-official-exchange') fail(`${row.date}/${field} scope lineage missing`);
    if (!Number.isFinite(Number(meta.eligible)) || Number(meta.eligible) < 20 || !Number.isFinite(Number(meta.coveragePct)) || Number(meta.coveragePct) < 50) fail(`${row.date}/${field} insufficient universe coverage`);
  }
}

const gapIds = new Set();
for (const gap of CRITICAL_DATA_GAP_REGISTRY) {
  if (!gap.id || gapIds.has(gap.id)) fail(`critical gap identity invalid: ${gap.id || 'missing'}`);
  gapIds.add(gap.id);
  for (const field of ['priority', 'status', 'reason', 'requiredOrigin', 'allowedInterimUse']) {
    if (!gap[field]) fail(`${gap.id} ${field} missing`);
  }
  if (gap.priority === 'P0' && gap.status !== 'BLOCKED' && (!gap.validationGate || !gap.implementedScope || !gap.remainingLimit)) fail(`${gap.id} P0 partial capability requires a validation gate, implemented scope and remaining limit`);
}

console.log(JSON.stringify({
  ok: true,
  categoryCount: SOURCE_REGISTRY_CATEGORY_IDS.length,
  originCount: Object.values(DATA_SOURCE_REGISTRY).reduce((sum, contract) => sum + contract.origins.length, 0),
  dailyAuditCoverage: `${SOURCE_REGISTRY_CATEGORY_IDS.length}/${SOURCE_REGISTRY_CATEGORY_IDS.length}`,
  criticalGaps: CRITICAL_DATA_GAP_REGISTRY.length,
  p0Blocked: CRITICAL_DATA_GAP_REGISTRY.filter((gap) => gap.priority === 'P0' && gap.status === 'BLOCKED').length,
  p0Partial: CRITICAL_DATA_GAP_REGISTRY.filter((gap) => gap.priority === 'P0' && gap.status === 'PARTIAL').length
}));
