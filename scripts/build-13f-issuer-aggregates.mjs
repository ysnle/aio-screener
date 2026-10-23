#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFileSync } from './lib/atomic-write.mjs';
import { writeJsonIfSemanticallyChangedSync } from './lib/13f-semantic-hash.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const writeJson = (file, value) => writeJsonIfSemanticallyChangedSync(path.join(root, file), value, { writer: atomicWriteFileSync });

const current = readJson('public-data/masters/holdings.json');
const history = readJson('public-data/masters/history-holdings.json');
// v58.71 (pipeline audit): the page showed this file's date as 기준일, and it was the literal '2026-08-18'.
const reviewedAt = process.env.MASTERS_REVIEW_DATE || current.reviewedAt || null;
// v58.71 (pipeline audit): history rows stop two quarters back and allHoldings is the latest quarter only, so the prior
// quarter was in neither (Berkshire AAPL went 2025-12-31 -> 2026-06-30 with sharesDelta 0 and periodCount one short).
// The verified prior-period side of each comparison is that quarter's position; it is added unless history has it.
const historyPeriods = new Set((history.rows || []).map((row) => `${row.managerId}|${row.reportPeriod}`));
const priorRows = (current.comparisons || [])
  .filter((row) => row.comparisonStatus === 'VERIFIED_PRIOR_PERIOD' && row.priorReportPeriod && !historyPeriods.has(`${row.managerId}|${row.priorReportPeriod}`)
    && (Number(row.priorShares) > 0 || Number(row.priorValue) > 0))
  .map((row) => ({ managerId: row.managerId, cik: row.cik, reportPeriod: row.priorReportPeriod, filedAt: null, issuer: row.issuer, titleOfClass: row.titleOfClass,
    cusip: row.cusip, cusipNormalized: row.cusipNormalized, shareType: row.shareType, putCall: row.putCall, value: Number(row.priorValue) || 0, shares: Number(row.priorShares) || 0, sourceUrl: null }));
const rows = [...(history.rows || []), ...priorRows, ...(current.allHoldings || [])];
const keyFor = (row) => [row.managerId, row.cusipNormalized || row.cusip, row.shareType || '', row.putCall || ''].join('|');
const byKey = new Map();
for (const row of rows) {
  const key = keyFor(row);
  const item = byKey.get(key) || {
    aggregateId: `sec-13f-cusip:${key.replace(/[^a-zA-Z0-9|_-]/g, '_')}`,
    managerId: row.managerId,
    cik: row.cik,
    cusipNormalized: row.cusipNormalized || row.cusip,
    issuerNames: new Set(),
    titleOfClasses: new Set(),
    shareTypes: new Set(),
    putCallTypes: new Set(),
    periods: new Map(),
    sourceUrls: new Set()
  };
  item.issuerNames.add(row.issuer || '');
  item.titleOfClasses.add(row.titleOfClass || '');
  item.shareTypes.add(row.shareType || '');
  item.putCallTypes.add(row.putCall || '');
  item.sourceUrls.add(row.sourceUrl || '');
  const period = item.periods.get(row.reportPeriod) || { reportPeriod: row.reportPeriod, filedAt: row.filedAt || null, valueUsd: 0, shares: 0, rowCount: 0, sourceUrls: new Set() };
  period.valueUsd += Number(row.value) || 0;
  period.shares += Number(row.shares) || 0;
  period.rowCount += 1;
  if (row.filedAt && (!period.filedAt || row.filedAt > period.filedAt)) period.filedAt = row.filedAt;
  period.sourceUrls.add(row.sourceUrl || '');
  item.periods.set(row.reportPeriod, period);
  byKey.set(key, item);
}

const aggregates = [...byKey.values()].map((item) => {
  const periods = [...item.periods.values()]
    .filter((period) => period.reportPeriod)
    .sort((a, b) => a.reportPeriod.localeCompare(b.reportPeriod))
    .map((period, index, all) => {
      const previous = all[index - 1];
      return {
        ...period,
        valueDeltaUsd: previous ? period.valueUsd - previous.valueUsd : null,
        sharesDelta: previous ? period.shares - previous.shares : null,
        sourceUrls: [...period.sourceUrls].filter(Boolean)
      };
    });
  const issuerNames = [...item.issuerNames].filter(Boolean);
  const titleOfClasses = [...item.titleOfClasses].filter(Boolean);
  const shareTypes = [...item.shareTypes].filter(Boolean);
  const putCallTypes = [...item.putCallTypes].filter(Boolean);
  const latest = periods.at(-1) || null;
  const reviewFlags = [];
  if (issuerNames.length > 1) reviewFlags.push('ISSUER_NAME_VARIATION');
  if (titleOfClasses.length > 1) reviewFlags.push('TITLE_OF_CLASS_VARIATION');
  if (shareTypes.length > 1) reviewFlags.push('SHARE_TYPE_VARIATION');
  if (putCallTypes.some((value) => value)) reviewFlags.push('PUT_CALL_REVIEW');
  if ((item.cusipNormalized || '').length !== 9) reviewFlags.push('CUSIP_FORMAT_REVIEW');
  return {
    aggregateId: item.aggregateId,
    managerId: item.managerId,
    cik: item.cik,
    cusipNormalized: item.cusipNormalized,
    issuerNames,
    titleOfClasses,
    shareTypes,
    putCallTypes,
    firstReportPeriod: periods[0]?.reportPeriod || null,
    latestReportPeriod: latest?.reportPeriod || null,
    periodCount: periods.length,
    periods,
    sourceUrls: [...item.sourceUrls].filter(Boolean),
    reviewFlags,
    normalizationStatus: 'RAW_CUSIP_ISSUER_AGGREGATE',
    tickerStatus: 'NOT_PUBLISHED',
    sectorStatus: 'NOT_PUBLISHED',
    corporateActionStatus: 'REVIEW_REQUIRED'
  };
});

const managers = [...new Set(aggregates.map((item) => item.managerId))].sort().map((managerId) => {
  const managerRows = aggregates.filter((item) => item.managerId === managerId);
  return {
    managerId,
    aggregateCount: managerRows.length,
    latestPeriod: managerRows.map((item) => item.latestReportPeriod).filter(Boolean).sort().at(-1) || null,
    periodsCovered: new Set(managerRows.flatMap((item) => item.periods.map((period) => period.reportPeriod))).size,
    reviewQueueCount: managerRows.filter((item) => item.reviewFlags.length || item.corporateActionStatus !== 'REVIEWED').length
  };
});

const reviewQueue = aggregates.filter((item) => item.reviewFlags.length).map((item) => ({
  aggregateId: item.aggregateId,
  managerId: item.managerId,
  cusipNormalized: item.cusipNormalized,
  flags: item.reviewFlags,
  action: 'Verify issuer, share class, corporate actions and sector from an authorized security master before publication.'
}));

writeJson('public-data/masters/issuer-aggregates.json', {
  schema: 'masters-13f-issuer-aggregates.v1',
  reviewedAt,
  sourceKind: 'SEC_EDGAR_DERIVED_RAW_ROWS',
  status: 'RAW_CUSIP_MULTI_QUARTER_CONNECTED',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  sourceArtifacts: ['public-data/masters/holdings.json', 'public-data/masters/history-holdings.json'],
  policy: 'Aggregate only by manager + normalized CUSIP + share type + put/call. Do not merge issuer text into a verified issuer, ticker, sector or corporate-action identity.',
  coverage: {
    inputRows: rows.length,
    aggregateRecords: aggregates.length,
    managers: managers.length,
    periods: new Set(rows.map((row) => `${row.managerId}|${row.reportPeriod}`)).size,
    reviewQueue: reviewQueue.length,
    tickerPublished: 0,
    sectorPublished: 0,
    corporateActionsReviewed: 0
  },
  boundary: 'SEC CUSIP·issuer text·reported value·shares·period history are aggregated for research navigation. This is not a verified security master and cannot produce sector weights, current prices or recommendations.',
  managers,
  reviewQueue,
  aggregates
});

const indexPath = 'public-data/masters/index.json';
const index = readJson(indexPath);
writeJson(indexPath, {
  ...index,
  issuerAggregateArtifact: 'public-data/masters/issuer-aggregates.json',
  issuerAggregateStatus: 'RAW_CUSIP_MULTI_QUARTER_CONNECTED',
  issuerAggregateRecords: aggregates.length,
  issuerAggregateReviewQueue: reviewQueue.length,
  issuerAggregateReviewedAt: reviewedAt
});

console.log(JSON.stringify({ status: 'PASS', reviewedAt, inputRows: rows.length, aggregateRecords: aggregates.length, managers: managers.length, reviewQueue: reviewQueue.length }, null, 2));
