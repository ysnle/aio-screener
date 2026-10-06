import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESKTOP_QA_VIEWPORTS } from './desktop-qa-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_THREE_PAGE_FLOW_PORT || 8914);
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
// 2026-10-05 리서치 라이브러리: the column's "이어서 볼 화면" link (right column) carries the reader to the industry
// map and to the 13F page with an arrival context, and the 13F page links back to the column it came from.
const openColumnChapter = async (page, chapter) => {
  await page.evaluate((id) => { history.replaceState(null, '', `?mode=story&chapter=${id}#principles`); }, chapter);
  await page.evaluate(() => window.showPage('principles'));
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active'));
  await page.locator('#page-principles .rl-nav [data-principles-action="group"][data-principles-value="story"]').click().catch(() => {});
  await page.waitForFunction(() => document.querySelector('#page-principles .rl-nav [data-principles-action="story-chapter"]'));
  await page.locator(`#page-principles .rl-nav [data-principles-action="story-chapter"][data-principles-value="${chapter}"]`).click();
  await page.waitForFunction((id) => document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter === id, chapter);
};
try {
  const page = await browser.newPage({ viewport: DESKTOP_QA_VIEWPORTS[1] });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text());
  });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(`${baseUrl}#principles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.showPage === 'function');
  await dismissDisclaimer(page);
  await page.evaluate(() => window.showPage('principles'));
  await page.waitForSelector('#page-principles .rl-shell');

  await openColumnChapter(page, 'ai-physical-bottleneck');
  const nextLink = await page.locator('#page-principles .rl-aside .af-route').first().textContent();
  if (/[A-Z]{3,}_[A-Z]/.test(nextLink) || !nextLink.includes('산업·밸류체인')) throw new Error(`column next-screen link shows an internal code or no destination: ${nextLink}`);
  await page.locator('#page-principles .rl-aside .af-route').first().click();
  await page.waitForFunction(() => document.getElementById('page-atlas')?.classList.contains('active') && document.querySelector('#page-atlas .atlas-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-atlas .af-article')?.dataset.atlasNode === 'compute-gpu');
  const atlasArrival = await page.evaluate(() => ({
    hash: location.hash,
    mode: new URL(location.href).searchParams.get('mode'),
    node: new URL(location.href).searchParams.get('node'),
    title: document.querySelector('#page-atlas .af-article .af-issue')?.textContent || '',
    arrival: document.querySelector('#page-atlas .atlas-arrival-context')?.textContent || ''
  }));
  if (!atlasArrival.hash.includes('knowledgeNode=compute-gpu') || atlasArrival.mode !== 'taxonomy' || atlasArrival.node !== 'compute-gpu' || !atlasArrival.title.includes('GPU') || !atlasArrival.arrival.includes('개념·분석 프레임')) throw new Error(`principles-to-atlas destination failed: ${JSON.stringify(atlasArrival)}`);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await dismissDisclaimer(page);
  await page.waitForFunction(() => document.getElementById('page-atlas')?.classList.contains('active') && document.querySelector('#page-atlas .atlas-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-atlas .af-article')?.dataset.atlasNode === 'compute-gpu');
  const atlasReloadPersisted = await page.evaluate(() => new URL(location.href).searchParams.get('node') === 'compute-gpu' && location.hash.includes('knowledgeNode=compute-gpu'));
  if (!atlasReloadPersisted) throw new Error(`atlas destination was not reload-persistent: ${page.url()}`);

  await openColumnChapter(page, 'market-expectations-prices');
  await page.locator('#page-principles .rl-aside .af-route').first().click();
  await page.waitForFunction(() => document.getElementById('page-masters')?.classList.contains('active') && document.querySelector('#page-masters .masters-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-masters .masters-detail-tab[aria-pressed="true"]')?.dataset.mastersValue === 'changes');
  const mastersArrival = await page.evaluate(() => ({
    hash: location.hash,
    mode: new URL(location.href).searchParams.get('mode'),
    arrival: document.querySelector('#page-masters .masters-arrival-context')?.textContent || '',
    activeTab: document.querySelector('#page-masters .masters-detail-tab[aria-pressed="true"]')?.textContent || ''
  }));
  if (!mastersArrival.hash.includes('knowledgeNode=institutional-position-change') || mastersArrival.mode !== 'changes' || !mastersArrival.arrival.includes('분기 말의 지연된 스냅샷') || !mastersArrival.activeTab.includes('변화')) throw new Error(`principles-to-masters destination failed: ${JSON.stringify(mastersArrival)}`);

  await page.locator('#page-masters [data-masters-action="route"][data-masters-value="principles"]').first().click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active') && document.querySelector('#page-principles .principles-arrival-context'));
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter === 'market-expectations-prices');
  const principlesReturn = await page.evaluate(() => ({
    hash: location.hash,
    chapter: document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter,
    arrival: document.querySelector('#page-principles .principles-arrival-context')?.textContent || ''
  }));
  if (!principlesReturn.hash.includes('knowledgeNode=institutional-position-change') || principlesReturn.chapter !== 'market-expectations-prices' || !principlesReturn.arrival) throw new Error(`masters-to-principles destination failed: ${JSON.stringify(principlesReturn)}`);

  await page.setViewportSize(DESKTOP_QA_VIEWPORTS[0]);
  await page.evaluate(() => window.showPage('principles'));
  await page.waitForSelector('#page-principles .principles-narrative p');
  const readingLayout = await page.evaluate(() => ({
    mainWidth: document.querySelector('#page-principles .rl-main')?.getBoundingClientRect().width || 0,
    navWidth: document.querySelector('#page-principles .rl-nav')?.getBoundingClientRect().width || 0,
    asideWidth: document.querySelector('#page-principles .rl-aside')?.getBoundingClientRect().width || 0,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (readingLayout.mainWidth <= 0 || readingLayout.navWidth <= 0 || readingLayout.asideWidth <= 0 || readingLayout.horizontalOverflow) throw new Error(`desktop three-column layout failed: ${JSON.stringify(readingLayout)}`);

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, atlasArrival, atlasReloadPersisted, mastersArrival, principlesReturn, readingLayout, errors }));
} finally {
  await browser.close();
  server.kill();
}
