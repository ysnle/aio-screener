import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSecClient, parse13fAmendmentMetadata } from './lib/sec-edgar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filingsPath = path.join(root, 'public-data', 'masters', 'filings.json');
const holdingsPath = path.join(root, 'public-data', 'masters', 'holdings.json');
const runtimeHoldingsPath = path.join(root, 'public-data', 'masters', 'holdings-summary.json');
const catalogPath = path.join(root, 'public-data', 'masters', 'manager-catalog.json');
const discoveryPath = path.join(root, 'public-data', 'masters', 'filing-discovery.json');
const filings = JSON.parse(await fs.readFile(filingsPath, 'utf8'));
const previousHoldings = JSON.parse(await fs.readFile(holdingsPath, 'utf8'));
const managerCatalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const filingDiscovery = JSON.parse(await fs.readFile(discoveryPath, 'utf8'));
const reviewedAt = new Date().toISOString().slice(0, 10);
const secClient = createSecClient();

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
  const amendment = parse13fAmendmentMetadata(xml);
  const parsed = {
    reportCalendarOrQuarter: tagValue(xml, 'reportCalendarOrQuarter'),
    tableEntryTotal: numberValue(tagValue(xml, 'tableEntryTotal')),
    tableValueTotal: numberValue(tagValue(xml, 'tableValueTotal')),
    isAmendment: tagValue(xml, 'isAmendment') ?? amendment.isAmendment,
    amendmentType: tagValue(xml, 'amendmentType') || amendment.amendmentType,
    amendmentNumber: numberValue(tagValue(xml, 'amendmentNo')) ?? amendment.amendmentNumber,
    filingManager: tagValue(xml, 'name')
  };
  if (parsed.tableEntryTotal != null) return parsed;
  const text = String(xml).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  const match = (pattern) => text.match(pattern)?.[1] || null;
  return {
    reportCalendarOrQuarter: parsed.reportCalendarOrQuarter || match(/Report for the Calendar Year or Quarter Ended:\s*\|?\s*(\d{2}-\d{2}-\d{4})/i),
    tableEntryTotal: parsed.tableEntryTotal ?? numberValue(match(/Information Table Entry Total:\s*\|?\s*([\d,]+)/i)),
    tableValueTotal: parsed.tableValueTotal ?? numberValue(match(/Information Table Value Total:\s*\|?\s*([\d,]+)/i)),
    isAmendment: parsed.isAmendment ?? amendment.isAmendment,
    amendmentType: parsed.amendmentType || amendment.amendmentType || match(/Amendment Type:\s*\|?\s*([^|]+?)(?:\s{2,}|$)/i),
    amendmentNumber: parsed.amendmentNumber ?? amendment.amendmentNumber ?? numberValue(match(/Amendment Number:\s*\|?\s*([\d,]+)/i)),
    filingManager: parsed.filingManager || match(/Institutional Investment Manager Filing this Report:[\s\S]*?Name:\s*\|?\s*([^|]+?)(?:\s+Address:|\s+Form 13F File Number:)/i)
  };
}

function baseUrl(indexUrl) {
  return indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1);
}

async function writeAtomic(file, value) {
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

async function fetchFilingBundle(filing) {
  const primaryDocumentXml = filing.primaryDocumentXml || `${baseUrl(filing.indexUrl)}primary_doc.xml`;
  const [tableXml, primaryXml] = await Promise.all([
    secClient.text(filing.informationTableXml),
    secClient.text(primaryDocumentXml)
  ]);
  return { filing: { ...filing, primaryDocumentXml }, rows: parseRows(tableXml), cover: parseCover(primaryXml) };
}

async function composePeriodFilings(fallbackFiling, periodSubmissions = []) {
  const candidates = (periodSubmissions || [])
    .filter((filing) => filing?.baseForm === '13F-HR' && filing.informationTableXml)
    .sort((left, right) => String(left.filedAt).localeCompare(String(right.filedAt)) || String(left.accession).localeCompare(String(right.accession)));
  if (!candidates.some((filing) => filing.accession === fallbackFiling?.accession) && fallbackFiling?.informationTableXml) candidates.push(fallbackFiling);
  const bundles = [];
  for (const filing of candidates.length ? candidates : [fallbackFiling]) bundles.push(await fetchFilingBundle(filing));
  let effective = null;
  const amendmentChain = [];
  for (const bundle of bundles) {
    const amended = bundle.filing.isAmendment || /\/A$/.test(String(bundle.filing.form || '')) || String(bundle.cover.isAmendment).toLowerCase() === 'true';
    const type = String(bundle.cover.amendmentType || '').trim().toUpperCase();
    if (!amended) {
      effective = { ...bundle, rows: [...bundle.rows] };
      amendmentChain.push({ accession: bundle.filing.accession, type: 'ORIGINAL', rows: bundle.rows.length });
    } else if (/RESTATEMENT/.test(type)) {
      effective = { ...bundle, rows: [...bundle.rows] };
      amendmentChain.push({ accession: bundle.filing.accession, type: 'RESTATEMENT', rows: bundle.rows.length });
    } else if (/NEW HOLDINGS/.test(type) && effective) {
      const existingValue = Number(effective.cover.tableValueTotal ?? effective.rows.reduce((sum, row) => sum + row.value, 0));
      const addedValue = Number(bundle.cover.tableValueTotal ?? bundle.rows.reduce((sum, row) => sum + row.value, 0));
      effective = {
        ...bundle,
        rows: [...effective.rows, ...bundle.rows],
        cover: {
          ...bundle.cover,
          tableEntryTotal: Number(effective.cover.tableEntryTotal ?? effective.rows.length) + Number(bundle.cover.tableEntryTotal ?? bundle.rows.length),
          tableValueTotal: existingValue + addedValue,
          compositeAmendment: true
        }
      };
      amendmentChain.push({ accession: bundle.filing.accession, type: 'NEW HOLDINGS', rows: bundle.rows.length });
    } else {
      throw new Error(`Unsupported 13F amendment semantics for ${bundle.filing.accession}: ${type || 'UNCLASSIFIED'}`);
    }
  }
  if (!effective) throw new Error(`No effective 13F holdings rows for ${fallbackFiling?.accession || 'unknown filing'}`);
  return { ...effective, amendmentChain };
}

const verified = filings.managers.filter((manager) => manager.latestFiling?.informationTableXml && manager.cik);
const managers = [];
const holdings = [];
const allHoldings = [];
const comparisons = [];
const failures = [];
const shards = {};
const embeddedManagerIds = new Set(['berkshire-hathaway', 'duquesne-family-office', 'fisher-asset-management', 'pershing-square', 'appaloosa-management', 'baupost-group', 'scion-asset-management']);
const shardsDir = path.join(root, 'public-data', 'masters', 'managers');
await fs.mkdir(shardsDir, { recursive: true });
const generatedAt = new Date().toISOString();
for (const manager of verified) {
 try {
  const filing = manager.latestFiling;
  const currentBundle = await composePeriodFilings(filing, manager.latestPeriodSubmissions);
  const priorBundle = manager.priorFiling?.informationTableXml ? await composePeriodFilings(manager.priorFiling, manager.priorPeriodSubmissions) : null;
  const primaryDocumentXml = currentBundle.filing.primaryDocumentXml;
  const rows = currentBundle.rows;
  const cover = currentBundle.cover;
  const priorRows = priorBundle?.rows || [];
  const priorCover = priorBundle?.cover || null;
  const comparisonRows = manager.priorFiling ? compareRows(rows, priorRows) : [];
  const comparisonByKey = new Map(comparisonRows.map((row) => [row.key, row]));
  const actionCounts = comparisonRows.reduce((counts, row) => {
    counts[row.action] = (counts[row.action] || 0) + 1;
    return counts;
  }, {});
  const parsedValueTotal = rows.reduce((sum, row) => sum + row.value, 0);
  const aggregatedRows = aggregateDisplayRows(rows).sort((a, b) => b.value - a.value);
  const top5ConcentrationPct = parsedValueTotal > 0 ? aggregatedRows.slice(0, 5).reduce((sum, row) => sum + row.value, 0) / parsedValueTotal * 100 : null;
  const top10ConcentrationPct = parsedValueTotal > 0 ? aggregatedRows.slice(0, 10).reduce((sum, row) => sum + row.value, 0) / parsedValueTotal * 100 : null;
  const currentWeights = new Map(aggregateRows(rows));
  const priorValueTotal = priorRows.reduce((sum, row) => sum + row.value, 0);
  const priorWeights = new Map(aggregateRows(priorRows));
  const turnoverKeys = new Set([...currentWeights.keys(), ...priorWeights.keys()]);
  const turnoverProxyPct = parsedValueTotal > 0 && priorValueTotal > 0
    ? [...turnoverKeys].reduce((sum, key) => sum + Math.abs((currentWeights.get(key)?.value || 0) / parsedValueTotal - (priorWeights.get(key)?.value || 0) / priorValueTotal), 0) * 50
    : null;
  const valueDelta = cover.tableValueTotal == null ? null : parsedValueTotal - cover.tableValueTotal;
  const valueReconciliationStatus = cover.tableValueTotal == null ? 'NOT_REPORTED' : valueDelta === 0 ? 'EXACT' : Math.abs(valueDelta) <= 1 ? 'EXCEPTION_DISCLOSED' : 'MISMATCH';
  const countReconciled = cover.tableEntryTotal == null || cover.tableEntryTotal === rows.length;
  const priorCountReconciled = !manager.priorFiling || priorCover?.tableEntryTotal == null || priorCover.tableEntryTotal === priorRows.length;
  const topRows = aggregatedRows.slice(0, 10).map((row) => {
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
      actionConfidence: comparison ? 'REVIEW_REQUIRED' : 'NOT_AVAILABLE',
      actionBasis: comparison ? 'REPORTED_SHARE_DELTA' : 'NOT_AVAILABLE',
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
      actionConfidence: comparison ? 'REVIEW_REQUIRED' : 'NOT_AVAILABLE',
      actionBasis: comparison ? 'REPORTED_SHARE_DELTA' : 'NOT_AVAILABLE',
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
    actionConfidence: 'REVIEW_REQUIRED',
    actionBasis: 'REPORTED_SHARE_DELTA',
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
      reportedPositionCount: aggregatedRows.length,
      top5ConcentrationPct,
      top10ConcentrationPct,
      turnoverProxyPct,
      turnoverProxyPolicy: 'ONE_HALF_SUM_ABSOLUTE_REPORTED_VALUE_WEIGHT_CHANGE',
      valueDelta,
      valueReconciliationStatus,
      countReconciled,
      priorReportPeriod: manager.priorFiling?.periodOfReport || null,
      priorFullRowCount: priorRows.length,
      priorParsedValueTotal: priorRows.reduce((sum, row) => sum + row.value, 0),
      priorCountReconciled,
      comparisonRowCount: comparisonRows.length,
      comparisonActionCounts: actionCounts,
      corporateActionReviewStatus: 'REVIEW_REQUIRED',
      amendmentSemantics: currentBundle.amendmentChain.some((entry) => entry.type !== 'ORIGINAL')
        ? { status: 'AMENDED', type: cover.amendmentType || 'UNCLASSIFIED', number: cover.amendmentNumber, policy: cover.compositeAmendment ? 'ORIGINAL_PLUS_NEW_HOLDINGS' : /RESTATEMENT/i.test(cover.amendmentType || '') ? 'LATEST_RESTATEMENT_ROWS' : 'AMENDMENT_ROWS_REQUIRE_REVIEW', chain: currentBundle.amendmentChain }
        : { status: 'ORIGINAL', type: null, number: null, policy: 'ORIGINAL_ROWS' },
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
  const shard = {
    schema: 'masters-13f-manager-rows.v1',
    sourceKind: 'SEC_EDGAR',
    reviewedAt,
    generatedAt,
    managerId: manager.id,
    cik: manager.cik,
    latestFiling: { ...filing, primaryDocumentXml },
    priorFiling: manager.priorFiling || null,
    verification: managers.at(-1).verification,
    holdings: fullRows,
    comparisons: comparisonRecords
  };
  const shardPath = path.join(shardsDir, `${manager.id}.json`);
  await writeAtomic(shardPath, shard);
  shards[manager.id] = { url: `./public-data/masters/managers/${manager.id}.json`, fullRows: fullRows.length, comparisonRows: comparisonRecords.length, reportPeriod: filing.periodOfReport, accession: filing.accession };
  if (embeddedManagerIds.has(manager.id)) {
    allHoldings.push(...fullRows);
    comparisons.push(...comparisonRecords);
  }
 } catch (error) {
   failures.push({ managerId: manager.id, cik: manager.cik, status: 'BLOCKED', reason: String(error?.message || error) });
 }
}

for (const failure of failures) {
  const previousManager = previousHoldings.managers?.find((manager) => manager.id === failure.managerId);
  if (!previousManager || managers.some((manager) => manager.id === failure.managerId)) continue;
  managers.push({ ...previousManager, collectorStatus: 'STALE_LAST_KNOWN_GOOD', collectionFailure: failure.reason });
  holdings.push(...(previousHoldings.holdings || []).filter((row) => row.managerId === failure.managerId));
  allHoldings.push(...(previousHoldings.allHoldings || []).filter((row) => row.managerId === failure.managerId));
  comparisons.push(...(previousHoldings.comparisons || []).filter((row) => row.managerId === failure.managerId));
  if (previousHoldings.managerShards?.[failure.managerId]) shards[failure.managerId] = previousHoldings.managerShards[failure.managerId];
}

const latestAvailablePeriod = managers.map((manager) => manager.latestFiling.periodOfReport).sort().at(-1) || null;
const managersWithFreshness = managers.map((manager) => ({
  ...manager,
  latestAvailablePeriod: manager.latestFiling.periodOfReport,
  collectedAt: generatedAt,
  freshnessStatus: manager.collectorStatus === 'STALE_LAST_KNOWN_GOOD' ? 'STALE_LAST_KNOWN_GOOD' : manager.latestFiling.periodOfReport === latestAvailablePeriod ? 'CURRENT_REFERENCE' : 'STALE_REFERENCE'
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
      status: refreshed.status,
      rowStatus: 'VERIFIED_ROWS',
      rowFreshnessStatus: refreshed.freshnessStatus === 'CURRENT_REFERENCE' ? 'CURRENT_ROWS' : 'STALE_ROWS',
      latestAvailablePeriod: refreshed.latestAvailablePeriod,
      collectedAt: refreshed.collectedAt,
      freshnessStatus: refreshed.freshnessStatus,
      latestFiling: { ...manager.latestFiling, primaryDocumentXml: refreshed.latestFiling.primaryDocumentXml }
    };
  })
};
await writeAtomic(filingsPath, refreshedFilings);

const result = {
  schema: 'masters-13f-reference.v2',
  reviewedAt,
  generatedAt,
  sourceKind: 'SEC_EDGAR',
  status: failures.length ? 'REFERENCE_ROWS_PARTIAL' : 'REFERENCE_ROWS_CONNECTED',
  policy: 'Reported period holdings only. Prior-period action labels compare reported shares by normalized CUSIP, put/call and share type; no current price, portfolio recommendation, Trading Score or BUY/SELL inference is generated.',
  displayPolicy: 'Top 10 holdings by reported value per reconciled filing with prior-period share/value deltas; complete source filings remain linked for the full tables.',
  latestAvailablePeriod,
  managers: managersWithFreshness,
  holdings,
  allHoldings,
  comparisons,
  managerShards: shards,
  failedManagers: failures,
  holdingRowsPublished: holdings.length,
  fullRowsAvailable: managers.reduce((sum, manager) => sum + manager.verification.fullRowCount, 0),
  embeddedFullRowsAvailable: allHoldings.length,
  reconciledManagers: managersWithFreshness.filter((manager) => manager.status === 'VERIFIED_ROWS').length,
  comparisonRowsPublished: holdings.filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD').length,
  fullComparisonRowsAvailable: managers.reduce((sum, manager) => sum + manager.verification.comparisonRowCount, 0),
  embeddedFullComparisonRowsAvailable: comparisons.length,
  reconciledComparisons: managersWithFreshness.filter((manager) => manager.verification.priorCountReconciled).length,
  nextStep: 'MF-05: add issuer/ticker normalization and sector mapping before portfolio-weight labels.'
};
await writeAtomic(holdingsPath, result);
const successfulRowManagers = managersWithFreshness.filter((manager) => manager.collectorStatus !== 'STALE_LAST_KNOWN_GOOD');
const staleLastKnownGoodRows = managersWithFreshness.length - successfulRowManagers.length;
await writeAtomic(catalogPath, {
  ...managerCatalog,
  reviewedAt,
  generatedAt,
  coverage: {
    ...managerCatalog.coverage,
    secMetadataVerified: filings.managers.filter((manager) => manager.cik).length,
    verifiedRowsConnected: successfulRowManagers.length,
    staleLastKnownGoodRows,
    rowImportPending: Math.max(0, verified.length - successfulRowManagers.length)
  },
  managers: managerCatalog.managers.map((manager) => {
    const refreshed = managersWithFreshness.find((item) => item.id === manager.id);
    if (!refreshed) return manager;
    return {
      ...manager,
      status: refreshed.status,
      latestAvailablePeriod: refreshed.latestAvailablePeriod,
      latestFiling: refreshed.latestFiling,
      rowStatus: 'VERIFIED_ROWS',
      rowFreshnessStatus: refreshed.freshnessStatus === 'CURRENT_REFERENCE' ? 'CURRENT_ROWS' : 'STALE_ROWS',
      currentnessCheckedAt: generatedAt
    };
  })
});
await writeAtomic(discoveryPath, {
  ...filingDiscovery,
  reviewedAt,
  generatedAt,
  coverage: {
    ...filingDiscovery.coverage,
    holdingsRowsCurrent: successfulRowManagers.length,
    holdingsRowsPending: Math.max(0, verified.length - successfulRowManagers.length),
    staleLastKnownGoodRows
  }
});
await writeAtomic(runtimeHoldingsPath, {
  schema: 'masters-13f-runtime-summary.v1',
  sourceSchema: result.schema,
  artifactRole: 'PAGE_BOOTSTRAP',
  reviewedAt: result.reviewedAt,
  generatedAt: result.generatedAt,
  sourceKind: result.sourceKind,
  status: result.status,
  policy: result.policy,
  displayPolicy: result.displayPolicy,
  latestAvailablePeriod: result.latestAvailablePeriod,
  managers: result.managers,
  holdings: result.holdings,
  comparisons: result.comparisons.filter((row) => result.holdings.some((holding) => holding.managerId === row.managerId && (holding.cusipNormalized || holding.cusip) === (row.cusipNormalized || row.cusip) && (holding.putCall || '') === (row.putCall || '') && (holding.shareType || '') === (row.shareType || ''))),
  managerShards: result.managerShards,
  failedManagers: result.failedManagers,
  holdingRowsPublished: result.holdingRowsPublished,
  fullRowsAvailable: result.fullRowsAvailable,
  reconciledManagers: result.reconciledManagers,
  comparisonRowsPublished: result.comparisonRowsPublished,
  fullComparisonRowsAvailable: result.fullComparisonRowsAvailable,
  reconciledComparisons: result.reconciledComparisons,
  nextStep: result.nextStep
});
console.log(JSON.stringify({ ok: failures.length === 0, managers: managers.length, failedManagers: failures.length, fullRowsAvailable: result.fullRowsAvailable, fullComparisonRowsAvailable: result.fullComparisonRowsAvailable, embeddedFullRowsAvailable: result.embeddedFullRowsAvailable }));
