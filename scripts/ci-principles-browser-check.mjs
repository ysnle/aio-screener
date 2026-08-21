import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESKTOP_PRIMARY_VIEWPORT, DESKTOP_QA_SCOPE } from './desktop-qa-config.mjs';

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
  const page = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
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
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNodeGuides === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesKnowledgeArticles === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesCurrentObservations === 'connected');

  const initial = await page.evaluate(() => ({
    active: document.getElementById('page-principles')?.classList.contains('active'),
    treeSections: document.querySelectorAll('#page-principles .principles-tree-section').length,
    treeGroups: document.querySelectorAll('#page-principles .principles-tree-group').length,
    nodes: document.querySelectorAll('#page-principles .principles-node-card').length,
    evidenceBadges: document.querySelectorAll('#page-principles .principles-node-evidence').length,
    detail: document.querySelector('#page-principles .principles-detail-card')?.textContent || '',
    currentObservationCards: document.querySelectorAll('#page-principles .knowledge-current-observation-card').length,
    currentObservationValues: [...document.querySelectorAll('#page-principles .knowledge-current-observation-value')].map((node) => node.textContent),
    libraryTab: document.querySelector('#page-principles [data-principles-action="view"][data-principles-value="library"]')?.textContent || '',
    defaultLibraryCards: document.querySelectorAll('#page-principles [data-principles-lesson-id]').length,
     hiddenSources: [...document.querySelectorAll('#page-principles .principles-source')].filter((node) => !node.open).length,
     internalStatusVisible: [...document.querySelectorAll('#page-principles .principles-status')].some((node) => node.closest('details')?.open === true),
     explorationPanel: document.querySelectorAll('#page-principles .principles-exploration-panel').length,
     questionPrompts: document.querySelectorAll('#page-principles .principles-chapter-question').length,
     count: document.querySelector('[data-principles-result-count]')?.textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (!initial.active || initial.treeSections !== 7 || initial.treeGroups !== 1 || initial.nodes !== 3 || initial.evidenceBadges !== 0 || !initial.detail.includes('한 문장 정의') || initial.currentObservationCards !== 1 || initial.currentObservationValues.includes('3.625%') || initial.explorationPanel !== 1 || initial.questionPrompts !== 0 || initial.defaultLibraryCards !== 0 || !initial.libraryTab || initial.hiddenSources < 1 || initial.internalStatusVisible || initial.overflow) throw new Error(`learner-first initial contract failed: ${JSON.stringify(initial)}`);

  await page.locator('#page-principles [data-principles-action="toggle-section"][data-principles-value="ai"]').click();
  await page.locator('#page-principles [data-principles-action="toggle-group"][data-principles-value="ai-economics-path"]').click();
  await page.locator('#page-principles [data-principles-action="select-node"][data-principles-value="storage"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-detail-title')?.textContent === '스토리지');
  const selected = await page.evaluate(() => ({
    title: document.querySelector('#page-principles .principles-detail-title')?.textContent || '',
    guideFields: [...document.querySelectorAll('#page-principles .principles-explainer-label')].map((node) => node.textContent),
    connections: document.querySelectorAll('#page-principles .principles-connection-button').length,
    rawInternalText: /REVIEWED_CANDIDATE|REFERENCE_CONNECTED|PS-\d+|TG-C\d+/.test(document.querySelector('#page-principles .principles-detail-card')?.textContent || '')
  }));
  if (!selected.title || selected.guideFields.length < 6 || selected.connections < 1 || selected.rawInternalText) throw new Error(`authored node detail failed: ${JSON.stringify(selected)}`);

  await page.locator('#page-principles .principles-evidence > summary').click();
  await page.locator('#page-principles .principles-analysis-block > summary').click();
  const evidenceOpen = await page.evaluate(() => ({
    links: document.querySelectorAll('#page-principles .principles-detail-card .principles-evidence-link').length,
    claims: document.querySelectorAll('#page-principles .principles-detail-card .principles-analysis-claim').length,
    visibleResearchIds: [...document.querySelectorAll('#page-principles .principles-detail-card')].some((node) => /PS-\d+|TG-C\d+/.test(node.textContent || ''))
  }));
  if (evidenceOpen.links < 1 || evidenceOpen.claims < 1 || evidenceOpen.visibleResearchIds) throw new Error(`collapsed evidence contract failed: ${JSON.stringify(evidenceOpen)}`);

  await page.locator('#page-principles [data-principles-action="mode"][data-principles-value="graph"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles [data-principles-graph-node-count]')?.dataset.principlesGraphNodeCount);
  const graphOneHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  const edgeLabels = await page.locator('#page-principles .principles-edge-label').count();
  await page.locator('#page-principles [data-principles-action="depth"][data-principles-value="2"]').click();
  await page.waitForFunction((previous) => document.querySelector('#page-principles [data-principles-graph-node-count]')?.dataset.principlesGraphNodeCount !== previous, graphOneHop);
  const graphTwoHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  if (graphOneHop === graphTwoHop || edgeLabels < 1) throw new Error(`graph relation contract failed: ${graphOneHop} === ${graphTwoHop}, labels=${edgeLabels}`);

  await page.locator('#page-principles [data-principles-action="mode"][data-principles-value="path"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-path-card').length === 1);
  await page.locator('#page-principles [data-principles-action="view"][data-principles-value="library"]').click();
  await page.locator('#page-principles .principles-library-panel-summary').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles [data-principles-lesson-id]').length === 112);
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-deep-article').length === 112);
  const library = await page.evaluate(() => ({
    chapters: document.querySelectorAll('#page-principles [data-principles-chapter]').length,
    lessons: document.querySelectorAll('#page-principles [data-principles-lesson-id]').length,
    chapterColumns: getComputedStyle(document.querySelector('#page-principles .principles-chapter-grid')).gridTemplateColumns,
    lessonColumns: getComputedStyle(document.querySelector('#page-principles .principles-lesson-library-grid')).gridTemplateColumns,
    deepArticles: document.querySelectorAll('#page-principles .principles-deep-article').length,
    deepBoundary: document.querySelector('.principles-deep-article-boundary')?.textContent || ''
  }));
  await page.locator('#page-principles .principles-deep-article').first().locator('summary').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-deep-lesson .knowledge-lesson-section').length >= 8);
  if (library.chapters !== 15 || library.lessons !== 112 || library.deepArticles !== 112 || !library.deepBoundary.includes('검토')) throw new Error(`library contract failed: ${JSON.stringify(library)}`);

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, scope: DESKTOP_QA_SCOPE, route: 'principles', initial, selected, evidenceOpen, graphOneHop: Number(graphOneHop), graphTwoHop: Number(graphTwoHop), edgeLabels, viewport: DESKTOP_PRIMARY_VIEWPORT, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
