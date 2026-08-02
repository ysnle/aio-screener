import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ATLAS_PORT || 8904);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[atlas-browser/server] ${data}`));
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
  await page.evaluate(() => window.AIO_ARCH.navigate('atlas'));
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioArchitectureRoute === 'atlas');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasResearch === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasFoundations === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasFoundationLessons === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasDomainGuides === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasRegistry === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasTelegram === 'connected');
  const overview = await page.evaluate(() => ({
    active: document.getElementById('page-atlas')?.classList.contains('active'),
    packets: document.querySelectorAll('#page-atlas .atlas-packet-card').length,
    claims: document.querySelectorAll('#page-atlas .atlas-claim-card').length,
    sources: document.querySelectorAll('#page-atlas .atlas-source-card').length,
    telegramChannels: document.querySelectorAll('#page-atlas [data-atlas-telegram-channel]').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (!overview.active || overview.packets !== 11 || overview.claims !== 14 || overview.sources !== 23 || overview.telegramChannels !== 5 || overview.overflow) throw new Error(`overview contract failed: ${JSON.stringify(overview)}`);

  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="foundations"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-track-card').length === 7);
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-curriculum-layer-card').length === 7 && document.querySelectorAll('#page-atlas .atlas-curriculum-module-card').length === 48 && document.querySelectorAll('#page-atlas .atlas-module-lesson').length === 48 && document.querySelectorAll('#page-atlas .atlas-module-authored').length === 48 && document.querySelectorAll('#page-atlas .atlas-module-question').length === 48 && document.querySelectorAll('#page-atlas .atlas-module-visualization').length === 48 && document.querySelectorAll('#page-atlas .atlas-module-lesson[data-atlas-foundation-id]').length === 48);
  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="taxonomy"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-level-card').length === 7);
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-domain-card').length === 19 && document.querySelectorAll('#page-atlas .atlas-domain-guide').length === 19 && document.querySelectorAll('#page-atlas .atlas-domain-claim-ledger').length === 19 && document.querySelectorAll('#page-atlas .atlas-domain-node').length === 95 && document.querySelectorAll('#page-atlas .atlas-coverage-card').length === 95 && document.querySelectorAll('#page-atlas .atlas-node-guide-risk').length === 95 && document.querySelectorAll('#page-atlas .atlas-player-product-map').length > 0 && document.querySelectorAll('#page-atlas [data-atlas-player-id]').length > 0 && document.querySelectorAll('#page-atlas [data-atlas-product-id]').length > 0 && document.querySelectorAll('#page-atlas .atlas-reference-source-link').length > 0 && document.querySelector('#page-atlas a[data-atlas-domain-guide-source="domain-compute-silicon"]')?.href === 'https://science.osti.gov/ascr' && document.querySelector('#page-atlas a[data-atlas-source-id="PP-13"]')?.href === 'https://www.tesla.com/AI');

  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="overview"]').click();
  const search = page.locator('#page-atlas .atlas-search-input');
  await search.fill('CPO');
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-packet-card').length === 1 && document.querySelector('#page-atlas [data-atlas-packet-id]')?.dataset.atlasPacketId === 'ATLAS-04');
  await search.fill('');
  await page.locator('#page-atlas [data-atlas-action="route"][data-atlas-value="principles"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active'));
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'atlas', overviewPackets: overview.packets, evidenceClaims: overview.claims, primarySources: overview.sources, telegramChannels: overview.telegramChannels, foundationTracks: 7, curriculumLayers: 7, curriculumModules: 48, authoredLessons: 48, taxonomyLevels: 7, taxonomyDomains: 19, domainGuides: 19, structuralClaims: 57, taxonomyNodes: 95, taxonomyCoverageCards: 95, searchedPacket: 'ATLAS-04', routeCta: 'principles', errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
