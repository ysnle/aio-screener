import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_THREE_PAGE_BUDGET_PORT || 8938);
const origin = `http://127.0.0.1:${port}`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const done = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) done(); });
    child.stderr.on('data', (data) => process.stderr.write(`[three-page-budget/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(done, 2000);
  });
}

const fileSize = async (pathname) => (await fs.stat(resolve(root, `.${decodeURIComponent(pathname)}`))).size;
async function summarize(urls, predicate) {
  const paths = [...new Set(urls.map((value) => new URL(value).pathname).filter(predicate))];
  const sizes = await Promise.all(paths.map(fileSize));
  return { paths, bytes: sizes.reduce((total, value) => total + value, 0) };
}
const assertBudget = (summary, limit, label) => {
  if (summary.bytes > limit) throw new Error(`${label} exceeded ${limit} bytes: ${JSON.stringify(summary)}`);
};

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let requests = [];
  page.on('request', (request) => {
    if (request.url().startsWith(origin) && new URL(request.url()).pathname.endsWith('.json')) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route('**/*', (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH?.navigate === 'function', { timeout: 30000 });
  const disclaimer = page.locator('#aio-first-visit-disclaimer button');
  if (await disclaimer.count()) await disclaimer.click();

  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
  await page.waitForFunction(() => ['partial', 'complete'].includes(document.getElementById('page-masters')?.dataset.aioMastersData) && document.getElementById('page-masters')?.dataset.aioMastersSelectedShard === 'deferred');
  const mastersInitial = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  assertBudget(mastersInitial, 500_000, 'Masters initial artifacts');
  if (mastersInitial.paths.some((path) => /\/(?:holdings|history-holdings|issuer-aggregates)\.json$/.test(path))) throw new Error(`Masters requested a canonical monolith: ${JSON.stringify(mastersInitial.paths)}`);
  if (mastersInitial.paths.some((path) => path.startsWith('/public-data/masters/managers/'))) throw new Error(`Masters loaded full manager rows before an explicit full-row view: ${JSON.stringify(mastersInitial.paths)}`);
  requests = [];
  await page.locator('#page-masters [data-masters-action="ticker-search"]').fill('AAPL');
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersTickerIndex === 'connected' && document.querySelector('#page-masters [data-ticker-reference="AAPL"]'));
  const mastersTickerLookup = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  if (mastersTickerLookup.paths.length !== 1 || mastersTickerLookup.paths[0] !== '/public-data/masters/ticker-index-reference.json' || mastersTickerLookup.bytes > 200_000) throw new Error(`Masters reference-only ticker lookup contract failed: ${JSON.stringify(mastersTickerLookup)}`);
  const tickerLookupText = await page.locator('#page-masters [data-masters-ticker-lookup="reference-only"]').textContent();
  if (!tickerLookupText.includes('tickerReference is not SEC-provided') || !tickerLookupText.includes('현재 보유·실시간 매매')) throw new Error('Masters ticker lookup boundary is not visible');
  requests = [];
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="fisher-asset-management"]').click();
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-filing-artifact')?.textContent.includes('0000850529'));
  const mastersSelection = await summarize(requests, (path) => path.startsWith('/public-data/objects/masters/'));
  if (mastersSelection.paths.length) throw new Error(`Masters profile selection loaded a full manager shard: ${JSON.stringify(mastersSelection.paths)}`);
  requests = [];
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="ownership"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersDiscovery === 'connected');
  const mastersOwnership = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  if (mastersOwnership.paths.length !== 1 || mastersOwnership.paths[0] !== '/public-data/masters/filing-discovery.json' || mastersOwnership.bytes > 400_000) throw new Error(`Masters ownership lazy artifact contract failed: ${JSON.stringify(mastersOwnership)}`);
  requests = [];
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="filings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersFilings === 'connected');
  const mastersFilings = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  if (mastersFilings.paths.length !== 1 || mastersFilings.paths[0] !== '/public-data/masters/filings.json' || mastersFilings.bytes > 400_000) throw new Error(`Masters filings lazy artifact contract failed: ${JSON.stringify(mastersFilings)}`);
  requests = [];
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="principles"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersPrinciples === 'connected');
  const mastersPrinciples = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  if (mastersPrinciples.paths.length !== 1 || mastersPrinciples.paths[0] !== '/public-data/masters/manager-principles.json' || mastersPrinciples.bytes > 10_000) throw new Error(`Masters principles lazy artifact contract failed: ${JSON.stringify(mastersPrinciples)}`);
  await page.locator('#page-masters [data-masters-action="select-manager"][data-masters-value="berkshire-hathaway"]').click();
  requests = [];
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="holdings"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersSelectedShard === 'connected');
  const mastersFullRows = await summarize(requests, (path) => path.startsWith('/public-data/objects/masters/'));
  if (mastersFullRows.paths.length !== 1 || !/\/public-data\/objects\/masters\/[a-f0-9]{64}\.json$/.test(mastersFullRows.paths[0]) || mastersFullRows.bytes > 512 * 1024) throw new Error(`Masters bounded content-addressed projection contract failed: ${JSON.stringify(mastersFullRows)}`);
  requests = [];
  await page.locator('#page-masters [data-masters-action="view"][data-masters-value="quarters"]').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.dataset.aioMastersHistoryRows === 'connected');
  const mastersQuarter = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  assertBudget(mastersQuarter, 200_000, 'Masters selected-manager quarter artifacts');
  if (mastersQuarter.paths.some((path) => /\/(?:history-holdings|issuer-aggregates)\.json$/.test(path))) throw new Error(`Masters quarter view requested a canonical monolith: ${JSON.stringify(mastersQuarter.paths)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('screener'));
  await page.waitForFunction(() => document.getElementById('page-screener')?.classList.contains('active'));
  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
  await page.waitForFunction(() => ['partial', 'complete'].includes(document.getElementById('page-masters')?.dataset.aioMastersData));
  const mastersReentry = await summarize(requests, (path) => path.startsWith('/public-data/masters/'));
  if (mastersReentry.paths.length) throw new Error(`Masters re-entry repeated cached artifacts: ${JSON.stringify(mastersReentry.paths)}`);

  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('principles'));
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNarrative === 'connected');
  const principlesInitial = await summarize(requests, (path) => /\/public-data\/(?:principles|knowledge|atlas\/source-packets)/.test(path));
  assertBudget(principlesInitial, 120_000, 'Principles narrative-first artifacts');
  if (!principlesInitial.paths.includes('/public-data/principles/narrative-journey.json') || principlesInitial.paths.some((path) => /(?:lesson-library|node-guides|source-packets|current-observations)\.json$/.test(path))) throw new Error(`Principles initial route crossed the narrative boundary: ${JSON.stringify(principlesInitial.paths)}`);
  requests = [];
  await page.locator('#page-principles [data-principles-action="view"][data-principles-value="library"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesLessonLibrary === 'connected');
  const principlesLibrary = await summarize(requests, (path) => /\/public-data\/(?:principles|knowledge)/.test(path));
  assertBudget(principlesLibrary, 1_600_000, 'Principles library artifacts');
  if (principlesLibrary.paths.includes('/public-data/knowledge/articles.json') || principlesLibrary.paths.some((path) => /(?:research-dossiers|coverage-matrix|claims)\.json$/.test(path))) throw new Error(`Principles library requested completion monoliths: ${JSON.stringify(principlesLibrary.paths)}`);
  await page.locator('#page-principles .principles-library-panel-summary').nth(1).click();
  requests = [];
  await page.locator('#page-principles [data-principles-action="load-article"]').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-deep-article').length === 1);
  const principlesArticle = await summarize(requests, (path) => path.startsWith('/public-data/knowledge/articles/principles/'));
  if (principlesArticle.paths.length !== 1 || principlesArticle.bytes > 60_000) throw new Error(`Principles article shard contract failed: ${JSON.stringify(principlesArticle)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('principles'));
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNarrative === 'connected');
  const principlesReentry = await summarize(requests, (path) => /\/public-data\/(?:principles|knowledge|atlas\/source-packets)/.test(path));
  if (principlesReentry.paths.length) throw new Error(`Principles re-entry repeated cached artifacts: ${JSON.stringify(principlesReentry.paths)}`);

  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('atlas'));
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasFoundationLessons === 'connected');
  const atlasInitial = await summarize(requests, (path) => /\/public-data\/(?:atlas|knowledge)/.test(path));
  assertBudget(atlasInitial, 800_000, 'Atlas foundations artifacts');
  if (atlasInitial.paths.includes('/public-data/knowledge/articles.json')) throw new Error('Atlas initial route requested the article monolith');
  requests = [];
  await page.locator('#page-atlas [data-atlas-action="load-article"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-deep-lesson').length === 1);
  const atlasArticle = await summarize(requests, (path) => path.startsWith('/public-data/knowledge/articles/atlas-foundations/'));
  if (atlasArticle.paths.length !== 1 || atlasArticle.bytes > 80_000) throw new Error(`Atlas article shard contract failed: ${JSON.stringify(atlasArticle)}`);
  requests = [];
  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="overview"]').click();
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasKnowledgeStatus === 'connected');
  const atlasOverview = await summarize(requests, (path) => /\/public-data\/(?:atlas|knowledge)/.test(path));
  assertBudget(atlasOverview, 250_000, 'Atlas overview artifacts');
  if (atlasOverview.paths.some((path) => /(?:articles|research-dossiers|domain-dossiers|coverage-matrix|claims)\.json$/.test(path))) throw new Error(`Atlas overview requested completion monoliths: ${JSON.stringify(atlasOverview.paths)}`);
  await page.evaluate(() => window.AIO_ARCH.navigate('masters'));
  requests = [];
  await page.evaluate(() => window.AIO_ARCH.navigate('atlas'));
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasFoundationLessons === 'connected');
  const atlasReentry = await summarize(requests, (path) => /\/public-data\/(?:atlas|knowledge)/.test(path));
  if (atlasReentry.paths.length) throw new Error(`Atlas re-entry repeated cached artifacts: ${JSON.stringify(atlasReentry.paths)}`);

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, mastersInitial, mastersTickerLookup, mastersSelection, mastersOwnership, mastersFilings, mastersPrinciples, mastersFullRows, mastersQuarter, mastersReentry, principlesInitial, principlesLibrary, principlesArticle, principlesReentry, atlasInitial, atlasArticle, atlasOverview, atlasReentry }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
