import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESKTOP_PRIMARY_VIEWPORT, DESKTOP_QA_SCOPE } from './desktop-qa-config.mjs';

// Principles browser contract (2026-10-05 리서치 라이브러리 · 개념·분석 프레임): one contents·document·connections
// shell with five reading groups (분석 노트 · 칼럼 · 개념 사전 · 원리 레슨 · 개념 지도). Pinned here: the default
// analysis note, deep links into every group, the long-form reading text, lazy loads with an explicit failure and
// retry, the concept-map depth contract, unified search, cross-route bridges and the absence of internal copy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_PRINCIPLES_PORT || 8906);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const INTERNAL_COPY = /REVIEWED_CANDIDATE|REFERENCE_CONNECTED|PS-\d+|TG-C\d+|출처|검토 질문|체크포인트|근거는 항목별 표시|텔레그램은 발견용/;

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

async function openApp(page, query = '') {
  await page.goto(`${baseUrl}${query}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });
  const disclaimerButton = page.locator('#aio-first-visit-disclaimer button');
  if (await disclaimerButton.count()) await disclaimerButton.click();
}

const docText = (page) => page.evaluate(() => document.querySelector('#page-principles .rl-main')?.textContent || '');
const group = (page, id) => page.locator(`#page-principles .rl-nav [data-principles-action="group"][data-principles-value="${id}"]`);

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text()); });
};
try {
  const page = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
  watch(page);
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await openApp(page);
  await page.evaluate(() => window.AIO_ARCH.navigate('principles'));

  // Default: the first analysis note, written as a research note with a worked figure and its connections.
  await page.waitForFunction(() => document.querySelector('#page-principles .rl-shell [data-principles-view="frames"] .af-issue, #page-principles .rl-shell .af-article .af-issue'));
  const frames = await page.evaluate(() => {
    const host = document.getElementById('page-principles');
    return {
      shell: Boolean(host.querySelector('.rl-nav') && host.querySelector('.rl-main') && host.querySelector('.rl-aside')),
      view: host.querySelector('.rl-shell')?.dataset.principlesView,
      groups: [...host.querySelectorAll('.rl-nav [data-principles-action="group"]')].map((node) => node.dataset.principlesValue),
      noteLinks: host.querySelectorAll('.rl-nav [data-principles-action="frame"]').length,
      paragraphs: host.querySelectorAll('.rl-main .af-prose p').length,
      connections: host.querySelectorAll('.rl-aside .af-route').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2
    };
  });
  if (!frames.shell || frames.view !== 'frames' || frames.groups.join(',') !== 'frames,story,concept,lesson,map' || frames.noteLinks < 20 || frames.paragraphs < 2 || frames.connections < 1 || frames.overflow) throw new Error(`analysis note default view incomplete: ${JSON.stringify(frames)}`);
  if (INTERNAL_COPY.test(await page.locator('#page-principles .rl-shell').textContent())) throw new Error('analysis note view shows internal/source copy');

  // Column: lazy narrative, chapter pager, URL state.
  await group(page, 'story').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNarrative === 'connected');
  await page.locator('#page-principles .rl-nav [data-principles-action="story-chapter"][data-principles-value="money-is-choice"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNarrative === 'connected' && document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter);
  const column = await page.evaluate(() => ({ chapter: document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter, chapters: document.querySelectorAll('#page-principles .rl-nav [data-principles-action="story-chapter"]').length }));
  if (column.chapter !== 'money-is-choice' || column.chapters !== 12) throw new Error(`column view incomplete: ${JSON.stringify(column)}`);
  await page.locator('#page-principles .rl-nav [data-principles-action="story-chapter"][data-principles-value="inflation-purchasing-power"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter === 'inflation-purchasing-power' && new URL(location.href).searchParams.get('chapter') === 'inflation-purchasing-power');

  // Dictionary: definition box plus lazily loaded reading text.
  await group(page, 'concept').click();
  await page.locator('#page-principles .rl-nav [data-principles-action="concept"][data-principles-value="cap-rate"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles [data-concept-doc="cap-rate"] .af-definition') && document.querySelector('#page-principles [data-concept-doc="cap-rate"] .af-twist'));
  if (new URL(page.url()).searchParams.get('node') !== 'cap-rate') throw new Error('dictionary entry was not serialized');

  // Lessons: a failed library load ends in a stated failure with retry, then the reading text renders.
  const libraryPattern = '**/public-data/principles/lesson-library.json';
  await page.route(libraryPattern, (route) => route.abort());
  await group(page, 'lesson').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-capability-errors[role="alert"] [data-principles-action="retry-capability"][data-principles-value="lessonLibrary"]'));
  await page.unroute(libraryPattern);
  await page.locator('#page-principles .principles-capability-errors [data-principles-action="retry-capability"][data-principles-value="lessonLibrary"]').first().click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesLessonLibrary === 'connected' && document.querySelectorAll('#page-principles .rl-nav [data-principles-action="select-lesson"]').length === 112);
  await page.locator('#page-principles .rl-nav [data-principles-action="select-lesson"][data-principles-value="D6"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles [data-principles-lesson-id="D6"] .af-twist'));
  const lesson = await page.evaluate(() => ({ paragraphs: document.querySelectorAll('#page-principles [data-principles-lesson-id="D6"] .af-prose p').length, lead: document.querySelector('#page-principles [data-principles-lesson-id="D6"] .af-lead')?.textContent || '', url: new URL(location.href).searchParams.get('lesson') }));
  if (lesson.paragraphs < 2 || lesson.lead.length < 60 || lesson.url !== 'D6') throw new Error(`lesson reading text incomplete: ${JSON.stringify(lesson)}`);
  if (INTERNAL_COPY.test(await docText(page))) throw new Error('lesson view shows internal/source copy');

  // Concept map: real selected subgraph, depth widens it, relation labels and a keyboard-readable node list.
  await group(page, 'map').click();
  await page.locator('#page-principles .rl-nav [data-principles-action="mode"][data-principles-value="graph"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles [data-principles-graph-node-count]'));
  const oneHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  const edgeLabels = await page.locator('#page-principles .principles-edge-label').count();
  await page.locator('#page-principles [data-principles-action="depth"][data-principles-value="2"]').click();
  await page.waitForFunction((previous) => document.querySelector('#page-principles [data-principles-graph-node-count]')?.dataset.principlesGraphNodeCount !== previous, oneHop);
  const twoHop = await page.locator('#page-principles [data-principles-graph-node-count]').getAttribute('data-principles-graph-node-count');
  if (oneHop === twoHop || edgeLabels < 1 || !await page.locator('#page-principles .principles-graph-node-list button').count()) throw new Error(`concept map contract failed: ${oneHop}/${twoHop}, labels=${edgeLabels}`);

  // Unified search reaches the industry map from this page.
  const search = page.locator('#page-principles .rl-search input');
  await search.fill('HBM');
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .rl-results [data-research-result]').length > 0);
  if (!await search.evaluate((node) => document.activeElement === node)) throw new Error('search lost focus while results rendered');
  await search.fill('');

  // Deep links open the requested document on a fresh load.
  const deep = await browser.newPage({ viewport: DESKTOP_PRIMARY_VIEWPORT });
  watch(deep);
  await deep.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  for (const [query, selector] of [['?mode=concept&node=roic#principles', '[data-concept-doc="roic"]'], ['?lesson=N9#principles', '[data-principles-lesson-id="N9"]'], ['?mode=frames&node=bank#principles', '.af-article']]) {
    await openApp(deep, query);
    await deep.waitForFunction((sel) => document.querySelector(`#page-principles .rl-main ${sel}`), selector, { timeout: 15000 });
  }
  if (!/은행/.test(await deep.locator('#page-principles .rl-main .af-issue').textContent())) throw new Error('frame deep link opened the wrong note');

  // Cross-route bridge: an analysis note's next-screen link carries the return context.
  await openApp(deep, '?mode=frames&node=geo-mean#principles');
  await deep.waitForFunction(() => document.querySelector('#page-principles .rl-aside .af-route'));
  await deep.locator('#page-principles .rl-aside .af-route').first().click();
  await deep.waitForFunction(() => !document.getElementById('page-principles')?.classList.contains('active'));
  const bridge = await deep.evaluate(() => {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    let returnContext = null;
    try { returnContext = JSON.parse(params.get('return') || 'null'); } catch (_) {}
    return { route: location.hash.split('?')[0], returnContext };
  });
  await deep.close();
  if (!bridge.route || bridge.route === '#principles' || bridge.returnContext?.route !== 'principles') throw new Error(`analysis note bridge lost its return context: ${JSON.stringify(bridge)}`);

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, scope: DESKTOP_QA_SCOPE, route: 'principles', frames, column, lesson, graphOneHop: Number(oneHop), graphTwoHop: Number(twoHop), edgeLabels, bridge }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
