import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoPlaceholderSecUserAgents, parse13fAmendmentMetadata, recentOwnershipRows, recentSubmissionRows, select13fFilings } from './lib/sec-edgar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(`[13f-currentness] ${message}`); };

for (const file of ['scripts/collect-13f-discovery.mjs', 'scripts/collect-13f-reference.mjs', 'scripts/collect-13f-history-index.mjs', 'scripts/collect-13f-history-rows.mjs', 'scripts/resolve-13f-prior-filings.mjs', 'index.html']) {
  assertNoPlaceholderSecUserAgents(read(file), file);
}

const fixture = {
  filings: { recent: {
    form: ['SC 13G/A', '13F-NT', '13F-HR/A', 'SC 13G', '13F-HR', '13F-HR'],
    accessionNumber: ['0000000001-26-000006', '0000000001-26-000004', '0000000001-26-000003', '0000000001-26-000005', '0000000001-26-000002', '0000000001-25-000001'],
    filingDate: ['2026-08-15', '2026-08-14', '2026-08-13', '2026-08-12', '2026-08-10', '2025-11-14'],
    reportDate: ['2026-08-15', '2026-06-30', '2026-06-30', '2026-08-12', '2026-06-30', '2025-09-30'],
    primaryDocument: ['ownership-a.xml', 'notice.xml', 'amendment.xml', 'ownership.xml', 'primary.xml', 'primary.xml']
  } }
};
if (recentSubmissionRows(fixture).length !== 4) fail('fixture form discovery failed');
const ownershipRows = recentOwnershipRows(fixture);
if (ownershipRows.length !== 2 || ownershipRows[0].form !== 'SC 13G/A') fail('Schedule 13D/G ownership-event discovery failed');
const selected = select13fFilings(fixture);
if (selected.latestSubmission.form !== '13F-NT') fail('latest notice must outrank same-period holdings by filed date');
if (selected.latestHoldings.form !== '13F-HR/A') fail('latest holdings amendment must be retained');
if (selected.priorHoldings.periodOfReport !== '2025-09-30') fail('prior holdings must use the adjacent older report period');
if (selected.latestPeriodSubmissions.length !== 3 || selected.priorPeriodSubmissions.length !== 1) fail('same-period original/amendment/notice groups are incomplete');

const restatementCover = '<table summary="Amendment Information"><tr><td class="FormText">Check here if Amendment</td><td class="CheckBox"><span class="FormData">X</span></td><td class="FormText">Amendment Number:</td><td>1</td></tr><tr><td>This Amendment</td><td class="CheckBox"><span>X</span></td><td class="FormText">is a restatement.</td></tr><tr><td></td><td class="CheckBox"></td><td class="FormText">adds new holdings entries.</td></tr></table>';
const newHoldingsCover = '<table summary="Amendment Information"><tr><td class="FormText">Check here if Amendment</td><td class="CheckBox"><span>X</span></td><td class="FormText">Amendment Number:</td><td>2</td></tr><tr><td>This Amendment</td><td class="CheckBox"></td><td class="FormText">is a restatement.</td></tr><tr><td></td><td class="CheckBox"><span class="FormData">X</span></td><td class="FormText">adds new holdings entries.</td></tr></table>';
const restatementMetadata = parse13fAmendmentMetadata(restatementCover);
const newHoldingsMetadata = parse13fAmendmentMetadata(newHoldingsCover);
if (!restatementMetadata.isAmendment || restatementMetadata.amendmentType !== 'RESTATEMENT' || restatementMetadata.amendmentNumber !== 1) fail(`HTML restatement cover parsing failed: ${JSON.stringify(restatementMetadata)}`);
if (!newHoldingsMetadata.isAmendment || newHoldingsMetadata.amendmentType !== 'NEW HOLDINGS' || newHoldingsMetadata.amendmentNumber !== 2) fail(`HTML new-holdings cover parsing failed: ${JSON.stringify(newHoldingsMetadata)}`);

const workflow = read('.github/workflows/refresh-data.yml');
if (!/collect-13f-discovery\.mjs/.test(workflow) || !/SEC_USER_AGENT/.test(workflow)) fail('scheduled workflow lacks SEC 13F/13D/G discovery and configured user agent');
if ((workflow.match(/name: Refresh SEC 13F and 13D-G discovery with connected rows/g) || []).length !== 1 || !/cron: '13 7 \* \* \*'/.test(workflow)) fail('SEC refresh must run once per daily schedule');
const secClient = read('scripts/lib/sec-edgar.mjs');
if (!/requestQueue/.test(secClient)) fail('SEC client requests are not serialized under the fair-access rate limit');
const referenceCollector = read('scripts/collect-13f-reference.mjs');
if (!/ORIGINAL_PLUS_NEW_HOLDINGS/.test(referenceCollector) || !/LATEST_RESTATEMENT_ROWS/.test(referenceCollector) || !/STALE_LAST_KNOWN_GOOD/.test(referenceCollector)) fail('amendment semantics or last-known-good preservation is missing');
const mastersGate = read('scripts/ci-masters-contract-check.mjs');
if (!/filing-discovery\.json/.test(mastersGate)) fail('masters gate does not consume filing discovery');
const tickerIndexBuilder = read('scripts/build-13f-reference-ticker-index.mjs');
if (!/build-13f-reference-ticker-index\.mjs/.test(workflow) || !/REFERENCE_ONLY_TICKER_LOOKUP/.test(tickerIndexBuilder) || !/Absence from this bounded index does not prove absence/.test(tickerIndexBuilder)) fail('reference-only 13F ticker lookup is not part of the refresh boundary');
console.log(JSON.stringify({ ok: true, fixture13FForms: 4, ownershipEvents: ownershipRows.length, notice: selected.latestSubmission.form, holdings: selected.latestHoldings.form, priorPeriod: selected.priorHoldings.periodOfReport }));
