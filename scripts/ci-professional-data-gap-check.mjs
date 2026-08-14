import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_DATA_GAP_REGISTRY } from '../src/data/contracts/source-registry.js';
import { selectSecFundamentalsAsOf } from '../src/domain/fundamental/sec-report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const fail = (message) => { throw new Error(`[professional-data-gap] ${message}`); };

const byId = new Map(CRITICAL_DATA_GAP_REGISTRY.map((gap) => [gap.id, gap]));
if (byId.size !== 8) fail(`expected 8 registered gaps, found ${byId.size}`);
for (const gap of CRITICAL_DATA_GAP_REGISTRY) {
  if (!['BLOCKED', 'PARTIAL'].includes(gap.status)) fail(`${gap.id} has unsupported status ${gap.status}`);
  if (gap.status === 'PARTIAL' && (!gap.implementedScope || !gap.remainingLimit || !gap.validationGate)) fail(`${gap.id} partial status lacks implementation evidence contract`);
}

const expectedBlocked = [
  'historical-universe-and-corporate-actions',
  'independent-quote-reconciliation',
  'official-exchange-breadth',
  'earnings-revisions-and-guidance',
  'short-interest-and-options-flow'
];
for (const id of expectedBlocked) if (byId.get(id)?.status !== 'BLOCKED') fail(`${id} must remain blocked until external rights/data are configured`);

const sec = json('public-data/sec-fundamentals.json');
const secRows = Object.values(sec.data || {});
const pitRows = secRows.filter((row) => row?.pit?.schemaVersion === 'sec-pit-facts.v1' && row.pit.observationCount > 0);
if (byId.get('point-in-time-fundamentals')?.status !== 'PARTIAL') fail('PIT fundamentals must be partial, not complete or blocked');
if (!pitRows.length || sec.pointInTimeCoverage !== pitRows.length) fail('SEC PIT artifact coverage is missing or inconsistent');
if (!/SEC_SUBMISSIONS_BASE/.test(read('scripts/fetch-sec-fundamentals.mjs')) || !/acceptanceDateTime/.test(read('scripts/fetch-sec-fundamentals.mjs'))) fail('SEC submissions acceptance-time adapter missing');

const pitFixture = {
  symbol: 'PIT',
  pit: { observations: {
    revenue: [
      { value: 100, periodEnd: '2024-12-31', effectiveAt: '2025-02-01T10:00:00Z', accession: 'original' },
      { value: 120, periodEnd: '2024-12-31', effectiveAt: '2025-03-01T10:00:00Z', accession: 'amended' }
    ],
    netIncome: [
      { value: 10, periodEnd: '2024-12-31', effectiveAt: '2025-02-01T10:00:00Z', accession: 'original' },
      { value: 12, periodEnd: '2024-12-31', effectiveAt: '2025-03-01T10:00:00Z', accession: 'amended' }
    ],
    equity: [], sharesOutstanding: []
  } }
};
const original = selectSecFundamentalsAsOf(pitFixture, '2025-02-15T00:00:00Z');
const amended = selectSecFundamentalsAsOf(pitFixture, '2025-03-15T00:00:00Z');
if (original?.revenue !== 100 || original.accession !== 'original' || amended?.revenue !== 120 || amended.accession !== 'amended') fail('PIT amendment boundary regression');

const masters = json('public-data/masters/holdings.json');
const history = json('public-data/masters/history-index.json');
const filingsGap = byId.get('insider-and-institutional-filings');
if (filingsGap?.status !== 'PARTIAL' || masters.reconciledManagers < 7 || masters.fullRowsAvailable < 1000 || history.totalPeriods < 80) fail('verified 13F partial capability evidence missing');

const index = read('index.html');
const portfolioGap = byId.get('portfolio-risk-attribution');
for (const marker of ['_calcPortfolioVaR', 'conditionalVar5', 'riskContribution', '_aioRenderPortfolioStress', 'benchmarkCorrelation']) {
  if (!index.includes(marker)) fail(`portfolio risk marker missing: ${marker}`);
}
if (portfolioGap?.status !== 'PARTIAL') fail('portfolio risk capability must remain partial while factor/capacity data are unavailable');

console.log(JSON.stringify({
  ok: true,
  gaps: CRITICAL_DATA_GAP_REGISTRY.length,
  partial: CRITICAL_DATA_GAP_REGISTRY.filter((gap) => gap.status === 'PARTIAL').map((gap) => gap.id),
  blocked: expectedBlocked,
  secPitRows: pitRows.length,
  secPitAcceptedRows: secRows.filter((row) => row?.pit?.acceptedTimeCount > 0).length,
  institutionalManagers: masters.reconciledManagers,
  institutionalHistoryPeriods: history.totalPeriods,
  institutionalRows: masters.fullRowsAvailable,
  portfolioRiskMarkers: 5
}));
