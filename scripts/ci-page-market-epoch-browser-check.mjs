import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_MARKET_EPOCH_TEST_PORT || 8907);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', (data) => {
      if (!ready && String(data).includes('AIO local server')) {
        ready = true;
        resolveServer(child);
      }
    });
    child.stderr.on('data', (data) => process.stderr.write(`[market-epoch/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(() => { if (!ready) { ready = true; resolveServer(child); } }, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
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
      breadthHistory: (() => {
        const summary = document.querySelector('#breadth-mcclellan-summary');
        const diagnostic = document.querySelector('#breadth-diag-text');
        return {
          summary: summary?.textContent?.trim() || '',
          signal: summary?.getAttribute('data-mcclellan-signal') || null,
          sourceKind: summary?.getAttribute('data-source-kind') || null,
          sourceLabel: summary?.getAttribute('data-source-label') || null,
          diagnostic: diagnostic?.textContent?.trim() || ''
        };
      })()
    };
  });
  if (runtimeErrors.length) throw new Error(`runtime errors: ${runtimeErrors.join(' | ')}`);
  if (report.audit.sharedRevisionCount !== 1) throw new Error(`shared revision count=${report.audit.sharedRevisionCount}`);
  if (report.audit.mismatchedPages.length) throw new Error(`DOM epoch mismatch: ${report.audit.mismatchedPages.join(',')}`);
  if (!report.fieldTimeline || report.fieldTimeline.pageCount !== 16 || report.fieldTimeline.fieldCheckCount !== 48) {
    throw new Error(`field timeline coverage mismatch: ${JSON.stringify(report.fieldTimeline)}`);
  }
  const screenerTimeline = report.fieldTimeline.rows.find((row) => row.pageId === 'screener');
  const screenerRequiredFailures = (screenerTimeline?.checks || []).filter((check) => check.required && check.status !== 'PASS');
  if (!screenerTimeline || screenerTimeline.checks.length !== 6 || screenerRequiredFailures.length) {
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
  if (!/AIO 50일선 참여도 \d+일 이력/.test(report.breadthHistory.summary) || !/공식 McClellan 아님/.test(report.breadthHistory.summary)) throw new Error(`breadth history summary mismatch: ${JSON.stringify(report.breadthHistory)}`);
  if (report.breadthHistory.signal !== 'aio-history-not-mcclellan' || report.breadthHistory.sourceKind !== 'derived-research' || !/AIO US screener universe/.test(report.breadthHistory.sourceLabel || '')) throw new Error(`breadth history lineage mismatch: ${JSON.stringify(report.breadthHistory)}`);
  if (!/동일 AIO 유니버스 \d+일 이력/.test(report.breadthHistory.diagnostic) || !/공식 거래소 A\/D·McClellan/.test(report.breadthHistory.diagnostic)) throw new Error(`breadth history diagnostic mismatch: ${JSON.stringify(report.breadthHistory)}`);
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
  await browser.close();
  server.kill();
}
