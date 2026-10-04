import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveBase, createSecClient } from './lib/sec-edgar.mjs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { writeJsonIfSemanticallyChanged } from './lib/13f-semantic-hash.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filingsPath = path.join(root, 'public-data', 'masters', 'filings.json');
const outputPath = path.join(root, 'public-data', 'masters', 'history-index.json');
const filings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const reviewedAt = new Date().toISOString().slice(0, 10);
const appVersion = JSON.parse(await fs.readFile(path.join(root, 'version.json'), 'utf8')).version;
const secClient = createSecClient();
const historyManagerIds = new Set(['berkshire-hathaway', 'duquesne-family-office', 'fisher-asset-management', 'pershing-square', 'appaloosa-management', 'baupost-group', 'scion-asset-management']);

const managers = [];
for (const manager of filings.managers.filter((item) => item.cik && item.latestFiling && historyManagerIds.has(item.id))) {
  const recent = await secClient.json(`https://data.sec.gov/submissions/CIK${manager.cik}.json`);
  const entries = recent.filings.recent.form.map((_, index) => ({
    form: recent.filings.recent.form[index],
    accession: recent.filings.recent.accessionNumber[index],
    filedAt: recent.filings.recent.filingDate[index],
    periodOfReport: recent.filings.recent.reportDate[index],
    primaryDocument: recent.filings.recent.primaryDocument[index]
  })).filter((item) => /^13F-HR(?:\/A)?$/.test(item.form) && item.periodOfReport);
  // P1449: 같은 분기의 모든 13F-HR / HR-A 제출을 하나의 그룹으로 수집한다. EDGAR recent 목록은
  // 새로 filed된 것이 먼저 나오므로, 이전 구현처럼 같은 분기에서 첫 번째 항목만 대표로 삼으면
  // 부분 행 추가형 정정(HR/A)이 원본 전체를 대체해 버린다(러셀헤이저 2025Q1=4행 $11억, 2023Q4=1행
  // $45억 사례). 원본 여부와 정정행 수를 함꼐 기록해 행 수집기가 R499/P948 정책으로 합성하게 한다.
  const periodGroups = new Map();
  for (const entry of entries) {
    const group = periodGroups.get(entry.periodOfReport) || [];
    group.push(entry);
    periodGroups.set(entry.periodOfReport, group);
  }
  const periodKeys = [...periodGroups.keys()].sort((left, right) => String(right).localeCompare(String(left))).slice(0, 12);
  const periods = [];
  for (const periodOfReport of periodKeys) {
    const group = periodGroups.get(periodOfReport)
      .sort((a, b) => String(a.filedAt).localeCompare(String(b.filedAt)) || String(a.accession).localeCompare(String(b.accession)));
    const original = group.find((item) => /^13F-HR$/.test(item.form));
    // 대표 항목은 원본 13F-HR이 기본이고, 없으면 최소 filed 정정. 행 수집기가 분기 전체를
    // submissions 목록 기준으로 합성하므로 대표 필드는 화면 표기(원문 링크)용이다.
    const representative = original || group[0];
    const base = archiveBase(manager.cik, representative.accession);
    periods.push({
      form: representative.form,
      accession: representative.accession,
      periodOfReport,
      filedAt: representative.filedAt,
      indexUrl: `${base}/${representative.accession}-index.html`,
      primaryDocumentXml: `${base}/${representative.primaryDocument}`,
      submissionCount: group.length,
      submissions: group.map((item) => ({ form: item.form, accession: item.accession, filedAt: item.filedAt, primaryDocument: item.primaryDocument })),
      compositionStatus: original ? 'ORIGINAL_CONNECTED' : 'AMENDMENT_ONLY',
      rowImportStatus: periodOfReport === manager.latestFiling?.periodOfReport ? 'IMPORTED_CURRENT' : periodOfReport === manager.priorFiling?.periodOfReport ? 'IMPORTED_PRIOR' : 'METADATA_ONLY',
      shareHistoryStatus: periodOfReport === manager.latestFiling?.periodOfReport || periodOfReport === manager.priorFiling?.periodOfReport ? 'CONNECTED_TO_HOLDINGS_ARTIFACT' : 'PENDING_ROW_IMPORT',
      sourceKind: 'SEC_EDGAR'
    });
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
  schemaVersion: 'masters-13f-history-index.v3',
  revision: `${reviewedAt}-${appVersion}`,
  reviewedAt,
  status: 'FILING_METADATA_HISTORY_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  boundary: '분기별 SEC filing metadata와 원문 링크를 연결한다. 각 분기는 같은 기간의 전체 제출 목록(원본+정정)을 함께 보존하며, 보유 행 수·보고가치는 information table row import와 security master 검증 후에만 공개한다.',
  compositionPolicy: 'ORIGINAL_PLUS_NEW_HOLDINGS_OR_LATEST_RESTATEMENT (scripts/lib/13f-compose.mjs)',
  historyDepthTarget: 12,
  managers,
  connectedManagers: managers.length,
  totalPeriods: managers.reduce((sum, manager) => sum + manager.periods.length, 0),
  rowImportedPeriods: managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus !== 'METADATA_ONLY').length, 0),
  pendingRowImportPeriods: managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus === 'METADATA_ONLY').length, 0)
};
await writeJsonIfSemanticallyChanged(outputPath, result, { writer: atomicWriteFile });
console.log(JSON.stringify({ ok: true, output: 'public-data/masters/history-index.json', connectedManagers: result.connectedManagers, totalPeriods: result.totalPeriods, pendingRowImportPeriods: result.pendingRowImportPeriods }));
