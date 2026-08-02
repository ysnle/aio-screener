import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_PRINCIPLES_PORT || 8906);
const baseUrl = `http://127.0.0.1:${port}/index.html`;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[principles-browser/server] ${data}`));
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
  await page.evaluate(() => window.AIO_ARCH.navigate('principles'));
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesResearch === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesChapters === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesLessonLibrary === 'connected');
  const initial = await page.evaluate(() => ({
    active: document.getElementById('page-principles')?.classList.contains('active'),
    nodes: document.querySelectorAll('#page-principles .principles-node-card').length,
    evidenceBadges: document.querySelectorAll('#page-principles .principles-node-evidence').length,
    evidenceLinks: document.querySelectorAll('#page-principles .principles-evidence-link').length,
    analysisBlocks: document.querySelectorAll('#page-principles .principles-analysis-block').length,
    analysisClaims: document.querySelectorAll('#page-principles .principles-analysis-claim').length,
    chapterCards: document.querySelectorAll('#page-principles .principles-chapter-card').length,
    authoredChapterCards: document.querySelectorAll('#page-principles [data-principles-chapter]').length,
    authoredLessonCards: document.querySelectorAll('#page-principles [data-principles-lesson-id]').length,
    count: document.querySelector('[data-principles-result-count]')?.textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (!initial.active || initial.nodes < 41 || initial.evidenceBadges !== initial.nodes || initial.evidenceLinks < 1 || initial.analysisBlocks !== 1 || initial.analysisClaims < 1 || initial.chapterCards !== 15 || initial.authoredChapterCards !== 15 || initial.authoredLessonCards !== 111 || !initial.count.includes('23 sources') || initial.overflow) throw new Error(`initial contract failed: ${JSON.stringify(initial)}`);

  await page.locator('#page-principles [data-principles-action="select-node"][data-principles-value="storage"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-detail-title')?.textContent?.length > 0);
  const selected = await page.evaluate(() => ({
    title: document.querySelector('#page-principles .principles-detail-title')?.textContent || '',
    links: [...document.querySelectorAll('#page-principles .principles-detail-card .principles-evidence-link')].map((node) => node.textContent),
    analysisText: document.querySelector('#page-principles .principles-analysis-block')?.textContent || '',
    observations: document.querySelectorAll('#page-principles .principles-analysis-observations li').length
  }));
  if (!selected.title || !selected.links.includes('PS-02') || !selected.links.includes('PS-03') || !selected.analysisText.includes('TG-C08') || selected.observations < 1) throw new Error(`selected node analysis failed: ${JSON.stringify(selected)}`);

  await page.locator('#page-principles [data-principles-action="mode"][data-principles-value="graph"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles [data-principles-graph-node-count]')?.dataset.principlesGraphNodeCount);
  const graphOneHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  await page.locator('#page-principles [data-principles-action="depth"][data-principles-value="2"]').click();
  await page.waitForFunction((previous) => document.querySelector('#page-principles [data-principles-graph-node-count]')?.dataset.principlesGraphNodeCount !== previous, graphOneHop);
  const graphTwoHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  if (graphOneHop === graphTwoHop) throw new Error(`graph hop contract failed: ${graphOneHop} === ${graphTwoHop}`);

  await page.locator('#page-principles [data-principles-action="mode"][data-principles-value="path"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-path-card .principles-evidence-link').length > 0);
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'principles', nodes: initial.nodes, evidenceBadges: initial.evidenceBadges, initialEvidenceLinks: initial.evidenceLinks, analysisBlocks: initial.analysisBlocks, analysisClaims: initial.analysisClaims, authoredChapters: initial.authoredChapterCards, authoredLessonCards: initial.authoredLessonCards, selectedNode: selected.title, selectedEvidence: selected.links, selectedAnalysisClaim: 'TG-C08', selectedObservations: selected.observations, graphOneHop: Number(graphOneHop), graphTwoHop: Number(graphTwoHop), pathEvidenceConnected: true, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
