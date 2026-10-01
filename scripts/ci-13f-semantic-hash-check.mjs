#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { is13FFilingSeason, ownershipFailureFields, updateOwnershipOnlyDiscovery } from './lib/13f-discovery.mjs';
import {
  rawSha256,
  semanticDigest,
  writeJsonIfSemanticallyChanged,
  writeJsonIfSemanticallyChangedSync
} from './lib/13f-semantic-hash.mjs';

const base = {
  schema: 'masters-13f-reference.v2',
  generatedAt: '2026-09-28T00:00:00.000Z',
  reviewedAt: '2026-09-28',
  ownershipCheckedAt: '2026-09-28T00:00:00.000Z',
  revision: '2026-09-28-v56.70',
  status: 'REFERENCE_ROWS_CONNECTED',
  coverage: { managers: 1, rowCount: 2, blocked: 0 },
  managers: [{
    id: 'fixture-manager',
    status: 'VERIFIED_ROWS',
    checkedAt: '2026-09-28T00:00:00.000Z',
    collectedAt: '2026-09-28T00:00:00.000Z',
    currentnessCheckedAt: '2026-09-28T00:00:00.000Z',
    ownershipCheckedAt: '2026-09-28T00:00:00.000Z',
    latestFiling: { accession: '0000000001-26-000001', form: '13F-HR', periodOfReport: '2026-06-30' },
    amendmentSemantics: { status: 'ORIGINAL', number: null },
    lastKnownGood: { accession: '0000000001-26-000000', rowCount: 2 },
    holdings: [{ cusip: '000000001', shares: 100, value: 1000 }]
  }],
  failedManagers: []
};

const ASSERTION_TRACE = 'P1309/R654/QA-DATA-51';
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let checks = 0;
function check(name, condition, details = '') {
  const trace = name.startsWith(ASSERTION_TRACE) ? name : `${ASSERTION_TRACE} ${name}`;
  checks += 1;
  assert.ok(condition, `${trace}${details ? `: ${details}` : ''}`);
  console.log(`PASS ${trace}`);
}

check('P1309/R654/QA-DATA-51 13f-filing-window-covers-quarter-end-through-day-45-only',
  is13FFilingSeason('2026-01-01')
  && is13FFilingSeason('2026-02-14')
  && !is13FFilingSeason('2026-02-15')
  && is13FFilingSeason('2026-05-15')
  && !is13FFilingSeason('2026-05-16')
  && is13FFilingSeason('2026-08-14')
  && !is13FFilingSeason('2026-08-15')
  && is13FFilingSeason('2026-11-14')
  && !is13FFilingSeason('2026-11-15')
  && !is13FFilingSeason('invalid-date'));

const clockOnly = clone(base);
clockOnly.generatedAt = '2026-09-29T03:14:15.000Z';
clockOnly.reviewedAt = '2026-09-29';
clockOnly.ownershipCheckedAt = '2026-09-29T03:14:15.000Z';
clockOnly.revision = '2026-09-29-v56.71';
clockOnly.managers[0].checkedAt = '2026-09-29T03:14:15.000Z';
clockOnly.managers[0].collectedAt = '2026-09-29T03:14:15.000Z';
clockOnly.managers[0].currentnessCheckedAt = '2026-09-29T03:14:15.000Z';
clockOnly.managers[0].ownershipCheckedAt = '2026-09-29T03:14:15.000Z';
check('P1309/R654/QA-DATA-51 poll-clock-only-change-preserves-semantic-digest', semanticDigest(base) === semanticDigest(clockOnly));

const semanticMutations = [
  ['accession', (value) => { value.managers[0].latestFiling.accession = '0000000001-26-000002'; }],
  ['form', (value) => { value.managers[0].latestFiling.form = '13F-HR/A'; }],
  ['amendment', (value) => { value.managers[0].amendmentSemantics.status = 'AMENDED'; }],
  ['rows', (value) => { value.managers[0].holdings[0].shares += 1; }],
  ['status', (value) => { value.managers[0].status = 'STALE_LAST_KNOWN_GOOD'; }],
  ['coverage', (value) => { value.coverage.rowCount += 1; }],
  ['last-known-good', (value) => { value.managers[0].lastKnownGood.accession = '0000000001-26-000003'; }],
  ['blocked-state', (value) => { value.failedManagers.push({ id: 'fixture-manager', status: 'BLOCKED', reason: 'SEC response unavailable' }); }]
];
for (const [name, mutate] of semanticMutations) {
  const changed = clone(base);
  mutate(changed);
  check(`P1309/R654/QA-DATA-51 ${name}-change-alters-semantic-digest`, semanticDigest(base) !== semanticDigest(changed));
}

const ownershipDiscoveryFixture = {
  schema: 'masters-sec-filing-discovery.v2',
  sourceKind: 'SEC_EDGAR',
  status: 'PARTIAL',
  reviewedAt: '2026-09-28',
  generatedAt: '2026-09-28T00:00:00.000Z',
  latestAvailablePeriod: '2026-06-30',
  coverage: {
    filerProfiles: 1,
    discovered: 1,
    blocked: 0,
    notices: 1,
    ownershipEvents: 1,
    ownershipManagers: 1,
    holdingsRowsCurrent: 1,
    holdingsRowsPending: 0
  },
  managers: [{
    managerId: 'fixture-manager',
    cik: '0000000001',
    status: 'DISCOVERED',
    checkedAt: '2026-09-28T00:00:00.000Z',
    sourceKind: 'SEC_EDGAR',
    sourceUrl: 'https://data.sec.gov/submissions/CIK0000000001.json',
    latestSubmission: { accession: '0000000001-26-000010', form: '13F-HR', periodOfReport: '2026-06-30' },
    latestHoldings: { accession: '0000000001-26-000010', form: '13F-HR', periodOfReport: '2026-06-30' },
    priorHoldings: { accession: '0000000001-26-000008', form: '13F-HR', periodOfReport: '2026-03-31' },
    latestPeriodSubmissions: [{ accession: '0000000001-26-000010', form: '13F-HR' }],
    priorPeriodSubmissions: [{ accession: '0000000001-26-000008', form: '13F-HR' }],
    freshnessStatus: 'CURRENT_REFERENCE',
    noticeStatus: 'HOLDINGS_FILED',
    holdingsLag: false,
    ownershipStatus: 'DISCOVERED',
    ownershipEvents: [{ accession: '0000000001-26-000001', form: 'SC 13D', filedAt: '2026-09-01' }]
  }]
};
const ownershipHoldingsFixture = {
  managers: [{ id: 'fixture-manager', latestFiling: { accession: '0000000001-26-000009' } }]
};
const ownershipProfilesFixture = [{ id: 'fixture-manager', cik: '0000000001', type: 'SEC' }];
const ownershipSubmissionsFixture = {
  filings: {
    recent: {
      form: ['SC 13D', '13F-HR', 'SC 13G/A'],
      accessionNumber: ['0000000001-26-000011', '0000000001-26-000010', '0000000001-26-000012'],
      filingDate: ['2026-09-10', '2026-08-07', '2026-09-11'],
      reportDate: ['2026-09-09', '2026-06-30', '2026-09-10'],
      primaryDocument: ['schedule13d.htm', 'primary_doc.xml', 'schedule13ga.htm']
    }
  }
};

function withoutOwnershipFields(artifact) {
  const root = { ...artifact };
  delete root.ownershipCheckedAt;
  root.coverage = { ...artifact.coverage };
  for (const key of ['ownershipEvents', 'ownershipManagers', 'ownershipBlocked']) delete root.coverage[key];
  root.managers = artifact.managers.map((manager) => {
    const fields = { ...manager };
    for (const key of ['ownershipStatus', 'ownershipEvents', 'ownershipCheckedAt', 'ownershipBlockReason', 'lastKnownGoodOwnershipEvents']) {
      delete fields[key];
    }
    return fields;
  });
  return root;
}

const ownershipSuccess = await updateOwnershipOnlyDiscovery({
  discoveryArtifact: ownershipDiscoveryFixture,
  holdingsArtifact: ownershipHoldingsFixture,
  filerProfiles: ownershipProfilesFixture,
  checkedAt: '2026-09-28T04:00:00.000Z',
  fetchSubmissions: async (cik) => {
    assert.equal(cik, '0000000001');
    return ownershipSubmissionsFixture;
  }
});
const updatedOwnershipManager = ownershipSuccess.artifact.managers[0];
check('P1309/R654/QA-DATA-51 ownership-only-updates-13d-g-events',
  updatedOwnershipManager.ownershipStatus === 'DISCOVERED'
  && updatedOwnershipManager.ownershipEvents.map((event) => event.form).join('|') === 'SC 13G/A|SC 13D');
check('P1309/R654/QA-DATA-51 ownership-event-change-alters-semantic-digest',
  semanticDigest(ownershipDiscoveryFixture) !== semanticDigest(ownershipSuccess.artifact));
check('P1309/R654/QA-DATA-51 ownership-only-adds-asof-and-counts',
  ownershipSuccess.artifact.ownershipCheckedAt === '2026-09-28T04:00:00.000Z'
  && ownershipSuccess.in13fFilingSeason === false
  && ownershipSuccess.artifact.coverage.ownershipEvents === 2
  && ownershipSuccess.artifact.coverage.ownershipManagers === 1
  && ownershipSuccess.artifact.coverage.ownershipBlocked === 0);
check('P1309/R654/QA-DATA-51 ownership-only-preserves-all-nonownership-fields-exactly',
  JSON.stringify(withoutOwnershipFields(ownershipSuccess.artifact))
  === JSON.stringify(withoutOwnershipFields(ownershipDiscoveryFixture)));
check('P1309/R654/QA-DATA-51 13f-trigger-compares-connected-holdings-accession',
  ownershipSuccess.pending13fHrTriggers.length === 1
  && ownershipSuccess.pending13fHrTriggers[0].accession === '0000000001-26-000010'
  && ownershipSuccess.pending13fHrTriggers[0].connectedAccession === '0000000001-26-000009');

const alreadyConnectedHoldings = clone(ownershipHoldingsFixture);
alreadyConnectedHoldings.managers[0].latestFiling.accession = '0000000001-26-000010';
const connectedOwnershipPoll = await updateOwnershipOnlyDiscovery({
  discoveryArtifact: ownershipDiscoveryFixture,
  holdingsArtifact: alreadyConnectedHoldings,
  filerProfiles: ownershipProfilesFixture,
  checkedAt: '2026-09-28T04:05:00.000Z',
  fetchSubmissions: async () => ownershipSubmissionsFixture
});
check('P1309/R654/QA-DATA-51 13f-trigger-clears-only-after-holdings-connect', connectedOwnershipPoll.pending13fHrTriggers.length === 0);

const noticeOnlySubmissions = clone(ownershipSubmissionsFixture);
noticeOnlySubmissions.filings.recent.form.unshift('13F-NT');
noticeOnlySubmissions.filings.recent.accessionNumber.unshift('0000000001-26-000013');
noticeOnlySubmissions.filings.recent.filingDate.unshift('2026-09-20');
noticeOnlySubmissions.filings.recent.reportDate.unshift('2026-06-30');
noticeOnlySubmissions.filings.recent.primaryDocument.unshift('notice.htm');
const noticeOnlyPoll = await updateOwnershipOnlyDiscovery({
  discoveryArtifact: ownershipDiscoveryFixture,
  holdingsArtifact: alreadyConnectedHoldings,
  filerProfiles: ownershipProfilesFixture,
  checkedAt: '2026-09-28T04:07:00.000Z',
  fetchSubmissions: async () => noticeOnlySubmissions
});
check('P1309/R654/QA-DATA-51 13f-nt-only-does-not-trigger-row-import', noticeOnlyPoll.pending13fHrTriggers.length === 0);

const blockedOwnership = await updateOwnershipOnlyDiscovery({
  discoveryArtifact: ownershipDiscoveryFixture,
  holdingsArtifact: ownershipHoldingsFixture,
  filerProfiles: ownershipProfilesFixture,
  checkedAt: '2026-09-28T04:10:00.000Z',
  fetchSubmissions: async () => { throw new Error('SEC submissions unavailable'); }
});
const blockedOwnershipManager = blockedOwnership.artifact.managers[0];
check('P1309/R654/QA-DATA-51 ownership-fetch-failure-blocks-current-events-and-preserves-lkg',
  blockedOwnershipManager.ownershipStatus === 'BLOCKED'
  && blockedOwnershipManager.ownershipEvents.length === 0
  && JSON.stringify(blockedOwnershipManager.lastKnownGoodOwnershipEvents) === JSON.stringify(ownershipDiscoveryFixture.managers[0].ownershipEvents)
  && blockedOwnershipManager.ownershipBlockReason === 'SEC submissions unavailable');
const repeatedOwnershipFailure = ownershipFailureFields({
  ownershipStatus: 'BLOCKED',
  ownershipEvents: [],
  lastKnownGoodOwnershipEvents: ownershipDiscoveryFixture.managers[0].ownershipEvents
}, '2026-09-28T04:15:00.000Z', 'SEC submissions unavailable');
check('P1309/R654/QA-DATA-51 full-discovery-repeated-failure-retains-existing-ownership-lkg',
  repeatedOwnershipFailure.ownershipStatus === 'BLOCKED'
  && repeatedOwnershipFailure.ownershipEvents.length === 0
  && JSON.stringify(repeatedOwnershipFailure.lastKnownGoodOwnershipEvents) === JSON.stringify(ownershipDiscoveryFixture.managers[0].ownershipEvents));
check('P1309/R654/QA-DATA-51 ownership-block-change-alters-semantic-digest',
  semanticDigest(ownershipSuccess.artifact) !== semanticDigest(blockedOwnership.artifact));
check('P1309/R654/QA-DATA-51 ownership-block-does-not-change-13f-coverage-or-status',
  JSON.stringify(withoutOwnershipFields(blockedOwnership.artifact))
  === JSON.stringify(withoutOwnershipFields(ownershipDiscoveryFixture))
  && blockedOwnership.artifact.coverage.ownershipBlocked === 1
  && blockedOwnership.artifact.coverage.ownershipEvents === 0);

const ownershipLaterClock = await updateOwnershipOnlyDiscovery({
  discoveryArtifact: ownershipDiscoveryFixture,
  holdingsArtifact: ownershipHoldingsFixture,
  filerProfiles: ownershipProfilesFixture,
  checkedAt: '2026-09-29T04:00:00.000Z',
  fetchSubmissions: async () => ownershipSubmissionsFixture
});
check('P1309/R654/QA-DATA-51 ownership-checked-at-alone-does-not-change-semantic-digest',
  semanticDigest(ownershipSuccess.artifact) === semanticDigest(ownershipLaterClock.artifact));

const collectorSource = await fs.readFile(path.join(scriptRoot, 'collect-13f-discovery.mjs'), 'utf8');
const ownershipOnlySource = collectorSource.split('if (ownershipOnly) {')[1]?.split('\n}\n\nconst discovered')[0] || '';
const ownershipModuleSource = await fs.readFile(path.join(scriptRoot, 'lib', '13f-discovery.mjs'), 'utf8');
check('P1309/R654/QA-DATA-51 ownership-only-uses-submissions-json-without-archive-or-xml-fetch',
  ownershipOnlySource.includes('updateOwnershipOnlyDiscovery')
  && ownershipOnlySource.includes('ownershipClient.json(')
  && ownershipOnlySource.includes('https://data.sec.gov/submissions/CIK${cik}.json')
  && !ownershipOnlySource.includes('enrichFilingDocuments(')
  && !ownershipOnlySource.includes('ownershipClient.text(')
  && !ownershipModuleSource.includes('fetchArchiveIndex(')
  && !ownershipModuleSource.includes('fetchFilingText('));
check('P1309/R654/QA-DATA-51 full-discovery-failure-path-preserves-ownership-lkg',
  collectorSource.includes('ownershipFailureFields(previousOwnership, generatedAt, reason)'));

const producerWiring = [
  ['collect-13f-discovery.mjs', ['writeJsonIfSemanticallyChanged(file, value, { writer: atomicWriteFile })']],
  ['collect-13f-reference.mjs', ['writeJsonIfSemanticallyChanged(file, value, { writer: atomicWriteFile })']],
  ['collect-13f-history-index.mjs', ['writeJsonIfSemanticallyChanged(outputPath, result, { writer: atomicWriteFile })']],
  ['collect-13f-history-rows.mjs', [
    'writeJsonIfSemanticallyChanged(historyPath, history, { writer: atomicWriteFile })',
    'writeJsonIfSemanticallyChanged(historyRowsPath, historyRowsArtifact, { writer: atomicWriteFile })'
  ]],
  ['build-13f-issuer-aggregates.mjs', ['writeJsonIfSemanticallyChangedSync(path.join(root, file), value, { writer: atomicWriteFileSync })']],
  ['build-13f-reference-ticker-index.mjs', [
    "writeJsonIfSemanticallyChangedSync(path.join(root, 'public-data/masters/ticker-index-reference.json'), artifact, { writer: atomicWriteFileSync })",
    'writeJsonIfSemanticallyChangedSync(indexPath,'
  ]],
  ['build-masters-runtime-artifacts.mjs', ['writeJsonIfSemanticallyChanged(file, value, { pretty, writer: atomicWriteFile })']],
  ['reconcile-13f-prior-from-history.mjs', ['writeJsonIfSemanticallyChanged(path.join(dataRoot, name), value, { writer: atomicWriteFile })']]
];
for (const [file, expected] of producerWiring) {
  const source = await fs.readFile(path.join(scriptRoot, file), 'utf8');
  check(`P1309/R654/QA-DATA-51 producer-wires-semantic-writer-${file}`,
    expected.every((fragment) => source.includes(fragment) && source.includes("from './lib/atomic-write.mjs';")));
}

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aio-13f-semantic-'));
try {
  const ownershipTarget = path.join(directory, 'ownership-discovery.json');
  const ownershipFirst = await writeJsonIfSemanticallyChanged(ownershipTarget, ownershipSuccess.artifact);
  const ownershipBefore = await fs.readFile(ownershipTarget);
  const ownershipRerun = await writeJsonIfSemanticallyChanged(ownershipTarget, ownershipLaterClock.artifact);
  const ownershipAfter = await fs.readFile(ownershipTarget);
  check('P1309/R654/QA-DATA-51 ownership-poll-clock-rerun-preserves-discovery-bytes',
    ownershipFirst.written === true && ownershipRerun.written === false && ownershipBefore.equals(ownershipAfter));

  const target = path.join(directory, 'fixture.json');
  const first = await writeJsonIfSemanticallyChanged(target, base);
  const before = await fs.readFile(target);
  const rerun = await writeJsonIfSemanticallyChanged(target, clockOnly);
  const after = await fs.readFile(target);
  const candidateBytes = Buffer.from(`${JSON.stringify(clockOnly, null, 2)}\n`, 'utf8');
  check('P1309/R654/QA-DATA-51 first-write-creates-artifact', first.written === true);
  check('P1309/R654/QA-DATA-51 poll-clock-rerun-skips-write', rerun.written === false);
  check('P1309/R654/QA-DATA-51 semantic-no-op-preserves-existing-bytes', before.equals(after));
  check('P1309/R654/QA-DATA-51 raw-byte-hash-remains-exact', rawSha256(before) === rawSha256(after));
  check('P1309/R654/QA-DATA-51 raw-byte-hash-differs-for-clock-mutated-candidate', rawSha256(before) !== rawSha256(candidateBytes));
  check('P1309/R654/QA-DATA-51 raw-byte-and-semantic-digests-are-independent', semanticDigest(base) === semanticDigest(clockOnly) && rawSha256(before) !== rawSha256(candidateBytes));

  const syncTarget = path.join(directory, 'sync-fixture.json');
  const syncFirst = writeJsonIfSemanticallyChangedSync(syncTarget, base, { pretty: false });
  const syncBefore = await fs.readFile(syncTarget);
  const syncRerun = writeJsonIfSemanticallyChangedSync(syncTarget, clockOnly, { pretty: false });
  const syncAfter = await fs.readFile(syncTarget);
  check('P1309/R654/QA-DATA-51 sync-writer-creates-compact-artifact', syncFirst.written === true && syncBefore.equals(Buffer.from(`${JSON.stringify(base)}\n`, 'utf8')));
  check('P1309/R654/QA-DATA-51 sync-writer-skips-poll-clock-only-change', syncRerun.written === false && syncBefore.equals(syncAfter));

  const corruptPath = path.join(directory, 'corrupt.json');
  const corrupt = Buffer.from('{broken\n', 'utf8');
  await fs.writeFile(corruptPath, corrupt);
  let corruptRejected = false;
  try {
    await writeJsonIfSemanticallyChanged(corruptPath, base);
  } catch (error) {
    corruptRejected = /invalid JSON/.test(String(error?.message || error));
  }
  check('P1309/R654/QA-DATA-51 invalid-existing-artifact-fails-closed', corruptRejected && (await fs.readFile(corruptPath)).equals(corrupt));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}

// P1370: content-addressed manager projections must not embed the daily build/review stamps
// (they re-hashed unchanged quarters every day: 37 managers x 30 days = 1110 files, 252MB),
// and the builder must prune projections the current summary no longer references.
{
  const builder = await fs.readFile(new URL('./build-masters-runtime-artifacts.mjs', import.meta.url), 'utf8');
  const projection = builder.slice(builder.indexOf("schema: 'masters-13f-manager-web-projection.v1'"), builder.indexOf('const projectionText'));
  check('P1370 projection-content-excludes-daily-stamps', projection.length > 0 && !/^\s*(?:generatedAt|reviewedAt)\s*[,:]/m.test(projection));
  check('P1370 builder-prunes-unreferenced-projections', /referencedProjections\.has\(name\)/.test(builder) && /fs\.unlink\(path\.join\(projectionDir, name\)\)/.test(builder));
}

console.log(JSON.stringify({ status: 'PASS', checks }));
