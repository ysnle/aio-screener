import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveBase, createSecClient, findInformationTableFiles, normalizeCik, recentOwnershipRows, select13fFilings, withArchiveUrls } from './lib/sec-edgar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mastersDir = path.join(root, 'public-data', 'masters');
const catalogPath = path.join(mastersDir, 'manager-catalog.json');
const filingsPath = path.join(mastersDir, 'filings.json');
const discoveryPath = path.join(mastersDir, 'filing-discovery.json');
const holdingsPath = path.join(mastersDir, 'holdings.json');
const offline = process.argv.includes('--offline');
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const previousFilings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const holdings = JSON.parse(await fs.readFile(holdingsPath, 'utf8'));
const client = offline ? null : createSecClient();
const generatedAt = new Date().toISOString();
const reviewedAt = generatedAt.slice(0, 10);

async function enrichFilingDocuments(cik, filing) {
  const enriched = withArchiveUrls(cik, filing);
  if (!enriched || enriched.baseForm !== '13F-HR') return enriched;
  const base = archiveBase(cik, enriched.accession);
  const directory = await client.json(`${base}/index.json`);
  const candidates = findInformationTableFiles(directory, enriched.primaryDocument);
  for (const name of candidates) {
    const url = `${base}/${name}`;
    const xml = await client.text(url);
    if (!/<(?:[A-Za-z_][\w.-]*:)?infoTable\b/i.test(xml)) continue;
    return { ...enriched, informationTableXml: url, informationTableHtml: url.replace(/\.xml$/i, '.html') };
  }
  throw new Error(`13F information table XML not found for ${enriched.accession}`);
}

async function writeAtomic(file, value) {
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

const filerProfiles = catalog.managers.filter((manager) => manager.type !== 'METHOD_ONLY' && manager.cik);
const discovered = [];
for (const manager of filerProfiles) {
  const cik = normalizeCik(manager.cik);
  const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  try {
    if (offline) throw new Error('SEC_USER_AGENT is not configured in this local environment');
    const payload = await client.json(sourceUrl);
    const selected = select13fFilings(payload);
    const ownershipEvents = recentOwnershipRows(payload).slice(0, 10).map((filing) => withArchiveUrls(cik, filing));
    if (!selected.latestSubmission || !selected.latestHoldings) throw new Error('No 13F submission/holdings filing found');
    const latestSubmission = withArchiveUrls(cik, selected.latestSubmission);
    const latestHoldings = await enrichFilingDocuments(cik, selected.latestHoldings);
    const priorHoldings = await enrichFilingDocuments(cik, selected.priorHoldings);
    const latestPeriodSubmissions = [];
    for (const filing of selected.latestPeriodSubmissions) latestPeriodSubmissions.push(await enrichFilingDocuments(cik, filing));
    const priorPeriodSubmissions = [];
    for (const filing of selected.priorPeriodSubmissions) priorPeriodSubmissions.push(await enrichFilingDocuments(cik, filing));
    discovered.push({
      managerId: manager.id,
      cik,
      status: 'DISCOVERED',
      checkedAt: generatedAt,
      sourceKind: 'SEC_EDGAR',
      sourceUrl,
      latestSubmission,
      latestHoldings,
      priorHoldings,
      latestPeriodSubmissions,
      priorPeriodSubmissions,
      ownershipStatus: 'DISCOVERED',
      ownershipEvents
    });
  } catch (error) {
    const previous = previousFilings.managers?.find((item) => item.id === manager.id);
    discovered.push({
      managerId: manager.id,
      cik,
      status: 'BLOCKED',
      checkedAt: generatedAt,
      sourceKind: 'SEC_EDGAR',
      sourceUrl,
      reason: String(error?.message || error),
      lastKnownGood: previous?.latestFiling || manager.latestFiling || null,
      ownershipStatus: 'BLOCKED',
      ownershipEvents: []
    });
  }
}

const successful = discovered.filter((item) => item.status === 'DISCOVERED');
const latestPeriod = successful.map((item) => item.latestSubmission.periodOfReport).sort().at(-1) || null;
for (const item of successful) {
  item.freshnessStatus = item.latestSubmission.periodOfReport === latestPeriod ? 'CURRENT_REFERENCE' : 'STALE_REFERENCE';
  item.noticeStatus = item.latestSubmission.baseForm === '13F-NT' ? 'NOTICE_FILED' : 'HOLDINGS_FILED';
  item.holdingsLag = item.latestSubmission.periodOfReport > item.latestHoldings.periodOfReport;
}

const connectedById = new Map((holdings.managers || []).map((manager) => [manager.id, manager]));
const discoveryById = new Map(discovered.map((item) => [item.managerId, item]));
const managers = catalog.managers.map((manager) => {
  if (manager.type === 'METHOD_ONLY') return manager;
  const discovery = discoveryById.get(manager.id);
  if (!discovery || discovery.status !== 'DISCOVERED') {
    return { ...manager, freshnessStatus: 'BLOCKED', currentnessReason: discovery?.reason || 'SEC discovery unavailable' };
  }
  const connected = connectedById.get(manager.id);
  const rowsCurrent = connected?.latestFiling?.accession === discovery.latestHoldings.accession;
  return {
    ...manager,
    status: rowsCurrent ? 'VERIFIED_ROWS' : 'VERIFIED_METADATA',
    latestAvailablePeriod: discovery.latestSubmission.periodOfReport,
    latestFiling: discovery.latestHoldings,
    latestSubmission: discovery.latestSubmission,
    priorFiling: discovery.priorHoldings,
    noticeStatus: discovery.noticeStatus,
    freshnessStatus: discovery.freshnessStatus,
    rowStatus: rowsCurrent ? 'VERIFIED_ROWS' : 'PENDING_SEC_ROW_IMPORT',
    rowFreshnessStatus: rowsCurrent ? 'CURRENT_ROWS' : 'STALE_OR_MISSING_ROWS',
    sourceEvidence: discovery.latestSubmission.indexUrl,
    currentnessCheckedAt: generatedAt
  };
});

const coverage = {
  ...catalog.coverage,
  secMetadataVerified: successful.length,
  verifiedRowsConnected: managers.filter((manager) => manager.rowStatus === 'VERIFIED_ROWS').length,
  rowImportPending: managers.filter((manager) => manager.type !== 'METHOD_ONLY' && manager.rowStatus !== 'VERIFIED_ROWS').length,
  blockedDiscovery: discovered.filter((item) => item.status === 'BLOCKED').length,
  noticeFiled: successful.filter((item) => item.noticeStatus === 'NOTICE_FILED').length,
  ownershipEventCount: successful.reduce((sum, item) => sum + item.ownershipEvents.length, 0),
  ownershipManagers: successful.filter((item) => item.ownershipEvents.length).length,
  latestPeriod
};
const nextCatalog = { ...catalog, reviewedAt, generatedAt, coverage, managers };

const nextFilings = {
  ...previousFilings,
  schema: 'masters-13f-reference.v2',
  reviewedAt,
  generatedAt,
  latestAvailablePeriod: latestPeriod,
  status: discovered.some((item) => item.status === 'BLOCKED') ? 'REFERENCE_METADATA_PARTIAL' : 'REFERENCE_METADATA_CURRENT',
  managers: [
    ...managers.filter((manager) => manager.type !== 'METHOD_ONLY').map((manager) => ({
      id: manager.id,
      cik: manager.cik,
      status: manager.status,
      latestFiling: manager.latestFiling,
      latestSubmission: manager.latestSubmission,
      priorFiling: manager.priorFiling,
      latestPeriodSubmissions: discoveryById.get(manager.id)?.latestPeriodSubmissions || [],
      priorPeriodSubmissions: discoveryById.get(manager.id)?.priorPeriodSubmissions || [],
      ownershipEvents: discoveryById.get(manager.id)?.ownershipEvents || [],
      latestAvailablePeriod: manager.latestAvailablePeriod,
      collectedAt: generatedAt,
      freshnessStatus: manager.freshnessStatus,
      rowFreshnessStatus: manager.rowFreshnessStatus,
      noticeStatus: manager.noticeStatus,
      latestAvailabilityCheck: {
        checkedAt: reviewedAt,
        source: 'SEC submissions JSON',
        sourceUrl: `https://data.sec.gov/submissions/CIK${manager.cik}.json`,
        result: manager.noticeStatus === 'NOTICE_FILED' ? 'LATEST_13F_NOTICE_REPORTED' : 'LATEST_13F_HOLDINGS_REPORTED',
        latest13fPeriod: manager.latestAvailablePeriod
      }
    })),
    ...managers.filter((manager) => manager.type === 'METHOD_ONLY').map((manager) => ({ id: manager.id, cik: null, status: 'METHOD_ONLY', latestFiling: null }))
  ]
};

const artifact = {
  schema: 'masters-sec-filing-discovery.v2',
  sourceKind: 'SEC_EDGAR',
  status: coverage.blockedDiscovery ? 'PARTIAL' : 'CURRENT',
  reviewedAt,
  generatedAt,
  latestAvailablePeriod: latestPeriod,
  coverage: {
    filerProfiles: filerProfiles.length,
    discovered: successful.length,
    blocked: coverage.blockedDiscovery,
    notices: coverage.noticeFiled,
    ownershipEvents: coverage.ownershipEventCount,
    ownershipManagers: coverage.ownershipManagers,
    holdingsRowsCurrent: coverage.verifiedRowsConnected,
    holdingsRowsPending: coverage.rowImportPending
  },
  managers: discovered
};

await writeAtomic(discoveryPath, artifact);
if (offline) {
  console.log(JSON.stringify({ ok: false, blocked: true, output: 'public-data/masters/filing-discovery.json', coverage: artifact.coverage }));
  process.exit(0);
}
await writeAtomic(catalogPath, nextCatalog);
await writeAtomic(filingsPath, nextFilings);
console.log(JSON.stringify({ ok: true, output: 'public-data/masters/filing-discovery.json', coverage: artifact.coverage }));
