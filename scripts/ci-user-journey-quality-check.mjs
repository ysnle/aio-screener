import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';
import { ROUTE_IDS } from '../src/app/routes.js';
// v59.59 (QA-CRED-32): the run writes to its own ignored folder; _artifacts/structural-quality-20260906 stays the frozen
// 2026-09-06 evidence it is named for (every local run used to overwrite two tracked files there).
const OUT_DIR = '_artifacts/user-journey';
mkdirSync(OUT_DIR, { recursive: true });
const PORT = (Number(process.env.CI_USER_JOURNEY_PORT) || await freePort());
const BASE_URL = 'http://127.0.0.1:' + PORT + '/';
const server = await startLocalServer(PORT, { label: 'user-journey/server' }); // v57.62 shared lifecycle
const browser = await chromium.launch().catch(async (error) => { await closeAll({ server }); throw error; });
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
  const foldFixture = await page.evaluate(async () => {
    const { renderMoveNews } = await import('/src/ui/components/briefing-read.js');
    const { renderSectorMoves } = await import('/src/ui/components/sector-moves.js');
    const sector = document.createElement('section'); sector.id = 'briefing-sector-moves'; document.body.append(sector);
    const doc = { createElement: document.createElement.bind(document), createTextNode: document.createTextNode.bind(document),
      getElementById: (id) => id === sector.id ? sector : sector.querySelector(`#${id}`) };
    const nowMs = Date.parse('2026-10-31T12:00:00Z');
    const root = { _serverDataMeta: { rotationHistory: { schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v3', benchmark: 'SPY',
      timeframe: '1d', priceBasis: 'adjusted-close', decisionUse: false, allowedUseCeiling: 'reference', latestCompletedSession: '2026-10-30',
      items: Object.fromEntries(['XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLP'].map((symbol) => [symbol, { status: 'CURRENT', sessionDate: '2026-10-30',
        rsRatio: 101, rsMomentum: 101, quadrant: 'Leading', dailyPct: 1, weeklyPct: 2, alignedSessionCount: 60,
        observedAt: '2026-10-30T20:00:00Z', fetchedAt: '2026-10-30T20:20:00Z' }])) } } };
    const flow = { available: true, session: '2026-10-30', themes: { available: true, memberSplits: [{ up: { sym: 'AAA', d1: 2 }, down: { sym: 'BBB', d1: -1 } }] } };
    renderSectorMoves({ documentRef: doc, root, host: sector, nowMs });
    renderMoveNews(doc, root, null, flow);
    const fold = sector.querySelector('#briefing-move-news');
    const summary = fold?.querySelector(':scope > summary');
    fold.open = true; summary?.focus();
    renderSectorMoves({ documentRef: doc, root, host: sector, nowMs });
    renderMoveNews(doc, root, null, flow);
    const retainedNode = sector.querySelector('#briefing-move-news') === fold && fold.open;
    const retainedFocus = document.activeElement === summary;
    renderMoveNews(doc, root, null, { available: false });
    const hiddenWhileMissing = fold.hidden;
    renderMoveNews(doc, root, null, flow);
    const retainedOpenAfterMissing = sector.querySelector('#briefing-move-news') === fold && fold.open && !fold.hidden;
    sector.remove();
    return { retainedNode, retainedFocus, hiddenWhileMissing, retainedOpenAfterMissing };
  });
  for (const [name, ok] of Object.entries(foldFixture)) check(`v59.52 (P2187) briefing why-moved fold ${name}`, ok);
  const temperatureFixture = await page.evaluate(async () => {
    const { renderMarketTemperature } = await import('/src/ui/components/market-temperature.js');
    const { TEMPERATURE_COMPONENTS } = await import('/src/domain/sentiment/market-temperature.js');
    const host = document.createElement('div'); document.body.append(host);
    const anchor = document.createElement('div'); host.append(anchor);
    const doc = { createElement: document.createElement.bind(document), createElementNS: document.createElementNS.bind(document),
      createTextNode: document.createTextNode.bind(document), getElementById: (id) => host.querySelector(`#${id}`) };
    const make = (asOf) => ({ schemaVersion: 'market-temperature.v1', status: 'current', generatedAt: `${asOf}T20:00:00Z`,
      markets: { spx: { asOf, close: 100, state: 'none', cold: 2, hot: 2, streak: 1,
        components: TEMPERATURE_COMPONENTS.map((row, i) => ({ ...row, score: [5, 5, 95, 95, 50][i], raw: 0 })) } } });
    const root = { _aioMarketTemperature: make(new Date().toISOString().slice(0, 10)), fetch: async () => { throw Error('offline fixture'); } };
    renderMarketTemperature({ documentRef: doc, root, anchor });
    const mixed = host.querySelector('.temp-tile-state')?.textContent === '냉각·과열 혼재';
    root._aioMarketTemperature = make('2020-01-01');
    renderMarketTemperature({ documentRef: doc, root, anchor });
    const unavailable = /판단하지 않습니다/.test(host.querySelector('.market-temperature > .regime-read')?.textContent || '');
    host.remove();
    return { mixed, unavailable };
  });
  for (const [name, ok] of Object.entries(temperatureFixture)) check(`v59.53 temperature presentation ${name}`, ok);
  await page.evaluate(() => window.showPage('guide', null));
  await page.waitForFunction(() => document.querySelector('#page-guide')?.dataset.aioArchitectureRenderer === 'native');
  // v59.70 (wave2-f S23): the guide is searched through the command search's 도움말 scope; a pick focuses the paragraph.
  await page.evaluate(() => window._aioOpenCommandSearch({ scope: 'guide' }).then(() => true));
  await page.locator('#aio-command-input').fill('판정');
  const first = page.locator('#aio-command-results [role="option"][data-kind="guide"]').first();
  await first.waitFor({ timeout: 5000 }).catch(() => {});
  check('guide results', await first.count() > 0);
  await first.click({ force: true });
  const focusedInGuide = () => { const el = document.activeElement; return Boolean(el?.id && el.id !== 'page-guide' && document.getElementById('page-guide')?.contains(el)); };
  await page.waitForFunction(focusedInGuide, null, { timeout: 3000 }).catch(() => {});
  check('guide focused paragraph', await page.evaluate(() => { const el = document.activeElement; return Boolean(el?.id && el.id !== 'page-guide' && document.getElementById('page-guide')?.contains(el)) && document.getElementById('aio-command-search')?.open === false; }));
  // v59.51 (content audit): the guide's screen cards (#guide-screen-cards) are retired — the menu itself names the 8 screens;
  // the guide is three folded chapters (판정 기준표, 읽는 법, 데이터) under the hero.
  check('v59.51 (content audit) guide has no screen cards and three folded chapters (P1428 successor)', await page.locator('#guide-screen-cards').count() === 0 && await page.locator('#guide-score-components').count() === 0 && await page.locator('#page-guide > .aio-guide-chapter').count() === 3);
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
    const { createLazyPage, createRouteRegistry, createLifecycleRouter } = await import('/src/app/router.js');
    let mounts = 0, cleanups = 0;
    const lazy = createLazyPage({ route: 'guide', loader: async () => ({}), factory: () => ({ mount: ({ scope }) => { mounts++; scope.add(() => cleanups++); if (mounts === 1) throw Error('partial mount'); } }) });
    const router = createLifecycleRouter({ root: new EventTarget(), registry: createRouteRegistry({ modules: { guide: lazy } }), context: { documentRef: document } });
    router.transition('guide'); await new Promise(r => setTimeout(r, 0)); const cleaned = cleanups === 1;
    router.transition('guide'); await new Promise(r => setTimeout(r, 0)); const retried = mounts === 2; router.dispose();
    return { draft, memory, cleaned, retried };
  });
  for (const [name, ok] of Object.entries(fixtures)) check(name, ok);
  await page.screenshot({ path: `${OUT_DIR}/guide.png` });
} catch (e) { report.errors.push(String(e)); process.exitCode = 1; }
finally { writeFileSync(`${OUT_DIR}/browser.json`, JSON.stringify(report, null, 2)); await closeAll({ browser, server }); }
console.log(JSON.stringify({ routes: report.routes.length, checks: report.checks, errors: report.errors }));
