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
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasDeepTaxonomy === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasRegistry === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasTelegram === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasRelationshipGuides === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasCurrentObservations === 'connected');
  await page.waitForFunction(() => document.getElementById('page-atlas')?.dataset.aioAtlasCurrentEvidenceLedger === 'connected');
  const overview = await page.evaluate(() => ({
    active: document.getElementById('page-atlas')?.classList.contains('active'),
    pageTitle: document.getElementById('atlas-page-title')?.textContent?.trim(),
    pageKicker: document.querySelector('#page-atlas .atlas-kicker')?.textContent?.trim(),
    searchLabel: document.querySelector('#page-atlas .atlas-search-input')?.getAttribute('aria-label'),
    trackCards: document.querySelectorAll('#page-atlas .atlas-track-card').length,
    modules: document.querySelectorAll('#page-atlas .atlas-module-lesson').length,
    totalModules: Number(document.querySelector('#page-atlas [data-atlas-authored-lesson-total]')?.dataset.atlasAuthoredLessonTotal || 0),
    layerButtons: document.querySelectorAll('#page-atlas [data-atlas-action="layer"]').length,
    conceptButtons: document.querySelectorAll('#page-atlas .atlas-learning-concept').length,
    pathClosed: !document.querySelector('#page-atlas .atlas-learning-paths')?.open,
    sourceDetailsClosed: [...document.querySelectorAll('#page-atlas .atlas-module-source-details')].every((node) => !node.open),
     rawInternalVisible: [...document.querySelectorAll('#page-atlas .atlas-module-source-details')].some((node) => node.open),
     currentObservationCards: document.querySelectorAll('#page-atlas .knowledge-current-observation-card').length,
     currentObservationValues: [...document.querySelectorAll('#page-atlas .knowledge-current-observation-value')].map((node) => node.textContent),
     explorationPanel: document.querySelectorAll('#page-atlas .atlas-module-exploration').length,
     questionPrompts: document.querySelectorAll('#page-atlas .atlas-module-question, #page-atlas .atlas-domain-verification-question, #page-atlas .atlas-domain-packet-questions').length,
     overflow: document.documentElement.scrollWidth > window.innerWidth + 2
   }));
  if (!overview.active || overview.pageTitle !== 'AI 시대 지식 지도' || overview.pageKicker !== 'AI 시대 지식 백과' || overview.searchLabel !== 'AI 시대 지식 지도 검색' || overview.trackCards !== 7 || overview.modules !== 1 || overview.totalModules !== 48 || overview.layerButtons !== 7 || overview.conceptButtons !== 7 || overview.currentObservationCards !== 0 || overview.currentObservationValues.includes('3.625%') || overview.explorationPanel !== 1 || overview.questionPrompts !== 0 || !overview.pathClosed || !overview.sourceDetailsClosed || overview.rawInternalVisible || overview.overflow) throw new Error(`learner-first atlas contract failed: ${JSON.stringify(overview)}`);

  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="foundations"]').click();
  await page.locator('#page-atlas [data-atlas-action="layer"][data-atlas-value="F0"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-learning-concept').length === 6 && document.querySelector('#page-atlas .atlas-module-lesson')?.dataset.atlasFoundationId === 'problem-and-ability' && document.querySelectorAll('#page-atlas .atlas-deep-lesson').length === 0 && document.querySelector('#page-atlas .atlas-module-lesson')?.textContent.includes('출발점 프레임'));
  await page.locator('#page-atlas [data-atlas-action="layer"][data-atlas-value="F3"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-learning-concept').length === 10 && document.querySelector('#page-atlas [data-atlas-learning-detail-title]')?.textContent === '토큰화' && document.querySelectorAll('#page-atlas .atlas-module-lesson').length === 1 && document.querySelectorAll('#page-atlas .atlas-module-question').length === 0 && document.querySelectorAll('#page-atlas .atlas-module-visualization').length === 1);
  await page.locator('#page-atlas [data-atlas-action="module"][data-atlas-value="self-attention"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas [data-atlas-learning-detail-title]')?.textContent === 'Self-Attention' && document.querySelector('#page-atlas .atlas-module-lesson')?.dataset.atlasFoundationId === 'self-attention' && document.querySelector('#page-atlas a[data-atlas-foundation-source="FND-GOOGLE-TRANSFORMER"]'));
  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="taxonomy"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-level-card').length === 7);
  await page.waitForFunction(() => Number(document.querySelector('#page-atlas [data-atlas-taxonomy-domain-total]')?.dataset.atlasTaxonomyDomainTotal) === 19 && Number(document.querySelector('#page-atlas [data-atlas-taxonomy-node-total]')?.dataset.atlasTaxonomyNodeTotal) === 95 && document.querySelectorAll('#page-atlas [data-atlas-action="domain"]').length === 19 && document.querySelectorAll('#page-atlas .atlas-domain-guide').length === 1 && document.querySelectorAll('#page-atlas [data-atlas-action="domain-node"]').length === 5 && document.querySelectorAll('#page-atlas .atlas-node-guide').length === 1);
  await page.locator('#page-atlas [data-atlas-action="domain"][data-atlas-value="domain-compute-silicon"]').click();
  await page.locator('#page-atlas [data-atlas-action="domain-node"][data-atlas-value="compute-gpu"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas a[data-atlas-domain-guide-source="domain-compute-silicon"]')?.href === 'https://science.osti.gov/ascr' && document.querySelectorAll('#page-atlas .atlas-player-product-map').length === 1 && document.querySelectorAll('#page-atlas [data-atlas-player-id]').length > 0 && document.querySelectorAll('#page-atlas [data-atlas-product-id]').length > 0 && document.querySelectorAll('#page-atlas .atlas-coverage-card').length <= 1 && document.querySelector('#page-atlas [data-atlas-currentness-boundary]')?.dataset.atlasCurrentnessBoundary === 'STALE_REFERENCE_REVIEW_REQUIRED' && document.querySelector('#page-atlas [data-atlas-currentness-boundary]')?.textContent.includes('40행') && document.querySelector('#page-atlas [data-atlas-currentness-boundary]')?.textContent.includes('claim 0개'));
  const taxonomyDisclosure = await page.evaluate(() => ({
    domainGuides: document.querySelectorAll('#page-atlas .atlas-domain-guide').length,
    visibleNodes: document.querySelectorAll('#page-atlas [data-atlas-action="domain-node"]').length,
    nodeGuides: document.querySelectorAll('#page-atlas .atlas-node-guide').length,
    evidenceClosed: [...document.querySelectorAll('#page-atlas .atlas-domain-evidence')].every((node) => !node.open),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));
  if (taxonomyDisclosure.domainGuides !== 1 || taxonomyDisclosure.visibleNodes !== 5 || taxonomyDisclosure.nodeGuides !== 1 || !taxonomyDisclosure.evidenceClosed || taxonomyDisclosure.overflow) throw new Error(`taxonomy progressive-disclosure contract failed: ${JSON.stringify(taxonomyDisclosure)}`);

  await page.locator('#page-atlas [data-atlas-action="domain"][data-atlas-value="domain-foundry-equipment"]').click();
  await page.locator('#page-atlas [data-atlas-action="domain-node"][data-atlas-value="foundry-process-node"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#page-atlas [data-atlas-deep-topic-total]')?.dataset.atlasDeepTopicTotal) === 10 && Number(document.querySelector('#page-atlas [data-atlas-deep-branch-total]')?.dataset.atlasDeepBranchTotal) === 50 && document.querySelectorAll('#page-atlas .atlas-deep-topic-button').length === 2 && document.querySelectorAll('#page-atlas .atlas-deep-branch').length === 6 && document.querySelectorAll('#page-atlas .atlas-deep-branch[open]').length === 1 && [...document.querySelectorAll('#page-atlas .atlas-deep-sources')].every((node) => !node.open) && document.querySelector('#page-atlas a[data-atlas-source-id="PS-01"]') && document.querySelectorAll('#page-atlas .atlas-reference-source-unresolved').length === 0);
  await page.locator('#page-atlas [data-atlas-action="deep-topic"][data-atlas-value="deep-lithography-process"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .atlas-deep-topic-title')?.textContent === 'DUV·EUV·High-NA와 반도체 전공정' && document.querySelectorAll('#page-atlas .atlas-deep-branch').length === 6);

  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="relationships"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-relationship-guide').length === 5 && document.querySelectorAll('#page-atlas .atlas-relationship-node').length === 6 && document.querySelectorAll('#page-atlas .atlas-relationship-edge').length === 5 && document.querySelector('#page-atlas .atlas-relationship-detail-title')?.textContent === '실질 중립금리 r*' && !document.querySelector('#page-atlas .atlas-relationship-sources')?.open);
  await page.locator('#page-atlas [data-atlas-action="relationship-guide"][data-atlas-value="nand-inference-fcf"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-relationship-node').length === 9 && document.querySelectorAll('#page-atlas .atlas-relationship-edge').length === 8 && document.querySelector('#page-atlas .atlas-relationship-detail-title')?.textContent === '문맥·동시성 증가');
  await page.locator('#page-atlas [data-atlas-action="relationship-criticality"][data-atlas-value="claim"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-relationship-node').length === 5 && document.querySelectorAll('#page-atlas .atlas-relationship-edge').length === 3);
  const targetNode = page.locator('#page-atlas [data-atlas-action="relationship-node"][data-atlas-value="financial-targets"]');
  await targetNode.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page-atlas .atlas-relationship-detail-title')?.textContent === 'FY28–30 회사 목표' && document.querySelector('#page-atlas [data-atlas-action="relationship-node"][data-atlas-value="financial-targets"]')?.getAttribute('aria-pressed') === 'true');
  await page.locator('#page-atlas .atlas-relationship-sources summary').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .atlas-relationship-sources')?.open && document.querySelectorAll('#page-atlas .atlas-relationship-sources a').length === 6);
  const relationshipGuideSpecs = [
    ['neutral-rate-policy-gap', 6, 5],
    ['nand-inference-fcf', 9, 8],
    ['semiconductor-supply-network', 7, 7],
    ['ai-datacenter-gigawatt-to-token', 7, 6],
    ['cpo-supply-map', 6, 5]
  ];
  const relationshipResponsive = [];
  for (const width of [1280, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    await page.locator('#page-atlas [data-atlas-action="relationship-criticality"][data-atlas-value="all"]').click();
    for (const [guideId, expectedNodes, expectedEdges] of relationshipGuideSpecs) {
      await page.locator(`#page-atlas [data-atlas-action="relationship-guide"][data-atlas-value="${guideId}"]`).click();
      await page.waitForFunction(({ nodes, edges }) => document.querySelectorAll('#page-atlas .atlas-relationship-node').length === nodes && document.querySelectorAll('#page-atlas .atlas-relationship-edge').length === edges, { nodes: expectedNodes, edges: expectedEdges });
      relationshipResponsive.push(await page.evaluate(({ viewportWidth, activeGuide }) => ({
        width: viewportWidth,
        guide: activeGuide,
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        workspaceWidth: Math.round(document.querySelector('#page-atlas .atlas-relationship-workspace')?.getBoundingClientRect().width || 0),
        mapWidth: Math.round(document.querySelector('#page-atlas .atlas-relationship-map-panel')?.getBoundingClientRect().width || 0),
        detailWidth: Math.round(document.querySelector('#page-atlas .atlas-relationship-detail')?.getBoundingClientRect().width || 0)
      }), { viewportWidth: width, activeGuide: guideId }));
    }
  }
  if (relationshipResponsive.some((entry) => entry.documentOverflow || entry.workspaceWidth <= 0 || entry.mapWidth <= 0 || entry.detailWidth <= 0)) throw new Error(`relationship responsive contract failed: ${JSON.stringify(relationshipResponsive)}`);
  await page.setViewportSize({ width: 1440, height: 900 });

  const relationshipSearch = page.locator('#page-atlas .atlas-search-input');
  await relationshipSearch.fill('FCF');
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-relationship-view').length === 1 && document.querySelectorAll('#page-atlas .atlas-relationship-node').length > 0);
  const filteredRelationship = await page.evaluate(() => {
    const visible = new Set([...document.querySelectorAll('#page-atlas .atlas-relationship-node strong')].map((node) => node.textContent?.trim()));
    const dangling = [...document.querySelectorAll('#page-atlas .atlas-relationship-edge')].filter((edge) => {
      const labels = [...edge.querySelectorAll('strong')].map((node) => node.textContent?.trim());
      return labels.some((label) => label && !visible.has(label));
    }).length;
    return { visibleNodes: visible.size, edges: document.querySelectorAll('#page-atlas .atlas-relationship-edge').length, dangling };
  });
  if (filteredRelationship.dangling) throw new Error(`relationship search left hidden-node edges: ${JSON.stringify(filteredRelationship)}`);
  await relationshipSearch.fill('');

  await page.locator('#page-atlas [data-atlas-action="tab"][data-atlas-value="overview"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-telegram-channel-card').length === 4 && document.querySelector('#page-atlas .atlas-telegram-status') && document.querySelector('#page-atlas .atlas-current-evidence-ledger')?.textContent.includes('40개 dated evidence'));
  const search = page.locator('#page-atlas .atlas-search-input');
  await search.fill('CPO');
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .atlas-packet-card').length === 1 && document.querySelector('#page-atlas [data-atlas-packet-id]')?.dataset.atlasPacketId === 'ATLAS-04');
  await search.fill('');
  await page.locator('#page-atlas [data-atlas-action="route"][data-atlas-value="principles"]').click();
  await page.waitForFunction(() => document.getElementById('page-principles')?.classList.contains('active'));
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'atlas', learnerTracks: overview.trackCards, visibleAuthoredLessons: overview.modules, authoredLessonTotal: overview.totalModules, curriculumLayers: 7, taxonomyLevels: 7, taxonomyDomains: 19, visibleDomainGuides: taxonomyDisclosure.domainGuides, taxonomyNodes: 95, visibleNodeGuides: taxonomyDisclosure.nodeGuides, deepTopics: 10, deepBranches: 50, relationshipGuides: 5, relationshipNodes: 35, relationshipEdges: 31, relationshipFocusedGuide: 'nand-inference-fcf', relationshipFocusedNode: 'financial-targets', relationshipResponsive, relationshipSearch: filteredRelationship, researchPackets: 11, evidenceClaims: 14, primarySources: 23, telegramChannels: 4, searchedPacket: 'ATLAS-04', routeCta: 'principles', errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
