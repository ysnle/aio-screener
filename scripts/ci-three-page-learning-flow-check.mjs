import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_THREE_PAGE_FLOW_PORT || 8912);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[three-page-flow/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

async function dismissDisclaimer(page) {
  const button = page.locator('#aio-first-visit-disclaimer button');
  if (await button.count()) await button.click();
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(`${baseUrl}#principles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.showPage === 'function');
  await dismissDisclaimer(page);
  await page.evaluate(() => window.showPage('principles'));
  await page.waitForSelector('#page-principles .principles-narrative');

  await page.locator('#page-principles [data-principles-action="story-chapter"][data-principles-value="ai-physical-bottleneck"]').click();
  await page.locator('#page-principles .principles-narrative-route').click();
  await page.waitForFunction(() => document.getElementById('page-atlas')?.classList.contains('active') && document.querySelector('#page-atlas .atlas-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-atlas .atlas-learning-detail-title')?.textContent?.includes('GPU'));
  const atlasArrival = await page.evaluate(() => ({
    hash: location.hash,
    mode: new URL(location.href).searchParams.get('mode'),
    node: new URL(location.href).searchParams.get('node'),
    title: document.querySelector('#page-atlas .atlas-learning-detail-title')?.textContent || '',
    arrival: document.querySelector('#page-atlas .atlas-arrival-context')?.textContent || ''
  }));
  if (!atlasArrival.hash.includes('knowledgeNode=compute-gpu') || atlasArrival.mode !== 'taxonomy' || atlasArrival.node !== 'compute-gpu' || !atlasArrival.title.includes('GPU') || !atlasArrival.arrival.includes('시장 원리')) throw new Error(`principles-to-atlas destination failed: ${JSON.stringify(atlasArrival)}`);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await dismissDisclaimer(page);
  await page.waitForFunction(() => document.getElementById('page-atlas')?.classList.contains('active') && document.querySelector('#page-atlas .atlas-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-atlas .atlas-learning-detail-title')?.textContent?.includes('GPU'));
  const atlasReloadPersisted = await page.evaluate(() => new URL(location.href).searchParams.get('node') === 'compute-gpu' && location.hash.includes('knowledgeNode=compute-gpu'));
  if (!atlasReloadPersisted) throw new Error(`atlas destination was not reload-persistent: ${page.url()}`);

  await page.evaluate(() => window.showPage('principles'));
  await page.waitForSelector('#page-principles [data-principles-action="view"][data-principles-value="story"]');
  await page.locator('#page-principles [data-principles-action="view"][data-principles-value="story"]').click();
  await page.locator('#page-principles [data-principles-action="story-chapter"][data-principles-value="market-expectations-prices"]').click();
  await page.locator('#page-principles .principles-narrative-route').click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.classList.contains('active') && document.querySelector('#page-masters .masters-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-detail-tab[aria-pressed="true"]')?.dataset.mastersValue === 'changes');
  const mastersArrival = await page.evaluate(() => ({
    hash: location.hash,
    mode: new URL(location.href).searchParams.get('mode'),
    arrival: document.querySelector('#page-masters .masters-arrival-context')?.textContent || '',
    activeTab: document.querySelector('#page-masters .masters-detail-tab[aria-pressed="true"]')?.textContent || ''
  }));
  if (!mastersArrival.hash.includes('knowledgeNode=institutional-position-change') || mastersArrival.mode !== 'changes' || !mastersArrival.arrival.includes('분기 말의 지연된 스냅샷') || !mastersArrival.activeTab.includes('변화')) throw new Error(`principles-to-masters destination failed: ${JSON.stringify(mastersArrival)}`);

  await page.locator('#page-masters [data-masters-action="route"][data-masters-value="principles"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active') && document.querySelector('#page-principles .principles-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter === 'market-expectations-prices');
  const principlesReturn = await page.evaluate(() => ({
    hash: location.hash,
    chapter: document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter,
    arrival: document.querySelector('#page-principles .principles-arrival-context')?.textContent || ''
  }));
  if (!principlesReturn.hash.includes('knowledgeNode=institutional-position-change') || principlesReturn.chapter !== 'market-expectations-prices' || !principlesReturn.arrival.includes('기관 공시')) throw new Error(`masters-to-principles destination failed: ${JSON.stringify(principlesReturn)}`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await mobile.goto(`${baseUrl}#principles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dismissDisclaimer(mobile);
  await mobile.evaluate(() => window.showPage('principles'));
  await mobile.waitForSelector('#page-principles .principles-narrative-prose p');
  const readingDensity = await mobile.evaluate(() => ({
    lines: [...document.querySelectorAll('#page-principles .principles-narrative-prose p')].map((node) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight))),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    railColumns: getComputedStyle(document.querySelector('#page-principles .principles-narrative-rail')).gridTemplateColumns
  }));
  if (readingDensity.lines.some((lines) => lines < 3 || lines > 6) || readingDensity.horizontalOverflow || readingDensity.railColumns === 'none') throw new Error(`mobile editorial density failed: ${JSON.stringify(readingDensity)}`);
  await mobile.close();

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, atlasArrival, atlasReloadPersisted, mastersArrival, principlesReturn, readingDensity, errors }));
} finally {
  await browser.close();
  server.kill();
}
