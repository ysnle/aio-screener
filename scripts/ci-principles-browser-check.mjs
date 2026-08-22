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
  const statusPattern = '**/public-data/knowledge/status-summary.json';
  await page.route(statusPattern, (route) => route.abort());
  await page.evaluate(() => window.AIO_ARCH.navigate('principles'));
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNarrative === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesKnowledgeStatus === 'fallback' && document.querySelector('#page-principles .principles-knowledge-status[role="alert"]'));
  const narrativeInitial = await page.evaluate(() => ({
    storyActive: document.querySelector('#page-principles [data-principles-action="view"][data-principles-value="story"]')?.getAttribute('aria-pressed'),
    chapter: document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter,
    chapterIndex: document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapterIndex,
    railChapters: document.querySelectorAll('#page-principles .principles-narrative-rail-button').length,
    title: document.querySelector('#page-principles .principles-narrative-title')?.textContent || '',
    thesis: document.querySelector('#page-principles .principles-narrative-thesis')?.textContent || '',
    proseParagraphs: document.querySelectorAll('#page-principles .principles-narrative-prose p').length,
    storySearchVisible: Boolean(document.querySelector('#page-principles .principles-search-input')),
    mapArtifactsLoaded: ['aioPrinciplesResearch', 'aioPrinciplesNodeGuides', 'aioPrinciplesCurrentObservations'].some((key) => document.getElementById('page-principles')?.dataset[key]),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (narrativeInitial.storyActive !== 'true' || narrativeInitial.chapter !== 'money-is-choice' || narrativeInitial.chapterIndex !== '1' || narrativeInitial.railChapters !== 12 || !narrativeInitial.title.includes('돈은 숫자가 아니라') || !narrativeInitial.thesis.includes('무엇을 소유할지') || narrativeInitial.proseParagraphs < 3 || narrativeInitial.storySearchVisible || narrativeInitial.mapArtifactsLoaded || narrativeInitial.overflow) throw new Error(`narrative-first initial contract failed: ${JSON.stringify(narrativeInitial)}`);
  await page.locator('#page-principles [data-principles-action="story-index"][data-principles-value="1"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-narrative')?.dataset.narrativeChapter === 'inflation-purchasing-power' && new URL(location.href).searchParams.get('chapter') === 'inflation-purchasing-power');
  await page.locator('#page-principles [data-principles-action="story-chapter"][data-principles-value="money-is-choice"]').click();
  await page.unroute(statusPattern);
  await page.locator('#page-principles [data-principles-action="retry-capability"][data-principles-value="knowledgeStatus"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesKnowledgeStatus === 'connected' && document.querySelector('#page-principles .principles-knowledge-status')?.dataset.principlesPublicationReady === 'false');
  await page.locator('#page-principles [data-principles-action="mode"][data-principles-value="tree"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesResearch === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesNodeGuides === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesCurrentObservations === 'connected');
  const publicationBoundary = await page.locator('#page-principles .principles-knowledge-status').textContent();
  if (!publicationBoundary.includes('사람 의미·출처 직접성 검수 미완료') || !publicationBoundary.includes('출판 준비 미완료')) throw new Error(`knowledge publication boundary missing: ${publicationBoundary}`);

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
     explorationPanel: document.querySelectorAll('#page-principles .principles-exploration-panel:not(.principles-knowledge-status)').length,
     questionPrompts: document.querySelectorAll('#page-principles .principles-chapter-question').length,
     count: document.querySelector('[data-principles-result-count]')?.textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (!initial.active || initial.treeSections !== 7 || initial.treeGroups !== 1 || initial.nodes !== 3 || initial.evidenceBadges !== 0 || !initial.detail.includes('한 문장 정의') || initial.currentObservationCards !== 1 || initial.currentObservationValues.includes('3.625%') || initial.explorationPanel !== 1 || initial.questionPrompts !== 0 || initial.defaultLibraryCards !== 0 || !initial.libraryTab || initial.hiddenSources < 1 || initial.internalStatusVisible || initial.overflow) throw new Error(`learner-first initial contract failed: ${JSON.stringify(initial)}`);

  await page.locator('#page-principles .knowledge-learning-bookmark').click();
  await page.locator('#page-principles .knowledge-learning-note').fill('희소성과 기회비용을 함께 확인');
  await page.locator('#page-principles .knowledge-learning-note-save').click();
  const learningRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('aio-knowledge-learning-v1') || 'null'));
  if (!learningRecord?.bookmarks?.includes('principles-node:scarcity-choice') || learningRecord?.notes?.['principles-node:scarcity-choice']?.value !== '희소성과 기회비용을 함께 확인') throw new Error(`principles learning controls failed: ${JSON.stringify(learningRecord)}`);

  const search = page.locator('#page-principles .principles-search-input');
  await search.fill('저장장치');
  await page.waitForFunction(() => document.activeElement?.classList.contains('principles-search-input') && document.querySelector('.principles-search-input')?.value === '저장장치');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesLessonLibrary === 'connected');
  await search.fill('');

  await page.locator('#page-principles [data-principles-action="toggle-section"][data-principles-value="ai"]').click();
  await page.locator('#page-principles [data-principles-action="toggle-group"][data-principles-value="ai-economics-path"]').click();
  await page.locator('#page-principles [data-principles-action="select-node"][data-principles-value="storage"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-detail-title')?.textContent === '스토리지');
  const selected = await page.evaluate(() => ({
    title: document.querySelector('#page-principles .principles-detail-title')?.textContent || '',
    guideFields: [...document.querySelectorAll('#page-principles .principles-explainer-label')].map((node) => node.textContent),
    connections: document.querySelectorAll('#page-principles .principles-connection-button').length,
    observationProvenance: [...document.querySelectorAll('#page-principles .knowledge-current-observation-provenance')].map((node) => node.textContent),
    observationUnits: [...document.querySelectorAll('#page-principles .knowledge-current-observation-meta')].map((node) => node.textContent),
    rawInternalText: /REVIEWED_CANDIDATE|REFERENCE_CONNECTED|PS-\d+|TG-C\d+/.test(document.querySelector('#page-principles .principles-detail-card')?.textContent || '')
  }));
  if (!selected.title || selected.guideFields.length < 6 || selected.connections < 1 || !selected.observationProvenance.some((text) => text.includes('회사 IR 미래 목표')) || selected.observationUnits.some((text) => /approximately-percent|percent-of-revenue/.test(text)) || selected.rawInternalText) throw new Error(`authored node detail failed: ${JSON.stringify(selected)}`);

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
  const chaptersPattern = '**/public-data/principles/chapters.json';
  await page.route(chaptersPattern, (route) => route.abort());
  await page.locator('#page-principles [data-principles-action="view"][data-principles-value="library"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesChapters === 'fallback' && document.querySelector('#page-principles .principles-capability-errors[role="alert"]'));
  await page.unroute(chaptersPattern);
  await page.locator('#page-principles [data-principles-action="retry-capability"][data-principles-value="chapters"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesChapters === 'connected');
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesLessonLibrary === 'connected');
  await page.locator('#page-principles .principles-library-panel-summary').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('#page-principles [data-principles-lesson-id]').length === 20);
  await search.fill('상관·구조 설명은 인과');
  await page.waitForFunction(() => document.querySelector('#page-principles [data-principles-lesson-id="A1"]'));
  await search.fill('');
  if (await page.locator('#page-principles .principles-deep-article').count()) throw new Error('deep articles must not load before an explicit lesson request');
  const articlePattern = '**/public-data/knowledge/articles/principles/*.json';
  await page.route(articlePattern, (route) => route.abort());
  await page.locator('#page-principles [data-principles-action="load-article"]').first().click();
  await page.waitForFunction(() => document.querySelector('#page-principles [role="alert"]')?.textContent.includes('다시 시도'));
  await page.unroute(articlePattern);
  await page.locator('#page-principles [data-principles-action="load-article"]').first().click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.dataset.aioPrinciplesKnowledgeArticles === 'connected' && document.querySelectorAll('#page-principles .principles-deep-article').length === 1);
  if (new URL(page.url()).searchParams.get('lesson') !== 'A1') throw new Error(`active library lesson was not serialized: ${page.url()}`);
  await page.locator('#page-principles .knowledge-learning-bookmark').click();
  await page.locator('#page-principles .knowledge-learning-note').fill('A1 개별 레슨 메모');
  await page.locator('#page-principles .knowledge-learning-note-save').click();
  const lessonLearningRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('aio-knowledge-learning-v1') || 'null'));
  if (!lessonLearningRecord?.bookmarks?.includes('principles:A1') || lessonLearningRecord?.notes?.['principles:A1']?.value !== 'A1 개별 레슨 메모') throw new Error(`library lesson learning state failed: ${JSON.stringify(lessonLearningRecord)}`);
  await search.fill('productivity measurement combines output');
  await page.waitForFunction(() => document.querySelectorAll('#page-principles [data-principles-lesson-id]').length === 1 && document.querySelector('#page-principles [data-principles-lesson-id="A1"]'));
  await search.fill('');
  const library = await page.evaluate(() => ({
    chapters: document.querySelectorAll('#page-principles [data-principles-chapter]').length,
    lessons: document.querySelectorAll('#page-principles [data-principles-lesson-id]').length,
    chapterColumns: getComputedStyle(document.querySelector('#page-principles .principles-chapter-grid')).gridTemplateColumns,
    lessonColumns: getComputedStyle(document.querySelector('#page-principles .principles-lesson-library-grid')).gridTemplateColumns,
    deepArticles: document.querySelectorAll('#page-principles .principles-deep-article').length,
    deepBoundary: document.querySelector('.principles-deep-article .principles-deep-article-boundary')?.textContent || '',
    professionalBridges: document.querySelectorAll('#page-principles .knowledge-professional-bridge-button[data-knowledge-metric][data-knowledge-timeframe]').length
  }));
  await page.waitForFunction(() => document.querySelectorAll('#page-principles .principles-deep-lesson .knowledge-lesson-section').length >= 8);
  const principlesArticleText = await page.locator('#page-principles .principles-deep-lesson').innerText();
  if (principlesArticleText.includes('{"term":') || !principlesArticleText.includes('사례·근거 전개') || !principlesArticleText.includes(' — ')) throw new Error('principles article must render structured glossary values as readable Korean UI text');
  if (library.chapters !== 15 || library.lessons !== 20 || library.deepArticles !== 1 || library.professionalBridges !== 1 || !library.deepBoundary.includes('검토')) throw new Error(`library contract failed: ${JSON.stringify(library)}`);
  await page.locator('#page-principles [data-principles-action="library-page"][data-principles-value="2"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-library-page-status')?.textContent?.startsWith('2/'));
  await page.locator('#page-principles [data-principles-action="library-page"][data-principles-value="1"]').click();
  await page.waitForFunction(() => document.querySelector('#page-principles .principles-library-page-status')?.textContent?.startsWith('1/'));

  await page.goto(`${baseUrl}?lesson=A1#principles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active') && document.getElementById('page-principles')?.dataset.aioPrinciplesKnowledgeArticles === 'connected' && document.querySelector('#page-principles [data-principles-article-id="principles:A1"]'));
  const restored = await page.evaluate(() => ({
    lesson: new URL(location.href).searchParams.get('lesson'),
    libraryActive: document.querySelector('#page-principles [data-principles-action="view"][data-principles-value="library"]')?.getAttribute('aria-pressed'),
    selected: document.querySelector('#page-principles [data-principles-lesson-id="A1"]')?.dataset.principlesLessonSelected,
    label: document.querySelector('#page-principles .knowledge-learning-controls-label')?.textContent || '',
    bookmarked: document.querySelector('#page-principles .knowledge-learning-bookmark')?.getAttribute('aria-pressed')
  }));
  if (restored.lesson !== 'A1' || restored.libraryActive !== 'true' || restored.selected !== 'true' || !restored.label.includes('희소성과 선택') || restored.bookmarked !== 'true') throw new Error(`library lesson URL restore failed: ${JSON.stringify(restored)}`);

  await page.locator('#page-principles .knowledge-professional-bridge-button').first().click();
  await page.waitForFunction(() => document.getElementById('page-macro')?.classList.contains('active') && new URLSearchParams(location.hash.split('?')[1] || '').has('metric') && new URLSearchParams(location.hash.split('?')[1] || '').has('timeframe'));

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, scope: DESKTOP_QA_SCOPE, route: 'principles', narrativeInitial, initial, selected, evidenceOpen, graphOneHop: Number(graphOneHop), graphTwoHop: Number(graphTwoHop), edgeLabels, viewport: DESKTOP_PRIMARY_VIEWPORT, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
