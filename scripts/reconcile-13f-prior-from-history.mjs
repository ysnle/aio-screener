import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(root, 'public-data', 'masters');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataRoot, name), 'utf8'));
const writeJson = async (name, value) => fs.writeFile(path.join(dataRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const [mastersIndex, filings, holdings, historyIndex, historyHoldings] = await Promise.all([
  readJson('index.json'),
  readJson('filings.json'),
  readJson('holdings.json'),
  readJson('history-index.json'),
  readJson('history-holdings.json')
]);

function normalizeCusip(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function comparisonKey(row) {
  return [normalizeCusip(row.cusip), String(row.putCall || '').trim().toUpperCase(), String(row.shareType || '').trim().toUpperCase()].join('|');
}

function aggregateRows(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = comparisonKey(row);
    const current = result.get(key) || {
      key,
      issuer: row.issuer,
      titleOfClass: row.titleOfClass,
      cusip: row.cusip,
      cusipNormalized: normalizeCusip(row.cusip),
      putCall: row.putCall || null,
      shareType: row.shareType || null,
      value: 0,
      shares: 0
    };
    current.value += Number(row.value) || 0;
    current.shares += Number(row.shares) || 0;
    result.set(key, current);
  }
  return result;
}

function compareRows(currentRows, priorRows) {
  const current = aggregateRows(currentRows);
  const prior = aggregateRows(priorRows);
  return [...new Set([...current.keys(), ...prior.keys()])].map((key) => {
    const currentRow = current.get(key);
    const priorRow = prior.get(key);
    const shares = currentRow?.shares ?? 0;
    const priorShares = priorRow?.shares ?? 0;
    let action = 'UNCHANGED';
    if (!priorRow) action = 'NEW';
    else if (!currentRow) action = 'EXITED';
    else if (shares > priorShares) action = 'INCREASED';
    else if (shares < priorShares) action = 'REDUCED';
    return {
      key,
      issuer: currentRow?.issuer || priorRow?.issuer,
      titleOfClass: currentRow?.titleOfClass || priorRow?.titleOfClass,
      cusip: currentRow?.cusip || priorRow?.cusip,
      cusipNormalized: currentRow?.cusipNormalized || priorRow?.cusipNormalized,
      putCall: currentRow?.putCall || priorRow?.putCall || null,
      shareType: currentRow?.shareType || priorRow?.shareType || null,
      value: currentRow?.value ?? 0,
      priorValue: priorRow?.value ?? 0,
      valueDelta: (currentRow?.value ?? 0) - (priorRow?.value ?? 0),
      shares,
      priorShares,
      sharesDelta: shares - priorShares,
      action
    };
  }).sort((a, b) => (b.value - a.value) || (b.priorValue - a.priorValue));
}

function adjacentPriorPeriod(historyManager, currentPeriod) {
  return (historyManager?.periods || [])
    .map((period) => period.periodOfReport)
    .filter((period) => period && period < currentPeriod)
    .sort()
    .at(-1) || null;
}

const repaired = [];
for (const manager of holdings.managers) {
  const currentPeriod = manager.verification?.reportPeriod;
  const historyManager = historyIndex.managers.find((item) => item.managerId === manager.id);
  const expectedPrior = adjacentPriorPeriod(historyManager, currentPeriod);
  if (!expectedPrior || expectedPrior === manager.verification?.priorReportPeriod) continue;

  const priorPeriod = historyManager.periods.find((period) => period.periodOfReport === expectedPrior);
  const currentRows = holdings.allHoldings.filter((row) => row.managerId === manager.id && row.reportPeriod === currentPeriod);
  const priorRows = historyHoldings.rows.filter((row) => row.managerId === manager.id && row.reportPeriod === expectedPrior);
  if (!currentRows.length || !priorRows.length || priorRows.length !== priorPeriod?.rowCount) {
    throw new Error(`[reconcile-13f] ${manager.id} ${expectedPrior} rows are not fully available in local SEC history`);
  }

  const comparisons = compareRows(currentRows, priorRows);
  const comparisonByKey = new Map(comparisons.map((row) => [row.key, row]));
  const actionCounts = comparisons.reduce((counts, row) => {
    counts[row.action] = (counts[row.action] || 0) + 1;
    return counts;
  }, {});
  const filingManager = filings.managers.find((item) => item.id === manager.id);
  const previousPriorPeriod = manager.verification?.priorReportPeriod || filingManager?.priorFiling?.periodOfReport || null;
  const sourceUrl = filingManager?.latestFiling?.informationTableHtml || manager.latestFiling?.informationTableHtml;
  const priorFiling = {
    form: priorPeriod.form,
    accession: priorPeriod.accession,
    periodOfReport: priorPeriod.periodOfReport,
    filedAt: priorPeriod.filedAt,
    indexUrl: priorPeriod.indexUrl,
    primaryDocumentXml: priorPeriod.primaryDocumentXml,
    informationTableXml: priorPeriod.informationTableXml,
    informationTableHtml: priorPeriod.informationTableHtml
  };

  Object.assign(manager.verification, {
    priorReportPeriod: expectedPrior,
    priorFullRowCount: priorRows.length,
    priorParsedValueTotal: priorRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0),
    priorCountReconciled: true,
    comparisonRowCount: comparisons.length,
    comparisonActionCounts: actionCounts
  });
  if (filingManager) filingManager.priorFiling = priorFiling;

  holdings.holdings = holdings.holdings.map((row) => {
    if (row.managerId !== manager.id) return row;
    const comparison = comparisonByKey.get(comparisonKey(row));
    return {
      ...row,
      priorReportPeriod: expectedPrior,
      priorValue: comparison?.priorValue ?? null,
      priorShares: comparison?.priorShares ?? null,
      valueDelta: comparison?.valueDelta ?? null,
      sharesDelta: comparison?.sharesDelta ?? null,
      action: comparison?.action || 'UNAVAILABLE',
      comparisonStatus: 'VERIFIED_PRIOR_PERIOD'
    };
  });
  holdings.allHoldings = holdings.allHoldings.map((row) => {
    if (row.managerId !== manager.id) return row;
    const comparison = comparisonByKey.get(comparisonKey(row));
    return {
      ...row,
      priorReportPeriod: expectedPrior,
      priorValue: comparison?.priorValue ?? null,
      priorShares: comparison?.priorShares ?? null,
      valueDelta: comparison?.valueDelta ?? null,
      sharesDelta: comparison?.sharesDelta ?? null,
      action: comparison?.action || 'UNAVAILABLE',
      comparisonStatus: 'VERIFIED_PRIOR_PERIOD'
    };
  });
  holdings.comparisons = [
    ...holdings.comparisons.filter((row) => row.managerId !== manager.id),
    ...comparisons.map((row, index) => ({
      managerId: manager.id,
      cik: manager.cik,
      reportPeriod: currentPeriod,
      filedAt: manager.latestFiling?.filedAt,
      rank: index + 1,
      ...row,
      priorReportPeriod: expectedPrior,
      comparisonStatus: 'VERIFIED_PRIOR_PERIOD',
      evidenceId: `sec.13f.${manager.cik}.${currentPeriod}.${row.cusipNormalized}`,
      sourceUrl
    }))
  ];
  repaired.push({ managerId: manager.id, from: previousPriorPeriod, to: expectedPrior, comparisonRows: comparisons.length });
}

function syncMastersIndex() {
  mastersIndex.reviewedAt = holdings.reviewedAt;
  mastersIndex.generatedAt = holdings.generatedAt;
  mastersIndex.lastSuccessfulArtifact = holdings.generatedAt;
  mastersIndex.comparisonRowsPublished = holdings.comparisonRowsPublished;
  mastersIndex.fullComparisonRowsAvailable = holdings.fullComparisonRowsAvailable;
  mastersIndex.reconciledComparisons = holdings.reconciledComparisons;
}

function restoreManagerOrder() {
  const managerOrder = new Map(holdings.managers.map((manager, index) => [manager.id, index]));
  holdings.comparisons.sort((left, right) => {
    const managerDelta = (managerOrder.get(left.managerId) ?? 999) - (managerOrder.get(right.managerId) ?? 999);
    return managerDelta || (Number(left.rank) || 0) - (Number(right.rank) || 0);
  });
}

restoreManagerOrder();

if (!repaired.length) {
  syncMastersIndex();
  await Promise.all([writeJson('index.json', mastersIndex), writeJson('holdings.json', holdings)]);
  console.log(JSON.stringify({ ok: true, changed: 0, message: 'all connected comparisons already use the adjacent prior filing period', fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable }));
  process.exit(0);
}

const now = new Date().toISOString();
const reviewedAt = now.slice(0, 10);
filings.generatedAt = now;
filings.reviewedAt = reviewedAt;
holdings.generatedAt = now;
holdings.reviewedAt = reviewedAt;
holdings.fullComparisonRowsAvailable = holdings.comparisons.length;
holdings.comparisonRowsPublished = holdings.holdings.filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD').length;
holdings.reconciledComparisons = holdings.managers.filter((manager) => manager.verification?.priorCountReconciled).length;
syncMastersIndex();

await Promise.all([writeJson('index.json', mastersIndex), writeJson('filings.json', filings), writeJson('holdings.json', holdings)]);
console.log(JSON.stringify({ ok: true, changed: repaired.length, repaired, fullComparisonRowsAvailable: holdings.fullComparisonRowsAvailable }));
