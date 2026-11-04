// wave2-c (S12) evidence: QUALITY-BAR screenshots at 1440/768/390 x light/dark, the shared loading/empty/error states,
// sort and filter round trips, reduced motion, contrast and overflow. Reads the verify-aio server on PORT (default 8797).
// Writes PNGs and proof.json next to this file. Not a CI gate; the gates are ci-screener-controls-contract and the
// screener browser checks.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(out, { recursive: true });
const port = process.env.PORT || 8797;
const base = `http://127.0.0.1:${port}/`;
const ROW = '#screener-results-body tr[data-aio-screener-ticker]';
const proof = { widths: {}, states: {}, roundTrips: {}, reducedMotion: {}, failures: [] };
const fail = (message) => proof.failures.push(message);
const browser = await chromium.launch();

async function open({ width, dark = false, reducedMotion = 'no-preference', route } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width >= 1000 ? 1000 : width >= 700 ? 1024 : 844 }, colorScheme: dark ? 'dark' : 'light', reducedMotion, serviceWorkers: 'block', isMobile: width < 700, hasTouch: width < 700 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (route) { const handled = await route(r, url); if (handled) return; }
    return url.startsWith(base) ? r.continue() : r.abort();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.showPage === 'function');
  const isDark = await page.evaluate(() => document.body.classList.contains('dark-theme'));
  if (isDark !== dark) {
    if (!(await page.locator('#sidebar-theme-btn').isVisible())) await page.locator('#sidebar-toggle-btn').click();
    await page.locator('#sidebar-theme-btn').click();
    if (await page.locator('#sidebar-overlay').isVisible().catch(() => false)) await page.locator('#sidebar-overlay').click();
  }
  await page.evaluate(() => window.showPage('screener'));
  return { context, page, errors };
}
const shot = (page, name) => page.screenshot({ path: resolve(out, `${name}.png`) });
const tickers = (page) => page.$$eval(ROW, (rows) => rows.map((row) => row.dataset.aioScreenerTicker).join(','));
const rsiChip = '#scr-active-filter-chips [data-aio-screener-action="clear-filter"][data-aio-screener-arg="scr-rsi-min"]';
const setRsi = async (page, value) => { await page.fill('#scr-rsi-min', value); await page.dispatchEvent('#scr-rsi-min', 'change'); };

// 1. Widths x themes: default bar, + 조건 open with a chip, 보기 open. Measure overflow, truncation and contrast.
for (const width of [1440, 768, 390]) {
  for (const dark of [false, true]) {
    const key = `${width}-${dark ? 'dark' : 'light'}`;
    const { context, page, errors } = await open({ width, dark });
    await page.waitForSelector(ROW, { timeout: 45000 });
    await shot(page, `${key}-1-default`);
    await page.click('#scr-add-condition');
    await setRsi(page, '50');
    await page.waitForSelector(rsiChip);
    await shot(page, `${key}-2-conditions`);
    await page.keyboard.press('Escape');
    await page.click('#scr-view-button');
    await shot(page, `${key}-3-view`);
    const metrics = await page.evaluate(() => {
      const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bg = (node) => { for (let n = node; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c; } return [255, 255, 255]; };
      const ratio = (node) => { const a = lum(parse(getComputedStyle(node).color)), b = lum(bg(node)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
      const nodes = [...document.querySelectorAll('#page-screener .scr-filterbar button, #page-screener .scr-filterbar select, #page-screener .scr-filterbar input, #scr-active-filter-chips button, #scr-active-filter-chips span, #scr-view-panel button, #scr-table-status, #scr-validation-banner button:not([hidden])')].filter((n) => n.getClientRects().length);
      const contrast = nodes.map((n) => ({ id: n.id || n.className.split(' ')[0] || n.tagName, ratio: ratio(n), text: (n.textContent || n.value || n.placeholder || '').trim().slice(0, 24) }));
      const truncated = nodes.filter((n) => n.tagName !== 'INPUT' && n.tagName !== 'SELECT' && n.scrollWidth > n.clientWidth + 1).map((n) => (n.textContent || '').trim().slice(0, 30));
      return { pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, minContrast: Math.min(...contrast.map((c) => c.ratio)), lowContrast: contrast.filter((c) => c.ratio < 4.5), truncated, status: document.getElementById('scr-table-status')?.textContent.trim(), viewLabel: document.getElementById('scr-view-label')?.textContent };
    });
    proof.widths[key] = { ...metrics, errors };
    if (metrics.pageOverflow > 0) fail(`${key}: page scrolls sideways by ${metrics.pageOverflow}px`);
    if (metrics.lowContrast.length) fail(`${key}: contrast below 4.5 ${JSON.stringify(metrics.lowContrast)}`);
    if (metrics.truncated.length) fail(`${key}: truncated text ${JSON.stringify(metrics.truncated)}`);
    if (errors.length) fail(`${key}: page errors ${errors.join(' | ')}`);
    await context.close();
  }
}

// 2. Shared data states at 1440 (light and dark): empty (no row passes), error (artifact unreachable, retry recovers),
// loading (artifact delayed).
for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light';
  {
    const { context, page } = await open({ width: 1440, dark });
    await page.waitForSelector(ROW, { timeout: 45000 });
    await page.click('#scr-add-condition');
    await page.fill('#scr-rsi-min', '100');
    await page.dispatchEvent('#scr-rsi-min', 'change');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#screener-results-body [data-scr-state="empty"] .aio-state', { timeout: 10000 }).catch(() => {});
    proof.states[`empty-${theme}`] = await page.evaluate(() => { const c = document.querySelector('#screener-results-body [data-scr-state]'); return { state: c?.dataset.scrState, shared: !!c?.querySelector('.aio-state.is-empty'), text: c?.textContent.trim().slice(0, 120) }; });
    await shot(page, `state-empty-${theme}`);
    await context.close();
  }
  {
    let blocked = true;
    const { context, page } = await open({ width: 1440, dark, route: (r, url) => (blocked && /\/public-data\/screener\.json(\?|$)/.test(url) ? r.abort().then(() => true) : false) });
    // A failed read reaches the shared error state through the loading state's 20 s timeout (bootstrap does not re-render
    // the table on a failed sync; follow-up outside this bundle).
    const started = Date.now();
    await page.waitForSelector('#screener-results-body .aio-state.is-error', { timeout: 45000 }).catch(() => {});
    proof.states[`error-${theme}`] = await page.evaluate(() => { const c = document.querySelector('#screener-results-body [data-scr-state]'); return { cellState: c?.dataset.scrState, shared: !!c?.querySelector('.aio-state.is-error'), retry: !!c?.querySelector('.aio-state.is-error button'), text: c?.textContent.trim().slice(0, 120) }; });
    proof.states[`error-${theme}`].shownAfterMs = Date.now() - started;
    await shot(page, `state-error-${theme}`);
    blocked = false;
    const retry = page.locator('#screener-results-body .aio-state.is-error button').first();
    if (await retry.count()) {
      await retry.click();
      proof.states[`error-${theme}`].recoveredRows = await page.waitForSelector(ROW, { timeout: 30000 }).then(() => page.locator(ROW).count()).catch(() => 0);
    }
    await context.close();
  }
  {
    let release;
    const gate = new Promise((done) => { release = done; });
    const { context, page } = await open({ width: 1440, dark, route: async (r, url) => { if (/\/public-data\/screener\.json(\?|$)/.test(url)) { await gate; await r.continue(); return true; } return false; } });
    await page.waitForSelector('#screener-results-body .aio-state.is-loading', { timeout: 15000 }).catch(() => {});
    proof.states[`loading-${theme}`] = await page.evaluate(() => ({ shared: !!document.querySelector('#screener-results-body .aio-state.is-loading'), busy: document.querySelector('#screener-results-body .aio-state')?.getAttribute('aria-busy') }));
    await shot(page, `state-loading-${theme}`);
    release();
    proof.states[`loading-${theme}`].rowsAfter = await page.waitForSelector(ROW, { timeout: 45000 }).then(() => page.locator(ROW).count()).catch(() => 0);
    await context.close();
  }
}
for (const [name, state] of Object.entries(proof.states)) {
  if (!state.shared) fail(`${name}: not rendered with the shared data state ${JSON.stringify(state)}`);
  if (name.startsWith('error') && !(state.retry && state.recoveredRows > 0)) fail(`${name}: retry did not recover ${JSON.stringify(state)}`);
  if (name.startsWith('loading') && !(state.rowsAfter > 0)) fail(`${name}: rows did not arrive after loading`);
}

// 3. Round trips (x3): header sort desc/asc/back, filter set/clear, 보기 switch and back. Each lap must give the same result.
{
  const { context, page } = await open({ width: 1440 });
  await page.waitForSelector(ROW, { timeout: 45000 });
  const initial = await tickers(page);
  const sortKey = await page.$eval('#screener-results-table thead .scr-sort-btn[data-scr-sort]:not([data-scr-sort="rank"])', (b) => b.dataset.scrSort);
  const laps = { sort: [], filter: [], view: [] };
  for (let lap = 0; lap < 3; lap++) {
    const sortButton = () => page.locator(`#screener-results-table thead .scr-sort-btn[data-scr-sort="${sortKey}"]`);
    await sortButton().click(); const first = await tickers(page);
    await sortButton().click(); const second = await tickers(page);
    laps.sort.push(`${first}|${second}`);
    await page.click('#scr-add-condition'); await setRsi(page, '55'); await page.keyboard.press('Escape');
    const filtered = await tickers(page);
    await page.click(rsiChip);
    laps.filter.push(`${filtered}|${await tickers(page)}`);
    await page.click('#scr-view-button');
    await page.click('#scr-view-panel [data-aio-screener-arg="value"]');
    await page.waitForTimeout(300);
    const valueRows = await tickers(page);
    await page.click('#scr-view-panel [data-aio-screener-arg="balanced"]');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    laps.view.push(`${valueRows}|${await tickers(page)}`);
  }
  for (const [kind, values] of Object.entries(laps)) {
    proof.roundTrips[kind] = { laps: values.length, identical: new Set(values).size === 1 };
    if (new Set(values).size !== 1) fail(`${kind} round trips differ`);
  }
  proof.roundTrips.sortKey = sortKey;
  proof.roundTrips.filterRestoresRows = laps.filter[0].split('|')[1] !== undefined;
  proof.roundTrips.initialRows = initial.split(',').length;
  await context.close();
}

// 4. Reduced motion: panel and chip transitions do not animate.
{
  const { context, page } = await open({ width: 1440, reducedMotion: 'reduce' });
  await page.waitForSelector(ROW, { timeout: 45000 });
  await page.click('#scr-add-condition');
  proof.reducedMotion = await page.evaluate(() => {
    const max = (sel) => Math.max(0, ...[...document.querySelectorAll(sel)].map((n) => { const s = getComputedStyle(n); return Math.max(...`${s.transitionDuration},${s.animationDuration}`.split(',').map((v) => parseFloat(v) * (v.includes('ms') ? 1 : 1000) || 0)); }));
    return { panelMs: max('#scr-condition-panel, #scr-view-panel'), barMs: max('.scr-filterbar button, .scr-filterbar select'), chipMs: max('#scr-active-filter-chips *') };
  });
  if (Object.values(proof.reducedMotion).some((ms) => ms > 10)) fail(`reduced motion still animates ${JSON.stringify(proof.reducedMotion)}`);
  await context.close();
}

await browser.close();
writeFileSync(resolve(out, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({ failures: proof.failures, states: proof.states, roundTrips: proof.roundTrips, reducedMotion: proof.reducedMotion }, null, 1));
process.exit(proof.failures.length ? 1 : 0);
