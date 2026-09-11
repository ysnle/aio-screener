import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { rawHoldingRow } from './lib/masters-raw-rows.mjs';

// Recovery producer: validate surviving full stores before replacing a missing or
// empty source artifact. Never fall back to an older Git revision or web slices.
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public-data/masters');
const read = async (name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const embedded = new Set(['berkshire-hathaway', 'duquesne-family-office', 'fisher-asset-management', 'pershing-square', 'appaloosa-management', 'baupost-group', 'scion-asset-management']);
const summary = await read('holdings-summary.json');
const filings = await read('filings.json');
assert(summary.sourceSchema === 'masters-13f-reference.v2', 'Unsupported source schema');
assert(summary.managers.length === 37 && summary.holdings.length === 366, 'Recovery snapshot manager/top counts differ');
const managers = [], holdings = [], allHoldings = [], comparisons = [], managerShards = {};
let fullRows = 0, fullComparisons = 0;
for (const manager of summary.managers) {
  assert(/^[a-z0-9-]+$/.test(manager.id), 'Invalid manager ID');
  const shard = await read(`managers/${manager.id}.json`);
  const descriptor = summary.managerShards[manager.id];
  const filing = filings.managers.find((item) => item.id === manager.id);
  assert(shard.schema === 'masters-13f-manager-rows.v1' && shard.managerId === manager.id && shard.cik === manager.cik && filing?.cik === manager.cik, `${manager.id}: identity mismatch`);
  assert(shard.generatedAt === summary.generatedAt && shard.reviewedAt === summary.reviewedAt, `${manager.id}: snapshot mismatch`);
  assert(shard.latestFiling.periodOfReport === descriptor.reportPeriod && shard.latestFiling.accession === descriptor.accession && filing.latestFiling.accession === descriptor.accession, `${manager.id}: filing mismatch`);
  assert(shard.holdings.length === descriptor.fullRows && shard.holdings.length === manager.verification.fullRowCount && shard.comparisons.length === descriptor.comparisonRows && shard.comparisons.length === manager.verification.comparisonRowCount, `${manager.id}: row count mismatch`);
  assert(JSON.stringify(shard.verification) === JSON.stringify(manager.verification), `${manager.id}: verification mismatch`);
  const grouped = new Map();
  for (const row of shard.holdings) {
    assert(row.managerId === manager.id && row.cik === manager.cik && row.reportPeriod === descriptor.reportPeriod && Number.isFinite(row.value) && Number.isFinite(row.shares), `${manager.id}: invalid source row`);
    const aggregate = grouped.get(row.key) || { ...row, value: 0, shares: 0, sourceRowCount: 0 };
    aggregate.value += row.value;
    aggregate.shares += row.shares;
    aggregate.sourceRowCount += 1;
    grouped.set(row.key, aggregate);
  }
  assert(shard.holdings.reduce((sum, row) => sum + row.value, 0) === manager.verification.parsedValueTotal, `${manager.id}: value total mismatch`);
  const comparisonByKey = new Map();
  for (const row of shard.comparisons) {
    assert(row.managerId === manager.id && row.cik === manager.cik && row.reportPeriod === descriptor.reportPeriod && !comparisonByKey.has(row.key), `${manager.id}: invalid comparison row`);
    comparisonByKey.set(row.key, row);
  }
  for (const top of summary.holdings.filter((row) => row.managerId === manager.id)) {
    const aggregate = grouped.get(top.key);
    const comparison = comparisonByKey.get(top.key);
    assert(aggregate && aggregate.value === top.value && aggregate.shares === top.shares, `${manager.id}: top row aggregate mismatch`);
    for (const key of ['priorValue', 'priorShares', 'valueDelta', 'sharesDelta', 'action', 'comparisonStatus']) {
      assert(comparison?.[key] === top[key], `${manager.id}: top comparison ${key} mismatch`);
    }
    holdings.push({ ...aggregate, ...comparison, ...top, sourceRowCount: aggregate.sourceRowCount });
  }
  managers.push({ ...manager, latestFiling: shard.latestFiling, priorFiling: shard.priorFiling || filing.priorFiling || null });
  managerShards[manager.id] = { url: `./public-data/masters/managers/${manager.id}.json`, fullRows: descriptor.fullRows, comparisonRows: descriptor.comparisonRows, reportPeriod: descriptor.reportPeriod, accession: descriptor.accession };
  if (embedded.has(manager.id)) {
    allHoldings.push(...shard.holdings.map(rawHoldingRow));
    comparisons.push(...shard.comparisons);
  }
  fullRows += shard.holdings.length;
  fullComparisons += shard.comparisons.length;
}
assert(fullRows === summary.fullRowsAvailable && fullComparisons === summary.fullComparisonRowsAvailable, 'Global source counts mismatch');
assert(new Set(allHoldings.map((row) => row.managerId)).size === embedded.size, 'Missing embedded manager');
const result = { schema: summary.sourceSchema };
for (const key of ['reviewedAt', 'generatedAt', 'sourceKind', 'status', 'policy', 'displayPolicy', 'latestAvailablePeriod']) result[key] = summary[key];
Object.assign(result, { managers, holdings, allHoldings, comparisons, managerShards, failedManagers: summary.failedManagers || [], holdingRowsPublished: holdings.length, fullRowsAvailable: fullRows, embeddedFullRowsAvailable: allHoldings.length, reconciledManagers: summary.reconciledManagers, comparisonRowsPublished: summary.comparisonRowsPublished, fullComparisonRowsAvailable: fullComparisons, embeddedFullComparisonRowsAvailable: comparisons.length, reconciledComparisons: summary.reconciledComparisons, nextStep: summary.nextStep });
const target = path.join(directory, 'holdings.json');
if (process.argv.includes('--write')) {
  const existing = await fs.stat(target).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  assert(!existing || existing.size === 0, 'Recovery refuses to replace a nonempty source artifact');
  await atomicWriteFile(target, `${JSON.stringify(result, null, 2)}\n`);
  const persisted = await read('holdings.json');
  assert(JSON.stringify(persisted) === JSON.stringify(result), 'Recovery readback mismatch');
}
console.log(JSON.stringify({ ok: true, written: process.argv.includes('--write'), generatedAt: result.generatedAt, managers: managers.length, topRows: holdings.length, fullRows, fullComparisons, embeddedRows: allHoldings.length, embeddedComparisons: comparisons.length }));
