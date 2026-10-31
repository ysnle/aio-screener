import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer } from './lib/browser-gate.mjs';
import { createBrowserEvidence, addBrowserEvidenceStep, evidenceDigest, validateBrowserEvidence } from './lib/browser-evidence.mjs';
import { PACKET_20261011_CLAIMS, PACKET_20261011_LESSONS } from '../src/domain/research/packet-20261011.js';
import { getSuppliedMaterialClaims } from '../src/domain/research/supplied-materials.js';
import { lessonById, PATHS, FRAME_VARIABLES } from '../src/domain/knowledge/learning-core.js';
import { createAIKnowledgeIndex } from '../src/ai/retrieval/knowledge.js';
import { SUPPLIED_MATERIALS_REFERENCE } from '../src/domain/research/supplied-materials.js';
import { searchKnowledgeIndex } from '../src/ui/knowledge/knowledge-search.js';
const reasoningIndex = createAIKnowledgeIndex([], { suppliedMaterials: SUPPLIED_MATERIALS_REFERENCE });

// P1605: every promoted frame must have a real source, note, learning path and retrieval consumer.
for (const claim of PACKET_20261011_CLAIMS) {
  assert.deepEqual(getSuppliedMaterialClaims({ ids: [claim.id] }), [claim], 'P1605: canonical claim retrieval');
  const id = claim.id.replace('claim-20261011-', '');
  assert.ok(lessonById(id) && PATHS.some((path) => path.lessons.includes(id)) && FRAME_VARIABLES[id]?.length, 'P1605: learning note, path and variables');
  assert.ok(claim.blockedConsumers.includes('score') && claim.blockedConsumers.includes('rank') && claim.currentnessBoundary.includes('REFERENCE'), 'P1605: reference cannot become score/rank/current data');
  const article = reasoningIndex.find((row) => row.articleId === `supplied-material:${claim.id}`);
  assert.ok(article?.publication === 'EDUCATIONAL_REFERENCE_ONLY' && article.sources?.length && article.reviewedAt === '2026-10-11', 'P1605: AI index preserves reference publication, source and actual observation date');
  assert.ok(searchKnowledgeIndex(null, lessonById(id).issue).some((row) => row.route.params.node === id), 'P1606: canonical note is searchable before generated index publication');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_THEME_TEST_PORT || 8946), base = `http://127.0.0.1:${port}/`;
const runId = process.env.AIO_QA_RUN_ID || `theme-research-${Date.now()}`;
const output = process.env.AIO_QA_EVIDENCE_PATH || resolve(root, '.cache/aio-qa/runs', runId, 'theme-research/evidence.json');
mkdirSync(dirname(output), { recursive: true });
const fixture = { profile: 'isolated-local-artifacts', initialMode: 'light', personalData: 'none', source: 'local published artifacts; synthetic stock bars' };
// v58.84: the two pinned chart libraries are served from the SRI-checked copies the entity-quality and
// out-of-universe journeys already use, so the gate no longer needs the CDN (it timed out wherever egress is blocked).
const pinnedLibraries = [
  { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', file: 'browser-chart.umd.min.js', sri: 'e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g' },
  { url: 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js', file: 'browser-lightweight-charts.js', sri: 'OK7vELvjHdhUFi31JYioPIcRHTROLdcDa6ZsNWgvgLaKj+9JqhU0Ad8g4wz3CXjA' }
].map((item) => { const body = readFileSync(resolve(root, '_artifacts/entity-quality-20261012', item.file));
  if (createHash('sha384').update(body).digest('base64') !== item.sri) throw new Error(`Pinned chart library SRI mismatch: ${item.file}`);
  return { ...item, body }; });
const report = createBrowserEvidence({ root, runId, fixture, providerVersion: createRequire(import.meta.url)('playwright/package.json').version, operation: 'theme-research-journeys', environment: { mode: 'headless-fixture', viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezone: 'Asia/Seoul', initialStateId: fixture.profile, networkPolicy: 'local-artifacts+two-pinned-chart-libraries-from-local-copies; remote-blocked' } });
const server = await startLocalServer(port, { label: 'theme-research/server' }); // v57.62 shared lifecycle (15 s ready-line timeout)
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: report.environment.viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', (request) => {
    const url = request.request().url(), library = pinnedLibraries.find((item) => item.url === url);
    if (library) return request.fulfill({ status: 200, contentType: 'application/javascript', body: library.body, headers: { 'Access-Control-Allow-Origin': '*' } });
    return url.startsWith(base) ? request.continue() : request.abort();
  });
  const page = await context.newPage();
  await page.goto(`${base}index.html`);
  await page.waitForFunction(() => window.AIO_ARCH && typeof window.toggleTheme === 'function');
  // P1756: lightweight-charts loads on first chart use. This journey replaces window._aioFetchYahooChartData (whose
  // chart-screen wrapper waits for the library), so it requests the library through the same loader first.
  await page.evaluate(() => window._aioEnsureChartLibrary('lwc'));
  await page.waitForFunction(() => window.LightweightCharts?.createChart);
  const disclaimer = page.locator('#aio-first-visit-disclaimer button').filter({ hasText: '확인했습니다' });
  if (await disclaimer.isVisible()) await disclaimer.click();
  const screens = [['home','today'],['signal','market'],['macro','macro'],['ticker','stock'],['themes','themes'],['screener','screener'],['portfolio','portfolio'],['principles','learn']];
  const capture = async (id, route, screenId, action, actual, locator = `#page-${route}`) => {
    const host = page.locator(locator); await host.waitFor({ state: 'visible' });
    await page.waitForFunction((id) => document.getElementById(`page-${id}`)?.dataset.aioArchitectureRoute === id, route);
    if (route === 'principles') await host.locator('.af-issue').waitFor({state:'visible'});
    const path = resolve(dirname(output), `${id}.png`), png = await page.screenshot({ path });
    addBrowserEvidenceStep(report, { stepId: id, screenId, route, stateId: id, entity: null, initialCondition: fixture.profile, action: { type: 'journey', target: action }, readyCondition: `${locator} visible and native route mounted${route === 'principles' ? '; note heading visible' : ''}`, readyObserved: true, status: 'observed', authority: 'headless-fixture', claimType: 'text', captureSelection: ['dom','screenshot'], expected: 'visible state and asserted operation', actual, evidence: [{ kind: 'dom', locator, digest: evidenceDigest(await host.textContent() || '') },{kind:'screenshot',path:relative(dirname(output),path).replaceAll('\\','/'),digest:evidenceDigest(png)}], limitations: ['representative state, not every control or semantic/contrast certification'] });
  };
  for (const mode of ['light','dark']) {
    const dark = await page.locator('body').evaluate((body) => body.classList.contains('dark-theme'));
    if (dark !== (mode === 'dark')) await page.locator('#sidebar-theme-btn').click();
    assert.equal(await page.locator('#sidebar-theme-btn').innerText(), mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환', 'P1604: theme label describes the action');
    for (const [route, screenId] of screens) {
      await page.evaluate((id) => window.showPage(id), route);
      await page.locator(`#page-${route}.active`).waitFor({ state: 'visible' });
      await capture(`${mode}-${screenId}`, route, screenId, `navigate to ${route} in ${mode}`, `${mode} mode representative screen mounted`);
    }
    const colors = await page.evaluate(() => { const css = getComputedStyle(document.body); return { dim: css.getPropertyValue('--text-dim').trim(), muted: css.getPropertyValue('--text-muted').trim() }; });
    assert.equal(colors.dim, colors.muted, 'P1604: subdued text uses the readable shared muted token');
    await page.reload(); await page.waitForFunction(() => window.AIO_ARCH);
    assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('dark-theme')), mode === 'dark', 'P1604: mode survives reload');
  }
  // v58.52 (screen audit 2026-10-20): a Korean theme link from another route lands on 테마 with the detail open and in view.
  await page.evaluate(() => window.showPage('ticker'));
  await page.locator('#page-ticker.active').waitFor({ state: 'visible' });
  await page.evaluate(() => window.openKrThemeDetail('semi'));
  await page.waitForFunction(() => document.getElementById('page-themes')?.classList.contains('active') && document.getElementById('kr-theme-detail-panel')?.closest('details')?.open
    && /반도체/.test(document.querySelector('#kr-theme-detail-content .krl-d-title')?.textContent || ''), null, { timeout: 8000 });
  await page.waitForTimeout(900);
  const krDetailTop = await page.evaluate(() => document.getElementById('kr-theme-detail-panel').getBoundingClientRect().top);
  assert.ok(krDetailTop >= -4 && krDetailTop < 400, `v58.52 the Korean theme detail is in view after the jump (top ${krDetailTop})`);
  await page.evaluate(() => window.showPage('themes'));
  // v59.51: the 섹터 RS tooltip left 테마 with the sector bars' own section. The tooltip mechanics are what is under test,
  // so a fixture tooltip with the shared markup goes on the page.
  await page.evaluate(() => {
    const tip = document.createElement('span');
    Object.assign(tip, { className: 'aio-tooltip', tabIndex: 0, textContent: '?' });
    for (const [key, value] of Object.entries({ 'data-action': '_aioTooltipToggle', 'data-pass-el': '1', 'data-pass-event': '1', 'aria-expanded': 'false', role: 'button', 'aria-label': '고정 도움말 설명' })) tip.setAttribute(key, value);
    const body = document.createElement('span'); body.className = 'aio-tooltip-body'; body.textContent = 'fixture'; tip.append(body);
    document.querySelector('#page-themes .page-head')?.append(tip);
  });
  const tooltip = page.getByRole('button', { name: '고정 도움말 설명', exact: true });
  await tooltip.click(); assert.equal(await tooltip.getAttribute('aria-expanded'), 'true', 'P1604: click opens the tooltip');
  await tooltip.press('Escape'); assert.equal(await tooltip.getAttribute('aria-expanded'), 'false', 'P1604: Escape closes the tooltip');
  await tooltip.press('Enter'); assert.equal(await tooltip.getAttribute('aria-expanded'), 'true', 'P1604: Enter opens exactly once');
  await tooltip.press(' '); assert.equal(await tooltip.getAttribute('aria-expanded'), 'false', 'P1604: Space closes exactly once');
  await capture('tooltip-keyboard', 'themes','themes','click, Escape, Enter, Space', 'one state transition per input');
  // P1604: a native button carrying role=button must retain its native single activation.
  await page.evaluate(() => { const b=document.createElement('button'); b.id='fixture-native-button'; b.setAttribute('role','button'); b.dataset.action='toggleTheme'; document.body.append(b); });
  await page.locator('#fixture-native-button').press('Enter');
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('dark-theme')), false, 'P1604: native Enter toggles once');
  await page.locator('#fixture-native-button').press(' ');
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('dark-theme')), true, 'P1604: native Space toggles once');
  await page.evaluate(() => {
    const timestamps=Array.from({length:220},(_,i)=>Math.floor(Date.UTC(2025,0,1+i)/1000));
    window._aioFetchYahooChartData=async()=>({timestamps,opens:timestamps.map((_,i)=>100+i/5),highs:timestamps.map((_,i)=>102+i/5),lows:timestamps.map((_,i)=>99+i/5),closes:timestamps.map((_,i)=>101+i/5),volumes:timestamps.map(()=>100000),meta:{exchangeTimezoneName:'America/New_York'}});
    window.showPage('technical');
  });
  await page.waitForFunction(()=>window.__aioStockChartInstance?.chart);
  const chartBefore=await page.evaluate(()=>({range:window.__aioStockChartInstance.chart.timeScale().getVisibleLogicalRange(),text:window.__aioStockChartInstance.chart.options().layout.textColor}));
  await page.locator('#sidebar-theme-btn').click();
  const chartAfter=await page.evaluate(()=>({range:window.__aioStockChartInstance.chart.timeScale().getVisibleLogicalRange(),text:window.__aioStockChartInstance.chart.options().layout.textColor}));
  assert.notEqual(chartAfter.text,chartBefore.text,'P1604: existing stock chart recolors immediately');
  assert.deepEqual(chartAfter.range,chartBefore.range,'P1604: recoloring preserves chart view');
  await capture('stock-chart-recolor','technical','stock','toggle existing chart from dark to light','axis colors updated; logical range retained');
  await page.evaluate(()=> { Storage.prototype.setItem=function(){throw new DOMException('fixture','SecurityError');}; });
  await page.locator('#sidebar-theme-btn').click();
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('dark-theme')),true,'P1604: storage refusal keeps theme functional');
  await capture('theme-storage-refusal','technical','stock','toggle with rejected persistence','visible dark mode and chart update continue');
  await page.evaluate(()=>window.showPage('principles'));
  for(const lesson of PACKET_20261011_LESSONS) {
    const navigation=page.getByRole('navigation',{name:'개념·분석 목차',exact:true});
    // v59.51: the open group's titles sit in one closed list; a reader opens it once and it stays open across re-renders.
    const list=navigation.locator('details.rl-nav-list');
    if(await list.count() && !(await list.evaluate(node=>node.open))) await list.locator('summary').click();
    const button=navigation.getByRole('button',{name:lesson.issue,exact:true}).or(navigation.getByRole('checkbox',{name:lesson.issue,exact:true}));
    await button.click();
    await page.getByText(lesson.answer,{exact:true}).waitFor({state:'visible'});
    assert.ok((await page.locator('#page-principles').textContent()).includes(lesson.reverse),'P1605: selected note includes counter-path');
  }
  await capture('research-note','principles','learn','open all five supplied reasoning notes','five notes show mechanisms, examples and counter-paths');
  await page.getByRole('searchbox', {name:'리서치 라이브러리 통합 검색',exact:true}).fill('차환');
  const noteResult=page.getByRole('option').filter({hasText:'평균이 감추는 신용 분산과 차환의 시간차'});
  await noteResult.click();
  await page.getByRole('heading',{name:'평균이 감추는 신용 분산과 차환의 시간차',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.getByRole('searchbox',{name:'리서치 라이브러리 통합 검색',exact:true}).inputValue(), '', 'P1606: search selection opens the canonical note and clears search');
  const refused=await browser.newContext({serviceWorkers:'block'});
  await refused.route('**/*',(r)=>r.request().url().startsWith(base)?r.continue():r.abort());
  await refused.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('fixture','SecurityError');};});
  const refusedPage=await refused.newPage(); await refusedPage.goto(`${base}index.html`); await refusedPage.waitForFunction(()=>window.AIO_ARCH);
  assert.ok(await refusedPage.locator('#sidebar-theme-btn').isVisible(),'P1604: refused restoration cannot stop boot');
  const errors=validateBrowserEvidence(report,{root}); assert.deepEqual(errors,[], 'P1604: bounded evidence schema');
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:true,steps:report.steps.length,modes:['light','dark'],screens:screens.length,frameworks:PACKET_20261011_CLAIMS.length,evidence:output,semanticReview:'unverified'}));
} finally { await closeAll({ browser, server }); }
