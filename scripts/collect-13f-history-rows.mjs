import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveBase, createSecClient, parse13fAmendmentMetadata } from './lib/sec-edgar.mjs';
import { composeAmendmentChain, describeComposition } from './lib/13f-compose.mjs';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { writeJsonIfSemanticallyChanged } from './lib/13f-semantic-hash.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const historyPath = path.join(root, 'public-data', 'masters', 'history-index.json');
const historyRowsPath = path.join(root, 'public-data', 'masters', 'history-holdings.json');
const partialRowsPath = `${historyRowsPath}.partial.json`;
const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
const holdings = JSON.parse(await fs.readFile(path.join(root, 'public-data', 'masters', 'holdings.json'), 'utf8'));
const filings = JSON.parse(await fs.readFile(path.join(root, 'public-data', 'masters', 'filings.json'), 'utf8'));
const reviewedAt = new Date().toISOString().slice(0, 10);
const appVersion = JSON.parse(await fs.readFile(path.join(root, 'version.json'), 'utf8')).version;
const revision = `${reviewedAt}-${appVersion}`;
const secClient = createSecClient({ minIntervalMs: 1100 });

async function fetchText(url, accept = 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8') {
  void accept;
  return secClient.text(url);
}

async function fetchDirectory(base) {
  try {
    const payload = await secClient.json(`${base}index.json`);
    const names = (payload.directory?.item || []).map((item) => item.name).filter(Boolean);
    if (names.length) return names;
    const html = await fetchText(`${base}index.html`, 'text/html');
    return [...html.matchAll(/href=["']([^"']+\.xml)["']/gi)].map((match) => match[1].split('/').pop()).filter(Boolean);
  } catch {
    return [];
  }
}

function decodeXml(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

function tagValue(xml, name) {
  const qualified = `(?:[A-Za-z_][\\w.-]*:)?${name}`;
  const match = String(xml).match(new RegExp(`<${qualified}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${qualified}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '')) : null;
}

function numberValue(value) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRows(xml) {
  const blocks = [...String(xml).matchAll(/<(?:[A-Za-z_][\w.-]*:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?infoTable>/gi)].map((match) => match[1]);
  return blocks.map((block) => {
    const voting = tagValue(block, 'votingAuthority');
    return {
      issuer: tagValue(block, 'nameOfIssuer'),
      titleOfClass: tagValue(block, 'titleOfClass'),
      cusip: tagValue(block, 'cusip'),
      figi: tagValue(block, 'figi'),
      value: numberValue(tagValue(block, 'value')),
      shares: numberValue(tagValue(block, 'sshPrnamt')),
      shareType: tagValue(block, 'sshPrnamtType'),
      putCall: tagValue(block, 'putCall'),
      investmentDiscretion: tagValue(block, 'investmentDiscretion'),
      otherManager: tagValue(block, 'otherManager'),
      votingSole: numberValue(tagValue(voting || '', 'Sole')),
      votingShared: numberValue(tagValue(voting || '', 'Shared')),
      votingNone: numberValue(tagValue(voting || '', 'None'))
    };
  }).filter((row) => row.issuer && row.cusip && row.value != null && row.shares != null);
}

function parseCover(xml) {
  const tableEntryTotal = numberValue(tagValue(xml, 'tableEntryTotal'));
  const tableValueTotal = numberValue(tagValue(xml, 'tableValueTotal'));
  if (tableEntryTotal != null) return { tableEntryTotal, tableValueTotal };
  const text = String(xml).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  const match = (pattern) => text.match(pattern)?.[1] || null;
  return {
    tableEntryTotal: numberValue(match(/Information Table Entry Total:\s*\|?\s*([\d,]+)/i)),
    tableValueTotal: numberValue(match(/Information Table Value Total:\s*\|?\s*([\d,]+)/i))
  };
}

function baseFromPeriod(period) {
  return period.indexUrl.slice(0, period.indexUrl.lastIndexOf('/') + 1);
}

// P1449: 분기의 전체 제출 목록(원본+정정)을 행 수집기가 쓸 수 있는 형태로 만든다. index v3는
// submissions 목록을 저장하고, 이전 스키마의 index(v2)라면 대표 1편의 제출로 폴백한다.
function buildSubmissions(manager, period) {
  if (Array.isArray(period.submissions) && period.submissions.length) {
    return period.submissions.map((submission) => ({
      form: submission.form,
      accession: submission.accession || period.accession,
      filedAt: submission.filedAt || period.filedAt,
      primaryDocument: submission.primaryDocument || 'primary_doc.xml',
      indexUrl: `${archiveBase(manager.cik, submission.accession || period.accession)}/${submission.accession || period.accession}-index.html`
    }));
  }
  const primary = String(period.primaryDocumentXml || '').split('/').pop() || 'primary_doc.xml';
  return [{
    form: period.form,
    accession: period.accession,
    filedAt: period.filedAt,
    primaryDocument: primary,
    indexUrl: period.indexUrl
  }];
}

async function resolveInformationTableUrl(period) {
  const base = baseFromPeriod(period);
  const names = await fetchDirectory(base);
  const candidates = names.filter((name) => /\.xml$/i.test(name) && !/primary_doc|filing.?summary|metalinks|schema|xsd/i.test(name));
  const preferred = candidates.sort((a, b) => {
    const score = (name) => (/info|13f|table/i.test(name) ? 10 : 0) + (/xml$/i.test(name) ? 1 : 0);
    return score(b) - score(a) || b.length - a.length;
  });
  if (!preferred[0]) throw new Error(`information table XML not found for ${period.accession}`);
  return `${base}${preferred[0]}`;
}

let historicalRows = [];
try {
  const partial = JSON.parse(await fs.readFile(partialRowsPath, 'utf8'));
  if (Array.isArray(partial.rows)) historicalRows = partial.rows;
} catch {}
if (!historicalRows.length) {
  try {
    const existing = JSON.parse(await fs.readFile(historyRowsPath, 'utf8'));
    historicalRows = Array.isArray(existing.rows) ? existing.rows : [];
  } catch {}
}
// P1449: periodsImported는 "이번에 새로 수집한 편수"가 아니라 결과 아티팩트에 남아 있는 관측
// 분기 수(담당 매니저·분기 distinct)로 정의한다 — 게이트가 아티팩트 자체와 검산할 수 있게.
const periodKeyCount = () => new Set(historicalRows.map((row) => `${row.managerId}|${row.reportPeriod}`)).size;
let importedPeriods = periodKeyCount();
const writeCheckpoint = async () => {
  await atomicWriteFile(partialRowsPath, `${JSON.stringify({ importedPeriods, rows: historicalRows }, null, 2)}\n`, 'utf8');
};

// P1449: 같은 분기의 모든 제출(원본+정정)을 R499/P948 정책으로 합성한다. 이미 행이 있는 분기도
// (1) 저장 행에 filingRole이 없는 구형(v1) 행이거나 (2) index가 2개 이상 제출을 보존하면 다시
// 합성한다. 그 외에 행이 있는 분기는 저장 행에서만 총계를 다시 계산한다.
const knownKeys = new Set(historicalRows.map((row) => `${row.managerId}|${row.reportPeriod}`));
const needsRecomposition = (periodKey) => {
  if (!knownKeys.has(periodKey)) return true;
  const rowSample = historicalRows.find((row) => `${row.managerId}|${row.reportPeriod}` === periodKey);
  if (rowSample && !rowSample.filingRole) return true;
  return Number(rowSample?.submissionCount || 0) > 1;
};

for (const manager of history.managers) {
  const holdingManager = holdings.managers.find((item) => item.id === manager.managerId);
  const filingManager = filings.managers.find((item) => item.id === manager.managerId);
  for (const period of manager.periods) {
    if (period.rowImportStatus !== 'METADATA_ONLY' && period.rowImportStatus !== 'IMPORTED_HISTORICAL') {
      const isCurrent = period.rowImportStatus === 'IMPORTED_CURRENT';
      const verification = holdingManager?.verification;
      const sourceFiling = isCurrent ? filingManager?.latestFiling : filingManager?.priorFiling;
      period.informationTableXml = sourceFiling?.informationTableXml || period.informationTableXml;
      period.informationTableHtml = period.informationTableXml?.replace(/\.xml$/i, '.html') || period.informationTableHtml;
      period.rowCount = isCurrent ? verification?.fullRowCount : verification?.priorFullRowCount;
      period.reportedValueTotal = isCurrent ? verification?.parsedValueTotal : verification?.priorParsedValueTotal;
      period.coverEntryTotal = isCurrent ? verification?.cover?.tableEntryTotal : null;
      period.coverValueTotal = isCurrent ? verification?.cover?.tableValueTotal : null;
      period.countReconciled = isCurrent ? verification?.countReconciled : verification?.priorCountReconciled;
      // P1462: current/prior rows come from the reference lane, which composes the same-period
      // submissions with the shared policy; its chain is carried here so every imported period
      // states how it was assembled. No chain → the reference lane did not say, so none is claimed.
      const semantics = isCurrent ? verification?.amendmentSemantics : verification?.priorAmendmentSemantics;
      const chain = Array.isArray(semantics?.chain) && semantics.chain.length ? semantics.chain : null;
      if (chain) {
        period.amendmentChain = chain.map((entry) => ({ accession: entry.accession, type: entry.type, role: entry.role, rows: entry.rows }));
        period.composition = describeComposition(chain);
        period.compositionStatus = chain.length > 1 ? 'AMENDMENT_COMPOSED' : 'ORIGINAL_CONNECTED';
        period.compositionSource = 'REFERENCE_LANE';
      } else {
        delete period.amendmentChain;
        period.compositionSource = 'REFERENCE_LANE_UNSTATED';
      }
      continue;
    }
    const periodKey = `${manager.managerId}|${period.periodOfReport}`;
    if (knownKeys.has(periodKey) && !needsRecomposition(periodKey)) {
      // Reconciliation must stay honest: a composite cover carries the summed sub-filing
      // totals, so the row count equals the cover sum only when every sub-filing row is present.
      const existingRows = historicalRows.filter((row) => `${row.managerId}|${row.reportPeriod}` === periodKey);
      const firstRow = existingRows[0];
      period.informationTableXml = firstRow?.sourceUrl || period.informationTableXml;
      period.informationTableHtml = period.informationTableXml?.replace(/\.xml$/i, '.html') || period.informationTableHtml;
      period.rowImportStatus = 'IMPORTED_HISTORICAL';
      period.shareHistoryStatus = 'CONNECTED_TO_HISTORY_ROWS';
      period.rowCount = existingRows.length;
      period.reportedValueTotal = existingRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
      period.reportedSharesTotal = existingRows.reduce((sum, row) => sum + Number(row.shares || 0), 0);
      period.countReconciled = existingRows.every((row) => row.filingRole)
        ? (period.coverEntryTotal == null ? null : period.coverEntryTotal === existingRows.length)
        : false;
      continue;
    }
    try {
      const informationTableByAccession = new Map();
      const bundles = [];
      for (const submission of buildSubmissions(manager, period)) {
        const informationTableXml = await resolveInformationTableUrl({ accession: submission.accession, indexUrl: submission.indexUrl });
        informationTableByAccession.set(submission.accession, informationTableXml);
        const [tableXml, primaryXml] = await Promise.all([
          fetchText(informationTableXml),
          fetchText(`${archiveBase(manager.cik, submission.accession)}/${submission.primaryDocument}`)
        ]);
        const amendment = parse13fAmendmentMetadata(primaryXml);
        bundles.push({
          filing: { accession: submission.accession, form: submission.form, isAmendment: amendment.isAmendment },
          rows: parseRows(tableXml),
          cover: { ...parseCover(primaryXml), isAmendment: amendment.isAmendment, amendmentType: amendment.amendmentType, amendmentNumber: amendment.amendmentNumber }
        });
      }
      const composed = composeAmendmentChain(bundles);
      const provenance = Array.isArray(composed.rowProvenance) && composed.rowProvenance.length === composed.rows.length
        ? composed.rowProvenance
        : null;
      if (!provenance) throw new Error(`row provenance mismatch for ${period.accession}`);
      // 재합성 분기: 이전(부분) 행을 먼저 지워 분기 총계가 중복 누적되지 않게 한다.
      historicalRows = historicalRows.filter((row) => `${row.managerId}|${row.reportPeriod}` !== periodKey);
      knownKeys.delete(periodKey);
      const evidenceCounts = new Map();
      composed.rows.forEach((row, index) => {
        const role = provenance[index].role || 'ORIGINAL';
        const sourceUrl = informationTableByAccession.get(provenance[index].accession) || null;
        let evidenceId = `sec.13f.${manager.cik}.${period.periodOfReport}.${row.cusip}`;
        const seenCount = (evidenceCounts.get(evidenceId) || 0) + 1;
        evidenceCounts.set(evidenceId, seenCount);
        if (seenCount > 1) evidenceId = `${evidenceId}.${String(role).toLowerCase()}`;
        historicalRows.push({
          managerId: manager.managerId,
          cik: manager.cik,
          reportPeriod: period.periodOfReport,
          filedAt: period.filedAt,
          rank: index + 1,
          ...row,
          cusipNormalized: String(row.cusip).replace(/\s+/g, '').toUpperCase(),
          accession: provenance[index].accession,
          filingRole: role,
          evidenceId,
          sourceUrl
        });
      });
      period.compositionStatus = composed.amendmentChain.length > 1 ? 'AMENDMENT_COMPOSED' : 'ORIGINAL_CONNECTED';
      period.amendmentChain = composed.amendmentChain.map((entry) => ({ accession: entry.accession, type: entry.type, role: entry.role, rows: entry.rows }));
      period.composition = describeComposition(composed.amendmentChain);
      period.informationTableXml = informationTableByAccession.get(period.accession) || period.informationTableXml || null;
      period.informationTableHtml = period.informationTableXml?.replace(/\.xml$/i, '.html') || null;
      period.coverEntryTotal = composed.cover.tableEntryTotal;
      period.coverValueTotal = composed.cover.tableValueTotal;
      period.countReconciled = composed.cover.tableEntryTotal == null ? null : composed.cover.tableEntryTotal === composed.rows.length;
      period.rowImportStatus = 'IMPORTED_HISTORICAL';
      period.shareHistoryStatus = 'CONNECTED_TO_HISTORY_ROWS';
      period.rowCount = composed.rows.length;
      period.reportedValueTotal = composed.rows.reduce((sum, row) => sum + row.value, 0);
      period.reportedSharesTotal = composed.rows.reduce((sum, row) => sum + row.shares, 0);
      importedPeriods = periodKeyCount();
      knownKeys.add(periodKey);
      await writeCheckpoint();
      console.log(JSON.stringify({ managerId: manager.managerId, period: period.periodOfReport, rows: composed.rows.length, reconciled: period.countReconciled, composition: period.amendmentChain }));
    } catch (error) {
      // 분류되지 않은 정정 같은 합성 실패는 닫힘 실패다: 부분 행을 분기 전체처럼 발행하지 않고
      // 분기 상태를 REVIEW_REQUIRED로 남긴다(행도 지워 잘못된 총계가 남지 않게 한다).
      period.rowImportStatus = 'REVIEW_REQUIRED';
      period.compositionStatus = 'REVIEW_REQUIRED';
      period.shareHistoryStatus = 'REVIEW_REQUIRED';
      period.rowCount = null;
      period.reportedValueTotal = null;
      period.reportedSharesTotal = null;
      period.countReconciled = false;
      historicalRows = historicalRows.filter((row) => `${row.managerId}|${row.reportPeriod}` !== periodKey);
      importedPeriods = periodKeyCount();
      console.warn(JSON.stringify({ managerId: manager.managerId, period: period.periodOfReport, status: 'REVIEW_REQUIRED', reason: String(error?.message || error) }));
    }
  }
}

history.schemaVersion = 'masters-13f-history-index.v3';
history.revision = revision;
history.reviewedAt = reviewedAt;
history.status = 'FILING_HISTORY_ROWS_CONNECTED';
history.boundary = 'SEC filing metadata와 정보표 원문 행·보고가치·보유수량을 연결한다. 각 분기는 원본+정정 제출을 같은 합성 정책(scripts/lib/13f-compose.mjs)으로 합성하고, 분류되지 않은 정정은 REVIEW_REQUIRED로 닫는다. ticker·sector·issuer aggregate·corporate action은 verified security master가 확인되기 전 공개하지 않는다.';
history.historicalRowsArtifact = 'public-data/masters/history-holdings.json';
history.totalPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.length, 0);
// REVIEW_REQUIRED 분기는 발행된 "행 연결된 분기"로만 들어가면 안 된다 — 자체 카운터로 분리한다.
history.rowImportedPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus !== 'METADATA_ONLY' && period.rowImportStatus !== 'REVIEW_REQUIRED').length, 0);
history.reviewRequiredPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus === 'REVIEW_REQUIRED').length, 0);
history.pendingRowImportPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus === 'METADATA_ONLY').length, 0);
await writeJsonIfSemanticallyChanged(historyPath, history, { writer: atomicWriteFile });

const historyRowsArtifact = {
  schemaVersion: 'masters-13f-history-holdings.v2',
  revision,
  reviewedAt,
  status: 'RAW_SEC_HISTORY_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  boundary: 'SEC 정보표 원문을 보고분기별로 보존한다. 행은 원본+정정 합성 구성(accession·filingRole)을 함께 기록하며, CUSIP·issuer 문자열은 원문 그대로이다. ticker·sector·corporate action·현재 포트폴리오 해석은 포함하지 않는다.',
  source: 'SEC EDGAR information table XML',
  compositionPolicy: 'ORIGINAL_PLUS_NEW_HOLDINGS_OR_LATEST_RESTATEMENT (scripts/lib/13f-compose.mjs)',
  periodsImported: importedPeriods,
  rowsImported: historicalRows.length,
  rows: historicalRows
};
await writeJsonIfSemanticallyChanged(historyRowsPath, historyRowsArtifact, { writer: atomicWriteFile });
await fs.rm(partialRowsPath, { force: true });
console.log(JSON.stringify({ ok: true, output: 'public-data/masters/history-holdings.json', periodsImported: importedPeriods, rowsImported: historicalRows.length, pendingRowImportPeriods: history.pendingRowImportPeriods }));
