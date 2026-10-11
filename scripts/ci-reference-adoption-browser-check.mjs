import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
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
const server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((done, reject) => {
  const timer = setTimeout(() => reject(Error('local server readiness timeout')), 15000);
  server.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) { clearTimeout(timer); done(); } });
  server.on('error', reject); server.on('exit', (code) => reject(Error(`server exit ${code}`)));
});
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
  await article.locator('a[href]').first().focus();
  await page.evaluate((news) => {
    window._allNewsItems = [news, { ...news, id: 'fixture-correction', newsId: 'fixture-correction', title: 'Correction: NVIDIA earnings fixture', correctionOf: 'fixture-original', revisionType: 'correction', link: 'https://example.test/article?id=2', pubDate: '2026-10-09T19:00:00Z', score: 1 }];
    document.dispatchEvent(new CustomEvent('aio:newsUpdated'));
    document.dispatchEvent(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-fetch-complete' } }));
  }, fixture.news);
  await page.waitForFunction(() => document.querySelector('[data-news-updates]')?.hidden === false);
  assert.ok(await article.locator('a[href]').first().evaluate((node) => document.activeElement === node), 'P1601: arrival retains focused article');
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
  await page.waitForFunction(() => document.querySelector('#page-themes [data-action=showThemeDetail]'));
  const trigger = page.locator('#page-themes [data-action=showThemeDetail]').first();
  const themeId = await trigger.getAttribute('data-arg');
  await trigger.click();
  await page.waitForFunction(() => document.getElementById('theme-detail-panel')?.style.display !== 'none');
  await page.evaluate(() => window.closeThemeDetail());
  await page.waitForFunction((id) => document.activeElement?.dataset.arg === id, themeId);
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
  await browser?.close(); server.kill();
}
