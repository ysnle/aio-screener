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
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersData === 'partial');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHoldings === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersCatalog === 'connected');
  const overview = await page.evaluate(() => ({
    active: document.getElementById('page-masters')?.classList.contains('active'),
    profiles: document.querySelectorAll('#page-masters .masters-manager-card').length,
    filingArtifacts: document.querySelectorAll('#page-masters .masters-filing-artifact').length,
    topRows: document.querySelectorAll('#page-masters .masters-holdings-section:not(.masters-change-ledger) tbody tr').length,
    comparisonRows: document.querySelectorAll('#page-masters .masters-change-ledger tbody tr').length,
    fullRows: document.getElementById('page-masters')?.dataset.aioMastersFullRows,
    dataState: document.getElementById('page-masters')?.dataset.aioMastersData,
    coverageState: document.getElementById('page-masters')?.dataset.aioMastersCoverageState,
    currentFull: document.getElementById('page-masters')?.dataset.aioMastersCurrentFull,
    staleFull: document.getElementById('page-masters')?.dataset.aioMastersStaleFull,
    previewOnly: document.getElementById('page-masters')?.dataset.aioMastersPreviewOnly,
    metadataOnly: document.getElementById('page-masters')?.dataset.aioMastersMetadataOnly,
    methodOnly: document.getElementById('page-masters')?.dataset.aioMastersMethodOnly,
    officialPrinciples: document.getElementById('page-masters')?.dataset.aioMastersOfficialPrinciples,
    verifiedSecurityRecords: document.getElementById('page-masters')?.dataset.aioMastersVerifiedSecurityRecords,
    latestPeriodMissing: document.getElementById('page-masters')?.dataset.aioMastersLatestPeriodMissing,
    coverageText: document.querySelector('#page-masters .masters-catalog-coverage')?.textContent || '',
    changeSummary: document.querySelector('#page-masters .masters-change-summary')?.textContent || '',
    text: document.querySelector('#page-masters .masters-filing-artifact')?.textContent || '',
     nestedManagerLinks: document.querySelectorAll('#page-masters .masters-manager-card a').length,
     explorationPanel: document.querySelectorAll('#page-masters .masters-exploration-panel').length,
     blindSpotBoundary: document.querySelector('#page-masters .masters-exploration-boundary')?.textContent || '',
     nanCells: [...document.querySelectorAll('#page-masters td')].filter((cell) => cell.textContent.trim() === 'NaN').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  const coverageOk = overview.dataState === 'partial' && overview.coverageState === 'partial' && overview.currentFull === '35' && overview.staleFull === '2' && overview.previewOnly === '0' && overview.metadataOnly === '0' && overview.methodOnly === '1' && overview.officialPrinciples === '2' && overview.verifiedSecurityRecords === '0' && overview.latestPeriodMissing === '2';
  const coverageTextOk = overview.coverageText.includes('현재 분류 38개: 최신 전체 행 35 · 지연 전체 행 2 · 원문 미리보기만 0 · 메타데이터만 0 · 방법론 전용 1') && overview.coverageText.includes('2026-06-30 기준 13F 신고주체 37개 중 2개는 최신분기 전체 행이 연결되지 않았습니다') && overview.coverageText.includes('SEC 온라인 현재성 발견 37/37 · 차단/미완료 0') && overview.coverageText.includes('브라우저 전체 행 원장 무결성 검증 완료') && overview.coverageText.includes('공식 투자 원칙 원고 2/38 · 검증 issuer·ticker·sector master 0개') && overview.coverageText.includes('12분기 심화 이력은 우선순위 7/37개') && overview.coverageText.includes('repository 변수 설정 존재 여부와 같은 뜻이 아닙니다');
  if (!overview.active || overview.profiles !== 38 || overview.filingArtifacts !== 1 || overview.topRows !== 10 || overview.comparisonRows !== 10 || overview.fullRows !== '0' || !coverageOk || !coverageTextOk || !overview.changeSummary.includes('2026-03-31') || !overview.text.includes('0001067983') || overview.nestedManagerLinks !== 0 || overview.explorationPanel !== 1 || !overview.blindSpotBoundary.includes('공매도') || overview.nanCells !== 0 || overview.overflow || await page.locator('#page-masters .masters-exploration-copy', { hasText: 'Top 보유 요약' }).count() !== 1) throw new Error(`overview/deferred-row/coverage contract failed: ${JSON.stringify(overview)}`);

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
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSelectedShard === 'connected');
  if (await page.locator('#page-masters .masters-full-holdings-table tbody tr').count() !== 25) throw new Error('full holdings pagination failed');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="changes"]').click();
  await page.locator('#page-masters [data-masters-action="change-filter"][data-masters-value="EXITED"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersActionFilter === 'EXITED');
  if (!await page.locator('#page-masters .masters-change-ledger tbody tr').count()) throw new Error('exited comparison rows are not visible');
  if (await page.locator('#page-masters .masters-change-ledger td', { hasText: 'NaN' }).count()) throw new Error('change ledger contains NaN');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="sectors"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSecurityMaster === 'connected' && document.getElementById('page-masters')?.dataset.aioMastersReferenceMaster === 'connected');
  if (await page.locator('#page-masters [data-masters-sector-state="unavailable"]').count() !== 1 || await page.locator('#page-masters [data-masters-security-master="REFERENCE_NORMALIZATION_PENDING"]').count() !== 1) throw new Error('sector/security-master preparation state missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="quarters"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHistoryRows === 'connected');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersIssuerAggregates === 'connected');
  if (await page.locator('#page-masters .masters-quarter-table tbody tr').count() !== 12) throw new Error('quarter history rows missing');
  if (await page.locator('#page-masters .masters-issuer-aggregate-view').count() !== 1 || !(await page.locator('#page-masters .masters-issuer-aggregate-view').textContent()).includes('CUSIP')) throw new Error('issuer aggregate view missing');
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="filings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersFilings === 'connected');
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
  const availabilityNote = page.locator('#page-masters .masters-availability-note:not(.masters-ownership-events)');
  if (await availabilityNote.count() !== 1 || !(await availabilityNote.textContent()).includes('최신 13F 제출 확인')) throw new Error('Scion latest-filing availability note missing');
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-change-summary')?.textContent.includes('2025-06-30'));
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="ownership"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersDiscovery === 'connected');
  const ownershipEvents = page.locator('#page-masters .masters-ownership-events');
  if (await ownershipEvents.count() !== 1 || !(await ownershipEvents.textContent()).includes('13D/G는 특정 발행인에 대한 실질 소유권 공시') || !(await ownershipEvents.textContent()).includes('13F 분기 보유행')) throw new Error('Schedule 13D/G ownership-event boundary missing');
  if (!(await page.locator('#page-masters .masters-catalog-coverage').textContent()).includes('텔레그램 발견 단서 7개')) throw new Error('manager catalog coverage disclosure missing');
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="mark-minervini"]').click();
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="principles"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersPrinciples === 'connected');
  if (!(await page.locator('#page-masters .masters-detail-card').textContent()).includes('방법론 전용 프로필') || !(await page.locator('#page-masters .masters-coverage-warning').textContent()).includes('방법론 전용')) throw new Error('Mark Minervini method-only boundary missing');
  if (await page.locator('#page-masters .masters-principle-card').count() < 4 || !(await page.locator('#page-masters .masters-principles-view').textContent()).includes('SEPA')) throw new Error('Mark Minervini official methodology content missing');
  await page.locator('#page-masters [data-masters-action="toggle-compare"]').click();
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="berkshire-hathaway"]').click();
  await page.locator('#page-masters [data-masters-action="toggle-compare"]').click();
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="compare"]').click();
  if (!(await page.locator('#page-masters .masters-compare-view').textContent()).includes('2~4명') || await page.locator('#page-masters .masters-compare-view .masters-metric').count() < 2) throw new Error('2~4 manager comparison surface missing');
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'masters', profiles: overview.profiles, dataState: overview.dataState, coverage: { currentFull: Number(overview.currentFull), staleFull: Number(overview.staleFull), previewOnly: Number(overview.previewOnly), metadataOnly: Number(overview.metadataOnly), methodOnly: Number(overview.methodOnly), latestPeriodMissing: Number(overview.latestPeriodMissing), officialPrinciples: Number(overview.officialPrinciples), verifiedSecurityRecords: Number(overview.verifiedSecurityRecords) }, verifiedMetadata: 37, reconciledManagers: 37, rowPreviewManagers: 0, previewRows: 0, fullRows: overview.fullRows, defaultTopRows: overview.topRows, defaultComparisonRows: overview.comparisonRows, selectedManagers: ['fisher-asset-management', 'duquesne-family-office', 'appaloosa-management', 'scion-asset-management', 'mark-minervini'], errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
