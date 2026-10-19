import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { createBrowserEvidence, addBrowserEvidenceStep, evidenceDigest, validateBrowserEvidence } from './lib/browser-evidence.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_REFERENCE_TEST_PORT || 8943);
const base = `http://127.0.0.1:${port}/`;
const runId = process.env.AIO_QA_RUN_ID || `reference-${Date.now()}`;
const evidencePath = process.env.AIO_QA_EVIDENCE_PATH || resolve(root, '.cache', 'aio-qa', 'runs', runId, 'reference', 'evidence.json');
mkdirSync(dirname(evidencePath), { recursive: true });
const fixture = { now: '2026-10-10T03:00:00Z', profile: 'empty-isolated',
  news: { source: 'Reuters', sourceStoryId: 'fixture-nvda', issuerSymbol: 'NVDA', newsId: 'fixture-original', id: 'fixture-original', title: 'NVIDIA earnings revenue growth fixture', summary: 'NVIDIA reports earnings in this isolated fixture.', link: 'https://example.test/article?id=1', pubDate: '2026-10-09T18:00:00Z', observedAt: '2026-10-09T18:01:00Z', fetchedAt: '2026-10-09T18:02:00Z', score: 90, topic: 'earnings', country: 'us', contentDepth: 'summary', evidenceKind: 'reporting' } };
const report = createBrowserEvidence({ root, runId, providerVersion: createRequire(import.meta.url)('playwright/package.json').version,
  operation: 'reference-adoption-journeys', fixture,
  environment: { mode: 'headless-fixture', viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezone: 'Asia/Seoul', initialStateId: fixture.profile, networkPolicy: 'local-only' } });
// v57.60: the shared helper clears its readiness timer on exit and kills the server on timeout.
const server = await startLocalServer(port, { label: 'reference-adoption/server' });
// v57.60: poll a DOM condition for a bounded window instead of one instantaneous read.
const pollTrue = async (probe, timeoutMs = 2000, intervalMs = 100) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe().catch(() => false)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolvePoll) => setTimeout(resolvePoll, intervalMs));
  }
};
let browser;
let currentStep = null;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: report.environment.viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.addInitScript(({ now }) => {
    const NativeDate = Date, fixed = NativeDate.parse(now);
    window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
  }, fixture);
  await page.goto(`${base}index.html`);
  await page.waitForFunction(() => window.AIO_ARCH && window._aioNewsStories && typeof window.showPage === 'function');
  const notice = page.locator('#aio-first-visit-disclaimer button').filter({ hasText: '확인했습니다' });
  if (await notice.isVisible()) await notice.click();
  const capture = async ({ stepId, route, stateId, action, locator, expected, actual, claimType = 'text' }) => {
    currentStep = { stepId, screenId: route === 'themes' ? 'themes' : route === 'ticker' || route === 'fundamental' ? 'stock' : 'today', route, stateId,
      entity: route === 'ticker' || route === 'fundamental' ? 'fixture-issuer' : null, initialCondition: fixture.profile,
      action, readyCondition: `visible ${locator} and expected fixture content`, readyObserved: true, status: 'observed', authority: 'headless-fixture',
      claimType, captureSelection: ['dom', 'screenshot'], expected, actual, evidence: [], limitations: ['fixture data; screenshot captured without semantic certification'] };
    await page.locator(locator).first().waitFor({ state: 'visible' });
    const dom = await page.locator(locator).first().textContent();
    const path = resolve(dirname(evidencePath), `${stepId}.png`);
    const png = await page.screenshot({ path });
    currentStep.evidence = [{ kind: 'dom', locator, digest: evidenceDigest(dom || '') }, { kind: 'screenshot', path: relative(dirname(evidencePath), path).replaceAll('\\', '/'), digest: evidenceDigest(png) }];
    addBrowserEvidenceStep(report, currentStep); currentStep = null;
  };
  await page.evaluate((news) => {
    window._allNewsItems = [news]; window._serverDataMeta = { generatedAt: '2026-10-10T03:00:00Z', newsCycleStart: '2026-10-08T23:00:00Z', newsCycleEnd: '2026-10-09T23:00:00Z' };
    document.dispatchEvent(new CustomEvent('aio:newsUpdated'));
    window.showPage('market-news');
  }, fixture.news);
  await page.waitForFunction(() => document.querySelector('#news-important-list .news-item-card')?.textContent.includes('NVIDIA'));
  const article = page.locator('#news-important-list .news-item-card').filter({ hasText: 'NVIDIA' }).first();
  assert.equal(await article.locator('[data-issuer-role=subject]').textContent(), '$NVDA', 'P1601: registered exact issuer');
  let popups = 0; context.on('page', () => popups++);
  await article.locator('.news-evidence summary').click();
  assert.equal(popups, 0, 'P1601: evidence disclosure must not open article');
  assert.ok(await article.locator('.news-evidence').evaluate((node) => node.open), 'P1601: source disclosure opens');
  const focusedLink = article.locator('a[href]').first();
  await focusedLink.focus();
  // v57.60: confirm focus actually landed before the update events fire, so the retention check below
  // measures the arrival path rather than a focus() that had not taken yet.
  assert.ok(await pollTrue(() => focusedLink.evaluate((node) => document.activeElement === node)), 'v57.60: article link focus took before data arrival');
  await page.evaluate((news) => {
    window._allNewsItems = [news, { ...news, id: 'fixture-correction', newsId: 'fixture-correction', title: 'Correction: NVIDIA earnings fixture', correctionOf: 'fixture-original', revisionType: 'correction', link: 'https://example.test/article?id=2', pubDate: '2026-10-09T19:00:00Z', score: 1 }];
    document.dispatchEvent(new CustomEvent('aio:newsUpdated'));
    document.dispatchEvent(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-fetch-complete' } }));
  }, fixture.news);
  await page.waitForFunction(() => document.querySelector('[data-news-updates]')?.hidden === false);
  assert.ok(await pollTrue(() => article.locator('a[href]').first().evaluate((node) => document.activeElement === node)), 'P1601: arrival retains focused article');
  assert.ok(!(await article.textContent()).includes('Correction:'), 'P1601: update remains pending');
  await capture({ stepId: 'news-arrival-pending', route: 'market-news', stateId: 'arrival', action: { type: 'data-arrival', target: 'fixture-feed' }, locator: '#page-market-news', expected: 'focused original retained, update offered', actual: 'focused original retained, update offered' });
  await page.locator('[data-news-updates]').click();
  await page.waitForFunction(() => document.querySelector('#news-important-list .news-item-card')?.textContent.includes('Correction:'));
  const revised = page.locator('#news-important-list .news-item-card').first();
  await revised.locator('.news-evidence summary').click();
  assert.equal(await revised.locator('.news-evidence ol a').count(), 2, 'P1601: both original articles retained');
  assert.match(await page.locator('#market-news-count').textContent(), /중요 사건 1건/, 'P1601: important event cannot be reported as zero events');
  await capture({ stepId: 'news-correction-history', route: 'market-news', stateId: 'correction', action: { type: 'click', target: '[data-news-updates]' }, locator: '#news-important-list', expected: 'low-score correction with two original links', actual: 'low-score correction with two original links', claimType: 'layout' });
  // Real DOM component fixture: use fictitious quote data and an empty isolated browser storage.
  await page.evaluate(async () => {
    const { ensureResearchSnapshots } = await import('/src/ui/components/research-snapshots.js');
    const host = document.createElement('section'); host.id = 'snapshot-fixture'; document.body.appendChild(host);
    window.__snapshotFixtureRender = (symbol, value) => ensureResearchSnapshots({ documentRef: document, root: window, host, kind: 'stock', collect: () => ({ kind: 'stock', symbol, name: symbol, quote: { value, source: 'fixture-quote', observedAt: '2026-10-09T20:00:00Z', basis: 'regular-session-close', currency: 'USD' } }) });
    window.__snapshotFixtureRender('NVDA', 123);
  });
  await page.locator('#snapshot-fixture > details > summary').click();
  await page.locator('#snapshot-fixture textarea').fill('NVDA fixture draft');
  await page.evaluate(() => window.__snapshotFixtureRender('AAPL', 222));
  assert.equal(await page.locator('#snapshot-fixture textarea').inputValue(), '', 'P1602: issuer switch cannot borrow another draft');
  await page.evaluate(() => window.__snapshotFixtureRender('NVDA', 123));
  assert.equal(await page.locator('#snapshot-fixture textarea').inputValue(), 'NVDA fixture draft', 'P1602: issuer draft restored');
  await page.locator('#snapshot-fixture button').filter({ hasText: '현재 근거 저장' }).click();
  await page.waitForFunction(() => document.querySelector('#snapshot-fixture [role=status]')?.textContent.includes('저장했습니다'));
  await page.evaluate(() => window.__snapshotFixtureRender('NVDA', 999));
  assert.ok((await page.locator('#snapshot-fixture').textContent()).includes('가격 123'), 'P1602: saved quote remains frozen');
  await capture({ stepId: 'stock-local-snapshot', route: 'ticker', stateId: 'snapshot', action: { type: 'save', target: 'fixture quote memo' }, locator: '#snapshot-fixture', expected: 'issuer drafts separate, stored price 123 despite new 999', actual: 'issuer drafts separate, stored price 123 despite new 999' });
  await page.locator('#snapshot-fixture').evaluate((node) => node.remove());
  await page.evaluate(() => window.showPage('briefing'));
  await page.waitForFunction(() => document.querySelector('#page-briefing [data-research-snapshots=briefing]'));
  await page.locator('#page-briefing [data-research-snapshots=briefing] > summary').click();
  await capture({ stepId: 'briefing-local-archive-empty', route: 'briefing', stateId: 'archive-empty', action: { type: 'disclose', target: 'local briefing archive' }, locator: '#page-briefing [data-research-snapshots=briefing]', expected: 'only explicitly saved reports, no fabricated past briefings', actual: 'empty isolated archive' });
  await page.evaluate(() => window.showPage('themes'));
  // v57.54: while the sector-rotation artifact lags the latest close its quadrant chips are hidden; the theme playbook's
  // detail buttons (data-theme-id) are then the visible triggers. Either kind is a detail trigger (themes.js rule).
  const TRIGGERS = '#page-themes [data-action=showThemeDetail]:visible, #page-themes button[data-theme-id]:visible';
  await page.locator(TRIGGERS).first().waitFor({ state: 'visible' });
  const trigger = page.locator(TRIGGERS).first();
  const themeId = (await trigger.getAttribute('data-arg')) || (await trigger.getAttribute('data-theme-id'));
  await trigger.click();
  await page.waitForFunction(() => document.getElementById('theme-detail-panel')?.style.display !== 'none');
  // v57.54: this wait failed in 4 of the last 100 CI runs (bare "waitForFunction: Timeout 30000ms"). Under 4x CPU
  // throttling focus ends on <body> with no theme event after close, i.e. the trigger node is replaced by a
  // background re-render (store/refresh cycle) rather than never focused. Name which case occurred instead of a
  // bare timeout, so a recurrence points at src/ui/pages/themes.js focus preservation, not at the harness.
  await page.evaluate((id) => {
    window.__referenceThemeTrigger = [...document.querySelectorAll('#page-themes [data-action=showThemeDetail], #page-themes button[data-theme-id]')].find((node) => (node.dataset.arg || node.dataset.themeId) === id && !node.closest('#theme-detail-panel')) || null;
  }, themeId);
  await page.evaluate(() => window.closeThemeDetail());
  try {
    await page.waitForFunction((id) => (document.activeElement?.dataset.arg || document.activeElement?.dataset.themeId) === id, themeId);
  } catch (error) {
    const state = await page.evaluate((id) => ({
      triggerStillMounted: window.__referenceThemeTrigger ? window.__referenceThemeTrigger.isConnected : null,
      matchingTriggers: document.querySelectorAll(`#page-themes [data-action=showThemeDetail][data-arg="${CSS.escape(id)}"], #page-themes button[data-theme-id="${CSS.escape(id)}"]`).length,
      active: `${document.activeElement?.tagName || 'none'}#${document.activeElement?.id || ''}`,
    }), themeId);
    throw new Error(`theme close focus not restored to ${themeId}: ${JSON.stringify(state)} (triggerStillMounted=false: a re-render replaced the trigger after close; true: focus was never returned)`, { cause: error });
  }
  // 2026-10-19: the follow used to stop after its first re-focus, so a second replacing render (main CI after #73)
  // still dropped focus. Replace the trigger twice on purpose; focus must land on each replacement.
  for (let round = 1; round <= 2; round += 1) {
    await page.evaluate((id) => {
      const node = [...document.querySelectorAll('#page-themes [data-action=showThemeDetail], #page-themes button[data-theme-id]')].find((item) => (item.dataset.arg || item.dataset.themeId) === id && !item.closest('#theme-detail-panel'));
      node?.replaceWith(node.cloneNode(true));
    }, themeId);
    await page.waitForFunction((id) => (document.activeElement?.dataset.arg || document.activeElement?.dataset.themeId) === id, themeId, { timeout: 5000 })
      .catch(() => { throw new Error(`theme close focus lost after replacing render ${round} for ${themeId}`); });
  }
  await capture({ stepId: 'theme-close-focus', route: 'themes', stateId: 'close-focus', action: { type: 'close', target: 'theme-detail-panel' }, locator: '#page-themes', expected: 'focus returns to current trigger after rerender', actual: `trigger ${themeId} focused` });
  const errors = validateBrowserEvidence(report);
  assert.deepEqual(errors, [], 'P1603: bounded complete scenario evidence');
  console.log(`Reference browser PASS: ${report.steps.length} observed fixture steps; unobserved states remain unverified.`);
} catch (error) {
  const pages = browser?.contexts().flatMap((context) => context.pages()) || [];
  if (pages[0]) {
    const diagnostic = await pages[0].evaluate(() => [...document.querySelectorAll('#news-important-list .news-item-card')].map((node) => ({ text: node.textContent.slice(0, 350), tickers: [...node.querySelectorAll('[data-issuer-role]')].map((chip) => [chip.textContent, chip.dataset.issuerRole]) })));
    console.error(JSON.stringify(diagnostic));
    await pages[0].screenshot({ path: resolve(dirname(evidencePath), 'failure.png') });
  }
  report.limitations.push(`scenario failure: ${error.message}`);
  if (currentStep) addBrowserEvidenceStep(report, { ...currentStep, status: 'failed', readyObserved: false, reason: error.message });
  console.error(error.stack); process.exitCode = 1;
} finally {
  writeFileSync(evidencePath, JSON.stringify(report, null, 2) + '\n');
  await closeAll({ browser, server });
}
