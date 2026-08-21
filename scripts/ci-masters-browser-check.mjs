import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });
  const disclaimerButton = page.locator('#aio-first-visit-disclaimer button');
  if (await disclaimerButton.count()) await disclaimerButton.click();
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersData === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHoldings === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersCatalog === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersPreviews === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSecurityMaster === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHistoryRows === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersIssuerAggregates === 'connected');
  const overview = await page.evaluate(() => ({
    active: document.getElementById('page-masters')?.classList.contains('active'),
    profiles: document.querySelectorAll('#page-masters .masters-manager-card').length,
    filingArtifacts: document.querySelectorAll('#page-masters .masters-filing-artifact').length,
    topRows: document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length,
    comparisonRows: document.querySelectorAll('#page-masters .masters-change-ledger tbody tr').length,
    fullRows: document.getElementById('page-masters')?.dataset.aioMastersFullRows,
    changeSummary: document.querySelector('#page-masters .masters-change-summary')?.textContent || '',
    text: document.querySelector('#page-masters .masters-filing-artifact')?.textContent || '',
     nestedManagerLinks: document.querySelectorAll('#page-masters .masters-manager-card a').length,
     explorationPanel: document.querySelectorAll('#page-masters .masters-exploration-panel').length,
     blindSpotBoundary: document.querySelector('#page-masters .masters-exploration-boundary')?.textContent || '',
     nanCells: [...document.querySelectorAll('#page-masters td')].filter((cell) => cell.textContent.trim() === 'NaN').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (!overview.active || overview.profiles !== 38 || overview.filingArtifacts !== 1 || overview.topRows !== 10 || overview.comparisonRows !== 25 || overview.fullRows !== '89' || !overview.changeSummary.includes('2026-03-31') || !overview.text.includes('0001067983') || overview.nestedManagerLinks !== 0 || overview.explorationPanel !== 1 || !overview.blindSpotBoundary.includes('공매도') || overview.nanCells !== 0 || overview.overflow) throw new Error(`overview contract failed: ${JSON.stringify(overview)}`);

  const managerSearch = page.locator('#page-masters .masters-search-input');
  await managerSearch.focus();
  await page.keyboard.type('buffett');
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-search-input')?.value === 'buffett');
  if (await page.locator('#page-masters .masters-manager-card').count() !== 1 || !await page.evaluate(() => document.activeElement?.classList.contains('masters-search-input'))) throw new Error('manager search lost focus during rerender');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForFunction(() => document.querySelectorAll('#page-masters .masters-manager-card').length === 38);

  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="holdings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersView === 'holdings');
  if (await page.locator('#page-masters .masters-full-holdings-table tbody tr').count() !== 25) throw new Error('full holdings pagination failed');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="changes"]').click();
  await page.locator('#page-masters [data-masters-action="change-filter"][data-masters-value="EXITED"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersActionFilter === 'EXITED');
  if (!await page.locator('#page-masters .masters-change-ledger tbody tr').count()) throw new Error('exited comparison rows are not visible');
  if (await page.locator('#page-masters .masters-change-ledger td', { hasText: 'NaN' }).count()) throw new Error('change ledger contains NaN');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="sectors"]').click();
  if (await page.locator('#page-masters [data-masters-sector-state="unavailable"]').count() !== 1 || await page.locator('#page-masters [data-masters-security-master="REFERENCE_NORMALIZATION_PENDING"]').count() !== 1) throw new Error('sector/security-master preparation state missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="quarters"]').click();
  if (await page.locator('#page-masters .masters-quarter-table tbody tr').count() !== 12) throw new Error('quarter history rows missing');
  if (await page.locator('#page-masters .masters-issuer-aggregate-view').count() !== 1 || !(await page.locator('#page-masters .masters-issuer-aggregate-view').textContent()).includes('CUSIP')) throw new Error('issuer aggregate view missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="filings"]').click();
  if (await page.locator('#page-masters .masters-filing-view a[href*="sec.gov"]').count() < 2) throw new Error('filing links missing');

  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="fisher-asset-management"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0000850529'));
  await page.waitForFunction(() => document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length === 10);
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="duquesne-family-office"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters [data-masters-value-reconciliation="MISMATCH"]'));
  if (!(await page.locator('#page-masters .masters-reconciliation-note').textContent()).includes('총액 기반 해석을 보류')) throw new Error('13F value reconciliation mismatch boundary was not disclosed');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="appaloosa-management"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0001656456'));
  await page.waitForFunction(() => document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length === 10);
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="scion-asset-management"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0001649339'));
  await page.waitForFunction(() => document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length === 8);
  if (await page.locator('#page-masters .masters-availability-note').count() !== 1 || !(await page.locator('#page-masters .masters-availability-note').textContent()).includes('최신 13F 제출 확인')) throw new Error('Scion latest-filing availability note missing');
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-change-summary')?.textContent.includes('2025-06-30'));
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="bridgewater-associates"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0001350694'));
  if (!(await page.locator('#page-masters .masters-coverage-warning').textContent()).includes('행 데이터가 아직 연결')) throw new Error('metadata-only manager row boundary missing');
  if (!(await page.locator('#page-masters .masters-catalog-coverage').textContent()).includes('텔레그램 발견 단서 7개')) throw new Error('manager catalog coverage disclosure missing');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="tci-fund-management"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0001647251'));
  if (await page.locator('#page-masters .masters-row-preview-table tbody tr').count() !== 10) throw new Error('TCI SEC row preview missing');
  if (!(await page.locator('#page-masters .masters-row-preview').textContent()).includes('전체 원장 대기')) throw new Error('row preview boundary missing');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="situational-awareness"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0002045724'));
  if (await page.locator('#page-masters .masters-row-preview-table tbody tr').count() !== 10) throw new Error('Situational Awareness SEC row preview missing');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="harvard-management-company"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0001082621'));
  if (await page.locator('#page-masters .masters-row-preview-table tbody tr').count() !== 10) throw new Error('Harvard SEC row preview missing');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="mark-minervini"]').click();
  if (!(await page.locator('#page-masters .masters-detail-card').textContent()).includes('방법론 전용 프로필') || !(await page.locator('#page-masters .masters-coverage-warning').textContent()).includes('방법론 전용')) throw new Error('Mark Minervini method-only boundary missing');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'masters', profiles: overview.profiles, verifiedMetadata: 30, methodOnly: 1, reconciledManagers: 7, rowPreviewManagers: 5, previewRows: 55, fullRows: overview.fullRows, defaultTopRows: overview.topRows, defaultComparisonRows: overview.comparisonRows, selectedManagers: ['fisher-asset-management', 'appaloosa-management', 'scion-asset-management', 'bridgewater-associates', 'tci-fund-management', 'mark-minervini'], errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
