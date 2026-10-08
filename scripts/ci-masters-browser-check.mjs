import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Masters browser contract (2026-10-05 리서치 라이브러리 · 운용사·13F): the contents column lists every catalog
// manager under its style, the open manager is the document (metrics → view tabs → tables), and the right column
// carries the style frame, peers and the ticker reverse lookup. The data-state datasets, deferred shard loading,
// fail-closed value reconciliation and the lookup's explicit error/retry state are the behaviours pinned here.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_MASTERS_PORT || 8905);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[masters-browser/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

async function openMasters(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });
  const disclaimerButton = page.locator('#aio-first-visit-disclaimer button');
  if (await disclaimerButton.count()) await disclaimerButton.click();
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await openMasters(page);
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersData === 'partial');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHoldings === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersCatalog === 'connected');
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-detail-card'));
  const overview = await page.evaluate(() => {
    const host = document.getElementById('page-masters');
    const ds = host?.dataset || {};
    return {
      active: host?.classList.contains('active'),
      shell: Boolean(host?.querySelector('.rl-shell .rl-nav') && host.querySelector('.rl-main') && host.querySelector('.rl-aside')),
      managers: host?.querySelectorAll('.rl-nav [data-masters-action="select-manager"]').length || 0,
      styleGroups: host?.querySelectorAll('.rl-nav .rl-nav-title').length || 0,
      // P1488: the change view shows one table — the top-holdings table only when no comparison ledger exists.
      topRows: (host?.querySelectorAll('.masters-holdings-section:not(.masters-change-ledger) tbody tr').length || 0) || (host?.querySelectorAll('.masters-change-ledger tbody tr').length || 0),
      fullRows: ds.aioMastersFullRows,
      coverage: [ds.aioMastersData, ds.aioMastersCoverageState, ds.aioMastersCurrentFull, ds.aioMastersStaleFull, ds.aioMastersPreviewOnly, ds.aioMastersMetadataOnly, ds.aioMastersMethodOnly, ds.aioMastersOfficialPrinciples, ds.aioMastersVerifiedSecurityRecords, ds.aioMastersLatestPeriodMissing].join(','),
      changeSummary: host?.querySelector('.masters-change-summary')?.textContent || '',
      styleAside: host?.querySelector('.rl-aside')?.textContent || '',
      nanCells: [...(host?.querySelectorAll('td') || [])].filter((cell) => cell.textContent.trim() === 'NaN').length,
      devCopy: /tickerReference|crosswalk|artifact|투영|source badge|경계:/.test(host?.textContent || ''),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2
    };
  });
  if (!overview.active || !overview.shell || overview.managers !== 38 || overview.styleGroups < 6 || overview.topRows !== 10 || overview.fullRows !== '0'
    || overview.coverage !== 'partial,partial,35,2,0,0,1,2,0,2' || !overview.changeSummary.includes('2026-03-31') || !/13F로 알 수 없는 것/.test(overview.styleAside)
    || overview.nanCells || overview.devCopy || overview.overflow) throw new Error(`overview contract failed: ${JSON.stringify(overview)}`);

  await page.locator('#page-masters [data-masters-action="style-overview"]').click();
  await page.waitForFunction(() => /돈을 굴리는 방식별로 13F 읽기/.test(document.querySelector('#page-masters .rl-main')?.textContent || ''));
  if (!/13F는 전체 포트폴리오가 아니다/.test(await page.locator('#page-masters .rl-main').textContent())) throw new Error('style overview lost the 13F coverage disclosure');
  await page.locator('#page-masters .rl-nav [data-masters-action="select-manager"][data-masters-value="berkshire-hathaway"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-detail-title')?.textContent.includes('Buffett'));

  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="holdings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersView === 'holdings');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSelectedShard === 'connected');
  if (await page.locator('#page-masters .masters-full-holdings-table tbody tr').count() !== 25) throw new Error('full holdings pagination failed');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="changes"]').click();
  await page.locator('#page-masters [data-masters-action="change-filter"][data-masters-value="EXITED"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersActionFilter === 'EXITED');
  if (!await page.locator('#page-masters .masters-change-ledger tbody tr').count()) throw new Error('exited comparison rows are not visible');
  if (await page.locator('#page-masters .masters-change-ledger td', { hasText: 'NaN' }).count()) throw new Error('change ledger contains NaN');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="sectors"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSecurityMaster === 'connected' && document.getElementById('page-masters')?.dataset.aioMastersReferenceMaster === 'connected');
  // P1488: one sector state per card — the reference classification when it exists, else the unavailable state.
  if (await page.locator('#page-masters .masters-reference-sector-view').count() + await page.locator('#page-masters [data-masters-sector-state="unavailable"]').count() !== 1) throw new Error('sector preparation state missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="quarters"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHistoryRows === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersIssuerAggregates === 'connected');
  if (await page.locator('#page-masters .masters-quarter-table tbody tr').count() !== 12) throw new Error('quarter history rows missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="filings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersFilings === 'connected');
  if (await page.locator('#page-masters .masters-filing-view a[href*="sec.gov"]').count() < 2) throw new Error('filing links missing');

  // Fail closed: an unreconciled cover total withholds every totals-based reading.
  await page.locator('#page-masters .rl-nav [data-masters-action="select-manager"][data-masters-value="duquesne-family-office"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-detail-title')?.textContent.includes('Druckenmiller'));
  const mismatch = await page.evaluate(() => ({
    note: document.querySelector('#page-masters .masters-detail-card .masters-note')?.textContent || '',
    total: [...document.querySelectorAll('#page-masters .masters-metric')].find((metric) => metric.textContent.includes('신고 가치 합계'))?.textContent || ''
  }));
  if (!mismatch.note.includes('총액 기반 해석을 보류') || !mismatch.total.includes('보류')) throw new Error(`13F value reconciliation mismatch was not withheld: ${JSON.stringify(mismatch)}`);
  for (const [id, rows] of [['fisher-asset-management', 10], ['appaloosa-management', 10], ['scion-asset-management', 8]]) {
    await page.locator(`#page-masters .rl-nav [data-masters-action="select-manager"][data-masters-value="${id}"]`).click();
    await page.locator('#page-masters [data-masters-action="view"][data-masters-value="changes"]').click();
    // P1488: the change view renders one table (top holdings, or the comparison ledger when it exists).
    await page.waitForFunction((want) => (document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length || document.querySelectorAll('#page-masters .masters-change-ledger tbody tr').length) === want, rows);
  }
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-change-summary')?.textContent.includes('2025-06-30'));
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="ownership"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersDiscovery === 'connected');
  if (!(await page.locator('#page-masters .masters-ownership-events').textContent()).includes('13D')) throw new Error('Schedule 13D/G ownership view missing');
  await page.locator('#page-masters .rl-nav [data-masters-action="select-manager"][data-masters-value="mark-minervini"]').click();
  // P1488: method-only profiles open straight on their principles (no 13F tabs).
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersPrinciples === 'connected');
  if (!(await page.locator('#page-masters .masters-detail-card').textContent()).includes('방법론 전용 프로필')) throw new Error('Mark Minervini method-only profile missing');
  if (await page.locator('#page-masters .masters-principle-card').count() < 4 || !(await page.locator('#page-masters .masters-principles-view').textContent()).includes('SEPA')) throw new Error('Mark Minervini official methodology content missing');
  // P1488: a method-only profile has no 13F to compare — the comparison uses two filers.
  if (await page.locator('#page-masters [data-masters-action="toggle-compare"]').count()) throw new Error('method-only profile still offers 13F comparison');
  for (const id of ['fisher-asset-management', 'berkshire-hathaway']) {
    await page.locator(`#page-masters .rl-nav [data-masters-action="select-manager"][data-masters-value="${id}"]`).click();
    await page.locator('#page-masters [data-masters-action="toggle-compare"]').click();
  }
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="compare"]').click();
  if (await page.locator('#page-masters .masters-compare-view .masters-metric').count() < 2) throw new Error('manager comparison surface missing');

  // P1325: manager list renders before the lookup; the lookup never ends in an endless loading state.
  const order = await page.evaluate(() => {
    const shell = document.querySelector('#page-masters .rl-shell');
    const nav = shell?.querySelector('.rl-nav');
    const lookup = shell?.querySelector('.masters-ticker-lookup');
    return Boolean(nav && lookup && (nav.compareDocumentPosition(lookup) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  if (!order) throw new Error('P1325 manager list must render before the ticker lookup');
  const lookupStates = {};
  for (const [symbol, expect] of [['NVDA', 'holder'], ['AAPL', 'holder'], ['ZZZZ', 'none']]) {
    await page.locator('#page-masters .masters-ticker-lookup-input').fill(symbol);
    await page.waitForFunction((want) => {
      const box = document.querySelector('#page-masters .masters-ticker-lookup-results');
      if (!box || /불러오는 중/.test(box.textContent)) return false;
      return want === 'holder' ? !!box.querySelector('.masters-ticker-lookup-card') : /찾지 못했습니다/.test(box.textContent) /* P1488 reader copy */;
    }, expect, { timeout: 5000 });
    lookupStates[symbol] = expect;
  }
  const failPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await failPage.route('**/*', (route) => { const url = route.request().url(); return url.startsWith(`http://127.0.0.1:${port}/`) && !url.includes('ticker-index-reference') ? route.continue() : route.abort(); });
    await openMasters(failPage);
    // P1330: the ledger loads on first focus, not at mount.
    await failPage.locator('#page-masters [data-masters-action="ticker-search"]').first().focus();
    await failPage.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersTickerIndex === 'fallback', { timeout: 12000 });
    const failText = await failPage.locator('#page-masters .masters-ticker-lookup-results').textContent();
    if (/불러오는 중/.test(failText) || !failText.includes('불러오지 못했습니다') || await failPage.locator('#page-masters .masters-ticker-lookup-retry').count() !== 1) throw new Error('P1325 failed ticker ledger did not end in an explicit retryable error state');
  } finally {
    await failPage.close();
  }
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'masters', managers: overview.managers, styleGroups: overview.styleGroups, lookupStates, coverage: overview.coverage }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
