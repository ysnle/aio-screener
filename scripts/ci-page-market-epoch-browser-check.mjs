import { chromium } from 'playwright';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
// P1207 follow-through: the expected page/field-check counts are derived from the timeline
// contract instead of being hardcoded. P1207 added `market.^SKEW` to the sentiment page, which
// moved the total from 48 to 49 while this gate still asserted the old literal.
import { PAGE_DATA_TIMELINE_CONTRACTS } from '../src/data/contracts/page-timeline.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_MARKET_EPOCH_TEST_PORT || 8907);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

const server = await startLocalServer(port, { label: 'market-epoch/server' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // Fixed artifact-relative clock tests epoch propagation, not live freshness.
  // The screener browser gate separately advances ten days and asserts stale
  // display/calculation separation; data-lineage owns wall-clock freshness.
  const fixtureEpoch = Date.parse(JSON.parse(readFileSync(resolve(root, 'public-data/screener.json'), 'utf8')).asOf) + 3600000;
  await page.clock.setFixedTime(new Date(fixtureEpoch));
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/net::ERR_FAILED|Failed to load resource|^\[AIO:api\] [\w-]+: warn .* error/.test(message.text())) runtimeErrors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Reconciliation and the bounded screener artifact hydrate independently.
  // Under parallel CI load reconciliation can be ready first, so do not audit
  // the screener epoch until its native state and ranking snapshot are present.
  await page.waitForFunction(() => {
    const screener = window.AIO_ARCH?.getScreenerState?.();
    return window.AIO?.getPageMarketEpochAudit
      && window._serverDataMeta?.reconciliation?.status === 'ready'
      && screener?.rows?.length >= 800
      && screener?.metadata?.ranking?.available === true
      && screener?.metadata?.ranking?.inputVersion === screener?.revision
      && screener?.lastRun?.snapshotId === screener?.snapshotId;
  }, { timeout: 30000 });

  const pageIds = await page.evaluate(() => Object.keys(window.AIO?.PAGE_MARKET_EPOCH_CONTRACT || {}));
  for (const pageId of pageIds) {
    await page.evaluate((id) => { window.showPage(id); }, pageId);
    await page.waitForTimeout(35);
  }
  await page.evaluate(() => { window.showPage('breadth'); });
  await page.waitForTimeout(100);
  const report = await page.evaluate(() => {
    const audit = window.AIO.getPageMarketEpochAudit();
    const headers = [...document.querySelectorAll('.aio-decision-header[data-aio-decision-page]')].map((header) => ({
      pageId: header.getAttribute('data-aio-decision-page'),
      revision: header.getAttribute('data-market-revision'),
      cutEnd: header.getAttribute('data-market-cut-end'),
      epoch: header.querySelector('[data-market-epoch-status]')?.getAttribute('data-market-epoch-status') || null
    }));
    return {
      audit,
      fieldTimeline: window.AIO_ARCH?.getPageDataTimelineAudit?.() || null,
      headers,
      reconciliation: window.AIO.getDataReconciliationStatus(),
      // P1395: the breadth page is a set of dated trend cards over the AIO history artifact; it
      // states its population and never claims an official exchange A/D or McClellan series.
      breadthHistory: (() => {
        const page = document.getElementById('page-breadth');
        return {
          cards: page ? page.querySelectorAll('.trend-card').length : 0,
          // v58.79: the population and not-official lineage moved from a page footnote to the basis line's hover.
          text: `${page?.textContent || ''} ${document.getElementById('breadth-basis')?.title || ''}`
        };
      })()
    };
  });
  if (runtimeErrors.length) throw new Error(`runtime errors: ${runtimeErrors.join(' | ')}`);
  if (report.audit.sharedRevisionCount !== 1) throw new Error(`shared revision count=${report.audit.sharedRevisionCount}`);
  if (report.audit.mismatchedPages.length) throw new Error(`DOM epoch mismatch: ${report.audit.mismatchedPages.join(',')}`);
  const expectedPageCount = Object.keys(PAGE_DATA_TIMELINE_CONTRACTS).length;
  const expectedFieldChecks = Object.values(PAGE_DATA_TIMELINE_CONTRACTS).reduce((total, requirements) => total + requirements.length, 0);
  if (!report.fieldTimeline || report.fieldTimeline.pageCount !== expectedPageCount || report.fieldTimeline.fieldCheckCount !== expectedFieldChecks) {
    throw new Error(`field timeline coverage mismatch (expected ${expectedPageCount}/${expectedFieldChecks}): ${JSON.stringify(report.fieldTimeline)}`);
  }
  const screenerTimeline = report.fieldTimeline.rows.find((row) => row.pageId === 'screener');
  const screenerRequiredFailures = (screenerTimeline?.checks || []).filter((check) => check.required && check.status !== 'PASS');
  if (!screenerTimeline || screenerTimeline.checks.length !== PAGE_DATA_TIMELINE_CONTRACTS.screener.length || screenerRequiredFailures.length) {
    throw new Error(`quant screener timeline mismatch: ${JSON.stringify(screenerTimeline)}`);
  }
  const invalidFieldChecks = report.fieldTimeline.rows.flatMap((row) => row.checks
    .filter((check) => !check.id || !check.status
      || (check.status === 'PASS' && (!check.observedAt || !check.source))
      || (check.direction && check.status === 'PASS' && !check.changeBasis)
      || (check.marketRevision && check.status === 'PASS' && check.revision !== report.audit.sharedRevision)
      || (check.status !== 'PASS' && !check.reason))
    .map((check) => `${row.pageId}:${check.id || 'missing-id'}:${check.status || 'missing-status'}`));
  if (invalidFieldChecks.length) throw new Error(`invalid field lineage checks: ${invalidFieldChecks.join(',')}`);
  const badFieldDom = report.audit.rows.filter((row) => String(row.fieldTimelineStatus).toLowerCase() !== row.domFieldTimelineStatus);
  if (badFieldDom.length) throw new Error(`DOM field timeline mismatch: ${badFieldDom.map((row) => row.pageId).join(',')}`);
  if (report.reconciliation.sourceRevisionMatches !== true) throw new Error('reconciliation source revision mismatch');
  const requiredHeaders = report.headers.filter((header) => pageIds.includes(header.pageId));
  if (requiredHeaders.length !== pageIds.length) throw new Error(`decision headers ${requiredHeaders.length}/${pageIds.length}`);
  const badHeaders = requiredHeaders.filter((header) => header.revision !== report.audit.sharedRevision || !header.cutEnd || !header.epoch);
  if (badHeaders.length) throw new Error(`decision header epoch missing: ${JSON.stringify(badHeaders)}`);
  // v59.51: the S&P 500 card left the board (the index line is drawn beside breadth, not as its own card).
  if (report.breadthHistory.cards !== 9 || !/AIO 미국 관찰 종목|S&P 500 구성 종목/.test(report.breadthHistory.text) || !/거래소·지수 공식 통계가 아닙니다/.test(report.breadthHistory.text) || /McClellan/.test(report.breadthHistory.text)) throw new Error(`breadth board lineage mismatch: ${JSON.stringify({ cards: report.breadthHistory.cards })}`);
  console.log(JSON.stringify({
    ok: true,
    pageCount: pageIds.length,
    sharedRevision: report.audit.sharedRevision,
    cutEnd: report.audit.rows[0]?.cutEnd || null,
    partialPages: report.audit.partialPages,
    blockedPages: report.audit.blockedPages,
    fieldTimelineStatus: report.fieldTimeline.status,
    fieldCheckCount: report.fieldTimeline.fieldCheckCount,
    breadthHistory: report.breadthHistory,
    runtimeErrors: 0
  }));
} finally {
  await closeAll({ browser, server });
}
