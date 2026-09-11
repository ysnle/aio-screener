import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ROUTE_IDS } from '../src/app/routes.js';
mkdirSync('_artifacts/structural-quality-20260906', { recursive: true });
const PORT = Number(process.env.CI_USER_JOURNEY_PORT || 8921);
const BASE_URL = 'http://127.0.0.1:' + PORT + '/';
const server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (String(data).includes('AIO local server')) resolve(); }); server.on('error', reject); server.on('exit', code => reject(new Error('server exited: ' + code))); });
const browser = await chromium.launch();
const report = { generatedAt: new Date().toISOString(), routes: [], checks: [], errors: [] };
const check = (name, ok) => { report.checks.push({ name, ok }); if (!ok) throw new Error(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', r => r.request().url().startsWith(BASE_URL) ? r.continue() : r.abort());
  await page.goto(BASE_URL + 'index.html');
  await page.waitForFunction(() => typeof window.showPage === 'function' && window.AIO);
  report.version = await page.evaluate(() => window.APP_VERSION);
  for (const id of ROUTE_IDS) {
    await page.evaluate(id => window.showPage(id, null), id);
    await page.waitForTimeout(350);
    const row = await page.evaluate(id => {
      const el = document.getElementById('page-' + id);
      return { id, exists: !!el, moduleState: el?.dataset.aioRouteModuleState || null,
        controls: el ? [...el.querySelectorAll('button,input,select,textarea,a[href]')].filter(e => e.getClientRects().length).map(e => ({ tag: e.tagName, name: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 110) })) : [],
        headings: el ? [...el.querySelectorAll('h1,h2,h3,.page-title')].map(e => e.textContent.trim().slice(0, 100)) : [] };
    }, id);
    report.routes.push(row); check('route shell ' + id, row.exists && row.moduleState !== 'failed');
  }
  await page.evaluate(() => window.showPage('guide', null));
  await page.waitForFunction(() => document.querySelector('#page-guide')?.dataset.aioArchitectureRenderer === 'native');
  await page.locator('#guide-search-input').fill('점수');
  await page.locator('#guide-search-input').press('Enter');
  const first = page.locator('#guide-search-result [data-guide-target]').first();
  check('guide results', await first.count() > 0);
  const target = await first.getAttribute('data-guide-target');
  await first.click({ force: true });
  check('guide focused paragraph', await page.evaluate(id => document.activeElement?.id === id && id !== 'page-guide', target));
  check('guide canonical weights', await page.locator('#guide-score-components').textContent().then(x => x.includes('25%') && x.includes('20%')));
  const fixtures = await page.evaluate(async () => {
    const { createLearningState } = await import('/src/domain/knowledge/learning-state.js');
    const { createKnowledgeLearningControls } = await import('/src/ui/knowledge/learning-controls.js');
    const learning = createLearningState({ storage: { getItem: () => null, setItem: () => { throw Error('quota'); } } });
    const host = document.createElement('div'); document.body.append(host);
    const render = () => host.replaceChildren(createKnowledgeLearningControls(document, { learning, itemId: 'fixture', onChange: render }));
    render(); const input = host.querySelector('textarea'); input.value = 'unsaved draft'; input.dispatchEvent(new Event('input'));
    host.querySelector('.knowledge-learning-bookmark').click();
    const draft = host.querySelector('textarea').value === 'unsaved draft'; host.querySelector('.knowledge-learning-note-save').click();
    const memory = host.querySelector('[role=status]').textContent.includes('현재 화면 세션') && learning.snapshot().notes.fixture.value === 'unsaved draft'; host.remove();
    const prior = window._liveData;
    window._liveData = { '^GSPC': { price: 100, source: 'snapshot:market-snapshot', observedAt: '2026-08-01' }, SPY: { price: 100, source: 'reference:fx:fixture', observedAt: '2026-08-01' } };
    const model = window.AIO.getBriefingCanonicalObservationModel(); window._liveData = prior;
    const source = model.metrics.spx.sourceKind === 'SNAPSHOT' && model.metrics.spy.sourceKind === 'REFERENCE' && model.metrics.spx.asOf === '2026-08-01';
    const { createLazyPage, createRouteRegistry, createLifecycleRouter } = await import('/src/app/router.js');
    let mounts = 0, cleanups = 0;
    const lazy = createLazyPage({ route: 'guide', loader: async () => ({}), factory: () => ({ mount: ({ scope }) => { mounts++; scope.add(() => cleanups++); if (mounts === 1) throw Error('partial mount'); } }) });
    const router = createLifecycleRouter({ root: new EventTarget(), registry: createRouteRegistry({ modules: { guide: lazy } }), context: { documentRef: document } });
    router.transition('guide'); await new Promise(r => setTimeout(r, 0)); const cleaned = cleanups === 1;
    router.transition('guide'); await new Promise(r => setTimeout(r, 0)); const retried = mounts === 2; router.dispose();
    return { draft, memory, source, cleaned, retried };
  });
  for (const [name, ok] of Object.entries(fixtures)) check(name, ok);
  await page.screenshot({ path: '_artifacts/structural-quality-20260906/guide.png' });
} catch (e) { report.errors.push(String(e)); process.exitCode = 1; }
finally { writeFileSync('_artifacts/structural-quality-20260906/browser.json', JSON.stringify(report, null, 2)); await browser.close(); server.kill(); }
console.log(JSON.stringify({ routes: report.routes.length, checks: report.checks, errors: report.errors }));
