import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filingsPath = path.join(root, 'public-data', 'masters', 'filings.json');
const outputPath = path.join(root, 'public-data', 'masters', 'history-index.json');
const filings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const reviewedAt = new Date().toISOString().slice(0, 10);
const appVersion = JSON.parse(await fs.readFile(path.join(root, 'version.json'), 'utf8')).version;
const userAgent = 'AIO Screener research contact research@example.com';

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function archiveBase(cik, accession) {
  const numericCik = String(cik).replace(/^0+/, '');
  const accessionPath = accession.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accessionPath}`;
}

const managers = [];
for (const manager of filings.managers.filter((item) => item.cik && item.status === 'VERIFIED_METADATA')) {
  const recent = await fetchJson(`https://data.sec.gov/submissions/CIK${manager.cik}.json`);
  const entries = recent.filings.recent.form.map((_, index) => ({
    form: recent.filings.recent.form[index],
    accession: recent.filings.recent.accessionNumber[index],
    filedAt: recent.filings.recent.filingDate[index],
    periodOfReport: recent.filings.recent.reportDate[index],
    primaryDocument: recent.filings.recent.primaryDocument[index]
  })).filter((item) => /^13F-HR(?:\/A)?$/.test(item.form) && item.periodOfReport).sort((a, b) => String(b.periodOfReport).localeCompare(String(a.periodOfReport)));
  const periods = [];
  const seenPeriods = new Set();
  for (const entry of entries) {
    if (seenPeriods.has(entry.periodOfReport)) continue;
    seenPeriods.add(entry.periodOfReport);
    const base = archiveBase(manager.cik, entry.accession);
    periods.push({
      form: entry.form,
      accession: entry.accession,
      periodOfReport: entry.periodOfReport,
      filedAt: entry.filedAt,
      indexUrl: `${base}/${entry.accession}-index.html`,
      primaryDocumentXml: `${base}/${entry.primaryDocument}`,
      rowImportStatus: entry.periodOfReport === manager.latestFiling?.periodOfReport ? 'IMPORTED_CURRENT' : entry.periodOfReport === manager.priorFiling?.periodOfReport ? 'IMPORTED_PRIOR' : 'METADATA_ONLY',
      shareHistoryStatus: entry.periodOfReport === manager.latestFiling?.periodOfReport || entry.periodOfReport === manager.priorFiling?.periodOfReport ? 'CONNECTED_TO_HOLDINGS_ARTIFACT' : 'PENDING_ROW_IMPORT',
      sourceKind: 'SEC_EDGAR'
    });
    if (periods.length >= 12) break;
  }
  managers.push({
    managerId: manager.id,
    cik: manager.cik,
    latestConnectedPeriod: manager.latestFiling?.periodOfReport || null,
    periodsAvailable: periods.length,
    historyDepthTarget: 12,
    periods
  });
}

const result = {
  schemaVersion: 'masters-13f-history-index.v1',
  revision: `${reviewedAt}-${appVersion}`,
  reviewedAt,
  status: 'FILING_METADATA_HISTORY_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  boundary: '분기별 SEC filing metadata와 원문 링크를 연결한다. 현재 보유·전체 포트폴리오·분기별 shares history는 해당 기간의 information table row import와 security master 검증 후에만 공개한다.',
  historyDepthTarget: 12,
  managers,
  connectedManagers: managers.length,
  totalPeriods: managers.reduce((sum, manager) => sum + manager.periods.length, 0),
  rowImportedPeriods: managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus !== 'METADATA_ONLY').length, 0),
  pendingRowImportPeriods: managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus === 'METADATA_ONLY').length, 0)
};
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, output: 'public-data/masters/history-index.json', connectedManagers: result.connectedManagers, totalPeriods: result.totalPeriods, pendingRowImportPeriods: result.pendingRowImportPeriods }));
