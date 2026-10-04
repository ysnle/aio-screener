import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoPlaceholderSecUserAgents, parse13fAmendmentMetadata, recentOwnershipRows, recentSubmissionRows, select13fFilings } from './lib/sec-edgar.mjs';
import { is13FFilingSeason } from './lib/13f-discovery.mjs';

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
if (!is13FFilingSeason('2026-02-14') || is13FFilingSeason('2026-02-15') || !is13FFilingSeason('2026-11-14')) fail('45-day quarterly 13F filing window is inconsistent');

const restatementCover = '<table summary="Amendment Information"><tr><td class="FormText">Check here if Amendment</td><td class="CheckBox"><span class="FormData">X</span></td><td class="FormText">Amendment Number:</td><td>1</td></tr><tr><td>This Amendment</td><td class="CheckBox"><span>X</span></td><td class="FormText">is a restatement.</td></tr><tr><td></td><td class="CheckBox"></td><td class="FormText">adds new holdings entries.</td></tr></table>';
const newHoldingsCover = '<table summary="Amendment Information"><tr><td class="FormText">Check here if Amendment</td><td class="CheckBox"><span>X</span></td><td class="FormText">Amendment Number:</td><td>2</td></tr><tr><td>This Amendment</td><td class="CheckBox"></td><td class="FormText">is a restatement.</td></tr><tr><td></td><td class="CheckBox"><span class="FormData">X</span></td><td class="FormText">adds new holdings entries.</td></tr></table>';
const restatementMetadata = parse13fAmendmentMetadata(restatementCover);
const newHoldingsMetadata = parse13fAmendmentMetadata(newHoldingsCover);
if (!restatementMetadata.isAmendment || restatementMetadata.amendmentType !== 'RESTATEMENT' || restatementMetadata.amendmentNumber !== 1) fail(`HTML restatement cover parsing failed: ${JSON.stringify(restatementMetadata)}`);
if (!newHoldingsMetadata.isAmendment || newHoldingsMetadata.amendmentType !== 'NEW HOLDINGS' || newHoldingsMetadata.amendmentNumber !== 2) fail(`HTML new-holdings cover parsing failed: ${JSON.stringify(newHoldingsMetadata)}`);

const workflow = read('.github/workflows/refresh-data.yml');
if (!/collect-13f-discovery\.mjs/.test(workflow) || !/SEC_USER_AGENT/.test(workflow)) fail('scheduled workflow lacks SEC 13F/13D/G discovery and configured user agent');
const mastersWorkflowStep = workflow.match(/      - name: Refresh weekly SEC 13F and daily 13D-G discovery[\s\S]*?(?=\n      - name: )/)?.[0] || '';
const full13fChain = mastersWorkflowStep.match(/run_full_13f\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
if ((workflow.match(/name: Refresh weekly SEC 13F and daily 13D-G discovery/g) || []).length !== 1
  || !/cron: '13 7 \* \* \*'/.test(workflow)
  || !/GITHUB_EVENT_NAME.*schedule/.test(mastersWorkflowStep)
  || !/collect-13f-discovery\.mjs --ownership-only/.test(mastersWorkflowStep)
  || !/pending_13f_hr.*-gt 0/.test(mastersWorkflowStep)
  || !/in_filing_season.*true/.test(mastersWorkflowStep)
  || !/date -u \+%u/.test(mastersWorkflowStep)
  || !full13fChain.includes('collect-13f-discovery.mjs')
  || !full13fChain.includes('collect-13f-reference.mjs')
  || !full13fChain.includes('collect-13f-history-rows.mjs')
  || !full13fChain.includes('build-masters-runtime-artifacts.mjs')
  || !/else[\s\S]*run_full_13f/.test(mastersWorkflowStep)
  || !/steps\.masters\.outcome == 'success' \|\| steps\.masters\.outcome == 'skipped'/.test(workflow)) {
  fail('P1309/R654/QA-DATA-51 must keep daily ownership-only polling and run full 13F rows during filing-season Mondays, for unconnected HR/HR-A filings, or by explicit dispatch');
}
const mastersPage = read('src/ui/pages/masters.js');
if (!mastersPage.includes('SEC 발견 artifact 기준일') || !mastersPage.includes('13D/G 제출 artifact 기준일') || mastersPage.includes('SEC 온라인 현재성 발견')) {
  fail('P1309/R654/QA-DATA-51 must label last published SEC artifacts with an as-of date instead of claiming a fresh online poll');
}
const secClient = read('scripts/lib/sec-edgar.mjs');
if (!/requestQueue/.test(secClient)) fail('SEC client requests are not serialized under the fair-access rate limit');
const referenceCollector = read('scripts/collect-13f-reference.mjs');
if (!/ORIGINAL_PLUS_NEW_HOLDINGS/.test(referenceCollector) || !/LATEST_RESTATEMENT_ROWS/.test(referenceCollector) || !/STALE_LAST_KNOWN_GOOD/.test(referenceCollector)) fail('amendment semantics or last-known-good preservation is missing');
// ── P1449: history lane composes amendments with the same shared policy, and the composition
// policy itself is pinned (no silently published partial amendment quarters).
const historyRowsCollector = read('scripts/collect-13f-history-rows.mjs');
if (!/lib\/13f-compose\.mjs/.test(historyRowsCollector) || !/parse13fAmendmentMetadata/.test(historyRowsCollector) || !/REVIEW_REQUIRED/.test(historyRowsCollector)) fail('the 13F history lane must classify amendments and fail closed (REVIEW_REQUIRED) via the shared composition policy');
const composePolicy = await import('./lib/13f-compose.mjs');
{
  const bundle = (accession, form, rows, cover) => ({ filing: { accession, form, isAmendment: form.includes('/A') }, rows, cover });
  const originalRows = [{ cusip: '002064030', value: 100, shares: 10 }];
  const addRows = [{ cusip: '02665W108', value: 1106550356, shares: 388 }];
  const composed = composePolicy.composeAmendmentChain([
    bundle('acc-1', '13F-HR', originalRows, { tableEntryTotal: 1, tableValueTotal: 100 }),
    bundle('acc-2', '13F-HR/A', addRows, { tableEntryTotal: 1, tableValueTotal: 1106550356, amendmentType: 'NEW HOLDINGS' })
  ]);
  if (composed.rows.length !== 2 || composed.cover.tableValueTotal !== 1106550456 || composed.cover.tableEntryTotal !== 2) fail('13F composition policy must append NEW HOLDINGS rows and sum the covers');
  if (composed.rowProvenance[1].role !== 'NEW_HOLDINGS_ADD' || composed.rowProvenance[1].accession !== 'acc-2') fail('13F composition policy must tag each composed row with its filing role');
  const restated = composePolicy.composeAmendmentChain([
    bundle('acc-1', '13F-HR', originalRows, { tableEntryTotal: 1, tableValueTotal: 100 }),
    bundle('acc-2', '13F-HR/A', addRows, { tableEntryTotal: 1, tableValueTotal: 1106550356, amendmentType: 'NEW HOLDINGS' }),
    bundle('acc-3', '13F-HR/A', [{ cusip: '999999999', value: 5, shares: 5 }], { tableEntryTotal: 1, tableValueTotal: 5, amendmentType: 'RESTATEMENT' })
  ]);
  if (restated.rows.length !== 1 || restated.rowProvenance[0].role !== 'RESTATEMENT') fail('13F composition policy must replace entirely on a RESTATEMENT');
  let unclassifiedFailed = false;
  try {
    composePolicy.composeAmendmentChain([
      bundle('acc-1', '13F-HR', originalRows, { tableEntryTotal: 1, tableValueTotal: 100 }),
      bundle('acc-4', '13F-HR/A', [{ cusip: 'x', value: 1, shares: 1 }], { tableEntryTotal: 1 })
    ]);
  } catch { unclassifiedFailed = true; }
  if (!unclassifiedFailed) fail('13F composition policy must fail closed on an unclassified amendment');
}
const mastersGate = read('scripts/ci-masters-contract-check.mjs');
if (!/filing-discovery\.json/.test(mastersGate)) fail('masters gate does not consume filing discovery');
const tickerIndexBuilder = read('scripts/build-13f-reference-ticker-index.mjs');
if (!/build-13f-reference-ticker-index\.mjs/.test(workflow) || !/REFERENCE_ONLY_TICKER_LOOKUP/.test(tickerIndexBuilder) || !/Absence from this bounded index does not prove absence/.test(tickerIndexBuilder)) fail('reference-only 13F ticker lookup is not part of the refresh boundary');
console.log(JSON.stringify({ ok: true, fixture13FForms: 4, ownershipEvents: ownershipRows.length, notice: selected.latestSubmission.form, holdings: selected.latestHoldings.form, priorPeriod: selected.priorHoldings.periodOfReport }));
