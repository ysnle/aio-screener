#!/usr/bin/env node
// v59.70 (ui-states follow-up, 2026-11-04): a 종목 deep link opens that company on that tab. #technical/AAPL opened the
// 차트 page with the 오늘 hub tabs (요약 · 브리핑 · 뉴스) and no chart: resolveInitialRoute (src/app/bootstrap.js) cut the
// boot route only at '?', so 'technical/AAPL' was not a route and the shell booted on home while the router's own
// parser (parseRouteDeepLink) opened the page. Every 종목 tab route × the path form (#route/SYM) and the query form
// (#route?sym=SYM) × two symbols: the active page is that route, the selected hub tab is that route's tab, the hub line
// (or, on 개요, the summary) names the symbol, and the address ends canonical. Local server, external requests aborted.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startLocalServer, freePort } from './lib/browser-gate.mjs';
import { ROUTE_HUBS } from '../src/ui/navigation/route-hubs.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = (Number(process.env.CI_ENTITY_DEEP_LINK_PORT) || await freePort());
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, '_artifacts/entity-deep-link');
mkdirSync(out, { recursive: true });

const stockHub = ROUTE_HUBS.find((hub) => hub.routes.some((route) => route.id === 'ticker'));
if (!stockHub) throw new Error('v59.70 entity deep link: no ROUTE_HUBS entry holds the ticker route');
const cases = [];
for (const route of stockHub.routes) {
  for (const sym of ['AAPL', 'MSFT']) for (const form of ['path', 'query']) cases.push({ route: route.id, tab: route.label, sym, form, hash: form === 'path' ? `#${route.id}/${sym}` : `#${route.id}?sym=${sym}` });
}
const tickerTab = stockHub.routes.find((route) => route.id === 'ticker');
cases.push({ route: 'ticker', tab: tickerTab.label, sym: 'NVDA', form: 'path', view: 'memo', hash: '#ticker/NVDA?view=memo' });

const failures = [];
const results = [];
let server, browser;
try {
  server = await startLocalServer(port, { label: 'entity-deep-link/server' });
  browser = await chromium.launch({ headless: true });
  for (const item of cases) {
    // A fresh context per link: the address alone must carry the subject (no saved subject from the previous case).
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { try { localStorage.setItem('aio_disclaimer_ack_v1', '1'); } catch (_) {} });
    await context.route('**/*', (request) => (request.request().url().startsWith(base) || request.request().url().startsWith('data:') ? request.continue() : request.abort()));
    let blockedAfterBoot = false;
    if (item.view === 'memo') await context.route('**/src/app/after-boot.js', (route) => {
      blockedAfterBoot = true;
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/index.html${item.hash}`, { waitUntil: 'domcontentloaded' });
    const seen = await page.waitForFunction(({ route, sym, view }) => {
      const active = document.querySelector('.page.active')?.id;
      const tab = [...document.querySelectorAll('[role=tab][aria-selected="true"]')].find((node) => node.offsetParent);
      const subject = document.querySelector('.aio-hub-subject strong')?.textContent?.trim() || '';
      const summary = document.getElementById('ticker-title')?.textContent || document.querySelector('#page-ticker h1')?.textContent || '';
      const named = route === 'ticker' ? summary.toUpperCase().includes(sym) || window._aioLastOpenedSymbol === sym : subject === sym;
      const viewMatches = !view || (document.getElementById(`page-${route}`)?.dataset.view === view && location.hash.includes(`view=${view}`));
      return active === `page-${route}` && tab && named && viewMatches ? { active, tab: tab.textContent.trim(), subject, hash: location.hash } : null;
    }, item, { timeout: 15000 }).then((handle) => handle.jsonValue()).catch(() => null);
    const state = seen || await page.evaluate(() => ({
      active: document.querySelector('.page.active')?.id || null,
      tab: [...document.querySelectorAll('[role=tab][aria-selected="true"]')].find((node) => node.offsetParent)?.textContent?.trim() || null,
      tabs: [...document.querySelectorAll('[role=tab]')].filter((node) => node.offsetParent).map((node) => node.textContent.trim()),
      subject: document.querySelector('.aio-hub-subject strong')?.textContent?.trim() || null,
      hash: location.hash
    }));
    const problems = [];
    if (state.active !== `page-${item.route}`) problems.push(`active ${state.active}`);
    if (state.tab !== item.tab) problems.push(`selected tab ${state.tab} (tabs ${JSON.stringify(state.tabs || [])})`);
    if (!seen) problems.push(`symbol ${item.sym} not shown (hub line ${state.subject})`);
    const expected = new URLSearchParams({ sym: item.sym });
    if (item.view) expected.set('view', item.view);
    const actual = new URLSearchParams(state.hash.split('?')[1]);
    if (!state.hash.startsWith(`#${item.route}?`) || actual.size !== expected.size || [...expected].some(([key, value]) => actual.get(key) !== value)) problems.push(`address ${state.hash}`);
    if (item.view === 'memo') {
      const note = page.getByRole('textbox', { name: '종목 근거 메모' });
      await note.waitFor();
      await note.fill('아직 저장하지 않은 NVDA 초안');
      await page.locator('#page-ticker .page-views button[data-view="now"]').click();
      await page.getByRole('button', { name: '내 논지·메모 열기' }).click();
      if (!await note.evaluate((node) => node === document.activeElement && node.value === '아직 저장하지 않은 NVDA 초안')) problems.push('memo CTA did not focus or retain the draft');
      await page.goBack();
      await page.waitForFunction(() => document.getElementById('page-ticker')?.dataset.view === 'now');
      if (!blockedAfterBoot) problems.push('the after-boot request was not blocked');
    }
    if (errors.length) problems.push(`page errors ${errors.slice(0, 2).join(' | ')}`);
    results.push({ ...item, state, problems });
    if (problems.length) failures.push(`${item.hash}: ${problems.join('; ')}`);
    await context.close();
  }
  const fiscal = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
  await fiscal.addInitScript(() => localStorage.setItem('aio_disclaimer_ack_v1', '1'));
  await fiscal.route('**/*', (route) => (route.request().url().startsWith(base) || route.request().url().startsWith('data:') ? route.continue() : route.abort()));
  const page = await fiscal.newPage();
  await page.goto(`${base}/index.html#fundamental?sym=NVDA`, { waitUntil: 'domcontentloaded' });
  const thesis = page.locator('#page-fundamental .fiscal-thesis-fold');
  await thesis.locator(':scope > summary').click();
  await thesis.getByRole('button', { name: '이 틀로 내 논지 메모 시작' }).click();
  await page.waitForFunction(() => {
    const params = new URLSearchParams(location.hash.split('?')[1]);
    const note = document.querySelector('#page-ticker.active[data-view="memo"] [data-research-snapshots="stock"] textarea');
    return !!note && note === document.activeElement && note.value.includes('NVDA') && params.get('sym') === 'NVDA' && params.get('view') === 'memo';
  }, null, { timeout: 10000 });
  await page.goBack();
  await page.locator('#page-fundamental.active').waitFor();
  await page.goForward();
  await page.locator('#page-ticker.active[data-view="memo"] textarea[aria-label="종목 근거 메모"]').waitFor();
  const historyLength = await page.evaluate(() => {
    const length = history.length;
    location.hash = '#ticker/AAPL?view=memo&demo=123';
    return length;
  });
  await page.waitForFunction(() => {
    const params = new URLSearchParams(location.hash.split('?')[1]);
    return location.hash.startsWith('#ticker?') && params.get('sym') === 'AAPL'
      && params.get('view') === 'memo' && params.get('demo') === '123'
      && window._aioLastOpenedSymbol === 'AAPL' && document.querySelector('#page-ticker.active')?.dataset.view === 'memo';
  });
  if (await page.evaluate(() => history.length) !== historyLength + 1) failures.push('v60.21 ticker address selection added an extra history entry');
  results.push({ route: 'ticker', form: 'cold fiscal CTA', sym: 'NVDA', hash: new URL(page.url()).hash, problems: [] });
  await fiscal.close();
} catch (error) { failures.push(error.stack || error.message); }
finally { await closeAll({ browser, server }); }

writeFileSync(resolve(out, 'report.json'), JSON.stringify({ gate: 'v59.70 entity deep link', status: failures.length ? 'FAIL' : 'PASS', results, failures }, null, 2) + '\n');
if (failures.length) {
  console.error(`v59.70 entity deep link FAIL (${failures.length}/${cases.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`v60.21 entity deep link PASS: ${cases.length} links, memo focus without after-boot, and cold fiscal-to-memo navigation with history and subject continuity.`);
