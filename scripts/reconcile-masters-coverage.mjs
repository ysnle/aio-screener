import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mastersDir = path.join(root, 'public-data', 'masters');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(mastersDir, name), 'utf8'));

async function writeAtomic(name, value) {
  const file = path.join(mastersDir, name);
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

const [holdings, catalog, discovery] = await Promise.all([
  readJson('holdings.json'),
  readJson('manager-catalog.json'),
  readJson('filing-discovery.json')
]);

const holdingsById = new Map((holdings.managers || []).map((manager) => [manager.id, manager]));
const filerCount = (catalog.managers || []).filter((manager) => manager.type !== 'METHOD_ONLY').length;
const connected = [...holdingsById.values()].filter((manager) => manager.status === 'VERIFIED_ROWS' && Number(manager.verification?.fullRowCount) > 0);
const staleLastKnownGoodRows = connected.filter((manager) => manager.collectorStatus === 'STALE_LAST_KNOWN_GOOD').length;
const successfulRows = connected.length - staleLastKnownGoodRows;
const generatedAt = holdings.generatedAt || new Date().toISOString();

await writeAtomic('manager-catalog.json', {
  ...catalog,
  reviewedAt: holdings.reviewedAt || catalog.reviewedAt,
  generatedAt,
  coverage: {
    ...catalog.coverage,
    verifiedRowsConnected: successfulRows,
    staleLastKnownGoodRows,
    rowImportPending: Math.max(0, filerCount - successfulRows)
  },
  managers: (catalog.managers || []).map((manager) => {
    const holding = holdingsById.get(manager.id);
    if (!holding) return manager;
    return {
      ...manager,
      status: holding.status,
      latestAvailablePeriod: holding.latestAvailablePeriod,
      latestFiling: holding.latestFiling,
      rowStatus: 'VERIFIED_ROWS',
      rowFreshnessStatus: holding.freshnessStatus === 'CURRENT_REFERENCE' ? 'CURRENT_ROWS' : 'STALE_ROWS',
      currentnessCheckedAt: generatedAt
    };
  })
});

await writeAtomic('filing-discovery.json', {
  ...discovery,
  reviewedAt: holdings.reviewedAt || discovery.reviewedAt,
  generatedAt,
  coverage: {
    ...discovery.coverage,
    holdingsRowsCurrent: successfulRows,
    holdingsRowsPending: Math.max(0, filerCount - successfulRows),
    staleLastKnownGoodRows
  }
});

console.log(JSON.stringify({ ok: true, filerCount, successfulRows, staleLastKnownGoodRows, pending: Math.max(0, filerCount - successfulRows) }));
