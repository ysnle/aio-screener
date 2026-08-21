import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const historyPath = path.join(root, 'public-data', 'masters', 'history-index.json');
const historyRowsPath = path.join(root, 'public-data', 'masters', 'history-holdings.json');
const partialRowsPath = `${historyRowsPath}.partial.json`;
const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
const holdings = JSON.parse(await fs.readFile(path.join(root, 'public-data', 'masters', 'holdings.json'), 'utf8'));
const filings = JSON.parse(await fs.readFile(path.join(root, 'public-data', 'masters', 'filings.json'), 'utf8'));
const userAgent = 'AIO Screener research contact research@example.com';
const reviewedAt = new Date().toISOString().slice(0, 10);
const appVersion = JSON.parse(await fs.readFile(path.join(root, 'version.json'), 'utf8')).version;
const revision = `${reviewedAt}-${appVersion}`;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(url, init = {}) {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (waitMs) await sleep(waitMs);
  lastRequestAt = Date.now();
  const response = await fetch(url, { ...init, headers: { 'User-Agent': userAgent, ...(init.headers || {}) } });
  if (response.status === 429) {
    await sleep(30000);
    lastRequestAt = Date.now();
    return fetch(url, { ...init, headers: { 'User-Agent': userAgent, ...(init.headers || {}) } });
  }
  return response;
}

async function fetchText(url, accept = 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8') {
  const response = await request(url, { headers: { Accept: accept } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchDirectory(base) {
  try {
    const response = await request(`${base}index.json`, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const payload = await response.json();
      const names = (payload.directory?.item || []).map((item) => item.name).filter(Boolean);
      if (names.length) return names;
    }
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
let importedPeriods = 0;
try {
  const partial = JSON.parse(await fs.readFile(partialRowsPath, 'utf8'));
  historicalRows = Array.isArray(partial.rows) ? partial.rows : [];
  importedPeriods = Number(partial.importedPeriods) || 0;
} catch {}
if (!historicalRows.length) {
  try {
    const existing = JSON.parse(await fs.readFile(historyRowsPath, 'utf8'));
    historicalRows = Array.isArray(existing.rows) ? existing.rows : [];
    importedPeriods = Number(existing.periodsImported) || 0;
  } catch {}
}
const importedPeriodKeys = new Set(historicalRows.map((row) => `${row.managerId}|${row.reportPeriod}`));
async function writeCheckpoint() {
  await fs.writeFile(partialRowsPath, `${JSON.stringify({ importedPeriods, rows: historicalRows }, null, 2)}\n`, 'utf8');
}
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
      continue;
    }
    const periodKey = `${manager.managerId}|${period.periodOfReport}`;
    if (importedPeriodKeys.has(periodKey)) {
      const existingRows = historicalRows.filter((row) => `${row.managerId}|${row.reportPeriod}` === periodKey);
      const firstRow = existingRows[0];
      period.informationTableXml = firstRow?.sourceUrl || period.informationTableXml;
      period.informationTableHtml = period.informationTableXml?.replace(/\.xml$/i, '.html') || period.informationTableHtml;
      period.rowImportStatus = 'IMPORTED_HISTORICAL';
      period.shareHistoryStatus = 'CONNECTED_TO_HISTORY_ROWS';
      period.rowCount = existingRows.length;
      period.reportedValueTotal = existingRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
      period.reportedSharesTotal = existingRows.reduce((sum, row) => sum + Number(row.shares || 0), 0);
      period.countReconciled = true;
      continue;
    }
    const informationTableXml = await resolveInformationTableUrl(period);
    const tableXml = await fetchText(informationTableXml);
    const primaryXml = await fetchText(period.primaryDocumentXml);
    const rows = parseRows(tableXml);
    const cover = parseCover(primaryXml);
    const sourceRowCount = rows.length;
    const reportedValueTotal = rows.reduce((sum, row) => sum + row.value, 0);
    const reportedSharesTotal = rows.reduce((sum, row) => sum + row.shares, 0);
    period.informationTableXml = informationTableXml;
    period.informationTableHtml = informationTableXml.replace(/\.xml$/i, '.html');
    period.rowImportStatus = 'IMPORTED_HISTORICAL';
    period.shareHistoryStatus = 'CONNECTED_TO_HISTORY_ROWS';
    period.rowCount = sourceRowCount;
    period.reportedValueTotal = reportedValueTotal;
    period.reportedSharesTotal = reportedSharesTotal;
    period.coverEntryTotal = cover.tableEntryTotal;
    period.coverValueTotal = cover.tableValueTotal;
    period.countReconciled = cover.tableEntryTotal == null || cover.tableEntryTotal === sourceRowCount;
    for (const [index, row] of rows.entries()) historicalRows.push({
      managerId: manager.managerId,
      cik: manager.cik,
      reportPeriod: period.periodOfReport,
      filedAt: period.filedAt,
      rank: index + 1,
      ...row,
      cusipNormalized: String(row.cusip).replace(/\s+/g, '').toUpperCase(),
      evidenceId: `sec.13f.${manager.cik}.${period.periodOfReport}.${row.cusip}`,
      sourceUrl: informationTableXml
    });
    importedPeriods += 1;
    importedPeriodKeys.add(periodKey);
    await writeCheckpoint();
    console.log(JSON.stringify({ managerId: manager.managerId, period: period.periodOfReport, rows: sourceRowCount, reconciled: period.countReconciled }));
  }
}

history.schemaVersion = 'masters-13f-history-index.v2';
history.revision = revision;
history.reviewedAt = reviewedAt;
history.status = 'FILING_HISTORY_ROWS_CONNECTED';
history.boundary = 'SEC filing metadata와 정보표 원문 행·보고가치·보유수량을 연결한다. ticker·sector·issuer aggregate·corporate action은 verified security master가 확인되기 전 공개하지 않는다.';
history.historicalRowsArtifact = 'public-data/masters/history-holdings.json';
history.totalPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.length, 0);
history.rowImportedPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus !== 'METADATA_ONLY').length, 0);
history.pendingRowImportPeriods = history.managers.reduce((sum, manager) => sum + manager.periods.filter((period) => period.rowImportStatus === 'METADATA_ONLY').length, 0);
await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');

const historyRowsArtifact = {
  schemaVersion: 'masters-13f-history-holdings.v1',
  revision,
  reviewedAt,
  status: 'RAW_SEC_HISTORY_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  boundary: 'SEC 정보표 원문을 보고분기별로 보존한다. CUSIP·issuer 문자열은 원문 그대로이며 ticker·sector·corporate action·현재 포트폴리오 해석은 포함하지 않는다.',
  source: 'SEC EDGAR information table XML',
  periodsImported: importedPeriods,
  rowsImported: historicalRows.length,
  rows: historicalRows
};
await fs.writeFile(historyRowsPath, `${JSON.stringify(historyRowsArtifact, null, 2)}\n`, 'utf8');
await fs.rm(partialRowsPath, { force: true });
console.log(JSON.stringify({ ok: true, output: 'public-data/masters/history-holdings.json', importedPeriods, rowsImported: historicalRows.length, pendingRowImportPeriods: history.pendingRowImportPeriods }));
