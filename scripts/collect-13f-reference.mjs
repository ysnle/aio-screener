import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filingsPath = path.join(root, 'public-data', 'masters', 'filings.json');
const holdingsPath = path.join(root, 'public-data', 'masters', 'holdings.json');
const filings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const userAgent = 'AIO Screener research contact research@example.com';

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function tagValue(xml, name) {
  const qualified = `(?:[A-Za-z_][\\w.-]*:)?${name}`;
  const pattern = new RegExp(`<${qualified}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${qualified}>`, 'i');
  const match = String(xml).match(pattern);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '')) : null;
}

function numberValue(value) {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCusip(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function comparisonKey(row) {
  return [normalizeCusip(row.cusip), String(row.putCall || '').trim().toUpperCase(), String(row.shareType || '').trim().toUpperCase()].join('|');
}

function aggregateRows(rows) {
  const aggregated = new Map();
  for (const row of rows) {
    const key = comparisonKey(row);
    const current = aggregated.get(key) || {
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
    current.value += row.value;
    current.shares += row.shares;
    aggregated.set(key, current);
  }
  return aggregated;
}

function aggregateDisplayRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = comparisonKey(row);
    const current = grouped.get(key) || { ...row, key, cusipNormalized: normalizeCusip(row.cusip), sourceRowCount: 0, value: 0, shares: 0 };
    current.value += row.value;
    current.shares += row.shares;
    current.sourceRowCount += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()];
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

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
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
  const parsed = {
    reportCalendarOrQuarter: tagValue(xml, 'reportCalendarOrQuarter'),
    tableEntryTotal: numberValue(tagValue(xml, 'tableEntryTotal')),
    tableValueTotal: numberValue(tagValue(xml, 'tableValueTotal')),
    isAmendment: tagValue(xml, 'isAmendment'),
    filingManager: tagValue(xml, 'name')
  };
  if (parsed.tableEntryTotal != null) return parsed;
  const text = String(xml).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  const match = (pattern) => text.match(pattern)?.[1] || null;
  return {
    reportCalendarOrQuarter: parsed.reportCalendarOrQuarter || match(/Report for the Calendar Year or Quarter Ended:\s*\|?\s*(\d{2}-\d{2}-\d{4})/i),
    tableEntryTotal: parsed.tableEntryTotal ?? numberValue(match(/Information Table Entry Total:\s*\|?\s*([\d,]+)/i)),
    tableValueTotal: parsed.tableValueTotal ?? numberValue(match(/Information Table Value Total:\s*\|?\s*([\d,]+)/i)),
    isAmendment: parsed.isAmendment || (/Check here if Amendment:\s*\|?\s*(true|false)/i.exec(text)?.[1] || null),
    filingManager: parsed.filingManager || match(/Institutional Investment Manager Filing this Report:[\s\S]*?Name:\s*\|?\s*([^|]+?)(?:\s+Address:|\s+Form 13F File Number:)/i)
  };
}

function baseUrl(indexUrl) {
  return indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1);
}

const verified = filings.managers.filter((manager) => manager.latestFiling && manager.cik);
const managers = [];
const holdings = [];
const allHoldings = [];
const comparisons = [];
const generatedAt = new Date().toISOString();
for (const manager of verified) {
  const filing = manager.latestFiling;
  const primaryDocumentXml = `${baseUrl(filing.indexUrl)}primary_doc.xml`;
  const [tableXml, primaryXml, priorTableXml, priorPrimaryXml] = await Promise.all([
    fetchText(filing.informationTableXml),
    fetchText(primaryDocumentXml),
    manager.priorFiling ? fetchText(manager.priorFiling.informationTableXml) : Promise.resolve(null),
    manager.priorFiling ? fetchText(manager.priorFiling.primaryDocumentXml) : Promise.resolve(null)
  ]);
  const rows = parseRows(tableXml);
  const cover = parseCover(primaryXml);
  const priorRows = priorTableXml ? parseRows(priorTableXml) : [];
  const priorCover = priorPrimaryXml ? parseCover(priorPrimaryXml) : null;
  const comparisonRows = manager.priorFiling ? compareRows(rows, priorRows) : [];
  const comparisonByKey = new Map(comparisonRows.map((row) => [row.key, row]));
  const actionCounts = comparisonRows.reduce((counts, row) => {
    counts[row.action] = (counts[row.action] || 0) + 1;
    return counts;
  }, {});
  const parsedValueTotal = rows.reduce((sum, row) => sum + row.value, 0);
  const countReconciled = cover.tableEntryTotal == null || cover.tableEntryTotal === rows.length;
  const priorCountReconciled = !manager.priorFiling || priorCover?.tableEntryTotal == null || priorCover.tableEntryTotal === priorRows.length;
  const topRows = aggregateDisplayRows(rows).sort((a, b) => b.value - a.value).slice(0, 10).map((row) => {
    const comparison = comparisonByKey.get(comparisonKey(row));
    return {
      ...row,
      cusipNormalized: normalizeCusip(row.cusip),
      priorReportPeriod: manager.priorFiling?.periodOfReport || null,
      priorValue: comparison?.priorValue ?? null,
      priorShares: comparison?.priorShares ?? null,
      valueDelta: comparison?.valueDelta ?? null,
      sharesDelta: comparison?.sharesDelta ?? null,
      action: comparison?.action || 'UNAVAILABLE',
      comparisonStatus: manager.priorFiling && priorCountReconciled ? 'VERIFIED_PRIOR_PERIOD' : 'NOT_AVAILABLE'
    };
  });
  const fullRows = rows.map((row, index) => {
    const comparison = comparisonByKey.get(comparisonKey(row));
    return {
      managerId: manager.id,
      cik: manager.cik,
      reportPeriod: filing.periodOfReport,
      filedAt: filing.filedAt,
      rank: index + 1,
      ...row,
      key: comparisonKey(row),
      cusipNormalized: normalizeCusip(row.cusip),
      sourceRowCount: 1,
      priorReportPeriod: manager.priorFiling?.periodOfReport || null,
      priorValue: comparison?.priorValue ?? null,
      priorShares: comparison?.priorShares ?? null,
      valueDelta: comparison?.valueDelta ?? null,
      sharesDelta: comparison?.sharesDelta ?? null,
      action: comparison?.action || 'UNAVAILABLE',
      comparisonStatus: manager.priorFiling && priorCountReconciled ? 'VERIFIED_PRIOR_PERIOD' : 'NOT_AVAILABLE',
      evidenceId: `sec.13f.${manager.cik}.${filing.periodOfReport}.${row.cusip}`,
      sourceUrl: filing.informationTableHtml
    };
  });
  const comparisonRecords = comparisonRows.map((row, index) => ({
    managerId: manager.id,
    cik: manager.cik,
    reportPeriod: filing.periodOfReport,
    filedAt: filing.filedAt,
    rank: index + 1,
    ...row,
    priorReportPeriod: manager.priorFiling?.periodOfReport || null,
    comparisonStatus: manager.priorFiling && priorCountReconciled ? 'VERIFIED_PRIOR_PERIOD' : 'NOT_AVAILABLE',
    evidenceId: `sec.13f.${manager.cik}.${filing.periodOfReport}.${row.cusipNormalized}`,
    sourceUrl: filing.informationTableHtml
  }));
  managers.push({
    id: manager.id,
    cik: manager.cik,
    status: countReconciled ? 'VERIFIED_ROWS' : 'REVIEW_REQUIRED',
    latestFiling: { ...filing, primaryDocumentXml },
    verification: {
      reportPeriod: filing.periodOfReport,
      cover,
      fullRowCount: rows.length,
      parsedValueTotal,
      countReconciled,
      priorReportPeriod: manager.priorFiling?.periodOfReport || null,
      priorFullRowCount: priorRows.length,
      priorParsedValueTotal: priorRows.reduce((sum, row) => sum + row.value, 0),
      priorCountReconciled,
      comparisonRowCount: comparisonRows.length,
      comparisonActionCounts: actionCounts,
      comparisonKeyPolicy: 'NORMALIZED_CUSIP+PUT_CALL+SHARE_TYPE',
      valueUnit: 'USD as reported by Form 13F information table',
      displayPolicy: 'TOP_10_BY_REPORTED_VALUE'
    }
  });
  topRows.forEach((row, index) => holdings.push({
    managerId: manager.id,
    cik: manager.cik,
    reportPeriod: filing.periodOfReport,
    filedAt: filing.filedAt,
    rank: index + 1,
    ...row,
    evidenceId: `sec.13f.${manager.cik}.${filing.periodOfReport}.${row.cusip}`,
    sourceUrl: filing.informationTableHtml
  }));
  allHoldings.push(...fullRows);
  comparisons.push(...comparisonRecords);
}

const latestAvailablePeriod = managers.map((manager) => manager.latestFiling.periodOfReport).sort().at(-1) || null;
const managersWithFreshness = managers.map((manager) => ({
  ...manager,
  latestAvailablePeriod: manager.latestFiling.periodOfReport,
  collectedAt: generatedAt,
  freshnessStatus: manager.latestFiling.periodOfReport === latestAvailablePeriod ? 'CURRENT_REFERENCE' : 'STALE_REFERENCE'
}));
const refreshedFilings = {
  ...filings,
  generatedAt,
  latestAvailablePeriod,
  managers: filings.managers.map((manager) => {
    const refreshed = managersWithFreshness.find((item) => item.id === manager.id);
    if (!refreshed) return manager;
    return {
      ...manager,
      latestAvailablePeriod: refreshed.latestAvailablePeriod,
      collectedAt: refreshed.collectedAt,
      freshnessStatus: refreshed.freshnessStatus,
      latestFiling: { ...manager.latestFiling, primaryDocumentXml: refreshed.latestFiling.primaryDocumentXml }
    };
  })
};
await fs.writeFile(filingsPath, `${JSON.stringify(refreshedFilings, null, 2)}\n`, 'utf8');

const result = {
  schema: 'masters-13f-reference.v2',
  reviewedAt: '2026-08-02',
  generatedAt,
  sourceKind: 'SEC_EDGAR',
  status: managers.every((manager) => manager.status === 'VERIFIED_ROWS') ? 'REFERENCE_ROWS_CONNECTED' : 'REVIEW_REQUIRED',
  policy: 'Reported period holdings only. Prior-period action labels compare reported shares by normalized CUSIP, put/call and share type; no current price, portfolio recommendation, Trading Score or BUY/SELL inference is generated.',
  displayPolicy: 'Top 10 holdings by reported value per reconciled filing with prior-period share/value deltas; complete source filings remain linked for the full tables.',
  latestAvailablePeriod,
  managers: managersWithFreshness,
  holdings,
  allHoldings,
  comparisons,
  holdingRowsPublished: holdings.length,
  fullRowsAvailable: allHoldings.length,
  reconciledManagers: managersWithFreshness.filter((manager) => manager.status === 'VERIFIED_ROWS').length,
  comparisonRowsPublished: holdings.filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD').length,
  fullComparisonRowsAvailable: comparisons.length,
  reconciledComparisons: managersWithFreshness.filter((manager) => manager.verification.priorCountReconciled).length,
  nextStep: 'MF-05: add issuer/ticker normalization and sector mapping before portfolio-weight labels.'
};
const serialized = `${JSON.stringify(result, null, 2)}\n`;
await fs.writeFile(holdingsPath, serialized, 'utf8');
process.stdout.write(serialized);
