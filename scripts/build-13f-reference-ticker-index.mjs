#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonSync } from './lib/atomic-write.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const holdings = readJson('public-data/masters/holdings.json');
const referenceMaster = readJson('public-data/masters/security-master-reference.json');
const referenceByCusip = new Map(
  (referenceMaster.records || [])
    .filter((record) => record.cusipNormalized && record.tickerReference)
    .map((record) => [record.cusipNormalized, record])
);

const currentRows = holdings.allHoldings || [];
const tickerRows = new Map();
let matchedRows = 0;
for (const row of currentRows) {
  const cusip = row.cusipNormalized || row.cusip || '';
  const mapping = referenceByCusip.get(cusip);
  if (!mapping) continue;
  matchedRows += 1;
  const ticker = String(mapping.tickerReference).toUpperCase();
  const item = tickerRows.get(ticker) || {
    tickerReference: ticker,
    mappingStatus: 'REFERENCE_ONLY',
    issuerReferences: new Set(),
    cusips: new Set(),
    rows: []
  };
  item.issuerReferences.add(mapping.issuerCanonical || row.issuer || '');
  item.cusips.add(cusip);
  item.rows.push({
    managerId: row.managerId,
    cik: row.cik,
    reportPeriod: row.reportPeriod,
    filedAt: row.filedAt,
    issuer: row.issuer,
    titleOfClass: row.titleOfClass,
    cusip,
    value: row.value,
    shares: row.shares,
    shareType: row.shareType,
    putCall: row.putCall,
    priorReportPeriod: row.priorReportPeriod,
    priorValue: row.priorValue,
    priorShares: row.priorShares,
    valueDelta: row.valueDelta,
    sharesDelta: row.sharesDelta,
    action: row.action,
    actionConfidence: row.actionConfidence,
    comparisonStatus: row.comparisonStatus,
    evidenceId: row.evidenceId,
    sourceUrl: row.sourceUrl
  });
  tickerRows.set(ticker, item);
}

const records = [...tickerRows.values()]
  .map((item) => ({
    tickerReference: item.tickerReference,
    mappingStatus: item.mappingStatus,
    issuerReferences: [...item.issuerReferences].filter(Boolean).sort(),
    cusips: [...item.cusips].sort(),
    currentRowCount: item.rows.length,
    rows: item.rows.sort((a, b) => {
      const manager = String(a.managerId || '').localeCompare(String(b.managerId || ''));
      if (manager !== 0) return manager;
      return String(b.value || 0).localeCompare(String(a.value || 0), undefined, { numeric: true });
    })
  }))
  .sort((a, b) => a.tickerReference.localeCompare(b.tickerReference));

const reviewedAt = process.env.MASTERS_REVIEW_DATE || holdings.reviewedAt || referenceMaster.reviewedAt || null;
const artifact = {
  schema: 'masters-13f-reference-ticker-index.v1',
  artifactRole: 'REFERENCE_ONLY_TICKER_LOOKUP',
  sourceKind: 'SEC_EDGAR_DERIVED_REFERENCE',
  status: 'REFERENCE_ONLY',
  reviewedAt,
  generatedAt: holdings.generatedAt || null,
  latestAvailablePeriod: holdings.latestAvailablePeriod || null,
  sourceArtifacts: [
    'public-data/masters/holdings.json',
    'public-data/masters/security-master-reference.json'
  ],
  coverage: {
    sourceCurrentRows: currentRows.length,
    matchedCurrentRows: matchedRows,
    unmappedCurrentRows: currentRows.length - matchedRows,
    referenceTickerCount: records.length,
    verifiedTickerRows: 0,
    sectorWeightsPublished: false
  },
  policy: 'Reference CUSIP-to-ticker crosswalk is a research navigation aid only. It must never be treated as a verified security master, current ownership claim, sector weight, price signal or recommendation. Absence from this bounded index does not prove absence from the underlying 13F rows.',
  boundary: 'Report-period holdings and reported share/value changes remain SEC filing observations. tickerReference is not SEC-provided and remains unverified until an authorized security master and corporate-action review publish a mapping.',
  records
};

atomicWriteJsonSync(path.join(root, 'public-data/masters/ticker-index-reference.json'), artifact);
const indexPath = path.join(root, 'public-data/masters/index.json');
const mastersIndex = readJson('public-data/masters/index.json');
atomicWriteJsonSync(indexPath, {
  ...mastersIndex,
  tickerIndexArtifact: 'public-data/masters/ticker-index-reference.json',
  tickerIndexStatus: artifact.status,
  tickerIndexReferenceCount: records.length,
  tickerIndexMatchedRows: matchedRows,
  tickerIndexGeneratedAt: artifact.generatedAt
});
console.log(JSON.stringify({
  status: 'PASS',
  reviewedAt,
  sourceCurrentRows: currentRows.length,
  matchedCurrentRows: matchedRows,
  referenceTickerCount: records.length,
  verifiedTickerRows: 0
}, null, 2));
